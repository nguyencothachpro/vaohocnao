(() => {
  // Socket.IO-compatible adapter backed by Supabase Realtime.
  // Keeps classroom.js and classroom-permissions.js unchanged on Vercel.
  const C = window.CLASSROOM || {};
  const handlers = new Map();
  const pending = [];
  const clientId = (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now());

  const socket = {
    id: clientId,
    on(event, fn) {
      if (!handlers.has(event)) handlers.set(event, []);
      handlers.get(event).push(fn);
      return socket;
    },
    emit(event, payload = {}) {
      if (event === 'classroom:join') return join(payload);
      if (!channelReady) { pending.push([event, payload]); return true; }
      return routeEmit(event, payload);
    },
    off(event, fn) {
      const list = handlers.get(event) || [];
      handlers.set(event, list.filter(x => x !== fn));
      return socket;
    }
  };

  function fire(event, payload) {
    (handlers.get(event) || []).slice().forEach(fn => {
      try { fn(payload); } catch (e) { console.error('[classroom realtime]', event, e); }
    });
  }

  let channel = null;
  let channelReady = false;
  let joined = false;
  let selfInfo = { id: clientId, userId: C.currentUserId || null, user: C.currentUser || 'Thành viên', role: C.isTeacher ? 'teacher' : 'student' };

  async function getConfig() {
    const r = await fetch('/api/realtime-config', { credentials: 'same-origin', cache: 'no-store' });
    if (!r.ok) throw new Error('Không lấy được cấu hình realtime');
    const cfg = await r.json();
    if (!cfg.enabled) throw new Error('Vercel chưa được cấu hình Supabase Realtime');
    return cfg;
  }

  function presenceList() {
    if (!channel) return [];
    const state = channel.presenceState();
    const list = [];
    Object.keys(state || {}).forEach(key => (state[key] || []).forEach(item => list.push(item)));
    return list;
  }

  function syncPresence() {
    const list = presenceList();
    fire('classroom:presence', { count: list.length });
    fire('classroom:presence-list', list);
  }

  async function setupChannel(room) {
    const cfg = await getConfig();
    const client = window.supabase.createClient(cfg.url, cfg.key, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
    });

    channel = client.channel('classroom:' + String(room).toUpperCase(), {
      config: { broadcast: { self: false, ack: false }, presence: { key: clientId } }
    });

    channel.on('presence', { event: 'sync' }, syncPresence);
    channel.on('presence', { event: 'join' }, ({ newPresences }) => {
      syncPresence();
      (newPresences || []).forEach(p => { if (p.id !== clientId) fire('classroom:peer-joined', p); });
    });
    channel.on('presence', { event: 'leave' }, ({ leftPresences }) => {
      syncPresence();
      (leftPresences || []).forEach(p => fire('classroom:peer-left', { id: p.id }));
    });

    const events = [
      'classroom:board', 'classroom:clear', 'classroom:page', 'classroom:material-open',
      'classroom:chat', 'classroom:teacher-stream', 'classroom:request-stream',
      'classroom:write-request', 'classroom:write-grant', 'classroom:write-revoke-all',
      'classroom:write-status', 'classroom:permissions', 'classroom:question-mode',
      'classroom:question', 'webrtc:offer', 'webrtc:answer', 'webrtc:ice'
    ];
    events.forEach(event => channel.on('broadcast', { event }, ({ payload }) => {
      if (!payload || payload.senderId === clientId) return;
      if (event === 'webrtc:offer' || event === 'webrtc:answer' || event === 'webrtc:ice') {
        if (payload.to && payload.to !== clientId) return;
      }
      fire(event, payload);
    }));

    await new Promise((resolve, reject) => {
      channel.subscribe(status => {
        if (status === 'SUBSCRIBED') resolve();
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') reject(new Error('Supabase Realtime: ' + status));
      });
    });

    channelReady = true;
    await channel.track(selfInfo);
    syncPresence();
    fire('classroom:permissions', { canWrite: !!C.isTeacher, isTeacher: !!C.isTeacher });

    while (pending.length) {
      const [event, payload] = pending.shift();
      routeEmit(event, payload);
    }
  }

  async function join(payload) {
    if (joined) return;
    joined = true;
    selfInfo = {
      id: clientId,
      userId: payload.userId || C.currentUserId || null,
      user: payload.user || C.currentUser || 'Thành viên',
      role: payload.role || (C.isTeacher ? 'teacher' : 'student')
    };
    try {
      await setupChannel(payload.room || C.room);
      if (!C.isTeacher) socket.emit('classroom:request-stream', { id: clientId });
    } catch (e) {
      console.error(e);
      const el = document.getElementById('presenceText');
      if (el) el.textContent = 'Realtime chưa sẵn sàng: ' + e.message;
    }
  }

  function send(event, payload) {
    if (!channel) return;
    channel.send({
      type: 'broadcast', event,
      payload: { ...payload, senderId: clientId, senderUserId: selfInfo.userId, senderUser: selfInfo.user }
    }).catch(e => console.error('[classroom realtime send]', event, e));
  }

  function routeEmit(event, payload = {}) {
    if (event === 'classroom:chat') {
      fire(event, { ...payload, user: payload.user || selfInfo.user, at: Date.now() });
      return send(event, payload);
    }
    if (event === 'classroom:write-request') return send(event, { userId: payload.userId || selfInfo.userId, user: payload.user || selfInfo.user });
    if (event === 'classroom:write-grant') return send('classroom:write-status', payload);
    if (event === 'classroom:write-revoke-all') return send(event, {});
    return send(event, payload);
  }

  window.io = function () { return socket; };
  window.classroomSocket = socket;
})();
