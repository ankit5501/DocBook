import { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import api from '../api/axios';
import { toast } from 'react-toastify';

const DoctorDashboard = () => {
  const { user } = useContext(AuthContext);
  const [activeTab, setActiveTab] = useState('overview'); // overview, appointments, profile
  const [profile, setProfile] = useState({ specialty: '', fees: '', experience: '' });
  const [slot, setSlot] = useState({ date: '', start_time: '', end_time: '' });
  const [mySlots, setMySlots] = useState([]);

  // Earnings & Appointments state
  const [earningsData, setEarningsData] = useState({
    totalEarnings: 0,
    stats: [],
    payments: [],
    monthlyEarnings: []
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
      const [earningsRes, appointmentsRes] = await Promise.allSettled([
        api.get('/doctors/earnings'),
        api.get('/appointments/doctor')
      ]);

      if (earningsRes.status === 'fulfilled') {
        setEarningsData(earningsRes.value.data);
      } else {
        console.warn('Could not retrieve earnings:', earningsRes.reason?.message);
        toast.warning('Appointments loaded, but earnings data is temporarily unavailable');
      }

      if (appointmentsRes.status === 'fulfilled') {
        setAppointments(appointmentsRes.value.data);
      } else {
        throw appointmentsRes.reason;
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
        setMySlots(slotsRes.data);
      } catch (slotsErr) {
        console.warn('Could not retrieve slots:', slotsErr.message);
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to load dashboard statistics');
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
      fetchDashboardData(); // refresh profile data
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
      fetchDashboardData(); // refresh slots or dashboard details
    } catch (err) {
      toast.error('Failed to add slot');
    }
  };

  const handleDeleteSlot = async (slotId) => {
    if (window.confirm('Are you sure you want to delete this available timeslot?')) {
      try {
        await api.delete(`/doctors/slots/${slotId}`);
        toast.success('Slot deleted successfully!');
        fetchDashboardData(); // refresh list
      } catch (err) {
        toast.error(err.response?.data?.message || 'Failed to delete slot');
      }
    }
  };

  const handleStatusUpdate = async (appointmentId, newStatus) => {
    try {
      await api.patch(`/appointments/${appointmentId}/status`, { status: newStatus });
      toast.success(`Appointment status updated to: ${newStatus}`);
      fetchDashboardData(); // refresh lists and stats
    } catch (err) {
      toast.error('Failed to update appointment status');
    }
  };

  // Filtered appointments
  const filteredAppointments = appointments.filter(apt => {
    if (filterStatus === 'all') return true;
    return apt.status === filterStatus;
  });

  // Calculate status counts from list for quick fallback
  const getStatusCount = (status) => {
    return appointments.filter(apt => apt.status === status).length;
  };

  // Find max monthly revenue to scale the custom bar chart
  const maxRevenue = Math.max(...earningsData.monthlyEarnings.map(m => parseFloat(m.revenue) || 0), 1000);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">

      {/* Banner */}
      <div className="relative overflow-hidden bg-slate-950 rounded-lg p-8 mb-8 shadow-md border border-indigo-900/40">

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div>
            <span className="inline-block text-xs font-black uppercase tracking-wider bg-indigo-500/20 text-indigo-300 px-3 py-1.5 rounded-md border border-indigo-500/30">
              ⚡ Doctor Portal
            </span>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-white mt-3 tracking-tight">Welcome, Dr. {user.name}</h1>
            <p className="text-indigo-200/75 text-sm mt-1 max-w-xl">
              Configure clinic slots, track cleared payments, and manage your consultation requests effortlessly.
            </p>
          </div>

          {/* Navigation Tabs */}
          <div className="flex bg-white/5 border border-white/10 p-1.5 rounded-lg backdrop-blur-md self-start lg:self-center shadow-md">
            <button
              onClick={() => setActiveTab('overview')}
              className={`px-5 py-2.5 rounded-lg font-bold text-xs sm:text-sm tracking-tight transition duration-200 cursor-pointer ${activeTab === 'overview' ? 'bg-white text-indigo-950 shadow-md font-extrabold' : 'text-indigo-200 hover:text-white'}`}
            >
              Overview & Earnings
            </button>
            <button
              onClick={() => setActiveTab('appointments')}
              className={`px-5 py-2.5 rounded-lg font-bold text-xs sm:text-sm tracking-tight transition duration-200 cursor-pointer ${activeTab === 'appointments' ? 'bg-white text-indigo-950 shadow-md font-extrabold' : 'text-indigo-200 hover:text-white'}`}
            >
              Appointments ({appointments.length})
            </button>
            <button
              onClick={() => setActiveTab('profile')}
              className={`px-5 py-2.5 rounded-lg font-bold text-xs sm:text-sm tracking-tight transition duration-200 cursor-pointer ${activeTab === 'profile' ? 'bg-white text-indigo-950 shadow-md font-extrabold' : 'text-indigo-200 hover:text-white'}`}
            >
              Profile & Slots
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-24 bg-white rounded-lg border border-gray-100 shadow-sm">
          <svg className="animate-spin h-12 w-12 text-primary mx-auto" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <p className="text-gray-500 font-bold mt-4 tracking-tight">Retrieving doctor credentials & dashboard telemetry...</p>
        </div>
      ) : (
        <>
          {/* TAB 1: OVERVIEW & EARNINGS */}
          {activeTab === 'overview' && (
            <div className="space-y-8">

              {/* Earning KPI Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">

                <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100 flex items-center justify-between hover:shadow-md transition duration-300">
                  <div>
                    <p className="text-xs font-black text-gray-400 uppercase tracking-wider">Total Revenue</p>
                    <p className="text-3xl font-black text-gray-900 mt-2">₹{earningsData.totalEarnings.toLocaleString()}</p>
                    <p className="text-[10px] text-green-600 font-bold mt-1 bg-green-50 px-2 py-0.5 rounded-md inline-block">✓ Offline & Online Cleared</p>
                  </div>
                  <div className="w-12 h-12 bg-gradient-to-tr from-green-400 to-emerald-500 text-white rounded-lg flex items-center justify-center font-extrabold text-xl shadow-md">₹</div>
                </div>

                <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100 flex items-center justify-between hover:shadow-md transition duration-300">
                  <div>
                    <p className="text-xs font-black text-gray-400 uppercase tracking-wider">Total Appointments</p>
                    <p className="text-3xl font-black text-gray-900 mt-2">{appointments.length}</p>
                    <p className="text-[10px] text-indigo-600 font-bold mt-1 bg-indigo-50 px-2 py-0.5 rounded-md inline-block">Consultation Bookings</p>
                  </div>
                  <div className="w-12 h-12 bg-gradient-to-tr from-indigo-400 to-blue-500 text-white rounded-lg flex items-center justify-center font-extrabold text-xl shadow-md">📅</div>
                </div>

                <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100 flex items-center justify-between hover:shadow-md transition duration-300">
                  <div>
                    <p className="text-xs font-black text-gray-400 uppercase tracking-wider">Pending Review</p>
                    <p className="text-3xl font-black text-amber-500 mt-2">{getStatusCount('pending')}</p>
                    <p className="text-[10px] text-amber-600 font-bold mt-1 bg-amber-50 px-2 py-0.5 rounded-md inline-block">Requires Attention</p>
                  </div>
                  <div className="w-12 h-12 bg-gradient-to-tr from-amber-400 to-orange-500 text-white rounded-lg flex items-center justify-center font-extrabold text-xl shadow-md">⌛</div>
                </div>

                <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100 flex items-center justify-between hover:shadow-md transition duration-300">
                  <div>
                    <p className="text-xs font-black text-gray-400 uppercase tracking-wider">Completed Sessions</p>
                    <p className="text-3xl font-black text-emerald-500 mt-2">{getStatusCount('completed')}</p>
                    <p className="text-[10px] text-emerald-600 font-bold mt-1 bg-emerald-50 px-2 py-0.5 rounded-md inline-block">Successfully Concluded</p>
                  </div>
                  <div className="w-12 h-12 bg-gradient-to-tr from-emerald-400 to-teal-500 text-white rounded-lg flex items-center justify-center font-extrabold text-xl shadow-md">✓</div>
                </div>

              </div>

              {/* Monthly Revenue Bar Chart & Recent Payments breakdown */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                {/* Custom CSS Bar Chart */}
                <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100 lg:col-span-1">
                  <h3 className="text-base font-black text-gray-900 mb-6 uppercase tracking-wider text-xs">Revenue Trend</h3>
                  <div className="h-64 flex items-end justify-around space-x-2 pt-6">
                    {earningsData.monthlyEarnings.length === 0 ? (
                      <p className="text-gray-400 text-xs text-center py-20 w-full">No monthly analytics recorded.</p>
                    ) : (
                      earningsData.monthlyEarnings.map((data, index) => {
                        const heightPercent = Math.max((data.revenue / maxRevenue) * 100, 6);
                        return (
                          <div key={index} className="flex flex-col items-center flex-grow group relative">
                            {/* Hover Tooltip */}
                            <span className="opacity-0 group-hover:opacity-100 transition duration-200 bg-slate-900 text-white text-[10px] font-black px-2 py-1 rounded-lg absolute transform -translate-y-12 shadow-md pointer-events-none whitespace-nowrap z-20">
                              ₹{parseFloat(data.revenue).toLocaleString()}
                            </span>
                            <div
                              style={{ height: `${heightPercent}%` }}
                              className="w-full max-w-[28px] bg-gradient-to-t from-indigo-600 to-blue-500 hover:from-indigo-500 hover:to-blue-400 transition-all duration-300 rounded-t-lg shadow-sm"
                            ></div>
                            <span className="text-[10px] font-extrabold text-gray-400 mt-2 tracking-tight">
                              {data.month.split('-')[1]}/{data.month.split('-')[0].substring(2)}
                            </span>
                          </div>
                        );
                      })
                    )}
                  </div>
                  <p className="text-[10px] text-center text-gray-400 font-bold mt-4 uppercase tracking-wider">Operational Months (Past 6)</p>
                </div>

                {/* Recent Payments table */}
                <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100 lg:col-span-2">
                  <h3 className="text-base font-black text-gray-900 mb-4 uppercase tracking-wider text-xs">Cleared & Pending Payments Log</h3>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-100">
                      <thead>
                        <tr className="text-left text-xs font-black text-gray-400 uppercase tracking-wider">
                          <th className="py-3">Patient Details</th>
                          <th className="py-3">Consultation Date</th>
                          <th className="py-3">Method</th>
                          <th className="py-3 text-right">Fee Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50 text-sm text-gray-700">
                        {earningsData.payments.length === 0 ? (
                          <tr>
                            <td colSpan="4" className="text-center py-12 text-gray-400">No payment logs found.</td>
                          </tr>
                        ) : (
                          earningsData.payments.map((pay) => (
                            <tr key={pay.id} className="hover:bg-gray-50/40 transition duration-150">
                              <td className="py-3.5 pr-4">
                                <div className="font-bold text-gray-900">{pay.patient_name}</div>
                                <div className="text-xs text-gray-500 font-medium">{pay.patient_email}</div>
                              </td>
                              <td className="py-3.5 pr-4 whitespace-nowrap text-xs text-gray-500 font-semibold">
                                {new Date(pay.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                              </td>
                              <td className="py-3.5 pr-4">
                                <span className={`text-[10px] px-2.5 py-0.5 rounded-md font-bold uppercase tracking-wider border ${pay.payment_method === 'online' ? 'bg-blue-50 text-blue-600 border-blue-100' : 'bg-amber-50 text-amber-600 border-amber-100'}`}>
                                  {pay.payment_method}
                                </span>
                              </td>
                              <td className="py-3.5 text-right whitespace-nowrap">
                                <span className="font-extrabold text-gray-900 block">₹{pay.amount}</span>
                                <span className={`text-[9px] font-black uppercase tracking-widest ${pay.status === 'completed' ? 'text-emerald-500' : 'text-amber-500'}`}>
                                  {pay.status}
                                </span>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

              </div>

            </div>
          )}

          {/* TAB 2: APPOINTMENTS & REQUESTS */}
          {activeTab === 'appointments' && (
            <div className="bg-white rounded-lg border border-gray-100 shadow-sm overflow-hidden">

              {/* Header & Filter options */}
              <div className="px-6 py-5 border-b border-gray-100 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div>
                  <h3 className="text-lg font-black text-gray-900 tracking-tight">Consultation Bookings</h3>
                  <p className="text-gray-500 text-xs mt-0.5">Filter, accept, and conclude appointment requests.</p>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {['all', 'pending', 'accepted', 'completed', 'cancelled', 'rejected'].map((status) => (
                    <button
                      key={status}
                      onClick={() => setFilterStatus(status)}
                      className={`text-xs px-3.5 py-2 rounded-lg font-bold capitalize transition duration-200 cursor-pointer ${
                        filterStatus === status
                          ? 'bg-indigo-950 text-white shadow-sm border border-indigo-950'
                          : 'bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gray-100 hover:text-gray-900'
                      }`}
                    >
                      {status} ({status === 'all' ? appointments.length : appointments.filter(a => a.status === status).length})
                    </button>
                  ))}
                </div>
              </div>

              {/* Table list */}
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
                  <tbody className="divide-y divide-gray-50 text-sm text-gray-700">
                    {filteredAppointments.length === 0 ? (
                      <tr>
                        <td colSpan="5" className="text-center py-20 text-gray-400 font-medium">No appointments found matching this status.</td>
                      </tr>
                    ) : (
                      filteredAppointments.map((apt) => (
                        <tr key={apt.id} className="hover:bg-gray-50/30 transition duration-150">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="font-bold text-gray-900">{apt.patient_name}</div>
                            <div className="text-xs text-gray-500 font-medium">{apt.patient_email}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="font-bold text-gray-800">
                              {new Date(apt.date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                            </div>
                            <div className="text-xs text-primary font-bold mt-0.5 bg-blue-50 text-blue-600 px-2 py-0.5 rounded inline-block">
                              {apt.start_time.substring(0, 5)} - {apt.end_time.substring(0, 5)}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`px-2.5 py-1 inline-flex text-xs leading-5 font-bold rounded-md border ${
                              apt.status === 'accepted' ? 'bg-green-50 text-green-700 border-green-100' :
                              apt.status === 'completed' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                              apt.status === 'rejected' ? 'bg-red-50 text-red-700 border-red-100' :
                              apt.status === 'cancelled' ? 'bg-gray-50 text-gray-500 border-gray-100' :
                              'bg-amber-50 text-amber-700 border-amber-100'
                            }`}>
                              {apt.status}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`px-2.5 py-1 inline-flex text-xs leading-5 font-bold rounded-md border ${
                              apt.payment_status === 'completed' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-amber-50 text-amber-700 border-amber-100'
                            }`}>
                              {apt.payment_status === 'completed' ? 'Paid' : 'Pending'}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right space-x-2">
                            {apt.status === 'pending' && (
                              <>
                                <button
                                  onClick={() => handleStatusUpdate(apt.id, 'accepted')}
                                  className="bg-green-500 hover:bg-green-600 text-white text-xs font-bold px-3 py-2 rounded-lg shadow-sm transition active:scale-95 cursor-pointer"
                                >
                                  Accept
                                </button>
                                <button
                                  onClick={() => handleStatusUpdate(apt.id, 'rejected')}
                                  className="bg-red-500 hover:bg-red-600 text-white text-xs font-bold px-3 py-2 rounded-lg shadow-sm transition active:scale-95 cursor-pointer"
                                >
                                  Reject
                                </button>
                              </>
                            )}

                            {apt.status === 'accepted' && (
                              <button
                                onClick={() => handleStatusUpdate(apt.id, 'completed')}
                                className="bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold px-3.5 py-2 rounded-lg shadow-sm transition active:scale-95 cursor-pointer"
                              >
                                Mark Completed
                              </button>
                            )}

                            {(apt.status === 'completed' || apt.status === 'cancelled' || apt.status === 'rejected') && (
                              <span className="text-xs text-gray-400 font-bold italic">No actions</span>
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

          {/* TAB 3: PROFILE & SLOTS CONFIGURATION */}
          {activeTab === 'profile' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">

              {/* Profile Config Form */}
              <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100 flex flex-col justify-between">
                <div>
                  <h2 className="text-lg font-black text-gray-900 mb-6 pb-2 border-b border-gray-100">Consultation Details</h2>
                  <form onSubmit={updateProfile} className="space-y-5">
                    <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider">Specialty</label>
                      <input
                        type="text"
                        name="specialty"
                        value={profile.specialty}
                        onChange={handleProfileChange}
                        className="mt-2 block w-full rounded-lg border-gray-200 shadow-sm p-3.5 border focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none text-sm font-semibold transition"
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
                        className="mt-2 block w-full rounded-lg border-gray-200 shadow-sm p-3.5 border focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none text-sm font-semibold transition"
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
                        className="mt-2 block w-full rounded-lg border-gray-200 shadow-sm p-3.5 border focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none text-sm font-semibold transition"
                        placeholder="e.g. 10"
                      />
                    </div>
                    <button
                      type="submit"
                      className="w-full text-white py-3.5 px-4 rounded-lg font-bold bg-indigo-950 hover:bg-slate-900 shadow active:scale-98 transition duration-150 cursor-pointer text-sm"
                    >
                      Save Profile Changes
                    </button>
                  </form>
                </div>
              </div>

              {/* Slots Creator Form */}
              <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
                <h2 className="text-lg font-black text-gray-900 mb-6 pb-2 border-b border-gray-100">Create Available Timeslot</h2>
                <form onSubmit={addSlot} className="space-y-5">
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider">Select Date</label>
                    <input
                      type="date"
                      name="date"
                      value={slot.date}
                      onChange={handleSlotChange}
                      required
                      className="mt-2 block w-full rounded-lg border-gray-200 shadow-sm p-3.5 border focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none text-sm font-semibold transition"
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
                        className="mt-2 block w-full rounded-lg border-gray-200 shadow-sm p-3.5 border focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none text-sm font-semibold transition"
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
                        className="mt-2 block w-full rounded-lg border-gray-200 shadow-sm p-3.5 border focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none text-sm font-semibold transition"
                      />
                    </div>
                  </div>
                  <button
                    type="submit"
                    className="w-full text-white py-3.5 px-4 rounded-lg font-bold bg-emerald-600 hover:bg-emerald-700 shadow active:scale-98 transition duration-150 cursor-pointer text-sm"
                  >
                    Add Open Slot
                  </button>
                </form>
              </div>

              {/* Full Width Slot Management List */}
              <div className="md:col-span-2 bg-white p-6 rounded-lg shadow-sm border border-gray-100 mt-4">
                <div className="flex justify-between items-center mb-6 pb-2 border-b border-gray-100">
                  <h2 className="text-lg font-black text-gray-900 tracking-tight">Active Consultation Slots</h2>
                  <span className="text-xs bg-indigo-50 text-indigo-700 px-3.5 py-1 rounded-md font-bold border border-indigo-100">
                    Total Slots: {mySlots.length}
                  </span>
                </div>
                {mySlots.length === 0 ? (
                  <p className="text-gray-400 text-sm text-center py-12">No slots created yet. Use the scheduler above to declare availability.</p>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                    {mySlots.map((s) => (
                      <div
                        key={s.id}
                        className={`p-4 rounded-lg border transition duration-200 flex flex-col justify-between ${
                          s.is_booked
                            ? 'border-emerald-100 bg-emerald-50/20'
                            : 'border-gray-200 bg-white hover:border-indigo-200 hover:shadow-sm'
                        }`}
                      >
                        <div>
                          <div className="flex justify-between items-center mb-2">
                            <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Calendar</span>
                            <span className={`text-[9px] font-black px-2 py-0.5 rounded-md uppercase tracking-wider border ${
                              s.is_booked
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                                : 'bg-indigo-50 text-indigo-700 border-indigo-100'
                            }`}>
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
                            className="mt-4 text-xs font-bold text-red-500 hover:text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 py-1.5 px-3 rounded-lg transition duration-150 text-center cursor-pointer active:scale-95"
                          >
                            Delete Slot
                          </button>
                        )}
                        {s.is_booked && (
                          <div className="mt-4 text-xs font-bold text-emerald-600 bg-emerald-100/30 border border-emerald-200 py-1.5 px-3 rounded-lg w-full text-center cursor-not-allowed select-none">
                            Unavailable
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

    </div>
  );
};

export default DoctorDashboard;
