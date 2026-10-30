self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = {};
  }

  const title = payload.title || "DDD Dispatch";
  const options = {
    body: payload.body || "New DDD dispatch update.",
    badge: "/assets/ddd-dispatch-icon.png",
    icon: "/assets/ddd-dispatch-icon.png",
    tag: payload.data?.messageId || payload.data?.callId || undefined,
    data: {
      url: payload.data?.url || "/",
      ...payload.data
    }
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const data = event.notification.data || {};
  const target = new URL("/", self.location.origin);
  const type = String(data.type || "");
  target.searchParams.set("view", /booking/.test(type) ? "bookings" : /call|hangup|pickup/.test(type) ? "calls" : "inbox");
  const digits = String(data.from || "").replace(/\D/g, "");
  const phone = digits.length === 10 ? `+1${digits}` : /^1\d{10}$/.test(digits) ? `+${digits}` : "";
  if (phone) target.searchParams.set("phone", phone);
  const targetUrl = target.href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (new URL(client.url).origin === self.location.origin && "focus" in client) {
          return client.navigate(targetUrl).then((window) => (window || client).focus());
        }
      }
      return self.clients.openWindow(targetUrl);
    })
  );
});
