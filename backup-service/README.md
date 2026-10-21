# BMS Backup Service — خدمة نسخ احتياطي تلقائي (SQLite)

خدمة Node.js تعمل على خادم/كمبيوتر (حتى عند إغلاق المتصفح) وتُصدِّر بيانات Firestore إلى ملف SQLite (.db) في `BACKUP_DIR`.

## الإعداد
1. ثبّت Node.js (LTS).
2. `cd backup-service && npm install`
3. Firebase Console → Service Accounts → Generate private key → `serviceAccountKey.json`.
4. شغّل: `node index.js` (أو `npm start`).
5. (اختياري) تثبيت كخدمة Windows: `npm install node-windows && node install-service.js`.

## متغيرات البيئة
- `BMS_SA_PATH` — مسار `serviceAccountKey.json` (افتراضي: `./serviceAccountKey.json`).
- `BMS_BACKUP_DIR` — مجلد حفظ النسخ (افتراضي: `./backups`).

## الجدولة
- تُقرأ من Firestore `settings/config.backupSchedule`:
  ```json
  { "enabled": true, "interval": "daily", "time": "02:00" }
  ```
- interval: `daily` / `weekly` / `monthly`.
- التحقق كل 60 ثانية.

## ملاحظات
- `serviceAccountKey.json` **سرّي** — لا ترفعه إلى Git.
- Netlify لا تدعم SQLite دائمة → شغّل هذه الخدمة على VPS/Railway/Render أو كمبيوتر محل.
- الواجهة (Netlify) تبقى كما هي؛ الخدمة منفصلة.