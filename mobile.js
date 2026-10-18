// ============================================================
//  وضع تطبيق الجوال (Mobile App Mode)
//  يحوّل بطاقة الطلب إلى لوحة سفلية منزلقة على الشاشات الصغيرة
//  مع شريط سفلي يعرض عدد الأصناف والإجمالي.
//  غير مؤثر نهائياً على الشاشات الكبيرة (يظهر بـ CSS فقط عند الحاجة).
// ============================================================
(function () {
  var body = document.body;
  var cartBtn = document.getElementById('mobileCartBtn');
  var cnt = document.getElementById('mcbCount');
  var tot = document.getElementById('mcbTotal');
  var backdrop = document.getElementById('ticketBackdrop');
  var closeBtn = document.getElementById('ticketSheetClose');
  var itemsBox = document.getElementById('ticketItems');
  var grand = document.getElementById('grandTotal');

  function openSheet() { body.classList.add('ticket-open'); }
  function closeSheet() { body.classList.remove('ticket-open'); }

  if (cartBtn) cartBtn.addEventListener('click', openSheet);
  if (backdrop) backdrop.addEventListener('click', closeSheet);
  if (closeBtn) closeBtn.addEventListener('click', closeSheet);

  // مزامنة الشريط السفلي مع حالة الطلب
  function sync() {
    var n = 0;
    if (itemsBox) {
      var items = itemsBox.querySelectorAll('.t-item');
      for (var i = 0; i < items.length; i++) {
        var q = items[i].querySelector('.qty span');
        n += q ? (parseInt(q.textContent, 10) || 1) : 1;
      }
    }
    if (cnt) cnt.textContent = n;
    if (tot) tot.textContent = grand ? grand.textContent : '0';
    if (cartBtn) cartBtn.disabled = (n === 0);
    // أغلق اللوحة تلقائياً عند إفراغ الطلب (مثلاً بعد الدفع)
    if (n === 0) closeSheet();
  }

  if (itemsBox) {
    new MutationObserver(sync).observe(itemsBox, { childList: true, subtree: true, characterData: true });
  }
  if (grand) {
    new MutationObserver(sync).observe(grand, { childList: true, subtree: true, characterData: true });
  }

  // إغلاق اللوحة بزر الرجوع في الجوال
  window.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closeSheet();
  });

  sync();
})();
