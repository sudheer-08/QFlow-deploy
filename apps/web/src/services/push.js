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

  return navigator.serviceWorker.register(`/firebase-messaging-sw.js?${params.toString()}`)
}

export const registerPushToken = async () => {
  if (!(await isSupported()) || !hasFirebaseWebConfig()) {
    return { success: false, reason: 'firebase-web-not-configured' }
  }

  if (!('Notification' in window)) {
    return { success: false, reason: 'notification-api-unsupported' }
  }

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') {
    return { success: false, reason: 'notification-permission-denied' }
  }

  const app = getFirebaseApp()
  const messaging = getMessaging(app)
  const serviceWorkerRegistration = await registerServiceWorker()
  const token = await getToken(messaging, { vapidKey, serviceWorkerRegistration })

  if (!token) {
    return { success: false, reason: 'missing-token' }
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

  return result?.data || { success: true }
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
  } catch (_err) {
    // Best effort initialization
  }
}
