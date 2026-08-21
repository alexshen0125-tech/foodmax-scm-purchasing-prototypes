/* Food Max 商家端 v2 · 消息中心（二期）
   依据：采购/merchant management/PRD/scm_商家端消息中心_功能框架.md v1.0
   与一期线上实现对齐：站内信服务端真源（/notification/page|unread-count|read|read-all）、
   分类 Tab 由枚举派生、只看未读 + 关键词搜索走服务端、跳转过路由白名单。
   本期新增：6 分类、L1~L4 强度分档、聚合卡、硬时效倒计时与催办、消息设置（偏好 + 静默时段）。
   PC 同源：pc-modules/message.js（字段/枚举/规则一致，交互形态按端适配）*/
(function(){
const {pushPage,toast,svg,skel,cdSpan}=window.FM;

const css=document.createElement('style');
css.textContent=`
/* 顶部操作条 */
.mg-top{display:flex;align-items:center;gap:10px;padding:12px 16px 2px;background:var(--bg);}
.mg-top .un{flex:1;font-size:13.5px;color:var(--sub);}
.mg-top .un b{color:var(--red);font-weight:800;}
.mg-top .op{min-height:44px;display:flex;align-items:center;gap:5px;font-size:13.5px;font-weight:700;color:var(--emerald-2);cursor:pointer;flex:0 0 auto;}
.mg-top .op.off{color:#B6C4BC;cursor:default;}
.mg-top .op svg{width:16px;height:16px;stroke:currentColor;fill:none;stroke-width:2;}
/* 通知权限黄条 */
.mg-notify{display:flex;align-items:center;gap:10px;background:var(--amber-soft);color:#92400E;padding:13px 16px;font-size:13.5px;font-weight:600;}
.mg-notify .nt-txt{flex:1;line-height:1.4;}
.mg-notify .nt-go{background:#2563EB;color:#fff;font-size:13.5px;font-weight:700;border-radius:9px;padding:0 14px;min-height:34px;display:flex;align-items:center;cursor:pointer;flex:0 0 auto;}
.mg-notify .nt-x{width:34px;height:34px;display:flex;align-items:center;justify-content:center;font-size:18px;color:#92400E;cursor:pointer;flex:0 0 auto;}
/* 搜索 + 只看未读 */
.mg-bar{position:sticky;top:0;z-index:6;background:var(--bg);padding:8px 16px 4px;display:flex;align-items:center;gap:12px;}
.mg-search{flex:1;display:flex;align-items:center;gap:9px;background:#fff;border-radius:15px;min-height:44px;padding:0 14px;box-shadow:var(--sh-sm);color:var(--sub);font-size:14px;}
.mg-search svg{width:18px;height:18px;stroke:var(--sub);fill:none;stroke-width:2;flex:0 0 18px;}
.mg-search input{flex:1;border:0;outline:0;font-family:inherit;font-size:14px;color:var(--ink);background:transparent;min-width:0;}
.mg-unread{display:flex;align-items:center;gap:6px;min-height:44px;font-size:14px;font-weight:600;color:#27433A;cursor:pointer;flex:0 0 auto;}
.mg-unread .rc{width:18px;height:18px;border-radius:50%;border:2px solid #CBD5C7;display:flex;align-items:center;justify-content:center;flex:0 0 18px;}
.mg-unread.on .rc{background:var(--emerald);border-color:var(--emerald);}
.mg-unread.on .rc::after{content:"✓";color:#fff;font-size:11px;font-weight:700;}
.mg-unread.on{color:var(--emerald-2);}
/* 分类 Tab(横滑，由枚举派生) */
.mg-tabs{display:flex;gap:18px;padding:8px 16px 0;overflow-x:auto;background:var(--bg);border-bottom:1px solid var(--line);}
.mg-tabs::-webkit-scrollbar{display:none;}
.mg-tab{flex:0 0 auto;font-size:15px;color:#46604F;padding:8px 0 12px;position:relative;cursor:pointer;min-height:44px;display:flex;align-items:center;gap:5px;}
.mg-tab.on{color:var(--emerald-2);font-weight:700;}
.mg-tab .cnt{font-size:11.5px;font-weight:800;color:#fff;background:var(--red);border-radius:9px;padding:1px 5px;min-width:17px;text-align:center;}
.mg-tab.on::after{content:"";position:absolute;left:0;right:0;bottom:6px;margin:auto;width:22px;height:3px;border-radius:3px;background:var(--emerald);}
/* 消息卡片 */
.mg-list{padding:6px 16px 18px;}
.mg-item{background:#fff;border-radius:16px;padding:14px 15px 14px 17px;margin-top:12px;box-shadow:var(--sh-sm);cursor:pointer;position:relative;overflow:hidden;}
.mg-item::before{content:"";position:absolute;left:0;top:0;bottom:0;width:4px;background:#CBD5C7;}
.mg-item.L1::before{background:var(--red);}
.mg-item.L2::before{background:var(--amber);}
.mg-item.L3::before{background:#CBD5C7;}
.mg-item.L4::before{background:#2563EB;}
.mg-item.read{opacity:.72;}
.mg-item .hd{display:flex;align-items:center;gap:7px;}
.mg-item .dot{width:8px;height:8px;border-radius:50%;background:var(--red);flex:0 0 8px;}
.mg-item .ic{width:26px;height:26px;border-radius:8px;background:var(--muted);display:flex;align-items:center;justify-content:center;flex:0 0 26px;}
.mg-item .ic svg{width:15px;height:15px;stroke:var(--emerald-2);fill:none;stroke-width:1.9;}
.mg-item .ti{font-size:15px;font-weight:700;color:var(--ink);flex:1;min-width:0;line-height:1.35;}
.mg-item .tm{font-size:12px;color:var(--sub);flex:0 0 auto;}
.mg-item .bd{font-size:13.5px;color:#46604F;line-height:1.6;margin-top:8px;}
.mg-item .lvt{display:inline-block;font-size:11px;font-weight:800;border-radius:6px;padding:2px 6px;margin-right:6px;vertical-align:1px;}
.lvt.L1{background:var(--red-soft);color:#B91C1C;}
.lvt.L2{background:var(--amber-soft);color:#92400E;}
.lvt.L3{background:#EEF2F0;color:#5B6B62;}
.lvt.L4{background:#E0EAFE;color:#1D4ED8;}
/* 关联信息行：文本 + <b> 混排，禁 flex（会断词错行） */
.mg-item .rel{font-size:12.5px;color:var(--sub);margin-top:9px;line-height:1.7;}
.mg-item .rel .kv{margin-right:12px;}
.mg-item .rel .mono{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;color:#27433A;}
.mg-item .cdw{color:#B91C1C;font-weight:800;}
.mg-item .cdw b{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;}
/* 聚合卡展开 */
.mg-item .agg{margin-top:10px;border-top:1px dashed var(--line);padding-top:9px;font-size:13px;color:#46604F;}
.mg-item .agg .row{padding:5px 0;display:flex;justify-content:space-between;gap:10px;}
.mg-item .agg .row span:last-child{color:var(--sub);flex:0 0 auto;}
.mg-item .more{margin-top:9px;font-size:13px;font-weight:700;color:var(--emerald-2);}
/* 底部动作 */
.mg-item .act{margin-top:11px;display:flex;align-items:center;gap:10px;}
.mg-item .go{flex:1;min-height:38px;border-radius:11px;background:var(--emerald);color:#fff;font-size:13.5px;font-weight:700;display:flex;align-items:center;justify-content:center;}
.mg-item .go.ghost{background:#fff;color:var(--emerald-2);border:1px solid var(--emerald);}
.mg-nomore{text-align:center;color:var(--sub);font-size:12.5px;padding:18px 0 4px;}
/* 消息设置 */
.mp-sec{background:#fff;border-radius:16px;margin:12px 16px;box-shadow:var(--sh-sm);overflow:hidden;}
.mp-sec .st{font-size:12.5px;font-weight:800;color:var(--sub);letter-spacing:.4px;padding:13px 15px 6px;}
.mp-row{display:flex;align-items:center;gap:12px;padding:12px 15px;border-top:1px solid var(--line);}
.mp-row:first-of-type{border-top:0;}
.mp-row .l{flex:1;min-width:0;}
.mp-row .l .n{font-size:14.5px;font-weight:700;color:var(--ink);}
.mp-row .l .s{font-size:12px;color:var(--sub);margin-top:3px;line-height:1.5;}
.mp-sw{width:46px;height:27px;border-radius:14px;background:#D8E3DC;position:relative;flex:0 0 46px;cursor:pointer;transition:background .18s;}
.mp-sw::after{content:"";position:absolute;top:3px;left:3px;width:21px;height:21px;border-radius:50%;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.2);transition:transform .18s;}
.mp-sw.on{background:var(--emerald);}
.mp-sw.on::after{transform:translateX(19px);}
.mp-sw.lock{background:#E7EDE9;cursor:not-allowed;}
.mp-sw.lock::after{background:#F6F9F7;}
.mp-lock{font-size:11.5px;font-weight:800;color:#B91C1C;background:var(--red-soft);border-radius:6px;padding:2px 7px;flex:0 0 auto;}
`;
document.head.appendChild(css);

/* ── 枚举（与 contracts/notification.ts 同源命名，本期扩展）────────────── */
const CATS=[
  {k:'ALL',        n:'全部'},
  {k:'FULFILLMENT',n:'履约待办', ic:'truck'},
  {k:'DISPUTE',    n:'差异与售后', ic:'refund'},
  {k:'CATALOG',    n:'商品与库存', ic:'box'},
  {k:'FINANCE',    n:'结算与票据', ic:'wallet'},
  {k:'COMPLIANCE', n:'合规与账号', ic:'shieldcheck'},
  {k:'ANNOUNCEMENT',n:'公告与培训', ic:'mega'},
];
const LV={L1:'必达',L2:'待办',L3:'告知',L4:'公告'};
const catOf=k=>CATS.find(c=>c.k===k)||CATS[0];
const H=n=>Date.now()+n*3600000;

/* ── 站内消息（服务端真源的 mock；字段名对齐 NotificationItem）───────── */
const MSGS=[
 {id:'M001',cat:'FULFILLMENT',ev:'DELIVERY_SIGN_FAILED',lv:'L1',read:0,tm:'08-21 06:12',
  t:'签到失败 · 请到仓后重新签到',b:'平台 2 次致电均未接通，本次到仓签到未成功。请到仓后在 App 重新发起签到，否则本车货品无法进入交接。',
  rel:[['送货单','SH20260821003'],['仓库','裕廊DC']],go:'去重新签到',ch:'站内信 · Push · WhatsApp'},
 {id:'M002',cat:'FULFILLMENT',ev:'DELIVERY_APPOINT_DUE',lv:'L1',read:0,tm:'08-21 05:40',dl:H(0.9),
  t:'预约时段临近 · 尚未签到',b:'你的送货单预约到仓时段即将开始，目前尚未签到。逾期未到仓将占用仓库月台并影响后续接单。',
  rel:[['送货单','SH20260821005'],['预约时段','08:00~10:00']],go:'去签到',ch:'站内信 · Push'},
 {id:'M003',cat:'DISPUTE',ev:'RETURN_PICKUP_URGENT',lv:'L1',read:0,tm:'08-21 09:00',dl:H(23.4),
  t:'退货提货倒计时告急 · 剩 24 小时',b:'退货商品已到仓待提，超时未提货平台将按规则自行处置，货值不再返还。',
  rel:[['退货单','RT20260819007'],['仓库','兀兰DC'],['件数','12 件']],go:'去查看退货单',ch:'站内信 · Push · WhatsApp'},
 {id:'M004',cat:'DISPUTE',ev:'AFTERSALE_APPEAL_DUE',lv:'L1',read:0,tm:'08-21 08:30',dl:H(5.6),
  t:'申诉窗口 6 小时后关闭',b:'该售后单判定为商家责，你尚未提交申诉。窗口关闭后判责结果生效并进入清分，不可再申诉。',
  rel:[['售后单','KS20260820011'],['判责方','商家责'],['扣款','S$86.40']],go:'去申诉',ch:'站内信 · Push'},
 {id:'M005',cat:'DISPUTE',ev:'AFTERSALE_JUDGED',lv:'L1',read:1,tm:'08-20 17:05',
  t:'售后判责结果 · 判定商家责',b:'客诉「到货腐烂」经平台核实，判定为商家责，扣款将在本期结算中体现。如有异议请在 24 小时内申诉。',
  rel:[['售后单','KS20260820011'],['客诉类型','品质问题']],go:'去查看判责详情',ch:'站内信 · Push'},
 {id:'M006',cat:'FINANCE',ev:'PAYMENT_FAILED',lv:'L1',read:0,tm:'08-20 15:22',dl:H(58),
  t:'打款失败 · 请更新收款账户',b:'本期货款打款失败，原因：收款户名与营业执照主体不一致。请在 3 个工作日内更新账户信息，逾期本期货款顺延至下期。',
  rel:[['结算单','ST20260815B'],['金额','S$9,820.00'],['失败原因','户名不一致']],go:'去更新收款账户',ch:'站内信 · Push · WhatsApp · 邮件'},
 {id:'M007',cat:'FINANCE',ev:'RECON_GENERATED',lv:'L1',read:0,tm:'08-20 08:00',dl:H(96),
  t:'对账单已生成 · 待核对',b:'2026-08-11 ~ 08-17 的对账单已生成，请在 5 个工作日内完成核对。逾期未确认视为认可平台数据。',
  rel:[['对账单','RC20260817'],['应结金额','S$12,486.30']],go:'去核对',ch:'站内信 · Push · 邮件'},
 {id:'M008',cat:'FINANCE',ev:'RECON_DUE_SOON',lv:'L1',read:0,tm:'08-21 08:00',dl:H(22),
  t:'对账核对期限告急 · 剩 1 天',b:'上一期对账单你尚未确认，明日 23:59 后系统将按平台数据自动确认。',
  rel:[['对账单','RC20260810'],['差异项','2 项']],go:'去核对',ch:'站内信 · Push'},
 {id:'M009',cat:'FINANCE',ev:'SETTLEMENT_GENERATED',lv:'L1',read:0,tm:'08-19 08:00',
  t:'结算单已生成 · 待确认',b:'本期结算单已生成，确认后进入平台复核并安排打款。',
  rel:[['结算单','ST20260818A'],['结算金额','S$8,640.00']],go:'去确认结算单',ch:'站内信 · Push · 邮件'},
 {id:'M010',cat:'CATALOG',ev:'SKU_SOLDOUT_SHARED_POOL',lv:'L2',read:0,tm:'08-21 07:15',
  t:'寄售商品已售罄 · 同商品其他规格出货所致',b:'白菜（500g 装）可售已为 0。寄售同一商品的各规格共享同一批到仓货物，其他规格出货会同步扣减本规格可售数量——不是系统异常。需要恢复售卖请预约送货补货。',
  rel:[['SKU','SKU8802'],['供货模式','寄售'],['可售','0']],go:'去预约送货',ch:'站内信 · Push'},
 {id:'M011',cat:'CATALOG',ev:'SKU_SOLDOUT',lv:'L2',read:0,tm:'08-21 06:50',
  t:'售完即止商品已售罄 · 需手动补库存',b:'该商品库存模式为「售完即止」，售罄后不会自动回补，将持续处于下架状态。',
  rel:[['SKU','SKU8826'],['库存模式','售完即止'],['可售','0']],go:'去改库存',ch:'站内信 · Push'},
 {id:'M012',cat:'FULFILLMENT',ev:'ORDER_DAILY_SUMMARY',lv:'L2',read:0,tm:'08-21 06:00',
  t:'今日新订单 12 单 · 已截单',b:'平台已截单，今日订单不再变动，可开始备货。',
  agg:{c:12,items:[['海底捞（新加坡）','4 单 · S$886.00'],['食为天餐厅','3 单 · S$512.50'],['丰盛轩','3 单 · S$421.00'],['新味坊','2 单 · S$268.00']]},
  rel:[['送达日','08-22'],['合计','S$2,087.50']],go:'去看订单',ch:'站内信 · Push'},
 {id:'M013',cat:'FULFILLMENT',ev:'LABEL_PENDING',lv:'L2',read:0,tm:'08-21 06:05',
  t:'8 个订单待打标 · 距送达日不足 1 天',b:'打印首张标签后系统会按仓自动生成送货单。',
  agg:{c:8,items:[['裕廊DC','5 单'],['兀兰DC','2 单'],['盛港DC','1 单']]},
  rel:[['送达日','08-22']],go:'去打印标签',ch:'站内信 · Push'},
 {id:'M014',cat:'CATALOG',ev:'SKU_SOLDOUT_DAILY_RESET',lv:'L3',read:0,tm:'08-20 23:00',
  t:'今日 6 个 SKU 售罄 · 次日自动回补',b:'以下商品库存模式为「每日恢复初始库存」，次日 00:00 自动回补，无需处理。',
  agg:{c:6,items:[['小棠菜 SKU8801','初始 120 件'],['菠菜 SKU8803','初始 80 件'],['空心菜 SKU8804','初始 60 件'],['生菜 SKU8807','初始 45 件']]},
  rel:[['库存模式','每日恢复']],go:'',ch:'站内信'},
 {id:'M015',cat:'CATALOG',ev:'EXPORT_READY',lv:'L3',read:0,tm:'08-20 21:12',
  t:'库存导出已就绪 · 可下载',b:'你导出的库存明细共 8,240 行已生成完成，下载链接 7 天内有效。',
  rel:[['导出内容','库存明细'],['行数','8,240']],go:'去下载',ch:'站内信'},
 {id:'M016',cat:'FULFILLMENT',ev:'ORDER_COMPLETED',lv:'L3',read:1,tm:'08-20 20:30',
  t:'今日 23 单已完成',b:'客户已签收，货款进入本期对账。',
  agg:{c:23,items:[['08-20 送达批次','23 单 · S$4,120.60']]},
  rel:[['送达日','08-20']],go:'',ch:'站内信'},
 {id:'M017',cat:'COMPLIANCE',ev:'LOGIN_ACCOUNT_CHANGED',lv:'L1',read:1,tm:'08-19 11:02',
  t:'登录邮箱已变更',b:'你的登录邮箱已变更为 ops@***.sg。若非本人操作，请立即联系平台客服冻结账号。',
  rel:[['变更项','登录邮箱'],['操作时间','2026-08-19 11:02']],go:'',ch:'邮件 · 站内信'},
 {id:'M018',cat:'FINANCE',ev:'PAYMENT_SUCCESS',lv:'L2',read:1,tm:'08-18 16:40',
  t:'货款已到账 S$9,820.00',b:'本期货款已打款成功，请注意查收。',
  rel:[['结算单','ST20260811A'],['到账银行','DBS ****4192'],['流水号','TXN20260818K']],go:'去看结算单',ch:'站内信 · Push · 邮件'},
 {id:'M019',cat:'ANNOUNCEMENT',ev:'PLATFORM_ANNOUNCEMENT',lv:'L4',read:1,tm:'08-15 10:00',
  t:'国庆假期配送与揽收安排',b:'08-09 国庆当日仓库正常收货，配送时段调整为 06:00~12:00，请提前安排备货与送货预约。',
  rel:[['生效日','2026-08-09']],go:'',ch:'站内信 · Push'},
];

const state={tab:'ALL',unreadOnly:false,kw:'',expand:{}};
const PREF={
  FULFILLMENT:{push:1},DISPUTE:{push:1},CATALOG:{push:1},
  FINANCE:{push:1},COMPLIANCE:{push:1},ANNOUNCEMENT:{push:0},
  quiet:1,
};

const unreadCount=()=>MSGS.filter(m=>!m.read).length;
const badgeTxt=n=>n>99?'99+':''+n;
window.FM_MSG_UNREAD=unreadCount;

function visible(){
  return MSGS.filter(m=>{
    if(state.tab!=='ALL'&&m.cat!==state.tab)return false;
    if(state.unreadOnly&&m.read)return false;
    if(state.kw){
      const k=state.kw.toLowerCase();
      const hay=(m.t+m.b+m.rel.map(r=>r[1]).join('')).toLowerCase();
      if(hay.indexOf(k)<0)return false;
    }
    return true;
  });
}

function itemHTML(m){
  const c=catOf(m.cat);
  const rel=m.rel.map(([k,v])=>`<span class="kv">${k}：<span class="mono">${v}</span></span>`).join('')
    +(m.dl?`<span class="cdw">剩余 ${cdSpan(m.dl)}</span>`:'');
  const agg=m.agg?(state.expand[m.id]
      ?`<div class="agg">${m.agg.items.map(([a,b])=>`<div class="row"><span>${a}</span><span>${b}</span></div>`).join('')}
         ${m.agg.items.length<m.agg.c?`<div class="row"><span style="color:var(--sub)">其余 ${m.agg.c-m.agg.items.length} 条…</span><span></span></div>`:''}</div>`
      :`<div class="more" data-x="${m.id}">展开 ${m.agg.c} 条明细 ›</div>`):'';
  return `<div class="mg-item ${m.lv}${m.read?' read':''}" data-id="${m.id}">
    <div class="hd">${m.read?'':'<span class="dot"></span>'}<span class="ic">${svg(c.ic||'bell')}</span>
      <span class="ti">${m.t}</span><span class="tm">${m.tm}</span></div>
    <div class="bd"><span class="lvt ${m.lv}">${LV[m.lv]}</span>${m.b}</div>
    <div class="rel">${rel}</div>
    ${agg}
    ${m.go?`<div class="act"><span class="go${m.lv==='L3'||m.lv==='L4'?' ghost':''}" data-go="${m.id}">${m.go}</span></div>`:''}
  </div>`;
}

function renderMsgCenter(root){
  root.innerHTML=`
    <div class="mg-top">
      <span class="un">未读 <b id="mg-un">${badgeTxt(unreadCount())}</b> 条</span>
      <span class="op" id="mg-pref">${svg('shieldcheck')}消息设置</span>
      <span class="op" id="mg-all">${svg('sign')}全部已读</span>
    </div>
    <div class="mg-notify" id="mg-nt">
      <span class="nt-txt">系统通知未开启。开启后「必达」类消息（打款失败、判责申诉、提货倒计时）才能实时提醒你。</span>
      <span class="nt-go" id="mg-go">去开启</span>
      <span class="nt-x" id="mg-x">✕</span>
    </div>
    <div class="mg-bar">
      <div class="mg-search">${svg('search')}<input id="mg-kw" placeholder="搜标题、正文或单号"></div>
      <div class="mg-unread" id="mg-ur"><span class="rc"></span>只看未读</div>
    </div>
    <div class="mg-tabs" id="mg-tabs"></div>
    <div class="mg-list" id="mg-list"></div>`;

  const list=root.querySelector('#mg-list');
  const tabs=root.querySelector('#mg-tabs');

  function drawTabs(){
    tabs.innerHTML=CATS.map(c=>{
      const n=MSGS.filter(m=>!m.read&&(c.k==='ALL'||m.cat===c.k)).length;
      return `<div class="mg-tab${state.tab===c.k?' on':''}" data-t="${c.k}">${c.n}${n?`<span class="cnt">${badgeTxt(n)}</span>`:''}</div>`;
    }).join('');
    tabs.querySelectorAll('.mg-tab').forEach(t=>t.onclick=()=>{state.tab=t.dataset.t;drawTabs();draw();});
  }

  function bindRows(data){
    list.querySelectorAll('.mg-item').forEach(el=>el.onclick=e=>{
      const m=data.find(x=>x.id===el.dataset.id);if(!m)return;
      const x=e.target.closest('[data-x]'),g=e.target.closest('[data-go]');
      if(x){state.expand[m.id]=!state.expand[m.id];drawData();return;}
      if(!m.read){m.read=1;root.querySelector('#mg-un').textContent=badgeTxt(unreadCount());drawTabs();syncBell();}
      if(g){toast('跳转：'+m.go.replace(/^去/,''));drawData();return;}
      openDetail(m);drawData();
    });
  }
  function drawData(){
    const data=visible();
    if(!data.length){
      list.innerHTML=`<div class="empty"><div class="ei">${svg('bell')}</div><h4>暂无消息</h4>
        <p>${state.unreadOnly?'当前分类没有未读消息':state.kw?'没有匹配的消息，换个关键词试试':'该分类下暂时没有新消息'}</p></div>`;
      return;
    }
    list.innerHTML=data.map(itemHTML).join('')+'<div class="mg-nomore">无更多数据</div>';
    bindRows(data);
  }
  function draw(){list.innerHTML=skel(3);setTimeout(drawData,300);}

  root.querySelector('#mg-go').onclick=()=>toast('前往系统设置开启通知');
  root.querySelector('#mg-x').onclick=()=>root.querySelector('#mg-nt').remove();
  root.querySelector('#mg-pref').onclick=openPref;
  const allBtn=root.querySelector('#mg-all');
  function syncAll(){allBtn.classList.toggle('off',!unreadCount());}
  allBtn.onclick=()=>{
    if(!unreadCount())return;
    MSGS.forEach(m=>m.read=1);
    root.querySelector('#mg-un').textContent='0';
    drawTabs();drawData();syncAll();syncBell();toast('已全部标为已读');
  };
  syncAll();
  const ur=root.querySelector('#mg-ur');
  ur.onclick=()=>{state.unreadOnly=!state.unreadOnly;ur.classList.toggle('on',state.unreadOnly);draw();};
  let kwT;root.querySelector('#mg-kw').oninput=e=>{clearTimeout(kwT);kwT=setTimeout(()=>{state.kw=e.target.value.trim();drawData();},350);};

  drawTabs();draw();
}

/* 详情：App 用推页（PC 同内容用右侧抽屉） */
function openDetail(m){
  const c=catOf(m.cat);
  const rows=[['分类',c.n],['强度',m.lv+' '+LV[m.lv]],['事件码',m.ev],['发布时间',m.tm],['投递渠道',m.ch]]
    .concat(m.rel).map(([k,v])=>`<div class="mp-row"><div class="l"><div class="s">${k}</div><div class="n" style="font-size:14px">${v}</div></div></div>`).join('');
  pushPage({title:'消息详情',body:`
    <div class="mp-sec"><div class="st">消息内容</div>
      <div class="mp-row"><div class="l"><div class="n">${m.t}</div><div class="s" style="margin-top:7px;font-size:13.5px;line-height:1.65;color:#46604F">${m.b}</div></div></div>
      ${m.dl?`<div class="mp-row"><div class="l"><div class="s">剩余时效</div><div class="n" style="color:#B91C1C">${cdSpan(m.dl)}</div></div></div>`:''}
    </div>
    <div class="mp-sec"><div class="st">消息属性</div>${rows}</div>`,
    footer:m.go?`<button class="btn primary" id="dt-go">${m.go}</button>`:'',
    mount:p=>{const b=p.querySelector('#dt-go');if(b)b.onclick=()=>toast('跳转：'+m.go.replace(/^去/,''));}});
}

/* 消息设置：L1 mandatory 不可关；L2/L3/L4 可关；静默时段 22:00–08:00 SGT */
function openPref(){
  const rows=CATS.filter(c=>c.k!=='ALL').map(c=>`
    <div class="mp-row"><div class="l"><div class="n">${c.n}</div>
      <div class="s">L2/L3 消息的 Push 提醒</div></div>
      <span class="mp-sw${PREF[c.k].push?' on':''}" data-c="${c.k}"></span></div>`).join('');
  pushPage({title:'消息设置',body:`
    <div class="mp-sec"><div class="st">必达消息（不可关闭）</div>
      <div class="mp-row"><div class="l"><div class="n">L1 必达</div>
        <div class="s">会掉钱、会停业、有硬时效倒计时的消息——打款失败、判责申诉、提货倒计时、整改告急等，共 23 类。为避免漏收造成损失，不支持关闭，也不受静默时段限制。</div></div>
        <span class="mp-lock">强制开启</span></div></div>
    <div class="mp-sec"><div class="st">按分类接收 Push</div>${rows}</div>
    <div class="mp-sec"><div class="st">免打扰</div>
      <div class="mp-row"><div class="l"><div class="n">静默时段 22:00 – 08:00</div>
        <div class="s">静默时段内的待办与告知类消息顺延至次日 08:00 合并推送；必达类不受影响，照常实时推送。</div></div>
        <span class="mp-sw${PREF.quiet?' on':''}" data-q="1"></span></div></div>
    <div class="mp-sec"><div class="st">说明</div>
      <div class="mp-row"><div class="l"><div class="s">站内消息始终全量保留，关闭 Push 只影响手机系统提醒，不影响你在消息中心查看。</div></div></div></div>`,
    mount:p=>p.querySelectorAll('.mp-sw').forEach(sw=>sw.onclick=()=>{
      const on=!sw.classList.contains('on');sw.classList.toggle('on',on);
      if(sw.dataset.q)PREF.quiet=on?1:0;else PREF[sw.dataset.c].push=on?1:0;
      toast(on?'已开启':'已关闭');
    })});
}

function openMessage(){
  pushPage({title:'消息',body:'<div id="mg-root"></div>',mount:p=>renderMsgCenter(p.querySelector('#mg-root'))});
}

/* 首页铃铛：未读数角标（上限 99+），与消息中心同源 */
function syncBell(){
  const bell=document.querySelector('#v-home .hm-bell');if(!bell)return;
  let rd=bell.querySelector('.rd');const n=unreadCount();
  if(!n){rd&&rd.remove();return;}
  if(!rd){rd=document.createElement('span');rd.className='rd';bell.appendChild(rd);}
  /* 覆盖 .hm-bell .rd 的 width:8px —— 不写 width:auto 会让「14」这类两位数被红底切掉 */
  rd.style.cssText='position:absolute;top:4px;right:2px;width:auto;min-width:17px;height:17px;padding:0 4px;border-radius:9px;background:var(--red);border:2px solid #fff;color:#fff;font-size:10.5px;font-weight:800;line-height:13px;text-align:center;box-sizing:border-box;';
  rd.textContent=badgeTxt(n);
}
window.FM_MESSAGE=openMessage;
window.FM_MOD=window.FM_MOD||{};window.FM_MOD.message=openMessage;
const bindBell=()=>{const bell=document.querySelector('#v-home .hm-bell')||document.querySelector('.hm-bell');
  if(bell){bell.style.cursor='pointer';bell.onclick=openMessage;}syncBell();};
bindBell();setTimeout(bindBell,300);
})();
