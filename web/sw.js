self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = {};
  }

  const title = payload.title || "DDD AI Dispatch";
  const options = {
    body: payload.body || "New DDD dispatch update.",
    badge: "/assets/ddd-ai-dispatch-logo.png",
    icon: "/assets/ddd-ai-dispatch-logo.png",
    data: {
      url: payload.data?.url || "/",
      ...payload.data
    }
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = new URL(event.notification.data?.url || "/", self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (client.url === targetUrl && "focus" in client) return client.focus();
      }
      return self.clients.openWindow(targetUrl);
    })
  );
});
