/* global importScripts, firebase */

importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js')
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js')

const query = new URL(self.location.href).searchParams

const firebaseConfig = {
  apiKey: query.get('apiKey') || '',
  authDomain: query.get('authDomain') || '',
  projectId: query.get('projectId') || '',
  messagingSenderId: query.get('messagingSenderId') || '',
  appId: query.get('appId') || ''
}

if (firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.messagingSenderId && firebaseConfig.appId) {
  firebase.initializeApp(firebaseConfig)
  const messaging = firebase.messaging()

  messaging.onBackgroundMessage((payload) => {
    const title = payload?.notification?.title || 'QFlow Notification'
    const options = {
      body: payload?.notification?.body || '',
      icon: '/favicon.ico',
      data: payload?.data || {}
    }

    self.registration.showNotification(title, options)
  })
}

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const targetUrl = event.notification?.data?.link || '/'
  event.waitUntil(clients.openWindow(targetUrl))
})
