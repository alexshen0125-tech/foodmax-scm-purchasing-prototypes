/* Food Max 商家系统 · 财务 › 退货赔付（2026-10-27 沈亮定）
   - 数据来源：退货申诉（客户退货 DB.afterSales[].retAppeal / 仓库退回 DB.whrAppeals）核定「成立 / 部分成立」且赔付 > 0 的记录，一笔申诉一行
   - 钱怎么走：核定后生成业务调整单（类型「退货申诉赔付」，平台补款、账扣），按生效日期进结算单，随货款一起打给商家
   - 开票：性质是 Foodmax 买下这部分货 → 商家开票给 Foodmax；每张结算单就本期赔付合计开 1 张汇总票，在本页上传
   - 票款关系：未上传发票不影响结算单打款，只标「待开票」并在菜单角标提醒
   - 归属结算单：以结算单 adjust[] 里是否含该业务调整单号为准；还没进任何结算单 → 「待进结算单」
   - 发票金额（含税）必须等于该结算单的赔付合计；发票文件必传 */
(function(){

const bills=()=>[...(DB.bill&&DB.bill.status!='none'?[DB.bill]:[]),...(DB.billsHistory||[])];
const billOf=adjNo=>bills().find(b=>(b.adjust||[]).some(a=>a.no==adjNo))||null;

/* 每张结算单的赔付发票：{billNo:{invNo,invDate,amt,uploadAt,file}}，无记录 = 待开票 */
DB.retCompInv = DB.retCompInv || {
  'ST202605-M0815':{invNo:'GXY-INV-2606-018',invDate:'2026-06-02',amt:9.00,uploadAt:'2026-06-02 15:40',file:'GXY-INV-2606-018.pdf'}
};

/* 全部赔付记录（一笔申诉一行） */
window.retCompRows=function(){
  const out=[];
  (DB.afterSales||[]).forEach((a,i)=>{const ra=a.retAppeal;if(!ra||!(ra.comp>0))return;
    out.push({adjNo:ra.adjNo,src:'客户退货',retNo:'TH-'+a.id.slice(-6),ra,priceLabel:'售后单价',open:`closeDrawer();act_afterDetail(${i})`});});
  Object.keys(DB.whrAppeals||{}).forEach(no=>{const ra=DB.whrAppeals[no];if(!ra||!(ra.comp>0))return;
    out.push({adjNo:ra.adjNo,src:'仓库退回',retNo:no,ra,priceLabel:'供货单价',open:`closeDrawer();DB.retSrcTab='wh';nav('m-after-return');setTimeout(()=>whr_detail('${no}'),50)`});});
  out.forEach(r=>{r.bill=billOf(r.adjNo);});
  return out.sort((x,y)=>(y.ra.reviewAt||'').localeCompare(x.ra.reviewAt||''));
};
// 结算状态：待进结算单 / 已进结算单（当期未打款）/ 已打款
function settleSt(r){
  if(!r.bill)return '待进结算单';
  if(r.bill===DB.bill&&DB.payment!='paid')return '已进结算单';
  return '已打款';
}
const SETTLE_TONE={'待进结算单':'t-gr','已进结算单':'t-b','已打款':'t-g'};
function invSt(billNo){return billNo&&DB.retCompInv[billNo]?'已上传':'待开票';}
const INV_TONE={'待开票':'t-y','已上传':'t-g'};
const stTag=(t,tone)=>`<span class="tag ${tone[t]||'t-gr'}"><span class="dot"></span>${t}</span>`;

/* 按结算单汇总（只列含赔付的结算单） */
function compBills(){
  const rows=retCompRows(),map={};
  rows.forEach(r=>{if(!r.bill)return;const k=r.bill.no;(map[k]=map[k]||{bill:r.bill,list:[]}).list.push(r);});
  return bills().filter(b=>map[b.no]).map(b=>({bill:b,list:map[b.no].list,sum:+map[b.no].list.reduce((s,r)=>s+r.ra.comp,0).toFixed(2)}));
}
window.retCompTodo=()=>compBills().filter(g=>invSt(g.bill.no)=='待开票').length;
window.retCompBillSum=billNo=>{const g=compBills().find(x=>x.bill.no==billNo);return g?{n:g.list.length,sum:g.sum,st:invSt(billNo)}:null;};

PAGES['m-ret-comp']=()=>{
  const tab=DB.rcpTab||'list',todo=retCompTodo();
  const tabs=`<div class="tabs">
    <div class="tab ${tab=='list'?'active':''}" onclick="DB.rcpTab='list';render()">赔付明细</div>
    <div class="tab ${tab=='inv'?'active':''}" onclick="DB.rcpTab='inv';render()">赔付发票${todo?`<span class="tb">${todo}</span>`:''}</div>
  </div>`;
  return tabs+(tab=='inv'?invContent():listContent());
};

/* ---------- 赔付明细 ---------- */
function listContent(){
  const f=DB.rcpF||{};
  const rows=retCompRows().filter(r=>(!f.src||r.src==f.src)&&(!f.st||settleSt(r)==f.st)&&(!f.no||r.retNo.toLowerCase().includes(f.no.toLowerCase())||(r.adjNo||'').toLowerCase().includes(f.no.toLowerCase()))
    &&(!f.d1||(r.ra.reviewAt||'').slice(0,10)>=f.d1)&&(!f.d2||(r.ra.reviewAt||'').slice(0,10)<=f.d2));
  const EN=`onkeydown="if(event.key=='Enter')rcpQuery()"`;
  return `<div class="card" style="margin-bottom:14px"><div class="card-bd" style="display:flex;gap:16px;align-items:flex-end;flex-wrap:wrap;padding:14px 16px">
    <div><div style="font-size:12px;color:var(--ts);margin-bottom:5px">单号</div><input id="rcp-no" value="${f.no||''}" placeholder="退货单号 / 退回单号 / 调整单号" style="min-width:220px" ${EN}></div>
    <div><div style="font-size:12px;color:var(--ts);margin-bottom:5px">来源</div><select id="rcp-src" style="min-width:130px"><option value="">全部</option>${['客户退货','仓库退回'].map(s=>`<option ${f.src==s?'selected':''}>${s}</option>`).join('')}</select></div>
    <div><div style="font-size:12px;color:var(--ts);margin-bottom:5px">结算状态</div><select id="rcp-st" style="min-width:130px"><option value="">全部</option>${['待进结算单','已进结算单','已打款'].map(s=>`<option ${f.st==s?'selected':''}>${s}</option>`).join('')}</select></div>
    <div><div style="font-size:12px;color:var(--ts);margin-bottom:5px">核定时间</div><div class="row" style="gap:6px;align-items:center"><input id="rcp-d1" type="date" value="${f.d1||''}" style="width:150px"><span style="color:var(--ts)">至</span><input id="rcp-d2" type="date" value="${f.d2||''}" style="width:150px"></div></div>
    <button class="btn btn-p btn-sm" onclick="rcpQuery()">查询</button><button class="btn btn-o btn-sm" onclick="DB.rcpF={};render()">重置</button>
  </div></div>
  <div class="card"><div class="card-hd"><h3>赔付明细</h3><span class="sub">退货申诉核定成立后的赔付，一笔申诉一行；随结算单打款</span></div>
  <div class="card-bd ${rows.length?'flush':''}">${rows.length?`<div style="overflow-x:auto"><table>
    <thead><tr><th>业务调整单号</th><th>来源</th><th>关联单号</th><th>申诉类型</th><th>核定结论</th><th>赔付商品</th><th style="text-align:right">核定数量</th><th style="text-align:right">赔付金额</th><th>核定时间</th><th>结算单号</th><th>结算状态</th><th>开票状态</th><th>操作</th></tr></thead><tbody>
    ${rows.map((r,k)=>{const ok=r.ra.items.filter(x=>x.ok>0),st=settleSt(r);return `<tr>
      <td class="mono" style="white-space:nowrap">${r.adjNo||'—'}</td>
      <td style="white-space:nowrap">${r.src}</td>
      <td class="mono" style="white-space:nowrap">${r.retNo}</td>
      <td style="white-space:nowrap">${raKindLabel(r.ra)}</td>
      <td style="white-space:nowrap">${r.ra.status}</td>
      <td>${ok.map(x=>x.name).join('、')}</td>
      <td style="text-align:right">${+ok.reduce((s,x)=>s+x.ok,0).toFixed(2)}</td>
      <td style="text-align:right;color:var(--g);font-weight:600">${money(r.ra.comp)}</td>
      <td style="white-space:nowrap;font-size:12px;color:var(--ts)">${r.ra.reviewAt||'—'}</td>
      <td class="mono" style="white-space:nowrap">${r.bill?r.bill.no:'—'}</td>
      <td style="white-space:nowrap">${stTag(st,SETTLE_TONE)}</td>
      <td style="white-space:nowrap">${r.bill?stTag(invSt(r.bill.no),INV_TONE):'<span style="color:var(--tt)">—</span>'}</td>
      <td><button class="btn btn-o btn-sm" onclick="rcpDetail(${k})">详情</button></td></tr>`;}).join('')}
    </tbody></table></div>`:`<div class="empty"><div class="e-ic">💸</div><div class="e-t">暂无退货赔付</div><div class="e-s">退货单申诉经平台核定成立后，赔付会显示在这里</div></div>`}</div></div>`;
}
window.rcpQuery=function(){const v=id=>(document.getElementById(id).value||'').trim();DB.rcpF={no:v('rcp-no'),src:v('rcp-src'),st:v('rcp-st'),d1:v('rcp-d1'),d2:v('rcp-d2')};render();};

window.rcpDetail=function(k){
  const f=DB.rcpF||{};
  const rows=retCompRows().filter(r=>(!f.src||r.src==f.src)&&(!f.st||settleSt(r)==f.st)&&(!f.no||r.retNo.toLowerCase().includes(f.no.toLowerCase())||(r.adjNo||'').toLowerCase().includes(f.no.toLowerCase()))
    &&(!f.d1||(r.ra.reviewAt||'').slice(0,10)>=f.d1)&&(!f.d2||(r.ra.reviewAt||'').slice(0,10)<=f.d2));
  const r=rows[k];if(!r)return;const ra=r.ra,inv=r.bill?DB.retCompInv[r.bill.no]:null;
  const kv=(a,b)=>`<div><div class="k">${a}</div><div class="v">${b||'—'}</div></div>`;
  const sec=t=>`<div style="font-weight:600;font-size:13px;margin:16px 2px 8px">${t}</div>`;
  drawer(`<div class="drawer-hd"><div><h3>退货赔付 · ${r.adjNo||'—'}</h3><div style="font-size:12.5px;color:var(--ts);margin-top:2px">${r.src} · ${r.retNo}</div></div><span class="x" onclick="closeDrawer()">×</span></div>
  <div class="drawer-bd">
    ${sec('基础信息')}
    <div class="kv">${kv('业务调整单号',`<span class="mono">${r.adjNo||'—'}</span>`)}${kv('来源',r.src)}${kv('关联单号',`<span class="mono">${r.retNo}</span>`)}${kv('申诉类型',raKindLabel(ra))}${kv('申诉时间',ra.at)}${kv('核定时间',ra.reviewAt)}${kv('核定结论',ra.status)}${kv('核定说明',ra.note)}</div>
    ${sec('赔付明细')}
    <table><thead><tr><th>商品</th><th style="text-align:right">申诉数量</th><th style="text-align:right">核定数量</th><th style="text-align:right">${r.priceLabel}</th><th style="text-align:right">赔付金额</th></tr></thead><tbody>
      ${ra.items.map(x=>`<tr><td>${x.name}</td><td style="text-align:right">${x.qty}</td><td style="text-align:right">${x.ok==null?'—':x.ok}</td><td style="text-align:right">${x.price==null?'—':money(x.price)}</td><td style="text-align:right">${x.ok&&x.price!=null?money(Math.round(x.ok*x.price*100)/100):money(0)}</td></tr>`).join('')}
      <tr style="font-weight:700;background:var(--gl)"><td colspan="4">赔付合计</td><td style="text-align:right;color:var(--gd)">${money(ra.comp)}</td></tr>
    </tbody></table>
    ${sec('结算与开票')}
    <div class="kv">${kv('结算单号',r.bill?`<span class="mono">${r.bill.no}</span>`:'')}${kv('结算区间',r.bill?r.bill.range:'')}${kv('结算状态',stTag(settleSt(r),SETTLE_TONE))}${kv('开票状态',r.bill?stTag(invSt(r.bill.no),INV_TONE):'进结算单后开票')}${kv('发票号码',inv?`<span class="mono">${inv.invNo}</span>`:'')}${kv('开票日期',inv?inv.invDate:'')}</div>
  </div>
  <div class="drawer-ft"><button class="btn btn-o" onclick="${r.open}">查看${r.src=='仓库退回'?'退回记录':'退货单'}</button>${r.bill&&invSt(r.bill.no)=='待开票'?`<button class="btn btn-o" onclick="closeDrawer();rcpUpload('${r.bill.no}')">上传发票</button>`:''}<button class="btn btn-p" onclick="closeDrawer()">关闭</button></div>`);
};

/* ---------- 赔付发票（按结算单） ---------- */
function invContent(){
  const gs=compBills();
  return `<div class="card"><div class="card-hd"><h3>赔付发票</h3><span class="sub">每张结算单就本期赔付合计开 1 张发票给 Foodmax；未上传不影响打款</span></div>
  <div class="card-bd ${gs.length?'flush':''}">${gs.length?`<div style="overflow-x:auto"><table>
    <thead><tr><th>结算单号</th><th>结算区间</th><th style="text-align:right">赔付笔数</th><th style="text-align:right">应开票金额（含税）</th><th>开票状态</th><th>发票号码</th><th>开票日期</th><th>上传时间</th><th>操作</th></tr></thead><tbody>
    ${gs.map(g=>{const inv=DB.retCompInv[g.bill.no],st=invSt(g.bill.no);return `<tr>
      <td class="mono" style="white-space:nowrap">${g.bill.no}</td>
      <td style="white-space:nowrap">${g.bill.range}</td>
      <td style="text-align:right">${g.list.length}</td>
      <td style="text-align:right;font-weight:600">${money(g.sum)}</td>
      <td style="white-space:nowrap">${stTag(st,INV_TONE)}</td>
      <td class="mono" style="white-space:nowrap">${inv?inv.invNo:'—'}</td>
      <td style="white-space:nowrap">${inv?inv.invDate:'—'}</td>
      <td style="white-space:nowrap;font-size:12px;color:var(--ts)">${inv?inv.uploadAt:'—'}</td>
      <td style="white-space:nowrap">${inv?`<button class="btn btn-o btn-sm" onclick="toast('（原型）预览 ${inv.file}','info')">查看发票</button> <button class="btn btn-o btn-sm" onclick="rcpUpload('${g.bill.no}')">重新上传</button>`:`<button class="btn btn-p btn-sm" onclick="rcpUpload('${g.bill.no}')">上传发票</button>`}</td></tr>`;}).join('')}
    </tbody></table></div>`:`<div class="empty"><div class="e-ic">🧾</div><div class="e-t">暂无需开票的结算单</div><div class="e-s">退货赔付进入结算单后，在这里按结算单上传发票</div></div>`}</div></div>`;
}

/* 上传发票：金额预填 = 本期赔付合计，必须相等；号码 / 日期 / 文件必填 */
window.rcpUpload=function(billNo){
  const g=compBills().find(x=>x.bill.no==billNo);if(!g)return;
  const old=DB.retCompInv[billNo],today=new Date().toISOString().slice(0,10);
  DB._rcpFile=old?old.file:'';
  const html=new String(`<div class="mc-hd"><h3>${old?'重新上传':'上传'}赔付发票 · ${billNo}</h3><p>${g.bill.range} · ${g.list.length} 笔赔付</p><button class="mc-x" onclick="closeModal()">×</button></div>
  <div class="mc-bd">
    <div class="ib ib-b"><span class="i">🧾</span><div>请就本期退货赔付合计开 <b>1 张发票给 Foodmax</b>，发票金额（含税）须等于 <b>${money(g.sum)}</b>。已注册 GST 的请在票面列明 GST。买方抬头与 UEN 以平台财务通知为准。</div></div>
    <table style="margin:10px 0 14px"><thead><tr><th>业务调整单号</th><th>关联单号</th><th style="text-align:right">赔付金额</th></tr></thead><tbody>
      ${g.list.map(r=>`<tr><td class="mono">${r.adjNo}</td><td class="mono">${r.retNo}</td><td style="text-align:right">${money(r.ra.comp)}</td></tr>`).join('')}
      <tr style="font-weight:700;background:var(--gl)"><td colspan="2">应开票金额（含税）</td><td style="text-align:right">${money(g.sum)}</td></tr>
    </tbody></table>
    <div class="fg2">
      <div class="fr"><label class="fl"><b>*</b>发票号码</label><input id="rcp-inv-no" maxlength="40" value="${old?old.invNo:''}" placeholder="票面上的发票号码"></div>
      <div class="fr"><label class="fl"><b>*</b>开票日期</label><input id="rcp-inv-d" type="date" max="${today}" value="${old?old.invDate:today}"></div>
    </div>
    <div class="fr"><label class="fl"><b>*</b>发票金额（含税）</label><input id="rcp-inv-amt" type="number" min="0" step="0.01" value="${old?old.amt:g.sum}" style="width:180px;text-align:right"></div>
    <div class="fr"><label class="fl"><b>*</b>发票文件</label><div class="up ${DB._rcpFile?'done':''}" id="rcp-up" onclick="DB._rcpFile='INV-${billNo}.pdf';this.classList.add('done');this.querySelector('.uic').textContent='✓';this.querySelector('.ut').textContent=DB._rcpFile"><div class="uic">${DB._rcpFile?'✓':'📄'}</div><div class="ut">${DB._rcpFile||'点击上传发票'}</div><div class="us">PDF / JPG / PNG，单个不超过 10MB</div></div></div>
  </div>
  <div class="mc-ft"><button class="btn btn-o" onclick="closeModal()">取消</button><button class="btn btn-p" onclick="rcpUploadSubmit('${billNo}')">提交</button></div>`);
  html._wide=true;modal(html);
};
window.rcpUploadSubmit=function(billNo){
  const g=compBills().find(x=>x.bill.no==billNo);if(!g)return;
  const no=(document.getElementById('rcp-inv-no').value||'').trim(),d=document.getElementById('rcp-inv-d').value,amt=Math.round((+document.getElementById('rcp-inv-amt').value||0)*100)/100;
  if(!no)return toast('请填写发票号码','err');
  if(!d)return toast('请选择开票日期','err');
  if(d>new Date().toISOString().slice(0,10))return toast('开票日期不能晚于今天','err');
  if(amt!==g.sum)return toast(`发票金额需等于本期赔付合计 ${money(g.sum)}`,'err');
  if(!DB._rcpFile)return toast('请上传发票文件','err');
  const dup=Object.keys(DB.retCompInv).find(k=>k!=billNo&&DB.retCompInv[k].invNo==no);
  if(dup)return toast(`发票号码已用于结算单 ${dup}`,'err');
  DB.retCompInv[billNo]={invNo:no,invDate:d,amt,uploadAt:ts(),file:DB._rcpFile};
  closeModal();render();toast('赔付发票已上传','ok');
};

})();
