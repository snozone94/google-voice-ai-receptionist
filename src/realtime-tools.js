import WebSocket from "ws";
import { saveBookingRequest, saveCallSummary, saveLead } from "./receptionist.js";

const activeMonitors = new Map();

export function monitorRealtimeCall(callId, settings = {}) {
  if (activeMonitors.has(callId)) return activeMonitors.get(callId);

  const monitor = new CallMonitor(callId, settings);
  activeMonitors.set(callId, monitor);
  monitor.start().finally(() => activeMonitors.delete(callId));
  return monitor;
}

class CallMonitor {
  constructor(callId, settings = {}) {
    this.callId = callId;
    this.settings = settings;
    this.transcript = [];
    this.startedAt = new Date().toISOString();
  }

  async start() {
    return new Promise((resolve) => {
      const ws = new WebSocket(`wss://api.openai.com/v1/realtime?call_id=${encodeURIComponent(this.callId)}`, {
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
        }
      });

      this.ws = ws;

      ws.on("open", () => {
        console.log(`Realtime monitor attached for call ${this.callId}`);
        if (this.settings.verificationMode) {
          console.log(`Verification capture mode active for call ${this.callId}; skipping greeting.`);
          return;
        }

        const greeting = this.settings.greeting || "Thank you for calling DDD. How can I help today?";
        ws.send(
          JSON.stringify({
            type: "response.create",
            response: {
              instructions: `Start speaking now. Say exactly: "${greeting}" Then wait for the caller.`
            }
          })
        );
      });

      ws.on("message", async (message) => {
        try {
          await this.handleEvent(JSON.parse(message.toString()));
        } catch (error) {
          console.error("Realtime monitor event failed", error);
        }
      });

      ws.on("close", async () => {
        await this.saveSummary().catch((error) => console.error("Summary save failed", error));
        resolve();
      });

      ws.on("error", (error) => {
        console.error("Realtime monitor socket failed", error);
      });
    });
  }

  async handleEvent(event) {
    if (
      event.type === "response.function_call_arguments.done" &&
      (event.name === "save_lead" || event.name === "save_booking_request")
    ) {
      const args = JSON.parse(event.arguments || "{}");
      const record =
        event.name === "save_booking_request"
          ? await saveBookingRequest({ ...args, callId: this.callId, source: "phone" })
          : await saveLead({ ...args, callId: this.callId, source: "phone" });
      this.ws.send(
        JSON.stringify({
          type: "conversation.item.create",
          item: {
            type: "function_call_output",
            call_id: event.call_id,
            output: JSON.stringify({
              ok: true,
              recordId: record.bookingId || record.createdAt,
              status: record.status,
              customerStatusUrl: record.customerStatusUrl,
              externalSync: record.externalSync
            })
          }
        })
      );
      this.ws.send(
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
      return;
    }

    const text = extractTranscriptText(event);
    if (text) {
      this.transcript.push({
        at: new Date().toISOString(),
        type: event.type,
        text
      });
    }
  }

  async saveSummary() {
    if (!this.transcript.length) return;

    await saveCallSummary({
      callId: this.callId,
      startedAt: this.startedAt,
      endedAt: new Date().toISOString(),
      transcript: this.transcript
    });
  }
}

function extractTranscriptText(event) {
  if (typeof event.transcript === "string") return event.transcript;
  if (typeof event.text === "string") return event.text;
  if (typeof event.delta === "string" && event.type.includes("transcript")) return event.delta;
  if (event.item?.content) {
    return event.item.content
      .map((content) => content.transcript || content.text)
      .filter(Boolean)
      .join(" ");
  }
  return "";
}
