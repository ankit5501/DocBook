import { useContext, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';

const Navbar = () => {
  const { user, logout } = useContext(AuthContext);
  const navigate = useNavigate();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <nav className="glassmorphism sticky top-0 z-50 border-b border-white/20 shadow-sm backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">

          {/* Logo */}
          <div className="flex items-center">
            <Link to="/" className="text-2xl font-black bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 bg-clip-text text-transparent tracking-tight hover:opacity-90 transition">
              DocBook<span className="text-purple-600 font-medium">.care</span>
            </Link>
          </div>

          {/* Desktop Nav links */}
          <div className="hidden md:flex space-x-8 items-center">
            <Link to="/doctors" className="text-sm font-bold text-gray-700 hover:text-primary transition duration-150 relative py-1 after:absolute after:bottom-0 after:left-0 after:h-0.5 after:w-0 after:bg-primary hover:after:w-full after:transition-all">
              Find Doctors
            </Link>

            {user ? (
              <>
                <Link to="/dashboard" className="text-sm font-bold text-gray-700 hover:text-primary transition duration-150 relative py-1 after:absolute after:bottom-0 after:left-0 after:h-0.5 after:w-0 after:bg-primary hover:after:w-full after:transition-all">
                  Dashboard
                </Link>

                <div className="flex items-center space-x-3 pl-4 border-l border-gray-200">
                  <div className="flex flex-col text-right">
                    <span className="text-xs font-bold text-gray-900">{user.name}</span>
                    <span className="text-[10px] font-bold text-primary uppercase tracking-wider">{user.role}</span>
                  </div>

                  <button
                    onClick={handleLogout}
                    className="px-4 py-2 text-xs font-bold rounded-lg border border-red-200 text-red-500 hover:bg-red-50 transition duration-150 cursor-pointer active:scale-95"
                  >
                    Logout
                  </button>
                </div>
              </>
            ) : (
              <div className="flex items-center space-x-4 pl-4 border-l border-gray-200">
                <Link to="/login" className="text-sm font-bold text-gray-700 hover:text-primary transition duration-150">
                  Login
                </Link>
                <Link
                  to="/register"
                  className="px-5 py-2 text-sm font-bold text-white care-gradient rounded-lg shadow-md hover:shadow-md hover:opacity-95 transition duration-200 transform hover:-translate-y-0.5 active:translate-y-0 cursor-pointer"
                >
                  Sign Up
                </Link>
              </div>
            )}
          </div>

          {/* Mobile Menu Button */}
          <div className="md:hidden flex items-center">
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="text-gray-600 hover:text-gray-900 focus:outline-none p-2"
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
        <div className="md:hidden border-t border-gray-100 bg-white/95 backdrop-blur-md px-4 py-4 space-y-3 shadow-inner">
          <Link
            to="/doctors"
            onClick={() => setIsMenuOpen(false)}
            className="block text-sm font-bold text-gray-700 hover:text-primary py-2 px-3 rounded-lg hover:bg-blue-50/50 transition"
          >
            Find Doctors
          </Link>

          {user ? (
            <>
              <Link
                to="/dashboard"
                onClick={() => setIsMenuOpen(false)}
                className="block text-sm font-bold text-gray-700 hover:text-primary py-2 px-3 rounded-lg hover:bg-blue-50/50 transition"
              >
                Dashboard
              </Link>

              <div className="pt-3 border-t border-gray-200 flex items-center justify-between px-3">
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-gray-900">{user.name}</span>
                  <span className="text-[10px] font-bold text-primary uppercase tracking-wider">{user.role}</span>
                </div>
                <button
                  onClick={() => {
                    setIsMenuOpen(false);
                    handleLogout();
                  }}
                  className="px-4 py-2 text-xs font-bold rounded-lg border border-red-200 text-red-500 hover:bg-red-50 transition cursor-pointer"
                >
                  Logout
                </button>
              </div>
            </>
          ) : (
            <div className="pt-3 border-t border-gray-200 flex items-center space-x-3 px-3">
              <Link
                to="/login"
                onClick={() => setIsMenuOpen(false)}
                className="text-sm font-bold text-gray-700 hover:text-primary flex-1 text-center py-2 rounded-lg border border-gray-200 hover:bg-gray-50 transition"
              >
                Login
              </Link>
              <Link
                to="/register"
                onClick={() => setIsMenuOpen(false)}
                className="text-sm font-bold text-white care-gradient flex-1 text-center py-2 rounded-lg shadow transition"
              >
                Sign Up
              </Link>
            </div>
          )}
        </div>
      )}
    </nav>
  );
};

export default Navbar;
