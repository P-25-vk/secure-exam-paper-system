import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

const AuthContext = createContext();
export const useAuth = () => useContext(AuthContext);
const API = 'http://localhost:5000/api';

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const storedUser = localStorage.getItem('secureExamUser');
        if (storedUser) {
            try { setUser(JSON.parse(storedUser)); }
            catch { localStorage.removeItem('secureExamUser'); }
        }
        setLoading(false);
    }, []);

    const persist = (data) => {
        setUser(data);
        localStorage.setItem('secureExamUser', JSON.stringify(data));
    };

    const login = async (email, password) => {
        try {
            const res = await axios.post(`${API}/auth/login`, { email, password });
            persist(res.data);
            return { success: true };
        } catch (error) {
            return { success: false, message: error.response?.data?.message || 'Login failed' };
        }
    };

    const logout = async () => {
        try {
            if (user?.token) await axios.post(`${API}/auth/logout`, {}, { headers: { Authorization: `Bearer ${user.token}` } });
        } catch { /* silent */ }
        setUser(null);
        localStorage.removeItem('secureExamUser');
    };

    const clearMustChangePassword = () => {
        setUser(prev => {
            if (!prev) return prev;
            const updated = { ...prev, mustChangePassword: false };
            localStorage.setItem('secureExamUser', JSON.stringify(updated));
            return updated;
        });
    };

    const getToken = () => user?.token || '';

    return (
        <AuthContext.Provider value={{ user, login, logout, loading, getToken, clearMustChangePassword }}>
            {children}
        </AuthContext.Provider>
    );
};
