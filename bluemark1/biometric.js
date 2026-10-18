/*
 * biometric.js — دخول حيوي (WebAuthn / Platform Authenticator)
 * يدعم نمطين مستقلّين: بصمة الإصبع (finger) وبصمة الوجه/العين (face).
 * مكتفٍ ذاتياً — يعمل على HTTPS (Netlify) أو localhost.
 *
 * ملاحظة تقنية: على الويب تستخدم كل الأنماط نفس المستشعر المدمج (Platform Authenticator)
 * والجهاز هو من يقرر الطريقة الفعلية (إصبع/وجه/عين) حسب دعمه.
 * نخزن اعتمادًا منفصلاً لكل نمط ليستطيع المدير تفعيل/إلغاء كل نمط على حدة.
 *
 * تنبيه أمني: التطبيق بلا خادم تحقّق، لذا تتم المصادقة الحيوية محلياً على الجهاز
 * كبوابة دخول سريعة على نفس الجهاز، وليست تحققاً تشفيرياً من طرف الخادم.
 * للأمان الكامل يُوصى بـ Firebase Authentication + قواعد Firestore مقيّدة حسب الدور.
 */
(function(){
  'use strict';
  var LS_KEY = 'bm_bio_creds_v1'; // { "<key>": { id, name, username, mode, createdAt } }

  function supported(){
    return !!(window.PublicKeyCredential && navigator.credentials &&
              typeof navigator.credentials.create === 'function' &&
              typeof navigator.credentials.get === 'function');
  }
  // هل يتوفر مستشعر حيوي مدمج (بصمة/وجه/عين)؟
  function platformAvailable(){
    try{
      if(!supported() || !PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable) return Promise.resolve(false);
      return PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable().catch(function(){ return false; });
    }catch(e){ return Promise.resolve(false); }
  }

  // ===== base64url =====
  function bufToB64url(buf){
    var bytes = new Uint8Array(buf), s='';
    for(var i=0;i<bytes.length;i++) s += String.fromCharCode(bytes[i]);
    return btoa(s).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
  }
  function b64urlToBuf(str){
    str = String(str).replace(/-/g,'+').replace(/_/g,'/');
    while(str.length % 4) str += '=';
    var bin = atob(str), bytes = new Uint8Array(bin.length);
    for(var i=0;i<bin.length;i++) bytes[i] = bin.charCodeAt(i);
    return bytes.buffer;
  }
  function randChallenge(){ var a = new Uint8Array(32); (window.crypto||{}).getRandomValues && crypto.getRandomValues(a); return a.buffer; }
  function strToBytes(s){ var e = new TextEncoder(); return e.encode(String(s)); }

  // ===== الأنماط والمفاتيح =====
  function normMode(mode){ mode = String(mode||'').trim(); return (mode === 'face') ? 'face' : 'finger'; }
  function keyOf(username, mode){ return String(username) + '::' + normMode(mode); }

  // ===== تخزين محلي =====
  function readStore(){ try{ return JSON.parse(localStorage.getItem(LS_KEY) || '{}') || {}; }catch(e){ return {}; } }
  function writeStore(obj){ try{ localStorage.setItem(LS_KEY, JSON.stringify(obj||{})); }catch(e){} }

  // ترحيل الاعتمادات القديمة (مفتاح = username بدون نمط) إلى نمط الإصبع
  function migrate(){
    var s = readStore(), changed = false, out = {};
    Object.keys(s).forEach(function(k){
      var v = s[k] || {};
      if(k.indexOf('::') === -1){
        // اعتماد قديم — اعتبره بصمة إصبع
        var nk = keyOf(k, 'finger');
        out[nk] = { id: v.id, name: v.name || k, username: k, mode: 'finger', createdAt: v.createdAt || Date.now() };
        changed = true;
      } else {
        if(!v.username){ v.username = k.split('::')[0]; changed = true; }
        if(!v.mode){ v.mode = normMode(k.split('::')[1]); changed = true; }
        out[k] = v;
      }
    });
    if(changed) writeStore(out);
    return out;
  }

  function hasCredFor(username, mode){
    if(!username) return false;
    var s = migrate();
    if(mode == null){
      return !!(s[keyOf(username,'finger')] && s[keyOf(username,'finger')].id) ||
             !!(s[keyOf(username,'face')] && s[keyOf(username,'face')].id);
    }
    var e = s[keyOf(username, mode)];
    return !!(e && e.id);
  }
  function anyCred(mode){
    var s = migrate();
    return Object.keys(s).some(function(k){
      var v = s[k]; if(!v || !v.id) return false;
      return (mode == null) ? true : (normMode(v.mode) === normMode(mode));
    });
  }
  function listCreds(){
    var s = migrate();
    return Object.keys(s).map(function(k){ var v = s[k]||{}; return { username: v.username || k.split('::')[0], name: v.name || v.username, mode: normMode(v.mode) }; });
  }
  function removeCred(username, mode){
    var s = migrate();
    if(mode == null){
      delete s[keyOf(username,'finger')];
      delete s[keyOf(username,'face')];
    } else {
      delete s[keyOf(username, mode)];
    }
    writeStore(s);
  }

  // ===== تسجيل اعتماد حيوي جديد (بعد دخول المستخدم وقبوله) =====
  function enroll(opts){
    opts = opts || {};
    var username = String(opts.username||'').trim();
    var displayName = String(opts.name||username||'مستخدم');
    var rpName = String(opts.rpName||'Blue Mark');
    var mode = normMode(opts.mode);
    if(!supported()) return Promise.reject(new Error('unsupported'));
    if(!username) return Promise.reject(new Error('no-username'));
    var pub = {
      challenge: randChallenge(),
      rp: { name: rpName, id: location.hostname },
      // معرّف المستخدم يتضمن النمط لتجنب التعارض
      user: { id: strToBytes(username + '::' + mode), name: username, displayName: displayName },
      pubKeyCredParams: [ {type:'public-key', alg:-7}, {type:'public-key', alg:-257} ],
      authenticatorSelection: { authenticatorAttachment:'platform', userVerification:'required', residentKey:'preferred' },
      timeout: 60000,
      attestation: 'none'
    };
    return navigator.credentials.create({ publicKey: pub }).then(function(cred){
      if(!cred || !cred.rawId) throw new Error('no-credential');
      var store = migrate();
      store[keyOf(username, mode)] = { id: bufToB64url(cred.rawId), name: displayName, username: username, mode: mode, createdAt: Date.now() };
      writeStore(store);
      return true;
    });
  }

  // ===== دخول حيوي =====
  // username اختياري: إن أُعطي نستخدم اعتماده فقط، وإلا نسمح بأي اعتماد من النمط المطلوب.
  // mode اختياري: finger | face (افتراضي finger).
  function authenticate(username, mode){
    if(!supported()) return Promise.reject(new Error('unsupported'));
    var m = normMode(mode);
    var store = migrate();
    var allow = [];
    var targetUser = null;
    if(username && store[keyOf(username, m)] && store[keyOf(username, m)].id){
      allow.push({ type:'public-key', id: b64urlToBuf(store[keyOf(username, m)].id), transports:['internal'] });
      targetUser = username;
    } else {
      Object.keys(store).forEach(function(k){
        var v = store[k];
        if(v && v.id && normMode(v.mode) === m){ allow.push({ type:'public-key', id: b64urlToBuf(v.id), transports:['internal'] }); }
      });
    }
    if(!allow.length) return Promise.reject(new Error('no-cred'));
    var pub = {
      challenge: randChallenge(),
      allowCredentials: allow,
      userVerification: 'required',
      timeout: 60000,
      rpId: location.hostname
    };
    return navigator.credentials.get({ publicKey: pub }).then(function(assertion){
      if(!assertion || !assertion.rawId) throw new Error('no-assertion');
      var usedId = bufToB64url(assertion.rawId);
      var matchUser = targetUser;
      if(!matchUser){
        Object.keys(store).forEach(function(k){ if(store[k] && store[k].id === usedId) matchUser = store[k].username || k.split('::')[0]; });
      }
      if(!matchUser) throw new Error('unknown-cred');
      return matchUser; // اسم المستخدم الذي نجح اعتماده
    });
  }

  window.BIO = {
    supported: supported,
    platformAvailable: platformAvailable,
    enroll: enroll,
    authenticate: authenticate,
    hasCredFor: hasCredFor,
    anyCred: anyCred,
    listCreds: listCreds,
    removeCred: removeCred
  };
})();
