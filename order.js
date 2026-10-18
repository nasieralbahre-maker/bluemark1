/* =====================================================================
   order.js — صفحة استمارة الطلب العامة (دون تسجيل دخول)
   تقرأ ?f=token ثم تعرض نموذجاً يملؤه العميل وتحفظه في Firestore.
   ===================================================================== */
(function(){
  'use strict';

  var CURRENCIES = {
    YER:{symbol:'ر.ي'}, SAR:{symbol:'ر.س'}, USD:{symbol:'$'}, AED:{symbol:'د.إ'},
    EGP:{symbol:'ج.م'}, QAR:{symbol:'ر.ق'}, OMR:{symbol:'ر.ع'}, KWD:{symbol:'د.ك'},
    JOD:{symbol:'د.أ'}, EUR:{symbol:'€'}
  };

  var SETTINGS=null, MENU=[], FORM=null, SYM='ر.ي';
  var sel={}, theme=false, deposit=false, depType='إيداع', exIdx=0, hasWa=false, cdTimer=null, sending=false;

  function $(id){ return document.getElementById(id); }
  function esc(s){ return String(s==null?'':s).replace(/[&<>"']/g, function(c){ return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]; }); }
  function money(n){ return (Math.round(n*100)/100) + ' ' + SYM; }
  function toast(msg){ var t=$('toast'); if(!t) return; t.textContent=msg; t.classList.add('show'); clearTimeout(t._t); t._t=setTimeout(function(){ t.classList.remove('show'); }, 2600); }
  function showOnly(id){ ['loadingState','errorState','doneState','formState'].forEach(function(x){ var el=$(x); if(el) el.classList.toggle('hidden', x!==id); }); }
  function fail(title, msg){ if(title) $('errTitle').textContent=title; if(msg) $('errMsg').textContent=msg; showOnly('errorState'); }

  function token(){
    try{ return new URLSearchParams(location.search).get('f')||''; }
    catch(e){ var m=location.search.match(/[?&]f=([^&]+)/); return m?decodeURIComponent(m[1]):''; }
  }

  function fmt(ms){
    if(ms<=0) return 'انتهت الصلاحية';
    var h=Math.floor(ms/3600000), m=Math.floor((ms%3600000)/60000), s=Math.floor((ms%60000)/1000);
    if(h>0) return h+' ساعة و '+m+' دقيقة';
    if(m>0) return m+' دقيقة و '+s+' ثانية';
    return s+' ثانية';
  }

  // انتظار جاهزية Firebase + DB
  function waitReady(cb){
    var tries=0;
    (function loop(){
      tries++;
      if(typeof DB!=='undefined' && DB.getOrderFormByToken){ cb(); return; }
      if(tries>60){ fail('تعذر الاتصال','تعذر الاتصال بالخادم. تحقق من اتصال الإنترنت ثم أعد المحاولة.'); return; }
      setTimeout(loop, 250);
    })();
  }

  var cfg = {};
  function cfgFrom(s){
    var c=(s&&s.custForm)?s.custForm:{};
    return {
      validHours:Math.max(1,parseInt(c.validHours,10)||24),
      askName:c.askName!==false, nameRequired:c.nameRequired!==false,
      askPhone:c.askPhone!==false, phoneRequired:c.phoneRequired===true,
      askWhatsapp:c.askWhatsapp!==false, askDeposit:c.askDeposit!==false,
      askTheme:c.askTheme!==false, askPickup:c.askPickup!==false,
      extraFields:Array.isArray(c.extraFields)?c.extraFields:[],
      occasions:(Array.isArray(c.occasions)&&c.occasions.length)?c.occasions:['مولود','مولودة','توم','زواج','خطوبة'],
      title:(typeof c.title==='string')?c.title:'',
      introText:(typeof c.introText==='string')?c.introText:'',
      fontSize:Math.min(26,Math.max(11,parseInt(c.fontSize,10)||15)),
      showCreator:c.showCreator!==false,
      sectionOrder:(Array.isArray(c.sectionOrder)&&c.sectionOrder.length)?c.sectionOrder:['items','customer','pay','theme','pickup','extra','note']
    };
  }

  async function start(){
    var tk=token();
    if(!tk){ fail('رابط غير صحيح','لا يحتوي هذا الرابط على رمز استمارة صالح.'); return; }
    for(var attempt=0; attempt<2; attempt++){
      try { FORM = await DB.getOrderFormByToken(tk); if(FORM) break; }
      catch(e){ FORM = null; console.warn('[order.js] getOrderFormByToken failed (attempt '+ (attempt+1) +'): ', e && e.message); }
      if(FORM) break;
      if(attempt===0) await new Promise(function(r){ setTimeout(r,900); });
    }
    if(!FORM){ fail('الرابط غير موجود','لم نعثر على هذه الاستمارة. تأكد من الرابط أو اطلب رابطاً جديداً.'); return; }
    if(FORM.active===false){ fail('الرابط متوقّف','تم إيقاف هذا الرابط. تواصل مع المتجر.'); return; }
    if(FORM.expiresAt && Date.now()>FORM.expiresAt){ fail('انتهت صلاحية الرابط','هذا الرابط منتهٍ. تواصل مع المتجر للحصول على رابط جديد.'); return; }
    for(var k=0; k<2; k++){
      try{
        SETTINGS = await DB.getSettings();
        MENU = await DB.getMenu();
        break;
      }catch(e){ SETTINGS=SETTINGS||{}; MENU=MENU||[]; await new Promise(function(r){ setTimeout(r,400); }); }
    }
    SETTINGS = SETTINGS || {}; MENU = MENU || [];
    SYM = (CURRENCIES[(SETTINGS&&SETTINGS.currency)]||CURRENCIES.YER).symbol;
    cfg = cfgFrom(SETTINGS);
    render();
  }  // رابط المتابعة الموحّد (same origin when hosted; safe Firebase fallback for local files)
  function appFormBaseUrl(){
    try{
      if(window.location && (location.protocol === 'https:' || location.protocol === 'http:')){
        return location.origin.replace(/\/$/, '') + '/';
      }
    }catch(e){}
    return 'https://bluemark1.netlify.app/';
  }
  function trackUrl(){
    return appFormBaseUrl() + 'track.html?t=' + encodeURIComponent(FORM.token||'');
  }
  function qrImg(text, cell){
    try{
      if(typeof qrcode==='undefined' || !text) return '';
      var qr=qrcode(0,'M'); qr.addData(String(text)); qr.make();
      return qr.createDataURL(cell||4, 8);
    }catch(e){ return ''; }
  }
  function paintQr(boxId, text){
    var box=$(boxId); if(!box) return;
    var d=qrImg(text, 5);
    box.innerHTML = d ? ('<img src="'+d+'" alt="QR" width="168" height="168">') : '';
  }

  function render(){
    $('shopName').textContent = (SETTINGS&&(SETTINGS.headerBrand||SETTINGS.name)) || 'المتجر';
    // عنوان الاستمارة (اختياري): أولوية لعنوان الرابط ثم العنوان الافتراضي من الإعدادات
    var titleEl=$('formTitle');
    var tTxt=(FORM.title&&FORM.title.trim())?FORM.title:(cfg.title||'');
    if(titleEl){ if(tTxt){ titleEl.textContent=tTxt; titleEl.classList.remove('hidden'); } else { titleEl.classList.add('hidden'); } }
    // حجم خط الاستمارة
    try{ document.body.style.fontSize = cfg.fontSize + 'px'; }catch(e){}
    // النص التمهيدي القابل للتعديل من لوحة التحكم
    renderIntro();
    if(FORM.note){ var n=$('formNote'); n.textContent='📝 '+FORM.note; n.classList.remove('hidden'); }
    // رمز الاستمارة الموحّد (يظهر للعميل داخل الاستمارة)
    try{
      if(FORM.token){ paintQr('formQr', trackUrl()); var fw=$('formQrWrap'); if(fw) fw.classList.remove('hidden'); }
    }catch(e){}
    renderItems();
    renderCust();
    renderPay();
    renderTheme();
    renderPickup();
    renderExtra();
    renderCreator();
    applySectionOrder();
    recalc();
    showOnly('formState');
    startCountdown();
    $('formState').addEventListener('submit', submit);
    wireShareButtons();
  }

  // النص التمهيدي أعلى الاستمارة
  function renderIntro(){
    var host=$('formNote');
    var el=$('introText');
    if(!cfg.introText){ if(el) el.classList.add('hidden'); return; }
    if(!el){
      el=document.createElement('div');
      el.id='introText';
      el.className='note';
      if(host&&host.parentNode) host.parentNode.insertBefore(el, host);
    }
    el.innerHTML = esc(cfg.introText).replace(/\n/g,'<br>');
    el.classList.remove('hidden');
  }

  // اسم المنشئ في نهاية الاستمارة
  function renderCreator(){
    var box=$('extraBox');
    var old=$('creatorBox'); if(old) old.remove();
    if(!cfg.showCreator) return;
    var nm=FORM.createdByName||'';
    if(!nm) return;
    var el=document.createElement('div');
    el.id='creatorBox';
    el.className='sec';
    el.innerHTML='<div style="text-align:center;color:#64748b;font-size:13px;border-top:1px dashed #cbd5e1;padding-top:10px;margin-top:4px">👤 أنشأ الاستمارة: '+esc(nm)+'</div>';
    if(box&&box.parentNode) box.parentNode.insertBefore(el, box.nextSibling);
  }

  // إعادة ترتيب أقسام الاستمارة حسب الإعدادات
  function applySectionOrder(){
    var itemsSec=$('itemsBox')?$('itemsBox').closest('.sec'):null;
    var noteSec=$('custNote')?$('custNote').closest('.sec'):null;
    var map={ items:itemsSec, customer:$('custBox'), pay:$('payBox'), theme:$('themeBox'), pickup:$('pickupBox'), extra:$('extraBox'), note:noteSec };
    var order=cfg.sectionOrder.slice();
    ['items','customer','pay','theme','pickup','extra','note'].forEach(function(k){ if(order.indexOf(k)===-1) order.push(k); });
    // نقطة الإدراج: قبل صندوق الإجماليات
    var totalsEl=document.querySelector('#formState .totals');
    if(!totalsEl||!totalsEl.parentNode) return;
    var parent=totalsEl.parentNode;
    order.forEach(function(k){ var el=map[k]; if(el&&el.parentNode===parent) parent.insertBefore(el, totalsEl); });
  }

  function renderItems(){
    var box=$('itemsBox'), h='';
    if(!MENU.length){ box.innerHTML='<p style="color:#64748b;font-size:13px">لا توجد أصناف متاحة حالياً.</p>'; return; }
    // تجميع الأصناف حسب التصنيف (قوائم منسدلة قابلة للطي)
    var groups={}, cats=[];
    MENU.forEach(function(m){
      if(m.available===false) return;
      var cat=((m.cat||'').toString().trim())||'أصناف أخرى';
      if(!groups[cat]){ groups[cat]=[]; cats.push(cat); }
      groups[cat].push(m);
    });
    // مربع البحث
    h+='<div class="field" style="margin-bottom:10px"><input class="inp" id="itemSearch" placeholder="🔍 ابحث عن صنف…"></div>';
    cats.forEach(function(cat,ci){
      h+='<details class="catgrp"'+(ci===0?' open':'')+' style="margin-bottom:8px;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">'+
        '<summary style="padding:10px 12px;font-weight:700;font-size:14px;background:#f1f5f9;cursor:pointer;">'+esc(cat)+' <span style="color:#64748b;font-weight:400">('+groups[cat].length+')</span></summary>'+
        '<div style="padding:8px">';
      groups[cat].forEach(function(m){
        var id=String(m.id);
        h+='<div class="item" data-name="'+esc((m.name||'').toLowerCase())+'">'+
          '<span class="emo">'+(m.emoji||'🍽️')+'</span>'+
          '<span class="info"><div class="nm">'+esc(m.name)+'</div><div class="pr">'+money(m.price)+'</div></span>'+
          '<span class="step"><button type="button" class="minus" data-id="'+esc(id)+'">−</button>'+
          '<span class="q" id="q_'+esc(id)+'">'+(sel[id]||0)+'</span>'+
          '<button type="button" class="plus" data-id="'+esc(id)+'">+</button></span></div>';
      });
      h+='</div></details>';
    });
    box.innerHTML=h;
    box.querySelectorAll('.plus').forEach(function(b){ b.onclick=function(){ step(b.dataset.id,1); }; });
    box.querySelectorAll('.minus').forEach(function(b){ b.onclick=function(){ step(b.dataset.id,-1); }; });
    var srch=$('itemSearch');
    if(srch) srch.oninput=function(){
      var q=(srch.value||'').trim().toLowerCase();
      box.querySelectorAll('.catgrp').forEach(function(grp){
        var any=false;
        grp.querySelectorAll('.item').forEach(function(it){
          var match=!q || (it.getAttribute('data-name')||'').indexOf(q)>-1;
          it.style.display=match?'':'none';
          if(match) any=true;
        });
        grp.style.display=any?'':'none';
        if(q&&any) grp.open=true;
      });
    };
  }
  function step(id,d){
    sel[id]=Math.max(0,(sel[id]||0)+d);
    var q=$('q_'+id); if(q) q.textContent=sel[id];
    recalc();
  }

  function renderCust(){
    if(!(cfg.askName||cfg.askPhone||cfg.askWhatsapp)){ $('custBox').innerHTML=''; return; }
    var h='<div class="sec"><h3>👤 بياناتك</h3>';
    if(cfg.askName) h+='<div class="field"><label>الاسم'+(cfg.nameRequired?' <span class="req">*</span>':'')+'</label><input class="inp" id="fName" maxlength="60" placeholder="اسمك"></div>';
    if(cfg.askPhone) h+='<div class="field"><label>رقم الجوال'+(cfg.phoneRequired?' <span class="req">*</span>':'')+'</label><input class="inp" id="fPhone" inputmode="tel" maxlength="20" placeholder="05xxxxxxxx"></div>';
    if(cfg.askWhatsapp) h+='<label class="check"><input type="checkbox" id="fWa"> لديّ واتساب على هذا الرقم</label>';
    h+='</div>';
    $('custBox').innerHTML=h;
  }

  function renderPay(){
    if(!cfg.askDeposit){ $('payBox').innerHTML=''; return; }
    var ex=(SETTINGS&&Array.isArray(SETTINGS.exchanges))?SETTINGS.exchanges:[];
    var h='<div class="sec"><h3>💳 طريقة الدفع</h3>'+
      '<label class="check"><input type="checkbox" id="fDep"> إيداع أو حوالة (بدل النقد)</label>'+
      '<div id="depDetail" class="hidden" style="margin-top:8px">'+
        '<div class="chips" id="depTypeChips"><button type="button" class="chip on" data-t="إيداع">إيداع</button><button type="button" class="chip" data-t="حوالة">حوالة</button></div>';
    if(ex.length){
      h+='<div class="field"><label>الصرّاف</label><select class="inp" id="fEx">';
      ex.forEach(function(e,i){ h+='<option value="'+i+'">'+esc(e.name)+'</option>'; });
      h+='</select></div>';
    }
    h+='</div></div>';
    $('payBox').innerHTML=h;
    var dep=$('fDep'), detail=$('depDetail');
    dep.onchange=function(){ deposit=dep.checked; detail.classList.toggle('hidden', !deposit); };
    var chips=$('depTypeChips');
    if(chips) chips.querySelectorAll('.chip').forEach(function(ch){ ch.onclick=function(){ chips.querySelectorAll('.chip').forEach(function(x){ x.classList.remove('on'); }); ch.classList.add('on'); depType=ch.dataset.t; }; });
  }

  function renderTheme(){
    if(!cfg.askTheme){ $('themeBox').innerHTML=''; return; }
    var h='<div class="sec"><h3>🎁 الثيم</h3>'+
      '<div class="chips"><button type="button" class="chip on" id="noTheme">بدون ثيم</button><button type="button" class="chip" id="yesTheme">مع ثيم</button></div>'+
      '<div id="themeDetail" class="hidden">'+
        '<div class="field"><label>المناسبة</label><select class="inp" id="fOcc"><option value="">— اختر —</option>';
    cfg.occasions.forEach(function(o){ h+='<option value="'+esc(o)+'">'+esc(o)+'</option>'; });
    h+='</select></div>'+
      '<div class="field"><label>نص الثيم (اختياري)</label><input class="inp" id="fTxt" maxlength="80" placeholder="مثال: اسم المحتفى به"></div>'+
      '</div></div>';
    $('themeBox').innerHTML=h;
    var no=$('noTheme'), yes=$('yesTheme'), detail=$('themeDetail');
    no.onclick=function(){ theme=false; no.classList.add('on'); yes.classList.remove('on'); detail.classList.add('hidden'); };
    yes.onclick=function(){ theme=true; yes.classList.add('on'); no.classList.remove('on'); detail.classList.remove('hidden'); };
  }

  function renderPickup(){
    if(!cfg.askPickup){ $('pickupBox').innerHTML=''; return; }
    $('pickupBox').innerHTML='<div class="sec"><h3>📅 موعد الاستلام</h3>'+
      '<div class="field"><label>التاريخ</label><input type="date" class="inp" id="fPDate"></div>'+
      '<div class="field"><label>الوقت</label><input type="time" class="inp" id="fPTime"></div></div>';
  }

  function renderExtra(){
    if(!cfg.extraFields.length){ $('extraBox').innerHTML=''; return; }
    var h='<div class="sec"><h3>📋 خانات إضافية</h3>';
    cfg.extraFields.forEach(function(f,i){
      var lbl=f.label||('خانة '+(i+1));
      h+='<div class="field"><label>'+esc(lbl)+(f.required?' <span class="req">*</span>':'')+'</label>';
      if(f.type==='textarea') h+='<textarea class="inp" id="fx_'+i+'" rows="2"></textarea>';
      else if(f.type==='number') h+='<input type="number" class="inp" id="fx_'+i+'">';
      else h+='<input type="text" class="inp" id="fx_'+i+'" maxlength="120">';
      h+='</div>';
    });
    h+='</div>';
    $('extraBox').innerHTML=h;
  }

  function collectItems(){
    var items=[];
    Object.keys(sel).forEach(function(id){
      if(sel[id]>0){ var m=MENU.find(function(x){ return String(x.id)===String(id); }); if(m) items.push({id:m.id,name:m.name,price:m.price,emoji:m.emoji,qty:sel[id],wrapped:!!m.wrapped}); }
    });
    return items;
  }
  function totals(items){
    var sub=0; items.forEach(function(i){ sub+=i.price*i.qty; });
    var showVat=(SETTINGS&&SETTINGS.showVat===true);
    var rate=showVat?((SETTINGS&&SETTINGS.vatRate)||0):0;
    var vat=Math.round(sub*rate*100)/100;
    return {subtotal:Math.round(sub*100)/100,vat:vat,total:Math.round((sub+vat)*100)/100};
  }
  function recalc(){
    var t=totals(collectItems());
    $('tSub').textContent=money(t.subtotal);
    $('tVat').textContent=money(t.vat);
    $('tTot').textContent=money(t.total);
    $('tVatRow').classList.toggle('hidden', !(SETTINGS&&SETTINGS.showVat===true));
  }

  function startCountdown(){
    if(!FORM.expiresAt){ return; }
    var bar=$('countBar'); bar.classList.remove('hidden');
    function upd(){
      var left=FORM.expiresAt-Date.now();
      if(left<=0){ clearInterval(cdTimer); fail('انتهت صلاحية الرابط','هذا الرابط منتهٍ. تواصل مع المتجر للحصول على رابط جديد.'); return; }
      bar.textContent='⏱️ صلاحية الرابط: '+fmt(left);
    }
    upd(); cdTimer=setInterval(upd,1000);
  }

  async function submit(ev){
    ev.preventDefault();
    if(sending) return;
    if(FORM.expiresAt && Date.now()>FORM.expiresAt){ fail('انتهت صلاحية الرابط',''); return; }
    var items=collectItems();
    if(!items.length){ toast('اختر صنفاً واحداً على الأقل'); return; }
    var name=((($('fName')||{}).value)||'').trim();
    var phone=((($('fPhone')||{}).value)||'').trim();
    var wa=$('fWa'); hasWa=!!(wa&&wa.checked);
    if(cfg.askName&&cfg.nameRequired&&!name){ toast('أدخل اسمك'); return; }
    if(cfg.askPhone&&cfg.phoneRequired&&!phone){ toast('أدخل رقم الجوال'); return; }
    var extra={}, bad=false;
    cfg.extraFields.forEach(function(f,i){ var el=$('fx_'+i); var v=el?(el.value||'').trim():''; var k=f.label||('خانة '+(i+1)); extra[k]=v; if(f.required&&!v) bad=true; });
    if(bad){ toast('أكمل الخانات الإلزامية'); return; }
    var ex=null;
    if(deposit){ var arr=(SETTINGS&&SETTINGS.exchanges)||[]; var es=$('fEx'); ex=arr[es?parseInt(es.value,10):0]||arr[0]||null; }
    var occ=(($('fOcc')||{}).value)||'';
    var txt=((($('fTxt')||{}).value)||'').trim();
    var pDate=(($('fPDate')||{}).value)||'';
    var pTime=(($('fPTime')||{}).value)||'';
    var note=((($('custNote')||{}).value)||'').trim();
    var t=totals(items);
    var sub={
      token:FORM.token, createdBy:FORM.createdBy, createdByName:FORM.createdByName,
      name:name||'عميل', phone:phone, hasWa:hasWa,
      items:items.map(function(i){ return {name:i.name,price:i.price,qty:i.qty,emoji:i.emoji,wrapped:!!i.wrapped}; }),
      subtotal:t.subtotal, vat:t.vat, total:t.total,
      payMethod: deposit?'card':'cash',
      depositType: deposit?depType:'',
      exchangeName: (deposit&&ex)?ex.name:'',
      exchangeColor: (deposit&&ex)?(ex.color||''):'',
      theme: theme,
      themeData: theme?{occasion:occ,customText:txt}:false,
      pickupDate:pDate, pickupTime:pTime,
      note:note, status:'pending'
    };
    sending=true;
    var btn=$('sendBtn'); if(btn){ btn.disabled=true; btn.textContent='… جارٍ الإرسال'; }
    try{
      // تحقّق من الخادم (Firestore) لحظة الإرسال: الرابط ما زال نشطاً وغير منتهٍ ومنع الوصول غير المصرح به
      var fresh=null;
      try{ fresh = await DB.getOrderFormByToken(FORM.token); }catch(e){ fresh = null; }
      if(!fresh){ sending=false; if(btn){ btn.disabled=false; btn.textContent='📨 إرسال الطلب'; } fail('الرابط غير موجود','تعذّر العثور على هذه الاستمارة على الخادم. اطلب رابطاً جديداً.'); return; }
      if(fresh.active===false){ sending=false; if(btn){ btn.disabled=false; btn.textContent='📨 إرسال الطلب'; } fail('الرابط متوقّف','تم إيقاف هذا الرابط من المتجر.'); return; }
      if(fresh.expiresAt && Date.now()>fresh.expiresAt){ sending=false; if(btn){ btn.disabled=false; btn.textContent='📨 إرسال الطلب'; } fail('انتهت صلاحية الرابط','انتهت صلاحية هذا الرابط. اطلب رابطاً جديداً من المتجر.'); return; }
      await DB.addOrderSub(sub);
      if(cdTimer) clearInterval(cdTimer);
      try{
        var link=trackUrl();
        paintQr('doneQr', link);
        var a=$('doneTrackLink'); if(a) a.href=link;
      }catch(e){}
      showOnly('doneState');
    }catch(e){
      sending=false;
      if(btn){ btn.disabled=false; btn.textContent='📨 إرسال الطلب'; }
      toast('تعذر إرسال الطلب — تحقق من الاتصال وأعد المحاولة');
    }
  }

  // ====== جمع بيانات الاستمارة الحالية + بطاقة مشاركة مكتفية ذاتياً ======
  function collectFormData(){
    var items=collectItems();
    var t=totals(items);
    var ex=null;
    if(deposit){ var arr=(SETTINGS&&SETTINGS.exchanges)||[]; var es=$('fEx'); ex=arr[es?parseInt(es.value,10):0]||arr[0]||null; }
    var extra=[];
    (cfg.extraFields||[]).forEach(function(f,i){ var el=$('fx_'+i); var v=el?(el.value||'').trim():''; if(v) extra.push({k:f.label||('خانة '+(i+1)),v:v}); });
    return {
      name:((($('fName')||{}).value)||'').trim(),
      phone:((($('fPhone')||{}).value)||'').trim(),
      hasWa:!!(($('fWa')||{}).checked),
      items:items, subtotal:t.subtotal, vat:t.vat, total:t.total,
      deposit:deposit, depType:depType, exName:(deposit&&ex)?ex.name:'',
      theme:theme, occ:(($('fOcc')||{}).value)||'', txt:((($('fTxt')||{}).value)||'').trim(),
      pickupDate:(($('fPDate')||{}).value)||'', pickupTime:(($('fPTime')||{}).value)||'',
      note:((($('custNote')||{}).value)||'').trim(), extra:extra
    };
  }
  function brandName(){ return (SETTINGS&&(SETTINGS.headerBrand||SETTINGS.name))||'المتجر'; }
  // تبني بطاقة تحوي كل بيانات الاستمارة + الرمز + المنشئ + رقم الطلب (إن وُجد)
  function buildOrderCard(opts){
    opts=opts||{};
    var d=collectFormData();
    var qr=qrImg(trackUrl(), 5);
    var rows='';
    (d.items||[]).forEach(function(i){ rows+='<div style="display:flex;justify-content:space-between;gap:8px;padding:3px 0;font-size:13.5px;color:#0f172a;"><span>'+(i.emoji||'')+' '+esc(i.name)+' ×'+i.qty+'</span><span style="font-weight:700;">'+esc(money((i.price||0)*(i.qty||0)))+'</span></div>'; });
    if(!rows) rows='<div style="font-size:13px;color:#94a3b8;text-align:center;padding:4px 0;">لم تُختر أصناف بعد</div>';
    var extraH=''; d.extra.forEach(function(e){ extraH+='<div style="font-size:13px;"><b>'+esc(e.k)+':</b> '+esc(e.v)+'</div>'; });
    var badge = opts.orderNo
      ? '<div style="text-align:center;background:#dcfce7;color:#166534;border-radius:10px;padding:6px;margin-top:9px;font-size:13.5px;font-weight:700;">✅ طلب رقم #'+esc(opts.orderNo)+'</div>'
      : (opts.sent
          ? '<div style="text-align:center;background:#dbeafe;color:#1e40af;border-radius:10px;padding:6px;margin-top:9px;font-size:13px;font-weight:700;">📨 تم إرسال الطلب — بانتظار المصادقة</div>'
          : '<div style="text-align:center;background:#fef3c7;color:#92400e;border-radius:10px;padding:6px;margin-top:9px;font-size:13px;font-weight:700;">📝 استمارة طلب</div>');
    var h=''+
    '<div id="oShareCard" dir="rtl" style="font-family:\'Segoe UI\',Tahoma,sans-serif;background:#ffffff;color:#0f172a;border:1px solid #e2e8f0;border-radius:16px;padding:16px;width:360px;margin:0 auto;line-height:1.7;box-sizing:border-box;">'+
      '<div style="text-align:center;border-bottom:2px solid #1e3a8a;padding-bottom:8px;margin-bottom:10px;">'+
        '<div style="font-size:19px;font-weight:800;color:#1e3a8a;">'+esc(brandName())+'</div>'+
        '<div style="font-size:12.5px;color:#64748b;">'+esc((FORM&&FORM.title)||'استمارة طلب')+'</div>'+
      '</div>'+
      '<div style="text-align:center;margin:8px 0;">'+
        (qr?'<img src="'+qr+'" alt="QR" style="width:150px;height:150px;image-rendering:pixelated;background:#fff;padding:8px;border:1px solid #e2e8f0;border-radius:12px;" />':'')+
        '<div style="font-size:11.5px;color:#64748b;margin-top:4px;">🔳 امسح الرمز لمتابعة حالة طلبك</div>'+
      '</div>'+
      '<div style="background:#f8fafc;border-radius:12px;padding:10px 12px;">'+
        (d.name?'<div style="font-size:14px;"><b>العميل:</b> '+esc(d.name)+'</div>':'')+
        (d.phone?'<div style="font-size:13.5px;"><b>الجوال:</b> '+esc(d.phone)+(d.hasWa?' ✅ واتساب':'')+'</div>':'')+
        extraH+
        '<div style="border-top:1px dashed #cbd5e1;margin:7px 0;"></div>'+
        rows+
        '<div style="display:flex;justify-content:space-between;font-size:13px;color:#475569;"><span>الإجمالي الفرعي</span><span>'+esc(money(d.subtotal||0))+'</span></div>'+
        ((Number(d.vat)||0)>0?'<div style="display:flex;justify-content:space-between;font-size:13px;color:#475569;"><span>الضريبة</span><span>'+esc(money(d.vat||0))+'</span></div>':'')+
        '<div style="display:flex;justify-content:space-between;font-size:15px;font-weight:800;color:#1e3a8a;border-top:1px solid #e2e8f0;margin-top:6px;padding-top:6px;"><span>الإجمالي</span><span>'+esc(money(d.total||0))+'</span></div>'+
        (d.deposit?'<div style="font-size:13px;margin-top:5px;"><b>الدفع:</b> '+esc(d.depType||'إيداع')+(d.exName?(' — '+esc(d.exName)):'')+'</div>':'')+
        (d.theme?'<div style="font-size:13px;"><b>الثيم:</b> مع ثيم'+(d.occ?(' — '+esc(d.occ)):'')+(d.txt?(' — '+esc(d.txt)):'')+'</div>':'')+
        ((d.pickupDate||d.pickupTime)?'<div style="font-size:13px;"><b>الاستلام:</b> '+esc(d.pickupDate||'')+' '+esc(d.pickupTime||'')+'</div>':'')+
        (d.note?'<div style="font-size:13px;"><b>ملاحظة:</b> '+esc(d.note)+'</div>':'')+
      '</div>'+
      badge+
      ((FORM&&FORM.createdByName)?'<div style="text-align:center;color:#64748b;font-size:12px;margin-top:8px;border-top:1px dashed #cbd5e1;padding-top:7px;">👤 أنشأ الاستمارة: '+esc(FORM.createdByName)+'</div>':'')+
    '</div>';
    return h;
  }
  // حاوية خارج الشاشة لالتقاط الصورة (طول كامل دون قص)
  function ensureH2C(cb){
    if(typeof html2canvas!=='undefined'){ cb(true); return; }
    var s=document.createElement('script');
    s.src='https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js';
    s.onload=function(){ cb(typeof html2canvas!=='undefined'); };
    s.onerror=function(){ cb(false); };
    document.head.appendChild(s);
  }
  function renderCardCanvas(opts, cb){
    var host=$('oShareHost');
    if(!host){ host=document.createElement('div'); host.id='oShareHost'; host.style.cssText='position:fixed;left:-9999px;top:0;width:360px;background:#fff;'; document.body.appendChild(host); }
    host.innerHTML=buildOrderCard(opts);
    var card=document.getElementById('oShareCard');
    ensureH2C(function(ok){
      if(!ok || !card){ cb(null); return; }
      html2canvas(card,{backgroundColor:'#ffffff',scale:2,useCORS:true,logging:false,windowWidth:420}).then(function(cv){ cb(cv); }).catch(function(){ cb(null); });
    });
  }
  function pngName(){ var d=collectFormData(); return 'استمارة-'+((d.name||'طلب').replace(/\s+/g,'_'))+'.png'; }
  function savePngNow(opts){
    toast('… جارٍ تجهيز الصورة');
    renderCardCanvas(opts||{}, function(cv){
      if(!cv){ toast('تعذر إنشاء الصورة'); return; }
      try{ var a=document.createElement('a'); a.href=cv.toDataURL('image/png'); a.download=pngName(); document.body.appendChild(a); a.click(); a.remove(); toast('✅ تم حفظ الصورة'); }catch(e){ toast('تعذر الحفظ'); }
    });
  }
  function dlCanvas(cv){ if(!cv) return; try{ var a=document.createElement('a'); a.href=cv.toDataURL('image/png'); a.download=pngName(); document.body.appendChild(a); a.click(); a.remove(); }catch(e){} }
  function sendNow(opts){
    var link=trackUrl();
    toast('… جارٍ تجهيز الإرسال');
    renderCardCanvas(opts||{}, function(cv){
      if(cv && cv.toBlob && navigator.canShare){
        cv.toBlob(function(blob){
          try{
            var file=new File([blob],'form.png',{type:'image/png'});
            if(navigator.canShare({files:[file]})){ navigator.share({files:[file],title:(FORM&&FORM.title)||'استمارة طلب',text:'استمارة الطلب — متابعة: '+link}).catch(function(){}); return; }
          }catch(e){}
          sendFallback(cv, link);
        },'image/png');
      }else{ sendFallback(cv, link); }
    });
  }
  function sendFallback(cv, link){
    if(navigator.share){ navigator.share({title:(FORM&&FORM.title)||'استمارة طلب',text:'متابعة الطلب',url:link}).catch(function(){ dlCanvas(cv); }); }
    else { dlCanvas(cv); toast('⬇️ تم تنزيل الصورة'); }
  }
  function shareLinkNow(){
    if(FORM && ((FORM.expiresAt && Date.now()>FORM.expiresAt) || FORM.active===false)){ toast('الرابط منتهٍ/متوقّف'); return; }
    var link=trackUrl();
    var msg='رابط متابعة الطلب من '+brandName()+':\n'+link;
    if(navigator.share){ navigator.share({title:'متابعة الطلب',text:msg,url:link}).catch(function(){ copyText(link); }); }
    else { copyText(link); }
  }
  function copyText(txt){
    try{
      if(navigator.clipboard && navigator.clipboard.writeText){ navigator.clipboard.writeText(txt).then(function(){ toast('📋 تم نسخ الرابط'); }).catch(function(){ legacyCopy(txt); }); }
      else legacyCopy(txt);
    }catch(e){ legacyCopy(txt); }
  }
  function legacyCopy(txt){
    try{ var ta=document.createElement('textarea'); ta.value=txt; ta.style.position='fixed'; ta.style.opacity='0'; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove(); toast('📋 تم نسخ الرابط'); }catch(e){ toast('انسخ الرابط يدوياً'); }
  }
  function wireShareButtons(){
    var b1=$('oActPng'); if(b1) b1.onclick=function(){ savePngNow({}); };
    var b2=$('oActSend'); if(b2) b2.onclick=function(){ sendNow({}); };
    var b3=$('oActShare'); if(b3) b3.onclick=function(){ shareLinkNow(); };
    var d1=$('oDonePng'); if(d1) d1.onclick=function(){ savePngNow({sent:true}); };
    var d2=$('oDoneSend'); if(d2) d2.onclick=function(){ sendNow({sent:true}); };
    var d3=$('oDoneShare'); if(d3) d3.onclick=function(){ shareLinkNow(); };
  }

  waitReady(start);
})();
