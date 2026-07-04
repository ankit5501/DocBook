import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/axios';

const DoctorList = () => {
  const [doctors, setDoctors] = useState([]);
  const [specialty, setSpecialty] = useState('');

  useEffect(() => {
    fetchDoctors();
  }, []);

  const fetchDoctors = async (searchSpecialty = '') => {
    try {
      const query = searchSpecialty ? `?specialty=${searchSpecialty}` : '';
      const res = await api.get(`/doctors${query}`);
      setDoctors(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    fetchDoctors(specialty);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      {/* Title */}
      <div className="text-center mb-12">
        <span className="inline-block text-xs font-black uppercase tracking-widest bg-indigo-50 text-indigo-700 px-3 py-1.5 rounded-md border border-indigo-100 mb-4">
          🩺 Expert Clinic Network
        </span>
        <h1 className="text-4xl sm:text-5xl font-black text-gray-900 tracking-tight leading-tight">
          Find your <span className="bg-gradient-to-r from-blue-700 to-emerald-600 bg-clip-text text-transparent">Specialist</span>
        </h1>
        <p className="mt-3 text-base text-gray-500 max-w-xl mx-auto font-medium">
          Search from our network of verified clinic doctors and secure your available slot instantly.
        </p>
      </div>

      {/* Search Input Bar */}
      <div className="max-w-xl mx-auto mb-14">
        <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            placeholder="Search by specialty (e.g. Cardiologist)"
            className="flex-1 rounded-lg px-5 py-3.5 border border-gray-200 bg-white shadow-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 text-sm font-semibold transition"
            value={specialty}
            onChange={(e) => setSpecialty(e.target.value)}
          />
          <button
            type="submit"
            className="rounded-lg px-8 py-3.5 text-white font-bold text-sm bg-indigo-950 hover:bg-slate-900 shadow-md active:scale-98 transition duration-150 cursor-pointer"
          >
            Search Specialist
          </button>
        </form>
      </div>

      {/* Doctor Grid */}
      <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
        {doctors.map((doctor) => (
          <div
            key={doctor.id}
            className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden hover:shadow-md hover:-translate-y-1 transition duration-300 flex flex-col justify-between"
          >
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="w-14 h-14 rounded-lg bg-indigo-50/50 border border-indigo-100 flex items-center justify-center text-indigo-700 font-black text-xl">
                  {doctor.name.charAt(0)}
                </div>
                <span className="text-[10px] font-black uppercase tracking-wider bg-indigo-50 text-indigo-700 border border-indigo-100 px-2.5 py-1 rounded-md">
                  Verified Doctor
                </span>
              </div>

              <h3 className="text-xl font-extrabold text-gray-900 leading-snug">Dr. {doctor.name}</h3>
              <p className="text-xs font-bold uppercase tracking-wider text-indigo-600 mt-1">{doctor.specialty || 'General Practitioner'}</p>

              <div className="mt-5 space-y-2.5 text-xs text-gray-600 font-bold">
                <div className="flex items-center space-x-2">
                  <span>⭐</span>
                  <span className="text-gray-500">Experience:</span>
                  <span className="text-gray-900">{doctor.experience || 0} Years</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span>💰</span>
                  <span className="text-gray-500">Consultation Fee:</span>
                  <span className="text-gray-900">₹{doctor.fees || 0}</span>
                </div>
              </div>
            </div>

            <div className="p-6 bg-slate-50/50 border-t border-gray-100">
              <Link
                to={`/book/${doctor.id}`}
                className="w-full block text-center rounded-lg py-3 border border-indigo-950 text-indigo-950 font-bold hover:bg-indigo-950 hover:text-white transition duration-200 text-sm active:scale-98"
              >
                Book Appointment
              </Link>
            </div>
          </div>
        ))}

        {doctors.length === 0 && (
          <div className="col-span-full text-center text-gray-400 py-16 font-bold text-sm bg-gray-50 rounded-lg border border-dashed border-gray-300">
            No doctors found matching your criteria.
          </div>
        )}
      </div>
    </div>
  );
};

export default DoctorList;
