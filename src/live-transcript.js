// Stream events for one utterance share an item/content key. Final text replaces
// its fragments; separate utterances are never collapsed just for matching text.
export function createLiveTranscript(limit = 1000) {
  const turns = new Map();
  return {
    accept(event) {
      const input = event.type === "conversation.item.input_audio_transcription.completed";
      const output = /^response\.(?:output_audio_transcript|audio_transcript|output_text|text)\.(?:delta|done)$/.test(event.type || "");
      if (!input && !output) return;
      const itemId = event.item_id;
      if (!itemId) return;
      const key = `${input ? "input" : "output"}:${itemId}:${event.content_index ?? 0}`;
      const previous = turns.get(key);
      if (previous?.complete) return;
      const complete = input || event.type.endsWith(".done");
      const text = complete ? event.transcript ?? event.text ?? previous?.text ?? "" : (previous?.text || "") + (event.delta || "");
      if (!String(text).trim()) return;
      turns.set(key, { itemId, at: previous?.at || new Date().toISOString(), speaker: input ? "Customer" : "DDD AI", type: input ? "caller.transcript" : "assistant.transcript", text: String(text), complete });
      while (turns.size > limit) turns.delete(turns.keys().next().value);
    },
    list() { return Array.from(turns.values(), (turn) => ({ ...turn })); }
  };
}
