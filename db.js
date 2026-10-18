// ============================================================
//  طبقة البيانات الموحدة (Data Layer)
//  تستخدم Firebase Firestore إن كان متوفراً،
//  وإلا ترجع تلقائياً إلى التخزين المحلي localStorage.
//  نفس الواجهة البرمجية في الحالتين.
// ============================================================

const DEFAULT_MENU = [

];

const DB = (function(){
  const useFB = () => window.FIREBASE_READY === true && window.fbdb;

  // ===== وضع توفير البيانات: يقصر تحميل الطلبات على نافذة زمنية حديثة =====
  // يقلّل عدد قراءات Firestore (التكلفة الرئيسية) بتحميل الطلبات الحديثة فقط.
  const DATA_SAVER = { enabled: true, days: 30 };  // مفعّل افتراضياً: نحمّل الطلبات الحديثة فقط لتقليل استهلاك Firebase
  function setDataSaver(enabled, days){
    DATA_SAVER.enabled = !!enabled;
    if(days != null){ const d = parseInt(days, 10); if(!isNaN(d) && d > 0) DATA_SAVER.days = d; }
  }
  function dsCutoff(){ return Date.now() - (Math.max(1, DATA_SAVER.days) * 86400000); }

  // سباق مع مهلة زمنية حتى لا تتعلق الواجهة إذا تأخرت السحابة
  function withTimeout(promise, ms){
    return new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(new Error('timeout')), ms);
      promise.then(v => { clearTimeout(t); resolve(v); },
                   e => { clearTimeout(t); reject(e); });
    });
  }

  // ----- مساعدات التخزين المحلي -----
  function lsOrders(){ try{ return JSON.parse(localStorage.getItem('orders')||'[]'); }catch(e){ return []; } }
  function lsSaveOrders(o){ localStorage.setItem('orders', JSON.stringify(o)); }
  function lsMenu(){
    const s = localStorage.getItem('menu');
    if(s){ try{ return JSON.parse(s); }catch(e){} }
    localStorage.setItem('menu', JSON.stringify(DEFAULT_MENU));
    return DEFAULT_MENU.slice();
  }
  function lsSaveMenu(m){ localStorage.setItem('menu', JSON.stringify(m)); }

  // ----- الإعدادات الافتراضية -----
  const DEFAULT_SETTINGS = {
    name:   '',
    headerBrand: '',      // اسم العلامة التجارية في ترويسة الفاتورة (فارغ = اسم النظام)
    headerTagline: '',    // العنوان الجانبي / الشعار النصي تحت الاسم
    logo: '',             // شعار الفاتورة (dataURL)
    devName: '',          // اسم المبرمج (أسفل الفاتورة)
    phone:  '920001234',
    address:'ش',
    vatNo:  '',
    vatRate: 0.15,
    showVat: false,       // إظهار الضريبة والرقم الضريبي في الفاتورة (معطّل افتراضياً)
    customFields: [],     // خانات إضافية تظهر في الفاتورة [{label, value}]
    exchanges: [          // الصرافون / شركات الصرافة للإيداع والحوالات [{name, color}]
      { name: 'شركة المشقاص للصرافة', color: '#16a34a' }
    ],
    currency: 'YER',     // العملة الافتراضية: الريال اليمني
    footer:  'شكراً لزيارتكم ❤️',
    allowDeposit: true,   // السماح بالعربون / الدفع الجزئي
    directPrint: false,   // طباعة مباشرة دون تأكيد
    notifEnabled: true,   // تفعيل إشعارات النظام عند وصول طلب جديد
    notifSound: true,     // تشغيل نغمة تنبيه مع الإشعار
    qrEnabled: true,      // كود QR في الفاتورة + زر القراءة في الكاشير
    // ----- إظهار/إخفاء أزرار نوع الطلب في الكاشير (محلي/سفري/توصيل) -----
    orderTypes: { local: true, takeaway: true, delivery: true },
    // ----- أزرار/أيقونات الواجهة: إظهار/إخفاء + حجم الأيقونة (عام ولكل زر) -----
    ui: {
      iconScale: 100,   // حجم الأيقونات العام (نسبة مئوية 70–160)
      buttons: {
        posSwitch:   { show:true, scale:100 },
        bioEnroll:   { show:true, scale:100 },
        extForm:     { show:true, scale:100 },
        posLogout:   { show:true, scale:100 },
        customers:   { show:true, scale:100 },
        notif:       { show:true, scale:100 },
        week:        { show:true, scale:100 },
        dailyReport: { show:true, scale:100 },
        admin:       { show:true, scale:100 },
        messages:    { show:true, scale:100 }
      }
    },
    // ----- الدردشة الداخلية (مركز الرسائل) -----
    chatEnabled: true,
    // ----- تنظيف الدردشة التلقائي (جدول أسبوعي) -----
    chatPurgeEnabled: false,   // تفعيل التنظيف التلقائي
    chatPurgeDay: 6,           // يوم الأسبوع (0=الأحد ... 6=السبت)
    chatPurgeKeepDays: 7,      // الاحتفاظ برسائل آخر N يوم (0 = حذف الكل)
    chatPurgeLastRun: 0,       // آخر تشغيل للتنظيف التلقائي
    // ----- طوارئ النظام (شاشة الصيانة) -----
    maintenance: { active:false, title:'', note:'', ts:0 },
    // ----- الميزات الجديدة (تُعرض مرة واحدة عند كل تحديث) -----
    whatsNew: { ver:0, title:'', items:[] },
    // ----- التحديثات (نشر تحديث فوري لكل الأجهزة: يمسح الكاش ويعيد التحميل) -----
    appUpdate: { ver:0, note:'', ts:0 },
    // ----- استضافة Netlify (اختياري) -----
    netlifyToken: '',     // رمز وصول شخصي من Netlify (Personal Access Token)
    netlifySlug: '',      // اسم الحساب (Account slug) لجلب استهلاك الباقة
    netlifySiteId: '',    // معرّف الموقع (Site ID / API ID) لعرض تفاصيل النشر
    // ----- النسخ الاحتياطي التلقائي -----
    backupEnabled: false, // تفعيل النسخ الاحتياطي التلقائي
    backupFreq: 'weekly', // التكرار: daily | weekly
    backupLastRun: 0,     // آخر وقت تم فيه النسخ (ms)
    // ----- المحو التلقائي للبيانات -----
    purgeEnabled: false,  // تفعيل محو البيانات القديمة تلقائياً
    purgeKeepDays: 7,     // عدد الأيام المحفوظة (الباقي يُحذف)
    purgeLastRun: 0,      // آخر وقت تم فيه المحو (ms)
    // ----- تخصيص الواجهة والأمان (إعدادات جديدة) -----
    compactMenu: false,   // عرض مضغوط لشبكة الأصناف (أصناف أكثر في الشاشة)    bigText: false,       // تكبير خط الواجهة لسهولة القراءة
    clickSound: false,    // نغمة قصيرة عند إضافة صنف إلى الطلب
    autoLock: false,      // قفل تلقائي للشاشة عند الخمول (يتطلب إعادة دخول)
    autoLockMin: 5,       // مدة الخمول قبل القفل (دقائق)
    // ----- وضع توفير البيانات (تقليل استهلاك Firebase) -----
    dataSaver: true,      // مفعّل افتراضياً لتقليل استهلاك Firebase: يحمّل الطلبات الحديثة فقط
    dataSaverDays: 30,    // عدد الأيام التي تُحمّل طلباتها عند تفعيل وضع التوفير
    // ----- الفتح التلقائي لطلبات الأسبوع لكل مستخدم -----
    weeklyAutoOpen: false,     // تفعيل فتح لوحة طلبات الأسبوع تلقائياً في أوقات محددة
    weeklyAutoOpenTimes: [],   // أوقات الفتح التلقائي بصيغة "HH:MM" (مثال: ["08:00","14:00"])
    // ----- فتح طلبات الأسبوع عند وصول طلب جديد (إعدادات جديدة) -----
    weeklyOnNewOrder: false,       // فتح لوحة طلبات الأسبوع تلقائياً عند وصول طلب جديد
    weeklyNewGlow: true,           // إضاءة زرقاء تومض خلف الطلب الجديد
    weeklyGlowMinutes: 2,          // مدة وميض الإضاءة الزرقاء (دقائق)
    weeklyStayOpen: true,          // إبقاء اللوحة مفتوحة حتى يقفلها المستخدم يدوياً
    weeklyJumpToNew: true,         // الانتقال التلقائي/التمرير إلى الطلب الجديد داخل اللوحة
    weeklyHighlightMax: 20,        // أقصى عدد طلبات تُعلَّم كـ"جديدة" في اللوحة
    // ----- استمارة عميل جديد (نموذج يُحوَّل إلى طلب بعد المصادقة) -----
    custForm: {
      enabled: true,            // تفعيل ميزة "استمارة عميل جديد"
      validHours: 24,           // مدة صلاحية الاستمارة قبل انتهائها (بالساعات)
      askName: true,            // طلب اسم العميل
      nameRequired: true,       // اسم العميل إلزامي
      askPhone: true,           // طلب رقم جوال العميل
      phoneRequired: false,     // رقم الجوال إلزامي
      askWhatsapp: true,        // سؤال: هل لدى العميل واتساب؟
      askDeposit: true,         // إظهار خيار "إيداع أو حوالة" في الاستمارة
      askTheme: true,           // إظهار خيار "مع ثيم / بدون ثيم"
      askPickup: true,          // إظهار موعد الاستلام (تاريخ ووقت)
      extraFields: [],          // خانات إضافية مخصّصة [{id,label,type,required}]
      occasions: ['مولود','مولودة','توم','زواج','خطوبة'],  // مناسبات الثيم في الاستمارة
      // ----- إعدادات عرض الاستمارة (جديدة) -----
      title: '',                // عنوان افتراضي للاستمارة (اختياري)
      introText: 'اكتب كل طلبك هنا، وتأكد من المعلومات والنصوص قبل الإرسال، ولا تنسَ تحديد يوم الطلب لأن التعديل يكون صعباً.\n\nنتمنى لكم وجبة شهية.',
      fontSize: 15,             // حجم خط الاستمارة (px)
      showCreator: true,        // إظهار اسم المستخدم المنشئ في نهاية الاستمارة
      sectionOrder: ['items','customer','pay','theme','pickup','extra','note']  // ترتيب أقسام الاستمارة
    },
    // ----- الخطوط العامة للنظام (نِسَب مئوية 70–160) -----
    fonts: {
      base: 100,     // الحجم الأساسي للنصوص
      heading: 100,  // العناوين
      table: 100,    // الجداول والقوائم
      button: 100,   // الأزرار
      input: 100     // حقول الإدخال
    },
    // ----- إعدادات الفاتورة المتقدمة (مستقلة عن الطباعة) -----
    invoice: {
      fontHeading: 18,   // حجم خط اسم المتجر/العنوان
      fontBody: 12,      // حجم خط التفاصيل العامة
      fontTable: 12,     // حجم خط جدول الأصناف
      fontTotal: 14,     // حجم خط الإجماليات
      fontFooter: 11,    // حجم خط التذييل
      showLogo: true,      // إظهار الشعار
      showTagline: true,   // إظهار الشعار النصي
      showAddress: true,   // إظهار العنوان
      showPhone: true,     // إظهار الهاتف
      showPickup: true,    // إظهار موعد الاستلام
      showTheme: true,     // إظهار بيانات الثيم
      showCashier: true,   // إظهار اسم المستخدم المنشئ
      showFooter: true,    // إظهار التذييل
      order: ['header','meta','items','totals','payment','footer','qr']  // ترتيب كتل الفاتورة
    },
    // ----- ترتيب قائمة الطلبات الافتراضي: newest=الأحدث أعلى · oldest=الأحدث أسفل -----
    ordersSort: 'newest',
    // ----- شاشة تسجيل الدخول (خلفية + أزرار + دخول حيوي) -----
    loginScreen: {
      bgImage: '',              // خلفية مخصّصة لشاشة الدخول (dataURL أو رابط). فارغ = الخلفية الافتراضية
      showSignupBtn: true,      // إظهار زر «➕ إنشاء حساب جديد»
      showCheckStatusBtn: true, // إظهار زر «🔑 لدي طلب — إدخال كود التفعيل»
      bioEnabled: true,         // السماح بالدخول ببصمة الإصبع (WebAuthn)
      faceEnabled: true,        // السماح بالدخول ببصمة العين/الوجه
      title: '',                // عنوان مخصّص (اختياري)
      subtitle: ''              // نص فرعي مخصّص (اختياري)
    },
    print: { align:'center', marginTop:0, marginSide:4, paddingV:6, fontSize:12 }
  };
  function mergeSettings(s){
    const out = Object.assign({}, DEFAULT_SETTINGS, s || {});
    out.print = Object.assign({}, DEFAULT_SETTINGS.print, (s && s.print) || {});
    out.custForm = Object.assign({}, DEFAULT_SETTINGS.custForm, (s && s.custForm) || {});
    out.fonts = Object.assign({}, DEFAULT_SETTINGS.fonts, (s && s.fonts) || {});
    out.invoice = Object.assign({}, DEFAULT_SETTINGS.invoice, (s && s.invoice) || {});
    out.orderTypes = Object.assign({}, DEFAULT_SETTINGS.orderTypes, (s && s.orderTypes) || {});
    out.loginScreen = Object.assign({}, DEFAULT_SETTINGS.loginScreen, (s && s.loginScreen) || {});
    // دمج إعدادات الواجهة (ui) بعمق مع ضمان وجود كل الأزرار
    const uiIn = (s && s.ui) || {};
    out.ui = { iconScale: (uiIn.iconScale != null ? uiIn.iconScale : DEFAULT_SETTINGS.ui.iconScale), buttons: {} };
    Object.keys(DEFAULT_SETTINGS.ui.buttons).forEach(function(k){
      const d = DEFAULT_SETTINGS.ui.buttons[k];
      const v = (uiIn.buttons && uiIn.buttons[k]) || {};
      out.ui.buttons[k] = { show: (v.show !== false), scale: (v.scale != null ? v.scale : d.scale) };
    });
    out.chatEnabled = (s && s.chatEnabled === false) ? false : true;
    // تنظيف الدردشة التلقائي
    out.chatPurgeEnabled = !!(s && s.chatPurgeEnabled);
    out.chatPurgeDay = (s && s.chatPurgeDay != null) ? Math.min(6, Math.max(0, parseInt(s.chatPurgeDay,10)||0)) : DEFAULT_SETTINGS.chatPurgeDay;
    out.chatPurgeKeepDays = (s && s.chatPurgeKeepDays != null) ? Math.max(0, parseInt(s.chatPurgeKeepDays,10)||0) : DEFAULT_SETTINGS.chatPurgeKeepDays;
    out.chatPurgeLastRun = (s && s.chatPurgeLastRun) || 0;
    // طوارئ النظام + الميزات الجديدة (حفظ كامل البنية)
    out.maintenance = Object.assign({}, DEFAULT_SETTINGS.maintenance, (s && s.maintenance) || {});
    var wnIn = (s && s.whatsNew) || {};
    out.whatsNew = {
      ver: (wnIn.ver != null ? wnIn.ver : DEFAULT_SETTINGS.whatsNew.ver),
      title: (wnIn.title != null ? wnIn.title : DEFAULT_SETTINGS.whatsNew.title),
      items: Array.isArray(wnIn.items) ? wnIn.items : []
    };
    // التحديثات
    var auIn = (s && s.appUpdate) || {};
    out.appUpdate = {
      ver: (auIn.ver != null ? auIn.ver : DEFAULT_SETTINGS.appUpdate.ver),
      note: (auIn.note != null ? auIn.note : DEFAULT_SETTINGS.appUpdate.note),
      ts: (auIn.ts != null ? auIn.ts : DEFAULT_SETTINGS.appUpdate.ts)
    };
    return out;
  }
  function lsSettings(){
    const s = localStorage.getItem('settings_config');
    if(s){ try{ return mergeSettings(JSON.parse(s)); }catch(e){} }
    return mergeSettings(null);
  }
  function lsSaveSettings(s){ localStorage.setItem('settings_config', JSON.stringify(s)); }

  // ----- المستخدمون والصلاحيات -----
  const PERM_KEYS = ['orders','customers','menu','stats','settings','users'];
  const DEFAULT_USERS = [
    {id:1, username:'admin', password:'admin', name:'المدير العام', role:'مدير',
     perms:{orders:true, menu:true, stats:true, settings:true, users:true}}
  ];
  function lsUsers(){
    const s = localStorage.getItem('settings_users');
    if(s){ try{ const a = JSON.parse(s); if(Array.isArray(a) && a.length) return a; }catch(e){} }
    localStorage.setItem('settings_users', JSON.stringify(DEFAULT_USERS));
    return DEFAULT_USERS.slice();
  }
  function lsSaveUsers(u){ localStorage.setItem('settings_users', JSON.stringify(u)); }

  // =================== الإعدادات (SETTINGS) ===================
  async function getSettings(){
    if(useFB()){
      try{
        const doc = await withTimeout(window.fbdb.collection('settings').doc('config').get(), 5000);
        if(doc.exists) return mergeSettings(doc.data());
        return mergeSettings(null);
      }catch(e){
        console.warn('[DB] تعذر جلب الإعدادات، استخدام الافتراضي:', e.message);
        return mergeSettings(null);
      }
    }
    return lsSettings();
  }
  async function saveSettings(cfg){
    const merged = mergeSettings(cfg);
    if(useFB()){
      await window.fbdb.collection('settings').doc('config').set(merged);
    } else {
      lsSaveSettings(merged);
    }
    return merged;
  }
  function onSettings(cb){
    if(useFB()){
      return window.fbdb.collection('settings').doc('config').onSnapshot(doc => {
        cb(mergeSettings(doc.exists ? doc.data() : null));
      });
    }
    const handler = e => { if(e.key === 'settings_config') cb(lsSettings()); };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }

  // =================== المستخدمون (USERS) ===================
  async function getUsers(){
    if(useFB()){
      try{
        const doc = await withTimeout(window.fbdb.collection('settings').doc('users').get(), 5000);
        if(doc.exists && Array.isArray(doc.data().list) && doc.data().list.length) return doc.data().list;
        window.fbdb.collection('settings').doc('users').set({list: DEFAULT_USERS}).catch(()=>{});
        return DEFAULT_USERS.slice();
      }catch(e){
        console.warn('[DB] تعذر جلب المستخدمين، استخدام الافتراضي:', e.message);
        return DEFAULT_USERS.slice();
      }
    }
    return lsUsers();
  }
  async function saveUsers(list){
    if(useFB()){
      await window.fbdb.collection('settings').doc('users').set({list});
    } else {
      lsSaveUsers(list);
    }
  }
  function onUsers(cb){
    if(useFB()){
      return window.fbdb.collection('settings').doc('users').onSnapshot(doc => {
        if(doc.exists && Array.isArray(doc.data().list)) cb(doc.data().list);
      });
    }
    const handler = e => { if(e.key === 'settings_users') cb(lsUsers()); };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }

  // =================== طلبات إنشاء الحساب (SIGNUP REQUESTS) ===================
  // تُحفظ كقائمة داخل مستند settings/signup_requests (يعمل سحابياً ومحلياً).
  // كل طلب: {id, first, second, phone, city, username, password, code,
  //          status:'pending'|'approved'|'rejected', perms, role, createdAt, reviewedAt}
  function lsSignups(){ try{ return JSON.parse(localStorage.getItem('signup_requests')||'[]'); }catch(e){ return []; } }
  function lsSaveSignups(a){ localStorage.setItem('signup_requests', JSON.stringify(a)); }

  async function getSignupRequests(){
    if(useFB()){
      try{
        const doc = await withTimeout(window.fbdb.collection('settings').doc('signup_requests').get(), 5000);
        return (doc.exists && Array.isArray(doc.data().list)) ? doc.data().list : [];
      }catch(e){
        console.warn('[DB] تعذر جلب طلبات الحسابات:', e.message);
        return [];
      }
    }
    return lsSignups();
  }
  async function addSignupRequest(req){
    const list = await getSignupRequests();
    req.id = req.id || ('req_' + Date.now() + '_' + Math.floor(Math.random()*1000));
    req.createdAt = req.createdAt || Date.now();
    req.status = req.status || 'pending';
    list.push(req);
    if(useFB()){ await window.fbdb.collection('settings').doc('signup_requests').set({list}); }
    else { lsSaveSignups(list); }
    return req;
  }
  async function updateSignupRequest(id, patch){
    const list = await getSignupRequests();
    const i = list.findIndex(r => r.id === id);
    if(i === -1) return null;
    list[i] = Object.assign({}, list[i], patch, {reviewedAt: Date.now()});
    if(useFB()){ await window.fbdb.collection('settings').doc('signup_requests').set({list}); }
    else { lsSaveSignups(list); }
    return list[i];
  }
  async function deleteSignupRequest(id){
    let list = await getSignupRequests();
    list = list.filter(r => r.id !== id);
    if(useFB()){ await window.fbdb.collection('settings').doc('signup_requests').set({list}); }
    else { lsSaveSignups(list); }
    return true;
  }
  function onSignupRequests(cb){
    if(useFB()){
      return window.fbdb.collection('settings').doc('signup_requests').onSnapshot(doc => {
        cb((doc.exists && Array.isArray(doc.data().list)) ? doc.data().list : []);
      });
    }
    cb(lsSignups());
    const handler = e => { if(e.key === 'signup_requests') cb(lsSignups()); };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }

  // =================== سجل الحركة (ACTIVITY LOG) ===================
  // تُحفظ كقائمة داخل مستند settings/activity_log (يعمل سحابياً ومحلياً).
  // كل حركة: {id, user, role, event:'login'|'logout'|'order'|'print'|'action',
  //           action, net:'wifi'|'cellular'|'none'|'unknown', online, ts}
  var ACTIVITY_LOG_MAX = 1000;
  function lsActivity(){ try{ return JSON.parse(localStorage.getItem('activity_log')||'[]'); }catch(e){ return []; } }
  function lsSaveActivity(a){ try{ localStorage.setItem('activity_log', JSON.stringify(a)); }catch(e){} }

  async function getActivityLog(){
    if(useFB()){
      try{
        const doc = await withTimeout(window.fbdb.collection('settings').doc('activity_log').get(), 5000);
        return (doc.exists && Array.isArray(doc.data().list)) ? doc.data().list : [];
      }catch(e){
        console.warn('[DB] تعذر جلب سجل الحركة:', e.message);
        return [];
      }
    }
    return lsActivity();
  }
  async function addActivity(entry){
    try{
      let list = await getActivityLog();
      entry = entry || {};
      entry.id = entry.id || ('act_' + Date.now() + '_' + Math.floor(Math.random()*1000));
      entry.ts = entry.ts || Date.now();
      list.push(entry);
      // سقف ~1000 سطر (نبقي الأحدث)
      if(list.length > ACTIVITY_LOG_MAX) list = list.slice(list.length - ACTIVITY_LOG_MAX);
      if(useFB()){ await window.fbdb.collection('settings').doc('activity_log').set({list}); }
      else { lsSaveActivity(list); }
      return entry;
    }catch(e){ console.warn('[DB] تعذر تسجيل الحركة:', e.message); return null; }
  }
  async function clearActivityLog(){
    if(useFB()){ await window.fbdb.collection('settings').doc('activity_log').set({list:[]}); }
    else { lsSaveActivity([]); }
    return true;
  }
  function onActivityLog(cb){
    if(useFB()){
      return window.fbdb.collection('settings').doc('activity_log').onSnapshot(doc => {
        cb((doc.exists && Array.isArray(doc.data().list)) ? doc.data().list : []);
      });
    }
    cb(lsActivity());
    const handler = e => { if(e.key === 'activity_log') cb(lsActivity()); };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }

  // =================== استمارات العملاء (CUSTOMER FORMS) ===================
  // تُحفظ كقائمة داخل مستند settings/cust_forms (يعمل سحابياً ومحلياً).
  // كل استمارة: {id, createdBy, createdByName, name, phone, hasWa, items:[...],
  //   payMethod, depositType, exchangeName, exchangeColor, theme, themeData,
  //   pickupDate, pickupTime, extra:{...}, status:'pending'|'approved'|'expired',
  //   createdAt, expiresAt, orderNo}
  function lsCustForms(){ try{ return JSON.parse(localStorage.getItem('cust_forms')||'[]'); }catch(e){ return []; } }
  function lsSaveCustForms(a){ localStorage.setItem('cust_forms', JSON.stringify(a)); }

  async function getCustForms(){
    if(useFB()){
      try{
        const doc = await withTimeout(window.fbdb.collection('settings').doc('cust_forms').get(), 5000);
        return (doc.exists && Array.isArray(doc.data().list)) ? doc.data().list : [];
      }catch(e){
        console.warn('[DB] تعذر جلب استمارات العملاء:', e.message);
        return [];
      }
    }
    return lsCustForms();
  }
  async function addCustForm(f){
    const list = await getCustForms();
    f.id = f.id || ('cf_' + Date.now() + '_' + Math.floor(Math.random()*1000));
    // رمز موحّد ثابت للاستمارة (نفس الرمز يُستخدم عبر الإرسال→المصادقة→الطلب→الفاتورة)
    f.token = f.token || genToken();
    f.createdAt = f.createdAt || Date.now();
    f.status = f.status || 'pending';
    list.push(f);
    if(useFB()){ await window.fbdb.collection('settings').doc('cust_forms').set({list}); }
    else { lsSaveCustForms(list); }
    return f;
  }
  async function updateCustForm(id, patch){
    const list = await getCustForms();
    const i = list.findIndex(r => r.id === id);
    if(i === -1) return null;
    list[i] = Object.assign({}, list[i], patch);
    if(useFB()){ await window.fbdb.collection('settings').doc('cust_forms').set({list}); }
    else { lsSaveCustForms(list); }
    return list[i];
  }
  async function deleteCustForm(id){
    let list = await getCustForms();
    list = list.filter(r => r.id !== id);
    if(useFB()){ await window.fbdb.collection('settings').doc('cust_forms').set({list}); }
    else { lsSaveCustForms(list); }
    return true;
  }
  // جلب استمارة عميل بالرمز الموحّد (للتتبّع عبر مسح QR)
  async function getCustFormByToken(token){
    const list = await getCustForms();
    return list.find(r => r && r.token === token) || null;
  }
  function onCustForms(cb){
    if(useFB()){
      return window.fbdb.collection('settings').doc('cust_forms').onSnapshot(doc => {
        cb((doc.exists && Array.isArray(doc.data().list)) ? doc.data().list : []);
      });
    }
    cb(lsCustForms());
    const handler = e => { if(e.key === 'cust_forms') cb(lsCustForms()); };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }

  // =================== استمارات الطلب الخارجية (order_forms) ===================
  // رابط مؤقت ينشئه المستخدم ليملأه العميل دون تسجيل دخول.
  // كل استمارة: {token, title, note, createdBy, createdByName, createdAt, expiresAt, active}
  function lsOrderForms(){ try{ return JSON.parse(localStorage.getItem('order_forms')||'[]'); }catch(e){ return []; } }
  function lsSaveOrderForms(a){ localStorage.setItem('order_forms', JSON.stringify(a)); }

  async function getOrderForms(){
    if(useFB()){
      try{
        const doc = await withTimeout(window.fbdb.collection('settings').doc('order_forms').get(), 5000);
        return (doc.exists && Array.isArray(doc.data().list)) ? doc.data().list : [];
      }catch(e){ console.warn('[DB] تعذر جلب الاستمارات:', e.message); return []; }
    }
    return lsOrderForms();
  }
  async function addOrderForm(f){
    const list = await getOrderForms();
    f.token = f.token || genToken();
    f.createdAt = f.createdAt || Date.now();
    f.active = (f.active !== false);
    list.push(f);
    if(useFB()){ await window.fbdb.collection('settings').doc('order_forms').set({list}); }
    else { lsSaveOrderForms(list); }
    return f;
  }
  async function getOrderFormByToken(token){
    const list = await getOrderForms();
    return list.find(r => r.token === token) || null;
  }
  async function updateOrderForm(token, patch){
    const list = await getOrderForms();
    const i = list.findIndex(r => r.token === token);
    if(i === -1) return null;
    list[i] = Object.assign({}, list[i], patch);
    if(useFB()){ await window.fbdb.collection('settings').doc('order_forms').set({list}); }
    else { lsSaveOrderForms(list); }
    return list[i];
  }
  async function deleteOrderForm(token){
    let list = await getOrderForms();
    list = list.filter(r => r.token !== token);
    if(useFB()){ await window.fbdb.collection('settings').doc('order_forms').set({list}); }
    else { lsSaveOrderForms(list); }
    return true;
  }
  function onOrderForms(cb){
    if(useFB()){
      return window.fbdb.collection('settings').doc('order_forms').onSnapshot(doc => {
        cb((doc.exists && Array.isArray(doc.data().list)) ? doc.data().list : []);
      });
    }
    cb(lsOrderForms());
    const handler = e => { if(e.key === 'order_forms') cb(lsOrderForms()); };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }

  // =================== طلبات العملاء عبر الاستمارة (order_subs) ===================
  // ما يرسله العميل: {id, token, createdBy, createdByName, name, phone, hasWa, items:[...],
  //   payMethod, depositType, exchangeName, exchangeColor, theme, themeData,
  //   pickupDate, pickupTime, note, status:'pending'|'approved', createdAt, orderNo}
  function lsOrderSubs(){ try{ return JSON.parse(localStorage.getItem('order_subs')||'[]'); }catch(e){ return []; } }
  function lsSaveOrderSubs(a){ localStorage.setItem('order_subs', JSON.stringify(a)); }

  async function getOrderSubs(){
    if(useFB()){
      try{
        const doc = await withTimeout(window.fbdb.collection('settings').doc('order_subs').get(), 5000);
        return (doc.exists && Array.isArray(doc.data().list)) ? doc.data().list : [];
      }catch(e){ console.warn('[DB] تعذر جلب طلبات الاستمارة:', e.message); return []; }
    }
    return lsOrderSubs();
  }
  async function addOrderSub(s){
    const list = await getOrderSubs();
    s.id = s.id || ('os_' + Date.now() + '_' + Math.floor(Math.random()*1000));
    s.createdAt = s.createdAt || Date.now();
    s.status = s.status || 'pending';
    list.push(s);
    if(useFB()){ await window.fbdb.collection('settings').doc('order_subs').set({list}); }
    else { lsSaveOrderSubs(list); }
    return s;
  }
  async function updateOrderSub(id, patch){
    const list = await getOrderSubs();
    const i = list.findIndex(r => r.id === id);
    if(i === -1) return null;
    list[i] = Object.assign({}, list[i], patch);
    if(useFB()){ await window.fbdb.collection('settings').doc('order_subs').set({list}); }
    else { lsSaveOrderSubs(list); }
    return list[i];
  }
  function onOrderSubs(cb){
    if(useFB()){
      return window.fbdb.collection('settings').doc('order_subs').onSnapshot(doc => {
        cb((doc.exists && Array.isArray(doc.data().list)) ? doc.data().list : []);
      });
    }
    cb(lsOrderSubs());
    const handler = e => { if(e.key === 'order_subs') cb(lsOrderSubs()); };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }

  // توليد رمز رابط فريد (token)
  function genToken(){
    return 'f' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
  }

  // توليد كود تفعيل من 6 أرقام
  function genActivationCode(){
    return String(Math.floor(100000 + Math.random()*900000));
  }
  // مدة صلاحية كود التفعيل (بالملي ثاني) — 24 ساعة من وقت الموافقة/التوليد
  const ACTIVATION_CODE_TTL = 24 * 60 * 60 * 1000;
  // هل انتهت صلاحية الكود؟ (يعتمد على codeIssuedAt)
  function isCodeExpired(req){
    if(!req || !req.codeIssuedAt) return false;   // طلبات قديمة بلا طابع زمني: لا تنتهي
    return (Date.now() - req.codeIssuedAt) > ACTIVATION_CODE_TTL;
  }

  // =================== القائمة (MENU) ===================
  async function getMenu(){
    if(useFB()){
      try{
        const doc = await withTimeout(window.fbdb.collection('settings').doc('menu').get(), 5000);
        if(doc.exists && Array.isArray(doc.data().items)) return doc.data().items;
        window.fbdb.collection('settings').doc('menu').set({items: DEFAULT_MENU}).catch(()=>{});
        return DEFAULT_MENU.slice();
      }catch(e){
        console.warn('[DB] تعذر جلب القائمة من السحابة، استخدام الافتراضي:', e.message);
        return DEFAULT_MENU.slice();
      }
    }
    return lsMenu();
  }
  async function saveMenu(menu){
    if(useFB()){
      await window.fbdb.collection('settings').doc('menu').set({items: menu});
    } else {
      lsSaveMenu(menu);
    }
  }
  function onMenu(cb){
    if(useFB()){
      return window.fbdb.collection('settings').doc('menu').onSnapshot(doc => {
        if(doc.exists && Array.isArray(doc.data().items)) cb(doc.data().items);
      });
    }
    // التخزين المحلي: استمع للتغييرات من التبويبات الأخرى
    const handler = e => { if(e.key === 'menu') cb(lsMenu()); };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }

  // =================== الطلبات (ORDERS) ===================
  async function addOrder(order){
    order.createdAt = order.createdAt || Date.now();
    if(useFB()){
      await window.fbdb.collection('orders').doc(order.id).set(order);
    } else {
      const o = lsOrders(); o.push(order); lsSaveOrders(o);
    }
  }
  async function getOrders(){
    if(useFB()){
      let q = window.fbdb.collection('orders');
      if(DATA_SAVER.enabled){ q = q.where('createdAt','>=', dsCutoff()); }  // توفير البيانات: الحديثة فقط
      const snap = await q.orderBy('createdAt','asc').get();
      return snap.docs.map(d => d.data());
    }
    return lsOrders();
  }
  async function updateOrderStatus(id, status){
    if(useFB()){
      await window.fbdb.collection('orders').doc(id).update({status});
    } else {
      const o = lsOrders(); const t = o.find(x => x.id === id);
      if(t){ t.status = status; lsSaveOrders(o); }
    }
  }
  async function updateOrder(id, patch){
    if(useFB()){
      await window.fbdb.collection('orders').doc(id).update(patch);
    } else {
      const o = lsOrders(); const t = o.find(x => x.id === id);
      if(t){ Object.assign(t, patch); lsSaveOrders(o); }
    }
  }
  async function deleteOrder(id){
    if(useFB()){
      await window.fbdb.collection('orders').doc(id).delete();
    } else {
      lsSaveOrders(lsOrders().filter(o => o.id !== id));
    }
  }
  // رقم الطلب التسلسلي التالي (يبدأ من 1)
  async function nextOrderNo(){
    try{
      // في السحابة: نقرأ أعلى رقم طلب بمستند واحد فقط (توفير قراءات) بدل جلب كل الطلبات
      if(useFB()){
        const snap = await withTimeout(
          window.fbdb.collection('orders').orderBy('orderNo','desc').limit(1).get(), 5000);
        let mx = 0;
        if(!snap.empty){ mx = Number(snap.docs[0].data().orderNo) || 0; }
        const n = mx + 1;
        try{ localStorage.setItem('order_seq', String(n)); }catch(e){}
        return n;
      }
      const orders = await getOrders();
      const mx = (orders || []).reduce((m,o) => Math.max(m, Number(o.orderNo) || 0), 0);
      const n = mx + 1;
      try{ localStorage.setItem('order_seq', String(n)); }catch(e){}
      return n;
    }catch(e){
      // عند تعذر الجلب: عداد محلي احتياطي
      let n = parseInt(localStorage.getItem('order_seq') || '0', 10) || 0;
      n++; try{ localStorage.setItem('order_seq', String(n)); }catch(e2){}
      return n;
    }
  }
  async function clearOrders(){
    if(useFB()){
      const snap = await window.fbdb.collection('orders').get();
      const batch = window.fbdb.batch();
      snap.docs.forEach(d => batch.delete(d.ref));
      await batch.commit();
    } else {
      lsSaveOrders([]);
    }
  }
  // حذف الطلبات الأقدم من وقت معيّن (للمحو التلقائي) — يعيد عدد المحذوف
  async function purgeOrdersBefore(cutoffMs){
    cutoffMs = Number(cutoffMs) || 0;
    let removed = 0;
    if(useFB()){
      const snap = await window.fbdb.collection('orders').where('createdAt','<',cutoffMs).get();
      if(snap.empty) return 0;
      let batch = window.fbdb.batch(); let n = 0;
      for(const d of snap.docs){
        batch.delete(d.ref); removed++; n++;
        if(n >= 400){ await batch.commit(); batch = window.fbdb.batch(); n = 0; }
      }
      if(n > 0) await batch.commit();
    } else {
      const all = lsOrders();
      const keep = all.filter(o => (Number(o.createdAt) || 0) >= cutoffMs);
      removed = all.length - keep.length;
      lsSaveOrders(keep);
    }
    return removed;
  }
  function onOrders(cb){
    if(useFB()){
      let q = window.fbdb.collection('orders');
      if(DATA_SAVER.enabled){ q = q.where('createdAt','>=', dsCutoff()); }  // توفير البيانات: الحديثة فقط
      return q.orderBy('createdAt','asc')
        .onSnapshot(snap => cb(snap.docs.map(d => d.data())));
    }
    cb(lsOrders());
    const handler = e => { if(e.key === 'orders') cb(lsOrders()); };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }

  // =================== الدردشة الداخلية (CHAT) ===================
  // مجموعة Firestore حقيقية 'chat_messages' (تدعم الزمن الفعلي)، وبديل محلي.
  // رسالة: {id, user, name, type:'text'|'image'|'voice'|'call', text, data(dataURL), dur, createdAt}
  function lsChat(){ try{ return JSON.parse(localStorage.getItem('chat_messages')||'[]'); }catch(e){ return []; } }
  function lsSaveChat(a){ try{ localStorage.setItem('chat_messages', JSON.stringify(a.slice(-300))); }catch(e){} }
  // مشتركون محليون (نفس الصفحة) حتى تتحدّث الواجهة فوراً في وضع localStorage
  const _chatSubs = [];
  function notifyChatSubs(){ const data = lsChat().slice(-200); _chatSubs.forEach(fn => { try{ fn(data); }catch(e){} }); }
  async function getChatMessages(limit){
    limit = limit || 200;
    if(useFB()){
      try{
        const snap = await withTimeout(window.fbdb.collection('chat_messages').orderBy('createdAt','desc').limit(limit).get(), 5000);
        return snap.docs.map(d => d.data()).reverse();
      }catch(e){ console.warn('[DB] تعذر جلب الرسائل:', e.message); return []; }
    }
    return lsChat().slice(-limit);
  }
  async function addChatMessage(msg){
    msg.id = msg.id || ('m_' + Date.now() + '_' + Math.floor(Math.random()*1e5));
    msg.createdAt = msg.createdAt || Date.now();
    if(useFB()){ await window.fbdb.collection('chat_messages').doc(msg.id).set(msg); }
    else { const a = lsChat(); a.push(msg); lsSaveChat(a); notifyChatSubs(); }
    return msg;
  }
  function onChatMessages(cb, limit){
    limit = limit || 200;
    if(useFB()){
      return window.fbdb.collection('chat_messages').orderBy('createdAt','desc').limit(limit)
        .onSnapshot(snap => cb(snap.docs.map(d => d.data()).reverse()));
    }
    cb(lsChat().slice(-limit));
    _chatSubs.push(cb);
    const handler = e => { if(e.key === 'chat_messages') cb(lsChat().slice(-limit)); };
    window.addEventListener('storage', handler);
    return () => { const i = _chatSubs.indexOf(cb); if(i>=0) _chatSubs.splice(i,1); window.removeEventListener('storage', handler); };
  }
  async function clearChat(){
    if(useFB()){
      const snap = await window.fbdb.collection('chat_messages').get();
      let batch = window.fbdb.batch(), n = 0;
      for(const d of snap.docs){ batch.delete(d.ref); if(++n>=400){ await batch.commit(); batch = window.fbdb.batch(); n=0; } }
      if(n>0) await batch.commit();
    } else { lsSaveChat([]); notifyChatSubs(); }
  }
  // حذف رسائل الدردشة الأقدم من وقت معيّن (للتنظيف التلقائي) — يعيد عدد المحذوف
  async function purgeChatBefore(cutoffMs){
    cutoffMs = Number(cutoffMs) || 0;
    let removed = 0;
    if(useFB()){
      const snap = await window.fbdb.collection('chat_messages').where('createdAt','<',cutoffMs).get();
      if(snap.empty) return 0;
      let batch = window.fbdb.batch(); let n = 0;
      for(const d of snap.docs){
        batch.delete(d.ref); removed++; n++;
        if(n >= 400){ await batch.commit(); batch = window.fbdb.batch(); n = 0; }
      }
      if(n > 0) await batch.commit();
    } else {
      const all = lsChat();
      const keep = all.filter(m => (Number(m.createdAt) || 0) >= cutoffMs);
      removed = all.length - keep.length;
      if(removed > 0){ lsSaveChat(keep); notifyChatSubs(); }
    }
    return removed;
  }

  return {
    isCloud: useFB,
    fb: () => (useFB() ? window.fbdb : null),
    PERM_KEYS,
    getMenu, saveMenu, onMenu,
    getSettings, saveSettings, onSettings,
    getUsers, saveUsers, onUsers,
    addOrder, getOrders, updateOrderStatus, updateOrder, deleteOrder, clearOrders, onOrders, nextOrderNo,
    purgeOrdersBefore,
    setDataSaver,
    getSignupRequests, addSignupRequest, updateSignupRequest, deleteSignupRequest, onSignupRequests, genActivationCode, isCodeExpired, ACTIVATION_CODE_TTL,
    getActivityLog, addActivity, clearActivityLog, onActivityLog,
    getCustForms, addCustForm, updateCustForm, deleteCustForm, onCustForms, getCustFormByToken,
    getOrderForms, addOrderForm, getOrderFormByToken, updateOrderForm, deleteOrderForm, onOrderForms,
    getOrderSubs, addOrderSub, updateOrderSub, onOrderSubs, genToken,
    // ===== الدردشة والمكالمات =====
    getChatMessages, addChatMessage, onChatMessages, clearChat, purgeChatBefore
  };
})();

// تصدير DB على النطاق العام (window) حتى تصل إليه السكربتات الأخرى مثل features.js
try{ window.DB = DB; }catch(e){}
