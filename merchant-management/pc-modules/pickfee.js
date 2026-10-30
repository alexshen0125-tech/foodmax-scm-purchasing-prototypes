/* PC · 取货运费（原名「自提运费」，2026-10-27 改名）（平台去批发市场取商家的货，按店铺收运费）
   ▍口径来源：2026-10-27「司机上门取货以及仓库退货差异结算沟通」会议（推翻 10-12 的按次/按比例、按月出账）
   ▍规则：
   - 平台按店铺指定所属区域（商家不能自选）；未设置的店铺不收运费；改区域从下一次取货起生效，已取的不重算
       近区（祝融、白斯班江一带）：S$20 / 次 / 商家，不拼车
       普通区：S$80 / 车，最多 4 家拼车，按同车实际店铺数平摊（80 ÷ 同车店铺数，四舍五入到分）；一车只有自己 = S$80
   - 同一商家同一天只收一次：按当天第一趟取货所在的车计费，后面的趟次（含一车装不下分到第二辆车）不再收
   - 免运费期：店铺有了第一次取货任务起 14 天内（含首取当天）免运费；费用照常算（同车分摊人数照常算进去），这一笔记「免运费期内」不扣
     （2026-10-27 沈亮改：起算点由「入驻」改为「首次取货」；还没取过货的店铺不起算）
   - 超出免运费期还要免：在取货明细勾选同一店铺的计费记录「申请免运费」→ 飞书审批（凡哥批，抄送张可心）；通过才不扣，审批中的账单不能推送
   - 按周出账（周一至周日，对齐每周结算单）；运营手动推送，进该商家下一张生成的结算单，从货款里扣
   - 发票按结算单单独开：一张结算单开一张「物流服务费」发票，未税 / GST / 含税 = 该结算单里各周账单之和
     （可跨周、跨店铺）；不和佣金/服务费合开。账单推送进商家当前未结算的结算单（结算单里多一项「取货运费」扣款），
     结算单生成时自动开票（与 aegis 佣金发票同一时点）
   ▍单价为未税价（2026-10-28 用户定）：每张周账单 GST = ROUND(应扣未税 × 9%, 2)，应扣含税 = 未税 + GST；结算单扣含税，发票未税 / GST 取各周账单之和
   ▍商家端：财务 › 取货运费（m-pickfee），只读；只显示同车店铺数，不显示是哪几家、车次、司机；App 同口径（v2/pickfee.js）
   依赖主文件全局：DB / money / toast / modal / closeModal / drawer / closeDrawer / render / ts */
(function(){

const SHOPS = {
  'SH2026062000001':{name:'绿鲜源蔬果旗舰店', merchant:'M2026-0815', first:'2026-07-02'},
  'SH2026070200004':{name:'海丰水产旗舰店',   merchant:'M2026-0902', first:'2026-07-10'},
  'SH2026070200005':{name:'万丰肉禽旗舰店',   merchant:'M2026-0902', first:'2026-07-08'},
  'SH2026071500006':{name:'南洋鲜果行',       merchant:'M2026-1008',           first:''},
  'SH2026062200003':{name:'阳光烘焙原料店',   merchant:'M2026-0820', first:'2026-08-01'},
  'SH2026080300008':{name:'金狮干货行',       merchant:'',           first:''},
};
const EXTRA_NAMES = {};   // 店铺管理里有、但还没有取货运费演示数据的店铺
const shopName = c => (SHOPS[c]||{}).name || EXTRA_NAMES[c] || c;
const MERCH = {'M2026-0815':'绿鲜源蔬果（新加坡）', 'M2026-0902':'海丰食品集团', 'M2026-0820':'阳光烘焙原料', 'M2026-1008':'南洋鲜果行'};   // 海丰集团名下两家店：海丰水产 + 万丰肉禽
const esc = s => String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const dash = '<span style="color:var(--ts)">—</span>';
const r2 = n => Math.round(n*100)/100;
const TODAY = '2026-10-27';
const PRICE = {NEAR:20, NORMAL:80}, MAX_POOL = 4, FREE_DAYS = 14, GST = 0.09;
const ZONE = {NEAR:'近区', NORMAL:'普通区', OFF:'不收费'};
const zoneStd = z => z=='NEAR' ? `${money(PRICE.NEAR)} / 次（未税），不拼车` : z=='NORMAL' ? `${money(PRICE.NORMAL)} / 车（未税），最多 ${MAX_POOL} 家拼车平摊` : '—';
const gstOf = n => Math.round(Math.round(n*100)*9/100)/100;   // ROUND(未税 × 9%, 2)
const ruleText = v => !v || v.zone=='OFF' ? '不收费' : `${ZONE[v.zone]} · ${zoneStd(v.zone)}`;
const zoneTag = z => z=='NEAR' ? '<span class="tag t-b"><span class="dot"></span>近区</span>' : z=='NORMAL' ? '<span class="tag t-g"><span class="dot"></span>普通区</span>' : '<span class="tag t-gr"><span class="dot"></span>不收费</span>';

/* 日期工具（按 UTC 算，避免时区漂移） */
const D = s => new Date(s+'T00:00:00Z');
const fmt = d => d.toISOString().slice(0,10);
const addDays = (s,n) => { const d=D(s); d.setUTCDate(d.getUTCDate()+n); return fmt(d); };
const monday = s => { const d=D(s), w=(d.getUTCDay()+6)%7; return addDays(s,-w); };
const weekLabel = m => `${m} ~ ${addDays(m,6)}`;
// 首次取货日期：SHOPS.first = 演示窗口之前已有的历史首取；没有则取取货记录里最早一天；都没有 = 还没取过货
const firstPick = s => (SHOPS[s]||{}).first || ((DB.pfPickups||[]).filter(p=>p.shop==s).map(p=>p.at.slice(0,10)).sort()[0]) || '';
/* 免运费（2026-10-30 沈亮定）：运营在上门提货配置里选「免运费 / 立即收费」；免运费填减免日期（起止，含两端）。
   规则版本带 fee:'FREE'|'CHARGE' + freeFrom/freeTo；按取货时间匹配的版本判断。
   老版本没有 fee 字段 = 原口径「首次取货起 14 天」 */
const legacyFree = s => { const f=firstPick(s); return f ? [f, addDays(f, FREE_DAYS-1)] : null; };
const freeRangeOf = (s,v) => !v ? null : v.fee=='CHARGE' ? null : v.fee=='FREE' ? [v.freeFrom, v.freeTo] : legacyFree(s);
const freeEnd = s => { const r=freeRangeOf(s, curRule(s)); return r ? r[1] : ''; };   // 当前规则下免运费最后一天（含）
const inFree = (s,date,at) => { const r=freeRangeOf(s, ruleAt(s, at||date+' 23:59')); return !!r && date>=r[0] && date<=r[1]; };
const freeDesc = v => !v||v.zone=='OFF' ? '—' : v.fee=='CHARGE' ? '立即收费' : v.fee=='FREE' ? `免运费 ${v.freeFrom} ~ ${v.freeTo}` : '首次取货起 14 天免运费';

/* ================= 规则版本：每次保存追加一版，from = 保存时刻（下一次取货起生效） ================= */
DB.pfRules = DB.pfRules || {
  'SH2026062000001':[{from:'2026-10-01 00:00', zone:'NORMAL', by:'林凯'}],
  'SH2026070200004':[{from:'2026-10-01 00:00', zone:'NORMAL', by:'林凯'}],
  'SH2026070200005':[{from:'2026-10-01 00:00', zone:'NORMAL', by:'林凯'},
                     {from:'2026-10-14 10:20', zone:'NEAR',   by:'陈敏'}],
  'SH2026071500006':[{from:'2026-10-08 00:00', zone:'NORMAL', by:'陈敏'}],
  'SH2026062200003':[{from:'2026-10-01 00:00', zone:'NORMAL', by:'林凯'}],
};
const curRule = s => { const v=DB.pfRules[s]; return v&&v.length ? v[v.length-1] : null; };
const ruleAt = (s,t) => (DB.pfRules[s]||[]).filter(v=>v.from<=t).pop() || null;

/* ================= 取货记录（物流每天排车的数据：每车哪几家商家） ================= */
const MARKETS = ['巴西班让批发中心','裕廊渔港','双溪加株批发市场'];
const DRIVERS = [['陈志明','GBA 2381K'],['Ahmad','GBC 7712M'],['林国强','GBD 1029P'],['Rajesh','GBE 5560T']];
if(!DB.pfPickups){
  const A='SH2026062000001',B='SH2026070200004',C='SH2026070200005',Dn='SH2026071500006',E='SH2026062200003';
  const p2=n=>String(n).padStart(2,'0');
  DB.pfPickups=[]; let seq=1;
  for(let s='2026-10-05'; s<=TODAY; s=addDays(s,1)){
    if(D(s).getUTCDay()==0) continue;                              // 周日不取货
    const d=+s.slice(8), pools=[[[A,B,Dn,E]],[[A,B,E],[Dn]],[[A,Dn],[B,E]],[[A,B,Dn,E],[A]]][d%4]
      .map(car=>car.filter(x=>x!=Dn||s>='2026-10-08')).filter(car=>car.length);
    if(d%2) pools.push([C]);                                       // 万丰单独一车，隔天取
    pools.forEach((car,k)=>{
      const trip=`TC${s.replace(/-/g,'')}${p2(k+1)}`, [driver,plate]=DRIVERS[(d+k)%4], at=`${s} ${p2(6+k)}:${p2((d*7+k*13)%50+5)}`;
      car.forEach(shop=>DB.pfPickups.push({no:`PK${s.replace(/-/g,'')}${p2(seq++)}`, shop, at, trip, mates:car.length,
        market:MARKETS[(d+k)%3], driver, plate}));
    });
  }
}
/* 免运费审批（超出免运费期还要免）：在取货明细勾选同一店铺的计费记录 → 提交飞书审批（审批人凡哥，抄送运营张可心）
   审批中：照常计费，所在周账单不能推送；通过：这些记录作废、不扣商家；驳回：恢复计费，可重新申请
   一张审批只针对一家店铺，可一次覆盖多天（避免一天一批） */
const APPROVER='凡哥', APV_CC='张可心';
if(!DB.pfApprovals){
  const firstOf=(shop,d1,d2)=>{ const seen={}; return DB.pfPickups.filter(p=>p.shop==shop&&p.at.slice(0,10)>=d1&&p.at.slice(0,10)<=d2)
    .sort((a,b)=>a.at.localeCompare(b.at)).filter(p=>!seen[p.at.slice(0,10)]&&(seen[p.at.slice(0,10)]=1)).map(p=>p.no); };
  DB.pfApprovals=[
    {id:'AP-20261021-0032', shop:'SH2026062000001', nos:['PK2026102164'], reason:'新品类试运营期，再免一天运费', by:'陈敏', at:'2026-10-21 11:20', st:'APPROVED', doneAt:'2026-10-21 15:02', cmt:'同意'},
    {id:'AP-20261026-0041', shop:'SH2026071500006', nos:firstOf('SH2026071500006','2026-10-22','2026-10-24'), reason:'商家首月货量小，免运费期延长 3 天', by:'陈敏', at:'2026-10-26 10:05', st:'PENDING'},
  ];
}
const apvOf = no => DB.pfApprovals.filter(a=>a.nos.includes(no)&&a.st!='REJECTED').pop() || null;
window.pfApvPending = () => DB.pfApprovals.filter(a=>a.st=='PENDING').length;

/* 计费：每店每天只在第一趟算一次 */
function pfCalc(){
  const first={};
  return DB.pfPickups.slice().sort((a,b)=>a.at.localeCompare(b.at)||a.no.localeCompare(b.no)).map(p=>{
    const v=ruleAt(p.shop,p.at), date=p.at.slice(0,10);
    if(!v || v.zone=='OFF') return {...p, rule:v, fee:0, charge:0, st:'NONE', basis:v?'规则为不收费':'未设置收费规则，不收费'};
    const k=p.shop+date;
    if(first[k]) return {...p, rule:v, fee:0, charge:0, st:'DUP', basis:`当天已在 ${first[k].trip} 计费，不重复收`, mBasis:`当天 ${first[k].at.slice(11)} 那趟已计费，不重复收`};
    first[k]={trip:p.trip, at:p.at};
    const fee = v.zone=='NEAR' ? PRICE.NEAR : r2(PRICE.NORMAL/p.mates);
    const basis = v.zone=='NEAR' ? `近区 · ${money(PRICE.NEAR)} / 次`
      : p.mates==1 ? `普通区 · 单独一车 ${money(PRICE.NORMAL)}` : `普通区 · ${money(PRICE.NORMAL)} ÷ 同车 ${p.mates} 家 = ${money(fee)}`;
    if(inFree(p.shop,date,p.at)) return {...p, rule:v, fee, charge:0, st:'FREE', basis};
    const ap=apvOf(p.no);
    if(ap&&ap.st=='APPROVED') return {...p, rule:v, fee, charge:0, st:'VOID', basis, apv:ap};
    if(ap&&ap.st=='PENDING') return {...p, rule:v, fee, charge:fee, st:'PENDING', basis, apv:ap};
    return {...p, rule:v, fee, charge:fee, st:'CHARGE', basis};
  });
}
const PST = {CHARGE:['计费','t-g'], FREE:['免运费期内','t-b'], PENDING:['免运费审批中','t-y'], VOID:['已减免','t-b'], DUP:['不重复收','t-gr'], NONE:['不收费','t-gr']};
const pstTag = p => PST[p.st] ? `<span class="tag ${PST[p.st][1]}"><span class="dot"></span>${PST[p.st][0]}</span>` : dash;

/* ================= 周账单：店铺 × 结算周 ================= */
DB.pfBills = DB.pfBills || {   // key = 店铺|周一日期
  'SH2026062000001|2026-10-05':{pushedAt:'2026-10-12 10:15', pushedBy:'林凯', stNo:'ST202606-M0815', reconDate:'2026-06-30'},
  'SH2026070200004|2026-10-05':{pushedAt:'2026-10-12 10:15', pushedBy:'林凯', stNo:'ST202606-SH2026070200004'},
  'SH2026070200005|2026-10-05':{pushedAt:'2026-10-12 10:16', pushedBy:'林凯', stNo:'ST202606-SH2026070200005'},
  'SH2026062200003|2026-10-05':{pushedAt:'2026-10-12 10:16', pushedBy:'林凯', stNo:'ST202606-SH2026062200003'},
  'SH2026062000001|2026-10-12':{pushedAt:'2026-10-19 09:40', pushedBy:'林凯', stNo:'ST202606-M0815', reconDate:'2026-07-01'},
};
const billNo = (s,m) => `PF-${m.replace(/-/g,'')}-${s}`;   // 用完整店铺编码，避免后 5 位撞号
/* 结算单：账单推送后挂到该商家「下一张生成的结算单」——当期单还没生成就进当期，已生成（不论是否认可）就进下一期，
   已生成的结算单不改（与《对账结算》BR-01 / 业务调整单 CLJS-20 同口径）。演示里 ST202606 的两张是结算单生成前推送的。物流服务费发票按结算单开：结算单生成时，就单里的取货运费合计自动开一张（与 aegis 佣金发票同一时点）
   结算单粒度 = 店铺 × 结算周期（以 aegis 现网为准，单号 ST{周期}-{店铺编码}）；演示里绿鲜源的结算单沿用结算单模块的当期单 ST202606-M0815 */
const merOf = s => (SHOPS[s]||{}).merchant || '';
DB.pfSettleSt = DB.pfSettleSt || {'ST202606-SH2026070200004':{st:'confirmed', at:'2026-10-14 16:20'}, 'ST202606-SH2026070200005':{st:'confirmed', at:'2026-10-14 16:22'}};   // 其他店铺结算单状态（演示）
DB.pfInvs = DB.pfInvs || {'ST202606-SH2026070200004':{invNo:'LOG-INV-2026-000012', at:'2026-10-14 16:20', net:180.01, gst:16.20, amt:196.21}, 'ST202606-SH2026070200005':{invNo:'LOG-INV-2026-000013', at:'2026-10-14 16:22', net:240.00, gst:21.60, amt:261.60}, 'ST202606-SH2026062200003':{invNo:'LOG-INV-2026-000011', at:'2026-10-13 03:05', net:180.01, gst:16.20, amt:196.21}};   // 结算单生成即开   // key = 结算单号
const ST_L = {none:['待生成','t-gr'], generated:['待商家认可','t-y'], confirmed:['已认可','t-b'], paid:['已打款','t-g'], voided:['已作废','t-gr']};
const stStatus = no => no==DB.bill.no ? (DB.payment=='paid'?'paid':DB.bill.status) : (DB.pfSettleSt[no]||{}).st || (no.startsWith(DB.bill.no.slice(0,8))?'generated':'none');
const stTag = no => { const [l,c]=ST_L[stStatus(no)]||ST_L.none; return `<span class="tag ${c}"><span class="dot"></span>${l}</span>`; };
const nextPeriod = no => { const y=+no.slice(2,6), m=+no.slice(6,8), n=m==12?[y+1,1]:[y,m+1]; return `ST${n[0]}${String(n[1]).padStart(2,'0')}`; };
const stKey = (base,shop) => SHOPS[shop].merchant==DB.merchant.code ? `${base}-M${DB.merchant.code.slice(-4)}` : `${base}-${shop}`;
function curSettle(shop){
  const base=DB.bill.no.slice(0,8), no=stKey(base,shop);
  return stStatus(no)=='none' ? no : stKey(nextPeriod(no),shop);   // 已生成的结算单不改，进下一张（与业务调整单 CLJS-20 同口径）
}
const allWeeks = () => [...new Set(DB.pfPickups.map(p=>monday(p.at.slice(0,10))))].sort().reverse();
function billsOf(m){
  const calc=pfCalc().filter(p=>monday(p.at.slice(0,10))==m);
  return Object.keys(SHOPS).map(s=>{
    const list=calc.filter(p=>p.shop==s); if(!list.length) return null;
    const st=DB.pfBills[s+'|'+m]||{}, sum=k=>r2(list.reduce((a,p)=>a+p[k],0));
    const fee=sum('fee'), due=sum('charge');
    const gst=gstOf(due);
    return {shop:s, wk:m, no:billNo(s,m), list, times:list.length, fee, waive:r2(fee-due), due, gst, incl:r2(due+gst),
      pushedAt:st.pushedAt||'', pushedBy:st.pushedBy||'', open:addDays(m,6)>=TODAY, wkEnd:addDays(m,6),
      reconDate:st.pushedAt?(st.reconDate||st.pushedAt.slice(0,10)):'',   // 对账单计入日 = 推送日（演示数据把两张已推送账单挂到对账单演示日期上）
      stNo:st.stNo||'', invNo:st.stNo?((DB.pfInvs[st.stNo]||{}).invNo||''):''};
  }).filter(Boolean);
}
const allBills = () => allWeeks().flatMap(billsOf);
/* 结算单维度（店铺 × 结算周期）：同一结算单里的取货运费账单（可跨周）合开一张票 */
function settles(){
  const out={};
  allBills().filter(b=>b.stNo).forEach(b=>(out[b.stNo]=out[b.stNo]||[]).push(b));
  return Object.entries(out).map(([no,list])=>({no, shop:list[0].shop, mc:merOf(list[0].shop), list, amt:r2(list.reduce((a,b)=>a+b.incl,0)), net:r2(list.reduce((a,b)=>a+b.due,0)), gst:r2(list.reduce((a,b)=>a+b.gst,0)), inv:DB.pfInvs[no]||null, shops:[...new Set(list.map(b=>b.shop))]}))
    .sort((a,b)=>b.no.localeCompare(a.no));
}
const invTag = t => t.inv ? '<span class="tag t-g"><span class="dot"></span>已开票</span>' : '<span class="tag t-y"><span class="dot"></span>待开票</span>';
// 结算单生成时调用：就单里取货运费合计开一张物流服务费发票（按结算单号幂等）
window.pfIssueInv = function(no){
  const t=settles().find(x=>x.no==no); if(!t||t.inv||!(t.amt>0)) return null;
  const n=Math.max(11,...Object.values(DB.pfInvs).map(v=>+v.invNo.slice(-6)))+1;
  return DB.pfInvs[no]={invNo:`LOG-INV-2026-${String(n).padStart(6,'0')}`, at:no==DB.bill.no&&DB.bill.genDate?DB.bill.genDate+' 03:05':ts(), net:t.net, gst:t.gst, amt:t.amt};
};
// 同步到结算单模块的当期单：扣款项 + 应结净额
window.pfSettleSync = function(){
  if(!DB.bill) return;
  const t=settles().find(x=>x.no==DB.bill.no);
  DB.bill.pick=t?t.amt:0; DB.bill.pickCnt=t?t.list.length:0; DB.bill.pickBills=t?t.list.map(b=>({no:b.no, shop:shopName(b.shop), range:weekLabel(b.wk), times:b.times, amt:b.incl})):[];
  DB.bill.items=(DB.bill.items||[]).filter(it=>it[0]!='取货运费（物流服务费·含税）');
  if(DB.bill.pick>0) DB.bill.items.push(['取货运费（物流服务费·含税）',DB.bill.pickCnt,-DB.bill.pick]);
  if(window.recalcBillNet) recalcBillNet();
  if(DB.bill.status&&DB.bill.status!='none'&&DB.bill.pick>0) pfIssueInv(DB.bill.no);   // 结算单已生成 → 开票
};
window.pfStInv = no => DB.pfInvs[no]||null;
// 商家端对账单：当天计入的取货运费账单（本店、已推送，计入日 = 推送日）
window.pfReconPicks = date => allBills().filter(b=>b.shop==myShop()&&b.pushedAt&&b.reconDate==date);
const invCell = b => b.invNo ? `<span class="mono">${b.invNo}</span>` : b.pushedAt ? '<span class="tag t-y"><span class="dot"></span>待开票</span>' : dash;
const billOf = (s,m) => billsOf(m).find(b=>b.shop==s);
const hasPending = b => b.list.some(p=>p.st=='PENDING');
const canPush = b => !b.open && b.due>0 && !b.pushedAt && !hasPending(b);
const billTag = b => b.open ? '<span class="tag t-gr"><span class="dot"></span>本周进行中</span>'
  : !b.due ? '<span class="tag t-gr"><span class="dot"></span>无需收费</span>'
  : !b.pushedAt && hasPending(b) ? '<span class="tag t-y"><span class="dot"></span>免运费审批中</span>'
  : !b.pushedAt ? '<span class="tag t-y"><span class="dot"></span>待推送</span>'
  : '<span class="tag t-g"><span class="dot"></span>已推送</span>';
const tSplit = t => t.inv ? {net:t.inv.net, gst:t.inv.gst} : {net:t.net, gst:t.gst};   // 发票未税 / GST = 各周账单之和

/* ================= 店铺管理 › 上门提货配置（2026-10-30 沈亮定：取货运费设置并入此弹窗，不再单独菜单） =================
   上半部分 1:1 照线上 h5-foodmax-platform 分支 onepaas-release-20261029164419-MKR：
     src/views/shop/components/ShopPickupConfigDialog.vue（弹窗）、src/services/common/typings/shop.d.ts:449 ShopPickupConfig / :473 ShopPickupConfigSaveReq
     接口 /platform/shop/pickupConfig/detail · /platform/shop/pickupConfig/save（src/services/common/shop.ts:198/205）
   下半部分「取货运费」为本期新增：所属区域（近区/普通区/不收费）随同一个「保存」提交，生成新规则版本，下一次取货起生效 */
DB.pickupCfg = DB.pickupCfg || {
  'SH2026062000001':{enabled:1, period:['2026-10-01','2026-12-31'], wh:'WH-SG01', st:'05:00', et:'07:00', addr:'Blk 16 Pasir Panjang Wholesale Centre #01-23', post:'110016', contact:'陈立', rc:'65', phone:'91234567'},
  'SH2026062200003':{enabled:1, period:['2026-10-01','2026-12-31'], wh:'WH-SG01', st:'06:00', et:'08:00', addr:'Blk 13 Pasir Panjang Wholesale Centre #01-08', post:'110013', contact:'李娜', rc:'65', phone:'88902231'},
};
const PK_WH = [['WH-SG01','Foodmax 大仓（Jurong）'],['WH-SG02','Foodmax 冷链仓（Tuas）']];
const PK_RULE = {'SH2026062000001':'营业日：周一至周六；每日截单 16:00', 'SH2026062200003':'营业日：周一至周日；每日截单 16:00'};
window.pfShopPickupOn = c => !!(DB.pickupCfg[c] && DB.pickupCfg[c].enabled);
window.pfShopPeriod = c => { const v=DB.pickupCfg[c]; return v&&v.period&&v.period[0] ? `${v.period[0]} 至 ${v.period[1]}` : '—'; };
window.pfShopZoneTag = c => { const v=curRule(c); return v ? zoneTag(v.zone) : '<span class="tag t-gr">未设置</span>'; };
window.pf_freeText = s => { const v=curRule(s);
  if(v && v.fee=='CHARGE') return '立即收费，无免运费期';
  if(v && v.fee=='FREE') return `${v.freeFrom} ~ ${v.freeTo}（含）免运费`;
  return firstPick(s) ? `${firstPick(s)} 首次取货，${freeEnd(s)} 前（含）免运费` : `还没有取货，首次取货起 ${FREE_DAYS} 天内免运费`; };

window.pf_pickupCfg=function(code,name){
  if(name && !SHOPS[code]) EXTRA_NAMES[code]=name;
  const c=DB.pickupCfg[code]||{enabled:0, period:['',''], wh:'', st:'', et:'', addr:'', post:'', contact:'', rc:'65', phone:''};
  const v=curRule(code), z=v?v.zone:'', fpd=firstPick(code);
  const fm = v&&v.fee ? v.fee : 'FREE';   // 首次设置 / 老版本默认「免运费」
  const fr = v&&v.fee=='FREE' ? [v.freeFrom,v.freeTo] : (legacyFree(code) || [TODAY.slice(0,10), addDays(TODAY,FREE_DAYS-1)]);
  const inp=(id,val,ph,ml)=>`<input id="${id}" value="${esc(val)}" ${ph?`placeholder="${ph}"`:''} ${ml?`maxlength="${ml}"`:''} style="width:100%">`;
  const fi=(label,body,span,req=true)=>`<div class="fr" style="${span?'grid-column:1 / -1;':''}margin:0"><label class="fl">${req?'<b style="color:var(--r)">*</b> ':''}${label}</label>${body}</div>`;
  const zopt=k=>`<label style="display:flex;align-items:flex-start;gap:8px;margin:0 0 8px;cursor:pointer"><input type="radio" name="pk-zone" value="${k}" ${z==k?'checked':''} onchange="pf_feeMode('${code}')" style="margin-top:3px"><span><span style="font-weight:600">${ZONE[k]}</span><span style="color:var(--ts);font-size:12.5px;margin-left:8px">${k=='NEAR'?'祝融、白斯班江一带 · '+zoneStd(k):k=='NORMAL'?'近区以外 · '+zoneStd(k):'不收取取货运费'}</span></span></label>`;
  modalWide(`<div class="mc-hd"><h3>上门提货配置 · ${esc(shopName(code))}（${code}）</h3><button class="mc-x" onclick="closeModal()">×</button></div>
  <div class="mc-bd">
    <label class="fl">上门提货</label>
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px">
      <label class="chip-ck ${c.enabled?'on':''}" id="pk-sw-l"><input type="checkbox" id="pk-sw" ${c.enabled?'checked':''} onchange="pf_pkToggle(this.checked)"><span id="pk-sw-t">${c.enabled?'已开启':'已关闭'}</span></label>
      <span style="font-size:12.5px;color:var(--ts)">周期内有实际订单才生成提货任务</span>
    </div>
    <div class="ib ib-b" style="margin-bottom:8px"><span class="i">ℹ️</span><div><b>安排说明：</b>平台仅在提货周期内，结合本店铺营业时间、每日截单时间及实际待提订单安排上门提货；当日无待提订单时，不生成提货任务。</div></div>
    <div class="ib ib-b" style="margin-bottom:14px"><span class="i">📋</span><div><b>店铺规则（只读）：</b>${PK_RULE[code]||'未获取到营业时间'}</div></div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px 16px">
      ${fi('提货周期',`<div style="display:flex;align-items:center;gap:8px"><input id="pk-ps" type="date" value="${c.period[0]||''}" style="flex:1"><span style="color:var(--ts)">至</span><input id="pk-pe" type="date" value="${c.period[1]||''}" style="flex:1"></div>`,true)}
      ${fi('收货仓',`<select id="pk-wh" style="width:100%"><option value="">请选择</option>${PK_WH.map(([k,l])=>`<option value="${k}" ${c.wh==k?'selected':''}>${l}</option>`).join('')}</select>`)}
      ${fi('提货时间',`<div style="display:flex;align-items:center;gap:8px"><input id="pk-st" type="time" value="${c.st}" style="flex:1"><span style="color:var(--ts)">至</span><input id="pk-et" type="time" value="${c.et}" style="flex:1"></div>`)}
      ${fi('提货地址',inp('pk-addr',c.addr,'请输入街道、楼名及门牌号',255),true)}
      ${fi('邮政编码',inp('pk-post',c.post,'',16))}
      ${fi('提货联系人',inp('pk-contact',c.contact,'',50))}
      ${fi('提货联系方式',`<div style="display:flex;gap:8px"><select id="pk-rc" style="width:96px"><option value="65" ${c.rc=='65'?'selected':''}>+65</option><option value="60" ${c.rc=='60'?'selected':''}>+60</option><option value="86" ${c.rc=='86'?'selected':''}>+86</option></select><input id="pk-phone" value="${esc(c.phone)}" maxlength="20" style="flex:1"></div>`)}
    </div>
    <div style="border-top:1px dashed var(--bd);margin:18px 0 12px"></div>
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
      <h4 style="margin:0;font-size:14px">取货运费</h4>
      ${v?`<button class="btn btn-link btn-sm" onclick="pf_hist('${code}')">变更记录</button>`:''}
    </div>
    <div class="fr"><label class="fl"><b style="color:var(--r)">*</b> 所属区域</label><div>${['NEAR','NORMAL','OFF'].map(zopt).join('')}</div></div>
    <div id="pk-fee-wrap" style="${z=='OFF'?'display:none':''}">
      <div class="fr"><label class="fl"><b style="color:var(--r)">*</b> 收费方式</label>
        <div style="display:flex;gap:24px">
          <label style="display:flex;align-items:center;gap:6px;cursor:pointer"><input type="radio" name="pk-fee" value="FREE" ${fm=='FREE'?'checked':''} onchange="pf_feeMode('${code}')"><span style="font-weight:600">免运费</span></label>
          <label style="display:flex;align-items:center;gap:6px;cursor:pointer"><input type="radio" name="pk-fee" value="CHARGE" ${fm=='CHARGE'?'checked':''} onchange="pf_feeMode('${code}')"><span style="font-weight:600">立即收费</span></label>
        </div></div>
      <div class="fr" id="pk-free-row" style="${fm=='FREE'?'':'display:none'}"><label class="fl"><b style="color:var(--r)">*</b> 减免日期</label>
        <div style="display:flex;align-items:center;gap:8px;max-width:420px"><input id="pk-ff" type="date" value="${fr[0]}" style="flex:1" onchange="pf_zoneHint('${code}')"><span style="color:var(--ts)">至</span><input id="pk-ft" type="date" value="${fr[1]}" style="flex:1" onchange="pf_zoneHint('${code}')"></div>
        <div style="font-size:12px;color:var(--ts);margin-top:5px">${fpd?`首次取货 ${fpd}，`:'还没有取货，'}默认按 ${FREE_DAYS} 天预填，可改；减免日期内的取货照常计费、应扣记 0</div></div>
      <div class="fr" id="pk-charge-row" style="${fm=='CHARGE'?'':'display:none'};font-size:12.5px;color:var(--ts)">保存后从下一次取货起收费，不再给免运费期</div>
    </div>
    <div style="font-size:13px"><div style="font-size:12px;color:var(--ts);margin-bottom:3px">当前规则</div>${v?`${ruleText(v)} · ${freeDesc(v)}<div style="font-size:12px;color:var(--ts)">${v.from} 起生效 · ${esc(v.by)}</div>`:'未设置（不收费）'}</div>
    <div class="ib ib-y" id="pk-zone-hint" style="margin-top:12px;display:none"></div>
    <div style="font-size:12px;color:var(--ts);margin-top:10px">单价为未税价，每张周账单另加 9% GST。关闭上门提货不会生成提货任务，也就不产生运费；所属区域保留。</div>
  </div>
  <div class="mc-ft"><button class="btn btn-o" onclick="closeModal()">取消</button><button class="btn btn-p" id="pk-save" onclick="pf_pkSave('${code}')">${c.enabled?'保存并开启':'保存并关闭'}</button></div>`);
};
window.pf_pkToggle=function(on){
  document.getElementById('pk-sw-l').classList.toggle('on',on);
  document.getElementById('pk-sw-t').textContent=on?'已开启':'已关闭';
  document.getElementById('pk-save').textContent=on?'保存并开启':'保存并关闭';
};
const pkRead = () => { const g=id=>(document.getElementById(id)||{}).value||'';
  const zone=(document.querySelector('input[name=pk-zone]:checked')||{}).value||'';
  const fee=zone=='OFF'?'':((document.querySelector('input[name=pk-fee]:checked')||{}).value||'');
  return fee=='FREE' ? {zone, fee, freeFrom:g('pk-ff'), freeTo:g('pk-ft')} : {zone, fee}; };
const ruleSame = (a,b) => !!a && a.zone==b.zone && (b.zone=='OFF' || ((a.fee||'')==b.fee && (b.fee!='FREE' || (a.freeFrom==b.freeFrom && a.freeTo==b.freeTo))));
window.pf_feeMode=function(code){
  const n=pkRead();
  document.getElementById('pk-fee-wrap').style.display = n.zone=='OFF' ? 'none' : '';
  document.getElementById('pk-free-row').style.display = n.fee=='FREE' ? '' : 'none';
  document.getElementById('pk-charge-row').style.display = n.fee=='CHARGE' ? '' : 'none';
  pf_zoneHint(code);
};
window.pf_zoneHint=function(code){
  const n=pkRead(), old=curRule(code), el=document.getElementById('pk-zone-hint');
  const changed = n.zone && (!old ? n.zone!='OFF' : !ruleSame(old,n));
  el.style.display=changed?'flex':'none';
  if(changed) el.innerHTML=`<span class="i">⚠️</span><div>取货运费将由「${old?ruleText(old)+' · '+freeDesc(old):'未设置（不收费）'}」改为「<b>${ruleText(n)}${n.zone=='OFF'?'':' · '+freeDesc(n)}</b>」，保存后从<b>下一次取货</b>起按新规则计费，已经取过的货不重算。</div>`;
};
window.pf_pkSave=function(code){
  const g=id=>(document.getElementById(id)||{}).value||'';
  const on=document.getElementById('pk-sw').checked;
  const f={enabled:on?1:0, period:[g('pk-ps'),g('pk-pe')], wh:g('pk-wh'), st:g('pk-st'), et:g('pk-et'), addr:g('pk-addr').trim(), post:g('pk-post').trim(), contact:g('pk-contact').trim(), rc:g('pk-rc'), phone:g('pk-phone').trim()};
  const n=pkRead(), z=n.zone;
  if(on){
    const miss=!f.period[0]||!f.period[1]||!f.wh||!f.st||!f.et||!f.addr||!f.post||!f.contact||!f.rc||!f.phone;
    if(miss){toast('请先补全必填项再开启上门提货','err');return;}
    if(!z){toast('请选择取货运费所属区域','err');return;}
  }
  if(z && z!='OFF'){
    if(!n.fee){toast('请选择收费方式','err');return;}
    if(n.fee=='FREE'){
      if(!n.freeFrom||!n.freeTo){toast('请填写减免日期','err');return;}
      if(n.freeFrom>n.freeTo){toast('减免开始日期不能晚于结束日期','err');return;}
      if(n.freeTo<TODAY){toast('减免结束日期不能早于今天','err');return;}
    }
  }
  if(f.period[0]&&f.period[1]&&f.period[0]>f.period[1]){toast('提货周期开始日期不能晚于结束日期','err');return;}
  if(f.st&&f.et&&f.st>=f.et){toast('提货开始时间需早于结束时间','err');return;}
  DB.pickupCfg[code]=f;
  const old=curRule(code); let msg='已保存';
  if(z && (old ? !ruleSame(old,n) : z!='OFF')){ (DB.pfRules[code]=DB.pfRules[code]||[]).push({...n, from:ts(), by:'当前账号'}); msg='已保存，取货运费下一次取货起按新规则计费'; }
  closeModal(); render(); toast(msg,'ok');
};
window.pf_hist=function(s){
  const vers=(DB.pfRules[s]||[]).slice().reverse();
  drawer(`<div class="drawer-hd"><h3>取货运费变更记录 · ${esc(shopName(s))}</h3><span class="x" onclick="closeDrawer()">×</span></div>
  <div class="drawer-bd"><table><thead><tr><th>生效时间</th><th>所属区域</th><th>收费标准</th><th>收费方式</th><th>修改人</th></tr></thead><tbody>
    ${vers.map((v,i)=>`<tr><td class="mono" style="white-space:nowrap">${v.from}${i==0?' <span class="tag t-g" style="font-size:10.5px">当前</span>':''}</td><td>${ZONE[v.zone]}</td><td>${zoneStd(v.zone)}</td><td style="white-space:nowrap">${freeDesc(v)}</td><td>${esc(v.by)}</td></tr>`).join('')}
  </tbody></table></div>
  <div class="drawer-ft"><button class="btn btn-o" onclick="closeDrawer()">关闭</button></div>`);
};

/* ================= 页面：取货运费账单（周账单 / 取货明细） ================= */
const lastClosedWeek = () => allWeeks().find(m=>addDays(m,6)<TODAY) || allWeeks()[0];
DB.pfTab = DB.pfTab || 'BILL';
DB.pfFilter = DB.pfFilter || {shop:'', wk:lastClosedWeek()};
DB.pfSel = DB.pfSel || [];

PAGES['p-pickfee-bill']=()=>{
  const f=DB.pfFilter, hit=s=>!f.shop||f.shop==s;
  const bills=billsOf(f.wk).filter(b=>hit(b.shop));
  const picks=pfCalc().filter(p=>monday(p.at.slice(0,10))==f.wk&&hit(p.shop)).reverse();
  DB.pfSel=DB.pfSel.filter(no=>bills.some(b=>b.no==no&&canPush(b)));
  const apvs=DB.pfApprovals.filter(a=>hit(a.shop)).slice().sort((a,b)=>b.at.localeCompare(a.at));
  DB.pfVSel=(DB.pfVSel||[]).filter(no=>picks.some(p=>p.no==no&&canApply(p)));
  const sts=settles().filter(t=>!f.shop||t.shop==f.shop);
  const tabs=[['BILL','周账单',bills.length],['PICK','取货明细',picks.length],['INV','物流费发票',sts.length],['APV','免运费审批',apvs.filter(a=>a.st=='PENDING').length]];
  return `<div class="card" style="margin-bottom:14px"><div class="card-bd" style="display:flex;gap:16px;align-items:flex-end;flex-wrap:wrap;padding:14px 16px">
    <div><div style="font-size:12px;color:var(--ts);margin-bottom:5px">店铺</div><select id="pf-f-shop" style="min-width:180px"><option value="">全部</option>${Object.keys(SHOPS).map(s=>`<option value="${s}" ${f.shop==s?'selected':''}>${esc(shopName(s))}</option>`).join('')}</select></div>
    <div><div style="font-size:12px;color:var(--ts);margin-bottom:5px">结算周</div><select id="pf-f-wk" style="min-width:220px">${allWeeks().map(m=>`<option value="${m}" ${f.wk==m?'selected':''}>${weekLabel(m)}</option>`).join('')}</select></div>
    <button class="btn btn-p btn-sm" onclick="DB.pfFilter={shop:document.getElementById('pf-f-shop').value,wk:document.getElementById('pf-f-wk').value};DB.pfSel=[];render()">查询</button>
    <button class="btn btn-o btn-sm" onclick="DB.pfFilter={shop:'',wk:lastClosedWeek()};DB.pfSel=[];render()">重置</button>
  </div></div>
  <div class="tabs" style="margin-bottom:14px">${tabs.map(([k,l,n])=>`<div class="tab ${DB.pfTab==k?'active':''}" onclick="DB.pfTab='${k}';render()">${l}${n?`<span class="tb">${n}</span>`:''}</div>`).join('')}</div>
  ${DB.pfTab=='BILL'?billTable(bills):DB.pfTab=='PICK'?pickTable(picks):DB.pfTab=='INV'?invTable(sts):apvTable(apvs)}`;
};
window.lastClosedWeek=lastClosedWeek;
function billTable(bills){
  const sel=bills.filter(canPush), all=sel.length&&sel.every(b=>DB.pfSel.includes(b.no));
  return `<div class="card">
    <div class="selbar" style="display:flex;align-items:center;gap:10px;padding:10px 16px;background:#F0FBF4;border-bottom:1px solid var(--bd);font-size:13px">
      <span style="color:var(--ts)">已选 <b style="color:var(--tp)">${DB.pfSel.length}</b> 张</span><span style="flex:1"></span>
      <button class="btn btn-p btn-sm" ${DB.pfSel.length?'':'disabled'} onclick="pf_push(DB.pfSel.slice())">推送到结算单</button>
    </div>
    <div class="card-bd flush"><div style="overflow-x:auto"><table>
    <thead><tr><th style="width:34px"><input type="checkbox" title="全选待推送" ${all?'checked':''} ${sel.length?'':'disabled'} onclick="pf_selAll()"></th><th>账单号</th><th>店铺名称</th><th>店铺编码</th><th>结算周期</th><th style="text-align:right">取货次数</th><th style="text-align:right">计费（未税）</th><th style="text-align:right">减免（未税）</th><th style="text-align:right">应扣（未税）</th><th style="text-align:right">GST 9%</th><th style="text-align:right">应扣（含税）</th><th>状态</th><th>推送人</th><th>推送时间</th><th>结算单号</th><th>物流费发票</th><th>操作</th></tr></thead><tbody>
    ${bills.length?bills.map(b=>`<tr>
      <td>${canPush(b)?`<input type="checkbox" ${DB.pfSel.includes(b.no)?'checked':''} onclick="pf_toggle('${b.no}')">`:''}</td>
      <td class="mono" style="white-space:nowrap">${b.no}</td><td style="white-space:nowrap">${esc(shopName(b.shop))}</td><td class="mono">${b.shop}</td>
      <td style="white-space:nowrap">${weekLabel(b.wk)}</td>
      <td style="text-align:right">${b.times}</td><td style="text-align:right">${money(b.fee)}</td>
      <td style="text-align:right">${b.waive?money(b.waive):dash}</td><td style="text-align:right">${money(b.due)}</td><td style="text-align:right">${money(b.gst)}</td><td style="text-align:right"><b>${money(b.incl)}</b></td>
      <td>${billTag(b)}</td><td>${b.pushedBy?esc(b.pushedBy):dash}</td><td style="white-space:nowrap">${b.pushedAt||dash}</td>
      <td class="mono" style="white-space:nowrap">${b.stNo||dash}</td><td style="white-space:nowrap">${invCell(b)}</td>
      <td style="white-space:nowrap"><button class="btn btn-link" onclick="pf_bill('${b.shop}','${b.wk}')">明细</button>${canPush(b)?` <button class="btn btn-link" onclick="pf_push(['${b.no}'])">推送</button>`:''}</td>
    </tr>`).join(''):`<tr><td colspan="17"><div class="empty" style="padding:26px"><div class="e-ic">🚚</div><div class="e-t">该周没有取货记录</div></div></td></tr>`}
    </tbody></table></div></div></div>`;
}
window.pf_toggle=function(no){ const i=DB.pfSel.indexOf(no); i<0?DB.pfSel.push(no):DB.pfSel.splice(i,1); render(); };
window.pf_selAll=function(){
  const f=DB.pfFilter, ok=billsOf(f.wk).filter(b=>(!f.shop||f.shop==b.shop)&&canPush(b)).map(b=>b.no);
  DB.pfSel = ok.every(no=>DB.pfSel.includes(no)) ? [] : ok; render();
};
function pickTable(picks){
  const sel=DB.pfVSel, amt=r2(picks.filter(p=>sel.includes(p.no)).reduce((a,p)=>a+p.fee,0));
  return `<div class="card">
    <div class="selbar" style="display:flex;align-items:center;gap:10px;padding:10px 16px;background:#F0FBF4;border-bottom:1px solid var(--bd);font-size:13px">
      <span style="color:var(--ts)">已选 <b style="color:var(--tp)">${sel.length}</b> 条${sel.length?` · 减免 <b style="color:var(--tp)">${money(amt)}</b>`:''}</span><span style="flex:1"></span>
      <button class="btn btn-o btn-sm" onclick="pf_import()">导入取货数据</button>
      <button class="btn btn-p btn-sm" ${sel.length?'':'disabled'} title="${sel.length?'':'勾选同一店铺的计费记录后可申请'}" onclick="pf_apply(DB.pfVSel.slice())">申请免运费${sel.length?`（${sel.length}）`:''}</button>
    </div>
    <div class="card-bd flush"><div style="overflow-x:auto">${pickRows(picks,true,true)}</div></div></div>`;
}
const pushedOf = p => !!(DB.pfBills[p.shop+'|'+monday(p.at.slice(0,10))]||{}).pushedAt;
const canApply = p => p.st=='CHARGE' && !pushedOf(p);
function pickRows(picks,withShop,canOp){
  const cols=(withShop?12:11)+(canOp?2:0);
  return `<table><thead><tr>${canOp?'<th style="width:34px"></th>':''}<th>取货记录号</th>${withShop?'<th>店铺名称</th>':''}<th>取货时间</th><th>车次</th><th style="text-align:right">同车店铺数</th><th>取货地点</th><th>司机</th><th>所属区域</th><th>计费说明</th><th style="text-align:right">计费金额（未税）</th><th>状态</th>${canOp?'<th>免运费审批</th><th>操作</th>':''}</tr></thead><tbody>
    ${picks.length?picks.map(p=>`<tr>
      ${canOp?`<td>${canApply(p)?`<input type="checkbox" ${DB.pfVSel.includes(p.no)?'checked':''} onclick="pf_vToggle('${p.no}')">`:''}</td>`:''}
      <td class="mono" style="white-space:nowrap">${p.no}</td>${withShop?`<td style="white-space:nowrap">${esc(shopName(p.shop))}</td>`:''}
      <td class="mono" style="white-space:nowrap">${p.at}</td><td class="mono" style="white-space:nowrap">${p.trip}</td>
      <td style="text-align:right">${p.mates}</td><td style="white-space:nowrap">${p.market}</td><td style="white-space:nowrap">${esc(p.driver)}</td>
      <td style="white-space:nowrap">${p.rule?ZONE[p.rule.zone]:'不收费'}</td>
      <td style="font-size:12.5px;color:var(--ts)">${p.basis}</td>
      <td style="text-align:right">${p.fee?money(p.fee):money(0)}</td><td style="white-space:nowrap">${pstTag(p)}</td>
      ${canOp?`<td class="mono" style="white-space:nowrap">${p.apv?`<a class="btn-link" style="cursor:pointer" onclick="pf_apvDetail('${p.apv.id}')">${p.apv.id}</a>`:dash}</td>`:''}
      ${canOp?`<td style="white-space:nowrap">${canApply(p)?`<button class="btn btn-link" onclick="pf_apply(['${p.no}'])">申请免运费</button>`:dash}</td>`:''}</tr>`).join('')
    :`<tr><td colspan="${cols}"><div class="empty" style="padding:26px"><div class="e-ic">🚚</div><div class="e-t">没有取货记录</div></div></td></tr>`}
  </tbody></table>`;
}
const billByNo = no => billsOf(DB.pfFilter.wk).find(b=>b.no==no);
window.pf_bill=function(s,m){
  const b=billOf(s,m); if(!b) return;
  const kv=(k,v)=>`<div><div class="k">${k}</div><div class="v">${v}</div></div>`;
  drawer(`<div class="drawer-hd"><div><h3>取货运费账单 <span class="mono" style="font-size:12.5px;color:var(--ts)">${b.no}</span></h3><div style="margin-top:4px">${billTag(b)}</div></div><span class="x" onclick="closeDrawer()">×</span></div>
  <div class="drawer-bd">
    <div class="kv" style="margin-bottom:16px">
      ${kv('店铺',`${esc(shopName(s))}（${s}）`)}${kv('结算周期',weekLabel(m))}
      ${kv('取货次数',b.times)}${kv('计费（未税）',money(b.fee))}${kv('减免（未税）',b.waive?money(b.waive):'—')}${kv('应扣（未税）',money(b.due))}${kv('GST 9%',money(b.gst))}${kv('应扣（含税）',money(b.incl))}
      ${kv('推送人',b.pushedBy?esc(b.pushedBy):'—')}${kv('推送时间',b.pushedAt||'—')}
      ${kv('结算单号',b.stNo?`<span class="mono">${b.stNo}</span>`:'—')}${kv('结算单状态',b.stNo?stTag(b.stNo):'—')}${kv('物流费发票',b.invNo?`<a class="btn-link" style="cursor:pointer" onclick="pf_inv('${b.stNo}')">${b.invNo}</a>`:b.pushedAt?'随结算单开票':'—')}
    </div>
    ${pickRows(b.list.slice().reverse(),false,false)}
  </div>
  <div class="drawer-ft"><button class="btn btn-o" onclick="closeDrawer()">关闭</button>${canPush(b)?`<button class="btn btn-p" onclick="closeDrawer();pf_push(['${b.no}'])">推送到结算单</button>`:''}</div>`);
};
window.pf_push=function(nos){
  const list=nos.map(billByNo).filter(b=>b&&canPush(b));
  if(!list.length){toast('请选择待推送的账单','err');return;}
  const total=r2(list.reduce((a,b)=>a+b.incl,0));
  modal(`<div class="mc-hd"><h3>推送到结算单</h3><button class="mc-x" onclick="closeModal()">×</button></div><div class="mc-bd">
    <table class="subtbl"><thead><tr><th>账单号</th><th>店铺</th><th>结算周期</th><th>预计进入结算单</th><th style="text-align:right">应扣（含税）</th></tr></thead><tbody>
      ${list.map(b=>`<tr><td class="mono">${b.no}</td><td>${esc(shopName(b.shop))}</td><td style="white-space:nowrap">${weekLabel(b.wk)}</td><td class="mono">${curSettle(b.shop)}</td><td style="text-align:right">${money(b.incl)}</td></tr>`).join('')}
    </tbody></table>
    <div class="ib ib-y" style="margin-top:12px"><span class="i">⚠️</span>共 <b>${list.length}</b> 张、<b>${money(total)}</b>。推送后进入该商家下一张生成的结算单（已生成的结算单不改；结算单号在结算单生成时确定），作为「取货运费」扣款项从货款中扣除；账单不能再修改。结算单生成时，就单里的取货运费单独开一张物流服务费发票（未税 + 9% GST）。</div>
  </div><div class="mc-ft"><button class="btn btn-o" onclick="closeModal()">取消</button><button class="btn btn-p" onclick='pf_pushDo(${JSON.stringify(list.map(b=>b.no))})'>确认推送</button></div>`);
};
window.pf_pushDo=function(nos){
  nos.map(billByNo).filter(Boolean).forEach(b=>{
    Object.assign(DB.pfBills[b.shop+'|'+b.wk]=DB.pfBills[b.shop+'|'+b.wk]||{}, {pushedAt:ts(), pushedBy:'当前账号', stNo:curSettle(b.shop)});
  });
  pfSettleSync();
  DB.pfSel=[]; closeModal(); render(); toast(`已推送 ${nos.length} 张账单到结算单`,'ok');
};
function invTable(sts){
  return `<div class="card"><div class="card-bd flush"><div style="overflow-x:auto"><table>
    <thead><tr><th>结算单号</th><th>店铺名称</th><th>店铺编码</th><th style="text-align:right">账单数</th><th style="text-align:right">未税金额</th><th style="text-align:right">GST（9%）</th><th style="text-align:right">发票金额（含税）</th><th>结算单状态</th><th>开票状态</th><th>发票号码</th><th>开票时间</th><th>操作</th></tr></thead><tbody>
    ${sts.length?sts.map(t=>{ const a=t.inv?t.inv.amt:t.amt, iv=tSplit(t); return `<tr>
      <td class="mono" style="white-space:nowrap">${t.no}</td><td style="white-space:nowrap">${esc(shopName(t.shop))}</td><td class="mono">${t.shop}</td>
      <td style="text-align:right">${t.list.length}</td>
      <td style="text-align:right">${money(iv.net)}</td><td style="text-align:right">${money(iv.gst)}</td><td style="text-align:right"><b>${money(a)}</b></td>
      <td style="white-space:nowrap">${stTag(t.no)}</td><td style="white-space:nowrap">${invTag(t)}</td><td class="mono" style="white-space:nowrap">${t.inv?t.inv.invNo:dash}</td><td style="white-space:nowrap">${t.inv?t.inv.at:dash}</td>
      <td style="white-space:nowrap"><button class="btn btn-link" onclick="pf_inv('${t.no}')">明细</button>${t.inv?` <button class="btn btn-link" onclick="toast('演示：已下载 ${t.inv.invNo}.pdf','info')">下载</button>`:''}</td>
    </tr>`;}).join(''):`<tr><td colspan="12"><div class="empty" style="padding:26px"><div class="e-ic">🧾</div><div class="e-t">还没有推送进结算单的账单</div></div></td></tr>`}
    </tbody></table></div></div></div>`;
}
window.pf_inv=function(no){
  const t=settles().find(x=>x.no==no); if(!t) return;
  const a=t.inv?t.inv.amt:t.amt, iv=tSplit(t), kv=(k,v)=>`<div><div class="k">${k}</div><div class="v">${v}</div></div>`;
  drawer(`<div class="drawer-hd"><div><h3>物流服务费发票 · <span class="mono" style="font-size:13px">${t.no}</span></h3><div style="margin-top:4px">${invTag(t)}</div></div><span class="x" onclick="closeDrawer()">×</span></div>
  <div class="drawer-bd">
    <div class="kv" style="margin-bottom:16px">
      ${kv('店铺',`${esc(shopName(t.shop))}（${t.shop}）`)}${kv('结算单号',`<span class="mono">${t.no}</span>`)}${kv('结算单状态',stTag(t.no))}
      ${kv('开票类目','物流服务费')}${kv('发票号码',t.inv?`<span class="mono">${t.inv.invNo}</span>`:'—')}${kv('开票时间',t.inv?t.inv.at:'—')}
      ${kv('未税金额',money(iv.net))}${kv('GST（9%）',money(iv.gst))}${kv('发票金额（含税）',money(a))}
    </div>
    <table><thead><tr><th>账单号</th><th>店铺名称</th><th>结算周期</th><th style="text-align:right">应扣（未税）</th><th style="text-align:right">GST</th><th style="text-align:right">应扣（含税）</th></tr></thead><tbody>
      ${t.list.map(b=>`<tr><td class="mono">${b.no}</td><td>${esc(shopName(b.shop))}</td><td style="white-space:nowrap">${weekLabel(b.wk)}</td><td style="text-align:right">${money(b.due)}</td><td style="text-align:right">${money(b.gst)}</td><td style="text-align:right">${money(b.incl)}</td></tr>`).join('')}
    </tbody></table>
  </div>
  <div class="drawer-ft">${t.inv?`<button class="btn btn-o" onclick="toast('演示：已下载 ${t.inv.invNo}.pdf','info')">下载发票</button>`:''}<button class="btn btn-p" onclick="closeDrawer()">关闭</button></div>`);
};
window.pf_vToggle=function(no){
  const p=pfCalc().find(x=>x.no==no), other=DB.pfVSel.length&&pfCalc().find(x=>x.no==DB.pfVSel[0]);
  const i=DB.pfVSel.indexOf(no);
  if(i<0&&other&&other.shop!=p.shop){toast('一张审批只能选同一家店铺的记录','err');return;}
  i<0?DB.pfVSel.push(no):DB.pfVSel.splice(i,1); render();
};
window.pf_apply=function(nos){
  const all=pfCalc(), list=nos.map(n=>all.find(x=>x.no==n)).filter(p=>p&&canApply(p));
  if(!list.length){toast('请勾选要免运费的计费记录','err');return;}
  if(new Set(list.map(p=>p.shop)).size>1){toast('一张审批只能选同一家店铺的记录','err');return;}
  const amt=r2(list.reduce((a,p)=>a+p.fee,0)), s=list[0].shop;
  modal(`<div class="mc-hd"><h3>申请免运费</h3><p>${esc(shopName(s))} · 超出免运费期，需审批通过才不扣</p><button class="mc-x" onclick="closeModal()">×</button></div><div class="mc-bd">
    <table class="subtbl"><thead><tr><th>取货记录号</th><th>取货时间</th><th style="text-align:right">计费金额（未税）</th></tr></thead><tbody>
      ${list.map(p=>`<tr><td class="mono">${p.no}</td><td class="mono">${p.at}</td><td style="text-align:right">${money(p.fee)}</td></tr>`).join('')}
      <tr style="font-weight:600"><td colspan="2">减免合计</td><td style="text-align:right">${money(amt)}</td></tr>
    </tbody></table>
    <div class="fr" style="margin-top:12px"><label class="fl"><b>*</b>申请原因</label><textarea id="pf-a-reason" rows="2" maxlength="200" placeholder="例如：商家首月货量小，免运费期延长 3 天"></textarea></div>
    <div class="fr"><label class="fl">审批人 / 抄送</label><div style="font-size:13px;padding-top:2px">${APPROVER}（飞书审批） / ${APV_CC}</div></div>
  </div><div class="mc-ft"><button class="btn btn-o" onclick="closeModal()">取消</button><button class="btn btn-p" onclick='pf_applyDo(${JSON.stringify(list.map(p=>p.no))})'>提交审批</button></div>`);
};
window.pf_applyDo=function(nos){
  const reason=document.getElementById('pf-a-reason').value.trim();
  if(!reason){toast('请填写申请原因','err');return;}
  const shop=DB.pfPickups.find(p=>p.no==nos[0]).shop, t=ts();
  const id=`AP-${t.slice(0,10).replace(/-/g,'')}-${String(DB.pfApprovals.length+42).padStart(4,'0')}`;
  DB.pfApprovals.push({id, shop, nos, reason, by:'当前账号', at:t, st:'PENDING'});
  DB.pfVSel=[]; closeModal(); render(); toast(`已提交飞书审批 ${id}，等${APPROVER}审批`,'ok');
};
const APV_ST = {PENDING:['审批中','t-y'], APPROVED:['已通过','t-g'], REJECTED:['已驳回','t-r']};
const apvTag = a => `<span class="tag ${APV_ST[a.st][1]}"><span class="dot"></span>${APV_ST[a.st][0]}</span>`;
const apvAmt = a => { const all=pfCalc(); return r2(a.nos.reduce((s,n)=>s+((all.find(x=>x.no==n)||{}).fee||0),0)); };
function apvTable(apvs){
  return `<div class="card"><div class="card-bd flush"><div style="overflow-x:auto"><table>
    <thead><tr><th>审批编号</th><th>店铺名称</th><th style="text-align:right">取货记录数</th><th style="text-align:right">减免金额（未税）</th><th>申请原因</th><th>申请人</th><th>申请时间</th><th>审批人</th><th>审批状态</th><th>审批时间</th><th>操作</th></tr></thead><tbody>
    ${apvs.length?apvs.map(a=>`<tr>
      <td class="mono" style="white-space:nowrap">${a.id}</td><td style="white-space:nowrap">${esc(shopName(a.shop))}</td>
      <td style="text-align:right">${a.nos.length}</td><td style="text-align:right">${money(apvAmt(a))}</td>
      <td style="max-width:240px">${esc(a.reason)}</td><td>${esc(a.by)}</td><td style="white-space:nowrap">${a.at}</td><td>${APPROVER}</td>
      <td>${apvTag(a)}</td><td style="white-space:nowrap">${a.doneAt||dash}</td>
      <td><button class="btn btn-link" onclick="pf_apvDetail('${a.id}')">详情</button></td>
    </tr>`).join(''):`<tr><td colspan="11"><div class="empty" style="padding:26px"><div class="e-ic">📝</div><div class="e-t">暂无免运费审批</div><div class="e-s">在「取货明细」勾选计费记录后申请</div></div></td></tr>`}
    </tbody></table></div></div></div>`;
}
window.pf_apvDetail=function(id){
  const a=DB.pfApprovals.find(x=>x.id==id); if(!a) return;
  const all=pfCalc(), list=a.nos.map(n=>all.find(x=>x.no==n)).filter(Boolean);
  const kv=(k,v)=>`<div><div class="k">${k}</div><div class="v">${v}</div></div>`;
  drawer(`<div class="drawer-hd"><div><h3>免运费审批 <span class="mono" style="font-size:12.5px;color:var(--ts)">${a.id}</span></h3><div style="margin-top:4px">${apvTag(a)}</div></div><span class="x" onclick="closeDrawer()">×</span></div>
  <div class="drawer-bd">
    <div class="kv" style="margin-bottom:16px">
      ${kv('店铺',`${esc(shopName(a.shop))}（${a.shop}）`)}${kv('减免金额（未税）',money(apvAmt(a)))}
      ${kv('申请人',esc(a.by))}${kv('申请时间',a.at)}${kv('审批人',APPROVER)}${kv('抄送',APV_CC)}
      ${kv('审批时间',a.doneAt||'—')}${kv('审批意见',a.cmt?esc(a.cmt):'—')}
      ${kv('申请原因',esc(a.reason))}
    </div>
    <table><thead><tr><th>取货记录号</th><th>取货时间</th><th>计费说明</th><th style="text-align:right">计费金额（未税）</th></tr></thead><tbody>
      ${list.map(p=>`<tr><td class="mono">${p.no}</td><td class="mono">${p.at}</td><td style="font-size:12.5px;color:var(--ts)">${p.basis}</td><td style="text-align:right">${money(p.fee)}</td></tr>`).join('')}
    </tbody></table>
  </div>
  <div class="drawer-ft"><button class="btn btn-o" onclick="closeDrawer()">关闭</button>${a.st=='PENDING'?`<button class="btn btn-o" onclick="pf_apvDone('${a.id}','REJECTED')">${APPROVER}驳回</button><button class="btn btn-p" onclick="pf_apvDone('${a.id}','APPROVED')">${APPROVER}通过</button>`:''}</div>`);
};
window.pf_apvDone=function(id,st){
  const a=DB.pfApprovals.find(x=>x.id==id); if(!a||a.st!='PENDING') return;
  Object.assign(a,{st, doneAt:ts(), cmt:st=='APPROVED'?'同意':'不同意，按规则收取'});
  closeDrawer(); render(); toast(st=='APPROVED'?'审批通过，这些运费不再扣商家':'审批驳回，恢复计费','ok');
};
window.pf_import=function(){
  modal(`<div class="mc-hd"><h3>导入取货数据</h3><button class="mc-x" onclick="closeModal()">×</button></div><div class="mc-bd">
    <div class="up" onclick="toast('演示：已选择 取货数据_2026-10-26.xlsx','info')"><div class="uic">📄</div><div class="ut">选择 Excel 文件</div><div class="us">列：作业日 / 车次 / 取货时间 / 店铺编码 / 取货地点 / 司机 / 车牌（均为必填，时间按新加坡时间）；同一车次的行按车次整车替换；物流回传过或已锁定（有店铺账单已推送 / 记录在审批中）的车次拒收；≤ 5,000 行</div></div>
    <div class="row" style="margin-top:10px"><button class="btn btn-link" onclick="toast('演示：模板已下载','info')">下载导入模板</button></div>
  </div><div class="mc-ft"><button class="btn btn-o" onclick="closeModal()">取消</button><button class="btn btn-p" onclick="closeModal();toast('演示：新增 0 条，覆盖 0 条，失败 0 条','info')">开始导入</button></div>`);
};

/* ================= 商家端：财务 › 取货运费（m-pickfee，只读） =================
   - 只看本商家的店铺；店铺从没设置过收费规则 → 不显示菜单
   - 账单、运费与运营端同一份计算（pfCalc）
   - 状态换成商家能懂的说法：待推送 → 待出账；已推送 → 已出账（结算时从货款扣）；作废 → 已减免
   - 物流服务费发票按结算单开（同一结算单的多家店铺合一张），账单上显示所在结算单号与发票号
   - 只显示同车店铺数，不显示是哪几家、车次、司机、车牌、数据来源；不显示推送人、规则修改人、审批原因与编号
   - 商家端按当前登录店铺显示（会话按店铺，切店查看另一家）；结算单按店铺出（aegis 现网），一张结算单一张物流服务费发票 */
const myShop = () => Object.keys(SHOPS).find(s=>SHOPS[s].merchant==DB.merchant.code) || '';
window.pfMerchantOn = () => { const s=myShop(); return !!(s && (DB.pfRules[s]||[]).length); };
const mBillTag = b => b.open ? '<span class="tag t-gr"><span class="dot"></span>本周进行中</span>'
  : !b.due ? '<span class="tag t-gr"><span class="dot"></span>无需收费</span>'
  : !b.pushedAt ? '<span class="tag t-y"><span class="dot"></span>待出账</span>'
  : '<span class="tag t-g"><span class="dot"></span>已出账</span>';
const MPST = {CHARGE:['计费','t-g'], PENDING:['计费','t-g'], FREE:['免运费期内','t-b'], VOID:['已减免','t-b'], DUP:['不重复收','t-gr'], NONE:['不收费','t-gr']};
const mPstTag = p => MPST[p.st] ? `<span class="tag ${MPST[p.st][1]}"><span class="dot"></span>${MPST[p.st][0]}</span>` : dash;
const myWeeks = s => [...new Set(DB.pfPickups.filter(p=>p.shop==s).map(p=>monday(p.at.slice(0,10))))].sort().reverse();
DB.pfMTab = DB.pfMTab || 'BILL';
DB.pfMWk = DB.pfMWk || '';

PAGES['m-pickfee']=()=>{
  const s=myShop(), v=curRule(s);
  if(!pfMerchantOn()) return `<div class="card"><div class="card-bd"><div class="empty"><div class="e-ic">🚚</div><div class="e-t">未开通取货运费</div><div class="e-s">平台没有为您的店铺设置取货运费，取货不收费</div></div></div></div>`;
  const wk=DB.pfMWk, weeks=myWeeks(s), fe=freeEnd(s);
  const bills=(wk?[wk]:weeks).map(m=>billOf(s,m)).filter(Boolean);
  const picks=pfCalc().filter(p=>p.shop==s&&(!wk||monday(p.at.slice(0,10))==wk)).reverse();
  const kv=(k,val)=>`<div><div class="k">${k}</div><div class="v">${val}</div></div>`;
  const tabs=[['BILL','周账单',bills.length],['PICK','取货明细',picks.length]];
  return `<div class="card" style="margin-bottom:14px"><div class="card-hd"><h3>当前收费规则</h3><button class="btn btn-o btn-sm" onclick="pf_mHist()">变更记录</button></div>
    <div class="card-bd"><div class="kv">
      ${kv('店铺',`${esc(shopName(s))}（<span class="mono">${s}</span>）`)}
      ${kv('所属区域',ZONE[v.zone])}
      ${kv('收费标准',v.zone=='NORMAL'?`${money(PRICE.NORMAL)} / 车（未税，另加 9% GST），最多 ${MAX_POOL} 家拼车，按同车店铺数平摊；同一天只收一次`:v.zone=='NEAR'?`${money(PRICE.NEAR)} / 次（未税，另加 9% GST）；同一天只收一次`:'—')}
      ${kv('免运费期',v.fee=='CHARGE'?'无（立即收费）':v.fee=='FREE'?`${v.freeFrom} ~ ${v.freeTo}${fe>=TODAY?' <span class="tag t-b" style="font-size:10.5px">免运费中</span>':''}`:fe?`首次取货起 ${FREE_DAYS} 天（${firstPick(s)} ~ ${fe}）${fe>=TODAY?' <span class="tag t-b" style="font-size:10.5px">免运费中</span>':''}`:`首次取货起 ${FREE_DAYS} 天内免运费`)}
      ${kv('生效时间',v.from)}
    </div></div></div>
  <div class="card" style="margin-bottom:14px"><div class="card-bd" style="display:flex;gap:16px;align-items:flex-end;flex-wrap:wrap;padding:14px 16px">
    <div><div style="font-size:12px;color:var(--ts);margin-bottom:5px">结算周</div><select id="pf-m-wk" style="min-width:220px"><option value="">全部</option>${weeks.map(m=>`<option value="${m}" ${wk==m?'selected':''}>${weekLabel(m)}</option>`).join('')}</select></div>
    <button class="btn btn-p btn-sm" onclick="DB.pfMWk=document.getElementById('pf-m-wk').value;render()">查询</button><button class="btn btn-o btn-sm" onclick="DB.pfMWk='';render()">重置</button>
  </div></div>
  <div class="tabs" style="margin-bottom:14px">${tabs.map(([k,l,n])=>`<div class="tab ${DB.pfMTab==k?'active':''}" onclick="DB.pfMTab='${k}';render()">${l}${n?`<span class="tb">${n}</span>`:''}</div>`).join('')}</div>
  ${DB.pfMTab=='BILL'?mBillTable(bills):`<div class="card"><div class="card-bd flush"><div style="overflow-x:auto">${mPickRows(picks)}</div></div></div>`}`;
};
function mBillTable(bills){
  return `<div class="card"><div class="card-bd flush"><div style="overflow-x:auto"><table>
    <thead><tr><th>账单号</th><th>结算周期</th><th style="text-align:right">取货次数</th><th style="text-align:right">计费（未税）</th><th style="text-align:right">减免（未税）</th><th style="text-align:right">应扣（未税）</th><th style="text-align:right">GST 9%</th><th style="text-align:right">应扣（含税）</th><th>账单状态</th><th>出账时间</th><th>结算单号</th><th>物流费发票</th><th>操作</th></tr></thead><tbody>
    ${bills.length?bills.map(b=>`<tr>
      <td class="mono" style="white-space:nowrap">${b.no}</td><td style="white-space:nowrap">${weekLabel(b.wk)}</td>
      <td style="text-align:right">${b.times}</td><td style="text-align:right">${money(b.fee)}</td>
      <td style="text-align:right">${b.waive?money(b.waive):dash}</td><td style="text-align:right">${money(b.due)}</td><td style="text-align:right">${money(b.gst)}</td><td style="text-align:right"><b>${money(b.incl)}</b></td>
      <td>${mBillTag(b)}</td><td style="white-space:nowrap">${b.pushedAt||dash}</td><td class="mono" style="white-space:nowrap">${b.stNo||dash}</td><td style="white-space:nowrap">${invCell(b)}</td>
      <td style="white-space:nowrap"><button class="btn btn-link" onclick="pf_mBill('${b.wk}')">明细</button>${b.invNo?` <button class="btn btn-link" onclick="toast('演示：已下载 ${b.invNo}.pdf','info')">下载发票</button>`:''}</td>
    </tr>`).join(''):`<tr><td colspan="13"><div class="empty" style="padding:26px"><div class="e-ic">🚚</div><div class="e-t">该周没有取货记录</div></div></td></tr>`}
    </tbody></table></div></div></div>`;
}
function mPickRows(picks){
  return `<table><thead><tr><th>取货记录号</th><th>取货时间</th><th style="text-align:right">同车店铺数</th><th>取货地点</th><th>计费说明</th><th style="text-align:right">计费金额（未税）</th><th>状态</th></tr></thead><tbody>
    ${picks.length?picks.map(p=>`<tr>
      <td class="mono" style="white-space:nowrap">${p.no}</td><td class="mono" style="white-space:nowrap">${p.at}</td>
      <td style="text-align:right">${p.mates}</td><td style="white-space:nowrap">${p.market}</td>
      <td style="font-size:12.5px;color:var(--ts)">${p.mBasis||p.basis}</td>
      <td style="text-align:right">${money(p.fee)}</td><td style="white-space:nowrap">${mPstTag(p)}</td></tr>`).join('')
    :`<tr><td colspan="7"><div class="empty" style="padding:26px"><div class="e-ic">🚚</div><div class="e-t">没有取货记录</div></div></td></tr>`}
  </tbody></table>`;
}
window.pf_mBill=function(m){
  const s=myShop(), b=billOf(s,m); if(!b) return;
  const kv=(k,val)=>`<div><div class="k">${k}</div><div class="v">${val}</div></div>`;
  
  drawer(`<div class="drawer-hd"><div><h3>取货运费账单 <span class="mono" style="font-size:12.5px;color:var(--ts)">${b.no}</span></h3><div style="margin-top:4px">${mBillTag(b)}</div></div><span class="x" onclick="closeDrawer()">×</span></div>
  <div class="drawer-bd">
    <div class="kv" style="margin-bottom:16px">
      ${kv('结算周期',weekLabel(m))}${kv('取货次数',b.times)}
      ${kv('计费（未税）',money(b.fee))}${kv('减免（未税）',b.waive?money(b.waive):'—')}${kv('应扣（未税）',money(b.due))}${kv('GST 9%',money(b.gst))}${kv('应扣（含税）',money(b.incl))}
      ${kv('出账时间',b.pushedAt||'—')}${kv('扣款方式',b.pushedAt?'结算时从货款中扣除':'—')}
      ${kv('结算单号',b.stNo?`<a class="btn-link mono" style="cursor:pointer" onclick="closeDrawer();nav('m-settle')">${b.stNo}</a>`:'—')}${kv('物流服务费发票',b.invNo?`<a class="btn-link mono" style="cursor:pointer" onclick="closeDrawer();DB.invTab='logi';nav('m-invoice')">${b.invNo}</a>`:(b.pushedAt?'随结算单开票':'—'))}
    </div>
    ${mPickRows(b.list.slice().reverse())}
  </div>
  <div class="drawer-ft">${b.invNo?`<button class="btn btn-o" onclick="toast('演示：已下载 ${b.invNo}.pdf','info')">下载发票</button>`:''}<button class="btn btn-p" onclick="closeDrawer()">关闭</button></div>`);
};
/* 商家端 · 发票管理 › ⑤ 物流服务费发票：一张结算单一行（本商家） */
window.pfInvoiceContent=function(){
  const rows=settles().filter(t=>t.shop==myShop());
  return `<div class="card"><div class="card-hd"><h3>物流服务费发票</h3></div><div class="card-bd ${rows.length?'flush':''}">${rows.length?`<div style="overflow-x:auto"><table>
    <thead><tr><th>发票号码</th><th>结算单号</th><th style="text-align:right">取货运费账单数</th><th style="text-align:right">未税金额</th><th style="text-align:right">GST（9%）</th><th style="text-align:right">发票金额（含税）</th><th>开票状态</th><th>开票时间</th><th>操作</th></tr></thead><tbody>
    ${rows.map(t=>{const a=t.inv?t.inv.amt:t.amt, iv=tSplit(t);return `<tr>
      <td class="mono" style="white-space:nowrap">${t.inv?t.inv.invNo:dash}</td><td class="mono" style="white-space:nowrap">${t.no}</td><td style="text-align:right">${t.list.length}</td>
      <td style="text-align:right">${money(iv.net)}</td><td style="text-align:right">${money(iv.gst)}</td><td style="text-align:right"><b>${money(a)}</b></td>
      <td>${invTag(t)}</td><td style="white-space:nowrap">${t.inv?t.inv.at:dash}</td>
      <td style="white-space:nowrap">${t.inv?`<button class="btn btn-link" onclick="toast('演示：已下载 ${t.inv.invNo}.pdf','info')">下载</button>`:dash}</td></tr>`;}).join('')}
    </tbody></table></div>`:'<div class="empty"><div class="e-ic">🧾</div><div class="e-t">暂无物流服务费发票</div><div class="e-s">认可含取货运费的结算单后自动开具</div></div>'}</div></div>`;
};
window.pf_mHist=function(){
  const s=myShop(), vers=(DB.pfRules[s]||[]).slice().reverse();
  drawer(`<div class="drawer-hd"><h3>收费规则变更记录</h3><span class="x" onclick="closeDrawer()">×</span></div>
  <div class="drawer-bd"><table><thead><tr><th>生效时间</th><th>所属区域</th><th>收费标准</th><th>收费方式</th></tr></thead><tbody>
    ${vers.map((v,i)=>`<tr><td class="mono" style="white-space:nowrap">${v.from}${i==0?' <span class="tag t-g" style="font-size:10.5px">当前</span>':''}</td><td>${ZONE[v.zone]}</td><td>${zoneStd(v.zone)}</td><td style="white-space:nowrap">${freeDesc(v)}</td></tr>`).join('')}
  </tbody></table></div>
  <div class="drawer-ft"><button class="btn btn-o" onclick="closeDrawer()">关闭</button></div>`);
};

pfSettleSync();

})();
