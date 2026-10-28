/* Food Max 商家端 v2 · 财务 › 取货运费（与 PC pc-modules/pickfee.js 商家端 m-pickfee 同口径；2026-10-27 会议定）
   - 平台按店铺指定所属区域，商家只读：
       近区（祝融、白斯班江一带）S$20 / 次，不拼车；普通区 S$80 / 车，最多 4 家拼车，按同车店铺数平摊
   - 同一天只收一次（按当天第一趟所在的车算）；改区域下一次取货起生效
   - 免运费期：有了第一次取货任务起 14 天内免运费（含首取当天）；超出免运费期还要免的，平台走飞书审批（凡哥批）通过后不扣，商家这边显示「已减免」
   - 按周出账（周一至周日），推送后进入下一张生成的结算单（已生成的不改），从货款扣；物流服务费发票按结算单单独开（一张结算单一张票，9% GST），结算单生成时开（与 aegis 佣金发票同一时点）
   - 只显示同车店铺数，不显示是哪几家、车次、司机；按当前登录店铺显示
   - 演示数据与 PC 一致（绿鲜源蔬果旗舰店 SH2026062000001，普通区）
   样式复用 replen.js 注入的 .rp-* 类 */
(function(){
const {pushPage,toast,svg,skel}=window.FM;
const money=n=>'S$'+(+n||0).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
const DB=window.FM.DB;
const SHOP={code:'SH2026062000001',name:'绿鲜源蔬果旗舰店',first:'2026-07-02'};   // first = 首次取货日期（演示窗口之前的历史首取）
const TODAY='2026-10-27',PRICE={NEAR:20,NORMAL:80},MAX_POOL=4,FREE_DAYS=14,GST=0.09;
const ZONE={NEAR:'近区',NORMAL:'普通区',OFF:'不收费'};
const r2=n=>Math.round(n*100)/100;
const D=s=>new Date(s+'T00:00:00Z'),fmt=d=>d.toISOString().slice(0,10);
const addDays=(s,n)=>{const d=D(s);d.setUTCDate(d.getUTCDate()+n);return fmt(d);};
const monday=s=>addDays(s,-((D(s).getUTCDay()+6)%7));
const weekLabel=m=>`${m} ~ ${addDays(m,6).slice(5)}`;
const freeEnd=addDays(SHOP.first,FREE_DAYS-1);
const zoneStd=z=>z==='NEAR'?`${money(PRICE.NEAR)} / 次（未税），不拼车`:z==='NORMAL'?`${money(PRICE.NORMAL)} / 车（未税），最多 ${MAX_POOL} 家拼车平摊`:'—';
const gstOf=n=>Math.round(Math.round(n*100)*9/100)/100;   // 单价为未税价：每张周账单 GST = ROUND(应扣未税 × 9%, 2)（2026-10-28 定）

DB.pfRules=DB.pfRules||[{from:'2026-10-01 00:00',zone:'NORMAL'}];
DB.pfBills=DB.pfBills||{
  '2026-10-05':{pushedAt:'2026-10-12 10:15',stNo:'ST202606-M0815'},   // 结算单 ST202606 生成前推送，已归入该单
  '2026-10-12':{pushedAt:'2026-10-19 09:40',stNo:'ST202606-M0815'},
};
DB.pfInvs=DB.pfInvs||{};   // 物流服务费发票：key = 结算单号，结算单生成时开（与 aegis 佣金发票同一时点）
DB.pfVoids=DB.pfVoids||{'PK2026102164':{}};   // 与 PC 一致：飞书免运费审批通过（凡哥批）的一笔，商家这边显示已减免
const ruleAt=t=>DB.pfRules.filter(v=>v.from<=t).pop()||null;
const curRule=()=>DB.pfRules[DB.pfRules.length-1]||null;

/* 取货记录：与 PC 同一套排车（只留本店的记录，同车店铺数照算） */
if(!DB.pfPickups){
  const A=SHOP.code,B='B',C='C',Dn='D',E='E',p2=n=>String(n).padStart(2,'0'),MK=['巴西班让批发中心','裕廊渔港','双溪加株批发市场'];
  DB.pfPickups=[];let seq=1;
  for(let s='2026-10-05';s<=TODAY;s=addDays(s,1)){
    if(D(s).getUTCDay()===0)continue;
    const d=+s.slice(8),pools=[[[A,B,Dn,E]],[[A,B,E],[Dn]],[[A,Dn],[B,E]],[[A,B,Dn,E],[A]]][d%4]
      .map(car=>car.filter(x=>x!==Dn||s>='2026-10-08')).filter(car=>car.length);
    if(d%2)pools.push([C]);
    pools.forEach((car,k)=>{const at=`${s} ${p2(6+k)}:${p2((d*7+k*13)%50+5)}`;
      car.forEach(shop=>{const no=`PK${s.replace(/-/g,'')}${p2(seq++)}`;
        if(shop===A)DB.pfPickups.push({no,at,mates:car.length,market:MK[(d+k)%3]});});});
  }
}
function calc(){
  const first={};
  return DB.pfPickups.slice().sort((a,b)=>a.at.localeCompare(b.at)||a.no.localeCompare(b.no)).map(p=>{
    const v=ruleAt(p.at),date=p.at.slice(0,10);
    if(!v||v.zone==='OFF')return {...p,rule:v,fee:0,charge:0,st:'NONE',basis:v?'规则为不收费':'未设置收费规则，不收费'};
    if(first[date])return {...p,rule:v,fee:0,charge:0,st:'DUP',basis:`当天 ${first[date].slice(11)} 那趟已计费，不重复收`};
    first[date]=p.at;
    const fee=v.zone==='NEAR'?PRICE.NEAR:r2(PRICE.NORMAL/p.mates);
    const basis=v.zone==='NEAR'?`近区 · ${money(PRICE.NEAR)} / 次`:p.mates===1?`普通区 · 单独一车 ${money(PRICE.NORMAL)}`:`普通区 · ${money(PRICE.NORMAL)} ÷ 同车 ${p.mates} 家 = ${money(fee)}`;   // 与 PC 同文案
    if(DB.pfVoids[p.no])return {...p,rule:v,fee,charge:0,st:'VOID',basis};
    if(date<=freeEnd)return {...p,rule:v,fee,charge:0,st:'FREE',basis};
    return {...p,rule:v,fee,charge:fee,st:'CHARGE',basis};
  });
}
function bills(){
  const all=calc(),wks=[...new Set(all.map(p=>monday(p.at.slice(0,10))))].sort().reverse();
  return wks.map(m=>{const list=all.filter(p=>monday(p.at.slice(0,10))===m),st=DB.pfBills[m]||{},sum=k=>r2(list.reduce((a,p)=>a+p[k],0));
    const fee=sum('fee'),due=sum('charge');
    return {wk:m,no:`PF-${m.replace(/-/g,'')}-${SHOP.code}`,list,times:list.length,fee,waive:r2(fee-due),due,gst:gstOf(due),incl:r2(due+gstOf(due)),
      pushedAt:st.pushedAt||'',stNo:st.stNo||'',invNo:st.stNo&&DB.pfInvs[st.stNo]?DB.pfInvs[st.stNo].invNo:'',open:addDays(m,6)>=TODAY};});
}
const billSt=b=>b.open?'本周进行中':!b.due?'无需收费':!b.pushedAt?'待出账':'已出账';
const ST_C={'本周进行中':'rp-c-gray','无需收费':'rp-c-gray','待出账':'rp-c-amber','已出账':'rp-c-green'};
const PST={CHARGE:['计费','rp-c-green'],FREE:['免运费期内','rp-c-blue'],VOID:['已减免','rp-c-blue'],DUP:['不重复收','rp-c-gray'],NONE:['不收费','rp-c-gray']};
const chip=(t,c)=>`<span class="rp-chip ${c||'rp-c-gray'}">${t}</span>`;
const rowKV=(k,v,cls)=>`<div class="rp-row"><span class="k">${k}</span><span class="v ${cls||''}">${v||'—'}</span></div>`;
window.FM_MOD.pickfeeOn=()=>DB.pfRules.length>0;
/* 结算单联动（与 PC pfSettleSync / pfIssueInv 同口径） */
const inSettle=no=>bills().filter(b=>b.stNo===no);
window.FM_MOD.pickfeeInv=no=>DB.pfInvs[no]||null;
// 发票管理 › 物流服务费：一张结算单一张（invoice.js 调用）
window.FM_MOD.pickfeeInvList=()=>Object.entries(DB.pfInvs).map(([no,v])=>({stNo:no,...v,cnt:inSettle(no).length}));
window.FM_MOD.pickfeeIssue=no=>{const l=inSettle(no),amt=r2(l.reduce((a,b)=>a+b.incl,0));if(!amt||DB.pfInvs[no])return null;
  return DB.pfInvs[no]={invNo:'LOG-INV-2026-000014',at:'2026-07-01 03:05',net:r2(l.reduce((a,b)=>a+b.due,0)),gst:r2(l.reduce((a,b)=>a+b.gst,0)),amt};};
(function(){const cur=window.FM_MOD.settleCur&&FM_MOD.settleCur();if(!cur||cur.pick!=null)return;
  const l=inSettle(cur.no),amt=r2(l.reduce((a,b)=>a+b.incl,0));cur.pick=amt;cur.pickCnt=l.length;
  cur.pickBills=l.map(b=>({no:b.no,shop:SHOP.name,range:`${b.wk} ~ ${addDays(b.wk,6)}`,amt:b.incl}));
  if(amt>0){cur.items.push(['取货运费（物流服务费·含税）',l.length,-amt]);cur.net=r2(cur.net-amt);window.FM_MOD.pickfeeIssue(cur.no);}})();   // 结算单已生成 → 开票

let _tab='bill';
function open(){
  _tab='bill';
  const v=curRule();
  pushPage({title:'取货运费',body:`
    <div class="rp-card2"><div class="rp-ct">当前收费规则<span class="desc" id="pf-hist" style="color:var(--emerald-2);cursor:pointer;float:right;min-height:32px;line-height:32px;margin-top:-8px">变更记录 ›</span></div>
      ${rowKV('店铺',SHOP.name)}${rowKV('所属区域',ZONE[v.zone])}${rowKV('收费标准',zoneStd(v.zone))}
      ${rowKV('同一天',v.zone==='OFF'?'—':'只收一次')}
      ${rowKV('免运费期',`首次取货起 ${FREE_DAYS} 天（${SHOP.first} ~ ${freeEnd}）`)}${rowKV('生效时间',v.from)}</div>
    <div class="rp-tabs" id="pf-tabs"></div><div class="rp-list" id="pf-list"></div>`,
    mount:(p)=>{
      const tabs=p.querySelector('#pf-tabs'),list=p.querySelector('#pf-list');
      p.querySelector('#pf-hist').onclick=openHist;
      function drawTabs(){
        tabs.innerHTML=[['bill','周账单',bills().length],['pick','取货明细',calc().length]].map(([k,t,c])=>`<div class="rp-tab ${_tab===k?'on':''}" data-t="${k}">${t} ${c}</div>`).join('');
        tabs.querySelectorAll('.rp-tab').forEach(x=>x.onclick=()=>{if(_tab===x.dataset.t)return;_tab=x.dataset.t;drawTabs();drawList();});}
      function drawList(){
        list.innerHTML=skel(2);
        setTimeout(()=>{
          if(_tab==='bill'){
            const bs=bills();
            list.innerHTML=bs.length?bs.map((b,i)=>`<div class="rp-card" data-i="${i}">
              <div class="r1"><span class="no">${b.no}</span><span style="margin-left:auto">${chip(billSt(b),ST_C[billSt(b)])}</span></div>
              <div class="sub">${weekLabel(b.wk)}${b.pushedAt?` · 出账 ${b.pushedAt}`:''}</div>
              <div class="qty"><div class="q"><div class="v">${b.times}</div><div class="l">取货次数</div></div><div class="q"><div class="v">${money(b.fee)}</div><div class="l">计费（未税）</div></div><div class="q"><div class="v">${b.waive?money(b.waive):'—'}</div><div class="l">减免（未税）</div></div></div>
              ${b.stNo?`<div class="sub" style="margin-top:8px">结算单 <span style="font-family:monospace">${b.stNo}</span> · ${b.invNo?'已开票':'待开票'}</div>`:''}
              <div class="r2"><span>应扣（含税）· 未税 ${money(b.due)} + GST ${money(b.gst)}</span><span class="amt">${money(b.incl)}</span></div></div>`).join('')
              :`<div class="empty"><div class="ei">${svg('truck')}</div><h4>暂无账单</h4><p>平台为您取货后，每周汇总出一张账单</p></div>`;
            list.querySelectorAll('[data-i]').forEach(c=>c.onclick=()=>openBill(bs[+c.dataset.i]));
          }else{
            const ps=calc().reverse();
            list.innerHTML=ps.length?ps.map(pickCard).join(''):`<div class="empty"><div class="ei">${svg('truck')}</div><h4>没有取货记录</h4></div>`;
          }
        },250);
      }
      drawTabs();drawList();
    }});
}
const pickCard=p=>`<div class="rp-card" style="cursor:default">
  <div class="r1"><span class="no">${p.no}</span><span style="margin-left:auto">${PST[p.st]?chip(PST[p.st][0],PST[p.st][1]):''}</span></div>
  <div class="sub">${p.at} · ${p.market}</div>
  <div class="qty"><div class="q"><div class="v">${p.mates}</div><div class="l">同车店铺数</div></div><div class="q"><div class="v">${money(p.fee)}</div><div class="l">计费（未税）</div></div></div>
  <div class="r2"><span style="font-size:12px">${p.basis}</span></div></div>`;
function openBill(b){
  pushPage({title:'取货运费账单',body:`
    <div class="rp-card2"><div class="rp-ct">账单信息<span class="desc">${chip(billSt(b),ST_C[billSt(b)])}</span></div>
      ${rowKV('账单号',`<span style="font-family:monospace">${b.no}</span>`)}${rowKV('结算周期',`${b.wk} ~ ${addDays(b.wk,6)}`)}${rowKV('取货次数',b.times)}
      ${rowKV('计费（未税）',money(b.fee))}${rowKV('减免（未税）',b.waive?money(b.waive):'')}${rowKV('应扣（未税）',money(b.due))}${rowKV('GST 9%',money(b.gst))}
      ${rowKV('出账时间',b.pushedAt)}${rowKV('扣款方式',b.pushedAt?'结算时从货款中扣除':'')}
      ${rowKV('结算单号',b.stNo?`<span style="font-family:monospace">${b.stNo}</span>`:'')}
      ${rowKV('物流服务费发票',b.invNo?`<span style="font-family:monospace">${b.invNo}</span>`:b.pushedAt?'随结算单开票':'',b.invNo||!b.pushedAt?'':'amber')}
      <div class="rp-row total"><span class="k">应扣（含税）</span><span class="v">${money(b.incl)}</span></div></div>
    <div class="rp-card2" style="padding-bottom:4px"><div class="rp-ct">取货明细<span class="desc">${b.times} 次</span></div></div>
    <div class="rp-list">${b.list.slice().reverse().map(pickCard).join('')}</div>`,
    footer:b.invNo?`<button class="btn primary" style="width:100%" id="pf-dl">下载物流服务费发票</button>`:'',
    mount:(p)=>{const d=p.querySelector('#pf-dl');if(d)d.onclick=()=>toast(`演示：已下载 ${b.invNo}.pdf`);}});
}
function openHist(){
  const vs=DB.pfRules.slice().reverse();
  pushPage({title:'收费规则变更记录',body:`<div class="rp-card2">${vs.map((v,i)=>`<div class="rp-row" style="display:block">
      <div style="display:flex;align-items:center;gap:8px"><b style="font-size:14px">${ZONE[v.zone]}</b>${i===0?chip('当前','rp-c-green'):''}</div>
      <div style="font-size:12.5px;color:#46604F;margin-top:5px">${zoneStd(v.zone)}</div>
      <div style="font-size:12px;color:var(--sub);margin-top:3px">生效 ${v.from}</div></div>`).join('')}</div>`});
}
window.FM_MOD.pickfee=open;
})();
