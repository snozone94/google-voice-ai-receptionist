import WebSocket from "ws";
import { getCustomerHistory, saveBookingRequest, saveCallSummary, saveLead } from "./receptionist.js";
import { createLiveTranscript } from "./live-transcript.js";

const activeMonitors = new Map();

export function stopRealtimeAssistant(callId) {
  const monitor = activeMonitors.get(callId);
  if (monitor) monitor.stopped = true;
  return monitor?.liveTranscript.list() || [];
}

export function listLiveCalls() {
  return Array.from(activeMonitors.values(), (monitor) => ({
    callId: monitor.callId,
    phone: monitor.settings.callerPhone || "",
    startedAt: monitor.startedAt,
    status: "AI answering",
    transcript: monitor.liveTranscript.list(),
    capabilities: { listen: false, takeOver: false }
  }));
}
export function monitorRealtimeCall(callId, settings = {}) {
  if (activeMonitors.has(callId)) return activeMonitors.get(callId);

  const monitor = new CallMonitor(callId, settings);
  activeMonitors.set(callId, monitor);
  monitor.start().catch((error) => console.error("Realtime monitor disconnected", error.message)).finally(() => activeMonitors.delete(callId));
  return monitor;
}

class CallMonitor {
  constructor(callId, settings = {}) {
    this.callId = callId;
    this.settings = settings;
    this.transcript = [];
    this.liveTranscript = createLiveTranscript();
    this.completedTools = new Set();
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

        const greeting = this.settings.greeting || "Thank you for calling Triple D Roadside. How can I help today?";
        ws.send(
          JSON.stringify({
            type: "response.create",
            response: {
              instructions: `Start speaking now. Say exactly: "${greeting}" Finish the full greeting even if you hear breathing, road noise, phone rustle, background voices, or a tiny sound from the caller side. Do not restart the greeting. After the greeting is complete, wait for the caller.`
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
    this.liveTranscript.accept(event);
    this.transcript = this.liveTranscript.list();
    if (this.stopped) return;
    if (event.type === "response.function_call_arguments.done") {
      if (!event.call_id || this.completedTools.has(event.call_id)) return;
      this.completedTools.add(event.call_id);
    }
    if (event.type === "response.function_call_arguments.done" && event.name === "lookup_customer_history") {
      const args = JSON.parse(event.arguments || "{}");
      const history = await getCustomerHistory(args.phone || "");
      this.ws.send(
        JSON.stringify({
          type: "conversation.item.create",
          item: {
            type: "function_call_output",
            call_id: event.call_id,
            output: JSON.stringify({ ok: true, history })
          }
        })
      );
      this.ws.send(
        JSON.stringify({
          type: "response.create",
          response: {
            instructions:
              history.returningCustomer
                ? "Use the returning-customer history to avoid re-asking vehicle/service details. Confirm old details briefly and ask what changed, if anything."
                : "No saved customer history was found. Continue normal intake."
          }
        })
      );
      return;
    }

    if (
      event.type === "response.function_call_arguments.done" &&
      (event.name === "save_lead" || event.name === "save_booking_request")
    ) {
      const args = JSON.parse(event.arguments || "{}");
      const record =
        event.name === "save_booking_request"
          ? await saveBookingRequest({ ...args, callId: this.settings.parentCallId || this.callId, source: "phone" })
          : await saveLead({ ...args, callId: this.settings.parentCallId || this.callId, source: "phone" });
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
                ? "Tell the caller the booking request has been saved and that DDD will text the next-step link. Do not read any tracking URL or long link out loud. Do not promise live tracking until a technician is assigned or en route."
                : "Tell the caller their message has been saved and give a concise next step."
          }
        })
      );
      return;
    }

    this.transcript = this.liveTranscript.list();
  }

  async saveSummary() {
    if (!this.transcript.length) return;

    await saveCallSummary({
      callId: this.settings.parentCallId || this.callId,
      startedAt: this.startedAt,
      endedAt: new Date().toISOString(),
      transcript: this.transcript
    });
  }
}
