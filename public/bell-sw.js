/*
  The bell's service worker.

  It exists for one job: show a notification when the shop's server buzzes
  this device, and open the bell screen when it is tapped. It caches nothing —
  a stale bell is worse than no bell.
*/

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let data = { title: "🔔 Customer at the door", body: "Someone is waiting outside.", ringId: "" };
  try {
    if (event.data) data = { ...data, ...event.data.json() };
  } catch {
    /* A push with no body still rings. */
  }

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: "/logo.png",
      badge: "/logo.png",
      tag: "salla-bell",
      renotify: true,
      requireInteraction: true,
      vibrate: [300, 120, 300, 120, 300],
      data: { url: "/bell/staff" },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/bell/staff";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
      // Already open somewhere: bring that one forward rather than opening a
      // second copy, which would ring twice.
      for (const win of windows) {
        if (win.url.includes("/bell/staff") && "focus" in win) return win.focus();
      }
      return self.clients.openWindow(url);
    })
  );
});
