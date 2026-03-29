import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldCheck, Eye, EyeOff, Lock, CheckCircle, AlertCircle, KeyRound } from 'lucide-react';

const API = 'http://localhost:5000/api';

const REQUIREMENTS = [
    { label: 'At least 8 characters', test: (p) => p.length >= 8 },
    { label: 'Uppercase letter (A–Z)', test: (p) => /[A-Z]/.test(p) },
    { label: 'Lowercase letter (a–z)', test: (p) => /[a-z]/.test(p) },
    { label: 'Number (0–9)', test: (p) => /\d/.test(p) },
    { label: 'Special character (@$!%*?&#…)', test: (p) => /[@$!%*?&#^()_+\-=]/.test(p) },
    { label: 'Different from your temporary password', test: (p, cur) => p !== cur && p.length > 0 },
];

export default function ChangePasswordPage() {
    const { user, getToken, clearMustChangePassword } = useAuth();
    const navigate = useNavigate();
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showCurrent, setShowCurrent] = useState(false);
    const [showNew, setShowNew] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);

    const requirements = REQUIREMENTS.map(r => ({ ...r, met: r.test(newPassword, currentPassword) }));
    const allMet = requirements.every(r => r.met);
    const passwordsMatch = newPassword === confirmPassword && confirmPassword.length > 0;

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!allMet) { setError('Please meet all password requirements.'); return; }
        if (!passwordsMatch) { setError('New passwords do not match.'); return; }

        setLoading(true);
        setError('');
        try {
            await axios.post(`${API}/auth/change-password`,
                { currentPassword, newPassword },
                { headers: { Authorization: `Bearer ${getToken()}` } }
            );

            setSuccess(true);
            // Update in-memory user state — clears mustChangePassword flag instantly
            clearMustChangePassword();

            // Redirect to dashboard after a moment
            setTimeout(() => {
                const role = user?.role;
                if (role === 'Coordinator') navigate('/coordinator');
                else if (role === 'HOD') navigate('/hod');
                else navigate('/staff');
            }, 2000);
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to change password.');
        } finally {
            setLoading(false);
        }
    };

    if (success) {
        return (
            <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
                <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                    className="text-center">
                    <div className="w-20 h-20 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                        <CheckCircle size={40} className="text-emerald-400" />
                    </div>
                    <h2 className="text-2xl font-bold text-slate-100">Password Updated!</h2>
                    <p className="text-slate-400 mt-2">Redirecting you to your dashboard...</p>
                </motion.div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
            {/* Background glow */}
            <div className="fixed inset-0 pointer-events-none overflow-hidden">
                <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-amber-500/5 rounded-full blur-3xl" />
            </div>

            <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md relative">
                {/* Header */}
                <div className="text-center mb-6">
                    <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 shadow-lg shadow-amber-500/30 mb-4">
                        <ShieldCheck size={28} className="text-white" />
                    </div>
                    <h1 className="text-2xl font-bold text-slate-100">Set Your Password</h1>
                    <p className="text-slate-400 text-sm mt-2">
                        Welcome, <span className="text-amber-400 font-semibold">{user?.name}</span>! Your account was created by the HOD.
                        You must set a new secure password before you can continue.
                    </p>
                </div>

                {/* Mandatory notice */}
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 mb-5 flex items-start gap-3">
                    <KeyRound size={16} className="text-amber-400 mt-0.5 flex-shrink-0" />
                    <p className="text-xs text-amber-300">
                        This step is <strong>mandatory</strong> for security. Enter the temporary password shared by your HOD, then choose your own private password.
                    </p>
                </div>

                <div className="bg-slate-900/80 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-6 shadow-2xl">
                    <form onSubmit={handleSubmit} className="space-y-4">
                        {/* Current / Temp password */}
                        <div>
                            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-widest mb-1.5">
                                Temporary Password (given by HOD)
                            </label>
                            <div className="relative">
                                <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                                <input type={showCurrent ? 'text' : 'password'} value={currentPassword}
                                    onChange={e => setCurrentPassword(e.target.value)}
                                    placeholder="Enter the password HOD gave you"
                                    className="w-full bg-slate-800/80 border border-slate-700 rounded-xl py-3 pl-10 pr-12 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/30 transition-all" required />
                                <button type="button" onClick={() => setShowCurrent(!showCurrent)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
                                    {showCurrent ? <EyeOff size={15} /> : <Eye size={15} />}
                                </button>
                            </div>
                        </div>

                        {/* New password */}
                        <div>
                            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-widest mb-1.5">
                                Your New Password
                            </label>
                            <div className="relative">
                                <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                                <input type={showNew ? 'text' : 'password'} value={newPassword}
                                    onChange={e => setNewPassword(e.target.value)}
                                    placeholder="Choose a strong password"
                                    className="w-full bg-slate-800/80 border border-slate-700 rounded-xl py-3 pl-10 pr-12 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/30 transition-all" required />
                                <button type="button" onClick={() => setShowNew(!showNew)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
                                    {showNew ? <EyeOff size={15} /> : <Eye size={15} />}
                                </button>
                            </div>

                            {/* Requirements checklist */}
                            {newPassword.length > 0 && (
                                <ul className="mt-2 space-y-1">
                                    {requirements.map((r, i) => (
                                        <li key={i} className={`flex items-center gap-2 text-xs transition-colors ${r.met ? 'text-emerald-400' : 'text-slate-500'}`}>
                                            <CheckCircle size={11} className={r.met ? 'text-emerald-400' : 'text-slate-700'} />
                                            {r.label}
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>

                        {/* Confirm password */}
                        <div>
                            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-widest mb-1.5">
                                Confirm New Password
                            </label>
                            <input type="password" value={confirmPassword}
                                onChange={e => setConfirmPassword(e.target.value)}
                                placeholder="Repeat your new password"
                                className={`w-full bg-slate-800/80 border rounded-xl py-3 px-4 text-sm text-slate-100 placeholder-slate-500 focus:outline-none transition-all ${
                                    confirmPassword.length > 0
                                        ? passwordsMatch ? 'border-emerald-500 focus:ring-1 focus:ring-emerald-500/30' : 'border-red-500/50 focus:ring-1 focus:ring-red-500/20'
                                        : 'border-slate-700 focus:border-amber-500 focus:ring-1 focus:ring-amber-500/30'
                                }`} required />
                            {confirmPassword.length > 0 && (
                                <p className={`text-xs mt-1 flex items-center gap-1 ${passwordsMatch ? 'text-emerald-400' : 'text-red-400'}`}>
                                    <CheckCircle size={11} /> {passwordsMatch ? 'Passwords match' : 'Passwords do not match'}
                                </p>
                            )}
                        </div>

                        <AnimatePresence>
                            {error && (
                                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                                    className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm p-3 rounded-xl flex items-center gap-2">
                                    <AlertCircle size={15} /> {error}
                                </motion.div>
                            )}
                        </AnimatePresence>

                        <motion.button type="submit" disabled={loading || !allMet || !passwordsMatch}
                            whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}
                            className={`w-full py-3 rounded-xl font-semibold text-sm transition-all ${
                                allMet && passwordsMatch
                                    ? 'bg-gradient-to-r from-amber-500 to-orange-600 text-white shadow-lg shadow-amber-500/20 hover:from-amber-400 hover:to-orange-500'
                                    : 'bg-slate-800 text-slate-600 cursor-not-allowed'
                            } ${loading ? 'opacity-60' : ''}`}>
                            {loading ? (
                                <span className="flex items-center justify-center gap-2">
                                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    Updating Password...
                                </span>
                            ) : 'Set New Password & Continue'}
                        </motion.button>
                    </form>
                </div>
            </motion.div>
        </div>
    );
}
