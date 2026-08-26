import fs from "node:fs/promises";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const businessPath = path.join(root, "config", "business.json");
const leadsPath = path.join(root, "data", "leads.jsonl");
const callsPath = path.join(root, "data", "calls.jsonl");
const summariesPath = path.join(root, "data", "summaries.jsonl");

export async function loadBusiness() {
  const raw = await fs.readFile(businessPath, "utf8");
  return JSON.parse(raw);
}

export async function saveLead(lead) {
  const record = {
    createdAt: new Date().toISOString(),
    ...lead
  };
  await fs.appendFile(leadsPath, `${JSON.stringify(record)}\n`);
  await postOptionalWebhook(process.env.LEAD_WEBHOOK_URL, record);
  return record;
}

export async function saveCallSummary(summary) {
  const record = {
    createdAt: new Date().toISOString(),
    ...summary
  };
  await fs.appendFile(summariesPath, `${JSON.stringify(record)}\n`);
  await postOptionalWebhook(process.env.CALL_SUMMARY_WEBHOOK_URL, record);
  return record;
}

export async function listRecords(filePath, limit = 50) {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return raw
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line))
      .slice(-limit)
      .reverse();
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
}

export async function listLeads(limit) {
  return listRecords(leadsPath, limit);
}

export async function listCalls(limit) {
  return listRecords(callsPath, limit);
}

export async function listSummaries(limit) {
  return listRecords(summariesPath, limit);
}

export async function saveCallEvent(event) {
  const record = {
    createdAt: new Date().toISOString(),
    type: event.type,
    callId: event.data?.call_id,
    sipHeaders: event.data?.sip_headers || []
  };
  await fs.appendFile(callsPath, `${JSON.stringify(record)}\n`);
  return record;
}

export function buildReceptionistInstructions(business) {
  const bookingUrl = process.env.BOOKING_URL || "";
  return `
You are the AI receptionist for ${business.name}.
Your job is to answer Google Voice forwarded calls like a capable Smith.ai-style front-desk teammate for DDD.

Voice and manner:
- Sound ${business.tone}.
- Keep answers short enough for a phone call.
- Ask one question at a time.
- Do not invent business policies, prices, addresses, or availability.
- If a caller wants to book, collect their name, phone, email if available, reason for booking, and preferred date/time.
${bookingUrl ? `- The booking link is ${bookingUrl}. Offer it verbally and include it in saved lead next steps.` : "- A booking link is not configured yet. Tell callers DDD will text or call them with the booking link after their details are saved."}

Business hours:
${Object.entries(business.hours).map(([day, hours]) => `- ${day}: ${hours}`).join("\n")}

Services you can provide:
${business.services.map((service) => `- ${service}`).join("\n")}

FAQs:
${business.faqs.map((faq) => `- Q: ${faq.question}\n  A: ${faq.answer}`).join("\n")}

Escalation rules:
${business.escalationRules.map((rule) => `- ${rule}`).join("\n")}

Lead capture:
- Politely collect name, phone number, email if they are willing, and reason for calling.
- Repeat important contact details back for confirmation.
- Once the caller confirms details, call the save_lead tool.
- End with a clear next step. If a booking link is configured, tell them to use it to book.
- If you cannot complete the request, say a team member will follow up.
- Never promise that a human is available unless the caller has actually been transferred.
`.trim();
}

export function receptionistTools() {
  return [
    {
      type: "function",
      name: "save_lead",
      description: "Save caller contact details and reason for calling after confirming them with the caller.",
      parameters: {
        type: "object",
        properties: {
          name: {
            type: "string",
            description: "Caller name, if provided."
          },
          phone: {
            type: "string",
            description: "Best callback phone number."
          },
          email: {
            type: "string",
            description: "Caller email, if provided."
          },
          reason: {
            type: "string",
            description: "Short reason for the call."
          },
          urgency: {
            type: "string",
            enum: ["low", "normal", "high", "emergency"],
            description: "How urgent the caller's request appears to be."
          },
          nextStep: {
            type: "string",
            description: "What the business should do next. Include the booking link if the caller wants to schedule and BOOKING_URL is configured."
          },
          preferredTime: {
            type: "string",
            description: "Caller preferred appointment date or time, if provided."
          }
        },
        required: ["reason", "urgency", "nextStep"]
      }
    }
  ];
}

export function callAcceptPayload(business) {
  return {
    type: "realtime",
    model: "gpt-realtime",
    instructions: buildReceptionistInstructions(business),
    tools: receptionistTools(),
    tool_choice: "auto",
    audio: {
      output: {
        voice: "marin"
      }
    }
  };
}

async function postOptionalWebhook(url, payload) {
  if (!url) return;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    console.warn(`Webhook failed: ${response.status} ${await response.text()}`);
  }
}
