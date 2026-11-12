# 🏥 DocBook – Intelligent Doctor Appointment & Healthcare Management System

<p align="center">
  <strong>Find the Right Doctor. Book Smarter. Experience Better Healthcare.</strong>
</p>

<p align="center">
  A full-stack healthcare platform that simplifies doctor discovery, appointment scheduling, digital consultations, automated waitlists, and clinic queue management.
</p>

---

## 📌 Table of Contents

- [About the Project](#-about-the-project)
- [Problem Statement](#-problem-statement)
- [Our Solution](#-our-solution)
- [Unique Selling Propositions (USPs)](#-unique-selling-propositions-usps)
- [Key Features](#-key-features)
- [System Architecture](#-system-architecture)
- [Technology Stack](#-technology-stack)
- [Project Structure](#-project-structure)
- [Database Design](#-database-design)
- [Installation and Setup](#-installation-and-setup)
- [Environment Variables](#-environment-variables)
- [API Endpoints](#-api-endpoints)
- [User Roles](#-user-roles)
- [How It Works](#-how-it-works)
- [Security and Reliability](#-security-and-reliability)
- [Future Enhancements](#-future-enhancements)
- [Screenshots](#-screenshots)
- [Contributing](#-contributing)
- [Disclaimer](#-disclaimer)
- [Author](#-author)

---

## 📖 About the Project

**DocBook** is a full-stack doctor appointment booking and healthcare management platform designed to make healthcare services more accessible, organized, and efficient.

Unlike a basic appointment booking website, DocBook focuses on improving the complete patient journey—from finding a suitable doctor to booking an appointment, attending a consultation, receiving prescriptions, and managing follow-up healthcare information.

The platform provides separate dashboards for patients, doctors, and administrators, with features such as:

- Smart Doctor Matching
- Automated Priority Waitlist
- Live Clinic Token and Queue Management
- Online and Offline Appointment Booking
- Video Consultation
- Digital Prescriptions
- Patient Medical Profiles
- Real-time Notifications
- Doctor Reviews and Ratings
- Appointment and Revenue Analytics

The primary objective is to connect patients and healthcare professionals through a unified digital healthcare management system.

---

## 🎯 Problem Statement

Traditional doctor appointment systems often create several difficulties for patients and healthcare providers.

1. **Difficult Doctor Discovery:** Patients often struggle to find suitable doctors based on their medical concerns, budget, availability, and preferences.

2. **Appointment Unavailability:** Patients may find that their preferred doctor's slots are fully booked, forcing them to repeatedly check for cancellations.

3. **Clinic Waiting Time:** Patients often have limited visibility into their position in the clinic queue and estimated waiting time.

4. **Fragmented Medical Records:** Appointment details, prescriptions, and patient medical information may be stored in different places.

5. **Limited Remote Consultation:** Patients who cannot physically visit a clinic need convenient online consultation options.

6. **Manual Clinic Management:** Doctors need an organized way to manage appointments, availability, prescriptions, and patient queues.

### Our Goal

To develop a centralized platform that simplifies doctor discovery, automates appointment management, reduces unnecessary waiting, and improves communication between patients and doctors.

---

## 💡 Our Solution

DocBook addresses these problems through an integrated healthcare management platform.

| Problem | DocBook Solution |
|---|---|
| Difficult doctor discovery | Smart Doctor Matching |
| Fully booked appointment slots | Automated Priority Waitlist |
| Uncertain clinic waiting time | Live Digital Token Queue |
| Fragmented prescriptions | Centralized Digital Prescriptions |
| Difficulty attending physically | Video Consultation |
| Manual appointment management | Doctor Dashboard |
| Lack of appointment visibility | Patient Dashboard |
| Manual platform administration | Admin Dashboard |

---

## ⭐ Unique Selling Propositions (USPs)

DocBook's main differentiation is the integration of three intelligent appointment-management workflows.

### 1. Smart Doctor Matching System

<kbd>Preference-Based Doctor Discovery</kbd>

Traditional platforms generally require patients to search and filter doctors manually.

DocBook introduces a Smart Doctor Matching Engine that ranks doctors according to patient-provided preferences.

**How it works:**

1. Patient enters symptoms or a medical concern.
2. The system identifies a potentially relevant medical specialty using a predefined symptom-to-specialty mapping.
3. Patient selects a consultation budget.
4. Patient chooses appointment urgency.
5. Patient selects clinic or video consultation.
6. The backend calculates a matching score for available doctors.
7. Doctors are displayed in ranked order with explanations.

**Matching parameters include:**

- Symptom and specialty relevance
- Appointment availability
- Consultation budget
- Doctor experience
- Patient ratings
- Consultation preferences

**Example:**

If a patient enters "Migraine and frequent headaches", the system can infer Neurology as a relevant specialty and rank doctors based on specialty relevance, available slots, budget, and other preferences.

**Technology:** Custom rule-based matching and ranking algorithm using Node.js and PostgreSQL.

**Key Benefit:** Reduces manual searching and helps patients discover doctors according to their preferences.

> Important: Smart Matching is a doctor-discovery aid, not an AI diagnosis system or a substitute for medical advice.

### 2. Automated Priority Waitlist

<kbd>Cancellation Recovery System</kbd>

One major problem in appointment booking is that patients cannot easily access a slot after another patient cancels.

DocBook introduces an automated waitlist mechanism.

**How it works:**

1. Patient selects a doctor whose appointments are fully booked.
2. Patient joins the doctor's waitlist.
3. The system stores the patient's waitlist entry.
4. When a booked slot is freed, the backend checks eligible waiting patients.
5. The earliest eligible patient receives a slot offer.
6. The slot is temporarily reserved.
7. The patient receives a notification and gets 15 minutes to claim the appointment.
8. If the offer expires, the system attempts to offer the slot to the next waiting patient.

**Key Technologies:**

- PostgreSQL
- Node.js
- Express.js
- Socket.IO
- Transaction-based slot management

**Key Benefit:** Helps patients get earlier appointments without repeatedly checking the booking page.

### 3. Live Clinic Token and Queue Management

<kbd>Digital Clinic Queue</kbd>

DocBook extends appointment management beyond online booking by introducing digital token-based clinic queue management.

**How it works:**

1. Patient books an in-person appointment.
2. Patient checks in through the platform.
3. The system generates a digital clinic token.
4. The patient's queue position is calculated.
5. The system estimates waiting time based on patients ahead and the doctor's average consultation duration.
6. The doctor calls the next patient.
7. After consultation, the doctor completes the token.
8. Queue information is updated in real time.

**Queue Management Capabilities:**

- Digital token generation
- Sequential token numbers
- Live queue status
- Estimated waiting time
- Call-next-patient functionality
- Consultation completion tracking
- No-show management
- Real-time queue updates

**Key Benefit:** Improves clinic workflow and provides patients with better visibility into their waiting status.

---

## 🚀 Key Features

### 👤 Patient Features

- Patient registration and login
- Google authentication
- Personalized patient dashboard
- Smart doctor matching
- Search doctors by specialty
- Filter doctors by consultation fees
- Filter by experience and ratings
- Check today's and tomorrow's availability
- Book clinic and video appointments
- Reschedule appointments
- Cancel appointments
- Join automated priority waitlists
- Claim available waitlist slots
- Track appointment history
- Manage personal medical profiles
- Store allergies and chronic conditions
- Maintain emergency contact information
- View and download digital prescriptions
- Submit doctor reviews and ratings
- Access video consultations
- Communicate through consultation chat
- Receive real-time notifications
- Check in and track digital clinic tokens

### 👨‍⚕️ Doctor Features

- Doctor registration and authentication
- Doctor profile management
- Specialty and consultation fee management
- Experience and profile picture management
- Appointment availability management
- Create and delete available time slots
- View patient appointments
- Accept or reject appointment requests
- Complete appointments
- View patient medical profiles
- Create and update digital prescriptions
- Add diagnosis, notes, and medications
- Manage live clinic queues
- Call the next patient
- Mark patients as no-show
- View waitlist entries
- Track earnings
- View appointment statistics
- Analyze monthly revenue
- Real-time appointment notifications

### 🛡️ Admin Features

- Admin dashboard
- View registered patients
- View registered doctors
- Verify doctor profiles
- Block and unblock users
- View all appointments
- Cancel appointments when necessary
- Monitor total appointments
- Monitor platform revenue
- View monthly booking statistics
- Analyze appointment status distribution

### 💬 Communication Features

- Real-time appointment notifications
- Consultation chat
- Video consultation rooms
- Socket.IO event-based communication
- Appointment confirmation emails

### 💳 Payment Features

- Razorpay payment gateway integration
- Server-side payment signature verification flow
- Pay-at-clinic option
- Payment status tracking
- Appointment payment records
- Booking confirmation slip

*Payment simulation is available when Razorpay credentials are not configured. Simulated payments are for development only.*

---

## 🏗️ System Architecture

DocBook follows a client-server architecture with a React frontend, Express backend, and PostgreSQL database.

```mermaid
flowchart TD
    A[Users] --> B[React Frontend]
    B --> C[REST API - Express.js]
    B <--> D[Socket.IO]
    C --> E[Authentication Middleware]
    E --> F[Controllers and Services]
    F --> G[(PostgreSQL Database)]
    F --> H[Razorpay]
    F --> I[Email Service]
    F --> J[Google OAuth]
    D --> C
    F --> K[Smart Matching Engine]
    F --> L[Waitlist Service]
    F --> M[Clinic Queue Service]
```

### Architecture Components

**1. Frontend Layer**

Built using React.js and Tailwind CSS.

Responsibilities:
- User interface
- Authentication screens
- Patient dashboard
- Doctor dashboard
- Admin dashboard
- Doctor search and matching
- Appointment booking
- Real-time notifications
- Video consultation interface

**2. Backend Layer**

Built using Node.js and Express.js.

Responsibilities:
- REST API development
- Authentication and authorization
- Appointment management
- Smart doctor matching
- Waitlist processing
- Clinic queue management
- Prescription management
- Payment processing
- Admin operations

**3. Database Layer**

PostgreSQL is used for structured and relational data storage.

Responsibilities:
- User records
- Doctor profiles
- Patient medical profiles
- Appointment records
- Availability slots
- Payments
- Reviews
- Prescriptions
- Waitlists
- Clinic tokens
- Consultation messages

**4. Real-Time Communication Layer**

Socket.IO provides real-time communication for:
- Appointment notifications
- Waitlist slot offers
- Consultation chat events
- Clinic queue updates
- Video consultation signaling events

**5. External Integrations**

- Google OAuth for authentication
- Razorpay for payment integration
- Nodemailer for email notifications
- Cloudinary dependency for media-related functionality

---

## 🛠️ Technology Stack

| Category | Technologies |
|---|---|
| Frontend | React.js 19 |
| Build Tool | Vite 8 |
| Styling | Tailwind CSS 4 |
| Routing | React Router 7 |
| HTTP Client | Axios |
| Charts | Recharts |
| Notifications | React Toastify |
| Backend | Node.js |
| Server Framework | Express.js 5 |
| Database | PostgreSQL |
| Database Driver | node-postgres (pg) |
| Authentication | JWT |
| Password Security | bcrypt |
| Google Authentication | Google OAuth |
| Real-Time Communication | Socket.IO |
| Payment Gateway | Razorpay |
| Email Service | Nodemailer |
| PDF Generation | jsPDF, html2canvas |
| File Upload | Multer |
| Media Integration | Cloudinary |

---

## 📁 Project Structure

```text
DocBook/
│
├── client/
│   ├── public/
│   │
│   ├── src/
│   │   ├── api/
│   │   │   └── axios.js
│   │   │
│   │   ├── components/
│   │   │   ├── Navbar.jsx
│   │   │   └── ...
│   │   │
│   │   ├── context/
│   │   │   └── AuthContext.jsx
│   │   │
│   │   ├── pages/
│   │   │   ├── Home.jsx
│   │   │   ├── Login.jsx
│   │   │   ├── Register.jsx
│   │   │   ├── Dashboard.jsx
│   │   │   ├── DoctorList.jsx
│   │   │   ├── BookAppointment.jsx
│   │   │   ├── PatientDashboard.jsx
│   │   │   ├── DoctorDashboard.jsx
│   │   │   ├── AdminDashboard.jsx
│   │   │   └── VideoConsultation.jsx
│   │   │
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   └── index.css
│   │
│   ├── index.html
│   └── package.json
│
├── server/
│   ├── config/
│   │   └── db.js
│   │
│   ├── controllers/
│   │   ├── authController.js
│   │   ├── doctorController.js
│   │   ├── appointmentController.js
│   │   ├── patientController.js
│   │   ├── paymentController.js
│   │   ├── reviewController.js
│   │   ├── chatController.js
│   │   ├── waitlistController.js
│   │   ├── clinicQueueController.js
│   │   └── adminController.js
│   │
│   ├── middleware/
│   │   └── authMiddleware.js
│   │
│   ├── models/
│   │   └── schema.sql
│   │
│   ├── routes/
│   │   ├── auth.js
│   │   ├── doctors.js
│   │   ├── appointments.js
│   │   ├── patient.js
│   │   ├── payments.js
│   │   ├── reviews.js
│   │   ├── chat.js
│   │   ├── waitlist.js
│   │   ├── clinicQueue.js
│   │   └── admin.js
│   │
│   ├── services/
│   │   ├── doctorMatchingService.js
│   │   └── waitlistService.js
│   │
│   ├── utils/
│   │   └── email.js
│   │
│   ├── server.js
│   └── package.json
│
└── README.md
```

*Note: This is a representative structure; some additional files and components are omitted for readability.*

---

## 🗄️ Database Design

DocBook uses PostgreSQL to maintain relational consistency between patients, doctors, appointments, and other healthcare records.

### Main Database Tables

| Table | Purpose |
|---|---|
| users | Stores patient, doctor, and admin account details |
| doctors | Stores doctor specialty, fees, experience, and verification status |
| patient_profiles | Stores patient medical information |
| slots | Stores doctor availability |
| appointments | Stores appointment bookings and statuses |
| payments | Stores payment information |
| prescriptions | Stores digital prescriptions |
| reviews | Stores doctor ratings and reviews |
| consultation_messages | Stores appointment chat messages |
| waitlists | Stores patients waiting for available appointments |
| clinic_tokens | Stores digital clinic queue tokens |

### Important Database Relationships

- One user can have a patient or doctor role.
- A doctor profile is associated with a user.
- A doctor can create multiple availability slots.
- An appointment connects a patient, doctor, and slot.
- An appointment can have a payment record.
- An appointment can have a prescription.
- A patient can submit a review for a completed appointment.
- A patient can join a doctor's waitlist.
- A clinic token is associated with an appointment.

### Database Reliability

The appointment booking flow uses PostgreSQL transactions and row-level locking to protect available slots from concurrent booking attempts.

A partial unique index also helps prevent duplicate active appointments for the same slot.

---

## ⚙️ Installation and Setup

Follow these steps to run DocBook locally.

### Prerequisites

Make sure the following software is installed:

- Node.js 20.19+ or 22.12+
- npm
- PostgreSQL 15+
- Git
- VS Code (recommended)

### 1. Clone the Repository

```bash
git clone https://github.com/ankit5501/DocBook.git
```

```bash
cd DocBook
```

### 2. Install Frontend Dependencies

```bash
cd client
npm install
```

### 3. Install Backend Dependencies

Open another terminal:

```bash
cd DocBook/server
npm install
```

### 4. Configure PostgreSQL

Make sure PostgreSQL is running.

Create a database named:

```sql
CREATE DATABASE appointment_db;
```

The backend reads the database connection from `DATABASE_URL`.

The project runs its SQL schema from `server/models/schema.sql` when the backend starts.

### 5. Configure Environment Variables

Create a `.env` file inside the `server` directory.

```env
PORT=5000

DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/appointment_db

JWT_SECRET=your_long_random_secret

GOOGLE_CLIENT_ID=your_google_oauth_client_id

RAZORPAY_KEY_ID=your_razorpay_key_id
RAZORPAY_KEY_SECRET=your_razorpay_key_secret

EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_gmail_app_password
```

Create a `.env` file inside the `client` directory:

```env
VITE_GOOGLE_CLIENT_ID=your_google_oauth_client_id
```

**Important configuration notes:**

- Replace all example credentials with your own values.
- Never commit `.env` files or API secrets to GitHub.
- Configure the Google OAuth authorized JavaScript origins for your local frontend URL.
- Razorpay keys are optional for development; the backend has a simulated payment mode when credentials are missing.
- Email notifications are simulated in the server console when email credentials are unavailable.
- The current Axios API base URL and Socket.IO URL use `http://localhost:5000`. Update those for a deployed environment.

### 6. Start the Backend Server

From the `server` directory:

```bash
npm run dev
```

The backend will run at:

```text
http://localhost:5000
```

### 7. Start the Frontend

From the `client` directory:

```bash
npm run dev
```

The frontend will generally run at:

```text
http://localhost:5173
```

### 8. Open the Application

Visit:

```text
http://localhost:5173
```

Your DocBook application should now be running locally.

---

## 🔌 API Endpoints

The backend exposes REST APIs under:

```text
http://localhost:5000/api
```

### Authentication APIs

| Method | Endpoint | Description |
|---|---|---|
| POST | `/auth/register` | Register a user |
| POST | `/auth/login` | Login |
| POST | `/auth/google` | Google authentication |

### Doctor APIs

| Method | Endpoint | Description |
|---|---|---|
| GET | `/doctors` | Get doctors and apply filters |
| POST | `/doctors/smart-match` | Get ranked doctor recommendations |
| GET | `/doctors/:id/slots` | Get available doctor slots |
| GET | `/doctors/profile` | Get logged-in doctor's profile |
| PUT | `/doctors/profile` | Update doctor profile |
| POST | `/doctors/slots` | Add availability |
| DELETE | `/doctors/slots/:id` | Delete an available slot |
| GET | `/doctors/dashboard-stats` | Get doctor dashboard statistics |
| GET | `/doctors/earnings` | Get doctor earnings |

### Appointment APIs

| Method | Endpoint | Description |
|---|---|---|
| POST | `/appointments` | Book an appointment |
| GET | `/appointments/my` | Get patient appointments |
| GET | `/appointments/doctor` | Get doctor's appointments |
| PATCH | `/appointments/:id/status` | Update appointment status |
| PATCH | `/appointments/:id/reschedule` | Reschedule appointment |
| DELETE | `/appointments/:id` | Cancel appointment |
| POST | `/appointments/:id/prescription` | Create or update prescription |
| GET | `/appointments/:id/prescription` | Get prescription |

### Waitlist APIs

| Method | Endpoint | Description |
|---|---|---|
| POST | `/waitlist` | Join a waitlist |
| GET | `/waitlist/my` | Get patient waitlist |
| POST | `/waitlist/:id/claim` | Claim an offered slot |
| DELETE | `/waitlist/:id` | Cancel waitlist entry |
| GET | `/waitlist/doctor` | Get doctor's waitlist |

### Clinic Queue APIs

| Method | Endpoint | Description |
|---|---|---|
| POST | `/clinic-queue/check-in` | Check in and generate a token |
| GET | `/clinic-queue/appointment/:appointmentId` | Get token and queue status |
| GET | `/clinic-queue/doctor/live` | Get doctor's live queue |
| POST | `/clinic-queue/call-next` | Call the next patient |
| POST | `/clinic-queue/complete` | Complete current consultation |
| POST | `/clinic-queue/:tokenId/no-show` | Mark patient as no-show |

### Payment APIs

| Method | Endpoint | Description |
|---|---|---|
| POST | `/payments/create-razorpay-order` | Create Razorpay order |
| POST | `/payments/verify-razorpay` | Verify payment signature |
| POST | `/payments/offline` | Create offline payment record |

### Patient APIs

| Method | Endpoint | Description |
|---|---|---|
| GET | `/patient/profile` | Get patient profile |
| PUT | `/patient/profile` | Update patient medical profile |
| GET | `/patient/profile/:patientId` | Get patient profile for authorized doctor/admin |

### Review APIs

| Method | Endpoint | Description |
|---|---|---|
| GET | `/reviews/doctor/:doctorId` | Get doctor reviews |
| POST | `/reviews` | Submit a review |
| GET | `/reviews/appointment/:appointmentId` | Get appointment review |

### Chat APIs

| Method | Endpoint | Description |
|---|---|---|
| GET | `/chat/:appointmentId` | Get consultation messages |
| POST | `/chat/:appointmentId` | Send a consultation message |

### Admin APIs

| Method | Endpoint | Description |
|---|---|---|
| GET | `/admin/doctors` | Get all doctors |
| PATCH | `/admin/doctors/:id/verify` | Verify a doctor |
| GET | `/admin/stats` | Get platform statistics |
| GET | `/admin/users` | Get all users |
| PATCH | `/admin/users/:id/block` | Block or unblock a user |
| GET | `/admin/appointments` | Get all appointments |
| PATCH | `/admin/appointments/:id/cancel` | Cancel an appointment |

*Protected endpoints require a valid JWT Bearer token and the appropriate user role.*

---

## 👥 User Roles

DocBook supports three primary user roles.

### Patient

Patients can:
- Search and match doctors.
- Book and manage appointments.
- Join waitlists.
- Track clinic tokens.
- Attend video consultations.
- View prescriptions and medical history.
- Submit reviews.

### Doctor

Doctors can:
- Manage their profiles.
- Create availability slots.
- Manage appointments.
- View patient information.
- Create digital prescriptions.
- Manage clinic queues.
- Track earnings and statistics.

### Admin

Administrators can:
- Manage patients and doctors.
- Verify doctor accounts.
- Manage blocked users.
- Monitor appointments.
- View revenue and booking analytics.

---

## 🔄 How It Works

### Patient Workflow

```mermaid
flowchart TD
    A[Patient Registration/Login] --> B[Search or Smart Match Doctor]
    B --> C[Select Doctor]
    C --> D{Available Slot?}
    D -->|Yes| E[Select Slot]
    D -->|No| F[Join Priority Waitlist]
    F --> G[Receive Slot Offer]
    G --> H[Claim Within 15 Minutes]
    H --> I[Appointment Created]
    E --> I
    I --> J{Consultation Type}
    J -->|Clinic| K[Clinic Check-In and Token]
    J -->|Video| L[Video Consultation]
    K --> M[Consultation Completed]
    L --> M
    M --> N[View Prescription and Submit Review]
```

### Doctor Workflow

```mermaid
flowchart TD
    A[Doctor Login] --> B[Doctor Dashboard]
    B --> C[Manage Profile and Availability]
    B --> D[View Appointment Requests]
    D --> E[Accept or Reject]
    E --> F[Consult Patient]
    F --> G[Create Digital Prescription]
    B --> H[Manage Live Clinic Queue]
    B --> I[View Earnings and Analytics]
```

---

## 🔐 Security and Reliability

DocBook incorporates several security and reliability mechanisms:

- JWT-based authentication.
- Password hashing using bcrypt.
- Role-based access control.
- Protected backend routes.
- User account blocking checks.
- Parameterized PostgreSQL queries.
- Database transactions for appointment booking.
- Row-level locking for slot reservation.
- Database-level protection against duplicate active slot bookings.
- Razorpay signature verification flow.

**Production hardening still required:** Review payment ownership and order verification, authenticate and authorize Socket.IO room membership, configure restricted CORS origins, and add comprehensive automated tests before handling real patient information or payments.

---

## 🔮 Future Enhancements

The following improvements can make DocBook more scalable and useful:

1. **Advanced Doctor Recommendation:** Improve the matching algorithm with more patient preferences, transparent scoring, and validated recommendation quality.

2. **Earlier Slot Notification:** Improve waitlist matching and notification delivery, including consultation-mode preferences and reliable concurrent offer handling.

3. **Advanced Clinic Analytics:** Add historical queue performance, average waiting time trends, and clinic workload analysis.

4. **Family Healthcare Profiles:** Allow patients to manage appointments and medical records for dependents.

5. **Medical Report Management:** Support secure uploading and organizing of laboratory reports and medical documents.

6. **Appointment Reminders:** Add scheduled reminders through email and other notification channels.

7. **Advanced Telemedicine:** Improve video consultation reliability and add secure document sharing.

8. **Automated Testing:** Add unit, integration, and end-to-end tests for critical booking, payment, waitlist, and queue workflows.

9. **Production Deployment:** Introduce deployment-specific configuration, monitoring, logging, backups, and stronger security controls.

---

## 📸 Screenshots

Add screenshots of your actual application in this section.

Suggested screenshots:

| Page | Screenshot |
|---|---|
| Landing Page | `docs/screenshots/home.png` |
| Doctor Listing | `docs/screenshots/doctors.png` |
| Smart Doctor Matching | `docs/screenshots/smart-match.png` |
| Appointment Booking | `docs/screenshots/booking.png` |
| Patient Dashboard | `docs/screenshots/patient-dashboard.png` |
| Doctor Dashboard | `docs/screenshots/doctor-dashboard.png` |
| Live Clinic Queue | `docs/screenshots/clinic-queue.png` |
| Admin Dashboard | `docs/screenshots/admin-dashboard.png` |

After adding the screenshots, you can embed them like this:

```markdown
![DocBook Home Page](docs/screenshots/home.png)
```

---

## 🤝 Contributing

Contributions, suggestions, and improvements are welcome.

To contribute:

1. Fork the repository.
2. Create a new branch.
3. Make your changes.
4. Test your changes.
5. Commit and push your changes.
6. Open a Pull Request.

```bash
git checkout -b feature/your-feature-name
git add .
git commit -m "Add: your feature description"
git push origin feature/your-feature-name
```

---

## ⚠️ Disclaimer

DocBook is an academic and portfolio software project intended to demonstrate healthcare appointment management workflows.

The Smart Doctor Matching feature provides specialty and preference-based discovery only. It does not diagnose medical conditions, determine clinical suitability, or replace professional medical advice.

The application should not be used to store or process real patient health information or production payments until appropriate security, privacy, compliance, and operational reviews have been completed.

---

## 👨‍💻 Author

**Ankit Kumar**

B.Tech – Information Technology

Bhagwan Parshuram Institute of Technology (BPIT)

GitHub: [@ankit5501](https://github.com/ankit5501)

Project Repository: [DocBook](https://github.com/ankit5501/DocBook)

---

## ⭐ Support

If you find this project interesting, consider giving the repository a star ⭐ on GitHub.

**DocBook – Making Healthcare Appointments Smarter, Simpler, and More Organized.**
