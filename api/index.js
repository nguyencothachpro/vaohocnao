// Vercel entry point for the LMS application.
// Render keeps the normal Node/Socket.IO server. On Vercel the HTTP
// application is exported as a serverless function and classroom realtime
// is provided by Supabase Realtime from the browser.
const http = require('http');

const originalListen = http.Server.prototype.listen;
http.Server.prototype.listen = function () { return this; };

let app;
try {
  app = require('../server');
} finally {
  http.Server.prototype.listen = originalListen;
}

// Public browser configuration only. Never expose DATABASE_URL,
// service-role/secret keys, SESSION_SECRET or other backend secrets here.
app.get('/api/realtime-config', (req, res) => {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const key = process.env.SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  res.setHeader('Cache-Control', 'no-store');
  res.json({ url, key, enabled: Boolean(url && key) });
});

module.exports = app;
