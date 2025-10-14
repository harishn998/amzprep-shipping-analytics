import React, { createContext, useState, useEffect, useContext } from 'react';
import { jwtDecode } from 'jwt-decode';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);  // ← Start as true

  // Check localStorage on mount
  useEffect(() => {
    console.log('🔍 AuthContext: Checking for stored token...');
    const token = localStorage.getItem('authToken');

    if (token) {
      try {
        const decoded = jwtDecode(token);

        // Check if token is expired
        if (decoded.exp * 1000 > Date.now()) {
          setUser(decoded);
          console.log('✅ User authenticated from stored token:', decoded.email);
        } else {
          console.log('⚠️ Token expired, clearing');
          localStorage.removeItem('authToken');
        }
      } catch (error) {
        console.error('❌ Invalid token:', error);
        localStorage.removeItem('authToken');
      }
    } else {
      console.log('ℹ️ No token found in localStorage');
    }

    setLoading(false);  // ← Done checking
    console.log('✅ AuthContext: Finished loading');
  }, []); // Run only once on mount

  const login = (newToken) => {
    console.log('🔑 Login: Storing token');
    localStorage.setItem('authToken', newToken);

    try {
      const decoded = jwtDecode(newToken);
      setUser(decoded);  // ← Set user immediately
      console.log('✅ User logged in:', decoded.email);
    } catch (error) {
      console.error('❌ Error decoding token:', error);
    }
  };

  const logout = () => {
    console.log('🚪 Logout: Clearing token');
    localStorage.removeItem('authToken');
    setUser(null);
  };

  const getAuthHeader = () => {
    const token = localStorage.getItem('authToken');
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  const value = {
    user,
    login,
    logout,
    loading,
    getAuthHeader,
    isAuthenticated: !!user
  };

  console.log('🔄 AuthContext render:', {
    isAuthenticated: !!user,
    loading,
    userEmail: user?.email
  });

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
