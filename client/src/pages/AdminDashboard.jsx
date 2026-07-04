import { useState, useEffect } from 'react';
import api from '../api/axios';
import { toast } from 'react-toastify';

const AdminDashboard = () => {
  const [activeTab, setActiveTab] = useState('analytics'); // analytics, verify, users, bookings
  const [loading, setLoading] = useState(true);

  // States
  const [stats, setStats] = useState({
    patients: 0,
    doctors: 0,
    appointments: 0,
    revenue: 0,
    statusBreakdown: [],
    monthlyRevenue: [],
    monthlyBookings: []
  });
  const [doctors, setDoctors] = useState([]);
  const [users, setUsers] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchData();

    const handleNotification = () => {
      fetchData();
    };

    window.addEventListener('new-notification', handleNotification);
    return () => {
      window.removeEventListener('new-notification', handleNotification);
    };
  }, [activeTab]);

  const fetchData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'analytics') {
        const statsRes = await api.get('/admin/stats');
        setStats(statsRes.data);
      } else if (activeTab === 'verify') {
        const doctorsRes = await api.get('/admin/doctors');
        setDoctors(doctorsRes.data);
      } else if (activeTab === 'users') {
        const usersRes = await api.get('/admin/users');
        setUsers(usersRes.data);
      } else if (activeTab === 'bookings') {
        const appointmentsRes = await api.get('/admin/appointments');
        setAppointments(appointmentsRes.data);
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to load admin dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const verifyDoctor = async (id, currentStatus) => {
    try {
      await api.patch(`/admin/doctors/${id}/verify`, { is_verified: !currentStatus });
      toast.success('Doctor verification status updated');
      fetchData(); // refresh list
    } catch (err) {
      toast.error('Failed to update doctor verification');
    }
  };

  const toggleUserBlock = async (id, currentBlockStatus) => {
    try {
      await api.patch(`/admin/users/${id}/block`, { is_blocked: !currentBlockStatus });
      toast.success(`User successfully ${!currentBlockStatus ? 'blocked' : 'unblocked'}`);
      fetchData(); // refresh list
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update block status');
    }
  };

  const cancelBooking = async (id) => {
    if (window.confirm('Are you sure you want to cancel this booking globally? This will free the timeslot.')) {
      try {
        await api.patch(`/admin/appointments/${id}/cancel`);
        toast.success('Booking cancelled successfully and slot freed.');
        fetchData(); // refresh list
      } catch (err) {
        toast.error('Failed to cancel appointment');
      }
    }
  };

  // User search filter
  const filteredUsers = users.filter(user =>
    user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.role.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Math helper for scaling custom revenue charts
  const maxRevenue = Math.max(...stats.monthlyRevenue.map(m => parseFloat(m.revenue) || 0), 1000);
  const maxBookings = Math.max(...stats.monthlyBookings.map(b => parseInt(b.count) || 0), 5);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">

      {/* Header Banner */}
      <div className="relative overflow-hidden bg-slate-950 rounded-lg p-8 mb-8 shadow-md border border-indigo-900/40">

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div>
            <span className="inline-block text-xs font-black uppercase tracking-wider bg-indigo-500/20 text-indigo-300 px-3 py-1.5 rounded-md border border-indigo-500/30">
              🛡️ Admin Terminal
            </span>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-white mt-3 tracking-tight">Clinic Control Center</h1>
            <p className="text-indigo-200/75 text-sm mt-1 max-w-xl">
              Review doctor registrations, monitor platform financials, manage accounts, and verify appointments.
            </p>
          </div>

          {/* Navigation Tab list */}
          <div className="flex bg-white/5 border border-white/10 p-1.5 rounded-lg backdrop-blur-md self-start lg:self-center shadow-md">
            <button
              onClick={() => setActiveTab('analytics')}
              className={`px-4.5 py-2.5 rounded-lg font-bold text-xs sm:text-sm tracking-tight transition duration-200 cursor-pointer ${activeTab === 'analytics' ? 'bg-white text-indigo-950 shadow-md font-extrabold' : 'text-indigo-200 hover:text-white'}`}
            >
              Analytics
            </button>
            <button
              onClick={() => setActiveTab('verify')}
              className={`px-4.5 py-2.5 rounded-lg font-bold text-xs sm:text-sm tracking-tight transition duration-200 cursor-pointer ${activeTab === 'verify' ? 'bg-white text-indigo-950 shadow-md font-extrabold' : 'text-indigo-200 hover:text-white'}`}
            >
              Doctor Approval
            </button>
            <button
              onClick={() => setActiveTab('users')}
              className={`px-4.5 py-2.5 rounded-lg font-bold text-xs sm:text-sm tracking-tight transition duration-200 cursor-pointer ${activeTab === 'users' ? 'bg-white text-indigo-950 shadow-md font-extrabold' : 'text-indigo-200 hover:text-white'}`}
            >
              Users
            </button>
            <button
              onClick={() => setActiveTab('bookings')}
              className={`px-4.5 py-2.5 rounded-lg font-bold text-xs sm:text-sm tracking-tight transition duration-200 cursor-pointer ${activeTab === 'bookings' ? 'bg-white text-indigo-950 shadow-md font-extrabold' : 'text-indigo-200 hover:text-white'}`}
            >
              Bookings
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
          <p className="text-gray-500 font-bold mt-4 tracking-tight">Syncing database operations...</p>
        </div>
      ) : (
        <>
          {/* TAB 1: ANALYTICS & STATS */}
          {activeTab === 'analytics' && (
            <div className="space-y-8">

              {/* Stats KPI Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">

                <div className="bg-white p-6 rounded-lg border border-gray-100 flex items-center justify-between hover:shadow-md transition duration-300">
                  <div>
                    <p className="text-xs font-black text-gray-400 uppercase tracking-wider">Gross Revenue</p>
                    <p className="text-3xl font-black text-green-600 mt-2">₹{stats.revenue.toLocaleString()}</p>
                    <p className="text-[10px] text-gray-500 font-semibold mt-1">Cleared online payments</p>
                  </div>
                  <div className="w-12 h-12 bg-green-50 rounded-lg flex items-center justify-center text-green-500 font-bold text-xl shadow-sm border border-green-100">₹</div>
                </div>

                <div className="bg-white p-6 rounded-lg border border-gray-100 flex items-center justify-between hover:shadow-md transition duration-300">
                  <div>
                    <p className="text-xs font-black text-gray-400 uppercase tracking-wider">Total Bookings</p>
                    <p className="text-3xl font-black text-gray-900 mt-2">{stats.appointments}</p>
                    <p className="text-[10px] text-gray-500 font-semibold mt-1">Registered consultations</p>
                  </div>
                  <div className="w-12 h-12 bg-blue-50 rounded-lg flex items-center justify-center text-blue-500 font-bold text-xl shadow-sm border border-blue-100">📅</div>
                </div>

                <div className="bg-white p-6 rounded-lg border border-gray-100 flex items-center justify-between hover:shadow-md transition duration-300">
                  <div>
                    <p className="text-xs font-black text-gray-400 uppercase tracking-wider">Active Patients</p>
                    <p className="text-3xl font-black text-purple-600 mt-2">{stats.patients}</p>
                    <p className="text-[10px] text-gray-500 font-semibold mt-1">Registered patient accounts</p>
                  </div>
                  <div className="w-12 h-12 bg-purple-50 rounded-lg flex items-center justify-center text-purple-500 font-bold text-xl shadow-sm border border-purple-100">👥</div>
                </div>

                <div className="bg-white p-6 rounded-lg border border-gray-100 flex items-center justify-between hover:shadow-md transition duration-300">
                  <div>
                    <p className="text-xs font-black text-gray-400 uppercase tracking-wider">Network Doctors</p>
                    <p className="text-3xl font-black text-cyan-600 mt-2">{stats.doctors}</p>
                    <p className="text-[10px] text-gray-500 font-semibold mt-1">Affiliated practitioners</p>
                  </div>
                  <div className="w-12 h-12 bg-cyan-50 rounded-lg flex items-center justify-center text-cyan-500 font-bold text-xl shadow-sm border border-cyan-100">🩺</div>
                </div>

              </div>

              {/* Graphical Charts Layout */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                {/* Monthly Revenue Chart */}
                <div className="bg-white p-6 rounded-lg border border-gray-100 lg:col-span-1">
                  <h3 className="text-base font-black text-gray-900 mb-6 uppercase tracking-wider text-xs">Monthly Revenue</h3>
                  <div className="h-64 flex items-end justify-around space-x-2 pt-6">
                    {stats.monthlyRevenue.length === 0 ? (
                      <p className="text-gray-400 text-xs text-center py-20 w-full">No monthly financial details.</p>
                    ) : (
                      stats.monthlyRevenue.map((data, index) => {
                        const h = Math.max((parseFloat(data.revenue) / maxRevenue) * 100, 6);
                        return (
                          <div key={index} className="flex flex-col items-center flex-grow group relative">
                            <span className="opacity-0 group-hover:opacity-100 transition bg-slate-900 text-white text-[10px] px-2 py-1 rounded absolute transform -translate-y-12 shadow pointer-events-none font-bold whitespace-nowrap z-20">
                              ₹{parseFloat(data.revenue).toLocaleString()}
                            </span>
                            <div
                              style={{ height: `${h}%` }}
                              className="w-full max-w-[28px] bg-emerald-500 hover:bg-emerald-600 transition rounded-t-lg shadow-sm"
                            ></div>
                            <span className="text-[10px] font-bold text-gray-400 mt-2">{data.month}</span>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* Monthly Bookings Count Chart */}
                <div className="bg-white p-6 rounded-lg border border-gray-100 lg:col-span-1">
                  <h3 className="text-base font-black text-gray-900 mb-6 uppercase tracking-wider text-xs">Consultation Volumes</h3>
                  <div className="h-64 flex items-end justify-around space-x-2 pt-6">
                    {stats.monthlyBookings.length === 0 ? (
                      <p className="text-gray-400 text-xs text-center py-20 w-full">No bookings analytics logged.</p>
                    ) : (
                      stats.monthlyBookings.map((data, index) => {
                        const h = Math.max((parseInt(data.count) / maxBookings) * 100, 6);
                        return (
                          <div key={index} className="flex flex-col items-center flex-grow group relative">
                            <span className="opacity-0 group-hover:opacity-100 transition bg-slate-950 text-white text-[10px] px-2 py-1 rounded absolute transform -translate-y-12 shadow pointer-events-none font-bold whitespace-nowrap z-20">
                              {data.count} bookings
                            </span>
                            <div
                              style={{ height: `${h}%` }}
                              className="w-full max-w-[28px] bg-indigo-600 hover:bg-indigo-700 transition rounded-t-lg shadow-sm"
                            ></div>
                            <span className="text-[10px] font-bold text-gray-400 mt-2">{data.month}</span>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* Status Breakdown breakout */}
                <div className="bg-white p-6 rounded-lg border border-gray-100 lg:col-span-1">
                  <h3 className="text-base font-black text-gray-900 mb-4 uppercase tracking-wider text-xs">Booking Summary</h3>
                  <div className="space-y-4 pt-4">
                    {stats.statusBreakdown.length === 0 ? (
                      <p className="text-gray-400 text-xs font-semibold">No status logs recorded.</p>
                    ) : (
                      stats.statusBreakdown.map((row, index) => {
                        const total = stats.statusBreakdown.reduce((sum, item) => sum + parseInt(item.count), 0) || 1;
                        const percent = Math.round((parseInt(row.count) / total) * 100);
                        return (
                          <div key={index} className="space-y-1.5">
                            <div className="flex justify-between text-xs font-bold">
                              <span className="capitalize text-gray-650">{row.status}</span>
                              <span className="text-gray-900">{row.count} ({percent}%)</span>
                            </div>
                            <div className="w-full bg-gray-100 h-2 rounded-md overflow-hidden">
                              <div
                                style={{ width: `${percent}%` }}
                                className={`h-full rounded-md ${
                                  row.status === 'accepted' ? 'bg-green-500' :
                                  row.status === 'completed' ? 'bg-emerald-500' :
                                  row.status === 'rejected' ? 'bg-red-500' :
                                  row.status === 'cancelled' ? 'bg-gray-450' :
                                  'bg-amber-505 bg-amber-500'
                                }`}
                              ></div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

              </div>

            </div>
          )}

          {/* TAB 2: DOCTOR APPROVAL */}
          {activeTab === 'verify' && (
            <div className="bg-white rounded-lg border border-gray-100 overflow-hidden shadow-sm">
              <div className="px-6 py-5 border-b border-gray-100">
                <h2 className="text-base font-black text-gray-900 uppercase tracking-wider text-xs">Doctor Verification Terminal</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-100">
                  <thead className="bg-gray-50/50">
                    <tr className="text-left text-xs font-black text-gray-400 uppercase tracking-wider">
                      <th className="px-6 py-4">Doctor Details</th>
                      <th className="px-6 py-4">Specialty</th>
                      <th className="px-6 py-4">Experience</th>
                      <th className="px-6 py-4">Status</th>
                      <th className="px-6 py-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50 text-sm text-gray-700 font-medium">
                    {doctors.length === 0 ? (
                      <tr>
                        <td colSpan="5" className="text-center py-12 text-gray-450">No doctor profile details registered.</td>
                      </tr>
                    ) : (
                      doctors.map((doctor) => (
                        <tr key={doctor.id} className="hover:bg-gray-50/30 transition duration-150">
                          <td className="px-6 py-4">
                            <div className="font-extrabold text-gray-900">Dr. {doctor.name}</div>
                            <div className="text-xs text-gray-500 font-semibold">{doctor.email}</div>
                          </td>
                          <td className="px-6 py-4 text-indigo-600 font-bold uppercase tracking-wider text-xs">{doctor.specialty || 'N/A'}</td>
                          <td className="px-6 py-4 text-gray-500">{doctor.experience || 0} Years</td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`px-2.5 py-1 inline-flex text-xs leading-5 font-bold rounded-md border ${doctor.is_verified ? 'bg-green-50 text-green-700 border-green-100' : 'bg-red-50 text-red-700 border-red-100'}`}>
                              {doctor.is_verified ? 'Verified' : 'Pending'}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <button
                              onClick={() => verifyDoctor(doctor.id, doctor.is_verified)}
                              className={`text-white px-3.5 py-2 rounded-lg text-xs font-bold shadow-sm transition active:scale-95 cursor-pointer ${
                                doctor.is_verified ? 'bg-red-500 hover:bg-red-600' : 'bg-green-500 hover:bg-green-600'
                              }`}
                            >
                              {doctor.is_verified ? 'Revoke Verify' : 'Verify Doctor'}
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 3: USER MANAGEMENT */}
          {activeTab === 'users' && (
            <div className="bg-white rounded-lg border border-gray-100 overflow-hidden shadow-sm">

              {/* Search Bar */}
              <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/20 flex flex-col sm:flex-row items-center justify-between gap-4">
                <h2 className="text-base font-black text-gray-900 uppercase tracking-wider text-xs">Platform Registry Accounts</h2>
                <input
                  type="text"
                  placeholder="Search accounts name, email, or role..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="bg-white border border-gray-200 rounded-lg px-4 py-2.5 text-xs font-semibold outline-none w-full max-w-xs focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition"
                />
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-100">
                  <thead className="bg-gray-50/50">
                    <tr className="text-left text-xs font-black text-gray-400 uppercase tracking-wider">
                      <th className="px-6 py-4">Name</th>
                      <th className="px-6 py-4">Email</th>
                      <th className="px-6 py-4">Role</th>
                      <th className="px-6 py-4">Joined Date</th>
                      <th className="px-6 py-4">Status</th>
                      <th className="px-6 py-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50 text-sm text-gray-700 font-medium">
                    {filteredUsers.length === 0 ? (
                      <tr>
                        <td colSpan="6" className="text-center py-12 text-gray-450">No matching user accounts found.</td>
                      </tr>
                    ) : (
                      filteredUsers.map((userRow) => (
                        <tr key={userRow.id} className="hover:bg-gray-50/30 transition duration-150">
                          <td className="px-6 py-4 font-extrabold text-gray-900">{userRow.name}</td>
                          <td className="px-6 py-4 text-gray-500">{userRow.email}</td>
                          <td className="px-6 py-4">
                            <span className={`px-2 py-0.5 text-[9px] rounded font-black uppercase tracking-wider border ${
                              userRow.role === 'doctor' ? 'bg-cyan-50 text-cyan-700 border-cyan-100' : 'bg-purple-50 text-purple-700 border-purple-100'
                            }`}>
                              {userRow.role}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-gray-400 text-xs">{new Date(userRow.created_at).toLocaleDateString()}</td>
                          <td className="px-6 py-4">
                            <span className={`px-2.5 py-1 inline-flex text-xs font-bold rounded-md border ${
                              userRow.is_blocked ? 'bg-red-50 text-red-700 border-red-100' : 'bg-green-50 text-green-700 border-green-100'
                            }`}>
                              {userRow.is_blocked ? 'Blocked' : 'Active'}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <button
                              onClick={() => toggleUserBlock(userRow.id, userRow.is_blocked)}
                              className={`px-3.5 py-2 rounded-lg text-xs font-bold transition active:scale-95 cursor-pointer ${
                                userRow.is_blocked
                                  ? 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-sm'
                                  : 'bg-red-500 hover:bg-red-600 text-white shadow-sm'
                              }`}
                            >
                              {userRow.is_blocked ? 'Unblock Account' : 'Block Account'}
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 4: ALL APPOINTMENTS */}
          {activeTab === 'bookings' && (
            <div className="bg-white rounded-lg border border-gray-100 overflow-hidden shadow-sm">
              <div className="px-6 py-5 border-b border-gray-100">
                <h2 className="text-base font-black text-gray-900 uppercase tracking-wider text-xs">Appointment Master Audit Logs</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-100">
                  <thead className="bg-gray-50/50">
                    <tr className="text-left text-xs font-black text-gray-400 uppercase tracking-wider">
                      <th className="px-6 py-4">Patient details</th>
                      <th className="px-6 py-4">Assigned Doctor</th>
                      <th className="px-6 py-4">Consultation Time</th>
                      <th className="px-6 py-4">Status</th>
                      <th className="px-6 py-4">Payment</th>
                      <th className="px-6 py-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50 text-sm text-gray-700 font-medium">
                    {appointments.length === 0 ? (
                      <tr>
                        <td colSpan="6" className="text-center py-12 text-gray-450">No appointment bookings logs captured.</td>
                      </tr>
                    ) : (
                      appointments.map((apt) => (
                        <tr key={apt.id} className="hover:bg-gray-50/30 transition duration-150">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="font-extrabold text-gray-900">{apt.patient_name}</div>
                            <div className="text-xs text-gray-500 font-semibold">{apt.patient_email}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="font-extrabold text-gray-900">Dr. {apt.doctor_name}</div>
                            <div className="text-xs text-gray-500 font-semibold uppercase tracking-wider text-[10px]">{apt.specialty}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-xs text-gray-500 font-bold">
                            <div>{new Date(apt.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</div>
                            <div className="text-indigo-600 font-black mt-0.5 text-[10px]">{apt.start_time.substring(0, 5)} - {apt.end_time.substring(0, 5)}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`px-2.5 py-1 inline-flex text-xs leading-5 font-bold rounded-md border ${
                              apt.status === 'accepted' ? 'bg-green-50 text-green-700 border-green-100' :
                              apt.status === 'completed' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                              apt.status === 'rejected' ? 'bg-red-50 text-red-700 border-red-100' :
                              apt.status === 'cancelled' ? 'bg-gray-50 text-gray-550 border-gray-100' :
                              'bg-amber-50 text-amber-700 border-amber-100'
                            }`}>
                              {apt.status}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-xs font-semibold">
                            <div className="font-bold text-gray-700 uppercase tracking-widest text-[9px]">{apt.payment_method || 'Online'}</div>
                            <div className={`font-black mt-0.5 ${apt.payment_status === 'completed' ? 'text-green-600' : 'text-amber-600'}`}>
                              {apt.payment_status === 'completed' ? 'Paid' : 'Pending'}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right">
                            {apt.status !== 'cancelled' && apt.status !== 'completed' && apt.status !== 'rejected' ? (
                              <button
                                onClick={() => cancelBooking(apt.id)}
                                className="bg-red-500 hover:bg-red-600 text-white px-3.5 py-2 rounded-lg text-xs font-bold shadow-sm transition active:scale-95 cursor-pointer"
                              >
                                Cancel Booking
                              </button>
                            ) : (
                              <span className="text-xs text-gray-400 italic font-bold">No actions</span>
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
        </>
      )}

    </div>
  );
};

export default AdminDashboard;
