const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, trim: true, lowercase: true },
    password: { type: String, required: true },
    role: { type: String, enum: ['Coordinator', 'HOD', 'Staff'], required: true },
    department: { type: String, default: 'General' },
    isActive: { type: Boolean, default: true },
    lastLogin: { type: Date, default: null },
    mustChangePassword: { type: Boolean, default: false },

    // RSA public key (HOD only — stored at seed/creation time, used to encrypt AES keys)
    rsaPublicKey: { type: String, default: null }, // PEM format
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
