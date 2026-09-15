/* PC · 店铺运营平台 —— 业务调整单（正/负向款项单据）+ 调整类型配置
   ▍对应 PRD：采购/merchant management/PRD/scm_运营端业务调整单_prd.md v1.1（规则以 PRD 为准，本文件只做交互演示）
   ▍要点：
   - 只产生款项并推送，不涉及结算。业务主体 = 店铺；商家仅财务归集，只在详情展示。
   - 金额恒正，方向由调整类型决定；± 与颜色只在展示层。
   - 新建（待推送，仅命中近 7 天重复时确认）/ 新建并推送（必须二次确认）。
   - 未推送人工单可作废（含「作废并重新建单」）；已推送的单不可再动，从详情「新建纠正单」另建一张。
   - 状态展示：待推送 / 已推送 / 同步重试中（下游失败或 30 分钟未确认）/ 已作废 / 判责中（仅罚款行）。
   - 缺货罚款单在本页只读展示，推送仍在罚款单页。
   依赖主文件全局：DB / money / toast / modal / modalWide / closeModal / drawer / closeDrawer
                   / render / nav / ts / flowTip / fineGroups / fine_detail(replenish.js)。 */
(function(){

/* ================= 主数据（演示）：店铺 → 所属商家；名称按编码关联，不随单落库 ================= */
const SHOPS = {
  'SH2026062000001':{name:'绿鲜源蔬果旗舰店', merchant:'M2026-0815'},
  'SH2026070200004':{name:'海丰水产旗舰店',   merchant:'M2026-0902'},
  'SH2026070200005':{name:'万丰肉禽旗舰店',   merchant:'M2026-1103'},
  'SH2026061000002':{name:'椰丰食品旗舰店',   merchant:'M2026-0805', stopped:true},
  'SH2026071500006':{name:'南洋鲜果行',       merchant:''},
};
const MERCHANTS = {'M2026-0815':'绿鲜源蔬果','M2026-0902':'海丰水产','M2026-1103':'万丰肉禽','M2026-0805':'椰丰食品'};
const shopName = c => (SHOPS[c]||{}).name || '';
const merchantName = c => MERCHANTS[c] || '';
const shopOfMerchant = m => Object.keys(SHOPS).find(k=>SHOPS[k].merchant==m) || '';
const esc = s => String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

/* ================= 调整类型 ================= */
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

/* ================= 调整单 adjust_order（演示数据） ================= */
DB.adjOrders = DB.adjOrders || [
  // 挂在 2026-07-01 对账单那天（绿鲜源蔬果旗舰店），供商家端「对账单 › 业务调整」页签与导出 Sheet7 演示
  {adjustNo:'ADJ-SG-20260701-002', shopCode:'SH2026062000001', merchantCode:'M2026-0815',
   adjustTypeCode:'ADJ-PROMO', adjustTypeName:'平台活动补贴', amount:120.00, currency:'SGD',
   bizNo:'', remark:'7/1 生鲜节平台让利补贴，线下已与商家确认', effectiveTime:'2026-07-01 18:30', createdBy:'陈敏',
   sourceType:'MANUAL', status:'effective', voidReason:'',
   pushStatus:'PUSHED', syncStatus:'SUCCESS', syncErrorText:'', pushedAt:'2026-07-01 18:35', pushedBy:'陈敏'},
  {adjustNo:'ADJ-SG-20260701-001', shopCode:'SH2026062000001', merchantCode:'M2026-0815',
   adjustTypeCode:'ADJ-QC', adjustTypeName:'质量问题扣款', amount:64.00, currency:'SGD',
   bizNo:'QC-26070101', remark:'7/1 到仓抽检两箱叶菜不合格，按货值扣款', effectiveTime:'2026-07-01 09:12', createdBy:'陈敏',
   sourceType:'MANUAL', status:'effective', voidReason:'',
   pushStatus:'PUSHED', syncStatus:'SUCCESS', syncErrorText:'', pushedAt:'2026-07-01 09:20', pushedBy:'陈敏'},
  {adjustNo:'ADJ-SG-20260914-003', shopCode:'SH2026070200004', merchantCode:'M2026-0902',
   adjustTypeCode:'ADJ-FREIGHT', adjustTypeName:'物流费用补贴', amount:420.00, currency:'SGD',
   bizNo:'', remark:'8 月冷链车加班费补贴', effectiveTime:'2026-09-14 09:20', createdBy:'林凯',
   sourceType:'MANUAL', status:'voided', voidReason:'金额录错，应为 240.00，已重新建单',
   pushStatus:'PENDING', syncStatus:'', syncErrorText:'', pushedAt:'', pushedBy:''},
  {adjustNo:'ADJ-SG-20260913-002', shopCode:'SH2026062000001', merchantCode:'M2026-0815',
   adjustTypeCode:'ADJ-QC', adjustTypeName:'质量问题扣款', amount:78.50, currency:'SGD',
   bizNo:'QC-26091302', remark:'到仓抽检不合格整批拒收，按货值扣款', effectiveTime:'2026-09-13 08:30', createdBy:'林凯',
   sourceType:'MANUAL', status:'effective', voidReason:'',
   pushStatus:'PENDING', syncStatus:'', syncErrorText:'', pushedAt:'', pushedBy:''},
  {adjustNo:'ADJ-SG-20260912-004', shopCode:'SH2026070200004', merchantCode:'M2026-0902',
   adjustTypeCode:'ADJ-PROMO', adjustTypeName:'平台活动补贴', amount:1250.00, currency:'SGD',
   bizNo:'', remark:'9 月中秋海鲜专场活动，平台承担的让利补贴，线下已与商家确认金额', effectiveTime:'2026-09-12 17:12', createdBy:'林凯',
   sourceType:'MANUAL', status:'effective', voidReason:'',
   pushStatus:'PENDING', syncStatus:'', syncErrorText:'', pushedAt:'', pushedBy:''},
  {adjustNo:'ADJ-SG-20260910-004', shopCode:'SH2026070200005', merchantCode:'M2026-1103',
   adjustTypeCode:'ADJ-COMP', adjustTypeName:'系统错账补款', amount:300.00, currency:'SGD',
   bizNo:'ADJ-SG-20260909-002', remark:'9/9 违约金误扣：核实为平台派车延误，非商家责任，补回 300.00（已与商家线下确认）', effectiveTime:'2026-09-10 09:05', createdBy:'陈敏',
   sourceType:'MANUAL', status:'effective', voidReason:'',
   pushStatus:'PUSHED', syncStatus:'FAILED', syncErrorText:'下游返回超时', pushedAt:'2026-09-10 09:30', pushedBy:'陈敏'},
  {adjustNo:'ADJ-SG-20260909-002', shopCode:'SH2026070200005', merchantCode:'M2026-1103',
   adjustTypeCode:'ADJ-DELAY', adjustTypeName:'逾期送货违约金', amount:300.00, currency:'SGD',
   bizNo:'SH20260909012', remark:'9/9 送货晚到 4 小时，影响 3 家门店备货，按合同约定计违约金', effectiveTime:'2026-09-09 15:40', createdBy:'陈敏',
   sourceType:'MANUAL', status:'effective', voidReason:'',
   pushStatus:'PUSHED', syncStatus:'SUCCESS', syncErrorText:'', pushedAt:'2026-09-09 16:02', pushedBy:'陈敏'},
  {adjustNo:'ADJ-SG-20260908-001', shopCode:'SH2026062000001', merchantCode:'M2026-0815',
   adjustTypeCode:'ADJ-CLAIM', adjustTypeName:'售后判责赔付', amount:186.00, currency:'SGD',
   bizNo:'AS-26090801', remark:'客户反馈菜心腐烂，判商家责任，按客户成交价赔付', effectiveTime:'2026-09-08 10:22', createdBy:'陈敏',
   sourceType:'MANUAL', status:'effective', voidReason:'',
   pushStatus:'PUSHED', syncStatus:'SUCCESS', syncErrorText:'', pushedAt:'2026-09-08 11:00', pushedBy:'陈敏'},
];
DB.adjLogs = DB.adjLogs || {
  'ADJ-SG-20260914-003':[{t:'2026-09-14 09:20',u:'林凯',c:'创建调整单'},{t:'2026-09-14 09:26',u:'林凯',c:'作废，原因：金额录错，应为 240.00，已重新建单'}],
  'ADJ-SG-20260913-002':[{t:'2026-09-13 08:30',u:'林凯',c:'创建调整单'}],
  'ADJ-SG-20260912-004':[{t:'2026-09-12 17:12',u:'林凯',c:'创建调整单'}],
  'ADJ-SG-20260910-004':[{t:'2026-09-10 09:05',u:'陈敏',c:'创建调整单'},{t:'2026-09-10 09:30',u:'陈敏',c:'推送'}],
  'ADJ-SG-20260909-002':[{t:'2026-09-09 15:40',u:'陈敏',c:'创建调整单'},{t:'2026-09-09 16:02',u:'陈敏',c:'推送'}],
  'ADJ-SG-20260908-001':[{t:'2026-09-08 10:22',u:'陈敏',c:'创建调整单'},{t:'2026-09-08 11:00',u:'陈敏',c:'推送'}],
};
const dayStr = (offset) => { const d=new Date(ts().replace(' ','T')); d.setDate(d.getDate()+offset); const p=n=>String(n).padStart(2,'0'); return d.getFullYear()+'-'+p(d.getMonth()+1)+'-'+p(d.getDate()); };
const DEFAULT_FILTER = () => ({shop:'',no:'',type:'',dir:'',src:'MANUAL',st:'PENDING',from:dayStr(-29),to:dayStr(0)});
DB.adjFilter = DB.adjFilter || DEFAULT_FILTER();
DB.adjSel    = DB.adjSel    || [];
DB.adjSeq    = DB.adjSeq    || 7;
const logOf = no => (DB.adjLogs[no] = DB.adjLogs[no] || []);
const addLog = (no,c) => logOf(no).push({t:ts(), u:'当前账号', c});

/* ================= 行模型 ================= */
function fineAsAdj(){
  return (typeof fineGroups=='function'?fineGroups(true):[]).map(g=>({
    adjustNo:g.no, shopCode:shopOfMerchant(g.merchant), merchantCode:g.merchant,
    adjustTypeCode:'ADJ-FINE', adjustTypeName:tOf('ADJ-FINE').cn, amount:g.amt, currency:'SGD',
    bizNo:g.deliveryNo, remark:'', effectiveTime:g.at, createdBy:'',
    sourceType:'SHORTAGE_FINE', fineStatus:g.status||'pending', status:g.status=='revoked'?'voided':'effective',
    pushStatus:g.push=='pushed'?'PUSHED':'PENDING', syncStatus:g.push=='pushed'?'SUCCESS':'', syncErrorText:'', pushedAt:g.pushedAt||'', pushedBy:'',
  }));
}
function adjAll(){
  return (DB.adjOrders||[]).concat(fineAsAdj()).sort((a,b)=>String(b.effectiveTime).localeCompare(String(a.effectiveTime))||String(b.adjustNo).localeCompare(String(a.adjustNo)));
}
const adjOf = no => adjAll().find(r=>r.adjustNo==no);
window.adjOf = adjOf;
const minutesSince = t => (new Date(ts().replace(' ','T')) - new Date(String(t).replace(' ','T')))/60000;

function adjDir(r){ return tOf(r.adjustTypeCode).dir; }
const adjSign = r => adjDir(r)=='ADDITION' ? 1 : -1;
window.adjDir = adjDir;
// 展示态：PENDING / PUSHED / PUSH_FAILED / VOIDED / JUDGING（PRD BR-08 / BR-10）
function displayStatus(r){
  if(r.sourceType=='SHORTAGE_FINE' && r.fineStatus=='judging') return 'JUDGING';
  if(r.status=='voided') return 'VOIDED';
  if(r.pushStatus!='PUSHED') return 'PENDING';
  if(r.syncStatus=='SUCCESS') return 'PUSHED';
  if(r.syncStatus=='FAILED') return 'PUSH_FAILED';
  return minutesSince(r.pushedAt)>=30 ? 'PUSH_FAILED' : 'PUSHED';
}
window.adjDisplayStatus = displayStatus;
const syncReason = r => r.syncErrorText || (r.pushStatus=='PUSHED'&&!r.syncStatus ? '下游未确认' : '');
const unconfirmed = r => r.pushStatus=='PUSHED' && !r.syncStatus && minutesSince(r.pushedAt)<30;
const isManual = r => r.sourceType=='MANUAL';
const selectable = r => isManual(r) && r.pushStatus=='PENDING' && r.status=='effective';
const canVoid    = r => isManual(r) && r.pushStatus=='PENDING' && r.status=='effective';
const canCorrect = r => isManual(r) && r.pushStatus=='PUSHED'  && r.status=='effective';

const ST_LABEL = {PENDING:'待推送', PUSHED:'已推送', PUSH_FAILED:'同步重试中', VOIDED:'已作废', JUDGING:'判责中'};
function statusTag(r){
  const d=displayStatus(r), cls={PENDING:'t-y',PUSHED:'t-g',PUSH_FAILED:'t-y',VOIDED:'t-gr',JUDGING:'t-gr'}[d];
  const tip = d=='PUSH_FAILED' ? ` title="${esc(syncReason(r))}，系统自动重试，请勿重复建单"` : '';
  return `<span class="tag ${cls}"${tip}><span class="dot"></span>${ST_LABEL[d]}</span>`;
}
function dirTag(dir){ return dir=='ADDITION'
  ? '<span class="tag t-g"><span class="dot"></span>正向 · 补商家</span>'
  : '<span class="tag t-r"><span class="dot"></span>负向 · 扣商家</span>'; }
function fmtAmt(sign, amount){ return `${sign>0?'+':'-'}${money(amount)}`; }
function amtCell(r){
  const s=adjSign(r), voided=r.status=='voided';
  const style = voided ? 'color:var(--tt);text-decoration:line-through' : `color:${s>0?'var(--g)':'var(--r)'};font-weight:700`;
  return `<span style="${style}">${fmtAmt(s,r.amount)}</span>`;
}
const srcLabel = r => r.sourceType=='SHORTAGE_FINE' ? '缺货罚款' : '人工建单';

function adjRows(){
  const f=DB.adjFilter, hit=(v,k)=>!k||String(v||'').toLowerCase().includes(String(k).trim().toLowerCase());
  return adjAll().filter(r=>
       hit(shopName(r.shopCode)+' '+r.shopCode, f.shop)
    && (!f.no || hit(r.adjustNo,f.no) || hit(r.bizNo,f.no))
    && (!f.type||r.adjustTypeCode==f.type) && (!f.dir||adjDir(r)==f.dir)
    && (!f.src||r.sourceType==f.src) && (!f.st||displayStatus(r)==f.st)
    && (!f.from||r.effectiveTime.slice(0,10)>=f.from) && (!f.to||r.effectiveTime.slice(0,10)<=f.to));
}

/* ================= 列表页 ================= */
PAGES['p-adjust']=()=>{
  const f=DB.adjFilter, rows=adjRows();
  const canSel=rows.filter(selectable);
  DB.adjSel=DB.adjSel.filter(no=>canSel.some(r=>r.adjustNo==no));
  const allSel=canSel.length&&canSel.every(r=>DB.adjSel.includes(r.adjustNo));
  const opt=(v,cur,l)=>`<option value="${v}" ${cur==v?'selected':''}>${l}</option>`;

  return `${flowTip('')}
  <div class="card" style="margin-bottom:14px"><div class="card-bd" style="padding:16px 20px 12px">
    <div class="fg3">
      <div class="fr"><label class="fl">店铺</label><input id="af-shop" value="${esc(f.shop)}" placeholder="店铺名称或编码" list="af-shoplist"><datalist id="af-shoplist">${Object.keys(SHOPS).map(c=>`<option>${shopName(c)}</option>`).join('')}</datalist></div>
      <div class="fr"><label class="fl">调整单号 / 关联业务单号</label><input id="af-no" value="${esc(f.no)}" placeholder="如 ADJ-SG-20260909-002"></div>
      <div class="fr"><label class="fl">调整类型</label><select id="af-type">${opt('',f.type,'全部')}${DB.adjTypes.map(t=>opt(t.code,f.type,t.cn+(t.on?'':'（已停用）'))).join('')}</select></div>
    </div>
    <div class="fg3">
      <div class="fr"><label class="fl">方向</label><select id="af-dir">${opt('',f.dir,'全部')}${opt('ADDITION',f.dir,'正向 · 补商家')}${opt('DEDUCTION',f.dir,'负向 · 扣商家')}</select></div>
      <div class="fr"><label class="fl">来源</label><select id="af-src">${opt('',f.src,'全部')}${opt('MANUAL',f.src,'人工建单')}${opt('SHORTAGE_FINE',f.src,'缺货罚款')}</select></div>
      <div class="fr"><label class="fl">状态</label><select id="af-st">${opt('',f.st,'全部')}${['PENDING','PUSHED','PUSH_FAILED','VOIDED','JUDGING'].map(k=>opt(k,f.st,ST_LABEL[k])).join('')}</select></div>
    </div>
    <div class="fg3">
      <div class="fr"><label class="fl">生效时间 起</label><input id="af-from" type="date" value="${f.from}"></div>
      <div class="fr"><label class="fl">生效时间 止</label><input id="af-to" type="date" value="${f.to}"></div>
      <div class="fr"></div>
    </div>
    <div class="row" style="justify-content:flex-end;gap:8px;margin-top:2px">
      <button class="btn btn-o" onclick="adj_reset()">重置</button>
      <button class="btn btn-p" onclick="adj_query()">查询</button>
    </div>
  </div></div>

  <div class="card">
    <div class="selbar" style="display:flex;align-items:center;gap:10px;padding:10px 16px;background:#F0FBF4;border-bottom:1px solid var(--bd);font-size:13px">
      <span style="color:var(--ts)">已选 <b style="color:var(--tp)">${DB.adjSel.length}</b> 张</span>
      <span style="flex:1"></span>
      <button class="btn btn-o btn-sm" ${DB.adjSel.length?'':'disabled'} onclick="adj_pushAsk()">推送</button>
      <button class="btn btn-o btn-sm" onclick="adj_export()">导出</button>
      <button class="btn btn-p btn-sm" onclick="adj_newAsk()">新建调整单</button>
    </div>
    <div class="card-bd flush"><div style="overflow-x:auto"><table>
      <thead><tr>
        <th style="width:34px"><input type="checkbox" class="skuchk" title="全选当前页待推送" ${allSel?'checked':''} onclick="adj_selAll()"></th>
        <th>调整单号</th><th>店铺名称</th><th>店铺编码</th><th style="text-align:right">金额</th>
        <th>调整类型</th><th>来源</th><th>生效时间</th><th>状态</th><th>操作</th>
      </tr></thead><tbody>
      ${rows.map(r=>`<tr>
        <td>${selectable(r)?`<input type="checkbox" class="skuchk" ${DB.adjSel.includes(r.adjustNo)?'checked':''} onclick="adj_toggle('${r.adjustNo}')">`:''}</td>
        <td class="mono" style="white-space:nowrap">${r.adjustNo}</td>
        <td style="white-space:nowrap">${esc(shopName(r.shopCode))}</td>
        <td class="mono" style="white-space:nowrap">${r.shopCode}</td>
        <td style="text-align:right;white-space:nowrap">${amtCell(r)}</td>
        <td style="white-space:nowrap">${esc(r.adjustTypeName)}</td>
        <td style="white-space:nowrap">${srcLabel(r)}</td>
        <td style="white-space:nowrap;color:var(--ts)">${r.effectiveTime}</td>
        <td style="white-space:nowrap">${statusTag(r)}</td>
        <td style="white-space:nowrap"><button class="btn btn-o btn-sm" onclick="adj_detail('${r.adjustNo}')">详情</button></td>
      </tr>`).join('')||`<tr><td colspan="10" style="text-align:center;color:var(--ts);padding:22px">${adjAll().length?'没有符合筛选条件的调整单':'暂无业务调整单'}</td></tr>`}
      </tbody></table></div>
      <div class="card-bd" style="border-top:1px solid var(--bd2);font-size:12.5px;color:var(--ts);text-align:right">共 ${rows.length} 条 · 每页 50 条</div>
    </div>`;
};

window.adj_query=function(){
  const g=id=>(document.getElementById(id)||{}).value||'';
  DB.adjFilter={shop:g('af-shop').trim(),no:g('af-no').trim(),type:g('af-type'),dir:g('af-dir'),src:g('af-src'),st:g('af-st'),from:g('af-from'),to:g('af-to')};
  DB.adjSel=[];render();
};
window.adj_reset=function(){DB.adjFilter=DEFAULT_FILTER();DB.adjSel=[];render();toast('筛选条件已重置','info');};
window.adj_toggle=function(no){const i=DB.adjSel.indexOf(no);i<0?DB.adjSel.push(no):DB.adjSel.splice(i,1);render();};
window.adj_selAll=function(){
  const sel=adjRows().filter(selectable).map(r=>r.adjustNo);
  DB.adjSel=(sel.length&&sel.every(n=>DB.adjSel.includes(n)))?[]:sel.slice();render();
};
window.adj_export=function(){
  const n=adjRows().length;
  if(n>50000){toast('导出结果超过 50,000 行，请缩小筛选范围','err');return;}
  toast(`已导出 ${n} 条：业务调整单_SG_${ts().replace(/[-: ]/g,'').slice(0,12)}.xlsx`,'ok');
};

/* ================= 新建弹窗（普通 / 纠正单 / 作废并重新建单） ================= */
// mode: 'new' | 'correct' | 'recreate'；DB.adjDraft 保存表单内容，「返回修改」回填
window.adj_newAsk=function(keep, mode, src){
  if(!keep){
    const o = src ? adjOf(src) : null;
    DB.adjDraft = {mode:mode||'new', srcNo:src||'', sc:'', tc:'', amt:'', biz:'', rk:''};
    if(o && mode=='correct'){ DB.adjDraft.sc=o.shopCode; DB.adjDraft.biz=o.adjustNo; }
    if(o && mode=='recreate'){ Object.assign(DB.adjDraft,{sc:o.shopCode,tc:o.adjustTypeCode,amt:o.amount.toFixed(2),biz:o.bizNo,rk:o.remark}); }
  }
  const d=DB.adjDraft, o=d.srcNo?adjOf(d.srcNo):null;
  const types=(DB.adjTypes||[]).filter(t=>t.on&&!t.sys);
  const group=(dir,label)=>`<optgroup label="${label}">${types.filter(t=>t.dir==dir).map(t=>`<option value="${t.code}" ${d.tc==t.code?'selected':''}>${t.cn}</option>`).join('')}</optgroup>`;
  const lockShop = d.mode=='correct';
  const title = {new:'新建业务调整单', correct:'新建纠正单', recreate:'重新建单'}[d.mode];
  modalWide(`<div class="mc-hd"><h3>${title}</h3><button class="mc-x" onclick="closeModal()">×</button></div>
  <div class="mc-bd">
    ${d.mode=='correct'&&o?`<div class="ib ib-b" style="margin-bottom:12px"><span class="i">↩︎</span>纠正原单 <span class="mono">${o.adjustNo}</span>：${esc(o.adjustTypeName)} ${fmtAmt(adjSign(o),o.amount)}</div>`:''}
    <div class="fg2">
      <div class="fr"><label class="fl"><b>*</b>店铺</label>
        ${lockShop?`<input value="${esc(shopName(d.sc))}（${d.sc}）" readonly style="background:#F3F4F6;color:var(--ts)"><input type="hidden" id="an-shop" value="${d.sc}">`
          :`<select id="an-shop" onchange="adj_shopChange()"><option value="">请选择店铺</option>${Object.keys(SHOPS).map(c=>`<option value="${c}" ${d.sc==c?'selected':''}>${shopName(c)}（${c}）${SHOPS[c].stopped?'（已停用）':''}</option>`).join('')}</select>`}
        <div id="an-shop-err" class="fl-h" style="color:var(--r)"></div><div id="an-shop-stop" class="fl-h" style="color:var(--y)"></div></div>
      <div class="fr"><label class="fl">所属商家</label><div id="an-mc" style="padding:9px 0">—</div></div>
    </div>
    <div class="fg2">
      <div class="fr"><label class="fl"><b>*</b>调整类型</label><select id="an-type" onchange="adj_typeChange()"><option value="">请选择调整类型</option>${group('DEDUCTION','负向 · 扣商家')}${group('ADDITION','正向 · 补商家')}</select><div id="an-type-err" class="fl-h" style="color:var(--r)"></div></div>
      <div class="fr"><label class="fl">方向</label><div id="an-dir" style="padding:9px 0">—</div></div>
    </div>
    <div class="fg2">
      <div class="fr"><label class="fl"><b>*</b>金额（S$）</label><input id="an-amt" inputmode="decimal" value="${d.amt}" placeholder="0.00" onkeydown="adj_amtKey(event)" oninput="adj_amtInput()" onblur="adj_amtBlur()"><div id="an-amt-pre" class="fl-h" style="color:var(--ts)">请先选择调整类型</div><div id="an-amt-err" class="fl-h" style="color:var(--r)"></div></div>
      <div class="fr"><label class="fl" id="an-bizl">关联业务单号</label><input id="an-biz" value="${esc(d.biz)}" ${d.mode=='correct'?'readonly style="background:#F3F4F6;color:var(--ts)"':''} placeholder="订单号 / 送货单号 / 售后单号"><div id="an-biz-err" class="fl-h" style="color:var(--r)"></div></div>
    </div>
    <div class="fr"><label class="fl"><b>*</b>调整说明 <span id="an-rk-cnt" style="float:right;font-weight:400;color:var(--tt)">0/500</span></label><textarea id="an-remark" rows="3" oninput="adj_rkCount()">${esc(d.rk)}</textarea><div id="an-rk-err" class="fl-h" style="color:var(--r)"></div></div>
    <div class="fr"><label class="fl">附件</label><div class="up" onclick="toast('原型不做真实上传','info')"><div class="uic">📎</div><div class="ut">点击上传</div><div class="us">jpg / png / pdf，单个 ≤ 10MB，最多 5 个</div></div></div>
  </div>
  <div class="mc-ft">
    <button class="btn btn-link" onclick="closeModal()">取消</button>
    <button class="btn btn-o" onclick="adj_newSubmit(true)">新建并推送</button>
    <button class="btn btn-p" onclick="adj_newSubmit(false)">新建</button>
  </div>`);
  adj_shopChange(); adj_typeChange(); adj_rkCount();
  if(d.mode=='recreate'){ const a=document.getElementById('an-amt'); if(a&&a.focus) a.focus(); }
};
window.adj_shopChange=function(){
  const c=(document.getElementById('an-shop')||{}).value, s=SHOPS[c]||{};
  const el=document.getElementById('an-mc'); if(el) el.innerHTML=c?(s.merchant?`${merchantName(s.merchant)} <span class="mono" style="color:var(--ts)">${s.merchant}</span>`:'—'):'—';
  const st=document.getElementById('an-shop-stop'); if(st) st.textContent=s.stopped?'该店铺已停用':'';
};
window.adj_typeChange=function(){
  const code=(document.getElementById('an-type')||{}).value, t=code?tOf(code):null;
  const d=document.getElementById('an-dir'); if(d) d.innerHTML=t?dirTag(t.dir):'—';
  const l=document.getElementById('an-bizl'); if(l) l.innerHTML=(t&&t.needBiz?'<b>*</b>':'')+'关联业务单号'+(t&&!t.needBiz?'（选填）':'');
  adj_amtInput();
};
window.adj_amtKey=function(e){ if(['-','e','E','+',','].includes(e.key)) e.preventDefault(); };
window.adj_amtInput=function(){
  const a=document.getElementById('an-amt'); if(!a) return;
  const cleaned=String(a.value||'').replace(/[^0-9.]/g,'').replace(/(\..*)\./g,'$1');
  if(cleaned!==a.value) a.value=cleaned;
  const code=(document.getElementById('an-type')||{}).value, pre=document.getElementById('an-amt-pre');
  if(!pre||!pre.style) return;
  if(!code){ pre.textContent='请先选择调整类型'; pre.style.color='var(--ts)'; return; }
  const v=+cleaned||0, plus=tOf(code).dir=='ADDITION';
  pre.textContent = plus ? `将补给商家 ${fmtAmt(1,v)}` : `将向商家扣回 ${fmtAmt(-1,v)}`;
  pre.style.color = plus ? 'var(--g)' : 'var(--r)';
};
window.adj_amtBlur=function(){
  const v=String((document.getElementById('an-amt')||{}).value||''), e=document.getElementById('an-amt-err');
  if(e) e.textContent = /\.\d{3,}$/.test(v) ? '金额最多两位小数' : '';
};
window.adj_rkCount=function(){
  const v=String((document.getElementById('an-remark')||{}).value||'').trim(), c=document.getElementById('an-rk-cnt');
  if(c) c.textContent=[...v].length+'/500';
};
// 一次性校验全部字段，错误显示在字段下方
function validateDraft(){
  const g=id=>String((document.getElementById(id)||{}).value||'').trim();
  const d={sc:g('an-shop'), tc:g('an-type'), amt:g('an-amt'), biz:g('an-biz'), rk:g('an-remark')};
  const err={};
  if(!d.sc) err.shop='请选择店铺'; else if(!(SHOPS[d.sc]||{}).merchant) err.shop='该店铺未绑定商家，无法建单';
  if(!d.tc) err.type='请选择调整类型';
  if(!(+d.amt>0)) err.amt='请填写大于 0 的金额'; else if(/\.\d{3,}$/.test(d.amt)) err.amt='金额最多两位小数'; else if(+d.amt>9999999999.99) err.amt='金额超出可录入范围';
  if(d.tc&&tOf(d.tc).needBiz&&!d.biz) err.biz='该调整类型必须填写关联业务单号';
  else if(d.biz&&!/^[A-Za-z0-9_-]{1,64}$/.test(d.biz)) err.biz='关联业务单号仅支持字母、数字、- 和 _，最多 64 位';
  if(!d.rk) err.rk='请填写调整说明'; else if([...d.rk].length>500) err.rk='调整说明不能超过 500 字';
  [['shop','an-shop-err'],['type','an-type-err'],['amt','an-amt-err'],['biz','an-biz-err'],['rk','an-rk-err']].forEach(([k,id])=>{const el=document.getElementById(id); if(el) el.textContent=err[k]||'';});
  return {d, ok:!Object.keys(err).length, err};
}
window.adjValidateDraft = validateDraft;
function dupInfo(sc,tc,amt){
  const from=dayStr(-6);
  const hits=(DB.adjOrders||[]).filter(r=>r.status=='effective'&&r.shopCode==sc&&r.adjustTypeCode==tc&&r.amount==+amt&&r.effectiveTime.slice(0,10)>=from);
  return {count:hits.length, retrying:hits.filter(r=>displayStatus(r)=='PUSH_FAILED').map(r=>r.adjustNo)};
}
window.adj_newSubmit=function(withPush){
  const {d,ok}=validateDraft(); if(!ok) return;
  Object.assign(DB.adjDraft,{sc:d.sc,tc:d.tc,amt:d.amt,biz:d.biz,rk:d.rk});
  const dup=dupInfo(d.sc,d.tc,d.amt);
  if(!withPush&&!dup.count){ adj_newDo(false); return; }
  adj_newConfirm(withPush,dup);
};
window.adj_newConfirm=function(withPush,dup){
  const d=DB.adjDraft, t=tOf(d.tc), mc=(SHOPS[d.sc]||{}).merchant, s=t.dir=='ADDITION'?1:-1;
  const warns=[];
  if(withPush) warns.push('<div class="ib ib-y"><span class="i">⚠️</span>推送后本单不可作废、不可撤回；如需纠正只能另建一张调整单。</div>');
  if(dup.retrying.length) warns.push(`<div class="ib ib-r"><span class="i">⛔</span>单据 <span class="mono">${dup.retrying[0]}</span> 与本单相同，正在同步重试中，系统会自动重试，重复建单会造成双份款项。</div>`);
  else if(dup.count) warns.push(`<div class="ib ib-y"><span class="i">⚠️</span>近 7 天已有 ${dup.count} 张相同店铺、类型、金额的调整单，请确认不是重复创建。</div>`);
  if(withPush&&(SHOPS[d.sc]||{}).stopped) warns.push('<div class="ib ib-y"><span class="i">⚠️</span>该店铺已停用</div>');
  modal(`<div class="mc-hd"><h3>${withPush?'确认新建并推送':'确认新建'}</h3><button class="mc-x" onclick="adj_newAsk(true)">×</button></div>
  <div class="mc-bd">
    <div style="display:flex;justify-content:space-between;align-items:baseline;margin:2px 0 12px">
      <span style="font-size:16px;font-weight:700">${esc(shopName(d.sc))}</span>
      <span style="font-size:22px;font-weight:800;color:${s>0?'var(--g)':'var(--r)'}">${fmtAmt(s,+d.amt)}</span>
    </div>
    ${warns.join('')}
    <div style="border:1px solid var(--bd);border-radius:8px;overflow:hidden;margin:10px 0 4px"><table style="margin:0"><tbody>
      <tr><td style="color:var(--ts);width:120px">所属商家</td><td>${merchantName(mc)} <span class="mono" style="color:var(--ts)">${mc}</span></td></tr>
      <tr><td style="color:var(--ts)">调整类型</td><td>${t.cn} <span class="mono" style="color:var(--ts);font-size:12px">${t.code}</span></td></tr>
      <tr><td style="color:var(--ts)">方向</td><td>${dirTag(t.dir)}</td></tr>
      <tr><td style="color:var(--ts)">关联业务单</td><td class="mono">${esc(d.biz)||'—'}</td></tr>
    </tbody></table></div>
  </div>
  <div class="mc-ft">
    <button class="btn btn-o" id="adj-back" onclick="adj_newAsk(true)">返回修改</button>
    <button class="btn btn-p" id="adj-ok" ${withPush?'disabled':''} onclick="adj_newDo(${withPush?'true':'false'})">${withPush?'确认新建并推送':'确认新建'}</button>
  </div>`);
  const back=document.getElementById('adj-back'); if(back&&back.focus) back.focus();
  if(withPush) setTimeout(()=>{const b=document.getElementById('adj-ok'); if(b) b.disabled=false;},1000);
};
window.adj_newDo=function(withPush){
  const d=DB.adjDraft; if(!d) return;
  const now=ts(), t=tOf(d.tc);
  const no='ADJ-'+(DB.siteCode||'SG')+'-'+now.slice(0,10).replace(/-/g,'')+'-'+String(DB.adjSeq++).padStart(3,'0');
  DB.adjOrders.unshift({adjustNo:no, shopCode:d.sc, merchantCode:(SHOPS[d.sc]||{}).merchant||'',
    adjustTypeCode:d.tc, adjustTypeName:t.cn, amount:+(+d.amt).toFixed(2), currency:'SGD',
    bizNo:d.biz, remark:d.rk, effectiveTime:now, createdBy:'当前账号', sourceType:'MANUAL', status:'effective', voidReason:'',
    pushStatus:withPush?'PUSHED':'PENDING', syncStatus:withPush?'SUCCESS':'', syncErrorText:'', pushedAt:withPush?now:'', pushedBy:withPush?'当前账号':''});
  addLog(no,'创建调整单'); if(withPush) addLog(no,'推送');
  DB.adjDraft=null; closeModal(); DB.adjSel=[]; render();
  toast(`调整单 ${no} ${withPush?'已新建并推送':'已新建，待推送'} <a style="color:inherit;text-decoration:underline;cursor:pointer;margin-left:6px" onclick="adj_detail('${no}')">查看</a>`,'ok');
};

/* ================= 详情抽屉 ================= */
window.adj_detail=function(no){
  const r=adjOf(no); if(!r) return;
  const t=tOf(r.adjustTypeCode), s=adjSign(r), voided=r.status=='voided', ds=displayStatus(r);
  const kv=(k,v)=>`<div style="min-width:0"><div style="font-size:12px;color:var(--ts);margin-bottom:4px">${k}</div><div style="font-size:13.5px;color:var(--tp);word-break:break-word">${v||'—'}</div></div>`;
  const sec=x=>`<div style="display:flex;align-items:center;gap:10px;margin:18px 0 12px"><span style="width:4px;height:16px;background:var(--g);border-radius:2px"></span><h3 style="font-size:14.5px;font-weight:700">${x}</h3></div>`;
  const grid=h=>`<div style="display:grid;grid-template-columns:1fr 1fr;gap:14px 20px">${h}</div>`;
  const logs = isManual(r) ? logOf(r.adjustNo)
    : [{t:r.effectiveTime,u:'系统',c:'到仓少货自动生成罚款单'}].concat(r.pushedAt?[{t:r.pushedAt,u:'运营',c:'推送'}]:[]);

  drawer(`<div class="drawer-hd"><div><h3>${r.adjustNo}</h3><div style="font-size:12.5px;color:var(--ts);margin-top:2px">${esc(r.adjustTypeName)} · ${esc(shopName(r.shopCode))}</div></div><span class="x" onclick="closeDrawer()">×</span></div>
  <div class="drawer-bd">
    <div style="font-size:30px;font-weight:800;letter-spacing:-.5px;margin:4px 0 2px;${voided?'color:var(--tt);text-decoration:line-through':`color:${s>0?'var(--g)':'var(--r)'}`}">${fmtAmt(s,r.amount)}</div>
    <div style="font-size:12.5px;color:var(--ts)">${s>0?'将补给商家':'向商家扣回'} · ${r.currency}</div>
    ${voided&&isManual(r)?`<div class="ib ib-gr" style="margin-top:12px"><span class="i">🚫</span>本单已作废，不会推送给下游。作废原因：${esc(r.voidReason)}</div>`:''}
    <div class="row" style="gap:8px;margin-top:12px">${dirTag(adjDir(r))}<span class="tag t-gr"><span class="dot"></span>${srcLabel(r)}</span>${statusTag(r)}</div>

    ${sec('单据信息')}
    ${grid(kv('店铺名称',esc(shopName(r.shopCode)))+kv('店铺编码',`<span class="mono">${r.shopCode}</span>`)
      +kv('调整类型',`${esc(r.adjustTypeName)} <span class="mono" style="font-size:12px;color:var(--ts)">${t.code}</span>`)
      +kv('方向',adjDir(r)=='ADDITION'?'正向 · 补商家':'负向 · 扣商家')
      +kv('关联业务单号',`<span class="mono">${esc(r.bizNo)||'—'}</span>`)+kv('生效时间',r.effectiveTime)
      +kv('来源',isManual(r)?'人工建单':`缺货罚款 · <span class="mono">${r.adjustNo}</span>`)+kv('币种',r.currency))}

    ${sec('财务归集')}
    ${grid(kv('商家名称',merchantName(r.merchantCode))+kv('商家编码',`<span class="mono">${r.merchantCode||'—'}</span>`))}

    ${isManual(r)?sec('调整说明')+`<div style="background:var(--bg);border:1px solid var(--bd2);border-radius:8px;padding:12px 14px;font-size:13px;line-height:1.7">${esc(r.remark)}</div>`:''}

    ${voided?'':sec('推送信息')+grid(kv('状态',statusTag(r))+kv('推送时间',r.pushedAt)+kv('推送人',r.pushedBy))
      +(ds=='PUSH_FAILED'?`<div class="ib ib-y" style="margin-top:12px"><span class="i">⏳</span>${esc(syncReason(r))}。系统自动重试，请勿重复建单。</div>`:'')
      +(unconfirmed(r)?'<div style="font-size:12.5px;color:var(--ts);margin-top:8px">下游确认中</div>':'')}

    ${sec('操作记录')}
    <table><thead><tr><th>操作时间</th><th>操作人</th><th>内容</th></tr></thead><tbody>
      ${logs.map(l=>`<tr><td style="white-space:nowrap">${l.t}</td><td style="white-space:nowrap">${esc(l.u)}</td><td>${esc(l.c)}</td></tr>`).join('')}
    </tbody></table>
  </div>
  <div class="drawer-ft">
    <button class="btn btn-o" onclick="closeDrawer()">关闭</button>
    ${canVoid(r)?`<button class="btn btn-d" onclick="adj_voidAsk('${r.adjustNo}')">作废</button>`:''}
    ${canCorrect(r)?`<button class="btn btn-o" onclick="closeDrawer();adj_newAsk(false,'correct','${r.adjustNo}')">新建纠正单</button>`:''}
    ${!isManual(r)&&typeof fine_detail=='function'?`<button class="btn btn-o" onclick="closeDrawer();fine_detail('${r.adjustNo}')">查看罚款单明细</button>`:''}
  </div>`);
};

/* ================= 作废 ================= */
window.adj_voidAsk=function(no){
  const r=adjOf(no); if(!r||!canVoid(r)) return;
  const s=adjSign(r);
  modal(`<div class="mc-hd"><h3>作废调整单</h3><p>${r.adjustNo} · 尚未推送</p><button class="mc-x" onclick="closeModal()">×</button></div>
  <div class="mc-bd">
    <div class="ib ib-y"><span class="i">⚠️</span>作废后本单不会推送给下游，且不可恢复。</div>
    <div style="border:1px solid var(--bd);border-radius:8px;overflow:hidden;margin:10px 0 12px"><table style="margin:0"><tbody>
      <tr><td style="color:var(--ts);width:120px">店铺</td><td>${esc(shopName(r.shopCode))} <span class="mono" style="color:var(--ts)">${r.shopCode}</span></td></tr>
      <tr><td style="color:var(--ts)">调整类型</td><td>${esc(r.adjustTypeName)}</td></tr>
      <tr><td style="color:var(--ts)">金额</td><td><span style="color:${s>0?'var(--g)':'var(--r)'};font-weight:700">${fmtAmt(s,r.amount)}</span></td></tr>
    </tbody></table></div>
    <div class="fr"><label class="fl"><b>*</b>作废原因</label><textarea id="av-why" rows="3"></textarea><div id="av-err" class="fl-h" style="color:var(--r)"></div></div>
  </div>
  <div class="mc-ft">
    <button class="btn btn-link" onclick="closeModal()">取消</button>
    <button class="btn btn-o" onclick="adj_voidDo('${r.adjustNo}',true)">作废并重新建单</button>
    <button class="btn btn-d" onclick="adj_voidDo('${r.adjustNo}',false)">确认作废</button>
  </div>`);
};
window.adj_voidDo=function(no,recreate){
  const r=(DB.adjOrders||[]).find(x=>x.adjustNo==no); if(!r) return;
  if(!(r.pushStatus=='PENDING'&&r.status=='effective')){closeModal();closeDrawer();render();toast('该单已被推送或已作废，无法作废','err');return;}
  const why=String((document.getElementById('av-why')||{}).value||'').trim(), e=document.getElementById('av-err');
  if(!why){ if(e) e.textContent='请填写作废原因'; return; }
  if([...why].length>200){ if(e) e.textContent='作废原因不能超过 200 字'; return; }
  r.status='voided'; r.voidReason=why; addLog(no,'作废，原因：'+why);
  DB.adjSel=DB.adjSel.filter(x=>x!=no);
  closeModal();closeDrawer();render();
  if(recreate) adj_newAsk(false,'recreate',no);
  else toast('调整单 '+no+' 已作废','ok');
};

/* ================= 批量推送（人工单） ================= */
DB.adjPushOpen = DB.adjPushOpen || {};
window.adj_pushAsk=function(){
  const rows=adjAll().filter(r=>DB.adjSel.includes(r.adjustNo)&&selectable(r));
  if(!rows.length){toast('请先勾选待推送的调整单','err');return;}
  if(rows.length>500){toast('单次最多推送 500 张，请缩小筛选范围分次推送','err');return;}
  const r2=n=>+n.toFixed(2);
  const byShop={}; rows.forEach(r=>{(byShop[r.shopCode]=byShop[r.shopCode]||[]).push(r);});
  const sum=(a,sign)=>a.filter(r=>adjSign(r)==sign).reduce((x,r)=>r2(x+r.amount),0);
  const shops=Object.keys(byShop).map(c=>{const a=byShop[c],plus=sum(a,1),minus=sum(a,-1);return {c,a,plus,minus,net:r2(plus-minus)};})
    .sort((x,y)=>Math.abs(y.net)-Math.abs(x.net));
  const netCell=v=>v===0?`<span style="color:var(--tt)">${money(0)}</span>`:`<span style="color:${v>0?'var(--g)':'var(--r)'};font-weight:600">${fmtAmt(v>0?1:-1,Math.abs(v))}</span>`;
  const showAll=DB.adjPushShowAll||shops.length<=10, visible=showAll?shops:shops.slice(0,5);
  const plusAll=sum(rows,1), minusAll=sum(rows,-1);
  modal(`<div class="mc-hd"><h3>推送调整单</h3><p>将 ${rows.length} 张调整单推送至下游</p><button class="mc-x" onclick="DB.adjPushOpen={};DB.adjPushShowAll=false;closeModal()">×</button></div>
  <div class="mc-bd">
    <div class="ib ib-y"><span class="i">⚠️</span>推送后不可重复推送，也不可在本页撤回。请核对店铺与金额。</div>
    <div style="border:1px solid var(--bd);border-radius:8px;overflow:hidden;margin:10px 0 12px"><table style="margin:0">
      <thead><tr><th>店铺</th><th>店铺编码</th><th style="text-align:right">单数</th><th style="text-align:right">补商家合计</th><th style="text-align:right">扣商家合计</th><th style="text-align:right">净额</th></tr></thead><tbody>
      ${visible.map(x=>`<tr style="cursor:pointer" onclick="DB.adjPushOpen['${x.c}']=!DB.adjPushOpen['${x.c}'];adj_pushAsk()">
          <td>${DB.adjPushOpen[x.c]?'▾':'▸'} ${esc(shopName(x.c))}</td><td class="mono">${x.c}</td><td style="text-align:right">${x.a.length}</td>
          <td style="text-align:right;color:var(--g)">${x.plus?fmtAmt(1,x.plus):'—'}</td><td style="text-align:right;color:var(--r)">${x.minus?fmtAmt(-1,x.minus):'—'}</td>
          <td style="text-align:right">${netCell(x.net)}</td></tr>
        ${DB.adjPushOpen[x.c]?x.a.map(r=>`<tr style="background:#FAFBF9;font-size:12.5px"><td colspan="3" class="mono" style="padding-left:28px">${r.adjustNo}</td><td colspan="2">${esc(r.adjustTypeName)}</td><td style="text-align:right;color:${adjSign(r)>0?'var(--g)':'var(--r)'}">${fmtAmt(adjSign(r),r.amount)}</td></tr>`).join(''):''}`).join('')}
      ${showAll?'':`<tr><td colspan="6" style="text-align:center"><button class="btn btn-link btn-sm" onclick="DB.adjPushShowAll=true;adj_pushAsk()">展开其余 ${shops.length-5} 个店铺</button></td></tr>`}
      <tr style="background:#F7FBF8;font-weight:700"><td colspan="2">SGD 小计</td><td style="text-align:right">${rows.length}</td>
        <td style="text-align:right;color:var(--g)">${plusAll?fmtAmt(1,plusAll):'—'}</td><td style="text-align:right;color:var(--r)">${minusAll?fmtAmt(-1,minusAll):'—'}</td><td style="text-align:right">${netCell(r2(plusAll-minusAll))}</td></tr>
    </tbody></table></div>
  </div>
  <div class="mc-ft"><button class="btn btn-o" onclick="DB.adjPushOpen={};DB.adjPushShowAll=false;closeModal()">取消</button><button class="btn btn-p" onclick="adj_pushDo()">确认推送</button></div>`);
};
window.adj_pushDo=function(){
  const now=ts(); let pushed=0, skipped=0;
  DB.adjSel.forEach(no=>{
    const m=(DB.adjOrders||[]).find(x=>x.adjustNo==no);
    if(m&&m.pushStatus=='PENDING'&&m.status=='effective'){ m.pushStatus='PUSHED'; m.syncStatus=''; m.pushedAt=now; m.pushedBy='当前账号'; addLog(no,'推送'); pushed++; }
    else skipped++;
  });
  DB.adjSel=[]; DB.adjPushOpen={}; DB.adjPushShowAll=false; closeModal();
  if(DB.adjFilter.st=='PENDING') DB.adjFilter.st='';
  render();
  toast(pushed?`已推送 ${pushed} 张${skipped?`，跳过 ${skipped} 张（已被他人推送或已作废）`:''}`:`所选 ${skipped} 张已被他人推送或已作废`, pushed?'ok':'info');
};

/* ================= 调整类型配置 ================= */
PAGES['p-adjust-type']=()=>{
  const used=c=>(DB.adjOrders||[]).filter(r=>r.adjustTypeCode==c).length;
  return `${flowTip('')}
  <div class="card">
    <div class="card-hd"><h3>调整类型</h3>
      <div class="row" style="margin-left:auto"><button class="btn btn-p btn-sm" onclick="DB.adjtDraft=null;adjt_edit('')">新增类型</button></div>
    </div>
    <div class="card-bd flush"><div style="overflow-x:auto"><table>
      <thead><tr><th>类型编码</th><th>中文名称</th><th>英文名称</th><th>方向</th><th>关联业务单号</th><th>来源</th><th style="text-align:right">已用单数</th><th>状态</th><th>操作</th></tr></thead>
      <tbody>${DB.adjTypes.map(t=>`<tr>
        <td class="mono" style="white-space:nowrap">${t.code}</td>
        <td>${esc(t.cn)}</td>
        <td style="color:var(--ts)">${esc(t.en)}</td>
        <td style="white-space:nowrap">${dirTag(t.dir)}</td>
        <td>${t.needBiz?'必填':'选填'}</td>
        <td>${t.sys?'系统生成':'人工建单'}</td>
        <td style="text-align:right">${t.sys?'—':used(t.code)}</td>
        <td>${t.on?'<span class="tag t-g"><span class="dot"></span>启用</span>':'<span class="tag t-gr"><span class="dot"></span>停用</span>'}</td>
        <td style="white-space:nowrap">${t.sys?'':`<button class="btn btn-o btn-sm" onclick="adjt_edit('${t.code}')">编辑</button><button class="btn btn-o btn-sm" style="margin-left:6px" onclick="adjt_toggle('${t.code}')">${t.on?'停用':'启用'}</button>`}</td>
      </tr>`).join('')}</tbody>
    </table></div></div>
  </div>`;
};
window.adjt_edit=function(code){
  const isNew=!code, t=isNew?(DB.adjtDraft||{code:'',cn:'',en:'',dir:'',needBiz:0}):tOf(code);
  const ro='readonly style="background:#F3F4F6;color:var(--ts)"';
  const card=(dir,label)=>`<div onclick="DB.adjtDraft=Object.assign(adjt_read(),{dir:'${dir}'});adjt_edit('')" style="flex:1;cursor:pointer;border:1.5px solid ${t.dir==dir?'var(--g)':'var(--bd)'};background:${t.dir==dir?'var(--gl)':'#fff'};border-radius:8px;padding:10px;text-align:center">${label}</div>`;
  modal(`<div class="mc-hd"><h3>${isNew?'新增调整类型':'编辑调整类型'}</h3><button class="mc-x" onclick="DB.adjtDraft=null;closeModal()">×</button></div>
  <div class="mc-bd">
    <div class="fg2">
      <div class="fr"><label class="fl"><b>*</b>类型编码</label><input id="at-code" value="${esc(t.code)}" placeholder="如 ADJ-STORAGE" ${isNew?'':ro}><div id="at-code-err" class="fl-h" style="color:var(--r)"></div></div>
      <div class="fr"><label class="fl"><b>*</b>方向</label>${isNew?`<div style="display:flex;gap:8px">${card('DEDUCTION','负向 · 扣商家')}${card('ADDITION','正向 · 补商家')}</div><div id="at-dir-err" class="fl-h" style="color:var(--r)"></div>`:`<input value="${t.dir=='ADDITION'?'正向 · 补商家':'负向 · 扣商家'}" ${ro}>`}</div>
    </div>
    <div class="fg2">
      <div class="fr"><label class="fl"><b>*</b>中文名称</label><input id="at-cn" value="${esc(t.cn)}"><div id="at-cn-err" class="fl-h" style="color:var(--r)"></div></div>
      <div class="fr"><label class="fl">英文名称</label><input id="at-en" value="${esc(t.en)}"></div>
    </div>
    <div class="fr"><label class="fl">关联业务单号</label><select id="at-biz"><option value="0" ${t.needBiz?'':'selected'}>选填</option><option value="1" ${t.needBiz?'selected':''}>必填</option></select></div>
  </div>
  <div class="mc-ft"><button class="btn btn-o" onclick="DB.adjtDraft=null;closeModal()">取消</button><button class="btn btn-p" onclick="adjt_save('${code}')">保存</button></div>`);
};
window.adjt_read=function(){
  const g=id=>String((document.getElementById(id)||{}).value||'').trim();
  return {code:g('at-code'), cn:g('at-cn'), en:g('at-en'), needBiz:+g('at-biz'), dir:(DB.adjtDraft||{}).dir||''};
};
window.adjt_save=function(code, confirmed){
  const v = confirmed ? DB.adjtDraft : adjt_read();
  const set=(id,m)=>{const el=document.getElementById(id); if(el) el.textContent=m||'';};
  if(!confirmed){
    let bad=false;
    if(!code){
      if(!/^[A-Z][A-Z0-9-]{1,31}$/.test(v.code)){set('at-code-err','类型编码须以大写字母开头，仅含大写字母、数字和 -，2–32 位');bad=true;}
      else if(DB.adjTypes.some(t=>t.code==v.code)){set('at-code-err','类型编码已存在');bad=true;} else set('at-code-err','');
      if(!v.dir){set('at-dir-err','请选择方向');bad=true;} else set('at-dir-err','');
    }
    if(!v.cn||[...v.cn].length>32){set('at-cn-err','请填写中文名称，最多 32 字');bad=true;}
    else if(DB.adjTypes.some(t=>t.cn==v.cn&&t.code!==code)){set('at-cn-err','中文名称已存在');bad=true;} else set('at-cn-err','');
    if(bad) return;
    if(!code){
      DB.adjtDraft=v;
      modal(`<div class="mc-hd"><h3>确认保存</h3><button class="mc-x" onclick="adjt_edit('')">×</button></div>
      <div class="mc-bd"><div class="ib ib-y"><span class="i">⚠️</span>方向【${v.dir=='ADDITION'?'正向 · 补商家':'负向 · 扣商家'}】与类型编码【${esc(v.code)}】保存后不可修改，确认保存？</div></div>
      <div class="mc-ft"><button class="btn btn-o" onclick="adjt_edit('')">返回修改</button><button class="btn btn-p" onclick="adjt_save('',true)">确认保存</button></div>`);
      return;
    }
  }
  if(code){ const t=tOf(code); t.cn=v.cn; t.en=v.en; t.needBiz=v.needBiz; }
  else DB.adjTypes.push({code:v.code, cn:v.cn, en:v.en, dir:v.dir, needBiz:v.needBiz, on:1, sys:0});
  DB.adjtDraft=null; closeModal(); render(); toast('调整类型已保存','ok');
};
window.adjt_toggle=function(code){
  const t=tOf(code); if(t.sys) return;
  if(t.on){
    modal(`<div class="mc-hd"><h3>停用「${esc(t.cn)}」？</h3><button class="mc-x" onclick="closeModal()">×</button></div>
    <div class="mc-bd"><div class="ib ib-b"><span class="i">ℹ️</span>停用后不可用于新建调整单。已生成的 ${(DB.adjOrders||[]).filter(r=>r.adjustTypeCode==code).length} 张调整单不受影响。</div></div>
    <div class="mc-ft"><button class="btn btn-o" onclick="closeModal()">取消</button><button class="btn btn-p" onclick="adjt_toggleDo('${code}')">确认停用</button></div>`);
  }else adjt_toggleDo(code);
};
window.adjt_toggleDo=function(code){const t=tOf(code);t.on=t.on?0:1;closeModal();render();toast('「'+t.cn+'」已'+(t.on?'启用':'停用'),'ok');};

})();
