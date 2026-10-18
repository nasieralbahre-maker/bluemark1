// ============================================================
//  features.js — ميزات إضافية مكتفية ذاتياً:
//  (1) إظهار/إخفاء وحجم أزرار الواجهة (عام + لكل زر + لكل مستخدم)
//  (2) الدردشة الداخلية 24/7 (نص + صور + رسائل صوتية) + مركز الرسائل
//  (3) مكالمات صوت/فيديو (WebRTC عبر Firestore)
//  يعتمد على DB (db.js) و currentPosUser / isManagerUser / showToast من app.js
// ============================================================
(function(){
  'use strict';

  // ---------- مساعدات عامة ----------
  function FUser(){ try{ return (typeof currentPosUser!=='undefined' && currentPosUser) ? currentPosUser : null; }catch(e){ return null; } }
  function FIsMgr(){ try{ return (typeof isManagerUser==='function') ? isManagerUser() : false; }catch(e){ return false; } }
  function FToast(m){ try{ if(typeof showToast==='function'){ showToast(m); return; } }catch(e){} alert(m); }
  function esc(s){ return String(s==null?'':s).replace(/[&<>"']/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
  function clampN(v,min,max,def){ v = Number(v); if(isNaN(v)) v = def; return Math.min(max, Math.max(min, v)); }
  function meId(){ var u = FUser(); return u ? (u.username || u.name || '') : ''; }
  function meName(){ var u = FUser(); return u ? (u.name || u.username || '') : ''; }
  function timeStr(ts){ try{ return new Date(ts).toLocaleTimeString('ar',{hour:'2-digit',minute:'2-digit'}); }catch(e){ return ''; } }

  var _cfg = null;   // آخر إعدادات محمّلة

  // ---------- تنسيقات مُحقَنة ----------
  var CSS = ''+
  '.ui-hidden{display:none !important;}'+
  '.fx-modal{position:fixed;inset:0;background:rgba(15,23,42,.55);backdrop-filter:blur(3px);z-index:9000;display:none;align-items:center;justify-content:center;padding:14px;}'+
  '.fx-modal.show{display:flex;}'+
  '.fx-box{background:#fff;border-radius:18px;width:100%;max-width:460px;max-height:92vh;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 24px 60px -20px rgba(21,42,102,.5);}'+
  '.fx-head{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:13px 16px;background:linear-gradient(135deg,#1b3fa8,#1e4ed0);color:#fff;}'+
  '.fx-head h3{margin:0;font-size:16px;display:flex;align-items:center;gap:7px;}'+
  '.fx-x{background:rgba(255,255,255,.18);border:none;color:#fff;width:30px;height:30px;border-radius:9px;cursor:pointer;font-size:15px;}'+
  '.fx-x:hover{background:rgba(255,255,255,.32);}'+
  '.fx-body{flex:1;overflow:auto;padding:12px 14px;}'+
  '.chat-list{display:flex;flex-direction:column;gap:9px;}'+
  '.chat-msg{max-width:82%;padding:8px 11px;border-radius:14px;background:#eef3fe;color:#0f172a;font-size:14px;line-height:1.5;align-self:flex-start;position:relative;word-break:break-word;}'+
  '.chat-msg.mine{align-self:flex-end;background:linear-gradient(135deg,#1e4ed0,#3b82f6);color:#fff;}'+
  '.chat-msg .cm-who{font-size:11px;font-weight:800;opacity:.8;margin-bottom:2px;}'+
  '.chat-msg .cm-time{font-size:10px;opacity:.65;margin-top:3px;text-align:left;}'+
  '.chat-msg img.cm-img{max-width:100%;border-radius:10px;display:block;cursor:pointer;}'+
  '.chat-msg audio{max-width:220px;display:block;}'+
  '.chat-msg.call{background:#fff7ed;color:#9a3412;border:1px solid #fed7aa;font-weight:700;align-self:center;text-align:center;font-size:12.5px;}'+
  '.chat-foot{display:flex;align-items:center;gap:6px;padding:9px 10px;border-top:1px solid #e2e8f0;background:#f8fafc;}'+
  '.chat-foot input[type=text]{flex:1;border:1.5px solid #dbe6fc;border-radius:12px;padding:9px 12px;font-size:14px;font-family:inherit;}'+
  '.chat-ic{background:#eef3fe;border:none;width:40px;height:40px;border-radius:12px;cursor:pointer;font-size:18px;color:#1e4ed0;flex:none;}'+
  '.chat-ic:hover{background:#dbe6fc;}'+
  '.chat-ic.rec{background:#fee2e2;color:#dc2626;animation:fxpulse 1s infinite;}'+
  '.chat-ic.send{background:linear-gradient(135deg,#1e4ed0,#3b82f6);color:#fff;}'+
  '@keyframes fxpulse{0%,100%{opacity:1}50%{opacity:.5}}'+
  '.chat-empty{text-align:center;color:#94a3b8;padding:26px 10px;font-size:13.5px;}'+
  '.fx-badge{position:absolute;top:-6px;left:-6px;min-width:18px;height:18px;padding:0 4px;border-radius:999px;background:#ff4d8d;color:#fff;font-size:11px;font-weight:800;display:flex;align-items:center;justify-content:center;}'+
  '.call-overlay{position:fixed;inset:0;background:#0b1020;z-index:9600;display:none;flex-direction:column;align-items:center;justify-content:center;color:#fff;text-align:center;padding:16px;}'+
  '.call-overlay.show{display:flex;}'+
  '.call-videos{position:relative;width:100%;max-width:560px;aspect-ratio:3/4;background:#111;border-radius:16px;overflow:hidden;margin-bottom:14px;}'+
  '.call-videos video{width:100%;height:100%;object-fit:cover;background:#000;}'+
  '#fxRemoteVid{position:absolute;inset:0;}'+
  '#fxLocalVid{position:absolute;bottom:10px;left:10px;width:92px;height:124px;border-radius:10px;border:2px solid rgba(255,255,255,.5);z-index:2;}'+
  '.call-name{font-size:19px;font-weight:800;margin-bottom:4px;}'+
  '.call-status{font-size:13px;opacity:.8;margin-bottom:16px;}'+
  '.call-btns{display:flex;gap:16px;}'+
  '.call-cbtn{width:62px;height:62px;border-radius:50%;border:none;font-size:24px;cursor:pointer;color:#fff;}'+
  '.call-cbtn.accept{background:#16a34a;}.call-cbtn.decline{background:#dc2626;}.call-cbtn.mute{background:#334155;}'+
  '';
  (function injectCSS(){ var s = document.createElement('style'); s.id='fxStyle'; s.textContent = CSS; document.head.appendChild(s); })();

  // ---------- (1) إظهار/إخفاء وحجم أزرار الواجهة ----------
  var BTN_MAP = {
    posSwitch:'posSwitchBtn', bioEnroll:'bioEnrollBtn', extForm:'extFormBtn', posLogout:'posLogoutBtn',
    customers:'customersBtn', notif:'notifBtn', week:'weekBtn', dailyReport:'dailyReportBtn',
    admin:'adminLink', messages:'messagesBtn'
  };
  function applyUiButtons(cfg){
    cfg = cfg || _cfg; if(!cfg) return;
    var ui = cfg.ui || {}; var buttons = ui.buttons || {};
    var gScale = clampN(ui.iconScale,70,160,100);
    var user = FUser(); var mgr = FIsMgr();
    var ub = (user && user.perms && user.perms.buttons) || null;
    Object.keys(BTN_MAP).forEach(function(k){
      var el = document.getElementById(BTN_MAP[k]); if(!el) return;
      // الدردشة الجماعية متاحة للجميع دائماً — لا تخفِها
      if(k === 'messages'){ el.classList.remove('ui-hidden'); var ms=buttons[k]||{scale:100}; el.style.fontSize = Math.round(gScale*(Number(ms.scale)||100)/100)+'%'; return; }
      var b = buttons[k] || {show:true, scale:100};
      var visible = (b.show !== false);
      if(visible && !mgr && ub && ub[k] === false) visible = false;
      el.classList.toggle('ui-hidden', !visible);
      var sc = Math.round(gScale * (Number(b.scale)||100) / 100);
      el.style.fontSize = sc + '%';
    });
  }
  window.applyUiButtons = applyUiButtons;
  window.featuresOnUserChange = function(){ applyUiButtons(_cfg); refreshMsgBadge(); };

  // ---------- حقن واجهة الدردشة والمكالمات ----------
  var UI = ''+
  '<div class="fx-modal" id="chatModal"><div class="fx-box">'+
    '<div class="fx-head"><h3>💬 الدردشة الجماعية</h3>'+
      '<div style="display:flex;gap:6px">'+
        '<button class="fx-x" id="chatCallA" title="مكالمة صوت">📞</button>'+
        '<button class="fx-x" id="chatCallV" title="مكالمة فيديو">📹</button>'+
        '<button class="fx-x" id="chatClose">✕</button>'+
      '</div></div>'+
    '<div class="fx-body" id="chatBody"><div class="chat-list" id="chatList"><div class="chat-empty">لا توجد رسائل بعد</div></div></div>'+
    '<div class="chat-foot">'+
      '<button class="chat-ic" id="chatImgBtn" title="إرسال صورة">🖼️</button>'+
      '<input type="file" id="chatImgFile" accept="image/*" style="display:none" />'+
      '<button class="chat-ic" id="chatMicBtn" title="رسالة صوتية">🎙️</button>'+
      '<input type="text" id="chatInput" placeholder="اكتب رسالة..." />'+
      '<button class="chat-ic send" id="chatSendBtn" title="إرسال">➤</button>'+
    '</div>'+
  '</div></div>'+
  '<div class="call-overlay" id="callOverlay">'+
    '<div class="call-videos" id="callVideos" style="display:none"><video id="fxRemoteVid" autoplay playsinline></video><video id="fxLocalVid" autoplay playsinline muted></video></div>'+
    '<div class="call-name" id="callName"></div>'+
    '<div class="call-status" id="callStatus"></div>'+
    '<div class="call-btns" id="callBtns"></div>'+
  '</div>'+
  '<audio id="callRing" loop src="data:audio/wav;base64,UklGRl9vAAA="></audio>';
  (function injectUI(){ var d = document.createElement('div'); d.id='fxUIRoot'; d.innerHTML = UI; document.body.appendChild(d); })();

  function $(id){ return document.getElementById(id); }

  // ---------- الاشتراك في الإعدادات ----------
  try{ if(window.DB && DB.onSettings){ DB.onSettings(function(cfg){ _cfg = cfg; applyUiButtons(cfg); applyChatEnabled(); }); } }catch(e){}
  function applyChatEnabled(){
    // الدردشة الجماعية متاحة لكل المستخدمين دائماً
    var mb = $('messagesBtn'); if(!mb) return;
    mb.classList.remove('ui-hidden');
  }

  // ---------- (2) الدردشة + مركز الرسائل ----------
  var _msgs = [];
  var _chatOpen = false;
  function lastSeenTs(){ try{ return Number(localStorage.getItem('chat_last_seen_'+meId())||'0'); }catch(e){ return 0; } }
  function setLastSeen(ts){ try{ localStorage.setItem('chat_last_seen_'+meId(), String(ts||Date.now())); }catch(e){} }
  function refreshMsgBadge(){
    var btn = $('messagesBtn'); if(!btn) return;
    var badge = btn.querySelector('.fx-badge');
    var seen = lastSeenTs();
    var n = _msgs.filter(function(m){ return m.type!=='call' && m.user!==meId() && (m.createdAt||0) > seen; }).length;
    if(n>0){ if(!badge){ badge=document.createElement('span'); badge.className='fx-badge'; btn.appendChild(badge); } badge.textContent = n>99?'99+':String(n); }
    else if(badge){ badge.remove(); }
  }
  window.refreshMsgBadge = refreshMsgBadge;

  function renderChat(){
    var list = $('chatList'); if(!list) return;
    if(!_msgs.length){ list.innerHTML = '<div class="chat-empty">لا توجد رسائل بعد — ابدأ المحادثة 👋</div>'; return; }
    var html = '';
    _msgs.forEach(function(m){
      if(m.type==='call'){ html += '<div class="chat-msg call">'+esc(m.text||'')+' · '+timeStr(m.createdAt)+'</div>'; return; }
      var mine = (m.user === meId());
      var inner = '';
      // اسم المرسِل يظهر على كل رسالة (حتى رسائلي)
      inner += '<div class="cm-who">'+esc(m.name||m.user||'')+(mine?' (أنا)':'')+'</div>';
      if(m.type==='image' && m.data){ inner += '<img class="cm-img" src="'+m.data+'" alt="صورة" data-img="1" />'; }
      else if(m.type==='voice' && m.data){ inner += '<audio controls src="'+m.data+'"></audio>'; }
      if(m.text) inner += '<div>'+esc(m.text)+'</div>';
      inner += '<div class="cm-time">'+timeStr(m.createdAt)+'</div>';
      html += '<div class="chat-msg'+(mine?' mine':'')+'">'+inner+'</div>';
    });
    list.innerHTML = html;
    list.querySelectorAll('img[data-img]').forEach(function(im){ im.onclick=function(){ window.open(im.src,'_blank'); }; });
    var body = $('chatBody'); if(body) body.scrollTop = body.scrollHeight;
  }

  try{
    if(window.DB && DB.onChatMessages){
      DB.onChatMessages(function(msgs){
        var prevLen = _msgs.length;
        _msgs = msgs || [];
        if(_chatOpen){ renderChat(); setLastSeen(Date.now()); }
        refreshMsgBadge();
        // إشعار نظام عند وصول رسالة جديدة من طرف آخر
        if(msgs && msgs.length>prevLen && prevLen>0){
          var last = msgs[msgs.length-1];
          if(last && last.user!==meId() && last.type!=='call' && FUser()){
            try{ if(typeof addNotification==='function') addNotification('💬 رسالة جديدة من '+(last.name||''), (last.type==='image'?'🖼️ صورة':last.type==='voice'?'🎙️ رسالة صوتية':(last.text||'')), '💬'); }catch(e){}
          }
        }
      });
    }
  }catch(e){}

  function openChat(){
    if(!FUser()){ FToast('سجّل الدخول أولاً'); return; }
    _chatOpen = true; $('chatModal').classList.add('show'); renderChat(); setLastSeen(Date.now()); refreshMsgBadge();
    setTimeout(function(){ var i=$('chatInput'); if(i) i.focus(); }, 50);
  }
  function closeChat(){ _chatOpen=false; $('chatModal').classList.remove('show'); }

  async function sendText(){
    var inp = $('chatInput'); if(!inp) return; var t = inp.value.trim(); if(!t) return;
    inp.value='';
    try{ await DB.addChatMessage({ user:meId(), name:meName(), type:'text', text:t }); }
    catch(e){ FToast('تعذر الإرسال'); }
  }
  function readFileAsDataURL(file){ return new Promise(function(res,rej){ var r=new FileReader(); r.onload=function(){ res(r.result); }; r.onerror=rej; r.readAsDataURL(file); }); }
  // تصغير الصورة قبل الرفع (توفير مساحة Firestore)
  function shrinkImage(dataURL, maxW){
    return new Promise(function(res){
      var img=new Image();
      img.onload=function(){
        var w=img.width, h=img.height; maxW=maxW||1000;
        if(w>maxW){ h=Math.round(h*maxW/w); w=maxW; }
        var c=document.createElement('canvas'); c.width=w; c.height=h;
        c.getContext('2d').drawImage(img,0,0,w,h);
        try{ res(c.toDataURL('image/jpeg',0.72)); }catch(e){ res(dataURL); }
      };
      img.onerror=function(){ res(dataURL); };
      img.src=dataURL;
    });
  }
  async function sendImage(file){
    if(!file) return;
    try{
      var raw = await readFileAsDataURL(file);
      var small = await shrinkImage(raw, 1000);
      if(small.length > 900000){ FToast('الصورة كبيرة جداً'); return; }
      await DB.addChatMessage({ user:meId(), name:meName(), type:'image', data:small });
    }catch(e){ FToast('تعذر إرسال الصورة'); }
  }

  // تسجيل الرسائل الصوتية
  var _rec=null, _recChunks=[], _recStream=null;
  async function toggleMic(){
    var btn=$('chatMicBtn');
    if(_rec && _rec.state==='recording'){ _rec.stop(); return; }
    if(!navigator.mediaDevices || !window.MediaRecorder){ FToast('تسجيل الصوت غير مدعوم على هذا الجهاز'); return; }
    try{ _recStream = await navigator.mediaDevices.getUserMedia({audio:true}); }
    catch(e){ FToast('تعذر الوصول للميكروفون'); return; }
    _recChunks=[]; _rec=new MediaRecorder(_recStream);
    _rec.ondataavailable=function(ev){ if(ev.data && ev.data.size) _recChunks.push(ev.data); };
    _rec.onstop=async function(){
      try{ if(_recStream){ _recStream.getTracks().forEach(function(t){ t.stop(); }); } }catch(e){}
      btn.classList.remove('rec');
      var blob=new Blob(_recChunks, {type:(_rec.mimeType||'audio/webm')});
      if(blob.size>900000){ FToast('التسجيل طويل جداً'); return; }
      var data=await readFileAsDataURL(blob);
      try{ await DB.addChatMessage({ user:meId(), name:meName(), type:'voice', data:data }); }
      catch(e){ FToast('تعذر إرسال الرسالة الصوتية'); }
    };
    _rec.start(); btn.classList.add('rec'); FToast('🎙️ جارٍ التسجيل... اضغط مجدداً للإيقاف والإرسال');
  }

  // ---------- (3) المكالمات (WebRTC عبر Firestore) ----------
  var ICE_CFG = { iceServers:[{urls:'stun:stun.l.google.com:19302'},{urls:'stun:stun1.l.google.com:19302'}] };
  var _pc=null, _localStream=null, _callDocRef=null, _callUnsub=[], _callActive=false, _ringTimer=null;

  function fbOK(){ try{ return !!(window.DB && DB.fb && DB.fb()); }catch(e){ return false; } }
  function showCallOverlay(name, status, videos){
    $('callName').textContent = name||''; $('callStatus').textContent = status||'';
    $('callVideos').style.display = videos ? '' : 'none';
    $('callOverlay').classList.add('show');
  }
  function setCallStatus(s){ var el=$('callStatus'); if(el) el.textContent=s; }
  function hideCallOverlay(){ $('callOverlay').classList.remove('show'); $('callBtns').innerHTML=''; }
  function stopRing(){ try{ var r=$('callRing'); if(r){ r.pause(); r.currentTime=0; } }catch(e){} }

  function cleanupCall(){
    _callActive=false; stopRing();
    try{ _callUnsub.forEach(function(u){ try{ u(); }catch(e){} }); }catch(e){} _callUnsub=[];
    if(_ringTimer){ clearTimeout(_ringTimer); _ringTimer=null; }
    try{ if(_pc){ _pc.ontrack=null; _pc.onicecandidate=null; _pc.close(); } }catch(e){} _pc=null;
    try{ if(_localStream){ _localStream.getTracks().forEach(function(t){ t.stop(); }); } }catch(e){} _localStream=null;
    var rv=$('fxRemoteVid'), lv=$('fxLocalVid'); if(rv) rv.srcObject=null; if(lv) lv.srcObject=null;
    _callDocRef=null; hideCallOverlay();
  }

  async function getMedia(video){
    return navigator.mediaDevices.getUserMedia({ audio:true, video: video ? {facingMode:'user'} : false });
  }
  function attachLocal(stream, video){
    _localStream=stream;
    if(video){ var lv=$('fxLocalVid'); if(lv) lv.srcObject=stream; }
    stream.getTracks().forEach(function(t){ _pc.addTrack(t, stream); });
  }
  function wireRemote(){
    _pc.ontrack=function(ev){ var rv=$('fxRemoteVid'); if(rv && ev.streams[0]) rv.srcObject=ev.streams[0]; };
  }

  // --- بدء مكالمة (المتصل) ---
  async function startCall(type){
    if(!FUser()){ FToast('سجّل الدخول أولاً'); return; }
    if(!fbOK()){ FToast('المكالمات تتطلب الاتصال السحابي (Firebase)'); return; }
    if(_callActive){ FToast('توجد مكالمة جارية'); return; }
    var video = (type==='video');
    var stream;
    try{ stream = await getMedia(video); }catch(e){ FToast('تعذر الوصول للكاميرا/الميكروفون'); return; }
    _callActive=true;
    var fb=DB.fb();
    _callDocRef = fb.collection('calls').doc();
    _pc = new RTCPeerConnection(ICE_CFG); wireRemote(); attachLocal(stream, video);
    var callerCand = _callDocRef.collection('callerCandidates');
    _pc.onicecandidate=function(ev){ if(ev.candidate) callerCand.add(ev.candidate.toJSON()).catch(function(){}); };
    var offer = await _pc.createOffer(); await _pc.setLocalDescription(offer);
    await _callDocRef.set({ from:meId(), fromName:meName(), type:type, status:'ringing',
      offer:{type:offer.type, sdp:offer.sdp}, answer:null, createdAt:Date.now() });
    closeChat(); showCallOverlay('طاقم العمل', (video?'📹':'📞')+' جارٍ الاتصال...', video);
    $('callBtns').innerHTML='<button class="call-cbtn decline" id="callHangBtn">📴</button>';
    $('callHangBtn').onclick=function(){ endCall('ended'); };
    // استماع للرد + ICE الطرف الآخر
    _callUnsub.push(_callDocRef.onSnapshot(function(snap){
      var d=snap.data(); if(!d) return;
      if(d.answer && _pc && !_pc.currentRemoteDescription){
        _pc.setRemoteDescription(new RTCSessionDescription(d.answer)).catch(function(){});
        setCallStatus('✅ تم الرد — '+(d.answeredByName||''));
      }
      if(d.status==='declined'){ FToast('تم رفض المكالمة'); endCall('declined'); }
      if(d.status==='ended'){ endCall('ended'); }
    }));
    _callUnsub.push(_callDocRef.collection('calleeCandidates').onSnapshot(function(snap){
      snap.docChanges().forEach(function(ch){ if(ch.type==='added' && _pc){ _pc.addIceCandidate(new RTCIceCandidate(ch.doc.data())).catch(function(){}); } });
    }));
    _ringTimer=setTimeout(function(){ if(_pc && !_pc.currentRemoteDescription){ FToast('لا يوجد رد'); endCall('ended'); } }, 45000);
    logCall((video?'📹 مكالمة فيديو':'📞 مكالمة صوت')+' بدأها '+meName());
  }

  // --- الرد على مكالمة (المستقبِل) ---
  async function answerCall(callId, d){
    if(_callActive) return;
    var video = (d.type==='video');
    var stream;
    try{ stream = await getMedia(video); }catch(e){ FToast('تعذر الوصول للكاميرا/الميكروفون'); return; }
    _callActive=true; stopRing();
    var fb=DB.fb(); _callDocRef = fb.collection('calls').doc(callId);
    _pc=new RTCPeerConnection(ICE_CFG); wireRemote(); attachLocal(stream, video);
    var calleeCand=_callDocRef.collection('calleeCandidates');
    _pc.onicecandidate=function(ev){ if(ev.candidate) calleeCand.add(ev.candidate.toJSON()).catch(function(){}); };
    await _pc.setRemoteDescription(new RTCSessionDescription(d.offer));
    var ans=await _pc.createAnswer(); await _pc.setLocalDescription(ans);
    await _callDocRef.update({ answer:{type:ans.type, sdp:ans.sdp}, status:'accepted', answeredBy:meId(), answeredByName:meName() });
    showCallOverlay(d.fromName||'', '✅ متصل مع '+(d.fromName||''), video);
    $('callBtns').innerHTML='<button class="call-cbtn decline" id="callHangBtn">📴</button>';
    $('callHangBtn').onclick=function(){ endCall('ended'); };
    _callUnsub.push(_callDocRef.collection('callerCandidates').onSnapshot(function(snap){
      snap.docChanges().forEach(function(ch){ if(ch.type==='added' && _pc){ _pc.addIceCandidate(new RTCIceCandidate(ch.doc.data())).catch(function(){}); } });
    }));
    _callUnsub.push(_callDocRef.onSnapshot(function(snap){ var x=snap.data(); if(x && x.status==='ended'){ endCall('ended'); } }));
  }

  function endCall(reason){
    try{ if(_callDocRef && reason){ _callDocRef.update({ status:reason }).catch(function(){}); } }catch(e){}
    cleanupCall();
  }

  function logCall(text){ try{ DB.addChatMessage({ user:meId(), name:meName(), type:'call', text:text }); }catch(e){} }

  // --- استقبال المكالمات الواردة ---
  var _incomingUnsub=null, _handledCalls={};
  function listenIncoming(){
    if(!fbOK() || _incomingUnsub) return;
    var fb=DB.fb(); var since=Date.now()-60000;
    _incomingUnsub = fb.collection('calls').where('status','==','ringing').onSnapshot(function(snap){
      snap.docChanges().forEach(function(ch){
        if(ch.type!=='added') return;
        var d=ch.doc.data(); var id=ch.doc.id;
        if(!d || d.from===meId() || _handledCalls[id]) return;
        if((d.createdAt||0) < since) return;
        if(_callActive) return;
        _handledCalls[id]=true; promptIncoming(id, d);
      });
    });
  }
  function promptIncoming(id, d){
    try{ var r=$('callRing'); if(r) r.play().catch(function(){}); }catch(e){}
    showCallOverlay(d.fromName||'', (d.type==='video'?'📹':'📞')+' مكالمة واردة...', false);
    $('callBtns').innerHTML='<button class="call-cbtn accept" id="callAccBtn">✔</button><button class="call-cbtn decline" id="callDecBtn">✕</button>';
    $('callAccBtn').onclick=function(){ stopRing(); answerCall(id, d); };
    $('callDecBtn').onclick=function(){ stopRing(); try{ DB.fb().collection('calls').doc(id).update({status:'declined'}).catch(function(){}); }catch(e){} hideCallOverlay(); };
    // إنهاء الرنين تلقائياً بعد 40ث
    setTimeout(function(){ if(!_callActive){ stopRing(); if(!$('callOverlay').classList.contains('show')) return; var d2=$('callName'); if(d2 && d2.textContent===(d.fromName||'')){ hideCallOverlay(); } } }, 42000);
  }

  // ---------- ربط الأزرار والتهيئة ----------
  function wire(){
    var mb=$('messagesBtn'); if(mb) mb.onclick=openChat;
    var x;
    if(x=$('chatClose')) x.onclick=closeChat;
    if(x=$('chatSendBtn')) x.onclick=sendText;
    if(x=$('chatInput')) x.onkeydown=function(e){ if(e.key==='Enter'){ e.preventDefault(); sendText(); } };
    if(x=$('chatImgBtn')) x.onclick=function(){ var f=$('chatImgFile'); if(f) f.click(); };
    if(x=$('chatImgFile')) x.onchange=function(){ if(this.files && this.files[0]){ sendImage(this.files[0]); this.value=''; } };
    if(x=$('chatMicBtn')) x.onclick=toggleMic;
    if(x=$('chatCallA')) x.onclick=function(){ startCall('audio'); };
    if(x=$('chatCallV')) x.onclick=function(){ startCall('video'); };
    var cm=$('chatModal'); if(cm) cm.onclick=function(e){ if(e.target===cm) closeChat(); };
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', wire); else wire();

  // تشغيل مستمع المكالمات الواردة عند توفر السحابة + تسجيل الدخول
  setInterval(function(){ if(FUser() && fbOK() && !_incomingUnsub) listenIncoming(); }, 2500);
  setTimeout(function(){ if(FUser() && fbOK()) listenIncoming(); applyUiButtons(_cfg); }, 1500);
})();

