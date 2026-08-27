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
const adminPinInput = document.querySelector("#adminPinInput");
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
const offeredServicesInput = document.querySelector("#offeredServicesInput");
const notOfferedServicesInput = document.querySelector("#notOfferedServicesInput");
const pricingNotesInput = document.querySelector("#pricingNotesInput");
const emergencyInstructionsInput = document.querySelector("#emergencyInstructionsInput");
const emergencyQuestionsInput = document.querySelector("#emergencyQuestionsInput");
const humanHandoffRulesInput = document.querySelector("#humanHandoffRulesInput");
const afterHoursInstructionsInput = document.querySelector("#afterHoursInstructionsInput");
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
const refreshInboxButton = document.querySelector("#refreshInboxButton");
const staffPinInput = document.querySelector("#staffPinInput");
const staffNameInput = document.querySelector("#staffNameInput");
const conversationList = document.querySelector("#conversationList");
const selectedConversationTitle = document.querySelector("#selectedConversationTitle");
const selectedConversationMeta = document.querySelector("#selectedConversationMeta");
const messageList = document.querySelector("#messageList");
const replyForm = document.querySelector("#replyForm");
const replyMessageInput = document.querySelector("#replyMessageInput");
const sendReplyButton = document.querySelector("#sendReplyButton");
const inboxStatus = document.querySelector("#inboxStatus");

let peerConnection;
let localStream;
let dataChannel;
let editMode = false;
let saveTimer;
let isLoadingSettings = false;
let conversations = [];
let selectedConversationPhone = "";

adminPinInput.value = localStorage.getItem("dddStaffPin") || "";
staffPinInput.value = localStorage.getItem("dddStaffPin") || "";
staffNameInput.value = localStorage.getItem("dddStaffName") || "";

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
      aiForwardingNumber: "AI forwarding number",
      smsDelivery: "SMS delivery"
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
  offeredServicesInput.value = settings.offeredServices || "";
  notOfferedServicesInput.value = settings.notOfferedServices || "";
  pricingNotesInput.value = settings.pricingNotes || "";
  emergencyInstructionsInput.value = settings.emergencyInstructions || "";
  emergencyQuestionsInput.value = (settings.emergencyQuestions || []).join("\n");
  humanHandoffRulesInput.value = settings.humanHandoffRules || "";
  afterHoursInstructionsInput.value = settings.afterHoursInstructions || "";
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
      headers: { "Content-Type": "application/json", ...adminHeaders() },
      body: JSON.stringify({
        enabled: enabledToggle.checked,
        voice: voiceSelect.value,
        voiceSpeed: voiceSpeedInput.value,
        voiceDirection: voiceDirectionInput.value,
        greeting: greetingInput.value,
        businessKnowledge: businessKnowledgeInput.value,
        serviceArea: serviceAreaInput.value,
        offeredServices: offeredServicesInput.value,
        notOfferedServices: notOfferedServicesInput.value,
        pricingNotes: pricingNotesInput.value,
        emergencyInstructions: emergencyInstructionsInput.value,
        emergencyQuestions: emergencyQuestionsInput.value,
        humanHandoffRules: humanHandoffRulesInput.value,
        afterHoursInstructions: afterHoursInstructionsInput.value,
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
      throw new Error(response.status === 403 ? "Enter the admin PIN before saving settings." : error.error || "Could not save receptionist settings.");
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
  offeredServicesInput,
  notOfferedServicesInput,
  pricingNotesInput,
  emergencyInstructionsInput,
  emergencyQuestionsInput,
  humanHandoffRulesInput,
  afterHoursInstructionsInput,
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
    offeredServicesInput,
    notOfferedServicesInput,
    pricingNotesInput,
    emergencyInstructionsInput,
    emergencyQuestionsInput,
    humanHandoffRulesInput,
    afterHoursInstructionsInput,
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
    `Services offered: ${offeredServicesInput.value || "Roadside assistance, mobile auto service, app help, Auto Doc, and apply-to-work questions."}`,
    `Do not promise: ${notOfferedServicesInput.value || "No exact pricing, exact arrival times, or services DDD has not confirmed."}`,
    `Pricing rules: ${pricingNotesInput.value || "Do not quote exact pricing unless added here."}`,
    `Emergency handling: ${emergencyInstructionsInput.value || "Confirm safety, location, vehicle, callback number, and urgent link."}`,
    "Emergency questions:",
    emergencyQuestionsInput.value || "Are you in a safe place right now?\nWhat is your exact location?\nWhat vehicle are you with?\nWhat happened?\nWhat is the best callback number?",
    `Human handoff: ${humanHandoffRulesInput.value || "Save details; do not promise a live transfer."}`,
    `After-hours: ${afterHoursInstructionsInput.value || "Collect the message and say the team will follow up as soon as possible."}`,
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

function adminHeaders() {
  const pin = adminPinInput.value.trim() || staffPinInput.value.trim();
  return pin ? { "x-admin-pin": pin } : {};
}

function formatPhone(phone) {
  const digits = String(phone || "").replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) {
    return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  return phone || "Unknown";
}

function formatTime(value) {
  if (!value) return "";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(value));
}

function setInboxStatus(message) {
  inboxStatus.textContent = message;
}

function renderConversations() {
  conversationList.innerHTML = "";
  if (!conversations.length) {
    const empty = document.createElement("p");
    empty.className = "empty-state";
    empty.textContent = "No texts yet.";
    conversationList.append(empty);
    renderSelectedConversation();
    return;
  }

  if (!selectedConversationPhone || !conversations.some((conversation) => conversation.phone === selectedConversationPhone)) {
    selectedConversationPhone = conversations[0].phone;
  }

  for (const conversation of conversations) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = conversation.phone === selectedConversationPhone ? "conversation-item selected" : "conversation-item";
    button.innerHTML = `
      <strong>${formatPhone(conversation.phone)}</strong>
      <span>${conversation.lastBody || "No message body"}</span>
      <small>${formatTime(conversation.lastMessageAt)}</small>
    `;
    button.addEventListener("click", () => {
      selectedConversationPhone = conversation.phone;
      renderConversations();
    });
    conversationList.append(button);
  }

  renderSelectedConversation();
}

function renderSelectedConversation() {
  const conversation = conversations.find((item) => item.phone === selectedConversationPhone);
  messageList.innerHTML = "";
  if (!conversation) {
    selectedConversationTitle.textContent = "Select a conversation";
    selectedConversationMeta.textContent = "";
    sendReplyButton.disabled = true;
    return;
  }

  selectedConversationTitle.textContent = formatPhone(conversation.phone);
  selectedConversationMeta.textContent = `${conversation.messages.length} message${conversation.messages.length === 1 ? "" : "s"}`;
  sendReplyButton.disabled = !replyMessageInput.value.trim();

  for (const message of conversation.messages) {
    const bubble = document.createElement("article");
    bubble.className = `message-bubble ${message.direction === "outbound" ? "outbound" : "inbound"}`;
    const meta = [message.direction === "outbound" ? message.agentName || "DDD team" : "Customer", formatTime(message.createdAt), message.status]
      .filter(Boolean)
      .join(" · ");
    bubble.innerHTML = `
      <p>${escapeHtml(message.body || "")}</p>
      <small>${escapeHtml(meta)}</small>
    `;
    messageList.append(bubble);
  }
  messageList.scrollTop = messageList.scrollHeight;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function refreshInbox() {
  localStorage.setItem("dddStaffPin", staffPinInput.value.trim());
  localStorage.setItem("dddStaffName", staffNameInput.value.trim());
  setInboxStatus("Loading texts...");
  const response = await fetch("/api/conversations", { headers: adminHeaders() });
  if (response.status === 403) {
    setInboxStatus("Enter the staff PIN to load texts.");
    conversations = [];
    renderConversations();
    return;
  }
  if (!response.ok) throw new Error("Could not load text inbox.");
  const payload = await response.json();
  conversations = payload.conversations || [];
  renderConversations();
  setInboxStatus(conversations.length ? "Inbox is up to date." : "No texts yet. New SMS will appear here after Twilio receives the number.");
}

refreshInboxButton.addEventListener("click", () => {
  refreshInbox().catch((error) => setInboxStatus(error.message));
});

adminPinInput.addEventListener("change", () => {
  const pin = adminPinInput.value.trim();
  localStorage.setItem("dddStaffPin", pin);
  staffPinInput.value = pin;
  refreshInbox().catch((error) => setInboxStatus(error.message));
});

staffPinInput.addEventListener("change", () => {
  const pin = staffPinInput.value.trim();
  localStorage.setItem("dddStaffPin", pin);
  adminPinInput.value = pin;
  refreshInbox().catch((error) => setInboxStatus(error.message));
});

staffNameInput.addEventListener("change", () => {
  localStorage.setItem("dddStaffName", staffNameInput.value.trim());
});

replyMessageInput.addEventListener("input", () => {
  sendReplyButton.disabled = !selectedConversationPhone || !replyMessageInput.value.trim();
});

replyForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const message = replyMessageInput.value.trim();
  if (!selectedConversationPhone || !message) return;

  sendReplyButton.disabled = true;
  setInboxStatus("Sending text...");
  try {
    const response = await fetch("/api/sms/reply", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...adminHeaders()
      },
      body: JSON.stringify({
        to: selectedConversationPhone,
        message,
        agentName: staffNameInput.value.trim() || "DDD team"
      })
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || payload.delivery?.error || "Could not send text.");
    replyMessageInput.value = "";
    setInboxStatus("Text sent.");
    await refreshInbox();
  } catch (error) {
    setInboxStatus(error.message);
  } finally {
    sendReplyButton.disabled = !replyMessageInput.value.trim();
  }
});

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
refreshInbox().catch((error) => setInboxStatus(error.message));
setInterval(() => refreshInbox().catch(() => {}), 15000);

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
