'use strict';
const path = require('path');
let Service;
try { Service = require('node-windows').Service; }
catch(e){ console.error('node-windows غير مثبت. شغّل: npm install node-windows'); process.exit(1); }
const svc = new Service({
  name: 'BMS Backup Service',
  description: 'BMS SY — خدمة نسخ احتياطي تلقائي (SQLite) لـ Blue Mark',
  script: path.join(__dirname, 'index.js'),
  env: [
    { name: 'BMS_SA_PATH', value: process.env.BMS_SA_PATH || path.join(__dirname, 'serviceAccountKey.json') },
    { name: 'BMS_BACKUP_DIR', value: process.env.BMS_BACKUP_DIR || path.join(__dirname, 'backups') }
  ]
});
svc.on('install', function(){ console.log('Service installed. Starting...'); svc.start(); });
svc.on('alreadyinstalled', function(){ console.log('Service already installed.'); });
svc.on('start', function(){ console.log('Service started.'); });
svc.on('error', function(err){ console.error('Service error:', err); });
if(process.argv.includes('--uninstall')){
  svc.on('uninstall', function(){ console.log('Service uninstalled.'); });
  svc.uninstall();
} else {
  svc.install();
}