import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { format, isPast } from 'date-fns';
import { FileText, Lock, Unlock, Clock, AlertCircle } from 'lucide-react';

export default function Dashboard() {
    const { user } = useAuth();
    const [files, setFiles] = useState([]);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    useEffect(() => {
        fetchFiles();
    }, []);

    const fetchFiles = async () => {
        try {
            // Include token from auth context or local storage
            const token = JSON.parse(localStorage.getItem('user'))?.token;
            const res = await axios.get('http://localhost:5000/api/files', {
                headers: { Authorization: `Bearer ${token}` }
            });
            setFiles(res.data);
        } catch (error) {
            console.error('Error fetching files:', error);
        } finally {
            setLoading(false);
        }
    };

    const container = {
        hidden: { opacity: 0 },
        show: {
            opacity: 1,
            transition: { staggerChildren: 0.1 }
        }
    };

    const item = {
        hidden: { opacity: 0, y: 20 },
        show: { opacity: 1, y: 0 }
    };

    if (loading) {
        return (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[1, 2, 3].map(n => (
                    <div key={n} className="glass-card h-48 animate-pulse p-6">
                        <div className="h-6 bg-primary/20 rounded w-1/3 mb-4"></div>
                        <div className="h-4 bg-muted/20 rounded w-1/2 mb-2"></div>
                        <div className="h-4 bg-muted/20 rounded w-full mb-8"></div>
                        <div className="h-10 bg-primary/20 rounded w-full mt-auto"></div>
                    </div>
                ))}
            </div>
        );
    }

    return (
        <div className="pb-10">
            <div className="mb-8 flex justify-between items-end">
                <div>
                    <h2 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-indigo-600">
                        {user.role} Dashboard
                    </h2>
                    <p className="text-muted-foreground mt-2">
                        Manage and monitor scheduled examination papers securely.
                    </p>
                </div>
            </div>

            {files.length === 0 ? (
                <div className="glass-card flex flex-col items-center justify-center p-12 text-center text-muted-foreground">
                    <FileText size={48} className="mb-4 text-primary/40" />
                    <p className="text-lg font-medium">No files accessible at the moment.</p>
                    {user.role === 'Coordinator' && (
                        <button onClick={() => navigate('/upload')} className="glass-button mt-4">
                            Upload a Paper
                        </button>
                    )}
                </div>
            ) : (
                <motion.div 
                    variants={container}
                    initial="hidden"
                    animate="show"
                    className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
                >
                    {files.map(file => {
                        const examDate = new Date(file.examTime);
                        const isUnlocked = isPast(examDate);

                        return (
                            <motion.div key={file._id} variants={item} className="glass-card group overflow-hidden flex flex-col">
                                <div className="p-6 flex-1">
                                    <div className="flex justify-between items-start mb-4">
                                        <div className="p-3 bg-gradient-to-br from-indigo-500/10 to-purple-500/10 rounded-xl text-primary">
                                            {isUnlocked ? <Unlock size={24} /> : <Lock size={24} />}
                                        </div>
                                        <span className={`px-3 py-1 text-xs font-medium rounded-full border ${isUnlocked ? 'bg-green-500/10 text-green-600 border-green-500/20' : 'bg-orange-500/10 text-orange-600 border-orange-500/20'}`}>
                                            {isUnlocked ? 'Available' : 'Locked'}
                                        </span>
                                    </div>
                                    
                                    <h3 className="text-xl font-bold mb-1 truncate" title={file.originalName}>
                                        {file.originalName.replace('.pdf', '')}
                                    </h3>
                                    
                                    <div className="space-y-2 mt-4 text-sm text-muted-foreground">
                                        <div className="flex items-center gap-2">
                                            <Clock size={16} />
                                            <span>{format(examDate, "PPp")}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <AlertCircle size={16} />
                                            <span>Requires {file.requiredShares} keys to decrypt</span>
                                        </div>
                                    </div>
                                </div>
                                
                                <div className="px-6 py-4 bg-muted/30 border-t border-border mt-auto">
                                    <button 
                                        onClick={() => navigate(`/decrypt/${file._id}`)}
                                        className={`w-full glass-button justify-center ${!isUnlocked && user.role !== 'Coordinator' ? 'opacity-50 cursor-not-allowed' : ''}`}
                                        disabled={!isUnlocked && user.role !== 'Coordinator'}
                                        title={!isUnlocked ? 'Available after exam time begins' : ''}
                                    >
                                        {user.role === 'Coordinator' ? 'View Status' : 'Provide Key & Decrypt'}
                                    </button>
                                </div>
                            </motion.div>
                        );
                    })}
                </motion.div>
            )}
        </div>
    );
}
