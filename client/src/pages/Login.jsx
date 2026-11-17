import { useState, useContext } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { GoogleLogin } from '@react-oauth/google';
import { AuthContext } from '../context/AuthContext';
import { toast } from 'react-toastify';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [unverifiedEmail, setUnverifiedEmail] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const { login, googleLogin, resendOtp } = useContext(AuthContext);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setUnverifiedEmail(null);
    setIsLoading(true);

    const res = await login(email.trim(), password);
    setIsLoading(false);

    if (res.success) {
      toast.success('Welcome back to DocBook!');
      navigate('/dashboard');
    } else {
      if (res.unverified) {
        setUnverifiedEmail(res.email || email.trim());
      }
      setError(res.message);
    }
  };

  const handleRequestVerification = async () => {
    if (!unverifiedEmail) return;
    setIsLoading(true);
    const res = await resendOtp(unverifiedEmail, 'signup');
    setIsLoading(false);

    if (res.success) {
      toast.info('Verification code sent! Redirecting to verification...');
      navigate('/register');
    } else {
      toast.error(res.message || 'Failed to send verification code.');
    }
  };

  const handleGoogleSuccess = async (credentialResponse) => {
    setIsLoading(true);
    const res = await googleLogin(credentialResponse.credential);
    setIsLoading(false);

    if (res.success) {
      toast.success('Signed in with Google!');
      navigate('/dashboard');
    } else {
      setError(res.message);
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden bg-slate-50">
      <div className="max-w-md w-full space-y-7 bg-white/95 backdrop-blur-md p-8 sm:p-10 rounded-2xl border border-gray-200 shadow-xl relative z-10">
        <div className="text-center">
          <span className="text-[10px] font-black uppercase tracking-wider bg-indigo-50 text-indigo-700 px-3 py-1 rounded-full border border-indigo-100">
            Welcome Back
          </span>
          <h2 className="mt-4 text-center text-3xl font-extrabold text-gray-900 tracking-tight">
            Sign in to DocBook
          </h2>
          <p className="text-xs text-gray-500 font-semibold mt-1">Access your consultation dashboard</p>
        </div>

        {/* Google Authentication */}
        <div className="mt-5 flex justify-center">
          <div className="w-full max-w-[280px]">
            <GoogleLogin
              onSuccess={handleGoogleSuccess}
              onError={() => {
                setError('Google Login Failed');
              }}
            />
          </div>
        </div>

        {/* Separator */}
        <div className="relative my-5">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-200"></div>
          </div>
          <div className="relative flex justify-center text-xs uppercase tracking-widest font-black">
            <span className="px-3 bg-white text-gray-400">Or sign in with email</span>
          </div>
        </div>

        {/* Credentials Form */}
        <form className="space-y-4" onSubmit={handleSubmit}>
          {error && (
            <div className="text-red-700 text-xs bg-red-50 border border-red-200 p-3.5 rounded-lg font-bold space-y-2">
              <p className="text-center">{error}</p>
              {unverifiedEmail && (
                <div className="text-center pt-1 border-t border-red-200">
                  <button
                    type="button"
                    onClick={handleRequestVerification}
                    className="text-xs text-indigo-700 hover:text-indigo-900 underline font-extrabold cursor-pointer"
                  >
                    Send verification code to {unverifiedEmail} &rarr;
                  </button>
                </div>
              )}
            </div>
          )}

          <div className="space-y-3.5">
            <div>
              <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider">Email address</label>
              <input
                type="email"
                required
                className="mt-1.5 appearance-none block w-full px-4 py-2.5 border border-gray-200 placeholder-gray-400 text-gray-900 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm font-medium transition"
                placeholder="you@domain.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider">Password</label>
              <input
                type="password"
                required
                className="mt-1.5 appearance-none block w-full px-4 py-2.5 border border-gray-200 placeholder-gray-400 text-gray-900 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm font-medium transition"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex justify-center items-center py-3 px-4 border border-transparent text-sm font-bold rounded-lg text-white bg-indigo-950 hover:bg-slate-900 disabled:opacity-50 shadow transition cursor-pointer"
            >
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  Signing in...
                </span>
              ) : (
                'Sign in'
              )}
            </button>
          </div>

          <div className="text-center pt-2">
            <p className="text-xs text-gray-500 font-medium">
              Don't have an account?{' '}
              <Link to="/register" className="font-bold text-indigo-600 hover:text-indigo-800 transition">
                Sign up
              </Link>
            </p>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Login;
