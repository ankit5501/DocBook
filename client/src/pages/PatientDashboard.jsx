import { useState, useEffect } from 'react';
import api from '../api/axios';

const PatientDashboard = () => {
  const [appointments, setAppointments] = useState([]);

  useEffect(() => {
    fetchAppointments();

    const handleNotification = () => {
      fetchAppointments();
    };

    window.addEventListener('new-notification', handleNotification);
    return () => {
      window.removeEventListener('new-notification', handleNotification);
    };
  }, []);

  const fetchAppointments = async () => {
    try {
      const res = await api.get('/appointments/my');
      setAppointments(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const cancelAppointment = async (id) => {
    if (window.confirm('Are you sure you want to cancel this appointment booking?')) {
      try {
        await api.delete(`/appointments/${id}`);
        fetchAppointments();
      } catch (err) {
        console.error(err);
      }
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">

      {/* Header Banner */}
      <div className="relative overflow-hidden bg-slate-950 rounded-lg p-8 mb-8 shadow-md border border-indigo-900/40">
        <div className="relative z-10">
          <span className="inline-block text-xs font-black uppercase tracking-wider bg-indigo-500/20 text-indigo-300 px-3 py-1.5 rounded-md border border-indigo-500/30">
            🏥 Patient Portal
          </span>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-white mt-3 tracking-tight">My Health Dashboard</h1>
          <p className="text-indigo-200/75 text-sm mt-1 max-w-xl">
            Keep track of your scheduled clinic visits, check review statuses, and manage slot cancellations.
          </p>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-100 p-6 shadow-sm">
        <div className="flex justify-between items-center mb-6 pb-2 border-b border-gray-100">
          <h2 className="text-lg font-black text-gray-900 tracking-tight">My Scheduled Consultations</h2>
          <span className="text-xs bg-indigo-50 text-indigo-700 border border-indigo-100 px-3 py-1 rounded-md font-bold">
            Total bookings: {appointments.length}
          </span>
        </div>

        <div className="space-y-4">
          {appointments.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-12 font-bold bg-slate-50/50 rounded-lg border border-dashed border-gray-200">
              No appointments found. Book one from the <a href="/doctors" className="text-indigo-600 hover:text-indigo-800 underline">Find Doctors</a> page.
            </p>
          ) : (
            appointments.map((apt) => (
              <div
                key={apt.id}
                className="border border-gray-200 rounded-lg p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center hover:border-indigo-100 hover:shadow-sm transition duration-200 gap-4 bg-white"
              >
                <div className="space-y-2">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-lg bg-indigo-50 text-indigo-700 font-black flex items-center justify-center">
                      {apt.doctor_name.charAt(0)}
                    </div>
                    <div>
                      <p className="font-extrabold text-gray-900 text-gray-900">Dr. {apt.doctor_name}</p>
                      <p className="text-xs font-bold uppercase tracking-wider text-indigo-600">{apt.specialty}</p>
                    </div>
                  </div>

                  <div className="text-xs text-gray-500 font-bold space-y-1 pl-1">
                    <p className="flex items-center space-x-1.5">
                      <span>📅</span>
                      <span>
                        {new Date(apt.date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                      </span>
                    </p>
                    <p className="flex items-center space-x-1.5 text-indigo-600">
                      <span>🕒</span>
                      <span>{apt.start_time.substring(0, 5)} - {apt.end_time.substring(0, 5)}</span>
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-1.5 mt-2">
                    <span className={`px-2.5 py-0.5 inline-flex text-[10px] leading-5 font-bold rounded-md border ${
                      apt.status === 'accepted' ? 'bg-green-50 text-green-750 border-green-100' :
                      apt.status === 'completed' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                      apt.status === 'rejected' ? 'bg-red-50 text-red-700 border-red-100' :
                      apt.status === 'cancelled' ? 'bg-gray-50 text-gray-500 border-gray-100' :
                      'bg-amber-50 text-amber-700 border-amber-100'
                    }`}>
                      {apt.status}
                    </span>
                    <span className={`px-2.5 py-0.5 inline-flex text-[10px] leading-5 font-bold rounded-md border ${
                      apt.payment_status === 'completed' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-amber-50 text-amber-700 border-amber-100'
                    }`}>
                      Payment: {apt.payment_status === 'completed' ? 'Paid' : 'Unpaid'}
                    </span>
                  </div>
                </div>

                {(apt.status === 'pending' || apt.status === 'accepted') && (
                  <button
                    onClick={() => cancelAppointment(apt.id)}
                    className="px-4 py-2 border border-red-200 text-red-500 hover:bg-red-50 text-xs font-bold rounded-lg transition duration-150 cursor-pointer active:scale-95 self-stretch sm:self-center text-center"
                  >
                    Cancel Booking
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default PatientDashboard;
