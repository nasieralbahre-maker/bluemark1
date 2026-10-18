// ===== لوحة المعلومات المدمجة داخل index (تظهر للمدير) =====
// وحدة معزولة (IIFE) تتجنّب التعارض مع app.js
window.Dash = (function(){
  const CURRENCIES = {
    YER:{symbol:'ر.ي'}, SAR:{symbol:'ر.س'}, USD:{symbol:'$'}, AED:{symbol:'د.إ'}, EGP:{symbol:'ج.م'},
    QAR:{symbol:'ر.ق'}, OMR:{symbol:'ر.ع'}, KWD:{symbol:'د.ك'}, JOD:{symbol:'د.أ'}, EUR:{symbol:'€'}
  };
  let SETTINGS = {};
  let ORDERS = [];
  let subscribed = false;
  let clockTimer = null;
  let moneyHidden = true;   // إخفاء المبالغ افتراضياً (تُظهر بزر العين)
  let USERS = [];           // قائمة المستخدمين (لتحليل Firebase)
  let MENU = [];            // الأصناف (لتقدير المساحة)

  function cur(){ return (CURRENCIES[SETTINGS.currency] || CURRENCIES.YER).symbol; }
  function money(n){
    if(moneyHidden) return '••••• ' + cur();
    n = Number(n)||0; return (Math.round(n*100)/100).toLocaleString('en-US') + ' ' + cur();
  }
  // تقدير حجم البيانات (بالبايت) — يدعم الأحرف العربية (UTF-8)
  function byteSize(obj){
    try{ const s = JSON.stringify(obj==null?'':obj); return (typeof Blob!=='undefined') ? new Blob([s]).size : s.length; }
    catch(e){ return 0; }
  }
  function fmtBytes(n){
    n = Number(n)||0;
    if(n < 1024) return n + ' B';
    if(n < 1048576) return (n/1024).toFixed(1) + ' KB';
    return (n/1048576).toFixed(2) + ' MB';
  }
  // باني مخطط دائري عام (rows: {label,color,value,text})
  function buildDonut(rows, centerLabel, centerVal){
    const total = rows.reduce((s,r)=>s+(Number(r.value)||0),0);
    if(!total) return '<div class="empty">لا توجد بيانات</div>';
    let acc=0;
    const stops = rows.map(r=>{ const a=acc/total*360; acc+=(Number(r.value)||0); const b=acc/total*360; return r.color+' '+a.toFixed(2)+'deg '+b.toFixed(2)+'deg'; }).join(',');
    const legend = rows.map(r=>{ const pct=Math.round((Number(r.value)||0)/total*100);
      return '<div class="dn-leg-row"><span class="dn-dot" style="background:'+r.color+'"></span>'+
        '<span class="dn-leg-name">'+esc(r.label)+'</span>'+
        '<span class="dn-leg-pct">'+pct+'%</span>'+
        '<span class="dn-leg-val">'+esc(r.text||'')+'</span></div>'; }).join('');
    return '<div class="donut-wrap"><div class="donut" style="background:conic-gradient('+stops+')">'+
      '<div class="donut-hole"><span class="dn-c-lbl">'+esc(centerLabel)+'</span><span class="dn-c-val">'+esc(centerVal)+'</span></div></div>'+
      '<div class="donut-legend">'+legend+'</div></div>';
  }
  function esc(s){ return String(s==null?'':s).replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c])); }
  function $(id){ return document.getElementById(id); }

  const PREP = {
    pending:{lbl:'بانتظار التأكيد', cls:'p-pending'},
    confirmed:{lbl:'قيد التنفيذ', cls:'p-confirmed'},
    ready:{lbl:'جاهز', cls:'p-ready'}
  };
  function prepPill(o){ const p = PREP[o && o.prep]; if(!p) return '<span class="pill p-none">—</span>'; return '<span class="pill '+p.cls+'">'+p.lbl+'</span>'; }
  function payLabel(o){
    if(o.pay === 'card'){ const t = o.depositType || 'شبكة'; return t + (o.exchangeName ? ' · '+o.exchangeName : ''); }
    if(o.pay === 'deposit') return 'عربون';
    return 'نقد';
  }
  function ymd(d){ return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); }
  function orderDate(o){ const t = o.createdAt ? new Date(o.createdAt) : null; return t && !isNaN(t) ? t : null; }
  function isSameDay(o, key){ const d = orderDate(o); return d ? ymd(d) === key : false; }
  function notCancelled(o){ return (o.status||'') !== 'cancelled'; }

  function tickClock(){
    const now = new Date();
    const dEl = $('dashDate'), cEl = $('dashClock');
    try{ if(dEl) dEl.textContent = now.toLocaleDateString('ar', {weekday:'long', year:'numeric', month:'long', day:'numeric'}); }catch(e){}
    try{ if(cEl) cEl.textContent = now.toLocaleTimeString('ar', {hour:'2-digit', minute:'2-digit', second:'2-digit'}); }catch(e){}
  }
  function setConn(){
    const el = $('dashConn'); if(!el) return;
    const cloud = (typeof DB.isCloud === 'function') && DB.isCloud();
    el.textContent = cloud ? '☁️ متصل بالسحابة' : '💾 تخزين محلي';
    el.className = 'conn-pill ' + (cloud ? 'cloud' : 'local');
  }

  function renderKpi(){
    const todayKey = ymd(new Date());
    const valid = ORDERS.filter(notCancelled);
    const today = valid.filter(o => isSameDay(o, todayKey));
    const revToday = today.reduce((s,o)=>s+(Number(o.total)||0),0);
    const revAll = valid.reduce((s,o)=>s+(Number(o.total)||0),0);
    const avgToday = today.length ? revToday/today.length : 0;
    const outstanding = valid.reduce((s,o)=>s+(Number(o.remaining)||0),0);
    const cards = [
      {c:'k-green', ic:'💵', val:money(revToday), lbl:'إيرادات اليوم', foot:today.length+' طلب اليوم'},
      {c:'k-blue', ic:'🧾', val:today.length, lbl:'طلبات اليوم', foot:'إجمالي الطلبات: '+valid.length},
      {c:'k-cyan', ic:'🧾', val:money(avgToday), lbl:'متوسط فاتورة اليوم', foot:'لـ '+today.length+' فاتورة'},
      {c:'k-violet', ic:'💰', val:money(revAll), lbl:'إجمالي الإيرادات', foot:'كل الفترات'},
      {c:'k-amber', ic:'📊', val:valid.length, lbl:'إجمالي الطلبات', foot:'غير الملغاة'},
      {c:'k-rose', ic:'⏳', val:money(outstanding), lbl:'المتبقي على العملاء', foot:'مجموع الأرصدة'}
    ];
    const el = $('dashKpi'); if(!el) return;
    el.innerHTML = cards.map(c =>
      '<div class="kpi '+c.c+'"><div class="k-ic">'+c.ic+'</div>'+
      '<div class="k-val">'+c.val+'</div><div class="k-lbl">'+c.lbl+'</div>'+
      '<div class="k-foot">'+c.foot+'</div></div>'
    ).join('');
  }

  function renderStatus(){
    const todayKey = ymd(new Date());
    const today = ORDERS.filter(notCancelled).filter(o => isSameDay(o, todayKey));
    const count = p => today.filter(o => (o.prep||'') === p).length;
    const chips = [
      {cls:'st-pending', ic:'🕒', lbl:'بانتظار التأكيد', n:count('pending')},
      {cls:'st-confirmed', ic:'👨‍🍳', lbl:'قيد التنفيذ', n:count('confirmed')},
      {cls:'st-ready', ic:'✅', lbl:'جاهز', n:count('ready')}
    ];
    const el = $('dashStatus'); if(!el) return;
    el.innerHTML = chips.map(c =>
      '<div class="st-chip '+c.cls+'"><span class="st-ic">'+c.ic+'</span>'+
      '<span class="st-lbl">'+c.lbl+'</span><span class="st-n">'+c.n+'</span></div>'
    ).join('');
  }

  function renderBars(elId, rows, colorClass){
    const el = $(elId); if(!el) return;
    const max = Math.max(1, ...rows.map(r => r.amount));
    if(!rows.length){ el.innerHTML = '<div class="empty">لا توجد بيانات</div>'; return; }
    el.innerHTML = rows.map(r =>
      '<div class="bar-item"><div class="bar-top"><span>'+esc(r.label)+'</span>'+
      '<span>'+money(r.amount)+' <span class="b-sub">('+r.count+')</span></span></div>'+
      '<div class="bar-track"><div class="bar-fill '+(r.cls||colorClass)+'" style="width:'+Math.round(r.amount/max*100)+'%"></div></div></div>'
    ).join('');
  }
  function renderPay(){
    const valid = ORDERS.filter(notCancelled);
    const groups = {
      cash:{label:'نقد', amount:0, count:0, color:'#22c55e'},
      card:{label:'إيداع / حوالة', amount:0, count:0, color:'#3b82f6'},
      deposit:{label:'عربون (جزئي)', amount:0, count:0, color:'#f59e0b'}
    };
    valid.forEach(o => { const g = groups[o.pay] || groups.cash; g.amount += Number(o.total)||0; g.count++; });
    renderDonut('dashPay', Object.values(groups).filter(g=>g.count>0));
  }
  // مخطط دائري (دونات) باستخدام conic-gradient — بدون أي مكتبة خارجية
  function renderDonut(elId, rows){
    const el = $(elId); if(!el) return;
    const total = rows.reduce((s,r)=>s+(Number(r.amount)||0),0);
    if(!total){ el.innerHTML = '<div class="empty">لا توجد بيانات</div>'; return; }
    let acc = 0;
    const stops = rows.map(r => {
      const a = acc/total*360; acc += (Number(r.amount)||0); const b = acc/total*360;
      return r.color+' '+a.toFixed(2)+'deg '+b.toFixed(2)+'deg';
    }).join(',');
    const legend = rows.map(r => {
      const pct = Math.round((Number(r.amount)||0)/total*100);
      return '<div class="dn-leg-row"><span class="dn-dot" style="background:'+r.color+'"></span>'+
        '<span class="dn-leg-name">'+esc(r.label)+'</span>'+
        '<span class="dn-leg-pct">'+pct+'%</span>'+
        '<span class="dn-leg-val">'+money(r.amount)+'</span></div>';
    }).join('');
    el.innerHTML =
      '<div class="donut-wrap">'+
        '<div class="donut" style="background:conic-gradient('+stops+')">'+
          '<div class="donut-hole"><span class="dn-c-lbl">الإجمالي</span>'+
          '<span class="dn-c-val">'+money(total)+'</span></div>'+
        '</div>'+
        '<div class="donut-legend">'+legend+'</div>'+
      '</div>';
  }
  function renderType(){
    const valid = ORDERS.filter(notCancelled);
    const map = {};
    valid.forEach(o => { const t = o.type || 'أخرى'; (map[t] = map[t] || {label:t, amount:0, count:0, cls:'bf-cyan'}); map[t].amount += Number(o.total)||0; map[t].count++; });
    renderBars('dashType', Object.values(map).sort((a,b)=>b.amount-a.amount));
  }

  function renderChart7(){
    const days = []; const now = new Date();
    for(let i=6;i>=0;i--){ const d = new Date(now); d.setDate(now.getDate()-i); days.push(d); }
    const todayKey = ymd(now);
    const valid = ORDERS.filter(notCancelled);
    const data = days.map(d => {
      const key = ymd(d);
      const sum = valid.filter(o => isSameDay(o, key)).reduce((s,o)=>s+(Number(o.total)||0),0);
      let name = '—'; try{ name = d.toLocaleDateString('ar', {weekday:'short'}); }catch(e){}
      return {name, sum, isToday:key===todayKey};
    });
    const max = Math.max(1, ...data.map(x=>x.sum));
    const wt = $('dashWeekTotal'); if(wt) wt.textContent = money(data.reduce((s,x)=>s+x.sum,0));
    const el = $('dashChart7'); if(!el) return;
    el.innerHTML = data.map(x =>
      '<div class="c7-col"><div class="c7-val">'+(moneyHidden ? (x.sum ? '••••' : '') : (x.sum ? Math.round(x.sum).toLocaleString('en-US') : ''))+'</div>'+
      '<div class="c7-bar'+(x.isToday?' today':'')+'" style="height:'+Math.max(4, Math.round(x.sum/max*140))+'px"></div>'+
      '<div class="c7-day">'+esc(x.name)+'</div></div>'
    ).join('');
  }

  function renderTopItems(){
    const map = {};
    ORDERS.filter(notCancelled).forEach(o => (o.items||[]).forEach(it => {
      const k = it.name || '—';
      (map[k] = map[k] || {name:k, qty:0, amount:0});
      map[k].qty += Number(it.qty)||0; map[k].amount += (Number(it.price)||0)*(Number(it.qty)||0);
    }));
    const rows = Object.values(map).sort((a,b)=>b.qty-a.qty).slice(0,6);
    const el = $('dashTop'); if(!el) return;
    if(!rows.length){ el.innerHTML = '<div class="empty">لا توجد مبيعات بعد</div>'; return; }
    const max = Math.max(1, ...rows.map(r=>r.qty));
    el.innerHTML = rows.map((r,i) =>
      '<div class="tl-row"><div class="tl-rank r'+(i+1)+'">'+(i+1)+'</div>'+
      '<div class="tl-mid"><div class="tl-name">'+esc(r.name)+'</div>'+
      '<div class="tl-track"><div class="tl-fill" style="width:'+Math.round(r.qty/max*100)+'%"></div></div></div>'+
      '<div class="tl-val">'+r.qty+' قطعة<small>'+money(r.amount)+'</small></div></div>'
    ).join('');
  }

  function renderExchanges(){
    const map = {};
    ORDERS.filter(notCancelled).filter(o => o.pay==='card' && o.exchangeName).forEach(o => {
      const k = o.exchangeName; (map[k] = map[k] || {name:k, count:0, amount:0});
      map[k].count++; map[k].amount += Number(o.total)||0;
    });
    const rows = Object.values(map).sort((a,b)=>b.amount-a.amount).slice(0,6);
    const el = $('dashExch'); if(!el) return;
    if(!rows.length){ el.innerHTML = '<div class="empty">لا توجد إيداعات/حوالات</div>'; return; }
    const max = Math.max(1, ...rows.map(r=>r.amount));
    el.innerHTML = rows.map((r,i) =>
      '<div class="tl-row"><div class="tl-rank r'+(i+1)+'">'+(i+1)+'</div>'+
      '<div class="tl-mid"><div class="tl-name">'+esc(r.name)+'</div>'+
      '<div class="tl-track"><div class="tl-fill" style="width:'+Math.round(r.amount/max*100)+'%"></div></div></div>'+
      '<div class="tl-val">'+money(r.amount)+'<small>'+r.count+' عملية</small></div></div>'
    ).join('');
  }

  function renderRecent(){
    const rows = ORDERS.slice().sort((a,b)=>(Number(b.createdAt)||0)-(Number(a.createdAt)||0)).slice(0,8);
    const body = $('dashRecentBody'); if(!body) return;
    if(!rows.length){ body.innerHTML = '<tr><td colspan="7" class="empty">لا توجد طلبات بعد</td></tr>'; return; }
    body.innerHTML = rows.map(o => {
      const d = orderDate(o); let t = '—';
      try{ if(d) t = d.toLocaleTimeString('ar',{hour:'2-digit',minute:'2-digit'}); }catch(e){}
      const no = o.orderNo ? ('#'+o.orderNo) : esc((o.id||'').slice(-4));
      return '<tr><td>'+esc(no)+'</td><td>'+esc(o.name||'عميل')+'</td>'+
        '<td>'+esc(o.type||'—')+'</td><td>'+esc(payLabel(o))+'</td>'+
        '<td>'+prepPill(o)+'</td><td>'+money(o.total||0)+'</td><td>'+esc(t)+'</td></tr>';
    }).join('');
  }

  // ===== تحليل بيانات Firebase =====
  // 1) المساحة حسب المجموعة (تقديري من محتوى المستندات)
  function renderStorage(){
    const el = $('dashStorage'); if(!el) return;
    const cols = [
      {label:'الطلبات',    color:'#3b82f6', value:byteSize(ORDERS),   count:ORDERS.length},
      {label:'المستخدمون', color:'#8b5cf6', value:byteSize(USERS),    count:USERS.length},
      {label:'الأصناف',    color:'#06b6d4', value:byteSize(MENU),     count:MENU.length},
      {label:'الإعدادات',  color:'#f59e0b', value:byteSize(SETTINGS), count:1}
    ];
    const total = cols.reduce((s,c)=>s+c.value,0);
    const tot = $('dashStorageTotal'); if(tot) tot.textContent = fmtBytes(total);
    const rows = cols.map(c => ({label:c.label, color:c.color, value:c.value, text:fmtBytes(c.value)+' · '+c.count+' مستند'}));
    el.innerHTML = buildDonut(rows, 'إجمالي المساحة', fmtBytes(total));
  }

  // 2) حركة البيانات (السجلات المُنشأة — آخر 14 يوم)
  function renderActivity(){
    const el = $('dashActivity'); if(!el) return;
    const now = new Date(); const days = [];
    for(let i=13;i>=0;i--){ const d=new Date(now); d.setDate(now.getDate()-i); days.push(d); }
    const todayKey = ymd(now);
    const data = days.map(d => { const key=ymd(d); const n=ORDERS.filter(o=>isSameDay(o,key)).length;
      let dn='—'; try{ dn=d.toLocaleDateString('ar',{day:'numeric'}); }catch(e){ dn=String(d.getDate()); }
      return {n, label:dn, isToday:key===todayKey}; });
    const max = Math.max(1, ...data.map(x=>x.n));
    const totalWrites = ORDERS.length;
    const todayN = data[data.length-1].n;
    const week = data.slice(-7).reduce((s,x)=>s+x.n,0);
    const bytesTotal = byteSize(ORDERS)+byteSize(USERS)+byteSize(MENU)+byteSize(SETTINGS);
    const sum =
      '<div class="act-sum">'+
        '<div class="as-item"><span class="as-val">'+totalWrites+'</span><span class="as-lbl">إجمالي السجلات</span></div>'+
        '<div class="as-item"><span class="as-val">'+week+'</span><span class="as-lbl">آخر 7 أيام</span></div>'+
        '<div class="as-item"><span class="as-val">'+todayN+'</span><span class="as-lbl">اليوم</span></div>'+
        '<div class="as-item"><span class="as-val">'+fmtBytes(bytesTotal)+'</span><span class="as-lbl">حجم البيانات</span></div>'+
      '</div>';
    const chart = '<div class="act-chart">'+ data.map(x =>
      '<div class="ac-col"><div class="ac-val">'+(x.n||'')+'</div>'+
      '<div class="ac-bar'+(x.isToday?' today':'')+'" style="height:'+Math.max(4, Math.round(x.n/max*120))+'px"></div>'+
      '<div class="ac-day">'+esc(x.label)+'</div></div>'
    ).join('') +'</div>';
    el.innerHTML = sum + chart;
  }

  // 3) المستخدمون حسب حجم/عدد البيانات (الأكثر والأقل)
  function renderUserData(){
    const el = $('dashUserData'); if(!el) return;
    const map = {};
    ORDERS.forEach(o => {
      const u = ((o.cashier||'').trim()) || 'غير معروف';
      (map[u] = map[u] || {name:u, count:0, bytes:0});
      map[u].count++; map[u].bytes += byteSize(o);
    });
    const rows = Object.values(map).sort((a,b)=>b.count-a.count);
    if(!rows.length){ el.innerHTML = '<div class="empty">لا توجد بيانات مستخدمين</div>'; return; }
    const most = rows[0], least = rows[rows.length-1];
    const cards = (rows.length>1)
      ? '<div class="ud-cards">'+
          '<div class="ud-card most"><div class="ud-tag">⬆️ الأكثر نشاطاً</div>'+
            '<div class="ud-name">'+esc(most.name)+'</div>'+
            '<div class="ud-meta">'+most.count+' طلب · '+fmtBytes(most.bytes)+'</div></div>'+
          '<div class="ud-card least"><div class="ud-tag">⬇️ الأقل نشاطاً</div>'+
            '<div class="ud-name">'+esc(least.name)+'</div>'+
            '<div class="ud-meta">'+least.count+' طلب · '+fmtBytes(least.bytes)+'</div></div>'+
        '</div>'
      : '';
    const max = Math.max(1, ...rows.map(r=>r.count));
    const list = '<div class="toplist">'+ rows.slice(0,8).map((r,i) =>
      '<div class="tl-row"><div class="tl-rank r'+(i+1)+'">'+(i+1)+'</div>'+
      '<div class="tl-mid"><div class="tl-name">'+esc(r.name)+'</div>'+
      '<div class="tl-track"><div class="tl-fill" style="width:'+Math.round(r.count/max*100)+'%"></div></div></div>'+
      '<div class="tl-val">'+r.count+' طلب<small>'+fmtBytes(r.bytes)+'</small></div></div>'
    ).join('') +'</div>';
    el.innerHTML = cards + list;
  }

  // ===== استضافة Netlify (المساحة والاستهلاك) =====
  let nlCache = null;      // نتيجة آخر جلب ناجح
  let nlFetchedAt = 0;     // وقت آخر جلب
  let nlFetching = false;
  let nlError = '';
  function gb(bytes){ bytes=Number(bytes)||0; const g=bytes/1073741824; return (g>=10?g.toFixed(1):g.toFixed(2))+' GB'; }
  function localDataBytes(){ return byteSize(ORDERS)+byteSize(USERS)+byteSize(MENU)+byteSize(SETTINGS); }

  function nlBar(used, included){
    used=Number(used)||0; included=Number(included)||0;
    const pct = included>0 ? Math.min(100, Math.round(used/included*100)) : 0;
    const cls = pct>=90?'nl-crit':(pct>=70?'nl-warn':'nl-ok');
    return '<div class="nl-bar"><div class="nl-bar-fill '+cls+'" style="width:'+pct+'%"></div></div>'+
           '<div class="nl-bar-cap"><span>'+gb(used)+' مستهلك</span><span>'+pct+'%</span><span>من '+(included>0?gb(included):'—')+'</span></div>';
  }

  function renderNetlify(){
    const el = $('dashNetlify'); if(!el) return;
    const st = $('dashNlStatus');
    const token = (SETTINGS.netlifyToken||'').trim();
    const slug  = (SETTINGS.netlifySlug||'').trim();
    const localCard =
      '<div class="nl-local">'+
        '<div class="nl-local-row"><span>💾 حجم بيانات التطبيق (تقديري)</span><b>'+fmtBytes(localDataBytes())+'</b></div>'+
        '<div class="nl-local-row"><span>📦 عدد السجلات</span><b>'+(ORDERS.length+MENU.length+USERS.length+1)+'</b></div>'+
      '</div>';

    if(!token || !slug){
      if(st){ st.textContent = 'غير مربوط'; st.className = 'panel-note'; }
      el.innerHTML =
        '<div class="nl-hint">لعرض استهلاك الباقة (Bandwidth) والمساحة من Netlify، أدخِل رمز الوصول واسم الحساب من: '+
          '<b>لوحة التحكم ← الإعدادات ← استضافة Netlify</b>.</div>'+
        '<div class="nl-free">الخطة المجانية عادةً: <b>100 GB</b> باقة شهرياً · مساحة نشر صغيرة للموقع.</div>'+
        localCard;
      return;
    }

    paintNetlify(el, st, localCard);
    if(!nlFetching && (!nlCache || (Date.now()-nlFetchedAt) > 300000)){
      nlFetching = true;
      fetchNetlify(token, slug, (SETTINGS.netlifySiteId||'').trim()).then(data=>{
        nlCache = data; nlFetchedAt = Date.now(); nlError = ''; nlFetching = false;
        paintNetlify($('dashNetlify'), $('dashNlStatus'), localCard);
      }).catch(err=>{
        nlError = (err && err.message) ? err.message : 'تعذر الاتصال'; nlFetching = false;
        paintNetlify($('dashNetlify'), $('dashNlStatus'), localCard);
      });
    }
  }

  function paintNetlify(el, st, localCard){
    if(!el) return;
    if(nlCache){
      if(st){ st.textContent = '✓ متصل'; st.className = 'panel-note nl-connected'; }
      const bw = nlCache.bandwidth || {};
      const used = bw.used||0, inc = bw.included||0;
      let period = '';
      if(bw.period_start_date && bw.period_end_date){
        try{ period = new Date(bw.period_start_date).toLocaleDateString('ar')+' ← '+new Date(bw.period_end_date).toLocaleDateString('ar'); }catch(e){}
      }
      let siteInfo = '';
      if(nlCache.site){
        const s = nlCache.site;
        let dep = '—'; try{ if(s.published_deploy && s.published_deploy.published_at) dep = new Date(s.published_deploy.published_at).toLocaleString('ar'); }catch(e){}
        siteInfo =
          '<div class="nl-site">'+
            '<div class="nl-local-row"><span>🌐 الموقع</span><b>'+esc(s.name||s.custom_domain||'—')+'</b></div>'+
            (s.ssl_url||s.url?('<div class="nl-local-row"><span>🔗 الرابط</span><b>'+esc(s.ssl_url||s.url)+'</b></div>'):'')+
            '<div class="nl-local-row"><span>🚀 آخر نشر</span><b>'+esc(dep)+'</b></div>'+
          '</div>';
      }
      el.innerHTML =
        '<div class="nl-usage"><h4>📡 استهلاك الباقة (Bandwidth)</h4>'+ nlBar(used, inc) +
          (period?('<div class="nl-period">الفترة: '+esc(period)+'</div>'):'')+'</div>'+
        siteInfo + localCard;
    } else if(nlError){
      if(st){ st.textContent = 'خطأ في الاتصال'; st.className = 'panel-note nl-err'; }
      el.innerHTML = '<div class="nl-hint nl-err-box">تعذّر جلب بيانات Netlify: '+esc(nlError)+
        '<br/>تأكد من صحة رمز الوصول واسم الحساب (slug)، وأن الرمز يملك صلاحية الاطّلاع.</div>'+ localCard;
    } else {
      if(st){ st.textContent = 'جارٍ الجلب…'; st.className = 'panel-note'; }
      el.innerHTML = '<div class="nl-hint">جارٍ جلب بيانات الاستضافة من Netlify…</div>'+ localCard;
    }
  }

  async function fetchNetlify(token, slug, siteId){
    const headers = { 'Authorization': 'Bearer '+token };
    const out = {};
    const bwRes = await fetch('https://api.netlify.com/api/v1/accounts/'+encodeURIComponent(slug)+'/bandwidth', { headers });
    if(!bwRes.ok) throw new Error('HTTP '+bwRes.status+(bwRes.status===401?' (رمز غير صالح)':(bwRes.status===404?' (اسم حساب غير صحيح)':'')));
    out.bandwidth = await bwRes.json();
    if(siteId){
      try{ const sRes = await fetch('https://api.netlify.com/api/v1/sites/'+encodeURIComponent(siteId), { headers }); if(sRes.ok) out.site = await sRes.json(); }catch(e){}
    }
    return out;
  }

  function renderAll(){
    renderKpi(); renderStatus(); renderPay(); renderType();
    renderChart7(); renderTopItems(); renderExchanges(); renderRecent();
    renderStorage(); renderActivity(); renderUserData(); renderNetlify();
    const f = $('dashFoot'); if(f) f.textContent = 'آخر تحديث: ' + new Date().toLocaleString('ar');
  }

  // زر العين: إظهار/إخفاء المبالغ
  function updateEye(){
    const eye = $('dashMoneyEye'); if(!eye) return;
    eye.innerHTML = moneyHidden ? '👁️ إظهار المبالغ' : '🙈 إخفاء المبالغ';
    eye.classList.toggle('on', !moneyHidden);
    eye.setAttribute('title', moneyHidden ? 'انقر لإظهار المبالغ' : 'انقر لإخفاء المبالغ');
  }
  function bindEye(){
    const eye = $('dashMoneyEye'); if(!eye || eye._bound) return;
    eye._bound = true;
    eye.addEventListener('click', function(){ moneyHidden = !moneyHidden; updateEye(); renderAll(); });
  }

  // ===== التقرير العام =====
  // تنسيق مبلغ حقيقي (دائم الظهور داخل التقرير)
  function rmoney(n){ n = Number(n)||0; return (Math.round(n*100)/100).toLocaleString('en-US') + ' ' + cur(); }
  function fmtDT(ms){ if(!ms) return '—'; try{ return new Date(ms).toLocaleString('ar'); }catch(e){ return '—'; } }
  function statusAr(o){
    if((o.status||'')==='cancelled') return 'ملغي';
    const p = PREP[o && o.prep]; return p ? p.lbl : 'مكتمل';
  }
  function payStatusAr(o){
    if(o.payStatus==='partial') return 'عربون (متبقي)';
    return 'مدفوع';
  }
  // فلترة الطلبات حسب الفترة الزمنية المختارة
  function filterByRange(){
    const sel = $('repRange'); const r = sel ? sel.value : 'all';
    let list = ORDERS.slice();
    const now = new Date();
    if(r === 'today'){ const k = ymd(now); list = list.filter(o => isSameDay(o, k)); }
    else if(r === '7' || r === '30'){
      const days = r === '7' ? 7 : 30; const from = new Date(now); from.setDate(now.getDate()-(days-1)); from.setHours(0,0,0,0);
      list = list.filter(o => { const d = orderDate(o); return d && d >= from; });
    } else if(r === 'custom'){
      const fEl = $('repFrom'), tEl = $('repTo');
      const fv = fEl && fEl.value ? new Date(fEl.value+'T00:00:00') : null;
      const tv = tEl && tEl.value ? new Date(tEl.value+'T23:59:59') : null;
      list = list.filter(o => { const d = orderDate(o); if(!d) return false; if(fv && d < fv) return false; if(tv && d > tv) return false; return true; });
    }
    return list;
  }
  function rangeLabel(){
    const sel = $('repRange'); const r = sel ? sel.value : 'all';
    if(r==='today') return 'اليوم';
    if(r==='7') return 'آخر 7 أيام';
    if(r==='30') return 'آخر 30 يوم';
    if(r==='custom'){ const f=$('repFrom'), t=$('repTo'); return 'من '+((f&&f.value)||'—')+' إلى '+((t&&t.value)||'—'); }
    return 'كل الفترات';
  }
  function selectedSections(){
    const out = {};
    document.querySelectorAll('#repChecks input[type=checkbox]').forEach(c => { out[c.value] = c.checked; });
    return out;
  }

  function secOverview(list){
    const valid = list.filter(notCancelled);
    const revenue = valid.reduce((s,o)=>s+(Number(o.total)||0),0);
    const paid = valid.reduce((s,o)=>s+(Number(o.paid)||0),0);
    const remain = valid.reduce((s,o)=>s+(Number(o.remaining)||0),0);
    const cancelled = list.filter(o=>(o.status||'')==='cancelled').length;
    const partial = valid.filter(o=>o.payStatus==='partial').length;
    const items = valid.reduce((s,o)=>s+((o.items||[]).reduce((a,it)=>a+(Number(it.qty)||0),0)),0);
    const avg = valid.length ? revenue/valid.length : 0;
    const cells = [
      ['إجمالي الطلبات', list.length],
      ['طلبات مكتملة', valid.length],
      ['طلبات ملغاة', cancelled],
      ['إجمالي الإيرادات', rmoney(revenue)],
      ['المحصّل فعلاً', rmoney(paid)],
      ['المتبقي (عرابين)', rmoney(remain)],
      ['طلبات بعربون', partial],
      ['عدد الأصناف المباعة', items],
      ['متوسط قيمة الطلب', rmoney(avg)]
    ];
    const grid = cells.map(c => '<div class="rp-kpi"><span class="rp-kpi-v">'+esc(String(c[1]))+'</span><span class="rp-kpi-l">'+esc(c[0])+'</span></div>').join('');
    return '<section class="rp-sec"><h2>📊 نظرة عامة</h2><div class="rp-kpis">'+grid+'</div></section>';
  }

  function secOrders(list){
    if(!list.length) return '<section class="rp-sec"><h2>🧾 سجل الطلبات</h2><p class="rp-empty">لا توجد طلبات في هذه الفترة.</p></section>';
    const rows = list.slice().sort((a,b)=>(b.createdAt||0)-(a.createdAt||0)).map(o => {
      const no = o.orderNo ? ('#'+o.orderNo) : esc((o.id||'').slice(-5));
      return '<tr><td>'+esc(no)+'</td><td>'+fmtDT(o.createdAt)+'</td><td>'+esc(o.cashier||'—')+'</td>'+
        '<td>'+esc(o.name||'—')+'</td><td>'+esc(o.phone||'—')+'</td><td>'+esc(o.type||'—')+'</td>'+
        '<td>'+esc(payLabel(o))+'</td><td>'+esc(statusAr(o))+'</td>'+
        '<td class="n">'+rmoney(o.total)+'</td><td class="n">'+rmoney(o.paid)+'</td><td class="n">'+rmoney(o.remaining)+'</td></tr>';
    }).join('');
    return '<section class="rp-sec"><h2>🧾 سجل الطلبات التفصيلي ('+list.length+')</h2>'+
      '<table class="rp-table"><thead><tr><th>رقم</th><th>التاريخ</th><th>الكاشير</th><th>العميل</th><th>الجوال</th><th>النوع</th><th>الدفع</th><th>الحالة</th><th>الإجمالي</th><th>المدفوع</th><th>المتبقي</th></tr></thead><tbody>'+rows+'</tbody></table></section>';
  }

  function secItems(list){
    const map = {};
    list.filter(notCancelled).forEach(o => (o.items||[]).forEach(it => {
      const k = (it.name||'—'); (map[k] = map[k] || {name:k, qty:0, total:0});
      map[k].qty += Number(it.qty)||0; map[k].total += (Number(it.price)||0)*(Number(it.qty)||0);
    }));
    const rows = Object.values(map).sort((a,b)=>b.qty-a.qty);
    if(!rows.length) return '<section class="rp-sec"><h2>🍰 الأصناف المباعة</h2><p class="rp-empty">لا توجد أصناف مباعة.</p></section>';
    const body = rows.map((r,i)=>'<tr><td>'+(i+1)+'</td><td>'+esc(r.name)+'</td><td class="n">'+r.qty+'</td><td class="n">'+rmoney(r.total)+'</td></tr>').join('');
    const totQ = rows.reduce((s,r)=>s+r.qty,0), totV = rows.reduce((s,r)=>s+r.total,0);
    return '<section class="rp-sec"><h2>🍰 الأصناف المباعة ('+rows.length+')</h2>'+
      '<table class="rp-table"><thead><tr><th>#</th><th>الصنف</th><th>الكمية</th><th>المبلغ</th></tr></thead><tbody>'+body+
      '<tr class="rp-sum"><td colspan="2">الإجمالي</td><td class="n">'+totQ+'</td><td class="n">'+rmoney(totV)+'</td></tr></tbody></table></section>';
  }

  function secPay(list){
    const map = {};
    list.filter(notCancelled).forEach(o => { const k = payLabel(o); (map[k]=map[k]||{count:0,total:0}); map[k].count++; map[k].total += Number(o.total)||0; });
    const rows = Object.keys(map).map(k=>({k, count:map[k].count, total:map[k].total})).sort((a,b)=>b.total-a.total);
    if(!rows.length) return '<section class="rp-sec"><h2>💳 طرق الدفع</h2><p class="rp-empty">لا توجد بيانات.</p></section>';
    const body = rows.map(r=>'<tr><td>'+esc(r.k)+'</td><td class="n">'+r.count+'</td><td class="n">'+rmoney(r.total)+'</td></tr>').join('');
    return '<section class="rp-sec"><h2>💳 طرق الدفع</h2><table class="rp-table"><thead><tr><th>الطريقة</th><th>عدد الطلبات</th><th>المبلغ</th></tr></thead><tbody>'+body+'</tbody></table></section>';
  }

  function secCashiers(list){
    const map = {};
    list.filter(notCancelled).forEach(o => { const k = (o.cashier||'').trim() || 'غير معروف'; (map[k]=map[k]||{count:0,total:0,paid:0}); map[k].count++; map[k].total += Number(o.total)||0; map[k].paid += Number(o.paid)||0; });
    const rows = Object.keys(map).map(k=>({k, ...map[k]})).sort((a,b)=>b.total-a.total);
    if(!rows.length) return '<section class="rp-sec"><h2>👤 الكاشيرون</h2><p class="rp-empty">لا توجد بيانات.</p></section>';
    const body = rows.map((r,i)=>'<tr><td>'+(i+1)+'</td><td>'+esc(r.k)+'</td><td class="n">'+r.count+'</td><td class="n">'+rmoney(r.total)+'</td><td class="n">'+rmoney(r.paid)+'</td></tr>').join('');
    return '<section class="rp-sec"><h2>👤 الكاشيرون (حسب المبيعات)</h2><table class="rp-table"><thead><tr><th>#</th><th>الكاشير</th><th>عدد الطلبات</th><th>المبيعات</th><th>المحصّل</th></tr></thead><tbody>'+body+'</tbody></table></section>';
  }

  function secCustomers(list){
    const map = {};
    list.filter(notCancelled).forEach(o => {
      const key = ((o.phone||'').trim()) || ((o.name||'').trim()) || '—';
      (map[key] = map[key] || {name:o.name||'—', phone:o.phone||'', count:0, total:0, remaining:0});
      map[key].count++; map[key].total += Number(o.total)||0; map[key].remaining += Number(o.remaining)||0;
      if(o.name) map[key].name = o.name;
    });
    const rows = Object.values(map).sort((a,b)=>b.total-a.total);
    if(!rows.length) return '<section class="rp-sec"><h2>🧾 العملاء</h2><p class="rp-empty">لا توجد بيانات.</p></section>';
    const body = rows.map((r,i)=>'<tr><td>'+(i+1)+'</td><td>'+esc(r.name)+'</td><td>'+esc(r.phone||'—')+'</td><td class="n">'+r.count+'</td><td class="n">'+rmoney(r.total)+'</td><td class="n">'+rmoney(r.remaining)+'</td></tr>').join('');
    const totRemain = rows.reduce((s,r)=>s+r.remaining,0);
    return '<section class="rp-sec"><h2>🧾 العملاء والمتبقي ('+rows.length+')</h2><table class="rp-table"><thead><tr><th>#</th><th>الاسم</th><th>الجوال</th><th>الطلبات</th><th>الإجمالي</th><th>المتبقي</th></tr></thead><tbody>'+body+
      '<tr class="rp-sum"><td colspan="5">إجمالي المتبقي</td><td class="n">'+rmoney(totRemain)+'</td></tr></tbody></table></section>';
  }

  function secExchanges(list){
    const map = {};
    list.filter(notCancelled).forEach(o => { if(o.pay==='card' && o.exchangeName){ const k=o.exchangeName; (map[k]=map[k]||{count:0,total:0}); map[k].count++; map[k].total += Number(o.total)||0; } });
    const rows = Object.keys(map).map(k=>({k,...map[k]})).sort((a,b)=>b.total-a.total);
    if(!rows.length) return '<section class="rp-sec"><h2>🏦 الإيداعات</h2><p class="rp-empty">لا توجد إيداعات/حوالات.</p></section>';
    const body = rows.map((r,i)=>'<tr><td>'+(i+1)+'</td><td>'+esc(r.k)+'</td><td class="n">'+r.count+'</td><td class="n">'+rmoney(r.total)+'</td></tr>').join('');
    return '<section class="rp-sec"><h2>🏦 الإيداعات (الصرافون)</h2><table class="rp-table"><thead><tr><th>#</th><th>الصراف</th><th>عدد الحوالات</th><th>المبلغ</th></tr></thead><tbody>'+body+'</tbody></table></section>';
  }

  function secMenu(){
    if(!MENU.length) return '<section class="rp-sec"><h2>🍴 قائمة الأصناف</h2><p class="rp-empty">لا توجد أصناف.</p></section>';
    const body = MENU.map((m,i)=>'<tr><td>'+(i+1)+'</td><td>'+esc((m.emoji||'')+' '+(m.name||'—'))+'</td><td>'+esc(m.cat||m.category||'—')+'</td><td class="n">'+rmoney(m.price)+'</td><td>'+((m.available===false)?'غير متاح':'متاح')+'</td><td>'+(m.wrapped?'🎁 مغلّف':'—')+'</td></tr>').join('');
    return '<section class="rp-sec"><h2>🍴 قائمة الأصناف والأسعار ('+MENU.length+')</h2><table class="rp-table"><thead><tr><th>#</th><th>الصنف</th><th>القسم</th><th>السعر</th><th>الحالة</th><th>ملاحظة</th></tr></thead><tbody>'+body+'</tbody></table></section>';
  }

  function secUsers(){
    if(!USERS.length) return '<section class="rp-sec"><h2>👥 مستخدمو النظام</h2><p class="rp-empty">لا يوجد مستخدمون.</p></section>';
    const body = USERS.map((u,i)=>'<tr><td>'+(i+1)+'</td><td>'+esc(u.name||'—')+'</td><td>'+esc(u.username||u.user||'—')+'</td><td>'+esc(u.role||'—')+'</td></tr>').join('');
    return '<section class="rp-sec"><h2>👥 مستخدمو النظام ('+USERS.length+')</h2><table class="rp-table"><thead><tr><th>#</th><th>الاسم</th><th>اسم الدخول</th><th>الدور</th></tr></thead><tbody>'+body+'</tbody></table></section>';
  }

  function secStorage(list){
    const cols = [
      ['الطلبات', byteSize(ORDERS), ORDERS.length],
      ['المستخدمون', byteSize(USERS), USERS.length],
      ['الأصناف', byteSize(MENU), MENU.length],
      ['الإعدادات', byteSize(SETTINGS), 1]
    ];
    const total = cols.reduce((s,c)=>s+c[1],0);
    const body = cols.map(c=>'<tr><td>'+esc(c[0])+'</td><td class="n">'+c[2]+'</td><td class="n">'+fmtBytes(c[1])+'</td></tr>').join('');
    return '<section class="rp-sec"><h2>💾 حركة وحجم البيانات</h2><table class="rp-table"><thead><tr><th>المجموعة</th><th>عدد المستندات</th><th>الحجم التقديري</th></tr></thead><tbody>'+body+
      '<tr class="rp-sum"><td>الإجمالي</td><td class="n">'+(ORDERS.length+USERS.length+MENU.length+1)+'</td><td class="n">'+fmtBytes(total)+'</td></tr></tbody></table>'+
      '<p class="rp-note-sm">* الأحجام تقديرية محسوبة محلياً من محتوى المستندات.</p></section>';
  }

  function secSettings(){
    const s = SETTINGS || {};
    const rows = [
      ['اسم المحل', s.name||'—'],
      ['الشعار النصي', s.headerBrand||'—'],
      ['العنوان', s.address||'—'],
      ['الهاتف', s.phone||'—'],
      ['الرقم الضريبي', s.vatNo||'—'],
      ['نسبة الضريبة', (Math.round((Number(s.vatRate)||0)*10000)/100)+'%'],
      ['إظهار الضريبة', s.showVat===true?'نعم':'لا'],
      ['العملة', s.currency||'YER'],
      ['السماح بالعربون', s.allowDeposit===false?'لا':'نعم'],
      ['تعديل الكمية مباشرة', s.qtyEdit===false?'لا':'نعم'],
      ['الإشعارات', s.notifEnabled===false?'لا':'نعم']
    ];
    const body = rows.map(r=>'<tr><td>'+esc(r[0])+'</td><td>'+esc(String(r[1]))+'</td></tr>').join('');
    return '<section class="rp-sec"><h2>⚙️ إعدادات النظام</h2><table class="rp-table rp-kv"><tbody>'+body+'</tbody></table></section>';
  }

  // بناء جسم التقرير الكامل (HTML)
  function buildReportHTML(){
    const sel = selectedSections();
    const list = filterByRange();
    const brand = (SETTINGS && SETTINGS.name) || 'Mi Sweets';
    const head = '<header class="rp-top"><div><h1>'+esc(brand)+' — تقرير عام</h1>'+
      '<div class="rp-meta">الفترة: '+esc(rangeLabel())+' · تاريخ الإنشاء: '+esc(new Date().toLocaleString('ar'))+'</div></div></header>';
    let body = '';
    if(sel.overview)  body += secOverview(list);
    if(sel.orders)    body += secOrders(list);
    if(sel.items)     body += secItems(list);
    if(sel.pay)       body += secPay(list);
    if(sel.cashiers)  body += secCashiers(list);
    if(sel.customers) body += secCustomers(list);
    if(sel.exchanges) body += secExchanges(list);
    if(sel.menu)      body += secMenu();
    if(sel.users)     body += secUsers();
    if(sel.storage)   body += secStorage(list);
    if(sel.settings)  body += secSettings();
    if(!body) body = '<p class="rp-empty">لم تختر أي قسم. حدّد قسماً أو أكثر من اليسار.</p>';
    return '<div class="rp-doc">'+head+body+'<footer class="rp-bottom">تم إنشاء هذا التقرير آلياً من نظام '+esc(brand)+'</footer></div>';
  }

  function renderReport(){
    const pv = $('repPreview'); if(!pv) return;
    pv.innerHTML = buildReportHTML();
  }

  // CSS مكتفٍ ذاتياً لنافذة الطباعة
  function reportPrintCSS(){
    return "*{box-sizing:border-box;}"+
      "body{font-family:'Cairo','Segoe UI',Tahoma,sans-serif;direction:rtl;color:#0f172a;margin:0;padding:22px;background:#fff;}"+
      ".rp-doc{max-width:900px;margin:0 auto;}"+
      ".rp-top{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #2563eb;padding-bottom:12px;margin-bottom:18px;}"+
      ".rp-top h1{margin:0;font-size:22px;color:#1e3a8a;}"+
      ".rp-meta{font-size:12.5px;color:#64748b;margin-top:6px;}"+
      ".rp-sec{margin-bottom:22px;page-break-inside:avoid;}"+
      ".rp-sec h2{font-size:16px;color:#1e3a8a;border-right:4px solid #2563eb;padding:4px 10px;background:#eff6ff;border-radius:6px;margin:0 0 10px;}"+
      ".rp-kpis{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;}"+
      ".rp-kpi{border:1px solid #e2e8f0;border-radius:10px;padding:10px;text-align:center;background:#f8fafc;}"+
      ".rp-kpi-v{display:block;font-size:17px;font-weight:800;color:#0f172a;}"+
      ".rp-kpi-l{display:block;font-size:11.5px;color:#64748b;margin-top:3px;}"+
      ".rp-table{width:100%;border-collapse:collapse;font-size:12.5px;}"+
      ".rp-table th{background:#1e3a8a;color:#fff;padding:7px 8px;text-align:right;font-weight:700;}"+
      ".rp-table td{padding:6px 8px;border-bottom:1px solid #eef2f7;text-align:right;}"+
      ".rp-table td.n{text-align:left;font-variant-numeric:tabular-nums;white-space:nowrap;}"+
      ".rp-table tbody tr:nth-child(even){background:#f8fafc;}"+
      ".rp-sum td{font-weight:800;background:#eff6ff;border-top:2px solid #2563eb;}"+
      ".rp-kv td:first-child{color:#64748b;width:40%;}"+
      ".rp-empty{color:#94a3b8;font-size:13px;padding:10px;}"+
      ".rp-note-sm{font-size:11px;color:#92400e;margin-top:6px;}"+
      ".rp-bottom{margin-top:24px;border-top:1px solid #e2e8f0;padding-top:10px;text-align:center;color:#94a3b8;font-size:11.5px;}"+
      "@media print{body{padding:0;}.rp-sec{page-break-inside:avoid;}}";
  }

  function printReport(){
    const html = buildReportHTML();
    const w = window.open('', '_blank');
    if(!w){ alert('الرجاء السماح بالنوافذ المنبثقة للطباعة.'); return; }
    const title = ((SETTINGS && SETTINGS.name) || 'Mi Sweets') + ' — تقرير عام';
    w.document.open();
    w.document.write('<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="utf-8"/>'+
      '<meta name="viewport" content="width=device-width, initial-scale=1"/>'+
      '<title>'+esc(title)+'</title>'+
      '<link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&display=swap" rel="stylesheet"/>'+
      '<style>'+reportPrintCSS()+'</style></head><body>'+html+'</body></html>');
    w.document.close();
    setTimeout(function(){ try{ w.focus(); w.print(); }catch(e){} }, 500);
  }

  function openReport(){
    const ov = $('repOverlay'); if(!ov) return;
    ov.classList.add('show');
    renderReport();
  }
  function closeReport(){ const ov = $('repOverlay'); if(ov) ov.classList.remove('show'); }

  function bindReport(){
    const btn = $('dashReportBtn');
    if(btn && !btn._bound){ btn._bound = true; btn.addEventListener('click', openReport); }
    const cl = $('repClose'); if(cl && !cl._bound){ cl._bound = true; cl.addEventListener('click', closeReport); }
    const ov = $('repOverlay'); if(ov && !ov._bound){ ov._bound = true; ov.addEventListener('click', function(e){ if(e.target === ov) closeReport(); }); }
    const gen = $('repGen'); if(gen && !gen._bound){ gen._bound = true; gen.addEventListener('click', renderReport); }
    const pr = $('repPrint'); if(pr && !pr._bound){ pr._bound = true; pr.addEventListener('click', printReport); }
    const rng = $('repRange'); if(rng && !rng._bound){ rng._bound = true; rng.addEventListener('change', function(){ const c=$('repCustomRange'); if(c) c.style.display = (rng.value==='custom')?'':'none'; renderReport(); }); }
    const sa = $('repSelectAll'); if(sa && !sa._bound){ sa._bound = true; sa.addEventListener('click', function(){ document.querySelectorAll('#repChecks input[type=checkbox]').forEach(c=>c.checked=true); renderReport(); }); }
    const sn = $('repSelectNone'); if(sn && !sn._bound){ sn._bound = true; sn.addEventListener('click', function(){ document.querySelectorAll('#repChecks input[type=checkbox]').forEach(c=>c.checked=false); renderReport(); }); }
    document.querySelectorAll('#repChecks input[type=checkbox]').forEach(c=>{ if(!c._bound){ c._bound=true; c.addEventListener('change', renderReport); } });
    ['repFrom','repTo'].forEach(id=>{ const el=$(id); if(el && !el._bound){ el._bound=true; el.addEventListener('change', renderReport); } });
  }

  // فتح اللوحة: تحميل البيانات + اشتراك حي (مرة واحدة)
  async function open(){
    setConn();
    bindEye(); updateEye();
    bindReport();
    if(!clockTimer){ tickClock(); clockTimer = setInterval(tickClock, 1000); }
    try{
      SETTINGS = await DB.getSettings() || {};
      const bn = $('dashBrand'); if(bn && SETTINGS.name) bn.textContent = SETTINGS.name;
    }catch(e){}
    try{ ORDERS = await DB.getOrders() || []; }catch(e){ ORDERS = []; }
    try{ USERS = (typeof DB.getUsers==='function' ? await DB.getUsers() : []) || []; }catch(e){ USERS = []; }
    try{ MENU  = (typeof DB.getMenu==='function'  ? await DB.getMenu()  : []) || []; }catch(e){ MENU = []; }
    renderAll();
    if(!subscribed){
      subscribed = true;
      if(typeof DB.onSettings === 'function') DB.onSettings(cfg => { if(cfg){ SETTINGS = cfg; const bn=$('dashBrand'); if(bn && cfg.name) bn.textContent = cfg.name; renderAll(); } });
      if(typeof DB.onOrders === 'function') DB.onOrders(list => { if(list){ ORDERS = list; setConn(); renderAll(); } });
    }
  }

  return { open };
})();
