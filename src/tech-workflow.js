import express from 'express';
// Forward only the current person's credential, never the server's privileged team token.
export function workflowBase(authUrl) {
  let url;
  try { url = new URL(authUrl); } catch { return ''; }
  if (url.protocol !== 'https:' || url.username || url.password || !/\/tech-auth-test\/?$/.test(url.pathname)) return '';
  url.pathname = url.pathname.replace(/\/tech-auth-test\/?$/, '/tech-workflow');
  url.search = ''; url.hash = '';
  return url.toString().replace(/\/$/, '');
}

export function createWorkflowClient({ authUrl, fetchImpl = fetch }) {
  const base = workflowBase(authUrl);
  return async (code, path, body) => {
    if (!base) throw Object.assign(new Error('Shared technician coordination is not configured.'), { status: 503 });
    if (!code) throw Object.assign(new Error('Sign in with your individual technician code.'), { status: 401 });
    if (!/^\/(?:team|inbox|inbox\/[A-Za-z0-9_-]+\/response)$/.test(path)) throw Object.assign(new Error('Unsupported coordination action.'), { status: 400 });
    if (body && path === '/team') throw Object.assign(new Error('Team status is read-only here.'), { status: 405 });
    let response;
    try {
      response = await fetchImpl(base + path, {
        method: body ? 'POST' : 'GET', redirect: 'error', signal: AbortSignal.timeout(10000),
        headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'X-DDD-Tech-Token': code },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
    } catch { throw Object.assign(new Error('Team coordination could not sync. Try again.'), { status: 502 }); }
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      const message = [401,403].includes(response.status) ? 'Use your individual DDD technician code. Existing WordPress permissions still apply.' : response.status === 404 ? 'The shared WordPress workflow needs an update.' : 'Team coordination could not save or refresh. Try again.';
      throw Object.assign(new Error(message), { status: response.status });
    }
    if (!data || typeof data !== 'object') throw Object.assign(new Error('Invalid team coordination response.'), { status: 502 });
    return data;
  };
}

export function mountTechWorkflow(app, { staffOnly, authUrl, fetchImpl }) {
  const request = createWorkflowClient({ authUrl, fetchImpl });
  const handler = (path, write = false) => async (req, res) => {
    res.set('Cache-Control', 'no-store, private');
    if (res.locals.staff?.role === 'reviewer') return res.status(403).json({ error: 'Technician sign-in required.' });
    try {
      const code = String(req.get('x-staff-code') || req.get('x-admin-pin') || '').trim();
      // Copy an allowlist only. Client-provided sender, roles and customerVisible are never forwarded.
      const payload = req.body || {};
      if (write && path === '/inbox' && (typeof payload.message !== 'string' || !payload.message.trim() || payload.message.length > 2000)) throw Object.assign(new Error('Enter a note of up to 2000 characters.'), { status: 400 });
      const body = !write ? undefined : path === '/inbox' ? {
        message: payload.message.trim(), job_id: String(payload.job_id || '').slice(0,120),
        type: payload.type === 'tech_ping' ? 'tech_ping' : 'dispatch_note',
        target_tech_id: String(payload.target_tech_id || '').slice(0,120), priority: payload.type === 'tech_ping' ? 'urgent' : 'normal',
      } : { action: ['read','accept','decline'].includes(payload.action) ? payload.action : '' };
      const destination = path === '/response' ? `/inbox/${encodeURIComponent(req.params.note)}/response` : path;
      res.json(await request(code, destination, body));
    } catch (error) { res.status(error.status || 502).json({ error: error.message }); }
  };
  app.get('/api/tech-workflow/team', staffOnly, handler('/team'));
  app.get('/api/tech-workflow/inbox', staffOnly, handler('/inbox'));
  app.post('/api/tech-workflow/inbox', express.json({ limit: '16kb' }), staffOnly, handler('/inbox', true));
  app.post('/api/tech-workflow/inbox/:note/response', express.json({ limit: '16kb' }), staffOnly, handler('/response', true));
}
