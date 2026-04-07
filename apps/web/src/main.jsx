import React, { Suspense, lazy } from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import 'leaflet/dist/leaflet.css'
import './index.css'

import { ToastProvider } from './components/Toast'
import BottomNav from './components/BottomNav'
import PWAInstallPrompt from './components/PWAInstallPrompt'
import Skeleton from './components/Skeleton'
import AppErrorBoundary from './components/AppErrorBoundary'
import NetworkStatusBar from './components/NetworkStatusBar'

// Staff pages
import LoginPage from './pages/LoginPage'
import ReceptionPage from './pages/ReceptionPage'
import DoctorPage from './pages/DoctorPage'
import AdminPage from './pages/AdminPage'

// Reception sub-pages
import ReceptionDashboard from './pages/reception/index'
import BookingInbox from './pages/reception/BookingInbox'

// Patient pages
import LandingPage from './pages/LandingPage'
import PatientHomePage from './pages/PatientHomePage'
import ClinicDetailPage from './pages/ClinicDetailPage'
import PatientLoginPage from './pages/PatientLoginPage'
import JoinPage from './pages/JoinPage'
import TrackerPage from './pages/TrackerPage'
import BookAppointmentPage from './pages/BookAppointmentPage'
import AppointmentTrackerPage from './pages/AppointmentTrackerPage'
import PaymentPage from './pages/PaymentPage'
import PatientDashboardPage from './pages/PatientDashboardPage'
import RatePage from './pages/RatePage'
import ClinicRegisterPage from './pages/ClinicRegisterPage'
import HealthRecordsPage from './pages/HealthRecordsPage'
import FamilyProfilesPage from './pages/FamilyProfilesPage'
import SearchPage from './pages/SearchPage'
import PatientProfilePage from './pages/PatientProfilePage'
import OnboardingPage from './pages/OnboardingPage'
import QRPosterPage from './pages/QRPosterPage'
import PushDebugPage from './pages/PushDebugPage'

import { useAuthStore } from './store/authStore'
import IntakeFormPage from './pages/IntakeFormPage';
import WaitlistManager from './pages/reception/WaitlistManager';
import PinLoginPage    from './pages/PinLoginPage';
import NotFoundPage from './pages/NotFoundPage';
import { initPushMessaging } from './services/push'

initPushMessaging()

const DisplayBoardPage = lazy(() => import('./pages/DisplayBoardPage'))
const AdvancedAnalyticsPage = lazy(() => import('./pages/AdvancedAnalyticsPage'))
const HolidaysPage = lazy(() => import('./pages/HolidaysPage'))
const PrescriptionPage = lazy(() => import('./pages/PrescriptionPage'))
const RevenueDashboard = lazy(() => import('./pages/admin/RevenueDashboard'))
const CommunicationHub = lazy(() => import('./pages/admin/CommunicationHub'))
const PerformancePage = lazy(() => import('./pages/admin/PerformancePage'))
const ClinicProfile = lazy(() => import('./pages/admin/ClinicProfile'))
const PinManager = lazy(() => import('./pages/admin/PinManager'))

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000,
      gcTime: 10 * 60 * 1000,
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
      retry: (failureCount, error) => {
        const status = error?.response?.status
        if (status && status >= 400 && status < 500 && status !== 429) {
          return false
        }
        return failureCount < 3
      },
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 30000)
    },
    mutations: {
      retry: 1
    }
  }
})

const RouteFallback = () => (
  <div style={{ padding: 16 }}>
    <Skeleton height={80} borderRadius={12} />
    <Skeleton height={80} borderRadius={12} style={{ marginTop: 12 }} />
    <Skeleton height={80} borderRadius={12} style={{ marginTop: 12 }} />
  </div>
)

const ProtectedRoute = ({ children, allowedRoles }) => {
  const { user } = useAuthStore()
  if (!user) return <Navigate to="/login" replace />
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/login" replace />
  }
  return children
}

const AuthRoute = ({ children }) => {
  const { user } = useAuthStore()
  if (!user) return children

  const routes = {
    receptionist: '/reception',
    doctor: '/doctor',
    clinic_admin: '/admin',
    super_admin: '/admin',
    patient: '/patient/dashboard'
  }

  return <Navigate to={routes[user.role] || '/'} replace />
}

const PatientProtectedRoute = ({ children }) => {
  const { user } = useAuthStore()
  if (!user) return <Navigate to="/patient/login" replace />
  return children
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AppErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <BrowserRouter>
            <NetworkStatusBar />
            <Suspense fallback={<RouteFallback />}>
            <Routes>

            {/* ─── Patient Routes ─── */}
            <Route path="/welcome" element={<OnboardingPage />} />
            <Route path="/landing" element={<LandingPage />} />
            <Route path="/" element={<PatientHomePage />} />
            <Route path="/search" element={<SearchPage />} />
            <Route path="/clinic/:subdomain" element={<ClinicDetailPage />} />
            <Route path="/clinic/:subdomain/qr" element={<QRPosterPage />} />
            <Route path="/book" element={<BookAppointmentPage />} />
            <Route path="/book/:subdomain" element={<BookAppointmentPage />} />
            <Route path="/track-appointment/:token" element={<AppointmentTrackerPage />} />
            <Route path="/payment" element={<PaymentPage />} />
            <Route path="/patient/login" element={<AuthRoute><PatientLoginPage /></AuthRoute>} />
            <Route path="/patient/dashboard" element={<PatientProtectedRoute><PatientDashboardPage /></PatientProtectedRoute>} />
            <Route path="/patient/health-records" element={<PatientProtectedRoute><HealthRecordsPage /></PatientProtectedRoute>} />
            <Route path="/patient/family" element={<PatientProtectedRoute><FamilyProfilesPage /></PatientProtectedRoute>} />
            <Route path="/patient/profile" element={<PatientProtectedRoute><PatientProfilePage /></PatientProtectedRoute>} />
            <Route path="/join/:subdomain" element={<JoinPage />} />
            <Route path="/track/:trackerToken" element={<TrackerPage />} />
            <Route path="/rate/:tenantId" element={<RatePage />} />
            <Route path="/register-clinic" element={<ClinicRegisterPage />} />
            <Route path="/intake/:token" element={<IntakeFormPage />} />
            <Route path="/push-debug" element={<PushDebugPage />} />
            
            {/* ─── Auth ─── */}
            <Route path="/login" element={<AuthRoute><LoginPage /></AuthRoute>} />

            {/* ─── Reception Routes ─── */}
            <Route path="/reception" element={
              <ProtectedRoute allowedRoles={['receptionist', 'clinic_admin']}>
                <ReceptionPage />
              </ProtectedRoute>
            } />
            <Route path="/reception/dashboard" element={
              <ProtectedRoute allowedRoles={['receptionist', 'clinic_admin']}>
                <ReceptionDashboard />
              </ProtectedRoute>
            } />
            <Route path="/reception/bookings" element={
              <ProtectedRoute allowedRoles={['receptionist', 'clinic_admin']}>
                <BookingInbox />
              </ProtectedRoute>
            } />

            {/* ─── Doctor Routes ─── */}
            <Route path="/doctor" element={
              <ProtectedRoute allowedRoles={['doctor', 'clinic_admin']}>
                <DoctorPage />
              </ProtectedRoute>
            } />
            <Route path="/doctor/prescription" element={
              <ProtectedRoute allowedRoles={['doctor', 'clinic_admin']}>
                <PrescriptionPage />
              </ProtectedRoute>
            } />

            {/* ─── Display ─── */}
            <Route path="/display" element={<DisplayBoardPage />} />

            {/* ─── Admin Routes ─── */}
            <Route path="/admin" element={
              <ProtectedRoute allowedRoles={['clinic_admin', 'super_admin']}>
                <AdminPage />
              </ProtectedRoute>
            } />
            <Route path="/admin/analytics" element={
              <ProtectedRoute allowedRoles={['clinic_admin', 'super_admin']}>
                <AdvancedAnalyticsPage />
              </ProtectedRoute>
            } />
            <Route path="/admin/holidays" element={
              <ProtectedRoute allowedRoles={['clinic_admin', 'super_admin']}>
                <HolidaysPage />
              </ProtectedRoute>
            } />
             <Route path="/admin/revenue" element={
  <ProtectedRoute allowedRoles={['clinic_admin', 'super_admin']}>
    <RevenueDashboard />
  </ProtectedRoute>
} />

            <Route path="/reception/waitlist" element={
  <ProtectedRoute allowedRoles={['receptionist', 'clinic_admin']}>
    <WaitlistManager />
  </ProtectedRoute>
} />
<Route path="/admin/communications" element={
  <ProtectedRoute allowedRoles={['clinic_admin', 'super_admin']}>
    <CommunicationHub />
  </ProtectedRoute>
} />
<Route path="/admin/performance" element={
  <ProtectedRoute allowedRoles={['clinic_admin', 'super_admin']}>
    <PerformancePage />
  </ProtectedRoute>
} />
{/* Admin routes */}
<Route path="/admin/profile" element={
  <ProtectedRoute allowedRoles={['clinic_admin']}>
    <ClinicProfile />
  </ProtectedRoute>
} />
<Route path="/admin/pins" element={
  <ProtectedRoute allowedRoles={['clinic_admin']}>
    <PinManager />
  </ProtectedRoute>
} />
            <Route path="*" element={<NotFoundPage />} />

            </Routes>
            </Suspense>
            <BottomNav />
            <PWAInstallPrompt />
          </BrowserRouter>
        </ToastProvider>
      </QueryClientProvider>
    </AppErrorBoundary>
  </React.StrictMode>
)