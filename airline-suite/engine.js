// Browser engine: same models as backend/app/engine (rm.py, planning.py).
// Used for the hosted demo and when the API is not reachable. The server uses
// HiGHS for exact LP/MILP; here the fleet plan uses a Lagrangian heuristic with
// local search, so results can differ slightly from the server on large networks.
(function(global){
'use strict';
const DTD_PTS=[120,90,60,45,30,21,14,7,3,0];
const num=(x,d=0)=>{const n=parseFloat(x);return isFinite(n)?n:d;};

// ---------- normal distribution ----------
function erf(x){const s=x<0?-1:1;x=Math.abs(x);const t=1/(1+0.3275911*x);
  return s*(1-(((((1.061405429*t-1.453152027)*t)+1.421413741)*t-0.284496736)*t+0.254829592)*t*Math.exp(-x*x));}
const Phi=z=>0.5*(1+erf(z/Math.SQRT2));
const phi=z=>Math.exp(-z*z/2)/Math.sqrt(2*Math.PI);
function invPhi(p){if(p<=0)return-Infinity;if(p>=1)return Infinity;
  const a=[-3.969683028665376e+01,2.209460984245205e+02,-2.759285104469687e+02,1.383577518672690e+02,-3.066479806614716e+01,2.506628277459239e+00],
  b=[-5.447609879822406e+01,1.615858368580409e+02,-1.556989798598866e+02,6.680131188771972e+01,-1.328068155288572e+01],
  c=[-7.784894002430293e-03,-3.223964580411365e-01,-2.400758277161838e+00,-2.549732539343734e+00,4.374664141464968e+00,2.938163982698783e+00],
  d=[7.784695709041462e-03,3.224671290700398e-01,2.445134137142996e+00,3.754408661907416e+00];let q,r;
  if(p<0.02425){q=Math.sqrt(-2*Math.log(p));return(((((c[0]*q+c[1])*q+c[2])*q+c[3])*q+c[4])*q+c[5])/((((d[0]*q+d[1])*q+d[2])*q+d[3])*q+1);}
  if(p>0.97575){q=Math.sqrt(-2*Math.log(1-p));return-(((((c[0]*q+c[1])*q+c[2])*q+c[3])*q+c[4])*q+c[5])/((((d[0]*q+d[1])*q+d[2])*q+d[3])*q+1);}
  q=p-0.5;r=q*q;return(((((a[0]*r+a[1])*r+a[2])*r+a[3])*r+a[4])*r+a[5])*q/(((((b[0]*r+b[1])*r+b[2])*r+b[3])*r+b[4])*r+1);}

// ================= RM =================
function curveAt(curves,name,d){
  const v=(curves[name]||curves.mid).map(x=>Math.min(100,Math.max(0,num(x)))/100);
  if(d>=DTD_PTS[0]) return v[0];
  for(let i=0;i<DTD_PTS.length-1;i++){const hi=DTD_PTS[i],lo=DTD_PTS[i+1];if(d<=hi&&d>=lo)return v[i]+(v[i+1]-v[i])*(hi-d)/(hi-lo);}
  return 1;
}
function emsr(items,C){
  const it=items.filter(x=>x.val>0&&x.mu>0).sort((a,b)=>b.val-a.val);
  const n=it.length,out={bp:0,limits:{},curve:[],rank:{}};
  if(C<=0){out.bp=Infinity;items.forEach(x=>{out.limits[x.key]=0;out.rank[x.key]=-1;});return out;}
  if(!n){items.forEach(x=>{out.limits[x.key]=x.val>0?C:0;out.rank[x.key]=x.val>0?0:-1;});return out;}
  const nests=[];let mu=0,v=0,rev=0;
  it.forEach(x=>{mu+=x.mu;v+=x.sd*x.sd;rev+=x.val*x.mu;nests.push({mu,sd:Math.sqrt(v),pbar:rev/mu});});
  const prot=new Array(n).fill(0);
  for(let j=0;j<n-1;j++){const N=nests[j],pn=it[j+1].val;let y;
    if(pn>=N.pbar)y=0;else if(N.sd<=0)y=N.mu;else y=N.mu+N.sd*invPhi(1-pn/N.pbar);
    prot[j]=Math.max(0,y,j?prot[j-1]:0);}
  prot[n-1]=Infinity;
  const V=x=>{let j=0;while(j<n-1&&x>prot[j])j++;const N=nests[j];
    const p=N.sd>0?1-Phi((x-N.mu)/N.sd):(x<=N.mu?1:0);return Math.min(it[j].val,N.pbar*p);};
  for(let x=1;x<=C;x++) out.curve.push(V(x));
  out.bp=V(C);
  items.forEach(x=>{out.limits[x.key]=0;out.rank[x.key]=x.val>0?n:-1;});
  it.forEach((x,j)=>{out.limits[x.key]=j===0?C:Math.max(0,Math.floor(C-prot[j-1]+1e-9));out.rank[x.key]=j;});
  return out;
}
// dense simplex: max c.x, A x <= b (b>=0), x>=0
function simplex(c,A,b){
  const m=A.length,n=c.length,W=n+m+1;
  const T=[];for(let i=0;i<m;i++){const r=new Float64Array(W);for(let j=0;j<n;j++)r[j]=A[i][j];r[n+i]=1;r[W-1]=b[i];T.push(r);}
  const z=new Float64Array(W);for(let j=0;j<n;j++)z[j]=-c[j];
  const basis=[];for(let i=0;i<m;i++)basis.push(n+i);
  const eps=1e-9;let it=0;
  while(it++<50000){
    let e=-1;for(let j=0;j<W-1;j++){if(z[j]<-eps){e=j;break;}}
    if(e<0)break;
    let l=-1,best=Infinity;
    for(let i=0;i<m;i++){const a=T[i][e];if(a>eps){const r=T[i][W-1]/a;if(r<best-1e-12||(Math.abs(r-best)<=1e-12&&basis[i]<basis[l])){best=r;l=i;}}}
    if(l<0)break;
    const pr=T[l],pv=pr[e];for(let j=0;j<W;j++)pr[j]/=pv;
    for(let i=0;i<m;i++){if(i===l)continue;const f=T[i][e];if(Math.abs(f)>eps){const r=T[i];for(let j=0;j<W;j++)r[j]-=f*pr[j];}}
    const f=z[e];if(Math.abs(f)>eps)for(let j=0;j<W;j++)z[j]-=f*pr[j];
    basis[l]=e;
  }
  const x=new Array(n).fill(0);for(let i=0;i<m;i++)if(basis[i]<n)x[basis[i]]=T[i][W-1];
  const y=[];for(let i=0;i<m;i++)y.push(z[n+i]);
  return {x,y,z:z[W-1]};
}
function networkLP(prods,caps){
  const L=caps.length,P=prods.length;if(!P)return{x:[],duals:caps.map(()=>0),z:0};
  const A=[],b=[];
  for(let l=0;l<L;l++){const r=new Array(P).fill(0);prods.forEach((p,i)=>{if(p.li.includes(l))r[i]=1;});A.push(r);b.push(Math.max(0,caps[l]));}
  prods.forEach((p,i)=>{const r=new Array(P).fill(0);r[i]=1;A.push(r);b.push(Math.max(0,p.d));});
  const s=simplex(prods.map(p=>p.fare),A,b);
  return {x:s.x,duals:s.y.slice(0,L),z:s.z};
}
function binomSf(n,p,k){if(k<=0)return 1;if(k>n)return 0;if(p<=0)return 0;if(p>=1)return 1;
  const lp=Math.log(p),lq=Math.log(1-p);let tot=0,lc=0;for(let x=0;x<=n;x++){if(x>0)lc+=Math.log(n-x+1)-Math.log(x);if(x>=k)tot+=Math.exp(lc+x*lp+(n-x)*lq);}return Math.min(1,tot);}
function optimalAu(cap,noshow,fare,db,maxOb=0.3){const s=Math.min(1,Math.max(0,1-noshow));if(cap<=0||s>=1||fare<=0)return Math.max(0,cap);
  let au=cap;while(au<cap*(1+maxOb)){const full=binomSf(au,s,cap);if(s*(fare*(1-full)-db*full)<=0)break;au++;}return au;}
const sellupBeta=frat5=>Math.log(2)/(Math.max(1.05,frat5)-1);
// Hybrid forecast + marginal-revenue fare adjustment per O&D (see backend rm.apply_buydown)
function applyBuydown(prods,on,alpha,frat5,vmr){
  const beta=sellupBeta(frat5),groups={};
  prods.forEach(p=>{(groups[p.od+'|'+p.path]=groups[p.od+'|'+p.path]||[]).push(p);});
  Object.values(groups).forEach(g=>{
    g.sort((a,b)=>b.fare-a.fare);
    const fLow=Math.max(1e-9,Math.min(...g.map(x=>x.fare)));
    g.forEach(x=>{x.P=x.fare>0?Math.exp(-beta*(x.fare/fLow-1)):1;});
    const Q=alpha>0?alpha*g.reduce((s,x)=>s+x.mu_raw,0):0;
    g.forEach(x=>{x.Qtrue=Q;x.f_low=fLow;x.mu_prod=(1-alpha)*x.mu_raw;});
    let prevQ=0,prevF=null;
    g.forEach(x=>{
      if(on&&alpha>0){const qj=Q*x.P,d=Math.max(0,qj-prevQ);
        const mr=(prevF===null||d<=1e-9)?x.fare:(x.fare*qj-prevF*prevQ)/d,mu=x.mu_prod+d;
        x.dQ=d;x.mr=mr;x.mu=mu;x.val=mu>1e-12?(x.fare*x.mu_prod+mr*d)/mu:x.fare;prevQ=Math.max(prevQ,qj);prevF=x.fare;}
      else{x.dQ=0;x.mr=x.fare;x.mu=x.mu_raw;x.val=x.fare;}
      x.sd=Math.sqrt(vmr*x.mu);});
  });
}
function rmCompute(S){
  const curves=S.curves;
  const season=Math.max(0,num(S.season,1)),event=num(S.event,0),obMode=String(S.ob_mode||'manual').toLowerCase(),dbCost=Math.max(0,num(S.db_cost,1200));
  const dtd=Math.max(0,num(S.dtd)),w=Math.min(1,Math.max(0,num(S.w,0.6))),vmr=Math.max(0,num(S.vmr,1));
  const legIdx={};const legs=S.legs.map((l,i)=>{legIdx[String(l.leg).trim().toUpperCase()]=i;
    return {i,code:String(l.leg).trim().toUpperCase(),cap:num(l.cap),dist:Math.max(1,num(l.dist,1)),ref:l.ref===''||l.ref==null?null:num(l.ref,null),booked:0,noshow:Math.min(0.9,Math.max(0,num(l.noshow,0)/100))};});
  const warnings=[];
  const prods=[];
  S.prods.forEach((p,k)=>{
    const codes=String(p.path||'').split('>').map(s=>s.trim().toUpperCase()).filter(Boolean);
    const li=codes.map(c=>legIdx[c]).filter(x=>x!=null);
    if(li.length!==codes.length||!li.length){warnings.push(`${p.od} ${p.rbd}: path "${p.path}" uses a leg that is not in the leg table`);return;}
    const fare=num(p.fare),hist=Math.max(0,num(p.hist)),otb=Math.max(0,num(p.otb));
    const pct=curveAt(curves,p.curve,dtd),cd=p.closed_dtd;
    const histU=(cd!==''&&cd!=null&&num(cd)>0)?hist/Math.max(1/3,curveAt(curves,p.curve,num(cd))):hist;
    const add=histU*(1-pct),mult=pct>=0.05?otb/pct-otb:add;
    const mu=dtd<=0?0:Math.max(0,w*add+(1-w)*mult)*season*(1+event/100);
    prods.push({k,od:p.od,path:codes.join('>'),rbd:p.rbd,fare,hist,hist_u:histU,otb,curve:p.curve,pct,mu_raw:mu,li,key:'p'+k});
  });
  const bdOn=['yes','true','1'].includes(String(S.bd_on||'no').toLowerCase());
  const alpha=Math.min(1,Math.max(0,num(S.alpha,0))),frat5=Math.max(1.05,num(S.frat5,2));
  applyBuydown(prods,bdOn,alpha,frat5,vmr);
  prods.forEach(p=>p.li.forEach(l=>legs[l].booked+=p.otb));
  legs.forEach((l,i)=>{let nf=0,den=0;prods.forEach(p=>{if(!p.li.includes(i))return;const tot=p.li.reduce((s,m)=>s+legs[m].dist,0),w_=p.mu_raw+p.otb;nf+=w_*p.fare*l.dist/tot;den+=w_;});
    l.avg_fare=den?nf/den:0;l.au_opt=optimalAu(Math.round(l.cap),l.noshow,l.avg_fare,dbCost);l.ob_opt=l.cap?(l.au_opt/l.cap-1)*100:0;
    l.auth=obMode==='auto'?l.au_opt:Math.floor(l.cap*(1+num(S.ob)/100));l.C=l.auth-l.booked;l.toCome=0;});
  prods.forEach(p=>p.li.forEach(l=>legs[l].toCome+=p.mu));
  const lp=networkLP(prods.map(p=>({li:p.li,fare:p.val,d:p.mu})),legs.map(l=>l.C));
  legs.forEach((l,i)=>{l.dlp=l.C<=0?Infinity:Math.max(0,lp.duals[i]);});
  let bp=legs.map(l=>l.dlp);
  const legItems=(l,bpv)=>prods.filter(p=>p.li.includes(l)).map(p=>{let other=0;p.li.forEach(m=>{if(m!==l)other+=bpv[m];});
    return {key:p.key,val:isFinite(other)?p.val-other:-1,mu:p.mu,sd:p.sd};});
  for(let iter=0;iter<12;iter++){
    const nb=legs.map((l,i)=>emsr(legItems(i,bp),l.C).bp);const fin=bp.map(v=>isFinite(v)?v:0);
    bp=nb.map((v,i)=>!isFinite(v)?Infinity:(iter===0?v:0.5*fin[i]+0.5*v));
  }
  const legEm=legs.map((l,i)=>emsr(legItems(i,bp),l.C));
  legs.forEach((l,i)=>{l.net=bp[i];l.curve=legEm[i].curve;});
  const legOnly=legs.map((l,i)=>{const items=prods.filter(p=>p.li.includes(i)).map(p=>{const tot=p.li.reduce((s,m)=>s+legs[m].dist,0);
      return {key:p.key,val:p.val*l.dist/tot,mu:p.mu,sd:p.sd};});return {r:emsr(items,l.C),items};});
  legs.forEach((l,i)=>l.leg=legOnly[i].r.bp);
  const dl=S.method==='dlp';
  prods.forEach(p=>{
    p.nestNet=p.li.map(l=>({l,r:legEm[l].rank[p.key]??-1,lim:legEm[l].limits[p.key]??0}));
    p.nestLeg=p.li.map(l=>({l,r:legOnly[l].r.rank[p.key]??-1,lim:legOnly[l].r.limits[p.key]??0}));
    p.sumNet=p.li.reduce((s,l)=>s+legs[l].net,0);p.sumDlp=p.li.reduce((s,l)=>s+legs[l].dlp,0);
    const capOk=p.li.every(l=>legs[l].C>0);
    p.openNet=capOk&&p.val>=p.sumNet-1e-6;p.openDlp=capOk&&p.val>=p.sumDlp-1e-6;
    p.openLeg=capOk&&p.li.every(l=>{const it=legOnly[l].items.find(x=>x.key===p.key);return it.val>=legs[l].leg-1e-6;});
    const lim=Math.min(...p.li.map(l=>legEm[l].limits[p.key]??0)),capMin=Math.min(...p.li.map(l=>Math.max(0,legs[l].C)));
    p.seatsNet=p.openNet?Math.max(1,Math.min(lim,capMin)):0;p.seatsDlp=p.openDlp?capMin:0;
    p.open=dl?p.openDlp:p.openNet;p.seats=dl?p.seatsDlp:p.seatsNet;p.sumBp=dl?p.sumDlp:p.sumNet;
  });
  return {dtd,legs,prods,lp:{z:lp.z},warnings,vmr,bd:{on:bdOn,alpha,frat5,beta:sellupBeta(frat5)}};
}
function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
function expRand(rnd){let u=0;while(u===0)u=rnd();return -Math.log(u);}
// Monte Carlo with buy-down behaviour (see backend rm.simulate)
function rmSimulate(Ron,Roff,runs,lbh,seed,Rcur){
  Rcur=Rcur||Ron;
  const rnd=mulberry32(seed||1);
  const gauss=()=>{let u=0,v=0;while(u===0)u=rnd();while(v===0)v=rnd();return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v);};
  const P=Ron.prods,L=Ron.legs,beta=Ron.bd.beta,vmr=Ron.vmr??1;
  const pols=[
    {k:'fcfs',name:'First come, first served'},
    {k:'leg',name:'Leg-based EMSR-b (prorated)',nest:Roff,field:'nestLeg'},
    {k:'dlp',name:'Network LP bid prices',open:Rcur.prods.map(p=>p.openDlp)},
    {k:'net0',name:'Network EMSR nested, no buy-down model',nest:Roff,field:'nestNet'},
    {k:'net',name:'Network EMSR nested + fare adjustment',nest:Ron,field:'nestNet'},
    {k:'netbp',name:'Network bid price + fare adjustment',open:Ron.prods.map(p=>p.openNet)}];
  const gm={};P.forEach((p,i)=>{(gm[p.od+'|'+p.path]=gm[p.od+'|'+p.path]||[]).push(i);});
  const glist=Object.values(gm).map(ix=>ix.slice().sort((a,b)=>P[a].fare-P[b].fare));
  const maxF=Math.max(...P.map(p=>p.fare),1);
  const tot={};pols.forEach(q=>tot[q.k]={rev:0,pax:0});let hind=0;
  for(let r=0;r<runs;r++){
    const reqs=[];
    P.forEach((p,i)=>{const m=p.mu_prod;const n=m>0?Math.max(0,Math.round(m+Math.sqrt(vmr*m)*gauss())):0;
      for(let k=0;k<n;k++)reqs.push([lbh*(p.fare/maxF)+(1-lbh)*rnd(),0,i,0]);});
    glist.forEach((g,gi)=>{const Q=P[g[0]].Qtrue;if(Q<=0)return;const n=Math.max(0,Math.round(Q+Math.sqrt(vmr*Q)*gauss())),fl=P[g[0]].f_low;
      for(let k=0;k<n;k++)reqs.push([lbh*(fl/maxF)+(1-lbh)*rnd(),1,gi,fl*(1+expRand(rnd)/beta)]);});
    reqs.sort((a,b)=>a[0]-b[0]);
    const d=new Array(P.length).fill(0);
    reqs.forEach(([,kind,i,wtp])=>{if(kind===0)d[i]++;else{let best=null;glist[i].forEach(j=>{if(P[j].fare<=wtp+1e-9)best=j;});if(best!=null)d[best]++;}});
    hind+=networkLP(P.map((p,i)=>({li:p.li,fare:p.fare,d:d[i]})),L.map(l=>l.C)).z;
    pols.forEach(q=>{const cap=L.map(l=>Math.max(0,l.C)),sold=L.map(()=>new Array(P.length+2).fill(0));let rev=0,pax=0;
      const can=i=>{const p=P[i];if(!p.li.every(l=>cap[l]>=1))return false;
        if(q.nest){return q.nest.prods[i][q.field].every(n=>{if(n.r<0)return false;let s=0;const a=sold[n.l];for(let x=n.r;x<a.length;x++)s+=a[x];return s+1<=n.lim;});}
        if(q.open)return q.open[i];return true;};
      const book=i=>{const p=P[i];if(q.nest)q.nest.prods[i][q.field].forEach(n=>sold[n.l][n.r]++);p.li.forEach(l=>cap[l]--);rev+=p.fare;pax++;};
      for(const [,kind,i,wtp] of reqs){
        if(kind===0){if(can(i))book(i);}
        else{for(const j of glist[i]){if(P[j].fare>wtp+1e-9)break;if(can(j)){book(j);break;}}}}
      tot[q.k].rev+=rev;tot[q.k].pax+=pax;});
  }
  return {pols:pols.map(q=>({k:q.k,name:q.name,rev:tot[q.k].rev/runs,pax:tot[q.k].pax/runs})),hind:hind/runs,runs};
}
function rmSimulateState(S,runs,lbh,seed){
  return rmSimulate(rmCompute({...S,bd_on:'yes'}),rmCompute({...S,bd_on:'no'}),runs,lbh,seed,rmCompute(S));
}

// ================= FLEET & FREQUENCY PLANNING =================
function expectedPax(mu,sd,seats){
  if(mu<=0||seats<=0)return 0;if(sd<=0)return Math.min(mu,seats);
  const z=(seats-mu)/sd,loss=phi(z)-z*(1-Phi(z));return Math.max(0,Math.min(seats,mu-sd*loss));
}
function evaluate(route,fleet,f,params){
  const block=Math.max(0,num(route.block));
  if(f<=0)return {freq:0,fleet:null,bh:0,seats_wk:0,pax_wk:0,demand_wk:0,spill_wk:0,lf:0,revenue:0,cost:0,contrib:0};
  const e=Math.max(0,num(params.elasticity,0.3)),cv=Math.max(0,num(params.cv,0.35));
  const fref=Math.max(1,num(route.cur_freq,7)),muW=Math.max(0,num(route.demand))*Math.pow(f/fref,e),muD=muW/f;
  const seats=Math.max(0,num(fleet.seats)),paxD=expectedPax(muD,cv*muD,seats),pax=2*f*paxD,dem=2*muW;
  const revenue=pax*Math.max(0,num(route.fare));
  const cost=2*f*(block*Math.max(0,num(fleet.cost_bh))+Math.max(0,num(fleet.fee_dep)));
  return {freq:f,fleet:fleet.type,bh:2*f*block,seats_wk:2*f*seats,pax_wk:pax,demand_wk:dem,spill_wk:Math.max(0,dem-pax),lf:seats?pax/(2*f*seats):0,revenue,cost,contrib:revenue-cost};
}
function allowed(route,fleets,params){
  if(params&&['yes','true','1'].includes(String(params.lock_fleet||'no').toLowerCase())){
    const k=fleets.findIndex(f=>String(f.type||'').toUpperCase()===String(route.cur_fleet||'').toUpperCase());if(k>=0)return [k];}
  const spec=String(route.fleets||'').trim();
  if(!spec||spec.toLowerCase()==='all')return fleets.map((_,k)=>k);
  const names=new Set(spec.split(/[,;|]/).map(s=>s.trim().toUpperCase()).filter(Boolean));
  return fleets.map((f,k)=>names.has(String(f.type||'').toUpperCase())?k:-1).filter(k=>k>=0);
}
function currentSchedule(plan){
  const fleets=plan.fleets||[],params=plan.params||{};
  const tot={revenue:0,cost:0,contrib:0,pax_wk:0,bh:0},by=fleets.map(()=>0);
  (plan.routes||[]).forEach(rt=>{const f=Math.round(num(rt.cur_freq,0)),al=allowed(rt,fleets);
    let k=al.find(i=>String(fleets[i].type||'').toUpperCase()===String(rt.cur_fleet||'').toUpperCase());if(k==null)k=al[0];
    if(k==null||f<=0)return;const o=evaluate(rt,fleets[k],f,params);
    ['revenue','cost','contrib','pax_wk','bh'].forEach(x=>tot[x]+=o[x]);by[k]+=o.bh;});
  tot.bh_by_fleet=by;return tot;
}
function buildOptions(plan){
  const fleets=plan.fleets||[],routes=plan.routes||[],params=plan.params||{};
  let budgets=fleets.map(fl=>Math.max(0,num(fl.count))*Math.max(0,num(fl.util))*7);
  if(params.bh_mode==='current')budgets=currentSchedule(plan).bh_by_fleet;
  const opts=routes.map((rt,r)=>{const fmin=Math.max(0,Math.round(num(rt.min_freq,0))),fmax=Math.max(fmin,Math.round(num(rt.max_freq,14)));
    const o=[];if(fmin===0)o.push({...evaluate(rt,{},0,params),r,k:null});
    allowed(rt,fleets,params).forEach(k=>{for(let f=Math.max(1,fmin);f<=fmax;f++)o.push({...evaluate(rt,fleets[k],f,params),r,k});});
    return o;});
  return {opts,fleets,routes,budgets,params};
}
function solveMCK(opts,budgets){
  // multiple-choice knapsack with one budget per fleet: Lagrangian relaxation + repair + local search
  const R=opts.length,K=budgets.length;
  if(opts.some(o=>!o.length))return null;
  const usage=sel=>{const u=new Array(K).fill(0);sel.forEach(o=>{if(o.k!=null)u[o.k]+=o.bh;});return u;};
  const value=sel=>sel.reduce((s,o)=>s+o.contrib,0);
  const feasible=u=>u.every((v,k)=>v<=budgets[k]+1e-6);
  const cpb=[];opts.forEach(os=>os.forEach(o=>{if(o.bh>0)cpb.push(Math.abs(o.contrib)/o.bh);}));cpb.sort((a,b)=>a-b);
  const scale=Math.max(1,cpb[Math.floor(cpb.length/2)]||1);
  const choose=lam=>opts.map(os=>{let b=os[0],bv=-Infinity;os.forEach(o=>{const v=o.contrib-(o.k!=null?lam[o.k]*o.bh:0);if(v>bv){bv=v;b=o;}});return b;});
  function repair(sel){sel=sel.slice();let u=usage(sel),guard=0;
    while(!feasible(u)&&guard++<10000){const k=u.findIndex((v,i)=>v>budgets[i]+1e-6);let best=null,bs=Infinity;
      sel.forEach((cur,r)=>{if(cur.k!==k)return;opts[r].forEach(o=>{const saved=cur.bh-(o.k===k?o.bh:0);if(saved<=1e-9)return;
        if(o.k!=null&&o.k!==k&&u[o.k]+o.bh>budgets[o.k]+1e-6)return;const s=(cur.contrib-o.contrib)/saved;if(s<bs){bs=s;best=[r,o];}});});
      if(!best)return null;sel[best[0]]=best[1];u=usage(sel);}
    return feasible(u)?sel:null;}
  function improve(sel){sel=sel.slice();let u=usage(sel),guard=0,moved=true;
    const fits=(u2)=>feasible(u2);
    while(moved&&guard++<500){moved=false;let best=null,bg=1e-6;
      // single moves
      for(let r=0;r<R;r++){const cur=sel[r];for(const o of opts[r]){if(o===cur)continue;const g=o.contrib-cur.contrib;if(g<=bg)continue;
        const u2=u.slice();if(cur.k!=null)u2[cur.k]-=cur.bh;if(o.k!=null)u2[o.k]+=o.bh;if(fits(u2)){bg=g;best=[[r,o]];}}}
      // paired moves: step one route down a frequency, another up (same fleet hours)
      const near=r=>opts[r].filter(o=>o!==sel[r]&&(o.k===sel[r].k||o.k==null||sel[r].k==null||o.freq===sel[r].freq)&&Math.abs(o.freq-sel[r].freq)<=2);
      for(let a=0;a<R;a++)for(const oa of near(a)){const ga=oa.contrib-sel[a].contrib;
        for(let b=0;b<R;b++){if(b===a)continue;for(const ob of near(b)){const g=ga+ob.contrib-sel[b].contrib;if(g<=bg)continue;
          const u2=u.slice();[[sel[a],oa],[sel[b],ob]].forEach(([c,o])=>{if(c.k!=null)u2[c.k]-=c.bh;if(o.k!=null)u2[o.k]+=o.bh;});
          if(fits(u2)){bg=g;best=[[a,oa],[b,ob]];}}}}
      if(best){best.forEach(([r,o])=>sel[r]=o);u=usage(sel);moved=true;}}
    return sel;}
  let lam=new Array(K).fill(0),bestSel=null,bestVal=-Infinity,lastLam=lam.slice();
  for(let it=0;it<200;it++){
    const sel=choose(lam),u=usage(sel);
    if(it%10===0||it===199){const rp=repair(sel);if(rp){const v=value(rp);if(v>bestVal){bestVal=v;bestSel=rp;}}}
    const step=scale*0.5/(1+it*0.05);
    lam=lam.map((l,k)=>budgets[k]>0?Math.max(0,l+step*(u[k]-budgets[k])/budgets[k]):(u[k]>0?l+scale:l));
    lastLam=lam;
  }
  if(!bestSel)return null;
  bestSel=improve(bestSel);
  return {sel:bestSel,value:value(bestSel),lam:lastLam};
}
function planOptimize(plan){
  const {opts,fleets,routes,budgets,params}=buildOptions(plan);
  if(!routes.length)return {status:'empty',method:'Browser heuristic',routes:[],fleets:[],total:{}};
  const t0=performance.now();
  const res=solveMCK(opts,budgets);
  if(!res)return {status:'infeasible',method:'Browser heuristic',routes:[],fleets:[],total:{},message:'No schedule fits the block-hour budgets with the minimum frequencies given. Lower some minimum frequencies or add aircraft.'};
  const outRoutes=routes.map((rt,r)=>{const o=res.sel[r];let next=null;
    if(o.k!=null&&o.freq<Math.round(num(rt.max_freq,14))){const n1=evaluate(rt,fleets[o.k],o.freq+1,params);const g=n1.contrib-o.contrib;next={gain:g,bh:n1.bh-o.bh,gain_per_bh:g/Math.max(1e-9,n1.bh-o.bh)};}
    return {route:rt.route,fleet:o.fleet,freq:o.freq,cur_freq:num(rt.cur_freq),bh:o.bh,seats_wk:o.seats_wk,pax_wk:o.pax_wk,demand_wk:o.demand_wk,spill_wk:o.spill_wk,lf:o.lf,
      revenue:o.revenue,cost:o.cost,contrib:o.contrib,contrib_per_bh:o.bh?o.contrib/o.bh:null,next};});
  const outFleets=fleets.map((fl,k)=>{const used=res.sel.reduce((s,o)=>s+(o.k===k?o.bh:0),0),cnt=Math.max(0,num(fl.count));
    const extra=budgets.slice();extra[k]+=Math.max(0,num(fl.util))*7;const r2=solveMCK(opts,extra);
    return {type:fl.type,count:cnt,budget_bh:budgets[k],used_bh:used,util_day:cnt?used/cnt/7:0,shadow_bh:used>=budgets[k]-1e-6?res.lam[k]:0,value_extra_ac:r2?Math.max(0,r2.value-res.value):null};});
  const sum=x=>res.sel.reduce((s,o)=>s+o[x],0);
  return {status:'heuristic',method:'Browser heuristic (Lagrangian + local search)',routes:outRoutes,fleets:outFleets,
    total:{revenue:sum('revenue'),cost:sum('cost'),contrib:res.value,pax_wk:sum('pax_wk'),bh:sum('bh')},current:currentSchedule(plan),budgets,bh_mode:params.bh_mode||'fleet',
    elapsed_ms:Math.round(performance.now()-t0)};
}


// ================= SCHEDULE CHANGES (see backend schedule.py) =================
const DAYS='1234567';
function parseTime(t){const s=String(t??'').trim();if(!s)return null;
  if(s.includes(':')){const [h,m]=s.split(':');const H=parseInt(h,10),M=parseInt(m,10);return isFinite(H)&&isFinite(M)?H*60+M:null;}
  const v=parseFloat(s);if(!isFinite(v))return null;return v<24?Math.round(v*60):Math.round(v);}
function parseBlock(b){const s=String(b??'').trim();if(s.includes(':')){const [h,m]=s.split(':');const H=parseInt(h,10),M=parseInt(m,10);return isFinite(H)&&isFinite(M)?H*60+M:0;}
  return Math.round(num(s)*60);}
function fmtTime(m){const d=Math.floor(m/1440),r=((m%1440)+1440)%1440;return String(Math.floor(r/60)).padStart(2,'0')+':'+String(r%60).padStart(2,'0')+(d?'+'+d:'');}
function normDays(d){const s=String(d??'');return DAYS.split('').filter(c=>s.includes(c)).join('');}
const isCancelled=f=>String(f.status||'active').toLowerCase()==='cancelled';
function schedFlights(sched){
  const out=[];(sched||[]).forEach((f,i)=>{if(isCancelled(f))return;const dep=parseTime(f.dep),blk=parseBlock(f.block),days=normDays(f.days);
    if(dep==null||blk<=0||!days)return;
    out.push({i,id:f.id??i,fn:String(f.fn||'').trim(),org:String(f.org||'').trim().toUpperCase(),dst:String(f.dst||'').trim().toUpperCase(),dep,arr:dep+blk,blk,days,fleet:String(f.fleet||'').trim()});});
  return out;}
function rotations(flights,fleet,day,turn){
  const fl=flights.filter(f=>f.fleet.toUpperCase()===fleet.toUpperCase()&&f.days.includes(day)).sort((a,b)=>a.dep-b.dep||(a.fn<b.fn?-1:a.fn>b.fn?1:0));
  const ac=[];
  fl.forEach(f=>{let best=null,bt=-1;ac.forEach(a=>{if(a.station===f.org&&a.ready<=f.dep&&a.ready>bt){best=a;bt=a.ready;}});
    if(!best){best={start:f.org,flights:[]};ac.push(best);}
    best.flights.push(f.id);best.station=f.dst;best.ready=f.arr+turn;});
  return ac.map(a=>({start:a.start,end:a.station,flights:a.flights}));}
function schedAnalyze(sched,plan,params,rmOds){
  const flights=schedFlights(sched),fleets=plan.fleets||[],warnings=[];
  const known=new Set(fleets.map(f=>String(f.type||'').toUpperCase()));
  flights.forEach(f=>{if(!known.has(f.fleet.toUpperCase()))warnings.push(`${f.fn} ${f.org}-${f.dst}: fleet '${f.fleet}' is not in the planning fleet list`);});
  const outFleets=[],rot={};
  fleets.forEach(fl=>{const t=String(fl.type||''),turn=Math.round(num(fl.turn,45)),req=[],imb={};rot[t]={};
    DAYS.split('').forEach(d=>{const r=rotations(flights,t,d,turn);rot[t][d]=r;req.push(r.length);const bal={};
      r.forEach(a=>{bal[a.start]=(bal[a.start]||0)+1;bal[a.end]=(bal[a.end]||0)-1;});
      Object.entries(bal).forEach(([st,v])=>{if(v){(imb[d]=imb[d]||{})[st]=v;}});});
    const mine=flights.filter(f=>f.fleet.toUpperCase()===t.toUpperCase());
    const bh=mine.reduce((s,f)=>s+f.blk*f.days.length,0)/60,n=num(fl.count),budget=n*num(fl.util)*7;
    const short=req.map((q,i)=>q>n?i+1:0).filter(Boolean);
    if(short.length)warnings.push(`${t}: needs more aircraft than available (${n}) on day(s) ${short.join(', ')}`);
    if(bh>budget+1e-6)warnings.push(`${t}: ${bh.toFixed(0)} block hours per week exceeds the budget of ${budget.toFixed(0)}`);
    if(Object.keys(imb).length)warnings.push(`${t}: aircraft end the day at a different station than they start on day(s) ${Object.keys(imb).sort().join(', ')} (positioning or overnight imbalance)`);
    outFleets.push({type:t,count:n,turn,required_by_day:req,required_max:req.length?Math.max(...req):0,flights_wk:mine.reduce((s,f)=>s+f.days.length,0),bh_wk:bh,budget_bh:budget,imbalance:imb});});
  const hubs=String(params.hubs||'').split(/[,;]/).map(h=>h.trim().toUpperCase()).filter(Boolean);
  const mct=Math.round(num(params.mct,60)),maxc=Math.round(num(params.maxc,360)),conns={};
  hubs.forEach(h=>{const arr=flights.filter(f=>f.dst===h),dep=flights.filter(f=>f.org===h);
    DAYS.split('').forEach(d=>{arr.forEach(a=>{if(!a.days.includes(d))return;dep.forEach(b=>{if(!b.days.includes(d)||b.dst===a.org)return;const ct=b.dep-a.arr;
      if(ct>=mct&&ct<=maxc){const key=`${a.org}-${b.dst} via ${h}`;const c=conns[key]=conns[key]||{od:`${a.org}-${b.dst}`,hub:h,days:new Set(),pairs:0,best:null};
        c.days.add(d);c.pairs++;if(c.best==null||ct<c.best)c.best=ct;}});});});});
  const connOut={};Object.entries(conns).forEach(([k,v])=>connOut[k]={od:v.od,hub:v.hub,days:v.days.size,pairs:v.pairs,best_ct:v.best});
  const atRisk=[];(rmOds||[]).forEach(o=>{const legs=String(o.path||'').split('>').map(x=>x.trim().toUpperCase()).filter(Boolean);if(legs.length<2)return;
    const hub=legs[0].split('-')[1],key=`${legs[0].split('-')[0]}-${legs[legs.length-1].split('-')[1]} via ${hub}`;
    if(!((connOut[key]||{}).days>0)&&!atRisk.includes(key))atRisk.push(key);});
  const pr={};(plan.routes||[]).forEach(r=>pr[String(r.route||'').toUpperCase()]=r);
  const seen={};
  flights.forEach(f=>{const a=`${f.org}-${f.dst}`,b=`${f.dst}-${f.org}`,key=pr[a]?a:(pr[b]?b:a);
    const s=seen[key]=seen[key]||{route:key,out:0,back:0,by_fleet:{}};const n=f.days.length;if(key===a)s.out+=n;else s.back+=n;s.by_fleet[f.fleet]=(s.by_fleet[f.fleet]||0)+n;});
  const flBy={};fleets.forEach(x=>flBy[String(x.type||'').toUpperCase()]=x);
  let total=0;const routes=[];
  Object.entries(seen).forEach(([key,s])=>{const rt=pr[key],rtrips=(s.out+s.back)/2;
    const main=Object.entries(s.by_fleet).sort((a,b)=>b[1]-a[1])[0]?.[0]||'';let contrib=null;
    if(rt&&flBy[main.toUpperCase()]&&rtrips>0){contrib=evaluate(rt,flBy[main.toUpperCase()],rtrips,plan.params||{}).contrib;total+=contrib;}
    else if(!rt)warnings.push(`${key}: no route economics in the planning table, contribution not estimated`);
    if(s.out!==s.back)warnings.push(`${key}: ${s.out} outbound vs ${s.back} return flights per week`);
    routes.push({route:key,out:s.out,back:s.back,round_trips:rtrips,fleet:main,contrib});});
  routes.sort((a,b)=>a.route<b.route?-1:1);
  const ft={};flights.forEach(f=>ft[String(f.id)]={arr:fmtTime(f.arr),dep_min:f.dep,arr_min:f.arr});
  return {fleets:outFleets,rotations:rot,connections:connOut,rm_at_risk:atRisk,routes,contrib_total:total,flights_wk:flights.reduce((s,f)=>s+f.days.length,0),
    bh_wk:flights.reduce((s,f)=>s+f.blk*f.days.length,0)/60,warnings,flight_times:ft};
}
function schedCompare(base,prop){
  const key=f=>String(f.id!=null&&f.id!==''?f.id:f.fn);const b={},p={};base.forEach(f=>b[key(f)]=f);prop.forEach(f=>p[key(f)]=f);const out=[];
  Object.entries(p).forEach(([k,f])=>{const o=b[k],label=`${f.fn||''} ${String(f.org||'').toUpperCase()}-${String(f.dst||'').toUpperCase()}`;
    if(!o){if(!isCancelled(f))out.push({id:k,type:'New flight',flight:label,before:'',after:`${f.dep} days ${normDays(f.days)} ${f.fleet}`});return;}
    if(isCancelled(f)&&!isCancelled(o)){out.push({id:k,type:'Cancelled',flight:label,before:`${o.dep} days ${normDays(o.days)}`,after:'cancelled'});return;}
    if(parseTime(f.dep)!==parseTime(o.dep)||parseBlock(f.block)!==parseBlock(o.block))out.push({id:k,type:'Retimed',flight:label,before:`dep ${o.dep} block ${o.block}`,after:`dep ${f.dep} block ${f.block}`});
    if(normDays(f.days)!==normDays(o.days))out.push({id:k,type:'Days changed',flight:label,before:normDays(o.days),after:normDays(f.days)});
    if(String(f.fleet||'').toUpperCase()!==String(o.fleet||'').toUpperCase())out.push({id:k,type:'Equipment change',flight:label,before:o.fleet,after:f.fleet});
    if(String(f.org||'').toUpperCase()!==String(o.org||'').toUpperCase()||String(f.dst||'').toUpperCase()!==String(o.dst||'').toUpperCase())
      out.push({id:k,type:'Routing change',flight:label,before:`${o.org}-${o.dst}`,after:`${f.org}-${f.dst}`});});
  Object.entries(b).forEach(([k,o])=>{if(!(k in p)&&!isCancelled(o))out.push({id:k,type:'Removed',flight:`${o.fn||''} ${o.org}-${o.dst}`,before:`${o.dep} days ${normDays(o.days)}`,after:'removed'});});
  return out;}
function schedAnalyzeChange(sched,plan,rmOds){const params=sched.params||{};
  return {base:schedAnalyze(sched.base||[],plan,params,rmOds),prop:schedAnalyze(sched.prop||[],plan,params,rmOds),changes:schedCompare(sched.base||[],sched.prop||[])};}


// ================= OPERATIONS: tail assignment, crew pairing, roster (see backend ops.py) =================
const RANKS=['CPT','FO','CC'];
const hm=m=>String(Math.floor(m/60)%24).padStart(2,'0')+':'+String(m%60).padStart(2,'0');
function opsTails(ops){return (ops.tails||[]).map(t=>({reg:String(t.reg||'').trim(),fleet:String(t.fleet||'').trim(),base:String(t.base||'').trim().toUpperCase(),
  maint:DAYS.split('').filter(c=>String(t.maint||'').includes(c)).join(''),hrs_to_check:num(t.hrs_to_check,0)})).filter(t=>t.reg);}
function tailAssignment(sched,plan,ops){
  const flights=schedFlights(sched),fbyid={};flights.forEach(f=>fbyid[String(f.id)]=f);
  const fleets=plan.fleets||[],tails=opsTails(ops),ov=ops.overrides||{},linesOut=[],warnings=[],stats={};
  tails.forEach(t=>stats[t.reg]={reg:t.reg,fleet:t.fleet,base:t.base,bh:0,flights:0,days_flown:0,nights_away:0,ferries:0,by_day:{}});
  fleets.forEach(fl=>{const ftype=String(fl.type||''),turn=Math.round(num(fl.turn,45));
    const my=tails.filter(t=>t.fleet.toUpperCase()===ftype.toUpperCase()),loc={};my.forEach(t=>loc[t.reg]=t.base);
    DAYS.split('').forEach(d=>{
      const lines=rotations(flights,ftype,d,turn).map(r=>{const fs=r.flights.map(i=>fbyid[String(i)]);
        return {key:String(r.flights[0]),day:d,fleet:ftype,start:r.start,end:r.end,dep:fs[0].dep,arr:fs[fs.length-1].arr,flights:r.flights.map(String),sectors:fs.length,bh:fs.reduce((s,f)=>s+f.blk,0)/60};});
      lines.sort((a,b)=>a.dep-b.dep||(a.key<b.key?-1:a.key>b.key?1:0));
      const used=new Set(),avail=my.filter(t=>!t.maint.includes(d));
      lines.forEach(ln=>{const reg=(ov[d]||{})[ln.key];const t=avail.find(x=>x.reg===reg&&!used.has(reg));if(t){ln.reg=reg;ln.override=true;used.add(reg);}});
      const pick=c=>c.sort((a,b)=>stats[a.reg].bh-stats[b.reg].bh||(a.reg<b.reg?-1:1))[0];
      lines.forEach(ln=>{if(ln.reg)return;const c=pick(avail.filter(t=>!used.has(t.reg)&&loc[t.reg]===ln.start));if(c){ln.reg=c.reg;used.add(c.reg);}});
      lines.forEach(ln=>{if(ln.reg)return;const c=pick(avail.filter(t=>!used.has(t.reg)));if(c){ln.reg=c.reg;used.add(c.reg);}});
      lines.forEach(ln=>{const reg=ln.reg;
        if(!reg){ln.status='unassigned';warnings.push(`Day ${d}: no ${ftype} aircraft available for the rotation starting ${ln.start} ${hm(ln.dep)} (${ln.flights.length} flights)`);return;}
        const ferry=loc[reg]!==ln.start;ln.status=ferry?'ferry':'ok';ln.from_station=loc[reg];
        if(ferry){warnings.push(`Day ${d}: ${reg} is at ${loc[reg]} but its rotation starts at ${ln.start} (ferry or swap needed)`);stats[reg].ferries++;}
        const s=stats[reg];s.bh+=ln.bh;s.flights+=ln.sectors;s.days_flown++;s.by_day[d]=ln.key;loc[reg]=ln.end;
        const h=(my.find(t=>t.reg===reg)||{}).hrs_to_check||0;
        if(h>0&&s.bh>=h&&!s.check_due){s.check_due=d;warnings.push(`${reg}: reaches its next maintenance check (${h.toFixed(0)} block hours remaining) on day ${d}; plan the check or swap the aircraft`);}});
      my.forEach(t=>{if(t.maint.includes(d))stats[t.reg].by_day[d]='MX';if(loc[t.reg]!==t.base)stats[t.reg].nights_away++;});
      linesOut.push(...lines);});
    if(!my.length)warnings.push(`${ftype}: no aircraft in the fleet register`);});
  Object.values(stats).forEach(s=>s.bh_day=s.bh/7);
  return {lines:linesOut,tails:Object.values(stats),warnings,summary:{lines:linesOut.length,assigned:linesOut.filter(l=>l.reg).length,
    ferries:linesOut.filter(l=>l.status==='ferry').length,unassigned:linesOut.filter(l=>l.status==='unassigned').length}};
}
function maxFdp(rules,sectors){return Math.max(num(rules.fdp_min,9),num(rules.fdp_base,13)-num(rules.fdp_step,0.5)*Math.max(0,sectors-2))*60;}
function pairings(tailRes,sched,ops){
  const rules=ops.rules||{},rep=num(rules.report,60),post=num(rules.post,30);
  const bases=new Set(String(ops.crew_bases||'').split(/[,;]/).map(b=>b.trim().toUpperCase()).filter(Boolean));
  const fbyid={};schedFlights(sched).forEach(f=>fbyid[String(f.id)]=f);const comp=ops.complement||{},duties=[];
  tailRes.lines.forEach(ln=>{const fs=ln.flights.map(i=>fbyid[i]).filter(Boolean);let i=0;
    while(i<fs.length){const start=i;let last=null,j=i;
      while(j<fs.length){const fdp=fs[j].arr+post-(fs[start].dep-rep);if(fdp>maxFdp(rules,j-start+1))break;if(fs[j].dst===fs[start].org)last=j;j++;}
      const end=j===fs.length?j-1:(last!=null?last:Math.max(start,j-1));
      const seg=fs.slice(start,end+1),report=seg[0].dep-rep,release=seg[seg.length-1].arr+post,fdpM=release-report,c=comp[ln.fleet]||{};
      duties.push({id:`D${ln.day}-${seg[0].fn}`,day:ln.day,fleet:ln.fleet,reg:ln.reg||null,base:seg[0].org,end_station:seg[seg.length-1].dst,report,release,
        fdp:fdpM/60,max_fdp:maxFdp(rules,seg.length)/60,sectors:seg.length,block:seg.reduce((s,f)=>s+f.blk,0)/60,flights:seg.map(f=>f.fn),
        route:[seg[0].org,...seg.map(f=>f.dst)].join('-'),legal:fdpM<=maxFdp(rules,seg.length)+1e-6,start_at_base:bases.has(seg[0].org),
        end_at_base:seg[seg.length-1].dst===seg[0].org,need:{CPT:Math.round(num(c.CPT,1)),FO:Math.round(num(c.FO,1)),CC:Math.round(num(c.CC,4))}});
      i=end+1;}});
  duties.sort((a,b)=>a.day.localeCompare(b.day)||a.report-b.report||(a.id<b.id?-1:a.id>b.id?1:0));
  return duties;
}
function crewMembers(ops){const out=[];(ops.pool||[]).forEach(r=>{const base=String(r.base||'').trim().toUpperCase(),fleet=String(r.fleet||'').trim(),rank=String(r.rank||'').trim().toUpperCase(),n=Math.round(num(r.count,0));
  const tag=fleet.toUpperCase()==='ALL'?'ALL':fleet;for(let k=1;k<=n;k++)out.push({id:`${base}-${tag}-${rank}${String(k).padStart(2,'0')}`,base,fleet,rank});});return out;}
function roster(duties,ops){
  const rules=ops.rules||{},restMin=num(rules.rest,12)*60,maxDuty=num(rules.max_duty_7d,60),maxBlock=num(rules.max_block_7d,40),maxConsec=Math.round(num(rules.max_consec,5)),minOff=Math.round(num(rules.min_off,2));
  const crew=crewMembers(ops),leave={};
  (ops.leave||[]).forEach(l=>{const id=String(l.crew||'').trim();leave[id]=leave[id]||new Set();String(l.days||'').split('').forEach(c=>{if(DAYS.includes(c))leave[id].add(c);});});
  const st={};crew.forEach(c=>st[c.id]={...c,duty_h:0,block_h:0,days:{},last_release:null,last_len:0});
  const sts=Object.values(st),shortages=[];
  duties.forEach(du=>{du.crew={CPT:[],FO:[],CC:[]};const d=parseInt(du.day,10),absRep=(d-1)*1440+du.report;
    RANKS.forEach(r=>{for(let n=0;n<du.need[r];n++){let best=null,bk=null;
      for(const c of sts){if(c.rank!==r||c.base!==du.base)continue;if(!['ALL',du.fleet.toUpperCase()].includes(c.fleet.toUpperCase()))continue;
        if((leave[c.id]&&leave[c.id].has(du.day))||c.days[du.day])continue;
        if(c.last_release!=null&&absRep-c.last_release<Math.max(restMin,c.last_len))continue;
        if(c.duty_h+du.fdp>maxDuty+1e-9||c.block_h+du.block>maxBlock+1e-9)continue;
        if(Object.keys(c.days).length+1>7-minOff)continue;
        let run=0,k=d-1;while(k>=1&&c.days[String(k)]){run++;k--;}if(run+1>maxConsec)continue;
        if(!best||c.duty_h<bk[0]-1e-12||(Math.abs(c.duty_h-bk[0])<=1e-12&&c.id<bk[1])){best=c;bk=[c.duty_h,c.id];}}
      if(!best){shortages.push({duty:du.id,day:du.day,base:du.base,fleet:du.fleet,rank:r});continue;}
      best.days[du.day]=du.id;best.duty_h+=du.fdp;best.block_h+=du.block;best.last_release=(d-1)*1440+du.release;best.last_len=du.release-du.report;du.crew[r].push(best.id);}});});
  const grid=sts.map(c=>{const cells={};DAYS.split('').forEach(d=>cells[d]=c.days[d]||(leave[c.id]&&leave[c.id].has(d)?'LV':'OFF'));
    return {id:c.id,base:c.base,fleet:c.fleet,rank:c.rank,duty_h:c.duty_h,block_h:c.block_h,days_on:Object.keys(c.days).length,cells};});
  const allQ=new Set(crew.filter(c=>c.fleet.toUpperCase()==='ALL').map(c=>c.base+'|'+c.rank)),req={};
  duties.forEach(du=>RANKS.forEach(r=>{if(du.need[r]<=0)return;const fk=allQ.has(du.base+'|'+r)?'ALL':du.fleet,k=`${du.base}|${fk}|${r}`;
    const q=req[k]=req[k]||{base:du.base,fleet:fk,rank:r,duty_days:0,duty_h:0,block_h:0,peak:{}};
    q.duty_days+=du.need[r];q.duty_h+=du.fdp*du.need[r];q.block_h+=du.block*du.need[r];q.peak[du.day]=(q.peak[du.day]||0)+du.need[r];}));
  const reservePct=num(rules.reserve_pct,0)/100;
  const reqOut=Object.values(req).map(q=>{const needed=Math.max(Math.ceil(q.duty_days/Math.max(1,7-minOff)),Math.ceil(q.duty_h/Math.max(1e-9,maxDuty)),Math.ceil(q.block_h/Math.max(1e-9,maxBlock)),Math.max(...Object.values(q.peak)));
    const avail=crew.filter(c=>c.base===q.base&&c.rank===q.rank&&['ALL',q.fleet.toUpperCase()].includes(c.fleet.toUpperCase())).length;
    const reserve=Math.ceil(needed*reservePct);
    return {base:q.base,fleet:q.fleet,rank:q.rank,duty_days:q.duty_days,duty_h:q.duty_h,needed,reserve,needed_total:needed+reserve,available:avail,gap:avail-needed-reserve};})
    .sort((a,b)=>a.base.localeCompare(b.base)||a.fleet.localeCompare(b.fleet)||RANKS.indexOf(a.rank)-RANKS.indexOf(b.rank));
  const total=duties.reduce((s,du)=>s+du.need.CPT+du.need.FO+du.need.CC,0);
  return {grid,shortages,requirements:reqOut,summary:{positions:total,filled:total-shortages.length,crew:crew.length,avg_duty_h:sts.reduce((s,c)=>s+c.duty_h,0)/Math.max(1,crew.length)}};
}
function opsRun(sched,plan,ops){
  const tails=tailAssignment(sched,plan,ops),duties=pairings(tails,sched,ops),ro=roster(duties,ops),warnings=[...tails.warnings];
  duties.forEach(du=>{if(!du.legal)warnings.push(`${du.id} ${du.route}: flight duty ${du.fdp.toFixed(1)} h exceeds the limit of ${du.max_fdp.toFixed(1)} h and cannot be split at a crew base`);
    else if(!du.end_at_base)warnings.push(`${du.id} ${du.route}: duty ends away from the crew's home base ${du.base} (night-stop, positioning or a different crew pattern needed)`);
    if(!du.start_at_base)warnings.push(`${du.id} ${du.route}: duty starts at ${du.base}, which is not a crew base`);});
  return {tails,duties,roster:ro,warnings};
}


// ================= PRICING (see backend pricing.py) =================
const plist=s=>String(s??'').split(/[,;]/).map(x=>x.trim().toUpperCase()).filter(Boolean);
const globRe=p=>new RegExp('^'+p.replace(/[.+^${}()|[\]\\]/g,'\\$&').replace(/\*/g,'.*').replace(/\?/g,'.')+'$');
function matchMarket(pattern,market){const pats=plist(pattern);if(!pats.length)return true;const m=market.toUpperCase();
  return pats.some(p=>['ALL','*','*-*'].includes(p)||globRe(p).test(m));}
function matchRbd(pattern,rbd){const pats=plist(pattern);return !pats.length||pats.includes('ALL')||pats.includes(rbd.toUpperCase());}
function activeOn(a,date){if(!['yes','true','1'].includes(String(a.active??'yes').toLowerCase()))return false;
  const f=String(a.from||'').trim(),t=String(a.to||'').trim();if(date&&f&&date<f)return false;if(date&&t&&date>t)return false;return true;}
function taxApplies(t,org,dst,country){const scope=String(t.scope||'departure').toLowerCase(),where=plist(t.where),co=country[org]||'',cd=country[dst]||'';
  const hit=(st,c)=>!where.length||where.includes(st)||(c&&where.includes(c));
  if(scope==='departure')return hit(org,co);if(scope==='arrival')return hit(dst,cd);
  if(scope==='domestic')return !!co&&co===cd&&(!where.length||where.includes(co));
  if(scope==='international')return co!==cd&&hit(org,co);return false;}
function priceFares(pr){
  const date=String(pr.date||''),country={};(pr.stations||[]).forEach(s=>country[String(s.code||'').trim().toUpperCase()]=String(s.country||'').trim().toUpperCase());
  const taxes=(pr.taxes||[]).filter(t=>String(t.code||'').trim()),adjs=pr.adjustments||[],rows=[],warnings=[];
  const fams=pr.families||[],paxT=pr.pax||{},chd=num(paxT.chd_pct,25)/100,inf=num(paxT.inf_pct,90)/100;
  (pr.fares||[]).forEach((f,i)=>{const market=String(f.market||'').trim().toUpperCase(),rbd=String(f.rbd||'').trim().toUpperCase();
    if(!market.includes('-')){warnings.push(`Row ${i+1}: market '${market}' should look like ORG-DST`);return;}
    const k=market.indexOf('-'),org=market.slice(0,k),dst=market.slice(k+1);
    [org,dst].forEach(st=>{if(!(st in country))warnings.push(`${market}: station ${st} has no country in the station table (country-based taxes skipped)`);});
    const base=Math.max(0,num(f.base));let sur=0,promo=0;const applied=[];
    adjs.forEach(a=>{if(!activeOn(a,date)||!matchMarket(a.markets,market)||!matchRbd(a.rbds,rbd))return;const v=num(a.value);
      const amt=String(a.method||'percent').toLowerCase()==='percent'?base*v/100:v;
      if(String(a.type||'surcharge').toLowerCase()==='promotion'){promo+=amt;applied.push({name:a.name,amount:-amt});}else{sur+=amt;applied.push({name:a.name,amount:amt});}});
    const net=Math.max(0,base+sur-promo);
    const taxesFor=(n,infant)=>{const o={};taxes.forEach(t=>{if(!taxApplies(t,org,dst,country))return;if(infant&&!['yes','true','1'].includes(String(t.inf||'no').toLowerCase()))return;
      const v=num(t.amount),amt=String(t.basis||'fixed').toLowerCase()==='percent'?n*v/100:v,c=String(t.code).trim().toUpperCase();o[c]=(o[c]||0)+amt;});return o;};
    const sum=o=>Object.values(o).reduce((a,b)=>a+b,0);
    const tx=taxesFor(net,false),tot=sum(tx),fb=String(f.basis||'').trim()||`${rbd}OW`;
    const chdNet=net*(1-chd),infNet=net*(1-inf);
    const fam=fams.find(x=>String(x.rbds||'').trim()&&matchRbd(x.rbds,rbd))||null;
    rows.push({i,market,org,dst,rbd,basis:fb,base,surcharge:sur,promotion:promo,net,taxes:tx,tax_total:tot,total:net+tot,applied,
      chd_total:chdNet+sum(taxesFor(chdNet,false)),inf_total:infNet+sum(taxesFor(infNet,true)),
      family:fam?fam.family:'',includes:fam?fam.includes:'',refund:fam?fam.refund:'',change_fee:fam?num(fam.change_fee,0):null,
      ap_days:Math.round(num(f.ap,num(fam?fam.ap_days:0,0)))});});
  const codes=[];taxes.forEach(t=>{const c=String(t.code).trim().toUpperCase();if(!codes.includes(c))codes.push(c);});
  const byM={};rows.forEach(r=>(byM[r.market]=byM[r.market]||[]).push(r));
  Object.entries(byM).forEach(([m,rs])=>{for(let j=1;j<rs.length;j++)if(rs[j].net>rs[j-1].net+1e-9)warnings.push(`${m}: ${rs[j].rbd} net fare ${rs[j].net.toFixed(0)} is higher than ${rs[j-1].rbd} ${rs[j-1].net.toFixed(0)} (ladder inversion)`);});
  const n=rows.length;
  return {rows,tax_codes:codes,warnings,summary:{fares:n,markets:Object.keys(byM).length,with_promo:rows.filter(r=>r.promotion>0).length,with_surcharge:rows.filter(r=>r.surcharge>0).length,
    avg_tax_share:n?rows.filter(r=>r.total>0).reduce((s,r)=>s+r.tax_total/r.total,0)/n:0}};
}


// ================= COMMERCIAL (see backend commercial.py) =================
const revM=r=>{const k=r.indexOf('-');return r.slice(k+1)+'-'+r.slice(0,k);};
function ancPerPax(com,market){let rev=0,cost=0;(com.ancillaries||[]).forEach(a=>{if(matchMarket(a.markets,market)||matchMarket(a.markets,revM(market))){const r=num(a.price)*num(a.take)/100;rev+=r;cost+=r*num(a.cost_pct)/100;}});return [rev,cost];}
function distPerPax(com,fare){return (com.channels||[]).reduce((t,c)=>t+num(c.share)/100*(num(c.cost_seg)+fare*(num(c.commission)+num(c.incentive))/100),0);}
function routePnl(plan,com,basis){
  const fleets=plan.fleets||[],params=plan.params||{},costs=com.costs||{},fuelShare=num(costs.fuel_share,35)/100,fuelIdx=num(costs.fuel_index,100)/100,over=num(costs.overhead_pct,8)/100,lease=costs.lease||{};
  const bmap={};(basis||[]).forEach(b=>bmap[String(b.route||'').toUpperCase()]=b);const rows=[];
  (plan.routes||[]).forEach(rt=>{const key=String(rt.route||'').toUpperCase(),b=bmap[key];let f,ft;
    if(b){f=Math.round(num(b.freq));ft=String(b.fleet||'');}else{f=Math.round(num(rt.cur_freq));ft=String(rt.cur_fleet||'');}
    const al=allowed(rt,fleets);let k=fleets.findIndex(x=>String(x.type||'').toUpperCase()===ft.toUpperCase());if(k<0)k=al.length?al[0]:null;
    if(k==null||f<=0)return;const o=evaluate(rt,fleets[k],f,params),dist=num(rt.dist,0),fare=num(rt.fare),[ar,ac]=ancPerPax(com,key);
    rows.push({route:key,fleet:fleets[k].type,freq:f,pax:o.pax_wk,seats:o.seats_wk,lf:o.lf,bh:o.bh,dist,ask:o.seats_wk*dist,rpk:o.pax_wk*dist,pax_rev:o.revenue,
      anc_rev:o.pax_wk*ar,anc_cost:o.pax_wk*ac,dist_cost:o.pax_wk*distPerPax(com,fare),var_cost:o.cost,fuel_adj:o.cost*fuelShare*(fuelIdx-1)});});
  fleets.forEach(fl=>{const t=String(fl.type||''),wk=num(lease[t])*12/52*num(fl.count),mine=rows.filter(r=>String(r.fleet).toUpperCase()===t.toUpperCase()),bh=mine.reduce((s,r)=>s+r.bh,0);
    mine.forEach(r=>r.ownership=bh?wk*r.bh/bh:0);});
  rows.forEach(r=>{if(r.ownership==null)r.ownership=0;r.revenue=r.pax_rev+r.anc_rev;r.overhead=over*r.revenue;r.cost=r.anc_cost+r.dist_cost+r.var_cost+r.fuel_adj+r.ownership+r.overhead;
    r.profit=r.revenue-r.cost;r.margin=r.revenue?r.profit/r.revenue:0;r.rask=r.ask?r.revenue/r.ask:null;r.cask=r.ask?r.cost/r.ask:null;r.yield=r.rpk?r.pax_rev/r.rpk:null;});
  const keys=['pax','seats','bh','ask','rpk','pax_rev','anc_rev','anc_cost','dist_cost','var_cost','fuel_adj','ownership','overhead','revenue','cost','profit'],tot={};
  keys.forEach(k=>tot[k]=rows.reduce((s,r)=>s+r[k],0));
  tot.lf=tot.seats?tot.pax/tot.seats:0;tot.margin=tot.revenue?tot.profit/tot.revenue:0;tot.rask=tot.ask?tot.revenue/tot.ask:null;tot.cask=tot.ask?tot.cost/tot.ask:null;tot.yield=tot.rpk?tot.pax_rev/tot.rpk:null;
  rows.sort((a,b)=>b.profit-a.profit);return {rows,total:tot};
}
function marketIntel(com,plan,priceRows,basis){
  const a=num(com.share_alpha,1.3),b=num(com.share_beta,1),own=String(com.own_carrier||'ZZ').toUpperCase(),bmap={};(basis||[]).forEach(x=>bmap[String(x.route||'').toUpperCase()]=x);
  const ownF={};(plan.routes||[]).forEach(rt=>{const k=String(rt.route||'').toUpperCase();const f=num((bmap[k]||{}).freq,num(rt.cur_freq));ownF[k]=f;ownF[revM(k)]=f;});
  const ownFare={};(priceRows||[]).forEach(r=>{const m=String(r.market||'').toUpperCase(),t=num(r.total);if(t>0&&(!(m in ownFare)||t<ownFare[m]))ownFare[m]=t;});
  const mk={};(com.competitors||[]).forEach(c=>{const m=String(c.market||'').trim().toUpperCase();if(m)(mk[m]=mk[m]||[]).push(c);});
  const out=Object.entries(mk).map(([m,comps])=>{const players=[{carrier:own,own:true,freq:ownF[m]||0,fare:ownFare[m]||ownFare[revM(m)]||null}];
    comps.forEach(c=>players.push({carrier:String(c.carrier||'').toUpperCase(),own:false,freq:num(c.freq),fare:num(c.fare)||null,date:c.date}));
    const fares=players.map(p=>p.fare).filter(Boolean),cheapest=fares.length?Math.min(...fares):null,totF=players.reduce((s,p)=>s+p.freq,0);
    const w=players.map(p=>{const rel=p.fare&&cheapest?p.fare/cheapest:1;return p.freq>0?Math.pow(p.freq,a)*Math.pow(rel,-b):0;}),sw=w.reduce((x,y)=>x+y,0);
    players.forEach((p,i)=>{p.freq_share=totF?p.freq/totF:0;p.est_share=sw?w[i]/sw:0;});
    const cf=players.slice(1).map(p=>p.fare).filter(Boolean),idx=players[0].fare&&cf.length?players[0].fare/Math.min(...cf)*100:null;
    return {market:m,players,price_index:idx,position:idx==null?null:(idx<=100?'cheapest':idx<=105?'within 5%':'premium'),own_freq_share:players[0].freq_share,own_est_share:players[0].est_share};});
  out.sort((x,y)=>x.market<y.market?-1:1);return {markets:out};
}
function prorateCalc(com){
  const own=String(com.own_carrier||'ZZ').toUpperCase(),rows=[],by={},warnings=[];
  (com.interline||[]).forEach(it=>{const fare=num(it.fare),segs=[];
    String(it.segments||'').split(';').forEach(part=>{const bits=part.split(':').map(x=>x.trim()).filter(Boolean);if(bits.length<3)return;
      let spa=null;if(bits.length>=4&&bits[3].toUpperCase().startsWith('SPA='))spa=num(bits[3].slice(4));segs.push({carrier:bits[0].toUpperCase(),sector:bits[1].toUpperCase(),miles:num(bits[2]),spa});});
    if(!segs.length)return;const fixed=segs.filter(s=>s.spa!=null).reduce((t,s)=>t+s.spa,0),rest=fare-fixed;
    if(rest<0)warnings.push(`${it.id}: special prorate amounts (${fixed.toFixed(0)}) exceed the through fare (${fare.toFixed(0)})`);
    const miles=segs.filter(s=>s.spa==null).reduce((t,s)=>t+s.miles,0);
    segs.forEach(s=>{s.share=s.spa!=null?s.spa:(miles?Math.max(0,rest)*s.miles/miles:0);s.method=s.spa!=null?'SPA':'mileage';by[s.carrier]=(by[s.carrier]||0)+s.share;});
    rows.push({id:it.id,fare,pax:num(it.pax,1),segments:segs,own_share:segs.filter(s=>s.carrier===own).reduce((t,s)=>t+s.share,0)});});
  return {rows,carriers:Object.keys(by).sort().map(c=>({carrier:c,share:by[c],own:c===own})),warnings};
}
function corporatesCalc(com,plan){const fares={};(plan.routes||[]).forEach(rt=>{const k=String(rt.route||'').toUpperCase();fares[k]=fares[revM(k)]=num(rt.fare);});
  return (com.corporates||[]).map(c=>{const months=Math.max(1e-9,num(c.months,12)),target=num(c.committed)*months/12,actual=num(c.actual),mk=Object.keys(fares).filter(m=>matchMarket(c.markets,m));
    const avgF=mk.length?mk.reduce((s,m)=>s+fares[m],0)/mk.length:0;
    return {name:c.name,markets:c.markets,discount:num(c.discount),target_to_date:target,actual,compliance:target?actual/target:null,discount_cost:actual*avgF*num(c.discount)/100};});}
function commercialRun(com,plan,priceRows,basis){return {pnl:routePnl(plan,com,basis),market:marketIntel(com,plan,priceRows,basis),prorate:prorateCalc(com),corporates:corporatesCalc(com,plan)};}


// ---------------- SSIM record type 3 (see backend schedule.py) ----------------
const MON=['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
const offM=s=>{s=String(s||'').trim();return /^[+-]\d{4}$/.test(s)?(s[0]==='+'?1:-1)*(parseInt(s.slice(1,3),10)*60+parseInt(s.slice(3,5),10)):0;};
const ofS=m=>(m>=0?'+':'-')+String(Math.floor(Math.abs(m)/60)).padStart(2,'0')+String(Math.abs(m)%60).padStart(2,'0');
const mod=(a,n)=>((a%n)+n)%n;
// move days of operation by k days (e.g. +1: a Monday departure becomes Tuesday)
const shiftDays=(days,k)=>{if(!k)return days;const s=new Set(String(days).split('').filter(c=>DAYS.includes(c)).map(c=>String(mod(+c-1+k,7)+1)));return DAYS.split('').filter(c=>s.has(c)).join('');};
const dvChar=k=>k<0?'A':String(Math.min(9,k));
function ssimImport(text,plan,refOffset){
  const ref=offM(refOffset||'+0300'),byIata={};(plan.fleets||[]).forEach(f=>{if(f.iata)byIata[String(f.iata).trim().toUpperCase()]=f.type;});
  const flights=[],warnings=[],seen=new Set();
  String(text||'').split(/\r?\n/).forEach((raw,n0)=>{const n=n0+1,line=raw.padEnd(200);if(line[0]!=='3')return;
    let days;const al=line.slice(2,5).trim(),nr=line.slice(5,9).trim().replace(/^0+/,'')||'0';days=line.slice(28,35).split('').filter(c=>DAYS.includes(c)).join('');
    const org=line.slice(36,39).trim(),std=line.slice(39,43),dvar=line.slice(47,52),dst=line.slice(54,57).trim(),sta=line.slice(57,61),avar=line.slice(65,70),ac=line.slice(72,75).trim().toUpperCase();
    if(!(/^\d{4}$/.test(std)&&/^\d{4}$/.test(sta)&&org&&dst&&days)){warnings.push(`Line ${n}: could not read the flight leg record`);return;}
    // bytes 193/194: departure / arrival date variation (0,1,2 = days later, A = day before)
    const dv=c=>c==='A'?-1:(/^[0-9]$/.test(c)?+c:0),depDv=dv(line[192]),arrDv=dv(line[193]);
    const depU=parseInt(std.slice(0,2),10)*60+parseInt(std.slice(2),10)-offM(dvar),arrU=parseInt(sta.slice(0,2),10)*60+parseInt(sta.slice(2),10)-offM(avar)+(arrDv-depDv)*1440;
    const blk=line[193]===' '||line[193]==null?mod(arrU-depU,1440):arrU-depU;
    // days are local departure days; move them to the schedule reference date
    const shift=Math.floor((depU+ref)/1440)+depDv;days=shiftDays(days,shift);
    const depR=mod(depU+ref,1440),fn=al+nr,leg=line.slice(11,13).trim()||'01';let fid=`${fn}-${org}-${leg}`,k=2;while(seen.has(fid)){fid=`${fn}-${org}-${leg}-${k}`;k++;}seen.add(fid);
    const fleet=byIata[ac]||ac;if(ac&&!byIata[ac])warnings.push(`Line ${n} ${fn}: aircraft type ${ac} has no planning fleet with that IATA code`);
    flights.push({id:fid,fn,org,dst,dep:String(Math.floor(depR/60)).padStart(2,'0')+':'+String(depR%60).padStart(2,'0'),block:`${Math.floor(blk/60)}:${String(blk%60).padStart(2,'0')}`,days,fleet,status:'active'});});
  return {flights,warnings};
}
function ssimExport(sched,plan,airline,refOffset,pFrom,pTo,stationOffsets){
  airline=airline||'ZZ';const ref=offM(refOffset||'+0300'),so={};Object.entries(stationOffsets||{}).forEach(([k,v])=>so[k.toUpperCase()]=offM(v));
  const iata={};(plan.fleets||[]).forEach(f=>iata[String(f.type||'').toUpperCase()]=String(f.iata||'').toUpperCase());
  const dd=s=>{const m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s||''));return m?String(parseInt(m[3],10)).padStart(2,'0')+MON[parseInt(m[2],10)-1]+m[1].slice(2):'00XXX00';};
  const pf=dd(pFrom),pt=dd(pTo),out=['1AIRLINE STANDARD SCHEDULE DATA SET'.padEnd(194)+'000001',('2U'+airline.padEnd(3).slice(0,3)+'    '+pf+pt).padEnd(194)+'000002'];let serial=3;
  const hm=m=>String(Math.floor(m/60)).padStart(2,'0')+String(m%60).padStart(2,'0');
  (sched||[]).forEach(f=>{if(isCancelled(f))return;const dep=parseTime(f.dep),blk=parseBlock(f.block);let days=normDays(f.days);if(dep==null||blk<=0||!days)return;
    const org=String(f.org||'').toUpperCase(),dst=String(f.dst||'').toUpperCase(),oo=org in so?so[org]:ref,od=dst in so?so[dst]:ref,depU=dep-ref,std=mod(depU+oo,1440),sta=mod(depU+blk+od,1440);
    // days of operation are local departure days; arrival date variation is relative to the local departure date
    const depDay=Math.floor((depU+oo)/1440),arrDv=Math.floor((depU+blk+od)/1440)-depDay;days=shiftDays(days,depDay);
    const fn=String(f.fn||''),al=(fn.replace(/\d/g,'').slice(0,3))||airline,nr=fn.replace(/\D/g,'').slice(-4),dstr=DAYS.split('').map(d=>days.includes(d)?d:' ').join('');
    const rec='3'+' '+al.padEnd(3)+nr.padStart(4)+'01'+'01'+'J'+pf+pt+dstr+' '+org.padEnd(3)+hm(std)+hm(std)+ofS(oo)+'  '+dst.padEnd(3)+hm(sta)+hm(sta)+ofS(od)+'  '+(iata[String(f.fleet||'').toUpperCase()]||'').padEnd(3).slice(0,3);
    out.push(rec.padEnd(192)+'0'+dvChar(arrDv)+String(serial).padStart(6,'0'));serial++;});
  out.push(('5 '+airline.padEnd(3).slice(0,3)).padEnd(187)+String(serial-1).padStart(6,'0')+'E'+String(serial).padStart(6,'0'));
  return out.join('\n')+'\n';
}


// ================= INVENTORY CONTROL (see backend inventory.py) =================
const isoDow=ds=>{const d=new Date(ds+'T00:00:00Z');return String(((d.getUTCDay()+6)%7)+1);};
const addDays=(ds,k)=>{const d=new Date(ds+'T00:00:00Z');d.setUTCDate(d.getUTCDate()+k);return d.toISOString().slice(0,10);};
const invSet=s=>String(s??'').split(/[,;]/).map(x=>x.trim().toUpperCase()).filter(Boolean);
const invLimits=s=>{const o={};invSet(s).forEach(p=>{if(p.includes(':')){const [k,v]=p.split(':');const n=parseFloat(v);if(isFinite(n))o[k.trim()]=Math.max(0,Math.trunc(n));}});return o;};
function ruleMatches(rule,f,date,dow,today){
  if(!['yes','true','1'].includes(String(rule.active??'yes').toLowerCase()))return false;
  const exp=String(rule.expires||'').trim();if(exp&&today&&today>exp)return false;
  if(!matchMarket(rule.sectors||'ALL',`${f.org}-${f.dst}`))return false;
  const fl=invSet(rule.flights);if(fl.length&&!fl.includes(f.fn.toUpperCase()))return false;
  const a=String(rule.from||'').trim(),b=String(rule.to||'').trim();if(a&&date<a)return false;if(b&&date>b)return false;
  const days=String(rule.dow||'').split('').filter(c=>'1234567'.includes(c)).join('');if(days&&!days.includes(dow))return false;
  const t0=parseTime(rule.time_from),t1=parseTime(rule.time_to);if(t0!=null&&f.dep%1440<t0)return false;if(t1!=null&&f.dep%1440>t1)return false;
  return true;}
function invSystem(R){const out={};R.legs.forEach(l=>{const local=R.prods.filter(p=>p.path===l.code).sort((a,b)=>b.fare-a.fare);
  out[l.code]={bp:l.net,bp_dlp:l.dlp,C:l.C,classes:local.map(p=>({rbd:String(p.rbd).toUpperCase(),fare:p.fare,val:p.val??p.fare,open:!!p.open,seats:Math.round(p.seats)}))};});return out;}
function invEvaluate(sysd,rule,rbds){
  const mode=rule?String(rule.mode||'manual').toLowerCase():'system',close=rule?invSet(rule.close):[],opn=rule?invSet(rule.open):[],lim=rule?invLimits(rule.limits):{};const classes=[];
  if(sysd){const bp=sysd.bp;let bpEff=bp;if(mode==='adjust'&&bp!=null&&isFinite(bp))bpEff=bp*(1+num(rule.bp_pct,0)/100)+num(rule.bp_fixed,0);
    const cap=Math.max(0,Math.trunc(sysd.C));
    sysd.classes.forEach(c=>{const sysOpen=c.open,sysSeats=c.seats;let eff=mode==='adjust'?(cap>0&&c.val>=bpEff-1e-6):sysOpen;
      let src=mode==='system'?'system':(mode==='manual'?'held':'adjusted');
      if(close.includes(c.rbd)){eff=false;src='analyst';}else if(opn.includes(c.rbd)){eff=cap>0;src='analyst';}
      let seats=eff?(sysOpen?sysSeats:cap):0;
      if(eff&&(c.rbd in lim)){seats=Math.min(seats?seats:cap,lim[c.rbd]);src='analyst';eff=seats>0;}
      classes.push({...c,sys_open:sysOpen,sys_seats:sysSeats,open:eff,seats,source:src,differs:(eff!==sysOpen)||(seats!==(sysOpen?sysSeats:0))});});
    return {mode,bp,bp_eff:bpEff,remaining:cap,classes,has_system:true};}
  rbds.forEach(r=>{const st=close.includes(r)?false:(opn.includes(r)?true:null);const seats=st?(lim[r]??null):(st===false?0:null);
    classes.push({rbd:r,fare:null,val:null,sys_open:null,sys_seats:null,open:st,seats,source:st!=null?'analyst':'none',differs:st!=null});});
  return {mode,bp:null,bp_eff:null,remaining:null,classes,has_system:false};}
const invAvs=ev=>ev.classes.map(c=>c.open==null?`${c.rbd}-`:`${c.rbd}${c.open?Math.min(9,c.seats||0):0}`).join(' ');
function inventoryRun(rmState,sched,inv){
  const R=rmCompute(rmState),sysmap=invSystem(R),rbds=[];(rmState.prods||[]).forEach(p=>{const r=String(p.rbd||'').toUpperCase();if(r&&!rbds.includes(r))rbds.push(r);});
  const RB=rbds.length?rbds:['Y','M','K','V','E'];
  const start=String(inv.start||new Date().toISOString().slice(0,10)),days=Math.max(1,Math.min(120,Math.trunc(num(inv.days,14)))),today=String(inv.today||start),rules=inv.rules||[];
  const flights=schedFlights(sched).sort((a,b)=>a.dep-b.dep||(a.fn<b.fn?-1:a.fn>b.fn?1:0)),rows=[];
  for(let k=0;k<days;k++){const ds=addDays(start,k),dow=isoDow(ds);
    flights.forEach(f=>{if(!f.days.includes(dow))return;const idx=rules.findIndex(r=>ruleMatches(r,f,ds,dow,today));const rule=idx>=0?rules[idx]:null;
      const ev=invEvaluate(sysmap[`${f.org}-${f.dst}`],rule,RB);
      rows.push({date:ds,dow,id:String(f.id),fn:f.fn,sector:`${f.org}-${f.dst}`,dep:fmtTime(f.dep),fleet:f.fleet,mode:ev.mode,rule:idx>=0?idx:null,rule_name:rule?rule.name:null,
        bp:ev.bp,bp_eff:ev.bp_eff,remaining:ev.remaining,has_system:ev.has_system,classes:ev.classes,avs:invAvs(ev),differs:ev.classes.filter(c=>c.differs).length});});}
  const used={};rows.forEach(r=>{if(r.rule!=null)used[r.rule]=(used[r.rule]||0)+1;});
  return {rows,rbds:RB,rules:rules.map((r,i)=>({index:i,name:r.name,flight_dates:used[i]||0,expired:!!(String(r.expires||'').trim()&&today>String(r.expires))})),
    summary:{flight_dates:rows.length,manual:rows.filter(r=>r.mode==='manual').length,adjust:rows.filter(r=>r.mode==='adjust').length,system:rows.filter(r=>r.mode==='system').length,
      no_model:rows.filter(r=>!r.has_system).length,differs:rows.filter(r=>r.differs).length}};
}

global.NetEngine={matchMarket,shiftDays,inventoryRun,ssimImport,ssimExport,commercialRun,ancPerPax,priceFares,opsRun,schedAnalyzeChange,schedAnalyze,parseTime,parseBlock,fmtTime,normDays,rmCompute,rmSimulate,rmSimulateState,planOptimize,currentSchedule,evaluate,emsr,networkLP,curveAt,DTD_PTS};
})(typeof window!=='undefined'?window:globalThis);
