/* Food Max 商家端 v2 · 财务 › 自提运费（与 PC pc-modules/pickfee.js 商家端 m-pickfee 同口径，2026-10-27）
   - 平台去批发市场帮商家取货，按平台给店铺设的规则收运费；商家只读，不能改规则
   - 计费：按次 = 每取一次收固定金额；按下单金额比例 = 取货当天下单金额 × 比例（可设每日封顶），一天取多趟只收一次
   - 改规则下一次取货起生效，已取的不重算
   - 每月一张账单：本月进行中 / 无需收费 / 待出账 / 已出账（结算时从货款扣）；出账后平台开物流费发票，商家可下载
   - 平台没给本店设过规则 → 不显示入口
   - 演示数据与 PC 一致（绿鲜源蔬果旗舰店 SH2026062000001，按次 S$80）
   样式复用 replen.js 注入的 .rp-* 类 */
(function(){
const {pushPage,toast,svg,skel}=window.FM;
const money=n=>'S$'+(+n||0).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
const DB=window.FM.DB;
const SHOP={code:'SH2026062000001',name:'绿鲜源蔬果旗舰店'};
const MODE={TRIP:'按次',GMV:'按下单金额比例',OFF:'不收费'};
const pct=r=>+(r*100).toFixed(2)+'%';
const CUR_MONTH='2026-10';

DB.pfRules=DB.pfRules||[{from:'2026-09-01 00:00',mode:'TRIP',price:80}];
DB.pfBills=DB.pfBills||{'2026-09':{pushedAt:'2026-10-02 10:15',invNo:'LOG-INV-2026-000012'}};
const ruleAt=t=>DB.pfRules.filter(v=>v.from<=t).pop()||null;
const curRule=()=>DB.pfRules[DB.pfRules.length-1]||null;
const ruleText=v=>!v||v.mode==='OFF'?'不收费':v.mode==='TRIP'?`${money(v.price)} / 次`:`当天下单金额 × ${pct(v.rate)}${v.cap?`，每日封顶 ${money(v.cap)}`:'，不封顶'}`;

/* 取货记录（与 PC 生成规则一致） */
if(!DB.pfPickups){
  const p2=n=>String(n).padStart(2,'0'),DRV=['陈志明','Ahmad','林国强','Rajesh'];let seq=1;
  DB.pfPickups=[];
  [['2026-09',[2,4,6,9,11,13,16,18,20,23,25,27]],['2026-10',[2,4,7,9,11]]].forEach(([ym,days])=>days.forEach((d,i)=>{
    DB.pfPickups.push({no:`PK${ym.replace('-','')}${p2(d)}${p2(seq++)}`,at:`${ym}-${p2(d)} 06:${p2((d*7)%50+5)}`,market:'巴西班让批发中心',driver:DRV[i%4],gmv:0});
  }));
}
function calc(){
  const first={};
  return DB.pfPickups.slice().sort((a,b)=>a.at.localeCompare(b.at)).map(p=>{
    const v=ruleAt(p.at),date=p.at.slice(0,10);
    if(!v||v.mode==='OFF')return {...p,rule:v,fee:0,basis:'未设置收费规则，不收费'};
    if(v.mode==='TRIP')return {...p,rule:v,fee:v.price,basis:`1 次 × ${money(v.price)}`};
    if(first[date])return {...p,rule:v,fee:0,basis:'同一天已按下单金额收过'};
    first[date]=1;const raw=+(p.gmv*v.rate).toFixed(2),capped=v.cap&&raw>v.cap;
    return {...p,rule:v,fee:capped?v.cap:raw,basis:`当天下单金额 ${money(p.gmv)} × ${pct(v.rate)} = ${money(raw)}${capped?`，超封顶按 ${money(v.cap)}`:''}`};
  });
}
function bills(){
  const all=calc(),months=[...new Set(all.map(p=>p.at.slice(0,7)))].sort().reverse();
  return months.map(ym=>{const list=all.filter(p=>p.at.startsWith(ym)),st=DB.pfBills[ym]||{};
    return {ym,no:`PF-${ym.replace('-','')}-${SHOP.code.slice(-5)}`,list,times:list.length,fee:+list.reduce((a,p)=>a+p.fee,0).toFixed(2),
      pushedAt:st.pushedAt||'',invNo:st.invNo||'',open:ym>=CUR_MONTH};});
}
const billSt=b=>b.open?'本月进行中':!b.fee?'无需收费':!b.pushedAt?'待出账':'已出账';
const ST_C={'本月进行中':'rp-c-gray','无需收费':'rp-c-gray','待出账':'rp-c-amber','已出账':'rp-c-green'};
const chip=t=>`<span class="rp-chip ${ST_C[t]||'rp-c-gray'}">${t}</span>`;
const rowKV=(k,v,cls)=>`<div class="rp-row"><span class="k">${k}</span><span class="v ${cls||''}">${v||'—'}</span></div>`;
window.FM_MOD.pickfeeOn=()=>DB.pfRules.length>0;

let _tab='bill';
function open(){
  _tab='bill';
  const v=curRule();
  pushPage({title:'自提运费',body:`
    <div class="rp-card2"><div class="rp-ct">当前收费规则<span class="desc" id="pf-hist" style="color:var(--emerald-2);cursor:pointer;float:right;min-height:32px;line-height:32px;margin-top:-8px">变更记录 ›</span></div>
      ${rowKV('店铺',SHOP.name)}${rowKV('计费方式',MODE[v.mode])}
      ${rowKV('收费标准',v.mode==='TRIP'?`${money(v.price)} / 次`:v.mode==='GMV'?`取货当天下单金额 × ${pct(v.rate)}`:'—')}
      ${v.mode==='GMV'?rowKV('每日封顶',v.cap?money(v.cap):'不封顶'):''}${rowKV('生效时间',v.from)}
      <div style="font-size:12px;color:var(--sub);line-height:1.6;padding-top:8px;border-top:1px solid var(--line)">平台去批发市场帮您取货收的运费；每月出账单，结算时从货款中扣除</div></div>
    <div class="rp-tabs" id="pf-tabs"></div><div class="rp-list" id="pf-list"></div>`,
    mount:(p)=>{
      const tabs=p.querySelector('#pf-tabs'),list=p.querySelector('#pf-list');
      p.querySelector('#pf-hist').onclick=openHist;
      function drawTabs(){const n=calc().length,m=bills().length;
        tabs.innerHTML=[['bill','月度账单',m],['pick','取货明细',n]].map(([k,t,c])=>`<div class="rp-tab ${_tab===k?'on':''}" data-t="${k}">${t} ${c}</div>`).join('');
        tabs.querySelectorAll('.rp-tab').forEach(x=>x.onclick=()=>{if(_tab===x.dataset.t)return;_tab=x.dataset.t;drawTabs();drawList();});}
      function drawList(){
        list.innerHTML=skel(2);
        setTimeout(()=>{
          if(_tab==='bill'){
            const bs=bills();
            list.innerHTML=bs.length?bs.map((b,i)=>`<div class="rp-card" data-i="${i}">
              <div class="r1"><span class="no">${b.no}</span><span style="margin-left:auto">${chip(billSt(b))}</span></div>
              <div class="sub">${b.ym}${b.pushedAt?` · 出账 ${b.pushedAt}`:''}</div>
              <div class="qty"><div class="q"><div class="v">${b.times}</div><div class="l">取货次数</div></div><div class="q"><div class="v" style="font-size:13px">${b.invNo?'已开票':b.pushedAt?'待开票':'—'}</div><div class="l">物流费发票</div></div></div>
              <div class="r2"><span>运费合计</span><span class="amt">${money(b.fee)}</span></div></div>`).join('')
              :`<div class="empty"><div class="ei">${svg('truck')}</div><h4>暂无账单</h4><p>平台为您取货后，每月汇总出一张账单</p></div>`;
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
  <div class="r1"><span class="no">${p.no}</span><span style="margin-left:auto;font-size:12px;color:var(--sub)">${MODE[(p.rule||{}).mode||'OFF']}</span></div>
  <div class="sub">${p.at} · ${p.market} · 司机 ${p.driver}</div>
  <div class="r2"><span style="font-size:12px">${p.basis}</span><span class="amt">${money(p.fee)}</span></div></div>`;
function openBill(b){
  pushPage({title:'自提运费账单',body:`
    <div class="rp-card2"><div class="rp-ct">账单信息<span class="desc">${chip(billSt(b))}</span></div>
      ${rowKV('账单号',`<span style="font-family:monospace">${b.no}</span>`)}${rowKV('月份',b.ym)}${rowKV('取货次数',b.times)}
      ${rowKV('出账时间',b.pushedAt)}${rowKV('扣款方式',b.pushedAt?'结算时从货款中扣除':'')}
      ${rowKV('物流费发票',b.invNo?`<span style="font-family:monospace">${b.invNo}</span>`:b.pushedAt?'待开票':'',b.invNo||!b.pushedAt?'':'amber')}
      <div class="rp-row total"><span class="k">运费合计</span><span class="v">${money(b.fee)}</span></div></div>
    <div class="rp-card2" style="padding-bottom:4px"><div class="rp-ct">取货明细<span class="desc">${b.times} 次</span></div></div>
    <div class="rp-list">${b.list.slice().reverse().map(pickCard).join('')}</div>`,
    footer:b.invNo?`<button class="btn primary" style="width:100%" id="pf-dl">下载物流费发票</button>`:'',
    mount:(p)=>{const d=p.querySelector('#pf-dl');if(d)d.onclick=()=>toast(`演示：已下载 ${b.invNo}.pdf`);}});
}
function openHist(){
  const vs=DB.pfRules.slice().reverse();
  pushPage({title:'收费规则变更记录',body:`<div class="rp-card2">${vs.map((v,i)=>`<div class="rp-row" style="display:block">
      <div style="display:flex;align-items:center;gap:8px"><b style="font-size:14px">${MODE[v.mode]}</b>${i===0?'<span class="rp-chip rp-c-green">当前</span>':''}</div>
      <div style="font-size:12.5px;color:#46604F;margin-top:5px">${ruleText(v)}</div>
      <div style="font-size:12px;color:var(--sub);margin-top:3px">生效 ${v.from}</div></div>`).join('')}</div>`});
}
window.FM_MOD.pickfee=open;
})();
