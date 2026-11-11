import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/axios';
import { toast } from 'react-toastify';

const SPECIALTIES = [
  'All Specialties',
  'Cardiologist',
  'Dermatologist',
  'Neurologist',
  'General Physician',
  'Pediatrician',
  'Orthopedic',
  'Gynecologist',
  'Psychiatrist',
  'ENT Specialist'
];

const SYMPTOM_PRESETS = [
  { label: '❤️ Chest Pain / Palpitation', symptom: 'chest pain' },
  { label: '🧴 Skin Rash & Acne', symptom: 'skin rash' },
  { label: '🦴 Back & Joint Pain', symptom: 'back pain' },
  { label: '🌡️ Fever, Cold & Cough', symptom: 'fever cough' },
  { label: '🧠 Migraine & Dizziness', symptom: 'headache dizziness' },
  { label: '👶 Child Illness', symptom: 'child fever' },
  { label: '🧘 Anxiety & Stress', symptom: 'anxiety stress' }
];

const DoctorList = () => {
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);

  // Smart Matching State
  const [showSmartMatcher, setShowSmartMatcher] = useState(true);
  const [isSmartMatchActive, setIsSmartMatchActive] = useState(false);
  const [matchingMeta, setMatchingMeta] = useState(null);
  const [symptomsInput, setSymptomsInput] = useState('');
  const [smartSpecialty, setSmartSpecialty] = useState('');
  const [smartBudget, setSmartBudget] = useState('1000');
  const [smartUrgency, setSmartUrgency] = useState('any');
  const [smartMode, setSmartMode] = useState('any');
  const [matchingLoading, setMatchingLoading] = useState(false);
  const [expandedReasonDocId, setExpandedReasonDocId] = useState(null);

  // Standard Filter States
  const [specialty, setSpecialty] = useState('');
  const [minFee, setMinFee] = useState('');
  const [maxFee, setMaxFee] = useState('');
  const [minExperience, setMinExperience] = useState('');
  const [available, setAvailable] = useState(''); // '', 'today', 'tomorrow'
  const [minRating, setMinRating] = useState(''); // '', '4', '4.5'
  const [sort, setSort] = useState('recommended');

  const fetchDoctors = useCallback(async () => {
    setLoading(true);
    setIsSmartMatchActive(false);
    try {
      const params = new URLSearchParams();
      if (specialty && specialty !== 'All Specialties') params.append('specialty', specialty);
      if (minFee) params.append('min_fee', minFee);
      if (maxFee) params.append('max_fee', maxFee);
      if (minExperience) params.append('min_experience', minExperience);
      if (available) params.append('available', available);
      if (minRating) params.append('min_rating', minRating);
      if (sort && sort !== 'recommended') params.append('sort', sort);

      const res = await api.get(`/doctors?${params.toString()}`);
      setDoctors(res.data);
    } catch (err) {
      console.error('Failed to fetch doctors:', err);
    } finally {
      setLoading(false);
    }
  }, [specialty, minFee, maxFee, minExperience, available, minRating, sort]);

  useEffect(() => {
    fetchDoctors();
  }, [fetchDoctors]);

  const handleRunSmartMatch = async (e) => {
    if (e) e.preventDefault();
    setMatchingLoading(true);
    try {
      const res = await api.post('/doctors/smart-match', {
        symptoms: symptomsInput,
        specialty: smartSpecialty === 'All Specialties' ? '' : smartSpecialty,
        max_budget: smartBudget ? parseFloat(smartBudget) : undefined,
        urgency: smartUrgency,
        consultation_mode: smartMode
      });

      setDoctors(res.data.ranked_doctors || []);
      setMatchingMeta({
        target_specialty: res.data.target_specialty,
        inferred_specialty: res.data.inferred_specialty,
        count: (res.data.ranked_doctors || []).length
      });
      setIsSmartMatchActive(true);
      toast.success('Smart Doctor Matching complete! Doctors ranked by suitability.');
    } catch (err) {
      console.error('Smart match failed:', err);
      toast.error('Failed to run smart matching. Please try again.');
    } finally {
      setMatchingLoading(false);
    }
  };

  const handleResetFilters = () => {
    setSpecialty('');
    setMinFee('');
    setMaxFee('');
    setMinExperience('');
    setAvailable('');
    setMinRating('');
    setSort('recommended');
    setIsSmartMatchActive(false);
    setMatchingMeta(null);
    setSymptomsInput('');
    setSmartSpecialty('');
    fetchDoctors();
  };

  const hasActiveFilters = Boolean(
    specialty || minFee || maxFee || minExperience || available || minRating || sort !== 'recommended'
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      {/* Header Banner */}
      <div className="relative overflow-hidden bg-slate-950 rounded-2xl p-8 mb-8 shadow-xl border border-indigo-900/40 text-white">
        <div className="relative z-10 max-w-3xl">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span className="text-xs font-black uppercase tracking-widest bg-indigo-500/20 text-indigo-300 px-3 py-1.5 rounded-full border border-indigo-500/30">
              🩺 Verified Specialist Network
            </span>
            <span className="text-xs font-black uppercase tracking-widest bg-emerald-500/20 text-emerald-300 px-3 py-1.5 rounded-full border border-emerald-500/30">
              ⚡ Live Clinic Tokens & Waitlist
            </span>
          </div>
          <h1 className="text-3xl sm:text-5xl font-black mt-3 tracking-tight">
            Find Your <span className="bg-gradient-to-r from-blue-400 via-indigo-300 to-emerald-400 bg-clip-text text-transparent">Ideal Doctor</span>
          </h1>
          <p className="mt-2 text-indigo-200/80 text-sm sm:text-base font-medium">
            Smart doctor matching ranked by patient preferences with transparent reasoning, priority cancellation waitlists, and live clinic token coordination.
          </p>
        </div>
      </div>

      {/* 1. SMART DOCTOR MATCHING ASSISTANT (DocBook Smart Match) */}
      <div className="bg-gradient-to-br from-indigo-950 via-slate-900 to-blue-950 rounded-2xl border border-indigo-800/50 p-6 sm:p-8 shadow-2xl mb-10 text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-64 h-64 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-indigo-900/60">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-2xl">✨</span>
              <h2 className="text-xl sm:text-2xl font-black tracking-tight bg-gradient-to-r from-white via-indigo-100 to-indigo-300 bg-clip-text text-transparent">
                DocBook Smart Doctor Matching
              </h2>
            </div>
            <p className="text-xs sm:text-sm text-indigo-200/70 mt-1 font-medium">
              Tell us your symptoms or preferences. Our algorithm ranks doctors by relevance, budget, earliest slots & ratings with detailed explanations.
            </p>
          </div>

          <button
            onClick={() => setShowSmartMatcher(!showSmartMatcher)}
            className="self-start sm:self-center px-3.5 py-1.5 text-xs font-bold rounded-lg border border-indigo-700/60 bg-indigo-900/40 text-indigo-200 hover:bg-indigo-800/50 transition cursor-pointer"
          >
            {showSmartMatcher ? 'Hide Smart Matcher ▲' : 'Open Smart Matcher ▼'}
          </button>
        </div>

        {showSmartMatcher && (
          <form onSubmit={handleRunSmartMatch} className="mt-6 space-y-5">
            {/* Symptom Input & Quick Chips */}
            <div>
              <label className="block text-xs font-black uppercase tracking-wider text-indigo-200 mb-2">
                What are your symptoms or medical concern?
              </label>
              <div className="flex flex-col sm:flex-row gap-3">
                <input
                  type="text"
                  value={symptomsInput}
                  onChange={(e) => setSymptomsInput(e.target.value)}
                  placeholder="e.g. sharp chest pain, persistent skin acne, severe migraine, knee joint swelling..."
                  className="flex-grow bg-slate-900/90 border border-indigo-700/50 rounded-xl px-4 py-3 text-sm text-white placeholder-indigo-300/40 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                />
                <button
                  type="submit"
                  disabled={matchingLoading}
                  className="px-6 py-3 bg-gradient-to-r from-indigo-500 to-blue-600 hover:from-indigo-600 hover:to-blue-700 text-white font-black text-sm rounded-xl shadow-lg transition duration-200 flex items-center justify-center gap-2 cursor-pointer active:scale-98 disabled:opacity-50"
                >
                  {matchingLoading ? (
                    <span className="flex items-center gap-2">
                      <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Ranking Doctors...
                    </span>
                  ) : (
                    <span>Find My Doctor Match →</span>
                  )}
                </button>
              </div>

              {/* Quick Preset Chips */}
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-bold text-indigo-300/70">Popular queries:</span>
                {SYMPTOM_PRESETS.map((p) => (
                  <button
                    key={p.label}
                    type="button"
                    onClick={() => {
                      setSymptomsInput(p.symptom);
                    }}
                    className={`text-[11px] font-bold px-2.5 py-1 rounded-lg border transition cursor-pointer ${
                      symptomsInput === p.symptom
                        ? 'bg-indigo-500 text-white border-indigo-400'
                        : 'bg-indigo-950/60 text-indigo-200 border-indigo-800/60 hover:bg-indigo-900/50'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Smart Matching Preferences Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-2">
              {/* Target Specialty (optional override) */}
              <div>
                <label className="block text-[11px] font-black uppercase tracking-wider text-indigo-200 mb-1.5">
                  Specialty (Optional)
                </label>
                <select
                  value={smartSpecialty}
                  onChange={(e) => setSmartSpecialty(e.target.value)}
                  className="w-full text-xs font-semibold bg-slate-900/90 border border-indigo-700/50 rounded-lg px-3 py-2.5 text-white focus:outline-none focus:ring-1 focus:ring-indigo-400"
                >
                  <option value="">Auto-Detect from Symptoms</option>
                  {SPECIALTIES.filter(s => s !== 'All Specialties').map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>

              {/* Max Consultation Budget */}
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="block text-[11px] font-black uppercase tracking-wider text-indigo-200">
                    Max Fee Budget
                  </label>
                  <span className="text-xs font-black text-emerald-400">
                    {smartBudget ? `₹${smartBudget}` : 'No limit'}
                  </span>
                </div>
                <input
                  type="range"
                  min="300"
                  max="3000"
                  step="100"
                  value={smartBudget}
                  onChange={(e) => setSmartBudget(e.target.value)}
                  className="w-full accent-indigo-400 cursor-pointer"
                />
              </div>

              {/* Urgency */}
              <div>
                <label className="block text-[11px] font-black uppercase tracking-wider text-indigo-200 mb-1.5">
                  Slot Urgency
                </label>
                <select
                  value={smartUrgency}
                  onChange={(e) => setSmartUrgency(e.target.value)}
                  className="w-full text-xs font-semibold bg-slate-900/90 border border-indigo-700/50 rounded-lg px-3 py-2.5 text-white focus:outline-none focus:ring-1 focus:ring-indigo-400"
                >
                  <option value="any">Any Available Date</option>
                  <option value="today">⚡ Needed Today (Urgent)</option>
                  <option value="tomorrow">📅 Needed Tomorrow</option>
                </select>
              </div>

              {/* Consultation Mode */}
              <div>
                <label className="block text-[11px] font-black uppercase tracking-wider text-indigo-200 mb-1.5">
                  Consultation Mode
                </label>
                <select
                  value={smartMode}
                  onChange={(e) => setSmartMode(e.target.value)}
                  className="w-full text-xs font-semibold bg-slate-900/90 border border-indigo-700/50 rounded-lg px-3 py-2.5 text-white focus:outline-none focus:ring-1 focus:ring-indigo-400"
                >
                  <option value="any">Both Clinic & Video Call</option>
                  <option value="in_person">🏥 In-Person Clinic Visit</option>
                  <option value="video">📹 Online Video Telehealth</option>
                </select>
              </div>
            </div>
          </form>
        )}

        {/* Smart Matching Active Status Banner */}
        {isSmartMatchActive && matchingMeta && (
          <div className="mt-6 pt-4 border-t border-indigo-900/60 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping"></span>
              <span className="font-bold text-indigo-200">
                Matched <strong>{matchingMeta.count}</strong> doctors
                {matchingMeta.target_specialty && (
                  <span> for target specialty: <strong className="text-white bg-indigo-500/30 px-2 py-0.5 rounded border border-indigo-400/30">{matchingMeta.target_specialty}</strong></span>
                )}
              </span>
            </div>
            <button
              onClick={handleResetFilters}
              className="px-3 py-1 bg-white/10 hover:bg-white/20 text-white rounded-md font-bold transition text-xs cursor-pointer"
            >
              Reset to All Doctors ✕
            </button>
          </div>
        )}
      </div>

      {/* STANDARD FILTER CARD (collapsible if smart match active) */}
      {!isSmartMatchActive && (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm mb-10">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-slate-100">
            <div>
              <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
                <span>🔍</span> Standard Filter Directory
              </h2>
              <p className="text-xs text-slate-500 mt-0.5 font-medium">
                Browse clinicians by manual specialty, fee range, and slot availability.
              </p>
            </div>

            <div className="flex items-center gap-3">
              {hasActiveFilters && (
                <button
                  onClick={handleResetFilters}
                  className="px-3.5 py-1.5 text-xs font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-lg border border-rose-200 transition cursor-pointer"
                >
                  Reset All Filters ✕
                </button>
              )}
              <div className="flex items-center gap-2">
                <label htmlFor="sort-select" className="text-xs font-bold text-slate-500">Sort by:</label>
                <select
                  id="sort-select"
                  value={sort}
                  onChange={(e) => setSort(e.target.value)}
                  className="text-xs font-bold bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="recommended">Recommended (Next Available)</option>
                  <option value="fee_asc">Fee: Low to High</option>
                  <option value="fee_desc">Fee: High to Low</option>
                  <option value="experience_desc">Experience: Highest First</option>
                  <option value="rating_desc">Rating: Highest Rated</option>
                </select>
              </div>
            </div>
          </div>

          {/* Filter Controls Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-5">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Medical Specialty
              </label>
              <select
                value={specialty}
                onChange={(e) => setSpecialty(e.target.value === 'All Specialties' ? '' : e.target.value)}
                className="w-full text-xs font-semibold bg-slate-50 border border-slate-200 rounded-lg px-3.5 py-2.5 text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                {SPECIALTIES.map((spec) => (
                  <option key={spec} value={spec}>{spec}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Consultation Fee (₹)
              </label>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="number"
                  placeholder="Min Fee"
                  value={minFee}
                  onChange={(e) => setMinFee(e.target.value)}
                  className="w-full text-xs font-semibold bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5 text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
                <input
                  type="number"
                  placeholder="Max Fee"
                  value={maxFee}
                  onChange={(e) => setMaxFee(e.target.value)}
                  className="w-full text-xs font-semibold bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5 text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Min. Experience
              </label>
              <select
                value={minExperience}
                onChange={(e) => setMinExperience(e.target.value)}
                className="w-full text-xs font-semibold bg-slate-50 border border-slate-200 rounded-lg px-3.5 py-2.5 text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="">Any Experience</option>
                <option value="3">3+ Years</option>
                <option value="5">5+ Years</option>
                <option value="10">10+ Years</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Slot Availability
              </label>
              <select
                value={available}
                onChange={(e) => setAvailable(e.target.value)}
                className="w-full text-xs font-semibold bg-slate-50 border border-slate-200 rounded-lg px-3.5 py-2.5 text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="">All Clinicians</option>
                <option value="today">⚡ Available Today</option>
                <option value="tomorrow">📅 Available Tomorrow</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Results Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <p className="text-sm font-black text-slate-800">
            {isSmartMatchActive
              ? `⭐ Showing ${doctors.length} Doctors Ranked by Suitability Score`
              : `Showing ${doctors.length} Verified Specialist${doctors.length === 1 ? '' : 's'}`}
          </p>
          {isSmartMatchActive && (
            <p className="text-xs text-indigo-600 font-bold mt-0.5">
              Ranked using AI matching based on your symptoms, budget, earliest slots & clinical ratings.
            </p>
          )}
        </div>
      </div>

      {/* Doctors Grid */}
      {loading ? (
        <div className="text-center py-24 bg-white rounded-2xl border border-slate-200">
          <svg className="animate-spin h-10 w-10 text-indigo-600 mx-auto" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <p className="text-slate-500 font-bold mt-4 text-sm">Searching matching clinic doctors...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {doctors.map((doctor, index) => {
            const hasSlotsToday = Number(doctor.today_slots_count) > 0;
            const hasSlotsTomorrow = Number(doctor.tomorrow_slots_count) > 0;
            const avgRating = parseFloat(doctor.average_rating || 0);
            const totalReviews = parseInt(doctor.total_reviews || 0, 10);
            const hasMatchScore = doctor.match_score !== undefined;
            const isExplanationExpanded = expandedReasonDocId === doctor.id;

            return (
              <div
                key={doctor.id}
                className={`bg-white rounded-2xl shadow-sm border overflow-hidden hover:shadow-xl hover:-translate-y-1 transition duration-300 flex flex-col justify-between group ${
                  hasMatchScore && index === 0
                    ? 'border-indigo-400 ring-2 ring-indigo-500/20'
                    : 'border-slate-200/90'
                }`}
              >
                <div className="p-6">
                  {/* Top Bar: Match Score & Verification */}
                  <div className="flex items-start justify-between gap-4 mb-4">
                    <div className="relative">
                      <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-indigo-600 to-blue-500 text-white font-black text-2xl flex items-center justify-center shadow-md">
                        {doctor.name ? doctor.name.charAt(0) : 'D'}
                      </div>
                      {hasMatchScore && index < 3 && (
                        <span className="absolute -top-2 -left-2 w-6 h-6 rounded-full bg-amber-400 text-slate-900 font-black text-xs flex items-center justify-center shadow-md">
                          #{index + 1}
                        </span>
                      )}
                    </div>

                    <div className="flex flex-col items-end gap-1.5">
                      {hasMatchScore && (
                        <span className="text-xs font-black uppercase tracking-wider bg-emerald-50 text-emerald-800 border border-emerald-300 px-3 py-1 rounded-full flex items-center gap-1.5 shadow-sm">
                          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                          {doctor.match_score}% Match
                        </span>
                      )}

                      <span className="text-[10px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-1 rounded-md flex items-center gap-1">
                        <span>✓</span> Verified Doctor
                      </span>

                      {/* Star Rating Display */}
                      {totalReviews > 0 ? (
                        <div className="flex items-center gap-1 bg-amber-50 border border-amber-200 px-2.5 py-0.5 rounded-md text-xs font-black text-amber-800">
                          <span>⭐</span>
                          <span>{avgRating.toFixed(1)}</span>
                          <span className="text-[10px] text-amber-600 font-bold">({totalReviews})</span>
                        </div>
                      ) : (
                        <span className="text-[10px] font-bold text-slate-400 bg-slate-50 px-2 py-0.5 rounded border border-slate-200">
                          New Clinician
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Doctor Info */}
                  <h3 className="text-xl font-black text-slate-900 group-hover:text-indigo-600 transition">
                    Dr. {doctor.name}
                  </h3>
                  <p className="text-xs font-extrabold uppercase tracking-wider text-indigo-600 mt-1">
                    {doctor.specialty || 'General Practitioner'}
                  </p>

                  {/* Highlights Pills */}
                  {doctor.highlights && doctor.highlights.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2.5">
                      {doctor.highlights.map((h, i) => (
                        <span
                          key={i}
                          className="text-[10px] font-black uppercase tracking-wider bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded border border-indigo-200"
                        >
                          {h}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Attributes Grid */}
                  <div className="mt-4 space-y-2 bg-slate-50/80 p-3.5 rounded-xl border border-slate-100 text-xs font-bold text-slate-600">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400 font-semibold flex items-center gap-1.5">
                        <span>🏅</span> Clinical Experience:
                      </span>
                      <span className="text-slate-900 font-black">{doctor.experience || 0} Years</span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-slate-400 font-semibold flex items-center gap-1.5">
                        <span>💵</span> Consultation Fee:
                      </span>
                      <span className="text-emerald-700 font-black text-sm">₹{doctor.fees || 0}</span>
                    </div>
                  </div>

                  {/* Availability Badge */}
                  <div className="mt-3">
                    {hasSlotsToday ? (
                      <div className="inline-flex items-center gap-1.5 text-xs font-extrabold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-lg w-full justify-center">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                        Available Today ({doctor.today_slots_count} slots)
                      </div>
                    ) : hasSlotsTomorrow ? (
                      <div className="inline-flex items-center gap-1.5 text-xs font-extrabold text-blue-700 bg-blue-50 border border-blue-200 px-3 py-1.5 rounded-lg w-full justify-center">
                        <span>📅</span> Available Tomorrow ({doctor.tomorrow_slots_count} slots)
                      </div>
                    ) : doctor.next_available_date ? (
                      <div className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg w-full justify-center">
                        <span>🗓️</span> Next Slot:{' '}
                        {new Date(doctor.next_available_date).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric'
                        })}
                      </div>
                    ) : (
                      <div className="text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-lg w-full text-center flex items-center justify-center gap-1">
                        <span>📋</span> Slots Full • Smart Waitlist Available
                      </div>
                    )}
                  </div>

                  {/* TRANSPARENT MATCH REASONING ACCORDION */}
                  {doctor.reasons && doctor.reasons.length > 0 && (
                    <div className="mt-4 pt-3 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() => setExpandedReasonDocId(isExplanationExpanded ? null : doctor.id)}
                        className="w-full flex items-center justify-between text-xs font-black text-indigo-700 bg-indigo-50/70 hover:bg-indigo-100/70 px-3 py-2 rounded-lg transition cursor-pointer"
                      >
                        <span className="flex items-center gap-1.5">
                          <span>💡</span> Why this doctor matches ({doctor.reasons.length})
                        </span>
                        <span className="text-[10px]">{isExplanationExpanded ? '▲ Hide' : '▼ View'}</span>
                      </button>

                      {isExplanationExpanded && (
                        <div className="mt-2.5 p-3 bg-slate-50 rounded-xl border border-indigo-100 space-y-2 text-xs">
                          {doctor.reasons.map((reason, rIdx) => (
                            <div key={rIdx} className="flex items-start gap-2 text-slate-700 font-medium leading-relaxed">
                              <span className="text-indigo-600 mt-0.5">•</span>
                              <span>{reason}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Card Action */}
                <div className="p-6 pt-0 bg-white space-y-2">
                  <Link
                    to={`/book/${doctor.id}`}
                    className="w-full block text-center rounded-xl py-3 bg-slate-950 text-white font-bold hover:bg-indigo-600 hover:shadow-md transition duration-200 text-sm active:scale-98"
                  >
                    Select Slot & Consult →
                  </Link>

                  {!hasSlotsToday && !hasSlotsTomorrow && !doctor.next_available_date && (
                    <Link
                      to={`/book/${doctor.id}?waitlist=1`}
                      className="w-full block text-center rounded-xl py-2 bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100 font-bold transition duration-200 text-xs active:scale-98"
                    >
                      Join Priority Waitlist 📋
                    </Link>
                  )}
                </div>
              </div>
            );
          })}

          {doctors.length === 0 && (
            <div className="col-span-full text-center py-20 px-4 bg-slate-50/50 rounded-2xl border-2 border-dashed border-slate-200">
              <span className="text-4xl">🩺</span>
              <h3 className="text-lg font-black text-slate-900 mt-3">No specialists match your filter criteria</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto font-medium">
                Try widening your fee range, choosing another specialty, or resetting the filters.
              </p>
              <button
                onClick={handleResetFilters}
                className="mt-4 px-4 py-2 bg-indigo-600 text-white font-bold rounded-lg text-xs hover:bg-indigo-700 transition cursor-pointer"
              >
                Clear All Filters
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default DoctorList;
