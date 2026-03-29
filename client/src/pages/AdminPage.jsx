import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';
import {
    Users, Plus, Trash2, ToggleLeft, ToggleRight, Shield, ClipboardList,
    BarChart2, ArrowLeft, CheckCircle, AlertCircle, Search, Filter, X,
    RefreshCw, Clock, UserCheck, UserX, FileText
} from 'lucide-react';

const API = 'http://localhost:5000/api';

const ACTION_COLORS = {
    LOGIN_SUCCESS: 'text-emerald-400 bg-emerald-500/10', LOGIN_FAILURE: 'text-red-400 bg-red-500/10',
    LOGOUT: 'text-slate-400 bg-slate-700/50', PAPER_UPLOAD: 'text-violet-400 bg-violet-500/10',
    KEY_ACCESS: 'text-amber-400 bg-amber-500/10', DECRYPT_SUCCESS: 'text-cyan-400 bg-cyan-500/10',
    DECRYPT_FAILURE: 'text-red-400 bg-red-500/10', DECRYPT_ATTEMPT: 'text-orange-400 bg-orange-500/10',
    USER_CREATED: 'text-emerald-400 bg-emerald-500/10', USER_DELETED: 'text-red-400 bg-red-500/10',
    USER_DEACTIVATED: 'text-orange-400 bg-orange-500/10', USER_ACTIVATED: 'text-emerald-400 bg-emerald-500/10',
};

export default function AdminPage() {
    const { getToken } = useAuth();
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState('users');
    const [toast, setToast] = useState(null);
    const [createdUserInfo, setCreatedUserInfo] = useState(null);  // shown after user creation

    // Users
    const [users, setUsers] = useState([]);
    const [usersLoading, setUsersLoading] = useState(true);
    const [showAddUser, setShowAddUser] = useState(false);
    const [newUser, setNewUser] = useState({ name: '', email: '', password: '', role: 'Staff', department: 'Computer Science' });
    const [addingUser, setAddingUser] = useState(false);

    // Audit Logs
    const [logs, setLogs] = useState([]);
    const [logsLoading, setLogsLoading] = useState(false);
    const [logPage, setLogPage] = useState(1);
    const [logTotal, setLogTotal] = useState(0);
    const [logPages, setLogPages] = useState(1);
    const [logFilter, setLogFilter] = useState('');

    // Stats
    const [stats, setStats] = useState(null);

    const showToast = (msg, type = 'success') => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 3500);
    };

    const headers = { Authorization: `Bearer ${getToken()}` };

    useEffect(() => { fetchUsers(); fetchStats(); }, []);
    useEffect(() => { if (activeTab === 'logs') fetchLogs(); }, [activeTab, logPage, logFilter]);

    const fetchUsers = async () => {
        setUsersLoading(true);
        try {
            const res = await axios.get(`${API}/admin/users`, { headers });
            setUsers(res.data);
        } catch (e) { showToast(e.response?.data?.message || 'Failed to load users', 'error'); }
        finally { setUsersLoading(false); }
    };

    const fetchLogs = async () => {
        setLogsLoading(true);
        try {
            const params = { page: logPage, limit: 20 };
            if (logFilter) params.action = logFilter;
            const res = await axios.get(`${API}/admin/audit-logs`, { headers, params });
            setLogs(res.data.logs);
            setLogTotal(res.data.total);
            setLogPages(res.data.pages);
        } catch (e) { showToast('Failed to load logs', 'error'); }
        finally { setLogsLoading(false); }
    };

    const fetchStats = async () => {
        try {
            const res = await axios.get(`${API}/admin/stats`, { headers });
            setStats(res.data);
        } catch (e) { /* silent */ }
    };

    const handleAddUser = async (e) => {
        e.preventDefault();
        setAddingUser(true);
        const tempPassword = newUser.password;  // remember before clearing form
        try {
            await axios.post(`${API}/admin/users`, newUser, { headers });
            setCreatedUserInfo({ name: newUser.name, email: newUser.email, role: newUser.role, tempPassword });
            setNewUser({ name: '', email: '', password: '', role: 'Staff', department: 'Computer Science' });
            setShowAddUser(false);
            fetchUsers();
        } catch (e) { showToast(e.response?.data?.message || 'Failed to create user', 'error'); }
        finally { setAddingUser(false); }
    };

    const handleToggle = async (userId) => {
        try {
            const res = await axios.patch(`${API}/admin/users/${userId}/toggle`, {}, { headers });
            showToast(res.data.message);
            fetchUsers();
        } catch (e) { showToast(e.response?.data?.message || 'Action failed', 'error'); }
    };

    const handleDelete = async (userId, name) => {
        if (!window.confirm(`Delete user "${name}"? This action cannot be undone.`)) return;
        try {
            await axios.delete(`${API}/admin/users/${userId}`, { headers });
            showToast('User deleted.');
            fetchUsers();
        } catch (e) { showToast(e.response?.data?.message || 'Delete failed', 'error'); }
    };

    const ROLE_COLORS = { HOD: 'text-amber-400 bg-amber-500/10 border-amber-500/20', Coordinator: 'text-violet-400 bg-violet-500/10 border-violet-500/20', Staff: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20' };
    const ACTION_LABELS = ['', 'LOGIN_SUCCESS', 'LOGIN_FAILURE', 'LOGOUT', 'PAPER_UPLOAD', 'KEY_ACCESS', 'DECRYPT_ATTEMPT', 'DECRYPT_SUCCESS', 'DECRYPT_FAILURE', 'USER_CREATED', 'USER_DELETED', 'USER_DEACTIVATED', 'USER_ACTIVATED'];

    return (
        <div className="max-w-6xl mx-auto">
            {/* Toast */}
            <AnimatePresence>
                {toast && (
                    <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
                        className={`fixed top-4 right-4 z-50 px-5 py-3 rounded-xl flex items-center gap-3 shadow-2xl text-sm font-semibold border ${toast.type === 'error' ? 'bg-red-900/90 border-red-500/30 text-red-300' : 'bg-emerald-900/90 border-emerald-500/30 text-emerald-300'}`}>
                        {toast.type === 'error' ? <AlertCircle size={16} /> : <CheckCircle size={16} />} {toast.msg}
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Header */}
            <div className="flex items-center gap-4 mb-8">
                <button onClick={() => navigate('/hod')} className="p-2 bg-slate-800 hover:bg-slate-700 rounded-xl text-slate-400 hover:text-slate-200 transition-colors"><ArrowLeft size={18} /></button>
                <div>
                    <div className="flex items-center gap-2 mb-1"><Shield size={16} className="text-amber-400" /><span className="text-xs font-semibold text-amber-400 uppercase tracking-widest">HOD Admin Panel</span></div>
                    <h1 className="text-3xl font-bold text-slate-100">System Administration</h1>
                </div>
            </div>

            {/* Stats row */}
            {stats && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
                    {[
                        { label: 'Active Users', value: stats.totalUsers, icon: Users, color: 'text-cyan-400' },
                        { label: 'Total Papers', value: stats.totalPapers, icon: FileText, color: 'text-violet-400' },
                        { label: 'Audit Events', value: stats.totalLogs, icon: ClipboardList, color: 'text-amber-400' },
                        { label: 'Security Score', value: '100%', icon: Shield, color: 'text-emerald-400' },
                    ].map(s => (
                        <div key={s.label} className="bg-slate-900/80 border border-slate-700/50 rounded-2xl p-4">
                            <s.icon size={18} className={`${s.color} mb-2`} />
                            <p className="text-2xl font-bold text-slate-100">{s.value}</p>
                            <p className="text-xs text-slate-500 mt-0.5">{s.label}</p>
                        </div>
                    ))}
                </div>
            )}

            {/* Tabs */}
            <div className="flex gap-1 mb-6 bg-slate-900/60 p-1 rounded-xl border border-slate-700/50 w-fit">
                {[{ id: 'users', label: 'User Management', icon: Users }, { id: 'logs', label: 'Audit Logs', icon: ClipboardList }].map(tab => (
                    <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                        className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all ${activeTab === tab.id ? 'bg-slate-700 text-slate-100 shadow' : 'text-slate-500 hover:text-slate-300'}`}>
                        <tab.icon size={15} />{tab.label}
                    </button>
                ))}
            </div>

            {/* USERS TAB */}
            {activeTab === 'users' && (
                <div>
                    <div className="flex items-center justify-between mb-4">
                        <p className="text-sm text-slate-400">{users.length} total user(s)</p>
                        <button onClick={() => setShowAddUser(true)}
                            className="flex items-center gap-2 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-white px-4 py-2.5 rounded-xl text-sm font-semibold shadow-lg shadow-amber-500/20 transition-all">
                            <Plus size={16} /> Add User
                        </button>
                    </div>

                    {/* Temp password reveal banner */}
                    <AnimatePresence>
                        {createdUserInfo && (
                            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                                className="bg-emerald-900/30 border border-emerald-500/30 rounded-2xl p-5 mb-4">
                                <div className="flex items-start justify-between">
                                    <div className="flex items-start gap-3">
                                        <CheckCircle size={20} className="text-emerald-400 mt-0.5 flex-shrink-0" />
                                        <div>
                                            <p className="font-semibold text-emerald-300 text-sm">User Created — Share These Credentials Securely</p>
                                            <p className="text-xs text-emerald-400/70 mt-0.5">The user must change their password on first login.</p>
                                        </div>
                                    </div>
                                    <button onClick={() => setCreatedUserInfo(null)} className="text-slate-500 hover:text-slate-300 ml-3"><X size={16} /></button>
                                </div>
                                <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
                                    {[
                                        { label: 'Name', value: createdUserInfo.name },
                                        { label: 'Email', value: createdUserInfo.email },
                                        { label: 'Role', value: createdUserInfo.role },
                                    ].map(item => (
                                        <div key={item.label} className="bg-slate-900/60 rounded-xl p-3">
                                            <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">{item.label}</p>
                                            <p className="text-sm font-semibold text-slate-200">{item.value}</p>
                                        </div>
                                    ))}
                                </div>
                                <div className="mt-3 bg-slate-900/60 rounded-xl p-3">
                                    <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Temporary Password (share this with the user)</p>
                                    <div className="flex items-center justify-between gap-3">
                                        <code className="text-sm font-mono font-bold text-amber-300">{createdUserInfo.tempPassword}</code>
                                        <button onClick={() => navigator.clipboard.writeText(createdUserInfo.tempPassword)}
                                            className="text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1 px-2 py-1 bg-slate-800 rounded-lg">
                                            <CheckCircle size={11} /> Copy
                                        </button>
                                    </div>
                                </div>
                                <p className="mt-3 text-xs text-amber-400/80 flex items-start gap-1.5">
                                    <AlertCircle size={12} className="mt-0.5 flex-shrink-0" />
                                    Share this password privately. The user will be forced to replace it before accessing any features.
                                </p>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Add User Form */}
                    <AnimatePresence>
                        {showAddUser && (
                            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                                className="bg-slate-900/80 border border-slate-700/50 rounded-2xl overflow-hidden mb-4">
                                <div className="p-5">
                                    <div className="flex items-center justify-between mb-4">
                                        <h3 className="font-semibold text-slate-200">Create New User</h3>
                                        <button onClick={() => setShowAddUser(false)} className="text-slate-500 hover:text-slate-300"><X size={18} /></button>
                                    </div>
                                    <form onSubmit={handleAddUser} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        {[
                                            { label: 'Full Name', key: 'name', type: 'text', placeholder: 'Dr. Jane Smith' },
                                            { label: 'Email', key: 'email', type: 'email', placeholder: 'jane@exam.edu' },
                                            { label: 'Password', key: 'password', type: 'password', placeholder: 'Min 8 chars' },
                                            { label: 'Department', key: 'department', type: 'text', placeholder: 'Computer Science' },
                                        ].map(f => (
                                            <div key={f.key}>
                                                <label className="text-xs font-semibold text-slate-400 mb-1 block">{f.label}</label>
                                                <input type={f.type} value={newUser[f.key]} onChange={e => setNewUser(p => ({ ...p, [f.key]: e.target.value }))}
                                                    placeholder={f.placeholder} required={f.key !== 'department'}
                                                    className="w-full bg-slate-800/80 border border-slate-700 rounded-xl py-2.5 px-3 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-amber-500/50 transition-all" />
                                            </div>
                                        ))}
                                        <div>
                                            <label className="text-xs font-semibold text-slate-400 mb-1 block">Role</label>
                                            <select value={newUser.role} onChange={e => setNewUser(p => ({ ...p, role: e.target.value }))}
                                                className="w-full bg-slate-800/80 border border-slate-700 rounded-xl py-2.5 px-3 text-sm text-slate-100 focus:outline-none focus:border-amber-500/50 transition-all">
                                                <option value="Staff">Staff</option>
                                                <option value="Coordinator">Coordinator (Question Setter)</option>
                                                <option value="HOD">HOD</option>
                                            </select>
                                        </div>
                                        <div className="sm:col-span-2">
                                            <button type="submit" disabled={addingUser}
                                                className="bg-amber-600 hover:bg-amber-500 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors disabled:opacity-60 flex items-center gap-2">
                                                {addingUser ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Plus size={16} />}
                                                Create User
                                            </button>
                                        </div>
                                    </form>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Users Table */}
                    {usersLoading ? (
                        <div className="space-y-3">{[1,2,3].map(n => <div key={n} className="bg-slate-800/40 rounded-xl h-16 animate-pulse" />)}</div>
                    ) : (
                        <div className="bg-slate-900/80 border border-slate-700/50 rounded-2xl overflow-hidden">
                            <table className="w-full">
                                <thead className="border-b border-slate-700/50">
                                    <tr className="text-left text-xs text-slate-500 uppercase tracking-widest">
                                        {['Name / Email', 'Role', 'Department', 'Status', 'Last Login', 'Actions'].map(h => (
                                            <th key={h} className="px-4 py-3 font-semibold">{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-700/30">
                                    {users.map(u => (
                                        <tr key={u._id} className="hover:bg-slate-800/30 transition-colors">
                                            <td className="px-4 py-3">
                                                <p className="text-sm font-semibold text-slate-200">{u.name}</p>
                                                <p className="text-xs text-slate-500">{u.email}</p>
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${ROLE_COLORS[u.role]}`}>{u.role}</span>
                                            </td>
                                            <td className="px-4 py-3 text-xs text-slate-400">{u.department}</td>
                                            <td className="px-4 py-3">
                                                <span className={`text-xs font-semibold flex items-center gap-1 ${u.isActive ? 'text-emerald-400' : 'text-red-400'}`}>
                                                    {u.isActive ? <UserCheck size={12} /> : <UserX size={12} />}
                                                    {u.isActive ? 'Active' : 'Inactive'}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-xs text-slate-500">{u.lastLogin ? format(new Date(u.lastLogin), 'MMM d, HH:mm') : 'Never'}</td>
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-2">
                                                    <button onClick={() => handleToggle(u._id)} title={u.isActive ? 'Deactivate' : 'Activate'}
                                                        className={`p-1.5 rounded-lg transition-colors ${u.isActive ? 'text-orange-400 hover:bg-orange-500/10' : 'text-emerald-400 hover:bg-emerald-500/10'}`}>
                                                        {u.isActive ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
                                                    </button>
                                                    <button onClick={() => handleDelete(u._id, u.name)} title="Delete User"
                                                        className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors">
                                                        <Trash2 size={16} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {/* AUDIT LOGS TAB */}
            {activeTab === 'logs' && (
                <div>
                    <div className="flex flex-wrap items-center gap-3 mb-4">
                        <div className="flex items-center gap-2 text-xs text-slate-500"><ClipboardList size={14} />{logTotal} total events</div>
                        <div className="flex-1" />
                        <select value={logFilter} onChange={e => { setLogFilter(e.target.value); setLogPage(1); }}
                            className="bg-slate-800/80 border border-slate-700 rounded-xl py-2 px-3 text-xs text-slate-300 focus:outline-none focus:border-amber-500/50 transition-all">
                            <option value="">All Actions</option>
                            {ACTION_LABELS.filter(Boolean).map(a => <option key={a} value={a}>{a.replace(/_/g, ' ')}</option>)}
                        </select>
                        <button onClick={fetchLogs} className="p-2 bg-slate-800 hover:bg-slate-700 rounded-xl text-slate-400 transition-colors"><RefreshCw size={14} /></button>
                    </div>

                    {logsLoading ? (
                        <div className="space-y-2">{[...Array(5)].map((_, i) => <div key={i} className="bg-slate-800/40 rounded-xl h-12 animate-pulse" />)}</div>
                    ) : (
                        <>
                            <div className="bg-slate-900/80 border border-slate-700/50 rounded-2xl overflow-hidden">
                                <table className="w-full text-sm">
                                    <thead className="border-b border-slate-700/50">
                                        <tr className="text-left text-xs text-slate-500 uppercase tracking-widest">
                                            {['Time', 'User', 'Action', 'Resource', 'Status', 'IP'].map(h => (
                                                <th key={h} className="px-4 py-3 font-semibold">{h}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-700/20">
                                        {logs.length === 0 ? (
                                            <tr><td colSpan={6} className="text-center py-10 text-slate-600">No audit logs found</td></tr>
                                        ) : logs.map(log => (
                                            <tr key={log._id} className="hover:bg-slate-800/20 transition-colors">
                                                <td className="px-4 py-2.5 text-xs text-slate-500 whitespace-nowrap">{format(new Date(log.createdAt), 'MMM d, HH:mm:ss')}</td>
                                                <td className="px-4 py-2.5">
                                                    <p className="text-xs font-medium text-slate-300">{log.userName}</p>
                                                    <p className="text-xs text-slate-600">{log.userRole}</p>
                                                </td>
                                                <td className="px-4 py-2.5">
                                                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${ACTION_COLORS[log.action] || 'text-slate-400 bg-slate-700/50'}`}>
                                                        {log.action.replace(/_/g, ' ')}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-2.5 text-xs text-slate-500 max-w-[150px] truncate">{log.resourceName || '—'}</td>
                                                <td className="px-4 py-2.5">
                                                    <span className={`text-xs font-semibold ${log.status === 'SUCCESS' ? 'text-emerald-400' : log.status === 'FAILURE' ? 'text-red-400' : 'text-amber-400'}`}>{log.status}</span>
                                                </td>
                                                <td className="px-4 py-2.5 text-xs text-slate-600 font-mono">{log.ipAddress || '—'}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {/* Pagination */}
                            {logPages > 1 && (
                                <div className="flex items-center justify-center gap-3 mt-4">
                                    <button onClick={() => setLogPage(p => Math.max(1, p-1))} disabled={logPage === 1}
                                        className="px-3 py-1.5 rounded-lg text-sm bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-40 transition-colors">Prev</button>
                                    <span className="text-xs text-slate-500">Page {logPage} of {logPages}</span>
                                    <button onClick={() => setLogPage(p => Math.min(logPages, p+1))} disabled={logPage === logPages}
                                        className="px-3 py-1.5 rounded-lg text-sm bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-40 transition-colors">Next</button>
                                </div>
                            )}
                        </>
                    )}
                </div>
            )}
        </div>
    );
}
