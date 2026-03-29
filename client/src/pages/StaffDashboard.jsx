import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import { format, isPast, formatDistanceToNow } from 'date-fns';
import { ShieldCheck, Clock, Lock, CheckCircle, AlertCircle, Key, KeyRound } from 'lucide-react';
import { generateECDHKeyPair, storeDHPrivateKey } from '../utils/browserCrypto';

const API = 'http://localhost:5000/api';

export default function StaffDashboard() {
    const { user, getToken } = useAuth();
    const navigate = useNavigate();
    const [files, setFiles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [requesting, setRequesting] = useState({});
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

    const handleRequestAccess = async (fileId) => {
        setRequesting(p => ({ ...p, [fileId]: true }));
        try {
            const { publicKeyHex, privateKeyPkcs8 } = await generateECDHKeyPair();
            storeDHPrivateKey(fileId, privateKeyPkcs8);
            const res = await axios.post(`${API}/files/${fileId}/request-access`,
                { dhPublicKey: publicKeyHex },
                { headers }
            );
            showToast('✅ ' + res.data.message);
            fetchFiles();
        } catch (e) { showToast('❌ ' + (e.response?.data?.message || 'Request failed')); }
        finally { setRequesting(p => ({ ...p, [fileId]: false })); }
    };

    const unlocked = (f) => isPast(new Date(f.allowedDecryptionTime || f.examTime));

    const getAccessStatus = (f) => {
        if (!unlocked(f)) return { color: 'text-slate-500', label: 'Locked' };
        if (f.mode === 'individual') return { color: 'text-slate-400', label: 'Mode A — HOD Only' };
        if (f.keyExchangeCompleted) return { color: 'text-emerald-400', label: 'Key exchange done — Ready to decrypt' };
        if (!f.staffAccessRequested) return { color: 'text-amber-400', label: 'Request access from HOD' };
        if (!f.hodApproved) return { color: 'text-amber-400', label: 'Waiting for HOD approval...' };
        return { color: 'text-emerald-400', label: 'Access approved — Ready to decrypt' };
    };

    return (
        <div className="max-w-5xl mx-auto space-y-6">
            <AnimatePresence>
                {toast && (
                    <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
                        className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-slate-800 border border-slate-700 text-slate-200 px-5 py-3 rounded-xl shadow-xl text-sm">
                        {toast}
                    </motion.div>
                )}
            </AnimatePresence>

            <div>
                <h1 className="text-2xl font-bold text-slate-100">Staff Dashboard</h1>
                <p className="text-slate-400 text-sm">{user?.name} · {user?.department}</p>
            </div>

            <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-xl p-4 flex items-start gap-3">
                <Key size={16} className="text-indigo-400 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-indigo-300">
                    Decryption uses <strong>ECDH key exchange</strong> + <strong>Shamir's Secret Sharing</strong>.
                    Your DH keypair is generated in-browser — the private key <strong>never leaves your device</strong>.
                    After the first key exchange, you can decrypt anytime without repeating DH.
                </p>
            </div>

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
                            const status = getAccessStatus(f);
                            const canDecrypt = open && f.mode === 'multi' && (f.hodApproved || f.keyExchangeCompleted);
                            return (
                                <motion.div key={f._id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                                    className="bg-slate-900/80 border border-slate-700/50 rounded-2xl p-5 hover:border-slate-600 transition-all">
                                    <div className="flex items-start justify-between gap-4 flex-wrap">
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className={`text-xs px-2 py-0.5 rounded-full border font-semibold ${open ? 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10' : 'text-amber-400 border-amber-500/30 bg-amber-500/10'}`}>
                                                    {open ? '🔓 Unlocked' : '🔒 Locked'}
                                                </span>
                                                <span className="text-xs text-slate-500 border border-slate-700 rounded-full px-2 py-0.5">
                                                    {f.mode === 'multi' ? 'Mode B — HOD + Staff' : 'Mode A — HOD Only'}
                                                </span>
                                                <span className="text-xs text-slate-500 border border-slate-700 rounded-full px-2 py-0.5 capitalize">
                                                    {f.uploadType}
                                                </span>
                                            </div>
                                            <h3 className="text-lg font-bold text-slate-100 mt-1">{f.title}</h3>
                                            <p className="text-sm text-slate-400">{f.subject}</p>
                                            <div className="flex flex-wrap gap-3 mt-2 text-xs text-slate-500">
                                                <span><Clock size={11} className="inline mr-1" />
                                                    {open ? `Unlocked ${formatDistanceToNow(new Date(f.allowedDecryptionTime || f.examTime), { addSuffix: true })}` : `Opens ${format(new Date(f.allowedDecryptionTime || f.examTime), 'PPp')}`}
                                                </span>
                                                <span>HOD: {f.hodName}</span>
                                            </div>
                                            <p className={`text-xs mt-2 flex items-center gap-1.5 ${status.color}`}>
                                                {canDecrypt ? <CheckCircle size={11} /> : <AlertCircle size={11} />} {status.label}
                                            </p>
                                        </div>

                                        <div className="flex flex-col gap-2">
                                            {open && f.mode === 'multi' && !f.staffAccessRequested && !f.hodApproved && !f.keyExchangeCompleted && (
                                                <button onClick={() => handleRequestAccess(f._id)} disabled={requesting[f._id]}
                                                    className="bg-cyan-600 hover:bg-cyan-500 disabled:opacity-60 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors flex items-center gap-2">
                                                    <KeyRound size={14} />
                                                    {requesting[f._id] ? 'Generating Keys...' : 'Request Access'}
                                                </button>
                                            )}

                                            {canDecrypt && (
                                                <button onClick={() => navigate(`/decrypt/${f._id}`)}
                                                    className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors flex items-center gap-2">
                                                    <ShieldCheck size={15} /> Decrypt
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </motion.div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
