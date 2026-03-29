const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
    },
    userName: { type: String, default: 'Unknown' },
    userRole: { type: String, default: 'Unknown' },
    action: {
        type: String,
        enum: [
            'LOGIN_SUCCESS', 'LOGIN_FAILURE', 'LOGOUT',
            'PAPER_UPLOAD', 'KEY_ACCESS', 'DECRYPT_ATTEMPT',
            'DECRYPT_SUCCESS', 'DECRYPT_FAILURE',
            'USER_CREATED', 'USER_UPDATED', 'USER_DELETED',
            'USER_DEACTIVATED', 'USER_ACTIVATED'
        ],
        required: true
    },
    resourceId: {
        type: mongoose.Schema.Types.ObjectId,
        default: null
    },
    resourceName: { type: String, default: '' },
    ipAddress: { type: String, default: '' },
    userAgent: { type: String, default: '' },
    status: {
        type: String,
        enum: ['SUCCESS', 'FAILURE', 'WARNING', 'ATTEMPT'],
        default: 'SUCCESS'
    },
    metadata: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    }
}, { timestamps: true });

// Index for fast querying
auditLogSchema.index({ createdAt: -1 });
auditLogSchema.index({ userId: 1, createdAt: -1 });
auditLogSchema.index({ action: 1, createdAt: -1 });

module.exports = mongoose.model('AuditLog', auditLogSchema);
