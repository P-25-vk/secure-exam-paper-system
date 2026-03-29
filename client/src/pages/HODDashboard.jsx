import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import { format, isPast, formatDistanceToNow } from 'date-fns';
import { FileText, Lock, Clock, ShieldCheck, Settings, AlertCircle, CheckCircle, Bell, Timer, KeyRound } from 'lucide-react';

const API = 'http://localhost:5000/api';

export default function HODDashboard() {
    const { user, getToken } = useAuth();
    const navigate = useNavigate();
    const [files, setFiles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [approving, setApproving] = useState({});
    const [toast, setToast] = useState('');

    const headers = { Authorization: `Bearer ${getToken()}` };

    useEffect(() => { fetchFiles(); }, []);

    const fetchFiles = async () => {
        try {
            const res = await axios.get(`${API}/files`, { headers });
            setFiles(res.data);
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    };

    const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 3500); };

    const handleApprove = async (fileId) => {
        setApproving(p => ({ ...p, [fileId]: true }));
        try {
            const res = await axios.post(`${API}/files/${fileId}/approve`, {}, { headers });
            showToast('✅ ' + res.data.message);
            fetchFiles();
        } catch (e) { showToast('❌ ' + (e.response?.data?.message || 'Approval failed')); }
        finally { setApproving(p => ({ ...p, [fileId]: false })); }
    };

    const pendingApprovals = files.filter(f => f.mode === 'multi' && f.staffAccessRequested && !f.hodApproved);
    const unlocked = (f) => isPast(new Date(f.allowedDecryptionTime || f.examTime));

    return (
        <div className="max-w-5xl mx-auto space-y-6">
            {/* Toast */}
            <AnimatePresence>
                {toast && (
                    <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
                        className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-slate-800 border border-slate-700 text-slate-200 px-5 py-3 rounded-xl shadow-xl text-sm">
                        {toast}
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-100">HOD Dashboard</h1>
                    <p className="text-slate-400 text-sm">{user?.name} · {user?.department}</p>
                </div>
                <button onClick={() => navigate('/admin')}
                    className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 hover:bg-amber-500/20 text-amber-400 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all">
                    <Settings size={15} /> Admin Panel
                </button>
            </div>

            {/* Pending Approvals Alert */}
            {pendingApprovals.length > 0 && (
                <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
                    className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-5">
                    <div className="flex items-center gap-3 mb-4">
                        <Bell size={18} className="text-amber-400" />
                        <p className="text-amber-300 font-semibold">{pendingApprovals.length} Pending Staff Access Request{pendingApprovals.length > 1 ? 's' : ''}</p>
                    </div>
                    <div className="space-y-3">
                        {pendingApprovals.map(f => (
                            <div key={f._id} className="flex items-center justify-between bg-slate-900/60 rounded-xl px-4 py-3 flex-wrap gap-3">
                                <div>
                                    <p className="text-sm font-semibold text-slate-200">{f.title}</p>
                                    <p className="text-xs text-slate-500">{f.staffName} requests access</p>
                                    <p className="text-xs text-indigo-400 mt-0.5 flex items-center gap-1">
                                        <KeyRound size={10} /> DH key exchange will encrypt share transfer
                                    </p>
                                </div>
                                <button onClick={() => handleApprove(f._id)} disabled={approving[f._id]}
                                    className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-colors flex items-center gap-2">
                                    <CheckCircle size={14} /> {approving[f._id] ? 'Exchanging Keys...' : 'Approve & Exchange Key'}
                                </button>
                            </div>
                        ))}
                    </div>
                </motion.div>
            )}

            {/* Files */}
            <div>
                <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-widest mb-3">Papers Assigned to You</h2>
                {loading ? (
                    <div className="flex justify-center py-12"><div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" /></div>
                ) : files.length === 0 ? (
                    <div className="text-center py-12 text-slate-500">No papers assigned to you yet.</div>
                ) : (
                    <div className="grid gap-4">
                        {files.map(f => {
                            const open = unlocked(f);
                            const modeLabel = f.mode === 'individual' ? 'Mode A — HOD Only' : 'Mode B — HOD + Staff';
                            const isExpired = f.approvalExpiresAt && new Date() > new Date(f.approvalExpiresAt);
                            return (
                                <motion.div key={f._id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                                    className="bg-slate-900/80 border border-slate-700/50 rounded-2xl p-5 hover:border-slate-600 transition-all">
                                    <div className="flex items-start justify-between gap-4 flex-wrap">
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className={`text-xs px-2 py-0.5 rounded-full border font-semibold ${open ? 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10' : 'text-amber-400 border-amber-500/30 bg-amber-500/10'}`}>
                                                    {open ? '🔓 Unlocked' : '🔒 Locked'}
                                                </span>
                                                <span className="text-xs text-slate-500 border border-slate-700 rounded-full px-2 py-0.5">{modeLabel}</span>
                                            </div>
                                            <h3 className="text-lg font-bold text-slate-100 mt-1">{f.title}</h3>
                                            <p className="text-sm text-slate-400">{f.subject}</p>
                                            <div className="flex flex-wrap gap-3 mt-2 text-xs text-slate-500">
                                                <span><Clock size={11} className="inline mr-1" />
                                                    {open ? `Unlocked ${formatDistanceToNow(new Date(f.examTime), { addSuffix: true })}` : `Opens ${format(new Date(f.examTime), 'PPp')}`}
                                                </span>
                                                <span>Setter: {f.setterName}</span>
                                                {f.mode === 'multi' && <span>Staff: {f.staffName}</span>}
                                            </div>
                                        </div>
                                        {open && (
                                            <button onClick={() => navigate(`/decrypt/${f._id}`)}
                                                className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors flex items-center gap-2">
                                                <ShieldCheck size={15} /> Decrypt Paper
                                            </button>
                                        )}
                                    </div>

                                    {/* Mode B status */}
                                    {f.mode === 'multi' && open && (
                                        <div className="mt-3 pt-3 border-t border-slate-800 space-y-1">
                                            <div className="flex items-center gap-2 text-xs">
                                                {f.hodApproved
                                                    ? <span className="text-emerald-400 flex items-center gap-1"><CheckCircle size={11} /> Staff access approved (ECDH key exchange complete)</span>
                                                    : f.staffAccessRequested
                                                        ? <span className="text-amber-400 flex items-center gap-1"><AlertCircle size={11} /> Staff request pending your approval</span>
                                                        : <span className="text-slate-500">Awaiting staff access request</span>
                                                }
                                            </div>
                                            {f.approvalExpiresAt && f.hodApproved && (
                                                <p className={`text-xs flex items-center gap-1 ${isExpired ? 'text-red-400' : 'text-cyan-400'}`}>
                                                    <Timer size={11} />
                                                    {isExpired
                                                        ? `Staff access expired at ${format(new Date(f.approvalExpiresAt), 'PPp')}`
                                                        : `Expires ${formatDistanceToNow(new Date(f.approvalExpiresAt), { addSuffix: true })}`
                                                    }
                                                </p>
                                            )}
                                        </div>
                                    )}
                                </motion.div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
