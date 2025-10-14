import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Login from './pages/Login';
import AuthCallback from './pages/AuthCallback';
import App from './App.jsx';  // Your existing ShippingAnalytics component
import './index.css';

// ============================================
// PROTECTED ROUTE COMPONENT
// ============================================
// This component wraps routes that require authentication
// If user is not logged in, redirects to /login
// If user is logged in, shows the requested page

const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();

  console.log('🛡️ ProtectedRoute check:', { isAuthenticated, loading });

  // IMPORTANT: Show loading while checking auth
  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0e1a] flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-blue-500 mb-4"></div>
          <div className="text-white text-xl font-semibold">Loading...</div>
          <div className="text-gray-400 text-sm mt-2">Checking authentication</div>
        </div>
      </div>
    );
  }

  // Only redirect after loading is complete
  if (!isAuthenticated) {
    console.log('❌ Not authenticated, redirecting to login');
    return <Navigate to="/login" replace />;
  }

  console.log('✅ Authenticated, rendering protected content');
  return children;
};


// ============================================
// APP ROUTER COMPONENT
// ============================================
// Defines all routes in the application

function AppRouter() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public Route: Login Page */}
          <Route path="/login" element={<Login />} />

          {/* Public Route: OAuth Callback Handler */}
          <Route path="/auth/callback" element={<AuthCallback />} />

          {/* Protected Route: Main Dashboard */}
          {/* All paths (/*) go through ProtectedRoute check */}
          <Route
            path="/*"
            element={
              <ProtectedRoute>
                <App />
              </ProtectedRoute>
            }
          />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}


// ============================================
// RENDER APPLICATION
// ============================================
// Mount the app to the DOM

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AppRouter />
  </React.StrictMode>
);
