# QFlow — Clinic Queue Management System

> Multi-tenant SaaS platform for real-time clinic queue management with AI triage,
> patient self-registration, WhatsApp notifications, and live queue tracking.
> **100% free stack. No credit card. No debit card.**

---

## Tech Stack

| Layer | Technology | Cost |
|---|---|---|
| Frontend | React 18 + Vite + Tailwind | Free |
| Backend | Node.js + Express + Socket.io | Free |
| Database | Supabase (PostgreSQL) | Free |
| AI Triage | Groq API (Llama 3) | Free |
| Notifications | WhatsApp Web.js (local QR session) | Free |
| Maps | Leaflet + OpenStreetMap | Free |
| Deployment | Vercel + Koyeb | Free |

---

## Step 1 — Create Accounts (Do this first, ~45 minutes)

1. **GitHub** → github.com → Sign up → Create repo named `qflow`
2. **Supabase** → supabase.com → Sign up with GitHub → Create project → Copy URL + keys
3. **Groq** → console.groq.com → Sign up → Create API key
4. **WhatsApp mobile app** → You will scan a QR code once to connect local whatsapp-web.js session
5. **Vercel** → vercel.com → Sign up with GitHub
6. **Koyeb** → koyeb.com → Sign up with GitHub

---

## Step 2 — Setup Database

1. Go to **Supabase Dashboard → SQL Editor → New Query**
2. Copy the entire contents of `supabase_schema.sql`
3. Paste and click **Run**
4. You should see all tables created successfully

---

## Step 3 — Setup on Your Windows PC

### Prerequisites (you said you have these)
- Node.js 18+ ✅
- Docker Desktop ✅
- VS Code ✅
- Git ✅

### Commands — open PowerShell or VS Code terminal

```powershell
# 1. Clone your repo (after pushing this code to GitHub)
git clone https://github.com/YOUR_USERNAME/qflow.git
cd qflow

# 2. Start Redis (Docker must be running)
docker-compose up -d

# 3. Setup backend
cd apps\api
copy .env.example .env
# Open .env in VS Code and fill in your keys
npm install
npm run dev
# Backend runs on http://localhost:5000

# 4. Open a NEW terminal tab, setup frontend
cd apps\web
copy .env.example .env
# Open .env in VS Code and fill in your keys
npm install
npm run dev
# Frontend runs on http://localhost:5173
```

---

## Step 4 — Fill in .env Files

### apps/api/.env
```
PORT=5000
NODE_ENV=development
SUPABASE_URL=           ← from supabase.com project settings
SUPABASE_SERVICE_KEY=   ← service_role key from supabase.com
JWT_ACCESS_SECRET=      ← run: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
JWT_REFRESH_SECRET=     ← run same command again for a different value
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
GROQ_API_KEY=           ← from console.groq.com
# WhatsApp Web.js local mode uses QR scan and .wwebjs_auth session directory
REDIS_URL=redis://localhost:6379
FRONTEND_URL=http://localhost:5173
CLINIC_TIMEZONE=Asia/Kolkata
AUTH_RATE_LIMIT_PER_15_MIN=25
```

### apps/web/.env
```
VITE_API_URL=http://localhost:5000/api
VITE_SOCKET_URL=http://localhost:5000
VITE_SUPABASE_URL=      ← same as backend
VITE_SUPABASE_ANON_KEY= ← anon public key from supabase.com
```

---

## Step 5 — Test It Works

Open your browser and go to:

| URL | What you see |
|---|---|
| http://localhost:5173/login | Login screen |
| http://localhost:5173/join/citycare | Patient self-register page |
| http://localhost:5000/health | `{"status":"ok"}` — backend working |

### Test login credentials (from sample data in schema):
- **Admin:** admin@citycare.com / admin123
- **Doctor:** doctor@citycare.com / admin123
- **Reception:** reception@citycare.com / admin123

---

## Project Structure

```
qflow/
├── apps/
│   ├── web/              React frontend (port 5173)
│   │   └── src/
│   │       ├── pages/    All screen components
│   │       ├── services/ API calls
│   │       ├── store/    Auth state (Zustand)
│   │       └── socket/   Real-time Socket.io
│   └── api/              Node.js backend (port 5000)
│       └── src/
│           ├── routes/   API endpoints
│           ├── services/ AI + WhatsApp
│           ├── middleware/ Auth + rate limiting
│           └── socket/   Real-time handlers
├── supabase_schema.sql   Run this in Supabase first
├── docker-compose.yml    Starts Redis
└── README.md             This file
```

## Recommended Project Flow (Local, Production-like)

1. Start infrastructure first: run Redis via Docker before backend startup.
2. Start API second: run backend, scan WhatsApp QR once, verify `/health`.
3. Start web app third: run Vite app and verify login, join, queue live updates.
4. Run safety checks each day: `npm --prefix apps/api run test` before changes.
5. Keep delayed notifications durable: keep Redis running so reminders and rating requests survive restarts.
6. Apply schema updates before pulling new code: rerun `supabase_schema.sql` when backend schema changes are introduced.

## Recommended Backend Structure

1. `routes/` for HTTP boundary and validation.
2. `services/` for integrations and notification logic.
3. `jobs/` for delayed/retry background tasks.
4. `middleware/` for auth, rate limits, and request context.
5. `utils/` for shared validation and timezone/date helpers.

---

## Pages & URLs

| URL | Who Uses It | Login? |
|---|---|---|
| /login | All staff | No |
| /reception | Receptionist | Yes |
| /doctor | Doctor | Yes |
| /admin | Clinic Admin | Yes |
| /display?tenant=ID | TV screen | No |
| /join/:subdomain | Patients | No |
| /track/:token | Patients | No |

---

## Deploy to Production (Free)

### Frontend → Vercel
```powershell
# In apps/web folder
npm install -g vercel
vercel
# Follow prompts — it deploys automatically
```

### Backend → Koyeb
1. Push code to GitHub
2. Go to koyeb.com → Create App → Connect GitHub → Select `apps/api`
3. Set all env variables from your `.env` file
4. Deploy — Koyeb gives you a free URL

---

## Common Issues on Windows

**Docker not starting Redis?**
→ Make sure Docker Desktop is open and running before `docker-compose up -d`

**`npm run dev` fails with port in use?**
→ Run `netstat -ano | findstr :5000` to find and kill the process

**Supabase connection error?**
→ Double-check SUPABASE_URL and SUPABASE_SERVICE_KEY in your .env file

**WhatsApp not sending?**
→ Confirm QR was scanned once, backend logs show WhatsApp client ready, and `.wwebjs_auth` exists.

---

## Built With ❤️ for Final Year Placement + Hackathons
