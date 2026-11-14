// Interaction layer: sortable/searchable tables, chart click-through, toasts,
// undo/redo buttons, colour theme and keyboard shortcuts. Works on the DOM that
// app.js renders, so app.js keeps owning all data and calculations.
(function(){
'use strict';
const $=id=>document.getElementById(id);
const S=()=>window.Suite||{};
const store={get(k){try{return localStorage.getItem(k);}catch(e){return null;}},set(k,v){try{localStorage.setItem(k,v);}catch(e){}}};
const view=()=>document.querySelector('.view.on');
const later=ms=>new Promise(r=>setTimeout(r,ms));

// ================= colour theme =================
const THEMES=['auto','light','dark'],TH_KEY='networkSuite.theme';
function applyTheme(t){if(t==='auto')document.documentElement.removeAttribute('data-theme');else document.documentElement.setAttribute('data-theme',t);
  $('themeBtn').textContent={auto:'◐ Auto',light:'☀ Light',dark:'☾ Dark'}[t];$('themeBtn').setAttribute('aria-label','Colour theme: '+t);}
let theme=THEMES.includes(store.get(TH_KEY))?store.get(TH_KEY):'auto';applyTheme(theme);
function nextTheme(){theme=THEMES[(THEMES.indexOf(theme)+1)%THEMES.length];store.set(TH_KEY,theme);applyTheme(theme);}
$('themeBtn').onclick=nextTheme;

// ================= undo / redo =================
function syncHistory(){$('undoBtn').disabled=!(S().canUndo&&S().canUndo());$('redoBtn').disabled=!(S().canRedo&&S().canRedo());}
document.addEventListener('suite:history',syncHistory);document.addEventListener('suite:ready',syncHistory);
const doUndo=()=>{if(S().undo&&S().undo())S().toast('Undid the last change.');};
const doRedo=()=>{if(S().redo&&S().redo())S().toast('Redid the change.');};
$('undoBtn').onclick=doUndo;$('redoBtn').onclick=doRedo;

// ================= status messages become toasts =================
// app.js writes short status text into .msg elements; show each new message as a toast instead
document.querySelectorAll('.msg').forEach(el=>{let last='';
  new MutationObserver(()=>{const t=el.textContent.trim();if(t&&t!==last&&S().toast)S().toast(t,/fail|could not|blocked|already exists|^no |not enough|^enter /i.test(t)?'bad':'');last=t;})
    .observe(el,{childList:true,characterData:true,subtree:true});});

// ================= sortable, searchable tables =================
// tables listed here hold one row per item; tables with grouped multi-row items are left alone
const TABLES={pnlTbl:{search:1,pinLast:1},prodOut:{search:1},routeOut:{search:1},legOut:{},fleetOut:{},invTbl:{},rosTbl:{search:1},
  dutyTbl:{search:1},crewReq:{},priceTbl:{},corpOut:{},ancOut:{search:1},chgTbl:{search:1},rtImpact:{search:1},connTbl:{search:1},simTbl:{},
  tailDay:{},auditTbl:{search:1},ilSettle:{},scTbl:{}};
const sortState={};
function cellKey(td){if(!td)return {v:null};const inp=td.querySelector('input,select');let t=(inp?inp.value:td.textContent).trim();
  if(!t||t==='–'||t==='-')return {v:null};
  if(/^full$/i.test(t))return {v:Infinity,n:1};
  const seg=t.split('→').pop().trim().replace(/^[A-Z]{3}\s+/,'').replace(/,/g,'').replace(/−/g,'-');
  const m=/^([+-]?\d+(?:\.\d+)?)\s*(k|M)?\s*(%|×|x|h| pts| d)?(\s*\(.*\))?$/.exec(seg);
  if(m)return {v:parseFloat(m[1])*(m[2]==='k'?1e3:m[2]==='M'?1e6:1),n:1};
  return {v:t.toLowerCase(),n:0};}
function bodyRows(tb,cfg){const rows=[...tb.rows],pinned=rows.filter((r,i)=>(cfg.pinLast&&i===rows.length-1)||r.querySelector('td[colspan]'));
  return {free:rows.filter(r=>!pinned.includes(r)),pinned};}
function applySort(id){const tbl=$(id),cfg=TABLES[id],st=sortState[id],tb=tbl&&tbl.tBodies[0];if(!tb)return;
  const head=tbl.tHead&&tbl.tHead.rows[0];
  if(head)[...head.cells].forEach((th,i)=>{if(!th.textContent.trim())return;th.classList.add('sortable');th.tabIndex=0;th.setAttribute('role','button');
    th.setAttribute('aria-sort',st&&st.col===i&&st.dir?(st.dir>0?'ascending':'descending'):'none');th.title='Sort by '+th.textContent.trim();});
  tbl.classList.toggle('sorted',!!(st&&st.dir));
  const {free,pinned}=bodyRows(tb,cfg);
  if(!st||!st.dir){(tbl._orig||[]).forEach(r=>{if(r.parentNode===tb)tb.appendChild(r);});return;}
  const keyed=free.map((r,i)=>({r,i,k:cellKey(r.cells[st.col])}));
  keyed.sort((a,b)=>{const x=a.k.v,y=b.k.v;if(x==null&&y==null)return a.i-b.i;if(x==null)return 1;if(y==null)return -1;
    const c=(a.k.n&&b.k.n)?x-y:String(x).localeCompare(String(y),undefined,{numeric:true});return c?c*st.dir:a.i-b.i;});
  keyed.forEach(o=>tb.appendChild(o.r));pinned.forEach(r=>tb.appendChild(r));}
function applySearch(id){const tbl=$(id),box=$(id+'Search'),tb=tbl&&tbl.tBodies[0];if(!box||!tb)return;
  const terms=box.querySelector('input').value.trim().toLowerCase().split(/\s+/).filter(Boolean),{free}=bodyRows(tb,TABLES[id]);let shown=0;
  free.forEach(r=>{const txt=(r.textContent+' '+[...r.querySelectorAll('input,select')].map(x=>x.value).join(' ')).toLowerCase();
    const ok=terms.every(t=>txt.includes(t));r.hidden=!ok;if(ok)shown++;});
  box.querySelector('.cnt').textContent=terms.length?`${shown} of ${free.length} rows`:'';}
// called right after app.js renders the table, so the rows are in their original order here
function decorate(id){const t=$(id);t._orig=t.tBodies[0]?[...t.tBodies[0].rows]:[];applySort(id);applySearch(id);}
Object.entries(TABLES).forEach(([id,cfg])=>{const tbl=$(id);if(!tbl)return;
  if(cfg.search){const wrap=tbl.closest('.scroll')||tbl,box=document.createElement('div');box.className='tsearch';box.id=id+'Search';
    box.innerHTML='<input type="search" placeholder="Search this table…" aria-label="Search this table"><span class="cnt note"></span>';
    wrap.parentNode.insertBefore(box,wrap);box.querySelector('input').addEventListener('input',()=>applySearch(id));}
  // the table's own head/body are replaced whenever app.js re-renders it; re-apply sort and search then
  new MutationObserver(()=>decorate(id)).observe(tbl,{childList:true});decorate(id);
  const onHead=e=>{const th=e.target.closest('th');if(!th||!tbl.tHead||!tbl.tHead.contains(th)||!th.classList.contains('sortable'))return;
    // cycle per column: first direction (numbers: largest first, text: A–Z) → reverse → original order
    const col=[...th.parentNode.cells].indexOf(th),st=sortState[id];let first,dir;
    if(!st||st.col!==col){const sample=[...tbl.tBodies[0].rows].map(r=>cellKey(r.cells[col])).find(k=>k.v!=null);first=dir=sample&&sample.n?-1:1;}
    else{first=st.first;dir=st.dir===first?-first:(st.dir===-first?0:first);}
    sortState[id]={col,dir,first};applySort(id);applySearch(id);};
  tbl.addEventListener('click',onHead);tbl.addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&e.target.closest('th.sortable')){e.preventDefault();onHead(e);}});});

// ================= chart click-through =================
async function waitFor(fn,ms=3000){const t0=Date.now();while(Date.now()-t0<ms){const v=fn();if(v)return v;await later(60);}return null;}
function rowIn(tableId,test){const t=$(tableId);if(!t||!t.tBodies[0])return null;return [...t.tBodies[0].rows].find(test)||null;}
const firstCell=txt=>r=>r.cells[0]&&r.cells[0].textContent.trim()===txt;
async function go(hash){if(location.hash!=='#'+hash){location.hash=hash;await later(80);}}
async function flash(tableId,test){
  const box=$(tableId+'Search');if(box&&box.querySelector('input').value){box.querySelector('input').value='';applySearch(tableId);}
  if(!await waitFor(()=>rowIn(tableId,test)))return false;
  await later(380);  // let any pending re-render finish so the highlight lands on the final row
  const r=rowIn(tableId,test);if(!r)return false;r.hidden=false;
  r.classList.remove('flash');void r.offsetWidth;r.classList.add('flash');r.scrollIntoView({block:'center',behavior:'smooth'});setTimeout(()=>r.classList.remove('flash'),2600);return true;}
document.addEventListener('chartpick',async e=>{const el=e.target,d=e.detail||{},kind=el.dataset.pick||(d.fn?'flight':'');
  if(kind==='route'){await go('com-pnl');await flash('pnlTbl',firstCell(d.cat));}
  else if(kind==='planroute'){await flash('routeOut',firstCell(d.cat));}
  else if(kind==='fleet'){await flash('fleetOut',firstCell(d.cat));}
  else if(kind==='leg'){const sel=$('curveLeg'),o=[...sel.options].find(x=>x.textContent===d.cat);
    if(o){sel.value=o.value;sel.dispatchEvent(new Event('change'));}
    await flash('legOut',firstCell(d.cat));const c=$('chCurve').closest('.card');setTimeout(()=>{c.classList.remove('flash');void c.offsetWidth;c.classList.add('flash');},900);}
  else if(kind==='fare'){const f=$('priceFilter');f.value=d.market;f.dispatchEvent(new Event('input'));
    await flash('priceTbl',r=>r.cells[0]&&r.cells[0].textContent.trim()===d.market&&r.cells[1].textContent.trim()===d.rbd);}
  else if(kind==='flight'){await go('plan-sched');$('flChanged').checked=false;const f=$('flFilter');f.value=d.fn;f.dispatchEvent(new Event('input'));
    const test=r=>{const i=r.querySelector('input[data-k="fn"]');return i&&i.value===d.fn;};
    if(await flash('flTbl',test)){const r=rowIn('flTbl',test),dep=r&&r.querySelector('input[data-k="dep"]');if(dep)dep.focus({preventScroll:true});
      S().toast(`Showing ${d.fn} in the proposed schedule. Clear the filter to see every flight.`);}}});

// on narrow screens the tab bar scrolls sideways; keep the current tab in view
function showActiveTab(){const t=$('tabs'),a=t&&t.querySelector('a.on');if(a&&t.scrollWidth>t.clientWidth)t.scrollTo({left:a.offsetLeft-t.clientWidth/2+a.offsetWidth/2,behavior:'smooth'});}
window.addEventListener('hashchange',()=>setTimeout(showActiveTab,50));document.addEventListener('suite:ready',showActiveTab);

// ================= keyboard shortcuts =================
const dlg=$('keysDlg');
const openKeys=()=>{if(dlg.open)return;if(dlg.showModal)dlg.showModal();else dlg.setAttribute('open','');};
$('keysBtn').onclick=openKeys;$('keysClose').onclick=()=>dlg.close?dlg.close():dlg.removeAttribute('open');
const GO={c:'com-dash',r:'rm-setup',i:'rm-inv',n:'plan-setup',s:'plan-sched',p:'price-setup',o:'ops-tails',d:'data'};
let gAt=0;
const typing=t=>t&&(t.isContentEditable||/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));
function focusSearch(){const v=view();if(!v)return;
  const el=[...v.querySelectorAll('.tsearch input,#flFilter,#priceFilter,#fareFilter,#invFSector')].find(x=>x.offsetParent!==null);
  if(el){el.focus();el.select&&el.select();}else S().toast('This tab has no table search.');}
document.addEventListener('keydown',e=>{
  if(e.key==='Escape'&&typing(e.target)){e.target.blur();return;}
  const mod=e.ctrlKey||e.metaKey;
  if(mod&&!e.altKey&&(e.key==='z'||e.key==='Z'||e.key==='y')){if(typing(e.target))return;e.preventDefault();(e.key==='y'||e.shiftKey)?doRedo():doUndo();return;}
  if(mod||e.altKey||typing(e.target)||dlg.open)return;
  if(e.key==='?'){e.preventDefault();openKeys();return;}
  if(e.key==='/'){e.preventDefault();focusSearch();return;}
  if(e.key==='t'){nextTheme();S().toast('Theme: '+theme);return;}
  if(e.key==='['||e.key===']'){const tabs=[...document.querySelectorAll('#tabs a')],i=tabs.findIndex(a=>a.classList.contains('on'));
    const n=tabs[(i+(e.key===']'?1:-1)+tabs.length)%tabs.length];location.hash=n.getAttribute('href');n.focus({preventScroll:true});return;}
  if(e.key==='g'){gAt=Date.now();return;}
  if(Date.now()-gAt<1500&&GO[e.key]){location.hash=GO[e.key];gAt=0;}});
})();
