const crypto = require('crypto');
const secrets = require('secrets.js-grempe');
const path = require('path');
const fs = require('fs');

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // GCM recommended IV length
const RSA_KEY_SIZE = 2048;

// ─── Share Master Key (used to encrypt Shamir shares at rest on disk) ────────
//   Never stored in MongoDB — lives on filesystem or env var only.

const SHARE_MASTER_KEY_PATH = path.join(__dirname, '..', 'keys', 'share_master.key');

function getShareMasterKey() {
    // Priority: env var → file on disk → auto-generate
    if (process.env.SHARE_ENCRYPTION_KEY) {
        return Buffer.from(process.env.SHARE_ENCRYPTION_KEY, 'hex');
    }
    if (fs.existsSync(SHARE_MASTER_KEY_PATH)) {
        return Buffer.from(fs.readFileSync(SHARE_MASTER_KEY_PATH, 'utf8').trim(), 'hex');
    }
    // First run: generate and save
    const key = crypto.randomBytes(32);
    const keysDir = path.dirname(SHARE_MASTER_KEY_PATH);
    if (!fs.existsSync(keysDir)) fs.mkdirSync(keysDir, { recursive: true });
    fs.writeFileSync(SHARE_MASTER_KEY_PATH, key.toString('hex'), 'utf8');
    console.log('🔑 Generated share master key → server/keys/share_master.key');
    return key;
}

// ─── AES-256-GCM Encryption / Decryption ──────────────────────────────────────

/**
 * Encrypt a buffer using AES-256-GCM with a random key.
 * @param {Buffer} buffer - The file data to encrypt.
 * @returns {{ encryptedData: Buffer, iv: string, authTag: string, aesKeyHex: string }}
 */
function encryptFile(buffer) {
    const aesKey = crypto.randomBytes(32);
    const iv = crypto.randomBytes(IV_LENGTH);

    const cipher = crypto.createCipheriv(ALGORITHM, aesKey, iv);
    const encryptedData = Buffer.concat([cipher.update(buffer), cipher.final()]);
    const authTag = cipher.getAuthTag();

    return {
        aesKeyHex: aesKey.toString('hex'),
        iv: iv.toString('hex'),
        authTag: authTag.toString('hex'),
        encryptedData
    };
}

/**
 * Decrypt a buffer using AES-256-GCM.
 */
function decryptFile(encryptedBuffer, aesKeyHex, ivHex, authTagHex) {
    const aesKey = Buffer.from(aesKeyHex, 'hex');
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');

    const decipher = crypto.createDecipheriv(ALGORITHM, aesKey, iv);
    decipher.setAuthTag(authTag);

    return Buffer.concat([decipher.update(encryptedBuffer), decipher.final()]);
}

// ─── RSA Key Management ──────────────────────────────────────────────────────

/**
 * Generate an RSA-2048 key pair (PEM strings).
 */
function generateRSAKeyPair() {
    const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
        modulusLength: RSA_KEY_SIZE,
        publicKeyEncoding: { type: 'spki', format: 'pem' },
        privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
    });
    return { publicKey, privateKey };
}

/**
 * Encrypt data (Buffer or string) with an RSA public key (OAEP + SHA-256).
 */
function rsaEncrypt(data, publicKeyPem) {
    const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data, 'utf8');
    return crypto.publicEncrypt(
        { key: publicKeyPem, padding: crypto.constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256' },
        buffer
    ).toString('base64');
}

/**
 * Decrypt data with an RSA private key (OAEP + SHA-256).
 * @returns {Buffer}
 */
function rsaDecrypt(base64Ciphertext, privateKeyPem) {
    return crypto.privateDecrypt(
        { key: privateKeyPem, padding: crypto.constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256' },
        Buffer.from(base64Ciphertext, 'base64')
    );
}

/**
 * Load HOD private key from the filesystem.
 */
function loadHodPrivateKey() {
    const keyPath = path.join(__dirname, '..', 'keys', 'hod_private.pem');
    if (!fs.existsSync(keyPath)) {
        throw new Error('HOD private key not found. Run seed.js first to generate it.');
    }
    return fs.readFileSync(keyPath, 'utf8');
}

/**
 * Load HOD public key from the filesystem.
 */
function loadHodPublicKey() {
    const keyPath = path.join(__dirname, '..', 'keys', 'hod_public.pem');
    if (!fs.existsSync(keyPath)) {
        throw new Error('HOD public key not found. Run seed.js first.');
    }
    return fs.readFileSync(keyPath, 'utf8');
}

// ─── Shamir's Secret Sharing (2,2) ──────────────────────────────────────────

/**
 * Split an AES key (hex string) into 2 shares using (2,2) Shamir's Secret Sharing.
 * @param {string} aesKeyHex
 * @returns {string[]} Array of 2 share strings
 */
function splitKey(aesKeyHex) {
    return secrets.share(aesKeyHex, 2, 2);
}

/**
 * Reconstruct AES key from shares.
 * @param {string[]} shares
 * @returns {string} AES key in hex
 */
function combineShares(shares) {
    return secrets.combine(shares);
}

// ─── Encrypted Share File I/O (shares encrypted at rest on filesystem) ──────

/**
 * Encrypt a Shamir share with the server master key and save to filepath.
 * Format on disk: IV(12 bytes) || authTag(16 bytes) || ciphertext
 */
function encryptShareToFile(shareHex, destPath) {
    const masterKey = getShareMasterKey();
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, masterKey, iv);
    const encrypted = Buffer.concat([cipher.update(shareHex, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();

    // Write: iv || authTag || ciphertext
    const out = Buffer.concat([iv, authTag, encrypted]);
    fs.writeFileSync(destPath, out);
    return destPath;
}

/**
 * Read an encrypted share file and decrypt it back to hex string.
 */
function decryptShareFromFile(filePath) {
    if (!fs.existsSync(filePath)) {
        throw new Error('Share file not found: ' + filePath);
    }
    const masterKey = getShareMasterKey();
    const data = fs.readFileSync(filePath);

    const iv = data.slice(0, IV_LENGTH);
    const authTag = data.slice(IV_LENGTH, IV_LENGTH + 16);
    const ciphertext = data.slice(IV_LENGTH + 16);

    const decipher = crypto.createDecipheriv(ALGORITHM, masterKey, iv);
    decipher.setAuthTag(authTag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
}

// ─── ECDH Key Exchange ──────────────────────────────────────────────────────
//   Used for secure share transfer between HOD and Staff during approval.

/**
 * Generate an ECDH key pair on curve P-256.
 * Returns { publicKey: hex, privateKey: hex }
 */
function generateECDHKeyPair() {
    const ecdh = crypto.createECDH('prime256v1');
    ecdh.generateKeys();
    return {
        publicKey: ecdh.getPublicKey('hex'),
        privateKey: ecdh.getPrivateKey('hex')
    };
}

/**
 * Compute shared secret from my ECDH private key and their public key.
 * Returns a 32-byte key derived via SHA-256 (suitable for AES-256).
 */
function computeECDHSharedSecret(myPrivateKeyHex, theirPublicKeyHex) {
    const ecdh = crypto.createECDH('prime256v1');
    ecdh.setPrivateKey(myPrivateKeyHex, 'hex');
    const rawSecret = ecdh.computeSecret(theirPublicKeyHex, 'hex');
    // Derive a proper 32-byte AES key from the raw shared secret
    return crypto.createHash('sha256').update(rawSecret).digest();
}

/**
 * Encrypt data with a shared secret (AES-256-GCM).
 * Returns hex string: iv(24 hex) + authTag(32 hex) + ciphertext(hex)
 */
function encryptWithSharedSecret(plaintext, sharedSecretBuffer) {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, sharedSecretBuffer, iv);
    const encrypted = Buffer.concat([
        cipher.update(plaintext, 'utf8'),
        cipher.final()
    ]);
    const authTag = cipher.getAuthTag();
    return iv.toString('hex') + authTag.toString('hex') + encrypted.toString('hex');
}

/**
 * Decrypt data encrypted with encryptWithSharedSecret.
 * Input: hex string from encryptWithSharedSecret
 * Returns plaintext string.
 */
function decryptWithSharedSecret(hexPayload, sharedSecretBuffer) {
    const iv = Buffer.from(hexPayload.slice(0, 24), 'hex');        // 12 bytes = 24 hex
    const authTag = Buffer.from(hexPayload.slice(24, 56), 'hex');  // 16 bytes = 32 hex
    const ciphertext = Buffer.from(hexPayload.slice(56), 'hex');

    const decipher = crypto.createDecipheriv(ALGORITHM, sharedSecretBuffer, iv);
    decipher.setAuthTag(authTag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
}

// ─── Visual Cryptography (2,2) Scheme ───────────────────────────────────────
//
// Each pixel is expanded into a 2×2 subpixel block.
// For a BLACK pixel:  shares get complementary patterns (one has pattern A, other has pattern B)
// For a WHITE pixel:  shares get identical patterns
// When shares are overlaid (OR operation), black pixels become fully black, white pixels stay half-black.
//

/**
 * Convert image buffer to raw grayscale pixel data (width × height).
 * Returns { width, height, pixels: Uint8Array } where pixels[i] = 0 (black) or 255 (white)
 */
function imageToBlackWhite(imageBuffer) {
    const Jimp = require('jimp');

    return Jimp.read(imageBuffer).then(image => {
        const width = image.bitmap.width;
        const height = image.bitmap.height;
        const pixels = new Uint8Array(width * height);

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const idx = (y * width + x);
                const color = Jimp.intToRGBA(image.getPixelColor(x, y));
                // Convert to grayscale, threshold at 128
                const gray = 0.299 * color.r + 0.587 * color.g + 0.114 * color.b;
                pixels[idx] = gray < 128 ? 0 : 255; // 0=black, 255=white
            }
        }

        return { width, height, pixels };
    });
}

/**
 * Create two visual cryptography shares from a B&W image.
 * Each pixel becomes a 2×2 block. Output images are 2x the width and 2x the height.
 *
 * Returns { share1: Buffer (PNG), share2: Buffer (PNG), origWidth, origHeight }
 */
async function createVisualShares(imageBuffer) {
    const Jimp = require('jimp');

    const { width, height, pixels } = await imageToBlackWhite(imageBuffer);

    const newW = width * 2;
    const newH = height * 2;

    const share1Img = new Jimp(newW, newH, 0xFFFFFFFF); // white
    const share2Img = new Jimp(newW, newH, 0xFFFFFFFF);

    // 2×2 subpixel patterns (two complementary pairs)
    const patternsA = [
        [[0, 255], [255, 0]], // diagonal \
        [[255, 0], [0, 255]], // diagonal /
    ];
    const patternsB = [
        [[255, 0], [0, 255]], // diagonal / (complement of A[0])
        [[0, 255], [255, 0]], // diagonal \ (complement of A[1])
    ];

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const isBlack = pixels[y * width + x] === 0;
            const patIdx = Math.random() < 0.5 ? 0 : 1;
            const s1Pattern = patternsA[patIdx];

            let s2Pattern;
            if (isBlack) {
                // Complementary pattern → overlay = all black
                s2Pattern = patternsB[patIdx];
            } else {
                // Same pattern → overlay = half black (appears white/gray)
                s2Pattern = patternsA[patIdx];
            }

            // Write 2×2 block
            for (let dy = 0; dy < 2; dy++) {
                for (let dx = 0; dx < 2; dx++) {
                    const px = x * 2 + dx;
                    const py = y * 2 + dy;
                    const c1 = s1Pattern[dy][dx] === 0 ? 0x000000FF : 0xFFFFFFFF;
                    const c2 = s2Pattern[dy][dx] === 0 ? 0x000000FF : 0xFFFFFFFF;
                    share1Img.setPixelColor(c1, px, py);
                    share2Img.setPixelColor(c2, px, py);
                }
            }
        }
    }

    const share1Buffer = await share1Img.getBufferAsync(Jimp.MIME_PNG);
    const share2Buffer = await share2Img.getBufferAsync(Jimp.MIME_PNG);

    return { share1: share1Buffer, share2: share2Buffer, origWidth: width, origHeight: height };
}

/**
 * Combine two visual shares by OR-ing them (overlay).
 * Returns a PNG buffer of the reconstructed image.
 */
async function combineVisualShares(share1Buffer, share2Buffer) {
    const Jimp = require('jimp');

    const img1 = await Jimp.read(share1Buffer);
    const img2 = await Jimp.read(share2Buffer);

    const w = Math.min(img1.bitmap.width, img2.bitmap.width);
    const h = Math.min(img1.bitmap.height, img2.bitmap.height);
    const result = new Jimp(w, h, 0xFFFFFFFF);

    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            const c1 = Jimp.intToRGBA(img1.getPixelColor(x, y));
            const c2 = Jimp.intToRGBA(img2.getPixelColor(x, y));

            // OR operation: if either pixel is black, result is black
            const r = Math.min(c1.r, c2.r);
            const g = Math.min(c1.g, c2.g);
            const b = Math.min(c1.b, c2.b);

            result.setPixelColor(Jimp.rgbaToInt(r, g, b, 255), x, y);
        }
    }

    return result.getBufferAsync(Jimp.MIME_PNG);
}

module.exports = {
    encryptFile,
    decryptFile,
    generateRSAKeyPair,
    rsaEncrypt,
    rsaDecrypt,
    loadHodPrivateKey,
    loadHodPublicKey,
    splitKey,
    combineShares,
    createVisualShares,
    combineVisualShares,
    // New: encrypted share file I/O
    encryptShareToFile,
    decryptShareFromFile,
    // New: ECDH key exchange
    generateECDHKeyPair,
    computeECDHSharedSecret,
    encryptWithSharedSecret,
    decryptWithSharedSecret,
};
