/* ============================================================
   backup.js — النسخ الاحتياطي (SQLite .db)
   - إنشاء ملف SQLite حقيقي (.db) يحتوي على جميع بيانات النظام
   - تنزيل فوري (زر 💾 النسخ الاحتياطي)
   - استعادة من ملف .db
   - التحقق من سلامة الملف (PRAGMA integrity_check)
   - جدولة (يومي/أسبوعي/شهري) — UI في لوحة التحكم
   يستخدم sql.js (WASM) من lib/sqljs/
   ============================================================ */
(function(){
  'use strict';

  function $(id){ return document.getElementById(id); }
  function esc(s){ return String(s==null?'':s).replace(/[&<>"']/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
  function toast(m){ try{ if(typeof showToast==='function'){ showToast(m); return; } }catch(e){} alert(m); }

  var SQL = null; // sql.js module
  var loadingPromise = null;

  // ---------- تحميل sql.js ----------
  async function loadSqlJs(){
    if(SQL) return SQL;
    if(loadingPromise) return loadingPromise;
    loadingPromise = new Promise(function(resolve, reject){
      if(typeof initSqlJs !== 'function'){
        // تحميل سكربت sql-wasm.js
        var s = document.createElement('script');
        s.src = 'lib/sqljs/sql-wasm.js';
        s.onload = function(){
          if(typeof initSqlJs === 'function'){
            initSqlJs({ locateFile: function(f){ return 'lib/sqljs/' + f; } }).then(function(sql){ SQL = sql; resolve(sql); }).catch(reject);
          } else { reject(new Error('initSqlJs غير متاح')); }
        };
        s.onerror = function(){ reject(new Error('تعذر تحميل sql-wasm.js')); };
        document.head.appendChild(s);
      } else {
        initSqlJs({ locateFile: function(f){ return 'lib/sqljs/' + f; } }).then(function(sql){ SQL = sql; resolve(sql); }).catch(reject);
      }
    });
    return loadingPromise;
  }

  // ---------- إنشاء قاعدة SQLite ----------
  async function createBackupDb(){
    var sql = await loadSqlJs();
    var db = new sql.Database();

    // جداول
    db.run('CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT)');
    db.run('CREATE TABLE IF NOT EXISTS users (id INTEGER, username TEXT, name TEXT, role TEXT, perms TEXT, password TEXT)');
    db.run('CREATE TABLE IF NOT EXISTS orders (id TEXT PRIMARY KEY, orderNo INTEGER, cashier TEXT, name TEXT, phone TEXT, type TEXT, pay TEXT, items TEXT, subtotal REAL, vat REAL, total REAL, paid REAL, change REAL, remaining REAL, payStatus TEXT, status TEXT, prep TEXT, createdAt INTEGER, date TEXT, pickupDate TEXT, pickupTime TEXT, theme INTEGER, themeData TEXT)');
    db.run('CREATE TABLE IF NOT EXISTS expenses (id TEXT PRIMARY KEY, userId TEXT, userName TEXT, amount REAL, currency TEXT, reason TEXT, note TEXT, createdAt INTEGER, dateStr TEXT, timeStr TEXT, status TEXT, paid REAL, approvedBy TEXT, approvedByName TEXT, approvedAt INTEGER, rejectReason TEXT, rejectedBy TEXT, rejectedByName TEXT, rejectedAt INTEGER, returnNote TEXT, returnedBy TEXT, returnedByName TEXT, returnedAt INTEGER, receivedAt INTEGER, receivedBy TEXT, receivedByName TEXT, log TEXT)');
    db.run('CREATE TABLE IF NOT EXISTS print_jobs (id TEXT PRIMARY KEY, orderId TEXT, orderNo INTEGER, targetDeviceId TEXT, status TEXT, createdAt INTEGER, requestedBy TEXT, printedAt INTEGER, error TEXT)');
    db.run('CREATE TABLE IF NOT EXISTS print_devices (id TEXT PRIMARY KEY, userId TEXT, userName TEXT, deviceName TEXT, status TEXT, lastSeen INTEGER)');
    db.run('CREATE TABLE IF NOT EXISTS activity_log (id TEXT, type TEXT, text TEXT, ts INTEGER)');
    db.run('CREATE TABLE IF NOT EXISTS menu (id TEXT, name TEXT, price REAL, category TEXT, available INTEGER, data TEXT)');
    db.run('CREATE TABLE IF NOT EXISTS chat_messages (id TEXT PRIMARY KEY, fromUser TEXT, toUser TEXT, text TEXT, type TEXT, createdAt INTEGER, data TEXT)');
    db.run('CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT)');

    // ---------- جمع البيانات ----------
    // settings (config)
    try{
      var cfg = (window.DB && DB.getSettings) ? await DB.getSettings() : null;
      if(cfg){ db.run('INSERT INTO settings (key, value) VALUES (?, ?)', ['config', JSON.stringify(cfg)]); }
    }catch(e){ console.warn('settings export:', e); }

    // users
    try{
      var users = (window.DB && DB.getUsers) ? await DB.getUsers() : [];
      (users||[]).forEach(function(u){
        db.run('INSERT INTO users (id, username, name, role, perms, password) VALUES (?,?,?,?,?,?)',
          [u.id||0, u.username||'', u.name||'', u.role||'', JSON.stringify(u.perms||{}), u.password||'']);
      });
    }catch(e){ console.warn('users export:', e); }

    // orders
    try{
      var orders = (window.DB && DB.getOrders) ? await DB.getOrders() : [];
      (orders||[]).forEach(function(o){
        db.run('INSERT INTO orders (id, orderNo, cashier, name, phone, type, pay, items, subtotal, vat, total, paid, change, remaining, payStatus, status, prep, createdAt, date, pickupDate, pickupTime, theme, themeData) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
          [o.id||'', o.orderNo||0, o.cashier||'', o.name||'', o.phone||'', o.type||'', o.pay||'',
           JSON.stringify(o.items||[]), o.subtotal||0, o.vat||0, o.total||0, o.paid||0, o.change||0, o.remaining||0,
           o.payStatus||'', o.status||'', o.prep||'', o.createdAt||0, o.date||'', o.pickupDate||'', o.pickupTime||'',
           (o.theme?1:0), JSON.stringify(o.themeData||null)]);
      });
    }catch(e){ console.warn('orders export:', e); }

    // expenses
    try{
      var exps = (window.DB && DB.getExpenses) ? await DB.getExpenses() : [];
      (exps||[]).forEach(function(x){
        db.run('INSERT INTO expenses (id, userId, userName, amount, currency, reason, note, createdAt, dateStr, timeStr, status, paid, approvedBy, approvedByName, approvedAt, rejectReason, rejectedBy, rejectedByName, rejectedAt, returnNote, returnedBy, returnedByName, returnedAt, receivedAt, receivedBy, receivedByName, log) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
          [x.id||'', x.userId||'', x.userName||'', x.amount||0, x.currency||'YER', x.reason||'', x.note||'',
           x.createdAt||0, x.dateStr||'', x.timeStr||'', x.status||'', x.paid||0,
           x.approvedBy||'', x.approvedByName||'', x.approvedAt||0,
           x.rejectReason||'', x.rejectedBy||'', x.rejectedByName||'', x.rejectedAt||0,
           x.returnNote||'', x.returnedBy||'', x.returnedByName||'', x.returnedAt||0,
           x.receivedAt||0, x.receivedBy||'', x.receivedByName||'',
           JSON.stringify(x.log||[])]);
      });
    }catch(e){ console.warn('expenses export:', e); }

    // print_jobs
    try{
      if(window.FIREBASE_READY && window.fbdb){
        const snap = await window.fbdb.collection('print_jobs').get();
        snap.docs.forEach(function(d){
          var j = d.data();
          db.run('INSERT INTO print_jobs (id, orderId, orderNo, targetDeviceId, status, createdAt, requestedBy, printedAt, error) VALUES (?,?,?,?,?,?,?,?,?)',
            [j.id||d.id, j.orderId||'', j.orderNo||0, j.targetDeviceId||'', j.status||'', j.createdAt||0, j.requestedBy||'', j.printedAt||0, j.error||'']);
        });
      }
    }catch(e){ console.warn('print_jobs export:', e); }

    // print_devices
    try{
      if(window.FIREBASE_READY && window.fbdb){
        const snap = await window.fbdb.collection('print_devices').get();
        snap.docs.forEach(function(d){
          var dv = d.data();
          db.run('INSERT INTO print_devices (id, userId, userName, deviceName, status, lastSeen) VALUES (?,?,?,?,?,?)',
            [dv.id||d.id, dv.userId||'', dv.userName||'', dv.deviceName||'', dv.status||'', dv.lastSeen||0]);
        });
      }
    }catch(e){ console.warn('print_devices export:', e); }

    // activity_log
    try{
      var logs = (window.DB && DB.getActivityLog) ? await DB.getActivityLog() : [];
      (logs||[]).forEach(function(l){
        db.run('INSERT INTO activity_log (id, type, text, ts) VALUES (?,?,?,?)',
          [l.id||'', l.type||'', l.text||'', l.ts||0]);
      });
    }catch(e){ console.warn('activity_log export:', e); }

    // menu
    try{
      var menu = (window.DB && DB.getMenu) ? await DB.getMenu() : [];
      (menu||[]).forEach(function(m){
        db.run('INSERT INTO menu (id, name, price, category, available, data) VALUES (?,?,?,?,?,?)',
          [m.id||'', m.name||'', m.price||0, m.category||'', (m.available!==false?1:0), JSON.stringify(m)]);
      });
    }catch(e){ console.warn('menu export:', e); }

    // chat_messages
    try{
      if(window.FIREBASE_READY && window.fbdb){
        const snap = await window.fbdb.collection('chat_messages').get();
        snap.docs.forEach(function(d){
          var m = d.data();
          db.run('INSERT INTO chat_messages (id, fromUser, toUser, text, type, createdAt, data) VALUES (?,?,?,?,?,?,?)',
            [m.id||d.id, m.from||'', m.to||'', m.text||'', m.type||'', m.createdAt||0, JSON.stringify(m)]);
        });
      }
    }catch(e){ console.warn('chat_messages export:', e); }

    // meta
    db.run('INSERT INTO meta (key, value) VALUES (?, ?)', ['backupDate', new Date().toISOString()]);
    db.run('INSERT INTO meta (key, value) VALUES (?, ?)', ['version', '1.0']);

    return db;
  }

  // ---------- التحقق من سلامة SQLite ----------
  async function verifyIntegrity(db){
    try{
      var res = db.exec('PRAGMA integrity_check');
      if(res && res[0] && res[0].values && res[0].values[0] && res[0].values[0][0] === 'ok'){
        return true;
      }
      return false;
    }catch(e){ return false; }
  }

  // ---------- إنشاء نسخة احتياطية وتنزيلها ----------
  async function createBackup(){
    try{
      toast('جارٍ إنشاء النسخة الاحتياطية...');
      var db = await createBackupDb();
      var ok = await verifyIntegrity(db);
      if(!ok){ toast('❌ فشل التحقق من سلامة قاعدة البيانات'); db.close(); return null; }
      var data = db.export();
      db.close();
      var blob = new Blob([data], {type: 'application/x-sqlite3'});
      var date = new Date().toISOString().slice(0,10);
      var filename = 'bluemark_backup_' + date + '.db';

      // خيار حفظ المسار (File System Access API) — Chrome/Edge
      var savePath = getBackupSavePath();
      if(savePath === 'choose' && typeof window.showSaveFilePicker === 'function'){
        try{
          var handle = await window.showSaveFilePicker({
            suggestedName: filename,
            types: [{ description: 'SQLite Database', accept: { 'application/x-sqlite3': ['.db'] } }]
          });
          var writable = await handle.createWritable();
          await writable.write(blob);
          await writable.close();
          saveBackupLog({date: Date.now(), file: handle.name, status: 'success', path: 'user-chosen'});
          toast('✅ تم حفظ النسخة الاحتياطية: ' + handle.name);
          return handle.name;
        }catch(e){
          if(e.name === 'AbortError'){ toast('تم إلغاء الحفظ'); return null; }
          // fallback to default download
        }
      }

      // تنزيل افتراضي (مجلد Downloads)
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      saveBackupLog({date: Date.now(), file: filename, status: 'success', path: 'default-downloads'});
      toast('✅ تم إنشاء النسخة الاحتياطية: ' + filename + ' (مجلد Downloads)');
      return filename;
    }catch(e){
      console.error('backup error:', e);
      toast('❌ فشل إنشاء النسخة الاحتياطية: ' + (e.message||e));
      saveBackupLog({date: Date.now(), file: '', status: 'failed', error: String(e.message||e)});
      return null;
    }
  }

  // ---------- مسار حفظ النسخ ----------
  function getBackupSavePath(){
    try{ return localStorage.getItem('bms_backup_savepath') || 'default'; }catch(e){ return 'default'; }
  }
  function setBackupSavePath(p){
    try{ localStorage.setItem('bms_backup_savepath', p); }catch(e){}
  }

  // ---------- سجل النسخ ----------
  function getBackupLogs(){
    try{ return JSON.parse(localStorage.getItem('bms_backup_logs') || '[]'); }catch(e){ return []; }
  }
  function saveBackupLog(entry){
    var logs = getBackupLogs();
    logs.unshift(entry);
    if(logs.length > 50) logs = logs.slice(0, 50);
    try{ localStorage.setItem('bms_backup_logs', JSON.stringify(logs)); }catch(e){}
  }

  // ---------- استعادة من .db ----------
  async function restoreFromDb(file){
    try{
      toast('جارٍ قراءة ملف .db...');
      var buf = await file.arrayBuffer();
      var sql = await loadSqlJs();
      var db = new sql.Database(new Uint8Array(buf));
      var ok = await verifyIntegrity(db);
      if(!ok){ toast('❌ ملف SQLite تالف (فشل integrity_check)'); db.close(); return false; }
      // نسخة أمان قبل الاستعادة
      try{ await createBackup(); }catch(e){ console.warn('safety backup failed:', e); }
      toast('✅ تم التحقق من الملف. جارٍ الاستعادة...');
      // قراءة الجداول
      function readTable(name){
        try{
          var res = db.exec('SELECT * FROM ' + name);
          if(!res || !res[0]) return [];
          var cols = res[0].columns;
          return res[0].values.map(function(row){
            var obj = {};
            cols.forEach(function(c, i){ obj[c] = row[i]; });
            return obj;
          });
        }catch(e){ return []; }
      }
      var settings = readTable('settings');
      var users = readTable('users');
      var orders = readTable('orders');
      var expenses = readTable('expenses');
      // استعادة settings/config
      var cfgRow = settings.find(function(s){ return s.key === 'config'; });
      if(cfgRow && cfgRow.value){
        try{
          var cfg = JSON.parse(cfgRow.value);
          if(window.DB && DB.saveSettings){ await DB.saveSettings(cfg); }
        }catch(e){ console.warn('restore settings:', e); }
      }
      // استعادة users
      if(users.length && window.DB && DB.saveUsers){
        var restoredUsers = users.map(function(u){
          var perms = {}; try{ perms = JSON.parse(u.perms||'{}'); }catch(e){}
          return { id: u.id, username: u.username, name: u.name, role: u.role, perms: perms, password: u.password };
        });
        await DB.saveUsers(restoredUsers);
      }
      // استعادة orders
      if(orders.length && window.DB && DB.addOrder){
        for(var i=0;i<orders.length;i++){
          var o = orders[i];
          var order = {
            id: o.id, orderNo: o.orderNo, cashier: o.cashier, name: o.name, phone: o.phone,
            type: o.type, pay: o.pay, items: JSON.parse(o.items||'[]'),
            subtotal: o.subtotal, vat: o.vat, total: o.total, paid: o.paid, change: o.change,
            remaining: o.remaining, payStatus: o.payStatus, status: o.status, prep: o.prep,
            createdAt: o.createdAt, date: o.date, pickupDate: o.pickupDate, pickupTime: o.pickupTime,
            theme: !!o.theme, themeData: JSON.parse(o.themeData||'null')
          };
          try{ await DB.addOrder(order); }catch(e){ console.warn('restore order:', e); }
        }
      }
      // استعادة expenses
      if(expenses.length && window.DB && DB.addExpense){
        for(var i=0;i<expenses.length;i++){
          var x = expenses[i];
          var exp = {
            id: x.id, userId: x.userId, userName: x.userName, amount: x.amount, currency: x.currency,
            reason: x.reason, note: x.note, createdAt: x.createdAt, dateStr: x.dateStr, timeStr: x.timeStr,
            status: x.status, paid: x.paid, approvedBy: x.approvedBy, approvedByName: x.approvedByName,
            approvedAt: x.approvedAt, rejectReason: x.rejectReason, rejectedBy: x.rejectedBy,
            rejectedByName: x.rejectedByName, rejectedAt: x.rejectedAt, returnNote: x.returnNote,
            returnedBy: x.returnedBy, returnedByName: x.returnedByName, returnedAt: x.returnedAt,
            receivedAt: x.receivedAt, receivedBy: x.receivedBy, receivedByName: x.receivedByName,
            log: JSON.parse(x.log||'[]')
          };
          try{ await DB.addExpense(exp); }catch(e){ console.warn('restore expense:', e); }
        }
      }
      db.close();
      toast('✅ تم استعادة البيانات من ملف SQLite بنجاح');
      return true;
    }catch(e){
      console.error('restore error:', e);
      toast('❌ فشل الاستعادة: ' + (e.message||e));
      return false;
    }
  }

  // ---------- الجدولة ----------
  function getSchedule(){
    try{ return JSON.parse(localStorage.getItem('bms_backup_schedule') || '{}'); }catch(e){ return {}; }
  }
  function saveSchedule(s){ try{ localStorage.setItem('bms_backup_schedule', JSON.stringify(s)); }catch(e){} }
  function getNextBackupDate(sched){
    if(!sched || !sched.enabled) return null;
    var now = new Date();
    var interval = sched.interval || 'daily'; // daily, weekly, monthly
    var time = sched.time || '02:00';
    var parts = time.split(':');
    var h = parseInt(parts[0],10)||0, m = parseInt(parts[1],10)||0;
    var next = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m, 0);
    if(next <= now){
      if(interval === 'daily'){ next.setDate(next.getDate()+1); }
      else if(interval === 'weekly'){ next.setDate(next.getDate() + (7 - next.getDay() + (sched.weekDay||0)) % 7 || 7); }
      else if(interval === 'monthly'){ next.setMonth(next.getMonth()+1); next.setDate(1); }
    }
    if(interval === 'weekly'){
      // adjust to next weekDay
      var wd = sched.weekDay != null ? sched.weekDay : 0;
      while(next.getDay() !== wd){ next.setDate(next.getDate()+1); }
      if(next <= now){ next.setDate(next.getDate()+7); }
    }
    if(interval === 'monthly'){
      var md = sched.monthDay != null ? sched.monthDay : 1;
      next.setDate(md);
      if(next <= now){ next.setMonth(next.getMonth()+1); next.setDate(md); }
    }
    return next;
  }

  // ---------- UI: زر نسخ احتياطي (index.html — قبل QR scan) ----------
  function initBackupButton(){
    var btn = document.getElementById('backupBtn');
    if(btn){ btn.onclick = function(){ createBackup(); }; }
    // زر استعادة (إن وُجد)
    var restoreBtn = document.getElementById('restoreBtn');
    var restoreInput = document.getElementById('restoreFileInput');
    if(restoreBtn && restoreInput){
      restoreBtn.onclick = function(){ restoreInput.click(); };
      restoreInput.onchange = function(e){
        var f = e.target.files && e.target.files[0];
        if(f){ restoreFromDb(f); }
        e.target.value = '';
      };
    }
  }

  // ---------- UI: قسم النسخ الاحتياطي (admin.html — أسفل إعدادات الطابعة) ----------
  function initBackupSection(){
    var section = document.getElementById('tab-backup') || document.getElementById('backupSection');
    if(!section) return;
    // manual backup
    var mb = document.getElementById('backupManualBtn');
    if(mb) mb.onclick = function(){ createBackup(); };
    var jb = document.getElementById('backupJsonBtn');
    if(jb) jb.onclick = function(){ createJsonBackup(); };
    // save path selector
    var sp = document.getElementById('backupSavePath');
    if(sp){
      sp.value = getBackupSavePath();
      sp.onchange = function(){ setBackupSavePath(sp.value); toast('✅ تم حفظ مسار النسخ: ' + (sp.value === 'choose' ? 'اختيار موقع' : 'مجلد Downloads')); };
    }
    // restore
    var rb = document.getElementById('backupRestoreBtn');
    var ri = document.getElementById('backupRestoreInput');
    if(rb && ri){ rb.onclick = function(){ ri.click(); }; ri.onchange = function(e){ var f=e.target.files&&e.target.files[0]; if(f) restoreFromDb(f); e.target.value=''; }; }
    // schedule
    var sched = getSchedule();
    var en = document.getElementById('backupScheduleEnabled'); if(en) en.checked = !!sched.enabled;
    var iv = document.getElementById('backupScheduleInterval'); if(iv) iv.value = sched.interval || 'daily';
    var tm = document.getElementById('backupScheduleTime'); if(tm) tm.value = sched.time || '02:00';
    var wd = document.getElementById('backupScheduleWeekDay'); if(wd) wd.value = (sched.weekDay != null ? sched.weekDay : 0);
    var md = document.getElementById('backupScheduleMonthDay'); if(md) md.value = (sched.monthDay != null ? sched.monthDay : 1);
    var save = document.getElementById('backupScheduleSave');
    if(save) save.onclick = function(){
      var s = {
        enabled: !!(document.getElementById('backupScheduleEnabled')||{}).checked,
        interval: (document.getElementById('backupScheduleInterval')||{}).value || 'daily',
        time: (document.getElementById('backupScheduleTime')||{}).value || '02:00',
        weekDay: parseInt((document.getElementById('backupScheduleWeekDay')||{}).value, 10) || 0,
        monthDay: parseInt((document.getElementById('backupScheduleMonthDay')||{}).value, 10) || 1
      };
      saveSchedule(s);
      // also save to Firestore settings (for backup-service)
      try{
        if(window.DB && DB.getSettings && DB.saveSettings){
          DB.getSettings().then(function(cfg){
            cfg.backupSchedule = s;
            return DB.saveSettings(cfg);
          }).catch(function(){});
        }
      }catch(e){}
      renderBackupSection();
      toast('✅ تم حفظ جدولة النسخ الاحتياطي');
    };
    renderBackupSection();
  }

  function renderBackupSection(){
    var next = document.getElementById('backupNextDate');
    if(next){ var d = getNextBackupDate(getSchedule()); next.textContent = d ? d.toLocaleString('ar') : '—'; }
    var last = document.getElementById('backupLastDate');
    if(last){ var logs = getBackupLogs(); var lastOk = logs.find(function(l){ return l.status === 'success'; }); last.textContent = lastOk ? new Date(lastOk.date).toLocaleString('ar') : '—'; }
    var hist = document.getElementById('backupHistory');
    if(hist){
      var logs = getBackupLogs();
      if(!logs.length){ hist.innerHTML = '<div style="color:#94a3b8;font-size:13px;padding:8px">لا يوجد سجل نسخ</div>'; return; }
      hist.innerHTML = logs.map(function(l){
        var cls = l.status === 'success' ? 'color:#059669' : 'color:#b91c1c';
        return '<div style="font-size:12.5px;padding:6px 8px;border-bottom:1px solid #eef2f7;' + cls + '">' +
          new Date(l.date).toLocaleString('ar') + ' · ' + (l.status === 'success' ? '✅ نجاح' : '❌ فشل') +
          (l.file ? ' · ' + esc(l.file) : '') +
          (l.error ? ' · ' + esc(l.error) : '') + '</div>';
      }).join('');
    }
  }

  // ---------- التهيئة ----------
  function init(){
    if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function(){ initBackupButton(); initBackupSection(); });
    else { initBackupButton(); initBackupSection(); }
  }
  init();

  // ---------- تصدير JSON (إضافة) ----------
  async function createJsonBackup(){
    try{
      toast('جارٍ إنشاء نسخة JSON...');
      var data = {};
      // settings
      try{ data.settings = (window.DB && DB.getSettings) ? await DB.getSettings() : null; }catch(e){ data.settings = null; }
      // users
      try{ data.users = (window.DB && DB.getUsers) ? await DB.getUsers() : []; }catch(e){ data.users = []; }
      // orders
      try{ data.orders = (window.DB && DB.getOrders) ? await DB.getOrders() : []; }catch(e){ data.orders = []; }
      // expenses
      try{ data.expenses = (window.DB && DB.getExpenses) ? await DB.getExpenses() : []; }catch(e){ data.expenses = []; }
      // menu
      try{ data.menu = (window.DB && DB.getMenu) ? await DB.getMenu() : []; }catch(e){ data.menu = []; }
      // activity_log
      try{ data.activity_log = (window.DB && DB.getActivityLog) ? await DB.getActivityLog() : []; }catch(e){ data.activity_log = []; }
      data.meta = { backupDate: new Date().toISOString(), version: '1.0', format: 'json' };
      var json = JSON.stringify(data, null, 2);
      var blob = new Blob([json], {type: 'application/json'});
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      var date = new Date().toISOString().slice(0,10);
      a.href = url;
      a.download = 'bluemark_backup_' + date + '.json';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      saveBackupLog({date: Date.now(), file: a.download, status: 'success', format: 'json'});
      toast('✅ تم إنشاء نسخة JSON: ' + a.download);
      return a.download;
    }catch(e){
      console.error('json backup error:', e);
      toast('❌ فشل إنشاء نسخة JSON: ' + (e.message||e));
      saveBackupLog({date: Date.now(), file: '', status: 'failed', error: String(e.message||e), format: 'json'});
      return null;
    }
  }
  // واجهة عامة
  window.BackupUI = { create: createBackup, createJson: createJsonBackup, restore: restoreFromDb, verify: verifyIntegrity, logs: getBackupLogs, loadSqlJs: loadSqlJs, createDb: createBackupDb, getSavePath: getBackupSavePath, setSavePath: setBackupSavePath };
})();