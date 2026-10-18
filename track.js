/* =====================================================================
   track.js — صفحة تتبّع الطلب العامة (دون تسجيل دخول)
   تقرأ ?t=token ثم تعرض السجل المرتبط بنفس الرمز
   (استمارة → طلب → فاتورة) مع الحالة ورقم الطلب.
   خصوصية: لا تُعرض المبالغ المالية في الصفحة العامة.
   ===================================================================== */
(function(){
  'use strict';

  function $(id){ return document.getElementById(id); }
  function esc(s){ return String(s==null?'':s).replace(/[&<>"']/g, function(c){ return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]; }); }
  function showOnly(id){ ['loadingState','errorState','recState'].forEach(function(x){ var el=$(x); if(el) el.classList.toggle('hidden', x!==id); }); }
  function fail(msg){ if(msg) $('errMsg').textContent=msg; showOnly('errorState'); }

  function token(){
    try{ return new URLSearchParams(location.search).get('t')||''; }
    catch(e){ var m=location.search.match(/[?&]t=([^&]+)/); return m?decodeURIComponent(m[1]):''; }
  }

  function waitReady(cb){
    var tries=0;
    (function loop(){
      tries++;
      if(typeof DB!=='undefined' && DB.getCustFormByToken){ cb(); return; }
      if(tries>60){ fail('تعذر الاتصال بالخادم. تحقق من الإنترنت ثم أعد المحاولة.'); return; }
      setTimeout(loop, 250);
    })();
  }

  var STATUS_LABEL={ pending:'⏳ بانتظار المصادقة', approved:'✅ تم تحويله إلى طلب رسمي', expired:'⌛ انتهت صلاحية الاستمارة' };
  var PREP_LABEL={ pending:'بانتظار التنفيذ', confirmed:'قيد التنفيذ', ready:'جاهز للاستلام' };

  function render(form, order, brand){
    if(brand) $('brandName').textContent=brand;
    var st=form.status||'pending';
    if(st==='pending' && form.expiresAt && Date.now()>form.expiresAt) st='expired';
    var box=$('statusBox');
    box.className='status st-'+st;
    box.textContent=STATUS_LABEL[st]||STATUS_LABEL.pending;

    var no=form.orderNo||(order&&order.orderNo)||'';
    if(st==='approved' && no){ $('orderNoBox').classList.remove('hidden'); $('orderNo').textContent='#'+no; }
    else { $('orderNoBox').classList.add('hidden'); }

    var h='';
    h+='<div class="row"><b>العميل</b><span>'+(esc(form.name)||'—')+'</span></div>';
    if(form.phone) h+='<div class="row"><b>الجوال</b><span>'+esc(form.phone)+'</span></div>';
    if(order && order.prep && PREP_LABEL[order.prep]){
      h+='<div class="row"><b>حالة التحضير</b><span>'+esc(PREP_LABEL[order.prep])+'</span></div>';
    }
    if(form.pickupDate||form.pickupTime){
      h+='<div class="row"><b>موعد الاستلام</b><span>'+esc(form.pickupDate||'')+' '+esc(form.pickupTime||'')+'</span></div>';
    }
    if(form.theme){
      h+='<div class="row"><b>الثيم</b><span>مع ثيم'+(form.occ?(' — '+esc(form.occ)):'')+'</span></div>';
    }
    var items=(form.items||(order&&order.items)||[]);
    if(items.length){
      h+='<div class="sec-title">🧾 الأصناف</div><div class="items">';
      items.forEach(function(i){ h+='<div class="it"><span>'+((i.emoji||'')+' '+esc(i.name))+'</span><span>×'+(i.qty||1)+'</span></div>'; });
      h+='</div>';
    }
    $('detailsBox').innerHTML=h;
    showOnly('recState');
  }

  function run(){
    var t=token();
    if(!t){ fail('رابط غير صالح — لا يوجد رمز طلب.'); return; }
    waitReady(function(){
      var brand=''; var order=null; var oform=null; var osub=null;
      var pBrand=(DB.getSettings?DB.getSettings():Promise.resolve(null)).then(function(s){
        if(s) brand=(s.headerBrand||s.name||'');
      }).catch(function(){});
      // الطلب الرسمي بنفس الرمز (اختياري — قد تمنعه قواعد Firestore)
      var pOrder=(DB.getOrders?DB.getOrders():Promise.resolve([])).then(function(list){
        order=(list||[]).find(function(x){ return x && String(x.formToken||'')===t; })||null;
      }).catch(function(){});
      // استمارة الطلب الخارجية وطلبات العملاء (اختياري)
      var pForm=(DB.getOrderFormByToken?DB.getOrderFormByToken(t):Promise.resolve(null)).then(function(f){ oform=f||null; }).catch(function(){});
      var pSubs=(DB.getOrderSubs?DB.getOrderSubs():Promise.resolve([])).then(function(list){
        var mine=(list||[]).filter(function(s){ return s && String(s.token||'')===t; });
        mine.sort(function(a,b){ return (b.createdAt||0)-(a.createdAt||0); });
        osub=mine[0]||null;
      }).catch(function(){});
      Promise.all([pBrand,pOrder,pForm,pSubs]).then(function(){
        DB.getCustFormByToken(t).then(function(cform){
          var form=cform;
          if(!form && order){
            form={ name:order.name, phone:order.phone, status:'approved', orderNo:order.orderNo, items:order.items, pickupDate:order.pickupDate, pickupTime:order.pickupTime, theme:order.theme, occ:(order.themeData&&order.themeData.occasion)||'' };
          }
          if(!form && osub){
            form={ name:osub.name, phone:osub.phone, status:(osub.status==='approved'?'approved':'pending'), orderNo:osub.orderNo, items:osub.items, pickupDate:osub.pickupDate, pickupTime:osub.pickupTime, theme:osub.theme, occ:(osub.themeData&&osub.themeData.occasion)||'' };
          }
          if(!form && oform){
            // استمارة خارجية نشطة بلا طلب بعد — اعرض رابط التعبئة
            renderOpenForm(oform, brand, t); return;
          }
          if(!form){ fail('تعذر العثور على سجل لهذا الرمز. ربما حُذفت الاستمارة.'); return; }
          render(form, order, brand);
        }).catch(function(){ fail('تعذر جلب السجل. حاول لاحقاً.'); });
      });
    });
  }

  function renderOpenForm(oform, brand, t){
    if(brand) $('brandName').textContent=brand;
    var box=$('statusBox'); box.className='status st-pending';
    box.textContent='🟢 استمارة الطلب نشطة';
    $('orderNoBox').classList.add('hidden');
    var link='order.html?f='+encodeURIComponent(t);
    var h='<div class="row"><b>'+esc(oform.title||'استمارة طلب')+'</b><span></span></div>';
    if(oform.note) h+='<div class="row"><span class="muted">'+esc(oform.note)+'</span></div>';
    h+='<div class="center" style="margin-top:12px;"><a href="'+esc(link)+'" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;padding:11px 18px;border-radius:11px;font-weight:800;">📝 افتح استمارة الطلب</a></div>';
    $('detailsBox').innerHTML=h;
    showOnly('recState');
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', run);
  else run();
})();
