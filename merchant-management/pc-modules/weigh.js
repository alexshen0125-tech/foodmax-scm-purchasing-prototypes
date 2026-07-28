/* PC · 备货管理 > 称重录入（多退少补）—— PAGES['m-pick-weigh']
   口径（2026-07-28 定稿）：
   - 商家按【每件商品（仓库×SKU）一行】录一个【实发净重】、对一个【应发净重】，
     差异/差异率按该行算；不含订单/客户——货到仓库(DC)由 WMS 重新分拣分配到各订单。
   - 应发净重 = 件数 × 规格量；差异 = 实发 − 应发；差异率 = 差异 / 应发。
   - 发货差额 =（实发 − 应发）× S$/kg = 商家↔平台【发货结算差额】。
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

  /* 该行差额：实发合计 vs 应发净重（件数×规格量） */
  function calc(due,up,real){
    const g=WG();
    if(real===''||real===null||real===undefined||isNaN(real))return {st:'wait',due,up,diff:0,ratio:0,amt:0};
    const diff=+(real-due).toFixed(2),ratio=due?diff/due:0;
    if(real<=0)return {st:'block',due,up,diff,ratio,amt:0,msg:'实发净重必须 > 0'};
    if(ratio>g.BLOCK_UP)return {st:'block',due,up,diff,ratio,amt:0,msg:`多发超 +${g.BLOCK_UP*100}%，请重分装`};
    if(ratio<-g.BLOCK_DOWN)return {st:'block',due,up,diff,ratio,amt:0,msg:`少发超 −${g.BLOCK_DOWN*100}%，请复称`};
    if(Math.abs(ratio)<=g.TOL)return {st:'ok',due,up,diff,ratio,amt:0};
    if(diff<0)return {st:'refund',due,up,diff,ratio,amt:+(diff*up).toFixed(2)};
    return {st:'add',due,up,diff,ratio,amt:+(diff*up).toFixed(2)};
  }

  function store(){DB.weigh=DB.weigh||{};return DB.weigh;}                 // {wh|sku:{real,submitted,amt,due,diff,at,by}}
  function recOf(key){return store()[key]||null;}

  function scopeOrders(){return DB.orders.filter(o=>['pending','packed','shipped','received','done'].includes(o.status));}
  function wgDates(){return [...new Set(scopeOrders().map(o=>o.deliver).filter(Boolean))].sort();}
  function wgWhs(){return [...new Set(scopeOrders().map(o=>o.warehouse).filter(Boolean))];}
  function lockedByStatus(o){if(o.status!='done'||!o.doneDate)return false;const d=Date.parse('2026-'+String(o.doneDate).replace(/^2026-/,''));return !isNaN(d)&&(Date.now()-d)/86400000>WG().DAYS;}

  let ROWS=[];
  function buildRows(){
    DB.weighF=DB.weighF||{};const f=DB.weighF;const agg={};
    scopeOrders().forEach(o=>{
      if(f.date&&o.deliver!=f.date)return;if(f.wh&&o.warehouse!=f.wh)return;
      (o.lines||[]).forEach(l=>{const m=skuMeta(l);if(!m.weighable)return;
        if(f.name&&!((l.name||'').includes(f.name))&&!((l.sku||'').includes(f.name)))return;
        const wh=o.warehouse||'—',key=wh+'|'+l.sku;
        if(!agg[key])agg[key]={key,wh,sku:l.sku,name:l.name,unit:m.unit,specQty:m.specQty,up:kgPrice(l),qty:0,locked:false};
        agg[key].qty+=(+l.qty||0);
        if(lockedByStatus(o))agg[key].locked=true;});
    });
    const out=Object.values(agg).map(g=>{g.due=+(g.qty*g.specQty).toFixed(2);
      const r=store()[g.key],real=r?r.real:'';const c=calc(g.due,g.up,real);
      return Object.assign(g,{real,c,st:(r&&r.submitted)?'done':c.st,rec:r});});
    return out.filter(r=>{
      if(f.st=='wait'&&r.st!='wait')return false;
      if(f.st=='diff'&&!['add','refund'].includes(r.st))return false;
      if(f.st=='done'&&r.st!='done')return false;return true;});
  }

  /* ========== 交互 ========== */
  window.wg_input=function(idx,v){const r=ROWS[idx];if(!r)return;const val=v===''?'':parseFloat(v);const s=store();
    if(val===''||isNaN(val))delete s[r.key];else s[r.key]=Object.assign({},s[r.key],{real:+val.toFixed(2),at:'2026-07-01 08:20',by:DB.merchant&&DB.merchant.contact||'门店操作员'});
    r.real=val;r.c=calc(r.due,r.up,val===''?'':val);r.st=(s[r.key]&&s[r.key].submitted)?'done':r.c.st;paintRow(idx);paintSum();};
  window.wg_useDue=function(idx){const r=ROWS[idx];if(!r)return;const el=document.getElementById('wg-in-'+idx);if(el)el.value=r.due;wg_input(idx,String(r.due));};

  window.wg_toggle=function(idx){DB.weighSel=DB.weighSel||[];const k=ROWS[idx].key;const i=DB.weighSel.indexOf(k);if(i<0)DB.weighSel.push(k);else DB.weighSel.splice(i,1);render();};
  window.wg_selAll=function(){DB.weighSel=DB.weighSel||[];const keys=ROWS.filter(r=>r.st!='done'&&!r.locked).map(r=>r.key);const all=keys.length&&keys.every(k=>DB.weighSel.includes(k));DB.weighSel=all?[]:keys.slice();render();};
  function selRows(){const sel=DB.weighSel||[];return ROWS.filter(r=>sel.includes(r.key)&&r.st!='done'&&!r.locked);}
  window.wg_batchDue=function(){const rows=selRows();if(!rows.length){toast('请先勾选要确认的行','err');return;}
    const s=store();rows.forEach(r=>{s[r.key]=Object.assign({},s[r.key],{real:r.due,at:'2026-07-01 08:20',by:DB.merchant&&DB.merchant.contact||'门店操作员'});});
    render();toast(`已按应发净重填入 ${rows.length} 行，可继续修改有差异的行`,'ok');};

  window.wg_submit=function(){
    const rows=selRows().filter(r=>r.real!==''&&!isNaN(r.real));
    if(!rows.length){toast('请先勾选并录入实发净重','err');return;}
    const bad=rows.filter(r=>r.c.st=='block');
    if(bad.length){toast(`${bad.length} 行差异超限被拦截，请按行内提示复称/重分装后再提交`,'err');return;}
    const add=rows.filter(r=>r.c.st=='add'),ref=rows.filter(r=>r.c.st=='refund');
    const total=+rows.reduce((a,r)=>a+r.c.amt,0).toFixed(2),fee=+(total*SVC).toFixed(2);
    modal(`<div class="mc-hd"><h3>提交称重结果 · ${rows.length} 项</h3><p>提交后实发净重与差额<b>不可修改</b>；标签按实发净重打印</p><button class="mc-x" onclick="closeModal()">×</button></div>
    <div class="mc-bd"><div style="overflow-x:auto;max-height:280px"><table style="border:1px solid var(--bd2)"><thead><tr><th>商品</th><th>仓库</th><th style="text-align:right">应发净重</th><th style="text-align:right">实发净重</th><th style="text-align:right">差异</th><th style="text-align:right">差异率</th><th style="text-align:right">差额</th></tr></thead><tbody>
      ${rows.map(r=>`<tr><td><b>${r.name}</b></td><td style="font-size:12px">${r.wh}</td><td style="text-align:right">${r.c.due}kg</td><td style="text-align:right"><b>${r.real}kg</b></td>
        <td style="text-align:right;color:${r.c.diff>0?'var(--y)':r.c.diff<0?'var(--r)':'var(--ts)'}">${r.c.diff>0?'+':''}${r.c.diff}kg</td>
        <td style="text-align:right;color:${r.c.diff>0?'var(--y)':r.c.diff<0?'var(--r)':'var(--ts)'}">${r.c.diff>0?'+':''}${(r.c.ratio*100).toFixed(1)}%</td>
        <td style="text-align:right">${r.c.amt?`<b style="color:${r.c.amt>0?'var(--y)':'var(--r)'}">${r.c.amt>0?'+':'-'}${money2(Math.abs(r.c.amt))}</b>`:'<span style="color:var(--ts)">—</span>'}</td></tr>`).join('')}
      </tbody></table></div>
      <div class="ib ${total>=0?'ib-y':'ib-b'}" style="margin-top:12px"><span class="i">💰</span>本次<b>发货差额</b>合计 <b>${total>0?'+':''}${money2(total)}</b>（多发 ${add.length} / 少发 ${ref.length}）；平台服务费按实发重算 <b>${total>0?'-':'+'}${money2(Math.abs(fee))}</b>。这是<b>商家↔平台发货结算差额</b>，并入当期对账单。</div>
      <div class="ib ib-b"><span class="i">📦</span>货到仓库由 WMS <b>重新分拣分配</b>到各订单，<b>客户账单多退少补以仓库实际分配为准</b>，不由本次称重决定。</div></div>
    <div class="mc-ft"><button class="btn btn-o" onclick="closeModal()">再改改</button><button class="btn btn-p" onclick="wg_doSubmit()">确认提交</button></div>`);};
  window.wg_doSubmit=function(){const rows=selRows().filter(r=>r.real!==''&&!isNaN(r.real)&&r.c.st!='block');const s=store();let total=0;
    rows.forEach(r=>{s[r.key]=Object.assign({},s[r.key],{submitted:true,amt:r.c.amt,due:r.c.due,diff:r.c.diff,at:'2026-07-01 08:20'});total+=r.c.amt;});
    DB.weighSel=[];closeModal();render();toast(`已提交 ${rows.length} 项，发货差额合计 ${total>0?'+':''}${money2(+total.toFixed(2))}，并入当期对账单`,'ok');};

  /* ========== 局部重绘 ========== */
  function paintRow(idx){const r=ROWS[idx];if(!r)return;const c=r.c;
    const set=(id,html,color)=>{const el=document.getElementById(id);if(el){el.innerHTML=html;if(color)el.style.color=color;}};
    const col=c.diff>0?'var(--y)':c.diff<0?'var(--r)':'var(--ts)';
    set('wg-diff-'+idx,c.st=='wait'?'—':`${c.diff>0?'+':''}${c.diff} kg`,col);
    set('wg-rate-'+idx,c.st=='wait'?'—':`${c.diff>0?'+':''}${(c.ratio*100).toFixed(1)}%`,(c.ratio>WG().BLOCK_UP||c.ratio<-WG().BLOCK_DOWN)?'var(--r)':col);
    set('wg-msg-'+idx,c.msg||'');
    const inp=document.getElementById('wg-in-'+idx);if(inp)inp.style.borderColor=c.st=='block'?'var(--r)':'';}
  function paintSum(){const el=document.getElementById('wg-sum');if(!el)return;const rows=ROWS;
    const wait=rows.filter(r=>r.st=='wait').length,blocked=rows.filter(r=>r.c.st=='block').length;
    const total=+rows.reduce((a,r)=>a+(r.c.amt||0),0).toFixed(2);
    el.innerHTML=`<span style="min-width:78px">可称重行：<b>${rows.length}</b></span><span style="min-width:70px">待称重：<b style="color:var(--r)">${wait}</b></span>
      <span style="min-width:84px">超限拦截：<b style="color:${blocked?'var(--r)':'var(--ts)'}">${blocked}</b></span>
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
    const bodyHtml=ROWS.length?ROWS.map((r,i)=>{const done=r.st=='done',lock=r.locked;
      return `<tr>
        <td>${done||lock?'':`<input type="checkbox" ${(DB.weighSel||[]).includes(r.key)?'checked':''} onclick="wg_toggle(${i})">`}</td>
        <td style="white-space:nowrap"><b>${r.name}</b> <span style="color:var(--ts);font-size:11.5px">${r.specQty}${r.unit}/件</span><div style="font-size:11.5px;color:var(--ts)">${r.wh}</div></td>
        <td style="text-align:right">${r.qty}</td>
        <td style="text-align:right"><b>${r.due}</b> kg</td>
        <td style="text-align:center">${done||lock
          ?`<b>${r.real} kg</b><div style="font-size:10.5px;line-height:15px;min-height:15px;margin-top:3px;color:${lock?'var(--ts)':'var(--gd)'}">${lock?`超 ${WG().DAYS} 天已锁定`:'✓ 已提交'}</div>`
          :`<div class="row" style="gap:8px;justify-content:center;align-items:center;flex-wrap:nowrap;white-space:nowrap">
              <input id="wg-in-${i}" type="number" step="0.01" min="0" value="${r.real===''?'':r.real}" placeholder="请输入" oninput="wg_input(${i},this.value)" style="width:100px;text-align:right">
              <button class="btn btn-link btn-sm" title="称出来与应发一致时，一键填入 ${r.due} kg" onclick="wg_useDue(${i})">按应发</button>
            </div>
            <div id="wg-msg-${i}" style="font-size:10.5px;color:var(--r);margin-top:3px;min-height:15px;line-height:15px;white-space:nowrap;overflow:hidden"></div>`}</td>
        <td id="wg-diff-${i}" style="text-align:right"></td>
        <td id="wg-rate-${i}" style="text-align:right"></td>
      </tr>`;}).join(''):`<tr><td colspan="7"><div class="empty"><div class="e-ic">⚖️</div><div class="e-t">该筛选下没有需要称重的商品</div><div class="e-s">仅按重量定价（多退少补=是）的商品需要称重；切换配送日期/仓库看看。</div></div></td></tr>`;
    return `
    <div class="ib ib-b" style="margin-bottom:12px"><span class="i">⚖️</span>
      按重量定价（多退少补=是）的商品，每件商品录一个<b>实发净重</b>、对一个<b>应发净重</b>（件数×规格量），差异/差异率按该行算；<b>不含订单/客户</b>——货到仓库由 WMS 重新分拣分配。
      发货差额 =（实发 − 应发）× S$/kg，是<b>商家↔平台发货结算差额</b>；客户账单多退少补以仓库实际分配为准。</div>

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
        <button class="btn btn-o btn-sm" ${selN?'':'disabled'} onclick="wg_batchDue()" title="勾选行一键按应发净重填入，只手改称出来不一样的行">按应发填入${selN?`（${selN}）`:''}</button>
        <button class="btn btn-p btn-sm" ${selN?'':'disabled'} onclick="wg_submit()">提交称重结果${selN?`（${selN}）`:''}</button>
        <button class="btn btn-o btn-sm" onclick="toast('已导出称重单.xlsx（应发/实发/差异/差额）','ok')">导出称重单</button>
        <button class="btn btn-link btn-sm" onclick="nav('m-pick-label')">去打印标签</button>
      </div>
      <div id="wg-sum" class="row" style="gap:14px;font-size:12.5px;align-items:center"></div>
    </div>
    <div class="card-bd flush"><div style="overflow-x:auto"><table style="table-layout:fixed;width:100%;min-width:820px">
      <thead><tr>
        <th style="width:36px"><input type="checkbox" title="全选可称重行" ${allSel?'checked':''} onclick="wg_selAll()"></th>
        <th style="width:200px">商品（规格）</th><th style="text-align:right;width:74px">件数</th>
        <th style="text-align:right;width:110px">应发净重</th><th style="text-align:center;width:200px">实发净重 (kg)</th>
        <th style="text-align:right;width:104px">差异</th><th style="text-align:right;width:96px">差异率</th>
      </tr></thead><tbody>${bodyHtml}</tbody></table></div></div></div>`;
  }

  /* ========== 订单详情提示（客户侧以仓库分拣为准） ========== */
  window.weighSection=function(o){
    if(!(o.lines||[]).some(l=>skuMeta(l).weighable))return '';
    return `<div class="ib ib-b" style="margin-top:14px"><span class="i">⚖️</span>本单含<b>按重量定价（多退少补）</b>商品：商家按每件商品称重、按仓库×SKU 汇总发货；<b>本单客户侧多退少补以仓库实际分拣分配的重量为准</b>，在对账/账单中体现，不等于商家发货称重。</div>`;
  };
  window.weighLineState=function(o,l){if(!skuMeta(l).weighable)return 'na';const r=recOf((o.warehouse||'—')+'|'+l.sku);return r&&r.submitted?'done':'wait';};
  window.weighWhPending=function(date,wh){const saved=DB.weighF;DB.weighF={date:date||'',wh:wh||'',st:''};const n=buildRows().filter(r=>r.st=='wait').length;DB.weighF=saved;return n;};
  window.weighRealOf=function(o,l){const r=recOf((o.warehouse||'—')+'|'+l.sku);return r&&r.submitted?r.real:null;};
  window.weighPending=function(){const saved=DB.weighF;DB.weighF={date:'',wh:'',st:''};const n=buildRows().filter(r=>r.st=='wait').length;DB.weighF=saved;return n;};

  PAGES['m-pick-weigh']=()=>{ ensurePickOrders(); const html=view(); setTimeout(()=>{ROWS.forEach((r,i)=>paintRow(i));paintSum();},0); return html; };
})();
