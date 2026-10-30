// Pure adapters for both current and phase-two operations responses.
export function phoneKey(value = '') {
  if (/[a-z@]/i.test(String(value))) return '';
  const digits = String(value).replace(/\D/g, '');
  return digits.length === 10 ? `+1${digits}` : /^[1-9]\d{7,14}$/.test(digits) ? `+${digits}` : '';
}
export function ownerLabel(record = {}) {
  return record.assigneeName || record.assignedTo?.name || (typeof record.assignedTo === 'string' ? record.assignedTo : '') || record.ownerName || 'Unassigned';
}
export function bookingOwnerLabel(booking = {}) {
  const assignee = booking.assignee;
  return (typeof assignee === 'string' ? assignee.trim() : assignee?.name || assignee?.displayName) || ownerLabel(booking);
}
export function bookingRequestedLabel(booking = {}) {
  return booking.serviceTime || booking.service_time || booking.appointmentAt || booking.scheduledAt || booking.preferredTime || booking.appointment_at || booking.scheduled_at || booking.preferred_time || booking.requestedFor || booking.timeWindow || booking.requestedTime || 'ASAP / not set';
}
export function bookingStatusValue(booking = {}) {
  return [booking.platformStatus, booking.status, booking.externalStatus, booking.dddStatus, booking.dispatchStatus, booking.state].find(value => typeof value === 'string' && value.trim()) || 'Requested';
}
export function bookingStatusLabel(booking = {}) {
  const raw = bookingStatusValue(booking).trim();
  const key = raw.normalize('NFKC').toLowerCase().replace(/[^a-z0-9]+/g, '');
  if (['complete', 'completed', 'cleared', 'done', 'finished', 'resolved', 'techniciancompleted', 'techniciancomplete', 'techcompleted', 'techcomplete', 'jobcompleted', 'servicecompleted'].includes(key)) return 'Completed';
  if (['cancelled', 'canceled', 'customercancelled', 'customercanceled'].includes(key)) return 'Canceled';
  if (['failed', 'rejected', 'declined', 'closed'].includes(key)) return key === 'declined' ? 'Rejected' : key[0].toUpperCase() + key.slice(1);
  return raw;
}
export function needsReply(record = {}) {
  return Boolean(record.needsReply ?? record.needsFollowUp);
}
export function isOpenBooking(booking = {}) {
  return !['Completed', 'Canceled', 'Failed', 'Rejected', 'Closed'].includes(bookingStatusLabel(booking));
}
export function mergeConversations(conversations = [], calls = [], bookings = []) {
  const grouped = new Map();
  for (const item of conversations) {
    const key = conversationPhone(item);
    if (!key) continue;
    const previous = grouped.get(key);
    if (!previous) { grouped.set(key, { ...item, phone: key }); continue; }
    const newer = Date.parse(item.lastMessageAt || item.updatedAt || 0) > Date.parse(previous.lastMessageAt || previous.updatedAt || 0);
    const messages = [...(previous.messages || []), ...(item.messages || [])];
    const unique = new Map(messages.map(message => [message.messageSid || message.id || JSON.stringify([message.createdAt, message.direction, message.body || message.text]), message]));
    grouped.set(key, { ...(newer ? previous : item), ...(newer ? item : previous), phone: key, unread: Math.max(Number(previous.unread) || 0, Number(item.unread) || 0), needsReply: needsReply(previous) || needsReply(item), messages: [...unique.values()].sort((a, b) => Date.parse(a.createdAt || 0) - Date.parse(b.createdAt || 0)) });
  }
  for (const record of [...calls, ...bookings]) {
    const key = conversationPhone({ ...record, phone: record.caller || record.phone });
    if (key && !grouped.has(key)) grouped.set(key, { phone: key, customerName: record.customerName || record.customer_name || record.callerName || (bookings.includes(record) ? record.name : undefined), messages: [], lastMessageAt: record.startedAt || record.createdAt });
  }
  for (const [key, item] of grouped) {
    const unique = (rows, id) => [...new Map(rows.map(row => [row[id] || row.id || JSON.stringify(row), row])).values()];
    grouped.set(key, { ...item, calls: unique([...(item.calls || []), ...calls.filter(call => phoneKey(call.caller || call.phone || call.from || call.customerPhone) === key)], 'callId'), bookings: unique([...(item.bookings || []), ...bookings.filter(booking => conversationPhone(booking) === key)], 'bookingId') });
  }
  return [...grouped.values()];
}
export function newestUnreadIndex(conversation = {}) {
  const messages = conversation.messages || [];
  if (!Number(conversation.unread)) return -1;
  if (conversation.firstUnreadAt) {
    const first = Date.parse(conversation.firstUnreadAt);
    const index = messages.findIndex(message => message.direction === 'inbound' && Date.parse(message.createdAt) >= first);
    if (index >= 0) return index;
  }
  for (let index = messages.length - 1; index >= 0; index--) {
    if (messages[index].direction === 'inbound') return index;
  }
  return -1;
}
export function workspaceSummary(activity = {}, now = new Date()) {
  const conversations = mergeConversations(activity.conversations || []);
  const todayOpenBookings = (activity.bookings || []).filter(booking => {
    const time = bookingRequestedLabel(booking);
    const raw = time === 'ASAP / not set' ? booking.createdAt : time;
    const date = new Date(raw);
    return isOpenBooking(booking) && !Number.isNaN(date.getTime()) && date.toDateString() === now.toDateString();
  }).length;
  return { activeCalls: (activity.liveCalls || activity.activeCalls || []).length, unreadMessages: conversations.reduce((sum, item) => sum + (Number(item.unread) || 0), 0), needsReply: conversations.filter(needsReply).length, openBookings: (activity.bookings || []).filter(isOpenBooking).length, todayOpenBookings, ...activity.summary };
}

export function conversationPhone(item = {}) {
  return [item.phone, item.customerPhone, item.customer_phone, item.from, item.customer].map(phoneKey).find(Boolean) || '';
}
export function canWork(staff) {
  return Boolean(staff?.ok && staff.role !== 'reviewer');
}
export function ownershipActions(staff, conversation = {}) {
  const capabilities = conversation.capabilities || {};
  const admin = ['admin', 'administrator', 'owner', 'manager', 'super_admin', 'dispatch_admin'].includes(String(staff?.role || '').toLowerCase());
  return {
    assign: canWork(staff) && capabilities.assign === true,
    claim: canWork(staff) && capabilities.claim === true,
    release: canWork(staff) && capabilities.release === true,
    unassign: canWork(staff) && admin && capabilities.unassign === true
  };
}
export function workspaceState(operations, staff = operations?.staff) {
  const empty = { calls: [], leads: [], bookings: [], conversations: [], insights: null, team: [], liveCalls: [], tasks: [], summary: null, replyPolicy: null, health: null, attention: null };
  if (!staff?.ok) return empty;
  const result = { ...empty, ...operations, staff, tasks: operations?.tasks ?? null };
  if (!['admin', 'administrator', 'owner', 'manager', 'super_admin', 'dispatch_admin'].includes(String(staff.role).toLowerCase())) result.health = null;
  if (!canWork(staff)) result.team = [];
  return result;
}
export function notificationDestination(data = {}) {
  const type = String(data.type || data.eventType || '').toLowerCase();
  if (/booking/.test(type)) return { tab: 'Bookings', phone: '' };
  if (/sms|text|message|reply/.test(type)) return { tab: 'Inbox', phone: conversationPhone({ phone: data.phone || data.customerPhone, from: /delivery/.test(type) ? data.to : data.from }) };
  if (/call|hangup|openai|live/.test(type)) return { tab: 'Calls', phone: '' };
  return { tab: 'Home', phone: '' };
}
export function validateReplyPolicy(value) {
  const remindAfterMinutes = Number(value.remindAfterMinutes);
  const escalateAfterMinutes = Number(value.escalateAfterMinutes);
  if (!Number.isInteger(remindAfterMinutes) || remindAfterMinutes < 1 || remindAfterMinutes > 60 || !Number.isInteger(escalateAfterMinutes) || escalateAfterMinutes <= remindAfterMinutes || escalateAfterMinutes > 1440) throw new Error('Reminder must be 1–60 minutes. Escalation must be later, within 24 hours.');
  return { remindAfterMinutes, escalateAfterMinutes };
}

// Group for display only: ownership, unread and follow-up state stay untouched.
export function splitHomeTasks(tasks = []) {
  const current = [], historical = [];
  for (const task of tasks) (task.historical === true ? historical : current).push(task);
  return { current, historical };
}
export function taskWaitLabel(minutesWaiting) {
  if (minutesWaiting == null || minutesWaiting === '' || !Number.isFinite(Number(minutesWaiting))) return 'Waiting for follow-up';
  const minutes = Math.max(0, Math.floor(Number(minutesWaiting)));
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes} min waiting`;
  if (minutes < 1440) {
    const hours = Math.floor(minutes / 60), remaining = minutes % 60;
    return `${hours} ${hours === 1 ? 'hour' : 'hours'}${remaining ? ` ${remaining} min` : ''} waiting`;
  }
  const days = Math.floor(minutes / 1440);
  return `${days} ${days === 1 ? 'day' : 'days'} waiting`;
}
