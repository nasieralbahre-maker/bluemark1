# BMS SY — نظام كاشير (POS) لحلويات العلامة الزرقاء

نظام كاشير (نقطة بيع) متكامل لـ **حلويات العلامة الزرقاء**، يعمل كتطبيق سطح مكتب (Electron) وتطبيق ويب تقدمي (PWA) مع مزامنة عبر Firebase/Firestore.

## الميزات
- 🧾 إنشاء طلبات (محلي / سفري / توصيل) مع أصناف، خصومات، مدفوع/متبقي.
- 👥 إدارة العملاء والمتبقي.
- 📊 لوحة تحكم (طلبات، إحصائيات، مستخدمون، إعدادات).
- 💰 **مصاريفي**: طلبات مصاريف (SAR/YER) + اعتماد صرف (كامل/جزئي) + رفض + إعادة للمراجعة + إشعارات + تأكيد استلام + تقارير (أسبوعي/شهري/سنوي/مخصص) + تصدير PDF.
- 🖨️ إعدادات طابعة (A4: موضع الفاتورة يمين/وسط/يسار + هوامش لكل خيار + شعار دائري + QR جانبي + معاينة حية).
- 🎨 شكل نظام: قديم / جديد (جذاب).
- 💬 دردشة ومكالمات بين المستخدمين (WebRTC).
- 🔄 مركز تحديث وترقية.
- 📱 PWA (يعمل بدون إنترنت) + إشعارات.

## المتطلبات
- Node.js 18+
- npm

## تشغيل محلي (ويب)
```bash
# أي خادم ثابت، مثلاً:
npx serve .
# أو
node server.js
```
ثم افتح `http://localhost:3000`.

## تشغيل كتطبيق سطح مكتب (Electron)
```bash
npm install
npm start
```

## بناء تطبيق Windows (.exe)
```bash
npm run dist:portable     # نسخة محمولة
npm run dist:installer    # مثبت NSIS
```
الناتج في مجلد `dist/`.

## إعداد Firebase
1. أنشئ مشروع Firebase (Firestore).
2. انسخ `firebase-config.js` وأدخل قيمك (apiKey, projectId, ...).
3. في Firebase Console → Firestore → Rules، الصق محتوى `firestore.rules`.
4. (اختياري) لتفعيل PWA Offline، احفظ `sw.js`.

## إعدادات Netlify
- `netlify.toml` موجود (publish = ".", no-cache لـ HTML/JS/JSON).
- انشر المجلد (Drag & Drop أو `netlify deploy --prod --dir .`).

## هيكل المشروع
```
index.html          # شاشة الكاشير
admin.html          # لوحة التحكم
dashboard.html      # لوحة المدير
brand.html / order.html / track.html
app.js              # منطق الكاشير
admin.js            # منطق لوحة التحكم
db.js               # طبقة البيانات (Firestore/localStorage)
expenses.js         # واجهة المستخدم (مصاريفي)
expenses-admin.js   # إدارة المصاريف + تقارير + PDF
printer.js          # محرّك طباعة POS
updater.js          # مركز التحديث
features.js, tasks.js, mobile.js, dashboard.js
styles.css, brand.css, dashboard.css
netlify.toml, firestore.rules, manifest.json, sw.js
```

## الترخيص
MIT — انظر `package.json`.