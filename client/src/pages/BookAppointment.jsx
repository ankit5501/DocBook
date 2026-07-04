import { useState, useEffect, useContext } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { AuthContext } from '../context/AuthContext';
import { toast } from 'react-toastify';

const BookAppointment = () => {
  const { id } = useParams(); // doctor_id
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);
  const [slots, setSlots] = useState([]);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [doctorInfo, setDoctorInfo] = useState(null);

  useEffect(() => {
    const fetchDoctorAndSlots = async () => {
      try {
        const [doctorsRes, slotsRes] = await Promise.all([
          api.get('/doctors'),
          api.get(`/doctors/${id}/slots`)
        ]);

        // Find doctor details
        const doc = doctorsRes.data.find(d => d.id === parseInt(id));
        if (doc) setDoctorInfo(doc);
        setSlots(slotsRes.data);
      } catch (err) {
        console.error(err);
        setError('Failed to fetch doctor or slots details');
      }
    };

    fetchDoctorAndSlots();
  }, [id]);

  const handleBook = async () => {
    if (!user) {
      toast.info('Please login to book an appointment');
      navigate('/login');
      return;
    }
    if (!selectedSlot) {
      toast.warning('Please select a slot');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // 1. Create booking/appointment request
      const bookRes = await api.post('/appointments', {
        doctor_id: parseInt(id),
        slot_id: selectedSlot.id
      });

      const appointmentId = bookRes.data.id;

      // 2. Offline Payment Flow (Pay at Clinic)
      await api.post('/payments/offline', { appointment_id: appointmentId });
      toast.success('Appointment booked successfully! Confirmation fee slip emailed.');
      navigate('/dashboard');
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.message || 'Booking process failed.');
      setLoading(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12 relative z-10">
      <div className="bg-white shadow-md rounded-lg overflow-hidden border border-gray-100">

        {/* Banner Headers */}
        <div className="relative overflow-hidden bg-slate-950 px-8 py-12 text-white border-b border-indigo-950/20">
          <div className="relative z-10">
            <span className="text-xs font-black uppercase tracking-wider bg-indigo-500/30 text-indigo-300 px-3 py-1.5 rounded-md border border-indigo-500/30">
              🗓️ Consultation Scheduler
            </span>
            <h2 className="text-3xl font-extrabold tracking-tight mt-3">Complete Your Appointment Booking</h2>
            <p className="mt-2 text-indigo-200/80 text-sm max-w-xl">
              Select an available timeslot. Consultation fee payment will be collected at the counter when you arrive at the clinic.
            </p>
          </div>
        </div>

        <div className="p-8 grid grid-cols-1 lg:grid-cols-3 gap-8">

          {/* Left/Middle Columns: Details Selection */}
          <div className="lg:col-span-2 space-y-8">

            {/* Doctor Info Brief */}
            {doctorInfo && (
              <div className="bg-indigo-50/20 p-6 rounded-lg border border-indigo-100/50 flex items-center space-x-5">
                <div className="w-16 h-16 rounded-lg bg-gradient-to-tr from-indigo-600 to-blue-500 text-white flex items-center justify-center text-2xl font-black shadow-sm">
                  {doctorInfo.name.charAt(0)}
                </div>
                <div>
                  <h4 className="text-lg font-black text-gray-900">Dr. {doctorInfo.name}</h4>
                  <p className="text-xs font-bold text-indigo-600 uppercase tracking-wide">{doctorInfo.specialty || 'General Practitioner'}</p>
                  <div className="flex items-center space-x-3 text-xs text-gray-500 mt-1.5 font-bold">
                    <span>⭐ {doctorInfo.experience || 0} Yrs Experience</span>
                    <span className="text-gray-300">|</span>
                    <span>💰 Fee: ₹{doctorInfo.fees}</span>
                  </div>
                </div>
              </div>
            )}

            {error && <div className="text-red-600 bg-red-50 p-4 rounded-lg text-sm border border-red-200 font-bold">{error}</div>}

            {/* Slots section */}
            <div>
              <h3 className="text-sm font-black text-gray-400 uppercase tracking-widest mb-4">1. Choose Date & Time Slot</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5">
                {slots.length === 0 ? (
                  <p className="col-span-full text-gray-500 text-xs bg-gray-50 py-8 text-center rounded-lg border border-dashed border-gray-300 font-bold">
                    No available timeslots found for this practitioner. Please check back later.
                  </p>
                ) : (
                  slots.map((slotItem) => (
                    <div
                      key={slotItem.id}
                      onClick={() => setSelectedSlot(slotItem)}
                      className={`cursor-pointer rounded-lg border p-4.5 text-center transition duration-200 active:scale-98 select-none ${
                        selectedSlot?.id === slotItem.id
                          ? 'border-indigo-600 bg-indigo-50/40 ring-2 ring-indigo-500/20 transform scale-[1.02] shadow-sm'
                          : 'border-gray-200 hover:border-indigo-300 hover:bg-indigo-50/10'
                      }`}
                    >
                      <p className="font-extrabold text-gray-800 text-xs uppercase tracking-wide">
                        {new Date(slotItem.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', weekday: 'short' })}
                      </p>
                      <p className="text-sm text-indigo-600 font-black mt-2">
                        {slotItem.start_time.substring(0, 5)} - {slotItem.end_time.substring(0, 5)}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Payment Method description */}
            <div>
              <h3 className="text-sm font-black text-gray-400 uppercase tracking-widest mb-4">2. Payment Policy</h3>
              <div className="bg-slate-50 p-6 rounded-lg border border-gray-200">
                <div className="flex items-start space-x-3.5">
                  <div className="text-xl mt-0.5">ℹ️</div>
                  <div>
                    <span className="font-black text-slate-800 text-sm block">Pay Offline (At Clinic Counter)</span>
                    <p className="text-xs text-gray-500 mt-1.5 leading-relaxed font-semibold">
                      Your booking is secured without online prepayment. Confirm your slot now and clear the consultation fee of <strong>₹{doctorInfo?.fees || 0}</strong> at the reception counter via Cash, UPI, or Card prior to your appointment.
                    </p>
                  </div>
                </div>
              </div>
            </div>

          </div>

          {/* Right Column: Summary Card */}
          <div className="lg:col-span-1">
            <div className="border border-gray-200 bg-gray-50/60 rounded-lg p-6 sticky top-6 shadow-inner">
              <h3 className="text-sm font-black text-gray-400 uppercase tracking-widest pb-3 border-b border-gray-200">Booking Summary</h3>

              <div className="space-y-3 mt-4 text-xs font-semibold text-gray-600">
                <div className="flex justify-between">
                  <span>Consultation Fee:</span>
                  <span className="font-extrabold text-gray-800">₹{doctorInfo?.fees || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span>Payment Mode:</span>
                  <span className="font-extrabold text-gray-800">Offline (At Clinic)</span>
                </div>
                <div className="flex justify-between pt-3.5 border-t border-dashed border-gray-300 font-black text-gray-900 text-sm">
                  <span>Total Due:</span>
                  <span className="text-indigo-600 text-base">₹{doctorInfo?.fees || 0}</span>
                </div>
              </div>

              <div className="mt-6">
                <button
                  onClick={handleBook}
                  disabled={!selectedSlot || loading}
                  className={`w-full py-3.5 px-4 rounded-lg font-bold text-white shadow-md transition duration-200 flex justify-center items-center cursor-pointer ${
                    !selectedSlot || loading
                      ? 'bg-gray-300 cursor-not-allowed text-gray-500 shadow-none'
                      : 'bg-indigo-950 hover:bg-slate-900 hover:shadow-md active:scale-98'
                  }`}
                >
                  {loading ? (
                    <span className="flex items-center">
                      <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Scheduling slot...
                    </span>
                  ) : (
                    'Confirm Slot booking'
                  )}
                </button>

                {!selectedSlot && (
                  <p className="text-[10px] text-center text-red-500 mt-3.5 font-bold uppercase tracking-wider">Please select a time slot above</p>
                )}
              </div>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
};

export default BookAppointment;
