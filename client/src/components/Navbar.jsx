import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, LogOut, Upload, LayoutDashboard, Settings, Menu, X, GraduationCap, BookOpen, Users } from 'lucide-react';

const ROLE_META = {
    Coordinator: { label: 'Question Setter', color: 'from-violet-500 to-purple-600', icon: BookOpen, home: '/coordinator' },
    HOD: { label: 'HOD', color: 'from-amber-500 to-orange-600', icon: GraduationCap, home: '/hod' },
    Staff: { label: 'Staff', color: 'from-cyan-500 to-blue-600', icon: Users, home: '/staff' },
};

export default function Navbar() {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const [mobileOpen, setMobileOpen] = useState(false);

    const meta = ROLE_META[user?.role] || ROLE_META.Staff;
    const RoleIcon = meta.icon;

    const handleLogout = async () => {
        await logout();
        navigate('/login');
    };

    const NavLink = ({ to, icon: Icon, label }) => {
        const active = location.pathname === to;
        return (
            <Link to={to} onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-all ${active ? 'bg-slate-700 text-slate-100' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'}`}>
                <Icon size={16} />{label}
            </Link>
        );
    };

    const navLinks = [
        { to: meta.home, icon: LayoutDashboard, label: 'Dashboard' },
        ...(user?.role === 'Coordinator' ? [{ to: '/upload', icon: Upload, label: 'Upload Paper' }] : []),
        ...(user?.role === 'HOD' ? [{ to: '/admin', icon: Settings, label: 'Admin Panel' }] : []),
    ];

    return (
        <nav className="sticky top-0 z-40 bg-slate-950/90 backdrop-blur-xl border-b border-slate-800/80">
            <div className="container mx-auto px-4">
                <div className="flex items-center justify-between h-16">
                    {/* Brand */}
                    <Link to={meta.home} className="flex items-center gap-2.5">
                        <div className={`p-1.5 rounded-xl bg-gradient-to-br ${meta.color}`}>
                            <Shield size={18} className="text-white" />
                        </div>
                        <span className="font-bold text-slate-100 hidden sm:block">SecureExam</span>
                    </Link>

                    {/* Desktop nav */}
                    <div className="hidden md:flex items-center gap-1">
                        {navLinks.map(l => <NavLink key={l.to} {...l} />)}
                    </div>

                    {/* User & logout */}
                    <div className="flex items-center gap-3">
                        <div className="hidden sm:flex items-center gap-2.5 bg-slate-900/60 border border-slate-700/50 rounded-xl px-3 py-2">
                            <div className={`p-1 rounded-lg bg-gradient-to-br ${meta.color}`}>
                                <RoleIcon size={12} className="text-white" />
                            </div>
                            <div className="text-right">
                                <p className="text-xs font-semibold text-slate-200 leading-tight">{user?.name}</p>
                                <p className="text-[10px] text-slate-500 leading-tight">{meta.label}</p>
                            </div>
                        </div>

                        <button onClick={handleLogout}
                            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-all font-medium">
                            <LogOut size={16} /><span className="hidden sm:block">Logout</span>
                        </button>

                        {/* Mobile menu toggle */}
                        <button onClick={() => setMobileOpen(!mobileOpen)} className="md:hidden p-2 rounded-xl text-slate-400 hover:bg-slate-800">
                            {mobileOpen ? <X size={20} /> : <Menu size={20} />}
                        </button>
                    </div>
                </div>
            </div>

            {/* Mobile menu */}
            <AnimatePresence>
                {mobileOpen && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                        className="md:hidden border-t border-slate-800 bg-slate-950/95 backdrop-blur-xl px-4 pb-4 pt-2">
                        {navLinks.map(l => <NavLink key={l.to} {...l} />)}
                    </motion.div>
                )}
            </AnimatePresence>
        </nav>
    );
}
