/* PC · 耗材商城（商家端）+ 耗材管理（运营平台端）
   业务链：耗材订单(HC) → 耗材送货单(HS，推仓库作业) → 仓库回写已交付 → 计入当期结算单扣减项 → 平台开耗材销售发票。
   边界：配送执行（谁送/自提/运费）不在本原型范围，送货单只做「生成 + 推送 + 状态承接」。
   口径：
   - 计费时点 = 耗材送货单回写「已交付」，按回写时间落入当期结算周期（未交付不计费）。
   - 支付方式固定 = 结算抵扣，商家无支付动作；结算单新增扣减行「耗材采购扣款」，取含税金额。
   - 应清算 = 汇总总额 − 逆向扣减 − 服务佣金 − 物流佣金 − 耗材采购扣款；不足扣时差额结转下期。
   - 耗材与经营商品完全隔离：独立商品表与类目，不进商品审核流、不进对账单、不参与佣金。
   - 价格未税/含税并列（GST 9%），下单快照单价，后续平台调价不影响已下单。
   依赖主文件全局：DB / money / toast / modal / closeModal / drawer / closeDrawer / askConfirm / nav / render / ts / GST_DEFAULT。 */
(function(){

/* ================= 演示数据（挂 DB，跨 render 持久） ================= */
DB.supplyGoods = DB.supplyGoods || [
  {code:'HC-LBL-6040',name:'热敏标签纸 60×40mm',spec:'500张/卷 · 20卷/箱',unit:'箱',cat:'标签耗材',price:16.80,tax:9,stock:480,limitQty:20,limitCycle:'单次',status:'onsale',ic:'🏷️',desc:'适配平台标配标签打印机，商品标签 / 称重标签通用。'},
  {code:'HC-LBL-8060',name:'热敏标签纸 80×60mm',spec:'350张/卷 · 20卷/箱',unit:'箱',cat:'标签耗材',price:21.50,tax:9,stock:260,limitQty:20,limitCycle:'单次',status:'onsale',ic:'🏷️',desc:'大幅面标签，整件送货标签用。'},
  {code:'HC-CLN-PEN',name:'打印头清洁笔',spec:'2支/盒',unit:'盒',cat:'标签耗材',price:6.00,tax:9,stock:0,limitQty:5,limitCycle:'单次',status:'onsale',ic:'🖊️',desc:'打印头清洁，建议每月一次。'},
  {code:'HC-PRT-ZD230',name:'标签打印机 Zebra ZD230',spec:'热敏 · USB + 以太网',unit:'台',cat:'打印设备',price:328.00,tax:9,stock:26,limitQty:2,limitCycle:'每店累计',status:'onsale',ic:'🖨️',desc:'平台标配机型，随附驱动与配置手册，即插即用。'},
  {code:'HC-PRT-BT10',name:'便携蓝牙标签打印机',spec:'蓝牙 5.0 · 内置电池',unit:'台',cat:'打印设备',price:168.00,tax:9,stock:12,limitQty:2,limitCycle:'每店累计',status:'onsale',ic:'🖨️',desc:'移动分拣场景，配合商家 App 打印。'},
  {code:'HC-BOX-STD',name:'周转筐 600×400',spec:'1个',unit:'个',cat:'周转物料',price:12.00,tax:9,stock:900,limitQty:100,limitCycle:'单次',status:'offsale',ic:'🧺',desc:'暂未开放销售。'},
];
DB.supplyOrders = DB.supplyOrders || [
  {no:'HC20260518001',date:'2026-05-18 10:24',shop:'M2026-0815',shopName:'绿鲜源蔬果旗舰店',
   lines:[{code:'HC-PRT-ZD230',name:'标签打印机 Zebra ZD230',spec:'热敏 · USB + 以太网',unit:'台',qty:1,price:328.00,tax:9}],
   status:'settled',deliveryNo:'HS20260518001',deliveryStatus:'已交付',pushAt:'2026-05-18 10:25',deliveredAt:'2026-05-19 08:40',billNo:'ST202605-M0815',invNo:'SUP-INV-2026-501'},
  {no:'HC20260612001',date:'2026-06-12 09:06',shop:'M2026-0815',shopName:'绿鲜源蔬果旗舰店',
   lines:[{code:'HC-LBL-6040',name:'热敏标签纸 60×40mm',spec:'500张/卷 · 20卷/箱',unit:'箱',qty:6,price:16.80,tax:9},
          {code:'HC-LBL-8060',name:'热敏标签纸 80×60mm',spec:'350张/卷 · 20卷/箱',unit:'箱',qty:2,price:21.50,tax:9}],
   status:'delivered',deliveryNo:'HS20260612001',deliveryStatus:'已交付',pushAt:'2026-06-12 09:07',deliveredAt:'2026-06-13 07:20',billNo:'',invNo:'SUP-INV-2026-502'},
  {no:'HC20260628001',date:'2026-06-28 16:41',shop:'M2026-0815',shopName:'绿鲜源蔬果旗舰店',
   lines:[{code:'HC-LBL-6040',name:'热敏标签纸 60×40mm',spec:'500张/卷 · 20卷/箱',unit:'箱',qty:10,price:16.80,tax:9}],
   status:'pending',deliveryNo:'HS20260628001',deliveryStatus:'待处理',pushAt:'2026-06-28 16:42',deliveredAt:'',billNo:'',invNo:''},
];
DB.supplyCart   = DB.supplyCart   || {};
DB.supplySeq    = DB.supplySeq    || 2;      // 当日流水号
DB.supplyTab    = DB.supplyTab    || 'all';
DB.supplyGTab   = DB.supplyGTab   || 'all';  // 商城品类筛选
DB.supplyInvoices = DB.supplyInvoices || [
  {no:'SUP-INV-2026-501',order:'HC20260518001',date:'2026-05-20',net:328.00,gst:29.52,total:357.52,status:'已开票'},
  {no:'SUP-INV-2026-502',order:'HC20260612001',date:'2026-06-14',net:143.80,gst:12.94,total:156.74,status:'已开票'},
];

/* ================= 口径计算 ================= */
const sTax   = x => (x.tax==null?GST_DEFAULT:x.tax);
const sIncl  = x => +(x.price*(1+sTax(x)/100)).toFixed(2);          // 含税单价
const lnNet  = l => +(l.qty*l.price).toFixed(2);                     // 行未税金额
const lnIncl = l => +(l.qty*sIncl(l)).toFixed(2);                    // 行含税金额
const odNet  = o => +(o.lines.reduce((a,l)=>a+lnNet(l),0)).toFixed(2);
const odIncl = o => +(o.lines.reduce((a,l)=>a+lnIncl(l),0)).toFixed(2);
const odQty  = o => o.lines.reduce((a,l)=>a+(+l.qty||0),0);
const gOf    = c => DB.supplyGoods.find(g=>g.code==c)||{};
const S_ST = {pending:['待送货','t-y'],shipping:['送货中','t-b'],delivered:['已交付','t-g'],settled:['已结算','t-gr'],canceled:['已取消','t-gr']};
const S_TABS=[['all','全部'],['pending','待送货'],['shipping','送货中'],['delivered','已交付'],['settled','已结算'],['canceled','已取消']];
function sTag(s){const[t,c]=S_ST[s]||['—','t-gr'];return `<span class="tag ${c}"><span class="dot"></span>${t}</span>`;}
function dTag(s){const m={'待处理':'t-y','已推送':'t-b','已交付':'t-g','已作废':'t-gr'}[s]||'t-gr';return `<span class="tag ${m}"><span class="dot"></span>${s}</span>`;}
// 「每店累计」限购已购数：统计未取消订单的累计件数
function boughtQty(code){return DB.supplyOrders.filter(o=>o.status!='canceled').reduce((a,o)=>a+o.lines.filter(l=>l.code==code).reduce((b,l)=>b+l.qty,0),0);}
// 单个商品的可下单上限 = min(库存, 限购剩余)
function maxQty(g){
  const byStock=Math.max(0,g.stock);
  const byLimit=g.limitCycle=='每店累计'?Math.max(0,g.limitQty-boughtQty(g.code)):g.limitQty;
  return Math.min(byStock,byLimit);
}
function limitText(g){
  if(g.limitCycle=='每店累计'){const b=boughtQty(g.code);return `每店累计限购 ${g.limitQty}${g.unit} · 已购 ${b}${g.unit} · 剩余 ${Math.max(0,g.limitQty-b)}${g.unit}`;}
  return `单次限购 ${g.limitQty}${g.unit}`;
}
/* 结算联动：已交付未结算的耗材订单，按含税金额汇总为当期结算单扣减项（BR：计费时点=交付确认） */
window.supplySettleSync=function(){
  const del=DB.supplyOrders.filter(o=>o.status=='delivered');
  const amt=+(del.reduce((a,o)=>a+odIncl(o),0)).toFixed(2);
  DB.bill.supply=amt;DB.bill.supplyCnt=del.length;
  DB.bill.items=DB.bill.items.filter(it=>it[0]!='耗材采购扣款（含税）');
  if(amt>0)DB.bill.items.push(['耗材采购扣款（含税）',del.length,-amt]);
  DB.bill.net=+(DB.bill.gross-DB.bill.reverse-(DB.bill.feeSvc||0)-(DB.bill.feeLogi||0)-amt).toFixed(2);
};
supplySettleSync();

/* ================= 商家端 · 耗材商城 ================= */
// 品类 Tab 只列「有在售商品」的类别，避免出现点进去必空的类别
const sgCats=()=>['all',...new Set(DB.supplyGoods.filter(g=>g.status=='onsale').map(g=>g.cat))];
function cartLines(){
  return Object.keys(DB.supplyCart).filter(c=>DB.supplyCart[c]>0).map(c=>{
    const g=gOf(c);return {code:c,name:g.name,spec:g.spec,unit:g.unit,qty:DB.supplyCart[c],price:g.price,tax:sTax(g)};
  });
}
const cartNet =()=>+(cartLines().reduce((a,l)=>a+lnNet(l),0)).toFixed(2);
const cartIncl=()=>+(cartLines().reduce((a,l)=>a+lnIncl(l),0)).toFixed(2);

PAGES['m-supply']=()=>{
  const tab=DB.supplyGTab;
  const list=DB.supplyGoods.filter(g=>g.status=='onsale').filter(g=>tab=='all'||g.cat==tab);
  return `
  <style>
  .sg-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:14px}
  .sg-card{background:var(--w);border:1px solid var(--bd);border-radius:14px;padding:16px;display:flex;flex-direction:column}
  .sg-card.out{opacity:.62}
  .sg-hd{display:flex;gap:12px;align-items:flex-start}
  .sg-ic{width:52px;height:52px;flex:0 0 52px;border-radius:12px;background:var(--gl);display:flex;align-items:center;justify-content:center;font-size:26px}
  .sg-nm{font-size:14.5px;font-weight:600;line-height:1.4}
  .sg-code{font-size:11.5px;color:var(--tt);margin-top:3px}
  .sg-spec{font-size:12.5px;color:var(--ts);margin-top:6px;line-height:1.55}
  .sg-price{margin-top:12px;padding-top:12px;border-top:1px solid var(--bd2);display:flex;align-items:flex-end;gap:8px}
  .sg-p1{font-size:20px;font-weight:700;color:var(--gd);line-height:1}
  .sg-p2{font-size:12px;color:var(--ts)}
  .sg-meta{font-size:11.5px;color:var(--ts);margin-top:8px;line-height:1.6}
  .sg-ft{margin-top:12px;display:flex;align-items:center;gap:10px}
  .sg-step{display:flex;align-items:center;gap:0;border:1px solid var(--bd);border-radius:9px;overflow:hidden}
  .sg-step button{width:34px;height:34px;border:none;background:var(--w);cursor:pointer;font-size:17px;color:var(--ts)}
  .sg-step button:hover:not(:disabled){background:var(--gl);color:var(--gd)}
  .sg-step button:disabled{color:var(--tt);cursor:not-allowed}
  .sg-step input{width:52px;height:34px;border:none;border-left:1px solid var(--bd);border-right:1px solid var(--bd);text-align:center;font-size:14px;font-weight:600}
  .sg-sub{margin-left:auto;font-size:12.5px;color:var(--ts);text-align:right}
  .sg-sub b{display:block;font-size:14px;color:var(--gd)}
  .sg-bar{position:sticky;bottom:0;z-index:6;margin-top:16px;background:var(--w);border:1px solid var(--bd);border-radius:14px;
    padding:14px 18px;display:flex;align-items:center;gap:16px;box-shadow:0 -4px 18px rgba(18,39,29,.07);flex-wrap:wrap}
  .sg-bar .n{font-size:13px;color:var(--ts)}
  .sg-bar .amt{font-size:22px;font-weight:700;color:var(--gd);line-height:1.1}
  .sg-bar .amt s{display:block;font-size:12px;font-weight:400;color:var(--ts);text-decoration:none;margin-top:2px}
  </style>
  <div class="tabs">${sgCats().map(c=>`<div class="tab ${tab==c?'active':''}" onclick="DB.supplyGTab='${c}';render()">${c=='all'?'全部':c}</div>`).join('')}</div>
  <div class="sg-grid">
    ${list.map(g=>{
      const mx=maxQty(g),q=DB.supplyCart[g.code]||0,out=g.stock<=0,lim=mx<=0&&!out;
      return `<div class="sg-card ${out||lim?'out':''}">
        <div class="sg-hd">
          <div class="sg-ic">${g.ic}</div>
          <div style="min-width:0;flex:1">
            <div class="sg-nm">${g.name}</div>
            <div class="sg-code mono">${g.code} · ${g.cat}</div>
            <div class="sg-spec">${g.spec}</div>
          </div>
        </div>
        <div class="sg-price"><span class="sg-p1">${money(g.price)}</span><span class="sg-p2">/${g.unit}（未税）</span></div>
        <div class="sg-p2" style="margin-top:4px">含税 ${money(sIncl(g))}/${g.unit} · GST ${sTax(g)}%</div>
        <div class="sg-meta">${out?`库存 0${g.unit}`:`可下单 ${mx}${g.unit}（库存 ${g.stock}${g.unit}）`}<br>${limitText(g)}</div>
        <div class="sg-ft">
          ${out?'<span class="tag t-gr"><span class="dot"></span>暂时缺货</span>'
            :lim?'<span class="tag t-y"><span class="dot"></span>已达限购上限</span>'
            :`<div class="sg-step">
              <button onclick="sgStep('${g.code}',-1)" ${q<=0?'disabled':''} id="sgm-${g.code}">−</button>
              <input id="sgq-${g.code}" type="number" min="0" max="${mx}" value="${q}" oninput="sgSetQty('${g.code}',this.value)">
              <button onclick="sgStep('${g.code}',1)" ${q>=mx?'disabled':''} id="sgp-${g.code}">＋</button>
            </div>
            <div class="sg-sub">小计（含税）<b id="sgs-${g.code}">${money(+(q*sIncl(g)).toFixed(2))}</b></div>`}
        </div>
      </div>`;}).join('')||`<div class="empty" style="grid-column:1/-1"><div class="e-ic">📦</div><div class="e-t">该类别暂无可购耗材</div><div class="e-s">耗材由平台运营统一维护上架</div></div>`}
  </div>
  <div class="sg-bar" id="sg-bar">
    <div><div class="n">本次采购 <b id="sg-n">${cartLines().length}</b> 种 · <b id="sg-q">${cartLines().reduce((a,l)=>a+l.qty,0)}</b> 件</div>
      <div class="amt" id="sg-amt">${money(cartIncl())}<s id="sg-net">未税 ${money(cartNet())} · 本期结算单按含税金额扣减</s></div></div>
    <div style="margin-left:auto;display:flex;gap:10px">
      <button class="btn btn-o" id="sg-clr" onclick="sgClearCart()" ${cartLines().length?'':'disabled'}>清空</button>
      <button class="btn btn-p btn-lg" id="sg-ok" onclick="sgSubmitAsk()" ${cartLines().length?'':'disabled'}>提交采购单</button>
    </div>
  </div>`;
};
/* 步进器局部重绘（不整页 re-render，避免滚动位置丢失） */
function sgPaint(code){
  const g=gOf(code),mx=maxQty(g),q=DB.supplyCart[code]||0;
  const inp=document.getElementById('sgq-'+code);if(inp)inp.value=q;
  const m=document.getElementById('sgm-'+code);if(m)m.disabled=q<=0;
  const p=document.getElementById('sgp-'+code);if(p)p.disabled=q>=mx;
  const s=document.getElementById('sgs-'+code);if(s)s.textContent=money(+(q*sIncl(g)).toFixed(2));
  const n=cartLines().length,qq=cartLines().reduce((a,l)=>a+l.qty,0);
  const en=document.getElementById('sg-n');if(en)en.textContent=n;
  const eq=document.getElementById('sg-q');if(eq)eq.textContent=qq;
  const ea=document.getElementById('sg-amt');if(ea)ea.innerHTML=money(cartIncl())+`<s id="sg-net">未税 ${money(cartNet())} · 本期结算单按含税金额扣减</s>`;
  const ok=document.getElementById('sg-ok');if(ok)ok.disabled=!n;
  const cl=document.getElementById('sg-clr');if(cl)cl.disabled=!n;
}
window.sgStep=function(code,d){
  const g=gOf(code),mx=maxQty(g);let q=(DB.supplyCart[code]||0)+d;
  if(q<0)q=0;
  if(q>mx){toast(`「${g.name}」最多可下单 ${mx}${g.unit}（受库存与限购限制）`,'err');q=mx;}
  DB.supplyCart[code]=q;sgPaint(code);
};
window.sgSetQty=function(code,v){
  const g=gOf(code),mx=maxQty(g);let q=parseInt(v,10);
  if(isNaN(q)||q<0)q=0;
  if(q>mx){toast(`「${g.name}」最多可下单 ${mx}${g.unit}（受库存与限购限制）`,'err');q=mx;}
  DB.supplyCart[code]=q;sgPaint(code);
};
window.sgClearCart=function(){DB.supplyCart={};render();toast('已清空采购单','info');};
window.sgSubmitAsk=function(){
  const ls=cartLines();if(!ls.length){toast('请先选择要采购的耗材','err');return;}
  drawer(`<div class="drawer-hd"><div><h3>提交耗材采购单</h3><div style="font-size:12.5px;color:var(--ts);margin-top:2px">提交后自动生成耗材送货单并推送仓库</div></div><span class="x" onclick="closeDrawer()">×</span></div>
  <div class="drawer-bd">
    <table><thead><tr><th>耗材</th><th style="text-align:right">数量</th><th style="text-align:right">未税单价</th><th style="text-align:right">含税单价</th><th style="text-align:right">小计（含税）</th></tr></thead><tbody>
      ${ls.map(l=>`<tr><td><b>${l.name}</b><div style="font-size:11.5px;color:var(--ts)">${l.spec}</div></td>
        <td style="text-align:right">${l.qty}${l.unit}</td>
        <td style="text-align:right">${money(l.price)}</td>
        <td style="text-align:right">${money(sIncl(l))}</td>
        <td style="text-align:right;font-weight:600;color:var(--gd)">${money(lnIncl(l))}</td></tr>`).join('')}
      <tr style="font-weight:700;background:var(--gl)"><td colspan="4">合计（未税 ${money(cartNet())}）</td><td style="text-align:right;color:var(--gd)">${money(cartIncl())}</td></tr>
    </tbody></table>
    <div class="fr" style="margin-top:16px"><label class="fl">备注（选填）</label><input id="sg-note" placeholder="如：请与 07-01 送货批次一并处理"></div>
    <dl class="dl">
      <dt>支付方式</dt><dd>结算抵扣 · 无需线上支付</dd>
      <dt>扣款时点</dt><dd>耗材送货单回写<b>已交付</b>后，计入当期结算单扣减项</dd>
      <dt>当期结算单</dt><dd class="mono">${DB.bill.no} · ${DB.bill.range}</dd>
    </dl>
  </div>
  <div class="drawer-ft"><button class="btn btn-o" onclick="closeDrawer()">再看看</button><button class="btn btn-p" onclick="sgSubmit()">确认提交</button></div>`);
};
window.sgSubmit=function(){
  const ls=cartLines();if(!ls.length)return;
  // 提交前二次校验库存与限购（避免运营端改价改库存后越界）
  for(const l of ls){const g=gOf(l.code),mx=maxQty(g);
    if(g.status!='onsale'){toast(`「${g.name}」已下架，请移除后再提交`,'err');return;}
    if(l.qty>mx){toast(`「${g.name}」超出可下单上限 ${mx}${g.unit}`,'err');return;}}
  const seq=String(++DB.supplySeq).padStart(3,'0'),d='20260630';
  const note=(document.getElementById('sg-note')||{}).value||'';
  const o={no:'HC'+d+seq,date:ts(),shop:DB.merchant.code,shopName:DB.shop.name,lines:ls.map(l=>({...l})),
    status:'pending',deliveryNo:'HS'+d+seq,deliveryStatus:'待处理',pushAt:ts(),deliveredAt:'',billNo:'',invNo:'',note};
  DB.supplyOrders.unshift(o);
  ls.forEach(l=>{const g=gOf(l.code);g.stock=Math.max(0,g.stock-l.qty);});   // 下单锁库存
  DB.supplyCart={};closeDrawer();DB.supplyTab='all';nav('m-supply-order');
  toast(`采购单 ${o.no} 已提交，送货单 ${o.deliveryNo} 已推送仓库`,'ok');
};

/* ================= 商家端 · 我的耗材订单 ================= */
PAGES['m-supply-order']=()=>{
  const tab=DB.supplyTab;
  const mine=DB.supplyOrders.filter(o=>o.shop==DB.merchant.code).sort((a,b)=>b.date.localeCompare(a.date));
  const list=tab=='all'?mine:mine.filter(o=>o.status==tab);
  const cnt=k=>k=='all'?mine.length:mine.filter(o=>o.status==k).length;
  const unbilled=mine.filter(o=>o.status=='delivered');
  const unbilledAmt=+(unbilled.reduce((a,o)=>a+odIncl(o),0)).toFixed(2);
  return `
  <div class="row" style="justify-content:flex-end;margin-bottom:12px"><button class="btn btn-p" onclick="nav('m-supply')">＋ 去耗材商城采购</button></div>
  <div class="sg" style="grid-template-columns:repeat(3,1fr)">
    <div class="sc"><div class="sc-l">在途订单</div><div class="sc-v">${mine.filter(o=>o.status=='pending'||o.status=='shipping').length}</div><div class="sc-s">待送货 / 送货中</div></div>
    <div class="sc ${unbilledAmt?'warn':''}"><div class="sc-l">待计入当期结算（含税）</div><div class="sc-v">${money(unbilledAmt)}</div><div class="sc-s">已交付 ${unbilled.length} 单 · 结算单 ${DB.bill.no}</div></div>
    <div class="sc good"><div class="sc-l">累计采购（含税）</div><div class="sc-v">${money(+(mine.filter(o=>o.status!='canceled').reduce((a,o)=>a+odIncl(o),0)).toFixed(2))}</div><div class="sc-s">不含已取消</div></div>
  </div>
  <div class="tabs">${S_TABS.map(t=>`<div class="tab ${tab==t[0]?'active':''}" onclick="DB.supplyTab='${t[0]}';render()">${t[1]}${cnt(t[0])?`<span class="tb" style="background:var(--ts)">${cnt(t[0])}</span>`:''}</div>`).join('')}</div>
  <div class="card"><div class="card-hd"><h3>耗材采购单</h3><span class="sub">共 ${list.length} 单 · 一张采购单对应一张耗材送货单</span></div>
  <div class="card-bd flush"><div style="overflow-x:auto"><table>
    <thead><tr><th>采购单号</th><th>下单时间</th><th>耗材明细</th><th style="text-align:right">金额（未税）</th><th style="text-align:right">金额（含税）</th><th>送货单号</th><th>送货单状态</th><th>订单状态</th><th>计费结算单</th><th>操作</th></tr></thead><tbody>
    ${list.map(o=>`<tr>
      <td class="mono">${o.no}</td>
      <td style="font-size:12.5px;color:var(--ts);white-space:nowrap">${o.date}</td>
      <td style="max-width:250px;white-space:normal">${o.lines.map(l=>`<div>${l.name} <span style="color:var(--ts)">${l.qty}${l.unit}</span></div>`).join('')}<div style="font-size:11.5px;color:var(--ts);margin-top:2px">共 ${odQty(o)} 件</div></td>
      <td style="text-align:right">${money(odNet(o))}</td>
      <td style="text-align:right;font-weight:600">${money(odIncl(o))}</td>
      <td class="mono">${o.deliveryNo}</td>
      <td>${dTag(o.deliveryStatus)}${o.deliveredAt?`<div style="font-size:11px;color:var(--ts);margin-top:2px">${o.deliveredAt}</div>`:''}</td>
      <td>${sTag(o.status)}</td>
      <td>${o.billNo?`<span class="mono" style="font-size:12px">${o.billNo}</span>`:(o.status=='delivered'?`<span style="font-size:12px;color:var(--y)">待计入 ${DB.bill.no}</span>`:'<span style="color:var(--tt)">—</span>')}</td>
      <td style="white-space:nowrap"><button class="btn btn-o btn-sm" onclick="sgOrderDetail('${o.no}')">详情</button>${o.status=='pending'?` <button class="btn btn-link btn-sm" style="color:var(--r)" onclick="sgCancelAsk('${o.no}')">取消</button>`:''}</td>
    </tr>`).join('')||`<tr><td colspan="10" style="text-align:center;color:var(--ts);padding:22px">该状态暂无耗材采购单</td></tr>`}
    </tbody></table></div></div></div>`;
};
window.sgOrderDetail=function(no,role){
  const o=DB.supplyOrders.find(x=>x.no==no);if(!o)return;
  const plat=role=='plat';
  const steps=['提交采购单','推送仓库','仓库交付','计入结算'];
  const idx=o.status=='canceled'?0:(o.status=='pending'?1:o.status=='shipping'?2:o.status=='delivered'?3:4);
  drawer(`<div class="drawer-hd"><div><h3>${o.no} · 耗材采购单</h3><div style="font-size:12.5px;color:var(--ts);margin-top:2px">${o.date} · ${plat?o.shopName+' · '+o.shop:'共 '+odQty(o)+' 件'}</div></div><span class="x" onclick="closeDrawer()">×</span></div>
  <div class="drawer-bd">
    ${o.status=='canceled'?'<div class="ib ib-gr"><span class="i">🚫</span>本单已取消，不产生扣款。</div>':`<div style="margin-bottom:16px">${pipe(steps,idx)}</div>`}
    <div class="kv" style="grid-template-columns:repeat(3,1fr);margin-bottom:16px">
      <div><div class="k">金额（未税）</div><div class="v">${money(odNet(o))}</div></div>
      <div><div class="k">GST ${sTax(o.lines[0])}%</div><div class="v">${money(+(odIncl(o)-odNet(o)).toFixed(2))}</div></div>
      <div><div class="k">金额（含税）</div><div class="v" style="color:var(--g);font-size:18px">${money(odIncl(o))}</div></div>
    </div>

    <div style="font-weight:600;font-size:13px;margin:4px 2px 6px">① 订单单据 · 耗材明细</div>
    <table><thead><tr><th>耗材编码</th><th>名称 / 规格</th><th style="text-align:right">数量</th><th style="text-align:right">未税单价</th><th style="text-align:right">含税单价</th><th style="text-align:right">小计（含税）</th></tr></thead><tbody>
      ${o.lines.map(l=>`<tr><td class="mono">${l.code}</td><td><b>${l.name}</b><div style="font-size:11.5px;color:var(--ts)">${l.spec}</div></td>
        <td style="text-align:right">${l.qty}${l.unit}</td><td style="text-align:right">${money(l.price)}</td>
        <td style="text-align:right">${money(sIncl(l))}</td><td style="text-align:right;font-weight:600;color:var(--gd)">${money(lnIncl(l))}</td></tr>`).join('')}
      <tr style="font-weight:700;background:var(--gl)"><td colspan="5">合计</td><td style="text-align:right;color:var(--gd)">${money(odIncl(o))}</td></tr>
    </tbody></table>
    ${o.note?`<div style="font-size:12px;color:var(--ts);margin-top:8px">备注：${o.note}</div>`:''}

    <div style="font-weight:600;font-size:13px;margin:18px 2px 6px">② 送货单据 · 推仓库作业</div>
    <dl class="dl">
      <dt>送货单号</dt><dd class="mono">${o.deliveryNo}</dd>
      <dt>单据类型</dt><dd>耗材出库（平台仓 → 商家），与经营送货单 SH 分开，不进对账单</dd>
      <dt>推送时间</dt><dd>${o.pushAt||'—'}</dd>
      <dt>送货单状态</dt><dd>${dTag(o.deliveryStatus)}</dd>
      <dt>交付确认时间</dt><dd>${o.deliveredAt||'—'}</dd>
    </dl>

    <div style="font-weight:600;font-size:13px;margin:18px 2px 6px">③ 结算与开票</div>
    <dl class="dl">
      <dt>支付方式</dt><dd>结算抵扣 · 商家无需付款</dd>
      <dt>计费时点</dt><dd>${o.deliveredAt?`交付确认 ${o.deliveredAt}`:'待交付确认后计费'}</dd>
      <dt>计入结算单</dt><dd>${o.billNo?`<span class="mono">${o.billNo}</span> · 已结清`:(o.status=='delivered'?`<span class="mono">${DB.bill.no}</span> · 当期扣减 ${money(odIncl(o))}`:'—')}</dd>
      <dt>耗材销售发票</dt><dd>${o.invNo?`<span class="mono">${o.invNo}</span> · 已开票（GST ${sTax(o.lines[0])}%）`:'交付确认后由平台开具'}</dd>
    </dl>
    <div style="font-size:11.5px;color:var(--ts);margin-top:10px">耗材款不进对账单、不参与佣金计算；按含税金额作为结算单扣减项，与当期货款轧差。当期应清算不足以覆盖时，差额结转下期继续扣。</div>
  </div>
  <div class="drawer-ft">
    ${plat&&o.status=='pending'?`<button class="btn btn-o" onclick="sgPush('${o.no}')">标记已推送仓库</button>`:''}
    ${plat&&o.status=='shipping'?`<button class="btn btn-p" onclick="sgDeliver('${o.no}')">回写已交付 · 触发计费</button>`:''}
    ${!plat&&o.status=='pending'?`<button class="btn btn-d" onclick="sgCancelAsk('${o.no}')">取消采购单</button>`:''}
    <button class="btn btn-p" onclick="closeDrawer()">关闭</button></div>`);
};
window.sgCancelAsk=function(no){
  const o=DB.supplyOrders.find(x=>x.no==no);if(!o)return;
  askConfirm(`确认取消采购单 <b>${o.no}</b>（${odQty(o)} 件 · ${money(odIncl(o))}）？取消后送货单 ${o.deliveryNo} 同步作废，库存退回。`,()=>{
    o.status='canceled';o.deliveryStatus='已作废';
    o.lines.forEach(l=>{const g=gOf(l.code);if(g.code)g.stock+=l.qty;});
    closeDrawer();supplySettleSync();render();toast(`${o.no} 已取消，送货单同步作废`,'info');
  });
};

/* ================= 运营平台 · 耗材商品 ================= */
PAGES['p-supply-goods']=()=>{
  const gs=DB.supplyGoods;
  return `
  <div class="row" style="justify-content:flex-end;margin-bottom:12px"><button class="btn btn-p" onclick="sgGoodsEdit('')">＋ 新建耗材</button></div>
  <div class="sg" style="grid-template-columns:repeat(4,1fr)">
    <div class="sc"><div class="sc-l">耗材总数</div><div class="sc-v">${gs.length}</div></div>
    <div class="sc good"><div class="sc-l">在售</div><div class="sc-v">${gs.filter(g=>g.status=='onsale'&&g.stock>0).length}</div></div>
    <div class="sc ${gs.filter(g=>g.status=='onsale'&&g.stock<=0).length?'warn':''}"><div class="sc-l">缺货</div><div class="sc-v">${gs.filter(g=>g.status=='onsale'&&g.stock<=0).length}</div><div class="sc-s">在售但库存为 0</div></div>
    <div class="sc"><div class="sc-l">已下架</div><div class="sc-v">${gs.filter(g=>g.status=='offsale').length}</div></div>
  </div>
  <div class="card"><div class="card-hd"><h3>耗材商品</h3><span class="sub">平台统一维护 · 商家端只读，不进商品审核流</span></div>
  <div class="card-bd flush"><div style="overflow-x:auto"><table>
    <thead><tr><th>耗材编码</th><th>名称 / 规格</th><th>类别</th><th>单位</th><th style="text-align:right">未税单价</th><th style="text-align:right">含税单价</th><th>税率</th><th style="text-align:right">库存</th><th>限购</th><th>状态</th><th>操作</th></tr></thead><tbody>
    ${gs.map(g=>`<tr>
      <td class="mono">${g.code}</td>
      <td><b>${g.name}</b><div style="font-size:11.5px;color:var(--ts)">${g.spec}</div></td>
      <td>${g.cat}</td><td>${g.unit}</td>
      <td style="text-align:right">${money(g.price)}</td>
      <td style="text-align:right;color:var(--ts)">${money(sIncl(g))}</td>
      <td>${sTax(g)}%</td>
      <td style="text-align:right">${g.stock<=0?'<span style="color:var(--r);font-weight:600">0</span>':g.stock}</td>
      <td style="font-size:12px">${g.limitCycle} ${g.limitQty}${g.unit}</td>
      <td>${g.status=='onsale'?(g.stock<=0?'<span class="tag t-y"><span class="dot"></span>在售 · 缺货</span>':'<span class="tag t-g"><span class="dot"></span>在售</span>'):'<span class="tag t-gr"><span class="dot"></span>已下架</span>'}</td>
      <td style="white-space:nowrap"><button class="btn btn-o btn-sm" onclick="sgGoodsEdit('${g.code}')">编辑</button>
        <button class="btn btn-link btn-sm" onclick="sgToggle('${g.code}')" style="${g.status=='onsale'?'color:var(--r)':''}">${g.status=='onsale'?'下架':'上架'}</button></td>
    </tr>`).join('')}
    </tbody></table></div></div></div>`;
};
window.sgToggle=function(code){
  const g=gOf(code);const to=g.status=='onsale'?'下架':'上架';
  askConfirm(`确认${to}耗材「${g.name}」？${g.status=='onsale'?'下架后商家端不再展示，已提交的采购单不受影响。':''}`,()=>{
    g.status=g.status=='onsale'?'offsale':'onsale';render();toast(`「${g.name}」已${to}`,g.status=='onsale'?'ok':'info');
  });
};
window.sgGoodsEdit=function(code){
  const g=code?gOf(code):{code:'',name:'',spec:'',unit:'箱',cat:'标签耗材',price:'',tax:9,stock:'',limitQty:'',limitCycle:'单次',status:'onsale',ic:'📦',desc:''};
  const isNew=!code;
  drawer(`<div class="drawer-hd"><div><h3>${isNew?'新建耗材':'编辑耗材 · '+g.name}</h3><div style="font-size:12.5px;color:var(--ts);margin-top:2px">耗材独立类目，不进货品中心、不参与佣金</div></div><span class="x" onclick="closeDrawer()">×</span></div>
  <div class="drawer-bd">
    <div class="fg2">
      <div class="fr"><label class="fl"><b>*</b>耗材编码</label><input id="sgf-code" value="${g.code}" ${isNew?'placeholder="如 HC-LBL-6040"':'disabled'}></div>
      <div class="fr"><label class="fl"><b>*</b>类别</label><select id="sgf-cat">${['标签耗材','打印设备','周转物料'].map(c=>`<option ${g.cat==c?'selected':''}>${c}</option>`).join('')}</select></div>
    </div>
    <div class="fr"><label class="fl"><b>*</b>耗材名称</label><input id="sgf-name" value="${g.name}" placeholder="如 热敏标签纸 60×40mm"></div>
    <div class="fr"><label class="fl"><b>*</b>规格</label><input id="sgf-spec" value="${g.spec}" placeholder="如 500张/卷 · 20卷/箱"></div>
    <div class="fg3">
      <div class="fr"><label class="fl"><b>*</b>计价单位</label><select id="sgf-unit">${['箱','盒','台','个','卷','包'].map(u=>`<option ${g.unit==u?'selected':''}>${u}</option>`).join('')}</select></div>
      <div class="fr"><label class="fl"><b>*</b>未税单价（SGD）</label><input id="sgf-price" type="number" step="0.01" min="0" value="${g.price}" oninput="sgPreviewIncl()"></div>
      <div class="fr"><label class="fl"><b>*</b>税率（%）</label><input id="sgf-tax" type="number" step="1" min="0" max="30" value="${g.tax}" oninput="sgPreviewIncl()"></div>
    </div>
    <div class="ib ib-b" id="sgf-incl"><span class="i">🧮</span>含税单价 = 未税单价 ×(1+税率) = <b>${g.price?money(sIncl(g)):'—'}</b></div>
    <div class="fg3">
      <div class="fr"><label class="fl"><b>*</b>可售库存</label><input id="sgf-stock" type="number" step="1" min="0" value="${g.stock}"></div>
      <div class="fr"><label class="fl"><b>*</b>限购周期</label><select id="sgf-lc">${['单次','每店累计'].map(c=>`<option ${g.limitCycle==c?'selected':''}>${c}</option>`).join('')}</select></div>
      <div class="fr"><label class="fl"><b>*</b>限购数量</label><input id="sgf-lq" type="number" step="1" min="1" value="${g.limitQty}"></div>
    </div>
    <div class="fr"><label class="fl">耗材说明</label><textarea id="sgf-desc" placeholder="商家端商品卡展示">${g.desc||''}</textarea></div>
    <div id="sgf-err" style="font-size:12.5px;color:var(--r)"></div>
  </div>
  <div class="drawer-ft"><button class="btn btn-o" onclick="closeDrawer()">取消</button><button class="btn btn-p" onclick="sgGoodsSave('${code}')">保存</button></div>`);
};
window.sgPreviewIncl=function(){
  const p=parseFloat((document.getElementById('sgf-price')||{}).value),t=parseFloat((document.getElementById('sgf-tax')||{}).value);
  const el=document.getElementById('sgf-incl');if(!el)return;
  el.innerHTML=`<span class="i">🧮</span>含税单价 = 未税单价 ×(1+税率) = <b>${(p>0&&t>=0)?money(+(p*(1+t/100)).toFixed(2)):'—'}</b>`;
};
window.sgGoodsSave=function(code){
  const v=id=>(document.getElementById(id)||{}).value;
  const err=document.getElementById('sgf-err');
  const o={code:(v('sgf-code')||'').trim().toUpperCase(),name:(v('sgf-name')||'').trim(),spec:(v('sgf-spec')||'').trim(),
    cat:v('sgf-cat'),unit:v('sgf-unit'),price:parseFloat(v('sgf-price')),tax:parseFloat(v('sgf-tax')),
    stock:parseInt(v('sgf-stock'),10),limitCycle:v('sgf-lc'),limitQty:parseInt(v('sgf-lq'),10),desc:(v('sgf-desc')||'').trim()};
  const fails=[];
  if(!o.code)fails.push('耗材编码必填');
  if(!code&&DB.supplyGoods.some(g=>g.code==o.code))fails.push('耗材编码已存在');
  if(!o.name)fails.push('耗材名称必填');
  if(!o.spec)fails.push('规格必填');
  if(!(o.price>0))fails.push('未税单价必须 > 0');
  if(!(o.tax>=0))fails.push('税率必须 ≥ 0');
  if(!(o.stock>=0))fails.push('可售库存必须 ≥ 0');
  if(!(o.limitQty>=1))fails.push('限购数量必须 ≥ 1');
  if(fails.length){err.innerHTML=fails.join('；');return;}
  if(code){Object.assign(gOf(code),o);}
  else{DB.supplyGoods.push({...o,status:'onsale',ic:o.cat=='打印设备'?'🖨️':o.cat=='标签耗材'?'🏷️':'📦'});}
  closeDrawer();render();toast(code?'耗材已更新':'耗材已创建并上架','ok');
};

/* ================= 运营平台 · 耗材订单 ================= */
PAGES['p-supply-order']=()=>{
  const tab=DB.supplyTab;
  const all=[...DB.supplyOrders].sort((a,b)=>b.date.localeCompare(a.date));
  const list=tab=='all'?all:all.filter(o=>o.status==tab);
  const cnt=k=>k=='all'?all.length:all.filter(o=>o.status==k).length;
  return `
  <div class="sg" style="grid-template-columns:repeat(4,1fr)">
    <div class="sc ${cnt('pending')?'warn':''}"><div class="sc-l">待推送仓库</div><div class="sc-v">${cnt('pending')}</div></div>
    <div class="sc"><div class="sc-l">仓库作业中</div><div class="sc-v">${cnt('shipping')}</div><div class="sc-s">待回写交付</div></div>
    <div class="sc"><div class="sc-l">已交付待结算</div><div class="sc-v">${cnt('delivered')}</div><div class="sc-s">计入当期结算扣减</div></div>
    <div class="sc good"><div class="sc-l">已交付金额（含税）</div><div class="sc-v">${money(+(all.filter(o=>o.status=='delivered'||o.status=='settled').reduce((a,o)=>a+odIncl(o),0)).toFixed(2))}</div></div>
  </div>
  <div class="tabs">${S_TABS.map(t=>`<div class="tab ${tab==t[0]?'active':''}" onclick="DB.supplyTab='${t[0]}';render()">${t[1]}${cnt(t[0])?`<span class="tb" style="background:var(--ts)">${cnt(t[0])}</span>`:''}</div>`).join('')}</div>
  <div class="card"><div class="card-hd"><h3>耗材订单</h3><span class="sub">共 ${list.length} 单 · 交付回写即触发商家结算扣款</span></div>
  <div class="card-bd flush"><div style="overflow-x:auto"><table>
    <thead><tr><th>采购单号</th><th>店铺</th><th>下单时间</th><th>耗材明细</th><th style="text-align:right">未税</th><th style="text-align:right">含税</th><th>送货单号</th><th>送货单状态</th><th>订单状态</th><th>操作</th></tr></thead><tbody>
    ${list.map(o=>`<tr>
      <td class="mono">${o.no}</td>
      <td>${o.shopName}<div class="mono" style="font-size:11.5px;color:var(--ts)">${o.shop}</div></td>
      <td style="font-size:12.5px;color:var(--ts);white-space:nowrap">${o.date}</td>
      <td style="max-width:230px;white-space:normal">${o.lines.map(l=>`<div>${l.name} <span style="color:var(--ts)">${l.qty}${l.unit}</span></div>`).join('')}</td>
      <td style="text-align:right">${money(odNet(o))}</td>
      <td style="text-align:right;font-weight:600">${money(odIncl(o))}</td>
      <td class="mono">${o.deliveryNo}</td>
      <td>${dTag(o.deliveryStatus)}</td>
      <td>${sTag(o.status)}</td>
      <td style="white-space:nowrap">
        <button class="btn btn-o btn-sm" onclick="sgOrderDetail('${o.no}','plat')">详情</button>
        ${o.status=='pending'?` <button class="btn btn-o btn-sm" onclick="sgPush('${o.no}')">推送仓库</button> <button class="btn btn-link btn-sm" style="color:var(--r)" onclick="sgCancelAsk('${o.no}')">取消</button>`:''}
        ${o.status=='shipping'?` <button class="btn btn-p btn-sm" onclick="sgDeliver('${o.no}')">回写已交付</button>`:''}
      </td>
    </tr>`).join('')||`<tr><td colspan="10" style="text-align:center;color:var(--ts);padding:22px">该状态暂无耗材订单</td></tr>`}
    </tbody></table></div></div></div>`;
};
window.sgPush=function(no){
  const o=DB.supplyOrders.find(x=>x.no==no);if(!o||o.status!='pending')return;
  o.status='shipping';o.deliveryStatus='已推送';o.pushAt=ts();closeDrawer();render();
  toast(`送货单 ${o.deliveryNo} 已推送仓库作业`,'ok');
};
window.sgDeliver=function(no){
  const o=DB.supplyOrders.find(x=>x.no==no);if(!o||o.status!='shipping')return;
  askConfirm(`确认回写送货单 <b>${o.deliveryNo}</b> 为「已交付」？回写后 <b>${money(odIncl(o))}</b> 立即计入商家当期结算单 ${DB.bill.no} 扣减项，且订单不可再取消。`,()=>{
    o.status='delivered';o.deliveryStatus='已交付';o.deliveredAt=ts();
    o.invNo='SUP-INV-2026-'+(500+DB.supplyInvoices.length+1);
    DB.supplyInvoices.unshift({no:o.invNo,order:o.no,date:ts().slice(0,10),net:odNet(o),gst:+(odIncl(o)-odNet(o)).toFixed(2),total:odIncl(o),status:'已开票'});
    supplySettleSync();closeDrawer();render();
    toast(`已交付，${money(odIncl(o))} 计入 ${DB.bill.no}，耗材发票 ${o.invNo} 已开具`,'ok');
  });
};

/* ================= 商家端 · 耗材发票（发票管理 ③ Tab 内容） ================= */
window.supplyInvoiceContent=function(){
  const rows=DB.supplyInvoices;
  return `<div class="card"><div class="card-hd"><h3>耗材销售发票</h3><span class="sub">平台向你开具 · 交付确认后自动开票（GST ${GST_DEFAULT}%）· 共 ${rows.length} 张</span></div>
  <div class="card-bd ${rows.length?'flush':''}">
    ${rows.length?`<div style="overflow-x:auto"><table><thead><tr><th>发票号</th><th>关联采购单</th><th>开票日期</th><th style="text-align:right">未税金额</th><th style="text-align:right">GST</th><th style="text-align:right">价税合计</th><th>状态</th><th>操作</th></tr></thead><tbody>
    ${rows.map(v=>`<tr><td class="mono">${v.no}</td><td class="mono">${v.order}</td><td>${v.date}</td>
      <td style="text-align:right">${money(v.net)}</td><td style="text-align:right">${money(v.gst)}</td>
      <td style="text-align:right;font-weight:600">${money(v.total)}</td>
      <td><span class="tag t-g"><span class="dot"></span>${v.status}</span></td>
      <td style="white-space:nowrap"><button class="btn btn-o btn-sm" onclick="toast('预览 ${v.no}','info')">预览</button> <button class="btn btn-link btn-sm" onclick="toast('已下载 ${v.no}.pdf','ok')">下载</button></td></tr>`).join('')}
    </tbody></table></div>`:'<div class="empty"><div class="e-ic">🧾</div><div class="e-t">暂无耗材发票</div><div class="e-s">耗材送货单回写已交付后，平台自动开具销售发票</div></div>'}
  </div></div>`;
};

})();
