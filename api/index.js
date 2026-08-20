// Vercel entry point for the LMS application.
// Render keeps the normal Node/Socket.IO server. On Vercel the HTTP
// application is exported as a serverless function and classroom realtime
// is provided by Supabase Realtime from the browser.
const http = require('http');
const { handleUpload } = require('@vercel/blob/client');

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
  const key = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  res.setHeader('Cache-Control', 'no-store');
  res.json({ url, key, enabled: Boolean(url && key) });
});

// Secure client-upload token exchange. The actual file goes directly from
// the browser to Vercel Blob, avoiding Vercel's 4.5 MB Function body limit.
app.post('/api/blob-upload', async (req, res) => {
  if (!req.session?.adminUser) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const jsonResponse = await handleUpload({
      body: req.body,
      request: req,
      onBeforeGenerateToken: async () => ({
        allowedContentTypes: ['image/*', 'video/*', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
        maximumSizeInBytes: 500 * 1024 * 1024,
        addRandomSuffix: true,
        tokenPayload: JSON.stringify({ adminId: req.session.adminUser.id })
      })
    });
    res.json(jsonResponse);
  } catch (e) {
    console.error('Vercel Blob token error:', e);
    res.status(400).json({ error: e.message || 'Blob upload token error' });
  }
});

module.exports = app;
