import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { CheckCircle, XCircle, Loader } from 'lucide-react';

const AuthCallback = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { login } = useAuth();
  const [status, setStatus] = useState('processing'); // 'processing', 'success', 'error'
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    // Extract token and error from URL query parameters
    const token = searchParams.get('token');
    const error = searchParams.get('error');

    console.log('=== Auth Callback Started ===');
    console.log('Token present:', !!token);
    console.log('Error:', error);

    // Give user visual feedback
    setTimeout(() => {
      if (token) {
        handleSuccessfulAuth(token);
      } else if (error) {
        handleAuthError(error);
      } else {
        handleUnknownError();
      }
    }, 500); // Small delay for better UX

  }, [searchParams]);

  // Handle successful authentication
  const handleSuccessfulAuth = (token) => {
    try {
      console.log('Processing token...');

      // Save token and log user in
      login(token);

      console.log('Token saved, user logged in');
      setStatus('success');

      // Redirect to dashboard after brief success message
      setTimeout(() => {
        console.log('Redirecting to dashboard...');
        navigate('/', { replace: true });
      }, 1000);

    } catch (error) {
      console.error('Error processing token:', error);
      setStatus('error');
      setErrorMessage('Failed to process authentication token');

      setTimeout(() => {
        navigate('/login?error=token_processing_failed', { replace: true });
      }, 2000);
    }
  };

  // Handle authentication errors
  const handleAuthError = (error) => {
    console.error('Authentication error:', error);
    setStatus('error');

    // Map error codes to user-friendly messages
    const errorMessages = {
      'auth_failed': 'Authentication failed. Please try again.',
      'access_denied': 'Access was denied. Please grant the necessary permissions.',
      'invalid_credentials': 'Invalid credentials provided.',
      'domain_not_authorized': 'Your email domain is not authorized to access this application.',
      'unknown': 'An unknown error occurred during authentication.'
    };

    setErrorMessage(errorMessages[error] || errorMessages['unknown']);

    // Redirect to login with error after showing message
    setTimeout(() => {
      navigate(`/login?error=${error}`, { replace: true });
    }, 3000);
  };

  // Handle case where no token or error is present
  const handleUnknownError = () => {
    console.error('No token or error found in callback URL');
    setStatus('error');
    setErrorMessage('Invalid authentication response');

    setTimeout(() => {
      navigate('/login?error=invalid_callback', { replace: true });
    }, 2000);
  };

  // Render different UI based on status
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a0e1a] via-[#1a1f2e] to-[#0a0e1a] flex items-center justify-center p-6">
      <div className="bg-[#1a1f2e]/80 backdrop-blur-xl rounded-3xl p-12 border border-gray-700/50 shadow-2xl max-w-md w-full">

        {/* Processing State */}
        {status === 'processing' && (
          <div className="text-center">
            <div className="bg-blue-500/20 rounded-full w-24 h-24 flex items-center justify-center mx-auto mb-6 relative">
              <div className="absolute inset-0 rounded-full border-4 border-blue-500/30 border-t-blue-500 animate-spin"></div>
              <Loader className="text-blue-400" size={40} />
            </div>
            <h2 className="text-2xl font-bold text-white mb-3">Processing Login</h2>
            <p className="text-gray-400 text-lg">
              Please wait while we complete your authentication...
            </p>
            <div className="mt-6 flex justify-center gap-2">
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"></div>
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
            </div>
          </div>
        )}

        {/* Success State */}
        {status === 'success' && (
          <div className="text-center">
            <div className="bg-green-500/20 rounded-full w-24 h-24 flex items-center justify-center mx-auto mb-6">
              <CheckCircle className="text-green-400" size={48} />
            </div>
            <h2 className="text-2xl font-bold text-white mb-3">Login Successful!</h2>
            <p className="text-gray-400 text-lg">
              Redirecting you to the dashboard...
            </p>
            <div className="mt-6">
              <div className="w-full bg-gray-700 rounded-full h-2 overflow-hidden">
                <div className="h-full bg-gradient-to-r from-green-500 to-blue-500 animate-progress"></div>
              </div>
            </div>
          </div>
        )}

        {/* Error State */}
        {status === 'error' && (
          <div className="text-center">
            <div className="bg-red-500/20 rounded-full w-24 h-24 flex items-center justify-center mx-auto mb-6">
              <XCircle className="text-red-400" size={48} />
            </div>
            <h2 className="text-2xl font-bold text-white mb-3">Authentication Failed</h2>
            <p className="text-red-400 text-lg mb-4">
              {errorMessage}
            </p>
            <p className="text-gray-400 text-sm">
              Redirecting you back to the login page...
            </p>
            <div className="mt-6">
              <div className="w-full bg-gray-700 rounded-full h-2 overflow-hidden">
                <div className="h-full bg-red-500 animate-progress"></div>
              </div>
            </div>
          </div>
        )}

      </div>

      {/* Custom Animations */}
      <style>{`
        @keyframes progress {
          0% {
            width: 0%;
          }
          100% {
            width: 100%;
          }
        }
        .animate-progress {
          animation: progress 1s ease-out forwards;
        }
      `}</style>
    </div>
  );
};

export default AuthCallback;
