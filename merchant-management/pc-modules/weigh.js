/* PC · 备货管理 > 称重录入（多退少补）—— PAGES['m-pick-weigh']
   口径（2026-07-28 定稿·逐件）：
   - 按重量定价（多退少补=是）的商品按 S$/kg 计价；分装成【每一件（袋）】，一件的【应发净重=规格量】(如 1kg)。
   - 【每一件单独录实发净重】，逐件算 差异/差异率（实发−应发、/应发）；每件一张标签印该件实发净重，不含订单/客户。
   - 归拢维度 = 仓库 × SKU（分组），组内 N 件逐件一行。
   - 【标签序号】每行 = 该件在「打印标签」里的序号（同 仓库×SKU，序号 1–N，与 label_seqModal 的区间一致），
     操作员照袋上标签序号找行录入，避免串行录错。
   - 【两个 Tab · 按件分】待称重＝未提交的件（可编辑）；已称重＝已提交的件（只读复核）。
     提交后该件立刻从「待称重」消失、出现在「已称重」；同一商品的件可同时分处两个页签。
   - 【件级提交】提交粒度 = 单件（标签序号），同一商品可按序号分批提交：称完哪几件就提交哪几件，
     已提交件立即锁定只读，未提交件继续录；整组全部件提交后才解锁该 SKU 的标签打印。
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

  function store(){DB.weigh=DB.weigh||{};return DB.weigh;}                 // {wh|sku:{ws:{i:w},sub:{i:'提交时间'},submitted,amt,real,due,at,by}}
  function recOf(key){return store()[key]||null;}
  function scopeOrders(){return DB.orders.filter(o=>['pending','packed','shipped','received','done'].includes(o.status));}
  function wgDates(){return [...new Set(scopeOrders().map(o=>o.deliver).filter(Boolean))].sort();}
  function wgWhs(){return [...new Set(scopeOrders().map(o=>o.warehouse).filter(Boolean))];}
  function lockedByStatus(o){if(o.status!='done'||!o.doneDate)return false;const d=Date.parse('2026-'+String(o.doneDate).replace(/^2026-/,''));return !isNaN(d)&&(Date.now()-d)/86400000>WG().DAYS;}

  let ROWS=[],ALL=[];   // ALL=当前筛选下全部分组；ROWS=当前 Tab 下的分组。每组 = 一个 仓库×SKU，含 N 件
  function computeGroup(g){
    const rec=store()[g.key],ws=(rec&&rec.ws)||{},sub=(rec&&rec.sub)||{};const ps=[];
    let realSum=0,filled=0,amtSum=0,blocked=0,subN=0,subReal=0,subAmt=0;
    for(let i=0;i<g.portionN;i++){const p=calcPortion(ws[i]==null?'':+ws[i],g.specQty,g.up);p.subd=!!sub[i];ps[i]=p;
      if(p.filled){realSum+=+ws[i];filled++;amtSum+=p.amt;if(p.st=='block')blocked++;
        if(p.subd){subN++;subReal+=+ws[i];subAmt+=p.amt;}}}
    realSum=+realSum.toFixed(2);amtSum=+amtSum.toFixed(2);subReal=+subReal.toFixed(2);subAmt=+subAmt.toFixed(2);
    const allSub=subN>0&&subN==g.portionN;
    let st;if(allSub)st='done';else if(blocked)st='block';else if(filled<g.portionN)st='wait';else st=amtSum>0?'add':(amtSum<0?'refund':'ok');
    return Object.assign(g,{ws,sub,ps,realSum,filled,amtSum,blocked,subN,subReal,subAmt,allSub,st,rec,due:+(g.portionN*g.specQty).toFixed(2)});
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
    return Object.values(agg).map(computeGroup);
  }
  /* Tab 归属按【件】判：未提交件在「待称重」，已提交件即刻移到「已称重」；同一商品的件可分处两页签 */
  function seqNo(pi,n){return '#'+String(pi+1).padStart(String(n).length,'0');}   // 标签序号，与打印标签序号一致
  /* 序号列表压缩成区间文案：[0,1,2,5] → #01–#03、#06 */
  function seqRange(idxs,n){const a=idxs.slice().sort((x,y)=>x-y);const out=[];let s=null,p=null;
    a.forEach(i=>{if(s===null){s=p=i;return;}if(i==p+1){p=i;return;}out.push(s==p?seqNo(s,n):`${seqNo(s,n)}–${seqNo(p,n)}`);s=p=i;});
    if(s!==null)out.push(s==p?seqNo(s,n):`${seqNo(s,n)}–${seqNo(p,n)}`);
    return out.join('、');}

  /* ========== 交互 ========== */
  function setWs(key,i,v){const s=store();s[key]=s[key]||{ws:{}};s[key].ws=Object.assign({},s[key].ws);
    if(v===''||isNaN(v))delete s[key].ws[i];else s[key].ws[i]=+(+v).toFixed(2);
    s[key].at='2026-07-01 08:20';s[key].by=DB.merchant&&DB.merchant.contact||'门店操作员';}
  window.wg_portion=function(gi,pi,v){const r=ROWS[gi];if(!r)return;setWs(r.key,pi,v===''?'':parseFloat(v));computeGroup(r);
    const p=r.ps[pi]||{};                       // 录入即勾选：填出合法值自动进本次提交范围；清空/异常自动移出
    if(p.filled&&p.st!='block'&&!p.subd)pick(r.key,pi,true);else pick(r.key,pi,false);
    paintPortion(gi,pi);paintGroupSum(gi);paintSum();paintBtns();};
  window.wg_fillGroup=function(gi){const r=ROWS[gi];if(!r||r.allSub||r.locked)return;const s=store();s[r.key]=s[r.key]||{ws:{}};s[r.key].ws=Object.assign({},s[r.key].ws);
    let n=0;for(let i=0;i<r.portionN;i++){if(r.sub[i])continue;s[r.key].ws[i]=r.specQty;pick(r.key,i,true);n++;}
    s[r.key].at='2026-07-01 08:20';s[r.key].by=DB.merchant&&DB.merchant.contact||'门店操作员';render();
    toast(`「${r.name}·${r.wh}」${n} 件未提交的按应发 ${r.specQty}${r.unit}/件 填入，可改称出来不一样的件`,'ok');};

  window.wg_tab=function(t){DB.weighF=DB.weighF||{};if(DB.weighF.tab==t)return;DB.weighF.tab=t;DB.weighPick={};render();};
  window.wg_fold=function(key){DB.weighCollapse=DB.weighCollapse||{};DB.weighCollapse[key]=!DB.weighCollapse[key];render();};
  window.wg_foldAll=function(){DB.weighCollapse=DB.weighCollapse||{};const anyOpen=ROWS.some(r=>!DB.weighCollapse[r.key]);ROWS.forEach(r=>DB.weighCollapse[r.key]=anyOpen);render();};

  /* ---- 件级勾选：DB.weighPick = {仓库|SKU:{件下标:true}}，提交粒度=件（标签序号）---- */
  function picks(){DB.weighPick=DB.weighPick||{};return DB.weighPick;}
  function pick(key,i,on){const P=picks();P[key]=P[key]||{};if(on)P[key][i]=true;else delete P[key][i];}
  function isPicked(key,i){return !!((picks()[key]||{})[i]);}
  function selectable(r,pi){return !r.locked&&!r.sub[pi];}                  // 可勾选=未提交且未锁定（未称完的也能先勾）
  function pickedOf(r){const P=picks()[r.key]||{};return Object.keys(P).map(Number).filter(i=>i<r.portionN&&selectable(r,i));}
  function pickedRows(){return ROWS.map(r=>({r,idxs:pickedOf(r)})).filter(x=>x.idxs.length);}
  function pickedN(){return pickedRows().reduce((a,x)=>a+x.idxs.length,0);}
  window.wg_pick=function(gi,pi){const r=ROWS[gi];if(!r||!selectable(r,pi))return;pick(r.key,pi,!isPicked(r.key,pi));render();};
  window.wg_toggle=function(gi){const r=ROWS[gi];if(!r)return;const all=[];for(let i=0;i<r.portionN;i++)if(selectable(r,i))all.push(i);
    const on=all.length&&all.every(i=>isPicked(r.key,i));all.forEach(i=>pick(r.key,i,!on));render();};
  window.wg_selAll=function(){let all=true,any=false;
    ROWS.forEach(r=>{for(let i=0;i<r.portionN;i++)if(selectable(r,i)){any=true;if(!isPicked(r.key,i))all=false;}});
    ROWS.forEach(r=>{for(let i=0;i<r.portionN;i++)if(selectable(r,i))pick(r.key,i,any&&!all);});render();};
  window.wg_fillSpecAll=function(){const rows=pickedRows();if(!rows.length){toast('请先勾选要填入的件（可点商品行的全选）','err');return;}
    const s=store();let n=0;
    rows.forEach(({r,idxs})=>{s[r.key]=s[r.key]||{ws:{}};s[r.key].ws=Object.assign({},s[r.key].ws);
      idxs.forEach(i=>{if(s[r.key].ws[i]==null){s[r.key].ws[i]=r.specQty;n++;}});
      s[r.key].at='2026-07-01 08:20';s[r.key].by=DB.merchant&&DB.merchant.contact||'门店操作员';});
    render();toast(n?`已按应发填入 ${n} 件，可继续改称出来不一样的件`:'勾选的件都已录入，未做改动','ok');};

  window.wg_submit=function(){
    const rows=pickedRows();if(!rows.length){toast('请先勾选要提交的件（按标签序号勾选）','err');return;}
    const empty=rows.reduce((a,x)=>a+x.idxs.filter(i=>!x.r.ps[i].filled).length,0);
    if(empty){toast(`勾选中有 ${empty} 件还没录实发净重，请录完或取消勾选再提交`,'err');return;}
    const bad=rows.reduce((a,x)=>a+x.idxs.filter(i=>x.r.ps[i].st=='block').length,0);
    if(bad){toast(`勾选中有 ${bad} 件超阈值/异常，请按提示复称/重分装后再提交`,'err');return;}
    const lines=rows.map(({r,idxs})=>{const real=+idxs.reduce((a,i)=>a+(+r.ws[i]||0),0).toFixed(2);
      const amt=+idxs.reduce((a,i)=>a+r.ps[i].amt,0).toFixed(2);
      return {r,idxs,real,amt,due:+(idxs.length*r.specQty).toFixed(2),rest:r.portionN-r.subN-idxs.length};});
    const pieces=lines.reduce((a,x)=>a+x.idxs.length,0);
    const total=+lines.reduce((a,x)=>a+x.amt,0).toFixed(2),fee=+(total*SVC).toFixed(2);
    const restAll=lines.reduce((a,x)=>a+x.rest,0);
    modal(`<div class="mc-hd"><h3>提交称重结果 · ${pieces} 件（${lines.length} 个商品）</h3><p>按<b>标签序号</b>逐件提交；提交后这些件的实发净重与差额<b>不可修改</b>，未提交的件可继续录、稍后再提交</p><button class="mc-x" onclick="closeModal()">×</button></div>
    <div class="mc-bd"><div style="overflow-x:auto;max-height:280px"><table style="border:1px solid var(--bd2)"><thead><tr><th>商品</th><th>仓库</th><th style="text-align:right">本次件数</th><th>本次提交标签序号</th><th style="text-align:right">应发合计</th><th style="text-align:right">实发合计</th><th style="text-align:right">差额</th><th style="text-align:right">剩余未提交</th></tr></thead><tbody>
      ${lines.map(x=>`<tr><td><b>${x.r.name}</b></td><td style="font-size:12px">${x.r.wh}</td><td style="text-align:right">${x.idxs.length}</td><td class="mono" style="font-size:12px">${seqRange(x.idxs,x.r.portionN)}</td><td style="text-align:right">${x.due}kg</td><td style="text-align:right"><b>${x.real}kg</b></td>
        <td style="text-align:right">${x.amt?`<b style="color:${x.amt>0?'var(--y)':'var(--r)'}">${x.amt>0?'+':'-'}${money2(Math.abs(x.amt))}</b>`:'<span style="color:var(--ts)">—</span>'}</td>
        <td style="text-align:right;${x.rest?'color:var(--r)':'color:var(--ts)'}">${x.rest?x.rest+' 件':'—'}</td></tr>`).join('')}
      </tbody></table></div>
      <div class="ib ${total>=0?'ib-y':'ib-b'}" style="margin-top:12px"><span class="i">💰</span>本次<b>发货差额</b>合计 <b>${total>0?'+':''}${money2(total)}</b>；平台服务费按实发重算 <b>${total>0?'-':'+'}${money2(Math.abs(fee))}</b>。这是<b>商家↔平台发货结算差额</b>，并入当期对账单。</div>
      ${restAll?`<div class="ib ib-y"><span class="i">🏷️</span>还有 <b>${restAll} 件</b>未提交：<b>整个商品的件全部提交后</b>才解锁该 SKU 的标签打印。</div>`:''}
      <div class="ib ib-b"><span class="i">📦</span>货到仓库由 WMS <b>重新分拣分配</b>到各订单，<b>客户账单多退少补以仓库实际分配为准</b>，不由本次称重决定。</div></div>
    <div class="mc-ft"><button class="btn btn-o" onclick="closeModal()">再改改</button><button class="btn btn-p" onclick="wg_doSubmit()">确认提交</button></div>`);};
  window.wg_doSubmit=function(){
    const rows=pickedRows().map(({r,idxs})=>({r,idxs:idxs.filter(i=>r.ps[i].filled&&r.ps[i].st!='block')})).filter(x=>x.idxs.length);
    const s=store();let total=0,pieces=0,doneN=0;
    rows.forEach(({r,idxs})=>{const rec=s[r.key]=s[r.key]||{ws:{}};rec.sub=Object.assign({},rec.sub);
      idxs.forEach(i=>{rec.sub[i]='2026-07-01 08:20';total+=r.ps[i].amt;pieces++;});
      const g=computeGroup(Object.assign({},r));                              // 用最新提交态重算该组已提交口径
      rec.submitted=g.allSub;rec.amt=g.subAmt;rec.real=g.subReal;rec.due=+(g.subN*r.specQty).toFixed(2);rec.at='2026-07-01 08:20';
      if(g.allSub)doneN++;});
    DB.weighPick={};closeModal();render();
    toast(`已提交 ${pieces} 件，发货差额 ${total>0?'+':''}${money2(+total.toFixed(2))}，并入当期对账单${doneN?`；${doneN} 个商品全部件已提交，已移入「已称重」并解锁标签打印`:'；其余件可继续录入后再提交'}`,'ok');};

  /* ========== 局部重绘 ========== */
  const dcol=v=>v>0?'var(--y)':v<0?'var(--r)':'var(--ts)';
  function paintPortion(gi,pi){const r=ROWS[gi];if(!r)return;const p=r.ps[pi]||{};const has=p.filled;
    const set=(id,html,color)=>{const el=document.getElementById(id);if(el){el.innerHTML=html;if(color!==undefined)el.style.color=color;}};
    set('wg-diff-'+gi+'-'+pi,!has?'—':`${p.diff>0?'+':''}${p.diff} kg`,!has?'var(--tt)':dcol(p.diff));
    set('wg-rate-'+gi+'-'+pi,!has?'—':`${p.diff>0?'+':''}${(p.rate*100).toFixed(1)}%`,!has?'var(--tt)':(p.st=='block'?'var(--r)':dcol(p.diff)));
    set('wg-msg-'+gi+'-'+pi,p.st=='block'&&p.msg?`⚠️ ${p.msg}`:'');
    const inp=document.getElementById('wg-in-'+gi+'-'+pi);if(inp)inp.style.borderColor=p.st=='block'?'var(--r)':'';
    const ck=document.getElementById('wg-ck-'+gi+'-'+pi);if(ck)ck.checked=isPicked(r.key,pi);}
  const amtHtml=v=>`<b style="color:${v>0?'var(--y)':v<0?'var(--r)':'var(--gd)'}">${v?(v>0?'+':'-')+money2(Math.abs(v)):'—'}</b>`;
  function groupSumHtml(r){
    const isTodo=(DB.weighF||{}).tab!='done';const vis=r.vis||[];
    if(!isTodo)  // 已称重页签：只算本页签这些已提交件
      return `已提交 <b style="color:var(--gd)">${vis.length}</b> 件（共 ${r.portionN} 件）· 实发合计 <b>${r.subReal||0}${r.unit}</b> · 差额 ${amtHtml(r.subAmt)}`;
    const fill=vis.filter(i=>r.ps[i].filled).length,amt=+vis.reduce((a,i)=>a+r.ps[i].amt,0).toFixed(2);
    const real=+vis.reduce((a,i)=>a+(+r.ws[i]||0),0).toFixed(2);
    return `待提交 <b>${vis.length}</b> 件（共 ${r.portionN} 件）· 已录 <b>${fill}/${vis.length}</b> · 实发合计 <b>${real}${r.unit}</b> · 差额 ${amtHtml(amt)}${r.blocked?` · <span style="color:var(--r)">${r.blocked} 件异常</span>`:''}${r.subN?` · <span class="tag t-g" style="font-size:10px">已提交 ${r.subN} 件在「已称重」</span>`:''}`;}
  function paintGroupSum(gi){const r=ROWS[gi];if(!r)return;const el=document.getElementById('wg-gsum-'+gi);if(el)el.innerHTML=groupSumHtml(r);}
  function paintBtns(){const n=pickedN();
    const f=document.getElementById('wg-btn-fill'),s=document.getElementById('wg-btn-sub');
    if(f){f.disabled=!n;f.textContent='按应发填入'+(n?`（${n} 件）`:'');}
    if(s){s.disabled=!n;s.textContent='提交勾选件'+(n?`（${n} 件）`:'');}}
  function paintSum(){const el=document.getElementById('wg-sum');if(!el)return;const rows=ROWS,isTodo=(DB.weighF||{}).tab!='done';
    const blocked=rows.reduce((a,r)=>a+r.blocked,0);
    const visP=rows.reduce((a,r)=>a+(r.vis||[]).length,0);                          // 本页签件数
    const noWs=rows.reduce((a,r)=>a+(r.vis||[]).filter(i=>!r.ps[i].filled).length,0);// 本页签未录件数
    const total=+rows.reduce((a,r)=>a+(r.vis||[]).reduce((b,i)=>b+r.ps[i].amt,0),0).toFixed(2);
    el.innerHTML=(isTodo
      ?`<span style="min-width:96px">待称重商品：<b>${rows.length}</b></span><span style="min-width:120px">待提交件：<b style="color:var(--r)">${visP}</b>（未录 ${noWs}）</span>
        <span style="min-width:84px">异常拦截：<b style="color:${blocked?'var(--r)':'var(--ts)'}">${blocked}</b> 件</span>`
      :`<span style="min-width:96px">已称重商品：<b>${rows.length}</b></span><span style="min-width:96px">已提交件：<b style="color:var(--gd)">${visP}</b></span>`)
      +`<span style="min-width:150px">发货差额${isTodo?'（待提交）':'合计'}：${amtHtml(total)}</span>
      <span style="color:var(--ts);font-size:12px">容差 ±${WG().TOL*100}% 不计差额 · 多发超 +${WG().BLOCK_UP*100}% / 少发超 −${WG().BLOCK_DOWN*100}% 拦截</span>`;}

  /* ========== 页面 ========== */
  function view(){
    DB.weighF=DB.weighF||{};DB.weighPick=DB.weighPick||{};
    const f=DB.weighF,dates=wgDates(),whs=wgWhs();
    if(f.date===undefined)f.date=dates[0]||'';
    if(!f.tab)f.tab='todo';
    ALL=buildRows();
    const isTodo=f.tab!='done';
    // 页签按【件】分：未提交件 → 待称重；已提交件 → 已称重。同一商品的件可分处两个页签
    ALL.forEach(r=>{r.vis=[];for(let i=0;i<r.portionN;i++)if(!!r.ps[i].subd==!isTodo)r.vis.push(i);});
    const todoN=ALL.filter(r=>r.portionN-r.subN>0).length,doneN=ALL.filter(r=>r.subN>0).length;
    ROWS=ALL.filter(r=>r.vis.length).filter(r=>!(!isTodo&&f.diffOnly&&!r.subAmt));
    const selN=pickedN();
    let selAllN=0,selAllPicked=0;ROWS.forEach(r=>{for(let i=0;i<r.portionN;i++)if(selectable(r,i)){selAllN++;if(isPicked(r.key,i))selAllPicked++;}});
    const allSel=selAllN&&selAllPicked==selAllN;
    const opt=(cur,list,ph)=>`<option value="">${ph}</option>`+list.map(v=>`<option ${cur==v?'selected':''}>${v}</option>`).join('');
    const CO=DB.weighCollapse||{};
    const bodyHtml=ROWS.length?ROWS.map((g,gi)=>{const lock=g.locked,collapsed=!!CO[g.key];
      const gSel=[];for(let i=0;i<g.portionN;i++)if(selectable(g,i))gSel.push(i);
      const gAll=gSel.length&&gSel.every(i=>isPicked(g.key,i)),gSome=!gAll&&gSel.some(i=>isPicked(g.key,i));
      // 分组头（折叠箭头 + 商品 + 单价 + 仓库 + 汇总 + 整组按应发），点箭头/商品名折叠
      const chev=`<span class="wg-fold" onclick="wg_fold('${g.key}')" title="${collapsed?'展开':'收起'}"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="transform:rotate(${collapsed?0:90}deg);transition:.15s"><path d="M9 6l6 6-6 6"/></svg></span>`;
      const head=`<tr class="wg-grp"><td>${isTodo&&gSel.length?`<input type="checkbox" title="全选本商品未提交的件" ${gAll?'checked':''} ${gSome?'data-ind="1"':''} onclick="wg_toggle(${gi})">`:''}</td>
        <td colspan="5"><div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
          <span style="display:inline-flex;align-items:center;gap:6px;cursor:pointer" onclick="wg_fold('${g.key}')">${chev}<b style="font-size:13.5px">${g.name}</b> <span style="color:var(--ts);font-size:11.5px">${money2(g.up)}/${g.unit} · ${g.wh} · 本页签 ${g.vis.length} 件 · 标签序号 <span class="mono">${seqRange(g.vis,g.portionN)}</span></span></span>
          <span id="wg-gsum-${gi}" style="font-size:12px;color:var(--ts)">${groupSumHtml(g)}</span>
          ${!isTodo?`<span style="margin-left:auto;font-size:11.5px;color:var(--gd)">✓ 已提交${g.rec&&g.rec.at?` · ${g.rec.at}`:''}${g.allSub?' · 标签打印已解锁':` · 还有 ${g.portionN-g.subN} 件在「待称重」`}</span>`
            :(lock?`<span style="margin-left:auto;font-size:11.5px;color:var(--ts)">超 ${WG().DAYS} 天已锁定</span>`
            :`<button class="btn btn-link btn-sm" style="margin-left:auto" onclick="wg_fillGroup(${gi})" title="未提交的件按应发 ${g.specQty}${g.unit} 填入">未提交件按应发</button>`)}
        </div></td></tr>`;
      if(collapsed)return head;   // 折叠：只出组头
      // 逐件行：标签序号(=打印标签序号) | 应发(规格量) | 实发[输入] | 差异 | 差异率（只出本页签该出的件）
      const rows=g.vis.map(pi=>{const w=g.ws[pi];const has=w!=null&&w!=='';const p=g.ps[pi]||{};
        const ro=p.subd||lock;                                   // 该件只读：已提交 或 整组已锁定
        const rc=ro
          ?`<td style="text-align:center"><b>${has?w+' '+g.unit:'—'}</b></td>`
          :`<td style="text-align:center"><div class="row" style="gap:8px;justify-content:center;align-items:center;flex-wrap:nowrap;white-space:nowrap"><input id="wg-in-${gi}-${pi}" type="number" step="0.01" min="0" value="${has?w:''}" placeholder="${g.specQty}" oninput="wg_portion(${gi},${pi},this.value)" style="width:96px;text-align:right"></div><div id="wg-msg-${gi}-${pi}" style="font-size:10.5px;color:var(--r);min-height:14px;line-height:14px;margin-top:2px;white-space:nowrap"></div></td>`;
        return `<tr class="wg-pr ${p.st=='block'?'bad':''} ${p.subd?'subd':''}">
          <td>${ro?'':`<input type="checkbox" id="wg-ck-${gi}-${pi}" title="勾选本件参与本次提交" ${isPicked(g.key,pi)?'checked':''} onclick="wg_pick(${gi},${pi})">`}</td>
          <td><span class="wg-seq mono ${p.subd?'done':''}" title="${p.subd?`标签序号 ${seqNo(pi,g.portionN)} · 已提交 ${g.sub[pi]||''}，不可修改`:'标签序号，与「打印标签」上该 SKU 的序号一一对应'}">${p.subd?'✓':''}${seqNo(pi,g.portionN)}</span></td>
          <td style="text-align:right">${g.specQty} ${g.unit}</td>
          ${rc}
          <td id="wg-diff-${gi}-${pi}" style="text-align:right"></td>
          <td id="wg-rate-${gi}-${pi}" style="text-align:right"></td></tr>`;}).join('');
      return head+rows;
    }).join(''):`<tr><td colspan="6"><div class="empty"><div class="e-ic">⚖️</div><div class="e-t">${isTodo?'该筛选下没有待称重的件':'该筛选下还没有已提交的件'}</div><div class="e-s">${isTodo?'仅按重量定价（多退少补=是）的商品需要称重；件全部提交后会移到「已称重」。切换配送日期/仓库看看。':'在「待称重」逐件录入并提交后，该件即刻移到这里，只读复核。'}</div></div></td></tr>`;
    return `
    <style>
    .wg-grp td{background:var(--gl);padding:9px 14px}
    .wg-fold{display:inline-flex;align-items:center;color:var(--gd);flex:0 0 auto}
    .wg-fold:hover{color:var(--g)}
    .wg-pr td{padding:6px 14px}
    .wg-seq{display:inline-flex;align-items:center;justify-content:center;gap:2px;min-width:44px;height:22px;padding:0 8px;border:1px solid var(--bd);border-radius:7px;background:#fff;color:var(--tp);font-size:12px;font-weight:600;letter-spacing:.3px}
    .wg-pr.bad .wg-seq{border-color:var(--r);color:var(--r)}
    .wg-seq.done{border-color:var(--gd);color:var(--gd);background:var(--gl)}
    .wg-pr.subd td{background:#FAFCF9;color:var(--ts)}
    .wg-pr input{border:1px solid var(--bd);border-radius:9px;height:34px;background:#FBFCF9;font-size:13.5px;color:var(--tp);outline:none;transition:.16s}
    .wg-pr input:focus{border-color:var(--g);background:#fff;box-shadow:0 0 0 3px rgba(14,122,82,.12)}
    .wg-pr input::placeholder{color:var(--tt)}
    .wg-pr.bad input{border-color:var(--r);background:var(--rl)}
    </style>
    <div class="ib ib-b" style="margin-bottom:12px"><span class="i">⚖️</span>
      按重量定价（多退少补=是）的商品按 <b>S$/kg</b> 计价、分装成件（<b>一件应发=规格量</b>，如 1kg）；<b>每一件单独称重</b>录实发净重，逐件算差异/差异率，每件一张标签印该件实发净重、<b>不含订单/客户</b>——货到仓库由 WMS 重新分拣分配。发货差额 = Σ各件差额 = <b>商家↔平台发货结算差额</b>；客户账单多退少补以仓库实际分配为准。
      <br><b>录入对位</b>：每行的<b>标签序号</b>＝「打印标签」上该商品（同仓库同 SKU）的序号，按袋上标签序号对行录入；<b>待称重 / 已称重</b>分两个页签，已提交的只读复核，避免录错行、改错单。
      <br><b>按序号分批提交</b>：提交粒度＝<b>单件</b>，同一商品可称完几件先提交几件（勾选对应标签序号即可）。提交后该件<b>立即从「待称重」移入「已称重」</b>并锁定不可改，未提交的件继续留在本页签录；<b>整个商品的件全部提交后</b>才解锁该 SKU 的标签打印。</div>

    <div class="card" style="margin-bottom:14px"><div class="card-bd" style="display:flex;gap:16px;align-items:flex-end;flex-wrap:wrap">
      <div><div style="font-size:12px;color:var(--ts);margin-bottom:5px">配送日期</div><select onchange="DB.weighF.date=this.value;render()" style="min-width:140px">${dates.map(d=>`<option ${f.date==d?'selected':''}>${d}</option>`).join('')||'<option>无</option>'}</select></div>
      <div><div style="font-size:12px;color:var(--ts);margin-bottom:5px">仓库</div><select onchange="DB.weighF.wh=this.value;render()" style="min-width:150px">${opt(f.wh||'',whs,'全部仓库')}</select></div>
      <div><div style="font-size:12px;color:var(--ts);margin-bottom:5px">商品名称</div><input id="wg-name" value="${f.name||''}" placeholder="请输入" onkeydown="if(event.key=='Enter'){DB.weighF.name=this.value.trim();render()}" style="min-width:160px"></div>
      <button class="btn btn-p btn-sm" onclick="DB.weighF.name=(document.getElementById('wg-name')||{}).value.trim();render()">查询</button>
      <button class="btn btn-o btn-sm" onclick="DB.weighF={};DB.weighPick={};render()">重置</button>
    </div></div>

    <div class="card">
    <div class="card-bd" style="padding:0 16px;border-bottom:1px solid var(--bd2)">
      <div class="tabs" style="margin:0;border:none">
        <div class="tab ${isTodo?'active':''}" onclick="wg_tab('todo')">待称重${todoN?`<span class="tb">${todoN}</span>`:''}</div>
        <div class="tab ${isTodo?'':'active'}" onclick="wg_tab('done')">已称重${doneN?`<span class="tb" style="background:var(--gd)">${doneN}</span>`:''}</div>
      </div>
    </div>
    <div class="card-hd" style="flex-wrap:wrap;gap:10px">
      <div class="row" style="gap:8px;flex-wrap:wrap;align-items:center">
        ${isTodo?`<button id="wg-btn-fill" class="btn btn-o btn-sm" ${selN?'':'disabled'} onclick="wg_fillSpecAll()" title="勾选的件按应发一键填入">按应发填入${selN?`（${selN} 件）`:''}</button>
        <button id="wg-btn-sub" class="btn btn-p btn-sm" ${selN?'':'disabled'} onclick="wg_submit()">提交勾选件${selN?`（${selN} 件）`:''}</button>`
        :`<button class="btn btn-o btn-sm" onclick="DB.weighF.diffOnly=!DB.weighF.diffOnly;render()" title="只看结出差额的商品，便于复核对账">${f.diffOnly?'✓ 仅看有差额':'仅看有差额'}</button>`}
        <button class="btn btn-o btn-sm" onclick="toast('已导出称重单.xlsx（标签序号/应发/实发/差异/差额）','ok')">导出称重单</button>
        <button class="btn btn-o btn-sm" onclick="wg_foldAll()">全部折叠 / 展开</button>
        <button class="btn btn-link btn-sm" onclick="nav('m-pick-label')">去打印标签</button>
      </div>
      <div id="wg-sum" class="row" style="gap:14px;font-size:12.5px;align-items:center"></div>
    </div>
    <div class="card-bd flush"><div style="overflow-x:auto"><table style="table-layout:fixed;width:100%;min-width:760px">
      <thead><tr>
        <th style="width:36px">${isTodo&&selAllN?`<input type="checkbox" title="全选本页未提交的件" ${allSel?'checked':''} onclick="wg_selAll()">`:''}</th>
        <th style="width:96px" title="与「打印标签」上该商品的标签序号一一对应">标签序号</th><th style="text-align:right;width:110px">应发净重</th><th style="text-align:center;width:180px">实发净重 (kg)</th>
        <th style="text-align:right;width:110px">差异</th><th style="text-align:right;width:100px">差异率</th>
      </tr></thead><tbody>${bodyHtml}</tbody></table></div></div></div>`;
  }

  /* ========== 订单详情提示 ========== */
  window.weighSection=function(o){
    if(!(o.lines||[]).some(l=>skuMeta(l).weighable))return '';
    return `<div class="ib ib-b" style="margin-top:14px"><span class="i">⚖️</span>本单含<b>按重量定价（多退少补）</b>商品：商家按每件称重、按仓库×SKU 汇总发货；<b>本单客户侧多退少补以仓库实际分拣分配的重量为准</b>，在对账/账单中体现，不等于商家发货称重。</div>`;
  };
  window.weighLineState=function(o,l){if(!skuMeta(l).weighable)return 'na';const r=recOf((o.warehouse||'—')+'|'+l.sku);return r&&r.submitted?'done':'wait';};
  // 未完成称重 = 该组还有件没提交（含全填未提交、部分提交）——标签打印/送货单门禁按整组是否全部提交判
  window.weighWhPending=function(date,wh){const saved=DB.weighF;DB.weighF={date:date||'',wh:wh||'',st:''};const n=buildRows().filter(r=>!r.allSub).length;DB.weighF=saved;return n;};
  window.weighRealOf=function(o,l){const r=recOf((o.warehouse||'—')+'|'+l.sku);return r&&r.submitted?r.real:null;};
  window.weighPending=function(){const saved=DB.weighF;DB.weighF={date:'',wh:'',st:''};const n=buildRows().filter(r=>!r.allSub).length;DB.weighF=saved;return n;};

  PAGES['m-pick-weigh']=()=>{ ensurePickOrders(); const html=view(); setTimeout(()=>{ROWS.forEach((g,gi)=>{for(let pi=0;pi<g.portionN;pi++)paintPortion(gi,pi);paintGroupSum(gi);});paintSum();paintBtns();
    document.querySelectorAll('[data-ind="1"]').forEach(el=>{el.indeterminate=true;});},0); return html; };
})();
