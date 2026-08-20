// Vercel entry point for the existing Express application.
// The original server also creates a Socket.IO HTTP server. Vercel handles
// HTTP requests as serverless functions, so its listen() call must be disabled
// here. Realtime Socket.IO classroom features remain on the Render deployment.
const http = require('http');
const originalListen = http.Server.prototype.listen;
http.Server.prototype.listen = function () { return this; };

let app;
try {
  app = require('../server');
} finally {
  http.Server.prototype.listen = originalListen;
}

module.exports = app;
