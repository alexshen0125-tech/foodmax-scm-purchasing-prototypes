/* Food Max 商家端 v2 · 平台活动（商家报名招商 + 单活动效果分析）
   与 PC pc-modules/enroll.js 同一套口径（母方案：飞书《平台化营销产品方案》v0.1）：
     · 招商活动（母）由运营创建：允许玩法 + 参数范围 / 出资规则 / 准入门槛 / 报名窗口 / 活动期；商家在约束内提交报名单（子）
     · 一期玩法：特价（活动价=未税、按 SKU）· 满减（活动级 满 X 减 Y）；选品粒度 = SKU；报名主体 = 登录店铺
     · 准入前置：可报名列表先按门槛算，不符合置灰给原因；玩法参数按母活动推荐值预填、越界前端即拦
     · 承诺库存 = 活动期总量（件），≥ 母活动最低承诺，不锁日常库存；出资来自母活动（平台 / 商家 / 共担）
     · 状态：草稿 → 已提交(预筛) → 预筛未过 / 待终审 → 已驳回 / 已通过（待生效 / 进行中 / 已结束）；旁支：撤回、平台下架
     · 终审粒度 = 商品行（部分通过）；驳回 / 预筛未过后「修改并重报」= 原单新版本
     · 效果分析只给商家自己看：卖了多少 / 花了多少 / 值不值 + 商品明细；进行中每小时更新、结束 T+1 定版
   复用 promo.js 的 pm-* / pk-* 样式与本店 SKU 镜像（window.FM_PROMO_SKUS） */
(function(){
const {pushPage,popPage,toast,confirmDialog,svg,skel}=window.FM;
const css=document.createElement('style');
css.textContent=`
.en-gate{margin-top:9px;padding:8px 10px;border-radius:10px;background:var(--amber-soft);color:#B45309;font-size:12.5px;line-height:1.5;}
.en-gate.ok{background:var(--mint-soft);color:var(--emerald-2);}
.en-chip{display:inline-block;font-size:11px;font-weight:700;padding:2px 8px;border-radius:20px;margin-right:4px;vertical-align:middle;}
.en-chip.sp{background:var(--red-soft);color:var(--red);}.en-chip.fc{background:#E1EBFF;color:#2563EB;}
.en-kpi{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:12px 16px 0;}
.en-kpi .c{background:#fff;border-radius:16px;padding:12px 14px;box-shadow:var(--sh-sm);}
.en-kpi .c .l{font-size:11.5px;color:var(--sub);}.en-kpi .c .v{font-size:20px;font-weight:600;font-family:'Lora',serif;margin-top:3px;}.en-kpi .c .s{font-size:11px;color:var(--sub);margin-top:2px;}
.en-kpi .c.hl{background:var(--mint-soft);}.en-kpi .c.hl .v{color:var(--emerald-2);}
.en-sec{margin:14px 16px 4px;font-size:13.5px;font-weight:700;}
.en-chart{background:#fff;border-radius:16px;margin:10px 16px 0;padding:10px 12px 4px;box-shadow:var(--sh-sm);}
.en-chart .t{display:flex;justify-content:space-between;font-size:11.5px;color:var(--sub);margin-bottom:4px;}
.en-step{display:flex;justify-content:space-between;margin:12px 16px 0;padding:12px 6px;background:#fff;border-radius:16px;box-shadow:var(--sh-sm);}
.en-step .s{flex:1;text-align:center;font-size:10.5px;color:var(--sub);position:relative;}
.en-step .s i{display:block;width:22px;height:22px;border-radius:50%;margin:0 auto 4px;line-height:22px;font-style:normal;font-size:11px;font-weight:700;background:var(--muted);color:var(--sub);}
.en-step .s.done i{background:var(--emerald);color:#fff;}.en-step .s.cur i{background:#fff;border:2px solid var(--emerald);color:var(--emerald);line-height:18px;}.en-step .s.rej i{background:var(--red);color:#fff;}
.en-step .s.cur{color:var(--ink);font-weight:700;}
.en-chk{display:flex;gap:8px;align-items:flex-start;padding:8px 0;border-bottom:1px solid var(--line);font-size:12.5px;}
.en-chk:last-child{border-bottom:none;}.en-chk .k{flex:0 0 84px;color:var(--sub);}.en-chk .v{flex:1;}
`;
document.head.appendChild(css);

const pad=n=>(''+n).padStart(2,'0');
const fmt=d=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
const shift=(days,h,m)=>{const d=new Date();d.setDate(d.getDate()+days);d.setHours(h,m||0,0,0);return fmt(d);};
const dayStr=days=>shift(days,0,0).slice(0,10);
const now=()=>fmt(new Date());
const md=s=>s.slice(5,10);
const money=n=>'S$'+(+n||0).toFixed(2);
const num=n=>(+n||0).toLocaleString('en-US');
const pct=x=>Math.round(x*100)+'%';
const WHO='陈志强';let ADMIN=true;const noPerm=()=>{toast('仅店铺管理员可操作，子账号只读');return false;};
const RATE=0.09,SVC=0.05,PICKUP=0.00;
let SEQ=930;

/* ===== 本店 SKU（与 promo.js 同一镜像；品类统一为豆制品） ===== */
const SKUS=(window.FM_PROMO_SKUS||[]).map(s=>({...s,cat:s.cat||'豆制品'}));
const sku=id=>SKUS.find(s=>s.id==id);
const onsale=s=>s&&!s.off;
const low30=s=>+((s.price||0)*0.93).toFixed(2);   // 演示：近 30 天最低价（真实取商品域价格历史）

/* ===== 招商活动（母） ===== */
const CPS=[
  {id:'CP2609',name:'9 月「豆制品季」会场',theme:'首页「新鲜严选」专区曝光 + 搜索加权，主推豆制品',enrollStart:shift(-6,9,0),enrollEnd:shift(2,18,0),actStart:shift(4,0,0),actEnd:shift(11,23,59),gate:{cats:['豆制品'],minSku:5,noViolation:true},play:{type:'special',minRate:0.6,maxRate:0.9,rec:0.85},minStock:20,fund:{mode:'share',platform:0.3}},
  {id:'CP2610',name:'中秋海鲜节',theme:'节前海鲜专场，会场满减 + 专题页曝光',enrollStart:shift(-3,9,0),enrollEnd:shift(5,18,0),actStart:shift(9,0,0),actEnd:shift(16,23,59),gate:{cats:['海鲜水产'],minSku:3,noViolation:true},play:{type:'fullcut',thresholdMax:50,amountMin:1,amountMax:10,rec:[30,3]},minStock:10,fund:{mode:'merchant',platform:0}},
  {id:'CP2608',name:'开学季食堂采购周',theme:'B 端食堂客户定向推送，平台补贴主推品',enrollStart:shift(-16,9,0),enrollEnd:shift(-9,18,0),actStart:shift(-4,0,0),actEnd:shift(2,23,59),gate:{cats:['豆制品'],minSku:3,noViolation:true},play:{type:'special',minRate:0.7,maxRate:0.92,rec:0.88},minStock:30,fund:{mode:'share',platform:0.5}},
  {id:'CP2607',name:'8 月「豆制品季」会场',theme:'首页「新鲜严选」专区曝光 + 搜索加权',enrollStart:'2026-07-20 09:00',enrollEnd:'2026-07-28 18:00',actStart:'2026-08-01 00:00',actEnd:'2026-08-10 23:59',gate:{cats:['豆制品'],minSku:5,noViolation:true},play:{type:'special',minRate:0.6,maxRate:0.9,rec:0.85},minStock:20,fund:{mode:'share',platform:0.3}},
];
const cpOf=id=>CPS.find(c=>c.id==id);
function phase(c){const n=now();if(n<c.enrollStart)return 'soon';if(n<=c.enrollEnd)return 'open';if(n<c.actStart)return 'closed';if(n<=c.actEnd)return 'running';return 'ended';}
const PH={soon:['未开放报名','s2'],open:['报名中','s1'],closed:['报名截止','s0'],running:['活动进行中','s0'],ended:['已结束','s2']};
const phPill=c=>{const p=PH[phase(c)];return `<span class="pm-st ${p[1]}">${p[0]}</span>`;};
const playName=c=>c.play.type=='special'?'商品特价':'会场满减';
const fundTxt=c=>c.fund.mode=='platform'?'平台 100%':c.fund.mode=='merchant'?'商家 100%':`共担 · 平台 ${pct(c.fund.platform)} / 商家 ${pct(1-c.fund.platform)}`;
const playRange=c=>c.play.type=='special'?`活动价 = 原价 ${pct(c.play.minRate)}~${pct(c.play.maxRate)}（推荐 ${pct(c.play.rec)}）`:`满 ≤S$${c.play.thresholdMax} 减 S$${c.play.amountMin}~${c.play.amountMax}（推荐 满 ${c.play.rec[0]} 减 ${c.play.rec[1]}）`;
const gateTxt=c=>`${c.gate.cats.join('/')} 在售 SKU ≥ ${c.gate.minSku}${c.gate.noViolation?' · 近 30 天 0 违规':''}`;
const onsaleCount=cats=>SKUS.filter(s=>onsale(s)&&cats.includes(s.cat)).length;
function eligibility(c){const rs=[];const n=onsaleCount(c.gate.cats);if(n<c.gate.minSku)rs.push(`${c.gate.cats.join('/')}在售 SKU ${n} 个，需 ≥ ${c.gate.minSku} 个`);return {ok:!rs.length,reasons:rs};}

/* ===== 报名单（子） ===== */
const ENS=[
  {id:'EN0921',cp:'CP2609',ver:1,status:'auditing',submittedAt:shift(-1,15,20),updatedAt:shift(-1,15,21),items:[{skuId:'SKU0125-01',orig:9.99,price:8.50,promise:120},{skuId:'SKU0125-03',orig:11.99,price:10.20,promise:100},{skuId:'SKU0125-06',orig:6.20,price:5.30,promise:60}],
    pre:{ok:true,at:shift(-1,15,21),checks:[['营销黑名单',true,'未命中'],['承诺库存',true,'3 个 SKU 均 ≥ 20 件'],['玩法参数范围',true,'活动价均在原价 60%~90% 内'],['类目准入',true,'均属豆制品']]},
    logs:[{t:shift(-1,15,20),who:WHO,act:'提交报名',d:'3 个 SKU'},{t:shift(-1,15,21),who:'系统',act:'规则预筛通过',d:'转人工终审'}]},
  {id:'EN0919',cp:'CP2609',ver:1,status:'pre_fail',submittedAt:shift(-3,10,5),updatedAt:shift(-3,10,5),items:[{skuId:'SKU0125-08',orig:5.40,price:2.90,promise:15},{skuId:'SKU0125-09',orig:2.80,price:2.40,promise:200}],
    pre:{ok:false,at:shift(-3,10,5),checks:[['营销黑名单',true,'未命中'],['承诺库存',false,'腐竹 承诺 15 件 < 最低 20 件'],['玩法参数范围',false,'腐竹 活动价 S$2.90 低于下限 S$3.24（原价 60%）'],['类目准入',true,'均属豆制品']]},
    logs:[{t:shift(-3,10,5),who:WHO,act:'提交报名',d:'2 个 SKU'},{t:shift(-3,10,5),who:'系统',act:'规则预筛未过',d:'承诺库存不足；活动价越界'}]},
  {id:'EN0915',cp:'CP2608',ver:2,status:'approved',submittedAt:shift(-11,11,0),updatedAt:shift(-10,9,30),instId:'ACT-CP2608-M0125',
    items:[{skuId:'SKU0125-01',orig:9.99,price:8.80,promise:150,pass:true},{skuId:'SKU0125-04',orig:8.80,price:7.80,promise:120,pass:true},{skuId:'SKU0125-09',orig:2.80,price:2.50,promise:300,pass:true},{skuId:'SKU0125-07',orig:7.50,price:6.90,promise:80,pass:false,why:'近 30 天最低价 S$6.60，活动价高于最低价'}],
    pre:{ok:true,at:shift(-11,11,1),checks:[['营销黑名单',true,'未命中'],['承诺库存',true,'均 ≥ 30 件'],['玩法参数范围',true,'活动价均在原价 70%~92% 内'],['类目准入',true,'均属豆制品']]},
    audit:{ok:true,at:shift(-10,9,30),by:'招商运营·Li',note:'豆干活动价高于近 30 天最低价，剔除该行；其余 3 个 SKU 通过'},
    logs:[{t:shift(-11,11,0),who:WHO,act:'提交报名',d:'4 个 SKU'},{t:shift(-11,11,1),who:'系统',act:'规则预筛通过',d:'转人工终审'},{t:shift(-10,9,30),who:'招商运营·Li',act:'终审通过（部分）',d:'3 通过 / 1 剔除'},{t:shift(-10,9,30),who:'系统',act:'生成活动实例',d:'ACT-CP2608-M0125 · 出资=共担(平台 50%)'}],
    eff:{updatedAt:shift(0,new Date().getHours(),0),base:{qty:38,gmv:212.0},days:[[-4,52,286.4,19],[-3,61,331.9,22],[-2,74,398.6,27],[-1,80,436.2,29],[0,33,181.7,12]],items:{'SKU0125-01':{sold:96,orders:41},'SKU0125-04':{sold:88,orders:37},'SKU0125-09':{sold:116,orders:31}}}},
  {id:'EN0902',cp:'CP2607',ver:1,status:'approved',submittedAt:'2026-07-22 14:10',updatedAt:'2026-07-24 10:00',instId:'ACT-CP2607-M0125',
    items:[{skuId:'SKU0125-01',orig:9.60,price:8.10,promise:200,pass:true},{skuId:'SKU0125-03',orig:11.50,price:9.80,promise:150,pass:true},{skuId:'SKU0125-06',orig:6.20,price:5.20,promise:100,pass:true}],
    pre:{ok:true,at:'2026-07-22 14:11',checks:[['营销黑名单',true,'未命中'],['承诺库存',true,'均 ≥ 20 件'],['玩法参数范围',true,'活动价均在原价 60%~90% 内'],['类目准入',true,'均属豆制品']]},
    audit:{ok:true,at:'2026-07-24 10:00',by:'招商运营·Li',note:''},
    logs:[{t:'2026-07-22 14:10',who:WHO,act:'提交报名',d:'3 个 SKU'},{t:'2026-07-22 14:11',who:'系统',act:'规则预筛通过',d:'转人工终审'},{t:'2026-07-24 10:00',who:'招商运营·Li',act:'终审通过',d:'3 个 SKU 全部通过'},{t:'2026-08-11 06:00',who:'系统',act:'活动结束 · 效果数据定版',d:'T+1'}],
    eff:{updatedAt:'2026-08-11 06:00',final:true,base:{qty:35,gmv:196.0},days:[['08-01',58,318.5,21],['08-02',66,362.4,24],['08-03',71,389.9,26],['08-04',49,269.1,18],['08-05',77,422.8,28],['08-06',83,455.7,30],['08-07',69,378.9,25],['08-08',88,483.2,32],['08-09',61,335.0,22],['08-10',44,241.6,16]],items:{'SKU0125-01':{sold:238,orders:97},'SKU0125-03':{sold:212,orders:88},'SKU0125-06':{sold:116,orders:52}}}},
  {id:'EN0910',cp:'CP2608',ver:1,status:'rejected',submittedAt:shift(-14,16,40),updatedAt:shift(-13,11,10),items:[{skuId:'SKU0125-10',orig:31.00,price:28.00,promise:40}],
    pre:{ok:true,at:shift(-14,16,41),checks:[['营销黑名单',true,'未命中'],['承诺库存',true,'≥ 30 件'],['玩法参数范围',true,'在范围内'],['类目准入',true,'属豆制品']]},
    audit:{ok:false,at:shift(-13,11,10),by:'招商运营·Li',note:'整箱装不属于本会场主推规格，且承诺库存偏低'},
    logs:[{t:shift(-14,16,40),who:WHO,act:'提交报名',d:'1 个 SKU'},{t:shift(-14,16,41),who:'系统',act:'规则预筛通过',d:'转人工终审'},{t:shift(-13,11,10),who:'招商运营·Li',act:'终审驳回',d:'不属主推规格'}]},
];
const ST={draft:['草稿','s2'],pre_fail:['预筛未过','s4'],auditing:['待终审','s0'],rejected:['已驳回','s4'],approved:['已通过','s1'],withdrawn:['已撤回','s2'],offline:['平台下架','s4']};
const stPill=e=>{const s=ST[e.status];let suf='';if(e.status=='approved'){const p=phase(cpOf(e.cp));suf=p=='running'?'·进行中':p=='ended'?'·已结束':'·待生效';}return `<span class="pm-st ${s[1]}">${s[0]}${suf}</span>`;};
const canWithdraw=e=>e.status=='auditing'||(e.status=='approved'&&!['running','ended'].includes(phase(cpOf(e.cp))));
const canRedo=e=>['pre_fail','rejected','draft'].includes(e.status)&&phase(cpOf(e.cp))=='open';
const hasEff=e=>e.status=='approved'&&!!e.eff&&['running','ended'].includes(phase(cpOf(e.cp)));
const myEnrollOf=c=>ENS.find(e=>e.cp==c.id&&['auditing','approved','draft'].includes(e.status))||null;
function calc(c,it){const price=+it.price||0,orig=+it.orig||0,promise=+it.promise||0;const cut=orig>price?orig-price:0;const incl=price*(1+RATE),comm=incl*SVC;const inc=incl-comm-PICKUP+cut*(c.fund.platform||0)*(1+RATE);
  const total=cut*promise,plat=total*(c.fund.platform||0),mine=total-plat;return {incl,comm,inc,cut,total,plat,mine,min:+(orig*c.play.minRate).toFixed(2),max:+(orig*c.play.maxRate).toFixed(2)};}
const sumBy=(c,items)=>items.reduce((o,x)=>{const k=calc(c,x);o.total+=k.total;o.plat+=k.plat;o.mine+=k.mine;return o;},{total:0,plat:0,mine:0});
function occupied(skuId,c,exceptId){const r={start:c.actStart,end:c.actEnd};
  const P=window.FM_PROMO&&window.FM_PROMO.occupied?window.FM_PROMO.occupied(skuId,r):null;if(P)return P;
  const e=ENS.find(e=>e.id!=exceptId&&['auditing','approved'].includes(e.status)&&e.items.some(x=>x.skuId==skuId&&x.pass!==false)&&cpOf(e.cp).actStart<=r.end&&r.start<=cpOf(e.cp).actEnd);return e?`报名单 ${e.id}`:'';}
window.enrollTodo=()=>ENS.filter(e=>['pre_fail','rejected'].includes(e.status)&&phase(cpOf(e.cp))=='open').length;

/* ===== 列表页（可报名 / 我的报名） ===== */
let VIEW='cp',TAB='all';
function openEnroll(){pushPage({title:'平台活动',body:`<div id="en-root"></div>`,mount:(p)=>{const root=p.querySelector('#en-root');root.innerHTML=skel(3);setTimeout(()=>renderList(root),380);}});}
function renderList(root){
  const todo=window.enrollTodo();
  const head=`<div class="pm-bar"><div class="pm-pills"><div class="pm-pill ${VIEW=='cp'?'on':''}" data-v="cp">可报名活动</div><div class="pm-pill ${VIEW=='my'?'on':''}" data-v="my">我的报名${todo?`<span class="c">${todo}</span>`:''}</div></div></div>`;
  let body='';
  if(VIEW=='cp'){const rows=CPS.slice().sort((a,b)=>{const o={open:0,soon:1,closed:2,running:3,ended:4};return o[phase(a)]-o[phase(b)];});
    body=`<div class="pm-note">运营发布会场 → 选品报名 → 规则预筛 + 人工终审 → 通过后到点自动生效</div><div class="pm-list">${rows.map(c=>{const ph=phase(c);const el=eligibility(c);const mine=myEnrollOf(c);
      return `<div class="pm-card" data-id="${c.id}"><div class="hd"><div class="nm">${c.name}<div class="id">${c.id} · ${c.theme}</div></div>${phPill(c)}</div>
        <div class="tm"><span class="en-chip ${c.play.type=='special'?'sp':'fc'}">${playName(c)}</span>${playRange(c)}</div>
        <div class="kpis"><div class="k"><div class="v" style="font-size:14px;font-family:inherit">${fundTxt(c)}</div><div class="l">出资方式</div></div><div class="k"><div class="v" style="font-size:14px;font-family:inherit">${md(c.actStart)}~${md(c.actEnd)}</div><div class="l">活动时间</div></div><div class="k"><div class="v" style="font-size:14px;font-family:inherit">${ph=='open'?md(c.enrollEnd)+' '+c.enrollEnd.slice(11):'—'}</div><div class="l">报名截止</div></div></div>
        <div style="font-size:12px;color:var(--sub)">门槛：${gateTxt(c)} · 承诺库存 ≥ ${c.minStock} 件/SKU</div>
        ${['open','soon'].includes(ph)?(el.ok?`<div class="en-gate ok">本店符合准入门槛</div>`:`<div class="en-gate">不符合：${el.reasons.join('；')}</div>`):''}
        <div class="acts"><div class="a" data-a="cp">会场详情</div>${mine?`<div class="a pri" data-a="mine">我的报名 · ${ST[mine.status][0]}</div>`:ph=='open'&&el.ok&&ADMIN?`<div class="a pri" data-a="new">立即报名</div>`:''}</div></div>`;}).join('')}</div>`;}
  else{const cnt=k=>ENS.filter(e=>k=='all'||(k=='closed'?['withdrawn','offline'].includes(e.status):e.status==k)).length;
    const rows=ENS.filter(e=>TAB=='all'||(TAB=='closed'?['withdrawn','offline'].includes(e.status):e.status==TAB)).sort((a,b)=>b.updatedAt<a.updatedAt?-1:1);
    body=`<div class="pm-bar" style="padding-top:0"><div class="pm-pills">${[['all','全部'],['auditing','待终审'],['pre_fail','预筛未过'],['rejected','已驳回'],['approved','已通过'],['draft','草稿'],['closed','已撤回/下架']].map(x=>`<div class="pm-pill ${TAB==x[0]?'on':''}" data-t="${x[0]}" style="min-height:34px;font-size:12.5px">${x[1]}${cnt(x[0])?`<span class="c">${cnt(x[0])}</span>`:''}</div>`).join('')}</div></div>
      <div class="pm-list">${rows.map(e=>{const c=cpOf(e.cp);const passed=e.items.filter(x=>x.pass!==false);const promise=e.items.reduce((n,x)=>n+(+x.promise||0),0);
      return `<div class="pm-card" data-id="${e.id}"><div class="hd"><div class="nm">${c.name}<div class="id">${e.id}${e.ver>1?' · v'+e.ver:''} · <span class="en-chip ${c.play.type=='special'?'sp':'fc'}" style="font-size:10px">${playName(c)}</span></div></div>${stPill(e)}</div>
        <div class="tm">活动 ${md(c.actStart)} ~ ${md(c.actEnd)} · ${fundTxt(c)}</div>
        <div class="kpis"><div class="k"><div class="v">${e.items.length}${e.status=='approved'&&passed.length<e.items.length?`<span style="font-size:11px;color:#B45309;font-family:inherit"> ${passed.length} 通过</span>`:''}</div><div class="l">报名 SKU</div></div><div class="k"><div class="v">${num(promise)}</div><div class="l">承诺库存(件)</div></div><div class="k"><div class="v" style="font-size:13px;font-family:inherit">${(e.submittedAt||e.updatedAt||'').slice(5,16)}</div><div class="l">提交时间</div></div></div>
        ${e.status=='pre_fail'?`<div class="pm-warn">预筛未过：${e.pre.checks.filter(x=>!x[1]).map(x=>x[2]).join('；')}</div>`:''}${e.status=='rejected'?`<div class="pm-warn">终审驳回：${e.audit.note}</div>`:''}
        <div class="acts"><div class="a" data-a="detail">详情</div>${ADMIN&&canWithdraw(e)?`<div class="a dgr" data-a="wd">撤回</div>`:''}${ADMIN&&canRedo(e)?`<div class="a pri" data-a="redo">${e.status=='draft'?'继续填写':'修改并重报'}</div>`:''}${hasEff(e)?`<div class="a pri" data-a="eff">效果</div>`:''}</div></div>`;}).join('')||`<div class="pm-empty"><div class="ic">${svg('tag')}</div><h4>${TAB=='all'?'还没有报名记录':'该状态下暂无报名单'}</h4><p>到「可报名活动」选择符合门槛的会场，选品并填写活动价与承诺库存即可报名</p></div>`}</div>`;}
  root.innerHTML=head+body;
  root.querySelectorAll('.pm-pill[data-v]').forEach(el=>el.onclick=()=>{VIEW=el.dataset.v;renderList(root);});
  root.querySelectorAll('.pm-pill[data-t]').forEach(el=>el.onclick=()=>{TAB=el.dataset.t;renderList(root);});
  const re=()=>renderList(root);
  root.querySelectorAll('.pm-card .a').forEach(el=>el.onclick=(ev)=>{ev.stopPropagation();const id=el.closest('.pm-card').dataset.id;const a=el.dataset.a;
    if(a=='cp')openCp(cpOf(id),re);if(a=='new')openEdit(cpOf(id),null,re);if(a=='mine')openDetail(myEnrollOf(cpOf(id)),re);
    const e=ENS.find(x=>x.id==id);if(a=='detail')openDetail(e,re);if(a=='wd')withdraw(e,re);if(a=='redo')openEdit(cpOf(e.cp),e,re);if(a=='eff')openEffect(e,re);});
  root.querySelectorAll('.pm-card').forEach(el=>el.onclick=()=>{const id=el.dataset.id;if(VIEW=='cp')openCp(cpOf(id),re);else openDetail(ENS.find(x=>x.id==id),re);});
}

/* ===== 会场详情 ===== */
function openCp(c,after){const el=eligibility(c);const mine=myEnrollOf(c);const ph=phase(c);
  pushPage({title:'会场详情',body:`
    <div class="pm-dl"><div class="r" style="min-height:56px"><div style="font-size:17px;font-weight:700">${c.name}<div style="font-size:11.5px;color:var(--sub);font-weight:500;margin-top:2px">${c.id} · ${c.theme}</div></div>${phPill(c)}</div>
      <div class="r"><span class="k">报名窗口</span><span class="v">${c.enrollStart}<br>~ ${c.enrollEnd}</span></div>
      <div class="r"><span class="k">活动时间</span><span class="v">${c.actStart}<br>~ ${c.actEnd}</span></div>
      <div class="r"><span class="k">允许玩法</span><span class="v"><b>${playName(c)}</b><br><span style="font-size:11.5px;color:var(--sub)">${playRange(c)}</span></span></div>
      <div class="r"><span class="k">出资方式</span><span class="v"><b>${fundTxt(c)}</b><br><span style="font-size:11.5px;color:var(--sub)">${c.fund.mode=='merchant'?'优惠全部由商家承担，已含在活动价中':'平台承担部分随结算补给商家'}</span></span></div>
      <div class="r"><span class="k">准入门槛</span><span class="v">${gateTxt(c)}</span></div>
      <div class="r"><span class="k">承诺库存</span><span class="v">每 SKU ≥ ${c.minStock} 件（活动期总量）</span></div></div>
    ${el.ok?`<div class="pm-tip" style="background:var(--mint-soft);color:var(--emerald-2)">本店符合准入门槛：${c.gate.cats.join('/')}在售 SKU ${onsaleCount(c.gate.cats)} 个</div>`:`<div class="pm-tip" style="background:var(--amber-soft);color:#B45309">本店暂不符合：${el.reasons.join('；')}。补足在售 SKU 后可在报名截止前重新报名。</div>`}
    <div class="pm-hint" style="padding:12px 16px">通过后系统按报名单生成活动实例，到活动开始时间自动生效、结束自动恢复原价；活动期内平台可因违规下架报名。</div>`,
    footer:mine?`<button class="btn primary" id="cp-mine">查看我的报名 · ${ST[mine.status][0]}</button>`:ph=='open'&&el.ok&&ADMIN?`<button class="btn primary" id="cp-new">立即报名</button>`:'',
    mount:(p)=>{const m=p.querySelector('#cp-mine');if(m)m.onclick=()=>openDetail(mine,after);const n=p.querySelector('#cp-new');if(n)n.onclick=()=>openEdit(c,null,()=>{popPage();setTimeout(()=>after&&after(),320);});}});}

/* ===== 报名单详情 ===== */
const STEPS=['提交报名','规则预筛','人工终审','活动生效','活动结束'];
function stepIdx(e){const ph=e.status=='approved'?phase(cpOf(e.cp)):'';if(e.status=='draft')return [0,-1];if(e.status=='pre_fail')return [1,1];if(e.status=='auditing')return [2,-1];if(e.status=='rejected')return [2,2];if(e.status=='withdrawn')return [e.audit?3:2,-1];if(e.status=='offline')return [3,3];if(ph=='ended')return [5,-1];return [3,-1];}
function openDetail(e,after){if(!e)return;const c=cpOf(e.cp);const [cur,rej]=stepIdx(e);const sum=sumBy(c,e.items.filter(x=>x.pass!==false));const sp=c.play.type=='special';
  pushPage({title:'报名详情',body:`
    <div class="pm-dl"><div class="r" style="min-height:56px"><div style="font-size:17px;font-weight:700">${c.name}<div style="font-size:11.5px;color:var(--sub);font-weight:500;margin-top:2px">${e.id}${e.ver>1?' · v'+e.ver:''} · 活动 ${md(c.actStart)} ~ ${md(c.actEnd)}</div></div>${stPill(e)}</div></div>
    <div class="en-step">${STEPS.map((s,i)=>`<div class="s ${i==rej?'rej':i<cur?'done':i==cur?'cur':''}"><i>${i==rej?'✕':i<cur?'✓':i+1}</i>${s}</div>`).join('')}</div>
    ${e.status=='pre_fail'?`<div class="pm-tip" style="background:var(--red-soft);color:var(--red)"><b>规则预筛未过</b>：${e.pre.checks.filter(x=>!x[1]).map(x=>x[2]).join('；')}。${phase(c)=='open'?'修改后可在报名截止前重报，报名单号不变。':'报名窗口已关闭。'}</div>`:''}
    ${e.status=='rejected'?`<div class="pm-tip" style="background:var(--red-soft);color:var(--red)"><b>终审驳回</b>（${e.audit.by} · ${e.audit.at}）：${e.audit.note}。${phase(c)=='open'?'按理由修改后可重报。':'报名窗口已关闭。'}</div>`:''}
    ${e.status=='auditing'?`<div class="pm-tip">预筛已通过，等待运营人工终审（承诺 4 小时内）。终审前可撤回；通过后到 ${c.actStart} 自动生效。</div>`:''}
    ${e.status=='approved'&&e.audit&&e.audit.note?`<div class="pm-tip" style="background:var(--amber-soft);color:#B45309"><b>部分通过</b>：${e.audit.note}</div>`:''}
    ${e.status=='approved'&&phase(c)=='running'?`<div class="pm-tip" style="background:var(--mint-soft);color:var(--emerald-2)">活动进行中，C 端按活动价展示；活动内 SKU 改价须高于活动价、下架即该行不生效。已生效不可撤回，如需下架请联系平台运营。</div>`:''}
    <div class="pm-dl"><div class="r"><span class="k">玩法</span><span class="v"><b>${playName(c)}</b>${!sp&&e.fullcut?` · 满 S$${e.fullcut[0]} 减 S$${e.fullcut[1]}`:''}</span></div>
      <div class="r"><span class="k">出资方式</span><span class="v"><b>${fundTxt(c)}</b></span></div>
      ${sp?`<div class="r"><span class="k">预计优惠总额</span><span class="v">${money(sum.total)}<br><span style="font-size:11.5px;color:var(--sub)">按承诺库存估算上限</span></span></div><div class="r"><span class="k">商家 / 平台承担</span><span class="v"><b style="color:var(--red)">${money(sum.mine)}</b> / ${money(sum.plat)}</span></div>`:''}
      ${e.instId?`<div class="r"><span class="k">活动实例</span><span class="v">${e.instId}</span></div>`:''}
      <div class="r"><span class="k">提交</span><span class="v">${e.submittedAt||'—'}</span></div></div>
    ${e.pre?`<div class="pm-dl" style="padding:10px 15px 4px"><div style="font-size:13px;font-weight:700;margin-bottom:2px">规则预筛 <span style="font-weight:500;color:var(--sub);font-size:12px">${e.pre.at}</span></div>${e.pre.checks.map(x=>`<div class="en-chk"><span class="k">${x[0]}</span><span class="v" style="color:${x[1]?'#27433A':'var(--red)'}">${x[1]?'✓ ':'✕ '}${x[2]}</span></div>`).join('')}</div>`:''}
    <div class="pm-dl" style="padding:10px 15px 4px"><div style="font-size:13px;font-weight:700;margin-bottom:2px">报名商品 <span style="font-weight:500;color:var(--sub);font-size:12px">${e.items.length} 个 · 承诺库存合计 ${num(e.items.reduce((n,x)=>n+(+x.promise||0),0))} 件</span></div>
      ${e.items.map(x=>{const s=sku(x.skuId);const k=calc(c,x);return `<div class="pm-line" style="${x.pass===false?'opacity:.6':''}"><div class="n">${s?s.n:x.skuId}${x.pass===false?`<span class="pm-ineff">剔除</span>`:e.status=='approved'?`<span class="pm-ineff" style="background:var(--mint-soft);color:var(--emerald-2)">通过</span>`:''}<span class="c">${s?s.spec:''} · ${x.skuId}<br>承诺库存 ${num(x.promise)} 件${sp?` · 商家承担 ${money(k.mine)}`:''}${x.why?`<br><span style="color:#B45309">${x.why}</span>`:''}</span></div>${sp?`<div class="p"><div class="a">${money(x.price)}</div><div class="o">${money(x.orig)}</div><div class="d">立减 ${money(k.cut)}</div></div>`:''}</div>`;}).join('')}
      <div class="pm-hint">${sp?'商家承担 = (原价 − 活动价) × 承诺库存 × 商家出资比例，为估算上限；实际以核销成本流水为准。佣金按活动价成交额计。':'满减优惠在订单核销时按出资比例记成本流水；实际承担金额以核销为准。'}</div></div>
    <div class="pm-dl" style="padding:10px 15px"><div style="font-size:13px;font-weight:700;margin-bottom:4px">操作日志</div>${e.logs.slice().reverse().map(l=>`<div class="pm-log"><span class="t">${l.t}</span> · <b>${l.who}</b> ${l.act}${l.d?`<div class="t">${l.d}</div>`:''}</div>`).join('')}</div>
    ${e.status=='auditing'?`<div class="pm-hint" style="padding:10px 16px;text-align:center;color:#94A3B8" id="ed-demo">🔬 演示 · 模拟运营终审</div>`:''}<div style="height:16px"></div>`,
    footer:(ADMIN&&(canWithdraw(e)||canRedo(e)))||hasEff(e)?`<div style="display:flex;gap:10px">${ADMIN&&canWithdraw(e)?`<button class="btn" style="flex:1;background:var(--red-soft);color:var(--red)" id="ed-wd">撤回报名</button>`:''}${ADMIN&&canRedo(e)?`<button class="btn primary" style="flex:1.4" id="ed-redo">${e.status=='draft'?'继续填写':'修改并重报'}</button>`:''}${hasEff(e)?`<button class="btn primary" style="flex:1.4" id="ed-eff">查看效果</button>`:''}</div>`:'',
    mount:(p)=>{const back=()=>{popPage();setTimeout(()=>after&&after(),320);};
      const w=p.querySelector('#ed-wd');if(w)w.onclick=()=>withdraw(e,back);
      const r=p.querySelector('#ed-redo');if(r)r.onclick=()=>openEdit(c,e,back);
      const f=p.querySelector('#ed-eff');if(f)f.onclick=()=>openEffect(e,after);
      const d=p.querySelector('#ed-demo');if(d)d.onclick=()=>demoAudit(e,back);}});}
function demoAudit(e,after){const c=cpOf(e.cp);window.FM.sheet([{label:'全部通过',fn:()=>audit(e,'ok',after)},{label:'部分通过（剔除首个 SKU）',fn:()=>audit(e,'part',after)},{label:'驳回',danger:1,fn:()=>audit(e,'no',after)}]);}
function audit(e,how,after){const c=cpOf(e.cp);const by='招商运营·Li';
  if(how=='no'){e.status='rejected';e.audit={ok:false,at:now(),by,note:'活动价高于近 30 天最低价，请按参考价调整后重报'};e.logs.push({t:now(),who:by,act:'终审驳回',d:e.audit.note});toast('报名已被驳回，站内信已通知');}
  else{e.status='approved';e.instId=`ACT-${c.id}-M0125`;e.items.forEach((x,k)=>{x.pass=!(how=='part'&&k==0);if(!x.pass)x.why='近 30 天最低价低于活动价';});const s0=sku(e.items[0].skuId);
    e.audit={ok:true,at:now(),by,note:how=='part'?`${s0?s0.n:e.items[0].skuId}活动价高于近 30 天最低价，剔除该行；其余通过`:''};
    e.logs.push({t:now(),who:by,act:how=='part'?'终审通过（部分）':'终审通过',d:how=='part'?`${e.items.length-1} 通过 / 1 剔除`:`${e.items.length} 个 SKU 全部通过`},{t:now(),who:'系统',act:'生成活动实例',d:`${e.instId} · 出资=${fundTxt(c)}`});toast(`报名已通过，${c.actStart} 自动生效`);}
  e.updatedAt=now();if(window.FM_MSG&&window.FM_MSG.push)window.FM_MSG.push({cat:'MARKETING',ev:e.status=='approved'?'ENROLL_APPROVED':'ENROLL_REJECTED',t:(e.status=='approved'?'报名已通过 · ':'报名被驳回 · ')+c.name,b:`报名单 ${e.id} ${e.status=='approved'?'终审通过':'终审驳回：'+e.audit.note}`});after&&after();}
function withdraw(e,after){if(!ADMIN)return noPerm();const c=cpOf(e.cp);
  confirmDialog({title:`撤回对「${c.name}」的报名？`,danger:1,okText:'确认撤回',body:`${e.status=='approved'?'已通过但尚未生效，撤回后活动实例作废；':'撤回后终审终止；'}报名窗口内（至 ${c.enrollEnd}）可重新报名。`,onOk:()=>{e.status='withdrawn';e.updatedAt=now();e.logs.push({t:now(),who:WHO,act:'撤回报名',d:''});toast(`报名 ${e.id} 已撤回`);after&&after();}});}

/* ===== 报名表单（新建 / 修改并重报） ===== */
function openEdit(c,e,after){if(!ADMIN)return noPerm();if(!e){if(phase(c)!='open')return toast('不在报名开放时段');const el=eligibility(c);if(!el.ok)return toast('不符合准入门槛：'+el.reasons.join('；'));if(myEnrollOf(c))return toast('本会场已有报名单');}
  const sp=c.play.type=='special';
  const ED={enrollId:e?e.id:null,fullcut:e&&e.fullcut?[...e.fullcut]:(sp?null:[...c.play.rec]),items:e?e.items.map(x=>{const s=sku(x.skuId);return {skuId:x.skuId,orig:s?s.price:x.orig,price:x.price,promise:x.promise};}):[]};
  pushPage({title:e?'修改并重报':'报名 · '+c.name,body:`
    <div class="pm-sec"><div class="st">会场约束 · 由平台运营设定，参数须在范围内</div>
      <div class="pm-row"><div class="lb">活动时间</div><div class="val">${md(c.actStart)} ${c.actStart.slice(11)} ~ ${md(c.actEnd)} ${c.actEnd.slice(11)}</div></div>
      <div class="pm-row"><div class="lb">允许玩法</div><div class="val" style="color:#27433A"><b>${playName(c)}</b><br><span style="font-size:11.5px;color:var(--sub)">${playRange(c)}</span></div></div>
      <div class="pm-row"><div class="lb">出资方式</div><div class="val" style="color:#27433A"><b>${fundTxt(c)}</b></div></div>
      <div class="pm-row"><div class="lb">可报类目</div><div class="val">${c.gate.cats.join('/')} · 承诺库存 ≥ ${c.minStock} 件/SKU</div></div>
      <div class="pm-row"><div class="lb">报名截止</div><div class="val" style="color:#B45309">${c.enrollEnd}</div></div>
      ${!sp?`<div class="pm-row"><div class="lb"><b>*</b>满减参数</div><div style="flex:1;display:flex;align-items:center;justify-content:flex-end;gap:6px;font-size:14px">满 S$<input id="fc-x" inputmode="numeric" value="${ED.fullcut[0]}" style="flex:0 0 56px;text-align:center;border:1.5px solid var(--line);border-radius:8px;height:36px"> 减 S$<input id="fc-y" inputmode="decimal" value="${ED.fullcut[1]}" style="flex:0 0 56px;text-align:center;border:1.5px solid var(--line);border-radius:8px;height:36px"></div></div><div class="pm-hint">门槛 ≤ ${c.play.thresholdMax} · 面额 ${c.play.amountMin}~${c.play.amountMax}，已按推荐值预填</div>`:''}</div>
    <div id="en-items"></div>
    <div class="pm-add" id="en-add"><svg viewBox='0 0 24 24'><path d='M12 5v14M5 12h14'/></svg>添加商品</div>
    <div class="pm-sec" id="en-sum" style="padding:12px 15px"></div>
    <div class="pm-hint" style="padding:10px 16px 16px">${sp?'活动价已按推荐折扣预填，可在范围内调整。预计优惠为按承诺库存全部售出的上限，实际按核销记成本流水；商家承担已含在活动价里，平台承担随结算补给商家；佣金按活动价成交额计。':'满减优惠在订单核销时按出资比例记成本流水；提交后即进入规则预筛。'}</div>`,
    footer:`<div style="display:flex;gap:10px"><button class="btn" style="flex:1;background:var(--muted);color:#27433A" id="en-draft">保存草稿</button><button class="btn primary" style="flex:1.6" id="en-sub">${e?'重新提交':'提交报名'}</button></div>`,
    mount:(p)=>{const box=p.querySelector('#en-items'),sumEl=p.querySelector('#en-sum');
      const drawSum=()=>{if(!sp){sumEl.style.display='none';return;}const s=sumBy(c,ED.items);sumEl.innerHTML=`<div style="display:flex;gap:14px"><div style="flex:1"><div style="font-size:11.5px;color:var(--sub)">预计优惠总额</div><div style="font-size:17px;font-weight:600;font-family:'Lora',serif">${money(s.total)}</div></div><div style="flex:1"><div style="font-size:11.5px;color:var(--sub)">商家承担 ${pct(1-(c.fund.platform||0))}</div><div style="font-size:17px;font-weight:600;font-family:'Lora',serif;color:var(--red)">${money(s.mine)}</div></div><div style="flex:1"><div style="font-size:11.5px;color:var(--sub)">平台承担 ${pct(c.fund.platform||0)}</div><div style="font-size:17px;font-weight:600;font-family:'Lora',serif;color:var(--emerald-2)">${money(s.plat)}</div></div></div>`;};
      const draw=()=>{box.innerHTML=ED.items.map((x,k)=>{const s=sku(x.skuId);const kk=calc(c,x);const v=+x.price;const bad=sp&&x.price!==''&&x.price!=null&&(!(v>0)||v<kk.min||v>kk.max);const hi=sp&&v>0&&v>low30(s);const pbad=x.promise!==''&&x.promise!=null&&(!(+x.promise>0)||+x.promise<c.minStock);const over=s&&+x.promise>(s.stock||0);
        return `<div class="pm-sku" data-k="${k}"><div class="top"><div class="nm">${s?s.n:x.skuId}<span class="c">${s?s.spec:''} · ${x.skuId} · 可售库存 ${s?s.stock:'—'}</span></div><div class="rm" data-rm>移除</div></div>
          <div class="grid">
            <div class="f"><div class="l">当前售价 / 近 30 天最低</div><div class="ro">${money(x.orig)}<span style="font-size:11px;color:var(--sub);font-family:inherit;font-weight:500;margin-left:6px">最低 ${money(low30(s))}</span></div></div>
            ${sp?`<div class="f"><div class="l">活动价(未税) <b style="color:var(--red)">*</b></div><div class="in ${bad?'bad':''}"><span class="u">S$</span><input data-price inputmode="decimal" value="${x.price===''||x.price==null?'':(+x.price).toFixed(2)}"></div></div>
            <div class="f"><div class="l">立减 / 预计到手</div><div class="ro red" data-cut>${v>0?'−'+money(kk.cut)+' · 到手 '+money(kk.inc):'—'}</div></div>`:''}
            <div class="f"><div class="l">承诺库存(件) <b style="color:var(--red)">*</b></div><div class="in ${pbad?'bad':''}"><input data-promise inputmode="numeric" value="${x.promise==null?'':x.promise}" placeholder="≥ ${c.minStock}"></div></div>
            ${sp?`<div class="f" style="grid-column:1/-1"><div class="l">预计优惠 / 商家承担</div><div class="ro" data-tot>${v>0&&+x.promise>0?money(kk.total)+' / '+money(kk.mine):'—'}</div></div>`:''}
          </div>${bad?`<div class="err">活动价须在 ${money(kk.min)} ~ ${money(kk.max)}（原价 ${pct(c.play.minRate)}~${pct(c.play.maxRate)}）</div>`:hi?`<div class="soft">高于近 30 天最低价，终审可能驳回</div>`:''}${pbad?`<div class="err">承诺库存须 ≥ ${c.minStock} 件</div>`:over?`<div class="soft">超过当前可售库存，请确保活动期补货</div>`:''}</div>`;}).join('')||`<div class="pm-sec" style="text-align:center;padding:22px 15px;color:var(--sub);font-size:13px">还没有添加商品<br><span style="font-size:12px">从本店 ${c.gate.cats.join('/')} 在售 SKU 中选择；已在其他活动中的 SKU 不可选</span></div>`;
        box.querySelectorAll('.pm-sku').forEach(card=>{const k=+card.dataset.k;const x=ED.items[k];
          const pi=card.querySelector('[data-price]');if(pi){pi.oninput=()=>{x.price=pi.value===''?'':+pi.value;const kk=calc(c,x);const v=+x.price;const bad=x.price!==''&&(!(v>0)||v<kk.min||v>kk.max);pi.closest('.in').classList.toggle('bad',bad);card.querySelector('[data-cut]').textContent=v>0?'−'+money(kk.cut)+' · 到手 '+money(kk.inc):'—';const t=card.querySelector('[data-tot]');if(t)t.textContent=v>0&&+x.promise>0?money(kk.total)+' / '+money(kk.mine):'—';drawSum();};pi.onblur=draw;}
          const pr=card.querySelector('[data-promise]');pr.oninput=()=>{x.promise=pr.value===''?'':parseInt(pr.value)||0;const kk=calc(c,x);const t=card.querySelector('[data-tot]');if(t)t.textContent=+x.price>0&&+x.promise>0?money(kk.total)+' / '+money(kk.mine):'—';drawSum();};pr.onblur=draw;
          card.querySelector('[data-rm]').onclick=()=>{ED.items.splice(k,1);draw();};});drawSum();};
      const flash=(k)=>{const card=box.querySelectorAll('.pm-sku')[k];if(!card)return;card.scrollIntoView({behavior:'smooth',block:'center'});card.style.boxShadow='0 0 0 2px var(--red)';setTimeout(()=>{card.style.boxShadow='';},2000);};
      draw();
      p.querySelector('#en-add').onclick=()=>openPick(c,ED,draw);
      const syncFc=()=>{if(sp)return;ED.fullcut=[+((p.querySelector('#fc-x')||{}).value||0),+((p.querySelector('#fc-y')||{}).value||0)];};
      p.querySelector('#en-draft').onclick=()=>{syncFc();saveDraft(c,e,ED);popPage();setTimeout(()=>after&&after(),320);};
      p.querySelector('#en-sub').onclick=()=>{syncFc();
        if(phase(c)!='open')return toast('不在报名开放时段');
        if(!sp){const [x,y]=ED.fullcut;if(!(x>0)||x>c.play.thresholdMax)return toast(`满减门槛须为 1 ~ ${c.play.thresholdMax}`);if(!(y>=c.play.amountMin)||y>c.play.amountMax)return toast(`满减面额须为 ${c.play.amountMin} ~ ${c.play.amountMax}`);if(y>=x)return toast('减免金额须小于门槛');}
        if(!ED.items.length)return toast('至少添加 1 个报名商品');
        for(let k=0;k<ED.items.length;k++){const x=ED.items[k];const s=sku(x.skuId);const nm=s?s.n:x.skuId;if(!onsale(s)){flash(k);return toast(`「${nm}」已非在售，请移除`);}x.orig=s.price;const kk=calc(c,x);
          if(sp){if(!(+x.price>0)){flash(k);return toast(`「${nm}」请填写活动价`);}if(+x.price<kk.min||+x.price>kk.max){flash(k);return toast(`「${nm}」活动价须在 ${money(kk.min)} ~ ${money(kk.max)}`);}}
          if(!(+x.promise>0)){flash(k);return toast(`「${nm}」请填写承诺库存`);}if(+x.promise<c.minStock){flash(k);return toast(`「${nm}」承诺库存须 ≥ ${c.minStock} 件`);}
          const occ=occupied(x.skuId,c,ED.enrollId);if(occ){flash(k);return toast(`「${nm}」已在${occ}中，活动时间重叠`);}}
        const his=sp?ED.items.filter(x=>+x.price>low30(sku(x.skuId))):[];const s=sumBy(c,ED.items);
        confirmDialog({title:`确认提交对「${c.name}」的报名？`,okText:'确认提交',body:`${ED.items.length} 个 SKU · 承诺库存合计 ${num(ED.items.reduce((n,x)=>n+(+x.promise),0))} 件${sp?` · 预计商家承担上限 <b>${money(s.mine)}</b>`:''}。${his.length?`<br><b style="color:#B45309">${his.length} 个 SKU 活动价高于近 30 天最低价</b>，终审可能驳回。`:''}<br>提交后进入规则预筛，通过后转运营终审；终审前可撤回。`,
          onOk:()=>{const b=p.querySelector('#en-sub');b.classList.add('loading');setTimeout(()=>{const ok=submit(c,e,ED);b.classList.remove('loading');toast(ok?'已提交，预筛通过，等待运营终审':'预筛未过，请按原因修改后重报');setTimeout(()=>{popPage();after&&after();},500);},600);}});};}});}
function saveDraft(c,e,ED){const items=ED.items.map(x=>({skuId:x.skuId,orig:x.orig,price:x.price,promise:x.promise}));
  if(e&&e.status=='draft'){e.items=items;e.fullcut=ED.fullcut;e.updatedAt=now();}
  else if(e){e.items=items;e.fullcut=ED.fullcut;e.status='draft';e.updatedAt=now();e.logs.push({t:now(),who:WHO,act:'保存草稿',d:'修改中'});}
  else{ENS.unshift({id:'EN0'+(++SEQ),cp:c.id,ver:1,status:'draft',fullcut:ED.fullcut,items,updatedAt:now(),logs:[{t:now(),who:WHO,act:'保存草稿',d:`${items.length} 个 SKU`}]});}
  VIEW='my';toast('草稿已保存');}
function submit(c,e,ED){const items=ED.items.map(x=>({skuId:x.skuId,orig:x.orig,price:x.price===''?null:+(+x.price).toFixed(2),promise:+x.promise}));
  if(e){e.ver=(e.status=='draft'&&!e.submittedAt)?1:(e.ver||1)+1;e.items=items;e.fullcut=ED.fullcut;e.audit=null;e.instId=null;e.logs.push({t:now(),who:WHO,act:e.ver>1?'修改并重报':'提交报名',d:`v${e.ver} · ${items.length} 个 SKU`});}
  else{e={id:'EN0'+(++SEQ),cp:c.id,ver:1,fullcut:ED.fullcut,items,logs:[{t:now(),who:WHO,act:'提交报名',d:`${items.length} 个 SKU`}]};ENS.unshift(e);}
  e.submittedAt=now();e.updatedAt=now();
  const checks=[['营销黑名单',true,'未命中'],['承诺库存',items.every(x=>x.promise>=c.minStock),`${items.length} 个 SKU 均 ≥ ${c.minStock} 件`],['玩法参数范围',true,c.play.type=='special'?`活动价均在原价 ${pct(c.play.minRate)}~${pct(c.play.maxRate)} 内`:`满 ${ED.fullcut[0]} 减 ${ED.fullcut[1]} 在范围内`],['类目准入',true,`均属 ${c.gate.cats.join('/')}`]];
  const ok=checks.every(x=>x[1]);e.pre={ok,at:now(),checks};e.status=ok?'auditing':'pre_fail';e.logs.push({t:now(),who:'系统',act:ok?'规则预筛通过':'规则预筛未过',d:ok?'转人工终审':checks.filter(x=>!x[1]).map(x=>x[2]).join('；')});VIEW='my';TAB='all';return ok;}

/* ===== 选品：仅会场类目在售 SKU；已在其他活动中的置灰 ===== */
function openPick(c,ED,after){let q='';const sel=new Set();
  pushPage({title:'添加报名商品',body:`<div class="pk-search">${svg('search')}<input id="pk-q" placeholder="搜索商品名称 / SKU 编码"></div><div class="pm-note" style="margin-bottom:8px">仅本店 ${c.gate.cats.join('/')} 在售 SKU · 已在其他活动中的不可选（活动 ${md(c.actStart)} ~ ${md(c.actEnd)}）</div><div id="pk-list"></div><div style="height:16px"></div>`,
    footer:`<button class="btn primary" id="pk-ok" disabled>加入报名</button>`,
    mount:(p)=>{const list=p.querySelector('#pk-list'),ok=p.querySelector('#pk-ok');
      const draw=()=>{const rows=SKUS.filter(s=>onsale(s)&&c.gate.cats.includes(s.cat)&&(!q||s.n.toLowerCase().includes(q)||s.id.toLowerCase().includes(q)));
        list.innerHTML=rows.map(s=>{const inEd=ED.items.some(x=>x.skuId==s.id);const occ=inEd?'':occupied(s.id,c,ED.enrollId);const dis=inEd||!!occ;
          return `<div class="pk-item ${dis?'dis':''}" data-id="${s.id}"><div class="chk ${sel.has(s.id)?'on':''}" style="${dis?'visibility:hidden':''}"></div><div class="bd"><div class="n">${s.n}</div><div class="s">${s.spec} · ${s.id} · 未税 <b>${money(s.price)}</b> · 近 30 天最低 ${money(low30(s))} · 库存 ${s.stock}</div>${inEd?'<span class="occ" style="background:var(--muted);color:var(--sub)">已在本报名单</span>':occ?`<span class="occ">已在${occ}中</span>`:''}</div></div>`;}).join('')||`<div class="pm-empty"><h4>没有匹配的在售 SKU</h4><p>只能选会场允许类目下的在售 SKU</p></div>`;
        list.querySelectorAll('.pk-item:not(.dis)').forEach(el=>el.onclick=()=>{const id=el.dataset.id;sel.has(id)?sel.delete(id):sel.add(id);draw();});
        ok.disabled=!sel.size;ok.textContent=sel.size?`加入报名（${sel.size}）`:'加入报名';};
      draw();p.querySelector('#pk-q').oninput=(ev)=>{q=ev.target.value.trim().toLowerCase();draw();};
      ok.onclick=()=>{sel.forEach(id=>{const s=sku(id);ED.items.push({skuId:id,orig:s.price,price:c.play.type=='special'?+(s.price*c.play.rec).toFixed(2):'',promise:Math.max(c.minStock,Math.floor((s.stock||0)/2))});});toast(`已加入 ${sel.size} 个 SKU，活动价与承诺库存已按推荐值预填`);popPage();after&&after();};}});}

/* ===== 单活动效果分析（商家自用） ===== */
function openEffect(e,after){const c=cpOf(e.cp);const E=e.eff;if(!E)return;
  const days=E.days.map(d=>({d:typeof d[0]=='number'?dayStr(d[0]):d[0],qty:d[1],gmv:d[2],orders:d[3]}));const n=days.length;
  const tot=days.reduce((o,d)=>{o.qty+=d.qty;o.gmv+=d.gmv;o.orders+=d.orders;return o;},{qty:0,gmv:0,orders:0});
  const items=e.items.filter(x=>x.pass!==false).map(x=>{const s=sku(x.skuId);const st=E.items[x.skuId]||{sold:0,orders:0};const kk=calc(c,x);const disc=kk.cut*st.sold;return {x,s,sold:st.sold,orders:st.orders,rate:x.promise?st.sold/x.promise:0,disc,mine:disc*(1-(c.fund.platform||0)),plat:disc*(c.fund.platform||0),gmv:st.sold*(+x.price)};}).sort((a,b)=>b.sold-a.sold);
  const disc=items.reduce((a,b)=>a+b.disc,0),mine=items.reduce((a,b)=>a+b.mine,0),plat=items.reduce((a,b)=>a+b.plat,0),promise=items.reduce((a,b)=>a+(+b.x.promise||0),0),sold=items.reduce((a,b)=>a+b.sold,0);
  const gmvIncl=tot.gmv*(1+RATE),comm=gmvIncl*SVC,net=gmvIncl-comm+plat,baseNet=E.base.gmv*n*(1+RATE)*(1-SVC),lift=net-baseNet,qtyLift=E.base.qty?tot.qty/(E.base.qty*n)-1:0;
  const W=330,H=130,pd=14,bw=Math.max(10,Math.min(30,(W-pd*2)/n-6)),maxQ=Math.max(...days.map(d=>d.qty),E.base.qty)*1.15;
  const bars=days.map((d,i)=>{const x=pd+i*((W-pd*2)/n)+((W-pd*2)/n-bw)/2;const h=d.qty/maxQ*(H-28);const today=d.d==dayStr(0)&&!E.final;return `<rect x="${x}" y="${H-18-h}" width="${bw}" height="${h}" rx="3" fill="${today?'#C9A24A':'#0E7A52'}"/><text x="${x+bw/2}" y="${H-21-h}" font-size="9" text-anchor="middle" fill="#27433A">${d.qty}</text><text x="${x+bw/2}" y="${H-5}" font-size="8.5" text-anchor="middle" fill="#7A8C82">${d.d.slice(5)}</text>`;}).join('');
  const by=H-18-E.base.qty/maxQ*(H-28);
  pushPage({title:'活动效果',body:`
    <div class="pm-dl"><div class="r" style="min-height:56px"><div style="font-size:17px;font-weight:700">${c.name}<div style="font-size:11.5px;color:var(--sub);font-weight:500;margin-top:2px">${e.id} · ${md(c.actStart)} ~ ${md(c.actEnd)} · ${fundTxt(c)}</div></div>${stPill(e)}</div>
      <div class="r" style="min-height:36px;font-size:12px;color:var(--sub)"><span>${E.final?'最终数据 · 活动结束 T+1 定版':'进行中 · 每小时刷新'}</span><span>更新至 ${E.updatedAt}</span></div></div>
    <div class="en-sec">卖了多少</div>
    <div class="en-kpi"><div class="c"><div class="l">活动订单</div><div class="v">${num(tot.orders)}</div><div class="s">含活动商品的订单</div></div><div class="c"><div class="l">活动商品销量</div><div class="v">${num(tot.qty)} 件</div><div class="s" style="color:${qtyLift>=0?'var(--emerald-2)':'var(--red)'}">较活动前日均 ${qtyLift>=0?'+':''}${Math.round(qtyLift*100)}%</div></div><div class="c"><div class="l">活动成交额(未税)</div><div class="v">${money(tot.gmv)}</div><div class="s">按活动价 · 仅活动商品行</div></div><div class="c"><div class="l">承诺库存兑现率</div><div class="v">${promise?Math.round(sold/promise*100):0}%</div><div class="s">售出 ${num(sold)} / 承诺 ${num(promise)}</div></div></div>
    <div class="en-chart"><div class="t"><span>每日活动商品销量（件）</span><span>- - 活动前日均 ${E.base.qty}</span></div><svg viewBox="0 0 ${W} ${H}" width="100%">${bars}<line x1="${pd}" y1="${by}" x2="${W-pd}" y2="${by}" stroke="#B45309" stroke-width="1.2" stroke-dasharray="4 3"/></svg></div>
    <div class="en-sec">花了多少</div>
    <div class="en-kpi"><div class="c"><div class="l">优惠总额</div><div class="v">${money(disc)}</div><div class="s">Σ(原价−活动价)×售出</div></div><div class="c"><div class="l">商家承担 ${pct(1-(c.fund.platform||0))}</div><div class="v" style="color:var(--red)">${money(mine)}</div><div class="s">让利，已含在活动价里</div></div><div class="c"><div class="l">平台承担 ${pct(c.fund.platform||0)}</div><div class="v" style="color:var(--emerald-2)">${money(plat)}</div><div class="s">随结算补给商家</div></div><div class="c"><div class="l">平台服务费</div><div class="v">${money(comm)}</div><div class="s">按活动价成交额计</div></div></div>
    <div class="en-sec">值不值</div>
    <div class="en-kpi"><div class="c"><div class="l">活动期预计净收入</div><div class="v">${money(net)}</div><div class="s">成交额(含税) − 服务费 + 平台承担</div></div><div class="c"><div class="l">活动前同天数净收入</div><div class="v">${money(baseNet)}</div><div class="s">活动前 7 天日均 × ${n} 天</div></div><div class="c hl" style="grid-column:1/-1"><div class="l">净收入增量</div><div class="v">${lift>=0?'+':'−'}${money(Math.abs(lift))}</div><div class="s">${lift>=0?'活动带来的净增收':'活动期净收入低于日常'}</div></div></div>
    <div class="pm-hint" style="padding:8px 16px 0">净收入均为预估：以活动商品行为口径，未含 BCRS 押金、多退少补与售后退款，以结算单为准。商家承担部分是相对原价的让利，不会再从结算中扣减。</div>
    <div class="pm-dl" style="padding:10px 15px 4px;margin-top:12px"><div style="font-size:13px;font-weight:700;margin-bottom:2px">商品明细 <span style="font-weight:500;color:var(--sub);font-size:12px">按售出排序</span></div>
      ${items.map(r=>`<div class="pm-line"><div class="n">${r.s?r.s.n:r.x.skuId}<span class="c">${r.s?r.s.spec:''} · 承诺 ${num(r.x.promise)} · 售出 <b>${num(r.sold)}</b> · 兑现 <b style="color:${r.rate>=0.8?'var(--emerald-2)':r.rate>=0.5?'#B45309':'var(--red)'}">${Math.round(r.rate*100)}%</b><br>${r.orders} 单 · 成交 ${money(r.gmv)} · 优惠 ${money(r.disc)} · 商家承担 ${money(r.mine)}</span></div><div class="p"><div class="a">${money(r.x.price)}</div><div class="o">${money(r.x.orig)}</div></div></div>`).join('')}</div>
    <div style="height:16px"></div>`,
    footer:`<div style="display:flex;gap:10px"><button class="btn" style="flex:1;background:var(--muted);color:#27433A" id="ef-detail">报名详情</button><button class="btn primary" style="flex:1" id="ef-exp">导出效果数据</button></div>`,
    mount:(p)=>{p.querySelector('#ef-detail').onclick=()=>openDetail(e,after);p.querySelector('#ef-exp').onclick=()=>toast(`已导出 ${e.id}_活动效果.xlsx`);}});}

window.FM_MOD=window.FM_MOD||{};
window.FM_MOD.enroll=openEnroll;
window.FM_ENROLL={liveCount:()=>ENS.filter(e=>e.status=='approved'&&phase(cpOf(e.cp))=='running').length,todo:window.enrollTodo};
})();
