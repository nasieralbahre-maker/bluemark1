/*
 * native-bio.js — جسر البصمة الأصلية داخل تطبيق الأندرويد (APK)
 * عندما يعمل التطبيق داخل WebView عبر file:// لا تعمل WebAuthn،
 * فنستخدم جسر BiometricPrompt الأصلي (window.AndroidBio) بدلاً منها.
 * على الويب (Netlify/HTTPS) لا يوجد AndroidBio فيبقى WebAuthn كما هو.
 *
 * تنبيه أمني: المطابقة تتم محلياً على الجهاز كبوابة دخول سريعة فقط،
 * وليست تحققاً تشفيرياً من طرف الخادم. للأمان الكامل يُوصى بـ Firebase Authentication.
 */
(function(){
  'use strict';
  if(!window.AndroidBio || typeof window.AndroidBio.authenticate !== 'function') return;

  var LS_KEY = 'bm_native_bio_v1'; // { users: { "<username>": {name, finger, face} }, last: "<username>" }

  function readStore(){
    try{ var o = JSON.parse(localStorage.getItem(LS_KEY) || '{}') || {}; if(!o.users) o.users = {}; return o; }
    catch(e){ return { users:{} }; }
  }
  function writeStore(o){ try{ localStorage.setItem(LS_KEY, JSON.stringify(o||{users:{}})); }catch(e){} }
  function normMode(mode){ mode = String(mode||'').trim(); return (mode === 'face') ? 'face' : 'finger'; }

  // سجل الوعود لنتائج النافذة الأصلية
  window.__bioReqs = window.__bioReqs || {};
  window.__bioNativeResult = function(reqId, ok, msg){
    var cb = window.__bioReqs[reqId];
    if(cb){ delete window.__bioReqs[reqId]; cb(!!ok, msg); }
  };
  function nativePrompt(title, subtitle){
    return new Promise(function(resolve){
      var id = 'r' + Date.now() + Math.random().toString(36).slice(2);
      window.__bioReqs[id] = function(ok, msg){ resolve({ ok: ok, msg: msg }); };
      try{ window.AndroidBio.authenticate(id, title || '', subtitle || ''); }
      catch(e){ resolve({ ok:false, msg:'exception' }); }
    });
  }

  function supported(){ return true; }
  function platformAvailable(){
    try{ return Promise.resolve(!!window.AndroidBio.isAvailable()); }
    catch(e){ return Promise.resolve(false); }
  }

  function hasCredFor(username, mode){
    if(!username) return false;
    var u = readStore().users[username];
    if(!u) return false;
    if(mode == null) return !!(u.finger || u.face);
    return !!u[normMode(mode)];
  }
  function anyCred(mode){
    var users = readStore().users, m = (mode==null)?null:normMode(mode);
    return Object.keys(users).some(function(k){
      var u = users[k]; return m == null ? !!(u.finger||u.face) : !!u[m];
    });
  }
  function listCreds(){
    var users = readStore().users, out = [];
    Object.keys(users).forEach(function(k){
      var u = users[k];
      if(u.finger) out.push({ username:k, name:u.name||k, mode:'finger' });
      if(u.face)   out.push({ username:k, name:u.name||k, mode:'face' });
    });
    return out;
  }
  function removeCred(username, mode){
    var s = readStore();
    if(!s.users[username]) { writeStore(s); return; }
    if(mode == null){ delete s.users[username]; }
    else { s.users[username][normMode(mode)] = false;
           if(!s.users[username].finger && !s.users[username].face) delete s.users[username]; }
    if(s.last === username && !s.users[username]) s.last = null;
    writeStore(s);
  }

  // تسجيل حيوي: يطلب تحققاً أصلياً ثم يخزّن المستخدم لهذا النمط
  function enroll(opts){
    opts = opts || {};
    var username = String(opts.username||'').trim();
    var name = String(opts.name||username||'مستخدم');
    var mode = normMode(opts.mode);
    if(!username) return Promise.reject(new Error('no-username'));
    return nativePrompt('تفعيل الدخول الحيوي', name).then(function(r){
      if(!r.ok) throw new Error(r.msg || 'failed');
      var s = readStore();
      if(!s.users[username]) s.users[username] = { name:name };
      s.users[username].name = name;
      s.users[username][mode] = true;
      s.last = username;
      writeStore(s);
      return true;
    });
  }

  // تفعيل صامت بعد دخول ناجح بكلمة المرور (بلا نافذة) لتعمل البصمة فوراً في المرة التالية
  function autoEnroll(username, name){
    username = String(username||'').trim();
    if(!username) return;
    try{
      platformAvailable().then(function(ok){
        if(!ok) return;
        var s = readStore();
        if(!s.users[username]) s.users[username] = { name: name||username };
        s.users[username].name = name || username;
        s.users[username].finger = true;
        s.users[username].face = true;
        s.last = username;
        writeStore(s);
        try{ if(typeof window.refreshBioLoginBtn==='function') window.refreshBioLoginBtn(); }catch(e){}
      });
    }catch(e){}
  }

  // دخول حيوي: نافذة أصلية ثم نرجع اسم المستخدم المخزّن
  function authenticate(username, mode){
    var m = normMode(mode);
    var s = readStore();
    var target = username || s.last;
    // إن لم يوجد مستخدم محدد، خذ أي مستخدم مفعّل لهذا النمط
    if(!target || !s.users[target] || !s.users[target][m]){
      target = null;
      var ks = Object.keys(s.users);
      for(var i=0;i<ks.length;i++){ if(s.users[ks[i]][m]){ target = ks[i]; break; } }
    }
    if(!target) return Promise.reject(new Error('no-cred'));
    var dispName = (s.users[target] && s.users[target].name) || target;
    return nativePrompt('تسجيل الدخول بالبصمة', dispName).then(function(r){
      if(!r.ok) throw new Error(r.msg || 'failed');
      var s2 = readStore(); s2.last = target; writeStore(s2);
      return target;
    });
  }

  // استبدال طبقة BIO بالنسخة الأصلية
  window.BIO = {
    native: true,
    supported: supported,
    platformAvailable: platformAvailable,
    enroll: enroll,
    autoEnroll: autoEnroll,
    authenticate: authenticate,
    hasCredFor: hasCredFor,
    anyCred: anyCred,
    listCreds: listCreds,
    removeCred: removeCred
  };
})();
