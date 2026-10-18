// ============================================================
//  preload.js — جسر آمن بين واجهة الرسم (renderer) والعمليات الأصلية
//  يعرض واجهة BMS_DOWNLOADER فقط: تنزيل داخل التطبيق + تثبيت تلقائي.
//  (contextIsolation مفعّل — لا نكشف أي شيء آخر)
// ============================================================
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('BMS_DOWNLOADER', {
  // علامة أن التشغيل يتم داخل تطبيق سطح المكتب
  isDesktop: true,
  platform: process.platform,

  // بدء تنزيل حزمة تحديث (رابط مباشر + اسم ملف مقترح)
  start: function (url, filename) {
    return ipcRenderer.invoke('upd:start', { url: String(url || ''), filename: String(filename || '') });
  },

  // إلغاء التنزيل الجاري
  cancel: function () {
    return ipcRenderer.invoke('upd:cancel');
  },

  // فتح مجلد التنزيلات في مستكشف الملفات
  showFolder: function () {
    return ipcRenderer.invoke('upd:showFolder');
  },

  // ----- الاشتراك في الأحداث -----
  onProgress: function (cb) {
    ipcRenderer.on('upd:progress', function (_e, d) { try { cb(d); } catch (err) {} });
  },
  onDone: function (cb) {
    ipcRenderer.on('upd:done', function (_e, d) { try { cb(d); } catch (err) {} });
  },
  onError: function (cb) {
    ipcRenderer.on('upd:error', function (_e, d) { try { cb(d); } catch (err) {} });
  },
  onStage: function (cb) {
    ipcRenderer.on('upd:stage', function (_e, d) { try { cb(d); } catch (err) {} });
  }
});
