/* PC · 备货管理 > 称重录入（多退少补）—— PAGES['m-pick-weigh']
   口径（2026-07-28 定稿·逐份称重）：
   - 商家把货分成【若干份（袋）】，一件=一份=一袋；每一份【单独过秤】，每份一张标签印【该份实发净重】，
     都不带订单/客户信息——货到仓库(DC)由 WMS 重新分拣分配到各订单。
   - 归拢维度 = 仓库 × SKU：该仓该 SKU 共 N 份（N = 各订单件数之和）；逐份录实发净重。
   - 发货差额 =（Σ各份实发 − N×规格量）× S$/kg = 商家↔平台【发货结算差额】。
     客户账单多退少补以仓库实际分拣分配为准，在下游产生（不由商家称重决定）。
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

  /* 汇总差额（作用于 仓库×SKU：实发合计 vs 应发合计=N×规格量） */
  function calc(due,up,realSum,filledAll){
    const g=WG();
    if(!filledAll)return {st:'wait',due,up,diff:0,ratio:0,amt:0};
    const diff=+(realSum-due).toFixed(2),ratio=due?diff/due:0;
    if(realSum<=0)return {st:'block',due,up,diff,ratio,amt:0,msg:'实发净重必须 > 0'};
    if(ratio>g.BLOCK_UP)return {st:'block',due,up,diff,ratio,amt:0,msg:`多发超 +${g.BLOCK_UP*100}%，请重分装`};
    if(ratio<-g.BLOCK_DOWN)return {st:'block',due,up,diff,ratio,amt:0,msg:`少发超 −${g.BLOCK_DOWN*100}%，请复称`};
    if(Math.abs(ratio)<=g.TOL)return {st:'ok',due,up,diff,ratio,amt:0};
    if(diff<0)return {st:'refund',due,up,diff,ratio,amt:+(diff*up).toFixed(2)};
    return {st:'add',due,up,diff,ratio,amt:+(diff*up).toFixed(2)};
  }

  function store(){DB.weigh=DB.weigh||{};return DB.weigh;}                 // {wh|sku:{ws:{i:w},submitted,amt,due,diff,at,by}}
  function recOf(key){return store()[key]||null;}

  function scopeOrders(){return DB.orders.filter(o=>['pending','packed','shipped','received','done'].includes(o.status));}
  function wgDates(){return [...new Set(scopeOrders().map(o=>o.deliver).filter(Boolean))].sort();}
  function wgWhs(){return [...new Set(scopeOrders().map(o=>o.warehouse).filter(Boolean))];}
  function lockedByStatus(o){if(o.status!='done'||!o.doneDate)return false;const d=Date.parse('2026-'+String(o.doneDate).replace(/^2026-/,''));return !isNaN(d)&&(Date.now()-d)/86400000>WG().DAYS;}

  let ROWS=[];
  function portionTypo(w,spec){return w!==''&&!isNaN(w)&&(w<=0||w>spec*3);}  // 单份明显异常(手滑多打一位)
  function computeRow(g){
    const rec=store()[g.key],ws=(rec&&rec.ws)||{};
    let realSum=0,filled=0,typo=0;
    for(let i=0;i<g.portionN;i++){const w=ws[i];if(w!==''&&w!=null&&!isNaN(w)){realSum+=+w;filled++;if(portionTypo(+w,g.specQty))typo++;}}
    realSum=+realSum.toFixed(2);
    const filledAll=filled===g.portionN;
    const c=calc(g.due,g.up,realSum,filledAll);
    const st=(rec&&rec.submitted)?'done':(typo?'block':c.st);
    return Object.assign(g,{ws,realSum,filled,typo,c:typo?Object.assign({},c,{st:'block',msg:`${typo} 份重量明显异常，请核对`}):c,st,rec});
  }
  function buildRows(){
    DB.weighF=DB.weighF||{};const f=DB.weighF;const agg={};
    scopeOrders().forEach(o=>{
      if(f.date&&o.deliver!=f.date)return;if(f.wh&&o.warehouse!=f.wh)return;
      (o.lines||[]).forEach(l=>{const m=skuMeta(l);if(!m.weighable)return;
        if(f.name&&!((l.name||'').includes(f.name))&&!((l.sku||'').includes(f.name)))return;
        const wh=o.warehouse||'—',key=wh+'|'+l.sku;
        if(!agg[key])agg[key]={key,wh,sku:l.sku,name:l.name,unit:m.unit,specQty:m.specQty,up:kgPrice(l),portionN:0,due:0,locked:false};
        agg[key].portionN+=(+l.qty||0);
        if(lockedByStatus(o))agg[key].locked=true;});
    });
    let rows=Object.values(agg).map(g=>{g.due=+(g.portionN*g.specQty).toFixed(2);return computeRow(g);});
    return rows.filter(r=>{
      if(f.st=='wait'&&r.st!='wait')return false;
      if(f.st=='diff'&&!['add','refund'].includes(r.st))return false;
      if(f.st=='done'&&r.st!='done')return false;return true;});
  }

  /* ========== 交互 ========== */
  function setWs(key,i,v){const s=store();s[key]=s[key]||{ws:{}};s[key].ws=Object.assign({},s[key].ws);
    if(v===''||isNaN(v))delete s[key].ws[i];else s[key].ws[i]=+(+v).toFixed(2);
    s[key].at='2026-07-01 08:20';s[key].by=DB.merchant&&DB.merchant.contact||'门店操作员';}
  window.wg_portion=function(idx,pi,v){const r=ROWS[idx];if(!r)return;setWs(r.key,pi,v===''?'':parseFloat(v));computeRow(r);paintCard(idx);paintSum();};
  window.wg_fillSpec=function(idx){const r=ROWS[idx];if(!r||r.st=='done'||r.locked)return;const s=store();s[r.key]=s[r.key]||{ws:{}};s[r.key].ws={};for(let i=0;i<r.portionN;i++)s[r.key].ws[i]=r.specQty;s[r.key].at='2026-07-01 08:20';s[r.key].by=DB.merchant&&DB.merchant.contact||'门店操作员';render();toast(`「${r.name}·${r.wh}」${r.portionN} 份已按规格 ${r.specQty}${r.unit} 填入，可改称出来不一样的份`,'ok');};

  window.wg_toggle=function(idx){DB.weighSel=DB.weighSel||[];const k=ROWS[idx].key;const i=DB.weighSel.indexOf(k);if(i<0)DB.weighSel.push(k);else DB.weighSel.splice(i,1);render();};
  window.wg_selAll=function(){DB.weighSel=DB.weighSel||[];const keys=ROWS.filter(r=>r.st!='done'&&!r.locked).map(r=>r.key);const all=keys.length&&keys.every(k=>DB.weighSel.includes(k));DB.weighSel=all?[]:keys.slice();render();};
  function selRows(){const sel=DB.weighSel||[];return ROWS.filter(r=>sel.includes(r.key)&&r.st!='done'&&!r.locked);}
  window.wg_fillSpecAll=function(){const rows=selRows();if(!rows.length){toast('请先勾选要填入的项','err');return;}const s=store();rows.forEach(r=>{s[r.key]=s[r.key]||{ws:{}};s[r.key].ws={};for(let i=0;i<r.portionN;i++)s[r.key].ws[i]=r.specQty;s[r.key].at='2026-07-01 08:20';s[r.key].by=DB.merchant&&DB.merchant.contact||'门店操作员';});render();toast(`已按规格填入 ${rows.length} 项，可继续改有差异的份`,'ok');};

  window.wg_submit=function(){
    const rows=selRows();if(!rows.length){toast('请先勾选要提交的项','err');return;}
    const notFull=rows.filter(r=>r.filled<r.portionN);
    if(notFull.length){toast(`${notFull.length} 项还有份未称重，请称完每一份再提交`,'err');return;}
    const bad=rows.filter(r=>r.c.st=='block');
    if(bad.length){toast(`${bad.length} 项超限/异常被拦截，请按提示复称/重分装后再提交`,'err');return;}
    const add=rows.filter(r=>r.c.st=='add'),ref=rows.filter(r=>r.c.st=='refund');
    const total=+rows.reduce((a,r)=>a+r.c.amt,0).toFixed(2),fee=+(total*SVC).toFixed(2);
    modal(`<div class="mc-hd"><h3>提交称重结果 · ${rows.length} 项</h3><p>提交后各份实发净重与差额<b>不可修改</b>；标签按每份实发净重打印</p><button class="mc-x" onclick="closeModal()">×</button></div>
    <div class="mc-bd"><div style="overflow-x:auto;max-height:280px"><table style="border:1px solid var(--bd2)"><thead><tr><th>商品</th><th>仓库</th><th style="text-align:right">份数</th><th style="text-align:right">应发合计</th><th style="text-align:right">实发合计</th><th style="text-align:right">差异</th><th style="text-align:right">差额</th></tr></thead><tbody>
      ${rows.map(r=>`<tr><td><b>${r.name}</b></td><td style="font-size:12px">${r.wh}</td><td style="text-align:right">${r.portionN}</td><td style="text-align:right">${r.c.due}kg</td><td style="text-align:right"><b>${r.realSum}kg</b></td>
        <td style="text-align:right;color:${r.c.diff>0?'var(--y)':r.c.diff<0?'var(--r)':'var(--ts)'}">${r.c.diff>0?'+':''}${r.c.diff}kg</td>
        <td style="text-align:right">${r.c.amt?`<b style="color:${r.c.amt>0?'var(--y)':'var(--r)'}">${r.c.amt>0?'+':'-'}${money2(Math.abs(r.c.amt))}</b>`:'<span style="color:var(--ts)">—</span>'}</td></tr>`).join('')}
      </tbody></table></div>
      <div class="ib ${total>=0?'ib-y':'ib-b'}" style="margin-top:12px"><span class="i">💰</span>本次<b>发货差额</b>合计 <b>${total>0?'+':''}${money2(total)}</b>（多发 ${add.length} / 少发 ${ref.length}）；平台服务费按实发重算 <b>${total>0?'-':'+'}${money2(Math.abs(fee))}</b>。这是<b>商家↔平台的发货结算差额</b>，并入当期对账单。</div>
      <div class="ib ib-b"><span class="i">📦</span>货到仓库由 WMS <b>重新分拣分配</b>到各订单，<b>客户账单的多退少补以仓库实际分配为准</b>，不由本次称重决定。</div></div>
    <div class="mc-ft"><button class="btn btn-o" onclick="closeModal()">再改改</button><button class="btn btn-p" onclick="wg_doSubmit()">确认提交</button></div>`);};
  window.wg_doSubmit=function(){const rows=selRows().filter(r=>r.filled===r.portionN&&r.c.st!='block');const s=store();let total=0;
    rows.forEach(r=>{s[r.key]=Object.assign({},s[r.key],{submitted:true,amt:r.c.amt,due:r.c.due,diff:r.c.diff,real:r.realSum,at:'2026-07-01 08:20'});total+=r.c.amt;});
    DB.weighSel=[];closeModal();render();toast(`已提交 ${rows.length} 项，发货差额合计 ${total>0?'+':''}${money2(+total.toFixed(2))}，并入当期对账单`,'ok');};

  /* ========== 局部重绘 ========== */
  function stTag(r){const M={wait:['待称重','t-gr'],ok:['正常损耗','t-b'],add:['多发·补款','t-y'],refund:['少发·退款','t-pp'],block:['拦截','t-r'],done:['已提交','t-g']};const t=M[r.st]||M.wait;return `<span class="tag ${t[1]}" style="font-size:11px">${t[0]}</span>`;}
  function cardSum(r){
    const c=r.c;const rate=r.st=='wait'?'':` (${(c.ratio*100).toFixed(1)}%)`;
    return `<span>已称 <b>${r.filled}/${r.portionN}</b> 份</span>
      <span>应发合计 <b>${r.due}kg</b></span>
      <span>实发合计 <b>${r.realSum||0}kg</b></span>
      <span>差异 <b style="color:${c.diff>0?'var(--y)':c.diff<0?'var(--r)':'var(--ts)'}">${r.st=='wait'?'—':(c.diff>0?'+':'')+c.diff+'kg'+rate}</b></span>
      <span>差额 <b style="color:${c.amt>0?'var(--y)':c.amt<0?'var(--r)':'var(--gd)'}">${c.amt?(c.amt>0?'+':'-')+money2(Math.abs(c.amt)):(r.st=='wait'?'—':'—')}</b></span>
      ${stTag(r)}${c.msg?`<span style="color:var(--r);font-size:11.5px">⚠️ ${c.msg}</span>`:''}`;
  }
  function paintCard(idx){const r=ROWS[idx];if(!r)return;const el=document.getElementById('wg-sum-'+idx);if(el)el.innerHTML=cardSum(r);}
  function paintSum(){const el=document.getElementById('wg-sum');if(!el)return;const rows=ROWS;
    const wait=rows.filter(r=>r.st=='wait').length,blocked=rows.filter(r=>r.c.st=='block').length;
    const total=+rows.reduce((a,r)=>a+(r.c.amt||0),0).toFixed(2);
    el.innerHTML=`<span style="min-width:84px">可称重项：<b>${rows.length}</b></span><span style="min-width:70px">待称重：<b style="color:var(--r)">${wait}</b></span>
      <span style="min-width:84px">超限拦截：<b style="color:${blocked?'var(--r)':'var(--ts)'}">${blocked}</b></span>
      <span style="min-width:150px">发货差额合计：<b style="color:${total>0?'var(--y)':total<0?'var(--r)':'var(--gd)'}">${total>0?'+':''}${money2(total)}</b></span>
      <span style="color:var(--ts);font-size:12px">容差 ±${WG().TOL*100}% 不计差额 · 多发超 +${WG().BLOCK_UP*100}% / 少发超 −${WG().BLOCK_DOWN*100}% 拦截</span>`;}

  /* ========== 页面 ========== */
  function portionGrid(r,idx){
    const readonly=r.st=='done'||r.locked;
    const rows=Array.from({length:r.portionN}).map((_,i)=>{
      const w=r.ws[i];const has=w!=null&&w!=='';const dv=has?+(+w-r.specQty).toFixed(2):null;const bad=portionTypo(has?+w:'',r.specQty);
      const tail=readonly?'':(bad?`<span class="pf">⚠️ 重量明显异常，请核对</span>`:(has&&Math.abs(dv)>=0.01?`<span class="pf ok">${dv>0?'+':''}${dv} kg</span>`:''));
      const cell=readonly
        ?`<b class="pw">${has?w+' '+r.unit:'—'}</b><span class="ptag">🏷️ 标签印 ${has?w+r.unit:'—'}</span>`
        :`<input type="number" step="0.01" min="0" value="${has?w:''}" placeholder="${r.specQty}" oninput="wg_portion(${idx},${i},this.value)"><i>${r.unit}</i>${tail}`;
      return `<div class="wg-pr ${bad?'bad':''}"><span class="pn">份 ${i+1}</span>${cell}</div>`;
    }).join('');
    const note=readonly
      ?`<div style="font-size:11.5px;color:${r.locked?'var(--ts)':'var(--gd)'};margin-top:8px">${r.locked?`超 ${WG().DAYS} 天已锁定`:'✓ 已提交 · 每份一张标签、印该份实发净重'}</div>`
      :`<div style="font-size:11.5px;color:var(--ts);margin-top:8px">逐份过秤录入，一行一份；每份一张标签、印该份实发净重（不含订单/客户）。</div>`;
    return `<div class="wg-pl">${rows}</div>${note}`;
  }
  function view(){
    DB.weighF=DB.weighF||{};DB.weighSel=DB.weighSel||[];
    const f=DB.weighF,dates=wgDates(),whs=wgWhs();
    if(f.date===undefined)f.date=dates[0]||'';
    ROWS=buildRows();
    const selN=selRows().length;
    const opt=(cur,list,ph)=>`<option value="">${ph}</option>`+list.map(v=>`<option ${cur==v?'selected':''}>${v}</option>`).join('');
    const cards=ROWS.length?ROWS.map((r,i)=>{const done=r.st=='done',lock=r.locked;
      return `<div class="wg-card" id="wg-card-${i}">
        <div class="wg-ch">
          <div style="display:flex;align-items:center;gap:10px">
            ${done||lock?'':`<input type="checkbox" ${(DB.weighSel||[]).includes(r.key)?'checked':''} onclick="wg_toggle(${i})">`}
            <b style="font-size:14.5px">${r.name}</b><span style="color:var(--ts);font-size:12px">${r.specQty}${r.unit}/件 · ${r.wh} · <b>${r.portionN}</b> 份</span>
          </div>
          ${done||lock?'':`<button class="btn btn-o btn-sm" onclick="wg_fillSpec(${i})" title="全部份按规格 ${r.specQty}${r.unit} 填入，再改称出来不一样的份">全部按规格</button>`}
        </div>
        <div class="wg-sum" id="wg-sum-${i}">${cardSum(r)}</div>
        ${portionGrid(r,i)}
      </div>`;}).join(''):`<div class="empty" style="padding:40px"><div class="e-ic">⚖️</div><div class="e-t">该筛选下没有需要称重的商品</div><div class="e-s">仅按重量定价（多退少补=是）的商品需要称重；切换配送日期/仓库看看。</div></div>`;
    return `
    <style>
    /* 对齐 foodmax-frontend 设计系统 token 与 .card/.input 配方 */
    .wg-card{background:var(--w);border:1px solid var(--bd);border-radius:var(--rad);box-shadow:var(--sh);padding:15px 20px;margin-bottom:18px}
    .wg-ch{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}
    .wg-sum{display:flex;gap:16px;flex-wrap:wrap;align-items:center;font-size:12.5px;color:var(--ts);margin:12px 0;padding:9px 0;border-top:1px solid var(--bd2);border-bottom:1px solid var(--bd2)}
    .wg-sum b{color:var(--tp)}
    .wg-pl{margin-top:12px;border:1px solid var(--bd2);border-radius:var(--rad);overflow:hidden}
    .wg-pr{display:flex;align-items:center;gap:12px;padding:8px 14px}
    .wg-pr+.wg-pr{border-top:1px solid var(--bd2)}
    .wg-pr:nth-child(even){background:#FBFCF9}
    .wg-pr .pn{width:52px;font-size:12.5px;color:var(--ts);flex:0 0 52px}
    .wg-pr input{width:118px;height:36px;border:1px solid var(--bd);border-radius:9px;background:#FBFCF9;text-align:right;padding:0 12px;font-size:13.5px;color:var(--tp);outline:none;transition:.16s}
    .wg-pr input:focus{border-color:var(--g);background:#fff;box-shadow:0 0 0 3px rgba(14,122,82,.12)}
    .wg-pr input::placeholder{color:var(--tt)}
    .wg-pr i{font-size:12px;color:var(--ts);font-style:normal}
    .wg-pr .pf{font-size:11.5px;color:var(--r);margin-left:4px}
    .wg-pr .pf.ok{color:var(--ts)}
    .wg-pr.bad input{border-color:var(--r);background:var(--rl)}
    .wg-pr .pw{font-size:13.5px;font-weight:600;min-width:80px}
    .wg-pr .ptag{font-size:11.5px;color:var(--ts)}
    </style>
    <div class="ib ib-b" style="margin-bottom:12px"><span class="i">⚖️</span>
      按重量定价（多退少补=是）的商品，分装时<b>每一份（袋）单独过秤</b>、每份一张标签印<b>该份实发净重</b>，<b>不含订单/客户</b>——货到仓库由 WMS 重新分拣分配。
      发货差额 =（Σ各份实发 − 应发合计）× S$/kg，是<b>商家↔平台发货结算差额</b>；客户账单多退少补以仓库实际分配为准。</div>

    <div class="card" style="margin-bottom:14px"><div class="card-bd" style="display:flex;gap:16px;align-items:flex-end;flex-wrap:wrap">
      <div><div style="font-size:12px;color:var(--ts);margin-bottom:5px">配送日期</div><select onchange="DB.weighF.date=this.value;render()" style="min-width:140px">${dates.map(d=>`<option ${f.date==d?'selected':''}>${d}</option>`).join('')||'<option>无</option>'}</select></div>
      <div><div style="font-size:12px;color:var(--ts);margin-bottom:5px">仓库</div><select onchange="DB.weighF.wh=this.value;render()" style="min-width:150px">${opt(f.wh||'',whs,'全部仓库')}</select></div>
      <div><div style="font-size:12px;color:var(--ts);margin-bottom:5px">状态</div><select onchange="DB.weighF.st=this.value;render()" style="min-width:130px"><option value="">全部</option><option value="wait" ${f.st=='wait'?'selected':''}>待称重</option><option value="diff" ${f.st=='diff'?'selected':''}>有差额</option><option value="done" ${f.st=='done'?'selected':''}>已提交</option></select></div>
      <div><div style="font-size:12px;color:var(--ts);margin-bottom:5px">商品名称</div><input id="wg-name" value="${f.name||''}" placeholder="请输入" onkeydown="if(event.key=='Enter'){DB.weighF.name=this.value.trim();render()}" style="min-width:160px"></div>
      <button class="btn btn-p btn-sm" onclick="DB.weighF.name=(document.getElementById('wg-name')||{}).value.trim();render()">查询</button>
      <button class="btn btn-o btn-sm" onclick="DB.weighF={};DB.weighSel=[];render()">重置</button>
    </div></div>

    <div class="card" style="margin-bottom:12px"><div class="card-hd" style="flex-wrap:wrap;gap:10px">
      <div class="row" style="gap:8px;flex-wrap:wrap;align-items:center">
        <button class="btn btn-o btn-sm" ${selN?'':'disabled'} onclick="wg_fillSpecAll()" title="勾选项的全部份一键按规格填入">按规格填入${selN?`（${selN}）`:''}</button>
        <button class="btn btn-p btn-sm" ${selN?'':'disabled'} onclick="wg_submit()">提交称重结果${selN?`（${selN}）`:''}</button>
        <button class="btn btn-o btn-sm" onclick="toast('已导出称重单.xlsx（逐份实发/应发/差异/差额）','ok')">导出称重单</button>
        <button class="btn btn-link btn-sm" onclick="nav('m-pick-label')">🏷️ 去打印标签</button>
      </div>
      <div id="wg-sum" class="row" style="gap:14px;font-size:12.5px;align-items:center"></div>
    </div></div>
    ${cards}`;
  }

  /* ========== 订单详情提示（客户侧以仓库分拣为准） ========== */
  window.weighSection=function(o){
    if(!(o.lines||[]).some(l=>skuMeta(l).weighable))return '';
    return `<div class="ib ib-b" style="margin-top:14px"><span class="i">⚖️</span>本单含<b>按重量定价（多退少补）</b>商品：商家按<b>每份单独称重</b>、按仓库×SKU 汇总发货；<b>本单客户侧多退少补以仓库实际分拣分配的重量为准</b>，在对账/账单中体现，不等于商家发货称重。</div>`;
  };
  /* 供打印标签门禁（pick.js）：某订单行对应的 仓库×SKU 是否已完成逐份称重并提交 */
  window.weighLineState=function(o,l){if(!skuMeta(l).weighable)return 'na';const r=recOf((o.warehouse||'—')+'|'+l.sku);return r&&r.submitted?'done':'wait';};
  window.weighWhPending=function(date,wh){const saved=DB.weighF;DB.weighF={date:date||'',wh:wh||'',st:''};const n=buildRows().filter(r=>r.st=='wait').length;DB.weighF=saved;return n;};
  window.weighRealOf=function(o,l){const r=recOf((o.warehouse||'—')+'|'+l.sku);return r&&r.submitted?r.real:null;};
  window.weighPending=function(){const saved=DB.weighF;DB.weighF={date:'',wh:'',st:''};const n=buildRows().filter(r=>r.st=='wait').length;DB.weighF=saved;return n;};

  PAGES['m-pick-weigh']=()=>{ ensurePickOrders(); const html=view(); setTimeout(()=>{ROWS.forEach((r,i)=>paintCard(i));paintSum();},0); return html; };
})();
