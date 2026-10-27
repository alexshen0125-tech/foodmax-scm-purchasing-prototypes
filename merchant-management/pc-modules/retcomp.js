/* Food Max 商家系统 · 退货赔付（2026-10-27 沈亮定）
   商家端：财务 › 退货赔付（m-ret-comp）；店铺运营平台：退货赔付（p-ret-comp，只读，看全部商家）
   - 数据来源：退货申诉（客户退货 DB.afterSales[].retAppeal / 仓库退回 DB.whrAppeals）核定「成立 / 部分成立」且赔付 > 0 的记录，一笔申诉 = 一张赔付单，一行
   - 钱怎么走：核定后生成业务调整单（类型「退货申诉赔付」，平台补款、账扣），按生效日期进结算单，随货款一起打给商家
   - 开票：性质是 Foodmax 买下这部分货 → 商家开票给 Foodmax
     · 支持【合并赔付单上传发票】：勾选多张「待开票」赔付单 → 开 1 张发票覆盖它们；只选 1 张即单张开票
     · 可跨结算单合并；一张赔付单只能挂 1 张发票
     · 发票金额（含税）必须 = 所选赔付单赔付合计；发票号码 / 开票日期 / 文件必填；号码不能与已上传发票重复
   - 票款关系：未上传发票不影响结算单打款，只标「待开票」并在菜单角标提醒（角标 = 待开票赔付单数）
   - 归属结算单：以结算单 adjust[] 里是否含该业务调整单号为准；还没进任何结算单 → 「待进结算单」
   - 运营平台：同两 Tab，多「商家名称 / 商家编码」列与商家筛选，只能查看，不能上传 / 更换发票 */
(function(){

const bills=()=>[...(DB.bill&&DB.bill.status!='none'?[DB.bill]:[]),...(DB.billsHistory||[])];
const billOf=adjNo=>bills().find(b=>(b.adjust||[]).some(a=>a.no==adjNo))||null;
const MER=()=>({name:DB.merchant.name,code:DB.merchant.code});   // 原型只有一个三方商家

/* 已上传的赔付发票：一张发票覆盖 1~N 张赔付单（adjNos） */
DB.retCompInvs = DB.retCompInvs || [
  {id:'RI-1',invNo:'GXY-INV-2606-018',invDate:'2026-06-02',amt:9.00,uploadAt:'2026-06-02 15:40',file:'GXY-INV-2606-018.pdf',adjNos:['TZ-20260521-208']}
];
DB.rcpSel = DB.rcpSel || [];
const invOf=adjNo=>DB.retCompInvs.find(v=>v.adjNos.includes(adjNo))||null;
const invSt=adjNo=>invOf(adjNo)?'已上传':'待开票';

/* 全部赔付单（一笔申诉一行） */
window.retCompRows=function(){
  const out=[];
  (DB.afterSales||[]).forEach((a,i)=>{const ra=a.retAppeal;if(!ra||!(ra.comp>0))return;
    out.push({adjNo:ra.adjNo,src:'客户退货',retNo:'TH-'+a.id.slice(-6),ra,priceLabel:'售后单价',open:`closeDrawer();act_afterDetail(${i})`});});
  Object.keys(DB.whrAppeals||{}).forEach(no=>{const ra=DB.whrAppeals[no];if(!ra||!(ra.comp>0))return;
    out.push({adjNo:ra.adjNo,src:'仓库退回',retNo:no,ra,priceLabel:'供货单价',open:`closeDrawer();DB.retSrcTab='wh';nav('m-after-return');setTimeout(()=>whr_detail('${no}'),50)`});});
  out.forEach(r=>{r.bill=billOf(r.adjNo);r.mer=MER();});
  return out.sort((x,y)=>(y.ra.reviewAt||'').localeCompare(x.ra.reviewAt||''));
};
const rowOf=adjNo=>retCompRows().find(r=>r.adjNo==adjNo);
// 结算状态：待进结算单 / 已进结算单（当期未打款）/ 已打款
function settleSt(r){
  if(!r.bill)return '待进结算单';
  if(r.bill===DB.bill&&DB.payment!='paid')return '已进结算单';
  return '已打款';
}
const SETTLE_TONE={'待进结算单':'t-gr','已进结算单':'t-b','已打款':'t-g'};
const INV_TONE={'待开票':'t-y','已上传':'t-g'};
const stTag=(t,tone)=>`<span class="tag ${tone[t]||'t-gr'}"><span class="dot"></span>${t}</span>`;
const sum2=a=>+a.reduce((s,v)=>s+v,0).toFixed(2);

window.retCompTodo=()=>retCompRows().filter(r=>invSt(r.adjNo)=='待开票').length;
// 结算单详情用：本单含几笔赔付、合计多少、其中几笔待开票
window.retCompBillSum=billNo=>{const rs=retCompRows().filter(r=>r.bill&&r.bill.no==billNo);if(!rs.length)return null;
  const todo=rs.filter(r=>invSt(r.adjNo)=='待开票').length;return {n:rs.length,sum:sum2(rs.map(r=>r.ra.comp)),todo,st:todo?'待开票':'已上传'};};

function page(ops){
  const tab=DB.rcpTab||'list',todo=retCompTodo();
  const tabs=`<div class="tabs">
    <div class="tab ${tab=='list'?'active':''}" onclick="DB.rcpTab='list';render()">赔付单${todo?`<span class="tb">${todo}</span>`:''}</div>
    <div class="tab ${tab=='inv'?'active':''}" onclick="DB.rcpTab='inv';render()">${ops?'商家发票':'已上传发票'}</div>
  </div>`;
  return tabs+(tab=='inv'?invContent(ops):listContent(ops));
}
PAGES['m-ret-comp']=()=>page(false);
PAGES['p-ret-comp']=()=>page(true);

/* ---------- 赔付单 ---------- */
function filtered(){
  const f=DB.rcpF||{};
  return retCompRows().filter(r=>(!f.src||r.src==f.src)&&(!f.st||settleSt(r)==f.st)&&(!f.inv||invSt(r.adjNo)==f.inv)
    &&(!f.mer||[r.mer.name,r.mer.code].some(x=>x.toLowerCase().includes(f.mer.toLowerCase())))
    &&(!f.no||[r.retNo,r.adjNo,r.bill&&r.bill.no].some(x=>x&&x.toLowerCase().includes(f.no.toLowerCase())))
    &&(!f.d1||(r.ra.reviewAt||'').slice(0,10)>=f.d1)&&(!f.d2||(r.ra.reviewAt||'').slice(0,10)<=f.d2));
}
function listContent(ops){
  const f=DB.rcpF||{},rows=filtered(),todo=rows.filter(r=>invSt(r.adjNo)=='待开票');
  DB.rcpSel=DB.rcpSel.filter(no=>retCompRows().some(r=>r.adjNo==no&&invSt(no)=='待开票'));
  const sel=DB.rcpSel,allSel=todo.length&&todo.every(r=>sel.includes(r.adjNo));
  const selSum=sum2(retCompRows().filter(r=>sel.includes(r.adjNo)).map(r=>r.ra.comp));
  const EN=`onkeydown="if(event.key=='Enter')rcpQuery()"`;
  const opt=(id,label,arr,v)=>`<div><div style="font-size:12px;color:var(--ts);margin-bottom:5px">${label}</div><select id="${id}" style="min-width:120px"><option value="">全部</option>${arr.map(s=>`<option ${v==s?'selected':''}>${s}</option>`).join('')}</select></div>`;
  const head=ops?`<div class="card-hd"><h3>赔付单</h3><span class="sub">全部商家 · 只读；发票由商家在商家端上传</span></div>`
    :`<div class="card-hd"><h3>赔付单</h3><span class="sub">一笔申诉一张赔付单，随结算单打款；可勾选多张合并开 1 张发票</span>
    <button class="btn btn-p btn-sm" ${sel.length?'':'disabled'} title="${sel.length?'':'勾选待开票的赔付单后可合并上传发票'}" onclick="rcpUpload()">合并上传发票${sel.length?`（${sel.length}）`:''}</button></div>
  <div class="selbar" style="display:flex;align-items:center;gap:12px;padding:10px 16px;background:#F0FBF4;border-bottom:1px solid var(--bd);font-size:13px">${sel.length?`<span>已选 <b>${sel.length}</b> 张 · 赔付合计 <b style="color:var(--gd)">${money(selSum)}</b>（即发票金额）</span><button class="btn btn-link" style="margin-left:auto" onclick="DB.rcpSel=[];render()">取消选择</button>`:'<span style="color:var(--ts)">勾选待开票的赔付单后，可合并开 1 张发票上传</span>'}</div>`;
  return `<div class="card" style="margin-bottom:14px"><div class="card-bd" style="display:flex;gap:16px;align-items:flex-end;flex-wrap:wrap;padding:14px 16px">
    ${ops?`<div><div style="font-size:12px;color:var(--ts);margin-bottom:5px">商家</div><input id="rcp-mer" value="${f.mer||''}" placeholder="商家名称 / 编码" style="min-width:160px" ${EN}></div>`:''}
    <div><div style="font-size:12px;color:var(--ts);margin-bottom:5px">单号</div><input id="rcp-no" value="${f.no||''}" placeholder="退货单号 / 调整单号 / 结算单号" style="min-width:220px" ${EN}></div>
    ${opt('rcp-src','来源',['客户退货','仓库退回'],f.src)}
    ${opt('rcp-st','结算状态',['待进结算单','已进结算单','已打款'],f.st)}
    ${opt('rcp-inv','开票状态',['待开票','已上传'],f.inv)}
    <div><div style="font-size:12px;color:var(--ts);margin-bottom:5px">核定时间</div><div class="row" style="gap:6px;align-items:center"><input id="rcp-d1" type="date" value="${f.d1||''}" style="width:150px"><span style="color:var(--ts)">至</span><input id="rcp-d2" type="date" value="${f.d2||''}" style="width:150px"></div></div>
    <button class="btn btn-p btn-sm" onclick="rcpQuery()">查询</button><button class="btn btn-o btn-sm" onclick="DB.rcpF={};render()">重置</button>
  </div></div>
  <div class="card">${head}
  <div class="card-bd ${rows.length?'flush':''}">${rows.length?`<div style="overflow-x:auto"><table>
    <thead><tr>${ops?'<th>商家名称</th><th>商家编码</th>':`<th style="width:34px"><input type="checkbox" ${allSel?'checked':''} ${todo.length?'':'disabled'} onclick="rcpSelAll()"></th>`}<th>业务调整单号</th><th>来源</th><th>关联单号</th><th>申诉类型</th><th>核定结论</th><th>赔付商品</th><th style="text-align:right">核定数量</th><th style="text-align:right">赔付金额</th><th>核定时间</th><th>结算单号</th><th>结算状态</th><th>开票状态</th><th>发票号码</th><th>操作</th></tr></thead><tbody>
    ${rows.map(r=>{const ok=r.ra.items.filter(x=>x.ok>0),st=invSt(r.adjNo),inv=invOf(r.adjNo);return `<tr>
      ${ops?`<td style="white-space:nowrap">${r.mer.name}</td><td class="mono" style="white-space:nowrap">${r.mer.code}</td>`:`<td><input type="checkbox" ${st=='待开票'?'':'disabled title="已上传发票"'} ${sel.includes(r.adjNo)?'checked':''} onclick="rcpToggle('${r.adjNo}')"></td>`}
      <td class="mono" style="white-space:nowrap">${r.adjNo||'—'}</td>
      <td style="white-space:nowrap">${r.src}</td>
      <td class="mono" style="white-space:nowrap">${r.retNo}</td>
      <td style="white-space:nowrap">${raKindLabel(r.ra)}</td>
      <td style="white-space:nowrap">${r.ra.status}</td>
      <td>${ok.map(x=>x.name).join('、')}</td>
      <td style="text-align:right">${sum2(ok.map(x=>x.ok))}</td>
      <td style="text-align:right;color:var(--g);font-weight:600">${money(r.ra.comp)}</td>
      <td style="white-space:nowrap;font-size:12px;color:var(--ts)">${r.ra.reviewAt||'—'}</td>
      <td class="mono" style="white-space:nowrap">${r.bill?r.bill.no:'—'}</td>
      <td style="white-space:nowrap">${stTag(settleSt(r),SETTLE_TONE)}</td>
      <td style="white-space:nowrap">${stTag(st,INV_TONE)}</td>
      <td class="mono" style="white-space:nowrap">${inv?inv.invNo:'—'}</td>
      <td style="white-space:nowrap"><button class="btn btn-o btn-sm" onclick="rcpDetail('${r.adjNo}',${ops})">详情</button>${!ops&&st=='待开票'?` <button class="btn btn-o btn-sm" onclick="DB.rcpSel=['${r.adjNo}'];rcpUpload()">上传发票</button>`:''}</td></tr>`;}).join('')}
    </tbody></table></div>`:`<div class="empty"><div class="e-ic">💸</div><div class="e-t">暂无退货赔付</div><div class="e-s">退货单申诉经平台核定成立后，赔付单会显示在这里</div></div>`}</div></div>`;
}
window.rcpQuery=function(){const v=id=>{const e=document.getElementById(id);return e?(e.value||'').trim():'';};DB.rcpF={mer:v('rcp-mer'),no:v('rcp-no'),src:v('rcp-src'),st:v('rcp-st'),inv:v('rcp-inv'),d1:v('rcp-d1'),d2:v('rcp-d2')};render();};
window.rcpToggle=function(no){const k=DB.rcpSel.indexOf(no);if(k<0)DB.rcpSel.push(no);else DB.rcpSel.splice(k,1);render();};
window.rcpSelAll=function(){const todo=filtered().filter(r=>invSt(r.adjNo)=='待开票').map(r=>r.adjNo);DB.rcpSel=todo.every(n=>DB.rcpSel.includes(n))?[]:todo;render();};

window.rcpDetail=function(adjNo,ops){
  const r=rowOf(adjNo);if(!r)return;const ra=r.ra,inv=invOf(adjNo);
  const kv=(a,b)=>`<div><div class="k">${a}</div><div class="v">${b||'—'}</div></div>`;
  const sec=t=>`<div style="font-weight:600;font-size:13px;margin:16px 2px 8px">${t}</div>`;
  drawer(`<div class="drawer-hd"><div><h3>赔付单 · ${r.adjNo||'—'}</h3><div style="font-size:12.5px;color:var(--ts);margin-top:2px">${ops?r.mer.name+' · ':''}${r.src} · ${r.retNo}</div></div><span class="x" onclick="closeDrawer()">×</span></div>
  <div class="drawer-bd">
    ${sec('基础信息')}
    <div class="kv">${ops?kv('商家名称',r.mer.name)+kv('商家编码',`<span class="mono">${r.mer.code}</span>`):''}${kv('业务调整单号',`<span class="mono">${r.adjNo||'—'}</span>`)}${kv('来源',r.src)}${kv('关联单号',`<span class="mono">${r.retNo}</span>`)}${kv('申诉类型',raKindLabel(ra))}${kv('申诉时间',ra.at)}${kv('核定时间',ra.reviewAt)}${kv('核定结论',ra.status)}${kv('核定说明',ra.note)}</div>
    ${sec('赔付明细')}
    <table><thead><tr><th>商品</th><th style="text-align:right">申诉数量</th><th style="text-align:right">核定数量</th><th style="text-align:right">${r.priceLabel}</th><th style="text-align:right">赔付金额</th></tr></thead><tbody>
      ${ra.items.map(x=>`<tr><td>${x.name}</td><td style="text-align:right">${x.qty}</td><td style="text-align:right">${x.ok==null?'—':x.ok}</td><td style="text-align:right">${x.price==null?'—':money(x.price)}</td><td style="text-align:right">${x.ok&&x.price!=null?money(Math.round(x.ok*x.price*100)/100):money(0)}</td></tr>`).join('')}
      <tr style="font-weight:700;background:var(--gl)"><td colspan="4">赔付合计</td><td style="text-align:right;color:var(--gd)">${money(ra.comp)}</td></tr>
    </tbody></table>
    ${sec('结算与开票')}
    <div class="kv">${kv('结算单号',r.bill?`<span class="mono">${r.bill.no}</span>`:'')}${kv('结算区间',r.bill?r.bill.range:'')}${kv('结算状态',stTag(settleSt(r),SETTLE_TONE))}${kv('开票状态',stTag(invSt(adjNo),INV_TONE))}${kv('发票号码',inv?`<span class="mono">${inv.invNo}</span>`:'')}${kv('开票日期',inv?inv.invDate:'')}${kv('发票金额（含税）',inv?money(inv.amt):'')}${kv('同票赔付单',inv?`${inv.adjNos.length} 张`:'')}</div>
  </div>
  <div class="drawer-ft">${ops?'':`<button class="btn btn-o" onclick="${r.open}">查看${r.src=='仓库退回'?'退回记录':'退货单'}</button>`}${inv?`<button class="btn btn-o" onclick="rcpInvDetail('${inv.id}',${!!ops})">查看发票</button>`:''}${!ops&&!inv?`<button class="btn btn-o" onclick="closeDrawer();DB.rcpSel=['${adjNo}'];rcpUpload()">上传发票</button>`:''}<button class="btn btn-p" onclick="closeDrawer()">关闭</button></div>`);
};

/* ---------- 已上传发票（一张发票一行） ---------- */
function invContent(ops){
  const vs=DB.retCompInvs.slice().sort((a,b)=>b.uploadAt.localeCompare(a.uploadAt));
  return `<div class="card"><div class="card-hd"><h3>${ops?'商家发票':'已上传发票'}</h3><span class="sub">${ops?'商家开给 Foodmax 的退货赔付发票 · 只读':'一张发票可覆盖多张赔付单'}</span></div>
  <div class="card-bd ${vs.length?'flush':''}">${vs.length?`<div style="overflow-x:auto"><table>
    <thead><tr>${ops?'<th>商家名称</th><th>商家编码</th>':''}<th>发票号码</th><th>开票日期</th><th style="text-align:right">发票金额（含税）</th><th style="text-align:right">赔付单数</th><th>涉及结算单</th><th>上传时间</th><th>操作</th></tr></thead><tbody>
    ${vs.map(v=>{const bs=[...new Set(v.adjNos.map(n=>{const r=rowOf(n);return r&&r.bill?r.bill.no:'待进结算单';}))],m=MER();return `<tr>
      ${ops?`<td style="white-space:nowrap">${m.name}</td><td class="mono" style="white-space:nowrap">${m.code}</td>`:''}
      <td class="mono" style="white-space:nowrap">${v.invNo}</td>
      <td style="white-space:nowrap">${v.invDate}</td>
      <td style="text-align:right;font-weight:600">${money(v.amt)}</td>
      <td style="text-align:right">${v.adjNos.length}</td>
      <td class="mono">${bs.join('、')}</td>
      <td style="white-space:nowrap;font-size:12px;color:var(--ts)">${v.uploadAt}</td>
      <td style="white-space:nowrap"><button class="btn btn-o btn-sm" onclick="rcpInvDetail('${v.id}',${ops})">详情</button>${ops?'':` <button class="btn btn-o btn-sm" onclick="rcpUpload('${v.id}')">更换发票</button>`}</td></tr>`;}).join('')}
    </tbody></table></div>`:`<div class="empty"><div class="e-ic">🧾</div><div class="e-t">暂无已上传发票</div><div class="e-s">${ops?'商家上传后显示在这里':'在「赔付单」里勾选待开票的赔付单，合并上传发票'}</div></div>`}</div></div>`;
}
window.rcpInvDetail=function(id,ops){
  const v=DB.retCompInvs.find(x=>x.id==id);if(!v)return;
  const kv=(a,b)=>`<div><div class="k">${a}</div><div class="v">${b||'—'}</div></div>`;
  drawer(`<div class="drawer-hd"><div><h3>赔付发票 · ${v.invNo}</h3><div style="font-size:12.5px;color:var(--ts);margin-top:2px">${ops?MER().name+' · ':''}${v.adjNos.length} 张赔付单</div></div><span class="x" onclick="closeDrawer()">×</span></div>
  <div class="drawer-bd">
    <div class="kv" style="margin:8px 0 16px">${kv('发票号码',`<span class="mono">${v.invNo}</span>`)}${kv('开票日期',v.invDate)}${kv('发票金额（含税）',money(v.amt))}${kv('上传时间',v.uploadAt)}${kv('发票文件',`<button class="btn btn-link btn-sm" style="padding:0" onclick="toast('（原型）预览 ${v.file}','info')">${v.file}</button>`)}</div>
    <div style="font-weight:600;font-size:13px;margin:4px 2px 8px">覆盖的赔付单</div>
    <table><thead><tr><th>业务调整单号</th><th>关联单号</th><th>结算单号</th><th style="text-align:right">赔付金额</th></tr></thead><tbody>
      ${v.adjNos.map(n=>{const r=rowOf(n);return `<tr><td class="mono">${n}</td><td class="mono">${r?r.retNo:'—'}</td><td class="mono">${r&&r.bill?r.bill.no:'—'}</td><td style="text-align:right">${r?money(r.ra.comp):'—'}</td></tr>`;}).join('')}
      <tr style="font-weight:700;background:var(--gl)"><td colspan="3">合计</td><td style="text-align:right">${money(v.amt)}</td></tr>
    </tbody></table>
  </div>
  <div class="drawer-ft">${ops?'':`<button class="btn btn-o" onclick="closeDrawer();rcpUpload('${v.id}')">更换发票</button>`}<button class="btn btn-p" onclick="closeDrawer()">关闭</button></div>`);
};

/* ---------- 上传：新开（所选赔付单 DB.rcpSel）或更换（传 invId，覆盖范围不变） ---------- */
window.rcpUpload=function(invId){
  const old=invId?DB.retCompInvs.find(x=>x.id==invId):null;
  const adjNos=old?old.adjNos.slice():DB.rcpSel.filter(n=>invSt(n)=='待开票');
  if(!adjNos.length)return toast('请先勾选待开票的赔付单','err');
  const rs=adjNos.map(rowOf).filter(Boolean),sum=sum2(rs.map(r=>r.ra.comp)),today=new Date().toISOString().slice(0,10);
  DB._rcu={invId:invId||'',adjNos,sum,file:old?old.file:''};
  const html=new String(`<div class="mc-hd"><h3>${old?'更换赔付发票':(rs.length>1?'合并上传赔付发票':'上传赔付发票')}</h3><p>${rs.length} 张赔付单 · 开 1 张发票给 Foodmax</p><button class="mc-x" onclick="closeModal()">×</button></div>
  <div class="mc-bd">
    <div class="ib ib-b"><span class="i">🧾</span><div>就下列赔付单开 <b>1 张发票给 Foodmax</b>，发票金额（含税）须等于赔付合计 <b>${money(sum)}</b>。已注册 GST 的请在票面列明 GST。买方抬头与 UEN 以平台财务通知为准。</div></div>
    <div style="overflow-x:auto;margin:10px 0 14px"><table><thead><tr><th>业务调整单号</th><th>来源</th><th>关联单号</th><th>结算单号</th><th style="text-align:right">赔付金额</th></tr></thead><tbody>
      ${rs.map(r=>`<tr><td class="mono">${r.adjNo}</td><td>${r.src}</td><td class="mono">${r.retNo}</td><td class="mono">${r.bill?r.bill.no:'待进结算单'}</td><td style="text-align:right">${money(r.ra.comp)}</td></tr>`).join('')}
      <tr style="font-weight:700;background:var(--gl)"><td colspan="4">发票金额（含税）应为</td><td style="text-align:right">${money(sum)}</td></tr>
    </tbody></table></div>
    <div class="fg2">
      <div class="fr"><label class="fl"><b>*</b>发票号码</label><input id="rcp-inv-no" maxlength="40" value="${old?old.invNo:''}" placeholder="票面上的发票号码"></div>
      <div class="fr"><label class="fl"><b>*</b>开票日期</label><input id="rcp-inv-d" type="date" max="${today}" value="${old?old.invDate:today}"></div>
    </div>
    <div class="fr"><label class="fl"><b>*</b>发票金额（含税）</label><input id="rcp-inv-amt" type="number" min="0" step="0.01" value="${old?old.amt:sum}" style="width:180px;text-align:right"></div>
    <div class="fr"><label class="fl"><b>*</b>发票文件</label><div class="up ${DB._rcu.file?'done':''}" id="rcp-up" onclick="DB._rcu.file='INV-${(adjNos[0]||'').replace(/^TZ-/,'')}.pdf';this.classList.add('done');this.querySelector('.uic').textContent='✓';this.querySelector('.ut').textContent=DB._rcu.file"><div class="uic">${DB._rcu.file?'✓':'📄'}</div><div class="ut">${DB._rcu.file||'点击上传发票'}</div><div class="us">PDF / JPG / PNG，单个不超过 10MB</div></div></div>
  </div>
  <div class="mc-ft"><button class="btn btn-o" onclick="closeModal()">取消</button><button class="btn btn-p" onclick="rcpUploadSubmit()">提交</button></div>`);
  html._wide=true;modal(html);
};
window.rcpUploadSubmit=function(){
  const u=DB._rcu;if(!u)return;
  const no=(document.getElementById('rcp-inv-no').value||'').trim(),d=document.getElementById('rcp-inv-d').value,amt=Math.round((+document.getElementById('rcp-inv-amt').value||0)*100)/100;
  if(!no)return toast('请填写发票号码','err');
  if(!d)return toast('请选择开票日期','err');
  if(d>new Date().toISOString().slice(0,10))return toast('开票日期不能晚于今天','err');
  if(amt!==u.sum)return toast(`发票金额需等于所选赔付单合计 ${money(u.sum)}`,'err');
  if(!u.file)return toast('请上传发票文件','err');
  if(DB.retCompInvs.some(v=>v.id!=u.invId&&v.invNo==no))return toast('该发票号码已上传过','err');
  if(!u.invId&&u.adjNos.some(n=>invOf(n)))return toast('所选赔付单中有已上传发票的，请刷新后重选','err');   // 并发兜底
  if(u.invId)Object.assign(DB.retCompInvs.find(v=>v.id==u.invId),{invNo:no,invDate:d,amt,file:u.file,uploadAt:ts()});
  else DB.retCompInvs.push({id:'RI-'+Date.now(),invNo:no,invDate:d,amt,file:u.file,uploadAt:ts(),adjNos:u.adjNos});
  DB.rcpSel=[];closeModal();render();toast(u.invId?'发票已更换':`已上传，覆盖 ${u.adjNos.length} 张赔付单`,'ok');
};

})();
