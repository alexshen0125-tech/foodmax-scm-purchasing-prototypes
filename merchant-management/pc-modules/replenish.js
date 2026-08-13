/* PC · 平台补采（商家端）+ 缺货罚款标准配置（运营平台端）+ 罚款单（商家端）
   适用范围：仅【出库前·仓内收货清点】场景；差异只有一种——实收数量 < 应送数量（数量少了），无原因分类。
   业务链：商家送货到仓 → 收货清点发现少货 → 自营现货可【全额覆盖】缺口 → 自营出库补齐
           → 同时生成【平台补采单】与【缺货罚款单】两张单 → 均计入当期结算单扣减项
           → 平台就补采部分向商家开【补采销售发票】(TAX INVOICE)；罚款不开发票。
   口径（2026-08-13 流程变更）：
   - 客户订单完全无感：商品/金额/发票不变；商家 GMV 与平台佣金按【应送数量】足额计，不因少货下调。
   - 补采单价(含税) = 【自营商品原定价】，**不做加价**（原 30% 加价方案作废）。
   - 缺货罚款 = 缺口件数 × 罚款标准（默认 S$40/件），全平台统一、平台可配、生成时快照；
     按件计罚、与货值无关；罚款【不开发票】，仅作结算扣减项。
   - 补采单与罚款单【同时生成、各自独立】：1 张补采单 ↔ 1 张罚款单。
   - 自营现货不足以【全额覆盖】缺口 → 两张单都不生成，按实收数量出库并标缺货。
   - 支付方式固定 = 结算抵扣，商家无支付动作。
   - 应清算 = 汇总总额 − 逆向扣减 − 服务佣金 − 物流佣金 − 耗材采购扣款 − 平台补采扣款 − 缺货罚款。
   - 异议走线下：不设线上申诉入口。判责结论不对商家展示，只展示应送/实收数量与差异。
   依赖主文件全局：DB / money / toast / drawer / closeDrawer / nav / render / flowTip / GST_DEFAULT。 */
(function(){

/* ================= 平台可配：缺货罚款标准（全平台统一单值） ================= */
DB.replCfg = DB.replCfg || { finePerUnit: 40 };   // 缺货罚款 SGD/件，全平台统一，不分商家/品类/site
window.replFineRate = function(){ return DB.replCfg.finePerUnit; };

/* ================= 演示数据（挂 DB，跨 render 持久） ================= */
DB.replOrders = DB.replOrders || [
  {no:'RPL-20260628-003', deliveryNo:'SH20260628004', subOrderNo:'#SG20260628011', warehouse:'盛港DC',
   receiptTime:'2026-06-28 01:06', sku:'SKU8801', name:'小棠菜', spec:'1kg/件', unit:'件',
   should:20, received:18, qty:2, selfPrice:2.90,
   status:'pending', billNo:'', invNo:''},
  {no:'RPL-20260628-006', deliveryNo:'SH20260628004', subOrderNo:'#SG20260628014', warehouse:'盛港DC',
   receiptTime:'2026-06-28 01:09', sku:'SKU8805', name:'菜心', spec:'1kg/件', unit:'件',
   should:15, received:12, qty:3, selfPrice:3.60,
   status:'pending', billNo:'', invNo:''},
  {no:'RPL-20260629-004', deliveryNo:'SH20260629005', subOrderNo:'#SG20260629004', warehouse:'兀兰DC',
   receiptTime:'2026-06-29 03:24', sku:'SKU8804', name:'空心菜', spec:'1kg/件', unit:'件',
   should:30, received:22, qty:8, selfPrice:3.50,
   status:'pending', billNo:'', invNo:''},
  {no:'RPL-20260630-005', deliveryNo:'SH20260630007', subOrderNo:'#SG20260630012', warehouse:'大巴窑DC',
   receiptTime:'2026-06-30 04:11', sku:'SKU8802', name:'白菜', spec:'1kg/件', unit:'件',
   should:40, received:37, qty:3, selfPrice:2.30,
   status:'deducted', billNo:'ST202606-M0815', invNo:''},
  {no:'RPL-20260522-002', deliveryNo:'SH20260522001', subOrderNo:'#SG20260522006', warehouse:'盛港DC',
   receiptTime:'2026-05-22 13:42', sku:'SKU8803', name:'菠菜', spec:'1kg/件', unit:'件',
   should:12, received:10, qty:2, selfPrice:4.10,
   status:'invoiced', billNo:'ST202605-M0815', invNo:'RPL-INV-2026-302'},
  {no:'RPL-20260518-001', deliveryNo:'SH20260518001', subOrderNo:'#SG20260518009', warehouse:'裕廊DC',
   receiptTime:'2026-05-18 02:18', sku:'SKU8811', name:'鲜鸡蛋', spec:'30枚/盘', unit:'盘',
   should:60, received:48, qty:12, selfPrice:9.20,
   status:'invoiced', billNo:'ST202605-M0815', invNo:'RPL-INV-2026-301'},
];
DB.replInvoices = DB.replInvoices || [
  {no:'RPL-INV-2026-302', repl:'RPL-20260522-002', date:'2026-06-06', status:'已开票'},
  {no:'RPL-INV-2026-301', repl:'RPL-20260518-001', date:'2026-06-06', status:'已开票'},
];
DB.replTab = DB.replTab || 'all';

/* ===== 罚款单：独立数据源，与补采单【无关联】=====
   罚款针对的是「到仓少货」这一事实本身，只要清点出缺口就罚；
   补采只在自营现货可全额覆盖缺口时才发生 —— 因此存在「有罚款单、无补采单」的情况
   （如下 FN20260701008：自营无货未补采，但缺货照罚）。两者不互为前置、不互相引用。 */
DB.fineOrders = DB.fineOrders || [
  {no:'FN20260628004', deliveryNo:'SH20260628004', warehouse:'盛港DC', at:'2026-06-28 01:06', rate:40,
   items:[{sku:'SKU8801',name:'小棠菜',spec:'1kg/件',unit:'件',should:20,received:18,qty:2},
          {sku:'SKU8805',name:'菜心',  spec:'1kg/件',unit:'件',should:15,received:12,qty:3}],
   status:'pending', billNo:''},
  {no:'FN20260629005', deliveryNo:'SH20260629005', warehouse:'兀兰DC', at:'2026-06-29 03:24', rate:40,
   items:[{sku:'SKU8804',name:'空心菜',spec:'1kg/件',unit:'件',should:30,received:22,qty:8}],
   status:'pending', billNo:''},
  {no:'FN20260701008', deliveryNo:'SH20260701008', warehouse:'淡滨尼DC', at:'2026-07-01 02:40', rate:40,
   items:[{sku:'SKU8807',name:'芥蓝',  spec:'1kg/件',unit:'件',should:25,received:20,qty:5}],
   status:'pending', billNo:'', noRepl:1},
  {no:'FN20260630007', deliveryNo:'SH20260630007', warehouse:'大巴窑DC', at:'2026-06-30 04:11', rate:40,
   items:[{sku:'SKU8802',name:'白菜',  spec:'1kg/件',unit:'件',should:40,received:37,qty:3}],
   status:'deducted', billNo:'ST202606-M0815'},
  {no:'FN20260522001', deliveryNo:'SH20260522001', warehouse:'盛港DC', at:'2026-05-22 13:42', rate:40,
   items:[{sku:'SKU8803',name:'菠菜',  spec:'1kg/件',unit:'件',should:12,received:10,qty:2}],
   status:'deducted', billNo:'ST202605-M0815'},
  {no:'FN20260518001', deliveryNo:'SH20260518001', warehouse:'裕廊DC', at:'2026-05-18 02:18', rate:40,
   items:[{sku:'SKU8811',name:'鲜鸡蛋',spec:'30枚/盘',unit:'盘',should:60,received:48,qty:12}],
   status:'deducted', billNo:'ST202605-M0815'},
];

/* ================= 口径计算 ================= */
const gst  = ()=> (typeof GST_DEFAULT=='number'?GST_DEFAULT:9);
const rGap  = r => Math.max(0, r.should - r.received);                    // 缺口数量
const rUnit = r => +(r.selfPrice).toFixed(2);                             // 补采单价（含税）= 自营商品原定价，无加价
const rAmt  = r => +(rUnit(r)*r.qty).toFixed(2);                          // 补采金额（含税）
const rNet  = r => +(rAmt(r)/(1+gst()/100)).toFixed(2);                   // 不含税
const rGst  = r => +(rAmt(r)-rNet(r)).toFixed(2);                         // GST
const rOf   = no => DB.replOrders.find(x=>x.no==no);
window.replOf = rOf; window.replAmt = rAmt; window.replUnit = rUnit; window.replNet = rNet; window.replGst = rGst;
// 送货单 → 补采单（送货单详情联动用）
window.replByDelivery = function(id){return DB.replOrders.filter(r=>r.deliveryNo==id);};

const R_ST = {pending:['待结算','t-y'], deducted:['已结算','t-b'], invoiced:['已开票','t-g'], voided:['已作废','t-gr'], reversed:['已冲正','t-gr']};
const R_TABS = [['all','全部'],['pending','待结算'],['deducted','已结算'],['invoiced','已开票']];   // 已作废/已冲正不设独立 Tab（运营侧极少发生），单据仍在「全部」中按状态标签展示
function rTag(s){const[t,c]=R_ST[s]||['—','t-gr'];return `<span class="tag ${c}"><span class="dot"></span>${t}</span>`;}

/* 结算联动：待结算的补采单按含税金额汇总为当期结算单扣减项 */
window.replSettleSync=function(){
  const pend=DB.replOrders.filter(r=>r.status=='pending');
  const amt=+(pend.reduce((a,r)=>a+rAmt(r),0)).toFixed(2);
  DB.bill.repl=amt; DB.bill.replCnt=pend.length;
  DB.bill.items=DB.bill.items.filter(it=>it[0]!='平台补采扣款（含税）');
  if(amt>0)DB.bill.items.push(['平台补采扣款（含税）',pend.length,-amt]);
  DB.bill.net=+(DB.bill.gross-DB.bill.reverse-(DB.bill.feeSvc||0)-(DB.bill.feeLogi||0)-(DB.bill.supply||0)-amt).toFixed(2);
};
replSettleSync();

/* ================= 商家端 · 平台补采 ================= */
PAGES['m-replenish']=()=>{
  const t=DB.replTab;
  const all=DB.replOrders;
  const hit=(v,k)=>!k||String(v||'').toLowerCase().includes(String(k).trim().toLowerCase());
  const rows=all
    .filter(r=>t=='all'||r.status==t)
    .filter(r=>hit(r.no,DB.replFilter&&DB.replFilter.no)&&hit(r.deliveryNo,DB.replFilter&&DB.replFilter.dl)&&hit(r.subOrderNo,DB.replFilter&&DB.replFilter.od));

  const tabs=`<div class="tabs">${R_TABS.map(x=>{
    const n=x[0]=='all'?all.length:all.filter(r=>r.status==x[0]).length;
    return `<div class="tab ${t==x[0]?'active':''}" onclick="DB.replTab='${x[0]}';render()">${x[1]}${n?`<span class="tb">${n}</span>`:''}</div>`;
  }).join('')}</div>`;

  const f=DB.replFilter=DB.replFilter||{no:'',dl:'',od:''};
  const filt=`<div class="card" style="margin-bottom:14px"><div class="card-bd" style="padding:16px 20px 12px">
    <div class="fg3">
      <div class="fr"><label class="fl">补采单号</label><input id="rf-no" value="${f.no}" placeholder="如 RPL-20260628-003"></div>
      <div class="fr"><label class="fl">关联送货单号</label><input id="rf-dl" value="${f.dl}" placeholder="如 SH20260628004"></div>
      <div class="fr"><label class="fl">原订单号（供应商子单）</label><input id="rf-od" value="${f.od}" placeholder="如 #SG20260628011"></div>
    </div>
    <div class="row" style="justify-content:flex-end;gap:8px;margin-top:2px">
      <button class="btn btn-o" onclick="repl_resetFilter()">重置</button>
      <button class="btn btn-p" onclick="repl_doFilter()">查询</button>
    </div>
  </div></div>`;

  const tip=flowTip('');

  if(!rows.length) return tip+filt+tabs+`<div class="empty"><div class="e-ic">🔁</div><div class="e-t">${(f.no||f.dl||f.od)?'没有符合筛选条件的补采单':(t=='all'?'暂无自营补采单':'该状态下暂无补采单')}</div><div class="e-s">${(f.no||f.dl||f.od)?'换个单号试试，或点「重置」查看全部。':(t=='all'?'足额送货到仓即不会产生补采单。仓库收货清点少货且自营有货补货时，此处生成单据。':'切换上方状态查看其它补采单。')}</div></div>`;

  return tip+filt+tabs+`
  <div class="card">
  <div class="card-bd flush"><div style="overflow-x:auto"><table>
    <thead><tr><th>补采单号</th><th>关联送货单 / 原订单</th><th>商品</th><th style="text-align:right">应送 / 实收</th><th style="text-align:right">缺口·补货</th><th style="text-align:right">单价（含税）</th><th style="text-align:right">补采扣款（含税）</th><th>状态</th><th>操作</th></tr></thead><tbody>
    ${rows.map(r=>`<tr>
      <td class="mono" style="white-space:nowrap">${r.no}</td>
      <td class="mono" style="font-size:12px;white-space:nowrap">${r.deliveryNo}<div style="color:var(--ts);margin-top:2px">${r.subOrderNo}</div></td>
      <td style="white-space:nowrap"><b>${r.name}</b><div style="font-size:11px;color:var(--ts);margin-top:2px">${r.sku} · ${r.spec}</div></td>
      <td style="text-align:right">${r.should} <span style="color:var(--ts)">/</span> <b style="color:var(--r)">${r.received}</b></td>
      <td style="text-align:right"><b>${r.qty}</b> ${r.unit}</td>
      <td style="text-align:right">${money(rUnit(r))}</td>
      <td style="text-align:right;color:var(--r);font-weight:600">-${money(rAmt(r))}</td>
      <td style="white-space:nowrap">${rTag(r.status)}${r.billNo?`<div style="font-size:11px;color:var(--ts);margin-top:2px">${r.billNo}</div>`:''}</td>
      <td style="white-space:nowrap"><button class="btn btn-o btn-sm" onclick="repl_detail('${r.no}')">详情</button></td>
    </tr>`).join('')}
    </tbody></table></div></div>
  <div class="card-bd" style="border-top:1px solid var(--bd2);font-size:12.5px;color:var(--ts)">口径：<b>平台补采单</b>＝缺口由平台自营现货补齐的部分，按<b>自营商品原定价</b>计价（<b>不加价</b>），视同你向平台采购，在当期结算单中扣减。缺货另有<b>罚款单</b>（见「财务 › 罚款单」），<b>与本单无关联、各自独立</b>。客户订单按<b>应送数量</b>足额计入 GMV 与平台佣金，缺口部分不冲减。自营现货<b>不足以全额覆盖</b>缺口时不生成补采单，按实收数量出库并标缺货。</div>
  </div>`;
};

window.repl_doFilter=function(){
  const g=id=>(document.getElementById(id)||{}).value||'';
  DB.replFilter={no:g('rf-no').trim(),dl:g('rf-dl').trim(),od:g('rf-od').trim()};
  render();
};
window.repl_resetFilter=function(){DB.replFilter={no:'',dl:'',od:''};render();toast('筛选条件已重置','info');};

/* ---------- 详情（右侧抽屉 · 三段式）---------- */
window.repl_detail=function(no){
  const r=rOf(no); if(!r) return;
  const inv=(DB.replInvoices||[]).find(x=>x.repl==no);
  const kv=(k,v)=>`<div style="min-width:0"><div style="font-size:12px;color:var(--ts);margin-bottom:4px">${k}</div><div style="font-size:13.5px;color:var(--tp);font-weight:500;word-break:break-word">${v||'—'}</div></div>`;
  const sec=t=>`<div style="display:flex;align-items:center;gap:10px;margin:2px 0 14px"><span style="width:4px;height:16px;background:var(--g);border-radius:2px"></span><h3 style="font-size:14.5px;font-weight:700">${t}</h3></div>`;
  drawer(`<div class="drawer-hd"><div><h3>${r.no} · 补采单</h3><div style="font-size:12.5px;color:var(--ts);margin-top:2px">${r.warehouse} · 收货清点 ${r.receiptTime}</div></div><span class="x" onclick="closeDrawer()">×</span></div>
  <div class="drawer-bd">
    <div class="row" style="gap:8px;margin-bottom:14px">${rTag(r.status)}<span class="tag t-r"><span class="dot"></span>少货 ${rGap(r)} ${r.unit}</span></div>
    <div class="ib ib-y" style="margin-bottom:16px"><span class="i">🔁</span>本单少货 <b>${rGap(r)} ${r.unit}</b>，已由平台<b>自营现货全额补齐</b>，客户订单未受影响（商品/金额/发票不变）。缺口部分视同你向平台采购，货款在结算单中抵扣。</div>

    ${sec('单据信息')}
    <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:14px 24px;margin-bottom:20px">
      ${kv('补采单号',`<span class="mono">${r.no}</span>`)}
      ${kv('关联送货单',`<span class="mono">${r.deliveryNo}</span> <button class="btn btn-link btn-sm" style="padding:0 0 0 4px" onclick="closeDrawer();DB.delivTab='sign';DB.delivView='${r.deliveryNo}';nav('m-delivery')">查看</button>`)}
      ${kv('关联原订单（供应商子单）',`<span class="mono">${r.subOrderNo}</span>`)}
      ${kv('入库仓库',r.warehouse)}
      ${kv('收货清点时间',`${r.receiptTime}（出库前·仓内清点）`)}
      ${kv('差异',`实收 ${r.received} − 应送 ${r.should} = <b style="color:var(--r)">-${rGap(r)}</b> ${r.unit}（数量少送）`)}
    </div>

    ${sec('商品明细')}
    <div style="overflow-x:auto;margin-bottom:10px"><table>
      <thead><tr><th>商品</th><th style="text-align:right">应送</th><th style="text-align:right">实收</th><th style="text-align:right">缺口</th><th style="text-align:right">补货数量</th></tr></thead><tbody>
      <tr><td style="white-space:nowrap"><b>${r.name}</b><div style="font-size:11px;color:var(--ts);margin-top:2px">${r.sku} · ${r.spec}</div></td>
        <td style="text-align:right">${r.should}</td>
        <td style="text-align:right;color:var(--r);font-weight:600">${r.received}</td>
        <td style="text-align:right;color:var(--r);font-weight:600">${rGap(r)}</td>
        <td style="text-align:right"><b>${r.qty}</b> ${r.unit}</td></tr>
    </tbody></table></div>
    <div style="overflow-x:auto;margin-bottom:20px"><table>
      <tbody>
        <tr><td style="color:var(--ts)">单价（含税）<div style="font-size:11px;margin-top:2px">取自营商品原定价，生成时快照</div></td><td style="text-align:right">${money(rUnit(r))} / ${r.unit}</td></tr>
        <tr><td style="color:var(--ts)">补采金额（含税） = ${money(rUnit(r))} × ${r.qty}${r.unit}<div style="font-size:11px;margin-top:2px"><b>不加价</b></div></td><td style="text-align:right;font-weight:600">${money(rAmt(r))}</td></tr>
        <tr><td style="color:var(--ts)">不含税金额</td><td style="text-align:right">${money(rNet(r))}</td></tr>
        <tr><td style="color:var(--ts)">GST ${gst()}%</td><td style="text-align:right">${money(rGst(r))}</td></tr>
        <tr style="font-weight:700;background:var(--gl)"><td>补采扣款（含税 · 结算抵扣）</td><td style="text-align:right;color:var(--r)">-${money(rAmt(r))}</td></tr>

      </tbody>
    </table></div>

    ${sec('结算与发票')}
    <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:14px 24px">
      ${kv('抵扣所属结算单',r.billNo?`<span class="mono">${r.billNo}</span> <button class="btn btn-link btn-sm" style="padding:0 0 0 4px" onclick="closeDrawer();nav('m-settle')">查看</button>`:'待本期结算单生成时抵扣')}
      ${kv('补采发票',inv?`<span class="mono">${inv.no}</span> <button class="btn btn-link btn-sm" style="padding:0 0 0 4px" onclick="closeDrawer();DB.invTab='repl';nav('m-invoice')">查看</button>`:'结算完成后由平台自动开具')}
    </div>
    <div class="ib ib-b" style="margin-top:16px"><span class="i">ℹ️</span>对<b>实收数量</b>有异议，请在<b>收货清点后 7 个自然日内</b>联系你的运营对接人（微信群「Food Max 供应商-绿鲜源」/ +65 6123 4567），并提供<b>装车照片或司机交接单</b>；平台将调取仓库收货监控核对，核实有误的由运营发起<b>冲正</b>，在下期结算回补并开红冲发票。逾期以清点数量为准。本期不设线上申诉入口。</div>
  </div>
  <div class="drawer-ft"><button class="btn btn-o" onclick="closeDrawer()">关闭</button>${inv?`<button class="btn btn-p" onclick="repl_invDownload('${inv.no}')">下载发票 PDF</button>`:''}</div>`);
};

/* ================= 发票管理 Tab ④ · 补采发票（平台开具） ================= */
window.replInvoiceContent=function(){
  const rows=(DB.replInvoices||[]).map(iv=>({iv,r:rOf(iv.repl)})).filter(x=>x.r);
  return `${flowTip(`<b>补采发票</b>由平台在与你<b>结算完成后自动开具</b>并推送给你——平台就<b>自营现货补货的缺口数量</b>向你开具销售发票（TAX INVOICE, GST ${gst()}%），<b>无需你申请</b>。此处仅供<b>查看与下载</b>。`)}
  <div class="card"><div class="card-hd"><h3>自营补采发票记录</h3><span class="sub">平台开具 · 共 ${rows.length} 张</span></div><div class="card-bd ${rows.length?'flush':''}">
    ${rows.length?`<table><thead><tr><th>发票号</th><th>关联补采单</th><th>商品 / 数量</th><th style="text-align:right">不含税</th><th style="text-align:right">GST ${gst()}%</th><th style="text-align:right">价税合计</th><th>开票日期</th><th>状态</th><th>操作</th></tr></thead><tbody>
      ${rows.map(({iv,r})=>`<tr>
        <td class="mono">${iv.no}</td>
        <td class="mono" style="font-size:12px">${r.no}</td>
        <td>${r.name} <span style="color:var(--ts)">× ${r.qty} ${r.unit}</span></td>
        <td style="text-align:right">${money(rNet(r))}</td>
        <td style="text-align:right">${money(rGst(r))}</td>
        <td style="text-align:right;font-weight:600">${money(rAmt(r))}</td>
        <td style="font-size:12.5px;color:var(--ts)">${iv.date}</td>
        <td><span class="tag t-g"><span class="dot"></span>已开票</span></td>
        <td style="white-space:nowrap"><button class="btn btn-o btn-sm" onclick="repl_invPreview('${iv.no}')">预览</button> <button class="btn btn-link" onclick="repl_invDownload('${iv.no}')">下载</button></td>
      </tr>`).join('')}
    </tbody></table>`
    :`<div class="empty" style="padding:20px"><div class="e-ic">🧾</div><div class="e-t">暂无自营补采发票</div><div class="e-s">产生平台补采且结算完成后，平台会开具补货销售发票并显示在此。</div></div>`}
  </div></div>`;
};
window.repl_invDownload=function(no){toast('发票 '+no+' 已下载 (PDF)','ok');};
window.repl_invPreview=function(no){
  const iv=(DB.replInvoices||[]).find(x=>x.no==no); if(!iv) return;
  const r=rOf(iv.repl); if(!r) return;
  drawer(`<div class="drawer-hd"><div><h3>补采发票预览</h3><div style="font-size:12.5px;color:var(--ts);margin-top:2px">${iv.no} · 平台已开具</div></div><span class="x" onclick="closeDrawer()">×</span></div>
  <div class="drawer-bd">
    <div class="ib ib-b" style="margin-bottom:12px"><span class="i">ℹ️</span>本发票由<b>平台</b>就补采单 <span class="mono">${r.no}</span>（自营现货补货你少送的 ${r.qty} ${r.unit}）向<b>你（商家）</b>开具，开票方＝平台、收票方＝商家。</div>
    <div class="card" style="box-shadow:none;border:1px solid var(--bd)"><div class="card-bd">
      <div style="text-align:center;font-size:18px;font-weight:700;margin-bottom:2px">平台补采销售发票 · TAX INVOICE</div>
      <div style="text-align:center;font-size:12px;color:var(--ts);margin-bottom:16px">Food Max 平台就平台补采商品向商家开具（GST ${gst()}%）</div>
      <dl class="dl">
        <dt>发票号</dt><dd class="mono">${iv.no}</dd>
        <dt>开票日期</dt><dd>${iv.date}</dd>
        <dt>开票方（平台）</dt><dd>10X AI Technology Pte Ltd · GST Reg 202412345K</dd>
        <dt>收票方（商家）</dt><dd>绿鲜源蔬果 Green Fresh Produce Pte Ltd</dd>
        <dt>关联补采单</dt><dd class="mono">${r.no}</dd>
        <dt>关联送货单 / 原订单</dt><dd class="mono">${r.deliveryNo} / ${r.subOrderNo}</dd>
        <dt>抵扣结算单</dt><dd class="mono">${r.billNo||'—'}</dd>
      </dl>
      <table style="margin-top:12px"><thead><tr><th>#</th><th>项目</th><th style="text-align:right">数量</th><th style="text-align:right">单价(含税)</th><th style="text-align:right">金额</th></tr></thead><tbody>
        <tr><td>1</td><td>${r.name}（${r.spec}）<div style="font-size:11px;color:var(--ts);margin-top:2px">自营商品原定价，不加价</div></td><td style="text-align:right">${r.qty} ${r.unit}</td><td style="text-align:right">${money(rUnit(r))}</td><td style="text-align:right">${money(rAmt(r))}</td></tr>
      </tbody></table>
      <table style="margin-top:10px"><tbody>
        <tr><td style="color:var(--ts)">小计（不含税 / Subtotal）</td><td style="text-align:right">${money(rNet(r))}</td></tr>
        <tr><td style="color:var(--ts)">GST ${gst()}%</td><td style="text-align:right">${money(rGst(r))}</td></tr>
        <tr style="font-weight:700;background:var(--gl)"><td>价税合计（Total）</td><td style="text-align:right;color:var(--gd)">${money(rAmt(r))}</td></tr>
      </tbody></table>
      <dl class="dl" style="margin-top:14px">
        <dt>结算方式</dt><dd>结算抵扣（已在结算单 ${r.billNo||'—'} 中扣减，无需另行付款）</dd>
        <dt>备注</dt><dd style="color:var(--ts)">本发票就平台自营现货补货商家少送数量开具；对应客户订单商品/金额/发票均未变更。</dd>
      </dl>
    </div></div>
  </div>
  <div class="drawer-ft"><button class="btn btn-o" onclick="closeDrawer()">关闭</button><button class="btn btn-p" onclick="repl_invDownload('${iv.no}')">下载 PDF</button></div>`);
};

/* ================= 运营平台端 · 缺货罚款标准配置 ================= */
PAGES['p-replcfg']=()=>{
  const c=DB.replCfg;
  return `${flowTip('')}
  <div class="card" style="margin-bottom:14px"><div class="card-hd"><h3>缺货罚款标准</h3><span class="sub">全平台统一 · 所有商家一致</span></div><div class="card-bd">
    <div class="fg2">
      <div class="fr"><label class="fl"><b>*</b>罚款标准（S$ / 件）</label><input id="rcfg-fine" type="number" min="0" max="999" step="1" value="${c.finePerUnit}"></div>
      <div class="fr"><label class="fl">效果预览（缺 3 件）</label><input value="罚款 S$${(3*c.finePerUnit).toFixed(2)}" readonly style="background:#F3F4F6;color:var(--ts)"></div>
    </div>
    <div class="ib ib-y"><span class="i">⚠️</span>缺货罚款<b>按件计罚、与货值无关</b>——低货值 SKU 的罚金可能是货值的十几倍（如 S$2.60/件的叶菜，缺 1 件罚 S$${c.finePerUnit.toFixed(2)}）。调整影响<b>全平台所有供应商</b>，改前须与商务确认。</div>
    <div class="row" style="justify-content:flex-end;margin-top:10px"><button class="btn btn-p" onclick="repl_saveFine()">保存罚款标准</button></div>
  </div></div>
  <div class="card"><div class="card-bd" style="font-size:12.5px;color:var(--ts)">缺货同时产生两张单：<b>平台补采单</b>（按自营商品原定价计价，<b>不加价</b>）与<b>缺货罚款单</b>（缺口件数 × 本罚款标准）。本期<b>不支持</b>按商家 / 品类 / SKU / 货值分档配置；已生成的罚款单按其快照标准结算，不受此处调整影响。</div></div>`;
};
window.repl_saveFine=function(){
  const v=+((document.getElementById('rcfg-fine')||{}).value);
  if(!(v>=0&&v<=999)||!Number.isInteger(v)){toast('罚款标准需为 0–999 之间的整数','err');return;}
  DB.replCfg.finePerUnit=v;render();toast(`全平台缺货罚款标准已保存为 S$${v}/件（仅对之后生成的罚款单生效）`,'ok');
};


/* ================= 商家端 · 罚款单 ================= */
// 罚款单由缺货补采同时生成（1 张补采单 ↔ 1 张罚款单），独立进清结算；本期仅「缺货」一种罚款事由
// 罚款单 = 【一张送货单一张】，金额 = 该单各 SKU 缺口件数合计 × 罚款标准；与补采单【无任何关联】
function fineGroups(){
  return (DB.fineOrders||[]).map(g=>{
    const qty=g.items.reduce((a,x)=>a+x.qty,0);
    return Object.assign({},g,{qty, amt:+(qty*g.rate).toFixed(2)});
  }).sort((a,b)=>b.at.localeCompare(a.at));
}
function fnTag(st){return st=='pending'?'<span class="tag t-y"><span class="dot"></span>待结算</span>'
  :'<span class="tag t-b"><span class="dot"></span>已结算</span>';}
PAGES['m-fine']=()=>{
  const gs=fineGroups();
  if(!gs.length) return `<div class="empty"><div class="e-ic">⚖️</div><div class="e-t">暂无罚款单</div><div class="e-s">足额送货到仓即不会产生罚款单。到仓清点少货时，按缺口件数计罚并在此生成单据。</div></div>`;
  const pendCnt=gs.filter(g=>g.status!='deducted').length;
  return `<div class="ib ib-r" style="margin-bottom:12px"><span class="i">⚖️</span><div>
    <b>罚款单</b>＝你送货到仓被清点出<b>少货</b>时，按 <b>缺口件数 × ${money(replFineRate())}/件</b> 计罚。<b>一张送货单一张罚款单</b>，同单多个 SKU 缺货合并计罚、点详情看逐个商品。罚款<b>按件计、与货值无关</b>，<b>不开发票</b>，作为独立扣减项进当期结算单。
    <br><b>罚款与平台补采互不关联</b>——只要清点出缺口就计罚；缺口是否由自营现货补齐是另一回事，<b>自营无货未补采时同样计罚</b>。
    <br><span style="color:var(--ts)">对缺口数量有异议请线下联系运营核对，本期不设线上申诉入口。</span>
  </div></div>
  <div class="card"><div class="card-hd"><h3>罚款单</h3><span class="sub">待结算 ${pendCnt} 单 · 共 ${gs.length} 单 / ${DB.replOrders.length} 项 · 按送货单合并</span></div>
  <div class="card-bd flush"><div style="overflow-x:auto"><table>
    <thead><tr><th>罚款单号</th><th>事由</th><th>来源送货单</th><th>缺货商品</th><th style="text-align:right">缺口件数</th><th style="text-align:right">罚款标准</th><th style="text-align:right">罚款金额</th><th>状态</th><th>操作</th></tr></thead><tbody>
    ${gs.map(g=>`<tr>
      <td class="mono" style="white-space:nowrap">${g.no}</td>
      <td style="white-space:nowrap"><span class="tag t-r" style="font-size:10.5px"><span class="dot"></span>到仓少货</span><div style="font-size:11px;color:var(--ts);margin-top:2px">${g.at}</div></td>
      <td class="mono" style="font-size:12px;white-space:nowrap">${g.deliveryNo}<div style="color:var(--ts);margin-top:2px">${g.warehouse}</div></td>
      <td style="white-space:nowrap">${g.items.map(x=>`<b>${x.name}</b>`).join('、')}<div style="font-size:11px;color:var(--ts);margin-top:2px">共 ${g.items.length} 个 SKU</div></td>
      <td style="text-align:right"><b>${g.qty}</b></td>
      <td style="text-align:right">${money(g.rate)} / 件</td>
      <td style="text-align:right;color:var(--r);font-weight:700;font-size:15px">-${money(g.amt)}</td>
      <td style="white-space:nowrap">${fnTag(g.status)}${g.billNo?`<div style="font-size:11px;color:var(--ts);margin-top:2px">${g.billNo}</div>`:''}</td>
      <td style="white-space:nowrap"><button class="btn btn-o btn-sm" onclick="fine_detail('${g.no}')">详情</button> <button class="btn btn-o btn-sm" onclick="DB.delivTab='sign';DB.delivView='${g.deliveryNo}';nav('m-delivery')">送货单</button></td>
    </tr>`).join('')}
    </tbody></table></div>
    <div class="card-bd" style="border-top:1px solid var(--bd2);font-size:12.5px;color:var(--ts)">本期罚款事由仅「<b>到仓少货</b>」一种；罚款标准由平台统一配置，生成单据时快照，后续调整不追溯。罚款<b>不开发票</b>，作为结算扣减项在结算单中体现。</div>
  </div>`;
};
// 罚款单详情（右侧抽屉）：同送货单多个 SKU 缺货逐项区分
window.fine_detail=function(no){
  const g=fineGroups().find(x=>x.no==no); if(!g)return;
  const kv=(k,v)=>`<div style="min-width:0"><div style="font-size:12px;color:var(--ts);margin-bottom:4px">${k}</div><div style="font-size:13.5px;color:var(--tp);font-weight:500;word-break:break-word">${v||'—'}</div></div>`;
  const sec=t=>`<div style="display:flex;align-items:center;gap:10px;margin:2px 0 14px"><span style="width:4px;height:16px;background:var(--g);border-radius:2px"></span><h3 style="font-size:14.5px;font-weight:700">${t}</h3></div>`;
  drawer(`<div class="drawer-hd"><div><h3>${g.no} · 罚款单</h3><div style="font-size:12.5px;color:var(--ts);margin-top:2px">${g.warehouse} · 共 ${g.items.length} 个 SKU 缺货 · 合计 ${g.qty} 件</div></div><span class="x" onclick="closeDrawer()">×</span></div>
  <div class="drawer-bd">
    <div class="row" style="gap:8px;margin-bottom:14px">${fnTag(g.status)}<span class="tag t-r"><span class="dot"></span>到仓少货</span></div>
    <div class="ib ib-r" style="margin-bottom:16px"><span class="i">⚖️</span>本单送货到仓被清点出 <b>${g.items.length} 个 SKU 少货、合计 ${g.qty} 件</b>，按 <b>${money(g.rate)}/件</b> 计罚，罚款 <b>${money(g.amt)}</b>。罚款<b>按件计、与货值无关</b>，<b>不开发票</b>，作为独立扣减项进当期结算单。${g.noRepl?'<br><b>本单缺口未由自营补采</b>（自营无货），但缺货照常计罚——罚款与补采互不关联。':''}</div>

    ${sec('单据信息')}
    <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:14px 24px;margin-bottom:20px">
      ${kv('罚款单号',`<span class="mono">${g.no}</span>`)}
      ${kv('罚款事由','到仓少货')}
      ${kv('来源送货单',`<span class="mono">${g.deliveryNo}</span> <button class="btn btn-link btn-sm" style="padding:0 0 0 4px" onclick="closeDrawer();DB.delivTab='sign';DB.delivView='${g.deliveryNo}';nav('m-delivery')">查看</button>`)}
      ${kv('入库仓库',g.warehouse)}
      ${kv('收货清点时间',g.at)}
      ${kv('抵扣所属结算单',g.billNo?`<span class="mono">${g.billNo}</span> <button class="btn btn-link btn-sm" style="padding:0 0 0 4px" onclick="closeDrawer();nav('m-settle')">查看</button>`:'待本期结算单生成时抵扣')}
    </div>

    ${sec('缺货明细 · 逐 SKU')}
    <div style="overflow-x:auto;margin-bottom:14px"><table>
      <thead><tr><th>商品</th><th style="text-align:right">应送</th><th style="text-align:right">实收</th><th style="text-align:right">缺口</th><th style="text-align:right">罚款标准</th><th style="text-align:right">罚款金额</th></tr></thead><tbody>
      ${g.items.map(x=>`<tr>
        <td style="white-space:nowrap"><b>${x.name}</b><div style="font-size:11px;color:var(--ts);margin-top:2px">${x.sku} · ${x.spec}</div></td>
        <td style="text-align:right">${x.should}</td>
        <td style="text-align:right;color:var(--r);font-weight:600">${x.received}</td>
        <td style="text-align:right;color:var(--r);font-weight:600">${x.qty} ${x.unit}</td>
        <td style="text-align:right">${money(g.rate)}</td>
        <td style="text-align:right;color:var(--r);font-weight:700">-${money(+(x.qty*g.rate).toFixed(2))}</td>
      </tr>`).join('')}
      <tr style="font-weight:700;background:var(--gl)"><td>合计</td><td style="text-align:right">—</td><td style="text-align:right">—</td><td style="text-align:right;color:var(--r)">${g.qty}</td><td style="text-align:right">—</td><td style="text-align:right;color:var(--r);font-size:15px">-${money(g.amt)}</td></tr>
      </tbody></table></div>
    <div class="ib ib-b"><span class="i">ℹ️</span>罚款标准在<b>生成单据时快照</b>，后续平台调整不追溯本单。对缺口数量有异议请<b>线下联系运营</b>核对，本期不设线上申诉入口。</div>
  </div>
  <div class="drawer-ft"><button class="btn btn-o" onclick="closeDrawer()">关闭</button><button class="btn btn-p" onclick="closeDrawer();DB.delivTab='sign';DB.delivView='${g.deliveryNo}';nav('m-delivery')">查看送货单</button></div>`);
};
// 结算联动：把罚款并入当期结算单扣减项
window.fineSettleSync=function(){
  const pend=fineGroups().filter(g=>g.status=='pending');
  const amt=+(pend.reduce((a,g)=>a+g.amt,0)).toFixed(2);
  DB.bill.fine=amt; DB.bill.fineCnt=pend.length;
  DB.bill.items=DB.bill.items.filter(it=>it[0]!='缺货罚款');
  if(amt>0)DB.bill.items.push(['缺货罚款',pend.length,-amt]);
  DB.bill.net=+(DB.bill.gross-DB.bill.reverse-(DB.bill.feeSvc||0)-(DB.bill.feeLogi||0)-(DB.bill.supply||0)-(DB.bill.repl||0)-amt).toFixed(2);
};
fineSettleSync();
})();
