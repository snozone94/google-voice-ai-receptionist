import { mergeConversations, ownerLabel, needsReply, isOpenBooking, newestUnreadIndex, workspaceSummary, bookingOwnerLabel, bookingRequestedLabel, bookingStatusLabel, conversationPhone, canWork, ownershipActions, workspaceState, notificationDestination, validateReplyPolicy } from "./workspace-view";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import * as Device from "expo-device";
import { LinearGradient } from "expo-linear-gradient";
import * as Notifications from "expo-notifications";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNativePhone } from "./useNativePhone";
import { alertSounds, soundPackVersion, soundFile, soundChannel, createAlertChannels } from "./alert-sounds";
import { House, Phone, PhoneOff, MessageCircle, CalendarDays, UserRound, Mic, MicOff, Volume2, Ear, Grid3X3, Send, Sparkles, Captions, Music2, ChevronDown, Check, X } from "lucide-react-native";
import {
  ActivityIndicator,
  Alert,
  AppState,
  KeyboardAvoidingView,
  Image,
  Linking,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View
} from "react-native";

const defaultApiBaseUrl = process.env.EXPO_PUBLIC_DISPATCH_API_BASE_URL || "https://google-voice-ai-receptionist.onrender.com";
const apiStorageKey = "ddd-ai-dispatch-api-base-url";
const adminPinStorageKey = "ddd-ai-dispatch-admin-pin";
const staffPhoneStorageKey = "ddd-ai-dispatch-staff-phone";
const adminPrimaryTabs = [
  { name: "Home", color: "#9fc8ff" },
  { name: "Inbox", color: "#16b8ff" },
  { name: "Calls", color: "#ff7a3d" },
  { name: "Bookings", color: "#ffc83d" },
  { name: "More", label: "Account", color: "#ff3ea5" }
];
const staffPrimaryTabs = [
  { name: "Home", color: "#9fc8ff" },
  { name: "Inbox", color: "#16b8ff" },
  { name: "Calls", color: "#ff7a3d" },
  { name: "Bookings", color: "#ffc83d" },
  { name: "More", label: "Account", color: "#ff3ea5" }
];
const adminMoreTabs = [
  { name: "Insights", color: "#23c779", label: "Insights" },
  { name: "Settings", color: "#7657ff" },
  { name: "Team", color: "#23c779" },
  { name: "Voice", color: "#ff3ea5" },
  { name: "Script", color: "#ff7a3d", label: "AI Script" },
  { name: "Flows", color: "#ffc83d", label: "Questions" }
];
const rainbowColors = ["#7657ff", "#ff3ea5", "#ff7a3d", "#ffc83d", "#23c779", "#16b8ff", "#7657ff"];
const softRainbowColors = ["rgba(255, 62, 165, 0.16)", "rgba(255, 200, 61, 0.12)", "rgba(35, 199, 121, 0.12)", "rgba(22, 184, 255, 0.16)", "rgba(118, 87, 255, 0.14)"];

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true
  })
});

const billingLinks = [
  ["Twilio billing", "Top up phone and SMS", "https://console.twilio.com/us1/billing"],
  ["OpenAI billing", "Add AI credits", "https://platform.openai.com/settings/organization/billing/overview"],
  ["OpenAI usage", "Watch AI spend", "https://platform.openai.com/usage"],
  ["Render service", "Hosting and deploys", "https://dashboard.render.com/web/srv-da7ko42d0e5s73f6nqh0"]
];

const blankSettings = {
  enabled: true,
  voice: "marin",
  voiceSpeed: 1,
  voiceDirection: "",
  noiseHandling: {
    mode: "patient",
    eagerness: "low",
    interruptResponse: false,
    notes:
      "Let the receptionist finish short statements before listening. Ignore tiny background noises, road noise, breathing, and quick filler sounds unless the caller is clearly speaking."
  },
  greeting: "",
  businessKnowledge: "",
  serviceArea: "",
  pricingNotes: "",
  emergencyInstructions: "",
  humanHandoffRules: "",
  complaintInstructions: "",
  applyInstructions: "",
  offeredServices: "",
  notOfferedServices: "",
  directoryReferral: {
    enabled: false,
    url: "",
    message: ""
  },
  afterHoursInstructions: "",
  callOutcomeRules: "",
  fallbackRules: "",
  customInstructions: "",
  qualifyingServicesText: "",
  followUpStyle: "",
  outOfScopeHandling: "",
  bookingDestinationsText: "",
  humanRouting: {
    mode: "ai_then_humans",
    numbers: [],
    ringStyle: "simultaneous",
    timeoutSeconds: 22,
    callerMessage: "Please hold while I connect you with DDD.",
    fallbackMessage: "DDD could not reach the team live, but your call was logged. Please leave a message or text DDD and the team will follow up.",
    transferTriggers: []
  },
  smsFollowUp: {
    enabled: true,
    message:
      "Thanks for calling DDD. Reply with your service, vehicle, and location.\n\nBook online:\n{{link}}\n\nDDD Mobile for iPhone:\n{{iosAppLink}}\n\nDDD Mobile for Android:\n{{androidAppLink}}\n\nReply STOP to stop."
  },
  reviewFollowUp: {
    enabled: true,
    url: "https://g.page/r/CfVinSqxHOIDEAE/review",
    message: "Thanks again for choosing DDD. If everything went well, please leave a quick Google review here: {{reviewLink}}"
  },
  callerFlows: {
    newClients: "",
    existingClients: "",
    sales: "",
    otherCallers: ""
  },
  soundPreferences: {
    ambientSound: "none",
    thinkingSound: true,
    thinkingPhrase: "One moment while I get that into the request.",
    backgroundAudio: {
      enabled: false,
      mode: "off",
      label: "None",
      url: ""
    }
  },
  notificationPreferences: {
    newCalls: true,
    missedCalls: true,
    bookings: true,
    texts: true,
    qaIssues: true,
    dailySummary: true,
    weeklySummary: true,
    monthlySummary: true
  },
  voiceOptions: []
};

export default function App() {
  const [activeTab, setActiveTab] = useState("Home");
  const [dialRequest, setDialRequest] = useState(0);
  const [composeRequest, setComposeRequest] = useState(0);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [contactPhone, setContactPhone] = useState("");
  const [apiBaseUrl, setApiBaseUrl] = useState(defaultApiBaseUrl);
  const [savedApiBaseUrl, setSavedApiBaseUrl] = useState(defaultApiBaseUrl);
  const [adminPin, setAdminPin] = useState("");
  const [staffPhone, setStaffPhone] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [testing, setTesting] = useState(false);
  const [status, setStatus] = useState("");
  const [pushStatus, setPushStatus] = useState("Not enabled on this phone yet.");
  const [pushToken, setPushToken] = useState("");
  const [testCallerMessage, setTestCallerMessage] = useState("I have a flat tire and need help now.");
  const [testOutput, setTestOutput] = useState("");
  const [setup, setSetup] = useState(null);
  const [business, setBusiness] = useState(null);
  const [activity, setActivity] = useState(() => workspaceState());
  const [settings, setSettings] = useState(blankSettings);
  const [signedInStaff, setSignedInStaff] = useState(null);
  const [personalPrefs, setPersonalPrefs] = useState({ texts: true, missedCalls: true, bookings: true, qaIssues: true, newCalls: false, teamActivity: false, alertSound: "ddd-alert", callSound: "ddd-alert", timeSensitive: true });
  const [prefsLoaded, setPrefsLoaded] = useState(false);
  const autosaveTimerRef = useRef(null);
  const lastSavedSettingsRef = useRef("");
  const accessGenerationRef = useRef(0);
  const notificationEpochRef = useRef(0);

  const cleanBaseUrl = useMemo(() => normalizeBaseUrl(apiBaseUrl), [apiBaseUrl]);
  const isAdmin = isAdminStaff(signedInStaff);
  const phone = useNativePhone({ baseUrl: cleanBaseUrl, accessCode: adminPin, signedIn: canWork(signedInStaff), callSound: personalPrefs.callSound });
  const availableTabs = useMemo(() => (isAdmin ? adminPrimaryTabs : staffPrimaryTabs), [isAdmin]);
  const allowedTabNames = useMemo(
    () => new Set([...availableTabs, ...(isAdmin ? adminMoreTabs : [{ name: "Home" }, { name: "Insights" }])].map((tab) => tab.name)),
    [availableTabs, isAdmin]
  );

  const refreshOperations = useCallback(async (baseUrl = cleanBaseUrl, accessPin = adminPin) => {
    const targetBaseUrl = normalizeBaseUrl(baseUrl);
    if (!accessPin) return;
    const generation = accessGenerationRef.current;
    const operations = await loadOperations(targetBaseUrl, accessPin);
    if (generation !== accessGenerationRef.current) return;
    setActivity(workspaceState(operations));
    if (operations.staff?.ok) {
      setSignedInStaff(operations.staff);
    }
  }, [adminPin, cleanBaseUrl]);

  const loadAll = useCallback(async (baseUrl = cleanBaseUrl, accessPin = adminPin) => {
    const targetBaseUrl = normalizeBaseUrl(baseUrl);
    const generation = ++accessGenerationRef.current;
    setLoading(true);
    try {
      const access = accessPin ? await apiGet(targetBaseUrl, "/api/access-check", accessPin).catch(() => null) : null;
      if (generation !== accessGenerationRef.current) return;
      const operations = access?.ok ? await loadOperations(targetBaseUrl, accessPin).catch(() => null) : null;
      if (generation !== accessGenerationRef.current) return;
      if (!access?.ok) {
        setSignedInStaff(null);
        setActivity(workspaceState());
      }
      const [settingsResponse, setupResponse, businessResponse, callsResponse, leadsResponse, bookingsResponse, conversationsResponse, insightsResponse] =
        await Promise.all([
          apiGet(targetBaseUrl, "/api/settings", accessPin),
          apiGet(targetBaseUrl, "/api/setup-status"),
          apiGet(targetBaseUrl, "/api/business"),
          access?.ok ? apiGet(targetBaseUrl, "/api/call-log", accessPin).catch(() => ({ calls: [] })) : { calls: [] },
          access?.ok ? apiGet(targetBaseUrl, "/api/leads", accessPin).catch(() => ({ leads: [] })) : { leads: [] },
          access?.ok ? apiGet(targetBaseUrl, "/api/bookings", accessPin).catch(() => ({ bookings: [] })) : { bookings: [] },
          access?.ok ? apiGet(targetBaseUrl, "/api/conversations", accessPin).catch(() => ({ conversations: [], locked: true })) : { conversations: [], locked: true },
          access?.ok ? apiGet(targetBaseUrl, "/api/insights", accessPin).catch(() => null) : null
        ]);
      if (generation !== accessGenerationRef.current) return;
      const nextSettings = toFormSettings(settingsResponse);
      setSettings(nextSettings);
      lastSavedSettingsRef.current = JSON.stringify(fromFormSettings(nextSettings));
      setSetup(setupResponse);
      setBusiness(businessResponse);
      setActivity(workspaceState({
        calls: callsResponse.calls || [],
        leads: leadsResponse.leads || [],
        bookings: bookingsResponse.bookings || [],
        conversations: conversationsResponse.conversations || [],
        insights: insightsResponse || null,
        ...(operations || {})
      }, access));
      if (accessPin) {
        setSignedInStaff(access?.ok ? access : null);
        setStatus(access?.ok ? `Signed in as ${access.name || "DDD team"} (${access.role || "staff"}).` : "Connected. Code not recognized yet.");
        if (access?.ok) {
          await AsyncStorage.setItem(adminPinStorageKey, accessPin);
          enablePushNotifications(accessPin, { quiet: true }).catch(() => {});
        }
      } else {
        setSignedInStaff(null);
        setStatus(conversationsResponse.locked ? "Connected. Enter admin or tech code to load inbox." : "Connected to DDD AI Dispatch.");
      }
    } catch (error) {
      setStatus(error.message);
    } finally {
      setLoading(false);
    }
  }, [adminPin, cleanBaseUrl]);

  useEffect(() => {
    let mounted = true;
    Promise.all([AsyncStorage.getItem(apiStorageKey), AsyncStorage.getItem(adminPinStorageKey), AsyncStorage.getItem(staffPhoneStorageKey)])
      .then(([value, savedPin, savedStaffPhone]) => {
        if (!mounted) return;
        const nextUrl = normalizeBaseUrl(value || defaultApiBaseUrl);
        setApiBaseUrl(nextUrl);
        setSavedApiBaseUrl(nextUrl);
        setAdminPin(savedPin || "");
        setStaffPhone(savedStaffPhone || "");
        loadAll(nextUrl, savedPin || "");
      })
      .catch(() => loadAll(defaultApiBaseUrl));
    return () => {
      mounted = false;
      clearTimeout(autosaveTimerRef.current);
    };
  }, []);

  useEffect(() => {
    AsyncStorage.getItem("ddd-notification-preferences").then((value) => {
      if (value) setPersonalPrefs((current) => ({ ...current, ...JSON.parse(value) }));
    }).catch(() => {}).finally(() => setPrefsLoaded(true));
  }, []);
  useEffect(() => {
    if (!prefsLoaded) return;
    AsyncStorage.setItem("ddd-notification-preferences", JSON.stringify(personalPrefs)).catch(() => {});
    if (pushToken && signedInStaff?.ok) apiPost(cleanBaseUrl, "/api/push/register", { token: pushToken, platform: Platform.OS, preferences: { ...personalPrefs, soundPackVersion } }, adminPin).catch((error) => setPushStatus(error.message));
  }, [personalPrefs, prefsLoaded, pushToken, signedInStaff?.ok, cleanBaseUrl, adminPin]);

  useEffect(() => {
    if (!editMode || loading) return;
    const serialized = JSON.stringify(fromFormSettings(settings));
    if (!lastSavedSettingsRef.current || serialized === lastSavedSettingsRef.current) return;
    clearTimeout(autosaveTimerRef.current);
    setStatus("Unsaved changes...");
    autosaveTimerRef.current = setTimeout(() => {
      saveSettings("auto").catch(() => {});
    }, 900);
  }, [settings, editMode, loading]);

  useEffect(() => {
    if (!adminPin || editMode || saving) return undefined;
    const interval = setInterval(() => {
      refreshOperations(cleanBaseUrl, adminPin).catch(() => {});
    }, 10000);
    return () => clearInterval(interval);
  }, [adminPin, cleanBaseUrl, editMode, refreshOperations, saving]);

  useEffect(() => {
    if (!allowedTabNames.has(activeTab)) {
      setActiveTab("Inbox");
    }
  }, [activeTab, allowedTabNames]);

  useEffect(() => {
    if (!pushToken || !adminPin || Platform.OS === "web") return;
    const refresh = () => refreshOperations(cleanBaseUrl, adminPin).catch(() => {});
    refresh();
    const listener = AppState.addEventListener("change", (state) => {
      if (state === "active") refresh();
    });
    const received = Notifications.addNotificationReceivedListener(() => {
      if (AppState.currentState === "active") refresh();
    });
    return () => { listener.remove(); received.remove(); };
  }, [pushToken, adminPin, cleanBaseUrl, refreshOperations]);

  // Notification responses only select a screen. They never invoke a call or mutation.
  const lastNotificationRef = useRef("");
  useEffect(() => {
    if (Platform.OS === "web") return;
    let alive = true;
    const navigate = (response) => {
      if (!alive || !response?.notification) return;
      const id = response.notification.request.identifier;
      if (id && lastNotificationRef.current === id) return;
      lastNotificationRef.current = id || "";
      const target = notificationDestination(response.notification.request.content.data);
      setNotificationOpen(true);
      setComposeRequest(0); setDialRequest(0); setContactPhone(target.phone); setActiveTab(target.tab);
    };
    const listener = Notifications.addNotificationResponseReceivedListener(navigate);
    const epoch = notificationEpochRef.current;
    Notifications.getLastNotificationResponseAsync().then(response => { if (epoch === notificationEpochRef.current) navigate(response); }).catch(() => {});
    return () => { alive = false; listener.remove(); };
  }, []);
  useEffect(() => {
    if (Platform.OS !== "web") Notifications.setBadgeCountAsync(activity.attention?.count || 0).catch(() => {});
  }, [activity.attention?.count]);

  async function saveBaseUrl() {
    const next = normalizeBaseUrl(apiBaseUrl);
    await AsyncStorage.setItem(apiStorageKey, next);
    setApiBaseUrl(next);
    setSavedApiBaseUrl(next);
    setStatus("Backend URL saved.");
    loadAll(next, adminPin);
  }

  async function saveSettings(reason = "manual") {
    setSaving(true);
    try {
      const saved = await apiPost(cleanBaseUrl, "/api/settings", fromFormSettings(settings), adminPin);
      const formSettings = toFormSettings(saved);
      setSettings(formSettings);
      lastSavedSettingsRef.current = JSON.stringify(fromFormSettings(formSettings));
      setStatus(saved.enabled
        ? `${reason === "auto" ? "Autosaved" : "Saved"}. AI is answering new calls.`
        : `${reason === "auto" ? "Autosaved" : "Saved"}. AI answering is paused.`
      );
    } catch (error) {
      setStatus(error.message.includes("Forbidden") ? "Enter the real admin code before saving settings." : error.message);
    } finally {
      setSaving(false);
    }
  }

  async function previewVoice() {
    setPreviewing(true);
    try {
      const audioUri = `${cleanBaseUrl}/api/voice-preview.mp3?${new URLSearchParams({
        voice: settings.voice,
        voiceSpeed: String(settings.voiceSpeed),
        voiceDirection: settings.voiceDirection || "",
        text: settings.greeting || "Thank you for calling Triple D Roadside. How can I help today?",
        t: String(Date.now())
      }).toString()}`;
      const canOpen = await Linking.canOpenURL(audioUri);
      if (!canOpen) throw new Error("This phone cannot open the voice preview link.");
      await Linking.openURL(audioUri);
      setStatus("Voice preview opened.");
    } catch (error) {
      setStatus(error.message);
    } finally {
      setPreviewing(false);
    }
  }

  async function runFreeTest() {
    setTesting(true);
    setTestOutput("Testing...");
    try {
      const result = await apiPost(cleanBaseUrl, "/api/test-script", { callerMessage: testCallerMessage });
      setTestOutput(
        [
          `Intent: ${result.intent || "unknown"}`,
          result.destination ? `Best link: ${result.destination.label}\n${result.destination.url}` : "Best link: none selected",
          "",
          result.likelyReply || "",
          "",
          result.note || ""
        ].join("\n")
      );
      setStatus("Free test complete. No phone call was placed.");
    } catch (error) {
      setTestOutput(error.message);
      setStatus(error.message);
    } finally {
      setTesting(false);
    }
  }

  async function enablePushNotifications(accessPin = adminPin, options = {}) {
    const quiet = Boolean(options.quiet);
    if (Platform.OS === "web") {
      if (!quiet) setPushStatus("Open the iPhone app build to enable native push notifications.");
      return;
    }

    if (!quiet) setPushStatus("Requesting notification permission...");
    try {
      if (Platform.OS === "android") {
        await createAlertChannels(Notifications);
        await Notifications.setNotificationChannelAsync("ddd-dispatch", {
          name: "DDD Dispatch",
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: "#ff3ea5"
        });
      }

      const existing = await Notifications.getPermissionsAsync();
      let finalStatus = existing.status;
      if (existing.status !== "granted") {
        const requested = await Notifications.requestPermissionsAsync({ ios: { allowAlert: true, allowBadge: true, allowSound: true } });
        finalStatus = requested.status;
      }
      if (finalStatus !== "granted") {
        setPushStatus("Notifications were not allowed on this phone.");
        return;
      }
      if (!Device.isDevice) {
        if (!quiet) setPushStatus("Permission is on. Remote push tokens need a real iPhone build.");
        return;
      }

      const projectId = Constants.expoConfig?.extra?.eas?.projectId || Constants.easConfig?.projectId;
      const tokenResponse = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
      const token = tokenResponse.data;
      setPushToken(token);
      await apiPost(cleanBaseUrl, "/api/push/register", {
        token,
        platform: Platform.OS,
        staffPhone,
        preferences: { ...personalPrefs, soundPackVersion }
      }, accessPin);
      setPushStatus("Native push is connected on this phone.");
      if (!quiet) setStatus("Push notifications connected.");
    } catch (error) {
      setPushStatus(error.message);
      setStatus(error.message);
    }
  }

  async function previewAlertSound(id) {
    if (phone.call) return setPushStatus("Finish the current call before previewing a sound.");
    if (Platform.OS === "web" || Constants.appOwnership === "expo" || Constants.executionEnvironment === "storeClient") return setPushStatus("Custom sounds are available in the installed app build.");
    try {
      if (Platform.OS === "android") await createAlertChannels(Notifications);
      let permission = await Notifications.getPermissionsAsync();
      if (permission.status !== "granted") permission = await Notifications.requestPermissionsAsync({ ios: { allowAlert: true, allowBadge: true, allowSound: true } });
      if (permission.status !== "granted") return setPushStatus("Allow notification sounds in your phone settings to preview this alert.");
      await Notifications.scheduleNotificationAsync({ content: { title: "DDD sound preview", body: alertSounds.find((sound) => sound.id === id)?.label || "System alert", sound: id === "silent" ? null : soundFile(id), interruptionLevel: "active" }, trigger: Platform.OS === "android" ? { channelId: soundChannel(id) } : null });
      setPushStatus("Preview sent to this phone.");
    } catch (error) { setPushStatus(error.message); }
  }

  async function sendTestNotification() {
    try {
      if (Platform.OS !== "web") {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: "DDD AI Dispatch",
            body: "This is how new call and text alerts will show on your phone.",
            sound: personalPrefs.alertSound === "silent" ? null : soundFile(personalPrefs.alertSound),
            interruptionLevel: personalPrefs.timeSensitive !== false ? "timeSensitive" : "active",
            data: { type: "local-test" }
          },
          trigger: Platform.OS === "android" ? { channelId: soundChannel(personalPrefs.alertSound) } : null
        });
      }
      if (adminPin) {
        const result = await apiPost(cleanBaseUrl, "/api/push/test", {}, adminPin);
        setPushStatus(result.sent ? `Test push sent to ${result.sent} phone${result.sent === 1 ? "" : "s"}.` : "No registered phones yet. Enable push in the iPhone app first.");
      } else {
        setPushStatus("Local test shown. Enter the real admin code to send a server test.");
      }
    } catch (error) {
      setPushStatus(error.message);
    }
  }

  const renderedGeneration = accessGenerationRef.current;
  const refreshWorkspace = () => { if (renderedGeneration === accessGenerationRef.current) return loadAll(cleanBaseUrl, adminPin); };
  const setSessionStatus = (message) => { if (renderedGeneration === accessGenerationRef.current) setStatus(message); };
  const WorkspaceContent = activeTab === "Inbox" ? View : ScrollView;
  async function signOut() {
    notificationEpochRef.current += 1;
    const oldToken = pushToken;
    const oldPin = adminPin;
    accessGenerationRef.current += 1;
    clearTimeout(autosaveTimerRef.current);
    setAdminPin(""); setSignedInStaff(null); setPushToken("");
    setActivity(workspaceState()); setSettings(blankSettings); setSetup(null); setBusiness(null);
    setNotificationOpen(false);
    setContactPhone(""); setComposeRequest(0); setDialRequest(0); setActiveTab("Home");
    setEditMode(false); setStatus(""); setTestOutput(""); setStaffPhone("");
    setPushStatus("Not enabled on this phone yet.");
    setLoading(true);
    await Promise.allSettled([AsyncStorage.removeItem(adminPinStorageKey), phone.signOut(), ...(oldToken ? [apiPost(cleanBaseUrl, "/api/push/unregister", { token: oldToken }, oldPin)] : [])]);
    setLoading(false);
  }
  if (!signedInStaff?.ok) return <StaffLogin code={adminPin} onCode={setAdminPin} loading={loading} status={status} onSignIn={() => loadAll(cleanBaseUrl, adminPin)} />;
  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="light" />
      <LinearGradient colors={["#081426", "#10243a", "#081426"]} style={styles.shell}>
        <Header business={business} settings={settings} signedInStaff={signedInStaff} onProfile={() => setActiveTab("More")} onAlerts={() => enablePushNotifications()} />
        {canWork(signedInStaff) && phone.call ? <NativeCallBar phone={phone} onError={setSessionStatus} onTranscript={() => setActiveTab("Calls")} /> : null}

        <WorkspaceContent style={activeTab === "Inbox" ? styles.inboxContent : { flex: 1 }} contentContainerStyle={activeTab === "Inbox" ? undefined : styles.content} showsVerticalScrollIndicator={false}>
          {activeTab === "Calls" && phone.call && !phone.call.liveCallId && phone.call.callSid ? <ActiveCallTranscript baseUrl={cleanBaseUrl} accessCode={adminPin} callId={phone.call.callSid} /> : null}
          {activeTab === "Home" ? <WorkspaceHome staff={signedInStaff} onDial={() => { setDialRequest(Date.now()); setActiveTab("Calls"); }} activity={activity} isAdmin={isAdmin} onSelect={setActiveTab} onNewText={() => { setContactPhone(""); setComposeRequest(Date.now()); setActiveTab("Inbox"); }} onThread={(number) => { setContactPhone(number); setActiveTab("Inbox"); }} /> : null}
          {canWork(signedInStaff) && ["Home", "Calls"].includes(activeTab) ? <LiveCallsPanel baseUrl={cleanBaseUrl} accessCode={adminPin} phone={phone} onError={setSessionStatus} onText={(number) => { setContactPhone(number); setActiveTab("Inbox"); }} /> : null}
          {isAdmin && activeTab === "Settings" ? (
            <SettingsTab
              adminPin={adminPin}
              apiBaseUrl={apiBaseUrl}
              activity={activity}
              editMode={editMode}
              loading={loading}
              savedApiBaseUrl={savedApiBaseUrl}
              saving={saving}
              setup={setup}
              settings={settings}
              setAdminPin={setAdminPin}
              setApiBaseUrl={setApiBaseUrl}
              setEditMode={setEditMode}
              setStaffPhone={setStaffPhone}
              setSettings={setSettings}
              signedInStaff={signedInStaff}
              staffPhone={staffPhone}
              pushStatus={pushStatus}
              pushToken={pushToken}
              isAdmin={isAdmin}
              onEnablePush={() => enablePushNotifications()}
              onRefresh={refreshWorkspace}
              onSaveBaseUrl={saveBaseUrl}
              onSaveSettings={() => saveSettings("manual")}
              onUnlockAdmin={() => loadAll(cleanBaseUrl, adminPin)}
              onSignOut={signOut}
              onSendTestNotification={sendTestNotification}
            />
          ) : null}

          {isAdmin && activeTab === "Voice" ? (
            <VoiceTab editMode={editMode} previewing={previewing} settings={settings} setSettings={setSettings} onPreviewVoice={previewVoice} />
          ) : null}

          {isAdmin && activeTab === "Script" ? (
            <ScriptTab
              editMode={editMode}
              settings={settings}
              setSettings={setSettings}
              testCallerMessage={testCallerMessage}
              testOutput={testOutput}
              testing={testing}
              setTestCallerMessage={setTestCallerMessage}
              onRunFreeTest={runFreeTest}
            />
          ) : null}

          {isAdmin && activeTab === "Flows" ? <FlowsTab editMode={editMode} settings={settings} setSettings={setSettings} /> : null}
          {isAdmin && activeTab === "Team" ? (
            <TeamTab
              adminPin={adminPin}
              editMode={editMode}
              saving={saving}
              settings={settings}
              setEditMode={setEditMode}
              setSettings={setSettings}
              signedInStaff={signedInStaff}
              onSaveSettings={() => saveSettings("manual")}
            />
          ) : null}
          {activeTab === "Inbox" ? (
            <InboxTab
              notificationOnly={notificationOpen}
              initialPhone={contactPhone}
              adminPin={adminPin}
              apiBaseUrl={cleanBaseUrl}
              conversations={mergeConversations(activity.conversations, activity.calls, activity.bookings)}
              staff={signedInStaff}
              team={activity.team || []}
              composeRequest={composeRequest}
              isAdmin={isAdmin}
              hasPin={Boolean(adminPin)}
              onRefresh={refreshWorkspace}
              setStatus={setSessionStatus}
              settings={settings}
              staffPhone={staffPhone}
              nativePhone={phone}
            />
          ) : null}
          {activeTab === "Calls" ? (
            <CallsTab
              staff={signedInStaff}
              dialRequest={dialRequest}
              adminPin={adminPin}
              apiBaseUrl={cleanBaseUrl}
              calls={activity.calls}
              insights={activity.insights}
              onText={(phone) => { setContactPhone(phone); setActiveTab("Inbox"); }}
              setStatus={setSessionStatus}
              setStaffPhone={setStaffPhone}
              staffPhone={staffPhone}
              nativePhone={phone}
            />
          ) : null}
          {activeTab === "Bookings" ? signedInStaff?.ok ? <BookingsTab bookings={activity.bookings} /> : <Card title="Staff sign-in required"><Text style={styles.muted}>Sign in with your DDD staff code to view bookings.</Text><ActionButton label="Sign in" onPress={() => setActiveTab("Home")} /></Card> : null}
          {activeTab === "Insights" ? (
            <InsightsTab
              calls={activity.calls}
              hasPin={Boolean(adminPin)}
              insights={activity.insights}
              onRefresh={refreshWorkspace}
            />
          ) : null}
          {activeTab === "More" ? <AccountPanel staff={signedInStaff} phone={phone} preferences={personalPrefs} setPreferences={setPersonalPrefs} onEnablePush={() => enablePushNotifications()} onPreviewSound={previewAlertSound} pushStatus={pushStatus} onSignOut={signOut} isAdmin={isAdmin} onSelect={setActiveTab} baseUrl={cleanBaseUrl} accessCode={adminPin} /> : null}

          {loading ? <ActivityIndicator color="#7d4dff" /> : null}
          <Text style={styles.status}>{status}</Text>
        </WorkspaceContent>
        <BottomTabs activeTab={activeTab} onSelect={(tab) => { setComposeRequest(0); setDialRequest(0); setActiveTab(tab); }} tabs={availableTabs} unread={(activity.conversations || []).reduce((sum, conversation) => sum + (conversation.unread || 0), 0)} />
      </LinearGradient>
    </SafeAreaView>
  );
}

function WorkspaceHome({ staff, activity, isAdmin, onSelect, onNewText, onDial, onThread }) {
  const summary = workspaceSummary(activity);
  const tasks = Array.isArray(activity.tasks) ? activity.tasks : mergeConversations(activity.conversations).filter(needsReply).map(item => ({ phone: item.phone, reason: item.followUpReason || "Needs reply", assignedTo: ownerLabel(item) }));
  const replyPolicy = activity.replyPolicy;
  return <>
    <Text style={styles.screenHeading}>Home</Text>
    <Card title="Today">
      <View style={styles.metricStrip}>
        {[["Active calls", summary.activeCalls, "Calls"], ["Unread", summary.unreadMessages, "Inbox"], ["Needs reply", summary.needsReply, "Inbox"], ["Open today", summary.todayOpenBookings, "Bookings"]].map(([label, value, target]) => <Pressable key={label} accessibilityRole="button" accessibilityLabel={`${label}: ${value}`} onPress={() => onSelect(target)} style={styles.metric}><Text style={styles.metricLabel}>{label}</Text><Text style={styles.metricValue}>{value}</Text></Pressable>)}
      </View>
      <Text style={styles.record}>{summary.openBookings} open bookings{summary.overdueReplies != null ? ` · ${summary.overdueReplies} overdue replies` : ""}</Text>
      <View style={styles.buttonRow}><ActionButton disabled={!canWork(staff)} label="New text" onPress={onNewText} /><ActionButton disabled={!canWork(staff)} label="Dial" onPress={onDial} variant="light" /><ActionButton disabled={!canWork(staff)} label="Listen / Answer" onPress={() => onSelect("Calls")} variant="light" /></View>
    </Card>
    <Card title="Needs attention">
      {tasks.length ? tasks.map((task, index) => <Pressable key={`${task.phone}-${index}`} accessibilityRole="button" disabled={!task.phone} onPress={() => onThread(task.phone)} style={styles.listCard}><Text style={styles.listTitle}>{formatPhone(task.phone) || "Customer"}</Text><Text style={styles.record}>{task.reason || "Needs reply"} · {ownerLabel(task)}</Text><Text style={styles.muted}>{task.minutesWaiting != null ? `${task.minutesWaiting} min waiting` : "Waiting for follow-up"}{task.priority ? ` · ${task.priority}` : ""}</Text></Pressable>) : <Text style={styles.record}>You're caught up.</Text>}
    </Card>
    {replyPolicy ? <Card title="Reply guidance"><Text style={styles.record}>{typeof replyPolicy === "string" ? replyPolicy : replyPolicy.message || replyPolicy.description || (replyPolicy.remindAfterMinutes != null ? `Reminder after ${replyPolicy.remindAfterMinutes} min · Escalation after ${replyPolicy.escalateAfterMinutes} min` : "Follow up with waiting customers.")}</Text></Card> : null}
    {isAdmin && activity.health ? <Card title="Service status">{Object.entries(activity.health).map(([key, value]) => <Text key={key} style={styles.record}>{value?.label || key.replace(/([a-z])([A-Z])/g, "$1 $2")}: {typeof value === "object" && value ? value.message || value.status || (value.ok === true ? "Available" : "Check service") : String(value)}</Text>)}</Card> : null}
  </>;
}

function StaffLogin({ code, onCode, loading, status, onSignIn }) {
  return <SafeAreaView style={{ flex: 1, backgroundColor: "#191d24" }}><StatusBar style="light" /><KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1, justifyContent: "center", padding: 28 }}>
    <Image source={require("./assets/icon.png")} style={{ width: 72, height: 72, borderRadius: 16, marginBottom: 20 }} />
    <Text style={{ color: "#f5f7fa", fontSize: 28, fontWeight: "800", marginBottom: 28 }}>DDD Dispatch</Text>
    <Text style={{ color: "#d8e1e8", marginBottom: 8, fontSize: 15 }}>Staff access code</Text>
    <TextInput value={code} onChangeText={onCode} secureTextEntry autoCapitalize="none" autoCorrect={false} accessibilityLabel="Staff access code" placeholder="Enter your code" placeholderTextColor="#a1adb9" style={{ backgroundColor: "#2b333d", color: "#fff", padding: 16, borderRadius: 8, fontSize: 18, marginBottom: 12 }} onSubmitEditing={onSignIn} />
    <ActionButton disabled={loading || !code.trim()} label={loading ? "Signing in..." : "Sign in"} onPress={onSignIn} />
    {!loading && /not recognized|could not|failed|forbidden/i.test(status || "") ? <Text style={{ color: "#ffb8b8", marginTop: 12 }}>Couldn't sign in. Check your code and connection.</Text> : null}
  </KeyboardAvoidingView></SafeAreaView>;
}

function NativeCallBar({ phone, onError, onTranscript }) {
  const [keypad, setKeypad] = useState(false);
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer); }, []);
  const run = (operation) => operation().catch((error) => onError(error.message));
  const duration = phone.call.connectedAt ? formatDuration(Math.max(0, Math.floor((now - Date.parse(phone.call.connectedAt)) / 1000))) : "";
  const Control = ({ label, Icon, action, danger, disabled }) => <Pressable disabled={disabled} accessibilityRole="button" accessibilityLabel={label} onPress={() => run(action)} style={{ alignItems: "center", justifyContent: "center", minWidth: 64, minHeight: 54, gap: 4, opacity: disabled ? 0.4 : 1 }}><View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: danger ? "#d93458" : "#314450", alignItems: "center", justifyContent: "center" }}><Icon size={18} color="#fff" /></View><Text style={{ fontSize: 11, color: "#eff7fa" }}>{label}</Text></Pressable>;
  return <View style={{ backgroundColor: "#142b32", paddingHorizontal: 16, paddingVertical: 10, gap: 8 }}>
    <Text style={{ color: "#fff", fontWeight: "700", fontSize: 18 }}>{formatPhone(phone.call.to) || "Customer"}</Text>
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}><Text style={{ color: "#a7d8ca", fontSize: 12, flex: 1 }}>{phone.call.status || "Connecting"}{duration ? ` · ${duration}` : ""}{phone.call.mode === "listen" ? " · Your microphone is off" : ""}</Text><Pressable accessibilityRole="button" accessibilityLabel="Read live call transcript" onPress={onTranscript} style={{ flexDirection: "row", alignItems: "center", gap: 6, padding: 8, minHeight: 40 }}><Captions size={18} color="#9ce8ee" /><Text style={{ color: "#c2f5f5", fontWeight: "700" }}>Transcript</Text></Pressable></View>
    <View style={{ flexDirection: "row", justifyContent: "space-around" }}>
      {phone.call.incoming ? <><Control label="Answer" Icon={Phone} action={phone.answer} />{phone.call.liveCallId ? <Control label="Listen" Icon={Ear} action={phone.listenIncoming} /> : null}</> : phone.call.mode === "listen" ? <Control label="Take over" Icon={Phone} action={phone.takeOver} /> : <Control label={phone.call.muted ? "Unmute" : "Mute"} Icon={phone.call.muted ? MicOff : Mic} action={phone.mute} />}
      {!phone.call.incoming ? <><Control label="Speaker" Icon={Volume2} action={phone.audioRoute} /><Control label="Keypad" Icon={Grid3X3} action={async () => setKeypad((value) => !value)} disabled={phone.call.mode === "listen"} /></> : null}
      <Control label={phone.call.incoming ? "Decline" : phone.call.mode === "listen" ? "Leave" : "End"} Icon={PhoneOff} action={phone.end} danger />
    </View>
    {keypad && !phone.call.incoming ? <View style={{ flexDirection: "row", flexWrap: "wrap" }}>{["1", "2", "3", "4", "5", "6", "7", "8", "9", "*", "0", "#"].map((digit) => <Pressable key={digit} accessibilityRole="button" accessibilityLabel={`Send ${digit}`} onPress={() => run(() => phone.sendDigits(digit))} style={{ width: "33.33%", height: 38, alignItems: "center", justifyContent: "center" }}><Text style={{ color: "#fff", fontSize: 20 }}>{digit}</Text></Pressable>)}</View> : null}
  </View>;
}

function SoundPicker({ label, value, onChange, onPreview, disabled = false, allowSilent = false }) {
  const [open, setOpen] = useState(false);
  const choices = [...alertSounds, { id: "system", label: "System sound" }, ...(allowSilent ? [{ id: "silent", label: "Silent" }] : [])];
  const selected = choices.find((sound) => sound.id === value) || choices[0];
  return <View style={{ gap: 8, paddingVertical: 10 }}>
    <Text style={styles.label}>{label}</Text>
    <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}><Pressable disabled={disabled} accessibilityRole="button" accessibilityLabel={`${label}: ${selected.label}`} accessibilityState={{ disabled, expanded: open }} onPress={() => setOpen(true)} style={{ flex: 1, flexDirection: "row", alignItems: "center", minHeight: 48, padding: 12, gap: 8, backgroundColor: "#e6eef0", borderRadius: 8, opacity: disabled ? 0.5 : 1 }}><Music2 size={20} color="#9b167b" /><Text style={{ flex: 1, color: "#1d2934", fontWeight: "700" }}>{selected.label}</Text><ChevronDown size={18} color="#253947" /></Pressable><Pressable disabled={disabled} accessibilityRole="button" accessibilityLabel={`Preview ${selected.label}`} onPress={() => onPreview(selected.id)} style={{ width: 48, height: 48, alignItems: "center", justifyContent: "center", opacity: disabled ? 0.5 : 1 }}><Volume2 size={22} color="#ae2488" /></Pressable></View>
    <Modal transparent visible={open} animationType="fade" onRequestClose={() => setOpen(false)}><View style={{ flex: 1, backgroundColor: "rgba(5,12,24,.75)", justifyContent: "center", padding: 20 }}><View accessibilityViewIsModal style={{ padding: 16, backgroundColor: "#f1f6f8", borderRadius: 8, maxHeight: "85%" }}><View style={{ flexDirection: "row", alignItems: "center", marginBottom: 8 }}><Text style={{ flex: 1, fontWeight: "800", fontSize: 19, color: "#1a2636" }}>{label}</Text><Pressable accessibilityRole="button" accessibilityLabel="Close sound choices" onPress={() => setOpen(false)} style={{ padding: 10 }}><X size={22} color="#263849" /></Pressable></View><ScrollView>{choices.map((sound) => <Pressable accessibilityRole="radio" accessibilityState={{ selected: selected.id === sound.id }} key={sound.id} onPress={() => { onChange(sound.id); setOpen(false); }} style={{ minHeight: 52, paddingVertical: 14, paddingHorizontal: 8, borderBottomWidth: 1, borderBottomColor: "#d4dde4", flexDirection: "row", gap: 10 }}><Text style={{ color: "#273746", flex: 1, fontWeight: selected.id === sound.id ? "800" : "500" }}>{sound.label}</Text>{selected.id === sound.id ? <Check size={20} color="#008778" /> : null}</Pressable>)}</ScrollView></View></View></Modal>
  </View>;
}

function ReplyPolicyPanel({ baseUrl, accessCode }) {
  const [remind, setRemind] = useState("");
  const [escalate, setEscalate] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  useEffect(() => {
    let alive = true;
    setLoaded(false);
    apiGet(baseUrl, "/api/admin/reply-policy", accessCode).then(response => {
      if (!alive) return;
      const policy = validateReplyPolicy(response.replyPolicy || response);
      setRemind(String(policy.remindAfterMinutes)); setEscalate(String(policy.escalateAfterMinutes)); setLoaded(true);
    }).catch(() => { if (alive) setMessage("Couldn't load reply reminders. Reopen Account to retry."); });
    return () => { alive = false; };
  }, [baseUrl, accessCode]);
  const save = async () => {
    setMessage("");
    try {
      const policy = validateReplyPolicy({ remindAfterMinutes: remind, escalateAfterMinutes: escalate });
      setBusy(true);
      const response = await apiPost(baseUrl, "/api/admin/reply-policy", policy, accessCode);
      const saved = validateReplyPolicy(response.replyPolicy || policy);
      setRemind(String(saved.remindAfterMinutes)); setEscalate(String(saved.escalateAfterMinutes)); setMessage("Reply reminders saved.");
    } catch (error) { setMessage(error.message); }
    finally { setBusy(false); }
  };
  return <Card title="Reply reminders"><Text style={styles.record}>Choose when waiting customers trigger a reminder and an escalation.</Text><Field label="Remind after (minutes)" keyboardType="number-pad" editable={loaded && !busy} value={remind} onChangeText={setRemind} /><Field label="Escalate after (minutes)" keyboardType="number-pad" editable={loaded && !busy} value={escalate} onChangeText={setEscalate} /><ActionButton label={busy ? "Saving..." : "Save reminders"} disabled={!loaded || busy} onPress={save} />{message ? <Text accessibilityLiveRegion="polite" style={styles.record}>{message}</Text> : null}</Card>;
}

function AccountPanel({ baseUrl, accessCode, staff, phone, preferences, setPreferences, onEnablePush, onPreviewSound, pushStatus, onSignOut, isAdmin, onSelect }) {
  return <>
    <Text style={styles.screenHeading}>{staff.name}</Text><Text style={styles.muted}>{isAdmin ? "Administrator" : "Technician"}</Text>
    <Card title="Business phone"><Text style={styles.record}>{phone.status}</Text>{phone.callerIds.length > 1 ? <View style={styles.buttonRow}>{phone.callerIds.map((id) => <ActionButton key={id} label={formatPhone(id)} onPress={() => phone.setCallerId(id)} variant={id === phone.callerId ? undefined : "light"} />)}</View> : null}</Card>
    <Card title="Notifications"><ActionButton label="Enable notifications" onPress={onEnablePush} /><Text style={styles.muted}>{pushStatus}</Text>
      <SoundPicker label="Notification sound" value={preferences.alertSound} allowSilent onChange={(alertSound) => setPreferences((current) => ({ ...current, alertSound }))} onPreview={onPreviewSound} disabled={Boolean(phone.call)} />
      <SoundPicker label="Incoming call ringtone" value={preferences.callSound} onChange={(callSound) => setPreferences((current) => ({ ...current, callSound }))} onPreview={onPreviewSound} disabled={Boolean(phone.call)} />
      <View style={{ flexDirection: "row", alignItems: "center", paddingVertical: 10, gap: 8 }}><Text style={[styles.record, { flex: 1 }]}>Time-sensitive customer alerts</Text><Switch value={preferences.timeSensitive !== false} onValueChange={(timeSensitive) => setPreferences((current) => ({ ...current, timeSensitive }))} /></View>
      <Text style={styles.muted}>Critical Alerts: Apple approval required.</Text>
      {[["texts", "Customer messages"], ["missedCalls", "Missed calls & unfinished requests"], ["bookings", "New bookings"], ["qaIssues", "Delivery & service problems"], ["newCalls", "Every incoming call"], ["teamActivity", "Team replies & call activity"]].map(([key, label]) => <View key={key} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 10, gap: 8 }}><Text style={[styles.record, { flex: 1 }]}>{label}</Text><Switch value={Boolean(preferences[key])} onValueChange={(value) => setPreferences((current) => ({ ...current, [key]: value }))} /></View>)}
    </Card>
    <ActionButton label="Insights" variant="light" onPress={() => onSelect("Insights")} />
    {isAdmin ? <Card title="Administration">{[["Settings", "Answering & settings"], ["Voice", "Voice"], ["Script", "Business information"], ["Flows", "Intake questions"], ["Team", "Team access"]].map(([target, label]) => <ActionButton key={target} label={label} variant="light" onPress={() => onSelect(target)} />)}</Card> : null}
    {isAdmin ? <ReplyPolicyPanel baseUrl={baseUrl} accessCode={accessCode} /> : null}
    <ActionButton label="Sign out" variant="light" onPress={onSignOut} />
  </>;
}

function BottomTabs({ activeTab, onSelect, tabs = staffPrimaryTabs, unread = 0 }) {
  const activePrimary = tabs.some((tab) => tab.name === activeTab) ? activeTab : "More";
  return (
    <LinearGradient colors={["#10243a", "#10243a"]} style={styles.tabWrap}>
      <View style={styles.tabContent}>
        {tabs.map((tab) => {
          const active = activePrimary === tab.name;
          const Icon = { Home: House, Inbox: MessageCircle, Calls: Phone, Bookings: CalendarDays, More: UserRound }[tab.name] || UserRound;
          return (
            <Pressable
              key={tab.name}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              accessibilityLabel={`${tab.label || tab.name}${tab.name === "Inbox" && unread ? `, ${unread} unread` : ""}`}
              onPress={() => onSelect(tab.name)}
              style={[
                styles.tabButton,
                { borderColor: active ? tab.color : "rgba(118, 87, 255, 0.14)" },
                active && { backgroundColor: "#d9edf2" }
              ]}
            >
              <LinearGradient colors={[tab.color, "#8fdde4"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.tabAccent} />
              <Icon size={19} color={active ? "#10212b" : tab.color} />
              <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} style={[styles.tabText, active && styles.tabTextActive]}>{tab.label || tab.name}</Text>
              {tab.name === "Inbox" && unread > 0 ? <Text style={{ position: "absolute", top: 1, right: 2, backgroundColor: "#b12257", color: "#fff", borderRadius: 8, paddingHorizontal: 4, fontSize: 10, fontWeight: "700" }}>{unread > 99 ? "99+" : unread}</Text> : null}
            </Pressable>
          );
        })}
      </View>
    </LinearGradient>
  );
}

function Header({ settings, signedInStaff, onProfile, onAlerts }) {
  return (
    <LinearGradient colors={["#10243a", "#122b43"]} style={styles.header}>
      <View style={styles.brandRow}>
        <LinearGradient colors={["#ffffff", "#fff0fa"]} style={styles.logoFrame}>
          <Image source={require("./assets/icon.png")} style={styles.logo} />
        </LinearGradient>
        <View style={styles.brandCopy}>
          <Text style={styles.title}>DDD Dispatch</Text>
          <Pressable onPress={onProfile} accessibilityRole="button" accessibilityLabel="Open account"><Text style={styles.subtitle}>{signedInStaff?.ok ? signedInStaff.name : "Sign in"}</Text></Pressable>
        </View>
        <Text style={[styles.modePill, settings.enabled ? styles.modePillLive : styles.modePillPaused]}>
          {settings.enabled ? "Live" : "Paused"}
        </Text>
        <Pressable onPress={onAlerts} accessibilityRole="button" accessibilityLabel="Notification settings" style={styles.headerAction}><Text style={styles.headerActionText}>Alerts</Text></Pressable>
      </View>
      <LinearGradient colors={rainbowColors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.heroGlow} />
    </LinearGradient>
  );
}

function SettingsTab({
  adminPin,
  apiBaseUrl,
  activity,
  editMode,
  loading,
  savedApiBaseUrl,
  saving,
  setup,
  settings,
  setAdminPin,
  setApiBaseUrl,
  setEditMode,
  setStaffPhone,
  setSettings,
  signedInStaff,
  staffPhone,
  pushStatus,
  pushToken,
  isAdmin,
  onEnablePush,
  onRefresh,
  onSaveBaseUrl,
  onSaveSettings,
  onUnlockAdmin,
  onSignOut,
  onSendTestNotification
}) {
  const [accountOpen, setAccountOpen] = useState(false);
  const activeDay = activity?.insights?.sections?.latestActiveDay || activity?.insights?.sections?.daily || {};
  const todayCalls = activeDay.calls ?? activity?.calls?.length ?? 0;
  const weeklyBookings = activity?.insights?.sections?.weekly?.bookings ?? 0;
  const hasAdminPin = Boolean(String(adminPin || "").trim());
  const isSignedIn = Boolean(signedInStaff?.ok);
  const routeMode = settings.humanRouting?.mode || "ai_then_humans";
  const routeLabel = routeMode === "humans" ? "Ring team" : routeMode === "ai" ? "AI only" : "AI + backup";
  return (
    <>
      <Card title={isSignedIn ? "Account" : "Sign in"}>
        <View style={styles.accessBanner}>
          <View style={styles.flexText}>
            <Text style={styles.accessTitle}>{isSignedIn ? `Signed in as ${signedInStaff.name || "DDD team"}` : hasAdminPin ? "Code saved" : "Locked"}</Text>
            <Text style={styles.muted}>
              {isSignedIn
                ? `${signedInStaff.role || "staff"} access is active. Inbox and calls refresh on their own.`
                : hasAdminPin
                  ? "Tap Unlock once. The app keeps this code on this phone."
                  : "Enter admin or tech code once to load inbox, calls, replies, and alerts."}
            </Text>
          </View>
          <Text style={[styles.accessPill, hasAdminPin ? styles.accessPillReady : styles.accessPillLocked]}>
            {isSignedIn ? "Verified" : hasAdminPin ? "Saved" : "Need code"}
          </Text>
        </View>
        {isSignedIn ? <ActionButton label={accountOpen ? "Close account controls" : "Account controls"} onPress={() => setAccountOpen(!accountOpen)} variant="light" /> : null}
        {(!isSignedIn || accountOpen) ? <View style={styles.pinLoginRow}>
          <View style={styles.pinFieldWrap}>
            <Field
              label="Access code"
              onChangeText={(value) => {
                setAdminPin(value);
                AsyncStorage.setItem(adminPinStorageKey, value).catch(() => {});
              }}
              secureTextEntry
              value={adminPin}
            />
          </View>
          <View style={styles.pinButtonWrap}>
            <ActionButton disabled={loading || !hasAdminPin} label={loading ? "Checking..." : "Unlock"} onPress={onUnlockAdmin} />
          </View>
        </View> : null}
        {accountOpen && isSignedIn ? <ActionButton label="Sign out / switch account" variant="light" onPress={onSignOut} /> : null}
        <Text style={styles.muted}>
          {isAdmin
            ? "Admin can edit AI settings, routing, team view, and app setup."
            : "Tech access opens DDD texts, calls, bookings, insights, replies, callback bridge, and your own alerts."}
        </Text>
        <Field
          keyboardType="phone-pad"
          label="Your call-back phone"
          onChangeText={(value) => {
            setStaffPhone(value);
            AsyncStorage.setItem(staffPhoneStorageKey, value).catch(() => {});
          }}
          value={staffPhone}
        />
        <Text style={styles.muted}>Outbound calls ring this phone first, then connect the customer with DDD caller ID.</Text>
      </Card>

      <Card title="At a glance">
        <View style={styles.metricStrip}>
          <Metric label="AI" value={settings.enabled ? "On" : "Paused"} />
          <Metric label="Today" value={todayCalls} />
          <Metric label="Booked" value={weeklyBookings} />
          <Metric label="Texts" value={activity?.conversations?.length || 0} />
        </View>
      </Card>

      {isAdmin ? (
        <Card title="Answering mode">
          <View style={styles.routeHeader}>
            <View style={styles.flexText}>
              <Text style={styles.accessTitle}>{routeLabel}</Text>
              <Text style={styles.muted}>
                {routeMode === "humans"
                  ? "Skip the AI and ring saved team numbers to save AI usage."
                  : routeMode === "ai"
                    ? "AI handles calls without trying the team unless logic sends a fallback."
                    : "AI answers first, then can ring the team when needed."}
              </Text>
            </View>
            <Switch disabled={!editMode} onValueChange={(enabled) => setSettings((current) => ({ ...current, enabled }))} value={settings.enabled} />
          </View>
          <SegmentedOptions
            disabled={!editMode}
            options={[
              { id: "ai_then_humans", label: "AI + backup" },
              { id: "ai", label: "AI only" },
              { id: "humans", label: "Ring team" }
            ]}
            selected={routeMode}
            onSelect={(mode) =>
              setSettings((current) => ({
                ...current,
                enabled: mode === "humans" ? false : current.enabled,
                humanRouting: { ...current.humanRouting, mode }
              }))
            }
          />
          <View style={styles.summaryGrid}>
            <SummaryTile label="Team nums" value={settings.humanRouting?.numbers?.length || 0} />
            <SummaryTile label="Timeout" value={`${settings.humanRouting?.timeoutSeconds || 22}s`} />
          </View>
          <View style={styles.buttonRow}>
            <ActionButton label={editMode ? "Lock settings" : "Edit settings"} onPress={() => setEditMode((current) => !current)} />
            <ActionButton disabled={saving || loading || !editMode} label={saving ? "Saving..." : "Save now"} onPress={onSaveSettings} variant="light" />
            <ActionButton label="Refresh" onPress={onRefresh} variant="light" />
          </View>
        </Card>
      ) : null}

      <Card title="Phone alerts">
        <View style={styles.statusRow}>
          <View style={styles.flexText}>
            <Text style={styles.label}>Native push notifications</Text>
            <Text style={styles.muted}>{pushStatus}</Text>
          </View>
          <Text style={[styles.tinyStatusDot, pushToken ? styles.dotLive : styles.dotPaused]} />
        </View>
        <View style={styles.buttonRow}>
          <ActionButton label="Enable alerts" onPress={onEnablePush} />
          <ActionButton label="Test alert" onPress={onSendTestNotification} variant="light" />
        </View>
        <Text style={styles.muted}>Alerts cover new calls, missed/busy calls, customer texts, bookings, and QA follow-ups after the iPhone build is installed.</Text>
      </Card>

      {isAdmin ? (
        <Card title="Alert settings">
          <View style={styles.twoColumnToggles}>
            {[
              ["newCalls", "New calls"],
              ["missedCalls", "Missed calls"],
              ["bookings", "Bookings"],
              ["texts", "Texts"],
              ["qaIssues", "Needs review"],
              ["dailySummary", "Daily"],
              ["weeklySummary", "Weekly"],
              ["monthlySummary", "Monthly"]
            ].map(([key, label]) => (
              <SwitchRow
                key={key}
                disabled={!editMode}
                label={label}
                note=""
                value={settings.notificationPreferences?.[key] !== false}
                onValueChange={(value) =>
                  setSettings((current) => ({
                    ...current,
                    notificationPreferences: { ...current.notificationPreferences, [key]: value }
                  }))
                }
              />
            ))}
          </View>
        </Card>
      ) : null}

      {isAdmin ? <Card title="Run costs">
        <Text style={styles.muted}>Quick links for the accounts that keep calls, texts, AI, and hosting running.</Text>
        <View style={styles.linkGrid}>
          {billingLinks.map(([label, detail, url]) => (
            <Pressable key={url} onPress={() => Linking.openURL(url)} style={styles.linkCard}>
              <LinearGradient colors={["#fffaff", "#f7fffb"]} style={styles.linkCardInner}>
                <Text style={styles.linkLabel}>{label}</Text>
                <Text style={styles.linkDetail}>{detail}</Text>
              </LinearGradient>
            </Pressable>
          ))}
        </View>
      </Card> : null}

      {isAdmin ? <Card title="Backend">
        <Field autoCapitalize="none" keyboardType="url" label="Live backend URL" onChangeText={setApiBaseUrl} value={apiBaseUrl} />
        <View style={styles.buttonRow}>
          <ActionButton label="Save URL" onPress={onSaveBaseUrl} />
          <ActionButton label="Open admin web" onPress={() => Linking.openURL(normalizeBaseUrl(apiBaseUrl))} variant="light" />
        </View>
        <Text style={styles.muted}>Using {savedApiBaseUrl}</Text>
      </Card> : null}

      {isAdmin ? <Card title="Setup status">
        {setup ? <SetupBadges setup={setup} /> : <Text style={styles.muted}>Setup status will appear after refresh.</Text>}
      </Card> : null}
    </>
  );
}

function MoreTab({ activity, onSelect, settings, isAdmin }) {
  return (
    <>
      <Card title="More controls">
        <View style={styles.moreGrid}>
          {(isAdmin ? adminMoreTabs : [{ name: "Home", color: "#7657ff", label: "Account & alerts" }, { name: "Insights", color: "#23c779" }]).map((tab) => (
            <Pressable key={tab.name} onPress={() => onSelect(tab.name)} style={styles.moreTile}>
              <LinearGradient colors={[tab.color, "#16b8ff"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.moreTileGradient}>
                <Text style={styles.moreTileText}>{tab.label || tab.name}</Text>
              </LinearGradient>
            </Pressable>
          ))}
        </View>
      </Card>
      <Card title="Right now">
        <View style={styles.summaryGrid}>
          <SummaryTile label="AI mode" value={(settings.humanRouting?.mode || "ai").replaceAll("_", " ")} />
          <SummaryTile label="Texts" value={activity?.conversations?.length || 0} />
          <SummaryTile label="Calls" value={activity?.calls?.length || 0} />
          <SummaryTile label="Voice" value={settings.voice || "marin"} />
        </View>
      </Card>
    </>
  );
}

function VoiceTab({ editMode, previewing, settings, setSettings, onPreviewVoice }) {
  return (
    <>
      <Card title="Voice">
        <SegmentedOptions
          disabled={!editMode}
          options={settings.voiceOptions}
          selected={settings.voice}
          onSelect={(voice) => setSettings((current) => ({ ...current, voice }))}
        />
        <Text style={styles.label}>Speed {Number(settings.voiceSpeed).toFixed(2)}x</Text>
        <View style={styles.buttonRow}>
          <ActionButton disabled={!editMode} label="Slower" onPress={() => setSettings((current) => ({ ...current, voiceSpeed: clampSpeed(current.voiceSpeed - 0.05) }))} variant="light" />
          <ActionButton disabled={!editMode} label="Faster" onPress={() => setSettings((current) => ({ ...current, voiceSpeed: clampSpeed(current.voiceSpeed + 0.05) }))} variant="light" />
          <ActionButton disabled={previewing} label={previewing ? "Playing..." : "Preview"} onPress={onPreviewVoice} />
        </View>
      </Card>
      <Card title="Voice direction">
        <Field editable={editMode} label="How it should sound" multiline onChangeText={(voiceDirection) => setSettings((current) => ({ ...current, voiceDirection }))} value={settings.voiceDirection} />
      </Card>
      <Card title="Noise handling">
        <SegmentedOptions
          disabled={!editMode}
          options={[
            { id: "patient", label: "Patient" },
            { id: "balanced", label: "Balanced" },
            { id: "fast", label: "Fast" }
          ]}
          selected={settings.noiseHandling?.mode || "patient"}
          onSelect={(mode) =>
            setSettings((current) => ({
              ...current,
              noiseHandling: {
                ...current.noiseHandling,
                mode,
                eagerness: mode === "fast" ? "medium" : "low",
                interruptResponse: mode === "fast" && current.noiseHandling?.interruptResponse === true
              }
            }))
          }
        />
        <SwitchRow
          disabled={!editMode}
          label="Caller can interrupt mid-sentence"
          note="Only use with Fast mode. Keep off for noisy roadside calls."
          value={settings.noiseHandling?.interruptResponse === true}
          onValueChange={(interruptResponse) =>
            setSettings((current) => ({
              ...current,
              noiseHandling: { ...current.noiseHandling, interruptResponse: current.noiseHandling?.mode === "fast" && interruptResponse }
            }))
          }
        />
        <Field
          editable={editMode}
          label="Noise instructions"
          multiline
          onChangeText={(notes) => setSettings((current) => ({ ...current, noiseHandling: { ...current.noiseHandling, notes } }))}
          value={settings.noiseHandling?.notes || ""}
        />
      </Card>
      <Card title="Sound preferences">
        <SwitchRow
          disabled={!editMode}
          label="Non-annoying thinking phrase"
          note="Use a short phrase instead of keyboard sounds or long filler."
          value={settings.soundPreferences?.thinkingSound !== false}
          onValueChange={(thinkingSound) =>
            setSettings((current) => ({ ...current, soundPreferences: { ...current.soundPreferences, thinkingSound } }))
          }
        />
        <Field
          editable={editMode}
          label="Thinking phrase"
          onChangeText={(thinkingPhrase) =>
            setSettings((current) => ({ ...current, soundPreferences: { ...current.soundPreferences, thinkingPhrase } }))
          }
          value={settings.soundPreferences?.thinkingPhrase || ""}
        />
        <SegmentedOptions
          disabled={!editMode}
          options={[
            { id: "off", label: "No music" },
            { id: "licensed-music", label: "Licensed" },
            { id: "office", label: "Office" }
          ]}
          selected={settings.soundPreferences?.backgroundAudio?.mode || "off"}
          onSelect={(mode) =>
            setSettings((current) => ({
              ...current,
              soundPreferences: {
                ...current.soundPreferences,
                backgroundAudio: {
                  ...current.soundPreferences?.backgroundAudio,
                  enabled: mode !== "off",
                  mode
                }
              }
            }))
          }
        />
        <Field
          editable={editMode}
          label="Background label"
          onChangeText={(label) =>
            setSettings((current) => ({
              ...current,
              soundPreferences: { ...current.soundPreferences, backgroundAudio: { ...current.soundPreferences?.backgroundAudio, label } }
            }))
          }
          value={settings.soundPreferences?.backgroundAudio?.label || ""}
        />
        <Field
          editable={editMode}
          label="Licensed audio URL"
          onChangeText={(url) =>
            setSettings((current) => ({
              ...current,
              soundPreferences: { ...current.soundPreferences, backgroundAudio: { ...current.soundPreferences?.backgroundAudio, url } }
            }))
          }
          value={settings.soundPreferences?.backgroundAudio?.url || ""}
        />
      </Card>
    </>
  );
}

function ScriptTab({ editMode, settings, setSettings, testCallerMessage, testOutput, testing, setTestCallerMessage, onRunFreeTest }) {
  return (
    <>
      <Card title="Free receptionist test">
        <Text style={styles.muted}>Tests the logic without using paid phone minutes.</Text>
        <Field label="Caller says" multiline onChangeText={setTestCallerMessage} value={testCallerMessage} />
        <ActionButton disabled={testing} label={testing ? "Testing..." : "Run free test"} onPress={onRunFreeTest} />
        {testOutput ? <Text style={styles.testOutput}>{testOutput}</Text> : null}
      </Card>

      <Card title="What it says">
        <Field editable={editMode} label="Greeting" onChangeText={(greeting) => setSettings((current) => ({ ...current, greeting }))} value={settings.greeting} />
        <Field editable={editMode} label="Business knowledge" multiline onChangeText={(businessKnowledge) => setSettings((current) => ({ ...current, businessKnowledge }))} value={settings.businessKnowledge} />
        <Field editable={editMode} label="Custom instructions" multiline onChangeText={(customInstructions) => setSettings((current) => ({ ...current, customInstructions }))} value={settings.customInstructions} />
      </Card>

      <Card title="Script preview">
        <Text style={styles.testOutput}>{buildScriptPreview(settings)}</Text>
      </Card>
    </>
  );
}

function FlowsTab({ editMode, settings, setSettings }) {
  return (
    <>
      <Card title="Caller handling">
        <Field editable={editMode} label="Service area" multiline onChangeText={(serviceArea) => setSettings((current) => ({ ...current, serviceArea }))} value={settings.serviceArea} />
        <Field editable={editMode} label="Qualifying services" multiline onChangeText={(qualifyingServicesText) => setSettings((current) => ({ ...current, qualifyingServicesText }))} value={settings.qualifyingServicesText} />
        <Field editable={editMode} label="Services DDD does" multiline onChangeText={(offeredServices) => setSettings((current) => ({ ...current, offeredServices }))} value={settings.offeredServices} />
        <Field editable={editMode} label="Services DDD does not do" multiline onChangeText={(notOfferedServices) => setSettings((current) => ({ ...current, notOfferedServices }))} value={settings.notOfferedServices} />
        <Field editable={editMode} label="Out-of-scope handling" multiline onChangeText={(outOfScopeHandling) => setSettings((current) => ({ ...current, outOfScopeHandling }))} value={settings.outOfScopeHandling} />
        <SwitchRow disabled={!editMode} label="Referral text for unsupported work" note="Optional safe link for shops/mobile mechanics later." value={settings.directoryReferral?.enabled === true} onValueChange={(enabled) => setSettings((current) => ({ ...current, directoryReferral: { ...current.directoryReferral, enabled } }))} />
        <Field editable={editMode} label="Referral URL" onChangeText={(url) => setSettings((current) => ({ ...current, directoryReferral: { ...current.directoryReferral, url } }))} value={settings.directoryReferral?.url || ""} />
        <Field editable={editMode} label="Referral wording" multiline onChangeText={(message) => setSettings((current) => ({ ...current, directoryReferral: { ...current.directoryReferral, message } }))} value={settings.directoryReferral?.message || ""} />
        <Field editable={editMode} label="Pricing and payment rules" multiline onChangeText={(pricingNotes) => setSettings((current) => ({ ...current, pricingNotes }))} value={settings.pricingNotes} />
        <Field editable={editMode} label="Emergency handling" multiline onChangeText={(emergencyInstructions) => setSettings((current) => ({ ...current, emergencyInstructions }))} value={settings.emergencyInstructions} />
        <Field editable={editMode} label="Human handoff" multiline onChangeText={(humanHandoffRules) => setSettings((current) => ({ ...current, humanHandoffRules }))} value={settings.humanHandoffRules} />
        <Field editable={editMode} label="Call outcome rules" multiline onChangeText={(callOutcomeRules) => setSettings((current) => ({ ...current, callOutcomeRules }))} value={settings.callOutcomeRules} />
        <Field editable={editMode} label="Missed-call fallback rules" multiline onChangeText={(fallbackRules) => setSettings((current) => ({ ...current, fallbackRules }))} value={settings.fallbackRules} />
        <Field editable={editMode} label="After-hours instructions" multiline onChangeText={(afterHoursInstructions) => setSettings((current) => ({ ...current, afterHoursInstructions }))} value={settings.afterHoursInstructions} />
        <Field editable={editMode} label="Complaints and escalations" multiline onChangeText={(complaintInstructions) => setSettings((current) => ({ ...current, complaintInstructions }))} value={settings.complaintInstructions} />
        <Field editable={editMode} label="Apply-to-work handling" multiline onChangeText={(applyInstructions) => setSettings((current) => ({ ...current, applyInstructions }))} value={settings.applyInstructions} />
      </Card>

      <Card title="Caller types">
        <Field editable={editMode} label="Potential new clients" multiline onChangeText={(newClients) => setCallerFlow(setSettings, "newClients", newClients)} value={settings.callerFlows.newClients} />
        <Field editable={editMode} label="Existing clients" multiline onChangeText={(existingClients) => setCallerFlow(setSettings, "existingClients", existingClients)} value={settings.callerFlows.existingClients} />
        <Field editable={editMode} label="Sales callers" multiline onChangeText={(sales) => setCallerFlow(setSettings, "sales", sales)} value={settings.callerFlows.sales} />
        <Field editable={editMode} label="All other callers" multiline onChangeText={(otherCallers) => setCallerFlow(setSettings, "otherCallers", otherCallers)} value={settings.callerFlows.otherCallers} />
      </Card>

      <Card title="Text and review follow-up">
        <SwitchRow disabled={!editMode} label="SMS follow-up" note="Texts booking/app instructions after the call." value={settings.smsFollowUp.enabled} onValueChange={(enabled) => setSettings((current) => ({ ...current, smsFollowUp: { ...current.smsFollowUp, enabled } }))} />
        <Field editable={editMode} label="SMS message" multiline onChangeText={(message) => setSettings((current) => ({ ...current, smsFollowUp: { ...current.smsFollowUp, message } }))} value={settings.smsFollowUp.message} />
        <SwitchRow disabled={!editMode} label="Google review follow-up" note="Used after completed jobs." value={settings.reviewFollowUp.enabled} onValueChange={(enabled) => setSettings((current) => ({ ...current, reviewFollowUp: { ...current.reviewFollowUp, enabled } }))} />
        <Field editable={editMode} label="Google review link" onChangeText={(url) => setSettings((current) => ({ ...current, reviewFollowUp: { ...current.reviewFollowUp, url } }))} value={settings.reviewFollowUp.url} />
        <Field editable={editMode} label="Review message" multiline onChangeText={(message) => setSettings((current) => ({ ...current, reviewFollowUp: { ...current.reviewFollowUp, message } }))} value={settings.reviewFollowUp.message} />
      </Card>

      <Card title="DDD links">
        <Field editable={editMode} label="Booking, app, web, and apply links" multiline onChangeText={(bookingDestinationsText) => setSettings((current) => ({ ...current, bookingDestinationsText }))} value={settings.bookingDestinationsText} />
      </Card>

      <Card title="Human routing">
        <Field editable={editMode} label="Human route numbers" multiline onChangeText={(value) => setSettings((current) => ({ ...current, humanRouting: { ...current.humanRouting, numbers: parseHumanRouteNumbers(value) } }))} value={formatHumanRouteNumbers(settings.humanRouting?.numbers || [])} />
        <Field editable={editMode} keyboardType="number-pad" label="Ring timeout seconds" onChangeText={(timeoutSeconds) => setSettings((current) => ({ ...current, humanRouting: { ...current.humanRouting, timeoutSeconds: Number(timeoutSeconds) || 22 } }))} value={settings.humanRouting?.timeoutSeconds || 22} />
        <Field editable={editMode} label="Transfer triggers" multiline onChangeText={(value) => setSettings((current) => ({ ...current, humanRouting: { ...current.humanRouting, transferTriggers: value.split("\n").map((item) => item.trim()).filter(Boolean) } }))} value={(settings.humanRouting?.transferTriggers || []).join("\n")} />
        <Field editable={editMode} label="Caller hold message" onChangeText={(callerMessage) => setSettings((current) => ({ ...current, humanRouting: { ...current.humanRouting, callerMessage } }))} value={settings.humanRouting?.callerMessage || ""} />
        <Field editable={editMode} label="No-answer message" multiline onChangeText={(fallbackMessage) => setSettings((current) => ({ ...current, humanRouting: { ...current.humanRouting, fallbackMessage } }))} value={settings.humanRouting?.fallbackMessage || ""} />
      </Card>
    </>
  );
}

function TeamTab({ adminPin, editMode, saving, setEditMode, signedInStaff, onSaveSettings }) {
  return (
    <>
      <Card title="Team access">
        <View style={styles.accessBanner}>
          <View style={styles.flexText}>
            <Text style={styles.accessTitle}>{signedInStaff?.ok ? `${signedInStaff.name || "DDD team"} is signed in` : "Code not verified"}</Text>
            <Text style={styles.muted}>
              {isAdminStaff(signedInStaff)
                ? "Admin settings are unlocked. Tech access comes from DDD Platform / TechAssist."
                : "Tech codes use DDD Platform / TechAssist for inbox, replies, callback bridge, and live status."}
            </Text>
          </View>
          <Text style={[styles.accessPill, signedInStaff?.ok ? styles.accessPillReady : styles.accessPillLocked]}>
            {signedInStaff?.role || (adminPin ? "Check code" : "Locked")}
          </Text>
        </View>
        <Text style={styles.muted}>Master admin code stays in Render's ADMIN_PIN secret. Tech codes are managed in the DDD platform/TechAssist, so this app does not keep separate backup tech codes.</Text>
        <View style={styles.buttonRow}>
          <ActionButton label={editMode ? "Lock settings" : "Edit settings"} onPress={() => setEditMode((current) => !current)} />
          <ActionButton disabled={saving || !isAdminStaff(signedInStaff)} label={saving ? "Saving..." : "Save settings"} onPress={onSaveSettings} variant="light" />
        </View>
        {!isAdminStaff(signedInStaff) ? <Text style={styles.warningText}>Sign in with the real admin code on Home to change admin settings. Techs keep using their DDD Platform / TechAssist code.</Text> : null}
      </Card>
    </>
  );
}

function InboxTab({ notificationOnly, staff, team, composeRequest, isAdmin, adminPin, apiBaseUrl, conversations, hasPin, onRefresh, setStatus, settings, staffPhone, initialPhone, nativePhone }) {
  const [allowRead, setAllowRead] = useState(!notificationOnly);
  const [composing, setComposing] = useState(false);
  const [search, setSearch] = useState("");
  const [drafts, setDrafts] = useState({});
  const [manualPhone, setManualPhone] = useState("");
  const [selectedPhone, setSelectedPhone] = useState("");
  const [workingThread, setWorkingThread] = useState("");
  const [filter, setFilter] = useState("all");
  useEffect(() => { if (initialPhone) { setManualPhone(initialPhone); setSelectedPhone(normalizeE164(initialPhone)); } }, [initialPhone]);
  useEffect(() => { if (composeRequest && !initialPhone) { setSelectedPhone(""); setManualPhone(""); setComposing(true); } }, [composeRequest, initialPhone]);
  const mergedConversations = mergeConversations(conversations);
  const activeConversations = mergedConversations.filter((item) => (filter === "all" || (filter === "unread" ? item.unread > 0 : needsReply(item))) && `${getConversationName(item)} ${getConversationCustomer(item)} ${getConversationPreview(item)}`.toLowerCase().includes(search.toLowerCase()));
  const manualNormalizedPhone = normalizeE164(manualPhone);
  const manualConversation =
    manualNormalizedPhone && !activeConversations.some((conversation) => normalizeE164(getConversationCustomer(conversation)) === manualNormalizedPhone)
      ? {
          phone: manualNormalizedPhone,
          customerName: "New customer",
          lastMessageAt: new Date().toISOString(),
          lastBody: "Start a new DDD text or callback.",
          messages: []
        }
      : null;
  const selectedConversation =
    mergedConversations.find((conversation) => normalizeE164(getConversationCustomer(conversation)) === selectedPhone) ||
    (selectedPhone === manualNormalizedPhone ? manualConversation : null) ||
    null;
  const selectedCustomerPhone = selectedConversation ? getConversationCustomer(selectedConversation) : "";
  useEffect(() => {
    if (!selectedConversation?.lastMessageAt || !hasPin || !canWork(staff) || !allowRead) return;
    apiPost(apiBaseUrl, `/api/conversations/${encodeURIComponent(selectedConversation.phone)}/state`, { action: "read", through: selectedConversation.lastMessageAt }, adminPin).catch(() => {});
  }, [selectedConversation?.phone, selectedConversation?.lastMessageAt, hasPin, apiBaseUrl, adminPin, allowRead, staff]);

  async function sendReply(customerPhone) {
    if (!canWork(staff)) return;
    const to = normalizeE164(customerPhone);
    const message = String(drafts[to] || "").trim();
    if (!to) {
      setStatus("Could not find a valid customer phone number.");
      return;
    }
    if (!message) {
      setStatus("Type a reply first.");
      return;
    }
    setWorkingThread(`sms:${to}`);
    try {
      await apiPost(apiBaseUrl, "/api/sms/reply", { to, message }, adminPin);
      setDrafts((current) => ({ ...current, [to]: "" }));
      setManualPhone(to);
      setSelectedPhone(to);
      setComposing(false);
      setStatus("Text sent from DDD.");
      onRefresh();
    } catch (error) {
      setStatus(error.message);
    } finally {
      setWorkingThread("");
    }
  }

  async function callCustomer(customerPhone) {
    if (!canWork(staff)) return;
    const to = normalizeE164(customerPhone);
    if (!to) {
      setStatus("Could not find a valid customer phone number.");
      return;
    }
    setWorkingThread(`call:${to}`);
    try {
      await nativePhone.dial(to);
      setStatus("Calling from DDD.");
    } catch (error) {
      setStatus(error.message);
    } finally {
      setWorkingThread("");
    }
  }

  async function archiveConversation(customerPhone) {
    if (!canWork(staff)) return;
    const to = normalizeE164(customerPhone);
    if (!to) {
      setStatus("Could not archive: missing customer phone.");
      return;
    }
    setWorkingThread(`archive:${to}`);
    try {
      await apiDelete(apiBaseUrl, `/api/conversations/${encodeURIComponent(to)}`, adminPin);
      setStatus(`${formatPhone(to)} archived. It is hidden from the active inbox but still saved in history.`);
      setSelectedPhone("");
      onRefresh();
    } catch (error) {
      setStatus(error.message);
    } finally {
      setWorkingThread("");
    }
  }

  return (
    <>
      {!selectedConversation ? <View style={styles.buttonRow}><ActionButton disabled={!canWork(staff)} label={composing ? "Close" : "New text"} onPress={() => setComposing(!composing)} /><ActionButton label="Refresh" onPress={onRefresh} variant="light" /></View> : <ActionButton label="Back to inbox" variant="light" onPress={() => { setSelectedPhone(""); setManualPhone(""); setComposing(false); }} />}
      {composing && !selectedConversation ? <ScrollView><Card title="New conversation">
        <View style={styles.manualContactBox}>
          <Text style={styles.linkLabel}>Customer number</Text>
          <Field
            keyboardType="phone-pad"
            label="Phone"
            onChangeText={(value) => {
              setManualPhone(value);
              const normalized = normalizeE164(value);
            }}
            value={manualPhone}
          />
          <Field
            editable={Boolean(manualNormalizedPhone)}
            label="Message"
            multiline
            onChangeText={(message) => {
              if (!manualNormalizedPhone) {
                setStatus("Enter a valid customer number first.");
                return;
              }
              setDrafts((current) => ({ ...current, [manualNormalizedPhone]: message }));
            }}
            value={manualNormalizedPhone ? drafts[manualNormalizedPhone] || "" : ""}
          />
          <View style={styles.buttonRow}>
            <ActionButton
              disabled={!manualNormalizedPhone || workingThread === `sms:${manualNormalizedPhone}`}
              label={workingThread === `sms:${manualNormalizedPhone}` ? "Sending..." : "Send text"}
              onPress={() => sendReply(manualNormalizedPhone)}
            />
            <ActionButton
              disabled={!manualNormalizedPhone || workingThread === `call:${manualNormalizedPhone}`}
              label={workingThread === `call:${manualNormalizedPhone}` ? "Calling..." : "Call number"}
              onPress={() => callCustomer(manualNormalizedPhone)}
              variant="light"
            />
          </View>
        </View>
      </Card></ScrollView> : null}
      {!selectedConversation && !composing ? <View style={styles.inboxList}>
        {!hasPin ? <Text style={styles.warningText}>Enter your admin or tech access code on Home once to load protected inbox messages.</Text> : null}
        <View style={styles.buttonRow}>{[["all", "All"], ["attention", "Needs reply"], ["unread", "Unread"]].map(([value, label]) => <ActionButton key={value} label={label} onPress={() => setFilter(value)} variant={value === filter ? undefined : "light"} />)}</View>
        <Field label="Search customers" value={search} onChangeText={setSearch} />
        <ScrollView contentContainerStyle={styles.conversationPicker}>
          {activeConversations.map((conversation, index) => {
            const customerPhone = getConversationCustomer(conversation);
            const normalized = normalizeE164(customerPhone);
            const active = normalized === normalizeE164(selectedCustomerPhone);
            return (
              <Pressable
                key={normalized || conversation.threadId || index}
                onPress={() => { setAllowRead(true); setSelectedPhone(normalized); }}
                style={[styles.conversationChoice, { borderLeftColor: threadAccent(customerPhone), borderLeftWidth: 3 }, active && styles.conversationChoiceActive]}
              >
                <View style={[styles.threadAvatar, { backgroundColor: threadAccent(customerPhone) }]}><Text style={styles.threadAvatarText}>{getConversationName(conversation) === "Customer" ? normalized.slice(-2) : getConversationName(conversation).split(/\s+/).slice(0, 2).map((part) => part[0]).join("")}</Text></View>
                <View style={styles.flexText}>
                <Text style={[styles.conversationName, active && styles.conversationNameActive]} numberOfLines={1}>
                  {getConversationName(conversation)}
                  {conversation.unread ? ` · ${conversation.unread} new` : ""}
                </Text>
                <Text style={[styles.conversationNumber, active && styles.conversationNumberActive]} numberOfLines={1}>
                  {formatPhone(customerPhone) || "Unknown"}
                </Text>
                <Text style={[styles.conversationPreview, active && styles.conversationNumberActive]} numberOfLines={1}>
                  {getConversationPreview(conversation)}
                </Text>
                <Text style={styles.conversationNumber}>{formatDateTime(getConversationTime(conversation))} · {ownerLabel(conversation)}</Text>
                {needsReply(conversation) ? <Text style={styles.warningText}>Needs reply{conversation.followUpReason ? ` · ${conversation.followUpReason}` : ""}</Text> : null}
                </View>
              </Pressable>
            );
          })}
        </ScrollView>
        {!activeConversations.length ? <Text style={styles.muted}>No conversations found.</Text> : null}
      </View> : null}
      {selectedConversation ? (
        <KeyboardAvoidingView style={{ flex: 1 }} keyboardVerticalOffset={100} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <ConversationCard
            onRead={() => setAllowRead(true)}
            staff={staff}
            team={team}
            key={selectedCustomerPhone}
            isAdmin={isAdmin}
            onState={async (payload) => { try { await apiPost(apiBaseUrl, `/api/conversations/${encodeURIComponent(selectedCustomerPhone)}/state`, payload, adminPin); await onRefresh(); } catch (error) { setStatus(error.message); } }}
            conversation={selectedConversation}
            draft={drafts[normalizeE164(getConversationCustomer(selectedConversation))] || ""}
            onArchive={archiveConversation}
            onCall={callCustomer}
            onDraftChange={(customerPhone, message) => {
              const to = normalizeE164(customerPhone);
              setDrafts((current) => ({ ...current, [to]: message }));
            }}
            onSend={sendReply}
            onHandled={async () => { try { await apiPost(apiBaseUrl, `/api/conversations/${encodeURIComponent(selectedCustomerPhone)}/state`, { action: "handled", through: new Date().toISOString() }, adminPin); setSelectedPhone(""); onRefresh(); } catch (error) { setStatus(error.message); } }}
            settings={settings}
            workingThread={workingThread}
          />
        </KeyboardAvoidingView>
      ) : null}
    </>
  );
}

function ConversationCard({ onRead, staff, team, isAdmin, onState, conversation, draft, onArchive, onCall, onDraftChange, onSend, onHandled, settings, workingThread }) {
  const messageScrollRef = useRef(null);
  const initialPositionRef = useRef(false);
  const unreadIndexRef = useRef(newestUnreadIndex(conversation));
  const messagePositionsRef = useRef({});
  const [assignmentOpen, setAssignmentOpen] = useState(false);
  const actions = ownershipActions(staff, conversation);
  const roster = (team || []).filter(member => member.active !== false && member.id && member.name);
  const [assigning, setAssigning] = useState(false);
  const updateOwner = async (payload) => { setAssigning(true); try { await onState(payload); } finally { setAssigning(false); } };
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const booking = conversation.bookings?.[0];
  const customerPhone = getConversationCustomer(conversation);
  const normalizedPhone = normalizeE164(customerPhone);
  const recentMessages = conversation.messages || [];
  const smsBusy = workingThread === `sms:${normalizedPhone}`;
  const callBusy = workingThread === `call:${normalizedPhone}`;
  const archiveBusy = workingThread === `archive:${normalizedPhone}`;
  const quickReplies = buildQuickReplies(conversation, settings);
  return (
    <View style={styles.conversationBox}>
      <View style={styles.listHeader}>
        <View style={styles.flexText}>
          <Text style={styles.listTitle} numberOfLines={1}>{getConversationName(conversation)}</Text>
          <Text style={styles.muted} numberOfLines={1}>{formatPhone(customerPhone) || "Unknown customer"} · {formatDateTime(getConversationTime(conversation))}</Text>
        </View>
        <Text style={styles.pill}>{conversation.messages?.length || 0} messages</Text>
      </View>
      <Text style={styles.record}>{conversation.unread ? `${conversation.unread} unread · ` : ""}{needsReply(conversation) ? "Needs reply · " : ""}{ownerLabel(conversation)}</Text>
      <View style={styles.buttonRow}>
        {actions.claim ? <ActionButton disabled={assigning} label="Claim" variant="light" onPress={() => updateOwner({ action: "claim" })} /> : null}
        {actions.assign ? <ActionButton label="Assign" variant="light" onPress={() => setAssignmentOpen(!assignmentOpen)} /> : null}
        {actions.release ? <ActionButton disabled={assigning} label="Release" variant="light" onPress={() => updateOwner({ action: "release" })} /> : null}
        {actions.unassign ? <ActionButton disabled={assigning} label="Unassign" variant="light" onPress={() => updateOwner({ action: "unassign" })} /> : null}
      </View>
      {assignmentOpen && actions.assign ? <View style={{ gap: 8 }}><Text style={styles.label}>Assign to</Text><ScrollView style={{ maxHeight: 200 }}>{roster.map(member => <ActionButton key={member.id} label={member.name} disabled={assigning} variant="light" onPress={async () => { await updateOwner({ action: "assign", assigneeId: member.id, assigneeName: member.name }); setAssignmentOpen(false); }} />)}</ScrollView>{!roster.length ? <Text style={styles.muted}>No team members available.</Text> : null}</View> : null}
      <View style={styles.buttonRow}>
        <ActionButton disabled={callBusy || !canWork(staff)} label={callBusy ? "Calling..." : "Call"} onPress={() => onCall(customerPhone)} variant="light" />
        <ActionButton label="Customer details" onPress={() => setDetailsOpen(!detailsOpen)} variant="light" />
        <ActionButton label="More" onPress={() => setMenuOpen(!menuOpen)} variant="light" />
      </View>
      {detailsOpen ? <View><Text style={styles.record}>{booking?.serviceType || "No booking"}</Text><Text style={styles.record}>{booking?.vehicle || "Vehicle not saved"}</Text><Text style={styles.record}>{booking?.location || "Location not saved"}</Text>{booking?.customerStatusUrl ? <ActionButton label="Open booking" onPress={() => Linking.openURL(booking.customerStatusUrl)} /> : null}</View> : null}
      {menuOpen ? <View style={styles.buttonRow}><ActionButton disabled={archiveBusy || !canWork(staff)} label="Archive conversation" onPress={() => onArchive(customerPhone)} variant="light" />{needsReply(conversation) ? <ActionButton disabled={!canWork(staff)} label="Mark handled" onPress={onHandled} variant="light" /> : null}</View> : null}
      <ScrollView onScrollBeginDrag={onRead} ref={messageScrollRef} style={styles.messageThread} contentContainerStyle={styles.messageThreadContent} nestedScrollEnabled
        onContentSizeChange={() => {
          if (!initialPositionRef.current) {
            const index = unreadIndexRef.current;
            const y = messagePositionsRef.current[index];
            if (index >= 0 && y === undefined) return;
            initialPositionRef.current = true;
            if (index >= 0) messageScrollRef.current?.scrollTo({ y: Math.max(0, y - 12), animated: false });
            else messageScrollRef.current?.scrollToEnd({ animated: false });
          }
        }}>
        {recentMessages.length ? recentMessages.map((message, index) => message.direction === "call" ? <Text key={`call-${message.messageSid || index}`} style={[styles.muted, { textAlign: "center", paddingVertical: 6 }]}>Call · {formatDateTime(message.createdAt)} · {cleanConversationBody(message.body || "Call received")}</Text> : (
          <View onLayout={(event) => { messagePositionsRef.current[index] = event.nativeEvent.layout.y; if (!initialPositionRef.current && index === unreadIndexRef.current) { initialPositionRef.current = true; messageScrollRef.current?.scrollTo({ y: Math.max(0, event.nativeEvent.layout.y - 12), animated: false }); } }} key={`${message.createdAt || index}-${message.direction}`} style={[styles.textBubble, message.direction === "outbound" && styles.textBubbleOutbound]}>
            <Text style={[styles.textBubbleLabel, message.direction === "outbound" && styles.textBubbleLabelOutbound]}>
              {message.direction === "outbound" ? message.agentName || "DDD" : "Customer"}
            </Text>
            <MessageBody body={cleanConversationBody(message.body || message.text || "")} outbound={message.direction === "outbound"} />
            <Text style={styles.messageMeta}>{formatDateTime(message.createdAt)}{message.direction === "outbound" ? ` · ${formatMessageStatus(message.status)}` : ""}</Text>
            {getDeliveryIssue(message) ? (
              <Text style={[styles.deliveryIssue, message.direction === "outbound" && styles.deliveryIssueOutbound]}>{getDeliveryIssue(message)}</Text>
            ) : null}
          </View>
        )) : <Text style={styles.record} numberOfLines={3}>{getConversationPreview(conversation)}</Text>}
        {(conversation.calls || []).map((call, index) => <View key={call.callId || call.callSid || index} style={styles.listCard}><Text style={styles.record}>Call · {formatDateTime(call.createdAt || call.startedAt)} · {call.status || "Logged"}</Text><Text selectable style={styles.record}>{formatCallTranscript(call) || call.summary || "No transcript available"}</Text></View>)}
        {(conversation.bookings || []).map((item, index) => <BookingCard key={item.bookingId || item.id || index} booking={item} />)}
      </ScrollView>
      <ActionButton label="Latest" variant="light" onPress={() => { onRead(); initialPositionRef.current = true; messageScrollRef.current?.scrollToEnd({ animated: true }); }} />
      {suggestionsOpen ? <View style={styles.quickReplyGrid}>
        {quickReplies.map((reply) => (
          <Pressable key={reply.label} onPress={() => onDraftChange(customerPhone, reply.text)} style={styles.quickReplyButton}>
            <Text style={styles.quickReplyText}>{reply.label}</Text>
          </Pressable>
        ))}
      </View> : null}
      <View style={{ flexDirection: "row", gap: 8, alignItems: "flex-end" }}>
        <Pressable accessibilityRole="button" accessibilityLabel={suggestionsOpen ? "Hide suggested replies" : "Suggested replies"} onPress={() => setSuggestionsOpen(!suggestionsOpen)} style={{ minWidth: 40, minHeight: 44, justifyContent: "center", alignItems: "center" }}><Sparkles size={22} color="#8c2387" /></Pressable>
        <TextInput accessibilityLabel="Reply from DDD" placeholder="Message customer..." placeholderTextColor="#687785" multiline onChangeText={(message) => onDraftChange(customerPhone, message)} value={draft} style={{ flex: 1, minHeight: 44, maxHeight: 110, borderRadius: 8, borderWidth: 1, borderColor: "#c3d5dd", backgroundColor: "#fff", color: "#203040", padding: 12, fontSize: 15 }} />
        <Pressable disabled={smsBusy || !draft.trim() || !canWork(staff)} accessibilityRole="button" accessibilityLabel={smsBusy ? "Sending" : "Send text"} onPress={() => onSend(customerPhone)} style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: "#007c69", opacity: smsBusy || !draft.trim() ? 0.4 : 1, justifyContent: "center", alignItems: "center" }}><Send size={20} color="#fff" /></Pressable>
      </View>
    </View>
  );
}

function BookingsTab({ bookings = [] }) {
  const [history, setHistory] = useState(false);
  const recentBookings = (bookings || []).filter((booking) => isOpenBooking(booking) !== history);
  return (
    <>
      <View style={styles.buttonRow}><ActionButton label={history ? "Show active jobs" : "Show history"} variant="light" onPress={() => setHistory(!history)} /></View>
      <Text style={styles.screenHeading}>{history ? "Completed & canceled" : "Upcoming & active"}</Text>
        {recentBookings.map((booking, index) => (
          <BookingCard booking={booking} key={booking.bookingId || booking.id || index} />
        ))}
        {recentBookings.length ? null : <Text style={styles.muted}>New bookings will show here with the service time and date.</Text>}
    </>
  );
}

function BookingCard({ booking = {} }) {
  const confidence = booking.confidence || {};
  const missing = Array.isArray(confidence.missing) ? confidence.missing : [];
  const statusLabel = getBookingStatusLabel(booking);
  const requestedFor = getBookingRequestedLabel(booking);
  return (
    <View style={[styles.listCard, { backgroundColor: "#e3e8ed", borderRadius: 8 }]}>
      <View style={styles.listHeader}>
        <Text style={styles.listTitle} numberOfLines={1}>{booking.customerName || booking.customer_name || booking.name || "Customer"}</Text>
        <Text style={styles.pill}>{statusLabel}</Text>
      </View>
      <Text style={styles.record}>Owner: {bookingOwnerLabel(booking)}</Text>
      <Text style={styles.record}>{booking.serviceType || booking.service || "Service not set"}</Text>
      <Text style={styles.record}>{formatPhone(conversationPhone(booking)) || "No phone saved"}</Text>
      <Text style={styles.record}>{booking.vehicle || "Vehicle not set"}{booking.vehicleColor ? ` (${booking.vehicleColor})` : ""}</Text>
      <Text style={styles.record}>{booking.location || "Location not set"}</Text>
      <View style={styles.callChipRow}>
        <Text style={styles.smallChip}>Requested: {requestedFor}</Text>
        <Text style={styles.smallChip}>Saved: {formatDateTime(booking.createdAt)}</Text>
      </View>
      {missing.length ? <Text style={styles.warningText}>Needs: {missing.join(", ")}</Text> : null}
    </View>
  );
}

function getBookingStatusLabel(booking = {}) {
  return bookingStatusLabel(booking);
}

function getBookingRequestedLabel(booking = {}) {
  return bookingRequestedLabel(booking);
}

function LiveTranscript({ call }) {
  const scroll = useRef(null);
  const follow = useRef(true);
  const status = ({ connecting: "Connecting transcript…", live: "Live transcript · Customer / DDD", saved: "Transcript saved", unavailable: "Full transcript unavailable · available conversation shown", off: "Live transcription is off" })[call.transcriptionStatus] || "AI conversation · full-call transcription is off";
  return <View style={{ gap: 8 }}>
    <Text style={styles.muted}>{status}</Text>
    <ScrollView ref={scroll} nestedScrollEnabled style={[styles.transcriptBox, { maxHeight: 260 }]} contentContainerStyle={{ padding: 12, gap: 12 }} onScroll={({ nativeEvent: event }) => { follow.current = event.contentSize.height - event.layoutMeasurement.height - event.contentOffset.y < 48; }} scrollEventThrottle={100} onContentSizeChange={() => { if (follow.current) scroll.current?.scrollToEnd({ animated: false }); }} accessibilityLabel="Live call transcript">
      {(call.transcript || []).length ? call.transcript.map((turn, index) => <Text selectable key={turn.itemId || index} style={[styles.record, turn.complete === false && { opacity: 0.65, fontStyle: "italic" }]}><Text style={{ fontWeight: "800" }}>{turn.speaker}: </Text>{turn.text}</Text>) : <Text style={styles.muted}>Waiting for the conversation to begin.</Text>}
    </ScrollView>
  </View>;
}

function ActiveCallTranscript({ baseUrl, accessCode, callId }) {
  const [call, setCall] = useState({ transcript: [], transcriptionStatus: "connecting" });
  useEffect(() => {
    let alive = true;
    let timer;
    const refresh = async () => {
      try {
        const result = await apiGet(baseUrl, `/api/calls/${encodeURIComponent(callId)}/transcript`, accessCode);
        if (alive) setCall({ transcript: result.transcript || [], transcriptionStatus: result.status });
      } catch { if (alive) setCall((value) => ({ ...value, transcriptionStatus: "unavailable" })); }
      finally { if (alive) timer = setTimeout(refresh, 2000); }
    };
    setCall({ transcript: [], transcriptionStatus: "connecting" });
    refresh();
    return () => { alive = false; clearTimeout(timer); };
  }, [baseUrl, accessCode, callId]);
  return <Card title="Current conversation"><LiveTranscript call={call} /></Card>;
}

function LiveCallsPanel({ baseUrl, accessCode, phone, onError, onText }) {
  const [calls, setCalls] = useState([]);
  const [connectionError, setConnectionError] = useState("");
  const [collapsed, setCollapsed] = useState({});
  const [drafts, setDrafts] = useState({});
  const [drafting, setDrafting] = useState(null);
  useEffect(() => {
    let alive = true;
    let timer;
    const refresh = async () => {
      try {
        const result = await apiGet(baseUrl, "/api/calls/live", accessCode);
        if (alive) { setCalls(result.calls || []); setConnectionError(""); }
      } catch { if (alive) setConnectionError("Live updates interrupted. Reconnecting…"); }
      finally { if (alive) timer = setTimeout(refresh, 3000); }
    };
    refresh();
    return () => { alive = false; clearTimeout(timer); };
  }, [baseUrl, accessCode]);
  if (!calls.length && !connectionError) return null;
  const run = (operation) => operation().catch((error) => onError(error.message));
  async function getDrafts(call) {
    setDrafting(call.callId);
    try { const result = await apiPost(baseUrl, `/api/live-calls/${encodeURIComponent(call.callId)}/drafts`, {}, accessCode); setDrafts((value) => ({ ...value, [call.callId]: result.replies || [] })); }
    catch (error) { onError(error.message); }
    finally { setDrafting(null); }
  }
  return <View style={{ gap: 8 }}>{connectionError ? <Text style={styles.warningText}>{connectionError}</Text> : null}{calls.map((call) => <Card title={`Live · ${formatPhone(call.phone) || "Customer"}`} key={call.callId}>
    <Text style={styles.record}>{call.status || "AI is answering"}</Text>
    <View style={styles.buttonRow}>
      {call.capabilities.listen && !phone.call ? <ActionButton label="Listen" variant="light" disabled={!phone.ready} onPress={() => run(() => phone.joinLive(call, "listen"))} /> : null}
      {call.capabilities.takeOver && !phone.call ? <ActionButton label="Answer" disabled={!phone.ready} onPress={() => run(() => phone.joinLive(call, "answer"))} /> : null}
      {call.capabilities.takeOver && phone.call?.liveCallId === call.callId && phone.call.mode === "listen" ? <ActionButton label="Answer" onPress={() => run(phone.takeOver)} /> : null}
      {call.phone ? <ActionButton label="Text customer" variant="light" onPress={() => onText(call.phone)} /> : null}
    </View>
    <ActionButton label={collapsed[call.callId] ? "Show transcript" : "Hide transcript"} onPress={() => setCollapsed((value) => ({ ...value, [call.callId]: !value[call.callId] }))} variant="light" />
    {!collapsed[call.callId] ? <LiveTranscript call={call} /> : null}
    <ActionButton label={drafting === call.callId ? "Preparing replies..." : "Suggest replies"} disabled={drafting === call.callId || !call.transcript.length} variant="light" onPress={() => getDrafts(call)} />
    {(drafts[call.callId] || []).map((reply, index) => <Text key={index} selectable style={styles.record}>{reply}</Text>)}
  </Card>)}</View>;
}

function MessageBody({ body, outbound }) {
  const open = async (url) => {
    try { await Linking.openURL(url); }
    catch { Alert.alert("Link unavailable", "Please try again in your browser."); }
  };
  return <Text selectable style={[styles.textBubbleBody, outbound && styles.textBubbleBodyOutbound]}>{body.split(/(https?:\/\/[^\s<>]+)/g).map((part, index) => {
      if (!/^https?:\/\//.test(part)) return part;
      const url = part.replace(/[.,;!?)]+$/, "");
      let host;
      try { host = new URL(url).hostname; } catch { return part; }
      const label = host === "apps.apple.com" ? "Open iPhone app" : host === "play.google.com" ? "Open Android app" : host === "dddcincy.com" && url.includes("book-service") ? "Book service" : host === "dddcincy.com" && url.includes("login") ? "View booking" : host === "dddcincy.com" ? "Open DDD link" : `Open ${host}`;
      return <Text accessibilityRole="link" accessibilityLabel={label} key={`${index}-${url}`} onPress={() => open(url)} style={{ color: "#005e7a", fontWeight: "700", textDecorationLine: "underline" }}>{label}{part.slice(url.length)}</Text>;
    })}</Text>;
}

function CallsTab({ staff, dialRequest, adminPin, apiBaseUrl, calls, insights, setStatus, setStaffPhone, staffPhone, onText, nativePhone }) {
  const [dialerOpen, setDialerOpen] = useState(false);
  const [dialPhone, setDialPhone] = useState("");
  const [calling, setCalling] = useState(false);
  const callGroups = useMemo(() => groupCallsByCaller(calls || []), [calls]);

  useEffect(() => { if (dialRequest) setDialerOpen(true); }, [dialRequest]);
  async function startOutboundCall() {
    if (!canWork(staff)) return;
    const to = normalizeE164(dialPhone);
    if (!to) {
      setStatus("Enter the customer number to call.");
      return;
    }
    setCalling(true);
    try {
      await nativePhone.dial(to);
      setStatus("Calling from DDD.");
    } catch (error) {
      setStatus(error.message);
    } finally {
      setCalling(false);
    }
  }

  return (
    <>
      <ActionButton label={dialerOpen ? "Close dialer" : "Dial a number"} onPress={() => setDialerOpen(!dialerOpen)} />
      {dialerOpen ? <Card title="Call from DDD">
        <Text style={styles.muted}>{nativePhone.status}</Text>
        <Field keyboardType="phone-pad" label="Customer phone" onChangeText={setDialPhone} value={dialPhone} />
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>{["1", "2", "3", "4", "5", "6", "7", "8", "9", "*", "0", "#"].map((digit) => <Pressable key={digit} accessibilityRole="button" accessibilityLabel={`Dial ${digit}`} onPress={() => setDialPhone((value) => `${value}${digit}`)} style={{ width: "30%", flexGrow: 1, height: 48, alignItems: "center", justifyContent: "center", backgroundColor: "#20343d", borderRadius: 8 }}><Text style={{ color: "#fff", fontSize: 22 }}>{digit}</Text></Pressable>)}</View>
        <ActionButton label="Delete last digit" variant="light" onPress={() => setDialPhone((value) => value.slice(0, -1))} />
        {nativePhone.callerIds.length > 1 ? <View style={styles.buttonRow}>{nativePhone.callerIds.map((id) => <ActionButton key={id} label={formatPhone(id)} onPress={() => nativePhone.setCallerId(id)} variant={id === nativePhone.callerId ? undefined : "light"} />)}</View> : null}
        <ActionButton disabled={!canWork(staff) || calling || Boolean(nativePhone.call) || !nativePhone.ready} label={calling ? "Calling..." : nativePhone.call ? "Call in progress" : "Call from DDD"} onPress={startOutboundCall} />
      </Card> : null}
      <Text style={styles.screenHeading}>Recent calls</Text>
        {callGroups.map((group, index) => (
          <CallCard onText={onText} onRecording={async (call) => { if (!canWork(staff)) return; try { const result = await apiPost(apiBaseUrl, `/api/calls/${encodeURIComponent(call.callId || call.id)}/recording-link`, {}, adminPin); await Linking.openURL(result.url); } catch (error) { setStatus(error.message); } }} onCall={(phone) => { setDialPhone(phone); setDialerOpen(true); }} call={group.latest} callGroup={group} key={group.key || group.latest?.id || group.latest?.callId || index} />
        ))}
        {callGroups.length ? null : <Text style={styles.muted}>Forwarded calls will appear here.</Text>}
    </>
  );
}

function CallCard({ call: latestCall, callGroup, onText, onCall, onRecording }) {
  const [expanded, setExpanded] = useState(false);
  const [transcriptOpen, setTranscriptOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const call = callGroup?.calls?.[selectedIndex] || latestCall;
  const complete = call.completion === "complete" || call.bookings?.length;
  const incomplete = call.completion === "incomplete" || call.outcome?.hungUpEarly;
  const transcript = formatCallTranscript(call);
  const vehicle = call.bookings?.[0]?.vehicle || call.leads?.[0]?.vehicle || "";
  const missing = call.bookings?.[0]?.confidence?.missing || call.leads?.[0]?.confidence?.missing || [];
  const repeatCalls = callGroup?.calls || [call];
  return (
    <View style={[styles.listCard, { backgroundColor: "#e3e8ed", borderRadius: 8 }]}>
      <Pressable onPress={() => setExpanded(!expanded)} accessibilityRole="button" accessibilityLabel="Expand call details">
      <View style={styles.listHeader}>
        <Text style={styles.listTitle} numberOfLines={1}>{formatPhone(call.caller || call.from || "Unknown caller")}</Text>
        <Text style={styles.pill}>{repeatCalls.length > 1 ? `${repeatCalls.length} calls` : call.durationLabel || formatDuration(call.durationSeconds) || "No time"}</Text>
      </View>
      <Text style={styles.muted}>{formatDateTime(call.startedAt || call.createdAt)} · {call.displayStatus || "Call received"}</Text>
      </Pressable>
      {expanded ? <>
      <View style={styles.buttonRow}><ActionButton label="Text back" onPress={() => onText(call.caller || call.from)} /><ActionButton label="Call back" onPress={() => onCall(call.caller || call.from)} variant="light" /></View>
      <View style={styles.callChipRow}>
        <Text style={[styles.smallChip, complete && styles.smallChipOk, incomplete && styles.smallChipWarn]}>{call.displayStatus || call.outcome?.label || "Logged"}</Text>
        <Text style={styles.smallChip}>{call.outcome?.callerStayedOn ? "Stayed on" : call.outcome?.hungUpEarly ? "Hung up early" : "Review time"}</Text>
        <Text style={styles.smallChip}>{call.smsStatus ? `SMS ${call.smsStatus}` : "SMS none"}</Text>
        <Text style={styles.smallChip}>{call.recordingUrl || call.recordingStatus === "available" ? "Recording" : "No recording"}</Text>
      </View>
      <Text style={styles.record}>{cleanCallDetail(call.outcome?.detail || "Call logged for review.")}</Text>
      {vehicle ? <Text style={styles.record}>Vehicle: {vehicle}</Text> : null}
      {missing.length ? <Text style={styles.warningText}>Needs: {missing.join(", ")}</Text> : null}
      {repeatCalls.length > 1 ? (
        <View style={styles.transcriptBox}>
          <Text style={styles.linkLabel}>Caller history</Text>
          {repeatCalls.map((item, index) => (
            <Pressable onPress={() => { setSelectedIndex(index); setTranscriptOpen(false); }} key={item.id || item.callId || index}><Text style={styles.record}>
              {index === 0 ? "Latest: " : ""}{formatDateTime(item.startedAt || item.createdAt)} - {item.displayStatus || item.outcome?.label || "Logged"}{item.durationLabel ? ` - ${item.durationLabel}` : ""}{item.smsStatus && item.smsStatus !== "none" ? ` - SMS ${item.smsStatus}` : ""}
            </Text></Pressable>
          ))}
        </View>
      ) : null}
      {call.recordingUrl ? <ActionButton label="Play recording" onPress={() => onRecording(call)} variant="light" /> : null}
      <ActionButton label={transcriptOpen ? "Hide transcript" : "Full transcript"} onPress={() => setTranscriptOpen(!transcriptOpen)} variant="light" />
      {transcriptOpen ? <View style={styles.transcriptBox}>
        <Text style={styles.linkLabel}>Transcript</Text>
        {call.transcriptionStatus === "unavailable" ? <Text style={styles.warningText}>Full-call transcription was unavailable. Available conversation is shown below.</Text> : null}
        <ScrollView style={styles.transcriptScroll} nestedScrollEnabled>
          <Text selectable style={styles.transcriptText}>{transcript || "Transcript will appear after the call is processed."}</Text>
        </ScrollView>
      </View> : null}
      </> : null}
    </View>
  );
}

function groupCallsByCaller(calls = []) {
  const grouped = new Map();
  for (const call of calls) {
    const key = getCallCallerKey(call);
    if (!grouped.has(key)) {
      grouped.set(key, { key, caller: call.caller || call.from || "", calls: [] });
    }
    const group = grouped.get(key);
    group.calls.push(call);
    if (!group.caller && (call.caller || call.from)) group.caller = call.caller || call.from;
  }
  return [...grouped.values()]
    .map((group) => {
      const sorted = group.calls.sort((a, b) => String(b.startedAt || b.createdAt || "").localeCompare(String(a.startedAt || a.createdAt || "")));
      return { ...group, calls: sorted, latest: sorted[0] };
    })
    .sort((a, b) => String(b.latest?.startedAt || b.latest?.createdAt || "").localeCompare(String(a.latest?.startedAt || a.latest?.createdAt || "")));
}

function getCallCallerKey(call = {}) {
  return normalizeE164(call.caller || call.from || "") || String(call.caller || call.from || call.callId || call.id || "unknown");
}

function formatCallTranscript(call = {}) {
  if (Array.isArray(call.transcript) && call.transcript.length) {
    return call.transcript
      .map((item) => {
        const speaker = String(item.speaker || item.role || "Call").replace(/_/g, " ");
        const text = String(item.text || item.content || item.message || "").trim();
        return text ? `${speaker}: ${text}` : "";
      })
      .filter(Boolean)
      .join("\n\n");
  }
  return String(call.transcriptText || "").replace(/\n{3,}/g, "\n\n").trim();
}

function PeriodInsight({ label, period = {} }) {
  return (
    <LinearGradient colors={["#fffaff", "#f7fffb"]} style={styles.periodCard}>
      <View style={styles.listHeader}>
        <Text style={styles.listTitle}>{label}</Text>
        <Text style={styles.pill}>{period.calls || 0} calls</Text>
      </View>
      <View style={styles.callChipRow}>
        <Text style={styles.smallChip}>{period.bookings || 0} booked</Text>
        <Text style={styles.smallChip}>{period.missed || 0} missed</Text>
        <Text style={styles.smallChip}>{formatDuration(period.averageDurationSeconds || 0)} avg</Text>
      </View>
      <Text style={styles.record} numberOfLines={2}>
        Top: {period.topServices?.[0]?.label || "not enough data"} - {period.topLocations?.[0]?.label || "no location trend yet"}
      </Text>
    </LinearGradient>
  );
}

function InsightsTab({ calls = [], hasPin, insights, onRefresh }) {
  const report = useMemo(() => normalizeInsightReport(insights, calls), [calls, insights]);
  const daily = report.sections.daily || {};
  const activeDay = report.sections.latestActiveDay || daily;
  const weekly = report.sections.weekly || {};
  const monthly = report.sections.monthly || {};
  const hasRealInsights = Boolean(insights?.sections);
  return (
    <>
      <Card title="Business brain">
        <View style={styles.listHeader}>
          <Text style={styles.muted}>
            {hasPin
              ? hasRealInsights
                ? "Live reports loaded from DDD AI."
                : "Showing backup reports from recent call logs."
              : "Enter your DDD access code on Home to unlock live reports."}
          </Text>
          <ActionButton label="Refresh" onPress={onRefresh} variant="light" />
        </View>
        <View style={styles.summaryGrid}>
          <SummaryTile label={activeDay.label === daily.label ? "Today" : "Latest"} value={activeDay.calls || 0} />
          <SummaryTile label="Week" value={weekly.calls || 0} />
          <SummaryTile label="Month" value={monthly.calls || 0} />
          <SummaryTile label="SMS" value={formatPercent(weekly.smsCoverageRate || activeDay.smsCoverageRate)} />
        </View>
        {(report.suggestions || []).slice(0, 5).map((suggestion, index) => (
          <LinearGradient key={`${suggestion}-${index}`} colors={["#fffaff", "#f7fffb"]} style={styles.listCard}>
            <Text style={styles.linkLabel}>Suggestion {index + 1}</Text>
            <Text style={styles.record} numberOfLines={4}>{suggestion}</Text>
          </LinearGradient>
        ))}
        {report.suggestions?.length ? null : <Text style={styles.muted}>Suggestions will appear after more calls and transcripts.</Text>}
      </Card>
      <Card title="What changed">
        <InsightRow label="Bookings" value={`${weekly.bookings || 0} weekly / ${monthly.bookings || 0} monthly`} />
        <InsightRow label="Needs review" value={weekly.needsReview || activeDay.needsReview || 0} />
        <InsightRow label="Missed/fallback" value={weekly.missed || activeDay.missed || 0} />
        <InsightRow label="Avg time" value={formatDuration(weekly.averageDurationSeconds || activeDay.averageDurationSeconds || 0)} />
      </Card>
      <Card title="Hot spots">
        <MiniList title="Top services" items={weekly.topServices?.length ? weekly.topServices : activeDay.topServices || []} />
        <MiniList title="Top locations" items={weekly.topLocations?.length ? weekly.topLocations : activeDay.topLocations || []} />
        <MiniList title="Caller types" items={weekly.callerTypes?.length ? weekly.callerTypes : activeDay.callerTypes || []} />
      </Card>
    </>
  );
}

function Card({ children, title }) {
  return (
    <View style={styles.card}>
      <LinearGradient colors={rainbowColors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.cardBar} />
      <Text style={styles.cardTitle}>{title}</Text>
      {children}
    </View>
  );
}

function Field({ autoCapitalize = "sentences", editable = true, keyboardType = "default", label, multiline = false, onChangeText, secureTextEntry = false, value }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        autoCapitalize={autoCapitalize}
        keyboardType={keyboardType}
        multiline={multiline}
        editable={editable}
        onChangeText={onChangeText}
        secureTextEntry={secureTextEntry}
        style={[styles.input, !editable && styles.lockedInput, multiline && styles.textarea]}
        textAlignVertical={multiline ? "top" : "center"}
        value={String(value || "")}
      />
    </View>
  );
}

function ActionButton({ disabled = false, label, onPress, variant = "primary" }) {
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        variant === "light" && styles.lightButton,
        disabled && styles.disabledButton,
        pressed && !disabled && styles.pressedButton
      ]}
    >
      {variant === "light" ? (
        <Text style={[styles.buttonText, styles.lightButtonText]}>{label}</Text>
      ) : (
        <LinearGradient colors={rainbowColors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.buttonGradient}>
          <Text style={styles.buttonText}>{label}</Text>
        </LinearGradient>
      )}
    </Pressable>
  );
}

function Metric({ label, value }) {
  return (
    <LinearGradient colors={["#fffaff", "#f5fffb"]} style={styles.metric}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{String(value)}</Text>
    </LinearGradient>
  );
}

function SegmentedOptions({ disabled = false, options, selected, onSelect }) {
  const usableOptions = options?.length ? options : [{ id: selected || "marin", label: selected || "Marin" }];
  return (
    <View style={styles.segmentWrap}>
      {usableOptions.map((option) => (
        <Pressable
          key={option.id}
          disabled={disabled}
          onPress={() => onSelect(option.id)}
          style={[styles.segment, disabled && styles.segmentDisabled, selected === option.id && styles.segmentSelected]}
        >
          <Text style={[styles.segmentText, selected === option.id && styles.segmentTextSelected]}>{option.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

function SetupBadges({ setup }) {
  const items = [
    ["OpenAI", setup.required?.openAIKey],
    ["Webhook", setup.required?.webhookSecret],
    ["Public URL", setup.required?.publicBaseUrl],
    ["Google Voice", setup.required?.googleVoiceNumber],
    ["AI Number", setup.required?.aiForwardingNumber],
    ["SMS", setup.required?.smsDelivery]
  ];
  return (
    <View style={styles.badges}>
      {items.map(([label, ok]) => (
        <Text key={label} style={[styles.badge, ok ? styles.badgeOk : styles.badgeMissing]}>
          {ok ? "Ready" : "Missing"} {label}
        </Text>
      ))}
    </View>
  );
}

function SwitchRow({ disabled, label, note, onValueChange, value }) {
  return (
    <View style={styles.statusRow}>
      <View style={styles.flexText}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.muted}>{note}</Text>
      </View>
      <Switch disabled={disabled} onValueChange={onValueChange} value={value} />
    </View>
  );
}

function InsightRow({ label, value }) {
  return (
    <View style={styles.insightRow}>
      <Text style={styles.muted}>{label}</Text>
      <Text style={styles.listTitle}>{value == null || value === "" ? "0" : String(value)}</Text>
    </View>
  );
}

function SummaryTile({ label, tone = "ok", value }) {
  return (
    <LinearGradient colors={tone === "warn" ? ["#fff7ed", "#fff0fa"] : ["#f7fffb", "#fffaff"]} style={styles.summaryTile}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.summaryValue}>{String(value ?? 0)}</Text>
    </LinearGradient>
  );
}

function MiniList({ items = [], title }) {
  const list = items.slice(0, 4);
  return (
    <View style={styles.miniList}>
      <Text style={styles.linkLabel}>{title}</Text>
      {list.map((item, index) => (
        <View key={`${title}-${item.label || index}`} style={styles.miniListRow}>
          <Text style={styles.record} numberOfLines={1}>{item.label || "Unknown"}</Text>
          <Text style={styles.pill}>{item.count || item.value || 0}</Text>
        </View>
      ))}
      {list.length ? null : <Text style={styles.muted}>Not enough data yet.</Text>}
    </View>
  );
}

function setCallerFlow(setSettings, key, value) {
  setSettings((current) => ({
    ...current,
    callerFlows: { ...current.callerFlows, [key]: value }
  }));
}

function normalizeBaseUrl(value) {
  const cleaned = String(value || defaultApiBaseUrl).trim().replace(/\/+$/, "");
  return cleaned.startsWith("http") ? cleaned : defaultApiBaseUrl;
}

function isAdminStaff(staff) {
  const role = String(staff?.role || "").trim().toLowerCase();
  const name = String(staff?.name || "").trim().toLowerCase();
  return ["admin", "administrator", "owner", "manager", "super_admin", "dispatch_admin"].includes(role);
}

async function loadOperations(baseUrl, accessCode) {
  const operations = await apiGet(baseUrl, "/api/operations", accessCode);
  if (operations.summary?.activeCalls == null && canWork(operations.staff)) {
    const live = await apiGet(baseUrl, "/api/calls/live", accessCode).catch(() => ({ calls: [] }));
    return { ...operations, liveCalls: live.calls || [] };
  }
  return operations;
}

async function apiGet(baseUrl, path, adminPin = "") {
  const response = await fetch(`${baseUrl}${path}`, {
    headers: accessHeaders(adminPin)
  });
  if (!response.ok) throw new Error(`Could not load ${path}.`);
  return response.json();
}

async function apiPost(baseUrl, path, payload, adminPin = "") {
  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...accessHeaders(adminPin) },
    body: JSON.stringify(payload)
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || `Could not save ${path}.`);
  }
  return response.json();
}

async function apiDelete(baseUrl, path, adminPin = "") {
  const response = await fetch(`${baseUrl}${path}`, {
    method: "DELETE",
    headers: accessHeaders(adminPin)
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || `Could not delete ${path}.`);
  }
  return response.json();
}

function accessHeaders(code = "") {
  const clean = String(code || "").trim();
  return clean ? { "x-admin-pin": clean, "x-staff-code": clean } : {};
}

function toFormSettings(settings) {
  return {
    ...blankSettings,
    ...settings,
    voiceSpeed: Number(settings.voiceSpeed || 1),
    qualifyingServicesText: (settings.qualifyingServices || []).join("\n"),
    bookingDestinationsText: formatBookingDestinations(settings.bookingDestinations || []),
    callerFlows: {
      ...blankSettings.callerFlows,
      ...(settings.callerFlows || {})
    },
    soundPreferences: {
      ...blankSettings.soundPreferences,
      ...(settings.soundPreferences || {}),
      backgroundAudio: {
        ...blankSettings.soundPreferences.backgroundAudio,
        ...(settings.soundPreferences?.backgroundAudio || {})
      }
    },
    noiseHandling: {
      ...blankSettings.noiseHandling,
      ...(settings.noiseHandling || {})
    },
    directoryReferral: {
      ...blankSettings.directoryReferral,
      ...(settings.directoryReferral || {})
    },
    humanRouting: {
      ...blankSettings.humanRouting,
      ...(settings.humanRouting || {}),
      numbers: Array.isArray(settings.humanRouting?.numbers) ? settings.humanRouting.numbers : [],
      transferTriggers: Array.isArray(settings.humanRouting?.transferTriggers) ? settings.humanRouting.transferTriggers : []
    },
    smsFollowUp: {
      ...blankSettings.smsFollowUp,
      ...(settings.smsFollowUp || {})
    },
    reviewFollowUp: {
      ...blankSettings.reviewFollowUp,
      ...(settings.reviewFollowUp || {})
    },
    notificationPreferences: {
      ...blankSettings.notificationPreferences,
      ...(settings.notificationPreferences || {})
    },
    voiceOptions: settings.voiceOptions || []
  };
}

function fromFormSettings(settings) {
  return {
    enabled: settings.enabled,
    voice: settings.voice,
    voiceSpeed: settings.voiceSpeed,
    voiceDirection: settings.voiceDirection,
    greeting: settings.greeting,
    businessKnowledge: settings.businessKnowledge,
    customInstructions: settings.customInstructions,
    serviceArea: settings.serviceArea,
    pricingNotes: settings.pricingNotes,
    emergencyInstructions: settings.emergencyInstructions,
    humanHandoffRules: settings.humanHandoffRules,
    complaintInstructions: settings.complaintInstructions,
    applyInstructions: settings.applyInstructions,
    offeredServices: settings.offeredServices,
    notOfferedServices: settings.notOfferedServices,
    directoryReferral: settings.directoryReferral,
    afterHoursInstructions: settings.afterHoursInstructions,
    callOutcomeRules: settings.callOutcomeRules,
    fallbackRules: settings.fallbackRules,
    qualifyingServices: settings.qualifyingServicesText,
    followUpStyle: settings.followUpStyle,
    outOfScopeHandling: settings.outOfScopeHandling,
    callerFlows: settings.callerFlows,
    soundPreferences: settings.soundPreferences,
    noiseHandling: {
      ...settings.noiseHandling,
      eagerness: settings.noiseHandling?.mode === "fast" ? "medium" : "low",
      interruptResponse: settings.noiseHandling?.mode === "fast" && settings.noiseHandling?.interruptResponse === true
    },
    smsFollowUp: settings.smsFollowUp,
    reviewFollowUp: settings.reviewFollowUp,
    humanRouting: {
      ...settings.humanRouting,
      timeoutSeconds: Number(settings.humanRouting?.timeoutSeconds || 22),
      numbers: normalizeHumanRouteNumbers(settings.humanRouting?.numbers || []),
      transferTriggers: Array.isArray(settings.humanRouting?.transferTriggers) ? settings.humanRouting.transferTriggers : []
    },
    notificationPreferences: settings.notificationPreferences,
    bookingDestinations: parseBookingDestinations(settings.bookingDestinationsText)
  };
}

function formatBookingDestinations(destinations) {
  return destinations
    .map((destination) => `${destination.label || ""} | ${destination.url || ""} | ${destination.useWhen || ""}`)
    .join("\n");
}

function parseBookingDestinations(value) {
  return String(value || "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [label = "", url = "", ...useWhenParts] = line.split("|").map((part) => part.trim());
      return { label, url, useWhen: useWhenParts.join(" | ") };
    })
    .filter((destination) => destination.label && destination.url && destination.useWhen);
}

function formatHumanRouteNumbers(numbers = []) {
  return (Array.isArray(numbers) ? numbers : [])
    .map((entry) => `${entry.label || entry.name || "DDD team"} | ${formatPhone(entry.phone || "")}`)
    .join("\n");
}

function parseHumanRouteNumbers(value) {
  return String(value || "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [label = "DDD team", phone = ""] = line.split("|").map((part) => part.trim());
      return { label, phone: normalizeE164(phone) || phone };
    })
    .filter((entry) => entry.label && normalizeE164(entry.phone));
}

function normalizeHumanRouteNumbers(numbers = []) {
  return (Array.isArray(numbers) ? numbers : [])
    .map((entry) => ({
      label: String(entry.label || entry.name || "DDD team").trim(),
      phone: normalizeE164(entry.phone || "")
    }))
    .filter((entry) => entry.label && entry.phone);
}

function clampSpeed(value) {
  return Math.min(1.5, Math.max(0.5, Math.round(Number(value) * 100) / 100));
}

function formatDateTime(value) {
  if (!value) return "Not set";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
}

function isSameDay(value, compareDate) {
  if (!value) return false;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  return date.toDateString() === compareDate.toDateString();
}

function formatPhone(value) {
  const digits = String(value || "").replace(/\D/g, "");
  const normalized = digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
  if (normalized.length !== 10) return String(value || "");
  return `(${normalized.slice(0, 3)}) ${normalized.slice(3, 6)}-${normalized.slice(6)}`;
}

function normalizeE164(value) {
  const digits = String(value || "").replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return "";
}

function getConversationCustomer(conversation = {}) {
  return conversationPhone(conversation) || conversationPhone({ from: conversation.messages?.at?.(-1)?.from });
}

function getConversationName(conversation = {}) {
  const booking = conversation.bookings?.[0] || {};
  return booking.customerName || booking.customer_name || booking.name || conversation.customerName || conversation.customer_name || conversation.callerName || conversation.name || "Customer";
}

function getConversationPreview(conversation = {}) {
  if (conversation.lastBody) return cleanConversationBody(conversation.lastBody).replace(/https?:\/\/\S+/g, "[link]");
  if (conversation.lastMessage || conversation.preview) return cleanConversationBody(conversation.lastMessage || conversation.preview);
  const last = conversation.messages?.at?.(-1);
  return cleanConversationBody(last?.body || last?.message || last?.text || "No message preview available.");
}

function getConversationTime(conversation = {}) {
  const last = conversation.messages?.at?.(-1);
  return conversation.lastMessageAt || conversation.updatedAt || conversation.lastAt || last?.createdAt || last?.at || "";
}

function threadAccent(phone = "") {
  return ["#ff62ab", "#ffb85c", "#f2d65c", "#59dfb1", "#62cfff", "#c59aff"][Number(String(phone).replace(/\D/g, "").slice(-2)) % 6];
}

function cleanConversationBody(value = "") {
  const raw = String(value || "").replace(/\r\n?/g, "\n").replace(/[^\S\n]+/g, " ").trim();
  if (!raw) return "";
  if (/^Call:\s*.*(?:\bsips?:|\bSIP\b|\bPSTN\b|twilio\.)/i.test(raw)) return "Call received";
  const withoutCallPrefix = raw.replace(/^Call:\s*/i, "").trim();
  const statusLabel = formatMessageStatus(withoutCallPrefix);
  if (statusLabel && (withoutCallPrefix !== raw || /staff-sms-reply|email-sent|push-\d+|sms-[\w-]+/i.test(raw))) {
    return statusLabel;
  }
  return raw.replace(/^Call:\s*/i, "Call received: ");
}

function getDeliveryIssue(message = {}) {
  const status = String(message.status || "").toLowerCase();
  if (!/failed|undelivered|error/.test(status)) return "";
  const reason = String(message.errorMessage || message.reason || "").replace(/\s+/g, " ").trim();
  const code = String(message.errorCode || "").trim();
  if (reason && code) return `Delivery issue ${code}: ${reason}`;
  if (reason) return `Delivery issue: ${reason}`;
  if (code) return `Delivery issue ${code}`;
  return "This text could not be sent. Check the number and try again.";
}

function formatMessageStatus(value = "") {
  const status = String(value || "").toLowerCase();
  if (!status) return "";
  if (/staff-sms-reply/.test(status) && /failed/.test(status)) return "Text reply failed";
  if (/sms/.test(status) && /failed/.test(status)) return "Text failed";
  if (/failed|undelivered/.test(status)) return "Couldn't deliver";
  if (status === "delivered") return "Delivered";
  if (status === "sent") return "Sent";
  if (/queued|sending|accepted/.test(status)) return "Sending";
  if (/received/.test(status)) return "";
  if (/email-sent/.test(status) && /push-\d+/.test(status)) return "Alerts sent";
  if (/email-sent/.test(status)) return "Email alert sent";
  if (/push-\d+/.test(status)) return "Push alert sent";
  if (/completed|complete/.test(status)) return "Completed";
  if (/busy/.test(status)) return "Busy";
  if (/no-answer|missed/.test(status)) return "Missed";
  return "";
}

function buildQuickReplies(conversation = {}, settings = blankSettings) {
  const text = `${conversation.lastBody || ""} ${(conversation.messages || []).map((message) => message.body || message.text || "").join(" ")}`.toLowerCase();
  const base = [
    {
      label: "Professional follow-up",
      text: "Hi, this is DDD. What service do you need, what vehicle is it for, and what is the service location? Reply STOP to stop."
    },
    {
      label: "Booking link",
      text: "Book online:\nhttps://dddcincy.com/book-service/\n\nDDD Mobile for iPhone:\nhttps://apps.apple.com/app/id6762315831\n\nDDD Mobile for Android:\nhttps://play.google.com/store/apps/details?id=com.dddroadside.mobile\n\nReply STOP to stop."
    },
    {
      label: "Google review",
      text: buildGoogleReviewReply(settings)
    },
    {
      label: "Get location",
      text: "Please send the exact address or nearest cross streets, plus the vehicle color. Reply STOP to stop."
    },
    {
      label: "On it",
      text: "Got it. DDD has this and will follow up shortly. Reply STOP to stop."
    }
  ];
  if (/complain|refund|damage|upset|manager|bad/i.test(text)) {
    return [
      {
        label: "Complaint",
        text: "I'm sorry that happened. Please send your name, service date, what happened, and the best callback number. You can also email support@dddcincy.com. Reply STOP to stop."
      },
      ...base.slice(0, 3)
    ];
  }
  if (/oil|brake|rotor|hub|battery|tire|flat|plug|spare/i.test(text)) {
    return [
      {
        label: "Parts/details",
        text: "Do you already have the parts/materials, or should DDD confirm them? For tire/brake work, include quantity or position. Reply STOP to stop."
      },
      ...base
    ];
  }
  return base;
}

function buildGoogleReviewReply(settings = blankSettings) {
  const reviewLink = String(settings.reviewFollowUp?.url || blankSettings.reviewFollowUp.url || "https://g.page/r/CfVinSqxHOIDEAE/review").trim();
  const template = String(
    settings.reviewFollowUp?.message ||
      blankSettings.reviewFollowUp.message ||
      "Thanks again for choosing DDD. If everything went well, please leave a quick Google review here: {{reviewLink}}"
  ).trim();
  const message = template.includes("{{reviewLink}}")
    ? template.replaceAll("{{reviewLink}}", reviewLink)
    : `${template} ${reviewLink}`.trim();
  return ensureSmsStopLanguage(message);
}

function ensureSmsStopLanguage(message) {
  const cleaned = String(message || "").trim();
  if (!cleaned) return "Thanks again for choosing DDD. If everything went well, please leave a quick Google review here: https://g.page/r/CfVinSqxHOIDEAE/review. Reply STOP to stop.";
  if (/\breply stop\b|\bstop to stop\b|\btext stop\b/i.test(cleaned)) return cleaned;
  return `${cleaned} Reply STOP to stop.`;
}

function formatPercent(value) {
  const number = Number(value || 0);
  if (!Number.isFinite(number)) return "0%";
  return `${Math.round(number * 100)}%`;
}

function formatDuration(seconds) {
  const total = Math.max(0, Number(seconds || 0) || 0);
  const minutes = Math.floor(total / 60);
  const remainder = total % 60;
  return minutes ? `${minutes}m ${String(remainder).padStart(2, "0")}s` : `${remainder}s`;
}

function cleanCallDetail(value) {
  const text = String(value || "");
  if (/sip|routing|twilio reported/i.test(text)) return "The call is logged for review.";
  return text;
}

function normalizeInsightReport(insights, calls = []) {
  if (insights?.sections) {
    return {
      generatedAt: insights.generatedAt || new Date().toISOString(),
      sections: {
        daily: insights.sections.daily || {},
        latestActiveDay: insights.sections.latestActiveDay || insights.sections.daily || {},
        weekly: insights.sections.weekly || {},
        monthly: insights.sections.monthly || {}
      },
      suggestions: insights.suggestions || []
    };
  }
  return buildFallbackInsights(calls);
}

function buildFallbackInsights(calls = []) {
  const now = new Date();
  const dayStart = new Date(now);
  dayStart.setHours(0, 0, 0, 0);
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - 7);
  const monthStart = new Date(now);
  monthStart.setDate(now.getDate() - 30);
  const datedCalls = (calls || [])
    .map((call) => ({ ...call, _date: parseCallDate(call) }))
    .filter((call) => call._date);
  const dailyCalls = datedCalls.filter((call) => call._date >= dayStart);
  const weeklyCalls = datedCalls.filter((call) => call._date >= weekStart);
  const monthlyCalls = datedCalls.filter((call) => call._date >= monthStart);
  const sections = {
    daily: summarizeCallPeriod(dailyCalls, "Today"),
    latestActiveDay: summarizeCallPeriod(dailyCalls.length ? dailyCalls : datedCalls.slice(0, 10), dailyCalls.length ? "Today" : "Latest"),
    weekly: summarizeCallPeriod(weeklyCalls, "Last 7 days"),
    monthly: summarizeCallPeriod(monthlyCalls, "Last 30 days")
  };
  const suggestions = [];
  if (sections.weekly.missed > 0) suggestions.push("Missed or early-hangup calls are showing up. Keep the fast follow-up text on so customers can book without staying on the AI call.");
  if ((sections.weekly.smsCoverageRate || 0) < 0.9 && sections.weekly.calls > 0) suggestions.push("Some recent calls do not show SMS sent. Check follow-up texting so every caller gets booking links.");
  if (sections.weekly.topServices?.[0]?.label) suggestions.push(`${sections.weekly.topServices[0].label} is the top recent request. Keep that intake path short and direct.`);
  if (!suggestions.length && datedCalls.length) suggestions.push("Calls are being logged. As more transcripts come in, DDD AI will show stronger daily, weekly, and monthly patterns.");
  return { generatedAt: now.toISOString(), sections, suggestions };
}

function summarizeCallPeriod(calls = [], label = "") {
  const bookings = calls.filter((call) => call.completion === "complete" || call.bookings?.length).length;
  const missed = calls.filter((call) => call.completion === "incomplete" || call.outcome?.hungUpEarly || call.displayStatus?.toLowerCase?.().includes("hung up")).length;
  const needsReview = calls.filter((call) => call.completion === "needs-review" || call.smsStatus === "failed").length;
  const durations = calls.map((call) => Number(call.durationSeconds || 0)).filter((value) => value > 0);
  const smsSent = calls.filter((call) => call.smsStatus === "sent").length;
  return {
    label,
    calls: calls.length,
    bookings,
    missed,
    needsReview,
    averageDurationSeconds: durations.length ? Math.round(durations.reduce((sum, value) => sum + value, 0) / durations.length) : 0,
    smsCoverageRate: calls.length ? smsSent / calls.length : 0,
    topServices: topCounts(calls.map(extractCallService)),
    topLocations: topCounts(calls.map(extractCallLocation)),
    callerTypes: topCounts(calls.map((call) => call.customerType || call.callerType || "Customer"))
  };
}

function topCounts(values = []) {
  const counts = new Map();
  values
    .map((value) => String(value || "").trim())
    .filter(Boolean)
    .forEach((value) => counts.set(value, (counts.get(value) || 0) + 1));
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([label, count]) => ({ label, count }));
}

function extractCallService(call) {
  return call.bookings?.[0]?.service || call.leads?.[0]?.service || call.service || call.intent || call.outcome?.service || "";
}

function extractCallLocation(call) {
  return call.bookings?.[0]?.location || call.leads?.[0]?.location || call.location || call.outcome?.location || "";
}

function parseCallDate(call) {
  const raw = call.startedAt || call.createdAt || call.endedAt || call.timestamp || call.date;
  const parsed = raw ? new Date(raw) : null;
  return parsed && !Number.isNaN(parsed.getTime()) ? parsed : null;
}

function buildScriptPreview(settings) {
  return [
    settings.enabled ? "AI answers new calls." : "AI is paused.",
    `Voice: ${settings.voice}`,
    `Speed: ${Number(settings.voiceSpeed || 1).toFixed(2)}x`,
    `Noise handling: ${settings.noiseHandling?.mode || "patient"}; interruptions ${settings.noiseHandling?.interruptResponse ? "on" : "off"}.`,
    `Greeting: ${settings.greeting || "Thank you for calling Triple D Roadside, this is the receptionist. How can I help today?"}`,
    "",
    "Business knowledge:",
    settings.businessKnowledge || "Add DDD business details here.",
    "",
    `Service area: ${settings.serviceArea || "Greater Cincinnati and nearby service areas."}`,
    `Pricing rules: ${settings.pricingNotes || "Do not quote exact pricing unless added here."}`,
    `Emergency: ${settings.emergencyInstructions || "Collect safety, location, vehicle, and callback number."}`,
    `Complaints: ${settings.complaintInstructions || "Save a high-priority message and share support@dddcincy.com."}`,
    `Apply-to-work: ${settings.applyInstructions || "Collect applicant details and share the apply link."}`,
    `SMS follow-up: ${settings.smsFollowUp.enabled ? "on" : "off"}. ${settings.smsFollowUp.message || "Text the best DDD link after permission."}`,
    `Google review: ${settings.reviewFollowUp.enabled ? "on" : "off"}. ${settings.reviewFollowUp.message || "Ask after completed jobs."}`,
    "",
    "Caller handling:",
    `New: ${settings.callerFlows.newClients || "Qualify and collect booking details."}`,
    `Existing: ${settings.callerFlows.existingClients || "Collect appointment or job details."}`,
    `Sales: ${settings.callerFlows.sales || "Take a message without committing."}`,
    `Other: ${settings.callerFlows.otherCallers || "Collect caller info and reason."}`,
    "",
    "DDD links:",
    settings.bookingDestinationsText || "Add booking, DDD Mobile, dddcincy.com, and apply links."
  ].join("\n");
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#081426", paddingTop: Platform.OS === "android" ? Constants.statusBarHeight || 24 : 0, paddingBottom: Platform.OS === "android" ? 24 : 0 },
  shell: { flex: 1, backgroundColor: "#0d1024" },
  header: {
    marginHorizontal: 10,
    marginTop: 4,
    overflow: "hidden",
    borderColor: "rgba(255, 62, 165, 0.32)",
    borderRadius: 8,
    borderWidth: 1,
    backgroundColor: "#171a32",
    padding: 9,
    shadowColor: "#ff3ea5",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.16,
    shadowRadius: 16,
    elevation: 5
  },
  heroGlow: { height: 3, borderRadius: 999, backgroundColor: "#ff3ea5", marginTop: 7 },
  brandRow: { alignItems: "center", flexDirection: "row", gap: 10 },
  logoFrame: {
    alignItems: "center",
    justifyContent: "center",
    width: 38,
    height: 38,
    borderRadius: 14,
    shadowColor: "#e640a5",
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.14,
    shadowRadius: 12,
    elevation: 3
  },
  logo: { width: 33, height: 33, borderRadius: 12 },
  brandCopy: { flex: 1, minWidth: 0 },
  eyebrow: { color: "#ff8bd6", fontSize: 10, fontWeight: "900", textTransform: "uppercase" },
  title: { color: "#ffffff", fontSize: 17, fontWeight: "900" },
  subtitle: { color: "#e8e4ff", fontSize: 11, fontWeight: "800", lineHeight: 15, marginTop: 4 },
  modePill: {
    overflow: "hidden",
    borderRadius: 999,
    fontSize: 11,
    fontWeight: "900",
    paddingHorizontal: 10,
    paddingVertical: 6
  },
  modePillLive: { backgroundColor: "#e9fff3", color: "#12824d" },
  modePillPaused: { backgroundColor: "#fff0f3", color: "#c23b52" },
  metricStrip: { flexDirection: "row", flexWrap: "wrap", gap: 7, marginTop: 12 },
  metric: {
    width: "48.5%",
    minHeight: 56,
    minWidth: 0,
    borderColor: "rgba(118, 87, 255, 0.14)",
    borderRadius: 16,
    borderWidth: 1,
    backgroundColor: "#fbf7ff",
    padding: 9
  },
  metricLabel: { color: "#a81586", fontSize: 10, fontWeight: "900", textTransform: "uppercase" },
  metricValue: { color: "#161827", fontSize: 15, fontWeight: "900", marginTop: 3 },
  accessBanner: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
    borderColor: "rgba(118, 87, 255, 0.16)",
    borderRadius: 18,
    borderWidth: 1,
    backgroundColor: "#fffaff",
    padding: 10
  },
  accessTitle: { color: "#161827", fontSize: 17, fontWeight: "900" },
  accessPill: {
    overflow: "hidden",
    borderRadius: 999,
    fontSize: 11,
    fontWeight: "900",
    paddingHorizontal: 10,
    paddingVertical: 7
  },
  accessPillReady: { backgroundColor: "#e9fff3", color: "#12824d" },
  accessPillLocked: { backgroundColor: "#fff0f3", color: "#c23b52" },
  pinLoginRow: { alignItems: "flex-end", flexDirection: "row", flexWrap: "wrap", gap: 10 },
  pinFieldWrap: { flex: 1, minWidth: 170 },
  pinButtonWrap: { minWidth: 142 },
  tabWrap: {
    marginHorizontal: 8,
    marginBottom: 4,
    flexShrink: 0,
    borderColor: "rgba(255, 62, 165, 0.28)",
    borderRadius: 22,
    borderWidth: 1,
    overflow: "hidden",
    paddingVertical: 6,
    shadowColor: "#ff3ea5",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.13,
    shadowRadius: 18,
    elevation: 3
  },
  tabContent: {
    flexDirection: "row",
    flexWrap: "nowrap",
    gap: 4,
    justifyContent: "center",
    paddingHorizontal: 6
  },
  tabButton: {
    alignItems: "center",
    flex: 1,
    minHeight: 52,
    flexDirection: "column",
    gap: 3,
    justifyContent: "center",
    borderColor: "rgba(255, 255, 255, 0.12)",
    borderRadius: 16,
    borderWidth: 1,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    overflow: "hidden",
    paddingHorizontal: 4
  },
  tabDot: { width: 8, height: 8, borderRadius: 999 },
  tabAccent: { position: "absolute", top: 0, left: 0, right: 0, height: 4 },
  tabText: { color: "#ffffff", fontSize: 12, fontWeight: "800", textAlign: "center" },
  tabTextActive: { color: "#10212b" },
  content: { gap: 11, padding: 12, paddingBottom: 20 },
  card: {
    gap: 11,
    overflow: "hidden",
    borderColor: "rgba(255, 62, 165, 0.28)",
    borderRadius: 8,
    borderWidth: 1,
    backgroundColor: "#e3e8ed",
    padding: 13,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.16,
    shadowRadius: 22,
    elevation: 6
  },
  cardBar: { height: 5, borderRadius: 999, backgroundColor: "#16b8ff" },
  cardTitle: { color: "#161827", fontSize: 20, fontWeight: "900" },
  routeHeader: { alignItems: "center", flexDirection: "row", gap: 12 },
  twoColumnToggles: { gap: 10 },
  moreGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  moreTile: {
    width: "48%",
    minHeight: 82,
    borderRadius: 20,
    overflow: "hidden",
    shadowColor: "#ff3ea5",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.14,
    shadowRadius: 18,
    elevation: 4
  },
  moreTileGradient: { flex: 1, justifyContent: "center", padding: 14 },
  moreTileText: { color: "#ffffff", fontSize: 17, fontWeight: "900" },
  flexText: { flex: 1, minWidth: 0, paddingRight: 10 },
  statusRow: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", gap: 12 },
  buttonRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  field: { gap: 6 },
  label: { color: "#34364a", fontSize: 13, fontWeight: "900" },
  input: {
    minHeight: 48,
    borderColor: "#d9d3ee",
    borderRadius: 16,
    borderWidth: 1,
    backgroundColor: "#ffffff",
    color: "#202236",
    paddingHorizontal: 12,
    paddingVertical: 10
  },
  lockedInput: { backgroundColor: "#fbf9ff", color: "#55576d" },
  textarea: { minHeight: 118 },
  button: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 44,
    borderRadius: 999,
    backgroundColor: "#7657ff",
    overflow: "hidden",
    shadowColor: "#e640a5",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 4
  },
  buttonGradient: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 44,
    paddingHorizontal: 15,
    paddingVertical: 10
  },
  lightButton: { backgroundColor: "#fff0fa", paddingHorizontal: 16, paddingVertical: 10 },
  disabledButton: { opacity: 0.55 },
  pressedButton: { opacity: 0.82 },
  buttonText: { color: "#ffffff", fontWeight: "900" },
  lightButtonText: { color: "#a81586" },
  linkGrid: { flexDirection: "row", flexWrap: "wrap", gap: 9 },
  linkCard: {
    width: "48%",
    minHeight: 76,
    borderColor: "rgba(118, 87, 255, 0.18)",
    borderRadius: 18,
    borderWidth: 1,
    backgroundColor: "#fffaff",
    overflow: "hidden"
  },
  linkCardInner: {
    flex: 1,
    justifyContent: "center",
    padding: 10
  },
  linkLabel: { color: "#a81586", fontSize: 12, fontWeight: "900", textTransform: "uppercase" },
  linkDetail: { color: "#161827", fontSize: 15, fontWeight: "900", marginTop: 4 },
  segmentWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  segment: {
    borderColor: "#d9d3ee",
    borderRadius: 999,
    borderWidth: 1,
    backgroundColor: "#ffffff",
    paddingHorizontal: 12,
    paddingVertical: 9
  },
  segmentDisabled: { backgroundColor: "#fbf9ff", opacity: 0.72 },
  segmentSelected: { borderColor: "#ff3ea5", backgroundColor: "#fff0fa" },
  segmentText: { color: "#4b4e65", fontWeight: "900" },
  segmentTextSelected: { color: "#b7218f" },
  badges: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  badge: { overflow: "hidden", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 7, fontSize: 12, fontWeight: "900" },
  badgeOk: { backgroundColor: "#e9fff3", color: "#12824d" },
  badgeMissing: { backgroundColor: "#fff0f3", color: "#c23b52" },
  listCard: {
    gap: 7,
    borderColor: "rgba(217, 211, 238, 0.9)",
    borderRadius: 18,
    borderWidth: 1,
    backgroundColor: "#fffaff",
    padding: 12,
    shadowColor: "#3b2267",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 3
  },
  listHeader: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", gap: 10 },
  listTitle: { flex: 1, color: "#161827", fontSize: 16, fontWeight: "900" },
  pill: { overflow: "hidden", borderRadius: 999, backgroundColor: "#e9fff3", color: "#12824d", fontSize: 12, fontWeight: "900", paddingHorizontal: 9, paddingVertical: 5 },
  summaryGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  summaryTile: {
    width: "48.5%",
    minHeight: 72,
    borderColor: "rgba(118, 87, 255, 0.16)",
    borderRadius: 18,
    borderWidth: 1,
    justifyContent: "center",
    padding: 11
  },
  summaryValue: { color: "#161827", fontSize: 22, fontWeight: "900", marginTop: 3 },
  callChipRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  smallChip: {
    overflow: "hidden",
    borderRadius: 999,
    backgroundColor: "#f3f0ff",
    color: "#5b45cf",
    fontSize: 11,
    fontWeight: "900",
    paddingHorizontal: 8,
    paddingVertical: 4
  },
  smallChipOk: { backgroundColor: "#e9fff3", color: "#12824d" },
  smallChipWarn: { backgroundColor: "#fff7ed", color: "#9a3412" },
  manualContactBox: {
    gap: 9,
    borderColor: "rgba(255, 62, 165, 0.18)",
    borderRadius: 18,
    borderWidth: 1,
    backgroundColor: "rgba(255, 240, 250, 0.72)",
    padding: 11
  },
  conversationPicker: { gap: 8, paddingVertical: 2 },
  conversationChoice: {
    flexDirection: "row",
    gap: 10,
    width: "100%",
    minHeight: 76,
    borderColor: "rgba(118, 87, 255, 0.18)",
    borderRadius: 8,
    borderWidth: 1,
    backgroundColor: "#f4edf7",
    padding: 10
  },
  conversationChoiceActive: {
    borderColor: "#ff3ea5",
    backgroundColor: "#ff3ea5"
  },
  conversationName: { color: "#161827", fontSize: 14, fontWeight: "900" },
  threadAvatar: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },
  threadAvatarText: { color: "#211627", fontSize: 14, fontWeight: "800" },
  conversationNameActive: { color: "#ffffff" },
  conversationNumber: { color: "#a81586", fontSize: 12, fontWeight: "900", marginTop: 3 },
  conversationNumberActive: { color: "#ffffff" },
  conversationPreview: { color: "#686a80", fontSize: 11, fontWeight: "700", marginTop: 7 },
  conversationBox: {
    flex: 1,
    gap: 10,
    borderColor: "rgba(217, 211, 238, 0.9)",
    borderRadius: 8,
    borderWidth: 1,
    backgroundColor: "#edf1f5",
    padding: 12
  },
  messageThread: {
    flex: 1,
    minHeight: 100,
    borderColor: "rgba(118, 87, 255, 0.12)",
    borderRadius: 18,
    borderWidth: 1,
    backgroundColor: "#e0e7ec"
  },
  messageThreadContent: { gap: 8, padding: 10 },
  messageMeta: { fontSize: 11, color: "#465064", marginTop: 6 },
  inboxContent: { flex: 1, padding: 10, paddingBottom: 8, gap: 8 },
  inboxList: { flex: 1, gap: 8 },
  screenHeading: { color: "#f4f7fa", fontSize: 20, fontWeight: "700" },
  headerAction: { minHeight: 44, justifyContent: "center", paddingHorizontal: 8 },
  headerActionText: { color: "#8ce2ff", fontWeight: "700", fontSize: 12 },
  quickReplyGrid: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
  quickReplyButton: {
    borderColor: "rgba(22, 184, 255, 0.18)",
    borderRadius: 999,
    borderWidth: 1,
    backgroundColor: "#f0fbff",
    paddingHorizontal: 10,
    paddingVertical: 8
  },
  quickReplyText: { color: "#086e9e", fontSize: 12, fontWeight: "900" },
  tinyStatusDot: {
    width: 14,
    height: 14,
    borderRadius: 999,
    shadowColor: "#23c779",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 10
  },
  dotLive: { backgroundColor: "#23c779" },
  dotPaused: { backgroundColor: "#d9d3ee", shadowOpacity: 0 },
  periodCard: {
    gap: 7,
    borderColor: "rgba(217, 211, 238, 0.9)",
    borderRadius: 18,
    borderWidth: 1,
    backgroundColor: "#fffaff",
    padding: 12
  },
  transcriptBox: {
    gap: 6,
    borderColor: "rgba(118, 87, 255, 0.16)",
    borderRadius: 16,
    borderWidth: 1,
    backgroundColor: "rgba(255, 255, 255, 0.72)",
    padding: 10
  },
  transcriptScroll: {
    maxHeight: 240,
    borderRadius: 12,
    backgroundColor: "rgba(255, 255, 255, 0.58)",
    padding: 10
  },
  transcriptText: {
    color: "#243047",
    flexWrap: "wrap",
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 19
  },
  teamCodeCard: {
    gap: 10,
    borderColor: "rgba(118, 87, 255, 0.16)",
    borderRadius: 18,
    borderWidth: 1,
    backgroundColor: "#fffaff",
    padding: 12
  },
  removeButton: {
    borderColor: "rgba(178, 31, 98, 0.16)",
    borderRadius: 999,
    borderWidth: 1,
    backgroundColor: "#fff0fa",
    paddingHorizontal: 10,
    paddingVertical: 6
  },
  removeButtonText: { color: "#b21f62", fontSize: 12, fontWeight: "900" },
  messagePreviewStack: { gap: 7 },
  textBubble: {
    alignSelf: "flex-start",
    maxWidth: "92%",
    borderColor: "rgba(22, 184, 255, 0.18)",
    borderRadius: 16,
    borderBottomLeftRadius: 6,
    borderWidth: 1,
    backgroundColor: "#f0fbff",
    padding: 10
  },
  textBubbleOutbound: {
    alignSelf: "flex-end",
    borderColor: "rgba(255, 62, 165, 0.18)",
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 6,
    backgroundColor: "#fff0fa"
  },
  textBubbleLabel: {
    color: "#086e9e",
    fontSize: 11,
    fontWeight: "900",
    marginBottom: 3,
    textTransform: "uppercase"
  },
  textBubbleLabelOutbound: { color: "#a81586" },
  textBubbleBody: { color: "#203040", fontSize: 13, lineHeight: 18 },
  textBubbleBodyOutbound: { color: "#3f2140" },
  deliveryIssue: { color: "#9f1239", fontSize: 11, fontWeight: "900", marginTop: 6 },
  deliveryIssueOutbound: { color: "#a81586" },
  insightRow: { alignItems: "center", borderTopColor: "#f0edf8", borderTopWidth: 1, flexDirection: "row", justifyContent: "space-between", gap: 12, paddingTop: 10 },
  miniList: {
    gap: 7,
    borderColor: "rgba(217, 211, 238, 0.9)",
    borderRadius: 18,
    borderWidth: 1,
    backgroundColor: "#fffaff",
    padding: 12
  },
  miniListRow: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", gap: 10 },
  muted: { color: "#686a80", fontSize: 13, lineHeight: 18 },
  record: { color: "#55576d", fontSize: 13, lineHeight: 19 },
  warningText: {
    overflow: "hidden",
    borderColor: "rgba(255, 122, 61, 0.28)",
    borderRadius: 16,
    borderWidth: 1,
    backgroundColor: "#fff7ed",
    color: "#9a3412",
    fontSize: 13,
    fontWeight: "800",
    lineHeight: 18,
    padding: 12
  },
  status: { color: "#55576d", minHeight: 24, fontWeight: "800" },
  testOutput: { borderColor: "#ddd8ec", borderRadius: 16, borderWidth: 1, backgroundColor: "#fffaff", color: "#34364a", fontSize: 13, lineHeight: 19, padding: 12 }
});
