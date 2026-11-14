(function(){
'use strict';
const KEY='networkSuite.v1', CFG_KEY='networkSuite.api', SC_KEY='networkSuite.scenarios';
const E=window.NetEngine;
const clone=o=>JSON.parse(JSON.stringify(o));
const num=(x,d=0)=>{const n=parseFloat(x);return isFinite(n)?n:d;};
const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m]));
const $=id=>document.getElementById(id);
const store={get(k){try{return localStorage.getItem(k);}catch(e){return null;}},set(k,v){try{localStorage.setItem(k,v);}catch(e){}}};

let ST;
try{ST=JSON.parse(store.get(KEY)||'null');}catch(e){ST=null;}
if(!ST||!ST.rm||!ST.plan) ST=clone(window.DEMO_DATA);
// fill fields added in later versions (also run on scenarios loaded from storage or the server)
function migrate(ST){const D=window.DEMO_DATA;
  if(!Array.isArray(ST.rm.legs))ST.rm.legs=[];if(!Array.isArray(ST.rm.prods))ST.rm.prods=[];if(!ST.rm.curves)ST.rm.curves=clone(D.rm.curves);
  if(!ST.plan.params)ST.plan.params=clone(D.plan.params);if(!Array.isArray(ST.plan.fleets))ST.plan.fleets=[];if(!Array.isArray(ST.plan.routes))ST.plan.routes=[];
  ['bd_on','alpha','frat5'].forEach(k=>{if(ST.rm[k]==null)ST.rm[k]=D.rm[k];});
  if(!ST.sched||!Array.isArray(ST.sched.prop))ST.sched=clone(D.sched);
  if(!ST.sched.params)ST.sched.params=clone(D.sched.params);
  ST.plan.fleets.forEach(f=>{if(f.turn==null)f.turn=45;});
  if(!ST.ops||!Array.isArray(ST.ops.tails))ST.ops=clone(D.ops);
  if(!ST.ops.rules)ST.ops.rules=clone(D.ops.rules);['pool','leave'].forEach(k=>{if(!Array.isArray(ST.ops[k]))ST.ops[k]=[];});
  if(!ST.pricing||!Array.isArray(ST.pricing.fares))ST.pricing=clone(D.pricing);
  ['families','pax','currencies','display_cur'].forEach(k=>{if(ST.pricing[k]==null)ST.pricing[k]=clone(D.pricing[k]);});
  if(!ST.com||!ST.com.costs)ST.com=clone(D.com);
  if(!ST.inv||!Array.isArray(ST.inv.rules))ST.inv=clone(D.inv);
  ['season','event','ob_mode','db_cost'].forEach(k=>{if(ST.rm[k]==null)ST.rm[k]=D.rm[k];});
  ST.rm.legs.forEach(l=>{if(l.noshow==null)l.noshow=6;});
  const km={};D.plan.routes.forEach(r=>km[r.route]=r.dist);ST.plan.routes.forEach(r=>{if(r.dist==null)r.dist=km[r.route]||1000;});
  const iata={};D.plan.fleets.forEach(f=>iata[f.type]=f.iata);ST.plan.fleets.forEach(f=>{if(f.iata==null)f.iata=iata[f.type]||'';});
  if(!ST.sched.station_offsets)ST.sched.station_offsets=clone(D.sched.station_offsets);
  ['utc_offset','period_from','period_to'].forEach(k=>{if(ST.sched.params[k]==null)ST.sched.params[k]=D.sched.params[k];});
  if(ST.ops.rules.reserve_pct==null)ST.ops.rules.reserve_pct=D.ops.rules.reserve_pct;
  ST.ops.tails.forEach(t=>{if(t.hrs_to_check==null)t.hrs_to_check='';});
  return ST;}
migrate(ST);
// ---- save + undo/redo: every save() is one step; quick successive edits (typing) merge into one step
const UNDO_MAX=60;let undoStack=[],redoStack=[],savedJson=JSON.stringify(ST),lastSaveAt=0;
const save=()=>{const j=JSON.stringify(ST);if(j===savedJson)return;const now=Date.now();
  if(now-lastSaveAt>900||!undoStack.length){undoStack.push(savedJson);if(undoStack.length>UNDO_MAX)undoStack.shift();}
  redoStack=[];savedJson=j;lastSaveAt=now;store.set(KEY,j);document.dispatchEvent(new CustomEvent('suite:history'));};
function restore(j){ST=migrate(JSON.parse(j));savedJson=j;lastSaveAt=0;store.set(KEY,j);lastPrice=null;lastCom=null;lastPlan=null;planStale=true;
  renderAll();schedRm();document.dispatchEvent(new CustomEvent('suite:history'));}
function undo(){if(!undoStack.length)return false;redoStack.push(savedJson);restore(undoStack.pop());return true;}
function redo(){if(!redoStack.length)return false;undoStack.push(savedJson);restore(redoStack.pop());return true;}
const cur=()=>ST.rm.cur||'';

// ================= API / ENGINE =================
let cfg={base:'',tenant:'demo',token:''};
try{Object.assign(cfg,JSON.parse(store.get(CFG_KEY)||'{}'));}catch(e){}
let server=false;
async function api(path,body,method){
  const ctl=new AbortController();const t=setTimeout(()=>ctl.abort(),method==='GET'&&path==='/api/health'?2500:120000);
  try{
    const h={'Content-Type':'application/json','X-Tenant':cfg.tenant||'demo'};if(cfg.token)h.Authorization='Bearer '+cfg.token;
    const r=await fetch((cfg.base||'')+path,{method:method||(body?'POST':'GET'),headers:h,body:body?JSON.stringify(body):undefined,signal:ctl.signal});
    if(!r.ok)throw new Error(r.status+' '+(await r.text()).slice(0,200));
    return await r.json();
  }finally{clearTimeout(t);}
}
async function detect(){
  try{const h=await api('/api/health',null,'GET');server=!!(h&&h.ok);}catch(e){server=false;}
  $('engineBadge').classList.toggle('srv',server);
  $('engineTxt').textContent=server?'Server engine · exact HiGHS solver':'Browser engine · demo mode';
  $('scHint').textContent=server?`Scenarios are saved on the server for tenant "${cfg.tenant||'demo'}".`:'Scenarios are saved in this browser only. Connect to a server to share them across users.';
}
const INF_KEYS_LEG=['net','dlp','leg'],INF_KEYS_PROD=['sumNet','sumDlp','sumBp'];
function normRm(R){R.legs.forEach(l=>INF_KEYS_LEG.forEach(k=>{if(l[k]==null)l[k]=Infinity;}));R.prods.forEach(p=>INF_KEYS_PROD.forEach(k=>{if(p[k]==null)p[k]=Infinity;}));return R;}
async function runRm(){
  if(server){try{return normRm(await api('/api/rm/run',{state:ST.rm}));}catch(e){console.warn('server RM failed, using browser',e);}}
  return E.rmCompute(ST.rm);
}
async function runSim(runs,lbh,seed){
  if(server){try{return await api('/api/rm/simulate',{state:ST.rm,runs,lbh,seed});}catch(e){console.warn(e);}}
  return E.rmSimulateState(ST.rm,runs,lbh,seed);
}
async function runPlanEngine(){
  if(server){try{return await api('/api/plan/optimize',{plan:ST.plan});}catch(e){console.warn('server plan failed, using browser',e);}}
  return E.planOptimize(ST.plan);
}

// ================= toasts =================
function toast(text,kind){const box=$('toasts');if(!box||!text)return;const t=document.createElement('div');t.className='toast'+(kind?' '+kind:'');t.setAttribute('role',kind==='bad'?'alert':'status');
  t.innerHTML=`<span>${esc(text)}</span><button aria-label="Dismiss">✕</button>`;t.querySelector('button').onclick=()=>t.remove();box.appendChild(t);
  while(box.children.length>4)box.firstChild.remove();setTimeout(()=>{t.classList.add('out');setTimeout(()=>t.remove(),300);},Math.min(9000,2600+text.length*35));}
// ================= formatting =================
const f0=x=>x==null?'–':isFinite(x)?Math.round(x).toLocaleString('en-US'):'Full';
const f1=x=>x==null||!isFinite(x)?'–':x.toFixed(1);
const money=x=>x==null?'–':isFinite(x)?`${cur()} ${Math.round(x).toLocaleString('en-US')}`.trim():'Full';
const kmoney=x=>{if(x==null||!isFinite(x))return '–';const a=Math.abs(x);const s=a>=1e6?(x/1e6).toFixed(2)+'M':a>=1e3?(x/1e3).toFixed(0)+'k':Math.round(x)+'';return `${cur()} ${s}`.trim();};
const pct=x=>x==null||!isFinite(x)?'–':(x*100).toFixed(0)+'%';
const pill=o=>o?'<span class="pill open"><span class="dot">✓</span>Open</span>':'<span class="pill closed"><span class="dot">✕</span>Closed</span>';
const kpiHtml=a=>a.map(k=>`<div class="kpi"><div class="l">${k[0]}</div><div class="v">${k[1]}</div><div class="s">${k[2]||''}</div></div>`).join('');

// ================= routing =================
const VIEWS=['com-dash','com-pnl','com-anc','com-market','com-interline','rm-setup','rm-results','rm-sim','rm-inv','plan-setup','plan-results','plan-sched','price-setup','price-list','ops-tails','ops-crew','benchmark','data'];
function route(){
  const h=(location.hash||'').slice(1),v=VIEWS.includes(h)?h:'com-dash';
  VIEWS.forEach(x=>$('v-'+x).classList.toggle('on',x===v));
  document.querySelectorAll('#tabs a').forEach(a=>a.classList.toggle('on',a.getAttribute('href')==='#'+v));
  if(v==='rm-results')updateRm();
  if(v==='plan-results'&&(planStale||!lastPlan))doPlan();
  if(v==='plan-sched'){renderFlTbl();updateSched();}
  if(v==='ops-tails'||v==='ops-crew'){renderOpsInputs();updateOps();}
  if(v==='price-setup')renderPriceInputs();
  if(v==='price-list')updatePrice();
  if(v.startsWith('com-')){renderComInputs();updateCom();}
  if(v==='rm-inv'){renderInvInputs();updateInv();}
  if(v==='data'){fillCsv();renderScenarios();}
}
window.addEventListener('hashchange',route);

// ================= RM inputs =================
document.querySelectorAll('[data-rm]').forEach(el=>{el.oninput=el.onchange=()=>{ST.rm[el.dataset.rm]=el.value;save();schedRm();};});
function bindRmTop(){document.querySelectorAll('[data-rm]').forEach(el=>el.value=ST.rm[el.dataset.rm]??'');}
function renderLegIn(){
  let h='<thead><tr><th class="l">Leg</th><th>Capacity</th><th>Distance (km)</th><th>No-show %</th><th>Your RMS bid price</th><th></th></tr></thead><tbody>';
  ST.rm.legs.forEach((l,i)=>{h+=`<tr><td class="l"><input class="t" data-i="${i}" data-k="leg" value="${esc(l.leg)}" style="width:110px"></td>
    <td><input type="number" data-i="${i}" data-k="cap" value="${esc(l.cap)}"></td><td><input type="number" data-i="${i}" data-k="dist" value="${esc(l.dist)}"></td><td><input type="number" step="0.5" data-i="${i}" data-k="noshow" value="${esc(l.noshow??'')}"></td>
    <td><input type="number" data-i="${i}" data-k="ref" value="${esc(l.ref)}" placeholder="optional"></td><td><button data-dl="${i}" aria-label="Remove leg">✕</button></td></tr>`;});
  $('legIn').innerHTML=h+'</tbody>';
  $('legIn').querySelectorAll('input').forEach(el=>el.oninput=()=>{ST.rm.legs[+el.dataset.i][el.dataset.k]=el.value;save();schedRm();});
  $('legIn').querySelectorAll('[data-dl]').forEach(b=>b.onclick=()=>{ST.rm.legs.splice(+b.dataset.dl,1);save();renderLegIn();schedRm();});
}
function renderProdIn(){
  let h='<thead><tr><th class="l">O&amp;D</th><th class="l">Path</th><th class="l">RBD</th><th>Net fare</th><th>Historical final</th><th>Closed at DTD (history)</th><th>Booked</th><th class="l">Curve</th><th></th></tr></thead><tbody>';
  let prev=null;
  ST.rm.prods.forEach((p,i)=>{const g=prev!==null&&prev!==p.od;prev=p.od;
    h+=`<tr class="${g?'grp':''}"><td class="l"><input class="t" data-i="${i}" data-k="od" value="${esc(p.od)}" style="width:90px"></td>
    <td class="l"><input class="t" data-i="${i}" data-k="path" value="${esc(p.path)}" style="width:170px"></td>
    <td class="l"><input class="t" data-i="${i}" data-k="rbd" value="${esc(p.rbd)}" style="width:48px;min-width:48px"></td>
    <td><input type="number" data-i="${i}" data-k="fare" value="${esc(p.fare)}"></td><td><input type="number" step="0.1" data-i="${i}" data-k="hist" value="${esc(p.hist)}"></td><td><input type="number" data-i="${i}" data-k="closed_dtd" value="${esc(p.closed_dtd??'')}" placeholder="never"></td>
    <td><input type="number" data-i="${i}" data-k="otb" value="${esc(p.otb)}"></td>
    <td class="l"><select data-i="${i}" data-k="curve"><option value="early">Early</option><option value="mid">Mid</option><option value="late">Late</option></select></td>
    <td><button data-dp="${i}" aria-label="Remove product">✕</button></td></tr>`;});
  $('prodIn').innerHTML=h+'</tbody>';
  $('prodIn').querySelectorAll('select').forEach(el=>el.value=ST.rm.prods[+el.dataset.i].curve);
  $('prodIn').querySelectorAll('input,select').forEach(el=>el.oninput=el.onchange=()=>{ST.rm.prods[+el.dataset.i][el.dataset.k]=el.value;save();schedRm();});
  $('prodIn').querySelectorAll('[data-dp]').forEach(b=>b.onclick=()=>{ST.rm.prods.splice(+b.dataset.dp,1);save();renderProdIn();schedRm();});
}
function renderCurveTbl(){
  let h='<thead><tr><th class="l">Curve</th>'+E.DTD_PTS.map(d=>`<th>${d} d</th>`).join('')+'</tr></thead><tbody>';
  ['early','mid','late'].forEach(k=>{h+=`<tr><td class="l">${k}</td>`+ST.rm.curves[k].map((v,i)=>`<td><input type="number" data-c="${k}" data-i="${i}" value="${v}" style="min-width:50px"></td>`).join('')+'</tr>';});
  $('curveTbl').innerHTML=h+'</tbody>';
  $('curveTbl').querySelectorAll('input').forEach(el=>el.oninput=()=>{ST.rm.curves[el.dataset.c][+el.dataset.i]=el.value;save();schedRm();});
}
$('addLeg').onclick=()=>{ST.rm.legs.push({leg:'XXX-YYY',cap:174,dist:1000,noshow:6,ref:''});save();renderLegIn();schedRm();};
$('addProd').onclick=()=>{const l=ST.rm.legs[0]?ST.rm.legs[0].leg:'';ST.rm.prods.push({od:l,path:l,rbd:'N',fare:300,hist:5,otb:0,curve:'early'});save();renderProdIn();schedRm();};
$('resetRm').onclick=()=>{ST.rm=clone(window.DEMO_DATA.rm);save();bindRmTop();renderLegIn();renderProdIn();renderCurveTbl();schedRm();};

// ================= RM results =================
let lastRm=null,rmTimer=null,rmSeq=0;
function schedRm(){clearTimeout(rmTimer);rmTimer=setTimeout(updateRm,server?350:60);}
async function updateRm(){
  const seq=++rmSeq;const R=await runRm();if(seq!==rmSeq)return;lastRm=R;
  const opened=R.prods.filter(p=>p.open).length,diffs=R.prods.filter(p=>p.openNet!==p.openLeg).length;
  const tight=R.legs.filter(l=>(l.C>0?l.toCome/l.C:Infinity)>1).length;
  $('kpis').innerHTML=kpiHtml([
    ['Legs / O&amp;D products',`${R.legs.length} / ${R.prods.length}`,`${new Set(R.prods.map(p=>p.od)).size} O&amp;Ds`],
    ['Legs where demand exceeds seats',`${tight}`,'Demand to come &gt; remaining capacity'],
    ['Products open',`${opened} of ${R.prods.length}`,ST.rm.method==='dlp'?'Network LP control':'Network EMSR control'],
    ['Network vs leg-based',`${diffs} differ`,'Products with a different decision'],
    [R.bd&&R.bd.on&&R.bd.alpha>0?'Buy-down model':'Revenue to come (LP)',R.bd&&R.bd.on&&R.bd.alpha>0?`On · ${(R.bd.alpha*100).toFixed(0)}% price-oriented`:money(R.lp.z),R.bd&&R.bd.on&&R.bd.alpha>0?`FRAT5 ${R.bd.frat5} · classes valued at adjusted fare`:'Upper bound if the forecast is exact']])
    +(R.warnings.length?`<div class="kpi" style="grid-column:1/-1;border-color:var(--critical)"><div class="l" style="color:var(--critical)">Data warnings</div><div class="s">${R.warnings.slice(0,6).map(esc).join('<br>')}</div></div>`:'');
  const m=ST.rm.method==='dlp'?'dlp':'net';
  let h='<thead><tr><th class="l">Leg</th><th>Auth. cap</th><th>Booked</th><th>Remaining</th><th>Demand to come</th><th>Demand ÷ seats</th><th>No-show %</th><th>Optimal overbooking</th><th>Network EMSR BP</th><th>Network LP BP</th><th>Leg-only BP</th><th>Your RMS BP</th><th>Gap vs RMS</th></tr></thead><tbody>';
  R.legs.forEach(l=>{const ratio=l.C>0?l.toCome/l.C:Infinity,own=m==='dlp'?l.dlp:l.net,gap=l.ref!=null&&isFinite(own)?own-l.ref:null;
    h+=`<tr><td class="l"><b>${esc(l.code)}</b></td><td>${f0(l.auth)}</td><td>${f0(l.booked)}</td><td>${f0(l.C)}</td><td>${f1(l.toCome)}</td><td>${isFinite(ratio)?ratio.toFixed(2)+'×':'–'}</td><td>${l.noshow!=null?(l.noshow*100).toFixed(1):'–'}</td><td>${l.au_opt!=null?`${f0(l.au_opt)} (+${(l.ob_opt||0).toFixed(1)}%)`:'–'}</td>
    <td><b>${money(l.net)}</b></td><td>${money(l.dlp)}</td><td>${money(l.leg)}</td><td>${l.ref!=null?money(l.ref):'<span class="note">–</span>'}</td>
    <td>${gap!=null?(gap>=0?'+':'−')+money(Math.abs(gap))+(l.ref?` (${(gap/l.ref*100).toFixed(0)}%)`:''):'–'}</td></tr>`;});
  $('legOut').innerHTML=h+'</tbody>';
  const gp=$('grpPath'),gv=gp.value,paths=[...new Set(R.prods.map(p=>p.path))];gp.innerHTML=paths.map(x=>`<option value="${esc(x)}">${esc(x.replace(/>/g,' › '))}</option>`).join('');if(paths.includes(gv))gp.value=gv;
  const ser=[{k:'net',n:'Network EMSR',c:'var(--series-1)'},{k:'dlp',n:'Network LP',c:'var(--series-2)'},{k:'leg',n:'Leg-only',c:'var(--series-3)'}];
  if(R.legs.some(l=>l.ref!=null))ser.push({k:'ref',n:'Your RMS',c:'var(--series-4)'});
  $('bpLegend').innerHTML=ser.map(s=>`<span><i style="background:${s.c}"></i>${s.n}</span>`).join('');
  barChart($('chBp'),R.legs.map(l=>l.code),ser.map(s=>({name:s.n,color:s.c,vals:R.legs.map(l=>{const v=l[s.k];return v==null||!isFinite(v)?null:v;})})),cur()+' per seat',v=>money(v));
  const sel=$('curveLeg'),cv=sel.value;sel.innerHTML=R.legs.map((l,i)=>`<option value="${i}">${esc(l.code)}</option>`).join('');sel.value=cv&&+cv<R.legs.length?cv:'0';
  const L=R.legs[+sel.value];
  if(L)lineChart($('chCurve'),L.curve.map((_,i)=>i+1),L.curve,{xLabel:'Remaining seat number',ref:isFinite(L.net)?{y:L.net,label:'Bid price '+money(L.net)}:null,
    marker:L.curve.length?{x:L.curve.length,y:L.curve[L.curve.length-1]}:null,empty:L.C<=0?'Leg is full':(!L.curve.length?'No seats':null),tip:(x,y)=>`Seat <b>${x}</b> of ${L.C}<br>Value <b>${money(y)}</b>`});
  const only=$('onlyDiff').checked;
  const bd=R.bd&&R.bd.on&&R.bd.alpha>0;
  h=`<thead><tr><th class="l">O&amp;D</th><th class="l">Path</th><th class="l">RBD</th><th>Net fare</th>${bd?'<th>Adjusted value</th>':''}<th>Booked</th><th>Demand to come</th>${bd?'<th>of which price-oriented</th>':''}<th>Sum of leg BPs</th><th>Value − BPs</th><th class="l">Network</th><th>Seats</th><th class="l">Leg-based</th></tr></thead><tbody>`;
  let prev=null;
  R.prods.forEach(p=>{const d=p.open!==p.openLeg;if(only&&!d)return;const g=prev!==null&&prev!==p.od;prev=p.od;
    const v=p.val??p.fare;
    h+=`<tr class="${d?'diff':''} ${g?'grp':''}"><td class="l"><b>${esc(p.od)}</b></td><td class="l note">${esc(p.path.replace(/>/g,' › '))}</td><td class="l"><b>${esc(p.rbd)}</b></td><td>${f0(p.fare)}</td>${bd?`<td>${f0(v)}</td>`:''}<td>${f0(p.otb)}</td><td>${f1(p.mu)}</td>${bd?`<td>${f1(p.dQ)}</td>`:''}
    <td>${money(p.sumBp)}</td><td>${isFinite(p.sumBp)?f0(v-p.sumBp):'–'}</td><td class="l">${pill(p.open)}</td><td><b>${p.seats}</b></td><td class="l">${pill(p.openLeg)}</td></tr>`;});
  $('prodOut').innerHTML=h+'</tbody>';
  const byOd={};R.prods.forEach(p=>{(byOd[p.od+'|'+p.path]=byOd[p.od+'|'+p.path]||[]).push(p);});
  $('avs').textContent=`D-${R.dtd}\n`+Object.entries(byOd).map(([k,ps])=>{const [od,path]=k.split('|');const segs=path.split('>');const via=segs.length>1?' via '+segs.slice(0,-1).map(s=>s.split('-')[1]).join('/'):'';
    return (od+via).padEnd(20)+ps.slice().sort((a,b)=>b.fare-a.fare).map(p=>`${p.rbd}${Math.min(9,p.seats)}`).join(' ');}).join('\n');
}
$('onlyDiff').onchange=updateRm;$('curveLeg').onchange=updateRm;
async function copy(text,el){try{await navigator.clipboard.writeText(text);el.textContent='Copied';}catch(e){el.textContent='Copy blocked: select the text manually';}setTimeout(()=>el.textContent='',2500);}
$('copyRes').onclick=()=>{if(!lastRm)return;const rows=[['od','path','rbd','fare','booked','demand_to_come','sum_leg_bp','network_open','seats','leg_based_open']];
  lastRm.prods.forEach(p=>rows.push([p.od,p.path,p.rbd,p.fare,p.otb,p.mu.toFixed(2),isFinite(p.sumBp)?p.sumBp.toFixed(2):'FULL',p.open?'Y':'N',p.seats,p.openLeg?'Y':'N']));
  rows.push([]);rows.push(['leg','network_emsr_bp','network_lp_bp','leg_only_bp','remaining']);
  lastRm.legs.forEach(l=>rows.push([l.code,isFinite(l.net)?l.net.toFixed(2):'FULL',isFinite(l.dlp)?l.dlp.toFixed(2):'FULL',isFinite(l.leg)?l.leg.toFixed(2):'FULL',l.C]));
  copy(rows.map(r=>r.join(',')).join('\n'),$('copyMsg'));};
$('copyAvs').onclick=()=>copy($('avs').textContent,$('copyMsg'));

// simulation
$('runSim').onclick=async()=>{
  const btn=$('runSim');btn.disabled=true;btn.textContent='Running…';
  await new Promise(r=>setTimeout(r,30));
  try{
    const runs=Math.min(3000,Math.max(10,Math.round(num($('runs').value,500))));
    const res=await runSim(runs,Math.min(1,Math.max(0,num($('lbh').value,0.7))),Math.round(num($('seed').value,42)));
    const by=k=>res.pols.find(p=>p.k===k).rev,fc=by('fcfs'),best=res.pols.reduce((a,b)=>b.rev>a.rev?b:a);
    const d=(a,b)=>(a>=b?'+':'')+((a-b)/b*100).toFixed(1)+'%';
    const faBest=Math.max(by('net'),by('netbp'));
    $('simKpis').innerHTML=kpiHtml([['Perfect hindsight',money(res.hind),`Average over ${res.runs} runs`],['Best method',best.name,`${(best.rev/res.hind*100).toFixed(1)}% of perfect hindsight`],
      ['Fare adjustment gain',d(faBest,by('net0')),'Best fare-adjusted method vs network EMSR without buy-down model'],['Network vs leg-based',d(Math.max(by('net0'),faBest),by('leg')),'Best network method vs leg-based EMSR-b']]);
    let h='<thead><tr><th class="l">Method</th><th>Revenue to come</th><th>% of hindsight</th><th>vs FCFS</th><th>Passengers</th><th>Avg fare</th></tr></thead><tbody>';
    res.pols.forEach(p=>{h+=`<tr><td class="l">${p.name}</td><td>${money(p.rev)}</td><td>${(p.rev/res.hind*100).toFixed(1)}%</td><td>${p.k==='fcfs'?'–':d(p.rev,fc)}</td><td>${f1(p.pax)}</td><td>${money(p.pax?p.rev/p.pax:0)}</td></tr>`;});
    $('simTbl').innerHTML=h+'</tbody>';
    hbarChart($('chSim'),res.pols.map(p=>p.name),res.pols.map(p=>p.rev/res.hind*100),v=>v.toFixed(1)+'%',100);
  }finally{btn.disabled=false;btn.textContent='Run simulation';}
};

// ================= PLANNING inputs =================
document.querySelectorAll('[data-pp]').forEach(el=>{el.oninput=el.onchange=()=>{ST.plan.params[el.dataset.pp]=el.value;save();planStale=true;};});
function bindPlanTop(){document.querySelectorAll('[data-pp]').forEach(el=>el.value=ST.plan.params[el.dataset.pp]??'');}
let planStale=true,lastPlan=null;
function renderFleetIn(){
  let h='<thead><tr><th class="l">Fleet type</th><th>Seats</th><th>Aircraft</th><th>Utilisation (BH/day)</th><th>Cost per BH</th><th>Fee per departure</th><th>Min turnaround (min)</th><th class="l">IATA type</th><th>Weekly BH budget</th><th></th></tr></thead><tbody>';
  ST.plan.fleets.forEach((f,i)=>{h+=`<tr><td class="l"><input class="t" data-i="${i}" data-k="type" value="${esc(f.type)}" style="width:110px"></td>
    <td><input type="number" data-i="${i}" data-k="seats" value="${esc(f.seats)}"></td><td><input type="number" data-i="${i}" data-k="count" value="${esc(f.count)}"></td>
    <td><input type="number" step="0.1" data-i="${i}" data-k="util" value="${esc(f.util)}"></td><td><input type="number" data-i="${i}" data-k="cost_bh" value="${esc(f.cost_bh)}"></td>
    <td><input type="number" data-i="${i}" data-k="fee_dep" value="${esc(f.fee_dep)}"></td><td><input type="number" data-i="${i}" data-k="turn" value="${esc(f.turn??45)}"></td><td class="l"><input class="t" data-i="${i}" data-k="iata" value="${esc(f.iata??'')}" style="width:56px;min-width:56px"></td><td class="bhb">${f0(num(f.count)*num(f.util)*7)}</td><td><button data-df="${i}" aria-label="Remove fleet">✕</button></td></tr>`;});
  $('fleetIn').innerHTML=h+'</tbody>';
  $('fleetIn').querySelectorAll('input').forEach(el=>{
    if(el.dataset.k==='type'){el.onchange=()=>{const f=ST.plan.fleets[+el.dataset.i],from=String(f.type),to=el.value.trim();
      if(!to||to===from){el.value=from;return;}
      if(ST.plan.fleets.some((x,j)=>j!==+el.dataset.i&&String(x.type).toUpperCase()===to.toUpperCase())){el.value=from;fleetMsg(`A fleet called ${to} already exists.`);return;}
      const n=renameFleet(from,to);save();planStale=true;renderFleetIn();renderRouteIn();fleetMsg(`Renamed ${from} to ${to}: ${n} references updated across routes, schedule, aircraft, crew and costs.`);};return;}
    el.oninput=()=>{const f=ST.plan.fleets[+el.dataset.i];f[el.dataset.k]=el.value;save();planStale=true;
      el.closest('tr').querySelector('.bhb').textContent=f0(num(f.count)*num(f.util)*7);};});
  $('fleetIn').querySelectorAll('[data-df]').forEach(b=>b.onclick=()=>{const t=String(ST.plan.fleets[+b.dataset.df].type),u=fleetUse(t),tot=Object.values(u).reduce((a,c)=>a+c,0);
    if(tot&&!confirm(`${t} is still used by ${Object.entries(u).filter(x=>x[1]).map(([k,v])=>`${v} ${k}`).join(', ')}. Remove it anyway? Routes currently flown by it will be moved to another allowed fleet.`))return;
    ST.plan.fleets.splice(+b.dataset.df,1);
    const U=s=>String(s||'').toUpperCase();
    ST.plan.routes.forEach(r=>{if(U(r.cur_fleet)===U(t)){const alt=ST.plan.fleets.find(f=>{const sp=String(r.fleets||'all').trim();return !sp||sp.toLowerCase()==='all'||sp.split(/[,;|]/).map(U).includes(U(f.type));});r.cur_fleet=alt?alt.type:'';}});
    save();planStale=true;renderFleetIn();renderRouteIn();
    if(tot)fleetMsg(`${t} removed. Schedule flights, aircraft and crew pool rows that used it are flagged in their checks until you reassign them.`);});
}
function fleetMsg(t){$('fleetMsg').textContent=t;setTimeout(()=>$('fleetMsg').textContent='',6000);}
// where a fleet type is referenced outside the fleet table
function fleetUse(t){const U=s=>String(s||'').toUpperCase(),T=U(t);
  return {'planning routes':ST.plan.routes.filter(r=>U(r.cur_fleet)===T).length,'scheduled flights':[...ST.sched.base,...ST.sched.prop].filter(f=>U(f.fleet)===T).length,
    'aircraft':ST.ops.tails.filter(x=>U(x.fleet)===T).length,'crew pool rows':ST.ops.pool.filter(x=>U(x.fleet)===T).length};}
function renameFleet(from,to){const U=s=>String(s||'').toUpperCase(),F=U(from);let n=0;
  const f=ST.plan.fleets.find(x=>U(x.type)===F);if(f)f.type=to;
  ST.plan.routes.forEach(r=>{if(U(r.cur_fleet)===F){r.cur_fleet=to;n++;}
    const sp=String(r.fleets||'').trim();if(sp&&sp.toLowerCase()!=='all'){const parts=sp.split(/[,;|]/).map(x=>x.trim());if(parts.some(x=>U(x)===F)){r.fleets=parts.map(x=>U(x)===F?to:x).join(',');n++;}}});
  [...ST.sched.base,...ST.sched.prop].forEach(x=>{if(U(x.fleet)===F){x.fleet=to;n++;}});
  ST.ops.tails.forEach(x=>{if(U(x.fleet)===F){x.fleet=to;n++;}});
  ST.ops.pool.forEach(x=>{if(U(x.fleet)===F){x.fleet=to;n++;}});
  ST.ops.leave.forEach(x=>{const p=String(x.crew||'').split('-');if(p.length>=3&&U(p[1])===F){p[1]=to;x.crew=p.join('-');n++;}});
  const mv=o=>{if(!o)return;const k=Object.keys(o).find(x=>U(x)===F);if(k!=null&&k!==to){o[to]=o[k];delete o[k];n++;}};
  mv(ST.ops.complement);mv(ST.com&&ST.com.costs&&ST.com.costs.lease);
  return n;}
function renderRouteIn(){
  const opts=ST.plan.fleets.map(f=>`<option value="${esc(f.type)}">${esc(f.type)}</option>`).join('');
  let h='<thead><tr><th class="l">Route</th><th>Block time (h, one way)</th><th>Distance (km)</th><th>Demand / wk / dir</th><th>Net fare</th><th>Current freq / wk</th><th class="l">Current fleet</th><th>Min freq</th><th>Max freq</th><th class="l">Allowed fleets</th><th></th></tr></thead><tbody>';
  ST.plan.routes.forEach((r,i)=>{h+=`<tr><td class="l"><input class="t" data-i="${i}" data-k="route" value="${esc(r.route)}" style="width:100px"></td>
    <td><input type="number" step="0.05" data-i="${i}" data-k="block" value="${esc(r.block)}"></td><td><input type="number" data-i="${i}" data-k="dist" value="${esc(r.dist??'')}"></td><td><input type="number" data-i="${i}" data-k="demand" value="${esc(r.demand)}"></td>
    <td><input type="number" data-i="${i}" data-k="fare" value="${esc(r.fare)}"></td><td><input type="number" data-i="${i}" data-k="cur_freq" value="${esc(r.cur_freq)}"></td>
    <td class="l"><select data-i="${i}" data-k="cur_fleet">${opts}</select></td><td><input type="number" data-i="${i}" data-k="min_freq" value="${esc(r.min_freq)}"></td>
    <td><input type="number" data-i="${i}" data-k="max_freq" value="${esc(r.max_freq)}"></td><td class="l"><input class="t" data-i="${i}" data-k="fleets" value="${esc(r.fleets)}" style="width:150px"></td>
    <td><button data-dr="${i}" aria-label="Remove route">✕</button></td></tr>`;});
  $('routeIn').innerHTML=h+'</tbody>';
  $('routeIn').querySelectorAll('select').forEach(el=>el.value=ST.plan.routes[+el.dataset.i].cur_fleet);
  $('routeIn').querySelectorAll('input,select').forEach(el=>el.oninput=el.onchange=()=>{ST.plan.routes[+el.dataset.i][el.dataset.k]=el.value;save();planStale=true;});
  $('routeIn').querySelectorAll('[data-dr]').forEach(b=>b.onclick=()=>{ST.plan.routes.splice(+b.dataset.dr,1);save();planStale=true;renderRouteIn();});
}
$('addFleet').onclick=()=>{ST.plan.fleets.push({type:'NEW',seats:180,count:1,util:12,cost_bh:14000,fee_dep:6000,turn:45});save();planStale=true;renderFleetIn();renderRouteIn();};
$('addRoute').onclick=()=>{ST.plan.routes.push({route:'AAA-BBB',block:2,dist:1000,demand:700,fare:500,cur_freq:7,cur_fleet:ST.plan.fleets[0]?.type||'',min_freq:0,max_freq:14,fleets:'all'});save();planStale=true;renderRouteIn();};
$('resetPlan').onclick=()=>{ST.plan=clone(window.DEMO_DATA.plan);save();planStale=true;bindPlanTop();renderFleetIn();renderRouteIn();};
$('goPlan').onclick=()=>{location.hash='#plan-results';};

// pull demand & prorated fares from the RM network into matching routes
$('syncRm').onclick=()=>{
  const legs=ST.rm.legs.map(l=>({code:String(l.leg).trim().toUpperCase(),dist:Math.max(1,num(l.dist,1))}));
  const dist=Object.fromEntries(legs.map(l=>[l.code,l.dist]));
  const agg={};
  ST.rm.prods.forEach(p=>{const codes=String(p.path||'').split('>').map(s=>s.trim().toUpperCase()).filter(Boolean);
    if(!codes.length||codes.some(c=>!(c in dist)))return;const tot=codes.reduce((s,c)=>s+dist[c],0),h=Math.max(0,num(p.hist));
    codes.forEach(c=>{(agg[c]=agg[c]||{d:0,rev:0});agg[c].d+=h;agg[c].rev+=h*num(p.fare)*dist[c]/tot;});});
  const done=[];
  ST.plan.routes.forEach(r=>{const code=String(r.route).trim().toUpperCase(),rev=code.split('-').reverse().join('-');
    const a=agg[code]||agg[rev];if(!a||a.d<=0)return;
    const f=Math.max(1,num(r.cur_freq,7));r.demand=Math.round(a.d*f);r.fare=Math.round(a.rev/a.d);done.push(`${code}: ${r.demand}/wk at ${money(r.fare)}`);});
  save();planStale=true;renderRouteIn();
  $('syncMsg').innerHTML=done.length?`Updated from RM (per-departure historical demand × current weekly frequency; fare = demand-weighted prorated O&amp;D fare): ${done.map(esc).join(' · ')}`:'No planning route matches an RM leg. Route codes must match leg codes (either direction).';
};

// ================= PLANNING results =================
async function doPlan(){
  const v=$('v-plan-results');v.classList.add('busy');$('planMeta').textContent='Optimising…';
  try{const P=await runPlanEngine();lastPlan=P;planStale=false;renderPlan(P);}finally{v.classList.remove('busy');}
}
$('runPlan').onclick=doPlan;
function renderPlan(P){
  const modeTxt=P.bh_mode==='current'?"re-allocating today's block hours":'using full fleet capacity';
  $('planMeta').innerHTML=`${esc(P.method)} · ${modeTxt}${P.elapsed_ms!=null?` · ${P.elapsed_ms} ms`:''}`;
  if(P.status==='infeasible'||P.status==='empty'){$('planKpis').innerHTML=kpiHtml([['No plan',P.status==='empty'?'No routes':'Infeasible',esc(P.message||'')]]);
    ['fleetOut','routeOut'].forEach(id=>$(id).innerHTML='');$('chBh').innerHTML='';$('chCpb').innerHTML='';return;}
  const T=P.total,C=P.current||{};const dC=T.contrib-(C.contrib||0);
  $('planKpis').innerHTML=kpiHtml([
    ['Weekly contribution, optimised',kmoney(T.contrib),`Current schedule ${kmoney(C.contrib)}`],
    ['Uplift vs current',(dC>=0?'+':'')+kmoney(dC),C.contrib?`${(dC/C.contrib*100).toFixed(1)}% per week · ≈ ${kmoney(dC*52)} per year`:''],
    ['Block hours / week',f0(T.bh),`Current ${f0(C.bh)} · budget ${f0((P.budgets||[]).reduce((a,b)=>a+b,0))}`],
    ['Passengers / week',f0(T.pax_wk),`Current ${f0(C.pax_wk)}`],
    ['Contribution per block hour',kmoney(T.bh?T.contrib/T.bh:0),`Current ${kmoney(C.bh?C.contrib/C.bh:0)}`]]);
  let h='<thead><tr><th class="l">Fleet</th><th>Aircraft</th><th>BH budget / wk</th><th>BH used / wk</th><th>Current BH / wk</th><th>Utilisation (BH/day/aircraft)</th><th>Value of +1 aircraft / wk</th><th>Value per extra BH</th></tr></thead><tbody>';
  P.fleets.forEach((f,k)=>{const util=num(ST.plan.fleets[k]?.util),perBh=f.value_extra_ac!=null&&util?f.value_extra_ac/(util*7):null;
    h+=`<tr><td class="l"><b>${esc(f.type)}</b></td><td>${f0(f.count)}</td><td>${f0(f.budget_bh)}</td><td>${f1(f.used_bh)}</td><td>${f1(C.bh_by_fleet?C.bh_by_fleet[k]:null)}</td><td>${f1(f.util_day)}</td><td>${kmoney(f.value_extra_ac)}</td><td>${money(perBh)}</td></tr>`;});
  $('fleetOut').innerHTML=h+'</tbody>';
  const rows=P.routes.map((r,i)=>({...r,i,curFleet:ST.plan.routes[i]?.cur_fleet}));
  h='<thead><tr><th class="l">Route</th><th class="l">Current</th><th class="l">Optimised</th><th>Change</th><th>Block hrs / wk</th><th>Seats / wk</th><th>Pax / wk</th><th>Load factor</th><th>Spill / wk</th><th>Revenue / wk</th><th>Cost / wk</th><th>Contribution / wk</th><th>Contrib. per BH</th><th>Next freq: gain per BH</th></tr></thead><tbody>';
  rows.forEach(r=>{const d=r.freq-num(r.cur_freq),fleetChg=r.fleet&&r.fleet!==r.curFleet&&r.freq>0;
    const chg=d===0&&!fleetChg?'<span class="note">–</span>':`<span class="chg ${d>0?'up':d<0?'dn':''}">${d>0?'+':''}${d!==0?d:''}</span>${fleetChg?' <span class="note small">fleet swap</span>':''}`;
    h+=`<tr class="${d!==0||fleetChg?'changed':''}"><td class="l"><b>${esc(r.route)}</b></td><td class="l">${f0(r.cur_freq)}× ${esc(r.curFleet||'')}</td><td class="l"><b>${r.freq?`${r.freq}× ${esc(r.fleet)}`:'Not operated'}</b></td><td>${chg}</td>
    <td>${f1(r.bh)}</td><td>${f0(r.seats_wk)}</td><td>${f0(r.pax_wk)}</td><td>${pct(r.lf)}</td><td>${f0(r.spill_wk)}</td><td>${kmoney(r.revenue)}</td><td>${kmoney(r.cost)}</td><td><b>${kmoney(r.contrib)}</b></td><td>${money(r.contrib_per_bh)}</td><td>${r.next?money(r.next.gain_per_bh):'<span class="note">at max</span>'}</td></tr>`;});
  $('routeOut').innerHTML=h+'</tbody>';
  bhChart($('chBh'),P.fleets.map(f=>f.type),P.fleets.map(f=>f.used_bh),P.fleets.map((_,k)=>C.bh_by_fleet?C.bh_by_fleet[k]:0),P.budgets||[]);
  const srt=rows.filter(r=>r.freq>0).sort((a,b)=>b.contrib_per_bh-a.contrib_per_bh);
  barChart($('chCpb'),srt.map(r=>r.route),[{name:'Contribution per BH',color:'var(--series-1)',vals:srt.map(r=>r.contrib_per_bh)}],cur()+' per block hour',v=>money(v),true);
}
$('copyPlan').onclick=()=>{if(!lastPlan||!lastPlan.routes)return;const rows=[['route','current_freq','current_fleet','opt_freq','opt_fleet','block_hours_wk','seats_wk','pax_wk','load_factor','revenue_wk','cost_wk','contribution_wk']];
  lastPlan.routes.forEach((r,i)=>rows.push([r.route,r.cur_freq,ST.plan.routes[i]?.cur_fleet||'',r.freq,r.fleet||'',r.bh.toFixed(1),Math.round(r.seats_wk),Math.round(r.pax_wk),r.lf.toFixed(3),Math.round(r.revenue),Math.round(r.cost),Math.round(r.contrib)]));
  copy(rows.map(r=>r.join(',')).join('\n'),$('planMsg'));};
$('applyPlan').onclick=()=>{if(!lastPlan||!lastPlan.routes)return;const e=num(ST.plan.params.elasticity,0.3);
  lastPlan.routes.forEach((r,i)=>{const rt=ST.plan.routes[i];if(!rt||r.freq<=0)return;const f0_=Math.max(1,num(rt.cur_freq,7));
    rt.demand=Math.round(num(rt.demand)*Math.pow(r.freq/f0_,e));rt.cur_freq=r.freq;rt.cur_fleet=r.fleet;});
  save();renderRouteIn();$('planMsg').textContent='Adopted. Demand rescaled to the new frequencies.';setTimeout(()=>$('planMsg').textContent='',3000);doPlan();};

// ================= benchmark =================
function renderBenchmark(){
  const T=(c,t)=>`<span class="tag ${c}">${t}</span><br>`;
  const rows=[
    ['Control','Bid prices per leg; itinerary accepted if fare ≥ sum of leg bid prices; leg-based control shown alongside.','O&amp;D control; availability for the whole network based on yield and bid price, with married-segment control.','Bid-price controls; earlier PROS O&amp;D optimiser also produced leg/segment allocations.','Classless: prices each seat continuously instead of opening and closing classes.'],
    ['Network optimisation','Network LP shadow prices + displacement-adjusted EMSR-b iterated to stable bid prices.','O&amp;D forecasting and optimisation across hubs, codeshares and partnerships.','Network optimisation recommending passenger mix per departure; earlier hybrid optimiser used dynamic programming.','Continuous price per seat per customer segment; network method not described publicly.'],
    ['Forecasting','Pickup / multiplicative blend by booking curve, unconstraining of closed classes, seasonality and event index, optimised overbooking.','AI-based demand forecasting that accounts for price sensitivity.','Elasticity-driven forecasting with machine learning and Bayesian updating.','AI-driven; segments customers by trip purpose and willingness to pay.'],
    ['Buy-down / willingness to pay','Hybrid forecast (product- vs price-oriented) with FRAT5 sell-up and marginal-revenue fare adjustment; simulation with willingness-to-pay customers.','Price sensitivity modelled; fare families for fenceless fares.','Elasticity modelled; hybrid forecasting blends product- and price-sensitive demand.','Core of the product.'],
    ['Dynamic pricing','Static fares per sector and RBD with surcharge and promotion rules; no dynamic pricing.','Fare-family optimisation; dynamic pricing not described on the NRM page.','Dynamic pricing on a continuous price curve (RTDP).','Continuous, classless pricing; works alongside partners still on fare rules.'],
    ['Link to network planning','Built in: planning uses RM demand and prorated fares; block-hour value per fleet.','Separate products.','Separate products.','Separate products.'],
    ['Fare management','Base fares per sector and RBD, surcharge and promotion rules with validity, sector tax table, price list and push of net fares to RM.','Fares come from separate pricing/filing systems.','Dynamic pricing (RTDP) adjusts prices; fare filing separate.','Continuous offer pricing; fare filing separate.'],
    ['Operations','Weekly tail assignment with maintenance days and overrides; crew duties under configurable FDP limits and a rule-checked weekly roster (planning-level, not certified).','Not part of the RM product compared.','Not part of the RM product compared.','Not part of the RM product compared.'],
    ['Schedule change impact','Flight-level retiming, equipment and day changes checked for rotations, block hours, hub connections, RM O&amp;Ds at risk and contribution.','Separate schedule products.','Not part of RM.','Separate products.'],
    ['Route profitability & dashboard','Full-cost route P&amp;L (ownership, overheads, fuel index, distribution, ancillaries) and an executive dashboard with budget comparison and cross-module alerts.','Separate products.','Separate products.','Separate products.'],
    ['Ancillaries, sales & distribution','Ancillary catalogue with take rates, fare families and rules, channel cost model, corporate contract compliance.','Separate merchandising products.','Ancillary merchandising in the PROS retail suite.','Ancillary, bundle and upgrade optimisation products.'],
    ['Market intelligence','Competitor frequency and fare position, simple share model; CSV import from scrapers.','Not part of the RM product compared.','Uses competitive fare data in pricing.','Not described publicly.'],
    ['Interline & codeshare','SPA and mileage prorate with settlement by carrier.','Separate revenue accounting products.','Not part of RM.','Separate products.'],
    ['Governance','Role-based tokens (viewer/analyst/admin), tenant isolation, audit log, scenario approval.','Enterprise product.','Enterprise product.','Enterprise product.'],
    ['Simulation & what-if','Monte Carlo vs perfect hindsight; scenario store.','Simulations, analytics and alerts.','Not described on the public product page.','Not described publicly.'],
    ['Transparency','Every formula visible; open Python engine.','Proprietary.','Proprietary.','Proprietary.']];
  const lvl=[['p','Partial'],['p','Partial'],['p','Basic+'],['p','Yes (core)'],['n','No (static)'],['y','Yes'],['p','Basic'],['p','Planning-level'],['y','Yes'],['y','Yes'],['p','Basic'],['p','Basic'],['p','Basic'],['p','Basic'],['y','Yes'],['y','Full']];
  let h='<thead><tr><th>Capability</th><th>This suite</th><th>Amadeus Network RM</th><th>PROS Revenue Management</th><th>SabreMosaic CRO</th></tr></thead><tbody>';
  rows.forEach((r,i)=>{h+=`<tr><td>${r[0]}</td><td>${T(lvl[i][0],lvl[i][1])}${r[1]}</td><td>${r[2]}</td><td>${r[3]}</td><td>${r[4]}</td></tr>`;});
  $('bmTbl').innerHTML=h+'</tbody>';
}

// ================= data: CSV & scenarios =================
function fillCsv(){
  $('legCsv').value='leg,capacity,distance,rms_bid_price,noshow_pct\n'+ST.rm.legs.map(l=>[l.leg,l.cap,l.dist,l.ref??'',l.noshow??''].join(',')).join('\n');
  $('prodCsv').value='od,path,rbd,fare,hist_final,booked,curve,closed_dtd\n'+ST.rm.prods.map(p=>[p.od,p.path,p.rbd,p.fare,p.hist,p.otb,p.curve,p.closed_dtd??''].join(',')).join('\n');
  $('fleetCsv').value='type,seats,count,util_h_day,cost_per_bh,fee_per_dep,turn_min,iata\n'+ST.plan.fleets.map(f=>[f.type,f.seats,f.count,f.util,f.cost_bh,f.fee_dep,f.turn??45,f.iata??''].join(',')).join('\n');
  $('schedCsv').value='flight,from,to,dep_hhmm,block_hmm,days,fleet,status\n'+ST.sched.prop.map(f=>[f.fn,f.org,f.dst,f.dep,f.block,f.days,f.fleet,f.status||'active'].join(',')).join('\n');
  $('routeCsv').value='route,block_h,demand_wk_dir,net_fare,cur_freq,cur_fleet,min_freq,max_freq,fleets,dist_km\n'+ST.plan.routes.map(r=>[r.route,r.block,r.demand,r.fare,r.cur_freq,r.cur_fleet,r.min_freq,r.max_freq,String(r.fleets).replace(/,/g,'|'),r.dist??''].join(',')).join('\n');
}
const parseCsv=t=>t.split(/\r?\n/).map(r=>r.trim()).filter(Boolean).map(r=>r.split(/[,;\t]/).map(c=>c.trim()));
const dropHeader=(rows,col)=>{if(rows.length&&isNaN(parseFloat(rows[0][col])))rows.shift();return rows;};
const loaders={
  legs:()=>{const r=dropHeader(parseCsv($('legCsv').value),1).filter(x=>x[0]);if(!r.length)return 0;const oldNs={};ST.rm.legs.forEach(l=>oldNs[String(l.leg).toUpperCase()]=l.noshow);
    ST.rm.legs=r.map(x=>{const leg=x[0].toUpperCase();return {leg,cap:num(x[1]),dist:num(x[2],1000),ref:x[3]||'',noshow:x[4]!=null&&x[4]!==''?num(x[4],6):(oldNs[leg]??6)};});renderLegIn();schedRm();return r.length;},
  prods:()=>{const r=dropHeader(parseCsv($('prodCsv').value),3).filter(x=>x.length>=6);if(!r.length)return 0;
    ST.rm.prods=r.map(x=>({od:x[0].toUpperCase(),path:x[1].toUpperCase(),rbd:x[2],fare:num(x[3]),hist:num(x[4]),otb:num(x[5]),curve:['early','mid','late'].includes((x[6]||'').toLowerCase())?x[6].toLowerCase():'mid',closed_dtd:x[7]||''}));renderProdIn();schedRm();return r.length;},
  fleets:()=>{const r=dropHeader(parseCsv($('fleetCsv').value),1).filter(x=>x[0]);if(!r.length)return 0;
    const oldF={};ST.plan.fleets.forEach(f=>oldF[String(f.type).toUpperCase()]=f);
    ST.plan.fleets=r.map(x=>{const o=oldF[String(x[0]).toUpperCase()]||{};return {type:x[0],seats:num(x[1]),count:num(x[2]),util:num(x[3]),cost_bh:num(x[4]),fee_dep:num(x[5]),
      turn:x[6]!=null&&x[6]!==''?num(x[6],45):(o.turn??45),iata:x[7]!=null&&x[7]!==''?x[7].toUpperCase():(o.iata??'')};});planStale=true;renderFleetIn();renderRouteIn();return r.length;},
  sched:()=>{const r=parseCsv($('schedCsv').value).filter(x=>x.length>=7&&x[0]&&!/^flight$/i.test(x[0]));if(!r.length)return 0;
    const fl=r.map((x,i)=>({id:'F'+i+'_'+x[0],fn:x[0],org:x[1].toUpperCase(),dst:x[2].toUpperCase(),dep:x[3],block:x[4],days:E.normDays(x[5]),fleet:x[6],status:(x[7]||'active').toLowerCase()}));
    ST.sched.base=fl;ST.sched.prop=clone(fl);renderFlTbl();return r.length;},
  routes:()=>{const r=dropHeader(parseCsv($('routeCsv').value),1).filter(x=>x[0]);if(!r.length)return 0;
    const oldD={};ST.plan.routes.forEach(rt=>oldD[String(rt.route).toUpperCase()]=rt.dist);(window.DEMO_DATA.plan.routes||[]).forEach(rt=>{if(oldD[rt.route]==null)oldD[rt.route]=rt.dist;});
    ST.plan.routes=r.map(x=>{const route=x[0].toUpperCase();return {route,block:num(x[1]),demand:num(x[2]),fare:num(x[3]),cur_freq:num(x[4]),cur_fleet:x[5]||'',min_freq:num(x[6]),max_freq:num(x[7],14),fleets:(x[8]||'all').replace(/\|/g,','),
      dist:x[9]!=null&&x[9]!==''?num(x[9],1000):(oldD[route]??1000)};});planStale=true;renderRouteIn();return r.length;}
};
document.querySelectorAll('[data-load]').forEach(b=>b.onclick=()=>{const n=loaders[b.dataset.load]();save();$('csvMsg').textContent=n?`Loaded ${n} ${b.dataset.load}.`:'No rows found.';});
document.querySelectorAll('[data-file]').forEach(inp=>inp.onchange=e=>{const f=e.target.files[0];if(!f)return;f.text().then(t=>{$(inp.dataset.file).value=t;inp.previousElementSibling.click();});});

function localScenarios(){try{return JSON.parse(store.get(SC_KEY)||'[]');}catch(e){return [];}}
let me=null;
async function renderGov(){
  if(!server){$('govCard').style.display='none';return;}
  try{me=await api('/api/whoami',null,'GET');}catch(e){me=null;}
  $('govCard').style.display='';
  $('govWho').innerHTML=me?`Signed in as <b>${esc(me.role)}</b> for tenant <b>${esc(me.tenant)}</b>${me.open?' · <span class="chg dn">open mode: no API tokens configured on the server</span>':''}. Viewers can run calculations; analysts can also save scenarios; admins can also approve and delete scenarios and read this audit log.`:'Could not identify the user.';
  if(me&&me.role==='admin'){try{const log=await api('/api/audit',null,'GET');
    $('auditTbl').innerHTML='<thead><tr><th class="l">Time (UTC)</th><th class="l">Role</th><th class="l">Action</th><th class="l">Detail</th></tr></thead><tbody>'+(log.map(e=>`<tr><td class="l note">${esc(e.ts)}</td><td class="l">${esc(e.role)}</td><td class="l"><b>${esc(e.action)}</b></td><td class="l note">${esc(e.detail||'')}</td></tr>`).join('')||'<tr><td class="l note">No entries yet.</td></tr>')+'</tbody>';}catch(e){$('auditTbl').innerHTML='';}}
  else $('auditTbl').innerHTML='';
}
async function renderScenarios(){renderGov();
  let list=[];try{list=server?await api('/api/scenarios',null,'GET'):localScenarios().map(s=>({id:s.id,name:s.name,kind:s.kind,created_at:s.created_at}));}catch(e){$('scMsg').textContent='Could not load scenarios: '+e.message;}
  const isAdmin=!server||(me&&me.role==='admin');
  $('scTbl').innerHTML=list.length?'<thead><tr><th class="l">Name</th><th class="l">Saved</th><th class="l">Status</th><th></th></tr></thead><tbody>'+list.map(s=>`<tr><td class="l"><b>${esc(s.name)}</b></td><td class="l note">${esc(s.created_at)}</td>
    <td class="l">${(s.status||'draft')==='approved'?'<span class="pill open"><span class="dot">✓</span>Approved</span>':'<span class="note">Draft</span>'}</td>
    <td><button data-ld="${s.id}">Load</button>${server&&isAdmin&&(s.status||'draft')!=='approved'?` <button data-ap="${s.id}">Approve</button>`:''}${isAdmin?` <button data-del="${s.id}" aria-label="Delete scenario">✕</button>`:''}</td></tr>`).join('')+'</tbody>':'<tbody><tr><td class="l note">No saved scenarios yet.</td></tr></tbody>';
  $('scTbl').querySelectorAll('[data-ld]').forEach(b=>b.onclick=async()=>{const id=+b.dataset.ld;let s;
    s=server?(await api('/api/scenarios/'+id,null,'GET')).payload:localScenarios().find(x=>x.id===id)?.payload;
    if(s&&s.rm&&s.plan){ST=migrate(clone(s));lastPrice=null;lastCom=null;save();renderAll();$('scMsg').textContent='Scenario loaded.';}
    else $('scMsg').textContent='Scenario could not be loaded (no RM or planning data).';});
  $('scTbl').querySelectorAll('[data-ap]').forEach(b=>b.onclick=async()=>{try{await api('/api/scenarios/'+b.dataset.ap+'/approve',{});$('scMsg').textContent='Scenario approved.';}catch(e){$('scMsg').textContent='Approve failed: '+e.message;}renderScenarios();});
  $('scTbl').querySelectorAll('[data-del]').forEach(b=>b.onclick=async()=>{const id=+b.dataset.del;
    if(server)await api('/api/scenarios/'+id,null,'DELETE');else store.set(SC_KEY,JSON.stringify(localScenarios().filter(x=>x.id!==id)));renderScenarios();});
}
$('scSave').onclick=async()=>{const name=$('scName').value.trim()||('Scenario '+new Date().toISOString().slice(0,16).replace('T',' '));
  try{await saveScenario(name,ST);$('scMsg').textContent='Saved.';$('scName').value='';renderScenarios();}catch(e){$('scMsg').textContent='Save failed: '+e.message;}};
async function saveScenario(name,payload){
  if(server)await api('/api/scenarios',{name,kind:'suite',payload});
  else{const l=localScenarios();l.unshift({id:Date.now(),name,kind:'suite',created_at:new Date().toISOString().slice(0,19),payload:clone(payload)});store.set(SC_KEY,JSON.stringify(l.slice(0,30)));}}
$('apiBase').value=cfg.base;$('apiTenant').value=cfg.tenant;$('apiToken').value=cfg.token;
$('apiSave').onclick=async()=>{cfg={base:$('apiBase').value.trim().replace(/\/$/,''),tenant:$('apiTenant').value.trim()||'demo',token:$('apiToken').value};
  store.set(CFG_KEY,JSON.stringify(cfg));await detect();planStale=true;renderScenarios();schedRm();};


// ================= SCHEDULE CHANGES =================
let lastSched=null,schedTimer=null,schedSeq=0;
const rmOds=()=>ST.rm.prods.filter(p=>String(p.path||'').includes('>')).map(p=>({od:p.od,path:p.path}));
document.querySelectorAll('[data-sp]').forEach(el=>{el.oninput=el.onchange=()=>{ST.sched.params[el.dataset.sp]=el.value;save();schedSched();};});
function bindSchedTop(){document.querySelectorAll('[data-sp]').forEach(el=>el.value=ST.sched.params[el.dataset.sp]??'');
  $('stnOffsets').value=Object.entries(ST.sched.station_offsets||{}).map(([k,v])=>`${k}:${v}`).join(', ');}
$('stnOffsets').oninput=()=>{const o={};$('stnOffsets').value.split(',').forEach(x=>{const [k,v]=x.split(':').map(y=>(y||'').trim());if(k&&v)o[k.toUpperCase()]=v;});ST.sched.station_offsets=o;save();};
const ssimArgs=()=>[ST.sched.prop,ST.plan,(ST.com&&ST.com.own_carrier)||'ZZ',ST.sched.params.utc_offset||'+0300',ST.sched.params.period_from||'',ST.sched.params.period_to||'',ST.sched.station_offsets||{}];
$('ssimExport').onclick=async()=>{let t;const a=ssimArgs();
  if(server){try{const h={'Content-Type':'application/json','X-Tenant':cfg.tenant||'demo'};if(cfg.token)h.Authorization='Bearer '+cfg.token;
    const r=await fetch((cfg.base||'')+'/api/schedule/ssim/export',{method:'POST',headers:h,body:JSON.stringify({sched:a[0],plan:a[1],airline:a[2],ref_offset:a[3],period_from:a[4],period_to:a[5],station_offsets:a[6]})});if(r.ok)t=await r.text();}catch(e){}}
  if(!t)t=E.ssimExport(...a);$('ssimText').value=t;$('ssimCard').style.display='';flash(`SSIM generated: ${t.split('\n').filter(l=>l[0]==='3').length} flight legs.`);};
$('ssimImportBtn').onclick=()=>{$('ssimText').value='';$('ssimCard').style.display='';$('ssimFile').click();};
$('ssimFile').onchange=e=>{const f=e.target.files[0];if(f)f.text().then(t=>{$('ssimText').value=t;});};
$('ssimClose').onclick=()=>{$('ssimCard').style.display='none';};
$('ssimCopy').onclick=()=>copy($('ssimText').value,$('schedMsg'));
$('ssimLoad').onclick=async()=>{const txt=$('ssimText').value;let r;
  if(server){try{r=await api('/api/schedule/ssim/import',{text:txt,plan:ST.plan,ref_offset:ST.sched.params.utc_offset||'+0300'});}catch(e){}}
  if(!r)r=E.ssimImport(txt,ST.plan,ST.sched.params.utc_offset||'+0300');
  if(!r.flights.length){flash('No flight leg (type 3) records found.');return;}
  const idx={};ST.sched.base.forEach(f=>{const k=`${f.fn}|${String(f.org).toUpperCase()}|${String(f.dst).toUpperCase()}`;(idx[k]=idx[k]||[]).push(f.id);});
  r.flights.forEach(f=>{const k=`${f.fn}|${f.org}|${f.dst}`;if(idx[k]&&idx[k].length)f.id=idx[k].shift();});
  ST.sched.prop=r.flights;save();renderFlTbl();updateSched();$('ssimCard').style.display='none';
  flash(`Loaded ${r.flights.length} flight legs as the proposed schedule${r.warnings.length?` · ${r.warnings.length} warnings: ${r.warnings.slice(0,2).join('; ')}`:''}. Use "Set proposed as baseline" to make it the reference.`);};
function schedSched(){clearTimeout(schedTimer);schedTimer=setTimeout(updateSched,server?350:80);}
async function runSchedEngine(){
  if(server){try{return await api('/api/schedule/analyze',{sched:ST.sched,plan:ST.plan,rm_ods:rmOds()});}catch(e){console.warn('server schedule failed, using browser',e);}}
  return E.schedAnalyzeChange(ST.sched,ST.plan,rmOds());
}
const baseById=()=>{const m={};ST.sched.base.forEach(f=>m[String(f.id)]=f);return m;};
function flChange(f,bm){const o=bm[String(f.id)];if(!o)return 'New';
  if(String(f.status||'active')==='cancelled'&&String(o.status||'active')!=='cancelled')return 'Cancelled';
  const t=[];if(E.parseTime(f.dep)!==E.parseTime(o.dep)||E.parseBlock(f.block)!==E.parseBlock(o.block))t.push('Retimed');
  if(E.normDays(f.days)!==E.normDays(o.days))t.push('Days');if(String(f.fleet).toUpperCase()!==String(o.fleet).toUpperCase())t.push('Equipment');
  if(String(f.org).toUpperCase()!==String(o.org).toUpperCase()||String(f.dst).toUpperCase()!==String(o.dst).toUpperCase())t.push('Routing');
  return t.join(', ');}
function arrText(f){const d=E.parseTime(f.dep),b=E.parseBlock(f.block);return d==null||!b?'–':E.fmtTime(d+b);}
function renderFlTbl(){
  const q=($('flFilter').value||'').trim().toUpperCase(),only=$('flChanged').checked,bm=baseById();
  const fleetOpts=ST.plan.fleets.map(f=>`<option value="${esc(f.type)}">${esc(f.type)}</option>`).join('');
  let h='<thead><tr><th class="l">Flight</th><th class="l">From</th><th class="l">To</th><th>Dep</th><th>Block</th><th>Arr</th><th class="l">Days</th><th class="l">Fleet</th><th class="l">Status</th><th class="l">Change vs baseline</th><th></th></tr></thead><tbody>';
  ST.sched.prop.forEach((f,i)=>{const chg=flChange(f,bm);
    if(q&&![f.fn,f.org,f.dst,f.fleet].some(x=>String(x||'').toUpperCase().includes(q)))return;if(only&&!chg)return;
    h+=`<tr class="${chg?'changed':''}"><td class="l"><input class="t" data-i="${i}" data-k="fn" value="${esc(f.fn)}" style="width:76px;min-width:76px"></td>
    <td class="l"><input class="t" data-i="${i}" data-k="org" value="${esc(f.org)}" style="width:58px;min-width:58px"></td><td class="l"><input class="t" data-i="${i}" data-k="dst" value="${esc(f.dst)}" style="width:58px;min-width:58px"></td>
    <td><input data-i="${i}" data-k="dep" value="${esc(f.dep)}" style="width:70px;min-width:70px"></td><td><input data-i="${i}" data-k="block" value="${esc(f.block)}" style="width:62px;min-width:62px"></td>
    <td class="arr">${arrText(f)}</td><td class="l"><input class="t" data-i="${i}" data-k="days" value="${esc(f.days)}" style="width:84px;min-width:84px"></td>
    <td class="l"><select data-i="${i}" data-k="fleet">${fleetOpts}</select></td>
    <td class="l"><select data-i="${i}" data-k="status"><option value="active">Active</option><option value="cancelled">Cancelled</option></select></td>
    <td class="l chgc">${chg?`<span class="chg ${chg==='Cancelled'?'dn':'up'}">${esc(chg)}</span>`:'<span class="note">–</span>'}</td>
    <td><button data-dup="${i}" title="Duplicate flight" aria-label="Duplicate flight">⧉</button> <button data-dfl="${i}" title="Remove flight" aria-label="Remove flight">✕</button></td></tr>`;});
  $('flTbl').innerHTML=h+'</tbody>';
  $('flTbl').querySelectorAll('select').forEach(el=>el.value=ST.sched.prop[+el.dataset.i][el.dataset.k]||(el.dataset.k==='status'?'active':''));
  $('flTbl').querySelectorAll('input,select').forEach(el=>el.oninput=el.onchange=()=>{const f=ST.sched.prop[+el.dataset.i];f[el.dataset.k]=el.dataset.k==='org'||el.dataset.k==='dst'?el.value.toUpperCase():el.value;save();
    const tr=el.closest('tr');tr.querySelector('.arr').textContent=arrText(f);const c=flChange(f,baseById());tr.classList.toggle('changed',!!c);
    tr.querySelector('.chgc').innerHTML=c?`<span class="chg ${c==='Cancelled'?'dn':'up'}">${esc(c)}</span>`:'<span class="note">–</span>';schedSched();});
  $('flTbl').querySelectorAll('[data-dup]').forEach(b=>b.onclick=()=>{const f=clone(ST.sched.prop[+b.dataset.dup]);f.id='N'+Date.now().toString(36)+Math.random().toString(36).slice(2,5);f.fn=f.fn+'X';
    ST.sched.prop.splice(+b.dataset.dup+1,0,f);save();renderFlTbl();schedSched();});
  $('flTbl').querySelectorAll('[data-dfl]').forEach(b=>b.onclick=()=>{ST.sched.prop.splice(+b.dataset.dfl,1);save();renderFlTbl();schedSched();});
}
$('flFilter').oninput=renderFlTbl;$('flChanged').onchange=renderFlTbl;
$('addFlight').onclick=()=>{const fl=ST.plan.fleets[0]?.type||'';ST.sched.prop.unshift({id:'N'+Date.now().toString(36),fn:'ZZ900',org:'RUH',dst:'JED',dep:'12:00',block:'1:54',days:'1234567',fleet:fl,status:'active'});
  save();$('flFilter').value='';renderFlTbl();schedSched();};
$('setBaseline').onclick=()=>{ST.sched.base=clone(ST.sched.prop);save();renderFlTbl();schedSched();flash('Proposed schedule is now the baseline.');};
$('resetProp').onclick=()=>{ST.sched.prop=clone(ST.sched.base);save();renderFlTbl();schedSched();flash('Proposed schedule reset to baseline.');};
function flash(t){$('schedMsg').textContent=t;setTimeout(()=>$('schedMsg').textContent='',4000);}
$('rotDay').onchange=()=>lastSched&&renderSched(lastSched);$('rotWhich').onchange=()=>lastSched&&renderSched(lastSched);
$('copyChanges').onclick=()=>{if(!lastSched)return;const rows=[['type','flight','before','after']];lastSched.changes.forEach(c=>rows.push([c.type,c.flight,c.before,c.after]));
  copy(rows.map(r=>r.map(x=>/[,"]/.test(String(x))?`"${String(x).replace(/"/g,'""')}"`:x).join(',')).join('\n'),$('schedMsg'));};

async function updateSched(){const seq=++schedSeq;const R=await runSchedEngine();if(seq!==schedSeq)return;lastSched=R;renderSched(R);}
function renderSched(R){
  const B=R.base,P=R.prop,arrow=(a,b,fmt=f0)=>a===b?fmt(b):`${fmt(a)} → <b>${fmt(b)}</b>`;
  const connCount=A=>Object.values(A.connections).filter(c=>c.days>0).length;
  const dC=P.contrib_total-B.contrib_total;
  const k=[['Changes vs baseline',`${R.changes.length}`,R.changes.length?[...new Set(R.changes.map(c=>c.type))].join(' · '):'No changes yet'],
    ['Flights / week',arrow(B.flights_wk,P.flights_wk),`Block hours ${arrow(B.bh_wk,P.bh_wk)}`]];
  P.fleets.forEach((f,i)=>{const b=B.fleets[i]||{};const over=f.required_max>f.count;
    k.push([`${esc(f.type)} aircraft needed`,`<span style="color:${over?'var(--critical)':'inherit'}">${f.required_max} of ${f0(f.count)}</span>`,`Block hours ${arrow(b.bh_wk,f.bh_wk)} of ${f0(f.budget_bh)}`]);});
  k.push(['Hub connections',arrow(connCount(B),connCount(P)),'Connecting city pairs with at least one day']);
  k.push(['Weekly contribution',kmoney(P.contrib_total),`${dC>=0?'+':''}${kmoney(dC)} vs baseline`]);
  $('schedKpis').innerHTML=kpiHtml(k);
  // checks
  const newRisk=P.rm_at_risk.filter(x=>!B.rm_at_risk.includes(x)),oldRisk=P.rm_at_risk.filter(x=>B.rm_at_risk.includes(x));
  const items=[];
  newRisk.forEach(x=>items.push(`<b style="color:var(--critical)">RM connecting O&amp;D loses all connections:</b> ${esc(x)}. Close it in RM or retime.`));
  P.warnings.forEach(w=>items.push((B.warnings.includes(w)?'':'<b>New:</b> ')+esc(w)));
  oldRisk.forEach(x=>items.push(`RM sells ${esc(x)} but the schedule has no connection for it (also in baseline).`));
  $('schedWarn').innerHTML=items.length?'<ul style="margin:0;padding-left:18px">'+items.map(i=>`<li>${i}</li>`).join('')+'</ul>':'<span class="pill open"><span class="dot">✓</span>All checks pass</span>';
  // change list
  $('chgTbl').innerHTML=R.changes.length?'<thead><tr><th class="l">Change</th><th class="l">Flight</th><th class="l">Before</th><th class="l">After</th></tr></thead><tbody>'+
    R.changes.map(c=>`<tr><td class="l"><b>${esc(c.type)}</b></td><td class="l">${esc(c.flight)}</td><td class="l note">${esc(c.before)}</td><td class="l">${esc(c.after)}</td></tr>`).join('')+'</tbody>':'<tbody><tr><td class="l note">No changes. Edit the proposed schedule above.</td></tr></tbody>';
  // route impact
  const rb={};B.routes.forEach(r=>rb[r.route]=r);const rp={};P.routes.forEach(r=>rp[r.route]=r);
  const keys=[...new Set([...Object.keys(rb),...Object.keys(rp)])].sort();
  $('rtImpact').innerHTML='<thead><tr><th class="l">Route</th><th>Round trips / wk</th><th class="l">Fleet</th><th>Contribution / wk</th><th>Change</th></tr></thead><tbody>'+keys.map(k=>{const a=rb[k]||{round_trips:0,fleet:'',contrib:0},b=rp[k]||{round_trips:0,fleet:'',contrib:0};
    const d=(b.contrib||0)-(a.contrib||0),ch=a.round_trips!==b.round_trips||a.fleet!==b.fleet;
    return `<tr class="${ch?'changed':''}"><td class="l"><b>${esc(k)}</b></td><td>${a.round_trips===b.round_trips?f1(b.round_trips):`${f1(a.round_trips)} → <b>${f1(b.round_trips)}</b>`}</td><td class="l">${a.fleet===b.fleet?esc(b.fleet):`${esc(a.fleet)} → <b>${esc(b.fleet)}</b>`}</td><td>${kmoney(b.contrib)}</td><td>${Math.abs(d)<1?'<span class="note">–</span>':`<span class="chg ${d>0?'up':'dn'}">${d>0?'+':''}${kmoney(d)}</span>`}</td></tr>`;}).join('')+'</tbody>';
  // connections
  const ck=[...new Set([...Object.keys(B.connections),...Object.keys(P.connections),...B.rm_at_risk,...P.rm_at_risk])];
  const rmSet=new Set(rmOds().map(o=>{const l=o.path.split('>').map(x=>x.trim().toUpperCase());return `${l[0].split('-')[0]}-${l[l.length-1].split('-')[1]} via ${l[0].split('-')[1]}`;}));
  const rows=ck.map(k=>{const a=B.connections[k]||{days:0},b=P.connections[k]||{days:0};return {k,a,b,rm:rmSet.has(k),d:b.days-a.days};})
    .sort((x,y)=>(x.d-y.d)||(y.rm-x.rm)||(x.k<y.k?-1:1));
  $('connTbl').innerHTML='<thead><tr><th class="l">Connection</th><th class="l">RM</th><th>Baseline days / wk</th><th>Proposed days / wk</th><th>Shortest connect (min)</th><th class="l">Status</th></tr></thead><tbody>'+rows.map(r=>{
    const st=r.b.days===0&&r.a.days>0?'<span class="pill closed"><span class="dot">✕</span>Lost</span>':r.a.days===0&&r.b.days>0?'<span class="pill open"><span class="dot">✓</span>New</span>':r.d<0?'<span class="chg dn">Fewer days</span>':r.d>0?'<span class="chg up">More days</span>':r.b.days===0?'<span class="note">None</span>':'<span class="note">Unchanged</span>';
    return `<tr class="${r.d!==0?'changed':''}"><td class="l"><b>${esc(r.k)}</b></td><td class="l">${r.rm?'<span class="tag p">RM</span>':''}</td><td>${r.a.days}</td><td>${r.b.days}</td><td>${r.b.best_ct??'–'}</td><td class="l">${st}</td></tr>`;}).join('')+'</tbody>';
  // rotations
  const which=$('rotWhich').value,A=which==='base'?B:P,day=$('rotDay').value,src=which==='base'?ST.sched.base:ST.sched.prop,bm=baseById();
  const byId={};src.forEach(f=>byId[String(f.id)]=f);
  $('rotCharts').innerHTML=A.fleets.map((f,i)=>`<h3>${esc(f.type)} · ${f.required_by_day[+day-1]} aircraft needed of ${f0(f.count)}</h3><div class="chart" id="gantt${i}"></div>`).join('');
  A.fleets.forEach((f,i)=>gantt($(`gantt${i}`),(A.rotations[f.type]||{})[day]||[],byId,bm,which,f.count));
}
function gantt(el,rows,byId,bm,which,avail,hiFn){
  const W=1100,rowH=30,m={l:70,r:16,t:20,b:22},H=m.t+m.b+rowH*Math.max(1,rows.length),iw=W-m.l-m.r;
  let mx=24*60;rows.forEach(r=>r.flights.forEach(id=>{const f=byId[String(id)];if(f){const a=E.parseTime(f.dep)+E.parseBlock(f.block);if(a>mx)mx=a;}}));
  const x0=4*60,x1=Math.max(24*60,Math.ceil(mx/60)*60),sx=t=>m.l+(t-x0)/(x1-x0)*iw;let g='';
  for(let t=x0;t<=x1;t+=120){g+=`<line x1="${sx(t)}" x2="${sx(t)}" y1="${m.t}" y2="${H-m.b}" stroke="var(--grid)"/><text x="${sx(t)}" y="${m.t-6}" text-anchor="middle" font-size="10.5" fill="var(--text-muted)">${E.fmtTime(t)}</text>`;}
  if(!rows.length)g+=`<text x="${W/2}" y="${m.t+18}" text-anchor="middle" font-size="12" fill="var(--text-muted)">No flights this day</text>`;
  rows.forEach((r,ri)=>{const y=m.t+ri*rowH+5,over=ri>=avail;
    const lab=r.label||((over?'⚠ ':'')+'AC '+(ri+1));
    g+=`<text x="${m.l-8}" y="${y+14}" text-anchor="end" font-size="11.5" font-weight="600" fill="${over&&!r.label?'var(--critical)':'var(--text-secondary)'}">${esc(lab)}</text>`;
    if(r.note)g+=`<text x="${m.l+6}" y="${y+14}" font-size="11" fill="var(--text-muted)">${esc(r.note)}</text>`;
    r.flights.forEach(id=>{const f=byId[String(id)];if(!f)return;const d=E.parseTime(f.dep),a=d+E.parseBlock(f.block);const xa=sx(Math.max(d,x0)),xb=sx(a),w=Math.max(2,xb-xa);
      const chg=hiFn?hiFn(r,f):(which==='prop'&&!!flChange(f,bm));
      g+=`<rect x="${xa}" y="${y}" width="${w}" height="${rowH-10}" rx="4" fill="${chg?'var(--series-2)':'var(--series-1)'}" data-t="${esc(f.fn)}|${esc(f.org)}-${esc(f.dst)}|${esc(f.dep)}|${E.fmtTime(a)}|${esc(f.fleet)}" data-fid="${esc(f.id)}" style="cursor:pointer"/>`;
      if(w>54)g+=`<text x="${xa+5}" y="${y+14}" font-size="10.5" fill="#fff" pointer-events="none">${esc(f.fn)} ${esc(f.org)}–${esc(f.dst)}</text>`;});});
  el.innerHTML=`<div class="scroll"><svg viewBox="0 0 ${W} ${H}" style="min-width:820px" role="img" aria-label="Aircraft rotations">${g}</svg></div>`;
  el.querySelectorAll('[data-t]').forEach(r=>{r.addEventListener('mousemove',e=>{const [fn,rt,d,a,fl]=r.dataset.t.split('|');showTip(e,`<b>${esc(fn)}</b> ${esc(rt)}<br>${esc(d)} → ${esc(a)}<br>${esc(fl)}<br><span class="note">Click to open the flight</span>`);});r.addEventListener('mouseleave',hideTip);
    r.addEventListener('click',()=>pick(el,{fn:r.dataset.t.split('|')[0],id:r.dataset.fid}));});
}

// optimised plan -> draft schedule (frequencies and fleets); planners then retime
$('draftFromPlan').onclick=async()=>{
  if(!lastPlan||planStale){flash('Optimising block hours first…');await doPlan();}
  const P=lastPlan;if(!P||!P.routes||!P.routes.length){flash('No optimised plan available.');return;}
  const fleetBy={};ST.plan.fleets.forEach(f=>fleetBy[String(f.type).toUpperCase()]=f);
  let added=0,removed=0,equip=0,nextFn=900;
  const usedFn=new Set(ST.sched.prop.map(f=>f.fn));const newFn=()=>{while(usedFn.has('ZZ'+nextFn))nextFn++;usedFn.add('ZZ'+nextFn);return 'ZZ'+(nextFn++);};
  P.routes.forEach((pr,i)=>{const rt=ST.plan.routes[i];if(!rt)return;const [A,Bc]=String(rt.route).toUpperCase().split('-');
    const act=f=>String(f.status||'active')!=='cancelled';
    const outs=ST.sched.prop.filter(f=>act(f)&&f.org===A&&f.dst===Bc),backs=ST.sched.prop.filter(f=>act(f)&&f.org===Bc&&f.dst===A);
    if(pr.freq<=0){[...outs,...backs].forEach(f=>{f.status='cancelled';removed+=E.normDays(f.days).length;});return;}
    if(pr.fleet)[...outs,...backs].forEach(f=>{if(String(f.fleet).toUpperCase()!==String(pr.fleet).toUpperCase()){f.fleet=pr.fleet;equip++;}});
    const cnt=d=>outs.filter(f=>act(f)&&E.normDays(f.days).includes(d)).length;
    let cur=outs.reduce((s,f)=>s+E.normDays(f.days).length,0);
    const turn=Math.round(num(fleetBy[String(pr.fleet||'').toUpperCase()]?.turn,45));
    while(cur<pr.freq){const k=Math.min(7,pr.freq-cur);const days='1234567'.split('').sort((a,b)=>cnt(a)-cnt(b)||(a<b?-1:1)).slice(0,k).sort().join('');
      const tpl=outs[0],blk=tpl?E.parseBlock(tpl.block):Math.round(num(rt.block)*60);
      let dep=tpl?E.parseTime(tpl.dep)+180:600;if(dep+2*blk+turn>23*60)dep=Math.max(5*60,23*60-2*blk-turn);
      const bs=`${Math.floor(blk/60)}:${String(blk%60).padStart(2,'0')}`,fl=pr.fleet||tpl?.fleet||'';
      const o={id:'N'+Date.now().toString(36)+Math.random().toString(36).slice(2,6),fn:newFn(),org:A,dst:Bc,dep:E.fmtTime(dep),block:bs,days,fleet:fl,status:'active'};
      const b={id:'N'+Date.now().toString(36)+Math.random().toString(36).slice(2,6),fn:newFn(),org:Bc,dst:A,dep:E.fmtTime(dep+blk+turn),block:bs,days,fleet:fl,status:'active'};
      ST.sched.prop.push(o,b);outs.push(o);backs.push(b);cur+=k;added+=2*k;}
    while(cur>pr.freq){const o=outs.filter(f=>act(f)&&E.normDays(f.days).length).sort((a,b)=>E.normDays(b.days).length-E.normDays(a.days).length)[0];if(!o)break;
      const d=E.normDays(o.days).split('').sort((a,b)=>cnt(b)-cnt(a)||(a>b?-1:1))[0];o.days=E.normDays(o.days).replace(d,'');if(!o.days){o.status='cancelled';o.days=d;}
      const b=backs.find(f=>act(f)&&E.normDays(f.days).includes(d));if(b){b.days=E.normDays(b.days).replace(d,'');if(!b.days){b.status='cancelled';b.days=d;}}
      cur--;removed+=2;}
  });
  save();renderFlTbl();await updateSched();
  flash(`Draft built from the optimised plan: ${added} weekly flights added, ${removed} removed, ${equip} equipment changes. New flights have placeholder times: retime them and check rotations.`);
};
// proposed schedule -> planning current frequencies
$('pushToPlan').onclick=()=>{if(!lastSched)return;const e=num(ST.plan.params.elasticity,0.3);let n=0;
  const by={};lastSched.prop.routes.forEach(r=>by[r.route]=r);const none=[];
  ST.plan.routes.forEach(rt=>{const r=by[String(rt.route).toUpperCase()];if(!r){if(num(rt.cur_freq)>0)none.push(String(rt.route).toUpperCase());return;}const nf=Math.round(r.round_trips),of=Math.max(1,num(rt.cur_freq,7));
    if(nf>0)rt.demand=Math.round(num(rt.demand)*Math.pow(nf/of,e));rt.cur_freq=nf;if(r.fleet)rt.cur_fleet=r.fleet;n++;});
  save();planStale=true;renderRouteIn();flash(`Updated current frequency and fleet for ${n} planning routes (demand rescaled to the new frequencies).`+
    (none.length?` Not changed: ${none.join(', ')} ${none.length>1?'have':'has'} no flights in the proposed schedule; their demand is defined at the current frequency, so set Max freq to 0 in planning if the route is being dropped.`:''));};


// ================= OPERATIONS =================
let lastOps=null,opsTimer=null,opsSeq=0;
const DAYN=['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
const opsSched=()=>ST.ops.source==='base'?ST.sched.base:ST.sched.prop;
function schedOps(){clearTimeout(opsTimer);opsTimer=setTimeout(updateOps,server?350:80);}
async function runOpsEngine(){
  if(server){try{return await api('/api/ops/run',{sched:opsSched(),plan:ST.plan,ops:ST.ops});}catch(e){console.warn('server ops failed, using browser',e);}}
  return E.opsRun(opsSched(),ST.plan,ST.ops);
}
async function updateOps(){const seq=++opsSeq;const R=await runOpsEngine();if(seq!==opsSeq)return;lastOps=R;renderOps(R);}
document.querySelectorAll('[data-op]').forEach(el=>{el.oninput=el.onchange=()=>{ST.ops[el.dataset.op]=el.value;save();el.dataset.op==='day'?lastOps&&renderOps(lastOps):schedOps();};});
document.querySelectorAll('[data-cr]').forEach(el=>{el.oninput=el.onchange=()=>{ST.ops[el.dataset.cr]=el.value;save();schedOps();};});
document.querySelectorAll('[data-rule]').forEach(el=>{el.oninput=el.onchange=()=>{ST.ops.rules[el.dataset.rule]=el.value;save();schedOps();};});
function editTable(id0,rows,cols,onDel,onChg){onChg=onChg||schedOps;const id='#'+id0;const $q=sel=>document.querySelector(sel);
  let h='<thead><tr>'+cols.map(c=>`<th class="${c.l?'l':''}">${c.h}</th>`).join('')+'<th></th></tr></thead><tbody>';
  rows.forEach((r,i)=>{h+='<tr>'+cols.map(c=>{const v=esc(r[c.k]??'');
    if(c.opts)return `<td class="l"><select data-i="${i}" data-k="${c.k}">${c.opts.map(o=>`<option value="${esc(o)}">${esc(o)}</option>`).join('')}</select></td>`;
    return `<td class="${c.l?'l':''}"><input ${c.num?'type="number"':(c.date?'type="date"':'class="t"')} ${c.up?'data-up="1"':''} data-i="${i}" data-k="${c.k}" value="${v}" style="${c.w?`width:${c.w}px;min-width:${c.w}px`:''}"></td>`;}).join('')+`<td><button data-del="${i}" aria-label="Remove row">✕</button></td></tr>`;});
  const T0=$q(id);T0.innerHTML=h+'</tbody>';
  T0.querySelectorAll('select').forEach(el=>el.value=rows[+el.dataset.i][el.dataset.k]??'');
  T0.querySelectorAll('input,select').forEach(el=>el.oninput=el.onchange=()=>{rows[+el.dataset.i][el.dataset.k]=el.dataset.up?el.value.toUpperCase():el.value;save();onChg();});
  T0.querySelectorAll('[data-del]').forEach(b=>b.onclick=()=>{rows.splice(+b.dataset.del,1);save();onDel();onChg();});
}
function renderOpsInputs(){
  document.querySelectorAll('[data-op]').forEach(el=>el.value=ST.ops[el.dataset.op]??'');
  document.querySelectorAll('[data-cr]').forEach(el=>el.value=ST.ops[el.dataset.cr]??'');
  document.querySelectorAll('[data-rule]').forEach(el=>el.value=ST.ops.rules[el.dataset.rule]??'');
  const fl=ST.plan.fleets.map(f=>String(f.type));
  editTable('tailIn',ST.ops.tails,[{h:'Registration',k:'reg',l:1,w:100},{h:'Fleet',k:'fleet',l:1,opts:fl},{h:'Base',k:'base',l:1,w:70},{h:'Maintenance days',k:'maint',l:1,w:110},{h:'Block hours to next check',k:'hrs_to_check',num:1}],renderOpsInputs);
  editTable('poolIn',ST.ops.pool,[{h:'Base',k:'base',l:1,w:64},{h:'Fleet',k:'fleet',l:1,opts:[...fl,'ALL']},{h:'Rank',k:'rank',l:1,opts:['CPT','FO','CC']},{h:'Headcount',k:'count',num:1}],renderOpsInputs);
  editTable('leaveIn',ST.ops.leave,[{h:'Crew ID',k:'crew',l:1,w:170},{h:'Days unavailable',k:'days',l:1,w:110}],renderOpsInputs);
  ST.ops.complement=ST.ops.complement||{};
  let h='<thead><tr><th class="l">Fleet</th><th>Captains</th><th>First officers</th><th>Cabin crew</th></tr></thead><tbody>';
  fl.forEach(f=>{const c=ST.ops.complement[f]=ST.ops.complement[f]||{CPT:1,FO:1,CC:4};
    h+=`<tr><td class="l"><b>${esc(f)}</b></td>`+['CPT','FO','CC'].map(r=>`<td><input type="number" min="0" data-f="${esc(f)}" data-r="${r}" value="${esc(c[r])}"></td>`).join('')+'</tr>';});
  $('crewCompIn').innerHTML=h+'</tbody>';
  $('crewCompIn').querySelectorAll('input').forEach(el=>el.oninput=()=>{ST.ops.complement[el.dataset.f][el.dataset.r]=el.value;save();schedOps();});
}
$('addTail').onclick=()=>{ST.ops.tails.push({reg:'ZA-3'+String(ST.ops.tails.length+1).padStart(2,'0'),fleet:ST.plan.fleets[0]?.type||'',base:'RUH',maint:''});save();renderOpsInputs();schedOps();};
$('addPool').onclick=()=>{ST.ops.pool.push({base:'RUH',fleet:'ALL',rank:'CC',count:1});save();renderOpsInputs();schedOps();};
$('addLeave').onclick=()=>{ST.ops.leave.push({crew:'',days:''});save();renderOpsInputs();};
$('clearOv').onclick=()=>{ST.ops.overrides={};save();schedOps();};
$('dutyDay').onchange=()=>lastOps&&renderOps(lastOps);$('rosBase').onchange=()=>lastOps&&renderOps(lastOps);$('rosRank').onchange=()=>lastOps&&renderOps(lastOps);
const hhmm=m=>{m=Math.round(m);return String(Math.floor(m/60)%24).padStart(2,'0')+':'+String(m%60).padStart(2,'0')+(m>=1440?'+1':'');};
function renderOps(R){
  const T=R.tails,src=opsSched(),byId={};src.forEach(f=>byId[String(f.id)]=f);const fnOf=id=>byId[String(id)]?.fn||id;
  // ---- tails
  const regs=T.tails,util=regs.map(t=>t.bh_day);
  $('tailKpis').innerHTML=kpiHtml([
    ['Rotations / week',f0(T.summary.lines),`${T.summary.assigned} assigned to an aircraft`],
    ['Unassigned rotations',`<span style="color:${T.summary.unassigned?'var(--critical)':'inherit'}">${T.summary.unassigned}</span>`,'No aircraft free that day'],
    ['Ferries / swaps needed',`<span style="color:${T.summary.ferries?'var(--critical)':'inherit'}">${T.summary.ferries}</span>`,'Aircraft not where its rotation starts'],
    ['Utilisation (BH/day)',regs.length?`${Math.min(...util).toFixed(1)}–${Math.max(...util).toFixed(1)}`:'–',`Average ${regs.length?(util.reduce((a,b)=>a+b,0)/regs.length).toFixed(1):'–'} across ${regs.length} aircraft`],
    ['Nights away from base',f0(regs.reduce((s,t)=>s+t.nights_away,0)),'Aircraft-nights ending the day away from base']]);
  $('tailWarn').innerHTML=T.warnings.length?'<ul style="margin:0;padding-left:18px">'+T.warnings.map(w=>`<li>${esc(w)}</li>`).join('')+'</ul>':'<span class="pill open"><span class="dot">✓</span>Every rotation has an aircraft in the right place</span>';
  const lineBy={};T.lines.forEach(l=>lineBy[l.day+'|'+l.key]=l);
  let h='<thead><tr><th class="l">Aircraft</th><th class="l">Fleet</th><th class="l">Base</th>'+DAYN.map(d=>`<th class="l">${d}</th>`).join('')+'<th>BH / week</th><th>BH / day</th><th>Nights away</th></tr></thead><tbody>';
  regs.forEach(t=>{h+=`<tr><td class="l"><b>${esc(t.reg)}</b></td><td class="l">${esc(t.fleet)}</td><td class="l">${esc(t.base)}</td>`+'1234567'.split('').map(d=>{const k=t.by_day[d];
      if(k==='MX')return '<td class="mx">MX</td>';if(!k)return '<td class="c note">–</td>';const l=lineBy[d+'|'+k];
      return `<td class="c"><b>${esc(l.start)}→${esc(l.end)}</b>${l.status==='ferry'?' <span class="chg dn">ferry</span>':''}${l.override?' <span class="tag p">manual</span>':''}<br><span class="note">${l.sectors} flights · ${l.bh.toFixed(1)} h</span></td>`;}).join('')+
    `<td>${f1(t.bh)}</td><td>${f1(t.bh_day)}</td><td>${t.nights_away}</td></tr>`;});
  const un=T.lines.filter(l=>l.status==='unassigned');
  if(un.length)h+=`<tr><td class="l" colspan="3"><b style="color:var(--critical)">Unassigned</b></td>`+'1234567'.split('').map(d=>{const u=un.filter(l=>l.day===d);return `<td class="c">${u.map(l=>`${esc(l.start)} ${hhmm(l.dep)}`).join('<br>')||''}</td>`;}).join('')+'<td colspan="3"></td></tr>';
  $('tailWeek').innerHTML=h+'</tbody>';$('tailWeek').classList.add('wk');
  const day=ST.ops.day||'1';$('tailDayTitle').textContent=`Day view · ${DAYN[+day-1]}`;
  const dayLines=T.lines.filter(l=>l.day===day);
  const rows=regs.map(t=>{const l=dayLines.find(x=>x.reg===t.reg);return {label:t.reg,flights:l?l.flights:[],note:t.by_day[day]==='MX'?'Maintenance':(l?'':'Idle'),ov:l&&l.override};});
  dayLines.filter(l=>!l.reg).forEach(l=>rows.push({label:'⚠ unassigned',flights:l.flights}));
  gantt($('tailGantt'),rows,byId,{},'',0,(r)=>!!r.ov);
  h='<thead><tr><th class="l">Rotation</th><th class="l">Fleet</th><th class="l">Route</th><th>First dep</th><th>Last arr</th><th>Block h</th><th class="l">Aircraft</th><th class="l">Status</th></tr></thead><tbody>';
  dayLines.forEach(l=>{const opts=['<option value="">Auto</option>'].concat(ST.ops.tails.filter(t=>String(t.fleet).toUpperCase()===l.fleet.toUpperCase()).map(t=>`<option value="${esc(t.reg)}">${esc(t.reg)}</option>`)).join('');
    const route=[l.start,...l.flights.map(i=>byId[i]?.dst||'?')].join('-');
    const st=l.status==='unassigned'?'<span class="pill closed"><span class="dot">✕</span>No aircraft</span>':l.status==='ferry'?`<span class="chg dn">Ferry from ${esc(l.from_station)}</span>`:'<span class="pill open"><span class="dot">✓</span>OK</span>';
    h+=`<tr><td class="l"><b>${esc(fnOf(l.key))}</b> <span class="note">+${l.flights.length-1}</span></td><td class="l">${esc(l.fleet)}</td><td class="l">${esc(route)}</td><td>${hhmm(l.dep)}</td><td>${hhmm(l.arr)}</td><td>${l.bh.toFixed(1)}</td>
      <td class="l"><select data-lk="${esc(l.key)}" style="width:auto;min-width:110px">${opts}</select>${l.reg&&!l.override?`<br><span class="note small">auto: ${esc(l.reg)}</span>`:''}</td><td class="l">${st}${l.override?' <span class="tag p">manual</span>':''}</td></tr>`;});
  $('tailDay').innerHTML=h+'</tbody>';
  $('tailDay').querySelectorAll('select').forEach(el=>{const ov=(ST.ops.overrides||{})[day]||{};el.value=ov[el.dataset.lk]||'';
    el.onchange=()=>{ST.ops.overrides=ST.ops.overrides||{};const o=ST.ops.overrides[day]=ST.ops.overrides[day]||{};if(el.value)o[el.dataset.lk]=el.value;else delete o[el.dataset.lk];save();schedOps();};});
  // ---- crew
  const Rr=R.roster,S=Rr.summary,cov=S.positions?S.filled/S.positions:1;
  const illegal=R.duties.filter(d=>!d.legal).length,away=R.duties.filter(d=>d.legal&&!d.end_at_base).length;
  $('crewKpis').innerHTML=kpiHtml([
    ['Crew duties / week',f0(R.duties.length),`${R.duties.reduce((s,d)=>s+d.sectors,0)} flights covered`],
    ['Positions filled',`<span style="color:${cov<1?'var(--critical)':'inherit'}">${(cov*100).toFixed(1)}%</span>`,`${S.filled} of ${S.positions} · ${S.positions-S.filled} open`],
    ['Duties breaking FDP or ending away',`<span style="color:${illegal+away?'var(--critical)':'inherit'}">${illegal+away}</span>`,`${illegal} over FDP · ${away} away from home base`],
    ['Crew rostered',f0(S.crew),`Average ${S.avg_duty_h.toFixed(1)} duty h / week`],
    ['Crew gap',(()=>{const g=Rr.requirements.filter(q=>q.gap<0);return g.length?`<span style="color:var(--critical)">${g.reduce((s,q)=>s-q.gap,0)} short</span>`:'None';})(),Rr.requirements.filter(q=>q.gap<0).map(q=>`${q.base} ${q.rank} ${q.gap}`).join(' · ')||'Requirement covered']]);
  const cw=R.warnings.filter(w=>/^D\d-/.test(w));const sh={};Rr.shortages.forEach(x=>{const k=`${x.base} ${x.fleet} ${x.rank}`;(sh[k]=sh[k]||[]).push(DAYN[+x.day-1]);});
  const items=[...Object.entries(sh).map(([k,d])=>`<b style="color:var(--critical)">Unfilled:</b> ${esc(k)} on ${d.join(', ')} (${d.length} position${d.length>1?'s':''})`),...cw.map(esc)];
  $('crewWarn').innerHTML=items.length?'<ul style="margin:0;padding-left:18px">'+items.map(i=>`<li>${i}</li>`).join('')+'</ul>':'<span class="pill open"><span class="dot">✓</span>All duties legal and fully crewed</span>';
  $('crewReq').innerHTML='<thead><tr><th class="l">Base</th><th class="l">Fleet</th><th class="l">Rank</th><th>Duty days / wk</th><th>Duty h / wk</th><th>Needed</th><th>Standby</th><th>Available</th><th>Gap</th></tr></thead><tbody>'+
    Rr.requirements.map(q=>`<tr><td class="l">${esc(q.base)}</td><td class="l">${esc(q.fleet)}</td><td class="l">${esc(q.rank)}</td><td>${q.duty_days}</td><td>${f0(q.duty_h)}</td><td>${q.needed}</td><td>${q.reserve??0}</td><td>${q.available}</td><td><span class="chg ${q.gap<0?'dn':'up'}">${q.gap>0?'+':''}${q.gap}</span></td></tr>`).join('')+'</tbody>';
  const dd=$('dutyDay').value,shortBy={};Rr.shortages.forEach(x=>{shortBy[x.duty]=(shortBy[x.duty]||0)+1;});
  $('dutyTbl').innerHTML='<thead><tr><th class="l">Duty</th><th class="l">Day</th><th class="l">Base</th><th class="l">Aircraft</th><th class="l">Route</th><th>Report</th><th>Release</th><th>FDP h</th><th>Max FDP h</th><th>Block h</th><th class="l">Crew</th><th class="l">Status</th></tr></thead><tbody>'+
    R.duties.filter(d=>!dd||d.day===dd).map(d=>{const ok=d.legal&&d.end_at_base&&!shortBy[d.id];
      const crewTxt=['CPT','FO','CC'].map(r=>`${r} ${d.crew?d.crew[r].length:0}/${d.need[r]}`).join(' · ');
      const st=!d.legal?'<span class="pill closed"><span class="dot">✕</span>Over FDP</span>':!d.end_at_base?'<span class="chg dn">Ends away</span>':shortBy[d.id]?`<span class="chg dn">${shortBy[d.id]} unfilled</span>`:'<span class="pill open"><span class="dot">✓</span>OK</span>';
      return `<tr class="${ok?'':'diff'}"><td class="l"><b>${esc(d.id)}</b></td><td class="l">${DAYN[+d.day-1]}</td><td class="l">${esc(d.base)}</td><td class="l">${esc(d.reg||'–')}</td><td class="l">${esc(d.route)}</td><td>${hhmm(d.report)}</td><td>${hhmm(d.release)}</td><td>${d.fdp.toFixed(1)}</td><td>${d.max_fdp.toFixed(1)}</td><td>${d.block.toFixed(1)}</td><td class="l small" title="${esc(['CPT','FO','CC'].map(r=>r+': '+(d.crew?d.crew[r].join(', '):'')).join('\n'))}">${crewTxt}</td><td class="l">${st}</td></tr>`;}).join('')+'</tbody>';
  const bases=[...new Set(Rr.grid.map(g=>g.base))],bs=$('rosBase'),prevBase=bs.value;
  bs.innerHTML='<option value="">All bases</option>'+bases.map(b=>`<option value="${esc(b)}">${esc(b)}</option>`).join('');bs.value=bases.includes(prevBase)?prevBase:'';
  const dutyBy={};R.duties.forEach(d=>dutyBy[d.id]=d);
  const gr=Rr.grid.filter(g=>(!bs.value||g.base===bs.value)&&(!$('rosRank').value||g.rank===$('rosRank').value));
  $('rosTbl').innerHTML='<thead><tr><th class="l">Crew</th><th class="l">Rank</th><th class="l">Qualification</th>'+DAYN.map(d=>`<th class="l">${d}</th>`).join('')+'<th>Duty h</th><th>Block h</th><th>Days on</th></tr></thead><tbody>'+
    gr.map(g=>`<tr><td class="l"><b>${esc(g.id)}</b></td><td class="l">${esc(g.rank)}</td><td class="l">${esc(g.fleet)}</td>`+'1234567'.split('').map(d=>{const c=g.cells[d];
      if(c==='OFF')return '<td class="off">OFF</td>';if(c==='LV')return '<td class="lv">LV</td>';const du=dutyBy[c];
      return `<td class="on" title="${esc(c)}"><b>${esc(du?du.route.replace(new RegExp('^'+du.base+'-|-'+du.base+'$','g'),''):c)}</b><br><span class="note">${du?hhmm(du.report)+'–'+hhmm(du.release):''}</span></td>`;}).join('')+
      `<td>${g.duty_h.toFixed(1)}</td><td>${g.block_h.toFixed(1)}</td><td>${g.days_on}</td></tr>`).join('')+'</tbody>';
  $('rosTbl').classList.add('ros');
}
$('copyRoster').onclick=()=>{if(!lastOps)return;const dutyBy={};lastOps.duties.forEach(d=>dutyBy[d.id]=d);
  const rows=[['crew_id','base','rank','qualification',...DAYN,'duty_h','block_h']];
  lastOps.roster.grid.forEach(g=>rows.push([g.id,g.base,g.rank,g.fleet,...'1234567'.split('').map(d=>{const c=g.cells[d],du=dutyBy[c];return du?`${du.route} ${hhmm(du.report)}-${hhmm(du.release)}`:c;}),g.duty_h.toFixed(1),g.block_h.toFixed(1)]));
  copy(rows.map(r=>r.join(',')).join('\n'),$('rosMsg'));};


// ================= PRICING =================
let lastPrice=null,lastPriceKey=null,priceSeq=0;
const priceKey=()=>JSON.stringify(ST.pricing);
document.querySelectorAll('[data-pr]').forEach(el=>{el.oninput=el.onchange=()=>{ST.pricing[el.dataset.pr]=el.value;save();};});
async function runPriceEngine(){
  if(server){try{return await api('/api/pricing/price',{pricing:ST.pricing});}catch(e){console.warn('server pricing failed, using browser',e);}}
  return E.priceFares(ST.pricing);
}
function renderFareIn(){
  const q=($('fareFilter').value||'').trim().toUpperCase();
  const idx=ST.pricing.fares.map((f,i)=>i).filter(i=>{const f=ST.pricing.fares[i];return !q||String(f.market).toUpperCase().includes(q)||String(f.rbd).toUpperCase()===q;});
  let h='<thead><tr><th class="l">Market</th><th class="l">RBD</th><th class="l">Fare basis</th><th>Base fare</th><th></th></tr></thead><tbody>';let prev=null;
  idx.forEach(i=>{const f=ST.pricing.fares[i],g=prev!==null&&prev!==f.market;prev=f.market;
    h+=`<tr class="${g?'grp':''}"><td class="l"><input class="t" data-up="1" data-i="${i}" data-k="market" value="${esc(f.market)}" style="width:100px"></td><td class="l"><input class="t" data-up="1" data-i="${i}" data-k="rbd" value="${esc(f.rbd)}" style="width:48px;min-width:48px"></td>
    <td class="l"><input class="t" data-i="${i}" data-k="basis" value="${esc(f.basis||'')}" placeholder="${esc(f.rbd)}OW" style="width:110px"></td><td><input type="number" data-i="${i}" data-k="base" value="${esc(f.base)}"></td><td><button data-del="${i}" aria-label="Remove fare">✕</button></td></tr>`;});
  $('fareIn').innerHTML=h+'</tbody>';
  $('fareIn').querySelectorAll('input').forEach(el=>el.oninput=()=>{ST.pricing.fares[+el.dataset.i][el.dataset.k]=el.dataset.up?el.value.toUpperCase():el.value;save();});
  $('fareIn').querySelectorAll('[data-del]').forEach(b=>b.onclick=()=>{ST.pricing.fares.splice(+b.dataset.del,1);save();renderFareIn();});
}
function renderPriceInputs(){
  document.querySelectorAll('[data-pr]').forEach(el=>el.value=ST.pricing[el.dataset.pr]??'');
  renderFareIn();
  const noop=()=>{};
  editTable('adjIn',ST.pricing.adjustments,[{h:'Rule name',k:'name',l:1,w:170},{h:'Type',k:'type',l:1,opts:['surcharge','promotion']},{h:'Method',k:'method',l:1,opts:['percent','fixed']},
    {h:'Value',k:'value',num:1},{h:'Markets',k:'markets',l:1,w:100,up:1},{h:'RBDs',k:'rbds',l:1,w:70,up:1},{h:'Valid from',k:'from',l:1,date:1},{h:'Valid to',k:'to',l:1,date:1},{h:'Active',k:'active',l:1,opts:['yes','no']}],renderPriceInputs,noop);
  editTable('taxIn',ST.pricing.taxes,[{h:'Code',k:'code',l:1,w:58,up:1},{h:'Name',k:'name',l:1,w:190},{h:'Basis',k:'basis',l:1,opts:['fixed','percent']},{h:'Amount',k:'amount',num:1},
    {h:'Scope',k:'scope',l:1,opts:['departure','arrival','domestic','international']},{h:'Where',k:'where',l:1,w:80,up:1},{h:'Applies to infants',k:'inf',l:1,opts:['no','yes']}],renderPriceInputs,noop);
  editTable('famIn',ST.pricing.families,[{h:'Family',k:'family',l:1,w:90},{h:'RBDs',k:'rbds',l:1,w:80,up:1},{h:'Includes',k:'includes',l:1,w:220},{h:'Advance purchase (days)',k:'ap_days',num:1},
    {h:'Refundable',k:'refund',l:1,opts:['No','Yes','Partial']},{h:'Change fee',k:'change_fee',num:1}],renderPriceInputs,noop);
  editTable('curIn',ST.pricing.currencies,[{h:'Currency',k:'code',l:1,w:60,up:1},{h:'Rate per 1 base unit',k:'rate',num:1}],renderPriceInputs,noop);
  document.querySelectorAll('[data-prx]').forEach(el=>{el.value=(ST.pricing.pax||{})[el.dataset.prx]??'';el.oninput=()=>{ST.pricing.pax=ST.pricing.pax||{};ST.pricing.pax[el.dataset.prx]=el.value;save();};});
  editTable('stnIn',ST.pricing.stations,[{h:'Station',k:'code',l:1,w:70,up:1},{h:'Country',k:'country',l:1,w:70,up:1}],renderPriceInputs,noop);
}
$('fareFilter').oninput=renderFareIn;
$('addFare').onclick=()=>{ST.pricing.fares.push({market:'RUH-JED',rbd:'N',base:200,basis:''});save();$('fareFilter').value='';renderFareIn();};
$('addAdj').onclick=()=>{ST.pricing.adjustments.push({name:'New rule',type:'promotion',method:'percent',value:10,markets:'ALL',rbds:'ALL',from:'',to:'',active:'yes'});save();renderPriceInputs();};
$('addTax').onclick=()=>{ST.pricing.taxes.push({code:'NEW',name:'',basis:'fixed',amount:0,scope:'departure',where:''});save();renderPriceInputs();};
$('addFam').onclick=()=>{ST.pricing.families.push({family:'New',rbds:'',includes:'',ap_days:0,refund:'No',change_fee:0});save();renderPriceInputs();};
$('addCur').onclick=()=>{ST.pricing.currencies.push({code:'',rate:1});save();renderPriceInputs();};
$('addStn').onclick=()=>{ST.pricing.stations.push({code:'',country:''});save();renderPriceInputs();};
$('resetPricing').onclick=()=>{ST.pricing=clone(window.DEMO_DATA.pricing);save();renderPriceInputs();};
$('goPrice').onclick=()=>{location.hash='#price-list';};
$('lgGo').onclick=()=>{const m=$('lgMarket').value.trim().toUpperCase(),top=num($('lgTop').value,0),rd=Math.max(1,num($('lgRound').value,10));
  const steps=$('lgLadder').value.split(',').map(x=>x.split(':').map(y=>y.trim())).filter(x=>x[0]);
  if(!/^[A-Z0-9]{3}-[A-Z0-9]{3}$/.test(m)||top<=0||!steps.length){$('lgMsg').textContent='Enter a market like RUH-KWI, a top fare and the RBD ladder.';return;}
  const keep=ST.pricing.fares.filter(f=>String(f.market).toUpperCase()!==m),add=steps.map(([r,sh])=>({market:m,rbd:r.toUpperCase(),base:Math.round(top*num(sh,1)/rd)*rd,basis:''}));
  const at=ST.pricing.fares.findIndex(f=>String(f.market).toUpperCase()===m);
  if(at>=0){const before=ST.pricing.fares.slice(0,at).filter(f=>String(f.market).toUpperCase()!==m);ST.pricing.fares=[...before,...add,...keep.slice(before.length)];}else ST.pricing.fares=[...keep,...add];
  [m.split('-')[0],m.split('-')[1]].forEach(st=>{if(!ST.pricing.stations.some(x=>String(x.code).toUpperCase()===st))ST.pricing.stations.push({code:st,country:''});});
  save();$('fareFilter').value=m;renderPriceInputs();$('lgMsg').textContent=`${add.length} fares created for ${m}: ${add.map(a=>a.rbd+' '+a.base).join(', ')}. Add the country for any new station.`;};
$('priceFilter').oninput=()=>lastPrice&&renderPrice(lastPrice);$('priceCur').onchange=()=>{ST.pricing.display_cur=$('priceCur').value;save();lastPrice&&renderPrice(lastPrice);};$('priceMarket').onchange=()=>{ST.pricing.market=$('priceMarket').value;save();lastPrice&&renderPrice(lastPrice);};
async function updatePrice(){const seq=++priceSeq,pk=priceKey();const R=await runPriceEngine();if(seq!==priceSeq)return;lastPrice=R;lastPriceKey=pk;renderPrice(R);}
function renderPrice(R){
  const S=R.summary;$('priceMeta').innerHTML=`Pricing date <b>${esc(ST.pricing.date||'any')}</b> · chart in ${esc(cur())}, table in the selected currency · per passenger, one way`;
  $('priceKpis').innerHTML=kpiHtml([['Fares priced',f0(S.fares),`${S.markets} markets`],['Fares with a promotion',f0(S.with_promo),'Active on the pricing date'],
    ['Fares with a surcharge',f0(S.with_surcharge),'Active on the pricing date'],['Taxes as share of price',(S.avg_tax_share*100).toFixed(1)+'%','Average across fares']]);
  $('priceWarn').innerHTML=R.warnings.length?'<ul style="margin:0;padding-left:18px">'+R.warnings.map(w=>`<li>${esc(w)}</li>`).join('')+'</ul>':'<span class="pill open"><span class="dot">✓</span>All fares priced; ladders in order</span>';
  const markets=[...new Set(R.rows.map(r=>r.market))],ms=$('priceMarket');ms.innerHTML=markets.map(m=>`<option value="${esc(m)}">${esc(m)}</option>`).join('');
  ms.value=markets.includes(ST.pricing.market)?ST.pricing.market:(markets[0]||'');
  const mr=R.rows.filter(r=>r.market===ms.value);
  stackChart($('chLadder'),mr.map(r=>r.rbd),[{name:'Net fare',color:'var(--series-1)',vals:mr.map(r=>r.net)},{name:'Taxes & fees',color:'var(--series-2)',vals:mr.map(r=>r.tax_total)}],mr);
  const q=($('priceFilter').value||'').trim().toUpperCase(),codes=R.tax_codes;
  const cs=$('priceCur'),curs=(ST.pricing.currencies||[]).filter(c=>c.code);cs.innerHTML=curs.map(c=>`<option value="${esc(c.code)}">${esc(c.code)}</option>`).join('');
  cs.value=curs.some(c=>c.code===ST.pricing.display_cur)?ST.pricing.display_cur:(curs[0]?.code||'');const rate=num((curs.find(c=>c.code===cs.value)||{}).rate,1),cv=x=>x*rate;
  const fc=x=>Math.round(cv(x)).toLocaleString('en-US'),f1c=x=>cv(x).toFixed(1);
  let h=`<thead><tr><th class="l">Market</th><th class="l">RBD</th><th class="l">Family</th><th class="l">Fare basis</th><th>Base fare</th><th>Surcharges</th><th>Promotions</th><th>Net fare</th>`+codes.map(c=>`<th>${esc(c)}</th>`).join('')+`<th>Total taxes</th><th>Adult price</th><th>Child price</th><th>Infant price</th><th class="l">Rules</th></tr></thead><tbody>`;
  let prev=null;
  R.rows.filter(r=>!q||r.market.includes(q)||r.rbd===q).forEach(r=>{const g=prev!==null&&prev!==r.market;prev=r.market;
    const tip=r.applied.map(a=>`${a.name}: ${a.amount>=0?'+':''}${a.amount.toFixed(0)}`).join('\n');
    h+=`<tr class="${g?'grp':''} ${r.promotion>0?'changed':''}"><td class="l"><b>${esc(r.market)}</b></td><td class="l"><b>${esc(r.rbd)}</b></td><td class="l">${esc(r.family||'–')}</td><td class="l note">${esc(r.basis)}</td><td>${fc(r.base)}</td>
      <td title="${esc(tip)}">${r.surcharge?'+'+fc(r.surcharge):'–'}</td><td title="${esc(tip)}">${r.promotion?'<span class="chg dn">−'+fc(r.promotion)+'</span>':'–'}</td><td><b>${fc(r.net)}</b></td>`+
      codes.map(c=>`<td>${r.taxes[c]!=null?f1c(r.taxes[c]):'–'}</td>`).join('')+`<td>${f1c(r.tax_total)}</td><td><b>${fc(r.total)}</b></td><td>${r.chd_total!=null?fc(r.chd_total):'–'}</td><td>${r.inf_total!=null?fc(r.inf_total):'–'}</td>
      <td class="l small" title="${esc(r.includes||'')}">${r.family?`AP ${r.ap_days}d · ${esc(r.refund)==='Yes'?'refundable':'non-ref.'} · change ${fc(r.change_fee||0)}`:'–'}</td></tr>`;});
  $('priceTbl').innerHTML=h+'</tbody>';
}
function stackChart(el,cats,series,rows){
  const W=560,H=280,m={l:58,r:12,t:12,b:34},iw=W-m.l-m.r,ih=H-m.t-m.b;if(!cats.length){el.innerHTML='';return;}
  const tot=cats.map((_,i)=>series.reduce((s,x)=>s+x.vals[i],0)),ymax=niceMax(Math.max(1,...tot)*1.08),sy=y=>m.t+ih-(y/ymax)*ih;
  const gw=iw/cats.length,bw=Math.min(54,gw*0.6);let g='';
  for(let i=0;i<=4;i++){const v=ymax*i/4,y=sy(v);g+=`<line x1="${m.l}" x2="${W-m.r}" y1="${y}" y2="${y}" stroke="var(--grid)"/><text x="${m.l-8}" y="${y+4}" text-anchor="end" font-size="11" fill="var(--text-muted)">${axFmt(v)}</text>`;}
  cats.forEach((c,i)=>{const x=m.l+gw*i+(gw-bw)/2;let acc=0;
    series.forEach((s,si)=>{const v=s.vals[i];if(v<=0)return;const y0=sy(acc),y1=sy(acc+v),top=si===series.length-1,h=y0-y1-(si>0?2:0);
      const yy=y1,r=top?Math.min(4,h):0;
      g+=top?`<path d="M${x},${yy+h} V${yy+r} Q${x},${yy} ${x+r},${yy} H${x+bw-r} Q${x+bw},${yy} ${x+bw},${yy+r} V${yy+h} Z" fill="${s.color}"/>`:`<rect x="${x}" y="${yy}" width="${bw}" height="${Math.max(0,h)}" fill="${s.color}"/>`;acc+=v;});
    g+=`<text x="${x+bw/2}" y="${sy(tot[i])-6}" text-anchor="middle" font-size="11" font-weight="600" fill="var(--text-primary)">${f0(tot[i])}</text>`;
    g+=`<rect x="${x}" y="${m.t}" width="${bw}" height="${ih}" fill="transparent" data-i="${i}"/>`;
    g+=`<text x="${x+bw/2}" y="${H-m.b+16}" text-anchor="middle" font-size="12" font-weight="600" fill="var(--text-secondary)">${esc(c)}</text>`;});
  g+=`<line x1="${m.l}" x2="${W-m.r}" y1="${sy(0)}" y2="${sy(0)}" stroke="var(--text-muted)"/><text transform="translate(13 ${m.t+ih/2}) rotate(-90)" text-anchor="middle" font-size="11.5" fill="var(--text-secondary)">${esc(cur())} per passenger</text>`;
  el.innerHTML=`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Fare ladder">${g}</svg>`;
  el.querySelectorAll('[data-i]').forEach(r=>{r.addEventListener('mousemove',e=>{const x=rows[+r.dataset.i];
    showTip(e,`<b>${esc(x.market)} ${esc(x.rbd)}</b><br>Base ${f0(x.base)}${x.surcharge?' · +'+f0(x.surcharge):''}${x.promotion?' · −'+f0(x.promotion):''}<br>Net fare <b>${f0(x.net)}</b><br>`+Object.entries(x.taxes).map(([k,v])=>`${esc(k)} ${f1(v)}`).join(' · ')+`<br>Total <b>${money(x.total)}</b><br><span class="note">Click to find it in the price list</span>`);});r.addEventListener('mouseleave',hideTip);
    r.addEventListener('click',()=>{const x=rows[+r.dataset.i];pick(el,{market:x.market,rbd:x.rbd});});});
}
$('applyRm').onclick=()=>{if(!lastPrice)return;const by={};lastPrice.rows.forEach(r=>by[r.market+'|'+r.rbd]=r);let n=0;
  ST.rm.prods.forEach(p=>{const r=by[String(p.od).toUpperCase()+'|'+String(p.rbd).toUpperCase()];if(r){p.fare=Math.round(r.net);n++;}});
  save();renderProdIn();schedRm();$('priceMsg').textContent=`${n} RM products updated with net fares (base ± surcharges/promotions, excluding taxes).`;setTimeout(()=>$('priceMsg').textContent='',5000);};
$('copyPrice').onclick=()=>{if(!lastPrice)return;const codes=lastPrice.tax_codes;
  const rows=[['market','rbd','fare_basis','base','surcharges','promotions','net_fare',...codes,'total_taxes','total_price','currency']];
  lastPrice.rows.forEach(r=>rows.push([r.market,r.rbd,r.basis,r.base.toFixed(2),r.surcharge.toFixed(2),r.promotion.toFixed(2),r.net.toFixed(2),...codes.map(c=>(r.taxes[c]||0).toFixed(2)),r.tax_total.toFixed(2),r.total.toFixed(2),cur()]));
  copy(rows.map(r=>r.join(',')).join('\n'),$('priceMsg'));};


// ================= GROUP EVALUATOR =================
$('grpGo').onclick=()=>{if(!lastRm)return;const path=$('grpPath').value,n=Math.max(1,Math.round(num($('grpSeats').value,1))),fare=num($('grpFare').value,0);
  const codes=path.split('>'),parts=[];let ok=true,tot=0;
  codes.forEach(c=>{const L=lastRm.legs.find(l=>l.code===c);if(!L){ok=false;return;}const C=Math.max(0,Math.round(L.C));
    if(n>C){ok=false;parts.push(`${esc(c)}: only ${C} seats left`);return;}
    const v=(L.curve||[]).slice(C-n,C).reduce((a,b)=>a+b,0);tot+=v;parts.push(`${esc(c)}: ${money(v)} for ${n} seats (${money(v/n)} each)`);});
  if(!ok){$('grpOut').innerHTML=`<span class="pill closed"><span class="dot">✕</span>Not enough seats</span> ${parts.join(' · ')}`;return;}
  const per=tot/n,acc=fare>=per-1e-6;
  $('grpOut').innerHTML=`${acc?'<span class="pill open"><span class="dot">✓</span>Accept</span>':'<span class="pill closed"><span class="dot">✕</span>Counter-offer</span>'} Minimum acceptable net fare <b>${money(per)}</b> per passenger · offered ${money(fare)} · group revenue ${money(fare*n)} vs displaced ${money(tot)} (${acc?'+':''}${money(fare*n-tot)})<br><span class="small">${parts.join(' · ')}</span>`;};

// ================= COMMERCIAL =================
let lastCom=null,comTimer=null,comSeq=0;
function schedCom(){clearTimeout(comTimer);comTimer=setTimeout(updateCom,server?350:80);}
const comBasis=()=>ST.com.basis==='optimised'&&lastPlan&&lastPlan.routes?lastPlan.routes.map(r=>({route:r.route,freq:r.freq,fleet:r.fleet})):null;
async function updateCom(){
  const seq=++comSeq;
  if(ST.com.basis==='optimised'&&(!lastPlan||planStale)){try{const P=await runPlanEngine();lastPlan=P;planStale=false;}catch(e){}}
  const pk=priceKey();let pr=lastPrice&&lastPriceKey===pk?lastPrice:null;
  if(!pr){pr=await runPriceEngine();lastPrice=pr;lastPriceKey=pk;}
  let R;if(server){try{R=await api('/api/commercial/run',{com:ST.com,plan:ST.plan,price_rows:pr.rows,basis:comBasis()});}catch(e){}}
  if(!R)R=E.commercialRun(ST.com,ST.plan,pr.rows,comBasis());
  if(seq!==comSeq)return;lastCom=R;renderCom(R);
}
function renderComInputs(){
  document.querySelectorAll('[data-com]').forEach(el=>{el.value=ST.com[el.dataset.com]??'';el.oninput=el.onchange=()=>{ST.com[el.dataset.com]=el.value;save();document.querySelectorAll(`[data-com="${el.dataset.com}"]`).forEach(x=>{if(x!==el)x.value=el.value;});schedCom();};});
  document.querySelectorAll('[data-cost]').forEach(el=>{el.value=ST.com.costs[el.dataset.cost]??'';el.oninput=()=>{ST.com.costs[el.dataset.cost]=el.value;save();schedCom();};});
  document.querySelectorAll('[data-bud]').forEach(el=>{ST.com.budget=ST.com.budget||{};el.value=ST.com.budget[el.dataset.bud]??'';el.oninput=()=>{ST.com.budget[el.dataset.bud]=el.value;save();schedCom();};});
  ST.com.costs.lease=ST.com.costs.lease||{};
  $('leaseIn').innerHTML='<thead><tr><th class="l">Fleet</th><th>Lease / ownership cost per aircraft per month</th><th>Aircraft</th><th>Per week (fleet)</th></tr></thead><tbody>'+ST.plan.fleets.map(f=>`<tr><td class="l"><b>${esc(f.type)}</b></td><td><input type="number" data-lf="${esc(f.type)}" value="${esc(ST.com.costs.lease[f.type]??'')}"></td><td>${f0(num(f.count))}</td><td>${kmoney(num(ST.com.costs.lease[f.type])*12/52*num(f.count))}</td></tr>`).join('')+'</tbody>';
  $('leaseIn').querySelectorAll('input').forEach(el=>el.oninput=()=>{ST.com.costs.lease[el.dataset.lf]=el.value;save();schedCom();});
  const noop=schedCom;
  editTable('ancIn',ST.com.ancillaries,[{h:'Item',k:'item',l:1,w:170},{h:'Price',k:'price',num:1},{h:'Take rate %',k:'take',num:1},{h:'Cost %',k:'cost_pct',num:1},{h:'Markets',k:'markets',l:1,w:120,up:1}],renderComInputs,noop);
  editTable('chIn',ST.com.channels,[{h:'Channel',k:'channel',l:1,w:160},{h:'Share of sales %',k:'share',num:1},{h:'Cost per segment',k:'cost_seg',num:1},{h:'Commission %',k:'commission',num:1},{h:'Incentive %',k:'incentive',num:1}],renderComInputs,noop);
  editTable('corpIn',ST.com.corporates,[{h:'Corporate',k:'name',l:1,w:170},{h:'Markets',k:'markets',l:1,w:140,up:1},{h:'Discount %',k:'discount',num:1},{h:'Committed pax / year',k:'committed',num:1},{h:'Actual pax to date',k:'actual',num:1},{h:'Months elapsed',k:'months',num:1}],renderComInputs,noop);
  editTable('compIn',ST.com.competitors,[{h:'Market',k:'market',l:1,w:90,up:1},{h:'Carrier',k:'carrier',l:1,w:60,up:1},{h:'Weekly frequency',k:'freq',num:1},{h:'Lowest total fare',k:'fare',num:1},{h:'Observed',k:'date',l:1,date:1}],renderComInputs,noop);
  renderWhatIfInputs();
  editTable('ilIn',ST.com.interline,[{h:'ID',k:'id',l:1,w:80},{h:'Through fare',k:'fare',num:1},{h:'Passengers',k:'pax',num:1},{h:'Segments',k:'segments',l:1,w:420}],renderComInputs,noop);
}
$('addAnc').onclick=()=>{ST.com.ancillaries.push({item:'New item',price:50,take:5,cost_pct:0,markets:'ALL'});save();renderComInputs();schedCom();};
$('addCh').onclick=()=>{ST.com.channels.push({channel:'New channel',share:0,cost_seg:0,commission:0,incentive:0});save();renderComInputs();};
$('addCorp').onclick=()=>{ST.com.corporates.push({name:'New corporate',markets:'ALL',discount:5,committed:1000,actual:0,months:1});save();renderComInputs();schedCom();};
$('addComp').onclick=()=>{ST.com.competitors.push({market:'RUH-JED',carrier:'XX',freq:7,fare:500,date:''});save();renderComInputs();schedCom();};
$('addIl').onclick=()=>{ST.com.interline.push({id:'IL-'+String(ST.com.interline.length+1).padStart(3,'0'),fare:1000,pax:10,segments:'ZZ:RUH-JED:846; PX:JED-XXX:1000'});save();renderComInputs();schedCom();};
$('compCsvBtn').onclick=()=>{const b=$('compCsvBox');b.style.display=b.style.display==='none'?'':'none';};
$('compCsvLoad').onclick=()=>{const r=parseCsv($('compCsv').value).filter(x=>x.length>=4&&!/^market$/i.test(x[0]));if(!r.length)return;
  ST.com.competitors=r.map(x=>({market:x[0].toUpperCase(),carrier:x[1].toUpperCase(),freq:num(x[2]),fare:num(x[3]),date:x[4]||''}));save();renderComInputs();schedCom();$('compCsvBox').style.display='none';};
$('dashRefresh').onclick=async()=>{planStale=true;lastPrice=null;await updateCom();};
const pctS=x=>x==null||!isFinite(x)?'–':(x*100).toFixed(1)+'%';
const vsB=(v,b,higherGood,fmt)=>{if(b==null||b===''||!isFinite(num(b,NaN)))return '';const d=v-num(b),good=higherGood?d>=0:d<=0;return ` · <span class="chg ${good?'up':'dn'}">${d>=0?'+':''}${fmt(d)} vs budget</span>`;};
async function renderCom(R){
  const P=R.pnl,T=P.total,bud=ST.com.budget||{};
  // dashboard
  const basisTxt=ST.com.basis==='optimised'&&lastPlan?'optimised plan':'current schedule';
  $('dashMeta').innerHTML=`Network P&amp;L per week on the <b>${basisTxt}</b> · ${P.rows.length} routes · ${esc(cur())}`;
  const anc=T.pax?T.anc_rev/T.pax:0,ac=ST.plan.fleets.reduce((s,f)=>s+num(f.count),0);
  $('dashKpis').innerHTML=kpiHtml([
    ['Revenue / week',kmoney(T.revenue),`Passenger ${kmoney(T.pax_rev)} · ancillary ${kmoney(T.anc_rev)}`+vsB(T.revenue,bud.revenue_wk,true,kmoney)],
    ['Operating profit / week',kmoney(T.profit),`Margin ${pctS(T.margin)}`+vsB(T.margin*100,bud.margin,true,x=>x.toFixed(1)+' pts')],
    ['Load factor',pctS(T.lf),`${f0(T.pax)} passengers / week`+vsB(T.lf*100,bud.lf,true,x=>x.toFixed(1)+' pts')],
    ['RASK / CASK',`${T.rask!=null?T.rask.toFixed(3):'–'} / ${T.cask!=null?T.cask.toFixed(3):'–'}`,`per seat-km`+vsB(T.cask||0,bud.cask,false,x=>x.toFixed(3))],
    ['Yield',T.yield!=null?T.yield.toFixed(3):'–','Passenger revenue per RPK'],
    ['Ancillary per passenger',money(anc),`${pctS(T.revenue?T.anc_rev/T.revenue:0)} of revenue`],
    ['Distribution cost',pctS(T.revenue?T.dist_cost/T.revenue:0),`${kmoney(T.dist_cost)} / week`],
    ['Block hours / aircraft / day',ac?(T.bh/ac/7).toFixed(1):'–',`${f0(T.bh)} block hours / week, ${ac} aircraft`]]);
  const top=P.rows.slice().sort((a,b)=>b.profit-a.profit);
  barChart($('chDashProfit'),top.map(r=>r.route),[{name:'Profit',color:'var(--series-1)',vals:top.map(r=>r.profit)}],cur()+' per week',v=>money(v),true);
  const parts=[['Variable operating',T.var_cost+T.fuel_adj],['Aircraft ownership',T.ownership],['Overheads',T.overhead],['Distribution',T.dist_cost],['Ancillary cost',T.anc_cost],['Operating profit',T.profit]];
  hbarChart($('chDashCost'),parts.map(p=>p[0]),parts.map(p=>T.revenue?p[1]/T.revenue*100:0),v=>v.toFixed(0)+'%',null,0);
  // alerts from every module
  const alerts=[];
  P.rows.filter(r=>r.profit<0).forEach(r=>alerts.push(`<b>${esc(r.route)}</b> loses ${kmoney(-r.profit)} a week (margin ${pctS(r.margin)}).`));
  R.market.markets.filter(m=>m.position==='premium').forEach(m=>alerts.push(`<b>${esc(m.market)}</b> lowest fare is ${(m.price_index-100).toFixed(0)}% above the cheapest competitor.`));
  R.corporates.filter(c=>c.compliance!=null&&c.compliance<0.8).forEach(c=>alerts.push(`Corporate <b>${esc(c.name)}</b> at ${pctS(c.compliance)} of its committed volume.`));
  try{const pr=lastPrice;if(pr)pr.warnings.slice(0,3).forEach(w=>alerts.push('Pricing: '+esc(w)));}catch(e){}
  try{const sc=E.schedAnalyzeChange(ST.sched,ST.plan,rmOds());sc.prop.warnings.slice(0,3).forEach(w=>alerts.push('Schedule: '+esc(w)));sc.prop.rm_at_risk.forEach(x=>alerts.push(`Schedule: RM sells <b>${esc(x)}</b> but it has no connection.`));}catch(e){}
  try{const op=E.opsRun(opsSched(),ST.plan,ST.ops);const sh=op.roster.shortages.length;if(sh)alerts.push(`Crew: ${sh} duty positions unfilled this week.`);op.tails.warnings.slice(0,2).forEach(w=>alerts.push('Aircraft: '+esc(w)));}catch(e){}
  try{const iv=E.inventoryRun(ST.rm,ST.sched.prop,ST.inv);if(iv.summary.manual)alerts.push(`Inventory: <b>${iv.summary.manual}</b> flight-dates under manual control (system optimisation off) and ${iv.summary.adjust} adjusted in the next ${num(ST.inv.days,14)} days.`);}catch(e){}
  try{const rr=lastRm||E.rmCompute(ST.rm);rr.legs.filter(l=>l.C>0&&l.toCome/l.C>1.5).forEach(l=>alerts.push(`RM: <b>${esc(l.code)}</b> demand to come is ${(l.toCome/l.C).toFixed(1)}× the seats left (bid price ${money(l.net)}).`));}catch(e){}
  $('dashAlerts').innerHTML=alerts.length?'<ul style="margin:0;padding-left:18px">'+alerts.map(a=>`<li>${a}</li>`).join('')+'</ul>':'<span class="pill open"><span class="dot">✓</span>No alerts</span>';
  // route P&L
  $('pnlKpis').innerHTML=kpiHtml([['Revenue / week',kmoney(T.revenue),`${f0(T.pax)} passengers`],['Costs / week',kmoney(T.cost),`CASK ${T.cask!=null?T.cask.toFixed(3):'–'}`],['Profit / week',kmoney(T.profit),`Margin ${pctS(T.margin)}`],
    ['Routes losing money',f0(P.rows.filter(r=>r.profit<0).length),`of ${P.rows.length}`],['Fuel index',`${num(ST.com.costs.fuel_index,100)}`,`Fuel adjustment ${kmoney(T.fuel_adj)} / week`]]);
  barChart($('chPnl'),top.map(r=>r.route),[{name:'Profit',color:'var(--series-1)',vals:top.map(r=>r.profit)}],cur()+' per week',v=>money(v),true);
  const cols=[['Fleet',r=>esc(r.fleet),1],['Freq / wk',r=>r.freq],['Pax / wk',r=>f0(r.pax)],['LF',r=>pctS(r.lf)],['Passenger rev',r=>kmoney(r.pax_rev)],['Ancillary rev',r=>kmoney(r.anc_rev)],['Distribution',r=>kmoney(r.dist_cost)],
    ['Variable op cost',r=>kmoney(r.var_cost+r.fuel_adj)],['Ownership',r=>kmoney(r.ownership)],['Overheads',r=>kmoney(r.overhead)],['Profit',r=>`<b class="chg ${r.profit<0?'dn':'up'}">${kmoney(r.profit)}</b>`],['Margin',r=>pctS(r.margin)],['RASK',r=>r.rask!=null?r.rask.toFixed(3):'–'],['CASK',r=>r.cask!=null?r.cask.toFixed(3):'–'],['Yield',r=>r.yield!=null?r.yield.toFixed(3):'–']];
  $('pnlTbl').innerHTML='<thead><tr><th class="l">Route</th>'+cols.map(c=>`<th class="${c[2]?'l':''}">${c[0]}</th>`).join('')+'</tr></thead><tbody>'+P.rows.map(r=>`<tr class="${r.profit<0?'diff':''}"><td class="l"><b>${esc(r.route)}</b></td>`+cols.map(c=>`<td class="${c[2]?'l':''}">${c[1](r)}</td>`).join('')+'</tr>').join('')+
    `<tr class="grp"><td class="l"><b>Network</b></td><td></td><td></td><td><b>${f0(T.pax)}</b></td><td>${pctS(T.lf)}</td><td>${kmoney(T.pax_rev)}</td><td>${kmoney(T.anc_rev)}</td><td>${kmoney(T.dist_cost)}</td><td>${kmoney(T.var_cost+T.fuel_adj)}</td><td>${kmoney(T.ownership)}</td><td>${kmoney(T.overhead)}</td><td><b>${kmoney(T.profit)}</b></td><td>${pctS(T.margin)}</td><td>${T.rask!=null?T.rask.toFixed(3):'–'}</td><td>${T.cask!=null?T.cask.toFixed(3):'–'}</td><td>${T.yield!=null?T.yield.toFixed(3):'–'}</td></tr></tbody>`;
  // ancillaries & sales
  const routes=ST.plan.routes.map(r=>String(r.route).toUpperCase());
  $('ancKpis').innerHTML=kpiHtml([['Ancillary revenue / week',kmoney(T.anc_rev),`${money(anc)} per passenger`],['Ancillary margin',pctS(T.anc_rev?(T.anc_rev-T.anc_cost)/T.anc_rev:0),`Cost ${kmoney(T.anc_cost)}`],
    ['Distribution cost / week',kmoney(T.dist_cost),`${money(T.pax?T.dist_cost/T.pax:0)} per passenger`],['Corporate discount cost (to date)',kmoney(R.corporates.reduce((s,c)=>s+c.discount_cost,0)),`${R.corporates.length} contracts`]]);
  $('ancOut').innerHTML='<thead><tr><th class="l">Route</th>'+ST.com.ancillaries.map(a=>`<th>${esc(a.item)}</th>`).join('')+'<th>Total per passenger</th><th>Per week</th></tr></thead><tbody>'+routes.map(rt=>{const row=P.rows.find(r=>r.route===rt);
    const per=ST.com.ancillaries.map(a=>(E.ancPerPax({ancillaries:[a]},rt)[0]));const t=per.reduce((x,y)=>x+y,0);
    return `<tr><td class="l"><b>${esc(rt)}</b></td>${per.map(v=>`<td>${v?money(v):'–'}</td>`).join('')}<td><b>${money(t)}</b></td><td>${row?kmoney(row.anc_rev):'–'}</td></tr>`;}).join('')+'</tbody>';
  const shareTot=ST.com.channels.reduce((s,c)=>s+num(c.share),0),avgFare=T.pax?T.pax_rev/T.pax:0;
  $('chOut').innerHTML=`Shares add up to <b>${shareTot.toFixed(0)}%</b>${Math.abs(shareTot-100)>0.5?' <span class="chg dn">(should be 100%)</span>':''} · at the average fare of ${money(avgFare)} distribution costs <b>${money(T.pax?T.dist_cost/T.pax:0)}</b> per passenger (${pctS(T.pax_rev?T.dist_cost/T.pax_rev:0)} of passenger revenue). By channel: `+ST.com.channels.map(c=>`${esc(c.channel)} ${money(num(c.cost_seg)+avgFare*(num(c.commission)+num(c.incentive))/100)}`).join(' · ');
  $('corpOut').innerHTML='<thead><tr><th class="l">Corporate</th><th class="l">Markets</th><th>Discount</th><th>Target to date</th><th>Actual</th><th>Compliance</th><th>Discount cost to date</th></tr></thead><tbody>'+R.corporates.map(c=>`<tr><td class="l"><b>${esc(c.name)}</b></td><td class="l">${esc(c.markets)}</td><td>${c.discount}%</td><td>${f0(c.target_to_date)}</td><td>${f0(c.actual)}</td><td><span class="chg ${c.compliance!=null&&c.compliance<0.8?'dn':'up'}">${pctS(c.compliance)}</span></td><td>${kmoney(c.discount_cost)}</td></tr>`).join('')+'</tbody>';
  // market
  const M=R.market.markets;
  $('mktKpis').innerHTML=kpiHtml([['Markets tracked',f0(M.length),`${ST.com.competitors.length} competitor observations`],['Average price index',M.filter(m=>m.price_index!=null).length?(M.filter(m=>m.price_index!=null).reduce((s,m)=>s+m.price_index,0)/M.filter(m=>m.price_index!=null).length).toFixed(0):'–','100 = level with the cheapest competitor'],
    ['Markets where we are dearer',f0(M.filter(m=>m.position==='premium').length),'More than 5% above the cheapest'],['Average estimated share',pctS(M.length?M.reduce((s,m)=>s+m.own_est_share,0)/M.length:0),'Own carrier, model estimate']]);
  $('mktOut').innerHTML='<thead><tr><th class="l">Market</th><th class="l">Carrier</th><th>Weekly frequency</th><th>Frequency share</th><th>Lowest total fare</th><th>Estimated share</th><th class="l">Price position</th></tr></thead><tbody>'+M.map(m=>m.players.map((p,i)=>
    `<tr class="${i===0?'grp':''} ${p.own?'changed':''}"><td class="l">${i===0?`<b>${esc(m.market)}</b>`:''}</td><td class="l">${p.own?'<b>'+esc(p.carrier)+' (own)</b>':esc(p.carrier)}</td><td>${f0(p.freq)}</td><td>${pctS(p.freq_share)}</td><td>${p.fare?money(p.fare):'–'}</td><td>${pctS(p.est_share)}</td>
     <td class="l">${i===0?(m.position?`<span class="chg ${m.position==='premium'?'dn':'up'}">${esc(m.position)}</span> <span class="note">index ${m.price_index.toFixed(0)}</span>`:'<span class="note">no fare</span>'):''}</td></tr>`).join('')).join('')+'</tbody>';
  // interline
  const IL=R.prorate,own=String(ST.com.own_carrier||'ZZ').toUpperCase();
  const ownRev=IL.rows.reduce((s,r)=>s+r.own_share*r.pax,0),totRev=IL.rows.reduce((s,r)=>s+r.fare*r.pax,0);
  $('ilKpis').innerHTML=kpiHtml([['Itineraries',f0(IL.rows.length),`${f0(IL.rows.reduce((s,r)=>s+r.pax,0))} passengers`],['Through-fare revenue',kmoney(totRev),'All carriers'],['Own share',kmoney(ownRev),pctS(totRev?ownRev/totRev:0)+' of through fares'],
    ['Warnings',f0(IL.warnings.length),IL.warnings.slice(0,2).map(esc).join(' · ')||'None']]);
  $('ilOut').innerHTML='<thead><tr><th class="l">Itinerary</th><th class="l">Carrier</th><th class="l">Sector</th><th>Miles</th><th class="l">Method</th><th>Share per pax</th><th>Share %</th></tr></thead><tbody>'+IL.rows.map(r=>r.segments.map((g,i)=>
    `<tr class="${i===0?'grp':''} ${g.carrier===own?'changed':''}"><td class="l">${i===0?`<b>${esc(r.id)}</b> <span class="note">${money(r.fare)}</span>`:''}</td><td class="l">${esc(g.carrier)}</td><td class="l">${esc(g.sector)}</td><td>${f0(g.miles)}</td><td class="l">${g.method}</td><td>${money(g.share)}</td><td>${pctS(r.fare?g.share/r.fare:0)}</td></tr>`).join('')).join('')+'</tbody>';
  const byC={};IL.rows.forEach(r=>r.segments.forEach(g=>{byC[g.carrier]=(byC[g.carrier]||0)+g.share*r.pax;}));
  $('ilSettle').innerHTML='<thead><tr><th class="l">Carrier</th><th>Revenue due</th><th>Share</th></tr></thead><tbody>'+Object.entries(byC).sort((a,b)=>b[1]-a[1]).map(([c,v])=>`<tr class="${c===own?'changed':''}"><td class="l"><b>${esc(c)}</b>${c===own?' (own)':''}</td><td>${kmoney(v)}</td><td>${pctS(totRev?v/totRev:0)}</td></tr>`).join('')+'</tbody>';
  renderWhatIf();
}
// ---- what-if: live P&L on adjusted copies of the data; nothing is changed until Apply or Save
const WI_DEF={demand:0,fare:0,elast:0.8,fuel:null,anc:0,cost:0};let WI={...WI_DEF};
const WI_SL=[['demand','Demand',-40,40,1,v=>(v>0?'+':'')+v+'%'],['fare','Average fare',-30,30,1,v=>(v>0?'+':'')+v+'%'],
  ['elast','Demand response to fare (elasticity)',0,2,0.1,v=>(+v).toFixed(1)],['fuel','Fuel price index',50,200,5,v=>String(v)],
  ['cost','Other operating cost per block hour',-20,30,1,v=>(v>0?'+':'')+v+'%'],['anc','Ancillary take rates',-50,100,5,v=>(v>0?'+':'')+v+'%']];
const wiFuel=()=>WI.fuel==null?num(ST.com.costs.fuel_index,100):WI.fuel;
const wiActive=()=>WI.demand||WI.fare||WI.anc||WI.cost||wiFuel()!==num(ST.com.costs.fuel_index,100);
function wiApplyTo(S){const d=WI.demand/100,f=WI.fare/100,dm=(1+d)*Math.pow(1+f,-WI.elast);
  S.plan.routes.forEach(r=>{r.demand=num(r.demand)*dm;r.fare=num(r.fare)*(1+f);});
  // fuel is handled by the fuel index; the slider for other cost scales the non-fuel share of cost per BH
  const fs=num(S.com.costs.fuel_share,35)/100;S.plan.fleets.forEach(fl=>{fl.cost_bh=num(fl.cost_bh)*(fs+(1-fs)*(1+WI.cost/100));});
  S.com.costs.fuel_index=wiFuel();S.com.ancillaries.forEach(a=>{a.take=Math.min(100,num(a.take)*(1+WI.anc/100));});return S;}
function wiLabel(){const p=[];WI_SL.forEach(([k,n,,,,fmt])=>{if(k==='elast')return;const v=k==='fuel'?wiFuel():WI[k];if(k==='fuel'?v!==num(ST.com.costs.fuel_index,100):v)p.push(`${n.toLowerCase()} ${fmt(v)}`);});return p.join(', ')||'no change';}
function renderWhatIfInputs(){
  $('wiSliders').innerHTML=WI_SL.map(([k,n,lo,hi,st,fmt])=>{const v=k==='fuel'?wiFuel():WI[k];
    return `<label class="wi"><span>${n}</span><input type="range" min="${lo}" max="${hi}" step="${st}" value="${v}" data-wi="${k}" aria-label="${n}"><output>${fmt(v)}</output></label>`;}).join('');
  $('wiSliders').querySelectorAll('[data-wi]').forEach(el=>el.oninput=()=>{const k=el.dataset.wi,v=+el.value;WI[k]=v;
    el.nextElementSibling.textContent=WI_SL.find(x=>x[0]===k)[5](v);renderWhatIf();});}
function renderWhatIf(){if(!$('wiKpis'))return;
  const rows=(lastPrice&&lastPrice.rows)||[],basis=comBasis();
  const B=E.commercialRun(ST.com,ST.plan,rows,basis).pnl,W=E.commercialRun(...(()=>{const S=wiApplyTo({plan:clone(ST.plan),com:clone(ST.com)});return [S.com,S.plan];})(),rows,basis).pnl;
  const b=B.total,w=W.total,on=wiActive();
  const dl=(x,y,fmt,good=1)=>{const d=x-y;if(Math.abs(d)<1e-9)return '<span class="note">no change</span>';return `<span class="chg ${(d>0)===(good>0)?'up':'dn'}">${d>0?'+':''}${fmt(d)}</span> vs today`;};
  const pts=x=>(x*100).toFixed(1)+' pts';
  $('wiKpis').innerHTML=kpiHtml([['Revenue / week',kmoney(w.revenue),dl(w.revenue,b.revenue,kmoney)],['Operating profit / week',kmoney(w.profit),dl(w.profit,b.profit,kmoney)],
    ['Margin',pctS(w.margin),dl(w.margin,b.margin,pts)],['Load factor',pctS(w.lf),dl(w.lf,b.lf,pts)],['Passengers / week',f0(w.pax),dl(w.pax,b.pax,f0)],
    ['CASK',w.cask!=null?w.cask.toFixed(3):'–',w.cask!=null&&b.cask!=null?dl(w.cask,b.cask,x=>x.toFixed(3),-1):'']]);
  $('wiState').innerHTML=on?`What-if: <b>${esc(wiLabel())}</b>`:'Move a slider to see how profit responds. Frequencies and fleets stay as on the schedule basis.';
  ['wiApply','wiSave','wiReset'].forEach(id=>$(id).disabled=!on);
  const wm={};W.rows.forEach(r=>wm[r.route]=r);const rs=B.rows.slice().sort((x,y)=>y.profit-x.profit);
  barChart($('chWi'),rs.map(r=>r.route),[{name:'Today',color:'var(--series-2)',vals:rs.map(r=>r.profit)},{name:'What-if',color:'var(--series-1)',vals:rs.map(r=>(wm[r.route]||{}).profit??null)}],cur()+' profit per week',v=>money(v),true);}
$('wiReset').onclick=()=>{WI={...WI_DEF};renderWhatIfInputs();renderWhatIf();};
$('wiApply').onclick=()=>{if(!wiActive())return;const lab=wiLabel();
  if(!confirm(`Apply this what-if to your data?\n\n${lab}\n\nThis changes route demand and fares, fleet cost per block hour, the fuel index and ancillary take rates. You can undo it.`))return;
  const S=wiApplyTo({plan:ST.plan,com:ST.com});S.plan.routes.forEach(r=>{r.demand=Math.round(r.demand);r.fare=Math.round(r.fare);});S.plan.fleets.forEach(f=>f.cost_bh=Math.round(f.cost_bh));
  S.com.ancillaries.forEach(a=>a.take=Math.round(a.take*10)/10);
  WI={...WI_DEF};save();planStale=true;renderComInputs();renderWhatIfInputs();schedCom();toast(`Applied: ${lab}. Press Ctrl+Z to undo.`);};
$('wiSave').onclick=async()=>{if(!wiActive())return;const name='What-if: '+wiLabel();
  const S=wiApplyTo(clone(ST));try{await saveScenario(name.slice(0,120),S);toast(`Saved scenario "${name}". Load it from Data & scenarios.`);}catch(e){toast('Save failed: '+e.message,'bad');}};
$('copyPnl').onclick=()=>{if(!lastCom)return;const k=['route','fleet','freq','pax','lf','pax_rev','anc_rev','anc_cost','dist_cost','var_cost','fuel_adj','ownership','overhead','revenue','cost','profit','margin','rask','cask','yield'];
  copy([k.join(','),...lastCom.pnl.rows.map(r=>k.map(x=>typeof r[x]==='number'?r[x].toFixed(4):r[x]).join(','))].join('\n'),$('pnlMsg'));};


// ================= INVENTORY CONTROL =================
let lastInv=null,invTimer=null,invSeq=0,invOpen=null,invShown=null;
function schedInv(){clearTimeout(invTimer);invTimer=setTimeout(updateInv,server?350:80);}
async function runInvEngine(){
  const usesAu=(ST.inv.rules||[]).some(r=>String(r.au||'').trim()||String(r.cabin_au??'').trim());
  if(server&&!usesAu){try{return await api('/api/inventory/run',{rm:ST.rm,sched:ST.sched.prop,inv:ST.inv});}catch(e){console.warn('server inventory failed, using browser',e);}}
  return E.inventoryRun(ST.rm,ST.sched.prop,ST.inv);
}
async function updateInv(){const seq=++invSeq;const R=await runInvEngine();if(seq!==invSeq)return;
  R.rows.forEach(r=>{if(r.bp==null&&r.has_system)r.bp=Infinity;if(r.bp_eff==null&&r.has_system)r.bp_eff=Infinity;});lastInv=R;renderInv(R);}
const RULE_COLS=[{h:'Active',k:'active',l:1,opts:['yes','no']},{h:'Name',k:'name',l:1,w:200},{h:'Mode',k:'mode',l:1,opts:['manual','adjust']},{h:'Sectors',k:'sectors',l:1,w:90,up:1},
  {h:'Flights',k:'flights',l:1,w:80,up:1},{h:'From',k:'from',l:1,date:1},{h:'To',k:'to',l:1,date:1},{h:'DOW',k:'dow',l:1,w:70},{h:'Dep from',k:'time_from',l:1,w:60},{h:'Dep to',k:'time_to',l:1,w:60},
  {h:'Close',k:'close',l:1,w:60,up:1},{h:'Open',k:'open',l:1,w:60,up:1},{h:'Class AUs',k:'au',l:1,w:120,up:1},{h:'Cabin AU',k:'cabin_au',num:1},{h:'Seat limits',k:'limits',l:1,w:80,up:1},{h:'BP %',k:'bp_pct',num:1},{h:'BP amount',k:'bp_fixed',num:1},
  {h:'Owner',k:'owner',l:1,w:90},{h:'Expires',k:'expires',l:1,date:1},{h:'Note',k:'note',l:1,w:220}];
function renderInvInputs(){
  document.querySelectorAll('[data-inv]').forEach(el=>{el.value=ST.inv[el.dataset.inv]??'';el.oninput=el.onchange=()=>{ST.inv[el.dataset.inv]=el.value;save();schedInv();};});
  editTable('ruleIn',ST.inv.rules,RULE_COLS,renderInvInputs,schedInv);
}
['invFSector','invFDtd','invFD0','invFD1','invFDow','invFT0','invFT1','invFMode','invOnlyModel'].forEach(id=>{const el=$(id);el.oninput=el.onchange=()=>lastInv&&renderInv(lastInv);});
$('invNow').onclick=()=>{const t=localToday();ST.inv.today=t;ST.inv.start=t;save();renderInvInputs();schedInv();toast(`Today set to ${t} (D0); the horizon now starts today.`);};
$('nrFromFilter').onclick=()=>{$('nrSectors').value=$('invFSector').value;$('nrDow').value=$('invFDow').value;$('nrT0').value=$('invFT0').value;$('nrT1').value=$('invFT1').value;
  $('nrFrom').value=$('invFD0').value||ST.inv.start||'';$('nrTo').value=$('invFD1').value||(ST.inv.start?addDaysUI(ST.inv.start,num(ST.inv.days,14)-1):'');
  const dr=dtdRange($('invFDtd').value),t0=ST.inv.today||ST.inv.start;   // a D-range filter becomes the matching dates
  if(dr&&t0){const a=addDaysUI(t0,dr[0]),b=addDaysUI(t0,dr[1]);if(a>$('nrFrom').value)$('nrFrom').value=a;if(!$('nrTo').value||b<$('nrTo').value)$('nrTo').value=b;}};
const addDaysUI=(ds,k)=>{const d=new Date(ds+'T00:00:00Z');d.setUTCDate(d.getUTCDate()+k);return d.toISOString().slice(0,10);};
$('nrCreate').onclick=()=>{const v=id=>$(id).value.trim();
  if(!v('nrSectors')&&!v('nrFlights')){$('nrMsg').textContent='Give at least a sector pattern or a flight number.';return;}
  const r={active:'yes',name:v('nrName')||`${$('nrMode').value==='manual'?'Manual':'Adjusted'} ${v('nrSectors')||v('nrFlights')}`,mode:$('nrMode').value,sectors:v('nrSectors').toUpperCase()||'ALL',flights:v('nrFlights').toUpperCase(),
    from:v('nrFrom'),to:v('nrTo'),dow:v('nrDow'),time_from:v('nrT0'),time_to:v('nrT1'),close:v('nrClose').toUpperCase(),open:v('nrOpen').toUpperCase(),limits:v('nrLimits').toUpperCase(),au:v('nrAu').toUpperCase(),cabin_au:v('nrCabin'),
    bp_pct:v('nrBpPct'),bp_fixed:v('nrBpFix'),owner:v('nrOwner'),expires:v('nrExpires'),note:v('nrNote')};
  ST.inv.rules.unshift(r);save();renderInvInputs();schedInv();$('nrMsg').textContent=`Rule "${r.name}" created at the top of the list.`;setTimeout(()=>$('nrMsg').textContent='',4000);};
// days to departure from Today (D0); shown as D0, D1, D2 …
const dtdOf=ds=>Math.round((Date.parse(ds+'T00:00:00Z')-Date.parse(String(ST.inv.today||ST.inv.start||ds)+'T00:00:00Z'))/864e5);
const dtdTxt=d=>d<0?'Departed':'D'+d;
const dtdRange=t=>{const m=/^\s*D?(\d+)\s*(?:-|–|to)?\s*D?(\d+)?\s*$/i.exec(t||'');if(!m)return null;const a=+m[1],b=m[2]!=null?+m[2]:a;return [Math.min(a,b),Math.max(a,b)];};
const localToday=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};
function invFiltered(R){const dr=dtdRange($('invFDtd').value),d0=$('invFD0').value,d1=$('invFD1').value,sec=$('invFSector').value.trim(),dw=$('invFDow').value.replace(/[^1-7]/g,''),t0=E.parseTime($('invFT0').value),t1=E.parseTime($('invFT1').value),md=$('invFMode').value,only=$('invOnlyModel').checked;
  return R.rows.filter(r=>(!dr||(dtdOf(r.date)>=dr[0]&&dtdOf(r.date)<=dr[1]))&&(!d0||r.date>=d0)&&(!d1||r.date<=d1)&&(!only||r.has_system)&&(!sec||matchSector(sec,r.sector))&&(!dw||dw.includes(r.dow))&&(!md||r.mode===md)&&
    (t0==null||E.parseTime(r.dep)%1440>=t0)&&(t1==null||E.parseTime(r.dep)%1440<=t1));}
const matchSector=(pat,sector)=>E.matchMarket(pat,sector);  // same patterns as pricing and inventory rules
const modePill=m=>m==='manual'?'<span class="pill closed"><span class="dot">✋</span>Manual</span>':m==='adjust'?'<span class="chg up">Adjusted</span>':'<span class="note">System</span>';
function renderInv(R){
  const S=R.summary,rows=invFiltered(R);
  const soon=ST.inv.rules.filter(r=>r.expires&&String(r.expires)>=String(ST.inv.today||'')&&String(r.expires)<=addDaysUI(ST.inv.today||ST.inv.start,3)).length;
  $('invKpis').innerHTML=kpiHtml([['Flight-dates in horizon',f0(S.flight_dates),`${num(ST.inv.days,14)} days from ${esc(ST.inv.start||'')}`],
    ['Under manual control',`<span style="color:${S.manual?'var(--critical)':'inherit'}">${S.manual}</span>`,'System optimisation off'],
    ['Adjusted',f0(S.adjust),'Optimisation on with analyst influence'],['Differ from system',f0(S.differs),'Flight-dates where the analyst changed availability'],
    ['Active rules',f0(ST.inv.rules.filter(r=>String(r.active)!=='no').length),`${soon} expiring within 3 days · ${S.no_model} flight-dates without an RM model`]]);
  $('invPrio').innerHTML='<div class="row">'+R.rules.map((r,i)=>`<span class="tag ${r.expired?'n':(String(ST.inv.rules[i].active)==='no'?'':'y')}">${i+1}. ${esc(r.name||'(unnamed)')} · ${r.flight_dates} flight-dates${r.expired?' · expired':''}${String(ST.inv.rules[i].active)==='no'?' · paused':''}</span>`+
    `<button data-up="${i}" title="Move up" ${i?'':'disabled'}>↑</button><button data-dn="${i}" title="Move down" ${i<R.rules.length-1?'':'disabled'}>↓</button>`).join('')+'</div>';
  $('invPrio').querySelectorAll('[data-up]').forEach(b=>b.onclick=()=>{const i=+b.dataset.up;[ST.inv.rules[i-1],ST.inv.rules[i]]=[ST.inv.rules[i],ST.inv.rules[i-1]];save();renderInvInputs();schedInv();});
  $('invPrio').querySelectorAll('[data-dn]').forEach(b=>b.onclick=()=>{const i=+b.dataset.dn;[ST.inv.rules[i+1],ST.inv.rules[i]]=[ST.inv.rules[i],ST.inv.rules[i+1]];save();renderInvInputs();schedInv();});
  const DN=['','Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
  $('invTbl').innerHTML='<thead><tr><th class="l">Departure date</th><th class="l">Flight</th><th class="l">Sector</th><th class="l">Day</th><th title="Days from Today (D0) to departure">Days to dep.</th><th>Dep time</th><th class="l">Fleet</th><th class="l">Control</th><th class="l">Rule</th><th>Bid price</th><th>Seats left</th><th title="Cabin AU / seats sold">Cabin AU / sold</th><th class="l">Availability</th><th>Changed classes</th><th></th></tr></thead><tbody>'+
    rows.map((r,k)=>`<tr class="${r.mode==='manual'?'diff':(r.mode==='adjust'?'changed':'')}"><td class="l"><b>${esc(r.date)}</b></td><td class="l"><b>${esc(r.fn)}</b></td><td class="l">${esc(r.sector)}</td><td class="l">${DN[+r.dow]}</td><td><b>${(d=>d<0?'<span class="note">Departed</span>':'D'+d)(dtdOf(r.date))}</b></td><td>${esc(r.dep)}</td><td class="l">${esc(r.fleet)}</td>
      <td class="l">${modePill(r.mode)}</td><td class="l small">${esc(r.rule_name||'')}</td><td>${r.has_system?(r.bp_eff!==r.bp?`${money(r.bp)} → <b>${money(r.bp_eff)}</b>`:money(r.bp)):'<span class="note">no model</span>'}</td><td>${r.remaining!=null?f0(r.remaining):'–'}</td><td>${r.cabin&&r.cabin.auth!=null?`${r.cabin.au!=null?'<b>'+f0(r.cabin.auth)+'</b>':f0(r.cabin.auth)} / ${r.cabin.sold!=null?f0(r.cabin.sold):'–'}`:'–'}</td>
      <td class="l"><code>${esc(r.avs)}</code></td><td>${r.differs||'–'}</td><td><button data-open="${esc(r.date+'|'+r.id)}">Open</button></td></tr>`).join('')+'</tbody>';
  $('invTbl').querySelectorAll('[data-open]').forEach(b=>b.onclick=()=>{invOpen=b.dataset.open;renderInvDetail();$('invDetail').scrollIntoView({behavior:'smooth',block:'start'});});
  if(invOpen&&invShown!==invOpen)renderInvDetail();
}
const ovName=(fn,date)=>`Override ${fn} ${date}`;
function renderInvDetail(){
  invShown=invOpen;
  if(!lastInv||!invOpen){$('invDetail').style.display='none';return;}
  const [date,id]=invOpen.split('|'),r=lastInv.rows.find(x=>x.date===date&&x.id===id);if(!r){$('invDetail').style.display='none';return;}
  $('invDetail').style.display='';
  $('invDetTitle').innerHTML=`${esc(r.fn)} ${esc(r.sector)} · ${esc(r.date)} · dep ${esc(r.dep)} · ${modePill(r.mode)}${r.rule_name?` <span class="note small">rule: ${esc(r.rule_name)}</span>`:''}`;
  const name=ovName(r.fn,r.date),ov=ST.inv.rules.find(x=>x.name===name);
  const kv=s=>{const o={};String(s||'').toUpperCase().split(',').forEach(x=>{const [k,v]=x.split(':');if(k&&v!=null&&v.trim()!=='')o[k.trim()]=v.trim();});return o;};
  const set=s=>new Set(String(s||'').toUpperCase().split(',').map(x=>x.trim()).filter(Boolean));
  const cl=set(ov&&ov.close),op=set(ov&&ov.open),lim=kv(ov&&ov.limits),au=kv(ov&&ov.au);
  $('invDetMode').value=ov?ov.mode:'system';$('invDetBp').value=ov?(ov.bp_pct??''):'';$('invDetNote').value=ov?(ov.note||''):'';$('invDetCabin').value=ov?(ov.cabin_au??''):'';
  const sys=r.has_system,cab=r.cabin||{};
  $('invDetCabin').placeholder=cab.auth_sys!=null?`system ${cab.auth_sys}`:'none';
  $('invDetTbl').innerHTML='<thead><tr><th class="l">RBD</th><th>Net fare</th><th>Sold</th><th title="Seats sold in this class and every lower class">Sold incl. lower</th><th>System AU</th><th class="l">System</th><th class="l">Status</th><th title="Nested authorisation: seats this class and all lower classes may sell in total, including seats already sold">AU</th><th title="Cap on this class only (not nested)">Seat limit</th><th>Effective AU</th><th class="l">Availability</th><th class="l">Set by</th></tr></thead><tbody>'+
    r.classes.map(c=>`<tr data-rbd="${esc(c.rbd)}"><td class="l"><b>${esc(c.rbd)}</b></td><td>${c.fare!=null?f0(c.fare):'–'}</td><td>${c.sold!=null?f0(c.sold):'–'}</td><td>${c.sold_nest!=null?f0(c.sold_nest):'–'}</td>
      <td>${c.sys_au!=null?f0(c.sys_au):(sys?'<span class="note">closed</span>':'–')}</td>
      <td class="l">${c.sys_open==null?'<span class="note">no model</span>':(c.sys_open?`Open · ${c.sys_seats}`:'Closed')}</td>
      <td class="l"><select data-c="${esc(c.rbd)}" style="width:auto;min-width:86px" aria-label="Status for ${esc(c.rbd)}"><option value="auto">Auto</option><option value="open">Open</option><option value="closed">Closed</option></select></td>
      <td><input type="number" min="0" step="1" data-au="${esc(c.rbd)}" value="${esc(au[c.rbd]??'')}" placeholder="${c.sys_au!=null?c.sys_au:'–'}" style="width:76px;min-width:76px" aria-label="AU for ${esc(c.rbd)}"></td>
      <td><input type="number" min="0" step="1" data-l="${esc(c.rbd)}" value="${esc(lim[c.rbd]??'')}" placeholder="none" style="width:70px;min-width:70px" aria-label="Seat limit for ${esc(c.rbd)}"></td>
      <td class="ec-au"></td><td class="l ec-av"></td><td class="l note ec-src"></td></tr>`).join('')+'</tbody>';
  $('invDetTbl').querySelectorAll('[data-c]').forEach(el=>el.value=cl.has(el.dataset.c)?'closed':(op.has(el.dataset.c)?'open':'auto'));
  const collect=()=>{const c={close:[],open:[],limits:[],au:[],cabin:$('invDetCabin').value.trim()};
    $('invDetTbl').querySelectorAll('[data-c]').forEach(el=>{if(el.value==='closed')c.close.push(el.dataset.c);if(el.value==='open')c.open.push(el.dataset.c);});
    $('invDetTbl').querySelectorAll('[data-l]').forEach(el=>{if(el.value!=='')c.limits.push(`${el.dataset.l}:${el.value}`);});
    $('invDetTbl').querySelectorAll('[data-au]').forEach(el=>{if(el.value!=='')c.au.push(`${el.dataset.au}:${el.value}`);});return c;};
  const hasInputs=c=>c.close.length||c.open.length||c.limits.length||c.au.length||c.cabin!=='';
  const draft=(mode,c)=>({active:'yes',name,mode,sectors:r.sector,flights:r.fn,from:r.date,to:r.date,dow:'',time_from:'',time_to:'',close:c.close.join(','),open:c.open.join(','),
    limits:c.limits.join(','),au:c.au.join(','),cabin_au:c.cabin,bp_pct:mode==='adjust'?$('invDetBp').value:'',bp_fixed:'',owner:(ov&&ov.owner)||'',expires:'',note:$('invDetNote').value});
  // entering any analyst setting while on "System" switches the flight-date to manual control
  const effMode=c=>{let m=$('invDetMode').value;if(m==='system'&&hasInputs(c)){m='manual';$('invDetMode').value='manual';}return m;};
  const paint=(row,preview)=>{const by={};row.classes.forEach(c=>by[c.rbd]=c);
    $('invDetTbl').querySelectorAll('tbody tr').forEach(tr=>{const c=by[tr.dataset.rbd];if(!c)return;
      tr.className=c.differs?'changed':'';
      tr.querySelector('.ec-au').innerHTML=c.au_eff!=null?(c.au!=null?`<b>${f0(c.au_eff)}</b>`:f0(c.au_eff)):'–';
      tr.querySelector('.ec-av').innerHTML=(c.open==null?'<span class="note">–</span>':(c.open?`<b>Open · ${c.seats}</b>`:'<b>Closed</b>'))+(c.au_warn?` <span class="chg dn" title="${esc(c.au_warn)}">⚠ ${esc(c.au_warn)}</span>`:'');
      tr.querySelector('.ec-src').textContent=c.source;});
    const k=row.cabin||{};
    $('invDetCabinInfo').innerHTML=row.has_system?`Capacity <b>${f0(k.capacity)}</b> · system AU <b>${f0(k.auth_sys)}</b> (with RM overbooking) · cabin AU in use <b>${f0(k.auth)}</b>${k.au!=null?' <span class="tag p">manual</span>':''} · sold <b>${f0(k.sold)}</b> · seats left to sell <b>${f0(row.remaining)}</b>`
      :`No RM model for ${esc(row.sector)}: seats sold are unknown here, so AUs are applied as entered${k.au!=null?` (cabin AU ${f0(k.au)})`:''}.`;
    $('invDetAvs').innerHTML=`Availability: <code>${esc(row.avs)}</code>${preview?' <span class="tag p">preview, not saved</span>':''}`;};
  const preview=()=>{const c=collect(),m=effMode(c),others=ST.inv.rules.filter(x=>x.name!==name);
    const rules=m==='system'?others:[draft(m,c),...others];
    const res=E.inventoryRun(ST.rm,ST.sched.prop,{...ST.inv,start:r.date,days:1,rules});const pr=res.rows.find(x=>x.id===r.id);if(pr)paint(pr,true);};
  let pt=null;const later=()=>{clearTimeout(pt);pt=setTimeout(preview,120);};
  $('invDetTbl').querySelectorAll('input,select').forEach(el=>el.oninput=el.onchange=later);
  ['invDetCabin','invDetMode','invDetBp'].forEach(id=>$(id).oninput=$(id).onchange=later);
  paint(r,false);
  $('invDetSave').onclick=()=>{const c=collect(),mode=effMode(c);ST.inv.rules=ST.inv.rules.filter(x=>x.name!==name);
    if(mode!=='system')ST.inv.rules.unshift(draft(mode,c));
    save();invShown=null;renderInvInputs();updateInv();$('invDetMsg').textContent=mode==='system'?'Override removed: the system controls this flight-date.':'Override saved for this flight-date.';setTimeout(()=>$('invDetMsg').textContent='',4000);};
  $('invDetClear').onclick=()=>{ST.inv.rules=ST.inv.rules.filter(x=>x.name!==name);save();invShown=null;renderInvInputs();updateInv();$('invDetMsg').textContent='Override removed.';};
}
$('invDetClose').onclick=()=>{invOpen=null;invShown=null;$('invDetail').style.display='none';};
$('invCopy').onclick=()=>{if(!lastInv)return;const rows=[['departure_date','dow','days_to_departure','flight','sector','dep','fleet','control','rule','bid_price','bid_price_effective','seats_left','cabin_au','sold','availability']];
  invFiltered(lastInv).forEach(r=>rows.push([r.date,r.dow,dtdTxt(dtdOf(r.date)),r.fn,r.sector,r.dep,r.fleet,r.mode,r.rule_name||'',r.bp!=null&&isFinite(r.bp)?r.bp.toFixed(2):'',r.bp_eff!=null&&isFinite(r.bp_eff)?r.bp_eff.toFixed(2):'',r.remaining??'',r.cabin&&r.cabin.auth!=null?r.cabin.auth:'',r.cabin&&r.cabin.sold!=null?r.cabin.sold:'',r.avs]));
  copy(rows.map(r=>r.join(',')).join('\n'),$('invMsg'));};

// ================= charts =================
const pick=(el,d)=>el.dispatchEvent(new CustomEvent('chartpick',{bubbles:true,detail:d}));
const tip=$('tip');
function niceMax(v){if(v<=0)return 1;const p=Math.pow(10,Math.floor(Math.log10(v)));const m=v/p;return(m<=1?1:m<=2?2:m<=2.5?2.5:m<=5?5:10)*p;}
function showTip(e,html){tip.innerHTML=html;tip.style.display='block';const tw=tip.offsetWidth;let lx=e.clientX+14;if(lx+tw>window.innerWidth-8)lx=e.clientX-tw-14;
  tip.style.left=lx+window.scrollX+'px';tip.style.top=(e.clientY+window.scrollY-10)+'px';}
const hideTip=()=>tip.style.display='none';
const axFmt=v=>Math.abs(v)>=1e6?(v/1e6).toFixed(1)+'M':Math.abs(v)>=1e3?(v/1e3).toFixed(v%1000?1:0)+'k':Math.round(v)+'';
function barChart(el,cats,series,yTitle,fmt,rotate){
  const W=560,H=rotate?300:280,m={l:58,r:12,t:12,b:rotate?62:34},iw=W-m.l-m.r,ih=H-m.t-m.b;
  if(!cats.length){el.innerHTML='';return;}
  const all=series.flatMap(s=>s.vals).filter(v=>v!=null);const ymax=niceMax(Math.max(1,...all)*1.05),ymin=Math.min(0,...all);
  const span=ymax-ymin,sy=y=>m.t+ih-((y-ymin)/span)*ih;
  const gw=iw/cats.length,bw=Math.min(28,(gw*0.8)/series.length);let g='';
  for(let i=0;i<=4;i++){const v=ymin+span*i/4,y=sy(v);g+=`<line x1="${m.l}" x2="${W-m.r}" y1="${y}" y2="${y}" stroke="var(--grid)"/><text x="${m.l-8}" y="${y+4}" text-anchor="end" font-size="11" fill="var(--text-muted)">${axFmt(v)}</text>`;}
  cats.forEach((c,ci)=>{const x0=m.l+gw*ci+(gw-bw*series.length-2*(series.length-1))/2;
    series.forEach((s,si)=>{const v=s.vals[ci],x=x0+si*(bw+2);
      if(v==null){g+=`<text x="${x+bw/2}" y="${sy(0)-4}" text-anchor="middle" font-size="9" fill="var(--text-muted)">full</text>`;return;}
      const top=Math.min(sy(v),sy(0)),hgt=Math.abs(sy(0)-sy(v)),r=Math.min(4,bw/2,hgt);
      if(hgt>0)g+=v>=0?`<path d="M${x},${sy(0)} V${top+r} Q${x},${top} ${x+r},${top} H${x+bw-r} Q${x+bw},${top} ${x+bw},${top+r} V${sy(0)} Z" fill="${s.color}"/>`:`<rect x="${x}" y="${top}" width="${bw}" height="${hgt}" fill="${s.color}"/>`;
      g+=`<rect x="${x-1}" y="${m.t}" width="${bw+2}" height="${ih}" fill="transparent" data-t="${esc(c)}|${esc(s.name)}|${v}"/>`;});
    g+=rotate?`<text transform="translate(${m.l+gw*ci+gw/2} ${H-m.b+12}) rotate(-40)" text-anchor="end" font-size="10.5" fill="var(--text-secondary)">${esc(c)}</text>`
      :`<text x="${m.l+gw*ci+gw/2}" y="${H-m.b+16}" text-anchor="middle" font-size="11" fill="var(--text-secondary)">${esc(c)}</text>`;});
  g+=`<line x1="${m.l}" x2="${W-m.r}" y1="${sy(0)}" y2="${sy(0)}" stroke="var(--text-muted)"/>`;
  g+=`<text transform="translate(13 ${m.t+ih/2}) rotate(-90)" text-anchor="middle" font-size="11.5" fill="var(--text-secondary)">${esc(yTitle)}</text>`;
  el.innerHTML=`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(yTitle)}">${g}</svg>`;
  el.querySelectorAll('[data-t]').forEach(r=>{r.addEventListener('mousemove',e=>{const [c,n,v]=r.dataset.t.split('|');showTip(e,`<b>${esc(c)}</b><br>${esc(n)}: <b>${esc(fmt(+v))}</b>`+(el.dataset.pick?'<br><span class="note">Click for details</span>':''));});r.addEventListener('mouseleave',hideTip);
    r.addEventListener('click',()=>{const [c,n]=r.dataset.t.split('|');pick(el,{cat:c,series:n});});});
}
function bhChart(el,cats,opt,curv,budget){
  const W=560,rowH=58,m={l:90,r:60,t:6,b:26},H=m.t+m.b+rowH*cats.length,iw=W-m.l-m.r;
  const xmax=niceMax(Math.max(1,...opt,...curv,...budget)*1.05),sx=v=>m.l+v/xmax*iw;let g='';
  for(let i=0;i<=4;i++){const v=xmax*i/4;g+=`<line x1="${sx(v)}" x2="${sx(v)}" y1="${m.t}" y2="${H-m.b}" stroke="var(--grid)"/><text x="${sx(v)}" y="${H-8}" text-anchor="middle" font-size="11" fill="var(--text-muted)">${axFmt(v)}</text>`;}
  cats.forEach((c,i)=>{const y=m.t+i*rowH+8,bh=18;
    [[opt[i],'var(--series-1)','Optimised'],[curv[i],'var(--series-2)','Current']].forEach(([v,col,n],j)=>{const yy=y+j*(bh+3),x1=sx(v||0);
      if(v>0)g+=`<path d="M${m.l},${yy} H${x1-3} Q${x1},${yy} ${x1},${yy+3} V${yy+bh-3} Q${x1},${yy+bh} ${x1-3},${yy+bh} H${m.l} Z" fill="${col}"/>`;
      g+=`<text x="${x1+6}" y="${yy+bh/2+4}" font-size="11" fill="var(--text-secondary)">${f0(v)}</text>`;
      g+=`<rect x="${m.l}" y="${yy}" width="${iw}" height="${bh}" fill="transparent" data-t="${esc(c)}|${n}|${v}|${budget[i]}"/>`;});
    const bx=sx(budget[i]||0);g+=`<line x1="${bx}" x2="${bx}" y1="${y-4}" y2="${y+2*bh+7}" stroke="var(--text-primary)" stroke-width="2"/>`;
    g+=`<text x="${m.l-10}" y="${y+bh+4}" text-anchor="end" font-size="12" font-weight="600" fill="var(--text-primary)">${esc(c)}</text>`;});
  el.innerHTML=`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Block hours by fleet">${g}</svg>`;
  el.querySelectorAll('[data-t]').forEach(r=>{r.addEventListener('mousemove',e=>{const [c,n,v,b]=r.dataset.t.split('|');showTip(e,`<b>${esc(c)}</b> · ${esc(n)}<br>${f1(+v)} BH / week<br>Budget ${f0(+b)} BH`+(el.dataset.pick?'<br><span class="note">Click for details</span>':''));});r.addEventListener('mouseleave',hideTip);
    r.addEventListener('click',()=>pick(el,{cat:r.dataset.t.split('|')[0]}));});
}
function hbarChart(el,cats,vals,fmt,top,loFix){
  const W=560,rowH=40,m={l:200,r:60,t:6,b:24},H=m.t+m.b+rowH*cats.length,iw=W-m.l-m.r;
  const lo=loFix!=null?Math.min(loFix,Math.floor(Math.min(...vals)/10)*10):Math.max(0,Math.floor((Math.min(...vals)-5)/10)*10),hi=top||niceMax(Math.max(...vals));const sx=v=>m.l+(v-lo)/(hi-lo)*iw;let g='';
  for(let t=lo;t<=hi+1e-9;t+=(hi-lo)/5){g+=`<line x1="${sx(t)}" x2="${sx(t)}" y1="${m.t}" y2="${H-m.b}" stroke="var(--grid)"/><text x="${sx(t)}" y="${H-6}" text-anchor="middle" font-size="11" fill="var(--text-muted)">${fmt(t)}</text>`;}
  cats.forEach((c,i)=>{const y=m.t+i*rowH+8,h=rowH-16,x1=sx(vals[i]);
    g+=`<text x="${m.l-10}" y="${y+h/2+4}" text-anchor="end" font-size="12" fill="var(--text-secondary)">${esc(c)}</text>`;
    const x0=sx(Math.max(lo,0));
    if(x1>=x0)g+=`<path d="M${x0},${y} H${Math.max(x0,x1-4)} Q${x1},${y} ${x1},${y+4} V${y+h-4} Q${x1},${y+h} ${Math.max(x0,x1-4)},${y+h} H${x0} Z" fill="var(--series-1)"/>`;
    else g+=`<rect x="${x1}" y="${y}" width="${x0-x1}" height="${h}" fill="var(--critical)"/>`;
    g+=`<text x="${Math.max(x1,x0)+6}" y="${y+h/2+4}" font-size="12" font-weight="600" fill="var(--text-primary)">${fmt(vals[i])}</text>`;});
  g+=`<line x1="${sx(Math.max(lo,0))}" x2="${sx(Math.max(lo,0))}" y1="${m.t}" y2="${H-m.b}" stroke="var(--text-muted)"/>`;
  el.innerHTML=`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Horizontal bar chart">${g}</svg>`;
}
function lineChart(el,xs,ys,o){
  const W=560,H=260,m={l:58,r:18,t:16,b:40};
  if(o.empty||!xs.length){el.innerHTML=`<svg viewBox="0 0 ${W} ${H}"><text x="${W/2}" y="${H/2}" text-anchor="middle" fill="var(--text-muted)" font-size="13">${o.empty||'No data'}</text></svg>`;return;}
  const iw=W-m.l-m.r,ih=H-m.t-m.b,xmin=Math.min(...xs),xmax=Math.max(...xs),ymax=niceMax(Math.max(...ys,o.ref?o.ref.y:0)*1.05);
  const sx=x=>m.l+(xmax===xmin?0.5:(x-xmin)/(xmax-xmin))*iw,sy=y=>m.t+ih-(y/ymax)*ih;let g='';
  for(let i=0;i<=4;i++){const v=ymax*i/4,y=sy(v);g+=`<line x1="${m.l}" x2="${W-m.r}" y1="${y}" y2="${y}" stroke="var(--grid)"/><text x="${m.l-8}" y="${y+4}" text-anchor="end" font-size="11" fill="var(--text-muted)">${axFmt(v)}</text>`;}
  const nT=Math.min(6,xs.length);for(let i=0;i<nT;i++){const xv=Math.round(xmin+(xmax-xmin)*i/Math.max(1,nT-1));g+=`<text x="${sx(xv)}" y="${H-m.b+16}" text-anchor="middle" font-size="11" fill="var(--text-muted)">${xv}</text>`;}
  g+=`<line x1="${m.l}" x2="${W-m.r}" y1="${sy(0)}" y2="${sy(0)}" stroke="var(--text-muted)"/><text x="${m.l+iw/2}" y="${H-6}" text-anchor="middle" font-size="11.5" fill="var(--text-secondary)">${o.xLabel}</text>`;
  if(o.ref){const y=sy(o.ref.y);g+=`<line x1="${m.l}" x2="${W-m.r}" y1="${y}" y2="${y}" stroke="var(--text-secondary)" stroke-width="1.25" stroke-dasharray="5 4"/><text x="${m.l+6}" y="${y-6}" font-size="11.5" fill="var(--text-secondary)">${esc(o.ref.label)}</text>`;}
  g+=`<polyline points="${xs.map((x,i)=>sx(x).toFixed(1)+','+sy(ys[i]).toFixed(1)).join(' ')}" fill="none" stroke="var(--series-1)" stroke-width="2" stroke-linejoin="round"/>`;
  if(o.marker)g+=`<circle cx="${sx(o.marker.x)}" cy="${sy(o.marker.y)}" r="5" fill="var(--series-1)" stroke="var(--surface-1)" stroke-width="2"/>`;
  g+=`<g class="hov" style="display:none"><line class="hl" y1="${m.t}" y2="${m.t+ih}" stroke="var(--text-muted)"/><circle class="hc" r="4.5" fill="var(--series-1)" stroke="var(--surface-1)" stroke-width="2"/></g><rect class="hit" x="${m.l}" y="${m.t}" width="${iw}" height="${ih}" fill="transparent"/>`;
  el.innerHTML=`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Seat value curve">${g}</svg>`;
  const svg=el.querySelector('svg'),hov=svg.querySelector('.hov'),hl=svg.querySelector('.hl'),hc=svg.querySelector('.hc');
  svg.querySelector('.hit').addEventListener('mousemove',e=>{const r=svg.getBoundingClientRect(),px=(e.clientX-r.left)*W/r.width;let bi=0,bd=Infinity;
    xs.forEach((x,i)=>{const d=Math.abs(sx(x)-px);if(d<bd){bd=d;bi=i;}});hov.style.display='';hl.setAttribute('x1',sx(xs[bi]));hl.setAttribute('x2',sx(xs[bi]));
    hc.setAttribute('cx',sx(xs[bi]));hc.setAttribute('cy',sy(ys[bi]));showTip(e,o.tip(xs[bi],ys[bi]));});
  svg.querySelector('.hit').addEventListener('mouseleave',()=>{hov.style.display='none';hideTip();});
}

function renderAll(){bindRmTop();bindPlanTop();bindSchedTop();renderLegIn();renderProdIn();renderCurveTbl();renderFleetIn();renderRouteIn();renderBenchmark();planStale=true;route();}
window.Suite={undo,redo,canUndo:()=>undoStack.length>0,canRedo:()=>redoStack.length>0,toast,
  renderFlTbl:()=>renderFlTbl(),route:()=>route()};
(async()=>{await detect();renderAll();document.dispatchEvent(new CustomEvent('suite:ready'));})();
})();
