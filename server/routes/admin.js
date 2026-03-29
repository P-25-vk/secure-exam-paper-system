const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const AuditLog = require('../models/AuditLog');
const { protect, authorize } = require('../middleware/auth');
const { createAuditLog } = require('../utils/audit');

// All admin routes require HOD role
router.use(protect, authorize('HOD'));

// ─── USER MANAGEMENT ────────────────────────────────────────────────────────

// @route GET /api/admin/users
// @desc Get all users
router.get('/users', async (req, res) => {
    try {
        const users = await User.find().select('-password -rsaPublicKey').sort({ createdAt: -1 });
        res.json(users);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// @route POST /api/admin/users
// @desc Create a new user (any role)
router.post('/users', async (req, res) => {
    const { name, email, password, role, department } = req.body;
    try {
        if (!name || !email || !password || !role) {
            return res.status(400).json({ message: 'Please provide name, email, password, and role.' });
        }

        if (!['Coordinator', 'HOD', 'Staff'].includes(role)) {
            return res.status(400).json({ message: 'Invalid role. Must be Coordinator, HOD, or Staff.' });
        }

        const exists = await User.findOne({ email: email.toLowerCase() });
        if (exists) {
            return res.status(400).json({ message: 'A user with this email already exists.' });
        }

        const salt = await bcrypt.genSalt(12);
        const hashedPassword = await bcrypt.hash(password, salt);

        const newUser = await User.create({
            name,
            email: email.toLowerCase(),
            password: hashedPassword,
            role,
            department: department || 'General',
            isActive: true,
            mustChangePassword: true
        });

        await createAuditLog({
            user: req.user,
            action: 'USER_CREATED',
            req,
            resourceId: newUser._id,
            resourceName: newUser.email,
            status: 'SUCCESS',
            metadata: { role, department }
        });

        res.status(201).json({
            _id: newUser._id,
            name: newUser.name,
            email: newUser.email,
            role: newUser.role,
            department: newUser.department,
            isActive: newUser.isActive,
            createdAt: newUser.createdAt
        });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// @route PATCH /api/admin/users/:id/toggle
// @desc Toggle user active status (activate/deactivate)
router.patch('/users/:id/toggle', async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).json({ message: 'User not found' });

        if (user._id.toString() === req.user._id.toString()) {
            return res.status(400).json({ message: 'You cannot deactivate your own account.' });
        }

        user.isActive = !user.isActive;
        await user.save();

        await createAuditLog({
            user: req.user,
            action: user.isActive ? 'USER_ACTIVATED' : 'USER_DEACTIVATED',
            req,
            resourceId: user._id,
            resourceName: user.email,
            status: 'SUCCESS'
        });

        res.json({ message: `User ${user.isActive ? 'activated' : 'deactivated'} successfully.`, isActive: user.isActive });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// @route DELETE /api/admin/users/:id
// @desc Delete a user permanently
router.delete('/users/:id', async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).json({ message: 'User not found' });

        if (user._id.toString() === req.user._id.toString()) {
            return res.status(400).json({ message: 'You cannot delete your own account.' });
        }

        await createAuditLog({
            user: req.user,
            action: 'USER_DELETED',
            req,
            resourceId: user._id,
            resourceName: user.email,
            status: 'SUCCESS',
            metadata: { deletedRole: user.role }
        });

        await User.findByIdAndDelete(req.params.id);
        res.json({ message: 'User deleted successfully.' });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// ─── AUDIT LOGS ─────────────────────────────────────────────────────────────

// @route GET /api/admin/audit-logs
// @desc Get paginated audit logs with optional filters
router.get('/audit-logs', async (req, res) => {
    try {
        const { page = 1, limit = 25, action, userId, status } = req.query;
        const query = {};

        if (action) query.action = action;
        if (userId) query.userId = userId;
        if (status) query.status = status;

        const skip = (parseInt(page) - 1) * parseInt(limit);
        const total = await AuditLog.countDocuments(query);
        const logs = await AuditLog.find(query)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit))
            .populate('userId', 'name email role');

        res.json({
            logs,
            total,
            page: parseInt(page),
            pages: Math.ceil(total / parseInt(limit))
        });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// ─── STATS ──────────────────────────────────────────────────────────────────

// @route GET /api/admin/stats
// @desc Dashboard stats for HOD
router.get('/stats', async (req, res) => {
    try {
        const FileModel = require('../models/File');
        const [totalUsers, totalPapers, totalLogs, recentLogs] = await Promise.all([
            User.countDocuments({ isActive: true }),
            FileModel.countDocuments(),
            AuditLog.countDocuments(),
            AuditLog.find().sort({ createdAt: -1 }).limit(5).lean()
        ]);

        const usersByRole = await User.aggregate([
            { $group: { _id: '$role', count: { $sum: 1 } } }
        ]);

        const actionCounts = await AuditLog.aggregate([
            { $group: { _id: '$action', count: { $sum: 1 } } }
        ]);

        res.json({ totalUsers, totalPapers, totalLogs, recentLogs, usersByRole, actionCounts });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

module.exports = router;
