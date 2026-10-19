// ===== إعدادات النظام (تُحمّل من لوحة التحكم) =====
let RESTAURANT = {
  name:   'كاشير',
  phone:  '920001234',
  address:'شارع الملك فهد، الرياض',
  vatNo:  '300000000000003', // الرقم الضريبي (اختياري)
  vatRate: 0.15,             // نسبة ضريبة القيمة المضافة
  currency: 'YER',           // العملة الافتراضية: الريال اليمني
  footer: 'شكراً لزيارتكم ❤️',
  exchanges: [ { name: 'شركة المشقاص للصرافة', color: '#16a34a' } ],
  print: { align:'center', logoSide:false, qrSide:false, marginTop:0, marginSide:4, paddingV:6, fontSize:12,
    margins: { right:{top:0,side:4,padV:6}, center:{top:0,side:4,padV:6}, left:{top:0,side:4,padV:6} } },
  fonts: { base:100, heading:100, table:100, button:100, input:100 },
  uiStyle: 'old', // 'old' | 'new' (شكل النظام)
  invoice: { fontHeading:18, fontBody:12, fontTable:12, fontTotal:14, fontFooter:11,
    showLogo:true, showTagline:true, showAddress:true, showPhone:true, showPickup:true,
    showTheme:true, showCashier:true, showFooter:true,
    order:['header','meta','items','totals','payment','footer','qr'] }
};

// تطبيق الخطوط العامة (نِسَب مئوية) عبر عنصر <style> ديناميكي
function applyGlobalFonts(fonts){
  const f = Object.assign({ base:100, heading:100, table:100, button:100, input:100 }, fonts || {});
  const clamp = v => Math.min(200, Math.max(60, Number(v) || 100));
  const b = clamp(f.base), h = clamp(f.heading), t = clamp(f.table), btn = clamp(f.button), inp = clamp(f.input);
  let st = document.getElementById('globalFontStyle');
  if(!st){ st = document.createElement('style'); st.id = 'globalFontStyle'; document.head.appendChild(st); }
  st.textContent =
    'body{font-size:' + b + '% !important;}' +
    'h1,h2,h3,h4,h5,.brand-name,.page-title,.section-title{font-size:' + h + '% !important;}' +
    'table,.ticket,.menu-item,.cust-item,.order-row,td,th{font-size:' + t + '% !important;}' +
    'button,.btn,.pos-btn,.pay-btn{font-size:' + btn + '% !important;}' +
    'input,select,textarea{font-size:' + inp + '% !important;}';
}

// العملات المدعومة (الرمز والاسم)
const CURRENCIES = {
  YER: {symbol:'ر.ي',  name:'ريال يمني'},
  SAR: {symbol:'ر.س',  name:'ريال سعودي'},
  USD: {symbol:'$',    name:'دولار أمريكي'},
  AED: {symbol:'د.إ',  name:'درهم إماراتي'},
  EGP: {symbol:'ج.م',  name:'جنيه مصري'},
  QAR: {symbol:'ر.ق',  name:'ريال قطري'},
  OMR: {symbol:'ر.ع',  name:'ريال عماني'},
  KWD: {symbol:'د.ك',  name:'دينار كويتي'},
  JOD: {symbol:'د.أ',  name:'دينار أردني'},
  EUR: {symbol:'€',    name:'يورو'}
};
function currencySymbol(){ return (CURRENCIES[RESTAURANT.currency] || CURRENCIES.YER).symbol; }

// تطبيق إعدادات الطباعة على عنصر الفاتورة قبل الطباعة
function applyPrintStyle(){
  const r = document.getElementById('receipt');
  if(!r) return;
  const p = RESTAURANT.print || {};
  // هوامش حسب موضع الفاتورة (يمين/وسط/يسار) — مع fallback للقيم القديمة
  const _m = (p.margins && p.margins[p.align]) || {};
  const side = (Number(_m.side != null ? _m.side : p.marginSide) || 0) + 'mm';
  const top  = (Number(_m.top != null ? _m.top : p.marginTop) || 0) + 'mm';
  const padV = (Number(_m.padV != null ? _m.padV : p.paddingV) || 0) + 'mm';
  // موقع الفاتورة على الورقة
  if(p.align === 'right'){ r.style.left = 'auto'; r.style.right = '0'; r.style.margin = top + ' 0 0 0'; }
  else if(p.align === 'left'){ r.style.right = 'auto'; r.style.left = '0'; r.style.margin = top + ' 0 0 0'; }
  else { r.style.left = '0'; r.style.right = '0'; r.style.margin = top + ' auto 0 auto'; }
  r.style.padding = padV + ' ' + side;
  r.style.fontSize = (Number(p.fontSize) || 12) + 'px';
}

// تنفيذ الطباعة: داخل تطبيق أندرويد (WebView) لا يعمل window.print() تلقائياً،
// لذلك نستدعي الجسر الأصلي AndroidPrint.print() الذي يفتح معاينة الطباعة عبر النظام.
// في المتصفح العادي نعود إلى window.print() كالمعتاد.
function nativePrint(){
  try{ if(typeof logActivity==='function') logActivity('print', 'طباعة فاتورة'); }catch(e){}
  var cfg = null;
  try{ if(window.BMSPrinter && typeof BMSPrinter.load==='function') cfg = BMSPrinter.load(); }catch(e){}
  try{
    var A = window.AndroidPrint;
    if(A){
      if(cfg){
        var opt = { printer: cfg.defaultPrinter||'', copies: cfg.copies||1,
                    silent: cfg.silent===true, autoCut: cfg.autoCut!==false,
                    cashDrawer: cfg.cashDrawer===true, feedLines: cfg.feedLines||0, width: cfg.paperWidth };
        if(cfg.silent===true && typeof A.printSilent==='function'){ A.printSilent(JSON.stringify(opt)); return; }
        if(typeof A.printWith==='function'){ A.printWith(JSON.stringify(opt)); return; }
      }
      if(typeof A.print === 'function'){ A.print(); return; }
    }
  }catch(e){}
  // المتصفّح: window.print() دائماً يعرض نافذة الطباعة (قيد المتصفّح)؛ نحترم عدد النسخ إن أمكن
  try{
    var n = cfg ? Math.max(1, parseInt(cfg.copies,10)||1) : 1;
    (function loop(i){ if(i<=0) return; window.print(); if(i>1) setTimeout(function(){ loop(i-1); }, 400); })(n);
  }catch(e){ try{ window.print(); }catch(_){} }
}

// ===== سجل الحركة (ACTIVITY LOG) =====
// ملاحظة: اسم شبكة WiFi (SSID) غير متاح من الويب/WebView بلا كود أندرويد أصلي +
// إذن موقع؛ لذلك نسجّل نوع الشبكة (wifi/cellular) والاتصال فقط عبر navigator.connection.
function netInfo(){
  var out = { net:'unknown', online:true };
  try{ out.online = (typeof navigator.onLine==='boolean') ? navigator.onLine : true; }catch(e){}
  try{
    var c = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    if(!out.online){ out.net = 'none'; }
    else if(c && c.type){ out.net = (c.type==='wifi') ? 'wifi' : (c.type==='cellular' ? 'cellular' : c.type); }
    else if(c && c.effectiveType){ out.net = 'cellular'; }
  }catch(e){}
  return out;
}
function logActivity(event, action){
  try{
    var u = (typeof currentPosUser!=='undefined' && currentPosUser) ? currentPosUser : null;
    var ni = netInfo();
    var entry = {
      user: u ? (u.name || u.username || '') : 'زائر',
      username: u ? (u.username || '') : '',
      role: u ? (u.role || '') : '',
      event: event || 'action',
      action: action || '',
      net: ni.net,
      online: ni.online,
      ts: Date.now()
    };
    if(window.DB && typeof DB.addActivity==='function') DB.addActivity(entry);
  }catch(e){}
}
try{ window.logActivity = logActivity; }catch(e){}

// ===== State =====
let MENU = [];
let CATEGORIES = ['الكل'];
let activeCat = 'الكل';
let ticket = [];            // الطلب الحالي (غير محفوظ بين الجلسات)
let orderType = 'محلي';
let payMethod = 'cash';
let depositType = 'إيداع';   // نوع العملية عند اختيار إيداع/حوالة
let exchangeName = '';     // اسم الصراف المختار
let exchangeColor = '';    // لون خلفية الصراف المختار
let orderTheme = false;     // مع ثيم / بدون ثيم
let themeData = {occasion:'', customText:''}; // بيانات الثيم: المناسبة + النص الحر

// ===== Helpers =====
function esc(str){
  return String(str == null ? '' : str).replace(/[&<>"']/g, c => (
    {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]
  ));
}
function money(n){ return (Math.round(n*100)/100) + ' ' + currencySymbol(); }

// أسماء أيام الأسبوع بالعربية
const WEEK_DAYS_AR = ['الأحد','الاثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت'];
function weekdayName(dateStr){
  if(!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  if(isNaN(d)) return '';
  return WEEK_DAYS_AR[d.getDay()];
}
// نص موعد الاستلام (يوم + تاريخ + وقت) أو فارغ
function pickupLabel(o){
  if(!o || (!o.pickupDate && !o.pickupTime)) return '';
  let parts = [];
  if(o.pickupDate){
    const wd = weekdayName(o.pickupDate);
    parts.push((wd ? wd + ' ' : '') + o.pickupDate);
  }
  if(o.pickupTime) parts.push(o.pickupTime);
  return parts.join(' · ');
}

// رقم الطلب التسلسلي للعرض (يبدأ من 1)
function orderNoLabel(o){ return (o && o.orderNo) ? ('#' + o.orderNo) : (o ? o.id : ''); }
// نص قابل للبحث يجمع كل حقول الطلب
function orderSearchText(o){
  const items = (o.items || []).map(it => it.name).join(' ');
  return [
    o.orderNo != null ? ('#' + o.orderNo) : '', o.orderNo, o.id, o.name, o.phone, o.address,
    o.type, payLabelOf(o), o.date, o.pickupDate, o.pickupTime, weekdayName(o.pickupDate),
    o.total, o.remaining, o.cashier, o.theme ? 'ثيم' : '', o.themeData ? (o.themeData.occasion||'') : '', o.themeData ? (o.themeData.customText||'') : '', items, o.doneMark ? 'تم التنفيذ منفذ' : ''
  ].join(' ').toLowerCase();
}

// ===== Clock =====
function tickClock(){
  const el = document.getElementById('posClock');
  if(el) el.textContent = new Date().toLocaleString('ar', {hour:'2-digit',minute:'2-digit',day:'2-digit',month:'2-digit',year:'numeric'});
}
tickClock(); setInterval(tickClock, 1000);

// ===== Render catalog =====
function rebuildCategories(){
  CATEGORIES = ['الكل', ...new Set(MENU.map(m => m.cat))];
  if(!CATEGORIES.includes(activeCat)) activeCat = 'الكل';
}
function renderCategories(){
  const wrap = document.getElementById('categories');
  wrap.innerHTML = '';
  CATEGORIES.forEach(cat => {
    const chip = document.createElement('button');
    chip.className = 'cat-chip' + (cat === activeCat ? ' active' : '');
    chip.textContent = cat;
    chip.onclick = () => { activeCat = cat; renderCategories(); renderCatalog(); };
    wrap.appendChild(chip);
  });
}
function renderCatalog(){
  const grid = document.getElementById('menuGrid');
  grid.innerHTML = '';
  const items = activeCat === 'الكل' ? MENU : MENU.filter(m => m.cat === activeCat);
  if(items.length === 0){
    grid.innerHTML = '<div class="pos-empty">لا توجد أصناف متاحة</div>';
    return;
  }
  items.forEach(item => {
    const card = document.createElement('div');
    card.className = 'pos-card';
    card.innerHTML =
      '<div class="pc-emoji">' + (item.emoji||'🍽️') + '</div>' +
      '<div class="pc-name">' + esc(item.name) + '</div>' +
      '<div class="pc-price">' + money(item.price) + '</div>';
    card.onclick = () => addToTicket(item.id);
    grid.appendChild(card);
  });
}

// ===== Ticket logic =====
function addToTicket(id){
  const found = ticket.find(t => t.id === id);
  if(found){ found.qty++; }
  else {
    const item = MENU.find(m => m.id === id);
    if(!item) return;
    ticket.push({id:item.id, name:item.name, price:item.price, emoji:item.emoji, qty:1, wrapped:!!item.wrapped});
  }
  renderTicket();
}
function changeQty(id, delta){
  const t = ticket.find(x => x.id === id);
  if(!t) return;
  t.qty += delta;
  if(t.qty <= 0) ticket = ticket.filter(x => x.id !== id);
  renderTicket();
}
// ضبط الكمية مباشرة (تعديل الرقم بالكتابة)
function setQty(id, val){
  const t = ticket.find(x => x.id === id);
  if(!t) return;
  let n = parseInt(val, 10);
  if(isNaN(n) || n < 0) n = 0;
  t.qty = n;
  if(t.qty <= 0) ticket = ticket.filter(x => x.id !== id);
  renderTicket();
}
function removeLine(id){ ticket = ticket.filter(x => x.id !== id); renderTicket(); }
function clearTicket(){ ticket = []; orderTheme = false; themeData = {occasion:'', customText:''}; document.getElementById('custName').value=''; document.getElementById('custPhone').value=''; document.getElementById('paidAmount').value=''; document.getElementById('pickupDate').value=''; document.getElementById('pickupTime').value=''; resetPayMethod(); renderTicket(); }
// إعادة ضبط طريقة الدفع إلى نقد (بعد كل طلب)
function resetPayMethod(){
  payMethod = 'cash'; exchangeName = ''; exchangeColor = ''; depositType = 'إيداع';
  document.querySelectorAll('.pay-btn').forEach(x => x.classList.remove('active'));
  const cashBtn = document.querySelector('.pay-btn[data-pay="cash"]');
  if(cashBtn) cashBtn.classList.add('active');
  const cardBtn = document.getElementById('cardBtn');
  if(cardBtn) cardBtn.textContent = '🏦 إيداع أو حوالة';
  const cashRow = document.getElementById('cashRow');
  if(cashRow) cashRow.style.display = 'flex';
  const paidLabel = document.getElementById('paidLabel');
  if(paidLabel) paidLabel.textContent = 'المدفوع';
  const changeRow = document.getElementById('changeRow'); if(changeRow) changeRow.style.display = 'none';
  const remainRow = document.getElementById('remainRow'); if(remainRow) remainRow.style.display = 'none';
}

function calcTotals(){
  const subtotal = ticket.reduce((s,t) => s + t.price*t.qty, 0);
  const vat = (RESTAURANT.showVat === false) ? 0 : subtotal * RESTAURANT.vatRate;
  const total = subtotal + vat;
  return {subtotal, vat, total};
}

function renderTicket(){
  const wrap = document.getElementById('ticketItems');
  wrap.innerHTML = '';
  // أخف زر إرسال واتساب بمجرد البدء بطلب جديد
  if(ticket.length > 0){ const _wa = document.getElementById('waInvoiceBtn'); if(_wa) _wa.style.display = 'none'; }
  if(ticket.length === 0){
    wrap.innerHTML = '<p class="ticket-empty">اضغط على الأصناف لإضافتها 👆</p>';
  } else {
    const QTY_EDIT = (RESTAURANT.qtyEdit !== false);  // تعديل الكمية بالضغط المباشر على الرقم
    ticket.forEach(t => {
      const row = document.createElement('div');
      row.className = 't-item';
      const qtyCell = QTY_EDIT
        ? '<input class="qty-input" type="number" min="0" step="1" inputmode="numeric" data-q="'+t.id+'" value="'+t.qty+'" aria-label="الكمية" />'
        : '<span>'+t.qty+'</span>';
      row.innerHTML =
        '<span class="ti-emoji">' + (t.emoji||'🍽️') + '</span>' +
        '<div class="ti-info"><h4>' + esc(t.name) + '</h4><span>' + money(t.price) + '</span></div>' +
        '<div class="qty">' +
          '<button data-m="'+t.id+'">−</button>' +
          qtyCell +
          '<button data-p="'+t.id+'">+</button>' +
        '</div>' +
        '<span class="ti-line">' + money(t.price*t.qty) + '</span>' +
        '<button class="t-del" data-d="'+t.id+'">🗑️</button>';
      row.querySelector('[data-m]').onclick = () => changeQty(t.id, -1);
      row.querySelector('[data-p]').onclick = () => changeQty(t.id, 1);
      row.querySelector('[data-d]').onclick = () => removeLine(t.id);
      if(QTY_EDIT){
        const qi = row.querySelector('[data-q]');
        if(qi){
          qi.onclick = (e) => { e.stopPropagation(); qi.select(); };
          qi.onfocus = () => qi.select();
          qi.onchange = () => setQty(t.id, qi.value);
          qi.onkeydown = (e) => { if(e.key === 'Enter'){ e.preventDefault(); qi.blur(); } };
        }
      }
      wrap.appendChild(row);
    });
  }
  const {subtotal, vat, total} = calcTotals();
  document.getElementById('subTotal').textContent = money(subtotal);
  document.getElementById('vatVal').textContent = money(vat);
  document.getElementById('grandTotal').textContent = money(total);
  // إخفاء صفوف الضريبة والمجموع الفرعي عند تعطيل الضريبة
  const _showVat = (RESTAURANT.showVat !== false);
  const _vatRow = document.getElementById('vatRow');
  const _subRow = document.getElementById('subRow');
  if(_vatRow) _vatRow.style.display = _showVat ? '' : 'none';
  if(_subRow) _subRow.style.display = _showVat ? '' : 'none';
  updateChange();
  updateThemeRow();
}

// إظهار خيار الثيم فقط عند وجود أصناف مغلّفة في الطلب
function ticketHasWrapped(){ return ticket.some(t => t.wrapped); }
function updateThemeRow(){
  // صف الثيم ظاهر دائماً (لا يعتمد على الأصناف المغلّفة)
  const row = document.getElementById('themeRow');
  if(!row) return;
  row.style.display = 'flex';
}

// ===== Order type & payment =====
document.getElementById('typeRow').querySelectorAll('.type-btn').forEach(b => {
  b.onclick = () => {
    document.querySelectorAll('.type-btn').forEach(x => x.classList.remove('active'));
    b.classList.add('active'); orderType = b.dataset.type;
  };
});

// إظهار/إخفاء أزرار نوع الطلب حسب إعدادات لوحة التحكم
function applyOrderTypeVisibility(ot){
  const map = { 'محلي':'local', 'سفري':'takeaway', 'توصيل':'delivery' };
  const cfg = ot || {};
  const btns = document.querySelectorAll('#typeRow .type-btn');
  if(!btns.length) return;
  let firstVisible = null;
  btns.forEach(b => {
    const key = map[b.dataset.type];
    const visible = key ? (cfg[key] !== false) : true;
    b.style.display = visible ? '' : 'none';
    if(visible && !firstVisible) firstVisible = b;
  });
  // إن كان الزر النشط مخفياً، انتقل إلى أول زر ظاهر
  const active = document.querySelector('#typeRow .type-btn.active');
  if((!active || active.style.display === 'none') && firstVisible){
    btns.forEach(x => x.classList.remove('active'));
    firstVisible.classList.add('active');
    orderType = firstVisible.dataset.type;
  }
}
document.getElementById('payRow').querySelectorAll('.pay-btn').forEach(b => {
  b.onclick = () => {
    // زر الإيداع/الحوالة: افتح نافذة اختيار النوع والصراف أولاً
    if(b.dataset.pay === 'card'){ openDepositModal(); return; }
    document.querySelectorAll('.pay-btn').forEach(x => x.classList.remove('active'));
    b.classList.add('active'); payMethod = b.dataset.pay;
    const cashRow = document.getElementById('cashRow');
    const paidLabel = document.getElementById('paidLabel');
    // نقد: حقل المدفوع + الباقي | عربون: حقل العربون + المتبقي | شبكة: بدون حقول
    cashRow.style.display = (payMethod === 'cash' || payMethod === 'deposit') ? 'flex' : 'none';
    if(paidLabel) paidLabel.textContent = payMethod === 'deposit' ? 'العربون المدفوع' : 'المدفوع';
    document.getElementById('changeRow').style.display = 'none';
    document.getElementById('remainRow').style.display = 'none';
    if(payMethod === 'cash') updateChange();
    else if(payMethod === 'deposit') updateRemain();
  };
});

// ===== نافذة الإيداع / الحوالة واختيار الصراف =====
function currentExchanges(){
  const list = (RESTAURANT && Array.isArray(RESTAURANT.exchanges)) ? RESTAURANT.exchanges : [];
  return list.filter(e => e && e.name);
}
function renderDepositExchList(){
  const wrap = document.getElementById('depositExchList');
  if(!wrap) return;
  const list = currentExchanges();
  if(!list.length){
    wrap.innerHTML = '<div class="deposit-empty">لا يوجد صرافون — أضفهم من لوحة التحكم من تبويب إعدادات الإيداع.</div>';
    return;
  }
  wrap.innerHTML = list.map((e, i) =>
    '<button class="exch-btn' + (e.name === exchangeName ? ' active' : '') + '" data-exch="' + i + '" ' +
    'style="background:' + esc(e.color || '#16a34a') + '">' + esc(e.name) + '</button>'
  ).join('');
  wrap.querySelectorAll('.exch-btn').forEach(btn => {
    btn.onclick = () => {
      const idx = Number(btn.dataset.exch);
      const e = list[idx];
      if(!e) return;
      exchangeName = e.name; exchangeColor = e.color || '#16a34a';
      wrap.querySelectorAll('.exch-btn').forEach(x => x.classList.remove('active'));
      btn.classList.add('active');
    };
  });
}
function openDepositModal(){
  const modal = document.getElementById('depositModal');
  if(!modal) return;
  // تهيئة النوع الافتراضي والصراف الأول إن لم يسبق اختيار
  if(!depositType) depositType = 'إيداع';
  const list = currentExchanges();
  if(!exchangeName && list.length){ exchangeName = list[0].name; exchangeColor = list[0].color || '#16a34a'; }
  document.querySelectorAll('#depositTypeRow .dep-type-btn').forEach(x =>
    x.classList.toggle('active', x.dataset.dtype === depositType));
  renderDepositExchList();
  modal.classList.add('show');
}
function setupDepositModal(){
  const modal = document.getElementById('depositModal');
  if(!modal) return;
  const closeBtn = document.getElementById('closeDepositModal');
  if(closeBtn) closeBtn.onclick = () => modal.classList.remove('show');
  modal.addEventListener('click', e => { if(e.target === modal) modal.classList.remove('show'); });
  document.querySelectorAll('#depositTypeRow .dep-type-btn').forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll('#depositTypeRow .dep-type-btn').forEach(x => x.classList.remove('active'));
      btn.classList.add('active'); depositType = btn.dataset.dtype;
    };
  });
  const confirmBtn = document.getElementById('depositConfirmBtn');
  if(confirmBtn) confirmBtn.onclick = () => {
    const list = currentExchanges();
    if(list.length && !exchangeName){ showToast('اختر الصراف أولاً'); return; }
    // تفعيل طريقة الدفع إيداع/حوالة (تُخزّن داخلياً كـ card)
    payMethod = 'card';
    document.querySelectorAll('.pay-btn').forEach(x => x.classList.remove('active'));
    const cardBtn = document.getElementById('cardBtn');
    if(cardBtn){
      cardBtn.classList.add('active');
      cardBtn.textContent = '🏦 ' + depositType + (exchangeName ? ' · ' + exchangeName : '');
    }
    document.getElementById('cashRow').style.display = 'none';
    document.getElementById('changeRow').style.display = 'none';
    document.getElementById('remainRow').style.display = 'none';
    modal.classList.remove('show');
    showToast('تم اختيار ' + depositType + (exchangeName ? ' — ' + exchangeName : ''));
  };
}
document.getElementById('paidAmount').addEventListener('input', () => {
  if(payMethod === 'cash') updateChange();
  else if(payMethod === 'deposit') updateRemain();
});

// أزرار الثيم (مع/بدون)
document.querySelectorAll('#themeRow .theme-btn').forEach(b => {
  b.onclick = () => {
    document.querySelectorAll('#themeRow .theme-btn').forEach(x => x.classList.remove('active'));
    b.classList.add('active');
    orderTheme = (b.dataset.theme === 'yes');
    if(orderTheme){
      openThemeModal();
    } else {
      themeData = {occasion:'', customText:''};
      document.getElementById('themeOccasion').value = '';
      document.getElementById('themeCustomText').value = '';
    }
  };
});
// قائمة المناسبات المتاحة
const THEME_OCCASIONS = ['مولود','مولودة','توم','زواج','خطوبة'];
function openThemeModal(){
  const m = document.getElementById('themeDetailModal');
  if(!m) return;
  // تعبئة أزرار المناسبات
  const wrap = document.getElementById('themeOccasionBtns');
  if(wrap){
    wrap.innerHTML = '';
    THEME_OCCASIONS.forEach(oc => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'occasion-btn' + (themeData.occasion === oc ? ' active' : '');
      btn.textContent = oc;
      btn.onclick = () => {
        document.querySelectorAll('#themeOccasionBtns .occasion-btn').forEach(x => x.classList.remove('active'));
        btn.classList.add('active');
        themeData.occasion = oc;
      };
      wrap.appendChild(btn);
    });
  }
  document.getElementById('themeOccasion').value = themeData.occasion || '';
  document.getElementById('themeCustomText').value = themeData.customText || '';
  m.classList.add('show');
}
function saveThemeDetails(){
  const sel = document.querySelector('#themeOccasionBtns .occasion-btn.active');
  themeData.occasion = sel ? sel.textContent.trim() : (document.getElementById('themeOccasion').value || '');
  themeData.customText = document.getElementById('themeCustomText').value.trim();
  document.getElementById('themeDetailModal').classList.remove('show');
}
function setupThemeModal(){
  const m = document.getElementById('themeDetailModal');
  if(!m) return;
  document.getElementById('closeThemeModal').onclick = () => m.classList.remove('show');
  m.onclick = (e) => { if(e.target === m) m.classList.remove('show'); };
  document.getElementById('saveThemeBtn').onclick = () => saveThemeDetails();
}
function updateChange(){
  if(payMethod !== 'cash') return;
  const {total} = calcTotals();
  const paid = parseFloat(document.getElementById('paidAmount').value) || 0;
  const changeRow = document.getElementById('changeRow');
  if(paid > 0 && paid >= total){
    changeRow.style.display = 'flex';
    document.getElementById('changeVal').textContent = money(paid - total);
  } else {
    changeRow.style.display = 'none';
  }
}
function updateRemain(){
  if(payMethod !== 'deposit') return;
  const {total} = calcTotals();
  const paid = parseFloat(document.getElementById('paidAmount').value) || 0;
  const remainRow = document.getElementById('remainRow');
  if(paid > 0 && paid < total){
    remainRow.style.display = 'flex';
    document.getElementById('remainVal').textContent = money(total - paid);
  } else {
    remainRow.style.display = 'none';
  }
}

// ===== Clear / new order =====
document.getElementById('clearTicket').onclick = () => {
  if(ticket.length && !confirm('بدء طلب جديد ومسح الحالي؟')) return;
  clearTicket();
};

// زر إرسال الفاتورة عبر واتساب (يرسل آخر فاتورة أُنشئت)
(function(){
  const waBtn = document.getElementById('waInvoiceBtn');
  if(waBtn) waBtn.onclick = () => sendInvoiceWhatsApp(lastOrder);
})();

// ===== Pay & print =====
document.getElementById('payPrintBtn').onclick = async function(){
  if(ticket.length === 0){ showToast('أضف أصنافاً أولاً'); return; }
  const {subtotal, vat, total} = calcTotals();
  const inputVal = parseFloat(document.getElementById('paidAmount').value) || 0;

  let paid, change = 0, remaining = 0, payStatus = 'paid';

  if(payMethod === 'deposit'){
    // عربون / دفعة جزئية
    paid = inputVal;
    if(paid <= 0){ showToast('أدخل قيمة العربون'); return; }
    if(paid >= total){
      // دفع كامل فعلياً
      change = paid - total; remaining = 0; payStatus = 'paid';
    } else {
      remaining = Math.round((total - paid) * 100) / 100; payStatus = 'partial';
    }
  } else if(payMethod === 'cash'){
    paid = inputVal || total;
    if(paid < total){ showToast('المبلغ أقل من الإجمالي — استخدم زر "عربون"'); return; }
    change = paid - total;
  } else { // card
    paid = total;
  }

  // رقم طلب تسلسلي (يبدأ من 1)
  let orderNo = 0;
  try{ orderNo = await DB.nextOrderNo(); }catch(e){ orderNo = 0; }

  const order = {
    id: 'INV-' + Date.now(),
    orderNo: orderNo,
    cashier: (typeof currentPosUser !== 'undefined' && currentPosUser) ? currentPosUser.name : '',
    name: document.getElementById('custName').value.trim() || 'عميل نقدي',
    phone: document.getElementById('custPhone').value.trim() || '',
    address: '',
    type: orderType,
    pay: payMethod,
    depositType: (payMethod === 'card') ? depositType : '',
    exchangeName: (payMethod === 'card') ? exchangeName : '',
    exchangeColor: (payMethod === 'card') ? exchangeColor : '',
    items: ticket.map(t => ({name:t.name, price:t.price, qty:t.qty, emoji:t.emoji, wrapped:!!t.wrapped})),
    subtotal: subtotal, vat: vat, total: total,
    paid: Math.round(paid*100)/100, change: Math.max(0, Math.round(change*100)/100),
    remaining: remaining, payStatus: payStatus,
    pickupDate: document.getElementById('pickupDate').value || '',
    pickupTime: document.getElementById('pickupTime').value || '',
    hasWrapped: ticketHasWrapped(),
    theme: orderTheme,
    themeData: orderTheme ? Object.assign({}, themeData) : false,
    status: 'done',
    prep: 'pending', // حالة التحضير: pending=يحتاج تأكيد · confirmed=قيد التنفيذ · ready=جاهز
    createdAt: Date.now(),
    date: new Date().toLocaleString('ar')
  };

  // طباعة الفاتورة فوراً
  printReceipt(order);
  showWaInvoiceBtn(order);
  showToast(payStatus === 'partial'
    ? 'تم تسجيل عربون · متبقي ' + money(remaining)
    : 'تم تسجيل الطلب (' + orderNoLabel(order) + ')');

  // إشعار محلي بالطلب الجديد
  const items = (order.items || []).map(it => it.name).join('، ');
  addNotification(
    'طلب جديد ' + orderNoLabel(order),
    (order.name || 'عميل') + ' · ' + (order.type||'') + ' · ' + payLabelOf(order) + (items ? ' · ' + items.slice(0, 60) : ''),
    '🛒',
    order.id
  );

  // حفظ الطلب في الخلفية (سحابياً أو محلياً)
  selfOrderIds.add(order.id); // طلب أنشأه هذا الجهاز — لا تُكرّر تنبيهه عند وصول السنابشوت
  try{ logActivity('order', 'إنشاء طلب #' + (order.no||'') + ' · ' + (order.total!=null? order.total+' ' : '') + (order.name||'')); }catch(e){}
  Promise.resolve(DB.addOrder(order)).catch(err => {
    console.error('تعذر حفظ الطلب:', err);
    showToast('تم الطبع، لكن تعذرت المزامنة السحابية');
  });

  clearTicket();
};

// ===== إرسال الفاتورة عبر واتساب (wa.me) =====
// رمز الدولة الافتراضي للأرقام المحلية (غيّره حسب دولتك: 966 السعودية، 967 اليمن ...)
var WA_DEFAULT_CC = '966';
let lastOrder = null; // آخر فاتورة أُنشئت (لزر الإرسال السريع)

// تنسيق رقم الجوال لصيغة دولية تصلح لـ wa.me (أرقام فقط بدون +)
function waNormalizePhone(raw){
  if(!raw) return '';
  // أرقام عربية → لاتينية
  let s = String(raw).replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d));
  s = s.replace(/\D/g, ''); // احذف أي شيء غير رقم
  if(!s) return '';
  if(s.indexOf('00') === 0) s = s.slice(2);            // 00<cc> → <cc>
  else if(s.charAt(0) === '0') s = WA_DEFAULT_CC + s.slice(1); // 0xxxxxxxx → cc + xxxxxxxx
  else if(s.length <= 9) s = WA_DEFAULT_CC + s;        // رقم محلي بلا صفر
  return s;
}

// بناء نص الفاتورة المرتّب لواتساب
function waInvoiceText(order){
  const payTxt = order.pay === 'card' ? 'شبكة' : (order.pay === 'deposit' ? 'عربون (دفع جزئي)' : 'نقد');
  const hasRemain = (Number(order.remaining) || 0) > 0;
  const showVat = (RESTAURANT.showVat !== false);
  const customFields = Array.isArray(RESTAURANT.customFields) ? RESTAURANT.customFields : [];
  const L = [];
  L.push('*' + (RESTAURANT.headerBrand || RESTAURANT.name || 'نظام') + '*');
  if(RESTAURANT.headerTagline) L.push('_' + RESTAURANT.headerTagline + '_');
  if(RESTAURANT.phone) L.push('☎️ ' + RESTAURANT.phone);
  L.push('—————————');
  L.push(showVat ? '🧾 فاتورة ضريبية مبسطة' : '🧾 فاتورة');
  L.push('رقم الطلب: ' + orderNoLabel(order));
  L.push('التاريخ: ' + (order.date || ''));
  L.push('النوع: ' + (order.type || '') + ' · العميل: ' + (order.name || 'عميل'));
  if(pickupLabel(order)) L.push('موعد الاستلام: ' + pickupLabel(order));
  customFields.forEach(f => { if(f && (f.label || f.value)) L.push((f.label || '') + (f.label && f.value ? ': ' : '') + (f.value || '')); });
  L.push('—————————');
  (order.items || []).forEach(it => {
    L.push('• ' + it.name + ' ×' + it.qty + '  —  ' + money((it.price||0)*(it.qty||0)));
  });
  L.push('—————————');
  if(showVat){
    L.push('المجموع الفرعي: ' + money(order.subtotal));
    L.push('ضريبة القيمة المضافة (' + Math.round((RESTAURANT.vatRate||0)*100) + '%): ' + money(order.vat));
  }
  L.push('*الإجمالي: ' + money(order.total) + '*');
  L.push('طريقة الدفع: ' + payTxt);
  if(order.pay === 'cash' || order.pay === 'deposit'){
    L.push((order.pay === 'deposit' ? 'العربون المدفوع' : 'المدفوع') + ': ' + money(order.paid));
  }
  if(hasRemain) L.push('*المتبقي على العميل: ' + money(order.remaining) + '*');
  L.push('—————————');
  L.push(RESTAURANT.footer || 'شكراً لزيارتكم ❤️');
  if(order.cashier) L.push('المستخدم: ' + order.cashier);
  if(RESTAURANT.devName) L.push('برمجة: ' + RESTAURANT.devName);
  return L.join('\n');
}

// فتح واتساب مع نص الفاتورة جاهزاً للإرسال
let _waPending = null; // {phone, text} بانتظار اختيار التطبيق

function sendInvoiceWhatsApp(order){
  if(!order){ showToast('لا توجد فاتورة للإرسال'); return; }
  let phone = waNormalizePhone(order.phone);
  if(!phone){
    const entered = prompt('أدخل رقم جوال العميل لإرسال الفاتورة عبر واتساب:', '');
    if(entered == null) return;
    phone = waNormalizePhone(entered);
    if(!phone){ showToast('رقم الجوال غير صالح'); return; }
  }
  _waPending = { phone: phone, text: waInvoiceText(order) };
  const modal = document.getElementById('waChooseModal');
  if(modal){ modal.classList.add('show'); }
  else { openWhatsAppApp('normal'); } // fallback إن لم توجد النافذة
}

// فتح تطبيق واتساب المختار (normal أو business)
function openWhatsAppApp(app){
  if(!_waPending) return;
  const phone = _waPending.phone;
  const encText = encodeURIComponent(_waPending.text);
  const waUrl = 'https://wa.me/' + phone + '?text=' + encText;
  const isAndroid = /Android/i.test(navigator.userAgent || '');
  const m = document.getElementById('waChooseModal');
  if(m) m.classList.remove('show');
  if(isAndroid){
    // استهداف حزمة التطبيق مباشرة (com.whatsapp = العادي، com.whatsapp.w4b = بزنس)
    const pkg = (app === 'business') ? 'com.whatsapp.w4b' : 'com.whatsapp';
    const intentUrl = 'intent://send?phone=' + phone + '&text=' + encText +
      '#Intent;scheme=whatsapp;package=' + pkg +
      ';S.browser_fallback_url=' + encodeURIComponent(waUrl) + ';end';
    try{ window.location.href = intentUrl; }
    catch(e){ window.location.href = waUrl; }
  } else {
    // سطح المكتب / iOS: يفتح الواتساب المتوفر
    try{ window.open(waUrl, '_blank'); }
    catch(e){ window.location.href = waUrl; }
  }
  _waPending = null;
}

// ربط أزرار نافذة اختيار الواتساب
(function(){
  const modal = document.getElementById('waChooseModal');
  if(!modal) return;
  const closeBtn = document.getElementById('closeWaChoose');
  if(closeBtn) closeBtn.onclick = () => { modal.classList.remove('show'); _waPending = null; };
  modal.onclick = (e) => { if(e.target === modal){ modal.classList.remove('show'); _waPending = null; } };
  const n = document.getElementById('waPickNormal');
  const b = document.getElementById('waPickBusiness');
  if(n) n.onclick = () => openWhatsAppApp('normal');
  if(b) b.onclick = () => openWhatsAppApp('business');
})();

// إظهار زر إرسال واتساب في الكاشير بعد إنشاء فاتورة
function showWaInvoiceBtn(order){
  lastOrder = order;
  const btn = document.getElementById('waInvoiceBtn');
  if(btn) btn.style.display = '';
}

// ===== Build & print receipt =====
// بناء رابط التتبّع العام لرمز QR (لا يحمل أي بيانات حساسة — مجرّد token)
function orderTrackUrl(token){
  if(!token) return '';
  try{ return new URL('track.html', location.href).href + '?t=' + encodeURIComponent(token); }
  catch(e){ return location.origin + '/track.html?t=' + encodeURIComponent(token); }
}
// رابط استمارة الطلب الخارجية (order.html?f=token) — تعرض النموذج للعميل أو حالة الطلب بعد المصادقة
function orderFormUrl(token){
  if(!token) return '';
  try{ return new URL('order.html', location.href).href + '?f=' + encodeURIComponent(token); }
  catch(e){ return location.origin + '/order.html?f=' + encodeURIComponent(token); }
}
// رابط السجل الموحّد لطلب — دائماً صفحة التتبّع (تعرض السجل وفق الصلاحية)
function recordUrlOf(o){
  if(!o || !o.formToken) return '';
  return orderTrackUrl(o.formToken);
}
// توليد صورة QR من نص (رابط/token) عبر مكتبة qrcode
function qrDataUrl(text, cell, margin){
  try{
    if(typeof qrcode === 'undefined' || !text) return '';
    const qr = qrcode(0, 'M');
    qr.addData(String(text));
    qr.make();
    return qr.createDataURL(cell || 4, (margin==null?8:margin));
  }catch(e){ return ''; }
}
// توليد كود QR للطلب — يُفضّل الرمز الموحّد للاستمارة (formToken) إن وُجد
// حتى يبقى نفس الرمز من الاستمارة حتى الفاتورة، وإلا يُشفّر معرّف الطلب (توافق قديم).
function makeOrderQR(order){
  try{
    if(typeof qrcode === 'undefined') return '';
    const data = order.formToken
      ? orderTrackUrl(order.formToken)
      : (order.id || ('NO-' + (order.orderNo || '')));
    const qr = qrcode(0, 'M');
    qr.addData(String(data));
    qr.make();
    return qr.createDataURL(4, 8);
  }catch(e){ return ''; }
}
function printReceipt(order){
  const payTxt = order.pay === 'card' ? cardPayLabel(order) : (order.pay === 'deposit' ? 'عربون (دفع جزئي)' : 'نقد');
  const hasRemain = (Number(order.remaining) || 0) > 0;
  const showVat = (RESTAURANT.showVat !== false);
  const customFields = Array.isArray(RESTAURANT.customFields) ? RESTAURANT.customFields : [];
  const inv = RESTAURANT.invoice || {};
  const rows = order.items.map(it =>
    '<tr><td>' + esc(it.name) + '</td>' +
    '<td class="c rf-qty">' + it.qty + '</td>' +
    '<td class="l rf-price">' + money(it.price*it.qty) + '</td></tr>'
  ).join('');
  // إعدادات الطابعة المحلية (خاصة بالجهاز) — توقيع/عبارة شكر اختيارية
  const pcfg = (window.BMSPrinter && typeof BMSPrinter.load==='function') ? BMSPrinter.load() : null;

  // ===== كتل الفاتورة (قابلة لإعادة الترتيب والإخفاء من لوحة التحكم) =====
  const blocks = {};
  const _logoSideLocal = (pcfg && pcfg.logoSide === true);
  const _logoSideShared = (RESTAURANT.print && RESTAURANT.print.logoSide === true);
  const _logoSide = (_logoSideLocal || _logoSideShared) && (inv.showLogo !== false) && RESTAURANT.logo;
  const _qrSideLocal = (pcfg && pcfg.qrSide === true);
  const _qrSideShared = (RESTAURANT.print && RESTAURANT.print.qrSide === true);
  const _qrSide = _qrSideLocal || _qrSideShared;
  if(_logoSide){
    blocks.header =
      '<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">' +
        '<img class="r-logo" src="' + esc(RESTAURANT.logo) + '" alt="" style="width:60px;height:60px;margin:0;flex:0 0 auto;border-radius:50%;object-fit:cover;border:2px solid #1e3a8a" />' +
        '<div style="flex:1;text-align:right">' +
          '<h2 class="rf-name" style="margin:0">' + esc(RESTAURANT.headerBrand || RESTAURANT.name) + '</h2>' +
          ((inv.showTagline !== false) && RESTAURANT.headerTagline ? '<div class="r-tagline rf-estab">' + esc(RESTAURANT.headerTagline) + '</div>' : '') +
          ((inv.showAddress !== false) ? '<div class="r-sub rf-estab">' + esc(RESTAURANT.address) + '</div>' : '') +
          ((inv.showPhone !== false) ? '<div class="r-sub rf-estab">هاتف: ' + esc(RESTAURANT.phone) + '</div>' : '') +
          (showVat && RESTAURANT.vatNo ? '<div class="r-sub rf-estab">الرقم الضريبي: ' + esc(RESTAURANT.vatNo) + '</div>' : '') +
        '</div>' +
      '</div>' +
      '<div class="r-line"></div>';
  } else {
    blocks.header =
      '<div class="r-center">' +
        ((inv.showLogo !== false) && RESTAURANT.logo ? '<img class="r-logo" src="' + esc(RESTAURANT.logo) + '" alt="" />' : '') +
        '<h2 class="rf-name">' + esc(RESTAURANT.headerBrand || RESTAURANT.name) + '</h2>' +
        ((inv.showTagline !== false) && RESTAURANT.headerTagline ? '<div class="r-tagline rf-estab">' + esc(RESTAURANT.headerTagline) + '</div>' : '') +
        ((inv.showAddress !== false) ? '<div class="r-sub rf-estab">' + esc(RESTAURANT.address) + '</div>' : '') +
        ((inv.showPhone !== false) ? '<div class="r-sub rf-estab">هاتف: ' + esc(RESTAURANT.phone) + '</div>' : '') +
        (showVat && RESTAURANT.vatNo ? '<div class="r-sub rf-estab">الرقم الضريبي: ' + esc(RESTAURANT.vatNo) + '</div>' : '') +
      '</div>' +
      '<div class="r-line"></div>';
  }
  blocks.meta =
    '<div class="r-meta">' +
      '<div>' + (showVat ? 'فاتورة ضريبية مبسطة' : 'فاتورة') + '</div>' +
      '<div class="rf-invno">رقم الطلب: ' + esc(orderNoLabel(order)) + '</div>' +
      '<div class="rf-date">التاريخ: ' + esc(order.date) + '</div>' +
      '<div>النوع: ' + esc(order.type) + '</div>' +
      '<div class="rf-customer">العميل: ' + esc(order.name) + '</div>' +
      (order.phone ? '<div class="rf-phone">الجوال: ' + esc(order.phone) + '</div>' : '') +
      ((inv.showPickup !== false) && pickupLabel(order) ? '<div>موعد الاستلام: ' + esc(pickupLabel(order)) + '</div>' : '') +
      customFields.map(f => (f && (f.label || f.value)) ? '<div>' + esc(f.label || '') + (f.label && f.value ? ': ' : '') + esc(f.value || '') + '</div>' : '').join('') +
      ((inv.showTheme !== false) && order.theme ? '<div>🎁 الطلب: مع ثيم</div>' : '') +
      ((inv.showTheme !== false) && order.theme && order.themeData ?
        '<div>🎁 المناسبة: ' + esc(order.themeData.occasion || '—') + '</div>' +
        (order.themeData.customText ? '<div>🎁 النص: ' + esc(order.themeData.customText) + '</div>' : '')
        : '') +
    '</div>' +
    '<div class="r-line"></div>';
  blocks.items =
    '<table class="rf-items"><thead><tr><th>الصنف</th><th class="c rf-qty">كمية</th><th class="l rf-price">المبلغ</th></tr></thead>' +
    '<tbody>' + rows + '</tbody></table>' +
    '<div class="r-line"></div>';
  blocks.totals =
    (showVat ? '<div class="r-tot"><span>المجموع الفرعي</span><span>' + money(order.subtotal) + '</span></div>' : '') +
    (showVat ? '<div class="r-tot"><span>ضريبة القيمة المضافة (' + Math.round(RESTAURANT.vatRate*100) + '%)</span><span>' + money(order.vat) + '</span></div>' : '') +
    ((Number(order.discount)||0) > 0 ? '<div class="r-tot rf-discount"><span>الخصم</span><span>' + money(order.discount) + '</span></div>' : '') +
    '<div class="r-tot big rf-total"><span>الإجمالي</span><span>' + money(order.total) + '</span></div>' +
    '<div class="r-line"></div>';
  blocks.payment =
    '<div class="r-tot"><span>طريقة الدفع</span><span>' + payTxt + '</span></div>' +
    ((order.pay === 'cash' || order.pay === 'deposit')
      ? '<div class="r-tot rf-paid"><span>' + (order.pay === 'deposit' ? 'العربون المدفوع' : 'المدفوع') + '</span><span>' + money(order.paid) + '</span></div>' +
        (order.change > 0 ? '<div class="r-tot"><span>الباقي</span><span>' + money(order.change) + '</span></div>' : '')
      : '') +
    (hasRemain
      ? '<div class="r-tot big remain rf-remaining"><span>المتبقي على العميل</span><span>' + money(order.remaining) + '</span></div>'
      : '');
  blocks.footer =
    ((inv.showFooter !== false) ? '<div class="r-foot">' + esc(RESTAURANT.footer || '') + '<br/>' + (hasRemain ? 'يرجى الاحتفاظ بالفاتورة لسداد المتبقي' : 'نتمنى لكم وجبة شهية') + '</div>' : '') +
    ((pcfg && pcfg.show && pcfg.show.signature===true && pcfg.signatureText) ? '<div class="r-user rf-signature">' + esc(pcfg.signatureText) + '</div>' : '');
  // نصوص تُعرض بجوار رمز QR (المستخدم / لزيارتكم / شكراً / برمجة) — بدل أن تأخذ أسطراً منفصلة
  const _qrCaptionParts = [];
  if((inv.showCashier !== false) && order.cashier) _qrCaptionParts.push('المستخدم: ' + esc(order.cashier));
  if(pcfg && pcfg.show && pcfg.show.thankYou !== false && pcfg.thankYouText) _qrCaptionParts.push(esc(pcfg.thankYouText));
  else if(RESTAURANT.footer) _qrCaptionParts.push(esc(RESTAURANT.footer));
  if(RESTAURANT.devName) _qrCaptionParts.push('برمجة: ' + esc(RESTAURANT.devName));
  const _qrCaption = _qrCaptionParts.join(' · ');
  blocks.qr =
    ((RESTAURANT.qrEnabled !== false) ? (function(){
      const u = makeOrderQR(order);
      return u
        ? (_qrSide ? '<div style="display:flex;align-items:center;gap:8px;margin:0;padding:0;justify-content:flex-end;">' +
               '<div style="flex:1;text-align:right;font-size:11px;color:#444;">امسح الكود لاستدعاء الطلب (' + _qrCaption + '</div>' +
               '<img src="' + u + '" alt="QR" style="width:90px;height:90px;image-rendering:pixelated;flex:0 0 auto;" />' +
             '</div>' :
             '<div class="r-qr" style="text-align:center;margin:0;padding:0;">' +
            '<img src="' + u + '" alt="QR" style="width:120px;height:120px;image-rendering:pixelated;" />' +
             '<div class="r-qr-cap" style="font-size:11px;color:#444;margin-top:2px;">' + _qrCaption + '</div>' +
          '</div>'
        ) : '';
    })() : '');

  const defOrder = ['header','meta','items','totals','payment','footer','qr'];
  let ord = Array.isArray(inv.order) && inv.order.length ? inv.order.slice() : defOrder.slice();
  defOrder.forEach(k => { if(ord.indexOf(k) === -1) ord.push(k); });  // ضمان عدم فقدان أي كتلة
  const html = ord.map(k => blocks[k] || '').join('');

  const rcpt = document.getElementById('receipt');
  rcpt.innerHTML = html;
  applyPrintStyle();
  // تطبيق أحجام خطوط الفاتورة المستقلة
  applyInvoiceFonts();
  // تطبيق إعدادات الطابعة المحلية (عرض الورق/الهوامش/@page/إخفاء الحقول) — يعالج الورق الفارغ والنصف الأيمن
  try{ if(window.BMSPrinter && typeof BMSPrinter.applyPrintCss==='function') BMSPrinter.applyPrintCss(pcfg); }catch(e){}
  // أعط المتصفح لحظة لرسم المحتوى ثم اطبع
  setTimeout(() => nativePrint(), 60);
}

// تطبيق أحجام خطوط الفاتورة المستقلة على #receipt (تؤثر في المعاينة والطباعة والـ PDF)
function applyInvoiceFonts(){
  const inv = RESTAURANT.invoice || {};
  let st = document.getElementById('invoiceFontStyle');
  if(!st){ st = document.createElement('style'); st.id = 'invoiceFontStyle'; document.head.appendChild(st); }
  const px = (v, d) => (Number(v) || d) + 'px';
  st.textContent =
    '#receipt h2{font-size:' + px(inv.fontHeading,18) + ';}' +
    '#receipt .r-sub,#receipt .r-tagline,#receipt .r-meta{font-size:' + px(inv.fontBody,12) + ';}' +
    '#receipt table,#receipt th,#receipt td{font-size:' + px(inv.fontTable,12) + ';}' +
    '#receipt .r-tot{font-size:' + px(inv.fontTotal,14) + ';}' +
    '#receipt .r-foot,#receipt .r-user,#receipt .r-dev{font-size:' + px(inv.fontFooter,11) + ';}';
}

// ===== Daily sales report =====
function isToday(ts){
  const d = new Date(ts);
  const n = new Date();
  return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate();
}

document.getElementById('dailyReportBtn').onclick = async function(){
  showToast('جاري تجهيز تقرير اليوم...');
  let orders = [];
  try{
    orders = await DB.getOrders();
  }catch(e){
    console.error('تعذر جلب الطلبات:', e);
    showToast('تعذر جلب بيانات المبيعات');
    return;
  }
  const today = (orders || []).filter(o => isToday(o.createdAt || 0));
  if(today.length === 0){ showToast('لا توجد مبيعات مسجّلة اليوم'); return; }
  printDailyReport(today);
};

function printDailyReport(orders){
  let count = orders.length;
  let subtotal = 0, vat = 0, total = 0;
  let cashCount = 0, cashTotal = 0, cardCount = 0, cardTotal = 0;
  const byType = {};           // النوع -> {count, total}
  const byItem = {};           // اسم الصنف -> {qty, total}

  orders.forEach(o => {
    subtotal += Number(o.subtotal) || 0;
    vat      += Number(o.vat) || 0;
    total    += Number(o.total) || 0;
    if(o.pay === 'card'){ cardCount++; cardTotal += Number(o.total)||0; }
    else { cashCount++; cashTotal += Number(o.total)||0; }
    const tp = o.type || 'غير محدد';
    byType[tp] = byType[tp] || {count:0, total:0};
    byType[tp].count++; byType[tp].total += Number(o.total)||0;
    (o.items || []).forEach(it => {
      const key = it.name;
      byItem[key] = byItem[key] || {qty:0, total:0};
      byItem[key].qty += Number(it.qty)||0;
      byItem[key].total += (Number(it.price)||0) * (Number(it.qty)||0);
    });
  });

  const typeRows = Object.keys(byType).map(k =>
    '<div class="r-tot"><span>' + esc(k) + ' (' + byType[k].count + ')</span><span>' + money(byType[k].total) + '</span></div>'
  ).join('');

  const topItems = Object.keys(byItem)
    .map(k => ({name:k, qty:byItem[k].qty, total:byItem[k].total}))
    .sort((a,b) => b.qty - a.qty)
    .slice(0, 10);
  const itemRows = topItems.map(it =>
    '<tr><td>' + esc(it.name) + '</td>' +
    '<td class="c">' + it.qty + '</td>' +
    '<td class="l">' + money(it.total) + '</td></tr>'
  ).join('');

  const now = new Date();
  const dateStr = now.toLocaleDateString('ar', {weekday:'long', day:'2-digit', month:'2-digit', year:'numeric'});
  const timeStr = now.toLocaleTimeString('ar', {hour:'2-digit', minute:'2-digit'});
  const avg = count ? total / count : 0;

  const html =
    '<div class="r-center">' +
      '<h2>' + esc(RESTAURANT.name) + '</h2>' +
      '<div class="r-sub">تقرير المبيعات اليومي</div>' +
    '</div>' +
    '<div class="r-line"></div>' +
    '<div class="r-meta">' +
      '<div>التاريخ: ' + esc(dateStr) + '</div>' +
      '<div>وقت الطباعة: ' + esc(timeStr) + '</div>' +
    '</div>' +
    '<div class="r-line"></div>' +
    '<div class="r-tot big"><span>عدد الفواتير</span><span>' + count + '</span></div>' +
    '<div class="r-tot"><span>المجموع الفرعي</span><span>' + money(subtotal) + '</span></div>' +
    '<div class="r-tot"><span>ضريبة القيمة المضافة</span><span>' + money(vat) + '</span></div>' +
    '<div class="r-tot big"><span>إجمالي المبيعات</span><span>' + money(total) + '</span></div>' +
    '<div class="r-tot"><span>متوسط الفاتورة</span><span>' + money(avg) + '</span></div>' +
    '<div class="r-line"></div>' +
    '<div class="r-meta"><b>حسب طريقة الدفع</b></div>' +
    '<div class="r-tot"><span>نقد (' + cashCount + ')</span><span>' + money(cashTotal) + '</span></div>' +
    '<div class="r-tot"><span>إيداع/حوالة (' + cardCount + ')</span><span>' + money(cardTotal) + '</span></div>' +
    '<div class="r-line"></div>' +
    '<div class="r-meta"><b>حسب نوع الطلب</b></div>' +
    typeRows +
    '<div class="r-line"></div>' +
    '<div class="r-meta"><b>الأصناف الأكثر مبيعاً</b></div>' +
    '<table><thead><tr><th>الصنف</th><th class="c">كمية</th><th class="l">المبلغ</th></tr></thead>' +
    '<tbody>' + itemRows + '</tbody></table>' +
    '<div class="r-foot">— نهاية التقرير —</div>';

  const rcpt = document.getElementById('receipt');
  rcpt.innerHTML = html;
  applyPrintStyle();
  setTimeout(() => nativePrint(), 60);
}

// ===== Customers modal (POS) =====
let custOrdersCache = [];
let custActiveFilter = 'all';
const custModal = document.getElementById('custModal');
const orderDetailsModal = document.getElementById('orderDetailsModal');

function remainingOf(o){ return Math.max(0, Number(o.remaining) || 0); }
function cardPayLabel(o){
  // إيداع/حوالة + اسم الصراف (مع توافق الطلبات القديمة التي كانت "شبكة")
  const t = (o && o.depositType) ? o.depositType : 'شبكة';
  const ex = (o && o.exchangeName) ? ' · ' + o.exchangeName : '';
  return t + ex;
}
function payLabelOf(o){
  if(o.pay === 'card') return cardPayLabel(o);
  if(o.pay === 'deposit') return 'عربون';
  return 'نقد';
}

document.getElementById('customersBtn').onclick = async function(){
  showToast('جاري تحميل العملاء...');
  try{
    custOrdersCache = (await DB.getOrders()) || [];
  }catch(e){
    console.error('تعذر جلب العملاء:', e);
    showToast('تعذر جلب البيانات'); return;
  }
  renderCustList();
  custModal.classList.add('show');
};
document.getElementById('closeCustModal').onclick = () => custModal.classList.remove('show');
custModal.onclick = (e) => { if(e.target === custModal) custModal.classList.remove('show'); };
document.getElementById('closeDetailsModal').onclick = () => orderDetailsModal.classList.remove('show');
orderDetailsModal.onclick = (e) => { if(e.target === orderDetailsModal) orderDetailsModal.classList.remove('show'); };

/* ===== ماسح كود QR لاستدعاء الطلب ===== */
let qrStream = null;
let qrRafId = null;
function stopQrScanner(){
  if(qrRafId){ cancelAnimationFrame(qrRafId); qrRafId = null; }
  if(qrStream){
    try{ qrStream.getTracks().forEach(t => t.stop()); }catch(e){}
    qrStream = null;
  }
  const v = document.getElementById('qrVideo');
  if(v){ try{ v.pause(); }catch(e){} v.srcObject = null; }
}
function closeQrScanner(){
  stopQrScanner();
  const m = document.getElementById('qrScanModal');
  if(m) m.classList.remove('show');
}
async function handleScannedCode(code){
  let raw = String(code || '').trim();
  if(!raw) return;
  // استخراج الرمز الموحّد إن كان الممسوح رابطاً (track.html?t=.. أو order.html?f=..)
  let token = '';
  try{
    const m = raw.match(/[?&](?:t|f)=([^&\s]+)/);
    if(m) token = decodeURIComponent(m[1]);
  }catch(e){ token = ''; }
  const id = raw;
  const statusEl = document.getElementById('qrScanStatus');
  if(statusEl) statusEl.textContent = 'تم المسح ✔ جارٍ جلب السجل...';
  let orders = [];
  try{ orders = (await DB.getOrders()) || []; }
  catch(e){ showToast('تعذر جلب الطلبات'); closeQrScanner(); return; }
  // 1) مطابقة بالرمز الموحّد (formToken) — يربط الاستمارة→الطلب→الفاتورة
  let o = (token ? orders.find(x => String(x.formToken||'') === token) : null) ||
          orders.find(x => String(x.id) === id) ||
          orders.find(x => String(x.orderNo) === id) ||
          (token ? orders.find(x => String(x.id) === token) : null);
  if(o){ closeQrScanner(); showOrderDetails(o); return; }
  // 2) لا يوجد طلب بعد — جرّب استمارة بانتظار المصادقة بنفس الرمز
  if(token && DB.getCustFormByToken){
    try{
      const f = await DB.getCustFormByToken(token);
      closeQrScanner();
      if(f){
        if(f.status === 'approved' && f.orderNo){ showToast('✅ استمارة «' + (f.name||'عميل') + '» تحوّلت للطلب #' + f.orderNo); }
        else if(f.status === 'expired'){ showToast('⌛ استمارة «' + (f.name||'عميل') + '» منتهية الصلاحية'); }
        else { showToast('⏳ استمارة «' + (f.name||'عميل') + '» بانتظار المصادقة'); }
        return;
      }
    }catch(e){ closeQrScanner(); }
    showToast('لا يوجد سجل بهذا الرمز'); return;
  }
  closeQrScanner();
  showToast('لا يوجد طلب بهذا الكود');
}
async function openQrScanner(){
  const modal = document.getElementById('qrScanModal');
  const video = document.getElementById('qrVideo');
  const canvas = document.getElementById('qrCanvas');
  const statusEl = document.getElementById('qrScanStatus');
  if(!modal || !video || !canvas) return;
  if(typeof jsQR === 'undefined'){ showToast('مكتبة المسح غير متوفرة'); return; }
  if(!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia){
    showToast('الكاميرا غير مدعومة على هذا الجهاز/المتصفح'); return;
  }
  if(statusEl) statusEl.textContent = '';
  modal.classList.add('show');
  try{
    qrStream = await navigator.mediaDevices.getUserMedia({ video:{ facingMode:'environment' }, audio:false });
  }catch(e){
    try{
      qrStream = await navigator.mediaDevices.getUserMedia({ video:true, audio:false });
    }catch(e2){
      showToast('تعذر فتح الكاميرا — تأكد من الأذونات');
      closeQrScanner(); return;
    }
  }
  video.srcObject = qrStream;
  try{ await video.play(); }catch(e){}
  const ctx = canvas.getContext('2d', { willReadFrequently:true });
  const tick = () => {
    if(!qrStream){ return; }
    if(video.readyState === video.HAVE_ENOUGH_DATA){
      const w = video.videoWidth, h = video.videoHeight;
      if(w && h){
        canvas.width = w; canvas.height = h;
        ctx.drawImage(video, 0, 0, w, h);
        let img;
        try{ img = ctx.getImageData(0, 0, w, h); }catch(e){ img = null; }
        if(img){
          const result = jsQR(img.data, w, h, { inversionAttempts:'dontInvert' });
          if(result && result.data){
            handleScannedCode(result.data);
            return;
          }
        }
      }
    }
    qrRafId = requestAnimationFrame(tick);
  };
  qrRafId = requestAnimationFrame(tick);
}
(function bindQrScanner(){
  const btn = document.getElementById('qrScanBtn');
  if(btn) btn.onclick = openQrScanner;
  const closeBtn = document.getElementById('closeQrScanModal');
  if(closeBtn) closeBtn.onclick = closeQrScanner;
  const cancelBtn = document.getElementById('qrScanCancel');
  if(cancelBtn) cancelBtn.onclick = closeQrScanner;
  const modal = document.getElementById('qrScanModal');
  if(modal) modal.onclick = (e) => { if(e.target === modal) closeQrScanner(); };
})();

// ===== نافذة سجل الحركة =====
(function bindActivityLog(){
  var _logCache = [];
  var _unsub = null;
  function netLabel(e){
    if(e.online === false || e.net === 'none') return '<span class="log-net-off">⛔ غير متصل</span>';
    if(e.net === 'wifi') return '<span class="log-net-wifi">📶 WiFi</span>';
    if(e.net === 'cellular') return '<span class="log-net-cell">📱 بيانات الجوال</span>';
    return '<span>🌐 متصل</span>';
  }
  function evMeta(e){
    switch(e.event){
      case 'login':  return { ic:'🟢', cls:'ev-login' };
      case 'logout': return { ic:'🔴', cls:'ev-logout' };
      case 'order':  return { ic:'🛒', cls:'ev-order' };
      case 'print':  return { ic:'🖨️', cls:'ev-print' };
      default:       return { ic:'•', cls:'' };
    }
  }
  function fmtTime(ts){
    try{ return new Date(ts).toLocaleString('ar-u-nu-latn',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'}); }catch(e){ return ''; }
  }
  function render(){
    var listEl = document.getElementById('logList'); if(!listEl) return;
    var q = (document.getElementById('logSearch')||{}).value || '';
    q = q.trim().toLowerCase();
    var uf = (document.getElementById('logUserFilter')||{}).value || '';
    // تعبئة قائمة المستخدمين
    var sel = document.getElementById('logUserFilter');
    if(sel){
      var users = {};
      _logCache.forEach(function(e){ var u = e.user || e.username || 'زائر'; users[u] = true; });
      var cur = sel.value;
      sel.innerHTML = '<option value="">كل المستخدمين</option>' + Object.keys(users).map(function(u){ return '<option value="'+esc(u)+'">'+esc(u)+'</option>'; }).join('');
      sel.value = cur;
    }
    var rows = _logCache.slice().reverse().filter(function(e){
      if(uf && (e.user||e.username||'زائر') !== uf) return false;
      if(q){
        var hay = ((e.user||'')+' '+(e.username||'')+' '+(e.action||'')+' '+(e.role||'')).toLowerCase();
        if(hay.indexOf(q) === -1) return false;
      }
      return true;
    });
    if(rows.length === 0){ listEl.innerHTML = '<div class="log-empty">لا توجد حركات مطابقة</div>'; return; }
    listEl.innerHTML = rows.map(function(e){
      var m = evMeta(e);
      return '<div class="log-item '+m.cls+'">'+
        '<div class="log-ic">'+m.ic+'</div>'+
        '<div class="log-main">'+
          '<div class="log-user">'+esc(e.user||e.username||'زائر')+(e.role?' · <span style="font-weight:400;color:#64748b">'+esc(e.role)+'</span>':'')+'</div>'+
          '<div class="log-act">'+esc(e.action||'')+'</div>'+
          '<div class="log-meta"><span>🕒 '+fmtTime(e.ts)+'</span>'+netLabel(e)+'</div>'+
        '</div>'+
      '</div>';
    }).join('');
  }
  function open(){
    var modal = document.getElementById('activityLogModal'); if(!modal) return;
    modal.classList.add('show');
    if(window.DB && typeof DB.onActivityLog==='function'){
      try{ if(_unsub) _unsub(); }catch(e){}
      _unsub = DB.onActivityLog(function(list){ _logCache = Array.isArray(list)?list:[]; render(); });
    } else if(window.DB && typeof DB.getActivityLog==='function'){
      DB.getActivityLog().then(function(list){ _logCache = list||[]; render(); });
    }
  }
  function close(){
    var modal = document.getElementById('activityLogModal'); if(modal) modal.classList.remove('show');
    try{ if(_unsub){ _unsub(); _unsub = null; } }catch(e){}
  }
  var btn = document.getElementById('activityLogBtn');
  if(btn) btn.onclick = open;
  var cl = document.getElementById('closeActivityLog');
  if(cl) cl.onclick = close;
  var modalEl = document.getElementById('activityLogModal');
  if(modalEl) modalEl.onclick = function(e){ if(e.target === modalEl) close(); };
  var s = document.getElementById('logSearch');
  if(s) s.oninput = render;
  var f = document.getElementById('logUserFilter');
  if(f) f.onchange = render;
  var cb = document.getElementById('logClearBtn');
  if(cb) cb.onclick = function(){
    if(!confirm('مسح كل سجل الحركة نهائياً؟')) return;
    if(window.DB && typeof DB.clearActivityLog==='function'){
      DB.clearActivityLog().then(function(){ _logCache = []; render(); showToast('تم مسح السجل'); });
    }
  };
})();

// ===== طوارئ النظام (شاشة الصيانة) =====
// تُطبّق لدى جميع المستخدمين عبر الإعدادات السحابية
function applyMaintenance(m){
  m = m || {};
  var ov = document.getElementById('maintOverlay'); if(!ov) return;
  var isMgr = (typeof isManagerUser==='function' && isManagerUser());
  // المدير مُستثنى من شاشة «النظام تحت الصيانة» لأنه هو من يقوم بالصيانة،
  // فيبقى قادراً على استخدام النظام وإنهاء وضع الصيانة متى شاء.
  if(m.active && !isMgr){
    var t = document.getElementById('maintTitle'); if(t) t.textContent = m.title || 'النظام تحت الصيانة';
    var n = document.getElementById('maintNote'); if(n) n.textContent = m.note || 'نعتذر عن الإزعاج، نقوم حالياً بأعمال صيانة لتحسين الخدمة. سنعود قريباً.';
    ov.classList.add('show');
  } else {
    ov.classList.remove('show');
  }
}
(function bindMaintenance(){
  function saveMaint(active){
    var cur = (typeof RESTAURANT!=='undefined' && RESTAURANT.maintenance) || {};
    var m = {
      active: !!active,
      title: (document.getElementById('maintTitleInput')||{}).value || cur.title || '',
      note: (document.getElementById('maintNoteInput')||{}).value || cur.note || '',
      ts: Date.now()
    };
    var merged = Object.assign({}, RESTAURANT, { maintenance: m });
    var st = document.getElementById('maintStatus'); if(st) st.textContent = 'جارٍ الحفظ...';
    Promise.resolve(DB.saveSettings(merged)).then(function(){
      if(st) st.textContent = active ? '✅ تم تفعيل الصيانة لجميع المستخدمين' : '✅ تم إيقاف الصيانة';
      showToast(active ? '🚨 تم تفعيل طوارئ النظام' : '✅ تم إيقاف الصيانة');
      try{ if(typeof logActivity==='function') logActivity('action', active ? 'تفعيل طوارئ النظام' : 'إيقاف طوارئ النظام'); }catch(e){}
      if(!active){ var cm = document.getElementById('maintCtrlModal'); if(cm) cm.classList.remove('show'); }
    }).catch(function(){ if(st) st.textContent = '⛔ تعذر الحفظ'; });
  }
  var btn = document.getElementById('dashMaintBtn');
  if(btn) btn.onclick = function(){
    var cur = (typeof RESTAURANT!=='undefined' && RESTAURANT.maintenance) || {};
    var ti = document.getElementById('maintTitleInput'); if(ti) ti.value = cur.title || '';
    var no = document.getElementById('maintNoteInput'); if(no) no.value = cur.note || '';
    var st = document.getElementById('maintStatus'); if(st) st.textContent = cur.active ? '🚨 الصيانة مفعّلة حالياً' : '';
    var cm = document.getElementById('maintCtrlModal'); if(cm) cm.classList.add('show');
  };
  var cl = document.getElementById('closeMaintCtrl');
  if(cl) cl.onclick = function(){ var cm = document.getElementById('maintCtrlModal'); if(cm) cm.classList.remove('show'); };
  var cm2 = document.getElementById('maintCtrlModal');
  if(cm2) cm2.onclick = function(e){ if(e.target === cm2) cm2.classList.remove('show'); };
  var act = document.getElementById('maintActivateBtn'); if(act) act.onclick = function(){ saveMaint(true); };
  var deact = document.getElementById('maintDeactivateBtn'); if(deact) deact.onclick = function(){ saveMaint(false); };
  var ex = document.getElementById('maintExitBtn'); if(ex) ex.onclick = function(){ if(confirm('إنهاء وضع الصيانة لجميع المستخدمين؟')) saveMaint(false); };
})();

// ===== الميزات الجديدة (تُعرض مرة واحدة لكل مستخدم عند كل تحديث) =====
var _whatsNewShownVer = null;
function maybeShowWhatsNew(wn){
  wn = wn || {};
  if(!wn.ver || !Array.isArray(wn.items) || wn.items.length === 0) return;
  // لا تعرض قبل تسجيل الدخول
  if(!(typeof currentPosUser!=='undefined' && currentPosUser)) return;
  if(_whatsNewShownVer === wn.ver) return;
  var key = 'bms_whatsnew_seen_' + ((currentPosUser && currentPosUser.username) || '');
  var seen = 0;
  try{ seen = parseInt(localStorage.getItem(key)||'0', 10) || 0; }catch(e){}
  if(seen === wn.ver) return;        // شوهدت هذه النسخة مسبقاً
  // عرض النافذة
  var titleEl = document.getElementById('whatsNewShowTitle'); if(titleEl) titleEl.textContent = wn.title || 'ما الجديد؟';
  var listEl = document.getElementById('whatsNewShowList');
  if(listEl) listEl.innerHTML = wn.items.map(function(it){ return '<li>'+esc(String(it))+'</li>'; }).join('');
  var modal = document.getElementById('whatsNewShowModal'); if(modal) modal.classList.add('show');
  _whatsNewShownVer = wn.ver;
  try{ localStorage.setItem(key, String(wn.ver)); }catch(e){}
}
(function bindWhatsNew(){
  var btn = document.getElementById('dashWhatsNewBtn');
  if(btn) btn.onclick = function(){
    var wn = (typeof RESTAURANT!=='undefined' && RESTAURANT.whatsNew) || {};
    var ti = document.getElementById('whatsNewTitleInput'); if(ti) ti.value = wn.title || '';
    var tx = document.getElementById('whatsNewItemsInput'); if(tx) tx.value = (Array.isArray(wn.items)?wn.items:[]).join('\n');
    var st = document.getElementById('whatsNewEditStatus'); if(st) st.textContent = '';
    var m = document.getElementById('whatsNewEditModal'); if(m) m.classList.add('show');
  };
  var cl = document.getElementById('closeWhatsNewEdit');
  if(cl) cl.onclick = function(){ var m = document.getElementById('whatsNewEditModal'); if(m) m.classList.remove('show'); };
  var me = document.getElementById('whatsNewEditModal');
  if(me) me.onclick = function(e){ if(e.target === me) me.classList.remove('show'); };
  var sv = document.getElementById('whatsNewSaveBtn');
  if(sv) sv.onclick = function(){
    var title = (document.getElementById('whatsNewTitleInput')||{}).value || '';
    var raw = (document.getElementById('whatsNewItemsInput')||{}).value || '';
    var items = raw.split('\n').map(function(x){ return x.trim(); }).filter(function(x){ return x.length; });
    var st = document.getElementById('whatsNewEditStatus');
    if(items.length === 0){ if(st) st.textContent = '⛔ أضف ميزة واحدة على الأقل'; return; }
    var wn = { ver: Date.now(), title: title.trim(), items: items };
    var merged = Object.assign({}, RESTAURANT, { whatsNew: wn });
    if(st) st.textContent = 'جارٍ الحفظ...';
    Promise.resolve(DB.saveSettings(merged)).then(function(){
      if(st) st.textContent = '✅ تم الحفظ — ستُعرض لكل مستخدم مرة واحدة';
      showToast('📣 تم نشر الميزات الجديدة');
      // لا تعرضها للمدير نفسه الذي حررها (اعتبرها مشاهدة)
      try{ var k='bms_whatsnew_seen_'+((currentPosUser&&currentPosUser.username)||''); localStorage.setItem(k, String(wn.ver)); _whatsNewShownVer = wn.ver; }catch(e){}
      setTimeout(function(){ var m = document.getElementById('whatsNewEditModal'); if(m) m.classList.remove('show'); }, 700);
    }).catch(function(){ if(st) st.textContent = '⛔ تعذر الحفظ'; });
  };
  var got = document.getElementById('whatsNewGotIt');
  if(got) got.onclick = function(){ var m = document.getElementById('whatsNewShowModal'); if(m) m.classList.remove('show'); };
})();

// ===== التحديثات (نشر تحديث فوري لكل الأجهزة) =====
// المدير يرفع الملفات على الموقع ثم يضغط «نشر التحديث» ليزيد رقم النسخة؛
// كل جهاز يرى إشعار التحديث وعند الضغط يُمسح الكاش وتُحمَّل أحدث نسخة.
var _updatePromptShownVer = null;
function _getUpdateSeenVer(){
  try{ return parseInt(localStorage.getItem('bms_update_seen')||'0', 10) || 0; }catch(e){ return 0; }
}
function _setUpdateSeenVer(v){
  try{ localStorage.setItem('bms_update_seen', String(v)); }catch(e){}
}
// تنفيذ التحديث الفعلي: مسح الكاش + إعادة تحميل (جسر أصلي داخل WebView وإلا المتصفح)
function performAppReload(){
  // 1) داخل تطبيق الأندرويد: اطلب من الجسر الأصلي مسح الكاش ثم إعادة التحميل
  try{ if(window.AndroidApp && typeof window.AndroidApp.clearAndReload === 'function'){ window.AndroidApp.clearAndReload(); return; } }catch(e){}
  // 2) في المتصفح: ألغ تسجيل Service Worker وامسح ذاكرة الكاش ثم أعد التحميل
  var done = false;
  function reloadNow(){ if(done) return; done = true; try{ location.reload(); }catch(e){ location.href = location.href; } }
  try{
    var tasks = [];
    if('caches' in window){ tasks.push(caches.keys().then(function(ks){ return Promise.all(ks.map(function(k){ return caches.delete(k); })); }).catch(function(){})); }
    if('serviceWorker' in navigator){ tasks.push(navigator.serviceWorker.getRegistrations().then(function(rs){ return Promise.all(rs.map(function(r){ return r.unregister(); })); }).catch(function(){})); }
    Promise.all(tasks).then(reloadNow).catch(reloadNow);
    setTimeout(reloadNow, 1500); // ضمان إعادة التحميل مهما حدث
  }catch(e){ reloadNow(); }
}
// إظهار إشعار التحديث لدى المستخدم إن توفرت نسخة أحدث
function maybeShowUpdate(au){
  au = au || {};
  var ver = parseInt(au.ver, 10) || 0;
  if(ver <= 0) return;
  if(!(typeof currentPosUser!=='undefined' && currentPosUser)) return; // لا تعرض قبل الدخول
  if(_updatePromptShownVer === ver) return;
  if(_getUpdateSeenVer() >= ver) return; // هذا الجهاز محدَّث أصلاً
  var noteEl = document.getElementById('updatePromptNote');
  if(noteEl && au.note){ noteEl.textContent = au.note; }
  var modal = document.getElementById('updatePromptModal'); if(modal) modal.classList.add('show');
  _updatePromptShownVer = ver;
}
(function bindUpdates(){
  // زر التحكم (للمدير)
  var btn = document.getElementById('dashUpdateBtn');
  if(btn) btn.onclick = function(){
    var cur = (typeof RESTAURANT!=='undefined' && RESTAURANT.appUpdate) || {};
    var cv = document.getElementById('updateCurVer'); if(cv) cv.textContent = String(parseInt(cur.ver,10)||0);
    var ni = document.getElementById('updateNoteInput'); if(ni) ni.value = cur.note || '';
    var st = document.getElementById('updateCtrlStatus'); if(st) st.textContent = '';
    var m = document.getElementById('updateCtrlModal'); if(m) m.classList.add('show');
  };
  var cl = document.getElementById('closeUpdateCtrl');
  if(cl) cl.onclick = function(){ var m = document.getElementById('updateCtrlModal'); if(m) m.classList.remove('show'); };
  var mc = document.getElementById('updateCtrlModal');
  if(mc) mc.onclick = function(e){ if(e.target === mc) mc.classList.remove('show'); };
  // نشر تحديث جديد لكل المستخدمين
  var pub = document.getElementById('updatePublishBtn');
  if(pub) pub.onclick = function(){
    var cur = (typeof RESTAURANT!=='undefined' && RESTAURANT.appUpdate) || {};
    var newVer = (parseInt(cur.ver,10)||0) + 1;
    var note = (document.getElementById('updateNoteInput')||{}).value || '';
    var au = { ver: newVer, note: String(note).trim(), ts: Date.now() };
    var merged = Object.assign({}, RESTAURANT, { appUpdate: au });
    var st = document.getElementById('updateCtrlStatus'); if(st) st.textContent = 'جارٍ النشر...';
    Promise.resolve(DB.saveSettings(merged)).then(function(){
      // اعتبر جهاز المدير الناشر محدَّثاً حتى لا يظهر له الإشعار
      _setUpdateSeenVer(newVer); _updatePromptShownVer = newVer;
      var cv = document.getElementById('updateCurVer'); if(cv) cv.textContent = String(newVer);
      if(st) st.textContent = '✅ تم نشر التحديث (نسخة ' + newVer + ') لكل الأجهزة';
      showToast('📢 تم نشر التحديث للمستخدمين');
      try{ if(typeof logActivity==='function') logActivity('action', 'نشر تحديث للنظام (نسخة ' + newVer + ')'); }catch(e){}
    }).catch(function(){ if(st) st.textContent = '⛔ تعذر النشر'; });
  };
  // تحديث جهاز المدير نفسه فوراً
  var self = document.getElementById('updateSelfReloadBtn');
  if(self) self.onclick = function(){ performAppReload(); };
  // إشعار المستخدم: تحديث الآن / لاحقاً
  var now = document.getElementById('updateNowBtn');
  if(now) now.onclick = function(){
    var cur = (typeof RESTAURANT!=='undefined' && RESTAURANT.appUpdate) || {};
    _setUpdateSeenVer(parseInt(cur.ver,10)||0); // سنحمّل النسخة الجديدة الآن
    performAppReload();
  };
  var later = document.getElementById('updateLaterBtn');
  if(later) later.onclick = function(){
    // «لاحقاً»: اعتبر هذه النسخة مرئية حتى لا تتكرر الرسالة عند كل فتح؛
    // ستظهر مرة أخرى فقط عند نشر تحديث أحدث (رقم نسخة أعلى).
    var cur = (typeof RESTAURANT!=='undefined' && RESTAURANT.appUpdate) || {};
    try{ _setUpdateSeenVer(parseInt(cur.ver,10)||0); }catch(e){}
    var m = document.getElementById('updatePromptModal'); if(m) m.classList.remove('show');
  };
  // زر التحديث لكل المستخدمين (بجانب زر التبديل)
  var posUp = document.getElementById('posUpdateBtn');
  if(posUp) posUp.onclick = function(){
    var cur = (typeof RESTAURANT!=='undefined' && RESTAURANT.appUpdate) || {};
    try{ _setUpdateSeenVer(parseInt(cur.ver,10)||0); }catch(e){}
    try{ showToast && showToast('🔄 جارٍ جلب أحدث نسخة...'); }catch(e){}
    performAppReload();
  };
})();

document.querySelectorAll('#custModal .cmf-btn').forEach(b => {
  b.onclick = () => {
    document.querySelectorAll('#custModal .cmf-btn').forEach(x => x.classList.remove('active'));
    b.classList.add('active');
    custActiveFilter = b.dataset.cf;
    renderCustList();
  };
});

function renderCustList(){
  const wrap = document.getElementById('custModalList');
  // ترتيب الطلبات حسب الإعداد: newest=الأحدث أعلى (افتراضي) · oldest=الأحدث أسفل
  let list = (RESTAURANT.ordersSort === 'oldest') ? custOrdersCache.slice() : custOrdersCache.slice().reverse();
  if(custActiveFilter === 'remaining') list = list.filter(o => remainingOf(o) > 0);
  else if(custActiveFilter === 'paid') list = list.filter(o => remainingOf(o) === 0);
  const q = (document.getElementById('custSearch') ? document.getElementById('custSearch').value : '').trim().toLowerCase();
  if(q) list = list.filter(o => orderSearchText(o).includes(q));

  if(list.length === 0){
    wrap.innerHTML = '<div class="pos-empty">لا توجد فواتير</div>';
    return;
  }
  wrap.innerHTML = '';
  list.forEach(o => {
    const rem = remainingOf(o);
    const hasRem = rem > 0;
    const row = document.createElement('div');
    row.className = 'cust-row ' + (hasRem ? 'has-remain' : 'is-paid');
    row.innerHTML =
      '<span class="cust-dot ' + (hasRem ? 'red' : 'green') + '"></span>' +
      '<div class="cust-row-info">' +
        '<div class="cust-row-name">' + esc(o.name || 'عميل') + '</div>' +
        '<div class="cust-row-sub">' + esc(orderNoLabel(o)) + ' · ' + esc(o.date || '') + (o.phone ? ' · 📱 ' + esc(o.phone) : '') + '</div>' +
      '</div>' +
      '<div class="cust-row-amt">' +
        (hasRem
          ? '<span class="amt-rem">متبقي ' + money(rem) + '</span>'
          : '<span class="amt-paid">مسدد</span>') +
        '<span class="amt-total">الإجمالي ' + money(o.total) + '</span>' +
      '</div>' +
      '<button class="cust-row-details" data-det="' + esc(o.id) + '">تفاصيل الطلب</button>';
    const open = () => showOrderDetails(o);
    row.querySelector('[data-det]').onclick = (ev) => { ev.stopPropagation(); open(); };
    // الضغط على عميل غير مكتمل (عليه متبقي) يفتح التفاصيل مباشرة
    if(hasRem) row.onclick = open;
    wrap.appendChild(row);
  });
}

function showOrderDetails(o){
  const rem = remainingOf(o);
  const hasRem = rem > 0;
  const rows = (o.items || []).map(it =>
    '<div class="od-item"><span>' + (it.emoji||'') + ' ' + esc(it.name) + ' ×' + it.qty + '</span>' +
    '<span>' + money((it.price||0)*(it.qty||0)) + '</span></div>'
  ).join('');
  const paidVal = o.paid != null ? o.paid : o.total;
  const prep = prepOf(o);
  const prepBadge = prep ? '<div class="od-prep prep-' + prep + '">' + (PREP_LABELS[prep] || '') + '</div>' : '';
  const body =
    '<div class="od-head">' +
      '<span class="cust-dot ' + (hasRem ? 'red' : 'green') + '"></span>' +
      '<div><div class="od-name">' + esc(o.name || 'عميل') + '</div>' +
      '<div class="od-sub">' + esc(orderNoLabel(o)) + ' · ' + esc(o.date || '') + ' · ' + esc(o.type||'') + ' · ' + payLabelOf(o) + '</div></div>' +
    '</div>' +
    prepBadge +
    (o.phone ? '<div class="od-pickup">📱 الجوال: ' + esc(o.phone) + '</div>' : '') +
    (pickupLabel(o) ? '<div class="od-pickup">📅 موعد الاستلام: ' + esc(pickupLabel(o)) + '</div>' : '') +
    (o.theme ? '<div class="od-pickup">🎁 الطلب: مع ثيم</div>' : '') +
    (o.theme && o.themeData ?
      '<div class="od-pickup">🎁 المناسبة: ' + esc(o.themeData.occasion || '—') + '</div>' +
      (o.themeData.customText ? '<div class="od-pickup">🎁 النص: ' + esc(o.themeData.customText) + '</div>' : '')
      : '') +
    (o.cashier ? '<div class="od-pickup">👤 المستخدم: ' + esc(o.cashier) + '</div>' : '') +
    '<div class="od-items">' + rows + '</div>' +
    '<div class="od-totals">' +
      ((Number(o.vat)||0) > 0 ? '<div class="od-row"><span>المجموع الفرعي</span><span>' + money(o.subtotal||0) + '</span></div>' : '') +
      ((Number(o.vat)||0) > 0 ? '<div class="od-row"><span>الضريبة</span><span>' + money(o.vat||0) + '</span></div>' : '') +
      '<div class="od-row big"><span>الإجمالي</span><span>' + money(o.total||0) + '</span></div>' +
      '<div class="od-row"><span>المدفوع</span><span>' + money(paidVal) + '</span></div>' +
      (hasRem ? '<div class="od-row remain"><span>المتبقي</span><span>' + money(rem) + '</span></div>' : '') +
    '</div>' +
    (o.formToken ? (function(){
      const u = qrDataUrl(recordUrlOf(o), 4, 6);
      return u ? '<div class="od-qr" style="text-align:center;margin-top:12px;padding-top:10px;border-top:1px dashed #cbd5e1;">' +
        '<img src="' + u + '" alt="QR" style="width:120px;height:120px;image-rendering:pixelated;background:#fff;padding:6px;border-radius:10px;border:1px solid #e2e8f0;" />' +
        '<div style="font-size:11.5px;color:#64748b;margin-top:5px;">رمز الاستمارة الموحّد · امسح لتتبّع الطلب (' + esc(orderNoLabel(o)) + ')</div>' +
      '</div>' : '';
    })() : '') +
    '<div class="od-actions">' +
      ((isManagerUser() && prep && prep !== 'confirmed' && prep !== 'ready') ? '<button class="btn btn-confirm" id="odConfirm">✔ تأكيد</button>' : '') +
      ((isManagerUser() && prep && prep !== 'ready') ? '<button class="btn btn-ready" id="odReady">✅ جاهز</button>' : '') +
      '<button class="btn" id="odReprint">🖨️ طباعة</button>' +
      '<button class="btn" id="odWhatsapp">📲 واتساب</button>' +
      '<button class="btn" id="odReorder">🔁 إعادة الطلب</button>' +
      (hasRem ? '<button class="btn btn-primary" id="odSettle">✔ تحصيل المتبقي</button>' : '') +
    '</div>';
  document.getElementById('orderDetailsBody').innerHTML = body;
  const confirmBtn = document.getElementById('odConfirm');
  if(confirmBtn) confirmBtn.onclick = () => setOrderPrep(o, 'confirmed');
  const readyBtn = document.getElementById('odReady');
  if(readyBtn) readyBtn.onclick = () => setOrderPrep(o, 'ready');
  document.getElementById('odReprint').onclick = () => printReceipt(o);
  document.getElementById('odWhatsapp').onclick = () => sendInvoiceWhatsApp(o);
  document.getElementById('odReorder').onclick = () => reorderFrom(o);
  const settleBtn = document.getElementById('odSettle');
  if(settleBtn) settleBtn.onclick = () => settleRemainingPOS(o);
  orderDetailsModal.classList.add('show');
}

// إنشاء فاتورة جديدة بنفس أصناف طلب سابق (reorder)
function reorderFrom(o){
  if(!o || !(o.items && o.items.length)){ showToast('لا توجد أصناف لنسخها'); return; }
  if(ticket.length && !confirm('سيتم مسح الطلب الحالي وتحميل أصناف هذا الطلب — متابعة؟')) return;
  ticket = [];
  orderTheme = false;
  (o.items || []).forEach((it, idx) => {
    const m = MENU.find(x => x.name === it.name);
    ticket.push({
      id: m ? m.id : ('re_' + idx + '_' + Date.now()),
      name: it.name, price: it.price, emoji: it.emoji || (m ? m.emoji : ''),
      qty: it.qty || 1, wrapped: !!it.wrapped
    });
  });
  if(o.theme) orderTheme = true;
  if(o.themeData){
    themeData = {occasion: o.themeData.occasion || '', customText: o.themeData.customText || ''};
    document.querySelectorAll('#themeRow .theme-btn').forEach(x => x.classList.toggle('active', x.dataset.theme === (o.theme ? 'yes' : 'no')));
  } else {
    themeData = {occasion:'', customText:''};
  }
  if(o.name && o.name !== 'عميل نقدي') document.getElementById('custName').value = o.name;
  if(o.phone) document.getElementById('custPhone').value = o.phone;
  renderTicket();
  orderDetailsModal.classList.remove('show');
  if(typeof custModal !== 'undefined' && custModal) custModal.classList.remove('show');
  if(typeof weekModal !== 'undefined' && weekModal){ weekModal.classList.remove('show'); weekModal.dataset.autoOpened=''; }
  if(typeof clearWeeklyNewMarks === 'function') clearWeeklyNewMarks();
  showToast('تم تحميل الأصناف — أكمل الدفع لإنشاء فاتورة جديدة');
}

async function settleRemainingPOS(o){
  const rem = remainingOf(o);
  if(rem <= 0) return;
  if(!confirm('تأكيد تحصيل المبلغ المتبقي (' + money(rem) + ')؟')) return;
  const patch = { paid: Number(o.total) || 0, remaining: 0, change: 0, payStatus: 'paid' };
  try{
    await DB.updateOrder(o.id, patch);
    Object.assign(o, patch);
    renderCustList();
    orderDetailsModal.classList.remove('show');
    showToast('تم تحصيل المتبقي ✓');
  }catch(err){ console.error(err); showToast('تعذر التحديث'); }
}

// ===== الأسبوع: تتبع الطلبات الجديدة وإضاءتها الزرقاء =====
// جديد: مجموعة معرفات الطلبات التي وصلت حديثاً وتستحق الإضاءة الخلفية
let weeklyNewOrderIds = new Set();      // طلبات تُعلَّم كـ"جديدة" في اللوحة
let weeklyPulseUntil = {};              // id → وقت انتهاء الوميض (ms)
let weeklyGlowTimer = null;             // مؤقت إزالة الوميض

// إعدادات الميزة (تُحدَّث من applySettings)
let WEEKLY_CFG = {
  onNewOrder: false,   // فتح اللوحة تلقائياً عند وصول طلب جديد
  glow: true,          // إضاءة زرقاء خلف الطلب الجديد
  glowMinutes: 2,      // مدة الوميض
  stayOpen: true,      // إبقاء اللوحة مفتوحة حتى يقفلها المستخدم
  jumpToNew: true,     // التمرير إلى الطلب الجديد
  highlightMax: 20     // أقصى عدد طلبات تُعلَّم كجديدة
};

// تسجيل وصول طلب جديد من طبقة البيانات (onOrders)
function onWeeklyOrderArrived(order){
  if(!order || !order.id) return;
  // لا نسجّل طلبات أنشأها هذا الجهاز نفسه (المستخدم يراها في شاشته أصلاً)
  if(typeof selfOrderIds !== 'undefined' && selfOrderIds.has(order.id)) return;
  weeklyNewOrderIds.add(order.id);
  weeklyPulseUntil[order.id] = Date.now() + (WEEKLY_CFG.glowMinutes * 60000);
  // اقتطاع المجموعة لتفادي التضخّم
  if(weeklyNewOrderIds.size > WEEKLY_CFG.highlightMax){
    const arr = Array.from(weeklyNewOrderIds).slice(-WEEKLY_CFG.highlightMax);
    weeklyNewOrderIds = new Set(arr);
  }
  // فتح اللوحة تلقائياً إن كان الخيار مفعّلاً
  if(WEEKLY_CFG.onNewOrder){
    if(weekModal.classList.contains('show')){
      renderWeekBoard();          // مفتوحة بالفعل: أعد الرسم لظهور الإضاءة
    } else {
      showToast('🗓️ فتح طلبات الأسبوع تلقائياً · طلب جديد');
      openWeekBoard(false);
    }
  } else if(weekModal.classList.contains('show')){
    renderWeekBoard();            // مفتوحة يدوياً: أظهر الإضاءة أيضاً
  }
  startWeeklyGlowTimer();
}

// مؤقت يزيل الوميض بعد انتهاء مدته ويبقي التمييز الثابت
function startWeeklyGlowTimer(){
  if(weeklyGlowTimer) return;
  weeklyGlowTimer = setInterval(() => {
    const now = Date.now();
    let changed = false;
    weeklyNewOrderIds.forEach(id => {
      if(weeklyPulseUntil[id] && now >= weeklyPulseUntil[id]){ weeklyPulseUntil[id] = 0; changed = true; }
    });
    if(!weeklyNewOrderIds.size){ clearInterval(weeklyGlowTimer); weeklyGlowTimer = null; return; }
    if(changed && weekModal && weekModal.classList.contains('show')) renderWeekBoard();
  }, 5000);
}

// إعادة تعيين تمييز الطلبات الجديدة (عند إغلاق اللوحة)
function clearWeeklyNewMarks(){
  weeklyNewOrderIds = new Set();
  weeklyPulseUntil = {};
  if(weeklyGlowTimer){ clearInterval(weeklyGlowTimer); weeklyGlowTimer = null; }
}

// ===== Week orders board =====
const weekModal = document.getElementById('weekModal');
const mgrModal = document.getElementById('mgrModal');
let weekOffset = 0;          // 0 = الأسبوع الحالي، -1 سابق، +1 لاحق
let weekOrdersCache = [];
// وضع المدير: حذف الطلبات متاح للمدير فقط
let managerUser = null;      // اسم المدير المُفعّل حالياً (ضمن الجلسة)
function isManagerUnlocked(){ return !!managerUser; }

function ymd(d){
  const y = d.getFullYear();
  const m = String(d.getMonth()+1).padStart(2,'0');
  const da = String(d.getDate()).padStart(2,'0');
  return y + '-' + m + '-' + da;
}
// تاريخ اليوم المرجعي للطلب: يوم الاستلام إن وجد، وإلا تاريخ الإنشاء
function orderDayKey(o){
  if(o.pickupDate) return o.pickupDate;
  if(o.createdAt) return ymd(new Date(o.createdAt));
  return '';
}
// بداية الأسبوع (السبت) للإزاحة المعطاة
function weekStart(offset){
  const now = new Date();
  now.setHours(0,0,0,0);
  const back = (now.getDay() + 1) % 7;   // إرجاع لأقرب سبت
  now.setDate(now.getDate() - back + offset*7);
  return now;
}

document.getElementById('weekBtn').onclick = async function(){
  await openWeekBoard(true);
};
async function openWeekBoard(showLoading, autoOpened){
  if(showLoading) showToast('جاري تحميل طلبات الأسبوع...');
  try{ weekOrdersCache = (await DB.getOrders()) || []; }
  catch(e){ console.error(e); if(showLoading) showToast('تعذر جلب الطلبات'); return; }
  weekOffset = 0;
  managerUser = null;   // يبدأ مقفلاً في كل مرة؛ الحذف يتطلب دخول المدير
  updateMgrBtn();
  renderWeekBoard();
  weekModal.classList.add('show');
  weekModal.dataset.autoOpened = autoOpened ? '1' : '';
  // التمرير إلى أول طلب جديد
  if(autoOpened && WEEKLY_CFG.jumpToNew) scrollToNewestWeekCard();
  startWeeklyGlowTimer();
};
// إغلاق اللوحة: يوقف المييز ويسمح بإغلاق يدوي دائماً
function closeWeekBoard(){
  weekModal.classList.remove('show');
  weekModal.dataset.autoOpened = '';
  clearWeeklyNewMarks();   // بعد الإغلاق اليدوي يزول تمييز "جديد"
}
document.getElementById('closeWeekModal').onclick = () => closeWeekBoard();
weekModal.onclick = (e) => { if(e.target === weekModal) closeWeekBoard(); };
document.getElementById('weekPrev').onclick = () => { weekOffset--; renderWeekBoard(); };
document.getElementById('weekNext').onclick = () => { weekOffset++; renderWeekBoard(); };
document.getElementById('weekToday').onclick = () => { weekOffset = 0; renderWeekBoard(); };

// زر وضع المدير (قفل/فتح)
document.getElementById('weekMgrBtn').onclick = () => {
  if(isManagerUnlocked()){
    managerUser = null;
    updateMgrBtn();
    renderWeekBoard();
    showToast('تم قفل وضع المدير');
  } else {
    document.getElementById('mgrErr').textContent = '';
    document.getElementById('mgrUser').value = '';
    document.getElementById('mgrPass').value = '';
    mgrModal.classList.add('show');
    setTimeout(() => document.getElementById('mgrUser').focus(), 50);
  }
};
document.getElementById('closeMgrModal').onclick = () => mgrModal.classList.remove('show');
mgrModal.onclick = (e) => { if(e.target === mgrModal) mgrModal.classList.remove('show'); };

// التحقق من حساب المدير (الدور "مدير")
document.getElementById('mgrForm').onsubmit = async function(e){
  e.preventDefault();
  const u = document.getElementById('mgrUser').value.trim();
  const p = document.getElementById('mgrPass').value;
  const errEl = document.getElementById('mgrErr');
  errEl.textContent = '';
  let users = [];
  try{ users = (await DB.getUsers()) || []; }
  catch(err){ console.error(err); errEl.textContent = 'تعذر التحقق من البيانات'; return; }
  const found = users.find(x => x.username === u && x.password === p);
  if(!found){ errEl.textContent = 'اسم المستخدم أو كلمة المرور غير صحيحة'; return; }
  if(found.role !== 'مدير'){ errEl.textContent = 'هذا الحساب ليس مديراً — الحذف للمدير فقط'; return; }
  managerUser = found.name || found.username;
  mgrModal.classList.remove('show');
  updateMgrBtn();
  renderWeekBoard();
  showToast('تم تفعيل وضع المدير · يمكنك الآن حذف الطلبات');
};

function updateMgrBtn(){
  const b = document.getElementById('weekMgrBtn');
  if(!b) return;
  if(isManagerUnlocked()){
    b.textContent = '🔓 المدير: ' + managerUser + ' (قفل)';
    b.classList.add('unlocked');
  } else {
    b.textContent = '🔒 وضع المدير';
    b.classList.remove('unlocked');
  }
}

// حذف طلب من لوحة الأسبوع (للمدير فقط)
async function deleteWeekOrder(id){
  if(!isManagerUnlocked()){ showToast('الحذف متاح للمدير فقط'); return; }
  const o = weekOrdersCache.find(x => x.id === id);
  const label = o ? (o.name || id) : id;
  if(!confirm('حذف طلب "' + label + '" نهائياً؟ لا يمكن التراجع.')) return;
  try{
    await DB.deleteOrder(id);
    weekOrdersCache = weekOrdersCache.filter(x => x.id !== id);
    custOrdersCache = custOrdersCache.filter(x => x.id !== id);
    renderWeekBoard();
    showToast('تم حذف الطلب ✓');
  }catch(err){ console.error(err); showToast('تعذر حذف الطلب'); }
}

function renderWeekBoard(){
  const grid = document.getElementById('weekGrid');
  const start = weekStart(weekOffset);
  const days = [];
  for(let i=0;i<7;i++){ const d = new Date(start); d.setDate(start.getDate()+i); days.push(d); }

  // نطاق الأسبوع
  const fmtShort = d => String(d.getDate()).padStart(2,'0') + '/' + String(d.getMonth()+1).padStart(2,'0');
  document.getElementById('weekRange').textContent = fmtShort(days[0]) + ' — ' + fmtShort(days[6]) + ' / ' + days[0].getFullYear();

  // تجميع الطلبات حسب اليوم
  const wq = (document.getElementById('weekSearch') ? document.getElementById('weekSearch').value : '').trim().toLowerCase();
  const byDay = {};
  weekOrdersCache.forEach(o => {
    const k = orderDayKey(o);
    if(!k) return;
    if(wq && !orderSearchText(o).includes(wq)) return;
    (byDay[k] = byDay[k] || []).push(o);
  });

  const todayKey = ymd(new Date());
  grid.innerHTML = '';
  days.forEach(d => {
    const key = ymd(d);
    const list = (byDay[key] || []).slice().sort((a,b) => (a.pickupTime||'').localeCompare(b.pickupTime||''));
    const col = document.createElement('div');
    col.className = 'week-col' + (key === todayKey ? ' is-today' : '');
    let cards = '';
    if(list.length === 0){
      cards = '<div class="week-empty">—</div>';
    } else {
      cards = list.map(o => {
        const rem = remainingOf(o);
        const hasRem = rem > 0;
        const isDone = !!o.doneMark;
        // تمييز الطلب الجديد: وميض أزرق إن ما زال داخل مدة الوميض، وإلا تمييز ثابت
        const isNew = weeklyNewOrderIds.has(o.id);
        const pulsing = isNew && WEEKLY_CFG.glow && (weeklyPulseUntil[o.id] || 0) > Date.now();
        const glowCls = !isNew ? '' : (pulsing ? ' bm-new-pulse' : (WEEKLY_CFG.glow ? ' bm-new-mark' : ''));
        return '<div class="week-card ' + (hasRem?'has-remain':'is-paid') + (isDone?' is-done':'') + glowCls + '" data-oid="' + esc(o.id) + '">' +
          '<div class="wc-top">' +
            '<span class="cust-dot ' + (hasRem?'red':'green') + '"></span>' +
            '<span class="wc-no">' + esc(orderNoLabel(o)) + '</span>' +
            '<span class="wc-name">' + esc(o.name || 'عميل') + '</span>' +
            (o.pickupTime ? '<span class="wc-time">⏰ ' + esc(o.pickupTime) + '</span>' : '') +
            (isManagerUnlocked() ? '<button class="wc-del" data-del="' + esc(o.id) + '" title="حذف (مدير)">🗑️</button>' : '') +
          '</div>' +
          '<div class="wc-sub">' +
            '<span>' + esc(o.type||'') + (o.theme ? ' · 🎁 ثيم' : '') + (o.theme && o.themeData && o.themeData.occasion ? ' (' + esc(o.themeData.occasion) + ')' : '') + (o.doneMark ? ' · ✅' : '') + '</span>' +
            '<span>' + money(o.total||0) + '</span>' +
          '</div>' +
          (prepOf(o) ? '<div class="wc-prep prep-' + prepOf(o) + '">' + (PREP_LABELS[prepOf(o)] || '') + '</div>' : '') +
          (hasRem ? '<div class="wc-rem">متبقي ' + money(rem) + '</div>' : '') +
          (o.formToken ? (function(){
            const u = qrDataUrl(recordUrlOf(o), 2, 2);
            return u ? '<div class="wc-qr" style="text-align:center;margin-top:6px;"><img src="' + u + '" alt="QR" title="رمز الاستمارة الموحّد" style="width:52px;height:52px;image-rendering:pixelated;background:#fff;padding:3px;border-radius:7px;border:1px solid #e2e8f0;" /></div>' : '';
          })() : '') +
          '<label class="wc-done" data-done="' + esc(o.id) + '">' +
            '<input type="checkbox"' + (isDone ? ' checked' : '') + ' />' +
            '<span>تم التنفيذ</span>' +
          '</label>' +
        '</div>';
      }).join('');
    }
    col.innerHTML =
      '<div class="week-col-head"><span class="wch-day">' + WEEK_DAYS_AR[d.getDay()] + '</span>' +
      '<span class="wch-date">' + fmtShort(d) + '</span>' +
      '<span class="wch-count">' + list.length + '</span></div>' +
      '<div class="week-col-body">' + cards + '</div>';
    grid.appendChild(col);
    col.querySelectorAll('[data-oid]').forEach(el => {
      el.onclick = () => {
        const o = weekOrdersCache.find(x => x.id === el.dataset.oid);
        if(o) showOrderDetails(o);
      };
    });
    col.querySelectorAll('[data-del]').forEach(el => {
      el.onclick = (ev) => { ev.stopPropagation(); deleteWeekOrder(el.dataset.del); };
    });
    col.querySelectorAll('[data-done]').forEach(el => {
      el.onclick = (ev) => { ev.stopPropagation(); };
      const cb = el.querySelector('input[type=checkbox]');
      if(cb){
        cb.onchange = async function(ev2){
          ev2.stopPropagation();
          const oid = el.dataset.done;
          const o = weekOrdersCache.find(x => x.id === oid);
          if(!o) return;
          const val = cb.checked;
          try{
            await DB.updateOrder(oid, {doneMark: val});
            o.doneMark = val;
            renderWeekBoard();
            showToast(val ? 'تم تعليم الطلب كمنفّذ ✓' : 'تم إلغاء تعليم التنفيذ');
          }catch(err){ console.error(err); showToast('تعذر تحديث الطلب'); }
        };
      }
    });
  });
}

// التمرير إلى أحدث طلب موسوم بـ"جديد" داخل اللوحة
function scrollToNewestWeekCard(){
  try{
    const grid = document.getElementById('weekGrid');
    if(!grid) return;
    const cards = grid.querySelectorAll('.week-card.bm-new-pulse, .week-card.bm-new-mark');
    if(!cards.length) return;
    const target = cards[cards.length - 1];
    target.scrollIntoView({behavior:'smooth', block:'center', inline:'center'});
  }catch(e){}
}

// ===== Toast =====
let toastTimer;
function showToast(msg){
  // أثناء وضع الصيانة لا تظهر أي رسالة للمستخدمين (المدير مستثنى)
  if(typeof isMaintenanceBlocking==='function' && isMaintenanceBlocking()) return;
  const t = document.getElementById('toast');
  t.textContent = msg; t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2500);
}

// ===== POS Login / المستخدم الحالي =====
// تنبيه: الحماية شكلية (frontend فقط) وكلمات المرور نص واضح — للاستخدام الحسّاس يلزم Firebase Authentication.
let currentPosUser = null;

function showLogin(switchMode){
  const ov = document.getElementById('loginOverlay');
  if(!ov) return;
  document.getElementById('loginErr').textContent = '';
  document.getElementById('loginUser').value = '';
  document.getElementById('loginPass').value = '';
  const title = document.getElementById('loginTitle');
  if(title){
    const lsT = loginScreenCfg().title;
    title.textContent = switchMode ? 'تبديل المستخدم' : (lsT ? lsT : 'تسجيل الدخول');
  }
  applyLoginScreenSettings();
  ov.classList.add('show');
  refreshBioLoginBtn();
  setTimeout(() => { const u = document.getElementById('loginUser'); if(u) u.focus(); }, 50);
}

// إعدادات شاشة تسجيل الدخول (خلفية + أزرار + نصوص)
function loginScreenCfg(){
  const d = { bgImage:'', showSignupBtn:true, showCheckStatusBtn:true, bioEnabled:true, faceEnabled:true, title:'', subtitle:'' };
  const c = (RESTAURANT && RESTAURANT.loginScreen) || {};
  return Object.assign({}, d, c);
}
function applyLoginScreenSettings(){
  const ls = loginScreenCfg();
  const ov = document.getElementById('loginOverlay');
  if(ov){
    if(ls.bgImage){
      ov.style.backgroundImage = "linear-gradient(180deg,rgba(10,20,55,.62) 0%,rgba(9,16,45,.74) 45%,rgba(7,12,38,.86) 100%),url('" + String(ls.bgImage).replace(/'/g, "%27") + "')";
      ov.style.backgroundSize = 'cover';
      ov.style.backgroundPosition = 'center';
      ov.style.backgroundRepeat = 'no-repeat';
    } else {
      ov.style.backgroundImage = '';
      ov.style.backgroundSize = '';
      ov.style.backgroundPosition = '';
      ov.style.backgroundRepeat = '';
    }
  }
  // عنوان ونص فرعي مخصّصان (اختياري)
  const sub = document.querySelector('#loginForm .login-sub');
  if(sub) sub.textContent = ls.subtitle ? ls.subtitle : 'أدخل اسم المستخدم وكلمة المرور';
  // إظهار/إخفاء زر إنشاء حساب جديد
  const su = document.getElementById('openSignupBtn');
  if(su) su.style.display = (ls.showSignupBtn === false) ? 'none' : '';
  // إظهار/إخفاء زر إدخال كود التفعيل
  const ck = document.getElementById('checkStatusBtn');
  if(ck) ck.style.display = (ls.showCheckStatusBtn === false) ? 'none' : '';
}

// أيقونتا الدخول الحيوي (إصبع/عين) تظهران دائمًا جنبًا إلى جنب؛
// تظهر بألوانها الكاملة عند توفر اعتماد حيوي مسجّل ودعم الجهاز، وإلا تظهر باهتة
function refreshBioLoginBtn(){
  const ls = loginScreenCfg();
  const fBtn = document.getElementById('bioLoginBtn');
  const vBtn = document.getElementById('bioFaceLoginBtn');
  const row  = document.getElementById('loginBioRow');
  const okBio = !!(window.BIO && BIO.supported());
  function setBtn(btn, enabledByAdmin, mode){
    if(!btn) return;
    // الأيقونة تبقى ظاهرة دائمًا؛ نتحكّم فقط بحالة التفعيل (باهتة/نشطة)
    btn.classList.remove('hidden');
    if(enabledByAdmin === false){ btn.classList.add('bio-off'); return; }
    if(okBio && BIO.anyCred(mode)){
      BIO.platformAvailable().then(function(ok){ btn.classList.toggle('bio-off', !ok); });
    } else {
      btn.classList.add('bio-off');
    }
  }
  // أخفِ الصف بالكامل فقط إذا عطّل المدير النوعين معًا
  var bothOff = (ls.bioEnabled === false && ls.faceEnabled === false);
  if(row) row.classList.toggle('hidden', bothOff);
  var sep = document.getElementById('loginBioSep');
  if(sep) sep.classList.toggle('hidden', bothOff);
  setBtn(fBtn, ls.bioEnabled, 'finger');
  setBtn(vBtn, ls.faceEnabled, 'face');
}

function updatePosUserBox(){
  const box = document.getElementById('posUserBox');
  const nameEl = document.getElementById('posUserName');
  if(!box) return;
  if(currentPosUser){
    box.style.display = '';
    if(nameEl) nameEl.textContent = '👤 ' + (currentPosUser.name || currentPosUser.username) +
      (currentPosUser.role ? ' (' + currentPosUser.role + ')' : '');
    refreshBioEnrollBtn();
  } else {
    box.style.display = 'none';
  }
  // زر سجل الحركة: يظهر للمدير فقط (يُضبط عند كل تغيير مستخدم)
  try{
    var _logBtn = document.getElementById('activityLogBtn');
    if(_logBtn) _logBtn.style.display = (typeof isManagerUser==='function' && isManagerUser()) ? '' : 'none';
  }catch(e){}
  // أزرار طوارئ النظام + الميزات الجديدة (للمدير فقط — تُضبط عند كل تغيير مستخدم)
  try{
    var _isMgr2 = (typeof isManagerUser==='function' && isManagerUser());
    var _mb2 = document.getElementById('dashMaintBtn'); if(_mb2) _mb2.style.display = _isMgr2 ? '' : 'none';
    var _wn2 = document.getElementById('dashWhatsNewBtn'); if(_wn2) _wn2.style.display = _isMgr2 ? '' : 'none';
    var _up2 = document.getElementById('dashUpdateBtn'); if(_up2) _up2.style.display = _isMgr2 ? '' : 'none';
  }catch(e){}
  try{ if(typeof window.featuresOnUserChange==='function') window.featuresOnUserChange(); }catch(e){}
  // إعادة تقييم شاشة الصيانة والميزات الجديدة بعد تغيير المستخدم
  // تطبيق الصيانة فقط بعد تحديد دور المستخدم (حتى لا يظهر زر/شاشة قبل تسجيل الدخول)
  try{ if(typeof RESTAURANT!=='undefined' && currentPosUser){ applyMaintenance(RESTAURANT.maintenance); maybeShowWhatsNew(RESTAURANT.whatsNew); if(typeof maybeShowUpdate==='function') maybeShowUpdate(RESTAURANT.appUpdate); } else if(typeof RESTAURANT!=='undefined'){ applyMaintenance({}); } }catch(e){}
}

// أزرار تفعيل الدخول الحيوي بعد الدخول — تظهر فقط إن دعمها الجهاز وسمح بها المدير
function refreshBioEnrollBtn(){
  const ls = loginScreenCfg();
  function wire(btnId, mode, enabledByAdmin){
    const btn = document.getElementById(btnId);
    if(!btn) return;
    const labelOn  = (mode === 'face') ? '✅ وجه ✓' : '✅ بصمة ✓';
    const labelOff = (mode === 'face') ? '👁️ وجه' : '👆 بصمة';
    function hide(){ btn.classList.add('hidden'); }
    if(!(window.BIO && BIO.supported() && currentPosUser) || enabledByAdmin === false){ hide(); return; }
    if(BIO.hasCredFor(currentPosUser.username, mode)){ btn.textContent = labelOn; btn.classList.remove('hidden'); }
    else { btn.textContent = labelOff; }
    BIO.platformAvailable().then(function(ok){
      if(!ok){ hide(); return; }
      btn.classList.remove('hidden');
      btn.onclick = async function(){
        if(BIO.hasCredFor(currentPosUser.username, mode)){
          if(!confirm('إلغاء هذا الدخول الحيوي على هذا الجهاز؟')) return;
          BIO.removeCred(currentPosUser.username, mode);
          showToast('تم الإلغاء');
          refreshBioEnrollBtn();
          return;
        }
        const brand = (typeof RESTAURANT!=='undefined' && RESTAURANT && (RESTAURANT.headerBrand||RESTAURANT.name)) || 'Blue Mark';
        try{
          await BIO.enroll({ username: currentPosUser.username, name: currentPosUser.name, rpName: brand, mode: mode });
          showToast((mode === 'face') ? '✅ تم تفعيل الدخول ببصمة العين/الوجه' : '✅ تم تفعيل الدخول ببصمة الإصبع');
          refreshBioEnrollBtn();
        }catch(err){
          showToast('تعذّر التفعيل — تأكد من إعدادات الجهاز');
        }
      };
    });
  }
  wire('bioEnrollBtn', 'finger', ls.bioEnabled);
  wire('bioFaceEnrollBtn', 'face', ls.faceEnabled);
}

function restorePosSession(){
  try{
    const raw = sessionStorage.getItem('pos_user');
    if(raw){ currentPosUser = JSON.parse(raw); }
  }catch(e){ currentPosUser = null; }
  if(currentPosUser){
    updatePosUserBox();
    const ov = document.getElementById('loginOverlay');
    if(ov) ov.classList.remove('show');
    routeAfterLogin();
    try{ if(window.UpgradeCenter) window.UpgradeCenter.refresh(); }catch(e){}
  } else {
    showLogin(false);
  }
}

function setupPosLogin(){
  const form = document.getElementById('loginForm');
  if(form){
    form.onsubmit = async function(e){
      e.preventDefault();
      const u = document.getElementById('loginUser').value.trim();
      const p = document.getElementById('loginPass').value;
      const errEl = document.getElementById('loginErr');
      errEl.textContent = '';
      let users = [];
      try{ users = (await DB.getUsers()) || []; }
      catch(err){ console.error(err); errEl.textContent = 'تعذر التحقق من البيانات'; return; }
      const found = users.find(x => x.username === u && x.password === p);
      if(!found){ errEl.textContent = 'اسم المستخدم أو كلمة المرور غير صحيحة'; return; }
      loginAs(found, { welcome:true });
    };
  }
  // تسجيل دخول موحّد (من كلمة المرور أو من البصمة)
  function loginAs(found, opts){
    opts = opts || {};
    currentPosUser = { username: found.username, name: found.name || found.username, role: found.role || '' };
    if(found.perms) currentPosUser.perms = found.perms;
    try{ sessionStorage.setItem('pos_user', JSON.stringify(currentPosUser)); }catch(e2){}
    // تفعيل صامت للبصمة الأصلية (داخل التطبيق) لتعمل فوراً في المرة التالية
    try{ if(window.BIO && typeof BIO.autoEnroll==='function') BIO.autoEnroll(currentPosUser.username, currentPosUser.name); }catch(e3){}
    const ov = document.getElementById('loginOverlay'); if(ov) ov.classList.remove('show');
    updatePosUserBox();
    routeAfterLogin();
    try{ if(window.UpgradeCenter) window.UpgradeCenter.refresh(); }catch(e4){}
    showToast('أهلاً ' + currentPosUser.name);
    try{ logActivity('login', 'تسجيل دخول' + (opts.bio ? ' (بصمة)' : '')); }catch(e){}
    if(opts.welcome) maybeShowWelcome(found);
    if(notifSupported() && Notification.permission === 'default') requestNotifPermission();
  }
  // أزرار الدخول الحيوي على شاشة الدخول (بصمة إصبع / بصمة عين-وجه)
  async function doBioLogin(mode){
    const errEl = document.getElementById('loginErr'); if(errEl) errEl.textContent = '';
    if(!(window.BIO && BIO.supported() && BIO.anyCred(mode))){ if(errEl) errEl.textContent = 'سجّل الدخول باسم المستخدم وكلمة المرور مرة واحدة على هذا الجهاز، ثم ستعمل البصمة مباشرة'; return; }
    let username;
    try{ username = await BIO.authenticate(null, mode); }
    catch(err){ if(errEl) errEl.textContent = 'تعذّر التحقق الحيوي — حاول مجدداً أو استخدم كلمة المرور'; return; }
    let users = [];
    try{ users = (await DB.getUsers()) || []; }
    catch(e){ if(errEl) errEl.textContent = 'تعذر التحقق من البيانات'; return; }
    const found = users.find(x => x.username === username);
    if(!found){
      // الحساب لم يعد مقبولاً/موجوداً في النظام
      try{ BIO.removeCred(username, mode); }catch(e){}
      if(errEl) errEl.textContent = 'هذا الحساب غير مفعّل في النظام بعد';
      refreshBioLoginBtn();
      return;
    }
    loginAs(found, { welcome:false });
  }
  const bioBtn = document.getElementById('bioLoginBtn');
  if(bioBtn){ bioBtn.onclick = function(){ doBioLogin('finger'); }; }
  const bioFaceBtn = document.getElementById('bioFaceLoginBtn');
  if(bioFaceBtn){ bioFaceBtn.onclick = function(){ doBioLogin('face'); }; }
  const logoutBtn = document.getElementById('posLogoutBtn');
  if(logoutBtn) logoutBtn.onclick = () => {
    if(!confirm('تسجيل الخروج؟')) return;
    try{ logActivity('logout', 'تسجيل خروج'); }catch(e){}
    currentPosUser = null;
    try{ sessionStorage.removeItem('pos_user'); }catch(e){}
    updatePosUserBox();
    showCashier();
    showLogin(false);
    try{ if(window.UpgradeCenter) window.UpgradeCenter.refresh(); }catch(e5){}
  };
  const switchBtn = document.getElementById('posSwitchBtn');
  if(switchBtn) switchBtn.onclick = () => { showLogin(true); };

  // أزرار التنقل بين الكاشير ولوحة المعلومات
  const dashLink = document.getElementById('dashLink');
  if(dashLink) dashLink.onclick = () => showDashboard();
  const toCashier = document.getElementById('dashToCashier');
  if(toCashier) toCashier.onclick = () => showCashier();
  const dashLogout = document.getElementById('dashLogoutBtn');
  if(dashLogout) dashLogout.onclick = () => {
    if(!confirm('تسجيل الخروج؟')) return;
    try{ logActivity('logout', 'تسجيل خروج'); }catch(e){}
    currentPosUser = null;
    try{ sessionStorage.removeItem('pos_user'); }catch(e){}
    updatePosUserBox();
    showCashier();
    showLogin(false);
    try{ if(window.UpgradeCenter) window.UpgradeCenter.refresh(); }catch(e6){}
  };
}

// ===== إنشاء حساب جديد + تفعيل بكود المدير =====
let pendingSignup = null;   // الطلب الذي ينتظر التفعيل على هذا الجهاز

// ===== استكشاف بيانات الجهاز عند إنشاء الحساب =====
// ملاحظة: المتصفّح لا يتيح الوصول لبيانات حساسة (IMEI/رقم SIM/جهات الاتصال/الموقع بلا إذن).
// نجمع فقط المعلومات المتاحة عبر المتصفّح (نظام/متصفّح/شاشة/شبكة...).
function summarizeDevice(info){
  const ua = info.ua || '';
  let os = 'غير معروف';
  let m;
  if((m = ua.match(/Android ([\d.]+)/))) os = 'Android ' + m[1];
  else if(/iPhone|iPad|iPod/.test(ua)){ m = ua.match(/OS ([\d_]+)/); os = (/iPad/.test(ua)?'iPadOS':'iOS') + (m ? (' ' + m[1].replace(/_/g,'.')) : ''); }
  else if((m = ua.match(/Windows NT ([\d.]+)/))){ os = (m[1]==='10.0' ? 'Windows 10/11' : ('Windows NT ' + m[1])); }
  else if((m = ua.match(/Mac OS X ([\d_]+)/))) os = 'macOS ' + m[1].replace(/_/g,'.');
  else if(/CrOS/.test(ua)) os = 'ChromeOS';
  else if(/Linux/.test(ua)) os = 'Linux';
  if(info.platformVersion && /Windows/.test(os)){
    const major = parseInt(info.platformVersion, 10);
    if(major >= 13) os = 'Windows 11';
    else if(major >= 1) os = 'Windows 10';
  }
  let br = 'غير معروف';
  if(/Edg\//.test(ua)) br = 'Edge';
  else if(/OPR\/|Opera/.test(ua)) br = 'Opera';
  else if(/SamsungBrowser/.test(ua)) br = 'Samsung Internet';
  else if(/Firefox\//.test(ua)) br = 'Firefox';
  else if(/Chrome\//.test(ua)) br = 'Chrome';
  else if(/Safari\//.test(ua)) br = 'Safari';
  const isMobile = (typeof info.uaMobile === 'boolean') ? info.uaMobile : /Mobi|Android|iPhone|iPod/.test(ua);
  const type = isMobile ? 'جوال' : (/iPad|Tablet/.test(ua) ? 'جهاز لوحي' : 'كمبيوتر');
  const model = info.model ? (' · ' + info.model) : '';
  return type + ' · ' + os + ' · ' + br + model;
}
async function collectDeviceInfo(){
  const nav = (typeof navigator !== 'undefined') ? navigator : {};
  const info = {};
  try{ info.ua = nav.userAgent || ''; }catch(e){}
  try{ info.platform = nav.platform || ''; }catch(e){}
  try{ info.vendor = nav.vendor || ''; }catch(e){}
  try{ info.lang = nav.language || ''; }catch(e){}
  try{ info.langs = (nav.languages || []).join('، '); }catch(e){}
  try{ info.cores = nav.hardwareConcurrency || null; }catch(e){}
  try{ info.ram = nav.deviceMemory || null; }catch(e){}
  try{ info.touch = (typeof nav.maxTouchPoints === 'number') ? nav.maxTouchPoints : null; }catch(e){}
  try{ info.online = (typeof nav.onLine === 'boolean') ? nav.onLine : null; }catch(e){}
  try{ const s = window.screen || {}; info.screen = (s.width||'?') + '×' + (s.height||'?'); info.depth = s.colorDepth || null; }catch(e){}
  try{ info.dpr = window.devicePixelRatio || 1; }catch(e){}
  try{ info.viewport = (window.innerWidth||'?') + '×' + (window.innerHeight||'?'); }catch(e){}
  try{ info.tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ''; }catch(e){}
  try{ info.tzOffset = -(new Date().getTimezoneOffset()) / 60; }catch(e){}
  try{ const c = nav.connection || nav.mozConnection || nav.webkitConnection; if(c){ info.net = c.effectiveType || ''; info.downlink = (typeof c.downlink==='number')?c.downlink:null; info.saveData = !!c.saveData; } }catch(e){}
  try{
    if(nav.userAgentData){
      info.uaMobile = !!nav.userAgentData.mobile;
      info.uaPlatform = nav.userAgentData.platform || '';
      if(nav.userAgentData.getHighEntropyValues){
        const h = await nav.userAgentData.getHighEntropyValues(['model','platformVersion','architecture','bitness']);
        info.model = h.model || '';
        info.platformVersion = h.platformVersion || '';
        info.arch = h.architecture || '';
        info.bitness = h.bitness || '';
      }
    }
  }catch(e){}
  info.summary = summarizeDevice(info);
  info.capturedAt = Date.now();
  return info;
}

function openSignupModal(){
  const m = document.getElementById('signupModal');
  if(!m) return;
  ['suFirst','suSecond','suPhone','suCity','suUser','suPass'].forEach(id => { const el = document.getElementById(id); if(el) el.value=''; });
  const err = document.getElementById('signupErr'); if(err) err.textContent = '';
  m.classList.add('show');
  setTimeout(() => { const f = document.getElementById('suFirst'); if(f) f.focus(); }, 60);
}

function setupSignupFlow(){
  const openBtn = document.getElementById('openSignupBtn');
  if(openBtn) openBtn.onclick = openSignupModal;
  const checkBtn = document.getElementById('checkStatusBtn');
  if(checkBtn) checkBtn.onclick = async () => {
    // إن وُجد طلب محفوظ على الجهاز اظهره مباشرة، وإلا اطلب اسم المستخدم
    let un = '';
    try{ un = localStorage.getItem('pending_signup_username') || ''; }catch(e){}
    if(un){
      try{
        const reqs = (await DB.getSignupRequests()) || [];
        const found = reqs.filter(r => r.username === un).sort((a,b)=>(b.createdAt||0)-(a.createdAt||0))[0];
        if(found){ pendingSignup = found; showActivateStatus(found, 'restore'); return; }
      }catch(e){}
    }
    showActivateStatus(null, 'lookup');
  };
  const closeBtn = document.getElementById('closeSignupModal');
  if(closeBtn) closeBtn.onclick = () => document.getElementById('signupModal').classList.remove('show');
  const sm = document.getElementById('signupModal');
  if(sm) sm.onclick = e => { if(e.target === sm) sm.classList.remove('show'); };
  const cm = document.getElementById('closeActivateModal');
  if(cm) cm.onclick = () => document.getElementById('activateModal').classList.remove('show');
  const am = document.getElementById('activateModal');
  if(am) am.onclick = e => { if(e.target === am) am.classList.remove('show'); };
  const wok = document.getElementById('welcomeOkBtn');
  if(wok) wok.onclick = () => document.getElementById('welcomeModal').classList.remove('show');

  const form = document.getElementById('signupForm');
  if(!form) return;
  form.onsubmit = async function(e){
    e.preventDefault();
    const err = document.getElementById('signupErr');
    err.textContent = ''; err.classList.remove('signup-ok');
    const g = id => (document.getElementById(id).value || '').trim();
    const first = g('suFirst'), second = g('suSecond'), phone = g('suPhone'),
          city = g('suCity'), username = g('suUser'), password = document.getElementById('suPass').value;
    if(!first || !second){ err.textContent = 'الرجاء إدخال الاسم الأول والثاني'; return; }
    if(!phone || phone.replace(/\D/g,'').length < 7){ err.textContent = 'الرجاء إدخال رقم جوال صحيح'; return; }
    if(!city){ err.textContent = 'الرجاء إدخال المدينة'; return; }
    if(!username || username.length < 3){ err.textContent = 'اسم المستخدم يجب أن يكون 3 أحرف على الأقل'; return; }
    if(!password || password.length < 4){ err.textContent = 'كلمة المرور يجب أن تكون 4 أحرف على الأقل'; return; }
    try{
      const users = (await DB.getUsers()) || [];
      if(users.some(u => u.username === username)){ err.textContent = 'اسم المستخدم مستخدم مسبقاً — اختر غيره'; return; }
      const reqs = (await DB.getSignupRequests()) || [];
      if(reqs.some(r => r.username === username && r.status === 'pending')){
        err.textContent = 'يوجد طلب قيد المراجعة لنفس اسم المستخدم'; return;
      }
    }catch(e2){ console.warn(e2); }
    const btn = document.getElementById('signupSubmitBtn');
    btn.disabled = true; btn.textContent = '⏳ جاري الإرسال...';
    let device = null;
    try{ device = await collectDeviceInfo(); }catch(e4){ console.warn('collectDeviceInfo', e4); }
    try{
      const req = await DB.addSignupRequest({
        first, second, phone, city, username, password,
        fullName: first + ' ' + second, status:'pending',
        code: DB.genActivationCode(),
        role: '', perms: {},
        device: device
      });
      pendingSignup = req;
      try{ localStorage.setItem('pending_signup_username', username); }catch(e3){}
      form.reset();
      document.getElementById('signupModal').classList.remove('show');
      showToast('✅ تم إرسال طلبك — بانتظار موافقة المدير');
      showActivateStatus(req, 'sent');
    }catch(e2){ console.error(e2); err.textContent = 'تعذر إرسال الطلب — حاول مرة أخرى'; }
    btn.disabled = false; btn.textContent = '🚀 إرسال طلب إنشاء الحساب';
  };

  // دالة التحقق من الكود (تُستخدم من داخل النافذة)
  window._posVerifyCode = verifyActivationCode;
}

// إظهار نافذة حالة الطلب/إدخال الكود
function showActivateStatus(req, mode){
  const m = document.getElementById('activateModal');
  const body = document.getElementById('activateBody');
  if(!m || !body) return;
  const isNew = !req;   // لا يوجد طلب جديد على الجهاز بعد
  if(isNew){
    body.innerHTML =
      '<div class="activate-status"><span class="big">🔍</span>' +
      'لم يتم العثور على طلب انتظار على هذا الجهاز.<br/>ادخل اسم المستخدم الذي أنشأت به الطلب للتحقق من حالته.' +
      '</div>' +
      '<form class="activate-form" id="lookupForm">' +
      '<label>اسم المستخدم<input type="text" id="lookupUser" placeholder="اسم المستخدم" autocomplete="off" /></label>' +
      '<div class="activate-err" id="lookupErr"></div>' +
      '<button type="submit" class="btn btn-primary btn-block">🔍 تحقق من حالة الطلب</button>' +
      '</form>';
    m.classList.add('show');
    const lf = document.getElementById('lookupForm');
    lf.onsubmit = async function(e){
      e.preventDefault();
      const un = (document.getElementById('lookupUser').value||'').trim();
      const le = document.getElementById('lookupErr'); le.textContent='';
      if(!un){ le.textContent='أدخل اسم المستخدم'; return; }
      try{
        const reqs = (await DB.getSignupRequests()) || [];
        const found = reqs.filter(r => r.username === un).sort((a,b)=>(b.createdAt||0)-(a.createdAt||0))[0];
        if(!found){ le.textContent='لا يوجد طلب بهذا الاسم'; return; }
        pendingSignup = found;
        try{ localStorage.setItem('pending_signup_username', un); }catch(e2){}
        showActivateStatus(found, 'lookup');
      }catch(e2){ le.textContent='تعذر التحقق — حاول لاحقاً'; }
    };
    return;
  }
  // عرض الحالة بحسب رد المدير
  const st = req.status || 'pending';
  if(st === 'pending'){
    body.innerHTML =
      '<div class="activate-status">' +
        '<span class="big">⏳</span>' +
        'طلبك قيد مراجعة المدير.<br/>عند الموافقة سيظهر لك حقل إدخال كود التفعيل (6 أرقام).' +
        '<div><span class="activate-badge pending">بانتظار موافقة المدير</span></div>' +
      '</div>' +
      '<div style="padding:0 18px 20px"><button type="button" class="btn btn-block" id="refreshActivateBtn">🔄 تحديث الحالة</button></div>';
    m.classList.add('show');
    // استماع لحظي: إذا تمت الموافقة أثناء فتح النافذة، انتقل تلقائياً لإدخال الكود
    try{
      if(window._signupWatch){ window._signupWatch(); window._signupWatch = null; }
      window._signupWatch = DB.onSignupRequests(list => {
        const fresh = (list||[]).find(r => r.id === req.id);
        if(!fresh) return;
        if(fresh.status !== 'pending' && document.getElementById('activateModal').classList.contains('show')){
          pendingSignup = fresh;
          if(window._signupWatch){ window._signupWatch(); window._signupWatch = null; }
          showActivateStatus(fresh, 'auto');
        }
      });
    }catch(e){}
    const rb = document.getElementById('refreshActivateBtn');
    if(rb) rb.onclick = async () => {
      try{
        const reqs = (await DB.getSignupRequests()) || [];
        const fresh = reqs.find(r => r.id === req.id);
        if(fresh){ pendingSignup = fresh; showActivateStatus(fresh, 'refresh'); }
        else showToast('لم يتم العثور على الطلب');
      }catch(e2){ showToast('تعذر التحديث'); }
    };
    return;
  }
  if(st === 'rejected'){
    body.innerHTML =
      '<div class="activate-status">' +
        '<span class="big">❌</span>' +
        'نأسف، تم رفض طلب إنشاء الحساب.<br/>' +
        (req.reason ? '<b>السبب:</b> ' + esc(req.reason) : 'يمكنك التواصل مع إدارة النظام لمزيد من التفاصيل.') +
        '<div><span class="activate-badge rejected">تم الرفض</span></div>' +
      '</div>' +
      '<div style="padding:0 18px 20px"><button type="button" class="btn btn-block" id="retrySignupBtn">➕ تقديم طلب جديد</button></div>';
    m.classList.add('show');
    const rb = document.getElementById('retrySignupBtn');
    if(rb) rb.onclick = () => { m.classList.remove('show'); openSignupModal(); };
    return;
  }
  // approved: يُطلب إدخال كود التفعيل
  body.innerHTML =
    '<div class="activate-status">' +
      '<span class="big">🎉</span>' +
      'تمت موافقة المدير على حسابك!<br/>أدخل كود التفعيل المكوّن من 6 أرقام الذي أعطاه لك المدير.' +
      '<div><span class="activate-badge approved">تمت الموافقة ✔</span></div>' +
    '</div>' +
    '<form class="activate-form" id="activateForm">' +
      '<label>كود التفعيل (6 أرقام)<input type="text" id="actCode" class="activate-code-input" maxlength="6" inputmode="numeric" placeholder="------" autocomplete="off" /></label>' +
      '<div class="activate-err" id="activateErr"></div>' +
      '<small style="color:#64748b;font-size:12px;text-align:center;display:block">⚠️ الكود صالح لمدة 24 ساعة من وقت الموافقة.</small>' +
      '<button type="submit" class="btn btn-primary btn-block">✔ تفعيل الحساب</button>' +
    '</form>';
  m.classList.add('show');
  setTimeout(() => { const c = document.getElementById('actCode'); if(c) c.focus(); }, 60);
  const af = document.getElementById('activateForm');
  af.onsubmit = async function(e){
    e.preventDefault();
    const code = (document.getElementById('actCode').value||'').trim();
    const ae = document.getElementById('activateErr'); ae.textContent='';
    if(!/^\d{6}$/.test(code)){ ae.textContent='الكود يجب أن يكون 6 أرقام'; return; }
    try{
      const reqs = (await DB.getSignupRequests()) || [];
      const fresh = reqs.find(r => r.id === req.id);
      if(!fresh || fresh.status !== 'approved'){ ae.textContent='لم تتم الموافقة على الطلب بعد'; return; }
      if(DB.isCodeExpired && DB.isCodeExpired(fresh)){ ae.textContent='انتهت صلاحية الكود — اطلب من المدير توليد كود جديد'; return; }
      if(String(fresh.code) !== code){ ae.textContent='كود التفعيل غير صحيح — تأكد من المدير'; return; }
      // الكود صحيح: أنشئ المستخدم فعلياً وأدخله النظام
      await verifyActivationCode(fresh, code);
    }catch(e2){ console.error(e2); ae.textContent='تعذر التفعيل — حاول لاحقاً'; }
  };
}

// مطابقة الكود + إنشاء الحساب + الانتقال لتسجيل الدخول
async function verifyActivationCode(req, code){
  try{
    // دفاع متعدد الطبقات: أعد التحقق من المصدر حتى لا يُستدعى بتجاوز النموذج
    const all = (await DB.getSignupRequests()) || [];
    const fresh = all.find(r => r.id === (req && req.id));
    if(!fresh){ showToast('لم يتم العثور على الطلب'); return false; }
    if(fresh.status !== 'approved'){ showToast('لم تتم الموافقة على الطلب بعد'); return false; }
    if(DB.isCodeExpired && DB.isCodeExpired(fresh)){ showToast('انتهت صلاحية الكود'); return false; }
    if(!/^\d{6}$/.test(String(code)) || String(fresh.code) !== String(code)){ showToast('كود التفعيل غير صحيح'); return false; }
    // استخدم النسخة المحدّثة (الصلاحيات/الدور الذي اعتمده المدير)
    req = fresh;
    const users = (await DB.getUsers()) || [];
    if(!users.some(u => u.username === req.username)){
      const newUser = {
        id: Date.now(),
        username: req.username,
        password: req.password,
        name: req.fullName || (req.first + ' ' + req.second),
        phone: req.phone, city: req.city,
        role: req.role || 'موظف',
        perms: req.perms || {orders:true},
        firstLogin: true,
        createdAt: Date.now()
      };
      users.push(newUser);
      await DB.saveUsers(users);
    }
    await DB.updateSignupRequest(req.id, { status:'activated', activatedAt: Date.now() });
    try{ localStorage.setItem('activated_user_'+req.username, '1'); }catch(e){}
    try{ localStorage.removeItem('pending_signup_username'); }catch(e){}
    pendingSignup = null;
    const m = document.getElementById('activateModal');
    if(m) m.classList.remove('show');
    // عرض رسالة النجاح ثم إظهار شاشة الدخول
    showToast('✅ تم تفعيل حسابك — سجّل الدخول الآن');
    showLogin(false);
    const ov = document.getElementById('loginOverlay');
    if(ov) ov.classList.add('show');
    const lu = document.getElementById('loginUser');
    if(lu){ lu.value = req.username; setTimeout(() => { const lp = document.getElementById('loginPass'); if(lp) lp.focus(); }, 80); }
    return true;
  }catch(e){ console.error('activation', e); showToast('تعذر إتمام التفعيل'); return false; }
}

// الترحيب عند أول تسجيل دخول
function maybeShowWelcome(user){
  if(!user) return;
  let isFirst = user.firstLogin === true;
  try{ if(localStorage.getItem('welcomed_'+user.username)) isFirst = false; }catch(e){}
  if(!isFirst) return;
  const m = document.getElementById('welcomeModal');
  if(!m) return;
  const t = document.getElementById('welcomeTitle');
  const p = document.getElementById('welcomeText');
  const first = (user.name || user.username || '').split(' ')[0];
  if(t) t.textContent = '🎉 أهلاً وسهلاً ' + first + '!';
  if(p) p.textContent = 'يسعدنا انضمامك إلى فريق ' + (RESTAURANT.name || 'النظام') +
    '! حسابك جاهز الآن، ويمكنك البدء بإنشاء الطلبات وإدارتها من شاشة الكاشير. نتمنى لك يوماً موفقاً ومليئاً بالإنجازات 🌟';
  m.classList.add('show');
  try{ localStorage.setItem('welcomed_'+user.username, '1'); }catch(e){}
  // اجعل الحساب "ليس أول دخول" بعد العرض
  try{
    DB.getUsers().then(list => {
      const i = list.findIndex(u => u.username === user.username);
      if(i !== -1 && list[i].firstLogin){ list[i].firstLogin = false; DB.saveUsers(list); }
    }).catch(()=>{});
  }catch(e){}
}

// التحكم بالعرض: كاشير / لوحة المعلومات
// ملاحظة: يبقى الهيدر ظاهراً دائماً — لوحة المعلومات تحلّ مكان شبكة الوجبات فقط.
function showDashboard(){
  const dv = document.getElementById('dashboardView');
  const pos = document.querySelector('.pos');
  if(dv) dv.style.display = '';
  if(pos) pos.style.display = 'none';
  document.body.classList.add('dash-mode');
  // زر «إنشاء طلب» يظهر، وزر «lوحة المعلومات» يختفي (نحن داخلها)
  const toCashier = document.getElementById('dashToCashier');
  const toDash = document.getElementById('dashLink');
  if(toCashier) toCashier.style.display = '';
  if(toDash) toDash.style.display = 'none';
  try{ if(window.Dash && typeof Dash.open === 'function') Dash.open(); }catch(e){ console.error(e); }
}
function showCashier(){
  const dv = document.getElementById('dashboardView');
  const pos = document.querySelector('.pos');
  if(dv) dv.style.display = 'none';
  if(pos) pos.style.display = '';
  document.body.classList.remove('dash-mode');
  const isMgr = (currentPosUser && currentPosUser.role === 'مدير');
  // زر «lوحة المعلومات» يظهر للمدير فقط، وزر «إنشاء طلب» يختفي
  const toCashier = document.getElementById('dashToCashier');
  const toDash = document.getElementById('dashLink');
  if(toCashier) toCashier.style.display = 'none';
  if(toDash) toDash.style.display = isMgr ? '' : 'none';
}
// بعد الدخول: المدير ← لوحة المعلومات، غيره ← الكاشير
function routeAfterLogin(){
  const isMgr = (currentPosUser && currentPosUser.role === 'مدير');
  const dashLink = document.getElementById('dashLink');
  const toCashier = document.getElementById('dashToCashier');
  if(!isMgr){
    // مستخدم عادي (كاشير): لا أزرار لوحة معلومات — يرى الوجبات مباشرة
    if(dashLink) dashLink.style.display = 'none';
    if(toCashier) toCashier.style.display = 'none';
    showCashier();
    return;
  }
  // المدير: يفتح على لوحة المعلومات
  showDashboard();
}

// ربط حقول البحث في القوائم
function setupSearches(){
  const cs = document.getElementById('custSearch');
  if(cs) cs.oninput = () => renderCustList();
  const ws = document.getElementById('weekSearch');
  if(ws) ws.oninput = () => renderWeekBoard();
}

// ===== نظام الإشعارات =====
let notifications = [];       // قائمة الإشعارات
let notifUnreadCount = 0;      // عدد غير المقروءة

// ===== تنبيهات نظام التشغيل / الجوال (Web Notifications API) =====
let selfOrderIds = new Set(); // طلبات أنشأها هذا الجهاز (لا تُنبّه نفسها مرتين)

// ===== حالة تحضير الطلب (نظام متعدد المستخدمين) =====
// pending=يحتاج تأكيد المدير · confirmed=قيد التنفيذ · ready=جاهز
const PREP_LABELS = { pending: '🕒 بانتظار التأكيد', confirmed: '👨‍🍳 قيد التنفيذ', ready: '✅ جاهز' };
function prepOf(o){ return (o && o.prep) ? o.prep : ''; }
// مدير = دوره "مدير" أو وضع المدير مفعّل
function isManagerUser(){ return !!(typeof currentPosUser !== 'undefined' && currentPosUser && currentPosUser.role === 'مدير') || (typeof isManagerUnlocked === 'function' && isManagerUnlocked()); }

// هل يجب حجب الرسائل/التنبيهات عن هذا المستخدم بسبب وضع «الصيانة»؟
// المدير مستثنى دائماً. الاتصال بالفايربيس يبقى شغّالاً — نمنع فقط ظهور الرسائل.
function isMaintenanceBlocking(){
  try{
    // المدير مستثنى دائماً من حجب الرسائل أثناء وضع الصيانة
    if(typeof isManagerUser==='function' && isManagerUser()) return false;
    var mm = (typeof RESTAURANT!=='undefined' && RESTAURANT && RESTAURANT.maintenance) || {};
    return !!mm.active;
  }catch(e){ return false; }
}
let selfPrepIds = new Set(); // تغيرات حالة أجراها هذا الجهاز (لا تُنبّه نفسها)

// تغيير حالة تحضير الطلب (للمدير فقط)
async function setOrderPrep(o, prep){
  if(!o) return;
  try{
    selfPrepIds.add(o.id + ':' + prep);
    await DB.updateOrder(o.id, { prep: prep });
    Object.assign(o, { prep: prep });
    showToast(prep === 'confirmed' ? 'تم تأكيد الطلب — قيد التنفيذ'
      : prep === 'ready' ? 'تم تعليم الطلب جاهز ✓' : 'تم التحديث');
    if(typeof renderCustList === 'function') try{ renderCustList(); }catch(e){}
    showOrderDetails(o); // تحديث النافذة
  }catch(err){ console.error(err); showToast('تعذر تحديث الحالة'); }
}
let NOTIF_ENABLED = true;     // تفعيل إشعارات النظام (من لوحة التحكم)
let NOTIF_SOUND = true;       // تشغيل نغمة التنبيه (من لوحة التحكم)
let swReg = null;             // تسجيل Service Worker لإظهار إشعارات الجوال

// تسجيل Service Worker (ضروري لإظهار الإشعارات على أندرويد Chrome)
function registerServiceWorker(){
  if(!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.register('sw.js').then(function(reg){
    swReg = reg;
  }).catch(function(e){ console.warn('تعذر تسجيل Service Worker:', e); });
  navigator.serviceWorker.ready.then(function(reg){ swReg = reg; }).catch(function(){});
}

function notifSupported(){ return (typeof Notification !== 'undefined'); }

// طلب إذن التنبيهات (يُستدعى من حدث نقر المستخدم)
function requestNotifPermission(){
  if(!notifSupported()) return;
  try{
    Notification.requestPermission().then(function(p){
      updateSysNotifBtn();
      if(p === 'granted'){
        systemNotify('✅ تم تفعيل التنبيهات', 'ستصلك تنبيهات فورية عند وصول أي طلب جديد.');
      }
    });
  }catch(e){ console.warn('تعذر طلب إذن التنبيهات:', e); }
}

// إظهار تنبيه على مستوى النظام (ويندوز / شريط إشعارات الجوال)
function systemNotify(title, body){
  if(typeof isMaintenanceBlocking==='function' && isMaintenanceBlocking()) return;  // وضع الصيانة: لا رسائل للمستخدمين
  if(!NOTIF_ENABLED) return;                       // معطّل من لوحة التحكم
  if(!notifSupported() || Notification.permission !== 'granted'){
    if(NOTIF_SOUND) playNotifBeep();
    return;
  }
  const opts = {
    body: body || '',
    icon: 'icon-192.png',
    badge: 'icon-192.png',
    tag: 'order-' + Date.now(),
    dir: 'rtl',
    lang: 'ar',
    requireInteraction: false
  };
  // الأفضل على الجوال: ServiceWorkerRegistration.showNotification
  // (new Notification() يرمي خطأ على أندرويد Chrome)
  if(swReg && typeof swReg.showNotification === 'function'){
    try{
      swReg.showNotification(title, opts);
    }catch(e){ console.warn('تعذر إظهار إشعار SW:', e); fallbackNotify(title, opts); }
  }else{
    fallbackNotify(title, opts);
  }
  if(NOTIF_SOUND) playNotifBeep();
}

// تنبيه احتياطي لسطح المكتب (حيث لا يتوفر Service Worker)
function fallbackNotify(title, opts){
  try{
    const n = new Notification(title, opts);
    n.onclick = function(){ try{ window.focus(); }catch(e){} n.close(); };
    setTimeout(function(){ try{ n.close(); }catch(e){} }, 20000);
  }catch(e){ console.warn('تعذر إظهار تنبيه النظام:', e); }
}

// نغمة تنبيه قصيرة (مولّدة برمجياً — بلا ملف صوتي خارجي)
function playNotifBeep(){
  try{
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if(!Ctx) return;
    const ctx = new Ctx();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination);
    o.type = 'sine'; o.frequency.value = 880;
    g.gain.setValueAtTime(0.0001, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.4);
    o.start();
    o.frequency.setValueAtTime(1320, ctx.currentTime + 0.18);
    o.stop(ctx.currentTime + 0.42);
    setTimeout(function(){ try{ ctx.close(); }catch(e){} }, 700);
  }catch(e){}
}

// تحديث حالة زر تفعيل التنبيهات في نافذة الإشعارات
function updateSysNotifBtn(){
  const btn = document.getElementById('sysNotifBtn');
  if(!btn) return;
  if(!notifSupported()){ btn.style.display = 'none'; return; }
  btn.style.display = '';
  // إذا كانت الإشعارات معطّلة من لوحة التحكم
  if(!NOTIF_ENABLED){
    btn.textContent = '🔕 الإشعارات معطّلة من لوحة التحكم';
    btn.classList.remove('on'); btn.classList.add('off');
    return;
  }
  const p = Notification.permission;
  btn.classList.remove('on','off');
  if(p === 'granted'){ btn.textContent = '🔔 تنبيهات النظام: مفعّلة'; btn.classList.add('on'); }
  else if(p === 'denied'){ btn.textContent = '🔕 محظورة — فعّلها من إعدادات المتصفح'; btn.classList.add('off'); }
  else { btn.textContent = '🔔 تفعيل تنبيهات النظام'; }
}
const MAX_NOTIFS = 50;        // حد أقصى

function addNotification(title, text, icon, orderId, subId){
  // أثناء وضع الصيانة: لا تُسجَّل ولا تظهر أي رسالة للمستخدمين (المدير مستثنى)
  if(typeof isMaintenanceBlocking==='function' && isMaintenanceBlocking()) return;
  const notif = {
    id: 'N-' + Date.now() + '-' + Math.random().toString(36).slice(2,6),
    title: title || '',
    text: text || '',
    icon: icon || '🛒',
    orderId: orderId || '',
    subId: subId || '',
    kind: (title && String(title).indexOf('طلب حساب جديد') !== -1) ? 'signup' : '',
    time: new Date().toLocaleString('ar'),
    ts: Date.now(),
    read: false
  };
  notifications.unshift(notif); // الأحدث أولاً
  if(notifications.length > MAX_NOTIFS) notifications = notifications.slice(0, MAX_NOTIFS);
  notifUnreadCount++;
  updateNotifBadge();
  renderNotifList();
  saveNotifLocal();
  // إظهار الإشعار في شريط إشعارات نظام الأندرويد (جسر أصلي) إن وُجد
  try{
    if(window.AndroidNotify && typeof window.AndroidNotify.notify === 'function'){
      window.AndroidNotify.notify(String(title || 'تنبيه'), String(text || ''), String(notif.id || ''));
    }
  }catch(e){}
}

function markAllNotifsRead(){
  notifications.forEach(n => n.read = true);
  notifUnreadCount = 0;
  updateNotifBadge();
  renderNotifList();
  saveNotifLocal();
}

function clearAllNotifs(){
  notifications = [];
  notifUnreadCount = 0;
  updateNotifBadge();
  renderNotifList();
  saveNotifLocal();
}

function updateNotifBadge(){
  const badge = document.getElementById('notifBadge');
  if(!badge) return;
  if(notifUnreadCount > 0){
    badge.textContent = notifUnreadCount > 99 ? '99+' : String(notifUnreadCount);
    badge.style.display = '';
  } else {
    badge.style.display = 'none';
  }
}

function renderNotifList(){
  const wrap = document.getElementById('notifList');
  if(!wrap) return;
  if(notifications.length === 0){
    wrap.innerHTML = '<div class="notif-empty">لا توجد إشعارات</div>';
    return;
  }
  wrap.innerHTML = notifications.map(n =>
    '<div class="notif-item' + (n.read ? '' : ' unread') + '" data-nid="' + esc(n.id) + '">' +
      '<span class="notif-icon">' + n.icon + '</span>' +
      '<div class="notif-body">' +
        '<div class="notif-title">' + esc(n.title) + '</div>' +
        '<div class="notif-text">' + esc(n.text) + '</div>' +
        '<span class="notif-time">' + esc(n.time) + '</span>' +
        (n.subId ?
          '<div class="notif-acts">' +
            '<button type="button" class="notif-act prev" data-prev="' + esc(n.subId) + '">👁️ معاينة</button>' +
            '<button type="button" class="notif-act appr" data-appr="' + esc(n.subId) + '">✔️ مصادقة</button>' +
          '</div>' : '') +
      '</div>' +
    '</div>'
  ).join('');
  // الضغط على إشعار يفتح تفاصيل الطلب إن وجد
  wrap.querySelectorAll('[data-prev]').forEach(b => {
    b.onclick = (ev) => {
      ev.stopPropagation();
      if(typeof window.__extPreviewSub === 'function') window.__extPreviewSub(b.dataset.prev);
    };
  });
  wrap.querySelectorAll('[data-appr]').forEach(b => {
    b.onclick = (ev) => {
      ev.stopPropagation();
      if(typeof window.__extApproveSub === 'function') window.__extApproveSub(b.dataset.appr);
    };
  });
  wrap.querySelectorAll('[data-nid]').forEach(el => {
    el.onclick = () => {
      const n = notifications.find(x => x.id === el.dataset.nid);
      if(n) n.read = true;
      notifUnreadCount = notifications.filter(x => !x.read).length;
      updateNotifBadge();
      renderNotifList();
      saveNotifLocal();
      // إشعار طلب حساب جديد: انتقل مباشرة إلى لوحة التحكم ← طلبات الحساب (تُطلب كلمة المرور)
      if(n && n.kind === 'signup'){
        const nm = document.getElementById('notifModal'); if(nm) nm.classList.remove('show');
        location.href = 'admin.html?tab=signups';
        return;
      }
      if(n && n.orderId){
        const o = (custOrdersCache || []).find(x => x.id === n.orderId);
        if(o) showOrderDetails(o);
        else {
          // حاول تحميل الطلبات إن لم تكن محمّلة
          DB.getOrders().then(orders => {
            custOrdersCache = orders || [];
            const o2 = custOrdersCache.find(x => x.id === n.orderId);
            if(o2) showOrderDetails(o2);
          }).catch(()=>{});
        }
      }
      document.getElementById('notifModal').classList.remove('show');
    };
  });
}

function saveNotifLocal(){
  try{ localStorage.setItem('pos_notifications', JSON.stringify(notifications)); }catch(e){}
  try{ localStorage.setItem('pos_notif_unread', String(notifUnreadCount)); }catch(e){}
}
function loadNotifLocal(){
  try{
    const raw = localStorage.getItem('pos_notifications');
    if(raw) notifications = JSON.parse(raw);
    notifUnreadCount = parseInt(localStorage.getItem('pos_notif_unread') || '0', 10) || 0;
  }catch(e){ notifications = []; notifUnreadCount = 0; }
}

function setupNotifModal(){
  const modal = document.getElementById('notifModal');
  if(!modal) return;
  document.getElementById('closeNotifModal').onclick = () => modal.classList.remove('show');
  modal.onclick = (e) => { if(e.target === modal) modal.classList.remove('show'); };
  document.getElementById('notifClearBtn').onclick = () => { clearAllNotifs(); };
  const sysBtn = document.getElementById('sysNotifBtn');
  if(sysBtn){
    sysBtn.onclick = () => {
      if(!NOTIF_ENABLED){ showToast('الإشعارات معطّلة — فعّلها من لوحة التحكم'); return; }
      if(!notifSupported()){ showToast('المتصفح لا يدعم تنبيهات النظام'); return; }
      if(Notification.permission === 'denied'){
        showToast('التنبيهات محظورة — فعّلها من إعدادات المتصفح للموقع');
        return;
      }
      requestNotifPermission();
    };
  }
  updateSysNotifBtn();
  document.getElementById('notifBtn').onclick = () => {
    markAllNotifsRead();
    modal.classList.add('show');
  };
}

// الاستماع للطلبات الجديدة من Firebase/localStorage
let lastKnownOrderIds = new Set();
let lastPrepById = {};        // id → آخر حالة تحضير معروفة
function listenForNewOrders(){
  DB.onOrders(function(orders){
    if(!orders || !orders.length) return;
    const currentIds = new Set(orders.map(o => o.id));
    // اكتشف الطلبات الجديدة (غير موجودة في المجموعة السابقة)
    const newOrders = orders.filter(o => !lastKnownOrderIds.has(o.id));
    if(lastKnownOrderIds.size > 0 && newOrders.length > 0){
      newOrders.forEach(o => {
        if(selfOrderIds.has(o.id)) return; // طلب أنشأه هذا الجهاز — نُبّه مسبقاً
        const label = orderNoLabel(o);
        const items = (o.items || []).map(it => it.name).join('، ');
        const body = (o.name || 'عميل') + ' · ' + (o.type||'') + ' · ' + payLabelOf(o) + (items ? ' · ' + items.slice(0, 60) : '');
        // المدير يرى الطلب الجديد "يحتاج تأكيد"؛ بقية المستخدمين "طلب جديد"
        if(isManagerUser() && prepOf(o) === 'pending'){
          addNotification('🕒 طلب يحتاج تأكيد ' + label, body, '🕒', o.id);
          systemNotify('🕒 طلب جديد يحتاج تأكيد ' + label, body);
        } else {
          addNotification('طلب جديد ' + label, body, '🔒', o.id);
          systemNotify('🔒 طلب جديد ' + label, body);
        }
        // تسجيل الوصول لتشغيل إضاءة لوحة الأسبوع / فتحها تلقائياً
        onWeeklyOrderArrived(o);
      });
    }
    // اكتشف تغيّر حالة التحضير (prep) على الطلبات القائمة
    if(Object.keys(lastPrepById).length > 0){
      orders.forEach(o => {
        const prev = lastPrepById[o.id];
        const now = prepOf(o);
        if(!now || prev === undefined || prev === now) return;
        const selfKey = o.id + ':' + now;
        if(selfPrepIds.has(selfKey)){ selfPrepIds.delete(selfKey); return; } // غيّره هذا الجهاز
        const label = orderNoLabel(o);
        if(now === 'confirmed'){
          addNotification('👨‍🍳 تم تأكيد الطلب ' + label, 'الطلب الآن قيد التنفيذ', '👨‍🍳', o.id);
          systemNotify('👨‍🍳 تم تأكيد الطلب ' + label, 'الطلب الآن قيد التنفيذ');
        } else if(now === 'ready'){
          addNotification('✅ الطلب جاهز ' + label, 'الطلب جاهز للتسليم', '✅', o.id);
          systemNotify('✅ الطلب جاهز ' + label, 'الطلب جاهز للتسليم');
        }
      });
    }
    lastKnownOrderIds = currentIds;
    const pmap = {}; orders.forEach(o => { pmap[o.id] = prepOf(o); }); lastPrepById = pmap;
  });
}

// ===== إشعارات طلبات النظام (مثل إنشاء حساب جديد) — تظهر للمدير =====
let lastSignupIds = new Set();
function listenForSystemRequests(){
  DB.onSignupRequests(function(list){
    if(!Array.isArray(list)) return;
    const currentIds = new Set(list.map(r => r.id));
    const newReqs = list.filter(r => !lastSignupIds.has(r.id) && r.status === 'pending');
    // لا ننبه قبل التحميل الأولي (لمعرفة الحالة السابقة)
    if(lastSignupIds.size > 0 && newReqs.length > 0 && isManagerUser()){
      newReqs.forEach(r => {
        const name = r.fullName || ((r.first||'') + ' ' + (r.second||''));
        addNotification('🆕 طلب حساب جديد', name + ' · ' + (r.city||'') + ' · جوال ' + (r.phone||''), '🆕', '');
        systemNotify('🆕 طلب حساب جديد', name + ' بانتظار موافقتك');
      });
      showToast('🆕 وصل طلب إنشاء حساب جديد');
    }
    lastSignupIds = currentIds;
  });
}

// ===== Init =====
function applySettings(cfg){
  if(!cfg) return;
  RESTAURANT = Object.assign({}, RESTAURANT, cfg);
  RESTAURANT.print = Object.assign({}, RESTAURANT.print, cfg.print || {});
  RESTAURANT.fonts = Object.assign({}, RESTAURANT.fonts, cfg.fonts || {});
  RESTAURANT.invoice = Object.assign({}, RESTAURANT.invoice, cfg.invoice || {});
  RESTAURANT.orderTypes = Object.assign({}, RESTAURANT.orderTypes, cfg.orderTypes || {});
  // تطبيق الخطوط العامة
  applyGlobalFonts(RESTAURANT.fonts);
  // تطبيق شكل النظام (قديم/جديد)
  try{ document.body.classList.toggle('ui-style-new', RESTAURANT.uiStyle === 'new'); }catch(e){}
  // تحديث عنوان الشاشة ونسبة الضريبة الظاهرة
  const vatLabel = document.getElementById('vatLabel');
  if(vatLabel) vatLabel.textContent = 'ضريبة القيمة المضافة (' + Math.round((RESTAURANT.vatRate||0)*100) + '%)';
  const brandName = document.getElementById('brandName');
  if(brandName && RESTAURANT.name) brandName.textContent = RESTAURANT.name;
  if(RESTAURANT.name) document.title = RESTAURANT.name + ' — الكاشير';
  // إظهار/إخفاء زر العربون حسب الإعدادات
  const depBtn = document.getElementById('depositBtn');
  if(depBtn) depBtn.style.display = (RESTAURANT.allowDeposit === false) ? 'none' : '';
  // إظهار/إخفاء زر قراءة كود QR حسب الإعدادات
  const qrBtn = document.getElementById('qrScanBtn');
  if(qrBtn) qrBtn.style.display = (RESTAURANT.qrEnabled === false) ? 'none' : '';
  // زر سجل الحركة: يظهر للمدير (ويمكن إخفاؤه لكل مستخدم من الصلاحيات)
  const logBtnEl = document.getElementById('activityLogBtn');
  if(logBtnEl) logBtnEl.style.display = (typeof isManagerUser==='function' && isManagerUser()) ? '' : 'none';
  // أزرار طوارئ النظام + الميزات الجديدة (للمدير فقط)
  try{
    var _isMgr = (typeof isManagerUser==='function' && isManagerUser());
    var _mb = document.getElementById('dashMaintBtn'); if(_mb) _mb.style.display = _isMgr ? '' : 'none';
    var _wn = document.getElementById('dashWhatsNewBtn'); if(_wn) _wn.style.display = _isMgr ? '' : 'none';
    var _up = document.getElementById('dashUpdateBtn'); if(_up) _up.style.display = _isMgr ? '' : 'none';
  }catch(e){}
  // تطبيق شاشة الصيانة + عرض الميزات الجديدة
  // نطبق الصيانة فقط بعد تسجيل الدخول أو نزيلها قبل الدخول
  try{ if(currentPosUser){ applyMaintenance(RESTAURANT.maintenance); } else { applyMaintenance({}); } }catch(e){}
  try{ if(currentPosUser) maybeShowWhatsNew(RESTAURANT.whatsNew); }catch(e){}
  try{ if(typeof maybeShowUpdate==='function' && currentPosUser) maybeShowUpdate(RESTAURANT.appUpdate); }catch(e){}
  // إظهار/إخفاء أزرار نوع الطلب (محلي/سفري/توصيل) حسب الإعدادات
  applyOrderTypeVisibility(RESTAURANT.orderTypes);
  // إظهار/إخفاء وحجم أزرار الواجهة (features.js)
  try{ if(typeof window.applyUiButtons==='function') window.applyUiButtons(RESTAURANT); }catch(e){}
  // مركز التحديث والترقية (updater.js): تحديث قائمة النسخ + تبويب المدير
  try{ if(typeof window.UpgradeCenter==='function' || (window.UpgradeCenter && typeof window.UpgradeCenter.refresh==='function')) window.UpgradeCenter.refresh(); }catch(e){}
  // تطبيق إعدادات الإشعارات
  NOTIF_ENABLED = (cfg.notifEnabled !== false);
  NOTIF_SOUND   = (cfg.notifSound !== false);
  updateSysNotifBtn();
  // وضع توفير البيانات (تقليل استهلاك Firebase)
  try{ if(window.DB && typeof DB.setDataSaver === 'function') DB.setDataSaver(!!RESTAURANT.dataSaver, RESTAURANT.dataSaverDays); }catch(e){}
  // جدولة الفتح التلقائي لطلبات الأسبوع في الأوقات المحددة
  scheduleWeeklyAutoOpen(RESTAURANT.weeklyAutoOpen === true, RESTAURANT.weeklyAutoOpenTimes);
  // إعدادات الفتح عند وصول طلب جديد + الإضاءة الزرقاء
  WEEKLY_CFG.onNewOrder  = (RESTAURANT.weeklyOnNewOrder === true);
  WEEKLY_CFG.glow        = (RESTAURANT.weeklyNewGlow !== false);   // مفعّل افتراضياً
  WEEKLY_CFG.glowMinutes = Math.min(60, Math.max(1, parseInt(RESTAURANT.weeklyGlowMinutes, 10) || 2));
  WEEKLY_CFG.stayOpen    = (RESTAURANT.weeklyStayOpen !== false);  // مفعّل افتراضياً
  WEEKLY_CFG.jumpToNew   = (RESTAURANT.weeklyJumpToNew !== false); // مفعّل افتراضياً
  WEEKLY_CFG.highlightMax= Math.min(100, Math.max(1, parseInt(RESTAURANT.weeklyHighlightMax, 10) || 20));
  // إعدادات شاشة تسجيل الدخول (خلفية/أزرار/دخول حيوي)
  try{ applyLoginScreenSettings(); refreshBioLoginBtn(); refreshBioEnrollBtn(); }catch(e){}
  renderTicket();
}

// ===== الفتح التلقائي لطلبات الأسبوع في أوقات محددة (لكل مستخدم) =====
let weeklyAutoTimer = null;
let weeklyAutoKeys = {};

function scheduleWeeklyAutoOpen(enabled, times){
  if(weeklyAutoTimer){ clearInterval(weeklyAutoTimer); weeklyAutoTimer = null; }
  if(!enabled) return;
  const list = (Array.isArray(times) ? times : []).filter(t => /^\d{1,2}:\d{2}$/.test(String(t || '').trim()));
  if(!list.length) return;
  function tick(){
    if(!currentPosUser) return;                 // لا مفاجآت قبل تسجيل الدخول
    if(weekModal && weekModal.classList.contains('show')) return;  // مفتوحة بالفعل
    const now = new Date();
    const hh = String(now.getHours()).padStart(2,'0');
    const mm = String(now.getMinutes()).padStart(2,'0');
    const hm = hh + ':' + mm;
    const day = now.toDateString();
    for(const t of list){
      const parts = String(t).split(':');
      const th = String(parseInt(parts[0],10)).padStart(2,'0');
      const tm = String(parseInt(parts[1],10)).padStart(2,'0');
      if(th + ':' + tm !== hm) continue;
      const key = day + ' ' + hm;
      if(weeklyAutoKeys[key]) break;            // نُفّذ مرة واحدة لهذا الوقت اليوم
      weeklyAutoKeys[key] = true;
      showToast('🗓️ فتح طلبات الأسبوع تلقائياً');
      openWeekBoard(false);
      break;
    }
  }
  weeklyAutoTimer = setInterval(tick, 20000);
  tick();
}

async function init(){
  registerServiceWorker();
  try{
    const cfg = await DB.getSettings();
    applySettings(cfg);
  }catch(e){ console.warn('تعذر تحميل الإعدادات:', e); }
  DB.onSettings(cfg => applySettings(cfg));

  try{
    const menu = await DB.getMenu();
    MENU = menu.filter(m => m.available !== false);
  }catch(e){
    console.error('فشل تحميل القائمة:', e);
    MENU = [];
  }
  rebuildCategories();
  renderCategories();
  renderCatalog();
  renderTicket();

  DB.onMenu(menu => {
    MENU = menu.filter(m => m.available !== false);
    rebuildCategories();
    renderCategories();
    renderCatalog();
  });

  setupPosLogin();
  setupSignupFlow();
  setupSearches();
  setupThemeModal();
  setupDepositModal();
  setupNotifModal();
  loadNotifLocal();
  updateNotifBadge();
  renderNotifList();
  restorePosSession();

  // تحميل الطلبات الحالية ثم الاستماع للجديدة
  try{
    const orders = await DB.getOrders();
    if(orders){
      lastKnownOrderIds = new Set(orders.map(o => o.id));
      const pmap = {}; orders.forEach(o => { pmap[o.id] = prepOf(o); }); lastPrepById = pmap;
    }
  }catch(e){}
  listenForNewOrders();
  listenForSystemRequests();
}
init();

/* =====================================================================
   استمارة عميل جديد — يُنشئها المستخدم وتُحوَّل إلى طلب بعد المصادقة
   تعمل بالكامل حسب إعدادات لوحة التحكم (RESTAURANT.custForm)
   ===================================================================== */
(function(){
  var cfForms=[], cfSel={}, cfTheme=false,
      cfDeposit=false, cfDepType='إيداع', cfHasWa=false, cdTimer=null, cfToken='';

  function cfg(){
    var c=(RESTAURANT&&RESTAURANT.custForm)?RESTAURANT.custForm:{};
    return {
      enabled:c.enabled!==false,
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
  function meId(){ return (typeof currentPosUser!=='undefined'&&currentPosUser)?(currentPosUser.username||currentPosUser.name||''):''; }
  function meName(){ return (typeof currentPosUser!=='undefined'&&currentPosUser)?(currentPosUser.name||currentPosUser.username||''):''; }

  var hub=document.getElementById('acctReqModal');
  var hubList=document.getElementById('acctReqList');
  var fm=document.getElementById('custFormModal');
  var fmBody=document.getElementById('custFormBody');
  var fmFoot=document.getElementById('custFormFoot');
  var badge=document.getElementById('acctReqBadge');
  function show(m){ if(m) m.classList.add('show'); }
  function hide(m){ if(m) m.classList.remove('show'); }

  function markExpired(){
    var now=Date.now(), changed=false;
    cfForms.forEach(function(f){
      if(f.status==='pending' && f.expiresAt && now>f.expiresAt){
        f.status='expired'; changed=true;
        try{ DB.updateCustForm(f.id,{status:'expired'}); }catch(e){}
      }
    });
    return changed;
  }
  function myPending(){
    var now=Date.now(), id=meId();
    return cfForms.filter(function(f){ return f.createdBy===id && f.status==='pending' && (!f.expiresAt||now<f.expiresAt); });
  }
  function updateBadge(){
    if(!badge) return;
    var n=myPending().length;
    if(n>0){ badge.textContent=n>99?'99+':String(n); badge.style.display=''; }
    else badge.style.display='none';
  }
  function fmt(ms){
    if(ms<=0) return 'انتهت';
    var h=Math.floor(ms/3600000), m=Math.floor((ms%3600000)/60000);
    if(h>0) return h+' س '+m+' د';
    var s=Math.floor((ms%60000)/1000);
    return m+' د '+s+' ث';
  }

  var openBtn=document.getElementById('dashAcctReqBtn');
  if(openBtn) openBtn.onclick=function(){
    if(!cfg().enabled){ showToast('ميزة الاستمارة غير مفعّلة من لوحة التحكم'); return; }
    renderHub(); show(hub);
  };
  var hubClose=document.getElementById('acctReqClose');
  if(hubClose) hubClose.onclick=function(){ hide(hub); };
  var fmCloseBtn=document.getElementById('custFormClose');
  if(fmCloseBtn) fmCloseBtn.onclick=function(){ hide(fm); };
  [hub,fm].forEach(function(m){ if(m) m.addEventListener('click',function(e){ if(e.target===m) hide(m); }); });
  var newBtn=document.getElementById('newCustFormBtn');
  if(newBtn) newBtn.onclick=function(){ openForm(); };

  function openForm(){
    var c=cfg();
    cfSel={}; cfTheme=false; cfDeposit=false; cfDepType='إيداع'; cfHasWa=false;
    // توليد رمز موحّد ثابت لهذه الاستمارة منذ لحظة الإنشاء
    cfToken=(typeof DB!=='undefined' && DB.genToken) ? DB.genToken() : ('f'+Date.now().toString(36)+Math.random().toString(36).slice(2,10));
    var exchanges=(RESTAURANT&&Array.isArray(RESTAURANT.exchanges))?RESTAURANT.exchanges:[];
    var html='';
    // نص تمهيدي اختياري أعلى الاستمارة
    if(c.introText){ html+='<div class="cfm-intro" style="background:#eff6ff;border:1px solid #bfdbfe;color:#1e40af;border-radius:12px;padding:10px 12px;font-size:13.5px;margin-bottom:12px;line-height:1.6">'+esc(c.introText).replace(/\n/g,'<br>')+'</div>'; }
    html+='<div class="cfm-sec"><h4>🧾 أصناف الطلب</h4>';
    if(!MENU.length){ html+='<div class="cfm-items" id="cfItems"><div class="cfm-empty">لا توجد أصناف في القائمة</div></div></div>'; }
    else {
      // تجميع حسب التصنيف (قوائم منسدلة + بحث)
      var grp={}, cats=[];
      MENU.forEach(function(m){ var cat=((m.cat||'').toString().trim())||'أصناف أخرى'; if(!grp[cat]){ grp[cat]=[]; cats.push(cat); } grp[cat].push(m); });
      html+='<div class="cfm-field" style="margin-bottom:10px"><input class="cfm-input" id="cfItemSearch" placeholder="🔍 ابحث عن صنف…"></div>';
      html+='<div id="cfItems">';
      cats.forEach(function(cat,ci){
        html+='<details class="cf-catgrp"'+(ci===0?' open':'')+' style="margin-bottom:8px;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">'+
          '<summary style="padding:9px 12px;font-weight:700;font-size:14px;background:#f1f5f9;cursor:pointer;">'+esc(cat)+' <span style="color:#64748b;font-weight:400">('+grp[cat].length+')</span></summary>'+
          '<div style="padding:8px">';
        grp[cat].forEach(function(m){
          var mid=esc(String(m.id));
          html+='<div class="cfm-item" data-id="'+mid+'" data-name="'+esc((m.name||'').toLowerCase())+'">'+
            '<span class="ci-emo">'+(m.emoji||'🍽️')+'</span>'+
            '<span class="ci-info"><span class="ci-name">'+esc(m.name)+'</span><br><span class="ci-price">'+money(m.price)+'</span></span>'+
            '<span class="cfm-step"><button type="button" class="minus" data-id="'+mid+'">−</button>'+
            '<span class="q" id="q_'+mid+'">'+(cfSel[mid]||0)+'</span>'+
            '<button type="button" class="plus" data-id="'+mid+'">+</button></span></div>';
        });
        html+='</div></details>';
      });
      html+='</div></div>';
    }
    if(c.askName||c.askPhone||c.askWhatsapp){
      html+='<div class="cfm-sec"><h4>👤 بيانات العميل</h4>';
      if(c.askName) html+='<div class="cfm-field"><label>اسم العميل'+(c.nameRequired?' <span class="req">*</span>':'')+'</label><input class="cfm-input" id="cfName" maxlength="60" placeholder="اسم العميل"></div>';
      if(c.askPhone) html+='<div class="cfm-field"><label>رقم الجوال'+(c.phoneRequired?' <span class="req">*</span>':'')+'</label><input class="cfm-input" id="cfPhone" inputmode="tel" maxlength="20" placeholder="05xxxxxxxx"></div>';
      if(c.askWhatsapp) html+='<label class="cfm-check"><input type="checkbox" id="cfWa"> لدى العميل واتساب</label>';
      html+='</div>';
    }
    if(c.askDeposit){
      html+='<div class="cfm-sec"><h4>💳 الدفع</h4>'+
        '<label class="cfm-check"><input type="checkbox" id="cfDep"> إيداع أو حوالة (بدل النقد)</label>'+
        '<div id="cfDepWrap" style="display:none;margin-top:10px">'+
        '<div class="cfm-row" id="cfDepTypeRow"><button type="button" class="cfm-chip on" data-t="إيداع">إيداع</button><button type="button" class="cfm-chip" data-t="حوالة">حوالة</button></div>';
      if(exchanges.length){
        html+='<div class="cfm-field" style="margin-top:10px"><label>الصرّاف</label><select class="cfm-input" id="cfEx">';
        exchanges.forEach(function(e,i){ html+='<option value="'+i+'">'+esc(e.name)+'</option>'; });
        html+='</select></div>';
      }
      html+='</div></div>';
    }
    if(c.askTheme){
      html+='<div class="cfm-sec"><h4>🎁 الثيم</h4>'+
        '<div class="cfm-row"><button type="button" class="cfm-chip on" id="cfNoTheme">بدون ثيم</button><button type="button" class="cfm-chip" id="cfYesTheme">مع ثيم</button></div>'+
        '<div id="cfThemeWrap" style="display:none;margin-top:10px">'+
        '<div class="cfm-field"><label>المناسبة</label><select class="cfm-input" id="cfOcc"><option value="">— اختر —</option>';
      c.occasions.forEach(function(o){ html+='<option value="'+esc(o)+'">'+esc(o)+'</option>'; });
      html+='</select></div>'+
        '<div class="cfm-field"><label>نص الثيم (اختياري)</label><input class="cfm-input" id="cfTxt" maxlength="80" placeholder="مثال: اسم المحتفى به"></div>'+
        '</div></div>';
    }
    if(c.askPickup){
      html+='<div class="cfm-sec"><h4>📅 موعد الاستلام</h4>'+
        '<div class="cfm-field"><label>التاريخ</label><input type="date" class="cfm-input" id="cfPDate"></div>'+
        '<div class="cfm-field"><label>الوقت</label><input type="time" class="cfm-input" id="cfPTime"></div></div>';
    }
    if(c.extraFields.length){
      html+='<div class="cfm-sec"><h4>📝 خانات إضافية</h4>';
      c.extraFields.forEach(function(f,i){
        var fid='cfx_'+i;
        html+='<div class="cfm-field"><label>'+esc(f.label||('خانة '+(i+1)))+(f.required?' <span class="req">*</span>':'')+'</label>';
        if(f.type==='textarea') html+='<textarea class="cfm-input" id="'+fid+'" rows="2"></textarea>';
        else if(f.type==='number') html+='<input type="number" class="cfm-input" id="'+fid+'">';
        else html+='<input type="text" class="cfm-input" id="'+fid+'" maxlength="120">';
        html+='</div>';
      });
      html+='</div>';
    }
    // اسم المنشئ في نهاية الاستمارة
    if(c.showCreator && meName()){
      html+='<div class="cfm-sec" style="text-align:center;color:#64748b;font-size:13px;border-top:1px dashed #cbd5e1;padding-top:10px">👤 أنشأ الاستمارة: '+esc(meName())+'</div>';
    }
    fmBody.innerHTML=html;
    fmFoot.innerHTML='<button type="button" class="cfm-btn ghost" id="cfPrevBtn">👁️ معاينة</button>'+
      '<button type="button" class="cfm-btn ok" id="cfSendBtn">📨 إرسال الاستمارة</button>';
    var ttl=document.getElementById('custFormTitle'); if(ttl) ttl.textContent='➕ استمارة عميل جديد';
    wireForm();
    show(fm);
  }

  function wireForm(){
    fmBody.querySelectorAll('.cfm-step .plus').forEach(function(b){ b.onclick=function(){ step(b.dataset.id,1); }; });
    fmBody.querySelectorAll('.cfm-step .minus').forEach(function(b){ b.onclick=function(){ step(b.dataset.id,-1); }; });
    var dep=document.getElementById('cfDep');
    if(dep) dep.onchange=function(){ cfDeposit=dep.checked; var w=document.getElementById('cfDepWrap'); if(w) w.style.display=dep.checked?'':'none'; };
    var dt=document.getElementById('cfDepTypeRow');
    if(dt) dt.querySelectorAll('.cfm-chip').forEach(function(ch){ ch.onclick=function(){ dt.querySelectorAll('.cfm-chip').forEach(function(x){x.classList.remove('on');}); ch.classList.add('on'); cfDepType=ch.dataset.t; }; });
    var noT=document.getElementById('cfNoTheme'), yesT=document.getElementById('cfYesTheme');
    if(noT&&yesT){
      noT.onclick=function(){ cfTheme=false; noT.classList.add('on'); yesT.classList.remove('on'); var w=document.getElementById('cfThemeWrap'); if(w) w.style.display='none'; };
      yesT.onclick=function(){ cfTheme=true; yesT.classList.add('on'); noT.classList.remove('on'); var w=document.getElementById('cfThemeWrap'); if(w) w.style.display=''; };
    }
    var pv=document.getElementById('cfPrevBtn'); if(pv) pv.onclick=function(){ preview(); };
    var sb=document.getElementById('cfSendBtn'); if(sb) sb.onclick=function(){ submit(); };
    // بحث الأصناف ضمن القوائم المنسدلة
    var srch=document.getElementById('cfItemSearch');
    if(srch) srch.oninput=function(){
      var q=(srch.value||'').trim().toLowerCase();
      fmBody.querySelectorAll('.cf-catgrp').forEach(function(g){
        var any=false;
        g.querySelectorAll('.cfm-item').forEach(function(it){
          var match=!q || (it.getAttribute('data-name')||'').indexOf(q)>-1;
          it.style.display=match?'':'none';
          if(match) any=true;
        });
        g.style.display=any?'':'none';
        if(q&&any) g.open=true;
      });
    };
  }
  function step(id,d){
    var cur=cfSel[id]||0; cur+=d; if(cur<0) cur=0;
    if(cur===0) delete cfSel[id]; else cfSel[id]=cur;
    var q=document.getElementById('q_'+id); if(q) q.textContent=String(cfSel[id]||0);
    var row=fmBody.querySelector('.cfm-item[data-id="'+(window.CSS&&CSS.escape?CSS.escape(String(id)):String(id))+'"]');
    if(row) row.classList.toggle('sel',(cfSel[id]||0)>0);
  }
  function collect(){
    var c=cfg(), items=[];
    Object.keys(cfSel).forEach(function(id){
      var m=MENU.find(function(x){ return String(x.id)===String(id); });
      if(m) items.push({id:m.id,name:m.name,price:m.price,emoji:m.emoji,qty:cfSel[id],wrapped:!!m.wrapped});
    });
    var name=((document.getElementById('cfName')||{}).value||'').trim();
    var phone=((document.getElementById('cfPhone')||{}).value||'').trim();
    var wa=document.getElementById('cfWa'); cfHasWa=!!(wa&&wa.checked);
    var exSel=document.getElementById('cfEx'), ex=null;
    if(cfDeposit && exSel){ var arr=(RESTAURANT&&RESTAURANT.exchanges)||[]; ex=arr[parseInt(exSel.value,10)]||null; }
    var occ=(document.getElementById('cfOcc')||{}).value||'';
    var txt=((document.getElementById('cfTxt')||{}).value||'').trim();
    var pDate=(document.getElementById('cfPDate')||{}).value||'';
    var pTime=(document.getElementById('cfPTime')||{}).value||'';
    var extra={};
    c.extraFields.forEach(function(f,i){ var el=document.getElementById('cfx_'+i); if(el) extra[f.label||('خانة '+(i+1))]=(el.value||'').trim(); });
    return {items:items,name:name,phone:phone,hasWa:cfHasWa,deposit:cfDeposit,depType:cfDepType,ex:ex,theme:cfTheme,occ:occ,txt:txt,pDate:pDate,pTime:pTime,extra:extra,c:c};
  }
  function totals(items){
    var sub=0; items.forEach(function(i){ sub+=i.price*i.qty; });
    var rate=(RESTAURANT&&RESTAURANT.vatRate)||0;
    var vat=Math.round(sub*rate*100)/100;
    return {subtotal:Math.round(sub*100)/100,vat:vat,total:Math.round((sub+vat)*100)/100};
  }
  function validate(d){
    if(!d.items.length){ showToast('اختر صنفاً واحداً على الأقل'); return false; }
    if(d.c.askName&&d.c.nameRequired&&!d.name){ showToast('أدخل اسم العميل'); return false; }
    if(d.c.askPhone&&d.c.phoneRequired&&!d.phone){ showToast('أدخل رقم الجوال'); return false; }
    var bad=false;
    d.c.extraFields.forEach(function(f){ if(f.required){ var k=f.label||''; if(!d.extra[k]) bad=true; } });
    if(bad){ showToast('أكمل الخانات الإلزامية'); return false; }
    return true;
  }
  function summaryHtml(d){
    var t=totals(d.items), h='<div class="cfm-preview">';
    h+='<b>العميل:</b> '+(esc(d.name)||'—')+'<br>';
    if(d.c.askPhone) h+='<b>الجوال:</b> '+(esc(d.phone)||'—')+(d.hasWa?' ✅ واتساب':'')+'<br>';
    h+='<hr style="border:none;border-top:1px dashed #cbd5e1;margin:6px 0">';
    d.items.forEach(function(i){ h+='<div class="cfm-prev-row"><span>'+(i.emoji||'')+' '+esc(i.name)+' ×'+i.qty+'</span><span>'+money(i.price*i.qty)+'</span></div>'; });
    h+='<div class="cfm-prev-row"><span>الإجمالي الفرعي</span><span>'+money(t.subtotal)+'</span></div>';
    h+='<div class="cfm-prev-row"><span>الضريبة</span><span>'+money(t.vat)+'</span></div>';
    h+='<div class="cfm-prev-total">الإجمالي: '+money(t.total)+'</div>';
    if(d.deposit) h+='<br><b>الدفع:</b> '+esc(d.depType)+(d.ex?(' — '+esc(d.ex.name)):'');
    else h+='<br><b>الدفع:</b> نقدي';
    if(d.theme) h+='<br><b>الثيم:</b> مع ثيم'+(d.occ?(' — '+esc(d.occ)):'')+(d.txt?(' — '+esc(d.txt)):'');
    if(d.pDate||d.pTime) h+='<br><b>الاستلام:</b> '+esc(d.pDate)+' '+esc(d.pTime);
    Object.keys(d.extra).forEach(function(k){ if(d.extra[k]) h+='<br><b>'+esc(k)+':</b> '+esc(d.extra[k]); });
    h+='</div>';
    return h;
  }
  function preview(){
    var d=collect(); if(!validate(d)) return;
    Array.prototype.forEach.call(fmBody.children,function(ch){ ch.style.display='none'; });
    var pv=document.createElement('div'); pv.id='cfPrevBox'; pv.innerHTML=summaryHtml(d);
    fmBody.appendChild(pv);
    fmFoot.innerHTML='<button type="button" class="cfm-btn ghost" id="cfBackBtn">↩️ رجوع للتعديل</button>'+
      '<button type="button" class="cfm-btn ok" id="cfSend2">📨 تأكيد وإرسال</button>';
    document.getElementById('cfBackBtn').onclick=function(){ pv.remove(); Array.prototype.forEach.call(fmBody.children,function(ch){ ch.style.display=''; }); fmFoot.innerHTML='<button type="button" class="cfm-btn ghost" id="cfPrevBtn">👁️ معاينة</button><button type="button" class="cfm-btn ok" id="cfSendBtn">📨 إرسال الاستمارة</button>'; wireForm(); };
    document.getElementById('cfSend2').onclick=function(){ submit(d); };
  }

  async function submit(d){
    if(!d||!d.items){ d=collect(); if(!validate(d)) return; }
    var c=cfg(), t=totals(d.items), now=Date.now();
    if(!cfToken){ cfToken=(typeof DB!=='undefined' && DB.genToken) ? DB.genToken() : ('f'+Date.now().toString(36)+Math.random().toString(36).slice(2,10)); }
    var form={
      token:cfToken,
      createdBy:meId(), createdByName:meName(),
      name:d.name||'عميل', phone:d.phone||'', hasWa:!!d.hasWa,
      items:d.items.map(function(i){ return {name:i.name,price:i.price,qty:i.qty,emoji:i.emoji,wrapped:!!i.wrapped}; }),
      subtotal:t.subtotal, vat:t.vat, total:t.total,
      deposit:!!d.deposit, depType:d.deposit?d.depType:'',
      exName:d.ex?d.ex.name:'', exColor:d.ex?d.ex.color:'',
      theme:!!d.theme, occ:d.theme?d.occ:'', txt:d.theme?d.txt:'',
      pickupDate:d.pDate||'', pickupTime:d.pTime||'',
      extra:d.extra||{},
      status:'pending', createdAt:now, expiresAt:now + c.validHours*3600000
    };
    try{
      var saved=await DB.addCustForm(form);
      form.token=(saved&&saved.token)||form.token;
      try{ addNotification('استمارة عميل جديدة','تم إنشاء استمارة لـ "'+form.name+'" — اضغط "مصادقة وتحويل كطلب" لإتمامها','🆕'); }catch(e){}
      showToast('✅ تم إنشاء الاستمارة — بانتظار المصادقة');
      shareView(form);
    }catch(e){ showToast('تعذّر حفظ الاستمارة'); }
  }
  // ===== عرض المشاركة: تظهر الاستمارة وهي تحمل رمز QR الموحّد + 3 أزرار =====
  function brandName(){ return (RESTAURANT&&(RESTAURANT.headerBrand||RESTAURANT.name))||'المتجر'; }
  function trackUrlOf(form){ return (typeof orderTrackUrl==='function')?orderTrackUrl(form.token):''; }
  function qrOf(form, cell){ return (typeof qrDataUrl==='function')?qrDataUrl(trackUrlOf(form), cell||5, 6):''; }

  // بطاقة مكتفية ذاتياً بالألوان (RTL) — تحوي كل بيانات الاستمارة والرمز والمنشئ ورقم الطلب
  function buildShareCard(form){
    var qr=qrOf(form, 5);
    var rows='';
    (form.items||[]).forEach(function(i){ rows+='<div style="display:flex;justify-content:space-between;gap:8px;padding:3px 0;font-size:13.5px;color:#0f172a;"><span>'+(i.emoji||'')+' '+esc(i.name)+' ×'+i.qty+'</span><span style="font-weight:700;">'+money((i.price||0)*(i.qty||0))+'</span></div>'; });
    var approved=(form.status==='approved');
    var h=''+
    '<div id="cfShareCard" dir="rtl" style="font-family:\'Segoe UI\',Tahoma,sans-serif;background:#ffffff;color:#0f172a;border:1px solid #e2e8f0;border-radius:16px;padding:16px;max-width:380px;margin:0 auto;line-height:1.7;">'+
      '<div style="text-align:center;border-bottom:2px solid #1e3a8a;padding-bottom:8px;margin-bottom:10px;">'+
        '<div style="font-size:19px;font-weight:800;color:#1e3a8a;">'+esc(brandName())+'</div>'+
        '<div style="font-size:12.5px;color:#64748b;">استمارة عميل</div>'+
      '</div>'+
      '<div style="text-align:center;margin:8px 0;">'+
        (qr?'<img src="'+qr+'" alt="QR" style="width:150px;height:150px;image-rendering:pixelated;background:#fff;padding:8px;border:1px solid #e2e8f0;border-radius:12px;" />':'')+
        '<div style="font-size:11.5px;color:#64748b;margin-top:4px;">🔳 امسح الرمز لتتبّع حالة طلبك</div>'+
      '</div>'+
      '<div style="background:#f8fafc;border-radius:12px;padding:10px 12px;">'+
        '<div style="font-size:14px;"><b>العميل:</b> '+(esc(form.name)||'—')+'</div>'+
        (form.phone?'<div style="font-size:13.5px;"><b>الجوال:</b> '+esc(form.phone)+(form.hasWa?' ✅ واتساب':'')+'</div>':'')+
        '<div style="border-top:1px dashed #cbd5e1;margin:7px 0;"></div>'+
        rows+
        '<div style="display:flex;justify-content:space-between;font-size:13px;color:#475569;"><span>الإجمالي الفرعي</span><span>'+money(form.subtotal||0)+'</span></div>'+
        ((Number(form.vat)||0)>0?'<div style="display:flex;justify-content:space-between;font-size:13px;color:#475569;"><span>الضريبة</span><span>'+money(form.vat||0)+'</span></div>':'')+
        '<div style="display:flex;justify-content:space-between;font-size:15px;font-weight:800;color:#1e3a8a;border-top:1px solid #e2e8f0;margin-top:6px;padding-top:6px;"><span>الإجمالي</span><span>'+money(form.total||0)+'</span></div>'+
        (form.deposit?'<div style="font-size:13px;margin-top:5px;"><b>الدفع:</b> '+esc(form.depType||'إيداع')+(form.exName?(' — '+esc(form.exName)):'')+'</div>':'')+
        (form.theme?'<div style="font-size:13px;"><b>الثيم:</b> مع ثيم'+(form.occ?(' — '+esc(form.occ)):'')+(form.txt?(' — '+esc(form.txt)):'')+'</div>':'')+
        ((form.pickupDate||form.pickupTime)?'<div style="font-size:13px;"><b>الاستلام:</b> '+esc(form.pickupDate||'')+' '+esc(form.pickupTime||'')+'</div>':'')+
      '</div>'+
      (approved&&form.orderNo?'<div style="text-align:center;background:#dcfce7;color:#166534;border-radius:10px;padding:6px;margin-top:9px;font-size:13.5px;font-weight:700;">✅ تحوّلت للطلب #'+esc(form.orderNo)+'</div>':'<div style="text-align:center;background:#fef3c7;color:#92400e;border-radius:10px;padding:6px;margin-top:9px;font-size:13px;font-weight:700;">⏳ بانتظار المصادقة</div>')+
      (form.createdByName?'<div style="text-align:center;color:#64748b;font-size:12px;margin-top:8px;border-top:1px dashed #cbd5e1;padding-top:7px;">👤 أنشأ الاستمارة: '+esc(form.createdByName)+'</div>':'')+
    '</div>';
    return h;
  }

  function shareView(form){
    var ttl=document.getElementById('custFormTitle'); if(ttl) ttl.textContent='🔗 الاستمارة جاهزة — شاركها';
    fmBody.innerHTML=buildShareCard(form);
    fmFoot.innerHTML=
      '<button type="button" class="cfm-btn ghost" id="cfDoneBtn">✔ تمام</button>'+
      '<button type="button" class="cfm-btn" id="cfPngBtn" style="background:#0ea5e9;color:#fff;">🖼️ حفظ صورة</button>'+
      '<button type="button" class="cfm-btn" id="cfSendImgBtn" style="background:#16a34a;color:#fff;">📤 إرسال</button>'+
      '<button type="button" class="cfm-btn ok" id="cfShareLinkBtn">🔗 مشاركة رابط</button>';
    document.getElementById('cfDoneBtn').onclick=function(){ hide(fm); renderHub(); show(hub); };
    document.getElementById('cfPngBtn').onclick=function(){ savePng(form); };
    document.getElementById('cfSendImgBtn').onclick=function(){ sendForm(form); };
    document.getElementById('cfShareLinkBtn').onclick=function(){ shareLink(form); };
    show(fm);
  }

  // تحميل html2canvas عند الحاجة
  function ensureH2C(cb){
    if(typeof html2canvas!=='undefined'){ cb(true); return; }
    var s=document.createElement('script');
    s.src='https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js';
    s.onload=function(){ cb(typeof html2canvas!=='undefined'); };
    s.onerror=function(){ cb(false); };
    document.head.appendChild(s);
  }
  function renderCardCanvas(cb){
    var card=document.getElementById('cfShareCard');
    if(!card){ cb(null); return; }
    ensureH2C(function(ok){
      if(!ok){ cb(null); return; }
      html2canvas(card,{backgroundColor:'#ffffff',scale:2,useCORS:true,logging:false}).then(function(cv){ cb(cv); }).catch(function(){ cb(null); });
    });
  }
  function savePng(form){
    showToast('… جارٍ تجهيز الصورة');
    renderCardCanvas(function(cv){
      if(!cv){ showToast('تعذّر إنشاء الصورة'); return; }
      try{
        var url=cv.toDataURL('image/png');
        var a=document.createElement('a');
        a.href=url; a.download='استمارة-'+((form.name||'عميل').replace(/\s+/g,'_'))+(form.orderNo?('-طلب'+form.orderNo):'')+'.png';
        document.body.appendChild(a); a.click(); a.remove();
        showToast('✅ تم حفظ الصورة');
      }catch(e){ showToast('تعذّر حفظ الصورة'); }
    });
  }
  function sendForm(form){
    var link=trackUrlOf(form);
    showToast('… جارٍ تجهيز الإرسال');
    renderCardCanvas(function(cv){
      if(cv && cv.toBlob && navigator.canShare){
        cv.toBlob(function(blob){
          try{
            var file=new File([blob],'form.png',{type:'image/png'});
            if(navigator.canShare({files:[file]})){
              navigator.share({files:[file],title:'استمارة '+(form.name||''),text:'استمارة طلبك — تتبّع: '+link}).catch(function(){});
              return;
            }
          }catch(e){}
          sendFallback(form, cv, link);
        },'image/png');
      }else{
        sendFallback(form, cv, link);
      }
    });
  }
  function sendFallback(form, cv, link){
    // مشاركة رابط نصياً إن توفرت، وإلا بديل تنزيل الصورة
    if(navigator.share){
      navigator.share({title:'استمارة '+(form.name||''),text:'تتبّع طلبك',url:link}).catch(function(){ dlCanvas(form, cv); });
    }else{
      dlCanvas(form, cv);
      showToast('⬇️ تم تنزيل الصورة — أرسلها للعميل');
    }
  }
  function dlCanvas(form, cv){
    if(!cv){ return; }
    try{
      var a=document.createElement('a'); a.href=cv.toDataURL('image/png');
      a.download='استمارة-'+((form.name||'عميل').replace(/\s+/g,'_'))+'.png';
      document.body.appendChild(a); a.click(); a.remove();
    }catch(e){}
  }
  function shareLink(form){
    var link=trackUrlOf(form);
    if(!link){ showToast('تعذّر تجهيز الرابط'); return; }
    var msg='رابط تتبّع طلبك من '+brandName()+':\n'+link;
    if(navigator.share){
      navigator.share({title:'تتبّع الطلب',text:msg,url:link}).catch(function(){ copyText(link); });
    }else{ copyText(link); }
  }
  function copyText(txt){
    try{
      if(navigator.clipboard && navigator.clipboard.writeText){
        navigator.clipboard.writeText(txt).then(function(){ showToast('📋 تم نسخ الرابط'); }).catch(function(){ legacyCopy(txt); });
      }else legacyCopy(txt);
    }catch(e){ legacyCopy(txt); }
  }
  function legacyCopy(txt){
    try{
      var ta=document.createElement('textarea'); ta.value=txt; ta.style.position='fixed'; ta.style.opacity='0';
      document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove();
      showToast('📋 تم نسخ الرابط');
    }catch(e){ showToast('انسخ الرابط يدوياً'); }
  }

  async function approve(form){
    if(form.status!=='pending'){ showToast('هذه الاستمارة غير صالحة'); return; }
    if(form.expiresAt && Date.now()>form.expiresAt){ showToast('انتهت صلاحية الاستمارة'); markExpired(); renderHub(); return; }
    if(!confirm('تحويل استمارة "'+form.name+'" إلى طلب فعلي وإرساله لكل الحسابات؟')) return;
    var orderNo=0; try{ orderNo=await DB.nextOrderNo(); }catch(e){ orderNo=0; }
    var pay=form.deposit?'card':'cash';
    var order={
      id:'INV-'+Date.now(), orderNo:orderNo,
      cashier:form.createdByName||meName(),
      name:form.name||'عميل', phone:form.phone||'', address:'',
      type:'محلي', pay:pay,
      depositType: form.deposit?(form.depType||'إيداع'):'',
      exchangeName: form.deposit?(form.exName||''):'',
      exchangeColor: form.deposit?(form.exColor||''):'',
      items:(form.items||[]).map(function(i){ return {name:i.name,price:i.price,qty:i.qty,emoji:i.emoji,wrapped:!!i.wrapped}; }),
      subtotal:form.subtotal, vat:form.vat, total:form.total,
      paid:form.total, change:0, remaining:0, payStatus:'paid',
      pickupDate:form.pickupDate||'', pickupTime:form.pickupTime||'',
      hasWrapped:(form.items||[]).some(function(i){ return i.wrapped; }),
      theme:!!form.theme,
      themeData: form.theme?{occasion:form.occ||'',customText:form.txt||''}:false,
      hasWa:!!form.hasWa, extra:form.extra||{},
      fromCustForm:true, custFormId:form.id, formToken:form.token||'',
      status:'done', prep:'pending',
      createdAt:Date.now(), date:new Date().toLocaleString('ar')
    };
    try{
      await DB.addOrder(order);
      await DB.updateCustForm(form.id,{status:'approved',orderNo:orderNo,approvedAt:Date.now()});
      try{ addNotification('تم تحويل الاستمارة إلى طلب','طلب رقم '+orderNo+' — '+order.name,'✅',order.id); }catch(e){}
      showToast('✅ تم التحويل إلى طلب رقم '+orderNo);
      renderHub();
    }catch(e){ showToast('تعذّر التحويل إلى طلب'); }
  }
  async function removeForm(id){
    if(!confirm('حذف هذه الاستمارة؟')) return;
    try{ await DB.deleteCustForm(id); renderHub(); }catch(e){}
  }
  function renderHub(){
    if(!hubList) return;
    markExpired();
    var id=meId();
    var mine=cfForms.filter(function(f){ return f.createdBy===id; }).sort(function(a,b){ return (b.createdAt||0)-(a.createdAt||0); });
    if(!mine.length){ hubList.innerHTML='<div class="cfm-empty">لا توجد استمارات بعد — اضغط «استمارة عميل جديد»</div>'; updateBadge(); return; }
    var now=Date.now(), h='';
    mine.forEach(function(f){
      var expired=(f.status==='expired')||(f.status==='pending'&&f.expiresAt&&now>f.expiresAt);
      var st=f.status==='approved'?'approved':(expired?'expired':'pending');
      var tag=st==='approved'?('<span class="cfm-tag approved">✅ تحوّلت لطلب'+(f.orderNo?(' #'+f.orderNo):'')+'</span>'):(st==='expired'?'<span class="cfm-tag expired">⌛ منتهية</span>':'<span class="cfm-tag pending">⏳ بانتظار المصادقة</span>');
      h+='<div class="cfm-card'+(expired?' expired':'')+'">'+
        '<div class="cc-top"><span class="cc-name">'+esc(f.name||'عميل')+'</span>'+tag+'</div>'+
        '<div class="cc-meta">'+(f.phone?('📞 '+esc(f.phone)+(f.hasWa?' ✅':'')+' · '):'')+'🧾 '+((f.items&&f.items.length)||0)+' صنف · 💰 '+money(f.total||0)+(f.theme?(' · 🎁 '+(esc(f.occ)||'ثيم')):'')+'<br>';
      if(st==='pending' && f.expiresAt){ h+='⏱️ تنتهي خلال <span class="cfm-countdown" data-exp="'+f.expiresAt+'">'+fmt(f.expiresAt-now)+'</span>'; }
      else { h+='🗓️ '+new Date(f.createdAt||now).toLocaleString('ar'); }
      h+='</div><div class="cc-acts">';
      if(st==='pending'){ h+='<button type="button" class="cfm-sm ok" data-act="approve" data-id="'+esc(f.id)+'">✔️ مصادقة وتحويل كطلب</button>'; }
      h+='<button type="button" class="cfm-sm" data-act="share" data-id="'+esc(f.id)+'" style="background:#0ea5e9;color:#fff;">🔳 رمز/مشاركة</button>';
      h+='<button type="button" class="cfm-sm danger" data-act="del" data-id="'+esc(f.id)+'">🗑️ حذف</button>';
      h+='</div></div>';
    });
    hubList.innerHTML=h;
    hubList.querySelectorAll('[data-act="approve"]').forEach(function(b){ b.onclick=function(){ var f=cfForms.find(function(x){return x.id===b.dataset.id;}); if(f) approve(f); }; });
    hubList.querySelectorAll('[data-act="share"]').forEach(function(b){ b.onclick=function(){ var f=cfForms.find(function(x){return x.id===b.dataset.id;}); if(f){ hide(hub); shareView(f); } }; });
    hubList.querySelectorAll('[data-act="del"]').forEach(function(b){ b.onclick=function(){ removeForm(b.dataset.id); }; });
    updateBadge();
  }
  function tickCountdowns(){
    if(!hub||!hub.classList.contains('show')) return;
    var now=Date.now(), need=false;
    hubList.querySelectorAll('.cfm-countdown').forEach(function(el){
      var exp=parseInt(el.dataset.exp,10)||0, left=exp-now;
      if(left<=0){ need=true; } else el.textContent=fmt(left);
    });
    if(need) renderHub();
  }
  cdTimer=setInterval(tickCountdowns, 1000);
  setInterval(function(){ if(markExpired()){ updateBadge(); if(hub&&hub.classList.contains('show')) renderHub(); } }, 30000);

  function wireData(){
    DB.getCustForms().then(function(list){ cfForms=list||[]; markExpired(); updateBadge(); if(hub&&hub.classList.contains('show')) renderHub(); }).catch(function(){});
    DB.onCustForms(function(list){ cfForms=list||[]; markExpired(); updateBadge(); if(hub&&hub.classList.contains('show')) renderHub(); });
  }
  if(typeof DB!=='undefined' && DB.getCustForms){ wireData(); }
})();

/* =====================================================================
   استمارة طلب خارجية (رابط مؤقت) — ينشئها المستخدم ويملؤها العميل
   دون تسجيل دخول، ثم تصل للمنشئ كإشعار مع «معاينة» و«مصادقة».
   تعمل بالكامل عبر Firestore الحقيقي (settings/order_forms + order_subs)
   ===================================================================== */
(function(){
  var extForms=[], extSubs=[], extCdTimer=null;

  function meId(){ return (typeof currentPosUser!=='undefined'&&currentPosUser)?(currentPosUser.username||currentPosUser.name||''):''; }
  function meName(){ return (typeof currentPosUser!=='undefined'&&currentPosUser)?(currentPosUser.name||currentPosUser.username||''):''; }

  var modal=document.getElementById('extFormModal');
  var listEl=document.getElementById('extFormList');
  var prevModal=document.getElementById('extPreviewModal');
  var prevBody=document.getElementById('extPrevBody');
  var prevFoot=document.getElementById('extPrevFoot');
  var badge=document.getElementById('extSubBadge');
  function show(m){ if(m) m.classList.add('show'); }
  function hide(m){ if(m) m.classList.remove('show'); }

  // notified subs (منع تكرار الإشعار) — محلي لكل جهاز
  var notifiedSubs=(function(){ try{ return new Set(JSON.parse(localStorage.getItem('ext_notified_subs')||'[]')); }catch(e){ return new Set(); } })();
  function saveNotified(){ try{ localStorage.setItem('ext_notified_subs', JSON.stringify(Array.prototype.slice.call(notifiedSubs))); }catch(e){} }

  // رابط الاستمارة الكامل
  function linkOf(token){
    return appFormBaseUrl() + 'order.html?f=' + encodeURIComponent(token);
  }
  function appFormBaseUrl(){
    try{
      if(window.location && (location.protocol === 'https:' || location.protocol === 'http:')) return location.origin.replace(/\/$/, '') + '/';
    }catch(e){}
    return 'https://bluemark1.netlify.app/';
  }
  function fmt(ms){
    if(ms<=0) return 'انتهت';
    var h=Math.floor(ms/3600000), m=Math.floor((ms%3600000)/60000);
    if(h>0) return h+' س '+m+' د';
    var s=Math.floor((ms%60000)/1000);
    return m+' د '+s+' ث';
  }

  // فتح/إغلاق النافذة
  var openBtn=document.getElementById('extFormBtn');
  if(openBtn) openBtn.onclick=function(){
    if(!currentPosUser){ showToast('سجّل الدخول أولاً'); return; }
    renderList(); show(modal);
  };
  var closeBtn=document.getElementById('extFormClose');
  if(closeBtn) closeBtn.onclick=function(){ hide(modal); };
  var prevClose=document.getElementById('extPrevClose');
  if(prevClose) prevClose.onclick=function(){ hide(prevModal); };
  [modal,prevModal].forEach(function(m){ if(m) m.addEventListener('click',function(e){ if(e.target===m) hide(m); }); });

  // إنشاء رابط جديد
  var createBtn=document.getElementById('extCreateBtn');
  if(createBtn) createBtn.onclick=async function(){
    if(!currentPosUser){ showToast('سجّل الدخول أولاً'); return; }
    var title=(document.getElementById('extTitle').value||'').trim();
    var note=(document.getElementById('extNote').value||'').trim();
    var hours=Math.max(1, Math.min(168, parseInt(document.getElementById('extHours').value,10)||24));
    var now=Date.now();
    var f={
      token: DB.genToken(),
      title: title, note: note,
      createdBy: meId(), createdByName: meName(),
      createdAt: now, expiresAt: now + hours*3600000, active: true
    };
    try{
      await DB.addOrderForm(f);
      document.getElementById('extTitle').value='';
      document.getElementById('extNote').value='';
      showToast('✅ تم إنشاء الرابط — انسخه وأرسله للعميل');
      renderList();
    }catch(e){ showToast('تعذّر إنشاء الرابط'); }
  };

  async function copyText(txt){
    try{ await navigator.clipboard.writeText(txt); showToast('📋 تم نسخ الرابط'); }
    catch(e){
      try{ var ta=document.createElement('textarea'); ta.value=txt; ta.style.position='fixed'; ta.style.opacity='0'; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta); showToast('📋 تم نسخ الرابط'); }
      catch(e2){ showToast('انسخ الرابط يدوياً'); }
    }
  }

  function renderList(){
    if(!listEl) return;
    var id=meId(), now=Date.now();
    var mine=extForms.filter(function(f){ return f.createdBy===id; }).sort(function(a,b){ return (b.createdAt||0)-(a.createdAt||0); });
    if(!mine.length){ listEl.innerHTML='<div class="cfm-empty">لا توجد استمارات بعد — أنشئ رابطاً من الأعلى</div>'; return; }
    var h='';
    mine.forEach(function(f){
      var expired=f.expiresAt&&now>f.expiresAt, active=f.active!==false&&!expired;
      var link=linkOf(f.token);
      var subs=extSubs.filter(function(s){ return s.token===f.token; });
      var pend=subs.filter(function(s){ return s.status==='pending'; }).length;
      var appr=subs.filter(function(s){ return s.status==='approved'; }).length;
      var tag= expired? '<span class="cfm-tag expired">⌛ منتهي</span>' : (active? '<span class="cfm-tag pending">🟢 نشط</span>' : '<span class="cfm-tag expired">متوقّف</span>');
      h+='<div class="cfm-card'+(expired?' expired':'')+'">'+
        '<div class="cc-top"><span class="cc-name">'+esc(f.title||'استمارة طلب')+'</span>'+tag+'</div>'+
        '<div class="cc-meta">'+(f.note?('📝 '+esc(f.note)+'<br>'):'')+
          '📨 طلبات واردة: '+subs.length+(pend?(' · ⏳ '+pend+' بانتظار'):'')+(appr?(' · ✅ '+appr+' مصادق'):'')+'<br>';
      if(active && f.expiresAt){ h+='⏱️ ينتهي خلال <span class="cfm-countdown" data-exp="'+f.expiresAt+'">'+fmt(f.expiresAt-now)+'</span>'; }
      else { h+='🗓️ '+new Date(f.createdAt||now).toLocaleString('ar'); }
      h+='</div>';
      if(active){
        h+='<div class="ext-link-box"><input type="text" readonly value="'+esc(link)+'">'+
          '<button type="button" data-copy="'+esc(link)+'">📋 نسخ</button>'+
          '<button type="button" class="wa" data-wa="'+esc(link)+'">واتساب</button></div>';
        var qimg=qrDataUrl(link, 4, 6);
        if(qimg){ h+='<div style="text-align:center;margin-top:8px;"><img src="'+qimg+'" alt="QR" style="width:116px;height:116px;image-rendering:pixelated;background:#fff;padding:6px;border:1px solid #e2e8f0;border-radius:10px;" /><div style="font-size:11px;color:#64748b;margin-top:3px;">🔳 رمز الاستمارة الموحّد — يبقى حتى الفاتورة</div></div>'; }
      }
      h+='<div class="cc-acts" style="margin-top:8px">';
      if(active){ h+='<button type="button" class="cfm-sm" data-share="'+esc(f.token)+'" style="background:#0ea5e9;color:#fff;">🔳 رمز/مشاركة</button>'; }
      h+='<button type="button" class="cfm-sm danger" data-del="'+esc(f.token)+'">🗑️ حذف الرابط</button>';
      h+='</div></div>';
    });
    listEl.innerHTML=h;
    listEl.querySelectorAll('[data-copy]').forEach(function(b){ b.onclick=function(){ copyText(b.dataset.copy); }; });
    listEl.querySelectorAll('[data-wa]').forEach(function(b){ b.onclick=function(){ window.open('https://wa.me/?text='+encodeURIComponent('استمارة طلبك: '+b.dataset.wa),'_blank'); }; });
    listEl.querySelectorAll('[data-share]').forEach(function(b){ b.onclick=function(){ window.__extShare(b.dataset.share); }; });
    listEl.querySelectorAll('[data-del]').forEach(function(b){ b.onclick=async function(){ if(!confirm('حذف هذا الرابط؟ لن يتمكّن العملاء من استخدامه بعد الآن.')) return; try{ await DB.deleteOrderForm(b.dataset.del); renderList(); }catch(e){} }; });
  }

  // عدّاد تنازلي حيّ
  function tick(){
    if(!modal||!modal.classList.contains('show')) return;
    var now=Date.now(), need=false;
    listEl.querySelectorAll('.cfm-countdown').forEach(function(el){
      var exp=parseInt(el.dataset.exp,10)||0, left=exp-now;
      if(left<=0){ need=true; } else el.textContent=fmt(left);
    });
    if(need) renderList();
  }
  extCdTimer=setInterval(tick, 1000);

  function updateBadge(){
    if(!badge) return;
    var id=meId();
    var n=extSubs.filter(function(s){ return s.createdBy===id && s.status==='pending'; }).length;
    if(n>0){ badge.textContent=n>99?'99+':String(n); badge.style.display=''; }
    else badge.style.display='none';
  }

  function subById(id){ return extSubs.find(function(s){ return s.id===id; }); }

  // معاينة طلب العميل
  window.__extPreviewSub=function(subId){
    var s=subById(subId);
    if(!s){ showToast('الطلب غير موجود'); return; }
    var h='<div class="cfm-preview">';
    h+='<div class="cfm-prev-row"><span>العميل</span><span>'+esc(s.name||'عميل')+'</span></div>';
    if(s.phone) h+='<div class="cfm-prev-row"><span>الجوال</span><span>'+esc(s.phone)+(s.hasWa?' ✅':'')+'</span></div>';
    (s.items||[]).forEach(function(i){ h+='<div class="cfm-prev-row"><span>'+(i.emoji||'')+' '+esc(i.name)+' ×'+i.qty+'</span><span>'+money(i.price*i.qty)+'</span></div>'; });
    h+='<div class="cfm-prev-row"><span>الإجمالي الفرعي</span><span>'+money(s.subtotal||0)+'</span></div>';
    h+='<div class="cfm-prev-row"><span>الضريبة</span><span>'+money(s.vat||0)+'</span></div>';
    h+='<div class="cfm-prev-total">الإجمالي: '+money(s.total||0)+'</div>';
    if(s.payMethod==='card'||s.depositType){ h+='<div class="cfm-prev-row"><span>الدفع</span><span>'+esc(s.depositType||'شبكة')+(s.exchangeName?(' · '+esc(s.exchangeName)):'')+'</span></div>'; }
    if(s.theme){ h+='<div class="cfm-prev-row"><span>الثيم</span><span>🎁 '+esc((s.themeData&&s.themeData.occasion)||'ثيم')+'</span></div>'; }
    if(s.pickupDate){ h+='<div class="cfm-prev-row"><span>موعد الاستلام</span><span>'+esc(s.pickupDate)+(s.pickupTime?(' '+esc(s.pickupTime)):'')+'</span></div>'; }
    if(s.note){ h+='<div class="cfm-prev-row"><span>ملاحظة</span><span>'+esc(s.note)+'</span></div>'; }
    h+='<div class="cfm-prev-row"><span>الحالة</span><span>'+(s.status==='approved'?('✅ مصادق'+(s.orderNo?(' · طلب #'+s.orderNo):'')):'⏳ بانتظار المصادقة')+'</span></div>';
    h+='</div>';
    prevBody.innerHTML=h;
    if(s.status==='pending'){
      prevFoot.innerHTML='<button type="button" class="cfm-btn ok" id="extPrevApprove">✔️ مصادقة وتحويل كطلب</button>';
      document.getElementById('extPrevApprove').onclick=function(){ hide(prevModal); window.__extApproveSub(subId); };
    } else { prevFoot.innerHTML=''; }
    show(prevModal);
  };

  // مصادقة: تحويل طلب العميل إلى طلب فعلي أسبوعي
  var approving=false;
  window.__extApproveSub=async function(subId){
    if(approving){ return; }
    var s=subById(subId);
    if(!s){ showToast('الطلب غير موجود'); return; }
    if(s.status!=='pending'){ showToast('تمت المصادقة على هذا الطلب مسبقاً'); return; }
    if(!confirm('مصادقة طلب "'+(s.name||'عميل')+'" وتحويله إلى طلب فعلي؟')) return;
    approving=true;
    try{
      // منع التكرار: أعد الجلب وتأكد أنه ما زال بانتظار المصادقة
      var fresh=(await DB.getOrderSubs()).find(function(x){ return x.id===subId; });
      if(!fresh || fresh.status!=='pending'){ showToast('تمت المصادقة على هذا الطلب مسبقاً'); approving=false; refresh(); return; }
      var orderNo=0; try{ orderNo=await DB.nextOrderNo(); }catch(e){ orderNo=0; }
      var pay=(s.payMethod==='card'||s.depositType)?'card':'cash';
      var order={
        id:'INV-'+Date.now(), orderNo:orderNo,
        cashier: s.createdByName||meName(),
        name:s.name||'عميل', phone:s.phone||'', address:'',
        type:'محلي', pay:pay,
        depositType: pay==='card'?(s.depositType||'إيداع'):'',
        exchangeName: pay==='card'?(s.exchangeName||''):'',
        exchangeColor: pay==='card'?(s.exchangeColor||''):'',
        items:(s.items||[]).map(function(i){ return {name:i.name,price:i.price,qty:i.qty,emoji:i.emoji,wrapped:!!i.wrapped}; }),
        subtotal:s.subtotal||0, vat:s.vat||0, total:s.total||0,
        paid:s.total||0, change:0, remaining:0, payStatus:'paid',
        pickupDate:s.pickupDate||'', pickupTime:s.pickupTime||'',
        hasWrapped:(s.items||[]).some(function(i){ return i.wrapped; }),
        theme:!!s.theme,
        themeData: s.theme?{occasion:(s.themeData&&s.themeData.occasion)||'',customText:(s.themeData&&s.themeData.customText)||''}:false,
        hasWa:!!s.hasWa, note:s.note||'',
        fromExtForm:true, extSubId:s.id, formToken:s.token||'',
        status:'done', prep:'pending',
        createdAt:Date.now(), date:new Date().toLocaleString('ar')
      };
      if(typeof selfOrderIds!=='undefined' && selfOrderIds.add) selfOrderIds.add(order.id);
      await DB.addOrder(order);
      await DB.updateOrderSub(s.id,{status:'approved',orderNo:orderNo,approvedAt:Date.now(),approvedBy:meId()});
      try{ addNotification('تمت مصادقة طلب العميل','طلب رقم '+orderNo+' — '+order.name,'✅',order.id); }catch(e){}
      showToast('✅ تم التحويل إلى طلب رقم '+orderNo);
      refresh();
    }catch(e){ showToast('تعذّر التحويل إلى طلب'); }
    approving=false;
  };

  // ===== رمز/مشاركة استمارة الطلب الخارجية =====
  function brandName2(){ return (RESTAURANT&&(RESTAURANT.headerBrand||RESTAURANT.name))||'المتجر'; }
  function ensureH2C2(cb){
    if(typeof html2canvas!=='undefined'){ cb(true); return; }
    var s=document.createElement('script');
    s.src='https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js';
    s.onload=function(){ cb(typeof html2canvas!=='undefined'); };
    s.onerror=function(){ cb(false); };
    document.head.appendChild(s);
  }
  window.__extShare=function(token){
    var f=extForms.find(function(x){ return x.token===token; });
    if(!f){ showToast('الرابط غير موجود'); return; }
    var now=Date.now();
    var expired=f.expiresAt&&now>f.expiresAt;
    if(expired || f.active===false){ showToast('هذا الرابط منتهٍ/متوقّف — لا يمكن مشاركته'); return; }
    var link=linkOf(f.token);
    var qr=qrDataUrl(link, 5, 6);
    var expTxt=f.expiresAt? ('⭐ صالح حتى '+new Date(f.expiresAt).toLocaleString('ar')) : '';
    var card=''+
    '<div id="extShareCard" dir="rtl" style="font-family:\'Segoe UI\',Tahoma,sans-serif;background:#fff;color:#0f172a;border:1px solid #e2e8f0;border-radius:16px;padding:16px;max-width:360px;margin:0 auto;line-height:1.7;">'+
      '<div style="text-align:center;border-bottom:2px solid #1e3a8a;padding-bottom:8px;margin-bottom:10px;">'+
        '<div style="font-size:19px;font-weight:800;color:#1e3a8a;">'+esc(brandName2())+'</div>'+
        '<div style="font-size:13px;color:#64748b;">'+esc(f.title||'استمارة طلب')+'</div>'+
      '</div>'+
      (f.note?'<div style="background:#eff6ff;border:1px solid #bfdbfe;color:#1e40af;border-radius:10px;padding:8px 10px;font-size:12.5px;margin-bottom:10px;">'+esc(f.note)+'</div>':'')+
      '<div style="text-align:center;">'+
        (qr?'<img src="'+qr+'" alt="QR" style="width:160px;height:160px;image-rendering:pixelated;background:#fff;padding:8px;border:1px solid #e2e8f0;border-radius:12px;" />':'')+
        '<div style="font-size:12.5px;color:#334155;margin-top:6px;font-weight:700;">📱 امسح الرمز لفتح استمارة الطلب</div>'+
        (expTxt?'<div style="font-size:11.5px;color:#64748b;margin-top:3px;">'+esc(expTxt)+'</div>':'')+
      '</div>'+
    '</div>';
    prevBody.innerHTML=card;
    prevFoot.innerHTML=
      '<button type="button" class="cfm-btn" id="extPng" style="background:#0ea5e9;color:#fff;">🖼️ حفظ صورة</button>'+
      '<button type="button" class="cfm-btn" id="extSend" style="background:#16a34a;color:#fff;">📤 إرسال</button>'+
      '<button type="button" class="cfm-btn ok" id="extShareLink">🔗 مشاركة رابط</button>';
    document.getElementById('extPng').onclick=function(){ extRenderCanvas(function(cv){ if(!cv){ showToast('تعذّر إنشاء الصورة'); return; } try{ var a=document.createElement('a'); a.href=cv.toDataURL('image/png'); a.download='استمارة-'+((f.title||'طلب').replace(/\s+/g,'_'))+'.png'; document.body.appendChild(a); a.click(); a.remove(); showToast('✅ تم حفظ الصورة'); }catch(e){ showToast('تعذّر الحفظ'); } }); };
    document.getElementById('extSend').onclick=function(){ extSendImg(f, link); };
    document.getElementById('extShareLink').onclick=function(){ extShareLink(f, link); };
    show(prevModal);
  };
  function extRenderCanvas(cb){
    var card=document.getElementById('extShareCard');
    if(!card){ cb(null); return; }
    showToast('… جارٍ تجهيز الصورة');
    ensureH2C2(function(ok){ if(!ok){ cb(null); return; } html2canvas(card,{backgroundColor:'#ffffff',scale:2,useCORS:true,logging:false}).then(function(cv){ cb(cv); }).catch(function(){ cb(null); }); });
  }
  function extSendImg(f, link){
    extRenderCanvas(function(cv){
      if(cv && cv.toBlob && navigator.canShare){
        cv.toBlob(function(blob){
          try{
            var file=new File([blob],'form.png',{type:'image/png'});
            if(navigator.canShare({files:[file]})){ navigator.share({files:[file],title:f.title||'استمارة طلب',text:'استمارة الطلب: '+link}).catch(function(){}); return; }
          }catch(e){}
          extSendFallback(f, cv, link);
        },'image/png');
      }else{ extSendFallback(f, cv, link); }
    });
  }
  function extSendFallback(f, cv, link){
    if(navigator.share){ navigator.share({title:f.title||'استمارة طلب',text:'استمارة الطلب',url:link}).catch(function(){ extDl(f, cv); }); }
    else { extDl(f, cv); showToast('⬇️ تم تنزيل الصورة — أرسلها للعميل'); }
  }
  function extDl(f, cv){ if(!cv) return; try{ var a=document.createElement('a'); a.href=cv.toDataURL('image/png'); a.download='استمارة-'+((f.title||'طلب').replace(/\s+/g,'_'))+'.png'; document.body.appendChild(a); a.click(); a.remove(); }catch(e){} }
  function extShareLink(f, link){
    var now=Date.now();
    if((f.expiresAt&&now>f.expiresAt) || f.active===false){ showToast('الرابط منتهٍ/متوقّف'); return; }
    var msg='استمارة الطلب من '+brandName2()+':\n'+link;
    if(navigator.share){ navigator.share({title:'استمارة الطلب',text:msg,url:link}).catch(function(){ copyText(link); }); }
    else { copyText(link); }
  }

  function onSubs(list){
    extSubs=list||[];
    var id=meId();
    extSubs.forEach(function(s){
      if(s.createdBy===id && s.status==='pending' && !notifiedSubs.has(s.id)){
        notifiedSubs.add(s.id); saveNotified();
        try{
          var items=(s.items||[]).map(function(i){ return i.name; }).join('، ');
          addNotification('📨 طلب جديد من استمارة',(s.name||'عميل')+' · 💰 '+money(s.total||0)+(items?(' · '+items.slice(0,50)):''),'📨','',s.id);
        }catch(e){}
      }
    });
    updateBadge();
    if(modal&&modal.classList.contains('show')) renderList();
  }

  function refresh(){
    DB.getOrderSubs().then(onSubs).catch(function(){});
    DB.getOrderForms().then(function(l){ extForms=l||[]; if(modal&&modal.classList.contains('show')) renderList(); }).catch(function(){});
  }

  if(typeof DB!=='undefined' && DB.getOrderForms){
    DB.getOrderForms().then(function(l){ extForms=l||[]; }).catch(function(){});
    DB.getOrderSubs().then(onSubs).catch(function(){});
    if(DB.onOrderForms) DB.onOrderForms(function(l){ extForms=l||[]; if(modal&&modal.classList.contains('show')) renderList(); });
    if(DB.onOrderSubs) DB.onOrderSubs(onSubs);
  }
})();
