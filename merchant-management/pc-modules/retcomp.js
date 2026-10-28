/* Food Max 商家系统 · 退货赔付（2026-10-27 沈亮定 + 当日「司机上门取货以及仓库退货差异结算沟通」会议）
   商家端：财务 › 退货赔付（m-ret-comp）；店铺运营平台：退货赔付（p-ret-comp，看全部商家 + 仓库退回申诉开关）
   - 数据来源：退货申诉（客户退货 DB.afterSales[].retAppeal / 仓库退回 DB.whrAppeals）经客服核定「成立 / 部分成立」且赔付 > 0，
     一笔申诉生成一张赔付单（RC-…），一行
   - 结算（货权转移阶段）：赔付单直接推送进结算单（结算单 comp[]），计入应结金额与应开票金额，商家随结算单一并开票，不单独开票 / 上传
     · 归期：进核定后下一张生成的结算单；没进任何结算单 = 「待进结算单」
   - 平台化（不走货权转移）后：是否由平台代开商家 → Foodmax 的发票待 Simon 确认，本页届时再加代开发票下载
   - 运营平台只读 + 「仓库退回申诉入口」开关（DB.whrAppealOn，默认关：商家自己送多的不赔） */
(function(){

const bills=()=>[...(DB.bill&&DB.bill.status!='none'?[DB.bill]:[]),...(DB.billsHistory||[])];
const billOf=no=>bills().find(b=>(b.comp||[]).some(c=>c.no==no))||null;
const MER=()=>({name:DB.merchant.name,code:DB.merchant.code});   // 原型只有一个三方商家

/* 全部赔付单（一笔申诉一行） */
window.retCompRows=function(){
  const out=[];
  (DB.afterSales||[]).forEach((a,i)=>{const ra=a.retAppeal;if(!ra||!(ra.comp>0))return;
    out.push({compNo:ra.compNo,src:'客户退货',retNo:'TH-'+a.id.slice(-6),order:a.order,ra,priceLabel:'正向订单结算单价',open:`closeDrawer();act_afterDetail(${i})`});});
  Object.keys(DB.whrAppeals||{}).forEach(no=>{const ra=DB.whrAppeals[no];if(!ra||!(ra.comp>0))return;
    out.push({compNo:ra.compNo,src:'仓库退回',retNo:no,ra,priceLabel:'商品售价',open:`closeDrawer();DB.retSrcTab='wh';nav('m-after-return');setTimeout(()=>whr_detail('${no}'),50)`});});
  out.forEach(r=>{r.bill=billOf(r.compNo);r.mer=MER();});
  return out.sort((x,y)=>(y.ra.reviewAt||'').localeCompare(x.ra.reviewAt||''));
};
const rowOf=no=>retCompRows().find(r=>r.compNo==no);
// 结算状态：待进结算单 / 已进结算单（当期未打款）/ 已打款
function settleSt(r){
  if(!r.bill)return '待进结算单';
  if(r.bill===DB.bill&&DB.payment!='paid')return '已进结算单';
  return '已打款';
}
const SETTLE_TONE={'待进结算单':'t-gr','已进结算单':'t-b','已打款':'t-g'};
const stTag=(t,tone)=>`<span class="tag ${tone[t]||'t-gr'}"><span class="dot"></span>${t}</span>`;
const sum2=a=>+a.reduce((s,v)=>s+v,0).toFixed(2);
const r2=n=>Math.round(n*100)/100;

/* 原订单应结明细（10-28 沈亮：赔付金额要能看到原订单本该结给商家多少钱）
   客户退货：正向订单该行 应结 = 客户实付 + 平台补贴 − 平台抽佣（服务 + 物流 + 通道）；结算单价 = 应结 ÷ 下单数量；赔付 = 结算单价 × 核定数量
   数据取原订单结算快照（ra.origin，按商品）；原型缺快照时按单价反推演示（服务 6% / 物流 3% / 通道 1%）
   仓库退回：没有原订单，按商品售价 × 核定数量，不扣佣金 */
function origOf(r,x){
  const o=(r.ra.origin||{})[x.name];if(o)return {...o,settle:r2(o.paid+o.platSub-o.svc-o.logi-o.chan)};
  const qty=x.ret,settle=r2(x.price*qty),base=r2(settle/0.9),svc=r2(base*.06),logi=r2(base*.03),chan=r2(base-settle-svc-logi);
  return {orderQty:qty,paid:base,platSub:0,svc,logi,chan,settle};
}
function origHtml(r){
  const ok=r.ra.items.filter(x=>x.ok>0);
  if(r.src=='仓库退回')return `<div style="font-size:12.5px;color:var(--ts);margin-bottom:8px">仓库退回没有原订单，按商品售价赔付，不扣佣金</div>
    <table class="subtbl" style="width:100%"><thead><tr><th>商品</th><th style="text-align:right">商品售价</th><th style="text-align:right">核定数量</th><th style="text-align:right">赔付金额</th></tr></thead><tbody>
    ${ok.map(x=>`<tr><td>${x.name}</td><td style="text-align:right">${money(x.price)}</td><td style="text-align:right">${x.ok}</td><td style="text-align:right">${money(r2(x.ok*x.price))}</td></tr>`).join('')}</tbody></table>`;
  return ok.map(x=>{const o=origOf(r,x),line=(l,v,c)=>`<tr${c?` style="${c}"`:''}><td>${l}</td><td style="text-align:right">${v}</td></tr>`;
    return `<div style="font-weight:600;font-size:13px;margin:4px 0 6px">${x.name} <span style="font-weight:400;color:var(--ts);font-size:12px">正向订单 <span class="mono">${r.order||'—'}</span></span></div>
    <table class="subtbl" style="margin-bottom:10px;width:100%"><tbody>
      ${line('下单数量',o.orderQty)}
      ${line('客户实付',money(o.paid))}
      ${line('＋ 平台补贴',money(o.platSub))}
      ${line('− 服务佣金',money(o.svc))}
      ${line('− 物流佣金',money(o.logi))}
      ${line('− 通道费',money(o.chan))}
      ${line('＝ 原订单应结金额',`<b>${money(o.settle)}</b>`,'background:var(--gl)')}
      ${line('÷ 下单数量 ＝ 结算单价',money(x.price))}
      ${line('× 核定数量 '+x.ok+' ＝ 赔付金额',`<b style="color:var(--g)">${money(r2(x.ok*x.price))}</b>`,'background:var(--gl)')}
    </tbody></table>`;}).join('')+`<div style="font-size:11.5px;color:var(--ts)">客户实付已扣除店铺自己的优惠；佣金按原订单结算时的费率</div>`;
}
window.rcpOrig=function(no,ev){
  ev.stopPropagation();const r=retCompRows().find(x=>x.compNo==no);if(!r)return;
  let el=document.getElementById('rcp-pop');if(el)el.remove();
  el=document.createElement('div');el.id='rcp-pop';
  el.style.cssText='position:fixed;z-index:1200;width:340px;max-height:70vh;overflow:auto;background:#fff;border:1px solid var(--bd);border-radius:12px;box-shadow:0 12px 32px rgba(18,39,29,.18);padding:14px 16px';
  el.innerHTML=`<div style="display:flex;align-items:center;margin-bottom:8px"><b style="font-size:14px">${r.src=='仓库退回'?'赔付金额依据':'原订单应结明细'}</b><span style="margin-left:auto;cursor:pointer;color:var(--ts);font-size:18px" onclick="document.getElementById('rcp-pop').remove()">×</span></div>${origHtml(r)}`;
  document.body.appendChild(el);
  const b=ev.currentTarget.getBoundingClientRect(),h=el.offsetHeight;
  el.style.left=Math.max(12,Math.min(b.right-340,window.innerWidth-352))+'px';
  el.style.top=(b.bottom+6+h>window.innerHeight?Math.max(12,b.top-h-6):b.bottom+6)+'px';
  setTimeout(()=>{const off=e=>{if(!el.contains(e.target)){el.remove();document.removeEventListener('click',off);}};document.addEventListener('click',off);},0);
};
document.addEventListener('keydown',e=>{if(e.key=='Escape'){const el=document.getElementById('rcp-pop');if(el)el.remove();}});

PAGES['m-ret-comp']=()=>listContent(false);
PAGES['p-ret-comp']=()=>switchCard()+listContent(true);

/* 运营平台：仓库退回申诉入口开关 */
function switchCard(){
  const on=!!DB.whrAppealOn;
  return `<div class="card" style="margin-bottom:14px"><div class="card-bd" style="display:flex;align-items:center;gap:16px;padding:14px 16px">
    <div style="flex:1"><div style="font-weight:600">仓库退回申诉入口</div><div style="font-size:12.5px;color:var(--ts);margin-top:4px">关闭时，商家端「退货单 › 仓库退回」不出现申诉按钮；商家自己送多的货不赔。已提交 / 已核定的申诉不受影响。</div></div>
    ${stTag(on?'已开启':'已关闭',{'已开启':'t-g','已关闭':'t-gr'})}
    <button class="btn ${on?'btn-o':'btn-p'} btn-sm" onclick="rcpSwitchAsk()">${on?'关闭入口':'开启入口'}</button>
  </div></div>`;
}
window.rcpSwitchAsk=function(){const on=!!DB.whrAppealOn;
  askConfirm(on?'关闭后，商家端仓库退回不再显示申诉按钮，已提交的申诉照常核定。确认关闭？':'开启后，商家可对仓库退回的商品发起申诉（待取回、已取回都可以）。确认开启？',()=>{DB.whrAppealOn=!on;render();toast(on?'已关闭仓库退回申诉入口':'已开启仓库退回申诉入口','ok');});};

/* ---------- 赔付单列表 ---------- */
function filtered(){
  const f=DB.rcpF||{};
  return retCompRows().filter(r=>(!f.src||r.src==f.src)&&(!f.st||settleSt(r)==f.st)
    &&(!f.mer||[r.mer.name,r.mer.code].some(x=>x.toLowerCase().includes(f.mer.toLowerCase())))
    &&(!f.no||[r.retNo,r.compNo,r.bill&&r.bill.no].some(x=>x&&x.toLowerCase().includes(f.no.toLowerCase())))
    &&(!f.d1||(r.ra.reviewAt||'').slice(0,10)>=f.d1)&&(!f.d2||(r.ra.reviewAt||'').slice(0,10)<=f.d2));
}
function listContent(ops){
  const f=DB.rcpF||{},rows=filtered();
  const EN=`onkeydown="if(event.key=='Enter')rcpQuery()"`;
  const opt=(id,label,arr,v)=>`<div><div style="font-size:12px;color:var(--ts);margin-bottom:5px">${label}</div><select id="${id}" style="min-width:120px"><option value="">全部</option>${arr.map(s=>`<option ${v==s?'selected':''}>${s}</option>`).join('')}</select></div>`;
  return `<div class="card" style="margin-bottom:14px"><div class="card-bd" style="display:flex;gap:16px;align-items:flex-end;flex-wrap:wrap;padding:14px 16px">
    ${ops?`<div><div style="font-size:12px;color:var(--ts);margin-bottom:5px">商家</div><input id="rcp-mer" value="${f.mer||''}" placeholder="商家名称 / 编码" style="min-width:160px" ${EN}></div>`:''}
    <div><div style="font-size:12px;color:var(--ts);margin-bottom:5px">单号</div><input id="rcp-no" value="${f.no||''}" placeholder="赔付单号 / 退货单号 / 结算单号" style="min-width:220px" ${EN}></div>
    ${opt('rcp-src','来源',['客户退货','仓库退回'],f.src)}
    ${opt('rcp-st','结算状态',['待进结算单','已进结算单','已打款'],f.st)}
    <div><div style="font-size:12px;color:var(--ts);margin-bottom:5px">核定时间</div><div class="row" style="gap:6px;align-items:center"><input id="rcp-d1" type="date" value="${f.d1||''}" style="width:150px"><span style="color:var(--ts)">至</span><input id="rcp-d2" type="date" value="${f.d2||''}" style="width:150px"></div></div>
    <button class="btn btn-p btn-sm" onclick="rcpQuery()">查询</button><button class="btn btn-o btn-sm" onclick="DB.rcpF={};render()">重置</button>
  </div></div>
  <div class="card"><div class="card-hd"><h3>赔付单</h3><span class="sub">${ops?'全部商家 · 只读':'退货申诉核定成立后生成，直接推送进结算单，随结算单开票'}</span></div>
  <div class="card-bd ${rows.length?'flush':''}">${rows.length?`<div style="overflow-x:auto"><table>
    <thead><tr>${ops?'<th>商家名称</th><th>商家编码</th>':''}<th>赔付单号</th><th>来源</th><th>关联单号</th><th>申诉类型</th><th>核定结论</th><th>赔付商品</th><th style="text-align:right">核定数量</th><th style="text-align:right">赔付金额</th><th>核定时间</th><th>结算单号</th><th>结算状态</th><th>操作</th></tr></thead><tbody>
    ${rows.map(r=>{const ok=r.ra.items.filter(x=>x.ok>0);return `<tr>
      ${ops?`<td style="white-space:nowrap">${r.mer.name}</td><td class="mono" style="white-space:nowrap">${r.mer.code}</td>`:''}
      <td class="mono" style="white-space:nowrap">${r.compNo||'—'}</td>
      <td style="white-space:nowrap">${r.src}</td>
      <td class="mono" style="white-space:nowrap">${r.retNo}</td>
      <td style="white-space:nowrap">${raKindLabel(r.ra)}</td>
      <td style="white-space:nowrap">${r.ra.status}</td>
      <td>${ok.map(x=>x.name).join('、')}</td>
      <td style="text-align:right">${sum2(ok.map(x=>x.ok))}</td>
      <td style="text-align:right"><a href="javascript:void(0)" title="查看原订单应结明细" onclick="rcpOrig('${r.compNo}',event)" style="color:var(--g);font-weight:600;text-decoration:none;border-bottom:1px dashed var(--g)">${money(r.ra.comp)}</a></td>
      <td style="white-space:nowrap;font-size:12px;color:var(--ts)">${r.ra.reviewAt||'—'}</td>
      <td class="mono" style="white-space:nowrap">${r.bill?r.bill.no:'—'}</td>
      <td style="white-space:nowrap">${stTag(settleSt(r),SETTLE_TONE)}</td>
      <td style="white-space:nowrap"><button class="btn btn-o btn-sm" onclick="rcpDetail('${r.compNo}',${ops})">详情</button></td></tr>`;}).join('')}
    </tbody></table></div>`:`<div class="empty"><div class="e-ic">💸</div><div class="e-t">暂无退货赔付</div><div class="e-s">退货单申诉经客服核实成立后，赔付单会显示在这里</div></div>`}</div></div>`;
}
window.rcpQuery=function(){const v=id=>{const e=document.getElementById(id);return e?(e.value||'').trim():'';};DB.rcpF={mer:v('rcp-mer'),no:v('rcp-no'),src:v('rcp-src'),st:v('rcp-st'),d1:v('rcp-d1'),d2:v('rcp-d2')};render();};

window.rcpDetail=function(no,ops){
  const r=rowOf(no);if(!r)return;const ra=r.ra;
  const kv=(a,b)=>`<div><div class="k">${a}</div><div class="v">${b||'—'}</div></div>`;
  const sec=t=>`<div style="font-weight:600;font-size:13px;margin:16px 2px 8px">${t}</div>`;
  drawer(`<div class="drawer-hd"><div><h3>赔付单 · ${r.compNo||'—'}</h3><div style="font-size:12.5px;color:var(--ts);margin-top:2px">${ops?r.mer.name+' · ':''}${r.src} · ${r.retNo}</div></div><span class="x" onclick="closeDrawer()">×</span></div>
  <div class="drawer-bd">
    ${sec('基础信息')}
    <div class="kv">${ops?kv('商家名称',r.mer.name)+kv('商家编码',`<span class="mono">${r.mer.code}</span>`):''}${kv('赔付单号',`<span class="mono">${r.compNo||'—'}</span>`)}${kv('来源',r.src)}${kv('关联单号',`<span class="mono">${r.retNo}</span>`)}${kv('申诉类型',raKindLabel(ra))}${kv('申诉时间',ra.at)}${kv('核定时间',ra.reviewAt)}${kv('核定结论',ra.status)}${kv('核定说明',ra.note)}</div>
    ${sec('赔付明细')}
    <table><thead><tr><th>商品</th><th style="text-align:right">申诉数量</th><th style="text-align:right">核定数量</th><th style="text-align:right">${r.priceLabel}</th><th style="text-align:right">赔付金额</th></tr></thead><tbody>
      ${ra.items.map(x=>`<tr><td>${x.name}</td><td style="text-align:right">${x.qty}</td><td style="text-align:right">${x.ok==null?'—':x.ok}</td><td style="text-align:right">${x.price==null?'—':money(x.price)}</td><td style="text-align:right">${x.ok&&x.price!=null?money(Math.round(x.ok*x.price*100)/100):money(0)}</td></tr>`).join('')}
      <tr style="font-weight:700;background:var(--gl)"><td colspan="4">赔付合计</td><td style="text-align:right;color:var(--gd)">${money(ra.comp)}</td></tr>
    </tbody></table>
    ${sec(r.src=='仓库退回'?'赔付金额依据':'原订单应结明细')}
    ${origHtml(r)}
    ${sec('结算')}
    <div class="kv">${kv('结算单号',r.bill?`<span class="mono">${r.bill.no}</span>`:'')}${kv('结算区间',r.bill?r.bill.range:'')}${kv('结算状态',stTag(settleSt(r),SETTLE_TONE))}${kv('开票',r.bill?`随结算单 <span class="mono">${r.bill.no}</span> 一并开票`:'进结算单后随结算单开票')}</div>
  </div>
  <div class="drawer-ft">${ops?'':`<button class="btn btn-o" onclick="${r.open}">查看${r.src=='仓库退回'?'退回记录':'退货单'}</button>${r.bill?`<button class="btn btn-o" onclick="closeDrawer();act_billDetail('${r.bill===DB.bill?'':r.bill.period}')">查看结算单</button>`:''}`}<button class="btn btn-p" onclick="closeDrawer()">关闭</button></div>`);
};

})();
