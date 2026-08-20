// Vercel entry point for the existing Express application.
// Vercel runs this as a serverless function. Database credentials and
// SESSION_SECRET must be configured in Vercel Project Settings > Environment Variables.
const app = require('../server');

module.exports = app;
