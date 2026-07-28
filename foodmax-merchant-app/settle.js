/* Food Max 商家端 v2 · 对账结算模块（商家视角）
   PC 对齐(2026-07)：完全按 PC 商家管理系统「对账结算」口径重构——
   月度结算单 · 绿鲜源蔬果 · 应清算给供应商 = 汇总总额 − 逆向扣减 − 平台抽佣(服务佣金) − 物流抽佣(物流佣金)
   列表字段/状态/详情构成/清分进度 与 PC 一致。
   第一期：结算单生成即默认商家已确认，当期直接待付款(无手动确认)；进度节点去掉「开票」。历史单 已结清(只读)。金额 S$。 */
(function(){
const {pushPage,popPage,toast,sheet,svg,skel,confirmDialog}=window.FM;

const css=document.createElement('style');
css.textContent=`
.se-intro{margin:0 16px 12px;background:var(--mint-soft);color:var(--emerald-d);font-size:12.5px;font-weight:600;padding:11px 14px;border-radius:12px;line-height:1.5;}
.se-topbar{display:flex;align-items:center;padding:0 18px 8px;font-size:12.5px;color:var(--sub);}
.se-list{padding:0 16px 24px;}
.se-bill{background:#fff;border-radius:18px;padding:16px;margin-bottom:12px;box-shadow:var(--sh-sm);cursor:pointer;}
.se-bill .bd{min-width:0;}
.se-bill .r1{display:flex;align-items:center;gap:8px;}
.se-bill .no{font-size:14px;font-weight:700;color:#27433A;font-family:'Lora',serif;}
.se-bill .rng{font-size:12px;color:var(--sub);margin-top:3px;}
.se-bill .big{font-size:25px;font-weight:700;color:var(--emerald-2);margin:9px 0 2px;}
.se-bill .big .c{font-size:15px;opacity:.8;margin-right:2px;}
.se-bill .glbl{font-size:11.5px;color:var(--sub);}
.se-bill .r2{display:flex;align-items:center;font-size:12px;color:var(--sub);margin-top:11px;padding-top:11px;border-top:1px solid var(--line);}
.se-bill .r2 .ar{margin-left:auto;color:var(--sub);}
.se-chip{font-size:11px;font-weight:700;padding:2px 9px;border-radius:8px;white-space:nowrap;}
.se-c-blue{background:#EAF1FF;color:#2563EB;}
.se-c-green{background:var(--mint-soft);color:var(--emerald-2);}
.se-c-amber{background:var(--amber-soft);color:#B45309;}
.se-c-gray{background:var(--muted);color:var(--sub);}
/* 详情 */
.se-dhead{text-align:center;padding:6px 16px 2px;}
.se-dhead .no{font-size:13px;color:var(--sub);font-weight:600;}
.se-dhead .big{font-size:34px;font-weight:700;color:var(--emerald-2);margin:8px 0 3px;}
.se-dhead .big .c{font-size:20px;opacity:.8;margin-right:3px;}
.se-dhead .lbl{font-size:12px;color:var(--sub);}
/* 进度条 */
.se-steps{display:flex;margin:14px 16px 2px;}
.se-steps .s{flex:1;text-align:center;position:relative;font-size:10.5px;color:var(--sub);}
.se-steps .s .d{width:16px;height:16px;border-radius:50%;background:var(--muted);margin:0 auto 5px;border:2px solid var(--muted);}
.se-steps .s.done .d{background:var(--emerald);border-color:var(--emerald);}
.se-steps .s.cur .d{background:#fff;border-color:var(--emerald);}
.se-steps .s.cur{color:var(--emerald-2);font-weight:700;}
.se-steps .s::before{content:"";position:absolute;top:7px;left:-50%;width:100%;height:2px;background:var(--muted);z-index:0;}
.se-steps .s:first-child::before{display:none;}
.se-steps .s.done::before,.se-steps .s.cur::before{background:var(--emerald);}
.se-steps .s .d{position:relative;z-index:1;}
.se-card{background:#fff;border-radius:18px;margin:12px 16px;padding:6px 16px 12px;box-shadow:var(--sh-sm);}
.se-ct{font-size:15px;font-weight:700;padding:12px 0 6px;}
.se-ct .desc{font-size:11.5px;color:var(--sub);font-weight:500;margin-left:6px;}
.se-row{display:flex;align-items:baseline;padding:11px 0;border-top:1px solid var(--line);font-size:14px;}
.se-row .k{color:#27433A;font-weight:600;}
.se-row .v{margin-left:auto;font-weight:600;}
.se-row .v.neg{color:var(--red);}
.se-row .v .eq{display:block;font-size:11px;color:var(--sub);font-weight:500;margin-top:2px;text-align:right;}
.se-row.brand .v{color:var(--emerald-2);font-size:17px;}
.se-idn{background:var(--muted);border-radius:10px;padding:9px 12px;margin:8px 0 2px;font-size:12px;color:#46604F;text-align:center;}
.se-tip{background:#EAF1FF;color:#2563EB;border-radius:10px;padding:9px 12px;margin:8px 0 2px;font-size:12px;line-height:1.5;}
.se-tw{overflow-x:auto;-webkit-overflow-scrolling:touch;margin:6px -4px 0;}
.se-tw::-webkit-scrollbar{display:none;}
.se-tbl{border-collapse:collapse;font-size:12px;min-width:max-content;width:100%;}
.se-tbl th,.se-tbl td{padding:9px 10px;text-align:right;white-space:nowrap;border-bottom:1px solid var(--line);}
.se-tbl th{color:var(--sub);font-weight:600;background:var(--muted);}
.se-tbl th:first-child,.se-tbl td:first-child{text-align:left;}
.se-tbl td.neg{color:var(--red);}
.se-tbl tr.sub td{font-weight:700;color:var(--emerald-2);border-top:1.5px solid var(--line);border-bottom:none;}
/* 清分腿 */
.se-leg{padding:13px 0;border-top:1px solid var(--line);}
.se-leg:first-child{border-top:none;}
.se-leg .lt{display:flex;align-items:center;gap:8px;}
.se-leg .lt .nm{font-size:14px;font-weight:700;}
.se-leg .lt .am{margin-left:auto;font-size:15px;font-weight:700;color:var(--emerald-2);}
.se-leg .payee{font-size:12px;color:var(--sub);margin-top:6px;line-height:1.5;}
.se-leg .sts{display:flex;gap:7px;margin-top:8px;flex-wrap:wrap;}
.se-legend{font-size:11.5px;color:var(--sub);line-height:1.9;padding:2px 0 4px;}
.se-legend b{color:#27433A;}
`;
document.head.appendChild(css);

// ── 数据（与 PC「对账结算」DB.bill / billsHistory 完全一致）───────────
const ME={payee:'绿鲜源蔬果 Pte Ltd',bank:'DBS ****8821'};
// 当期结算单（第一期默认已确认 → confirmed 待付款）
// 第一期：结算单给到商家即默认商家已确认(无需手动确认)，当期直接进入待付款
const CUR={period:'2026年6月',no:'ST202606-M0815',range:'2026-06-01 ~ 06-30',genDate:'2026-07-01',status:'confirmed',
  gross:47530.00,reverse:268.00,feeSvc:1188.25,feeLogi:712.95,net:45360.80,payTime:'',
  items:[['订单货款（含历史）',94,47530.00],['逆向扣减（售后判商家责）',2,-268.00],['平台抽佣·服务佣金（按品类佣金率）',92,-1188.25],['物流抽佣·物流佣金（按品类佣金率）',92,-712.95]]};
const HIST=[
  {period:'2026年5月',no:'ST202605-M0815',range:'2026-05-01 ~ 05-31',genDate:'2026-06-01',status:'paid',
   gross:44180.00,reverse:210.00,feeSvc:1104.50,feeLogi:662.70,net:42202.80,payTime:'2026-06-03 09:12 已到账 DBS ****8821',
   items:[['订单货款（含历史）',88,44180.00],['逆向扣减（售后判商家责）',1,-210.00],['平台抽佣·服务佣金（按品类佣金率）',86,-1104.50],['物流抽佣·物流佣金（按品类佣金率）',86,-662.70]]},
  {period:'2026年4月',no:'ST202604-M0815',range:'2026-04-01 ~ 04-30',genDate:'2026-05-01',status:'paid',
   gross:39650.00,reverse:0,feeSvc:991.25,feeLogi:594.75,net:38064.00,payTime:'2026-05-06 09:08 已到账 DBS ****8821',
   items:[['订单货款（含历史）',80,39650.00],['逆向扣减（售后判商家责）',0,0],['平台抽佣·服务佣金（按品类佣金率）',80,-991.25],['物流抽佣·物流佣金（按品类佣金率）',80,-594.75]]},
];
const rows=()=>[CUR,...HIST];
const money=n=>'S$'+(+n||0).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
const statusChip=b=>{
  if(b.status=='paid')return `<span class="se-chip se-c-green">已结清</span>`;
  return `<span class="se-chip se-c-blue">待付款</span>`;   // 第一期默认已确认，当期即待付款
};

// ── 1. 结算单列表 ─────────────────────────────────
function openSettle(){
  pushPage({title:'对账结算',body:`
    <div class="se-intro">每月生成一张<b>结算单</b>。<b>应清算给供应商</b>=汇总总额 − 逆向扣减 − 平台抽佣 − 物流抽佣，即你的到手货款；平台就抽佣部分开具佣金税票。金额 S$。</div>
    <div class="se-topbar"><span id="se-cnt"></span></div>
    <div class="se-list" id="sl"></div>`,
    mount:(p)=>{
      const l=p.querySelector('#sl');
      function drawList(){
        const rs=rows();
        p.querySelector('#se-cnt').textContent=`共 ${rs.length} 张 · 点卡片看详情`;
        l.innerHTML=rs.map((b,i)=>`<div class="se-bill" data-i="${i}">
          <div class="bd">
            <div class="r1"><span class="no">${b.no}</span>${statusChip(b)}</div>
            <div class="rng">${b.range}</div>
            <div class="big disp"><span class="c">S$</span>${money(b.net).slice(2)}</div>
            <div class="glbl">应清算给供应商（到手货款）</div>
            <div class="r2">平台抽佣 ${money(b.feeSvc+b.feeLogi)} · ${b.status=='paid'?b.payTime:'待打款'}<span class="ar">›</span></div>
          </div>
        </div>`).join('');
        l.querySelectorAll('.se-bill').forEach(c=>c.onclick=()=>openDetail(rows()[+c.dataset.i]));
      }
      l.innerHTML=skel(3);
      setTimeout(drawList,420);
    }});
}

// ── 2. 结算单详情（构成 + 账单构成 + 清分进度，对齐 PC）──
function openDetail(b){
  const isCur=b===CUR;
  // 进度节点去掉「开票」；第一期商家确认为默认完成，当期从「校验付款」起
  const STEPS=['平台生成','商家确认','校验付款','打款完成'];
  const idx=b.status=='paid'?STEPS.length:2;   // 当期默认已确认 → 停在「校验付款」
  const payTag=b.status=='paid'?`<span class="se-chip se-c-green">已清分 · 已到账</span>`
    :`<span class="se-chip se-c-amber">已清分 · 待打款</span>`;
  const svcTag=(b.feeSvc>0)?(b.status=='paid'?`<span class="se-chip se-c-green">发票 已开</span>`:`<span class="se-chip se-c-blue">结算后自动开票</span>`)
    :`<span class="se-chip se-c-gray">免佣期 · 无服务费</span>`;
  const foot=`<button class="btn primary" id="se-close">关闭</button>`;
  pushPage({title:'结算单详情',body:`
    <div class="se-dhead">
      <div class="no">${b.no} · ${b.range} ${statusChip(b)}</div>
      <div class="big disp"><span class="c">S$</span>${money(b.net).slice(2)}</div>
      <div class="lbl">应清算给供应商（到手货款）</div>
    </div>
    ${isCur?`<div class="se-steps">${STEPS.map((s,i)=>`<div class="s ${i<idx?'done':i==idx?'cur':''}"><div class="d"></div>${s}</div>`).join('')}</div>`:''}

    <div class="se-card">
      <div class="se-ct">结算单构成<span class="desc">应清算给供应商 = 汇总总额 − 逆向 − 抽佣</span></div>
      <div class="se-row"><span class="k">汇总总额（GMV）</span><span class="v">${money(b.gross)}</span></div>
      <div class="se-row"><span class="k">逆向扣减（退款/少货）</span><span class="v neg">-${money(b.reverse)}</span></div>
      <div class="se-row"><span class="k">平台抽佣（服务佣金）${b.feeSvc>0?'':'· 免佣期'}</span><span class="v neg">-${money(b.feeSvc)}</span></div>
      <div class="se-row"><span class="k">物流抽佣（物流佣金）${b.feeLogi>0?'':'· 免佣期'}</span><span class="v neg">-${money(b.feeLogi)}</span></div>
      <div class="se-row brand"><span class="k">应清算给供应商</span><span class="v">${money(b.net)}</span></div>
      <div class="se-idn">${money(b.net)} + ${money(b.reverse+b.feeSvc+b.feeLogi)} = ${money(b.gross)} ✓ 勾稽平</div>
    </div>

    <div class="se-card">
      <div class="se-ct">账单构成<span class="desc">按类目汇总</span></div>
      <div class="se-tw"><table class="se-tbl">
        <thead><tr><th>类目</th><th>笔数</th><th>金额</th></tr></thead>
        <tbody>${b.items.map(it=>`<tr><td>${it[0]}</td><td>${it[1]}</td><td class="${it[2]<0?'neg':''}">${it[2]<0?'-':''}${money(Math.abs(it[2]))}</td></tr>`).join('')}
          <tr class="sub"><td>应清算给供应商</td><td>—</td><td>${money(b.net)}</td></tr>
        </tbody></table></div>
    </div>

    <div class="se-card">
      <div class="se-ct">清分进度<span class="desc">与你相关的 2 部分 · 只读</span></div>
      <div class="se-leg">
        <div class="lt"><span class="nm">商户结算清分</span><span class="am">${money(b.net)}</span></div>
        <div class="payee">应付你货款 → ${ME.payee} · ${ME.bank}</div>
        <div class="sts">${payTag}</div>
        ${b.payTime?`<div class="payee">${b.payTime}</div>`:''}
      </div>
      <div class="se-leg">
        <div class="lt"><span class="nm">平台抽佣（服务费）</span><span class="am" style="color:var(--amber)">${money(b.feeSvc)}</span></div>
        <div class="payee">抽佣入平台 · 平台结算完成后<b>自动开具</b>服务费发票（佣金税票 GST 9%）给你，无需申请、可查看/下载</div>
        <div class="sts">${svcTag}</div>
      </div>
    </div>

    ${isCur&&b.status!='paid'?`<div class="se-card"><div class="se-tip">结算单生成即默认对账确认，直接进入付款流程；如有异议请<b>线下联系平台运营 / 客服</b>核查。</div></div>`:''}
    ${b.status=='paid'?`<div class="se-card"><div class="se-idn" style="background:var(--mint-soft);color:var(--emerald-2)">💰 本期已结清，货款 ${money(b.net)} 已到账</div></div>`:''}

    <div class="se-card">
      <div class="se-ct">状态说明</div>
      <div class="se-legend">
        <div><b>结算单状态</b>：待付款 → 已结清（生成即默认对账确认；有异议线下联系运营/客服）</div>
        <div><b>清分状态</b>：待清分 / 已清分 / 已到账</div>
        <div><b>服务费发票(抽佣)</b>：平台结算完成后<b>自动开具</b>（GST 9%），商家仅查看/下载、无需申请</div>
      </div>
    </div>`,
    footer:foot,
    mount:(p)=>{
      const close=p.querySelector('#se-close');if(close)close.onclick=popPage;
    }});
}

window.FM_MOD=window.FM_MOD||{};
window.FM_MOD.settle=openSettle;
})();
