import AsyncStorage from "@react-native-async-storage/async-storage";
import { Audio } from "expo-av";
import { LinearGradient } from "expo-linear-gradient";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Linking,
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
const tabs = [
  { name: "Home", color: "#7657ff" },
  { name: "Voice", color: "#ff3ea5" },
  { name: "Script", color: "#ff7a3d" },
  { name: "Flows", color: "#ffc83d" },
  { name: "Inbox", color: "#23c779" },
  { name: "Calls", color: "#16b8ff" },
  { name: "Insights", color: "#7657ff" }
];
const rainbowColors = ["#7657ff", "#ff3ea5", "#ff7a3d", "#ffc83d", "#23c779", "#16b8ff", "#7657ff"];
const softRainbowColors = ["rgba(255, 62, 165, 0.16)", "rgba(255, 200, 61, 0.12)", "rgba(35, 199, 121, 0.12)", "rgba(22, 184, 255, 0.16)", "rgba(118, 87, 255, 0.14)"];

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
  greeting: "",
  businessKnowledge: "",
  serviceArea: "",
  pricingNotes: "",
  emergencyInstructions: "",
  humanHandoffRules: "",
  applyInstructions: "",
  customInstructions: "",
  qualifyingServicesText: "",
  followUpStyle: "",
  outOfScopeHandling: "",
  bookingDestinationsText: "",
  smsFollowUp: {
    enabled: true,
    message:
      "Thanks for calling DDD. Your request was received: {{link}}. iPhone users: open the DDD Mobile app link and log in with the same phone number used for booking. Non-iPhone users: log in at {{webLoginLink}} with the same phone number to see booking updates. Reply here if anything changes."
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
    thinkingSound: true
  },
  voiceOptions: []
};

export default function App() {
  const [activeTab, setActiveTab] = useState("Home");
  const [apiBaseUrl, setApiBaseUrl] = useState(defaultApiBaseUrl);
  const [savedApiBaseUrl, setSavedApiBaseUrl] = useState(defaultApiBaseUrl);
  const [adminPin, setAdminPin] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [testing, setTesting] = useState(false);
  const [status, setStatus] = useState("");
  const [testCallerMessage, setTestCallerMessage] = useState("I have a flat tire and need help now.");
  const [testOutput, setTestOutput] = useState("");
  const [setup, setSetup] = useState(null);
  const [business, setBusiness] = useState(null);
  const [activity, setActivity] = useState({ calls: [], leads: [], bookings: [], conversations: [], insights: null });
  const [settings, setSettings] = useState(blankSettings);
  const currentSoundRef = useRef(null);
  const autosaveTimerRef = useRef(null);
  const lastSavedSettingsRef = useRef("");

  const cleanBaseUrl = useMemo(() => normalizeBaseUrl(apiBaseUrl), [apiBaseUrl]);

  const loadAll = useCallback(async (baseUrl = cleanBaseUrl, accessPin = adminPin) => {
    const targetBaseUrl = normalizeBaseUrl(baseUrl);
    setLoading(true);
    try {
      const [settingsResponse, setupResponse, businessResponse, callsResponse, leadsResponse, bookingsResponse, conversationsResponse, insightsResponse] =
        await Promise.all([
          apiGet(targetBaseUrl, "/api/settings"),
          apiGet(targetBaseUrl, "/api/setup-status"),
          apiGet(targetBaseUrl, "/api/business"),
          apiGet(targetBaseUrl, "/api/calls"),
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
      setStatus(conversationsResponse.locked ? "Connected. Enter admin PIN to load inbox." : "Connected to DDD AI Dispatch.");
    } catch (error) {
      setStatus(error.message);
    } finally {
      setLoading(false);
    }
  }, [adminPin, cleanBaseUrl]);

  useEffect(() => {
    let mounted = true;
    Promise.all([AsyncStorage.getItem(apiStorageKey), AsyncStorage.getItem(adminPinStorageKey)])
      .then(([value, savedPin]) => {
        if (!mounted) return;
        const nextUrl = normalizeBaseUrl(value || defaultApiBaseUrl);
        setApiBaseUrl(nextUrl);
        setSavedApiBaseUrl(nextUrl);
        setAdminPin(savedPin || "");
        loadAll(nextUrl, savedPin || "");
      })
      .catch(() => loadAll(defaultApiBaseUrl));
    return () => {
      mounted = false;
      currentSoundRef.current?.unloadAsync().catch(() => {});
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
      setStatus(error.message.includes("Forbidden") ? "Enter the admin PIN before saving settings." : error.message);
    } finally {
      setSaving(false);
    }
  }

  async function previewVoice() {
    setPreviewing(true);
    try {
      if (currentSoundRef.current) {
        await currentSoundRef.current.unloadAsync().catch(() => {});
        currentSoundRef.current = null;
      }
      const audioUri = `${cleanBaseUrl}/api/voice-preview.mp3?${new URLSearchParams({
        voice: settings.voice,
        voiceSpeed: String(settings.voiceSpeed),
        voiceDirection: settings.voiceDirection || "",
        text: settings.greeting || "Thank you for calling Triple D Roadside. How can I help today?",
        t: String(Date.now())
      }).toString()}`;
      const created = await Audio.Sound.createAsync({ uri: audioUri }, { shouldPlay: true });
      currentSoundRef.current = created.sound;
      setStatus("Voice preview playing.");
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

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <LinearGradient colors={["#fff7fb", "#f8fff9", "#f7f5ff"]} style={styles.shell}>
        <Header business={business} settings={settings} activity={activity} editMode={editMode} />

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {activeTab === "Home" ? (
            <HomeTab
              adminPin={adminPin}
              apiBaseUrl={apiBaseUrl}
              editMode={editMode}
              loading={loading}
              savedApiBaseUrl={savedApiBaseUrl}
              saving={saving}
              setup={setup}
              settings={settings}
              setAdminPin={setAdminPin}
              setApiBaseUrl={setApiBaseUrl}
              setEditMode={setEditMode}
              setSettings={setSettings}
              onRefresh={() => loadAll(cleanBaseUrl, adminPin)}
              onSaveBaseUrl={saveBaseUrl}
              onSaveSettings={() => saveSettings("manual")}
            />
          ) : null}

          {activeTab === "Voice" ? (
            <VoiceTab editMode={editMode} previewing={previewing} settings={settings} setSettings={setSettings} onPreviewVoice={previewVoice} />
          ) : null}

          {activeTab === "Script" ? (
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

          {activeTab === "Flows" ? <FlowsTab editMode={editMode} settings={settings} setSettings={setSettings} /> : null}
          {activeTab === "Inbox" ? <InboxTab conversations={activity.conversations} hasPin={Boolean(adminPin)} /> : null}
          {activeTab === "Calls" ? <CallsTab calls={activity.calls} /> : null}
          {activeTab === "Insights" ? <InsightsTab insights={activity.insights} /> : null}

          {loading ? <ActivityIndicator color="#7d4dff" /> : null}
          <Text style={styles.status}>{status}</Text>
        </ScrollView>
        <BottomTabs activeTab={activeTab} onSelect={setActiveTab} />
      </LinearGradient>
    </SafeAreaView>
  );
}

function BottomTabs({ activeTab, onSelect }) {
  return (
    <LinearGradient colors={["rgba(255, 255, 255, 0.96)", "rgba(255, 255, 255, 0.78)"]} style={styles.tabWrap}>
      <View style={styles.tabContent}>
        {tabs.map((tab) => {
          const active = activeTab === tab.name;
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
              <Text style={[styles.tabText, active && styles.tabTextActive]}>{tab.name}</Text>
            </Pressable>
          );
        })}
      </View>
    </LinearGradient>
  );
}

function Header({ activity, business, editMode, settings }) {
  return (
    <LinearGradient colors={["rgba(255, 255, 255, 0.96)", "rgba(255, 255, 255, 0.78)"]} style={styles.header}>
      <LinearGradient colors={rainbowColors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.heroGlow} />
      <View style={styles.brandRow}>
        <LinearGradient colors={["#ffffff", "#fff0fa"]} style={styles.logoFrame}>
          <Image source={require("./assets/icon.png")} style={styles.logo} />
        </LinearGradient>
        <View style={styles.brandCopy}>
          <Text style={styles.eyebrow}>DDD AI Dispatch</Text>
          <Text style={styles.title}>{business?.name || "DDD AI Dispatch"}</Text>
          <Text style={styles.subtitle}>Calls, texts, bookings, insights, and voice control.</Text>
        </View>
      </View>
      <View style={styles.metricStrip}>
        <Metric label="AI" value={settings.enabled ? "On" : "Paused"} />
        <Metric label="Calls" value={activity.calls.length} />
        <Metric label="Texts" value={activity.conversations.length} />
        <Metric label="Mode" value={editMode ? "Editing" : "Locked"} />
      </View>
    </LinearGradient>
  );
}

function HomeTab({
  adminPin,
  apiBaseUrl,
  editMode,
  loading,
  savedApiBaseUrl,
  saving,
  setup,
  settings,
  setAdminPin,
  setApiBaseUrl,
  setEditMode,
  setSettings,
  onRefresh,
  onSaveBaseUrl,
  onSaveSettings
}) {
  return (
    <>
      <Card title="Answering">
        <SwitchRow
          disabled={!editMode}
          label="AI answers new calls"
          note={settings.enabled ? "Live for callers routed to Twilio." : "Paused until turned back on."}
          value={settings.enabled}
          onValueChange={(enabled) => setSettings((current) => ({ ...current, enabled }))}
        />
        <View style={styles.buttonRow}>
          <ActionButton label={editMode ? "Lock settings" : "Edit settings"} onPress={() => setEditMode((current) => !current)} />
          <ActionButton disabled={saving || loading || !editMode} label={saving ? "Saving..." : "Save now"} onPress={onSaveSettings} variant="light" />
          <ActionButton label="Refresh" onPress={onRefresh} variant="light" />
        </View>
      </Card>

      <Card title="Admin access">
        <Field
          label="Admin PIN"
          onChangeText={(value) => {
            setAdminPin(value);
            AsyncStorage.setItem(adminPinStorageKey, value).catch(() => {});
          }}
          secureTextEntry
          value={adminPin}
        />
        <Text style={styles.muted}>The PIN is saved only on this phone for easier testing.</Text>
      </Card>

      <Card title="Run costs">
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
      </Card>

      <Card title="Backend">
        <Field autoCapitalize="none" keyboardType="url" label="Live backend URL" onChangeText={setApiBaseUrl} value={apiBaseUrl} />
        <View style={styles.buttonRow}>
          <ActionButton label="Save URL" onPress={onSaveBaseUrl} />
          <ActionButton label="Open admin web" onPress={() => Linking.openURL(normalizeBaseUrl(apiBaseUrl))} variant="light" />
        </View>
        <Text style={styles.muted}>Using {savedApiBaseUrl}</Text>
      </Card>

      <Card title="Setup status">
        {setup ? <SetupBadges setup={setup} /> : <Text style={styles.muted}>Setup status will appear after refresh.</Text>}
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
        <Field editable={editMode} label="Out-of-scope handling" multiline onChangeText={(outOfScopeHandling) => setSettings((current) => ({ ...current, outOfScopeHandling }))} value={settings.outOfScopeHandling} />
        <Field editable={editMode} label="Pricing and payment rules" multiline onChangeText={(pricingNotes) => setSettings((current) => ({ ...current, pricingNotes }))} value={settings.pricingNotes} />
        <Field editable={editMode} label="Emergency handling" multiline onChangeText={(emergencyInstructions) => setSettings((current) => ({ ...current, emergencyInstructions }))} value={settings.emergencyInstructions} />
        <Field editable={editMode} label="Human handoff" multiline onChangeText={(humanHandoffRules) => setSettings((current) => ({ ...current, humanHandoffRules }))} value={settings.humanHandoffRules} />
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
    </>
  );
}

function InboxTab({ conversations, hasPin }) {
  const activeConversations = (conversations || []).slice(0, 10);
  return (
    <>
      <Card title="Shared inbox">
        {!hasPin ? <Text style={styles.warningText}>Enter your admin PIN on Home, then tap Refresh to load protected inbox messages.</Text> : null}
        <View style={styles.summaryGrid}>
          <SummaryTile label="Threads" value={activeConversations.length} />
          <SummaryTile label="Open texts" value={activeConversations.filter((item) => item.messages?.length).length} />
        </View>
      </Card>
      <Card title="Customer texts">
        {activeConversations.map((conversation, index) => (
        <LinearGradient key={conversation.threadId || conversation.customer || index} colors={["#fffaff", "#f7fffb"]} style={styles.listCard}>
          <View style={styles.listHeader}>
            <Text style={styles.listTitle} numberOfLines={1}>{formatPhone(getConversationCustomer(conversation)) || "Unknown customer"}</Text>
            <Text style={styles.pill}>{conversation.messages?.length || 0} msgs</Text>
          </View>
          <Text style={styles.record} numberOfLines={3}>{getConversationPreview(conversation)}</Text>
          <Text style={styles.muted} numberOfLines={1}>{getConversationTime(conversation)}</Text>
        </LinearGradient>
        ))}
        {activeConversations.length ? null : <Text style={styles.muted}>Texts will appear after SMS is fully live on Twilio.</Text>}
      </Card>
    </>
  );
}

function CallsTab({ calls }) {
  const recentCalls = (calls || []).slice(0, 10);
  const completed = recentCalls.filter((call) => call.completion === "complete" || call.bookings?.length).length;
  const needsReview = recentCalls.filter((call) => call.completion === "needs-review" || call.smsStatus === "failed").length;
  return (
    <>
      <Card title="Call summary">
        <View style={styles.summaryGrid}>
          <SummaryTile label="Recent" value={recentCalls.length} />
          <SummaryTile label="Booked" value={completed} />
          <SummaryTile label="Review" value={needsReview} tone="warn" />
          <SummaryTile label="SMS sent" value={recentCalls.filter((call) => call.smsStatus === "sent").length} />
        </View>
      </Card>
      <Card title="Recent calls">
        {recentCalls.map((call, index) => (
        <LinearGradient key={call.id || call.callId || index} colors={["#fffaff", "#f7fffb"]} style={styles.listCard}>
          <View style={styles.listHeader}>
            <Text style={styles.listTitle} numberOfLines={1}>{formatPhone(call.caller || call.from || "Unknown caller")}</Text>
            <Text style={styles.pill}>{call.durationLabel || "No time"}</Text>
          </View>
          <View style={styles.callChipRow}>
            <Text style={styles.smallChip}>{call.outcome?.label || call.status || "Logged"}</Text>
            <Text style={styles.smallChip}>{call.smsStatus ? `SMS ${call.smsStatus}` : "SMS none"}</Text>
            <Text style={styles.smallChip}>{call.recordingStatus === "available" ? "Recording" : "No recording"}</Text>
          </View>
          <Text style={styles.record} numberOfLines={3}>{call.outcome?.detail || call.transcriptText || "Transcript will appear after the call is processed."}</Text>
        </LinearGradient>
        ))}
        {recentCalls.length ? null : <Text style={styles.muted}>Forwarded calls will appear here.</Text>}
      </Card>
    </>
  );
}

function InsightsTab({ insights }) {
  const daily = insights?.sections?.daily || {};
  const weekly = insights?.sections?.weekly || {};
  const monthly = insights?.sections?.monthly || {};
  return (
    <>
      <Card title="Business brain">
        <View style={styles.summaryGrid}>
          <SummaryTile label="Today" value={daily.calls || 0} />
          <SummaryTile label="Week" value={weekly.calls || 0} />
          <SummaryTile label="Month" value={monthly.calls || 0} />
          <SummaryTile label="SMS" value={formatPercent(weekly.smsCoverageRate || daily.smsCoverageRate)} />
        </View>
        {(insights?.suggestions || []).slice(0, 5).map((suggestion, index) => (
          <LinearGradient key={`${suggestion}-${index}`} colors={["#fffaff", "#f7fffb"]} style={styles.listCard}>
            <Text style={styles.linkLabel}>Suggestion {index + 1}</Text>
            <Text style={styles.record} numberOfLines={4}>{suggestion}</Text>
          </LinearGradient>
        ))}
        {insights?.suggestions?.length ? null : <Text style={styles.muted}>Suggestions will appear after more calls and transcripts.</Text>}
      </Card>
      <Card title="What changed">
        <InsightRow label="Bookings" value={`${weekly.bookings || 0} weekly / ${monthly.bookings || 0} monthly`} />
        <InsightRow label="Needs review" value={weekly.needsReview || daily.needsReview || 0} />
        <InsightRow label="Missed/fallback" value={weekly.missed || daily.missed || 0} />
        <InsightRow label="Avg time" value={formatDuration(weekly.averageDurationSeconds || daily.averageDurationSeconds || 0)} />
      </Card>
      <Card title="Hot spots">
        <MiniList title="Top services" items={weekly.topServices || daily.topServices || []} />
        <MiniList title="Top locations" items={weekly.topLocations || daily.topLocations || []} />
        <MiniList title="Caller types" items={weekly.callerTypes || daily.callerTypes || []} />
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

async function apiGet(baseUrl, path, adminPin = "") {
  const response = await fetch(`${baseUrl}${path}`, {
    headers: adminPin ? { "x-admin-pin": adminPin } : {}
  });
  if (!response.ok) throw new Error(`Could not load ${path}.`);
  return response.json();
}

async function apiPost(baseUrl, path, payload, adminPin = "") {
  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(adminPin ? { "x-admin-pin": adminPin } : {}) },
    body: JSON.stringify(payload)
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || `Could not save ${path}.`);
  }
  return response.json();
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
      ...(settings.soundPreferences || {})
    },
    smsFollowUp: {
      ...blankSettings.smsFollowUp,
      ...(settings.smsFollowUp || {})
    },
    reviewFollowUp: {
      ...blankSettings.reviewFollowUp,
      ...(settings.reviewFollowUp || {})
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
    applyInstructions: settings.applyInstructions,
    qualifyingServices: settings.qualifyingServicesText,
    followUpStyle: settings.followUpStyle,
    outOfScopeHandling: settings.outOfScopeHandling,
    callerFlows: settings.callerFlows,
    soundPreferences: settings.soundPreferences,
    smsFollowUp: settings.smsFollowUp,
    reviewFollowUp: settings.reviewFollowUp,
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

function clampSpeed(value) {
  return Math.min(1.5, Math.max(0.5, Math.round(Number(value) * 100) / 100));
}

function formatPhone(value) {
  const digits = String(value || "").replace(/\D/g, "");
  const normalized = digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
  if (normalized.length !== 10) return String(value || "");
  return `(${normalized.slice(0, 3)}) ${normalized.slice(3, 6)}-${normalized.slice(6)}`;
}

function getConversationCustomer(conversation = {}) {
  return conversation.customer || conversation.phone || conversation.from || conversation.messages?.at?.(-1)?.from || "";
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

function buildScriptPreview(settings) {
  return [
    settings.enabled ? "AI answers new calls." : "AI is paused.",
    `Voice: ${settings.voice}`,
    `Speed: ${Number(settings.voiceSpeed || 1).toFixed(2)}x`,
    `Greeting: ${settings.greeting || "Thank you for calling Triple D Roadside, this is the receptionist. How can I help today?"}`,
    "",
    "Business knowledge:",
    settings.businessKnowledge || "Add DDD business details here.",
    "",
    `Service area: ${settings.serviceArea || "Greater Cincinnati and nearby service areas."}`,
    `Pricing rules: ${settings.pricingNotes || "Do not quote exact pricing unless added here."}`,
    `Emergency: ${settings.emergencyInstructions || "Collect safety, location, vehicle, and callback number."}`,
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
  safeArea: { flex: 1, backgroundColor: "#fff7fb" },
  shell: { flex: 1, backgroundColor: "#fff7fb" },
  header: {
    marginHorizontal: 12,
    marginTop: 10,
    overflow: "hidden",
    borderRadius: 24,
    backgroundColor: "#ffffff",
    padding: 14,
    shadowColor: "#3b2267",
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.14,
    shadowRadius: 28,
    elevation: 8
  },
  heroGlow: { height: 8, borderRadius: 999, backgroundColor: "#ff3ea5", marginBottom: 14 },
  brandRow: { alignItems: "center", flexDirection: "row", gap: 10 },
  logoFrame: {
    alignItems: "center",
    justifyContent: "center",
    width: 60,
    height: 60,
    borderRadius: 20,
    shadowColor: "#e640a5",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 5
  },
  logo: { width: 52, height: 52, borderRadius: 17 },
  brandCopy: { flex: 1, minWidth: 0 },
  eyebrow: { color: "#b7218f", fontSize: 12, fontWeight: "900", textTransform: "uppercase" },
  title: { color: "#161827", fontSize: 24, fontWeight: "900" },
  subtitle: { color: "#5d6178", fontSize: 13, fontWeight: "700", lineHeight: 18 },
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
  tabWrap: {
    position: "absolute",
    left: 10,
    right: 10,
    bottom: 10,
    borderColor: "rgba(118, 87, 255, 0.16)",
    borderRadius: 24,
    borderWidth: 1,
    overflow: "hidden",
    paddingVertical: 7,
    shadowColor: "#3b2267",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.13,
    shadowRadius: 18,
    elevation: 3
  },
  tabContent: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 5,
    justifyContent: "center",
    paddingHorizontal: 7
  },
  tabButton: {
    alignItems: "center",
    width: "23.7%",
    minHeight: 31,
    flexDirection: "row",
    gap: 4,
    justifyContent: "center",
    borderColor: "rgba(118, 87, 255, 0.12)",
    borderRadius: 999,
    borderWidth: 1,
    backgroundColor: "rgba(255, 255, 255, 0.74)",
    overflow: "hidden",
    paddingHorizontal: 5
  },
  tabDot: { width: 7, height: 7, borderRadius: 999 },
  tabText: { color: "#34364d", fontSize: 10.5, fontWeight: "900", textAlign: "center" },
  tabTextActive: { color: "#ffffff" },
  content: { gap: 12, padding: 14, paddingBottom: 104 },
  card: {
    gap: 12,
    overflow: "hidden",
    borderColor: "rgba(118, 87, 255, 0.18)",
    borderRadius: 22,
    borderWidth: 1,
    backgroundColor: "#ffffff",
    padding: 15,
    shadowColor: "#3b2267",
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 6
  },
  cardBar: { height: 5, borderRadius: 999, backgroundColor: "#16b8ff" },
  cardTitle: { color: "#161827", fontSize: 20, fontWeight: "900" },
  flexText: { flex: 1, minWidth: 0, paddingRight: 10 },
  statusRow: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", gap: 12 },
  buttonRow: { flexDirection: "row", flexWrap: "wrap", gap: 9 },
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
    minHeight: 46,
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
    minHeight: 46,
    paddingHorizontal: 16,
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
