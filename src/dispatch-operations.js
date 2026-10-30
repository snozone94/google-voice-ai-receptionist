import fs from "node:fs/promises";
import path from "node:path";
import { adminRole, decorateConversations, safeStaff } from "./dispatch-workspace.js";

export function validateReplyPolicy(value) {
  const remindAfterMinutes = Number(value.remindAfterMinutes);
  const escalateAfterMinutes = Number(value.escalateAfterMinutes);
  if (!Number.isInteger(remindAfterMinutes) || remindAfterMinutes < 1 || remindAfterMinutes > 60 || !Number.isInteger(escalateAfterMinutes) || escalateAfterMinutes <= remindAfterMinutes || escalateAfterMinutes > 1440) throw Object.assign(new Error("Reminder must be 1–60 minutes; escalation must be later and within 24 hours."), { status: 400 });
  return { remindAfterMinutes, escalateAfterMinutes };
}

export function replyPolicyStore(directory, env = process.env) {
  const file = path.join(directory, "reply-policy.json");
  let queue = Promise.resolve();
  const defaults = () => validateReplyPolicy({ remindAfterMinutes: env.REPLY_REMINDER_MINUTES || 5, escalateAfterMinutes: env.REPLY_ESCALATION_MINUTES || 15 });
  async function read() {
    try { return validateReplyPolicy(JSON.parse(await fs.readFile(file, "utf8"))); }
    catch (error) { if (error.code !== "ENOENT") throw error; return defaults(); }
  }
  return {
    async get() { await queue; return read(); },
    set(value) {
      const next = validateReplyPolicy(value);
      const result = queue.then(async () => {
        await fs.mkdir(directory, { recursive: true });
        await fs.writeFile(`${file}.tmp`, JSON.stringify(next), { mode: 0o600 });
        await fs.rename(`${file}.tmp`, file);
        return next;
      });
      queue = result.catch(() => {});
      return result;
    }
  };
}

// Platform lifecycle status takes precedence over the local intake snapshot.
export function canonicalBookingStatus(booking = {}) {
  const value = [booking.platformStatus, booking.status].find((status) => typeof status === "string" && status.trim());
  const key = String(value || "requested").normalize("NFKC").toLowerCase().replace(/[^a-z0-9]+/g, "");
  const aliases = {
    complete: "completed", completed: "completed", cleared: "completed", done: "completed", finished: "completed", resolved: "completed",
    techniciancompleted: "completed", techniciancomplete: "completed", techcompleted: "completed", techcomplete: "completed", jobcompleted: "completed", servicecompleted: "completed",
    cancelled: "cancelled", canceled: "cancelled", customercancelled: "cancelled", customercanceled: "cancelled",
    failed: "failed", rejected: "rejected", declined: "rejected", closed: "closed"
  };
  return aliases[key] || key;
}

export const isOpenBooking = (booking) => !["completed", "cancelled", "failed", "rejected", "closed"].includes(canonicalBookingStatus(booking));
const easternFormatter = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" });
function calendarDay(year, month, day) {
  const stamp = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const date = new Date(`${stamp}T12:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().startsWith(stamp) ? stamp : "";
}

// Date-only and zone-less appointment values describe an Eastern calendar day.
// Explicit offsets are instants and must be converted, including around DST.
export function easternBookingDay(value) {
  if (value === undefined || value === null || value === "") return "";
  if (typeof value === "number" || value instanceof Date) {
    const date = new Date(value);
    return Number.isFinite(date.getTime()) ? easternFormatter.format(date) : "";
  }
  if (typeof value !== "string" || !/\b\d{4}\b/.test(value)) return "";
  const text = value.trim();
  const stamp = Date.parse(text);
  if (!Number.isFinite(stamp)) return "";
  const hasZone = /(?:z|[+-]\d{2}:?\d{2}|\b(?:gmt|utc|est|edt))$/i.test(text);
  if (hasZone) return easternFormatter.format(new Date(stamp));
  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})(?:$|[T ])/);
  if (iso) return calendarDay(Number(iso[1]), Number(iso[2]), Number(iso[3]));
  const us = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:$|\s)/);
  if (us) return calendarDay(Number(us[3]), Number(us[1]), Number(us[2]));
  const date = new Date(stamp);
  return calendarDay(date.getFullYear(), date.getMonth() + 1, date.getDate());
}

export function bookingServiceDay(booking) {
  for (const value of [booking.serviceTime, booking.appointmentAt, booking.scheduledAt, booking.preferredTime, booking.service_time, booking.appointment_at, booking.scheduled_at, booking.preferred_time]) {
    const day = easternBookingDay(value);
    if (day) return day;
  }
  return easternBookingDay(booking.createdAt);
}

export function bookingSyncHealth(bookings, { configured = false, now = Date.now(), staleAfterMinutes = 15 } = {}) {
  let verified = 0, stale = 0, unverified = 0, missing = 0, errors = 0, pending = 0;
  const ages = [];
  for (const booking of bookings) {
    const creation = booking.externalSync;
    if (creation?.pending) pending++;
    else if (creation?.ok === false && !creation.skipped) errors++;
    const refresh = booking.platformRefresh;
    const matchedRefresh = ["fresh", "stale"].includes(refresh?.state);
    const sync = booking.statusSync || (refresh ? {
      status: refresh.state === "fresh" ? "matched" : refresh.state,
      matched: matchedRefresh || undefined,
      matchedAt: matchedRefresh ? refresh.checkedAt : undefined,
      checkedAt: refresh.checkedAt,
      error: refresh.error
    } : undefined);
    if (sync?.status === "error" || sync?.ok === false && sync?.error) errors++;
    if (sync?.status === "missing" || sync?.matched === false) missing++;
    // Initial booking POST acceptance, a local updatedAt, a successful empty
    // history lookup, and an unmatched lookup are not lifecycle confirmation.
    const matched = sync?.status === "matched" || sync?.matched === true;
    const matchedAt = Date.parse(sync?.matchedAt || (matched ? sync?.refreshedAt || sync?.checkedAt : "") || "");
    if (Number.isFinite(matchedAt) && matchedAt <= now + 5000) ages.push(Math.max(0, Math.floor((now - matchedAt) / 60000)));
    if (!(matched || sync?.matchedAt) || !Number.isFinite(matchedAt) || matchedAt > now + 5000) unverified++;
    else if (now - matchedAt > staleAfterMinutes * 60000 || sync?.ok === false || sync?.matched === false || sync?.status === "error" || sync?.status === "missing" || sync?.status === "stale") stale++;
    else verified++;
  }
  const detail = `${bookings.length} bookings: ${verified} lifecycle matches verified within ${staleAfterMinutes} minutes; ${stale} stale; ${unverified} unverified; ${missing} absent remote matches; ${errors} sync errors; ${pending} creation results pending. ${ages.length ? `Oldest verified match: ${Math.max(...ages)} minutes ago.` : "No verified lifecycle match timestamp is available."}`;
  const status = errors ? "error" : pending || stale || missing ? "warning" : !configured ? "unconfigured" : unverified || !bookings.length ? "unknown" : "ok";
  return { key: "bookingSync", label: "Booking status sync", status, detail, nextStep: errors || pending ? "Review failed or uncertain booking sync before retrying creation; verify the existing platform job first." : !configured ? "Connect the customer-history status feed; local booking status is not live platform confirmation." : unverified || stale || missing ? "Check exact platform booking IDs and the last matched status timestamp. Unmatched or unqueried records remain unverified." : "" };
}

export function operationsSnapshot({ staff, conversations, calls, bookings, state = {}, voice, activeCalls = [], replyPolicy, health, team = [], now = Date.now() }) {
  const threads = decorateConversations(conversations, calls, state);
  const self = safeStaff(staff);
  const isAdmin = adminRole(staff.role);
  for (const thread of threads) {
    const owner = thread.assignedTo?.id === self.id;
    const writable = staff.role !== "reviewer";
    thread.capabilities = { assign: writable && isAdmin, claim: writable && (!thread.assignedTo || owner), release: writable && Boolean(thread.assignedTo) && (owner || isAdmin), unassign: writable && Boolean(thread.assignedTo) && (owner || isAdmin) };
  }
  const attention = { unread: threads.filter((thread) => thread.unread > 0).length, followUp: threads.filter((thread) => thread.needsFollowUp).length, count: threads.filter((thread) => thread.unread > 0 || thread.needsFollowUp).length };
  const tasks = threads.filter((thread) => thread.needsFollowUp).map((thread) => {
    const minutesWaiting = thread.waitingSince ? Math.max(0, Math.floor((now - Date.parse(thread.waitingSince)) / 60000)) : 0;
    return { phone: thread.phone, reason: thread.followUpReason, assignedTo: thread.assignedTo, minutesWaiting, priority: thread.needsReply && minutesWaiting >= replyPolicy.escalateAfterMinutes ? "urgent" : "normal" };
  }).sort((a, b) => Number(b.priority === "urgent") - Number(a.priority === "urgent") || b.minutesWaiting - a.minutesWaiting);
  return { staff: { ...safeStaff(staff), ok: Boolean(staff.ok), role: staff.role, ...(staff.source ? { source: staff.source } : {}) }, conversations: threads, calls, bookings, attention, voice, team: team.map((member) => ({ ...safeStaff(member), role: member.role || "staff", active: member.active !== false })), summary: { activeCalls: activeCalls.length, unreadMessages: threads.reduce((sum, thread) => sum + thread.unread, 0), needsReply: threads.filter((thread) => thread.needsReply).length, openBookings: bookings.filter(isOpenBooking).length, todayOpenBookings: bookings.filter((booking) => isOpenBooking(booking) && bookingServiceDay(booking) === easternBookingDay(now)).length, overdueReplies: tasks.filter((task) => task.minutesWaiting >= replyPolicy.remindAfterMinutes && threads.find((thread) => thread.phone === task.phone)?.needsReply).length }, tasks, ...(adminRole(staff.role) ? { health: health || [] } : {}), replyPolicy, updatedAt: new Date(now).toISOString() };
}

// Receives observations, never credentials or provider error bodies.
export function operationsHealth({ configured = {}, outcomes = {}, tokenCount = 0, teamCount = 0, storage = true, bookings = [], bookingStatusConfigured = false, now = Date.now() } = {}) {
  const labels = { calling: "Calling", sms: "Text messages", push: "Staff notifications", email: "Alert email", team: "Staff roster", storage: "Dispatch storage" };
  return Object.entries(labels).map(([key, label]) => {
    if (key === "storage") return { key, label, status: storage ? "ok" : "error", detail: storage ? "Dispatch storage is readable and writable." : "Dispatch storage check failed.", nextStep: storage ? "" : "Restore access to the persistent data volume." };
    const ready = key === "team" ? teamCount > 0 : key === "push" ? tokenCount > 0 : Boolean(configured[key]);
    const recent = outcomes[key] && now - Date.parse(outcomes[key].at) <= 86400000 && Date.parse(outcomes[key].at) <= now + 5000 ? outcomes[key] : null;
    const failed = recent?.status === "failed";
    const uncertain = recent?.status === "uncertain";
    return { key, label, status: !ready ? "unconfigured" : failed ? "error" : uncertain ? "warning" : key === "team" || ["delivered", "completed"].includes(recent?.status) ? "ok" : "unknown", detail: ready && key === "team" ? `${teamCount} active staff available.` : !ready ? key === "team" ? "No active staff returned by the roster." : key === "push" ? "No enabled notification devices." : "Required configuration is missing or disabled." : recent ? `Last observed outcome: ${recent.status} at ${recent.at}.` : "Configured; no recent outcome observed. Delivery is unverified.", nextStep: !ready ? key === "team" ? "Connect the staff roster and confirm active members." : key === "push" ? "Have staff sign in and enable notifications." : `Complete ${label.toLowerCase()} setup.` : uncertain ? "Verify the provider submission before resending; automatic retry of uncertain submissions is paused." : failed ? `Check ${label.toLowerCase()} provider logs and retry.` : "" };
  }).concat(bookingSyncHealth(bookings, { configured: bookingStatusConfigured, now }));
}

export function notificationAudience(subscription, audience) {
  if (subscription.enabled === false || subscription.staffRole === "reviewer") return false;
  if (!audience) return true;
  if (audience.adminOnly && !adminRole(subscription.staffRole)) return false;
  if (audience.staffIds) return audience.staffIds.includes(safeStaff({ id: subscription.staffId, name: subscription.staffName, role: subscription.staffRole }).id);
  return true;
}

export function reminderAudience(item, roster, { adminEmails = [], adminStaff } = {}) {
  const active = roster.filter((member) => member.active !== false);
  const admins = [...active.filter((member) => adminRole(member.role)), ...(adminStaff ? [adminStaff] : [])];
  const owner = item.assignedTo && [...active, ...(adminStaff ? [adminStaff] : [])].find((member) => safeStaff(member).id === item.assignedTo.id);
  if (item.stage !== "escalation" && owner) return { staffIds: [safeStaff(owner).id], emailTo: owner.email ? [owner.email] : [] };
  return { adminOnly: true, staffIds: [...new Set(admins.map((member) => safeStaff(member).id))], emailTo: [...new Set([...adminEmails, ...admins.map((member) => member.email).filter(Boolean)])] };
}

// Handlers are injected so reviewer isolation and authorization can be tested
// without starting the server or contacting the roster/provider services.
export function operationsHandlers({ workspace, policy, load, synthetic, roster }) {
  const allowed = (staff) => { if (!staff?.ok || staff.role === "reviewer") throw Object.assign(new Error("Staff sign-in required."), { status: 403 }); };
  const admin = (staff) => { allowed(staff); if (!adminRole(staff.role)) throw Object.assign(new Error("Admin access required."), { status: 403 }); };
  return {
    async snapshot(staff) {
      if (staff?.ok && staff.role === "reviewer") return synthetic(staff);
      allowed(staff);
      return operationsSnapshot({ ...(await load(staff)), staff, replyPolicy: await policy.get(), state: await workspace.get(staff) });
    },
    async mutate(staff, phone, body = {}) {
      allowed(staff);
      if (body.action === "assign") admin(staff);
      return workspace.mark(staff, phone, body.action, body.through, { assignee: { id: body.assigneeId, name: body.assigneeName }, roster: body.action === "assign" ? await roster() : [] });
    },
    async getPolicy(staff) { admin(staff); return policy.get(); },
    async setPolicy(staff, body) { admin(staff); return policy.set(body); }
  };
}
