import { useState, useContext } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { GoogleLogin } from '@react-oauth/google';
import { AuthContext } from '../context/AuthContext';

const Register = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'patient',
  });
  const [error, setError] = useState('');
  const { register, googleLogin } = useContext(AuthContext);
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const setRole = (roleValue) => {
    setFormData({ ...formData, role: roleValue });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    const res = await register(formData.name, formData.email, formData.password, formData.role);
    if (res.success) {
      navigate('/dashboard');
    } else {
      setError(res.message);
    }
  };

  const handleGoogleSuccess = async (credentialResponse) => {
    const res = await googleLogin(credentialResponse.credential);
    if (res.success) {
      navigate('/dashboard');
    } else {
      setError(res.message);
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden bg-slate-50">
      {/* Decorative Blob */}

      <div className="max-w-md w-full space-y-8 bg-white/85 backdrop-blur-md p-10 rounded-lg border border-gray-200 shadow-md relative z-10">
        <div className="text-center">
          <span className="text-[10px] font-black uppercase tracking-wider bg-indigo-50 text-indigo-700 px-3 py-1 rounded-md border border-indigo-100">
            Join the Network
          </span>
          <h2 className="mt-4 text-center text-3xl font-extrabold text-gray-900 tracking-tight">
            Create an Account
          </h2>
          <p className="text-xs text-gray-500 font-semibold mt-1">Get started with online appointments</p>
        </div>

        {/* Google Authentication */}
        <div className="mt-6 flex justify-center">
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
        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-200"></div>
          </div>
          <div className="relative flex justify-center text-xs uppercase tracking-widest font-black">
            <span className="px-3 bg-white text-gray-400">Or continue with</span>
          </div>
        </div>

        {/* Signup Form */}
        <form className="space-y-5" onSubmit={handleSubmit}>
          {error && (
            <div className="text-red-600 text-xs text-center bg-red-50 border border-red-200 p-3.5 rounded-lg font-bold">
              {error}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider">Full Name</label>
              <input
                type="text"
                name="name"
                required
                className="mt-2 appearance-none block w-full px-4 py-3 border border-gray-200 placeholder-gray-400 text-gray-900 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 text-sm font-semibold transition"
                placeholder="John Doe"
                value={formData.name}
                onChange={handleChange}
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider">Email address</label>
              <input
                type="email"
                name="email"
                required
                className="mt-2 appearance-none block w-full px-4 py-3 border border-gray-200 placeholder-gray-400 text-gray-900 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 text-sm font-semibold transition"
                placeholder="you@example.com"
                value={formData.email}
                onChange={handleChange}
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider">Password</label>
              <input
                type="password"
                name="password"
                required
                className="mt-2 appearance-none block w-full px-4 py-3 border border-gray-200 placeholder-gray-400 text-gray-900 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 text-sm font-semibold transition"
                placeholder="••••••••"
                value={formData.password}
                onChange={handleChange}
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">I register as a...</label>
              <div className="grid grid-cols-2 gap-3.5">
                <div
                  onClick={() => setRole('patient')}
                  className={`cursor-pointer rounded-lg border p-3.5 text-center font-bold text-xs uppercase tracking-wider select-none transition ${
                    formData.role === 'patient'
                      ? 'border-indigo-600 bg-indigo-50/40 text-indigo-700 font-black'
                      : 'border-gray-200 text-gray-500 hover:bg-gray-50'
                  }`}
                >
                  🏥 Patient
                </div>
                <div
                  onClick={() => setRole('doctor')}
                  className={`cursor-pointer rounded-lg border p-3.5 text-center font-bold text-xs uppercase tracking-wider select-none transition ${
                    formData.role === 'doctor'
                      ? 'border-indigo-600 bg-indigo-50/40 text-indigo-700 font-black'
                      : 'border-gray-200 text-gray-500 hover:bg-gray-50'
                  }`}
                >
                  🩺 Doctor
                </div>
              </div>
            </div>
          </div>

          <div>
            <button
              type="submit"
              className="w-full flex justify-center py-3.5 px-4 border border-transparent text-sm font-bold rounded-lg text-white bg-indigo-950 hover:bg-slate-900 shadow active:scale-98 transition duration-150 cursor-pointer"
            >
              Sign up
            </button>
          </div>

          <div className="text-center mt-4">
            <p className="text-xs text-gray-500 font-semibold">
              Already have an account?{' '}
              <Link to="/login" className="font-bold text-indigo-600 hover:text-indigo-800 transition">
                Sign in
              </Link>
            </p>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Register;
