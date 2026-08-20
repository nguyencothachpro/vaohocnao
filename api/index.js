// Vercel entry point. The application and its Vercel-specific APIs are
// registered in server.js before the final 404 handler.
const http=require('http');
const originalListen=http.Server.prototype.listen;
http.Server.prototype.listen=function(){return this;};
let app;
try{app=require('../server')}finally{http.Server.prototype.listen=originalListen;}
module.exports=app;
