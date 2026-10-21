/* ============================================================
   BMSPrinter — محرّك إعدادات طابعة الكاشير الحرارية (POS 58/80mm)
   - تُحفظ الإعدادات محلياً على الجهاز (localStorage) لأنها خاصة بكل طابعة.
   - يُنتج CSS طباعة ديناميكي (@page + #receipt) يعالج:
       • الورق الفارغ الطويل قبل/بعد الفاتورة (margin:0 + size:العرض auto).
       • ظهور الفاتورة في النصف الأيمن فقط (ضبط العرض = عرض الورق).
   مستقل تماماً عن طريقة الاتصال بالطابعة وعن قاعدة Firebase.
   ============================================================ */
(function(){
  var KEY = 'bms_printer_cfg';
  var VERSION = 2;
  var defaults = {
    _v: VERSION,
    paperWidth: 80,
    paperSize: 'thermal',    // 'thermal' | 'A4'
    paperHeight: 0,
    marginTop: 0,
    marginBottom: 0,
    marginSide: 2,
    fontSize: 12,
    fontFamily: 'cairo',
    align: 'center',
    logoSide: false,
    qrSide: false,
    defaultPrinter: '',
    copies: 1,
    silent: true,
    autoCut: true,
    cashDrawer: false,
    feedLines: 0,
    qrSize: 120,
    qrGap: 6,
    lineGap: 4,
    colName: 0,
    colQty: 20,
    colPrice: 58,
    colClear: 18,
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

  function load(){
    try{
      var raw = localStorage.getItem(KEY);
      var d = clone(defaults);
      if(!raw) return d;
      var o = JSON.parse(raw) || {};
      var merged = Object.assign(d, o);
      merged.show = Object.assign(clone(defaults.show), (o.show||{}));
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
    hide(s.logo,          '#receipt .r-logo, .bmsprev .r-logo');
    hide(s.name,          '#receipt .rf-name, .bmsprev .rf-name');
    hide(s.establishment, '#receipt .rf-estab, .bmsprev .rf-estab');
    hide(s.invoiceNo,     '#receipt .rf-invno, .bmsprev .rf-invno');
    hide(s.date,          '#receipt .rf-date, .bmsprev .rf-date');
    hide(s.customer,      '#receipt .rf-customer, .bmsprev .rf-customer');
    hide(s.phone,         '#receipt .rf-phone, .bmsprev .rf-phone');
    hide(s.items,         '#receipt .rf-items, .bmsprev .rf-items');
    hide(s.qty,           '#receipt .rf-qty, .bmsprev .rf-qty');
    hide(s.prices,        '#receipt .rf-price, .bmsprev .rf-price');
    hide(s.total,         '#receipt .rf-total, .bmsprev .rf-total');
    hide(s.discount,      '#receipt .rf-discount, .bmsprev .rf-discount');
    hide(s.paid,          '#receipt .rf-paid, .bmsprev .rf-paid');
    hide(s.remaining,     '#receipt .rf-remaining, .bmsprev .rf-remaining');
    hide(s.signature,     '#receipt .rf-signature, .bmsprev .rf-signature');
    hide(s.thankYou,      '#receipt .rf-thanks, .bmsprev .rf-thanks');
    return out;
  }

  function paperW(cfg){ var w = num(cfg.paperWidth,80); if(w<30) w=30; if(w>210) w=210; return w; }
  // عرض الورقة (A4 = 210mm) — للطباعة على ورق A4
  function pageW(cfg){ if(cfg && cfg.paperSize === 'A4') return 210; return paperW(cfg); }
  function paperH(cfg){ var h = num(cfg.paperHeight,0); if(h<0) h=0; if(h>2000) h=2000; return h; }

  function buildPrintCss(cfg){
    cfg = cfg || load();
    var pw = pageW(cfg);
    var rw = paperW(cfg);
    if(rw > pw) rw = pw;
    var h  = paperH(cfg);
    var mt = num(cfg.marginTop,0), mb = num(cfg.marginBottom,0), ms = num(cfg.marginSide,2);
    var fs = num(cfg.fontSize,12);
    var ff = fontStack(cfg.fontFamily);
    var align = (cfg.align==='right'||cfg.align==='left') ? cfg.align : 'center';
    var css = '';
    css += '#receipt{width:'+rw+'mm!important;max-width:100%!important;box-sizing:border-box!important;overflow:hidden!important;}';
    css += '@page{size:'+pw+'mm '+(h>0?(h+'mm'):'auto')+';margin:0;}';
    css += '@media print{';
    css +=   'html{background:#fff!important;height:auto!important;}';
    css +=   'body{visibility:visible!important;margin:0!important;padding:0!important;background:#fff!important;width:'+pw+'mm!important;min-height:0!important;height:auto!important;}';
    css +=   'body>*{display:none!important;}';
    var clr = Math.max(0, num(cfg.colClear,18));
    css +=   '#receipt{display:block!important;visibility:visible!important;position:static!important;float:none!important;'+
              'width:'+rw+'mm!important;max-width:'+rw+'mm!important;box-sizing:border-box!important;'+
             'margin:'+mt+'mm ' + (align==='center' && rw < pw ? 'auto' : '0') + ' '+mb+'mm ' + (align==='center' && rw < pw ? 'auto' : '0') + ' !important;padding:0 '+ms+'mm 0 calc('+ms+'mm + '+clr+'px)!important;'+
             'color:#000!important;background:#fff!important;font-family:'+ff+'!important;font-size:'+fs+'px!important;'+
             'text-align:'+align+'!important;direction:rtl!important;overflow:hidden!important;overflow-wrap:anywhere!important;}';
    css +=   '#receipt *{visibility:visible!important;}';
    css +=   '#receipt{page-break-inside:auto!important;break-inside:auto!important;page-break-after:avoid!important;break-after:avoid!important;}';
    css +=   '#receipt tr,#receipt td,#receipt th{page-break-inside:avoid!important;break-inside:avoid!important;}';
    css +=   '#receipt>*:last-child{margin-bottom:0!important;padding-bottom:0!important;margin-top:0!important;}';
    var qg = num(cfg.qrGap,6), qs = num(cfg.qrSize,120);
    css +=   '#receipt .r-qr{margin:0!important;padding:'+qg+'px 0 0 0!important;border-top:none!important;page-break-before:avoid!important;break-before:avoid!important;}';
    css +=   '#receipt .r-qr img{margin:0!important;width:'+qs+'px!important;height:'+qs+'px!important;}';
    css +=   '#receipt .r-qr-cap{margin:2px 0 0 0!important;}';
    var lg = num(cfg.lineGap,4);
    var nameW = Math.max(0, num(cfg.colName,0));
    // أعمدة مضغوطة: الرقم + الكمية + السعر تأخذ أقل مساحة ممكنة، والباقي لاسم الصنف
    var qtyW  = Math.min(26, Math.max(6,  num(cfg.colQty,20)));
    var priceW= Math.min(64, Math.max(24, num(cfg.colPrice,58)));
    var nameCss = (nameW > 0) ? ('width:'+nameW+'px!important;') : ('width:auto!important;');
    css +=   '#receipt table{width:100%!important;border-collapse:collapse!important;table-layout:fixed!important;}';
    css +=   '#receipt table th:first-child,#receipt table td:first-child{'+nameCss+'text-align:right!important;}';
    // عمود الرقم التسلسلي: عرض ثابت وهوامش مريحة (بعد قاعدة first-child كي لا يُلغى)
    css +=   '#receipt table th.rf-no,#receipt table td.rf-no{width:26px!important;min-width:26px!important;padding:2px 5px!important;text-align:center!important;white-space:nowrap!important;font-weight:800!important;}';
    // عمود اسم الصنف (العمود الثاني بعد الرقم): سطر واحد فقط
    css +=   '#receipt table th.rf-item-name,#receipt table td.rf-item-name{'+nameCss+'text-align:right!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important;word-break:normal!important;max-width:none!important;}';
    css +=   '#receipt table th.c,#receipt table td.c{width:'+qtyW+'px!important;text-align:center!important;white-space:nowrap!important;}';
    css +=   '#receipt table th.l,#receipt table td.l{width:'+priceW+'px!important;text-align:left!important;white-space:nowrap!important;word-break:normal!important;}';
    css +=   '#receipt table td,#receipt table th{word-break:break-word!important;word-wrap:break-word!important;overflow-wrap:break-word!important;overflow-wrap:anywhere!important;white-space:normal!important;max-width:100%!important;}';
    css +=   '#receipt .r-tot{flex-wrap:wrap!important;}';
    css +=   '#receipt .r-tot span{word-break:break-all!important;word-wrap:break-word!important;overflow-wrap:anywhere!important;min-width:0!important;max-width:100%!important;}';
    css +=   '#receipt .r-line{margin-top:'+lg+'px!important;margin-bottom:'+lg+'px!important;}';
    css +=   '#receipt img.r-logo{max-width:'+(rw-ms*2-4)+'mm!important;}';
    css += '}';
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

  // فاتورة تجريبية بنفس بنية الفاتورة الحقيقية (نفس الـ classes) للمعاينة/الطباعة التجريبية
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
    items.forEach(function(it, i){
      var line = it.q*it.p; subtotal += line;
      rows += '<tr>'+
        '<td class="rf-no">'+(i+1)+'</td>'+
        '<td class="rf-item-name" style="text-align:right">'+e(it.n)+'</td>'+
        '<td class="rf-qty" style="text-align:center">'+it.q+'</td>'+
        '<td class="rf-price" style="text-align:left">'+line.toFixed(2)+'</td>'+
      '</tr>';
    });
    var discount = 0, paid = 80, remaining = Math.max(0, subtotal - discount - paid);
    var html = '';
    if(cfg.logoSide){
      html += '<div data-drag="logo" style="display:flex;align-items:center;gap:8px;margin-bottom:4px;cursor:grab;user-select:none">' +
        '<div class="r-logo" style="flex:0 0 auto;font-size:26px">🧁</div>' +
        '<div style="flex:1;text-align:right">' +
          '<h2 class="rf-name" style="margin:0;font-size:16px;color:#1e3a8a">حلويات العلامة الزرقاء</h2>' +
          '<div class="rf-estab r-sub" style="color:#1e40af">أطيب الحلويات الطازجة</div>' +
          '<div class="rf-estab r-sub" style="color:#1e40af">الرياض – حي النخيل · هاتف: 0501234567</div>' +
        '</div>' +
      '</div>';
    } else {
      html += '<div class="r-logo" data-drag="logo" style="text-align:center;font-size:26px;cursor:grab;user-select:none">🧁</div>';
      html += '<h2 class="rf-name" style="text-align:center;margin:2px 0">حلويات العلامة الزرقاء</h2>';
      html += '<div class="rf-estab r-sub" style="text-align:center">أطيب الحلويات الطازجة</div>';
      html += '<div class="rf-estab r-sub" style="text-align:center">الرياض – حي النخيل · هاتف: 0501234567</div>';
    }
    html += '<div class="r-line" style="border-top:1px dashed #000;margin:4px 0"></div>';
    html += '<div class="rf-invno r-meta">رقم الطلب: #1024</div>';
    html += '<div class="rf-date r-meta">التاريخ: 2026/10/17 · 11:05 م</div>';
    html += '<div class="rf-customer r-meta">العميل: أحمد محمد</div>';
    html += '<div class="rf-phone r-meta">الجوال: 0559876543</div>';
    html += '<div class="r-line" style="border-top:1px dashed #000;margin:4px 0"></div>';
    html += '<table class="rf-items" style="width:100%;border-collapse:collapse">'+
            '<thead><tr>'+
              '<th class="rf-no">#</th>'+
              '<th class="rf-item-name" style="text-align:right">الصنف</th>'+
              '<th class="rf-qty" style="text-align:center">الكمية</th>'+
              '<th class="rf-price" style="text-align:left">السعر</th>'+
            '</tr></thead><tbody>'+rows+'</tbody></table>';
    html += '<div class="r-line" style="border-top:1px dashed #000;margin:4px 0"></div>';
    html += '<div class="rf-discount r-meta" style="display:flex;justify-content:space-between"><span>الخصم</span><span>'+discount.toFixed(2)+'</span></div>';
    html += '<div class="rf-total r-tot" style="display:flex;justify-content:space-between;font-weight:700;font-size:1.1em"><span>الإجمالي</span><span>'+subtotal.toFixed(2)+' ر.س</span></div>';
    html += '<div class="rf-paid r-tot" style="display:flex;justify-content:space-between;font-weight:800;font-size:1.1em"><span>المدفوع</span><span>'+paid.toFixed(2)+'</span></div>';
    html += '<div class="rf-remaining r-meta" style="display:flex;justify-content:space-between"><span>المتبقي</span><span>'+remaining.toFixed(2)+'</span></div>';
    html += '<div class="r-line" style="border-top:1px dashed #000;margin:4px 0"></div>';
    var _sampleCaption = '';
    try{
      var _parts = [];
      if(typeof RESTAURANT !== 'undefined' && RESTAURANT){
        if(RESTAURANT.footer) _parts.push(RESTAURANT.footer);
        if(RESTAURANT.devName) _parts.push('برمجة: ' + RESTAURANT.devName);
      }
      _sampleCaption = _parts.join(' · ');
    }catch(e){ _sampleCaption = ''; }
    var qrPlaceholder = '<div style="width:70px;height:70px;background:#eef2ff;border:1px solid #1e3a8a;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:11px;color:#1e3a8a">QR</div>';
    if(cfg.qrSide){
      html += '<div data-drag="qr" style="display:flex;align-items:center;gap:8px;margin-top:6px;border-top:1px dashed #000;padding-top:6px;cursor:grab;user-select:none">' +
        '<div style="flex:1;text-align:right;font-size:11px;color:#444">' + (esc ? esc(_sampleCaption) : _sampleCaption) + '</div>' +
        qrPlaceholder +
      '</div>';
    } else {
      html += '<div class="r-qr" data-drag="qr" style="text-align:center;margin-top:6px;padding-top:6px;border-top:1px dashed #000;cursor:grab;user-select:none">' + qrPlaceholder +
        '<div class="r-qr-cap" style="font-size:11px;color:#444;margin-top:2px">' + (esc ? esc(_sampleCaption) : _sampleCaption) + '</div></div>';
    }
    if(cfg.show && cfg.show.signature===true){
      html += '<div class="rf-signature r-user" style="text-align:center;margin-top:10px">'+e(cfg.signatureText||defaults.signatureText)+'</div>';
    }
    return html;
  }

  // تعبئة صندوق المعاينة على الشاشة بعرض/خط/محاذاة مطابقة للطباعة
  function renderPreview(container, cfg){
    cfg = cfg || load();
    if(typeof container==='string') container = document.querySelector(container);
    if(!container) return;
    var pw = pageW(cfg);
    var rw = paperW(cfg);
    if(rw > pw) rw = pw;
    var ms = num(cfg.marginSide,2);
    var fs = num(cfg.fontSize,12);
    var ff = fontStack(cfg.fontFamily);
    var align = (cfg.align==='right'||cfg.align==='left') ? cfg.align : 'center';
    var pad = (rw < pw && align === 'center') ? '4mm ' + ms + 'mm' : '4mm ' + ms + 'mm';
    container.innerHTML = '<div class="bmsprev" style="width:'+pw+'mm;max-width:100%;box-sizing:border-box;'+
      'padding:4mm '+ms+'mm;margin:0 auto;background:#f1f5f9;color:#000;direction:rtl;'+
      'font-family:'+ff+';font-size:'+fs+'px;text-align:'+align+';'+
      'box-shadow:0 2px 12px rgba(0,0,0,.18);border-radius:4px;position:relative;'+
      'display:flex;justify-content:'+(align==='right'?'flex-end':align==='left'?'flex-start':'center')+';">'+
      '<div style="width:'+rw+'mm;max-width:100%;background:#fff;padding:4mm '+ms+'mm;box-sizing:border-box;">'+ sampleReceiptHtml(cfg) +'</div></div>';
    applyPrintCss(cfg); // حتى ينعكس إخفاء الحقول على المعاينة أيضاً
    _attachDrag(container);
    _attachSelect(container);
  }

  // ===== سحب بالماوس داخل المعاينة الحية =====
  var _dragState = null;
  var _selectedEl = null;
  function _clearSel(){ if(_selectedEl){ _selectedEl.style.outline=''; _selectedEl.style.outlineOffset=''; _selectedEl=null; } }
  function _typeOf(el){
    if(!el || !el.className) return null;
    var c = ' ' + el.className + ' ';
    if(c.indexOf(' r-logo ')>=0) return 'logo';
    if(c.indexOf(' rf-name ')>=0) return 'name';
    if(c.indexOf(' rf-estab ')>=0) return 'estab';
    if(c.indexOf(' rf-invno ')>=0 || c.indexOf(' rf-date ')>=0 || c.indexOf(' rf-customer ')>=0 || c.indexOf(' rf-phone ')>=0 || c.indexOf(' r-meta ')>=0) return 'meta';
    if(c.indexOf(' rf-items ')>=0 || c.indexOf(' rf-qty ')>=0 || c.indexOf(' rf-price ')>=0) return 'items';
    if(c.indexOf(' r-tot ')>=0 || c.indexOf(' rf-total ')>=0 || c.indexOf(' rf-paid ')>=0 || c.indexOf(' rf-remaining ')>=0 || c.indexOf(' rf-discount ')>=0) return 'totals';
    if(c.indexOf(' r-qr ')>=0 || c.indexOf(' r-qr-cap ')>=0) return 'qr';
    if(c.indexOf(' r-foot ')>=0 || c.indexOf(' rf-thanks ')>=0 || c.indexOf(' r-dev ')>=0 || c.indexOf(' rf-signature ')>=0) return 'footer';
    if(c.indexOf(' r-line ')>=0) return 'line';
    return null;
  }
  function _attachSelect(container){
    var prev = container.querySelector('.bmsprev');
    if(!prev) return;
    prev.addEventListener('click', function(e){
      _clearSel();
      var cur = e.target;
      var type = null;
      while(cur && cur !== prev){
        type = _typeOf(cur);
        if(type){ break; }
        cur = cur.parentElement;
      }
      if(!type){ if(typeof window.bmsOnPreviewDeselect==='function') window.bmsOnPreviewDeselect(); return; }
      _selectedEl = cur;
      cur.style.outline = '2px dashed #2563eb';
      cur.style.outlineOffset = '2px';
      if(typeof window.bmsOnPreviewSelect === 'function') window.bmsOnPreviewSelect(type);
    });
  }
  // معالجات عامة (تُسجَّل مرة واحدة)
  if(!window.__bmsDragBound){
    window.__bmsDragBound = true;
    document.addEventListener('mousemove', function(e){
      if(!_dragState) return;
      _dragState.moved = true;
      var dx = e.clientX - _dragState.startX;
      _dragState.el.style.transform = 'translateX(' + dx + 'px)';
    });
    document.addEventListener('mouseup', function(e){
      if(!_dragState) return;
      var st = _dragState;
      _dragState = null;
      st.el.style.opacity = '';
      st.el.style.transform = '';
      if(!st.moved) return;
      var prev = st.el.closest('.bmsprev');
      if(!prev) return;
      var prevRect = prev.getBoundingClientRect();
      var elRect = st.el.getBoundingClientRect();
      var center = (elRect.left + elRect.width/2) - prevRect.left;
      var third = prevRect.width / 3;
      var newAlign = (center < third) ? 'right' : (center > 2*third) ? 'left' : 'center';
      var alignSel = document.getElementById('pAlign');
      if(alignSel && alignSel.value !== newAlign){
        alignSel.value = newAlign;
        alignSel.dispatchEvent(new Event('change', {bubbles:true}));
      }
    });
  }
  function _attachDrag(container){
    var prev = container.querySelector('.bmsprev');
    if(!prev) return;
    var items = prev.querySelectorAll('[data-drag]');
    items.forEach(function(el){
      el.addEventListener('mousedown', function(e){
        _dragState = { el: el, startX: e.clientX, moved: false };
        el.style.opacity = '0.6';
        e.preventDefault();
      });
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
    _esc: esc,
    _num: num
  };
})();
