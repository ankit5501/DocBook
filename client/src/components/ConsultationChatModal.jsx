import { useState, useEffect, useRef, useContext } from 'react';
import api from '../api/axios';
import { AuthContext } from '../context/AuthContext';
import { io } from 'socket.io-client';
import { toast } from 'react-toastify';

const ConsultationChatModal = ({ appointmentId, onClose }) => {
  const { user } = useContext(AuthContext);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [appointmentInfo, setAppointmentInfo] = useState(null);
  const [windowStatus, setWindowStatus] = useState({ isActive: true, hoursRemaining: 48 });
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef(null);
  const socketRef = useRef(null);

  useEffect(() => {
    fetchChatHistory();

    // Connect to Socket.io for live messaging
    const socket = io('http://localhost:5000');
    socketRef.current = socket;

    socket.on('connect', () => {
      socket.emit('join_consultation_chat', { appointmentId });
    });

    socket.on('new_chat_message', (msg) => {
      if (msg.appointment_id === parseInt(appointmentId, 10)) {
        setMessages((prev) => {
          // Avoid duplicate messages if already present
          if (prev.some((m) => m.id === msg.id)) return prev;
          return [...prev, msg];
        });
      }
    });

    return () => {
      if (socket) {
        socket.emit('leave_consultation_chat', { appointmentId });
        socket.disconnect();
      }
    };
  }, [appointmentId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const fetchChatHistory = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/chat/${appointmentId}`);
      setMessages(res.data.messages || []);
      setAppointmentInfo(res.data.appointment || null);
      if (res.data.windowStatus) {
        setWindowStatus(res.data.windowStatus);
      }
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || 'Failed to load consultation messages');
    } finally {
      setLoading(false);
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || sending) return;

    if (!windowStatus.isActive) {
      toast.warning('The 48-hour consultation chat window for this appointment has expired.');
      return;
    }

    setSending(true);
    const content = newMessage.trim();
    setNewMessage('');

    try {
      const res = await api.post(`/chat/${appointmentId}`, { message: content });
      setMessages((prev) => {
        if (prev.some((m) => m.id === res.data.id)) return prev;
        return [...prev, res.data];
      });
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || 'Failed to send message');
      setNewMessage(content); // restore content on failure
    } finally {
      setSending(false);
    }
  };

  const otherPersonTitle = user?.role === 'patient'
    ? `Dr. ${appointmentInfo?.doctor_name || 'Practitioner'}`
    : `${appointmentInfo?.patient_name || 'Patient'}`;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/65 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white rounded-2xl max-w-xl w-full h-[620px] max-h-[90vh] shadow-2xl border border-slate-200 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        
        {/* Chat Header */}
        <div className="p-4 bg-slate-950 text-white flex justify-between items-center border-b border-slate-800">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-500 to-blue-500 text-white font-black flex items-center justify-center text-lg shadow-sm">
              {otherPersonTitle.charAt(0)}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-white text-sm leading-tight">{otherPersonTitle}</h3>
                <span className="text-[10px] bg-indigo-500/30 text-indigo-200 px-2 py-0.5 rounded-full border border-indigo-400/30 font-bold">
                  #APT-{appointmentId}
                </span>
              </div>
              <p className="text-[11px] text-slate-300 font-medium">
                {appointmentInfo?.specialty ? `${appointmentInfo.specialty} • ` : ''}
                {appointmentInfo?.appointment_type === 'video' ? '📹 Online Consultation' : '🏥 Clinic Visit'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white text-xl font-bold p-1 cursor-pointer transition"
          >
            ✕
          </button>
        </div>

        {/* 48-Hour Follow-up Window Indicator */}
        <div className={`px-4 py-2.5 text-xs font-bold border-b flex items-center justify-between ${
          windowStatus.isActive
            ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
            : 'bg-rose-50 text-rose-800 border-rose-200'
        }`}>
          <div className="flex items-center gap-2">
            <span>{windowStatus.isActive ? '⚡' : '🔒'}</span>
            <span>
              {windowStatus.isActive
                ? `48-Hour Consultation Window: ${windowStatus.hoursRemaining}h remaining for follow-up questions`
                : 'Consultation follow-up window closed (48h expired)'}
            </span>
          </div>
          {windowStatus.isActive && (
            <span className="text-[10px] bg-emerald-200/60 text-emerald-900 px-2 py-0.5 rounded-full uppercase tracking-wider font-black">
              Active
            </span>
          )}
        </div>

        {/* Message Feed */}
        <div className="flex-1 p-4 overflow-y-auto bg-slate-50 space-y-3 text-xs">
          {loading ? (
            <div className="h-full flex items-center justify-center text-slate-400 font-bold">
              <svg className="animate-spin h-6 w-6 text-indigo-600 mr-2" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Loading consultation messages...
            </div>
          ) : messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center text-slate-400 p-6">
              <span className="text-3xl mb-2">💬</span>
              <p className="font-bold text-slate-600 text-sm">No messages yet.</p>
              <p className="text-[11px] text-slate-400 max-w-xs mt-1">
                Patients can ask pre-consultation questions or follow up on medications & diagnosis instructions within 48 hours.
              </p>
            </div>
          ) : (
            messages.map((msg) => {
              const isMe = msg.sender_id === user?.id;
              return (
                <div
                  key={msg.id}
                  className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
                >
                  <div className="flex items-center gap-1.5 mb-1 px-1">
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">
                      {isMe ? 'You' : msg.sender_name}
                    </span>
                    <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded uppercase ${
                      msg.sender_role === 'doctor'
                        ? 'bg-blue-100 text-blue-800'
                        : 'bg-emerald-100 text-emerald-800'
                    }`}>
                      {msg.sender_role}
                    </span>
                  </div>

                  <div
                    className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-xs font-semibold leading-relaxed shadow-sm ${
                      isMe
                        ? 'bg-indigo-600 text-white rounded-tr-none'
                        : 'bg-white text-slate-900 border border-slate-200/80 rounded-tl-none'
                    }`}
                  >
                    <p className="whitespace-pre-wrap">{msg.message}</p>
                    <span className={`block text-[9px] mt-1 text-right font-medium ${
                      isMe ? 'text-indigo-200' : 'text-slate-400'
                    }`}>
                      {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Bar */}
        <div className="p-3 bg-white border-t border-slate-200">
          {windowStatus.isActive ? (
            <form onSubmit={handleSendMessage} className="flex gap-2">
              <input
                type="text"
                placeholder={`Type a message to ${otherPersonTitle}...`}
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                className="flex-1 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
              <button
                type="submit"
                disabled={sending || !newMessage.trim()}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs shadow-md transition disabled:opacity-40 cursor-pointer"
              >
                {sending ? '...' : 'Send'}
              </button>
            </form>
          ) : (
            <div className="text-center py-2 text-xs text-slate-400 font-semibold bg-slate-100 rounded-xl">
              Consultation follow-up window has ended.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ConsultationChatModal;
