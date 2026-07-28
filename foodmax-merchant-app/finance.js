/* Food Max 商家端 v2 · 财务对账模块
   还原快驴卖家App财务对账：账单列表 / 账单详情 / 到账明细 / 到账详情 / 下载账单明细
   币种 S$。评审修复内建：进页开票提醒 / 骨架屏 / 空态 / 提交loading→toast / 44px触控 / 即时校验 */
(function(){
const {pushPage,popPage,toast,confirmDialog,sheet,svg,skel}=window.FM;

const css=document.createElement('style');
css.textContent=`
.fn-note{margin:0 16px 12px;background:var(--red-soft);color:var(--red);font-size:13px;font-weight:600;padding:11px 14px;border-radius:12px;}
.fn-entry{margin:0 16px 14px;background:linear-gradient(120deg,#059669,#047857);border-radius:18px;padding:15px 16px;box-shadow:0 10px 24px rgba(6,95,70,.24);display:flex;align-items:center;gap:12px;cursor:pointer;min-height:44px;}
.fn-entry .fn-el{flex:1;color:#fff;}
.fn-entry .fn-et{font-size:15.5px;font-weight:700;}
.fn-entry .fn-es{font-size:11.5px;opacity:.9;margin-top:4px;line-height:1.4;}
.fn-entry .fn-er{display:flex;align-items:center;gap:8px;color:#fff;}
.fn-entry .fn-eb{font-size:11px;font-weight:700;background:rgba(255,255,255,.2);padding:3px 9px;border-radius:8px;white-space:nowrap;}
.fn-entry .fn-er .ar{font-size:18px;font-weight:700;}
.fn-sum{background:#fff;margin:0 16px 14px;border-radius:20px;padding:20px 16px 16px;box-shadow:var(--sh-sm);}
.fn-sum .gh{text-align:center;font-size:14px;color:#27433A;font-weight:600;}
.fn-sum .big{text-align:center;font-size:34px;font-weight:700;margin:6px 0 16px;display:flex;align-items:center;justify-content:center;gap:6px;}
.fn-sum .big .q{width:18px;height:18px;border-radius:50%;border:1.4px solid var(--sub);color:var(--sub);font-size:11px;display:inline-flex;align-items:center;justify-content:center;}
.fn-sum .cols{display:flex;border-top:1px solid var(--line);padding-top:14px;}
.fn-sum .cols .c{flex:1;text-align:center;}
.fn-sum .cols .c .k{font-size:12.5px;color:var(--sub);display:flex;align-items:center;justify-content:center;gap:3px;}
.fn-sum .cols .c .v{font-size:16px;font-weight:600;margin-top:5px;}
.fn-q{width:14px;height:14px;border-radius:50%;border:1px solid var(--sub);color:var(--sub);font-size:9px;display:inline-flex;align-items:center;justify-content:center;}
.fn-filters{display:flex;gap:8px;margin:0 16px 12px;overflow-x:auto;}.fn-filters::-webkit-scrollbar{display:none;}
.fn-pill{flex:0 0 auto;min-height:44px;display:flex;align-items:center;padding:0 16px;border-radius:13px;font-size:14px;font-weight:600;background:#fff;color:#27433A;box-shadow:var(--sh-sm);cursor:pointer;}
.fn-pill.on{background:#EAF1FF;color:#2563EB;border:1px solid #2563EB;}
.fn-trend{background:#fff;margin:0 16px 12px;border-radius:18px;padding:14px 16px;box-shadow:var(--sh-sm);display:flex;align-items:center;justify-content:space-between;cursor:pointer;min-height:44px;}
.fn-trend .tl{font-size:16px;font-weight:700;}
.fn-trend .tr{display:flex;align-items:center;gap:8px;color:#2563EB;font-size:14px;font-weight:600;}
.fn-trend svg.spark{width:54px;height:24px;}
.fn-chart{margin:-4px 16px 12px;background:#fff;border-radius:0 0 18px 18px;padding:10px 16px 16px;box-shadow:var(--sh-sm);}
.fn-range{display:flex;align-items:center;justify-content:space-between;margin:0 16px 10px;}
.fn-range .rg{font-size:18px;font-weight:700;}
.fn-range .lk{display:flex;gap:18px;}
.fn-range .lk span{color:#2563EB;font-size:14px;font-weight:600;min-height:44px;display:flex;align-items:center;cursor:pointer;}
.fn-list{padding:0 16px 16px;}
.fn-bill{background:#fff;border-radius:16px;padding:16px;margin-bottom:12px;box-shadow:var(--sh-sm);cursor:pointer;}
.fn-bill .r1{display:flex;align-items:center;}
.fn-bill .dt{font-size:16px;font-weight:700;}
.fn-bill .st{margin-left:8px;font-size:11px;font-weight:700;padding:2px 8px;border-radius:8px;}
.fn-bill .amt{margin-left:auto;font-size:17px;font-weight:600;display:flex;align-items:center;gap:4px;}
.fn-bill .amt .gt{color:var(--sub);font-size:15px;}
.fn-bill .sub{font-size:12.5px;color:var(--sub);margin-top:7px;}
.st-wait{background:var(--red-soft);color:var(--red);}
.st-today{background:#EAF1FF;color:#2563EB;}
.st-done{background:var(--mint-soft);color:var(--emerald-2);}
/* 账单详情 */
.fn-dhead{display:flex;gap:10px;padding:4px 16px 8px;}
.fn-dsel{flex:0 0 auto;min-height:44px;display:flex;align-items:center;gap:8px;padding:0 16px;border-radius:12px;background:#EAF1FF;color:#2563EB;font-size:15px;font-weight:600;border:1px solid #2563EB;cursor:pointer;}
.fn-dnav{flex:1;min-height:44px;display:flex;align-items:center;justify-content:center;border-radius:12px;background:#fff;box-shadow:var(--sh-sm);font-size:15px;font-weight:600;color:#27433A;cursor:pointer;}
.fn-dcard{background:#fff;border-radius:18px;margin:8px 16px 14px;padding:18px 16px;box-shadow:var(--sh-sm);}
.fn-dtitle{text-align:center;font-size:15px;font-weight:700;}
.fn-dtitle .st{margin-left:8px;font-size:11px;font-weight:700;padding:2px 8px;border-radius:8px;}
.fn-dbig{text-align:center;font-size:32px;font-weight:700;margin:8px 0 4px;}
.fn-dnote{text-align:center;font-size:12.5px;color:var(--sub);margin-bottom:6px;}
.fn-drow{display:flex;align-items:center;padding:14px 0;border-top:1px solid var(--line);cursor:pointer;min-height:44px;}
.fn-drow .k{font-size:15px;font-weight:600;display:flex;align-items:center;gap:5px;}
.fn-drow .v{margin-left:auto;font-size:15px;font-weight:600;display:flex;align-items:center;gap:5px;}
.fn-drow .v .ar{color:var(--sub);}
.fn-dsub{background:var(--muted);border-radius:12px;padding:4px 12px;margin:2px 0 4px;}
.fn-dsub .s{display:flex;align-items:center;padding:10px 0;font-size:13px;color:#46604F;min-height:44px;}
.fn-dsub .s .k{display:flex;align-items:center;gap:5px;}
.fn-dsub .s .v{margin-left:auto;color:var(--sub);display:flex;align-items:center;gap:5px;}
.fn-dsub .s.lk{cursor:pointer;}
/* 到账明细 */
.fn-afil{padding:8px 16px;display:flex;}
.fn-afil .f{min-height:44px;display:flex;align-items:center;gap:6px;font-size:14px;font-weight:600;color:#27433A;cursor:pointer;}
.fn-arow{background:#fff;display:flex;align-items:center;padding:16px;border-bottom:1px solid var(--line);cursor:pointer;}
.fn-arow .lt .t1{font-size:15px;font-weight:700;display:flex;align-items:center;}
.fn-arow .lt .t1 .tg{margin-left:8px;font-size:11px;font-weight:600;color:#2563EB;background:#EAF1FF;padding:1px 7px;border-radius:6px;}
.fn-arow .lt .t2{font-size:13px;color:var(--sub);margin-top:6px;}
.fn-arow .rt{margin-left:auto;display:flex;align-items:center;gap:6px;font-size:16px;font-weight:600;}
.fn-arow .rt .ar{color:var(--sub);}
.fn-amore{text-align:center;color:var(--sub);font-size:13px;padding:18px;}
/* 到账详情 */
.fn-adcard{background:#fff;border-radius:18px;margin:14px 16px;padding:22px 16px;box-shadow:var(--sh-sm);text-align:center;}
.fn-adcard .ok{font-size:15px;font-weight:600;color:#27433A;}
.fn-adcard .amt{font-size:34px;font-weight:700;color:var(--emerald-2);margin:8px 0 4px;}
.fn-adlist{background:#fff;border-radius:18px;margin:0 16px 16px;box-shadow:var(--sh-sm);overflow:hidden;}
.fn-adlist .h{font-size:14px;font-weight:700;padding:14px 16px 8px;}
.fn-kv{display:flex;justify-content:space-between;padding:13px 16px;border-top:1px solid var(--line);font-size:14px;}
.fn-kv .k{color:var(--sub);}.fn-kv .v{font-weight:600;}
/* 下载账单 */
.fn-dl-h{font-size:15px;font-weight:700;margin:14px 16px 10px;}.fn-dl-h .tip{font-size:12.5px;color:var(--sub);font-weight:500;margin-left:6px;}
.fn-dl-tabs{display:flex;gap:10px;margin:0 16px 12px;}
.fn-dl-tab{flex:1;min-height:44px;display:flex;align-items:center;justify-content:center;border-radius:12px;background:#fff;box-shadow:var(--sh-sm);font-size:14px;font-weight:600;color:#27433A;cursor:pointer;}
.fn-dl-tab.on{background:#EAF1FF;color:#2563EB;border:1px solid #2563EB;}
.fn-dl-date{margin:0 16px 14px;background:var(--muted);border-radius:12px;min-height:48px;display:flex;align-items:center;justify-content:center;gap:14px;font-size:15px;font-weight:600;}
.fn-dl-mail{margin:0 16px 12px;}
.fn-mail{display:flex;align-items:center;gap:12px;margin-bottom:10px;}
.fn-mail .ipt{flex:1;background:var(--muted);border-radius:12px;min-height:48px;display:flex;align-items:center;padding:0 14px;border:1.5px solid transparent;}
.fn-mail .ipt.err{border-color:var(--red);background:var(--red-soft);}
.fn-mail .ipt input{flex:1;border:none;background:transparent;outline:none;font-size:15px;font-family:inherit;}
.fn-mail .del{color:var(--red);font-size:14px;font-weight:600;min-height:44px;display:flex;align-items:center;cursor:pointer;}
.fn-add{margin:0 16px;display:inline-flex;align-items:center;justify-content:center;min-height:46px;padding:0 22px;border-radius:12px;border:1.5px solid #2563EB;color:#2563EB;font-size:14px;font-weight:600;background:#fff;cursor:pointer;}
.fn-mailerr{color:var(--red);font-size:11.5px;margin:-4px 16px 8px;min-height:14px;}
`;
document.head.appendChild(css);

// ── 数据 ──────────────────────────────────────────
const BILLS=[
  {d:'2026.6.30',st:'待打款',sc:'st-wait',amt:'10,658.42',sub:'预计2026.7.2打款',key:'2026.06.30'},
  {d:'2026.6.29',st:'今日打款',sc:'st-today',amt:'10,496.69',sub:'预计今日15:00前打款',key:'2026.06.29'},
  {d:'2026.6.28',st:'已打款',sc:'st-done',amt:'9,494.80',sub:'2026.6.30已汇入钱包余额',key:'2026.06.28'},
  {d:'2026.6.27',st:'已打款',sc:'st-done',amt:'10,714.85',sub:'2026.6.29已汇入钱包余额',key:'2026.06.27'},
  {d:'2026.6.26',st:'已打款',sc:'st-done',amt:'10,395.68',sub:'2026.6.28已汇入钱包余额',key:'2026.06.26'},
  {d:'2026.6.25',st:'已打款',sc:'st-done',amt:'11,302.14',sub:'2026.6.27已汇入钱包余额',key:'2026.06.25'},
];
// 账单详情：仅部分日期有数据，其余命中空态（演示「该城市在该日无货款明细」）
const DETAILS={
  '2026.06.30':{st:'待打款',sc:'st-wait',main:'10,658.42',note:'预计2026.7.2打款',
    goods:'10,750.54',gPre:'13,554.47',gPromo:'0.36',gMain:'2,803.57',after:'67.12',deduct:'25.00',penalty:'25.00',svc:'0.00',pickup:'0.00',payTime:'2026.07.02'},
  '2026.06.29':{st:'今日打款',sc:'st-today',main:'10,496.69',note:'预计今日15:00前打款',
    goods:'10,588.42',gPre:'13,402.18',gPromo:'0.41',gMain:'2,813.35',after:'66.73',deduct:'25.00',penalty:'25.00',svc:'0.00',pickup:'0.00',payTime:'2026.06.29'},
};
// 详情页可切换的日期序列（前一天 / 后一天 在此序列移动；越界外日期命中空态）
const DATE_SEQ=['2026.07.01','2026.06.30','2026.06.29'];

const ARRIVALS=[
  {d:'2026-06-30',amt:'9,494.80',no:'28697754',time:'2026-06-30 09:07:28'},
  {d:'2026-06-29',amt:'10,714.85',no:'28691204',time:'2026-06-29 09:05:11'},
  {d:'2026-06-28',amt:'10,395.68',no:'28685537',time:'2026-06-28 09:08:46'},
  {d:'2026-06-27',amt:'9,941.39',no:'28679910',time:'2026-06-27 09:06:02'},
  {d:'2026-06-26',amt:'10,212.47',no:'28674188',time:'2026-06-26 09:07:53'},
  {d:'2026-06-25',amt:'11,302.14',no:'28668471',time:'2026-06-25 09:04:39'},
  {d:'2026-06-24',amt:'10,277.91',no:'28662705',time:'2026-06-24 09:09:17'},
];

// ── 1. 财务对账列表（入口）──────────────────────────
function openFinance(){
  pushPage({title:'财务对账',body:`
    <div class="fn-note">订单配送完成的次日系统生成账单</div>
    <div class="fn-entry" id="sentry">
      <div class="fn-el"><div class="fn-et">对账结算 · 按月结算单</div><div class="fn-es">应清算给供应商 = 汇总总额 − 逆向 − 抽佣 · 看构成/清分/到账，支持多选导出</div></div>
      <div class="fn-er"><span class="fn-eb">1 待确认</span><span class="ar">›</span></div>
    </div>
    <div class="fn-sum">
      <div class="gh">7月1日生成账单</div>
      <div class="big disp">S$0.00 <span class="q">?</span></div>
      <div class="cols">
        <div class="c"><div class="k">货款</div><div class="v disp">S$0.00</div></div>
        <div class="c"><div class="k">售后货款</div><div class="v disp">S$0.00</div></div>
        <div class="c"><div class="k">其他 <span class="fn-q">?</span></div><div class="v disp">S$0.00</div></div>
      </div>
    </div>
    <div class="fn-filters" id="ff">
      <div class="fn-pill" data-t="2w">近两周</div>
      <div class="fn-pill on" data-t="3m">近三个月</div>
      <div class="fn-pill" data-t="custom">自定义时段 ∨</div>
      <div class="fn-pill" data-t="city">全部城市 ∨</div>
    </div>
    <div class="fn-trend" id="ftrend">
      <span class="tl">趋势图</span>
      <span class="tr">${spark()}<span id="ftt">展开图表 ∨</span></span>
    </div>
    <div id="fchart"></div>
    <div class="fn-range">
      <span class="rg disp">2026.04.01 – 2026.06.30</span>
      <span class="lk"><span id="farr">到账明细</span><span id="fdl">下载账单</span></span>
    </div>
    <div class="fn-list" id="fl"></div>`,
    mount:(p)=>{
      // 进页开票提醒
      confirmDialog({title:'开票提醒',body:'您有未向 Food Max 开具的发票，请登录合作商电脑端及时开具，逾期将扣除逾期税损。',okText:'我知道了'});
      // 结算单入口（复用清结算平台结算单·商家视角）
      const se=p.querySelector('#sentry');
      if(se)se.onclick=()=>{window.FM_MOD&&window.FM_MOD.settle?window.FM_MOD.settle():toast('结算单模块加载中');};
      // 筛选标签
      p.querySelectorAll('#ff .fn-pill').forEach(pill=>pill.onclick=()=>{
        const t=pill.dataset.t;
        if(t==='custom'){sheet([{label:'本周',onClick:()=>toast('已选 本周')},{label:'本月',onClick:()=>toast('已选 本月')},{label:'上月',onClick:()=>toast('已选 上月')}]);return;}
        if(t==='city'){sheet([{label:'全部城市',onClick:()=>toast('全部城市')},{label:'新加坡 · 中区',onClick:()=>toast('中区')},{label:'新加坡 · 东区',onClick:()=>toast('东区')}]);return;}
        p.querySelectorAll('#ff .fn-pill').forEach(x=>{if(['2w','3m'].includes(x.dataset.t))x.classList.remove('on');});
        pill.classList.add('on');
      });
      // 趋势图展开
      const tt=p.querySelector('#ftt'),chart=p.querySelector('#fchart');let open=false;
      p.querySelector('#ftrend').onclick=()=>{open=!open;tt.textContent=open?'收起图表 ∧':'展开图表 ∨';
        chart.innerHTML=open?`<div class="fn-chart">${bigSpark()}</div>`:'';};
      p.querySelector('#farr').onclick=openArrivals;
      p.querySelector('#fdl').onclick=openDownload;
      // 列表：骨架屏 → 数据
      const l=p.querySelector('#fl');
      l.innerHTML=skel(3);
      setTimeout(()=>{
        if(!BILLS.length){l.innerHTML=`<div class="empty"><div class="ei">${svg('wallet')}</div><h4>暂无账单</h4><p>订单配送完成的次日生成账单</p></div>`;return;}
        l.innerHTML=BILLS.map(b=>`<div class="fn-bill" data-k="${b.key}">
          <div class="r1"><span class="dt">${b.d}生成账单</span><span class="st ${b.sc}">${b.st}</span>
            <span class="amt disp"><span class="gt">S$</span>${b.amt} ›</span></div>
          <div class="sub">${b.sub}</div></div>`).join('');
        l.querySelectorAll('.fn-bill').forEach(c=>c.onclick=()=>openBillDetail(c.dataset.k));
      },420);
    }});
}

// ── 2. 账单详情页 ─────────────────────────────────
function openBillDetail(startKey){
  let idx=DATE_SEQ.indexOf(startKey);if(idx<0)idx=DATE_SEQ.indexOf('2026.06.30');
  pushPage({title:'账单详情页',body:`<div id="bd"></div>`,mount:(p)=>{
    const host=p.querySelector('#bd');
    const render=()=>{
      const key=DATE_SEQ[idx];
      const d=DETAILS[key];
      const label=key.replace(/\./g,'.');
      let inner=`<div class="fn-dhead">
          <div class="fn-dsel" id="bsel">${label} ∨</div>
          <div class="fn-dnav" id="bprev">前一天</div>
          <div class="fn-dnav" id="bnext">后一天</div>
        </div>`;
      if(!d){
        inner+=`<div class="empty"><div class="ei">${svg('wallet')}</div><h4>无货款明细</h4><p>该城市在该日无货款明细，请重新选择</p></div>`;
      }else{
        inner+=`<div class="fn-dtitle">${key}生成账单<span class="st ${d.sc}">${d.st}</span></div>
        <div class="fn-dcard">
          <div class="fn-dbig disp">S$${d.main}</div>
          <div class="fn-dnote">${d.note}</div>
          <div class="fn-drow" data-drill="货款"><span class="k">货款 <span class="fn-q">?</span></span><span class="v">S$${d.goods}<span class="ar">›</span></span></div>
          <div class="fn-dsub">
            <div class="s"><span class="k">货款（优惠前） <span class="fn-q">?</span></span><span class="v">S$${d.gPre}</span></div>
            <div class="s"><span class="k">促销费 <span class="fn-q">?</span></span><span class="v">−S$${d.gPromo}</span></div>
            <div class="s"><span class="k">主费用 <span class="fn-q">?</span></span><span class="v">−S$${d.gMain}</span></div>
          </div>
          <div class="fn-drow" data-drill="售后货款"><span class="k">售后货款 <span class="fn-q">?</span></span><span class="v">−S$${d.after}<span class="ar">›</span></span></div>
          <div class="fn-drow"><span class="k">扣款 <span class="fn-q">?</span></span><span class="v">−S$${d.deduct}</span></div>
          <div class="fn-dsub"><div class="s lk" data-drill="违约金"><span class="k">违约金</span><span class="v">−S$${d.penalty}<span class="ar">›</span></span></div></div>
          <div class="fn-drow"><span class="k">其他服务 <span class="fn-q">?</span></span><span class="v">S$${d.svc}</span></div>
          <div class="fn-dsub"><div class="s lk" data-drill="上门揽收费"><span class="k">上门揽收费</span><span class="v">S$${d.pickup}<span class="ar">›</span></span></div></div>
          <div class="fn-drow"><span class="k">预计打款时间</span><span class="v" style="color:var(--sub);font-weight:500">${d.payTime}</span></div>
        </div>`;
      }
      host.innerHTML=inner;
      host.querySelector('#bsel').onclick=()=>sheet(DATE_SEQ.map((k,i)=>({label:k,onClick:()=>{idx=i;render();}})));
      host.querySelector('#bprev').onclick=()=>{if(idx<DATE_SEQ.length-1){idx++;render();}else toast('没有更早的账单');};
      host.querySelector('#bnext').onclick=()=>{if(idx>0){idx--;render();}else toast('没有更晚的账单');};
      host.querySelectorAll('[data-drill]').forEach(r=>r.onclick=()=>toast('查看'+r.dataset.drill+'明细'));
    };
    render();
  }});
}

// ── 3. 到账明细 ──────────────────────────────────
function openArrivals(){
  pushPage({title:'到账明细',body:`
    <div class="fn-afil"><span class="f" id="afil">近七日 ▾</span></div>
    <div id="al"></div>`,mount:(p)=>{
      p.querySelector('#afil').onclick=()=>sheet([
        {label:'近七日',onClick:()=>toast('近七日')},
        {label:'本月',onClick:()=>toast('本月')},
        {label:'最近3个月',onClick:()=>toast('最近3个月')},
      ]);
      const l=p.querySelector('#al');
      l.innerHTML=skel(4);
      setTimeout(()=>{
        if(!ARRIVALS.length){l.innerHTML=`<div class="empty"><div class="ei">${svg('wallet')}</div><h4>暂无到账记录</h4><p>账单结款后将在此展示</p></div>`;return;}
        l.innerHTML=ARRIVALS.map((a,i)=>`<div class="fn-arow" data-i="${i}">
          <div class="lt"><div class="t1">账单结算<span class="tg">汇入钱包</span></div><div class="t2">${a.d} 结款成功</div></div>
          <div class="rt disp"><span>S$${a.amt}</span><span class="ar">›</span></div></div>`).join('')
          +`<div class="fn-amore">没有更多数据了…</div>`;
        l.querySelectorAll('.fn-arow').forEach(r=>r.onclick=()=>openArrivalDetail(ARRIVALS[+r.dataset.i]));
      },420);
    }});
}

// ── 4. 到账详情 ──────────────────────────────────
function openArrivalDetail(a){
  pushPage({title:'到账详情',body:`
    <div class="fn-adcard">
      <div class="ok">结款成功</div>
      <div class="amt disp">+S$${a.amt}</div>
    </div>
    <div class="fn-adlist">
      <div class="fn-kv"><span class="k">收款记录号</span><span class="v">${a.no}</span></div>
      <div class="fn-kv"><span class="k">收款时间</span><span class="v">${a.time}</span></div>
    </div>
    <div class="fn-adlist">
      <div class="h">账单列表</div>
      <div class="fn-kv"><span class="k">账单结算 · ${a.d}</span><span class="v">S$${a.amt} ›</span></div>
    </div>`});
}

// ── 5. 下载账单明细 ──────────────────────────────
const DL_RANGES={'7d':['近七日','2026年06月24日','2026年07月01日'],'month':['本月','2026年07月01日','2026年07月01日'],'3m':['最近3个月','2026年04月01日','2026年07月01日'],'half':['近半年','2026年01月01日','2026年07月01日']};
function openDownload(){
  pushPage({title:'下载账单明细',body:`
    <div class="fn-dl-h">账单日期<span class="tip">最长可选择半年数据</span></div>
    <div class="fn-dl-tabs" id="dtabs">
      <div class="fn-dl-tab on" data-r="7d">近七日</div>
      <div class="fn-dl-tab" data-r="month">本月</div>
      <div class="fn-dl-tab" data-r="3m">最近3个月</div>
      <div class="fn-dl-tab" data-r="half">近半年</div>
    </div>
    <div class="fn-dl-date" id="ddate"></div>
    <div class="fn-dl-h">接收邮箱<span class="tip">最多同时添加5个邮箱</span></div>
    <div class="fn-dl-mail" id="dmail"></div>
    <div class="fn-mailerr" id="derr"></div>
    <div class="fn-add" id="dadd">添加</div>`,
    footer:`<button class="btn primary" id="dok">确定</button>`,
    mount:(p)=>{
      const date=p.querySelector('#ddate');
      const setDate=(r)=>{const v=DL_RANGES[r];date.innerHTML=`<span>${v[1]}</span><span>–</span><span>${v[2]}</span>`;};
      setDate('7d');
      p.querySelectorAll('#dtabs .fn-dl-tab').forEach(t=>t.onclick=()=>{
        p.querySelectorAll('#dtabs .fn-dl-tab').forEach(x=>x.classList.remove('on'));t.classList.add('on');setDate(t.dataset.r);});
      // 邮箱（最多5个）
      const mail=p.querySelector('#dmail'),err=p.querySelector('#derr'),addBtn=p.querySelector('#dadd');
      let mails=['3224002733@qq.com'];
      const reEmail=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      const renderMail=()=>{
        mail.innerHTML=mails.map((m,i)=>`<div class="fn-mail"><div class="ipt"><input data-i="${i}" value="${m}" placeholder="请输入接收邮箱" inputmode="email"></div>${mails.length>1?`<span class="del" data-d="${i}">删除</span>`:''}</div>`).join('');
        mail.querySelectorAll('input').forEach(inp=>inp.oninput=()=>{mails[+inp.dataset.i]=inp.value.trim();validate();});
        mail.querySelectorAll('.del').forEach(d=>d.onclick=()=>{mails.splice(+d.dataset.d,1);renderMail();validate();});
        addBtn.style.display=mails.length>=5?'none':'';
      };
      const validate=()=>{
        const bad=mails.some(m=>m&&!reEmail.test(m));
        const hasEmpty=mails.some(m=>!m);
        mail.querySelectorAll('.fn-mail .ipt').forEach((box,i)=>box.classList.toggle('err',!!mails[i]&&!reEmail.test(mails[i])));
        err.textContent=bad?'存在格式不正确的邮箱':'';
        ok.disabled=bad||hasEmpty;
        return !bad&&!hasEmpty;
      };
      addBtn.onclick=()=>{if(mails.length>=5)return toast('最多添加5个邮箱');mails.push('');renderMail();validate();};
      const ok=p.querySelector('#dok');
      renderMail();validate();
      ok.onclick=()=>{if(!validate())return;ok.classList.add('loading');
        setTimeout(()=>{ok.classList.remove('loading');toast('账单已发送至邮箱');setTimeout(popPage,700);},800);};
    }});
}

// 迷你折线
function spark(){return `<svg class="spark" viewBox="0 0 54 24"><polyline points="1,16 9,10 16,14 23,8 30,12 37,6 44,11 53,9" fill="none" stroke="#2563EB" stroke-width="1.6"/><circle cx="53" cy="9" r="2" fill="#DC2626"/></svg>`;}
function bigSpark(){
  const pts='4,70 30,52 56,60 82,40 108,58 134,30 160,46 186,24 212,40 238,20 264,34 290,18';
  return `<svg viewBox="0 0 300 90" style="width:100%;height:120px"><polyline points="${pts}" fill="none" stroke="#2563EB" stroke-width="2"/><polyline points="${pts} 290,90 4,90" fill="rgba(37,99,235,.08)" stroke="none"/></svg>
    <div style="display:flex;justify-content:space-between;color:var(--sub);font-size:11px;margin-top:4px"><span>04.01</span><span>05.15</span><span>06.30</span></div>`;
}

window.FM_MOD=window.FM_MOD||{};
window.FM_MOD.finance=openFinance;
})();
