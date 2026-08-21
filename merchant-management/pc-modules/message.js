/* 商家 PC 后台 · 消息中心（二期）
   依据：采购/merchant management/PRD/scm_商家端消息中心_功能框架.md v1.0
   PC 端一期零实现（apps/web 无 notification 引用），本模块为从零新建。
   与 App 原型 v2/message.js 同源：分类 / 强度 / 渠道 / 聚合 / 倒计时 / 偏好口径一致，
   交互形态按端适配（PC 表格 + 右侧抽屉，App 卡片 + 推页）。
   PAGES: m-message（消息列表）· m-message-pref（消息设置） */
(function(){

/* ── 枚举（与 contracts/notification.ts 同源命名，本期扩展）────────────── */
const CATS=[
  {k:'ALL',         n:'全部'},
  {k:'FULFILLMENT', n:'履约待办'},
  {k:'DISPUTE',     n:'差异与售后'},
  {k:'CATALOG',     n:'商品与库存'},
  {k:'FINANCE',     n:'结算与票据'},
  {k:'COMPLIANCE',  n:'合规与账号'},
  {k:'ANNOUNCEMENT',n:'公告与培训'},
];
const LV={L1:['L1 必达','t-r'],L2:['L2 待办','t-y'],L3:['L3 告知','t-gr'],L4:['L4 公告','t-g']};
const catName=k=>(CATS.find(c=>c.k===k)||{n:k}).n;
const H=n=>Date.now()+n*3600000;

/* ── 站内消息（服务端真源的 mock；字段名对齐 NotificationItem）───────── */
function seed(){return [
 {id:'M001',cat:'FULFILLMENT',ev:'DELIVERY_SIGN_FAILED',lv:'L1',read:0,tm:'2026-08-21 06:12',
  t:'签到失败 · 请到仓后重新签到',b:'平台 2 次致电均未接通，本次到仓签到未成功。请到仓后重新发起签到，否则本车货品无法进入交接。',
  rel:[['送货单','SH20260821003'],['仓库','裕廊DC']],go:['去重新签到','m-delivery'],
  ch:[['站内信','已送达','06:12'],['App Push','已送达','06:12'],['WhatsApp','已送达','06:13']]},
 {id:'M002',cat:'FULFILLMENT',ev:'DELIVERY_APPOINT_DUE',lv:'L1',read:0,tm:'2026-08-21 05:40',dl:H(0.9),
  t:'预约时段临近 · 尚未签到',b:'送货单预约到仓时段即将开始，目前尚未签到。逾期未到仓将占用仓库月台并影响后续接单。',
  rel:[['送货单','SH20260821005'],['预约时段','08:00~10:00']],go:['去签到','m-delivery'],
  ch:[['站内信','已送达','05:40'],['App Push','已送达','05:40']]},
 {id:'M003',cat:'DISPUTE',ev:'RETURN_PICKUP_URGENT',lv:'L1',read:0,tm:'2026-08-21 09:00',dl:H(23.4),
  t:'退货提货倒计时告急 · 剩 24 小时',b:'退货商品已到仓待提，超时未提货平台将按规则自行处置，货值不再返还。',
  rel:[['退货单','RT20260819007'],['仓库','兀兰DC'],['件数','12 件']],go:['去查看退货单','m-after-return'],
  ch:[['站内信','已送达','09:00'],['App Push','已送达','09:00'],['WhatsApp','已送达','09:01']]},
 {id:'M004',cat:'DISPUTE',ev:'AFTERSALE_APPEAL_DUE',lv:'L1',read:0,tm:'2026-08-21 08:30',dl:H(5.6),
  t:'申诉窗口 6 小时后关闭',b:'该售后单判定为商家责，你尚未提交申诉。窗口关闭后判责结果生效并进入清分，不可再申诉。',
  rel:[['售后单','KS20260820011'],['判责方','商家责'],['扣款','S$86.40']],go:['去申诉','m-aftersale'],
  ch:[['站内信','已送达','08:30'],['App Push','已送达','08:30']]},
 {id:'M005',cat:'DISPUTE',ev:'AFTERSALE_JUDGED',lv:'L1',read:1,tm:'2026-08-20 17:05',
  t:'售后判责结果 · 判定商家责',b:'客诉「到货腐烂」经平台核实，判定为商家责，扣款将在本期结算中体现。如有异议请在 24 小时内申诉。',
  rel:[['售后单','KS20260820011'],['客诉类型','品质问题']],go:['去查看判责详情','m-aftersale'],
  ch:[['站内信','已送达','17:05'],['App Push','已送达','17:05']]},
 {id:'M006',cat:'FINANCE',ev:'PAYMENT_FAILED',lv:'L1',read:0,tm:'2026-08-20 15:22',dl:H(58),
  t:'打款失败 · 请更新收款账户',b:'本期货款打款失败，原因：收款户名与营业执照主体不一致。请在 3 个工作日内更新账户信息，逾期本期货款顺延至下期。',
  rel:[['结算单','ST20260815B'],['金额','S$9,820.00'],['失败原因','户名不一致']],go:['去更新收款账户','m-account'],
  ch:[['站内信','已送达','15:22'],['App Push','已送达','15:22'],['WhatsApp','已送达','15:23'],['邮件','已送达','15:25']]},
 {id:'M007',cat:'FINANCE',ev:'RECON_GENERATED',lv:'L1',read:0,tm:'2026-08-20 08:00',dl:H(96),
  t:'对账单已生成 · 待核对',b:'2026-08-11 ~ 08-17 的对账单已生成，请在 5 个工作日内完成核对。逾期未确认视为认可平台数据。',
  rel:[['对账单','RC20260817'],['应结金额','S$12,486.30']],go:['去核对','m-recon'],
  ch:[['站内信','已送达','08:00'],['App Push','已送达','08:00'],['邮件','已送达','08:02']]},
 {id:'M008',cat:'FINANCE',ev:'RECON_DUE_SOON',lv:'L1',read:0,tm:'2026-08-21 08:00',dl:H(22),
  t:'对账核对期限告急 · 剩 1 天',b:'上一期对账单你尚未确认，明日 23:59 后系统将按平台数据自动确认。',
  rel:[['对账单','RC20260810'],['差异项','2 项']],go:['去核对','m-recon'],
  ch:[['站内信','已送达','08:00'],['App Push','已送达','08:00']]},
 {id:'M009',cat:'FINANCE',ev:'SETTLEMENT_GENERATED',lv:'L1',read:0,tm:'2026-08-19 08:00',
  t:'结算单已生成 · 待确认',b:'本期结算单已生成，确认后进入平台复核并安排打款。',
  rel:[['结算单','ST20260818A'],['结算金额','S$8,640.00']],go:['去确认结算单','m-settle'],
  ch:[['站内信','已送达','08:00'],['App Push','已送达','08:00'],['邮件','已送达','08:03']]},
 {id:'M010',cat:'CATALOG',ev:'SKU_SOLDOUT_SHARED_POOL',lv:'L2',read:0,tm:'2026-08-21 07:15',
  t:'寄售商品已售罄 · 同商品其他规格出货所致',b:'白菜（500g 装）可售已为 0。寄售同一商品的各规格共享同一批到仓货物，其他规格出货会同步扣减本规格可售数量——不是系统异常。需要恢复售卖请预约送货补货。',
  rel:[['SKU','SKU8802'],['供货模式','寄售'],['可售','0']],go:['去预约送货','m-delivery'],
  ch:[['站内信','已送达','07:15'],['App Push','已送达','07:15']]},
 {id:'M011',cat:'CATALOG',ev:'SKU_SOLDOUT',lv:'L2',read:0,tm:'2026-08-21 06:50',
  t:'售完即止商品已售罄 · 需手动补库存',b:'该商品库存模式为「售完即止」，售罄后不会自动回补，将持续处于下架状态。',
  rel:[['SKU','SKU8826'],['库存模式','售完即止'],['可售','0']],go:['去改库存','m-stock'],
  ch:[['站内信','已送达','06:50'],['App Push','已送达','06:50']]},
 {id:'M012',cat:'FULFILLMENT',ev:'ORDER_DAILY_SUMMARY',lv:'L2',read:0,tm:'2026-08-21 06:00',
  t:'今日新订单 12 单 · 已截单',b:'平台已截单，今日订单不再变动，可开始备货。',
  agg:{c:12,items:[['海底捞（新加坡）','4 单 · S$886.00'],['食为天餐厅','3 单 · S$512.50'],['丰盛轩','3 单 · S$421.00'],['新味坊','2 单 · S$268.00']]},
  rel:[['送达日','2026-08-22'],['合计','S$2,087.50']],go:['去看订单','m-order'],
  ch:[['站内信','已送达','06:00'],['App Push','已送达','06:00']]},
 {id:'M013',cat:'FULFILLMENT',ev:'LABEL_PENDING',lv:'L2',read:0,tm:'2026-08-21 06:05',
  t:'8 个订单待打标 · 距送达日不足 1 天',b:'打印首张标签后系统会按仓自动生成送货单。',
  agg:{c:8,items:[['裕廊DC','5 单'],['兀兰DC','2 单'],['盛港DC','1 单']]},
  rel:[['送达日','2026-08-22']],go:['去打印标签','m-pick-label'],
  ch:[['站内信','已送达','06:05'],['App Push','已送达','06:05']]},
 {id:'M014',cat:'CATALOG',ev:'SKU_SOLDOUT_DAILY_RESET',lv:'L3',read:0,tm:'2026-08-20 23:00',
  t:'今日 6 个 SKU 售罄 · 次日自动回补',b:'以下商品库存模式为「每日恢复初始库存」，次日 00:00 自动回补，无需处理。',
  agg:{c:6,items:[['小棠菜 SKU8801','初始 120 件'],['菠菜 SKU8803','初始 80 件'],['空心菜 SKU8804','初始 60 件'],['生菜 SKU8807','初始 45 件']]},
  rel:[['库存模式','每日恢复']],go:['','m-stock'],
  ch:[['站内信','已送达','23:00']]},
 {id:'M015',cat:'CATALOG',ev:'EXPORT_READY',lv:'L3',read:0,tm:'2026-08-20 21:12',
  t:'库存导出已就绪 · 可下载',b:'你导出的库存明细共 8,240 行已生成完成，下载链接 7 天内有效。',
  rel:[['导出内容','库存明细'],['行数','8,240']],go:['去下载','m-stock'],
  ch:[['站内信','已送达','21:12']]},
 {id:'M016',cat:'FULFILLMENT',ev:'ORDER_COMPLETED',lv:'L3',read:1,tm:'2026-08-20 20:30',
  t:'今日 23 单已完成',b:'客户已签收，货款进入本期对账。',
  agg:{c:23,items:[['08-20 送达批次','23 单 · S$4,120.60']]},
  rel:[['送达日','2026-08-20']],go:['','m-order'],
  ch:[['站内信','已送达','20:30']]},
 {id:'M017',cat:'COMPLIANCE',ev:'LOGIN_ACCOUNT_CHANGED',lv:'L1',read:1,tm:'2026-08-19 11:02',
  t:'登录邮箱已变更',b:'你的登录邮箱已变更为 ops@***.sg。若非本人操作，请立即联系平台客服冻结账号。',
  rel:[['变更项','登录邮箱'],['操作时间','2026-08-19 11:02']],go:['',''],
  ch:[['邮件','已送达','11:02'],['站内信','已送达','11:02']]},
 {id:'M018',cat:'FINANCE',ev:'PAYMENT_SUCCESS',lv:'L2',read:1,tm:'2026-08-18 16:40',
  t:'货款已到账 S$9,820.00',b:'本期货款已打款成功，请注意查收。',
  rel:[['结算单','ST20260811A'],['到账银行','DBS ****4192'],['流水号','TXN20260818K']],go:['去看结算单','m-settle'],
  ch:[['站内信','已送达','16:40'],['App Push','已送达','16:40'],['邮件','已送达','16:42']]},
 {id:'M019',cat:'ANNOUNCEMENT',ev:'PLATFORM_ANNOUNCEMENT',lv:'L4',read:1,tm:'2026-08-15 10:00',
  t:'国庆假期配送与揽收安排',b:'08-09 国庆当日仓库正常收货，配送时段调整为 06:00~12:00，请提前安排备货与送货预约。',
  rel:[['生效日','2026-08-09']],go:['',''],
  ch:[['站内信','已送达','10:00'],['App Push','已送达','10:00']]},
];}

/* 本模块表格列多，压缩内边距并允许横向滚动，避免标题被挤成两三行 */
(function(){const s=document.createElement('style');
  s.textContent='.msgtbl th,.msgtbl td{padding:11px 10px}.msgtbl td{vertical-align:top}.msgtbl .nw{white-space:nowrap}';
  document.head.appendChild(s);})();

function ensureMsgs(){
  if(!DB.msgs)DB.msgs=seed();
  if(!DB.msgTab)DB.msgTab='ALL';
  if(!DB.msgSel)DB.msgSel=[];
  if(DB.msgKw===undefined)DB.msgKw='';
  if(DB.msgLv===undefined)DB.msgLv='';
  if(DB.msgUnreadOnly===undefined)DB.msgUnreadOnly=false;
  if(!DB.msgPref)DB.msgPref={FULFILLMENT:{push:1,mail:0},DISPUTE:{push:1,mail:0},CATALOG:{push:1,mail:0},
    FINANCE:{push:1,mail:1},COMPLIANCE:{push:1,mail:1},ANNOUNCEMENT:{push:0,mail:0},quiet:1};
}
/* 侧栏与顶栏未读角标同源 */
window.msgUnread=function(){ensureMsgs();return DB.msgs.filter(m=>!m.read).length;};
const badgeTxt=n=>n>99?'99+':''+n;

/* 剩余时效倒计时：主文件无 ticker，本模块自带（只驱动 [data-cdp]） */
function fmtRemain(ms){let s=Math.floor((ms-Date.now())/1000);if(!ms||isNaN(s))return '—';if(s<=0)return '已截止';
  const d=Math.floor(s/86400);s-=d*86400;const h=Math.floor(s/3600);s-=h*3600;const m=Math.floor(s/60),ss=s%60;
  const p=n=>(''+n).padStart(2,'0');return (d?d+'天 ':'')+p(h)+':'+p(m)+':'+p(ss);}
function cdCell(ms){return ms?`<span data-cdp="${ms}" style="color:var(--r);font-weight:600">${fmtRemain(ms)}</span>`:'<span style="color:var(--tt)">—</span>';}
if(!window._msgTick)window._msgTick=setInterval(()=>{
  document.querySelectorAll('[data-cdp]').forEach(el=>{el.textContent=fmtRemain(+el.dataset.cdp);});},1000);

function visible(){
  ensureMsgs();
  return DB.msgs.filter(m=>{
    if(DB.msgTab!=='ALL'&&m.cat!==DB.msgTab)return false;
    if(DB.msgUnreadOnly&&m.read)return false;
    if(DB.msgLv&&m.lv!==DB.msgLv)return false;
    if(DB.msgKw){const k=DB.msgKw.toLowerCase();
      if((m.t+m.b+m.rel.map(r=>r[1]).join('')).toLowerCase().indexOf(k)<0)return false;}
    return true;
  });
}

/* ── 交互（onclick 需全局） ─────────────────────────────────────────── */
window.msgTab=k=>{DB.msgTab=k;DB.msgSel=[];render();};
window.msgKw=v=>{DB.msgKw=(v||'').trim();DB.msgSel=[];render();};
window.msgLv=v=>{DB.msgLv=v;DB.msgSel=[];render();};
window.msgUnreadOnly=el=>{DB.msgUnreadOnly=el.checked;DB.msgSel=[];render();};
window.msgSelToggle=(id,el)=>{const i=DB.msgSel.indexOf(id);if(el.checked){if(i<0)DB.msgSel.push(id);}else if(i>=0)DB.msgSel.splice(i,1);render();};
window.msgSelAll=el=>{DB.msgSel=el.checked?visible().filter(m=>!m.read).map(m=>m.id):[];render();};
window.msgReadSel=()=>{if(!DB.msgSel.length)return;const n=DB.msgSel.length;
  DB.msgs.forEach(m=>{if(DB.msgSel.indexOf(m.id)>=0)m.read=1;});DB.msgSel=[];render();toast(`已将 ${n} 条标为已读`,'ok');};
window.msgReadAll=()=>{const n=DB.msgs.filter(m=>!m.read).length;if(!n)return;
  modal(`<h3>全部标为已读</h3><p class="sub" style="margin:10px 0 18px">当前账号 + 站点 + 店铺下的 <b>${n}</b> 条未读消息将全部标为已读，操作不可撤销。</p>
    <div class="row" style="justify-content:flex-end;gap:10px"><button class="btn btn-o" onclick="closeModal()">取消</button>
    <button class="btn btn-p" onclick="msgReadAllDo()">确认全部已读</button></div>`);};
window.msgReadAllDo=()=>{const n=DB.msgs.filter(m=>!m.read).length;DB.msgs.forEach(m=>m.read=1);DB.msgSel=[];closeModal();render();toast(`已将 ${n} 条标为已读`,'ok');};
window.msgGo=(id,e)=>{e&&e.stopPropagation();const m=DB.msgs.find(x=>x.id===id);if(!m)return;
  if(!m.read)m.read=1;
  if(m.go&&m.go[1]){closeDrawer();nav(m.go[1]);}else{render();toast('该消息为告知类，无需处理','info');}};
window.msgAggToggle=(id,e)=>{e&&e.stopPropagation();const m=DB.msgs.find(x=>x.id===id);if(!m)return;
  m._open=!m._open;render();};
window.msgOpen=id=>{
  const m=DB.msgs.find(x=>x.id===id);if(!m)return;
  if(!m.read){m.read=1;render();}
  const rel=m.rel.map(([k,v])=>`<tr><th style="width:130px">${k}</th><td class="mono">${v}</td></tr>`).join('');
  const ch=m.ch.map(([c,s,t])=>`<tr><td>${c}</td><td>${tagPlainOk(s)}</td><td class="mono">${m.tm.slice(0,10)} ${t}</td></tr>`).join('');
  const agg=m.agg?`<div class="card" style="margin-top:16px"><div class="card-hd"><h3>聚合明细</h3><span class="sub">共 ${m.agg.c} 条，本条为按规则合并后的摘要</span></div>
    <div class="card-bd flush"><table><thead><tr><th>对象</th><th>数量 / 金额</th></tr></thead><tbody>
    ${m.agg.items.map(([a,b])=>`<tr><td>${a}</td><td>${b}</td></tr>`).join('')}
    ${m.agg.items.length<m.agg.c?`<tr><td colspan="2" class="sub">其余 ${m.agg.c-m.agg.items.length} 条明细在业务页查看</td></tr>`:''}
    </tbody></table></div></div>`:'';
  drawer(`<div class="drawer-hd"><div><h3>${m.t}</h3>
      <div style="margin-top:5px">${lvTag(m.lv)} <span class="sub" style="font-size:12.5px">${catName(m.cat)} · ${m.tm}</span></div></div>
    <span class="x" onclick="closeDrawer()">×</span></div>
  <div class="drawer-bd">
    <div class="ib ${m.lv==='L1'?'ib-r':m.lv==='L2'?'ib-y':'ib-gr'}"><span class="i">${m.lv==='L1'?'⚠️':m.lv==='L2'?'📌':'ℹ️'}</span>${m.b}</div>
    <div class="card"><div class="card-hd"><h3>消息属性</h3></div><div class="card-bd flush"><table class="subtbl">
      <tr><th style="width:130px">事件码</th><td class="mono">${m.ev}</td></tr>
      <tr><th>强度</th><td>${LV[m.lv][0]} · ${m.lv==='L1'?'不可关闭，豁免静默时段':'可在消息设置中关闭 Push'}</td></tr>
      <tr><th>剩余时效</th><td>${cdCell(m.dl)}</td></tr>
      ${rel}
    </table></div></div>
    ${agg}
    <div class="card" style="margin-top:16px"><div class="card-hd"><h3>投递明细</h3><span class="sub">失败按 1min / 5min / 30min 重试 3 次</span></div>
      <div class="card-bd flush"><table><thead><tr><th>渠道</th><th>状态</th><th>时间</th></tr></thead><tbody>${ch}</tbody></table></div></div>
  </div>
  <div class="drawer-ft"><button class="btn btn-o" onclick="closeDrawer()">关闭</button>
    ${m.go&&m.go[0]?`<button class="btn btn-p" onclick="msgGo('${m.id}',event)">${m.go[0]}</button>`:''}</div>`);
};
function tagPlainOk(s){return `<span class="tag t-g"><span class="dot"></span>${s}</span>`;}
function lvTag(lv){return `<span class="tag ${LV[lv][1]}"><span class="dot"></span>${LV[lv][0]}</span>`;}

window.msgPrefSet=(cat,ch,el)=>{DB.msgPref[cat][ch]=el.checked?1:0;toast((el.checked?'已开启 ':'已关闭 ')+catName(cat)+' 的'+(ch==='push'?'App Push':'邮件'),'ok');};
window.msgPrefQuiet=el=>{DB.msgPref.quiet=el.checked?1:0;toast(el.checked?'已开启静默时段':'已关闭静默时段','ok');};

/* ── 页面：消息列表 ────────────────────────────────────────────────── */
PAGES['m-message']=()=>{
  ensureMsgs();
  const rows=visible(),unread=DB.msgs.filter(m=>!m.read).length,sel=DB.msgSel.length;
  const selectable=rows.filter(m=>!m.read).length;
  const tabs=CATS.map(c=>{
    const n=DB.msgs.filter(m=>!m.read&&(c.k==='ALL'||m.cat===c.k)).length;
    return `<div class="tab ${DB.msgTab===c.k?'active':''}" onclick="msgTab('${c.k}')">${c.n}${n?`<span class="nav-badge" style="margin-left:0">${badgeTxt(n)}</span>`:''}</div>`;
  }).join('');

  const body=rows.length?rows.map(m=>{
    const relMain=m.rel[0]?m.rel[0][1]:'—';
    const aggRow=m.agg&&m._open?`<tr class="subrow"><td colspan="10" style="background:#FAFCF9;padding:0">
      <table class="subtbl" style="margin:0"><thead><tr><th style="width:240px">对象</th><th>数量 / 金额</th></tr></thead><tbody>
      ${m.agg.items.map(([a,b])=>`<tr><td>${a}</td><td>${b}</td></tr>`).join('')}
      ${m.agg.items.length<m.agg.c?`<tr><td colspan="2" class="sub">其余 ${m.agg.c-m.agg.items.length} 条明细在业务页查看</td></tr>`:''}
      </tbody></table></td></tr>`:'';
    return `<tr style="cursor:pointer${m.read?';opacity:.66':''}" onclick="msgOpen('${m.id}')">
      <td onclick="event.stopPropagation()"><input type="checkbox" ${m.read?'disabled':''} ${DB.msgSel.indexOf(m.id)>=0?'checked':''} onchange="msgSelToggle('${m.id}',this)"></td>
      <td>${lvTag(m.lv)}</td>
      <td class="nw">${catName(m.cat)}</td>
      <td style="font-weight:600">${m.read?'':'<span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:var(--r);margin-right:7px;vertical-align:1px"></span>'}${m.t}</td>
      <td class="sub" style="font-size:12.5px">${m.b.length>42?m.b.slice(0,42)+'…':m.b}
        ${m.agg?`<button class="btn btn-link btn-sm" style="padding:0;margin-left:6px" onclick="msgAggToggle('${m.id}',event)">${m._open?'收起':'展开'} ${m.agg.c} 条</button>`:''}</td>
      <td class="mono nw">${relMain}</td>
      <td>${cdCell(m.dl)}</td>
      <td class="mono nw" style="font-size:12.5px">${m.tm.slice(5)}<div style="color:var(--tt)">${m.tm.slice(0,4)}</div></td>
      <td>${m.read?'<span class="tag t-gr"><span class="dot"></span>已读</span>':'<span class="tag t-r"><span class="dot"></span>未读</span>'}</td>
      <td onclick="event.stopPropagation()">${m.go&&m.go[0]?`<button class="btn btn-o btn-sm" onclick="msgGo('${m.id}',event)">${m.go[0]}</button>`:'<span class="sub">—</span>'}</td>
    </tr>${aggRow}`;
  }).join(''):'';

  return `<div class="tabs">${tabs}</div>

  <div class="card">
    <div class="card-hd">
      <h3>站内消息</h3>
      <span class="sub">当前账号 + 站点 + 店铺 · 未读 ${badgeTxt(unread)} 条</span>
      <div class="row" style="margin-left:auto;gap:10px;align-items:center">
        <input placeholder="搜标题、正文或单号" value="${DB.msgKw}" style="width:230px" onchange="msgKw(this.value)">
        <select onchange="msgLv(this.value)" style="width:130px">
          <option value="">全部强度</option>
          ${Object.keys(LV).map(k=>`<option value="${k}" ${DB.msgLv===k?'selected':''}>${LV[k][0]}</option>`).join('')}
        </select>
        <label class="sub" style="display:flex;align-items:center;gap:6px;white-space:nowrap;cursor:pointer">
          <input type="checkbox" ${DB.msgUnreadOnly?'checked':''} onchange="msgUnreadOnly(this)">只看未读</label>
        <button class="btn btn-o btn-sm" onclick="nav('m-message-pref')">消息设置</button>
      </div>
    </div>

    <div class="selbar" style="display:flex;align-items:center;gap:12px;padding:10px 16px;background:#F0FBF4;border-bottom:1px solid var(--bd);font-size:13px">
      <label style="display:flex;align-items:center;gap:6px;cursor:pointer">
        <input type="checkbox" ${selectable&&sel===selectable?'checked':''} ${selectable?'':'disabled'} onchange="msgSelAll(this)">全选未读</label>
      <span>已选 <b>${sel}</b> 条</span>
      <button class="btn btn-p btn-sm" ${sel?'':'disabled style="opacity:.45;cursor:not-allowed"'} onclick="msgReadSel()">标为已读</button>
      <button class="btn btn-o btn-sm" ${unread?'':'disabled style="opacity:.45;cursor:not-allowed"'} onclick="msgReadAll()">全部已读</button>
      ${sel?`<button class="btn btn-link" style="margin-left:auto" onclick="DB.msgSel=[];render()">取消选择</button>`:''}
    </div>

    <div class="card-bd flush">${rows.length?`<div style="overflow-x:auto"><table class="msgtbl" style="min-width:1180px">
      <thead><tr>
        <th style="width:32px"></th><th style="width:80px">强度</th><th style="width:92px">分类</th>
        <th style="width:216px">标题</th><th>内容摘要</th><th style="width:108px">关联单号</th>
        <th style="width:88px">剩余时效</th><th style="width:112px">发布时间</th>
        <th style="width:64px">状态</th><th style="width:116px">操作</th>
      </tr></thead><tbody>${body}</tbody></table></div>`
      :`<div class="empty"><div class="e-ic">🔔</div><div class="e-t">暂无消息</div>
        <div class="e-s">${DB.msgUnreadOnly?'当前筛选下没有未读消息':DB.msgKw?'没有匹配「'+DB.msgKw+'」的消息':'该分类下暂时没有新消息'}</div></div>`}</div>
  </div>`;
};

/* ── 页面：消息设置 ────────────────────────────────────────────────── */
PAGES['m-message-pref']=()=>{
  ensureMsgs();
  const rows=CATS.filter(c=>c.k!=='ALL').map(c=>{
    const p=DB.msgPref[c.k];
    return `<tr>
      <td style="font-weight:600">${c.n}</td>
      <td><span class="tag t-gr"><span class="dot"></span>始终接收</span></td>
      <td><label style="cursor:pointer"><input type="checkbox" ${p.push?'checked':''} onchange="msgPrefSet('${c.k}','push',this)"> 接收</label></td>
      <td><label style="cursor:pointer"><input type="checkbox" ${p.mail?'checked':''} onchange="msgPrefSet('${c.k}','mail',this)"> 接收</label></td>
    </tr>`;}).join('');

  return `<div class="ib ib-r"><span class="i">⚠️</span><b>L1 必达消息不可关闭。</b>会掉钱、会停业、有硬时效倒计时的 23 类消息（打款失败 / 判责申诉 / 提货倒计时 / 整改告急等）强制通过站内信 + Push 送达，并<b>豁免静默时段</b>；其中 6 类额外走 WhatsApp。此处设置只对 L2 待办 / L3 告知 / L4 公告生效。</div>

  <div class="card">
    <div class="card-hd"><h3>按分类接收</h3><span class="sub">站内信全档全量保留，关闭只影响 Push 与邮件提醒</span></div>
    <div class="card-bd flush"><table>
      <thead><tr><th style="width:180px">分类</th><th style="width:150px">站内信</th><th style="width:150px">App Push</th><th style="width:150px">邮件</th></tr></thead>
      <tbody>${rows}</tbody></table></div>
  </div>

  <div class="card" style="margin-top:18px">
    <div class="card-hd"><h3>免打扰</h3><span class="sub">时区 Asia/Singapore</span></div>
    <div class="card-bd">
      <div class="fr"><div class="fl">静默时段</div>
        <label style="display:flex;align-items:center;gap:8px;cursor:pointer">
          <input type="checkbox" ${DB.msgPref.quiet?'checked':''} onchange="msgPrefQuiet(this)">
          <span>22:00 – 08:00 不推送</span></label>
        <div class="sub" style="margin-top:8px;font-size:12.5px">静默时段内的 L2 / L3 / L4 消息顺延至次日 08:00 合并推送（堆积超 50 条只推摘要）；<b>L1 必达不受影响</b>，凌晨备货与送货是常态。</div>
      </div>
    </div>
  </div>

  <div class="card" style="margin-top:18px">
    <div class="card-hd"><h3>接收人</h3></div>
    <div class="card-bd">
      <div class="ib ib-b"><span class="i">ℹ️</span>本期为<b>全店铺账号广播</b>：同店铺下的每个账号各收到一条独立消息，已读互不影响。按职能路由收件人（财务类只发财务账号）在后续版本提供。</div>
    </div>
  </div>`;
};

})();
