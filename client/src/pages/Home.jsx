import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api/axios';

const SPECIALTIES = [
  {
    name: 'Cardiologist',
    icon: '❤️',
    desc: 'Heart health, blood pressure, ECG & cardiovascular care',
    popular: true
  },
  {
    name: 'Dermatologist',
    icon: '🧴',
    desc: 'Skin care, acne, rashes, hair health & clinical dermatology',
    popular: true
  },
  {
    name: 'Dentist',
    icon: '🦷',
    desc: 'Teeth cleaning, root canal, oral surgery & orthodontics',
    popular: true
  },
  {
    name: 'Neurologist',
    icon: '🧠',
    desc: 'Migraines, neurological disorders, brain & nerve care',
    popular: false
  },
  {
    name: 'Pediatrician',
    icon: '👶',
    desc: 'Child healthcare, infant wellness, growth & vaccinations',
    popular: true
  },
  {
    name: 'Orthopedic',
    icon: '🦴',
    desc: 'Joints, bone fractures, knee pain & spine therapy',
    popular: true
  },
  {
    name: 'General Physician',
    icon: '🩺',
    desc: 'Primary medical care, seasonal fever, cough & viral health',
    popular: true
  },
  {
    name: 'ENT Specialist',
    icon: '👂',
    desc: 'Ear, nose, throat, sinusitis, tonsils & hearing diagnosis',
    popular: false
  }
];

const FAQS = [
  {
    q: 'How do I search and book an appointment on DocBook?',
    a: 'You can discover doctors by medical specialty, consultation fee, patient ratings, or clinic location right from the search bar. Once you find the right doctor, choose an available date and time slot, select either an in-person clinic visit or private HD video consultation, and confirm your booking instantly.'
  },
  {
    q: 'What is DocBook’s Smart Appointment Waitlist?',
    a: 'When all regular slots for a practitioner are booked, you can join our priority waitlist. If another patient cancels or reschedules, DocBook immediately notifies the first eligible patient in line with a 15-minute claim offer before releasing it to others.'
  },
  {
    q: 'How does the Live Clinic Digital Token work?',
    a: 'On the day of your in-person clinic visit, click "Check In" in your Patient Dashboard to generate your digital token (e.g., TK-004). You can view the currently serving patient, number of patients ahead of you, and dynamic wait times calculated from the doctor’s actual consultation progress today.'
  },
  {
    q: 'Can I consult with doctors online via video call?',
    a: 'Yes. DocBook provides private 1-on-1 WebRTC video consultations with live chat, eliminating the need to install third-party apps. Telehealth appointments can be booked directly from any doctor profile.'
  },
  {
    q: 'How do digital prescriptions work?',
    a: 'Following your consultation, your doctor issues a structured digital prescription with diagnosis, notes, and medication dosages. You can view it anytime in your dashboard and download it as an official PDF.'
  },
  {
    q: 'Is there any upfront booking fee or payment required?',
    a: 'DocBook does not charge any hidden booking or convenience fees. You can book your appointment online and settle the doctor’s consultation fee directly at the clinic counter or via secure payment.'
  }
];

const TESTIMONIALS = [
  {
    quote: "Booking Dr. Mehta took under two minutes. Getting a digital token before walking into the clinic saved me over 45 minutes in the waiting room!",
    patient: "Aarav Sharma",
    role: "Verified Patient",
    doctor: "Dr. Rajesh Mehta",
    specialty: "Cardiology",
    rating: 5
  },
  {
    quote: "When all slots were full, I joined the DocBook waitlist. An hour later a slot opened up, I claimed it within the 15-minute window, and saw the dermatologist the very same day.",
    patient: "Sneha Patel",
    role: "Verified Patient",
    doctor: "Dr. Ananya Rao",
    specialty: "Dermatology",
    rating: 5
  },
  {
    quote: "The video consultation was crystal clear, and my digital prescription PDF was ready for download right after the call. Excellent platform for healthcare.",
    patient: "Karan Singhania",
    role: "Verified Patient",
    doctor: "Dr. Vikram Joshi",
    specialty: "General Physician",
    rating: 5
  }
];

const Home = () => {
  const navigate = useNavigate();

  // Hero Search States
  const [heroSpecialty, setHeroSpecialty] = useState('');
  const [heroDoctorName, setHeroDoctorName] = useState('');
  const [heroLocation, setHeroLocation] = useState('');

  // Doctor Discovery Section States (Connected to GET /api/doctors)
  const [doctors, setDoctors] = useState([]);
  const [loadingDoctors, setLoadingDoctors] = useState(true);
  const [searchSpecialty, setSearchSpecialty] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [feeFilter, setFeeFilter] = useState(''); // '', '500', '1000', '1001'
  const [experienceFilter, setExperienceFilter] = useState(''); // '', '3', '5', '10'
  const [ratingFilter, setRatingFilter] = useState(''); // '', '4', '4.5'
  const [availabilityFilter, setAvailabilityFilter] = useState(''); // '', 'today', 'tomorrow'
  const [sortFilter, setSortFilter] = useState('recommended'); // 'recommended', 'fee_asc', 'fee_desc', 'experience_desc', 'rating_desc'

  // FAQ Accordion State
  const [openFaqIndex, setOpenFaqIndex] = useState(null);

  // Fetch doctors from backend API
  const fetchDoctors = useCallback(async () => {
    setLoadingDoctors(true);
    try {
      const params = new URLSearchParams();
      if (searchSpecialty && searchSpecialty !== 'All Specialties') {
        params.append('specialty', searchSpecialty);
      }
      if (experienceFilter) {
        params.append('min_experience', experienceFilter);
      }
      if (ratingFilter) {
        params.append('min_rating', ratingFilter);
      }
      if (availabilityFilter) {
        params.append('available', availabilityFilter);
      }
      if (feeFilter === '500') {
        params.append('max_fee', '500');
      } else if (feeFilter === '1000') {
        params.append('min_fee', '500');
        params.append('max_fee', '1000');
      } else if (feeFilter === '1001') {
        params.append('min_fee', '1000');
      }
      if (sortFilter && sortFilter !== 'recommended') {
        params.append('sort', sortFilter);
      }

      const res = await api.get(`/doctors?${params.toString()}`);
      let list = res.data || [];

      // Filter by text query on client side for name/location matching
      if (searchQuery && searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        list = list.filter(d => 
          (d.name && d.name.toLowerCase().includes(q)) ||
          (d.specialty && d.specialty.toLowerCase().includes(q))
        );
      }

      setDoctors(list);
    } catch (err) {
      console.error('Failed to fetch doctors on landing page:', err);
    } finally {
      setLoadingDoctors(false);
    }
  }, [searchSpecialty, searchQuery, feeFilter, experienceFilter, ratingFilter, availabilityFilter, sortFilter]);

  useEffect(() => {
    fetchDoctors();
  }, [fetchDoctors]);

  // Handle smooth scroll from hash or CTAs
  const scrollToSection = (id) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  // Hero Search Submit
  const handleHeroSearch = (e) => {
    e.preventDefault();
    if (heroSpecialty) setSearchSpecialty(heroSpecialty);
    if (heroDoctorName) setSearchQuery(heroDoctorName);
    scrollToSection('doctor-search');
  };

  // Quick Specialty Click
  const handleSpecialtyClick = (specialtyName) => {
    setSearchSpecialty(specialtyName);
    scrollToSection('doctor-search');
  };

  const handleResetFilters = () => {
    setSearchSpecialty('');
    setSearchQuery('');
    setFeeFilter('');
    setExperienceFilter('');
    setRatingFilter('');
    setAvailabilityFilter('');
    setSortFilter('recommended');
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-indigo-500 selection:text-white">

      {/* 1. HERO SECTION (Split-Layout) */}
      <section className="relative overflow-hidden bg-gradient-to-b from-blue-50/70 via-indigo-50/30 to-white pt-10 pb-16 lg:pt-16 lg:pb-24 border-b border-slate-200/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-12 gap-12 lg:gap-8 items-center">

            {/* Left Column: Heading, Subtitle & Prominent Search */}
            <div className="lg:col-span-7 space-y-6">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-indigo-50 border border-indigo-200/80 text-indigo-700 text-xs font-bold shadow-sm">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                <span>Trusted Healthcare Booking & Live Queue Platform</span>
              </div>

              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-slate-950 tracking-tight leading-[1.12]">
                Better Healthcare Starts With the{' '}
                <span className="bg-gradient-to-r from-blue-600 via-indigo-600 to-emerald-600 bg-clip-text text-transparent">
                  Right Doctor.
                </span>
              </h1>

              <p className="text-base sm:text-lg text-slate-600 font-medium max-w-2xl leading-relaxed">
                DocBook helps you discover top verified specialists, compare consultation fees and patient reviews, book convenient clinic or video slots, and eliminate waiting-room delays with live digital queue tokens.
              </p>

              {/* Prominent Doctor Search Card */}
              <div className="bg-white rounded-2xl shadow-xl border border-slate-200/90 p-5 sm:p-6 transition hover:shadow-2xl">
                <form onSubmit={handleHeroSearch} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {/* Specialty Selector */}
                    <div>
                      <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500 mb-1.5">
                        Medical Specialty
                      </label>
                      <div className="relative">
                        <select
                          value={heroSpecialty}
                          onChange={(e) => setHeroSpecialty(e.target.value)}
                          className="w-full text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl px-3 py-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        >
                          <option value="">All Specialties</option>
                          {SPECIALTIES.map(s => (
                            <option key={s.name} value={s.name}>{s.icon} {s.name}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Doctor Name Search */}
                    <div>
                      <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500 mb-1.5">
                        Doctor Name
                      </label>
                      <div className="relative">
                        <input
                          type="text"
                          value={heroDoctorName}
                          onChange={(e) => setHeroDoctorName(e.target.value)}
                          placeholder="e.g. Dr. Mehta"
                          className="w-full text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl px-3 py-3 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                    </div>

                    {/* Location Input */}
                    <div>
                      <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500 mb-1.5">
                        Clinic Location
                      </label>
                      <div className="relative">
                        <input
                          type="text"
                          value={heroLocation}
                          onChange={(e) => setHeroLocation(e.target.value)}
                          placeholder="City or In-Person / Video"
                          className="w-full text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl px-3 py-3 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Hero Actions */}
                  <div className="flex flex-col sm:flex-row gap-3 pt-1">
                    <button
                      type="submit"
                      className="flex-1 py-3.5 px-6 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-sm rounded-xl shadow-md hover:shadow-lg transition duration-200 flex items-center justify-center gap-2 cursor-pointer active:scale-98"
                    >
                      <span>🔍 Find a Doctor</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => scrollToSection('how-it-works')}
                      className="py-3.5 px-6 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-sm rounded-xl transition duration-200 cursor-pointer"
                    >
                      How It Works ↓
                    </button>
                  </div>
                </form>
              </div>

              {/* Verified Trust Indicators */}
              <div className="pt-2 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs font-bold text-slate-500">
                <span className="flex items-center gap-1.5">
                  <span className="text-emerald-500 font-black">✓</span> 100% Verified Clinicians
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="text-indigo-500 font-black">✓</span> Live Digital Queue Tokens
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="text-emerald-500 font-black">✓</span> Zero Booking Fees
                </span>
              </div>
            </div>

            {/* Right Column: Authentic Healthcare Photography & Confirmation Interface */}
            <div className="lg:col-span-5 relative">
              <div className="relative mx-auto max-w-md lg:max-w-none">

                {/* Main Authentic Healthcare Photo */}
                <div className="relative rounded-3xl overflow-hidden shadow-2xl border-4 border-white aspect-[4/4.5] bg-slate-100">
                  <img
                    src="https://images.unsplash.com/photo-1622253692010-333f2da6031d?auto=format&fit=crop&w=800&q=80"
                    alt="Authentic compassionate doctor consulting with patient in modern clinic"
                    className="w-full h-full object-cover object-top"
                    onError={(e) => {
                      // Graceful fallback to medical doctor portrait
                      e.target.src = "https://images.unsplash.com/photo-1594824813587-f27ac210816a?auto=format&fit=crop&w=800&q=80";
                    }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/60 via-transparent to-transparent"></div>
                  
                  {/* Subtle Badge on Photo */}
                  <div className="absolute bottom-4 left-4 right-4 text-white text-xs font-semibold backdrop-blur-md bg-slate-950/40 p-3 rounded-xl border border-white/20">
                    <p className="font-black text-sm text-white">Dedicated Clinical Care</p>
                    <p className="text-[11px] text-slate-200 mt-0.5">Physical clinic check-ups & encrypted 1-on-1 telehealth</p>
                  </div>
                </div>

                {/* Subtle Appointment Confirmation Interface Card (Floating Overlay) */}
                <div className="absolute -bottom-6 -left-4 sm:-left-6 bg-white/95 backdrop-blur-md rounded-2xl p-4 sm:p-5 shadow-2xl border border-slate-200/90 max-w-xs transition transform hover:scale-102">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500 text-white flex items-center justify-center font-black text-lg shadow-md shrink-0">
                      ✓
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-black uppercase tracking-wider text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                          Confirmed
                        </span>
                        <span className="text-[10px] font-mono font-bold text-slate-400">Token #TK-004</span>
                      </div>
                      <h4 className="text-xs font-black text-slate-900 mt-1">Dr. Rajesh Mehta</h4>
                      <p className="text-[11px] font-semibold text-indigo-600">Cardiology Specialist</p>
                      <p className="text-[10px] text-slate-500 mt-1 flex items-center gap-1 font-medium">
                        <span>🕒</span> Today at 04:30 PM • Slot Locked
                      </p>
                    </div>
                  </div>
                </div>

                {/* Verified Trust Badge (Top-Right Floating Tag) */}
                <div className="absolute -top-4 -right-2 sm:-right-4 bg-slate-950 text-white rounded-2xl px-4 py-2.5 shadow-xl border border-indigo-900/40 flex items-center gap-2.5">
                  <span className="text-xl">🩺</span>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-wider text-indigo-300">Platform Guarantee</p>
                    <p className="text-xs font-black">Zero Double Bookings</p>
                  </div>
                </div>

              </div>
            </div>

          </div>
        </div>
      </section>

      {/* 2. MEDICAL SPECIALTIES SECTION */}
      <section id="specialties" className="py-16 bg-white border-b border-slate-200/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-10 gap-4">
            <div>
              <span className="text-xs font-black uppercase tracking-widest text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full border border-indigo-100">
                Specialized Medical Care
              </span>
              <h2 className="text-3xl font-black text-slate-950 tracking-tight mt-2.5">
                Browse by Medical Specialty
              </h2>
              <p className="text-sm text-slate-600 mt-1 font-medium">
                Consult with verified clinicians across all primary clinical disciplines.
              </p>
            </div>
            <button
              onClick={() => {
                setSearchSpecialty('');
                scrollToSection('doctor-search');
              }}
              className="text-xs font-bold text-indigo-600 hover:text-indigo-800 transition cursor-pointer self-start sm:self-center"
            >
              View All Doctors →
            </button>
          </div>

          {/* Specialties Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-4 gap-4">
            {SPECIALTIES.map((spec) => (
              <div
                key={spec.name}
                onClick={() => handleSpecialtyClick(spec.name)}
                className="group p-5 rounded-2xl bg-slate-50 hover:bg-indigo-50/50 border border-slate-200/80 hover:border-indigo-300 transition-all duration-200 cursor-pointer shadow-xs hover:shadow-md flex flex-col justify-between"
              >
                <div>
                  <div className="w-12 h-12 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-2xl shadow-xs group-hover:scale-110 transition-transform">
                    {spec.icon}
                  </div>
                  <h3 className="font-black text-slate-900 text-sm mt-3.5 group-hover:text-indigo-600 transition">
                    {spec.name}
                  </h3>
                  <p className="text-xs text-slate-500 font-medium mt-1 leading-relaxed line-clamp-2">
                    {spec.desc}
                  </p>
                </div>
                <div className="mt-4 flex items-center justify-between text-[11px] font-bold text-indigo-600 opacity-80 group-hover:opacity-100">
                  <span>Explore Specialists</span>
                  <span className="group-hover:translate-x-1 transition-transform">→</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 3. FUNCTIONAL DOCTOR SEARCH & DISCOVERY SECTION */}
      <section id="doctor-search" className="py-16 bg-slate-50/70 border-b border-slate-200/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 gap-4">
            <div>
              <span className="text-xs font-black uppercase tracking-widest text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full border border-indigo-100">
                Verified Doctor Directory
              </span>
              <h2 className="text-3xl font-black text-slate-950 tracking-tight mt-2.5">
                Find Your Specialist Doctor
              </h2>
              <p className="text-sm text-slate-600 mt-1 font-medium">
                Live search connected directly to verified clinic schedules, consultation fees, and patient ratings.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <label htmlFor="landing-sort" className="text-xs font-bold text-slate-500">Sort by:</label>
              <select
                id="landing-sort"
                value={sortFilter}
                onChange={(e) => setSortFilter(e.target.value)}
                className="text-xs font-bold bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500 shadow-xs"
              >
                <option value="recommended">Recommended (Next Available)</option>
                <option value="fee_asc">Fee: Low to High</option>
                <option value="fee_desc">Fee: High to Low</option>
                <option value="experience_desc">Experience: Highest First</option>
                <option value="rating_desc">Rating: Highest Rated</option>
              </select>
            </div>
          </div>

          {/* Filter Bar Card */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-sm mb-8 space-y-4">
            {/* Row 1: Search Query + Specialty Dropdown */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500 mb-1">
                  Search by Doctor Name or Condition
                </label>
                <input
                  type="text"
                  placeholder="e.g. Dr. Mehta, cardiology, skin rash..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500 mb-1">
                  Specialty Filter
                </label>
                <select
                  value={searchSpecialty}
                  onChange={(e) => setSearchSpecialty(e.target.value)}
                  className="w-full text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="">All Specialties</option>
                  {SPECIALTIES.map(s => (
                    <option key={s.name} value={s.name}>{s.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Row 2: Fee, Experience, Availability, Rating Filters */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-slate-100">
              {/* Fee Filter */}
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">Consultation Fee</label>
                <select
                  value={feeFilter}
                  onChange={(e) => setFeeFilter(e.target.value)}
                  className="w-full text-xs font-semibold bg-slate-50 border border-slate-200 rounded-lg p-2 text-slate-800"
                >
                  <option value="">Any Fee</option>
                  <option value="500">Under ₹500</option>
                  <option value="1000">₹500 - ₹1,000</option>
                  <option value="1001">₹1,000+</option>
                </select>
              </div>

              {/* Experience Filter */}
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">Experience</label>
                <select
                  value={experienceFilter}
                  onChange={(e) => setExperienceFilter(e.target.value)}
                  className="w-full text-xs font-semibold bg-slate-50 border border-slate-200 rounded-lg p-2 text-slate-800"
                >
                  <option value="">Any Experience</option>
                  <option value="3">3+ Years</option>
                  <option value="5">5+ Years</option>
                  <option value="10">10+ Years</option>
                </select>
              </div>

              {/* Rating Filter */}
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">Patient Rating</label>
                <select
                  value={ratingFilter}
                  onChange={(e) => setRatingFilter(e.target.value)}
                  className="w-full text-xs font-semibold bg-slate-50 border border-slate-200 rounded-lg p-2 text-slate-800"
                >
                  <option value="">All Ratings</option>
                  <option value="4">⭐ 4.0+ Stars</option>
                  <option value="4.5">⭐ 4.5+ Stars</option>
                </select>
              </div>

              {/* Availability Filter */}
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">Slot Availability</label>
                <select
                  value={availabilityFilter}
                  onChange={(e) => setAvailabilityFilter(e.target.value)}
                  className="w-full text-xs font-semibold bg-slate-50 border border-slate-200 rounded-lg p-2 text-slate-800"
                >
                  <option value="">All Clinicians</option>
                  <option value="today">⚡ Available Today</option>
                  <option value="tomorrow">📅 Available Tomorrow</option>
                </select>
              </div>
            </div>

            {/* Active Filters Reset */}
            {(searchSpecialty || searchQuery || feeFilter || experienceFilter || ratingFilter || availabilityFilter || sortFilter !== 'recommended') && (
              <div className="pt-2 flex justify-between items-center text-xs">
                <span className="text-slate-500 font-bold">Filtered results active</span>
                <button
                  onClick={handleResetFilters}
                  className="text-rose-600 hover:text-rose-700 font-bold cursor-pointer"
                >
                  Reset All Filters ✕
                </button>
              </div>
            )}
          </div>

          {/* Results Grid */}
          {loadingDoctors ? (
            <div className="text-center py-20 bg-white rounded-2xl border border-slate-200">
              <svg className="animate-spin h-8 w-8 text-indigo-600 mx-auto" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <p className="text-slate-500 font-bold mt-3 text-xs">Searching verified doctors...</p>
            </div>
          ) : doctors.length === 0 ? (
            <div className="text-center py-16 px-4 bg-white rounded-2xl border border-dashed border-slate-300">
              <span className="text-3xl">🩺</span>
              <h3 className="text-base font-black text-slate-900 mt-2">No doctors match your search filters</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                Try widening your fee range or selecting a different medical specialty.
              </p>
              <button
                onClick={handleResetFilters}
                className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-700 transition"
              >
                Clear Filters
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {doctors.slice(0, 6).map((doc) => {
                const hasSlotsToday = Number(doc.today_slots_count) > 0;
                const hasSlotsTomorrow = Number(doc.tomorrow_slots_count) > 0;
                const avgRating = parseFloat(doc.average_rating || 0);
                const totalReviews = parseInt(doc.total_reviews || 0, 10);

                return (
                  <div
                    key={doc.id}
                    className="bg-white rounded-2xl border border-slate-200/90 shadow-sm hover:shadow-lg hover:-translate-y-1 transition duration-200 p-6 flex flex-col justify-between"
                  >
                    <div>
                      {/* Top Bar: Avatar & Verification */}
                      <div className="flex items-start justify-between gap-3 mb-4">
                        <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-indigo-600 to-blue-500 text-white font-black text-xl flex items-center justify-center shadow-md">
                          {doc.name ? doc.name.charAt(0) : 'D'}
                        </div>

                        <div className="flex flex-col items-end gap-1">
                          <span className="text-[10px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-md flex items-center gap-1">
                            <span>✓</span> Verified Doctor
                          </span>

                          {totalReviews > 0 ? (
                            <div className="flex items-center gap-1 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded text-[11px] font-black text-amber-800">
                              <span>⭐</span>
                              <span>{avgRating.toFixed(1)}</span>
                              <span className="text-amber-600 font-bold">({totalReviews})</span>
                            </div>
                          ) : (
                            <span className="text-[10px] font-bold text-slate-400 bg-slate-50 px-2 py-0.5 rounded border border-slate-200">
                              Certified Doctor
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Doctor Info */}
                      <h3 className="text-lg font-black text-slate-900">Dr. {doc.name}</h3>
                      <p className="text-xs font-bold text-indigo-600 uppercase tracking-wider mt-0.5">
                        {doc.specialty || 'General Practitioner'}
                      </p>

                      {/* Attributes */}
                      <div className="mt-4 space-y-1.5 bg-slate-50 p-3 rounded-xl border border-slate-100 text-xs font-bold text-slate-600">
                        <div className="flex justify-between">
                          <span className="text-slate-400 font-medium">Experience:</span>
                          <span className="text-slate-900">{doc.experience || 0} Years</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400 font-medium">Consultation Fee:</span>
                          <span className="text-emerald-700 font-black">₹{doc.fees || 0}</span>
                        </div>
                      </div>

                      {/* Availability Pill */}
                      <div className="mt-3">
                        {hasSlotsToday ? (
                          <div className="text-[11px] font-black text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg text-center flex items-center justify-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                            Available Today ({doc.today_slots_count} slots)
                          </div>
                        ) : hasSlotsTomorrow ? (
                          <div className="text-[11px] font-black text-blue-700 bg-blue-50 border border-blue-200 px-2.5 py-1 rounded-lg text-center">
                            📅 Available Tomorrow ({doc.tomorrow_slots_count} slots)
                          </div>
                        ) : doc.next_available_date ? (
                          <div className="text-[11px] font-semibold text-slate-600 bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-lg text-center">
                            Next Open: {new Date(doc.next_available_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                          </div>
                        ) : (
                          <div className="text-[11px] font-bold text-amber-800 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-lg text-center">
                            Priority Waitlist Available 📋
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Book CTA */}
                    <div className="mt-5 pt-3 border-t border-slate-100">
                      <Link
                        to={`/book/${doc.id}`}
                        className="w-full block text-center py-2.5 bg-slate-950 hover:bg-indigo-600 text-white font-bold text-xs rounded-xl shadow-xs hover:shadow transition duration-200 active:scale-98"
                      >
                        Book Appointment →
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* View Complete Directory Link */}
          <div className="mt-10 text-center">
            <Link
              to="/doctors"
              className="inline-flex items-center gap-2 px-6 py-3 bg-white border border-slate-300 hover:border-indigo-400 text-slate-800 font-bold text-xs sm:text-sm rounded-xl shadow-sm hover:shadow transition"
            >
              <span>Explore Full Specialist Network ({doctors.length}+ Doctors)</span>
              <span>→</span>
            </Link>
          </div>

        </div>
      </section>

      {/* 4. HOW DOCBOOK WORKS SECTION */}
      <section id="how-it-works" className="py-20 bg-white border-b border-slate-200/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <span className="text-xs font-black uppercase tracking-widest text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full border border-indigo-100">
              Simple 3-Step Process
            </span>
            <h2 className="text-3xl sm:text-4xl font-black text-slate-950 tracking-tight mt-3">
              How DocBook Works
            </h2>
            <p className="text-slate-600 text-sm sm:text-base mt-2 font-medium">
              We make clinical appointments stress-free from practitioner discovery to your final prescription.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 relative">
            {/* Step 1 */}
            <div className="bg-slate-50 rounded-2xl p-8 border border-slate-200/80 relative hover:shadow-md transition">
              <div className="w-14 h-14 rounded-2xl bg-indigo-600 text-white font-black text-xl flex items-center justify-center shadow-md mb-6">
                01
              </div>
              <h3 className="text-xl font-black text-slate-900 mb-2">
                Discover the Right Doctor
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 font-medium leading-relaxed">
                Filter verified specialists by clinical discipline, transparent consultation fees, authentic patient ratings, and next available dates.
              </p>
            </div>

            {/* Step 2 */}
            <div className="bg-slate-50 rounded-2xl p-8 border border-slate-200/80 relative hover:shadow-md transition">
              <div className="w-14 h-14 rounded-2xl bg-blue-600 text-white font-black text-xl flex items-center justify-center shadow-md mb-6">
                02
              </div>
              <h3 className="text-xl font-black text-slate-900 mb-2">
                Choose a Suitable Appointment
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 font-medium leading-relaxed">
                Pick an in-person clinic visit or a telehealth video call. Our atomic database row-locking guarantees no double-bookings, with smart waitlists if full.
              </p>
            </div>

            {/* Step 3 */}
            <div className="bg-slate-50 rounded-2xl p-8 border border-slate-200/80 relative hover:shadow-md transition">
              <div className="w-14 h-14 rounded-2xl bg-emerald-600 text-white font-black text-xl flex items-center justify-center shadow-md mb-6">
                03
              </div>
              <h3 className="text-xl font-black text-slate-900 mb-2">
                Consult & Manage Your Healthcare
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 font-medium leading-relaxed">
                Arrive and check in for a live digital queue token with rolling wait-time estimates, or enter your encrypted video room and download your prescription PDF.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 5. FEATURED DOCTORS EDITORIAL SECTION */}
      <section id="featured-doctors" className="py-20 bg-slate-50/70 border-b border-slate-200/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-12 gap-4">
            <div>
              <span className="text-xs font-black uppercase tracking-widest text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full border border-indigo-100">
                Top Rated Clinicians
              </span>
              <h2 className="text-3xl font-black text-slate-950 tracking-tight mt-2.5">
                Featured Medical Specialists
              </h2>
              <p className="text-sm text-slate-600 mt-1 font-medium">
                Verified physicians with high patient satisfaction ratings and open consultation slots.
              </p>
            </div>

            <Link
              to="/doctors"
              className="text-xs font-bold text-indigo-600 hover:text-indigo-800 transition self-start sm:self-center"
            >
              Browse All Specialists →
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {doctors.slice(0, 3).map((doc, idx) => (
              <div
                key={doc.id || idx}
                className="bg-white rounded-3xl border border-slate-200/90 shadow-sm hover:shadow-xl transition-all duration-300 p-6 flex flex-col justify-between"
              >
                <div>
                  {/* Doctor Profile Header */}
                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-indigo-600 to-blue-500 text-white font-black text-2xl flex items-center justify-center shadow-md shrink-0">
                      {doc.name ? doc.name.charAt(0) : 'D'}
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-black uppercase bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded">
                          Verified
                        </span>
                        <span className="text-[11px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                          ⭐ {parseFloat(doc.average_rating || 5).toFixed(1)}
                        </span>
                      </div>
                      <h3 className="text-lg font-black text-slate-900 mt-1">Dr. {doc.name}</h3>
                      <p className="text-xs font-bold text-indigo-600 uppercase tracking-wide">
                        {doc.specialty || 'General Practitioner'}
                      </p>
                    </div>
                  </div>

                  {/* Highlights Grid */}
                  <div className="grid grid-cols-2 gap-2 bg-slate-50 p-3.5 rounded-2xl border border-slate-100 text-xs font-bold mb-4">
                    <div>
                      <span className="text-[10px] text-slate-400 font-medium block">Experience</span>
                      <span className="text-slate-900 font-black">{doc.experience || 0} Years</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 font-medium block">Consultation Fee</span>
                      <span className="text-emerald-700 font-black">₹{doc.fees || 0}</span>
                    </div>
                  </div>

                  <p className="text-xs text-slate-500 font-medium leading-relaxed">
                    Verified clinical practitioner specializing in {doc.specialty || 'primary medicine'} with confirmed attendance records and digital prescription issuance.
                  </p>
                </div>

                <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between gap-3">
                  <div className="text-[11px] font-bold text-slate-600">
                    <span>🕒 Next: </span>
                    <strong className="text-indigo-600">
                      {doc.today_slots_count > 0 ? 'Today' : 'Upcoming'}
                    </strong>
                  </div>
                  <Link
                    to={`/book/${doc.id}`}
                    className="px-4 py-2 bg-indigo-950 hover:bg-slate-900 text-white font-bold text-xs rounded-xl shadow-xs transition"
                  >
                    View Profile & Book →
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 6. WHY CHOOSE DOCBOOK? SECTION */}
      <section id="why-choose-us" className="py-20 bg-white border-b border-slate-200/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <span className="text-xs font-black uppercase tracking-widest text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full border border-indigo-100">
              Modern Clinical Care
            </span>
            <h2 className="text-3xl sm:text-4xl font-black text-slate-950 tracking-tight mt-3">
              Why Patients & Clinicians Choose DocBook
            </h2>
            <p className="text-slate-600 text-sm sm:text-base mt-2 font-medium">
              Built from the ground up to solve appointment double-booking, long waiting queues, and scattered health records.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Feature 1: Video Consultations */}
            <div className="bg-slate-50 rounded-2xl p-6 border border-slate-200/80 hover:shadow-md transition">
              <div className="w-12 h-12 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center text-2xl mb-4">
                📹
              </div>
              <h3 className="text-base font-black text-slate-900 mb-1.5">
                HD Video Consultations
              </h3>
              <p className="text-xs text-slate-600 font-medium leading-relaxed">
                Private, encrypted 1-on-1 WebRTC telemedicine calls with real-time consultation chat directly in your browser.
              </p>
            </div>

            {/* Feature 2: Digital Prescriptions */}
            <div className="bg-slate-50 rounded-2xl p-6 border border-slate-200/80 hover:shadow-md transition">
              <div className="w-12 h-12 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center text-2xl mb-4">
                💊
              </div>
              <h3 className="text-base font-black text-slate-900 mb-1.5">
                Official Digital Prescriptions
              </h3>
              <p className="text-xs text-slate-600 font-medium leading-relaxed">
                Structured clinical diagnoses, medication dosages, and directions with instant high-resolution PDF download.
              </p>
            </div>

            {/* Feature 3: Patient Health Records */}
            <div className="bg-slate-50 rounded-2xl p-6 border border-slate-200/80 hover:shadow-md transition">
              <div className="w-12 h-12 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center text-2xl mb-4">
                ❤️
              </div>
              <h3 className="text-base font-black text-slate-900 mb-1.5">
                Patient Health Records
              </h3>
              <p className="text-xs text-slate-600 font-medium leading-relaxed">
                Store vital metrics, blood group, BMI calculation, and drug allergies for immediate doctor clinical review.
              </p>
            </div>

            {/* Feature 4: Live Clinic Coordination & Waitlist */}
            <div className="bg-slate-50 rounded-2xl p-6 border border-slate-200/80 hover:shadow-md transition">
              <div className="w-12 h-12 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center text-2xl mb-4">
                🎫
              </div>
              <h3 className="text-base font-black text-slate-900 mb-1.5">
                Live Tokens & Waitlists
              </h3>
              <p className="text-xs text-slate-600 font-medium leading-relaxed">
                Check in for digital tokens with dynamic queue pace estimation and automated 15-minute cancellation claim offers.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 7. REAL PATIENT TESTIMONIALS SECTION */}
      <section id="testimonials" className="py-20 bg-slate-50/70 border-b border-slate-200/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <span className="text-xs font-black uppercase tracking-widest text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full border border-indigo-100">
              Verified Patient Stories
            </span>
            <h2 className="text-3xl sm:text-4xl font-black text-slate-950 tracking-tight mt-3">
              Trusted by Thousands of Patients
            </h2>
            <p className="text-slate-600 text-sm sm:text-base mt-2 font-medium">
              Authentic reviews submitted by verified patients following completed consultations.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {TESTIMONIALS.map((t, idx) => (
              <div
                key={idx}
                className="bg-white rounded-3xl p-7 border border-slate-200/90 shadow-sm flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center gap-1 text-amber-400 text-sm mb-4">
                    {'★'.repeat(t.rating)}
                  </div>
                  <p className="text-slate-700 text-xs sm:text-sm font-medium leading-relaxed italic">
                    "{t.quote}"
                  </p>
                </div>

                <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-black text-slate-900">{t.patient}</h4>
                    <span className="text-[10px] font-bold text-emerald-600">{t.role}</span>
                  </div>
                  <div className="text-right">
                    <p className="text-[11px] font-bold text-indigo-600">{t.doctor}</p>
                    <p className="text-[10px] text-slate-400">{t.specialty}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 8. INTERACTIVE FAQ SECTION */}
      <section id="faq" className="py-20 bg-white border-b border-slate-200/80">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <span className="text-xs font-black uppercase tracking-widest text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full border border-indigo-100">
              Answers & Help
            </span>
            <h2 className="text-3xl sm:text-4xl font-black text-slate-950 tracking-tight mt-3">
              Frequently Asked Questions
            </h2>
            <p className="text-slate-600 text-sm mt-2 font-medium">
              Everything you need to know about booking, digital tokens, and consultations.
            </p>
          </div>

          <div className="space-y-3">
            {FAQS.map((faq, idx) => {
              const isOpen = openFaqIndex === idx;

              return (
                <div
                  key={idx}
                  className="rounded-2xl border border-slate-200 overflow-hidden transition"
                >
                  <button
                    type="button"
                    onClick={() => setOpenFaqIndex(isOpen ? null : idx)}
                    className="w-full py-4 px-6 text-left flex justify-between items-center gap-4 bg-slate-50/70 hover:bg-slate-100/60 transition cursor-pointer"
                  >
                    <span className="font-black text-slate-900 text-sm sm:text-base">
                      {faq.q}
                    </span>
                    <span className="text-indigo-600 font-black text-lg shrink-0">
                      {isOpen ? '−' : '+'}
                    </span>
                  </button>

                  {isOpen && (
                    <div className="px-6 py-4 bg-white text-xs sm:text-sm text-slate-600 font-medium leading-relaxed border-t border-slate-100">
                      {faq.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* 9. PROFESSIONAL FOOTER */}
      <footer id="contact" className="bg-slate-950 text-white pt-16 pb-12 border-t border-slate-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-10 pb-12 border-b border-slate-800">

            {/* Brand Info */}
            <div className="lg:col-span-2 space-y-4">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-emerald-500 flex items-center justify-center text-white font-black text-lg shadow-md">
                  ✚
                </div>
                <span className="text-2xl font-black text-white tracking-tight">
                  DocBook<span className="text-indigo-400 font-medium">.care</span>
                </span>
              </div>
              <p className="text-xs text-slate-400 font-medium max-w-sm leading-relaxed">
                DocBook is an intelligent healthcare appointment management and live clinic coordination platform. Discover verified practitioners, reserve guaranteed slots, and track real-time queue progress.
              </p>
              <div className="pt-2 text-xs text-slate-400 space-y-1">
                <p>📍 DocBook Health Network, Central Medical District</p>
                <p>✉️ Support: <a href="mailto:care@docbook.health" className="text-indigo-400 hover:underline">care@docbook.health</a></p>
                <p>📞 Helpline: +91 (022) 8000-DOCS (Mon-Sat, 8am-8pm)</p>
              </div>
            </div>

            {/* Quick Links */}
            <div>
              <h4 className="text-xs font-black uppercase tracking-wider text-indigo-300 mb-4">
                Platform Navigation
              </h4>
              <ul className="space-y-2.5 text-xs text-slate-400 font-medium">
                <li><Link to="/" className="hover:text-white transition">Home</Link></li>
                <li><Link to="/doctors" className="hover:text-white transition">Find Doctors</Link></li>
                <li><button onClick={() => scrollToSection('how-it-works')} className="hover:text-white transition cursor-pointer">How It Works</button></li>
                <li><button onClick={() => scrollToSection('specialties')} className="hover:text-white transition cursor-pointer">Medical Specialties</button></li>
                <li><Link to="/dashboard" className="hover:text-white transition">Patient Dashboard</Link></li>
                <li><Link to="/register" className="hover:text-white transition">Doctor Registration</Link></li>
              </ul>
            </div>

            {/* Specialties */}
            <div>
              <h4 className="text-xs font-black uppercase tracking-wider text-indigo-300 mb-4">
                Clinical Disciplines
              </h4>
              <ul className="space-y-2.5 text-xs text-slate-400 font-medium">
                <li><button onClick={() => handleSpecialtyClick('Cardiologist')} className="hover:text-white transition cursor-pointer">Cardiology</button></li>
                <li><button onClick={() => handleSpecialtyClick('Dermatologist')} className="hover:text-white transition cursor-pointer">Dermatology</button></li>
                <li><button onClick={() => handleSpecialtyClick('Dentist')} className="hover:text-white transition cursor-pointer">Dentistry</button></li>
                <li><button onClick={() => handleSpecialtyClick('Neurologist')} className="hover:text-white transition cursor-pointer">Neurology</button></li>
                <li><button onClick={() => handleSpecialtyClick('Pediatrician')} className="hover:text-white transition cursor-pointer">Pediatrics</button></li>
                <li><button onClick={() => handleSpecialtyClick('Orthopedic')} className="hover:text-white transition cursor-pointer">Orthopedics</button></li>
                <li><button onClick={() => handleSpecialtyClick('General Physician')} className="hover:text-white transition cursor-pointer">General Medicine</button></li>
              </ul>
            </div>

            {/* Trust & Certifications */}
            <div>
              <h4 className="text-xs font-black uppercase tracking-wider text-indigo-300 mb-4">
                Trust & Security
              </h4>
              <div className="space-y-2.5 text-xs text-slate-400 font-medium">
                <p className="flex items-center gap-1.5 text-slate-300">
                  <span className="text-emerald-400">✓</span> Verified Medical Specialists
                </p>
                <p className="flex items-center gap-1.5 text-slate-300">
                  <span className="text-emerald-400">✓</span> 256-Bit SSL Data Encryption
                </p>
                <p className="flex items-center gap-1.5 text-slate-300">
                  <span className="text-emerald-400">✓</span> Atomic Transaction Safe
                </p>
                <p className="flex items-center gap-1.5 text-slate-300">
                  <span className="text-emerald-400">✓</span> Zero Booking Fees
                </p>
              </div>
            </div>

          </div>

          {/* Medical Emergency Disclaimer */}
          <div className="py-6 border-b border-slate-900 text-[11px] text-slate-500 font-medium leading-relaxed">
            <strong className="text-slate-400">Important Medical Disclaimer:</strong> DocBook is an appointment scheduling and healthcare coordination software platform. DocBook does not provide medical advice, diagnosis, or direct medical treatment. In the event of a medical emergency, please dial 108 or proceed immediately to the nearest hospital casualty department.
          </div>

          {/* Bottom Copyright */}
          <div className="pt-6 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 font-medium gap-3">
            <p>© {new Date().getFullYear()} DocBook.care. All rights reserved.</p>
            <div className="flex items-center space-x-6">
              <span className="hover:text-slate-400 transition cursor-pointer">Privacy Policy</span>
              <span className="hover:text-slate-400 transition cursor-pointer">Terms of Service</span>
              <span className="hover:text-slate-400 transition cursor-pointer">HIPAA & Security</span>
            </div>
          </div>

        </div>
      </footer>

    </div>
  );
};

export default Home;
