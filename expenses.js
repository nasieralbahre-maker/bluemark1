// ============================================================
//  expenses.js — ميزة «مصاريفي» (واجهة المستخدم)
//  - زر 💰 مصاريفي بجانب زر «تبديل» يفتح نافذة طلبات المصروفات
//  - تقديم طلب مبلغ (ر.س / ر.ي) + عرض الطلبات السابقة وحالتها
//  - إشعارات المصاريف + تأكيد الاستلام من المستخدم نفسه
//  البيانات تُحفظ عبر DB (Firestore settings/expenses أو localStorage)
// ============================================================
(function(){
  'use strict';

  function $(id){ return document.getElementById(id); }
  function esc(s){ return String(s==null?'':s).replace(/[&<>"']/g, function(c){
    return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
  function toast(m){ try{ if(typeof showToast==='function'){ showToast(m); return; } }catch(e){} alert(m); }
  function me(){ try{ return (typeof currentPosUser!=='undefined' && currentPosUser) ? currentPosUser : null; }catch(e){ return null; } }
function isMgr(){ var u = me(); if(u && u.role === 'مدير') return true; try{ if(typeof isManagerUser === 'function' && isManagerUser()) return true; }catch(e){} return false; }
  function money(n, cur){
    try{ if(window.DB && DB.fmtExpMoney) return DB.fmtExpMoney(n, cur); }catch(e){}
    return (Number(n)||0).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2}) + ' ' + (cur==='YER'?'ر.ي':'ر.س');
  }
  function statusLabel(s){
    try{ if(DB.EXP_STATUS_LABEL && DB.EXP_STATUS_LABEL[s]) return DB.EXP_STATUS_LABEL[s]; }catch(e){}
    return s || '—';
  }
  function statusBadge(s){
    var cls = {pending:'pend', returned:'ret', approved:'ok', partial:'part', received:'done', rejected:'rej'}[s] || 'pend';
    return '<span class="ex-badge ex-' + cls + '">' + esc(statusLabel(s)) + '</span>';
  }
  function curFlag(c){ return c === 'YER' ? '🇾🇪' : '🇸🇦'; }
  function curName(c){ return c === 'YER' ? 'ريال يمني (ر.ي)' : 'ريال سعودي (ر.س)'; }
  function fmtWhen(ts){
    if(!ts) return '—';
    var d = new Date(ts);
    var p = function(n){ return String(n).padStart(2,'0'); };
    return d.getFullYear()+'-'+p(d.getMonth()+1)+'-'+p(d.getDate()) + ' · ' + p(d.getHours())+':'+p(d.getMinutes());
  }

  // ---------- CSS مُحقَن (متوافق مع تصميم النظام) ----------
  var CSS = '' +
  '.exm-modal{position:fixed;inset:0;z-index:8500;display:none;align-items:center;justify-content:center;' +
'.exm-modal.exm-wide .exm-box{width:min(880px,100%);}' +
    'background:rgba(15,23,42,.55);backdrop-filter:blur(3px);padding:16px;font-family:"Cairo",system-ui,sans-serif;direction:rtl;}' +
  '.exm-modal.show{display:flex;}' +
  '.exm-box{width:min(600px,100%);max-height:92dvh;display:flex;flex-direction:column;overflow:hidden;' +
    'background:#fff;border-radius:20px;box-shadow:0 30px 70px -20px rgba(0,0,0,.55);animation:exIn .25s ease both;}' +
  '@keyframes exIn{from{opacity:0;transform:translateY(14px) scale(.98);}to{opacity:1;transform:none;}}' +
  '.exm-head{flex:none;display:flex;align-items:center;gap:10px;padding:14px 16px;color:#fff;' +
    'background:linear-gradient(120deg,#1e3a8a,#2563eb);}' +
  '.exm-head h3{margin:0;font-size:16.5px;font-weight:800;flex:none;}' +
  '.exm-tabs{display:flex;gap:7px;flex:1;min-width:0;overflow-x:auto;scrollbar-width:none;}' +
  '.exm-tabs::-webkit-scrollbar{display:none;}' +
  '.exm-tab{flex:none;border:none;border-radius:11px;padding:8px 13px;cursor:pointer;font-family:inherit;' +
    'font-size:13.5px;font-weight:800;color:#dbeafe;background:rgba(255,255,255,.14);transition:background .15s,color .15s;position:relative;}' +
  '.exm-tab:hover{background:rgba(255,255,255,.26);color:#fff;}' +
  '.exm-tab.active{background:#fff;color:#1e3a8a;}' +
  '.exm-tab-badge{display:none;min-width:18px;padding:0 5px;margin-inline-start:5px;background:#ef4444;color:#fff;' +
    'font-size:11px;font-weight:800;border-radius:99px;text-align:center;}' +
  '.exm-tab-badge.on{display:inline-block;}' +
  '.exm-x{flex:none;border:none;background:rgba(255,255,255,.2);color:#fff;width:32px;height:32px;border-radius:10px;' +
    'cursor:pointer;font-size:15px;line-height:1;}' +
  '.exm-x:hover{background:rgba(255,255,255,.35);}' +
  '.exm-body{flex:1;min-height:0;overflow-y:auto;-webkit-overflow-scrolling:touch;padding:14px 16px 18px;background:#f8fafc;}' +
  '.exm-pane{display:none;}' +
  '.exm-pane.show{display:block;}' +
  '.exm-newbtn{width:100%;margin-bottom:12px;border:none;border-radius:14px;padding:13px;cursor:pointer;color:#fff;' +
    'font-family:inherit;font-size:15px;font-weight:800;background:linear-gradient(135deg,#16a34a,#22c55e);' +
    'box-shadow:0 10px 22px -10px rgba(22,163,74,.75);transition:transform .15s;}' +
  '.exm-newbtn:active{transform:scale(.98);}' +
  '.exm-back{margin-bottom:12px;border:2px solid #e2e8f0;background:#fff;color:#334155;border-radius:12px;' +
    'padding:9px 14px;cursor:pointer;font-family:inherit;font-size:13.5px;font-weight:800;}' +
  '.exm-back:hover{background:#f1f5f9;}' +
  '.ex-card{background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:13px 14px;margin-bottom:11px;' +
    'box-shadow:0 4px 14px -10px rgba(15,23,42,.4);}' +
  '.ex-card-top{display:flex;align-items:center;justify-content:space-between;gap:9px;flex-wrap:wrap;}' +
  '.ex-amount{font-size:18px;font-weight:900;color:#1e3a8a;direction:rtl;}' +
  '.ex-amount .ex-cur{font-size:12.5px;font-weight:800;color:#64748b;margin-inline-start:4px;}' +
  '.ex-badge{display:inline-block;padding:4px 11px;border-radius:99px;font-size:12px;font-weight:800;white-space:nowrap;}' +
  '.ex-pend{background:#fef3c7;color:#92400e;}' + '.ex-ret{background:#e0e7ff;color:#3730a3;}' +
  '.ex-ok{background:#dbeafe;color:#1e40af;}' + '.ex-part{background:#ffedd5;color:#9a3412;}' +
  '.ex-done{background:#d1fae5;color:#065f46;}' + '.ex-rej{background:#fee2e2;color:#991b1b;}' +
  '.ex-meta{margin-top:8px;font-size:13px;color:#475569;line-height:1.9;}' +
  '.ex-meta b{color:#0f172a;}' +
  '.ex-split{display:flex;gap:8px;flex-wrap:wrap;margin-top:9px;}' +
  '.ex-chip{flex:1;min-width:130px;background:#f8fafc;border:1px dashed #cbd5e1;border-radius:11px;padding:7px 10px;' +
    'font-size:12.5px;color:#334155;text-align:center;}' +
  '.ex-chip b{display:block;font-size:14.5px;color:#0f172a;margin-top:2px;}' +
  '.ex-chip.rem b{color:#b45309;}' + '.ex-chip.got b{color:#047857;}' +
  '.ex-note{margin-top:9px;background:#fff7ed;border:1px solid #fed7aa;border-radius:11px;padding:8px 11px;' +
    'font-size:13px;color:#9a3412;line-height:1.8;}' +
  '.ex-note.rej{background:#fef2f2;border-color:#fecaca;color:#991b1b;}' +
  '.ex-acts{margin-top:11px;display:flex;gap:8px;flex-wrap:wrap;}' +
  '.ex-confirm{flex:1;min-width:210px;border:none;border-radius:13px;padding:12px;cursor:pointer;color:#fff;' +
    'font-family:inherit;font-size:14.5px;font-weight:800;background:linear-gradient(135deg,#059669,#10b981);' +
    'box-shadow:0 8px 18px -9px rgba(16,185,129,.8);transition:transform .15s;}' +
  '.ex-confirm:active{transform:scale(.98);}' +
  '.ex-confirm[disabled]{background:#94a3b8;box-shadow:none;cursor:not-allowed;}' +
  '.ex-log{margin-top:10px;border-top:1px dashed #e2e8f0;padding-top:8px;}' +
  '.ex-log-h{font-size:12.5px;font-weight:800;color:#64748b;margin-bottom:5px;cursor:pointer;user-select:none;}' +
  '.ex-log-h:hover{color:#2563eb;}' +
  '.ex-log-list{display:none;list-style:none;margin:0;padding:0;}' +
  '.ex-log.open .ex-log-list{display:block;}' +
  '.ex-log-list li{font-size:12.5px;color:#475569;background:#f8fafc;border-radius:9px;padding:6px 9px;margin-bottom:5px;' +
    'border:1px solid #eef2f7;line-height:1.7;}' +
  '.ex-empty{text-align:center;color:#94a3b8;font-size:13.5px;padding:34px 12px;background:#fff;' +
    'border:1px dashed #cbd5e1;border-radius:14px;}' +
  /* النموذج */ '.ex-form{background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:14px;}' +
  '.ex-f{display:flex;flex-direction:column;gap:6px;margin-bottom:13px;}' +
  '.ex-f label{font-size:13.5px;font-weight:800;color:#334155;}' +
  '.ex-f input,.ex-f textarea,.ex-f select{background:#f8fafc;border:2px solid #e2e8f0;border-radius:12px;' +
    'padding:11px 13px;font-family:inherit;font-size:15px;color:#0f172a;outline:none;transition:border-color .15s,box-shadow .15s;}' +
  '.ex-f input:focus,.ex-f textarea:focus{border-color:#2563eb;box-shadow:0 0 0 3px rgba(37,99,235,.14);background:#fff;}' +
  '.ex-f input[readonly]{background:#f1f5f9;color:#64748b;cursor:not-allowed;}' +
  '.ex-f textarea{min-height:74px;resize:vertical;line-height:1.8;}' +
  '.ex-f .ex-hint{font-size:12px;color:#94a3b8;font-weight:600;}' +
  '.ex-amount-row{position:relative;}' +
  '.ex-amount-row input{width:100%;font-size:19px;font-weight:900;letter-spacing:.5px;direction:rtl;text-align:right;}' +
  '.ex-cur-row{display:flex;gap:10px;}' +
  '.ex-cur-btn{flex:1;border:2px solid #e2e8f0;background:#f8fafc;border-radius:13px;padding:12px 8px;cursor:pointer;' +
    'font-family:inherit;font-size:14.5px;font-weight:800;color:#334155;transition:all .15s;}' +
  '.ex-cur-btn:hover{background:#eef2f7;}' +
  '.ex-cur-btn.active{border-color:#2563eb;background:#eff6ff;color:#1e3a8a;box-shadow:0 6px 14px -8px rgba(37,99,235,.6);}' +
  '.ex-err{color:#b91c1c;font-size:13px;font-weight:700;min-height:17px;text-align:center;}' +
  '.ex-send{width:100%;border:none;border-radius:14px;padding:14px;cursor:pointer;color:#fff;font-family:inherit;' +
    'font-size:15.5px;font-weight:800;background:linear-gradient(135deg,#1e3a8a,#2563eb);' +
    'box-shadow:0 10px 22px -10px rgba(37,99,235,.8);transition:transform .15s;}' +
  '.ex-send:active{transform:scale(.98);}' +
  '.ex-send[disabled]{opacity:.65;cursor:wait;}' +
  /* إشعارات المصاريف */ '.ex-n{background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:13px 14px;margin-bottom:11px;' +
    'border-inline-start:5px solid #2563eb;box-shadow:0 4px 14px -10px rgba(15,23,42,.4);}' +
  '.ex-n.rej{border-inline-start-color:#dc2626;}' + '.ex-n.ret{border-inline-start-color:#6366f1;}' +
  '.ex-n.wait{border-inline-start-color:#f59e0b;}' + '.ex-n.done{border-inline-start-color:#10b981;}' +
  '.ex-n-title{font-size:14.5px;font-weight:900;color:#0f172a;margin-bottom:5px;}' +
  '.ex-n-body{font-size:13.5px;color:#475569;line-height:2;}' +
  '.ex-n-body b{color:#0f172a;}' +
  '.ex-n-time{font-size:11.5px;color:#94a3b8;margin-top:5px;}' +
  '.exm-btn-badge{display:none;min-width:17px;padding:0 4px;margin-inline-start:5px;background:#ef4444;color:#fff;' +
    'font-size:11px;font-weight:800;border-radius:99px;line-height:17px;text-align:center;}' +
  '.exm-btn-badge.on{display:inline-block;}' +
  '@media(max-width:520px){ .exm-head{flex-wrap:wrap;} .exm-head h3{width:100%;text-align:center;} ' +
    '.exm-tabs{width:100%;justify-content:center;} .ex-amount{font-size:16.5px;} }' +
/* ==== إضافة: منطقة إدارة المصاريف داخل إشعارات المصاريف (للمدير) ==== */ +
'.ex-admin-sep{margin:16px 0 6px;border-top:2px dashed #cbd5e1;}' +
'.ex-sec-title{margin:14px 0 10px;font-size:15.5px;font-weight:900;color:#1e3a8a;display:flex;align-items:center;gap:8px;}' +
'.ex-sec-title:first-child{margin-top:0;}' +
'.exp-table-wrap{overflow-x:auto;border:1px solid #e2e8f0;border-radius:14px;background:#fff;}' +
'.exp-table-wrap .data-table{width:100%;border-collapse:collapse;font-size:12.5px;min-width:640px;}' +
'.exp-table-wrap .data-table thead th{background:#f1f5f9;color:#334155;font-size:11.5px;font-weight:800;padding:8px 9px;border-bottom:2px solid #e2e8f0;text-align:right;white-space:nowrap;}' +
'.exp-table-wrap .data-table tbody td{padding:8px 9px;border-bottom:1px solid #eef2f7;font-size:12.5px;color:#334155;vertical-align:middle;}' +
'.exp-table-wrap .data-table tbody tr:hover{background:#f8fafc;}' +
'.ex-rep-users{background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:10px 12px;margin-bottom:10px;}' +
'.ex-rep-users-head{display:flex;align-items:center;gap:8px;flex-wrap:wrap;font-size:13px;font-weight:800;color:#334155;margin-bottom:8px;}' +
'.ex-rep-users-list{display:flex;flex-wrap:wrap;gap:7px;}' +
'.ex-user-chip{display:inline-flex;align-items:center;gap:6px;background:#f8fafc;border:1.5px solid #e2e8f0;border-radius:99px;padding:6px 11px;font-size:12.5px;font-weight:800;color:#334155;cursor:pointer;transition:all .15s;}' +
'.ex-user-chip:has(input:checked){border-color:#2563eb;background:#eff6ff;color:#1e3a8a;}' +
'.ex-user-chip input{accent-color:#2563eb;cursor:pointer;}' +
'.ex-pdf-btn{border:none;border-radius:13px;padding:12px 18px;cursor:pointer;color:#fff;font-family:inherit;font-size:14.5px;font-weight:800;background:linear-gradient(135deg,#dc2626,#f43f5e);box-shadow:0 8px 18px -9px rgba(244,63,94,.8);transition:transform .15s;margin:6px 0 10px;}' +
'.ex-pdf-btn:active{transform:scale(.98);}';
  (function injectCSS(){
    var s = document.createElement('style');
    s.id = 'expensesStyle';
    s.textContent = CSS;
    document.head.appendChild(s);
  })();

  // ---------- بناء النافذة ----------
  var modal = document.createElement('div');
  modal.className = 'exm-modal';
  modal.id = 'exModal';
  modal.innerHTML = '' +
  '<div class="exm-box">' +
    '<div class="exm-head">' +
      '<h3>💰 مصاريفي</h3>' +
      '<div class="exm-tabs">' +
        '<button type="button" class="exm-tab active" data-expane="list">📋 طلباتي</button>' +
        '<button type="button" class="exm-tab" data-expane="notif">🔔 إشعارات المصاريف<span class="exm-tab-badge" id="exNotifBadge">0</span></button>' +
      '</div>' +
      '<button type="button" class="exm-x" id="exClose" aria-label="إغلاق">✕</button>' +
    '</div>' +
    '<div class="exm-body">' +

      '<div class="exm-pane show" id="exPaneList">' +
        '<button type="button" class="exm-newbtn" id="exNewBtn">➕ طلب مبلغ جديد</button>' +
        '<div id="exList"></div>' +
      '</div>' +

      '<div class="exm-pane" id="exPaneForm">' +
        '<button type="button" class="exm-back" id="exBackBtn">→ رجوع إلى طلباتي</button>' +
        '<form class="ex-form" id="exForm" novalidate>' +
          '<div class="ex-f">' +
            '<label for="exAmount">المبلغ المطلوب</label>' +
            '<div class="ex-amount-row"><input type="text" id="exAmount" inputmode="decimal" autocomplete="off" placeholder="0.00" /></div>' +
            '<span class="ex-hint">أرقام فقط — تُقبل الصحيحة والعشرية (مثال: 1500 أو 1500.50)</span>' +
          '</div>' +
          '<div class="ex-f">' +
            '<label>العملة</label>' +
            '<div class="ex-cur-row" id="exCurRow">' +
              '<button type="button" class="ex-cur-btn" data-cur="SAR">🇸🇦 ريال سعودي (ر.س)</button>' +
              '<button type="button" class="ex-cur-btn active" data-cur="YER">🇾🇪 ريال يمني (ر.ي)</button>' +
            '</div>' +
            '<span class="ex-hint">كل عملة تُسجَّل وتُحسب بشكل مستقل — لا يوجد تحويل بين العملتين</span>' +
          '</div>' +
          '<div class="ex-f">' +
            '<label for="exReason">سبب طلب المبلغ</label>' +
            '<textarea id="exReason" maxlength="300" placeholder="اكتب سبب المصروف بوضوح..."></textarea>' +
          '</div>' +
          '<div class="ex-f">' +
            '<label for="exDate">تاريخ الطلب (تلقائي)</label>' +
            '<input type="text" id="exDate" readonly value="" />' +
          '</div>' +
          '<div class="ex-f">' +
            '<label for="exBy">مقدم الطلب (تلقائي من حسابك)</label>' +
            '<input type="text" id="exBy" readonly value="" />' +
            '<span class="ex-hint">لا يمكن تغيير هوية مقدم الطلب يدوياً</span>' +
          '</div>' +
          '<div class="ex-f">' +
            '<label for="exNote">ملاحظات إضافية (اختياري)</label>' +
            '<textarea id="exNote" maxlength="400" placeholder="أي تفاصيل إضافية..."></textarea>' +
          '</div>' +
          '<div class="ex-err" id="exErr"></div>' +
          '<button type="submit" class="ex-send" id="exSendBtn">📤 إرسال طلب المصروف</button>' +
        '</form>' +
      '</div>' +

      '<div class="exm-pane" id="exPaneNotif">' +
        '<div id="exNotifList"></div>' +
        '<div id="exAdminArea" style="display:none">' +
          '<div class="ex-admin-sep"></div>' +
          '<h4 class="ex-sec-title">💰 إدارة المصاريف <span style="font-size:11.5px;color:#94a3b8;font-weight:700">(للمدير فقط)</span></h4>' +
          '<div id="expNotices"></div>' +
          '<div class="exp-toolbar">' +
            '<input type="search" id="expSearch" placeholder="🔍 بحث باسم المستخدم / السبب / رقم الطلب" />' +
            '<select id="expStatus">' +
              '<option value="">كل الحالات</option><option value="pending">بانتظار المراجعة</option>' +
              '<option value="approved">معتمد للصرف</option><option value="partial">تم التسليم جزئيًا</option>' +
              '<option value="received">تم تأكيد الاستلام</option><option value="rejected">مرفوض</option>' +
              '<option value="returned">أعيد للمراجعة</option></select>' +
            '<select id="expCur"><option value="">كل العملات</option><option value="SAR">🇸🇦 ر.س</option><option value="YER">🇾🇪 ر.ي</option></select>' +
            '<label class="exp-date-lbl">من <input type="date" id="expFrom" /></label>' +
            '<label class="exp-date-lbl">إلى <input type="date" id="expTo" /></label>' +
            '<button type="button" class="exp-btn det" id="expClearFilters">✕ مسح التصفية</button>' +
          '</div>' +
          '<div class="exp-table-wrap"><table class="data-table" id="expTable"><thead><tr>' +
            '<th>مقدم الطلب</th><th>المبلغ المطلوب</th><th>العملة</th><th>السبب</th><th>التاريخ والوقت</th>' +
            '<th>الحالة</th><th>المُسلَّم</th><th>المتبقي</th><th>ملاحظات</th><th>إجراءات</th></tr></thead><tbody id="expBody"></tbody></table></div>' +
          '<div id="expEmpty" class="exp-empty" style="display:none">لا توجد طلبات مصاريف مطابقة</div>' +
          '<h4 class="ex-sec-title" style="margin-top:16px">📊 تقارير المصاريف</h4>' +
          '<p class="ex-hint">يُحدَّث التقرير تلقائياً عند اختيار الفترة. فصل الريال السعودي عن الريال اليمني في كل الإجماليات. اختر المستخدمين الذين تريد ظهورهم في التقرير ثم اضغط «تصدير تقرير PDF».</p>' +
          '<div class="exp-toolbar">' +
            '<select id="expRepRange"><option value="week">أسبوعي</option><option value="month">شهري</option><option value="year">سنوي</option><option value="custom">مخصص</option></select>' +
            '<label class="exp-date-lbl" id="expRepCustomWrap" style="display:none">من <input type="date" id="expRepFrom" /></label>' +
            '<label class="exp-date-lbl" id="expRepCustomWrap2" style="display:none">إلى <input type="date" id="expRepTo" /></label>' +
            '<label class="exp-date-lbl">بداية الأسبوع <select id="expRepWeekStart" class="exp-inline-select"><option value="0">الأحد</option><option value="1">الاثنين</option><option value="2">الثلاثاء</option><option value="3">الأربعاء</option><option value="4">الخميس</option><option value="5">الجمعة</option><option value="6">السبت</option></select></label>' +
          '</div>' +
          '<div class="exp-range-box" id="expRepRangeLbl">—</div>' +
          '<div class="ex-rep-users">' +
            '<div class="ex-rep-users-head">👥 المستخدمون المُدرَجون في التقرير:' +
              '<button type="button" class="exp-btn det" id="expUsersAll">تحديد الكل</button>' +
              '<button type="button" class="exp-btn det" id="expUsersNone">إلغاء الكل</button>' +
            '</div>' +
            '<div class="ex-rep-users-list" id="expRepUsersSel"></div>' +
            '<div id="expRepUsersSelHint" style="font-size:12px;color:#94a3b8;font-weight:700;margin-top:6px"></div>' +
          '</div>' +
          '<button type="button" class="exp-pdf-btn" id="expRepPdfBtn">📄 تصدير تقرير PDF</button>' +
          '<div id="expRepSummary" class="exp-sum-grid" style="margin-top:14px"></div>' +
          '<div class="exp-table-wrap"><table class="data-table" id="expRepTable"><thead><tr>' +
            '<th>#</th><th>المستخدم</th><th>المبلغ المطلوب</th><th>العملة</th><th>السبب</th><th>التاريخ</th>' +
            '<th>الحالة</th><th>المُسلَّم</th><th>المتبقي</th><th>التفاصيل</th></tr></thead><tbody id="expRepBody"></tbody></table></div>' +
          '<div id="expRepEmpty" class="exp-empty" style="display:none">لا توجد طلبات في هذه الفترة</div>' +
          '<div class="exp-breakdowns" style="margin-top:12px">' +
            '<div class="panel-like"><div class="panel-like-head"><h3>👤 حسب المستخدم</h3></div><div id="expRepUsers" class="exp-break-list"></div></div>' +
            '<div class="panel-like"><div class="panel-like-head"><h3>📝 حسب السبب</h3></div><div id="expRepReasons" class="exp-break-list"></div></div>' +
            '<div class="panel-like"><div class="panel-like-head"><h3>📅 حسب التاريخ والعملة</h3></div><div id="expRepDates" class="exp-break-list"></div></div>' +
          '</div>' +
        '</div>' +
      '</div>' +

    '</div>' +
  '</div>';
  document.body.appendChild(modal);

  // ---------- الحالة ----------
  var expAll = [];          // آخر نسخة مستلمة
  var curPane = 'list';
  var curCur = 'YER';
  var sending = false;

  function open(){ modal.classList.add('show'); updateAdminArea(); renderAll(); }
  function close(){ modal.classList.remove('show'); }
  function showPane(name){
    curPane = name;
    ['list','form','notif'].forEach(function(p){
      var el = $('exPane' + p.charAt(0).toUpperCase() + p.slice(1));
      if(el) el.classList.toggle('show', p === name);
    });
    document.querySelectorAll('.exm-tab').forEach(function(t){
      t.classList.toggle('active', t.dataset.expane === (name === 'form' ? 'list' : name));
    });
    if(name === 'form') resetForm();
    renderAll();
  }

  // ---------- أدوات ----------
  function mine(){ var u = me(); if(!u) return []; return expAll.filter(function(r){ return r && r.userId === u.username; }); }
  function needsReceipt(r){
    return r && (r.status === 'approved' || r.status === 'partial') && r.paid > 0 && !r.receivedAt;
  }
  function seenKey(r){ return 'exp_evt_' + r.id + '_' + r.status + '_' + (r.paid||0); }
  function isSeen(r){ try{ return localStorage.getItem(seenKey(r)) === '1'; }catch(e){ return true; } }
  function markSeen(r){ try{ localStorage.setItem(seenKey(r), '1'); }catch(e){} }

  function splitChips(r){
    var rem = Math.max(0, (Number(r.amount)||0) - (Number(r.paid)||0));
    var h = '<div class="ex-split">' +
      '<div class="ex-chip">المبلغ المطلوب<b>' + esc(money(r.amount, r.currency)) + '</b></div>' +
      '<div class="ex-chip got">المبلغ المسلَّم فعليًا<b>' + esc(money(r.paid||0, r.currency)) + '</b></div>';
    if(rem > 0 && r.paid > 0){
      h += '<div class="ex-chip rem">المبلغ المتبقي<b>' + esc(money(rem, r.currency)) + '</b></div>';
    }
    h += '</div>';
    return h;
  }

  function logBlock(r){
    var log = Array.isArray(r.log) ? r.log : [];
    if(!log.length) return '';
    var items = log.map(function(l){
      var acts = {created:'إنشاء الطلب', approve:'اعتماد الصرف', reject:'رفض الطلب',
                  return:'إعادة للمراجعة', receipt:'تأكيد الاستلام'}[l.action] || l.action;
      return '<li>' + esc(fmtWhen(l.ts)) + ' · <b>' + esc(acts) + '</b>' +
             (l.byName ? ' · ' + esc(l.byName) : '') + (l.detail ? ' — ' + esc(l.detail) : '') + '</li>';
    }).join('');
    return '<div class="ex-log"><div class="ex-log-h">📜 سجل مراحل الطلب (' + log.length + ') ▾</div>' +
           '<ul class="ex-log-list">' + items + '</ul></div>';
  }

  // ---------- قائمة طلباتي ----------
  function renderList(){
    var wrap = $('exList');
    if(!wrap) return;
    if(!me()){ wrap.innerHTML = '<div class="ex-empty">سجّل الدخول أولاً لعرض طلباتك</div>'; return; }
    var list = mine().slice().sort(function(a,b){ return (b.createdAt||0) - (a.createdAt||0); });
    if(!list.length){
      wrap.innerHTML = '<div class="ex-empty">لا توجد طلبات مصاريف بعد — اضغط «طلب مبلغ جديد»</div>';
      return;
    }
    wrap.innerHTML = list.map(function(r){
      var h = '<div class="ex-card" data-exid="' + esc(r.id) + '">' +
        '<div class="ex-card-top">' +
          '<span class="ex-amount">' + esc(money(r.amount, r.currency)) +
            '<span class="ex-cur">' + curFlag(r.currency) + ' ' + (r.currency === 'YER' ? 'ر.ي' : 'ر.س') + '</span></span>' +
          statusBadge(r.status) +
        '</div>' +
        '<div class="ex-meta">' +
          '<div><b>السبب:</b> ' + esc(r.reason || '—') + '</div>' +
          '<div><b>التاريخ:</b> ' + esc(r.dateStr || fmtWhen(r.createdAt)) + ' — ' + esc(r.timeStr || '') + '</div>' +
          (r.note ? '<div><b>ملاحظات:</b> ' + esc(r.note) + '</div>' : '') +
          (r.approvedByName ? '<div><b>اعتمد الصرف:</b> ' + esc(r.approvedByName) + ' · ' + esc(fmtWhen(r.approvedAt)) + '</div>' : '') +
          (r.receivedAt ? '<div><b>تأكيد الاستلام:</b> ' + esc(fmtWhen(r.receivedAt)) + ' · ' + esc(r.receivedByName || r.receivedBy || '') + '</div>' : '') +
        '</div>' +
        (r.paid > 0 || r.amount ? splitChips(r) : '') +
        (r.status === 'rejected' && r.rejectReason ? '<div class="ex-note rej">❌ سبب الرفض: ' + esc(r.rejectReason) + '</div>' : '') +
        (r.status === 'returned' && r.returnNote ? '<div class="ex-note">↩️ ملاحظة المدير: ' + esc(r.returnNote) + '</div>' : '') +
        (needsReceipt(r) ?
          '<div class="ex-acts"><button type="button" class="ex-confirm" data-exrecv="' + esc(r.id) + '">✅ استلمت المبلغ التالي</button></div>' : '') +
        (r.status === 'received' ?
          '<div class="ex-acts"><button type="button" class="ex-confirm" disabled>✅ تم تأكيد الاستلام</button></div>' : '') +
        logBlock(r) +
      '</div>';
      return h;
    }).join('');

    wrap.querySelectorAll('[data-exrecv]').forEach(function(b){
      b.onclick = function(){ confirmReceipt(b.dataset.exrecv, b); };
    });
    wrap.querySelectorAll('.ex-log-h').forEach(function(h){
      h.onclick = function(){ h.parentNode.classList.toggle('open'); };
    });
  }

  // ---------- إشعارات المصاريف ----------
  function renderNotifs(){
    var wrap = $('exNotifList');
    if(!wrap) return;
    var u = me();
    if(!u){ wrap.innerHTML = '<div class="ex-empty">سجّل الدخول أولاً لعرض الإشعارات</div>'; return; }
    var list = mine().slice().sort(function(a,b){ return (b.updatedAt || b.createdAt||0) - (a.updatedAt || a.createdAt||0); });
    var html = '', unread = 0;
    list.forEach(function(r){
      if(needsReceipt(r)){
        var seen = isSeen(r);
        if(!seen) unread++;
        var rem = Math.max(0, (Number(r.amount)||0) - (Number(r.paid)||0));
        html += '<div class="ex-n ' + (seen ? '' : 'wait') + '">' +
          '<div class="ex-n-title">💰 تم اعتماد طلب مصروفك' + (seen ? '' : ' — جديد') + '</div>' +
          '<div class="ex-n-body">' +
            '<div>المبلغ المطلوب: <b>' + esc(money(r.amount, r.currency)) + '</b></div>' +
            '<div>المبلغ المسلَّم فعليًا: <b>' + esc(money(r.paid, r.currency)) + '</b></div>' +
            (rem > 0 ? '<div>المبلغ المتبقي: <b>' + esc(money(rem, r.currency)) + '</b></div>' : '') +
            '<div>العملة: <b>' + curFlag(r.currency) + ' ' + esc(curName(r.currency)) + '</b></div>' +
            '<div>سبب المصروف: <b>' + esc(r.reason || '—') + '</b></div>' +
            '<div>تاريخ الصرف: <b>' + esc(fmtWhen(r.approvedAt)) + '</b></div>' +
            '<div>الذي اعتمد الصرف: <b>' + esc(r.approvedByName || '—') + '</b></div>' +
            '<div>حالة العملية: <b>' + esc(statusLabel(r.status)) + ' — بانتظار تأكيد الاستلام منك</b></div>' +
          '</div>' +
          '<div class="ex-acts"><button type="button" class="ex-confirm" data-exrecv="' + esc(r.id) + '">✅ استلمت المبلغ التالي</button></div>' +
        '</div>';
      } else if(r.status === 'rejected'){
        html += '<div class="ex-n rej">' +
          '<div class="ex-n-title">❌ تم رفض طلب مصروفك</div>' +
          '<div class="ex-n-body">' +
            '<div>المبلغ: <b>' + esc(money(r.amount, r.currency)) + '</b></div>' +
            '<div>السبب: <b>' + esc(r.reason || '—') + '</b></div>' +
            '<div>سبب الرفض: <b>' + esc(r.rejectReason || '—') + '</b></div>' +
            '<div>بتاريخ: <b>' + esc(fmtWhen(r.rejectedAt)) + '</b> · بواسطة <b>' + esc(r.rejectedByName || 'المدير') + '</b></div>' +
          '</div></div>';
      } else if(r.status === 'returned'){
        html += '<div class="ex-n ret">' +
          '<div class="ex-n-title">↩️ أُعيد طلبك للمراجعة</div>' +
          '<div class="ex-n-body">' +
            '<div>المبلغ: <b>' + esc(money(r.amount, r.currency)) + '</b></div>' +
            '<div>السبب: <b>' + esc(r.reason || '—') + '</b></div>' +
            '<div>ملاحظة المدير: <b>' + esc(r.returnNote || '—') + '</b></div>' +
            '<div>بتاريخ: <b>' + esc(fmtWhen(r.returnedAt)) + '</b></div>' +
          '</div></div>';
      } else if(r.status === 'received'){
        html += '<div class="ex-n done">' +
          '<div class="ex-n-title">✅ تم تأكيد استلام مبلغك</div>' +
          '<div class="ex-n-body">' +
            '<div>المبلغ المسلَّم: <b>' + esc(money(r.paid, r.currency)) + '</b></div>' +
            '<div>المبلغ المطلوب: <b>' + esc(money(r.amount, r.currency)) + '</b></div>' +
            '<div>تاريخ الاستلام: <b>' + esc(fmtWhen(r.receivedAt)) + '</b></div>' +
          '</div></div>';
      } else if(r.status === 'pending'){
        html += '<div class="ex-n">' +
          '<div class="ex-n-title">📨 طلبك قيد المراجعة</div>' +
          '<div class="ex-n-body">المبلغ <b>' + esc(money(r.amount, r.currency)) + '</b> — ' + esc(r.reason || '') +
          ' · <b>' + esc(statusLabel(r.status)) + '</b></div>' +
          '<div class="ex-n-time">' + esc(fmtWhen(r.createdAt)) + '</div></div>';
      }
    });
    if(!html) html = '<div class="ex-empty">لا توجد إشعارات مصاريف حالياً</div>';
    wrap.innerHTML = html;
    wrap.querySelectorAll('[data-exrecv]').forEach(function(b){
      b.onclick = function(){ confirmReceipt(b.dataset.exrecv, b); };
    });
    var badge = $('exNotifBadge');
    if(badge){ badge.textContent = String(unread); badge.classList.toggle('on', unread > 0); }
  }

  function renderBadge(){
    var btn = $('myExpensesBtn');
    if(!btn) return;
    var b = btn.querySelector('.exm-btn-badge');
    if(!b){ b = document.createElement('span'); b.className = 'exm-btn-badge'; btn.appendChild(b); }
    var n = mine().filter(needsReceipt).length;
    b.textContent = String(n);
    b.classList.toggle('on', n > 0);
  }

  function updateAdminArea(){
  var area = $('exAdminArea'); if(!area) return;
  var mgr = isMgr();
  area.style.display = mgr ? '' : 'none';
  modal.classList.toggle('exm-wide', mgr && curPane === 'notif');
  if(mgr && window.ExpensesAdmin && typeof window.ExpensesAdmin.refresh === 'function'){
    try{ window.ExpensesAdmin.refresh(); }catch(e){}
  }
}
function renderAll(){ renderList(); renderNotifs(); renderBadge(); updateAdminArea(); }

  // ---------- تأكيد الاستلام ----------
  function confirmReceipt(id, btn){
    var u = me();
    if(!u){ toast('سجّل الدخول أولاً'); return; }
    var r = expAll.find(function(x){ return x && x.id === id; });
    if(!r) return;
    // لا يُسمح لأي مستخدم بتأكيد استلام طلب يخص مستخدماً آخر
    if(r.userId !== u.username){ toast('⛔ هذا الطلب ليس موجهاً لك'); return; }
    if(r.receivedAt){ toast('تم تأكيد الاستلام مسبقاً'); return; }
    if(!(Number(r.paid) > 0)){ toast('لا يوجد مبلغ مسلَّم حتى الآن'); return; }
    if(r.status !== 'approved' && r.status !== 'partial'){ toast('الحالة الحالية لا تسمح بتأكيد الاستلام'); return; }

    var msg = 'هل استلمت المبلغ فعليًا؟\n\n' +
      'المبلغ المطلوب: ' + money(r.amount, r.currency) + '\n' +
      'المبلغ المسلَّم: ' + money(r.paid, r.currency) + '\n' +
      ((r.amount - r.paid) > 0 ? 'المبلغ المتبقي: ' + money(r.amount - r.paid, r.currency) + '\n' : '') +
      'سبب المصروف: ' + (r.reason || '—');
    if(!confirm(msg)) return;

    if(btn){ btn.disabled = true; }
    DB.actExpense(id,
      // guard: ملكية الطلب + الحالة + منع التكرار
      function(x){
        if(!x) return 'غير موجود';
        if(x.userId !== u.username) return 'غير مسموح لك بتأكيد طلب غيرك';
        if(x.receivedAt) return 'تم التأكيد مسبقاً';
        if(!(Number(x.paid) > 0)) return 'لا يوجد مبلغ مسلَّم';
        if(x.status !== 'approved' && x.status !== 'partial') return 'الحالة لا تسمح بالتأكيد';
        return true;
      },
      // patch: تثبيت الاستلام + إشعار للمدير (لا يُعتمد كمستلم إلا بتأكيد المستخدم)
      function(x){
        var patch = {
          status: 'received',
          receivedAt: Date.now(),
          receivedBy: u.username,
          receivedByName: u.name || u.username,
          adminNotice: {
            text: 'أكد المستخدم ' + (u.name || u.username) + ' استلام مبلغ ' + money(x.paid, x.currency),
            ts: Date.now(), read: false
          },
          log: (Array.isArray(x.log) ? x.log : []).concat([{
            ts: Date.now(), by: u.username, byName: (u.name || u.username),
            action: 'receipt', detail: 'تأكيد استلام ' + money(x.paid, x.currency)
          }])
        };
        return patch;
      }
    ).then(function(res){
      if(res && res.ok){
        markSeen(res.rec);
        toast('✅ تم تأكيد استلام المبلغ — شكراً لك');
        try{
          if(typeof addNotification === 'function'){
            addNotification('✅ تم تأكيد استلام مبلغ', money(res.rec.paid, res.rec.currency) + ' · ' + (res.rec.reason || ''), '💰');
          }
        }catch(e){}
        renderAll();
      } else {
        var reasons = {
          not_found: 'الطلب غير موجود',
          'غير مسموح لك بتأكيد طلب غيرك': '⛔ لا يمكنك تأكيد استلام طلب يخص مستخدماً آخر',
          'تم التأكيد مسبقاً': 'تم تأكيد الاستلام مسبقاً',
          error: 'تعذّر الحفظ — تحقق من الاتصال'
        };
        toast(reasons[(res && res.reason)] || ('تعذّر تأكيد الاستلام: ' + ((res && res.reason) || '')));
        if(btn){ btn.disabled = false; }
        renderAll();
      }
    }).catch(function(e){
      console.warn('تأكيد الاستلام:', e);
      toast('تعذّر تأكيد الاستلام — حاول مجدداً');
      if(btn){ btn.disabled = false; }
    });
  }

  // ---------- النموذج ----------
  function resetForm(){
    var f = $('exForm'); if(f) f.reset();
    var err = $('exErr'); if(err) err.textContent = '';
    setCur('YER');
    var d = $('exDate'); if(d) d.value = (new Date()).toLocaleString('ar', {year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'});
    var by = $('exBy'); var u = me();
    if(by) by.value = u ? ((u.name || u.username) + ' (' + u.username + ')') : '';
    var send = $('exSendBtn'); if(send){ send.disabled = false; send.textContent = '📤 إرسال طلب المصروف'; }
    sending = false;
  }
  function setCur(c){
    curCur = (c === 'YER') ? 'YER' : 'SAR';
    document.querySelectorAll('#exCurRow .ex-cur-btn').forEach(function(b){
      b.classList.toggle('active', b.dataset.cur === curCur);
    });
  }
  // تنظيف خانة المبلغ: أرقام + نقطة عشرية واحدة بحد أقصى خانتين
  function sanitizeAmount(inp){
    inp.addEventListener('input', function(){
      var v = inp.value.replace(/[^\d.]/g, '');
      var i1 = v.indexOf('.');
      if(i1 !== -1){ v = v.slice(0, i1+1) + v.slice(i1+1).replace(/\./g, ''); }
      var parts = v.split('.');
      if(parts[1] && parts[1].length > 2){ v = parts[0] + '.' + parts[1].slice(0,2); }
      if(v !== inp.value) inp.value = v;
    });
    inp.addEventListener('keydown', function(e){
      if(e.key === ' ' || /[eE]/.test(e.key)) e.preventDefault();
    });
  }

  function initForm(){
    var amount = $('exAmount');
    if(amount) sanitizeAmount(amount);
    document.querySelectorAll('#exCurRow .ex-cur-btn').forEach(function(b){
      b.onclick = function(){ setCur(b.dataset.cur); };
    });
    var form = $('exForm');
    if(!form) return;
    form.onsubmit = function(e){
      e.preventDefault();
      var err = $('exErr');
      function fail(m){ if(err) err.textContent = m; }
      if(sending) return;
      var u = me();
      if(!u){ fail('سجّل الدخول أولاً'); return; }
      var raw = (amount.value || '').trim();
      if(!raw){ fail('الرجاء إدخال المبلغ المطلوب'); return; }
      if(!/^\d+(\.\d{1,2})?$/.test(raw)){ fail('المبلغ يجب أن يكون رقماً صحيحاً أو عشرياً (بحد أقصى خانتين عشرية)'); return; }
      var val = parseFloat(raw);
      if(!isFinite(val) || val <= 0){ fail('أدخل مبلغاً أكبر من صفر'); return; }
      if(val > 1000000000){ fail('المبلغ كبير جداً'); return; }
      var reason = ($('exReason').value || '').trim();
      if(!reason){ fail('الرجاء كتابة سبب طلب المبلغ'); return; }
      if(err) err.textContent = '';

      var send = $('exSendBtn');
      sending = true; send.disabled = true; send.textContent = 'جارٍ الإرسال…';

      var now = Date.now();
      var rec = {
        userId: u.username,
        userName: u.name || u.username,
        amount: Math.round(val * 100) / 100,
        currency: curCur,
        reason: reason,
        note: ($('exNote').value || '').trim(),
        createdAt: now,
        status: 'pending',
        paid: 0,
        log: [{ ts: now, by: u.username, byName: (u.name || u.username), action: 'created', detail: 'طلب مبلغ ' + '' + (curCur === 'YER' ? 'ر.ي' : 'ر.س') }]
      };
      DB.addExpense(rec).then(function(saved){
        sending = false;
        send.disabled = false; send.textContent = '📤 إرسال طلب المصروف';
        toast('✅ تم إرسال طلب المصروف — بانتظار مراجعة المدير');
        try{
          if(typeof addNotification === 'function'){
            addNotification('📤 تم إرسال طلب مصروف', money(saved.amount, saved.currency) + ' · ' + (saved.reason || ''), '💰');
          }
        }catch(e){}
        showPane('list');
      }).catch(function(e){
        console.warn('addExpense:', e);
        sending = false;
        send.disabled = false; send.textContent = '📤 إرسال طلب المصروف';
        fail('تعذّر إرسال الطلب — تحقق من الاتصال وأعد المحاولة');
      });
    };
  }

  // ---------- كشف التغييرات وإظهار إشعارات النظام ----------
  function diffAndNotify(oldList){
    var u = me(); if(!u) return;
    var newOnes = mine().filter(function(r){
      var old = (oldList||[]).find(function(x){ return x && x.id === r.id; });
      if(!old) return false;                       // طلب قديم قبل تشغيل الميزة: لا إشعار
      if(old.status === r.status && Number(old.paid) === Number(r.paid)) return false;
      return ['approved','partial','rejected','returned','received'].indexOf(r.status) !== -1 && !isSeen(r);
    });
    newOnes.forEach(function(r){
      var title = '', body = '';
      if(r.status === 'approved' || r.status === 'partial'){
        title = '💰 تم اعتماد طلب مصروفك';
        body = 'تم اعتماد طلب مصروفك وتسليم مبلغ ' + money(r.paid, r.currency) + '. يرجى تأكيد الاستلام من حسابك';
      } else if(r.status === 'rejected'){
        title = '❌ تم رفض طلب مصروفك';
        body = 'المبلغ ' + money(r.amount, r.currency) + ' — سبب الرفض: ' + (r.rejectReason || '—');
      } else if(r.status === 'returned'){
        title = '↩️ أُعيد طلبك للمراجعة';
        body = 'ملاحظة المدير: ' + (r.returnNote || '—');
      } else if(r.status === 'received'){
        title = '✅ تم تأكيد استلام مبلغك';
        body = money(r.paid, r.currency) + ' · ' + (r.reason || '');
      }
      if(!title) return;
      markSeen(r);
      try{ if(typeof addNotification === 'function') addNotification(title, body, '💰'); }catch(e){}
      try{ if(typeof systemNotify === 'function') systemNotify(title, body); }catch(e){}
    });
  }

  // ---------- الربط ----------
  function init(){
    var btn = $('myExpensesBtn');
    if(btn){ btn.onclick = function(){ var u = me(); if(!u){ toast('سجّل الدخول أولاً'); return; } open(); }; }
    var x = $('exClose'); if(x) x.onclick = close;
    modal.addEventListener('click', function(e){ if(e.target === modal) close(); });
    document.addEventListener('keydown', function(e){ if(e.key === 'Escape' && modal.classList.contains('show')) close(); });
    document.querySelectorAll('.exm-tab').forEach(function(t){
      t.onclick = function(){ showPane(t.dataset.expane); };
    });
    var nb = $('exNewBtn'); if(nb) nb.onclick = function(){ showPane('form'); };
    var bb = $('exBackBtn'); if(bb) bb.onclick = function(){ showPane('list'); };
    initForm();
    try{
      DB.onExpenses(function(list){
        var old = expAll;
        expAll = Array.isArray(list) ? list : [];
        diffAndNotify(old);
        renderAll();
      });
    }catch(e){ console.warn('اشتراك المصاريف:', e); }
    renderAll();
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  // واجهة عامة صغيرة للاستخدامات الأخرى
  window.ExpensesUI = { open: open, refresh: renderAll };
})();
