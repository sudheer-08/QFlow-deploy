# QFlow

Multi-tenant clinic queue and appointment platform with real-time updates, AI-assisted triage/chat, role-based dashboards, and push notifications.


## Tech Stack

### Frontend (apps/web)

- React 18 + Vite 5
- React Router 6
- TanStack Query 5
- Axios
- Zustand
- Socket.io Client
- Recharts
- Leaflet + OpenStreetMap
- Firebase Web SDK (messaging)
- TailwindCSS + custom CSS

### Backend (apps/api)

- Node.js + Express
- Supabase JS client
- Socket.io
- JWT auth + role guards
- Bull + ioredis
- Firebase Admin SDK
- Groq SDK (Llama models)
- bcryptjs
- Helmet, CORS, compression, morgan, express-rate-limit
- Jest

### Infrastructure

- Supabase (PostgreSQL)
- Redis (local via Docker Compose)
- Vercel config included for SPA frontend routing

## Repository Structure

```text
qflow/
├── apps/
│   ├── api/
│   │   ├── src/
│   │   │   ├── routes/           # API routes (auth, queue, appointments, etc.)
│   │   │   ├── services/         # ai, notifications, push
│   │   │   ├── jobs/             # reminders, no-show checker
│   │   │   ├── middleware/       # auth guards
│   │   │   ├── socket/           # socket event handlers
│   │   │   ├── models/           # supabase client
│   │   │   └── utils/            # validation, logging, error handler
│   │   ├── .env.example
│   │   └── package.json
│   ├── web/
│   │   ├── src/
│   │   │   ├── pages/            # patient/staff/admin/reception pages
│   │   │   ├── components/
│   │   │   ├── services/         # api + push
│   │   │   ├── socket/
│   │   │   ├── store/
│   │   │   └── utils/
│   │   ├── public/
│   │   │   └── firebase-messaging-sw.js
│   │   ├── .env.example
│   │   ├── vercel.json
│   │   └── package.json
│   └── package-lock.json
├── docker-compose.yml            # Redis for jobs/reminders
├── supabase_schema.sql           # Full DB schema + sample seed
└── README.md
```

## Core Product Flows

### Staff

- Login: receptionist, doctor, clinic admin
- Reception dashboard: live queue, register walk-ins, call/complete/no-show flows
- Doctor dashboard: consultation and prescription workflows
- Admin dashboards: analytics, revenue, communications, performance, profile, PIN management

### Patient

- Landing + search + clinic detail
- Patien## What This Project Includes

- Staff workflows for reception, doctors, and clinic admins
- Patient workflows for clinic discovery, booking, queue tracking, family profiles, and health records
- Real-time queue events over Socket.io
- AI integrations using Groq (symptom triage + clinic assistant chat)
- Push notifications using Firebase Cloud Messaging (web)
- Background reminders and notification queue using Bull + Redis
- Supabase PostgreSQL schema for tenants, users, queue, appointments, reviews, waitlist, and more
t auth and dashboard
- Book appointment by clinic subdomain
- Track token/appointment live
- Join queue remotely (self-registration)
- Rate visit and provide feedback
- Family profiles and health records

### Real-Time

Socket rooms are used for separation by context:

- tenant:<tenantId> for authenticated clinic staff
- tracker:<trackerToken> for patient tracking pages
- clinic:<subdomain> for public clinic/booking pages

## Backend Architecture Notes

- Entry point: apps/api/src/index.js
- Required env checks on startup (Supabase + JWT secrets)
- Both unversioned and v1 APIs are mounted (for example /api/auth and /api/v1/auth)
- Health endpoints:
  - /health
  - /api/v1/health
- Security middleware:
  - helmet
  - cors with allowlist
  - express-rate-limit for API/public/auth/chat
  - request IDs + morgan logging
- Background jobs started at boot:
  - reminders queue (Bull/Redis)
  - no-show checker interval

## API Route Map (High Level)

Mounted under /api and mirrored under /api/v1 for most modules:

- auth
- queue
- doctors
- public
- analytics
- patient
- appointments
- reviews
- chat
- health-records
- family
- holidays
- advanced-analytics
- qr
- intake
- doctor-brief
- no-show
- revenue
- communications
- performance
- push
- pin
- clinic-profile
- follow-up
- post-visit
- booking-requests

Additional:

- /health
- /api/v1/health

## Database Schema Summary

supabase_schema.sql creates these main tables:

- tenants
- users
- queue_entries
- self_registration_settings
- appointments
- doctor_slot_settings
- clinic_reviews
- consultation_notes
- family_members
- clinic_holidays
- chat_sessions
- waitlist
- user_push_tokens

Also included:

- indexes for queue/search performance
- DB-level format constraints (email/phone/password hash checks)
- normalization triggers
- RLS enablement on selected tables
- sample seed clinic and users (City Care)

## Local Setup

### Prerequisites

- Node.js 18+
- npm
- Docker Desktop (for Redis)
- Supabase project
- Groq API key
- Firebase project (if using push notifications)

### 1) Clone

```bash
git clone https://github.com/sudheer-08/QFlow-deploy.git
cd qflow
```

### 2) Start Redis

```bash
docker-compose up -d
```

### 3) Configure Backend

```bash
cd apps/api
cp .env.example .env
```

Fill values in apps/api/.env:

- PORT, NODE_ENV
- SUPABASE_URL
- SUPABASE_SERVICE_KEY
- JWT_ACCESS_SECRET
- JWT_REFRESH_SECRET
- JWT_ACCESS_EXPIRES_IN
- JWT_REFRESH_EXPIRES_IN
- GROQ_API_KEY
- FIREBASE_PROJECT_ID (optional but needed for push)
- FIREBASE_CLIENT_EMAIL (optional but needed for push)
- FIREBASE_PRIVATE_KEY (optional but needed for push)
- REDIS_URL
- FRONTEND_URL
- CLINIC_TIMEZONE
- AUTH_RATE_LIMIT_PER_15_MIN
- API_RATE_LIMIT_PER_MIN
- PUBLIC_RATE_LIMIT_PER_MIN

Start backend:

```bash
npm install
npm run dev
```

Default backend URL: http://localhost:5000

### 4) Configure Frontend

```bash
cd ../web
cp .env.example .env
```

Fill values in apps/web/.env:

- VITE_API_URL
- VITE_SOCKET_URL
- VITE_SUPABASE_URL
- VITE_SUPABASE_ANON_KEY
- VITE_FIREBASE_API_KEY (optional unless push used)
- VITE_FIREBASE_AUTH_DOMAIN (optional unless push used)
- VITE_FIREBASE_PROJECT_ID (optional unless push used)
- VITE_FIREBASE_STORAGE_BUCKET (optional unless push used)
- VITE_FIREBASE_MESSAGING_SENDER_ID (optional unless push used)
- VITE_FIREBASE_APP_ID (optional unless push used)
- VITE_FIREBASE_MEASUREMENT_ID (optional)
- VITE_FIREBASE_VAPID_KEY (optional unless push used)

Start frontend:

```bash
npm install
npm run dev
```

Default frontend URL: http://localhost:5173

### 5) Initialize Database

Run supabase_schema.sql in Supabase SQL Editor.

The schema includes sample credentials:

- admin@citycare.com / admin123
- doctor@citycare.com / admin123
- reception@citycare.com / admin123

## Development Scripts

### Backend (apps/api)

```bash
npm run dev
npm start
npm test
```

### Frontend (apps/web)

```bash
npm run dev
npm run build
npm run preview
```

## Verified Local Checks

These were executed successfully in this repository:

- Backend tests: npm --prefix apps/api test -- --runInBand
- Frontend build: npm --prefix apps/web run build

## Push Notifications (FCM)

### Backend requirements

Set Firebase Admin env values:

- FIREBASE_PROJECT_ID
- FIREBASE_CLIENT_EMAIL
- FIREBASE_PRIVATE_KEY

### Frontend requirements

Set Firebase web env values and VAPID key.

### Token storage

- Device/browser tokens are stored in user_push_tokens.
- Inactive/invalid tokens are marked inactive automatically.

### Useful endpoints

- POST /api/push/token
- DELETE /api/push/token
- POST /api/push/test
- GET /api/push/me
- GET /api/push/status

## Deployment Notes

### Frontend

- apps/web/vercel.json includes SPA rewrites to index.html.
- Suitable for Vercel static hosting.

### Backend

- Deploy apps/api to any Node host (Koyeb, Render, Fly, etc.).
- Ensure Supabase, JWT, Redis, and optional Firebase env vars are set.
- Keep FRONTEND_URL and CORS origins aligned with your deployed frontend domain.

## Troubleshooting

### Redis warnings on startup

If Redis is down, reminder queue features are degraded. Start Redis and restart API.

### CORS blocked

Set FRONTEND_URL and/or CORS_ALLOWED_ORIGINS correctly in backend env.

### Push not working

- Confirm Firebase env vars on backend
- Confirm frontend Firebase/VAPID env vars
- Confirm browser permission is granted
- Confirm rows exist in user_push_tokens
- Check /health and /api/push/status

### Auth loop or unexpected logout

The frontend auto-refreshes access tokens. Ensure refresh token endpoint and JWT secrets are correctly configured.

## Recent Updates

- Staff login Sign In button visibility improved in disabled state
- Booking flow fixed so Next • Pick Time Slot enables reliably after doctor selection
