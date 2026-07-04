import { Link } from 'react-router-dom';

const Home = () => {
  const features = [
    { title: 'Verified clinicians', text: 'Review specialty, fees, and experience before booking.' },
    { title: 'Live slot booking', text: 'Choose from open clinic times and reserve instantly.' },
    { title: 'Clinic payment flow', text: 'Book online and pay at reception when you arrive.' },
    { title: 'Status updates', text: 'Patients and doctors stay synced as appointments move forward.' }
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      <section className="border-b border-slate-200 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 lg:py-20 grid lg:grid-cols-[1.05fr_0.95fr] gap-10 items-center">
          <div className="space-y-6">
            <span className="inline-flex text-xs font-black uppercase tracking-widest bg-blue-50 text-blue-700 border border-blue-100 px-3 py-1 rounded-md">
              Smart Healthcare Booking
            </span>

            <div className="space-y-4">
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-slate-950 leading-tight tracking-tight">
                Book trusted doctors without the waiting-room guesswork.
              </h1>
              <p className="text-base text-slate-600 max-w-2xl font-medium leading-7">
                Find specialists, compare consultation details, reserve a real clinic slot, and keep your visit status in one clean dashboard.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <Link
                to="/doctors"
                className="w-full sm:w-auto px-6 py-3 bg-slate-950 text-white rounded-lg font-bold text-sm hover:bg-slate-800 shadow-sm transition text-center active:scale-98"
              >
                Book an appointment
              </Link>
              <Link
                to="/register"
                className="w-full sm:w-auto px-6 py-3 bg-white text-slate-800 border border-slate-300 rounded-lg font-bold text-sm hover:bg-slate-50 transition text-center active:scale-98"
              >
                Join as practitioner
              </Link>
            </div>
          </div>

          <div className="dashboard-shell rounded-lg p-5 sm:p-6">
            <div className="flex items-center justify-between border-b border-slate-200 pb-4 mb-5">
              <div>
                <p className="text-xs font-black uppercase tracking-widest text-slate-400">Today</p>
                <h2 className="text-xl font-black text-slate-950 mt-1">Clinic Schedule</h2>
              </div>
              <span className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-100 px-3 py-1 rounded-md">Live</span>
            </div>

            <div className="space-y-3">
              {[
                ['09:30', 'Dr. Mehta', 'Cardiology', 'Available'],
                ['10:15', 'Dr. Rao', 'Dermatology', 'Booked'],
                ['11:00', 'Dr. Sharma', 'Neurology', 'Available']
              ].map(([time, doctor, specialty, status]) => (
                <div key={`${time}-${doctor}`} className="grid grid-cols-[72px_1fr_auto] gap-3 items-center rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
                  <span className="text-sm font-black text-slate-950">{time}</span>
                  <div>
                    <p className="text-sm font-extrabold text-slate-900">{doctor}</p>
                    <p className="text-xs font-bold text-slate-500">{specialty}</p>
                  </div>
                  <span className={`text-xs font-bold px-2 py-1 rounded-md border ${status === 'Available' ? 'text-blue-700 bg-blue-50 border-blue-100' : 'text-amber-700 bg-amber-50 border-amber-100'}`}>
                    {status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {features.map((feature) => (
            <div key={feature.title} className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm">
              <h3 className="font-black text-slate-950 text-sm">{feature.title}</h3>
              <p className="text-sm text-slate-600 mt-2 leading-6">{feature.text}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};

export default Home;
