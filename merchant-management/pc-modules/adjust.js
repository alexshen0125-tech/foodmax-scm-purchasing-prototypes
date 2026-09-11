/* PC · 店铺运营平台 —— 业务调整单（通用正/负向款项单据）+ 调整类型配置
   ▍本模块只负责【把一笔款产生出来并交出去】，不涉及结算：
     - 不算归属结算周期、不进结算单、不回写结算状态与结算单号、不开票。
     - 交付物 = 一笔有金额、有方向、有归属商家的款项事实；下游怎么消费不在本期范围。
   ▍口径（对应功能框架 scm_运营端业务调整单_功能框架.md v0.4）：
   - BR-01 一张单 = 一个商家 × 一个类型 × 一个方向 × 一个金额 × 一个币种，金额两位小数且 > 0。
   - BR-02 调整类型是【配置数据】：编码与方向建后不可改；名称可改且随单快照；停用不影响存量单。
   - BR-03 方向绑在类型上：DEDUCTION 负向(扣商家) / ADDITION 正向(补商家)。
           **金额恒正存储**，列表按方向加 ± 号——负号进报文会被下游二次取负翻正。
   - BR-04 建单即生效，无审批、无商家确认；不可编辑、不可删除。
   - BR-05 错单只能红冲：生成一张【同类型 + 红冲标记】的反向单，资金方向取反
           （类型方向不可改，故反向用单据级 reversal 标记表达，不另建反向类型）。
   - BR-06 输出以 adjustNo 为幂等键；超时=结果未知不回滚，可重试可回查。
   - BR-08/09 罚款单【收编】：作为 sourceType=SHORTAGE_FINE 的款项来源进本列表统一输出，
           罚款单自身的生成/标准/明细/商家端展示全部不动；原「罚款单」菜单保留为按来源筛选的视图。
   依赖主文件全局：DB / money / toast / modal / modalWide / closeModal / drawer / closeDrawer
                   / render / nav / ts / flowTip / fineGroups(replenish.js)。 */
(function(){

/* ================= 调整类型（可配置，挂 DB 跨 render 持久） ================= */
DB.adjTypes = DB.adjTypes || [
  {code:'ADJ-FINE',    cn:'缺货罚款',     en:'Shortage Fine',        dir:'DEDUCTION', needBiz:1, on:1, sys:1},
  {code:'ADJ-CLAIM',   cn:'售后判责赔付', en:'After-sale Claim',     dir:'DEDUCTION', needBiz:1, on:1, sys:0},
  {code:'ADJ-DELAY',   cn:'逾期送货违约金', dir:'DEDUCTION', en:'Late Delivery Penalty', needBiz:1, on:1, sys:0},
  {code:'ADJ-QC',      cn:'质量问题扣款', en:'Quality Deduction',    dir:'DEDUCTION', needBiz:1, on:1, sys:0},
  {code:'ADJ-PROMO',   cn:'平台活动补贴', en:'Campaign Subsidy',     dir:'ADDITION',  needBiz:0, on:1, sys:0},
  {code:'ADJ-FREIGHT', cn:'物流费用补贴', en:'Logistics Subsidy',    dir:'ADDITION',  needBiz:0, on:1, sys:0},
  {code:'ADJ-COMP',    cn:'系统错账补款', en:'System Error Comp.',   dir:'ADDITION',  needBiz:0, on:1, sys:0},
  {code:'ADJ-DEPOSIT', cn:'保证金退还',   en:'Deposit Refund',       dir:'ADDITION',  needBiz:0, on:0, sys:0},
];
const tOf = c => (DB.adjTypes||[]).find(t=>t.code==c) || {code:c, cn:c, en:'', dir:'DEDUCTION', needBiz:0, on:0};
window.adjTypeOf = tOf;

/* ================= 演示数据 · 人工建单 ================= */
DB.adjOrders = DB.adjOrders || [
  {no:'ADJ-SG-20260908-001', merchant:'M2026-0815', merchantName:'绿鲜源蔬果', typeCode:'ADJ-CLAIM', typeName:'售后判责赔付',
   amt:186.00, currency:'SGD', bizNo:'AS-26090801', remark:'客户反馈菜心腐烂，判商家责任，按客户成交价赔付',
   effTime:'2026-09-08 10:22', creator:'运营 · 陈敏', out:'sent', outAt:'2026-09-08 10:22', batchNo:'AB-SG-20260908-001',
   status:'effective', reversal:0, reversalOf:'', reversedBy:''},
  {no:'ADJ-SG-20260909-002', merchant:'M2026-1103', merchantName:'万丰肉禽', typeCode:'ADJ-DELAY', typeName:'逾期送货违约金',
   amt:300.00, currency:'SGD', bizNo:'SH20260909012', remark:'9/9 送货晚到 4 小时，影响 3 家门店备货，按合同约定计违约金',
   effTime:'2026-09-09 15:40', creator:'运营 · 陈敏', out:'sent', outAt:'2026-09-09 15:40', batchNo:'AB-SG-20260909-001',
   status:'reversed', reversal:0, reversalOf:'', reversedBy:'ADJ-SG-20260910-004'},
  {no:'ADJ-SG-20260910-004', merchant:'M2026-1103', merchantName:'万丰肉禽', typeCode:'ADJ-DELAY', typeName:'逾期送货违约金',
   amt:300.00, currency:'SGD', bizNo:'SH20260909012', remark:'红冲 ADJ-SG-20260909-002：核实为平台派车延误，非商家责任',
   effTime:'2026-09-10 09:05', creator:'运营 · 陈敏', out:'sent', outAt:'2026-09-10 09:05', batchNo:'AB-SG-20260910-001',
   status:'effective', reversal:1, reversalOf:'ADJ-SG-20260909-002', reversedBy:''},
  {no:'ADJ-SG-20260910-005', merchant:'M2026-0902', merchantName:'海丰水产', typeCode:'ADJ-PROMO', typeName:'平台活动补贴',
   amt:1250.00, currency:'SGD', bizNo:'', remark:'9 月中秋海鲜专场活动，平台承担的让利补贴，线下已与商家确认金额',
   effTime:'2026-09-10 17:12', creator:'运营 · 林凯', out:'pending', outAt:'', batchNo:'',
   status:'effective', reversal:0, reversalOf:'', reversedBy:''},
  {no:'ADJ-SG-20260911-006', merchant:'M2026-0815', merchantName:'绿鲜源蔬果', typeCode:'ADJ-QC', typeName:'质量问题扣款',
   amt:78.50, currency:'SGD', bizNo:'QC-26091102', remark:'到仓抽检不合格整批拒收，按货值扣款',
   effTime:'2026-09-11 08:30', creator:'运营 · 林凯', out:'failed', outAt:'2026-09-11 08:31', batchNo:'',
   status:'effective', reversal:0, reversalOf:'', reversedBy:''},
];
DB.adjFilter = DB.adjFilter || {merchant:'',no:'',type:'',dir:'',src:'',out:'',bn:'',from:'',to:''};
DB.adjSel    = DB.adjSel    || [];
DB.adjSeq    = DB.adjSeq    || 7;
DB.adjBatchSeq = DB.adjBatchSeq || 2;

/* ================= 行模型：人工单 + 收编的罚款单，统一成一种「款项行」 ================= */
// 罚款单不复制一份数据，实时从 DB.fineOrders 映射；推送状态与批次号双向同源
function fineAsAdj(){
  return (typeof fineGroups=='function'?fineGroups(true):[]).map(g=>({
    no:g.no, merchant:g.merchant, merchantName:g.merchantName,
    typeCode:'ADJ-FINE', typeName:tOf('ADJ-FINE').cn,
    amt:g.amt, currency:'SGD', bizNo:g.deliveryNo,
    remark:`到仓少货 ${g.qty} 件 × ${money(g.rate)}/件（${g.items.map(x=>x.name).join('、')}）`,
    effTime:g.at, creator:'系统自动', src:'SHORTAGE_FINE',
    out:g.push=='pushed'?'sent':'pending', outAt:g.pushedAt||'', batchNo:g.batchNo||'',
    status:'effective', reversal:0, reversalOf:'', reversedBy:'', _fine:1,
  }));
}
function adjAll(){
  const manual=(DB.adjOrders||[]).map(r=>Object.assign({src:'MANUAL'},r));
  return manual.concat(fineAsAdj()).sort((a,b)=>String(b.effTime).localeCompare(String(a.effTime)));
}
const adjOf = no => adjAll().find(r=>r.no==no);
window.adjOf = adjOf;

// 资金方向 = 类型方向 × 是否红冲（BR-05：类型方向不可改，反向用单据级 reversal 表达）
function adjDir(r){ const base=tOf(r.typeCode).dir; return r.reversal ? (base=='ADDITION'?'DEDUCTION':'ADDITION') : base; }
function adjSign(r){ return adjDir(r)=='ADDITION' ? 1 : -1; }
window.adjDir=adjDir;
function dirTag(r){ return adjDir(r)=='ADDITION'
  ? '<span class="tag t-g"><span class="dot"></span>正向 · 补商家</span>'
  : '<span class="tag t-r"><span class="dot"></span>负向 · 扣商家</span>'; }
function amtCell(r){
  const s=adjSign(r);
  return `<span style="color:${s>0?'var(--g)':'var(--r)'};font-weight:700;font-size:15px">${s>0?'+':'-'}${money(r.amt)}</span>`;
}
function outTag(r){
  if(r.out=='sent')   return '<span class="tag t-g"><span class="dot"></span>已输出</span>';
  if(r.out=='failed') return '<span class="tag t-r"><span class="dot"></span>输出失败</span>';
  if(r.out=='sending')return '<span class="tag t-y"><span class="dot"></span>输出中</span>';
  return '<span class="tag t-y"><span class="dot"></span>待输出</span>';
}
function srcTag(r){ return r.src=='SHORTAGE_FINE'
  ? '<span class="tag t-gr"><span class="dot"></span>缺货罚款</span>'
  : '<span class="tag t-gr"><span class="dot"></span>人工建单</span>'; }

function adjRows(){
  const f=DB.adjFilter, hit=(v,k)=>!k||String(v||'').toLowerCase().includes(String(k).trim().toLowerCase());
  return adjAll().filter(r=>
       hit(r.merchantName+' '+r.merchant, f.merchant) && hit(r.no, f.no)
    && (!f.type||r.typeCode==f.type) && (!f.dir||adjDir(r)==f.dir)
    && (!f.src||r.src==f.src) && (!f.out||r.out==f.out)
    && hit(r.batchNo, f.bn)
    && (!f.from||r.effTime>=f.from) && (!f.to||r.effTime<=f.to+' 23:59'));
}

/* ================= 列表页 ================= */
PAGES['p-adjust']=()=>{
  const f=DB.adjFilter, rows=adjRows();
  const selectable=rows.filter(r=>r.out=='pending'||r.out=='failed');
  DB.adjSel=DB.adjSel.filter(no=>selectable.some(r=>r.no==no));
  const allSel=selectable.length&&selectable.every(r=>DB.adjSel.includes(r.no));
  const merchants=[...new Set(adjAll().map(r=>r.merchantName))];

  return `${flowTip('')}
  <div class="card" style="margin-bottom:14px"><div class="card-bd" style="padding:16px 20px 12px">
    <div class="fg3">
      <div class="fr"><label class="fl">商家</label><input id="af-mc" value="${f.merchant}" placeholder="商家名称或编码，如 绿鲜源 / M2026-0815" list="af-mclist"><datalist id="af-mclist">${merchants.map(m=>`<option>${m}</option>`).join('')}</datalist></div>
      <div class="fr"><label class="fl">调整单号</label><input id="af-no" value="${f.no}" placeholder="如 ADJ-SG-20260910-005"></div>
      <div class="fr"><label class="fl">调整类型</label><select id="af-type"><option value="">全部</option>${DB.adjTypes.map(t=>`<option value="${t.code}" ${f.type==t.code?'selected':''}>${t.cn}</option>`).join('')}</select></div>
    </div>
    <div class="fg3">
      <div class="fr"><label class="fl">方向</label><select id="af-dir"><option value="">全部</option><option value="ADDITION" ${f.dir=='ADDITION'?'selected':''}>正向 · 补商家</option><option value="DEDUCTION" ${f.dir=='DEDUCTION'?'selected':''}>负向 · 扣商家</option></select></div>
      <div class="fr"><label class="fl">来源</label><select id="af-src"><option value="">全部</option><option value="MANUAL" ${f.src=='MANUAL'?'selected':''}>人工建单</option><option value="SHORTAGE_FINE" ${f.src=='SHORTAGE_FINE'?'selected':''}>缺货罚款</option></select></div>
      <div class="fr"><label class="fl">输出状态</label><select id="af-out"><option value="">全部</option><option value="pending" ${f.out=='pending'?'selected':''}>待输出</option><option value="sent" ${f.out=='sent'?'selected':''}>已输出</option><option value="failed" ${f.out=='failed'?'selected':''}>输出失败</option></select></div>
    </div>
    <div class="fg3">
      <div class="fr"><label class="fl">生效时间 起</label><input id="af-from" type="date" value="${f.from}"></div>
      <div class="fr"><label class="fl">生效时间 止</label><input id="af-to" type="date" value="${f.to}"></div>
      <div class="fr"><label class="fl">批次号</label><input id="af-bn" value="${f.bn||''}" placeholder="如 AB-SG-20260910-001"></div>
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
      <button class="btn btn-o btn-sm" ${DB.adjSel.length?'':'disabled'} onclick="adj_pushAsk()">输出款项数据${DB.adjSel.length?` (${DB.adjSel.length})`:''}</button>
      <button class="btn btn-p btn-sm" onclick="adj_newAsk()">新建调整单</button>
    </div>
    <div class="card-bd flush"><div style="overflow-x:auto"><table>
      <thead><tr>
        <th style="width:34px"><input type="checkbox" class="skuchk" title="全选可输出" ${allSel?'checked':''} onclick="adj_selAll()"></th>
        <th>调整单号</th><th>商家编码</th><th>商家名称</th><th>调整类型</th><th>方向</th>
        <th style="text-align:right">金额</th><th>关联业务单</th><th>来源</th><th>生效时间</th>
        <th>单据状态</th><th>输出状态</th><th>批次号</th><th>操作</th>
      </tr></thead><tbody>
      ${rows.map(r=>`<tr>
        <td>${(r.out=='pending'||r.out=='failed')?`<input type="checkbox" class="skuchk" ${DB.adjSel.includes(r.no)?'checked':''} onclick="adj_toggle('${r.no}')">`:''}</td>
        <td class="mono" style="white-space:nowrap">${r.no}</td>
        <td class="mono" style="white-space:nowrap">${r.merchant}</td>
        <td style="white-space:nowrap"><b>${r.merchantName}</b></td>
        <td style="white-space:nowrap">${r.typeName}${r.reversal?' <span class="tag t-y" style="font-size:10.5px"><span class="dot"></span>红冲</span>':''}</td>
        <td style="white-space:nowrap">${dirTag(r)}</td>
        <td style="text-align:right;white-space:nowrap">${amtCell(r)}</td>
        <td class="mono" style="font-size:12px;white-space:nowrap">${r.bizNo||'—'}</td>
        <td style="white-space:nowrap">${srcTag(r)}</td>
        <td style="white-space:nowrap;font-size:12.5px;color:var(--ts)">${r.effTime}</td>
        <td style="white-space:nowrap">${r.status=='reversed'?'<span class="tag t-gr"><span class="dot"></span>已冲正</span>':'<span class="tag t-g"><span class="dot"></span>已生效</span>'}</td>
        <td style="white-space:nowrap">${outTag(r)}</td>
        <td class="mono" style="font-size:12px;white-space:nowrap">${r.batchNo?`<span style="color:var(--b);cursor:pointer;text-decoration:underline" title="查看该批次全部单据" onclick="adj_byBatch('${r.batchNo}')">${r.batchNo}</span>`:'—'}</td>
        <td style="white-space:nowrap"><button class="btn btn-o btn-sm" onclick="adj_detail('${r.no}')">详情</button></td>
      </tr>`).join('')||`<tr><td colspan="14" style="text-align:center;color:var(--ts);padding:22px">${adjAll().length?'没有符合筛选条件的调整单':'暂无业务调整单'}</td></tr>`}
      </tbody></table></div>
      <div class="card-bd" style="border-top:1px solid var(--bd2);font-size:12.5px;color:var(--ts)">
        业务调整单只负责<b>产生一笔正/负向款项</b>并输出给下游，<b>不涉及结算归期、结算单与开票</b>。建单<b>即时生效、不可修改不可删除</b>，错单走<b>红冲</b>（生成一张反向单，原单留痕）。
        调整类型由运营维护 <button class="btn btn-link btn-sm" style="padding:0 0 0 2px" onclick="nav('p-adjust-type')">去配置</button>；缺货罚款单已收编进本列表统一输出，其生成规则仍在 <button class="btn btn-link btn-sm" style="padding:0 0 0 2px" onclick="nav('p-fine')">罚款单</button> 页查看。
      </div>
    </div>`;
};

window.adj_query=function(){
  const g=id=>(document.getElementById(id)||{}).value||'';
  DB.adjFilter={merchant:g('af-mc').trim(),no:g('af-no').trim(),type:g('af-type'),dir:g('af-dir'),src:g('af-src'),out:g('af-out'),bn:g('af-bn').trim(),from:g('af-from'),to:g('af-to')};
  DB.adjSel=[];render();
};
window.adj_reset=function(){DB.adjFilter={merchant:'',no:'',type:'',dir:'',src:'',out:'',bn:'',from:'',to:''};DB.adjSel=[];render();toast('筛选条件已重置','info');};
// 批次号可点回填：财务拿到批次号要能一键反查这批推了哪些单
window.adj_byBatch=function(bn){DB.adjFilter={merchant:'',no:'',type:'',dir:'',src:'',out:'',bn:bn,from:'',to:''};DB.adjSel=[];render();};
window.adj_toggle=function(no){const i=DB.adjSel.indexOf(no);i<0?DB.adjSel.push(no):DB.adjSel.splice(i,1);render();};
window.adj_selAll=function(){
  const sel=adjRows().filter(r=>r.out=='pending'||r.out=='failed').map(r=>r.no);
  DB.adjSel=(sel.length&&sel.every(n=>DB.adjSel.includes(n)))?[]:sel.slice();render();
};

/* ================= 新建调整单（建单 → 二次确认 → 生效） ================= */
window.adj_newAsk=function(){
  const ts_=(DB.adjTypes||[]).filter(t=>t.on&&!t.sys);   // 系统来源类型（缺货罚款）不可人工建单
  const ms=[{c:'M2026-0815',n:'绿鲜源蔬果'},{c:'M2026-0902',n:'海丰水产'},{c:'M2026-1103',n:'万丰肉禽'}];
  modalWide(`<div class="mc-hd"><h3>新建业务调整单</h3><p>产生一笔正向（补商家）或负向（扣商家）款项；<b>提交即生效，不可修改不可删除</b></p><button class="mc-x" onclick="closeModal()">×</button></div>
  <div class="mc-bd">
    <div class="fg2">
      <div class="fr"><label class="fl"><b>*</b>商家</label><select id="an-mc">${ms.map(m=>`<option value="${m.c}">${m.n}（${m.c}）</option>`).join('')}</select></div>
      <div class="fr"><label class="fl"><b>*</b>调整类型</label><select id="an-type" onchange="adj_typeChange()">${ts_.map(t=>`<option value="${t.code}">${t.cn}</option>`).join('')}</select></div>
    </div>
    <div class="fg2">
      <div class="fr"><label class="fl">方向（随类型自动带出，不可改）</label><div id="an-dir" style="padding:9px 0"></div></div>
      <div class="fr"><label class="fl"><b>*</b>金额（S$）</label><input id="an-amt" type="number" min="0.01" step="0.01" placeholder="0.00"></div>
    </div>
    <div class="fr"><label class="fl" id="an-bizl">关联业务单号</label><input id="an-biz" placeholder="订单号 / 送货单号 / 售后单号，仅留痕不校验"></div>
    <div class="fr"><label class="fl"><b>*</b>调整说明</label><textarea id="an-remark" rows="3" placeholder="写清为什么补/扣这笔钱、线下与商家沟通的结论；该说明只留在运营侧，不随款项数据输出"></textarea></div>
    <div class="fr"><label class="fl">附件（沟通记录 / 凭证，选填）</label><div class="up" onclick="toast('原型不做真实上传','info')"><div class="uic">📎</div><div class="ut">点击上传</div><div class="us">支持 jpg / png / pdf，单个 ≤ 10MB</div></div></div>
  </div>
  <div class="mc-ft"><button class="btn btn-o" onclick="closeModal()">取消</button><button class="btn btn-p" onclick="adj_newConfirm()">提交</button></div>`);
  adj_typeChange();
};
window.adj_typeChange=function(){
  const t=tOf((document.getElementById('an-type')||{}).value);
  const d=document.getElementById('an-dir'); if(d) d.innerHTML=dirTag({typeCode:t.code,reversal:0})+` <span style="font-size:12px;color:var(--ts);margin-left:6px">${t.dir=='ADDITION'?'平台付给商家':'从商家结算中扣回'}</span>`;
  const l=document.getElementById('an-bizl'); if(l) l.innerHTML=(t.needBiz?'<b>*</b>':'')+'关联业务单号'+(t.needBiz?'':'（选填）');
};
window.adj_newConfirm=function(){
  const g=id=>String((document.getElementById(id)||{}).value||'').trim();
  const mc=g('an-mc'), tc=g('an-type'), amt=+g('an-amt'), biz=g('an-biz'), rk=g('an-remark');
  const t=tOf(tc);
  const ms={'M2026-0815':'绿鲜源蔬果','M2026-0902':'海丰水产','M2026-1103':'万丰肉禽'};
  if(!(amt>0)){toast('请填写大于 0 的金额','err');return;}                 // 0 元单没有业务含义
  if(t.needBiz&&!biz){toast('该调整类型必须填写关联业务单号','err');return;}
  if(!rk){toast('请填写调整说明','err');return;}
  const dup=(DB.adjOrders||[]).filter(r=>r.merchant==mc&&r.typeCode==tc&&r.amt==amt&&String(r.effTime).slice(0,10)==ts().slice(0,10));
  const dir=t.dir=='ADDITION';
  modal(`<div class="mc-hd"><h3>确认创建调整单</h3><p>提交后立即生效，<b>不可修改、不可删除</b>，错单只能红冲</p><button class="mc-x" onclick="closeModal()">×</button></div>
  <div class="mc-bd">
    ${dup.length?`<div class="ib ib-y"><span class="i">⚠️</span>今日已有 <b>${dup.length}</b> 张相同商家 + 相同类型 + 相同金额的调整单，请确认不是重复创建。</div>`:''}
    <div style="border:1px solid var(--bd);border-radius:8px;overflow:hidden;margin:10px 0 12px"><table style="margin:0"><tbody>
      <tr><td style="color:var(--ts);width:120px">商家</td><td><b>${ms[mc]}</b> <span class="mono" style="color:var(--ts)">${mc}</span></td></tr>
      <tr><td style="color:var(--ts)">调整类型</td><td>${t.cn} <span class="mono" style="color:var(--ts);font-size:12px">${t.code}</span></td></tr>
      <tr><td style="color:var(--ts)">方向</td><td>${dirTag({typeCode:tc,reversal:0})}</td></tr>
      <tr><td style="color:var(--ts)">金额</td><td><span style="color:${dir?'var(--g)':'var(--r)'};font-weight:700;font-size:17px">${dir?'+':'-'}${money(amt)}</span></td></tr>
      <tr><td style="color:var(--ts)">关联业务单</td><td class="mono">${biz||'—'}</td></tr>
    </tbody></table></div>
    <div class="ib ib-b"><span class="i">ℹ️</span>本单只产生一笔款项事实并输出给下游，<b>不决定进哪一期结算、不开票</b>。</div>
  </div>
  <div class="mc-ft"><button class="btn btn-o" onclick="adj_newAsk()">返回修改</button><button class="btn btn-p" onclick="adj_newDo('${mc}','${tc}',${amt},'${biz.replace(/'/g,'')}','${rk.replace(/'/g,'').replace(/\n/g,' ')}')">确认创建</button></div>`);
};
window.adj_newDo=function(mc,tc,amt,biz,rk){
  const ms={'M2026-0815':'绿鲜源蔬果','M2026-0902':'海丰水产','M2026-1103':'万丰肉禽'};
  const no='ADJ-'+(DB.siteCode||'SG')+'-'+ts().slice(0,10).replace(/-/g,'')+'-'+String(DB.adjSeq++).padStart(3,'0');
  DB.adjOrders.unshift({no, merchant:mc, merchantName:ms[mc], typeCode:tc, typeName:tOf(tc).cn,
    amt:+(+amt).toFixed(2), currency:'SGD', bizNo:biz, remark:rk, effTime:ts(), creator:'运营 · 当前账号',
    out:'pending', outAt:'', batchNo:'', status:'effective', reversal:0, reversalOf:'', reversedBy:''});
  closeModal();DB.adjSel=[];render();
  toast('调整单 '+no+' 已创建并生效，待输出','ok');
};

/* ================= 详情抽屉 ================= */
window.adj_detail=function(no){
  const r=adjOf(no); if(!r) return;
  const t=tOf(r.typeCode), s=adjSign(r);
  const kv=(k,v)=>`<div style="min-width:0"><div style="font-size:12px;color:var(--ts);margin-bottom:4px">${k}</div><div style="font-size:13.5px;color:var(--tp);font-weight:500;word-break:break-word">${v||'—'}</div></div>`;
  const sec=x=>`<div style="display:flex;align-items:center;gap:10px;margin:18px 0 12px"><span style="width:4px;height:16px;background:var(--g);border-radius:2px"></span><h3 style="font-size:14.5px;font-weight:700">${x}</h3></div>`;
  const grid=h=>`<div style="display:grid;grid-template-columns:1fr 1fr;gap:14px 20px">${h}</div>`;
  const canReverse = r.src=='MANUAL' && r.status=='effective' && !r.reversal;

  drawer(`<div class="drawer-hd"><div><h3>${r.no}</h3><div style="font-size:12.5px;color:var(--ts);margin-top:2px">${r.typeName} · ${r.merchantName}</div></div><span class="x" onclick="closeDrawer()">×</span></div>
  <div class="drawer-bd">
    <div class="row" style="gap:8px;margin-bottom:6px">${dirTag(r)}${srcTag(r)}${r.reversal?'<span class="tag t-y"><span class="dot"></span>红冲单</span>':''}${r.status=='reversed'?'<span class="tag t-gr"><span class="dot"></span>已冲正</span>':''}${outTag(r)}</div>
    <div style="font-size:30px;font-weight:800;letter-spacing:-.5px;color:${s>0?'var(--g)':'var(--r)'};margin:10px 0 2px">${s>0?'+':'-'}${money(r.amt)}</div>
    <div style="font-size:12.5px;color:var(--ts)">${s>0?'平台付给商家':'从商家结算中扣回'} · ${r.currency}</div>

    ${sec('单据信息')}
    ${grid(kv('商家',`${r.merchantName} <span class="mono" style="color:var(--ts)">${r.merchant}</span>`)+kv('调整类型',`${r.typeName} <span class="mono" style="font-size:12px;color:var(--ts)">${t.code}</span>`)+kv('方向',adjDir(r)=='ADDITION'?'正向 · 补商家':'负向 · 扣商家')+kv('金额',`${money(r.amt)}（存储恒正，方向由字段表达）`)+kv('关联业务单',`<span class="mono">${r.bizNo||'—'}</span>`)+kv('生效时间',r.effTime)+kv('创建人',r.creator)+kv('来源',r.src=='SHORTAGE_FINE'?'系统 · 到仓少货自动生成':'人工建单'))}

    ${sec('调整说明')}
    <div style="background:var(--bg);border:1px solid var(--bd2);border-radius:8px;padding:12px 14px;font-size:13px;line-height:1.7;color:var(--tp)">${r.remark||'—'}</div>
    <div style="font-size:12px;color:var(--ts);margin-top:8px">说明与附件只留在运营侧，<b>不随款项数据输出给下游</b>。</div>

    ${r.reversalOf||r.reversedBy?sec('红冲关系')+grid(
      (r.reversalOf?kv('红冲的原单',`<span class="mono" style="color:var(--b);cursor:pointer;text-decoration:underline" onclick="adj_detail('${r.reversalOf}')">${r.reversalOf}</span>`):'')+
      (r.reversedBy?kv('已被红冲单',`<span class="mono" style="color:var(--b);cursor:pointer;text-decoration:underline" onclick="adj_detail('${r.reversedBy}')">${r.reversedBy}</span>`):'')
    ):''}

    ${sec('输出信息')}
    ${grid(kv('输出状态',outTag(r))+kv('批次号',`<span class="mono">${r.batchNo||'—'}</span>`)+kv('输出时间',r.outAt)+kv('幂等键',`<span class="mono">${r.no}</span>`))}
    ${r.out=='failed'?'<div class="ib ib-r" style="margin-top:12px"><span class="i">⛔</span>上次输出失败：下游返回超时未确认。可重新勾选输出，<b>重复输出按单号幂等去重，不会产生双份款项</b>。</div>':''}

    ${sec('操作轨迹')}
    <table><thead><tr><th>时间</th><th>动作</th><th>操作人</th></tr></thead><tbody>
      <tr><td style="white-space:nowrap">${r.effTime}</td><td>创建并生效</td><td>${r.creator}</td></tr>
      ${r.outAt?`<tr><td style="white-space:nowrap">${r.outAt}</td><td>输出款项数据${r.batchNo?`（批次 ${r.batchNo}）`:''}</td><td>${r.src=='SHORTAGE_FINE'?'运营 · 批量输出':'系统 · 建单即输出'}</td></tr>`:''}
      ${r.reversedBy?`<tr><td style="white-space:nowrap">${(adjOf(r.reversedBy)||{}).effTime||''}</td><td>被红冲（原单转为已冲正）</td><td>${(adjOf(r.reversedBy)||{}).creator||''}</td></tr>`:''}
    </tbody></table>
  </div>
  <div class="drawer-ft">
    <button class="btn btn-o" onclick="closeDrawer()">关闭</button>
    ${canReverse?`<button class="btn btn-d" onclick="adj_reverseAsk('${r.no}')">红冲此单</button>`:''}
    ${r.src=='SHORTAGE_FINE'?`<button class="btn btn-o" onclick="closeDrawer();fine_detail('${r.no}')">查看罚款单明细</button>`:''}
  </div>`);
};

/* ================= 红冲 ================= */
window.adj_reverseAsk=function(no){
  const r=adjOf(no); if(!r) return;
  const s=adjSign(r);
  modal(`<div class="mc-hd"><h3>红冲调整单</h3><p>原单不修改、不删除；系统生成一张反向单抵消</p><button class="mc-x" onclick="closeModal()">×</button></div>
  <div class="mc-bd">
    <div class="ib ib-y"><span class="i">⚠️</span>红冲<b>不是撤销</b>：原单已输出给下游的款项不会被收回，下游拿到的是<b>一正一负两笔</b>，自行抵消。</div>
    <div style="border:1px solid var(--bd);border-radius:8px;overflow:hidden;margin:10px 0 12px"><table style="margin:0"><thead><tr><th>单据</th><th>类型</th><th style="text-align:right">金额</th></tr></thead><tbody>
      <tr><td class="mono">${r.no}</td><td>${r.typeName}（原单）</td><td style="text-align:right;color:${s>0?'var(--g)':'var(--r)'};font-weight:600">${s>0?'+':'-'}${money(r.amt)}</td></tr>
      <tr><td class="mono" style="color:var(--ts)">待生成</td><td>${r.typeName} · <b>红冲</b></td><td style="text-align:right;color:${s>0?'var(--r)':'var(--g)'};font-weight:600">${s>0?'-':'+'}${money(r.amt)}</td></tr>
      <tr style="background:#F7FBF8;font-weight:700"><td colspan="2">净影响</td><td style="text-align:right">${money(0)}</td></tr>
    </tbody></table></div>
    <div class="fr"><label class="fl"><b>*</b>红冲原因</label><textarea id="ar-why" rows="3" placeholder="写清为什么冲掉这笔（如：核实为平台责任、金额录错、商家已线下补偿）"></textarea></div>
  </div>
  <div class="mc-ft"><button class="btn btn-o" onclick="closeModal()">取消</button><button class="btn btn-d" onclick="adj_reverseDo('${r.no}')">确认红冲</button></div>`);
};
window.adj_reverseDo=function(no){
  const r=(DB.adjOrders||[]).find(x=>x.no==no); if(!r) return;
  const why=String((document.getElementById('ar-why')||{}).value||'').trim();
  if(!why){toast('请填写红冲原因','err');return;}
  const rn='ADJ-'+(DB.siteCode||'SG')+'-'+ts().slice(0,10).replace(/-/g,'')+'-'+String(DB.adjSeq++).padStart(3,'0');
  DB.adjOrders.unshift({no:rn, merchant:r.merchant, merchantName:r.merchantName, typeCode:r.typeCode, typeName:r.typeName,
    amt:r.amt, currency:r.currency, bizNo:r.bizNo, remark:'红冲 '+r.no+'：'+why, effTime:ts(), creator:'运营 · 当前账号',
    out:'pending', outAt:'', batchNo:'', status:'effective', reversal:1, reversalOf:r.no, reversedBy:''});
  r.status='reversed'; r.reversedBy=rn;
  closeModal();closeDrawer();render();
  toast('已生成红冲单 '+rn+'，原单 '+r.no+' 转为已冲正','ok');
};

/* ================= 输出款项数据（批量） ================= */
window.adj_pushAsk=function(){
  const rows=adjRows().filter(r=>DB.adjSel.includes(r.no));
  if(!rows.length){toast('请先勾选待输出的调整单','err');return;}
  if(rows.length>500){toast('单批最多 500 张，请缩小筛选范围分批输出','err');return;}
  const curs=[...new Set(rows.map(r=>r.currency))];
  if(curs.length>1){toast('同一批次不可跨币种输出，请分别输出','err');return;}
  const byM={};rows.forEach(r=>{(byM[r.merchantName]=byM[r.merchantName]||[]).push(r);});
  const sum=a=>a.reduce((x,r)=>x+adjSign(r)*r.amt,0);
  modal(`<div class="mc-hd"><h3>输出款项数据</h3><p>将 ${rows.length} 张调整单作为款项事实输出给下游</p><button class="mc-x" onclick="closeModal()">×</button></div>
  <div class="mc-bd">
    <div class="ib ib-y"><span class="i">⚠️</span>输出后<b>不可在本页撤回</b>；如需调整只能红冲。请核对商家与金额。</div>
    <div style="border:1px solid var(--bd);border-radius:8px;overflow:hidden;margin:10px 0 12px"><table style="margin:0"><thead><tr><th>商家</th><th>商家编码</th><th style="text-align:right">单数</th><th style="text-align:right">正向合计</th><th style="text-align:right">负向合计</th><th style="text-align:right">净额</th></tr></thead><tbody>
      ${Object.keys(byM).map(m=>{const a=byM[m],plus=a.filter(r=>adjSign(r)>0),minus=a.filter(r=>adjSign(r)<0);
        return `<tr><td><b>${m}</b></td><td class="mono">${a[0].merchant}</td><td style="text-align:right">${a.length}</td>
        <td style="text-align:right;color:var(--g)">${plus.length?'+'+money(plus.reduce((x,r)=>x+r.amt,0)):'—'}</td>
        <td style="text-align:right;color:var(--r)">${minus.length?'-'+money(minus.reduce((x,r)=>x+r.amt,0)):'—'}</td>
        <td style="text-align:right;font-weight:700;color:${sum(a)>=0?'var(--g)':'var(--r)'}">${sum(a)>=0?'+':'-'}${money(Math.abs(sum(a)))}</td></tr>`;}).join('')}
      <tr style="background:#F7FBF8;font-weight:700"><td colspan="2">合计 ${Object.keys(byM).length} 个商家</td><td style="text-align:right">${rows.length}</td><td colspan="2"></td><td style="text-align:right;color:${sum(rows)>=0?'var(--g)':'var(--r)'}">${sum(rows)>=0?'+':'-'}${money(Math.abs(sum(rows)))}</td></tr>
    </tbody></table></div>
    <div style="font-size:12.5px;color:var(--ts)">输出内容：调整单号 / 商家编码 / 类型编码与名称 / 方向 / 金额（正数绝对值）/ 币种 / 生效时间 / 来源 / 红冲关联单号。<b>不含</b>调整说明、附件、操作人。</div>
  </div>
  <div class="mc-ft"><button class="btn btn-o" onclick="closeModal()">取消</button><button class="btn btn-p" onclick="adj_pushDo()">确认输出</button></div>`);
};
window.adj_pushDo=function(){
  const batch='AB-'+(DB.siteCode||'SG')+'-'+ts().slice(0,10).replace(/-/g,'')+'-'+String(DB.adjBatchSeq++).padStart(3,'0');
  const now=ts(); let n=0;
  DB.adjSel.forEach(no=>{
    const m=(DB.adjOrders||[]).find(x=>x.no==no);
    if(m&&(m.out=='pending'||m.out=='failed')){m.out='sent';m.outAt=now;m.batchNo=batch;n++;return;}
    // 收编的罚款单：写回罚款单自身的推送状态，两个页面同源，不产生第二份真值
    const f=(DB.fineOrders||[]).find(x=>x.no==no);
    if(f&&f.push=='pending'){f.push='pushed';f.pushedAt=now;f.batchNo=batch;n++;}
  });
  DB.adjSel=[];closeModal();DB.adjFilter={merchant:'',no:'',type:'',dir:'',src:'',out:'',bn:batch,from:'',to:''};render();
  toast('已输出 '+n+' 张调整单，批次 '+batch,'ok');
};

/* ================= 调整类型配置 ================= */
PAGES['p-adjust-type']=()=>{
  const used=c=>adjAll().filter(r=>r.typeCode==c).length;
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
      <b>类型编码</b>与<b>方向</b>建后不可改——编码是下游归集与对账的唯一口径，方向改了会让存量单的资金方向翻转。
      <b>名称可改</b>，但已生成的单据按<b>快照</b>展示旧名，不追溯。<b>停用</b>只影响新建，存量单的展示与输出完全不受影响。
      标「系统生成」的类型不可人工建单、不可停用（如缺货罚款由到仓少货自动产生）。
    </div>
  </div>`;
};
window.adjt_edit=function(code){
  const t=code?tOf(code):{code:'',cn:'',en:'',dir:'DEDUCTION',needBiz:0,on:1,sys:0};
  const isNew=!code;
  modal(`<div class="mc-hd"><h3>${isNew?'新增调整类型':'编辑调整类型'}</h3><p>${isNew?'编码与方向一旦保存不可再改，请先想清楚':'编码与方向不可改；名称改动不影响存量单据（按快照展示）'}</p><button class="mc-x" onclick="closeModal()">×</button></div>
  <div class="mc-bd">
    <div class="fg2">
      <div class="fr"><label class="fl"><b>*</b>类型编码</label><input id="at-code" value="${t.code}" placeholder="如 ADJ-STORAGE" ${isNew?'':'readonly style="background:#F3F4F6;color:var(--ts)"'}></div>
      <div class="fr"><label class="fl"><b>*</b>方向</label>${isNew?`<select id="at-dir"><option value="DEDUCTION">负向 · 扣商家</option><option value="ADDITION">正向 · 补商家</option></select>`:`<input value="${t.dir=='ADDITION'?'正向 · 补商家':'负向 · 扣商家'}" readonly style="background:#F3F4F6;color:var(--ts)">`}</div>
    </div>
    <div class="fg2">
      <div class="fr"><label class="fl"><b>*</b>中文名称</label><input id="at-cn" value="${t.cn}" placeholder="如 仓储滞留费"></div>
      <div class="fr"><label class="fl">英文名称</label><input id="at-en" value="${t.en}" placeholder="如 Storage Fee"></div>
    </div>
    <div class="fg2">
      <div class="fr"><label class="fl">关联业务单号</label><select id="at-biz"><option value="0" ${t.needBiz?'':'selected'}>选填</option><option value="1" ${t.needBiz?'selected':''}>必填</option></select></div>
      <div class="fr"><label class="fl">状态</label><select id="at-on"><option value="1" ${t.on?'selected':''}>启用</option><option value="0" ${t.on?'':'selected'}>停用</option></select></div>
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
  if(code){
    const t=tOf(code); t.cn=cn; t.en=g('at-en'); t.needBiz=+g('at-biz'); t.on=+g('at-on');
  }else{
    DB.adjTypes.push({code:cd, cn, en:g('at-en'), dir:g('at-dir'), needBiz:+g('at-biz'), on:+g('at-on'), sys:0});
  }
  closeModal();render();toast('调整类型已保存','ok');
};
window.adjt_toggle=function(code){
  const t=tOf(code);
  if(t.on){
    modal(`<div class="mc-hd"><h3>停用「${t.cn}」？</h3><p>停用后不可用于新建调整单</p><button class="mc-x" onclick="closeModal()">×</button></div>
    <div class="mc-bd"><div class="ib ib-b"><span class="i">ℹ️</span>已生成的 <b>${adjAll().filter(r=>r.typeCode==code).length}</b> 张调整单<b>不受影响</b>——展示、输出照常，不回溯、不作废。</div></div>
    <div class="mc-ft"><button class="btn btn-o" onclick="closeModal()">取消</button><button class="btn btn-p" onclick="adjt_toggleDo('${code}')">确认停用</button></div>`);
  }else{ adjt_toggleDo(code); }
};
window.adjt_toggleDo=function(code){const t=tOf(code);t.on=t.on?0:1;closeModal();render();toast('「'+t.cn+'」已'+(t.on?'启用':'停用'),'ok');};

})();
