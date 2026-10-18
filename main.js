// BMS SY — غلاف سطح المكتب (Electron)
// يشغّل واجهة النظام عبر خادم محلي http://127.0.0.1 (كما في المتصفّح)
// حتى تعمل قاعدة بيانات Firestore بشكل طبيعي، بدل بروتوكول file:// الذي يسبب
// تعذّر الاتصال (timeout) وشاشة زرقاء معلّقة.
const { app, BrowserWindow, shell, Menu, session, ipcMain } = require('electron');
const path = require('path');
const http = require('http');
const fs = require('fs');

const APP_NAME = 'BMS SY';

// أنواع الملفات للمخدّر المحلي
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.txt': 'text/plain; charset=utf-8',
  '.toml': 'text/plain; charset=utf-8',
  '.wasm': 'application/wasm'
};

// منع تسجيل PWA Service Worker داخل تطبيق سطح المكتب (يمنع التخزين القديم ومشاكل التحميل)
function disableServiceWorker(ses) {
  try {
    ses.serviceWorker.clearStorageData().catch(function () {});
  } catch (e) { /* ignore */ }
  try {
    ses.webRequest.onBeforeRequest(function (details, callback) {
      if (typeof details.url === 'string' && /(^|\/)sw\.js(\?|$)/i.test(details.url)) {
        callback({ cancel: true });
      } else {
        callback({});
      }
    });
  } catch (e) { /* ignore */ }
}

// خادم محلي بسيط لخدمة ملفات التطبيق على 127.0.0.1 (port ديناميكي)
function startLocalServer() {
  return new Promise(function (resolve) {
    const server = http.createServer(function (req, res) {
      try {
        let urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
        if (urlPath === '/') urlPath = '/index.html';
        const filePath = path.normalize(path.join(__dirname, urlPath));
        // منع الخروج خارج مجلد التطبيق (أمان)
        if (!filePath.startsWith(__dirname)) { res.statusCode = 403; res.end('Forbidden'); return; }
        fs.readFile(filePath, function (err, data) {
          if (err) { res.statusCode = 404; res.end('Not found'); return; }
          const ext = path.extname(filePath).toLowerCase();
          res.setHeader('Content-Type', MIME[ext] || 'application/octet-stream');
          res.setHeader('Cache-Control', 'no-store');
          res.end(data);
        });
      } catch (e) { res.statusCode = 500; res.end('Error'); }
    });
    // ربط على 127.0.0.1 فقط (آمن، غير مكشوف للشبكة)
    server.listen(0, '127.0.0.1', function () {
      resolve({ server: server, port: server.address().port });
    });
  });
}

let serverRef = null;

// ============================================================
//  نظام تنزيل التحديثات داخل التطبيق + التثبيت التلقائي
// ------------------------------------------------------------
//  يستخدم session.on('will-download'):
//    1. شريط تقدّم حقيقي (بايتات مستلمة / الإجمالي)
//    2. الحفظ في مجلد التنزيلات — بدون شريط تحميل في المتصفح
//    3. بعد الاكتمال: يغلق التطبيق ثم يشغّل ملف التثبيت تلقائياً
// ============================================================

// امتدادات الملفات المُثبِّتة المسموح تشغيلها تلقائياً بعد التنزيل
const INSTALL_EXT = ['.exe', '.msi', '.bat', '.cmd', '.msix'];
// حاويات مضغوطة: نفتحها للمستخدم بعد التنزيل (لا نشغّلها)
// امتدادات مُثبِّتة صامتة (NSIS / Inno Setup) — نمرّرها بلا واجهة
const SILENT_EXT = ['.exe'];

let _dl = null;        // التنزيل الجاري: { item, savePath, filename }
let _pending = null;   // طلب وارد من الواجهة: { filename, ts }

function sanitizeName(n) {
  let s = String(n || 'BMS-SY-update').replace(/[\\/:*?"<>|]+/g, '_').trim();
  if (!s) s = 'BMS-SY-update.exe';
  if (!path.extname(s)) s += '.exe';
  return s;
}

function activeWindow() {
  const list = BrowserWindow.getAllWindows();
  return list.length ? list[0] : null;
}

function sendTo(win, channel, payload) {
  try {
    if (win && !win.isDestroyed()) win.webContents.send(channel, payload);
  } catch (e) { /* ignore */ }
}

function sendAll(channel, payload) {
  BrowserWindow.getAllWindows().forEach(function (w) { sendTo(w, channel, payload); });
}

// اختيار مسار حفظ فريد (لا نكتب فوق ملف موجود)
function uniquePath(dir, name) {
  let p = path.join(dir, name);
  let k = 1;
  while (fs.existsSync(p)) {
    p = path.join(dir, name.replace(/(\.[^.]+)$/, ' (' + (k++) + ')$1'));
  }
  return p;
}

// تشغيل ملف التثبيت تلقائياً ثم إغلاق التطبيق
// ترتيب مهم: نشغّل المثبّت أولاً (منفصلاً عن العملية)، ثم نغلق التطبيق
// مع تأخير قصير — لأن app.quit() ينهي العملية ولا يُكمل بعدها شيء.
async function runInstaller(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  sendAll('upd:stage', { stage: 'installing', file: path.basename(filePath) });

  // مهلة قصيرة حتى تظهر رسالة «جارٍ التثبيت» للمستخدم قبل الإغلاق
  await new Promise(function (r) { setTimeout(r, 700); });

  let launched = false;
  try {
    if (INSTALL_EXT.indexOf(ext) >= 0) {
      // ملف تثبيت مباشر: نشغّله منفصلاً عن هذه العملية
      const args = (SILENT_EXT.indexOf(ext) >= 0) ? ['/SILENT'] : [];
      const child = require('child_process').spawn(filePath, args, {
        detached: true, stdio: 'ignore', windowsHide: false
      });
      child.on('error', function () { launched = false; });
      child.unref();
      launched = true;
    } else {
      // حاوية مضغوطة: نفتحها ليختار المستخدم الملف بدلنا
      shell.openPath(filePath);
      launched = true;
    }
  } catch (e) {
    launched = false;
  }

  if (!launched) {
    // فشل التشغيل: نفتح مجلد التنزيلات ليختار المستخدم الملف بنفسه
    try { shell.openPath(app.getPath('downloads')); } catch (e2) { /* ignore */ }
    return;
  }

  // نغلق التطبيق بعد إقلاع المثبّت حتى لا تُقفل ملفاتُنا ملفاتَالتثبيت
  await new Promise(function (r) { setTimeout(r, 1200); });
  try { app.exit(0); } catch (e) { try { app.quit(); } catch (e2) {} }
}

// ربط كل التنزيلات المؤتمتة داخل التطبيق
function setupNativeDownloader() {
  session.defaultSession.on('will-download', function (event, item) {
    let fname = '';
    try { fname = item.getFilename(); } catch (e) { /* ignore */ }

    // اسم الملف الذي طلبته الواجهة (أدقّ من اسم الرابط)
    let requested = null;
    if (_pending && (Date.now() - _pending.ts) < 30000) { requested = _pending.filename; _pending = null; }

    // إن لم يكن هناك طلب صريح، نقبل فقط ملفات تُشبه حزمة تحديث
    const ext = path.extname(fname).toLowerCase();
    const looksLikeUpdate = INSTALL_EXT.indexOf(ext) >= 0;
    if (!requested && !looksLikeUpdate) return;

    // إلغاء أي تنزيل سابق حتى لا يتزاحم اثنان
    if (_dl) { try { _dl.item.cancel(); } catch (e) { /* ignore */ } _dl = null; }

    const name = sanitizeName(requested || fname);
    const dir = app.getPath('downloads');
    try { if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true }); } catch (e) { /* ignore */ }
    const savePath = uniquePath(dir, name);
    try { item.setSavePath(savePath); } catch (e) { /* ignore */ }

    _dl = { item: item, savePath: savePath, filename: name };
    sendAll('upd:progress', {
      started: true, filename: name, total: 0, received: 0, percent: 0, stage: 'downloading'
    });

    item.on('updated', function (_ev, state) {
      if (state === 'interrupted') {
        _dl = null;
        sendAll('upd:error', { message: 'انقطع الاتصال أثناء التنزيل' });
        return;
      }
      let total = 0, got = 0;
      try { total = item.getTotalBytes(); got = item.getReceivedBytes(); } catch (e) { /* ignore */ }
      sendAll('upd:progress', {
        started: false, filename: name, total: total, received: got,
        percent: total > 0 ? Math.round((got / total) * 1000) / 10 : 0, stage: 'downloading'
      });
    });

    item.once('done', function (_ev, state) {
      _dl = null;
      if (state !== 'completed') {
        sendAll('upd:error', { message: 'فشل التنزيل' });
        return;
      }
      let size = 0;
      try { size = fs.statSync(savePath).size; } catch (e) { /* ignore */ }
      sendAll('upd:done', { ok: true, filename: name, savePath: savePath, size: size });
      runInstaller(savePath);
    });
  });

  // ----- رسائل الواجهة -----
  ipcMain.handle('upd:start', function (_e, payload) {
    const p = payload || {};
    const url = String(p.url || '').trim();
    if (!/^https?:\/\//i.test(url)) return { ok: false, error: 'رابط غير صالح' };
    try {
      // نحفظ الاسم المطلوب، ثم نطلق تنزيلاً حقيقياً عبر الجلسة
      _pending = { filename: sanitizeName(p.filename), ts: Date.now() };
      session.defaultSession.downloadURL(url);
      return { ok: true };
    } catch (e) {
      _pending = null;
      return { ok: false, error: String((e && e.message) || e) };
    }
  });

  ipcMain.handle('upd:cancel', function () {
    if (_dl) {
      try { _dl.item.cancel(); } catch (e) { /* ignore */ }
      _dl = null;
      sendAll('upd:error', { message: 'أُلغي التنزيل' });
      return { ok: true };
    }
    return { ok: false };
  });

  ipcMain.handle('upd:showFolder', function () {
    try { shell.openPath(app.getPath('downloads')); return { ok: true }; } catch (e) { return { ok: false }; }
  });
}

function createWindow(startUrl, localPort) {
  const win = new BrowserWindow({
    width: 1366,
    height: 850,
    minWidth: 980,
    minHeight: 640,
    title: APP_NAME,
    backgroundColor: '#0f172a',
    icon: path.join(__dirname, 'assets', 'icon.png'),
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      spellcheck: false
    }
  });

  // إخفاء شريط القوائم (نظام POS يعمل بملء الشاشة تقريباً)
  win.setMenuBarVisibility(false);

  // عند الظهور
  win.once('ready-to-show', () => win.show());

  // تحميل الواجهة من الخادم المحلي
  win.loadURL(startUrl);

  // فتح أي رابط خارجي في المتصفّح الافتراضي (Firebase Auth / WhatsApp / التتبّع)
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'ignore' };
  });

  // السماح بالتنقّل داخل الخادم المحلي فقط، وإرسال الروابط الخارجية للمتصفّح
  const localPrefix = 'http://127.0.0.1:' + localPort;
  win.webContents.on('will-navigate', (e, url) => {
    if (!url.startsWith(localPrefix)) {
      e.preventDefault();
      shell.openExternal(url);
    }
  });

  return win;
}

app.whenReady().then(async () => {
  app.setName(APP_NAME);
  disableServiceWorker(session.defaultSession);
  setupNativeDownloader();

  const srv = await startLocalServer();
  serverRef = srv.server;

  createWindow('http://127.0.0.1:' + srv.port + '/index.html', srv.port);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow('http://127.0.0.1:' + srv.port + '/index.html', srv.port);
    }
  });
});

app.on('window-all-closed', () => {
  if (serverRef) { try { serverRef.close(); } catch (e) {} }
  if (process.platform !== 'darwin') app.quit();
});
