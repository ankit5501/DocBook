const { pool } = require('../config/db');

// Clinical symptom to specialty mapping database
const SYMPTOM_SPECIALTY_MAP = {
  // Cardiology
  'chest pain': 'Cardiologist',
  'heart': 'Cardiologist',
  'palpitation': 'Cardiologist',
  'blood pressure': 'Cardiologist',
  'hypertension': 'Cardiologist',
  'shortness of breath': 'Cardiologist',
  'cholesterol': 'Cardiologist',

  // Dermatology
  'skin': 'Dermatologist',
  'acne': 'Dermatologist',
  'rash': 'Dermatologist',
  'hair loss': 'Dermatologist',
  'itching': 'Dermatologist',
  'eczema': 'Dermatologist',
  'mole': 'Dermatologist',
  'psoriasis': 'Dermatologist',

  // Neurology
  'headache': 'Neurologist',
  'migraine': 'Neurologist',
  'dizziness': 'Neurologist',
  'nerve': 'Neurologist',
  'numbness': 'Neurologist',
  'seizure': 'Neurologist',
  'vertigo': 'Neurologist',

  // Orthopedics
  'bone': 'Orthopedic',
  'joint': 'Orthopedic',
  'back pain': 'Orthopedic',
  'knee pain': 'Orthopedic',
  'fracture': 'Orthopedic',
  'arthritis': 'Orthopedic',
  'spine': 'Orthopedic',
  'sprain': 'Orthopedic',

  // General Physician
  'fever': 'General Physician',
  'cough': 'General Physician',
  'cold': 'General Physician',
  'flu': 'General Physician',
  'weakness': 'General Physician',
  'fatigue': 'General Physician',
  'vomiting': 'General Physician',
  'infection': 'General Physician',
  'stomach pain': 'General Physician',

  // Pediatrics
  'child': 'Pediatrician',
  'baby': 'Pediatrician',
  'infant': 'Pediatrician',
  'pediatric': 'Pediatrician',
  'vaccination': 'Pediatrician',
  'toddler': 'Pediatrician',

  // Gynecology
  'pregnancy': 'Gynecologist',
  'women': 'Gynecologist',
  'menstrual': 'Gynecologist',
  'period': 'Gynecologist',
  'pcos': 'Gynecologist',
  'fertility': 'Gynecologist',

  // Psychiatry
  'anxiety': 'Psychiatrist',
  'depression': 'Psychiatrist',
  'stress': 'Psychiatrist',
  'insomnia': 'Psychiatrist',
  'sleep': 'Psychiatrist',
  'panic': 'Psychiatrist',
  'mental': 'Psychiatrist',

  // ENT
  'ear': 'ENT Specialist',
  'nose': 'ENT Specialist',
  'throat': 'ENT Specialist',
  'sinus': 'ENT Specialist',
  'hearing': 'ENT Specialist',
  'tonsil': 'ENT Specialist',
  'tinnitus': 'ENT Specialist'
};

/**
 * Infer recommended medical specialty from patient symptoms text
 * @param {string} symptomText 
 * @returns {string|null}
 */
function inferSpecialtyFromSymptoms(symptomText) {
  if (!symptomText) return null;
  const lower = symptomText.toLowerCase();

  // First check specific clinical specialties (Pediatrics, Cardiology, Dermatology, etc.)
  for (const [symptom, specialty] of Object.entries(SYMPTOM_SPECIALTY_MAP)) {
    if (specialty !== 'General Physician' && lower.includes(symptom)) {
      return specialty;
    }
  }

  // Fallback to General Physician for general symptoms
  for (const [symptom, specialty] of Object.entries(SYMPTOM_SPECIALTY_MAP)) {
    if (specialty === 'General Physician' && lower.includes(symptom)) {
      return specialty;
    }
  }

  return null;
}

/**
 * Intelligent Doctor Matching & Ranking Engine
 * Computes multidimensional score (0-100) and transparent explanation reasons
 * @param {object} preferences Patient preferences
 * @returns {Promise<Array>} Ranked doctors with match scores and reasons
 */
async function matchDoctors(preferences = {}) {
  const {
    symptoms = '',
    specialty = '',
    max_budget,
    urgency = 'any', // 'today', 'tomorrow', 'within_week', 'any'
    consultation_mode = 'any', // 'in_person', 'video', 'any'
    min_experience,
    min_rating
  } = preferences;

  // Determine target specialty either directly or inferred from symptoms
  const inferredSpecialty = inferSpecialtyFromSymptoms(symptoms);
  const targetSpecialty = specialty && specialty !== 'All Specialties' 
    ? specialty 
    : (inferredSpecialty || null);

  // Fetch all active doctors with slot availability counts and reviews
  const query = `
    SELECT 
      d.id, 
      u.name, 
      u.email, 
      d.specialty, 
      d.fees, 
      d.experience, 
      d.profile_pic,
      d.is_verified,
      COALESCE(ROUND(AVG(r.rating)::numeric, 1), 0) AS average_rating,
      COUNT(DISTINCT r.id) AS total_reviews,
      (
        SELECT MIN(s.date) 
        FROM slots s 
        WHERE s.doctor_id = d.id 
          AND s.is_booked = false 
          AND s.date >= CURRENT_DATE
      ) AS next_available_date,
      (
        SELECT COUNT(*) 
        FROM slots s 
        WHERE s.doctor_id = d.id 
          AND s.is_booked = false 
          AND s.date = CURRENT_DATE
      ) AS today_slots_count,
      (
        SELECT COUNT(*) 
        FROM slots s 
        WHERE s.doctor_id = d.id 
          AND s.is_booked = false 
          AND s.date = (CURRENT_DATE + INTERVAL '1 day')::date
      ) AS tomorrow_slots_count,
      (
        SELECT COUNT(*) 
        FROM slots s 
        WHERE s.doctor_id = d.id 
          AND s.is_booked = false 
          AND s.date BETWEEN CURRENT_DATE AND (CURRENT_DATE + INTERVAL '7 days')::date
      ) AS week_slots_count
    FROM doctors d
    JOIN users u ON d.user_id = u.id
    LEFT JOIN reviews r ON r.doctor_id = d.id
    WHERE (u.is_blocked IS NULL OR u.is_blocked = false)
    GROUP BY d.id, u.name, u.email, d.specialty, d.fees, d.experience, d.profile_pic, d.is_verified
  `;

  const { rows: doctors } = await pool.query(query);

  const budgetNum = max_budget ? parseFloat(max_budget) : null;
  const minExpNum = min_experience ? parseInt(min_experience, 10) : 0;
  const minRatingNum = min_rating ? parseFloat(min_rating) : 0;

  // Rank and score each doctor
  const scoredDoctors = doctors.map(doc => {
    let score = 0;
    const reasons = [];
    const highlights = [];

    const docFee = parseFloat(doc.fees) || 0;
    const docExp = parseInt(doc.experience, 10) || 0;
    const docRating = parseFloat(doc.average_rating) || 0;
    const totalReviews = parseInt(doc.total_reviews, 10) || 0;
    const todaySlots = parseInt(doc.today_slots_count, 10) || 0;
    const tomorrowSlots = parseInt(doc.tomorrow_slots_count, 10) || 0;
    const weekSlots = parseInt(doc.week_slots_count, 10) || 0;

    // 1. Specialty & Symptom Match (Weight: 35 points)
    if (targetSpecialty) {
      if (doc.specialty && doc.specialty.toLowerCase() === targetSpecialty.toLowerCase()) {
        score += 35;
        highlights.push('Target Specialist');
        if (inferredSpecialty && symptoms) {
          reasons.push(`🎯 Exact clinical specialty match: Specializes in ${doc.specialty}, directly addressing your symptom: "${symptoms}".`);
        } else {
          reasons.push(`🎯 Exact specialty match: Verified practitioner in ${doc.specialty}.`);
        }
      } else if (doc.specialty && doc.specialty.toLowerCase().includes(targetSpecialty.toLowerCase())) {
        score += 28;
        reasons.push(`🩺 Related specialty field: Practicing in ${doc.specialty}.`);
      } else if (doc.specialty && doc.specialty.toLowerCase().includes('general physician')) {
        score += 18;
        reasons.push(`🏥 Primary care practitioner: Can diagnose and evaluate initial symptom concerns.`);
      } else {
        score += 5;
      }
    } else {
      // No specific specialty requested
      score += 25;
    }

    // 2. Slot Availability & Urgency Fit (Weight: 25 points)
    if (urgency === 'today') {
      if (todaySlots > 0) {
        score += 25;
        highlights.push('Available Today');
        reasons.push(`⚡ Immediate availability: ${todaySlots} open slot${todaySlots > 1 ? 's' : ''} available today.`);
      } else if (tomorrowSlots > 0) {
        score += 15;
        reasons.push(`📅 Next-day slot open: Can accommodate your consultation tomorrow.`);
      } else if (weekSlots > 0) {
        score += 10;
        reasons.push(`🗓️ Available this week (${weekSlots} slots open).`);
      } else {
        score += 3;
        reasons.push(`📋 All slots currently filled (DocBook Smart Waitlist claim available).`);
      }
    } else if (urgency === 'tomorrow') {
      if (tomorrowSlots > 0) {
        score += 25;
        highlights.push('Available Tomorrow');
        reasons.push(`⚡ Available tomorrow with ${tomorrowSlots} open slot${tomorrowSlots > 1 ? 's' : ''}.`);
      } else if (todaySlots > 0) {
        score += 22;
        reasons.push(`⚡ Early slot available even today!`);
      } else if (weekSlots > 0) {
        score += 14;
        reasons.push(`🗓️ Slots available later this week.`);
      } else {
        score += 3;
      }
    } else {
      // General urgency
      if (todaySlots > 0) {
        score += 25;
        highlights.push('Available Today');
        reasons.push(`⚡ Fast access: ${todaySlots} slot${todaySlots > 1 ? 's' : ''} available today.`);
      } else if (tomorrowSlots > 0) {
        score += 20;
        reasons.push(`📅 Slot available tomorrow (${tomorrowSlots} slots).`);
      } else if (weekSlots > 0) {
        score += 15;
        reasons.push(`🗓️ Slots available in the coming days.`);
      } else {
        score += 5;
        reasons.push(`📋 High demand practitioner: Join the waitlist for instant cancellation alert.`);
      }
    }

    // 3. Budget & Value Fit (Weight: 20 points)
    if (budgetNum && budgetNum > 0) {
      if (docFee <= budgetNum) {
        const savings = Math.max(0, budgetNum - docFee);
        score += 20;
        if (savings > 0) {
          highlights.push('Great Value');
          reasons.push(`💰 Within your budget: Fee of ₹${docFee} saves ₹${savings} from your ₹${budgetNum} limit.`);
        } else {
          reasons.push(`💰 Matches your budget: Consultation fee of ₹${docFee}.`);
        }
      } else if (docFee <= budgetNum * 1.2) {
        score += 10;
        reasons.push(`💳 Slightly above budget: ₹${docFee} (high clinical demand).`);
      } else {
        score += 3;
      }
    } else {
      // No strict budget provided: give points based on reasonable affordability
      if (docFee <= 600) {
        score += 20;
        reasons.push(`💰 Affordable consultation fee of ₹${docFee}.`);
      } else if (docFee <= 1200) {
        score += 16;
        reasons.push(`💳 Standard consultation fee of ₹${docFee}.`);
      } else {
        score += 12;
      }
    }

    // 4. Clinical Experience (Weight: 10 points)
    const expPoints = Math.min(10, Math.round((docExp / 15) * 10));
    score += expPoints;
    if (docExp >= 10) {
      highlights.push(`${docExp}+ Yrs Exp`);
      reasons.push(`🎓 Senior medical specialist with ${docExp} years of practice.`);
    } else if (docExp >= 5) {
      reasons.push(`🩺 Experienced practitioner with ${docExp} years in clinical care.`);
    }

    // 5. Patient Rating & Feedback Score (Weight: 10 points)
    if (docRating > 0) {
      const ratingPoints = Math.round((docRating / 5) * 8 + Math.min(2, totalReviews / 5));
      score += ratingPoints;
      if (docRating >= 4.5 && totalReviews >= 3) {
        highlights.push('Top Rated');
        reasons.push(`⭐ Patient favorite: ${docRating}★ rating based on ${totalReviews} verified patient reviews.`);
      } else {
        reasons.push(`⭐ Patient rating of ${docRating}★ (${totalReviews} review${totalReviews === 1 ? '' : 's'}).`);
      }
    } else {
      score += 5; // New doctor base
      reasons.push(`✨ Newly listed certified practitioner.`);
    }

    // Consultation mode highlight
    if (consultation_mode === 'video') {
      reasons.push(`📹 Supports private 1-on-1 HD telehealth video consultation.`);
    } else if (consultation_mode === 'in_person') {
      reasons.push(`🏥 Clinic check-in with live digital token tracking enabled.`);
    }

    // Clamp score to 100 max
    const finalScore = Math.min(99, Math.max(25, score));

    return {
      ...doc,
      match_score: finalScore,
      reasons,
      highlights: highlights.slice(0, 3)
    };
  });

  // Filter out any hard constraints if strictly requested
  let filtered = scoredDoctors;
  if (minExpNum > 0) {
    filtered = filtered.filter(d => (parseInt(d.experience, 10) || 0) >= minExpNum);
  }
  if (minRatingNum > 0) {
    filtered = filtered.filter(d => (parseFloat(d.average_rating) || 0) >= minRatingNum);
  }

  // Sort by match_score descending, then average_rating, then total_reviews
  filtered.sort((a, b) => {
    if (b.match_score !== a.match_score) return b.match_score - a.match_score;
    if (b.average_rating !== a.average_rating) return b.average_rating - a.average_rating;
    return b.total_reviews - a.total_reviews;
  });

  return {
    target_specialty: targetSpecialty,
    inferred_specialty: inferredSpecialty,
    ranked_doctors: filtered
  };
}

module.exports = {
  SYMPTOM_SPECIALTY_MAP,
  inferSpecialtyFromSymptoms,
  matchDoctors
};
