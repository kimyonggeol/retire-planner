/* ═══════════════════════════════════════════════════════════════
   노후 준비 계산기 — 계산 엔진
   · 화면 코드와 분리된 순수 계산부. 모든 입력 금액은 '올해 가치, 만원'.
   · 내부 계산은 원 단위 명목가치, 표시용으로 현재가치를 함께 산출.
   ═══════════════════════════════════════════════════════════════ */
"use strict";
(function(root){

const Y0 = new Date().getFullYear();
const M0 = new Date().getMonth() + 1;
const W  = v => (+v || 0) * 1e4;                  // 만원 → 원
const num = v => (+v || 0);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/* ───────────── 기본 입력값 ───────────── */
function newSrc(type){
  const amt = {salary:4500, biz:4000, free:4000, daily:15, etc:1200}[type||"salary"];
  return {type:type||"salary", amt, raise:3, bonIn:0, bonEx:0, startY:"", endY:"",
    promoN:0, promoY:Y0+3, promoCycle:5, promoUp:500,
    freeExp:30, days:20, months:11, etcKind:"biz"};
}
function newPerson(by, job){
  return {
    birthY:by, retireAge:60, job:job||"corp",
    src:[newSrc(srcTypeOf(job||"corp"))],
    pen:{mode:"auto", manual:120, pastM:0, pastInc:300, startAge:"", pubStartY:Y0-5},
    sev:{type:sevTypeOf(job||"corp"), hireY:Y0-5, open:0, dcRate:4, dcPct:8.33, recv:"lump", years:10},
    pps:{save:0, open:0, age:60, years:20},
    side:{amt:0, endAge:70}
  };
}
function srcTypeOf(job){ return {corp:"salary",public:"salary",military:"salary",biz:"biz",free:"free",daily:"daily"}[job]||"salary"; }
function sevTypeOf(job){ return job==="corp"?"db":(job==="public"||job==="military")?"pub":"none"; }
function newLoan(kind){
  const P = LOAN_PRESET[kind||"mortgage"];
  return {kind:kind||"mortgage", P:20000, term:P.term, grace:0, r1:P.r1, pay:P.pay,
          rate:P.rate, fixY:P.fix, r2:P.r2, g:2, mixPct:30, roll:"repay"};
}
const LOAN_PRESET = {
  mortgage:{pay:"equal_pi",rate:"hybrid",term:30,fix:5,r1:4.2,r2:4.6},
  policy_mortgage:{pay:"equal_pi",rate:"fixed",term:30,fix:30,r1:3.3,r2:3.3},
  jeonse:{pay:"bullet",rate:"variable",term:2,fix:0,r1:4.0,r2:4.0},
  policy_jeonse:{pay:"bullet",rate:"variable",term:10,fix:0,r1:2.5,r2:2.5},
  credit:{pay:"bullet",rate:"variable",term:5,fix:0,r1:5.5,r2:5.5},
  negative:{pay:"bullet",rate:"variable",term:5,fix:0,r1:6.0,r2:6.0},
  deposit:{pay:"bullet",rate:"fixed",term:3,fix:3,r1:4.0,r2:4.0},
  other:{pay:"equal_pi",rate:"fixed",term:5,fix:5,r1:5.0,r2:5.0}
};
function defaults(){
  return {
    v:1, mode:"simple",
    A:newPerson(1990,"corp"),
    hasSpouse:false, B:Object.assign(newPerson(1992,"none")),
    hasKids:false, kids:[], kidLevel:"mid",
    kidCost:{e0:20,e1:40,e2:60,e3:80,e4:700,a1:5,a2:15,a3:30,a4:50,inf:3,support:0},
    endAge:95, eco:{infl:2, ret:3, wg:3.4},
    fin:5000, house:{has:false, value:50000, g:2}, loans:[],
    exp:{month:300, g:2.5, fHousing:35,fIns:40,fComm:20,fCar:30,fEtc:0,fixG:2,
         vFood:90,vFun:40,vMed:15,varG:3,misc:500,miscG:2},
    post:{exp:250, dropAge:80, dropPct:80, med:300, hiAuto:true},
    hp:{use:false, age:65, mode:"auto", manual:100},
    tax:{dedOther:300, crOther:50}
  };
}

/* ───────────── 세금 ───────────── */
const BRACKETS=[[14e6,.06,0],[50e6,.15,1.26e6],[88e6,.24,5.76e6],[150e6,.35,15.44e6],
  [300e6,.38,19.94e6],[500e6,.40,25.94e6],[1000e6,.42,35.94e6],[Infinity,.45,65.94e6]];
function progressive(b){ if(b<=0) return 0; for(const [c,r,d] of BRACKETS) if(b<=c) return Math.max(0,b*r-d); return 0; }
function earnedDed(g){
  let d; if(g<=5e6)d=g*.7; else if(g<=15e6)d=3.5e6+(g-5e6)*.4;
  else if(g<=45e6)d=7.5e6+(g-15e6)*.15; else if(g<=1e8)d=12e6+(g-45e6)*.05; else d=14.75e6+(g-1e8)*.02;
  return Math.min(d,20e6);
}
function wageCredit(calc,g){
  let c=calc<=1.3e6?calc*.55:715000+(calc-1.3e6)*.30, cap;
  if(g<=33e6)cap=740000; else if(g<=70e6)cap=Math.max(660000,740000-(g-33e6)*.008);
  else if(g<=1.2e8)cap=Math.max(500000,660000-(g-70e6)*.5); else cap=Math.max(200000,500000-(g-1.2e8)*.5);
  return Math.min(c,cap);
}
function childCredit(n){ return n<=0?0:n===1?250000:n===2?550000:550000+400000*(n-2); }
function ppsCredit(amt,income){ return Math.min(amt,9e6)*(income<=55e6?0.165:0.132); }
function pensionIncomeDed(x){
  if(x<=350e4)return x; if(x<=700e4)return 350e4+(x-350e4)*.4;
  if(x<=1400e4)return 490e4+(x-700e4)*.2; return Math.min(900e4,630e4+(x-1400e4)*.1);
}
function publicPensionTax(x){          // 공적연금 소득세 근사 (연금소득공제 → 본인공제 → 표준세액공제)
  if(x<=0) return 0;
  const base=Math.max(0,x-pensionIncomeDed(x)-150e4);
  return Math.max(0,progressive(base)-7e4)*1.1;
}
function retireTax(gross,yrs){          // 퇴직소득세
  if(gross<=0) return 0;
  const ys=Math.max(1,Math.round(yrs));
  let sd; if(ys<=5)sd=1e6*ys; else if(ys<=10)sd=5e6+2e6*(ys-5);
  else if(ys<=20)sd=15e6+2.5e6*(ys-10); else sd=40e6+3e6*(ys-20);
  const cv=Math.max(0,gross-sd)/ys*12;
  let cd; if(cv<=8e6)cd=cv; else if(cv<=70e6)cd=8e6+(cv-8e6)*.6;
  else if(cv<=1e8)cd=45.2e6+(cv-70e6)*.55; else if(cv<=3e8)cd=61.7e6+(cv-1e8)*.45; else cd=151.7e6+(cv-3e8)*.35;
  return progressive(Math.max(0,cv-cd))/12*ys*1.1;
}
function ppsTaxRate(age){ return age>=80?0.033:age>=70?0.044:0.055; }

/* ───────────── 사회보험 · 연금 상수 ───────────── */
const HI_R=0.0719, LTC_OF_HI=0.1314, EI_R=0.009;
const NPS_A_2026=3193511, NPS_CAP_2026=659e4, NPS_FLOOR_2026=41e4;
const PUB_AVG_2026=571e4;              // 공무원 전체 평균 기준소득월액(근사)
const npsRate = Y => Y<2026?0.09:Math.min(13,9.5+0.5*(Y-2026))/100;
const npsConst = y => y<=1998?2.4:y<=2007?1.8:y<=2025?(1.5-0.015*(y-2008)):1.29;
const npsNormalAge = by => by<=1952?60:by<=1956?61:by<=1960?62:by<=1964?63:by<=1968?64:65;
const pubRate = y => y<2016?1.9:y>=2035?1.7:1.878-0.178*(y-2016)/19;     // 공무원연금 지급률(%)
const pubSevRate = yrs => yrs>=20?0.39:yrs>=15?0.2925:yrs>=10?0.2275:yrs>=5?0.065:0;
/* 주택연금 1억원당 월 지급액(만원, 종신·정액형 근사) */
const HP_TABLE=[[55,14.5],[60,19.5],[65,23.7],[70,29.3],[75,36.6],[80,46.9],[85,62.0]];
function hpFactor(age){
  if(age<=HP_TABLE[0][0]) return HP_TABLE[0][1];
  for(let i=1;i<HP_TABLE.length;i++){ const [a1,v1]=HP_TABLE[i-1],[a2,v2]=HP_TABLE[i];
    if(age<=a2) return v1+(v2-v1)*(age-a1)/(a2-a1); }
  return HP_TABLE[HP_TABLE.length-1][1];
}

/* ───────────── 대출 상환 스케줄 ───────────── */
function loanCfg(L){
  const c={kind:L.kind,pay:L.pay,rateType:L.rate,P:W(L.P),term:num(L.term),grace:num(L.grace),
    r1:num(L.r1),fixY:num(L.fixY),r2:num(L.r2),g:num(L.g)/100,mixPct:num(L.mixPct)/100,roll:L.roll};
  if(L.rate==="fixed"){ c.fixY=c.term; c.r2=c.r1; }
  else if(L.rate==="variable"){ c.fixY=c.term; c.r2=c.r1; }   // 변동: 장기 평균금리를 r1로 입력
  return c;
}
function gpmFirst(P,i,years,g){
  if(P<=0||years<=0) return 0;
  const a12=i>0?(1-Math.pow(1+i,-12))/i:12, q=(1+g)/Math.pow(1+i,12);
  const S=Math.abs(q-1)<1e-10?years:(1-Math.pow(q,years))/(1-q);
  return P/(a12*S);
}
function buildLoan(c,monthsToEnd){
  const out=[]; if(c.P<=0||c.term<=0) return out;
  let N0=Math.round(c.term*12);
  if(c.pay==="bullet"&&c.roll==="extend") N0=Math.max(N0,monthsToEnd);
  const gm=Math.round(Math.min(c.grace,c.term)*12);
  let bal=c.P,k=0;
  const rateAt=kk=>((kk<c.fixY*12)?c.r1:c.r2)/100/12;
  for(;k<gm&&k<N0;k++){const i=rateAt(k),int=bal*i;out.push({pay:int,int,prin:0,bal});}
  const rem=N0-k; if(rem<=0) return out;
  if(c.pay==="bullet"){
    for(let j=0;j<rem;j++,k++){const i=rateAt(k),int=bal*i,prin=(j===rem-1)?bal:0;
      bal-=prin; out.push({pay:int+prin,int,prin,bal:Math.max(0,bal)});}
    return out;
  }
  if(c.pay==="mixed"){
    let ab=bal*c.mixPct; const bullet=bal-ab;
    for(let j=0;j<rem;j++,k++){const i=rateAt(k),int=bal*i; let prin=0;
      if(ab>0){const A=i>0?ab*i/(1-Math.pow(1+i,-(rem-j))):ab/(rem-j); prin=Math.min(ab,Math.max(0,A-ab*i)); ab-=prin;}
      if(j===rem-1) prin+=bullet; bal=Math.max(0,bal-prin); out.push({pay:int+prin,int,prin,bal});}
    return out;
  }
  if(c.pay==="equal_p"){
    const pr=bal/rem;
    for(let j=0;j<rem;j++,k++){const i=rateAt(k),int=bal*i; bal=Math.max(0,bal-pr); out.push({pay:pr+int,int,prin:pr,bal});}
    return out;
  }
  if(c.pay==="gpm"){
    let months=rem;
    const run=(rate,yearsLeft,cnt)=>{const i=rate/100/12,A=gpmFirst(bal,i,yearsLeft,c.g);
      for(let y=0;cnt>0;y++){const pay=A*Math.pow(1+c.g,y);
        for(let m=0;m<12&&cnt>0;m++,k++,cnt--){const int=bal*i,prin=Math.min(bal,pay-int);
          bal=Math.max(0,bal-prin); out.push({pay:int+prin,int,prin,bal});}}};
    const n1=Math.max(0,Math.min(Math.round(c.fixY*12)-k,months));
    if(n1>0){run(c.r1,months/12,n1); months-=n1;}
    if(months>0) run(c.r2,months/12,months);
    return out;
  }
  /* 원리금균등 (금리 변경 시 잔여기간 재산정) */
  let months=rem;
  while(months>0){
    const i=rateAt(k), fixLeft=Math.round(c.fixY*12)-k;
    const nSeg=Math.min(months,(fixLeft>0?fixLeft:months));
    const A=i>0?bal*i/(1-Math.pow(1+i,-months)):bal/months;
    for(let j=0;j<nSeg;j++,k++){const int=bal*i,prin=Math.min(bal,A-int); bal=Math.max(0,bal-prin); out.push({pay:int+prin,int,prin,bal});}
    months-=nSeg;
  }
  return out;
}

/* ═══════════════ 메인 계산 ═══════════════
   ov(선택): {retireAdd, save(월 만원), postAdd(월 만원), retAdd(%p)} — 개선안 비교용 */
function compute(st, ov){
  ov=ov||{};
  const infl=num(st.eco.infl)/100, ret=(num(st.eco.ret)+(ov.retAdd||0))/100, wg=num(st.eco.wg)/100;
  const inflF=Y=>Math.pow(1+infl,Y-Y0), wgF=Y=>Math.pow(1+wg,Y-Y0);

  const mk=(k,p)=>{
    const ra=num(p.retireAge)+(k==="A"?(ov.retireAdd||0):0);
    const by=num(p.birthY);
    return {k,p,birthY:by,retireAge:ra,retireY:by+ra,job:p.job,
      pub:(p.job==="public"||p.job==="military"),mil:p.job==="military",works:p.job!=="none"};
  };
  const people=[mk("A",st.A)];
  if(st.hasSpouse) people.push(mk("B",st.B));
  const A=people[0], B=people[1]||null;
  const lastY=A.birthY+num(st.endAge);
  const kidYs=st.hasKids?st.kids.map(k=>num(k.y)):[];

  /* ── 1단계: 연도별 근로·사업소득과 사회보험 (자산과 무관한 부분) ── */
  function srcYear(c,Y,P){
    const z={wage:0,bonIn:0,bonEx:0,mWage:0,biz:0,other:0,nontax:0,daily:0,dIns:0,dayList:[]};
    if(!P.works) return z;
    const sy=c.startY!==""&&c.startY!=null?num(c.startY):Y0;
    const ey=c.endY!==""&&c.endY!=null?num(c.endY):P.retireY-1;
    if(Y<sy||Y>ey) return z;
    const t=Y-Y0, gr=num(c.raise)/100, gf=Math.pow(1+gr,t);
    if(c.type==="salary"){
      let base=W(c.amt)*gf;
      const n=num(c.promoN);
      for(let k=0;k<n;k++){const py=num(c.promoY)+k*Math.max(1,num(c.promoCycle));
        if(py>Y0&&py<=Y) base+=W(c.promoUp)*Math.pow(1+gr,Y-py);}
      z.wage=base; z.mWage=base/12; z.bonIn=W(c.bonIn)*gf; z.bonEx=W(c.bonEx)*gf;
    } else if(c.type==="biz"){ z.biz=W(c.amt)*gf; }
    else if(c.type==="free"){ z.biz=W(c.amt)*gf*(1-clamp(num(c.freeExp),0,95)/100); }
    else if(c.type==="daily"){
      const d=W(c.amt)*gf, v=d*num(c.days)*num(c.months);
      z.daily=v; z.dayList.push({pay:d,days:num(c.days),months:num(c.months)});
      if(num(c.days)>=8) z.dIns=v;
    } else if(c.type==="etc"){
      const v=W(c.amt)*gf;
      if(c.etcKind==="other") z.other=v; else if(c.etcKind==="nontax") z.nontax=v; else z.biz=v;
    }
    return z;
  }
  function personYear(P,Y){
    const r={wage:0,bonIn:0,bonEx:0,mWage:0,biz:0,other:0,nontax:0,daily:0,dIns:0,dayList:[],side:0};
    P.p.src.forEach(c=>{const z=srcYear(c,Y,P);
      r.wage+=z.wage;r.bonIn+=z.bonIn;r.bonEx+=z.bonEx;r.mWage=Math.max(r.mWage,z.mWage);
      r.biz+=z.biz;r.other+=z.other;r.nontax+=z.nontax;r.daily+=z.daily;r.dIns+=z.dIns;
      r.dayList=r.dayList.concat(z.dayList);});
    const age=Y-P.birthY, s=P.p.side;
    if(Y>=P.retireY&&age<num(s.endAge)&&num(s.amt)>0) r.side=W(s.amt)*12*inflF(Y);
    r.wageT=r.wage+r.bonIn+r.bonEx+r.side;
    r.gross=r.wageT+r.biz+r.other+r.nontax+r.daily;
    return r;
  }
  function socOf(r,P,Y){
    const o={pen:0,hi:0,ltc:0,ei:0,soc:0,kind:"none",nb:0};
    const age=Y-P.birthY, gW=wgF(Y)*Math.pow(1+wg,Y0-2026);
    const cap=NPS_CAP_2026*gW, floor=NPS_FLOOR_2026*gW;
    const insW=r.wageT+r.dIns, bizI=Math.max(0,r.biz+r.other);
    if(insW>0){
      o.kind=(P.pub&&r.wage>0)?"pub":"work";
      const mw=insW/12;
      if(o.kind==="pub") o.pen=Math.min(mw,PUB_AVG_2026*1.6*gW)*0.09*12;
      else if(age<60){ o.nb=clamp(mw,floor,cap); o.pen=o.nb*npsRate(Y)/2*12; }
      o.hi=mw*HI_R/2*12; o.ltc=o.hi*LTC_OF_HI;
      o.ei=o.kind==="pub"?0:insW*EI_R;
      if(bizI>2000e4){const extra=(bizI-2000e4)*HI_R; o.hi+=extra; o.ltc+=extra*LTC_OF_HI;}
    } else if(bizI>0){
      o.kind="local";
      const mw=bizI/12;
      if(age<60){ o.nb=clamp(mw,floor,cap); o.pen=o.nb*npsRate(Y)*12; }
      o.hi=mw*HI_R*12; o.ltc=o.hi*LTC_OF_HI;
    }
    o.soc=o.pen+o.hi+o.ltc+o.ei;
    return o;
  }

  const pre={};                    // pre[Y] = {pr:[...], so:[...]}
  for(let Y=Y0;Y<=lastY;Y++){
    const pr=people.map(P=>personYear(P,Y));
    pre[Y]={pr,so:people.map((P,i)=>socOf(pr[i],P,Y))};
  }

  /* ── 2단계: 공적연금 ── */
  function npsCalc(P,idx){
    const pen=P.p.pen, normal=npsNormalAge(P.birthY);
    const payAge=pen.startAge!==""&&pen.startAge!=null&&num(pen.startAge)>0?clamp(num(pen.startAge),normal-5,normal+5):normal;
    const adj=payAge<normal?1-0.06*(normal-payAge):1+0.072*(payAge-normal);
    const payY=P.birthY+payAge;
    const useManual=pen.mode==="manual"&&!P.pub;
    if(useManual){
      const nom=W(pen.manual)*12*inflF(payY);
      return {kind:"nps",manual:true,eligible:nom>0,payAge,payY,normal,adj:1,annualAtPay:nom,P:0,B:0};
    }
    const segs=[];
    const pm=num(pen.pastM);
    if(pm>0){
      const yrs=Math.max(1,Math.ceil(pm/12)); let cs=0;
      for(let y=Y0-yrs;y<Y0;y++) cs+=npsConst(y);
      segs.push({m:pm,inc:W(pen.pastInc),c:cs/yrs});
    }
    if(!P.pub){
      for(let Y=Y0;Y<=lastY;Y++){
        const so=pre[Y].so[idx];
        if(Y-P.birthY>=60) break;
        if(so.nb>0) segs.push({m:12,inc:so.nb/wgF(Y),c:npsConst(Y)});
      }
    }
    const Pm=segs.reduce((a,s)=>a+s.m,0);
    const A0=NPS_A_2026*Math.pow(1+wg,Y0-2026);
    const Bv=Pm?segs.reduce((a,s)=>a+s.inc*s.m,0)/Pm:0;
    let base=0; segs.forEach(s=>base+=s.c*(A0+Bv)*s.m);
    base=(Pm?base/Pm:0)*(1+0.05*Math.max(0,Pm-240)/12);
    const eligible=Pm>=120;
    const annualAtPay=eligible?base*adj*wgF(payY):0;
    return {kind:"nps",manual:false,eligible,payAge,payY,normal,adj,P:Pm,B:Bv,A0,base,annualAtPay};
  }
  function pubCalc(P,idx){
    const pen=P.p.pen, startY=num(pen.pubStartY);
    const yrs=Math.max(0,P.retireY-startY), capY=P.mil?33:36, used=Math.min(yrs,capY);
    const minY=P.mil?20:10;
    const payAge=P.mil?P.retireAge:(num(pen.startAge)>0?num(pen.startAge):65);
    const payY=Math.max(P.retireY,P.birthY+payAge);
    if(pen.mode==="manual"){
      const nom=W(pen.manual)*12*inflF(payY);
      return {kind:P.mil?"mil":"pub",manual:true,eligible:nom>0,yrs,payAge,payY,annualAtPay:nom};
    }
    let s=0,n=0;
    for(let Y=Math.max(Y0,startY);Y<P.retireY&&Y<=lastY;Y++){
      const r=pre[Y].pr[idx]; const gW=wgF(Y)*Math.pow(1+wg,Y0-2026);
      const m=Math.min((r.wage+r.bonIn+r.bonEx)/12,PUB_AVG_2026*1.6*gW);
      if(m>0){s+=m/wgF(Y);n++;}
    }
    if(!n){ const c=P.p.src[0]; s=c?W(c.amt)/12:0; n=1; }
    const avg=s/n;
    let rs=0; for(let y=startY;y<startY+used;y++) rs+=(P.mil?1.9:pubRate(y))/100;
    const eligible=yrs>=minY;
    const retireRefY=Math.min(P.retireY,payY);
    const annualAtPay=eligible?avg*rs*12*wgF(retireRefY)*Math.pow(1+infl,payY-retireRefY):0;
    /* 퇴직수당 */
    const lastR=pre[Math.min(P.retireY-1,lastY)]?pre[Math.min(P.retireY-1,lastY)].pr[idx]:null;
    const lastM=lastR?(lastR.wage+lastR.bonIn+lastR.bonEx)/12:0;
    const sevGross=(P.retireY>Y0)?lastM*yrs*pubSevRate(yrs):0;
    return {kind:P.mil?"mil":"pub",manual:false,eligible,yrs,used,payAge,payY,avg,rateSum:rs,annualAtPay,sevGross};
  }
  const pens=people.map((P,i)=>{
    const o={nps:npsCalc(P,i),pub:P.pub?pubCalc(P,i):null};
    return o;
  });
  /* 부양가족연금: 배우자가 본인 공적연금이 없을 때 */
  let depPen=0;
  if(B&&pens[0].nps.eligible&&!pens[1].nps.eligible&&!(pens[1].pub&&pens[1].pub.eligible)) depPen=299750;

  /* ── 3단계: 퇴직급여 ── */
  const sevs=people.map((P,i)=>{
    const sv=P.p.sev, o={type:sv.type,gross:0,tax:0,net:0,yrs:0,recv:sv.recv||"lump",years:Math.max(1,num(sv.years)||10)};
    if(P.retireY<=Y0){ o.type="past"; return o; }
    if(P.pub){
      o.type="pub"; const pc=pens[i].pub; o.yrs=pc.yrs; o.gross=pc.sevGross||0;
    } else if(sv.type==="db"){
      o.yrs=Math.max(0,P.retireY-num(sv.hireY));
      const r=pre[Math.min(P.retireY-1,lastY)].pr[i];
      o.avg=(r.mWage||((r.wage)/12))+r.bonIn/12;
      o.gross=o.avg*o.yrs;
    } else if(sv.type==="dc"){
      o.yrs=Math.max(0,P.retireY-num(sv.hireY));
      let pot=W(sv.open); const rr=num(sv.dcRate)/100, pc=num(sv.dcPct)/100;
      for(let Y=Y0;Y<P.retireY&&Y<=lastY;Y++){const r=pre[Y].pr[i]; pot=pot*(1+rr)+(r.wage+r.bonIn+r.bonEx)*pc;}
      o.gross=pot;
    }
    if(o.yrs<1&&o.gross>0) o.yrs=1;
    o.tax=retireTax(o.gross,o.yrs);
    o.net=o.gross-o.tax;
    if(o.recv==="annuity"&&o.gross>0){ o.annTax=o.tax*0.7; o.netAnn=o.gross-o.annTax; }
    return o;
  });

  /* ── 4단계: 연도별 통합 현금흐름 ── */
  const loans=st.loans.map(loanCfg);
  const monthsToEnd=(lastY-Y0)*12+(13-M0);
  const LS=loans.map(c=>buildLoan(c,monthsToEnd));
  const loanYear=Y=>{let pay=0,int=0,prin=0,bal=0;
    for(let m=1;m<=12;m++){const k=Y*12+(m-1)-(Y0*12+M0-1);
      LS.forEach((S,i)=>{ if(k>=0&&k<S.length){pay+=S[k].pay;int+=S[k].int;prin+=S[k].prin;} });}
    const kEnd=Y*12+11-(Y0*12+M0-1);
    LS.forEach(S=>{ if(kEnd>=0&&kEnd<S.length) bal+=S[kEnd].bal; });
    return {pay,int,prin,bal};};

  const simple=st.mode==="simple";
  const lvl=simple?({low:0.6,mid:1,high:1.6}[st.kidLevel]||1):1;
  const kc=st.kidCost, eduInf=num(kc.inf)/100;
  const E={e0:W(kc.e0)*lvl,e1:W(kc.e1)*lvl,e2:W(kc.e2)*lvl,e3:W(kc.e3)*lvl,e4:W(kc.e4)*(simple?Math.sqrt(lvl):1),
           a1:W(kc.a1)*lvl,a2:W(kc.a2)*lvl,a3:W(kc.a3)*lvl,a4:W(kc.a4)*lvl,sup:W(kc.support)};
  const ex=st.exp, post=st.post;

  const ppsPot=people.map(P=>W(P.p.pps.open));
  const ppsPmt=people.map(()=>null);
  const sevPot=people.map(()=>0), sevPmt=people.map(()=>null), sevLeft=people.map(()=>0);
  let fin=W(st.fin);
  const houseOn=st.house.has, hpUse=houseOn&&st.hp.use;
  let hpMonthly=0,hpStartY=null;
  if(hpUse){
    const younger=B?Math.max(A.birthY,B.birthY):A.birthY;
    const age=Math.max(55,num(st.hp.age));
    hpStartY=younger+age;
    if(st.hp.mode==="manual") hpMonthly=W(st.hp.manual)*inflF(hpStartY);
    else{
      const hv=Math.min(W(st.house.value)*Math.pow(1+num(st.house.g)/100,hpStartY-Y0),17e8*inflF(hpStartY));
      hpMonthly=hv/1e8*hpFactor(age)*1e4;
    }
  }

  const rows=[]; let depleteAge=null;
  for(let Y=Y0;Y<=lastY;Y++){
    const t=Y-Y0, ageA=Y-A.birthY, ageB=B?Y-B.birthY:null;
    const {pr,so}=pre[Y];
    const row={Y,ageA,ageB,events:[]};

    /* 근로·사업 세금 */
    let kidsDep=0,kidsCr=0;
    kidYs.forEach(ky=>{const a=Y-ky; if(a>=0&&a<=20)kidsDep++; if(a>=8&&a<=20)kidsCr++;});
    let spouseDep=0;
    if(B){ const rb=pr[1]; const wg2=rb.wageT, bz=Math.max(0,rb.biz+rb.other);
      spouseDep=(wg2>0?(wg2<=5e6&&bz<=1e6):(bz<=1e6))?1:0; }
    const taxOf=(r,o,deps,main,P)=>{
      let t2=0;
      r.dayList.forEach(d=>{t2+=Math.max(0,d.pay-150000)*0.06*0.45*d.days*d.months*1.1;});
      const wageInc=r.wageT>0?r.wageT-earnedDed(r.wageT):0;
      let base=wageInc+r.biz+r.other*0.4;
      if(base<=0) return t2;
      base-=1.5e6*(1+deps); base-=o.soc; if(main) base-=W(st.tax.dedOther);
      base=Math.max(0,base);
      const calc=progressive(base);
      let cr=0; if(r.wageT>0) cr+=wageCredit(calc,r.wageT); else cr+=7e4;
      if(main) cr+=childCredit(kidsCr)+W(st.tax.crOther);
      if(Y<P.retireY) cr+=ppsCredit(W(P.p.pps.save),r.gross);
      return t2+Math.max(0,calc-cr)*1.1;
    };
    let gross=0,soc=0,tax=0;
    people.forEach((P,i)=>{
      const tx=taxOf(pr[i],so[i],i===0?spouseDep+kidsDep:0,i===0,P);
      gross+=pr[i].gross; soc+=so[i].soc; tax+=tx;
    });
    row.gross=gross; row.soc=soc; row.tax=tax; row.netWork=gross-soc-tax;
    row.side=pr.reduce((a,r)=>a+r.side,0);

    /* 공적연금 */
    let pubPen=0,penTax=0; row.penBy=[];
    people.forEach((P,i)=>{
      let v=0;
      const n=pens[i].nps;
      if(n.eligible&&Y>=n.payY) v+=n.annualAtPay*Math.pow(1+infl,Y-n.payY)+(i===0?depPen*inflF(Y):0);
      const pb=pens[i].pub;
      if(pb&&pb.eligible&&Y>=pb.payY) v+=pb.annualAtPay*Math.pow(1+infl,Y-pb.payY);
      row.penBy.push(v); pubPen+=v; penTax+=publicPensionTax(v);
      if(n.eligible&&Y===n.payY) row.events.push((i?"배우자 ":"")+"국민연금 개시");
      if(pb&&pb.eligible&&Y===pb.payY) row.events.push((i?"배우자 ":"")+(pb.kind==="mil"?"군인연금":"직역연금")+" 개시");
    });
    row.pubPen=pubPen;

    /* 퇴직급여 · 개인연금 */
    let lump=0,priv=0,privTax=0,ppsSave=0;
    people.forEach((P,i)=>{
      const age=Y-P.birthY;
      if(Y===P.retireY&&Y>Y0-1){
        row.events.push((i?"배우자 ":"")+"은퇴");
        const sv=sevs[i];
        if(sv.gross>0){
          if(sv.recv==="annuity"&&!P.pub){ sevPot[i]=sv.gross; sevLeft[i]=sv.years; }
          else lump+=sv.net;
        }
      }
      /* 퇴직연금 연금수령 */
      if(sevPot[i]>0||sevPmt[i]!==null){
        if(sevPmt[i]===null&&age>=55&&sevLeft[i]>0){
          const n2=sevLeft[i]; sevPmt[i]=ret>0?sevPot[i]*ret/(1-Math.pow(1+ret,-n2)):sevPot[i]/n2;
        }
        if(sevPmt[i]!==null&&sevLeft[i]>0){
          sevPot[i]=sevPot[i]*(1+ret)-sevPmt[i]; sevLeft[i]--;
          const tx=sevs[i].annTax/sevs[i].years;
          priv+=sevPmt[i]; privTax+=tx;
          if(sevLeft[i]===0){ sevPot[i]=0; }
        } else sevPot[i]*=(1+ret);
      }
      /* 개인연금 */
      const pp=P.p.pps, payStart=Math.max(P.retireY,P.birthY+num(pp.age)), nY=Math.max(1,num(pp.years));
      if(Y<payStart){
        ppsPot[i]=ppsPot[i]*(1+ret);
        if(Y<P.retireY){ ppsPot[i]+=W(pp.save); ppsSave+=W(pp.save); }
      } else if(Y<payStart+nY){
        if(ppsPmt[i]===null){ const n2=nY; ppsPmt[i]=ppsPot[i]<=0?0:(ret>0?ppsPot[i]*ret/(1-Math.pow(1+ret,-n2)):ppsPot[i]/n2);
          if(ppsPmt[i]>0) row.events.push((i?"배우자 ":"")+"연금저축 수령"); }
        ppsPot[i]=ppsPot[i]*(1+ret)-ppsPmt[i];
        priv+=ppsPmt[i]; privTax+=ppsPmt[i]*ppsTaxRate(age);
      } else ppsPot[i]=0;
    });
    row.lump=lump; row.priv=priv; row.ppsSave=ppsSave;

    /* 주택연금 */
    row.hp=(hpUse&&Y>=hpStartY)?hpMonthly*12:0;
    if(hpUse&&Y===hpStartY) row.events.push("주택연금 개시");
    row.house=houseOn?W(st.house.value)*Math.pow(1+num(st.house.g)/100,t):0;

    /* 은퇴 후 지역 건강보험 (근사) */
    row.hiLocal=0;
    if(post.hiAuto&&Y>=A.retireY&&so.every(o=>o.kind==="none")){
      const gW=wgF(Y)*Math.pow(1+wg,Y0-2026);
      const incPart=pubPen*0.5/12*HI_R;
      const propPart=houseOn?Math.max(0,row.house*0.4-1e8)/1e8*3.5e4*gW:0;
      const m=Math.max(2e4*gW,incPart+propPart);
      row.hiLocal=m*(1+LTC_OF_HI)*12;
    }
    row.penTax=penTax+privTax;

    /* 지출 */
    const phasePre=Y<A.retireY;
    let living=0;
    if(phasePre){
      if(simple) living=W(ex.month)*12*Math.pow(1+num(ex.g)/100,t);
      else{
        living=(W(ex.fHousing)+W(ex.fIns)+W(ex.fComm)+W(ex.fCar)+W(ex.fEtc))*12*Math.pow(1+num(ex.fixG)/100,t)
              +(W(ex.vFood)+W(ex.vFun)+W(ex.vMed))*12*Math.pow(1+num(ex.varG)/100,t)
              +W(ex.misc)*Math.pow(1+num(ex.miscG)/100,t);
      }
      living=Math.max(0,living-W(ov.save||0)*12*inflF(Y));
    } else {
      const base=Math.max(0,num(post.exp)+(ov.postAdd||0));
      living=W(base)*12*inflF(Y)*(ageA>=num(post.dropAge)?num(post.dropPct)/100:1);
      if(ageA>=75) living+=W(post.med)*inflF(Y);
    }
    let kid=0;
    kidYs.forEach((ky,ki)=>{const a=Y-ky, gE=Math.pow(1+eduInf,t);
      if(a>=4&&a<7)kid+=E.e0*12*gE;
      else if(a>=7&&a<13)kid+=(E.e1+E.a1)*12*gE;
      else if(a>=13&&a<16)kid+=(E.e2+E.a2)*12*gE;
      else if(a>=16&&a<19)kid+=(E.e3+E.a3)*12*gE;
      else if(a>=19&&a<23)kid+=E.e4*gE+E.a4*12*gE;
      if(a===28)kid+=E.sup*gE;
      if(a===19) row.events.push("자녀"+(ki+1)+" 대학");
    });
    const ln=loanYear(Y);
    row.living=living; row.kid=kid; row.loan=ln.pay; row.loanInt=ln.int; row.loanBal=ln.bal;
    if(ln.pay>0&&ln.bal===0&&loanYear(Y-1).bal>0) row.events.push("대출 완납");
    row.spend=living+kid+ln.pay+ppsSave+row.hiLocal;
    row.income=row.netWork+pubPen+priv+row.hp-row.penTax;
    row.net=row.income-row.spend;
    row.finStart=fin;
    fin=fin*(1+ret)+row.net+lump;
    row.fin=fin; row.finReal=fin/inflF(Y);
    row.phase=phasePre?"pre":"post";
    row.ppsPot=ppsPot.reduce((a,b)=>a+Math.max(0,b),0)+sevPot.reduce((a,b)=>a+Math.max(0,b),0);
    if(fin<0&&depleteAge===null) depleteAge=ageA;
    rows.push(row);
  }

  /* ── 5단계: 평가 지표 ── */
  const rY=Math.max(A.retireY,Y0);
  const rIdx=rows.findIndex(r=>r.Y===rY);
  const rRow=rows[rIdx]||rows[0];
  /* 은퇴 시점 준비자산 (명목) */
  const sevLumpTot=sevs.reduce((a,s,i)=>a+(people[i].retireY>=Y0&&s.recv!=="annuity"?s.net:0),0)
                  +sevs.reduce((a,s,i)=>a+(people[i].retireY>=Y0&&s.recv==="annuity"&&!people[i].pub?s.netAnn||0:0),0);
  const ppsAtR=(()=>{ // 은퇴 직전 연금저축 적립액
    const r=rows[Math.max(0,rIdx-1)]; return r?r.ppsPot:0; })();
  const finAtR=rRow.finStart;
  const haveAtR=finAtR+sevLumpTot+ppsAtR;
  /* 필요자금 = 은퇴 후 (지출 − 근로·공적연금·주택연금) 부족분의 은퇴시점 현재가치 */
  let need=0;
  rows.forEach(r=>{ if(r.Y<rY) return;
    const gap=Math.max(0,r.spend-(r.netWork+r.pubPen+r.hp-(r.penTax)));
    need+=gap/Math.pow(1+ret,r.Y-rY); });
  const ratio=need>0?Math.max(0,haveAtR/need):9.99;

  /* 공적연금 개시 연도 (가구 첫 공적연금) */
  const firstPen=rows.find(r=>r.pubPen>0);
  const gapYears=firstPen?Math.max(0,firstPen.Y-rY):(lastY-rY);
  let gapCover=0;
  if(gapYears>0){ let inc=0,sp=0;
    rows.forEach(r=>{ if(r.Y>=rY&&r.Y<rY+gapYears){ inc+=r.netWork+r.priv+r.hp; sp+=r.spend; } });
    gapCover=sp>0?inc/sp:1; }
  /* 소득대체율: 은퇴 전 마지막 해 세후소득 대비, 연금이 모두 나오는 첫 해의 연금소득(현재가치) */
  const lastPre=rows.filter(r=>r.Y<A.retireY&&r.netWork>0).slice(-1)[0];
  const allPenY=Math.max(rY,...pens.map(p=>p.nps.eligible?p.nps.payY:0),...pens.map(p=>p.pub&&p.pub.eligible?p.pub.payY:0));
  const penRow=rows.find(r=>r.Y===allPenY)||rRow;
  const penIncReal=(penRow.pubPen+penRow.priv+penRow.hp)/inflF(penRow.Y);
  const repl=lastPre?penIncReal/(lastPre.netWork/inflF(lastPre.Y)):null;
  /* 저축률 */
  const preRows=rows.filter(r=>r.phase==="pre");
  const sNet=preRows.reduce((a,r)=>a+r.income,0), sSave=preRows.reduce((a,r)=>a+r.net+r.ppsSave,0);
  const saveRate=sNet>0?sSave/sNet:null;
  const deficitYears=preRows.filter(r=>r.net<0).length;
  /* 3층 */
  const layer1=pens[0].nps.eligible||(pens[0].pub&&pens[0].pub.eligible);
  const layer2=sevs[0].gross>0||(A.retireY<=Y0);
  const layer3=W(st.A.pps.open)+W(st.A.pps.save)>0;
  const layers=[layer1,layer2,layer3].filter(Boolean).length;
  const debtAtR=rows[Math.max(0,rIdx-1)]?rows[Math.max(0,rIdx-1)].loanBal:0;

  const lights=[];
  const L=(id,t,lv,val,desc,tip)=>lights.push({id,t,lv,val,desc,tip});
  /* 1 자산 지속 */
  if(depleteAge===null) L("last","자산 지속","g","만 "+num(st.endAge)+"세까지 유지","은퇴 후에도 금융자산이 계산 종료 나이까지 남습니다.","");
  else L("last","자산 지속",depleteAge>=85?"y":"r","만 "+depleteAge+"세 소진",
    "현재 계획대로면 만 "+depleteAge+"세에 금융자산이 바닥납니다.",
    "은퇴 나이 연장, 은퇴 후 생활비 조정, 연금저축 추가 납입 효과를 '개선' 탭에서 비교해 보세요.");
  /* 2 준비율 */
  L("ratio","은퇴 자금 준비율",ratio>=1?"g":ratio>=0.7?"y":"r",ratio>=9.9?"충분":Math.round(ratio*100)+"%",
    "은퇴 시점 준비자산이 은퇴 후 연금으로 메우지 못하는 생활비를 얼마나 채우는지입니다.",
    ratio>=1?"":"부족분을 메우려면 은퇴 전 저축을 늘리거나, 은퇴 후 지출을 줄이거나, 일하는 기간을 늘려야 합니다.");
  /* 3 소득대체율 */
  if(repl===null) L("repl","연금 소득대체율","n","—","은퇴 직전 소득이 없어 계산하지 않았습니다.","");
  else L("repl","연금 소득대체율",repl>=0.6?"g":repl>=0.4?"y":"r",Math.round(repl*100)+"%",
    "연금(공적·퇴직·개인·주택)이 모두 나오는 해의 연금소득이 은퇴 직전 세후소득의 몇 %인지입니다. 60% 이상이면 생활수준을 유지하기 수월합니다.",
    repl>=0.6?"":"국민연금 외에 연금저축·IRP, 퇴직연금 연금수령, 주택연금으로 연금 비중을 높일 수 있습니다.");
  /* 4 소득 공백 */
  if(gapYears<=0) L("gap","소득 공백","g","없음","은퇴와 동시에 공적연금이 나옵니다.","");
  else L("gap","소득 공백",(gapCover>=0.5||gapYears<=2)?"y":"r",gapYears+"년",
    "은퇴 후 공적연금이 나오기 전까지 "+gapYears+"년간 공백이 있습니다. 이 기간 다른 소득으로 지출의 "+Math.round(gapCover*100)+"%를 충당합니다.",
    "연금저축·퇴직연금 수령 시점을 공백기에 맞추거나 은퇴 후 근로소득을 계획하면 자산 소모가 줄어듭니다.");
  /* 5 3층 연금 */
  L("layer","3층 연금 구조",layers>=3?"g":layers===2?"y":"r",layers+" / 3층",
    "공적연금 "+(layer1?"○":"✕")+" · 퇴직급여 "+(layer2?"○":"✕")+" · 개인연금 "+(layer3?"○":"✕"),
    layers>=3?"":(!layer3?"연금저축·IRP는 연 900만원까지 세액공제(13.2~16.5%)를 받으며 노후 재원을 만듭니다. ":"")+
    (!layer2&&(A.job==="biz"||A.job==="free")?"퇴직급여가 없는 사업자·프리랜서는 노란우산공제·IRP로 대신 준비하세요. ":"")+
    (!layer1?"국민연금 가입기간 10년 미만이면 연금을 받을 수 없습니다. 임의가입·추후납부를 검토하세요.":""));
  /* 6 저축률 */
  if(saveRate===null) L("save","은퇴 전 저축률","n","—","은퇴 전 소득이 없어 계산하지 않았습니다.","");
  else L("save","은퇴 전 저축률",saveRate>=0.2?"g":saveRate>=0.1?"y":"r",Math.round(saveRate*100)+"%",
    "은퇴 전 세후소득 중 저축(연금저축 포함)으로 남는 비율의 평균입니다."+(deficitYears?" 적자 연도 "+deficitYears+"개년 포함.":""),
    saveRate>=0.2?"":"세후소득의 20% 이상 저축이 일반적인 권장선입니다. 고정비부터 점검해 보세요.");
  /* 7 은퇴 시 부채 */
  const lastNet=lastPre?lastPre.netWork:0;
  L("debt","은퇴 시점 부채",debtAtR<=0?"g":debtAtR<=lastNet?"y":"r",debtAtR<=0?"없음":eok(debtAtR),
    debtAtR<=0?"은퇴 전에 대출이 모두 상환됩니다.":"은퇴 시점에 대출 잔액이 남아 있어 노후 현금흐름을 압박합니다.",
    debtAtR<=0?"":"은퇴 전 중도상환 계획을 세우거나 상환 기간을 은퇴 전에 끝나도록 조정해 보세요.");

  const reds=lights.filter(l=>l.lv==="r").length, yel=lights.filter(l=>l.lv==="y").length;
  const core=lights.filter(l=>(l.id==="last"||l.id==="ratio")&&l.lv==="r").length;
  const overall=(core>0||reds>=2)?"r":(reds||yel)?"y":"g";

  return {Y0,rows,people:people.map(P=>({k:P.k,birthY:P.birthY,retireAge:P.retireAge,retireY:P.retireY,job:P.job,pub:P.pub})),
    pens,sevs,depPen,lastY,depleteAge,ratio,need,haveAtR,finAtR,sevLumpTot,ppsAtR,gapYears,gapCover,repl,
    saveRate,deficitYears,layers,debtAtR,lights,overall,hpMonthly,hpStartY,infl,ret,retireY:A.retireY,rY,
    penIncReal,allPenY,endAge:num(st.endAge)};
}

function eok(v){
  const m=Math.round(v/1e4), sign=m<0?"−":"", am=Math.abs(m);
  if(am>=10000){const e=Math.floor(am/10000), r=am%10000; return sign+e.toLocaleString()+"억"+(r?" "+r.toLocaleString()+"만":"");}
  return sign+am.toLocaleString()+"만";
}

const API={Y0,M0,defaults,newSrc,newPerson,newLoan,LOAN_PRESET,srcTypeOf,sevTypeOf,compute,eok,npsNormalAge,hpFactor};
if(typeof module!=="undefined"&&module.exports) module.exports=API; else root.Engine=API;
})(typeof window!=="undefined"?window:this);
