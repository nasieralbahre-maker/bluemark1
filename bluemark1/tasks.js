/*
 * tasks.js — مهام اليوم
 * - قائمة مهام يومية تُحفظ محلياً على الجهاز (localStorage) لكل تاريخ.
 * - الإكمال التلقائي من قائمة المهام المُعرّفة في لوحة التحكم (config.taskPresets).
 */
(function(){
  'use strict';
  function $(id){ return document.getElementById(id); }
  function esc(s){ return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];}); }
  function toast(m){ try{ if(typeof showToast==='function'){ showToast(m); return; } }catch(e){} }

  var presets = [];

  function todayKey(){
    var d = new Date();
    var m = String(d.getMonth()+1).padStart(2,'0');
    var day = String(d.getDate()).padStart(2,'0');
    return d.getFullYear()+'-'+m+'-'+day;
  }
  function lsKey(){ return 'today_tasks_'+todayKey(); }
  function loadTasks(){ try{ return JSON.parse(localStorage.getItem(lsKey())||'[]'); }catch(e){ return []; } }
  function saveTasks(a){ try{ localStorage.setItem(lsKey(), JSON.stringify(a)); }catch(e){} }

  // ===== حقن الواجهة =====
  var CSS = ''+
    '#tasksModal .tk-foot{display:flex;gap:8px;padding:12px 16px;border-top:1px solid var(--line,#e2e8f0);background:#f8fafc;flex-wrap:wrap;}'+
    '#tasksModal .tk-foot input{flex:1;min-width:160px;font-family:inherit;font-size:14.5px;padding:11px 13px;border:1.5px solid #dbe6fc;border-radius:12px;background:#fff;}'+
    '#tasksModal .tk-foot input:focus{outline:none;border-color:#2563eb;}'+
    '#tasksModal .tk-add{border:none;background:linear-gradient(135deg,#1e4ed0,#3b82f6);color:#fff;font-family:inherit;font-weight:800;font-size:15px;padding:11px 18px;border-radius:12px;cursor:pointer;flex:none;}'+
    '#tasksModal .tk-list{display:flex;flex-direction:column;gap:9px;padding:14px 16px;}'+
    '#tasksModal .tk-empty{text-align:center;color:#94a3b8;padding:26px 10px;font-size:13.5px;}'+
    '#tasksModal .tk-item{display:flex;align-items:center;gap:11px;background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:11px 13px;}'+
    '#tasksModal .tk-item.done{background:#f0fdf4;border-color:#bbf7d0;}'+
    '#tasksModal .tk-item.done .tk-txt{text-decoration:line-through;color:#94a3b8;}'+
    '#tasksModal .tk-chk{width:24px;height:24px;flex:none;cursor:pointer;accent-color:#16a34a;}'+
    '#tasksModal .tk-txt{flex:1;font-size:14.5px;font-weight:700;color:#0f172a;word-break:break-word;}'+
    '#tasksModal .tk-del{border:none;background:#fee2e2;color:#dc2626;width:32px;height:32px;border-radius:9px;cursor:pointer;font-size:15px;flex:none;}'+
    '#tasksModal .tk-del:hover{background:#dc2626;color:#fff;}'+
    '#tasksModal .tk-count{font-size:12.5px;color:#64748b;padding:0 16px 4px;}'+
    '@media(max-width:860px){#tasksModal .tk-foot input{min-width:0;}}';
  (function inject(){ var s=document.createElement('style'); s.textContent=CSS; document.head.appendChild(s); })();

  var UI = ''+
  '<div class="modal" id="tasksModal">'+
    '<div class="modal-box">'+
      '<div class="modal-head"><h3>✅ مهام اليوم</h3><button class="close-btn" id="tasksClose">✕</button></div>'+
      '<div class="tk-count" id="tkCount"></div>'+
      '<div class="tk-list" id="tkList"></div>'+
      '<div class="tk-foot">'+
        '<input type="text" id="tkInput" list="tkPresets" placeholder="اكتب مهمة... (أول حرف يقترح الباقي)" autocomplete="off" />'+
        '<datalist id="tkPresets"></datalist>'+
        '<button class="tk-add" id="tkAdd">➕ إضافة</button>'+
      '</div>'+
    '</div>'+
  '</div>';
  (function injectUI(){ var d=document.createElement('div'); d.innerHTML=UI; document.body.appendChild(d.firstChild); })();

  function renderPresets(){
    var dl = $('tkPresets'); if(!dl) return;
    dl.innerHTML = (presets||[]).map(function(p){ return '<option value="'+esc(p)+'"></option>'; }).join('');
  }

  function updateBadge(){
    var b = $('tasksBadge'); if(!b) return;
    var n = loadTasks().filter(function(t){ return !t.done; }).length;
    if(n>0){ b.textContent = n>99?'99+':String(n); b.style.display=''; }
    else b.style.display='none';
  }

  function render(){
    var list = $('tkList'); if(!list) return;
    var tasks = loadTasks();
    var cnt = $('tkCount');
    if(cnt){ var done=tasks.filter(function(t){return t.done;}).length; cnt.textContent = tasks.length? ('المنجَز: '+done+' من '+tasks.length) : ''; }
    if(!tasks.length){ list.innerHTML = '<div class="tk-empty">لا توجد مهام ليوم — أضف مهمة 📝</div>'; updateBadge(); return; }
    list.innerHTML = tasks.map(function(t){
      return '<div class="tk-item'+(t.done?' done':'')+'" data-id="'+esc(t.id)+'">'+
        '<input type="checkbox" class="tk-chk" '+(t.done?'checked':'')+' />'+
        '<span class="tk-txt">'+esc(t.text)+'</span>'+
        '<button class="tk-del" title="حذف">🗑️</button>'+
      '</div>';
    }).join('');
    list.querySelectorAll('.tk-item').forEach(function(el){
      var id = el.getAttribute('data-id');
      el.querySelector('.tk-chk').onchange = function(){ toggle(id); };
      el.querySelector('.tk-del').onclick = function(){ del(id); };
    });
    updateBadge();
  }

  function addTask(){
    var inp = $('tkInput'); if(!inp) return;
    var t = (inp.value||'').trim(); if(!t) return;
    var tasks = loadTasks();
    tasks.push({ id:'T'+Date.now()+Math.random().toString(36).slice(2,5), text:t, done:false, ts:Date.now() });
    saveTasks(tasks); inp.value=''; inp.focus(); render();
  }
  function toggle(id){
    var tasks = loadTasks();
    tasks.forEach(function(t){ if(t.id===id) t.done=!t.done; });
    saveTasks(tasks); render();
  }
  function del(id){
    var tasks = loadTasks().filter(function(t){ return t.id!==id; });
    saveTasks(tasks); render();
  }

  function open(){ renderPresets(); render(); $('tasksModal').classList.add('show'); setTimeout(function(){ var i=$('tkInput'); if(i) i.focus(); },60); }
  function close(){ $('tasksModal').classList.remove('show'); }

  // ===== ربط الأحداث =====
  function bind(){
    var btn = $('tasksBtn'); if(btn) btn.onclick = open;
    var c = $('tasksClose'); if(c) c.onclick = close;
    var add = $('tkAdd'); if(add) add.onclick = addTask;
    var inp = $('tkInput'); if(inp) inp.addEventListener('keydown', function(e){ if(e.key==='Enter'){ e.preventDefault(); addTask(); } });
  }

  // جلب قائمة المهام المُعرّفة من الإعدادات
  function loadPresetsFrom(cfg){ try{ presets = (cfg && Array.isArray(cfg.taskPresets)) ? cfg.taskPresets.slice() : []; }catch(e){ presets=[]; } renderPresets(); }
  try{ if(window.DB && DB.getSettings){ DB.getSettings().then(loadPresetsFrom).catch(function(){}); } }catch(e){}
  try{ if(window.DB && DB.onSettings){ DB.onSettings(loadPresetsFrom); } }catch(e){}

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', function(){ bind(); updateBadge(); });
  else { bind(); updateBadge(); }
})();
