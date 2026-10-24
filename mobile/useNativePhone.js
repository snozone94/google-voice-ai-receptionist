import { useEffect, useRef, useState } from "react";
import { AppState, PermissionsAndroid, Platform } from "react-native";
import Constants from "expo-constants";

export function useNativePhone({ baseUrl, accessCode, signedIn }) {
  const [state, setState] = useState({ ready: false, incomingReady: false, status: "Connecting phone", callerIds: [], callerId: "", call: null });
  const voice = useRef(null);
  const currentCall = useRef(null);
  const invite = useRef(null);
  const token = useRef("");
  const generation = useRef(0);
  const api = async (route, body) => {
    const response = await fetch(`${baseUrl}${route}`, { method: body ? "POST" : "GET", headers: { "Content-Type": "application/json", "x-staff-code": accessCode }, ...(body ? { body: JSON.stringify(body) } : {}) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Phone connection failed.");
    return data;
  };
  function attachCall(call, to = "Customer") {
    if (currentCall.current === call) return;
    currentCall.current = call;
    setState((value) => ({ ...value, call: { to, status: "Connecting", muted: false } }));
    call.on("ringing", () => setState((value) => ({ ...value, call: { ...value.call, status: "Ringing" } })));
    call.on("connected", () => setState((value) => ({ ...value, call: { ...value.call, status: "On call" } })));
    const ended = () => { currentCall.current = null; invite.current = null; setState((value) => ({ ...value, call: null })); };
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
        voice.current.on(Voice.Event.Error, (error) => setState((value) => ({ ...value, status: error.message || "Phone disconnected" })));
        voice.current.on(Voice.Event.CallInvite, (incoming) => {
          invite.current = incoming;
          const customer = incoming.getCustomParameters()?.customerPhone || incoming.getFrom() || "Customer";
          setState((value) => ({ ...value, call: { to: customer, status: "Incoming call", incoming: true } }));
          incoming.on("accepted", (call) => attachCall(call, customer));
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
    async call(to) {
      if (!state.ready || !voice.current) throw new Error(state.status || "Direct calling is not connected.");
      if (currentCall.current || invite.current) throw new Error("Finish the current call first.");
      if (Platform.OS === "android" && await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO) !== PermissionsAndroid.RESULTS.GRANTED) throw new Error("Microphone permission is required to call.");
      const credentials = await api("/api/voice/token", {});
      attachCall(await voice.current.connect(credentials.token, { params: { To: to, CallerId: state.callerId } }), to);
    },
    async answer() { const incoming = invite.current; if (incoming) attachCall(await incoming.accept(), incoming.getCustomParameters()?.customerPhone || incoming.getFrom()); },
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
