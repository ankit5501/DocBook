import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider, AuthContext } from './context/AuthContext';
import { useContext, useEffect } from 'react';
import { io } from 'socket.io-client';
import { ToastContainer, toast } from 'react-toastify';
import Navbar from './components/Navbar';
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import DoctorList from './pages/DoctorList';
import BookAppointment from './pages/BookAppointment';

const SocketManager = () => {
  const { user } = useContext(AuthContext);

  useEffect(() => {
    let socket;
    if (user) {
      socket = io('http://localhost:5000');
      
      socket.on('connect', () => {
        socket.emit('register', user.id);
      });

      socket.on('notification', (data) => {
        toast.info(data.message, {
          position: "top-right",
          autoClose: 5000,
          hideProgressBar: false,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true,
        });
        window.dispatchEvent(new CustomEvent('new-notification', { detail: data }));
      });
    }

    return () => {
      if (socket) socket.disconnect();
    };
  }, [user]);

  return null;
};

function App() {
  return (
    <AuthProvider>
      <Router>
        <SocketManager />
        <ToastContainer />
        <div className="min-h-screen bg-light flex flex-col">
          <Navbar />
          <main className="flex-grow">
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/doctors" element={<DoctorList />} />
              <Route path="/book/:id" element={<BookAppointment />} />
            </Routes>
          </main>
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;
