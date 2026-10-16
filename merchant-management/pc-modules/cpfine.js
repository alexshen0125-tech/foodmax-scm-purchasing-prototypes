/* Food Max 商家系统 · 客诉罚款（售后客诉累计罚款，参照快驴《合作商违规行为管理规则》4.5 客服售后）
   机制：
   - 只统计【判责已结案的商家责】售后工单（维持原判 / 超时默认认可 / 商家主动认可 / 判责后未申诉），按「商家 × 品类 × 问题类型 × 统计周」汇总
   - 客诉量 = 计入工单的商品行数（一张工单一个 SKU 计 1）；客诉率 = 客诉量 ÷ 同周同品类履约订单商品行数
   - 档位 = 客诉量区间 + 客诉率门槛（留空不校验）；命中客诉量区间但客诉率未达门槛 → 按警告处理
   - 处理方式：警告 / 罚款（S$/次，金额由运营配置，本期不预置）
   - 统计周 = 周一至周日（按售后判责结案时间归周）；周结束后由运营核对并「确认出单」：警告通知商家、罚款按商家×周合并成一张罚款单
   - 新商保护期内只警告不罚款；单商家单周罚款合计不超过封顶
   - 罚款单不开发票，推送财务结算后作为结算减项，与到仓少货罚款单并列
   - 售后补货本身仍不计罚款（2026-08-31 口径不变），客诉罚款只看累计客诉 */
(function(){

const CP_ISSUE = {wrong:'发错货', short:'缺斤短两', quality:'品质问题'};
const CP_ISSUE_KEYS = ['wrong','short','quality'];
const CP_CATS = ['新鲜蔬菜','肉禽蛋品','海鲜水产','调味品'];
window.CP_ISSUE = CP_ISSUE;

/* ---------- 统计周：以今天所在周为本周 ---------- */
function monday(off){const d=new Date();d.setHours(0,0,0,0);const w=(d.getDay()+6)%7;d.setDate(d.getDate()-w+off*7);return d;}
const p2=n=>(''+n).padStart(2,'0');
const ymd=d=>d.getFullYear()+'-'+p2(d.getMonth()+1)+'-'+p2(d.getDate());
const md=d=>p2(d.getMonth()+1)+'-'+p2(d.getDate());
function weekInfo(off){
  const s=monday(off), e=new Date(s); e.setDate(s.getDate()+6);
  const iss=new Date(e); iss.setDate(e.getDate()+3);          // 出单日 = 周结束后第 3 天（周三），等售后申诉期结束
  return {off, key:'W'+ymd(s).replace(/-/g,''), start:ymd(s), end:ymd(e), label:`${md(s)} ~ ${md(e)}`, issueDay:ymd(iss)};
}
const CP_WEEKS=[0,-1,-2].map(weekInfo);
window.cpWeek=k=>CP_WEEKS.find(w=>w.key==k);

/* ---------- 规则配置：档位结构参照快驴（客诉量区间），客诉率门槛与罚款金额待业务定 ---------- */
function defTiers(){return [
  {min:1, max:2, rate:'', act:'warn', amt:''},
  {min:3, max:5, rate:'', act:'fine', amt:''},
  {min:6, max:9, rate:'', act:'fine', amt:''},
  {min:10,max:'',rate:'', act:'fine', amt:''},
];}
if(!DB.cpCfg){
  const rules={};
  CP_ISSUE_KEYS.forEach(k=>{rules[k]={};CP_CATS.forEach(c=>rules[k][c]=defTiers());});
  DB.cpCfg={enabled:false, protectDays:'', weekCap:'', rules, updatedAt:'', updatedBy:''};
}
DB.cpCfgTab   = DB.cpCfgTab   || 'short';
DB.cpCfgCat   = DB.cpCfgCat   || '新鲜蔬菜';
DB.cpDraft    = null;

/* ---------- 示例数据：商家、履约商品行数、计入的商家责工单 ---------- */
DB.cpMerchants = DB.cpMerchants || [
  {code:'M2026-0815', name:'绿鲜源蔬果', firstFulfill:'2026-03-02'},
  {code:'M2026-0902', name:'海丰水产',   firstFulfill:'2026-04-15'},
  {code:'M2026-1103', name:'万丰肉禽',   firstFulfill:ymd(new Date(Date.now()-12*86400000))},
];
// 履约订单商品行数（分母）：商家 × 品类 × 周
DB.cpBase = DB.cpBase || (()=>{const b={};
  const put=(m,c,arr)=>CP_WEEKS.forEach((w,i)=>{b[[m,c,w.key].join('|')]=arr[i];});
  put('M2026-0815','新鲜蔬菜',[520,846,812]);
  put('M2026-0815','肉禽蛋品',[64,118,102]);
  put('M2026-0902','海鲜水产',[150,268,251]);
  put('M2026-1103','肉禽蛋品',[180,306,0]);
  return b;})();
// 计入的工单（已结案商家责）；closeBy：维持原判 / 超时默认认可 / 主动认可 / 未申诉
DB.cpTickets = DB.cpTickets || (()=>{
  const W=CP_WEEKS, out=[]; let seq=1;
  const add=(wi,m,c,issue,list)=>list.forEach(([client,item,closeBy,dayOff])=>{
    const d=new Date(W[wi].start+'T00:00:00'); d.setDate(d.getDate()+dayOff);
    out.push({id:'AS-CP'+p2(seq++)+(100+seq), week:W[wi].key, merchant:m, cat:c, issue, client, item,
      order:'#SG'+ymd(d).replace(/-/g,'')+p2(10+seq), closeBy, closedAt:ymd(d)+' 1'+(seq%10)+':2'+(seq%6)});
  });
  // 上周（待确认出单）
  add(1,'M2026-0815','新鲜蔬菜','short',[['食为天餐厅','菠菜 1kg/件','超时默认认可',0],['丰盛轩','小棠菜 1kg/件','维持原判',1],['海底捞（新加坡）','菜心 1kg/件','主动认可',2],['新味坊','空心菜 1kg/件','未申诉',4]]);
  add(1,'M2026-0815','新鲜蔬菜','quality',[['金鼎轩','西兰花 5kg/件','超时默认认可',1],['鼎泰丰','芥蓝 10kg/件','维持原判',3]]);
  add(1,'M2026-0815','新鲜蔬菜','wrong',[['小南国','娃娃菜 15kg/件','主动认可',2]]);
  add(1,'M2026-0815','肉禽蛋品','short',[['南洋茶餐室','鲜鸡蛋 30枚/盘','未申诉',5]]);
  add(1,'M2026-0902','海鲜水产','quality',[['海底捞（新加坡）','冰鲜三文鱼 1kg/袋','超时默认认可',0],['食为天餐厅','鲜活白虾 500g/盒','维持原判',1],['丰盛轩','鲜活白虾 500g/盒','超时默认认可',1],['金鼎轩','冰鲜三文鱼 1kg/袋','主动认可',2],['鼎泰丰','鲜活白虾 500g/盒','未申诉',3],['新味坊','冰鲜三文鱼 1kg/袋','维持原判',5],['小南国','冰鲜鲈鱼 1kg/条','超时默认认可',6]]);
  add(1,'M2026-1103','肉禽蛋品','wrong',[['南洋茶餐室','鸡全腿 2kg/袋','主动认可',1],['新味坊','鸡胸肉 2kg/袋','超时默认认可',2],['食为天餐厅','鸡全腿 2kg/袋','维持原判',4]]);
  // 本周（统计中）
  add(0,'M2026-0815','新鲜蔬菜','short',[['丰盛轩','菠菜 1kg/件','超时默认认可',0],['食为天餐厅','小棠菜 1kg/件','主动认可',1]]);
  add(0,'M2026-0902','海鲜水产','quality',[['金鼎轩','鲜活白虾 500g/盒','维持原判',0]]);
  // 上上周（已出单，当时规则未启用）
  add(2,'M2026-0815','新鲜蔬菜','short',[['鼎泰丰','菜心 1kg/件','未申诉',2],['海底捞（新加坡）','菠菜 1kg/件','超时默认认可',3],['新味坊','空心菜 1kg/件','主动认可',4]]);
  add(2,'M2026-0902','海鲜水产','quality',[['丰盛轩','冰鲜三文鱼 1kg/袋','超时默认认可',2],['小南国','鲜活白虾 500g/盒','维持原判',5]]);
  return out;
})();
// 已出单的统计周：结果快照（出单后不随规则调整变化）
DB.cpIssued = DB.cpIssued || {};
if(!DB.cpIssued[CP_WEEKS[2].key]) DB.cpIssued[CP_WEEKS[2].key]={at:CP_WEEKS[2].issueDay+' 10:12', by:'运营 · 林晓', rows:null};
DB.cpFines   = DB.cpFines   || [];
DB.cpFineSeq = DB.cpFineSeq || 1;
DB.cpSel     = DB.cpSel     || [];
DB.cpFilter  = DB.cpFilter  || {week:CP_WEEKS[1].key, merchant:'', result:''};
DB.cpFineFilter = DB.cpFineFilter || {merchant:'', push:''};
DB.cpMTab    = DB.cpMTab    || 'receipt';
DB.cpOpsTab  = DB.cpOpsTab  || 'receipt';
DB.cpMWeek   = DB.cpMWeek   || CP_WEEKS[0].key;

/* 售后判责里判商家责并结案、且填了问题类型的工单，实时计入本周（与示例工单合并） */
function liveTickets(){
  const w=CP_WEEKS[0].key, m=(DB.merchant&&DB.merchant.code)||'M2026-0815';
  return (DB.afterSales||[]).filter(a=>a.liable=='商家'&&a.issueType&&a.cpCounted).map(a=>({
    id:a.id, week:w, merchant:m, cat:a.cat||'新鲜蔬菜', issue:a.issueType, client:a.client, item:a.item, order:a.order,
    closeBy:a.cpCloseBy||'未申诉', closedAt:a.cpClosedAt||ts()}));
}
function allTickets(){return DB.cpTickets.concat(liveTickets());}
const mName=code=>(DB.cpMerchants.find(m=>m.code==code)||{name:code}).name;

/* ---------- 计算 ---------- */
function matchTier(tiers,cnt,rate){
  for(let i=tiers.length-1;i>=0;i--){const t=tiers[i];
    if(cnt>=+t.min&&(t.max===''||cnt<=+t.max)){
      const rateOk = t.rate===''||rate*100>=+t.rate;
      return {idx:i, tier:t, rateOk};
    }}
  return null;
}
function inProtect(code,week){
  const d=DB.cpCfg.protectDays; if(d===''||d==null)return false;
  const m=DB.cpMerchants.find(x=>x.code==code); if(!m)return false;
  const diff=(new Date(week.end)-new Date(m.firstFulfill))/86400000;
  return diff < +d;
}
// 计算某统计周的考核结果（未出单的周按当前规则实时算；已出单的周取快照）
function calcWeek(wk){
  const week=cpWeek(wk), iss=DB.cpIssued[wk];
  if(iss&&iss.rows) return iss.rows;
  const cfg=DB.cpCfg, groups={};
  allTickets().filter(t=>t.week==wk).forEach(t=>{const k=[t.merchant,t.cat,t.issue].join('|');(groups[k]=groups[k]||[]).push(t);});
  const rows=Object.keys(groups).map(k=>{
    const [merchant,cat,issue]=k.split('|'), list=groups[k], cnt=list.length;
    const base=DB.cpBase[[merchant,cat,wk].join('|')]||0, rate=base?cnt/base:0;
    const hit=matchTier(cfg.rules[issue][cat],cnt,rate);
    let result='none', amt=0, note='';
    if((iss&&!iss.rows)||(!iss&&!cfg.enabled)){result='stat';}       // 规则未启用（出单时或当前）：仅统计
    else if(hit){
      if(hit.tier.act=='warn'||!hit.rateOk){result='warn'; if(!hit.rateOk)note='客诉率未达门槛';}
      else if(inProtect(merchant,week)){result='warn'; note='新商保护期';}
      else if(hit.tier.amt===''){result='fine'; amt=null;}
      else {result='fine'; amt=+hit.tier.amt;}
    }
    return {merchant, cat, issue, cnt, base, rate, tierIdx:hit?hit.idx:-1, tier:hit?hit.tier:null, result, amt, note, tickets:list.map(t=>t.id)};
  });
  // 单商家单周封顶：超出部分按比例不计，结果上标注
  const cap=cfg.weekCap;
  if(cap!==''&&cap!=null){
    const byM={}; rows.filter(r=>r.result=='fine'&&r.amt).forEach(r=>{(byM[r.merchant]=byM[r.merchant]||[]).push(r);});
    Object.values(byM).forEach(rs=>{let left=+cap; rs.forEach(r=>{const take=Math.min(r.amt,Math.max(0,left)); if(take<r.amt){r.note='已达单周封顶';r.capFrom=r.amt;r.amt=+take.toFixed(2);} left-=take;});});
  }
  return rows.sort((a,b)=>a.merchant.localeCompare(b.merchant)||CP_CATS.indexOf(a.cat)-CP_CATS.indexOf(b.cat)||CP_ISSUE_KEYS.indexOf(a.issue)-CP_ISSUE_KEYS.indexOf(b.issue));
}
window.cpCalcWeek=calcWeek;
function weekState(wk){const w=cpWeek(wk);if(w.off==0)return 'running';return DB.cpIssued[wk]?'issued':'pending';}
const WK_ST={running:['统计中','t-b'],pending:['待确认出单','t-y'],issued:['已出单','t-g']};
const wkTag=wk=>{const[t,c]=WK_ST[weekState(wk)];return `<span class="tag ${c}"><span class="dot"></span>${t}</span>`;};
function resTag(r,running){
  if(r.result=='stat')return '<span class="tag t-gr"><span class="dot"></span>规则未启用 · 仅统计</span>';
  if(r.result=='none')return '<span class="tag t-gr"><span class="dot"></span>未达阈值</span>';
  if(r.result=='warn')return `<span class="tag t-y"><span class="dot"></span>${running?'预计':''}警告</span>${r.note?`<div style="font-size:11px;color:var(--ts);margin-top:2px">${r.note}</div>`:''}`;
  return `<span class="tag t-r"><span class="dot"></span>${running?'预计':''}罚款</span>${r.note?`<div style="font-size:11px;color:var(--ts);margin-top:2px">${r.note}</div>`:''}`;
}
const tierTxt=r=>r.tierIdx<0?'—':`第 ${r.tierIdx+1} 档`;
const pct=v=>(v*100).toFixed(2)+'%';
const amtCell=r=>r.result!='fine'?'<span style="color:var(--ts)">—</span>':r.amt==null?'<span style="color:var(--y)">金额未配置</span>':`<span style="color:var(--r);font-weight:700">-${money(r.amt)}</span>`;
function cfgReady(){
  const miss=[];CP_ISSUE_KEYS.forEach(k=>CP_CATS.forEach(c=>DB.cpCfg.rules[k][c].forEach((t,i)=>{if(t.act=='fine'&&t.amt==='')miss.push(`${CP_ISSUE[k]} · ${c} · 第 ${i+1} 档`);})));
  return miss;
}

/* =================== 运营平台 · 客诉罚款规则 =================== */
PAGES['p-cpcfg']=()=>{
  const c=DB.cpCfg, d=DB.cpDraft||(DB.cpDraft=JSON.parse(JSON.stringify(c)));
  const tiers=d.rules[DB.cpCfgTab][DB.cpCfgCat], miss=cfgReady();
  const sec=t=>`<div style="display:flex;align-items:center;gap:10px;margin:2px 0 14px"><span style="width:4px;height:16px;background:var(--g);border-radius:2px"></span><h3 style="font-size:14.5px;font-weight:700">${t}</h3></div>`;
  return `<div class="card" style="margin-bottom:14px"><div class="card-hd"><h3>启用状态</h3>
      <div class="row" style="gap:10px;align-items:center">${c.enabled?'<span class="tag t-g"><span class="dot"></span>已启用</span>':'<span class="tag t-gr"><span class="dot"></span>未启用</span>'}
      ${c.enabled?'<button class="btn btn-o btn-sm" onclick="cp_toggle(false)">停用</button>':`<button class="btn btn-p btn-sm" ${miss.length?'disabled title="有罚款档位未填金额"':''} onclick="cp_toggle(true)">启用</button>`}</div></div>
    <div class="card-bd" style="font-size:13px;color:var(--ts)">${miss.length?`<span style="color:var(--y)">${miss.length} 个罚款档位未填罚款金额，填完并保存后才能启用。</span>`:'所有罚款档位已配置金额。'}${c.updatedAt?` 最近保存：${c.updatedAt} · ${c.updatedBy}`:''}</div>
  </div>

  <div class="card" style="margin-bottom:14px"><div class="card-hd"><h3>通用设置</h3></div><div class="card-bd">
    <div class="fg3">
      <div class="fr"><label class="fl">新商保护期（天）</label><input id="cp-protect" type="number" min="0" max="365" step="1" value="${d.protectDays}" placeholder="留空 = 不设保护期" oninput="DB.cpDraft.protectDays=this.value"></div>
      <div class="fr"><label class="fl">单商家单周罚款封顶（S$）</label><input id="cp-cap" type="number" min="0" step="1" value="${d.weekCap}" placeholder="留空 = 不封顶" oninput="DB.cpDraft.weekCap=this.value"></div>
      <div class="fr"><label class="fl">出单时间</label><input value="每周三（统计上周一至周日）" readonly style="background:#F3F4F6;color:var(--ts)"></div>
    </div>
  </div></div>

  <div class="card"><div class="card-hd"><h3>档位规则</h3><span class="sub">按 问题类型 × 品类 分别配置</span></div><div class="card-bd">
    <div class="tabs" style="margin-bottom:14px">${CP_ISSUE_KEYS.map(k=>`<div class="tab ${DB.cpCfgTab==k?'active':''}" onclick="DB.cpCfgTab='${k}';render()">${CP_ISSUE[k]}</div>`).join('')}</div>
    <div class="row" style="gap:6px;margin-bottom:14px;flex-wrap:wrap">${CP_CATS.map(ct=>`<button class="btn btn-sm ${DB.cpCfgCat==ct?'btn-p':'btn-o'}" onclick="DB.cpCfgCat='${ct}';render()">${ct}</button>`).join('')}</div>
    <div style="overflow-x:auto"><table>
      <thead><tr><th style="width:80px;white-space:nowrap">档位</th><th>周客诉量 · 从（单）</th><th>周客诉量 · 到（单）</th><th>周客诉率门槛（%）</th><th>处理方式</th><th>罚款金额（S$ / 次）</th><th style="width:70px">操作</th></tr></thead><tbody>
      ${tiers.map((t,i)=>`<tr>
        <td style="white-space:nowrap">第 ${i+1} 档</td>
        <td><input class="ministock" style="width:90px;${i>0?'background:#F3F4F6;color:var(--ts)':''}" value="${t.min}" ${i>0?'readonly title="= 上一档「到」+1，自动联动"':''} onchange="cp_tier(${i},'min',this.value)"></td>
        <td><input class="ministock" style="width:90px" value="${t.max}" placeholder="${i==tiers.length-1?'空 = 及以上':''}" onchange="cp_tier(${i},'max',this.value)"></td>
        <td><input class="ministock" style="width:100px" value="${t.rate}" placeholder="空 = 不校验" onchange="cp_tier(${i},'rate',this.value)"></td>
        <td><select style="width:110px" onchange="cp_tier(${i},'act',this.value)"><option value="warn" ${t.act=='warn'?'selected':''}>警告</option><option value="fine" ${t.act=='fine'?'selected':''}>罚款</option></select></td>
        <td>${t.act=='fine'?`<input class="miniprice" style="width:110px;${t.amt===''?'border-color:var(--y)':''}" value="${t.amt}" placeholder="待填写" onchange="cp_tier(${i},'amt',this.value)">`:'<span style="color:var(--ts)">—</span>'}</td>
        <td>${tiers.length>1?`<button class="btn btn-link btn-sm" style="color:var(--r)" onclick="cp_tierDel(${i})">删除</button>`:''}</td>
      </tr>`).join('')}
      </tbody></table></div>
    <div class="row" style="justify-content:space-between;margin-top:12px">
      <div class="row" style="gap:8px"><button class="btn btn-o btn-sm" onclick="cp_tierAdd()">+ 添加档位</button><button class="btn btn-o btn-sm" onclick="cp_copyCats()">复制到本问题类型其他品类</button></div>
      <div class="row" style="gap:8px"><button class="btn btn-o" onclick="DB.cpDraft=null;render();toast('已放弃未保存的修改','info')">放弃修改</button><button class="btn btn-p" onclick="cp_save()">保存规则</button></div>
    </div>
  </div></div>`;
};
window.cp_tier=function(i,k,v){
  const tiers=DB.cpDraft.rules[DB.cpCfgTab][DB.cpCfgCat]; v=String(v).trim();
  if(k=='act'){tiers[i].act=v; if(v=='warn')tiers[i].amt=''; render(); return;}
  if(v!==''&&!(+v>=0)){toast('请输入不小于 0 的数字','err');render();return;}
  if(k=='max'){
    if(v!==''&&+v<+tiers[i].min){toast(`「到」不能小于「从」（${tiers[i].min}）`,'err');render();return;}
    if(v===''&&i<tiers.length-1){toast('只有最后一档可以留空（表示及以上）','err');render();return;}
    tiers[i].max=v===''?'':+v; if(tiers[i+1])tiers[i+1].min=+v+1;      // 下一档「从」自动联动
  } else if(k=='rate'){ if(v!==''&&+v>100){toast('客诉率门槛不能超过 100%','err');render();return;} tiers[i].rate=v===''?'':+v; }
  else if(k=='amt'){ tiers[i].amt=v===''?'':+(+v).toFixed(2); }
  else tiers[i][k]=v===''?'':+v;
  render();
};
window.cp_tierAdd=function(){
  const tiers=DB.cpDraft.rules[DB.cpCfgTab][DB.cpCfgCat], last=tiers[tiers.length-1];
  if(last.max===''){toast('请先给最后一档填写「到」，再添加下一档','err');return;}
  tiers.push({min:+last.max+1,max:'',rate:'',act:'fine',amt:''});render();
};
window.cp_tierDel=function(i){
  const tiers=DB.cpDraft.rules[DB.cpCfgTab][DB.cpCfgCat]; tiers.splice(i,1);
  tiers.forEach((t,j)=>{if(j>0)t.min=+tiers[j-1].max+1;}); tiers[tiers.length-1].max='';
  if(tiers[0])tiers[0].min=tiers[0].min||1; render();
};
window.cp_copyCats=function(){
  const src=DB.cpDraft.rules[DB.cpCfgTab][DB.cpCfgCat];
  modal(`<div class="mc-hd"><h3>复制档位</h3><p>把「${CP_ISSUE[DB.cpCfgTab]} · ${DB.cpCfgCat}」的档位覆盖到同问题类型的其他 ${CP_CATS.length-1} 个品类</p><button class="mc-x" onclick="closeModal()">×</button></div>
  <div class="mc-bd"><div class="ib ib-y"><span class="i">⚠️</span>其他品类当前的档位会被覆盖（未保存前可「放弃修改」恢复）。</div></div>
  <div class="mc-ft"><button class="btn btn-o" onclick="closeModal()">取消</button><button class="btn btn-p" onclick="cp_copyDo()">确认复制</button></div>`);
};
window.cp_copyDo=function(){CP_CATS.forEach(c=>{if(c!=DB.cpCfgCat)DB.cpDraft.rules[DB.cpCfgTab][c]=JSON.parse(JSON.stringify(DB.cpDraft.rules[DB.cpCfgTab][DB.cpCfgCat]));});closeModal();render();toast('已复制，保存后生效','ok');};
window.cp_save=function(){
  const d=DB.cpDraft;
  for(const k of CP_ISSUE_KEYS)for(const c of CP_CATS){const ts_=d.rules[k][c];
    for(let i=0;i<ts_.length;i++){if(i<ts_.length-1&&ts_[i].max===''){toast(`${CP_ISSUE[k]} · ${c}：第 ${i+1} 档「到」未填写`,'err');return;}}}
  const miss=[];CP_ISSUE_KEYS.forEach(k=>CP_CATS.forEach(c=>d.rules[k][c].forEach((t,i)=>{if(t.act=='fine'&&t.amt==='')miss.push(1);})));
  if(DB.cpCfg.enabled&&miss.length){toast(`规则已启用，罚款档位必须填金额（还有 ${miss.length} 个未填）`,'err');return;}
  d.updatedAt=ts(); d.updatedBy='运营 · 林晓';
  DB.cpCfg=JSON.parse(JSON.stringify(d)); DB.cpDraft=null; render();
  toast('规则已保存，对之后出单的统计周生效；已出单的不追溯','ok');
};
window.cp_toggle=function(on){
  if(DB.cpDraft&&JSON.stringify(DB.cpDraft)!==JSON.stringify(DB.cpCfg)){toast('有未保存的修改，请先保存规则','err');return;}
  if(on&&cfgReady().length){toast('还有罚款档位未填金额','err');return;}
  modal(`<div class="mc-hd"><h3>${on?'启用':'停用'}客诉罚款</h3><button class="mc-x" onclick="closeModal()">×</button></div>
  <div class="mc-bd"><div class="ib ${on?'ib-y':'ib-gr'}"><span class="i">${on?'⚠️':'ℹ️'}</span>${on?'启用后，之后每周确认出单时按本规则生成警告与罚款单，影响全平台商家。':'停用后，确认出单只统计不处理，已生成的罚款单不受影响。'}</div></div>
  <div class="mc-ft"><button class="btn btn-o" onclick="closeModal()">取消</button><button class="btn ${on?'btn-p':'btn-d'}" onclick="DB.cpCfg.enabled=${on};DB.cpDraft=null;closeModal();render();toast('已${on?'启用':'停用'}','ok')">确认${on?'启用':'停用'}</button></div>`);
};

/* =================== 运营平台 · 客诉考核 =================== */
function opsRows(){
  const f=DB.cpFilter, hit=(v,k)=>!k||String(v||'').toLowerCase().includes(String(k).trim().toLowerCase());
  return calcWeek(f.week).filter(r=>hit(r.merchant+' '+mName(r.merchant),f.merchant)&&(!f.result||r.result==f.result));
}
PAGES['p-cpweek']=()=>{
  const f=DB.cpFilter, st=weekState(f.week), rows=opsRows(), w=cpWeek(f.week);
  const iss=DB.cpIssued[f.week];
  return `<div class="card" style="margin-bottom:14px"><div class="card-bd" style="padding:16px 20px 12px">
    <div class="fg3">
      <div class="fr"><label class="fl">统计周</label><select id="cpf-week">${CP_WEEKS.map(x=>`<option value="${x.key}" ${x.key==f.week?'selected':''}>${x.start} ~ ${x.end}</option>`).join('')}</select></div>
      <div class="fr"><label class="fl">商家</label><input id="cpf-m" value="${f.merchant}" placeholder="商家名称或编码"></div>
      <div class="fr"><label class="fl">处理结果</label><select id="cpf-r"><option value="">全部</option>${[['fine','罚款'],['warn','警告'],['none','未达阈值'],['stat','仅统计']].map(([k,t])=>`<option value="${k}" ${f.result==k?'selected':''}>${t}</option>`).join('')}</select></div>
    </div>
    <div class="row" style="justify-content:flex-end;gap:8px;margin-top:2px"><button class="btn btn-o" onclick="DB.cpFilter={week:'${CP_WEEKS[1].key}',merchant:'',result:''};render()">重置</button><button class="btn btn-p" onclick="cp_query()">查询</button></div>
  </div></div>

  <div class="card">
    <div class="card-hd"><h3>${w.start} ~ ${w.end}</h3>
      <div class="row" style="gap:10px;align-items:center">${wkTag(f.week)}
        <button class="btn btn-p btn-sm" ${st=='pending'?'':'disabled'} title="${st=='running'?'本周未结束':st=='issued'?'该周已出单':''}" onclick="cp_issueAsk('${f.week}')">确认出单</button></div></div>
    <div class="card-bd" style="padding:10px 20px;border-bottom:1px solid var(--bd2);font-size:12.5px;color:var(--ts)">
      ${st=='running'?`统计截至当前，周日结束后于 ${w.issueDay} 待确认出单；处理结果为按当前规则的预计值。`
        :st=='pending'?`规则${DB.cpCfg.enabled?'已启用':'<b style="color:var(--y)">未启用</b>'}，确认出单后${DB.cpCfg.enabled?'按当前规则生成警告与罚款单':'只记录统计结果、不生成警告与罚款'}。`
        :`已于 ${iss.at} 由 ${iss.by} 确认出单，结果已快照，规则调整不追溯。`}
    </div>
    <div class="card-bd flush"><div style="overflow-x:auto"><table>
      <thead><tr><th>商家编码</th><th>商家名称</th><th>品类</th><th>问题类型</th><th style="text-align:right">商责客诉量</th><th style="text-align:right">履约商品行数</th><th style="text-align:right">客诉率</th><th>命中档位</th><th>处理结果</th><th style="text-align:right">罚款金额</th><th>罚款单号</th><th>操作</th></tr></thead><tbody>
      ${rows.map(r=>`<tr>
        <td class="mono">${r.merchant}</td><td><b>${mName(r.merchant)}</b></td><td>${r.cat}</td><td>${CP_ISSUE[r.issue]}</td>
        <td style="text-align:right"><b>${r.cnt}</b></td><td style="text-align:right">${r.base}</td><td style="text-align:right">${pct(r.rate)}</td>
        <td>${tierTxt(r)}</td><td>${resTag(r,st!='issued')}</td><td style="text-align:right">${amtCell(r)}</td>
        <td class="mono" style="white-space:nowrap">${r.fineNo||'—'}</td>
        <td><button class="btn btn-o btn-sm" onclick="cp_rowDetail('${f.week}','${r.merchant}','${r.cat}','${r.issue}')">明细</button></td>
      </tr>`).join('')||`<tr><td colspan="12" style="text-align:center;color:var(--ts);padding:22px">${calcWeek(f.week).length?'没有符合筛选条件的记录':'本周暂无已结案的商家责客诉'}</td></tr>`}
      </tbody></table></div></div>
  </div>`;
};
window.cp_query=function(){const g=id=>(document.getElementById(id)||{}).value||'';DB.cpFilter={week:g('cpf-week'),merchant:g('cpf-m').trim(),result:g('cpf-r')};render();};
window.cp_rowDetail=function(wk,m,c,issue){
  const r=calcWeek(wk).find(x=>x.merchant==m&&x.cat==c&&x.issue==issue); if(!r)return;
  const list=allTickets().filter(t=>r.tickets.includes(t.id)), w=cpWeek(wk), ops=DB.role=='shop_ops';
  const kv=(k,v)=>`<div style="min-width:0"><div style="font-size:12px;color:var(--ts);margin-bottom:4px">${k}</div><div style="font-size:13.5px;color:var(--tp);font-weight:500">${v}</div></div>`;
  const sec=t=>`<div style="display:flex;align-items:center;gap:10px;margin:2px 0 14px"><span style="width:4px;height:16px;background:var(--g);border-radius:2px"></span><h3 style="font-size:14.5px;font-weight:700">${t}</h3></div>`;
  drawer(`<div class="drawer-hd"><div><h3>客诉考核 · ${c} · ${CP_ISSUE[issue]}</h3><div style="font-size:12.5px;color:var(--ts);margin-top:2px">${w.start} ~ ${w.end}</div></div><span class="x" onclick="closeDrawer()">×</span></div>
  <div class="drawer-bd">
    <div class="row" style="gap:8px;margin-bottom:14px">${wkTag(wk)}${resTag(r,weekState(wk)!='issued')}</div>
    ${sec('考核结果')}
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:14px 24px;margin-bottom:20px">
      ${ops?kv('商家',`${mName(m)} <span class="mono" style="color:var(--ts)">${m}</span>`):''}
      ${kv('商责客诉量',r.cnt+' 单')}${kv('履约商品行数',r.base)}${kv('客诉率',pct(r.rate))}
      ${kv('命中档位',r.tier?`${tierTxt(r)}（${r.tier.min}${r.tier.max===''?' 单及以上':' ~ '+r.tier.max+' 单'}${r.tier.rate!==''?'，客诉率 ≥ '+r.tier.rate+'%':''}）`:'—')}
      ${kv('罚款金额',r.result!='fine'?'—':r.amt==null?'金额未配置':money(r.amt)+(r.capFrom?`（原 ${money(r.capFrom)}，已达封顶）`:''))}
      ${r.fineNo?kv('罚款单号',`<span class="mono">${r.fineNo}</span>`):''}
    </div>
    ${sec('计入的售后工单 · '+list.length+' 单')}
    <div style="overflow-x:auto"><table>
      <thead><tr><th>工单号</th><th>订单号</th><th>客户</th><th>商品</th><th>判责结果</th><th>结案方式</th><th>结案时间</th></tr></thead><tbody>
      ${list.map(t=>`<tr><td class="mono">${t.id}</td><td class="mono">${t.order}</td><td>${ord_mask(t.client)}</td><td>${t.item}</td><td><span class="tag t-r"><span class="dot"></span>商家责</span></td><td>${t.closeBy}</td><td style="white-space:nowrap">${t.closedAt}</td></tr>`).join('')}
      </tbody></table></div>
    <div style="font-size:12px;color:var(--ts);margin-top:10px">只统计判责已结案的商家责工单；对单张工单判责有异议，在售后订单的申诉期内申诉，申诉中的工单不计入。</div>
  </div>
  <div class="drawer-ft"><button class="btn btn-o" onclick="closeDrawer()">关闭</button>${r.fineNo?`<button class="btn btn-p" onclick="closeDrawer();cp_fineDetail('${r.fineNo}')">查看罚款单</button>`:''}</div>`);
};
window.cp_issueAsk=function(wk){
  const rows=calcWeek(wk), on=DB.cpCfg.enabled, w=cpWeek(wk);
  if(on&&rows.some(r=>r.result=='fine'&&r.amt==null)){toast('有命中罚款档位但金额未配置，请先到「客诉罚款规则」补全','err');return;}
  const byM={};rows.forEach(r=>{const o=byM[r.merchant]=byM[r.merchant]||{warn:0,fine:0,amt:0};if(r.result=='warn')o.warn++;if(r.result=='fine'){o.fine++;o.amt+=r.amt;}});
  const ms=Object.keys(byM), tot=ms.reduce((a,m)=>a+byM[m].amt,0);
  modal(`<div class="mc-hd"><h3>确认出单 · ${w.start} ~ ${w.end}</h3><p>${on?'按当前规则生成警告与罚款单':'规则未启用，只记录统计结果'}</p><button class="mc-x" onclick="closeModal()">×</button></div>
  <div class="mc-bd">
    ${on?`<div style="border:1px solid var(--bd);border-radius:8px;overflow:hidden;margin-bottom:12px"><table style="margin:0"><thead><tr><th>商家</th><th style="text-align:right">警告</th><th style="text-align:right">罚款项</th><th style="text-align:right">罚款合计</th></tr></thead><tbody>
      ${ms.map(m=>`<tr><td><b>${mName(m)}</b> <span class="mono" style="color:var(--ts);font-size:11px">${m}</span></td><td style="text-align:right">${byM[m].warn}</td><td style="text-align:right">${byM[m].fine}</td><td style="text-align:right;color:var(--r);font-weight:600">${byM[m].amt?'-'+money(byM[m].amt):'—'}</td></tr>`).join('')}
      <tr style="background:#F7FBF8;font-weight:700"><td>合计 ${ms.length} 个商家</td><td style="text-align:right">${ms.reduce((a,m)=>a+byM[m].warn,0)}</td><td style="text-align:right">${ms.reduce((a,m)=>a+byM[m].fine,0)}</td><td style="text-align:right;color:var(--r)">${tot?'-'+money(tot):'—'}</td></tr>
    </tbody></table></div>`:''}
    <div class="ib ib-y"><span class="i">⚠️</span>出单后结果快照，不可撤回；警告与罚款单同步通知商家。${on?'罚款单按商家合并，每个商家本周一张，进「罚款单 › 客诉罚款」待推送财务。':''}</div>
  </div>
  <div class="mc-ft"><button class="btn btn-o" onclick="closeModal()">取消</button><button class="btn btn-p" onclick="cp_issueDo('${wk}')">确认出单</button></div>`);
};
window.cp_issueDo=function(wk){
  const on=DB.cpCfg.enabled, rows=calcWeek(wk).map(r=>Object.assign({},r)), w=cpWeek(wk); let n=0;
  if(on){
    const byM={};rows.filter(r=>r.result=='fine'&&r.amt>0).forEach(r=>{(byM[r.merchant]=byM[r.merchant]||[]).push(r);});
    Object.keys(byM).forEach(m=>{
      const no='FC'+w.issueDay.replace(/-/g,'')+p2(DB.cpFineSeq++).padStart(3,'0');
      const lines=byM[m].map(r=>({cat:r.cat,issue:r.issue,cnt:r.cnt,base:r.base,rate:r.rate,tierIdx:r.tierIdx,tier:Object.assign({},r.tier),amt:r.amt,capFrom:r.capFrom||null}));
      DB.cpFines.unshift({no, merchant:m, merchantName:mName(m), week:wk, at:ts(), lines, amt:+lines.reduce((a,x)=>a+x.amt,0).toFixed(2), status:'pending', push:'pending', pushedAt:'', batchNo:'', billNo:''});
      byM[m].forEach(r=>r.fineNo=no); n++;
    });
  } else rows.forEach(r=>{r.result=r.result=='none'?'none':'stat';r.amt=0;});
  DB.cpIssued[wk]={at:ts(), by:'运营 · 林晓', rows};
  closeModal(); cpSettleSync(); render();
  toast(on?`已出单：生成 ${n} 张客诉罚款单，警告 ${rows.filter(r=>r.result=='warn').length} 条已通知商家`:'已记录统计结果（规则未启用，未生成警告与罚款）','ok');
};

/* =================== 罚款单 · 客诉罚款（运营 / 商家共用） =================== */
function cpFineList(all){return DB.cpFines.filter(g=>all||g.merchant==((DB.merchant&&DB.merchant.code)||'M2026-0815'));}
const cpStTag=s=>s=='pending'?'<span class="tag t-y"><span class="dot"></span>待结算</span>':'<span class="tag t-b"><span class="dot"></span>已结算</span>';
const cpPushTag=g=>g.push=='pushed'?`<span class="tag t-g" style="font-size:10.5px"><span class="dot"></span>已推送财务</span><div style="font-size:11px;color:var(--ts);margin-top:2px">${g.pushedAt} · <span class="mono">${g.batchNo}</span></div>`:'<span class="tag t-y" style="font-size:10.5px"><span class="dot"></span>待推送财务</span>';
function cpFineOps(){
  const f=DB.cpFineFilter, hit=(v,k)=>!k||String(v||'').toLowerCase().includes(String(k).trim().toLowerCase());
  const rows=cpFineList(true).filter(g=>hit(g.merchant+' '+g.merchantName,f.merchant)&&(!f.push||g.push==f.push));
  const selectable=rows.filter(g=>g.push=='pending'); DB.cpSel=DB.cpSel.filter(no=>selectable.some(g=>g.no==no));
  const allSel=selectable.length&&selectable.every(g=>DB.cpSel.includes(g.no));
  return `<div class="card" style="margin-bottom:14px"><div class="card-bd" style="padding:16px 20px 12px">
    <div class="fg3">
      <div class="fr"><label class="fl">商家</label><input id="cpff-m" value="${f.merchant}" placeholder="商家名称或编码"></div>
      <div class="fr"><label class="fl">推送状态</label><select id="cpff-p"><option value="">全部</option><option value="pending" ${f.push=='pending'?'selected':''}>待推送</option><option value="pushed" ${f.push=='pushed'?'selected':''}>已推送</option></select></div>
      <div class="fr"></div>
    </div>
    <div class="row" style="justify-content:flex-end;gap:8px;margin-top:2px"><button class="btn btn-o" onclick="DB.cpFineFilter={merchant:'',push:''};render()">重置</button><button class="btn btn-p" onclick="DB.cpFineFilter={merchant:document.getElementById('cpff-m').value.trim(),push:document.getElementById('cpff-p').value};render()">查询</button></div>
  </div></div>
  <div class="card">
    <div class="selbar" style="display:flex;align-items:center;justify-content:flex-end;gap:10px;padding:10px 16px;background:#F0FBF4;border-bottom:1px solid var(--bd);font-size:13px">
      ${DB.cpSel.length?`<button class="btn btn-link" onclick="DB.cpSel=[];render()">取消选择</button>`:''}
      <button class="btn btn-p btn-sm" ${DB.cpSel.length?'':'disabled'} onclick="cp_pushAsk()">推送财务结算${DB.cpSel.length?` (${DB.cpSel.length})`:''}</button>
    </div>
    <div class="card-bd flush"><div style="overflow-x:auto"><table>
      <thead><tr><th style="width:34px"><input type="checkbox" class="skuchk" ${allSel?'checked':''} onclick="cp_selAll()"></th><th>罚款单号</th><th>商家编码</th><th>商家名称</th><th>统计周</th><th style="text-align:right">罚款项数</th><th style="text-align:right">罚款金额</th><th>结算状态</th><th>推送状态</th><th>出单时间</th><th>操作</th></tr></thead><tbody>
      ${rows.map(g=>`<tr>
        <td>${g.push=='pending'?`<input type="checkbox" class="skuchk" ${DB.cpSel.includes(g.no)?'checked':''} onclick="cp_toggleSel('${g.no}')">`:''}</td>
        <td class="mono">${g.no}</td><td class="mono">${g.merchant}</td><td><b>${g.merchantName}</b></td><td style="white-space:nowrap">${cpWeek(g.week).start} ~ ${cpWeek(g.week).end}</td>
        <td style="text-align:right">${g.lines.length}</td><td style="text-align:right;color:var(--r);font-weight:700">-${money(g.amt)}</td>
        <td>${cpStTag(g.status)}</td><td>${cpPushTag(g)}</td><td style="white-space:nowrap">${g.at}</td>
        <td><button class="btn btn-o btn-sm" onclick="cp_fineDetail('${g.no}')">详情</button></td></tr>`).join('')
      ||`<tr><td colspan="11" style="text-align:center;color:var(--ts);padding:22px">${cpFineList(true).length?'没有符合筛选条件的罚款单':'暂无客诉罚款单'}</td></tr>`}
      </tbody></table></div></div>
  </div>`;
}
window.cp_toggleSel=function(no){const i=DB.cpSel.indexOf(no);i<0?DB.cpSel.push(no):DB.cpSel.splice(i,1);render();};
window.cp_selAll=function(){const s=cpFineList(true).filter(g=>g.push=='pending').map(g=>g.no);DB.cpSel=(s.length&&s.every(n=>DB.cpSel.includes(n)))?[]:s;render();};
window.cp_pushAsk=function(){
  const rows=cpFineList(true).filter(g=>DB.cpSel.includes(g.no)); if(!rows.length){toast('请先勾选待推送的罚款单','err');return;}
  const tot=rows.reduce((a,g)=>a+g.amt,0);
  modal(`<div class="mc-hd"><h3>推送财务结算</h3><p>将 ${rows.length} 张客诉罚款单作为结算减项推送至清结算平台</p><button class="mc-x" onclick="closeModal()">×</button></div>
  <div class="mc-bd"><div style="border:1px solid var(--bd);border-radius:8px;overflow:hidden;margin-bottom:12px"><table style="margin:0"><thead><tr><th>罚款单号</th><th>商家</th><th style="text-align:right">金额</th></tr></thead><tbody>
    ${rows.map(g=>`<tr><td class="mono">${g.no}</td><td>${g.merchantName}</td><td style="text-align:right;color:var(--r)">-${money(g.amt)}</td></tr>`).join('')}
    <tr style="background:#F7FBF8;font-weight:700"><td colspan="2">合计</td><td style="text-align:right;color:var(--r)">-${money(tot)}</td></tr></tbody></table></div>
    <div class="ib ib-y"><span class="i">⚠️</span>推送后不可重复推送、不可撤回；罚款不开发票。</div></div>
  <div class="mc-ft"><button class="btn btn-o" onclick="closeModal()">取消</button><button class="btn btn-p" onclick="cp_pushDo()">确认推送</button></div>`);
};
window.cp_pushDo=function(){
  const batch='FB-'+(DB.siteCode||'SG')+'-'+ts().slice(0,10).replace(/-/g,'')+'-'+String(DB.fineBatchSeq++).padStart(3,'0'), now=ts(); let n=0;
  DB.cpFines.forEach(g=>{if(DB.cpSel.includes(g.no)&&g.push=='pending'){g.push='pushed';g.pushedAt=now;g.batchNo=batch;n++;}});
  DB.cpSel=[];closeModal();render();toast(`已推送 ${n} 张客诉罚款单，批次 ${batch}`,'ok');
};
window.cp_fineDetail=function(no){
  const g=DB.cpFines.find(x=>x.no==no); if(!g)return; const w=cpWeek(g.week), ops=DB.role=='shop_ops';
  const kv=(k,v)=>`<div style="min-width:0"><div style="font-size:12px;color:var(--ts);margin-bottom:4px">${k}</div><div style="font-size:13.5px;color:var(--tp);font-weight:500">${v||'—'}</div></div>`;
  const sec=t=>`<div style="display:flex;align-items:center;gap:10px;margin:2px 0 14px"><span style="width:4px;height:16px;background:var(--g);border-radius:2px"></span><h3 style="font-size:14.5px;font-weight:700">${t}</h3></div>`;
  drawer(`<div class="drawer-hd"><div><h3>${g.no} · 客诉罚款单</h3><div style="font-size:12.5px;color:var(--ts);margin-top:2px">统计周 ${w.start} ~ ${w.end}</div></div><span class="x" onclick="closeDrawer()">×</span></div>
  <div class="drawer-bd">
    <div class="row" style="gap:8px;margin-bottom:14px">${cpStTag(g.status)}<span class="tag t-r"><span class="dot"></span>客诉罚款</span></div>
    ${sec('单据信息')}
    <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:14px 24px;margin-bottom:20px">
      ${kv('罚款单号',`<span class="mono">${g.no}</span>`)}${ops?kv('商家',`${g.merchantName} <span class="mono" style="color:var(--ts)">${g.merchant}</span>`):''}
      ${kv('罚款事由','客诉罚款')}${kv('统计周',`${w.start} ~ ${w.end}`)}${kv('出单时间',g.at)}
      ${kv('罚款金额',`<span style="color:var(--r);font-weight:700">-${money(g.amt)}</span>`)}
      ${kv('抵扣所属结算单',g.billNo?`<span class="mono">${g.billNo}</span>`:'待本期结算单生成时抵扣')}
      ${ops?kv('推送状态',cpPushTag(g)):''}
    </div>
    ${sec('罚款明细')}
    <div style="overflow-x:auto"><table>
      <thead><tr><th>品类</th><th>问题类型</th><th style="text-align:right">商责客诉量</th><th style="text-align:right">客诉率</th><th>命中档位</th><th style="text-align:right">罚款金额</th><th>操作</th></tr></thead><tbody>
      ${g.lines.map(x=>`<tr><td>${x.cat}</td><td>${CP_ISSUE[x.issue]}</td><td style="text-align:right">${x.cnt}</td><td style="text-align:right">${pct(x.rate)}</td><td>第 ${x.tierIdx+1} 档</td>
        <td style="text-align:right;color:var(--r);font-weight:600">-${money(x.amt)}${x.capFrom?`<div style="font-size:11px;color:var(--ts);font-weight:400">原 ${money(x.capFrom)}，已达封顶</div>`:''}</td>
        <td><button class="btn btn-link btn-sm" onclick="closeDrawer();cp_rowDetail('${g.week}','${g.merchant}','${x.cat}','${x.issue}')">计入工单</button></td></tr>`).join('')}
      <tr style="font-weight:700;background:var(--gl)"><td colspan="5">合计</td><td style="text-align:right;color:var(--r)">-${money(g.amt)}</td><td></td></tr>
      </tbody></table></div>
  </div>
  <div class="drawer-ft"><button class="btn btn-o" onclick="closeDrawer()">关闭</button></div>`);
};

/* =================== 商家端 · 客诉罚款 / 客诉考核 =================== */
function cpMerchantFines(){
  const rows=cpFineList(false);
  return `<div class="card"><div class="card-bd flush"><div style="overflow-x:auto"><table>
    <thead><tr><th>罚款单号</th><th>统计周</th><th style="text-align:right">罚款项数</th><th style="text-align:right">罚款金额</th><th>结算状态</th><th>抵扣所属结算单</th><th>出单时间</th><th>操作</th></tr></thead><tbody>
    ${rows.map(g=>`<tr><td class="mono">${g.no}</td><td style="white-space:nowrap">${cpWeek(g.week).start} ~ ${cpWeek(g.week).end}</td><td style="text-align:right">${g.lines.length}</td>
      <td style="text-align:right;color:var(--r);font-weight:700">-${money(g.amt)}</td><td>${cpStTag(g.status)}</td><td class="mono">${g.billNo||'—'}</td><td style="white-space:nowrap">${g.at}</td>
      <td><button class="btn btn-o btn-sm" onclick="cp_fineDetail('${g.no}')">详情</button></td></tr>`).join('')
    ||`<tr><td colspan="8"><div class="empty"><div class="e-ic">⚖️</div><div class="e-t">暂无客诉罚款单</div><div class="e-s">每周三按上周客诉考核结果出单</div></div></td></tr>`}
    </tbody></table></div></div></div>`;
}
function nextTierHint(r){
  const tiers=DB.cpCfg.rules[r.issue][r.cat]; const nx=tiers.find((t,i)=>i>r.tierIdx&&t.act=='fine');
  if(!nx)return '—'; return `再 ${nx.min-r.cnt} 单进入第 ${tiers.indexOf(nx)+1} 档（罚款）`;
}
function cpMerchantWeeks(){
  const me=(DB.merchant&&DB.merchant.code)||'M2026-0815', wk=DB.cpMWeek, running=weekState(wk)=='running', pre=weekState(wk)!='issued';
  const rows=calcWeek(wk).filter(r=>r.merchant==me);
  return `<div class="card"><div class="card-hd"><h3>客诉考核</h3>
      <div class="row" style="gap:10px;align-items:center">${wkTag(wk)}<select style="width:220px" onchange="DB.cpMWeek=this.value;render()">${CP_WEEKS.map(x=>`<option value="${x.key}" ${x.key==wk?'selected':''}>${x.start} ~ ${x.end}</option>`).join('')}</select></div></div>
    <div class="card-bd flush"><div style="overflow-x:auto"><table>
      <thead><tr><th>品类</th><th>问题类型</th><th style="text-align:right">商责客诉量</th><th style="text-align:right">履约商品行数</th><th style="text-align:right">客诉率</th><th>命中档位</th><th>处理结果</th><th style="text-align:right">罚款金额</th>${running?'<th>距罚款档</th>':'<th>罚款单号</th>'}<th>操作</th></tr></thead><tbody>
      ${rows.map(r=>`<tr><td>${r.cat}</td><td>${CP_ISSUE[r.issue]}</td><td style="text-align:right"><b>${r.cnt}</b></td><td style="text-align:right">${r.base}</td><td style="text-align:right">${pct(r.rate)}</td>
        <td>${tierTxt(r)}</td><td>${resTag(r,pre)}</td><td style="text-align:right">${amtCell(r)}</td>
        <td style="white-space:nowrap">${running?(r.tier&&r.tier.act=='fine'?'—':nextTierHint(r)):`<span class="mono">${r.fineNo||'—'}</span>`}</td>
        <td><button class="btn btn-o btn-sm" onclick="cp_rowDetail('${wk}','${r.merchant}','${r.cat}','${r.issue}')">明细</button></td></tr>`).join('')
      ||`<tr><td colspan="10"><div class="empty"><div class="e-ic">✅</div><div class="e-t">该周无商家责客诉</div></div></td></tr>`}
      </tbody></table></div></div></div>`;
}

/* ---------- 挂到现有「罚款单」页：按罚款事由分 Tab ---------- */
const origOps=PAGES['p-fine'], origM=PAGES['m-fine'];
PAGES['p-fine']=()=>{
  const t=DB.cpOpsTab, pend=cpFineList(true).filter(g=>g.push=='pending').length;
  return `<div class="tabs"><div class="tab ${t=='receipt'?'active':''}" onclick="DB.cpOpsTab='receipt';render()">到仓少货</div><div class="tab ${t=='cp'?'active':''}" onclick="DB.cpOpsTab='cp';render()">客诉罚款${pend?`<span class="tb">${pend}</span>`:''}</div></div>`
    +(t=='cp'?cpFineOps():origOps());
};
PAGES['m-fine']=()=>{
  const t=DB.cpMTab, pend=cpFineList(false).filter(g=>g.status=='pending').length;
  return `<div class="tabs"><div class="tab ${t=='receipt'?'active':''}" onclick="DB.cpMTab='receipt';render()">到仓少货</div><div class="tab ${t=='cp'?'active':''}" onclick="DB.cpMTab='cp';render()">客诉罚款${pend?`<span class="tb">${pend}</span>`:''}</div><div class="tab ${t=='week'?'active':''}" onclick="DB.cpMTab='week';render()">客诉考核</div></div>`
    +(t=='cp'?cpMerchantFines():t=='week'?cpMerchantWeeks():origM());
};

/* ---------- 结算联动：客诉罚款作为独立减项进当期结算单 ---------- */
window.cpSettleSync=function(){
  if(!DB.bill||!DB.bill.items)return;
  const pend=cpFineList(false).filter(g=>g.status=='pending'), amt=+pend.reduce((a,g)=>a+g.amt,0).toFixed(2);
  DB.bill.cpFine=amt; DB.bill.cpFineCnt=pend.length;
  DB.bill.items=DB.bill.items.filter(it=>it[0]!='客诉罚款');
  if(amt>0)DB.bill.items.push(['客诉罚款',pend.length,-amt]);
  if(typeof recalcBillNet=='function')recalcBillNet();
};
window.cpPendingCount=()=>cpFineList(false).filter(g=>g.status=='pending').length;
window.cpOpsPendingCount=()=>cpFineList(true).filter(g=>g.push=='pending').length;
window.cpWeekPendingCount=()=>CP_WEEKS.filter(w=>weekState(w.key)=='pending').length;
})();
