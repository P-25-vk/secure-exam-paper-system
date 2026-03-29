import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { motion } from 'framer-motion';
import { format, isPast } from 'date-fns';
import { FileText, Upload, Clock, Lock, Unlock, ChevronRight, BookOpen, AlertCircle } from 'lucide-react';

const API = 'http://localhost:5000/api';

export default function CoordinatorDashboard() {
    const { user, getToken } = useAuth();
    const navigate = useNavigate();
    const [files, setFiles] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => { fetchFiles(); }, []);

    const fetchFiles = async () => {
        try {
            const res = await axios.get(`${API}/files`, {
                headers: { Authorization: `Bearer ${getToken()}` }
            });
            setFiles(res.data);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-6xl mx-auto">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-8 gap-4">
                <div>
                    <div className="flex items-center gap-3 mb-1">
                        <div className="p-2 bg-violet-500/10 rounded-xl text-violet-400"><BookOpen size={20} /></div>
                        <span className="text-xs font-semibold text-violet-400 uppercase tracking-widest">Question Setter</span>
                    </div>
                    <h1 className="text-3xl font-bold text-slate-100">My Uploaded Papers</h1>
                    <p className="text-slate-400 text-sm mt-1">Welcome, {user?.name}. Manage your uploaded examination papers here.</p>
                </div>
                <motion.button
                    whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                    onClick={() => navigate('/upload')}
                    className="flex items-center gap-2 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white px-5 py-3 rounded-xl font-semibold text-sm shadow-lg shadow-violet-500/25 transition-all"
                >
                    <Upload size={18} /> Upload New Paper
                </motion.button>
            </div>

            {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {[1,2,3].map(n => <div key={n} className="bg-slate-800/60 rounded-2xl h-48 animate-pulse border border-slate-700/50" />)}
                </div>
            ) : files.length === 0 ? (
                <div className="bg-slate-900/60 border border-slate-700/50 rounded-2xl flex flex-col items-center justify-center p-16 text-center">
                    <div className="p-4 bg-violet-500/10 rounded-2xl mb-4"><FileText size={48} className="text-violet-400/50" /></div>
                    <h3 className="text-lg font-semibold text-slate-300">No papers uploaded yet</h3>
                    <p className="text-slate-500 text-sm mt-2 mb-6">Upload your first secure examination paper</p>
                    <button onClick={() => navigate('/upload')} className="bg-violet-600 hover:bg-violet-500 text-white px-5 py-2.5 rounded-xl font-semibold text-sm transition-colors">
                        Upload Paper
                    </button>
                </div>
            ) : (
                <motion.div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5"
                    initial="hidden" animate="show"
                    variants={{ hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.08 }} }}>
                    {files.map(file => {
                        const unlocked = isPast(new Date(file.examTime));
                        return (
                            <motion.div key={file._id}
                                variants={{ hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0 } }}
                                className="bg-slate-900/80 border border-slate-700/50 rounded-2xl overflow-hidden hover:border-slate-600 transition-all group">
                                <div className="p-5">
                                    <div className="flex items-start justify-between mb-3">
                                        <div className={`p-2 rounded-xl ${unlocked ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-700/50 text-slate-400'}`}>
                                            {unlocked ? <Unlock size={18} /> : <Lock size={18} />}
                                        </div>
                                        <span className={`px-2.5 py-1 text-xs font-semibold rounded-full ${unlocked ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'}`}>
                                            {unlocked ? 'Accessible' : 'Time-Locked'}
                                        </span>
                                    </div>
                                    <h3 className="font-bold text-slate-100 text-base truncate">{file.title}</h3>
                                    {file.subject && <p className="text-xs text-slate-400 mt-0.5">{file.subject}</p>}
                                    <div className="mt-3 space-y-1.5 text-xs text-slate-500">
                                        <div className="flex items-center gap-2"><Clock size={12} /><span>Unlock: {format(new Date(file.examTime), 'PPp')}</span></div>
                                        <div className="flex items-center gap-2"><FileText size={12} /><span className="capitalize">{file.uploadType} · Mode {file.mode === 'multi' ? 'B' : 'A'}</span></div>
                                    </div>
                                </div>
                                <div className="px-5 pb-4">
                                    <div className="bg-slate-800/60 rounded-xl p-3">
                                        <p className="text-xs text-slate-500 font-medium mb-2">Assigned Recipients</p>
                                        <div className="flex flex-wrap gap-1">
                                            {file.hodName && (
                                                <span className="text-xs bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded-full">HOD: {file.hodName}</span>
                                            )}
                                            {file.staffName && (
                                                <span className="text-xs bg-cyan-500/20 text-cyan-300 px-2 py-0.5 rounded-full">Staff: {file.staffName}</span>
                                            )}
                                            {!file.hodName && !file.staffName && (
                                                <span className="text-xs text-slate-500">No recipients</span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        );
                    })}
                </motion.div>
            )}
        </div>
    );
}
