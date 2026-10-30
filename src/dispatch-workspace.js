import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

const time = (value) => Date.parse(value || "") || 0;
export const conversationPhone = (value) => {
  const digits = String(value || "").replace(/\D/g, "");
  return digits.length === 10 ? `+1${digits}` : digits.length === 11 && digits.startsWith("1") ? `+${digits}` : /^\+[1-9]\d{7,14}$/.test(value || "") ? value : "";
};
export const adminRole = (role = "") => ["admin", "administrator", "owner", "manager", "super_admin", "dispatch_admin"].includes(String(role).toLowerCase());
// Stable fallback for authenticated PIN-only accounts; never include access codes.
export function safeStaff(staff = {}) {
  const name = String(staff.name || "DDD team").trim().slice(0, 80);
  return { id: String(staff.id || `staff-${crypto.createHash("sha256").update(`${staff.role || "staff"}:${name}`).digest("hex").slice(0, 24)}`), name };
}
const staffReply = (message) => message.direction === "outbound" && !message.source && !/^(AI receptionist|DDD AI|DDD AI Dispatch|Call-start fallback|Missed-call fallback|Call follow-up)$/i.test(message.agentName || "") && !/failed|undelivered|canceled|cancelled/i.test(message.status || "");
const command = (message) => /^\s*(stop|unsubscribe|cancel|end|quit|start|help)\s*$/i.test(message.body || "");

export function decorateConversations(conversations, calls, state = {}) {
  return conversations.map((conversation) => {
    const key = conversationPhone(conversation.phone);
    const saved = state[key] || { handledThrough: conversation.handledThrough, assignedTo: conversation.assignedTo };
    const messages = [...(conversation.messages || [])].sort((a, b) => time(a.createdAt) - time(b.createdAt));
    const latestReply = messages.filter(staffReply).at(-1);
    const repliedThrough = time(latestReply?.createdAt);
    const readThrough = Math.max(time(saved.readThrough), repliedThrough);
    const unreadMessages = messages.filter((message) => message.direction === "inbound" && time(message.createdAt) > readThrough);
    const waiting = messages.filter((message) => message.direction === "inbound" && !command(message) && time(message.createdAt) > Math.max(repliedThrough, time(saved.handledThrough)));
    const latestCall = calls.filter((call) => conversationPhone(call.caller) === key).sort((a, b) => time(b.startedAt) - time(a.startedAt))[0];
    const lastOutbound = messages.filter((message) => message.direction === "outbound").at(-1);
    const callTime = Math.max(time(latestCall?.startedAt), time(latestCall?.endedAt));
    const failedText = /failed|undelivered/i.test(lastOutbound?.status || "") && time(lastOutbound?.createdAt) > time(saved.handledThrough);
    const subsequentlyBooked = latestCall && conversation.bookings?.some((booking) => booking.callId && (booking.callId === latestCall.callId || booking.callId === latestCall.id) && !/cancel|fail|reject/i.test(booking.status || ""));
    const terminal = /completed|failed|busy|no-answer|cancelled|canceled|missed/.test(latestCall?.status || "");
    const incompleteCall = latestCall && terminal && !subsequentlyBooked && /missed|incomplete|needs-review/.test(latestCall.completion || "") && callTime > time(saved.handledThrough) && repliedThrough <= callTime;
    const needsReply = waiting.length > 0;
    const needsFollowUp = Boolean(needsReply || failedText || incompleteCall);
    return { ...conversation, messages, unread: unreadMessages.length, firstUnreadAt: unreadMessages[0]?.createdAt || null, needsReply, waitingSince: waiting[0]?.createdAt || null, handledThrough: saved.handledThrough || null, assignedTo: saved.assignedTo ? { id: String(saved.assignedTo.id), name: String(saved.assignedTo.name) } : null, needsFollowUp, followUpReason: needsFollowUp ? failedText ? "Text not delivered" : needsReply ? "Customer waiting" : "Call needs follow-up" : "", lastSmsStatus: lastOutbound?.status || "none" };
  });
}

export function pendingTextReminders(conversations, { now = Date.now(), minutes = 5, escalateMinutes = 15, since = 0, state = {} } = {}) {
  return decorateConversations(conversations, [], state).flatMap((conversation) => {
    if (!conversation.needsReply) return [];
    // Home keeps the full unanswered history. Only the reminder clock is
    // rebased to the first eligible inbound after this worker's activation.
    const waitingStart = time(conversation.waitingSince);
    const inbound = conversation.messages.find((message) => message.direction === "inbound" && !command(message) && time(message.createdAt) >= waitingStart && time(message.createdAt) >= since);
    if (!inbound) return [];
    const age = now - time(inbound.createdAt);
    if (age < minutes * 60000) return [];
    const stage = age >= escalateMinutes * 60000 ? "escalation" : "reminder";
    return [{ phone: conversation.phone, assignedTo: conversation.assignedTo, stage, message: inbound, minutesWaiting: Math.floor(age / 60000), key: `${conversation.phone}:${inbound.messageSid || inbound.createdAt}:${stage}` }];
  });
}

export function workspaceStore(directory) {
  const file = path.join(directory, "workspace-state.json");
  let queue = Promise.resolve();
  // Preserve the pre-phase-1 personal read-state keys.
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
    mark(staff, customerPhone, action, through, { assignee, roster = [] } = {}) {
      if (!staff?.ok || staff.role === "reviewer") throw Object.assign(new Error("Staff sign-in required."), { status: 403 });
      if (!conversationPhone(customerPhone) || !["read", "handled", "claim", "assign", "release", "unassign"].includes(action)) throw new Error("Invalid conversation update.");
      if (["read", "handled"].includes(action) && (!time(through) || time(through) > Date.now() + 5000)) throw new Error("Invalid conversation update.");
      const result = queue.then(async () => {
        const state = await read();
        const id = action === "read" ? identity(staff) : "__team__";
        state[id] ||= {};
        const entry = state[id][conversationPhone(customerPhone)] ||= {};
        const self = safeStaff(staff);
        const admin = adminRole(staff.role);
        if (action === "claim") {
          if (entry.assignedTo && entry.assignedTo.id !== self.id) throw Object.assign(new Error("Another team member owns this conversation."), { status: 409 });
          entry.assignedTo = self;
        } else if (action === "assign") {
          if (!admin) throw Object.assign(new Error("Admin access required."), { status: 403 });
          const member = roster.find((member) => member.active !== false && safeStaff(member).id === assignee?.id && safeStaff(member).name === assignee?.name);
          if (!member) throw new Error("Choose an active member of the visible team.");
          entry.assignedTo = safeStaff(member);
        } else if (["release", "unassign"].includes(action)) {
          if (!admin && entry.assignedTo?.id !== self.id) throw Object.assign(new Error("Only the owner or an admin can release this conversation."), { status: 403 });
          entry.assignedTo = null;
        } else {
          const field = action === "read" ? "readThrough" : "handledThrough";
          if (time(through) > time(entry[field])) entry[field] = new Date(time(through)).toISOString();
        }
        await fs.mkdir(directory, { recursive: true });
        await fs.writeFile(`${file}.tmp`, JSON.stringify(state), { mode: 0o600 });
        await fs.rename(`${file}.tmp`, file);
        return { ...entry };
      });
      queue = result.catch(() => {});
      return result;
    }
  };
}
