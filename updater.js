// ============================================================
//  updater.js — مركز التحديث والترقية
//  زر ⬆️ ترقية بجانب زر «📷 مسح QR» يفتح نافذة بخانتين:
//    (1) المستخدمون  : مستطيل لكل نسخة جديدة + علامة تنزيل ⬇
//                      الضغط على المستطيل يبدأ التنزيل داخل التطبيق بشريط تقدّم.
//    (2) المدير العام : إنشاء تحديث (اسم النسخة + رابط التحميل المباشر)
//                      + قائمة التحديثات المنشورة مع علامة ✕ للحذف.
//  البيانات تُحفظ في settings.updates عبر DB (Firestore أو localStorage).
// ============================================================
(function () {
  'use strict';

  // ---------- مساعدات عامة ----------
  function el(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function meUser() {
    try { return (typeof currentPosUser !== 'undefined' && currentPosUser) ? currentPosUser : null; } catch (e) { return null; }
  }
  function isMgr() {
    try { return (typeof isManagerUser === 'function') ? !!isManagerUser() : false; } catch (e) { return false; }
  }
  function toast(m) {
    try { if (typeof showToast === 'function') { showToast(m); return; } } catch (e) { /* ignore */ }
    console.log('[upgrade]', m);
  }
  function activity(type, txt) {
    try { if (typeof logActivity === 'function') logActivity(type, txt); } catch (e) { /* ignore */ }
  }
  function fmtSize(b) {
    b = Number(b) || 0;
    if (b <= 0) return '';
    var u = ['B', 'KB', 'MB', 'GB'], i = 0;
    while (b >= 1024 && i < u.length - 1) { b /= 1024; i++; }
    return (b >= 10 || i === 0 ? Math.round(b) : b.toFixed(1)) + ' ' + u[i];
  }
  function fmtDate(ts) {
    try { return new Date(ts || Date.now()).toLocaleDateString('ar', { year: 'numeric', month: '2-digit', day: '2-digit' }); } catch (e) { return ''; }
  }
  function fileNameOf(url, name) {
    var out = '';
    try {
      var clean = String(url || '').split('?')[0].split('#')[0];
      var last = clean.substring(clean.lastIndexOf('/') + 1);
      if (last && last.indexOf('.') > 0) out = decodeURIComponent(last);
    } catch (e) { /* ignore */ }
    if (!out) {
      var n = String(name || 'update').replace(/[\\/:*?"<>|]+/g, '_').trim() || 'update';
      out = /\.[a-z0-9]{2,5}$/i.test(n) ? n : (n + '.exe');
    }
    return out;
  }

  // ---------- تنسيقات مُحقَنة ----------
  var CSS = '' +
    '.upg-box{max-width:600px;display:flex;flex-direction:column;gap:12px;padding:0;overflow:hidden}' +
    '.upg-box .modal-head{margin:0;padding:14px 18px;background:linear-gradient(135deg,#1b3fa8,#1e4ed0);color:#fff}' +
    '.upg-box .modal-head h3{font-size:18px;margin:0}' +
    '.upg-box .modal-head .close-btn{color:#fff;opacity:.9;width:30px;height:30px;border-radius:9px;background:rgba(255,255,255,.16)}' +
    '.upg-box .modal-head .close-btn:hover{background:rgba(255,255,255,.3)}' +
    '.upg-tabs{display:flex;gap:8px;padding:12px 18px 0}' +
    '.upg-tab{flex:1;display:flex;align-items:center;justify-content:center;gap:6px;padding:9px 10px;border:1.5px solid #dbe6fc;background:#f4f7ff;color:#334155;border-radius:12px;font:inherit;font-size:13.5px;font-weight:800;cursor:pointer;position:relative}' +
    '.upg-tab:hover{background:#eaf1ff}' +
    '.upg-tab.active{background:linear-gradient(135deg,#1e4ed0,#3b82f6);border-color:#1e4ed0;color:#fff}' +
    '.upg-tab-badge{position:absolute;top:-7px;left:-7px;min-width:19px;height:19px;padding:0 5px;border-radius:999px;background:#ff4d8d;color:#fff;font-size:11px;font-weight:800;display:flex;align-items:center;justify-content:center}' +
    '.upg-hint{font-size:12.5px;color:#64748b;padding:0 18px}' +
    '.upg-subhead{font-size:13px;font-weight:800;color:#334155;padding:2px 18px 0}' +
    '.upg-form{display:flex;flex-direction:column;gap:10px;padding:0 18px}' +
    '.upg-field{display:flex;flex-direction:column;gap:5px}' +
    '.upg-field label{font-size:12.5px;font-weight:800;color:#334155}' +
    '.upg-field input{border:1.5px solid #dbe6fc;border-radius:12px;padding:9px 12px;font:inherit;font-size:14px;background:#fff;color:#0f172a}' +
    '.upg-field input:focus{outline:none;border-color:#3b82f6;box-shadow:0 0 0 3px rgba(59,130,246,.16)}' +
    '.upg-form-actions{display:flex;gap:8px;margin-top:2px}' +
    '.upg-btn{border:none;border-radius:12px;padding:10px 14px;font:inherit;font-size:13.5px;font-weight:800;cursor:pointer;flex:1}' +
    '.upg-btn-create{background:linear-gradient(135deg,#16a34a,#22c55e);color:#fff}' +
    '.upg-btn-create:hover{filter:brightness(1.06)}' +
    '.upg-btn-create:disabled{opacity:.6;cursor:not-allowed}' +
    '.upg-btn-clear{background:#f1f5f9;color:#475569;flex:0 0 auto;padding:10px 16px}' +
    '.upg-btn-clear:hover{background:#e2e8f0}' +
    '.upg-btn-cancel{background:#fee2e2;color:#b91c1c;flex:0 0 auto;padding:8px 16px;margin-top:8px}' +
    '.upg-btn-cancel:hover{background:#fecaca}' +
    '.upg-status{font-size:12.5px;font-weight:700;min-height:0;display:none}' +
    '.upg-status.show{display:block}' +
    '.upg-list{display:flex;flex-direction:column;gap:9px;padding:0 18px 18px;max-height:44vh;overflow:auto}' +
    '.upg-item{display:flex;align-items:center;gap:10px;border:1.5px solid #dbe6fc;background:#f8fbff;border-radius:14px;padding:11px 13px;cursor:pointer;transition:.15s;text-align:right;width:100%;font:inherit;color:inherit}' +
    '.upg-item:hover{border-color:#3b82f6;background:#eef4ff;transform:translateY(-1px)}' +
    '.upg-item.busy{opacity:.65;cursor:default;transform:none}' +
    '.upg-item.done{border-color:#16a34a;background:#f0fdf4}' +
    '.upg-item.done .upg-dl{background:#16a34a;color:#fff}' +
    '.upg-dl{flex:0 0 auto;width:38px;height:38px;border-radius:11px;background:linear-gradient(135deg,#1e4ed0,#3b82f6);color:#fff;display:flex;align-items:center;justify-content:center;font-size:17px}' +
    '.upg-body{flex:1;min-width:0}' +
    '.upg-name{font-size:14px;font-weight:800;color:#0f172a;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
    '.upg-meta{font-size:11.5px;color:#64748b;margin-top:3px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
    '.upg-del{flex:0 0 auto;width:30px;height:30px;border-radius:9px;border:1.5px solid #fecaca;background:#fff;color:#dc2626;font-size:14px;cursor:pointer;display:flex;align-items:center;justify-content:center}' +
    '.upg-del:hover{background:#fee2e2}' +
    '.upg-empty{text-align:center;color:#94a3b8;padding:22px 12px;font-size:13px;border:1.5px dashed #e2e8f0;border-radius:14px}' +
    '.upg-prog{padding:12px 18px 18px;border-top:1px solid #e2e8f0;background:#f8fafc}' +
    '.upg-prog-head{display:flex;justify-content:space-between;gap:8px;font-size:13px;font-weight:800;color:#0f172a;margin-bottom:7px}' +
    '.upg-prog-name{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
    '.upg-prog-pct{color:#1e4ed0;flex:0 0 auto}' +
    '.upg-prog-track{height:12px;border-radius:999px;background:#e2e8f0;overflow:hidden}' +
    '.upg-prog-fill{height:100%;width:0;border-radius:999px;background:linear-gradient(90deg,#1e4ed0,#22c55e);transition:width .18s ease}' +
    '.upg-prog-sub{font-size:11.5px;color:#64748b;margin-top:6px}' +
    '.upgrade-btn{position:relative}' +
    '.upgrade-btn .upg-btn-dot{position:absolute;top:-6px;left:-6px;min-width:18px;height:18px;padding:0 4px;border-radius:999px;background:#ff4d8d;color:#fff;font-size:11px;font-weight:800;display:flex;align-items:center;justify-content:center;box-shadow:0 0 0 2px rgba(255,255,255,.7)}' +
    '@media (max-width:640px){.upg-box{padding:0}.upg-tab{font-size:12.5px;padding:8px 6px}.upg-list{max-height:38vh}}';
  (function injectCSS() {
    if (document.getElementById('upgStyle')) return;
    var s = document.createElement('style');
    s.id = 'upgStyle';
    s.textContent = CSS;
    document.head.appendChild(s);
  })();

  // ---------- الحالة ----------
  var _cfg = null;                 // آخر إعدادات محمّلة
  var _unsub = null;               // اشتراك التغييرات اللحظية
  var _tab = 'user';               // التبويب الحالي
  var _busyId = '';                // معرّف التنزيل الجاري
  var _xhr = null;                 // طلب XHR الجاري (وضع المتصفح — للإلغاء)
  var _target = null;              // التحديث الجاري تنزيله
  var _seen = {};                  // ما شاهده المستخدم محلياً: id => true

  function loadSeen() {
    try { _seen = JSON.parse(localStorage.getItem('upgrade_seen') || '{}') || {}; } catch (e) { _seen = {}; }
  }
  function markSeen(id) {
    _seen[id] = 1;
    try { localStorage.setItem('upgrade_seen', JSON.stringify(_seen)); } catch (e) { /* ignore */ }
  }
  function list() {
    var a = (_cfg && Array.isArray(_cfg.updates)) ? _cfg.updates.slice() : [];
    return a.sort(function (x, y) { return (y.ts || 0) - (x.ts || 0); });   // الأحدث أولاً
  }

  // ---------- إظهار الزر ----------
  function applyButton() {
    var b = el('upgradeCenterBtn');
    if (!b) return;
    var on = !!meUser();
    b.style.display = on ? '' : 'none';
    var fresh = list().filter(function (u) { return !_seen[u.id]; }).length;
    var dot = b.querySelector('.upg-btn-dot');
    if (!fresh) { if (dot) dot.remove(); }
    else if (!dot) {
      var s = document.createElement('span');
      s.className = 'upg-btn-dot';
      s.textContent = fresh > 9 ? '9+' : String(fresh);
      b.appendChild(s);
    } else { dot.textContent = fresh > 9 ? '9+' : String(fresh); }
  }

  // ---------- رسم القوائم ----------
  function itemHTML(u, withDel) {
    var fresh = !_seen[u.id];
    var meta = [];
    if (u.size) meta.push(fmtSize(u.size));
    meta.push(fmtDate(u.ts));
    if (fresh) meta.push('جديد');
    var note = u.note ? String(u.note) : '';
    var sub = note ? ('' + note + (meta.length ? ' · ' + meta.join(' · ') : '')) : meta.join(' · ');
    return '<button type="button" class="upg-item" data-upg-id="' + esc(u.id) + '">' +
      '<span class="upg-dl">⬇</span>' +
      '<span class="upg-body">' +
        '<span class="upg-name">' + esc(u.name) + (fresh ? ' 🆕' : '') + '</span>' +
        '<span class="upg-meta">' + esc(sub || '') + '</span>' +
      '</span>' +
      (withDel ? '<span class="upg-del" data-upg-del="' + esc(u.id) + '" title="حذف">✕</span>' : '') +
    '</button>';
  }

  function renderList() {
    var arr = list();
    var ul = el('upgradeUserList'), al = el('upgradeAdminList'), bd = el('upgradeUserBadge');
    var empty = '<div class="upg-empty">لا توجد تحديثات متاحة حالياً</div>';

    if (ul) ul.innerHTML = arr.length ? arr.map(function (u) { return itemHTML(u, false); }).join('') : empty;
    if (al) al.innerHTML = arr.length ? arr.map(function (u) { return itemHTML(u, true); }).join('') : empty;

    var fresh = arr.filter(function (u) { return !_seen[u.id]; }).length;
    if (bd) { bd.style.display = fresh ? '' : 'none'; bd.textContent = fresh > 9 ? '9+' : String(fresh); }
    applyButton();
  }

  function renderAdminTab() {
    var t = el('upgradeAdminTab');
    if (t) t.style.display = isMgr() ? '' : 'none';
    if (!isMgr() && _tab === 'admin') _tab = 'user';
    applyTab();
  }

  function applyTab() {
    var isA = (_tab === 'admin' && isMgr());
    var tabs = document.querySelectorAll('#upgradeTabs .upg-tab');
    for (var i = 0; i < tabs.length; i++) {
      tabs[i].classList.toggle('active', tabs[i].getAttribute('data-upg-tab') === (isA ? 'admin' : 'user'));
    }
    var pu = el('upgradePaneUser'), pa = el('upgradePaneAdmin');
    if (pu) pu.style.display = isA ? 'none' : '';
    if (pa) pa.style.display = isA ? '' : 'none';
  }

  function setStatus(msg, kind) {
    var s = el('upgradeStatus');
    if (!s) return;
    s.textContent = msg || '';
    s.className = 'upg-status' + (msg ? ' show' : '');
    s.style.color = kind === 'err' ? '#dc2626' : (kind === 'ok' ? '#16a34a' : '#334155');
  }

  // ---------- فتح / إغلاق ----------
  function open() {
    if (!meUser()) { toast('🔒 سجّل الدخول أولاً'); return; }
    var m = el('upgradeModal');
    if (!m) return;
    bindNative();      // نتأكد أن جسر سطح المكتب جاهز قبل العرض
    renderAdminTab();
    renderList();
    setStatus('');
    // تذكير بوضع التشغيل: تثبيت تلقائي (سطح المكتب) أو تنزيل مباشر (المتصفح)
    var h = el('upgradeUserHint');
    if (h) {
      h.textContent = native()
        ? 'النسخة الجديدة المتاحة — اضغط على المستطيل للتنزيل داخل التطبيق ثم التثبيت تلقائياً'
        : 'النسخة الجديدة المتاحة — اضغط على المستطيل للتنزيل مباشرة مع شريط تقدّم';
      h.style.color = '#64748b';
    }
    m.classList.add('show');
  }
  function close() { var m = el('upgradeModal'); if (m) m.classList.remove('show'); }

  // ---------- حفظ الإعدادات ----------
  function saveList(arr) {
    // نستخدم _cfg لأنه يتحدّث لحظياً من Firestore (أحدث من RESTAURANT)
    var base = _cfg || ((typeof RESTAURANT !== 'undefined' && RESTAURANT) ? RESTAURANT : {});
    var cfg = Object.assign({}, base, { updates: arr });
    var st = el('upgradeStatus');
    if (st) st.textContent = 'جارٍ الحفظ...';
    return Promise.resolve(window.DB.saveSettings(cfg)).then(function (merged) {
      _cfg = merged || _cfg;
      if (typeof RESTAURANT !== 'undefined') RESTAURANT.updates = (merged && merged.updates) || [];
      renderList();
      return merged;
    });
  }

  // ---------- إنشاء / حذف ----------
  function createUpdate() {
    if (!isMgr()) { toast('⛔ هذه العملية للمدير العام فقط'); return; }
    var nameEl = el('upgradeVerName'), urlEl = el('upgradeUrl'), noteEl = el('upgradeNote');
    var name = String(nameEl && nameEl.value || '').trim();
    var url = String(urlEl && urlEl.value || '').trim();
    var note = String(noteEl && noteEl.value || '').trim();
    var btn = el('upgradeCreate');

    if (!name) { setStatus('⚠️ اكتب اسم النسخة أولاً', 'err'); if (nameEl) nameEl.focus(); return; }
    if (!url) { setStatus('⚠️ اكتب رابط التحميل المباشر', 'err'); if (urlEl) urlEl.focus(); return; }
    if (!/^https?:\/\//i.test(url)) { setStatus('⚠️ الرابط يجب أن يبدأ بـ http أو https', 'err'); if (urlEl) urlEl.focus(); return; }

    var arr = list().map(function (u) { return Object.assign({}, u); });
    var dup = arr.filter(function (u) { return String(u.url) === url; })[0];
    var id = (dup && dup.id) ? dup.id : ('u' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6));
    var rec = { id: id, name: name, url: url, note: note, size: (dup && dup.size) || 0, ts: Date.now() };
    if (dup) {
      arr = arr.map(function (u) { return String(u.url) === url ? rec : u; });
    } else {
      arr.unshift(rec);
    }

    if (btn) btn.disabled = true;
    setStatus('جارٍ إنشاء التحديث...');
    saveList(arr).then(function () {
      markSeen(id);
      if (nameEl) nameEl.value = '';
      if (urlEl) urlEl.value = '';
      if (noteEl) noteEl.value = '';
      if (btn) btn.disabled = false;
      setStatus('✅ تم إنشاء التحديث «' + name + '» — يظهر الآن لكل المستخدمين', 'ok');
      toast('✅ تم إنشاء التحديث: ' + name);
      activity('action', 'إنشاء تحديث جديد (' + name + ')');
    }).catch(function (e) {
      if (btn) btn.disabled = false;
      setStatus('⛔ تعذر الحفظ: ' + ((e && e.message) || e), 'err');
    });
  }

  function deleteUpdate(id) {
    if (!isMgr()) { toast('⛔ هذه العملية للمدير العام فقط'); return; }
    var arr = list().filter(function (u) { return String(u.id) !== String(id); });
    setStatus('جارٍ الحذف...');
    saveList(arr).then(function () {
      setStatus('🗑️ تم الحذف', 'ok');
      toast('🗑️ تم حذف التحديث');
      activity('action', 'حذف تحديث');
    }).catch(function (e) {
      setStatus('⛔ تعذر الحذف: ' + ((e && e.message) || e), 'err');
    });
  }

  // ---------- شريط التقدّم ----------
  function showProg(on) { var p = el('upgradeProgress'); if (p) p.style.display = on ? '' : 'none'; }
  function setProg(pct, sub) {
    var f = el('upgradeProgFill'), t = el('upgradeProgPct'), s = el('upgradeProgSub');
    var p = Math.max(0, Math.min(100, Math.round(pct || 0)));
    if (f) f.style.width = p + '%';
    if (t) t.textContent = p + '%';
    if (s) s.textContent = sub || '';
  }
  function progFor(id, pct, sub) {
    var items = document.querySelectorAll('.upg-item[data-upg-id="' + String(id).replace(/"/g, '\\"') + '"]');
    for (var i = 0; i < items.length; i++) {
      items[i].style.background = 'linear-gradient(90deg,#dbeafe ' + Math.min(100, pct) + '%,#f8fbff ' + Math.min(100, pct) + '%)';
    }
  }

  // ============================================================
  //  التنزيل — يعمل في الوضعين مع شريط تقدّم:
  //   (أ) تطبيق سطح المكتب: تنزيل أصلي داخل التطبيق + تثبيت تلقائي
  //   (ب) المتصفح: تنزيل مباشر ببروقرس بار ثم فتح الملف تلقائياً
  // ============================================================
  function native() {
    return (window.BMS_DOWNLOADER && window.BMS_DOWNLOADER.isDesktop) ? window.BMS_DOWNLOADER : null;
  }

  function downloadUpdate(id) {
    if (_busyId) { toast('⏳ هناك تنزيل جارٍ بالفعل'); return; }
    var u = list().filter(function (x) { return String(x.id) === String(id); })[0];
    if (!u) { toast('⛔ التحديث غير موجود'); return; }

    var fn = fileNameOf(u.url, u.name);
    var nmEl = el('upgradeProgName'); if (nmEl) nmEl.textContent = u.name + ' — ' + fn;
    var cc = el('upgradeCancel');
    if (cc) { cc.textContent = '✕ إلغاء التنزيل'; cc.style.display = ''; }

    _busyId = u.id;
    _target = u;
    showProg(true);
    setProg(0, 'جارٍ الاتصال بالسيرفر...');
    document.querySelectorAll('.upg-item').forEach(function (n) { n.classList.remove('done'); });

    var nd = native();
    if (nd) {
      // (1) تطبيق سطح المكتب: تنزيل أصلي داخل التطبيق + تثبيت تلقائي
      nativeDownload(u, fn, nd);
    } else if (isMobile()) {
      // (2) الجوال: تنزيل طبيعي إلى الجهاز عبر مدير التنزيلات + بروقس وهمي
      mobileDownload(u, fn);
    } else {
      // (3) كمبيوتر: تنزيل مباشر ببروقس حقيقي
      browserDownload(u, fn);
    }
  }

  // ---------- (أ) سطح المكتب: تنزيل أصلي + تثبيت تلقائي ----------
  function nativeDownload(u, fn, nd) {
    Promise.resolve(nd.start(u.url, fn)).then(function (res) {
      if (!res || !res.ok) {
        _busyId = '';
        setProg(0, '⛔ ' + ((res && res.error) || 'تعذر بدء التنزيل'));
        toast('⛔ تعذر بدء التنزيل');
      }
    }).catch(function (e) {
      _busyId = '';
      setProg(0, '⛔ ' + String((e && e.message) || e));
    });
  }

  // ---------- كشف الجوال ----------
  function isMobile() {
    var ua = navigator.userAgent || '';
    if (/Android|iPhone|iPad|iPod|Mobile|Silk|BlackBerry|Opera Mini|IEMobile/i.test(ua)) return true;
    // iPadOS 13+ يعرض نفسه كـ Mac
    if (navigator.platform === 'MacIntel' && (navigator.maxTouchPoints || 0) > 1) return true;
    return false;
  }

  // ---------- (أ) الجوال: تنزيل طبيعي عبر مدير تنزيلات الجهاز + بروقس وهمي ----------
  function mobileDownload(u, fn) {
    // نُطلق التنزيل الطبيعي: المتصفح على الجوال ينزّل الملف إلى الجهاز
    var started = false;
    try {
      var a = document.createElement('a');
      a.href = u.url;
      a.download = fn;
      a.rel = 'noopener';
      a.target = '_blank';
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      setTimeout(function () { if (a.parentNode) a.parentNode.removeChild(a); }, 2000);
      started = true;
    } catch (e) { /* ignore */ }
    // على iOS نافتح نافذة جديدة أيضاً لضمان بدء التنزيل
    if (isIOS()) { try { window.open(u.url, '_blank'); } catch (e) { /* ignore */ } }
    if (!started) { try { window.open(u.url, '_blank'); } catch (e2) { /* ignore */ } }

    fakeProgress(u, fn);
  }

  // بروقس بار وهمي: حركة تصاعدية سلسة حتى 100% ثم رسالة النجاح
  function fakeProgress(u, fn) {
    var dur = 9000;                       // مدة الحركة التقديرية (9 ثوانٍ)
    var t0 = Date.now();
    var timer = setInterval(function () {
      var ratio = Math.min(1, (Date.now() - t0) / dur);
      // تسارع ثم تباطؤ حتى لا يصل 100% قبل الأوان
      var eased = 1 - Math.pow(1 - ratio, 2.4);
      var pct = Math.min(99, Math.round(eased * 99));
      setProg(pct, 'جارٍ التنزيل على جهازك... ' + pct + '%');
      progFor(_busyId, pct);
      if (ratio >= 1) {
        clearInterval(timer);
        setProg(100, '✅ تم إرسال النسخة إلى جهازك — ' + fn);
        progFor(_busyId, 100);
        markSeen(u.id);
        _busyId = '';
        renderList();
        toast('✅ بدأ تنزيل ' + u.name);
        activity('action', 'تنزيل تحديث (' + u.name + ')');
        setTimeout(function () { showProg(false); }, 3500);
      }
    }, 120);
  }

  // ---------- (ب) المتصفح (جوال + كمبيوتر): تنزيل ببروقرس بار ----------
  // ملاحظة: بعض siervers لا تسمح بالطلب المباشر (CORS) — في هذه الحالة
  // نفتح رابط التحميل مباشرةً في تبويب جديد، والمتصفح يتكفّل بالتنزيل.
  function isIOS() {
    var ua = navigator.userAgent || '';
    return /iPad|iPhone|iPod/.test(ua) ||
           (navigator.platform === 'MacIntel' && (navigator.maxTouchPoints || 0) > 1);
  }

  function browserDownload(u, fn) {
    var xhr = new XMLHttpRequest();
    _xhr = xhr;
    var finished = false;

    xhr.open('GET', u.url, true);
    xhr.responseType = 'blob';
    xhr.timeout = 0;

    xhr.onprogress = function (e) {
      var got = e.loaded || 0;
      if (e.lengthComputable && e.total) {
        var pct = (got / e.total) * 100;
        setProg(pct, fmtSize(got) + ' من ' + fmtSize(e.total));
        progFor(_busyId, pct);
      } else {
        var approx = Math.min(92, 6 + (got / (1024 * 1024)) * 10);
        setProg(approx, 'جارٍ التنزيل... (' + fmtSize(got) + ')');
        progFor(_busyId, approx);
      }
    };

    xhr.onload = function () {
      finished = true;
      var status = xhr.status || 0;
      var blob = xhr.response;
      if (status < 200 || status >= 300 || !blob || !blob.size) {
        // رد غير صالح: ننتقل لفتح الرابط مباشرة
        openDirect(u, fn);
        return;
      }
      _xhr = null;
      var url2 = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url2; a.download = fn; a.rel = 'noopener';
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      setTimeout(function () {
        try { URL.revokeObjectURL(url2); } catch (e) {}
        if (a.parentNode) a.parentNode.removeChild(a);
      }, 20000);

      // على iOS: نفتح الملف في تبويب جديد ليبدأ التنزيل فعلياً
      if (isIOS()) {
        try { window.open(url2, '_blank'); } catch (e) { /* ignore */ }
      }

      setProg(100, '✅ اكتمل التنزيل — ' + fn + ' (' + fmtSize(blob.size) + ')');
      progFor(_busyId, 100);
      markSeen(u.id);
      _busyId = '';
      renderList();
      toast('✅ تم تنزيل ' + u.name);
      activity('action', 'تنزيل تحديث (' + u.name + ')');
      setTimeout(function () { showProg(false); }, 3500);
    };

    xhr.onerror = function () { if (!finished) openDirect(u, fn); };
    xhr.ontimeout = function () { if (!finished) openDirect(u, fn); };
    try { xhr.send(); } catch (e) { if (!finished) openDirect(u, fn); }
  }

  // فتح رابط التحميل مباشرة — يعمل على كل الأجهزة (الجوال والكمبيوتر)
  function openDirect(u, fn) {
    _xhr = null;
    setProg(0, '📥 جارٍ فتح رابط التحزيل على جهازك...');
    var opened = false;
    try {
      var a = document.createElement('a');
      a.href = u.url;
      a.download = fn;
      a.rel = 'noopener';
      a.target = '_blank';
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      setTimeout(function () { if (a.parentNode) a.parentNode.removeChild(a); }, 2000);
      opened = true;
    } catch (e) { /* ignore */ }
    if (!opened) { try { window.open(u.url, '_blank'); } catch (e2) { /* ignore */ } }

    markSeen(u.id);
    _busyId = '';
    renderList();
    toast('📥 جارٍ تنزيل ' + u.name);
    setTimeout(function () { showProg(false); }, 4000);
  }

  function failDownload(msg) {
    _xhr = null;
    _busyId = '';
    setProg(0, '⛔ ' + msg);
    toast('⛔ ' + msg);
    setTimeout(function () { showProg(false); }, 4000);
  }

  // استقبال أحداث العملية الأصلية (تنزيل / اكتمل / تثبيت / خطأ)
  // ملاحظة: كائن BMS_DOWNLOADER مُجمَّد بواسطة contextBridge — لا نضيف له خصائص
  var _nativeBound = false;
  function bindNative() {
    var nd = native();
    if (!nd || _nativeBound) return;
    _nativeBound = true;

    nd.onProgress(function (d) {
      if (!_busyId) return;
      var pct = Number(d.percent) || 0;
      var total = Number(d.total) || 0, got = Number(d.received) || 0;
      if (d.started) { showProg(true); setProg(0, 'جارٍ بدء التنزيل...'); return; }
      if (total > 0) {
        setProg(pct, fmtSize(got) + ' من ' + fmtSize(total));
        progFor(_busyId, pct);
      } else {
        // حجم مجهول: شريط متحرك + عدّاد البايتات
        var approx = Math.min(92, 6 + (got / (1024 * 1024)) * 10);
        setProg(approx, 'جارٍ التنزيل... (' + fmtSize(got) + ')');
        progFor(_busyId, approx);
      }
    });

    nd.onDone(function (d) {
      if (!_busyId) return;
      setProg(100, '✅ اكتمل التنزيل (' + (d && d.filename || '') + ') — جارٍ التثبيت تلقائياً...');
      if (_busyId) progFor(_busyId, 100);
      markSeen(_busyId);
      if (_target) activity('action', 'تنزيل وتثبيت تحديث (' + _target.name + ')');
      renderList();
      // التطبيق سيُغلق ويشغّل المثبّت — نُبقي الشريط ظاهراً للحظة
      setTimeout(function () { if (_busyId) { showProg(false); _busyId = ''; } }, 2500);
    });

    nd.onStage(function (d) {
      if (!_busyId) return;
      if (d && d.stage === 'installing') {
        setProg(100, '⚙️ جارٍ تشغيل المثبّت وتحديث التطبيق... (' + (d.file || '') + ')');
        var cc = el('upgradeCancel'); if (cc) cc.style.display = 'none';
      }
    });

    nd.onError(function (d) {
      if (!_busyId) return;
      _busyId = '';
      var msg = (d && d.message) || 'فشل التنزيل';
      setProg(0, '⛔ ' + msg);
      toast('⛔ ' + msg);
      setTimeout(function () { showProg(false); }, 3000);
    });
  }

  function cancelDownload() {
    var nd = native();
    if (nd && _busyId) { try { nd.cancel(); } catch (e) { /* ignore */ } }
    if (_xhr) { try { _xhr.abort(); } catch (e) { /* ignore */ } _xhr = null; }
    _busyId = '';
    _target = null;
    toast('✕ تم إلغاء التنزيل');
    setProg(0, 'أُلغي التنزيل');
    setTimeout(function () { showProg(false); }, 1200);
    document.querySelectorAll('.upg-item').forEach(function (n) { n.classList.remove('busy'); n.style.background = ''; });
  }

  // ---------- الربط ----------
  function bind() {
    bindNative();
    var b = el('upgradeCenterBtn');
    if (b) b.onclick = open;

    var x = el('upgradeClose');
    if (x) x.onclick = close;
    var m = el('upgradeModal');
    if (m) m.addEventListener('click', function (e) { if (e.target === m) close(); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && m && m.classList.contains('show')) close();
    });

    var tabs = document.querySelectorAll('#upgradeTabs .upg-tab');
    for (var i = 0; i < tabs.length; i++) {
      tabs[i].onclick = function () {
        var t = this.getAttribute('data-upg-tab');
        if (t === 'admin' && !isMgr()) { toast('⛔ هذه الخانة للمدير العام فقط'); return; }
        _tab = t;
        applyTab();
      };
    }

    var cr = el('upgradeCreate');
    if (cr) cr.onclick = createUpdate;
    var rs = el('upgradeReset');
    if (rs) rs.onclick = function () {
      ['upgradeVerName', 'upgradeUrl', 'upgradeNote'].forEach(function (id) { var e2 = el(id); if (e2) e2.value = ''; });
      setStatus('');
      toast('🗑️ تم تفريغ الحقول');
    };
    var cc = el('upgradeCancel');
    if (cc) cc.onclick = cancelDownload;

    // ENTER في حقول الإنشاء = إنشاء
    ['upgradeVerName', 'upgradeUrl', 'upgradeNote'].forEach(function (id) {
      var e2 = el(id);
      if (e2) e2.addEventListener('keydown', function (ev) { if (ev.key === 'Enter') { ev.preventDefault(); createUpdate(); } });
    });

    // النقر على عنصر = تنزيل (من الخانتين). الضغط على ✕ = حذف (للمدير فقط).
    document.addEventListener('click', function (e) {
      var delBtn = e.target.closest ? e.target.closest('[data-upg-del]') : null;
      if (delBtn) {
        e.preventDefault(); e.stopPropagation();
        deleteUpdate(delBtn.getAttribute('data-upg-del'));
        return;
      }
      var item = e.target.closest ? e.target.closest('.upg-item') : null;
      if (!item) return;
      var id = item.getAttribute('data-upg-id');
      if (!id || id === _busyId) return;
      downloadUpdate(id);
    });

    // استقبال التغييرات اللحظية من قاعدة البيانات
    try {
      if (window.DB && typeof DB.onSettings === 'function' && !_unsub) {
        _unsub = DB.onSettings(function (cfg) {
          if (!cfg) return;
          _cfg = cfg;
          if (typeof RESTAURANT !== 'undefined') RESTAURANT.updates = Array.isArray(cfg.updates) ? cfg.updates : [];
          renderAdminTab();
          renderList();
        });
      }
    } catch (e) { /* ignore */ }
  }

  // ---------- الإقلاع ----------
  loadSeen();

  function boot() {
    bind();
    var b = el('upgradeCenterBtn');
    if (b && !b.getAttribute('data-upg-ready')) b.setAttribute('data-upg-ready', '1');
    applyButton();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  // تحميل الإعدادات (تدعم DB.getSettings) ثم ربط لحظي
  try {
    if (window.DB && typeof DB.getSettings === 'function') {
      Promise.resolve(DB.getSettings()).then(function (cfg) {
        _cfg = cfg || _cfg;
        if (typeof RESTAURANT !== 'undefined') RESTAURANT.updates = (cfg && cfg.updates) || [];
        renderAdminTab();
        renderList();
      }).catch(function () { /* ignore */ });
    }
  } catch (e) { /* ignore */ }

  // إعادة الرسم عند تغيّر حالة الدخول (تسجيل دخول / خروج) وتطبيق الإعدادات
  window.addEventListener('bms:settings-applied', function () { renderAdminTab(); renderList(); });
  window.addEventListener('bms:auth-changed', function () { renderAdminTab(); renderList(); });
  window.addEventListener('bms:upgrades-refresh', function () { renderAdminTab(); renderList(); });

  // واجهة عامة للاستخدام من ملفات أخرى
  window.UpgradeCenter = {
    open: open,
    close: close,
    refresh: function () { renderAdminTab(); renderList(); }
  };
})();
