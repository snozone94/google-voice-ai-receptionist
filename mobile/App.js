import AsyncStorage from "@react-native-async-storage/async-storage";
import { Audio } from "expo-av";
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
const tabs = ["Home", "Voice", "Script", "Flows", "Inbox", "Calls", "Insights"];

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

  const loadAll = useCallback(async (baseUrl = cleanBaseUrl) => {
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
          apiGet(targetBaseUrl, "/api/conversations"),
          apiGet(targetBaseUrl, "/api/insights")
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
      setStatus("Connected to DDD AI Dispatch.");
    } catch (error) {
      setStatus(error.message);
    } finally {
      setLoading(false);
    }
  }, [cleanBaseUrl]);

  useEffect(() => {
    let mounted = true;
    Promise.all([AsyncStorage.getItem(apiStorageKey), AsyncStorage.getItem(adminPinStorageKey)])
      .then(([value, savedPin]) => {
        if (!mounted) return;
        const nextUrl = normalizeBaseUrl(value || defaultApiBaseUrl);
        setApiBaseUrl(nextUrl);
        setSavedApiBaseUrl(nextUrl);
        setAdminPin(savedPin || "");
        loadAll(nextUrl);
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
    loadAll(next);
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
      <View style={styles.shell}>
        <Header business={business} settings={settings} activity={activity} editMode={editMode} />
        <View style={styles.tabWrap}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabContent}>
            {tabs.map((tab) => (
              <Pressable
                key={tab}
                onPress={() => setActiveTab(tab)}
                style={[styles.tabButton, activeTab === tab && styles.tabButtonActive]}
              >
                <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>{tab}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>

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
              onRefresh={() => loadAll()}
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
          {activeTab === "Inbox" ? <InboxTab conversations={activity.conversations} /> : null}
          {activeTab === "Calls" ? <CallsTab calls={activity.calls} /> : null}
          {activeTab === "Insights" ? <InsightsTab insights={activity.insights} /> : null}

          {loading ? <ActivityIndicator color="#7d4dff" /> : null}
          <Text style={styles.status}>{status}</Text>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

function Header({ activity, business, editMode, settings }) {
  return (
    <View style={styles.header}>
      <View style={styles.heroGlow} />
      <View style={styles.brandRow}>
        <Image source={require("./assets/icon.png")} style={styles.logo} />
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
    </View>
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
              <Text style={styles.linkLabel}>{label}</Text>
              <Text style={styles.linkDetail}>{detail}</Text>
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

function InboxTab({ conversations }) {
  return (
    <Card title="Shared inbox">
      {(conversations || []).slice(0, 12).map((conversation, index) => (
        <View key={conversation.threadId || conversation.customer || index} style={styles.listCard}>
          <View style={styles.listHeader}>
            <Text style={styles.listTitle}>{formatPhone(conversation.customer || conversation.from || "Unknown")}</Text>
            <Text style={styles.pill}>{conversation.messages?.length || 0} msgs</Text>
          </View>
          <Text style={styles.muted}>{conversation.lastMessage || conversation.preview || "No message preview available."}</Text>
        </View>
      ))}
      {conversations?.length ? null : <Text style={styles.muted}>Texts will appear after SMS is fully live on Twilio.</Text>}
    </Card>
  );
}

function CallsTab({ calls }) {
  return (
    <Card title="Call log">
      {(calls || []).slice(0, 12).map((call, index) => (
        <View key={call.id || call.callId || index} style={styles.listCard}>
          <View style={styles.listHeader}>
            <Text style={styles.listTitle}>{formatPhone(call.caller || call.from || "Unknown caller")}</Text>
            <Text style={styles.pill}>{call.durationLabel || "No time"}</Text>
          </View>
          <Text style={styles.muted}>{call.outcome?.label || call.status || "Logged"}</Text>
          <Text style={styles.record}>{call.outcome?.detail || call.transcriptText || "Transcript will appear after the call is processed."}</Text>
        </View>
      ))}
      {calls?.length ? null : <Text style={styles.muted}>Forwarded calls will appear here.</Text>}
    </Card>
  );
}

function InsightsTab({ insights }) {
  const daily = insights?.sections?.daily || {};
  const weekly = insights?.sections?.weekly || {};
  const monthly = insights?.sections?.monthly || {};
  return (
    <>
      <Card title="Business brain">
        {(insights?.suggestions || []).slice(0, 5).map((suggestion, index) => (
          <View key={`${suggestion}-${index}`} style={styles.listCard}>
            <Text style={styles.linkLabel}>Suggestion {index + 1}</Text>
            <Text style={styles.record}>{suggestion}</Text>
          </View>
        ))}
        {insights?.suggestions?.length ? null : <Text style={styles.muted}>Suggestions will appear after more calls and transcripts.</Text>}
      </Card>
      <Card title="Daily / Weekly / Monthly">
        <InsightRow label="Today calls" value={daily.calls} />
        <InsightRow label="Weekly calls" value={weekly.calls} />
        <InsightRow label="Monthly calls" value={monthly.calls} />
        <InsightRow label="Top service" value={weekly.topServices?.[0]?.label || daily.topServices?.[0]?.label || "Not enough data"} />
        <InsightRow label="Top location" value={weekly.topLocations?.[0]?.label || daily.topLocations?.[0]?.label || "Not enough data"} />
      </Card>
    </>
  );
}

function Card({ children, title }) {
  return (
    <View style={styles.card}>
      <View style={styles.cardBar} />
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
      <Text style={[styles.buttonText, variant === "light" && styles.lightButtonText]}>{label}</Text>
    </Pressable>
  );
}

function Metric({ label, value }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{String(value)}</Text>
    </View>
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

async function apiGet(baseUrl, path) {
  const response = await fetch(`${baseUrl}${path}`);
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
    marginHorizontal: 14,
    marginTop: 12,
    overflow: "hidden",
    borderRadius: 24,
    backgroundColor: "#ffffff",
    padding: 16,
    shadowColor: "#3b2267",
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.14,
    shadowRadius: 28
  },
  heroGlow: { height: 8, borderRadius: 999, backgroundColor: "#ff3ea5", marginBottom: 14 },
  brandRow: { alignItems: "center", flexDirection: "row", gap: 12 },
  logo: { width: 58, height: 58, borderRadius: 18 },
  brandCopy: { flex: 1, minWidth: 0 },
  eyebrow: { color: "#b7218f", fontSize: 12, fontWeight: "900", textTransform: "uppercase" },
  title: { color: "#161827", fontSize: 27, fontWeight: "900" },
  subtitle: { color: "#5d6178", fontSize: 14, fontWeight: "700", lineHeight: 19 },
  metricStrip: { flexDirection: "row", gap: 8, marginTop: 14 },
  metric: { flex: 1, minHeight: 58, borderRadius: 18, backgroundColor: "#fbf7ff", padding: 9 },
  metricLabel: { color: "#a81586", fontSize: 10, fontWeight: "900", textTransform: "uppercase" },
  metricValue: { color: "#161827", fontSize: 16, fontWeight: "900", marginTop: 3 },
  tabWrap: { marginTop: 12 },
  tabContent: { gap: 8, paddingHorizontal: 14, paddingVertical: 4 },
  tabButton: {
    minHeight: 42,
    justifyContent: "center",
    borderColor: "rgba(118, 87, 255, 0.18)",
    borderRadius: 999,
    borderWidth: 1,
    backgroundColor: "#ffffff",
    paddingHorizontal: 16
  },
  tabButtonActive: { borderColor: "#ff3ea5", backgroundColor: "#7d4dff" },
  tabText: { color: "#34364d", fontWeight: "900" },
  tabTextActive: { color: "#ffffff" },
  content: { gap: 12, padding: 14, paddingBottom: 44 },
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
    shadowRadius: 24
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
    paddingHorizontal: 16,
    paddingVertical: 10,
    shadowColor: "#e640a5",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16
  },
  lightButton: { backgroundColor: "#fff0fa" },
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
    padding: 12
  },
  listHeader: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", gap: 10 },
  listTitle: { flex: 1, color: "#161827", fontSize: 16, fontWeight: "900" },
  pill: { overflow: "hidden", borderRadius: 999, backgroundColor: "#e9fff3", color: "#12824d", fontSize: 12, fontWeight: "900", paddingHorizontal: 9, paddingVertical: 5 },
  insightRow: { alignItems: "center", borderTopColor: "#f0edf8", borderTopWidth: 1, flexDirection: "row", justifyContent: "space-between", gap: 12, paddingTop: 10 },
  muted: { color: "#686a80", fontSize: 13, lineHeight: 18 },
  record: { color: "#55576d", fontSize: 13, lineHeight: 19 },
  status: { color: "#55576d", minHeight: 24, fontWeight: "800" },
  testOutput: { borderColor: "#ddd8ec", borderRadius: 16, borderWidth: 1, backgroundColor: "#fffaff", color: "#34364a", fontSize: 13, lineHeight: 19, padding: 12 }
});
