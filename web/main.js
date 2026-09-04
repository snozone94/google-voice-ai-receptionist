const callButton = document.querySelector("#callButton");
const hangupButton = document.querySelector("#hangupButton");
const statusEl = document.querySelector("#status");
const leadForm = document.querySelector("#leadForm");
const leadStatus = document.querySelector("#leadStatus");
const callsList = document.querySelector("#callsList");
const leadsList = document.querySelector("#leadsList");
const summariesList = document.querySelector("#summariesList");
const bookingsList = document.querySelector("#bookingsList");
const callLogList = document.querySelector("#callLogList");
const callDetail = document.querySelector("#callDetail");
const callLogStatus = document.querySelector("#callLogStatus");
const refreshActivityButton = document.querySelector("#refreshActivityButton");
const refreshCallLogButton = document.querySelector("#refreshCallLogButton");
const refreshInsightsButton = document.querySelector("#refreshInsightsButton");
const insightHighlights = document.querySelector("#insightHighlights");
const insightFocusStrip = document.querySelector("#insightFocusStrip");
const insightSuggestionsList = document.querySelector("#insightSuggestionsList");
const insightsStatus = document.querySelector("#insightsStatus");
const insightLearningToggle = document.querySelector("#insightLearningToggle");
const learnTopServicesToggle = document.querySelector("#learnTopServicesToggle");
const learnTopLocationsToggle = document.querySelector("#learnTopLocationsToggle");
const learnQaIssuesToggle = document.querySelector("#learnQaIssuesToggle");
const learnSpeedToggle = document.querySelector("#learnSpeedToggle");
const learningPreview = document.querySelector("#learningPreview");
const insightCards = {
  daily: document.querySelector('[data-insight-card="daily"]'),
  weekly: document.querySelector('[data-insight-card="weekly"]'),
  monthly: document.querySelector('[data-insight-card="monthly"]')
};
const setupList = document.querySelector("#setupList");
const webhookUrl = document.querySelector("#webhookUrl");
const adminPinInput = document.querySelector("#adminPinInput");
const enabledToggle = document.querySelector("#enabledToggle");
const humanRouteModeSelect = document.querySelector("#humanRouteModeSelect");
const humanRouteTimeoutInput = document.querySelector("#humanRouteTimeoutInput");
const humanRouteSummary = document.querySelector("#humanRouteSummary");
const humanRouteCount = document.querySelector("#humanRouteCount");
const routeModeButtons = [...document.querySelectorAll("[data-route-mode]")];
const outboundStaffPhoneInput = document.querySelector("#outboundStaffPhoneInput");
const outboundCustomerPhoneInput = document.querySelector("#outboundCustomerPhoneInput");
const outboundCallerIdSelect = document.querySelector("#outboundCallerIdSelect");
const outboundCallButton = document.querySelector("#outboundCallButton");
const outboundCallStatus = document.querySelector("#outboundCallStatus");
const humanRouteNumbersInput = document.querySelector("#humanRouteNumbersInput");
const humanRouteTriggersInput = document.querySelector("#humanRouteTriggersInput");
const humanRouteCallerMessageInput = document.querySelector("#humanRouteCallerMessageInput");
const humanRouteFallbackMessageInput = document.querySelector("#humanRouteFallbackMessageInput");
const voiceSelect = document.querySelector("#voiceSelect");
const voiceSpeedInput = document.querySelector("#voiceSpeedInput");
const voiceSpeedOutput = document.querySelector("#voiceSpeedOutput");
const voiceDirectionInput = document.querySelector("#voiceDirectionInput");
const noiseModeSelect = document.querySelector("#noiseModeSelect");
const interruptResponseToggle = document.querySelector("#interruptResponseToggle");
const noiseNotesInput = document.querySelector("#noiseNotesInput");
const previewVoiceButton = document.querySelector("#previewVoiceButton");
const voicePreviewAudio = document.querySelector("#voicePreviewAudio");
const greetingInput = document.querySelector("#greetingInput");
const businessKnowledgeInput = document.querySelector("#businessKnowledgeInput");
const serviceAreaInput = document.querySelector("#serviceAreaInput");
const offeredServicesInput = document.querySelector("#offeredServicesInput");
const notOfferedServicesInput = document.querySelector("#notOfferedServicesInput");
const directoryReferralToggle = document.querySelector("#directoryReferralToggle");
const directoryReferralUrlInput = document.querySelector("#directoryReferralUrlInput");
const directoryReferralMessageInput = document.querySelector("#directoryReferralMessageInput");
const pricingNotesInput = document.querySelector("#pricingNotesInput");
const emergencyInstructionsInput = document.querySelector("#emergencyInstructionsInput");
const emergencyQuestionsInput = document.querySelector("#emergencyQuestionsInput");
const humanHandoffRulesInput = document.querySelector("#humanHandoffRulesInput");
const callOutcomeRulesInput = document.querySelector("#callOutcomeRulesInput");
const fallbackRulesInput = document.querySelector("#fallbackRulesInput");
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
const thinkingPhraseInput = document.querySelector("#thinkingPhraseInput");
const backgroundAudioModeSelect = document.querySelector("#backgroundAudioModeSelect");
const backgroundAudioLabelInput = document.querySelector("#backgroundAudioLabelInput");
const backgroundAudioUrlInput = document.querySelector("#backgroundAudioUrlInput");
const smsFollowUpToggle = document.querySelector("#smsFollowUpToggle");
const smsFollowUpMessageInput = document.querySelector("#smsFollowUpMessageInput");
const reviewFollowUpToggle = document.querySelector("#reviewFollowUpToggle");
const reviewFollowUpUrlInput = document.querySelector("#reviewFollowUpUrlInput");
const reviewFollowUpMessageInput = document.querySelector("#reviewFollowUpMessageInput");
const notifyNewCallsToggle = document.querySelector("#notifyNewCallsToggle");
const notifyMissedCallsToggle = document.querySelector("#notifyMissedCallsToggle");
const notifyBookingsToggle = document.querySelector("#notifyBookingsToggle");
const notifyTextsToggle = document.querySelector("#notifyTextsToggle");
const notifyQaIssuesToggle = document.querySelector("#notifyQaIssuesToggle");
const notifyDailySummaryToggle = document.querySelector("#notifyDailySummaryToggle");
const notifyWeeklySummaryToggle = document.querySelector("#notifyWeeklySummaryToggle");
const notifyMonthlySummaryToggle = document.querySelector("#notifyMonthlySummaryToggle");
const enableWebPushButton = document.querySelector("#enableWebPushButton");
const testWebPushButton = document.querySelector("#testWebPushButton");
const checkWebPushButton = document.querySelector("#checkWebPushButton");
const webPushStatus = document.querySelector("#webPushStatus");
const webPushDiagnostic = document.querySelector("#webPushDiagnostic");
const activityOverview = document.querySelector("#activityOverview");
const activityTimeline = document.querySelector("#activityTimeline");
const activityFilterButtons = document.querySelectorAll("[data-activity-filter]");
const customInstructionsInput = document.querySelector("#customInstructionsInput");
const scriptPreview = document.querySelector("#scriptPreview");
const testCallerInput = document.querySelector("#testCallerInput");
const testScriptButton = document.querySelector("#testScriptButton");
const testScriptOutput = document.querySelector("#testScriptOutput");
const testScenarioButtons = [...document.querySelectorAll("[data-test-scenario]")];
const saveSettingsButton = document.querySelector("#saveSettingsButton");
const editSettingsButton = document.querySelector("#editSettingsButton");
const settingsStatus = document.querySelector("#settingsStatus");
const refreshInboxButton = document.querySelector("#refreshInboxButton");
const inboxLoginButton = document.querySelector("#inboxLoginButton");
const accessSessionStatus = document.querySelector("#accessSessionStatus");
const refreshInboxPanelButton = document.querySelector("#refreshInboxPanelButton");
const refreshTeamButton = document.querySelector("#refreshTeamButton");
const staffPinInput = document.querySelector("#staffPinInput");
const staffNameInput = document.querySelector("#staffNameInput");
const staffStatusSelect = document.querySelector("#staffStatusSelect");
const staffAccessCodesInput = document.querySelector("#staffAccessCodesInput");
const staffCodeRows = document.querySelector("#staffCodeRows");
const addStaffCodeButton = document.querySelector("#addStaffCodeButton");
const teamCurrentCodeStatus = document.querySelector("#teamCurrentCodeStatus");
const teamCurrentStatus = document.querySelector("#teamCurrentStatus");
const conversationList = document.querySelector("#conversationList");
const selectedConversationTitle = document.querySelector("#selectedConversationTitle");
const selectedConversationMeta = document.querySelector("#selectedConversationMeta");
const conversationConfidence = document.querySelector("#conversationConfidence");
const conversationDetails = document.querySelector("#conversationDetails");
const messageList = document.querySelector("#messageList");
const replyForm = document.querySelector("#replyForm");
const replyMessageInput = document.querySelector("#replyMessageInput");
const sendReplyButton = document.querySelector("#sendReplyButton");
const quickReplies = document.querySelector("#quickReplies");
const inboxStatus = document.querySelector("#inboxStatus");
const teamPresenceList = document.querySelector("#teamPresenceList");
const typingStatus = document.querySelector("#typingStatus");
const teamSourceStatus = document.querySelector("#teamSourceStatus");
const refreshQaButton = document.querySelector("#refreshQaButton");
const qaChecksList = document.querySelector("#qaChecksList");
const qaIssuesList = document.querySelector("#qaIssuesList");
const qaChecklistInput = document.querySelector("#qaChecklistInput");
const qaStatus = document.querySelector("#qaStatus");
const tabButtons = [...document.querySelectorAll("[data-tab-target]")];
const tabPanels = [...document.querySelectorAll("[data-tab-panel]")];

let peerConnection;
let localStream;
let dataChannel;
let editMode = false;
let saveTimer;
let staffRefreshTimer;
let activityFilter = "all";
let activityItems = [];
let isLoadingSettings = false;
let isSavingSettings = false;
let hasUnsavedSettings = false;
let conversations = [];
let selectedConversationPhone = "";
let inboxSeenMessageKeys = new Set();
let inboxSeenInitialized = false;
let callLog = [];
let selectedCallId = "";
let teamDirectory = [];
let activePresence = [];
let teamSource = "";
let signedInStaff = null;
let verifiedAccessCode = "";
let accessCheckPromise = null;

const savedAccessCode = localStorage.getItem("dddAccessCode") || localStorage.getItem("dddAdminPin") || localStorage.getItem("dddStaffCode") || localStorage.getItem("dddStaffPin") || "";
adminPinInput.value = savedAccessCode;
staffPinInput.value = "";
staffNameInput.value = localStorage.getItem("dddStaffName") || "";
staffStatusSelect.value = normalizeStaffStatus(localStorage.getItem("dddStaffStatus"));
if (outboundStaffPhoneInput) outboundStaffPhoneInput.value = localStorage.getItem("dddOutboundStaffPhone") || "";
if (outboundCallerIdSelect) outboundCallerIdSelect.value = localStorage.getItem("dddOutboundCallerId") || "";
updateTeamCurrentCard();
updateWebPushAvailabilityStatus();

for (const button of tabButtons) {
  button.addEventListener("click", () => setActiveTab(button.dataset.tabTarget));
}

function setActiveTab(tabName) {
  for (const button of tabButtons) {
    button.classList.toggle("active", button.dataset.tabTarget === tabName);
    if (button.dataset.tabTarget === tabName) {
      button.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
    }
  }
  for (const panel of tabPanels) {
    panel.classList.toggle("active", panel.dataset.tabPanel === tabName);
  }
  if (tabName === "team") {
    updateTeamCurrentCard();
    refreshPresence().catch(() => {});
  }
  if (tabName === "inbox" && accessCodeValue()) {
    verifyAccessCode({ quiet: true, refresh: false }).catch(() => {});
    refreshInbox().catch((error) => setInboxStatus(error.message));
  }
  if (tabName === "calls" && accessCodeValue()) {
    verifyAccessCode({ quiet: true, refresh: false }).catch(() => {});
    refreshCallLog().catch((error) => {
      callLogStatus.textContent = error.message;
    });
  }
  if (tabName === "insights" && accessCodeValue()) {
    verifyAccessCode({ quiet: true, refresh: false }).catch(() => {});
    refreshInsights().catch((error) => {
      insightsStatus.textContent = error.message;
    });
  }
}

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
      humanRouting: "Human route numbers",
      persistentStorage: "Persistent storage",
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

if (accessCodeValue()) {
  verifyAccessCode({ quiet: true, refresh: true }).catch(() => {});
  refreshInbox().catch((error) => setInboxStatus(error.message));
  refreshPresence().catch(() => {});
}

function setStatus(message) {
  statusEl.textContent = message;
}

async function loadSettings() {
  isLoadingSettings = true;
  const response = await fetch("/api/settings", { headers: adminHeaders() });
  const settings = await response.json();
  applySettings(settings);
  isLoadingSettings = false;
  hasUnsavedSettings = false;
  setEditMode(editMode);
  previewVoiceButton.disabled = false;
  updateScriptPreview();
  updateSaveControls(
    settings.enabled
      ? `Live. New calls will use ${voiceSelect.selectedOptions[0]?.textContent || voiceSelect.value}.`
      : "Paused. New calls will be logged but the AI will not answer."
  );
}

function applySettings(settings) {
  voiceSelect.innerHTML = "";
  for (const voice of settings.voiceOptions || []) {
    const option = document.createElement("option");
    option.value = voice.id;
    option.textContent = `${voice.label} - ${voice.note}`;
    voiceSelect.append(option);
  }
  enabledToggle.checked = settings.enabled !== false;
  humanRouteModeSelect.value = settings.humanRouting?.mode || "ai_then_humans";
  humanRouteTimeoutInput.value = settings.humanRouting?.timeoutSeconds || 22;
  humanRouteNumbersInput.value = formatHumanRouteNumbers(settings.humanRouting?.numbers || []);
  humanRouteTriggersInput.value = (settings.humanRouting?.transferTriggers || []).join("\n");
  humanRouteCallerMessageInput.value = settings.humanRouting?.callerMessage || "Please hold while I connect you with DDD.";
  humanRouteFallbackMessageInput.value =
    settings.humanRouting?.fallbackMessage ||
    "DDD could not reach the team live, but your call was logged. Please leave a message or text DDD and the team will follow up.";
  updateHumanRouteSummary(settings.humanRouting);
  updateRouteModeCards();
  voiceSelect.value = settings.voice || "marin";
  voiceSpeedInput.value = settings.voiceSpeed || 1;
  voiceSpeedOutput.value = `${Number(voiceSpeedInput.value).toFixed(2)}x`;
  voiceDirectionInput.value = settings.voiceDirection || "";
  noiseModeSelect.value = settings.noiseHandling?.mode || "patient";
  interruptResponseToggle.checked = settings.noiseHandling?.interruptResponse === true;
  noiseNotesInput.value =
    settings.noiseHandling?.notes ||
    "Let the receptionist finish short statements before listening. Ignore tiny background noises, road noise, breathing, and quick filler sounds unless the caller is clearly speaking.";
  greetingInput.value = settings.greeting || "";
  businessKnowledgeInput.value = settings.businessKnowledge || "";
  serviceAreaInput.value = settings.serviceArea || "";
  offeredServicesInput.value = settings.offeredServices || "";
  notOfferedServicesInput.value = settings.notOfferedServices || "";
  directoryReferralToggle.checked = settings.directoryReferral?.enabled === true;
  directoryReferralUrlInput.value = settings.directoryReferral?.url || "";
  directoryReferralMessageInput.value =
    settings.directoryReferral?.message ||
    "DDD may not handle that exact service, but we can text you a referral/directory link for nearby mobile mechanics or shops if you want.";
  pricingNotesInput.value = settings.pricingNotes || "";
  emergencyInstructionsInput.value = settings.emergencyInstructions || "";
  emergencyQuestionsInput.value = (settings.emergencyQuestions || []).join("\n");
  humanHandoffRulesInput.value = settings.humanHandoffRules || "";
  callOutcomeRulesInput.value = settings.callOutcomeRules || "";
  fallbackRulesInput.value = settings.fallbackRules || "";
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
  thinkingPhraseInput.value = settings.soundPreferences?.thinkingPhrase || "One moment while I get that into the request.";
  const backgroundAudio = settings.soundPreferences?.backgroundAudio || {};
  backgroundAudioModeSelect.value = backgroundAudio.enabled ? backgroundAudio.mode || "licensed-music" : "off";
  backgroundAudioLabelInput.value = backgroundAudio.label || "None";
  backgroundAudioUrlInput.value = backgroundAudio.url || "";
  smsFollowUpToggle.checked = settings.smsFollowUp?.enabled !== false;
  smsFollowUpMessageInput.value =
    settings.smsFollowUp?.message ||
    "Thanks for calling DDD. Your request was received: {{link}}. Add photos if needed: {{photoUploadLink}}. iPhone users: open DDD Mobile and log in with this phone number. Non-iPhone users: log in at {{webLoginLink}}. Reply here if anything changes. Reply STOP to stop.";
  reviewFollowUpToggle.checked = settings.reviewFollowUp?.enabled !== false;
  reviewFollowUpUrlInput.value = settings.reviewFollowUp?.url || "https://g.page/r/CfVinSqxHOIDEAE/review";
  reviewFollowUpMessageInput.value =
    settings.reviewFollowUp?.message ||
    "Thanks again for choosing DDD. If everything went well, please leave a quick Google review here: {{reviewLink}}";
  staffAccessCodesInput.value = formatStaffAccessCodes(settings.staffAccessCodes || []);
  renderStaffCodeRows(settings.staffAccessCodes || []);
  qaChecklistInput.value = settings.qaChecklist || "";
  notifyNewCallsToggle.checked = settings.notificationPreferences?.newCalls !== false;
  notifyMissedCallsToggle.checked = settings.notificationPreferences?.missedCalls !== false;
  notifyBookingsToggle.checked = settings.notificationPreferences?.bookings !== false;
  notifyTextsToggle.checked = settings.notificationPreferences?.texts !== false;
  notifyQaIssuesToggle.checked = settings.notificationPreferences?.qaIssues !== false;
  notifyDailySummaryToggle.checked = settings.notificationPreferences?.dailySummary !== false;
  notifyWeeklySummaryToggle.checked = settings.notificationPreferences?.weeklySummary !== false;
  notifyMonthlySummaryToggle.checked = settings.notificationPreferences?.monthlySummary !== false;
  insightLearningToggle.checked = settings.insightLearning?.enabled !== false;
  learnTopServicesToggle.checked = settings.insightLearning?.useTopServices !== false;
  learnTopLocationsToggle.checked = settings.insightLearning?.useTopLocations !== false;
  learnQaIssuesToggle.checked = settings.insightLearning?.useQaIssues !== false;
  learnSpeedToggle.checked = settings.insightLearning?.useSpeedSuggestions !== false;
  customInstructionsInput.value = settings.customInstructions || "";
}

editSettingsButton.addEventListener("click", async () => {
  if (!editMode) {
    setEditMode(true);
    updateSaveControls("Settings unlocked. Changes autosave after you pause.");
    return;
  }
  if (hasUnsavedSettings) {
    try {
      await saveSettings("manual");
    } catch {
      return;
    }
  }
  setEditMode(false);
});

saveSettingsButton.addEventListener("click", () => {
  saveSettings("manual").catch(() => {});
});

async function saveSettings(reason = "auto") {
  if (isSavingSettings) return;
  clearTimeout(saveTimer);
  syncStaffCodesFromRows();
  if (hasIncompleteStaffCodeRows()) {
    hasUnsavedSettings = true;
    updateSaveControls("Finish each tech name and code before saving Team changes.");
    if (reason === "manual") throw new Error("Finish each tech name and code before saving Team changes.");
    return;
  }
  isSavingSettings = true;
  voiceSelect.disabled = true;
  updateSaveControls(reason === "auto" ? "Autosaving..." : "Saving receptionist settings...");
  try {
    const response = await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...adminHeaders() },
      body: JSON.stringify({
        enabled: enabledToggle.checked,
        humanRouting: {
          mode: humanRouteModeSelect.value,
          timeoutSeconds: humanRouteTimeoutInput.value,
          numbers: parseHumanRouteNumbersInput(humanRouteNumbersInput.value),
          callerMessage: humanRouteCallerMessageInput.value,
          fallbackMessage: humanRouteFallbackMessageInput.value,
          transferTriggers: humanRouteTriggersInput.value
        },
        voice: voiceSelect.value,
        voiceSpeed: voiceSpeedInput.value,
        voiceDirection: voiceDirectionInput.value,
        noiseHandling: {
          mode: noiseModeSelect.value,
          eagerness: noiseModeSelect.value === "fast" ? "medium" : "low",
          interruptResponse: interruptResponseToggle.checked,
          notes: noiseNotesInput.value
        },
        greeting: greetingInput.value,
        businessKnowledge: businessKnowledgeInput.value,
        serviceArea: serviceAreaInput.value,
        offeredServices: offeredServicesInput.value,
        notOfferedServices: notOfferedServicesInput.value,
        directoryReferral: {
          enabled: directoryReferralToggle.checked,
          url: directoryReferralUrlInput.value,
          message: directoryReferralMessageInput.value
        },
        pricingNotes: pricingNotesInput.value,
        emergencyInstructions: emergencyInstructionsInput.value,
        emergencyQuestions: emergencyQuestionsInput.value,
        humanHandoffRules: humanHandoffRulesInput.value,
        callOutcomeRules: callOutcomeRulesInput.value,
        fallbackRules: fallbackRulesInput.value,
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
          thinkingSound: thinkingSoundToggle.checked,
          thinkingPhrase: thinkingPhraseInput.value,
          backgroundAudio: {
            enabled: backgroundAudioModeSelect.value !== "off",
            mode: backgroundAudioModeSelect.value,
            label: backgroundAudioLabelInput.value,
            url: backgroundAudioUrlInput.value
          }
        },
        smsFollowUp: {
          enabled: smsFollowUpToggle.checked,
          message: smsFollowUpMessageInput.value
        },
        reviewFollowUp: {
          enabled: reviewFollowUpToggle.checked,
          url: reviewFollowUpUrlInput.value,
          message: reviewFollowUpMessageInput.value
        },
        staffAccessCodes: parseStaffAccessCodesInput(staffAccessCodesInput.value),
        notificationPreferences: {
          newCalls: notifyNewCallsToggle.checked,
          missedCalls: notifyMissedCallsToggle.checked,
          bookings: notifyBookingsToggle.checked,
          texts: notifyTextsToggle.checked,
          qaIssues: notifyQaIssuesToggle.checked,
          dailySummary: notifyDailySummaryToggle.checked,
          weeklySummary: notifyWeeklySummaryToggle.checked,
          monthlySummary: notifyMonthlySummaryToggle.checked
        },
        insightLearning: {
          enabled: insightLearningToggle.checked,
          useTopServices: learnTopServicesToggle.checked,
          useTopLocations: learnTopLocationsToggle.checked,
          useQaIssues: learnQaIssuesToggle.checked,
          useSpeedSuggestions: learnSpeedToggle.checked
        },
        qaChecklist: qaChecklistInput.value,
        customInstructions: customInstructionsInput.value
      })
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(response.status === 403 ? "Enter the real admin access code before saving settings." : error.error || "Could not save receptionist settings.");
    }
    const savedSettings = await response.json();
    isLoadingSettings = true;
    applySettings(savedSettings);
    isLoadingSettings = false;
    hasUnsavedSettings = false;
    refreshPresence().catch(() => {});
    updateScriptPreview();
    updateSaveControls(
      enabledToggle.checked
        ? `${reason === "auto" ? "Autosaved" : "Saved"}. New calls will use ${voiceSelect.selectedOptions[0]?.textContent || voiceSelect.value}.`
        : `${reason === "auto" ? "Autosaved" : "Saved"}. The AI receptionist is paused.`
    );
  } catch (error) {
    updateSaveControls(error.message);
    previewVoiceButton.disabled = false;
    throw error;
  } finally {
    isSavingSettings = false;
    setEditMode(editMode);
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
        text: greetingInput.value || "Thank you for calling Triple D Roadside. How can I help today?"
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
  humanRouteModeSelect,
  humanRouteTimeoutInput,
  humanRouteNumbersInput,
  humanRouteTriggersInput,
  humanRouteCallerMessageInput,
  humanRouteFallbackMessageInput,
  voiceSelect,
  voiceSpeedInput,
  voiceDirectionInput,
  noiseModeSelect,
  interruptResponseToggle,
  noiseNotesInput,
  greetingInput,
  businessKnowledgeInput,
  serviceAreaInput,
  offeredServicesInput,
  notOfferedServicesInput,
  directoryReferralToggle,
  directoryReferralUrlInput,
  directoryReferralMessageInput,
  pricingNotesInput,
  emergencyInstructionsInput,
  emergencyQuestionsInput,
  humanHandoffRulesInput,
  callOutcomeRulesInput,
  fallbackRulesInput,
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
  thinkingPhraseInput,
  backgroundAudioModeSelect,
  backgroundAudioLabelInput,
  backgroundAudioUrlInput,
  smsFollowUpToggle,
  smsFollowUpMessageInput,
  reviewFollowUpToggle,
  reviewFollowUpUrlInput,
  reviewFollowUpMessageInput,
  notifyNewCallsToggle,
  notifyMissedCallsToggle,
  notifyBookingsToggle,
  notifyTextsToggle,
  notifyQaIssuesToggle,
  notifyDailySummaryToggle,
  notifyWeeklySummaryToggle,
  notifyMonthlySummaryToggle,
  insightLearningToggle,
  learnTopServicesToggle,
  learnTopLocationsToggle,
  learnQaIssuesToggle,
  learnSpeedToggle,
  staffAccessCodesInput,
  qaChecklistInput,
  customInstructionsInput
]) {
  input.addEventListener("input", handleSettingsChange);
  input.addEventListener("change", handleSettingsChange);
}

voiceSpeedInput.addEventListener("input", () => {
  voiceSpeedOutput.value = `${Number(voiceSpeedInput.value).toFixed(2)}x`;
});

function handleSettingsChange() {
  updateHumanRouteSummary();
  updateRouteModeCards();
  updateScriptPreview();
  if (!editMode || isLoadingSettings) return;
  hasUnsavedSettings = true;
  clearTimeout(saveTimer);
  updateSaveControls("Unsaved changes. Autosaving soon...");
  saveTimer = setTimeout(() => {
    saveSettings("auto").catch(() => {});
  }, 900);
}

function handleStaffCodesChange() {
  syncStaffCodesFromRows();
  updateScriptPreview();
  if (!editMode || isLoadingSettings) return;
  hasUnsavedSettings = true;
  clearTimeout(saveTimer);
  if (hasIncompleteStaffCodeRows()) {
    updateSaveControls("Finish the tech name and code, then Save changes.");
    return;
  }
  updateSaveControls("Team codes changed. Autosaving soon...");
  saveTimer = setTimeout(() => {
    saveSettings("auto").catch(() => {});
  }, 1100);
}

function setEditMode(nextEditMode) {
  editMode = nextEditMode;
  editSettingsButton.textContent = editMode ? "Lock settings" : "Edit settings";
  for (const input of [
    enabledToggle,
    humanRouteModeSelect,
    humanRouteTimeoutInput,
    humanRouteNumbersInput,
    humanRouteTriggersInput,
    humanRouteCallerMessageInput,
    humanRouteFallbackMessageInput,
    voiceSelect,
    voiceSpeedInput,
    voiceDirectionInput,
    noiseModeSelect,
    interruptResponseToggle,
    noiseNotesInput,
    greetingInput,
    businessKnowledgeInput,
    serviceAreaInput,
    offeredServicesInput,
    notOfferedServicesInput,
    directoryReferralToggle,
    directoryReferralUrlInput,
    directoryReferralMessageInput,
    pricingNotesInput,
    emergencyInstructionsInput,
    emergencyQuestionsInput,
    humanHandoffRulesInput,
    callOutcomeRulesInput,
    fallbackRulesInput,
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
    thinkingPhraseInput,
    backgroundAudioModeSelect,
    backgroundAudioLabelInput,
    backgroundAudioUrlInput,
    smsFollowUpToggle,
    smsFollowUpMessageInput,
    reviewFollowUpToggle,
    reviewFollowUpUrlInput,
    reviewFollowUpMessageInput,
    notifyNewCallsToggle,
    notifyMissedCallsToggle,
    notifyBookingsToggle,
    notifyTextsToggle,
    notifyQaIssuesToggle,
    notifyDailySummaryToggle,
    notifyWeeklySummaryToggle,
    notifyMonthlySummaryToggle,
    insightLearningToggle,
    learnTopServicesToggle,
    learnTopLocationsToggle,
    learnQaIssuesToggle,
    learnSpeedToggle,
    staffAccessCodesInput,
    qaChecklistInput,
    customInstructionsInput
  ]) {
    setSettingsControlLock(input, !editMode || isSavingSettings);
  }
  for (const control of staffCodeRows?.querySelectorAll("input,button") || []) {
    setSettingsControlLock(control, !editMode || isSavingSettings);
  }
  if (addStaffCodeButton) setSettingsControlLock(addStaffCodeButton, !editMode || isSavingSettings);
  for (const button of routeModeButtons) {
    button.disabled = !editMode || isSavingSettings;
  }
  updateSaveControls();
  previewVoiceButton.disabled = false;
  document.body.classList.toggle("edit-mode", editMode);
  if (!editMode) {
    clearTimeout(saveTimer);
    hasUnsavedSettings = false;
    updateSaveControls("Settings locked. Tap Edit settings before changing anything.");
  }
}

function setSettingsControlLock(input, locked) {
  const canBeReadOnly = input.matches("textarea,input") && !["checkbox", "range"].includes(input.type);
  if (canBeReadOnly) {
    input.readOnly = locked;
    input.disabled = false;
    input.classList.toggle("locked-field", locked);
    return;
  }
  input.readOnly = false;
  input.disabled = locked;
  input.classList.toggle("locked-field", locked);
}

function updateSaveControls(message = "") {
  saveSettingsButton.disabled = !editMode || !hasUnsavedSettings || isSavingSettings;
  saveSettingsButton.textContent = isSavingSettings ? "Saving..." : hasUnsavedSettings ? "Save changes" : "Saved";
  if (message) settingsStatus.textContent = message;
}

testScriptButton.addEventListener("click", async () => {
  await runFreeTest(testCallerInput.value);
});

for (const button of testScenarioButtons) {
  button.addEventListener("click", async () => {
    testCallerInput.value = button.dataset.testScenario || "";
    await runFreeTest(testCallerInput.value);
  });
}

for (const button of routeModeButtons) {
  button.addEventListener("click", () => {
    if (!editMode || isSavingSettings) return;
    humanRouteModeSelect.value = button.dataset.routeMode || "ai_then_humans";
    if (humanRouteModeSelect.value === "humans") {
      enabledToggle.checked = false;
    } else if (!enabledToggle.checked) {
      enabledToggle.checked = true;
    }
    handleSettingsChange();
  });
}

outboundStaffPhoneInput?.addEventListener("input", () => {
  localStorage.setItem("dddOutboundStaffPhone", outboundStaffPhoneInput.value.trim());
});

outboundCallerIdSelect?.addEventListener("change", () => {
  localStorage.setItem("dddOutboundCallerId", outboundCallerIdSelect.value);
});

outboundCallButton?.addEventListener("click", async () => {
  outboundCallButton.disabled = true;
  outboundCallStatus.textContent = "Starting callback bridge...";
  try {
    const response = await fetch("/api/calls/outbound", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...staffHeaders() },
      body: JSON.stringify({
        staffPhone: outboundStaffPhoneInput.value,
        to: outboundCustomerPhoneInput.value,
        callerId: outboundCallerIdSelect.value
      })
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload.ok) {
      throw new Error(payload.error || payload.delivery?.error || "Could not start the callback call.");
    }
    outboundCallStatus.textContent = `Calling ${formatPhone(outboundStaffPhoneInput.value)} first, then ${formatPhone(outboundCustomerPhoneInput.value)}.`;
  } catch (error) {
    outboundCallStatus.textContent = error.message;
  } finally {
    outboundCallButton.disabled = false;
  }
});

async function runFreeTest(callerMessage) {
  testScriptButton.disabled = true;
  for (const button of testScenarioButtons) button.disabled = true;
  testScriptOutput.value = "Testing...";
  try {
    const response = await fetch("/api/test-script/score", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ callerMessage: testCallerInput.value })
    });
    if (!response.ok) throw new Error("Could not run the free test.");
    const result = await response.json();
    const dryRun = result.dryRun || result;
    const score = result.score;
    testScriptOutput.value = [
      score ? `Score: ${score.percent}% - ${score.verdict} (${score.passed}/${score.total})` : "",
      score?.checks?.length ? `Checks:\n- ${score.checks.map((check) => `${check.ok ? "PASS" : "FIX"} ${check.label}`).join("\n- ")}` : "",
      "",
      `Intent: ${dryRun.intent}`,
      dryRun.bestNextLink ? `Best next link: ${dryRun.bestNextLink}` : dryRun.destination ? `Best next link: ${dryRun.destination.label} - ${dryRun.destination.url}` : "Best next link: none selected",
      dryRun.smsFollowUp ? `SMS follow-up: ${dryRun.smsFollowUp}` : "",
      "",
      dryRun.firstResponse ? `First response:\n${dryRun.firstResponse}` : "",
      "",
      dryRun.questions?.length ? `Next questions, one at a time:\n- ${dryRun.questions.join("\n- ")}` : "",
      "",
      dryRun.action ? `Action:\n${dryRun.action}` : "",
      "",
      dryRun.insightLearning ? `Insight learning:\n${dryRun.insightLearning}` : "",
      "",
      dryRun.qaChecklist?.length ? `QA checklist:\n- ${dryRun.qaChecklist.join("\n- ")}` : "",
      "",
      dryRun.note
    ].join("\n");
  } catch (error) {
    testScriptOutput.value = error.message;
  } finally {
    testScriptButton.disabled = false;
    for (const button of testScenarioButtons) button.disabled = false;
  }
}

function updateScriptPreview() {
  scriptPreview.value = [
    enabledToggle.checked ? "Status: AI answers new calls." : "Status: AI is paused.",
    `Voice: ${voiceSelect.selectedOptions[0]?.textContent || voiceSelect.value || "Marin"}`,
    `Speed: ${Number(voiceSpeedInput.value || 1).toFixed(2)}x`,
    `Voice direction: ${voiceDirectionInput.value || "Warm, confident, friendly receptionist."}`,
    `Noise handling: ${noiseModeSelect.selectedOptions[0]?.textContent || "Patient - best for noisy roadside calls"}. Interruptions ${interruptResponseToggle.checked ? "allowed" : "off"}.`,
    `Noise notes: ${noiseNotesInput.value || "Ignore tiny background noises and wait until the caller finishes."}`,
    `Greeting: ${greetingInput.value || "Thank you for calling Triple D Roadside, this is the receptionist. How can I help today?"}`,
    `Call route mode: ${humanRouteModeSelect.selectedOptions[0]?.textContent || humanRouteModeSelect.value}. Timeout ${humanRouteTimeoutInput.value || 22}s.`,
    `Human route numbers: ${parseHumanRouteNumbersInput(humanRouteNumbersInput.value).map((entry) => `${entry.label} ${entry.phone}`).join(", ") || "none set"}`,
    `Human route triggers: ${humanRouteTriggersInput.value || "Caller asks for a person, urgent incomplete call, AI cannot hear, complaint/escalation, or AI paused."}`,
    "",
    "Business knowledge:",
    businessKnowledgeInput.value || "Add DDD services, prices, service areas, hours, policies, and answers here.",
    "",
    `Service area: ${serviceAreaInput.value || "Greater Cincinnati and nearby service areas."}`,
    `Services offered: ${offeredServicesInput.value || "Roadside assistance, mobile auto service, app help, Auto Doc, and apply-to-work questions."}`,
    `Do not promise: ${notOfferedServicesInput.value || "No exact pricing, exact arrival times, or services DDD has not confirmed."}`,
    `Referral directory: ${directoryReferralToggle.checked ? "on" : "off"}. ${directoryReferralUrlInput.value || "No URL set."} ${directoryReferralMessageInput.value || ""}`.trim(),
    `Pricing rules: ${pricingNotesInput.value || "Do not quote exact pricing unless added here."}`,
    `Emergency handling: ${emergencyInstructionsInput.value || "Confirm safety, location, vehicle, callback number, and urgent link."}`,
    "Emergency questions:",
    emergencyQuestionsInput.value || "Are you in a safe place right now?\nWhat is your exact location?\nWhat vehicle are you with?\nWhat happened?\nWhat is the best callback number?",
    `Human handoff: ${humanHandoffRulesInput.value || "Save details; do not promise a live transfer."}`,
    `Outcome rules: ${callOutcomeRulesInput.value || "End every call with a clear outcome."}`,
    `Fallback rules: ${fallbackRulesInput.value || "Save missed/fallback leads when calls fail or details are incomplete."}`,
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
    `Sound: ${ambientSoundSelect.value || "none"}; thinking bridge ${thinkingSoundToggle.checked ? thinkingPhraseInput.value || "on" : "off"}; background audio ${backgroundAudioModeSelect.value}.`,
    `Notifications: calls ${notifyNewCallsToggle.checked ? "on" : "off"}, missed ${notifyMissedCallsToggle.checked ? "on" : "off"}, bookings ${notifyBookingsToggle.checked ? "on" : "off"}, texts ${notifyTextsToggle.checked ? "on" : "off"}, QA ${notifyQaIssuesToggle.checked ? "on" : "off"}, summaries ${notifyDailySummaryToggle.checked ? "daily " : ""}${notifyWeeklySummaryToggle.checked ? "weekly " : ""}${notifyMonthlySummaryToggle.checked ? "monthly" : ""}`.trim(),
    `Insight learning: ${insightLearningToggle.checked ? "on" : "off"}; services ${learnTopServicesToggle.checked ? "on" : "off"}, locations ${learnTopLocationsToggle.checked ? "on" : "off"}, QA ${learnQaIssuesToggle.checked ? "on" : "off"}, speed ${learnSpeedToggle.checked ? "on" : "off"}.`,
    `SMS follow-up: ${smsFollowUpToggle.checked ? "on" : "off"}. ${smsFollowUpMessageInput.value || "Text the best DDD link after permission."}`,
    `Google review follow-up: ${reviewFollowUpToggle.checked ? "on" : "off"}. ${reviewFollowUpMessageInput.value || "Ask for a Google review after completed jobs."} ${reviewFollowUpUrlInput.value || ""}`.trim(),
    "",
    "Behavior:",
    customInstructionsInput.value || "Tell the receptionist exactly how to handle callers.",
    "",
    "QA checklist:",
    qaChecklistInput.value || "Confirm answer, intake, correct link, saved lead/booking, SMS consent, transcript, recording, and clear next step."
  ].join("\n");
}

async function refreshQaDashboard() {
  if (!qaChecksList || !qaIssuesList || !qaStatus) return;
  qaStatus.textContent = "Loading QA...";
  const response = await fetch("/api/qa-dashboard", { headers: adminHeaders() });
  if (response.status === 403) {
    qaChecksList.innerHTML = `<p class="empty-state">Enter the real admin access code at the top to load checks.</p>`;
    qaIssuesList.innerHTML = `<p class="empty-state">Enter the real admin access code at the top to load issues.</p>`;
    qaStatus.textContent = "Admin access is needed for QA.";
    return;
  }
  if (!response.ok) throw new Error("Could not load QA dashboard.");
  const payload = await response.json();
  qaChecksList.innerHTML = (payload.checks || [])
    .map(
      (check) => `
        <div class="qa-row ${check.ok ? "ok" : "warn"}">
          <strong>${escapeHtml(check.label)}</strong>
          <span>${escapeHtml(check.ok ? "OK" : "Needs review")}</span>
          <p>${escapeHtml(check.detail || "")}</p>
        </div>
      `
    )
    .join("");
  qaIssuesList.innerHTML = payload.recentIssues?.length
    ? payload.recentIssues
        .map(
          (issue) => `
            <div class="qa-row warn">
              <strong>${escapeHtml(issue.type || "issue")}</strong>
              <span>${escapeHtml(formatTime(issue.at) || "")}</span>
              <p>${escapeHtml(issue.message || "")}</p>
            </div>
          `
        )
        .join("")
    : `<p class="empty-state">No recent issues found.</p>`;
  if (!qaChecklistInput.value && payload.qaChecklist) qaChecklistInput.value = payload.qaChecklist;
  qaStatus.textContent = payload.ok ? "QA looks clean." : "Some QA items need review.";
}

async function refreshInsights() {
  if (!insightHighlights || !insightSuggestionsList || !insightsStatus) return;
  insightsStatus.textContent = "Loading insights...";
  const response = await fetch("/api/insights", { headers: adminHeaders() });
  if (response.status === 403) {
    insightHighlights.innerHTML = "";
    if (insightFocusStrip) insightFocusStrip.innerHTML = "";
    if (learningPreview) learningPreview.innerHTML = "";
    insightSuggestionsList.innerHTML = `<p class="empty-state">Enter the real admin access code at the top to load daily, weekly, and monthly insights.</p>`;
    for (const card of Object.values(insightCards)) {
      if (card) card.innerHTML = "";
    }
    insightsStatus.textContent = "Admin access is needed for insights.";
    return;
  }
  if (!response.ok) throw new Error("Could not load insights.");
  const payload = await response.json();
  const sections = payload.sections || {};
  const daily = sections.daily || {};
  const weekly = sections.weekly || {};
  const monthly = sections.monthly || {};
  insightHighlights.innerHTML = "";
  if (insightFocusStrip) {
    insightFocusStrip.innerHTML = renderInsightFocusStrip(daily, weekly, monthly);
  }
  renderLearningPreview(payload);
  insightSuggestionsList.innerHTML = renderInsightSuggestions(payload.suggestions || []);
  renderInsightCard("daily", payload.sections?.daily);
  renderInsightCard("weekly", payload.sections?.weekly);
  renderInsightCard("monthly", payload.sections?.monthly);
  insightsStatus.textContent = `Insights updated ${formatTime(payload.generatedAt)}.`;
}

function renderLearningPreview(payload = {}) {
  if (!learningPreview) return;
  const weekly = payload.sections?.weekly || {};
  const daily = payload.sections?.daily || {};
  const notes = [];
  if (!insightLearningToggle.checked) {
    learningPreview.innerHTML = `<p>Insight learning is off. The receptionist will only follow the saved admin script.</p>`;
    return;
  }
  const topService = weekly.topServices?.[0]?.label;
  const topLocation = weekly.topLocations?.[0]?.label;
  const followUps = Number(daily.missed || 0) + Number(daily.needsReview || 0);
  if (learnTopServicesToggle.checked && topService) notes.push(`Prioritize faster intake for ${topService}.`);
  if (learnTopLocationsToggle.checked && topLocation) notes.push(`Expect more callers around ${topLocation}, while still collecting exact location.`);
  if (learnQaIssuesToggle.checked && followUps) notes.push(`Be stricter about callback, service, location, and next step because ${followUps} call${followUps === 1 ? "" : "s"} need follow-up today.`);
  if (learnSpeedToggle.checked && Number(weekly.averageDurationSeconds || 0) > 150) notes.push("Shorten responses because average calls are running long.");
  if (!notes.length) notes.push("No strong learning pattern yet. The receptionist will keep following the main admin script.");
  learningPreview.innerHTML = notes.map((note) => `<p>${escapeHtml(note)}</p>`).join("");
}

function renderInsightCard(key, report) {
  const card = insightCards[key];
  if (!card || !report) return;
  card.innerHTML = `
    <div class="insight-card-header">
      <div>
        <p class="eyebrow">${escapeHtml(report.label)}</p>
        <h3>${escapeHtml(formatDateRange(report.start, report.end))}</h3>
      </div>
      <span>${escapeHtml(report.calls)} call${report.calls === 1 ? "" : "s"}</span>
    </div>
    <div class="insight-mini-grid">
      ${renderInsightMetric("Calls", report.calls, report.changes?.calls)}
      ${renderInsightMetric("Bookings", report.bookings, report.changes?.bookings)}
      ${renderInsightMetric("Follow-up", (report.missed || 0) + (report.needsReview || 0), report.changes?.missed)}
      ${renderInsightMetric("Conversion", formatPercent(report.bookingRate))}
      ${renderInsightMetric("Avg time", formatDuration(report.averageDurationSeconds) || "0s", report.changes?.averageDurationSeconds)}
      ${renderInsightMetric("SMS coverage", formatPercent(report.smsCoverageRate))}
    </div>
    <div class="insight-columns">
      ${renderTopList("Top services", report.topServices)}
      ${renderTopList("Top locations", report.topLocations)}
      ${renderTopList("Caller types", report.callerTypes)}
    </div>
    <div class="insight-change-box">
      <strong>What changed</strong>
      ${(report.changed || []).map((change) => `<p>${escapeHtml(change)}</p>`).join("")}
    </div>
    <div class="insight-change-box action-box">
      <strong>What to watch</strong>
      ${renderInsightWatchList(report)}
    </div>
    ${key === "daily" ? `
      <div class="recent-call-strip">
        <strong>Today's calls</strong>
        ${renderRecentInsightCalls(report.recentCalls)}
      </div>
    ` : ""}
  `;
}

function renderInsightFocusStrip(daily = {}, weekly = {}, monthly = {}) {
  const topService = weekly.topServices?.[0]?.label || monthly.topServices?.[0]?.label || "No clear service yet";
  const topLocation = weekly.topLocations?.[0]?.label || monthly.topLocations?.[0]?.label || "No clear location yet";
  const riskCount = (daily.missed || 0) + (daily.needsReview || 0);
  const trend = weekly.calls > weekly.previous?.calls
    ? "Call volume is moving up."
    : weekly.calls < weekly.previous?.calls
      ? "Call volume is lighter than last week."
      : "Call volume is steady.";
  return `
    <div class="focus-card priority-${riskCount ? "high" : "normal"}">
      <span>Priority</span>
      <strong>${escapeHtml(riskCount ? `${riskCount} call${riskCount === 1 ? "" : "s"} need attention` : "No urgent cleanup")}</strong>
      <p>${escapeHtml(riskCount ? "Open Calls/Inbox and text these callers first." : "Keep monitoring completion and SMS delivery.")}</p>
    </div>
    <div class="focus-card">
      <span>Demand</span>
      <strong>${escapeHtml(topService)}</strong>
      <p>${escapeHtml(`${trend} Keep this intake path short.`)}</p>
    </div>
    <div class="focus-card">
      <span>Area</span>
      <strong>${escapeHtml(topLocation)}</strong>
      <p>Use this to spot where calls are clustering.</p>
    </div>
  `;
}

function renderInsightSuggestions(suggestions = []) {
  if (!suggestions.length) return `<p class="empty-state">No suggested changes yet.</p>`;
  return suggestions
    .slice(0, 5)
    .map(
      (suggestion, index) => `
        <div class="suggestion-row">
          <span>${index + 1}</span>
          <p>${escapeHtml(suggestion)}</p>
        </div>
      `
    )
    .join("");
}

function renderInsightWatchList(report = {}) {
  const items = [];
  if ((report.missed || 0) > 0) items.push(`${report.missed} missed/incomplete call${report.missed === 1 ? "" : "s"}.`);
  if ((report.needsReview || 0) > 0) items.push(`${report.needsReview} call${report.needsReview === 1 ? "" : "s"} need QA review.`);
  if ((report.calls || 0) > 0 && (report.smsCoverageRate || 0) < 80) items.push("SMS coverage is under 80%.");
  if ((report.averageDurationSeconds || 0) > 150) items.push("Calls are getting long; shorten the script.");
  if (!items.length) items.push("No obvious problem in this period.");
  return items.map((item) => `<p>${escapeHtml(item)}</p>`).join("");
}

function renderInsightMetric(label, value, change) {
  return `
    <div class="insight-metric">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
      ${change ? `<small>${escapeHtml(formatInsightChange(change))}</small>` : ""}
    </div>
  `;
}

function formatPercent(value) {
  const number = Number(value || 0);
  return `${Math.round(number)}%`;
}

function renderTopList(title, items = []) {
  return `
    <div class="insight-top-list">
      <strong>${escapeHtml(title)}</strong>
      ${
        items.length
          ? items.map((item) => `<p><span>${escapeHtml(item.label)}</span><b>${escapeHtml(item.count)}</b></p>`).join("")
          : `<p class="empty-state">Not enough data yet.</p>`
      }
    </div>
  `;
}

function renderRecentInsightCalls(calls = []) {
  if (!calls.length) return `<p class="empty-state">No calls in this period yet.</p>`;
  return calls
    .map(
      (call) => `
        <div class="insight-call">
          <strong>${escapeHtml(formatPhone(call.caller) || "Unknown caller")}</strong>
          <span>${escapeHtml([call.outcome, call.service, call.location, call.durationLabel, call.smsStatus ? `SMS ${call.smsStatus}` : ""].filter(Boolean).join(" · "))}</span>
          <small>${escapeHtml(formatTime(call.at))}</small>
        </div>
      `
    )
    .join("");
}

function formatInsightChange(change = {}) {
  const difference = Number(change.difference || 0);
  if (!difference) return "No change";
  const sign = difference > 0 ? "+" : "-";
  const percent = Math.abs(Number(change.percent || 0));
  return `${sign}${Math.abs(difference)}${percent ? ` (${sign}${percent}%)` : ""}`;
}

function formatDateRange(start, end) {
  if (!start || !end) return "Current period";
  const options = { month: "short", day: "numeric" };
  const startLabel = new Intl.DateTimeFormat(undefined, options).format(new Date(start));
  const endLabel = new Intl.DateTimeFormat(undefined, options).format(new Date(end));
  return startLabel === endLabel ? startLabel : `${startLabel} - ${endLabel}`;
}

function formatBookingDestinations(destinations) {
  return destinations
    .map((destination) => `${destination.label || ""} | ${destination.url || ""} | ${destination.useWhen || ""}`)
    .join("\n");
}

function formatHumanRouteNumbers(numbers = []) {
  return numbers.map((entry) => `${entry.label || "Route"} | ${entry.phone || ""}`).join("\n");
}

function parseHumanRouteNumbersInput(value) {
  return String(value || "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => {
      const [label, ...phoneParts] = line.includes("|") ? line.split("|") : [`Route ${index + 1}`, line];
      return {
        label: label.trim() || `Route ${index + 1}`,
        phone: normalizePhoneForRoute(phoneParts.join("|"))
      };
    })
    .filter((entry) => entry.phone)
    .slice(0, 8);
}

function normalizePhoneForRoute(value) {
  const digits = String(value || "").replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return "";
}

function updateHumanRouteSummary(route = {}) {
  const mode = route?.mode || humanRouteModeSelect?.value || "ai_then_humans";
  const numbers = route?.numbers || parseHumanRouteNumbersInput(humanRouteNumbersInput?.value || "");
  const count = numbers.length;
  const labels = {
    ai_then_humans: "AI first, humans if needed",
    ai: "AI only",
    humans: "Ring humans only"
  };
  if (humanRouteSummary) {
    const routeText =
      count > 0
        ? `${count} team number${count === 1 ? "" : "s"} ready`
        : "add team numbers in Call Handling first";
    humanRouteSummary.textContent = `${labels[mode] || labels.ai_then_humans} - ${routeText}`;
  }
  if (humanRouteCount) {
    humanRouteCount.textContent = `${count} number${count === 1 ? "" : "s"}`;
  }
}

function updateRouteModeCards() {
  const mode = humanRouteModeSelect?.value || "ai_then_humans";
  for (const button of routeModeButtons) {
    button.classList.toggle("active", button.dataset.routeMode === mode);
  }
  if (enabledToggle && humanRouteModeSelect) {
    const aiIsOn = enabledToggle.checked && humanRouteModeSelect.value !== "humans";
    enabledToggle.closest(".power-switch")?.classList.toggle("is-paused", !aiIsOn);
  }
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

function formatStaffAccessCodes(codes) {
  return (codes || [])
    .map((entry) => `${entry.name || ""} | ${entry.code || ""}`)
    .filter(Boolean)
    .join("\n");
}

function syncStaffCodesFromRows() {
  if (!staffCodeRows || !staffAccessCodesInput) return;
  const rows = [...staffCodeRows.querySelectorAll(".staff-code-row")];
  staffAccessCodesInput.value = rows
    .map((row) => {
      const name = row.querySelector("[data-staff-name]")?.value.trim() || "";
      const code = row.querySelector("[data-staff-code]")?.value.replace(/\s+/g, "") || "";
      return name && code ? `${name} | ${code}` : "";
    })
    .filter(Boolean)
    .join("\n");
}

function hasIncompleteStaffCodeRows() {
  if (!staffCodeRows) return false;
  return [...staffCodeRows.querySelectorAll(".staff-code-row")].some((row) => {
    const name = row.querySelector("[data-staff-name]")?.value.trim() || "";
    const code = row.querySelector("[data-staff-code]")?.value.replace(/\s+/g, "") || "";
    return Boolean(name || code) && !(name && code);
  });
}

function renderStaffCodeRows(codes = []) {
  if (!staffCodeRows) return;
  staffCodeRows.innerHTML = "";
  const rows = codes.length ? codes : [{ name: "", code: "" }];
  rows.forEach((entry) => appendStaffCodeRow(entry));
  syncStaffCodesFromRows();
}

function appendStaffCodeRow(entry = {}) {
  if (!staffCodeRows) return;
  const row = document.createElement("div");
  row.className = "staff-code-row";

  const nameLabel = document.createElement("label");
  const nameText = document.createElement("span");
  const nameInput = document.createElement("input");
  nameText.textContent = "Name";
  nameInput.dataset.staffName = "true";
  nameInput.type = "text";
  nameInput.autocomplete = "off";
  nameInput.placeholder = "Tech name";
  nameInput.value = entry.name || "";
  nameLabel.append(nameText, nameInput);

  const codeLabel = document.createElement("label");
  const codeText = document.createElement("span");
  const codeInput = document.createElement("input");
  codeText.textContent = "Code";
  codeInput.dataset.staffCode = "true";
  codeInput.type = "text";
  codeInput.inputMode = "numeric";
  codeInput.autocomplete = "off";
  codeInput.placeholder = "4-6 digits";
  codeInput.value = entry.code || "";
  codeLabel.append(codeText, codeInput);

  const removeButton = document.createElement("button");
  removeButton.type = "button";
  removeButton.dataset.removeStaffCode = "true";
  removeButton.textContent = "Remove";
  removeButton.addEventListener("click", () => {
    row.remove();
    if (!staffCodeRows.querySelector(".staff-code-row")) appendStaffCodeRow();
    handleStaffCodesChange();
  });

  row.append(nameLabel, codeLabel, removeButton);
  staffCodeRows.append(row);
  for (const input of [nameInput, codeInput]) {
    setSettingsControlLock(input, !editMode || isSavingSettings);
    input.addEventListener("input", () => {
      handleStaffCodesChange();
    });
    input.addEventListener("change", () => {
      handleStaffCodesChange();
    });
  }
  setSettingsControlLock(removeButton, !editMode || isSavingSettings);
}

function parseStaffAccessCodesInput(value) {
  return String(value || "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [name = "", ...codeParts] = (line.includes("|") ? line.split("|") : line.split(":")).map((part) => part.trim());
      return {
        name,
        code: codeParts.join("|").replace(/\s+/g, "")
      };
    })
    .filter((entry) => entry.name && entry.code);
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
  const pin = accessCodeValue();
  return pin ? { "x-admin-pin": pin } : {};
}

function staffHeaders() {
  const code = accessCodeValue();
  return code ? { "x-staff-code": code } : {};
}

function accessCodeValue() {
  return (adminPinInput.value || staffPinInput.value || "").trim();
}

function saveAccessCode() {
  const code = accessCodeValue();
  localStorage.setItem("dddAccessCode", code);
  localStorage.setItem("dddAdminPin", code);
  localStorage.setItem("dddStaffCode", code);
  if (signedInStaff?.ok && verifiedAccessCode && verifiedAccessCode !== code) {
    signedInStaff = null;
    verifiedAccessCode = "";
  }
  updateTeamCurrentCard();
}

function pushAuthHeaders() {
  return {
    ...adminHeaders(),
    ...staffHeaders()
  };
}

function isAccessVerified() {
  return Boolean(signedInStaff?.ok && verifiedAccessCode && verifiedAccessCode === accessCodeValue());
}

function setSignedInStaff(staff) {
  const code = accessCodeValue();
  signedInStaff = staff ? { ok: true, ...staff } : null;
  verifiedAccessCode = staff && code ? code : "";
  if (signedInStaff?.name) {
    staffNameInput.value = signedInStaff.name;
    localStorage.setItem("dddStaffName", signedInStaff.name);
  }
  updateTeamCurrentCard();
}

function updateSignedInUi() {
  const verified = isAccessVerified();
  const role = signedInStaff?.role || "";
  document.body.dataset.access = verified ? role || "staff" : "locked";
  if (inboxLoginButton) inboxLoginButton.textContent = verified ? "Signed in" : "Open inbox";
  if (accessSessionStatus) {
    if (!accessCodeValue()) {
      accessSessionStatus.textContent = "Enter a code to unlock your workspace.";
    } else if (!verified) {
      accessSessionStatus.textContent = "Code saved on this device. Not verified yet.";
    } else if (role === "admin") {
      accessSessionStatus.textContent = `Admin signed in as ${signedInStaff.name || "Brianna"}. All admin tabs are unlocked.`;
    } else {
      accessSessionStatus.textContent = `${signedInStaff.name || "DDD team"} signed in. Inbox, team, callbacks, and alerts are unlocked.`;
    }
  }
  if (settingsStatus && verified && role !== "admin") {
    settingsStatus.textContent = "Signed in for inbox. Admin code unlocks settings, calls, insights, QA.";
  }
}

async function refreshAccessScopedData() {
  if (!isAccessVerified()) return;
  refreshPresence().catch(() => {});
  refreshInbox().catch((error) => setInboxStatus(error.message));
  updateWebPushDiagnostic().catch(() => {});
  if (signedInStaff.role === "admin") {
    loadSettings().catch(() => {
      settingsStatus.textContent = "Could not reload admin-only settings.";
    });
    refreshCallLog().catch((error) => {
      callLogStatus.textContent = error.message;
    });
    refreshInsights().catch((error) => {
      if (insightsStatus) insightsStatus.textContent = error.message;
    });
    refreshQaDashboard().catch((error) => {
      if (qaStatus) qaStatus.textContent = error.message;
    });
  }
}

function updateTeamCurrentCard() {
  if (teamCurrentCodeStatus) {
    const code = accessCodeValue();
    if (!code) {
      teamCurrentCodeStatus.textContent = "No access code entered yet";
    } else if (isAccessVerified()) {
      teamCurrentCodeStatus.textContent = `Signed in as ${signedInStaff.name || "DDD team"} (${signedInStaff.role || "staff"})`;
    } else if (code === "4444" || code === "0000") {
      teamCurrentCodeStatus.textContent = "Demo code saved on this device";
    } else {
      teamCurrentCodeStatus.textContent = "Code saved here; tap Open inbox to verify it";
    }
  }
  if (teamCurrentStatus) {
    const name = staffNameInput.value.trim() || "This device";
    teamCurrentStatus.textContent = `${name}: ${formatPresenceStatus(staffStatusSelect.value)}`;
  }
  updateSignedInUi();
}

async function verifyAccessCode({ quiet = false, refresh = true } = {}) {
  const code = accessCodeValue();
  if (isAccessVerified()) {
    updateSignedInUi();
    return signedInStaff;
  }
  if (accessCheckPromise) return accessCheckPromise;
  setSignedInStaff(null);
  updateTeamCurrentCard();
  if (!code) {
    if (!quiet) setInboxStatus("Enter the admin or tech access code at the top.");
    return null;
  }
  accessCheckPromise = (async () => {
    const response = await fetch("/api/access-check", { headers: pushAuthHeaders() });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload.ok) {
      setSignedInStaff(null);
      if (!quiet) setInboxStatus(payload.error || "Code not recognized. Use a DDD TechAssist setup code/token, the real admin code, or an emergency backup code from Team.");
      return null;
    }
    setSignedInStaff(payload);
    if (!quiet) setInboxStatus(`Signed in as ${payload.name || "DDD team"} (${payload.role || "staff"}).`);
    if (refresh) refreshAccessScopedData();
    return signedInStaff;
  })();
  try {
    return await accessCheckPromise;
  } finally {
    accessCheckPromise = null;
  }
}

function urlBase64ToUint8Array(value) {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = `${value}${padding}`.replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  return Uint8Array.from([...raw].map((character) => character.charCodeAt(0)));
}

function setWebPushStatus(message) {
  if (webPushStatus) webPushStatus.textContent = message;
}

function setWebPushDiagnostic(message) {
  if (webPushDiagnostic) webPushDiagnostic.textContent = message;
}

function describeWebPushSupport() {
  if (!("Notification" in window)) return "Notifications are not available in this browser.";
  if (!("serviceWorker" in navigator)) return "Service workers are not available in this browser.";
  if (!("PushManager" in window)) return "Push alerts are not available in this browser.";
  if (Notification.permission === "denied") return "Chrome is blocking notifications for this site. Open site settings and change Notifications to Allow.";
  if (Notification.permission === "granted") return "Chrome permission is allowed on this device.";
  return "Chrome has not been allowed yet. Tap Enable browser alerts and choose Allow.";
}

async function getPermissionState() {
  if (!navigator.permissions?.query) return "unknown";
  try {
    const permission = await navigator.permissions.query({ name: "notifications" });
    return permission.state || "unknown";
  } catch {
    return "unknown";
  }
}

async function updateWebPushDiagnostic() {
  const localParts = [
    `Native API: ${"Notification" in window ? "yes" : "no"}`,
    `Chrome permission: ${"Notification" in window ? Notification.permission : "missing"}`,
    `Permission API: ${await getPermissionState()}`,
    `Service worker: ${"serviceWorker" in navigator ? "yes" : "no"}`,
    `Push manager: ${"PushManager" in window ? "yes" : "no"}`
  ];

  if (!accessCodeValue()) {
    setWebPushDiagnostic(`${localParts.join(" | ")}. Enter your code for saved-device count.`);
    return;
  }

  try {
    const response = await fetch("/api/push/status", {
      headers: {
        ...pushAuthHeaders()
      }
    });
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(response.status === 403 ? "code not allowed for push status" : payload.error || "server status unavailable");
    }
    localParts.push(`Saved web devices: ${payload.webSubscriptions ?? 0}`);
    localParts.push(`Saved app devices: ${payload.expoSubscriptions ?? 0}`);
    setWebPushDiagnostic(localParts.join(" | "));
  } catch (error) {
    setWebPushDiagnostic(`${localParts.join(" | ")}. Server: ${error.message}`);
  }
}

async function getNotificationRegistration() {
  if (!("serviceWorker" in navigator)) return null;
  const registration = await navigator.serviceWorker.register("/sw.js");
  await navigator.serviceWorker.ready;
  return registration;
}

async function showLocalWebNotification(title, body, data = {}) {
  if (!("Notification" in window)) return false;
  if (Notification.permission === "default") {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") return false;
  }
  if (Notification.permission !== "granted") return false;
  const options = {
    body,
    icon: "/assets/ddd-ai-dispatch-logo.png",
    badge: "/assets/ddd-ai-dispatch-logo.png",
    data: {
      url: "/",
      type: "local-test",
      ...data
    }
  };
  const registration = await getNotificationRegistration();
  if (registration?.showNotification) {
    await registration.showNotification(title, options);
    return true;
  }
  new Notification(title, options);
  return true;
}

async function subscribeBrowserForPush(publicKey) {
  const registration = await getNotificationRegistration();
  if (!registration?.pushManager) throw new Error("This browser cannot create a push subscription.");
  const subscribe = () =>
    registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey)
    });
  const existingSubscription = await registration.pushManager.getSubscription();
  if (existingSubscription) {
    await existingSubscription.unsubscribe().catch(() => {});
  }
  try {
    return await subscribe();
  } catch (error) {
    const staleSubscription = await registration.pushManager.getSubscription();
    if (staleSubscription) {
      await staleSubscription.unsubscribe().catch(() => {});
      return await subscribe();
    }
    throw error;
  }
}

function isIosBrowser() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent || "") || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

function isStandaloneWebApp() {
  return window.matchMedia?.("(display-mode: standalone)")?.matches || window.navigator.standalone === true;
}

function updateWebPushAvailabilityStatus() {
  if (!webPushStatus) return;
  if (!("Notification" in window)) {
    setWebPushStatus(`${describeWebPushSupport()} Use the iPhone app for native push.`);
    return;
  }
  if (isIosBrowser() && !isStandaloneWebApp()) {
    setWebPushStatus("On iPhone browser, add this site to Home Screen first. The iOS app uses native push.");
    return;
  }
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    setWebPushStatus(`${describeWebPushSupport()} Use the iOS app for native push.`);
    updateWebPushDiagnostic().catch(() => {});
    return;
  }
  setWebPushStatus(describeWebPushSupport());
  updateWebPushDiagnostic().catch(() => {});
}

async function enableWebPushNotifications() {
  try {
    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
      updateWebPushAvailabilityStatus();
      return;
    }
    if (isIosBrowser() && !isStandaloneWebApp()) {
      setWebPushStatus("On iPhone: share button, Add to Home Screen, open that icon, then enable alerts. The iOS app uses native push.");
      return;
    }
    if (!accessCodeValue()) {
      setWebPushStatus("Enter your access code at the top first.");
      return;
    }

    setWebPushStatus("Asking this browser for notification permission...");
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      setWebPushStatus(describeWebPushSupport());
      return;
    }
    const showedLocal = await showLocalWebNotification("DDD AI Dispatch test", "Chrome alerts are allowed on this device.");

    const keyResponse = await fetch("/api/web-push/public-key");
    const keyPayload = await keyResponse.json();
    if (!keyResponse.ok || !keyPayload.publicKey) {
      throw new Error(keyPayload.error || "Browser push is not ready yet.");
    }

    const subscription = await subscribeBrowserForPush(keyPayload.publicKey);

    const response = await fetch("/api/push/register", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...pushAuthHeaders()
      },
      body: JSON.stringify({
        platform: "web",
        subscription
      })
    });
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(response.status === 403 ? "Use your real admin or tech access code. Demo code cannot enable live alerts." : payload.error || "Could not save this browser for alerts.");
    }
    setWebPushStatus(showedLocal ? "Chrome alerts are connected here. This device is ready." : "Saved this browser, but Chrome did not show the local alert. Check Chrome and macOS notification settings.");
    await updateWebPushDiagnostic();
  } catch (error) {
    setWebPushStatus(error.message);
    updateWebPushDiagnostic().catch(() => {});
  }
}

async function sendWebPushTest() {
  try {
    if (!accessCodeValue()) {
      setWebPushStatus("Enter your access code at the top first.");
      return;
    }
    setWebPushStatus("Showing local alert and sending server test...");
    const showedLocal = await showLocalWebNotification("DDD AI Dispatch test", "This device can show native browser alerts.");
    const response = await fetch("/api/push/test", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...pushAuthHeaders()
      },
      body: JSON.stringify({})
    });
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(response.status === 403 ? "Use your real admin or tech access code. Demo code cannot send live alerts." : payload.error || "Could not send test alert.");
    }
    if (payload.sent) {
      setWebPushStatus(showedLocal ? `Local alert shown. Server test sent to ${payload.sent} saved device${payload.sent === 1 ? "" : "s"}.` : `Server test sent to ${payload.sent} device${payload.sent === 1 ? "" : "s"}, but this browser did not show a local alert.`);
      return;
    }
    setWebPushStatus(showedLocal ? "This device showed a native alert, but no saved push devices were found yet. Tap Enable browser alerts once." : "No devices are registered yet.");
    await updateWebPushDiagnostic();
  } catch (error) {
    setWebPushStatus(error.message);
    updateWebPushDiagnostic().catch(() => {});
  }
}

function formatPhone(phone) {
  const raw = String(phone || "");
  const sipPhone = raw.match(/\+?1?\d{10,11}/)?.[0] || "";
  const digits = (sipPhone || raw).replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) {
    return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
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

function announceNewInboxMessages(nextConversations = []) {
  const currentKeys = new Set();
  const newMessages = [];
  for (const conversation of nextConversations) {
    for (const message of conversation.messages || []) {
      const key = message.messageSid || `${conversation.phone}:${message.createdAt}:${message.direction}:${message.body}`;
      currentKeys.add(key);
      if (inboxSeenInitialized && !inboxSeenMessageKeys.has(key) && message.direction === "inbound") {
        newMessages.push({ conversation, message });
      }
    }
  }

  inboxSeenMessageKeys = currentKeys;
  inboxSeenInitialized = true;
  if (!newMessages.length) return;

  const latest = newMessages[newMessages.length - 1];
  const from = formatPhone(latest.conversation.phone);
  const body = `${from}: ${latest.message.body || "New customer text"}`.slice(0, 140);
  setInboxStatus(`New text from ${from}. Inbox updated.`);
  if ("Notification" in window && Notification.permission === "granted") {
    new Notification("New DDD text", {
      body,
      icon: "/assets/ddd-ai-dispatch-logo.png",
      badge: "/assets/ddd-ai-dispatch-logo.png"
    });
  }
}

function renderTeamPresence() {
  if (!teamPresenceList) return;
  teamPresenceList.innerHTML = "";
  if (teamSourceStatus) {
    const labels = {
      "ddd-platform": "Team source: DDD platform / Tech Assist",
      manual: "Team source: emergency backup codes",
      "ddd-platform-empty": "Team source: DDD platform connected, no active techs returned",
      unconfigured: "Team source: backup codes until DDD platform sync is configured"
    };
    teamSourceStatus.textContent = labels[teamSource] || "Team source: checking...";
  }
  const byName = new Map(activePresence.map((item) => [item.name, item]));
  const team = teamDirectory.length ? teamDirectory : activePresence;
  if (!team.length) {
    const empty = document.createElement("span");
    empty.className = "presence-pill muted";
    empty.textContent = "Enter access code to see team";
    teamPresenceList.append(empty);
    return;
  }
  for (const member of team) {
    const live = byName.get(member.name);
    const pill = document.createElement("span");
    const status = live?.status || "offline";
    pill.className = `presence-pill ${live ? "online" : ""} status-${status}`;
    const details = [
      live ? formatPresenceStatus(status) : "offline",
      member.role || live?.role || "staff",
      member.phone || "",
      member.code ? `code ${member.code}` : "",
      live?.typingTo ? `typing to ${formatPhone(live.typingTo)}` : ""
    ]
      .filter(Boolean)
      .join(" · ");
    pill.innerHTML = `<strong>${escapeHtml(member.name)}</strong><small>${escapeHtml(details || "offline")}</small>`;
    teamPresenceList.append(pill);
  }
}

function renderTypingStatus() {
  const typers = activePresence.filter((item) => item.typingTo && item.typingTo === selectedConversationPhone);
  typingStatus.textContent = typers.length ? `${typers.map((item) => item.name).join(", ")} typing...` : "";
}

function formatPresenceStatus(status = "") {
  const labels = {
    available: "Available",
    busy: "Busy",
    "on-call": "On-call",
    "active-call": "Active call",
    offline: "Offline",
    online: "Available"
  };
  return labels[status] || "Available";
}

function normalizeStaffStatus(status) {
  const value = String(status || "").trim().toLowerCase().replace(/\s+/g, "-");
  if (value === "online") return "available";
  return ["available", "busy", "on-call", "active-call"].includes(value) ? value : "available";
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
    const booking = getLatestConversationBooking(conversation);
    const confidence = booking?.confidence || estimateConversationConfidence(conversation);
    const button = document.createElement("button");
    button.type = "button";
    button.className = conversation.phone === selectedConversationPhone ? "conversation-item selected" : "conversation-item";
    button.innerHTML = `
      <div class="conversation-item-top">
        <strong>${formatPhone(conversation.phone)}</strong>
        <small>${formatTime(conversation.lastMessageAt)}</small>
      </div>
      <span>${conversation.lastBody || "No message body"}</span>
      <em class="mini-confidence ${confidenceClass(confidence)}">${escapeHtml(confidence.label)}</em>
    `;
    button.addEventListener("click", () => {
      selectedConversationPhone = conversation.phone;
      renderConversations();
    });
    conversationList.append(button);
  }

  renderSelectedConversation();
  renderTypingStatus();
}

function renderSelectedConversation() {
  const conversation = conversations.find((item) => item.phone === selectedConversationPhone);
  messageList.innerHTML = "";
  if (!conversation) {
    selectedConversationTitle.textContent = "Select a conversation";
    selectedConversationMeta.textContent = "";
    if (conversationConfidence) {
      conversationConfidence.className = "confidence-pill muted";
      conversationConfidence.textContent = "No booking selected";
    }
    if (conversationDetails) conversationDetails.innerHTML = "";
    if (quickReplies) quickReplies.innerHTML = "";
    sendReplyButton.disabled = true;
    return;
  }

  const booking = getLatestConversationBooking(conversation);
  const confidence = booking?.confidence || estimateConversationConfidence(conversation);
  selectedConversationTitle.textContent = formatPhone(conversation.phone);
  selectedConversationMeta.textContent = `${conversation.messages.length} message${conversation.messages.length === 1 ? "" : "s"} · ${booking?.serviceType || "No booking yet"}`;
  if (outboundCustomerPhoneInput && !outboundCustomerPhoneInput.value.trim()) {
    outboundCustomerPhoneInput.value = formatPhone(conversation.phone);
  }
  if (conversationConfidence) {
    conversationConfidence.className = `confidence-pill ${confidenceClass(confidence)}`;
    conversationConfidence.textContent = `${confidence.label} · ${confidence.score}%`;
  }
  renderConversationDetails(conversation, booking, confidence);
  renderQuickReplies(conversation, booking, confidence);
  sendReplyButton.disabled = !replyMessageInput.value.trim();
  sendPresence().catch(() => {});

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
  renderTypingStatus();
}

function getLatestConversationBooking(conversation = {}) {
  return [...(conversation.bookings || [])].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))[0] || null;
}

function estimateConversationConfidence(conversation = {}) {
  const text = `${conversation.lastBody || ""} ${(conversation.messages || []).map((message) => message.body).join(" ")}`;
  const missing = [];
  if (!conversation.phone) missing.push("callback number");
  if (!/\b\d{3,}\s+\w+| at | near | cross street|location|address/i.test(text)) missing.push("location");
  if (!inferServiceFromText(text)) missing.push("service");
  const score = Math.max(0, Math.round(((4 - Math.min(missing.length, 4)) / 4) * 100));
  return {
    score,
    label: missing.includes("location") ? "Needs location" : missing.length ? "Needs review" : "Ready to dispatch",
    missing
  };
}

function confidenceClass(confidence = {}) {
  const label = String(confidence.label || "").toLowerCase();
  if (label.includes("ready")) return "ready";
  if (label.includes("location")) return "needs-location";
  if (label.includes("callback") || label.includes("vehicle")) return "needs-info";
  return "needs-review";
}

function renderConversationDetails(conversation, booking, confidence) {
  if (!conversationDetails) return;
  const detailItems = [
    ["Service", booking?.serviceType || inferServiceFromText(conversation.lastBody || "") || "Not clear yet"],
    ["Location", booking?.location || "Not captured yet"],
    ["Vehicle", [booking?.vehicle, booking?.vehicleColor].filter(Boolean).join(" · ") || "Not captured yet"],
    ["Missing", confidence.missing?.length ? confidence.missing.join(", ") : "Nothing obvious"]
  ];
  conversationDetails.innerHTML = detailItems
    .map(([label, value]) => `<div><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`)
    .join("");
}

function renderQuickReplies(conversation, booking, confidence) {
  if (!quickReplies) return;
  const locationUrl = booking?.customerLocationUrl || "";
  const replies = [
    {
      label: "Ask location",
      text: locationUrl
        ? `Please confirm your service location here so DDD can dispatch correctly: ${locationUrl}`
        : "What is the exact address, business name, or nearest cross street for service?"
    },
    {
      label: "On it",
      text: "Thanks. DDD received this and will follow up with the next step shortly."
    },
    {
      label: "Need vehicle",
      text: "What is the vehicle year, make, model, and color?"
    },
    {
      label: "Payment",
      text: "DDD accepts cash, card, tap pay, and installments. We do not accept checks."
    }
  ];
  quickReplies.innerHTML = replies
    .map((reply) => `<button type="button" data-reply="${escapeHtml(reply.text)}">${escapeHtml(reply.label)}</button>`)
    .join("");
  for (const button of quickReplies.querySelectorAll("button")) {
    button.addEventListener("click", () => {
      replyMessageInput.value = button.dataset.reply || "";
      sendReplyButton.disabled = !replyMessageInput.value.trim();
      replyMessageInput.focus();
    });
  }
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttribute(value) {
  return escapeHtml(value || "");
}

async function refreshInbox() {
  saveAccessCode();
  localStorage.setItem("dddStaffName", staffNameInput.value.trim());
  staffStatusSelect.value = normalizeStaffStatus(staffStatusSelect.value);
  localStorage.setItem("dddStaffStatus", staffStatusSelect.value);
  if (!accessCodeValue()) {
    setInboxStatus("Enter your access code at the top, then tap Open inbox.");
    conversations = [];
    inboxSeenMessageKeys = new Set();
    inboxSeenInitialized = false;
    renderConversations();
    return;
  }
  const staff = await verifyAccessCode({ quiet: true, refresh: false });
  if (!staff) {
    setInboxStatus("Code not recognized. Use a DDD TechAssist setup code/token, the real admin code, demo code 4444, or an emergency backup code from Team.");
    conversations = [];
    inboxSeenMessageKeys = new Set();
    inboxSeenInitialized = false;
    renderConversations();
    return;
  }
  setInboxStatus("Opening inbox...");
  const response = await fetch("/api/conversations", { headers: staffHeaders() });
  if (response.status === 403) {
    setSignedInStaff(null);
    updateTeamCurrentCard();
    setInboxStatus("Code not recognized. Use a DDD TechAssist setup code/token, the real admin code, demo code 4444, or an emergency backup code from Team.");
    conversations = [];
    inboxSeenMessageKeys = new Set();
    inboxSeenInitialized = false;
    renderConversations();
    return;
  }
  if (!response.ok) throw new Error("Could not load text inbox.");
  const payload = await response.json();
  if (payload.staff?.name) {
    setSignedInStaff(payload.staff);
  }
  teamDirectory = payload.team || [];
  teamSource = payload.teamSource || "";
  activePresence = payload.presence || [];
  const nextConversations = payload.conversations || [];
  announceNewInboxMessages(nextConversations);
  conversations = nextConversations;
  renderConversations();
  renderTeamPresence();
  updateTeamCurrentCard();
  setInboxStatus(conversations.length ? `Signed in as ${payload.staff?.name || "DDD team"}. Inbox is up to date.` : "Signed in. No texts yet.");
}

async function refreshPresence() {
  const response = await fetch("/api/presence", { headers: staffHeaders() });
  if (response.status === 403) {
    teamDirectory = [];
    activePresence = [];
    renderTeamPresence();
    renderTypingStatus();
    return;
  }
  if (!response.ok) return;
  const payload = await response.json();
  teamDirectory = payload.team || [];
  teamSource = payload.teamSource || "";
  activePresence = payload.presence || [];
  renderTeamPresence();
  renderTypingStatus();
}

async function sendPresence() {
  const code = accessCodeValue();
  if (!code) return;
  const typingTo = replyMessageInput.value.trim() ? selectedConversationPhone : "";
  const response = await fetch("/api/presence", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...staffHeaders()
    },
    body: JSON.stringify({
      viewing: selectedConversationPhone,
      status: staffStatusSelect.value,
      typingTo
    })
  });
  if (!response.ok) return;
  const payload = await response.json();
  activePresence = payload.presence || [];
  renderTeamPresence();
  renderTypingStatus();
}

refreshInboxButton.addEventListener("click", () => {
  setActiveTab("inbox");
  verifyAccessCode({ quiet: true, refresh: false }).catch(() => {});
  refreshInbox().catch((error) => setInboxStatus(error.message));
  refreshInsights().catch((error) => {
    if (insightsStatus) insightsStatus.textContent = error.message;
  });
});

inboxLoginButton?.addEventListener("click", async () => {
  setActiveTab("inbox");
  const staff = await verifyAccessCode();
  if (!staff) return;
  refreshInbox().catch((error) => setInboxStatus(error.message));
  sendPresence().catch(() => {});
});

refreshInboxPanelButton?.addEventListener("click", () => {
  refreshInbox().catch((error) => setInboxStatus(error.message));
  sendPresence().catch(() => {});
});

refreshTeamButton?.addEventListener("click", () => {
  updateTeamCurrentCard();
  verifyAccessCode({ quiet: true, refresh: false }).catch(() => {});
  refreshPresence().catch(() => {});
  sendPresence().catch(() => {});
});

addStaffCodeButton?.addEventListener("click", () => {
  appendStaffCodeRow();
  updateSaveControls("New tech row added. Enter a name and code, then Save changes.");
});

adminPinInput.addEventListener("change", async () => {
  saveAccessCode();
  await verifyAccessCode({ quiet: false, refresh: true });
});

adminPinInput.addEventListener("input", () => {
  saveAccessCode();
  queueStaffRefresh();
});

staffNameInput.addEventListener("change", () => {
  updateTeamCurrentCard();
  queueStaffRefresh();
});

staffNameInput.addEventListener("input", () => {
  updateTeamCurrentCard();
  queueStaffRefresh();
});

staffStatusSelect.addEventListener("change", () => {
  localStorage.setItem("dddStaffStatus", staffStatusSelect.value);
  updateTeamCurrentCard();
  sendPresence().catch(() => {});
});

replyMessageInput.addEventListener("input", () => {
  sendReplyButton.disabled = !selectedConversationPhone || !replyMessageInput.value.trim();
  sendPresence().catch(() => {});
});

function queueStaffRefresh() {
  saveAccessCode();
  localStorage.setItem("dddStaffName", staffNameInput.value.trim());
  clearTimeout(staffRefreshTimer);
  const code = accessCodeValue();
  setInboxStatus(code ? "Checking access..." : "Enter your access code at the top to load texts.");
  staffRefreshTimer = setTimeout(() => {
    if (!accessCodeValue()) return;
    verifyAccessCode({ quiet: true, refresh: true }).catch((error) => setInboxStatus(error.message));
  }, 450);
}

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
        ...staffHeaders()
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
  if (activityTimeline) activityTimeline.innerHTML = `<li class="activity-item empty-state">Loading activity...</li>`;
  const [callsResponse, leadsResponse, summariesResponse, bookingsResponse] = await Promise.all([
    fetch("/api/call-log?limit=75", { headers: adminHeaders() }),
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
  activityItems = buildActivityItems({ calls, leads, summaries, bookings });
  renderActivityOverview({ calls, leads, summaries, bookings });
  renderActivityTimeline();
}

function buildActivityItems({ calls = [], leads = [], summaries = [], bookings = [] }) {
  return [
    ...calls.map((call) => ({
      type: "call",
      at: call.createdAt,
      title: call.caller ? `Call from ${formatPhone(call.caller)}` : "Customer call",
      eyebrow: call.displayStatus || call.outcome?.label || "Call",
      detail: cleanCallText(call.outcome?.detail || call.transcriptText || "Call logged for review."),
      accent: "blue"
    })),
    ...bookings.map((booking) => ({
      type: "booking",
      at: booking.createdAt,
      title: booking.name || formatPhone(booking.phone) || "Booking request",
      eyebrow: booking.status || "Booking",
      detail: [booking.serviceType || booking.reason, booking.location, booking.vehicleColor ? `${booking.vehicleColor} vehicle` : ""].filter(Boolean).join(" · ") || "Booking saved",
      accent: "green"
    })),
    ...leads.map((lead) => ({
      type: "lead",
      at: lead.createdAt,
      title: lead.name || formatPhone(lead.phone) || "Lead saved",
      eyebrow: [lead.urgency, lead.serviceType || "Lead"].filter(Boolean).join(" · "),
      detail: lead.reason || lead.nextStep || "Lead captured",
      accent: "pink"
    })),
    ...summaries.map((summary) => ({
      type: "summary",
      at: summary.endedAt || summary.createdAt,
      title: summary.callId || "Call summary",
      eyebrow: summary.recordingUrl ? "Summary · recording" : "Summary",
      detail: summary.transcript?.length ? `${summary.transcript.length} transcript lines saved` : "Summary saved",
      accent: "violet"
    }))
  ]
    .filter((item) => item.at)
    .sort((a, b) => String(b.at).localeCompare(String(a.at)))
    .slice(0, 40);
}

function renderActivityOverview({ calls = [], leads = [], summaries = [], bookings = [] }) {
  if (!activityOverview) return;
  const today = new Date().toDateString();
  const todayCount = [...calls, ...leads, ...summaries, ...bookings].filter((item) => {
    const date = new Date(item.createdAt || item.endedAt || "");
    return !Number.isNaN(date.valueOf()) && date.toDateString() === today;
  }).length;
  activityOverview.innerHTML = [
    ["Today", todayCount],
    ["Calls", calls.length],
    ["Bookings", bookings.length],
    ["Leads", leads.length]
  ]
    .map(([label, value]) => `<div><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`)
    .join("");
}

function renderActivityTimeline() {
  if (!activityTimeline) return;
  const visibleItems = activityItems.filter((item) => activityFilter === "all" || item.type === activityFilter).slice(0, 18);
  if (!visibleItems.length) {
    activityTimeline.innerHTML = `<li class="activity-item empty-state">No ${activityFilter === "all" ? "" : `${activityFilter} `}activity yet.</li>`;
    return;
  }
  activityTimeline.innerHTML = visibleItems
    .map(
      (item) => `
        <li class="activity-item ${escapeHtml(item.accent)}">
          <div class="activity-dot" aria-hidden="true"></div>
          <div class="activity-copy">
            <div>
              <strong>${escapeHtml(item.title)}</strong>
              <time>${escapeHtml(formatTime(item.at))}</time>
            </div>
            <span>${escapeHtml(item.eyebrow)}</span>
            <p>${escapeHtml(item.detail)}</p>
          </div>
        </li>
      `
    )
    .join("");
}

async function refreshCallLog() {
  callLogStatus.textContent = "Loading call log...";
  const response = await fetch("/api/call-log?limit=75", { headers: adminHeaders() });
  if (response.status === 403) {
    callLog = [];
    selectedCallId = "";
    renderCallLog();
    callLogStatus.textContent = "Admin access is needed for call details.";
    return;
  }
  if (!response.ok) throw new Error("Could not load call log.");
  const payload = await response.json();
  callLog = payload.calls || [];
  if (!selectedCallId || !callLog.some((call) => call.id === selectedCallId)) {
    selectedCallId = callLog[0]?.id || "";
  }
  renderCallLog();
  callLogStatus.textContent = callLog.length ? "Call log is up to date." : "No forwarded calls logged yet.";
}

function renderCallLog() {
  callLogList.innerHTML = "";
  if (!callLog.length) {
    const empty = document.createElement("p");
    empty.className = "empty-state";
    empty.textContent = "No calls yet.";
    callLogList.append(empty);
    renderSelectedCall();
    return;
  }
  for (const call of callLog) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = call.id === selectedCallId ? "call-log-item selected" : "call-log-item";
    const label = call.caller || call.callId || "Unknown caller";
    const meta = [
      call.displayStatus || call.outcome?.label,
      call.durationLabel,
      call.smsStatus && call.smsStatus !== "none" ? `SMS ${call.smsStatus}` : "",
      call.recordingStatus === "available" ? "recording" : ""
    ]
      .filter(Boolean)
      .join(" · ");
    button.innerHTML = `
      <span class="call-outcome-dot ${escapeHtml(call.completion || "needs-review")}"></span>
      <strong>${escapeHtml(formatPhone(label))}</strong>
      <span>${escapeHtml(meta || call.type || "call")}</span>
      <small>${escapeHtml(formatTime(call.startedAt || call.createdAt))}</small>
    `;
    button.addEventListener("click", () => {
      selectedCallId = call.id;
      renderCallLog();
    });
    callLogList.append(button);
  }
  renderSelectedCall();
}

function renderSelectedCall() {
  const call = callLog.find((item) => item.id === selectedCallId);
  if (!call) {
    callDetail.innerHTML = `
      <h3>Select a call</h3>
      <p class="empty-state">Call transcript, saved intake, booking info, and recording links will appear here.</p>
    `;
    return;
  }
  const recording = call.recordingUrl
    ? `<a href="${escapeHtml(call.recordingUrl)}" target="_blank" rel="noreferrer">Open recording</a>`
    : "No recording link stored yet";
  const transcriptHtml = renderGroupedTranscript(call.transcript || []);
  const synopsis = buildCallSynopsis(call);
  const correction = call.correction || {};
  callDetail.innerHTML = `
    <div class="call-detail-header">
      <div>
        <p class="eyebrow">Call detail</p>
        <h3>${escapeHtml(formatPhone(call.caller) || "Unknown caller")}</h3>
      </div>
      <span class="status-pill ${escapeHtml(call.completion || "needs-review")}">${escapeHtml(call.displayStatus || call.outcome?.label || "Logged")}</span>
    </div>
    <div class="call-outcome-summary">
      <strong>${escapeHtml(cleanCallText(call.outcome?.detail || "Call logged for review."))}</strong>
      <span>${escapeHtml(call.outcome?.callerStayedOn ? "Caller stayed on" : call.outcome?.hungUpEarly ? "Caller hung up early" : "Needs review")}</span>
    </div>
    <div class="call-correction-panel">
      <div>
        <label for="callOutcomeCorrection">Correct outcome</label>
        <select id="callOutcomeCorrection">
          ${renderCorrectionOptions(correction.outcomeTag || "")}
        </select>
      </div>
      <div>
        <label for="callCorrectionNote">Admin note</label>
        <input id="callCorrectionNote" type="text" maxlength="500" value="${escapeAttribute(correction.note || "")}" placeholder="Optional note for this call" />
      </div>
      <button type="button" data-action="save-call-correction" data-call-id="${escapeAttribute(call.id)}">Save correction</button>
      <p id="callCorrectionStatus">${correction.updatedAt ? `Last corrected ${escapeHtml(formatTime(correction.updatedAt))}` : "Corrections update this call's status and insight counts."}</p>
    </div>
    <div class="call-metrics">
      ${renderMetric("Duration", call.durationLabel || "Unknown", call.durationSeconds ? "ok" : "warn")}
      ${renderMetric("Booking", call.bookings?.length ? "Saved" : "Not saved", call.bookings?.length ? "ok" : "warn")}
      ${renderMetric("Lead", call.leads?.length ? "Saved" : "Not saved", call.leads?.length ? "ok" : "neutral")}
      ${renderMetric("SMS", formatSmsStatus(call.smsStatus), call.smsStatus === "sent" ? "ok" : call.smsStatus === "failed" ? "bad" : "neutral")}
      ${renderMetric("Recording", call.recordingStatus === "available" ? "Available" : "None yet", call.recordingStatus === "available" ? "ok" : "neutral")}
      ${renderMetric("Transcript", call.transcript?.length ? `${call.transcript.length} lines` : "None yet", call.transcript?.length ? "ok" : "warn")}
    </div>
    <dl class="call-facts">
      <div><dt>Started</dt><dd>${escapeHtml(formatTime(call.startedAt || call.createdAt) || "Unknown")}</dd></div>
      <div><dt>Ended</dt><dd>${escapeHtml(formatTime(call.endedAt) || "Not recorded")}</dd></div>
      <div><dt>Duration</dt><dd>${escapeHtml(call.durationLabel || "Unknown")}</dd></div>
      <div><dt>Recording</dt><dd>${recording}</dd></div>
    </dl>
    <div class="call-section">
      <h4>Saved intake</h4>
      ${renderRelatedRecords("Bookings", call.bookings)}
      ${renderRelatedRecords("Leads", call.leads)}
    </div>
    <div class="call-section">
      <h4>Synopsis</h4>
      <div class="call-synopsis">${synopsis.map((item) => `<p>${escapeHtml(item)}</p>`).join("")}</div>
    </div>
    <div class="call-section">
      <h4>Transcript</h4>
      <div class="transcript-box">${transcriptHtml}</div>
    </div>
  `;
  const saveCorrectionButton = callDetail.querySelector('[data-action="save-call-correction"]');
  saveCorrectionButton?.addEventListener("click", saveSelectedCallCorrection);
}

function renderCorrectionOptions(selected = "") {
  const options = [
    ["", "No manual correction"],
    ["booked", "Booked"],
    ["lead", "Lead"],
    ["missed", "Missed"],
    ["incomplete", "Incomplete"],
    ["spam", "Spam"],
    ["sales", "Sales"],
    ["apply", "Apply to work"],
    ["complaint", "Complaint"],
    ["unsupported", "Unsupported service"],
    ["follow-up", "Needs follow-up"]
  ];
  return options
    .map(([value, label]) => `<option value="${escapeAttribute(value)}"${value === selected ? " selected" : ""}>${escapeHtml(label)}</option>`)
    .join("");
}

async function saveSelectedCallCorrection(event) {
  const button = event.currentTarget;
  const callId = button.dataset.callId;
  const status = callDetail.querySelector("#callCorrectionStatus");
  const outcomeTag = callDetail.querySelector("#callOutcomeCorrection")?.value || "";
  const note = callDetail.querySelector("#callCorrectionNote")?.value || "";
  if (!callId || !outcomeTag) {
    if (status) status.textContent = "Choose an outcome before saving.";
    return;
  }
  button.disabled = true;
  if (status) status.textContent = "Saving correction...";
  try {
    const response = await fetch(`/api/calls/${encodeURIComponent(callId)}/correction`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...adminHeaders() },
      body: JSON.stringify({ outcomeTag, note })
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload.ok) {
      throw new Error(payload.error || "Could not save correction.");
    }
    const index = callLog.findIndex((call) => call.id === callId);
    if (index >= 0) {
      callLog[index] = {
        ...callLog[index],
        correction: payload.correction,
        displayStatus: getCorrectedStatusLabel(payload.correction.outcomeTag),
        completion: getCorrectedCompletion(payload.correction.outcomeTag, callLog[index].completion)
      };
    }
    renderCallLog();
    if (callLogStatus) callLogStatus.textContent = "Call correction saved.";
  } catch (error) {
    if (status) status.textContent = error.message;
  } finally {
    button.disabled = false;
  }
}

function getCorrectedStatusLabel(tag = "") {
  const labels = {
    booked: "Booked",
    lead: "Lead captured",
    missed: "Missed",
    incomplete: "Incomplete",
    spam: "Spam",
    sales: "Sales",
    apply: "Apply to work",
    complaint: "Complaint",
    unsupported: "Unsupported",
    "follow-up": "Needs follow-up"
  };
  return labels[tag] || "Corrected";
}

function getCorrectedCompletion(tag = "", fallback = "needs-review") {
  if (tag === "booked" || tag === "lead" || tag === "apply") return "complete";
  if (tag === "missed" || tag === "incomplete") return "incomplete";
  return fallback || "needs-review";
}

function buildCallSynopsis(call) {
  const booking = call.bookings?.[0] || {};
  const lead = call.leads?.[0] || {};
  const service = booking.serviceType || lead.serviceType || inferServiceFromText(call.transcriptText || "") || "Service not clear yet";
  const location = booking.location || lead.location || "Location not captured yet";
  const vehicle = booking.vehicle || lead.vehicle || "Vehicle not captured yet";
  const nextStep = booking.nextStep || lead.nextStep || call.outcome?.detail || "Review this call and follow up if needed.";
  return [
    `Outcome: ${call.displayStatus || call.outcome?.label || "Logged"}${call.durationLabel ? ` in ${call.durationLabel}` : ""}.`,
    `Request: ${service}.`,
    `Location: ${location}.`,
    `Vehicle: ${vehicle}.`,
    `Next step: ${cleanCallText(nextStep)}`
  ];
}

function renderGroupedTranscript(transcript = []) {
  if (!transcript.length) return `<p class="empty-state">No transcript saved for this call yet.</p>`;
  return `
    <div class="transcript-conversation">
      ${transcript
        .map((line) => {
          const speaker = line.speaker || "Call";
          const speakerClass = String(speaker || "call").toLowerCase();
          const text = line.text || "";
          if (!text.trim()) return "";
          return `
            <div class="transcript-row ${escapeHtml(speakerClass)}">
              <div class="transcript-meta">
                <strong>${escapeHtml(speaker)}</strong>
                <span>${escapeHtml(formatTime(line.at) || "")}</span>
              </div>
              <p>${escapeHtml(text)}</p>
            </div>
          `;
        })
        .join("")}
    </div>
  `;
}

function renderMetric(label, value, tone = "neutral") {
  return `
    <div class="call-metric ${escapeHtml(tone)}">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value || "Unknown")}</strong>
    </div>
  `;
}

function formatSmsStatus(status = "") {
  const value = String(status || "none").toLowerCase();
  const labels = {
    sent: "Sent",
    failed: "Failed",
    none: "None",
    "inbound only": "Inbound only"
  };
  return labels[value] || value;
}

function cleanCallText(value = "") {
  const text = String(value || "");
  if (/sip|routing|twilio reported/i.test(text)) return "The call is logged for review.";
  return text;
}

function formatDuration(seconds) {
  const total = Math.max(0, Number(seconds || 0) || 0);
  if (!total) return "";
  const minutes = Math.floor(total / 60);
  const remainder = total % 60;
  return minutes ? `${minutes}m ${String(remainder).padStart(2, "0")}s` : `${remainder}s`;
}

function renderRelatedRecords(title, records = []) {
  if (!records.length) return `<p class="empty-state">${title}: none saved.</p>`;
  return `
    <div class="related-records">
      <strong>${escapeHtml(title)}</strong>
      ${records
        .map(
          (record) => {
            const photoCount = Number(record.photoCount || record.photos?.length || 0);
            const links = [
              record.customerStatusUrl ? `<a href="${escapeAttribute(record.customerStatusUrl)}" target="_blank" rel="noreferrer">Status</a>` : "",
              record.customerLocationUrl ? `<a href="${escapeAttribute(record.customerLocationUrl)}" target="_blank" rel="noreferrer">Location</a>` : "",
              record.photoUploadUrl ? `<a href="${escapeAttribute(record.photoUploadUrl)}" target="_blank" rel="noreferrer">Upload photos</a>` : "",
              ...((record.photos || []).slice(-6).map((photo, index) =>
                photo.url ? `<a href="${escapeAttribute(photo.url)}" target="_blank" rel="noreferrer">Photo ${index + 1}</a>` : ""
              ))
            ].filter(Boolean);
            return `
              <div class="related-record">
                <p>${escapeHtml(
                  [
                    record.name || record.phone || "Customer",
                    record.serviceType || record.reason || "",
                    record.location || "",
                    record.vehicleColor ? `Color: ${record.vehicleColor}` : "",
                    record.vehicle ? `Vehicle: ${record.vehicle}` : "",
                    photoCount ? `${photoCount} photo${photoCount === 1 ? "" : "s"}` : "",
                    record.preferredTime || "",
                    record.status || ""
                  ]
                    .filter(Boolean)
                    .join(" · ")
                )}</p>
                ${links.length ? `<div class="record-links">${links.join("")}</div>` : ""}
              </div>
            `;
          }
        )
        .join("")}
    </div>
  `;
}

function inferServiceFromText(text = "") {
  const value = String(text).toLowerCase();
  const services = [
    ["Tire / flat", /flat|tire|spare|plug|wheel lock|inflation/],
    ["Jump start / battery", /jump|battery|dead battery/],
    ["Lockout", /lockout|locked out|unlock|door unlock/],
    ["Fuel delivery", /fuel|gas|out of gas/],
    ["Oil change", /oil change|oil\/filter/],
    ["Brakes / rotors", /brake|rotor/],
    ["Hub bearing", /hub|bearing/],
    ["Apply to work", /apply|job|work|technician|contractor/],
    ["Existing appointment", /appointment|booking|reschedule|status/],
    ["Unsupported service", /tow|towing|transmission|engine rebuild|body work|windshield/]
  ];
  return services.find(([, pattern]) => pattern.test(value))?.[0] || "";
}

refreshActivity().catch(() => {});
setInterval(() => refreshActivity().catch(() => {}), 15000);
refreshInbox().catch((error) => setInboxStatus(error.message));
setInterval(() => refreshInbox().catch(() => {}), 5000);
refreshCallLog().catch((error) => {
  callLogStatus.textContent = error.message;
});
setInterval(() => refreshCallLog().catch(() => {}), 20000);
refreshQaDashboard().catch((error) => {
  if (qaStatus) qaStatus.textContent = error.message;
});
setInterval(() => refreshQaDashboard().catch(() => {}), 30000);
refreshInsights().catch((error) => {
  if (insightsStatus) insightsStatus.textContent = error.message;
});
setInterval(() => refreshInsights().catch(() => {}), 30000);
setInterval(() => sendPresence().catch(() => {}), 20000);
setInterval(() => refreshPresence().catch(() => {}), 10000);

refreshCallLogButton.addEventListener("click", () => {
  refreshCallLog().catch((error) => {
    callLogStatus.textContent = error.message;
  });
});

refreshQaButton?.addEventListener("click", () => {
  refreshQaDashboard().catch((error) => {
    qaStatus.textContent = error.message;
  });
});

refreshActivityButton?.addEventListener("click", () => {
  refreshActivity().catch(() => {});
});

for (const button of activityFilterButtons) {
  button.addEventListener("click", () => {
    activityFilter = button.dataset.activityFilter || "all";
    for (const option of activityFilterButtons) {
      option.classList.toggle("active", option === button);
    }
    renderActivityTimeline();
  });
}

refreshInsightsButton?.addEventListener("click", () => {
  refreshInsights().catch((error) => {
    insightsStatus.textContent = error.message;
  });
});

enableWebPushButton?.addEventListener("click", enableWebPushNotifications);
testWebPushButton?.addEventListener("click", sendWebPushTest);
checkWebPushButton?.addEventListener("click", () => {
  updateWebPushAvailabilityStatus();
  updateWebPushDiagnostic().catch((error) => setWebPushDiagnostic(error.message));
});
updateWebPushDiagnostic().catch(() => {});

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
  if (event.type === "response.function_call_arguments.done" && event.name === "lookup_customer_history") {
    const args = JSON.parse(event.arguments || "{}");
    const response = await fetch(`/api/customer/bookings?phone=${encodeURIComponent(args.phone || "")}`, {
      headers: adminHeaders()
    });
    const payload = await response.json().catch(() => ({}));
    dataChannel.send(
      JSON.stringify({
        type: "conversation.item.create",
        item: {
          type: "function_call_output",
          call_id: event.call_id,
          output: JSON.stringify({
            ok: response.ok,
            history: {
              phone: args.phone || "",
              returningCustomer: Boolean(payload.bookings?.length),
              bookings: payload.bookings || []
            }
          })
        }
      })
    );
    return;
  }

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
          recordId: (payload.lead || payload.booking)?.bookingId || (payload.lead || payload.booking)?.createdAt,
          status: payload.booking?.status,
          customerStatusUrl: payload.booking?.customerStatusUrl,
          externalSync: payload.booking?.externalSync
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
            ? "Tell the caller the booking request has been saved. If the tool returned a customerStatusUrl or external tracking URL, share it as the booking/status link and give one concise next step."
            : "Tell the caller their message has been saved and give a concise next step."
      }
    })
  );
  refreshActivity().catch(() => {});
}
