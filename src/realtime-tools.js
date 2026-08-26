import WebSocket from "ws";
import { saveCallSummary, saveLead } from "./receptionist.js";

const activeMonitors = new Map();

export function monitorRealtimeCall(callId) {
  if (activeMonitors.has(callId)) return activeMonitors.get(callId);

  const monitor = new CallMonitor(callId);
  activeMonitors.set(callId, monitor);
  monitor.start().finally(() => activeMonitors.delete(callId));
  return monitor;
}

class CallMonitor {
  constructor(callId) {
    this.callId = callId;
    this.transcript = [];
    this.startedAt = new Date().toISOString();
  }

  async start() {
    await new Promise((resolve) => setTimeout(resolve, 750));

    return new Promise((resolve) => {
      const ws = new WebSocket(`wss://api.openai.com/v1/realtime?call_id=${encodeURIComponent(this.callId)}`, {
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
        }
      });

      this.ws = ws;

      ws.on("open", () => {
        ws.send(JSON.stringify({ type: "response.create" }));
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
    if (event.type === "response.function_call_arguments.done" && event.name === "save_lead") {
      const args = JSON.parse(event.arguments || "{}");
      const lead = await saveLead({ ...args, callId: this.callId, source: "phone" });
      this.ws.send(
        JSON.stringify({
          type: "conversation.item.create",
          item: {
            type: "function_call_output",
            call_id: event.call_id,
            output: JSON.stringify({ ok: true, leadId: lead.createdAt })
          }
        })
      );
      this.ws.send(
        JSON.stringify({
          type: "response.create",
          response: {
            instructions: "Tell the caller their message has been saved and give a concise next step."
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
