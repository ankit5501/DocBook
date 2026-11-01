import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/axios';

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

const DoctorList = () => {
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filter States
  const [specialty, setSpecialty] = useState('');
  const [minFee, setMinFee] = useState('');
  const [maxFee, setMaxFee] = useState('');
  const [minExperience, setMinExperience] = useState('');
  const [available, setAvailable] = useState(''); // '', 'today', 'tomorrow'
  const [minRating, setMinRating] = useState(''); // '', '4', '4.5'
  const [sort, setSort] = useState('recommended');

  const fetchDoctors = useCallback(async () => {
    setLoading(true);
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


  const handleResetFilters = () => {
    setSpecialty('');
    setMinFee('');
    setMaxFee('');
    setMinExperience('');
    setAvailable('');
    setMinRating('');
    setSort('recommended');
  };

  const hasActiveFilters = Boolean(
    specialty || minFee || maxFee || minExperience || available || minRating || sort !== 'recommended'
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      {/* Header Banner */}
      <div className="relative overflow-hidden bg-slate-950 rounded-2xl p-8 mb-8 shadow-xl border border-indigo-900/40 text-white">
        <div className="relative z-10 max-w-3xl">
          <span className="inline-block text-xs font-black uppercase tracking-widest bg-indigo-500/20 text-indigo-300 px-3 py-1.5 rounded-full border border-indigo-500/30">
            🩺 Verified Medical Specialist Network
          </span>
          <h1 className="text-3xl sm:text-5xl font-black mt-3 tracking-tight">
            Find Your <span className="bg-gradient-to-r from-blue-400 via-indigo-300 to-emerald-400 bg-clip-text text-transparent">Specialist Doctor</span>
          </h1>
          <p className="mt-2 text-indigo-200/80 text-sm sm:text-base font-medium">
            Search top-tier clinic doctors, filter by consultation fee, patient ratings, and book confirmed clinic slots instantly.
          </p>
        </div>
      </div>

      {/* Filter Toolbar Card */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm mb-10">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-slate-100">
          <div>
            <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
              <span>🔍</span> Search & Filter Clinicians
            </h2>
            <p className="text-xs text-slate-500 mt-0.5 font-medium">
              Filter by specialty, consultation fees, live slot availability, and patient ratings.
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
          {/* Specialty Dropdown */}
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
                <option key={spec} value={spec}>
                  {spec}
                </option>
              ))}
            </select>
          </div>

          {/* Fee Range Inputs */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Consultation Fee (₹)
            </label>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="number"
                placeholder="Min ₹"
                value={minFee}
                onChange={(e) => setMinFee(e.target.value)}
                className="w-full text-xs font-semibold bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5 text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
              <input
                type="number"
                placeholder="Max ₹"
                value={maxFee}
                onChange={(e) => setMaxFee(e.target.value)}
                className="w-full text-xs font-semibold bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5 text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>

          {/* Minimum Experience */}
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
              <option value="3">3+ Years of Experience</option>
              <option value="5">5+ Years of Experience</option>
              <option value="10">10+ Years of Experience</option>
              <option value="15">15+ Years of Experience</option>
            </select>
          </div>

          {/* Availability */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Slot Availability
            </label>
            <select
              value={available}
              onChange={(e) => setAvailable(e.target.value)}
              className="w-full text-xs font-semibold bg-slate-50 border border-slate-200 rounded-lg px-3.5 py-2.5 text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="">Any Date Available</option>
              <option value="today">⚡ Available Today</option>
              <option value="tomorrow">📅 Available Tomorrow</option>
            </select>
          </div>
        </div>

        {/* Rating Pills & Fee Quick Presets */}
        <div className="mt-4 pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-bold text-slate-500">Min. Rating:</span>
            {['', '4.0', '4.5'].map((r) => (
              <button
                key={r || 'all'}
                onClick={() => setMinRating(r)}
                className={`px-3 py-1 rounded-full font-bold transition cursor-pointer border ${
                  minRating === r
                    ? 'bg-amber-500 text-white border-amber-600 shadow-sm'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                {r === '' ? 'All Ratings' : `⭐ ${r}+`}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="font-bold text-slate-500">Fee Presets:</span>
            <button
              onClick={() => { setMinFee(''); setMaxFee('500'); }}
              className={`px-2.5 py-1 rounded-md font-semibold border ${maxFee === '500' ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'bg-slate-50 text-slate-600 border-slate-200'}`}
            >
              Under ₹500
            </button>
            <button
              onClick={() => { setMinFee('500'); setMaxFee('1000'); }}
              className={`px-2.5 py-1 rounded-md font-semibold border ${minFee === '500' && maxFee === '1000' ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'bg-slate-50 text-slate-600 border-slate-200'}`}
            >
              ₹500 - ₹1000
            </button>
            <button
              onClick={() => { setMinFee('1000'); setMaxFee(''); }}
              className={`px-2.5 py-1 rounded-md font-semibold border ${minFee === '1000' ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'bg-slate-50 text-slate-600 border-slate-200'}`}
            >
              ₹1000+
            </button>
          </div>
        </div>
      </div>

      {/* Results Header */}
      <div className="flex justify-between items-center mb-6">
        <p className="text-sm font-black text-slate-800">
          Showing {doctors.length} Verified Specialist{doctors.length === 1 ? '' : 's'}
        </p>
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
          {doctors.map((doctor) => {
            const hasSlotsToday = Number(doctor.today_slots_count) > 0;
            const hasSlotsTomorrow = Number(doctor.tomorrow_slots_count) > 0;
            const avgRating = parseFloat(doctor.average_rating || 0);
            const totalReviews = parseInt(doctor.total_reviews || 0, 10);

            return (
              <div
                key={doctor.id}
                className="bg-white rounded-2xl shadow-sm border border-slate-200/90 overflow-hidden hover:shadow-lg hover:-translate-y-1 transition duration-300 flex flex-col justify-between group"
              >
                <div className="p-6">
                  {/* Top Bar: Avatar & Verification */}
                  <div className="flex items-start justify-between gap-4 mb-4">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-indigo-600 to-blue-500 text-white font-black text-2xl flex items-center justify-center shadow-md">
                      {doctor.name ? doctor.name.charAt(0) : 'D'}
                    </div>

                    <div className="flex flex-col items-end gap-1.5">
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

                  {/* Attributes Grid */}
                  <div className="mt-5 space-y-2 bg-slate-50/80 p-3.5 rounded-xl border border-slate-100 text-xs font-bold text-slate-600">
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
                  <div className="mt-4">
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
                      <div className="text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-lg w-full text-center">
                        Checking new slots soon
                      </div>
                    )}
                  </div>
                </div>

                {/* Card Action */}
                <div className="p-6 pt-0 bg-white">
                  <Link
                    to={`/book/${doctor.id}`}
                    className="w-full block text-center rounded-xl py-3 bg-slate-950 text-white font-bold hover:bg-indigo-600 hover:shadow-md transition duration-200 text-sm active:scale-98"
                  >
                    Select Slot & Consult →
                  </Link>
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
                className="mt-4 px-4 py-2 bg-indigo-600 text-white font-bold rounded-lg text-xs hover:bg-indigo-700 transition"
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
