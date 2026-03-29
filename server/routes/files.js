const express = require('express');
const router = express.Router();
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const File = require('../models/File');
const User = require('../models/User');
const { protect, authorize } = require('../middleware/auth');
const { createAuditLog } = require('../utils/audit');
const {
    encryptFile, decryptFile,
    rsaEncrypt, rsaDecrypt,
    loadHodPrivateKey, loadHodPublicKey,
    splitKey, combineShares,
    createVisualShares, combineVisualShares,
    encryptShareToFile, decryptShareFromFile,
    generateECDHKeyPair, computeECDHSharedSecret,
    encryptWithSharedSecret, decryptWithSharedSecret
} = require('../utils/crypto');

// ─── Config ──────────────────────────────────────────────────────────────────
const UPLOADS_DIR    = path.join(__dirname, '..', 'uploads');
const ENCRYPTED_DIR  = path.join(UPLOADS_DIR, 'encrypted');
const SHARES_DIR     = path.join(UPLOADS_DIR, 'shares');
const KEY_SHARES_DIR = path.join(UPLOADS_DIR, 'key_shares');

[UPLOADS_DIR, ENCRYPTED_DIR, SHARES_DIR, KEY_SHARES_DIR].forEach(d => {
    if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
});

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 25 * 1024 * 1024 }
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

function uid() { return crypto.randomBytes(16).toString('hex'); }

function checkTimeRestriction(file, res) {
    const now = new Date();
    const allowed = new Date(file.allowedDecryptionTime);
    if (now < allowed) {
        res.status(403).json({
            message: 'Access denied: decryption is not yet allowed.',
            allowedDecryptionTime: file.allowedDecryptionTime,
            currentTime: now.toISOString(),
            remainingMs: allowed - now
        });
        return false;
    }
    return true;
}

function bundleImages(buffers) {
    const parts = [];
    for (const buf of buffers) {
        const lenBuf = Buffer.alloc(4);
        lenBuf.writeUInt32BE(buf.length, 0);
        parts.push(lenBuf, buf);
    }
    return Buffer.concat(parts);
}

function unbundleImages(bundled, count) {
    const images = [];
    let offset = 0;
    for (let i = 0; i < count; i++) {
        const len = bundled.readUInt32BE(offset);
        offset += 4;
        images.push(bundled.slice(offset, offset + len));
        offset += len;
    }
    return images;
}

function saveToDisk(dir, buffer, ext = '.bin') {
    const filename = uid() + ext;
    const filePath = path.join(dir, filename);
    fs.writeFileSync(filePath, buffer);
    return filePath;
}

// ─── Upload ──────────────────────────────────────────────────────────────────
router.post('/upload', protect, authorize('Coordinator'),
    upload.fields([
        { name: 'file',  maxCount: 1 },
        { name: 'files', maxCount: 4 },
    ]),
    async (req, res) => {
    const { title, subject, examTime, mode, uploadType, hodId, staffId, allowedDecryptionTime } = req.body;

    if (!title || !examTime || !mode) return res.status(400).json({ message: 'Missing title, examTime, or mode.' });
    if (!['individual', 'multi'].includes(mode)) return res.status(400).json({ message: 'Invalid mode.' });
    if (!hodId) return res.status(400).json({ message: 'hodId is required.' });
    if (mode === 'multi' && !staffId) return res.status(400).json({ message: 'staffId is required for multi mode.' });

    const pdfFile    = req.files?.file?.[0];
    const imageFiles = req.files?.files;

    if (uploadType === 'images') {
        if (!imageFiles || imageFiles.length === 0) return res.status(400).json({ message: 'At least one image required.' });
        if (imageFiles.length > 4) return res.status(400).json({ message: 'Maximum 4 images allowed.' });
    } else {
        if (!pdfFile) return res.status(400).json({ message: 'PDF file is required.' });
    }

    try {
        const hod = await User.findById(hodId).select('name role rsaPublicKey');
        if (!hod || hod.role !== 'HOD') return res.status(400).json({ message: 'Invalid HOD.' });

        let staff = null;
        if (mode === 'multi') {
            staff = await User.findById(staffId).select('name role');
            if (!staff || staff.role !== 'Staff') return res.status(400).json({ message: 'Invalid Staff.' });
        }

        const decryptionTime = allowedDecryptionTime || examTime;
        let fileData = {};

        if (uploadType === 'images') {
            const sharePaths1 = [], sharePaths2 = [], imageMeta = [];

            for (const imgFile of imageFiles) {
                const { share1, share2 } = await createVisualShares(imgFile.buffer);
                sharePaths1.push(saveToDisk(SHARES_DIR, share1, '.png'));
                sharePaths2.push(saveToDisk(SHARES_DIR, share2, '.png'));
                imageMeta.push({ originalName: imgFile.originalname, mimeType: imgFile.mimetype, size: imgFile.size });
            }

            const imageBundle = bundleImages(imageFiles.map(f => f.buffer));
            const { aesKeyHex, iv, authTag, encryptedData } = encryptFile(imageBundle);
            const encryptedFilePath = saveToDisk(ENCRYPTED_DIR, encryptedData, '.enc');

            const hodPublicKey = hod.rsaPublicKey || loadHodPublicKey();
            const encryptedAesKey = rsaEncrypt(Buffer.from(aesKeyHex, 'hex'), hodPublicKey);

            const [keyShare1, keyShare2] = splitKey(aesKeyHex);
            const share1Path = path.join(KEY_SHARES_DIR, uid() + '.share');
            const share2Path = path.join(KEY_SHARES_DIR, uid() + '.share');
            encryptShareToFile(keyShare1, share1Path);
            encryptShareToFile(keyShare2, share2Path);

            fileData = {
                iv, authTag, encryptedAesKey,
                share1Path, share2Path,
                encryptedFilePath,
                imageSharePaths1: sharePaths1,
                imageSharePaths2: sharePaths2,
                imageMeta,
            };
        } else {
            const { aesKeyHex, iv, authTag, encryptedData } = encryptFile(pdfFile.buffer);
            const encryptedFilePath = saveToDisk(ENCRYPTED_DIR, encryptedData, '.enc');

            const hodPublicKey = hod.rsaPublicKey || loadHodPublicKey();
            const encryptedAesKey = rsaEncrypt(Buffer.from(aesKeyHex, 'hex'), hodPublicKey);

            const [keyShare1, keyShare2] = splitKey(aesKeyHex);
            const share1Path = path.join(KEY_SHARES_DIR, uid() + '.share');
            const share2Path = path.join(KEY_SHARES_DIR, uid() + '.share');
            encryptShareToFile(keyShare1, share1Path);
            encryptShareToFile(keyShare2, share2Path);

            fileData = {
                iv, authTag, encryptedAesKey,
                share1Path, share2Path,
                encryptedFilePath,
            };
        }

        const primaryFile = uploadType === 'images' ? imageFiles[0] : pdfFile;

        const file = await File.create({
            title, subject: subject || '',
            examTime: new Date(examTime),
            allowedDecryptionTime: new Date(decryptionTime),
            setterId: req.user._id, setterName: req.user.name,
            uploadType, originalName: primaryFile.originalname, mimeType: primaryFile.mimetype,
            mode, ...fileData,
            hodId: hod._id, hodName: hod.name,
            ...(mode === 'multi' ? { staffId: staff._id, staffName: staff.name } : {})
        });

        await createAuditLog({
            user: req.user, action: 'PAPER_UPLOAD', req, status: 'SUCCESS',
            metadata: { fileId: file._id, title, mode, uploadType, hodName: hod.name }
        });

        res.status(201).json({
            message: 'Paper uploaded and encrypted securely.',
            fileId: file._id, title,
            securityInfo: {
                encryption: 'AES-256-GCM',
                keyManagement: 'Shamir (2,2) + RSA-OAEP',
                rawKeyStored: false,
                sharesOnFileSystem: true,
                sharesEncryptedAtRest: true,
                visualCrypto: uploadType === 'images'
            }
        });
    } catch (error) {
        console.error('Upload error:', error);
        res.status(500).json({ message: 'Upload failed.', error: error.message });
    }
});

// ─── Helpers: Decrypt ────────────────────────────────────────────────────────
function decryptFileData(file, aesKeyHex) {
    const encryptedBuffer = fs.readFileSync(file.encryptedFilePath);
    return decryptFile(encryptedBuffer, aesKeyHex, file.iv, file.authTag);
}

function sendDecrypted(res, file, decryptedBuffer) {
    if (file.uploadType === 'images') {
        const count = file.imageMeta?.length || 1;
        const imageBuffers = unbundleImages(decryptedBuffer, count);
        const images = imageBuffers.map((buf, i) => ({
            data: buf.toString('base64'),
            ...(file.imageMeta?.[i] || { originalName: `image_${i+1}`, mimeType: 'image/png' })
        }));
        res.json({ images, uploadType: 'images' });
    } else {
        res.set({
            'Content-Type': file.mimeType,
            'Content-Disposition': `attachment; filename="${file.originalName}"`,
            'Content-Length': decryptedBuffer.length
        });
        res.send(decryptedBuffer);
    }
}

// ─── List Files ──────────────────────────────────────────────────────────────
router.get('/', protect, async (req, res) => {
    try {
        const { _id: userId, role } = req.user;
        let query = {};
        if (role === 'Coordinator') query.setterId = userId;
        else if (role === 'HOD')    query.hodId = userId;
        else if (role === 'Staff')  query.staffId = userId;

        const files = await File.find(query).select(
            'title subject examTime allowedDecryptionTime mode setterId setterName hodId hodName ' +
            'staffId staffName staffAccessRequested hodApproved hodApprovalTime ' +
            'keyExchangeCompleted uploadType originalName imageMeta createdAt'
        ).sort({ examTime: -1 });
        res.json(files);
    } catch (error) { res.status(500).json({ message: 'Server error' }); }
});

// ─── File Metadata ───────────────────────────────────────────────────────────
router.get('/:id', protect, async (req, res) => {
    try {
        const file = await File.findById(req.params.id).select(
            '-encryptedFilePath -iv -authTag -encryptedAesKey -share1Path -share2Path ' +
            '-imageSharePaths1 -imageSharePaths2 -staffDhPublicKey -encryptedShareForStaff'
        );
        if (!file) return res.status(404).json({ message: 'File not found.' });
        const uid = req.user._id.toString();
        const allowed = [file.setterId?.toString(), file.hodId?.toString(), file.staffId?.toString()];
        if (!allowed.includes(uid)) return res.status(403).json({ message: 'Access denied.' });
        res.json(file);
    } catch (error) { res.status(500).json({ message: 'Server error' }); }
});

// ═══════════════════════════════════════════════════════════════════════════════
// CASE 1: HOD Alone — RSA Private Key
// ═══════════════════════════════════════════════════════════════════════════════
router.post('/:id/decrypt-hod', protect, authorize('HOD'), async (req, res) => {
    try {
        const file = await File.findById(req.params.id);
        if (!file) return res.status(404).json({ message: 'File not found.' });
        if (file.hodId?.toString() !== req.user._id.toString())
            return res.status(403).json({ message: 'Not the assigned HOD.' });
        if (!checkTimeRestriction(file, res)) return;

        const hodPrivateKey = loadHodPrivateKey();
        const aesKeyBuffer = rsaDecrypt(file.encryptedAesKey, hodPrivateKey);
        const aesKeyHex = aesKeyBuffer.toString('hex');

        const decryptedBuffer = decryptFileData(file, aesKeyHex);

        await createAuditLog({ user: req.user, action: 'DECRYPT_SUCCESS', req, status: 'SUCCESS', metadata: { fileId: file._id, method: 'HOD_RSA' } });
        sendDecrypted(res, file, decryptedBuffer);
    } catch (error) {
        console.error('HOD decrypt error:', error);
        await createAuditLog({ user: req.user, action: 'DECRYPT_FAILURE', req, status: 'FAILURE', metadata: { fileId: req.params.id, error: error.message } }).catch(() => {});
        res.status(500).json({ message: 'Decryption failed.', error: error.message });
    }
});

// ═══════════════════════════════════════════════════════════════════════════════
// CASE 2: HOD Decrypt via Combined Shamir Shares (both from filesystem)
// ═══════════════════════════════════════════════════════════════════════════════
router.post('/:id/decrypt-combined', protect, authorize('HOD'), async (req, res) => {
    try {
        const file = await File.findById(req.params.id);
        if (!file) return res.status(404).json({ message: 'File not found.' });
        if (file.hodId?.toString() !== req.user._id.toString())
            return res.status(403).json({ message: 'Not the assigned HOD.' });
        if (file.mode !== 'multi') return res.status(400).json({ message: 'Use HOD-only decrypt for individual mode.' });
        if (!checkTimeRestriction(file, res)) return;
        if (!file.hodApproved) return res.status(403).json({ message: 'Staff access not yet approved.' });

        if (!file.share1Path || !file.share2Path) {
            return res.status(400).json({ message: 'Share files missing. This paper may need to be re-uploaded.' });
        }

        const share1 = decryptShareFromFile(file.share1Path);
        const share2 = decryptShareFromFile(file.share2Path);
        const aesKeyHex = combineShares([share1, share2]);
        const decryptedBuffer = decryptFileData(file, aesKeyHex);

        await createAuditLog({ user: req.user, action: 'DECRYPT_SUCCESS', req, status: 'SUCCESS', metadata: { fileId: file._id, method: 'SHAMIR_COMBINED_HOD' } });
        sendDecrypted(res, file, decryptedBuffer);
    } catch (error) {
        console.error('Combined decrypt error:', error);
        await createAuditLog({ user: req.user, action: 'DECRYPT_FAILURE', req, status: 'FAILURE', metadata: { fileId: req.params.id, error: error.message } }).catch(() => {});
        res.status(500).json({ message: 'Decryption failed.', error: error.message });
    }
});

// ═══════════════════════════════════════════════════════════════════════════════
// CASE 3: Staff Decrypt
//   - If key exchange already completed once: server uses both shares from FS
//   - If first time: staff sends HOD share obtained via DH exchange
// ═══════════════════════════════════════════════════════════════════════════════
router.post('/:id/decrypt-staff', protect, authorize('Staff'), async (req, res) => {
    try {
        const file = await File.findById(req.params.id);
        if (!file) return res.status(404).json({ message: 'File not found.' });
        if (file.staffId?.toString() !== req.user._id.toString())
            return res.status(403).json({ message: 'You are not the assigned Staff.' });
        if (file.mode !== 'multi') return res.status(400).json({ message: 'Not a multi-key paper.' });
        if (!checkTimeRestriction(file, res)) return;
        if (!file.hodApproved) {
            return res.status(403).json({ message: 'HOD has not approved your access. Request access first.' });
        }

        if (!file.share1Path || !file.share2Path) {
            return res.status(400).json({ message: 'Share files missing. This paper may need to be re-uploaded.' });
        }

        let aesKeyHex;

        if (file.keyExchangeCompleted) {
            // Key exchange already done — use shares directly from FS
            const share1 = decryptShareFromFile(file.share1Path);
            const share2 = decryptShareFromFile(file.share2Path);
            aesKeyHex = combineShares([share1, share2]);
        } else {
            // First decrypt — staff must provide HOD share from DH exchange
            const { hodShare } = req.body;
            if (!hodShare) {
                return res.status(400).json({ message: 'hodShare is required. Complete the key exchange first.' });
            }

            const staffShare = decryptShareFromFile(file.share2Path);
            aesKeyHex = combineShares([hodShare, staffShare]);

            // Mark exchange as completed so future decrypts don't need DH again
            file.keyExchangeCompleted = true;
            file.encryptedShareForStaff = null;  // cleanup
            await file.save();
        }

        const decryptedBuffer = decryptFileData(file, aesKeyHex);

        await createAuditLog({ user: req.user, action: 'DECRYPT_SUCCESS', req, status: 'SUCCESS',
            metadata: { fileId: file._id, method: 'STAFF_DECRYPT', staffId: req.user._id } });
        sendDecrypted(res, file, decryptedBuffer);
    } catch (error) {
        console.error('Staff decrypt error:', error);
        await createAuditLog({ user: req.user, action: 'DECRYPT_FAILURE', req, status: 'FAILURE', metadata: { fileId: req.params.id, error: error.message } }).catch(() => {});
        res.status(500).json({ message: 'Decryption failed.', error: error.message });
    }
});

// ─── Image Shares (Visual Cryptography) ──────────────────────────────────────
router.get('/:id/image-share', protect, async (req, res) => {
    try {
        const file = await File.findById(req.params.id);
        if (!file) return res.status(404).json({ message: 'File not found.' });
        if (file.uploadType !== 'images') return res.status(400).json({ message: 'Not an image file.' });
        if (!checkTimeRestriction(file, res)) return;

        const uid = req.user._id.toString();
        let sharePaths;

        if (req.user.role === 'HOD' && file.hodId?.toString() === uid) {
            sharePaths = file.imageSharePaths1;
        } else if (req.user.role === 'Staff' && file.staffId?.toString() === uid) {
            if (!file.hodApproved) return res.status(403).json({ message: 'HOD has not approved your access yet.' });
            sharePaths = file.imageSharePaths2;
        } else {
            return res.status(403).json({ message: 'Access denied.' });
        }

        const shares = sharePaths.map(p => fs.readFileSync(p).toString('base64'));
        res.json({ shares, imageMeta: file.imageMeta });
    } catch (error) { res.status(500).json({ message: 'Server error', error: error.message }); }
});

// ─── Combine Image Shares (HOD) ─────────────────────────────────────────────
router.post('/:id/combine-image', protect, authorize('HOD'), async (req, res) => {
    try {
        const file = await File.findById(req.params.id);
        if (!file) return res.status(404).json({ message: 'File not found.' });
        if (file.uploadType !== 'images') return res.status(400).json({ message: 'Not an image file.' });
        if (file.hodId?.toString() !== req.user._id.toString()) return res.status(403).json({ message: 'Not the assigned HOD.' });
        if (!checkTimeRestriction(file, res)) return;

        const count = Math.min(file.imageSharePaths1.length, file.imageSharePaths2.length);
        const combinedImages = [];

        for (let i = 0; i < count; i++) {
            const share1Buf = fs.readFileSync(file.imageSharePaths1[i]);
            const share2Buf = fs.readFileSync(file.imageSharePaths2[i]);
            const combined = await combineVisualShares(share1Buf, share2Buf);
            combinedImages.push({
                data: combined.toString('base64'),
                ...(file.imageMeta?.[i] || { originalName: `image_${i+1}`, mimeType: 'image/png' })
            });
        }

        await createAuditLog({ user: req.user, action: 'DECRYPT_SUCCESS', req, status: 'SUCCESS', metadata: { fileId: file._id, method: 'VISUAL_CRYPTO_COMBINED' } });
        res.json({ images: combinedImages, method: 'visual_crypto' });
    } catch (error) {
        console.error('Image combine error:', error);
        res.status(500).json({ message: 'Image reconstruction failed.', error: error.message });
    }
});

// ═══════════════════════════════════════════════════════════════════════════════
// STAFF REQUEST ACCESS — sends DH public key
// ═══════════════════════════════════════════════════════════════════════════════
router.post('/:id/request-access', protect, authorize('Staff'), async (req, res) => {
    try {
        const file = await File.findById(req.params.id);
        if (!file) return res.status(404).json({ message: 'File not found.' });
        if (file.staffId?.toString() !== req.user._id.toString()) return res.status(403).json({ message: 'Not your paper.' });
        if (file.mode !== 'multi') return res.status(400).json({ message: 'Individual mode — no access request needed.' });
        if (!checkTimeRestriction(file, res)) return;

        const { dhPublicKey } = req.body;
        if (!dhPublicKey) return res.status(400).json({ message: 'dhPublicKey is required for key exchange.' });

        file.staffAccessRequested = true;
        file.staffAccessRequestTime = new Date();
        file.staffDhPublicKey = dhPublicKey;
        // Reset previous approval if re-requesting
        file.hodApproved = false;
        file.hodApprovalTime = null;
        file.hodDhPublicKey = null;
        file.encryptedShareForStaff = null;
        file.keyExchangeCompleted = false;
        await file.save();

        await createAuditLog({ user: req.user, action: 'KEY_ACCESS', req, status: 'ATTEMPT',
            metadata: { fileId: file._id, type: 'staff_access_request_with_dh' } });
        res.json({ message: 'Access request sent to HOD with key exchange parameters. Waiting for approval.' });
    } catch (error) { res.status(500).json({ message: 'Server error', error: error.message }); }
});

// ═══════════════════════════════════════════════════════════════════════════════
// HOD APPROVE — ECDH key exchange: encrypts HOD share with DH shared secret
// ═══════════════════════════════════════════════════════════════════════════════
router.post('/:id/approve', protect, authorize('HOD'), async (req, res) => {
    try {
        const file = await File.findById(req.params.id);
        if (!file) return res.status(404).json({ message: 'File not found.' });
        if (file.hodId?.toString() !== req.user._id.toString()) return res.status(403).json({ message: 'Not your paper.' });
        if (!file.staffAccessRequested) return res.status(400).json({ message: 'Staff has not requested access yet.' });
        if (!file.staffDhPublicKey) return res.status(400).json({ message: 'Staff DH public key missing. Staff must re-request access.' });

        if (!file.share1Path) {
            return res.status(400).json({ message: 'Share files missing. This paper may need to be re-uploaded.' });
        }

        // 1. Generate HOD ECDH keypair
        const hodDH = generateECDHKeyPair();

        // 2. Compute shared secret
        const sharedSecret = computeECDHSharedSecret(hodDH.privateKey, file.staffDhPublicKey);

        // 3. Read HOD share from encrypted file on disk
        const hodShare = decryptShareFromFile(file.share1Path);

        // 4. Encrypt HOD share with DH shared secret
        const encryptedShareForStaff = encryptWithSharedSecret(hodShare, sharedSecret);

        file.hodApproved = true;
        file.hodApprovalTime = new Date();
        file.hodDhPublicKey = hodDH.publicKey;
        file.encryptedShareForStaff = encryptedShareForStaff;
        await file.save();

        await createAuditLog({ user: req.user, action: 'KEY_ACCESS', req, status: 'SUCCESS',
            metadata: { fileId: file._id, type: 'hod_approval_dh_key_exchange', staffId: file.staffId } });
        res.json({
            message: `Access approved for "${file.title}". Key securely exchanged via ECDH. Staff can now decrypt.`
        });
    } catch (error) {
        console.error('Approve error:', error);
        res.status(500).json({ message: 'Approval failed.', error: error.message });
    }
});

// ═══════════════════════════════════════════════════════════════════════════════
// STAFF RETRIEVE SHARE — gets encrypted HOD share + HOD DH public key
// ═══════════════════════════════════════════════════════════════════════════════
router.get('/:id/retrieve-share', protect, authorize('Staff'), async (req, res) => {
    try {
        const file = await File.findById(req.params.id);
        if (!file) return res.status(404).json({ message: 'File not found.' });
        if (file.staffId?.toString() !== req.user._id.toString())
            return res.status(403).json({ message: 'You are not the assigned Staff.' });
        if (!file.hodApproved)
            return res.status(403).json({ message: 'HOD has not approved your access yet.' });
        if (!file.encryptedShareForStaff || !file.hodDhPublicKey)
            return res.status(400).json({ message: 'Key exchange data missing. HOD must re-approve.' });

        await createAuditLog({ user: req.user, action: 'KEY_ACCESS', req, status: 'SUCCESS',
            metadata: { fileId: file._id, type: 'staff_retrieve_encrypted_share' } });

        res.json({
            encryptedShare: file.encryptedShareForStaff,
            hodDhPublicKey: file.hodDhPublicKey
        });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

module.exports = router;
