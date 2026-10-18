// ============================================================
//  إعدادات Firebase
//  املأ القيم التالية من:
//  Firebase Console ← Project Settings ← Your apps ← SDK setup
// ============================================================
const firebaseConfig = {
  apiKey:            "AIzaSyCI4V7IY-LkXJJsJaU7SPygTUbTt_qlR7o",
  authDomain:        "bluemark-84a3d.firebaseapp.com",
  projectId:         "bluemark-84a3d",
  storageBucket:     "bluemark-84a3d.firebasestorage.app",
  messagingSenderId: "725477176538",
  appId:             "1:725477176538:web:29c52fd2d6e071b7d021e3"
};

// علم يحدد هل Firebase جاهز (يتم ضبطه تلقائياً)
window.FIREBASE_READY = false;

(function initFirebase(){
  // إذا لم تُضبط الإعدادات بعد ← العمل بالتخزين المحلي
  const notConfigured = !firebaseConfig.projectId ||
                        firebaseConfig.projectId.indexOf('YOUR_') === 0;
  if(notConfigured){
    console.warn('[Firebase] لم تُضبط الإعدادات بعد — يعمل النظام بالتخزين المحلي (localStorage).');
    return;
  }
  if(typeof firebase === 'undefined'){
    console.error('[Firebase] لم يتم تحميل Firebase SDK.');
    return;
  }
  try{
    firebase.initializeApp(firebaseConfig);
    window.fbdb = firebase.firestore();
    // ===== تخزين محلي تلقائي على الجهاز (Offline Persistence) =====
    // يحفظ البيانات (الأصناف/الطلبات/الإعدادات...) في ذاكرة الجهاز تلقائياً،
    // ويخدم القراءات من الكاش لتقليل استهلاك الاستضافة والعمل دون إنترنت.
    try{
      window.fbdb.enablePersistence({ synchronizeTabs: true }).then(function(){
        console.log('[Firebase] التخزين المحلي التلقائي مفعّل ✓');
      }).catch(function(err){
        console.warn('[Firebase] تعذّر تفعيل التخزين المحلي:', err && err.code);
      });
    }catch(e){ console.warn('[Firebase] persistence غير مدعوم:', e); }
    window.FIREBASE_READY = true;
    console.log('[Firebase] تم الاتصال بالسحابة ✓');
  }catch(e){
    console.error('[Firebase] فشل الاتصال:', e);
  }
})();
