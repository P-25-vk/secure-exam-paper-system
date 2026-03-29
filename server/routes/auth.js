const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { createAuditLog } = require('../utils/audit');
const { protect, authorize } = require('../middleware/auth');

const JWT_SECRET = process.env.JWT_SECRET || 'changeme_use_strong_secret_in_env';
const generateToken = (id) => jwt.sign({ id }, JWT_SECRET, { expiresIn: '8h' });

const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, max: 10,
    message: { message: 'Too many login attempts. Please try again after 15 minutes.' },
    standardHeaders: true, legacyHeaders: false, skipSuccessfulRequests: true
});

// @route POST /api/auth/login
router.post('/login', loginLimiter, async (req, res) => {
    const { email, password } = req.body;
    try {
        const user = await User.findOne({ email: email?.toLowerCase() });
        if (!user) {
            await createAuditLog({ user: null, action: 'LOGIN_FAILURE', req, status: 'FAILURE', metadata: { email } });
            return res.status(401).json({ message: 'Invalid email or password' });
        }
        if (!user.isActive) {
            await createAuditLog({ user, action: 'LOGIN_FAILURE', req, status: 'FAILURE', metadata: { reason: 'Account deactivated' } });
            return res.status(403).json({ message: 'Your account has been deactivated. Contact the HOD.' });
        }
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            await createAuditLog({ user, action: 'LOGIN_FAILURE', req, status: 'FAILURE', metadata: { email } });
            return res.status(401).json({ message: 'Invalid email or password' });
        }
        user.lastLogin = new Date();
        await user.save();
        await createAuditLog({ user, action: 'LOGIN_SUCCESS', req, status: 'SUCCESS' });

        res.json({
            _id: user._id,
            name: user.name,
            email: user.email,
            role: user.role,
            department: user.department,
            mustChangePassword: user.mustChangePassword,
            token: generateToken(user._id)
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// @route POST /api/auth/change-password
router.post('/change-password', protect, async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) return res.status(400).json({ message: 'Both passwords are required.' });
    if (newPassword.length < 8) return res.status(400).json({ message: 'New password must be at least 8 characters.' });
    const strong = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#^()_+\-=])[A-Za-z\d@$!%*?&#^()_+\-=]{8,}$/;
    if (!strong.test(newPassword)) return res.status(400).json({ message: 'Password must include uppercase, lowercase, a number, and a special character.' });
    try {
        const user = await User.findById(req.user._id);
        const isMatch = await bcrypt.compare(currentPassword, user.password);
        if (!isMatch) return res.status(400).json({ message: 'Current password is incorrect.' });
        if (currentPassword === newPassword) return res.status(400).json({ message: 'New password must differ from the temporary password.' });
        const salt = await bcrypt.genSalt(12);
        user.password = await bcrypt.hash(newPassword, salt);
        user.mustChangePassword = false;
        await user.save();
        res.json({ message: 'Password changed successfully!' });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// @route POST /api/auth/logout
router.post('/logout', protect, async (req, res) => {
    await createAuditLog({ user: req.user, action: 'LOGOUT', req, status: 'SUCCESS' });
    res.json({ message: 'Logged out successfully' });
});

// @route GET /api/auth/users
// Used by Coordinator to pick HOD/Staff when uploading
router.get('/users', protect, authorize('Coordinator', 'HOD'), async (req, res) => {
    try {
        const users = await User.find({ role: { $in: ['HOD', 'Staff'] }, isActive: true })
            .select('name email role department');
        res.json(users);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// @route GET /api/auth/me
router.get('/me', protect, async (req, res) => {
    try {
        const user = await User.findById(req.user._id).select('-password -rsaPublicKey');
        res.json(user);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;
