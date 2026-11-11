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

const DoctorDashboard = () => {
  const { user } = useContext(AuthContext);
  const [activeTab, setActiveTab] = useState('dashboard'); // dashboard, analytics, appointments, profile
  const [scheduleMode, setScheduleMode] = useState('all'); // 'today' or 'all' booked appointments
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

    const handleNotification = () => {
      fetchDashboardData();
    };

    window.addEventListener('new-notification', handleNotification);
    return () => {
      window.removeEventListener('new-notification', handleNotification);
    };
  }, []);

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

      // Fetch profile details gracefully
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

      // Fetch slots gracefully
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

  // REAL Aggregated Database Objects (NO Mock/Fake Data)
  const todaysOverview = dashboardStats.todaysOverview || { todaysAppointments: 0, todaysCompleted: 0, todaysPending: 0, todaysRevenue: 0 };
  const overallOverview = dashboardStats.overallOverview || { totalAppointments: 0, totalCompleted: 0, totalPending: 0, totalRevenue: 0 };

  // Select Real Schedule items based on doctor's toggle mode ('today' or 'all')
  const activeScheduleItems = scheduleMode === 'today'
    ? (dashboardStats.todaysSchedule || [])
    : (dashboardStats.allSchedule || []);

  // Real Database Chart Datasets
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

  const PIE_COLORS = ['#10b981', '#f59e0b', '#3b82f6', '#ef4444', '#8b5cf6'];

  const patientStats = dashboardStats.patientStats || { totalPatients: 0, newPatients: 0, returningPatients: 0, topPatients: [] };

  const renderStatusBadge = (statusStr) => {
    const s = statusStr?.toLowerCase();
    if (s === 'completed') {
      return <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-3 py-1 rounded-md text-xs font-black tracking-wide">Completed</span>;
    }
    if (s === 'accepted' || s === 'confirmed') {
      return <span className="bg-blue-50 text-blue-700 border border-blue-200 px-3 py-1 rounded-md text-xs font-black tracking-wide">Confirmed</span>;
    }
    if (s === 'pending' || s === 'waiting') {
      return <span className="bg-amber-50 text-amber-700 border border-amber-200 px-3 py-1 rounded-md text-xs font-black tracking-wide">Waiting</span>;
    }
    if (s === 'cancelled' || s === 'rejected') {
      return <span className="bg-rose-50 text-rose-700 border border-rose-200 px-3 py-1 rounded-md text-xs font-black tracking-wide">{statusStr}</span>;
    }
    return <span className="bg-gray-100 text-gray-700 border border-gray-200 px-3 py-1 rounded-md text-xs font-black tracking-wide">{statusStr}</span>;
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 font-sans">
      {/* Top Banner Header */}
      <div className="relative overflow-hidden bg-slate-950 rounded-2xl p-6 sm:p-8 mb-8 shadow-xl border border-indigo-900/40">
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-block text-xs font-black uppercase tracking-wider bg-indigo-500/20 text-indigo-300 px-3 py-1 rounded-full border border-indigo-500/30">
                ⚡ Doctor Console
              </span>
              <span className="text-xs font-extrabold text-emerald-400 bg-emerald-950/60 px-2.5 py-1 rounded-full border border-emerald-800/40">
                100% Real Database Metrics
              </span>
            </div>
            <h1 className="text-2xl sm:text-4xl font-black text-white mt-3 tracking-tight">
              Welcome, Dr. {user.name}
            </h1>
            <p className="text-indigo-200/80 text-sm mt-1 max-w-xl">
              Live consultation metrics, database-backed patient schedules, and Recharts analytics.
            </p>
          </div>

          {/* Navigation Tabs */}
          <div className="flex flex-wrap bg-white/10 border border-white/15 p-1.5 rounded-xl backdrop-blur-md self-start lg:self-center shadow-inner gap-1">
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`px-4 py-2 rounded-lg font-bold text-xs sm:text-sm transition duration-200 cursor-pointer ${
                activeTab === 'dashboard' ? 'bg-white text-indigo-950 shadow-md font-extrabold' : 'text-indigo-200 hover:text-white'
              }`}
            >
              📋 Doctor Dashboard
            </button>
            <button
              onClick={() => setActiveTab('analytics')}
              className={`px-4 py-2 rounded-lg font-bold text-xs sm:text-sm transition duration-200 cursor-pointer ${
                activeTab === 'analytics' ? 'bg-white text-indigo-950 shadow-md font-extrabold' : 'text-indigo-200 hover:text-white'
              }`}
            >
              📊 Recharts Analytics
            </button>
            <button
              onClick={() => setActiveTab('appointments')}
              className={`px-4 py-2 rounded-lg font-bold text-xs sm:text-sm transition duration-200 cursor-pointer ${
                activeTab === 'appointments' ? 'bg-white text-indigo-950 shadow-md font-extrabold' : 'text-indigo-200 hover:text-white'
              }`}
            >
              📅 Appointments ({appointments.length})
            </button>
            <button
              onClick={() => setActiveTab('profile')}
              className={`px-4 py-2 rounded-lg font-bold text-xs sm:text-sm transition duration-200 cursor-pointer ${
                activeTab === 'profile' ? 'bg-white text-indigo-950 shadow-md font-extrabold' : 'text-indigo-200 hover:text-white'
              }`}
            >
              ⚙️ Profile & Slots
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-24 bg-white rounded-2xl border border-gray-100 shadow-sm">
          <svg className="animate-spin h-10 w-10 text-indigo-600 mx-auto" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <p className="text-gray-500 font-bold mt-4 tracking-tight">Fetching real appointments from PostgreSQL...</p>
        </div>
      ) : (
        <>
          {/* TAB 1: DOCTOR DASHBOARD */}
          {activeTab === 'dashboard' && (
            <div className="space-y-8">
              {/* Doctor Dashboard Main Box */}
              <div className="bg-white rounded-2xl shadow-xl border border-gray-200/80 overflow-hidden">
                {/* Dashboard Box Title */}
                <div className="bg-slate-900 text-white px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800">
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full bg-emerald-400 animate-pulse"></div>
                    <h2 className="text-lg font-black tracking-tight text-white uppercase">Doctor Dashboard</h2>
                  </div>
                  <div className="flex items-center gap-2 text-xs font-mono">
                    <span className="text-slate-400">Total Bookings in Database:</span>
                    <span className="bg-indigo-600 text-white px-2.5 py-0.5 rounded font-extrabold">{overallOverview.totalAppointments}</span>
                  </div>
                </div>

                {/* Metrics Summary Grid */}
                <div className="p-6 bg-slate-50/50 border-b border-gray-200">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                    {/* Card 1: Total Appointments */}
                    <div className="bg-white p-5 rounded-xl border border-gray-200/90 shadow-sm hover:shadow-md transition duration-200 flex items-center justify-between">
                      <div>
                        <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Total Appointments</p>
                        <p className="text-3xl font-black text-gray-900 mt-1">{overallOverview.totalAppointments}</p>
                        <p className="text-[10px] text-gray-400 font-medium mt-0.5">Today: {todaysOverview.todaysAppointments}</p>
                      </div>
                      <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 font-black text-xl flex items-center justify-center border border-indigo-100">
                        📋
                      </div>
                    </div>

                    {/* Card 2: Completed */}
                    <div className="bg-white p-5 rounded-xl border border-gray-200/90 shadow-sm hover:shadow-md transition duration-200 flex items-center justify-between">
                      <div>
                        <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Completed</p>
                        <p className="text-3xl font-black text-emerald-600 mt-1">{overallOverview.totalCompleted}</p>
                        <p className="text-[10px] text-gray-400 font-medium mt-0.5">Today: {todaysOverview.todaysCompleted}</p>
                      </div>
                      <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 font-black text-xl flex items-center justify-center border border-emerald-100">
                        ✓
                      </div>
                    </div>

                    {/* Card 3: Pending */}
                    <div className="bg-white p-5 rounded-xl border border-gray-200/90 shadow-sm hover:shadow-md transition duration-200 flex items-center justify-between">
                      <div>
                        <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Pending</p>
                        <p className="text-3xl font-black text-amber-500 mt-1">{overallOverview.totalPending}</p>
                        <p className="text-[10px] text-gray-400 font-medium mt-0.5">Today: {todaysOverview.todaysPending}</p>
                      </div>
                      <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 font-black text-xl flex items-center justify-center border border-amber-100">
                        ⏳
                      </div>
                    </div>

                    {/* Card 4: Total Revenue */}
                    <div className="bg-white p-5 rounded-xl border border-gray-200/90 shadow-sm hover:shadow-md transition duration-200 flex items-center justify-between">
                      <div>
                        <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Total Revenue</p>
                        <p className="text-3xl font-black text-indigo-900 mt-1">
                          ₹{overallOverview.totalRevenue.toLocaleString()}
                        </p>
                        <p className="text-[10px] text-gray-400 font-medium mt-0.5">Today: ₹{todaysOverview.todaysRevenue.toLocaleString()}</p>
                      </div>
                      <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-700 font-black text-xl flex items-center justify-center border border-indigo-100">
                        ₹
                      </div>
                    </div>
                  </div>
                </div>

                {/* Appointment Schedule Section */}
                <div className="p-6 bg-white">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4 pb-3 border-b border-gray-100">
                    <div>
                      <h3 className="text-base font-black text-gray-900 tracking-tight uppercase">
                        Appointment Schedule
                      </h3>
                      <p className="text-xs text-gray-500 mt-0.5">Real patient bookings directly from PostgreSQL</p>
                    </div>

                    {/* Schedule View Toggle: Today vs All Real Bookings */}
                    <div className="flex bg-gray-100 p-1 rounded-xl border border-gray-200 self-start sm:self-auto">
                      <button
                        onClick={() => setScheduleMode('today')}
                        className={`px-3 py-1.5 text-xs font-bold rounded-lg transition ${
                          scheduleMode === 'today' ? 'bg-white text-indigo-950 shadow-sm font-extrabold' : 'text-gray-600 hover:text-gray-900'
                        }`}
                      >
                        Today ({dashboardStats.todaysSchedule ? dashboardStats.todaysSchedule.length : 0})
                      </button>
                      <button
                        onClick={() => setScheduleMode('all')}
                        className={`px-3 py-1.5 text-xs font-bold rounded-lg transition ${
                          scheduleMode === 'all' ? 'bg-white text-indigo-950 shadow-sm font-extrabold' : 'text-gray-600 hover:text-gray-900'
                        }`}
                      >
                        All Real Bookings ({dashboardStats.allSchedule ? dashboardStats.allSchedule.length : 0})
                      </button>
                    </div>
                  </div>

                  {activeScheduleItems.length === 0 ? (
                    <div className="text-center py-12 bg-gray-50/60 rounded-xl border border-dashed border-gray-200">
                      <p className="text-gray-500 font-bold text-sm">No real appointments found in database for this view.</p>
                      <p className="text-xs text-gray-400 mt-1">When patients book a slot with you, their real details will appear here automatically.</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-100">
                        <thead>
                          <tr className="text-left text-xs font-black text-gray-400 uppercase tracking-wider">
                            <th className="pb-3">Time & Date</th>
                            <th className="pb-3">Patient Name</th>
                            <th className="pb-3">Email</th>
                            <th className="pb-3 text-center">Status</th>
                            <th className="pb-3 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 text-sm font-semibold text-gray-800">
                          {activeScheduleItems.map((item) => {
                            const timeFormatted = item.start_time ? item.start_time.substring(0, 5) : '10:00';
                            const dateFormatted = item.date ? new Date(item.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '';
                            return (
                              <tr key={item.id} className="hover:bg-slate-50/70 transition duration-150">
                                <td className="py-4 whitespace-nowrap">
                                  <span className="font-mono font-black text-indigo-950 text-sm">{timeFormatted}</span>
                                  <span className="text-xs text-gray-500 font-semibold block">{dateFormatted}</span>
                                </td>
                                <td className="py-4 whitespace-nowrap">
                                  <div className="font-bold text-gray-900 flex items-center gap-1.5">
                                    <span>{item.patient_name}</span>
                                    {item.appointment_type === 'video' ? (
                                      <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase text-purple-700 bg-purple-50 border border-purple-200 px-1.5 py-0.5 rounded">
                                        <span className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-pulse"></span>
                                        📹 Video
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase text-slate-600 bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded">
                                        🏥 In-Person
                                      </span>
                                    )}
                                  </div>
                                  <button
                                    onClick={() => openPatientHealthSummary(item.patient_id, item.patient_name)}
                                    className="text-[10px] text-indigo-600 hover:text-indigo-800 font-extrabold flex items-center gap-1 mt-0.5 cursor-pointer"
                                  >
                                    <span>👤</span> Health Summary
                                  </button>
                                </td>
                                <td className="py-4 text-xs text-gray-500 font-medium whitespace-nowrap">{item.patient_email}</td>
                                <td className="py-4 text-center whitespace-nowrap">{renderStatusBadge(item.status)}</td>
                                <td className="py-4 text-right whitespace-nowrap">
                                  <div className="flex items-center justify-end gap-1.5">
                                    {/* Video Consultation Room Button */}
                                    {item.appointment_type === 'video' && (item.status === 'accepted' || item.status === 'completed') && (
                                      <Link
                                        to={`/consultation/video/${item.id}`}
                                        className="text-xs font-black bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white px-2.5 py-1.5 rounded-lg shadow-sm transition active:scale-95 cursor-pointer flex items-center gap-1"
                                        title="Join Telehealth Video Call"
                                      >
                                        <span>📹</span> Call
                                      </Link>
                                    )}

                                    {/* Real-Time Consultation Chat */}
                                    {(item.status === 'accepted' || item.status === 'completed') && (
                                      <button
                                        onClick={() => setActiveChatApt(item)}
                                        className="text-xs font-bold bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 px-2.5 py-1.5 rounded-lg shadow-sm transition active:scale-95 cursor-pointer flex items-center gap-1"
                                        title="Consultation Chat"
                                      >
                                        <span>💬</span> Chat
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
                                        Mark Completed
                                      </button>
                                    )}
                                    {item.status === 'completed' && (
                                      <button
                                        onClick={() => openPrescriptionModal(item)}
                                        className="text-xs font-bold bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 px-3 py-1.5 rounded-lg shadow-sm transition active:scale-95 cursor-pointer flex items-center gap-1"
                                      >
                                        <span>💊</span> {item.prescription_id ? 'Edit Rx' : 'Issue Rx'}
                                      </button>
                                    )}
                                    {(item.status === 'cancelled' || item.status === 'rejected') && (
                                      <span className="text-xs text-gray-400 italic font-semibold">Cancelled</span>
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
              </div>

              {/* Recharts Analytics Quick Teaser */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Appointments per day real chart */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-base font-black text-gray-900 uppercase tracking-tight">
                      Appointments per Day
                    </h3>
                    <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-md">
                      Database Records
                    </span>
                  </div>
                  {appointmentsPerDayData.length === 0 ? (
                    <div className="h-64 flex items-center justify-center bg-gray-50/50 rounded-xl border border-dashed border-gray-200 text-xs text-gray-400 font-bold">
                      No appointment history in database yet.
                    </div>
                  ) : (
                    <div className="h-64 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={appointmentsPerDayData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                          <XAxis dataKey="day" stroke="#64748b" fontSize={11} />
                          <YAxis stroke="#64748b" fontSize={11} allowDecimals={false} />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: '#0f172a',
                              borderColor: '#1e293b',
                              borderRadius: '8px',
                              color: '#fff',
                              fontSize: '12px'
                            }}
                          />
                          <Bar dataKey="appointments" fill="#6366f1" radius={[4, 4, 0, 0]} name="Appointments" />
                          <Bar dataKey="completed" fill="#10b981" radius={[4, 4, 0, 0]} name="Completed" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>

                {/* Revenue per week real chart */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-base font-black text-gray-900 uppercase tracking-tight">
                      Revenue per Week
                    </h3>
                    <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-md">
                      Payments Log (₹)
                    </span>
                  </div>
                  {revenuePerWeekData.length === 0 ? (
                    <div className="h-64 flex items-center justify-center bg-gray-50/50 rounded-xl border border-dashed border-gray-200 text-xs text-gray-400 font-bold">
                      No cleared payments in database yet.
                    </div>
                  ) : (
                    <div className="h-64 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={revenuePerWeekData}>
                          <defs>
                            <linearGradient id="revenueGradReal" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#10b981" stopOpacity={0.8} />
                              <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                          <XAxis dataKey="week" stroke="#64748b" fontSize={11} />
                          <YAxis stroke="#64748b" fontSize={11} />
                          <Tooltip
                            formatter={(val) => [`₹${val.toLocaleString()}`, 'Revenue']}
                            contentStyle={{
                              backgroundColor: '#0f172a',
                              borderColor: '#1e293b',
                              borderRadius: '8px',
                              color: '#fff',
                              fontSize: '12px'
                            }}
                          />
                          <Area type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#revenueGradReal)" />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: RECHARTS ANALYTICS PAGE */}
          {activeTab === 'analytics' && (
            <div className="space-y-8">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* 1. Appointments Per Day */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
                  <h3 className="text-lg font-black text-gray-900 mb-2">Appointments per Day</h3>
                  <p className="text-xs text-gray-500 mb-6">Aggregated volume of daily patient bookings directly from database.</p>
                  {appointmentsPerDayData.length === 0 ? (
                    <div className="h-72 flex items-center justify-center bg-gray-50 rounded-xl border border-dashed border-gray-200 text-xs text-gray-400 font-bold">
                      No appointment records in database.
                    </div>
                  ) : (
                    <div className="h-72 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={appointmentsPerDayData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                          <XAxis dataKey="day" stroke="#64748b" fontSize={12} />
                          <YAxis stroke="#64748b" fontSize={12} allowDecimals={false} />
                          <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', borderRadius: '8px', color: '#fff' }} />
                          <Legend />
                          <Bar dataKey="appointments" fill="#4f46e5" radius={[4, 4, 0, 0]} name="Total Booked" />
                          <Bar dataKey="completed" fill="#10b981" radius={[4, 4, 0, 0]} name="Completed" />
                          <Bar dataKey="cancelled" fill="#ef4444" radius={[4, 4, 0, 0]} name="Cancelled" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>

                {/* 2. Revenue Per Week */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
                  <h3 className="text-lg font-black text-gray-900 mb-2">Revenue per Week</h3>
                  <p className="text-xs text-gray-500 mb-6">PostgreSQL sum of cleared payments per week.</p>
                  {revenuePerWeekData.length === 0 ? (
                    <div className="h-72 flex items-center justify-center bg-gray-50 rounded-xl border border-dashed border-gray-200 text-xs text-gray-400 font-bold">
                      No payment data recorded in database.
                    </div>
                  ) : (
                    <div className="h-72 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={revenuePerWeekData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                          <XAxis dataKey="week" stroke="#64748b" fontSize={12} />
                          <YAxis stroke="#64748b" fontSize={12} />
                          <Tooltip formatter={(val) => [`₹${val.toLocaleString()}`, 'Weekly Revenue']} contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', borderRadius: '8px', color: '#fff' }} />
                          <Legend />
                          <Bar dataKey="revenue" fill="#10b981" radius={[4, 4, 0, 0]} name="Revenue (₹)" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>

                {/* 3. Completed vs Cancelled vs Pending Pie Chart */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
                  <h3 className="text-lg font-black text-gray-900 mb-2">Completed vs Cancelled vs Pending</h3>
                  <p className="text-xs text-gray-500 mb-4">Percentage breakdown of total real consultation outcomes.</p>
                  {statusPieData.length === 0 ? (
                    <div className="h-72 flex items-center justify-center bg-gray-50 rounded-xl border border-dashed border-gray-200 text-xs text-gray-400 font-bold">
                      No status records found.
                    </div>
                  ) : (
                    <div className="h-72 w-full flex items-center justify-center">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={statusPieData}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={95}
                            paddingAngle={4}
                            dataKey="value"
                            label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                          >
                            {statusPieData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color || PIE_COLORS[index % PIE_COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', borderRadius: '8px', color: '#fff' }} />
                          <Legend />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>

                {/* 4. Real Patient Statistics */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 flex flex-col justify-between">
                  <div>
                    <h3 className="text-lg font-black text-gray-900 mb-2">Patient Statistics</h3>
                    <p className="text-xs text-gray-500 mb-6">Patient retention and unique consult demographics from database.</p>
                    
                    <div className="grid grid-cols-3 gap-4 mb-6">
                      <div className="bg-indigo-50/60 p-4 rounded-xl border border-indigo-100 text-center">
                        <p className="text-xs font-extrabold text-indigo-600 uppercase">Total Unique</p>
                        <p className="text-2xl font-black text-indigo-950 mt-1">{patientStats.totalPatients}</p>
                      </div>
                      <div className="bg-emerald-50/60 p-4 rounded-xl border border-emerald-100 text-center">
                        <p className="text-xs font-extrabold text-emerald-600 uppercase">New Patients</p>
                        <p className="text-2xl font-black text-emerald-950 mt-1">{patientStats.newPatients}</p>
                      </div>
                      <div className="bg-amber-50/60 p-4 rounded-xl border border-amber-100 text-center">
                        <p className="text-xs font-extrabold text-amber-600 uppercase">Returning</p>
                        <p className="text-2xl font-black text-amber-950 mt-1">{patientStats.returningPatients}</p>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 className="text-xs font-black text-gray-400 uppercase tracking-wider mb-3">Real Patient Leaderboard</h4>
                    {(!patientStats.topPatients || patientStats.topPatients.length === 0) ? (
                      <p className="text-xs text-gray-400 text-center py-6">No patient records found in database.</p>
                    ) : (
                      <div className="space-y-2">
                        {patientStats.topPatients.map((p, idx) => (
                          <div key={idx} className="flex items-center justify-between p-3 rounded-lg bg-gray-50/80 border border-gray-100">
                            <div>
                              <p className="text-xs font-bold text-gray-900">{p.name}</p>
                              <p className="text-[10px] text-gray-500">{p.email}</p>
                            </div>
                            <div className="text-right">
                              <span className="text-xs font-extrabold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded mr-2">
                                {p.visits} visits
                              </span>
                              <span className="text-xs font-black text-gray-900">
                                ₹{p.spent.toLocaleString()}
                              </span>
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

          {/* TAB 3: APPOINTMENT MANAGEMENT */}
          {activeTab === 'appointments' && (
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-6 py-5 border-b border-gray-100 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div>
                  <h3 className="text-lg font-black text-gray-900 tracking-tight">Consultation Bookings</h3>
                  <p className="text-gray-500 text-xs mt-0.5">Filter, accept, and mark real appointments completed.</p>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {['all', 'pending', 'accepted', 'completed', 'cancelled', 'rejected'].map((status) => (
                    <button
                      key={status}
                      onClick={() => setFilterStatus(status)}
                      className={`text-xs px-3.5 py-2 rounded-xl font-bold capitalize transition duration-200 cursor-pointer ${
                        filterStatus === status
                          ? 'bg-indigo-950 text-white shadow-sm border border-indigo-950'
                          : 'bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gray-100 hover:text-gray-900'
                      }`}
                    >
                      {status} ({status === 'all' ? appointments.length : appointments.filter((a) => a.status === status).length})
                    </button>
                  ))}
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-100">
                  <thead className="bg-gray-50/50">
                    <tr className="text-left text-xs font-black text-gray-400 uppercase tracking-wider">
                      <th className="px-6 py-4">Patient details</th>
                      <th className="px-6 py-4">Requested Slot</th>
                      <th className="px-6 py-4">Booking Status</th>
                      <th className="px-6 py-4">Payment</th>
                      <th className="px-6 py-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50 text-sm text-gray-700 font-medium">
                    {filteredAppointments.length === 0 ? (
                      <tr>
                        <td colSpan="5" className="text-center py-20 text-gray-400 font-medium">
                          No appointments found matching this filter in database.
                        </td>
                      </tr>
                    ) : (
                      filteredAppointments.map((apt) => (
                        <tr key={apt.id} className="hover:bg-gray-50/50 transition duration-150">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="font-bold text-gray-900 flex items-center gap-1.5">
                              <span>{apt.patient_name}</span>
                              {apt.appointment_type === 'video' ? (
                                <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase text-purple-700 bg-purple-50 border border-purple-200 px-1.5 py-0.5 rounded">
                                  <span className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-pulse"></span>
                                  📹 Video
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase text-slate-600 bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded">
                                  🏥 In-Person
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-gray-500 font-medium">{apt.patient_email}</div>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {apt.patient_allergies && (
                                <span className="text-[10px] bg-rose-50 text-rose-700 border border-rose-200 px-1.5 py-0.5 rounded font-black">
                                  ⚠️ {apt.patient_allergies.substring(0, 18)}...
                                </span>
                              )}
                              <button
                                onClick={() => openPatientHealthSummary(apt.patient_id, apt.patient_name)}
                                className="text-[10px] text-indigo-600 hover:text-indigo-800 font-extrabold flex items-center gap-1 cursor-pointer"
                              >
                                <span>👤</span> Health Summary
                              </button>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="font-bold text-gray-800">
                              {new Date(apt.date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                            </div>
                            <div className="text-xs font-bold mt-0.5 bg-blue-50 text-blue-600 px-2 py-0.5 rounded inline-block">
                              {apt.start_time.substring(0, 5)} - {apt.end_time.substring(0, 5)}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {renderStatusBadge(apt.status)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span
                              className={`px-2.5 py-1 inline-flex text-xs font-bold rounded-md border ${
                                apt.payment_status === 'completed'
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                                  : 'bg-amber-50 text-amber-700 border-amber-100'
                              }`}
                            >
                              {apt.payment_status === 'completed' ? 'Paid' : 'Pending'}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right space-x-1.5">
                            {/* Video Room Button */}
                            {apt.appointment_type === 'video' && (apt.status === 'accepted' || apt.status === 'completed') && (
                              <Link
                                to={`/consultation/video/${apt.id}`}
                                className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white text-xs font-black px-3 py-2 rounded-lg shadow-sm transition active:scale-95 cursor-pointer inline-flex items-center gap-1"
                              >
                                <span>📹</span> Video Call
                              </Link>
                            )}

                            {/* Consultation Chat Button */}
                            {(apt.status === 'accepted' || apt.status === 'completed') && (
                              <button
                                onClick={() => setActiveChatApt(apt)}
                                className="bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 text-xs font-bold px-3 py-2 rounded-lg shadow-sm transition active:scale-95 cursor-pointer inline-flex items-center gap-1"
                              >
                                <span>💬</span> Chat
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
                                Mark Completed
                              </button>
                            )}
                            {apt.status === 'completed' && (
                              <button
                                onClick={() => openPrescriptionModal(apt)}
                                className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-3.5 py-2 rounded-lg shadow-sm transition active:scale-95 cursor-pointer inline-flex items-center gap-1"
                              >
                                <span>💊</span> {apt.prescription_id ? 'Edit Rx' : 'Issue Rx'}
                              </button>
                            )}
                            {(apt.status === 'cancelled' || apt.status === 'rejected') && (
                              <span className="text-xs text-gray-400 font-bold italic">Cancelled</span>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 4: PROFILE & SLOTS CONFIGURATION */}
          {activeTab === 'profile' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Profile Config Form */}
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 flex flex-col justify-between">
                <div>
                  <h2 className="text-lg font-black text-gray-900 mb-6 pb-2 border-b border-gray-100">
                    Consultation Profile Details
                  </h2>
                  <form onSubmit={updateProfile} className="space-y-5">
                    <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider">Specialty</label>
                      <input
                        type="text"
                        name="specialty"
                        value={profile.specialty}
                        onChange={handleProfileChange}
                        className="mt-2 block w-full rounded-xl border-gray-200 shadow-sm p-3.5 border focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none text-sm font-semibold transition"
                        placeholder="e.g. Cardiologist, Neurologist"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider">Consultation Fees (₹)</label>
                      <input
                        type="number"
                        name="fees"
                        value={profile.fees}
                        onChange={handleProfileChange}
                        className="mt-2 block w-full rounded-xl border-gray-200 shadow-sm p-3.5 border focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none text-sm font-semibold transition"
                        placeholder="e.g. 500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider">Years of Experience</label>
                      <input
                        type="number"
                        name="experience"
                        value={profile.experience}
                        onChange={handleProfileChange}
                        className="mt-2 block w-full rounded-xl border-gray-200 shadow-sm p-3.5 border focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none text-sm font-semibold transition"
                        placeholder="e.g. 10"
                      />
                    </div>
                    <button
                      type="submit"
                      className="w-full text-white py-3.5 px-4 rounded-xl font-bold bg-indigo-950 hover:bg-slate-900 shadow active:scale-98 transition duration-150 cursor-pointer text-sm"
                    >
                      Save Profile Changes
                    </button>
                  </form>
                </div>
              </div>

              {/* Slots Creator Form */}
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
                <h2 className="text-lg font-black text-gray-900 mb-6 pb-2 border-b border-gray-100">
                  Create Available Timeslot
                </h2>
                <form onSubmit={addSlot} className="space-y-5">
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider">Select Date</label>
                    <input
                      type="date"
                      name="date"
                      value={slot.date}
                      onChange={handleSlotChange}
                      required
                      className="mt-2 block w-full rounded-xl border-gray-200 shadow-sm p-3.5 border focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none text-sm font-semibold transition"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider">Start Time</label>
                      <input
                        type="time"
                        name="start_time"
                        value={slot.start_time}
                        onChange={handleSlotChange}
                        required
                        className="mt-2 block w-full rounded-xl border-gray-200 shadow-sm p-3.5 border focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none text-sm font-semibold transition"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider">End Time</label>
                      <input
                        type="time"
                        name="end_time"
                        value={slot.end_time}
                        onChange={handleSlotChange}
                        required
                        className="mt-2 block w-full rounded-xl border-gray-200 shadow-sm p-3.5 border focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none text-sm font-semibold transition"
                      />
                    </div>
                  </div>
                  <button
                    type="submit"
                    className="w-full text-white py-3.5 px-4 rounded-xl font-bold bg-emerald-600 hover:bg-emerald-700 shadow active:scale-98 transition duration-150 cursor-pointer text-sm"
                  >
                    Add Open Slot
                  </button>
                </form>
              </div>

              {/* Full Width Slot Management List */}
              <div className="md:col-span-2 bg-white p-6 rounded-2xl shadow-sm border border-gray-200 mt-4">
                <div className="flex justify-between items-center mb-6 pb-2 border-b border-gray-100">
                  <h2 className="text-lg font-black text-gray-900 tracking-tight">Active Consultation Slots</h2>
                  <span className="text-xs bg-indigo-50 text-indigo-700 px-3.5 py-1 rounded-md font-bold border border-indigo-100">
                    Total Slots: {mySlots.length}
                  </span>
                </div>
                {mySlots.length === 0 ? (
                  <p className="text-gray-400 text-sm text-center py-12">No slots created yet. Use the form above to add available timeslots.</p>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                    {mySlots.map((s) => (
                      <div
                        key={s.id}
                        className={`p-4 rounded-xl border transition duration-200 flex flex-col justify-between ${
                          s.is_booked
                            ? 'border-emerald-200 bg-emerald-50/20'
                            : 'border-gray-200 bg-white hover:border-indigo-300 hover:shadow-sm'
                        }`}
                      >
                        <div>
                          <div className="flex justify-between items-center mb-2">
                            <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Slot</span>
                            <span
                              className={`text-[9px] font-black px-2 py-0.5 rounded-md uppercase tracking-wider border ${
                                s.is_booked
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                                  : 'bg-indigo-50 text-indigo-700 border-indigo-100'
                              }`}
                            >
                              {s.is_booked ? 'Booked' : 'Available'}
                            </span>
                          </div>
                          <p className="text-sm font-bold text-gray-800">
                            {new Date(s.date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                          </p>
                          <p className="text-xs text-gray-500 font-bold mt-1">
                            {s.start_time.substring(0, 5)} - {s.end_time.substring(0, 5)}
                          </p>
                        </div>
                        {!s.is_booked && (
                          <button
                            onClick={() => handleDeleteSlot(s.id)}
                            className="mt-4 text-xs font-bold text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 py-1.5 px-3 rounded-lg transition duration-150 text-center cursor-pointer active:scale-95"
                          >
                            Delete Slot
                          </button>
                        )}
                        {s.is_booked && (
                          <div className="mt-4 text-xs font-bold text-emerald-600 bg-emerald-100/40 border border-emerald-200 py-1.5 px-3 rounded-lg w-full text-center cursor-not-allowed select-none">
                            Booked
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {/* MODAL 1: E-PRESCRIPTION BUILDER MODAL */}
      {prescriptionModalApt && (

        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl border border-slate-200 my-8 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex justify-between items-center pb-4 border-b border-slate-100">
              <div>
                <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                  <span>💊</span> Issue Digital Consultation Prescription
                </h3>
                <p className="text-xs text-slate-500 font-semibold mt-0.5">
                  Patient: <strong className="text-slate-900">{prescriptionModalApt.patient_name}</strong> | Ref: #APT-{prescriptionModalApt.id}
                </p>
              </div>
              <button
                onClick={() => setPrescriptionModalApt(null)}
                className="text-slate-400 hover:text-slate-600 text-xl font-bold p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSavePrescription} className="py-5 space-y-5">
              {/* Clinical Diagnosis */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Clinical Diagnosis <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Acute Upper Respiratory Tract Infection, Seasonal Rhinitis"
                  value={prescriptionForm.diagnosis}
                  onChange={(e) => setPrescriptionForm({ ...prescriptionForm, diagnosis: e.target.value })}
                  className="w-full text-xs font-semibold bg-slate-50 border border-slate-200 rounded-lg p-3 text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              {/* Dynamic Medications Builder */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1">
                    <span>℞</span> Prescribed Medications
                  </label>
                  <button
                    type="button"
                    onClick={addMedicationRow}
                    className="text-xs font-extrabold text-indigo-600 hover:text-indigo-800 bg-indigo-50 px-2.5 py-1 rounded-md border border-indigo-200 transition cursor-pointer"
                  >
                    + Add Medicine
                  </button>
                </div>

                <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
                  {prescriptionForm.medications.map((med, idx) => (
                    <div key={idx} className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <input
                          type="text"
                          placeholder="Medicine name (e.g. Amoxicillin)"
                          value={med.name}
                          onChange={(e) => handleMedicationChange(idx, 'name', e.target.value)}
                          className="text-xs font-bold bg-white border border-slate-200 rounded-md p-2 text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                        <input
                          type="text"
                          placeholder="Dosage (e.g. 500mg / 1 tab)"
                          value={med.dosage}
                          onChange={(e) => handleMedicationChange(idx, 'dosage', e.target.value)}
                          className="text-xs font-semibold bg-white border border-slate-200 rounded-md p-2 text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <input
                          type="text"
                          placeholder="Frequency (e.g. Twice daily)"
                          value={med.frequency}
                          onChange={(e) => handleMedicationChange(idx, 'frequency', e.target.value)}
                          className="text-xs font-semibold bg-white border border-slate-200 rounded-md p-2 text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                        <input
                          type="text"
                          placeholder="Duration (e.g. 5 days)"
                          value={med.duration}
                          onChange={(e) => handleMedicationChange(idx, 'duration', e.target.value)}
                          className="text-xs font-semibold bg-white border border-slate-200 rounded-md p-2 text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                        <input
                          type="text"
                          placeholder="Instructions (e.g. After meals)"
                          value={med.instructions}
                          onChange={(e) => handleMedicationChange(idx, 'instructions', e.target.value)}
                          className="text-xs font-semibold bg-white border border-slate-200 rounded-md p-2 text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                      </div>

                      {prescriptionForm.medications.length > 1 && (
                        <div className="flex justify-end pt-1">
                          <button
                            type="button"
                            onClick={() => removeMedicationRow(idx)}
                            className="text-[11px] font-bold text-rose-600 hover:text-rose-800 cursor-pointer"
                          >
                            ✕ Remove Medicine
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Clinical Advice & Special Notes */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Doctor Advice, Diet & Follow-up Notes
                </label>
                <textarea
                  rows="3"
                  placeholder="e.g. Drink warm fluids, avoid dairy for 3 days. Return for follow-up if symptoms persist after 5 days."
                  value={prescriptionForm.notes}
                  onChange={(e) => setPrescriptionForm({ ...prescriptionForm, notes: e.target.value })}
                  className="w-full text-xs font-semibold bg-slate-50 border border-slate-200 rounded-lg p-3 text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setPrescriptionModalApt(null)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg text-xs font-bold hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingPrescription}
                  className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold shadow-md transition disabled:opacity-50 cursor-pointer"
                >
                  {savingPrescription ? 'Issuing Prescription...' : 'Save & Issue Rx'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: PATIENT MEDICAL HEALTH SUMMARY MODAL */}
      {patientSummaryModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 sm:p-8 shadow-2xl border border-slate-200 my-8">
            <div className="flex justify-between items-center pb-4 border-b border-slate-100">
              <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                <span>👤</span> Patient Clinical Health Summary
              </h3>
              <button
                onClick={() => setPatientSummaryModal(null)}
                className="text-slate-400 hover:text-slate-600 text-xl font-bold p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="py-4 space-y-4 text-xs font-sans">
              <div className="flex items-center gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                <div className="w-12 h-12 rounded-xl bg-indigo-100 text-indigo-700 font-black text-lg flex items-center justify-center">
                  {patientSummaryModal.name ? patientSummaryModal.name.charAt(0) : 'P'}
                </div>
                <div>
                  <h4 className="font-black text-slate-900 text-sm">{patientSummaryModal.name}</h4>
                  <p className="text-slate-500 font-semibold">{patientSummaryModal.email}</p>
                  <p className="text-slate-400 font-semibold">
                    Gender: {patientSummaryModal.gender || 'Not specified'} | DOB: {patientSummaryModal.date_of_birth ? new Date(patientSummaryModal.date_of_birth).toLocaleDateString() : 'N/A'}
                  </p>
                </div>
              </div>

              {/* Allergy Warning Alert */}
              {patientSummaryModal.allergies ? (
                <div className="bg-rose-50 border-2 border-rose-300 rounded-xl p-3.5 text-rose-900">
                  <div className="flex items-center gap-1.5 font-black text-rose-800 text-xs mb-1">
                    <span>⚠️</span> DRUG & FOOD ALLERGIES ALERT:
                  </div>
                  <p className="font-bold text-xs">{patientSummaryModal.allergies}</p>
                </div>
              ) : (
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-2.5 text-emerald-800 text-[11px] font-bold">
                  ✓ No specific drug or food allergies on file.
                </div>
              )}

              {/* Vitals Grid */}
              <div className="grid grid-cols-3 gap-2.5 text-center">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="block text-slate-400 font-bold text-[10px] uppercase">Blood Group</span>
                  <span className="text-base font-black text-rose-600">{patientSummaryModal.blood_group || 'N/A'}</span>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="block text-slate-400 font-bold text-[10px] uppercase">Height</span>
                  <span className="text-base font-black text-slate-900">{patientSummaryModal.height ? `${patientSummaryModal.height} cm` : 'N/A'}</span>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="block text-slate-400 font-bold text-[10px] uppercase">Weight</span>
                  <span className="text-base font-black text-slate-900">{patientSummaryModal.weight ? `${patientSummaryModal.weight} kg` : 'N/A'}</span>
                </div>
              </div>

              {/* Chronic Conditions */}
              {patientSummaryModal.chronic_conditions && (
                <div className="p-3 bg-indigo-50/50 rounded-xl border border-indigo-100">
                  <span className="block text-[10px] font-bold text-indigo-700 uppercase tracking-wider mb-1">
                    Chronic Conditions:
                  </span>
                  <p className="text-slate-800 font-bold text-xs">{patientSummaryModal.chronic_conditions}</p>
                </div>
              )}

              {/* Emergency Contact */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex justify-between items-center">
                <div>
                  <span className="block text-[10px] font-bold text-slate-400 uppercase">Emergency Contact:</span>
                  <span className="font-bold text-slate-900">{patientSummaryModal.emergency_contact_name || 'Not provided'}</span>
                </div>
                {patientSummaryModal.emergency_contact_phone && (
                  <span className="font-mono font-bold text-indigo-600">{patientSummaryModal.emergency_contact_phone}</span>
                )}
              </div>
            </div>

            <div className="flex justify-end pt-3 border-t border-slate-100">
              <button
                onClick={() => setPatientSummaryModal(null)}
                className="px-5 py-2 bg-slate-900 text-white rounded-lg text-xs font-bold hover:bg-slate-800 cursor-pointer"
              >
                Close Summary
              </button>
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
