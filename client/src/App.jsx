import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import CoordinatorDashboard from './pages/CoordinatorDashboard';
import StaffDashboard from './pages/StaffDashboard';
import HODDashboard from './pages/HODDashboard';
import UploadPage from './pages/UploadPage';
import DecryptPage from './pages/DecryptPage';
import AdminPage from './pages/AdminPage';
import ChangePasswordPage from './pages/ChangePasswordPage';
import Navbar from './components/Navbar';
import { AuthProvider, useAuth } from './context/AuthContext';

// ─── Guards ───────────────────────────────────────────────────────────────────

const ProtectedRoute = ({ children, allowedRoles }) => {
    const { user, loading } = useAuth();
    if (loading) return (
        <div className="min-h-screen flex items-center justify-center bg-slate-950">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500" />
        </div>
    );
    if (!user) return <Navigate to="/login" replace />;
    // Priority 1: must change password
    if (user.mustChangePassword) return <Navigate to="/change-password" replace />;
    // Priority 2: role check
    if (allowedRoles && !allowedRoles.includes(user.role)) return <Navigate to="/" replace />;
    return children;
};

const RoleRouter = () => {
    const { user } = useAuth();
    if (!user) return <Navigate to="/login" replace />;
    if (user.mustChangePassword) return <Navigate to="/change-password" replace />;
    if (user.role === 'Coordinator') return <Navigate to="/coordinator" replace />;
    if (user.role === 'HOD') return <Navigate to="/hod" replace />;
    return <Navigate to="/staff" replace />;
};

// ─── App Layout ───────────────────────────────────────────────────────────────

const AppRoutes = () => {
    const { user } = useAuth();
    const showNav = user && !user.mustChangePassword;

    return (
        <div className="min-h-screen bg-slate-950 text-slate-100">
            {showNav && <Navbar />}
            <main className={showNav ? 'container mx-auto px-4 py-8' : ''}>
                <Routes>
                    <Route path="/login" element={<Login />} />
                    <Route path="/change-password" element={user ? <ChangePasswordPage /> : <Navigate to="/login" replace />} />

                    <Route path="/" element={<ProtectedRoute><RoleRouter /></ProtectedRoute>} />
                    <Route path="/coordinator" element={<ProtectedRoute allowedRoles={['Coordinator']}><CoordinatorDashboard /></ProtectedRoute>} />
                    <Route path="/upload"      element={<ProtectedRoute allowedRoles={['Coordinator']}><UploadPage /></ProtectedRoute>} />
                    <Route path="/staff"       element={<ProtectedRoute allowedRoles={['Staff']}><StaffDashboard /></ProtectedRoute>} />
                    <Route path="/hod"         element={<ProtectedRoute allowedRoles={['HOD']}><HODDashboard /></ProtectedRoute>} />
                    <Route path="/admin"       element={<ProtectedRoute allowedRoles={['HOD']}><AdminPage /></ProtectedRoute>} />
                    <Route path="/decrypt/:id" element={<ProtectedRoute allowedRoles={['Staff', 'HOD']}><DecryptPage /></ProtectedRoute>} />
                    <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
            </main>
        </div>
    );
};

export default function App() {
    return (
        <AuthProvider>
            <Router>
                <AppRoutes />
            </Router>
        </AuthProvider>
    );
}
