import { createContext, useState, useEffect } from 'react';
import api from '../api/axios';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if user session exists in localStorage
    const checkLoggedIn = () => {
      try {
        const storedUser = localStorage.getItem('user');
        const token = localStorage.getItem('token');
        if (storedUser && token) {
          setUser(JSON.parse(storedUser));
        }
      } catch (err) {
        console.error('Failed to parse stored user:', err);
        localStorage.removeItem('user');
        localStorage.removeItem('token');
      }
      setLoading(false);
    };
    checkLoggedIn();
  }, []);

  const login = async (email, password) => {
    try {
      const res = await api.post('/auth/login', { email, password });
      setUser(res.data.user);
      localStorage.setItem('token', res.data.token);
      localStorage.setItem('user', JSON.stringify(res.data.user));
      return { success: true, user: res.data.user };
    } catch (err) {
      const data = err.response?.data || {};
      return {
        success: false,
        message: data.message || 'Login failed',
        unverified: data.unverified || false,
        email: data.email,
        maskedEmail: data.maskedEmail
      };
    }
  };

  /**
   * Stage A: Initiate signup with email validation and OTP dispatch
   */
  const initiateSignup = async (name, email, password, role) => {
    try {
      const res = await api.post('/auth/signup', { name, email, password, role });
      return {
        success: true,
        message: res.data.message,
        email: res.data.email,
        maskedEmail: res.data.maskedEmail,
        resendCooldown: res.data.resendCooldown,
        expiresInMinutes: res.data.expiresInMinutes
      };
    } catch (err) {
      return {
        success: false,
        message: err.response?.data?.message || 'Registration failed. Please check your details.'
      };
    }
  };

  /**
   * Stage B: Verify 6-digit OTP and activate account
   */
  const verifyEmailOtp = async (email, otp) => {
    try {
      const res = await api.post('/auth/verify-email', { email, otp });
      setUser(res.data.user);
      localStorage.setItem('token', res.data.token);
      localStorage.setItem('user', JSON.stringify(res.data.user));
      return {
        success: true,
        user: res.data.user,
        token: res.data.token,
        message: res.data.message
      };
    } catch (err) {
      const data = err.response?.data || {};
      return {
        success: false,
        message: data.message || 'Email verification failed.',
        remainingAttempts: data.remainingAttempts
      };
    }
  };

  /**
   * Resend OTP with cooldown
   */
  const resendOtp = async (email, purpose = 'signup') => {
    try {
      const res = await api.post('/auth/resend-otp', { email, purpose });
      return {
        success: true,
        message: res.data.message,
        resendCooldown: res.data.resendCooldown
      };
    } catch (err) {
      const data = err.response?.data || {};
      return {
        success: false,
        message: data.message || 'Failed to resend code.',
        secondsLeft: data.secondsLeft
      };
    }
  };

  // Legacy wrapper for backwards compatibility
  const register = async (name, email, password, role) => {
    return await initiateSignup(name, email, password, role);
  };

  const googleLogin = async (token) => {
    try {
      const res = await api.post('/auth/google', { token });
      setUser(res.data.user);
      localStorage.setItem('token', res.data.token);
      localStorage.setItem('user', JSON.stringify(res.data.user));
      return { success: true };
    } catch (err) {
      return { success: false, message: err.response?.data?.message || 'Google Login failed' };
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        register,
        initiateSignup,
        verifyEmailOtp,
        resendOtp,
        googleLogin,
        logout
      }}
    >
      {!loading && children}
    </AuthContext.Provider>
  );
};
