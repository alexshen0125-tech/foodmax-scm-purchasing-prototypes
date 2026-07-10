/* Food Max 商家端 v2 · 订单模块（监控视图）
   单据链：订单由 备货单/送货单 驱动，订单页只看状态+详情，不放操作按钮（打码归备货单、交接归送货单）。
   评审修复内建：骨架屏/空态/44px/S$/买家脱敏。数据源=window.FM.DB.orders。 */
(function(){
const {pushPage,popPage,toast,sheet,svg,skel,ordMask,ordIncome,ordCommission,ordPickup,ordInclAmt}=window.FM;
// 演示锚点“今天”=最新订单日期；订单时间筛选按 orderDate(下单日期) 计算
const TODAY='2026-07-01';
function addDays(ymd,delta){const a=ymd.split('-').map(Number);const dt=new Date(a[0],a[1]-1,a[2]);dt.setDate(dt.getDate()+delta);const p=n=>String(n).padStart(2,'0');return `${dt.getFullYear()}-${p(dt.getMonth()+1)}-${p(dt.getDate())}`;}

const css=document.createElement('style');
css.textContent=`
.od-bar{position:sticky;top:0;z-index:6;background:var(--bg);display:flex;padding:8px 8px 12px;}
.od-fl{flex:1;min-height:44px;display:flex;align-items:center;justify-content:center;gap:5px;font-size:14px;font-weight:600;color:#27433A;cursor:pointer;}
.od-fl.on{color:var(--emerald);font-weight:700;}
.od-fl svg{width:14px;height:14px;stroke:currentColor;fill:none;stroke-width:2.4;transition:transform .2s;}
.od-fl.on svg{transform:rotate(180deg);}
.od-list{padding:4px 16px 18px;}
.oc{background:#fff;border-radius:18px;padding:15px 16px;margin-bottom:13px;box-shadow:var(--sh-sm);cursor:pointer;}
.oc .oh{display:flex;align-items:center;justify-content:space-between;padding-bottom:12px;border-bottom:1px solid var(--line);}
.oc .buyer{font-size:16px;font-weight:700;letter-spacing:.5px;}
.oc .st{font-size:14px;font-weight:700;display:flex;align-items:center;gap:6px;}
.oc .st.emerald{color:var(--emerald);}
.oc .st.amber{color:var(--amber);}
.oc .st.mint{color:var(--emerald-2);}
.oc .st.sub{color:var(--sub);}
.oc .st.red{color:var(--red);}
.oc .st .sub2{font-size:10.5px;font-weight:700;color:var(--emerald-2);background:var(--mint-soft);padding:1px 7px;border-radius:20px;}
.oc .meta{padding:11px 0 4px;}
.oc .ml{display:flex;font-size:13px;line-height:1.9;color:#27433A;}
.oc .ml .lk{flex:0 0 64px;color:var(--sub);}
.oc .ml .sg{font-size:9.5px;border:1px solid var(--emerald);color:var(--emerald);padding:0 4px;border-radius:4px;margin-left:6px;vertical-align:1px;}
.oc .it{display:flex;gap:12px;padding-top:11px;}
.oc .it .img{width:56px;height:56px;border-radius:13px;flex:0 0 56px;background:var(--mint-soft);display:flex;align-items:center;justify-content:center;font-size:26px;}
.oc .it .ib{flex:1;min-width:0;}
.oc .it .nm{font-size:15px;font-weight:700;line-height:1.25;}
.oc .it .rw{font-size:13px;color:#46604F;margin-top:5px;}
.oc .it .rw b{font-weight:600;color:var(--ink);}
.oc .foot{display:flex;align-items:baseline;justify-content:space-between;gap:14px;margin-top:13px;padding-top:12px;border-top:1px solid var(--line);font-size:13px;color:var(--sub);}
.oc .foot .inc{font-size:13px;color:#27433A;}
.oc .foot .inc b{font-size:18px;font-weight:600;color:var(--emerald-2);margin-left:3px;}
/* 订单详情 */
.odd-head{background:var(--mint-soft);padding:16px;margin:0 0 4px;}
.odd-head .buyer{font-size:20px;font-weight:800;}
.odd-head .st{font-size:13.5px;font-weight:700;margin-top:4px;}
.odd-sec{font-size:14px;font-weight:700;margin:16px 16px 8px;}
.odd-card{background:#fff;border-radius:16px;margin:0 16px;box-shadow:var(--sh-sm);overflow:hidden;}
.odd-row{display:flex;justify-content:space-between;padding:12px 15px;font-size:13.5px;color:#27433A;}
.odd-row+.odd-row{border-top:1px solid var(--line);}
.odd-row .k{color:var(--sub);}
.odd-line{display:flex;justify-content:space-between;padding:12px 15px;font-size:13.5px;}
.odd-line+.odd-line{border-top:1px solid var(--line);}
.odd-line .nm{font-weight:700;}
.odd-line .qp{color:var(--sub);font-size:12px;margin-top:2px;}
.odd-line .amt{font-weight:600;font-family:'Lora',serif;}
.odd-tl{display:flex;padding:14px 16px 6px;}
.odd-tl .n{flex:1;text-align:center;font-size:11.5px;color:var(--sub);position:relative;}
.odd-tl .n .dot{width:11px;height:11px;border-radius:50%;background:var(--line);margin:0 auto 6px;}
.odd-tl .n.on{color:var(--emerald);font-weight:700;}
.odd-tl .n.on .dot{background:var(--emerald);}
.odd-tl .n:not(:last-child)::after{content:"";position:absolute;top:5px;left:60%;width:80%;height:2px;background:var(--line);}
.odd-tl .n.on:not(:last-child)::after{background:var(--emerald);}
/* 订单时间·自定义区间 */
.dr-fld{display:flex;align-items:center;justify-content:space-between;gap:12px;background:#fff;border-radius:14px;padding:15px 16px;margin-bottom:12px;box-shadow:var(--sh-sm);}
.dr-fld .dl{font-size:14.5px;font-weight:600;color:#27433A;flex:0 0 auto;}
.dr-fld input[type=date]{border:none;background:transparent;font-size:14.5px;font-family:inherit;color:var(--emerald-2);font-weight:600;text-align:right;min-width:0;}
.dr-quick{display:flex;gap:8px;flex-wrap:wrap;margin:2px 0 14px;}
.dr-quick .q{padding:8px 14px;border-radius:20px;background:var(--muted);font-size:13px;font-weight:600;color:#27433A;cursor:pointer;}
.dr-hint{font-size:12.5px;min-height:16px;color:var(--red);}
`;
document.head.appendChild(css);

const ICON={'小棠菜':'🥬','白菜':'🥬','空心菜':'🥬','菠菜':'🥬'};
const STMAP={pending:'待发货',packed:'待发货',shipped:'备货中',received:'已收货',done:'已完成',canceled:'已取消'};
const STCLASS={'待发货':'emerald','备货中':'amber','已收货':'mint','已完成':'sub','已取消':'red'};
const TABS=[
  {k:'send',label:'待发货',match:o=>o.status==='pending'||o.status==='packed'},
  {k:'recv',label:'备货中',match:o=>o.status==='shipped'},
  {k:'got',label:'已收货',match:o=>o.status==='received'},
  {k:'done',label:'已完成',match:o=>o.status==='done'},
  {k:'cancel',label:'已取消',match:o=>o.status==='canceled'},
];
function listOf(k){const t=TABS.find(x=>x.k===k);return (window.FM.DB.orders||[]).filter(t.match);}

function card(o){
  const st=STMAP[o.status]||'待发货';
  const l0=o.lines[0]||{};
  return `<div class="oc" data-id="${o.id}">
    <div class="oh"><span class="buyer">${ordMask(o.client)}</span>
      <span class="st ${STCLASS[st]}">${st}${o.status==='packed'?'<span class="sub2">已贴标</span>':''}</span></div>
    <div class="meta">
      <div class="ml"><span class="lk">订单号</span><span style="font-family:monospace">${o.id}</span></div>
      <div class="ml"><span class="lk">下单时间</span><span>${o.orderDate||'—'}</span></div>
      <div class="ml"><span class="lk">送达时间</span><span>${o.deliver} ${o.window}</span></div>
      <div class="ml"><span class="lk">入库仓库</span><span>${o.warehouse}<i class="sg">SG仓</i></span></div>
    </div>
    <div class="it"><div class="img">${ICON[l0.name]||'📦'}</div>
      <div class="ib"><div class="nm">${l0.name} ${l0.qty}${l0.unit}</div>
        <div class="rw">单价 <b>S$${(l0.price||0).toFixed(2)}/${l0.unit}</b></div>
        ${o.lines.length>1?`<div class="rw">等 ${o.lines.length} 种商品</div>`:''}
      </div></div>
    <div class="foot"><span>共 ${o.lines.length} 种商品 · 订单金额 S$${o.amt.toFixed(2)}</span><span class="inc">预计收入<b class="disp">S$${ordIncome(o).toFixed(2)}</b></span></div>
  </div>`;
}

function openDetail(o){
  const st=STMAP[o.status]||'待发货';
  const steps=['待发货','备货中','已收货','已完成'];
  const cur=Math.max(0,steps.indexOf(st==='已取消'?'待发货':st));
  // 上游动作（客户取消/收货/订单完成/发起售后）不在订单列表行，挪进详情做“演示模拟”
  const foot=o.status==='pending'
    ?`<button class="btn" style="width:100%;background:var(--muted);color:var(--red)" onclick="od_cancel('${o.id}')">🔬 演示：模拟客户取消</button>`
    :o.status==='shipped'
    ?`<button class="btn" style="width:100%;background:var(--muted);color:#46604F" onclick="od_receive('${o.id}')">🔬 演示：模拟客户收货</button>`
    :o.status==='received'
    ?`<div style="display:flex;gap:12px"><button class="btn ghost" style="flex:1" onclick="od_after('${o.id}')">发起售后</button><button class="btn" style="flex:1;background:var(--muted);color:#46604F" onclick="od_done('${o.id}')">🔬 演示：模拟订单完成</button></div>`
    :'';
  pushPage({title:'订单详情',...(foot?{footer:foot}:{}),body:`
    <div class="odd-head"><div class="buyer">${ordMask(o.client)}</div>
      <div class="st" style="color:var(--${STCLASS[st]==='emerald'?'emerald':STCLASS[st]==='amber'?'amber':STCLASS[st]==='red'?'red':'sub'})">${st}${o.status==='packed'?' · 已贴标待交接':''}</div></div>
    <div class="odd-tl">${steps.map((s,i)=>`<div class="n ${i<=cur&&o.status!=='canceled'?'on':''}"><div class="dot"></div>${s}</div>`).join('')}</div>
    <div class="odd-sec">商品明细</div>
    <div class="odd-card">${o.lines.map(l=>`<div class="odd-line"><div><div class="nm">${l.name}</div><div class="qp">S$${l.price.toFixed(2)}/${l.unit}</div></div><div class="amt">${l.qty}${l.unit}</div></div>`).join('')}</div>
    <div class="odd-sec">配送信息</div>
    <div class="odd-card">
      <div class="odd-row"><span class="k">订单号</span><span style="font-family:monospace">${o.id}</span></div>
      <div class="odd-row"><span class="k">预计送达日</span><span>${o.deliver}</span></div>
      <div class="odd-row"><span class="k">送达时段</span><span>${o.window}</span></div>
      <div class="odd-row"><span class="k">入库仓库</span><span>${o.warehouse}</span></div>
      ${o.pickId?`<div class="odd-row"><span class="k">备货单</span><span style="font-family:monospace">${o.pickId}</span></div>`:''}
      ${o.deliveryId?`<div class="odd-row"><span class="k">送货单</span><span style="font-family:monospace">${o.deliveryId}</span></div>`:''}
    </div>
    <div class="odd-sec">金额（预估，以订单完成为准）</div>
    <div class="odd-card">
      <div class="odd-row"><span class="k">订单金额(未税)</span><span>S$${o.amt.toFixed(2)}</span></div>
      <div class="odd-row"><span class="k">含税金额</span><span>S$${ordInclAmt(o).toFixed(2)}</span></div>
      <div class="odd-row"><span class="k">商家补贴</span><span style="color:var(--red)">-S$${(o.discount||0).toFixed(2)}</span></div>
      <div class="odd-row"><span class="k">商品佣金(含税×服务费率)</span><span style="color:var(--red)">-S$${ordCommission(o).toFixed(2)}</span></div>
      <div class="odd-row"><span class="k">上门揽收费(固定)</span><span style="color:var(--red)">-S$${ordPickup(o).toFixed(2)}</span></div>
      <div class="odd-row" style="font-weight:700"><span>预计收入(预估)</span><span style="color:var(--emerald-2)">S$${ordIncome(o).toFixed(2)}</span></div>
    </div>
    <div style="height:16px"></div>`});
}
// 演示：上游动作模拟（客户收货 shipped→received、订单完成 received→done；发起售后=客户端动作占位）。改状态后重开详情反映变化。
window.od_receive=function(id){const o=(window.FM.DB.orders||[]).find(x=>x.id===id);if(!o)return;o.status='received';toast('客户已收货','ok');window.FM.popPage();openDetail(o);};
window.od_done=function(id){const o=(window.FM.DB.orders||[]).find(x=>x.id===id);if(!o)return;o.status='done';o.doneDate='07-02';toast('订单已完成（完成后 3 天结算）','info');window.FM.popPage();openDetail(o);};
window.od_after=function(id){toast('发起售后为客户端动作，此处演示占位','info');};
// 演示：客户在待发货取消（BR-24）→ 整单退款 + 备货单该单移除(SKU应备量实时扣减)，备货单空则作废
window.od_cancel=function(id){const o=(window.FM.DB.orders||[]).find(x=>x.id===id);if(!o||o.status!=='pending')return;
  window.FM.confirmDialog({title:'模拟客户取消',danger:1,body:`客户在待发货取消 ${o.id}，整单取消并全额退款 S$${o.amt.toFixed(2)}；该单从备货单移除、SKU 应备量实时扣减，备货单若无单则作废。`,okText:'确认取消并退款',onOk:()=>{const pk=window.FM.cancelOrder(id);toast('已取消，全额退款'+(pk&&pk.status==='已作废'?'；备货单 '+pk.id+' 已作废':''),'ok');window.FM.popPage();openDetail(o);}});};

function renderList(container,inTab){
  container.innerHTML=`
    ${inTab?`<div class="hm-top" style="padding:14px 20px 4px"><div class="hm-store"><div class="nm disp" style="font-size:24px">订单</div></div><div class="hm-bell">${svg('search')}</div></div>`:''}
    <div class="od-bar">
      <div class="od-fl on" data-f="status">订单状态${svg('back','style="transform:rotate(-90deg)"')}</div>
      <div class="od-fl" data-f="time">订单时间${svg('back','style="transform:rotate(-90deg)"')}</div>
      <div class="od-fl" data-f="wh">全部仓库${svg('back','style="transform:rotate(-90deg)"')}</div>
    </div>
    <div class="od-list" id="ol"></div>`;
  const list=container.querySelector('#ol');
  const statusFl=container.querySelector('[data-f="status"]');
  const timeFl=container.querySelector('[data-f="time"]');
  const whFl=container.querySelector('[data-f="wh"]');
  const state={statusK:'send',date:{type:'all'}};

  // 订单时间筛选：按 orderDate(下单日期) 命中，与订单状态 tab 叠加生效
  const matchDate=(o)=>{const f=state.date;if(f.type==='all')return true;const d=o.orderDate||'';if(!d)return false;
    if(f.type==='today')return d===TODAY;
    if(f.type==='range')return (!f.from||d>=f.from)&&(!f.to||d<=f.to);
    return true;};
  const dataNow=()=>listOf(state.statusK).filter(matchDate);

  const paintList=()=>{
    const t=TABS.find(x=>x.k===state.statusK),data=dataNow();
    if(!data.length){const noDate=state.date.type==='all';list.innerHTML=`<div class="empty"><div class="ei">${svg('receipt')}</div><h4>暂无${t.label}订单</h4><p>${noDate?'该状态下还没有订单，换个筛选条件看看':'当前时间范围内没有'+t.label+'订单，换个时间试试'}</p></div>`;return;}
    list.innerHTML=data.map(card).join('');
    list.querySelectorAll('.oc').forEach(c=>c.onclick=()=>openDetail(data.find(o=>o.id===c.dataset.id)));
  };
  const draw=()=>{list.innerHTML=skel(3);setTimeout(paintList,300);};

  // 订单状态：sheet 计数已叠加当前时间筛选
  statusFl.onclick=()=>sheet(TABS.map(t=>({label:`${t.label}（${listOf(t.k).filter(matchDate).length}）`,onClick:()=>{state.statusK=t.k;statusFl.firstChild.textContent=t.label;draw();}})));

  // 订单时间：预设区间 + 自定义
  const setTime=(type,label,extra)=>{state.date=Object.assign({type},extra||{});timeFl.firstChild.textContent=label;timeFl.classList.toggle('on',type!=='all');draw();};
  timeFl.onclick=()=>sheet([
    {label:'全部时间',onClick:()=>setTime('all','订单时间')},
    {label:`今天（${TODAY}）`,onClick:()=>setTime('today','今天')},
    {label:'近 7 天',onClick:()=>setTime('range','近7天',{from:addDays(TODAY,-6),to:TODAY})},
    {label:'近 30 天',onClick:()=>setTime('range','近30天',{from:addDays(TODAY,-29),to:TODAY})},
    {label:'自定义日期区间…',onClick:()=>openDateRange(setTime)},
  ]);

  whFl.onclick=()=>toast('选择入库仓库');
  draw();
}

// 自定义日期区间：两个原生 date 输入 + 快捷区间，确定后回填筛选
function openDateRange(setTime){
  const dFrom=addDays(TODAY,-6),dTo=TODAY;
  pushPage({title:'自定义日期区间',body:`
    <div style="padding:18px 16px">
      <div class="dr-quick" id="dr-quick">
        <span class="q" data-d="0">今天</span><span class="q" data-d="6">近7天</span><span class="q" data-d="29">近30天</span><span class="q" data-d="89">近90天</span>
      </div>
      <div class="dr-fld"><span class="dl">开始日期</span><input type="date" id="dr-from" value="${dFrom}" max="${TODAY}"></div>
      <div class="dr-fld"><span class="dl">结束日期</span><input type="date" id="dr-to" value="${dTo}" max="${TODAY}"></div>
      <div class="dr-hint" id="dr-hint"></div>
    </div>`,
    footer:`<button class="btn primary" id="dr-ok" style="width:100%">确定</button>`,
    mount:(p)=>{
      const from=p.querySelector('#dr-from'),to=p.querySelector('#dr-to'),ok=p.querySelector('#dr-ok'),hint=p.querySelector('#dr-hint');
      const chk=()=>{const bad=from.value&&to.value&&from.value>to.value;hint.textContent=bad?'开始日期不能晚于结束日期':'';ok.disabled=bad;ok.style.opacity=bad?'.5':'';};
      from.onchange=chk;to.onchange=chk;
      p.querySelectorAll('#dr-quick .q').forEach(q=>q.onclick=()=>{to.value=TODAY;from.value=addDays(TODAY,-parseInt(q.dataset.d));chk();});
      chk();
      ok.onclick=()=>{if(ok.disabled)return;const f=from.value,t=to.value;if(!f||!t){toast('请选择完整日期区间');return;}popPage();setTime('range',f===t?f:`${f}~${t}`,{from:f,to:t});};
    }});
}

function openOrderPush(){pushPage({title:'订单列表',body:'<div id="op"></div>',mount:(p)=>renderList(p.querySelector('#op'),false)});}

window.FM_MOD=window.FM_MOD||{};
window.FM_MOD.order=openOrderPush;                         // 金刚区入口
window.FM_MOD.orderInline=(c)=>renderList(c,true);         // 底部「订单」Tab
})();
