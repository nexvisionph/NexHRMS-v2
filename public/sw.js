/**
 * NexHRMS Service Worker
 * Handles push notifications and caching for PWA functionality.
 */

const CACHE_NAME = 'nexhrms-v1';
const OFFLINE_URL = '/login';

// Install event — cache essential assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll([
        OFFLINE_URL,
        '/manifest.json',
      ]);
    })
  );
  self.skipWaiting();
});

// Activate event — clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

// Fetch event — network-first with cache fallback (only for static assets)
self.addEventListener('fetch', (event) => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') return;
  // Skip external URLs
  if (!event.request.url.startsWith(self.location.origin)) return;
  // Skip API routes, Supabase calls, and Next.js internals (RSC, data requests)
  if (event.request.url.includes('/api/')) return;
  if (event.request.url.includes('supabase')) return;
  if (event.request.url.includes('_next/data')) return;
  if (event.request.url.includes('_rsc')) return;
  if (event.request.headers.get('RSC') === '1') return;
  if (event.request.headers.get('Next-Router-State-Tree')) return;

  // Only cache static assets (JS, CSS, images, fonts) — NOT HTML/navigation
  const url = new URL(event.request.url);
  const isStaticAsset = url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/models/') ||
    url.pathname.match(/\.(js|css|png|jpg|jpeg|svg|ico|woff2?|ttf|webp|json)$/);

  if (event.request.mode === 'navigate') {
    // Navigation requests — always go to network, never intercept with cache
    // This prevents the "Failed to convert value to Response" error
    return;
  }

  if (!isStaticAsset) return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, clone);
          });
        }
        return response;
      })
      .catch(() => {
        return caches.match(event.request).then((cached) => {
          // Always return a valid Response — never undefined
          return cached || new Response('', { status: 503, statusText: 'Offline' });
        });
      })
  );
});

// ─── Push Notification Handling ─────────────────────────────────────────────

self.addEventListener('push', (event) => {
  console.log('[SW] Push received:', event);

  let data = {
    title: 'NexHRMS Notification',
    body: 'You have a new notification',
    icon: '/android-chrome-192x192.png',
    badge: '/android-chrome-192x192.png',
    tag: 'nexhrms-notification',
    data: { url: '/notifications' },
  };

  // Parse push payload if available
  if (event.data) {
    try {
      const payload = event.data.json();
      data = {
        title: payload.title || data.title,
        body: payload.body || data.body,
        icon: payload.icon || data.icon,
        badge: payload.badge || data.badge,
        tag: payload.tag || `nexhrms-${Date.now()}`,
        data: {
          url: payload.url || payload.link || '/notifications',
          notificationId: payload.notificationId,
        },
      };
    } catch (e) {
      // If not JSON, use text
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body,
    icon: data.icon,
    badge: data.badge,
    tag: data.tag,
    data: data.data,
    vibrate: [100, 50, 100],
    requireInteraction: false,
    actions: [
      { action: 'open', title: 'View' },
      { action: 'dismiss', title: 'Dismiss' },
    ],
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// Known role slugs used in the [role]/ dynamic route segment
const KNOWN_ROLES = ['admin', 'hr', 'finance', 'employee', 'supervisor', 'payroll_admin', 'auditor'];

// Notification click handler
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification clicked:', event);
  event.notification.close();

  const action = event.action;
  if (action === 'dismiss') {
    return;
  }

  // Get the URL to open (may or may not already have a role prefix)
  const rawUrl = event.notification.data?.url || '/notifications';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      let urlToOpen = rawUrl;

      // If the URL doesn't already start with a known role prefix, try to
      // extract the role from an existing open window and prepend it.
      const firstSegment = rawUrl.split('/').filter(Boolean)[0];
      if (!KNOWN_ROLES.includes(firstSegment)) {
        for (const client of clientList) {
          try {
            const clientUrl = new URL(client.url);
            const clientRole = clientUrl.pathname.split('/').filter(Boolean)[0];
            if (KNOWN_ROLES.includes(clientRole)) {
              urlToOpen = '/' + clientRole + rawUrl;
              break;
            }
          } catch (e) { /* ignore */ }
        }
      }

      // If there's already a window open, focus it and navigate
      for (const client of clientList) {
        if ('focus' in client) {
          client.focus();
          client.navigate(urlToOpen);
          return;
        }
      }
      // Otherwise open a new window
      if (self.clients.openWindow) {
        return self.clients.openWindow(urlToOpen);
      }
    })
  );
});

// Notification close handler (for analytics)
self.addEventListener('notificationclose', (event) => {
  console.log('[SW] Notification closed:', event.notification.tag);
});

// Push subscription change handler
self.addEventListener('pushsubscriptionchange', (event) => {
  console.log('[SW] Push subscription changed');
  
  event.waitUntil(
    self.registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: self.applicationServerKey,
    }).then((newSubscription) => {
      // Send new subscription to server
      return fetch('/api/push/resubscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          oldEndpoint: event.oldSubscription?.endpoint,
          newSubscription: newSubscription.toJSON(),
        }),
      });
    })
  );
});

// ─── App Badge API Support ──────────────────────────────────────────────────
// Works on Android PWA and iOS 16.4+ Safari PWA (added to home screen)

self.addEventListener('message', (event) => {
  const { type, payload } = event.data || {};
  
  if (type === 'SET_BADGE') {
    const count = payload?.count ?? 0;
    
    if ('setAppBadge' in navigator) {
      if (count > 0) {
        navigator.setAppBadge(count).catch((err) => {
          console.warn('[SW] Failed to set app badge:', err);
        });
      } else {
        navigator.clearAppBadge().catch((err) => {
          console.warn('[SW] Failed to clear app badge:', err);
        });
      }
    }
    
    // Respond to confirm badge was set
    if (event.ports && event.ports[0]) {
      event.ports[0].postMessage({ success: true, count });
    }
  }
  
  if (type === 'CLEAR_BADGE') {
    if ('clearAppBadge' in navigator) {
      navigator.clearAppBadge().catch((err) => {
        console.warn('[SW] Failed to clear app badge:', err);
      });
    }
    
    if (event.ports && event.ports[0]) {
      event.ports[0].postMessage({ success: true });
    }
  }
  
  // Skip waiting if requested (for updates)
  if (type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
