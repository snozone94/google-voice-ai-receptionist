import fs from "node:fs/promises";
import path from "node:path";
import twilio from "twilio";

const cache = new Map();
const validId = (id) => /^CA[0-9a-f]{32}$/i.test(id || "");
const filename = (directory, id) => path.join(directory, "call-transcripts", `${id}.json`);
const view = (record, partials = true) => record ? {
  status: record.status,
  updatedAt: record.updatedAt,
  source: "call-audio",
  turns: [...record.turns, ...(partials ? Object.values(record.partial || {}) : [])]
    .sort((a, b) => a.at.localeCompare(b.at) || a.sequence - b.sequence)
    .map((turn) => ({ ...turn }))
} : null;

export async function readStoredCallTranscript(directory, id, partials = false) {
  if (!validId(id)) return null;
  const file = filename(directory, id);
  if (!cache.has(file)) {
    try { cache.set(file, JSON.parse(await fs.readFile(file, "utf8"))); }
    catch (error) { if (error.code === "ENOENT") return null; throw error; }
    while (cache.size > 2000) cache.delete(cache.keys().next().value);
  }
  return view(cache.get(file), partials);
}

export function createCallTranscripts({ directory, baseUrl = () => process.env.PUBLIC_BASE_URL, client = () => twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN) }) {
  const writes = new Map();
  const starts = new Map();
  const persist = (record) => {
    const file = filename(directory, record.callId);
    const snapshot = JSON.stringify({ ...record, partial: {} });
    const operation = (writes.get(file) || Promise.resolve()).catch(() => {}).then(async () => {
      await fs.mkdir(path.dirname(file), { recursive: true });
      await fs.writeFile(`${file}.tmp`, snapshot, { mode: 0o600 });
      await fs.rename(`${file}.tmp`, file);
    });
    writes.set(file, operation);
    operation.finally(() => { if (writes.get(file) === operation) writes.delete(file); }).catch(() => {});
    return operation;
  };
  return {
    async start(id, { inboundSpeaker = "Customer", outboundSpeaker = "DDD" } = {}) {
      if (!validId(id)) throw new Error("Invalid call for transcription.");
      if (starts.has(id)) return starts.get(id);
      const operation = (async () => {
        await readStoredCallTranscript(directory, id);
        const file = filename(directory, id);
        if (cache.has(file)) return view(cache.get(file));
        const record = { callId: id, status: "connecting", turns: [], partial: {}, inboundSpeaker, outboundSpeaker, updatedAt: new Date().toISOString() };
        cache.set(file, record);
        await persist(record);
        try {
          const result = await client().calls(id).transcriptions.create({
            name: `ddd-${id}`, track: "both_tracks", partialResults: true,
            transcriptionEngine: "deepgram", speechModel: "nova-3", languageCode: "multi",
            inboundTrackLabel: "caller", outboundTrackLabel: "other",
            statusCallbackUrl: `${String(baseUrl()).replace(/\/$/, "")}/api/live-calls/transcription?call=${encodeURIComponent(id)}`,
            statusCallbackMethod: "POST"
          });
          record.sid ||= result.sid;
          if (record.status === "connecting") record.status = "live";
        } catch (error) {
          record.status = "unavailable";
          await persist(record);
          throw error;
        }
        await persist(record);
        return view(record);
      })();
      starts.set(id, operation);
      operation.finally(() => starts.delete(id)).catch(() => {});
      return operation;
    },
    async accept(id, event) {
      if (!validId(id) || event.CallSid !== id) throw Object.assign(new Error("Call transcript mismatch."), { status: 400 });
      await readStoredCallTranscript(directory, id);
      const record = cache.get(filename(directory, id));
      if (!record) throw Object.assign(new Error("Call transcript not found."), { status: 404 });
      if (!/^GT[0-9a-f]{32}$/i.test(event.TranscriptionSid || "") || record.sid && record.sid !== event.TranscriptionSid) throw Object.assign(new Error("Call transcript mismatch."), { status: 400 });
      record.sid ||= event.TranscriptionSid;
      const at = Number.isFinite(Date.parse(event.Timestamp)) ? new Date(event.Timestamp).toISOString() : new Date().toISOString();
      if (event.TranscriptionEvent === "transcription-content") {
        if (!["inbound_track", "outbound_track"].includes(event.Track)) return;
        const sequence = Number(event.SequenceId);
        if (!Number.isSafeInteger(sequence) || sequence < 0) return;
        let content;
        try { content = JSON.parse(event.TranscriptionData); } catch { return; }
        const text = String(content.transcript || "").trim().slice(0, 8000);
        if (!text) return;
        const track = event.Track;
        const complete = event.Final === true || event.Final === "true";
        const key = `${record.sid}:${track}:${sequence}`;
        const previous = record.partial?.[track];
        const lastFinal = Math.max(-1, ...record.turns.filter((turn) => turn.track === track).map((turn) => turn.sequence));
        if (record.turns.some((turn) => turn.itemId === key)) return persist(record);
        const turn = { itemId: key, sequence, track, at, speaker: track === "inbound_track" ? record.inboundSpeaker : record.outboundSpeaker, text, complete, type: "call.audio.transcript" };
        record.partial ||= {};
        if (complete) {
          record.turns.push(turn);
          if (previous && previous.sequence <= sequence) delete record.partial[track];
        } else if (sequence > lastFinal && (!previous || sequence > previous.sequence)) record.partial[track] = turn;
        record.updatedAt = new Date().toISOString();
        if (complete) await persist(record);
      } else {
        const sequence = Number(event.SequenceId);
        if (Number.isSafeInteger(sequence)) {
          if (sequence <= (record.statusSequence ?? -1)) return;
          record.statusSequence = sequence;
        }
        if (event.TranscriptionEvent === "transcription-started") record.status = "live";
        else if (event.TranscriptionEvent === "transcription-stopped") { record.status = "saved"; record.partial = {}; }
        else if (event.TranscriptionEvent === "transcription-error") record.status = "unavailable";
        else return;
        record.updatedAt = new Date().toISOString();
        await persist(record);
      }
    },
    get: (id, partials = true) => readStoredCallTranscript(directory, id, partials)
  };
}
