/* ============================================================
   BMSPrinter — محرّك إعدادات طابعة الكاشير الحرارية (POS 58/80mm)
   - تُحفظ الإعدادات محلياً على الجهاز (localStorage) لأنها خاصة بكل طابعة.
   - يُنتج CSS طباعة ديناميكي (@page + .bmsreceipt) يعالج:
       • الورق الفارغ الطويل قبل/بعد الفاتورة (margin:0 + size:العرض auto).
       • ظهور الفاتورة في النصف الأيمن فقط (ضبط العرض = عرض الورق).
   مستقل تماماً عن طريقة الاتصال بالطابعة وعن قاعدة Firebase.
   ============================================================ */
(function(){
  var KEY = 'bms_printer_cfg';
  var VERSION = 2;           // لترقية الإعدادات القديمة المحفوظة إلى الافتراضي الموصى به (طابعة POS 80mm)
  var defaults = {
    _v: VERSION,             // إصدار الإعدادات
    paperWidth: 80,          // عرض الورق (مم) — حرّ (مثال 58/60/72/80مم أو أي قيمة)
    paperHeight: 0,          // ارتفاع الورق (مم)؛ 0 = تلقائي (يقص بعد آخر سطر)
    a4Mode: 'auto',           // 'auto' = ورقة A4 على الجوال تلقائياً · 'on' = دائماً A4 · 'off' = دائماً شريط POS
    marginTop: 0,            // مم
    marginBottom: 0,         // مم
    marginSide: 2,           // مم
    fontSize: 12,            // px
    scale: 100,              // تصغير حجم الفاتورة كاملاً (نسبة مئوية 30–150)
    elementSizes: {},        // مقاس كل نص في الفاتورة بالمقارنة مع الافتراضي { 'rf-name': 20, ... }
    logoSize: 60,            // مقاس الشعار الدائري بالبكسل
    fontFamily: 'cairo',     // cairo | tahoma | monospace
    align: 'center',         // right | center | left
    logoSide: false,          // شعار دائري على يسار الفاتورة (بجانب بيانات المنشأة)
    qrSide: false,           // رمز QR على يمين الفاتورة (بجانب بياناته)
    defaultPrinter: '',      // اسم الطابعة الافتراضية (للجسر الأصلي/للتذكير)
    copies: 1,               // عدد النسخ
    silent: true,           // طباعة مباشرة دون معاينة (إن دعمها الجهاز)
    autoCut: true,          // قطع تلقائي بعد الطباعة (دعم أصلي)
    cashDrawer: false,      // فتح درج النقود (دعم أصلي)
    feedLines: 0,           // تغذية أسطر بعد الطباعة
    qrSize: 120,            // حجم كود QR على الفاتورة (px)
    qrGap: 6,               // المسافة أعلى كود QR (px)
    lineGap: 4,             // المسافة بين كتل الفاتورة (px)
    colName: 0,             // عرض عمود الصنف (px)؛ 0 = مرن/تلقائي
    colQty: 22,             // عرض عمود الكمية (px)
    colPrice: 92,           // عرض عمود المبلغ (px)
    colClear: 18,           // تفراغ داخلي يسار الفاتورة (px) — يبعد المبلغ عن السكرول في الاتجاه RTL
    show: {
      logo:true, name:true, establishment:true,
      invoiceNo:true, date:true, customer:true, phone:true,
      items:true, qty:true, prices:true,
      total:true, discount:true, paid:true, remaining:true,
      signature:false, thankYou:true
    },
    thankYouText: 'شكراً لزيارتكم ⭐',
    signatureText: 'التوقيع: ..............................'
  };

  function clone(o){ return JSON.parse(JSON.stringify(o)); }
  function num(v,d){ var n=parseFloat(v); return isNaN(n)?d:n; }
  function esc(s){ return String(s==null?'':s).replace(/[&<>"]/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];}); }

  // ============================================================
  //  عناصر الفاتورة — لكل نص مفتاح (class) يمكن ضبط مقاسه
  //  الترتيب مهم: العناصر الأخص تُكتب بعد الأعمّ حتى تتغلّب عليها
  // ============================================================
  var ELEMENTS = [
    { key:'rf-name',      label:'اسم المنشأة (العنوان الرئيسي)', def:24 },
    { key:'r-tagline',    label:'الشعار النصي (تحت الاسم)',      def:12 },
    { key:'rf-estab',     label:'العنوان / الهاتف / الرقم الضريبي', def:12 },
    { key:'r-meta',       label:'بيانات الفاتورة (فاتورة/نوع/موعد)', def:12 },
    { key:'rf-invno',     label:'رقم الطلب',                     def:12 },
    { key:'rf-date',      label:'التاريخ',                        def:12 },
    { key:'rf-customer',  label:'اسم العميل',                     def:12 },
    { key:'rf-phone',     label:'رقم جوال العميل',                def:12 },
    { key:'rf-items',     label:'جدول الأصناف (رؤوس الأعمدة)',    def:12 },
    { key:'rf-qty',       label:'عمود الكمية',                    def:12 },
    { key:'rf-price',     label:'عمود المبلغ',                    def:12 },
    { key:'r-tot',        label:'أسطر الإجمالي',                   def:12 },
    { key:'rf-discount',  label:'الخصم',                          def:12 },
    { key:'rf-paid',      label:'المدفوع',                        def:12 },
    { key:'rf-total',     label:'الإجمالي (الخط الكبير)',          def:14 },
    { key:'rf-remaining', label:'المتبقي على العميل',              def:14 },
    { key:'r-foot',       label:'التذييل (أسفل الفاتورة)',         def:12 },
    { key:'r-user',       label:'اسم المستخدم (بجانب QR)',         def:11 },
    { key:'rf-signature', label:'التوقيع',                        def:12 },
    { key:'r-qr-cap',     label:'نص أسفل رمز QR',                 def:11 }
  ];
  function elemSize(cfg, el){
    var es = (cfg && cfg.elementSizes) ? cfg.elementSizes : {};
    var v = num(es[el.key], 0);
    if (v <= 0) v = el.def;
    return Math.max(5, Math.min(60, v));
  }

  function load(){
    try{
      var raw = localStorage.getItem(KEY);
      var d = clone(defaults);
      if(!raw) return d;
      var o = JSON.parse(raw) || {};
      var merged = Object.assign(d, o);
      merged.show = Object.assign(clone(defaults.show), (o.show||{}));
      // ترقية الإعدادات القديمة المحفوظة (قبل نظام الإصدارات) إلى الافتراضي الموصى به لطابعة 80mm
      if((parseInt(o._v,10)||0) < VERSION){
        merged._v = VERSION;
        merged.paperWidth = 80;
        merged.paperHeight = 0;
        merged.marginTop = 0;
        merged.marginBottom = 0;
        merged.marginSide = 2;
        merged.fontSize = 12;
        if(!merged.fontFamily) merged.fontFamily = 'cairo';
        merged.align = merged.align || 'center';
        merged.copies = merged.copies || 1;
        merged.feedLines = 0;
        if(merged.qrSize == null) merged.qrSize = 120;
        if(merged.qrGap == null) merged.qrGap = 6;
        if(merged.lineGap == null) merged.lineGap = 4;
        save(merged);
      }
      return merged;
    }catch(e){ return clone(defaults); }
  }
  function save(cfg){ try{ localStorage.setItem(KEY, JSON.stringify(cfg)); }catch(e){} }

  function fontStack(f){
    if(f==='tahoma') return "'Tahoma','Arial',sans-serif";
    if(f==='monospace') return "'Courier New','monospace'";
    return "'Cairo','Tahoma',sans-serif";
  }

  function fieldHideCss(cfg){
    var s = cfg.show || {}; var out = '';
    function hide(v, sel){ if(v===false){ out += sel+'{display:none!important;}'; } }
    hide(s.logo,          '.bmsreceipt .r-logo');
    hide(s.name,          '.bmsreceipt .rf-name');
    hide(s.establishment, '.bmsreceipt .rf-estab');
    hide(s.invoiceNo,     '.bmsreceipt .rf-invno');
    hide(s.date,          '.bmsreceipt .rf-date');
    hide(s.customer,      '.bmsreceipt .rf-customer');
    hide(s.phone,         '.bmsreceipt .rf-phone');
    hide(s.items,         '.bmsreceipt .rf-items');
    hide(s.qty,           '.bmsreceipt .rf-qty');
    hide(s.prices,        '.bmsreceipt .rf-price');
    hide(s.total,         '.bmsreceipt .rf-total');
    hide(s.discount,      '.bmsreceipt .rf-discount');
    hide(s.paid,          '.bmsreceipt .rf-paid');
    hide(s.remaining,     '.bmsreceipt .rf-remaining');
    hide(s.signature,     '.bmsreceipt .rf-signature');
    hide(s.thankYou,      '.bmsreceipt .rf-thanks');
    return out;
  }

  // CSS الطباعة الديناميكي — يُحلّ مشكلة الورق الفارغ والنصف الأيمن
  // عرض الورق الحرّ (مم) مع حدود منطقية
  function paperW(cfg){ var w = num(cfg.paperWidth,80); if(w<30) w=30; if(w>200) w=200; return w; }
  function paperH(cfg){ var h = num(cfg.paperHeight,0); if(h<0) h=0; if(h>2000) h=2000; return h; }

  // ---------- وضع A4: الفاتورة في وسط ورقة A4 (بين اليمين واليسار) ----------
  // على الجوال تُطبع الفواتير عادةً على ورق A4 (طابعة ليزر/منزلية)،
  // فالفاتورة الضيقة (80مم) تظهر ملتصقة بالحافة — لذلك نوسّطها أفقياً.
  function isMobileDevice(){
    var ua = navigator.userAgent || '';
    if(/Android|iPhone|iPad|iPod|Mobile|Silk|IEMobile|Opera Mini/i.test(ua)) return true;
    // iPadOS 13+
    if(navigator.platform === 'MacIntel' && (navigator.maxTouchPoints || 0) > 1) return true;
    return false;
  }
  function useA4(cfg){
    var m = cfg ? cfg.a4Mode : 'auto';
    if(m === true || m === 'on' || m === '1' || m === 1) return true;
    if(m === false || m === 'off' || m === '0' || m === 0) return false;
    return isMobileDevice();      // 'auto' → تلقائي حسب الجهاز
  }

  function buildPrintCss(cfg){
    cfg = cfg || load();
    var w  = paperW(cfg);
    var h  = paperH(cfg);
    var mt = num(cfg.marginTop,0), mb = num(cfg.marginBottom,0), ms = num(cfg.marginSide,2);
    var fs = num(cfg.fontSize,12);
    var ff = fontStack(cfg.fontFamily);
    var align = (cfg.align==='right'||cfg.align==='left') ? cfg.align : 'center';
    var clr = Math.max(0, num(cfg.colClear,18));  // تفراغ داخلي لليسار يبعد المبلغ عن سكرول RTL
    var a4 = useA4(cfg);
    // ===== معامل تصغير حجم الفاتورة (نسبة مئوية 30–150) =====
    // يُطبَّق على كل المقاسات معاً (العرض، الخط، المسافات، الأعمدة، QR) فيصغرالفاتورة كاملة
    var sc = Math.max(0.3, Math.min(1.5, num(cfg.scale,100) / 100));
    var wS  = w * sc;                       // عرض الفاتورة بعد التصغير (مم)
    var msS = ms * sc, clrS = clr * sc;     // الهوامش والتفراغ (مُصغَّرة)
    var fsS = fs * sc;                      // حجم الخط (مُصغَّر)
    var css = '';
    // تقييد عرض الفاتورة على عرض الورق حتى على الشاشة (يغطي طباعة WebView) ويمنع أي تجاوز للهامش
    css += '.bmsreceipt{width:'+wS+'mm!important;max-width:100%!important;box-sizing:border-box!important;overflow:hidden!important;}';
    // وضع A4: الصفحة بمقاس A4 والفاتورة (بعرضها الحقيقي 58/80مم) تُوسَّط بين اليمين واليسار
    // وضع POS: الصفحة بعرض الورق نفسه (58/80مم) بلا فراغات
    //   إن تكبير الفاتورة تجاوز عرض الورق نكبّر الصفحة أيضاً حتى لا يُقص المحتوى
    var pageW = Math.max(w, wS);
    css += a4
      ? '@page{size:A4 portrait;margin:0;}'
      : '@page{size:'+pageW+'mm '+(h>0?(h+'mm'):'auto')+';margin:0;}';
    css += '@media print{';
    css +=   'html{background:#fff!important;height:auto!important;}';
    if(a4){
      // --- ورقة A4: الفاتورة في الوسط بين اليمين واليسار، وتبقى في أعلى الورقة ---
      css +=   'body{visibility:visible!important;background:#fff!important;margin:0!important;box-sizing:border-box!important;'+
               'width:210mm!important;min-height:296mm!important;height:auto!important;padding:12mm 0 0 0!important;'+
               'display:flex!important;align-items:flex-start!important;justify-content:center!important;}';
      css +=   'body>*{display:none!important;}';
      css +=   '.bmsreceipt{display:block!important;visibility:visible!important;position:static!important;float:none!important;'+
               'width:'+wS+'mm!important;max-width:'+wS+'mm!important;box-sizing:border-box!important;flex:0 0 auto!important;'+
               'margin:0 auto!important;padding:0 '+msS+'mm 0 calc('+msS+'mm + '+clrS+'px)!important;'+
               'color:#000!important;background:#fff!important;font-family:'+ff+'!important;font-size:'+fsS+'px!important;'+
               'text-align:'+align+'!important;direction:rtl!important;overflow:hidden!important;overflow-wrap:anywhere!important;}';
    } else {
    // نخفي بالـ display:none (وليس visibility) حتى لا تشغل العناصر المخفية مساحة
    // → يمنع خروج ورق فارغ طويل ويجعل الطول = طول الفاتورة فقط (القص بعد آخر سطر)
    css +=   'body{visibility:visible!important;margin:0!important;padding:0!important;background:#fff!important;width:'+w+'mm!important;min-height:0!important;height:auto!important;}';
    css +=   'body>*{display:none!important;}';
    css +=   '.bmsreceipt{display:block!important;visibility:visible!important;position:static!important;float:none!important;'+
             'width:'+wS+'mm!important;max-width:'+wS+'mm!important;box-sizing:border-box!important;'+
             'margin:'+(mt*sc)+'mm auto '+(mb*sc)+'mm auto!important;padding:0 '+msS+'mm 0 calc('+msS+'mm + '+clrS+'px)!important;'+
             'color:#000!important;background:#fff!important;font-family:'+ff+'!important;font-size:'+fsS+'px!important;'+
             'text-align:'+align+'!important;direction:rtl!important;overflow:hidden!important;overflow-wrap:anywhere!important;}';
    css +=   '.bmsreceipt *{visibility:visible!important;}';
    css +=   '.bmsreceipt{page-break-inside:auto!important;break-inside:auto!important;page-break-after:avoid!important;break-after:avoid!important;}';
    css +=   '.bmsreceipt tr,.bmsreceipt td,.bmsreceipt th{page-break-inside:avoid!important;break-inside:avoid!important;}';
    css +=   '.bmsreceipt>*:last-child{margin-bottom:0!important;padding-bottom:0!important;margin-top:0!important;}';
    var qg = num(cfg.qrGap,6)*sc, qs = num(cfg.qrSize,120)*sc;
    css +=   '.bmsreceipt .r-qr{margin:0!important;padding:'+qg+'px 0 0 0!important;border-top:none!important;page-break-before:avoid!important;break-before:avoid!important;}';
    css +=   '.bmsreceipt .r-qr img{margin:0!important;width:'+qs+'px!important;height:'+qs+'px!important;}';
    css +=   '.bmsreceipt .r-qr-cap{margin:2px 0 0 0!important;}';
    var lg = num(cfg.lineGap,4)*sc;
    // أعمدة قابلة للضبط من الإعدادات: الصنف (0 = مرن)، الكمية، المبلغ — بعرض ثابت لا يتمدّد فيخرج السعر خارج الهامش
    var nameW = Math.max(0, num(cfg.colName,0))*sc;
    var qtyW  = Math.max(6,  num(cfg.colQty,22))*sc;
    var priceW= Math.max(20, num(cfg.colPrice,92))*sc;
    var nameCss = (nameW > 0) ? ('width:'+nameW+'px!important;') : ('width:auto!important;');
    css +=   '.bmsreceipt table{width:100%!important;border-collapse:collapse!important;table-layout:fixed!important;}';
    css +=   '.bmsreceipt table th:first-child,.bmsreceipt table td:first-child{'+nameCss+'text-align:right!important;}';
    css +=   '.bmsreceipt table th.c,.bmsreceipt table td.c{width:'+qtyW+'px!important;text-align:center!important;white-space:nowrap!important;}';
    css +=   '.bmsreceipt table th.l,.bmsreceipt table td.l{width:'+priceW+'px!important;text-align:left!important;word-break:break-all!important;}';
    // خيارات احتياطية متعددة لكسر الأرقام/الكلمات الطويلة — حتى تعمل على المتصفحات/WebView القديمة
    // التي لا تدعم overflow-wrap:anywhere
    css +=   '.bmsreceipt table td,.bmsreceipt table th{word-break:break-word!important;word-wrap:break-word!important;overflow-wrap:break-word!important;overflow-wrap:anywhere!important;white-space:normal!important;max-width:100%!important;}';
    css +=   '.bmsreceipt .r-tot{flex-wrap:wrap!important;}';
    css +=   '.bmsreceipt .r-tot span{word-break:break-all!important;word-wrap:break-word!important;overflow-wrap:anywhere!important;min-width:0!important;max-width:100%!important;}';
    css +=   '.bmsreceipt .r-line{margin-top:'+lg+'px!important;margin-bottom:'+lg+'px!important;}';
    css +=   '.bmsreceipt img.r-logo{max-width:'+(wS-msS*2-4)+'mm!important;}';
    css += '}';
    }
    // ===== مقاس كل نص في الفاتورة =====
    // خارج @media print حتى تظهر المقاسات في المعاينة الحية على الشاشة أيضاً
    for (var ei = 0; ei < ELEMENTS.length; ei++){
      var el = ELEMENTS[ei];
      var esz = elemSize(cfg, el) * sc;
      css += '.bmsreceipt .'+el.key+'{font-size:'+(Math.round(esz*10)/10)+'px!important;}';
    }
    // ضمان أن العنوان الرئيسي (h2 / اسم المنشأة) واضح وكبير حتى لو لم يضبط المستخدم مقاسه
    var h2sz = Math.max(18, Math.round(elemSize(cfg, ELEMENTS[0]) * sc * 10) / 10);
    css += '.bmsreceipt h2,.bmsreceipt .rf-name{font-size:'+h2sz+'px!important;}';
    // مقاس الشعار الدائري
    var lgS = Math.max(20, num(cfg.logoSize,60)) * sc;
    css += '.bmsreceipt .r-logo{width:'+(Math.round(lgS))+'px!important;height:'+(Math.round(lgS))+'px!important;max-width:'+(wS-msS*2-4)+'mm!important;}';
    css += fieldHideCss(cfg);
    return css;
  }

  function applyPrintCss(cfg){
    cfg = cfg || load();
    var st = document.getElementById('bmsPrinterStyle');
    if(!st){ st = document.createElement('style'); st.id = 'bmsPrinterStyle'; document.head.appendChild(st); }
    st.textContent = buildPrintCss(cfg);
    return cfg;
  }

  // ============================================================
  //  فاتورة تجريبية مطابقة لبنية الفاتورة الحقيقية تماماً
  //  (نفس الـ classes ونفس ترتيب الكتل) — تُستخدم للمعاينة الحية
  //  والطباعة التجريبية، فتظهر المقاسات مطبَّقة كما في الفاتورة الفعلية
  // ============================================================
  function sampleReceiptHtml(cfg){
    cfg = cfg || load();
    var e = esc;
    var items = [
      {n:'كيكة الشوكولاتة', q:1, p:45},
      {n:'تشيز كيك توت العليق', q:2, p:22},
      {n:'قطعة براوني', q:3, p:8}
    ];
    var rows = '';
    var subtotal = 0;
    items.forEach(function(it){
      var line = it.q*it.p; subtotal += line;
      rows += '<tr>'+
        '<td style="text-align:right">'+e(it.n)+'</td>'+
        '<td class="c rf-qty" style="text-align:center">'+it.q+'</td>'+
        '<td class="l rf-price" style="text-align:left">'+line.toFixed(2)+'</td>'+
      '</tr>';
    });
    var discount = 5, paid = 100, remaining = Math.max(0, subtotal - discount - paid);
    var html = '';

    // ===== الترويسة =====
    if(cfg.logoSide){
      html += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">' +
        '<div class="r-logo" style="flex:0 0 auto;border-radius:50%;background:#eef2ff;display:flex;align-items:center;justify-content:center;border:2px solid #1e3a8a">🧁</div>' +
        '<div style="flex:1;text-align:right">' +
          '<h2 class="rf-name" style="margin:0">حلويات العلامة الزرقاء</h2>' +
          '<div class="r-tagline rf-estab">أطيب الحلويات الطازجة</div>' +
          '<div class="r-sub rf-estab">الرياض – حي النخيل</div>' +
          '<div class="r-sub rf-estab">هاتف: 0501234567</div>' +
        '</div>' +
      '</div>';
    } else {
      html += '<div class="r-center">' +
        '<div class="r-logo" style="margin:0 auto;border-radius:50%;background:#eef2ff;display:flex;align-items:center;justify-content:center;border:2px solid #1e3a8a">🧁</div>' +
        '<h2 class="rf-name">حلويات العلامة الزرقاء</h2>' +
        '<div class="r-tagline rf-estab">أطيب الحلويات الطازجة</div>' +
        '<div class="r-sub rf-estab">الرياض – حي النخيل</div>' +
        '<div class="r-sub rf-estab">هاتف: 0501234567</div>' +
      '</div>';
    }
    html += '<div class="r-line" style="border-top:1px dashed #000;margin:4px 0"></div>';

    // ===== بيانات الطلب =====
    html += '<div class="r-meta">' +
      '<div>فاتورة</div>' +
      '<div class="rf-invno">رقم الطلب: #1024</div>' +
      '<div class="rf-date">التاريخ: 2026/10/17 · 11:05 م</div>' +
      '<div>النوع: محلي</div>' +
      '<div class="rf-customer">العميل: أحمد محمد</div>' +
      '<div class="rf-phone">الجوال: 0559876543</div>' +
      '<div>موعد الاستلام: 2026/10/18 · 05:00 م</div>' +
    '</div>';
    html += '<div class="r-line" style="border-top:1px dashed #000;margin:4px 0"></div>';

    // ===== جدول الأصناف =====
    html += '<table class="rf-items" style="width:100%;border-collapse:collapse">'+
            '<thead><tr>'+
              '<th style="text-align:right">الصنف</th>'+
              '<th class="c rf-qty" style="text-align:center">كمية</th>'+
              '<th class="l rf-price" style="text-align:left">المبلغ</th>'+
            '</tr></thead><tbody>'+rows+'</tbody></table>';
    html += '<div class="r-line" style="border-top:1px dashed #000;margin:4px 0"></div>';

    // ===== الإجماليات =====
    html += '<div class="r-tot" style="display:flex;justify-content:space-between"><span>المجموع الفرعي</span><span>'+subtotal.toFixed(2)+'</span></div>';
    html += '<div class="r-tot rf-discount" style="display:flex;justify-content:space-between"><span>الخصم</span><span>'+discount.toFixed(2)+'</span></div>';
    html += '<div class="r-tot big rf-total" style="display:flex;justify-content:space-between;font-weight:700"><span>الإجمالي</span><span>'+subtotal.toFixed(2)+' ر.س</span></div>';
    html += '<div class="r-line" style="border-top:1px dashed #000;margin:4px 0"></div>';

    // ===== الدفع =====
    html += '<div class="r-tot" style="display:flex;justify-content:space-between"><span>طريقة الدفع</span><span>نقد</span></div>';
    html += '<div class="r-tot rf-paid" style="display:flex;justify-content:space-between"><span>المدفوع</span><span>'+paid.toFixed(2)+'</span></div>';
    html += '<div class="r-tot big remain rf-remaining" style="display:flex;justify-content:space-between"><span>المتبقي على العميل</span><span>'+remaining.toFixed(2)+'</span></div>';

    // ===== التذييل =====
    html += '<div class="r-line" style="border-top:1px dashed #000;margin:4px 0"></div>';
    html += '<div class="r-foot">شكراً لزيارتكم ⭐<br/>نتمنى لكم وجبة شهية</div>';

    // ===== QR =====
    var _sampleCaption = '';
    try{
      var _parts = [];
      if(typeof RESTAURANT !== 'undefined' && RESTAURANT){
        if(RESTAURANT.footer) _parts.push(RESTAURANT.footer);
        if(RESTAURANT.devName) _parts.push('برمجة: ' + RESTAURANT.devName);
      }
      _sampleCaption = _parts.join(' · ');
    }catch(e){ _sampleCaption = ''; }
    var qrPlaceholder = '<div class="r-qr-img" style="width:70px;height:70px;background:#eef2ff;border:1px solid #1e3a8a;border-radius:8px;display:flex;align-items:center;justify-content:center;color:#1e3a8a">QR</div>';
    if(cfg.qrSide){
      html += '<div style="display:flex;align-items:center;gap:8px;margin:0;padding:0;justify-content:flex-end;">' +
        '<div class="r-user" style="flex:1;text-align:right;color:#444">امسح الكود لاستدعاء الطلب (' + e(_sampleCaption) + ')</div>' +
        qrPlaceholder +
      '</div>';
    } else {
      html += '<div class="r-qr" style="text-align:center;margin:0;padding:0;">' + qrPlaceholder +
        '<div class="r-qr-cap" style="color:#444;margin-top:2px">' + e(_sampleCaption) + '</div></div>';
    }

    if(cfg.show && cfg.show.signature===true){
      html += '<div class="rf-signature r-user" style="text-align:center;margin-top:10px">'+e(cfg.signatureText||defaults.signatureText)+'</div>';
    }
    return html;
  }

  // ============================================================
  //  المعاينة الحية — تُبنى بنفس بنية الفاتورة وتُطبَّق عليها
  //  CSS الطباعة نفسه، فيظهر كل شيء كما سيُطبع تماماً
  //  (ورقة A4 في الوسط أو شريط POS حسب الإعداد)
  // ============================================================
  function renderPreview(container, cfg){
    cfg = cfg || load();
    if(typeof container === 'string') container = document.querySelector(container);
    if(!container) return;

    var w  = paperW(cfg);
    var ms = num(cfg.marginSide,2);
    var fs = num(cfg.fontSize,12);
    var ff = fontStack(cfg.fontFamily);
    var align = (cfg.align==='right'||cfg.align==='left') ? cfg.align : 'center';
    var a4 = useA4(cfg);
    var sc = Math.max(0.3, Math.min(1.5, num(cfg.scale,100)/100));
    var wS = w * sc;

    var receipt = '<div id="receiptPreview" class="bmsreceipt" style="width:'+wS+'mm;max-width:100%;box-sizing:border-box;'+
      'padding:0 '+(ms*sc)+'mm;color:#000;background:#fff;direction:rtl;font-family:'+ff+';'+
      'font-size:'+(fs*sc)+'px;text-align:'+align+';">'+ sampleReceiptHtml(cfg) +'</div>';

    if(a4){
      container.innerHTML = '<div class="bmsprev bmsprev-a4" style="width:210mm;max-width:100%;min-height:296mm;box-sizing:border-box;'+
        'margin:0 auto;background:#fff;display:flex;align-items:flex-start;justify-content:center;'+
        'padding:12mm 0 0 0;overflow:auto;box-shadow:0 2px 12px rgba(0,0,0,.18);border:1px dashed #cbd5e1;">'+
        receipt + '</div>';
    } else {
      container.innerHTML = '<div class="bmsprev" style="width:'+wS+'mm;max-width:100%;box-sizing:border-box;'+
        'padding:4mm '+(ms*sc)+'mm;margin:0 auto;background:#fff;color:#000;direction:rtl;'+
        'font-family:'+ff+';font-size:'+(fs*sc)+'px;text-align:'+align+';'+
        'box-shadow:0 2px 12px rgba(0,0,0,.18);border-radius:4px;">'+ receipt +'</div>';
    }

    applyPrintCss(cfg);  // نفس CSS الذي سيُطبَّق عند الطباعة
    _attachSelect(container);
  }

  // النقر على أي عنصر في المعاينة → تحديده وإبلاغ الواجهة
  var _selectedEl = null;
  function _clearSel(){
    if(_selectedEl){
      _selectedEl.style.outline = '';
      _selectedEl.style.outlineOffset = '';
      _selectedEl = null;
    }
  }
  function _attachSelect(container){
    var prev = container.querySelector('.bmsprev');
    if(!prev) return;
    prev.addEventListener('click', function(e){
      _clearSel();
      var cur = e.target;
      var key = null;
      while(cur && cur !== prev){
        // نختار أدق عنصر مطابق (الأدق هو الأحدث في قائمة ELEMENTS)
        var best = -1;
        if(cur.className && typeof cur.className === 'string'){
          cur.className.split(/\s+/).forEach(function(c){
            ELEMENTS.forEach(function(el, i){
              if(el.key === c && i > best){ best = i; key = c; }
            });
          });
        }
        if(key) break;
        cur = cur.parentElement;
      }
      if(!key){ if(typeof window.bmsOnPreviewDeselect === 'function') window.bmsOnPreviewDeselect(); return; }
      _selectedEl = cur;
      cur.style.outline = '2px dashed #2563eb';
      cur.style.outlineOffset = '2px';
      if(typeof window.bmsOnPreviewSelect === 'function') window.bmsOnPreviewSelect(key);
    });
  }

  window.BMSPrinter = {
    KEY: KEY,
    defaults: defaults,
    load: load,
    save: save,
    fontStack: fontStack,
    buildPrintCss: buildPrintCss,
    applyPrintCss: applyPrintCss,
    sampleReceiptHtml: sampleReceiptHtml,
    renderPreview: renderPreview,
    ELEMENTS: ELEMENTS,
    elemSize: elemSize,
    useA4: useA4,
    isMobileDevice: isMobileDevice,
    _esc: esc,
    _num: num
  };
})();