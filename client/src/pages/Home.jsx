import { Link } from 'react-router-dom';

const Home = () => {
  const capabilities = [
    {
      badge: 'Capability 1',
      icon: '✨',
      title: 'Smart Doctor Matching',
      text: 'Ranks doctors based on your symptoms, clinical specialty, fee budget, and urgency, providing transparent, human-readable explanations behind every match score.',
      link: '/doctors',
      cta: 'Match Specialists →'
    },
    {
      badge: 'Capability 2 • Highest Priority',
      icon: '📋',
      title: 'Smart Appointment Waitlist',
      text: 'Join waitlists when slots are full. The instant someone cancels or reschedules, DocBook notifies the first eligible patient with a 15-minute claim offer, automatically expiring and rolling over unclaimed offers.',
      link: '/dashboard',
      cta: 'View Priority Waitlist →'
    },
    {
      badge: 'Capability 3',
      icon: '🏥',
      title: 'Live Clinic Coordination',
      text: 'Generates a digital queue token upon arrival. Displays the currently serving patient, estimates wait time using actual consultation pace today, and alerts you when your turn approaches.',
      link: '/dashboard',
      cta: 'Live Clinic Status →'
    }
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Hero Section */}
      <section className="border-b border-slate-200 bg-white relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 lg:py-24 grid lg:grid-cols-[1.1fr_0.9fr] gap-12 items-center">
          <div className="space-y-6">
            <span className="inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-widest bg-indigo-50 text-indigo-700 border border-indigo-100 px-3 py-1 rounded-full">
              <span>🩺</span> Intelligent Healthcare Appointment Management
            </span>

            <div className="space-y-4">
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-slate-950 leading-tight tracking-tight">
                Find the right doctor. Get the right slot. Spend less time waiting.
              </h1>
              <p className="text-base sm:text-lg text-slate-600 max-w-2xl font-medium leading-relaxed">
                DocBook unites AI symptom-to-specialist ranking with transparent match reasons, an automated cancellation waitlist with 15-minute claim offers, and real-time clinic digital token tracking.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <Link
                to="/doctors"
                className="px-7 py-3.5 bg-indigo-950 text-white rounded-xl font-black text-sm hover:bg-slate-900 shadow-md hover:shadow-lg transition text-center active:scale-98"
              >
                ✨ Smart Match & Book Doctor
              </Link>
              <Link
                to="/dashboard"
                className="px-7 py-3.5 bg-white text-slate-800 border border-slate-300 rounded-xl font-bold text-sm hover:bg-slate-50 transition text-center active:scale-98 shadow-sm"
              >
                Patient Dashboard & Tokens
              </Link>
            </div>

            <div className="pt-2 flex flex-wrap items-center gap-6 text-xs font-bold text-slate-500">
              <span className="flex items-center gap-1.5">
                <span className="text-emerald-500">✓</span> Atomic Double-Booking Prevention
              </span>
              <span className="flex items-center gap-1.5">
                <span className="text-indigo-500">✓</span> Auto-Expiring Waitlist Offers
              </span>
              <span className="flex items-center gap-1.5">
                <span className="text-amber-500">✓</span> Real-Time Turn Approaching Alerts
              </span>
            </div>
          </div>

          {/* Live Clinic Coordination Simulation Card */}
          <div className="bg-gradient-to-br from-slate-950 to-indigo-950 rounded-2xl p-6 sm:p-7 text-white shadow-2xl border border-indigo-900/40 space-y-5">
            <div className="flex items-center justify-between border-b border-indigo-900/60 pb-4">
              <div>
                <span className="text-[10px] font-black uppercase tracking-widest text-indigo-300">Live Coordination</span>
                <h3 className="text-lg font-black text-white mt-0.5">Clinic Queue & Token Display</h3>
              </div>
              <span className="text-xs font-black text-emerald-400 bg-emerald-500/20 border border-emerald-400/30 px-2.5 py-1 rounded-full flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span> Active
              </span>
            </div>

            {/* Currently Serving Banner */}
            <div className="bg-white/10 rounded-xl p-4 border border-white/10 flex items-center justify-between">
              <div>
                <span className="text-[10px] uppercase font-bold text-indigo-300 block">Currently Serving</span>
                <span className="text-2xl font-black font-mono text-emerald-400">TOKEN #TK-004</span>
                <p className="text-xs text-indigo-200 mt-0.5">Dr. Mehta • Cardiology Consultation</p>
              </div>
              <div className="text-right">
                <span className="text-[10px] uppercase font-bold text-indigo-300 block">Pace Today</span>
                <span className="text-sm font-black text-white font-mono">11 min / patient</span>
              </div>
            </div>

            {/* Simulated Live Queue Progress */}
            <div className="space-y-2.5 text-xs">
              <div className="grid grid-cols-[80px_1fr_auto] gap-3 items-center rounded-xl bg-white/5 border border-white/10 px-3.5 py-2.5">
                <span className="font-mono font-black text-emerald-400">TK-004</span>
                <span className="text-slate-200 font-bold">Rahul Verma</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">In Room</span>
              </div>

              <div className="grid grid-cols-[80px_1fr_auto] gap-3 items-center rounded-xl bg-amber-500/10 border border-amber-400/30 px-3.5 py-2.5">
                <span className="font-mono font-black text-amber-300">TK-005</span>
                <div className="text-left">
                  <span className="text-white font-bold block">Priya Sharma (You)</span>
                  <span className="text-[10px] text-amber-300 font-medium">🔔 Turn Approaching • Next In Line</span>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">~4 mins wait</span>
              </div>

              <div className="grid grid-cols-[80px_1fr_auto] gap-3 items-center rounded-xl bg-white/5 border border-white/10 px-3.5 py-2.5">
                <span className="font-mono font-black text-slate-300">TK-006</span>
                <span className="text-slate-300 font-bold">Vikram Patel</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-700/50 text-slate-300">~15 mins wait</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* The 3 Core DocBook Capabilities Grid */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <span className="text-xs font-black uppercase tracking-widest bg-indigo-50 text-indigo-700 px-3 py-1 rounded-full border border-indigo-100">
            DocBook Core Capabilities
          </span>
          <h2 className="text-3xl font-black text-slate-950 mt-3 tracking-tight">
            Built for Frictionless Clinic Care
          </h2>
          <p className="text-slate-600 text-sm mt-2 font-medium">
            Three intelligent capabilities working in harmony to streamline discovery, slot access, and in-clinic queueing.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {capabilities.map((cap) => (
            <div
              key={cap.title}
              className="bg-white border border-slate-200/90 rounded-2xl p-7 shadow-sm hover:shadow-xl hover:-translate-y-1 transition duration-300 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-4">
                  <span className="text-3xl">{cap.icon}</span>
                  <span className="text-[10px] font-black uppercase tracking-wider bg-slate-100 text-slate-700 px-2.5 py-1 rounded-full">
                    {cap.badge}
                  </span>
                </div>
                <h3 className="text-lg font-black text-slate-950">{cap.title}</h3>
                <p className="text-xs sm:text-sm text-slate-600 mt-2.5 leading-relaxed font-medium">
                  {cap.text}
                </p>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-100">
                <Link
                  to={cap.link}
                  className="text-xs font-black text-indigo-600 hover:text-indigo-800 transition flex items-center gap-1"
                >
                  {cap.cta}
                </Link>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};

export default Home;
