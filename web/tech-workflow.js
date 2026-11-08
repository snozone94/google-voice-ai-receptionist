const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function initializeTechCoordination({ home, headers, isWorker }) {
  const panel = document.createElement('details');
  panel.className = 'workspace-section'; panel.id = 'techCoordination';
  panel.innerHTML = '<summary>Team & dispatch notes</summary><p class="muted">Internal technician coordination · not customer texts</p><p role="status" data-status></p><button type="button" data-refresh>Refresh team</button><div data-team></div><form><label>Internal note or backup request<textarea name="message" maxlength="2000" required rows="2"></textarea></label><button type="submit" name="kind" value="dispatch_note">Save note</button><button type="submit" name="kind" value="tech_ping">Ping team</button></form><div data-notes></div>';
  home.querySelector('#homeSummary').after(panel);
  let busy = false, generation = 0, lastCredential = '', roster = null;
  const status = panel.querySelector('[data-status]');
  const credential = () => { const h = new Headers(headers()); return h.get('x-staff-code') || h.get('x-admin-pin') || ''; };
  const authorize = () => {
    const current = credential();
    if (current !== lastCredential || !isWorker()) {
      generation++; lastCredential = current; roster = null; busy = false;
      panel.querySelector('[data-team]').replaceChildren(); panel.querySelector('[data-notes]').replaceChildren();
      panel.querySelector('form').reset(); status.textContent = ''; panel.open = false;
    }
    panel.hidden = !isWorker(); return isWorker();
  };
  async function api(path, body) {
    const r = await fetch('/api/tech-workflow' + path, { method: body ? 'POST' : 'GET', headers: { ...headers(), ...(body ? { 'Content-Type': 'application/json' } : {}) }, signal: AbortSignal.timeout(12000), ...(body ? { body: JSON.stringify(body) } : {}) });
    const data = await r.json(); if (!r.ok) throw Error(data.error || 'Team coordination unavailable.'); return data;
  }
  async function refresh() {
    if (!authorize() || !panel.open || busy || document.hidden) return;
    const version = generation;
    try {
      const [team, inbox] = await Promise.all([api('/team'), api('/inbox')]);
      if (version !== generation || !isWorker() || credential() !== lastCredential) return;
      roster = team;
      const labels = { available: 'Ready', on_call: 'On call', not_available: 'Unavailable' };
      panel.querySelector('[data-team]').innerHTML = '<h3>Technicians</h3>' + (team.technicians || []).map(t => `<p><strong>${escape(t.name)}</strong> · ${escape(labels[t.availability] || 'Offline')} ${t.id !== team.current_tech_id ? `<button type="button" data-ping="${escape(t.id)}">Ping</button>` : ''}</p>`).join('');
      const notes = inbox.notes || [];
      panel.querySelector('[data-notes]').innerHTML = '<h3>Shared notes</h3>' + (notes.length ? notes.slice(0,20).map(n => `<article class="list-card"><strong>${escape(n.sender_name || 'Technician')}</strong>${n.job_id ? `<span> · ${escape(n.job_id)}</span>` : ''}<p>${escape(n.message)}</p>${(n.responses || []).map(r => `<p>${escape(r.name)}: ${r.action === 'accept' ? 'Can help' : 'Cannot help'}</p>`).join('')}${!n.read ? `<button type="button" data-note="${escape(n.id)}" data-action="read">Mark read</button>` : ''}${n.type === 'tech_ping' && !n.response && n.sender_tech_id !== team.current_tech_id ? ['accept','decline'].map(action => `<button type="button" data-note="${escape(n.id)}" data-action="${action}">${action === 'accept' ? 'Can help' : 'Cannot help'}</button>`).join('') : ''}${n.response ? `<p>${n.response === 'accept' ? 'You can help' : 'You cannot help'}</p>` : ''}</article>`).join('') : '<p>No internal notes yet.</p>');
      status.textContent = '';
    } catch (error) { if (version === generation) status.textContent = error.message; }
  }
  async function update(path, body) {
    if (!authorize() || busy) return;
    const version = generation; busy = true; panel.querySelectorAll('button').forEach(b => b.disabled = true);
    try {
      await api(path, body);
      if (version !== generation || credential() !== lastCredential) return;
      if (path === '/inbox') panel.querySelector('form').reset();
      busy = false; await refresh(); status.textContent = 'Saved to the shared technician inbox.';
    } catch (error) { if (version === generation) status.textContent = error.message; }
    finally { if (version === generation) { busy = false; panel.querySelectorAll('button').forEach(b => b.disabled = false); } }
  }
  panel.addEventListener('toggle', () => { if (panel.open) void refresh(); });
  panel.addEventListener('submit', event => {
    event.preventDefault(); const message = panel.querySelector('textarea').value.trim();
    if (message) void update('/inbox', { message, type: event.submitter?.value === 'tech_ping' ? 'tech_ping' : 'dispatch_note' });
  });
  panel.addEventListener('click', event => {
    const b = event.target.closest('button'); if (!b) return;
    if (b.hasAttribute('data-refresh')) void refresh();
    if (b.dataset.ping && roster?.technicians?.some(t => t.id === b.dataset.ping)) void update('/inbox', { type: 'tech_ping', target_tech_id: b.dataset.ping, message: 'Please check DDD Dispatch or Tech Assist. A teammate needs help.' });
    if (b.dataset.note) void update(`/inbox/${encodeURIComponent(b.dataset.note)}/response`, { action: b.dataset.action });
  });
  const timer = setInterval(() => { authorize(); if (panel.open) void refresh(); }, 10000);
  window.addEventListener('pagehide', () => clearInterval(timer), { once: true });
  authorize(); return { syncAccess: authorize };
}
