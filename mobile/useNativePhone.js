import { useEffect, useRef, useState } from "react";
import { AppState, PermissionsAndroid, Platform } from "react-native";
import Constants from "expo-constants";

export function useNativePhone({ baseUrl, accessCode, signedIn }) {
  const [state, setState] = useState({ ready: false, incomingReady: false, status: "Connecting phone", callerIds: [], callerId: "", call: null });
  const voice = useRef(null);
  const currentCall = useRef(null);
  const invite = useRef(null);
  const inviteMode = useRef("answer");
  const token = useRef("");
  const generation = useRef(0);
  const dialing = useRef(false);
  const api = async (route, body) => {
    const response = await fetch(`${baseUrl}${route}`, { method: body ? "POST" : "GET", headers: { "Content-Type": "application/json", "x-staff-code": accessCode }, ...(body ? { body: JSON.stringify(body) } : {}) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Phone connection failed.");
    return data;
  };
  function attachCall(call, to = "Customer", context = {}) {
    if (currentCall.current === call) return;
    currentCall.current = call;
    const updateCall = (patch) => { if (currentCall.current === call) setState((value) => ({ ...value, call: { ...value.call, ...patch } })); };
    setState((value) => ({ ...value, call: { to, status: "Connecting", muted: false, ...context } }));
    call.on("ringing", () => updateCall({ status: "Ringing" }));
    const connected = () => updateCall({ status: context.mode === "listen" ? "Listening" : "On call", connectedAt: call.getInitialConnectedTimestamp?.()?.toISOString?.() || new Date().toISOString() });
    call.on("connected", connected);
    if (call.getState?.() === "connected") connected();
    const ended = () => { if (currentCall.current !== call) return; currentCall.current = null; invite.current = null; setState((value) => ({ ...value, call: null })); };
    call.on("disconnected", ended);
    call.on("connectFailure", (error) => { ended(); setState((value) => ({ ...value, status: error.message || "Call did not connect. Try again." })); });
  }
  useEffect(() => {
    if (!signedIn || !accessCode) return;
    let alive = true;
    const epoch = ++generation.current;
    let connecting;
    let refresh;
    async function connectPhone() {
      const config = await api("/api/voice/config");
      if (!alive || epoch !== generation.current) return;
      if (!config.ready) { setState((value) => ({ ...value, ready: false, status: "Direct calling needs admin setup", callerIds: config.callerIds || [] })); return; }
      if (Platform.OS === "web" || Constants.appOwnership === "expo" || Constants.executionEnvironment === "storeClient") {
        setState((value) => ({ ...value, status: "Direct calling is available in the installed app build", callerIds: config.callerIds || [] })); return;
      }
      const { Voice } = require("@twilio/voice-react-native-sdk");
      if (!voice.current) {
        voice.current = new Voice();
        if (Platform.OS === "ios") {
          await voice.current.setCallKitConfiguration({ callKitIncludesCallsInRecents: false, callKitMaximumCallGroups: 1, callKitMaximumCallsPerCallGroup: 1, callKitSupportedHandleTypes: [0, 1], callKitIconTemplateImageData: "", callKitRingtoneSound: "" });
          await voice.current.setIncomingCallContactHandleTemplate('${customerPhone}');
        }
        voice.current.on(Voice.Event.Error, (error) => setState((value) => ({ ...value, status: error.message || "Phone disconnected" })));
        voice.current.on(Voice.Event.CallInvite, (incoming) => {
          if (currentCall.current || invite.current) { incoming.reject().catch(() => {}); return; }
          invite.current = incoming;
          inviteMode.current = "answer";
          const params = incoming.getCustomParameters() || {};
          const customer = params.customerPhone || incoming.getFrom() || "Customer";
          const context = { liveCallId: params.liveCallId, mode: params.liveMode || "answer" };
          setState((value) => ({ ...value, call: { to: customer, status: "Incoming call", incoming: true, ...context } }));
          incoming.on("accepted", (call) => attachCall(call, customer, { ...context, mode: inviteMode.current }));
          const clear = () => { invite.current = null; setState((value) => ({ ...value, call: null })); };
          incoming.on("cancelled", clear);
          incoming.on("rejected", clear);
        });
        if (Platform.OS === "ios") await voice.current.initializePushRegistry();
      }
      const credentials = await api("/api/voice/token", {});
      if (!alive || epoch !== generation.current) return;
      token.current = credentials.token;
      const incomingReady = credentials.incomingReady && Platform.OS === "ios";
      if (incomingReady) {
        await voice.current.register(credentials.token);
        if (!alive || epoch !== generation.current) {
          await voice.current?.unregister(credentials.token).catch(() => {});
          return;
        }
        await api("/api/voice/session", { active: true, available: true });
      }
      if (!currentCall.current) {
        const existing = await voice.current.getCalls();
        if (alive && epoch === generation.current && existing.size) {
          const call = existing.values().next().value;
          const params = call.getCustomParameters?.() || {};
          attachCall(call, params.customerPhone || call.getTo?.() || call.getFrom?.() || "Customer", { liveCallId: params.liveCallId, mode: params.liveMode || "answer" });
        }
      }
      if (alive && epoch === generation.current) setState((value) => ({ ...value, ready: true, incomingReady, status: incomingReady ? "Phone connected" : "Outgoing calls ready; incoming-call setup pending", callerIds: credentials.callerIds || [], callerId: value.callerId || credentials.callerIds?.[0] || "" }));
    }
    const reconnect = () => {
      if (connecting) return connecting;
      connecting = connectPhone().catch((error) => { if (alive && epoch === generation.current) setState((value) => ({ ...value, ready: false, status: error.message })); }).finally(() => { connecting = null; });
      return connecting;
    };
    reconnect();
    refresh = setInterval(reconnect, 50 * 60 * 1000);
    const foreground = AppState.addEventListener("change", (value) => { if (value === "active") reconnect(); });
    return () => { alive = false; generation.current++; clearInterval(refresh); foreground.remove(); };
  }, [baseUrl, accessCode, signedIn]);

  return {
    ...state,
    setCallerId: (callerId) => setState((value) => ({ ...value, callerId })),
    async dial(to) {
      if (!state.ready || !voice.current) throw new Error(state.status || "Direct calling is not connected.");
      if (dialing.current || currentCall.current || invite.current) throw new Error("Finish the current call first.");
      dialing.current = true;
      const epoch = generation.current;
      try {
        if (Platform.OS === "android" && await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO) !== PermissionsAndroid.RESULTS.GRANTED) throw new Error("Microphone permission is required to call.");
        const credentials = await api("/api/voice/token", {});
        if (epoch !== generation.current) throw new Error("Please sign in again to call.");
        const call = await voice.current.connect(credentials.token, { contactHandle: to, notificationDisplayName: to, params: { To: to, CallerId: state.callerId } });
        if (epoch !== generation.current) { await call.disconnect(); return; }
        attachCall(call, to);
      } finally { dialing.current = false; }
    },
    async joinLive(call, mode = "listen") {
      if (!state.ready || !voice.current) throw new Error("Phone is not connected yet.");
      if (dialing.current || currentCall.current || invite.current) throw new Error("Finish or decline your current call first.");
      dialing.current = true;
      const epoch = generation.current;
      try {
        if (Platform.OS === "android" && await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO) !== PermissionsAndroid.RESULTS.GRANTED) throw new Error("Microphone permission is required to join a call.");
        const credentials = await api("/api/voice/token", {});
        if (epoch !== generation.current) throw new Error("Please sign in again.");
        const connected = await voice.current.connect(credentials.token, { contactHandle: call.phone || "Customer", notificationDisplayName: call.phone || "Customer", params: { LiveCallId: call.callId, LiveMode: mode } });
        if (epoch !== generation.current) { await connected.disconnect(); return; }
        attachCall(connected, call.phone || "Customer", { liveCallId: call.callId, mode });
      } finally { dialing.current = false; }
    },
    async takeOver() {
      if (!state.call?.liveCallId || !currentCall.current) throw new Error("Join the live call first.");
      await api(`/api/live-calls/${encodeURIComponent(state.call.liveCallId)}/takeover`, {});
      setState((value) => ({ ...value, call: { ...value.call, mode: "answer", status: "On call", muted: false } }));
    },
    async listenIncoming() {
      const incoming = invite.current;
      const params = incoming?.getCustomParameters() || {};
      if (!incoming || !params.liveCallId) throw new Error("Listening is not available for this call.");
      await api(`/api/live-calls/${encodeURIComponent(params.liveCallId)}/incoming-mode`, { mode: "listen" });
      inviteMode.current = "listen";
      attachCall(await incoming.accept(), params.customerPhone || incoming.getFrom(), { liveCallId: params.liveCallId, mode: "listen" });
    },
    async answer() { const incoming = invite.current; if (incoming) { const params = incoming.getCustomParameters() || {}; attachCall(await incoming.accept(), params.customerPhone || incoming.getFrom(), { liveCallId: params.liveCallId, mode: params.liveMode || "answer" }); } },
    async sendDigits(digits) { if (currentCall.current) await currentCall.current.sendDigits(digits); },
    async end() { if (invite.current && !currentCall.current) await invite.current.reject(); else await currentCall.current?.disconnect(); },
    async mute() { if (currentCall.current) { const muted = !state.call?.muted; await currentCall.current.mute(muted); setState((value) => ({ ...value, call: { ...value.call, muted } })); } },
    async audioRoute() { if (Platform.OS === "ios") await voice.current?.showAvRoutePickerView(); },
    async signOut() {
      generation.current++;
      await api("/api/voice/session", { active: false, signedOut: true }).catch(() => {});
      if (voice.current && token.current) await voice.current.unregister(token.current).catch(() => {});
      await currentCall.current?.disconnect().catch(() => {});
      voice.current?.removeAllListeners();
      voice.current = null;
      token.current = "";
      currentCall.current = null;
      setState({ ready: false, incomingReady: false, status: "Signed out", callerIds: [], callerId: "", call: null });
    }
  };
}
