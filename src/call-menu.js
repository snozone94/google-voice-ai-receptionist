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
export function priceSpeech(prices = {}) {
  const labels = { jump: "A battery jump", unlock: "A door unlock", plug: "A tire plug repair", spare: "A spare tire change" };
  const lines = Object.entries(labels).filter(([key]) => prices[key]).map(([key, label]) => `${label} starts at ${Number((prices[key] + prices.fee).toFixed(2))} dollars total.`);
  if (!lines.length || !prices.fee) return "Please check the price list in your DDD text for current starting prices. The team confirms your final quote before service.";
  return `These starting totals already include the ${prices.fee} dollar service fee. ${lines.join(" ")} Parts and other charges may apply. The team confirms your final quote before service. The price list is in your DDD text.`;
}
export function priceText(prices = {}) {
  const labels = { jump: "Jump-start", unlock: "Door unlock", plug: "Tire plug", spare: "Spare tire change" };
  if (!prices.fee || !Object.keys(labels).some(key => prices[key])) return `DDD current service prices:\n${priceListUrl}\nThe team confirms your total, including the service fee, before service.`;
  const lines = Object.entries(labels).filter(([key]) => prices[key]).map(([key, label]) => `${label}: from $${Number((prices[key] + prices.fee).toFixed(2))} total`);
  return `DDD starting totals, including the $${prices.fee} service fee for one service:\n\n${lines.join("\n")}\n\nParts and other charges may apply. Final quote confirmed before service.\nMore service details: ${priceListUrl}`;
}
export function menuTwiml({ action, repeat = false }) {
  return `<Response><Gather input="dtmf" numDigits="1" timeout="4" actionOnEmptyResult="true" action="${xml(action)}" method="POST"><Say voice="Polly.Joanna-Neural">${repeat ? "Please choose an option." : "DDD Roadside."} Press 1 to book by text. 2 for prices. 3 for an existing booking. Or 4 for the team.</Say></Gather></Response>`;
}
export function mountCallMenu(app, { express, authenticate, settings, saveEvent, sendBookingLinks, sendPriceLink, humanDial, notify, bypassAssistant, menuEnabled }) {
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
  const action = (req, params = {}) => `/api/twilio/call-menu?${new URLSearchParams({ secret: String(req.query.secret || ""), ...params })}`;
  const message = req => `<Say voice="Polly.Joanna-Neural">After the tone, leave your name, service, vehicle, and location, or your booking question. Press pound when finished.</Say><Record maxLength="90" finishOnKey="#" playBeep="true" action="${xml(action(req, { stage: "saved" }))}" method="POST" recordingStatusCallback="${xml('/api/twilio/recording?' + new URLSearchParams({ secret: String(req.query.secret || ""), menuMessage: "1" }))}" recordingStatusCallbackMethod="POST"/><Say voice="Polly.Joanna-Neural">Thank you. Please reply to DDD by text if your message did not save.</Say><Hangup/>`;
  const voicemail = req => `<Response><Say voice="Polly.Joanna-Neural">The team is not available right now. You can reply to DDD by text, or leave a message.</Say>${message(req)}</Response>`;
  app.post("/api/twilio/call-menu", express.urlencoded({ extended: false }), async (req, res, next) => {
    try {
      if (!authenticate(req)) return res.status(403).send("Forbidden");
      if (!/^CA[0-9a-f]{32}$/i.test(req.body.CallSid || "")) return res.status(400).send("Invalid call");
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
      await saveEvent({ type: "twilio.menu.choice", data: { call_id: req.body.CallSid, status: ({ "1": "Booking links requested", "2": "Prices requested", "3": "Booking question", "4": "Team requested", "9": "Assistant requested" })[digit] || "Awaiting selection", sip_headers: headers } });
      if (digit === "4") {
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
        const delivery = await sendBookingLinks(phone).catch(() => ({ ok: false }));
        content = delivery.ok ? "Use the booking and app links in your DDD text to request service. Your appointment is confirmed when the team confirms it." : "We could not confirm the booking text. You can book at D D D cincy dot com, or leave a message for the team.";
      } else if (digit === "2") {
        const published = await prices();
        const delivery = await sendPriceLink(phone, req.body.CallSid, published).catch(() => ({ ok: false }));
        content = priceSpeech(published);
        if (!delivery.ok) content = content.replace(/The price list is in your DDD text\./, "See D D D cincy dot com for the full price list.").replace(/Please check the price list in your DDD text/, "Please check D D D cincy dot com");
      } else if (digit === "3") {
        content = "For booking details, open DDD Mobile using the same phone number or email as your booking. You can leave the team a message here.";
      } else if (req.query.repeat === "1" || req.query.stage === "followup") {
        return res.type("text/xml").send(`<Response>${message(req)}</Response>`);
      } else {
        return res.type("text/xml").send(menuTwiml({ action: action(req, { repeat: "1" }), repeat: true }));
      }
      return res.type("text/xml").send(`<Response><Gather input="dtmf" numDigits="1" timeout="3" actionOnEmptyResult="true" action="${xml(action(req, { stage: "followup" }))}" method="POST"><Say voice="Polly.Joanna-Neural">${xml(content)} Press 4 for the team, or stay on the line to leave a message.</Say></Gather></Response>`);
    } catch (error) { next(error); }
  });
  return { voicemail, recordingCompleted(req) {
    if (req.query.menuMessage === "1" && req.body.RecordingStatus === "completed" && Number(req.body.RecordingDuration) > 0 && req.body.RecordingUrl) {
      notify({ title: "New DDD voice message", body: "A customer left a message. Open their conversation to listen and reply.", data: { type: "customer-voicemail", callId: req.body.CallSid, from: req.body.From || "" } }, "menu-voice-message");
    }
  }, async enabled() { return process.env.CALL_MENU_ENABLED !== "false" && (await menuEnabled()); }, render(req) { return menuTwiml({ action: action(req) }); } };
}
