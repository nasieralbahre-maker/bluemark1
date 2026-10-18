// ============================================================
//  expenses-admin.js — لوحة المدير: 💰 إدارة المصاريف + 📊 تقارير المصاريف
//  - عرض كل الطلبات مع البحث والتصفية (حالة / عملة / تاريخ)
//  - ثلاثة إجراءات: قبول (صرف كامل أو جزئي) · رفض (بسبيبه) · إعادة للمراجعة
//  - إشعارات المدير (تأكيدات الاستلام) داخل قائمة الإدارة
//  - تقارير أسبوعية/شهرية/سنوية/مخصصة — يُفصل الريال السعودي عن اليمني
//  البيانات عبر DB (Firestore settings/expenses أو localStorage) — مزامنة فورية
// ============================================================
(function(){
  'use strict';

  function $(id){ return document.getElementById(id); }
  function esc(s){ return String(s==null?'':s).replace(/[&<>"']/g, function(c){
    return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
  function toast(m){ try{ if(typeof showToast==='function'){ showToast(m); return; } }catch(e){} alert(m); }
  function me(){ try{ if(typeof currentUser !== 'undefined' && currentUser) return currentUser; }catch(e){} try{ if(typeof currentPosUser !== 'undefined' && currentPosUser) return currentPosUser; }catch(e){} return null; }
  function isMgr(){ var u = me(); return !!(u && u.role === 'مدير'); }
  function money(n, cur){
    try{ if(window.DB && DB.fmtExpMoney) return DB.fmtExpMoney(n, cur); }catch(e){}
    return (Number(n)||0).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2}) + ' ' + (cur==='YER'?'ر.ي':'ر.س');
  }
  function num(n){ return Number(n)||0; }
  function curCode(c){ return c === 'YER' ? 'YER' : 'SAR'; }
  function curLabel(c){ return c === 'YER' ? '🇾🇪 ر.ي' : '🇸🇦 ر.س'; }
  function statusLabel(s){
    try{ if(DB.EXP_STATUS_LABEL && DB.EXP_STATUS_LABEL[s]) return DB.EXP_STATUS_LABEL[s]; }catch(e){}
    return s || '—';
  }
  function statusBadge(s){
    var cls = {pending:'pend', returned:'ret', approved:'ok', partial:'part', received:'done', rejected:'rej'}[s] || 'pend';
    return '<span class="exp-badge exp-' + cls + '">' + esc(statusLabel(s)) + '</span>';
  }
  function fmtWhen(ts){
    if(!ts) return '—';
    var d = new Date(ts), p = function(n){ return String(n).padStart(2,'0'); };
    return d.getFullYear()+'-'+p(d.getMonth()+1)+'-'+p(d.getDate()) + ' ' + p(d.getHours())+':'+p(d.getMinutes());
  }
  function dateStr(ts){
    var d = new Date(ts||Date.now()), p = function(n){ return String(n).padStart(2,'0'); };
    return d.getFullYear()+'-'+p(d.getMonth()+1)+'-'+p(d.getDate());
  }
  // تنظيف مبلغ: أرقام + نقطة واحدة بحد أقصى خانتين
  function sanitizeAmount(inp){
    inp.addEventListener('input', function(){
      var v = inp.value.replace(/[^\d.]/g, '');
      var i1 = v.indexOf('.');
      if(i1 !== -1){ v = v.slice(0, i1+1) + v.slice(i1+1).replace(/\./g, ''); }
      var parts = v.split('.');
      if(parts[1] && parts[1].length > 2){ v = parts[0] + '.' + parts[1].slice(0,2); }
      if(v !== inp.value) inp.value = v;
    });
    inp.addEventListener('keydown', function(e){ if(e.key === ' ' || /[eE]/.test(e.key)) e.preventDefault(); });
  }

  // ---------- CSS مُحقَن ----------
  var CSS = '' +
  '.exp-toolbar{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin:0 0 12px;' +
    'background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:10px 12px;}' +
  '.exp-toolbar input[type=search]{flex:1;min-width:210px;border:2px solid #e2e8f0;border-radius:11px;padding:9px 12px;' +
    'font-family:inherit;font-size:14px;background:#f8fafc;outline:none;}' +
  '.exp-toolbar input[type=search]:focus{border-color:#2563eb;background:#fff;}' +
  '.exp-toolbar select{border:2px solid #e2e8f0;border-radius:11px;padding:9px 10px;font-family:inherit;font-size:13.5px;' +
    'background:#f8fafc;color:#0f172a;outline:none;}' +
  '.exp-date-lbl{font-size:13px;font-weight:800;color:#475569;display:inline-flex;align-items:center;gap:6px;}' +
  '.exp-date-lbl input{border:2px solid #e2e8f0;border-radius:10px;padding:7px 8px;font-family:inherit;font-size:13px;background:#f8fafc;}' +
  '.exp-inline-select{border:2px solid #e2e8f0;border-radius:9px;padding:5px 8px;font-family:inherit;font-size:13px;background:#fff;}' +
  '.exp-badge{display:inline-block;padding:3px 10px;border-radius:99px;font-size:11.5px;font-weight:800;white-space:nowrap;}' +
  '.exp-pend{background:#fef3c7;color:#92400e;}' + '.exp-ret{background:#e0e7ff;color:#3730a3;}' +
  '.exp-ok{background:#dbeafe;color:#1e40af;}' + '.exp-part{background:#ffedd5;color:#9a3412;}' +
  '.exp-done{background:#d1fae5;color:#065f46;}' + '.exp-rej{background:#fee2e2;color:#991b1b;}' +
  '.exp-amt{font-weight:900;color:#1e3a8a;white-space:nowrap;}' +
  '.exp-rem{font-weight:800;color:#b45309;white-space:nowrap;}' +
  '.exp-paid{font-weight:800;color:#047857;white-space:nowrap;}' +
  '.exp-actions{display:flex;gap:6px;flex-wrap:wrap;}' +
  '.exp-btn{border:none;border-radius:9px;padding:7px 11px;cursor:pointer;font-family:inherit;font-size:12.5px;' +
    'font-weight:800;color:#fff;transition:filter .15s,transform .1s;white-space:nowrap;}' +
  '.exp-btn:hover{filter:brightness(1.08);}' + '.exp-btn:active{transform:scale(.96);}' +
  '.exp-btn.appr{background:linear-gradient(135deg,#16a34a,#22c55e);}' +
  '.exp-btn.rej{background:linear-gradient(135deg,#dc2626,#ef4444);}' +
  '.exp-btn.ret{background:linear-gradient(135deg,#6366f1,#818cf8);}' +
  '.exp-btn.det{background:linear-gradient(135deg,#334155,#64748b);}' +
  '.exp-btn[disabled]{opacity:.5;cursor:not-allowed;}' +
  '.exp-empty{text-align:center;color:#94a3b8;font-size:14px;padding:26px 12px;background:#fff;border:1px dashed #cbd5e1;' +
    'border-radius:14px;margin-top:6px;}' +
  '.exp-note-cell{font-size:12.5px;color:#475569;max-width:210px;line-height:1.7;}' +
  /* إشعارات المدير */ '.exp-notice{display:flex;gap:10px;align-items:flex-start;background:#eff6ff;border:1px solid #bfdbfe;' +
    'border-inline-start:5px solid #2563eb;border-radius:13px;padding:11px 13px;margin:0 0 10px;}' +
  '.exp-notice.conf{background:#ecfdf5;border-color:#a7f3d0;border-inline-start-color:#10b981;}' +
  '.exp-notice-body{flex:1;min-width:0;font-size:13.5px;color:#1e3a8a;line-height:1.9;}' +
  '.exp-notice-body b{color:#0f172a;}' +
  '.exp-notice .exp-btn{flex:none;}' +
  /* نوافذ الإجراءات */ '.exp-mrec{background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:11px 13px;' +
    'font-size:13.5px;color:#334155;line-height:2;margin-bottom:4px;}' +
  '.exp-mrec b{color:#0f172a;}' +
  '.exp-approve-preview{background:#eff6ff;border:1px dashed #93c5fd;border-radius:12px;padding:10px 12px;' +
    'font-size:13.5px;color:#1e3a8a;line-height:2;margin-bottom:4px;font-weight:700;}' +
  '.exp-err{color:#b91c1c;font-size:13px;font-weight:700;min-height:17px;text-align:center;}' +
  '.exp-hint{display:block;color:#64748b;font-size:12px;margin:-6px 0 8px;line-height:1.7;}' +
  '.exp-detail-body{padding:16px 18px;}' +
  '.exp-detail-sec{background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:11px 13px;margin-bottom:12px;' +
    'font-size:13.5px;line-height:2.1;color:#334155;}' +
  '.exp-detail-sec b{color:#0f172a;}' +
  '.exp-detail-sec h4{margin:0 0 6px;font-size:14px;color:#1e3a8a;}' +
  '.exp-detail-log{list-style:none;margin:0;padding:0;}' +
  '.exp-detail-log li{background:#fff;border:1px solid #eef2f7;border-radius:10px;padding:7px 10px;margin-bottom:6px;' +
    'font-size:12.8px;color:#475569;line-height:1.8;}' +
  '.exp-detail-log li b{color:#0f172a;}' +
  /* التقارير */ '.exp-range-box{background:linear-gradient(120deg,#1e3a8a,#2563eb);color:#fff;border-radius:13px;' +
    'padding:12px 15px;font-size:14px;font-weight:800;margin-bottom:13px;box-shadow:0 8px 20px -12px rgba(37,99,235,.9);}' +
  '.exp-range-box small{display:block;font-weight:600;opacity:.85;font-size:12px;margin-top:3px;}' +
  '.exp-sum-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:14px;margin-bottom:16px;}' +
  '.exp-sum-card{background:#fff;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden;' +
    'box-shadow:0 6px 18px -14px rgba(15,23,42,.6);}' +
  '.exp-sum-head{background:linear-gradient(120deg,#1e3a8a,#2563eb);color:#fff;padding:11px 14px;font-size:15px;font-weight:800;}' +
  '.exp-sum-head.yer{background:linear-gradient(120deg,#7c3aed,#a855f7);}' +
  '.exp-sum-rows{padding:8px 14px 13px;}' +
  '.exp-sum-row{display:flex;justify-content:space-between;gap:10px;padding:7px 0;border-bottom:1px dashed #eef2f7;' +
    'font-size:13.5px;color:#475569;}' +
  '.exp-sum-row:last-child{border-bottom:none;}' +
  '.exp-sum-row b{color:#0f172a;font-weight:900;direction:rtl;}' +
  '.exp-sum-row.tot{background:#eff6ff;border-radius:10px;margin-top:6px;padding:9px 10px;border-bottom:none;}' +
  '.exp-sum-row.tot b{color:#1e3a8a;font-size:15.5px;}' +
  '.panel-like{background:#fff;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden;margin-bottom:14px;' +
    'box-shadow:0 6px 18px -14px rgba(15,23,42,.6);}' +
  '.panel-like-head{padding:11px 14px;background:#f1f5f9;border-bottom:1px solid #e2e8f0;}' +
  '.panel-like-head h3{margin:0;font-size:14.5px;color:#1e3a8a;}' +
  '.panel-like .table-wrap{padding:0;}' +
  '.exp-break-list{padding:10px 14px;}' +
  '.exp-break-item{display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;font-size:13.5px;color:#475569;' +
    'padding:8px 10px;border-radius:10px;margin-bottom:6px;background:#f8fafc;border:1px solid #eef2f7;}' +
  '.exp-break-item b{color:#0f172a;}' +
  '.exp-break-item .exp-bk-nums{display:flex;gap:14px;flex-wrap:wrap;}' +
  '.exp-breakdowns{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:0 14px;}' +
  '@media(max-width:640px){ .exp-toolbar{flex-direction:column;align-items:stretch;} ' +
    '.exp-toolbar input[type=search]{min-width:0;} .exp-actions{justify-content:flex-start;} }' +
  /* ==== إضافة: نوافذ الإجراءات + اختيار المستخدمين + PDF ==== */ +
  '#expApproveModal,#expRejectModal,#expReturnModal,#expDetailModal{z-index:9000;}' +
  '#expApproveModal label,#expRejectModal label,#expReturnModal label{display:flex;flex-direction:column;gap:6px;font-size:13.5px;font-weight:700;color:#334155;margin-bottom:12px;}' +
  '#expApproveModal label input,#expApproveModal label textarea,#expRejectModal label textarea,#expReturnModal label textarea{background:#f8fafc;border:2px solid #e2e8f0;border-radius:10px;padding:10px 12px;font-family:inherit;font-size:15px;color:#0f172a;outline:none;}' +
  '#expApproveModal label input:focus,#expRejectModal label textarea:focus,#expReturnModal label textarea:focus{border-color:#2563eb;}' +
  '#expRejectModal label textarea,#expReturnModal label textarea{min-height:80px;resize:vertical;}' +
  '.exp-btn-block{width:100%;border:none;border-radius:12px;padding:12px;cursor:pointer;color:#fff;font-family:inherit;font-size:15px;font-weight:800;background:linear-gradient(135deg,#1e3a8a,#2563eb);}' +
  '.ex-rep-users{background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:10px 12px;margin-bottom:10px;}' +
  '.ex-rep-users-head{display:flex;align-items:center;gap:8px;flex-wrap:wrap;font-size:13px;font-weight:800;color:#334155;margin-bottom:8px;}' +
  '.ex-rep-users-list{display:flex;flex-wrap:wrap;gap:7px;}' +
  '.ex-user-chip{display:inline-flex;align-items:center;gap:6px;background:#f8fafc;border:1.5px solid #e2e8f0;border-radius:99px;padding:6px 11px;font-size:12.5px;font-weight:800;color:#334155;cursor:pointer;transition:all .15s;}' +
  '.ex-user-chip:has(input:checked){border-color:#2563eb;background:#eff6ff;color:#1e3a8a;}' +
  '.ex-user-chip input{accent-color:#2563eb;cursor:pointer;}' +
  '.ex-pdf-btn{border:none;border-radius:13px;padding:12px 18px;cursor:pointer;color:#fff;font-family:inherit;font-size:14.5px;font-weight:800;background:linear-gradient(135deg,#dc2626,#f43f5e);box-shadow:0 8px 18px -9px rgba(244,63,94,.8);transition:transform .15s;margin:6px 0 10px;}' +
  '.ex-pdf-btn:active{transform:scale(.98);}' ;
  (function injectCSS(){
    var s = document.createElement('style');
    s.id = 'expensesAdminStyle';
    s.textContent = CSS;
    document.head.appendChild(s);
  })();

  // ---------- الحالة ----------
  var expCache = [];
  var busy = {};                 // منع الضغط المزدوج أثناء تنفيذ إجراء
  var repUsersSel = {};          // المستخدمون المُدرَجون في التقرير (userId -> bool)

  function findExp(id){ return expCache.find(function(x){ return x && x.id === id; }) || null; }

  // ========== الإشعارات الموجّهة للمدير (تأكيدات الاستلام) ==========
  function noticeSeenKey(r){ return 'exp_admin_seen_' + r.id + '_' + (r.receivedAt||0); }
  function noticeUnseen(r){ try{ return localStorage.getItem(noticeSeenKey(r)) !== '1'; }catch(e){ return false; } }
  function markNoticeSeen(r){ try{ localStorage.setItem(noticeSeenKey(r), '1'); }catch(e){} }
  function pendingList(){ return expCache.filter(function(r){ return r && (r.status==='pending' || r.status==='returned'); }); }
  function receiptNotices(){
    return expCache.filter(function(r){ return r && r.adminNotice && r.receivedAt && noticeUnseen(r); })
                   .sort(function(a,b){ return (b.receivedAt||0)-(a.receivedAt||0); });
  }

  function renderBadge(){
    var b = $('expBadge');
    if(!b) return;
    var n = (isMgr() ? pendingList().length : 0) + (isMgr() ? receiptNotices().length : 0);
    b.textContent = String(n);
    b.style.display = (n > 0) ? '' : 'none';
  }

  function renderNotices(){
    var wrap = $('expNotices');
    if(!wrap) return;
    if(!isMgr()){ wrap.innerHTML = ''; return; }
    var list = receiptNotices();
    if(!list.length){ wrap.innerHTML = ''; return; }
    wrap.innerHTML = list.map(function(r){
      return '<div class="exp-notice conf">' +
        '<div class="exp-notice-body">🔔 <b>' + esc(r.adminNotice.text) + '</b>' +
          '<div>الطلب: ' + esc(r.userName||r.userId) + ' · ' + esc(money(r.amount, r.currency)) +
          ' · ' + esc(r.reason||'') + '</div>' +
          '<div style="font-size:12px;color:#64748b">تاريخ الاستلام: ' + esc(fmtWhen(r.receivedAt)) + '</div>' +
        '</div>' +
        '<button type="button" class="exp-btn det" data-exp-detail="' + esc(r.id) + '">📂 فتح الطلب</button>' +
        '<button type="button" class="exp-btn det" data-exp-notice-read="' + esc(r.id) + '">✔ إخفاء</button>' +
      '</div>';
    }).join('');
    wireRowButtons(wrap);
    wrap.querySelectorAll('[data-exp-notice-read]').forEach(function(b){
      b.onclick = function(){
        var r = findExp(b.dataset.expNoticeRead);
        if(r){ markNoticeSeen(r); renderNotices(); renderBadge(); }
      };
    });
  }

  // ========== قائمة الطلبات (إدارة المصاريف) ==========
  function filtered(){
    var q = (($('expSearch') && $('expSearch').value) || '').trim().toLowerCase();
    var st = ($('expStatus') && $('expStatus').value) || '';
    var cu = ($('expCur') && $('expCur').value) || '';
    var from = ($('expFrom') && $('expFrom').value) || '';
    var to = ($('expTo') && $('expTo').value) || '';
    return expCache.filter(function(r){
      if(!r) return false;
      if(st && (r.status||'') !== st) return false;
      if(cu && curCode(r.currency) !== cu) return false;
      var d = r.dateStr || dateStr(r.createdAt);
      if(from && d < from) return false;
      if(to && d > to) return false;
      if(q){
        var hay = ((r.userName||'') + ' ' + (r.userId||'') + ' ' + (r.reason||'') + ' ' + (r.note||'') + ' ' + (r.id||'')).toLowerCase();
        if(hay.indexOf(q) === -1) return false;
      }
      return true;
    }).sort(function(a,b){ return (b.createdAt||0) - (a.createdAt||0); });   // الأحدث أعلى القائمة
  }

  function rowActions(r){
    var u = me();
    var h = '<div class="exp-actions">';
    var canApprove = isMgr() && !busy[r.id] && u && r.userId !== u.username &&
                     r.status !== 'received' && r.status !== 'rejected' && num(r.paid) < num(r.amount);
    var canReject = isMgr() && !busy[r.id] && u && r.userId !== u.username &&
                    (r.status === 'pending' || r.status === 'returned') && num(r.paid) === 0;
    var canReturn = isMgr() && !busy[r.id] && u && r.userId !== u.username &&
                    ['pending','approved','partial','rejected'].indexOf(r.status) !== -1;
    if(canApprove) h += '<button type="button" class="exp-btn appr" data-exp-approve="' + esc(r.id) + '">✅ قبول</button>';
    if(canReject)  h += '<button type="button" class="exp-btn rej" data-exp-reject="' + esc(r.id) + '">❌ رفض</button>';
    if(canReturn)  h += '<button type="button" class="exp-btn ret" data-exp-return="' + esc(r.id) + '">↩️ إعادة للمراجعة</button>';
    if(!canApprove && !canReject && !canReturn && isMgr() && u && r.userId === u.username){
      h += '<span style="font-size:12px;color:#94a3b8;font-weight:700">⛔ طلبك الشخصي — لا يُعتمد ذاتياً</span>';
    }
    h += '<button type="button" class="exp-btn det" data-exp-detail="' + esc(r.id) + '">📂 السجل</button>';
    h += '</div>';
    return h;
  }

  function notesCell(r){
    var h = '<div class="exp-note-cell">';
    if(r.status === 'rejected' && r.rejectReason) h += '❌ ' + esc(r.rejectReason);
    else if(r.status === 'returned' && r.returnNote) h += '↩️ ' + esc(r.returnNote);
    else if(r.note) h += '📝 ' + esc(r.note);
    else h += '—';
    h += '</div>';
    return h;
  }

  function renderTable(){
    var body = $('expBody');
    if(!body) return;
    if(!isMgr()){ body.innerHTML = ''; return; }     // القسم للمدير فقط
    var list = filtered();
    var empty = $('expEmpty');
    if(empty) empty.style.display = list.length ? 'none' : '';
    body.innerHTML = list.map(function(r){
      var rem = Math.max(0, num(r.amount) - num(r.paid));
      return '<tr data-expid="' + esc(r.id) + '">' +
        '<td><b>' + esc(r.userName || r.userId) + '</b><br><small style="color:#94a3b8">' + esc(r.userId) + '</small></td>' +
        '<td class="exp-amt">' + esc(money(r.amount, r.currency)) + '</td>' +
        '<td>' + curLabel(r.currency) + '<br><small style="color:#94a3b8">' + (r.currency==='YER'?'ريال يمني':'ريال سعودي') + '</small></td>' +
        '<td>' + esc(r.reason || '—') + '</td>' +
        '<td>' + esc(r.dateStr || dateStr(r.createdAt)) + '<br><small style="color:#94a3b8">' + esc(r.timeStr || fmtWhen(r.createdAt)) + '</small></td>' +
        '<td>' + statusBadge(r.status) + (r.receivedAt ? '<br><small style="color:#059669">✅ ' + esc(fmtWhen(r.receivedAt)) + '</small>' : '') + '</td>' +
        '<td class="exp-paid">' + esc(money(r.paid||0, r.currency)) + '</td>' +
        '<td class="exp-rem">' + (rem > 0 ? esc(money(rem, r.currency)) : '—') + '</td>' +
        '<td>' + notesCell(r) + '</td>' +
        '<td>' + rowActions(r) + '</td>' +
      '</tr>';
    }).join('');
    wireRowButtons(body);
  }

  function wireRowButtons(scope){
    scope.querySelectorAll('[data-exp-approve]').forEach(function(b){ b.onclick = function(){ openApprove(b.dataset.expApprove); }; });
    scope.querySelectorAll('[data-exp-reject]').forEach(function(b){ b.onclick = function(){ openReject(b.dataset.expReject); }; });
    scope.querySelectorAll('[data-exp-return]').forEach(function(b){ b.onclick = function(){ openReturn(b.dataset.expReturn); }; });
    scope.querySelectorAll('[data-exp-detail]').forEach(function(b){ b.onclick = function(){ openDetail(b.dataset.expDetail); }; });
  }

  // ========== إجراء: قبول / صرف ==========
  var approveId = null;
  function openApprove(id){
    var r = findExp(id); if(!r) return;
    var u = me();
    if(!u || !isMgr()){ toast('⛔ الإجراء متاح للمدير فقط'); return; }
    if(r.userId === u.username){ toast('⛔ لا يمكنك اعتماد طلبك بنفسك'); return; }
    if(r.status === 'received'){ toast('تم تأكيد الاستلام مسبقاً — لا يمكن إعادة الصرف'); return; }
    if(r.status === 'rejected'){ toast('الطلب مرفوض — استخدم «إعادة للمراجعة» أولاً'); return; }
    if(num(r.paid) >= num(r.amount)){ toast('تم صرف كامل المبلغ لهذا الطلب'); return; }
    approveId = id;
    var rem = Math.max(0, num(r.amount) - num(r.paid));
    $('expApproveRec').innerHTML =
      '<div>مقدم الطلب: <b>' + esc(r.userName||r.userId) + '</b></div>' +
      '<div>المبلغ المطلوب: <b>' + esc(money(r.amount, r.currency)) + '</b> (' + curLabel(r.currency) + ')</div>' +
      '<div>المُسلَّم سابقاً: <b>' + esc(money(r.paid||0, r.currency)) + '</b></div>' +
      '<div>المتبقي: <b>' + esc(money(rem, r.currency)) + '</b></div>' +
      '<div>السبب: <b>' + esc(r.reason||'—') + '</b></div>';
    $('expApproveAmount').value = (rem > 0) ? String(rem) : '';
    $('expApproveErr').textContent = '';
    updateApprovePreview();
    $('expApproveModal').classList.add('show');
  }
  function updateApprovePreview(){
    var r = findExp(approveId); if(!r) return;
    var v = parseFloat($('expApproveAmount').value || '0');
    if(!isFinite(v) || v < 0) v = 0;
    var paidBefore = num(r.paid);
    var total = Math.min(num(r.amount), paidBefore + v);      // لا يتجاوز المطلوب
    var remAfter = Math.max(0, num(r.amount) - total);
    var st = (total >= num(r.amount)) ? 'approved' : 'partial';
    $('expApprovePreview').innerHTML =
      'سيُسلَّم الآن: <b>' + esc(money(v, r.currency)) + '</b> · ' +
      'إجمالي المُسلَّم: <b>' + esc(money(total, r.currency)) + '</b> · ' +
      'المتبقي بعد الصرف: <b>' + esc(money(remAfter, r.currency)) + '</b><br>' +
      'حالة الطلب ستكون: <b>' + esc(statusLabel(st)) + '</b>' +
      (st === 'approved' ? ' (بانتظار تأكيد الاستلام من المستخدم)' : '');
  }

  // ========== إجراء: رفض ==========
  var rejectId = null;
  function openReject(id){
    var r = findExp(id); if(!r) return;
    var u = me();
    if(!u || !isMgr()){ toast('⛔ الإجراء متاح للمدير فقط'); return; }
    if(r.userId === u.username){ toast('⛔ لا يمكنك رفض طلبك بنفسك'); return; }
    if(r.status === 'received' || num(r.paid) > 0){ toast('لا يمكن رفض طلب صُرف منه مبلغ — استخدم «إعادة للمراجعة»'); return; }
    if(r.status === 'rejected'){ toast('الطلب مرفوض مسبقاً'); return; }
    rejectId = id;
    $('expRejectRec').innerHTML =
      '<div>مقدم الطلب: <b>' + esc(r.userName||r.userId) + '</b></div>' +
      '<div>المبلغ: <b>' + esc(money(r.amount, r.currency)) + '</b> (' + curLabel(r.currency) + ')</div>' +
      '<div>السبب: <b>' + esc(r.reason||'—') + '</b></div>';
    $('expRejectReason').value = '';
    $('expRejectErr').textContent = '';
    $('expRejectModal').classList.add('show');
  }

  // ========== إجراء: إعادة للمراجعة ==========
  var returnId = null;
  function openReturn(id){
    var r = findExp(id); if(!r) return;
    var u = me();
    if(!u || !isMgr()){ toast('⛔ الإجراء متاح للمدير فقط'); return; }
    if(r.userId === u.username){ toast('⛔ لا يمكنك إعادة طلبك للمراجعة بنفسك'); return; }
    if(r.status === 'received'){ toast('تم تأكيد الاستلام نهائياً — لا يمكن إعادة الطلب'); return; }
    returnId = id;
    $('expReturnRec').innerHTML =
      '<div>مقدم الطلب: <b>' + esc(r.userName||r.userId) + '</b></div>' +
      '<div>المبلغ: <b>' + esc(money(r.amount, r.currency)) + '</b> (' + curLabel(r.currency) + ')</div>' +
      '<div>الحالة الحالية: <b>' + esc(statusLabel(r.status)) + '</b></div>' +
      (num(r.paid) > 0 ? '<div>المُسلَّم سابقاً: <b>' + esc(money(r.paid, r.currency)) + '</b> (يبقى مسجلاً)</div>' : '');
    $('expReturnNote').value = '';
    $('expReturnErr').textContent = '';
    $('expReturnModal').classList.add('show');
  }

  // ========== نافذة التفاصيل والسجل ==========
  function openDetail(id){
    var r = findExp(id); if(!r) return;
    var rem = Math.max(0, num(r.amount) - num(r.paid));
    var log = Array.isArray(r.log) ? r.log : [];
    var acts = {created:'إنشاء الطلب', approve:'اعتماد الصرف', reject:'رفض الطلب',
                return:'إعادة للمراجعة', receipt:'تأكيد الاستلام'};
    $('expDetailBody').innerHTML =
      '<div class="exp-detail-sec">' +
        '<h4>📄 بيانات الطلب</h4>' +
        '<div>رقم الطلب: <b>' + esc(r.id) + '</b></div>' +
        '<div>مقدم الطلب: <b>' + esc(r.userName||r.userId) + '</b> (' + esc(r.userId) + ')</div>' +
        '<div>التاريخ والوقت: <b>' + esc(r.dateStr||dateStr(r.createdAt)) + ' — ' + esc(r.timeStr||fmtWhen(r.createdAt)) + '</b></div>' +
        '<div>السبب: <b>' + esc(r.reason||'—') + '</b></div>' +
        (r.note ? '<div>ملاحظات مقدم الطلب: <b>' + esc(r.note) + '</b></div>' : '') +
        '<div>الحالة: <b>' + esc(statusLabel(r.status)) + '</b></div>' +
      '</div>' +
      '<div class="exp-detail-sec">' +
        '<h4>💵 المبالغ (' + curLabel(r.currency) + ' — ' + (r.currency==='YER'?'ريال يمني':'ريال سعودي') + ')</h4>' +
        '<div>المبلغ المطلوب: <b>' + esc(money(r.amount, r.currency)) + '</b></div>' +
        '<div>المبلغ المعتمد والمسلَّم فعلياً: <b>' + esc(money(r.paid||0, r.currency)) + '</b></div>' +
        '<div>المبلغ المتبقي: <b>' + esc(money(rem, r.currency)) + '</b></div>' +
        '<div style="font-size:12px;color:#94a3b8">كل عملة تُحسب بشكل مستقل — لا يوجد تحويل بين الريال السعودي واليمني.</div>' +
      '</div>' +
      (r.approvedBy ? '<div class="exp-detail-sec"><h4>✅ اعتماد الصرف</h4>' +
        '<div>الذي اعتمد: <b>' + esc(r.approvedByName||r.approvedBy) + '</b></div>' +
        '<div>التاريخ: <b>' + esc(fmtWhen(r.approvedAt)) + '</b></div></div>' : '') +
      (r.rejectedBy || r.rejectReason ? '<div class="exp-detail-sec"><h4>❌ الرفض</h4>' +
        (r.rejectReason ? '<div>السبب: <b>' + esc(r.rejectReason) + '</b></div>' : '') +
        (r.rejectedBy ? '<div>الذي رفض: <b>' + esc(r.rejectedByName||r.rejectedBy) + '</b> · <b>' + esc(fmtWhen(r.rejectedAt)) + '</b></div>' : '') +
        '</div>' : '') +
      (r.returnedBy || r.returnNote ? '<div class="exp-detail-sec"><h4>↩️ الإعادة للمراجعة</h4>' +
        (r.returnNote ? '<div>الملاحظة: <b>' + esc(r.returnNote) + '</b></div>' : '') +
        (r.returnedBy ? '<div>الذي أعاده: <b>' + esc(r.returnedByName||r.returnedBy) + '</b> · <b>' + esc(fmtWhen(r.returnedAt)) + '</b></div>' : '') +
        '</div>' : '') +
      (r.receivedAt ? '<div class="exp-detail-sec"><h4>🤝 تأكيد الاستلام</h4>' +
        '<div>أكّد الاستلام: <b>' + esc(r.receivedByName||r.receivedBy) + '</b></div>' +
        '<div>التاريخ والوقت: <b>' + esc(fmtWhen(r.receivedAt)) + '</b></div>' +
        (r.adminNotice ? '<div>إشعار المدير: <b>' + esc(r.adminNotice.text) + '</b></div>' : '') +
        '</div>' : '') +
      '<div class="exp-detail-sec"><h4>📜 سجل المراحل (' + log.length + ')</h4>' +
        '<ul class="exp-detail-log">' +
          (log.length ? log.map(function(l){
            return '<li><b>' + esc(acts[l.action] || l.action) + '</b> — ' + esc(fmtWhen(l.ts)) +
                   (l.byName ? ' · ' + esc(l.byName) : '') + (l.detail ? ' — ' + esc(l.detail) : '') + '</li>';
          }).join('') : '<li>لا توجد مراحل مسجلة</li>') +
        '</ul>' +
      '</div>';
    $('expDetailModal').classList.add('show');
  }

  // ========== نفاذ الإجراء المركزي (مع منع التكرار) ==========
  function runAction(id, guard, patch, okMsg){
    if(busy[id]) return;
    busy[id] = true;
    renderTable();
    DB.actExpense(id, guard, patch).then(function(res){
      busy[id] = false;
      if(res && res.ok){ toast(okMsg); }
      else {
        var reason = (res && res.reason) || 'خطأ غير معروف';
        var map = {
          not_found: 'الطلب غير موجود',
          'الصلاحية للمدير فقط': '⛔ الصلاحية للمدير فقط',
          'لا يمكنك اعتماد طلبك بنفسك': '⛔ لا يمكنك اعتماد طلبك بنفسك',
          'تم تأكيد الاستلام مسبقاً — لا يمكن إعادة الصرف': 'تم تأكيد الاستلام مسبقاً — لا يمكن إعادة الصرف',
          'تم صرف كامل المبلغ مسبقاً': 'تم صرف كامل المبلغ مسبقاً — لا يمكن تكرار الصرف',
          'الحالة الحالية لا تسمح بهذا الإجراء': 'الحالة الحالية لا تسمح بهذا الإجراء',
          error: 'تعذّر الحفظ — تحقق من الاتصال'
        };
        toast(map[reason] || ('تعذّر تنفيذ الإجراء: ' + reason));
      }
      renderAll();
    }).catch(function(e){
      console.warn('إجراء المصاريف:', e);
      busy[id] = false;
      toast('تعذّر تنفيذ الإجراء — حاول مجدداً');
      renderAll();
    });
  }

  // ---------- ربط نوافذ الإجراءات ----------
  function wireModals(){
    var amt = $('expApproveAmount');
    if(amt){ sanitizeAmount(amt); amt.addEventListener('input', updateApprovePreview); }
    if($('closeExpApprove')) $('closeExpApprove').onclick = function(){ $('expApproveModal').classList.remove('show'); approveId = null; };
    if($('closeExpReject')) $('closeExpReject').onclick = function(){ $('expRejectModal').classList.remove('show'); rejectId = null; };
    if($('closeExpReturn')) $('closeExpReturn').onclick = function(){ $('expReturnModal').classList.remove('show'); returnId = null; };
    if($('closeExpDetail')) $('closeExpDetail').onclick = function(){ $('expDetailModal').classList.remove('show'); };
    ['expApproveModal','expRejectModal','expReturnModal','expDetailModal'].forEach(function(mid){
      var m = $(mid);
      if(m) m.addEventListener('click', function(e){ if(e.target === m) m.classList.remove('show'); });
    });

    // --- قبول ---
    var af = $('expApproveForm');
    if(af) af.onsubmit = function(e){
      e.preventDefault();
      var id = approveId; var r = findExp(id);
      if(!r){ $('expApproveErr').textContent = 'الطلب غير موجود'; return; }
      var u = me();
      var raw = ($('expApproveAmount').value || '').trim();
      if(!/^\d+(\.\d{1,2})?$/.test(raw)){ $('expApproveErr').textContent = 'أدخل مبلغاً رقمياً صحيحاً أو عشرياً'; return; }
      var pay = parseFloat(raw);
      if(!isFinite(pay) || pay <= 0){ $('expApproveErr').textContent = 'أدخل مبلغاً أكبر من صفر'; return; }
      var rem = Math.max(0, num(r.amount) - num(r.paid));
      if(pay > rem){ $('expApproveErr').textContent = 'المبلغ أكبر من المتبقي (' + money(rem, r.currency) + ')'; return; }
      $('expApproveErr').textContent = '';

      var total = num(r.paid) + pay;
      var full = total >= num(r.amount);
      var msg = 'تأكيد صرف المبلغ؟\n\n' +
        'المستخدم: ' + (r.userName||r.userId) + '\n' +
        'يُسلَّم الآن: ' + money(pay, r.currency) + '\n' +
        'إجمالي المُسلَّم: ' + money(total, r.currency) + ' من ' + money(r.amount, r.currency) + '\n' +
        (full ? 'الحالة: معتمد للصرف (بانتظار تأكيد المستخدم)' : 'الحالة: تم التسليم جزئيًا — المتبقي ' + money(r.amount - total, r.currency));
      if(!confirm(msg)) return;

      $('expApproveModal').classList.remove('show');
      runAction(id,
        function(x){
          if(!x) return 'غير موجود';
          if(!isMgr()) return 'الصلاحية للمدير فقط';
          if(x.userId === (u && u.username)) return 'لا يمكنك اعتماد طلبك بنفسك';
          if(x.status === 'received') return 'تم تأكيد الاستلام مسبقاً — لا يمكن إعادة الصرف';
          if(x.status === 'rejected') return 'الحالة الحالية لا تسمح بهذا الإجراء';
          if(num(x.paid) >= num(x.amount)) return 'تم صرف كامل المبلغ مسبقاً';
          if((num(x.paid) + pay) > num(x.amount)) return 'تم صرف كامل المبلغ مسبقاً';
          return true;
        },
        function(x){
          var newTotal = Math.min(num(x.amount), num(x.paid) + pay);
          var patch = {
            status: (newTotal >= num(x.amount)) ? 'approved' : 'partial',
            paid: newTotal,
            approvedBy: u.username,
            approvedByName: u.name || u.username,
            approvedAt: Date.now(),
            log: (Array.isArray(x.log) ? x.log : []).concat([{
              ts: Date.now(), by: u.username, byName: (u.name || u.username),
              action: 'approve',
              detail: 'صرف ' + money(pay, x.currency) + ' — الإجمالي ' + money(newTotal, x.currency) + ' من ' + money(x.amount, x.currency)
            }])
          };
          return patch;
        },
        '✅ تم اعتماد الصرف وتسليم ' + money(pay, r.currency)
      );
      approveId = null;
    };

    // --- رفض ---
    var rf = $('expRejectForm');
    if(rf) rf.onsubmit = function(e){
      e.preventDefault();
      var id = rejectId; var r = findExp(id);
      if(!r){ $('expRejectErr').textContent = 'الطلب غير موجود'; return; }
      var u = me();
      var reason = ($('expRejectReason').value || '').trim();
      if(!reason){ $('expRejectErr').textContent = 'الرجاء كتابة سبب الرفض'; return; }
      $('expRejectErr').textContent = '';
      if(!confirm('تأكيد رفض طلب مصروف ' + (r.userName||r.userId) + ' بمبلغ ' + money(r.amount, r.currency) + '؟\n\nالسبب: ' + reason)) return;

      $('expRejectModal').classList.remove('show');
      runAction(id,
        function(x){
          if(!x) return 'غير موجود';
          if(!isMgr()) return 'الصلاحية للمدير فقط';
          if(x.userId === (u && u.username)) return 'لا يمكنك اعتماد طلبك بنفسك';
          if(x.status === 'received') return 'تم تأكيد الاستلام مسبقاً — لا يمكن إعادة الصرف';
          if(x.status === 'rejected') return 'الحالة الحالية لا تسمح بهذا الإجراء';
          if(num(x.paid) > 0) return 'الحالة الحالية لا تسمح بهذا الإجراء';
          if(x.status !== 'pending' && x.status !== 'returned') return 'الحالة الحالية لا تسمح بهذا الإجراء';
          return true;
        },
        function(x){
          return {
            status: 'rejected',
            rejectReason: reason,
            rejectedBy: u.username,
            rejectedByName: u.name || u.username,
            rejectedAt: Date.now(),
            log: (Array.isArray(x.log) ? x.log : []).concat([{
              ts: Date.now(), by: u.username, byName: (u.name || u.username),
              action: 'reject', detail: 'رفض الطلب — السبب: ' + reason
            }])
          };
        },
        '❌ تم رفض الطلب وإشعار المستخدم بالسبب'
      );
      rejectId = null;
    };

    // --- إعادة للمراجعة ---
    var tf = $('expReturnForm');
    if(tf) tf.onsubmit = function(e){
      e.preventDefault();
      var id = returnId; var r = findExp(id);
      if(!r){ $('expReturnErr').textContent = 'الطلب غير موجود'; return; }
      var u = me();
      var note = ($('expReturnNote').value || '').trim();
      $('expReturnErr').textContent = '';
      if(!confirm('إعادة طلب ' + (r.userName||r.userId) + ' إلى «بانتظار المراجعة»؟')) return;

      $('expReturnModal').classList.remove('show');
      runAction(id,
        function(x){
          if(!x) return 'غير موجود';
          if(!isMgr()) return 'الصلاحية للمدير فقط';
          if(x.userId === (u && u.username)) return 'لا يمكنك اعتماد طلبك بنفسك';
          if(x.status === 'received') return 'تم تأكيد الاستلام مسبقاً — لا يمكن إعادة الطلب';
          if(['pending','approved','partial','rejected'].indexOf(x.status) === -1) return 'الحالة الحالية لا تسمح بهذا الإجراء';
          return true;
        },
        function(x){
          return {
            status: 'returned',
            returnNote: note || 'أعيد للمراجعة',
            returnedBy: u.username,
            returnedByName: u.name || u.username,
            returnedAt: Date.now(),
            log: (Array.isArray(x.log) ? x.log : []).concat([{
              ts: Date.now(), by: u.username, byName: (u.name || u.username),
              action: 'return', detail: 'إعادة للمراجعة' + (note ? ' — ' + note : '')
            }])
          };
        },
        '↩️ أُعيد الطلب للمراجعة — أُضيفت إشعار للمستخدم'
      );
      returnId = null;
    };
  }

  // =================== التقارير ===================
  function weekStartDay(){
    try{
      if(typeof settingsCache !== 'undefined' && settingsCache && typeof settingsCache.weekStartDay === 'number'){
        return settingsCache.weekStartDay;
      }
    }catch(e){}
    try{
      var v = parseInt(localStorage.getItem('exp_week_start'), 10);
      if(!isNaN(v) && v >= 0 && v <= 6) return v;
    }catch(e){}
    return 6;   // افتراضي النظام: السبت
  }
  function periodRange(){
    var kind = ($('expRepRange') && $('expRepRange').value) || 'week';
    var now = new Date();
    var start, end;
    if(kind === 'week'){
      var ws = weekStartDay();
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      var diff = (start.getDay() - ws + 7) % 7;
      start.setDate(start.getDate() - diff);
      end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 7);
    } else if(kind === 'month'){
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    } else if(kind === 'year'){
      start = new Date(now.getFullYear(), 0, 1);
      end = new Date(now.getFullYear() + 1, 0, 1);
    } else {
      var f = ($('expRepFrom') && $('expRepFrom').value) || '';
      var t = ($('expRepTo') && $('expRepTo').value) || '';
      start = f ? new Date(f + 'T00:00:00') : new Date(2000, 0, 1);
      if(t){
        var tMid = new Date(t + 'T00:00:00');
        end = new Date(tMid.getTime() + 86400000);   // يوم النهاية محسوب بالكامل
      } else {
        end = new Date(2100, 0, 1);
      }
    }
    return { start: start, end: end, kind: kind };
  }
  function repList(rg){
    var s = rg.start.getTime(), e = rg.end.getTime();
    return expCache.filter(function(r){
      if(!r) return false;
      var ts = Number(r.createdAt) || 0;
      if(!(ts >= s && ts < e)) return false;
      if(repUsersSel && Object.keys(repUsersSel).length > 0){
        if(repUsersSel[r.userId] === false) return false;
      }
      return true;
    });
  }
  function sumBy(list, cur, fn){
    return list.reduce(function(acc, r){
      if(curCode(r.currency) !== cur) return acc;
      return acc + (Number(fn(r)) || 0);
    }, 0);
  }
  function countBy(list, cur, fn){
    return list.filter(function(r){ if(curCode(r.currency) !== cur) return false; return !!fn(r); }).length;
  }

  function renderRepUsersSel(){
    var wrap = $('expRepUsersSel'); if(!wrap) return;
    var users = {};
    expCache.forEach(function(r){ if(r && r.userId) users[r.userId] = r.userName || r.userId; });
    Object.keys(users).forEach(function(uid){ if(!(uid in repUsersSel)) repUsersSel[uid] = true; });
    wrap.innerHTML = Object.keys(users).map(function(uid){
      return '<label class="ex-user-chip"><input type="checkbox" data-uid="' + esc(uid) + '"' +
        (repUsersSel[uid] ? ' checked' : '') + '> ' + esc(users[uid]) + '</label>';
    }).join('') || '<span class="ex-hint">لا يوجد مستخدمون بعد</span>';
    wrap.querySelectorAll('input[type=checkbox]').forEach(function(cb){
      cb.onchange = function(){
        repUsersSel[cb.dataset.uid] = !!cb.checked;
        var n = Object.keys(users).filter(function(uid){ return repUsersSel[uid]; }).length;
        var hint = $('expRepUsersSelHint');
        if(hint) hint.textContent = 'مُحدَّد ' + n + ' من ' + Object.keys(users).length + ' مستخدم';
        renderReports();
      };
    });
    var hint = $('expRepUsersSelHint');
    if(hint){
      var n = Object.keys(users).filter(function(uid){ return repUsersSel[uid]; }).length;
      hint.textContent = 'مُحدَّد ' + n + ' من ' + Object.keys(users).length + ' مستخدم';
    }
  }
  function renderReports(){
    if(!isMgr()){ return; }
    var wrapS = $('expRepSummary'), body = $('expRepBody'), rLbl = $('expRepRangeLbl');
    if(!wrapS || !body) return;
    var rg = periodRange();
    var list = repList(rg).sort(function(a,b){ return (b.createdAt||0) - (a.createdAt||0); });

    // ---- عنوان الفترة (بداية ونهاية واضحة) ----
    var kindNames = {week:'أسبوعي', month:'شهري', year:'سنوي', custom:'مخصص'};
    var dayNames = ['الأحد','الاثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت'];
    var lbl = 'الفترة: من <b>' + dateStr(rg.start.getTime()) + '</b> إلى <b>' +
              dateStr(new Date(rg.end.getTime() - 1).getTime()) + '</b> (' + kindNames[rg.kind] + ')';
    if(rg.kind === 'week'){
      lbl += '<small>بداية الأسبوع حسب إعدادات النظام: ' + dayNames[weekStartDay()] +
             ' — ينتهي قبل ' + dateStr(rg.end.getTime()) + '</small>';
    } else {
      lbl += '<small>يُحتسب على أساس التاريخ الفعلي لكل عملية</small>';
    }
    if(rLbl) rLbl.innerHTML = lbl;

    // ---- الإجماليات لكل عملة (مفصولتان تماماً) ----
    var cards = ['SAR','YER'].map(function(cur){
      var nm = cur === 'YER' ? '🇾🇪 الريال اليمني (ر.ي)' : '🇸🇦 الريال السعودي (ر.س)';
      var cls = cur === 'YER' ? 'exp-sum-head yer' : 'exp-sum-head';
      var totalReq   = sumBy(list, cur, function(r){ return r.amount; });
      var approved   = sumBy(list, cur, function(r){ return (r.status==='approved'||r.status==='partial'||r.status==='received') ? r.amount : 0; });
      var delivered  = sumBy(list, cur, function(r){ return (r.status==='approved'||r.status==='partial'||r.status==='received') ? r.paid : 0; });
      var confirmed  = sumBy(list, cur, function(r){ return r.status==='received' ? r.paid : 0; });
      var unconf     = sumBy(list, cur, function(r){ return (r.status==='approved'||r.status==='partial') ? r.paid : 0; });
      var remaining  = sumBy(list, cur, function(r){ return r.status==='partial' ? Math.max(0, num(r.amount)-num(r.paid)) : 0; });
      var cAll = list.filter(function(r){ return curCode(r.currency)===cur; }).length;
      var cOk  = countBy(list, cur, function(r){ return r.status==='approved'||r.status==='partial'||r.status==='received'; });
      var cRej = countBy(list, cur, function(r){ return r.status==='rejected'; });
      var cPend= countBy(list, cur, function(r){ return r.status==='pending'||r.status==='returned'; });
      var cRec = countBy(list, cur, function(r){ return r.status==='received'; });
      function M(n){ return money(n, cur); }
      return '<div class="exp-sum-card">' +
        '<div class="' + cls + '">' + nm + '</div>' +
        '<div class="exp-sum-rows">' +
          '<div class="exp-sum-row"><span>عدد طلبات المصاريف</span><b>' + cAll + '</b></div>' +
          '<div class="exp-sum-row"><span>المقبولة / المرفوضة / المعلقة</span><b>' + cOk + ' / ' + cRej + ' / ' + cPend + '</b></div>' +
          '<div class="exp-sum-row"><span>التي تم تأكيد استلامها</span><b>' + cRec + '</b></div>' +
          '<div class="exp-sum-row"><span>إجمالي المبالغ المطلوبة</span><b>' + M(totalReq) + '</b></div>' +
          '<div class="exp-sum-row"><span>إجمالي المبالغ المعتمدة للصرف</span><b>' + M(approved) + '</b></div>' +
          '<div class="exp-sum-row"><span>إجمالي المبالغ المسلّمة فعليًا</span><b>' + M(delivered) + '</b></div>' +
          '<div class="exp-sum-row"><span>أكّد المستخدمون استلامها</span><b>' + M(confirmed) + '</b></div>' +
          '<div class="exp-sum-row"><span>معتمدة ولم يُؤكَّد استلامها بعد</span><b>' + M(unconf) + '</b></div>' +
          '<div class="exp-sum-row"><span>المتبقي من الطلبات الجزئية</span><b>' + M(remaining) + '</b></div>' +
          '<div class="exp-sum-row tot"><span>إجمالي النقدي (هذه العملة فقط)</span><b>' + M(delivered) + '</b></div>' +
        '</div>' +
      '</div>';
    }).join('');
    wrapS.innerHTML = cards +
      '<div class="exp-sum-card" style="grid-column:1/-1;background:#fffbe9;border:1px dashed #fcd34d">' +
        '<div style="padding:11px 14px;font-size:13px;color:#92400e;font-weight:800;line-height:1.9">' +
          '⚠️ ملاحظة مالية: الريال السعودي والريال اليمني يُفصلان في كل الإجماليات أعلاه — ' +
          'لا تُجمع العملتان في إجمالي نقدي واحد ولا يُستخدم أي سعر صرف افتراضي.' +
        '</div>' +
      '</div>';

    // ---- الجدول التفصيلي ----
    var empty = $('expRepEmpty');
    if(empty) empty.style.display = list.length ? 'none' : '';
    body.innerHTML = list.map(function(r, i){
      var rem = Math.max(0, num(r.amount) - num(r.paid));
      return '<tr>' +
        '<td>' + (i+1) + '</td>' +
        '<td><b>' + esc(r.userName||r.userId) + '</b></td>' +
        '<td class="exp-amt">' + esc(money(r.amount, r.currency)) + '</td>' +
        '<td>' + curLabel(r.currency) + '</td>' +
        '<td>' + esc(r.reason||'—') + '</td>' +
        '<td>' + esc(r.dateStr||dateStr(r.createdAt)) + '</td>' +
        '<td>' + statusBadge(r.status) + '</td>' +
        '<td class="exp-paid">' + esc(money(r.paid||0, r.currency)) + '</td>' +
        '<td class="exp-rem">' + (rem > 0 ? esc(money(rem, r.currency)) : '—') + '</td>' +
        '<td><button type="button" class="exp-btn det" data-exp-detail="' + esc(r.id) + '">📂 فتح</button></td>' +
      '</tr>';
    }).join('');
    wireRowButtons(body);

    // ---- حسب المستخدم ---- */
    var byUser = {};
    list.forEach(function(r){
      var k = r.userId || 'غير معروف';
      if(!byUser[k]) byUser[k] = { name: r.userName || k, SAR:{n:0,req:0,paid:0}, YER:{n:0,req:0,paid:0} };
      var c = curCode(r.currency);
      byUser[k][c].n++; byUser[k][c].req += num(r.amount); byUser[k][c].paid += num(r.paid);
    });
    var uHtml = Object.keys(byUser).map(function(k){
      var v = byUser[k];
      function side(c, label){
        var s = v[c];
        if(!s.n) return '';
        return '<span>' + label + ': <b>' + s.n + ' طلب</b> — طُلب <b>' + money(s.req, c) + '</b> · سُلِّم <b>' + money(s.paid, c) + '</b></span>';
      }
      var inner = side('SAR','🇸🇦 ر.س') + side('YER','🇾🇪 ر.ي');
      if(!inner) inner = '<span>لا توجد بيانات مالية</span>';
      return '<div class="exp-break-item"><b>' + esc(v.name) + '</b><div class="exp-bk-nums">' + inner + '</div></div>';
    }).join('');
    $('expRepUsers').innerHTML = uHtml || '<div class="exp-empty">لا توجد بيانات</div>';

    // ---- حسب السبب ---- */
    var byReason = {};
    list.forEach(function(r){
      var k = (r.reason || 'بدون سبب').trim();
      if(!byReason[k]) byReason[k] = { n:0, SAR:{req:0,paid:0}, YER:{req:0,paid:0} };
      var c = curCode(r.currency);
      byReason[k].n++; byReason[k][c].req += num(r.amount); byReason[k][c].paid += num(r.paid);
    });
    var rHtml = Object.keys(byReason).map(function(k){
      var v = byReason[k];
      function side(c, label){
        if(!v[c].req && !v[c].paid) return '';
        return '<span>' + label + ': <b>' + money(v[c].req, c) + '</b> · سُلِّم <b>' + money(v[c].paid, c) + '</b></span>';
      }
      var inner = side('SAR','🇸🇦 ر.س') + side('YER','🇾🇪 ر.ي') || '<span>—</span>';
      return '<div class="exp-break-item"><b>' + esc(k) + '</b><div class="exp-bk-nums"><span><b>' + v.n + '</b> طلب</span>' + inner + '</div></div>';
    }).join('');
    $('expRepReasons').innerHTML = rHtml || '<div class="exp-empty">لا توجد بيانات</div>';

    // ---- حسب التاريخ والعملة ---- */
    var byDate = {};
    list.forEach(function(r){
      var k = r.dateStr || dateStr(r.createdAt);
      if(!byDate[k]) byDate[k] = { n:0, SAR:{req:0,paid:0}, YER:{req:0,paid:0} };
      var c = curCode(r.currency);
      byDate[k].n++; byDate[k][c].req += num(r.amount); byDate[k][c].paid += num(r.paid);
    });
    var dHtml = Object.keys(byDate).sort().reverse().map(function(k){
      var v = byDate[k];
      function side(c, label){
        if(!v[c].req && !v[c].paid) return '';
        return '<span>' + label + ': <b>' + money(v[c].req, c) + '</b> · سُلِّم <b>' + money(v[c].paid, c) + '</b></span>';
      }
      var inner = side('SAR','🇸🇦 ر.س') + side('YER','🇾🇪 ر.ي') || '<span>—</span>';
      return '<div class="exp-break-item"><b>' + esc(k) + '</b><div class="exp-bk-nums"><span><b>' + v.n + '</b> طلب</span>' + inner + '</div></div>';
    }).join('');
    $('expRepDates').innerHTML = dHtml || '<div class="exp-empty">لا توجد بيانات</div>';
  }

  // ========== تصدير تقرير PDF ==========
  function buildReportHTML(rg, list){
    var kindNames = {week:'أسبوعي', month:'شهري', year:'سنوي', custom:'مخصص'};
    var dayNames = ['الأحد','الاثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت'];
    var html = '<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8">' +
      '<title>تقرير المصاريف</title>' +
      '<link rel="preconnect" href="https://fonts.googleapis.com">' +
      '<link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;800&display=swap" rel="stylesheet">' +
      '<style>' +
        'body{font-family:"Cairo",Tahoma,Arial,sans-serif;direction:rtl;margin:0;padding:24px;color:#0f172a;font-size:13px;}' +
        'h1{font-size:20px;margin:0 0 4px;color:#1e3a8a;}' +
        '.sub{color:#475569;font-size:12.5px;margin-bottom:14px;}' +
        '.meta{background:#f1f5f9;border-radius:10px;padding:10px 14px;margin-bottom:14px;font-size:12.5px;line-height:1.9;color:#334155;}' +
        '.meta b{color:#0f172a;}' +
        'h2{font-size:15px;margin:16px 0 6px;color:#1e3a8a;}' +
        'table{width:100%;border-collapse:collapse;font-size:12px;margin-top:6px;}' +
        'th,td{border:1px solid #cbd5e1;padding:6px 8px;text-align:right;vertical-align:middle;}' +
        'th{background:#eef2ff;color:#1e3a8a;font-weight:800;}' +
        'tr:nth-child(even){background:#f8fafc;}' +
        '.sum-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:10px;margin-bottom:14px;}' +
        '.sum-card{border:1px solid #cbd5e1;border-radius:10px;padding:10px 12px;}' +
        '.sum-card h3{margin:0 0 6px;font-size:13px;color:#1e3a8a;}' +
        '.sum-row{display:flex;justify-content:space-between;gap:8px;font-size:12.5px;padding:3px 0;border-bottom:1px dashed #eef2f7;}' +
        '.sum-row:last-child{border-bottom:none;}' +
        '.sum-row b{color:#0f172a;}' +
        '.warn{background:#fffbe9;border:1px dashed #fcd34d;border-radius:8px;padding:8px 10px;margin:10px 0;font-size:11.5px;color:#92400e;font-weight:700;}' +
        '@media print{ body{padding:12px;} .no-print{display:none;} @page{size:A4;margin:12mm;} }' +
      '</style></head><body>' +
      '<h1>📊 تقرير المصاريف</h1>' +
      '<div class="sub">حلويات العلامة الزرقاء — نظام Blue Mark</div>' +
      '<div class="meta">' +
        'الفترة: <b>' + dateStr(rg.start.getTime()) + '</b> إلى <b>' + dateStr(new Date(rg.end.getTime()-1).getTime()) + '</b> (' + kindNames[rg.kind] + ')' +
        (rg.kind==='week' ? '<br>بداية الأسبوع: <b>' + dayNames[weekStartDay()] + '</b> (حسب إعدادات النظام)' : '') +
        '<br>تاريخ التصدير: <b>' + fmtWhen(Date.now()) + '</b>' +
        '<br>المستخدمون المُدرَجون: <b>' + (Object.keys(repUsersSel).filter(function(k){return repUsersSel[k];}).length) + '</b> من <b>' + Object.keys(repUsersSel).length + '</b>' +
      '</div>' +
      '<div class="warn">⚠️ ملاحظة مالية: الريال السعودي والريال اليمني مفصولان في كل الإجماليات — لا تُجمع العملتان في إجمالي نقدي واحد ولا يُستخدم أي سعر صرف افتراضي.</div>' +
      '<h2>الإجماليات (حسب العملة)</h2>' +
      '<div class="sum-grid">' + ['SAR','YER'].map(function(cur){
        var nm = cur === 'YER' ? '🇾🇪 الريال اليمني (ر.ي)' : '🇸🇦 الريال السعودي (ر.س)';
        var totalReq = sumBy(list, cur, function(r){ return r.amount; });
        var approved = sumBy(list, cur, function(r){ return (r.status==='approved'||r.status==='partial'||r.status==='received') ? r.amount : 0; });
        var delivered = sumBy(list, cur, function(r){ return (r.status==='approved'||r.status==='partial'||r.status==='received') ? r.paid : 0; });
        var confirmed = sumBy(list, cur, function(r){ return r.status==='received' ? r.paid : 0; });
        var unconf = sumBy(list, cur, function(r){ return (r.status==='approved'||r.status==='partial') ? r.paid : 0; });
        var remaining = sumBy(list, cur, function(r){ return r.status==='partial' ? Math.max(0, num(r.amount)-num(r.paid)) : 0; });
        var cAll = list.filter(function(r){ return curCode(r.currency)===cur; }).length;
        var cOk = countBy(list, cur, function(r){ return r.status==='approved'||r.status==='partial'||r.status==='received'; });
        var cRej = countBy(list, cur, function(r){ return r.status==='rejected'; });
        var cPend = countBy(list, cur, function(r){ return r.status==='pending'||r.status==='returned'; });
        var cRec = countBy(list, cur, function(r){ return r.status==='received'; });
        return '<div class="sum-card"><h3>' + nm + '</h3>' +
          '<div class="sum-row"><span>عدد طلبات المصاريف</span><b>' + cAll + '</b></div>' +
          '<div class="sum-row"><span>المقبولة / المرفوضة / المعلقة</span><b>' + cOk + ' / ' + cRej + ' / ' + cPend + '</b></div>' +
          '<div class="sum-row"><span>التي تم تأكيد استلامها</span><b>' + cRec + '</b></div>' +
          '<div class="sum-row"><span>إجمالي المبالغ المطلوبة</span><b>' + money(totalReq, cur) + '</b></div>' +
          '<div class="sum-row"><span>إجمالي المبالغ المعتمدة للصرف</span><b>' + money(approved, cur) + '</b></div>' +
          '<div class="sum-row"><span>إجمالي المبالغ المسلّمة فعليًا</span><b>' + money(delivered, cur) + '</b></div>' +
          '<div class="sum-row"><span>أكّد المستخدمون استلامها</span><b>' + money(confirmed, cur) + '</b></div>' +
          '<div class="sum-row"><span>معتمدة ولم يُؤكَّد استلامها بعد</span><b>' + money(unconf, cur) + '</b></div>' +
          '<div class="sum-row"><span>المتبقي من الطلبات الجزئية</span><b>' + money(remaining, cur) + '</b></div>' +
        '</div>';
      }).join('') + '</div>' +
      '<h2>تفاصيل طلبات الفترة</h2>' +
      '<table><thead><tr><th>#</th><th>المستخدم</th><th>المبلغ المطلوب</th><th>العملة</th><th>السبب</th><th>التاريخ</th><th>الحالة</th><th>المُسلَّم</th><th>المتبقي</th></tr></thead><tbody>' +
      list.map(function(r, i){
        var rem = Math.max(0, num(r.amount)-num(r.paid));
        return '<tr><td>' + (i+1) + '</td><td>' + esc(r.userName||r.userId) + '</td><td>' + esc(money(r.amount,r.currency)) +
          '</td><td>' + (r.currency==='YER'?'ر.ي':'ر.س') + '</td><td>' + esc(r.reason||'—') + '</td><td>' + esc(r.dateStr||dateStr(r.createdAt)) +
          '</td><td>' + esc(statusLabel(r.status)) + '</td><td>' + esc(money(r.paid||0,r.currency)) + '</td><td>' + (rem>0?esc(money(rem,r.currency)):'—') + '</td></tr>';
      }).join('') +
      '</tbody></table>' +
      (list.length===0 ? '<p style="text-align:center;color:#94a3b8;padding:14px;">لا توجد طلبات في هذه الفترة</p>' : '') +
      '<script>window.onload=function(){window.print();}<\/script>' +
      '</body></html>';
    return html;
  }
  function exportReportPDF(){
    var rg = periodRange();
    var list = repList(rg);
    if(!list.length){ toast('لا توجد طلبات في هذه الفترة'); return; }
    var selCount = Object.keys(repUsersSel).filter(function(k){ return repUsersSel[k]; }).length;
    if(selCount === 0){ toast('حدد مستخدماً واحداً على الأقل'); return; }
    var html = buildReportHTML(rg, list);
    var iframe = document.createElement('iframe');
    iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden;';
    document.body.appendChild(iframe);
    var doc = iframe.contentWindow.document;
    doc.open(); doc.write(html); doc.close();
    window.__expReportHTML = html;
    setTimeout(function(){ try{ document.body.removeChild(iframe); }catch(e){} }, 60000);
  }
  // ---------- التحديث التلقائي للفترات ----------
  function syncCustomVisibility(){
    var v = ($('expRepRange') && $('expRepRange').value) || 'week';
    var on = (v === 'custom');
    if($('expRepCustomWrap')) $('expRepCustomWrap').style.display = on ? '' : 'none';
    if($('expRepCustomWrap2')) $('expRepCustomWrap2').style.display = on ? '' : 'none';
  }
  function saveWeekStart(v){
    try{ localStorage.setItem('exp_week_start', String(v)); }catch(e){}
    // حفظ في إعدادات النظام (جلب إعدادات حديثة أولاً لتفادي أي كتابة متزامنة)
    try{
      if(window.DB && DB.getSettings && DB.saveSettings){
        DB.getSettings().then(function(cfg){
          cfg.weekStartDay = v;
          return DB.saveSettings(cfg);
        }).catch(function(){});
      }
    }catch(e){}
  }

  function renderAll(){
    renderNotices();
    renderTable();
    renderBadge();
    renderRepUsersSel();
    renderReports();
  }

  function afterLogin(){
    try{ renderAll(); }catch(e){ console.warn('render expenses:', e); }
  }

  // ---------- إنشاء نوافذ الإجراءات إن لم تكن موجودة (للاستخدام داخل index.html) ----------
  function ensureModals(){
    if($('expApproveModal')) return;
    var html = '' +
      '<div class="modal" id="expApproveModal" style="z-index:9000"><div class="modal-box"><div class="modal-head">' +
        '<h3>✅ قبول طلب المصروف</h3><button class="close-btn" id="closeExpApprove">✕</button></div>' +
        '<form id="expApproveForm"><div class="exp-mrec" id="expApproveRec"></div>' +
        '<label>المبلغ الذي سيُسلَّم فعليًا<input type="text" id="expApproveAmount" inputmode="decimal" autocomplete="off" placeholder="0.00" required /></label>' +
        '<small class="exp-hint" id="expApproveHint">أدخل كاملاً أو جزئياً — العملة مثبّتة كما في طلب المستخدم</small>' +
        '<div class="exp-approve-preview" id="expApprovePreview"></div>' +
        '<div class="exp-err" id="expApproveErr"></div>' +
        '<button type="submit" class="exp-btn-block">✔ تأكيد الصرف</button></form></div></div>' +
      '<div class="modal" id="expRejectModal" style="z-index:9000"><div class="modal-box"><div class="modal-head">' +
        '<h3>❌ رفض طلب المصروف</h3><button class="close-btn" id="closeExpReject">✕</button></div>' +
        '<form id="expRejectForm"><div class="exp-mrec" id="expRejectRec"></div>' +
        '<label>سبب الرفض<textarea id="expRejectReason" maxlength="300" placeholder="اكتب سبب الرفض ليصل للمستخدم..." required></textarea></label>' +
        '<div class="exp-err" id="expRejectErr"></div>' +
        '<button type="submit" class="exp-btn-block">✔ تأكيد الرفض</button></form></div></div>' +
      '<div class="modal" id="expReturnModal" style="z-index:9000"><div class="modal-box"><div class="modal-head">' +
        '<h3>↩️ إعادة الطلب للمراجعة</h3><button class="close-btn" id="closeExpReturn">✕</button></div>' +
        '<form id="expReturnForm"><div class="exp-mrec" id="expReturnRec"></div>' +
        '<label>ملاحظة توضح المطلوب تعديله (اختياري)<textarea id="expReturnNote" maxlength="300" placeholder="مثال: قلّل المبلغ أو أضف تفاصيل أكثر..."></textarea></label>' +
        '<div class="exp-err" id="expReturnErr"></div>' +
        '<button type="submit" class="exp-btn-block">↩ إعادة للمراجعة</button></form></div></div>' +
      '<div class="modal" id="expDetailModal" style="z-index:9000"><div class="modal-box" style="max-width:640px"><div class="modal-head">' +
        '<h3>📂 تفاصيل طلب المصروف وسجل مراحله</h3><button class="close-btn" id="closeExpDetail">✕</button></div>' +
        '<div id="expDetailBody" class="exp-detail-body"></div></div></div>';
    var w = document.createElement('div');
    w.innerHTML = html;
    while(w.firstChild) document.body.appendChild(w.firstChild);
  }

  // ---------- التشغيل ----------
  function init(){
    ensureModals();
    wireModals();
    wireModals();

    // مرشحات إدارة المصاريف — تحديث فوري
    ['expSearch','expStatus','expCur','expFrom','expTo'].forEach(function(id){
      var el = $(id);
      if(el){
        el.addEventListener('input', renderTable);
        el.addEventListener('change', renderTable);
      }
    });
    var cb = $('expClearFilters');
    if(cb) cb.onclick = function(){
      if($('expSearch')) $('expSearch').value = '';
      if($('expStatus')) $('expStatus').value = '';
      if($('expCur')) $('expCur').value = '';
      if($('expFrom')) $('expFrom').value = '';
      if($('expTo')) $('expTo').value = '';
      renderTable();
    };
    var rb = $('expRefreshBtn');
    if(rb) rb.onclick = function(){
      DB.getExpenses().then(function(l){ expCache = l || []; renderAll(); toast('تم التحديث ✓'); })
        .catch(function(){ toast('تعذر التحديث'); });
    };

    // تقارير: تحديث تلقائي فور اختيار الفترة
    ['expRepRange','expRepFrom','expRepTo'].forEach(function(id){
      var el = $(id);
      if(el){
        el.addEventListener('change', function(){ syncCustomVisibility(); renderReports(); });
        el.addEventListener('input', function(){ syncCustomVisibility(); renderReports(); });
      }
    });
    var ws = $('expRepWeekStart');
    if(ws){
      ws.value = String(weekStartDay());
      ws.addEventListener('change', function(){
        var v = parseInt(ws.value, 10);
        if(isNaN(v) || v < 0 || v > 6) v = 6;
        saveWeekStart(v);
        renderReports();
        toast('تم حفظ بداية الأسبوع في إعدادات النظام ✓');
      });
    }
    syncCustomVisibility();

    var ua = $('expUsersAll'); if(ua) ua.onclick = function(){
      Object.keys(repUsersSel).forEach(function(k){ repUsersSel[k] = true; });
      renderRepUsersSel(); renderReports();
    };
    var un = $('expUsersNone'); if(un) un.onclick = function(){
      Object.keys(repUsersSel).forEach(function(k){ repUsersSel[k] = false; });
      renderRepUsersSel(); renderReports();
    };
    var pb = $('expRepPdfBtn'); if(pb) pb.onclick = exportReportPDF;

    // إعادة الرسم عند فتح أي من التبويبين
    ['expenses','expreports'].forEach(function(tab){
      var link = document.querySelector('.side-link[data-tab="' + tab + '"]');
      if(link) link.addEventListener('click', function(){ setTimeout(renderAll, 0); });
    });

    // الاشتراك الحي (مزامنة فورية بين الأجهزة)
    try{
      DB.onExpenses(function(list){
        expCache = Array.isArray(list) ? list : [];
        renderAll();
      });
    }catch(e){ console.warn('اشتراك المصاريف (إدارة):', e); }

    // إذا كانت الجلسة مفتوحة بالفعل (فُتح التبويب قبل تحميل هذا الملف)
    afterLogin();
    // بعد تسجيل الدخول لاحقاً
    try{
      if(typeof showDash === 'function' && !window.__expShowDashWrapped){
        window.__expShowDashWrapped = true;
        var orig = showDash;
        showDash = function(){ var r = orig.apply(this, arguments); setTimeout(afterLogin, 60); return r; };
      }
    }catch(e){}
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  window.ExpensesAdmin = { refresh: renderAll, buildReportHTML: buildReportHTML, exportReportPDF: exportReportPDF, periodRange: periodRange, repList: repList };
})();
