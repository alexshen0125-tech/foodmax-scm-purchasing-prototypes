/* PC · 备货管理 > 称重录入（多退少补）—— PAGES['m-pick-weigh']
   场景：非标生鲜按【重量定价】(S$/kg)，下单按预估净重锁价，商家分装时自己过秤录【实发净重】，
        差额 = (实发净重 − 应发净重) × S$/kg，随当期对账单多退少补。
   颗粒度：订单 × SKU 一行（差额必须落到订单行，跨订单汇总层算不出差额）。
   复用主文件全局：DB / PAGES / render / toast / modal / closeModal / money / ord_mask / lineCat / catPathName。
   阈值集中在 WG 常量，改这里即改全局口径。 */
(function(){
  /* ========== 业务口径常量（BR 对应值，评审改这里） ========== */
  const WG={
    TOL:0.02,     // BR-04 容差：|差异率| ≤ 2% 视为正常损耗，不产生差额
    CAP:0.05,     // BR-05 补款封顶：多发超过 +5% 的部分不计补款
    BLOCK:0.20,   // BR-06 异常拦截：|差异率| > 20% 或实发=0，禁止提交
    DAYS:7,       // BR-09 配送完成后 7 天不可再录入/修改
    SVC:0.05,     // BR-08 平台服务费率（差额同步重算佣金）
  };
  const money2=v=>(typeof money=='function'?money(v):'S$'+(+v||0).toFixed(2));

  /* ========== SKU 口径解析：是否多退少补 + 规格净重 + S$/kg ========== */
  // 订单行 sku 编码与商品库历史不一致，按商品名匹配（与 pick.js specLabel 同口径）
  function prodOf(l){return DB.products.find(x=>x.name==l.name);}
  function skuMeta(l){
    const p=prodOf(l),s=p&&p.skus&&p.skus[0];
    const specQty=s&&s.qty>0?s.qty:1;                       // 规格数量：1 表示 1kg/件
    const unit=(p&&p.unit)||'kg';
    const weighable=!!(s?s.refund:1)&&['kg','g'].includes(unit); // BR-01 门控：多退少补=是 且 计量单位为重量
    return {weighable,specQty,unit,why:s&&!s.refund?'定重预包装 · 按件计价':(!['kg','g'].includes(unit)?'非重量计价单位':'')};
  }
  function dueW(l){return +(l.qty*skuMeta(l).specQty).toFixed(2);}   // 应发净重 kg = 件数 × 规格净重(每件预估净重)
  // 单价口径：多退少补 SKU 按重量定价，price 本身即 S$/计量单位（规格 5kg/箱 也填 6.20/kg，整箱预估 31.00）；
  // 非多退少补 SKU 按整规格计价，折算成 S$/kg 仅用于对照展示。
  function kgPrice(l){const m=skuMeta(l);return +(m.weighable?l.price:l.price/m.specQty).toFixed(2);}

  /* ========== 行差额计算（BR-04/05/06/07） ========== */
  function calc(l,real){
    const due=dueW(l),up=kgPrice(l);
    if(real===''||real===null||real===undefined||isNaN(real))return {st:'wait',due,up,diff:0,ratio:0,amt:0};
    const diff=+(real-due).toFixed(2),ratio=due?diff/due:0;
    if(real<=0)return {st:'block',due,up,diff,ratio,amt:0,msg:'实发净重必须 > 0'};
    if(Math.abs(ratio)>WG.BLOCK)return {st:'block',due,up,diff,ratio,amt:0,msg:`差异 ${(ratio*100).toFixed(1)}% 超 ±${WG.BLOCK*100}%，请复称`};
    if(Math.abs(ratio)<=WG.TOL)return {st:'ok',due,up,diff,ratio,amt:0};                 // 正常损耗，不产生差额
    if(diff<0)return {st:'refund',due,up,diff,ratio,amt:+(diff*up).toFixed(2)};          // 少发：全额退客户
    const capped=ratio>WG.CAP;                                                            // 多发：按 +5% 封顶补款
    return {st:'add',due,up,diff,ratio,capped,amt:+(Math.min(ratio,WG.CAP)*due*up).toFixed(2)};
  }
  const ST={wait:['待称重','t-gr'],ok:['正常损耗','t-b'],add:['补款','t-y'],refund:['退款','t-pp'],block:['超限拦截','t-r'],done:['已提交','t-g']};

  /* ========== 数据存取 ========== */
  function store(){DB.weigh=DB.weigh||{};return DB.weigh;}                 // {orderId|sku:{real,at,by,submitted,amt,due,diff,photo}}
  function keyOf(o,l){return o.id+'|'+l.sku;}
  function recOf(o,l){return store()[keyOf(o,l)]||null;}
  function submitted(o,l){const r=recOf(o,l);return !!(r&&r.submitted);}
  function lockedOf(o){                                                     // BR-09 时限
    if(o.status!='done'||!o.doneDate)return false;
    const d=Date.parse('2026-'+String(o.doneDate).replace(/^2026-/,''));
    return !isNaN(d)&&(Date.now()-d)/86400000>WG.DAYS;
  }

  /* ========== 行集合 ========== */
  function scopeOrders(){return DB.orders.filter(o=>['pending','packed','shipped','received','done'].includes(o.status));}
  function wgDates(){return [...new Set(scopeOrders().map(o=>o.deliver).filter(Boolean))].sort();}
  function wgWhs(){return [...new Set(scopeOrders().map(o=>o.warehouse).filter(Boolean))];}
  let ROWS=[];                                                              // 渲染态：DOM 用下标引用，避免 # | 进 id
  function buildRows(){
    DB.weighF=DB.weighF||{};const f=DB.weighF;
    const out=[];
    scopeOrders().forEach(o=>{
      if(f.date&&o.deliver!=f.date)return;
      if(f.wh&&o.warehouse!=f.wh)return;
      if(f.client&&!ord_mask(o.client).includes(f.client)&&!o.client.includes(f.client))return;
      (o.lines||[]).forEach(l=>{
        if(f.name&&!((l.name||'').includes(f.name))&&!((l.sku||'').includes(f.name)))return;
        const m=skuMeta(l),r=recOf(o,l);
        if(!m.weighable)return;                    // 定重预包装/非重量单位：不需要称重，不进本列表
        const real=r?r.real:'';
        const c=calc(l,m.weighable?real:'');
        const st=!m.weighable?'na':(r&&r.submitted?'done':c.st);
        if(f.st=='wait'&&!(m.weighable&&st=='wait'))return;
        if(f.st=='diff'&&!['add','refund'].includes(st))return;
        if(f.st=='done'&&st!='done')return;
        out.push({o,l,m,c,st,real,rec:r,locked:lockedOf(o)});
      });
    });
    return out;
  }

  /* ========== 交互：录入 / 一键按应发 / 毛重换算 / 提交 ========== */
  // 行内输入：只改本行 DOM + 底部汇总，不整页重渲染（保输入焦点）
  window.wg_input=function(idx,v){
    const r=ROWS[idx];if(!r)return;
    const val=v===''?'':parseFloat(v);
    const s=store(),k=keyOf(r.o,r.l);
    if(val===''||isNaN(val)){delete s[k];}
    else{s[k]=Object.assign({},s[k],{real:+val.toFixed(2),at:'2026-07-01 08:20',by:DB.merchant&&DB.merchant.contact||'门店操作员'});}
    r.real=val;r.c=calc(r.l,val===''?'':val);r.st=(s[k]&&s[k].submitted)?'done':r.c.st;
    paintRow(idx);paintSum();
  };
  window.wg_useDue=function(idx){const r=ROWS[idx];if(!r)return;const el=document.getElementById('wg-in-'+idx);if(el)el.value=r.c.due||dueW(r.l);wg_input(idx,String(dueW(r.l)));};
  window.wg_photo=function(idx){const r=ROWS[idx];const s=store(),k=keyOf(r.o,r.l);s[k]=Object.assign({real:''},s[k],{photo:!(s[k]&&s[k].photo)});render();toast(s[k].photo?'已附磅单照片（演示）':'已移除磅单照片','ok');};

  /* 勾选 + 批量（按钮常驻，未选置灰） */
  window.wg_toggle=function(idx){DB.weighSel=DB.weighSel||[];const r=ROWS[idx];const k=keyOf(r.o,r.l);const i=DB.weighSel.indexOf(k);if(i<0)DB.weighSel.push(k);else DB.weighSel.splice(i,1);render();};
  window.wg_selAll=function(){DB.weighSel=DB.weighSel||[];const keys=ROWS.filter(r=>r.st!='done'&&!r.locked).map(r=>keyOf(r.o,r.l));
    const all=keys.length&&keys.every(k=>DB.weighSel.includes(k));DB.weighSel=all?[]:keys.slice();render();};
  function selRows(){const sel=DB.weighSel||[];return ROWS.filter(r=>sel.includes(keyOf(r.o,r.l))&&r.st!='done'&&!r.locked);}
  // 批量按应发确认：80% 的行称出来就是应发，一键填平，只手动改有差异的（交互自检 #3/#5）
  window.wg_batchDue=function(){const rows=selRows();if(!rows.length){toast('请先勾选要确认的行','err');return;}
    const s=store();rows.forEach(r=>{s[keyOf(r.o,r.l)]=Object.assign({},s[keyOf(r.o,r.l)],{real:dueW(r.l),at:'2026-07-01 08:20',by:DB.merchant&&DB.merchant.contact||'门店操作员'});});
    render();toast(`已按应发净重填入 ${rows.length} 行，可继续修改有差异的行`,'ok');};
  window.wg_submit=function(){
    const rows=selRows().filter(r=>r.real!==''&&!isNaN(r.real));
    if(!rows.length){toast('请先勾选并录入实发净重','err');return;}
    const bad=rows.filter(r=>r.c.st=='block');
    if(bad.length){toast(`${bad.length} 行差异超 ±${WG.BLOCK*100}%，请复称后再提交`,'err');return;}
    const add=rows.filter(r=>r.c.st=='add'),ref=rows.filter(r=>r.c.st=='refund');
    const total=+rows.reduce((a,r)=>a+r.c.amt,0).toFixed(2);
    const fee=+(total*WG.SVC).toFixed(2);
    modal(`<div class="mc-hd"><h3>提交称重结果 · ${rows.length} 行</h3><p>提交后本次实发净重与差额<b>不可修改</b>；标签将按实发净重打印</p><button class="mc-x" onclick="closeModal()">×</button></div>
    <div class="mc-bd">
      <div style="overflow-x:auto;max-height:280px"><table style="border:1px solid var(--bd2)"><thead><tr><th>订单</th><th>商品</th><th style="text-align:right">应发</th><th style="text-align:right">实发</th><th style="text-align:right">差异</th><th style="text-align:right">差额</th></tr></thead><tbody>
      ${rows.map(r=>`<tr><td class="mono" style="font-size:11.5px">${r.o.id}</td><td>${r.l.name}</td><td style="text-align:right">${r.c.due}kg</td><td style="text-align:right"><b>${r.real}kg</b></td>
        <td style="text-align:right;color:${r.c.diff>0?'var(--y)':r.c.diff<0?'var(--r)':'var(--ts)'}">${r.c.diff>0?'+':''}${r.c.diff}kg</td>
        <td style="text-align:right">${r.c.amt?`<b style="color:${r.c.amt>0?'var(--y)':'var(--r)'}">${r.c.amt>0?'+':'-'}${money2(Math.abs(r.c.amt))}</b>${r.c.capped?'<div style="font-size:10.5px;color:var(--ts)">已按 +'+WG.CAP*100+'% 封顶</div>':''}`:'<span style="color:var(--ts)">—</span>'}</td></tr>`).join('')}
      </tbody></table></div>
      <div class="ib ${total>=0?'ib-y':'ib-b'}" style="margin-top:12px"><span class="i">💰</span>
        本次差额合计 <b>${total>0?'+':''}${money2(total)}</b>（补款 ${add.length} 行 / 退款 ${ref.length} 行）；
        平台服务费按实发重算 <b>${total>0?'-':'+'}${money2(Math.abs(fee))}</b>，净收入变动 <b>${total>0?'+':''}${money2(total-fee)}</b>。
        账期客户并入<b>当期对账单</b>一次清算，现结客户补款走支付、退款原路退回。</div>
      <div class="ib ib-b"><span class="i">🔍</span>送货交接时平台按比例抽检复称，与报重偏差 > 3% 以平台复称为准，并计入商家质量分。</div>
    </div>
    <div class="mc-ft"><button class="btn btn-o" onclick="closeModal()">再改改</button><button class="btn btn-p" onclick="wg_doSubmit()">确认提交</button></div>`);};
  window.wg_doSubmit=function(){
    const rows=selRows().filter(r=>r.real!==''&&!isNaN(r.real)&&r.c.st!='block');
    const s=store();let total=0;
    rows.forEach(r=>{const k=keyOf(r.o,r.l);s[k]=Object.assign({},s[k],{submitted:true,amt:r.c.amt,due:r.c.due,diff:r.c.diff,at:'2026-07-01 08:20'});total+=r.c.amt;
      r.o.diffAmount=+((r.o.diffAmount||0)+r.c.amt).toFixed(2);
      // 线上 diffPayStatus：0未录入 1已录补款未支付 2补款已支付 3已录退款未退 4已退款
      r.o.diffPayStatus=r.o.diffAmount>0?1:(r.o.diffAmount<0?3:0);});
    DB.weighSel=[];closeModal();render();
    toast(`已提交 ${rows.length} 行称重结果，差额合计 ${total>0?'+':''}${money2(+total.toFixed(2))}，并入当期对账单`,'ok');};

  /* ========== 局部重绘 ========== */
  function paintRow(idx){
    const r=ROWS[idx];if(!r)return;
    const c=r.c;
    const set=(id,html,color)=>{const el=document.getElementById(id);if(el){el.innerHTML=html;if(color)el.style.color=color;}};
    set('wg-diff-'+idx,c.st=='wait'?'—':`${c.diff>0?'+':''}${c.diff} kg`,c.diff>0?'var(--y)':c.diff<0?'var(--r)':'var(--ts)');
    set('wg-rate-'+idx,c.st=='wait'?'—':`${(c.ratio*100).toFixed(1)}%`,Math.abs(c.ratio)>WG.BLOCK?'var(--r)':'var(--ts)');
    set('wg-amt-'+idx,c.amt?`<b>${c.amt>0?'+':'-'}${money2(Math.abs(c.amt))}</b>${c.capped?`<div style="font-size:10.5px;color:var(--ts)">+${WG.CAP*100}% 封顶</div>`:''}`:'—',c.amt>0?'var(--y)':c.amt<0?'var(--r)':'var(--ts)');
    const t=ST[r.st]||ST.wait;
    set('wg-st-'+idx,`<span class="tag ${t[1]}">${t[0]}</span>${c.msg?`<div style="font-size:10.5px;color:var(--r);margin-top:2px">${c.msg}</div>`:''}`);
    const inp=document.getElementById('wg-in-'+idx);if(inp)inp.style.borderColor=c.st=='block'?'var(--r)':'';
  }
  function paintSum(){
    const el=document.getElementById('wg-sum');if(!el)return;
    const rows=ROWS;
    const wait=rows.filter(r=>r.st=='wait').length,blocked=rows.filter(r=>r.c.st=='block').length;
    const total=+rows.reduce((a,r)=>a+(r.c.amt||0),0).toFixed(2);
    el.innerHTML=`<span>可称重行：<b>${rows.length}</b></span><span>待称重：<b style="color:var(--r)">${wait}</b></span>
      <span>超限拦截：<b style="color:${blocked?'var(--r)':'var(--ts)'}">${blocked}</b></span>
      <span>差额合计：<b style="color:${total>0?'var(--y)':total<0?'var(--r)':'var(--gd)'}">${total>0?'+':''}${money2(total)}</b></span>
      <span style="color:var(--ts);font-size:12px">容差 ±${WG.TOL*100}% 不计差额 · 多发按 +${WG.CAP*100}% 封顶 · 超 ±${WG.BLOCK*100}% 拦截</span>`;
  }

  /* ========== 页面 ========== */
  function view(){
    DB.weighF=DB.weighF||{};DB.weighSel=DB.weighSel||[];
    const f=DB.weighF,dates=wgDates(),whs=wgWhs();
    if(f.date===undefined)f.date=dates[0]||'';
    ROWS=buildRows();
    const selN=selRows().length;
    const selKeys=ROWS.filter(r=>r.st!='done'&&!r.locked).map(r=>keyOf(r.o,r.l));
    const allSel=selKeys.length&&selKeys.every(k=>(DB.weighSel||[]).includes(k));
    const opt=(cur,list,ph)=>`<option value="">${ph}</option>`+list.map(v=>`<option ${cur==v?'selected':''}>${v}</option>`).join('');
    return `
    <div class="ib ib-b" style="margin-bottom:12px"><span class="i">⚖️</span>
      按重量定价的商品（多退少补=是）下单时按<b>预估净重</b>锁价，分装过秤后在此录<b>实发净重</b>；
      差额 =（实发 − 应发）× S$/kg，随<b>当期对账单</b>多退少补。定重预包装商品按件计价、无需称重，<b>不在此列表展示</b>。</div>

    <div class="card" style="margin-bottom:14px"><div class="card-bd" style="display:flex;gap:16px;align-items:flex-end;flex-wrap:wrap">
      <div><div style="font-size:12px;color:var(--ts);margin-bottom:5px">配送日期</div><select onchange="DB.weighF.date=this.value;render()" style="min-width:140px">${dates.map(d=>`<option ${f.date==d?'selected':''}>${d}</option>`).join('')||'<option>无</option>'}</select></div>
      <div><div style="font-size:12px;color:var(--ts);margin-bottom:5px">仓库</div><select onchange="DB.weighF.wh=this.value;render()" style="min-width:150px">${opt(f.wh||'',whs,'全部仓库')}</select></div>
      <div><div style="font-size:12px;color:var(--ts);margin-bottom:5px">状态</div><select onchange="DB.weighF.st=this.value;render()" style="min-width:130px">
        <option value="">全部</option><option value="wait" ${f.st=='wait'?'selected':''}>待称重</option><option value="diff" ${f.st=='diff'?'selected':''}>有差额</option><option value="done" ${f.st=='done'?'selected':''}>已提交</option></select></div>
      <div><div style="font-size:12px;color:var(--ts);margin-bottom:5px">商品名称</div><input id="wg-name" value="${f.name||''}" placeholder="请输入" onkeydown="if(event.key=='Enter'){DB.weighF.name=this.value.trim();render()}" style="min-width:160px"></div>
      <button class="btn btn-p btn-sm" onclick="DB.weighF.name=(document.getElementById('wg-name')||{}).value.trim();render()">查询</button>
      <button class="btn btn-o btn-sm" onclick="DB.weighF={};DB.weighSel=[];render()">重置</button>
    </div></div>

    <div class="card"><div class="card-hd" style="flex-wrap:wrap;gap:10px">
      <div class="row" style="gap:8px;flex-wrap:wrap;align-items:center">
        <button class="btn btn-o btn-sm" ${selN?'':'disabled'} onclick="wg_batchDue()" title="勾选行一键按应发净重填入，只手改称出来不一样的行">按应发填入${selN?`（${selN}）`:''}</button>
        <button class="btn btn-p btn-sm" ${selN?'':'disabled'} onclick="wg_submit()">提交称重结果${selN?`（${selN}）`:''}</button>
        <button class="btn btn-o btn-sm" onclick="toast('已导出称重单.xlsx（含应发/实发/差异/差额）','ok')">导出称重单</button>
        <button class="btn btn-link btn-sm" onclick="nav('m-pick-label')">🏷️ 去打印标签</button>
      </div>
      <div id="wg-sum" class="row" style="gap:14px;font-size:12.5px;align-items:center"></div>
    </div>
    <div class="card-bd flush"><div style="overflow-x:auto"><table>
      <thead><tr>
        <th style="width:34px"><input type="checkbox" title="全选可称重行" ${allSel?'checked':''} onclick="wg_selAll()"></th>
        <th>订单号 / 客户</th><th>商品（规格）</th><th style="text-align:right">件数</th>
        <th style="text-align:right">应发净重</th><th style="text-align:center;width:168px">实发净重 (kg)</th>
        <th style="text-align:right">差异</th><th style="text-align:right">差异率</th>
        <th style="text-align:right">单价</th><th style="text-align:right">差额</th><th>状态</th><th>凭证</th>
      </tr></thead><tbody>
      ${ROWS.map((r,i)=>{
        const done=r.st=='done',lock=r.locked,t=ST[r.st]||ST.wait;
        return `<tr>
        <td>${done||lock?'':`<input type="checkbox" ${(DB.weighSel||[]).includes(keyOf(r.o,r.l))?'checked':''} onclick="wg_toggle(${i})">`}</td>
        <td><span class="mono" style="font-size:11.5px">${r.o.id}</span><div style="font-size:11.5px;color:var(--ts)">${ord_mask(r.o.client)} · ${r.o.warehouse||'—'}</div></td>
        <td style="white-space:nowrap"><b>${r.l.name}</b> <span style="color:var(--ts);font-size:11.5px">${r.m.specQty}${r.m.unit}/件</span></td>
        <td style="text-align:right">${r.l.qty}</td>
        <td style="text-align:right"><b>${dueW(r.l)}</b> kg</td>
        <td style="text-align:center">${done||lock
          ?`<b>${r.real} kg</b>${lock?`<div style="font-size:10.5px;color:var(--ts)">超 ${WG.DAYS} 天已锁定</div>`:''}`
          :`<div class="row" style="gap:7px;justify-content:center;align-items:center;flex-wrap:nowrap;white-space:nowrap">
              <input id="wg-in-${i}" type="number" step="0.01" min="0" value="${r.real===''?'':r.real}" placeholder="${dueW(r.l)}" oninput="wg_input(${i},this.value)" style="width:92px;text-align:right">
              <button class="btn btn-link btn-sm" title="称出来与应发一致时，一键填入 ${dueW(r.l)} kg" onclick="wg_useDue(${i})">按应发</button>
            </div>`}</td>
        <td id="wg-diff-${i}" style="text-align:right"></td>
        <td id="wg-rate-${i}" style="text-align:right"></td>
        <td style="text-align:right;white-space:nowrap">${money2(kgPrice(r.l))}<span style="color:var(--ts);font-size:11px">/kg</span></td>
        <td id="wg-amt-${i}" style="text-align:right"></td>
        <td id="wg-st-${i}"><span class="tag ${t[1]}">${t[0]}</span></td>
        <td><button class="btn btn-link btn-sm" onclick="wg_photo(${i})">${r.rec&&r.rec.photo?'✅ 已附磅单':'📷 附磅单'}</button></td>
      </tr>`;}).join('')||`<tr><td colspan="12"><div class="empty"><div class="e-ic">⚖️</div><div class="e-t">该筛选下没有需要称重的商品</div><div class="e-s">仅按重量定价（多退少补=是）的商品需要称重；切换配送日期/仓库看看。</div></div></td></tr>`}
      </tbody></table></div></div></div>`;
  }

  /* ========== 订单详情用：规格差额区块（对齐线上 product-diff-info 列） ========== */
  window.weighSection=function(o){
    const rows=(o.lines||[]).map(l=>({l,r:recOf(o,l)})).filter(x=>x.r&&x.r.submitted);
    if(!rows.length)return '';
    const PS={0:'未发生多退少补',1:'已录入补款 · 待并入账单',2:'补款已结算',3:'已录入退款 · 待并入账单',4:'退款已结算'};
    const total=+rows.reduce((a,x)=>a+(x.r.amt||0),0).toFixed(2);
    return `<div class="card" style="box-shadow:none;margin-top:14px"><div class="card-hd"><h3 style="font-size:14px">规格差额（多退少补）</h3>
      <span class="sub">${PS[o.diffPayStatus||0]}</span></div>
      <div class="card-bd flush"><div style="overflow-x:auto"><table style="border:none">
      <thead><tr><th>商品</th><th style="text-align:right">应发净重</th><th style="text-align:right">实发净重</th><th style="text-align:right">差异</th><th style="text-align:right">单价</th><th style="text-align:right">差额</th><th>操作人 / 时间</th></tr></thead><tbody>
      ${rows.map(({l,r})=>`<tr><td><b>${l.name}</b></td>
        <td style="text-align:right">${r.due} kg</td><td style="text-align:right"><b>${r.real} kg</b></td>
        <td style="text-align:right;color:${r.diff>0?'var(--y)':r.diff<0?'var(--r)':'var(--ts)'}">${r.diff>0?'+':''}${r.diff} kg</td>
        <td style="text-align:right">${money2(kgPrice(l))}/kg</td>
        <td style="text-align:right">${r.amt?`<b style="color:${r.amt>0?'var(--y)':'var(--r)'}">${r.amt>0?'+':'-'}${money2(Math.abs(r.amt))}</b>`:'<span style="color:var(--ts)">—</span>'}</td>
        <td style="font-size:11.5px;color:var(--ts)">${r.by||'—'}<br>${r.at||''}</td></tr>`).join('')}
      <tr style="font-weight:700;background:var(--gl)"><td colspan="5">差额合计（并入当期对账单）</td><td style="text-align:right;color:${total>0?'var(--y)':'var(--r)'}">${total>0?'+':''}${money2(total)}</td><td></td></tr>
      </tbody></table></div></div></div>`;
  };
  /* 供打印标签门禁调用（pick.js）：单条订单行的称重状态
     'na'=不参与多退少补 / 'wait'=需称重但未提交 / 'done'=已提交实发净重 */
  window.weighLineState=function(o,l){
    if(!skuMeta(l).weighable)return 'na';
    const r=recOf(o,l);
    return r&&r.submitted?'done':'wait';
  };
  // 某(配送日期 + 入库仓库)下仍未完成称重的订单行数——供送货单生成门禁用（整仓没称完不生成送货单）
  window.weighWhPending=function(date,wh){
    let n=0;
    DB.orders.filter(o=>(o.status=='pending'||o.status=='packed')&&(!date||o.deliver==date)&&(!wh||o.warehouse==wh))
      .forEach(o=>(o.lines||[]).forEach(l=>{if(window.weighLineState(o,l)=='wait')n++;}));
    return n;
  };
  // 已提交的实发净重（打印标签时印在标签上）
  window.weighRealOf=function(o,l){const r=recOf(o,l);return r&&r.submitted?r.real:null;};
  // 供菜单角标 / 其他模块引用：待称重行数
  window.weighPending=function(){const saved=DB.weighF;DB.weighF={date:'',wh:'',st:''};const n=buildRows().filter(r=>r.st=='wait').length;DB.weighF=saved;return n;};

  PAGES['m-pick-weigh']=()=>{ ensurePickOrders(); const html=view(); setTimeout(()=>{ROWS.forEach((r,i)=>paintRow(i));paintSum();},0); return html; };
})();
