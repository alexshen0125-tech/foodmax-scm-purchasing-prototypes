/* PC · 自营代补货（商家端）+ 代补货加价率配置（运营平台端）
   适用范围：仅【出库前·仓内收货清点】场景；差异只有一种——实收数量 < 应送数量（数量少了），无原因分类。
   业务链：商家送货到仓 → 仓库收货清点发现少货 → 自营现货可【全额覆盖】缺口 → 系统生成代补货单
           → 平台按【商家含税售价 ×(1+加价率)】向商家销售该缺口数量 → 计入当期结算单扣减项
           → 平台就该笔向商家开【代补货销售发票】(TAX INVOICE, GST 9%)。
   口径（2026-08-07 缺货补货方案对焦会 + 沈亮 2026-08-10 确认）：
   - 客户订单完全无感：商品/金额/发票不变；商家 GMV 与平台佣金按【应送数量】足额计，不因少货下调。
   - 代补单价(含税) = 商家含税售价 ×(1+加价率)；加价率【全平台统一】单值，默认 30%、平台可配，
     不分商家/品类/site；生成单据时【快照】落库，改配置不追溯已生成单据。
   - 商家含税售价取【原订单下单时】的 SKU 价格快照，不取当前挂牌价。
   - 等效罚则 = 缺口数量 × 含税售价 × 加价率（因缺口部分的货款商家照收，只多付加价部分）。
   - 自营现货不足以【全额覆盖】缺口 → 不生成代补货单，按实收数量出库并标缺货。
   - 支付方式固定 = 结算抵扣，商家无支付动作；结算单新增扣减行「自营代补货扣款」，取含税金额。
   - 应清算 = 汇总总额 − 逆向扣减 − 服务佣金 − 物流佣金 − 耗材采购扣款 − 自营代补货扣款。
   - 异议走线下：不设线上申诉入口（对齐对账结算 BR-05）。判责结论不对商家展示，只展示应送/实收数量与差异。
   依赖主文件全局：DB / money / toast / drawer / closeDrawer / nav / render / flowTip / GST_DEFAULT。 */
(function(){

/* ================= 平台可配：代补货加价率（全平台统一单值） ================= */
DB.replCfg = DB.replCfg || { rate: 30 };   // 加价率 %，全平台统一，不分商家/品类/site
window.replRateOf = function(){ return DB.replCfg.rate; };

/* ================= 演示数据（挂 DB，跨 render 持久） ================= */
DB.replOrders = DB.replOrders || [
  {no:'RPL-20260628-003', deliveryNo:'SH20260628004', subOrderNo:'#SG20260628011', warehouse:'盛港DC',
   receiptTime:'2026-06-28 01:06', sku:'SKU8801', name:'小棠菜', spec:'1kg/件', unit:'件',
   should:20, received:18, qty:2, price:2.60, rate:30,
   status:'pending', billNo:'', invNo:''},
  {no:'RPL-20260629-004', deliveryNo:'SH20260629005', subOrderNo:'#SG20260629004', warehouse:'兀兰DC',
   receiptTime:'2026-06-29 03:24', sku:'SKU8804', name:'空心菜', spec:'1kg/件', unit:'件',
   should:30, received:22, qty:8, price:3.20, rate:30,
   status:'pending', billNo:'', invNo:''},
  {no:'RPL-20260630-005', deliveryNo:'SH20260630007', subOrderNo:'#SG20260630012', warehouse:'大巴窑DC',
   receiptTime:'2026-06-30 04:11', sku:'SKU8802', name:'白菜', spec:'1kg/件', unit:'件',
   should:40, received:37, qty:3, price:2.10, rate:30,
   status:'deducted', billNo:'ST202606-M0815', invNo:''},
  {no:'RPL-20260522-002', deliveryNo:'SH20260522001', subOrderNo:'#SG20260522006', warehouse:'盛港DC',
   receiptTime:'2026-05-22 13:42', sku:'SKU8803', name:'菠菜', spec:'1kg/件', unit:'件',
   should:12, received:10, qty:2, price:3.80, rate:30,
   status:'invoiced', billNo:'ST202605-M0815', invNo:'RPL-INV-2026-302'},
  {no:'RPL-20260518-001', deliveryNo:'SH20260518001', subOrderNo:'#SG20260518009', warehouse:'裕廊DC',
   receiptTime:'2026-05-18 02:18', sku:'SKU8811', name:'鲜鸡蛋', spec:'30枚/盘', unit:'盘',
   should:60, received:48, qty:12, price:8.40, rate:30,
   status:'invoiced', billNo:'ST202605-M0815', invNo:'RPL-INV-2026-301'},
];
DB.replInvoices = DB.replInvoices || [
  {no:'RPL-INV-2026-302', repl:'RPL-20260522-002', date:'2026-06-06', status:'已开票'},
  {no:'RPL-INV-2026-301', repl:'RPL-20260518-001', date:'2026-06-06', status:'已开票'},
];
DB.replTab = DB.replTab || 'all';

/* ================= 口径计算 ================= */
const gst  = ()=> (typeof GST_DEFAULT=='number'?GST_DEFAULT:9);
const rGap  = r => Math.max(0, r.should - r.received);                    // 缺口数量
const rUnit = r => +(r.price*(1+r.rate/100)).toFixed(2);                  // 代补单价（含税）
const rAmt  = r => +(rUnit(r)*r.qty).toFixed(2);                          // 金额（含税）
const rNet  = r => +(rAmt(r)/(1+gst()/100)).toFixed(2);                   // 不含税
const rGst  = r => +(rAmt(r)-rNet(r)).toFixed(2);                         // GST
const rLoss = r => +(r.qty*r.price*r.rate/100).toFixed(2);                // 等效罚则（净损失）
const rOf   = no => DB.replOrders.find(x=>x.no==no);
window.replOf = rOf; window.replAmt = rAmt; window.replUnit = rUnit; window.replNet = rNet; window.replGst = rGst;
// 送货单 → 代补货单（送货单详情联动用）
window.replByDelivery = function(id){return DB.replOrders.filter(r=>r.deliveryNo==id);};

const R_ST = {pending:['待结算','t-y'], deducted:['已抵扣','t-b'], invoiced:['已开票','t-g'], voided:['已作废','t-gr'], reversed:['已冲正','t-gr']};
const R_TABS = [['all','全部'],['pending','待结算'],['deducted','已抵扣'],['invoiced','已开票'],['voided','已作废/冲正']];
function rTag(s){const[t,c]=R_ST[s]||['—','t-gr'];return `<span class="tag ${c}"><span class="dot"></span>${t}</span>`;}

/* 结算联动：待结算的代补货单按含税金额汇总为当期结算单扣减项 */
window.replSettleSync=function(){
  const pend=DB.replOrders.filter(r=>r.status=='pending');
  const amt=+(pend.reduce((a,r)=>a+rAmt(r),0)).toFixed(2);
  DB.bill.repl=amt; DB.bill.replCnt=pend.length;
  DB.bill.items=DB.bill.items.filter(it=>it[0]!='自营代补货扣款（含税）');
  if(amt>0)DB.bill.items.push(['自营代补货扣款（含税）',pend.length,-amt]);
  DB.bill.net=+(DB.bill.gross-DB.bill.reverse-(DB.bill.feeSvc||0)-(DB.bill.feeLogi||0)-(DB.bill.supply||0)-amt).toFixed(2);
};
replSettleSync();

/* ================= 商家端 · 自营代补货 ================= */
PAGES['m-replenish']=()=>{
  const t=DB.replTab;
  const all=DB.replOrders;
  const rows=all.filter(r=>t=='all'||(t=='voided'?(r.status=='voided'||r.status=='reversed'):r.status==t));
  const pend=all.filter(r=>r.status=='pending');
  const rate=replRateOf();
  const sumAmt=+(pend.reduce((a,r)=>a+rAmt(r),0)).toFixed(2);
  const sumQty=pend.reduce((a,r)=>a+r.qty,0);
  const sumLoss=+(pend.reduce((a,r)=>a+rLoss(r),0)).toFixed(2);

  const tabs=`<div class="tabs">${R_TABS.map(x=>{
    const n=x[0]=='all'?all.length:all.filter(r=>x[0]=='voided'?(r.status=='voided'||r.status=='reversed'):r.status==x[0]).length;
    return `<div class="tab ${t==x[0]?'active':''}" onclick="DB.replTab='${x[0]}';render()">${x[1]}${n?`<span class="tb">${n}</span>`:''}</div>`;
  }).join('')}</div>`;

  const sumGoods=+(sumAmt-sumLoss).toFixed(2);
  const stats=`<div class="sg" style="grid-template-columns:repeat(4,1fr)">
    <div class="sc ${sumLoss>0?'alert':''}"><div class="sc-l">本期你实际多付</div><div class="sc-v">${money(sumLoss)}</div><div class="sc-s">= 缺口数量 × 售价 × ${rate}%，这才是你的损失</div></div>
    <div class="sc ${sumAmt>0?'warn':''}"><div class="sc-l">本期结算抵扣（含税）</div><div class="sc-v">${money(sumAmt)}</div><div class="sc-s">含缺口货款 ${money(sumGoods)}，该货款<b>仍计入你的收入</b></div></div>
    <div class="sc"><div class="sc-l">本期待结算代补货单</div><div class="sc-v">${pend.length}</div><div class="sc-s">共 ${sumQty} ${pend[0]?pend[0].unit:'件'}缺口由自营现货代补</div></div>
    <div class="sc"><div class="sc-l">当前加价率</div><div class="sc-v">${rate}%</div><div class="sc-s">全平台统一 · 生成单据时快照</div></div>
  </div>`;

  const tip=flowTip(`你送货到仓后，仓库<b>收货清点</b>发现少货、且平台<b>自营现货可全额覆盖缺口</b>时，由自营现货替你补齐——<b>客户订单完全不受影响</b>（商品、金额、发票均不变，你的 GMV 与佣金仍按<b>应送数量</b>足额计）。这部分缺口视同<b>你向平台采购</b>：单价 = 你的<b>含税售价 ×(1+加价率 ${rate}%)</b>，货款在<b>当期结算单中直接抵扣</b>，平台就该笔向你开具<b>代补货销售发票</b>。对实收数量有异议请<b>线下联系运营核对</b>。`);

  if(!rows.length) return tip+stats+tabs+`<div class="empty"><div class="e-ic">🔁</div><div class="e-t">${t=='all'?'暂无自营代补货单':'该状态下暂无代补货单'}</div><div class="e-s">${t=='all'?'足额送货到仓即不会产生代补货单。仓库收货清点少货且自营有货代补时，此处生成单据。':'切换上方状态查看其它代补货单。'}</div></div>`;

  return tip+stats+tabs+`
  <div class="card"><div class="card-hd"><h3>代补货单</h3><span class="sub">共 ${rows.length} 单 · 单价 = 含税售价 ×(1+加价率)</span></div>
  <div class="card-bd flush"><div style="overflow-x:auto"><table>
    <thead><tr><th>代补货单号</th><th>关联送货单 / 原订单</th><th>商品</th><th style="text-align:right">应送 / 实收</th><th style="text-align:right">缺口·代补</th><th style="text-align:right">含税售价</th><th style="text-align:right">加价率</th><th style="text-align:right">代补单价</th><th style="text-align:right">结算抵扣（含税）</th><th style="text-align:right">其中你多付</th><th>状态</th><th>操作</th></tr></thead><tbody>
    ${rows.map(r=>`<tr>
      <td class="mono">${r.no}</td>
      <td class="mono" style="font-size:12px">${r.deliveryNo}<div style="color:var(--ts);margin-top:2px">${r.subOrderNo}</div></td>
      <td><b>${r.name}</b><div style="font-size:11px;color:var(--ts);margin-top:2px">${r.sku} · ${r.spec}</div></td>
      <td style="text-align:right">${r.should} <span style="color:var(--ts)">/</span> <b style="color:var(--r)">${r.received}</b></td>
      <td style="text-align:right"><b>${r.qty}</b> ${r.unit}</td>
      <td style="text-align:right">${money(r.price)}</td>
      <td style="text-align:right;color:var(--gold);font-weight:600">+${r.rate}%</td>
      <td style="text-align:right">${money(rUnit(r))}</td>
      <td style="text-align:right;color:var(--ts)">-${money(rAmt(r))}</td>
      <td style="text-align:right;color:var(--r);font-weight:700;font-size:15px">${money(rLoss(r))}</td>
      <td>${rTag(r.status)}${r.billNo?`<div style="font-size:11px;color:var(--ts);margin-top:2px">${r.billNo}</div>`:''}</td>
      <td style="white-space:nowrap"><button class="btn btn-o btn-sm" onclick="repl_detail('${r.no}')">详情</button></td>
    </tr>`).join('')}
    </tbody></table></div></div>
  <div class="card-bd" style="border-top:1px solid var(--bd2);font-size:12.5px;color:var(--ts)">口径：<b>「其中你多付」才是你的实际损失</b>——缺口货款照常计入你的收入，只是多付了加价部分。客户订单按<b>应送数量</b>足额计入 GMV 与平台佣金，缺口部分不冲减；代补货款按<b>含税金额</b>在当期结算单中扣减。自营现货<b>不足以全额覆盖</b>缺口时不生成代补货单，按实收数量出库并标缺货。</div>
  </div>`;
};

/* ---------- 详情（右侧抽屉 · 三段式）---------- */
window.repl_detail=function(no){
  const r=rOf(no); if(!r) return;
  const inv=(DB.replInvoices||[]).find(x=>x.repl==no);
  const kv=(k,v)=>`<div style="min-width:0"><div style="font-size:12px;color:var(--ts);margin-bottom:4px">${k}</div><div style="font-size:13.5px;color:var(--tp);font-weight:500;word-break:break-word">${v||'—'}</div></div>`;
  const sec=t=>`<div style="display:flex;align-items:center;gap:10px;margin:2px 0 14px"><span style="width:4px;height:16px;background:var(--g);border-radius:2px"></span><h3 style="font-size:14.5px;font-weight:700">${t}</h3></div>`;
  drawer(`<div class="drawer-hd"><div><h3>${r.no} · 代补货单</h3><div style="font-size:12.5px;color:var(--ts);margin-top:2px">${r.warehouse} · 收货清点 ${r.receiptTime}</div></div><span class="x" onclick="closeDrawer()">×</span></div>
  <div class="drawer-bd">
    <div class="row" style="gap:8px;margin-bottom:14px">${rTag(r.status)}<span class="tag t-r"><span class="dot"></span>少货 ${rGap(r)} ${r.unit}</span></div>
    <div class="ib ib-y" style="margin-bottom:16px"><span class="i">🔁</span>本单少货 <b>${rGap(r)} ${r.unit}</b>，已由平台<b>自营现货全额代补</b>，客户订单未受影响（商品/金额/发票不变）。缺口部分视同你向平台采购，货款在结算单中抵扣。</div>

    ${sec('单据信息')}
    <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:14px 24px;margin-bottom:20px">
      ${kv('代补货单号',`<span class="mono">${r.no}</span>`)}
      ${kv('关联送货单',`<span class="mono">${r.deliveryNo}</span> <button class="btn btn-link btn-sm" style="padding:0 0 0 4px" onclick="closeDrawer();DB.delivTab='sign';DB.delivView='${r.deliveryNo}';nav('m-delivery')">查看</button>`)}
      ${kv('关联原订单（供应商子单）',`<span class="mono">${r.subOrderNo}</span>`)}
      ${kv('入库仓库',r.warehouse)}
      ${kv('收货清点时间',`${r.receiptTime}（出库前·仓内清点）`)}
      ${kv('差异',`实收 ${r.received} − 应送 ${r.should} = <b style="color:var(--r)">-${rGap(r)}</b> ${r.unit}（数量少送）`)}
    </div>

    ${sec('商品明细')}
    <div style="overflow-x:auto;margin-bottom:10px"><table>
      <thead><tr><th>商品</th><th style="text-align:right">应送</th><th style="text-align:right">实收</th><th style="text-align:right">缺口</th><th style="text-align:right">代补数量</th></tr></thead><tbody>
      <tr><td><b>${r.name}</b><div style="font-size:11px;color:var(--ts);margin-top:2px">${r.sku} · ${r.spec}</div></td>
        <td style="text-align:right">${r.should}</td>
        <td style="text-align:right;color:var(--r);font-weight:600">${r.received}</td>
        <td style="text-align:right;color:var(--r);font-weight:600">${rGap(r)}</td>
        <td style="text-align:right"><b>${r.qty}</b> ${r.unit}</td></tr>
    </tbody></table></div>
    <div style="overflow-x:auto;margin-bottom:20px"><table>
      <tbody>
        <tr><td style="color:var(--ts)">含税售价（下单时快照）</td><td style="text-align:right">${money(r.price)} / ${r.unit}</td></tr>
        <tr><td style="color:var(--ts)">加价率（生成时快照）</td><td style="text-align:right;color:var(--gold);font-weight:600">+${r.rate}%</td></tr>
        <tr><td style="color:var(--ts)">代补单价（含税） = ${money(r.price)} × (1+${r.rate}%)</td><td style="text-align:right;font-weight:600">${money(rUnit(r))}</td></tr>
        <tr><td style="color:var(--ts)">不含税金额</td><td style="text-align:right">${money(rNet(r))}</td></tr>
        <tr><td style="color:var(--ts)">GST ${gst()}%</td><td style="text-align:right">${money(rGst(r))}</td></tr>
        <tr style="font-weight:700;background:var(--gl)"><td>代补货款（含税 · 结算抵扣）</td><td style="text-align:right;color:var(--r)">-${money(rAmt(r))}</td></tr>
      </tbody>
    </table></div>

    ${sec('对你的影响')}
    <div style="overflow-x:auto;margin-bottom:14px"><table>
      <thead><tr><th>项目</th><th style="text-align:right">金额</th><th>说明</th></tr></thead><tbody>
        <tr><td>该商品计入 GMV</td><td style="text-align:right">${money(+(r.should*r.price).toFixed(2))}</td><td style="font-size:12px;color:var(--ts)">按<b>应送 ${r.should}</b> 足额计，不因少货下调</td></tr>
        <tr><td>代补货扣款</td><td style="text-align:right;color:var(--r)">-${money(rAmt(r))}</td><td style="font-size:12px;color:var(--ts)">缺口 ${r.qty} × ${money(rUnit(r))}</td></tr>
        <tr style="font-weight:700;background:var(--gl)"><td>实际多付（加价成本）</td><td style="text-align:right;color:var(--r)">${money(rLoss(r))}</td><td style="font-size:12px;color:var(--ts)">= ${r.qty} × ${money(r.price)} × ${r.rate}%</td></tr>
      </tbody>
    </table></div>

    ${sec('结算与发票')}
    <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:14px 24px">
      ${kv('抵扣所属结算单',r.billNo?`<span class="mono">${r.billNo}</span> <button class="btn btn-link btn-sm" style="padding:0 0 0 4px" onclick="closeDrawer();nav('m-settle')">查看</button>`:'待本期结算单生成时抵扣')}
      ${kv('代补货发票',inv?`<span class="mono">${inv.no}</span> <button class="btn btn-link btn-sm" style="padding:0 0 0 4px" onclick="closeDrawer();DB.invTab='repl';nav('m-invoice')">查看</button>`:'结算完成后由平台自动开具')}
    </div>
    <div class="ib ib-b" style="margin-top:16px"><span class="i">ℹ️</span>对<b>实收数量</b>有异议，请在<b>收货清点后 7 个自然日内</b>联系你的运营对接人（微信群「Food Max 供应商-绿鲜源」/ +65 6123 4567），并提供<b>装车照片或司机交接单</b>；平台将调取仓库收货监控核对，核实有误的由运营发起<b>冲正</b>，在下期结算回补并开红冲发票。逾期以清点数量为准。本期不设线上申诉入口。</div>
  </div>
  <div class="drawer-ft"><button class="btn btn-o" onclick="closeDrawer()">关闭</button>${inv?`<button class="btn btn-p" onclick="repl_invDownload('${inv.no}')">下载发票 PDF</button>`:''}</div>`);
};

/* ================= 发票管理 Tab ④ · 代补货发票（平台开具） ================= */
window.replInvoiceContent=function(){
  const rows=(DB.replInvoices||[]).map(iv=>({iv,r:rOf(iv.repl)})).filter(x=>x.r);
  return `${flowTip(`<b>代补货发票</b>由平台在与你<b>结算完成后自动开具</b>并推送给你——平台就<b>自营现货代补的缺口数量</b>向你开具销售发票（TAX INVOICE, GST ${gst()}%），<b>无需你申请</b>。此处仅供<b>查看与下载</b>。`)}
  <div class="card"><div class="card-hd"><h3>代补货发票记录</h3><span class="sub">平台开具 · 共 ${rows.length} 张</span></div><div class="card-bd ${rows.length?'flush':''}">
    ${rows.length?`<table><thead><tr><th>发票号</th><th>关联代补货单</th><th>商品 / 数量</th><th style="text-align:right">不含税</th><th style="text-align:right">GST ${gst()}%</th><th style="text-align:right">价税合计</th><th>开票日期</th><th>状态</th><th>操作</th></tr></thead><tbody>
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
    :`<div class="empty" style="padding:20px"><div class="e-ic">🧾</div><div class="e-t">暂无代补货发票</div><div class="e-s">产生自营代补货且结算完成后，平台会开具代补货销售发票并显示在此。</div></div>`}
  </div></div>`;
};
window.repl_invDownload=function(no){toast('发票 '+no+' 已下载 (PDF)','ok');};
window.repl_invPreview=function(no){
  const iv=(DB.replInvoices||[]).find(x=>x.no==no); if(!iv) return;
  const r=rOf(iv.repl); if(!r) return;
  drawer(`<div class="drawer-hd"><div><h3>代补货发票预览</h3><div style="font-size:12.5px;color:var(--ts);margin-top:2px">${iv.no} · 平台已开具</div></div><span class="x" onclick="closeDrawer()">×</span></div>
  <div class="drawer-bd">
    <div class="ib ib-b" style="margin-bottom:12px"><span class="i">ℹ️</span>本发票由<b>平台</b>就代补货单 <span class="mono">${r.no}</span>（自营现货代补你少送的 ${r.qty} ${r.unit}）向<b>你（商家）</b>开具，开票方＝平台、收票方＝商家。</div>
    <div class="card" style="box-shadow:none;border:1px solid var(--bd)"><div class="card-bd">
      <div style="text-align:center;font-size:18px;font-weight:700;margin-bottom:2px">代补货销售发票 · TAX INVOICE</div>
      <div style="text-align:center;font-size:12px;color:var(--ts);margin-bottom:16px">Food Max 平台就自营代补货商品向商家开具（GST ${gst()}%）</div>
      <dl class="dl">
        <dt>发票号</dt><dd class="mono">${iv.no}</dd>
        <dt>开票日期</dt><dd>${iv.date}</dd>
        <dt>开票方（平台）</dt><dd>10X AI Technology Pte Ltd · GST Reg 202412345K</dd>
        <dt>收票方（商家）</dt><dd>绿鲜源蔬果 Green Fresh Produce Pte Ltd</dd>
        <dt>关联代补货单</dt><dd class="mono">${r.no}</dd>
        <dt>关联送货单 / 原订单</dt><dd class="mono">${r.deliveryNo} / ${r.subOrderNo}</dd>
        <dt>抵扣结算单</dt><dd class="mono">${r.billNo||'—'}</dd>
      </dl>
      <table style="margin-top:12px"><thead><tr><th>#</th><th>项目</th><th style="text-align:right">数量</th><th style="text-align:right">单价(含税)</th><th style="text-align:right">金额</th></tr></thead><tbody>
        <tr><td>1</td><td>${r.name}（${r.spec}）<div style="font-size:11px;color:var(--ts);margin-top:2px">含税售价 ${money(r.price)} ×(1+${r.rate}%)</div></td><td style="text-align:right">${r.qty} ${r.unit}</td><td style="text-align:right">${money(rUnit(r))}</td><td style="text-align:right">${money(rAmt(r))}</td></tr>
      </tbody></table>
      <table style="margin-top:10px"><tbody>
        <tr><td style="color:var(--ts)">小计（不含税 / Subtotal）</td><td style="text-align:right">${money(rNet(r))}</td></tr>
        <tr><td style="color:var(--ts)">GST ${gst()}%</td><td style="text-align:right">${money(rGst(r))}</td></tr>
        <tr style="font-weight:700;background:var(--gl)"><td>价税合计（Total）</td><td style="text-align:right;color:var(--gd)">${money(rAmt(r))}</td></tr>
      </tbody></table>
      <dl class="dl" style="margin-top:14px">
        <dt>结算方式</dt><dd>结算抵扣（已在结算单 ${r.billNo||'—'} 中扣减，无需另行付款）</dd>
        <dt>备注</dt><dd style="color:var(--ts)">本发票就平台自营现货代补商家少送数量开具；对应客户订单商品/金额/发票均未变更。</dd>
      </dl>
    </div></div>
  </div>
  <div class="drawer-ft"><button class="btn btn-o" onclick="closeDrawer()">关闭</button><button class="btn btn-p" onclick="repl_invDownload('${iv.no}')">下载 PDF</button></div>`);
};

/* ================= 运营平台端 · 代补货加价率配置 ================= */
PAGES['p-replcfg']=()=>{
  const c=DB.replCfg;
  return `${flowTip(`配置<b>自营代补货加价率</b>：商家送货到仓少货、由自营现货代补时，平台按 <b>商家含税售价 ×(1+加价率)</b> 向商家销售缺口数量。加价率<b>全平台统一</b>（不分商家 / 品类 / site），并在<b>生成代补货单时快照</b>落库，后续调整不追溯已生成单据。`)}
  <div class="card" style="margin-bottom:14px"><div class="card-hd"><h3>代补货加价率</h3><span class="sub">全平台统一 · 所有商家一致</span></div><div class="card-bd">
    <div class="fg2">
      <div class="fr"><label class="fl"><b>*</b>加价率（%）</label><input id="rcfg-rate" type="number" min="0" max="200" step="1" value="${c.rate}"></div>
      <div class="fr"><label class="fl">效果预览（含税售价 S$10.00）</label><input value="代补单价 S$${(10*(1+c.rate/100)).toFixed(2)} · 每件多付 S$${(10*c.rate/100).toFixed(2)}" readonly style="background:#F3F4F6;color:var(--ts)"></div>
    </div>
    <div class="ib ib-y"><span class="i">⚠️</span>加价率即<b>等效罚则强度</b>：缺口部分的货款商家照收，因此商家净损失 = 缺口数量 × 含税售价 × 加价率。调高会直接加重<b>全平台所有供应商</b>的履约成本，请与商务确认后再改。</div>
    <div class="row" style="justify-content:flex-end;margin-top:10px"><button class="btn btn-p" onclick="repl_saveRate()">保存加价率</button></div>
  </div></div>
  <div class="card"><div class="card-bd" style="font-size:12.5px;color:var(--ts)">本期<b>不支持</b>按商家 / 按品类 / 按 SKU 差异化配置——加价率对全平台商家一视同仁。已生成的代补货单按其快照的加价率结算，不受此处调整影响。</div></div>`;
};
window.repl_saveRate=function(){
  const v=+((document.getElementById('rcfg-rate')||{}).value);
  if(!(v>=0&&v<=200)){toast('加价率需在 0–200% 之间','err');return;}
  DB.replCfg.rate=v;render();toast(`全平台加价率已保存为 ${v}%（仅对之后生成的代补货单生效）`,'ok');
};

})();
