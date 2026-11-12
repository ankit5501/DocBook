import { useState, useEffect, useCallback, useRef, useContext } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/axios';
import { toast } from 'react-toastify';
import { downloadPrescriptionAsPDF } from '../utils/prescriptionPdf';
import ConsultationChatModal from '../components/ConsultationChatModal';
import { AuthContext } from '../context/AuthContext';

/* ─── Helpers ─────────────────────────────────────────────────────── */
const greeting = () => {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
};

const fmtDate = (d, opts = {}) =>
  d ? new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric', ...opts }) : '—';

const fmtTime = (t) => (t ? t.substring(0, 5) : '');

/* ─── Shared micro-components ──────────────────────────────────────── */
const Avatar = ({ name = '', size = 'md', color = 'from-sky-500 to-indigo-600' }) => {
  const initials = name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
  const s = { sm: 'w-9 h-9 text-xs', md: 'w-11 h-11 text-sm', lg: 'w-14 h-14 text-base', xl: 'w-20 h-20 text-2xl' }[size];
  return (
    <div className={`${s} rounded-2xl bg-gradient-to-br ${color} flex items-center justify-center text-white font-bold flex-shrink-0 shadow-sm`}>
      {initials || '?'}
    </div>
  );
};

const StatusPill = ({ status, payment }) => {
  const map = {
    pending:   { cls: 'bg-amber-50 text-amber-700 border-amber-200',   dot: 'bg-amber-400',   label: 'Pending'   },
    accepted:  { cls: 'bg-sky-50 text-sky-700 border-sky-200',          dot: 'bg-sky-500',     label: 'Confirmed' },
    completed: { cls: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500', label: 'Completed' },
    cancelled: { cls: 'bg-slate-100 text-slate-500 border-slate-200',   dot: 'bg-slate-400',   label: 'Cancelled' },
    rejected:  { cls: 'bg-rose-50 text-rose-600 border-rose-200',       dot: 'bg-rose-400',    label: 'Rejected'  },
  };
  const v = map[status] ?? { cls: 'bg-slate-100 text-slate-600 border-slate-200', dot: 'bg-slate-400', label: status };
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border ${v.cls}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${v.dot}`} />
      {v.label}
    </span>
  );
};

const TypeBadge = ({ type }) =>
  type === 'video' ? (
    <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-violet-700 bg-violet-50 border border-violet-200 px-2 py-0.5 rounded-full">
      <span className="w-1.5 h-1.5 rounded-full bg-violet-500 animate-pulse" /> Online
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-full">
      🏥 In-Person
    </span>
  );

const EmptyState = ({ emoji, title, desc, action }) => (
  <div className="text-center py-16 px-6">
    <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center text-3xl mx-auto mb-4">{emoji}</div>
    <h4 className="text-sm font-bold text-slate-700">{title}</h4>
    {desc && <p className="text-xs text-slate-400 mt-1.5 max-w-xs mx-auto leading-relaxed">{desc}</p>}
    {action && <div className="mt-5">{action}</div>}
  </div>
);

const SectionTitle = ({ children, sub }) => (
  <div className="mb-6">
    <h2 className="text-lg font-black text-slate-900 tracking-tight">{children}</h2>
    {sub && <p className="text-xs text-slate-400 font-medium mt-0.5">{sub}</p>}
  </div>
);

const inputCls = 'w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 transition placeholder:text-slate-400';

/* ═══════════════════════════════════════════════════════════════════
   NAV ITEMS
═══════════════════════════════════════════════════════════════════ */
const NAV = [
  { id: 'overview',      icon: '⬛', label: 'Overview'      },
  { id: 'appointments',  icon: '📅', label: 'Appointments'  },
  { id: 'health',        icon: '❤️', label: 'Health Profile' },
  { id: 'records',       icon: '📋', label: 'Medical Records'},
  { id: 'waitlist',      icon: '⏳', label: 'Waitlist'       },
];

/* ═══════════════════════════════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════════════════════════════ */
const PatientDashboard = () => {
  const { user } = useContext(AuthContext);
  const [activeTab, setActiveTab] = useState('overview');
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [aptFilter, setAptFilter] = useState('upcoming'); // upcoming | completed | cancelled

  // Clinic Tokens
  const [tokens, setTokens] = useState({});
  const [checkingInId, setCheckingInId] = useState(null);

  // Waitlist
  const [waitlistItems, setWaitlistItems] = useState([]);
  const [claimingWaitlistId, setClaimingWaitlistId] = useState(null);

  // Health Profile
  const [healthProfile, setHealthProfile] = useState({
    blood_group: '', height: '', weight: '', allergies: '',
    chronic_conditions: '', emergency_contact_name: '',
    emergency_contact_phone: '', gender: '', date_of_birth: ''
  });
  const [savingProfile, setSavingProfile] = useState(false);

  // Reschedule Modal
  const [rescheduleApt, setRescheduleApt] = useState(null);
  const [availableSlots, setAvailableSlots] = useState([]);
  const [selectedSlotId, setSelectedSlotId] = useState('');
  const [rescheduling, setRescheduling] = useState(false);

  // Prescription Modal
  const [selectedPrescription, setSelectedPrescription] = useState(null);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const prescriptionRef = useRef(null);

  // Chat Modal
  const [activeChatApt, setActiveChatApt] = useState(null);

  // Review Modal
  const [reviewApt, setReviewApt] = useState(null);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);

  /* ── Fetch helpers ─────────────────────────────────────── */
  const fetchTokenForAppointment = useCallback(async (appointmentId) => {
    try {
      const res = await api.get(`/clinic-queue/appointment/${appointmentId}`);
      if (res.data) setTokens(prev => ({ ...prev, [appointmentId]: res.data }));
    } catch {}
  }, []);

  const fetchWaitlist = useCallback(async () => {
    try {
      const res = await api.get('/waitlist/my');
      setWaitlistItems(res.data || []);
    } catch (err) { console.warn('Waitlist:', err.message); }
  }, []);

  const fetchAppointments = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/appointments/my');
      const apts = res.data || [];
      setAppointments(apts);
      const todayStr = new Date().toISOString().substring(0, 10);
      apts.forEach(a => {
        const aptDateStr = new Date(a.date).toISOString().substring(0, 10);
        if (a.appointment_type === 'in_person' && (aptDateStr === todayStr || a.status === 'accepted'))
          fetchTokenForAppointment(a.id);
      });
    } catch (err) {
      toast.error('Failed to load appointments');
    } finally { setLoading(false); }
  }, [fetchTokenForAppointment]);

  const fetchHealthProfile = useCallback(async () => {
    try {
      const res = await api.get('/patient/profile');
      if (res.data) setHealthProfile({
        blood_group: res.data.blood_group || '',
        height: res.data.height || '',
        weight: res.data.weight || '',
        allergies: res.data.allergies || '',
        chronic_conditions: res.data.chronic_conditions || '',
        emergency_contact_name: res.data.emergency_contact_name || '',
        emergency_contact_phone: res.data.emergency_contact_phone || '',
        gender: res.data.gender || '',
        date_of_birth: res.data.date_of_birth ? res.data.date_of_birth.substring(0, 10) : ''
      });
    } catch (err) { console.warn('Health profile:', err.message); }
  }, []);

  useEffect(() => {
    fetchAppointments();
    fetchHealthProfile();
    fetchWaitlist();
    const handleNotif = () => { fetchAppointments(); fetchWaitlist(); };
    window.addEventListener('new-notification', handleNotif);
    return () => window.removeEventListener('new-notification', handleNotif);
  }, [fetchAppointments, fetchHealthProfile, fetchWaitlist]);

  // Countdown timer for waitlist offers
  useEffect(() => {
    const timer = setInterval(() => {
      setWaitlistItems(prev => prev.map(item =>
        item.status === 'offered' && item.remaining_seconds > 0
          ? { ...item, remaining_seconds: item.remaining_seconds - 1 }
          : item
      ));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  /* ── Action handlers ──────────────────────────────────── */
  const formatCountdown = (secs) => {
    if (!secs || secs <= 0) return '00:00';
    return `${String(Math.floor(secs / 60)).padStart(2, '0')}:${String(secs % 60).padStart(2, '0')}`;
  };

  const handleCheckIn = async (aptId) => {
    setCheckingInId(aptId);
    try {
      const res = await api.post('/clinic-queue/check-in', { appointment_id: aptId });
      toast.success(res.data.message || 'Checked in! Your token is active.');
      await fetchTokenForAppointment(aptId);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Check-in failed');
    } finally { setCheckingInId(null); }
  };

  const handleClaimWaitlist = async (waitlistId) => {
    setClaimingWaitlistId(waitlistId);
    try {
      const res = await api.post(`/waitlist/${waitlistId}/claim`, { appointment_type: 'in_person' });
      toast.success(res.data.message || 'Slot claimed!');
      fetchWaitlist(); fetchAppointments();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to claim slot');
    } finally { setClaimingWaitlistId(null); }
  };

  const handleCancelWaitlist = async (id) => {
    if (!window.confirm('Leave this waitlist?')) return;
    try {
      await api.delete(`/waitlist/${id}`);
      toast.info('Removed from waitlist');
      fetchWaitlist();
    } catch { toast.error('Failed to leave waitlist'); }
  };

  const handleProfileChange = (e) => setHealthProfile({ ...healthProfile, [e.target.name]: e.target.value });

  const saveHealthProfile = async (e) => {
    e.preventDefault();
    setSavingProfile(true);
    try {
      await api.put('/patient/profile', healthProfile);
      toast.success('Health profile saved!');
    } catch { toast.error('Failed to update health profile'); }
    finally { setSavingProfile(false); }
  };

  const calculateBMI = () => {
    const h = parseFloat(healthProfile.height), w = parseFloat(healthProfile.weight);
    if (!h || !w || h <= 0 || w <= 0) return null;
    const bmi = (w / ((h / 100) ** 2)).toFixed(1);
    let category = 'Normal', color = 'emerald';
    if (bmi < 18.5) { category = 'Underweight'; color = 'amber'; }
    else if (bmi >= 25 && bmi < 29.9) { category = 'Overweight'; color = 'amber'; }
    else if (bmi >= 30) { category = 'Obese'; color = 'rose'; }
    return { bmi, category, color };
  };

  const cancelAppointment = async (id) => {
    if (!window.confirm('Cancel this appointment?')) return;
    try {
      await api.delete(`/appointments/${id}`);
      toast.info('Appointment cancelled');
      fetchAppointments();
    } catch { toast.error('Failed to cancel'); }
  };

  const openRescheduleModal = async (apt) => {
    setRescheduleApt(apt); setSelectedSlotId('');
    try {
      const res = await api.get(`/doctors/${apt.doctor_id}/slots`);
      setAvailableSlots((res.data || []).filter(s => s.id !== apt.slot_id && !s.is_booked));
    } catch { toast.error('Could not fetch slots'); }
  };

  const handleRescheduleSubmit = async () => {
    if (!selectedSlotId) { toast.warning('Select a new slot'); return; }
    setRescheduling(true);
    try {
      await api.patch(`/appointments/${rescheduleApt.id}/reschedule`, { new_slot_id: parseInt(selectedSlotId, 10) });
      toast.success('Rescheduled!');
      setRescheduleApt(null); fetchAppointments();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to reschedule'); }
    finally { setRescheduling(false); }
  };

  const openPrescriptionModal = async (appointmentId) => {
    try {
      const res = await api.get(`/appointments/${appointmentId}/prescription`);
      setSelectedPrescription(res.data);
    } catch { toast.error('Prescription not found'); }
  };

  const handleDownloadPdf = async () => {
    if (!prescriptionRef.current || !selectedPrescription) return;
    setIsDownloadingPdf(true);
    try {
      const slug = (selectedPrescription.patient_name || 'Patient').replace(/\s+/g, '_');
      await downloadPrescriptionAsPDF(prescriptionRef.current, `Prescription_APT-${selectedPrescription.appointment_id || selectedPrescription.id}_${slug}.pdf`);
      toast.success('PDF downloaded!');
    } catch { toast.error('Failed to export PDF'); }
    finally { setIsDownloadingPdf(false); }
  };

  const openReviewModal = (apt) => { setReviewApt(apt); setRating(5); setComment(''); };

  const handleSubmitReview = async (e) => {
    e.preventDefault(); setSubmittingReview(true);
    try {
      await api.post('/reviews', { appointment_id: reviewApt.id, doctor_id: reviewApt.doctor_id, rating, comment });
      toast.success('Review submitted!');
      setReviewApt(null); fetchAppointments();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to submit review'); }
    finally { setSubmittingReview(false); }
  };

  /* ── Derived data ──────────────────────────────────────── */
  const bmiInfo = calculateBMI();
  const today = new Date().toISOString().substring(0, 10);

  const upcoming   = appointments.filter(a => !['completed','cancelled','rejected'].includes(a.status));
  const completed  = appointments.filter(a => a.status === 'completed');
  const cancelled  = appointments.filter(a => ['cancelled','rejected'].includes(a.status));

  const nextApt = upcoming
    .filter(a => new Date(a.date) >= new Date(today))
    .sort((a, b) => new Date(a.date) - new Date(b.date))[0] ?? null;

  const activeWaitlist = waitlistItems.filter(w => ['waiting','offered'].includes(w.status));

  // Timeline: all appointments + completed = chronological medical records
  const timeline = [...appointments].sort((a, b) => new Date(b.date) - new Date(a.date));

  /* ── Filtered appointments for the tab ────────────────── */
  const displayedApts = aptFilter === 'upcoming' ? upcoming : aptFilter === 'completed' ? completed : cancelled;

  /* ═══════════════════════════════════════════════════════
     RENDER
  ═══════════════════════════════════════════════════════ */
  return (
    <div className="min-h-screen bg-slate-50 flex">

      {/* ── SIDEBAR ──────────────────────────────────────── */}
      <aside className="hidden lg:flex flex-col w-60 bg-white border-r border-slate-100 min-h-screen sticky top-0 h-screen shadow-sm">
        {/* Brand */}
        <div className="px-6 py-5 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-600 to-sky-500 flex items-center justify-center">
              <span className="text-white text-sm font-black">+</span>
            </div>
            <span className="font-black text-slate-900 text-base tracking-tight">DocBook</span>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-5 space-y-1">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-3 mb-3">Menu</p>
          {NAV.map(item => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all cursor-pointer text-left ${
                activeTab === item.id
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <span className="text-base w-5 text-center">{item.icon}</span>
              {item.label}
              {item.id === 'waitlist' && activeWaitlist.length > 0 && (
                <span className={`ml-auto text-[10px] font-black px-1.5 py-0.5 rounded-full ${activeTab === item.id ? 'bg-white/20 text-white' : 'bg-indigo-100 text-indigo-700'}`}>
                  {activeWaitlist.length}
                </span>
              )}
            </button>
          ))}
        </nav>

        {/* Book CTA */}
        <div className="p-4 border-t border-slate-100">
          <Link
            to="/doctors"
            className="flex items-center justify-center gap-2 w-full py-3 bg-gradient-to-r from-indigo-600 to-sky-500 hover:from-indigo-700 hover:to-sky-600 text-white text-sm font-bold rounded-xl shadow-sm transition"
          >
            <span className="text-lg">+</span> Book Appointment
          </Link>
          <p className="text-[10px] text-center text-slate-400 mt-2 font-medium">No queues. Book online.</p>
        </div>
      </aside>

      {/* ── MOBILE NAV ───────────────────────────────────── */}
      <div className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-white border-t border-slate-200 flex items-center justify-around px-2 py-2 shadow-lg">
        {NAV.map(item => (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl text-[10px] font-semibold transition cursor-pointer ${
              activeTab === item.id ? 'text-indigo-600' : 'text-slate-400'
            }`}
          >
            <span className="text-lg">{item.icon}</span>
            {item.label}
          </button>
        ))}
      </div>

      {/* ── MAIN CONTENT ─────────────────────────────────── */}
      <main className="flex-1 min-w-0 pb-24 lg:pb-8">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">

          {/* ════════════════════════════════════════════════
              OVERVIEW
          ════════════════════════════════════════════════ */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Greeting */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500 font-medium">{greeting()},</p>
                  <h1 className="text-2xl font-black text-slate-900 tracking-tight">{user?.name ?? 'Patient'}</h1>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right hidden sm:block">
                    <p className="text-xs font-semibold text-slate-500">
                      {new Date().toLocaleDateString(undefined, { weekday: 'long' })}
                    </p>
                    <p className="text-sm font-black text-slate-800">
                      {new Date().toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}
                    </p>
                  </div>
                  <Avatar name={user?.name ?? ''} size="md" />
                </div>
              </div>

              {/* Next Appointment Hero Card */}
              {nextApt ? (
                <div className="relative overflow-hidden bg-gradient-to-br from-indigo-600 to-sky-600 rounded-2xl p-6 text-white shadow-lg">
                  <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-white/10 blur-2xl pointer-events-none" />
                  <div className="relative z-10">
                    <p className="text-indigo-200 text-xs font-bold uppercase tracking-widest mb-3">Next Appointment</p>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5">
                      <div className="flex items-start gap-4">
                        <Avatar name={nextApt.doctor_name} size="lg" color="from-white/20 to-white/10" />
                        <div>
                          <h2 className="text-xl font-black">Dr. {nextApt.doctor_name}</h2>
                          <p className="text-indigo-200 text-sm font-semibold">{nextApt.specialty}</p>
                          <div className="flex items-center gap-3 mt-2.5 flex-wrap">
                            <span className="flex items-center gap-1.5 text-sm font-bold">
                              📅 {fmtDate(nextApt.date, { weekday: 'short', month: 'short', day: 'numeric' })}
                            </span>
                            <span className="flex items-center gap-1.5 text-sm font-bold">
                              🕒 {fmtTime(nextApt.start_time)} – {fmtTime(nextApt.end_time)}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Quick actions */}
                      <div className="flex flex-wrap gap-2 self-start sm:self-center">
                        {nextApt.appointment_type === 'video' && nextApt.status === 'accepted' && (
                          <Link
                            to={`/consultation/video/${nextApt.id}`}
                            className="px-4 py-2 bg-white text-indigo-700 hover:bg-indigo-50 text-xs font-bold rounded-xl shadow-sm transition"
                          >
                            📹 Join Call
                          </Link>
                        )}
                        {(nextApt.status === 'pending' || nextApt.status === 'accepted') && (
                          <>
                            <button
                              onClick={() => openRescheduleModal(nextApt)}
                              className="px-4 py-2 bg-white/15 hover:bg-white/25 text-white text-xs font-bold rounded-xl transition cursor-pointer"
                            >
                              Reschedule
                            </button>
                            <button
                              onClick={() => cancelAppointment(nextApt.id)}
                              className="px-4 py-2 bg-white/15 hover:bg-rose-500/80 text-white text-xs font-bold rounded-xl transition cursor-pointer"
                            >
                              Cancel
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Status bar */}
                    <div className="mt-5 pt-4 border-t border-white/20 flex items-center justify-between gap-4 flex-wrap">
                      <div className="flex items-center gap-3 flex-wrap">
                        <StatusPill status={nextApt.status} />
                        <TypeBadge type={nextApt.appointment_type} />
                        <span className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full border ${
                          nextApt.payment_status === 'completed'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-amber-50 text-amber-700 border-amber-200'
                        }`}>
                          {nextApt.payment_status === 'completed' ? '✓ Paid' : 'Pay at clinic'}
                        </span>
                      </div>
                      <span className="text-indigo-200 text-xs font-mono">
                        #{`APT-${nextApt.id}`}
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 text-center">
                  <div className="w-14 h-14 rounded-2xl bg-indigo-50 flex items-center justify-center text-2xl mx-auto mb-4">📅</div>
                  <h3 className="text-base font-bold text-slate-800">No upcoming appointments</h3>
                  <p className="text-xs text-slate-400 mt-1.5 mb-5">Find a specialist and book your next consultation</p>
                  <Link
                    to="/doctors"
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-xl shadow-sm transition"
                  >
                    Browse Doctors →
                  </Link>
                </div>
              )}

              {/* Quick Stats Row */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {[
                  { label: 'Upcoming',  value: upcoming.length,  color: 'sky',     emoji: '📅' },
                  { label: 'Completed', value: completed.length, color: 'emerald', emoji: '✓'  },
                  { label: 'Cancelled', value: cancelled.length, color: 'rose',    emoji: '✕'  },
                  { label: 'Waitlist',  value: activeWaitlist.length, color: 'violet', emoji: '⏳' },
                ].map(({ label, value, color, emoji }) => (
                  <div key={label} className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
                    <div className={`w-9 h-9 rounded-xl bg-${color}-50 text-${color}-600 flex items-center justify-center text-base mb-2.5 border border-${color}-100`}>
                      {emoji}
                    </div>
                    <p className={`text-2xl font-black text-${color}-600`}>{value}</p>
                    <p className="text-xs text-slate-400 font-medium mt-0.5">{label}</p>
                  </div>
                ))}
              </div>

              {/* Health snapshot (if data available) */}
              {(healthProfile.blood_group || healthProfile.height || healthProfile.weight) && (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
                    <h3 className="text-sm font-black text-slate-800">Health Snapshot</h3>
                    <button
                      onClick={() => setActiveTab('health')}
                      className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 cursor-pointer"
                    >
                      Edit profile →
                    </button>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-slate-100 divide-y sm:divide-y-0">
                    {[
                      { label: 'Blood Group', value: healthProfile.blood_group || '—', cls: 'text-rose-600' },
                      { label: 'Height',      value: healthProfile.height ? `${healthProfile.height} cm` : '—' },
                      { label: 'Weight',      value: healthProfile.weight ? `${healthProfile.weight} kg` : '—' },
                      { label: 'BMI',
                        value: bmiInfo ? bmiInfo.bmi : '—',
                        sub: bmiInfo?.category,
                        cls: bmiInfo ? { emerald: 'text-emerald-600', amber: 'text-amber-600', rose: 'text-rose-600' }[bmiInfo.color] : 'text-slate-700'
                      },
                    ].map(({ label, value, cls, sub }) => (
                      <div key={label} className="p-4 text-center">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">{label}</p>
                        <p className={`text-lg font-black ${cls ?? 'text-slate-800'}`}>{value}</p>
                        {sub && <p className="text-[10px] text-slate-400 font-medium">{sub}</p>}
                      </div>
                    ))}
                  </div>
                  {healthProfile.allergies && (
                    <div className="mx-5 mb-4 mt-1 bg-rose-50 border border-rose-200 rounded-xl px-4 py-2.5 flex items-start gap-2">
                      <span className="text-base mt-0.5">⚠️</span>
                      <div>
                        <p className="text-xs font-black text-rose-700 uppercase tracking-wide">Allergy Alert</p>
                        <p className="text-xs text-rose-800 font-medium mt-0.5">{healthProfile.allergies}</p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Recent consultations (last 3) */}
              {completed.length > 0 && (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
                    <h3 className="text-sm font-black text-slate-800">Recent Consultations</h3>
                    <button
                      onClick={() => { setActiveTab('appointments'); setAptFilter('completed'); }}
                      className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 cursor-pointer"
                    >
                      View all →
                    </button>
                  </div>
                  <div className="divide-y divide-slate-50">
                    {completed.slice(0, 3).map(apt => (
                      <div key={apt.id} className="flex items-center justify-between px-5 py-3.5 hover:bg-slate-50/60 transition-colors">
                        <div className="flex items-center gap-3">
                          <Avatar name={apt.doctor_name} size="sm" />
                          <div>
                            <p className="text-sm font-bold text-slate-800">Dr. {apt.doctor_name}</p>
                            <p className="text-xs text-slate-400">{fmtDate(apt.date)} · {apt.specialty}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {apt.prescription_id && (
                            <button
                              onClick={() => openPrescriptionModal(apt.id)}
                              className="text-xs text-indigo-600 font-semibold hover:text-indigo-800 cursor-pointer"
                            >
                              View Rx
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ════════════════════════════════════════════════
              APPOINTMENTS
          ════════════════════════════════════════════════ */}
          {activeTab === 'appointments' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <SectionTitle sub="Manage all your clinic visits and consultations">My Appointments</SectionTitle>
                <Link
                  to="/doctors"
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-sm transition"
                >
                  + Book New
                </Link>
              </div>

              {/* Filter Tabs */}
              <div className="flex bg-white border border-slate-200 rounded-xl p-1 gap-0.5 shadow-sm w-fit">
                {[
                  { id: 'upcoming',   label: 'Upcoming',  count: upcoming.length  },
                  { id: 'completed',  label: 'Completed', count: completed.length },
                  { id: 'cancelled',  label: 'Cancelled', count: cancelled.length },
                ].map(({ id, label, count }) => (
                  <button
                    key={id}
                    onClick={() => setAptFilter(id)}
                    className={`px-4 py-2 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                      aptFilter === id
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    {label}
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-black ${aptFilter === id ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'}`}>
                      {count}
                    </span>
                  </button>
                ))}
              </div>

              {/* Appointment Cards */}
              {loading ? (
                <div className="flex items-center justify-center py-20">
                  <div className="relative w-12 h-12">
                    <div className="absolute inset-0 rounded-full border-4 border-indigo-100" />
                    <div className="absolute inset-0 rounded-full border-4 border-t-indigo-600 animate-spin" />
                  </div>
                </div>
              ) : displayedApts.length === 0 ? (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">
                  <EmptyState
                    emoji={aptFilter === 'upcoming' ? '📅' : aptFilter === 'completed' ? '✓' : '✕'}
                    title={`No ${aptFilter} appointments`}
                    desc={aptFilter === 'upcoming' ? 'Book a consultation to get started.' : `You have no ${aptFilter} appointments yet.`}
                    action={aptFilter === 'upcoming' && (
                      <Link to="/doctors" className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-xl shadow-sm transition">
                        Find a Doctor
                      </Link>
                    )}
                  />
                </div>
              ) : (
                <div className="space-y-4">
                  {displayedApts.map(apt => (
                    <div
                      key={apt.id}
                      className="bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md hover:border-indigo-200 transition-all overflow-hidden"
                    >
                      {/* Top bar color by status */}
                      <div className={`h-1 ${
                        apt.status === 'completed' ? 'bg-emerald-400'
                          : apt.status === 'accepted' ? 'bg-sky-400'
                          : apt.status === 'pending'  ? 'bg-amber-400'
                          : 'bg-slate-200'
                      }`} />

                      <div className="p-5">
                        {/* Header Row */}
                        <div className="flex items-start justify-between gap-4 flex-wrap">
                          <div className="flex items-start gap-3.5">
                            <Avatar name={apt.doctor_name} size="md" />
                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <h3 className="text-base font-black text-slate-900">Dr. {apt.doctor_name}</h3>
                                <span className="text-[10px] font-mono text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                                  #{`APT-${apt.id}`}
                                </span>
                              </div>
                              <p className="text-xs font-semibold text-indigo-600 mt-0.5">{apt.specialty}</p>
                              {/* Date & Time */}
                              <div className="flex items-center gap-3 mt-2 flex-wrap">
                                <span className="text-xs text-slate-600 font-semibold flex items-center gap-1.5">
                                  📅 {fmtDate(apt.date, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                                </span>
                                <span className="text-xs text-slate-600 font-semibold flex items-center gap-1.5">
                                  🕒 {fmtTime(apt.start_time)} – {fmtTime(apt.end_time)}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Status badges */}
                          <div className="flex flex-wrap gap-2">
                            <StatusPill status={apt.status} />
                            <TypeBadge type={apt.appointment_type} />
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border ${
                              apt.payment_status === 'completed'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : 'bg-amber-50 text-amber-700 border-amber-200'
                            }`}>
                              {apt.payment_status === 'completed' ? '✓ Paid' : 'Pay at clinic'}
                            </span>
                            {apt.prescription_id && (
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-teal-700 bg-teal-50 border border-teal-200 px-2.5 py-1 rounded-full">
                                💊 Rx Ready
                              </span>
                            )}
                            {apt.review_rating && (
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-full">
                                ⭐ {apt.review_rating}/5
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="mt-4 pt-4 border-t border-slate-100 flex flex-wrap gap-2">
                          {apt.appointment_type === 'video' && (apt.status === 'accepted' || apt.status === 'completed') && (
                            <Link
                              to={`/consultation/video/${apt.id}`}
                              className="px-3.5 py-2 bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold rounded-xl shadow-sm transition inline-flex items-center gap-1.5"
                            >
                              📹 Join Video Call
                            </Link>
                          )}
                          {(apt.status === 'accepted' || apt.status === 'completed') && (
                            <button
                              onClick={() => setActiveChatApt(apt)}
                              className="px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 text-xs font-bold rounded-xl transition cursor-pointer inline-flex items-center gap-1.5"
                            >
                              💬 Chat
                            </button>
                          )}
                          {apt.prescription_id && (
                            <button
                              onClick={() => openPrescriptionModal(apt.id)}
                              className="px-3.5 py-2 bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold rounded-xl shadow-sm transition cursor-pointer inline-flex items-center gap-1.5"
                            >
                              📄 View Prescription
                            </button>
                          )}
                          {apt.status === 'completed' && !apt.review_id && (
                            <button
                              onClick={() => openReviewModal(apt)}
                              className="px-3.5 py-2 bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-700 text-xs font-bold rounded-xl transition cursor-pointer inline-flex items-center gap-1.5"
                            >
                              ⭐ Rate Doctor
                            </button>
                          )}
                          {(apt.status === 'pending' || apt.status === 'accepted') && (
                            <>
                              <button
                                onClick={() => openRescheduleModal(apt)}
                                className="px-3.5 py-2 border border-indigo-200 text-indigo-700 hover:bg-indigo-50 text-xs font-bold rounded-xl transition cursor-pointer inline-flex items-center gap-1.5"
                              >
                                🗓️ Reschedule
                              </button>
                              <button
                                onClick={() => cancelAppointment(apt.id)}
                                className="px-3.5 py-2 border border-rose-200 text-rose-600 hover:bg-rose-50 text-xs font-bold rounded-xl transition cursor-pointer"
                              >
                                Cancel
                              </button>
                            </>
                          )}
                        </div>

                        {/* Live Clinic Queue Token */}
                        {apt.appointment_type !== 'video' && !['cancelled','rejected'].includes(apt.status) && (
                          <div className="mt-4 pt-4 border-t border-slate-100">
                            {tokens[apt.id] ? (
                              <div className={`rounded-xl border p-4 ${
                                tokens[apt.id].is_turn_approaching
                                  ? 'bg-amber-50 border-amber-300 ring-2 ring-amber-300/40'
                                  : 'bg-slate-50 border-slate-200'
                              }`}>
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                  <div className="flex items-center gap-3">
                                    <div className="w-12 h-12 rounded-xl bg-slate-900 text-white flex flex-col items-center justify-center shadow">
                                      <span className="text-[8px] uppercase font-bold text-indigo-300">Token</span>
                                      <span className="text-sm font-black font-mono">{tokens[apt.id].token.token_code}</span>
                                    </div>
                                    <div>
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <span className="text-xs font-black text-slate-900">Queue #{tokens[apt.id].token.token_number}</span>
                                        <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full border ${
                                          tokens[apt.id].token.status === 'in_consultation'
                                            ? 'bg-emerald-100 text-emerald-800 border-emerald-300 animate-pulse'
                                            : tokens[apt.id].token.status === 'completed'
                                            ? 'bg-slate-100 text-slate-600 border-slate-200'
                                            : 'bg-sky-50 text-sky-700 border-sky-200'
                                        }`}>
                                          {tokens[apt.id].token.status === 'in_consultation' ? 'Now In Room' : tokens[apt.id].token.status}
                                        </span>
                                      </div>
                                      <p className="text-xs text-slate-500 font-medium mt-0.5">
                                        Serving: <strong className="text-indigo-700">{tokens[apt.id].currently_serving?.token_code || '—'}</strong>
                                        {' · '}Ahead: <strong className="text-slate-800">{tokens[apt.id].patients_ahead}</strong>
                                      </p>
                                    </div>
                                  </div>
                                  <div className="text-right">
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Est. Wait</p>
                                    <p className="text-sm font-black text-indigo-600">
                                      {tokens[apt.id].token.status === 'completed' ? 'Visit done'
                                        : tokens[apt.id].token.status === 'in_consultation' ? '🎉 Your Turn!'
                                        : `~${tokens[apt.id].estimated_wait_minutes} min`}
                                    </p>
                                  </div>
                                </div>
                                {tokens[apt.id].is_turn_approaching && tokens[apt.id].token.status === 'waiting' && (
                                  <div className="mt-3 flex items-center gap-2 text-xs font-bold text-amber-800 bg-amber-100 border border-amber-300 rounded-lg px-3 py-2 animate-pulse">
                                    🔔 Your turn is approaching — please head to Dr. {apt.doctor_name}'s room.
                                  </div>
                                )}
                              </div>
                            ) : (
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                                <div className="flex items-center gap-2 text-xs text-slate-600 font-medium">
                                  <span className="text-lg">🎫</span>
                                  At the clinic? Check in to get your digital token and track the live queue.
                                </div>
                                <button
                                  onClick={() => handleCheckIn(apt.id)}
                                  disabled={checkingInId === apt.id}
                                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg shadow-sm transition cursor-pointer disabled:opacity-50 whitespace-nowrap"
                                >
                                  {checkingInId === apt.id ? 'Checking in…' : 'Check In & Get Token 🎫'}
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ════════════════════════════════════════════════
              HEALTH PROFILE
          ════════════════════════════════════════════════ */}
          {activeTab === 'health' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <SectionTitle sub="Your medical information shared with doctors before consultations">
                  My Health Profile
                </SectionTitle>
                {bmiInfo && (
                  <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl border text-xs font-bold ${
                    bmiInfo.color === 'emerald' ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : bmiInfo.color === 'amber' ? 'bg-amber-50 text-amber-700 border-amber-200'
                      : 'bg-rose-50 text-rose-700 border-rose-200'
                  }`}>
                    ⚖️ BMI: <strong>{bmiInfo.bmi}</strong> ({bmiInfo.category})
                  </div>
                )}
              </div>

              <form onSubmit={saveHealthProfile} className="space-y-6">

                {/* Vitals Card */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/60">
                    <h3 className="text-sm font-black text-slate-800">Vitals & Personal Info</h3>
                  </div>
                  <div className="p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                    {/* Blood Group */}
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Blood Group</label>
                      <select name="blood_group" value={healthProfile.blood_group} onChange={handleProfileChange} className={inputCls}>
                        <option value="">Select</option>
                        {['A+','A-','B+','B-','O+','O-','AB+','AB-'].map(g => (
                          <option key={g} value={g}>{g}</option>
                        ))}
                      </select>
                    </div>

                    {/* Height */}
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Height (cm)</label>
                      <input type="number" step="0.1" name="height" placeholder="e.g. 175" value={healthProfile.height} onChange={handleProfileChange} className={inputCls} />
                    </div>

                    {/* Weight */}
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Weight (kg)</label>
                      <input type="number" step="0.1" name="weight" placeholder="e.g. 70" value={healthProfile.weight} onChange={handleProfileChange} className={inputCls} />
                    </div>

                    {/* Gender */}
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Gender</label>
                      <select name="gender" value={healthProfile.gender} onChange={handleProfileChange} className={inputCls}>
                        <option value="">Select</option>
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>

                    {/* DOB */}
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Date of Birth</label>
                      <input type="date" name="date_of_birth" value={healthProfile.date_of_birth} onChange={handleProfileChange} className={inputCls} />
                    </div>
                  </div>
                </div>

                {/* Medical Info Card */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/60">
                    <h3 className="text-sm font-black text-slate-800">Medical History</h3>
                    <p className="text-xs text-slate-400 font-medium mt-0.5">Shared with your doctor before each consultation</p>
                  </div>
                  <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Allergies */}
                    <div>
                      <div className="flex items-center gap-1.5 mb-2">
                        <span>⚠️</span>
                        <label className="text-xs font-bold text-rose-700 uppercase tracking-wider">Drug & Food Allergies</label>
                      </div>
                      <textarea
                        name="allergies"
                        rows="4"
                        placeholder="e.g. Penicillin, Peanuts, Sulfa antibiotics"
                        value={healthProfile.allergies}
                        onChange={handleProfileChange}
                        className="w-full rounded-xl border border-rose-200 bg-rose-50/30 px-3.5 py-2.5 text-sm text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-rose-400 transition placeholder:text-slate-400 resize-none"
                      />
                      <p className="text-[11px] text-slate-400 mt-1.5">Shown prominently to doctors before prescriptions.</p>
                    </div>

                    {/* Chronic Conditions */}
                    <div>
                      <div className="flex items-center gap-1.5 mb-2">
                        <span>🩺</span>
                        <label className="text-xs font-bold text-indigo-700 uppercase tracking-wider">Chronic Conditions</label>
                      </div>
                      <textarea
                        name="chronic_conditions"
                        rows="4"
                        placeholder="e.g. Hypertension, Type 2 Diabetes, Asthma"
                        value={healthProfile.chronic_conditions}
                        onChange={handleProfileChange}
                        className="w-full rounded-xl border border-indigo-200 bg-indigo-50/30 px-3.5 py-2.5 text-sm text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-400 transition placeholder:text-slate-400 resize-none"
                      />
                      <p className="text-[11px] text-slate-400 mt-1.5">Helps doctors personalize dosage and advice.</p>
                    </div>
                  </div>
                </div>

                {/* Emergency Contact Card */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/60">
                    <h3 className="text-sm font-black text-slate-800">Emergency Contact</h3>
                  </div>
                  <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Contact Name</label>
                      <input
                        type="text"
                        name="emergency_contact_name"
                        placeholder="e.g. Sarah Miller (Spouse)"
                        value={healthProfile.emergency_contact_name}
                        onChange={handleProfileChange}
                        className={inputCls}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Phone Number</label>
                      <input
                        type="tel"
                        name="emergency_contact_phone"
                        placeholder="+91 98765 43210"
                        value={healthProfile.emergency_contact_phone}
                        onChange={handleProfileChange}
                        className={inputCls}
                      />
                    </div>
                  </div>
                </div>

                {/* Save */}
                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={savingProfile}
                    className="px-7 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-sm shadow-sm transition disabled:opacity-50 cursor-pointer"
                  >
                    {savingProfile ? 'Saving…' : 'Save Health Profile'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* ════════════════════════════════════════════════
              MEDICAL RECORDS (TIMELINE)
          ════════════════════════════════════════════════ */}
          {activeTab === 'records' && (
            <div className="space-y-6">
              <SectionTitle sub="Chronological history of all your consultations and prescriptions">
                Medical Records
              </SectionTitle>

              {timeline.length === 0 ? (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">
                  <EmptyState
                    emoji="📋"
                    title="No medical records yet"
                    desc="Your consultation history, prescriptions, and documents will appear here after your first appointment."
                    action={
                      <Link to="/doctors" className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-xl shadow-sm transition">
                        Book Your First Consultation
                      </Link>
                    }
                  />
                </div>
              ) : (
                <div className="relative">
                  {/* Vertical timeline line */}
                  <div className="absolute left-5 top-4 bottom-4 w-px bg-slate-200 hidden sm:block" />

                  <div className="space-y-4">
                    {timeline.map((apt, idx) => (
                      <div key={apt.id} className="relative flex gap-5">
                        {/* Timeline dot */}
                        <div className={`hidden sm:flex w-10 h-10 rounded-full flex-shrink-0 items-center justify-center text-white text-xs font-black shadow-sm z-10 ${
                          apt.status === 'completed' ? 'bg-emerald-500'
                            : apt.status === 'accepted' ? 'bg-sky-500'
                            : apt.status === 'pending'  ? 'bg-amber-400'
                            : 'bg-slate-300'
                        }`}>
                          {apt.status === 'completed' ? '✓' : apt.status === 'cancelled' || apt.status === 'rejected' ? '✕' : '•'}
                        </div>

                        {/* Card */}
                        <div className="flex-1 bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow overflow-hidden">
                          <div className={`h-1 ${
                            apt.status === 'completed' ? 'bg-emerald-400'
                              : apt.status === 'accepted' ? 'bg-sky-400'
                              : apt.status === 'pending'  ? 'bg-amber-400'
                              : 'bg-slate-200'
                          }`} />
                          <div className="p-5">
                            <div className="flex items-start justify-between gap-4 flex-wrap">
                              <div className="flex items-start gap-3">
                                <Avatar name={apt.doctor_name} size="sm" />
                                <div>
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <h3 className="text-sm font-black text-slate-900">Dr. {apt.doctor_name}</h3>
                                    <StatusPill status={apt.status} />
                                    <TypeBadge type={apt.appointment_type} />
                                  </div>
                                  <p className="text-xs text-indigo-600 font-semibold mt-0.5">{apt.specialty}</p>
                                  <p className="text-xs text-slate-400 font-medium mt-1">
                                    {fmtDate(apt.date, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                                    {' · '}{fmtTime(apt.start_time)} – {fmtTime(apt.end_time)}
                                  </p>
                                </div>
                              </div>
                              <span className="text-[10px] font-mono text-slate-400 bg-slate-100 px-2 py-1 rounded-lg self-start">#{`APT-${apt.id}`}</span>
                            </div>

                            {/* Prescription row */}
                            {apt.prescription_id && (
                              <div className="mt-4 pt-4 border-t border-slate-100">
                                <div className="flex items-center justify-between gap-3 bg-teal-50 border border-teal-200 rounded-xl px-4 py-3">
                                  <div className="flex items-center gap-2">
                                    <span className="text-lg">💊</span>
                                    <div>
                                      <p className="text-xs font-bold text-teal-800">Prescription Issued</p>
                                      <p className="text-[11px] text-teal-600 font-medium">By Dr. {apt.doctor_name}</p>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <button
                                      onClick={() => openPrescriptionModal(apt.id)}
                                      className="px-3.5 py-1.5 bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold rounded-lg shadow-sm transition cursor-pointer"
                                    >
                                      View Rx
                                    </button>
                                    <button
                                      onClick={async () => { await openPrescriptionModal(apt.id); }}
                                      className="px-3.5 py-1.5 border border-teal-200 text-teal-700 hover:bg-teal-100 text-xs font-bold rounded-lg transition cursor-pointer"
                                    >
                                      ⬇ Download
                                    </button>
                                  </div>
                                </div>
                              </div>
                            )}

                            {/* Review */}
                            {apt.status === 'completed' && !apt.review_id && (
                              <div className="mt-3 flex items-center gap-2">
                                <button
                                  onClick={() => openReviewModal(apt)}
                                  className="text-xs font-semibold text-amber-600 hover:text-amber-800 flex items-center gap-1 cursor-pointer"
                                >
                                  ⭐ Leave a review
                                </button>
                              </div>
                            )}
                            {apt.review_rating && (
                              <div className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-amber-700">
                                {'⭐'.repeat(apt.review_rating)} Your rating: {apt.review_rating}/5
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ════════════════════════════════════════════════
              WAITLIST
          ════════════════════════════════════════════════ */}
          {activeTab === 'waitlist' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <SectionTitle sub="Auto-monitors cancellations and reserves freed slots with a 15-min claim window">
                  Priority Waitlist
                </SectionTitle>
                <Link to="/doctors" className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 cursor-pointer">
                  + Join another doctor's waitlist →
                </Link>
              </div>

              {waitlistItems.length === 0 ? (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">
                  <EmptyState
                    emoji="⏳"
                    title="You're not on any waitlists"
                    desc="When a doctor's schedule is full, join their waitlist to get first-priority access the moment a slot opens."
                    action={
                      <Link to="/doctors" className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-xl shadow-sm transition">
                        Find Specialists
                      </Link>
                    }
                  />
                </div>
              ) : (
                <div className="space-y-4">
                  {waitlistItems.map(item => {
                    const isOffered = item.status === 'offered';
                    const isWaiting = item.status === 'waiting';
                    return (
                      <div
                        key={item.id}
                        className={`bg-white rounded-2xl border shadow-sm overflow-hidden transition-all ${
                          isOffered ? 'border-emerald-300 ring-2 ring-emerald-200/60 shadow-md' : 'border-slate-200 hover:border-indigo-200'
                        }`}
                      >
                        <div className={`h-1 ${isOffered ? 'bg-emerald-400' : 'bg-indigo-200'}`} />
                        <div className="p-5">
                          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                            <div className="space-y-2">
                              <div className="flex items-center gap-2 flex-wrap">
                                {isOffered ? (
                                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-emerald-500 text-white animate-pulse shadow-sm">
                                    🎉 Slot Available — Claim Now!
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                                    Waiting in Queue
                                  </span>
                                )}
                                {isOffered && item.remaining_seconds > 0 && (
                                  <span className="text-xs font-mono font-black text-rose-600 bg-rose-50 border border-rose-200 px-2.5 py-1 rounded-full flex items-center gap-1">
                                    ⌛ {formatCountdown(item.remaining_seconds)}
                                  </span>
                                )}
                              </div>

                              <div className="flex items-center gap-3">
                                <Avatar name={item.doctor_name} size="sm" />
                                <div>
                                  <h3 className="text-base font-black text-slate-900">Dr. {item.doctor_name}</h3>
                                  <p className="text-xs font-semibold text-indigo-600 mt-0.5">
                                    {item.doctor_specialty} · ₹{item.doctor_fees}
                                  </p>
                                </div>
                              </div>

                              {isOffered && item.offered_slot_date && (
                                <div className="mt-2 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-semibold text-slate-800 space-y-1">
                                  <p className="text-emerald-800 font-black flex items-center gap-1.5">🗓️ Available slot freed for you:</p>
                                  <p className="pl-5 text-slate-700">
                                    {fmtDate(item.offered_slot_date, { weekday: 'short', month: 'short', day: 'numeric' })}
                                    {' · '}{fmtTime(item.offered_slot_start_time)} – {fmtTime(item.offered_slot_end_time)}
                                  </p>
                                </div>
                              )}

                              {isWaiting && (
                                <p className="text-xs text-slate-400 font-medium">
                                  Preferred: {item.preferred_date ? fmtDate(item.preferred_date) : 'Any date'} · {item.preferred_type ?? 'any'}
                                </p>
                              )}
                            </div>

                            <div className="flex items-center gap-2 self-start">
                              {isOffered && (
                                <button
                                  onClick={() => handleClaimWaitlist(item.id)}
                                  disabled={claimingWaitlistId === item.id}
                                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black rounded-xl shadow-md transition cursor-pointer disabled:opacity-50"
                                >
                                  {claimingWaitlistId === item.id ? 'Claiming…' : 'Claim Slot →'}
                                </button>
                              )}
                              {(isWaiting || isOffered) && (
                                <button
                                  onClick={() => handleCancelWaitlist(item.id)}
                                  className="px-4 py-2.5 border border-slate-200 text-slate-500 hover:text-rose-600 hover:border-rose-200 hover:bg-rose-50 text-xs font-semibold rounded-xl transition cursor-pointer"
                                >
                                  {isOffered ? 'Decline' : 'Leave'}
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

        </div>
      </main>

      {/* ══════════════════════════════════════════════════════
          MODAL — RESCHEDULE
      ══════════════════════════════════════════════════════ */}
      {rescheduleApt && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100">
              <h3 className="text-base font-black text-slate-900 flex items-center gap-2">🗓️ Reschedule Appointment</h3>
              <button onClick={() => setRescheduleApt(null)} className="text-slate-400 hover:text-slate-700 text-xl font-bold cursor-pointer transition">×</button>
            </div>

            <div className="p-6 space-y-4">
              <div className="bg-slate-50 rounded-xl border border-slate-200 p-4 text-xs space-y-1">
                <p className="font-black text-slate-900">Dr. {rescheduleApt.doctor_name} — {rescheduleApt.specialty}</p>
                <p className="text-slate-400 font-semibold">
                  Current: <span className="line-through">{fmtDate(rescheduleApt.date)} at {fmtTime(rescheduleApt.start_time)}</span>
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Select a New Slot</label>
                {availableSlots.length === 0 ? (
                  <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 p-3 rounded-xl font-medium">
                    No alternate slots available for Dr. {rescheduleApt.doctor_name}. Please check back later.
                  </p>
                ) : (
                  <div className="max-h-56 overflow-y-auto space-y-2 pr-1">
                    {availableSlots.map(s => (
                      <label
                        key={s.id}
                        className={`flex items-center justify-between p-3.5 rounded-xl border cursor-pointer transition ${
                          selectedSlotId === s.id.toString()
                            ? 'bg-indigo-50 border-indigo-500'
                            : 'bg-white border-slate-200 hover:border-indigo-300'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <input
                            type="radio"
                            name="new_slot"
                            value={s.id}
                            checked={selectedSlotId === s.id.toString()}
                            onChange={e => setSelectedSlotId(e.target.value)}
                            className="text-indigo-600"
                          />
                          <span className="text-sm font-bold text-slate-800">
                            {fmtDate(s.date, { weekday: 'short', month: 'short', day: 'numeric' })}
                          </span>
                        </div>
                        <span className="text-sm font-bold text-indigo-600">{fmtTime(s.start_time)} – {fmtTime(s.end_time)}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-2 px-6 py-4 border-t border-slate-100">
              <button onClick={() => setRescheduleApt(null)} className="px-4 py-2.5 border border-slate-200 text-slate-600 rounded-xl text-sm font-semibold hover:bg-slate-50 cursor-pointer transition">
                Cancel
              </button>
              <button
                onClick={handleRescheduleSubmit}
                disabled={rescheduling || !selectedSlotId}
                className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold shadow-sm transition disabled:opacity-50 cursor-pointer"
              >
                {rescheduling ? 'Rescheduling…' : 'Confirm New Slot'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════
          MODAL — PRESCRIPTION
      ══════════════════════════════════════════════════════ */}
      {selectedPrescription && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-start justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-200 my-8">
            {/* Action bar */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 print:hidden">
              <span className="text-xs font-black uppercase tracking-wider text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-full border border-emerald-200">
                ✓ Official Prescription
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleDownloadPdf}
                  disabled={isDownloadingPdf}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-sm transition inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  ⬇ {isDownloadingPdf ? 'Generating…' : 'Download PDF'}
                </button>
                <button
                  onClick={() => window.print()}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-xl shadow-sm transition inline-flex items-center gap-1.5 cursor-pointer"
                >
                  🖨️ Print
                </button>
                <button onClick={() => setSelectedPrescription(null)} className="text-slate-400 hover:text-slate-700 text-xl font-bold cursor-pointer transition p-1">×</button>
              </div>
            </div>

            {/* Printable content */}
            <div ref={prescriptionRef} className="p-6 sm:p-8 font-sans bg-white rounded-b-2xl">
              {/* Letterhead */}
              <div className="border-b-2 border-indigo-600 pb-5 mb-6 flex justify-between items-start gap-4">
                <div>
                  <h2 className="text-xl font-black bg-gradient-to-r from-indigo-600 to-sky-500 bg-clip-text text-transparent">
                    DocBook Care Network
                  </h2>
                  <p className="text-xs text-slate-400 font-medium mt-0.5">Clinical Outpatient Consultation</p>
                </div>
                <div className="text-right">
                  <p className="font-black text-slate-900">Dr. {selectedPrescription.doctor_name}</p>
                  <p className="text-xs text-indigo-600 font-bold uppercase mt-0.5">{selectedPrescription.doctor_specialty}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{selectedPrescription.doctor_experience} Yrs Exp.</p>
                </div>
              </div>

              {/* Patient meta */}
              <div className="bg-slate-50 rounded-xl border border-slate-200 p-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs mb-6">
                {[
                  { label: 'Patient', value: selectedPrescription.patient_name },
                  { label: 'Date', value: fmtDate(selectedPrescription.appointment_date) },
                  { label: 'Blood Group', value: selectedPrescription.blood_group || 'N/A', cls: 'text-rose-600 font-black' },
                  { label: 'Rx ID', value: `#RX-${selectedPrescription.id}`, cls: 'font-mono' },
                ].map(({ label, value, cls }) => (
                  <div key={label}>
                    <span className="text-slate-400 block font-bold mb-0.5">{label}</span>
                    <span className={`font-bold text-slate-800 ${cls ?? ''}`}>{value}</span>
                  </div>
                ))}
              </div>

              {/* Diagnosis */}
              <div className="mb-6">
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-400 mb-2">Clinical Diagnosis</h4>
                <div className="p-4 bg-indigo-50/60 border border-indigo-100 rounded-xl text-slate-900 font-bold text-sm">
                  {selectedPrescription.diagnosis}
                </div>
              </div>

              {/* Medications */}
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xl font-black text-indigo-600">℞</span>
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-700">Prescribed Medications</h4>
                </div>
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="min-w-full divide-y divide-slate-100 text-left text-xs">
                    <thead className="bg-slate-50 font-bold text-slate-500 uppercase tracking-wide">
                      <tr>
                        {['Medicine', 'Dosage', 'Frequency', 'Duration', 'Instructions'].map(col => (
                          <th key={col} className="py-3 px-3">{col}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 bg-white font-medium text-slate-700">
                      {(selectedPrescription.medications || []).length === 0 ? (
                        <tr><td colSpan="5" className="py-4 text-center text-slate-400 italic">No specific medications listed.</td></tr>
                      ) : (
                        (selectedPrescription.medications || []).map((med, idx) => (
                          <tr key={idx} className="hover:bg-slate-50/50">
                            <td className="py-3 px-3 font-bold text-slate-900">{med.name}</td>
                            <td className="py-3 px-3">{med.dosage || '—'}</td>
                            <td className="py-3 px-3">{med.frequency || '—'}</td>
                            <td className="py-3 px-3">{med.duration || '—'}</td>
                            <td className="py-3 px-3 text-slate-400 italic">{med.instructions || '—'}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Notes */}
              {selectedPrescription.notes && (
                <div className="mb-6">
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-400 mb-2">Doctor Notes & Advice</h4>
                  <p className="text-xs text-slate-700 font-semibold bg-slate-50 border border-slate-200 p-4 rounded-xl leading-relaxed">
                    {selectedPrescription.notes}
                  </p>
                </div>
              )}

              {/* Footer */}
              <div className="pt-5 border-t border-slate-200 flex justify-between items-end text-xs text-slate-400">
                <div>
                  <p className="font-mono text-[10px]">Issued: {new Date(selectedPrescription.created_at).toLocaleString()}</p>
                  <p className="text-[10px]">DocBook Care · Telemedicine & Clinic Management</p>
                </div>
                <div className="text-right">
                  <div className="border-b border-slate-300 pb-1 mb-1 font-bold text-slate-700">Dr. {selectedPrescription.doctor_name}</div>
                  <p className="text-[10px] text-emerald-600 font-black">✓ Digitally Verified</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════
          MODAL — REVIEW
      ══════════════════════════════════════════════════════ */}
      {reviewApt && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100">
              <h3 className="text-base font-black text-slate-900">⭐ Rate Your Consultation</h3>
              <button onClick={() => setReviewApt(null)} className="text-slate-400 hover:text-slate-700 text-xl font-bold cursor-pointer transition">×</button>
            </div>

            <form onSubmit={handleSubmitReview} className="p-6 space-y-5">
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                <p className="text-sm font-black text-slate-900">Dr. {reviewApt.doctor_name}</p>
                <p className="text-xs text-indigo-600 font-semibold mt-0.5">{reviewApt.specialty}</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Rating</label>
                <div className="flex gap-2">
                  {[1,2,3,4,5].map(star => (
                    <button
                      type="button"
                      key={star}
                      onClick={() => setRating(star)}
                      className={`text-3xl transition-transform hover:scale-110 cursor-pointer ${rating >= star ? 'opacity-100' : 'opacity-20 grayscale'}`}
                    >
                      ⭐
                    </button>
                  ))}
                  <span className="text-sm font-black text-amber-600 self-center ml-2">{rating}/5</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Your Feedback</label>
                <textarea
                  rows="3"
                  value={comment}
                  onChange={e => setComment(e.target.value)}
                  placeholder="Share your experience with this doctor..."
                  className={`${inputCls} resize-none`}
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setReviewApt(null)} className="px-4 py-2.5 border border-slate-200 text-slate-600 rounded-xl text-sm font-semibold cursor-pointer hover:bg-slate-50 transition">
                  Cancel
                </button>
                <button type="submit" disabled={submittingReview} className="px-6 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-sm font-bold shadow-sm transition disabled:opacity-50 cursor-pointer">
                  {submittingReview ? 'Submitting…' : 'Submit Review'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Chat Modal */}
      {activeChatApt && (
        <ConsultationChatModal appointmentId={activeChatApt.id} onClose={() => setActiveChatApt(null)} />
      )}
    </div>
  );
};

export default PatientDashboard;
