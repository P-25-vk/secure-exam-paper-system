import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ShieldCheck } from 'lucide-react';

/**
 * KeySetupPage is no longer needed — all key management is server-side.
 * This page auto-redirects to the user's dashboard.
 */
export default function KeySetupPage() {
    const { user } = useAuth();
    const navigate = useNavigate();

    useEffect(() => {
        const timer = setTimeout(() => {
            if (user?.role === 'Coordinator') navigate('/coordinator', { replace: true });
            else if (user?.role === 'HOD') navigate('/hod', { replace: true });
            else navigate('/staff', { replace: true });
        }, 1500);
        return () => clearTimeout(timer);
    }, [user, navigate]);

    return (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center">
            <div className="text-center">
                <div className="w-20 h-20 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                    <ShieldCheck size={40} className="text-emerald-400" />
                </div>
                <h2 className="text-2xl font-bold text-slate-100">Keys Managed by Server</h2>
                <p className="text-slate-400 text-sm mt-2">All cryptographic keys are managed securely on the server.<br/>Redirecting to your dashboard...</p>
            </div>
        </div>
    );
}
