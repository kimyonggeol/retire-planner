/* 노후 준비 계산기 — 화면 · 입력 · 저장 */
"use strict";
(function(){
const APP_VER="1.4.0";
const E=window.Engine, Y0=E.Y0, eok=E.eok;
const KEY="retire-planner:v1";
const $=id=>document.getElementById(id);
const esc=s=>String(s==null?"":s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));

/* ═══════════ 상태 · 저장 ═══════════ */
let st=E.defaults(), ui={step:0,maxStep:0,tab:"diag",real:true,openRow:null,openSpend:false,ov:{retireAdd:0,save:0,postAdd:0,retAdd:0},hasResult:false};
function merge(base,src){            // 저장본에 없는 새 항목은 기본값 유지
  if(Array.isArray(base)) return Array.isArray(src)?src:base;
  if(base&&typeof base==="object"){ const o=Object.assign({},base);
    if(src&&typeof src==="object") Object.keys(src).forEach(k=>{ o[k]=(k in base)?merge(base[k],src[k]):src[k]; });
    return o; }
  return src===undefined?base:src;
}
function fixArrays(s){              // 배열 원소에도 기본 필드 보충
  ["A","B"].forEach(k=>{ s[k].src=s[k].src.map(c=>{const m=merge(E.newSrc(c.type),c); if(!Array.isArray(m.promoList)) m.promoList=[]; return m;}); if(!s[k].src.length) s[k].src=[E.newSrc(E.srcTypeOf(s[k].job))]; });
  s.loans=s.loans.map(l=>merge(E.newLoan(l.kind),l));
  return s;
}
function load(){
  try{ const raw=localStorage.getItem(KEY); if(!raw) return false;
    const o=JSON.parse(raw); st=fixArrays(merge(E.defaults(),o.st||o)); if(o.ui) Object.assign(ui,{step:o.ui.step||0,maxStep:o.ui.maxStep||0,hasResult:!!o.ui.hasResult});
    return true; }catch(e){ return false; }
}
let saveT=null;
function save(now){
  clearTimeout(saveT);
  const f=()=>{ try{ localStorage.setItem(KEY,JSON.stringify({t:Date.now(),v:APP_VER,st,ui:{step:ui.step,maxStep:ui.maxStep,hasResult:ui.hasResult}})); }catch(e){} };
  if(now) f(); else saveT=setTimeout(f,300);
}
document.addEventListener("visibilitychange",()=>{ if(document.visibilityState==="hidden") save(true); });
window.addEventListener("pagehide",()=>save(true));

/* ═══════════ 경로 접근 ═══════════ */
const get=p=>p.split(".").reduce((o,k)=>o==null?o:o[k],st);
function set(p,v){ const ks=p.split("."); let o=st; for(let i=0;i<ks.length-1;i++) o=o[ks[i]]; o[ks[ks.length-1]]=v; }

/* ═══════════ 입력 위젯 ═══════════ */
const adv=()=>st.mode==="detail";
const fmtIn=(v,money)=>(v===""||v==null)?"":money?Number(v).toLocaleString("en-US"):String(v);
/* 숫자 입력: o={unit,hint,dec,money,opt,ph,adv,r} */
/* 도움말(!) 버튼: o.i 에 설명을 넣으면 라벨 옆에 붙는다 */
const openTips=new Set();
const qid=p=>"q_"+p.replace(/[^\w]/g,"_");
const QB=(p,o)=>o.i?`<button type="button" class="qi" data-qi="${qid(p)}" aria-label="입력 도움말">!</button>`:"";
const QT=(p,o)=>o.i?`<div class="qtip" id="${qid(p)}"${openTips.has(qid(p))?"":" hidden"}>${o.i}</div>`:"";
function F(p,label,o){
  o=o||{}; if(o.adv&&!adv()) return "";
  const money=o.unit==="만원"||o.money;
  return `<div class="fld" data-f="${p}"><span class="lb">${label}${QB(p,o)}${o.hint?`<small>${o.hint}</small>`:""}</span>
    <span class="ib"><input type="text" inputmode="${o.dec?"decimal":"numeric"}" data-k="${p}"${money?" data-money":""}${o.opt?" data-opt":""}${o.r?" data-r":""}
      value="${esc(fmtIn(get(p),money))}" placeholder="${esc(o.ph||"")}" autocomplete="off" enterkeyhint="next" aria-label="${esc(label)}"><em>${o.unit||""}</em></span></div>${QT(p,o)}`;
}
/* 선택 목록 */
function SEL(p,label,opts,o){
  o=o||{}; if(o.adv&&!adv()) return "";
  const v=get(p);
  return `<div class="fld" data-f="${p}"><span class="lb">${label}${QB(p,o)}${o.hint?`<small>${o.hint}</small>`:""}</span>
    <span class="ib"><select data-k="${p}" data-s data-r aria-label="${esc(label)}">${opts.map(([k,l])=>`<option value="${k}"${String(k)===String(v)?" selected":""}>${l}</option>`).join("")}</select></span></div>${QT(p,o)}`;
}
/* 버튼형 선택 (값: 문자열 · 숫자 · 불리언) */
function SEG(p,label,opts,o){
  o=o||{}; if(o.adv&&!adv()) return "";
  const v=p==="__kidN"?st.kids.length:get(p);
  return `<div class="fseg">${label?`<span class="lb">${label}${QB(p,o)}${o.hint?`<small>${o.hint}</small>`:""}</span>`:""}${QT(p,o)}
    <div class="seg">${opts.map(([k,l])=>`<button type="button" data-set="${p}" data-val="${typeof k==="boolean"?(k?"__t":"__f"):k}"${typeof k==="number"?" data-n":""}
      class="${String(k)===String(v)?"on":""}">${l}</button>`).join("")}</div></div>`;
}
const card=(title,body,sub)=>`<div class="card">${title?`<h3>${title}${sub?`<small>${sub}</small>`:""}</h3>`:""}${body}</div>`;

/* ═══════════ 상수 목록 ═══════════ */
const JOBS=[["corp","직장인 (회사원)"],["public","공무원 · 교원"],["military","군인"],["biz","개인사업자"],["free","프리랜서"],["daily","일용 · 시간제"],["none","소득 없음"]];
const JOBS_B=[["none","소득 없음"],["corp","직장인 (회사원)"],["public","공무원 · 교원"],["military","군인"],["biz","개인사업자"],["free","프리랜서"],["daily","일용 · 시간제"]];
const SRC_T=[["salary","급여 (근로소득)"],["biz","사업소득"],["free","프리랜서 (3.3%)"],["daily","일용 · 시급"],["etc","기타 (임대·부업 등)"]];
const LOAN_K=[["mortgage","주택담보 (일반)"],["policy_mortgage","주택담보 (정책·디딤돌 등)"],["jeonse","전세자금 (일반)"],["policy_jeonse","전세자금 (버팀목 등)"],["credit","신용대출"],["negative","마이너스통장"],["deposit","예적금·보험 담보"],["other","기타"]];
const PAY_T=[["equal_pi","원리금균등"],["equal_p","원금균등"],["gpm","체증식"],["bullet","만기일시 (이자만)"],["mixed","혼합 (일부 분할)"]];
const RATE_T=[["fixed","고정"],["hybrid","혼합 (N년 고정 후 변동)"],["variable","변동"]];
const JOB_NAME=Object.fromEntries(JOBS);
const JOBS_W=JOBS.filter(j=>j[0]!=="none");
/* 실제로 일하는 형태: '소득 없음'이어도 향후 근로 계획이 있으면 그 직업 */
const ej=K=>{const P=st[K]; return P.job==="none"&&P.future&&P.future.use?P.future.job:P.job;};
const isPub=K=>ej(K)==="public"||ej(K)==="military";

/* ═══════════ 입력 도움말 ═══════════ */
const TIP={
  future:"육아·학업 등으로 지금은 쉬지만 다시 일할 계획이 있다면 '있음'을 고르세요. 넣은 기간에만 소득·4대보험·국민연금 가입기간이 생깁니다.",
  endAge:"몇 살까지 생활비가 필요하다고 볼지입니다. 짧게 잡으면 결과가 낙관적으로 나오니 95세 안팎을 권합니다.",
  infl:"물가가 매년 오르는 비율입니다. 한국은행 목표치인 2%를 많이 씁니다.",
  ret:"모아 둔 금융자산 전체가 1년에 불어나는 평균 비율입니다. 예금·적금 위주면 2~3%, 주식·펀드를 섞으면 4~5%. 높게 잡을수록 결과가 좋아 보이니 보수적으로 넣으세요.",
  raise:"해마다 오르는 연봉 비율(물가 인상 + 호봉)입니다. 상세 모드에서 승진을 따로 넣는다면 승진으로 크게 오르는 부분은 빼고 넣어야 중복되지 않습니다.",
  bonMode:"<b>고정 금액</b>: 매년 정해진 금액(예: 연 500만원)<br><b>월급의 %</b>: 월급(기본 연봉 ÷ 12)에 비율을 곱한 금액. 연봉이 오르면 성과급도 함께 오릅니다.<br><b>혼합</b>: 고정 금액 + 비율을 함께 받는 경우<br>①은 퇴직금 평균임금에 들어가는 상여, ②는 들어가지 않는 성과급으로 나눠 넣으세요.",
  bonIn:"정기상여처럼 퇴직금 평균임금에 들어가는 상여입니다. 1년에 받는 비율을 모두 더해 넣으세요. 예: 월급의 100% → 100",
  bonEx:"경영성과급·PS처럼 퇴직금 계산에 들어가지 않는 성과급입니다. 1년 합계 비율을 넣으세요. 예: 월급의 600% → 600",
  promo:"<b>평균으로 입력</b>: 승진 횟수·주기와 1회당 평균 상승액을 넣습니다.<br><b>승진별로 입력</b>: 대리→과장 500만, 과장→차장 800만처럼 연도와 금액을 하나씩 넣습니다.<br>금액은 승진으로 오르는 <b>연봉 차이</b>를 지금 연봉 수준으로 넣으세요. 승진 시점까지 연 인상률만큼 함께 올려 계산합니다.",
  freeExp:"총수입 중 일 때문에 쓴 비용(장비·재료·교통 등)의 비율입니다. 장부를 안 쓰면 업종별 경비율(대략 20~60%)이 적용되니 종합소득세 신고서의 '필요경비'를 참고하세요.",
  etcKind:"월세·상가 임대수입은 '사업소득', 강연료·원고료 같은 일회성 수입은 '기타소득', 이미 세금을 뗀 돈이나 비과세 수당은 '비과세'를 고르세요.",
  srcPeriod:"비워 두면 올해부터 은퇴 전년까지로 계산합니다. 월세 수입처럼 은퇴 후에도 들어오는 소득은 종료 연도를 은퇴 이후로 넣으세요.",
  fin:"예금·적금·주식·펀드·코인처럼 바로 쓸 수 있는 돈의 합계입니다.<br>· 퇴직연금·연금저축 → '연금' 단계에서<br>· 집 → 아래 '주택'에서<br>· 대출 → 빼지 말고 아래 '대출'에 따로",
  house:"지금 팔면 받을 수 있는 시세(KB시세·실거래가)입니다. 대출은 빼지 말고 아래 대출 칸에 따로 넣으세요.",
  loanP:"처음 빌린 금액이 아니라 <b>지금 남은 원금</b>입니다. 은행 앱의 대출 조회 화면에서 '대출잔액'을 확인하세요.",
  loanTerm:"만기까지 남은 기간입니다. 30년 대출을 5년째 갚고 있다면 25를 넣으세요.",
  loanPay:"<b>원리금균등</b>: 매달 같은 금액<br><b>원금균등</b>: 원금은 같고 이자가 줄어 처음이 가장 큼<br><b>체증식</b>: 처음엔 적게, 점점 많이<br><b>만기일시</b>: 이자만 내다 만기에 원금 한 번에 (전세·신용대출)<br><b>혼합</b>: 일부만 나눠 갚고 나머지는 만기에",
  loanRate:"<b>고정</b>: 만기까지 금리가 같음<br><b>혼합</b>: 처음 몇 년은 고정, 그 뒤 변동금리로 바뀜 (예: 주담대 5년 고정형, 신생아 특례대출처럼 특례금리 기간 뒤 일반금리로 바뀌는 상품)<br><b>변동</b>: 6개월·1년마다 금리가 바뀜 → 남은 기간 평균으로 예상해 넣으세요",
  loanFixY:"지금부터 고정금리가 남은 기간입니다. 5년 고정 상품을 2년째 갚고 있다면 3을 넣으세요.",
  grace:"원금은 안 갚고 이자만 내는 기간 중 <b>남은 기간</b>입니다. 이미 끝났으면 0.",
  month:"관리비·보험·통신·차량·식비·쇼핑·여가·용돈에, 여행·경조사 같은 연간 지출을 12로 나눈 금액까지 더한 한 달 평균입니다. 최근 몇 달 카드값 + 현금 지출 평균으로 잡으면 쉽습니다.",
  travel:"주말 캠핑, 국내 여행, 해외 여행을 모두 여기에 넣습니다. 위 '여가'에는 여행을 넣지 마세요.",
  support:"자녀 결혼·전세 자금 등 독립할 때 한 번 지원할 1인당 금액입니다.",
  pastM:"국민연금에 지금까지 보험료를 낸 <b>총 개월수</b>입니다. A·B 회사를 다녔다면 두 회사 가입기간을 합친 숫자를 넣으세요.<br>'내 곁에 국민연금' 앱 → 내 연금 → 가입내역에서 확인할 수 있습니다.",
  pastInc:"그동안 국민연금에 신고된 월소득 평균을 지금 돈 가치로 넣습니다. 모르면 현재 세전 월급의 70~80% 정도로 잡으세요.",
  npsManual:"'내 곁에 국민연금' 앱 → 예상연금액 조회에 나온 월 금액(현재가치 기준)을 그대로 넣으세요.",
  npsAge:"1969년생 이후는 65세가 정상 수령 나이입니다. 1년 일찍 받으면 6%씩 줄고, 늦추면 7.2%씩 늘어 평생 적용됩니다.",
  pubManual:"공무원연금공단·사학연금 홈페이지의 '예상퇴직급여 조회' 월 금액을 넣으세요.",
  pubStart:"공무원·교원은 임용 연도, 군인은 임관 연도입니다. 재직연수가 연금액을 정합니다.",
  sevType:"<b>DB형</b>: 퇴직 때 평균임금 × 근속연수로 정해진 금액을 받습니다. '퇴직금'만 있는 회사도 여기입니다.<br><b>DC형</b>: 회사가 매년 연봉의 1/12 이상을 내 계좌에 넣고 내가 운용합니다.<br>모르면 인사팀이나 퇴직연금 가입 금융사 앱에서 확인하세요.",
  dbMode:"법에서는 근속 1년당 30일분(약 1개월치) 평균임금을 줍니다. 회사에 누진제 같은 별도 규정이 있으면 '회사 규정'을 고르고 지급 개월수 공식을 넣으세요. 법정보다 적게 나오면 법정 금액으로 계산합니다.",
  dbA:"근속 n년에 몇 개월치를 주는지 공식으로 넣습니다.<br>예) 2n−2개월 → a=2, b 빼기 2<br>예) 1.5n개월 → a=1.5, b=0",
  dcOpen:"회사 퇴직연금(DC) 계좌의 현재 평가금액입니다. 가입 금융사 앱에서 확인할 수 있습니다.",
  ppsOpen:"연금저축(펀드·보험)과 개인 IRP 계좌의 현재 평가금액 합계입니다. 회사 DC 계좌는 빼고 넣으세요.",
  ppsSave:"1년 동안 넣는 금액입니다. 연금저축 + IRP 합산 연 900만원까지 세액공제를 받습니다.",
  ppsAge:"만 55세부터 받을 수 있고, 은퇴 전에는 받지 않는 것으로 계산합니다. 국민연금이 나오기 전 공백기에 맞추면 노후 현금흐름이 안정됩니다.",
  postExp:"은퇴 후 부부가 한 달에 쓸 돈을 지금 물가로 넣습니다. 보통 은퇴 전 생활비의 60~70%이고, 부부 적정 노후생활비는 월 300만원 안팎으로 조사됩니다.",
  side:"은퇴 후 시간제 일·자영업 등으로 버는 월 소득(세전, 지금 가치)입니다. 없으면 0.",
  hpAge:"부부 중 나이가 적은 사람이 만 55세 이상이면 가입할 수 있고, 늦게 가입할수록 월 수령액이 커집니다."
};

/* ═══════════ 단계 ═══════════ */
const STEPS=[
  {id:"profile",t:"기본 정보",show:()=>true,r:rProfile},
  {id:"incA",t:"내 소득",show:()=>ej("A")!=="none",r:()=>rIncome("A")},
  {id:"incB",t:"배우자 소득",show:()=>st.hasSpouse&&ej("B")!=="none",r:()=>rIncome("B")},
  {id:"asset",t:"자산 · 대출",show:()=>true,r:rAsset},
  {id:"exp",t:"생활비 · 자녀",show:()=>true,r:rExp},
  {id:"pen",t:"연금 · 퇴직금",show:()=>true,r:rPen},
  {id:"post",t:"은퇴 후",show:()=>true,r:rPost}
];
const active=()=>STEPS.filter(s=>s.show());

function futureBlock(K){
  const f=K+".future", who=K==="A"?"":"배우자 ";
  let h=SEG(f+".use","앞으로 일할 계획",[[true,"있음"],[false,"없음"]],{i:TIP.future});
  if(st[K].future.use){
    h+=`<div class="sub">`+SEL(f+".job",who+"일할 형태",JOBS_W)+
      F(f+".startY","소득 시작 연도",{unit:"년",r:1,hint:"만 "+(+st[K].future.startY-st[K].birthY)+"세"})+
      F(f+".endY","소득 종료 연도",{unit:"년",r:1,hint:"만 "+(+st[K].future.endY-st[K].birthY)+"세 · 그다음 해 은퇴"})+
      `<p class="note">예상 연봉은 '${K==="A"?"내":"배우자"} 소득' 단계에서 넣습니다.</p></div>`;
  }
  return h;
}
function rProfile(){
  const age=Y0-st.A.birthY;
  let h=`<h2 class="st">기본 정보</h2><p class="lead">모든 금액은 <b>올해(${Y0}년) 가치, 만원 단위</b>로 넣어 주세요. 물가 상승은 자동으로 반영됩니다.</p>`;
  h+=card("입력 방식",SEG("mode","",[["simple","간편 (5분)"],["detail","상세"]])+
    `<p class="note">${st.mode==="simple"?"꼭 필요한 항목만 묻습니다. 언제든 상세로 바꿀 수 있어요.":"상여·승진·대출 조건·연금 수령 방식 등 세부 항목까지 입력합니다."}</p>`);
  h+=card("나",F("A.birthY","출생 연도",{hint:"만 "+age+"세",unit:"년",r:1})+
    SEL("A.job","일하는 형태",JOBS)+
    (st.A.job==="none"?futureBlock("A"):"")+
    (st.A.job!=="none"?F("A.retireAge","은퇴 희망 나이",{hint:(+st.A.birthY+ +st.A.retireAge)+"년 은퇴",unit:"세",r:1})
      :st.A.future.use?"":F("A.retireAge","은퇴로 볼 나이",{hint:"생활비가 은퇴 후 기준으로 바뀌는 나이",unit:"세"}))+
    F("endAge","계산 종료 나이",{hint:"기대수명 · 보통 90~100세",unit:"세",i:TIP.endAge}));
  let sp=SEG("hasSpouse","배우자",[[true,"있음"],[false,"없음"]]);
  if(st.hasSpouse){
    sp+=F("B.birthY","배우자 출생 연도",{unit:"년"})+SEL("B.job","배우자 일하는 형태",JOBS_B);
    if(st.B.job!=="none") sp+=F("B.retireAge","배우자 은퇴 나이",{unit:"세"});
    else sp+=futureBlock("B");
  }
  h+=card("배우자",sp);
  let kd=SEG("hasKids","자녀",[[true,"있음 (예정 포함)"],[false,"없음"]]);
  if(st.hasKids){
    kd+=SEG("__kidN","자녀 수",[[1,"1명"],[2,"2명"],[3,"3명"],[4,"4명"]]);
    st.kids.forEach((k,i)=>{ kd+=F("kids."+i+".y","자녀 "+(i+1)+" 출생 연도",{hint:"예정이면 예상 연도",unit:"년"}); });
  }
  h+=card("자녀",kd);
  h+=card("경제 가정",F("eco.infl","물가상승률",{unit:"%",dec:1,hint:"보통 2%",i:TIP.infl})+
    F("eco.ret","자산 운용수익률",{unit:"%",dec:1,hint:"예금 위주 2~3%, 투자 병행 4~5%",i:TIP.ret})+
    F("eco.wg","전체 임금상승률",{unit:"%",dec:1,adv:1,hint:"국민연금 A값·상한액 상승률"}));
  return h;
}

/* 상여·성과급: 고정 금액 / 월급 대비 % / 혼합 */
function bonusBlock(p,c){
  const m=c.bonMode||"amount", mw=(+c.amt||0)/12;
  let h=`<div class="sec">상여 · 성과급</div>`+SEG(p+".bonMode","지급 방식",[["amount","고정 금액"],["pct","월급의 %"],["mix","혼합"]],{i:TIP.bonMode});
  const grp=(t,kA,kP,tip)=>{
    let g=`<div class="sub"><div class="hd"><span>${t}</span></div>`;
    if(m!=="pct") g+=F(p+"."+kA,"연간 금액",{unit:"만원",hint:"올해 기준 · 연봉 인상률만큼 증가",r:1});
    if(m!=="amount") g+=F(p+"."+kP,"월급 대비 (연간 합계)",{unit:"%",dec:1,hint:"예: 600 = 월급 6개월치",r:1,i:tip});
    const v=(m!=="pct"?(+c[kA]||0):0)+(m!=="amount"?mw*(+c[kP]||0)/100:0);
    return g+`<p class="note" style="margin:2px 0 8px">올해 기준 연 <b>${Math.round(v).toLocaleString()}만원</b>${m!=="amount"?" · 월급 "+Math.round(mw).toLocaleString()+"만원 기준":""}</p></div>`;
  };
  h+=grp("① 퇴직금에 반영되는 상여","bonIn","bonInPct",TIP.bonIn);
  h+=grp("② 퇴직금에 반영 안 되는 성과급","bonEx","bonExPct",TIP.bonEx);
  return h;
}
function srcCard(K,i){
  const c=st[K].src[i], p=K+".src."+i, simple=!adv();
  let h=`<div class="sub"><div class="hd"><span>소득 ${i+1}</span>${i>0?`<button class="dbtn" data-del="${K}.src" data-i="${i}">삭제</button>`:""}</div>`;
  if(adv()||i>0) h+=SEL(p+".type","소득 종류",SRC_T);
  const gr=c.type==="salary"?"연 인상률":"연 증가율";
  if(c.type==="salary"){
    h+=F(p+".amt","세전 기본 연봉",{unit:"만원",hint:"상여·성과급 제외 · 월급 × 12"});
    h+=F(p+".raise",gr,{unit:"%",dec:1,hint:"승진 제외 · 호봉·물가 인상",i:TIP.raise});
    h+=bonusBlock(p,c);
    if(adv()){
      h+=`<div class="sec">승진</div>`+SEG(p+".promoMode","입력 방식",[["avg","평균으로 입력"],["each","승진별로 입력"]],{i:TIP.promo});
      if(c.promoMode==="each"){
        (c.promoList||[]).forEach((pm,j)=>{ const q=p+".promoList."+j;
          h+=`<div class="sub"><div class="hd"><span>승진 ${j+1}</span><button class="dbtn" data-del="${p}.promoList" data-i="${j}">삭제</button></div>`+
            F(q+".y","승진 연도",{unit:"년"})+F(q+".up","연봉 상승액",{unit:"만원",hint:"올해 연봉 기준 금액"})+`</div>`; });
        if(!(c.promoList||[]).length) h+=`<p class="note">은퇴 전까지 예상되는 승진을 하나씩 추가하세요. 없으면 비워 두세요.</p>`;
        if((c.promoList||[]).length<8) h+=`<button class="tbtn" data-add="${p}.promoList">＋ 승진 추가</button>`;
      } else {
        h+=F(p+".promoN","남은 승진 횟수",{unit:"회",hint:"없으면 0"})+F(p+".promoY","다음 승진 연도",{unit:"년"})+
           F(p+".promoCycle","승진 주기",{unit:"년",hint:"몇 년마다"})+F(p+".promoUp","승진 1회당 평균 연봉 상승액",{unit:"만원",hint:"올해 연봉 기준"});
      }
    }
  } else if(c.type==="biz"){
    h+=F(p+".amt","연 순소득",{unit:"만원",hint:"매출 − 필요경비"})+F(p+".raise",gr,{unit:"%",dec:1});
  } else if(c.type==="free"){
    h+=F(p+".amt","연 총수입",{unit:"만원",hint:"3.3% 떼기 전"})+F(p+".freeExp","필요경비율",{unit:"%",hint:"수입 중 경비 비중",i:TIP.freeExp})+F(p+".raise",gr,{unit:"%",dec:1});
  } else if(c.type==="daily"){
    h+=F(p+".amt","하루 일당",{unit:"만원"})+F(p+".days","한 달 근무일",{unit:"일",hint:"8일 이상이면 4대보험 가입"})+F(p+".months","1년 근무 개월",{unit:"개월"})+F(p+".raise",gr,{unit:"%",dec:1});
  } else {
    h+=F(p+".amt","연 수입",{unit:"만원"})+SEL(p+".etcKind","과세 방식",[["biz","사업소득 (임대 등)"],["other","기타소득 (경비 60%)"],["nontax","비과세 · 이미 세후"]],{i:TIP.etcKind})+F(p+".raise",gr,{unit:"%",dec:1});
  }
  if(adv()||i>0){
    const fu=st[K].job==="none"&&st[K].future.use;
    h+=F(p+".startY","시작 연도",{unit:"년",opt:1,ph:String(fu?st[K].future.startY:Y0),hint:"비우면 "+(fu?"계획한 시작 연도":"올해")+"부터",i:TIP.srcPeriod});
    h+=F(p+".endY","종료 연도",{unit:"년",opt:1,ph:String(fu?st[K].future.endY:+st[K].birthY+ +st[K].retireAge-1),hint:"비우면 은퇴 전년까지"});
  }
  return h+"</div>";
}
function rIncome(K){
  const who=K==="A"?"내":"배우자";
  const fu=st[K].job==="none"&&st[K].future.use;
  let h=`<h2 class="st">${who} 소득</h2><p class="lead">${JOB_NAME[ej(K)]} 기준으로 물어봅니다. ${fu?`<b>${st[K].future.startY}~${st[K].future.endY}년</b>에 벌 것으로 예상하는 금액을 <b>올해 가치</b>로 넣어 주세요.`:""} ${K==="A"?"부업·임대소득이 있으면 상세 모드에서 소득을 추가할 수 있어요.":""}</p>`;
  let b=st[K].src.map((_,i)=>srcCard(K,i)).join("");
  if(adv()&&st[K].src.length<5) b+=`<button class="tbtn" data-add="${K}.src">＋ 소득 추가 (부업·임대 등)</button>`;
  h+=card("",b);
  if(isPub(K))
    h+=`<div class="info">공무원·교원·군인은 국민연금 대신 <b>직역연금(기여금 9%)</b>으로 계산하고, 고용보험은 제외합니다.</div>`;
  if(ej(K)==="biz"||ej(K)==="free")
    h+=`<div class="info">사업자·프리랜서는 국민연금·건강보험을 <b>지역가입자로 전액 본인 부담</b>합니다.</div>`;
  return h;
}

function loanCard(i){
  const p="loans."+i, L=st.loans[i];
  let h=`<div class="sub"><div class="hd"><span>대출 ${i+1}</span><button class="dbtn" data-del="loans" data-i="${i}">삭제</button></div>`;
  h+=SEL(p+".kind","종류",LOAN_K)+F(p+".P","현재 남은 원금",{unit:"만원",i:TIP.loanP,r:1})+F(p+".term","남은 기간",{unit:"년",i:TIP.loanTerm,r:1});
  h+=SEG(p+".rate","금리 유형",[["fixed","고정"],["hybrid","혼합"],["variable","변동"]],{i:TIP.loanRate});
  if(L.rate==="hybrid"){
    h+=`<div class="sub">`+F(p+".fixY","고정금리 남은 기간",{unit:"년",r:1,hint:"이미 지난 기간은 빼고",i:TIP.loanFixY})+
      F(p+".r1","고정금리",{unit:"%",dec:2,r:1})+F(p+".r2","고정기간 후 평균 예상금리",{unit:"%",dec:2,r:1,hint:"변동금리로 바뀐 뒤"})+`</div>`;
  } else h+=F(p+".r1",L.rate==="variable"?"예상 평균 금리":"금리",{unit:"%",dec:2,r:1,hint:L.rate==="variable"?"남은 기간 평균으로 예상":""});
  h+=SEL(p+".pay","상환 방식",PAY_T,{i:TIP.loanPay});
  const pv=E.loanPreview(L);
  if(pv){
    const mm=v=>Math.round(v/1e4).toLocaleString();
    h+=`<div class="info">월 상환액 약 <b>${mm(pv.first)}만원</b>${pv.switchPay!=null?` → 금리 전환 후 <b>${mm(pv.switchPay)}만원</b>`:""} · 남은 이자 합계 약 ${mm(pv.totalInt)}만원</div>`;
  }
  if(adv()){
    h+=F(p+".grace","남은 거치 기간",{unit:"년",hint:"이자만 내는 기간",i:TIP.grace});
    if(L.pay==="gpm") h+=F(p+".g","체증률",{unit:"%",dec:1});
    if(L.pay==="mixed") h+=F(p+".mixPct","분할상환 비율",{unit:"%"});
    if(L.pay==="bullet") h+=SEL(p+".roll","만기 때",[["repay","전액 상환"],["extend","계속 연장 (이자만)"]]);
  }
  return h+"</div>";
}
function rAsset(){
  let h=`<h2 class="st">자산 · 대출</h2><p class="lead">지금 가진 돈과 빚입니다.</p>`;
  h+=card("금융자산",F("fin","예금·주식·펀드 합계",{unit:"만원",hint:"퇴직연금·연금저축·집 제외",i:TIP.fin}));
  let hs=SEG("house.has","내 집 (실거주)",[[true,"있음"],[false,"없음 · 전월세"]]);
  if(st.house.has) hs+=F("house.value","현재 시세",{unit:"만원",i:TIP.house})+F("house.g","연 상승률",{unit:"%",dec:1,adv:1});
  else hs+=`<p class="note">월세는 다음 단계 생활비에 포함해 주세요.</p>`;
  h+=card("주택",hs);
  let lb=st.loans.map((_,i)=>loanCard(i)).join("")||`<p class="note">대출이 없으면 그대로 넘어가세요.</p>`;
  if(st.loans.length<6) lb+=`<button class="tbtn" data-add="loans">＋ 대출 추가</button>`;
  h+=card("대출",lb,"종류를 고르면 일반 조건이 채워집니다");
  return h;
}

function rExp(){
  const kidNote=`<div class="info">⚠ <b>대출 상환액${st.hasKids?"과 자녀 교육비·용돈":""}은 넣지 마세요.</b> ${st.hasKids?"아래 '자녀' 항목과 대출 단계에서":"대출 단계에서"} 따로 계산하므로, 여기 넣으면 두 번 빠져나갑니다.</div>`;
  let h=`<h2 class="st">생활비 · 자녀</h2><p class="lead">은퇴 전까지 가구가 쓰는 돈입니다.</p>`+kidNote;
  if(!adv()) h+=card("생활비",F("exp.month","월 생활비 (가구)",{unit:"만원",hint:"여행·경조사 등 연간 지출도 12로 나눠 포함",i:TIP.month})+F("exp.g","연 상승률",{unit:"%",dec:1}));
  else{
    const ex=st.exp, sum=k=>k.reduce((a,x)=>a+(+ex[x]||0),0);
    const fx=sum(["fHousing","fIns","fComm","fCar","fPocket","fEtc"]), vr=sum(["vFood","vFun","vShop","vDaily","vMed","vEtc"]), an=sum(["travel","misc"]);
    h+=card("① 고정지출 (월)",F("exp.fHousing","주거",{unit:"만원",hint:"관리비·공과금·월세"})+F("exp.fIns","보험료",{unit:"만원",hint:"실손·종신·자동차 등"})+
      F("exp.fComm","통신 · 구독",{unit:"만원",hint:"휴대폰·인터넷·OTT"})+F("exp.fCar","차량 · 교통",{unit:"만원",hint:"주유·정비·대중교통"})+
      F("exp.fPocket","부부 용돈",{unit:"만원",hint:"두 사람 합계"})+F("exp.fEtc","기타 고정",{unit:"만원",hint:"부모님 용돈·회비 등"})+
      F("exp.fixG","상승률",{unit:"%",dec:1})+`<p class="note">${st.hasKids?"자녀 교육비·용돈은 '자녀' 항목에서 따로 넣으니 여기에는 넣지 마세요. ":""}대출 상환액도 제외입니다.</p>`,"월 "+fx.toLocaleString()+"만원");
    h+=card("② 변동지출 (월)",F("exp.vFood","식비",{unit:"만원",hint:"장보기·배달·외식"})+F("exp.vFun","여가",{unit:"만원",hint:"취미·문화·운동 · 여행 제외"})+
      F("exp.vShop","쇼핑",{unit:"만원",hint:"의류·잡화·가전"})+F("exp.vDaily","생필품",{unit:"만원",hint:"세제·위생용품 등"})+
      F("exp.vMed","의료",{unit:"만원",hint:"병원·약값"})+F("exp.vEtc","기타 변동",{unit:"만원"})+F("exp.varG","상승률",{unit:"%",dec:1}),"월 "+vr.toLocaleString()+"만원");
    h+=card("③ 연간 지출 (1년 합계)",F("exp.travel","여행",{unit:"만원",hint:"주말 캠핑·국내·해외 여행 모두",i:TIP.travel})+F("exp.misc","경조사 · 명절",{unit:"만원",hint:"축의·부의금, 명절 비용"})+
      F("exp.miscG","상승률",{unit:"%",dec:1}),"연 "+an.toLocaleString()+"만원");
    h+=`<div class="info">한 달 평균 생활비 <b>${Math.round(fx+vr+an/12).toLocaleString()}만원</b> = 고정 ${fx.toLocaleString()} + 변동 ${vr.toLocaleString()} + 연간 지출 ÷ 12 (${Math.round(an/12).toLocaleString()})</div>`;
  }
  if(st.hasKids){
    /* 자녀 출생 연도로 이미 지난 학령 단계는 숨김 (계산 엔진과 같은 나이 구간) */
    const ages=st.kids.map(k=>Y0-(+k.y||Y0));
    const ahead=end=>ages.some(a=>a<end);             // 아직 그 단계를 마치지 않은 자녀가 있으면 표시
    const S={e0:ahead(7),s1:ahead(13),s2:ahead(16),s3:ahead(19),s4:ahead(23),sup:ahead(29)};
    const ageTxt=ages.map((a,i)=>(ages.length>1?"자녀"+(i+1)+" ":"")+(a<0?"출생 예정":"만 "+a+"세")).join(" · ");
    const hidden=[!S.e0&&"미취학",!S.s1&&"초등",!S.s2&&"중등",!S.s3&&"고등",!S.s4&&"대학"].filter(Boolean);
    const hidNote=hidden.length?`<p class="note">${ageTxt} 기준이라 이미 지난 <b>${hidden.join("·")}</b> 단계는 뺐습니다.</p>`:"";
    if(!S.s4){
      h+=card("자녀",`<p class="note">${ageTxt} — 교육비 단계가 모두 끝나 교육비·용돈은 계산하지 않습니다.</p>`+
        (S.sup&&adv()?F("kidCost.support","독립 지원금 (1인)",{unit:"만원",hint:"결혼·주거, 만 28세에 지출",i:TIP.support}):""));
    } else if(!adv()){
      const lv={low:0.6,mid:1,high:1.6}[st.kidLevel]||1, kc=st.kidCost;
      const parts=[S.e0&&"미취학 "+Math.round(kc.e0*lv)+"만", S.s1&&"초등 "+Math.round((+kc.e1+ +kc.a1)*lv)+"만",
        S.s2&&"중등 "+Math.round((+kc.e2+ +kc.a2)*lv)+"만", S.s3&&"고등 "+Math.round((+kc.e3+ +kc.a3)*lv)+"만",
        "대학 등록금 연 "+Math.round(kc.e4*Math.sqrt(lv))+"만 + 용돈 "+Math.round(kc.a4*lv)+"만"].filter(Boolean);
      h+=card("자녀 교육비 수준",SEG("kidLevel","",[["low","적게"],["mid","보통"],["high","많이"]])+
        `<p class="note">1인 월 기준 · ${parts.join(", ")}. 상세 모드에서 직접 바꿀 수 있어요.</p>`+hidNote);
    } else {
      h+=card("자녀 1인 교육비 (월)",(S.e0?F("kidCost.e0","미취학 (만 4~6세)",{unit:"만원"}):"")+(S.s1?F("kidCost.e1","초등",{unit:"만원"}):"")+
        (S.s2?F("kidCost.e2","중등",{unit:"만원"}):"")+(S.s3?F("kidCost.e3","고등",{unit:"만원"}):"")+F("kidCost.e4","대학 등록금 (연)",{unit:"만원"})+hidNote,ageTxt);
      h+=card("자녀 1인 용돈 (월)",(S.s1?F("kidCost.a1","초등",{unit:"만원"}):"")+(S.s2?F("kidCost.a2","중등",{unit:"만원"}):"")+
        (S.s3?F("kidCost.a3","고등",{unit:"만원"}):"")+F("kidCost.a4","대학",{unit:"만원"})+
        F("kidCost.inf","교육비 상승률",{unit:"%",dec:1})+F("kidCost.support","독립 지원금 (1인)",{unit:"만원",hint:"결혼·주거, 만 28세에 지출",i:TIP.support}));
    }
  }
  return h;
}

function penBlock(K){
  const P=st[K], p=K, who=K==="A"?"나":"배우자", pub=isPub(K), job=ej(K), fu=P.job==="none"&&P.future.use;
  const normal=E.npsNormalAge(+P.birthY);
  let h="";
  if(pub){
    const nm=job==="military"?"군인연금":"공무원·사학연금";
    h+=`<div class="sec">${nm}</div>`+SEG(p+".pen.mode","",[["auto","자동 추정"],["manual","예상액 직접 입력"]]);
    if(P.pen.mode==="manual") h+=F(p+".pen.manual","예상 월 연금",{unit:"만원",hint:"공단 조회액 · 올해 가치",i:TIP.pubManual});
    else h+=F(p+".pen.pubStartY","임용 · 입대 연도",{unit:"년",hint:"재직기간 계산",i:TIP.pubStart});
    if(job!=="military") h+=F(p+".pen.startAge","연금 개시 나이",{unit:"세",opt:1,ph:"65",adv:1,hint:"2033년 이후 퇴직자 65세"});
    h+=`<p class="note">${job==="military"?"군인연금은 복무 20년 이상이면 전역 직후부터 나옵니다.":"재직 10년 이상이면 받으며, 지급률은 2035년까지 1.7%로 낮아집니다."} 퇴직수당은 자동 계산합니다.</p>`;
    if(adv()) h+=`<div class="sec">국민연금 (과거 가입분)</div>`+F(p+".pen.pastM","국민연금 납부 개월수",{unit:"개월",hint:"임용 전 직장 경력",i:TIP.pastM})+F(p+".pen.pastInc","그때 평균 월소득",{unit:"만원",hint:"올해 가치로 환산",i:TIP.pastInc});
  } else {
    h+=`<div class="sec">국민연금</div>`+SEG(p+".pen.mode","",[["auto","자동 계산"],["manual","예상액 직접 입력"]]);
    if(P.pen.mode==="manual") h+=F(p+".pen.manual","예상 월 연금",{unit:"만원",hint:"'내 곁에 국민연금' 앱 조회액",i:TIP.npsManual});
    else h+=F(p+".pen.pastM","지금까지 납부 개월수",{unit:"개월",hint:"여러 회사 합계 · 모르면 대략",i:TIP.pastM})+F(p+".pen.pastInc","그동안 평균 월소득",{unit:"만원",hint:"올해 가치 기준 대략",i:TIP.pastInc});
    h+=F(p+".pen.startAge","받기 시작할 나이",{unit:"세",opt:1,ph:String(normal),adv:1,hint:"정상 "+normal+"세",i:TIP.npsAge});
    if(P.pen.mode!=="manual") h+=`<p class="note">앞으로의 납부는 입력한 소득으로 자동 계산합니다. 10년(120개월) 미만이면 연금을 받을 수 없어요.</p>`;
  }
  if(job!=="none"){
    h+=`<div class="sec">퇴직급여</div>`;
    if(pub) h+=`<p class="note">퇴직수당: 재직연수에 따라 퇴직 전 월소득 × 재직연수 × 6.5~39%</p>`;
    else{
      h+=SEL(p+".sev.type","제도",[["db","DB형 · 퇴직금"],["dc","DC형 · 기업형 IRP"],["none","없음"]],{hint:job==="corp"?"모르면 DB형":"사업자·프리랜서는 보통 없음",i:TIP.sevType});
      if(P.sev.type!=="none"&&!fu) h+=F(p+".sev.hireY","입사 연도",{unit:"년",r:1});
      if(P.sev.type==="db"){
        h+=SEG(p+".sev.dbMode","지급 기준",[["legal","법정 (1년당 1개월)"],["custom","회사 규정"]],{i:TIP.dbMode});
        if(P.sev.dbMode==="custom"){
          const yrs=Math.max(1,(+P.birthY+ +P.retireAge)-(fu?+P.future.startY:+P.sev.hireY));
          const mo=window.Engine.dbMonths(P.sev,yrs);
          h+=`<div class="sub"><p class="note" style="margin:8px 0 2px">지급 개월수 = <b>a × 근속연수 ${P.sev.bSign==="+"?"+":"−"} b</b></p>`+
            F(p+".sev.a","a (근속 1년당 개월)",{unit:"배",dec:1,r:1,i:TIP.dbA})+
            SEG(p+".sev.bSign","b 더하기 / 빼기",[["-","빼기 (−)"],["+","더하기 (+)"]])+
            F(p+".sev.b","b (가감 개월수)",{unit:"개월",dec:1,r:1})+
            `<div class="info">예상 근속 <b>${yrs}년</b> → <b>${Math.round(mo*10)/10}개월</b>치 평균임금 (법정이면 ${yrs}개월)</div></div>`;
        }
      }
      if(P.sev.type==="dc") h+=F(p+".sev.open","현재 적립금",{unit:"만원",i:TIP.dcOpen})+F(p+".sev.dcRate","운용수익률",{unit:"%",dec:1,adv:1})+F(p+".sev.dcPct","회사 부담률",{unit:"%",dec:1,adv:1,hint:"법정 8.33%"});
      if(P.sev.type!=="none"&&adv()){
        h+=SEG(p+".sev.recv","받는 방법",[["lump","일시금"],["annuity","연금 (IRP)"]],{hint:"연금 수령 시 퇴직소득세 30% 감면"});
        if(P.sev.recv==="annuity") h+=F(p+".sev.years","나눠 받을 기간",{unit:"년"});
      }
    }
  }
  h+=`<div class="sec">개인연금 (연금저축 · 개인 IRP)</div>`+F(p+".pps.open","현재 적립금",{unit:"만원",i:TIP.ppsOpen})+F(p+".pps.save","연 납입액",{unit:"만원",hint:"은퇴 전까지",i:TIP.ppsSave})+
    F(p+".pps.age","받기 시작할 나이",{unit:"세",hint:"만 55세 이상",i:TIP.ppsAge})+F(p+".pps.years","나눠 받을 기간",{unit:"년",adv:1,hint:"10년 이상이 세제상 유리"});
  return card(who,h);
}
function rPen(){
  let h=`<h2 class="st">연금 · 퇴직금</h2><p class="lead">노후 소득의 세 기둥인 <b>공적연금 · 퇴직급여 · 개인연금</b>입니다. 정확한 국민연금 예상액은 '내 곁에 국민연금' 앱에서 볼 수 있어요.</p>`;
  h+=penBlock("A");
  if(st.hasSpouse) h+=penBlock("B");
  return h;
}

function rPost(){
  let h=`<h2 class="st">은퇴 후</h2><p class="lead">은퇴 후 생활비와 일, 주택연금 계획입니다. 금액은 올해 가치로 넣으면 됩니다.</p>`;
  h+=card("은퇴 후 생활비",F("post.exp","월 생활비 (가구)",{unit:"만원",hint:"지금 물가 기준",i:TIP.postExp})+
    F("post.dropAge","생활비가 줄어드는 나이",{unit:"세",adv:1,hint:"활동 감소"})+F("post.dropPct","그 이후 생활비 비율",{unit:"%",adv:1})+
    F("post.med","만 75세 이후 추가 의료비 (연)",{unit:"만원",adv:1})+
    (adv()?SEG("post.hiAuto","은퇴 후 건강보험료 자동 반영",[[true,"반영"],[false,"제외"]]):"")+
    `<p class="note">은퇴 후 지역가입자 건강보험료(연금소득·주택 기준 근사)${adv()?"와 만 75세 이후 의료비":"와 만 75세 이후 의료비 연 300만원"}가 자동으로 더해집니다.</p>`);
  let w=F("A.side.amt","나 · 월 소득",{unit:"만원",hint:"은퇴 후 일해서 버는 돈",i:TIP.side});
  if(+st.A.side.amt>0) w+=F("A.side.endAge","몇 세까지",{unit:"세"});
  if(st.hasSpouse){ w+=F("B.side.amt","배우자 · 월 소득",{unit:"만원"}); if(+st.B.side.amt>0) w+=F("B.side.endAge","몇 세까지",{unit:"세"}); }
  h+=card("은퇴 후 일 (소일거리)",w,"없으면 0");
  if(st.house.has){
    let hp=SEG("hp.use","주택연금",[[true,"받을 예정"],[false,"안 받음"]]);
    if(st.hp.use){
      hp+=F("hp.age","가입 나이",{unit:"세",hint:st.hasSpouse?"부부 중 연소자 기준":"만 55세 이상",i:TIP.hpAge});
      hp+=SEG("hp.mode","",[["auto","자동 추정"],["manual","직접 입력"]]);
      if(st.hp.mode==="manual") hp+=F("hp.manual","예상 월 수령액",{unit:"만원",hint:"가입 시점 가치"});
      else hp+=`<p class="note">집값 1억원당 월 약 ${E.hpFactor(+st.hp.age).toFixed(1)}만원(만 ${st.hp.age}세, 종신 정액형 근사)으로 계산합니다. 정확한 금액은 한국주택금융공사 예상연금 조회로 확인하세요.</p>`;
    }
    h+=card("주택연금",hp);
  }
  return h;
}

/* ═══════════ 검증 ═══════════ */
function validate(id){
  const out=[], A=st.A, by=+A.birthY, age=Y0-by;
  const bad=(k,m)=>out.push([k,m]);
  if(id==="profile"){
    if(!(by>=1930&&by<=Y0-15)) bad("A.birthY","1930~"+(Y0-15)+" 사이로 넣어 주세요");
    if(A.job!=="none"&&!(+A.retireAge>=40&&+A.retireAge<=85)) bad("A.retireAge","40~85세 사이로 넣어 주세요");
    if(!(+st.endAge>Math.max(+A.retireAge,age)&&+st.endAge<=110)) bad("endAge","은퇴 나이·현재 나이보다 크고 110 이하");
    if(st.hasSpouse&&!(+st.B.birthY>=1930&&+st.B.birthY<=Y0-15)) bad("B.birthY","출생 연도를 확인해 주세요");
    ["A","B"].forEach(K=>{ if(K==="B"&&!st.hasSpouse) return; const f=st[K].future;
      if(st[K].job==="none"&&f.use){
        if(!(+f.startY>=Y0&&+f.startY<=Y0+40)) bad(K+".future.startY",Y0+"~"+(Y0+40)+" 사이");
        if(!(+f.endY>=+f.startY)) bad(K+".future.endY","시작 연도와 같거나 뒤여야 합니다"); } });
    st.kids.forEach((k,i)=>{ if(st.hasKids&&!(+k.y>=1960&&+k.y<=Y0+15)) bad("kids."+i+".y","연도를 확인해 주세요"); });
    if(!(+st.eco.ret>-5&&+st.eco.ret<20)) bad("eco.ret","−5~20% 사이");
  }
  if(id==="incA"||id==="incB"){
    const K=id==="incA"?"A":"B";
    st[K].src.forEach((c,i)=>{ const p=K+".src."+i;
      if(!(+c.amt>0)) bad(p+".amt","금액을 넣어 주세요");
      if(c.startY!==""&&c.endY!==""&&+c.endY<+c.startY) bad(p+".endY","시작 연도보다 뒤여야 합니다");
      if(c.type==="free"&&!(+c.freeExp>=0&&+c.freeExp<95)) bad(p+".freeExp","0~94%");
      if(c.type==="daily"&&!(+c.days>=1&&+c.days<=31)) bad(p+".days","1~31일"); });
  }
  if(id==="asset") st.loans.forEach((L,i)=>{ const p="loans."+i;
    if(!(+L.P>0)) bad(p+".P","잔액을 넣어 주세요");
    if(!(+L.term>0)) bad(p+".term","1년 이상");
    if(+L.grace>+L.term) bad(p+".grace","남은 기간보다 짧아야 합니다");
    if(L.rate==="hybrid"&&!(+L.fixY>0&&+L.fixY<+L.term)) bad(p+".fixY","0보다 크고 남은 기간보다 짧게");
    if(!(+L.r1>=0&&+L.r1<30)) bad(p+".r1","0~30% 사이"); });
  if(id==="pen") ["A","B"].forEach(K=>{ if(K==="B"&&!st.hasSpouse) return; const P=st[K];
    if(+P.pps.age&&+P.pps.age<55) bad(K+".pps.age","만 55세 이상");
    if(P.sev.type!=="none"&&!isPub(K)&&P.job!=="none"&&+P.sev.hireY>Y0) bad(K+".sev.hireY","올해 이전 연도");
    if(P.sev.type==="db"&&P.sev.dbMode==="custom"&&!(+P.sev.a>0)) bad(K+".sev.a","0보다 커야 합니다");
    if(isPub(K)&&P.pen.mode==="auto"&&!(+P.pen.pubStartY>=1960&&+P.pen.pubStartY<=Y0+5)) bad(K+".pen.pubStartY","연도를 확인해 주세요"); });
  if(id==="post"){ if(!(+st.post.exp>0)) bad("post.exp","생활비를 넣어 주세요"); if(st.hp.use&&+st.hp.age<55) bad("hp.age","만 55세 이상"); }
  return out;
}
function showErrors(errs){
  document.querySelectorAll(".fld.err").forEach(f=>{f.classList.remove("err"); const m=f.querySelector(".emsg"); if(m) m.remove();});
  errs.forEach(([k,m])=>{ const f=document.querySelector(`.fld[data-f="${k}"]`); if(!f) return;
    f.classList.add("err"); const s=document.createElement("span"); s.className="emsg"; s.textContent=m; f.querySelector(".lb").appendChild(s); });
  if(errs.length){ const f=document.querySelector(".fld.err"); if(f) f.scrollIntoView({block:"center",behavior:"smooth"}); toast("빨간 칸을 확인해 주세요"); }
}

/* ═══════════ 위저드 렌더 ═══════════ */
function renderStep(keepScroll){
  const list=active(); ui.step=Math.max(0,Math.min(ui.step,list.length-1));
  const S=list[ui.step], y=window.scrollY;
  $("stepBody").innerHTML=S.r();
  $("wzTitle").textContent=S.t;
  $("wzProg").style.width=Math.round((ui.step+1)/list.length*100)+"%";
  $("wzMode").textContent=adv()?"상세":"간편";
  $("wzChips").innerHTML=list.map((s,i)=>`<button class="chip ${i===ui.step?"on":i<=ui.maxStep?"done":""}" data-go="${i}">${i+1}. ${s.t}</button>`).join("");
  const last=ui.step===list.length-1;
  $("btnNext").textContent=last?"결과 보기":"다음";
  if(keepScroll) window.scrollTo(0,y); else window.scrollTo(0,0);
  const cur=document.querySelector(".chip.on"); if(cur&&cur.scrollIntoView) try{cur.scrollIntoView({inline:"center",block:"nearest"});}catch(e){}
}
function go(i){
  const list=active();
  if(i>ui.step){ for(let k=ui.step;k<i;k++){ const e=validate(list[k].id); if(e.length){ if(k!==ui.step){ui.step=k;renderStep();} showErrors(e); return; } } }
  ui.step=i; ui.maxStep=Math.max(ui.maxStep,i); save(); renderStep();
}
function next(){
  const list=active();
  if(ui.step<list.length-1) return go(ui.step+1);
  for(let k=0;k<list.length;k++){ const e=validate(list[k].id); if(e.length){ ui.step=k; renderStep(); showErrors(e); return; } }
  ui.hasResult=true; ui.tab="diag"; save(true); showResult();
}
function setMode(m){ document.body.className="m-"+m; window.scrollTo(0,0); }

/* ═══════════ 입력 이벤트 ═══════════ */
function onJobChange(K){
  const P=st[K], job=ej(K);
  if(job==="none") return;
  P.src[0].type=E.srcTypeOf(job);
  const am={salary:4500,biz:4000,free:4000,daily:15,etc:1200}[P.src[0].type];
  if(P.src[0].type==="daily"&&+P.src[0].amt>100) P.src[0].amt=am;
  if(P.src[0].type!=="daily"&&+P.src[0].amt<100) P.src[0].amt=am;
  P.sev.type=E.sevTypeOf(job);
}
function onKidN(n){ while(st.kids.length<n) st.kids.push({y:st.kids.length?st.kids[st.kids.length-1].y:Y0}); st.kids.length=n; }
function formatMoney(el){
  const raw=el.value, caret=el.selectionStart==null?raw.length:el.selectionStart;
  const dB=(raw.slice(0,caret).match(/\d/g)||[]).length, d=raw.replace(/[^\d]/g,"");
  const out=d?Number(d).toLocaleString("en-US"):"";
  if(out===raw) return; el.value=out;
  let c=0,s=0; while(c<out.length&&s<dB){ if(/\d/.test(out[c]))s++; c++; }
  try{el.setSelectionRange(c,c);}catch(e){}
}
document.addEventListener("input",e=>{
  const el=e.target; if(!el.dataset||!el.dataset.k) return;
  const k=el.dataset.k;
  if(el.hasAttribute("data-money")) formatMoney(el);
  let v;
  if(el.hasAttribute("data-s")) v=el.value;
  else{ const c=el.value.replace(/,/g,"").trim();
    if(c===""){ v=el.hasAttribute("data-opt")?"":""; }
    else{ v=parseFloat(c); if(!isFinite(v)) v=el.hasAttribute("data-opt")?"":0; } }
  set(k,v);
  const f=el.closest(".fld"); if(f&&f.classList.contains("err")){ f.classList.remove("err"); const m=f.querySelector(".emsg"); if(m) m.remove(); }
  if(/^loans\.\d+\.kind$/.test(k)){ const i=+k.split(".")[1], P=E.LOAN_PRESET[v];
    if(P) Object.assign(st.loans[i],{pay:P.pay,rate:P.rate,term:P.term,fixY:P.fix,r1:P.r1,r2:P.r2}); }
  if(k==="A.job"||k==="A.future.job") onJobChange("A");
  if(k==="B.job"||k==="B.future.job") onJobChange("B");
  save();
  if(el.tagName==="SELECT") renderStep(true);
});
document.addEventListener("change",e=>{ const el=e.target; if(el.dataset&&el.dataset.k&&el.hasAttribute("data-r")&&el.tagName!=="SELECT") renderStep(true); });
document.addEventListener("keydown",e=>{
  if(e.key!=="Enter"||!e.target.dataset||!e.target.dataset.k) return;
  e.preventDefault();
  const ins=[...document.querySelectorAll("#stepBody input[data-k]")], i=ins.indexOf(e.target);
  if(ins[i+1]) ins[i+1].focus(); else e.target.blur();
});
document.addEventListener("click",e=>{
  const b=e.target.closest("button"); if(!b) return;
  if(b.dataset.qi){ const t=$(b.dataset.qi); if(t){ t.hidden=!t.hidden; t.hidden?openTips.delete(b.dataset.qi):openTips.add(b.dataset.qi);} return; }
  if(b.dataset.set){
    let v=b.dataset.val; if(v==="__t")v=true; else if(v==="__f")v=false; else if(b.hasAttribute("data-n")) v=+v;
    if(b.dataset.set==="__kidN") onKidN(v);
    else{ set(b.dataset.set,v); if(b.dataset.set==="hasKids"&&v&&!st.kids.length) onKidN(1);
      if(/^[AB]\.future\.use$/.test(b.dataset.set)&&v) onJobChange(b.dataset.set[0]); }
    save(); renderStep(true); return;
  }
  if(b.dataset.add){
    if(b.dataset.add==="loans") st.loans.push(E.newLoan("mortgage"));
    else if(/promoList$/.test(b.dataset.add)){ const arr=get(b.dataset.add); const last=arr[arr.length-1];
      arr.push({y:last?+last.y+5:Y0+3,up:last?last.up:500}); }
    else{ const K=b.dataset.add[0]; st[K].src.push(E.newSrc("etc")); }
    save(); renderStep(true); return;
  }
  if(b.dataset.del){
    const arr=get(b.dataset.del); arr.splice(+b.dataset.i,1); save(); renderStep(true); return;
  }
  if(b.dataset.go!==undefined&&b.classList.contains("chip")){ const i=+b.dataset.go; if(i<=ui.maxStep) {ui.step=i;renderStep();} else go(i); return; }
  if(b.dataset.tab){ ui.tab=b.dataset.tab; renderResult(); window.scrollTo(0,0); return; }
});
st.kids=st.kids||[];

/* ═══════════ 결과 ═══════════ */
let R=null;
function showResult(){ setMode("result"); renderResult(); }
const real=(v,Y)=>v/Math.pow(1+R.infl,Y-Y0);
const LV={g:"양호",y:"보통",r:"주의",n:"—"};

const TABS=[["diag","진단",'<path d="M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zm0 4v5l3 2"/>'],
  ["flow","현금흐름",'<path d="M4 19V9M10 19V5M16 19v-7M22 19H2"/>'],
  ["asset","자산",'<path d="M3 10l9-6 9 6v10H3z"/><path d="M9 20v-6h6v6"/>'],
  ["pen","연금",'<rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10h18M7 15h4"/>'],
  ["plan","개선",'<path d="M4 20l6-6 4 4 6-8"/><path d="M14 10h6v6"/>']];
function renderResult(){
  try{ R=E.compute(st); }catch(err){ $("resBody").innerHTML=card("계산 오류",`<p class="note">${esc(err.message)}</p>`); return; }
  $("tabRow").innerHTML=TABS.map(([k,l,ic])=>`<button data-tab="${k}" class="${ui.tab===k?"on":""}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${ic}</svg>${l}</button>`).join("");
  const panes={diag:pDiag,flow:pFlow,asset:pAsset,pen:pPen,plan:pPlan};
  $("resBody").innerHTML=pHero()+TABS.map(([k])=>`<div class="pane${ui.tab===k?" on":""}" data-pane="${k}">${panes[k]()}</div>`).join("");
  bindResult();
}
function pHero(){
  const A=R.people[0], rAge=A.retireAge;
  const h2=R.depleteAge===null?`만 ${rAge}세에 은퇴해도 만 ${R.endAge}세까지 자산이 유지됩니다`:`만 ${rAge}세에 은퇴하면 만 ${R.depleteAge}세에 금융자산이 바닥납니다`;
  const have=real(R.haveAtR,R.rY);
  return `<div class="hero ${R.overall}"><span class="tag">● 노후 준비 ${LV[R.overall]}</span><h2>${h2}</h2>
    <div class="kp"><div><b>은퇴 시 준비자산</b><span>${eok(have)}</span><small>올해 가치</small></div>
    <div><b>월 연금 합계</b><span>${eok(R.penIncReal/12)}</span><small>올해 가치</small></div>
    <div><b>준비율</b><span>${R.ratio>=9.9?"충분":Math.round(R.ratio*100)+"%"}</span><small>100% 이상 양호</small></div></div></div>`;
}
function pDiag(){
  let h=card("항목별 진단",R.lights.map(l=>`<div class="light"><i class="lamp ${l.lv}"></i><div class="tx"><div class="t">${l.t}<span class="${l.lv}">${esc(l.val)}</span></div>
    <p>${esc(l.desc)}</p>${l.tip?`<div class="tip">${esc(l.tip)}</div>`:""}</div></div>`).join(""),"초록 양호 · 노랑 보통 · 빨강 주의");
  const A=R.people[0];
  h+=card("계산 기준",`<div class="kv"><span>은퇴</span><span>${A.retireY}년 · 만 ${A.retireAge}세</span></div>
    <div class="kv"><span>물가 / 운용수익률</span><span>${st.eco.infl}% / ${st.eco.ret}%</span></div>
    <div class="kv"><span>은퇴 후 생활비</span><span>월 ${(+st.post.exp).toLocaleString()}만원 (올해 가치)</span></div>
    <p class="note">'올해 가치'는 물가상승을 빼고 지금 돈으로 환산한 금액입니다. 세금·건강보험료는 근사치이며 실제와 차이가 있을 수 있습니다.</p>`);
  return h;
}
/* 선 그래프 */
function lineChart(series,o){
  o=o||{}; const W=640,H=o.h||230,P={t:12,r:10,b:24,l:52};
  const xs=series[0].pts.map(p=>p.x), x0=Math.min(...xs), x1=Math.max(...xs);
  let y0=0,y1=0; series.forEach(s=>s.pts.forEach(p=>{y0=Math.min(y0,p.y);y1=Math.max(y1,p.y);}));
  const pad=(y1-y0)*.08||1; y1+=pad; if(y0<0) y0-=pad;
  const X=v=>P.l+(v-x0)/((x1-x0)||1)*(W-P.l-P.r), Y=v=>H-P.b-(v-y0)/((y1-y0)||1)*(H-P.t-P.b);
  const fmt=v=>{const a=Math.abs(v); return a>=1e8?(v/1e8).toFixed(a>=1e9?0:1)+"억":Math.round(v/1e4).toLocaleString()+"만";};
  let g="";
  for(let i=0;i<=4;i++){const v=y0+(y1-y0)*i/4; g+=`<line x1="${P.l}" x2="${W-P.r}" y1="${Y(v)}" y2="${Y(v)}" stroke="var(--line)"/><text x="${P.l-6}" y="${Y(v)+4}" text-anchor="end" font-size="11" fill="var(--ink3)">${fmt(v)}</text>`;}
  if(y0<0) g+=`<line x1="${P.l}" x2="${W-P.r}" y1="${Y(0)}" y2="${Y(0)}" stroke="var(--ink3)"/>`;
  const step=Math.max(1,Math.round((x1-x0)/5));
  for(let v=x0;v<=x1;v+=step) g+=`<text x="${X(v)}" y="${H-6}" text-anchor="middle" font-size="11" fill="var(--ink3)">${o.xl?o.xl(v):v}</text>`;
  if(o.mark!=null&&o.mark>=x0&&o.mark<=x1) g+=`<line x1="${X(o.mark)}" x2="${X(o.mark)}" y1="${P.t}" y2="${H-P.b}" stroke="var(--y)" stroke-dasharray="4 3"/><text x="${X(o.mark)+4}" y="${P.t+10}" font-size="11" fill="var(--y)">은퇴</text>`;
  series.forEach(s=>{ const d=s.pts.map((p,i)=>(i?"L":"M")+X(p.x).toFixed(1)+" "+Y(p.y).toFixed(1)).join(" ");
    if(s.fill) g+=`<path d="${d} L${X(x1)} ${Y(Math.max(0,y0))} L${X(x0)} ${Y(Math.max(0,y0))}Z" fill="${s.c}" opacity=".13"/>`;
    g+=`<path d="${d}" fill="none" stroke="${s.c}" stroke-width="${s.w||2.2}" stroke-linejoin="round"${s.dash?' stroke-dasharray="5 4"':""}/>`; });
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(o.label||"차트")}">${g}</svg>`;
}
/* 연도별 계산 과정: 수입 → 지출 → 금융자산 */
function rowDetail(r,rv,m){
  const M=v=>m(rv(v,r.Y));
  const row=(l,v,c)=>`<div class="kv ${c||""}"><span>${l}</span><span>${v}</span></div>`;
  const two=R.people.length>1;
  let h=r.events.length?`<div class="evs">${r.events.map(e=>`<span class="evc">${esc(e)}</span>`).join("")}</div>`:"";
  /* 수입 */
  h+=`<div class="sec">① 수입</div>`;
  if(r.gross>0){
    const [a,b]=r.grossBy;
    if(two&&a>0&&b>0) h+=row("세전 소득 <small>나 + 배우자</small>",`${M(a)} + ${M(b)} = <b>${M(r.gross)}</b>`);
    else h+=row("세전 소득"+(two?` <small>${a>0?"나":"배우자"}</small>`:""),M(r.gross));
    h+=row("− 4대보험 · 연금 기여금",M(r.soc),"ind")+row("− 소득세 · 지방세",M(r.tax),"ind")+row("= 세후 근로·사업소득",`<b>${M(r.netWork)}</b>`,"sum");
  }
  if(r.pubPen) h+=row("+ 공적연금",M(r.pubPen));
  if(r.priv) h+=row("+ 퇴직연금 · 개인연금",M(r.priv));
  if(r.hp) h+=row("+ 주택연금",M(r.hp));
  if(r.penTax) h+=row("− 연금소득세",M(r.penTax),"ind");
  h+=row("수입 합계",`<b>${M(r.income)}</b>`,"tot");
  /* 지출 */
  const lv=r.lv, fixTot=(lv.kind==="detail"?lv.fix:0)+r.loan+r.kid;
  h+=`<div class="sec">② 지출</div>`;
  h+=`<button type="button" class="kv tog" data-spend><span>지출 합계 <i>${ui.openSpend?"접기 ▴":"내역 보기 ▾"}</i></span><span><b>${M(r.spend)}</b></span></button>`;
  if(ui.openSpend){
    let d="";
    if(lv.kind==="detail"){
      d+=row("고정지출",`<b>${M(fixTot)}</b>`);
      d+=row("· 생활 고정비",M(lv.fix),"ind");
      if(r.loan) d+=row("· 대출 상환",`${M(r.loan)} <small>(이자 ${M(r.loanInt)} + 원금 ${M(r.loanPrin)})</small>`,"ind");
      if(r.kid) d+=row("· 자녀 교육비 · 용돈",M(r.kid),"ind");
      d+=row("변동지출",`<b>${M(lv.var)}</b>`);
      d+=row("연간 지출 <small>여행·경조사·명절</small>",`<b>${M(lv.ann)}</b>`);
    } else if(lv.kind==="simple"){
      d+=row("생활비 <small>간편 입력 총액</small>",`<b>${M(lv.base)}</b>`);
      if(fixTot) d+=row("고정지출",`<b>${M(fixTot)}</b>`);
      if(r.loan) d+=row("· 대출 상환",`${M(r.loan)} <small>(이자 ${M(r.loanInt)} + 원금 ${M(r.loanPrin)})</small>`,"ind");
      if(r.kid) d+=row("· 자녀 교육비 · 용돈",M(r.kid),"ind");
      d+=`<p class="note">상세 모드에서 생활비를 입력하면 고정·변동지출로 나눠 보여 드립니다.</p>`;
    } else {
      d+=row("은퇴 후 생활비",`<b>${M(lv.base)}</b>`);
      if(lv.med) d+=row("의료비 (만 75세 이후)",M(lv.med));
      if(r.hiLocal) d+=row("지역 건강보험료",M(r.hiLocal));
      if(r.loan) d+=row("대출 상환",`${M(r.loan)} <small>(이자 ${M(r.loanInt)})</small>`);
      if(r.kid) d+=row("자녀 비용",M(r.kid));
    }
    if(lv.kind!=="post"&&r.hiLocal) d+=row("지역 건강보험료",M(r.hiLocal));
    if(r.ppsSave) d+=row("연금저축 · IRP 납입 <small>저축</small>",M(r.ppsSave));
    h+=`<div class="spd">${d}</div>`;
  }
  /* 자산 */
  h+=`<div class="sec">③ 금융자산</div>`;
  h+=row("연초 금융자산",M(r.finStart))+row("+ 운용수익 <small>"+(R.ret*100).toFixed(1)+"%</small>",M(r.retInc),"ind")+
     row((r.net>=0?"+ ":"− ")+"수입 − 지출",M(Math.abs(r.net)),"ind");
  if(r.lump) h+=row("+ 퇴직급여 일시금 <small>세후</small>",M(r.lump),"ind");
  h+=row("= 연말 금융자산",`<b>${M(r.fin)}</b>`,"tot");
  if(ui.real) h+=`<p class="note">올해 가치 보기에서는 금액을 해마다 물가로 나눠 표시해, 연초 금액이 윗줄 연말 금액과 조금 다를 수 있습니다.</p>`;
  return h;
}
function pFlow(){
  const rv=(v,Y)=>ui.real?real(v,Y):v;
  const pts=R.rows.map(r=>({x:r.ageA,y:rv(r.fin,r.Y)}));
  let h=card("금융자산 추이",lineChart([{pts,c:"var(--acc)",fill:true}],{mark:R.people[0].retireAge,xl:v=>v+"세",label:"금융자산"})+
    `<div class="legend"><span><i style="background:var(--acc)"></i>금융자산 (${ui.real?"올해 가치":"명목"})</span></div>`,"나이별");
  const m=v=>Math.round(v/1e4).toLocaleString();
  let t=`<table class="t"><thead><tr><th>연도·나이</th><th>근로·사업(세후)</th><th>연금</th><th>지출</th><th>순흐름</th><th>금융자산</th></tr></thead><tbody>`;
  R.rows.forEach((r,i)=>{
    const pen=r.pubPen+r.priv+r.hp-r.penTax, cls=[r.phase==="post"?"post":"",r.events.length?"ev":"",r.fin<0?"neg":""].join(" ");
    const evt=r.events.length?`<small class="evt">${esc(r.events[0])}${r.events.length>1?" 외 "+(r.events.length-1):""}</small>`:"";
    t+=`<tr class="${cls}" data-row="${i}"><td>${r.Y} · ${r.ageA}${evt}</td><td>${r.netWork?m(rv(r.netWork,r.Y)):"—"}</td><td>${pen>0?m(rv(pen,r.Y)):"—"}</td>
      <td>${m(rv(r.spend,r.Y))}</td><td class="${r.net+r.lump>=0?"pos":"neg"}">${m(rv(r.net+r.lump,r.Y))}</td><td class="f"><b>${m(rv(r.fin,r.Y))}</b></td></tr>`;
    if(ui.openRow===i) t+=`<tr class="det"><td colspan="6"><div class="dw">${rowDetail(r,rv,m)}</div></td></tr>`;
  });
  t+="</tbody></table>";
  h+=card("연도별 현금흐름",`<div class="seg noprint" style="margin-bottom:8px"><button data-real="1" class="${ui.real?"on":""}">올해 가치</button><button data-real="0" class="${!ui.real?"on":""}">명목 금액</button></div>
    <div class="tblw">${t}</div><p class="note">단위 만원 · <b>행을 누르면 계산 과정</b>이 펼쳐집니다 · 회색 줄은 은퇴 후 · 노란 글씨는 그해 일어나는 일</p>
    ${ui.real?`<p class="note">'올해 가치'는 물가를 빼고 지금 돈으로 바꾼 금액이라 연봉 인상분이 실제보다 작아 보입니다. 실제 받는 금액은 '명목 금액'으로 보세요.</p>`:""}`);
  return h;
}
function pAsset(){
  const rY=R.rY, rv=v=>real(v,rY);
  const parts=[[R.finAtR,"var(--acc)","금융자산"],[R.sevLumpTot,"var(--y)","퇴직급여 (세후)"],[R.ppsAtR,"#6C8EBF","개인연금 적립"]].filter(p=>p[0]>0);
  const tot=parts.reduce((a,p)=>a+p[0],0)||1;
  let h=card("은퇴 시점 준비자산",`<div class="stack">${parts.map(p=>`<i style="width:${p[0]/tot*100}%;background:${p[1]}"></i>`).join("")}</div>
    <div class="legend">${parts.map(p=>`<span><i style="background:${p[1]}"></i>${p[2]}</span>`).join("")}</div>
    ${parts.map(p=>`<div class="kv"><span>${p[2]}</span><span>${eok(rv(p[0]))}</span></div>`).join("")}
    <div class="kv tot"><span>합계 (올해 가치)</span><span>${eok(rv(R.haveAtR))}</span></div>
    <div class="kv ind"><span>명목 금액 (${rY}년)</span><span>${eok(R.haveAtR)}</span></div>
    <div class="kv"><span>은퇴 후 연금으로 못 메우는 생활비 합계</span><span>${eok(rv(R.need))}</span></div>
    <p class="note">필요액은 은퇴 후 연도별 지출에서 근로소득·공적연금·주택연금을 빼고 남는 부족분을 은퇴 시점 가치로 합한 금액입니다.</p>`,R.rY+"년 기준");
  if(st.house.has){
    const r=R.rows.find(x=>x.Y===rY)||R.rows[0];
    h+=card("주택",`<div class="kv"><span>은퇴 시 예상 시세</span><span>${eok(rv(r.house))}</span></div>
      <div class="kv ind"><span>명목</span><span>${eok(r.house)}</span></div>
      <p class="note">주택은 노후 자금 계산(자산 고갈 나이)에는 포함하지 않았습니다.${st.hp.use?" 대신 주택연금을 노후 소득에 반영했습니다.":" 주택연금을 켜면 월 수령액이 노후 소득에 더해집니다."}</p>`);
  }
  const lr=R.rows.filter(r=>r.loan>0);
  if(lr.length){
    const ti=R.rows.reduce((a,r)=>a+r.loanInt,0);
    h+=card("대출",`<div class="kv"><span>완납 예상</span><span>${lr[lr.length-1].Y}년 (만 ${lr[lr.length-1].ageA}세)</span></div>
      <div class="kv"><span>남은 이자 총액 (명목)</span><span>${eok(ti)}</span></div>
      <div class="kv"><span>은퇴 시점 잔액</span><span>${R.debtAtR>0?eok(R.debtAtR):"없음"}</span></div>
      ${lineChart([{pts:R.rows.filter(r=>r.Y<=lr[lr.length-1].Y+1).map(r=>({x:r.Y,y:r.loanBal})),c:"var(--r)",fill:true}],{h:170,label:"대출 잔액"})}`);
  }
  const tg=R.rows.filter(r=>r.phase==="pre");
  if(tg.length){
    const sum=k=>tg.reduce((a,r)=>a+r[k],0);
    h+=card("은퇴 전 합계",`<div class="kv"><span>세전 소득</span><span>${eok(sum("gross"))}</span></div>
      <div class="kv ind"><span>4대보험·기여금</span><span>${eok(sum("soc"))}</span></div><div class="kv ind"><span>소득세</span><span>${eok(sum("tax"))}</span></div>
      <div class="kv"><span>생활비</span><span>${eok(sum("living"))}</span></div>${sum("kid")?`<div class="kv"><span>자녀 비용</span><span>${eok(sum("kid"))}</span></div>`:""}
      ${sum("loan")?`<div class="kv"><span>대출 상환</span><span>${eok(sum("loan"))}</span></div>`:""}
      <p class="note">${tg.length}년간 명목 합계입니다.</p>`,Y0+"~"+(R.retireY-1)+"년");
  }
  return h;
}
function pPen(){
  const names=R.people.map(P=>P.k==="A"?"나":"배우자");
  const mreal=(ann,Y)=>eok(real(ann,Y)/12);
  let h="";
  R.people.forEach((P,i)=>{
    const n=R.pens[i].nps, pb=R.pens[i].pub, sv=R.sevs[i], rows=[];
    if(pb){ const nm=pb.kind==="mil"?"군인연금":"공무원·사학연금";
      rows.push(`<div class="sec">${nm}</div>`+(pb.eligible?`<div class="kv"><span>월 수령액 (올해 가치)</span><span>${mreal(pb.annualAtPay,pb.payY)}</span></div>
        <div class="kv ind"><span>개시 시점 명목</span><span>${eok(pb.annualAtPay/12)}</span></div>
        <div class="kv"><span>개시</span><span>${pb.payY}년 · 만 ${pb.payY-P.birthY}세</span></div>
        <div class="kv"><span>재직기간</span><span>${pb.yrs}년</span></div>`:`<p class="note">재직기간 ${pb.yrs}년으로 수급 요건(${pb.kind==="mil"?"20":"10"}년) 미달</p>`)); }
    if(!pb||n.P>0||n.manual){
      rows.push(`<div class="sec">국민연금</div>`+(n.eligible?`<div class="kv"><span>월 수령액 (올해 가치)</span><span>${mreal(n.annualAtPay,n.payY)}</span></div>
        <div class="kv ind"><span>개시 시점 명목</span><span>${eok(n.annualAtPay/12)}</span></div>
        <div class="kv"><span>개시</span><span>${n.payY}년 · 만 ${n.payAge}세${n.payAge!==n.normal?(n.payAge<n.normal?" (조기 ":" (연기 ")+Math.round((n.adj-1)*1000)/10+"%)":""}</span></div>
        ${n.manual?`<div class="kv"><span>산정</span><span>직접 입력</span></div>`:`<div class="kv"><span>가입기간</span><span>${Math.floor(n.P/12)}년 ${n.P%12}개월</span></div>
        <div class="kv"><span>평균소득 B값 (올해 가치)</span><span>${eok(n.B)}</span></div>`}`
        :`<p class="note">가입기간 ${Math.floor((n.P||0)/12)}년 ${(n.P||0)%12}개월 — 10년 미만이라 연금이 나오지 않습니다. 임의가입·추후납부로 채울 수 있어요.</p>`));
    }
    if(i===0&&R.depPen>0) rows.push(`<div class="kv ind"><span>배우자 부양가족연금 포함</span><span>연 약 30만원</span></div>`);
    if(sv.gross>0){
      const nm=sv.type==="pub"?"퇴직수당":sv.type==="dc"?"퇴직연금 (DC)":"퇴직금 (DB)";
      rows.push(`<div class="sec">${nm}</div><div class="kv"><span>세전 (명목)</span><span>${eok(sv.gross)}</span></div>
        <div class="kv ind"><span>퇴직소득세${sv.recv==="annuity"&&sv.type!=="pub"?" (연금수령 30% 감면)":""}</span><span>${eok(sv.recv==="annuity"&&sv.type!=="pub"?sv.annTax:sv.tax)}</span></div>
        <div class="kv"><span>수령 방식</span><span>${sv.recv==="annuity"&&sv.type!=="pub"?sv.years+"년 연금":"일시금"}</span></div>
        <div class="kv"><span>올해 가치</span><span>${eok(real(sv.gross,P.retireY))}</span></div>`);
    }
    const pp=st[P.k].pps;
    if(+pp.open+ +pp.save>0){
      const first=R.rows.find(r=>r.Y>=Math.max(P.retireY,P.birthY+ +pp.age)&&r.priv>0);
      rows.push(`<div class="sec">개인연금</div><div class="kv"><span>수령 시작</span><span>만 ${Math.max(P.retireAge,+pp.age)}세부터 ${pp.years}년</span></div>
        ${first?`<div class="kv"><span>첫해 월 수령 (올해 가치, 가구 합산)</span><span>${eok(real(first.priv,first.Y)/12)}</span></div>`:""}`);
    }
    h+=card(names[i],rows.join("")||`<p class="note">등록된 연금이 없습니다.</p>`);
  });
  if(R.hpMonthly>0) h+=card("주택연금",`<div class="kv"><span>월 수령액 (올해 가치)</span><span>${eok(real(R.hpMonthly,R.hpStartY))}</span></div>
    <div class="kv ind"><span>가입 시점 명목 (평생 고정)</span><span>${eok(R.hpMonthly)}</span></div>
    <div class="kv"><span>가입</span><span>${R.hpStartY}년</span></div><p class="note">정액형은 명목 금액이 고정이라 시간이 지나면 실질 가치가 줄어듭니다.</p>`);
  const post=R.rows.filter(r=>r.phase==="post");
  if(post.length){
    const s=[{pts:post.map(r=>({x:r.ageA,y:real(r.pubPen+r.priv+r.hp,r.Y)/12})),c:"var(--acc)",fill:true},
             {pts:post.map(r=>({x:r.ageA,y:real(r.spend,r.Y)/12})),c:"var(--r)",dash:true}];
    h+=card("은퇴 후 월 연금 vs 지출",lineChart(s,{xl:v=>v+"세",h:200,label:"연금과 지출"})+
      `<div class="legend"><span><i style="background:var(--acc)"></i>월 연금 합계</span><span><i style="background:var(--r)"></i>월 지출</span></div><p class="note">올해 가치 · 두 선의 차이만큼 금융자산에서 꺼내 씁니다.</p>`);
  }
  return h;
}
function pPlan(){
  const o=ui.ov, R2=E.compute(st,o), base=R;
  const desc=x=>x.depleteAge===null?"만 "+x.endAge+"세까지 유지":"만 "+x.depleteAge+"세 소진";
  const sl=(k,l,min,max,step,fmt)=>`<div class="slider"><div class="t"><span>${l}</span><b>${fmt(o[k])}</b></div>
    <input type="range" data-ov="${k}" min="${min}" max="${max}" step="${step}" value="${o[k]}"></div>`;
  const sg=v=>(v>0?"+":"")+v;
  let h=card("이렇게 바꾸면?",
    sl("retireAdd","은퇴 나이",-5,7,1,v=>"만 "+(+st.A.retireAge+ +v)+"세 ("+sg(v)+"년)")+
    sl("save","은퇴 전 월 추가 저축",0,300,10,v=>v+"만원")+
    sl("postAdd","은퇴 후 월 생활비",-150,150,10,v=>(+st.post.exp+ +v)+"만원 ("+sg(v)+")")+
    sl("retAdd","운용수익률",-2,3,0.5,v=>(+st.eco.ret+ +v).toFixed(1)+"% ("+sg(v)+"%p)")+
    `<button class="tbtn noprint" data-reset-ov>원래 값으로</button>`,"슬라이더를 움직여 보세요");
  const box=(x,cls,t)=>`<div class="${cls}"><b>${t}</b><span style="color:var(--${x.overall})">● ${LV[x.overall]}</span><small>${desc(x)}</small><small>준비율 ${x.ratio>=9.9?"충분":Math.round(x.ratio*100)+"%"}</small></div>`;
  h+=card("비교",`<div class="cmp">${box(base,"","지금 계획")}${box(R2,"after","바꾼 계획")}</div>`);
  const tips=[];
  if(base.lights.find(l=>l.id==="layer"&&l.lv!=="g")&&!(+st.A.pps.save>0)) tips.push("연금저축·IRP에 연 600만원을 넣으면 세액공제로 연 79만~99만원을 돌려받으면서 노후 연금이 생깁니다.");
  if(base.gapYears>0) tips.push("은퇴 후 공적연금까지 "+base.gapYears+"년 공백이 있습니다. 개인연금 수령 시작을 은퇴 직후로 맞추거나 은퇴 후 근로소득을 넣어 보세요.");
  if(base.debtAtR>0) tips.push("은퇴 시점에 대출 "+eok(base.debtAtR)+"이 남습니다. 은퇴 전 중도상환 계획을 세워 보세요.");
  if(st.house.has&&!st.hp.use&&base.depleteAge!==null) tips.push("주택연금을 켜면 집에 살면서 월 연금을 받을 수 있습니다. '은퇴 후' 단계에서 켜 보세요.");
  if(tips.length) h+=card("추천 점검",tips.map(t=>`<div class="light"><i class="lamp y"></i><div class="tx"><p style="margin:0;color:var(--ink)">${t}</p></div></div>`).join(""));
  return h;
}
function bindResult(){
  document.querySelectorAll("[data-row]").forEach(tr=>tr.onclick=()=>{ const i=+tr.dataset.row; ui.openRow=ui.openRow===i?null:i; const y=window.scrollY; renderResult(); window.scrollTo(0,y); });
  document.querySelectorAll("[data-spend]").forEach(b=>b.onclick=e=>{ e.stopPropagation(); ui.openSpend=!ui.openSpend; const y=window.scrollY; renderResult(); window.scrollTo(0,y); });
  document.querySelectorAll("[data-real]").forEach(b=>b.onclick=()=>{ ui.real=b.dataset.real==="1"; const y=window.scrollY; renderResult(); window.scrollTo(0,y); });
  let rt=null;
  document.querySelectorAll("[data-ov]").forEach(s=>s.oninput=()=>{ ui.ov[s.dataset.ov]=+s.value;
    s.closest(".slider").querySelector("b").textContent="…";
    clearTimeout(rt); rt=setTimeout(()=>{ const y=window.scrollY; renderResult(); window.scrollTo(0,y); },60); });
  const r=document.querySelector("[data-reset-ov]"); if(r) r.onclick=()=>{ ui.ov={retireAdd:0,save:0,postAdd:0,retAdd:0}; renderResult(); };
}

/* ═══════════ 메뉴 · 백업 ═══════════ */
function toast(m){ const t=$("toast"); t.textContent=m; t.classList.add("on"); clearTimeout(t._t); t._t=setTimeout(()=>t.classList.remove("on"),2200); }
function sheet(on){ $("sheet").classList.toggle("on",on); }
$("rsMenu").onclick=()=>sheet(true);
$("sheet").addEventListener("click",e=>{
  if(e.target.hasAttribute("data-close")) return sheet(false);
  const a=e.target.dataset.act; if(!a) return; sheet(false);
  if(a==="print"){ const old=ui.tab; setTimeout(()=>window.print(),150); }
  if(a==="export"){
    const blob=new Blob([JSON.stringify({v:APP_VER,st},null,2)],{type:"application/json"});
    const u=URL.createObjectURL(blob), l=document.createElement("a");
    l.href=u; l.download="노후계산기_백업_"+new Date().toISOString().slice(0,10)+".json"; document.body.appendChild(l); l.click(); l.remove();
    setTimeout(()=>URL.revokeObjectURL(u),2000); toast("백업 파일을 저장했습니다");
  }
  if(a==="import") $("fileIn").click();
  if(a==="reset"&&confirm("입력값을 모두 지우고 처음부터 시작할까요?")){ try{localStorage.removeItem(KEY);}catch(e){} location.reload(); }
});
$("fileIn").onchange=e=>{ const f=e.target.files[0]; if(!f) return;
  const fr=new FileReader(); fr.onload=()=>{ try{ const o=JSON.parse(fr.result); st=fixArrays(merge(E.defaults(),o.st||o)); ui.hasResult=true; save(true); showResult(); toast("백업을 불러왔습니다"); }catch(err){ toast("파일을 읽지 못했습니다"); } };
  fr.readAsText(f,"utf-8"); e.target.value=""; };

/* ═══════════ 버튼 ═══════════ */
$("btnStart").onclick=()=>{ if(ui.hasResult&&!confirm("처음 단계부터 다시 볼까요? (입력값은 유지됩니다)")) return; ui.step=0; setMode("wizard"); renderStep(); };
$("btnResume").onclick=()=>{ setMode("wizard"); renderStep(); };
$("btnSeeResult").onclick=showResult;
$("btnPrev").onclick=()=>{ if(ui.step===0){ setMode("cover"); refreshCover(); } else { ui.step--; save(); renderStep(); } };
$("wzBack").onclick=$("btnPrev").onclick;
$("btnNext").onclick=next;
$("wzMode").onclick=()=>{ st.mode=adv()?"simple":"detail"; save(); renderStep(true); toast(adv()?"상세 모드: 세부 항목이 보입니다":"간편 모드: 상세 입력값은 그대로 유지됩니다"); };
$("rsEdit").onclick=()=>{ ui.step=0; setMode("wizard"); renderStep(); };

/* ═══════════ 설치 안내 · 서비스워커 ═══════════ */
const standalone=window.matchMedia&&window.matchMedia("(display-mode: standalone)").matches||window.navigator.standalone===true;
let deferred=null;
window.addEventListener("beforeinstallprompt",e=>{ e.preventDefault(); deferred=e; $("btnInstall").style.display=""; });
$("btnInstall").onclick=async()=>{ if(!deferred) return; deferred.prompt(); try{ await deferred.userChoice; }catch(e){} deferred=null; $("btnInstall").style.display="none"; };
function refreshCover(){
  const has=!!localStorage.getItem(KEY);
  $("btnResume").style.display=has&&!ui.hasResult?"":"none";
  $("btnSeeResult").style.display=ui.hasResult?"":"none";
  $("btnStart").textContent=ui.hasResult?"입력 다시 보기":"시작하기";
  const ios=/iphone|ipad|ipod/i.test(navigator.userAgent)||(navigator.platform==="MacIntel"&&navigator.maxTouchPoints>1);
  const tip=$("installTip");
  if(!standalone&&ios){ tip.style.display="block"; tip.innerHTML="<b>아이폰에 앱처럼 설치하기</b><br>Safari 아래쪽 <b>공유 버튼(□↑)</b> → <b>홈 화면에 추가</b>를 누르세요."; }
}
if("serviceWorker" in navigator&&location.protocol!=="file:"){
  window.addEventListener("load",()=>{ navigator.serviceWorker.register("sw.js").then(reg=>{
    reg.addEventListener("updatefound",()=>{ const w=reg.installing; if(!w) return;
      w.addEventListener("statechange",()=>{ if(w.state==="installed"&&navigator.serviceWorker.controller) toast("새 버전이 준비됐습니다. 앱을 다시 열면 적용됩니다."); }); });
  }).catch(()=>{}); });
}

/* ═══════════ 시작 ═══════════ */
$("verTxt").textContent="v"+APP_VER;
load();
refreshCover();
setMode("cover");
})();
