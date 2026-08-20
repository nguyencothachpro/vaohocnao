// Vercel entry point for the LMS application.
// Render keeps the normal Node/Socket.IO server. This entry point is only
// for Vercel HTTP requests; realtime classroom Socket.IO remains on Render.
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
