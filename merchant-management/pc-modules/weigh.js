/* PC · 备货管理 > 称重录入（多退少补）—— PAGES['m-pick-weigh']
   口径（2026-07-28 定稿·逐件）：
   - 按重量定价（多退少补=是）的商品按 S$/kg 计价；分装成【每一件（袋）】，一件的【应发净重=规格量】(如 1kg)。
   - 【每一件单独录实发净重】，逐件算 差异/差异率（实发−应发、/应发）；每件一张标签印该件实发净重，不含订单/客户。
   - 归拢维度 = 仓库 × SKU（分组），组内 N 件逐件一行。
   - 发货差额 = Σ各件差额（仅超容差的件计） = 商家↔平台【发货结算差额】。
     客户账单多退少补以仓库实际分拣分配为准，在下游产生。
   阈值走平台「多退少补规则」DB.weighCfg，实时读取。 */
(function(){
  const DEF={tol:2, blockUp:15, blockDown:20, days:7};
  const SVC=0.05;
  function WG(){const c=(typeof DB!=='undefined'&&DB.weighCfg)||DEF;
    return {TOL:(c.tol??DEF.tol)/100,BLOCK_UP:(c.blockUp??DEF.blockUp)/100,BLOCK_DOWN:(c.blockDown??DEF.blockDown)/100,DAYS:c.days??DEF.days,SVC};}
  const money2=v=>(typeof money=='function'?money(v):'S$'+(+v||0).toFixed(2));

  function prodOf(l){return DB.products.find(x=>x.name==l.name);}
  function skuMeta(l){const p=prodOf(l),s=p&&p.skus&&p.skus[0];
    return {weighable:!!(s?s.refund:1)&&['kg','g'].includes((p&&p.unit)||'kg'),specQty:s&&s.qty>0?s.qty:1,unit:(p&&p.unit)||'kg'};}
  function kgPrice(l){const m=skuMeta(l);return +(m.weighable?l.price:l.price/m.specQty).toFixed(2);}

  /* 单件：应发=规格量，逐件算 差异/差异率/差额，阈值逐件判 */
  function calcPortion(w,spec,up){
    const g=WG();
    if(w===''||w==null||isNaN(w))return {filled:false,diff:0,rate:0,amt:0,st:'wait'};
    const diff=+(w-spec).toFixed(2),rate=spec?diff/spec:0;
    if(w<=0)return {filled:true,diff,rate,amt:0,st:'block',msg:'必须 > 0'};
    if(w>spec*3)return {filled:true,diff,rate,amt:0,st:'block',msg:'明显异常，请核对'};
    if(rate>g.BLOCK_UP)return {filled:true,diff,rate,amt:0,st:'block',msg:`超 +${g.BLOCK_UP*100}%，请重分装`};
    if(rate<-g.BLOCK_DOWN)return {filled:true,diff,rate,amt:0,st:'block',msg:`超 −${g.BLOCK_DOWN*100}%，请复称`};
    if(Math.abs(rate)<=g.TOL)return {filled:true,diff,rate,amt:0,st:'ok'};
    if(diff<0)return {filled:true,diff,rate,amt:+(diff*up).toFixed(2),st:'refund'};
    return {filled:true,diff,rate,amt:+(diff*up).toFixed(2),st:'add'};
  }

  function store(){DB.weigh=DB.weigh||{};return DB.weigh;}                 // {wh|sku:{ws:{i:w},submitted,amt,at,by}}
  function recOf(key){return store()[key]||null;}
  function scopeOrders(){return DB.orders.filter(o=>['pending','packed','shipped','received','done'].includes(o.status));}
  function wgDates(){return [...new Set(scopeOrders().map(o=>o.deliver).filter(Boolean))].sort();}
  function wgWhs(){return [...new Set(scopeOrders().map(o=>o.warehouse).filter(Boolean))];}
  function lockedByStatus(o){if(o.status!='done'||!o.doneDate)return false;const d=Date.parse('2026-'+String(o.doneDate).replace(/^2026-/,''));return !isNaN(d)&&(Date.now()-d)/86400000>WG().DAYS;}

  let ROWS=[];   // 分组数组：每个 = 一个 仓库×SKU，含 N 件
  function computeGroup(g){
    const rec=store()[g.key],ws=(rec&&rec.ws)||{};const ps=[];
    let realSum=0,filled=0,amtSum=0,blocked=0;
    for(let i=0;i<g.portionN;i++){const p=calcPortion(ws[i]==null?'':+ws[i],g.specQty,g.up);ps[i]=p;
      if(p.filled){realSum+=+ws[i];filled++;amtSum+=p.amt;if(p.st=='block')blocked++;}}
    realSum=+realSum.toFixed(2);amtSum=+amtSum.toFixed(2);
    let st;if(rec&&rec.submitted)st='done';else if(blocked)st='block';else if(filled<g.portionN)st='wait';else st=amtSum>0?'add':(amtSum<0?'refund':'ok');
    return Object.assign(g,{ws,ps,realSum,filled,amtSum,blocked,st,rec,due:+(g.portionN*g.specQty).toFixed(2)});
  }
  function buildRows(){
    DB.weighF=DB.weighF||{};const f=DB.weighF;const agg={};
    scopeOrders().forEach(o=>{
      if(f.date&&o.deliver!=f.date)return;if(f.wh&&o.warehouse!=f.wh)return;
      (o.lines||[]).forEach(l=>{const m=skuMeta(l);if(!m.weighable)return;
        if(f.name&&!((l.name||'').includes(f.name))&&!((l.sku||'').includes(f.name)))return;
        const wh=o.warehouse||'—',key=wh+'|'+l.sku;
        if(!agg[key])agg[key]={key,wh,sku:l.sku,name:l.name,unit:m.unit,specQty:m.specQty,up:kgPrice(l),portionN:0,locked:false};
        agg[key].portionN+=(+l.qty||0);
        if(lockedByStatus(o))agg[key].locked=true;});
    });
    let rows=Object.values(agg).map(computeGroup);
    return rows.filter(r=>{
      if(f.st=='wait'&&r.st!='wait')return false;
      if(f.st=='diff'&&!['add','refund'].includes(r.st))return false;
      if(f.st=='done'&&r.st!='done')return false;return true;});
  }

  /* ========== 交互 ========== */
  function setWs(key,i,v){const s=store();s[key]=s[key]||{ws:{}};s[key].ws=Object.assign({},s[key].ws);
    if(v===''||isNaN(v))delete s[key].ws[i];else s[key].ws[i]=+(+v).toFixed(2);
    s[key].at='2026-07-01 08:20';s[key].by=DB.merchant&&DB.merchant.contact||'门店操作员';}
  window.wg_portion=function(gi,pi,v){const r=ROWS[gi];if(!r)return;setWs(r.key,pi,v===''?'':parseFloat(v));computeGroup(r);paintPortion(gi,pi);paintGroupSum(gi);paintSum();};
  window.wg_fillGroup=function(gi){const r=ROWS[gi];if(!r||r.st=='done'||r.locked)return;const s=store();s[r.key]=s[r.key]||{ws:{}};s[r.key].ws={};for(let i=0;i<r.portionN;i++)s[r.key].ws[i]=r.specQty;s[r.key].at='2026-07-01 08:20';s[r.key].by=DB.merchant&&DB.merchant.contact||'门店操作员';render();toast(`「${r.name}·${r.wh}」${r.portionN} 件已按应发 ${r.specQty}${r.unit}/件 填入，可改称出来不一样的件`,'ok');};

  window.wg_toggle=function(gi){DB.weighSel=DB.weighSel||[];const k=ROWS[gi].key;const i=DB.weighSel.indexOf(k);if(i<0)DB.weighSel.push(k);else DB.weighSel.splice(i,1);render();};
  window.wg_selAll=function(){DB.weighSel=DB.weighSel||[];const keys=ROWS.filter(r=>r.st!='done'&&!r.locked).map(r=>r.key);const all=keys.length&&keys.every(k=>DB.weighSel.includes(k));DB.weighSel=all?[]:keys.slice();render();};
  function selRows(){const sel=DB.weighSel||[];return ROWS.filter(r=>sel.includes(r.key)&&r.st!='done'&&!r.locked);}
  window.wg_fillSpecAll=function(){const rows=selRows();if(!rows.length){toast('请先勾选要填入的商品','err');return;}const s=store();rows.forEach(r=>{s[r.key]=s[r.key]||{ws:{}};s[r.key].ws={};for(let i=0;i<r.portionN;i++)s[r.key].ws[i]=r.specQty;s[r.key].at='2026-07-01 08:20';s[r.key].by=DB.merchant&&DB.merchant.contact||'门店操作员';});render();toast(`已按应发填入 ${rows.length} 个商品，可继续改有差异的件`,'ok');};

  window.wg_submit=function(){
    const rows=selRows();if(!rows.length){toast('请先勾选要提交的商品','err');return;}
    const notFull=rows.filter(r=>r.filled<r.portionN);
    if(notFull.length){toast(`${notFull.length} 个商品还有件未称重，请称完每一件再提交`,'err');return;}
    const bad=rows.filter(r=>r.blocked);
    if(bad.length){toast(`${bad.length} 个商品有件超阈值/异常，请按提示复称/重分装后再提交`,'err');return;}
    const add=rows.filter(r=>r.amtSum>0),ref=rows.filter(r=>r.amtSum<0);
    const total=+rows.reduce((a,r)=>a+r.amtSum,0).toFixed(2),fee=+(total*SVC).toFixed(2);
    modal(`<div class="mc-hd"><h3>提交称重结果 · ${rows.length} 个商品</h3><p>提交后各件实发净重与差额<b>不可修改</b>；每件按实发净重打印标签</p><button class="mc-x" onclick="closeModal()">×</button></div>
    <div class="mc-bd"><div style="overflow-x:auto;max-height:280px"><table style="border:1px solid var(--bd2)"><thead><tr><th>商品</th><th>仓库</th><th style="text-align:right">件数</th><th style="text-align:right">应发合计</th><th style="text-align:right">实发合计</th><th style="text-align:right">差额</th></tr></thead><tbody>
      ${rows.map(r=>`<tr><td><b>${r.name}</b></td><td style="font-size:12px">${r.wh}</td><td style="text-align:right">${r.portionN}</td><td style="text-align:right">${r.due}kg</td><td style="text-align:right"><b>${r.realSum}kg</b></td>
        <td style="text-align:right">${r.amtSum?`<b style="color:${r.amtSum>0?'var(--y)':'var(--r)'}">${r.amtSum>0?'+':'-'}${money2(Math.abs(r.amtSum))}</b>`:'<span style="color:var(--ts)">—</span>'}</td></tr>`).join('')}
      </tbody></table></div>
      <div class="ib ${total>=0?'ib-y':'ib-b'}" style="margin-top:12px"><span class="i">💰</span>本次<b>发货差额</b>合计 <b>${total>0?'+':''}${money2(total)}</b>（多发 ${add.length} / 少发 ${ref.length}）；平台服务费按实发重算 <b>${total>0?'-':'+'}${money2(Math.abs(fee))}</b>。这是<b>商家↔平台发货结算差额</b>，并入当期对账单。</div>
      <div class="ib ib-b"><span class="i">📦</span>货到仓库由 WMS <b>重新分拣分配</b>到各订单，<b>客户账单多退少补以仓库实际分配为准</b>，不由本次称重决定。</div></div>
    <div class="mc-ft"><button class="btn btn-o" onclick="closeModal()">再改改</button><button class="btn btn-p" onclick="wg_doSubmit()">确认提交</button></div>`);};
  window.wg_doSubmit=function(){const rows=selRows().filter(r=>r.filled===r.portionN&&!r.blocked);const s=store();let total=0;
    rows.forEach(r=>{s[r.key]=Object.assign({},s[r.key],{submitted:true,amt:r.amtSum,due:r.due,real:r.realSum,at:'2026-07-01 08:20'});total+=r.amtSum;});
    DB.weighSel=[];closeModal();render();toast(`已提交 ${rows.length} 个商品，发货差额合计 ${total>0?'+':''}${money2(+total.toFixed(2))}，并入当期对账单`,'ok');};

  /* ========== 局部重绘 ========== */
  const dcol=v=>v>0?'var(--y)':v<0?'var(--r)':'var(--ts)';
  function paintPortion(gi,pi){const r=ROWS[gi];if(!r)return;const p=r.ps[pi]||{};const has=p.filled;
    const set=(id,html,color)=>{const el=document.getElementById(id);if(el){el.innerHTML=html;if(color!==undefined)el.style.color=color;}};
    set('wg-diff-'+gi+'-'+pi,!has?'—':`${p.diff>0?'+':''}${p.diff} kg`,!has?'var(--tt)':dcol(p.diff));
    set('wg-rate-'+gi+'-'+pi,!has?'—':`${p.diff>0?'+':''}${(p.rate*100).toFixed(1)}%`,!has?'var(--tt)':(p.st=='block'?'var(--r)':dcol(p.diff)));
    set('wg-msg-'+gi+'-'+pi,p.st=='block'&&p.msg?`⚠️ ${p.msg}`:'');
    const inp=document.getElementById('wg-in-'+gi+'-'+pi);if(inp)inp.style.borderColor=p.st=='block'?'var(--r)':'';}
  function groupSumHtml(r){
    return `已称 <b>${r.filled}/${r.portionN}</b> 件 · 应发合计 <b>${r.due}${r.unit}</b> · 实发合计 <b>${r.realSum||0}${r.unit}</b> · 差额 <b style="color:${r.amtSum>0?'var(--y)':r.amtSum<0?'var(--r)':'var(--gd)'}">${r.amtSum?(r.amtSum>0?'+':'-')+money2(Math.abs(r.amtSum)):'—'}</b>${r.blocked?` · <span style="color:var(--r)">${r.blocked} 件异常</span>`:''}`;}
  function paintGroupSum(gi){const r=ROWS[gi];if(!r)return;const el=document.getElementById('wg-gsum-'+gi);if(el)el.innerHTML=groupSumHtml(r);}
  function paintSum(){const el=document.getElementById('wg-sum');if(!el)return;const rows=ROWS;
    const wait=rows.filter(r=>r.st=='wait').length,blocked=rows.filter(r=>r.blocked).length;
    const total=+rows.reduce((a,r)=>a+(r.amtSum||0),0).toFixed(2);
    el.innerHTML=`<span style="min-width:90px">可称重商品：<b>${rows.length}</b></span><span style="min-width:70px">待称重：<b style="color:var(--r)">${wait}</b></span>
      <span style="min-width:84px">异常拦截：<b style="color:${blocked?'var(--r)':'var(--ts)'}">${blocked}</b></span>
      <span style="min-width:150px">发货差额合计：<b style="color:${total>0?'var(--y)':total<0?'var(--r)':'var(--gd)'}">${total>0?'+':''}${money2(total)}</b></span>
      <span style="color:var(--ts);font-size:12px">容差 ±${WG().TOL*100}% 不计差额 · 多发超 +${WG().BLOCK_UP*100}% / 少发超 −${WG().BLOCK_DOWN*100}% 拦截</span>`;}

  /* ========== 页面 ========== */
  function view(){
    DB.weighF=DB.weighF||{};DB.weighSel=DB.weighSel||[];
    const f=DB.weighF,dates=wgDates(),whs=wgWhs();
    if(f.date===undefined)f.date=dates[0]||'';
    ROWS=buildRows();
    const selN=selRows().length;
    const selKeys=ROWS.filter(r=>r.st!='done'&&!r.locked).map(r=>r.key);
    const allSel=selKeys.length&&selKeys.every(k=>(DB.weighSel||[]).includes(k));
    const opt=(cur,list,ph)=>`<option value="">${ph}</option>`+list.map(v=>`<option ${cur==v?'selected':''}>${v}</option>`).join('');
    const bodyHtml=ROWS.length?ROWS.map((g,gi)=>{const done=g.st=='done',lock=g.locked;
      // 分组头（商品 + 单价 + 仓库 + 汇总 + 整组按应发）
      const head=`<tr class="wg-grp"><td>${done||lock?'':`<input type="checkbox" ${(DB.weighSel||[]).includes(g.key)?'checked':''} onclick="wg_toggle(${gi})">`}</td>
        <td colspan="5"><div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap">
          <span><b style="font-size:13.5px">${g.name}</b> <span style="color:var(--ts);font-size:11.5px">${money2(g.up)}/${g.unit} · ${g.wh} · ${g.portionN} 件</span></span>
          <span id="wg-gsum-${gi}" style="font-size:12px;color:var(--ts)">${groupSumHtml(g)}</span>
          ${done||lock?`<span style="margin-left:auto;font-size:11.5px;color:${lock?'var(--ts)':'var(--gd)'}">${lock?`超 ${WG().DAYS} 天已锁定`:'✓ 已提交 · 每件一张标签印实发净重'}</span>`:`<button class="btn btn-link btn-sm" style="margin-left:auto" onclick="wg_fillGroup(${gi})" title="全部件按应发 ${g.specQty}${g.unit} 填入">整组按应发</button>`}
        </div></td></tr>`;
      // 逐件行：件号 | 应发(规格量) | 实发[输入] | 差异 | 差异率
      const rows=Array.from({length:g.portionN}).map((_,pi)=>{const w=g.ws[pi];const has=w!=null&&w!=='';const p=g.ps[pi]||{};
        const rc=done||lock
          ?`<td style="text-align:center"><b>${has?w+' '+g.unit:'—'}</b></td>`
          :`<td style="text-align:center"><div class="row" style="gap:8px;justify-content:center;align-items:center;flex-wrap:nowrap;white-space:nowrap"><input id="wg-in-${gi}-${pi}" type="number" step="0.01" min="0" value="${has?w:''}" placeholder="${g.specQty}" oninput="wg_portion(${gi},${pi},this.value)" style="width:96px;text-align:right"></div><div id="wg-msg-${gi}-${pi}" style="font-size:10.5px;color:var(--r);min-height:14px;line-height:14px;margin-top:2px;white-space:nowrap"></div></td>`;
        return `<tr class="wg-pr ${p.st=='block'?'bad':''}"><td></td>
          <td style="color:var(--ts);font-size:12px">件 ${pi+1}</td>
          <td style="text-align:right">${g.specQty} ${g.unit}</td>
          ${rc}
          <td id="wg-diff-${gi}-${pi}" style="text-align:right"></td>
          <td id="wg-rate-${gi}-${pi}" style="text-align:right"></td></tr>`;}).join('');
      return head+rows;
    }).join(''):`<tr><td colspan="6"><div class="empty"><div class="e-ic">⚖️</div><div class="e-t">该筛选下没有需要称重的商品</div><div class="e-s">仅按重量定价（多退少补=是）的商品需要称重；切换配送日期/仓库看看。</div></div></td></tr>`;
    return `
    <style>
    .wg-grp td{background:var(--gl);padding:9px 14px}
    .wg-pr td{padding:6px 14px}
    .wg-pr input{border:1px solid var(--bd);border-radius:9px;height:34px;background:#FBFCF9;font-size:13.5px;color:var(--tp);outline:none;transition:.16s}
    .wg-pr input:focus{border-color:var(--g);background:#fff;box-shadow:0 0 0 3px rgba(14,122,82,.12)}
    .wg-pr input::placeholder{color:var(--tt)}
    .wg-pr.bad input{border-color:var(--r);background:var(--rl)}
    </style>
    <div class="ib ib-b" style="margin-bottom:12px"><span class="i">⚖️</span>
      按重量定价（多退少补=是）的商品按 <b>S$/kg</b> 计价、分装成件（<b>一件应发=规格量</b>，如 1kg）；<b>每一件单独称重</b>录实发净重，逐件算差异/差异率，每件一张标签印该件实发净重、<b>不含订单/客户</b>——货到仓库由 WMS 重新分拣分配。发货差额 = Σ各件差额 = <b>商家↔平台发货结算差额</b>；客户账单多退少补以仓库实际分配为准。</div>

    <div class="card" style="margin-bottom:14px"><div class="card-bd" style="display:flex;gap:16px;align-items:flex-end;flex-wrap:wrap">
      <div><div style="font-size:12px;color:var(--ts);margin-bottom:5px">配送日期</div><select onchange="DB.weighF.date=this.value;render()" style="min-width:140px">${dates.map(d=>`<option ${f.date==d?'selected':''}>${d}</option>`).join('')||'<option>无</option>'}</select></div>
      <div><div style="font-size:12px;color:var(--ts);margin-bottom:5px">仓库</div><select onchange="DB.weighF.wh=this.value;render()" style="min-width:150px">${opt(f.wh||'',whs,'全部仓库')}</select></div>
      <div><div style="font-size:12px;color:var(--ts);margin-bottom:5px">状态</div><select onchange="DB.weighF.st=this.value;render()" style="min-width:130px"><option value="">全部</option><option value="wait" ${f.st=='wait'?'selected':''}>待称重</option><option value="diff" ${f.st=='diff'?'selected':''}>有差额</option><option value="done" ${f.st=='done'?'selected':''}>已提交</option></select></div>
      <div><div style="font-size:12px;color:var(--ts);margin-bottom:5px">商品名称</div><input id="wg-name" value="${f.name||''}" placeholder="请输入" onkeydown="if(event.key=='Enter'){DB.weighF.name=this.value.trim();render()}" style="min-width:160px"></div>
      <button class="btn btn-p btn-sm" onclick="DB.weighF.name=(document.getElementById('wg-name')||{}).value.trim();render()">查询</button>
      <button class="btn btn-o btn-sm" onclick="DB.weighF={};DB.weighSel=[];render()">重置</button>
    </div></div>

    <div class="card"><div class="card-hd" style="flex-wrap:wrap;gap:10px">
      <div class="row" style="gap:8px;flex-wrap:wrap;align-items:center">
        <button class="btn btn-o btn-sm" ${selN?'':'disabled'} onclick="wg_fillSpecAll()" title="勾选商品的全部件一键按应发填入">按应发填入${selN?`（${selN}）`:''}</button>
        <button class="btn btn-p btn-sm" ${selN?'':'disabled'} onclick="wg_submit()">提交称重结果${selN?`（${selN}）`:''}</button>
        <button class="btn btn-o btn-sm" onclick="toast('已导出称重单.xlsx（逐件实发/应发/差异/差额）','ok')">导出称重单</button>
        <button class="btn btn-link btn-sm" onclick="nav('m-pick-label')">去打印标签</button>
      </div>
      <div id="wg-sum" class="row" style="gap:14px;font-size:12.5px;align-items:center"></div>
    </div>
    <div class="card-bd flush"><div style="overflow-x:auto"><table style="table-layout:fixed;width:100%;min-width:760px">
      <thead><tr>
        <th style="width:36px"><input type="checkbox" title="全选可称重商品" ${allSel?'checked':''} onclick="wg_selAll()"></th>
        <th style="width:70px">件</th><th style="text-align:right;width:110px">应发净重</th><th style="text-align:center;width:180px">实发净重 (kg)</th>
        <th style="text-align:right;width:110px">差异</th><th style="text-align:right;width:100px">差异率</th>
      </tr></thead><tbody>${bodyHtml}</tbody></table></div></div></div>`;
  }

  /* ========== 订单详情提示 ========== */
  window.weighSection=function(o){
    if(!(o.lines||[]).some(l=>skuMeta(l).weighable))return '';
    return `<div class="ib ib-b" style="margin-top:14px"><span class="i">⚖️</span>本单含<b>按重量定价（多退少补）</b>商品：商家按每件称重、按仓库×SKU 汇总发货；<b>本单客户侧多退少补以仓库实际分拣分配的重量为准</b>，在对账/账单中体现，不等于商家发货称重。</div>`;
  };
  window.weighLineState=function(o,l){if(!skuMeta(l).weighable)return 'na';const r=recOf((o.warehouse||'—')+'|'+l.sku);return r&&r.submitted?'done':'wait';};
  window.weighWhPending=function(date,wh){const saved=DB.weighF;DB.weighF={date:date||'',wh:wh||'',st:''};const n=buildRows().filter(r=>r.st=='wait').length;DB.weighF=saved;return n;};
  window.weighRealOf=function(o,l){const r=recOf((o.warehouse||'—')+'|'+l.sku);return r&&r.submitted?r.real:null;};
  window.weighPending=function(){const saved=DB.weighF;DB.weighF={date:'',wh:'',st:''};const n=buildRows().filter(r=>r.st=='wait').length;DB.weighF=saved;return n;};

  PAGES['m-pick-weigh']=()=>{ ensurePickOrders(); const html=view(); setTimeout(()=>{ROWS.forEach((g,gi)=>{for(let pi=0;pi<g.portionN;pi++)paintPortion(gi,pi);paintGroupSum(gi);});paintSum();},0); return html; };
})();
