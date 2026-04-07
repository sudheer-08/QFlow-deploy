import { getApps, initializeApp } from 'firebase/app'
import { getMessaging, getToken, isSupported, onMessage } from 'firebase/messaging'
import api from './api'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
}

const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY
let activeToken = null

const setPushDebugStatus = (status) => {
  try {
    localStorage.setItem('qflow_push_last_status', JSON.stringify({
      ...status,
      at: new Date().toISOString()
    }))
  } catch (_err) {
    // Best effort debug storage
  }
}

const getCurrentUserId = () => {
  try {
    const raw = localStorage.getItem('qflow_user')
    if (!raw) return null
    const parsed = JSON.parse(raw)
    return parsed?.id || null
  } catch (_err) {
    return null
  }
}

const welcomeFlagKey = (userId) => `qflow_push_welcome_sent_${userId}`

const getFirebaseApp = () => {
  if (getApps().length > 0) return getApps()[0]
  return initializeApp(firebaseConfig)
}

const hasFirebaseWebConfig = () => {
  return Boolean(
    firebaseConfig.apiKey &&
    firebaseConfig.projectId &&
    firebaseConfig.messagingSenderId &&
    firebaseConfig.appId &&
    vapidKey
  )
}

const setupForegroundListener = async () => {
  if (!(await isSupported()) || !hasFirebaseWebConfig()) return null
  const app = getFirebaseApp()
  const messaging = getMessaging(app)

  return onMessage(messaging, (payload) => {
    const title = payload?.notification?.title || 'QFlow Notification'
    const body = payload?.notification?.body || ''

    if (document.visibilityState === 'visible' && 'Notification' in window && Notification.permission === 'granted') {
      new Notification(title, { body })
    }
  })
}

const registerServiceWorker = async () => {
  if (!('serviceWorker' in navigator)) return null

  const params = new URLSearchParams({
    apiKey: firebaseConfig.apiKey,
    authDomain: firebaseConfig.authDomain || '',
    projectId: firebaseConfig.projectId,
    messagingSenderId: firebaseConfig.messagingSenderId,
    appId: firebaseConfig.appId
  })

  const registration = await navigator.serviceWorker.register(`/firebase-messaging-sw.js?${params.toString()}`)
  await navigator.serviceWorker.ready
  return registration
}

export const registerPushToken = async () => {
  if (!(await isSupported()) || !hasFirebaseWebConfig()) {
    const status = { success: false, reason: 'firebase-web-not-configured' }
    setPushDebugStatus(status)
    return status
  }

  if (!('Notification' in window)) {
    const status = { success: false, reason: 'notification-api-unsupported' }
    setPushDebugStatus(status)
    return status
  }

  if (!window.isSecureContext && location.hostname !== 'localhost') {
    const status = { success: false, reason: 'secure-context-required' }
    setPushDebugStatus(status)
    return status
  }

  if (Notification.permission === 'denied') {
    const status = { success: false, reason: 'notification-permission-denied' }
    setPushDebugStatus(status)
    return status
  }

  const permission = Notification.permission === 'granted'
    ? 'granted'
    : await Notification.requestPermission()
  if (permission !== 'granted') {
    const status = { success: false, reason: 'notification-permission-denied' }
    setPushDebugStatus(status)
    return status
  }

  const app = getFirebaseApp()
  const messaging = getMessaging(app)
  const serviceWorkerRegistration = await registerServiceWorker()
  if (!serviceWorkerRegistration) {
    const status = { success: false, reason: 'service-worker-unsupported' }
    setPushDebugStatus(status)
    return status
  }
  const token = await getToken(messaging, { vapidKey, serviceWorkerRegistration })

  if (!token) {
    const status = { success: false, reason: 'missing-token' }
    setPushDebugStatus(status)
    return status
  }

  const userId = getCurrentUserId()
  const shouldSendWelcome = Boolean(userId && !localStorage.getItem(welcomeFlagKey(userId)))

  activeToken = token
  const result = await api.post('/push/token', {
    token,
    platform: 'web',
    sendWelcome: shouldSendWelcome
  })

  if (shouldSendWelcome) {
    localStorage.setItem(welcomeFlagKey(userId), '1')
  }

  const status = result?.data || { success: true }
  setPushDebugStatus({ success: true, reason: 'registered', details: status })
  return status
}

export const unregisterPushToken = async () => {
  try {
    await api.delete('/push/token', { data: activeToken ? { token: activeToken } : {} })
  } catch (_err) {
    // Do nothing on logout cleanup failures
  }
  activeToken = null
}

export const initPushMessaging = async () => {
  try {
    await setupForegroundListener()
    const hasUser = Boolean(localStorage.getItem('qflow_user'))
    const hasAccessToken = Boolean(localStorage.getItem('qflow_token'))
    if (hasUser && hasAccessToken && typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      await registerPushToken()
    }
  } catch (_err) {
    // Best effort initialization
  }
}
