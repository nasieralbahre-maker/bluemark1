// ===== Config =====
const STATUS_LABELS = {new:'جديد', preparing:'قيد التحضير', done:'مكتمل', cancelled:'ملغي'};
const STATUS_CLASS = {new:'st-new', preparing:'st-preparing', done:'st-done', cancelled:'st-cancelled'};

// صلاحيات كل دور (الدور "مخصص" يستخدم خيارات فردية)
const PERM_LABELS = {orders:'الطلبات', customers:'العملاء', menu:'الأصناف', stats:'الإحصائيات', settings:'الإعدادات', users:'المستخدمون'};
const ROLE_PERMS = {
  'مدير':  {orders:true, customers:true, menu:true, stats:true, settings:true, users:true},
  'كاشير':{orders:true, customers:true, menu:false, stats:false, settings:false, users:false}
};

// ===== Caches =====
let ordersCache = [];
let menuCache = [];
let settingsCache = null;
let usersCache = [];
let signupCache = [];
let currentUser = null;
let unsubOrders = null, unsubMenu = null, unsubSettings = null, unsubUsers = null, unsubSignups = null;

// ===== Helpers =====
function esc(str){
  return String(str == null ? '' : str).replace(/[&<>"']/g, c => (
    {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]
  ));
}
function money(n){ return n + ' ' + currencySymbol(); }

// رقم الطلب التسلسلي للعرض (يبدأ من 1)
function orderNoLabel(o){ return (o && o.orderNo) ? ('#' + o.orderNo) : (o ? o.id : ''); }
// نص قابل للبحث يجمع كل حقول الطلب
function orderSearchText(o){
  const items = (o.items || []).map(it => it.name).join(' ');
  return [
    o.orderNo != null ? ('#' + o.orderNo) : '', o.orderNo, o.id, o.name, o.phone, o.address,
    o.type, (o.pay==='card'?'شبكة بطاقة':(o.pay==='deposit'?'عربون':'نقد')),
    o.date, o.pickupDate, o.pickupTime, o.total, o.remaining, o.cashier, o.status, items,
    o.theme ? 'ثيم' : '', o.themeData ? (o.themeData.occasion||'') : '', o.themeData ? (o.themeData.customText||'') : '',
    o.doneMark ? 'تم التنفيذ منفذ' : ''
  ].join(' ').toLowerCase();
}

// العملات المدعومة
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
function currencySymbol(){ return (CURRENCIES[(settingsCache && settingsCache.currency) || 'YER'] || CURRENCIES.YER).symbol; }

// ===== WhatsApp helpers =====
const COUNTRY_CODE = '966'; // رمز الدولة الافتراضي
function normalizePhone(raw){
  let p = String(raw||'').replace(/[^0-9]/g, '');
  if(p.indexOf('00') === 0) p = p.slice(2);
  if(p.indexOf('0') === 0) p = COUNTRY_CODE + p.slice(1);
  else if(p.indexOf(COUNTRY_CODE) !== 0 && p.length <= 9) p = COUNTRY_CODE + p;
  return p;
}
function waUrl(phone, text){
  return 'https://wa.me/' + normalizePhone(phone) + '?text=' + encodeURIComponent(text);
}
function customerMessage(order){
  const rName = (settingsCache && settingsCache.name) || 'النظام';
  const status = order.status || 'new';
  const statusMsg = {
    new: 'تم استلام طلبك وسيتم تجهيزه قريباً.',
    preparing: 'طلبك قيد التحضير الآن 👨‍🍳',
    done: 'طلبك جاهز! شكراً لاختيارك ' + rName + ' 🎉',
    cancelled: 'نأسف، تم إلغاء طلبك. للاستفسار تواصل معنا.'
  }[status];
  return 'مرحباً ' + order.name + ' 👋\n' +
    'بخصوص طلبك رقم ' + orderNoLabel(order) + ':\n' +
    statusMsg + '\n' +
    '💰 الإجمالي: ' + order.total + ' ' + currencySymbol() + '\n' +
    '— ' + rName;
}

let toastTimer;
function showToast(msg){
  const t = document.getElementById('toast');
  t.textContent = msg; t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2500);
}

// ===== Login =====
const loginScreen = document.getElementById('loginScreen');
const dash = document.getElementById('dash');

// التبويب المطلوب فتحه مباشرة (مثل ?tab=signups القادم من إشعار طلب حساب جديد)
const urlTab = (function(){ try{ return new URLSearchParams(location.search).get('tab') || ''; }catch(e){ return ''; } })();
let pendingTab = urlTab;

// تفعيل تبويب معيّن برمجياً (إن كان متاحاً حسب الصلاحيات)
function activateRequestedTab(tab){
  if(!tab) return;
  const link = document.querySelector('.side-link[data-tab="' + tab + '"]');
  if(link && link.style.display !== 'none'){ link.click(); }
}

function showCloudBadge(){
  const brand = document.querySelector('.side-brand');
  if(brand && !document.getElementById('cloudBadge')){
    const b = document.createElement('small');
    b.id = 'cloudBadge';
    b.style.cssText = 'display:block;font-size:11px;font-weight:600;margin-top:4px;color:#9fe0b5';
    b.textContent = DB.isCloud() ? '☁️ متصل بالسحابة' : '💾 تخزين محلي';
    if(!DB.isCloud()) b.style.color = '#e3b7a0';
    brand.appendChild(b);
  }
}

// ===== أوقات الفتح التلقائي لطلبات الأسبوع (إضافة/حذف) =====
function renderWeeklyTimes(times){
  const wrap = document.getElementById('weeklyTimesList');
  if(!wrap) return;
  const list = (Array.isArray(times) && times.length) ? times : [];
  wrap.innerHTML = list.map(t =>
    '<div class="cf-row weekly-time-row">' +
      '<input type="time" class="weekly-time-input" value="' + esc(t || '') + '" />' +
      '<button type="button" class="cf-del" title="حذف الوقت">✕</button>' +
    '</div>'
  ).join('');
  wrap.querySelectorAll('.weekly-time-row .cf-del').forEach(btn => {
    btn.onclick = () => { const row = btn.closest('.weekly-time-row'); if(row) row.remove(); };
  });
}
function collectWeeklyTimes(){
  const wrap = document.getElementById('weeklyTimesList');
  if(!wrap) return [];
  const out = [];
  wrap.querySelectorAll('.weekly-time-input').forEach(inp => {
    const v = (inp.value || '').trim();
    if(v && out.indexOf(v) === -1) out.push(v);
  });
  return out.slice(0, 12);
}

async function showDash(){
  loginScreen.style.display = 'none';
  dash.style.display = 'flex';
  showCloudBadge();
  showUserBadge();
  applyPermissions();
  subscribe();
  if(pendingTab){ activateRequestedTab(pendingTab); pendingTab = ''; }
}

// تحميل المستخدمين ثم استعادة الجلسة إن وجدت
(async function initAuth(){
  try{ usersCache = await DB.getUsers(); }catch(e){ console.warn('تعذر جلب المستخدمين:', e); usersCache = []; }
  // عند القدوم عبر ?tab= (من إشعار طلب حساب جديد) نلزم إدخال كلمة المرور دائماً
  if(urlTab) return;
  const savedUser = sessionStorage.getItem('admin_user');
  if(savedUser){
    const u = usersCache.find(x => x.username === savedUser);
    if(u){ currentUser = u; showDash(); }
  }
})();

function userPerms(u){
  if(!u) return {};
  if(u.role && ROLE_PERMS[u.role]) return ROLE_PERMS[u.role];
  return u.perms || {};
}

function showUserBadge(){
  const brand = document.querySelector('.side-brand');
  if(!brand) return;
  let b = document.getElementById('userBadge');
  if(!b){
    b = document.createElement('small');
    b.id = 'userBadge';
    b.style.cssText = 'display:block;font-size:12px;font-weight:700;margin-top:6px;color:#fff';
    brand.appendChild(b);
  }
  b.textContent = currentUser ? ('👤 ' + currentUser.name + ' · ' + (currentUser.role||'')) : '';
}

// إخفاء/إظهار التبويبات حسب الصلاحيات
function applyPermissions(){
  const perms = userPerms(currentUser);
  const links = document.querySelectorAll('.side-link[data-tab]');
  let firstAllowed = null;
  links.forEach(link => {
    const tab = link.dataset.tab;
    // تبويب طلبات الحساب متاح للمدير أو من يملك صلاحية إدارة المستخدمين
    const allowed = (tab === 'signups')
      ? ((currentUser && currentUser.role === 'مدير') || perms.users === true)
      : (perms[tab] === true);
    link.style.display = allowed ? '' : 'none';
    if(allowed && !firstAllowed) firstAllowed = tab;
  });
  // تفعيل أول تبويب مسموح
  if(firstAllowed){
    links.forEach(b => b.classList.remove('active'));
    document.querySelector('.side-link[data-tab="' + firstAllowed + '"]').classList.add('active');
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    const sec = document.getElementById('tab-' + firstAllowed);
    if(sec) sec.classList.add('active');
  }
}

document.getElementById('loginForm').onsubmit = function(e){
  e.preventDefault();
  const usr = document.getElementById('usr').value.trim();
  const pwd = document.getElementById('pwd').value;
  const u = usersCache.find(x => x.username === usr && String(x.password) === String(pwd));
  if(u){
    currentUser = u;
    sessionStorage.setItem('admin_user', u.username);
    document.getElementById('loginErr').textContent = '';
    document.getElementById('pwd').value = '';
    showDash();
  } else {
    document.getElementById('loginErr').textContent = 'اسم المستخدم أو كلمة المرور غير صحيحة';
  }
};
document.getElementById('logoutBtn').onclick = function(){
  sessionStorage.removeItem('admin_user');
  currentUser = null;
  if(unsubOrders) unsubOrders();
  if(unsubMenu) unsubMenu();
  if(unsubSettings) unsubSettings();
  if(unsubUsers) unsubUsers();
  if(unsubSignups) unsubSignups();
  dash.style.display = 'none';
  loginScreen.style.display = 'flex';
  document.getElementById('usr').value = '';
  document.getElementById('pwd').value = '';
};

// ===== Realtime subscriptions =====
function subscribe(){
  if(unsubOrders) unsubOrders();
  if(unsubMenu) unsubMenu();
  if(unsubSettings) unsubSettings();
  if(unsubUsers) unsubUsers();
  if(unsubSignups) unsubSignups();
  unsubOrders = DB.onOrders(list => {
    ordersCache = list || [];
    renderOrders(); renderStats(); renderCustomers();
  });
  unsubMenu = DB.onMenu(list => {
    menuCache = list || [];
    renderMenuTable(); renderStats();
  });
  unsubSettings = DB.onSettings(cfg => { settingsCache = cfg; fillSettingsForm(cfg); applyDataSaver(cfg); if(typeof renderOrders==='function') renderOrders(); if(typeof renderStats==='function') renderStats(); });
  unsubUsers = DB.onUsers(list => { usersCache = list || []; renderUsersTable(); });
  unsubSignups = DB.onSignupRequests(list => { signupCache = list || []; renderSignupTable(); updateSignupBadge(); });
  // تحميل أولي (في حال لم تطلق الاشتراكات فوراً)
  DB.getOrders().then(l => { ordersCache = l; renderOrders(); renderStats(); renderCustomers(); });
  DB.getMenu().then(l => { menuCache = l; renderMenuTable(); renderStats(); });
  DB.getSettings().then(c => { settingsCache = c; fillSettingsForm(c); if(typeof renderOrders==='function') renderOrders(); if(typeof renderStats==='function') renderStats(); });
  DB.getUsers().then(l => { usersCache = l; renderUsersTable(); });
  DB.getSignupRequests().then(l => { signupCache = l || []; renderSignupTable(); updateSignupBadge(); });
}

// ===== Tabs =====
document.querySelectorAll('.side-link[data-tab]').forEach(btn => {
  btn.onclick = () => {
    document.querySelectorAll('.side-link[data-tab]').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const tab = btn.dataset.tab;
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.getElementById('tab-' + tab).classList.add('active');
  };
});

// ===== Orders =====
document.getElementById('orderFilter').onchange = renderOrders;

function renderOrders(){
  const filter = document.getElementById('orderFilter').value;
  const wrap = document.getElementById('ordersWrap');
  let orders = ordersCache.slice().reverse();
  if(filter !== 'all') orders = orders.filter(o => (o.status || 'new') === filter);
  const q = (document.getElementById('orderSearch') ? document.getElementById('orderSearch').value : '').trim().toLowerCase();
  if(q) orders = orders.filter(o => orderSearchText(o).includes(q));

  if(orders.length === 0){
    wrap.innerHTML = '<div class="empty-state">لا توجد طلبات 📋</div>';
    return;
  }
  wrap.innerHTML = '';
  orders.forEach(o => {
    const status = o.status || 'new';
    const payTxt = o.pay === 'card' ? 'بطاقة عند الاستلام' : 'نقداً عند الاستلام';
    const lines = (o.items || []).map(it =>
      '<div class="ol"><span>' + (it.emoji||'') + ' ' + esc(it.name) + ' ×' + it.qty + '</span>' +
      '<span>' + money(it.price * it.qty) + '</span></div>'
    ).join('');
    const card = document.createElement('div');
    card.className = 'order-card';
    card.innerHTML =
      '<div class="order-top">' +
        '<div><div class="order-id">' + esc(orderNoLabel(o)) + '</div>' +
        '<div class="order-date">' + esc(o.date) + '</div></div>' +
        '<span class="status-badge ' + STATUS_CLASS[status] + '">' + STATUS_LABELS[status] + '</span>' +
      '</div>' +
      '<div class="order-meta">' +
        '<span><b>العميل:</b> ' + esc(o.name) + '</span>' +
        '<span><b>الجوال:</b> ' + esc(o.phone) + '</span>' +
        '<span><b>العنوان:</b> ' + esc(o.address) + '</span>' +
        '<span><b>الدفع:</b> ' + payTxt + '</span>' +
      '</div>' +
      (o.theme && o.themeData ?
        '<div class="order-meta theme-meta">' +
          '<span>🎁 <b>المناسبة:</b> ' + esc(o.themeData.occasion || '—') + '</span>' +
          (o.themeData.customText ? '<span>🎁 <b>النص:</b> ' + esc(o.themeData.customText) + '</span>' : '') +
        '</div>' : '') +
      '<div class="order-lines">' + lines + '</div>' +
      '<div class="order-bottom">' +
        '<span class="order-total money-val">الإجمالي: ' + money(o.total) + '</span>' +
        '<div class="order-actions">' +
          '<select data-status="' + esc(o.id) + '">' +
            Object.keys(STATUS_LABELS).map(k =>
              '<option value="' + k + '"' + (k===status?' selected':'') + '>' + STATUS_LABELS[k] + '</option>'
            ).join('') +
          '</select>' +
          '<a class="wa-order" data-wa="' + esc(o.id) + '" target="_blank" rel="noopener" title="إبلاغ العميل عبر واتساب">💬</a>' +
          '<button class="del-order" data-del="' + esc(o.id) + '">🗑️</button>' +
        '</div>' +
      '</div>';
    card.querySelector('[data-status]').onchange = (e) => updateStatus(o.id, e.target.value);
    card.querySelector('[data-wa]').href = waUrl(o.phone, customerMessage(o));
    card.querySelector('[data-del]').onclick = () => deleteOrder(o.id);
    wrap.appendChild(card);
  });
}
async function updateStatus(id, status){
  try{
    await DB.updateOrderStatus(id, status);
    const o = ordersCache.find(x => x.id === id); if(o) o.status = status;
    renderOrders(); renderStats();
    showToast('تم تحديث حالة الطلب');
  }catch(e){ console.error(e); showToast('تعذر التحديث'); }
}
async function deleteOrder(id){
  if(!confirm('حذف هذا الطلب؟')) return;
  try{
    await DB.deleteOrder(id);
    ordersCache = ordersCache.filter(o => o.id !== id);
    renderOrders(); renderStats(); showToast('تم حذف الطلب');
  }catch(e){ console.error(e); showToast('تعذر الحذف'); }
}
document.getElementById('clearOrders').onclick = async () => {
  if(!confirm('مسح جميع الطلبات؟ لا يمكن التراجع.')) return;
  try{
    await DB.clearOrders();
    ordersCache = []; renderOrders(); renderStats(); showToast('تم مسح الطلبات');
  }catch(e){ console.error(e); showToast('تعذر المسح'); }
};

// ===== Menu table =====
function renderMenuTable(){
  const body = document.getElementById('menuBody');
  body.innerHTML = '';
  const cats = [...new Set(menuCache.map(m => m.cat))];
  document.getElementById('catList').innerHTML = cats.map(c => '<option value="' + esc(c) + '">').join('');

  menuCache.forEach(item => {
    const tr = document.createElement('tr');
    tr.innerHTML =
      '<td class="emoji-cell">' + (item.emoji||'') + '</td>' +
      '<td>' + esc(item.name) + '</td>' +
      '<td>' + esc(item.cat) + '</td>' +
      '<td><input type="number" class="price-input" value="' + item.price + '" min="0" step="0.5" data-price="' + item.id + '" /></td>' +
      '<td class="wrap-cell">' + (item.wrapped ? '🎁' : '—') + '</td>' +
      '<td><button class="avail-toggle ' + (item.available!==false?'on':'off') + '" data-avail="' + item.id + '"></button></td>' +
      '<td><div class="row-actions">' +
        '<button class="icon-btn" data-edit="' + item.id + '">✏️</button>' +
        '<button class="icon-btn del" data-remove="' + item.id + '">🗑️</button>' +
      '</div></td>';
    tr.querySelector('[data-price]').onchange = (e) => updatePrice(item.id, e.target.value);
    tr.querySelector('[data-avail]').onclick = () => toggleAvail(item.id);
    tr.querySelector('[data-edit]').onclick = () => openItemModal(item.id);
    tr.querySelector('[data-remove]').onclick = () => removeItem(item.id);
    body.appendChild(tr);
  });
}
async function persistMenu(msg){
  try{ await DB.saveMenu(menuCache); if(msg) showToast(msg); }
  catch(e){ console.error(e); showToast('تعذر الحفظ'); }
}
function updatePrice(id, val){
  const price = Math.max(0, parseFloat(val) || 0);
  const it = menuCache.find(m => m.id === id);
  if(it){ it.price = price; persistMenu('تم تحديث السعر'); }
}
function toggleAvail(id){
  const it = menuCache.find(m => m.id === id);
  if(it){ it.available = it.available===false; renderMenuTable(); persistMenu(); }
}
function removeItem(id){
  if(!confirm('حذف هذا الصنف؟')) return;
  menuCache = menuCache.filter(m => m.id !== id);
  renderMenuTable(); renderStats(); persistMenu('تم حذف الصنف');
}

// ===== Item modal (add/edit) =====
const itemModal = document.getElementById('itemModal');
document.getElementById('addItemBtn').onclick = () => openItemModal(null);
document.getElementById('closeItemModal').onclick = () => itemModal.classList.remove('show');
itemModal.onclick = (e) => { if(e.target === itemModal) itemModal.classList.remove('show'); };

function openItemModal(id){
  document.getElementById('itemModalTitle').textContent = id ? 'تعديل صنف' : 'إضافة صنف';
  if(id){
    const it = menuCache.find(m => m.id === id);
    document.getElementById('itemId').value = it.id;
    document.getElementById('itemName').value = it.name;
    document.getElementById('itemCat').value = it.cat;
    document.getElementById('itemDesc').value = it.desc || '';
    document.getElementById('itemPrice').value = it.price;
    document.getElementById('itemEmoji').value = it.emoji || '';
    document.getElementById('itemAvail').checked = it.available !== false;
    document.getElementById('itemWrapped').checked = !!it.wrapped;
  } else {
    document.getElementById('itemForm').reset();
    document.getElementById('itemId').value = '';
    document.getElementById('itemAvail').checked = true;
    document.getElementById('itemWrapped').checked = false;
  }
  itemModal.classList.add('show');
}
document.getElementById('itemForm').onsubmit = function(e){
  e.preventDefault();
  const idVal = document.getElementById('itemId').value;
  const data = {
    name: document.getElementById('itemName').value.trim(),
    cat: document.getElementById('itemCat').value.trim(),
    desc: document.getElementById('itemDesc').value.trim(),
    price: Math.max(0, parseFloat(document.getElementById('itemPrice').value) || 0),
    emoji: document.getElementById('itemEmoji').value.trim() || '🍽️',
    available: document.getElementById('itemAvail').checked,
    wrapped: document.getElementById('itemWrapped').checked
  };
  if(idVal){
    const it = menuCache.find(m => m.id === Number(idVal));
    Object.assign(it, data);
  } else {
    const newId = menuCache.reduce((mx,m) => Math.max(mx, m.id), 0) + 1;
    menuCache.push(Object.assign({id:newId}, data));
  }
  itemModal.classList.remove('show');
  renderMenuTable(); renderStats(); persistMenu('تم الحفظ ✓');
};

// ===== Stats =====
function renderStats(){
  const totalRevenue = ordersCache
    .filter(o => (o.status||'new') !== 'cancelled')
    .reduce((s,o) => s + (o.total||0), 0);
  const newCount = ordersCache.filter(o => (o.status||'new') === 'new').length;
  const doneCount = ordersCache.filter(o => o.status === 'done').length;

  const cards = [
    {ic:'📋', val:ordersCache.length, lbl:'إجمالي الطلبات'},
    {ic:'🆕', val:newCount, lbl:'طلبات جديدة'},
    {ic:'✅', val:doneCount, lbl:'طلبات مكتملة'},
    {ic:'💰', val:money(totalRevenue), lbl:'إجمالي الإيرادات', money:true},
    {ic:'🍴', val:menuCache.length, lbl:'عدد الأصناف'}
  ];
  document.getElementById('statsGrid').innerHTML = cards.map(c =>
    '<div class="stat-card"><div class="ic">' + c.ic + '</div>' +
    '<div class="val' + (c.money?' money-val':'') + '">' + c.val + '</div><div class="lbl">' + c.lbl + '</div></div>'
  ).join('');
}

// ===== Settings =====
// ===== أزرار/أيقونات الواجهة =====
const UI_BTN_DEFS = [
  {key:'posSwitch',   label:'🔄 تبديل مستخدم'},
  {key:'bioEnroll',   label:'👆 تفعيل الدخول بالبصمة'},
  {key:'extForm',     label:'➕ إنشاء استمارة جديدة'},
  {key:'posLogout',   label:'🚪 خروج'},
  {key:'customers',   label:'🧾 العملاء'},
  {key:'notif',       label:'🔔 الإشعارات'},
  {key:'week',        label:'📅 طلبات الأسبوع'},
  {key:'dailyReport', label:'📊 التقارير'},
  {key:'admin',       label:'⚙️ لوحة التحكم'},
  {key:'messages',    label:'💬 إشعارات الرسائل'}
];
function renderUiButtonsEditor(ui){
  const host = document.getElementById('uiButtonsList'); if(!host) return;
  ui = ui || {}; const buttons = ui.buttons || {};
  const sc = document.getElementById('setIconScale'); if(sc) sc.value = (ui.iconScale != null ? ui.iconScale : 100);
  const scv = document.getElementById('setIconScaleVal'); if(scv) scv.textContent = (ui.iconScale != null ? ui.iconScale : 100) + '%';
  host.innerHTML = UI_BTN_DEFS.map(function(d){
    const b = buttons[d.key] || {show:true, scale:100};
    return '<div class="uibtn-row" style="display:flex;align-items:center;gap:10px;padding:7px 0;border-bottom:1px dashed #e2e8f0;flex-wrap:wrap">'+
      '<label class="check-row" style="flex:1;margin:0;min-width:180px"><input type="checkbox" data-uibtn-show="'+d.key+'"'+(b.show!==false?' checked':'')+' /> '+d.label+'</label>'+
      '<span style="font-size:12px;color:#64748b">الحجم</span>'+
      '<input type="number" data-uibtn-scale="'+d.key+'" value="'+(b.scale!=null?b.scale:100)+'" min="70" max="160" step="5" style="width:72px" /> %'+
    '</div>';
  }).join('');
}
function collectUiButtons(){
  const buttons = {};
  UI_BTN_DEFS.forEach(function(d){
    const showEl = document.querySelector('[data-uibtn-show="'+d.key+'"]');
    const scEl = document.querySelector('[data-uibtn-scale="'+d.key+'"]');
    buttons[d.key] = {
      show: showEl ? !!showEl.checked : true,
      scale: Math.min(160, Math.max(70, parseInt(scEl ? scEl.value : 100, 10) || 100))
    };
  });
  const sc = document.getElementById('setIconScale');
  return { iconScale: Math.min(160, Math.max(70, parseInt(sc ? sc.value : 100, 10) || 100)), buttons: buttons };
}

// ===== تقسيم إعدادات اللوحة إلى خانات مسمّاة (شريط أقسام) =====
const SETTINGS_SECTIONS = [
  {id:'all',    label:'الكل', match:function(){ return true; }},
  {id:'store',  label:'🏪 المتجر والفاتورة', kw:['بيانات النظام','ترويسة','الطباعة','الضريبة','خانات إضافية','الفاتورة المتقدمة']},
  {id:'pos',    label:'🧾 الكاشير والأزرار', kw:['الدفع والطباعة','أزرار نوع الطلب','أزرار الواجهة','ترتيب قائمة','الإيداع']},
  {id:'look',   label:'🎨 المظهر والتجربة', kw:['تخصيص الواجهة','تجربة الاستخدام','الخطوط','توفير البيانات']},
  {id:'comm',   label:'🔔 الإشعارات والدردشة', kw:['إشعارات الطلبات','دردشة']},
  {id:'login',  label:'🔐 شاشة الدخول', kw:['شاشة تسجيل الدخول']},
  {id:'ops',    label:'⚙️ العمليات والبيانات', kw:['الفتح التلقائي','استمارة عميل','النسخ الاحتياطي','المحو التلقائي','Netlify']}
];
function cardSection(card){
  const h = card.querySelector('h3'); const t = h ? h.textContent : '';
  for(let i=1;i<SETTINGS_SECTIONS.length;i++){
    const s = SETTINGS_SECTIONS[i];
    if(s.kw && s.kw.some(function(k){ return t.indexOf(k) !== -1; })) return s.id;
  }
  return 'store';
}
function buildSettingsSecNav(){
  const nav = document.getElementById('settingsSecNav'); if(!nav) return;
  const cards = Array.prototype.slice.call(document.querySelectorAll('#tab-settings .settings-card'));
  cards.forEach(function(c){ c.setAttribute('data-sec', cardSection(c)); });
  nav.innerHTML = SETTINGS_SECTIONS.map(function(s,i){
    return '<button type="button" class="sec-chip'+(i===0?' active':'')+'" data-sec="'+s.id+'">'+s.label+'</button>';
  }).join('');
  nav.querySelectorAll('.sec-chip').forEach(function(ch){
    ch.onclick = function(){
      nav.querySelectorAll('.sec-chip').forEach(function(x){ x.classList.remove('active'); });
      ch.classList.add('active');
      const sec = ch.getAttribute('data-sec');
      cards.forEach(function(c){
        c.style.display = (sec === 'all' || c.getAttribute('data-sec') === sec) ? '' : 'none';
      });
    };
  });
}
if(document.readyState !== 'loading') buildSettingsSecNav();
else document.addEventListener('DOMContentLoaded', buildSettingsSecNav);

function fillSettingsForm(cfg){
  if(!cfg) return;
  // تحديث اسم النظام الظاهر في الشريط الجانبي وعنوان الصفحة
  const brand = document.getElementById('brandName');
  if(brand && cfg.name) brand.textContent = cfg.name;
  if(cfg.name) document.title = 'لوحة التحكم — ' + cfg.name;
  const p = cfg.print || {};
  const chk = (id, v) => { const el = document.getElementById(id); if(el) el.checked = v === true; };
  chk('setAllowDeposit', cfg.allowDeposit !== false);
  chk('setDirectPrint', cfg.directPrint === true);
  chk('setQtyEdit', cfg.qtyEdit !== false);
  chk('setNotifEnabled', cfg.notifEnabled !== false);
  chk('setNotifSound', cfg.notifSound !== false);
  chk('setShowVat', cfg.showVat === true);
  chk('setQrEnabled', cfg.qrEnabled !== false);
  // أزرار نوع الطلب (محلي/سفري/توصيل)
  const ot = cfg.orderTypes || {};
  chk('setTypeLocal', ot.local !== false);
  chk('setTypeTakeaway', ot.takeaway !== false);
  chk('setTypeDelivery', ot.delivery !== false);
  // إعدادات الواجهة والأمان الجديدة
  chk('setCompactMenu', cfg.compactMenu === true);
  chk('setBigText', cfg.bigText === true);
  chk('setClickSound', cfg.clickSound === true);
  chk('setAutoLock', cfg.autoLock === true);
  renderCustomFields(Array.isArray(cfg.customFields) ? cfg.customFields : []);
  renderTaskPresets(Array.isArray(cfg.taskPresets) ? cfg.taskPresets : []);
  renderExchanges(Array.isArray(cfg.exchanges) ? cfg.exchanges : []);
  fillCustForm(cfg.custForm || {});
  // أزرار/أيقونات الواجهة + الدردشة
  renderUiButtonsEditor(cfg.ui || {});
  chk('setChatEnabled', cfg.chatEnabled !== false);
  const set = (id, v) => { const el = document.getElementById(id); if(el) el.value = (v == null ? '' : v); };
  set('setName', cfg.name);
  set('setHeaderBrand', cfg.headerBrand);
  set('setHeaderTagline', cfg.headerTagline);
  set('setDevName', cfg.devName);
  currentLogo = cfg.logo || '';
  updateLogoPreview();
  set('setAddress', cfg.address);
  set('setPhone', cfg.phone);
  set('setVatNo', cfg.vatNo);
  set('setVatRate', Math.round((Number(cfg.vatRate)||0) * 100 * 100) / 100);
  set('setCurrency', cfg.currency || 'YER');
  set('setFooter', cfg.footer);
  set('setAlign', p.align || 'center');
  set('setMarginSide', p.marginSide != null ? p.marginSide : 4);
  set('setMarginTop', p.marginTop != null ? p.marginTop : 0);
  set('setPaddingV', p.paddingV != null ? p.paddingV : 6);
  set('setFontSize', p.fontSize != null ? p.fontSize : 12);
  set('setAutoLockMin', cfg.autoLockMin != null ? cfg.autoLockMin : 5);
  const dsw = document.getElementById('setDataSaver'); if(dsw) dsw.checked = !!cfg.dataSaver;
  set('setDataSaverDays', cfg.dataSaverDays != null ? cfg.dataSaverDays : 30);
  const wao = document.getElementById('setWeeklyAutoOpen'); if(wao) wao.checked = !!cfg.weeklyAutoOpen;
  renderWeeklyTimes(Array.isArray(cfg.weeklyAutoOpenTimes) ? cfg.weeklyAutoOpenTimes : []);
  chk('setWeeklyOnNewOrder', cfg.weeklyOnNewOrder === true);
  chk('setWeeklyNewGlow', cfg.weeklyNewGlow !== false);
  chk('setWeeklyStayOpen', cfg.weeklyStayOpen !== false);
  chk('setWeeklyJumpToNew', cfg.weeklyJumpToNew !== false);
  set('setWeeklyGlowMinutes', cfg.weeklyGlowMinutes != null ? cfg.weeklyGlowMinutes : 2);
  set('setWeeklyHighlightMax', cfg.weeklyHighlightMax != null ? cfg.weeklyHighlightMax : 20);
  // ===== الخطوط العامة للنظام =====
  const fn = cfg.fonts || {};
  set('setFontBase', fn.base != null ? fn.base : 100);
  set('setFontHeading', fn.heading != null ? fn.heading : 100);
  set('setFontTable', fn.table != null ? fn.table : 100);
  set('setFontButton', fn.button != null ? fn.button : 100);
  set('setFontInput', fn.input != null ? fn.input : 100);
  // ===== إعدادات الفاتورة المتقدمة =====
  const iv = cfg.invoice || {};
  set('setInvFontHeading', iv.fontHeading != null ? iv.fontHeading : 18);
  set('setInvFontBody', iv.fontBody != null ? iv.fontBody : 12);
  set('setInvFontTable', iv.fontTable != null ? iv.fontTable : 12);
  set('setInvFontTotal', iv.fontTotal != null ? iv.fontTotal : 14);
  set('setInvFontFooter', iv.fontFooter != null ? iv.fontFooter : 11);
  chk('setInvShowLogo', iv.showLogo !== false);
  chk('setInvShowTagline', iv.showTagline !== false);
  chk('setInvShowAddress', iv.showAddress !== false);
  chk('setInvShowPhone', iv.showPhone !== false);
  chk('setInvShowPickup', iv.showPickup !== false);
  chk('setInvShowTheme', iv.showTheme !== false);
  chk('setInvShowCashier', iv.showCashier !== false);
  chk('setInvShowFooter', iv.showFooter !== false);
  const invOrderEl = document.getElementById('setInvOrder');
  if(invOrderEl){
    const io = (Array.isArray(iv.order) && iv.order.length) ? iv.order : ['header','meta','items','totals','payment','footer','qr'];
    invOrderEl.value = io.join('\n');
  }
  // ===== ترتيب قائمة الطلبات =====
  set('setOrdersSort', (cfg.ordersSort === 'oldest') ? 'oldest' : 'newest');
  // ===== شاشة تسجيل الدخول =====
  const lsc = cfg.loginScreen || {};
  chk('setLoginShowSignup', lsc.showSignupBtn !== false);
  chk('setLoginShowCheck', lsc.showCheckStatusBtn !== false);
  chk('setLoginBio', lsc.bioEnabled !== false);
  chk('setLoginFace', lsc.faceEnabled !== false);
  set('setLoginTitle', lsc.title || '');
  set('setLoginSubtitle', lsc.subtitle || '');
  currentLoginBg = lsc.bgImage || '';
  updateLoginBgPreview();
  if(window.AdminUI){ window.AdminUI.fill(cfg); }
  if(window.AdminExtra){ window.AdminExtra.fill(cfg); window.AdminExtra.autoRun(cfg); }
}

document.getElementById('settingsForm').onsubmit = async function(e){
  e.preventDefault();
  const num = (id, def) => { const v = parseFloat(document.getElementById(id).value); return isNaN(v) ? def : v; };
  const cfg = {
    name:    document.getElementById('setName').value.trim() || 'نظام',
    headerBrand: document.getElementById('setHeaderBrand').value.trim(),
    headerTagline: document.getElementById('setHeaderTagline').value.trim(),
    devName: document.getElementById('setDevName').value.trim(),
    logo: currentLogo || '',
    address: document.getElementById('setAddress').value.trim(),
    phone:   document.getElementById('setPhone').value.trim(),
    vatNo:   document.getElementById('setVatNo').value.trim(),
    vatRate: Math.max(0, num('setVatRate', 15)) / 100,
    currency: document.getElementById('setCurrency').value,
    footer:  document.getElementById('setFooter').value.trim(),
    allowDeposit: document.getElementById('setAllowDeposit').checked,
    directPrint: document.getElementById('setDirectPrint').checked,
    qtyEdit: document.getElementById('setQtyEdit').checked,
    notifEnabled: document.getElementById('setNotifEnabled').checked,
    notifSound: document.getElementById('setNotifSound').checked,
    showVat: document.getElementById('setShowVat').checked,
    qrEnabled: document.getElementById('setQrEnabled').checked,
    // إظهار/إخفاء أزرار نوع الطلب (مع ضمان بقاء زر واحد على الأقل)
    orderTypes: (function(){
      let local    = !!(document.getElementById('setTypeLocal')||{}).checked;
      let takeaway = !!(document.getElementById('setTypeTakeaway')||{}).checked;
      let delivery = !!(document.getElementById('setTypeDelivery')||{}).checked;
      if(!local && !takeaway && !delivery) local = true;
      return { local, takeaway, delivery };
    })(),
    // تخصيص الواجهة والأمان (إعدادات جديدة)
    compactMenu: !!(document.getElementById('setCompactMenu')||{}).checked,
    bigText: !!(document.getElementById('setBigText')||{}).checked,
    clickSound: !!(document.getElementById('setClickSound')||{}).checked,
    autoLock: !!(document.getElementById('setAutoLock')||{}).checked,
    autoLockMin: Math.min(120, Math.max(1, parseInt((document.getElementById('setAutoLockMin')||{}).value, 10) || 5)),
    // تجربة الاستخدام والمظهر (إعدادات جديدة)
    adminDark: !!(document.getElementById('setAdminDark')||{}).checked,
    hideMoney: !!(document.getElementById('setHideMoney')||{}).checked,
    autoRefresh: !!(document.getElementById('setAutoRefresh')||{}).checked,
    autoRefreshSec: Math.min(600, Math.max(10, parseInt((document.getElementById('setAutoRefreshSec')||{}).value, 10) || 60)),
    // توفير البيانات
    dataSaver: !!(document.getElementById('setDataSaver')||{}).checked,
    dataSaverDays: Math.min(365, Math.max(1, parseInt((document.getElementById('setDataSaverDays')||{}).value, 10) || 30)),
    // الفتح التلقائي لطلبات الأسبوع
    weeklyAutoOpen: !!(document.getElementById('setWeeklyAutoOpen')||{}).checked,
    weeklyAutoOpenTimes: collectWeeklyTimes(),
    // الفتح عند وصول طلب جديد + الإضاءة الزرقاء
    weeklyOnNewOrder: !!(document.getElementById('setWeeklyOnNewOrder')||{}).checked,
    weeklyNewGlow: !!(document.getElementById('setWeeklyNewGlow')||{}).checked,
    weeklyGlowMinutes: Math.min(60, Math.max(1, parseInt((document.getElementById('setWeeklyGlowMinutes')||{}).value, 10) || 2)),
    weeklyStayOpen: !!(document.getElementById('setWeeklyStayOpen')||{}).checked,
    weeklyJumpToNew: !!(document.getElementById('setWeeklyJumpToNew')||{}).checked,
    weeklyHighlightMax: Math.min(100, Math.max(1, parseInt((document.getElementById('setWeeklyHighlightMax')||{}).value, 10) || 20)),
    // الخطوط العامة للنظام (نِسَب مئوية 60–200)
    fonts: {
      base:    Math.min(200, Math.max(60, parseInt((document.getElementById('setFontBase')||{}).value, 10) || 100)),
      heading: Math.min(200, Math.max(60, parseInt((document.getElementById('setFontHeading')||{}).value, 10) || 100)),
      table:   Math.min(200, Math.max(60, parseInt((document.getElementById('setFontTable')||{}).value, 10) || 100)),
      button:  Math.min(200, Math.max(60, parseInt((document.getElementById('setFontButton')||{}).value, 10) || 100)),
      input:   Math.min(200, Math.max(60, parseInt((document.getElementById('setFontInput')||{}).value, 10) || 100))
    },
    // إعدادات الفاتورة المتقدمة (مستقلة عن الطباعة)
    invoice: (function(){
      const ALLOWED_BLK = ['header','meta','items','totals','payment','footer','qr'];
      let ord = ((document.getElementById('setInvOrder')||{}).value || '').split('\n').map(s => s.trim()).filter(s => ALLOWED_BLK.indexOf(s) !== -1);
      ALLOWED_BLK.forEach(s => { if(ord.indexOf(s) === -1) ord.push(s); });
      if(!ord.length) ord = ALLOWED_BLK.slice();
      const ivck = id => !!(document.getElementById(id)||{}).checked;
      const ivn = (id, def, lo, hi) => Math.min(hi, Math.max(lo, parseInt((document.getElementById(id)||{}).value, 10) || def));
      return {
        fontHeading: ivn('setInvFontHeading', 18, 8, 40),
        fontBody:    ivn('setInvFontBody', 12, 8, 30),
        fontTable:   ivn('setInvFontTable', 12, 8, 30),
        fontTotal:   ivn('setInvFontTotal', 14, 8, 34),
        fontFooter:  ivn('setInvFontFooter', 11, 8, 26),
        showLogo:    ivck('setInvShowLogo'),
        showTagline: ivck('setInvShowTagline'),
        showAddress: ivck('setInvShowAddress'),
        showPhone:   ivck('setInvShowPhone'),
        showPickup:  ivck('setInvShowPickup'),
        showTheme:   ivck('setInvShowTheme'),
        showCashier: ivck('setInvShowCashier'),
        showFooter:  ivck('setInvShowFooter'),
        order: ord
      };
    })(),
    // ترتيب قائمة الطلبات الافتراضي
    ordersSort: ((document.getElementById('setOrdersSort')||{}).value === 'oldest') ? 'oldest' : 'newest',
    // شاشة تسجيل الدخول (خلفية + أزرار + دخول حيوي)
    loginScreen: {
      bgImage: currentLoginBg || '',
      showSignupBtn: !!(document.getElementById('setLoginShowSignup')||{}).checked,
      showCheckStatusBtn: !!(document.getElementById('setLoginShowCheck')||{}).checked,
      bioEnabled: !!(document.getElementById('setLoginBio')||{}).checked,
      faceEnabled: !!(document.getElementById('setLoginFace')||{}).checked,
      title: ((document.getElementById('setLoginTitle')||{}).value || '').trim(),
      subtitle: ((document.getElementById('setLoginSubtitle')||{}).value || '').trim()
    },
    // حقول النسخ الاحتياطي / المحو / Netlify (تُحفظ مع بقية الإعدادات)
    backupEnabled: !!(document.getElementById('setBackupEnabled')||{}).checked,
    backupFreq: (document.getElementById('setBackupFreq')||{}).value || 'weekly',
    backupLastRun: (settingsCache && settingsCache.backupLastRun) || 0,
    purgeEnabled: !!(document.getElementById('setPurgeEnabled')||{}).checked,
    purgeKeepDays: Math.max(1, parseInt((document.getElementById('setPurgeKeepDays')||{}).value, 10) || 7),
    purgeLastRun: (settingsCache && settingsCache.purgeLastRun) || 0,
    netlifyToken: (document.getElementById('setNetlifyToken')||{}).value || '',
    netlifySlug: (document.getElementById('setNetlifySlug')||{}).value || '',
    netlifySiteId: (document.getElementById('setNetlifySiteId')||{}).value || '',
    customFields: collectCustomFields(),
    taskPresets: collectTaskPresets(),
    exchanges: collectExchanges(),
    custForm: collectCustForm(),
    // أزرار/أيقونات الواجهة + الدردشة
    ui: collectUiButtons(),
    chatEnabled: !!(document.getElementById('setChatEnabled')||{checked:true}).checked,
    print: {
      align:      document.getElementById('setAlign').value,
      marginSide: Math.max(0, num('setMarginSide', 4)),
      marginTop:  Math.max(0, num('setMarginTop', 0)),
      paddingV:   Math.max(0, num('setPaddingV', 6)),
      fontSize:   Math.max(8, num('setFontSize', 12))
    }
  };
  try{
    const saved = await DB.saveSettings(cfg);
    settingsCache = saved;
    if(window.AdminUI){ window.AdminUI.applyAppearance(cfg); }
    applyDataSaver(cfg);
    showToast('تم حفظ الإعدادات ✓');
  }catch(err){ console.error(err); showToast('تعذر حفظ الإعدادات'); }
};

// ===== شعار الفاتورة =====
let currentLogo = ''; // dataURL للشعار الحالي

function updateLogoPreview(){
  const img = document.getElementById('logoPreview');
  const rm = document.getElementById('removeLogoBtn');
  if(!img) return;
  if(currentLogo){
    img.src = currentLogo; img.style.display = '';
    if(rm) rm.style.display = '';
  } else {
    img.src = ''; img.style.display = 'none';
    if(rm) rm.style.display = 'none';
  }
}

// تصغير الصورة إلى dataURL صغير مناسب للتخزين والطباعة
function resizeImageToDataUrl(file, maxDim, cb){
  const reader = new FileReader();
  reader.onload = function(ev){
    const im = new Image();
    im.onload = function(){
      let w = im.width, h = im.height;
      if(w > maxDim || h > maxDim){
        if(w >= h){ h = Math.round(h * maxDim / w); w = maxDim; }
        else { w = Math.round(w * maxDim / h); h = maxDim; }
      }
      const cv = document.createElement('canvas');
      cv.width = w; cv.height = h;
      const ctx = cv.getContext('2d');
      ctx.fillStyle = '#fff'; ctx.fillRect(0,0,w,h);
      ctx.drawImage(im, 0, 0, w, h);
      let out;
      try{ out = cv.toDataURL('image/jpeg', 0.8); }
      catch(e){ out = cv.toDataURL(); }
      cb(out);
    };
    im.onerror = function(){ cb(null); };
    im.src = ev.target.result;
  };
  reader.onerror = function(){ cb(null); };
  reader.readAsDataURL(file);
}

(function(){
  const fileInput = document.getElementById('setLogoFile');
  if(fileInput){
    fileInput.onchange = function(){
      const f = fileInput.files && fileInput.files[0];
      if(!f) return;
      if(!/^image\//.test(f.type)){ showToast('الرجاء اختيار ملف صورة'); return; }
      resizeImageToDataUrl(f, 260, function(dataUrl){
        if(!dataUrl){ showToast('تعذر قراءة الصورة'); return; }
        currentLogo = dataUrl;
        updateLogoPreview();
        showToast('تم تحميل الشعار — اضغط حفظ الإعدادات');
      });
    };
  }
  const rm = document.getElementById('removeLogoBtn');
  if(rm){ rm.onclick = function(){ currentLogo = ''; const fi = document.getElementById('setLogoFile'); if(fi) fi.value=''; updateLogoPreview(); }; }
})();

// ===== خلفية شاشة تسجيل الدخول =====
let currentLoginBg = ''; // dataURL/رابط لخلفية شاشة الدخول

function updateLoginBgPreview(){
  const img = document.getElementById('loginBgPreview');
  const rm = document.getElementById('removeLoginBgBtn');
  if(!img) return;
  if(currentLoginBg){
    img.src = currentLoginBg; img.style.display = '';
    if(rm) rm.style.display = '';
  } else {
    img.src = ''; img.style.display = 'none';
    if(rm) rm.style.display = 'none';
  }
}

(function(){
  const fileInput = document.getElementById('setLoginBgFile');
  if(fileInput){
    fileInput.onchange = function(){
      const f = fileInput.files && fileInput.files[0];
      if(!f) return;
      if(!/^image\//.test(f.type)){ showToast('الرجاء اختيار ملف صورة'); return; }
      // خلفية ملء الشاشة — أبعاد أكبر لجودة أفضل
      resizeImageToDataUrl(f, 1280, function(dataUrl){
        if(!dataUrl){ showToast('تعذر قراءة الصورة'); return; }
        currentLoginBg = dataUrl;
        updateLoginBgPreview();
        showToast('تم تحميل الخلفية — اضغط حفظ الإعدادات');
      });
    };
  }
  const rm = document.getElementById('removeLoginBgBtn');
  if(rm){ rm.onclick = function(){ currentLoginBg = ''; const fi = document.getElementById('setLoginBgFile'); if(fi) fi.value=''; updateLoginBgPreview(); }; }
})();

// ===== خانات إضافية في الفاتورة =====
function addCustomFieldRow(label, value){
  const list = document.getElementById('customFieldsList');
  if(!list) return;
  const row = document.createElement('div');
  row.className = 'cf-row';
  const li = document.createElement('input');
  li.type = 'text'; li.className = 'cf-label'; li.maxLength = 40;
  li.placeholder = 'العنوان (مثل: الفرع)'; li.value = label || '';
  const vi = document.createElement('input');
  vi.type = 'text'; vi.className = 'cf-value'; vi.maxLength = 80;
  vi.placeholder = 'القيمة (مثل: الرياض)'; vi.value = value || '';
  const del = document.createElement('button');
  del.type = 'button'; del.className = 'cf-del'; del.textContent = '✕';
  del.onclick = () => row.remove();
  row.appendChild(li); row.appendChild(vi); row.appendChild(del);
  list.appendChild(row);
}

function renderCustomFields(fields){
  const list = document.getElementById('customFieldsList');
  if(!list) return;
  list.innerHTML = '';
  (fields || []).forEach(f => addCustomFieldRow(f && f.label, f && f.value));
}

function collectCustomFields(){
  const out = [];
  document.querySelectorAll('#customFieldsList .cf-row').forEach(row => {
    const label = (row.querySelector('.cf-label').value || '').trim();
    const value = (row.querySelector('.cf-value').value || '').trim();
    if(label || value) out.push({label: label, value: value});
  });
  return out;
}

(function(){
  const btn = document.getElementById('addCustomFieldBtn');
  if(btn) btn.onclick = () => addCustomFieldRow('', '');
})();

// ===== قائمة المهام (مهام اليوم) =====
function addTaskPresetRow(label){
  const list = document.getElementById('taskPresetsList');
  if(!list) return;
  const row = document.createElement('div');
  row.className = 'cf-row task-preset-row';
  const li = document.createElement('input');
  li.type = 'text'; li.className = 'tp-label'; li.maxLength = 80;
  li.placeholder = 'اسم المهمة (مثل: تنظيف الفرن)'; li.value = label || '';
  const del = document.createElement('button');
  del.type = 'button'; del.className = 'cf-del'; del.textContent = '✕';
  del.onclick = () => row.remove();
  row.appendChild(li); row.appendChild(del);
  list.appendChild(row);
}

function renderTaskPresets(presets){
  const list = document.getElementById('taskPresetsList');
  if(!list) return;
  list.innerHTML = '';
  (presets || []).forEach(p => addTaskPresetRow(typeof p === 'string' ? p : (p && p.label)));
}

function collectTaskPresets(){
  const out = [];
  document.querySelectorAll('#taskPresetsList .task-preset-row').forEach(row => {
    const label = (row.querySelector('.tp-label').value || '').trim();
    if(label && out.indexOf(label) === -1) out.push(label);
  });
  return out;
}

(function(){
  const btn = document.getElementById('addTaskPresetBtn');
  if(btn) btn.onclick = () => addTaskPresetRow('');
})();

// ===== الصرافون (إعدادات الإيداع) =====
function addExchangeRow(name, color){
  const list = document.getElementById('exchangesList');
  if(!list) return;
  const row = document.createElement('div');
  row.className = 'cf-row exch-row';
  const ni = document.createElement('input');
  ni.type = 'text'; ni.className = 'ex-name'; ni.maxLength = 60;
  ni.placeholder = 'اسم الصراف (مثل: شركة المشقاص للصرافة)'; ni.value = name || '';
  const ci = document.createElement('input');
  ci.type = 'color'; ci.className = 'ex-color'; ci.title = 'لون خلفية الاسم';
  ci.value = color || '#16a34a';
  const del = document.createElement('button');
  del.type = 'button'; del.className = 'cf-del'; del.textContent = '✕';
  del.onclick = () => row.remove();
  row.appendChild(ni); row.appendChild(ci); row.appendChild(del);
  list.appendChild(row);
}

function renderExchanges(exchanges){
  const list = document.getElementById('exchangesList');
  if(!list) return;
  list.innerHTML = '';
  (exchanges || []).forEach(e => addExchangeRow(e && e.name, e && e.color));
}

function collectExchanges(){
  const out = [];
  document.querySelectorAll('#exchangesList .exch-row').forEach(row => {
    const name = (row.querySelector('.ex-name').value || '').trim();
    const color = (row.querySelector('.ex-color').value || '#16a34a').trim();
    if(name) out.push({name: name, color: color});
  });
  return out;
}

(function(){
  const btn = document.getElementById('addExchangeBtn');
  if(btn) btn.onclick = () => addExchangeRow('', '#16a34a');
})();

// ===== استمارة عميل جديد (طلبات الحساب) =====
function addCfExtraRow(label, type, required){
  const list = document.getElementById('cfExtraList');
  if(!list) return;
  const row = document.createElement('div');
  row.className = 'cf-row cfx-row';
  const li = document.createElement('input');
  li.type = 'text'; li.className = 'cfx-label'; li.maxLength = 40;
  li.placeholder = 'عنوان الخانة (مثل: عنوان التوصيل)'; li.value = label || '';
  const ty = document.createElement('select');
  ty.className = 'cfx-type';
  [['text','نص قصير'],['textarea','نص طويل'],['number','رقم']].forEach(function(o){
    const op = document.createElement('option'); op.value = o[0]; op.textContent = o[1];
    if((type||'text') === o[0]) op.selected = true;
    ty.appendChild(op);
  });
  const rqWrap = document.createElement('label');
  rqWrap.className = 'cfx-req';
  rqWrap.style.cssText = 'display:flex;align-items:center;gap:4px;font-size:12px;white-space:nowrap';
  const rq = document.createElement('input');
  rq.type = 'checkbox'; rq.className = 'cfx-required'; rq.checked = !!required;
  rqWrap.appendChild(rq); rqWrap.appendChild(document.createTextNode('إلزامي'));
  const del = document.createElement('button');
  del.type = 'button'; del.className = 'cf-del'; del.textContent = '✕';
  del.onclick = () => row.remove();
  row.appendChild(li); row.appendChild(ty); row.appendChild(rqWrap); row.appendChild(del);
  list.appendChild(row);
}

function fillCustForm(cf){
  const chk = (id, v) => { const el = document.getElementById(id); if(el) el.checked = !!v; };
  chk('setCfEnabled', cf.enabled !== false);
  chk('setCfAskName', cf.askName !== false);
  chk('setCfNameReq', cf.nameRequired !== false);
  chk('setCfAskPhone', cf.askPhone !== false);
  chk('setCfPhoneReq', cf.phoneRequired === true);
  chk('setCfAskWa', cf.askWhatsapp !== false);
  chk('setCfAskDeposit', cf.askDeposit !== false);
  chk('setCfAskTheme', cf.askTheme !== false);
  chk('setCfAskPickup', cf.askPickup !== false);
  const vh = document.getElementById('setCfValidHours');
  if(vh) vh.value = (cf.validHours != null ? cf.validHours : 24);
  const occ = document.getElementById('setCfOccasions');
  if(occ){
    const arr = (Array.isArray(cf.occasions) && cf.occasions.length) ? cf.occasions : ['مولود','مولودة','توم','زواج','خطوبة'];
    occ.value = arr.join('\n');
  }
  // إعدادات عرض الاستمارة الجديدة
  const cfSet = (id, v) => { const el = document.getElementById(id); if(el) el.value = (v == null ? '' : v); };
  cfSet('setCfTitle', cf.title || '');
  cfSet('setCfIntro', (cf.introText != null) ? cf.introText : 'اكتب كل طلبك هنا، وتأكد من المعلومات والنصوص قبل الإرسال، ولا تنسَ تحديد يوم الطلب لأن التعديل يكون صعباً.\n\nنتمنى لكم وجبة شهية.');
  cfSet('setCfFontSize', cf.fontSize != null ? cf.fontSize : 15);
  chk('setCfShowCreator', cf.showCreator !== false);
  const cfso = document.getElementById('setCfSectionOrder');
  if(cfso){
    const so = (Array.isArray(cf.sectionOrder) && cf.sectionOrder.length) ? cf.sectionOrder : ['items','customer','pay','theme','pickup','extra','note'];
    cfso.value = so.join('\n');
  }
  const list = document.getElementById('cfExtraList');
  if(list){
    list.innerHTML = '';
    (Array.isArray(cf.extraFields) ? cf.extraFields : []).forEach(function(f){
      addCfExtraRow(f && f.label, f && f.type, f && f.required);
    });
  }
}

function collectCustForm(){
  const val = id => (document.getElementById(id) || {}).value;
  const ck = id => !!(document.getElementById(id) || {}).checked;
  const occRaw = (val('setCfOccasions') || '').split('\n').map(s => s.trim()).filter(Boolean);
  const ALLOWED_SEC = ['items','customer','pay','theme','pickup','extra','note'];
  let secOrder = (val('setCfSectionOrder') || '').split('\n').map(s => s.trim()).filter(s => ALLOWED_SEC.indexOf(s) !== -1);
  // أضف أي قسم مفقود لضمان ظهور كل الأقسام
  ALLOWED_SEC.forEach(s => { if(secOrder.indexOf(s) === -1) secOrder.push(s); });
  if(!secOrder.length) secOrder = ALLOWED_SEC.slice();
  const extra = [];
  document.querySelectorAll('#cfExtraList .cfx-row').forEach(function(row){
    const label = (row.querySelector('.cfx-label').value || '').trim();
    const type = row.querySelector('.cfx-type').value || 'text';
    const required = !!row.querySelector('.cfx-required').checked;
    if(label) extra.push({ id: 'x_' + Math.random().toString(36).slice(2,8), label: label, type: type, required: required });
  });
  return {
    enabled: ck('setCfEnabled'),
    validHours: Math.min(168, Math.max(1, parseInt(val('setCfValidHours'), 10) || 24)),
    askName: ck('setCfAskName'), nameRequired: ck('setCfNameReq'),
    askPhone: ck('setCfAskPhone'), phoneRequired: ck('setCfPhoneReq'),
    askWhatsapp: ck('setCfAskWa'), askDeposit: ck('setCfAskDeposit'),
    askTheme: ck('setCfAskTheme'), askPickup: ck('setCfAskPickup'),
    extraFields: extra,
    occasions: occRaw.length ? occRaw : ['مولود','مولودة','توم','زواج','خطوبة'],
    title: (val('setCfTitle') || '').trim(),
    introText: (val('setCfIntro') != null ? val('setCfIntro') : ''),
    fontSize: Math.min(26, Math.max(11, parseInt(val('setCfFontSize'), 10) || 15)),
    showCreator: ck('setCfShowCreator'),
    sectionOrder: secOrder
  };
}

(function(){
  const btn = document.getElementById('addCfExtraBtn');
  if(btn) btn.onclick = () => addCfExtraRow('', 'text', false);
})();

(function(){
  const btn = document.getElementById('addWeeklyTimeBtn');
  if(btn) btn.onclick = () => {
    const wrap = document.getElementById('weeklyTimesList');
    if(!wrap) return;
    const row = document.createElement('div');
    row.className = 'cf-row weekly-time-row';
    row.innerHTML = '<input type="time" class="weekly-time-input" value="08:00" />' +
      '<button type="button" class="cf-del" title="حذف الوقت">✕</button>';
    row.querySelector('.cf-del').onclick = () => row.remove();
    wrap.appendChild(row);
  };
})();

// تفعيل/تطبيق توفير البيانات عند حفظ الإعدادات (يمسّ طبقة البيانات مباشرة)
function applyDataSaver(cfg){
  try{ if(window.DB && typeof DB.setDataSaver === 'function'){
    DB.setDataSaver(!!(cfg && cfg.dataSaver), cfg && cfg.dataSaverDays);
  } }catch(e){ console.warn('data saver', e); }
}

// ===== Signup requests management =====
function statusLabel(s){
  return ({pending:'بانتظار المراجعة', approved:'تمت الموافقة', activated:'مُفعّل', rejected:'مرفوض'})[s] || s || '';
}
function updateSignupBadge(){
  const badge = document.getElementById('signupBadge');
  if(!badge) return;
  const n = signupCache.filter(r => r.status === 'pending').length;
  if(n > 0){ badge.textContent = n; badge.style.display = ''; }
  else { badge.style.display = 'none'; }
}
function deviceInfoHtml(d){
  if(!d || typeof d !== 'object'){
    return '<div class="sr-device"><div class="sr-device-head">📱 بيانات الجهاز</div>' +
           '<div class="sr-device-empty">لم تُسجّل بيانات الجهاز لهذا الطلب</div></div>';
  }
  const rows = [];
  const add = (label, val, ltr) => { if(val !== undefined && val !== null && val !== '') rows.push('<dt>' + label + '</dt><dd' + (ltr ? ' dir="ltr" style="text-align:right"' : '') + '>' + esc(String(val)) + '</dd>'); };
  add('الملخص', d.summary);
  add('الطراز', d.model, true);
  add('النظام', d.uaPlatform || d.platform, true);
  add('إصدار النظام', d.platformVersion, true);
  add('المعمارية', (d.arch ? (d.arch + (d.bitness ? (' / ' + d.bitness + '-bit') : '')) : ''), true);
  add('الشاشة', (d.screen ? (d.screen + (d.dpr ? (' @' + d.dpr + 'x') : '')) : ''), true);
  add('نافذة العرض', d.viewport, true);
  add('عمق الألوان', (d.depth ? (d.depth + '-bit') : ''), true);
  add('الأنوية', d.cores, true);
  add('الذاكرة (تقريبًا)', (d.ram ? (d.ram + ' GB') : ''), true);
  add('اللمس', (typeof d.touch === 'number' ? (d.touch > 0 ? ('نعم (' + d.touch + ' نقطة)') : 'لا') : ''));
  add('الشبكة', (d.net ? (d.net + (typeof d.downlink === 'number' ? (' · ' + d.downlink + ' Mbps') : '') + (d.saveData ? ' · توفير بيانات' : '')) : ''), true);
  add('اتصال الإنترنت', (typeof d.online === 'boolean' ? (d.online ? 'متصل' : 'غير متصل') : ''));
  add('المنطقة الزمنية', (d.tz ? (d.tz + (typeof d.tzOffset === 'number' ? (' (UTC' + (d.tzOffset >= 0 ? '+' : '') + d.tzOffset + ')') : '')) : ''), true);
  add('اللغة', (d.langs || d.lang), true);
  add('الشركة المصنّعة', d.vendor, true);
  if(d.capturedAt){ try{ add('وقت الالتقاط', new Date(d.capturedAt).toLocaleString('ar')); }catch(e){} }
  const uaRow = d.ua ? ('<div class="sr-device-ua" dir="ltr"><span>User-Agent:</span> ' + esc(d.ua) + '</div>') : '';
  return '<div class="sr-device">' +
           '<div class="sr-device-head">📱 بيانات الجهاز عند التسجيل</div>' +
           '<dl class="sr-info sr-device-list">' + rows.join('') + '</dl>' +
           uaRow +
         '</div>';
}

function renderSignupTable(){
  const body = document.getElementById('signupBody');
  if(!body) return;
  const filter = (document.getElementById('signupFilter')||{}).value || 'pending';
  let list = signupCache.slice().sort((a,b) => (b.createdAt||0)-(a.createdAt||0));
  if(filter !== 'all') list = list.filter(r => r.status === filter);
  if(!list.length){
    body.innerHTML = '<tr><td colspan="8" style="text-align:center;color:#94a3b8;padding:22px">لا توجد طلبات في هذه الحالة</td></tr>';
    return;
  }
  body.innerHTML = '';
  list.forEach(r => {
    const tr = document.createElement('tr');
    tr.innerHTML =
      '<td>' + esc(r.fullName || ((r.first||'') + ' ' + (r.second||''))) + '</td>' +
      '<td dir="ltr" style="text-align:right">' + esc(r.phone || '—') + '</td>' +
      '<td>' + esc(r.city || '—') + '</td>' +
      '<td>' + esc(r.username) + '</td>' +
      '<td style="font-size:12px;color:#475569">' + ((r.device && r.device.summary) ? esc(r.device.summary) : '<span style="color:#cbd5e1">—</span>') + '</td>' +
      '<td><span class="status-pill ' + esc(r.status||'pending') + '">' + statusLabel(r.status) + '</span></td>' +
      '<td dir="ltr" style="text-align:right;font-weight:900;font-size:16px;letter-spacing:3px;color:#1e3a8a">' + esc(r.code || '—') + '</td>' +
      '<td><div class="row-actions">' +
        '<button class="btn-sm primary" data-review="' + esc(r.id) + '">📋 مراجعة</button>' +
        '<button class="icon-btn del" data-delreq="' + esc(r.id) + '" title="حذف الطلب">🗑️</button>' +
      '</div></td>';
    tr.querySelector('[data-review]').onclick = () => openSignupReview(r.id);
    tr.querySelector('[data-delreq]').onclick = () => removeSignupRequest(r.id);
    body.appendChild(tr);
  });
}

function openSignupReview(id){
  const r = signupCache.find(x => x.id === id);
  if(!r) return;
  const body = document.getElementById('signupReviewBody');
  const permsDef = ['orders','customers','menu','stats','settings','users'];
  const cur = r.perms || {orders:true};
  const permHtml = permsDef.map(k =>
    '<label class="check-row"><input type="checkbox" data-perm="' + k + '"' + (cur[k] ? ' checked' : '') + ' /> ' + (PERM_LABELS[k]||k) + '</label>'
  ).join('');
  body.innerHTML =
    '<dl class="sr-info">' +
      '<dt>الاسم الكامل</dt><dd>' + esc(r.fullName || ((r.first||'')+' '+(r.second||''))) + '</dd>' +
      '<dt>رقم الجوال</dt><dd dir="ltr" style="text-align:right">' + esc(r.phone || '—') + '</dd>' +
      '<dt>المدينة</dt><dd>' + esc(r.city || '—') + '</dd>' +
      '<dt>اسم الدخول</dt><dd>' + esc(r.username) + '</dd>' +
      '<dt>كلمة المرور</dt><dd dir="ltr" style="text-align:right">' + esc(r.password || '—') + '</dd>' +
      '<dt>الحالة</dt><dd><span class="status-pill ' + esc(r.status||'pending') + '">' + statusLabel(r.status) + '</span></dd>' +
    '</dl>' +
    deviceInfoHtml(r.device) +
    '<div class="sr-code">' +
      '<span class="lbl">🔑 كود التفعيل (6 أرقام):</span>' +
      '<span class="code">' + esc(r.code || '------') + '</span>' +
      '<button type="button" class="btn-sm" id="srCopyCode">📋 نسخ</button>' +
      '<button type="button" class="btn-sm" id="srRegenCode">🔄 توليد كود جديد</button>' +
    '</div>' +
    '<label style="display:block;font-weight:800;font-size:13.5px;color:#334155;margin-bottom:8px">الدور</label>' +
    '<select id="srRole" style="width:100%;margin-bottom:14px">' +
      '<option value="كاشير">كاشير</option>' +
      '<option value="موظف">موظف</option>' +
      '<option value="مخصص">مخصص (حدد الصلاحيات أدناه)</option>' +
      '<option value="مدير">مدير (كل الصلاحيات)</option>' +
    '</select>' +
    '<label style="display:block;font-weight:800;font-size:13.5px;color:#334155;margin-bottom:8px">الصلاحيات المخصصة</label>' +
    '<div class="perm-grid">' + permHtml + '</div>' +
    '<div class="sr-actions">' +
      '<button type="button" class="btn-sm primary" id="srApprove">✅ الموافقة وإعطاء الكود</button>' +
      '<button type="button" class="btn-sm" id="srApproveSave">💾 حفظ الصلاحيات</button>' +
      '<button type="button" class="btn-sm danger" id="srReject">❌ رفض</button>' +
    '</div>';
  document.getElementById('signupReviewModal').classList.add('show');
  const roleSel = document.getElementById('srRole');
  roleSel.value = (r.role && ['كاشير','موظف','مخصص','مدير'].indexOf(r.role) !== -1) ? r.role : 'كاشير';
  // عند اختيار دور معروف طبّق صلاحياته
  roleSel.onchange = () => {
    const rp = ROLE_PERMS[roleSel.value];
    if(rp){ document.querySelectorAll('#signupReviewBody [data-perm]').forEach(cb => { cb.checked = !!rp[cb.dataset.perm]; }); }
  };
  document.getElementById('srCopyCode').onclick = () => {
    const c = String(r.code||'');
    if(navigator.clipboard) navigator.clipboard.writeText(c).then(()=>showToast('تم نسخ الكود ✓')).catch(()=>showToast('الكود: '+c));
    else showToast('الكود: ' + c);
  };
  document.getElementById('srRegenCode').onclick = async () => {
    const nc = DB.genActivationCode();
    await DB.updateSignupRequest(r.id, { code: nc, codeIssuedAt: Date.now() });
    r.code = nc; r.codeIssuedAt = Date.now();
    document.querySelector('#signupReviewBody .sr-code .code').textContent = nc;
    showToast('تم توليد كود جديد ✓ (صالح 24 ساعة)');
  };
  document.getElementById('srApproveSave').onclick = async () => {
    const { role, perms } = collectSignupPerms();
    await DB.updateSignupRequest(r.id, { role, perms, status: r.status === 'pending' ? 'approved' : r.status });
    showToast('تم حفظ الصلاحيات ✓');
    document.getElementById('signupReviewModal').classList.remove('show');
  };
  document.getElementById('srApprove').onclick = async () => {
    const { role, perms } = collectSignupPerms();
    await DB.updateSignupRequest(r.id, { role, perms, status:'approved', approvedAt: Date.now(), codeIssuedAt: Date.now() });
    showToast('✅ تمت الموافقة — أعطِ المستخدم الكود: ' + r.code + ' (صالح 24 ساعة)');
    document.getElementById('signupReviewModal').classList.remove('show');
  };
  document.getElementById('srReject').onclick = async () => {
    const reason = prompt('سبب الرفض (اختياري):') || '';
    await DB.updateSignupRequest(r.id, { status:'rejected', reason });
    showToast('تم رفض الطلب');
    document.getElementById('signupReviewModal').classList.remove('show');
  };
}

function collectSignupPerms(){
  const regenRole = (document.getElementById('srRole')||{}).value || 'كاشير';
  let perms;
  if(ROLE_PERMS[regenRole]){
    perms = Object.assign({}, ROLE_PERMS[regenRole]);
  } else {
    perms = {};
    document.querySelectorAll('#signupReviewBody [data-perm]').forEach(cb => { perms[cb.dataset.perm] = !!cb.checked; });
  }
  return { role: regenRole, perms };
}

async function removeSignupRequest(id){
  if(!confirm('حذف هذا الطلب نهائياً؟')) return;
  try{ await DB.deleteSignupRequest(id); showToast('تم حذف الطلب ✓'); }
  catch(e){ console.error(e); showToast('تعذر الحذف'); }
}

// أزرار تبويب الطلبات
document.getElementById('signupFilter').onchange = renderSignupTable;
document.getElementById('signupRefreshBtn').onclick = async () => {
  try{ signupCache = (await DB.getSignupRequests()) || []; renderSignupTable(); updateSignupBadge(); showToast('تم التحديث ✓'); }
  catch(e){ showToast('تعذر التحديث'); }
};
document.getElementById('closeSignupReview').onclick = () => document.getElementById('signupReviewModal').classList.remove('show');
document.getElementById('signupReviewModal').onclick = (e) => { if(e.target === document.getElementById('signupReviewModal')) e.target.classList.remove('show'); };

// ===== Users management =====
function renderUsersTable(){
  const body = document.getElementById('usersBody');
  if(!body) return;
  body.innerHTML = '';
  usersCache.forEach(u => {
    const perms = userPerms(u);
    const permTxt = DB.PERM_KEYS.filter(k => perms[k]).map(k => PERM_LABELS[k]).join('، ') || '—';
    const tr = document.createElement('tr');
    const isSelf = currentUser && u.username === currentUser.username;
    tr.innerHTML =
      '<td>' + esc(u.name) + (isSelf ? ' <span class="self-tag">(أنت)</span>' : '') + '</td>' +
      '<td>' + esc(u.username) + '</td>' +
      '<td><span class="role-badge">' + esc(u.role || 'مخصص') + '</span></td>' +
      '<td class="perm-cell">' + esc(permTxt) + '</td>' +
      '<td><div class="row-actions">' +
        '<button class="icon-btn" data-euser="' + u.id + '">✏️</button>' +
        '<button class="icon-btn del" data-duser="' + u.id + '"' + (isSelf ? ' disabled title="لا يمكن حذف حسابك"' : '') + '>🗑️</button>' +
      '</div></td>';
    tr.querySelector('[data-euser]').onclick = () => openUserModal(u.id);
    const del = tr.querySelector('[data-duser]');
    if(!isSelf) del.onclick = () => removeUser(u.id);
    body.appendChild(tr);
  });
}

const userModal = document.getElementById('userModal');
document.getElementById('addUserBtn').onclick = () => openUserModal(null);
document.getElementById('closeUserModal').onclick = () => userModal.classList.remove('show');
userModal.onclick = (e) => { if(e.target === userModal) userModal.classList.remove('show'); };

const PERM_INPUTS = {orders:'permOrders', customers:'permCustomers', menu:'permMenu', stats:'permStats', settings:'permSettings', users:'permUsers'};
function setPermChecks(perms){
  Object.keys(PERM_INPUTS).forEach(k => { document.getElementById(PERM_INPUTS[k]).checked = perms[k] === true; });
}
function togglePermInputs(disabled){
  Object.keys(PERM_INPUTS).forEach(k => { document.getElementById(PERM_INPUTS[k]).disabled = disabled; });
}

// صلاحية إظهار/إخفاء أزرار الواجهة لكل مستخدم
function renderUserButtonPerms(buttons){
  const host = document.getElementById('userButtonPerms'); if(!host) return;
  buttons = buttons || {};
  host.innerHTML = (typeof UI_BTN_DEFS !== 'undefined' ? UI_BTN_DEFS : []).map(function(d){
    const allowed = buttons[d.key] !== false;
    return '<label class="check-row" style="display:flex;align-items:center;gap:8px;margin:0;padding:5px 0"><input type="checkbox" data-ubtnperm="'+d.key+'"'+(allowed?' checked':'')+' /> '+d.label+'</label>';
  }).join('');
}
function collectUserButtonPerms(){
  const out = {};
  document.querySelectorAll('[data-ubtnperm]').forEach(function(cb){ out[cb.dataset.ubtnperm] = !!cb.checked; });
  return out;
}

// عند تغيير الدور تُضبط الصلاحيات تلقائياً (إلا "مخصص")
document.getElementById('userRole').onchange = function(){
  const role = this.value;
  if(ROLE_PERMS[role]){ setPermChecks(ROLE_PERMS[role]); togglePermInputs(true); }
  else { togglePermInputs(false); }
};

function openUserModal(id){
  document.getElementById('userModalTitle').textContent = id ? 'تعديل مستخدم' : 'إضافة مستخدم';
  const form = document.getElementById('userForm');
  form.reset();
  if(id){
    const u = usersCache.find(x => x.id === id);
    document.getElementById('userId').value = u.id;
    document.getElementById('userName').value = u.name || '';
    document.getElementById('userUsername').value = u.username || '';
    document.getElementById('userPassword').value = u.password || '';
    document.getElementById('userRole').value = ROLE_PERMS[u.role] ? u.role : 'مخصص';
    setPermChecks(userPerms(u));
    renderUserButtonPerms((userPerms(u) || {}).buttons);
  } else {
    document.getElementById('userId').value = '';
    document.getElementById('userRole').value = 'كاشير';
    setPermChecks(ROLE_PERMS['كاشير']);
    renderUserButtonPerms(null);
  }
  const role = document.getElementById('userRole').value;
  togglePermInputs(!!ROLE_PERMS[role]);
  userModal.classList.add('show');
}

document.getElementById('userForm').onsubmit = async function(e){
  e.preventDefault();
  const idVal = document.getElementById('userId').value;
  const username = document.getElementById('userUsername').value.trim();
  const role = document.getElementById('userRole').value;
  const perms = ROLE_PERMS[role]
    ? Object.assign({}, ROLE_PERMS[role])
    : {orders:document.getElementById('permOrders').checked,
       customers:document.getElementById('permCustomers').checked,
       menu:document.getElementById('permMenu').checked,
       stats:document.getElementById('permStats').checked,
       settings:document.getElementById('permSettings').checked,
       users:document.getElementById('permUsers').checked};
  // صلاحية أزرار الواجهة تُحفظ دائماً (مستقلة عن الدور)
  perms.buttons = collectUserButtonPerms();
  // منع تكرار اسم الدخول
  const dup = usersCache.find(x => x.username === username && String(x.id) !== String(idVal));
  if(dup){ showToast('اسم الدخول مستخدم بالفعل'); return; }
  const data = {
    name: document.getElementById('userName').value.trim(),
    username: username,
    password: document.getElementById('userPassword').value,
    role: role,
    perms: perms
  };
  if(idVal){
    const u = usersCache.find(x => String(x.id) === String(idVal));
    Object.assign(u, data);
    if(currentUser && currentUser.id === u.id) currentUser = u;
  } else {
    const newId = usersCache.reduce((mx,u) => Math.max(mx, Number(u.id)||0), 0) + 1;
    usersCache.push(Object.assign({id:newId}, data));
  }
  userModal.classList.remove('show');
  try{
    await DB.saveUsers(usersCache);
    renderUsersTable();
    showUserBadge();
    applyPermissions();
    showToast('تم الحفظ ✓');
  }catch(err){ console.error(err); showToast('تعذر حفظ المستخدم'); }
};

async function removeUser(id){
  if(usersCache.length <= 1){ showToast('لا يمكن حذف آخر مستخدم'); return; }
  if(!confirm('حذف هذا المستخدم؟')) return;
  usersCache = usersCache.filter(u => u.id !== id);
  try{
    await DB.saveUsers(usersCache);
    renderUsersTable();
    showToast('تم حذف المستخدم');
  }catch(err){ console.error(err); showToast('تعذر الحذف'); }
}

// ===== Customers & remaining balances =====
function orderRemaining(o){ return Math.max(0, Number(o.remaining) || 0); }
function payLabel(o){
  if(o.pay === 'card') return 'شبكة';
  if(o.pay === 'deposit') return 'عربون';
  return 'نقد';
}

const custFilterEl = document.getElementById('custFilter');
if(custFilterEl) custFilterEl.onchange = renderCustomers;
const orderSearchEl = document.getElementById('orderSearch');
if(orderSearchEl) orderSearchEl.oninput = renderOrders;
const adminCustSearchEl = document.getElementById('adminCustSearch');
if(adminCustSearchEl) adminCustSearchEl.oninput = renderCustomers;

function renderCustomers(){
  const wrap = document.getElementById('customersWrap');
  const summary = document.getElementById('custSummary');
  if(!wrap) return;
  const filter = custFilterEl ? custFilterEl.value : 'all';

  const all = ordersCache.slice().reverse();
  const totalRemain = all.reduce((s,o) => s + orderRemaining(o), 0);
  const remainCount = all.filter(o => orderRemaining(o) > 0).length;
  const paidCount = all.length - remainCount;

  if(summary){
    summary.innerHTML =
      '<div class="cs-box danger"><span>🔴 فواتير عليها متبقي</span><b>' + remainCount + '</b></div>' +
      '<div class="cs-box ok"><span>🟢 مدفوعة بالكامل</span><b>' + paidCount + '</b></div>' +
      '<div class="cs-box"><span>💰 إجمالي المتبقي</span><b class="money-val">' + money(Math.round(totalRemain*100)/100) + '</b></div>';
  }

  let list = all;
  if(filter === 'remaining') list = all.filter(o => orderRemaining(o) > 0);
  else if(filter === 'paid') list = all.filter(o => orderRemaining(o) === 0);
  const q = (document.getElementById('adminCustSearch') ? document.getElementById('adminCustSearch').value : '').trim().toLowerCase();
  if(q) list = list.filter(o => orderSearchText(o).includes(q));

  if(list.length === 0){
    wrap.innerHTML = '<div class="empty-state">لا توجد فواتير 🧾</div>';
    return;
  }
  wrap.innerHTML = '';
  list.forEach(o => {
    const rem = orderRemaining(o);
    const hasRem = rem > 0;
    const card = document.createElement('div');
    card.className = 'cust-card ' + (hasRem ? 'has-remain' : 'is-paid');
    card.innerHTML =
      '<span class="cust-dot ' + (hasRem ? 'red' : 'green') + '"></span>' +
      '<div class="cust-info">' +
        '<div class="cust-name">' + esc(o.name || 'عميل') + '</div>' +
        '<div class="cust-sub">' + esc(orderNoLabel(o)) + ' · ' + esc(o.date || '') + ' · ' + payLabel(o) + '</div>' +
      '</div>' +
      '<div class="cust-amounts">' +
        '<div><span>الإجمالي</span><b class="money-val">' + money(o.total) + '</b></div>' +
        '<div><span>المدفوع</span><b class="money-val">' + money(o.paid != null ? o.paid : o.total) + '</b></div>' +
        (hasRem ? '<div class="rem"><span>المتبقي</span><b class="money-val">' + money(rem) + '</b></div>' : '') +
      '</div>' +
      '<div class="cust-actions">' +
        (hasRem ? '<button class="btn-sm primary" data-settle="' + esc(o.id) + '">✔ تحصيل المتبقي</button>' : '<span class="paid-tag">مسدد بالكامل</span>') +
      '</div>';
    if(hasRem){
      card.querySelector('[data-settle]').onclick = () => settleRemaining(o.id);
    }
    wrap.appendChild(card);
  });
}

async function settleRemaining(id){
  const o = ordersCache.find(x => x.id === id);
  if(!o) return;
  const rem = orderRemaining(o);
  if(rem <= 0) return;
  if(!confirm('تأكيد تحصيل المبلغ المتبقي (' + money(rem) + ')؟')) return;
  const patch = { paid: Number(o.total) || 0, remaining: 0, change: 0, payStatus: 'paid' };
  try{
    await DB.updateOrder(id, patch);
    Object.assign(o, patch);
    renderCustomers(); renderStats();
    showToast('تم تحصيل المتبقي ✓');
  }catch(err){ console.error(err); showToast('تعذر التحديث'); }
}

// ===== النسخ الاحتياطي + المحو التلقائي + ربط Netlify =====
window.AdminExtra = (function(){
  const HIST_KEY = 'backup_history';
  const $ = id => document.getElementById(id);
  let autoDone = false;

  function fmtBytes(n){ n=Number(n)||0; if(n<1024) return n+' B'; if(n<1048576) return (n/1024).toFixed(1)+' KB'; return (n/1048576).toFixed(2)+' MB'; }
  function byteSize(o){ try{ const s=JSON.stringify(o==null?'':o); return (typeof Blob!=='undefined')?new Blob([s]).size:s.length; }catch(e){ return 0; } }
  function nowStr(){ try{ return new Date().toLocaleString('ar'); }catch(e){ return new Date().toISOString(); } }
  function histGet(){ try{ return JSON.parse(localStorage.getItem(HIST_KEY)||'[]'); }catch(e){ return []; } }
  function histSave(arr){
    // أبقِ آخر 20 سجلاً، مع حفظ النسخة الكاملة لآخر 3 فقط (توفير المساحة)
    arr = arr.slice(-20);
    arr.forEach((h,i)=>{ if(i < arr.length-3) delete h.data; });
    try{ localStorage.setItem(HIST_KEY, JSON.stringify(arr)); }catch(e){
      while(arr.length>3){ arr.shift(); try{ localStorage.setItem(HIST_KEY, JSON.stringify(arr)); break; }catch(e2){} }
    }
  }

  async function gatherAll(){
    const res = await Promise.all([
      DB.getOrders().catch(()=>[]),
      DB.getMenu().catch(()=>[]),
      DB.getSettings().catch(()=>({})),
      (typeof DB.getUsers==='function'?DB.getUsers():Promise.resolve([])).catch(()=>[])
    ]);
    return { app:'Mi Sweets POS', format:'full-backup', version:1, exportedAt:Date.now(),
             orders:res[0]||[], menu:res[1]||[], settings:res[2]||{}, users:res[3]||[] };
  }
  function downloadJSON(obj, name){
    try{
      const blob = new Blob([JSON.stringify(obj,null,2)], {type:'application/json'});
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href=url; a.download=name;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(()=>URL.revokeObjectURL(url), 1500);
    }catch(e){ console.error('download fail', e); }
  }

  function renderTable(){
    const body = $('backupBody'); if(!body) return;
    const hist = histGet().slice().reverse();
    if(!hist.length){ body.innerHTML = '<tr><td colspan="5" style="text-align:center;color:#94a3b8;padding:18px">لا توجد نسخ بعد</td></tr>'; return; }
    body.innerHTML = hist.map(h =>
      '<tr><td>'+esc(h.when)+'</td><td>'+(h.auto?'تلقائي':'يدوي')+'</td><td>'+esc(String(h.records))+'</td><td>'+fmtBytes(h.size)+'</td>'+
      '<td>'+(h.data?('<button class="btn-sm primary" data-dl="'+esc(h.id)+'">⬇️ تنزيل</button>'):'<span class="self-tag">غير متوفر</span>')+'</td></tr>'
    ).join('');
    body.querySelectorAll('[data-dl]').forEach(b=>{ b.onclick=()=>{ const h=histGet().find(x=>String(x.id)===b.dataset.dl); if(h&&h.data) downloadJSON(h.data,'mi-sweets-backup-'+h.id+'.json'); }; });
  }

  async function doBackup(auto){
    const data = await gatherAll();
    const size = byteSize(data);
    const records = data.orders.length + data.menu.length + data.users.length + 1;
    const id = String(Date.now());
    const name = 'mi-sweets-backup-'+new Date().toISOString().slice(0,19).replace(/[:T]/g,'-')+'.json';
    downloadJSON(data, name);
    const hist = histGet(); hist.push({ id, when:nowStr(), ts:Date.now(), auto:!!auto, records, size, data });
    histSave(hist); renderTable();
    try{ const cfg = Object.assign({}, settingsCache||{}, { backupLastRun: Date.now() }); settingsCache = await DB.saveSettings(cfg); }catch(e){}
    return { records, size };
  }

  async function restoreFromObj(obj){
    if(!obj || !Array.isArray(obj.orders)) throw new Error('ملف غير صالح');
    if(obj.settings) settingsCache = await DB.saveSettings(obj.settings);
    if(Array.isArray(obj.menu)) await DB.saveMenu(obj.menu);
    if(Array.isArray(obj.users) && typeof DB.saveUsers==='function') await DB.saveUsers(obj.users);
    await DB.clearOrders();
    for(const o of obj.orders){ try{ await DB.addOrder(o); }catch(e){} }
  }

  async function runPurge(auto){
    const cfg = settingsCache || {};
    const keep = Math.max(1, Number(cfg.purgeKeepDays)||7);
    const cutoff = Date.now() - keep*86400000;
    if(cfg.backupEnabled){ try{ await doBackup(true); }catch(e){} }
    const removed = await DB.purgeOrdersBefore(cutoff);
    try{ const c2 = Object.assign({}, settingsCache||{}, { purgeLastRun: Date.now() }); settingsCache = await DB.saveSettings(c2); }catch(e){}
    return removed;
  }

  // تنظيف رسائل الدردشة حسب عدد الأيام (0 = حذف الكل)
  async function runChatPurge(auto){
    const cfg = settingsCache || {};
    const keep = Math.max(0, Number(cfg.chatPurgeKeepDays)||0);
    let removed;
    if(keep === 0){
      // حذف الكل
      await DB.clearChat();
      removed = -1; // إشارة إلى حذف شامل
    } else {
      const cutoff = Date.now() - keep*86400000;
      removed = await DB.purgeChatBefore(cutoff);
    }
    try{ const c2 = Object.assign({}, settingsCache||{}, { chatPurgeLastRun: Date.now() }); settingsCache = await DB.saveSettings(c2); }catch(e){}
    return removed;
  }

  // ===== التعبئة والربط =====
  function fill(cfg){
    if(!cfg) return;
    const set=(id,v)=>{const el=$(id); if(el && document.activeElement!==el) el.value=(v==null?'':v);};
    const chk=(id,v)=>{const el=$(id); if(el) el.checked=v===true;};
    chk('setBackupEnabled', cfg.backupEnabled===true);
    set('setBackupFreq', cfg.backupFreq||'weekly');
    chk('setPurgeEnabled', cfg.purgeEnabled===true);
    set('setPurgeKeepDays', cfg.purgeKeepDays!=null?cfg.purgeKeepDays:7);
    chk('setChatPurgeEnabled', cfg.chatPurgeEnabled===true);
    set('setChatPurgeDay', cfg.chatPurgeDay!=null?cfg.chatPurgeDay:6);
    set('setChatPurgeKeepDays', cfg.chatPurgeKeepDays!=null?cfg.chatPurgeKeepDays:7);
    set('setNetlifyToken', cfg.netlifyToken||'');
    set('setNetlifySlug', cfg.netlifySlug||'');
    set('setNetlifySiteId', cfg.netlifySiteId||'');
    renderTable();
  }

  async function savePartial(patch, msg){
    const cur = settingsCache || (await DB.getSettings());
    settingsCache = await DB.saveSettings(Object.assign({}, cur, patch));
    showToast(msg||'تم الحفظ ✓');
  }

  async function autoRun(cfg){
    if(autoDone || !cfg) return; autoDone = true;
    // نسخ احتياطي تلقائي عند الاستحقاق
    try{
      if(cfg.backupEnabled){
        const freqMs = (cfg.backupFreq==='daily')?86400000:7*86400000;
        if(!cfg.backupLastRun || (Date.now()-Number(cfg.backupLastRun))>=freqMs){
          await doBackup(true); showToast('تم أخذ نسخة احتياطية تلقائية ✓');
        }
      }
    }catch(e){ console.error('auto backup', e); }
    // محو تلقائي (مرة كل ~20 ساعة)
    try{
      if(cfg.purgeEnabled){
        if(!cfg.purgeLastRun || (Date.now()-Number(cfg.purgeLastRun))>=20*3600000){
          const n = await runPurge(true);
          if(n>0) showToast('المحو التلقائي: حذف '+n+' طلب قديم');
        }
      }
    }catch(e){ console.error('auto purge', e); }
    // تنظيف الدردشة التلقائي (في اليوم المحدد من الأسبوع، مرة كل ~20 ساعة)
    try{
      if(cfg.chatPurgeEnabled){
        const day = (cfg.chatPurgeDay!=null) ? Number(cfg.chatPurgeDay) : 6;
        const dueDay = (new Date().getDay() === day);
        const dueTime = (!cfg.chatPurgeLastRun || (Date.now()-Number(cfg.chatPurgeLastRun))>=20*3600000);
        if(dueDay && dueTime){
          const n = await runChatPurge(true);
          if(n === -1) showToast('تنظيف الدردشة التلقائي: حُذفت كل الرسائل');
          else if(n>0) showToast('تنظيف الدردشة التلقائي: حُذفت '+n+' رسالة قديمة');
        }
      }
    }catch(e){ console.error('auto chat purge', e); }
  }

  // ===== ربط الأزرار =====
  function bind(){
    const bn = $('backupNowBtn'); if(bn) bn.onclick = async ()=>{ bn.disabled=true; try{ const r=await doBackup(false); showToast('تم النسخ: '+r.records+' سجل · '+fmtBytes(r.size)); }catch(e){ showToast('تعذر النسخ'); } bn.disabled=false; };
    const bs = $('backupSaveSched'); if(bs) bs.onclick = ()=> savePartial({ backupEnabled: $('setBackupEnabled').checked, backupFreq: $('setBackupFreq').value }, 'تم حفظ جدول النسخ ✓');
    const rb = $('backupRestoreBtn'); const rf = $('backupRestoreFile');
    if(rb && rf){ rb.onclick = ()=> rf.click();
      rf.onchange = ()=>{ const f=rf.files&&rf.files[0]; if(!f) return;
        const reader=new FileReader();
        reader.onload=async ev=>{ let obj; try{ obj=JSON.parse(ev.target.result); }catch(e){ showToast('ملف غير صالح'); return; }
          if(!confirm('ستُستبدل جميع البيانات الحالية بمحتوى الملف. متابعة؟')) { rf.value=''; return; }
          try{ await restoreFromObj(obj); showToast('تمت الاستعادة ✓'); }catch(e){ console.error(e); showToast('تعذرت الاستعادة'); } rf.value=''; };
        reader.readAsText(f); };
    }
    const ps = $('purgeSaveSched'); if(ps) ps.onclick = ()=> savePartial({ purgeEnabled: $('setPurgeEnabled').checked, purgeKeepDays: Math.max(1, parseInt($('setPurgeKeepDays').value,10)||7) }, 'تم حفظ جدول المحو ✓');
    const pn = $('purgeNowBtn'); if(pn) pn.onclick = async ()=>{
      const keep = Math.max(1, parseInt(($('setPurgeKeepDays')||{}).value,10)||7);
      if(!confirm('سيتم حذف جميع الطلبات الأقدم من '+keep+' يوم نهائياً. متابعة؟')) return;
      pn.disabled=true;
      try{ settingsCache = Object.assign({}, settingsCache||{}, { purgeKeepDays: keep }); const n=await runPurge(false); showToast(n>0?('تم حذف '+n+' طلب قديم'):'لا توجد طلبات قديمة'); }catch(e){ console.error(e); showToast('تعذر المحو'); } pn.disabled=false; };
    const ns = $('netlifySaveBtn'); if(ns) ns.onclick = ()=> savePartial({ netlifyToken: $('setNetlifyToken').value.trim(), netlifySlug: $('setNetlifySlug').value.trim(), netlifySiteId: $('setNetlifySiteId').value.trim() }, 'تم حفظ ربط Netlify ✓');
    // ===== تنظيف صندوق الدردشة =====
    const ccn = $('chatClearNowBtn'); if(ccn) ccn.onclick = async ()=>{
      if(!confirm('سيتم حذف جميع رسائل الدردشة نهائياً (نصوص/صور/رسائل صوتية وسجل المكالمات). لا يمكن التراجع. متابعة؟')) return;
      ccn.disabled=true;
      try{ await DB.clearChat(); showToast('تم تنظيف صندوق الرسائل ✓'); }catch(e){ console.error(e); showToast('تعذر التنظيف'); } ccn.disabled=false; };
    const cps = $('chatPurgeSaveSched'); if(cps) cps.onclick = ()=> savePartial({
      chatPurgeEnabled: $('setChatPurgeEnabled').checked,
      chatPurgeDay: Math.min(6, Math.max(0, parseInt($('setChatPurgeDay').value,10)||0)),
      chatPurgeKeepDays: Math.max(0, parseInt($('setChatPurgeKeepDays').value,10)||0)
    }, 'تم حفظ جدول تنظيف الدردشة ✓');
  }
  bind();
  return { fill, autoRun };
})();

// ===== إعدادات تجربة الاستخدام والمظهر (الوضع الليلي / إخفاء المبالغ / التحديث التلقائي) =====
window.AdminUI = (function(){
  var autoTimer = null;

  function $(id){ return document.getElementById(id); }

  function fill(cfg){
    cfg = cfg || {};
    var d = $('setAdminDark');        if(d) d.checked = !!cfg.adminDark;
    var h = $('setHideMoney');        if(h) h.checked = !!cfg.hideMoney;
    var a = $('setAutoRefresh');      if(a) a.checked = !!cfg.autoRefresh;
    var s = $('setAutoRefreshSec');   if(s) s.value = cfg.autoRefreshSec != null ? cfg.autoRefreshSec : 60;
    applyAppearance(cfg);
  }

  function collect(){
    return {
      adminDark: !!($('setAdminDark')||{}).checked,
      hideMoney: !!($('setHideMoney')||{}).checked,
      autoRefresh: !!($('setAutoRefresh')||{}).checked,
      autoRefreshSec: Math.min(600, Math.max(10, parseInt(($('setAutoRefreshSec')||{}).value, 10) || 60))
    };
  }

  // زر العين العائم لإظهار/إخفاء المبالغ يدوياً
  function ensureEyeBtn(){
    var btn = $('moneyEyeBtn');
    if(!btn){
      btn = document.createElement('button');
      btn.id = 'moneyEyeBtn';
      btn.type = 'button';
      btn.className = 'money-eye';
      btn.title = 'إظهار / إخفاء المبالغ';
      btn.setAttribute('aria-label','إظهار أو إخفاء المبالغ');
      btn.onclick = function(){
        document.body.classList.toggle('money-revealed');
        syncEyeBtn();
      };
      document.body.appendChild(btn);
    }
    return btn;
  }
  function syncEyeBtn(){
    var btn = $('moneyEyeBtn');
    if(!btn) return;
    var revealed = document.body.classList.contains('money-revealed');
    btn.innerHTML = revealed ? '🙈' : '👁️';
  }
  function removeEyeBtn(){
    var btn = $('moneyEyeBtn');
    if(btn && btn.parentNode) btn.parentNode.removeChild(btn);
    document.body.classList.remove('money-revealed');
  }

  function applyAppearance(cfg){
    cfg = cfg || collect();
    // 1) الوضع الليلي
    document.body.classList.toggle('admin-dark', !!cfg.adminDark);
    // 2) إخفاء المبالغ المالية (مع إبقاء الأرقام غير المالية ظاهرة)
    if(cfg.hideMoney){
      document.body.classList.add('money-hidden');
      ensureEyeBtn();
      syncEyeBtn();
    } else {
      document.body.classList.remove('money-hidden');
      removeEyeBtn();
    }
    // 3) التحديث التلقائي للبيانات
    if(autoTimer){ clearInterval(autoTimer); autoTimer = null; }
    if(cfg.autoRefresh){
      var sec = Math.min(600, Math.max(10, parseInt(cfg.autoRefreshSec, 10) || 60));
      autoTimer = setInterval(function(){
        try{
          if(typeof renderOrders === 'function') renderOrders();
          if(typeof renderStats === 'function') renderStats();
          if(typeof renderCustomers === 'function') renderCustomers();
        }catch(e){ console.error('auto refresh', e); }
      }, sec * 1000);
    }
  }

  return { fill: fill, collect: collect, applyAppearance: applyAppearance };
})();
