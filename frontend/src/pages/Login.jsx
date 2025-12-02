import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';
import loginCoverImg from '../assets/login-cover-img.png';
import amzprepLogo from '../assets/amzprep_white_logo.png';

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
    <div
      className="min-h-screen flex flex-col lg:flex-row"
      style={{
        background: 'linear-gradient(90deg, #000000 0%, #000000 39%, #091332 100%)'
      }}
    >

      {/* Left Side - Truck Background (60% width) */}
      <div
        className="lg:w-[60%] relative bg-cover bg-center flex items-center justify-center p-8 sm:p-12 lg:p-16 xl:p-20 lg:rounded-r-[3rem]"
        style={{ backgroundImage: `url(${loginCoverImg})` }}
      >
        {/* Light Dark Overlay for Text Visibility */}
        <div
          className="absolute inset-0 bg-black/40 lg:rounded-r-[3rem]">
        </div>

        {/* Content */}
        <div className="relative z-10 text-white max-w-2xl">
          <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl xl:text-6xl font-extrabold leading-tight tracking-tight mb-6 lg:mb-8">
            TRANSFORM<br />
            YOUR SHIPPING<br />
            DATA INTO<br />
            INSIGHTS
          </h1>

          <p className="text-sm sm:text-base lg:text-lg xl:text-xl text-gray-200 leading-relaxed font-light">
            Advanced analytics and warehouse optimization tools to reduce costs and improve delivery times.
          </p>
        </div>
      </div>

      {/* Right Side - Login Panel with Dark Gradient (40% width) - CENTER ALIGNED */}
      <div
        className="lg:w-[40%] flex items-center justify-center p-8 sm:p-10 lg:p-12 xl:p-16"
      >
        <div className="w-full max-w-md space-y-6 lg:space-y-8">

          {/* Logo - CENTER ALIGNED */}
          <div className="flex justify-center">
            <img
              src={amzprepLogo}
              alt="AMZ Prep Logo"
              className="h-10 sm:h-11 lg:h-12 w-auto"
            />
          </div>

          {/* Welcome Section - CENTER ALIGNED */}
          <div className="text-center">
            <h2 className="text-3xl sm:text-4xl lg:text-[2.75rem] font-bold text-white mb-3 lg:mb-4">
              Welcome Back
            </h2>
            <p className="text-sm sm:text-base lg:text-lg text-gray-400">
              Sign in to access your analytics dashboard
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="p-3 sm:p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400">
              <p className="text-sm font-medium text-center">
                {error === 'auth_failed' ? 'Authentication failed. Please try again.' : 'An error occurred. Please try again.'}
              </p>
            </div>
          )}

          {/* Google Sign-In Button */}
          <button
            onClick={handleGoogleLogin}
            className="w-full bg-transparent border-2 border-blue-500/50 text-white font-semibold py-3 sm:py-4 px-6 rounded-xl hover:border-blue-500 hover:bg-blue-500/5 transition-all duration-300 flex items-center justify-center space-x-3 group"
          >
            {/* Google "G" Logo SVG */}
            <svg className="h-5 w-5 sm:h-6 sm:w-6 transition-transform group-hover:scale-110" viewBox="0 0 24 24">
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
            <span className="text-sm sm:text-base font-medium">Continue with Google</span>
          </button>

          {/* Security Badge - CENTER ALIGNED */}
          <div className="flex items-center justify-center space-x-2 text-xs sm:text-sm text-gray-500">
            <ShieldCheck className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            <span>Secure authentication powered by Google</span>
          </div>

          {/* Footer Links - CENTER ALIGNED */}
          <div className="text-center text-xs sm:text-sm text-gray-500 space-x-1">
            <a href="#" className="hover:text-gray-300 transition-colors">Terms & Conditions</a>
            <span>•</span>
            <a href="#" className="hover:text-gray-300 transition-colors">Privacy</a>
          </div>

          {/* Footer Copyright - CENTER ALIGNED */}
          <div className="text-center text-xs text-gray-600 pt-2">
            <p>amzprep.com | @2025 All Rights Reserved</p>
          </div>
        </div>
      </div>

    </div>
  );
};

export default Login;
