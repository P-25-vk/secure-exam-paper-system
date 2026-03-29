import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Upload, FileText, Image, File, Clock, Users, ShieldCheck,
    AlertCircle, CheckCircle, KeyRound, Lock, X, Loader2, BookOpen
} from 'lucide-react';

const API = 'http://localhost:5000/api';

export default function UploadPage() {
    const { user, getToken } = useAuth();
    const navigate = useNavigate();

    // Form state
    const [title, setTitle] = useState('');
    const [subject, setSubject] = useState('');
    const [examTime, setExamTime] = useState('');
    const [allowedDecryptionTime, setAllowedDecryptionTime] = useState('');
    const [mode, setMode] = useState('multi'); // 'individual' | 'multi'
    const [uploadType, setUploadType] = useState('pdf');

    // Recipients
    const [hods, setHods] = useState([]);
    const [staffs, setStaffs] = useState([]);
    const [selectedHodId, setSelectedHodId] = useState('');
    const [selectedStaffId, setSelectedStaffId] = useState('');

    // Files
    const [paperFile, setPaperFile] = useState(null);     // for pdf
    const [imageFiles, setImageFiles] = useState([]);      // for images (max 4)

    // UI state
    const [step, setStep] = useState('form');  // form | uploading | done | error
    const [progress, setProgress] = useState(0);
    const [statusMsg, setStatusMsg] = useState('');
    const [error, setError] = useState('');

    const pdfRef = useRef(null);
    const imgRef = useRef(null);

    useEffect(() => { fetchUsers(); }, []);

    const fetchUsers = async () => {
        try {
            const res = await axios.get(`${API}/auth/users`, { headers: { Authorization: `Bearer ${getToken()}` } });
            setHods(res.data.filter(u => u.role === 'HOD'));
            setStaffs(res.data.filter(u => u.role === 'Staff'));
        } catch (e) { console.error(e); }
    };

    const validate = () => {
        if (!title) return 'Paper title is required.';
        if (!examTime) return 'Exam time is required.';
        if (!selectedHodId) return 'Please select an HOD.';
        if (mode === 'multi' && !selectedStaffId) return 'Please select a Staff for multi-key mode.';
        if (uploadType === 'pdf' && !paperFile) return 'Please select a PDF file.';
        if (uploadType === 'images' && imageFiles.length === 0) return 'Please select at least one image.';
        return null;
    };

    const handleUpload = async (e) => {
        e.preventDefault();
        const err = validate();
        if (err) { setError(err); return; }
        setError('');
        setStep('uploading');

        try {
            setStatusMsg('Uploading file to server for secure encryption...');
            setProgress(20);

            // Build multipart/form-data
            const formData = new FormData();
            formData.append('title', title);
            formData.append('subject', subject);
            formData.append('examTime', examTime);
            formData.append('mode', mode);
            formData.append('uploadType', uploadType);
            formData.append('hodId', selectedHodId);
            formData.append('allowedDecryptionTime', allowedDecryptionTime || examTime);
            if (mode === 'multi') formData.append('staffId', selectedStaffId);

            if (uploadType === 'images') {
                for (const img of imageFiles) {
                    formData.append('files', img);
                }
            } else {
                formData.append('file', paperFile);
            }

            setStatusMsg('Server is encrypting with AES-256-GCM...');
            setProgress(50);

            await axios.post(`${API}/files/upload`, formData, {
                headers: {
                    Authorization: `Bearer ${getToken()}`,
                    'Content-Type': 'multipart/form-data'
                },
                onUploadProgress: (progressEvent) => {
                    const pct = Math.round((progressEvent.loaded * 40) / progressEvent.total) + 50;
                    setProgress(Math.min(pct, 90));
                }
            });

            setProgress(100);
            setStatusMsg('Done!');
            setStep('done');
        } catch (e) {
            console.error(e);
            setError(e.response?.data?.message || e.message || 'Upload failed.');
            setStep('form');
        }
    };

    if (step === 'done') return (
        <div className="max-w-lg mx-auto mt-20 text-center">
            <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
                <div className="w-20 h-20 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                    <ShieldCheck size={40} className="text-emerald-400" />
                </div>
                <h2 className="text-2xl font-bold text-slate-100">Paper Uploaded & Encrypted Securely!</h2>
                <p className="text-slate-400 text-sm mt-2 max-w-sm mx-auto">
                    Your paper has been encrypted with <strong className="text-slate-300">AES-256-GCM</strong>.
                    The encryption key has been split using <strong className="text-slate-300">Shamir's Secret Sharing</strong> and
                    protected with <strong className="text-slate-300">RSA-OAEP</strong>. No raw key is stored.
                </p>
                <button onClick={() => navigate('/coordinator')} className="mt-6 bg-violet-600 hover:bg-violet-500 text-white px-6 py-3 rounded-xl font-semibold transition-colors">
                    Back to Dashboard
                </button>
            </motion.div>
        </div>
    );

    return (
        <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} className="max-w-3xl mx-auto">
            <div className="mb-6">
                <button onClick={() => navigate('/coordinator')} className="text-sm text-slate-400 hover:text-slate-200 mb-3 inline-flex items-center gap-1">← Back</button>
                <div className="flex items-center gap-3 mb-1">
                    <div className="p-2 bg-violet-500/10 rounded-xl text-violet-400"><BookOpen size={20} /></div>
                    <span className="text-xs font-semibold text-violet-400 uppercase tracking-widest">Question Setter · Server-Side Encryption</span>
                </div>
                <h1 className="text-2xl font-bold text-slate-100">Upload Exam Paper</h1>
                <p className="text-slate-400 text-sm mt-1">Your file is encrypted server-side with AES-256-GCM. The key is split via Shamir's Secret Sharing and protected with RSA — no raw key is ever stored.</p>
            </div>

            <AnimatePresence>
                {error && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                        className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl mb-5 flex items-center gap-3 text-sm">
                        <AlertCircle size={16} /> {error}
                    </motion.div>
                )}
            </AnimatePresence>

            {step === 'uploading' && (
                <div className="bg-slate-900/80 border border-slate-700/50 rounded-2xl p-8 text-center mb-5">
                    <Loader2 size={36} className="text-violet-400 animate-spin mx-auto mb-3" />
                    <p className="font-semibold text-slate-200">{statusMsg}</p>
                    <div className="w-full bg-slate-800 rounded-full h-2 mt-4 overflow-hidden">
                        <motion.div className="bg-gradient-to-r from-violet-500 to-purple-500 h-2 rounded-full" animate={{ width: `${progress}%` }} transition={{ duration: 0.4 }} />
                    </div>
                    <p className="text-xs text-slate-500 mt-2">{progress}%</p>
                </div>
            )}

            {step === 'form' && (
                <div className="bg-slate-900/80 border border-slate-700/50 rounded-2xl overflow-hidden">
                    <form onSubmit={handleUpload} className="p-7 space-y-7">

                        {/* Paper Info */}
                        <Section title="Paper Information">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <Input label="Title *" value={title} onChange={setTitle} placeholder="CS401 Mid-Term 2026" />
                                <Input label="Subject" value={subject} onChange={setSubject} placeholder="Advanced Algorithms" />
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-semibold text-slate-400 mb-1.5 block flex items-center gap-1.5">
                                        <Clock size={12} /> Exam Time *
                                    </label>
                                    <input type="datetime-local" value={examTime} onChange={e => setExamTime(e.target.value)} required
                                        className="bg-slate-800/80 border border-slate-700 rounded-xl py-3 px-4 text-sm text-slate-100 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500/40 transition-all w-full" />
                                </div>
                                <div>
                                    <label className="text-xs font-semibold text-slate-400 mb-1.5 block flex items-center gap-1.5">
                                        <Lock size={12} /> Allowed Decryption Time
                                    </label>
                                    <input type="datetime-local" value={allowedDecryptionTime} onChange={e => setAllowedDecryptionTime(e.target.value)}
                                        className="bg-slate-800/80 border border-slate-700 rounded-xl py-3 px-4 text-sm text-slate-100 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500/40 transition-all w-full" />
                                    <p className="text-xs text-slate-500 mt-1">Defaults to exam time if not set</p>
                                </div>
                            </div>
                        </Section>

                        {/* Mode */}
                        <Section title="Decryption Mode">
                            <div className="grid grid-cols-2 gap-3">
                                {[
                                    { id: 'multi', label: 'Mode B — HOD + Staff', desc: 'Both shares required (Shamir 2-of-2)', color: 'border-violet-500 bg-violet-500/10 text-violet-300' },
                                    { id: 'individual', label: 'Mode A — HOD Only', desc: 'HOD decrypts with RSA private key', color: 'border-amber-500 bg-amber-500/10 text-amber-300' }
                                ].map(m => (
                                    <button key={m.id} type="button" onClick={() => setMode(m.id)}
                                        className={`p-3 rounded-xl border text-left transition-all ${mode === m.id ? m.color : 'border-slate-700 bg-slate-800/40 text-slate-400 hover:border-slate-600'}`}>
                                        <p className="text-sm font-semibold">{m.label}</p>
                                        <p className="text-xs opacity-70 mt-0.5">{m.desc}</p>
                                    </button>
                                ))}
                            </div>
                            <p className="text-xs text-slate-500">
                                {mode === 'multi'
                                    ? 'AES key is split into 2 Shamir shares. Both HOD and Staff shares are needed to reconstruct and decrypt.'
                                    : 'AES key is encrypted with HOD\'s RSA public key. HOD can decrypt alone using their private key.'}
                            </p>
                        </Section>

                        {/* Recipients */}
                        <Section title="Key Recipients">
                            <div>
                                <label className="text-xs font-semibold text-slate-400 mb-1.5 block">HOD (Share-1 or RSA decrypt) *</label>
                                <select value={selectedHodId} onChange={e => setSelectedHodId(e.target.value)} required
                                    className="w-full bg-slate-800/80 border border-slate-700 rounded-xl py-3 px-4 text-sm text-slate-100 focus:outline-none focus:border-violet-500 transition-all">
                                    <option value="">Select HOD</option>
                                    {hods.map(h => (
                                        <option key={h._id} value={h._id}>{h.name}</option>
                                    ))}
                                </select>
                            </div>
                            {mode === 'multi' && (
                                <div>
                                    <label className="text-xs font-semibold text-slate-400 mb-1.5 block">Staff (Share-2) *</label>
                                    <select value={selectedStaffId} onChange={e => setSelectedStaffId(e.target.value)} required
                                        className="w-full bg-slate-800/80 border border-slate-700 rounded-xl py-3 px-4 text-sm text-slate-100 focus:outline-none focus:border-violet-500 transition-all">
                                        <option value="">Select Staff</option>
                                        {staffs.map(s => (
                                            <option key={s._id} value={s._id}>{s.name}</option>
                                        ))}
                                    </select>
                                </div>
                            )}
                        </Section>

                        {/* File upload */}
                        <Section title="Paper Content">
                            <div className="flex gap-3 mb-4">
                                {[{id: 'pdf', label: 'PDF', icon: 'File'}, {id: 'images', label: 'Images (max 4)', icon: 'Image'}].map(t => (
                                    <button key={t.id} type="button" onClick={() => { setUploadType(t.id); setPaperFile(null); setImageFiles([]); }}
                                        className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border transition-all ${uploadType === t.id ? 'bg-violet-600 border-violet-500 text-white' : 'bg-slate-800/60 border-slate-700 text-slate-400 hover:border-slate-600'}`}>
                                        {t.id === 'pdf' ? <><File size={14} /> PDF</> : <><Image size={14} /> Images (max 4)</>}
                                    </button>
                                ))}
                            </div>

                            {uploadType === 'pdf' ? (
                                <div onClick={() => !paperFile && pdfRef.current?.click()}
                                    className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${paperFile ? 'border-violet-500/40 bg-violet-500/5' : 'border-slate-700 hover:border-slate-500'}`}>
                                    <input ref={pdfRef} type="file" accept=".pdf" className="hidden"
                                        onChange={e => e.target.files?.[0] && setPaperFile(e.target.files[0])} />
                                    {paperFile ? (
                                        <div>
                                            <FileText size={32} className="text-violet-400 mx-auto mb-2" />
                                            <p className="text-sm font-semibold text-slate-200">{paperFile.name}</p>
                                            <p className="text-xs text-slate-500">{(paperFile.size/1024/1024).toFixed(2)} MB</p>
                                            <button type="button" onClick={(ev) => { ev.stopPropagation(); setPaperFile(null); }} className="mt-2 text-xs text-red-400 hover:text-red-300">Remove</button>
                                        </div>
                                    ) : (
                                        <><Upload size={32} className="text-slate-600 mx-auto mb-2" /><p className="text-slate-400 text-sm">Click to select a PDF file</p></>
                                    )}
                                </div>
                            ) : (
                                <div>
                                    <div onClick={() => imageFiles.length < 4 && imgRef.current?.click()}
                                        className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${imageFiles.length > 0 ? 'border-violet-500/40 bg-violet-500/5' : 'border-slate-700 hover:border-slate-500'}`}>
                                        <input ref={imgRef} type="file" accept="image/*" multiple className="hidden"
                                            onChange={e => {
                                                const files = Array.from(e.target.files || []);
                                                setImageFiles(prev => [...prev, ...files].slice(0, 4));
                                                e.target.value = '';
                                            }} />
                                        {imageFiles.length === 0 ? (
                                            <><Image size={32} className="text-slate-600 mx-auto mb-2" /><p className="text-slate-400 text-sm">Click to select up to 4 images</p></>
                                        ) : (
                                            <p className="text-slate-400 text-sm">{imageFiles.length}/4 images selected — click to add more</p>
                                        )}
                                    </div>
                                    {imageFiles.length > 0 && (
                                        <div className="mt-3 space-y-2">
                                            {imageFiles.map((f, i) => (
                                                <div key={i} className="flex items-center justify-between bg-slate-800/60 rounded-lg px-3 py-2">
                                                    <div className="flex items-center gap-2">
                                                        <Image size={14} className="text-violet-400" />
                                                        <span className="text-sm text-slate-200 truncate max-w-[200px]">{f.name}</span>
                                                        <span className="text-xs text-slate-500">{(f.size/1024/1024).toFixed(2)} MB</span>
                                                    </div>
                                                    <button type="button" onClick={() => setImageFiles(prev => prev.filter((_, j) => j !== i))} className="text-xs text-red-400 hover:text-red-300">✕</button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}

                            {uploadType === 'images' && (
                                <p className="text-xs text-slate-500 mt-2">
                                    🎨 Each image will be processed with <strong>Visual Cryptography (2,2)</strong> — split into two shares where neither reveals the original.
                                </p>
                            )}
                        </Section>

                        {/* Crypto summary */}
                        <div className="bg-slate-800/40 border border-slate-700/50 rounded-xl p-4 text-xs text-slate-500 space-y-1">
                            <p className="font-semibold text-slate-400 mb-1">🔐 What happens when you click Submit</p>
                            <p>① File uploaded to server over secure connection</p>
                            <p>② AES-256-GCM random key generated on server</p>
                            <p>③ File encrypted with AES-256-GCM</p>
                            {uploadType === 'images' && <p>③b Each image processed with Visual Cryptography (2,2) — two shares per image</p>}
                            {mode === 'multi'
                                ? <><p>④ AES key split via Shamir's Secret Sharing (2,2) → Share-1 (HOD), Share-2 (Staff)</p><p>⑤ AES key also encrypted with HOD's RSA public key</p></>
                                : <p>④ AES key encrypted with HOD's RSA public key (RSA-OAEP SHA-256)</p>
                            }
                            <p className="text-amber-400/80">⑥ Raw AES key is wiped — only encrypted key + shares stored. Never stored in plaintext.</p>
                        </div>

                        <motion.button type="submit" disabled={step !== 'form'}
                            whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}
                            className="w-full py-3.5 rounded-xl font-bold text-white bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 shadow-lg shadow-violet-500/20 transition-all">
                            🔒 Upload & Encrypt Securely
                        </motion.button>
                    </form>
                </div>
            )}
        </motion.div>
    );
}

// ── Sub-components ──────────────────────────────────────────────────────────
const Section = ({ title, children }) => (
    <div className="space-y-3">
        <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-widest pb-2 border-b border-slate-700/50">{title}</h2>
        {children}
    </div>
);

const Input = ({ label, value, onChange, placeholder, type = 'text' }) => (
    <div>
        <label className="text-xs font-semibold text-slate-400 mb-1.5 block">{label}</label>
        <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
            className="w-full bg-slate-800/80 border border-slate-700 rounded-xl py-3 px-4 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500/40 transition-all" />
    </div>
);
