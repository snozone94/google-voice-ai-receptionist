import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

const time = (value) => Date.parse(value || "") || 0;
const phone = (value) => {
  const digits = String(value || "").replace(/\D/g, "");
  return digits.length === 10 ? `+1${digits}` : digits.length === 11 && digits.startsWith("1") ? `+${digits}` : /^\+[1-9]\d{7,14}$/.test(value || "") ? value : "";
};

export function decorateConversations(conversations, calls, state = {}) {
  return conversations.map((conversation) => {
    const key = phone(conversation.phone);
    const saved = state[key] || {};
    const messages = conversation.messages || [];
    const latestReply = messages.filter((message) => message.direction === "outbound" && !message.source && !/failed|undelivered/.test(message.status || "")).at(-1);
    const readThrough = Math.max(time(saved.readThrough), time(latestReply?.createdAt));
    const unread = messages.filter((message) => message.direction === "inbound" && time(message.createdAt) > readThrough).length;
    const latestCall = calls.filter((call) => phone(call.caller) === key).sort((a, b) => time(b.startedAt) - time(a.startedAt))[0];
    const lastOutbound = messages.filter((message) => message.direction === "outbound").at(-1);
    const latestTime = Math.max(time(lastOutbound?.createdAt), time(latestCall?.startedAt), ...messages.filter((message) => message.direction === "inbound").map((message) => time(message.createdAt)));
    const failedText = /failed|undelivered/.test(lastOutbound?.status || "");
    const subsequentlyBooked = conversation.bookings?.some((booking) => time(booking.createdAt) >= time(latestCall?.startedAt));
    const terminal = /completed|failed|busy|no-answer|cancelled|canceled|missed/.test(latestCall?.status || "");
    const incompleteCall = latestCall && terminal && !subsequentlyBooked && /missed|incomplete|needs-review/.test(latestCall.completion || "");
    const staffReplied = messages.some((message) => message.direction === "outbound" && !message.source && !/failed|undelivered/.test(message.status || "") && time(message.createdAt) > time(latestCall?.startedAt));
    const needsFollowUp = time(saved.handledThrough) < latestTime && (unread > 0 || failedText || (incompleteCall && !staffReplied));
    return { ...conversation, unread, needsFollowUp: Boolean(needsFollowUp), followUpReason: needsFollowUp ? failedText ? "Text not delivered" : unread ? "Customer waiting" : "Call needs follow-up" : "", lastSmsStatus: lastOutbound?.status || "none" };
  });
}

export function pendingTextReminders(conversations, { now = Date.now(), minutes = 5, since = 0 } = {}) {
  return conversations.flatMap((conversation) => {
    const messages = conversation.messages || [];
    const inbound = messages.filter((message) => message.direction === "inbound").at(-1);
    if (!inbound || time(inbound.createdAt) < since || /^\s*(stop|unsubscribe|cancel|end|quit|start|help)\s*$/i.test(inbound.body || "")) return [];
    const replied = messages.some((message) => message.direction === "outbound" && !message.source && !/failed|undelivered/.test(message.status || "") && time(message.createdAt) >= time(inbound.createdAt));
    const age = now - time(inbound.createdAt);
    if (replied || age < minutes * 60000 || age > 86400000) return [];
    return [{ phone: conversation.phone, message: inbound, minutesWaiting: Math.floor(age / 60000), key: `${conversation.phone}:${inbound.messageSid || inbound.createdAt}` }];
  });
}

export function workspaceStore(directory) {
  const file = path.join(directory, "workspace-state.json");
  let queue = Promise.resolve();
  const identity = (staff) => crypto.createHash("sha256").update(String(staff.id || `${staff.role}:${staff.name}`)).digest("hex");
  async function read() {
    try { return JSON.parse(await fs.readFile(file, "utf8")); }
    catch (error) { if (error.code === "ENOENT") return {}; throw error; }
  }
  return {
    async get(staff) {
      await queue;
      const all = await read();
      const personal = all[identity(staff)] || {};
      const result = { ...personal };
      for (const [key, shared] of Object.entries(all.__team__ || {})) result[key] = { ...personal[key], ...shared };
      return result;
    },
    mark(staff, customerPhone, action, through) {
      if (!phone(customerPhone) || !["read", "handled"].includes(action) || !time(through) || time(through) > Date.now() + 5000) throw new Error("Invalid conversation update.");
      const result = queue.then(async () => {
        const state = await read();
        const id = action === "handled" ? "__team__" : identity(staff);
        state[id] ||= {};
        const entry = state[id][phone(customerPhone)] ||= {};
        const field = action === "read" ? "readThrough" : "handledThrough";
        if (time(through) > time(entry[field])) entry[field] = new Date(time(through)).toISOString();
        await fs.mkdir(directory, { recursive: true });
        await fs.writeFile(`${file}.tmp`, JSON.stringify(state));
        await fs.rename(`${file}.tmp`, file);
        return entry;
      });
      queue = result.catch(() => {});
      return result;
    }
  };
}
