import AsyncStorage from "@react-native-async-storage/async-storage";
import { Audio } from "expo-av";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
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
const apiStorageKey = "ddd-ai-receptionist-api-base-url";

export default function App() {
  const [apiBaseUrl, setApiBaseUrl] = useState(defaultApiBaseUrl);
  const [savedApiBaseUrl, setSavedApiBaseUrl] = useState(defaultApiBaseUrl);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [testing, setTesting] = useState(false);
  const [status, setStatus] = useState("");
  const [testCallerMessage, setTestCallerMessage] = useState("I have a flat tire and need help now.");
  const [testOutput, setTestOutput] = useState("");
  const [setup, setSetup] = useState(null);
  const [business, setBusiness] = useState(null);
  const [activity, setActivity] = useState({ calls: [], leads: [], bookings: [] });
  const [settings, setSettings] = useState(blankSettings);
  const currentSoundRef = useRef(null);

  const cleanBaseUrl = useMemo(() => normalizeBaseUrl(apiBaseUrl), [apiBaseUrl]);

  const loadAll = useCallback(async (baseUrl = cleanBaseUrl) => {
    const targetBaseUrl = normalizeBaseUrl(baseUrl);
    setLoading(true);
    try {
      const [settingsResponse, setupResponse, businessResponse, callsResponse, leadsResponse, bookingsResponse] =
        await Promise.all([
          apiGet(targetBaseUrl, "/api/settings"),
          apiGet(targetBaseUrl, "/api/setup-status"),
          apiGet(targetBaseUrl, "/api/business"),
          apiGet(targetBaseUrl, "/api/calls"),
          apiGet(targetBaseUrl, "/api/leads"),
          apiGet(targetBaseUrl, "/api/bookings")
        ]);
      setSettings(toFormSettings(settingsResponse));
      setSetup(setupResponse);
      setBusiness(businessResponse);
      setActivity({
        calls: callsResponse.calls || [],
        leads: leadsResponse.leads || [],
        bookings: bookingsResponse.bookings || []
      });
      setStatus("Connected to the live receptionist.");
    } catch (error) {
      setStatus(error.message);
    } finally {
      setLoading(false);
    }
  }, [cleanBaseUrl]);

  useEffect(() => {
    let mounted = true;
    AsyncStorage.getItem(apiStorageKey)
      .then((value) => {
        if (!mounted) return;
        const nextUrl = normalizeBaseUrl(value || defaultApiBaseUrl);
        setApiBaseUrl(nextUrl);
        setSavedApiBaseUrl(nextUrl);
        loadAll(nextUrl);
      })
      .catch(() => loadAll(defaultApiBaseUrl));
    return () => {
      mounted = false;
      currentSoundRef.current?.unloadAsync().catch(() => {});
    };
  }, []);

  async function saveBaseUrl() {
    const next = normalizeBaseUrl(apiBaseUrl);
    await AsyncStorage.setItem(apiStorageKey, next);
    setApiBaseUrl(next);
    setSavedApiBaseUrl(next);
    setStatus("Backend URL saved.");
  }

  async function saveSettings() {
    setSaving(true);
    try {
      const saved = await apiPost(cleanBaseUrl, "/api/settings", fromFormSettings(settings));
      setSettings(toFormSettings(saved));
      setStatus(saved.enabled ? "Saved. AI is answering new calls." : "Saved. AI answering is paused.");
    } catch (error) {
      setStatus(error.message);
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
        text: settings.greeting || "Thank you for calling DDD. How can I help today?",
        t: String(Date.now())
      }).toString()}`;
      const created = await Audio.Sound.createAsync({ uri: audioUri }, { shouldPlay: true });
      currentSoundRef.current = created.sound;
      setStatus("Preview playing.");
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
          `Intent: ${result.intent}`,
          result.destination ? `Link: ${result.destination.label}\n${result.destination.url}` : "Link: none selected",
          "",
          result.likelyReply,
          "",
          result.note
        ].join("\n")
      );
      setStatus("Free test complete. This did not place a phone call.");
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
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <Text style={styles.eyebrow}>DDD AI receptionist</Text>
          <Text style={styles.title}>{business?.name || "AI Receptionist"}</Text>
          <Text style={styles.subtitle}>Google Voice {business?.googleVoiceNumber || "513-409-1342"}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Connection</Text>
          <TextInput
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            onChangeText={setApiBaseUrl}
            style={styles.input}
            value={apiBaseUrl}
          />
          <View style={styles.row}>
            <ActionButton label="Save URL" onPress={saveBaseUrl} />
            <ActionButton label="Refresh" onPress={loadAll} variant="light" />
          </View>
          <Text style={styles.muted}>Using {savedApiBaseUrl}</Text>
        </View>

        <View style={styles.card}>
          <View style={styles.statusRow}>
            <View>
              <Text style={styles.cardTitle}>Answering</Text>
              <Text style={styles.muted}>{settings.enabled ? "AI answers new calls" : "AI is paused"}</Text>
            </View>
            <Switch
              onValueChange={(enabled) => setSettings((current) => ({ ...current, enabled }))}
              value={settings.enabled}
            />
          </View>
          {setup ? <SetupBadges setup={setup} /> : null}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Voice</Text>
          <SegmentedOptions
            options={settings.voiceOptions}
            selected={settings.voice}
            onSelect={(voice) => setSettings((current) => ({ ...current, voice }))}
          />
          <Text style={styles.label}>Speed {Number(settings.voiceSpeed).toFixed(2)}x</Text>
          <View style={styles.speedRow}>
            <ActionButton
              label="Slower"
              onPress={() => setSettings((current) => ({ ...current, voiceSpeed: clampSpeed(current.voiceSpeed - 0.05) }))}
              variant="light"
            />
            <ActionButton
              label="Faster"
              onPress={() => setSettings((current) => ({ ...current, voiceSpeed: clampSpeed(current.voiceSpeed + 0.05) }))}
              variant="light"
            />
          </View>
          <Field
            label="Voice direction"
            multiline
            onChangeText={(voiceDirection) => setSettings((current) => ({ ...current, voiceDirection }))}
            value={settings.voiceDirection}
          />
          <ActionButton
            disabled={previewing}
            label={previewing ? "Making preview..." : "Preview Voice"}
            onPress={previewVoice}
          />
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>What It Says</Text>
          <Field
            label="Greeting"
            onChangeText={(greeting) => setSettings((current) => ({ ...current, greeting }))}
            value={settings.greeting}
          />
          <Field
            label="Business knowledge"
            multiline
            onChangeText={(businessKnowledge) => setSettings((current) => ({ ...current, businessKnowledge }))}
            value={settings.businessKnowledge}
          />
          <Field
            label="Service area"
            multiline
            onChangeText={(serviceArea) => setSettings((current) => ({ ...current, serviceArea }))}
            value={settings.serviceArea}
          />
          <Field
            label="Pricing rules"
            multiline
            onChangeText={(pricingNotes) => setSettings((current) => ({ ...current, pricingNotes }))}
            value={settings.pricingNotes}
          />
          <Field
            label="Emergency handling"
            multiline
            onChangeText={(emergencyInstructions) => setSettings((current) => ({ ...current, emergencyInstructions }))}
            value={settings.emergencyInstructions}
          />
          <Field
            label="Human handoff"
            multiline
            onChangeText={(humanHandoffRules) => setSettings((current) => ({ ...current, humanHandoffRules }))}
            value={settings.humanHandoffRules}
          />
          <Field
            label="Apply-to-work handling"
            multiline
            onChangeText={(applyInstructions) => setSettings((current) => ({ ...current, applyInstructions }))}
            value={settings.applyInstructions}
          />
          <Field
            label="Custom instructions"
            multiline
            onChangeText={(customInstructions) => setSettings((current) => ({ ...current, customInstructions }))}
            value={settings.customInstructions}
          />
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Free Test</Text>
          <Text style={styles.muted}>Preview the receptionist logic without placing a phone call.</Text>
          <Field
            label="Caller says"
            multiline
            onChangeText={setTestCallerMessage}
            value={testCallerMessage}
          />
          <ActionButton disabled={testing} label={testing ? "Testing..." : "Run Free Test"} onPress={runFreeTest} />
          {testOutput ? <Text style={styles.testOutput}>{testOutput}</Text> : null}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>DDD Links</Text>
          <Field
            label="Booking, app, and apply options"
            multiline
            onChangeText={(bookingDestinationsText) =>
              setSettings((current) => ({ ...current, bookingDestinationsText }))
            }
            value={settings.bookingDestinationsText}
          />
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Caller Handling</Text>
          <Field
            label="Potential new clients and customers"
            multiline
            onChangeText={(newClients) =>
              setSettings((current) => ({
                ...current,
                callerFlows: { ...current.callerFlows, newClients }
              }))
            }
            value={settings.callerFlows.newClients}
          />
          <Field
            label="Existing clients and customers"
            multiline
            onChangeText={(existingClients) =>
              setSettings((current) => ({
                ...current,
                callerFlows: { ...current.callerFlows, existingClients }
              }))
            }
            value={settings.callerFlows.existingClients}
          />
          <Field
            label="Sales callers"
            multiline
            onChangeText={(sales) =>
              setSettings((current) => ({
                ...current,
                callerFlows: { ...current.callerFlows, sales }
              }))
            }
            value={settings.callerFlows.sales}
          />
          <Field
            label="All other callers"
            multiline
            onChangeText={(otherCallers) =>
              setSettings((current) => ({
                ...current,
                callerFlows: { ...current.callerFlows, otherCallers }
              }))
            }
            value={settings.callerFlows.otherCallers}
          />
          <Field
            label="Qualifying services"
            multiline
            onChangeText={(qualifyingServicesText) =>
              setSettings((current) => ({ ...current, qualifyingServicesText }))
            }
            value={settings.qualifyingServicesText}
          />
          <Field
            label="Follow-up style"
            multiline
            onChangeText={(followUpStyle) => setSettings((current) => ({ ...current, followUpStyle }))}
            value={settings.followUpStyle}
          />
          <Field
            label="Out-of-scope handling"
            multiline
            onChangeText={(outOfScopeHandling) => setSettings((current) => ({ ...current, outOfScopeHandling }))}
            value={settings.outOfScopeHandling}
          />
          <View style={styles.statusRow}>
            <View>
              <Text style={styles.label}>Short thinking phrases</Text>
              <Text style={styles.muted}>Adds quick bridges while the receptionist thinks.</Text>
            </View>
            <Switch
              onValueChange={(thinkingSound) =>
                setSettings((current) => ({
                  ...current,
                  soundPreferences: { ...current.soundPreferences, thinkingSound }
                }))
              }
              value={settings.soundPreferences.thinkingSound}
            />
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Script Preview</Text>
          <Text style={styles.testOutput}>{buildScriptPreview(settings)}</Text>
        </View>

        <ActionButton disabled={saving || loading} label={saving ? "Saving..." : "Save Receptionist"} onPress={saveSettings} />

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Recent Activity</Text>
          <ActivityBlock title="Calls" records={activity.calls} empty="No forwarded calls yet." />
          <ActivityBlock title="Leads" records={activity.leads} empty="No leads yet." />
          <ActivityBlock title="Bookings" records={activity.bookings} empty="No booking requests yet." />
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Live Pages</Text>
          <ActionButton label="Open Admin Website" onPress={() => Linking.openURL(cleanBaseUrl)} variant="light" />
          <ActionButton label="Open Booking Page" onPress={() => Linking.openURL(`${cleanBaseUrl}/api/book`)} variant="light" />
        </View>

        {loading ? <ActivityIndicator color="#7d4dff" /> : null}
        <Text style={styles.status}>{status}</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

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

function Field({ label, multiline = false, onChangeText, value }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        multiline={multiline}
        onChangeText={onChangeText}
        style={[styles.input, multiline && styles.textarea]}
        textAlignVertical={multiline ? "top" : "center"}
        value={value}
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

function SegmentedOptions({ options, selected, onSelect }) {
  return (
    <View style={styles.segmentWrap}>
      {(options || []).map((option) => (
        <Pressable
          key={option.id}
          onPress={() => onSelect(option.id)}
          style={[styles.segment, selected === option.id && styles.segmentSelected]}
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
    ["AI Number", setup.required?.aiForwardingNumber]
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

function ActivityBlock({ empty, records, title }) {
  return (
    <View style={styles.activityBlock}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {(records || []).slice(0, 3).map((record, index) => (
        <Text key={`${title}-${record.createdAt || index}`} style={styles.record}>
          {record.createdAt || "No date"} {record.name || record.phone || record.callId || record.reason || ""}
        </Text>
      ))}
      {records?.length ? null : <Text style={styles.muted}>{empty}</Text>}
    </View>
  );
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

async function apiPost(baseUrl, path, payload) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
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

function buildScriptPreview(settings) {
  return [
    settings.enabled ? "AI answers new calls." : "AI is paused.",
    `Voice: ${settings.voice}`,
    `Speed: ${Number(settings.voiceSpeed || 1).toFixed(2)}x`,
    `Greeting: ${settings.greeting || "Thank you for calling DDD, this is the receptionist. How can I help today?"}`,
    "",
    "Business knowledge:",
    settings.businessKnowledge || "Add DDD business details here.",
    "",
    `Service area: ${settings.serviceArea || "Greater Cincinnati and nearby service areas."}`,
    `Pricing rules: ${settings.pricingNotes || "Do not quote exact pricing unless added here."}`,
    `Emergency: ${settings.emergencyInstructions || "Collect safety, location, vehicle, and callback number."}`,
    `Apply-to-work: ${settings.applyInstructions || "Collect applicant details and share the apply link."}`,
    "",
    "Caller handling:",
    `New: ${settings.callerFlows.newClients || "Qualify and collect booking details."}`,
    `Existing: ${settings.callerFlows.existingClients || "Collect appointment or job details."}`,
    `Sales: ${settings.callerFlows.sales || "Take a message without committing."}`,
    `Other: ${settings.callerFlows.otherCallers || "Collect caller info and reason."}`,
    "",
    "DDD links:",
    settings.bookingDestinationsText || "Add booking, mobile app, Auto Doc, main site, and apply links."
  ].join("\n");
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#fff8fd"
  },
  container: {
    gap: 14,
    padding: 18,
    paddingBottom: 42
  },
  header: {
    gap: 5,
    paddingBottom: 4
  },
  eyebrow: {
    color: "#b7218f",
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase"
  },
  title: {
    color: "#202236",
    fontSize: 34,
    fontWeight: "900"
  },
  subtitle: {
    color: "#5d6178",
    fontSize: 16,
    fontWeight: "700"
  },
  card: {
    gap: 12,
    overflow: "hidden",
    borderColor: "rgba(124, 118, 255, 0.22)",
    borderRadius: 8,
    borderWidth: 1,
    backgroundColor: "#ffffff",
    padding: 16,
    shadowColor: "#2b1d52",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 18
  },
  cardTitle: {
    color: "#202236",
    fontSize: 20,
    fontWeight: "900"
  },
  sectionTitle: {
    color: "#202236",
    fontSize: 15,
    fontWeight: "800"
  },
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10
  },
  statusRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between"
  },
  field: {
    gap: 6
  },
  label: {
    color: "#34364a",
    fontSize: 13,
    fontWeight: "800"
  },
  input: {
    minHeight: 46,
    borderColor: "#d9d3ee",
    borderRadius: 6,
    borderWidth: 1,
    backgroundColor: "#ffffff",
    color: "#202236",
    paddingHorizontal: 12,
    paddingVertical: 10
  },
  textarea: {
    minHeight: 118
  },
  button: {
    alignItems: "center",
    alignSelf: "flex-start",
    justifyContent: "center",
    minHeight: 46,
    borderRadius: 6,
    backgroundColor: "#7d4dff",
    paddingHorizontal: 16,
    paddingVertical: 10
  },
  lightButton: {
    backgroundColor: "#f3edff"
  },
  disabledButton: {
    opacity: 0.55
  },
  pressedButton: {
    opacity: 0.82
  },
  buttonText: {
    color: "#ffffff",
    fontWeight: "900"
  },
  lightButtonText: {
    color: "#603be4"
  },
  speedRow: {
    flexDirection: "row",
    gap: 10
  },
  segmentWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  segment: {
    borderColor: "#d9d3ee",
    borderRadius: 6,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 8
  },
  segmentSelected: {
    borderColor: "#e640a5",
    backgroundColor: "#fff0fa"
  },
  segmentText: {
    color: "#4b4e65",
    fontWeight: "800"
  },
  segmentTextSelected: {
    color: "#b7218f"
  },
  badges: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  badge: {
    overflow: "hidden",
    borderRadius: 6,
    paddingHorizontal: 9,
    paddingVertical: 6,
    fontSize: 12,
    fontWeight: "900"
  },
  badgeOk: {
    backgroundColor: "#e9fff3",
    color: "#12824d"
  },
  badgeMissing: {
    backgroundColor: "#fff0f3",
    color: "#c23b52"
  },
  activityBlock: {
    gap: 6,
    borderTopColor: "#f0edf8",
    borderTopWidth: 1,
    paddingTop: 10
  },
  record: {
    color: "#55576d",
    fontSize: 13
  },
  muted: {
    color: "#686a80",
    fontSize: 13
  },
  status: {
    color: "#55576d",
    minHeight: 24,
    fontWeight: "800"
  },
  testOutput: {
    borderColor: "#d9d3ee",
    borderRadius: 6,
    borderWidth: 1,
    backgroundColor: "#fffaff",
    color: "#34364a",
    fontSize: 13,
    lineHeight: 19,
    padding: 12
  }
});
