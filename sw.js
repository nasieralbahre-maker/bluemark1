// Service Worker — تطبيق Sweets القابل للتثبيت (PWA)
// يوفّر: دعم العمل بدون إنترنت (app shell) + إشعارات النظام
// الاستراتيجية: network-first للطلبات المحلية (تفضيل أحدث نسخة عند الاتصال،
// والرجوع إلى النسخة المخزّنة عند انقطاع الشبكة).

var CACHE = 'sweets-pwa-v1';
var APP_SHELL = [
  './',
  './index.html',
  './styles.css',
  './brand.css',
  './dashboard.css',
  './manifest.json',
  './logo.png',
  './icon-192.png',
  './splash-bg.jpg'
];

self.addEventListener('install', function(e){
  self.skipWaiting();
  // تخزين مسبق للأصول الأساسية (دون فشل التثبيت إذا تعذّر أحدها)
  e.waitUntil(
    caches.open(CACHE).then(function(c){
      return Promise.all(APP_SHELL.map(function(u){
        return c.add(u).catch(function(){});
      }));
    })
  );
});

self.addEventListener('activate', function(e){
  e.waitUntil(
    caches.keys().then(function(keys){
      return Promise.all(keys.map(function(k){ if(k !== CACHE) return caches.delete(k); }));
    }).then(function(){ return self.clients.claim(); })
  );
});

// استقبال رسالة التحديث الفوري من الصفحة
self.addEventListener('message', function(e){
  if(e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', function(e){
  var req = e.request;
  if(req.method !== 'GET') return;                 // الطلبات غير GET تمرّ مباشرة
  var url = new URL(req.url);
  if(url.origin !== self.location.origin) return;  // اترك طلبات Firestore/CDN للشبكة

  // network-first: جرّب الشبكة أولاً، ثم خزّن النسخة، وعند الفشل ارجع للكاش
  e.respondWith(
    fetch(req).then(function(res){
      if(res && res.status === 200 && res.type === 'basic'){
        var copy = res.clone();
        caches.open(CACHE).then(function(c){ c.put(req, copy); });
      }
      return res;
    }).catch(function(){
      return caches.match(req).then(function(cached){
        if(cached) return cached;
        // للتنقل (صفحات HTML): أرجِع الصفحة الرئيسية المخزّنة كاحتياط
        if(req.mode === 'navigate') return caches.match('./index.html');
        return undefined;
      });
    })
  );
});

// عند النقر على الإشعار: ركّز نافذة التطبيق إن كانت مفتوحة وإلا افتحها.
self.addEventListener('notificationclick', function(e){
  e.notification.close();
  e.waitUntil(
    self.clients.matchAll({ type:'window', includeUncontrolled:true }).then(function(list){
      for(var i=0;i<list.length;i++){
        var c = list[i];
        if('focus' in c) return c.focus();
      }
      if(self.clients.openWindow) return self.clients.openWindow('./index.html');
    })
  );
});
