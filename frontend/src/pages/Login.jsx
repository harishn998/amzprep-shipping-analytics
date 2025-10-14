import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { LogIn, ShieldCheck, TrendingUp, FileText, Package } from 'lucide-react';
import amzprepLogo from '../assets/amz-prep-logo-resized.png';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
const AUTH_URL = import.meta.env.VITE_AUTH_URL || 'http://localhost:5000';

const Login = () => {
  const [searchParams] = useSearchParams();
  const error = searchParams.get('error');

  const handleGoogleLogin = () => {
    console.log('Redirecting to Google OAuth...');
    window.location.href = `${AUTH_URL}/auth/google`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="max-w-6xl w-full bg-white rounded-2xl shadow-2xl overflow-hidden">
        <div className="grid md:grid-cols-2 gap-0">
          {/* Left Side - Branding */}
          <div className="bg-gradient-to-br from-blue-600 to-indigo-700 p-12 text-white flex flex-col justify-center">
            <div className="mb-8">
              <img
                src={amzprepLogo}
                alt="AMZ Prep Logo"
                className="h-16 w-auto mb-4"
              />
              <h1 className="text-4xl font-bold mb-2">
                AMZ Prep
              </h1>
              <p className="text-xl text-blue-100">
                Shipping Analytics
              </p>
            </div>

            <h2 className="text-2xl font-semibold mb-4">
              Transform Your Shipping Data Into Insights
            </h2>
            <p className="text-blue-100 mb-8">
              Advanced analytics and warehouse optimization tools to reduce costs and improve delivery times.
            </p>

            {/* Features */}
            <div className="space-y-4">
              <div className="flex items-center space-x-3">
                <TrendingUp className="h-6 w-6" />
                <span>Real-time shipping analytics & insights</span>
              </div>
              <div className="flex items-center space-x-3">
                <FileText className="h-6 w-6" />
                <span>Professional PDF reports & exports</span>
              </div>
              <div className="flex items-center space-x-3">
                <Package className="h-6 w-6" />
                <span>Warehouse optimization recommendations</span>
              </div>
            </div>
          </div>

          {/* Right Side - Login Card */}
          <div className="p-12 flex flex-col justify-center">
            <div className="mb-8">
              <h2 className="text-3xl font-bold text-gray-900 mb-2">
                Welcome Back
              </h2>
              <p className="text-gray-600">
                Sign in to access your analytics dashboard
              </p>
            </div>

            {/* Error Message */}
            {error && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
                {error === 'auth_failed' ? 'Authentication failed. Please try again.' : 'An error occurred. Please try again.'}
              </div>
            )}

            {/* Google Sign-In Button */}
            <button
              onClick={handleGoogleLogin}
              className="w-full bg-white border-2 border-gray-300 text-gray-700 font-semibold py-4 px-6 rounded-lg hover:bg-gray-50 hover:border-gray-400 transition-all duration-200 flex items-center justify-center space-x-3 shadow-sm hover:shadow-md"
            >
              <svg className="h-6 w-6" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              <span>Continue with Google</span>
            </button>

            <div className="mt-6 flex items-center justify-center space-x-2 text-sm text-gray-500">
              <ShieldCheck className="h-4 w-4" />
              <span>Secure authentication powered by Google</span>
            </div>

            <div className="mt-8 text-center text-sm text-gray-500">
              <a href="#" className="hover:text-gray-700">Terms</a>
              {' • '}
              <a href="#" className="hover:text-gray-700">Privacy</a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
