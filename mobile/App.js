import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import * as Device from "expo-device";
import { LinearGradient } from "expo-linear-gradient";
import * as Notifications from "expo-notifications";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Linking,
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

const defaultApiBaseUrl = "https://google-voice-ai-receptionist.onrender.com";
const apiStorageKey = "ddd-ai-dispatch-api-base-url";
const adminPinStorageKey = "ddd-ai-dispatch-admin-pin";
const staffPhoneStorageKey = "ddd-ai-dispatch-staff-phone";
const adminPrimaryTabs = [
  { name: "Inbox", color: "#16b8ff" },
  { name: "Calls", color: "#ff7a3d" },
  { name: "Bookings", color: "#ffc83d" },
  { name: "Insights", color: "#23c779", label: "Reports" },
  { name: "More", color: "#ff3ea5" }
];
const staffPrimaryTabs = [
  { name: "Inbox", color: "#16b8ff" },
  { name: "Calls", color: "#ff7a3d" },
  { name: "Bookings", color: "#ffc83d" },
  { name: "Insights", color: "#23c779", label: "Reports" },
  { name: "Home", color: "#7657ff" }
];
const adminMoreTabs = [
  { name: "Home", color: "#7657ff" },
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
      "Thanks for calling DDD. Your request was received: {{link}}. iPhone users: open DDD Mobile in the App Store and log in with the same phone number used for booking. Android users: open DDD Mobile in Google Play and log in with the same phone number. Website backup: {{webLoginLink}}. Reply here if anything changes. Reply STOP to stop."
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
  const [activeTab, setActiveTab] = useState("Inbox");
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
  const [activity, setActivity] = useState({ calls: [], leads: [], bookings: [], conversations: [], insights: null });
  const [settings, setSettings] = useState(blankSettings);
  const [signedInStaff, setSignedInStaff] = useState(null);
  const autosaveTimerRef = useRef(null);
  const lastSavedSettingsRef = useRef("");

  const cleanBaseUrl = useMemo(() => normalizeBaseUrl(apiBaseUrl), [apiBaseUrl]);
  const isAdmin = isAdminStaff(signedInStaff);
  const availableTabs = useMemo(() => (isAdmin ? adminPrimaryTabs : staffPrimaryTabs), [isAdmin]);
  const allowedTabNames = useMemo(
    () => new Set([...availableTabs, ...(isAdmin ? adminMoreTabs : [])].map((tab) => tab.name)),
    [availableTabs, isAdmin]
  );

  const refreshOperations = useCallback(async (baseUrl = cleanBaseUrl, accessPin = adminPin) => {
    const targetBaseUrl = normalizeBaseUrl(baseUrl);
    if (!accessPin) return;
    const [callsResponse, conversationsResponse, insightsResponse, bookingsResponse] = await Promise.all([
      apiGet(targetBaseUrl, "/api/call-log?limit=75", accessPin).catch(() => ({ calls: [] })),
      apiGet(targetBaseUrl, "/api/conversations", accessPin).catch(() => ({ conversations: [] })),
      apiGet(targetBaseUrl, "/api/insights", accessPin).catch(() => null),
      apiGet(targetBaseUrl, "/api/bookings?limit=75").catch(() => ({ bookings: [] }))
    ]);
    setActivity((current) => ({
      ...current,
      calls: callsResponse.calls || current.calls || [],
      conversations: conversationsResponse.conversations || current.conversations || [],
      insights: insightsResponse || current.insights || null,
      bookings: bookingsResponse.bookings || current.bookings || []
    }));
    if (conversationsResponse.staff?.ok) {
      setSignedInStaff(conversationsResponse.staff);
    }
  }, [adminPin, cleanBaseUrl]);

  const loadAll = useCallback(async (baseUrl = cleanBaseUrl, accessPin = adminPin) => {
    const targetBaseUrl = normalizeBaseUrl(baseUrl);
    setLoading(true);
    try {
      const [settingsResponse, setupResponse, businessResponse, callsResponse, leadsResponse, bookingsResponse, conversationsResponse, insightsResponse] =
        await Promise.all([
          apiGet(targetBaseUrl, "/api/settings", accessPin),
          apiGet(targetBaseUrl, "/api/setup-status"),
          apiGet(targetBaseUrl, "/api/business"),
          apiGet(targetBaseUrl, "/api/call-log", accessPin).catch(() => ({ calls: [] })),
          apiGet(targetBaseUrl, "/api/leads"),
          apiGet(targetBaseUrl, "/api/bookings"),
          apiGet(targetBaseUrl, "/api/conversations", accessPin).catch(() => ({ conversations: [], locked: true })),
          apiGet(targetBaseUrl, "/api/insights", accessPin).catch(() => null)
        ]);

      const nextSettings = toFormSettings(settingsResponse);
      setSettings(nextSettings);
      lastSavedSettingsRef.current = JSON.stringify(fromFormSettings(nextSettings));
      setSetup(setupResponse);
      setBusiness(businessResponse);
      setActivity({
        calls: callsResponse.calls || [],
        leads: leadsResponse.leads || [],
        bookings: bookingsResponse.bookings || [],
        conversations: conversationsResponse.conversations || [],
        insights: insightsResponse || null
      });
      if (accessPin) {
        const access = await apiGet(targetBaseUrl, "/api/access-check", accessPin).catch(() => null);
        setSignedInStaff(access?.ok ? access : null);
        setStatus(access?.ok ? `Signed in as ${access.name || "DDD team"} (${access.role || "staff"}).` : "Connected. Code not recognized yet.");
        if (access?.ok) {
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
  }, [loadAll]);

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
        const requested = await Notifications.requestPermissionsAsync();
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
        staffPhone
      }, accessPin);
      setPushStatus("Native push is connected on this phone.");
      if (!quiet) setStatus("Push notifications connected.");
    } catch (error) {
      setPushStatus(error.message);
      setStatus(error.message);
    }
  }

  async function sendTestNotification() {
    try {
      if (Platform.OS !== "web") {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: "DDD AI Dispatch",
            body: "This is how new call and text alerts will show on your phone.",
            sound: "default",
            interruptionLevel: "timeSensitive",
            data: { type: "local-test" }
          },
          trigger: null
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

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="light" />
      <LinearGradient colors={["#140f2a", "#102d3b", "#33133d"]} style={styles.shell}>
        <Header business={business} settings={settings} editMode={editMode} signedInStaff={signedInStaff} />

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {activeTab === "Home" ? (
            <HomeTab
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
              onRefresh={() => loadAll(cleanBaseUrl, adminPin)}
              onSaveBaseUrl={saveBaseUrl}
              onSaveSettings={() => saveSettings("manual")}
              onUnlockAdmin={() => loadAll(cleanBaseUrl, adminPin)}
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
              adminPin={adminPin}
              apiBaseUrl={cleanBaseUrl}
              conversations={activity.conversations}
              hasPin={Boolean(adminPin)}
              onRefresh={() => loadAll(cleanBaseUrl, adminPin)}
              setStatus={setStatus}
              settings={settings}
              staffPhone={staffPhone}
            />
          ) : null}
          {activeTab === "Calls" ? (
            <CallsTab
              adminPin={adminPin}
              apiBaseUrl={cleanBaseUrl}
              calls={activity.calls}
              insights={activity.insights}
              setStatus={setStatus}
              setStaffPhone={setStaffPhone}
              staffPhone={staffPhone}
            />
          ) : null}
          {activeTab === "Bookings" ? <BookingsTab bookings={activity.bookings} /> : null}
          {activeTab === "Insights" ? (
            <InsightsTab
              calls={activity.calls}
              hasPin={Boolean(adminPin)}
              insights={activity.insights}
              onRefresh={() => loadAll(cleanBaseUrl, adminPin)}
            />
          ) : null}
          {isAdmin && activeTab === "More" ? <MoreTab onSelect={setActiveTab} settings={settings} activity={activity} /> : null}

          {loading ? <ActivityIndicator color="#7d4dff" /> : null}
          <Text style={styles.status}>{status}</Text>
        </ScrollView>
        <BottomTabs activeTab={activeTab} onSelect={setActiveTab} tabs={availableTabs} />
      </LinearGradient>
    </SafeAreaView>
  );
}

function BottomTabs({ activeTab, onSelect, tabs = staffPrimaryTabs }) {
  const activePrimary = tabs.some((tab) => tab.name === activeTab) ? activeTab : tabs[0]?.name || "Inbox";
  return (
    <LinearGradient colors={["rgba(20, 18, 42, 0.96)", "rgba(49, 31, 72, 0.92)"]} style={styles.tabWrap}>
      <View style={styles.tabContent}>
        {tabs.map((tab) => {
          const active = activePrimary === tab.name;
          return (
            <Pressable
              key={tab.name}
              onPress={() => onSelect(tab.name)}
              style={[
                styles.tabButton,
                { borderColor: active ? tab.color : "rgba(118, 87, 255, 0.14)" },
                active && { backgroundColor: tab.color }
              ]}
            >
              <View style={[styles.tabDot, { backgroundColor: tab.color }]} />
              <Text style={[styles.tabText, active && styles.tabTextActive]}>{tab.label || tab.name}</Text>
            </Pressable>
          );
        })}
      </View>
    </LinearGradient>
  );
}

function Header({ business, editMode, settings, signedInStaff }) {
  return (
    <LinearGradient colors={["rgba(29, 22, 58, 0.98)", "rgba(28, 48, 75, 0.94)", "rgba(76, 33, 91, 0.96)"]} style={styles.header}>
      <View style={styles.brandRow}>
        <LinearGradient colors={["#ffffff", "#fff0fa"]} style={styles.logoFrame}>
          <Image source={require("./assets/icon.png")} style={styles.logo} />
        </LinearGradient>
        <View style={styles.brandCopy}>
          <Text style={styles.eyebrow}>DDD AI Dispatch</Text>
          <Text style={styles.title}>{business?.name || "DDD AI Dispatch"}</Text>
        </View>
        <Text style={[styles.modePill, settings.enabled ? styles.modePillLive : styles.modePillPaused]}>
          {settings.enabled ? "Live" : "Paused"}
        </Text>
      </View>
      <Text style={styles.subtitle} numberOfLines={1}>
        {signedInStaff?.ok ? `Signed in as ${signedInStaff.name || "DDD team"}` : "Enter code on Home"} - inbox, calls, texts, dispatch
      </Text>
      <LinearGradient colors={rainbowColors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.heroGlow} />
    </LinearGradient>
  );
}

function HomeTab({
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
  onSendTestNotification
}) {
  const activeDay = activity?.insights?.sections?.latestActiveDay || activity?.insights?.sections?.daily || {};
  const todayCalls = activeDay.calls ?? activity?.calls?.length ?? 0;
  const weeklyBookings = activity?.insights?.sections?.weekly?.bookings ?? 0;
  const hasAdminPin = Boolean(String(adminPin || "").trim());
  const isSignedIn = Boolean(signedInStaff?.ok);
  const routeMode = settings.humanRouting?.mode || "ai_then_humans";
  const routeLabel = routeMode === "humans" ? "Ring team" : routeMode === "ai" ? "AI only" : "AI + backup";
  return (
    <>
      <Card title="Sign in once">
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
        <View style={styles.pinLoginRow}>
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
        </View>
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

function MoreTab({ activity, onSelect, settings }) {
  return (
    <>
      <Card title="More controls">
        <Text style={styles.muted}>Less clutter up front. Use these when you want to tune how the receptionist talks, asks questions, texts, and learns.</Text>
        <View style={styles.moreGrid}>
          {adminMoreTabs.map((tab) => (
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

function InboxTab({ adminPin, apiBaseUrl, conversations, hasPin, onRefresh, setStatus, settings, staffPhone }) {
  const [drafts, setDrafts] = useState({});
  const [manualPhone, setManualPhone] = useState("");
  const [selectedPhone, setSelectedPhone] = useState("");
  const [workingThread, setWorkingThread] = useState("");
  const activeConversations = (conversations || []).slice(0, 20);
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
    activeConversations.find((conversation) => normalizeE164(getConversationCustomer(conversation)) === selectedPhone) ||
    (selectedPhone === manualNormalizedPhone ? manualConversation : null) ||
    activeConversations[0] ||
    null;
  const selectedCustomerPhone = selectedConversation ? getConversationCustomer(selectedConversation) : "";

  async function sendReply(customerPhone) {
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
      setStatus("Text sent from DDD.");
      onRefresh();
    } catch (error) {
      setStatus(error.message);
    } finally {
      setWorkingThread("");
    }
  }

  async function callCustomer(customerPhone) {
    const to = normalizeE164(customerPhone);
    if (!to) {
      setStatus("Could not find a valid customer phone number.");
      return;
    }
    if (!normalizeE164(staffPhone)) {
      setStatus("Add your call-back phone on Home first.");
      return;
    }
    setWorkingThread(`call:${to}`);
    try {
      await apiPost(apiBaseUrl, "/api/calls/outbound", { to, staffPhone }, adminPin);
      setStatus("Calling your phone now. Answer it to connect the customer with DDD caller ID.");
    } catch (error) {
      setStatus(error.message);
    } finally {
      setWorkingThread("");
    }
  }

  async function archiveConversation(customerPhone) {
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
      <Card title="New text or call">
        <Text style={styles.muted}>Start a thread or outbound callback with any customer number. Replies still send from DDD.</Text>
        <View style={styles.manualContactBox}>
          <Text style={styles.linkLabel}>Customer number</Text>
          <Field
            keyboardType="phone-pad"
            label="Phone"
            onChangeText={(value) => {
              setManualPhone(value);
              const normalized = normalizeE164(value);
              if (normalized) setSelectedPhone(normalized);
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
      </Card>
      <Card title="Shared inbox">
        {!hasPin ? <Text style={styles.warningText}>Enter your admin or tech access code on Home once to load protected inbox messages.</Text> : null}
        {!normalizeE164(staffPhone) ? <Text style={styles.warningText}>Add your call-back phone on Home before using Call Customer.</Text> : null}
        <View style={styles.summaryGrid}>
          <SummaryTile label="Threads" value={activeConversations.length} />
          <SummaryTile label="Open texts" value={activeConversations.filter((item) => item.messages?.length).length} />
        </View>
        <View style={styles.buttonRow}>
          <ActionButton label="Refresh inbox" onPress={onRefresh} />
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.conversationPicker}>
          {activeConversations.map((conversation, index) => {
            const customerPhone = getConversationCustomer(conversation);
            const normalized = normalizeE164(customerPhone);
            const active = normalized === normalizeE164(selectedCustomerPhone);
            return (
              <Pressable
                key={conversation.threadId || conversation.customer || index}
                onPress={() => setSelectedPhone(normalized)}
                style={[styles.conversationChoice, active && styles.conversationChoiceActive]}
              >
                <Text style={[styles.conversationName, active && styles.conversationNameActive]} numberOfLines={1}>
                  {getConversationName(conversation)}
                </Text>
                <Text style={[styles.conversationNumber, active && styles.conversationNumberActive]} numberOfLines={1}>
                  {formatPhone(customerPhone) || "Unknown"}
                </Text>
                <Text style={[styles.conversationPreview, active && styles.conversationNumberActive]} numberOfLines={1}>
                  {getConversationPreview(conversation)}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </Card>
      {selectedConversation ? (
        <Card title="Conversation">
          <ConversationCard
            conversation={selectedConversation}
            draft={drafts[normalizeE164(getConversationCustomer(selectedConversation))] || ""}
            onArchive={archiveConversation}
            onCall={callCustomer}
            onDraftChange={(customerPhone, message) => {
              const to = normalizeE164(customerPhone);
              setDrafts((current) => ({ ...current, [to]: message }));
            }}
            onSend={sendReply}
            settings={settings}
            workingThread={workingThread}
          />
        </Card>
      ) : (
        <Card title="Conversation">
          <Text style={styles.muted}>Texts will appear after SMS is fully live on Twilio.</Text>
        </Card>
      )}
    </>
  );
}

function ConversationCard({ conversation, draft, onArchive, onCall, onDraftChange, onSend, settings, workingThread }) {
  const customerPhone = getConversationCustomer(conversation);
  const normalizedPhone = normalizeE164(customerPhone);
  const recentMessages = conversation.messages || [];
  const smsBusy = workingThread === `sms:${normalizedPhone}`;
  const callBusy = workingThread === `call:${normalizedPhone}`;
  const archiveBusy = workingThread === `archive:${normalizedPhone}`;
  const quickReplies = buildQuickReplies(conversation, settings);
  return (
    <LinearGradient colors={["#fffaff", "#f7fffb"]} style={styles.conversationBox}>
      <View style={styles.listHeader}>
        <View style={styles.flexText}>
          <Text style={styles.listTitle} numberOfLines={1}>{getConversationName(conversation)}</Text>
          <Text style={styles.muted} numberOfLines={1}>{formatPhone(customerPhone) || "Unknown customer"} - {getConversationTime(conversation)}</Text>
        </View>
        <Text style={styles.pill}>{conversation.messages?.length || 0} msgs</Text>
      </View>
      <ScrollView style={styles.messageThread} contentContainerStyle={styles.messageThreadContent} nestedScrollEnabled>
        {recentMessages.length ? recentMessages.map((message, index) => (
          <View key={`${message.createdAt || index}-${message.direction}`} style={[styles.textBubble, message.direction === "outbound" && styles.textBubbleOutbound]}>
            <Text style={[styles.textBubbleLabel, message.direction === "outbound" && styles.textBubbleLabelOutbound]}>
              {message.direction === "outbound" ? message.agentName || "DDD" : "Customer"}
            </Text>
            <Text style={[styles.textBubbleBody, message.direction === "outbound" && styles.textBubbleBodyOutbound]}>{message.body || message.text || ""}</Text>
          </View>
        )) : <Text style={styles.record} numberOfLines={3}>{getConversationPreview(conversation)}</Text>}
      </ScrollView>
      <View style={styles.quickReplyGrid}>
        {quickReplies.map((reply) => (
          <Pressable key={reply.label} onPress={() => onDraftChange(customerPhone, reply.text)} style={styles.quickReplyButton}>
            <Text style={styles.quickReplyText}>{reply.label}</Text>
          </Pressable>
        ))}
      </View>
      <Field
        label="Reply from DDD"
        multiline
        onChangeText={(message) => onDraftChange(customerPhone, message)}
        value={draft}
      />
      <Text style={styles.muted}>Replies send from DDD and include STOP language automatically if needed.</Text>
      <View style={styles.buttonRow}>
        <ActionButton disabled={smsBusy} label={smsBusy ? "Sending..." : "Send text"} onPress={() => onSend(customerPhone)} />
        <ActionButton disabled={callBusy} label={callBusy ? "Calling..." : "Call customer"} onPress={() => onCall(customerPhone)} variant="light" />
        <ActionButton disabled={archiveBusy} label={archiveBusy ? "Archiving..." : "Archive"} onPress={() => onArchive(customerPhone)} variant="light" />
      </View>
    </LinearGradient>
  );
}

function BookingsTab({ bookings = [] }) {
  const recentBookings = (bookings || []).slice(0, 30);
  const openBookings = recentBookings.filter((booking) => !/complete|cancel|clear|done|closed/i.test(getBookingStatusLabel(booking))).length;
  return (
    <>
      <Card title="Bookings">
        <View style={styles.summaryGrid}>
          <SummaryTile label="Recent" value={recentBookings.length} />
          <SummaryTile label="Open" value={openBookings} />
          <SummaryTile label="Today" value={recentBookings.filter((booking) => isSameDay(booking.createdAt, new Date())).length} />
          <SummaryTile label="Photos" value={recentBookings.filter((booking) => Number(booking.photoCount || 0) > 0).length} />
        </View>
      </Card>
      <Card title="Newest requests">
        {recentBookings.map((booking, index) => (
          <BookingCard booking={booking} key={booking.bookingId || booking.id || index} />
        ))}
        {recentBookings.length ? null : <Text style={styles.muted}>New bookings will show here with the service time and date.</Text>}
      </Card>
    </>
  );
}

function BookingCard({ booking = {} }) {
  const confidence = booking.confidence || {};
  const missing = Array.isArray(confidence.missing) ? confidence.missing : [];
  const statusLabel = getBookingStatusLabel(booking);
  const requestedFor = getBookingRequestedLabel(booking);
  return (
    <LinearGradient colors={["#fffaff", "#f7fffb"]} style={styles.listCard}>
      <View style={styles.listHeader}>
        <Text style={styles.listTitle} numberOfLines={1}>{booking.name || booking.customerName || "Customer"}</Text>
        <Text style={styles.pill}>{statusLabel}</Text>
      </View>
      <Text style={styles.record}>{booking.serviceType || booking.service || "Service not set"}</Text>
      <Text style={styles.record}>{formatPhone(booking.phone || booking.customerPhone || "") || "No phone saved"}</Text>
      <Text style={styles.record}>{booking.vehicle || "Vehicle not set"}{booking.vehicleColor ? ` (${booking.vehicleColor})` : ""}</Text>
      <Text style={styles.record}>{booking.location || "Location not set"}</Text>
      <View style={styles.callChipRow}>
        <Text style={styles.smallChip}>Requested: {requestedFor}</Text>
        <Text style={styles.smallChip}>Saved: {formatDateTime(booking.createdAt)}</Text>
      </View>
      {missing.length ? <Text style={styles.warningText}>Needs: {missing.join(", ")}</Text> : null}
    </LinearGradient>
  );
}

function getBookingStatusLabel(booking = {}) {
  const raw = String(
    booking.platformStatus ||
      booking.externalStatus ||
      booking.dddStatus ||
      booking.dispatchStatus ||
      booking.status ||
      booking.state ||
      ""
  ).trim();
  if (/complete|completed|done|closed|clear|cleared/i.test(raw)) return "Completed";
  if (/cancel|canceled|cancelled/i.test(raw)) return "Canceled";
  if (/assign|dispatch|en.?route|active/i.test(raw)) return raw;
  return raw || "Requested";
}

function getBookingRequestedLabel(booking = {}) {
  return (
    booking.requestedFor ||
    booking.appointmentAt ||
    booking.scheduledAt ||
    booking.preferredTime ||
    booking.timeWindow ||
    booking.requestedTime ||
    "ASAP / not set"
  );
}

function CallsTab({ adminPin, apiBaseUrl, calls, insights, setStatus, setStaffPhone, staffPhone }) {
  const [dialPhone, setDialPhone] = useState("");
  const [calling, setCalling] = useState(false);
  const callGroups = useMemo(() => groupCallsByCaller(calls || []).slice(0, 10), [calls]);
  const recentCalls = callGroups.map((group) => group.latest).filter(Boolean);
  const completed = recentCalls.filter((call) => call.completion === "complete" || call.bookings?.length).length;
  const needsReview = recentCalls.filter((call) => call.completion === "needs-review" || call.smsStatus === "failed").length;
  const daily = insights?.sections?.daily || {};
  const activeDay = insights?.sections?.latestActiveDay || daily;
  const weekly = insights?.sections?.weekly || {};
  const monthly = insights?.sections?.monthly || {};

  async function startOutboundCall() {
    const to = normalizeE164(dialPhone);
    const from = normalizeE164(staffPhone);
    if (!to) {
      setStatus("Enter the customer number to call.");
      return;
    }
    if (!from) {
      setStatus("Enter your callback phone first so Twilio can bridge the call.");
      return;
    }
    setCalling(true);
    try {
      await AsyncStorage.setItem(staffPhoneStorageKey, from);
      setStaffPhone(from);
      await apiPost(apiBaseUrl, "/api/calls/outbound", { to, staffPhone: from }, adminPin);
      setStatus("Calling your phone now. Answer it, then DDD connects the customer with business caller ID.");
    } catch (error) {
      setStatus(error.message);
    } finally {
      setCalling(false);
    }
  }

  return (
    <>
      <Card title="Outbound dialer">
        <Text style={styles.muted}>Call any customer from DDD. Your phone rings first, then the customer sees the DDD caller ID.</Text>
        <Field keyboardType="phone-pad" label="Customer phone" onChangeText={setDialPhone} value={dialPhone} />
        <Field
          keyboardType="phone-pad"
          label="Your callback phone"
          onChangeText={(value) => {
            setStaffPhone(value);
          }}
          value={staffPhone}
        />
        <ActionButton disabled={calling} label={calling ? "Calling..." : "Call from DDD"} onPress={startOutboundCall} />
      </Card>
      <Card title="Call summary">
        <View style={styles.summaryGrid}>
          <SummaryTile label="Recent" value={recentCalls.length} />
          <SummaryTile label="Booked" value={completed} />
          <SummaryTile label="Review" value={needsReview} tone="warn" />
          <SummaryTile label="SMS sent" value={recentCalls.filter((call) => call.smsStatus === "sent").length} />
        </View>
      </Card>
      <Card title="Call insights">
        <PeriodInsight label={activeDay.label || "Today"} period={activeDay} />
        <PeriodInsight label="Week" period={weekly} />
        <PeriodInsight label="Month" period={monthly} />
      </Card>
      <Card title="Recent calls">
        {callGroups.map((group, index) => (
          <CallCard call={group.latest} callGroup={group} key={group.key || group.latest?.id || group.latest?.callId || index} />
        ))}
        {callGroups.length ? null : <Text style={styles.muted}>Forwarded calls will appear here.</Text>}
      </Card>
    </>
  );
}

function CallCard({ call, callGroup }) {
  const complete = call.completion === "complete" || call.bookings?.length;
  const incomplete = call.completion === "incomplete" || call.outcome?.hungUpEarly;
  const transcript = formatCallTranscript(call);
  const vehicle = call.bookings?.[0]?.vehicle || call.leads?.[0]?.vehicle || "";
  const missing = call.bookings?.[0]?.confidence?.missing || call.leads?.[0]?.confidence?.missing || [];
  const repeatCalls = callGroup?.calls || [call];
  return (
    <LinearGradient colors={complete ? ["#f5fff8", "#fffaff"] : incomplete ? ["#fff7ed", "#fffaff"] : ["#fffaff", "#f7fffb"]} style={styles.listCard}>
      <View style={styles.listHeader}>
        <Text style={styles.listTitle} numberOfLines={1}>{formatPhone(call.caller || call.from || "Unknown caller")}</Text>
        <Text style={styles.pill}>{repeatCalls.length > 1 ? `${repeatCalls.length} calls` : call.durationLabel || formatDuration(call.durationSeconds) || "No time"}</Text>
      </View>
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
          {repeatCalls.slice(0, 5).map((item, index) => (
            <Text style={styles.record} key={item.id || item.callId || index}>
              {index === 0 ? "Latest: " : ""}{formatDateTime(item.startedAt || item.createdAt)} - {item.displayStatus || item.outcome?.label || "Logged"}{item.durationLabel ? ` - ${item.durationLabel}` : ""}{item.smsStatus && item.smsStatus !== "none" ? ` - SMS ${item.smsStatus}` : ""}
            </Text>
          ))}
        </View>
      ) : null}
      <View style={styles.transcriptBox}>
        <Text style={styles.linkLabel}>Transcript</Text>
        <ScrollView style={styles.transcriptScroll} nestedScrollEnabled>
          <Text style={styles.transcriptText}>{transcript || "Transcript will appear after the call is processed."}</Text>
        </ScrollView>
      </View>
    </LinearGradient>
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
  if (call.transcriptText) return String(call.transcriptText).replace(/\n{3,}/g, "\n\n").trim();
  if (Array.isArray(call.transcript)) {
    return call.transcript
      .map((item) => {
        const speaker = String(item.speaker || item.role || "Call").replace(/_/g, " ");
        const text = String(item.text || item.content || item.message || "").trim();
        return text ? `${speaker}: ${text}` : "";
      })
      .filter(Boolean)
      .join("\n\n");
  }
  return "";
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
    <LinearGradient colors={["rgba(255, 255, 255, 0.96)", "rgba(255, 255, 255, 0.78)"]} style={styles.card}>
      <LinearGradient colors={rainbowColors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.cardBar} />
      <Text style={styles.cardTitle}>{title}</Text>
      {children}
    </LinearGradient>
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
  return ["admin", "administrator", "owner", "manager", "super_admin", "dispatch_admin"].includes(role) || name.includes("bria") || name.includes("brianna");
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
  return conversation.customer || conversation.phone || conversation.from || conversation.messages?.at?.(-1)?.from || "";
}

function getConversationName(conversation = {}) {
  const booking = conversation.bookings?.[0] || {};
  return booking.name || conversation.customerName || conversation.name || "Customer";
}

function getConversationPreview(conversation = {}) {
  if (conversation.lastMessage || conversation.preview) return conversation.lastMessage || conversation.preview;
  const last = conversation.messages?.at?.(-1);
  return last?.body || last?.message || last?.text || "No message preview available.";
}

function getConversationTime(conversation = {}) {
  const last = conversation.messages?.at?.(-1);
  return conversation.updatedAt || conversation.lastAt || last?.createdAt || last?.at || "";
}

function buildQuickReplies(conversation = {}, settings = blankSettings) {
  const text = `${conversation.lastBody || ""} ${(conversation.messages || []).map((message) => message.body || message.text || "").join(" ")}`.toLowerCase();
  const base = [
    {
      label: "Professional follow-up",
      text: "Hi, this is DDD. Thanks for reaching out. What service do you need, what vehicle is it for, and what is the service location? Reply STOP to stop."
    },
    {
      label: "Booking link",
      text: "No problem. You can book/manage service here: https://dddcincy.com/book-service/ iPhone users can use DDD Mobile: https://apps.apple.com/app/id6762315831 Android users can use DDD Mobile: https://play.google.com/store/apps/details?id=com.dddroadside.mobile Reply STOP to stop."
    },
    {
      label: "Google review",
      text: buildGoogleReviewReply(settings)
    },
    {
      label: "Get location",
      text: "Can you send the exact address or nearest cross streets, plus the vehicle color? That helps us route the request faster. Reply STOP to stop."
    },
    {
      label: "On it",
      text: "Got it. We received your request and will follow up with the next step shortly. Reply STOP to stop."
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
        text: "Thanks. Do you already have the needed parts/materials, or do you need DDD to confirm them? For tire/brake work, please include quantity or position. Reply STOP to stop."
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
  safeArea: { flex: 1, backgroundColor: "#0d1024" },
  shell: { flex: 1, backgroundColor: "#0d1024" },
  header: {
    marginHorizontal: 10,
    marginTop: 4,
    overflow: "hidden",
    borderColor: "rgba(255, 62, 165, 0.32)",
    borderRadius: 18,
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
    minHeight: 52,
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
    position: "absolute",
    left: 10,
    right: 10,
    bottom: 8,
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
    minHeight: 48,
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
  tabText: { color: "#e8e4ff", fontSize: 10, fontWeight: "900", textAlign: "center" },
  tabTextActive: { color: "#ffffff" },
  content: { gap: 11, padding: 12, paddingBottom: 82 },
  card: {
    gap: 11,
    overflow: "hidden",
    borderColor: "rgba(255, 62, 165, 0.28)",
    borderRadius: 20,
    borderWidth: 1,
    backgroundColor: "rgba(255, 255, 255, 0.88)",
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
  conversationPicker: { gap: 8, paddingVertical: 2, paddingRight: 2 },
  conversationChoice: {
    width: 178,
    minHeight: 76,
    borderColor: "rgba(118, 87, 255, 0.18)",
    borderRadius: 18,
    borderWidth: 1,
    backgroundColor: "#fffaff",
    padding: 10
  },
  conversationChoiceActive: {
    borderColor: "#ff3ea5",
    backgroundColor: "#ff3ea5"
  },
  conversationName: { color: "#161827", fontSize: 14, fontWeight: "900" },
  conversationNameActive: { color: "#ffffff" },
  conversationNumber: { color: "#a81586", fontSize: 12, fontWeight: "900", marginTop: 3 },
  conversationNumberActive: { color: "#ffffff" },
  conversationPreview: { color: "#686a80", fontSize: 11, fontWeight: "700", marginTop: 7 },
  conversationBox: {
    gap: 10,
    borderColor: "rgba(217, 211, 238, 0.9)",
    borderRadius: 18,
    borderWidth: 1,
    backgroundColor: "#fffaff",
    padding: 12
  },
  messageThread: {
    maxHeight: 310,
    borderColor: "rgba(118, 87, 255, 0.12)",
    borderRadius: 18,
    borderWidth: 1,
    backgroundColor: "rgba(255, 255, 255, 0.7)"
  },
  messageThreadContent: { gap: 8, padding: 10 },
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
