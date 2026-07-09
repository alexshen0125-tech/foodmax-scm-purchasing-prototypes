/* Food Max 商家端 v2 · 结算单模块（商家视角·只读）
   复用清结算平台「结算单」：按周期 BY 商户 聚合清分明细 = 应清算给供应商 + 平台抽佣。
   商家视角降权：只显示本商家(鲜丰食材)自己的单；去掉运营侧生成/付款/差错工单/申诉，仅查看。
   清分腿只展示与商家相关的 2 腿（商户结算 + 平台抽佣），隐藏仓配腿(物流BU内部)。
   数据取自清结算平台原型 M002 真实数字，币种 S$。评审修复内建：骨架屏/空态/44px触控。 */
(function(){
const {pushPage,popPage,toast,sheet,svg,skel}=window.FM;

const css=document.createElement('style');
css.textContent=`
.se-intro{margin:0 16px 12px;background:var(--mint-soft);color:var(--emerald-d);font-size:12.5px;font-weight:600;padding:11px 14px;border-radius:12px;line-height:1.5;}
.se-sum{background:#fff;margin:0 16px 14px;border-radius:20px;padding:18px 16px 14px;box-shadow:var(--sh-sm);}
.se-sum .gh{text-align:center;font-size:13px;color:var(--sub);font-weight:600;}
.se-sum .big{text-align:center;font-size:32px;font-weight:700;color:var(--emerald-2);margin:6px 0 3px;}
.se-sum .big .c{font-size:19px;opacity:.8;margin-right:3px;}
.se-sum .lbl{text-align:center;font-size:12px;color:var(--sub);margin-bottom:14px;}
.se-sum .cols{display:flex;border-top:1px solid var(--line);padding-top:13px;}
.se-sum .cols .c{flex:1;text-align:center;}
.se-sum .cols .c .k{font-size:12px;color:var(--sub);}
.se-sum .cols .c .v{font-size:15px;font-weight:600;margin-top:5px;}
.se-list{padding:0 16px 16px;}
.se-bill{background:#fff;border-radius:18px;padding:16px;margin-bottom:12px;box-shadow:var(--sh-sm);cursor:pointer;}
.se-bill .r1{display:flex;align-items:center;gap:8px;}
.se-bill .no{font-size:14px;font-weight:700;color:#27433A;}
.se-bill .big{font-size:26px;font-weight:700;color:var(--emerald-2);margin:9px 0 2px;}
.se-bill .big .c{font-size:16px;opacity:.8;margin-right:2px;}
.se-bill .glbl{font-size:11.5px;color:var(--sub);}
.se-bill .r2{display:flex;align-items:center;font-size:12.5px;color:var(--sub);margin-top:11px;padding-top:11px;border-top:1px solid var(--line);}
.se-bill .r2 .ar{margin-left:auto;color:var(--sub);}
.se-chip{font-size:11px;font-weight:700;padding:2px 9px;border-radius:8px;}
.se-c-blue{background:#EAF1FF;color:#2563EB;}
.se-c-green{background:var(--mint-soft);color:var(--emerald-2);}
.se-c-amber{background:var(--amber-soft);color:#B45309;}
.se-c-gray{background:var(--muted);color:var(--sub);}
.se-c-red{background:var(--red-soft);color:var(--red);}
/* 详情 */
.se-dhead{text-align:center;padding:6px 16px 2px;}
.se-dhead .no{font-size:13px;color:var(--sub);font-weight:600;}
.se-dhead .big{font-size:34px;font-weight:700;color:var(--emerald-2);margin:8px 0 3px;}
.se-dhead .big .c{font-size:20px;opacity:.8;margin-right:3px;}
.se-dhead .lbl{font-size:12px;color:var(--sub);}
.se-card{background:#fff;border-radius:18px;margin:12px 16px;padding:6px 16px 8px;box-shadow:var(--sh-sm);}
.se-ct{font-size:15px;font-weight:700;padding:12px 0 6px;}
.se-ct .desc{font-size:11.5px;color:var(--sub);font-weight:500;margin-left:6px;}
.se-row{display:flex;align-items:baseline;padding:11px 0;border-top:1px solid var(--line);font-size:14px;}
.se-row .k{color:#27433A;font-weight:600;}
.se-row .v{margin-left:auto;font-weight:600;}
.se-row .v .eq{display:block;font-size:11px;color:var(--sub);font-weight:500;margin-top:2px;text-align:right;}
.se-row.brand .v{color:var(--emerald-2);}
.se-idn{background:var(--muted);border-radius:10px;padding:9px 12px;margin:4px 0 8px;font-size:12px;color:#46604F;text-align:center;}
/* 明细 tabs */
.se-tabs{display:flex;gap:8px;margin:2px 0 10px;}
.se-tab{flex:1;min-height:40px;display:flex;align-items:center;justify-content:center;border-radius:11px;background:var(--muted);font-size:13px;font-weight:600;color:#27433A;cursor:pointer;}
.se-tab.on{background:#EAF1FF;color:#2563EB;border:1px solid #2563EB;}
.se-tw{overflow-x:auto;-webkit-overflow-scrolling:touch;margin:0 -4px;}
.se-tw::-webkit-scrollbar{display:none;}
.se-tbl{border-collapse:collapse;font-size:11.5px;min-width:max-content;}
.se-tbl th,.se-tbl td{padding:8px 9px;text-align:right;white-space:nowrap;border-bottom:1px solid var(--line);}
.se-tbl th{color:var(--sub);font-weight:600;background:var(--muted);position:sticky;top:0;}
.se-tbl th:first-child,.se-tbl td:first-child{text-align:left;}
.se-tbl td.neg{color:var(--red);}
.se-tbl tr.sub td{font-weight:700;color:#27433A;border-top:1.5px solid var(--line);border-bottom:none;}
.se-tag{font-size:10px;font-weight:700;padding:1px 6px;border-radius:6px;}
.se-tag.fwd{background:#EAF1FF;color:#2563EB;}
.se-tag.rev{background:var(--amber-soft);color:#B45309;}
.se-note{font-size:11.5px;color:var(--sub);line-height:1.6;padding:8px 2px 4px;}
/* 清分腿 */
.se-leg{padding:13px 0;border-top:1px solid var(--line);}
.se-leg .lt{display:flex;align-items:center;gap:8px;}
.se-leg .lt .nm{font-size:14px;font-weight:700;}
.se-leg .lt .am{margin-left:auto;font-size:15px;font-weight:700;}
.se-leg .payee{font-size:12px;color:var(--sub);margin-top:6px;}
.se-leg .sts{display:flex;gap:7px;margin-top:8px;}
.se-legend{font-size:11.5px;color:var(--sub);line-height:1.9;padding:2px 2px 10px;}
.se-legend b{color:#27433A;}
`;
document.head.appendChild(css);

// ── 本商家 & 结算单数据（复用清结算平台 M002 真实数字）──────────
const ME={payee:'鲜丰食材 Fresh Harvest Pte Ltd',bank:'DBS ***8899'};
const RATE='3.5%';
const BILLS=[
  {no:'ST2026H07A-M0125',cycle:'2026-07上（半月）',orders:318,payable:'30,014.75',comm:'995.75',
   base:'28,450.00',gross:'31,010.50',inv:'待开',invC:'gray',bill:'待付款',billC:'blue',
   payout:'待支付',payC:'gray',mClear:'已清分',mClearC:'green',pClear:'待清分',pClearC:'blue',
   payNote:'预计 2026-07-16 到账',payNo:'—',sample:true},
  {no:'ST2026H06B-M0125',cycle:'2026-06下（半月）',orders:296,payable:'27,880.40',comm:'921.60',
   base:'26,331.43',gross:'28,802.00',inv:'已开',invC:'green',bill:'已付款',billC:'green',
   payout:'成功',payC:'green',mClear:'已清分',mClearC:'green',pClear:'已清分',pClearC:'green',
   payNote:'2026-07-02 09:00 已汇入收款账户',payNo:'PAY20260702-118',sample:true},
  {no:'ST2026H06A-M0125',cycle:'2026-06上（半月）',orders:305,payable:'28,540.15',comm:'948.20',
   base:'27,091.43',gross:'29,488.35',inv:'已开',invC:'green',bill:'已付款',billC:'green',
   payout:'成功',payC:'green',mClear:'已清分',mClearC:'green',pClear:'已清分',pClearC:'green',
   payNote:'2026-06-17 09:00 已汇入收款账户',payNo:'PAY20260617-092',sample:true},
];
// 订单级示例（含正向/逆向；应清算给供应商 = 订单实付 − 平台抽佣）
const ORD=[
  {no:'SO2026070200318',rev:0,t:'2026-07-02 14:30',paid:'1,059.00',frt:'18.00',dep:'40.00',base:'1,001.00',comm:'35.04',pay:'1,023.96'},
  {no:'SO2026070100205',rev:0,t:'2026-07-01 10:12',paid:'640.00',frt:'12.00',dep:'20.00',base:'608.00',comm:'21.28',pay:'618.72'},
  {no:'SR2026070100088',rev:1,t:'2026-07-01 16:40',paid:'-180.00',frt:'0.00',dep:'0.00',base:'-170.00',comm:'-5.95',pay:'-174.05'},
];
const ORD_SUB={paid:'1,519.00',frt:'30.00',dep:'60.00',base:'1,439.00',comm:'50.37',pay:'1,468.63'};
// 商品行级示例
const ITEM=[
  {no:'SO2026070200318',sku:'SKU-VEG-001',nm:'大白菜 10kg',cat:'蔬菜',paid:'120.00',comm:'4.20',inc:'4.58'},
  {no:'SO2026070200318',sku:'SKU-VEG-007',nm:'胡萝卜 5kg',cat:'蔬菜',paid:'75.00',comm:'2.63',inc:'2.86'},
  {no:'SO2026070100205',sku:'SKU-FRT-012',nm:'苹果 20kg',cat:'水果',paid:'300.00',comm:'10.50',inc:'11.45'},
  {no:'SO2026070100205',sku:'SKU-VEG-020',nm:'土豆 10kg',cat:'蔬菜',paid:'90.00',comm:'3.15',inc:'3.43'},
  {no:'SR2026070100088',sku:'SKU-VEG-001',nm:'大白菜 10kg（退）',cat:'蔬菜',paid:'-170.00',comm:'-5.95',inc:'-6.49'},
];

const chip=(t,c)=>`<span class="se-chip se-c-${c}">${t}</span>`;
const neg=v=>String(v).startsWith('-')?' neg':'';

// ── 1. 结算单列表（入口）───────────────────────────
function openSettle(){
  pushPage({title:'结算单',body:`
    <div class="se-intro">按结算周期聚合你的清分明细。<b>应清算给供应商</b>=你的到手货款；<b>平台抽佣</b>另开佣金税票。金额均为 S$。</div>
    <div class="se-sum">
      <div class="gh">应付你合计 · 待付款</div>
      <div class="big disp"><span class="c">S$</span>30,014.75</div>
      <div class="lbl">1 张待付款结算单</div>
      <div class="cols">
        <div class="c"><div class="k">本期抽佣</div><div class="v disp">S$995.75</div></div>
        <div class="c"><div class="k">待对账</div><div class="v disp">0</div></div>
        <div class="c"><div class="k">申诉中</div><div class="v disp">0</div></div>
      </div>
    </div>
    <div class="se-list" id="sl"></div>`,
    mount:(p)=>{
      const l=p.querySelector('#sl');
      l.innerHTML=skel(3);
      setTimeout(()=>{
        if(!BILLS.length){l.innerHTML=`<div class="empty"><div class="ei">${svg('wallet')}</div><h4>暂无结算单</h4><p>结算周期结束后系统按周期聚合生成</p></div>`;return;}
        l.innerHTML=BILLS.map((b,i)=>`<div class="se-bill" data-i="${i}">
          <div class="r1"><span class="no">${b.cycle}</span>${chip(b.bill,b.billC)}</div>
          <div class="big disp"><span class="c">S$</span>${b.payable}</div>
          <div class="glbl">应清算给供应商（到手货款）</div>
          <div class="r2">${b.orders} 单 · 平台抽佣 S$${b.comm} · ${b.payNote}<span class="ar">›</span></div>
        </div>`).join('');
        l.querySelectorAll('.se-bill').forEach(c=>c.onclick=()=>openDetail(BILLS[+c.dataset.i]));
      },420);
    }});
}

// ── 2. 结算单详情（构成 + 订单明细 + 清分进度，全只读）──
function openDetail(b){
  pushPage({title:'结算单详情',body:`
    <div class="se-dhead">
      <div class="no">${b.no} · ${b.cycle} ${chip(b.bill,b.billC)}</div>
      <div class="big disp"><span class="c">S$</span>${b.payable}</div>
      <div class="lbl">应清算给供应商（到手货款）</div>
    </div>

    <div class="se-card">
      <div class="se-ct">结算单构成<span class="desc">汇总 = 应清算给供应商 + 平台抽佣</span></div>
      <div class="se-row"><span class="k">聚合订单数</span><span class="v">${b.orders}</span></div>
      <div class="se-row"><span class="k">计佣基数（GMV不含税）</span><span class="v">S$${b.base}<span class="eq">仅用于开票，与到手货款不同口径</span></span></div>
      <div class="se-row"><span class="k">汇总总额（含税）</span><span class="v">S$${b.gross}</span></div>
      <div class="se-row brand"><span class="k">应清算给供应商</span><span class="v">S$${b.payable}<span class="eq">= 汇总总额 − 平台抽佣</span></span></div>
      <div class="se-row"><span class="k">平台抽佣</span><span class="v" style="color:var(--amber)">S$${b.comm}<span class="eq">= 计佣基数 × ${RATE}</span></span></div>
      <div class="se-idn">S$${b.payable} + S$${b.comm} = S$${b.gross} ✓ 勾稽平</div>
    </div>

    <div class="se-card">
      <div class="se-ct">订单明细<span class="desc">两级下钻 · 只读</span></div>
      <div class="se-tabs" id="st">
        <div class="se-tab on" data-t="ord">订单级</div>
        <div class="se-tab" data-t="item">订单+商品级</div>
      </div>
      <div id="stbody"></div>
      <div class="se-note" id="stnote"></div>
    </div>

    <div class="se-card">
      <div class="se-ct">清分进度<span class="desc">与你相关的 2 部分</span></div>
      <div class="se-leg">
        <div class="lt"><span class="nm">商户结算清分</span><span class="am">S$${b.payable}</span></div>
        <div class="payee">应付你货款 → ${ME.payee} · ${ME.bank}</div>
        <div class="sts">${chip('清分 '+b.mClear,b.mClearC)}${chip('付款 '+b.payout,b.payC)}</div>
        <div class="payee">${b.payNo==='—'?b.payNote:('流水 '+b.payNo+' · '+b.payNote)}</div>
      </div>
      <div class="se-leg">
        <div class="lt"><span class="nm">平台抽佣</span><span class="am" style="color:var(--amber)">S$${b.comm}</span></div>
        <div class="payee">抽佣入平台 · 平台结算完成后<b>自动开具</b>服务费发票（佣金税票 GST 9%）给你，无需申请，可查看/下载</div>
        <div class="sts">${chip('清分 '+b.pClear,b.pClearC)}${chip('发票 '+b.inv,b.invC)}</div>
      </div>
    </div>

    <div class="se-card">
      <div class="se-ct">状态说明</div>
      <div class="se-legend">
        <div><b>结算单状态</b>：待对账 → 对账中 → 待付款 → 已付款；有异议时转 申诉中（申诉走电脑端 / 客服）</div>
        <div><b>清分状态</b>：待清分 / 已清分 / 已冲销</div>
        <div><b>付款状态</b>：待付款 / 付款中 / 成功 / 失败 —— 打款至你的收款账户</div>
        <div><b>服务费发票(抽佣)</b>：平台结算完成后<b>自动开具</b>给你（GST 9%），商家仅查看/下载、无需申请；仅正向税票，无红冲</div>
      </div>
    </div>`,
    mount:(p)=>{
      const body=p.querySelector('#stbody'),note=p.querySelector('#stnote');
      const renderOrd=()=>{
        body.innerHTML=`<div class="se-tw"><table class="se-tbl">
          <thead><tr><th>订单号</th><th>类型</th><th>履约完成</th><th>实付</th><th>运费</th><th>BCRS押金</th><th>计佣基数</th><th>平台抽佣</th><th>应清算</th></tr></thead>
          <tbody>${ORD.map(o=>`<tr>
            <td>${o.no}</td><td style="text-align:center"><span class="se-tag ${o.rev?'rev':'fwd'}">${o.rev?'逆向':'正向'}</span></td><td>${o.t}</td>
            <td class="${neg(o.paid)}">S$${o.paid}</td><td>S$${o.frt}</td><td>S$${o.dep}</td>
            <td class="${neg(o.base)}">S$${o.base}</td><td class="${neg(o.comm)}">S$${o.comm}</td><td class="${neg(o.pay)}">S$${o.pay}</td></tr>`).join('')}
            <tr class="sub"><td colspan="3">示例小计</td><td>S$${ORD_SUB.paid}</td><td>S$${ORD_SUB.frt}</td><td>S$${ORD_SUB.dep}</td><td>S$${ORD_SUB.base}</td><td>S$${ORD_SUB.comm}</td><td>S$${ORD_SUB.pay}</td></tr>
          </tbody></table></div>`;
        note.textContent=`每张订单一行（含正向/逆向）。应清算给供应商 = 订单实付 − 平台抽佣。本期共 ${b.orders} 张，此处示例展示部分，完整明细可在电脑端导出。`;
      };
      const renderItem=()=>{
        body.innerHTML=`<div class="se-tw"><table class="se-tbl">
          <thead><tr><th>订单号</th><th>商品编码</th><th>商品名称</th><th>分类</th><th>实付</th><th>费率</th><th>平台抽佣</th><th>平台含税收入</th></tr></thead>
          <tbody>${ITEM.map(it=>`<tr>
            <td>${it.no}</td><td>${it.sku}</td><td style="text-align:left">${it.nm}</td><td style="text-align:center">${it.cat}</td>
            <td class="${neg(it.paid)}">S$${it.paid}</td><td>${RATE}</td><td class="${neg(it.comm)}">S$${it.comm}</td><td class="${neg(it.inc)}">S$${it.inc}</td></tr>`).join('')}
          </tbody></table></div>`;
        note.textContent='每个商品行一行并标注所属订单号——最细粒度，向上支撑抽佣与平台含税收入计算。';
      };
      renderOrd();
      p.querySelectorAll('#st .se-tab').forEach(t=>t.onclick=()=>{
        p.querySelectorAll('#st .se-tab').forEach(x=>x.classList.remove('on'));t.classList.add('on');
        t.dataset.t==='ord'?renderOrd():renderItem();});
    }});
}

window.FM_MOD=window.FM_MOD||{};
window.FM_MOD.settle=openSettle;
})();
