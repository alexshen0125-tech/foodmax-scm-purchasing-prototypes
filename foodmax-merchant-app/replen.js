/* Food Max 商家端 v2 · 平台补采 + 罚款单（与 PC pc-modules/replenish.js 同源同口径）
   ▍补采单有【两种来源】，共用同一单据模型（source 字段区分）：
   ① source='receipt'  到仓少货：出库前·仓内收货清点，实收 < 应送。自营全额覆盖才补，【照计缺货罚款】。
   ② source='aftersale' 售后补货：客户签收后发现缺货、判【商家责】、客户要货不要退款，自营现货补发给客户，
      挂在售后工单上。【允许部分补发】，不足部分转退款（按客户成交价走逆向扣减）；【不计缺货罚款】；
      补发立即执行不等申诉窗口，补货类不开放线上申诉；归期按【补发出库时间】。
   适用范围（场景①）：仅【出库前·仓内收货清点】场景；差异只有一种——实收 < 应送（数量少了），无原因分类。
   口径（2026-08-13 流程变更）：
   - 补采单价(含税) = 【自营商品原定价】，**不加价**（原 30% 加价方案作废）。
   - 缺货罚款 = 缺口件数 × 罚款标准（默认 S$40/件），全平台统一、平台可配、生成时快照；
     按件计罚、与货值无关；罚款【不开发票】，仅作结算扣减项。
   - 【罚款与补采互不关联】：只要清点出缺口就计罚；缺口是否由自营补齐是另一回事，
     自营无货未补采时同样计罚。两者独立数据源、独立单据、独立进结算扣减。
   - 罚款单粒度 = 一张送货单一张，同单多 SKU 缺货合并计罚。
   - 客户订单完全无感；商家 GMV 与佣金按【应送数量】足额计。
   评审修复内建：列表 skel→数据 / 空态 .empty / 可点元素≥44px。 */
(function(){
const {pushPage,popPage,toast,svg,skel}=window.FM;

const css=document.createElement('style');
css.textContent=`
.rp-intro{margin:0 16px 12px;background:var(--amber-soft);color:#B45309;font-size:12.5px;font-weight:600;padding:11px 14px;border-radius:12px;line-height:1.55;}
.rp-search{display:flex;align-items:center;gap:8px;margin:0 16px 12px;background:#fff;border-radius:14px;padding:0 14px;min-height:48px;box-shadow:var(--sh-sm);}
.rp-search input{flex:1;border:none;outline:none;font-size:14px;font-family:inherit;color:var(--ink);background:transparent;min-height:44px;}
.rp-search .clr{color:var(--sub);font-size:16px;min-width:32px;min-height:32px;display:flex;align-items:center;justify-content:center;cursor:pointer;}
.rp-tabs{display:flex;gap:8px;margin:0 16px 12px;overflow-x:auto;}.rp-tabs::-webkit-scrollbar{display:none;}
.rp-tab{flex:0 0 auto;min-height:44px;display:flex;align-items:center;padding:0 15px;border-radius:13px;font-size:13.5px;font-weight:600;background:#fff;color:#27433A;box-shadow:var(--sh-sm);cursor:pointer;}
.rp-tab.on{background:var(--mint-soft);color:var(--emerald-2);border:1px solid var(--emerald);}
.rp-list{padding:0 16px 24px;}
.rp-card{background:#fff;border-radius:18px;padding:15px;margin-bottom:12px;box-shadow:var(--sh-sm);cursor:pointer;}
.rp-card .r1{display:flex;align-items:center;gap:8px;}
.rp-card .no{font-size:13.5px;font-weight:700;color:#27433A;font-family:'Lora',serif;}
.rp-card .sub{font-size:12px;color:var(--sub);margin-top:4px;}
.rp-card .goods{display:flex;align-items:baseline;gap:8px;margin-top:11px;}
.rp-card .goods .nm{font-size:15px;font-weight:700;}
.rp-card .goods .sk{font-size:11px;color:var(--sub);font-family:monospace;}
.rp-card .qty{display:flex;margin-top:11px;background:var(--muted);border-radius:12px;padding:11px 0;}
.rp-card .qty .q{flex:1;text-align:center;}
.rp-card .qty .q+.q{border-left:1px solid var(--line);}
.rp-card .qty .q .v{font-size:16px;font-weight:700;}
.rp-card .qty .q .v.neg{color:var(--red);}
.rp-card .qty .q .l{font-size:11px;color:var(--sub);margin-top:2px;}
.rp-card .r2{display:flex;align-items:center;font-size:12.5px;color:var(--sub);margin-top:11px;padding-top:11px;border-top:1px solid var(--line);}
.rp-card .r2 .amt{margin-left:auto;font-size:15px;font-weight:700;color:var(--red);}
.rp-chip{font-size:11px;font-weight:700;padding:2px 9px;border-radius:8px;white-space:nowrap;}
.rp-c-amber{background:var(--amber-soft);color:#B45309;}
.rp-c-blue{background:#EAF1FF;color:#2563EB;}
.rp-c-green{background:var(--mint-soft);color:var(--emerald-2);}
.rp-c-red{background:var(--red-soft);color:var(--red);}
.rp-c-gray{background:var(--muted);color:var(--sub);}
/* 详情 */
.rp-card2{background:#fff;border-radius:18px;margin:12px 16px;padding:6px 16px 12px;box-shadow:var(--sh-sm);}
.rp-ct{font-size:15px;font-weight:700;padding:12px 0 6px;}
.rp-ct .desc{font-size:11.5px;color:var(--sub);font-weight:500;margin-left:6px;}
.rp-row{display:flex;align-items:baseline;gap:12px;padding:11px 0;border-top:1px solid var(--line);font-size:13.5px;}
.rp-row .k{color:var(--sub);flex-shrink:0;}
.rp-row .v{margin-left:auto;font-weight:600;text-align:right;word-break:break-all;}
.rp-row .v.neg{color:var(--red);}
.rp-row .v.amber{color:#B45309;}
.rp-row.total{background:var(--mint-soft);margin:6px -16px 0;padding:12px 16px;border-radius:0 0 12px 12px;}
.rp-row.total .k{color:#27433A;font-weight:700;}
.rp-note{background:var(--muted);border-radius:12px;padding:10px 12px;margin:8px 0 2px;font-size:12px;color:#46604F;line-height:1.6;}
.rp-note.warn{background:var(--amber-soft);color:#B45309;}
.rp-note b{font-weight:700;}
`;
document.head.appendChild(css);

/* ── 平台可配加价率：全平台统一单值（与 PC DB.replCfg 同口径）───────── */
const CFG={finePerUnit:40};
/* ── 数据（与 PC DB.replOrders 一致）──────────────────────── */
const LIST=[
  // ── source='aftersale' 售后补货（与 PC AS-26070207 / AS-26070206 / AS-26051801 同源）──
  {no:'RPL-20260702-012',source:'aftersale',afterNo:'AS-26070207',subOrderNo:'#SG20260702018',client:'食为天餐厅',warehouse:'兀兰DC',
   receiptTime:'2026-07-02 16:05',sku:'SKU8803',name:'菠菜',spec:'1kg/件',unit:'件',
   gapQty:20,qty:12,refundQty:8,selfPrice:4.10,custPrice:5.80,status:'pending',billNo:'',invNo:''},
  {no:'RPL-20260702-011',source:'aftersale',afterNo:'AS-26070206',subOrderNo:'#SG20260702006',client:'丰盛轩',warehouse:'盛港DC',
   receiptTime:'2026-07-02 14:20',sku:'SKU8806',name:'上海青',spec:'1kg/件',unit:'件',
   gapQty:12,qty:12,refundQty:0,selfPrice:4.10,custPrice:5.80,status:'pending',billNo:'',invNo:''},
  {no:'RPL-20260518-002',source:'aftersale',afterNo:'AS-26051801',subOrderNo:'#SG20260517022',client:'新味坊',warehouse:'裕廊DC',
   receiptTime:'2026-05-18 15:40',sku:'SKU8811',name:'鲜鸡蛋',spec:'30枚/盘',unit:'盘',
   gapQty:6,qty:6,refundQty:0,selfPrice:9.20,custPrice:12.80,status:'invoiced',billNo:'ST202605-M0815',invNo:'RPL-INV-2026-303'},
  {no:'RPL-20260628-003',source:'receipt',deliveryNo:'SH20260628004',subOrderNo:'#SG20260628011',warehouse:'盛港DC',
   receiptTime:'2026-06-28 01:06',sku:'SKU8801',name:'小棠菜',spec:'1kg/件',unit:'件',
   should:20,received:18,qty:2,selfPrice:2.90,status:'pending',billNo:'',invNo:''},
  {no:'RPL-20260629-004',source:'receipt',deliveryNo:'SH20260629005',subOrderNo:'#SG20260629004',warehouse:'兀兰DC',
   receiptTime:'2026-06-29 03:24',sku:'SKU8804',name:'空心菜',spec:'1kg/件',unit:'件',
   should:30,received:22,qty:8,selfPrice:3.50,status:'pending',billNo:'',invNo:''},
  {no:'RPL-20260630-005',source:'receipt',deliveryNo:'SH20260630007',subOrderNo:'#SG20260630012',warehouse:'大巴窑DC',
   receiptTime:'2026-06-30 04:11',sku:'SKU8802',name:'白菜',spec:'1kg/件',unit:'件',
   should:40,received:37,qty:3,selfPrice:2.30,status:'deducted',billNo:'ST202606-M0815',invNo:''},
  {no:'RPL-20260522-002',source:'receipt',deliveryNo:'SH20260522001',subOrderNo:'#SG20260522006',warehouse:'盛港DC',
   receiptTime:'2026-05-22 13:42',sku:'SKU8803',name:'菠菜',spec:'1kg/件',unit:'件',
   should:12,received:10,qty:2,selfPrice:4.10,status:'invoiced',billNo:'ST202605-M0815',invNo:'RPL-INV-2026-302'},
  {no:'RPL-20260518-001',source:'receipt',deliveryNo:'SH20260518001',subOrderNo:'#SG20260518009',warehouse:'裕廊DC',
   receiptTime:'2026-05-18 02:18',sku:'SKU8811',name:'鲜鸡蛋',spec:'30枚/盘',unit:'盘',
   should:60,received:48,qty:12,selfPrice:9.20,status:'invoiced',billNo:'ST202605-M0815',invNo:'RPL-INV-2026-301'},
];
const GST=9;
const money=n=>'S$'+(+n||0).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
// 缺口：到仓少货 = 应送−实收；售后补货无应送/实收概念，缺口记在 gapQty
const gap  = r=>r.source==='aftersale'?(r.gapQty||r.qty):Math.max(0,r.should-r.received);
const src  = r=>r.source||'receipt';
const SRC={receipt:['到仓少货','rp-c-gray'],aftersale:['售后补货','rp-c-blue']};
const srcChip=r=>{const[t,c]=SRC[src(r)]||SRC.receipt;return `<span class="rp-chip ${c}">${t}</span>`;};
const refundAmt=r=>+(((r.refundQty||0)*(r.custPrice||0))).toFixed(2);
const unit = r=>+(r.selfPrice).toFixed(2);   // 补采单价(含税)=自营商品原定价，不加价
const amt  = r=>+(unit(r)*r.qty).toFixed(2);
const net  = r=>+(amt(r)/(1+GST/100)).toFixed(2);
const gst  = r=>+(amt(r)-net(r)).toFixed(2);
const ST={pending:['待结算','rp-c-amber'],deducted:['已结算','rp-c-blue'],invoiced:['已开票','rp-c-green'],voided:['已作废','rp-c-gray'],reversed:['已冲正','rp-c-gray']};
const TABS=[['all','全部'],['pending','待结算'],['deducted','已结算'],['invoiced','已开票']];   // 已作废/已冲正不设独立 Tab，仍在「全部」中按状态标签展示
const stChip=s=>{const[t,c]=ST[s]||['—','rp-c-gray'];return `<span class="rp-chip ${c}">${t}</span>`;};
// 供 deliver.js 送货单详情联动
window.FM_REPL_BY_DELIVERY=id=>LIST.filter(r=>r.deliveryNo===id);
window.FM_REPL_BY_AFTER=no=>LIST.filter(r=>r.afterNo===no);

/* ── 罚款单：独立数据源，与补采单【无关联】────────────────
   罚款针对「到仓少货」这一事实，只要清点出缺口就计；
   FN20260701008 即「缺货但自营无货未补采」的例子——补采单里查无此单，但照罚。 */
const FINES=[
  {no:'FN20260628004',deliveryNo:'SH20260628004',warehouse:'盛港DC',at:'2026-06-28 01:06',rate:40,status:'pending',billNo:'',
   items:[{sku:'SKU8801',name:'小棠菜',spec:'1kg/件',unit:'件',should:20,received:18,qty:2},
          {sku:'SKU8805',name:'菜心',spec:'1kg/件',unit:'件',should:15,received:12,qty:3}]},
  {no:'FN20260629005',deliveryNo:'SH20260629005',warehouse:'兀兰DC',at:'2026-06-29 03:24',rate:40,status:'pending',billNo:'',
   items:[{sku:'SKU8804',name:'空心菜',spec:'1kg/件',unit:'件',should:30,received:22,qty:8}]},
  {no:'FN20260701008',deliveryNo:'SH20260701008',warehouse:'淡滨尼DC',at:'2026-07-01 02:40',rate:40,status:'pending',billNo:'',noRepl:1,
   items:[{sku:'SKU8807',name:'芥蓝',spec:'1kg/件',unit:'件',should:25,received:20,qty:5}]},
  {no:'FN20260630007',deliveryNo:'SH20260630007',warehouse:'大巴窑DC',at:'2026-06-30 04:11',rate:40,status:'deducted',billNo:'ST202606-M0815',
   items:[{sku:'SKU8802',name:'白菜',spec:'1kg/件',unit:'件',should:40,received:37,qty:3}]},
  {no:'FN20260522001',deliveryNo:'SH20260522001',warehouse:'盛港DC',at:'2026-05-22 13:42',rate:40,status:'deducted',billNo:'ST202605-M0815',
   items:[{sku:'SKU8803',name:'菠菜',spec:'1kg/件',unit:'件',should:12,received:10,qty:2}]},
  {no:'FN20260518001',deliveryNo:'SH20260518001',warehouse:'裕廊DC',at:'2026-05-18 02:18',rate:40,status:'deducted',billNo:'ST202605-M0815',
   items:[{sku:'SKU8811',name:'鲜鸡蛋',spec:'30枚/盘',unit:'盘',should:60,received:48,qty:12}]},
];
const fnQty=g=>g.items.reduce((a,x)=>a+x.qty,0);
const fnAmt=g=>+(fnQty(g)*g.rate).toFixed(2);
window.FM_FINE_BY_DELIVERY=id=>FINES.find(g=>g.deliveryNo===id)||null;
const pill=(t,bg,c)=>`<span style="font-size:11px;font-weight:700;padding:2px 9px;border-radius:8px;background:${bg};color:${c};white-space:nowrap">${t}</span>`;
const fnChip=st=>st==='pending'?pill('待结算','var(--amber-soft)','#B45309'):pill('已结算','#E1EBFF','#2563EB');
function fineCard(g){
  return `<div class="rp-card" data-fine="${g.no}">
    <div class="r1"><span class="no">${g.no}</span>${fnChip(g.status)}${pill('到仓少货','var(--red-soft)','var(--red)')}</div>
    <div class="sub" style="font-family:monospace">${g.deliveryNo}</div>
    <div class="sub">${g.warehouse} · 收货清点 ${g.at}</div>
    <div class="goods"><span class="nm">${g.items.map(x=>x.name).join('、')}</span><span class="sk">共 ${g.items.length} 个 SKU</span></div>
    <div class="qty">
      <div class="q"><div class="v neg">${fnQty(g)}</div><div class="l">缺口件数</div></div>
      <div class="q"><div class="v">${money(g.rate).slice(2)}</div><div class="l">罚款标准</div></div>
      <div class="q"><div class="v neg">${money(fnAmt(g)).slice(2)}</div><div class="l">罚款金额</div></div>
    </div>
    <div class="r2">${fnQty(g)} 件 × ${money(g.rate)}/件<span class="amt">-${money(fnAmt(g))}</span></div>
  </div>`;
}
function openFine(){
  pushPage({title:'罚款单',body:`
    <div class="rp-intro" style="background:var(--red-soft);color:var(--red)">送货到仓被清点出<b>少货</b>时，按 <b>缺口件数 × ${money(FINES[0].rate)}/件</b> 计罚。<b>一张送货单一张罚款单</b>，同单多 SKU 缺货合并计罚。罚款<b>按件计、与货值无关</b>，<b>不开发票</b>，作为独立扣减项进当期结算单。<br><b>罚款与平台补采互不关联</b>——只要清点出缺口就计罚，自营无货未补采时同样计罚。</div>
    <div class="rp-list" id="fn-list"></div>`,
    mount:(p)=>{
      const list=p.querySelector('#fn-list');
      list.innerHTML=skel(3);
      setTimeout(()=>{
        list.innerHTML=FINES.length?FINES.map(fineCard).join(''):`<div class="empty"><div class="ei">${svg('alert')}</div><h4>暂无罚款单</h4><p>足额送货到仓即不会产生罚款单</p></div>`;
        list.querySelectorAll('[data-fine]').forEach(c=>c.onclick=()=>openFineDetail(c.dataset.fine));
      },420);
    }});
}
function openFineDetail(no){
  const g=FINES.find(x=>x.no===no); if(!g)return;
  pushPage({title:'罚款单详情',navbar:true,body:`
    <div class="rp-card2">
      <div class="rp-ct">${g.no} <span class="desc">${fnChip(g.status)} ${pill('到仓少货','var(--red-soft)','var(--red)')}</span></div>
      <div class="rp-note" style="background:var(--red-soft);color:var(--red)">本单送货到仓被清点出 <b>${g.items.length} 个 SKU 少货、合计 ${fnQty(g)} 件</b>，按 <b>${money(g.rate)}/件</b> 计罚，罚款 <b>${money(fnAmt(g))}</b>。罚款<b>按件计、与货值无关</b>，<b>不开发票</b>，作为独立扣减项进当期结算单。${g.noRepl?'<br><b>本单缺口未由自营补采</b>（自营无货），但缺货照常计罚——罚款与补采互不关联。':''}</div>
    </div>
    <div class="rp-card2">
      <div class="rp-ct">单据信息</div>
      <div class="rp-row"><span class="k">罚款事由</span><span class="v">到仓少货</span></div>
      <div class="rp-row"><span class="k">来源送货单</span><span class="v">${g.deliveryNo}</span></div>
      <div class="rp-row"><span class="k">入库仓库</span><span class="v">${g.warehouse}</span></div>
      <div class="rp-row"><span class="k">收货清点时间</span><span class="v">${g.at}</span></div>
      <div class="rp-row"><span class="k">抵扣所属结算单</span><span class="v">${g.billNo||'待本期结算单生成时抵扣'}</span></div>
    </div>
    <div class="rp-card2">
      <div class="rp-ct">缺货明细 <span class="desc">逐 SKU</span></div>
      ${g.items.map(x=>`<div class="rp-row" style="display:block">
        <div style="display:flex;align-items:center;gap:8px"><b style="font-size:14px">${x.name}</b><span style="font-size:11px;color:var(--sub);font-family:monospace">${x.sku} · ${x.spec}</span></div>
        <div style="display:flex;gap:14px;margin-top:6px;font-size:12.5px;color:#46604F;flex-wrap:wrap">
          <span>应送 <b>${x.should}</b></span><span>实收 <b style="color:var(--red)">${x.received}</b></span><span>缺口 <b style="color:var(--red)">${x.qty}</b>${x.unit}</span>
          <span style="margin-left:auto;color:var(--red);font-weight:700">-${money(+(x.qty*g.rate).toFixed(2))}</span>
        </div>
      </div>`).join('')}
      <div class="rp-row total"><span class="k">合计 ${fnQty(g)} 件</span><span class="v neg">-${money(fnAmt(g))}</span></div>
    </div>
    <div style="margin:12px 16px 0;font-size:11.5px;color:var(--sub);line-height:1.6">罚款标准在<b>生成单据时快照</b>，后续平台调整不追溯本单。对缺口数量有异议请<b>线下联系运营</b>核对，本期不设线上申诉入口。</div>
    <div style="height:8px"></div>`,
    footer:`<button class="btn primary" style="width:100%" id="fn-close">关闭</button>`,
    mount:(p)=>{const b=p.querySelector('#fn-close');if(b)b.onclick=popPage;}});
}

let _tab='all', _q='';

/* ── 1. 列表 ─────────────────────────────────────── */
function openReplen(){
  _tab='all'; _q='';
  pushPage({title:'平台补采',body:`
    <div class="rp-intro">送货到仓被清点出<b>少货</b>、且平台<b>自营现货可全额覆盖缺口</b>时，由自营现货替你补齐——<b>客户订单不受影响</b>，你的 GMV 与佣金仍按<b>应送数量</b>足额计。缺口视同你向平台采购：单价 = <b>自营商品原定价</b>（<b>不加价</b>），货款在<b>结算单中直接抵扣</b>。缺货另有<b>罚款单</b>，与本单<b>无关联、各自独立</b>。</div>
    <div class="rp-search"><input id="rp-q" placeholder="搜补采单号 / 送货单号 / 原订单号" value="${_q}"><span class="clr" id="rp-clr">✕</span></div>
    <div class="rp-tabs" id="rp-tabs"></div>
    <div class="rp-list" id="rp-list"></div>`,
    mount:(p)=>{
      const tabs=p.querySelector('#rp-tabs'),list=p.querySelector('#rp-list'),q=p.querySelector('#rp-q');
      function drawTabs(){
        tabs.innerHTML=TABS.map(t=>{const n=t[0]==='all'?LIST.length:LIST.filter(r=>r.status===t[0]).length;
          return `<div class="rp-tab ${_tab===t[0]?'on':''}" data-t="${t[0]}">${t[1]}${n?` ${n}`:''}</div>`;}).join('');
        tabs.querySelectorAll('.rp-tab').forEach(t=>t.onclick=()=>{if(_tab===t.dataset.t)return;_tab=t.dataset.t;drawTabs();drawList();});
      }
      function drawList(){
        const k=_q.trim().toLowerCase();
        const hit=r=>!k||[r.no,r.deliveryNo,r.afterNo,r.subOrderNo].some(v=>String(v||'').toLowerCase().includes(k));
        const rs=LIST.filter(r=>_tab==='all'||r.status===_tab).filter(hit);
        if(!rs.length){list.innerHTML=`<div class="empty"><div class="ei">${svg('swap')}</div><h4>${_q?'没有符合搜索条件的补采单':(_tab==='all'?'暂无补采单':'该状态下暂无单据')}</h4><p>${_q?'换个单号试试，或点 ✕ 清空搜索':(_tab==='all'?'两种情况会生成补采单：① 到仓清点少货、自营补齐；② 客户签收后缺货判你责、自营补发':'切换上方状态查看其它单据')}</p></div>`;return;}
        list.innerHTML=rs.map((r,i)=>{const isAS=src(r)==='aftersale';return `<div class="rp-card" data-no="${r.no}">
          <div class="r1"><span class="no">${r.no}</span>${stChip(r.status)}${srcChip(r)}<span class="rp-chip rp-c-red">${isAS?'缺货':'少货'} ${gap(r)} ${r.unit}</span></div>
          <div class="sub" style="font-family:monospace">${isAS?r.afterNo:r.deliveryNo} · ${r.subOrderNo}</div>
          <div class="sub">${r.warehouse} · ${isAS?'补发出库':'收货清点'} ${r.receiptTime}</div>
          <div class="goods"><span class="nm">${r.name}</span><span class="sk">${r.sku} · ${r.spec}</span></div>
          <div class="qty">
            ${isAS
              ? `<div class="q"><div class="v neg">${gap(r)}</div><div class="l">客户缺货(${r.unit})</div></div>
                 <div class="q"><div class="v">${r.qty}</div><div class="l">自营补发(${r.unit})</div></div>
                 <div class="q"><div class="v ${r.refundQty?'neg':''}">${r.refundQty||0}</div><div class="l">差额退款(${r.unit})</div></div>`
              : `<div class="q"><div class="v">${r.should}</div><div class="l">应送(${r.unit})</div></div>
                 <div class="q"><div class="v neg">${r.received}</div><div class="l">实收(${r.unit})</div></div>
                 <div class="q"><div class="v neg">${gap(r)}</div><div class="l">缺口(${r.unit})</div></div>`}
            <div class="q"><div class="v">${money(unit(r)).slice(2)}</div><div class="l">${isAS?'补发单价':'补采单价'}</div></div>
          </div>
          <div class="r2">${money(unit(r))} × ${r.qty}${r.unit}${isAS&&r.refundQty?` ＋ 退款 ${money(refundAmt(r))}`:''}<span class="amt">-${money(amt(r)+refundAmt(r))}</span></div>
        </div>`;}).join('');
        list.querySelectorAll('.rp-card').forEach(c=>c.onclick=()=>openDetail(LIST.find(r=>r.no===c.dataset.no)));
      }
      let t=null;
      q.oninput=()=>{_q=q.value;clearTimeout(t);t=setTimeout(()=>{drawTabs();drawList();},260);};
      p.querySelector('#rp-clr').onclick=()=>{q.value='';_q='';drawTabs();drawList();};
      drawTabs();
      list.innerHTML=skel(3);
      setTimeout(drawList,420);
    }});
}

/* ── 2. 详情 ─────────────────────────────────────── */
function openDetail(r){
  if(!r)return;
  const isAS=src(r)==='aftersale';
  const rfd=refundAmt(r), total=+(amt(r)+rfd).toFixed(2);
  pushPage({title:'补采单详情',navbar:true,body:`
    <div class="rp-card2">
      <div class="rp-ct">${r.no} <span class="desc">${stChip(r.status)}${srcChip(r)}</span></div>
      ${isAS
        ? `<div class="rp-note">客户签收后发现少送 <b>${gap(r)} ${r.unit}</b>，判<b>你方责任</b>，客户要求<b>补货不退款</b>。平台已用<b>自营现货</b>补发 <b>${r.qty} ${r.unit}</b>${r.refundQty?`，自营库存不足的 <b>${r.refundQty} ${r.unit}</b> 转为<b>退款</b>`:'（<b>全额覆盖</b>）'}。补发部分视同你向平台采购，货款在结算单中抵扣；客户订单商品/金额/发票<b>均未变更</b>。</div>`
        : `<div class="rp-note warn">本单少货 <b>${gap(r)} ${r.unit}</b>，已由平台<b>自营现货全额补齐</b>，客户订单未受影响（商品/金额/发票不变）。缺口部分视同你向平台采购，货款在结算单中抵扣。</div>`}
    </div>

    <div class="rp-card2">
      <div class="rp-ct">单据信息</div>
      <div class="rp-row"><span class="k">来源</span><span class="v">${isAS?'售后补货（客户签收后）':'到仓少货（出库前清点）'}</span></div>
      ${isAS
        ? `<div class="rp-row" id="rp-go-as" style="cursor:pointer"><span class="k">关联售后工单</span><span class="v">${r.afterNo} ›</span></div>
           <div class="rp-row"><span class="k">客户</span><span class="v">${(r.client||'').slice(0,1)}***</span></div>`
        : `<div class="rp-row" id="rp-go-dl" style="cursor:pointer"><span class="k">关联送货单</span><span class="v">${r.deliveryNo} ›</span></div>`}
      <div class="rp-row"><span class="k">关联原订单（供应商子单）</span><span class="v">${r.subOrderNo}</span></div>
      <div class="rp-row"><span class="k">${isAS?'发货仓库':'入库仓库'}</span><span class="v">${r.warehouse}</span></div>
      <div class="rp-row"><span class="k">${isAS?'补发出库时间':'收货清点时间'}</span><span class="v">${r.receiptTime}<br><span style="font-size:11px;font-weight:400;color:var(--sub)">${isAS?'签收后 · 售后补发':'出库前 · 仓内清点'}</span></span></div>
      <div class="rp-row"><span class="k">差异</span><span class="v neg">${isAS?`客户缺货 ${gap(r)} → 自营补发 ${r.qty}${r.refundQty?` ＋ 退款 ${r.refundQty}`:''} ${r.unit}`:`实收 ${r.received} − 应送 ${r.should} = -${gap(r)} ${r.unit}（数量少送）`}</span></div>
    </div>

    <div class="rp-card2">
      <div class="rp-ct">${r.name}<span class="desc">${r.sku} · ${r.spec}</span></div>
      ${isAS
        ? `<div class="rp-row"><span class="k">客户缺货</span><span class="v neg">${gap(r)} ${r.unit}</span></div>
           <div class="rp-row"><span class="k">自营补发</span><span class="v">${r.qty} ${r.unit}</span></div>
           <div class="rp-row"><span class="k">差额退款</span><span class="v ${r.refundQty?'neg':''}">${r.refundQty?r.refundQty+' '+r.unit:'—（全额覆盖）'}</span></div>`
        : `<div class="rp-row"><span class="k">应送 / 实收</span><span class="v">${r.should} / <span style="color:var(--red)">${r.received}</span> ${r.unit}</span></div>
           <div class="rp-row"><span class="k">缺口 · 补货数量</span><span class="v neg">${gap(r)} ${r.unit}</span></div>`}
      <div class="rp-row"><span class="k">单价（含税）<br><span style="font-size:11px">取自营商品原定价，生成时快照</span></span><span class="v">${money(unit(r))} / ${r.unit}</span></div>
      <div class="rp-row"><span class="k">${isAS?'补发金额':'补采金额'} = ${money(unit(r))} × ${r.qty}${r.unit}<br><span style="font-size:11px">不加价</span></span><span class="v">${money(amt(r))}</span></div>
      <div class="rp-row"><span class="k">不含税金额</span><span class="v">${money(net(r))}</span></div>
      <div class="rp-row"><span class="k">GST ${GST}%</span><span class="v">${money(gst(r))}</span></div>
      <div class="rp-row total"><span class="k">${isAS?'售后补货扣款':'补采款'}（含税 · 结算抵扣）</span><span class="v neg">-${money(amt(r))}</span></div>
      ${isAS&&r.refundQty?`<div class="rp-row"><span class="k">差额退款 = ${money(r.custPrice)} × ${r.refundQty}${r.unit}<br><span style="font-size:11px">自营库存不足部分，按<b>客户成交价</b>计价，走逆向扣减科目</span></span><span class="v neg">-${money(rfd)}</span></div>
      <div class="rp-row total"><span class="k">本单合计扣减</span><span class="v neg">-${money(total)}</span></div>`:''}
      ${isAS?`<div class="rp-row"><span class="k">缺货罚款<br><span style="font-size:11px">售后补货场景不计罚款（区别于到仓少货）</span></span><span class="v">${money(0)}</span></div>`:''}
    </div>

    <div class="rp-card2">
      <div class="rp-ct">结算与发票</div>
      <div class="rp-row" ${r.billNo?'id="rp-go-st" style="cursor:pointer"':''}><span class="k">抵扣所属结算单</span><span class="v">${r.billNo?r.billNo+' ›':'预计计入下一期结算单（生成时抵扣）'+(isAS?'，按补发出库时间归期':'')}</span></div>
      <div class="rp-row" ${r.invNo?'id="rp-go-iv" style="cursor:pointer"':''}><span class="k">补采发票</span><span class="v">${r.invNo?r.invNo+' ›':'结算完成后由平台自动开具'}</span></div>
      <div class="rp-note">平台就补采单向你开具<b>补货销售发票</b>（开票方＝平台、收票方＝商家，GST ${GST}%），结算完成后自动开具并推送，你只需查看/下载。${isAS&&r.refundQty?'<b>仅就补发部分开票</b>，退款部分不开票。':''}<br>${isAS?'补货类售后<b>不开放线上申诉</b>，补发在判责后<b>立即执行</b>、不等申诉窗口。对判责结论或补发数量有异议，请在<b>结案后 7 个自然日内</b>联系你的运营对接人（微信群「Food Max 供应商-绿鲜源」/ +65 6123 4567）并提供出库装车凭证；核实有误的由运营发起<b>冲正</b>，下期结算回补并开红冲发票（货已交付客户，<b>不追回</b>）。':'对<b>实收数量</b>有异议，请在<b>收货清点后 7 个自然日内</b>联系你的运营对接人（微信群「Food Max 供应商-绿鲜源」/ +65 6123 4567），并提供<b>装车照片或司机交接单</b>；平台调取仓库收货监控核对，核实有误的由运营发起<b>冲正</b>，下期结算回补并开红冲发票。逾期以清点数量为准。'}</div>
    </div>
    <div style="height:8px"></div>`,
    footer:`<button class="btn primary" style="width:100%" id="rp-close">关闭</button>`,
    mount:(p)=>{
      const c=p.querySelector('#rp-close');if(c)c.onclick=popPage;
      const go=(id,mod,tip)=>{const e=p.querySelector(id);if(e)e.onclick=()=>{window.FM_MOD&&window.FM_MOD[mod]?window.FM_MOD[mod]():toast(tip);};};
      go('#rp-go-dl','signin','送货管理加载中');
      go('#rp-go-as','after','售后管理加载中');
      go('#rp-go-st','settle','结算单模块加载中');
      go('#rp-go-iv','invoice','开票管理加载中');
    }});
}

window.FM_MOD=window.FM_MOD||{};
window.FM_MOD.replen=openReplen;
window.FM_MOD.fine=openFine;
})();
