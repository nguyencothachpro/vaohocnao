require('dotenv').config();
const express = require('express');
const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);
const methodOverride = require('method-override');
const path = require('path');

const db = require('./config/db');
const { attachUser } = require('./middleware/auth');
const { formatVND, formatDate, embedVideoInfo, embedPdfUrl } = require('./utils');
const Settings = require('./models/Settings');
const NavMenuItem = require('./models/NavMenuItem');
const Popup = require('./models/Popup');

const app = express();
const PORT = process.env.PORT || 3000;

// An toan: khong de 1 loi bat dong bo don le (vd: query DB loi vi chua migrate)
// lam sap toan bo server. Chi ghi log loi, khong tat process.
process.on('unhandledRejection', (reason) => {
  console.error('>>> Unhandled Rejection (da chan, server van chay tiep):', reason);
});
process.on('uncaughtException', (err) => {
  console.error('>>> Uncaught Exception (da chan, server van chay tiep):', err);
});

// Tu dong boc moi route handler (get/post/put/delete) bang try/catch,
// de loi bat dong bo (vd: query DB loi vi chua chay migrate) tra ve trang 500
// thay vi treo request mai mai hoac lam sap toan bo server.
const wrapAsync = (fn) => {
  if (typeof fn !== 'function' || fn.length >= 4) return fn; // bo qua middleware loi (err,req,res,next)
  return function (req, res, next) {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
['get', 'post', 'put', 'delete', 'patch', 'all'].forEach((method) => {
  const original = express.Router[method];
  express.Router[method] = function (path, ...handlers) {
    return original.call(this, path, ...handlers.map(wrapAsync));
  };
});

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.json({ limit: '50mb' }));
app.use(methodOverride('_method'));
app.use(express.static(path.join(__dirname, 'public')));

app.use(session({
  store: new pgSession({ pool: db.pool, tableName: 'session' }),
  secret: process.env.SESSION_SECRET || 'thay-doi-chuoi-bi-mat-nay',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 30 * 24 * 60 * 60 * 1000 } // 30 ngay
}));

app.use(attachUser);

// Bien dung chung trong moi view EJS
app.use((req, res, next) => {
  res.locals.formatVND = formatVND;
  res.locals.formatDate = formatDate;
  res.locals.embedVideoInfo = embedVideoInfo;
  res.locals.embedPdfUrl = embedPdfUrl;
  res.locals.path = req.path;
  next();
});

// Cac doan chu tren web (ten trang, tieu de banner...) doc tu database
// de quan tri vien tu sua duoc trong Admin > Cai dat chung, khong can sua code
app.use(async (req, res, next) => {
  try {
    const [all, navItems, popup] = await Promise.all([
      Settings.getAll(),
      NavMenuItem.active(),
      Popup.activeOne()
    ]);
    res.locals.site = {
      site_name_1: all.site_name_1 || 'Học',
      site_name_2: all.site_name_2 || 'Online',
      hero_title: all.hero_title || 'Học mọi lúc, mọi nơi',
      hero_subtitle: all.hero_subtitle || 'Nền tảng khóa học video trực tuyến với hàng trăm bài giảng chất lượng.',
      footer_text: all.footer_text || 'HọcOnline — Hệ thống quản lý học tập (LMS)'
    };
    res.locals.navItems = navItems;
    res.locals.activePopup = popup || null;

    // Neu request den tu 1 ten mien phu da cau hinh, tu dong mo thang vao trang duoc chi dinh
    const customDomain = (all.custom_domain || '').trim().toLowerCase();
    if (customDomain && req.hostname && req.hostname.toLowerCase() === customDomain && req.path === '/') {
      return res.redirect(all.custom_domain_path || '/truyen');
    }
  } catch (e) {
    res.locals.site = {
      site_name_1: 'Học', site_name_2: 'Online',
      hero_title: 'Học mọi lúc, mọi nơi',
      hero_subtitle: 'Nền tảng khóa học video trực tuyến với hàng trăm bài giảng chất lượng.',
      footer_text: 'HọcOnline — Hệ thống quản lý học tập (LMS)'
    };
    res.locals.navItems = [];
    res.locals.activePopup = null;
  }
  next();
});

app.use('/', require('./routes/site'));
app.use('/', require('./routes/auth'));
app.use('/', require('./routes/student'));
app.use('/webhook', require('./routes/webhook'));
app.use('/', require('./routes/classroom'));
app.use('/admin', require('./routes/admin'));

app.use((req, res) => res.status(404).render('404'));

app.use((err, req, res, next) => {
  console.error(err);
  // Hien chi tiet loi that ra man hinh (thay vi chi noi chung chung) de de debug nhanh
  // ma khong can vao Render Logs moi lan. Chap nhan duoc vi day la du an dang phat trien,
  // chi co admin duy nhat truy cap.
  res.status(500).send(
    `<pre style="white-space:pre-wrap;font-family:monospace;padding:20px;color:#b5433a">` +
    `Đã xảy ra lỗi máy chủ.\n\n` +
    `Trang: ${req.method} ${req.originalUrl}\n` +
    `Lỗi: ${err.message}\n\n` +
    `Chi tiết kỹ thuật:\n${err.stack || ''}` +
    `</pre>`
  );
});

const http = require('http');
const { WebSocketServer } = require('ws');
const httpServer = http.createServer(app);
const wss = new WebSocketServer({ server: httpServer, path: '/ws/classroom' });
const rooms = new Map();
wss.on('connection',(ws,req)=>{
  const url=new URL(req.url,'http://localhost'); const room=(url.searchParams.get('room')||'').toUpperCase(); const role=url.searchParams.get('role')||'student';
  if(!rooms.has(room)) rooms.set(room,new Set()); const peers=rooms.get(room); peers.add(ws); ws._room=room; ws._role=role;
  ws.send(JSON.stringify({type:'room-state',role,count:peers.size}));
  for(const peer of peers){ if(peer!==ws && peer.readyState===1) peer.send(JSON.stringify({type:'peer-joined',role})); }
  ws.on('message',data=>{ for(const peer of peers){ if(peer!==ws && peer.readyState===1) peer.send(data.toString()); } });
  ws.on('close',()=>{peers.delete(ws); if(!peers.size) rooms.delete(room); else for(const peer of peers){if(peer.readyState===1)peer.send(JSON.stringify({type:'peer-left'}));}});
});
httpServer.listen(PORT, () => { console.log(`>>> LMS dang chay tai http://localhost:${PORT}`); });
