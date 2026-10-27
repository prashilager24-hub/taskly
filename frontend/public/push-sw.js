/* Push notification service worker */
self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(clients.claim());
});

/* Real push messages arrive here (sent from the backend). */
self.addEventListener("push", (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = JSON.parse(event.data.text());
  } catch {
    payload = { title: "Taskly", body: event.data.text() };
  }

  const title = payload.title || "Taskly";
  const options = {
    body: payload.body || "",
    icon: payload.icon || "/vite.svg",
    badge: payload.badge || "/vite.svg",
    data: payload.data || {},
    tag: payload.tag || "taskly-push",
  };

  event.waitUntil(
    Promise.all([
      self.registration.showNotification(title, options),
      self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(clients => {
        clients.forEach(client => {
          client.postMessage({ type: "PUSH_RECEIVED", payload });
        });
      })
    ])
  );
});

/* Clicking a notification focuses the app and opens the target URL if provided. */
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = event.notification.data?.url || "/";
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ("focus" in client) {
          client.navigate(target);
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(target);
      }
    })
  );
});
