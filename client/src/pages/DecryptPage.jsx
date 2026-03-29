import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import { format, isPast, formatDistanceToNow } from 'date-fns';
import {
    KeyRound, ShieldCheck, AlertCircle, Lock, Clock, Download,
    FileText, Image, CheckCircle, Loader2, RefreshCw
} from 'lucide-react';
import {
    generateECDHKeyPair, deriveSharedSecret, decryptWithSharedSecret,
    storeDHPrivateKey, loadDHPrivateKey, clearDHPrivateKey
} from '../utils/browserCrypto';

const API = 'http://localhost:5000/api';

export default function DecryptPage() {
    const { id } = useParams();
    const { user, getToken } = useAuth();
    const navigate = useNavigate();

    const [fileMeta, setFileMeta] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const [decryptStep, setDecryptStep] = useState('idle');
    const [decryptStatus, setDecryptStatus] = useState('');
    const [decryptedUrl, setDecryptedUrl] = useState(null);
    const [decryptedImages, setDecryptedImages] = useState([]);
    const [imageShareUrls, setImageShareUrls] = useState([]);

    const [dhStep, setDhStep] = useState('idle');
    const [hodShareDecrypted, setHodShareDecrypted] = useState(null);

    const isHOD   = user?.role === 'HOD';
    const isStaff = user?.role === 'Staff';

    useEffect(() => { fetchMeta(); }, [id]);

    const fetchMeta = async () => {
        try {
            const res = await axios.get(`${API}/files/${id}`, { headers: { Authorization: `Bearer ${getToken()}` } });
            setFileMeta(res.data);

            // Set DH state for staff
            if (user?.role === 'Staff' && res.data.mode === 'multi') {
                if (res.data.keyExchangeCompleted) {
                    setDhStep('exchange_done');
                } else if (res.data.hodApproved) {
                    const storedKey = await loadDHPrivateKey(id);
                    setDhStep(storedKey ? 'ready_to_retrieve' : 'approved_no_key');
                } else if (res.data.staffAccessRequested) {
                    setDhStep('waiting');
                }
            }
        } catch (e) { setError(e.response?.data?.message || 'Failed to load file info.'); }
        finally { setLoading(false); }
    };

    const unlocked = fileMeta && isPast(new Date(fileMeta.allowedDecryptionTime || fileMeta.examTime));

    // ── HOD: Decrypt using RSA private key ───────────────────────────────
    const handleHODDecrypt = async () => {
        setError(''); setDecryptStep('decrypting');
        setDecryptStatus('Server is decrypting with HOD RSA private key...');
        try {
            if (fileMeta.uploadType === 'images') {
                const res = await axios.post(`${API}/files/${id}/decrypt-hod`, {}, {
                    headers: { Authorization: `Bearer ${getToken()}` }
                });
                setDecryptedImages(res.data.images);
            } else {
                const res = await axios.post(`${API}/files/${id}/decrypt-hod`, {}, {
                    headers: { Authorization: `Bearer ${getToken()}` },
                    responseType: 'blob'
                });
                const blob = new Blob([res.data], { type: fileMeta.mimeType });
                setDecryptedUrl(URL.createObjectURL(blob));
            }
            setDecryptStep('done');
        } catch (e) {
            console.error(e);
            if (e.response?.data instanceof Blob) {
                const text = await e.response.data.text();
                try { setError(JSON.parse(text).message); } catch { setError(text); }
            } else {
                setError(e.response?.data?.message || e.message || 'HOD decryption failed.');
            }
            setDecryptStep('idle');
        }
    };

    // ── HOD: Combined Shamir Shares ──────────────────────────────────────
    const handleCombinedDecrypt = async () => {
        setError(''); setDecryptStep('decrypting');
        setDecryptStatus('Server is combining Shamir shares from filesystem...');
        try {
            if (fileMeta.uploadType === 'images') {
                const res = await axios.post(`${API}/files/${id}/decrypt-combined`, {}, {
                    headers: { Authorization: `Bearer ${getToken()}` }
                });
                setDecryptedImages(res.data.images);
            } else {
                const res = await axios.post(`${API}/files/${id}/decrypt-combined`, {}, {
                    headers: { Authorization: `Bearer ${getToken()}` },
                    responseType: 'blob'
                });
                const blob = new Blob([res.data], { type: fileMeta.mimeType });
                setDecryptedUrl(URL.createObjectURL(blob));
            }
            setDecryptStep('done');
        } catch (e) {
            console.error(e);
            if (e.response?.data instanceof Blob) {
                const text = await e.response.data.text();
                try { setError(JSON.parse(text).message); } catch { setError(text); }
            } else {
                setError(e.response?.data?.message || e.message || 'Combined decryption failed.');
            }
            setDecryptStep('idle');
        }
    };

    // ── Staff: Request Access with DH public key ─────────────────────────
    const handleRequestAccess = async () => {
        setError(''); setDhStep('requesting');
        try {
            const { publicKeyHex, privateKeyPkcs8 } = await generateECDHKeyPair();
            storeDHPrivateKey(id, privateKeyPkcs8);
            await axios.post(`${API}/files/${id}/request-access`,
                { dhPublicKey: publicKeyHex },
                { headers: { Authorization: `Bearer ${getToken()}` } }
            );
            setDhStep('waiting');
            fetchMeta();
        } catch (e) {
            setError(e.response?.data?.message || 'Failed to request access.');
            setDhStep('idle');
        }
    };

    // ── Staff: Retrieve + decrypt HOD share via DH ───────────────────────
    const handleRetrieveAndDecryptShare = async () => {
        setError(''); setDhStep('retrieving');
        try {
            const myPrivateKey = await loadDHPrivateKey(id);
            if (!myPrivateKey) {
                setError('DH private key not found in this browser. You need to request access again.');
                setDhStep('approved_no_key');
                return;
            }

            const res = await axios.get(`${API}/files/${id}/retrieve-share`, {
                headers: { Authorization: `Bearer ${getToken()}` }
            });
            const { encryptedShare, hodDhPublicKey } = res.data;

            const aesKey = await deriveSharedSecret(myPrivateKey, hodDhPublicKey);
            const hodShare = await decryptWithSharedSecret(encryptedShare, aesKey);

            setHodShareDecrypted(hodShare);
            setDhStep('ready');
            clearDHPrivateKey(id);
        } catch (e) {
            console.error('DH exchange error:', e);
            setError(e.response?.data?.message || e.message || 'Key exchange failed.');
            setDhStep('approved_no_key');
        }
    };

    // ── Staff: Decrypt (first time with DH share, or direct after exchange) ──
    const handleStaffDecrypt = async (shareOverride) => {
        setError(''); setDecryptStep('decrypting');
        setDecryptStatus('Combining shares and decrypting...');
        try {
            const body = shareOverride ? { hodShare: shareOverride } : {};
            if (fileMeta.uploadType === 'images') {
                const res = await axios.post(`${API}/files/${id}/decrypt-staff`, body,
                    { headers: { Authorization: `Bearer ${getToken()}` } }
                );
                setDecryptedImages(res.data.images);
            } else {
                const res = await axios.post(`${API}/files/${id}/decrypt-staff`, body,
                    { headers: { Authorization: `Bearer ${getToken()}` }, responseType: 'blob' }
                );
                const blob = new Blob([res.data], { type: fileMeta.mimeType });
                setDecryptedUrl(URL.createObjectURL(blob));
            }
            setDecryptStep('done');
            setHodShareDecrypted(null);
            setDhStep('exchange_done');
        } catch (e) {
            console.error(e);
            if (e.response?.data instanceof Blob) {
                const text = await e.response.data.text();
                try { setError(JSON.parse(text).message); } catch { setError(text); }
            } else {
                setError(e.response?.data?.message || e.message || 'Staff decryption failed.');
            }
            setDecryptStep('idle');
        }
    };

    // ── View image shares ────────────────────────────────────────────────
    const handleGetImageShares = async () => {
        setError('');
        try {
            const res = await axios.get(`${API}/files/${id}/image-share`, {
                headers: { Authorization: `Bearer ${getToken()}` }
            });
            const urls = (res.data.shares || []).map(shareB64 => {
                const blob = new Blob(
                    [Uint8Array.from(atob(shareB64), c => c.charCodeAt(0))],
                    { type: 'image/png' }
                );
                return URL.createObjectURL(blob);
            });
            setImageShareUrls(urls);
        } catch (e) {
            setError(e.response?.data?.message || 'Failed to get image shares.');
        }
    };

    if (loading) return <div className="flex justify-center items-center h-64"><div className="w-10 h-10 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" /></div>;

    return (
        <div className="max-w-4xl mx-auto py-4">
            <button onClick={() => navigate(-1)} className="text-sm text-slate-400 hover:text-slate-200 mb-5 inline-flex items-center gap-1">← Back</button>

            {/* Header */}
            <div className="mb-6">
                <div className="flex items-center gap-2 mb-1">
                    <ShieldCheck size={16} className="text-indigo-400" />
                    <span className="text-xs font-semibold text-indigo-400 uppercase tracking-widest">Secure Decryption Gateway</span>
                </div>
                <h1 className="text-2xl font-bold text-slate-100">{fileMeta?.title}</h1>
                <p className="text-slate-400 text-sm">{fileMeta?.subject}</p>
                <div className="flex items-center gap-4 mt-2 text-xs text-slate-500 flex-wrap">
                    <span className="flex items-center gap-1.5"><Clock size={11} />
                        {unlocked ? `Unlocked ${formatDistanceToNow(new Date(fileMeta.allowedDecryptionTime || fileMeta.examTime), { addSuffix: true })}` : `Available ${format(new Date(fileMeta.allowedDecryptionTime || fileMeta.examTime), 'PPp')}`}
                    </span>
                    <span className="capitalize px-2 py-0.5 bg-slate-800 rounded-full border border-slate-700">Mode {fileMeta?.mode === 'multi' ? 'B — HOD + Staff' : 'A — HOD Only'}</span>
                    <span className="capitalize px-2 py-0.5 bg-slate-800 rounded-full border border-slate-700">{fileMeta?.uploadType}</span>
                </div>
            </div>

            {/* Time lock warning */}
            {!unlocked && (
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-5 mb-5 flex items-center gap-4">
                    <Lock size={28} className="text-amber-400 flex-shrink-0" />
                    <div>
                        <p className="text-amber-300 font-semibold">Paper is Time-Locked</p>
                        <p className="text-amber-400/70 text-sm mt-0.5">Available in {formatDistanceToNow(new Date(fileMeta.allowedDecryptionTime || fileMeta.examTime))} ({format(new Date(fileMeta.allowedDecryptionTime || fileMeta.examTime), 'PPp')})</p>
                    </div>
                </div>
            )}

            <AnimatePresence>
                {error && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                        className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl mb-5 flex items-center gap-3 text-sm">
                        <AlertCircle size={16} />{error}
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Decrypting spinner */}
            {decryptStep === 'decrypting' && (
                <div className="bg-slate-900/80 border border-slate-700/50 rounded-2xl p-8 text-center mb-5">
                    <Loader2 size={36} className="text-indigo-400 animate-spin mx-auto mb-3" />
                    <p className="text-slate-300 font-semibold">{decryptStatus}</p>
                    <p className="text-xs text-slate-500 mt-2">No raw keys stored in MongoDB — shares encrypted on filesystem.</p>
                </div>
            )}

            {/* Decrypted result */}
            {decryptStep === 'done' && (decryptedUrl || decryptedImages.length > 0) && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                    className="bg-slate-900/80 border border-emerald-500/30 rounded-2xl overflow-hidden mb-5">
                    <div className="bg-emerald-500/10 border-b border-emerald-500/20 p-4 flex items-center gap-3">
                        <CheckCircle size={20} className="text-emerald-400" />
                        <span className="text-emerald-300 font-semibold">Paper Decrypted Successfully</span>
                    </div>
                    <div className="p-4">
                        {decryptedUrl && fileMeta?.mimeType === 'application/pdf' ? (
                            <>
                                <div className="flex justify-end mb-2">
                                    <a href={decryptedUrl} download={fileMeta?.originalName}
                                        className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-2 rounded-lg text-sm font-semibold transition-colors">
                                        <Download size={14} /> Download PDF
                                    </a>
                                </div>
                                <object data={decryptedUrl} type="application/pdf" className="w-full h-[70vh]">
                                    <p className="text-slate-400 text-center p-8">PDF preview unavailable — use Download above.</p>
                                </object>
                            </>
                        ) : decryptedImages.length > 0 ? (
                            <div className="space-y-4">
                                {decryptedImages.map((img, i) => {
                                    const src = `data:${img.mimeType || 'image/png'};base64,${img.data}`;
                                    return (
                                        <div key={i} className="border border-slate-700/50 rounded-xl overflow-hidden">
                                            <div className="flex items-center justify-between bg-slate-800/60 px-4 py-2">
                                                <span className="text-xs font-medium text-slate-400">Page {i+1}: {img.originalName}</span>
                                                <a href={src} download={img.originalName} className="text-xs text-emerald-400 flex items-center gap-1">
                                                    <Download size={12} /> Download
                                                </a>
                                            </div>
                                            <img src={src} alt={`Page ${i+1}`} className="w-full object-contain" />
                                        </div>
                                    );
                                })}
                            </div>
                        ) : decryptedUrl ? (
                            <img src={decryptedUrl} alt="Decrypted Paper" className="w-full object-contain" />
                        ) : null}
                    </div>
                </motion.div>
            )}

            {/* Image share previews */}
            {imageShareUrls.length > 0 && (
                <div className="bg-slate-900/80 border border-indigo-500/30 rounded-2xl overflow-hidden mb-5">
                    <div className="bg-indigo-500/10 border-b border-indigo-500/20 p-4 flex items-center gap-3">
                        <Image size={18} className="text-indigo-400" />
                        <span className="text-indigo-300 font-semibold">Your Visual Crypto Shares ({imageShareUrls.length})</span>
                    </div>
                    <div className="p-4 space-y-3">
                        {imageShareUrls.map((url, i) => (
                            <div key={i} className="border border-slate-700/50 rounded-xl overflow-hidden">
                                <div className="bg-slate-800/60 px-4 py-2 text-xs text-slate-400">Share {i+1}</div>
                                <img src={url} alt={`Visual Crypto Share ${i+1}`} className="w-full object-contain max-h-64" />
                            </div>
                        ))}
                        <p className="text-xs text-slate-500 text-center">Each share reveals no information alone. Both shares must be combined to reconstruct the image.</p>
                    </div>
                </div>
            )}

            {/* ── HOD Controls ─────────────────────────────────────────────── */}
            {isHOD && decryptStep === 'idle' && unlocked && (
                <div className="bg-slate-900/80 border border-slate-700/50 rounded-2xl p-6 space-y-5">
                    {fileMeta?.mode === 'individual' && (
                        <motion.button onClick={handleHODDecrypt}
                            whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}
                            className="w-full py-4 rounded-xl font-bold text-base flex items-center justify-center gap-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white shadow-lg shadow-indigo-500/20 transition-all">
                            <ShieldCheck size={20} /> Decrypt Paper (HOD Only — RSA)
                        </motion.button>
                    )}

                    {fileMeta?.mode === 'multi' && (
                        <div className="space-y-3">
                            <motion.button onClick={handleHODDecrypt}
                                whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}
                                className="w-full py-4 rounded-xl font-bold text-base flex items-center justify-center gap-3 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white shadow-lg transition-all">
                                <KeyRound size={20} /> Decrypt Paper (HOD — RSA Key)
                            </motion.button>
                            {fileMeta?.hodApproved && (
                                <motion.button onClick={handleCombinedDecrypt}
                                    whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}
                                    className="w-full py-4 rounded-xl font-bold text-base flex items-center justify-center gap-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white shadow-lg shadow-indigo-500/20 transition-all">
                                    <ShieldCheck size={20} /> Decrypt Paper (Combined Shamir Shares)
                                </motion.button>
                            )}
                        </div>
                    )}

                    {/* Image shares — view only (no combine button) */}
                    {fileMeta?.uploadType === 'images' && (
                        <motion.button onClick={handleGetImageShares}
                            whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}
                            className="w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-3 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white shadow-lg transition-all">
                            <Image size={18} /> View My Visual Crypto Shares
                        </motion.button>
                    )}

                    <p className="text-center text-xs text-slate-600">
                        All keys stored encrypted on filesystem. No raw keys in MongoDB.
                    </p>
                </div>
            )}

            {/* ── Staff Controls ───────────────────────────────────────────── */}
            {isStaff && fileMeta?.mode === 'multi' && unlocked && decryptStep === 'idle' && (
                <div className="bg-slate-900/80 border border-slate-700/50 rounded-2xl p-6 space-y-5">
                    <h3 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
                        <KeyRound size={16} className="text-indigo-400" />
                        Secure Key Exchange (ECDH + Shamir)
                    </h3>

                    {/* Key exchange already done — direct decrypt */}
                    {dhStep === 'exchange_done' && (
                        <div className="space-y-3">
                            <div className="flex items-center gap-2 text-emerald-400 mb-1">
                                <CheckCircle size={14} />
                                <span className="text-sm font-semibold">Key Exchange Complete ✓ — You can decrypt anytime</span>
                            </div>
                            <motion.button onClick={() => handleStaffDecrypt(null)}
                                whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}
                                className="w-full py-4 rounded-xl font-bold text-base flex items-center justify-center gap-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-lg shadow-emerald-500/20 transition-all">
                                <ShieldCheck size={20} /> Decrypt Paper
                            </motion.button>

                            {fileMeta?.uploadType === 'images' && (
                                <motion.button onClick={handleGetImageShares}
                                    whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}
                                    className="w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-3 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white shadow-lg transition-all">
                                    <Image size={18} /> View My Visual Crypto Shares
                                </motion.button>
                            )}
                        </div>
                    )}

                    {/* Step 1: Request Access */}
                    {!fileMeta.staffAccessRequested && !fileMeta.hodApproved && dhStep !== 'exchange_done' && (
                        <div className="space-y-3">
                            <p className="text-xs text-slate-500">
                                Generates an ECDH keypair in your browser. The public key is sent to the server.
                                The private key <strong className="text-slate-400">never leaves your browser</strong>.
                            </p>
                            <motion.button onClick={handleRequestAccess} disabled={dhStep === 'requesting'}
                                whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}
                                className="w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-3 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white shadow-lg transition-all disabled:opacity-60">
                                {dhStep === 'requesting' ? (
                                    <><Loader2 size={16} className="animate-spin" /> Generating Keys & Requesting...</>
                                ) : (
                                    <><KeyRound size={16} /> Generate DH Key & Request Access</>
                                )}
                            </motion.button>
                        </div>
                    )}

                    {/* Step 2: Waiting */}
                    {dhStep === 'waiting' && (
                        <div className="text-center space-y-3">
                            <div className="flex items-center justify-center gap-2 text-amber-400">
                                <Clock size={16} />
                                <span className="text-sm font-semibold">Waiting for HOD approval...</span>
                            </div>
                            <p className="text-xs text-slate-500">Your ECDH public key has been sent. When HOD approves, their share will be encrypted with the DH shared secret.</p>
                            <button onClick={fetchMeta} className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 mx-auto">
                                <RefreshCw size={12} /> Refresh Status
                            </button>
                        </div>
                    )}

                    {/* Step 3: Retrieve & decrypt share */}
                    {(dhStep === 'ready_to_retrieve' || dhStep === 'approved_no_key') && fileMeta.hodApproved && (
                        <div className="space-y-3">
                            <div className="flex items-center gap-2 text-emerald-400 mb-1">
                                <CheckCircle size={14} />
                                <span className="text-sm font-semibold">HOD Approved ✓</span>
                            </div>

                            {dhStep === 'approved_no_key' ? (
                                <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 text-xs text-amber-400 space-y-2">
                                    <p className="font-semibold">⚠ DH key not found in this browser session</p>
                                    <p>Your ECDH private key was generated in another browser or session. Request access again to generate a new key.</p>
                                    <button onClick={handleRequestAccess}
                                        className="bg-amber-600 hover:bg-amber-500 text-white px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors">
                                        Re-request Access (New DH Key)
                                    </button>
                                </div>
                            ) : (
                                <>
                                    <p className="text-xs text-slate-500">
                                        HOD encrypted their share with the ECDH shared secret. Click below to compute the shared secret in your browser and decrypt the HOD share.
                                    </p>
                                    <motion.button onClick={handleRetrieveAndDecryptShare}
                                        disabled={dhStep === 'retrieving'}
                                        whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}
                                        className="w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-3 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white shadow-lg transition-all disabled:opacity-60">
                                        {dhStep === 'retrieving' ? (
                                            <><Loader2 size={16} className="animate-spin" /> Computing Shared Secret...</>
                                        ) : (
                                            <><ShieldCheck size={16} /> Retrieve & Decrypt HOD Share (ECDH)</>
                                        )}
                                    </motion.button>
                                </>
                            )}
                        </div>
                    )}

                    {/* Step 4: Ready to decrypt */}
                    {dhStep === 'ready' && hodShareDecrypted && (
                        <div className="space-y-3">
                            <div className="flex items-center gap-2 text-emerald-400 mb-1">
                                <CheckCircle size={14} />
                                <span className="text-sm font-semibold">Key Exchange Complete ✓</span>
                            </div>
                            <p className="text-xs text-slate-500">
                                HOD share decrypted via ECDH. Server will combine it with your share to decrypt the paper.
                                After this, you can decrypt anytime without repeating the key exchange.
                            </p>
                            <motion.button onClick={() => handleStaffDecrypt(hodShareDecrypted)}
                                whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}
                                className="w-full py-4 rounded-xl font-bold text-base flex items-center justify-center gap-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-lg shadow-emerald-500/20 transition-all">
                                <ShieldCheck size={20} /> Decrypt Paper
                            </motion.button>
                        </div>
                    )}

                    <div className="bg-slate-800/40 border border-slate-700/50 rounded-xl p-3 text-xs text-slate-500 space-y-1">
                        <p className="font-semibold text-slate-400">🔐 Security Flow</p>
                        <p>① Your ECDH private key stays in browser (never sent to server)</p>
                        <p>② HOD share encrypted with DH shared secret during approval</p>
                        <p>③ You decrypt HOD share using your private key + HOD public key</p>
                        <p>④ Server combines both Shamir shares → decrypts → returns paper</p>
                        <p className="text-amber-400/80">⑤ No raw Shamir shares stored in MongoDB — encrypted on filesystem</p>
                    </div>
                </div>
            )}
        </div>
    );
}
