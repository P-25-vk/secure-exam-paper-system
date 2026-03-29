const AuditLog = require('../models/AuditLog');

/**
 * Creates an audit log entry.
 * @param {Object} options
 * @param {Object|null} options.user - Mongoose user doc or null (for failed logins)
 * @param {string} options.action - The action enum string
 * @param {Object} options.req - Express request (for ip/ua)
 * @param {string|null} options.resourceId - Optional resource ObjectId
 * @param {string} options.resourceName - Optional human-readable resource name
 * @param {string} options.status - 'SUCCESS' | 'FAILURE' | 'WARNING'
 * @param {Object} options.metadata - Extra context
 */
async function createAuditLog({ user = null, action, req, resourceId = null, resourceName = '', status = 'SUCCESS', metadata = {} }) {
    try {
        await AuditLog.create({
            userId: user ? user._id : null,
            userName: user ? user.name : 'Unknown',
            userRole: user ? user.role : 'Unknown',
            action,
            resourceId,
            resourceName,
            ipAddress: req?.ip || req?.connection?.remoteAddress || '',
            userAgent: req?.headers?.['user-agent'] || '',
            status,
            metadata
        });
    } catch (err) {
        // Audit logging should never break the main flow
        console.error('[AUDIT] Failed to write audit log:', err.message);
    }
}

module.exports = { createAuditLog };
