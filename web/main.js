const callButton = document.querySelector("#callButton");
const hangupButton = document.querySelector("#hangupButton");
const statusEl = document.querySelector("#status");
const leadForm = document.querySelector("#leadForm");
const leadStatus = document.querySelector("#leadStatus");
const callsList = document.querySelector("#callsList");
const leadsList = document.querySelector("#leadsList");
const summariesList = document.querySelector("#summariesList");
const bookingsList = document.querySelector("#bookingsList");
const setupList = document.querySelector("#setupList");
const webhookUrl = document.querySelector("#webhookUrl");
const enabledToggle = document.querySelector("#enabledToggle");
const voiceSelect = document.querySelector("#voiceSelect");
const voiceSpeedInput = document.querySelector("#voiceSpeedInput");
const voiceSpeedOutput = document.querySelector("#voiceSpeedOutput");
const voiceDirectionInput = document.querySelector("#voiceDirectionInput");
const previewVoiceButton = document.querySelector("#previewVoiceButton");
const voicePreviewAudio = document.querySelector("#voicePreviewAudio");
const greetingInput = document.querySelector("#greetingInput");
const businessKnowledgeInput = document.querySelector("#businessKnowledgeInput");
const serviceAreaInput = document.querySelector("#serviceAreaInput");
const pricingNotesInput = document.querySelector("#pricingNotesInput");
const emergencyInstructionsInput = document.querySelector("#emergencyInstructionsInput");
const humanHandoffRulesInput = document.querySelector("#humanHandoffRulesInput");
const applyInstructionsInput = document.querySelector("#applyInstructionsInput");
const bookingDestinationsInput = document.querySelector("#bookingDestinationsInput");
const qualifyingServicesInput = document.querySelector("#qualifyingServicesInput");
const outOfScopeHandlingInput = document.querySelector("#outOfScopeHandlingInput");
const followUpStyleInput = document.querySelector("#followUpStyleInput");
const newClientsFlowInput = document.querySelector("#newClientsFlowInput");
const existingClientsFlowInput = document.querySelector("#existingClientsFlowInput");
const salesFlowInput = document.querySelector("#salesFlowInput");
const otherCallersFlowInput = document.querySelector("#otherCallersFlowInput");
const ambientSoundSelect = document.querySelector("#ambientSoundSelect");
const thinkingSoundToggle = document.querySelector("#thinkingSoundToggle");
const smsFollowUpToggle = document.querySelector("#smsFollowUpToggle");
const smsFollowUpMessageInput = document.querySelector("#smsFollowUpMessageInput");
const customInstructionsInput = document.querySelector("#customInstructionsInput");
const scriptPreview = document.querySelector("#scriptPreview");
const testCallerInput = document.querySelector("#testCallerInput");
const testScriptButton = document.querySelector("#testScriptButton");
const testScriptOutput = document.querySelector("#testScriptOutput");
const saveSettingsButton = document.querySelector("#saveSettingsButton");
const editSettingsButton = document.querySelector("#editSettingsButton");
const settingsStatus = document.querySelector("#settingsStatus");

let peerConnection;
let localStream;
let dataChannel;
let editMode = false;
let saveTimer;
let isLoadingSettings = false;

fetch("/api/business")
  .then((res) => res.json())
  .then((business) => {
    document.querySelector("#businessName").textContent = business.name;
    document.querySelector("#googleVoiceNumber").textContent = business.googleVoiceNumber || "Not set";
    document.querySelector("#aiForwardingNumber").textContent = business.aiForwardingNumber || "Not set";
  })
  .catch(() => {});

loadSettings().catch(() => {
  settingsStatus.textContent = "Could not load receptionist settings.";
});

fetch("/api/setup-status")
  .then((res) => res.json())
  .then((status) => {
    const labels = {
      openAIKey: "OpenAI API key",
      publicBaseUrl: "Public HTTPS URL",
      webhookSecret: "OpenAI webhook secret",
      googleVoiceNumber: "Google Voice number",
      aiForwardingNumber: "AI forwarding number"
    };

    setupList.innerHTML = "";
    for (const [key, ok] of Object.entries(status.required)) {
      const item = document.createElement("li");
      item.textContent = `${ok ? "Ready" : "Missing"}: ${labels[key]}`;
      item.className = ok ? "ready" : "missing";
      setupList.append(item);
    }

    webhookUrl.textContent = status.webhookUrl ? `Webhook URL: ${status.webhookUrl}` : "Webhook URL appears after PUBLIC_BASE_URL is set.";
  })
  .catch(() => {});

function setStatus(message) {
  statusEl.textContent = message;
}

async function loadSettings() {
  isLoadingSettings = true;
  const response = await fetch("/api/settings");
  const settings = await response.json();
  voiceSelect.innerHTML = "";
  for (const voice of settings.voiceOptions || []) {
    const option = document.createElement("option");
    option.value = voice.id;
    option.textContent = `${voice.label} - ${voice.note}`;
    voiceSelect.append(option);
  }
  enabledToggle.checked = settings.enabled !== false;
  voiceSelect.value = settings.voice || "marin";
  voiceSpeedInput.value = settings.voiceSpeed || 1;
  voiceSpeedOutput.value = `${Number(voiceSpeedInput.value).toFixed(2)}x`;
  voiceDirectionInput.value = settings.voiceDirection || "";
  greetingInput.value = settings.greeting || "";
  businessKnowledgeInput.value = settings.businessKnowledge || "";
  serviceAreaInput.value = settings.serviceArea || "";
  pricingNotesInput.value = settings.pricingNotes || "";
  emergencyInstructionsInput.value = settings.emergencyInstructions || "";
  humanHandoffRulesInput.value = settings.humanHandoffRules || "";
  applyInstructionsInput.value = settings.applyInstructions || "";
  bookingDestinationsInput.value = formatBookingDestinations(settings.bookingDestinations || []);
  qualifyingServicesInput.value = (settings.qualifyingServices || []).join("\n");
  outOfScopeHandlingInput.value = settings.outOfScopeHandling || "";
  followUpStyleInput.value = settings.followUpStyle || "";
  newClientsFlowInput.value = settings.callerFlows?.newClients || "";
  existingClientsFlowInput.value = settings.callerFlows?.existingClients || "";
  salesFlowInput.value = settings.callerFlows?.sales || "";
  otherCallersFlowInput.value = settings.callerFlows?.otherCallers || "";
  ambientSoundSelect.value = settings.soundPreferences?.ambientSound || "none";
  thinkingSoundToggle.checked = settings.soundPreferences?.thinkingSound !== false;
  smsFollowUpToggle.checked = settings.smsFollowUp?.enabled !== false;
  smsFollowUpMessageInput.value =
    settings.smsFollowUp?.message ||
    "Thanks for calling DDD. Here is the best next link for your request: {{link}}. The DDD team will follow up if anything else is needed.";
  customInstructionsInput.value = settings.customInstructions || "";
  isLoadingSettings = false;
  setEditMode(editMode);
  previewVoiceButton.disabled = false;
  updateScriptPreview();
  settingsStatus.textContent = settings.enabled
    ? `Live. New calls will use ${voiceSelect.selectedOptions[0]?.textContent || voiceSelect.value}.`
    : "Paused. New calls will be logged but the AI will not answer.";
}

editSettingsButton.addEventListener("click", () => {
  setEditMode(!editMode);
});

saveSettingsButton.addEventListener("click", () => {
  saveSettings("manual").catch(() => {});
});

async function saveSettings(reason = "auto") {
  voiceSelect.disabled = true;
  saveSettingsButton.disabled = true;
  settingsStatus.textContent = reason === "auto" ? "Autosaving..." : "Saving receptionist settings...";
  try {
    const response = await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        enabled: enabledToggle.checked,
        voice: voiceSelect.value,
        voiceSpeed: voiceSpeedInput.value,
        voiceDirection: voiceDirectionInput.value,
        greeting: greetingInput.value,
        businessKnowledge: businessKnowledgeInput.value,
        serviceArea: serviceAreaInput.value,
        pricingNotes: pricingNotesInput.value,
        emergencyInstructions: emergencyInstructionsInput.value,
        humanHandoffRules: humanHandoffRulesInput.value,
        applyInstructions: applyInstructionsInput.value,
        bookingDestinations: parseBookingDestinations(bookingDestinationsInput.value),
        qualifyingServices: qualifyingServicesInput.value,
        outOfScopeHandling: outOfScopeHandlingInput.value,
        followUpStyle: followUpStyleInput.value,
        callerFlows: {
          newClients: newClientsFlowInput.value,
          existingClients: existingClientsFlowInput.value,
          sales: salesFlowInput.value,
          otherCallers: otherCallersFlowInput.value
        },
        soundPreferences: {
          ambientSound: ambientSoundSelect.value,
          thinkingSound: thinkingSoundToggle.checked
        },
        smsFollowUp: {
          enabled: smsFollowUpToggle.checked,
          message: smsFollowUpMessageInput.value
        },
        customInstructions: customInstructionsInput.value
      })
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || "Could not save receptionist settings.");
    }
    await loadSettings();
    settingsStatus.textContent = enabledToggle.checked
      ? `${reason === "auto" ? "Autosaved" : "Saved"}. New calls will use ${voiceSelect.selectedOptions[0]?.textContent || voiceSelect.value}.`
      : `${reason === "auto" ? "Autosaved" : "Saved"}. The AI receptionist is paused.`;
  } catch (error) {
    settingsStatus.textContent = error.message;
    setEditMode(editMode);
    previewVoiceButton.disabled = false;
    throw error;
  }
}

previewVoiceButton.addEventListener("click", async () => {
  previewVoiceButton.disabled = true;
  settingsStatus.textContent = "Making voice preview...";
  try {
    const response = await fetch("/api/voice-preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        voice: voiceSelect.value,
        voiceSpeed: voiceSpeedInput.value,
        voiceDirection: voiceDirectionInput.value,
        text: greetingInput.value || "Thank you for calling DDD. How can I help today?"
      })
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || "Could not make voice preview.");
    }
    const audioBlob = await response.blob();
    if (voicePreviewAudio.src) URL.revokeObjectURL(voicePreviewAudio.src);
    voicePreviewAudio.src = URL.createObjectURL(audioBlob);
    await voicePreviewAudio.play().catch(() => {});
    settingsStatus.textContent = "Preview ready.";
  } catch (error) {
    settingsStatus.textContent = error.message;
  } finally {
    previewVoiceButton.disabled = false;
  }
});

for (const input of [
  enabledToggle,
  voiceSelect,
  voiceSpeedInput,
  voiceDirectionInput,
  greetingInput,
  businessKnowledgeInput,
  serviceAreaInput,
  pricingNotesInput,
  emergencyInstructionsInput,
  humanHandoffRulesInput,
  applyInstructionsInput,
  bookingDestinationsInput,
  qualifyingServicesInput,
  outOfScopeHandlingInput,
  followUpStyleInput,
  newClientsFlowInput,
  existingClientsFlowInput,
  salesFlowInput,
  otherCallersFlowInput,
  ambientSoundSelect,
  thinkingSoundToggle,
  smsFollowUpToggle,
  smsFollowUpMessageInput,
  customInstructionsInput
]) {
  input.addEventListener("input", handleSettingsChange);
  input.addEventListener("change", handleSettingsChange);
}

voiceSpeedInput.addEventListener("input", () => {
  voiceSpeedOutput.value = `${Number(voiceSpeedInput.value).toFixed(2)}x`;
});

function handleSettingsChange() {
  updateScriptPreview();
  if (!editMode || isLoadingSettings) return;
  clearTimeout(saveTimer);
  settingsStatus.textContent = "Unsaved changes...";
  saveTimer = setTimeout(() => {
    saveSettings("auto").catch(() => {});
  }, 900);
}

function setEditMode(nextEditMode) {
  editMode = nextEditMode;
  editSettingsButton.textContent = editMode ? "Lock settings" : "Edit settings";
  for (const input of [
    enabledToggle,
    voiceSelect,
    voiceSpeedInput,
    voiceDirectionInput,
    greetingInput,
    businessKnowledgeInput,
    serviceAreaInput,
    pricingNotesInput,
    emergencyInstructionsInput,
    humanHandoffRulesInput,
    applyInstructionsInput,
    bookingDestinationsInput,
    qualifyingServicesInput,
    outOfScopeHandlingInput,
    followUpStyleInput,
    newClientsFlowInput,
    existingClientsFlowInput,
    salesFlowInput,
    otherCallersFlowInput,
    ambientSoundSelect,
    thinkingSoundToggle,
    smsFollowUpToggle,
    smsFollowUpMessageInput,
    customInstructionsInput
  ]) {
    input.disabled = !editMode;
  }
  saveSettingsButton.disabled = !editMode;
  previewVoiceButton.disabled = false;
  document.body.classList.toggle("edit-mode", editMode);
  if (!editMode) {
    clearTimeout(saveTimer);
    settingsStatus.textContent = "Settings locked. Tap Edit settings before changing anything.";
  }
}

testScriptButton.addEventListener("click", async () => {
  testScriptButton.disabled = true;
  testScriptOutput.value = "Testing...";
  try {
    const response = await fetch("/api/test-script", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ callerMessage: testCallerInput.value })
    });
    if (!response.ok) throw new Error("Could not run the free test.");
    const result = await response.json();
    testScriptOutput.value = [
      `Intent: ${result.intent}`,
      result.destination ? `Link: ${result.destination.label} - ${result.destination.url}` : "Link: none selected",
      "",
      result.likelyReply,
      "",
      result.note
    ].join("\n");
  } catch (error) {
    testScriptOutput.value = error.message;
  } finally {
    testScriptButton.disabled = false;
  }
});

function updateScriptPreview() {
  scriptPreview.value = [
    enabledToggle.checked ? "Status: AI answers new calls." : "Status: AI is paused.",
    `Voice: ${voiceSelect.selectedOptions[0]?.textContent || voiceSelect.value || "Marin"}`,
    `Speed: ${Number(voiceSpeedInput.value || 1).toFixed(2)}x`,
    `Voice direction: ${voiceDirectionInput.value || "Warm, confident, friendly receptionist."}`,
    `Greeting: ${greetingInput.value || "Thank you for calling DDD, this is the receptionist. How can I help today?"}`,
    "",
    "Business knowledge:",
    businessKnowledgeInput.value || "Add DDD services, prices, service areas, hours, policies, and answers here.",
    "",
    `Service area: ${serviceAreaInput.value || "Greater Cincinnati and nearby service areas."}`,
    `Pricing rules: ${pricingNotesInput.value || "Do not quote exact pricing unless added here."}`,
    `Emergency handling: ${emergencyInstructionsInput.value || "Confirm safety, location, vehicle, callback number, and urgent link."}`,
    `Human handoff: ${humanHandoffRulesInput.value || "Save details; do not promise a live transfer."}`,
    `Apply-to-work: ${applyInstructionsInput.value || "Collect applicant details and share the apply link."}`,
    "",
    "Booking, app, and apply options:",
    bookingDestinationsInput.value || "Add one destination per line.",
    "",
    "Qualifying services:",
    qualifyingServicesInput.value || "Roadside assistance\nMaintenance/repair\nExisting appointment",
    "",
    "Caller intake:",
    `New clients: ${newClientsFlowInput.value || "Qualify and collect lead details."}`,
    `Existing clients: ${existingClientsFlowInput.value || "Collect job or appointment details."}`,
    `Sales: ${salesFlowInput.value || "Collect a message without committing."}`,
    `Other callers: ${otherCallersFlowInput.value || "Collect caller info and reason."}`,
    "",
    `Out-of-scope: ${outOfScopeHandlingInput.value || "Take a message unless unsafe or unrelated."}`,
    `Follow-up: ${followUpStyleInput.value || "Share booking link or save a callback message."}`,
    `Sound: ${ambientSoundSelect.value || "none"}; thinking phrases ${thinkingSoundToggle.checked ? "on" : "off"}.`,
    `SMS follow-up: ${smsFollowUpToggle.checked ? "on" : "off"}. ${smsFollowUpMessageInput.value || "Text the best DDD link after permission."}`,
    "",
    "Behavior:",
    customInstructionsInput.value || "Tell the receptionist exactly how to handle callers."
  ].join("\n");
}

function formatBookingDestinations(destinations) {
  return destinations
    .map((destination) => `${destination.label || ""} | ${destination.url || ""} | ${destination.useWhen || ""}`)
    .join("\n");
}

function parseBookingDestinations(value) {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [label = "", url = "", ...useWhenParts] = line.split("|").map((part) => part.trim());
      return {
        label,
        url,
        useWhen: useWhenParts.join(" | ")
      };
    })
    .filter((destination) => destination.label && destination.url && destination.useWhen);
}

function renderList(element, records, emptyMessage, formatter) {
  element.innerHTML = "";
  if (!records.length) {
    const item = document.createElement("li");
    item.textContent = emptyMessage;
    element.append(item);
    return;
  }

  for (const record of records) {
    const item = document.createElement("li");
    item.textContent = formatter(record);
    element.append(item);
  }
}

async function refreshActivity() {
  const [callsResponse, leadsResponse, summariesResponse, bookingsResponse] = await Promise.all([
    fetch("/api/calls"),
    fetch("/api/leads"),
    fetch("/api/summaries"),
    fetch("/api/bookings")
  ]);
  const [{ calls }, { leads }, { summaries }, { bookings }] = await Promise.all([
    callsResponse.json(),
    leadsResponse.json(),
    summariesResponse.json(),
    bookingsResponse.json()
  ]);
  renderList(callsList, calls, "No forwarded calls yet.", (call) => `${call.createdAt} ${call.callId || ""}`.trim());
  renderList(leadsList, leads, "No leads yet.", (lead) => `${lead.createdAt} ${lead.name || lead.phone || "Lead"}`);
  renderList(
    summariesList,
    summaries,
    "No summaries yet.",
    (summary) => `${summary.endedAt || summary.createdAt} ${summary.callId || "Browser call"}`
  );
  renderList(
    bookingsList,
    bookings,
    "No booking requests yet.",
    (booking) => `${booking.createdAt} ${booking.name || booking.phone || "Booking"}`
  );
}

refreshActivity().catch(() => {});
setInterval(() => refreshActivity().catch(() => {}), 15000);

callButton.addEventListener("click", async () => {
  callButton.disabled = true;
  setStatus("Requesting microphone...");

  try {
    peerConnection = new RTCPeerConnection();
    localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    localStream.getTracks().forEach((track) => peerConnection.addTrack(track, localStream));

    const remoteAudio = new Audio();
    remoteAudio.autoplay = true;
    peerConnection.ontrack = (event) => {
      remoteAudio.srcObject = event.streams[0];
    };

    dataChannel = peerConnection.createDataChannel("oai-events");
    dataChannel.addEventListener("message", handleRealtimeEvent);
    dataChannel.addEventListener("open", () => {
      dataChannel.send(
        JSON.stringify({
          type: "response.create",
          response: {
            instructions: "Greet the caller and ask how you can help."
          }
        })
      );
    });

    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);

    setStatus("Connecting to the AI receptionist...");
    const response = await fetch("/api/webrtc-offer", {
      method: "POST",
      headers: { "Content-Type": "application/sdp" },
      body: offer.sdp
    });

    if (!response.ok) {
      throw new Error(await response.text());
    }

    const answer = await response.text();
    await peerConnection.setRemoteDescription({ type: "answer", sdp: answer });
    hangupButton.disabled = false;
    setStatus("Connected. Speak naturally.");
  } catch (error) {
    console.error(error);
    setStatus(`Could not connect: ${error.message}`);
    callButton.disabled = false;
  }
});

hangupButton.addEventListener("click", () => {
  dataChannel?.close();
  localStream?.getTracks().forEach((track) => track.stop());
  peerConnection?.close();
  dataChannel = undefined;
  localStream = undefined;
  peerConnection = undefined;
  hangupButton.disabled = true;
  callButton.disabled = false;
  setStatus("Call ended.");
});

leadForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const body = Object.fromEntries(new FormData(leadForm).entries());
  const response = await fetch("/api/leads", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  leadStatus.textContent = response.ok ? "Lead saved." : "Could not save lead.";
  if (response.ok) {
    leadForm.reset();
    refreshActivity().catch(() => {});
  }
});

async function handleRealtimeEvent(message) {
  const event = JSON.parse(message.data);
  if (
    event.type !== "response.function_call_arguments.done" ||
    (event.name !== "save_lead" && event.name !== "save_booking_request")
  ) {
    return;
  }

  const args = JSON.parse(event.arguments || "{}");
  const response = await fetch(event.name === "save_booking_request" ? "/api/bookings" : "/api/leads", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...args, source: "browser" })
  });

  const payload = await response.json();
  dataChannel.send(
    JSON.stringify({
      type: "conversation.item.create",
      item: {
        type: "function_call_output",
        call_id: event.call_id,
        output: JSON.stringify({
          ok: response.ok,
          recordId: (payload.lead || payload.booking)?.createdAt
        })
      }
    })
  );
  dataChannel.send(
    JSON.stringify({
      type: "response.create",
      response: {
        instructions:
          event.name === "save_booking_request"
            ? "Tell the caller the booking request has been saved, share the booking link if useful, and give a concise next step."
            : "Tell the caller their message has been saved and give a concise next step."
      }
    })
  );
  refreshActivity().catch(() => {});
}
