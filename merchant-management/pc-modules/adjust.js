/* PC · 店铺运营平台 —— 业务调整单（通用正/负向款项单据）+ 调整类型配置
   ▍本模块只负责【把一笔款产生出来并推给下游】，不涉及结算（不归期、不进结算单、不开票）。
   ▍数据结构【对照线上罚款单】（功能框架 v0.6 §十一，依据 h5-foodmax-platform/src/services/ops/typings/shortage-fine.ts
     + docs/superpowers/specs/2026-08-18-ops-fine-shop-subject-and-list-redesign-design.md）：
   - 业务主体 = 店铺 shopCode（隔离键）；merchantCode 随单留存，仅供财务归集，列表不展示、只进详情。
   - 名称不落库：店铺/商家名称按编码关联主数据实时取，主数据查不到时为空串（同罚款单）。
     ※ 例外：调整类型名称随单快照——类型是运营可改名的配置，下游不维护类型表。
   - 两套正交状态，序列化值大小写刻意不同，不得混用：
       业务状态 status   ：effective 已生效 / voided 已作废（小写）
       推送状态 pushStatus：PENDING 待推送 / PUSHED 已推送（大写，单向不可逆）
       推送展示态 pushDisplayStatus = pushStatus × 下游 syncStatus 合成：PENDING / PUSH_FAILED / PUSHED
       （本侧事务内翻 PUSHED、下游同步在提交后才发起，只看 pushStatus 会把"没进下游"显示成已推送）
   - 金额恒正（amount），方向完全由类型决定。
   - 错单处理（2026-09-14 沈亮定，不做反向单/红冲）：
       未推送（PENDING）→ 作废：单据置 voided，永不推送，下游无感知；作废原因必填。
       已推送（PUSHED） → 本单不可再动；线下沟通后由运营新建一张反方向类型的调整单纠正。
     系统来源单（罚款）不在此作废，走罚款单自身撤销。
   - 建单两种提交：新建（待推送，无重复时不弹确认）/ 新建并推送（必须二次确认，推送后不可作废）。
   - 推送：只有 PENDING 可勾选；单次 ≤500；入参只有单号 + requestId，操作人服务端取；
     结果 {pushedCount, skippedCount}，已被他人推送 = 跳过 ≠ 失败。调整单【不设批次号】（2026-09-14 沈亮定）。
     PUSH_FAILED 不给运营重推入口，由服务端补偿重试（同罚款单）。
   - 操作记录独立成表：operateTime / operateUser / content，服务端在状态变更事务内写入。
   依赖主文件全局：DB / money / toast / modal / modalWide / closeModal / drawer / closeDrawer
                   / render / nav / ts / flowTip / fineGroups / fine_detail(replenish.js)。 */
(function(){

/* ================= 主数据（演示）：店铺 → 所属商家。名称按编码实时关联，不随单落库 ================= */
const SHOPS = {
  'SH2026062000001':{name:'绿鲜源蔬果旗舰店', merchant:'M2026-0815'},
  'SH2026070200004':{name:'海丰水产旗舰店',   merchant:'M2026-0902'},
  'SH2026070200005':{name:'万丰肉禽旗舰店',   merchant:'M2026-1103'},
};
const MERCHANTS = {'M2026-0815':'绿鲜源蔬果','M2026-0902':'海丰水产','M2026-1103':'万丰肉禽'};
const shopName = c => (SHOPS[c]||{}).name || '';
const merchantName = c => MERCHANTS[c] || '';
const shopOfMerchant = m => Object.keys(SHOPS).find(k=>SHOPS[k].merchant==m) || '';

/* ================= 调整类型（可配置） ================= */
DB.adjTypes = DB.adjTypes || [
  {code:'ADJ-FINE',    cn:'缺货罚款',       en:'Shortage Fine',         dir:'DEDUCTION', needBiz:1, on:1, sys:1},
  {code:'ADJ-CLAIM',   cn:'售后判责赔付',   en:'After-sale Claim',      dir:'DEDUCTION', needBiz:1, on:1, sys:0},
  {code:'ADJ-DELAY',   cn:'逾期送货违约金', en:'Late Delivery Penalty', dir:'DEDUCTION', needBiz:1, on:1, sys:0},
  {code:'ADJ-QC',      cn:'质量问题扣款',   en:'Quality Deduction',     dir:'DEDUCTION', needBiz:1, on:1, sys:0},
  {code:'ADJ-PROMO',   cn:'平台活动补贴',   en:'Campaign Subsidy',      dir:'ADDITION',  needBiz:0, on:1, sys:0},
  {code:'ADJ-FREIGHT', cn:'物流费用补贴',   en:'Logistics Subsidy',     dir:'ADDITION',  needBiz:0, on:1, sys:0},
  {code:'ADJ-COMP',    cn:'系统错账补款',   en:'System Error Comp.',    dir:'ADDITION',  needBiz:0, on:1, sys:0},
  {code:'ADJ-DEPOSIT', cn:'保证金退还',     en:'Deposit Refund',        dir:'ADDITION',  needBiz:0, on:0, sys:0},
];
const tOf = c => (DB.adjTypes||[]).find(t=>t.code==c) || {code:c, cn:c, en:'', dir:'DEDUCTION', needBiz:0, on:0};
window.adjTypeOf = tOf;

/* ================= 主表 adjust_order（演示数据，字段名 = 落库字段） ================= */
DB.adjOrders = DB.adjOrders || [
  {adjustNo:'ADJ-SG-20260911-007', shopCode:'SH2026070200004', merchantCode:'M2026-0902',
   adjustTypeCode:'ADJ-FREIGHT', adjustTypeName:'物流费用补贴', amount:420.00, currency:'SGD',
   bizNo:'', remark:'8 月冷链车加班费补贴', effectiveTime:'2026-09-11 14:20',
   sourceType:'MANUAL', sourceNo:'',
   status:'voided', voidReason:'金额录错，应为 240.00，已重新建单', pushStatus:'PENDING', syncStatus:'', syncErrorText:'', pushedAt:''},
  {adjustNo:'ADJ-SG-20260908-001', shopCode:'SH2026062000001', merchantCode:'M2026-0815',
   adjustTypeCode:'ADJ-CLAIM', adjustTypeName:'售后判责赔付', amount:186.00, currency:'SGD',
   bizNo:'AS-26090801', remark:'客户反馈菜心腐烂，判商家责任，按客户成交价赔付', effectiveTime:'2026-09-08 10:22',
   sourceType:'MANUAL', sourceNo:'',
   status:'effective', pushStatus:'PUSHED', syncStatus:'SUCCESS', syncErrorText:'', pushedAt:'2026-09-08 11:00'},
  {adjustNo:'ADJ-SG-20260909-002', shopCode:'SH2026070200005', merchantCode:'M2026-1103',
   adjustTypeCode:'ADJ-DELAY', adjustTypeName:'逾期送货违约金', amount:300.00, currency:'SGD',
   bizNo:'SH20260909012', remark:'9/9 送货晚到 4 小时，影响 3 家门店备货，按合同约定计违约金', effectiveTime:'2026-09-09 15:40',
   sourceType:'MANUAL', sourceNo:'',
   status:'effective', pushStatus:'PUSHED', syncStatus:'SUCCESS', syncErrorText:'', pushedAt:'2026-09-09 16:02'},
  {adjustNo:'ADJ-SG-20260910-004', shopCode:'SH2026070200005', merchantCode:'M2026-1103',
   adjustTypeCode:'ADJ-COMP', adjustTypeName:'系统错账补款', amount:300.00, currency:'SGD',
   bizNo:'ADJ-SG-20260909-002', remark:'9/9 违约金误扣：核实为平台派车延误，非商家责任，补回 300.00（已与商家线下确认）', effectiveTime:'2026-09-10 09:05',
   sourceType:'MANUAL', sourceNo:'',
   status:'effective', pushStatus:'PUSHED', syncStatus:'FAILED', syncErrorText:'下游同步超时，系统将自动重试', pushedAt:'2026-09-10 09:30'},
  {adjustNo:'ADJ-SG-20260910-005', shopCode:'SH2026070200004', merchantCode:'M2026-0902',
   adjustTypeCode:'ADJ-PROMO', adjustTypeName:'平台活动补贴', amount:1250.00, currency:'SGD',
   bizNo:'', remark:'9 月中秋海鲜专场活动，平台承担的让利补贴，线下已与商家确认金额', effectiveTime:'2026-09-10 17:12',
   sourceType:'MANUAL', sourceNo:'',
   status:'effective', pushStatus:'PENDING', syncStatus:'', syncErrorText:'', pushedAt:''},
  {adjustNo:'ADJ-SG-20260911-006', shopCode:'SH2026062000001', merchantCode:'M2026-0815',
   adjustTypeCode:'ADJ-QC', adjustTypeName:'质量问题扣款', amount:78.50, currency:'SGD',
   bizNo:'QC-26091102', remark:'到仓抽检不合格整批拒收，按货值扣款', effectiveTime:'2026-09-11 08:30',
   sourceType:'MANUAL', sourceNo:'',
   status:'effective', pushStatus:'PENDING', syncStatus:'', syncErrorText:'', pushedAt:''},
];
/* 操作记录表 adjust_operator_log（同罚款单 OperatorLogRepVO：operateTime / operateUser / content） */
DB.adjLogs = DB.adjLogs || {
  'ADJ-SG-20260908-001':[{operateTime:'2026-09-08 10:22',operateUser:'陈敏',content:'创建调整单'},{operateTime:'2026-09-08 11:00',operateUser:'陈敏',content:'推送'}],
  'ADJ-SG-20260909-002':[{operateTime:'2026-09-09 15:40',operateUser:'陈敏',content:'创建调整单'},{operateTime:'2026-09-09 16:02',operateUser:'陈敏',content:'推送'}],
  'ADJ-SG-20260910-004':[{operateTime:'2026-09-10 09:05',operateUser:'陈敏',content:'创建调整单'},{operateTime:'2026-09-10 09:30',operateUser:'陈敏',content:'推送'}],
  'ADJ-SG-20260910-005':[{operateTime:'2026-09-10 17:12',operateUser:'林凯',content:'创建调整单'}],
  'ADJ-SG-20260911-006':[{operateTime:'2026-09-11 08:30',operateUser:'林凯',content:'创建调整单'}],
  'ADJ-SG-20260911-007':[{operateTime:'2026-09-11 14:20',operateUser:'林凯',content:'创建调整单'},{operateTime:'2026-09-11 14:26',operateUser:'林凯',content:'作废，原因：金额录错，应为 240.00，已重新建单'}],
};
DB.adjFilter = DB.adjFilter || {shop:'',no:'',type:'',dir:'',src:'',st:'',push:'',from:'',to:''};
DB.adjSel    = DB.adjSel    || [];
DB.adjSeq    = DB.adjSeq    || 7;
const logOf = no => (DB.adjLogs[no] = DB.adjLogs[no] || []);
const addLog = (no,content) => logOf(no).push({operateTime:ts(), operateUser:'当前账号', content});

/* ================= 行模型：人工单 + 收编的罚款单 ================= */
// 罚款单不复制数据，实时从 DB.fineOrders 映射；推送状态写回罚款单自身（同源）
function fineAsAdj(){
  return (typeof fineGroups=='function'?fineGroups(true):[]).map(g=>({
    adjustNo:g.no, shopCode:shopOfMerchant(g.merchant), merchantCode:g.merchant,
    adjustTypeCode:'ADJ-FINE', adjustTypeName:tOf('ADJ-FINE').cn, amount:g.amt, currency:'SGD',
    bizNo:g.deliveryNo, remark:`到仓少货 ${g.qty} 件 × ${money(g.rate)}/件（${g.items.map(x=>x.name).join('、')}）`,
    effectiveTime:g.at, sourceType:'SHORTAGE_FINE', sourceNo:g.no,
    status:'effective', pushStatus:g.push=='pushed'?'PUSHED':'PENDING', syncStatus:g.push=='pushed'?'SUCCESS':'',
    syncErrorText:'', pushedAt:g.pushedAt||'',
  }));
}
function adjAll(){
  return (DB.adjOrders||[]).concat(fineAsAdj()).sort((a,b)=>String(b.effectiveTime).localeCompare(String(a.effectiveTime)));
}
const adjOf = no => adjAll().find(r=>r.adjustNo==no);
window.adjOf = adjOf;

// 资金方向 = 类型方向
function adjDir(r){ return tOf(r.adjustTypeCode).dir; }
const adjSign = r => adjDir(r)=='ADDITION' ? 1 : -1;
window.adjDir = adjDir;
// 推送展示态：pushStatus × syncStatus 合成（前端只认这三个值）
function pushDisplay(r){ return r.pushStatus!='PUSHED' ? 'PENDING' : (r.syncStatus=='FAILED' ? 'PUSH_FAILED' : 'PUSHED'); }
window.adjPushDisplay = pushDisplay;

function dirTag(r){ return adjDir(r)=='ADDITION'
  ? '<span class="tag t-g"><span class="dot"></span>正向 · 补商家</span>'
  : '<span class="tag t-r"><span class="dot"></span>负向 · 扣商家</span>'; }
function amtCell(r){ const s=adjSign(r);
  return `<span style="color:${s>0?'var(--g)':'var(--r)'};font-weight:700;font-size:15px">${s>0?'+':'-'}${money(r.amount)}</span>`; }
function pushTag(r){ if(r.status=='voided') return '<span style="color:var(--tt)">—</span>'; const d=pushDisplay(r);
  if(d=='PUSHED')      return '<span class="tag t-g"><span class="dot"></span>已推送</span>';
  if(d=='PUSH_FAILED') return '<span class="tag t-r"><span class="dot"></span>推送失败</span>';
  return '<span class="tag t-y"><span class="dot"></span>待推送</span>'; }
function statusTag(r){
  if(r.status=='voided')   return '<span class="tag t-gr"><span class="dot"></span>已作废</span>';
  return '<span class="tag t-g"><span class="dot"></span>已生效</span>'; }
function srcTag(r){ return r.sourceType=='SHORTAGE_FINE'
  ? '<span class="tag t-gr"><span class="dot"></span>缺货罚款</span>'
  : '<span class="tag t-gr"><span class="dot"></span>人工建单</span>'; }
const selectable = r => r.pushStatus=='PENDING' && r.status!='voided';   // 同罚款单：待推送且未作废才可勾
const canVoid    = r => r.sourceType=='MANUAL' && r.pushStatus=='PENDING' && r.status=='effective';

function adjRows(){
  const f=DB.adjFilter, hit=(v,k)=>!k||String(v||'').toLowerCase().includes(String(k).trim().toLowerCase());
  return adjAll().filter(r=>
       hit(shopName(r.shopCode)+' '+r.shopCode, f.shop) && hit(r.adjustNo, f.no)
    && (!f.type||r.adjustTypeCode==f.type) && (!f.dir||adjDir(r)==f.dir)
    && (!f.src||r.sourceType==f.src) && (!f.st||r.status==f.st) && (!f.push||(r.status!='voided'&&pushDisplay(r)==f.push))
    && (!f.from||r.effectiveTime>=f.from) && (!f.to||r.effectiveTime<=f.to+' 23:59'));
}

/* ================= 列表页 ================= */
PAGES['p-adjust']=()=>{
  const f=DB.adjFilter, rows=adjRows();
  const canSel=rows.filter(selectable);
  DB.adjSel=DB.adjSel.filter(no=>canSel.some(r=>r.adjustNo==no));
  const allSel=canSel.length&&canSel.every(r=>DB.adjSel.includes(r.adjustNo));
  const shops=Object.keys(SHOPS).map(shopName);

  return `${flowTip('')}
  <div class="card" style="margin-bottom:14px"><div class="card-bd" style="padding:16px 20px 12px">
    <div class="fg3">
      <div class="fr"><label class="fl">店铺</label><input id="af-shop" value="${f.shop}" placeholder="店铺名称或编码" list="af-shoplist"><datalist id="af-shoplist">${shops.map(m=>`<option>${m}</option>`).join('')}</datalist></div>
      <div class="fr"><label class="fl">调整单号</label><input id="af-no" value="${f.no}" placeholder="如 ADJ-SG-20260910-005"></div>
      <div class="fr"><label class="fl">调整类型</label><select id="af-type"><option value="">全部</option>${DB.adjTypes.map(t=>`<option value="${t.code}" ${f.type==t.code?'selected':''}>${t.cn}</option>`).join('')}</select></div>
    </div>
    <div class="fg3">
      <div class="fr"><label class="fl">方向</label><select id="af-dir"><option value="">全部</option><option value="ADDITION" ${f.dir=='ADDITION'?'selected':''}>正向 · 补商家</option><option value="DEDUCTION" ${f.dir=='DEDUCTION'?'selected':''}>负向 · 扣商家</option></select></div>
      <div class="fr"><label class="fl">来源</label><select id="af-src"><option value="">全部</option><option value="MANUAL" ${f.src=='MANUAL'?'selected':''}>人工建单</option><option value="SHORTAGE_FINE" ${f.src=='SHORTAGE_FINE'?'selected':''}>缺货罚款</option></select></div>
      <div class="fr"><label class="fl">推送状态</label><select id="af-push"><option value="">全部</option><option value="PENDING" ${f.push=='PENDING'?'selected':''}>待推送</option><option value="PUSHED" ${f.push=='PUSHED'?'selected':''}>已推送</option><option value="PUSH_FAILED" ${f.push=='PUSH_FAILED'?'selected':''}>推送失败</option></select></div>
    </div>
    <div class="fg3">
      <div class="fr"><label class="fl">生效时间 起</label><input id="af-from" type="date" value="${f.from}"></div>
      <div class="fr"><label class="fl">生效时间 止</label><input id="af-to" type="date" value="${f.to}"></div>
      <div class="fr"><label class="fl">状态</label><select id="af-st"><option value="">全部</option><option value="effective" ${f.st=='effective'?'selected':''}>已生效</option><option value="voided" ${f.st=='voided'?'selected':''}>已作废</option></select></div>
    </div>
    <div class="row" style="justify-content:flex-end;gap:8px;margin-top:2px">
      <button class="btn btn-o" onclick="adj_reset()">重置</button>
      <button class="btn btn-p" onclick="adj_query()">查询</button>
    </div>
  </div></div>

  <div class="card">
    <div class="selbar" style="display:flex;align-items:center;gap:10px;padding:10px 16px;background:#F0FBF4;border-bottom:1px solid var(--bd);font-size:13px">
      <span style="color:var(--ts)">已选 <b style="color:var(--tp)">${DB.adjSel.length}</b> 张</span>
      ${DB.adjSel.length?`<button class="btn btn-link" onclick="DB.adjSel=[];render()">取消选择</button>`:''}
      <span style="flex:1"></span>
      <button class="btn btn-o btn-sm" ${DB.adjSel.length?'':'disabled'} onclick="adj_pushAsk()">推送${DB.adjSel.length?` (${DB.adjSel.length})`:''}</button>
      <button class="btn btn-p btn-sm" onclick="adj_newAsk()">新建调整单</button>
    </div>
    <div class="card-bd flush"><div style="overflow-x:auto"><table>
      <thead><tr>
        <th style="width:34px"><input type="checkbox" class="skuchk" title="全选待推送" ${allSel?'checked':''} onclick="adj_selAll()"></th>
        <th>调整单号</th><th>店铺名称</th><th>店铺编码</th><th>调整类型</th><th>方向</th>
        <th style="text-align:right">金额</th><th>关联业务单</th><th>来源</th><th>生效时间</th>
        <th>状态</th><th>推送状态</th><th>操作</th>
      </tr></thead><tbody>
      ${rows.map(r=>`<tr>
        <td>${selectable(r)?`<input type="checkbox" class="skuchk" ${DB.adjSel.includes(r.adjustNo)?'checked':''} onclick="adj_toggle('${r.adjustNo}')">`:''}</td>
        <td class="mono" style="white-space:nowrap">${r.adjustNo}</td>
        <td style="white-space:nowrap"><b>${shopName(r.shopCode)}</b></td>
        <td class="mono" style="white-space:nowrap">${r.shopCode}</td>
        <td style="white-space:nowrap">${r.adjustTypeName}</td>
        <td style="white-space:nowrap">${dirTag(r)}</td>
        <td style="text-align:right;white-space:nowrap">${amtCell(r)}</td>
        <td class="mono" style="font-size:12px;white-space:nowrap">${r.bizNo||'—'}</td>
        <td style="white-space:nowrap">${srcTag(r)}</td>
        <td style="white-space:nowrap;font-size:12.5px;color:var(--ts)">${r.effectiveTime}</td>
        <td style="white-space:nowrap">${statusTag(r)}</td>
        <td style="white-space:nowrap" ${r.syncErrorText?`title="${r.syncErrorText}"`:''}>${pushTag(r)}</td>
        <td style="white-space:nowrap"><button class="btn btn-o btn-sm" onclick="adj_detail('${r.adjustNo}')">详情</button></td>
      </tr>`).join('')||`<tr><td colspan="13" style="text-align:center;color:var(--ts);padding:22px">${adjAll().length?'没有符合筛选条件的调整单':'暂无业务调整单'}</td></tr>`}
      </tbody></table></div>
      <div class="card-bd" style="border-top:1px solid var(--bd2);font-size:12.5px;color:var(--ts)">
        业务调整单只负责<b>产生一笔正/负向款项</b>并推送给下游，<b>不涉及结算归期、结算单与开票</b>。建单即时生效、不可修改；<b>未推送的错单可作废</b>；已推送的单不可再动，如需纠正请新建一张反方向类型的调整单。
        推送失败由系统自动重试，无需重复推送。调整类型 <button class="btn btn-link btn-sm" style="padding:0 0 0 2px" onclick="nav('p-adjust-type')">去配置</button>；缺货罚款明细仍在 <button class="btn btn-link btn-sm" style="padding:0 0 0 2px" onclick="nav('p-fine')">罚款单</button> 页查看。
      </div>
    </div>`;
};

window.adj_query=function(){
  const g=id=>(document.getElementById(id)||{}).value||'';
  DB.adjFilter={shop:g('af-shop').trim(),no:g('af-no').trim(),type:g('af-type'),dir:g('af-dir'),src:g('af-src'),st:g('af-st'),push:g('af-push'),from:g('af-from'),to:g('af-to')};
  DB.adjSel=[];render();
};
window.adj_reset=function(){DB.adjFilter={shop:'',no:'',type:'',dir:'',src:'',st:'',push:'',from:'',to:''};DB.adjSel=[];render();toast('筛选条件已重置','info');};
window.adj_toggle=function(no){const i=DB.adjSel.indexOf(no);i<0?DB.adjSel.push(no):DB.adjSel.splice(i,1);render();};
window.adj_selAll=function(){
  const sel=adjRows().filter(selectable).map(r=>r.adjustNo);
  DB.adjSel=(sel.length&&sel.every(n=>DB.adjSel.includes(n)))?[]:sel.slice();render();
};

/* ================= 新建调整单（建单 → 二次确认 → 生效，待推送） ================= */
window.adj_newAsk=function(keep){
  const types=(DB.adjTypes||[]).filter(t=>t.on&&!t.sys);   // 系统来源类型不可人工建单
  const d=(keep&&DB.adjDraft)||{sc:'',tc:'',amt:'',biz:'',rk:''};   // 「返回修改」回填上次输入，不清空
  const sel=(v,x)=>v==x?'selected':'';
  modalWide(`<div class="mc-hd"><h3>新建业务调整单</h3><p>产生一笔正向（补商家）或负向（扣商家）款项；建单即生效、不可修改</p><button class="mc-x" onclick="closeModal()">×</button></div>
  <div class="mc-bd">
    <div class="fg2">
      <div class="fr"><label class="fl"><b>*</b>店铺</label><select id="an-shop" onchange="adj_shopChange()">${Object.keys(SHOPS).map(c=>`<option value="${c}" ${sel(d.sc,c)}>${shopName(c)}（${c}）</option>`).join('')}</select></div>
      <div class="fr"><label class="fl">所属商家（随店铺带出，财务归集用）</label><div id="an-mc" style="padding:9px 0"></div></div>
    </div>
    <div class="fg2">
      <div class="fr"><label class="fl"><b>*</b>调整类型</label><select id="an-type" onchange="adj_typeChange()">${types.map(t=>`<option value="${t.code}" ${sel(d.tc,t.code)}>${t.cn}</option>`).join('')}</select></div>
      <div class="fr"><label class="fl">方向（随类型带出，不可改）</label><div id="an-dir" style="padding:9px 0"></div></div>
    </div>
    <div class="fg2">
      <div class="fr"><label class="fl"><b>*</b>金额（S$）</label><input id="an-amt" type="number" min="0.01" step="0.01" placeholder="0.00" value="${d.amt||''}"></div>
      <div class="fr"><label class="fl" id="an-bizl">关联业务单号</label><input id="an-biz" value="${d.biz||''}" placeholder="订单号 / 送货单号 / 售后单号；纠正已推送的调整单时填原调整单号"></div>
    </div>
    <div class="fr"><label class="fl"><b>*</b>调整说明</label><textarea id="an-remark" rows="3" placeholder="写清为什么补/扣这笔钱、线下与商家沟通的结论；只留在运营侧，不随推送报文输出">${d.rk||''}</textarea></div>
    <div class="fr"><label class="fl">附件（沟通记录 / 凭证，选填）</label><div class="up" onclick="toast('原型不做真实上传','info')"><div class="uic">📎</div><div class="ut">点击上传</div><div class="us">支持 jpg / png / pdf，单个 ≤ 10MB</div></div></div>
    <div style="font-size:12.5px;color:var(--ts);margin-top:4px"><b>新建</b>：生成后待推送，推送前可作废。<b>新建并推送</b>：生成后立即推送给下游，推送后不可作废。</div>
  </div>
  <div class="mc-ft">
    <button class="btn btn-o" onclick="closeModal()">取消</button>
    <button class="btn btn-o" onclick="adj_newSubmit(false)">新建</button>
    <button class="btn btn-p" onclick="adj_newSubmit(true)">新建并推送</button>
  </div>`);
  adj_shopChange(); adj_typeChange();
};
window.adj_shopChange=function(){
  const c=(document.getElementById('an-shop')||{}).value, m=(SHOPS[c]||{}).merchant;
  const el=document.getElementById('an-mc'); if(el) el.innerHTML=m?`${merchantName(m)} <span class="mono" style="color:var(--ts)">${m}</span>`:'—';
};
window.adj_typeChange=function(){
  const t=tOf((document.getElementById('an-type')||{}).value);
  const d=document.getElementById('an-dir'); if(d) d.innerHTML=dirTag({adjustTypeCode:t.code});
  const l=document.getElementById('an-bizl'); if(l) l.innerHTML=(t.needBiz?'<b>*</b>':'')+'关联业务单号'+(t.needBiz?'':'（选填）');
};
// 校验 → 暂存草稿。新建：无重复直接生成；新建并推送：必须二次确认（推送不可逆）
window.adj_newSubmit=function(withPush){
  const g=id=>String((document.getElementById(id)||{}).value||'').trim();
  const sc=g('an-shop'), tc=g('an-type'), amt=+g('an-amt'), biz=g('an-biz'), rk=g('an-remark');
  const t=tOf(tc);
  if(!(amt>0)){toast('请填写大于 0 的金额','err');return;}
  if(t.needBiz&&!biz){toast('该调整类型必须填写关联业务单号','err');return;}
  if(!rk){toast('请填写调整说明','err');return;}
  DB.adjDraft={sc,tc,amt,biz,rk};
  const dup=(DB.adjOrders||[]).filter(r=>r.status!='voided'&&r.shopCode==sc&&r.adjustTypeCode==tc&&r.amount==amt&&String(r.effectiveTime).slice(0,10)==ts().slice(0,10)).length;
  if(!withPush&&!dup){ adj_newDo(false); return; }
  adj_newConfirm(withPush,dup);
};
window.adj_newConfirm=function(withPush,dup){
  const d=DB.adjDraft; if(!d) return;
  const t=tOf(d.tc), mc=(SHOPS[d.sc]||{}).merchant||'', plus=t.dir=='ADDITION';
  modal(`<div class="mc-hd"><h3>${withPush?'确认新建并推送':'确认新建'}</h3><p>${withPush?'生成后立即推送给下游':'生成后待推送，推送前可作废'}</p><button class="mc-x" onclick="closeModal()">×</button></div>
  <div class="mc-bd">
    ${withPush?`<div class="ib ib-y"><span class="i">⚠️</span>推送后本单<b>不可作废、不可撤回</b>；如需纠正只能新建一张反方向类型的调整单。请核对店铺与金额。</div>`:''}
    ${dup?`<div class="ib ib-y"><span class="i">⚠️</span>今日已有 <b>${dup}</b> 张相同店铺 + 相同类型 + 相同金额的调整单，请确认不是重复创建。</div>`:''}
    <div style="border:1px solid var(--bd);border-radius:8px;overflow:hidden;margin:10px 0 12px"><table style="margin:0"><tbody>
      <tr><td style="color:var(--ts);width:120px">店铺</td><td><b>${shopName(d.sc)}</b> <span class="mono" style="color:var(--ts)">${d.sc}</span></td></tr>
      <tr><td style="color:var(--ts)">所属商家</td><td>${merchantName(mc)} <span class="mono" style="color:var(--ts)">${mc}</span></td></tr>
      <tr><td style="color:var(--ts)">调整类型</td><td>${t.cn} <span class="mono" style="color:var(--ts);font-size:12px">${t.code}</span></td></tr>
      <tr><td style="color:var(--ts)">方向</td><td>${dirTag({adjustTypeCode:d.tc})}</td></tr>
      <tr><td style="color:var(--ts)">金额</td><td><span style="color:${plus?'var(--g)':'var(--r)'};font-weight:700;font-size:17px">${plus?'+':'-'}${money(d.amt)}</span></td></tr>
      <tr><td style="color:var(--ts)">关联业务单</td><td class="mono">${d.biz||'—'}</td></tr>
    </tbody></table></div>
  </div>
  <div class="mc-ft"><button class="btn btn-o" onclick="adj_newAsk(true)">返回修改</button><button class="btn btn-p" onclick="adj_newDo(${withPush?'true':'false'})">${withPush?'确认新建并推送':'确认新建'}</button></div>`);
};
window.adj_newDo=function(withPush){
  const d=DB.adjDraft; if(!d) return;
  const now=ts();
  const no='ADJ-'+(DB.siteCode||'SG')+'-'+now.slice(0,10).replace(/-/g,'')+'-'+String(DB.adjSeq++).padStart(3,'0');
  DB.adjOrders.unshift({adjustNo:no, shopCode:d.sc, merchantCode:(SHOPS[d.sc]||{}).merchant||'',
    adjustTypeCode:d.tc, adjustTypeName:tOf(d.tc).cn, amount:+d.amt.toFixed(2), currency:'SGD',
    bizNo:d.biz, remark:d.rk, effectiveTime:now, sourceType:'MANUAL', sourceNo:'',
    status:'effective', pushStatus:withPush?'PUSHED':'PENDING', syncStatus:withPush?'SUCCESS':'', syncErrorText:'', pushedAt:withPush?now:''});
  addLog(no,'创建调整单');
  if(withPush) addLog(no,'推送');   // 同一事务内：建单成功才推送；推送同样按单号幂等
  DB.adjDraft=null; closeModal(); DB.adjSel=[]; render();
  toast(withPush?'调整单 '+no+' 已新建并推送':'调整单 '+no+' 已新建，待推送','ok');
};

/* ================= 详情抽屉 ================= */
window.adj_detail=function(no){
  const r=adjOf(no); if(!r) return;
  const t=tOf(r.adjustTypeCode), s=adjSign(r), d=pushDisplay(r);
  const kv=(k,v)=>`<div style="min-width:0"><div style="font-size:12px;color:var(--ts);margin-bottom:4px">${k}</div><div style="font-size:13.5px;color:var(--tp);font-weight:500;word-break:break-word">${v||'—'}</div></div>`;
  const sec=x=>`<div style="display:flex;align-items:center;gap:10px;margin:18px 0 12px"><span style="width:4px;height:16px;background:var(--g);border-radius:2px"></span><h3 style="font-size:14.5px;font-weight:700">${x}</h3></div>`;
  const grid=h=>`<div style="display:grid;grid-template-columns:1fr 1fr;gap:14px 20px">${h}</div>`;
  const logs = r.sourceType=='SHORTAGE_FINE'
    ? [{operateTime:r.effectiveTime,operateUser:'系统',content:'到仓少货自动生成罚款单'}].concat(r.pushedAt?[{operateTime:r.pushedAt,operateUser:'运营',content:'推送'}]:[])
    : logOf(r.adjustNo);

  drawer(`<div class="drawer-hd"><div><h3>${r.adjustNo}</h3><div style="font-size:12.5px;color:var(--ts);margin-top:2px">${r.adjustTypeName} · ${shopName(r.shopCode)}</div></div><span class="x" onclick="closeDrawer()">×</span></div>
  <div class="drawer-bd">
    <div class="row" style="gap:8px;margin-bottom:6px">${dirTag(r)}${srcTag(r)}${statusTag(r)}${pushTag(r)}</div>
    <div style="font-size:30px;font-weight:800;letter-spacing:-.5px;color:${s>0?'var(--g)':'var(--r)'};margin:10px 0 2px">${s>0?'+':'-'}${money(r.amount)}</div>
    <div style="font-size:12.5px;color:var(--ts)">${s>0?'平台付给商家':'向商家扣回'} · ${r.currency}</div>

    ${sec('单据信息')}
    ${grid(kv('店铺',`${shopName(r.shopCode)} <span class="mono" style="color:var(--ts)">${r.shopCode}</span>`)
      +kv('调整类型',`${r.adjustTypeName} <span class="mono" style="font-size:12px;color:var(--ts)">${t.code}</span>`)
      +kv('方向',adjDir(r)=='ADDITION'?'正向 · 补商家':'负向 · 扣商家')
      +kv('金额',money(r.amount))
      +kv('关联业务单',`<span class="mono">${r.bizNo||'—'}</span>`)
      +kv('生效时间',r.effectiveTime)
      +kv('来源',r.sourceType=='SHORTAGE_FINE'?`缺货罚款 · <span class="mono">${r.sourceNo}</span>`:'人工建单')
      +kv('币种',r.currency))}

    ${sec('财务归集')}
    ${grid(kv('商家名称',merchantName(r.merchantCode))+kv('商家编码',`<span class="mono">${r.merchantCode}</span>`))}

    ${r.status=='voided'?`<div class="ib ib-gr" style="margin-top:14px"><span class="i">🚫</span>本单已作废，<b>不会推送给下游</b>。作废原因：${r.voidReason||'—'}</div>`:''}

    ${r.sourceType=='MANUAL'?sec('调整说明')+`<div style="background:var(--bg);border:1px solid var(--bd2);border-radius:8px;padding:12px 14px;font-size:13px;line-height:1.7;color:var(--tp)">${r.remark||'—'}</div>`:''}

    ${sec('推送信息')}
    ${grid(kv('推送状态',pushTag(r))+kv('推送时间',r.pushedAt))}
    ${d=='PUSH_FAILED'?`<div class="ib ib-r" style="margin-top:12px"><span class="i">⛔</span>${r.syncErrorText||'下游同步失败'}。系统将自动重试，<b>无需重复推送</b>；按单号幂等，不会产生双份款项。</div>`:''}

    ${sec('操作记录')}
    <table><thead><tr><th>操作时间</th><th>操作人</th><th>内容</th></tr></thead><tbody>
      ${logs.map(l=>`<tr><td style="white-space:nowrap">${l.operateTime}</td><td style="white-space:nowrap">${l.operateUser}</td><td>${l.content}</td></tr>`).join('')}
    </tbody></table>
  </div>
  <div class="drawer-ft">
    <button class="btn btn-o" onclick="closeDrawer()">关闭</button>
    ${canVoid(r)?`<button class="btn btn-d" onclick="adj_voidAsk('${r.adjustNo}')">作废</button>`:''}
    ${r.sourceType=='SHORTAGE_FINE'&&typeof fine_detail=='function'?`<button class="btn btn-o" onclick="closeDrawer();fine_detail('${r.sourceNo}')">查看罚款单明细</button>`:''}
  </div>`);
};

/* ================= 作废（仅未推送） ================= */
window.adj_voidAsk=function(no){
  const r=adjOf(no); if(!r||!canVoid(r)) return;
  const s=adjSign(r);
  modal(`<div class="mc-hd"><h3>作废调整单</h3><p>${r.adjustNo} · 尚未推送</p><button class="mc-x" onclick="closeModal()">×</button></div>
  <div class="mc-bd">
    <div class="ib ib-y"><span class="i">⚠️</span>作废后本单<b>不会推送给下游</b>，且<b>不可恢复</b>；如需这笔款请重新建单。</div>
    <div style="border:1px solid var(--bd);border-radius:8px;overflow:hidden;margin:10px 0 12px"><table style="margin:0"><tbody>
      <tr><td style="color:var(--ts);width:120px">店铺</td><td><b>${shopName(r.shopCode)}</b> <span class="mono" style="color:var(--ts)">${r.shopCode}</span></td></tr>
      <tr><td style="color:var(--ts)">调整类型</td><td>${r.adjustTypeName}</td></tr>
      <tr><td style="color:var(--ts)">金额</td><td><span style="color:${s>0?'var(--g)':'var(--r)'};font-weight:700">${s>0?'+':'-'}${money(r.amount)}</span></td></tr>
    </tbody></table></div>
    <div class="fr"><label class="fl"><b>*</b>作废原因</label><textarea id="av-why" rows="3" placeholder="如：金额录错、店铺选错、线下已撤销补扣约定"></textarea></div>
  </div>
  <div class="mc-ft"><button class="btn btn-o" onclick="closeModal()">取消</button><button class="btn btn-d" onclick="adj_voidDo('${r.adjustNo}')">确认作废</button></div>`);
};
window.adj_voidDo=function(no){
  const r=(DB.adjOrders||[]).find(x=>x.adjustNo==no); if(!r) return;
  // 服务端以 WHERE pushStatus=PENDING AND status=effective 兜底：推送与作废并发时只有一个能成功
  if(!(r.pushStatus=='PENDING'&&r.status=='effective')){closeModal();render();toast('该单已被推送或已作废，无法作废','err');return;}
  const why=String((document.getElementById('av-why')||{}).value||'').trim();
  if(!why){toast('请填写作废原因','err');return;}
  r.status='voided'; r.voidReason=why;
  addLog(no,'作废，原因：'+why);
  DB.adjSel=DB.adjSel.filter(x=>x!=no);
  closeModal();closeDrawer();render();
  toast('调整单 '+no+' 已作废','ok');
};

/* ================= 推送（批量，同罚款单） ================= */
window.adj_pushAsk=function(){
  const rows=adjRows().filter(r=>DB.adjSel.includes(r.adjustNo));
  if(!rows.length){toast('请先勾选待推送的调整单','err');return;}
  if(rows.length>500){toast('单次最多推送 500 张，请缩小筛选范围分次推送','err');return;}
  const byS={};rows.forEach(r=>{(byS[r.shopCode]=byS[r.shopCode]||[]).push(r);});
  const net=a=>+a.reduce((x,r)=>+(x+adjSign(r)*r.amount).toFixed(2),0).toFixed(2);   // 逐行收敛两位
  const fmt=v=>`<span style="color:${v>=0?'var(--g)':'var(--r)'}">${v>=0?'+':'-'}${money(Math.abs(v))}</span>`;
  const curs=[...new Set(rows.map(r=>r.currency))].sort();
  modal(`<div class="mc-hd"><h3>推送调整单</h3><p>将 ${rows.length} 张调整单推送至下游</p><button class="mc-x" onclick="closeModal()">×</button></div>
  <div class="mc-bd">
    <div class="ib ib-y"><span class="i">⚠️</span>推送后<b>不可重复推送</b>，也<b>不可在本页撤回</b>；推送后如需纠正只能新建反方向的调整单。请核对店铺与金额。</div>
    <div style="border:1px solid var(--bd);border-radius:8px;overflow:hidden;margin:10px 0 12px"><table style="margin:0"><thead><tr><th>店铺</th><th>店铺编码</th><th style="text-align:right">单数</th><th style="text-align:right">净额</th></tr></thead><tbody>
      ${Object.keys(byS).map(k=>`<tr><td><b>${shopName(k)}</b></td><td class="mono">${k}</td><td style="text-align:right">${byS[k].length}</td><td style="text-align:right;font-weight:600">${fmt(net(byS[k]))}</td></tr>`).join('')}
      ${curs.map(cu=>{const x=rows.filter(r=>r.currency==cu);return `<tr style="background:#F7FBF8;font-weight:700"><td colspan="2">${cu} 小计</td><td style="text-align:right">${x.length}</td><td style="text-align:right">${fmt(net(x))}</td></tr>`;}).join('')}
    </tbody></table></div>
  </div>
  <div class="mc-ft"><button class="btn btn-o" onclick="closeModal()">取消</button><button class="btn btn-p" onclick="adj_pushDo()">确认推送</button></div>`);
};
window.adj_pushDo=function(){
  const now=ts(); let pushed=0, skipped=0;
  DB.adjSel.forEach(no=>{
    const m=(DB.adjOrders||[]).find(x=>x.adjustNo==no);
    if(m){
      if(m.pushStatus=='PENDING'&&m.status!='voided'){ m.pushStatus='PUSHED'; m.syncStatus='SUCCESS'; m.pushedAt=now; addLog(no,'推送'); pushed++; } else skipped++;
      return;
    }
    // 收编的罚款单：推送状态写回罚款单自身；罚款单原有批次号字段按罚款单自己的规则照写，调整单页不展示
    const f=(DB.fineOrders||[]).find(x=>x.no==no);
    if(f){
      if(f.push=='pending'){ f.push='pushed'; f.pushedAt=now; f.batchNo='FB-'+(DB.siteCode||'SG')+'-'+now.slice(0,10).replace(/-/g,'')+'-'+String(DB.fineBatchSeq=(DB.fineBatchSeq||1)+1).padStart(3,'0'); pushed++; } else skipped++;
    }
  });
  DB.adjSel=[];closeModal();
  if(DB.adjFilter.push=='PENDING') DB.adjFilter.push='';   // 停在「待推送」筛选时刚推的单会整批消失，切回全部让运营看得见
  render();
  toast(pushed?`已推送 ${pushed} 张${skipped?`，跳过 ${skipped} 张（已被他人推送或已作废）`:''}`:`所选 ${skipped} 张已被他人推送或已作废`, pushed?'ok':'info');
};

/* ================= 调整类型配置 ================= */
PAGES['p-adjust-type']=()=>{
  const used=c=>adjAll().filter(r=>r.adjustTypeCode==c).length;
  return `${flowTip('')}
  <div class="card">
    <div class="card-hd"><h3>调整类型</h3><span class="sub">业务调整单的可选类型由此维护 · 编码与方向建后不可改</span>
      <div class="row" style="margin-left:auto"><button class="btn btn-p btn-sm" onclick="adjt_edit('')">新增类型</button></div>
    </div>
    <div class="card-bd flush"><div style="overflow-x:auto"><table>
      <thead><tr><th>类型编码</th><th>中文名称</th><th>英文名称</th><th>方向</th><th>关联业务单</th><th>来源</th><th style="text-align:right">已用单数</th><th>状态</th><th>操作</th></tr></thead>
      <tbody>${DB.adjTypes.map(t=>`<tr>
        <td class="mono" style="white-space:nowrap">${t.code}</td>
        <td><b>${t.cn}</b></td>
        <td style="color:var(--ts)">${t.en}</td>
        <td style="white-space:nowrap">${t.dir=='ADDITION'?'<span class="tag t-g"><span class="dot"></span>正向 · 补商家</span>':'<span class="tag t-r"><span class="dot"></span>负向 · 扣商家</span>'}</td>
        <td>${t.needBiz?'必填':'选填'}</td>
        <td>${t.sys?'<span class="tag t-gr"><span class="dot"></span>系统生成</span>':'<span class="tag t-gr"><span class="dot"></span>人工建单</span>'}</td>
        <td style="text-align:right">${used(t.code)}</td>
        <td>${t.on?'<span class="tag t-g"><span class="dot"></span>启用</span>':'<span class="tag t-gr"><span class="dot"></span>停用</span>'}</td>
        <td style="white-space:nowrap">
          <button class="btn btn-o btn-sm" onclick="adjt_edit('${t.code}')">编辑</button>
          ${t.sys?'':`<button class="btn btn-o btn-sm" style="margin-left:6px" onclick="adjt_toggle('${t.code}')">${t.on?'停用':'启用'}</button>`}
        </td>
      </tr>`).join('')}</tbody>
    </table></div>
    <div class="card-bd" style="border-top:1px solid var(--bd2);font-size:12.5px;color:var(--ts)">
      <b>类型编码</b>与<b>方向</b>建后不可改；<b>名称可改</b>，已生成的单据按快照展示旧名。<b>停用</b>只影响新建，存量单的展示与推送不受影响。标「系统生成」的类型不可人工建单、不可停用。
    </div>
  </div>`;
};
window.adjt_edit=function(code){
  const t=code?tOf(code):{code:'',cn:'',en:'',dir:'DEDUCTION',needBiz:0,on:1,sys:0};
  const isNew=!code, ro='readonly style="background:#F3F4F6;color:var(--ts)"';
  modal(`<div class="mc-hd"><h3>${isNew?'新增调整类型':'编辑调整类型'}</h3><p>${isNew?'编码与方向一旦保存不可再改':'编码与方向不可改；名称改动不影响存量单据'}</p><button class="mc-x" onclick="closeModal()">×</button></div>
  <div class="mc-bd">
    <div class="fg2">
      <div class="fr"><label class="fl"><b>*</b>类型编码</label><input id="at-code" value="${t.code}" placeholder="如 ADJ-STORAGE" ${isNew?'':ro}></div>
      <div class="fr"><label class="fl"><b>*</b>方向</label>${isNew?`<select id="at-dir"><option value="DEDUCTION">负向 · 扣商家</option><option value="ADDITION">正向 · 补商家</option></select>`:`<input value="${t.dir=='ADDITION'?'正向 · 补商家':'负向 · 扣商家'}" ${ro}>`}</div>
    </div>
    <div class="fg2">
      <div class="fr"><label class="fl"><b>*</b>中文名称</label><input id="at-cn" value="${t.cn}" placeholder="如 仓储滞留费"></div>
      <div class="fr"><label class="fl">英文名称</label><input id="at-en" value="${t.en}" placeholder="如 Storage Fee"></div>
    </div>
    <div class="fg2">
      <div class="fr"><label class="fl">关联业务单号</label><select id="at-biz"><option value="0" ${t.needBiz?'':'selected'}>选填</option><option value="1" ${t.needBiz?'selected':''}>必填</option></select></div>
      <div class="fr"><label class="fl">状态</label>${t.sys?`<input value="启用（系统类型不可停用）" ${ro}>`:`<select id="at-on"><option value="1" ${t.on?'selected':''}>启用</option><option value="0" ${t.on?'':'selected'}>停用</option></select>`}</div>
    </div>
  </div>
  <div class="mc-ft"><button class="btn btn-o" onclick="closeModal()">取消</button><button class="btn btn-p" onclick="adjt_save('${code}')">保存</button></div>`);
};
window.adjt_save=function(code){
  const g=id=>String((document.getElementById(id)||{}).value||'').trim();
  const cd=g('at-code'), cn=g('at-cn');
  if(!cd){toast('请填写类型编码','err');return;}
  if(!cn){toast('请填写中文名称','err');return;}
  if(!code&&DB.adjTypes.some(t=>t.code==cd)){toast('类型编码已存在','err');return;}
  if(code){ const t=tOf(code); t.cn=cn; t.en=g('at-en'); t.needBiz=+g('at-biz'); if(!t.sys) t.on=+g('at-on'); }
  else DB.adjTypes.push({code:cd, cn, en:g('at-en'), dir:g('at-dir'), needBiz:+g('at-biz'), on:+g('at-on'), sys:0});
  closeModal();render();toast('调整类型已保存','ok');
};
window.adjt_toggle=function(code){
  const t=tOf(code);
  if(t.on){
    modal(`<div class="mc-hd"><h3>停用「${t.cn}」？</h3><p>停用后不可用于新建调整单</p><button class="mc-x" onclick="closeModal()">×</button></div>
    <div class="mc-bd"><div class="ib ib-b"><span class="i">ℹ️</span>已生成的 <b>${adjAll().filter(r=>r.adjustTypeCode==code).length}</b> 张调整单<b>不受影响</b>——展示、推送照常。</div></div>
    <div class="mc-ft"><button class="btn btn-o" onclick="closeModal()">取消</button><button class="btn btn-p" onclick="adjt_toggleDo('${code}')">确认停用</button></div>`);
  }else adjt_toggleDo(code);
};
window.adjt_toggleDo=function(code){const t=tOf(code);t.on=t.on?0:1;closeModal();render();toast('「'+t.cn+'」已'+(t.on?'启用':'停用'),'ok');};

})();
