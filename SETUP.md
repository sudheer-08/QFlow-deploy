# QFlow Setup Instructions

## 🚨 Critical Issue Fixed

All HTTP 500 errors in your application are caused by **missing environment variables** for the API server.

## 🔧 Immediate Fix Required

### 1. Create API Environment Variables

Create a `.env` file in `apps/api/` directory with the following content:

```bash
# Copy this file to apps/api/.env and fill in your actual values

# ─── SERVER ───────────────────────────────────────────
PORT=5000
NODE_ENV=development

# ─── SUPABASE (get from supabase.com → Project Settings → API) ───
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key-here

# ─── JWT (generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))") ───
JWT_ACCESS_SECRET=generate_a_random_64_char_string_here
JWT_REFRESH_SECRET=generate_a_different_random_64_char_string_here
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# ─── FRONTEND URL (for CORS) ───
FRONTEND_URL=http://localhost:5173

# ─── LOCAL HARDENING ──────────────────────────────────
CLINIC_TIMEZONE=Asia/Kolkata
AUTH_RATE_LIMIT_PER_15_MIN=25
API_RATE_LIMIT_PER_MIN=240
PUBLIC_RATE_LIMIT_PER_MIN=60

# ─── REDIS (local Docker — no changes needed for development) ───
REDIS_URL=redis://localhost:6379
```

### 2. Generate JWT Secrets

Run these commands to generate secure JWT secrets:

```bash
# Generate access secret
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Generate refresh secret  
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 3. Get Supabase Credentials

1. Go to [supabase.com](https://supabase.com)
2. Select your project or create a new one
3. Go to Project Settings → API
4. Copy:
   - **Project URL** → `SUPABASE_URL`
   - **service_role** key → `SUPABASE_SERVICE_KEY`

### 4. Restart API Server

After creating the `.env` file:

```bash
# Kill existing API server
taskkill /F /IM node.exe

# Restart API server
cd apps/api
npm start
```

## 🐛 What Was Fixed

1. **Registration Error**: `/api/auth/register-patient` was failing due to missing Supabase credentials
2. **Clinics Stats Error**: `/api/patient/clinics/stats` was failing for the same reason
3. **All Other API Endpoints**: All endpoints that use Supabase were failing

## 🧪 Test the Fix

After setting up environment variables, test registration:

1. Start both servers:
   ```bash
   # Terminal 1 - API
   cd apps/api && npm start
   
   # Terminal 2 - Web
   cd apps/web && npm run dev
   ```

2. Visit `http://localhost:5173/patient/login`
3. Click "Create Account"
4. Fill out the registration form
5. Registration should now work!

## 🔍 Additional Issues Found & Fixed

1. **Import Path Error**: Fixed Toast import in `VitalsCapturePage.jsx`
2. **Syntax Error**: Fixed missing parenthesis in `BookAppointmentPage.jsx`
3. **QRCode Import**: Fixed QRCode import in `DoctorQRPage.jsx`
4. **Supabase Client**: Fixed import paths in multiple files

## 📋 Environment Variables for Web App

You may also need to create `apps/web/.env.local`:

```bash
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

Get the `anon` key from the same Supabase Project Settings → API page.

## ❓ Troubleshooting

If you still get errors after setting up environment variables:

1. **Check Supabase Connection**: Make sure your Supabase project is active
2. **Verify Keys**: Ensure you're using the correct `service_role` key (not `anon` key for API)
3. **Restart Servers**: Always restart both API and web servers after changing env vars
4. **Check Console**: Look at API server terminal for specific error messages

## 🎯 Success Indicators

When properly configured, you should see:
- ✅ API server starts without "Invalid API key" errors
- ✅ Registration form submits successfully
- ✅ User is redirected to dashboard after registration
- ✅ No HTTP 500 errors in browser console
