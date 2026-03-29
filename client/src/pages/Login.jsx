import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, Eye, EyeOff, Lock, User, BookOpen, GraduationCap, Users } from 'lucide-react';

const ROLES = [
    {
        id: 'coordinator',
        label: 'Question Setter',
        icon: BookOpen,
        color: 'from-violet-600 to-purple-700',
        glow: 'shadow-violet-500/30',
        email: 'setter@exam.edu',
        password: 'Setter@2024!',
        hint: 'Sets exam papers & assigns keys'
    },
    {
        id: 'hod',
        label: 'HOD / Admin',
        icon: GraduationCap,
        color: 'from-amber-500 to-orange-600',
        glow: 'shadow-amber-500/30',
        email: 'hod@exam.edu',
        password: 'Hod@2024!',
        hint: 'Manages system & holds HOD key'
    },
    {
        id: 'staff',
        label: 'Staff',
        icon: Users,
        color: 'from-cyan-500 to-blue-600',
        glow: 'shadow-cyan-500/30',
        email: 'staff1@exam.edu',
        password: 'Staff@2024!',
        hint: 'Views assigned papers & holds staff key'
    }
];

export default function Login() {
    const { login } = useAuth();
    const navigate = useNavigate();
    const [selectedRole, setSelectedRole] = useState(null);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const selectRole = (role) => {
        setSelectedRole(role);
        setEmail(role.email);
        setPassword(role.password);
        setError('');
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!email || !password) {
            setError('Please enter email and password.');
            return;
        }
        setLoading(true);
        setError('');
        const result = await login(email.trim(), password);
        setLoading(false);

        if (result.success) {
            navigate('/');
        } else {
            setError(result.message);
        }
    };

    return (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
            {/* Background ambient effect */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none">
                <div className="absolute -top-40 -left-40 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl" />
                <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl" />
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-cyan-500/5 rounded-full blur-3xl" />
            </div>

            <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                className="relative w-full max-w-lg"
            >
                {/* Header */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg shadow-indigo-500/30 mb-4">
                        <Shield size={32} className="text-white" />
                    </div>
                    <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-400 via-purple-400 to-cyan-400 bg-clip-text text-transparent">
                        SecureExam Portal
                    </h1>
                    <p className="text-slate-400 mt-2 text-sm">
                        Cryptographic Question Paper Protection System
                    </p>
                </div>

                {/* Role Selector */}
                <div className="bg-slate-900/80 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-6 shadow-2xl">
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">Select Your Role</p>
                    <div className="grid grid-cols-3 gap-3 mb-6">
                        {ROLES.map((role) => {
                            const Icon = role.icon;
                            const active = selectedRole?.id === role.id;
                            return (
                                <button
                                    key={role.id}
                                    type="button"
                                    onClick={() => selectRole(role)}
                                    className={`relative p-3 rounded-xl border transition-all duration-200 text-left group ${
                                        active
                                            ? `border-transparent bg-gradient-to-br ${role.color} shadow-lg ${role.glow}`
                                            : 'border-slate-700 bg-slate-800/60 hover:border-slate-500 hover:bg-slate-800'
                                    }`}
                                >
                                    <Icon size={20} className={`mb-1 ${active ? 'text-white' : 'text-slate-400 group-hover:text-slate-200'}`} />
                                    <p className={`text-xs font-semibold leading-tight ${active ? 'text-white' : 'text-slate-300'}`}>{role.label}</p>
                                    <p className={`text-[10px] mt-0.5 leading-tight ${active ? 'text-white/80' : 'text-slate-500'}`}>{role.hint}</p>
                                </button>
                            );
                        })}
                    </div>

                    {/* Login Form */}
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-widest mb-1.5">Email Address</label>
                            <div className="relative">
                                <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="Enter your email"
                                    className="w-full bg-slate-800/80 border border-slate-700 rounded-xl py-3 pl-10 pr-4 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50 transition-all"
                                    required
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-widest mb-1.5">Password</label>
                            <div className="relative">
                                <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="Enter your password"
                                    className="w-full bg-slate-800/80 border border-slate-700 rounded-xl py-3 pl-10 pr-12 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50 transition-all"
                                    required
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                                >
                                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                </button>
                            </div>
                        </div>

                        <AnimatePresence>
                            {error && (
                                <motion.div
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                    exit={{ opacity: 0, height: 0 }}
                                    className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm p-3 rounded-xl"
                                >
                                    {error}
                                </motion.div>
                            )}
                        </AnimatePresence>

                        <motion.button
                            type="submit"
                            disabled={loading}
                            whileHover={{ scale: 1.01 }}
                            whileTap={{ scale: 0.99 }}
                            className={`w-full py-3 rounded-xl font-semibold text-sm transition-all duration-200 ${
                                selectedRole
                                    ? `bg-gradient-to-r ${selectedRole.color} shadow-lg ${selectedRole.glow} text-white hover:opacity-90`
                                    : 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white hover:from-indigo-500 hover:to-purple-500 shadow-lg shadow-indigo-500/25'
                            } ${loading ? 'opacity-60 cursor-not-allowed' : ''}`}
                        >
                            {loading ? (
                                <span className="flex items-center justify-center gap-2">
                                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    Authenticating...
                                </span>
                            ) : (
                                'Sign In Securely'
                            )}
                        </motion.button>
                    </form>

                    <div className="mt-5 pt-4 border-t border-slate-800 flex items-center justify-center gap-2 text-xs text-slate-500">
                        <Shield size={12} />
                        AES-256-GCM · Shamir Secret Sharing · Audit Logged
                    </div>
                </div>
            </motion.div>
        </div>
    );
}
