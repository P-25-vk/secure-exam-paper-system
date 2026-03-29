const mongoose = require('mongoose');

const fileSchema = new mongoose.Schema({
    // Paper metadata
    title:   { type: String, required: true, trim: true },
    subject: { type: String, default: '' },
    examTime: { type: Date, required: true },

    // Time-based access control: decryption denied before this time
    allowedDecryptionTime: { type: Date, required: true },

    // Who uploaded it
    setterId:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    setterName: { type: String, required: true },

    // Upload type: 'pdf' for single PDF, 'images' for up to 4 images
    uploadType: { type: String, enum: ['pdf', 'images'], required: true },
    originalName: { type: String, required: true },
    mimeType:     { type: String, required: true },

    // For images: metadata for each uploaded image
    imageMeta: [{
        originalName: String,
        mimeType: String,
        size: Number,
    }],

    // Decryption mode
    mode: { type: String, enum: ['individual', 'multi'], required: true },

    // ── AES-256-GCM encryption metadata (small — stored in DB) ────────────
    iv:      { type: String, default: null },  // hex GCM IV (12 bytes)
    authTag: { type: String, default: null },  // hex GCM auth tag

    // ── Key Management (Hybrid: Shamir + RSA) ─────────────────────────────
    encryptedAesKey: { type: String, default: null }, // base64 RSA ciphertext

    // ── Shamir Shares — ENCRYPTED on filesystem, paths stored here ────────
    //    Raw shares are NEVER stored in MongoDB.
    share1Path: { type: String, default: null },  // path to AES-encrypted HOD share file
    share2Path: { type: String, default: null },  // path to AES-encrypted Staff share file

    // ── Filesystem paths (large blobs stored on disk, NOT in MongoDB) ─────
    encryptedFilePath: { type: String, default: null },   // path to AES-encrypted file
    imageSharePaths1:  [{ type: String }],                // paths to visual crypto HOD shares
    imageSharePaths2:  [{ type: String }],                // paths to visual crypto Staff shares

    // ── HOD assignment ────────────────────────────────────────────────────
    hodId:   { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    hodName: { type: String },

    // ── Staff assignment (mode: 'multi' only) ─────────────────────────────
    staffId:   { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    staffName: { type: String },

    // ── Staff Access Request & HOD Approval Gate (mode: 'multi') ──────────
    staffAccessRequested:   { type: Boolean, default: false },
    staffAccessRequestTime: { type: Date, default: null },
    hodApproved:            { type: Boolean, default: false },
    hodApprovalTime:        { type: Date, default: null },

    // ── ECDH Key Exchange (for secure share transfer) ─────────────────────
    staffDhPublicKey:     { type: String, default: null },  // Staff's ECDH public key hex
    hodDhPublicKey:       { type: String, default: null },  // HOD's ECDH public key hex
    encryptedShareForStaff: { type: String, default: null }, // HOD share encrypted with DH shared secret
    keyExchangeCompleted: { type: Boolean, default: false },

}, { timestamps: true });

module.exports = mongoose.model('File', fileSchema);
