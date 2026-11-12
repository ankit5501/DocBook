import { useState, useEffect, useContext } from 'react';
import { Link } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import api from '../api/axios';
import { toast } from 'react-toastify';
import ConsultationChatModal from '../components/ConsultationChatModal';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  CartesianGrid
} from 'recharts';

/* ─── Tiny design-token helpers (no extra deps) ─────────────────────── */
const greeting = () => {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
};

const NAV_TABS = [
  { id: 'dashboard',   icon: '◼', label: 'Overview'     },
  { id: 'analytics',  icon: '◈', label: 'Analytics'     },
  { id: 'appointments',icon: '☰', label: 'Appointments'  },
  { id: 'queue',       icon: '⬡', label: 'Live Queue'    },
  { id: 'waitlist',    icon: '◷', label: 'Waitlist'      },
  { id: 'profile',     icon: '◉', label: 'Profile'       },
];

const PIE_COLORS = ['#10b981', '#f59e0b', '#3b82f6', '#ef4444', '#8b5cf6'];

/* ─── Reusable micro-components ─────────────────────────────────────── */

const StatusPill = ({ status }) => {
  const s = status?.toLowerCase();
  const map = {
    completed:  'bg-emerald-100 text-emerald-800 border-emerald-200',
    accepted:   'bg-sky-100 text-sky-800 border-sky-200',
    confirmed:  'bg-sky-100 text-sky-800 border-sky-200',
    pending:    'bg-amber-100 text-amber-800 border-amber-200',
    waiting:    'bg-amber-100 text-amber-800 border-amber-200',
    cancelled:  'bg-rose-100 text-rose-800 border-rose-200',
    rejected:   'bg-rose-100 text-rose-800 border-rose-200',
  };
  const cls = map[s] ?? 'bg-slate-100 text-slate-700 border-slate-200';
  const dot = {
    completed: 'bg-emerald-500', accepted: 'bg-sky-500', confirmed: 'bg-sky-500',
    pending: 'bg-amber-500', waiting: 'bg-amber-500',
    cancelled: 'bg-rose-500', rejected: 'bg-rose-500',
  };
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border ${cls}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${dot[s] ?? 'bg-slate-400'}`} />
      {status?.charAt(0).toUpperCase() + status?.slice(1)}
    </span>
  );
};

const TypeBadge = ({ type }) =>
  type === 'video' ? (
    <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-violet-700 bg-violet-50 border border-violet-200 px-2 py-0.5 rounded-full">
      <span className="w-1.5 h-1.5 rounded-full bg-violet-500 animate-pulse" />
      Video
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-slate-600 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-full">
      🏥 In-Person
    </span>
  );

const Avatar = ({ name = '', size = 'md' }) => {
  const initials = name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
  const sizes = { sm: 'w-8 h-8 text-xs', md: 'w-10 h-10 text-sm', lg: 'w-14 h-14 text-lg', xl: 'w-20 h-20 text-2xl' };
  return (
    <div className={`${sizes[size]} rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white font-bold flex-shrink-0 shadow-sm`}>
      {initials || '?'}
    </div>
  );
};

const KpiCard = ({ label, value, sub, icon, accent }) => {
  const accents = {
    indigo: { bar: 'bg-indigo-500', num: 'text-indigo-600', icon: 'bg-indigo-50 text-indigo-600 border-indigo-100' },
    emerald:{ bar: 'bg-emerald-500', num: 'text-emerald-600', icon: 'bg-emerald-50 text-emerald-600 border-emerald-100' },
    amber:  { bar: 'bg-amber-500', num: 'text-amber-600', icon: 'bg-amber-50 text-amber-600 border-amber-100' },
    violet: { bar: 'bg-violet-500', num: 'text-violet-700', icon: 'bg-violet-50 text-violet-600 border-violet-100' },
  };
  const a = accents[accent] ?? accents.indigo;
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow duration-200 overflow-hidden">
      <div className={`h-1 ${a.bar}`} />
      <div className="p-5 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider truncate">{label}</p>
          <p className={`text-3xl font-black mt-1.5 ${a.num}`}>{value}</p>
          {sub && <p className="text-[11px] text-slate-400 font-medium mt-1">{sub}</p>}
        </div>
        <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-xl border flex-shrink-0 ${a.icon}`}>
          {icon}
        </div>
      </div>
    </div>
  );
};

const SectionHeader = ({ title, subtitle, right }) => (
  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
    <div>
      <h2 className="text-lg font-black text-slate-900 tracking-tight">{title}</h2>
      {subtitle && <p className="text-xs text-slate-500 mt-0.5 font-medium">{subtitle}</p>}
    </div>
    {right}
  </div>
);

const ChartCard = ({ title, badge, badgeCls, children }) => (
  <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
    <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
      <h3 className="text-sm font-black text-slate-800 uppercase tracking-tight">{title}</h3>
      {badge && <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full border ${badgeCls}`}>{badge}</span>}
    </div>
    <div className="p-6">{children}</div>
  </div>
);

const EmptyState = ({ emoji, title, desc }) => (
  <div className="text-center py-16 px-4">
    <span className="text-5xl">{emoji}</span>
    <h4 className="text-sm font-bold text-slate-700 mt-4">{title}</h4>
    {desc && <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">{desc}</p>}
  </div>
);

const tooltipStyle = {
  backgroundColor: '#0f172a',
  borderColor: '#1e293b',
  borderRadius: '10px',
  color: '#fff',
  fontSize: '12px',
  padding: '8px 12px',
};

/* ─── Main Component ─────────────────────────────────────────────────── */
const DoctorDashboard = () => {
  const { user } = useContext(AuthContext);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [scheduleMode, setScheduleMode] = useState('all');
  const [profile, setProfile] = useState({ specialty: '', fees: '', experience: '' });
  const [slot, setSlot] = useState({ date: '', start_time: '', end_time: '' });
  const [mySlots, setMySlots] = useState([]);

  // Prescription & Health Summary Modals State
  const [prescriptionModalApt, setPrescriptionModalApt] = useState(null);
  const [prescriptionForm, setPrescriptionForm] = useState({
    diagnosis: '',
    notes: '',
    medications: [{ name: '', dosage: '', frequency: '', duration: '', instructions: '' }]
  });
  const [savingPrescription, setSavingPrescription] = useState(false);

  const [patientSummaryModal, setPatientSummaryModal] = useState(null);
  const [loadingPatientSummary, setLoadingPatientSummary] = useState(false);

  // Real-Time Consultation Chat State
  const [activeChatApt, setActiveChatApt] = useState(null);

  // Live Clinic Queue & Token Coordination State
  const [liveQueue, setLiveQueue] = useState({
    currently_serving: null,
    waiting_count: 0,
    completed_count: 0,
    rolling_average_pace_minutes: 12,
    tokens: []
  });
  const [callingNext, setCallingNext] = useState(false);
  const [completingConsult, setCompletingConsult] = useState(false);

  // Priority Waitlist Queue State
  const [waitlistQueue, setWaitlistQueue] = useState([]);

  // Aggregation State directly from PostgreSQL DB
  const [dashboardStats, setDashboardStats] = useState({
    todaysOverview: {
      todaysAppointments: 0,
      todaysCompleted: 0,
      todaysPending: 0,
      todaysRevenue: 0
    },
    overallOverview: {
      totalAppointments: 0,
      totalCompleted: 0,
      totalPending: 0,
      totalRevenue: 0
    },
    todaysSchedule: [],
    allSchedule: [],
    appointmentsPerDay: [],
    revenuePerWeek: [],
    statusBreakdown: [],
    patientStats: {
      totalPatients: 0,
      newPatients: 0,
      returningPatients: 0,
      topPatients: []
    }
  });

  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('all');

  useEffect(() => {
    fetchDashboardData();
    fetchLiveQueue();
    fetchWaitlistQueue();

    const handleNotification = () => {
      fetchDashboardData();
      fetchLiveQueue();
      fetchWaitlistQueue();
    };

    window.addEventListener('new-notification', handleNotification);
    return () => {
      window.removeEventListener('new-notification', handleNotification);
    };
  }, []);

  const fetchLiveQueue = async () => {
    try {
      const res = await api.get('/clinic-queue/doctor/live');
      if (res.data) setLiveQueue(res.data);
    } catch (err) {
      console.warn('Could not load live clinic queue:', err.message);
    }
  };

  const fetchWaitlistQueue = async () => {
    try {
      const res = await api.get('/waitlist/doctor');
      if (res.data) setWaitlistQueue(res.data);
    } catch (err) {
      console.warn('Could not load doctor waitlist queue:', err.message);
    }
  };

  const handleCallNextPatient = async () => {
    setCallingNext(true);
    try {
      const res = await api.post('/clinic-queue/call-next');
      toast.success(res.data.message || 'Next patient called!');
      await fetchLiveQueue();
      await fetchDashboardData();
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || 'Failed to call next patient');
    } finally {
      setCallingNext(false);
    }
  };

  const handleCompleteCurrentConsultation = async () => {
    setCompletingConsult(true);
    try {
      const res = await api.post('/clinic-queue/complete');
      toast.success(res.data.message || 'Consultation completed!');
      await fetchLiveQueue();
      await fetchDashboardData();
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || 'Failed to complete consultation');
    } finally {
      setCompletingConsult(false);
    }
  };

  const handleMarkNoShow = async (tokenId) => {
    try {
      await api.post(`/clinic-queue/${tokenId}/no-show`);
      toast.info('Marked patient as no-show');
      await fetchLiveQueue();
    } catch (err) {
      console.error(err);
      toast.error('Failed to mark no-show');
    }
  };

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const [statsRes, appointmentsRes] = await Promise.allSettled([
        api.get('/doctors/dashboard-stats'),
        api.get('/appointments/doctor')
      ]);

      if (statsRes.status === 'fulfilled' && statsRes.value.data) {
        setDashboardStats(statsRes.value.data);
      }

      if (appointmentsRes.status === 'fulfilled' && appointmentsRes.value.data) {
        setAppointments(appointmentsRes.value.data);
      }

      try {
        const profileRes = await api.get('/doctors/profile');
        if (profileRes.data) {
          setProfile({
            specialty: profileRes.data.specialty || '',
            fees: profileRes.data.fees || '',
            experience: profileRes.data.experience || ''
          });
        }
      } catch (profileErr) {
        console.warn('Profile not set up yet:', profileErr.message);
      }

      try {
        const slotsRes = await api.get('/doctors/profile/slots');
        setMySlots(slotsRes.data || []);
      } catch (slotsErr) {
        console.warn('Could not retrieve slots:', slotsErr.message);
      }
    } catch (err) {
      console.error('Error fetching doctor dashboard:', err);
      toast.error('Failed to load doctor dashboard telemetry');
    } finally {
      setLoading(false);
    }
  };

  const handleProfileChange = (e) => setProfile({ ...profile, [e.target.name]: e.target.value });
  const handleSlotChange = (e) => setSlot({ ...slot, [e.target.name]: e.target.value });

  const updateProfile = async (e) => {
    e.preventDefault();
    try {
      await api.put('/doctors/profile', profile);
      toast.success('Profile updated successfully!');
      fetchDashboardData();
    } catch (err) {
      toast.error('Failed to update profile');
    }
  };

  const addSlot = async (e) => {
    e.preventDefault();
    try {
      await api.post('/doctors/slots', slot);
      toast.success('Slot added successfully!');
      setSlot({ date: '', start_time: '', end_time: '' });
      fetchDashboardData();
    } catch (err) {
      toast.error('Failed to add slot');
    }
  };

  const handleDeleteSlot = async (slotId) => {
    if (window.confirm('Are you sure you want to delete this available timeslot?')) {
      try {
        await api.delete(`/doctors/slots/${slotId}`);
        toast.success('Slot deleted successfully!');
        fetchDashboardData();
      } catch (err) {
        toast.error(err.response?.data?.message || 'Failed to delete slot');
      }
    }
  };

  const handleStatusUpdate = async (appointmentId, newStatus) => {
    try {
      await api.patch(`/appointments/${appointmentId}/status`, { status: newStatus });
      toast.success(`Appointment status updated to: ${newStatus}`);
      fetchDashboardData();
    } catch (err) {
      toast.error('Failed to update appointment status');
    }
  };

  const openPrescriptionModal = async (apt) => {
    setPrescriptionModalApt(apt);
    setPrescriptionForm({
      diagnosis: '',
      notes: '',
      medications: [{ name: '', dosage: '', frequency: '', duration: '', instructions: '' }]
    });

    try {
      const res = await api.get(`/appointments/${apt.id}/prescription`);
      if (res.data) {
        setPrescriptionForm({
          diagnosis: res.data.diagnosis || '',
          notes: res.data.notes || '',
          medications: (res.data.medications && res.data.medications.length > 0)
            ? res.data.medications
            : [{ name: '', dosage: '', frequency: '', duration: '', instructions: '' }]
        });
      }
    } catch (err) {
      // fresh template
    }
  };

  const handleMedicationChange = (index, field, value) => {
    const updated = [...prescriptionForm.medications];
    updated[index][field] = value;
    setPrescriptionForm({ ...prescriptionForm, medications: updated });
  };

  const addMedicationRow = () => {
    setPrescriptionForm({
      ...prescriptionForm,
      medications: [
        ...prescriptionForm.medications,
        { name: '', dosage: '', frequency: '', duration: '', instructions: '' }
      ]
    });
  };

  const removeMedicationRow = (index) => {
    const updated = prescriptionForm.medications.filter((_, idx) => idx !== index);
    setPrescriptionForm({ ...prescriptionForm, medications: updated });
  };

  const handleSavePrescription = async (e) => {
    e.preventDefault();
    if (!prescriptionForm.diagnosis.trim()) {
      toast.warning('Please enter a clinical diagnosis');
      return;
    }
    setSavingPrescription(true);
    try {
      await api.post(`/appointments/${prescriptionModalApt.id}/prescription`, prescriptionForm);
      toast.success('Digital prescription issued and sent to patient!');
      setPrescriptionModalApt(null);
      fetchDashboardData();
    } catch (err) {
      console.error(err);
      toast.error('Failed to issue prescription');
    } finally {
      setSavingPrescription(false);
    }
  };

  const openPatientHealthSummary = async (patientId, patientName) => {
    setLoadingPatientSummary(true);
    setPatientSummaryModal({ name: patientName, loading: true });
    try {
      const res = await api.get(`/patient/profile/${patientId}`);
      setPatientSummaryModal(res.data);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load patient medical profile');
      setPatientSummaryModal(null);
    } finally {
      setLoadingPatientSummary(false);
    }
  };

  // Filtered appointments list
  const filteredAppointments = appointments.filter((apt) => {
    if (filterStatus === 'all') return true;
    return apt.status === filterStatus;
  });

  // Real Aggregated Database Objects
  const todaysOverview = dashboardStats.todaysOverview || { todaysAppointments: 0, todaysCompleted: 0, todaysPending: 0, todaysRevenue: 0 };
  const overallOverview = dashboardStats.overallOverview || { totalAppointments: 0, totalCompleted: 0, totalPending: 0, totalRevenue: 0 };

  const activeScheduleItems = scheduleMode === 'today'
    ? (dashboardStats.todaysSchedule || [])
    : (dashboardStats.allSchedule || []);

  const appointmentsPerDayData = dashboardStats.appointmentsPerDay || [];
  const revenuePerWeekData = dashboardStats.revenuePerWeek || [];
  const statusPieData = (dashboardStats.statusBreakdown || []).map((item) => {
    let color = '#6366f1';
    if (item.name === 'completed') color = '#10b981';
    else if (item.name === 'pending') color = '#f59e0b';
    else if (item.name === 'cancelled' || item.name === 'rejected') color = '#ef4444';
    else if (item.name === 'accepted') color = '#3b82f6';
    return { name: item.name.charAt(0).toUpperCase() + item.name.slice(1), value: item.value, color };
  });

  const patientStats = dashboardStats.patientStats || { totalPatients: 0, newPatients: 0, returningPatients: 0, topPatients: [] };

  // Slot grouping by date
  const slotsByDate = mySlots.reduce((acc, s) => {
    const d = new Date(s.date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
    if (!acc[d]) acc[d] = [];
    acc[d].push(s);
    return acc;
  }, {});

  /* ─── INPUT STYLE ───────────────────────────────────────── */
  const inputCls = 'w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 transition placeholder:text-slate-400';

  /* ══════════════════════════════════════════════════════════
     RENDER
  ══════════════════════════════════════════════════════════ */
  return (
    <div className="min-h-screen bg-slate-50">

      {/* ── HERO BANNER ──────────────────────────────────────── */}
      <div className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900">
        {/* Decorative orbs */}
        <div className="absolute -top-24 -right-24 w-72 h-72 rounded-full bg-indigo-600/20 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-16 -left-16 w-56 h-56 rounded-full bg-violet-600/15 blur-3xl pointer-events-none" />

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-6">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">

            {/* Greeting */}
            <div className="flex items-center gap-4">
              <Avatar name={user?.name || ''} size="lg" />
              <div>
                <p className="text-indigo-300/80 text-sm font-medium">
                  {greeting()},
                </p>
                <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                  Dr. {user?.name}
                </h1>
                <div className="flex items-center gap-2 mt-1.5">
                  {profile.specialty && (
                    <span className="text-xs font-semibold text-indigo-200 bg-indigo-500/20 border border-indigo-500/30 px-2.5 py-0.5 rounded-full">
                      {profile.specialty}
                    </span>
                  )}
                  <span className="text-xs text-slate-400 font-medium">
                    {new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                  </span>
                </div>
              </div>
            </div>

            {/* Nav tabs */}
            <nav className="flex flex-wrap gap-1.5 bg-white/8 border border-white/10 backdrop-blur-sm p-1.5 rounded-2xl">
              {NAV_TABS.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-4 py-2 rounded-xl font-semibold text-xs sm:text-sm transition-all duration-200 cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                    activeTab === tab.id
                      ? 'bg-white text-indigo-900 shadow-md font-bold'
                      : 'text-indigo-200/80 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <span className="opacity-70">{tab.icon}</span>
                  {tab.label}
                  {tab.id === 'appointments' && (
                    <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full ${activeTab === tab.id ? 'bg-indigo-100 text-indigo-700' : 'bg-white/15 text-white'}`}>
                      {appointments.length}
                    </span>
                  )}
                  {tab.id === 'queue' && (
                    <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full ${activeTab === tab.id ? 'bg-indigo-100 text-indigo-700' : 'bg-white/15 text-white'}`}>
                      {liveQueue.waiting_count || 0}
                    </span>
                  )}
                </button>
              ))}
            </nav>
          </div>
        </div>
      </div>

      {/* ── PAGE BODY ─────────────────────────────────────────── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {loading ? (
          <div className="flex flex-col items-center justify-center py-32 gap-4">
            <div className="relative w-16 h-16">
              <div className="absolute inset-0 rounded-full border-4 border-indigo-100" />
              <div className="absolute inset-0 rounded-full border-4 border-t-indigo-600 animate-spin" />
            </div>
            <p className="text-slate-500 text-sm font-semibold">Loading dashboard data…</p>
          </div>
        ) : (
          <>
            {/* ══════════════════════════════════════════════════
                TAB 1 — DASHBOARD OVERVIEW
            ══════════════════════════════════════════════════ */}
            {activeTab === 'dashboard' && (
              <div className="space-y-8">

                {/* KPI Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                  <KpiCard
                    label="Total Appointments"
                    value={overallOverview.totalAppointments}
                    sub={`Today: ${todaysOverview.todaysAppointments}`}
                    icon="📋"
                    accent="indigo"
                  />
                  <KpiCard
                    label="Completed"
                    value={overallOverview.totalCompleted}
                    sub={`Today: ${todaysOverview.todaysCompleted}`}
                    icon="✓"
                    accent="emerald"
                  />
                  <KpiCard
                    label="Pending Requests"
                    value={overallOverview.totalPending}
                    sub={`Today: ${todaysOverview.todaysPending}`}
                    icon="⏳"
                    accent="amber"
                  />
                  <KpiCard
                    label="Total Earnings"
                    value={`₹${overallOverview.totalRevenue.toLocaleString()}`}
                    sub={`Today: ₹${todaysOverview.todaysRevenue.toLocaleString()}`}
                    icon="₹"
                    accent="violet"
                  />
                </div>

                {/* Appointment Schedule */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-6 py-5 border-b border-slate-100">
                    <div>
                      <h2 className="text-base font-black text-slate-900 tracking-tight">Appointment Schedule</h2>
                      <p className="text-xs text-slate-500 mt-0.5">Live patient bookings from database</p>
                    </div>
                    <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 self-start sm:self-auto gap-0.5">
                      {[
                        { mode: 'today', label: `Today (${dashboardStats.todaysSchedule?.length ?? 0})` },
                        { mode: 'all',   label: `All (${dashboardStats.allSchedule?.length ?? 0})` },
                      ].map(({ mode, label }) => (
                        <button
                          key={mode}
                          onClick={() => setScheduleMode(mode)}
                          className={`px-4 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                            scheduleMode === mode
                              ? 'bg-white text-indigo-900 shadow-sm'
                              : 'text-slate-500 hover:text-slate-800'
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {activeScheduleItems.length === 0 ? (
                    <EmptyState emoji="📅" title="No appointments in this view" desc="When patients book a slot with you, their details appear here automatically." />
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="min-w-full">
                        <thead>
                          <tr className="bg-slate-50 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100">
                            <th className="px-6 py-3.5">Patient</th>
                            <th className="px-6 py-3.5">Date & Time</th>
                            <th className="px-6 py-3.5">Type</th>
                            <th className="px-6 py-3.5">Status</th>
                            <th className="px-6 py-3.5 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                          {activeScheduleItems.map((item) => {
                            const timeFormatted = item.start_time ? item.start_time.substring(0, 5) : '10:00';
                            const dateFormatted = item.date ? new Date(item.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '';
                            return (
                              <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                                <td className="px-6 py-4">
                                  <div className="flex items-center gap-3">
                                    <Avatar name={item.patient_name} size="sm" />
                                    <div>
                                      <p className="text-sm font-bold text-slate-900">{item.patient_name}</p>
                                      <button
                                        onClick={() => openPatientHealthSummary(item.patient_id, item.patient_name)}
                                        className="text-[11px] text-indigo-600 hover:text-indigo-800 font-semibold flex items-center gap-1 mt-0.5 cursor-pointer"
                                      >
                                        View health summary →
                                      </button>
                                    </div>
                                  </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <p className="text-sm font-bold text-slate-800">{dateFormatted}</p>
                                  <p className="text-xs text-slate-400 font-mono mt-0.5">{timeFormatted}</p>
                                </td>
                                <td className="px-6 py-4">
                                  <TypeBadge type={item.appointment_type} />
                                </td>
                                <td className="px-6 py-4">
                                  <StatusPill status={item.status} />
                                </td>
                                <td className="px-6 py-4 text-right">
                                  <div className="flex items-center justify-end gap-1.5 flex-wrap">
                                    {item.appointment_type === 'video' && (item.status === 'accepted' || item.status === 'completed') && (
                                      <Link
                                        to={`/consultation/video/${item.id}`}
                                        className="text-xs font-bold bg-violet-600 hover:bg-violet-700 text-white px-3 py-1.5 rounded-lg shadow-sm transition active:scale-95 cursor-pointer inline-flex items-center gap-1"
                                      >
                                        📹 Join
                                      </Link>
                                    )}
                                    {(item.status === 'accepted' || item.status === 'completed') && (
                                      <button
                                        onClick={() => setActiveChatApt(item)}
                                        className="text-xs font-bold bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 px-3 py-1.5 rounded-lg shadow-sm transition active:scale-95 cursor-pointer"
                                      >
                                        💬 Chat
                                      </button>
                                    )}
                                    {item.status === 'pending' && (
                                      <>
                                        <button
                                          onClick={() => handleStatusUpdate(item.id, 'accepted')}
                                          className="text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg shadow-sm transition active:scale-95 cursor-pointer"
                                        >
                                          Accept
                                        </button>
                                        <button
                                          onClick={() => handleStatusUpdate(item.id, 'rejected')}
                                          className="text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white px-3 py-1.5 rounded-lg shadow-sm transition active:scale-95 cursor-pointer"
                                        >
                                          Reject
                                        </button>
                                      </>
                                    )}
                                    {item.status === 'accepted' && (
                                      <button
                                        onClick={() => handleStatusUpdate(item.id, 'completed')}
                                        className="text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white px-3.5 py-1.5 rounded-lg shadow-sm transition active:scale-95 cursor-pointer"
                                      >
                                        ✓ Complete
                                      </button>
                                    )}
                                    {item.status === 'completed' && (
                                      <button
                                        onClick={() => openPrescriptionModal(item)}
                                        className="text-xs font-bold bg-teal-50 text-teal-700 hover:bg-teal-100 border border-teal-200 px-3 py-1.5 rounded-lg shadow-sm transition active:scale-95 cursor-pointer"
                                      >
                                        💊 {item.prescription_id ? 'Edit Rx' : 'Issue Rx'}
                                      </button>
                                    )}
                                    {(item.status === 'cancelled' || item.status === 'rejected') && (
                                      <span className="text-xs text-slate-400 italic font-medium">Cancelled</span>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* Quick Charts */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <ChartCard title="Appointments per Day" badge="Daily Volume" badgeCls="bg-indigo-50 text-indigo-700 border-indigo-200">
                    {appointmentsPerDayData.length === 0 ? (
                      <div className="h-56 flex items-center justify-center text-xs text-slate-400 font-semibold bg-slate-50 rounded-xl border border-dashed border-slate-200">
                        No appointment history yet
                      </div>
                    ) : (
                      <div className="h-56">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={appointmentsPerDayData} barGap={4}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                            <XAxis dataKey="day" stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
                            <YAxis stroke="#94a3b8" fontSize={11} allowDecimals={false} tickLine={false} axisLine={false} />
                            <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'rgba(99,102,241,0.05)' }} />
                            <Bar dataKey="appointments" fill="#6366f1" radius={[4,4,0,0]} name="Total" />
                            <Bar dataKey="completed"    fill="#10b981" radius={[4,4,0,0]} name="Completed" />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                  </ChartCard>

                  <ChartCard title="Earnings per Week" badge="₹ Revenue" badgeCls="bg-emerald-50 text-emerald-700 border-emerald-200">
                    {revenuePerWeekData.length === 0 ? (
                      <div className="h-56 flex items-center justify-center text-xs text-slate-400 font-semibold bg-slate-50 rounded-xl border border-dashed border-slate-200">
                        No payment records yet
                      </div>
                    ) : (
                      <div className="h-56">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={revenuePerWeekData}>
                            <defs>
                              <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%"  stopColor="#10b981" stopOpacity={0.3} />
                                <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                            <XAxis dataKey="week" stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
                            <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
                            <Tooltip formatter={(v) => [`₹${v.toLocaleString()}`, 'Revenue']} contentStyle={tooltipStyle} />
                            <Area type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={2.5} fill="url(#revGrad)" />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                  </ChartCard>
                </div>
              </div>
            )}

            {/* ══════════════════════════════════════════════════
                TAB 2 — ANALYTICS
            ══════════════════════════════════════════════════ */}
            {activeTab === 'analytics' && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Appointments Per Day */}
                  <ChartCard title="Appointments per Day" badge="All Records" badgeCls="bg-indigo-50 text-indigo-700 border-indigo-200">
                    <p className="text-xs text-slate-400 mb-5 font-medium">Aggregated daily booking volume from database</p>
                    {appointmentsPerDayData.length === 0 ? (
                      <div className="h-64 flex items-center justify-center bg-slate-50 rounded-xl border border-dashed border-slate-200 text-xs text-slate-400 font-semibold">
                        No appointment records in database.
                      </div>
                    ) : (
                      <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={appointmentsPerDayData} barGap={4}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                            <XAxis dataKey="day" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                            <YAxis stroke="#94a3b8" fontSize={12} allowDecimals={false} tickLine={false} axisLine={false} />
                            <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'rgba(99,102,241,0.05)' }} />
                            <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '11px' }} />
                            <Bar dataKey="appointments" fill="#4f46e5" radius={[4,4,0,0]} name="Total Booked" />
                            <Bar dataKey="completed"    fill="#10b981" radius={[4,4,0,0]} name="Completed" />
                            <Bar dataKey="cancelled"    fill="#ef4444" radius={[4,4,0,0]} name="Cancelled" />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                  </ChartCard>

                  {/* Revenue Per Week */}
                  <ChartCard title="Revenue per Week" badge="₹ Payments" badgeCls="bg-emerald-50 text-emerald-700 border-emerald-200">
                    <p className="text-xs text-slate-400 mb-5 font-medium">Sum of cleared consultation payments per week</p>
                    {revenuePerWeekData.length === 0 ? (
                      <div className="h-64 flex items-center justify-center bg-slate-50 rounded-xl border border-dashed border-slate-200 text-xs text-slate-400 font-semibold">
                        No payment data recorded in database.
                      </div>
                    ) : (
                      <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={revenuePerWeekData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                            <XAxis dataKey="week" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                            <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                            <Tooltip formatter={(v) => [`₹${v.toLocaleString()}`, 'Revenue']} contentStyle={tooltipStyle} />
                            <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '11px' }} />
                            <Bar dataKey="revenue" fill="#10b981" radius={[4,4,0,0]} name="Revenue (₹)" />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                  </ChartCard>

                  {/* Status Pie Chart */}
                  <ChartCard title="Consultation Outcomes" badge="Status Breakdown" badgeCls="bg-violet-50 text-violet-700 border-violet-200">
                    <p className="text-xs text-slate-400 mb-4 font-medium">Percentage breakdown of all consultation results</p>
                    {statusPieData.length === 0 ? (
                      <div className="h-64 flex items-center justify-center bg-slate-50 rounded-xl border border-dashed border-slate-200 text-xs text-slate-400 font-semibold">
                        No status records found.
                      </div>
                    ) : (
                      <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={statusPieData}
                              cx="50%" cy="50%"
                              innerRadius={60} outerRadius={95}
                              paddingAngle={4}
                              dataKey="value"
                              label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                              labelLine={false}
                            >
                              {statusPieData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.color || PIE_COLORS[index % PIE_COLORS.length]} />
                              ))}
                            </Pie>
                            <Tooltip contentStyle={tooltipStyle} />
                            <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '11px' }} />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                  </ChartCard>

                  {/* Patient Statistics */}
                  <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
                      <h3 className="text-sm font-black text-slate-800 uppercase tracking-tight">Patient Statistics</h3>
                      <span className="text-[11px] font-bold px-2.5 py-1 rounded-full border bg-sky-50 text-sky-700 border-sky-200">Demographics</span>
                    </div>
                    <div className="p-6">
                      <div className="grid grid-cols-3 gap-3 mb-6">
                        {[
                          { label: 'Total Unique', value: patientStats.totalPatients, cls: 'bg-indigo-50 text-indigo-600 border-indigo-100' },
                          { label: 'New Patients', value: patientStats.newPatients, cls: 'bg-emerald-50 text-emerald-600 border-emerald-100' },
                          { label: 'Returning', value: patientStats.returningPatients, cls: 'bg-amber-50 text-amber-600 border-amber-100' },
                        ].map(({ label, value, cls }) => (
                          <div key={label} className={`p-4 rounded-xl border text-center ${cls}`}>
                            <p className="text-[10px] font-black uppercase tracking-wide mb-1 opacity-80">{label}</p>
                            <p className="text-2xl font-black">{value}</p>
                          </div>
                        ))}
                      </div>

                      <h4 className="text-xs font-black text-slate-400 uppercase tracking-wider mb-3">Top Patients</h4>
                      {(!patientStats.topPatients || patientStats.topPatients.length === 0) ? (
                        <p className="text-xs text-slate-400 text-center py-6">No patient records found.</p>
                      ) : (
                        <div className="space-y-2">
                          {patientStats.topPatients.map((p, idx) => (
                            <div key={idx} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100">
                              <div className="flex items-center gap-2.5">
                                <span className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 text-[10px] font-black flex items-center justify-center">
                                  {idx + 1}
                                </span>
                                <div>
                                  <p className="text-xs font-bold text-slate-900">{p.name}</p>
                                  <p className="text-[10px] text-slate-400">{p.email}</p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2 text-right">
                                <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-100">
                                  {p.visits} visits
                                </span>
                                <span className="text-xs font-black text-slate-700">₹{p.spent.toLocaleString()}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ══════════════════════════════════════════════════
                TAB 3 — APPOINTMENT MANAGEMENT
            ══════════════════════════════════════════════════ */}
            {activeTab === 'appointments' && (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                {/* Header + Filters */}
                <div className="px-6 py-5 border-b border-slate-100">
                  <SectionHeader
                    title="Consultation Bookings"
                    subtitle="Manage all patient appointments — accept, complete, or issue prescriptions"
                    right={
                      <div className="flex flex-wrap gap-1.5">
                        {['all', 'pending', 'accepted', 'completed', 'cancelled', 'rejected'].map((s) => (
                          <button
                            key={s}
                            onClick={() => setFilterStatus(s)}
                            className={`text-xs px-3.5 py-2 rounded-full font-semibold capitalize transition-all cursor-pointer border ${
                              filterStatus === s
                                ? 'bg-indigo-900 text-white border-indigo-900 shadow-sm'
                                : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300 hover:text-indigo-700'
                            }`}
                          >
                            {s} ({s === 'all' ? appointments.length : appointments.filter(a => a.status === s).length})
                          </button>
                        ))}
                      </div>
                    }
                  />
                </div>

                {/* Table */}
                <div className="overflow-x-auto">
                  <table className="min-w-full">
                    <thead>
                      <tr className="bg-slate-50 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100">
                        <th className="px-6 py-4">Patient</th>
                        <th className="px-6 py-4">Date & Time</th>
                        <th className="px-6 py-4">Type</th>
                        <th className="px-6 py-4">Status</th>
                        <th className="px-6 py-4">Payment</th>
                        <th className="px-6 py-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {filteredAppointments.length === 0 ? (
                        <tr>
                          <td colSpan="6">
                            <EmptyState emoji="🗓️" title="No appointments found" desc="No appointments match the selected filter." />
                          </td>
                        </tr>
                      ) : (
                        filteredAppointments.map((apt) => (
                          <tr key={apt.id} className="hover:bg-slate-50/60 transition-colors">
                            {/* Patient */}
                            <td className="px-6 py-4">
                              <div className="flex items-start gap-3">
                                <Avatar name={apt.patient_name} size="sm" />
                                <div className="min-w-0">
                                  <p className="text-sm font-bold text-slate-900 truncate">{apt.patient_name}</p>
                                  <p className="text-xs text-slate-400 font-medium">{apt.patient_email}</p>
                                  <div className="flex flex-wrap gap-1 mt-1.5">
                                    {apt.patient_allergies && (
                                      <span className="text-[10px] bg-rose-50 text-rose-700 border border-rose-200 px-1.5 py-0.5 rounded-full font-semibold">
                                        ⚠️ Allergy on file
                                      </span>
                                    )}
                                    <button
                                      onClick={() => openPatientHealthSummary(apt.patient_id, apt.patient_name)}
                                      className="text-[10px] text-indigo-600 hover:text-indigo-800 font-semibold cursor-pointer"
                                    >
                                      Medical summary →
                                    </button>
                                  </div>
                                </div>
                              </div>
                            </td>

                            {/* Date & Time */}
                            <td className="px-6 py-4 whitespace-nowrap">
                              <p className="text-sm font-bold text-slate-800">
                                {new Date(apt.date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                              </p>
                              <p className="text-xs font-mono text-slate-400 mt-0.5">
                                {apt.start_time.substring(0, 5)} – {apt.end_time.substring(0, 5)}
                              </p>
                            </td>

                            {/* Type */}
                            <td className="px-6 py-4">
                              <TypeBadge type={apt.appointment_type} />
                            </td>

                            {/* Status */}
                            <td className="px-6 py-4">
                              <StatusPill status={apt.status} />
                            </td>

                            {/* Payment */}
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border ${
                                apt.payment_status === 'completed'
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                  : 'bg-amber-50 text-amber-700 border-amber-200'
                              }`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${apt.payment_status === 'completed' ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                                {apt.payment_status === 'completed' ? 'Paid' : 'Pending'}
                              </span>
                            </td>

                            {/* Actions */}
                            <td className="px-6 py-4 text-right">
                              <div className="flex items-center justify-end gap-1.5 flex-wrap">
                                {apt.appointment_type === 'video' && (apt.status === 'accepted' || apt.status === 'completed') && (
                                  <Link
                                    to={`/consultation/video/${apt.id}`}
                                    className="bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold px-3 py-2 rounded-lg shadow-sm transition active:scale-95 cursor-pointer inline-flex items-center gap-1"
                                  >
                                    📹 Video
                                  </Link>
                                )}
                                {(apt.status === 'accepted' || apt.status === 'completed') && (
                                  <button
                                    onClick={() => setActiveChatApt(apt)}
                                    className="bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 text-xs font-bold px-3 py-2 rounded-lg shadow-sm transition active:scale-95 cursor-pointer inline-flex items-center gap-1"
                                  >
                                    💬 Chat
                                  </button>
                                )}
                                {apt.status === 'pending' && (
                                  <>
                                    <button
                                      onClick={() => handleStatusUpdate(apt.id, 'accepted')}
                                      className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-3.5 py-2 rounded-lg shadow-sm transition active:scale-95 cursor-pointer"
                                    >
                                      Accept
                                    </button>
                                    <button
                                      onClick={() => handleStatusUpdate(apt.id, 'rejected')}
                                      className="bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold px-3.5 py-2 rounded-lg shadow-sm transition active:scale-95 cursor-pointer"
                                    >
                                      Reject
                                    </button>
                                  </>
                                )}
                                {apt.status === 'accepted' && (
                                  <button
                                    onClick={() => handleStatusUpdate(apt.id, 'completed')}
                                    className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-3.5 py-2 rounded-lg shadow-sm transition active:scale-95 cursor-pointer"
                                  >
                                    ✓ Complete
                                  </button>
                                )}
                                {apt.status === 'completed' && (
                                  <button
                                    onClick={() => openPrescriptionModal(apt)}
                                    className="bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold px-3.5 py-2 rounded-lg shadow-sm transition active:scale-95 cursor-pointer inline-flex items-center gap-1"
                                  >
                                    💊 {apt.prescription_id ? 'Edit Rx' : 'Issue Rx'}
                                  </button>
                                )}
                                {(apt.status === 'cancelled' || apt.status === 'rejected') && (
                                  <span className="text-xs text-slate-400 font-medium italic">Cancelled</span>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ══════════════════════════════════════════════════
                TAB 4 — PROFILE & AVAILABILITY
            ══════════════════════════════════════════════════ */}
            {activeTab === 'profile' && (
              <div className="space-y-8">
                <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">

                  {/* ── Doctor Profile Card ───── */}
                  <div className="lg:col-span-2 space-y-6">

                    {/* Profile Overview Card */}
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                      <div className="h-24 bg-gradient-to-r from-indigo-600 via-violet-600 to-indigo-700" />
                      <div className="px-6 pb-6">
                        <div className="-mt-10 mb-4 flex items-end justify-between">
                          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white text-3xl font-black border-4 border-white shadow-lg">
                            {user?.name?.charAt(0) ?? 'D'}
                          </div>
                          <span className="inline-flex items-center gap-1 text-xs font-bold text-sky-700 bg-sky-50 border border-sky-200 px-3 py-1 rounded-full">
                            ✓ Verified
                          </span>
                        </div>
                        <h2 className="text-xl font-black text-slate-900">Dr. {user?.name}</h2>
                        {profile.specialty && (
                          <p className="text-sm font-semibold text-indigo-600 mt-0.5">{profile.specialty}</p>
                        )}
                        <div className="mt-4 grid grid-cols-2 gap-3">
                          {profile.experience && (
                            <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Experience</p>
                              <p className="text-lg font-black text-slate-900 mt-0.5">{profile.experience} <span className="text-xs font-semibold text-slate-500">yrs</span></p>
                            </div>
                          )}
                          {profile.fees && (
                            <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Consult Fee</p>
                              <p className="text-lg font-black text-indigo-700 mt-0.5">₹{profile.fees}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Edit Profile Form */}
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                      <SectionHeader title="Edit Profile" subtitle="Update your professional details" />
                      <form onSubmit={updateProfile} className="space-y-4">
                        <div>
                          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Specialty</label>
                          <input
                            type="text"
                            name="specialty"
                            value={profile.specialty}
                            onChange={handleProfileChange}
                            className={inputCls}
                            placeholder="e.g. Cardiologist, Neurologist"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Consultation Fees (₹)</label>
                          <input
                            type="number"
                            name="fees"
                            value={profile.fees}
                            onChange={handleProfileChange}
                            className={inputCls}
                            placeholder="e.g. 500"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Years of Experience</label>
                          <input
                            type="number"
                            name="experience"
                            value={profile.experience}
                            onChange={handleProfileChange}
                            className={inputCls}
                            placeholder="e.g. 10"
                          />
                        </div>
                        <button
                          type="submit"
                          className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-3 px-4 rounded-xl font-bold text-sm shadow-sm active:scale-98 transition duration-150 cursor-pointer mt-2"
                        >
                          Save Profile Changes
                        </button>
                      </form>
                    </div>
                  </div>

                  {/* ── Availability Management ───── */}
                  <div className="lg:col-span-3 space-y-6">

                    {/* Add Slot Form */}
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                      <SectionHeader title="Add Available Slot" subtitle="Set times when patients can book appointments" />
                      <form onSubmit={addSlot} className="space-y-4">
                        <div>
                          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Date</label>
                          <input
                            type="date"
                            name="date"
                            value={slot.date}
                            onChange={handleSlotChange}
                            required
                            className={inputCls}
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Start Time</label>
                            <input
                              type="time"
                              name="start_time"
                              value={slot.start_time}
                              onChange={handleSlotChange}
                              required
                              className={inputCls}
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">End Time</label>
                            <input
                              type="time"
                              name="end_time"
                              value={slot.end_time}
                              onChange={handleSlotChange}
                              required
                              className={inputCls}
                            />
                          </div>
                        </div>
                        <button
                          type="submit"
                          className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-3 px-4 rounded-xl font-bold text-sm shadow-sm active:scale-98 transition duration-150 cursor-pointer"
                        >
                          + Add Open Slot
                        </button>
                      </form>
                    </div>

                    {/* Slot Calendar Grid */}
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                      <div className="flex items-center justify-between mb-6">
                        <div>
                          <h2 className="text-base font-black text-slate-900 tracking-tight">Availability Calendar</h2>
                          <p className="text-xs text-slate-500 mt-0.5 font-medium">
                            {mySlots.length} slot{mySlots.length !== 1 ? 's' : ''} total &mdash;
                            <span className="text-emerald-600 font-semibold"> {mySlots.filter(s => s.is_booked).length} booked</span>,
                            <span className="text-indigo-600 font-semibold"> {mySlots.filter(s => !s.is_booked).length} available</span>
                          </p>
                        </div>
                        <div className="flex items-center gap-3 text-xs font-semibold">
                          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-emerald-400" /> Booked</span>
                          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-indigo-400" /> Available</span>
                        </div>
                      </div>

                      {mySlots.length === 0 ? (
                        <EmptyState emoji="📅" title="No slots yet" desc="Use the form above to add your available timeslots for patients to book." />
                      ) : (
                        <div className="space-y-6">
                          {Object.entries(slotsByDate).map(([date, slots]) => (
                            <div key={date}>
                              <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                                <span className="flex-1 h-px bg-slate-100" />
                                {date}
                                <span className="flex-1 h-px bg-slate-100" />
                              </h4>
                              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                {slots.map((s) => (
                                  <div
                                    key={s.id}
                                    className={`relative p-4 rounded-xl border-2 transition-all ${
                                      s.is_booked
                                        ? 'border-emerald-200 bg-emerald-50'
                                        : 'border-indigo-100 bg-indigo-50/40 hover:border-indigo-300'
                                    }`}
                                  >
                                    <div className={`absolute top-2 right-2 w-2 h-2 rounded-full ${s.is_booked ? 'bg-emerald-400' : 'bg-indigo-400'}`} />
                                    <p className="text-xs font-black text-slate-500 uppercase tracking-wider mb-1">
                                      {s.is_booked ? 'Booked' : 'Available'}
                                    </p>
                                    <p className="text-sm font-black text-slate-800 font-mono">
                                      {s.start_time.substring(0, 5)} – {s.end_time.substring(0, 5)}
                                    </p>
                                    {!s.is_booked && (
                                      <button
                                        onClick={() => handleDeleteSlot(s.id)}
                                        className="mt-3 w-full text-xs font-bold text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 py-1.5 rounded-lg transition cursor-pointer"
                                      >
                                        Remove
                                      </button>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ══════════════════════════════════════════════════
                TAB 5 — LIVE CLINIC QUEUE
            ══════════════════════════════════════════════════ */}
            {activeTab === 'queue' && (
              <div className="space-y-6">
                {/* Live Status Board */}
                <div className="relative overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 rounded-2xl border border-indigo-900/50 shadow-2xl">
                  <div className="absolute top-0 right-0 w-72 h-72 rounded-full bg-indigo-600/10 blur-3xl pointer-events-none" />
                  <div className="relative z-10 p-6 sm:p-8">
                    <div className="flex flex-col md:flex-row md:items-start justify-between gap-5 pb-6 border-b border-white/10">
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
                          <span className="text-xs font-bold uppercase tracking-widest text-emerald-400">Live Clinic Flow</span>
                        </div>
                        <h2 className="text-2xl sm:text-3xl font-black text-white">Today's Queue Board</h2>
                        <p className="text-xs text-indigo-300/70 mt-1 max-w-md">
                          Real-time token tracker. Advancing the queue notifies called patients automatically.
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          onClick={handleCallNextPatient}
                          disabled={callingNext || liveQueue.waiting_count === 0}
                          className="px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-bold text-sm rounded-xl shadow-lg transition flex items-center gap-2 cursor-pointer active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {callingNext ? '⏳ Calling…' : '▶ Call Next Patient'}
                        </button>
                        {liveQueue.currently_serving && (
                          <button
                            onClick={handleCompleteCurrentConsultation}
                            disabled={completingConsult}
                            className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm rounded-xl shadow-md transition flex items-center gap-1.5 cursor-pointer active:scale-95 disabled:opacity-50"
                          >
                            {completingConsult ? 'Completing…' : '✓ Complete Consultation'}
                          </button>
                        )}
                        <button
                          onClick={fetchLiveQueue}
                          className="px-3.5 py-2.5 bg-white/10 hover:bg-white/20 text-white font-bold text-sm rounded-xl transition cursor-pointer"
                        >
                          ↺ Refresh
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-5 pt-6">
                      {/* Currently Serving */}
                      <div className="md:col-span-2 bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-sm">
                        <span className="text-[10px] font-black uppercase tracking-widest text-indigo-300 block mb-3">
                          Currently In Consultation
                        </span>
                        {liveQueue.currently_serving ? (
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <div className="flex items-center gap-4">
                              <span className="text-5xl font-black font-mono text-emerald-400 tracking-tight">
                                {liveQueue.currently_serving.token_code}
                              </span>
                              <div>
                                <h3 className="text-xl font-black text-white">{liveQueue.currently_serving.patient_name}</h3>
                                <p className="text-xs text-indigo-200 mt-0.5">
                                  Slot: {liveQueue.currently_serving.slot_start_time?.substring(0, 5)} – {liveQueue.currently_serving.slot_end_time?.substring(0, 5)}
                                </p>
                              </div>
                            </div>
                            <div className="bg-emerald-500/15 border border-emerald-500/30 px-5 py-3 rounded-xl text-center">
                              <span className="text-[10px] uppercase font-bold text-emerald-300 block mb-0.5">In Room</span>
                              <span className="text-2xl font-black text-emerald-400 font-mono">
                                {liveQueue.currently_serving.consult_elapsed_minutes !== undefined
                                  ? `${Math.max(0, parseInt(liveQueue.currently_serving.consult_elapsed_minutes, 10))}m`
                                  : 'Just started'}
                              </span>
                            </div>
                          </div>
                        ) : (
                          <div className="text-center py-6 text-indigo-300/70">
                            <span className="text-4xl block mb-2">🩺</span>
                            <p className="font-semibold text-sm">Room is ready for the next patient</p>
                            <p className="text-xs opacity-60 mt-0.5">Click "Call Next Patient" to begin</p>
                          </div>
                        )}
                      </div>

                      {/* Pace & Metrics */}
                      <div className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-sm flex flex-col justify-between">
                        <div>
                          <span className="text-[10px] font-black uppercase tracking-widest text-indigo-300 block mb-2">Rolling Pace</span>
                          <div className="flex items-baseline gap-1.5">
                            <span className="text-4xl font-black text-white font-mono">~{liveQueue.rolling_average_pace_minutes || 12}</span>
                            <span className="text-xs text-indigo-200 font-semibold">min/consultation</span>
                          </div>
                          <p className="text-[11px] text-indigo-300/50 mt-1.5">Auto-calibrated from today's sessions</p>
                        </div>
                        <div className="grid grid-cols-2 gap-2 mt-5 pt-5 border-t border-white/10">
                          <div className="bg-black/20 p-3 rounded-xl text-center">
                            <span className="text-[10px] text-indigo-300 font-bold block mb-1">Waiting</span>
                            <span className="text-2xl font-black text-amber-400">{liveQueue.waiting_count || 0}</span>
                          </div>
                          <div className="bg-black/20 p-3 rounded-xl text-center">
                            <span className="text-[10px] text-indigo-300 font-bold block mb-1">Done</span>
                            <span className="text-2xl font-black text-emerald-400">{liveQueue.completed_count || 0}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Token Queue Table */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100">
                    <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                      👥 Today's Checked-in Queue
                      <span className="text-sm font-bold text-slate-500 bg-slate-100 px-2.5 py-0.5 rounded-full">
                        {liveQueue.tokens?.length || 0}
                      </span>
                    </h3>
                    <span className="text-xs text-slate-400 font-medium">Sorted by arrival</span>
                  </div>

                  {!liveQueue.tokens || liveQueue.tokens.length === 0 ? (
                    <EmptyState emoji="🎫" title="No patients checked in yet" desc="When patients arrive and check in at the clinic, their tokens appear here instantly." />
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="min-w-full">
                        <thead>
                          <tr className="bg-slate-50 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100">
                            <th className="px-6 py-3.5">Token</th>
                            <th className="px-6 py-3.5">Patient</th>
                            <th className="px-6 py-3.5">Slot</th>
                            <th className="px-6 py-3.5">Check-in</th>
                            <th className="px-6 py-3.5">Wait</th>
                            <th className="px-6 py-3.5">Status</th>
                            <th className="px-6 py-3.5 text-right">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50 text-sm">
                          {liveQueue.tokens.map((t) => (
                            <tr key={t.id} className={`transition-colors ${t.status === 'in_consultation' ? 'bg-emerald-50/60' : 'hover:bg-slate-50/60'}`}>
                              <td className="px-6 py-4 font-mono font-black text-slate-900 text-base">{t.token_code}</td>
                              <td className="px-6 py-4">
                                <p className="font-bold text-slate-900">{t.patient_name}</p>
                                <p className="text-xs text-slate-400">{t.patient_email}</p>
                              </td>
                              <td className="px-6 py-4 font-mono text-slate-500 text-xs">
                                {t.slot_start_time?.substring(0, 5)} – {t.slot_end_time?.substring(0, 5)}
                              </td>
                              <td className="px-6 py-4 text-xs text-slate-500">
                                {new Date(t.check_in_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </td>
                              <td className="px-6 py-4 text-xs font-mono text-slate-600">
                                {t.status === 'completed' ? `${t.actual_duration_minutes || 0}m visit`
                                  : t.status === 'in_consultation' ? 'In Room'
                                  : `~${t.estimated_wait_minutes}m`}
                              </td>
                              <td className="px-6 py-4">
                                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide border ${
                                  t.status === 'in_consultation' ? 'bg-emerald-100 text-emerald-800 border-emerald-200 animate-pulse'
                                    : t.status === 'completed' ? 'bg-slate-100 text-slate-600 border-slate-200'
                                    : t.status === 'no_show' ? 'bg-rose-100 text-rose-700 border-rose-200'
                                    : 'bg-sky-50 text-sky-700 border-sky-200'
                                }`}>
                                  {t.status === 'in_consultation' ? 'In Consultation' : t.status}
                                </span>
                              </td>
                              <td className="px-6 py-4 text-right">
                                {t.status === 'waiting' && (
                                  <button
                                    onClick={() => handleMarkNoShow(t.id)}
                                    className="text-xs text-rose-600 hover:text-rose-800 font-semibold cursor-pointer hover:underline"
                                  >
                                    No-show
                                  </button>
                                )}
                                {t.status === 'in_consultation' && (
                                  <button
                                    onClick={handleCompleteCurrentConsultation}
                                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold text-xs cursor-pointer shadow-sm"
                                  >
                                    Done ✓
                                  </button>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ══════════════════════════════════════════════════
                TAB 6 — WAITLIST
            ══════════════════════════════════════════════════ */}
            {activeTab === 'waitlist' && (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-6 py-5 border-b border-slate-100">
                  <SectionHeader
                    title={`Cancellation Waitlist (${waitlistQueue.length})`}
                    subtitle="Patients queued for a slot when a cancellation opens up. The highest-priority patient is auto-notified."
                    right={
                      <button
                        onClick={fetchWaitlistQueue}
                        className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-50 transition cursor-pointer flex items-center gap-1.5"
                      >
                        ↺ Refresh
                      </button>
                    }
                  />
                </div>

                {waitlistQueue.length === 0 ? (
                  <EmptyState
                    emoji="📋"
                    title="No patients on your waitlist"
                    desc="When your schedule fills up, patients who can't find open slots will appear here automatically."
                  />
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full">
                      <thead>
                        <tr className="bg-slate-50 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100">
                          <th className="px-6 py-4">#</th>
                          <th className="px-6 py-4">Patient</th>
                          <th className="px-6 py-4">Preferred Date</th>
                          <th className="px-6 py-4">Mode</th>
                          <th className="px-6 py-4">Joined Queue</th>
                          <th className="px-6 py-4">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50 text-sm">
                        {waitlistQueue.map((w, idx) => (
                          <tr key={w.id} className={`transition-colors ${w.status === 'offered' ? 'bg-emerald-50/50' : 'hover:bg-slate-50/50'}`}>
                            <td className="px-6 py-4">
                              <span className="w-7 h-7 rounded-full bg-slate-100 text-slate-500 text-xs font-black flex items-center justify-center">
                                {idx + 1}
                              </span>
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-3">
                                <Avatar name={w.patient_name} size="sm" />
                                <div>
                                  <p className="font-bold text-slate-900">{w.patient_name}</p>
                                  <p className="text-xs text-slate-400">{w.patient_email}</p>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4 text-slate-600 font-medium">
                              {w.preferred_date ? new Date(w.preferred_date).toLocaleDateString() : 'Any date'}
                            </td>
                            <td className="px-6 py-4">
                              <TypeBadge type={w.preferred_type} />
                            </td>
                            <td className="px-6 py-4 text-xs text-slate-400 font-mono">
                              {new Date(w.created_at).toLocaleDateString()} {new Date(w.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </td>
                            <td className="px-6 py-4">
                              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide border ${
                                w.status === 'offered'
                                  ? 'bg-emerald-100 text-emerald-800 border-emerald-200 animate-pulse'
                                  : 'bg-indigo-50 text-indigo-700 border-indigo-100'
                              }`}>
                                {w.status === 'offered' ? '🟢 Slot Offered (15m window)' : 'Waiting'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* ══════════════════════════════════════════════════════════
          MODAL 1 — E-PRESCRIPTION EDITOR
      ══════════════════════════════════════════════════════════ */}
      {prescriptionModalApt && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-start justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-200 my-8">

            {/* Letterhead */}
            <div className="bg-gradient-to-r from-indigo-700 to-violet-700 rounded-t-2xl px-7 py-5 text-white">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-2xl">💊</span>
                    <span className="text-xs font-bold uppercase tracking-widest text-indigo-200">Medical Prescription</span>
                  </div>
                  <h3 className="text-xl font-black">Dr. {user?.name}</h3>
                  {profile.specialty && <p className="text-indigo-200 text-sm font-medium">{profile.specialty}</p>}
                </div>
                <button
                  onClick={() => setPrescriptionModalApt(null)}
                  className="text-white/60 hover:text-white text-2xl font-bold leading-none cursor-pointer transition p-1"
                >
                  ×
                </button>
              </div>
              <div className="mt-4 pt-4 border-t border-white/20 flex flex-wrap gap-6 text-xs">
                <div>
                  <span className="text-indigo-300 font-semibold block">Patient</span>
                  <span className="font-bold text-white">{prescriptionModalApt.patient_name}</span>
                </div>
                <div>
                  <span className="text-indigo-300 font-semibold block">Reference</span>
                  <span className="font-bold font-mono text-white">#APT-{prescriptionModalApt.id}</span>
                </div>
                <div>
                  <span className="text-indigo-300 font-semibold block">Date</span>
                  <span className="font-bold text-white">{new Date().toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                </div>
              </div>
            </div>

            {/* Form */}
            <form onSubmit={handleSavePrescription} className="p-7 space-y-6">

              {/* Diagnosis */}
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">
                  Clinical Diagnosis <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Acute Upper Respiratory Tract Infection"
                  value={prescriptionForm.diagnosis}
                  onChange={(e) => setPrescriptionForm({ ...prescriptionForm, diagnosis: e.target.value })}
                  className={inputCls}
                />
              </div>

              {/* Medications */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="text-xs font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
                    <span className="text-indigo-600">℞</span> Prescribed Medications
                  </label>
                  <button
                    type="button"
                    onClick={addMedicationRow}
                    className="text-xs font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg border border-indigo-200 transition cursor-pointer"
                  >
                    + Add Medicine
                  </button>
                </div>

                <div className="space-y-3 max-h-72 overflow-y-auto pr-1 rounded-xl">
                  {prescriptionForm.medications.map((med, idx) => (
                    <div key={idx} className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-[11px] font-black text-slate-400 uppercase tracking-wider">Medicine {idx + 1}</span>
                        {prescriptionForm.medications.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeMedicationRow(idx)}
                            className="text-[11px] font-bold text-rose-500 hover:text-rose-700 cursor-pointer"
                          >
                            ✕ Remove
                          </button>
                        )}
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-2">
                        <input
                          type="text"
                          placeholder="Medicine name (e.g. Amoxicillin)"
                          value={med.name}
                          onChange={(e) => handleMedicationChange(idx, 'name', e.target.value)}
                          className="w-full rounded-lg border border-slate-200 bg-white p-2.5 text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-300 placeholder:text-slate-400"
                        />
                        <input
                          type="text"
                          placeholder="Dosage (e.g. 500mg / 1 tab)"
                          value={med.dosage}
                          onChange={(e) => handleMedicationChange(idx, 'dosage', e.target.value)}
                          className="w-full rounded-lg border border-slate-200 bg-white p-2.5 text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-300 placeholder:text-slate-400"
                        />
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <input
                          type="text"
                          placeholder="Frequency (e.g. Twice daily)"
                          value={med.frequency}
                          onChange={(e) => handleMedicationChange(idx, 'frequency', e.target.value)}
                          className="w-full rounded-lg border border-slate-200 bg-white p-2.5 text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-300 placeholder:text-slate-400"
                        />
                        <input
                          type="text"
                          placeholder="Duration (e.g. 5 days)"
                          value={med.duration}
                          onChange={(e) => handleMedicationChange(idx, 'duration', e.target.value)}
                          className="w-full rounded-lg border border-slate-200 bg-white p-2.5 text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-300 placeholder:text-slate-400"
                        />
                        <input
                          type="text"
                          placeholder="Instructions (e.g. After meals)"
                          value={med.instructions}
                          onChange={(e) => handleMedicationChange(idx, 'instructions', e.target.value)}
                          className="w-full rounded-lg border border-slate-200 bg-white p-2.5 text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-300 placeholder:text-slate-400"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Doctor Notes */}
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">
                  Doctor Notes, Diet & Follow-up Advice
                </label>
                <textarea
                  rows="3"
                  placeholder="e.g. Drink warm fluids, avoid dairy for 3 days. Follow-up if symptoms persist after 5 days."
                  value={prescriptionForm.notes}
                  onChange={(e) => setPrescriptionForm({ ...prescriptionForm, notes: e.target.value })}
                  className={`${inputCls} resize-none`}
                />
              </div>

              {/* Footer Actions */}
              <div className="flex items-center justify-between gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setPrescriptionModalApt(null)}
                  className="px-5 py-2.5 border border-slate-200 text-slate-600 rounded-xl text-sm font-semibold hover:bg-slate-50 cursor-pointer transition"
                >
                  Cancel
                </button>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => toast.info('PDF generation coming soon!')}
                    className="px-5 py-2.5 border border-indigo-200 text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-xl text-sm font-semibold cursor-pointer transition"
                  >
                    🖨️ Generate PDF
                  </button>
                  <button
                    type="submit"
                    disabled={savingPrescription}
                    className="px-7 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold shadow-md transition disabled:opacity-50 cursor-pointer"
                  >
                    {savingPrescription ? 'Issuing…' : '✓ Save & Issue Rx'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════
          MODAL 2 — PATIENT HEALTH SUMMARY
      ══════════════════════════════════════════════════════════ */}
      {patientSummaryModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-start justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 my-8">

            {/* Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <Avatar name={patientSummaryModal.name} size="md" />
                <div>
                  <h3 className="text-base font-black text-slate-900">{patientSummaryModal.name}</h3>
                  <p className="text-xs text-slate-400 font-medium">Patient Health Summary</p>
                </div>
              </div>
              <button
                onClick={() => setPatientSummaryModal(null)}
                className="text-slate-400 hover:text-slate-700 text-xl font-bold cursor-pointer p-1 transition"
              >
                ×
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* Basic Info */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                  <span className="text-[10px] font-bold text-slate-400 uppercase block mb-0.5">Email</span>
                  <span className="font-semibold text-slate-700 break-all">{patientSummaryModal.email || 'N/A'}</span>
                </div>
                <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                  <span className="text-[10px] font-bold text-slate-400 uppercase block mb-0.5">Gender</span>
                  <span className="font-semibold text-slate-700 capitalize">{patientSummaryModal.gender || 'N/A'}</span>
                </div>
                <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 col-span-2">
                  <span className="text-[10px] font-bold text-slate-400 uppercase block mb-0.5">Date of Birth</span>
                  <span className="font-semibold text-slate-700">
                    {patientSummaryModal.date_of_birth ? new Date(patientSummaryModal.date_of_birth).toLocaleDateString() : 'N/A'}
                  </span>
                </div>
              </div>

              {/* Allergy Alert */}
              {patientSummaryModal.allergies ? (
                <div className="bg-rose-50 border-2 border-rose-300 rounded-xl p-4">
                  <div className="flex items-center gap-2 font-black text-rose-700 text-xs mb-1.5">
                    <span className="text-base">⚠️</span> DRUG & FOOD ALLERGY ALERT
                  </div>
                  <p className="font-semibold text-rose-900 text-sm">{patientSummaryModal.allergies}</p>
                </div>
              ) : (
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-emerald-800 text-xs font-semibold flex items-center gap-2">
                  <span className="text-base">✅</span> No drug or food allergies on file
                </div>
              )}

              {/* Vitals Grid */}
              <div>
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Vitals & Metrics</h4>
                <div className="grid grid-cols-3 gap-2.5">
                  {[
                    { label: 'Blood Group', value: patientSummaryModal.blood_group, cls: 'text-rose-600' },
                    { label: 'Height', value: patientSummaryModal.height ? `${patientSummaryModal.height} cm` : null },
                    { label: 'Weight',  value: patientSummaryModal.weight  ? `${patientSummaryModal.weight} kg`  : null },
                  ].map(({ label, value, cls }) => (
                    <div key={label} className="bg-slate-50 rounded-xl p-3 border border-slate-100 text-center">
                      <span className="text-[10px] font-bold text-slate-400 uppercase block mb-1">{label}</span>
                      <span className={`text-sm font-black ${cls ?? 'text-slate-800'}`}>{value || 'N/A'}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Chronic Conditions */}
              {patientSummaryModal.chronic_conditions && (
                <div className="bg-indigo-50 rounded-xl p-4 border border-indigo-100">
                  <span className="text-[10px] font-black text-indigo-600 uppercase tracking-wider block mb-1.5">Chronic Conditions</span>
                  <p className="text-sm font-semibold text-slate-800">{patientSummaryModal.chronic_conditions}</p>
                </div>
              )}

              {/* Emergency Contact */}
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 flex items-center justify-between gap-3">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase block mb-0.5">Emergency Contact</span>
                  <span className="text-sm font-bold text-slate-800">
                    {patientSummaryModal.emergency_contact_name || 'Not provided'}
                  </span>
                </div>
                {patientSummaryModal.emergency_contact_phone && (
                  <a
                    href={`tel:${patientSummaryModal.emergency_contact_phone}`}
                    className="text-sm font-black text-indigo-600 font-mono hover:text-indigo-800 transition"
                  >
                    {patientSummaryModal.emergency_contact_phone}
                  </a>
                )}
              </div>

              {/* Close Button */}
              <div className="pt-2">
                <button
                  onClick={() => setPatientSummaryModal(null)}
                  className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-sm font-bold cursor-pointer transition"
                >
                  Close Summary
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Real-Time Consultation Chat Modal */}
      {activeChatApt && (
        <ConsultationChatModal
          appointmentId={activeChatApt.id}
          onClose={() => setActiveChatApt(null)}
        />
      )}
    </div>
  );
};

export default DoctorDashboard;
