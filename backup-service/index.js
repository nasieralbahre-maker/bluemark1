/* ============================================================
   BMS Backup Service — خدمة نسخ احتياطي تلقائي (SQLite)
   - تُشغَّل على خادم/كمبيوتر (حتى عند إغلاق المتصفح).
   - تُصدِّر بيانات Firestore (orders, settings, users, expenses, ...) إلى ملف SQLite (.db).
   - جدولة: يومي/أسبوعي/شهري (حسب إعدادات bms_backup_schedule في Firestore أو locally).
   - تُحفظ الملفات في BACKUP_DIR (دائم).
   ============================================================ */
'use strict';
const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');

const SERVICE_ACCOUNT_PATH = process.env.BMS_SA_PATH || './serviceAccountKey.json';
const BACKUP_DIR = process.env.BMS_BACKUP_DIR || path.join(__dirname, 'backups');
const SCHEDULE_CHECK_MS = 60000; // check every minute

if(!fs.existsSync(SERVICE_ACCOUNT_PATH)){ console.error('[BMS-Backup] serviceAccountKey.json not found'); process.exit(1); }
if(!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });

admin.initializeApp({ credential: admin.credential.cert(require(path.resolve(SERVICE_ACCOUNT_PATH))) });
const db = admin.firestore();

console.log('[BMS-Backup] Service started. Backup dir:', BACKUP_DIR);

let BetterSqlite3;
try { BetterSqlite3 = require('better-sqlite3'); }
catch(e){ console.error('[BMS-Backup] better-sqlite3 not installed. Run: npm install better-sqlite3'); process.exit(1); }

async function exportToSqlite(){
  const date = new Date().toISOString().slice(0,10);
  const filename = 'bluemark_backup_' + date + '.db';
  const filepath = path.join(BACKUP_DIR, filename);
  // safety: if file exists, append timestamp
  let finalPath = filepath;
  if(fs.existsSync(filepath)){ finalPath = path.join(BACKUP_DIR, 'bluemark_backup_' + new Date().toISOString().replace(/[:.]/g,'-') + '.db'); }

  const sqlite = new BetterSqlite3(finalPath);
  // tables
  sqlite.exec('CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT)');
  sqlite.exec('CREATE TABLE IF NOT EXISTS users (id INTEGER, username TEXT, name TEXT, role TEXT, perms TEXT)');
  sqlite.exec('CREATE TABLE IF NOT EXISTS orders (id TEXT PRIMARY KEY, orderNo INTEGER, cashier TEXT, name TEXT, phone TEXT, type TEXT, pay TEXT, items TEXT, subtotal REAL, vat REAL, total REAL, paid REAL, change REAL, remaining REAL, payStatus TEXT, status TEXT, prep TEXT, createdAt INTEGER, date TEXT)');
  sqlite.exec('CREATE TABLE IF NOT EXISTS expenses (id TEXT PRIMARY KEY, userId TEXT, userName TEXT, amount REAL, currency TEXT, reason TEXT, note TEXT, createdAt INTEGER, status TEXT, paid REAL, log TEXT)');
  sqlite.exec('CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT)');

  // settings
  const cfgDoc = await db.collection('settings').doc('config').get();
  if(cfgDoc.exists) sqlite.prepare('INSERT INTO settings (key, value) VALUES (?, ?)').run('config', JSON.stringify(cfgDoc.data()));
  const usersDoc = await db.collection('settings').doc('users').get();
  if(usersDoc.exists && Array.isArray(usersDoc.data().list)){
    const ins = sqlite.prepare('INSERT INTO users (id, username, name, role, perms) VALUES (?,?,?,?,?)');
    usersDoc.data().list.forEach(function(u){ ins.run(u.id||0, u.username||'', u.name||'', u.role||'', JSON.stringify(u.perms||{})); });
  }
  // orders
  const ordersSnap = await db.collection('orders').get();
  const insO = sqlite.prepare('INSERT INTO orders (id, orderNo, cashier, name, phone, type, pay, items, subtotal, vat, total, paid, change, remaining, payStatus, status, prep, createdAt, date) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)');
  ordersSnap.docs.forEach(function(d){ var o=d.data(); insO.run(o.id||d.id, o.orderNo||0, o.cashier||'', o.name||'', o.phone||'', o.type||'', o.pay||'', JSON.stringify(o.items||[]), o.subtotal||0, o.vat||0, o.total||0, o.paid||0, o.change||0, o.remaining||0, o.payStatus||'', o.status||'', o.prep||'', o.createdAt||0, o.date||''); });
  // expenses
  const expDoc = await db.collection('settings').doc('expenses').get();
  if(expDoc.exists && Array.isArray(expDoc.data().list)){
    const insE = sqlite.prepare('INSERT INTO expenses (id, userId, userName, amount, currency, reason, note, createdAt, status, paid, log) VALUES (?,?,?,?,?,?,?,?,?,?,?)');
    expDoc.data().list.forEach(function(x){ insE.run(x.id||'', x.userId||'', x.userName||'', x.amount||0, x.currency||'YER', x.reason||'', x.note||'', x.createdAt||0, x.status||'', x.paid||0, JSON.stringify(x.log||[])); });
  }
  sqlite.prepare('INSERT INTO meta (key, value) VALUES (?, ?)').run('backupDate', new Date().toISOString());
  sqlite.prepare('INSERT INTO meta (key, value) VALUES (?, ?)').run('version', '1.0');
  sqlite.close();
  console.log('[BMS-Backup] Created:', finalPath);
  return finalPath;
}

async function getSchedule(){
  try{
    const doc = await db.collection('settings').doc('config').get();
    if(doc.exists && doc.data().backupSchedule) return doc.data().backupSchedule;
  }catch(e){}
  return { enabled: false, interval: 'daily', time: '02:00' };
}

function nextBackupTime(sched){
  // simplified: daily at given time
  const now = new Date();
  const parts = (sched.time||'02:00').split(':');
  const h = parseInt(parts[0],10)||0, m = parseInt(parts[1],10)||0;
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m, 0);
  if(next <= now) next.setDate(next.getDate() + (sched.interval==='weekly'?7 : sched.interval==='monthly'?30 : 1));
  return next;
}

let lastBackupDate = null;
async function checkAndBackup(){
  try{
    const sched = await getSchedule();
    if(!sched.enabled) return;
    const next = nextBackupTime(sched);
    const now = new Date();
    if(now >= next && (!lastBackupDate || (now - lastBackupDate) > 3600000)){
      console.log('[BMS-Backup] Running scheduled backup...');
      await exportToSqlite();
      lastBackupDate = now;
    }
  }catch(e){ console.warn('[BMS-Backup] check error:', e.message); }
}

// check every minute
setInterval(checkAndBackup, SCHEDULE_CHECK_MS);
checkAndBackup();

process.on('SIGINT', function(){ console.log('[BMS-Backup] shutting down'); process.exit(0); });
process.on('SIGTERM', function(){ console.log('[BMS-Backup] shutting down'); process.exit(0); });