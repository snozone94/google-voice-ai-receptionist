const xml = value => String(value ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[c]);
export const priceListUrl = "https://dddcincy.com/shop-our-roadside-services/";
export function parsePublishedPrices(html) {
  const text = String(html).replace(/<script\b[\s\S]*?<\/script>/gi, " ").replace(/<style\b[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/&nbsp;|&#160;/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ");
  const labels = { fee: "Standard Service Fee", jump: "Battery jump-start", unlock: "Door unlock", plug: "Tire plug repair", spare: "Spare tire change" };
  return Object.fromEntries(Object.entries(labels).flatMap(([key, label]) => {
    const match = text.match(new RegExp(label + "\\s*[:—-]?\\s*Starting at\\s*\\$([0-9]+(?:\\.[0-9]{1,2})?)", "i"));
    return match && Number(match[1]) > 0 ? [[key, Number(match[1])]] : [];
  }));
}
export const serviceAvailability = "Our regular business hours are 11 AM to 7 PM. New-tire replacement service is available until 7 PM, subject to tire and technician availability. After 7 PM, tire service is limited to spare-tire changes when a technician is available. Service outside regular hours depends on technician availability; 24/7 service is not guaranteed. All service requests require confirmation.";
export const shopVisitPolicy = "Shop visits are by confirmed appointment only. A booking request is not a confirmed appointment. Please wait for approval before traveling to the shop. The team will provide your confirmed location and directions with your appointment details.";
export const tireAvailability = "New-tire replacements are available until 7 PM, subject to tire and technician availability. After 7 PM, tire service is limited to spare-tire changes when a technician is available.";
export function priceSpeech(prices = {}) {
  const labels = { jump: "A battery jump", unlock: "A door unlock", plug: "A tire plug repair", spare: "A spare tire change" };
  const lines = Object.entries(labels).filter(([key]) => prices[key]).map(([key, label]) => `${label} starts at ${Number((prices[key] + prices.fee).toFixed(2))} dollars total.`);
  if (!lines.length || !prices.fee) return `Please check the price list in your DDD text for current starting prices. The team confirms your final quote before service. ${tireAvailability} Press 4 for hours and shop information.`;
  return `These starting totals already include the ${prices.fee} dollar service fee. ${lines.join(" ")} Parts and other charges may apply. The team confirms your final quote before service. The price list is in your DDD text. ${tireAvailability} Press 4 for hours and shop information.`;
}
export function priceText(prices = {}) {
  const labels = { jump: "Jump-start", unlock: "Door unlock", plug: "Tire plug", spare: "Spare tire change" };
  if (!prices.fee || !Object.keys(labels).some(key => prices[key])) return `DDD current service prices:\n${priceListUrl}\nThe team confirms your total, including the service fee, before service.\n\n${serviceAvailability}`;
  const lines = Object.entries(labels).filter(([key]) => prices[key]).map(([key, label]) => `${label}: from $${Number((prices[key] + prices.fee).toFixed(2))} total`);
  return `DDD starting totals, including the $${prices.fee} service fee for one service:\n\n${lines.join("\n")}\n\nParts and other charges may apply. Final quote confirmed before service.\nMore service details: ${priceListUrl}\n\n${serviceAvailability}`;
}
export function menuTwiml({ action, repeat = false }) {
  return `<Response>${repeat ? "" : '<Pause length="1"/>'}<Gather input="dtmf" numDigits="1" timeout="4" actionOnEmptyResult="true" action="${xml(action)}" method="POST"><Say voice="Polly.Joanna-Neural">${repeat ? "Please choose an option." : "Hey, thank you for calling Triple D’s automated system. How can we help you today?"} Press 1 to book by text. 2 for prices. 3 for an existing booking. 4 for hours and shop information. Or 5 to reach the team.</Say></Gather></Response>`;
}
export async function boundedMenuDelivery(send, waitMs = 1500) {
  let timer;
  try {
    return await Promise.race([
      Promise.resolve().then(send).catch(() => ({ ok: false })),
      new Promise(resolve => { timer = setTimeout(() => resolve({ ok: true, queued: true }), waitMs); })
    ]);
  } finally { clearTimeout(timer); }
}
export function mountCallMenu(app, { express, authenticate, settings, saveEvent, sendBookingLinks, sendPriceLink, humanDial, notify, bypassAssistant, menuEnabled, bookingSelfService, publicBaseUrl = process.env.PUBLIC_BASE_URL || "" }) {
  let priceCache;
  async function prices() {
    if (priceCache && priceCache.expires > Date.now()) return priceCache.value;
    try {
      const response = await fetch(priceListUrl, { signal: AbortSignal.timeout(1500) });
      if (!response.ok) return {};
      const value = parsePublishedPrices(await response.text());
      priceCache = { value, expires: Date.now() + 5 * 60000 };
      return value;
    } catch { return {}; }
  }
  const callbackUrl = value => publicBaseUrl ? new URL(value, publicBaseUrl).toString() : value;
  const action = (req, params = {}) => callbackUrl(`/api/twilio/call-menu?${new URLSearchParams({ secret: String(req.query.secret || ""), ...params })}`);
  const message = req => `<Say voice="Polly.Joanna-Neural">After the tone, leave your name, service, vehicle, and location, or your booking question. Press pound when finished.</Say><Record maxLength="90" finishOnKey="#" playBeep="true" action="${xml(action(req, { stage: "saved" }))}" method="POST" recordingStatusCallback="${xml(callbackUrl('/api/twilio/recording?' + new URLSearchParams({ secret: String(req.query.secret || ""), menuMessage: "1" })))}" recordingStatusCallbackMethod="POST"/><Say voice="Polly.Joanna-Neural">Thank you. Please reply to DDD by text if your message did not save.</Say><Hangup/>`;
  const voicemail = req => `<Response><Say voice="Polly.Joanna-Neural">The team is not available right now. You can reply to DDD by text, or leave a message.</Say>${message(req)}</Response>`;
  app.post("/api/twilio/call-menu", express.urlencoded({ extended: false }), async (req, res, next) => {
    try {
      if (!authenticate(req)) return res.status(403).send("Forbidden");
      if (!/^CA[0-9a-f]{32}$/i.test(req.body.CallSid || "")) return res.status(400).send("Invalid call");
      if (bookingSelfService && (String(req.query.stage || "").startsWith("booking-") || String(req.body.Digits || "") === "3" && !req.query.stage)) {
        const result = await bookingSelfService(req);
        if (typeof result === "string") return res.type("text/xml").send(result);
        req = { ...req, query: { ...req.query, stage: "" }, body: { ...req.body, Digits: result?.team ? "5" : "9" } };
        if (!result?.team) return res.type("text/xml").send(menuTwiml({ action: action(req) }));
      }
      const phone = req.body.From || "";
      const headers = [{ name: "from", value: phone }, { name: "to", value: req.body.To || "" }];
      if (req.query.stage === "saved") {
        const saved = Boolean(req.body.RecordingUrl && Number(req.body.RecordingDuration) > 0);
        if (saved) {
          await saveEvent({ type: "twilio.menu.message", data: { call_id: req.body.CallSid, status: "message-saved", recording_url: req.body.RecordingUrl, sip_headers: headers } });
          notify({ title: "New DDD voice message", body: "A customer left a message. Open their conversation to listen and reply.", data: { type: "customer-voicemail", callId: req.body.CallSid, from: phone } }, "menu-voice-message");
        }
        return res.type("text/xml").send(`<Response><Say voice="Polly.Joanna-Neural">${saved ? "Your message is saved for the team. Thank you." : "No message was recorded. Please reply to DDD by text so the team can help."}</Say><Hangup/></Response>`);
      }
      const digit = String(req.body.Digits || "");
      await saveEvent({ type: "twilio.menu.choice", data: { call_id: req.body.CallSid, status: ({ "1": "Booking links requested", "2": "Prices requested", "3": "Booking question", "4": "Hours and shop information requested", "5": "Team requested", "9": "Assistant requested" })[digit] || "Awaiting selection", sip_headers: headers } });
      if (digit === "5") {
        notify({ title: "DDD customer requesting the team", body: "A caller selected the team. Answer the incoming call.", data: { type: "call", callId: req.body.CallSid, from: phone } }, "menu-team-call");
        const dial = await humanDial(await settings(), { customerPhone: phone, callId: req.body.CallSid, businessPhone: req.body.To || "" });
        return res.type("text/xml").send(/<Dial\b/.test(dial) ? dial : voicemail(req));
      }
      if (digit === "9" && (await settings()).enabled !== false) {
        req.dddMenuBypass = true;
        return bypassAssistant(req, res, next);
      }
      let content;
      if (digit === "1") {
        const delivery = await boundedMenuDelivery(() => sendBookingLinks(phone, req.body.CallSid, req.query.info === "hours"));
        content = delivery.queued ? "We are sending the booking and app links by text. You can also book at D D D cincy dot com. Please wait for team approval before visiting the shop." : delivery.ok ? "Use the booking and app links in your DDD text to request service. Please wait for team approval before visiting the shop." : "We could not confirm the booking text. You can book at D D D cincy dot com, or leave a message for the team.";
      } else if (digit === "2") {
        const published = await prices();
        const delivery = await boundedMenuDelivery(() => sendPriceLink(phone, req.body.CallSid, published));
        content = priceSpeech(published);
        if (delivery.queued) content = content.replace("The price list is in your DDD text.", "We are sending the price list by text.");
        if (!delivery.ok) content = content.replace(/The price list is in your DDD text\./, "See D D D cincy dot com for the full price list.").replace(/Please check the price list in your DDD text/, "Please check D D D cincy dot com");
      } else if (digit === "4") {
        content = `${serviceAvailability} ${shopVisitPolicy} Press 1 to receive booking and shop information by text.`;
      } else if (digit === "3") {
        content = "For booking details, open DDD Mobile using the same phone number or email as your booking. You can leave the team a message here.";
      } else if (req.query.repeat === "1" || req.query.stage === "followup") {
        return res.type("text/xml").send(`<Response>${message(req)}</Response>`);
      } else {
        return res.type("text/xml").send(menuTwiml({ action: action(req, { repeat: "1" }), repeat: true }));
      }
      return res.type("text/xml").send(`<Response><Gather input="dtmf" numDigits="1" timeout="3" actionOnEmptyResult="true" action="${xml(action(req, { stage: "followup", ...(digit === "4" ? { info: "hours" } : {}) }))}" method="POST"><Say voice="Polly.Joanna-Neural">${xml(content)} Press 5 to reach the team, or stay on the line to leave a message.</Say></Gather></Response>`);
    } catch (error) {
      console.error("Phone menu request failed", error.message);
      if (!res.headersSent) return res.status(200).type("text/xml").send(`<Response><Say voice="Polly.Joanna-Neural">Sorry, we could not finish that step. You can book at D D D cincy dot com, or leave the team a message.</Say>${message(req)}</Response>`);
    }
  });
  return { voicemail, recordingCompleted(req) {
    if (req.query.menuMessage === "1" && req.body.RecordingStatus === "completed" && Number(req.body.RecordingDuration) > 0 && req.body.RecordingUrl) {
      notify({ title: "New DDD voice message", body: "A customer left a message. Open their conversation to listen and reply.", data: { type: "customer-voicemail", callId: req.body.CallSid, from: req.body.From || "" } }, "menu-voice-message");
    }
  }, async enabled() { return process.env.CALL_MENU_ENABLED !== "false" && (await menuEnabled()); }, render(req) { return menuTwiml({ action: action(req) }); } };
}
