import { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/axios';
import { toast } from 'react-toastify';
import { downloadPrescriptionAsPDF } from '../utils/prescriptionPdf';
import ConsultationChatModal from '../components/ConsultationChatModal';

const PatientDashboard = () => {
  const [activeTab, setActiveTab] = useState('appointments'); // 'appointments', 'waitlist', or 'health-profile'
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);

  // Live Clinic Tokens & Queue State
  const [tokens, setTokens] = useState({}); // appointmentId -> tokenStatus
  const [checkingInId, setCheckingInId] = useState(null);

  // Priority Waitlist State
  const [waitlistItems, setWaitlistItems] = useState([]);
  const [claimingWaitlistId, setClaimingWaitlistId] = useState(null);

  // Health Profile State
  const [healthProfile, setHealthProfile] = useState({
    blood_group: '',
    height: '',
    weight: '',
    allergies: '',
    chronic_conditions: '',
    emergency_contact_name: '',
    emergency_contact_phone: '',
    gender: '',
    date_of_birth: ''
  });
  const [savingProfile, setSavingProfile] = useState(false);

  // Reschedule Modal State
  const [rescheduleApt, setRescheduleApt] = useState(null);
  const [availableSlots, setAvailableSlots] = useState([]);
  const [selectedSlotId, setSelectedSlotId] = useState('');
  const [rescheduling, setRescheduling] = useState(false);

  // Prescription Modal State
  const [selectedPrescription, setSelectedPrescription] = useState(null);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const prescriptionRef = useRef(null);

  // Consultation Chat Modal State
  const [activeChatApt, setActiveChatApt] = useState(null);

  // Review Modal State
  const [reviewApt, setReviewApt] = useState(null);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);

  const fetchTokenForAppointment = useCallback(async (appointmentId) => {
    try {
      const res = await api.get(`/clinic-queue/appointment/${appointmentId}`);
      if (res.data) {
        setTokens(prev => ({ ...prev, [appointmentId]: res.data }));
      }
    } catch (err) {
      // Token not yet created or not checked in
    }
  }, []);

  const fetchWaitlist = useCallback(async () => {
    try {
      const res = await api.get('/waitlist/my');
      setWaitlistItems(res.data || []);
    } catch (err) {
      console.warn('Could not load waitlist:', err.message);
    }
  }, []);

  const fetchAppointments = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/appointments/my');
      const apts = res.data || [];
      setAppointments(apts);

      // Fetch clinic tokens for today's in-person appointments
      const todayStr = new Date().toISOString().substring(0, 10);
      apts.forEach(a => {
        const aptDateStr = new Date(a.date).toISOString().substring(0, 10);
        if (a.appointment_type === 'in_person' && (aptDateStr === todayStr || a.status === 'accepted')) {
          fetchTokenForAppointment(a.id);
        }
      });
    } catch (err) {
      console.error(err);
      toast.error('Failed to load appointments');
    } finally {
      setLoading(false);
    }
  }, [fetchTokenForAppointment]);

  const fetchHealthProfile = useCallback(async () => {
    try {
      const res = await api.get('/patient/profile');
      if (res.data) {
        setHealthProfile({
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
      }
    } catch (err) {
      console.warn('Could not load patient health profile:', err.message);
    }
  }, []);

  useEffect(() => {
    fetchAppointments();
    fetchHealthProfile();
    fetchWaitlist();

    const handleNotification = () => {
      fetchAppointments();
      fetchWaitlist();
    };

    window.addEventListener('new-notification', handleNotification);
    return () => {
      window.removeEventListener('new-notification', handleNotification);
    };
  }, [fetchAppointments, fetchHealthProfile, fetchWaitlist]);

  // Live countdown timer for waitlist offers
  useEffect(() => {
    const timer = setInterval(() => {
      setWaitlistItems(prev => prev.map(item => {
        if (item.status === 'offered' && item.remaining_seconds > 0) {
          return { ...item, remaining_seconds: item.remaining_seconds - 1 };
        }
        return item;
      }));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatCountdown = (secs) => {
    if (!secs || secs <= 0) return '00:00';
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const handleCheckIn = async (aptId) => {
    setCheckingInId(aptId);
    try {
      const res = await api.post('/clinic-queue/check-in', { appointment_id: aptId });
      toast.success(res.data.message || 'Check-in successful! Your digital token is active.');
      await fetchTokenForAppointment(aptId);
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || 'Check-in failed');
    } finally {
      setCheckingInId(null);
    }
  };

  const handleClaimWaitlist = async (waitlistId) => {
    setClaimingWaitlistId(waitlistId);
    try {
      const res = await api.post(`/waitlist/${waitlistId}/claim`, { appointment_type: 'in_person' });
      toast.success(res.data.message || 'Waitlist slot claimed and confirmed!');
      fetchWaitlist();
      fetchAppointments();
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || 'Failed to claim waitlist slot');
    } finally {
      setClaimingWaitlistId(null);
    }
  };

  const handleCancelWaitlist = async (waitlistId) => {
    if (window.confirm('Are you sure you want to leave this doctor waitlist?')) {
      try {
        await api.delete(`/waitlist/${waitlistId}`);
        toast.info('Removed from waitlist');
        fetchWaitlist();
      } catch (err) {
        console.error(err);
        toast.error('Failed to leave waitlist');
      }
    }
  };



  const handleProfileChange = (e) => {

    setHealthProfile({ ...healthProfile, [e.target.name]: e.target.value });
  };

  const saveHealthProfile = async (e) => {
    e.preventDefault();
    setSavingProfile(true);
    try {
      await api.put('/patient/profile', healthProfile);
      toast.success('Medical health profile updated successfully!');
    } catch (err) {
      console.error(err);
      toast.error('Failed to update health profile');
    } finally {
      setSavingProfile(false);
    }
  };

  // BMI Calculation
  const calculateBMI = () => {
    const h = parseFloat(healthProfile.height);
    const w = parseFloat(healthProfile.weight);
    if (!h || !w || h <= 0 || w <= 0) return null;
    const heightInMeters = h / 100;
    const bmi = (w / (heightInMeters * heightInMeters)).toFixed(1);

    let category = 'Normal';
    let colorClass = 'text-emerald-700 bg-emerald-50 border-emerald-200';
    if (bmi < 18.5) {
      category = 'Underweight';
      colorClass = 'text-amber-700 bg-amber-50 border-amber-200';
    } else if (bmi >= 25 && bmi < 29.9) {
      category = 'Overweight';
      colorClass = 'text-amber-700 bg-amber-50 border-amber-200';
    } else if (bmi >= 30) {
      category = 'Obese';
      colorClass = 'text-rose-700 bg-rose-50 border-rose-200';
    }
    return { bmi, category, colorClass };
  };

  const bmiInfo = calculateBMI();

  // Cancel Appointment
  const cancelAppointment = async (id) => {
    if (window.confirm('Are you sure you want to cancel this appointment booking?')) {
      try {
        await api.delete(`/appointments/${id}`);
        toast.info('Appointment cancelled and slot freed');
        fetchAppointments();
      } catch (err) {
        console.error(err);
        toast.error('Failed to cancel appointment');
      }
    }
  };

  // Open Reschedule Modal
  const openRescheduleModal = async (apt) => {
    setRescheduleApt(apt);
    setSelectedSlotId('');
    try {
      const res = await api.get(`/doctors/${apt.doctor_id}/slots`);
      // Filter out slots that are currently booked or match current appointment slot
      const openSlots = (res.data || []).filter(s => s.id !== apt.slot_id && !s.is_booked);
      setAvailableSlots(openSlots);
    } catch (err) {
      console.error(err);
      toast.error('Could not fetch doctor slots');
    }
  };

  // Submit Reschedule
  const handleRescheduleSubmit = async () => {
    if (!selectedSlotId) {
      toast.warning('Please select a new time slot');
      return;
    }
    setRescheduling(true);
    try {
      await api.patch(`/appointments/${rescheduleApt.id}/reschedule`, {
        new_slot_id: parseInt(selectedSlotId, 10)
      });
      toast.success('Appointment rescheduled successfully!');
      setRescheduleApt(null);
      fetchAppointments();
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || 'Failed to reschedule appointment');
    } finally {
      setRescheduling(false);
    }
  };

  // View Prescription
  const openPrescriptionModal = async (appointmentId) => {
    try {
      const res = await api.get(`/appointments/${appointmentId}/prescription`);
      setSelectedPrescription(res.data);
    } catch (err) {
      console.error(err);
      toast.error('Prescription not found or unavailable');
    }
  };

  // Download Prescription as High Quality PDF
  const handleDownloadPdf = async () => {
    if (!prescriptionRef.current || !selectedPrescription) return;
    setIsDownloadingPdf(true);
    try {
      const patientSlug = (selectedPrescription.patient_name || 'Patient').replace(/\s+/g, '_');
      const filename = `Prescription_APT-${selectedPrescription.appointment_id || selectedPrescription.id}_${patientSlug}.pdf`;
      await downloadPrescriptionAsPDF(prescriptionRef.current, filename);
      toast.success('Prescription PDF successfully generated and downloaded!');
    } catch (err) {
      console.error('Prescription PDF export error:', err);
      toast.error('Failed to export PDF file. You can also print the prescription.');
    } finally {
      setIsDownloadingPdf(false);
    }
  };


  // Open Review Modal
  const openReviewModal = (apt) => {
    setReviewApt(apt);
    setRating(5);
    setComment('');
  };

  // Submit Review
  const handleSubmitReview = async (e) => {
    e.preventDefault();
    setSubmittingReview(true);
    try {
      await api.post('/reviews', {
        appointment_id: reviewApt.id,
        doctor_id: reviewApt.doctor_id,
        rating,
        comment
      });
      toast.success('Thank you! Your doctor rating and review have been recorded.');
      setReviewApt(null);
      fetchAppointments();
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || 'Failed to submit review');
    } finally {
      setSubmittingReview(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 font-sans">
      {/* Header Banner */}
      <div className="relative overflow-hidden bg-slate-950 rounded-2xl p-8 mb-8 shadow-xl border border-indigo-900/40 text-white">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <span className="inline-block text-xs font-black uppercase tracking-widest bg-indigo-500/20 text-indigo-300 px-3 py-1.5 rounded-full border border-indigo-500/30">
              🏥 Patient Care Dashboard
            </span>
            <h1 className="text-3xl sm:text-4xl font-black mt-3 tracking-tight">
              My Health & Consultations
            </h1>
            <p className="text-indigo-200/80 text-sm mt-1 max-w-xl">
              Manage scheduled clinic visits, download digital prescriptions, update your medical health card, and reschedule slots.
            </p>
          </div>

          {/* Navigation Tabs */}
          <div className="flex bg-white/10 border border-white/15 p-1.5 rounded-xl backdrop-blur-md self-start md:self-center gap-1">
            <button
              onClick={() => setActiveTab('appointments')}
              className={`px-4 py-2 rounded-lg font-bold text-xs sm:text-sm transition cursor-pointer ${
                activeTab === 'appointments'
                  ? 'bg-white text-indigo-950 shadow-md font-extrabold'
                  : 'text-indigo-200 hover:text-white'
              }`}
            >
              📅 Consultations ({appointments.length})
            </button>
            <button
              onClick={() => setActiveTab('waitlist')}
              className={`px-4 py-2 rounded-lg font-bold text-xs sm:text-sm transition cursor-pointer ${
                activeTab === 'waitlist'
                  ? 'bg-white text-indigo-950 shadow-md font-extrabold'
                  : 'text-indigo-200 hover:text-white'
              }`}
            >
              📋 Priority Waitlist ({waitlistItems.filter(w => w.status === 'offered' || w.status === 'waiting').length})
            </button>
            <button
              onClick={() => setActiveTab('health-profile')}
              className={`px-4 py-2 rounded-lg font-bold text-xs sm:text-sm transition cursor-pointer ${
                activeTab === 'health-profile'
                  ? 'bg-white text-indigo-950 shadow-md font-extrabold'
                  : 'text-indigo-200 hover:text-white'
              }`}
            >
              ❤️ My Health Profile
            </button>
          </div>
        </div>
      </div>

      {/* TAB 1: CONSULTATIONS */}
      {activeTab === 'appointments' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
          <div className="flex justify-between items-center mb-6 pb-3 border-b border-slate-100">
            <div>
              <h2 className="text-lg font-black text-slate-900 tracking-tight">Scheduled Appointments</h2>
              <p className="text-xs text-slate-500 font-medium">Keep track of upcoming sessions and past medical consultations</p>
            </div>
            <a
              href="/doctors"
              className="text-xs font-extrabold text-white bg-indigo-600 hover:bg-indigo-700 px-4 py-2 rounded-lg shadow-sm transition"
            >
              + Book New Doctor
            </a>
          </div>

          {loading ? (
            <div className="text-center py-16">
              <svg className="animate-spin h-8 w-8 text-indigo-600 mx-auto" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <p className="text-xs font-bold text-slate-400 mt-2">Loading consultations...</p>
            </div>
          ) : appointments.length === 0 ? (
            <div className="text-center py-16 px-4 bg-slate-50/50 rounded-xl border-2 border-dashed border-slate-200">
              <span className="text-3xl">🗓️</span>
              <p className="text-slate-500 font-bold text-sm mt-2">No appointments scheduled yet.</p>
              <a
                href="/doctors"
                className="inline-block mt-3 px-4 py-2 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-700 transition"
              >
                Browse Specialist Doctors
              </a>
            </div>
          ) : (
            <div className="space-y-4">
              {appointments.map((apt) => (
                <div
                  key={apt.id}
                  className="border border-slate-200 rounded-xl p-5 flex flex-col lg:flex-row justify-between items-start lg:items-center hover:border-indigo-200 hover:shadow-md transition duration-200 gap-4 bg-white"
                >
                  {/* Doctor & Timing Info */}
                  <div className="space-y-2">
                    <div className="flex items-center space-x-3.5">
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-indigo-600 to-blue-500 text-white font-black text-lg flex items-center justify-center shadow-sm">
                        {apt.doctor_name ? apt.doctor_name.charAt(0) : 'D'}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-black text-slate-900 text-base">Dr. {apt.doctor_name}</p>
                          <span className="text-[10px] font-mono text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                            #APT-{apt.id}
                          </span>
                        </div>
                        <p className="text-xs font-bold uppercase tracking-wider text-indigo-600">
                          {apt.specialty}
                        </p>
                      </div>
                    </div>

                    <div className="text-xs text-slate-600 font-bold space-y-1 pl-1">
                      <p className="flex items-center space-x-2">
                        <span>📅</span>
                        <span>
                          {new Date(apt.date).toLocaleDateString(undefined, {
                            weekday: 'short',
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric'
                          })}
                        </span>
                        <span className="text-slate-300">|</span>
                        <span className="text-indigo-600">🕒 {apt.start_time.substring(0, 5)} - {apt.end_time.substring(0, 5)}</span>
                      </p>
                    </div>

                    {/* Status Badges */}
                    <div className="flex flex-wrap gap-2 pt-1">
                      {/* Consultation Mode Badge */}
                      {apt.appointment_type === 'video' ? (
                        <span className="px-2.5 py-0.5 inline-flex items-center gap-1.5 text-[10px] font-black rounded-md border bg-purple-50 text-purple-700 border-purple-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-pulse"></span>
                          📹 Online Video Call
                        </span>
                      ) : (
                        <span className="px-2.5 py-0.5 inline-flex items-center gap-1.5 text-[10px] font-bold rounded-md border bg-slate-100 text-slate-700 border-slate-200">
                          🏥 In-Person Clinic
                        </span>
                      )}

                      <span
                        className={`px-2.5 py-0.5 inline-flex text-[10px] font-black rounded-md border uppercase tracking-wider ${
                          apt.status === 'accepted'
                            ? 'bg-blue-50 text-blue-700 border-blue-200'
                            : apt.status === 'completed'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : apt.status === 'rejected'
                            ? 'bg-rose-50 text-rose-700 border-rose-200'
                            : apt.status === 'cancelled'
                            ? 'bg-slate-100 text-slate-500 border-slate-200'
                            : 'bg-amber-50 text-amber-700 border-amber-200'
                        }`}
                      >
                        {apt.status}
                      </span>

                      <span
                        className={`px-2.5 py-0.5 inline-flex text-[10px] font-bold rounded-md border ${
                          apt.payment_status === 'completed'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-amber-50 text-amber-700 border-amber-200'
                        }`}
                      >
                        Payment: {apt.payment_status === 'completed' ? 'Paid' : 'Unpaid (At Clinic)'}
                      </span>

                      {apt.prescription_id && (
                        <span className="px-2.5 py-0.5 inline-flex text-[10px] font-black rounded-md border bg-indigo-50 text-indigo-700 border-indigo-200">
                          💊 Prescription Ready
                        </span>
                      )}

                      {apt.review_rating && (
                        <span className="px-2.5 py-0.5 inline-flex text-[10px] font-black rounded-md border bg-amber-50 text-amber-800 border-amber-200">
                          ⭐ Rated {apt.review_rating}/5
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex flex-wrap items-center gap-2 self-stretch lg:self-center">
                    {/* Join Video Call Button for Online Appointments */}
                    {apt.appointment_type === 'video' && (apt.status === 'accepted' || apt.status === 'completed') && (
                      <Link
                        to={`/consultation/video/${apt.id}`}
                        className="px-3.5 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white text-xs font-black rounded-lg shadow-sm hover:shadow transition cursor-pointer flex items-center gap-1.5 active:scale-95"
                      >
                        <span>📹</span> Join Video Call
                      </Link>
                    )}

                    {/* Consultation Real-Time Chat (Pre-visit questions & 48h Follow-up) */}
                    {(apt.status === 'accepted' || apt.status === 'completed') && (
                      <button
                        onClick={() => setActiveChatApt(apt)}
                        className="px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 text-xs font-bold rounded-lg shadow-sm transition cursor-pointer flex items-center gap-1.5 active:scale-95"
                      >
                        <span>💬</span> Consultation Chat
                      </button>
                    )}

                    {/* View Prescription Button */}
                    {apt.prescription_id && (
                      <button
                        onClick={() => openPrescriptionModal(apt.id)}
                        className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg shadow-sm transition cursor-pointer flex items-center gap-1.5"
                      >
                        <span>📄</span> View Prescription
                      </button>
                    )}

                    {/* Rate Doctor Button */}
                    {apt.status === 'completed' && !apt.review_id && (
                      <button
                        onClick={() => openReviewModal(apt)}
                        className="px-3.5 py-2 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold rounded-lg shadow-sm transition cursor-pointer flex items-center gap-1"
                      >
                        <span>⭐</span> Rate Doctor
                      </button>
                    )}

                    {/* Reschedule Button */}
                    {(apt.status === 'pending' || apt.status === 'accepted') && (
                      <button
                        onClick={() => openRescheduleModal(apt)}
                        className="px-3.5 py-2 border border-indigo-300 text-indigo-700 hover:bg-indigo-50 text-xs font-bold rounded-lg transition cursor-pointer flex items-center gap-1"
                      >
                        <span>🗓️</span> Reschedule
                      </button>
                    )}

                    {/* Cancel Button */}
                    {(apt.status === 'pending' || apt.status === 'accepted') && (
                      <button
                        onClick={() => cancelAppointment(apt.id)}
                        className="px-3.5 py-2 border border-rose-200 text-rose-600 hover:bg-rose-50 text-xs font-bold rounded-lg transition cursor-pointer"
                      >
                        Cancel
                      </button>
                    )}
                  </div>

                  {/* LIVE CLINIC TOKEN & QUEUE CARD FOR IN-PERSON VISITS */}
                  {apt.appointment_type !== 'video' && apt.status !== 'cancelled' && apt.status !== 'rejected' && (
                    <div className="mt-3 pt-3 border-t border-slate-100 w-full">
                      {tokens[apt.id] ? (
                        <div className={`p-4 rounded-xl border ${
                          tokens[apt.id].is_turn_approaching 
                            ? 'bg-amber-50/80 border-amber-300 ring-2 ring-amber-400/30' 
                            : 'bg-indigo-50/40 border-indigo-200'
                        }`}>
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div className="flex items-center gap-3">
                              <div className="w-12 h-12 rounded-xl bg-slate-950 text-white flex flex-col items-center justify-center shadow-md">
                                <span className="text-[9px] uppercase font-bold text-indigo-300">Token</span>
                                <span className="text-sm font-black font-mono tracking-tight text-white">
                                  {tokens[apt.id].token.token_code}
                                </span>
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-black text-slate-900">
                                    Clinic Queue Token #{tokens[apt.id].token.token_number}
                                  </span>
                                  <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full border ${
                                    tokens[apt.id].token.status === 'in_consultation'
                                      ? 'bg-emerald-100 text-emerald-800 border-emerald-300 animate-pulse'
                                      : tokens[apt.id].token.status === 'completed'
                                      ? 'bg-slate-100 text-slate-700 border-slate-200'
                                      : 'bg-blue-100 text-blue-800 border-blue-200'
                                  }`}>
                                    {tokens[apt.id].token.status === 'in_consultation' ? 'Now In Room' : tokens[apt.id].token.status}
                                  </span>
                                </div>
                                <p className="text-xs text-slate-600 font-medium mt-0.5 flex flex-wrap items-center gap-2">
                                  <span>Currently Serving: <strong className="text-indigo-700 font-black">{tokens[apt.id].currently_serving?.token_code || 'None yet'}</strong></span>
                                  <span className="text-slate-300">|</span>
                                  <span>Ahead of you: <strong className="text-slate-800 font-black">{tokens[apt.id].patients_ahead} patient{tokens[apt.id].patients_ahead === 1 ? '' : 's'}</strong></span>
                                </p>
                              </div>
                            </div>

                            <div className="text-left sm:text-right">
                              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
                                Estimated Wait
                              </span>
                              <span className="text-sm font-black text-indigo-600">
                                {tokens[apt.id].token.status === 'completed' 
                                  ? 'Visit Completed' 
                                  : (tokens[apt.id].token.status === 'in_consultation' 
                                      ? 'Your Turn Now!' 
                                      : `~${tokens[apt.id].estimated_wait_minutes} mins`)}
                              </span>
                              <span className="text-[9px] text-slate-400 block">
                                Based on Dr.'s pace ({tokens[apt.id].actual_average_pace_minutes}m/pt)
                              </span>
                            </div>
                          </div>

                          {tokens[apt.id].is_turn_approaching && tokens[apt.id].token.status === 'waiting' && (
                            <div className="mt-3 p-2.5 bg-amber-500/15 border border-amber-400/50 rounded-lg flex items-center gap-2 text-xs font-black text-amber-900 animate-pulse">
                              <span className="text-base">🔔</span>
                              <span>Your turn is approaching! Please proceed towards Dr. {apt.doctor_name}'s consultation room.</span>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
                          <div className="flex items-center gap-2 text-xs text-slate-600 font-medium">
                            <span className="text-lg">🎫</span>
                            <span>Arrived at clinic? Check in to generate your digital token and track live queue progress.</span>
                          </div>
                          <button
                            onClick={() => handleCheckIn(apt.id)}
                            disabled={checkingInId === apt.id}
                            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-lg shadow-sm transition cursor-pointer active:scale-95 disabled:opacity-50 whitespace-nowrap"
                          >
                            {checkingInId === apt.id ? 'Checking In...' : 'Check In & Get Token 🎫'}
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: SMART PRIORITY WAITLIST */}
      {activeTab === 'waitlist' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 mb-6 border-b border-slate-100 gap-4">
            <div>
              <h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                <span>📋</span> DocBook Priority Appointment Waitlist
              </h2>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Automatically monitors practitioner cancellations and reserves freed slots with a 15-minute claim window.
              </p>
            </div>
            <a
              href="/doctors"
              className="text-xs font-bold text-indigo-600 hover:text-indigo-800 self-start sm:self-center"
            >
              + Join another doctor's waitlist
            </a>
          </div>

          {waitlistItems.length === 0 ? (
            <div className="text-center py-16 px-4 bg-slate-50/50 rounded-2xl border-2 border-dashed border-slate-200">
              <span className="text-4xl">📋</span>
              <h3 className="text-base font-black text-slate-900 mt-3">You are not currently waiting for any doctors</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto font-medium">
                When a doctor's schedule is full, join their waitlist to get first priority access the instant an appointment is freed!
              </p>
              <a
                href="/doctors"
                className="inline-block mt-4 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition"
              >
                Find Specialists
              </a>
            </div>
          ) : (
            <div className="space-y-4">
              {waitlistItems.map((item) => {
                const isOffered = item.status === 'offered';
                const isWaiting = item.status === 'waiting';

                return (
                  <div
                    key={item.id}
                    className={`rounded-2xl border p-6 transition duration-200 ${
                      isOffered
                        ? 'bg-gradient-to-r from-emerald-50 via-teal-50 to-indigo-50 border-emerald-300 shadow-md ring-2 ring-emerald-500/20'
                        : 'bg-white border-slate-200 hover:border-indigo-200'
                    }`}
                  >
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="space-y-1.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${
                            isOffered
                              ? 'bg-emerald-500 text-white border-emerald-600 shadow-sm animate-pulse'
                              : isWaiting
                              ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                              : item.status === 'claimed'
                              ? 'bg-slate-100 text-slate-700 border-slate-300'
                              : 'bg-rose-50 text-rose-700 border-rose-200'
                          }`}>
                            {isOffered ? '🎉 Slot Offered - Claim Now!' : item.status.toUpperCase()}
                          </span>

                          {isOffered && item.remaining_seconds > 0 && (
                            <span className="text-xs font-mono font-black text-rose-600 bg-rose-50 border border-rose-200 px-2.5 py-0.5 rounded-md flex items-center gap-1">
                              <span>⌛</span> Expires in {formatCountdown(item.remaining_seconds)}
                            </span>
                          )}
                        </div>

                        <h3 className="text-lg font-black text-slate-900">
                          Dr. {item.doctor_name}
                        </h3>
                        <p className="text-xs font-bold uppercase tracking-wider text-indigo-600">
                          {item.doctor_specialty} • Fee: ₹{item.doctor_fees}
                        </p>

                        {isOffered && item.offered_slot_date && (
                          <div className="mt-2 p-3 bg-white/80 rounded-xl border border-emerald-200 text-xs font-bold text-slate-800 space-y-1">
                            <p className="text-emerald-800 font-extrabold flex items-center gap-1.5">
                              <span>🗓️</span> A freed appointment timeslot is ready for you:
                            </p>
                            <p className="text-slate-600 pl-5">
                              Date: <strong>{new Date(item.offered_slot_date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</strong> | 
                              Time: <strong className="text-indigo-600">{item.offered_slot_start_time?.substring(0, 5)} - {item.offered_slot_end_time?.substring(0, 5)}</strong>
                            </p>
                          </div>
                        )}

                        {isWaiting && (
                          <p className="text-xs text-slate-500 font-medium">
                            Preferred Date: <strong>{item.preferred_date ? new Date(item.preferred_date).toLocaleDateString() : 'Any upcoming date'}</strong> • Preferred Mode: <strong>{item.preferred_type}</strong>
                          </p>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-2 self-start md:self-center">
                        {isOffered && (
                          <button
                            onClick={() => handleClaimWaitlist(item.id)}
                            disabled={claimingWaitlistId === item.id}
                            className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black rounded-xl shadow-md transition cursor-pointer active:scale-95 disabled:opacity-50"
                          >
                            {claimingWaitlistId === item.id ? 'Claiming Slot...' : 'Claim This Slot Now →'}
                          </button>
                        )}

                        {(isWaiting || isOffered) && (
                          <button
                            onClick={() => handleCancelWaitlist(item.id)}
                            className="px-4 py-2 border border-slate-200 text-slate-600 hover:text-rose-600 hover:bg-rose-50 text-xs font-bold rounded-xl transition cursor-pointer"
                          >
                            {isOffered ? 'Decline Offer' : 'Leave Waitlist'}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: PATIENT HEALTH PROFILE */}
      {activeTab === 'health-profile' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 mb-6 border-b border-slate-100 gap-4">
            <div>
              <h2 className="text-xl font-black text-slate-900 tracking-tight">Patient Health Card & Vitals</h2>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Doctors review this clinical summary to verify drug safety, allergy alerts, and emergency contact details before consultations.
              </p>
            </div>

            {bmiInfo && (
              <div className={`px-4 py-2 rounded-xl border font-bold text-xs flex items-center gap-2 ${bmiInfo.colorClass}`}>
                <span>⚖️</span>
                <span>Calculated BMI: <strong>{bmiInfo.bmi}</strong> ({bmiInfo.category})</span>
              </div>
            )}
          </div>

          <form onSubmit={saveHealthProfile} className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* Blood Group */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Blood Group
                </label>
                <select
                  name="blood_group"
                  value={healthProfile.blood_group}
                  onChange={handleProfileChange}
                  className="w-full text-xs font-semibold bg-slate-50 border border-slate-200 rounded-lg px-3.5 py-2.5 text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="">Select Blood Group</option>
                  <option value="A+">A Positive (A+)</option>
                  <option value="A-">A Negative (A-)</option>
                  <option value="B+">B Positive (B+)</option>
                  <option value="B-">B Negative (B-)</option>
                  <option value="O+">O Positive (O+)</option>
                  <option value="O-">O Negative (O-)</option>
                  <option value="AB+">AB Positive (AB+)</option>
                  <option value="AB-">AB Negative (AB-)</option>
                </select>
              </div>

              {/* Height */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Height (cm)
                </label>
                <input
                  type="number"
                  step="0.1"
                  name="height"
                  placeholder="e.g. 175"
                  value={healthProfile.height}
                  onChange={handleProfileChange}
                  className="w-full text-xs font-semibold bg-slate-50 border border-slate-200 rounded-lg px-3.5 py-2.5 text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              {/* Weight */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Weight (kg)
                </label>
                <input
                  type="number"
                  step="0.1"
                  name="weight"
                  placeholder="e.g. 70"
                  value={healthProfile.weight}
                  onChange={handleProfileChange}
                  className="w-full text-xs font-semibold bg-slate-50 border border-slate-200 rounded-lg px-3.5 py-2.5 text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              {/* Gender */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Gender
                </label>
                <select
                  name="gender"
                  value={healthProfile.gender}
                  onChange={handleProfileChange}
                  className="w-full text-xs font-semibold bg-slate-50 border border-slate-200 rounded-lg px-3.5 py-2.5 text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="">Select Gender</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              {/* Date of Birth */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Date of Birth
                </label>
                <input
                  type="date"
                  name="date_of_birth"
                  value={healthProfile.date_of_birth}
                  onChange={handleProfileChange}
                  className="w-full text-xs font-semibold bg-slate-50 border border-slate-200 rounded-lg px-3.5 py-2.5 text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              {/* Emergency Contact Name */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Emergency Contact Name
                </label>
                <input
                  type="text"
                  name="emergency_contact_name"
                  placeholder="e.g. Sarah Miller (Spouse)"
                  value={healthProfile.emergency_contact_name}
                  onChange={handleProfileChange}
                  className="w-full text-xs font-semibold bg-slate-50 border border-slate-200 rounded-lg px-3.5 py-2.5 text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              {/* Emergency Contact Phone */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Emergency Phone Number
                </label>
                <input
                  type="tel"
                  name="emergency_contact_phone"
                  placeholder="+91 98765 43210"
                  value={healthProfile.emergency_contact_phone}
                  onChange={handleProfileChange}
                  className="w-full text-xs font-semibold bg-slate-50 border border-slate-200 rounded-lg px-3.5 py-2.5 text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
            </div>

            {/* Clinical Allergies & Chronic Conditions */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-slate-100">
              <div>
                <div className="flex items-center gap-1.5 mb-2">
                  <span className="text-rose-500">⚠️</span>
                  <label className="block text-xs font-bold text-rose-700 uppercase tracking-wider">
                    Known Drug & Food Allergies
                  </label>
                </div>
                <textarea
                  name="allergies"
                  rows="3"
                  placeholder="e.g. Penicillin, Peanuts, Sulfa antibiotics, Latex"
                  value={healthProfile.allergies}
                  onChange={handleProfileChange}
                  className="w-full text-xs font-semibold bg-rose-50/30 border border-rose-200 rounded-lg p-3 text-slate-900 focus:outline-none focus:ring-1 focus:ring-rose-500"
                />
                <p className="text-[11px] text-slate-400 mt-1">Displayed prominently to doctors before writing prescriptions.</p>
              </div>

              <div>
                <div className="flex items-center gap-1.5 mb-2">
                  <span className="text-indigo-500">🩺</span>
                  <label className="block text-xs font-bold text-indigo-700 uppercase tracking-wider">
                    Chronic Conditions & Pre-existing Illnesses
                  </label>
                </div>
                <textarea
                  name="chronic_conditions"
                  rows="3"
                  placeholder="e.g. Hypertension, Type 2 Diabetes, Asthma, Thyroid disorder"
                  value={healthProfile.chronic_conditions}
                  onChange={handleProfileChange}
                  className="w-full text-xs font-semibold bg-indigo-50/30 border border-indigo-200 rounded-lg p-3 text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
                <p className="text-[11px] text-slate-400 mt-1">Helps doctors personalize dosage and clinical advice.</p>
              </div>
            </div>

            <div className="flex justify-end pt-4">
              <button
                type="submit"
                disabled={savingProfile}
                className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs sm:text-sm shadow-md transition disabled:opacity-50 cursor-pointer"
              >
                {savingProfile ? 'Saving Health Card...' : 'Save Health Profile'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL 1: RESCHEDULE APPOINTMENT */}
      {rescheduleApt && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex justify-between items-center pb-4 border-b border-slate-100">
              <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                <span>🗓️</span> Reschedule Consultation
              </h3>
              <button
                onClick={() => setRescheduleApt(null)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold p-1"
              >
                ✕
              </button>
            </div>

            <div className="py-4 space-y-4">
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs space-y-1">
                <p className="font-extrabold text-slate-900">Dr. {rescheduleApt.doctor_name} ({rescheduleApt.specialty})</p>
                <p className="text-slate-500 font-semibold">
                  Current Schedule:{' '}
                  <span className="line-through text-slate-400">
                    {new Date(rescheduleApt.date).toLocaleDateString()} at {rescheduleApt.start_time.substring(0, 5)}
                  </span>
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Select New Open Slot:
                </label>
                {availableSlots.length === 0 ? (
                  <p className="text-xs text-amber-700 bg-amber-50 p-3 rounded-lg border border-amber-200 font-medium">
                    No alternate open slots found for Dr. {rescheduleApt.doctor_name}. Please check back later.
                  </p>
                ) : (
                  <div className="max-h-56 overflow-y-auto space-y-2 pr-1">
                    {availableSlots.map((s) => (
                      <label
                        key={s.id}
                        className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition ${
                          selectedSlotId === s.id.toString()
                            ? 'bg-indigo-50 border-indigo-500 text-indigo-900'
                            : 'bg-white border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <input
                            type="radio"
                            name="new_slot"
                            value={s.id}
                            checked={selectedSlotId === s.id.toString()}
                            onChange={(e) => setSelectedSlotId(e.target.value)}
                            className="text-indigo-600 focus:ring-indigo-500"
                          />
                          <span className="text-xs font-black">
                            {new Date(s.date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                          </span>
                        </div>
                        <span className="text-xs font-bold text-indigo-600">
                          {s.start_time.substring(0, 5)} - {s.end_time.substring(0, 5)}
                        </span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
              <button
                onClick={() => setRescheduleApt(null)}
                className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg text-xs font-bold hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={handleRescheduleSubmit}
                disabled={rescheduling || !selectedSlotId}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold shadow transition disabled:opacity-50"
              >
                {rescheduling ? 'Rescheduling...' : 'Confirm New Slot'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: OFFICIAL DIGITAL PRESCRIPTION SLIP */}
      {selectedPrescription && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl border border-slate-200 my-8">
            {/* Modal Actions Header */}
            <div className="flex justify-between items-center pb-4 border-b border-slate-100 print:hidden">
              <span className="text-xs font-black uppercase tracking-wider text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
                ✓ Official Medical Prescription
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleDownloadPdf}
                  disabled={isDownloadingPdf}
                  className="px-3.5 py-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xs font-bold rounded-lg shadow transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50 active:scale-95"
                >
                  <span>⬇️</span> {isDownloadingPdf ? 'Generating PDF...' : 'Download PDF'}
                </button>
                <button
                  onClick={() => window.print()}
                  className="px-3.5 py-1.5 bg-slate-900 text-white hover:bg-slate-800 text-xs font-bold rounded-lg shadow transition flex items-center gap-1.5 cursor-pointer active:scale-95"
                >
                  <span>🖨️</span> Print Slip
                </button>
                <button
                  onClick={() => setSelectedPrescription(null)}
                  className="text-slate-400 hover:text-slate-600 text-xl font-bold p-1 cursor-pointer"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Printable Prescription Document */}
            <div ref={prescriptionRef} className="pt-6 font-sans bg-white p-4 rounded-xl">
              {/* Clinic Letterhead */}
              <div className="border-b-2 border-indigo-600 pb-5 mb-5 flex justify-between items-start">
                <div>
                  <h2 className="text-2xl font-black bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                    DocBook Care Network
                  </h2>
                  <p className="text-xs text-slate-500 font-semibold mt-0.5">Clinical Outpatient Consultation Department</p>
                  <p className="text-xs text-slate-400">Digital Consultation Record & Rx Order</p>
                </div>
                <div className="text-right">
                  <p className="font-extrabold text-slate-900 text-sm">Dr. {selectedPrescription.doctor_name}</p>
                  <p className="text-xs text-indigo-600 font-bold uppercase">{selectedPrescription.doctor_specialty}</p>
                  <p className="text-xs text-slate-400">{selectedPrescription.doctor_experience} Years Exp.</p>
                </div>
              </div>

              {/* Patient Meta Strip */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs mb-6">
                <div>
                  <span className="text-slate-400 block font-bold">Patient Name:</span>
                  <span className="font-black text-slate-900">{selectedPrescription.patient_name}</span>
                </div>
                <div>
                  <span className="text-slate-400 block font-bold">Consult Date:</span>
                  <span className="font-bold text-slate-900">
                    {new Date(selectedPrescription.appointment_date).toLocaleDateString()}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block font-bold">Blood Group:</span>
                  <span className="font-bold text-rose-600">{selectedPrescription.blood_group || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block font-bold">Rx ID:</span>
                  <span className="font-mono font-bold text-slate-700">#RX-{selectedPrescription.id}</span>
                </div>
              </div>

              {/* Clinical Diagnosis */}
              <div className="mb-6">
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-400 mb-1">
                  Clinical Diagnosis
                </h4>
                <div className="p-3.5 bg-indigo-50/50 border border-indigo-100 rounded-xl text-slate-900 font-extrabold text-sm">
                  {selectedPrescription.diagnosis}
                </div>
              </div>

              {/* Medications Rx List */}
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-lg font-black text-indigo-600">℞</span>
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-700">
                    Prescribed Medications
                  </h4>
                </div>

                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
                    <thead className="bg-slate-50 font-bold text-slate-600">
                      <tr>
                        <th className="py-2.5 px-3">Medicine Name</th>
                        <th className="py-2.5 px-3">Dosage</th>
                        <th className="py-2.5 px-3">Frequency</th>
                        <th className="py-2.5 px-3">Duration</th>
                        <th className="py-2.5 px-3">Instructions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white font-medium text-slate-800">
                      {(selectedPrescription.medications || []).length === 0 ? (
                        <tr>
                          <td colSpan="5" className="py-4 text-center text-slate-400">
                            No specific medications listed. Follow doctor advice.
                          </td>
                        </tr>
                      ) : (
                        (selectedPrescription.medications || []).map((med, idx) => (
                          <tr key={idx} className="hover:bg-slate-50/50">
                            <td className="py-2.5 px-3 font-bold text-indigo-950">{med.name}</td>
                            <td className="py-2.5 px-3">{med.dosage || '-'}</td>
                            <td className="py-2.5 px-3">{med.frequency || '-'}</td>
                            <td className="py-2.5 px-3">{med.duration || '-'}</td>
                            <td className="py-2.5 px-3 text-slate-500 italic">{med.instructions || '-'}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Clinical Notes / Advice */}
              {selectedPrescription.notes && (
                <div className="mb-6">
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-400 mb-1">
                    Doctor Advice & Special Instructions
                  </h4>
                  <p className="text-xs text-slate-700 font-semibold bg-slate-50 p-3 rounded-xl border border-slate-200 leading-relaxed">
                    {selectedPrescription.notes}
                  </p>
                </div>
              )}

              {/* Footer Stamp */}
              <div className="pt-6 border-t border-slate-200 flex justify-between items-end text-xs text-slate-400">
                <div>
                  <p className="font-mono text-[10px]">Issued at: {new Date(selectedPrescription.created_at).toLocaleString()}</p>
                  <p className="text-[10px]">DocBook Care Telemedicine & Clinic Management System</p>
                </div>
                <div className="text-right">
                  <div className="w-32 border-b border-slate-300 pb-1 mb-1 font-bold text-slate-700">
                    Dr. {selectedPrescription.doctor_name}
                  </div>
                  <p className="text-[10px] text-emerald-600 font-extrabold">✓ Digitally Verified</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: RATE & REVIEW DOCTOR */}
      {reviewApt && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex justify-between items-center pb-3 border-b border-slate-100">
              <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                <span>⭐</span> Rate Your Consultation
              </h3>
              <button
                onClick={() => setReviewApt(null)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmitReview} className="py-4 space-y-4">
              <div>
                <p className="text-xs font-extrabold text-slate-900">Dr. {reviewApt.doctor_name}</p>
                <p className="text-xs text-indigo-600 font-bold uppercase">{reviewApt.specialty}</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Rating (1 to 5 Stars)</label>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      type="button"
                      key={star}
                      onClick={() => setRating(star)}
                      className={`text-2xl transition transform hover:scale-110 cursor-pointer ${
                        rating >= star ? 'opacity-100' : 'opacity-25 grayscale'
                      }`}
                    >
                      ⭐
                    </button>
                  ))}
                  <span className="text-xs font-black text-amber-700 self-center ml-2">{rating} / 5</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Your Experience & Feedback</label>
                <textarea
                  rows="3"
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Share details about the doctor's diagnosis, punctuality, and overall care..."
                  className="w-full text-xs font-semibold bg-slate-50 border border-slate-200 rounded-lg p-3 text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setReviewApt(null)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingReview}
                  className="px-5 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-xs font-bold shadow transition disabled:opacity-50"
                >
                  {submittingReview ? 'Submitting...' : 'Submit Review'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: REAL-TIME CONSULTATION CHAT */}
      {activeChatApt && (
        <ConsultationChatModal
          appointmentId={activeChatApt.id}
          onClose={() => setActiveChatApt(null)}
        />
      )}
    </div>
  );
};

export default PatientDashboard;
