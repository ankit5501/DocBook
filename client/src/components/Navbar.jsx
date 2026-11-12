import { useContext, useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';

const Navbar = () => {
  const { user, logout } = useContext(AuthContext);
  const navigate = useNavigate();
  const location = useLocation();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 20) {
        setScrolled(true);
      } else {
        setScrolled(false);
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const handleNavScroll = (elementId) => {
    setIsMenuOpen(false);
    if (location.pathname === '/') {
      const elem = document.getElementById(elementId);
      if (elem) {
        elem.scrollIntoView({ behavior: 'smooth' });
      }
    } else {
      navigate(`/#${elementId}`);
    }
  };

  return (
    <nav
      className={`sticky top-0 z-50 transition-all duration-300 ${
        scrolled
          ? 'bg-white/95 shadow-md border-b border-slate-200 backdrop-blur-md py-0.5'
          : 'bg-white/85 border-b border-slate-200/50 backdrop-blur-sm py-1'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">

          {/* Logo & Brand Identity */}
          <div className="flex items-center">
            <Link to="/" className="flex items-center gap-2 group">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-emerald-500 flex items-center justify-center text-white font-black text-xl shadow-md group-hover:scale-105 transition-transform duration-200">
                <span>✚</span>
              </div>
              <span className="text-2xl font-black bg-gradient-to-r from-slate-950 via-indigo-950 to-blue-900 bg-clip-text text-transparent tracking-tight">
                DocBook<span className="text-indigo-600 font-medium">.care</span>
              </span>
            </Link>
          </div>

          {/* Desktop Navigation Links */}
          <div className="hidden lg:flex space-x-7 items-center">
            <Link
              to="/"
              className={`text-sm font-bold transition duration-150 py-1 ${
                location.pathname === '/' && !location.hash
                  ? 'text-indigo-600 font-extrabold'
                  : 'text-slate-600 hover:text-indigo-600'
              }`}
            >
              Home
            </Link>

            <Link
              to="/doctors"
              className={`text-sm font-bold transition duration-150 py-1 ${
                location.pathname === '/doctors'
                  ? 'text-indigo-600 font-extrabold'
                  : 'text-slate-600 hover:text-indigo-600'
              }`}
            >
              Find Doctors
            </Link>

            <button
              onClick={() => handleNavScroll('how-it-works')}
              className="text-sm font-bold text-slate-600 hover:text-indigo-600 transition duration-150 py-1 cursor-pointer"
            >
              How It Works
            </button>

            <button
              onClick={() => handleNavScroll('why-choose-us')}
              className="text-sm font-bold text-slate-600 hover:text-indigo-600 transition duration-150 py-1 cursor-pointer"
            >
              About Us
            </button>

            <button
              onClick={() => handleNavScroll('contact')}
              className="text-sm font-bold text-slate-600 hover:text-indigo-600 transition duration-150 py-1 cursor-pointer"
            >
              Contact
            </button>

            {user ? (
              <div className="flex items-center space-x-3 pl-4 border-l border-slate-200">
                <Link
                  to="/dashboard"
                  className="px-3.5 py-1.5 text-xs font-black text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg border border-indigo-200 transition duration-150"
                >
                  Dashboard
                </Link>

                <div className="flex flex-col text-right">
                  <span className="text-xs font-bold text-slate-900">{user.name}</span>
                  <span className="text-[10px] font-black text-indigo-600 uppercase tracking-wider">{user.role}</span>
                </div>

                <button
                  onClick={handleLogout}
                  className="px-3 py-1.5 text-xs font-bold rounded-lg border border-rose-200 text-rose-500 hover:bg-rose-50 transition duration-150 cursor-pointer active:scale-95"
                >
                  Logout
                </button>
              </div>
            ) : (
              <div className="flex items-center space-x-3 pl-4 border-l border-slate-200">
                <Link
                  to="/login"
                  className="px-4 py-2 text-xs font-bold text-slate-700 hover:text-indigo-600 hover:bg-slate-50 rounded-lg transition duration-150"
                >
                  Login
                </Link>
                <Link
                  to="/register"
                  className="px-5 py-2 text-xs font-black text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm hover:shadow transition duration-200 transform hover:-translate-y-0.5 active:translate-y-0 cursor-pointer"
                >
                  Register
                </Link>
              </div>
            )}
          </div>

          {/* Mobile Menu Button */}
          <div className="lg:hidden flex items-center">
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="text-slate-600 hover:text-slate-900 focus:outline-none p-2 rounded-lg hover:bg-slate-100 transition"
              aria-label="Toggle navigation menu"
            >
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                {isMenuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>

        </div>
      </div>

      {/* Mobile Menu Dropdown */}
      {isMenuOpen && (
        <div className="lg:hidden border-t border-slate-100 bg-white/98 backdrop-blur-xl px-4 py-5 space-y-3 shadow-xl">
          <Link
            to="/"
            onClick={() => setIsMenuOpen(false)}
            className="block text-sm font-bold text-slate-700 hover:text-indigo-600 py-2 px-3 rounded-lg hover:bg-indigo-50/50 transition"
          >
            Home
          </Link>

          <Link
            to="/doctors"
            onClick={() => setIsMenuOpen(false)}
            className="block text-sm font-bold text-slate-700 hover:text-indigo-600 py-2 px-3 rounded-lg hover:bg-indigo-50/50 transition"
          >
            Find Doctors
          </Link>

          <button
            onClick={() => handleNavScroll('how-it-works')}
            className="block w-full text-left text-sm font-bold text-slate-700 hover:text-indigo-600 py-2 px-3 rounded-lg hover:bg-indigo-50/50 transition"
          >
            How It Works
          </button>

          <button
            onClick={() => handleNavScroll('why-choose-us')}
            className="block w-full text-left text-sm font-bold text-slate-700 hover:text-indigo-600 py-2 px-3 rounded-lg hover:bg-indigo-50/50 transition"
          >
            About Us
          </button>

          <button
            onClick={() => handleNavScroll('contact')}
            className="block w-full text-left text-sm font-bold text-slate-700 hover:text-indigo-600 py-2 px-3 rounded-lg hover:bg-indigo-50/50 transition"
          >
            Contact
          </button>

          {user ? (
            <div className="pt-3 border-t border-slate-100 space-y-2">
              <div className="flex items-center justify-between px-3">
                <div>
                  <p className="text-xs font-bold text-slate-900">{user.name}</p>
                  <p className="text-[10px] font-black text-indigo-600 uppercase tracking-wider">{user.role}</p>
                </div>
                <Link
                  to="/dashboard"
                  onClick={() => setIsMenuOpen(false)}
                  className="px-3 py-1.5 text-xs font-bold bg-indigo-50 text-indigo-700 rounded-lg border border-indigo-200"
                >
                  Dashboard
                </Link>
              </div>
              <button
                onClick={() => {
                  setIsMenuOpen(false);
                  handleLogout();
                }}
                className="w-full text-center px-4 py-2 text-xs font-bold rounded-lg border border-rose-200 text-rose-500 hover:bg-rose-50 transition cursor-pointer"
              >
                Logout
              </button>
            </div>
          ) : (
            <div className="pt-3 border-t border-slate-100 flex items-center space-x-3 px-1">
              <Link
                to="/login"
                onClick={() => setIsMenuOpen(false)}
                className="text-sm font-bold text-slate-700 hover:text-indigo-600 flex-1 text-center py-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 transition"
              >
                Login
              </Link>
              <Link
                to="/register"
                onClick={() => setIsMenuOpen(false)}
                className="text-sm font-black text-white bg-indigo-600 hover:bg-indigo-700 flex-1 text-center py-2.5 rounded-xl shadow transition"
              >
                Register
              </Link>
            </div>
          )}
        </div>
      )}
    </nav>
  );
};

export default Navbar;
