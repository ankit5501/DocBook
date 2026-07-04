-- Core Tables

CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    role VARCHAR(20) DEFAULT 'patient', -- patient, doctor, admin
    is_blocked BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS doctors (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    specialty VARCHAR(100),
    fees DECIMAL(10, 2),
    experience INTEGER,
    is_verified BOOLEAN DEFAULT FALSE,
    profile_pic VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS slots (
    id SERIAL PRIMARY KEY,
    doctor_id INTEGER REFERENCES doctors(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    is_booked BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS appointments (
    id SERIAL PRIMARY KEY,
    patient_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    doctor_id INTEGER REFERENCES doctors(id) ON DELETE CASCADE,
    slot_id INTEGER REFERENCES slots(id),
    status VARCHAR(20) DEFAULT 'pending', -- pending, accepted, rejected, completed, cancelled
    payment_status VARCHAR(20) DEFAULT 'pending', -- pending, completed, failed
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS payments (
    id SERIAL PRIMARY KEY,
    appointment_id INTEGER REFERENCES appointments(id) ON DELETE CASCADE,
    amount DECIMAL(10, 2) NOT NULL,
    payment_gateway_order_id VARCHAR(255),
    payment_method VARCHAR(20) DEFAULT 'online', -- online, offline
    status VARCHAR(20) DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS reviews (
    id SERIAL PRIMARY KEY,
    patient_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    doctor_id INTEGER REFERENCES doctors(id) ON DELETE CASCADE,
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Migration Queries for existing databases
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_blocked BOOLEAN DEFAULT FALSE;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS payment_method VARCHAR(20) DEFAULT 'online';

-- Clean up duplicate doctor profiles safely by updating slots, appointments, and reviews, then deleting duplicates
DO $$
DECLARE
    r RECORD;
    kept_id INT;
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_tables WHERE tablename = 'doctors'
    ) THEN
        FOR r IN SELECT user_id FROM doctors GROUP BY user_id HAVING COUNT(*) > 1 LOOP
            -- Find the lowest id for this user_id to keep
            SELECT MIN(id) INTO kept_id FROM doctors WHERE user_id = r.user_id;
            
            -- Update slots pointing to duplicates
            UPDATE slots SET doctor_id = kept_id WHERE doctor_id IN (SELECT id FROM doctors WHERE user_id = r.user_id AND id != kept_id);
            
            -- Update appointments pointing to duplicates
            UPDATE appointments SET doctor_id = kept_id WHERE doctor_id IN (SELECT id FROM doctors WHERE user_id = r.user_id AND id != kept_id);
            
            -- Update reviews pointing to duplicates
            UPDATE reviews SET doctor_id = kept_id WHERE doctor_id IN (SELECT id FROM doctors WHERE user_id = r.user_id AND id != kept_id);
            
            -- Delete the duplicate rows
            DELETE FROM doctors WHERE user_id = r.user_id AND id != kept_id;
        END LOOP;
    END IF;
END $$;

-- Safe unique constraint addition
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'doctors_user_id_key'
    ) THEN
        ALTER TABLE doctors ADD CONSTRAINT doctors_user_id_key UNIQUE (user_id);
    END IF;
END $$;


