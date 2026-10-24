export function initializeLiveWorkspace({ code, staff }) {
  const region = document.querySelector("#liveWorkspace");
  const callsArea = document.querySelector("#liveCallsArea");
  const phoneStatus = document.querySelector("#livePhoneStatus");
  const phoneControls = document.querySelector("#livePhoneControls");
  const configuration = document.querySelector("#liveCallConfiguration");
  let device;
  let currentCall;
  let currentContext;
  let authenticatedCode = "";
  let connectedCode = "";
  let connecting;
  let dialing = false;
  let live = [];
  let generation = 0;
  let closed = false;
  const expanded = new Set();
  const drafts = new Map();
  const busyDrafts = new Set();
  const api = async (route, body) => {
    const response = await fetch(route, { method: body ? "POST" : "GET", headers: { "x-staff-code": code(), ...(body ? { "Content-Type": "application/json" } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Please try again.");
    return result;
  };
  function status(message) { phoneStatus.textContent = message; }
  const button = (label, action, className = "") => {
    const element = document.createElement("button");
    element.type = "button";
    element.textContent = label;
    element.className = className;
    element.addEventListener("click", async () => {
      element.disabled = true;
      try { await action(); } catch (error) { status(error.message); }
      finally { element.disabled = false; }
    });
    return element;
  };
  function renderPhone() {
    phoneControls.replaceChildren();
    if (!currentCall) return;
    const active = currentCall;
    const customer = document.createElement("strong");
    customer.textContent = currentContext?.phone || "Customer call";
    phoneControls.append(customer);
    if (active.status() === "pending") {
      phoneControls.append(button("Answer", () => active.accept()), button("Decline", () => active.reject(), "phone-danger"));
      if (currentContext?.callId) phoneControls.append(button("Listen", async () => { await api(`/api/live-calls/${encodeURIComponent(currentContext.callId)}/incoming-mode`, { mode: "listen" }); currentContext.mode = "listen"; active.accept(); }));
    } else {
      if (currentContext?.mode === "listen") phoneControls.append(button("Take over", async () => { await api(`/api/live-calls/${encodeURIComponent(currentContext.callId)}/takeover`, {}); currentContext.mode = "answer"; status("You are speaking with the customer."); renderPhone(); }));
      else phoneControls.append(button(active.isMuted() ? "Unmute" : "Mute", () => { active.mute(!active.isMuted()); renderPhone(); }));
      phoneControls.append(button("End", () => active.disconnect(), "phone-danger"));
    }
  }
  function attach(call, context) {
    currentCall = call;
    currentContext = context;
    const clear = () => { if (currentCall !== call) return; currentCall = null; currentContext = null; status("Phone connected"); renderPhone(); renderCalls(); };
    call.on("accept", () => { status(context.mode === "listen" ? "Listening · microphone off" : "On call"); renderPhone(); });
    call.on("disconnect", clear);
    call.on("cancel", clear);
    call.on("reject", clear);
    call.on("error", (error) => { clear(); status(error.message || "Call could not connect."); });
    renderPhone();
  }
  async function ensurePhone() {
    if (device && connectedCode === code()) return device;
    if (connecting) return connecting;
    const epoch = generation;
    const accessCode = code();
    connecting = (async () => {
      status("Connecting phone...");
      const credentials = await api("/api/voice/token", {});
      if (epoch !== generation || accessCode !== code()) throw new Error("Please sign in again.");
      if (!window.Twilio?.Device) throw new Error("Phone tools are still loading. Refresh and try again.");
      device = new window.Twilio.Device(credentials.token, { closeProtection: true, tokenRefreshMs: 60000 });
      connectedCode = accessCode;
      device.on("error", (error) => status(error.message || "Phone disconnected. Try reconnecting."));
      device.on("tokenWillExpire", async () => { try { const next = await api("/api/voice/token", {}); if (epoch === generation) device?.updateToken(next.token); } catch { status("Sign in again to reconnect calling."); } });
      device.on("incoming", (call) => {
        if (currentCall) { call.reject(); return; }
        attach(call, { phone: call.customParameters.get("customerPhone") || call.parameters.From, callId: call.customParameters.get("liveCallId"), mode: call.customParameters.get("liveMode") || "answer" });
        status("Incoming customer call");
      });
      if (credentials.incomingReady) { await device.register(); await api("/api/voice/session", { active: true, available: true }); }
      status("Phone connected");
      return device;
    })().finally(() => { connecting = null; });
    return connecting;
  }
  async function join(call, mode) {
    if (currentCall || dialing) throw new Error("Finish or decline the current call first.");
    dialing = true;
    try { const phone = await ensurePhone(); attach(await phone.connect({ params: { LiveCallId: call.callId, LiveMode: mode } }), { phone: call.phone, callId: call.callId, mode }); status(mode === "listen" ? "Joining to listen..." : "Connecting to customer..."); }
    finally { dialing = false; }
  }
  function renderCalls() {
    callsArea.replaceChildren();
    for (const call of live) {
      const article = document.createElement("article");
      article.className = "live-call-item";
      const heading = document.createElement("h3");
      heading.textContent = call.phone || "Customer";
      const detail = document.createElement("p");
      detail.textContent = call.status || "AI answering";
      const actions = document.createElement("div");
      actions.className = "live-call-actions";
      if (call.capabilities?.listen && !currentCall) actions.append(button("Listen", () => join(call, "listen")));
      if (call.capabilities?.takeOver && !currentCall) actions.append(button("Answer", () => join(call, "answer")));
      actions.append(button(expanded.has(call.callId) ? "Hide conversation" : "Live conversation", () => { expanded.has(call.callId) ? expanded.delete(call.callId) : expanded.add(call.callId); renderCalls(); }));
      if (call.transcript?.length) actions.append(button(busyDrafts.has(call.callId) ? "Preparing replies..." : "Suggest replies", async () => {
        if (busyDrafts.has(call.callId)) return;
        busyDrafts.add(call.callId);
        try { const result = await api(`/api/live-calls/${encodeURIComponent(call.callId)}/drafts`, {}); drafts.set(call.callId, result.replies || []); }
        finally { busyDrafts.delete(call.callId); renderCalls(); }
      }));
      article.append(heading, detail, actions);
      if (expanded.has(call.callId)) {
        const conversation = document.createElement("div");
        conversation.className = "live-conversation";
        for (const turn of call.transcript || []) {
          const paragraph = document.createElement("p");
          const speaker = document.createElement("strong");
          speaker.textContent = `${turn.speaker}: `;
          paragraph.append(speaker, document.createTextNode(turn.text));
          conversation.append(paragraph);
        }
        article.append(conversation);
      }
      for (const draft of drafts.get(call.callId) || []) { const paragraph = document.createElement("p"); paragraph.className = "live-draft"; paragraph.textContent = draft; article.append(paragraph); }
      callsArea.append(article);
    }
  }
  document.querySelector("#connectBrowserPhone").addEventListener("click", () => ensurePhone().catch((error) => status(error.message)));
  document.querySelector("#browserDialForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    if (currentCall || dialing) return status("Finish the current call first.");
    const to = document.querySelector("#browserDialNumber").value.trim();
    if (!to) return status("Enter a customer number.");
    dialing = true;
    try { const phone = await ensurePhone(); attach(await phone.connect({ params: { To: to, CallerId: document.querySelector("#browserCallerId").value } }), { phone: to, mode: "answer" }); status("Calling customer..."); }
    catch (error) { status(error.message); }
    finally { dialing = false; }
  });
  document.querySelector("#saveLiveCallOptions").addEventListener("click", async () => {
    try { await api("/api/live-calls/config", { enabled: document.querySelector("#liveCallEnabled").checked, ringTeam: document.querySelector("#liveRingTeam").checked }); status("Live-call options saved for new calls."); }
    catch (error) { status(error.message); }
  });
  for (const [id, restore] of [["connectLiveNumber", false], ["restoreLiveNumber", true]]) {
    document.querySelector(`#${id}`).addEventListener("click", async (event) => {
      const button = event.currentTarget;
      button.disabled = true;
      const detail = document.querySelector("#liveNumberRouteStatus");
      try { const result = await api("/api/voice/number-routes", { phone: document.querySelector("#liveRouteNumber").value, restore }); detail.textContent = result.restored ? "Previous routing restored." : `${result.phone} is connected to Dispatch call controls.`; if (!restore) document.querySelector("#liveCallEnabled").checked = true; }
      catch (error) { detail.textContent = error.message; }
      finally { button.disabled = false; }
    });
  }
  async function refresh() {
    try {
      const user = staff();
      if (!user?.ok || user.role === "reviewer" || !code()) {
        region.hidden = true;
        if (authenticatedCode) { generation++; device?.destroy(); device = null; connectedCode = ""; authenticatedCode = ""; currentCall = null; live = []; drafts.clear(); renderPhone(); renderCalls(); }
        return;
      }
      region.hidden = false;
      configuration.hidden = user.role !== "admin";
      if (authenticatedCode !== code()) {
        generation++;
        device?.destroy(); device = null; connectedCode = "";
        authenticatedCode = code();
        const result = await api("/api/voice/config");
        const select = document.querySelector("#browserCallerId");
        select.replaceChildren(...(result.callerIds || []).map((id) => { const option = document.createElement("option"); option.value = id; option.textContent = id; return option; }));
        if (user.role === "admin") { const config = await api("/api/live-calls/config"); document.querySelector("#liveCallEnabled").checked = config.enabled; document.querySelector("#liveRingTeam").checked = config.ringTeam; const routeSelect = document.querySelector("#liveRouteNumber"); routeSelect.replaceChildren(...(result.callerIds || []).map((id) => { const option = document.createElement("option"); option.value = id; option.textContent = id; return option; })); }
      }
      const epoch = generation;
      const result = await api("/api/calls/live");
      if (epoch !== generation) return;
      const previous = JSON.stringify(live);
      live = result.calls || [];
      if (previous !== JSON.stringify(live)) renderCalls();
    } catch (error) { status(error.message); }
    finally { if (!closed) setTimeout(refresh, 3000); }
  }
  refresh();
  window.addEventListener("beforeunload", () => { closed = true; device?.destroy(); });
}
