/* Food Max 商家端 v2 · 自营代补货（与 PC「财务 › 自营代补货」pc-modules/replenish.js 同口径）
   适用范围：仅【出库前·仓内收货清点】场景；差异只有一种——实收 < 应送（数量少了），无原因分类。
   业务链：送货到仓 → 仓库收货清点少货 → 自营现货可【全额覆盖】缺口 → 生成代补货单
           → 平台按【含税售价 ×(1+加价率)】向商家销售缺口数量 → 当期结算单抵扣 → 平台开代补货销售发票。
   口径（2026-08-07 缺货补货方案对焦会 + 沈亮 2026-08-10 确认）：
   - 客户订单完全无感（商品/金额/发票不变）；商家 GMV 与佣金按【应送数量】足额计，不因少货下调。
   - 代补单价(含税) = 含税售价 ×(1+加价率)；加价率【全平台统一】单值，默认 30%、平台可配、生成时快照，
     不分商家/品类/site；售价取原订单下单时快照。
   - 等效罚则 = 缺口数量 × 含税售价 × 加价率。
   - 自营现货不足以全额覆盖缺口 → 不生成代补货单，按实收数量出库并标缺货。
   - 结算抵扣，商家无支付动作；异议走线下，无线上申诉入口。
   评审修复内建：列表 skel→数据 / 空态 .empty / 可点元素≥44px。 */
(function(){
const {pushPage,popPage,toast,svg,skel}=window.FM;

const css=document.createElement('style');
css.textContent=`
.rp-intro{margin:0 16px 12px;background:var(--amber-soft);color:#B45309;font-size:12.5px;font-weight:600;padding:11px 14px;border-radius:12px;line-height:1.55;}
.rp-sum{display:flex;margin:0 16px 12px;background:#fff;border-radius:18px;padding:16px 0;box-shadow:var(--sh-sm);}
.rp-sum .c{flex:1;text-align:center;}
.rp-sum .c+.c{border-left:1px solid var(--line);}
.rp-sum .c .v{font-size:22px;font-weight:600;font-family:'Lora',serif;}
.rp-sum .c .v.neg{color:var(--red);}
.rp-sum .c .l{font-size:11.5px;color:var(--sub);margin-top:3px;}
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
const CFG={rate:30};
/* ── 数据（与 PC DB.replOrders 一致）──────────────────────── */
const LIST=[
  {no:'RPL-20260628-003',deliveryNo:'SH20260628004',subOrderNo:'#SG20260628011',warehouse:'盛港DC',
   receiptTime:'2026-06-28 01:06',sku:'SKU8801',name:'小棠菜',spec:'1kg/件',unit:'件',
   should:20,received:18,qty:2,price:2.60,rate:30,status:'pending',billNo:'',invNo:''},
  {no:'RPL-20260629-004',deliveryNo:'SH20260629005',subOrderNo:'#SG20260629004',warehouse:'兀兰DC',
   receiptTime:'2026-06-29 03:24',sku:'SKU8804',name:'空心菜',spec:'1kg/件',unit:'件',
   should:30,received:22,qty:8,price:3.20,rate:30,status:'pending',billNo:'',invNo:''},
  {no:'RPL-20260630-005',deliveryNo:'SH20260630007',subOrderNo:'#SG20260630012',warehouse:'大巴窑DC',
   receiptTime:'2026-06-30 04:11',sku:'SKU8802',name:'白菜',spec:'1kg/件',unit:'件',
   should:40,received:37,qty:3,price:2.10,rate:30,status:'deducted',billNo:'ST202606-M0815',invNo:''},
  {no:'RPL-20260522-002',deliveryNo:'SH20260522001',subOrderNo:'#SG20260522006',warehouse:'盛港DC',
   receiptTime:'2026-05-22 13:42',sku:'SKU8803',name:'菠菜',spec:'1kg/件',unit:'件',
   should:12,received:10,qty:2,price:3.80,rate:30,status:'invoiced',billNo:'ST202605-M0815',invNo:'RPL-INV-2026-302'},
  {no:'RPL-20260518-001',deliveryNo:'SH20260518001',subOrderNo:'#SG20260518009',warehouse:'裕廊DC',
   receiptTime:'2026-05-18 02:18',sku:'SKU8811',name:'鲜鸡蛋',spec:'30枚/盘',unit:'盘',
   should:60,received:48,qty:12,price:8.40,rate:30,status:'invoiced',billNo:'ST202605-M0815',invNo:'RPL-INV-2026-301'},
];
const GST=9;
const money=n=>'S$'+(+n||0).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
const gap  = r=>Math.max(0,r.should-r.received);
const unit = r=>+(r.price*(1+r.rate/100)).toFixed(2);
const amt  = r=>+(unit(r)*r.qty).toFixed(2);
const net  = r=>+(amt(r)/(1+GST/100)).toFixed(2);
const gst  = r=>+(amt(r)-net(r)).toFixed(2);
const loss = r=>+(r.qty*r.price*r.rate/100).toFixed(2);
const ST={pending:['待结算','rp-c-amber'],deducted:['已抵扣','rp-c-blue'],invoiced:['已开票','rp-c-green'],voided:['已作废','rp-c-gray'],reversed:['已冲正','rp-c-gray']};
const TABS=[['all','全部'],['pending','待结算'],['deducted','已抵扣'],['invoiced','已开票']];
const stChip=s=>{const[t,c]=ST[s]||['—','rp-c-gray'];return `<span class="rp-chip ${c}">${t}</span>`;};
// 供 deliver.js 送货单详情联动
window.FM_REPL_BY_DELIVERY=id=>LIST.filter(r=>r.deliveryNo===id);

let _tab='all';

/* ── 1. 列表 ─────────────────────────────────────── */
function openReplen(){
  _tab='all';
  pushPage({title:'自营代补货',body:`
    <div class="rp-intro">送货到仓被清点出<b>少货</b>、且平台<b>自营现货可全额覆盖缺口</b>时，由自营现货替你补齐——<b>客户订单不受影响</b>，你的 GMV 与佣金仍按<b>应送数量</b>足额计。缺口视同你向平台采购：单价 = 含税售价 ×(1+加价率 ${CFG.rate}%)，货款在<b>结算单中直接抵扣</b>。</div>
    <div class="rp-sum" id="rp-sum"></div>
    <div class="rp-tabs" id="rp-tabs"></div>
    <div class="rp-list" id="rp-list"></div>`,
    mount:(p)=>{
      const sum=p.querySelector('#rp-sum'),tabs=p.querySelector('#rp-tabs'),list=p.querySelector('#rp-list');
      function drawSum(){
        const pend=LIST.filter(r=>r.status==='pending');
        sum.innerHTML=`
          <div class="c"><div class="v neg">${money(pend.reduce((a,r)=>a+loss(r),0)).slice(2)}</div><div class="l">你实际多付</div></div>
          <div class="c"><div class="v">${money(pend.reduce((a,r)=>a+amt(r),0)).slice(2)}</div><div class="l">结算抵扣(含税)</div></div>
          <div class="c"><div class="v">${pend.length}</div><div class="l">待结算单数</div></div>
          <div class="c"><div class="v">${CFG.rate}%</div><div class="l">加价率·全平台</div></div>`;
      }
      function drawTabs(){
        tabs.innerHTML=TABS.map(t=>{const n=t[0]==='all'?LIST.length:LIST.filter(r=>r.status===t[0]).length;
          return `<div class="rp-tab ${_tab===t[0]?'on':''}" data-t="${t[0]}">${t[1]}${n?` ${n}`:''}</div>`;}).join('');
        tabs.querySelectorAll('.rp-tab').forEach(t=>t.onclick=()=>{if(_tab===t.dataset.t)return;_tab=t.dataset.t;drawTabs();drawList();});
      }
      function drawList(){
        const rs=LIST.filter(r=>_tab==='all'||r.status===_tab);
        if(!rs.length){list.innerHTML=`<div class="empty"><div class="ei">${svg('swap')}</div><h4>${_tab==='all'?'暂无代补货单':'该状态下暂无单据'}</h4><p>${_tab==='all'?'足额送货到仓即不会产生代补货单':'切换上方状态查看其它单据'}</p></div>`;return;}
        list.innerHTML=rs.map((r,i)=>`<div class="rp-card" data-no="${r.no}">
          <div class="r1"><span class="no">${r.no}</span>${stChip(r.status)}<span class="rp-chip rp-c-red">少货 ${gap(r)} ${r.unit}</span></div>
          <div class="sub" style="font-family:monospace">${r.deliveryNo} · ${r.subOrderNo}</div>
          <div class="sub">${r.warehouse} · 收货清点 ${r.receiptTime}</div>
          <div class="goods"><span class="nm">${r.name}</span><span class="sk">${r.sku} · ${r.spec}</span></div>
          <div class="qty">
            <div class="q"><div class="v">${r.should}</div><div class="l">应送(${r.unit})</div></div>
            <div class="q"><div class="v neg">${r.received}</div><div class="l">实收(${r.unit})</div></div>
            <div class="q"><div class="v neg">${gap(r)}</div><div class="l">缺口(${r.unit})</div></div>
            <div class="q"><div class="v">${money(unit(r)).slice(2)}</div><div class="l">代补单价</div></div>
          </div>
          <div class="r2">结算抵扣 ${money(amt(r))}<span class="amt">你多付 ${money(loss(r))}</span></div>
        </div>`).join('');
        list.querySelectorAll('.rp-card').forEach(c=>c.onclick=()=>openDetail(LIST.find(r=>r.no===c.dataset.no)));
      }
      drawSum();drawTabs();
      list.innerHTML=skel(3);
      setTimeout(drawList,420);
    }});
}

/* ── 2. 详情 ─────────────────────────────────────── */
function openDetail(r){
  if(!r)return;
  pushPage({title:'代补货单详情',navbar:true,body:`
    <div class="rp-card2">
      <div class="rp-ct">${r.no} <span class="desc">${stChip(r.status)}</span></div>
      <div class="rp-note warn">本单少货 <b>${gap(r)} ${r.unit}</b>，已由平台<b>自营现货全额代补</b>，客户订单未受影响（商品/金额/发票不变）。缺口部分视同你向平台采购，货款在结算单中抵扣。</div>
    </div>

    <div class="rp-card2">
      <div class="rp-ct">单据信息</div>
      <div class="rp-row" id="rp-go-dl" style="cursor:pointer"><span class="k">关联送货单</span><span class="v">${r.deliveryNo} ›</span></div>
      <div class="rp-row"><span class="k">关联原订单（供应商子单）</span><span class="v">${r.subOrderNo}</span></div>
      <div class="rp-row"><span class="k">入库仓库</span><span class="v">${r.warehouse}</span></div>
      <div class="rp-row"><span class="k">收货清点时间</span><span class="v">${r.receiptTime}<br><span style="font-size:11px;font-weight:400;color:var(--sub)">出库前 · 仓内清点</span></span></div>
      <div class="rp-row"><span class="k">差异</span><span class="v neg">实收 ${r.received} − 应送 ${r.should} = -${gap(r)} ${r.unit}（数量少送）</span></div>
    </div>

    <div class="rp-card2">
      <div class="rp-ct">${r.name}<span class="desc">${r.sku} · ${r.spec}</span></div>
      <div class="rp-row"><span class="k">应送 / 实收</span><span class="v">${r.should} / <span style="color:var(--red)">${r.received}</span> ${r.unit}</span></div>
      <div class="rp-row"><span class="k">缺口 · 代补数量</span><span class="v neg">${gap(r)} ${r.unit}</span></div>
      <div class="rp-row"><span class="k">含税售价（下单时快照）</span><span class="v">${money(r.price)} / ${r.unit}</span></div>
      <div class="rp-row"><span class="k">加价率（生成时快照）</span><span class="v amber">+${r.rate}%</span></div>
      <div class="rp-row"><span class="k">代补单价 = ${money(r.price)} ×(1+${r.rate}%)</span><span class="v">${money(unit(r))}</span></div>
      <div class="rp-row"><span class="k">不含税金额</span><span class="v">${money(net(r))}</span></div>
      <div class="rp-row"><span class="k">GST ${GST}%</span><span class="v">${money(gst(r))}</span></div>
      <div class="rp-row total"><span class="k">代补货款（含税 · 结算抵扣）</span><span class="v neg">-${money(amt(r))}</span></div>
    </div>

    <div class="rp-card2">
      <div class="rp-ct">对你的影响</div>
      <div class="rp-row"><span class="k">该商品计入 GMV<br><span style="font-size:11px">按应送 ${r.should} 足额计，不因少货下调</span></span><span class="v">${money(+(r.should*r.price).toFixed(2))}</span></div>
      <div class="rp-row"><span class="k">代补货扣款<br><span style="font-size:11px">缺口 ${r.qty} × ${money(unit(r))}</span></span><span class="v neg">-${money(amt(r))}</span></div>
      <div class="rp-row total"><span class="k">实际多付（加价成本）<br><span style="font-size:11px;font-weight:500">= ${r.qty} × ${money(r.price)} × ${r.rate}%</span></span><span class="v neg">${money(loss(r))}</span></div>
    </div>

    <div class="rp-card2">
      <div class="rp-ct">结算与发票</div>
      <div class="rp-row" ${r.billNo?'id="rp-go-st" style="cursor:pointer"':''}><span class="k">抵扣所属结算单</span><span class="v">${r.billNo?r.billNo+' ›':'预计计入下一期结算单（生成时抵扣）'}</span></div>
      <div class="rp-row" ${r.invNo?'id="rp-go-iv" style="cursor:pointer"':''}><span class="k">代补货发票</span><span class="v">${r.invNo?r.invNo+' ›':'结算完成后由平台自动开具'}</span></div>
      <div class="rp-note">平台就代补货单向你开具<b>代补货销售发票</b>（开票方＝平台、收票方＝商家，GST ${GST}%），结算完成后自动开具并推送，你只需查看/下载。<br>对<b>实收数量</b>有异议，请在<b>收货清点后 7 个自然日内</b>联系你的运营对接人（微信群「Food Max 供应商-绿鲜源」/ +65 6123 4567），并提供<b>装车照片或司机交接单</b>；平台调取仓库收货监控核对，核实有误的由运营发起<b>冲正</b>，下期结算回补并开红冲发票。逾期以清点数量为准。</div>
    </div>
    <div style="height:8px"></div>`,
    footer:`<button class="btn primary" style="width:100%" id="rp-close">关闭</button>`,
    mount:(p)=>{
      const c=p.querySelector('#rp-close');if(c)c.onclick=popPage;
      const go=(id,mod,tip)=>{const e=p.querySelector(id);if(e)e.onclick=()=>{window.FM_MOD&&window.FM_MOD[mod]?window.FM_MOD[mod]():toast(tip);};};
      go('#rp-go-dl','signin','送货管理加载中');
      go('#rp-go-st','settle','结算单模块加载中');
      go('#rp-go-iv','invoice','开票管理加载中');
    }});
}

window.FM_MOD=window.FM_MOD||{};
window.FM_MOD.replen=openReplen;
})();
