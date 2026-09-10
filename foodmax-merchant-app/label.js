/* Food Max 商家端 v2 · 打印标签 + 称重商品（自 PC 搬迁）
   页面两 Tab：① 标签打印（应送货标签清单，打印按钮先去掉）② 称重商品（多退少补逐件称重，见 weigh.js）。
   多退少补 SKU 未提交称重 → 标签打印页标「待称重」（后续加打印按钮时作为打印门禁）。
   数据源=window.FM.DB.orders（status=pending）。前缀 lb-。 */
(function(){
const {pushPage,svg,skel}=window.FM;

/* 规格/分类/多退少补(refund) 对齐 PC 商品数据；up=S$/kg 由订单行价带入(1kg/件即单价) */
const META={
  SKU8801:{cat:'新鲜蔬菜',spec:'1kg/件',refund:1,specQty:1,unit:'kg'}, // 小棠菜·按重量
  SKU8802:{cat:'新鲜蔬菜',spec:'1kg/件',refund:0,specQty:1,unit:'kg'}, // 白菜·定重预包装
  SKU8803:{cat:'新鲜蔬菜',spec:'1kg/件',refund:1,specQty:1,unit:'kg'}, // 菠菜·按重量
  SKU8804:{cat:'新鲜蔬菜',spec:'1kg/件',refund:1,specQty:1,unit:'kg'}, // 空心菜·按重量
};
const metaOf=sku=>META[sku]||{cat:'—',spec:'',refund:0,specQty:1,unit:'kg'};
window.FM_SKU_META=META;   // 供 weigh.js 复用
// 日期选择器：字段 + 点击弹底部选择（对齐移动端时间选择器，值限定为有数据的配送日）
const CAL='<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="17" rx="2"/><path d="M3 9h18M8 2v4M16 2v4"/></svg>';
const fmtDate=d=>d?'2026-'+d:'';
function dateField(cur,list,onPick){
  return {html:`<div class="lb-field" data-datefield="1">${CAL}<b>${fmtDate(cur)||'选择配送日期'}</b><span class="caret">▾</span></div>`,
    bind:root=>{const el=root.querySelector('[data-datefield]');if(el)el.onclick=()=>window.FM.sheet(list.map(d=>({label:fmtDate(d),onClick:()=>onPick(d)})));}};
}
window.FM_dateField=dateField;   // 供 weigh.js 复用

const css=document.createElement('style');
css.textContent=`
.lb-tabs{display:flex;gap:8px;padding:12px 16px 0;position:sticky;top:0;z-index:20;background:var(--bg);box-shadow:0 6px 8px -6px rgba(6,95,70,.10);}
.lb-tab{flex:1;text-align:center;padding:11px 0;border-radius:12px 12px 0 0;font-size:14px;font-weight:700;color:var(--sub);background:var(--muted);cursor:pointer;}
.lb-tab.on{color:var(--emerald-2);background:#fff;box-shadow:var(--sh-sm);}
.lb-note{margin:12px 16px 0;background:var(--mint-soft);border-radius:14px;padding:12px 14px;font-size:12px;line-height:1.6;color:#27433A;}
.lb-filter{margin:13px 16px 0;background:#fff;border-radius:16px;padding:13px 15px;box-shadow:var(--sh-sm);}
.lb-frow{display:flex;align-items:flex-start;gap:10px;}
.lb-frow+.lb-frow{margin-top:11px;}
.lb-fl{font-size:12.5px;color:var(--sub);font-weight:600;flex:0 0 56px;padding-top:6px;}
.lb-pills{display:flex;flex-wrap:wrap;gap:8px;flex:1;}
.lb-pill{font-size:12.5px;font-weight:600;padding:6px 13px;border-radius:20px;background:var(--muted);color:#46604F;cursor:pointer;min-height:32px;display:flex;align-items:center;}
.lb-pill.on{background:var(--emerald);color:#fff;}
.lb-search{flex:1;height:36px;border:1px solid var(--line);border-radius:10px;padding:0 12px;font-size:13px;font-family:inherit;color:var(--ink);}
.lb-field{flex:1;min-height:38px;border:1px solid var(--line);border-radius:10px;padding:0 12px;display:flex;align-items:center;gap:8px;font-size:14px;font-weight:600;color:var(--ink);cursor:pointer;background:#fff;}
.lb-field svg{width:16px;height:16px;stroke:var(--emerald-2);fill:none;stroke-width:1.8;flex:0 0 16px;}
.lb-field .caret{margin-left:auto;color:var(--sub);font-size:11px;}
.lb-sum{display:flex;background:#fff;border-radius:16px;margin:13px 16px 0;padding:15px 0;box-shadow:var(--sh-sm);}
.lb-sum .k{flex:1;text-align:center;}.lb-sum .k+.k{border-left:1px solid var(--line);}
.lb-sum .k .v{font-size:22px;font-weight:600;font-family:'Lora',serif;}
.lb-sum .k .v.g{color:var(--emerald-2);}.lb-sum .k .v.r{color:var(--red);}
.lb-sum .k .l{font-size:11.5px;color:var(--sub);margin-top:2px;}
.lb-sec{font-size:14.5px;font-weight:700;margin:17px 16px 8px;display:flex;align-items:center;gap:8px;}
.lb-sec .hint{margin-left:auto;font-size:12px;font-weight:600;color:var(--sub);}
.lb-tbl{background:#fff;border-radius:16px;margin:0 16px;box-shadow:var(--sh-sm);overflow:hidden;}
.lb-row{padding:13px 15px;cursor:pointer;position:relative;}
.lb-row .chev{position:absolute;right:13px;top:50%;transform:translateY(-50%);color:var(--sub);font-size:16px;}
.lb-row .top{padding-right:16px;}
.lb-row+.lb-row{border-top:1px solid var(--line);}
.lp-printer{margin:12px 16px 0;display:flex;align-items:center;gap:8px;font-size:12.5px;color:var(--sub);background:#fff;border-radius:12px;padding:12px 14px;box-shadow:var(--sh-sm);}
.lp-printer b{color:var(--emerald-2);}
.lp-gatetip{margin:12px 16px 0;background:var(--amber-soft);border-radius:12px;padding:12px 14px;font-size:12.5px;color:#B45309;line-height:1.6;}
.lp-gatetip .go{color:var(--emerald-2);font-weight:700;text-decoration:underline;}
.lp-seqlink{margin:12px 16px 0;height:40px;border-radius:11px;display:flex;align-items:center;justify-content:center;gap:6px;font-size:12.5px;font-weight:600;color:var(--sub);background:transparent;border:1px dashed var(--line);cursor:pointer;}
.lp-seqlink:active{background:var(--muted);}
.lpm-in{width:76px;height:44px;border:1.5px solid var(--line);border-radius:11px;text-align:center;font-size:17px;font-family:inherit;color:var(--ink);}
.lpm-in:focus{border-color:var(--emerald);outline:none;}
.lb-row .top{display:flex;align-items:baseline;justify-content:space-between;gap:10px;}
.lb-row .nm{font-size:14.5px;font-weight:700;}
.lb-row .wtag{font-size:10.5px;font-weight:700;border-radius:7px;padding:1px 7px;margin-left:6px;}
.lb-row .wtag.done{color:var(--emerald-2);background:var(--mint-soft);}
.lb-row .wtag.wait{color:var(--amber);background:var(--amber-soft);}
.lb-row .q{font-size:20px;font-weight:600;font-family:'Lora',serif;color:var(--emerald-2);white-space:nowrap;}
.lb-row .q span{font-size:12px;color:var(--sub);font-family:'Raleway',sans-serif;margin-left:2px;}
.lb-row .meta{font-size:11.5px;color:var(--sub);margin-top:4px;}
.lb-row .meta .code{font-family:monospace;}
.lb-row .kv{display:flex;gap:16px;margin-top:9px;}
.lb-row .kv .i{font-size:11.5px;color:var(--sub);}
.lb-row .kv .i b{font-size:13px;color:var(--ink);font-weight:700;}
.lb-row .kv .i b.r{color:var(--red);}
`;
document.head.appendChild(css);

/* ================= 标签打印 Tab ================= */
const state={date:null,wh:'',name:''};
const pend=()=>(window.FM.DB.orders||[]).filter(o=>o.status==='pending');
const dates=()=>[...new Set(pend().map(o=>o.deliver))];
const whs=()=>[...new Set(pend().map(o=>o.warehouse))];
function yday(sku){let h=7;for(const c of String(sku))h=(h*31+c.charCodeAt(0))>>>0;return 5+h%95;}
const printedOf=key=>((window.FM.DB.labelPrinted||{})[key])||0;
const weighed=key=>!!((window.FM.DB.weigh||{})[key]||{}).submitted;

function rows(){
  const f=state,agg={};
  pend().forEach(o=>{
    if(f.date&&o.deliver!==f.date)return;
    if(f.wh&&o.warehouse!==f.wh)return;
    (o.lines||[]).forEach(l=>{
      if(f.name&&!(l.name||'').includes(f.name)&&!(l.sku||'').includes(f.name))return;
      const key=o.warehouse+'|'+l.sku,m=metaOf(l.sku);
      if(!agg[key])agg[key]={key,wh:o.warehouse,sku:l.sku,name:l.name,unit:l.unit,cat:m.cat,spec:m.spec,refund:m.refund,qty:0};
      agg[key].qty+=l.qty;});
  });
  // 应送货 = 订单量 + 预送量（预送量标签形态与订单货一致：按 SKU 一件一张、不含订单/客户信息）
  const out=Object.values(agg);
  out.forEach(r=>{r.ordQty=r.qty;r.psQty=(typeof PS_QTY==='function')?PS_QTY(r.name,r.wh):0;r.qty=r.ordQty+r.psQty;});
  return out;
}

function renderPrint(box){
  window.FM.DB.labelPrinted=window.FM.DB.labelPrinted||{};
  const ds=dates();if(state.date===null)state.date=ds[0]||'';
  const ws=whs();
  const rs=rows();
  const should=rs.reduce((a,r)=>a+r.qty,0);
  const printed=rs.reduce((a,r)=>a+Math.min(r.qty,printedOf(r.key)),0);
  const unpr=should-printed;
  const byWh={};rs.forEach(r=>{(byWh[r.wh]=byWh[r.wh]||[]).push(r);});
  const whSet=Object.keys(byWh);
  const pill=(val,cur,attr)=>`<span class="lb-pill ${cur===val?'on':''}" data-${attr}="${val}">`;
  const df=dateField(state.date,ds,d=>{state.date=d;renderPrint(box);});
  box.innerHTML=`
    <div class="lb-note">🏷️ 按「配送日期 + 仓库」汇总各 SKU 应送货张数（每件一张，序号连续）。多退少补商品需先在「称重商品」录实发净重，再打标签、印实发净重。</div>
    <div class="lb-filter">
      <div class="lb-frow"><span class="lb-fl">配送日期</span>${df.html}</div>
      <div class="lb-frow"><span class="lb-fl">仓库</span><div class="lb-pills">${pill('',state.wh,'wh')}全部</span>${ws.map(w=>`${pill(w,state.wh,'wh')}${w}</span>`).join('')}</div></div>
      <div class="lb-frow"><span class="lb-fl">商品名称</span><input class="lb-search" id="lb-name" placeholder="输入商品名 / SKU 编码" value="${state.name||''}"></div>
    </div>
    <div class="lb-sum"><div class="k"><div class="v">${should}</div><div class="l">应送货(张)</div></div><div class="k"><div class="v g">${printed}</div><div class="l">已打印</div></div><div class="k"><div class="v r">${unpr}</div><div class="l">未打印</div></div></div>
    ${rs.length?whSet.map(w=>`
      <div class="lb-sec">${w}<span class="hint">应送货 ${byWh[w].reduce((a,r)=>a+r.qty,0)} 张</span></div>
      <div class="lb-tbl">${byWh[w].map(r=>{const pr=Math.min(r.qty,printedOf(r.key)),un=r.qty-pr;
        const wtag=r.refund?(weighed(r.key)?'<span class="wtag done">已称重</span>':'<span class="wtag wait">待称重</span>'):'';
        return `<div class="lb-row" data-key="${r.key}">
        <div class="top"><span class="nm">${r.name}${wtag}${un<=0?'<span class="wtag done">打印完成</span>':''}</span><span class="q">${r.qty}<span>${r.unit||'件'}</span></span></div>
        <div class="meta">规格 ${r.spec||'—'} · <span class="code">${r.sku}</span> · ${r.cat}</div>
        <div class="meta">订单 ${r.ordQty}${r.psQty?` · <b style="color:var(--amber)">预送 ${r.psQty}</b>`:''}</div>
        <div class="kv"><span class="i">昨日销量 <b>${yday(r.sku)}</b></span><span class="i">已打印 <b>${pr}</b></span><span class="i">未打印 <b class="${un>0?'r':''}">${un}</b></span></div>
        <span class="chev">›</span>
      </div>`;}).join('')}</div>`).join('')
    :`<div class="empty"><div class="ei">${svg('ticket')}</div><h4>该筛选下暂无应送货标签</h4><p>切换配送日期 / 仓库看看</p></div>`}
    <div style="height:12px"></div>`;
  df.bind(box);
  box.querySelectorAll('.lb-row[data-key]').forEach(el=>el.onclick=()=>openLabelDetail(el.dataset.key));
  box.querySelectorAll('[data-wh]').forEach(el=>el.onclick=()=>{state.wh=el.dataset.wh;renderPrint(box);});
  const s=box.querySelector('#lb-name');if(s)s.oninput=()=>{state.name=s.value.trim();const p=s.selectionStart;renderPrint(box);const n=box.querySelector('#lb-name');if(n){n.focus();n.setSelectionRange(p,p);}};
}

/* ================= 按商品打印（预贴标签，不绑送货单）=================
   与 PC「打印标签 › 按商品打印」同口径（pc-modules/pick.js）：
   - 二维码不含备货单号；普通品张张相同，多退少补每张带唯一标签号 + 本袋净重
   - 不计入备货单已打张数/序号，不触发送货单生成
   - 到仓由 WMS 扫码后按数量逻辑匹配到当日送货单
   ============================================================ */
const MAX_PRE=200;
function preSkus(){
  return Object.keys(META).map(sku=>{
    const m=META[sku];
    let name=sku;
    pend().forEach(o=>(o.lines||[]).forEach(l=>{if(l.sku===sku&&l.name)name=l.name;}));
    return {sku,name,spec:m.spec,weigh:!!m.refund,specQty:m.specQty||1,unit:m.unit||'kg',cat:m.cat};
  });
}
function preOf(sku){return preSkus().find(x=>x.sku===sku);}
function preList(){const D=window.FM.DB;return D.preLabels||(D.preLabels=[]);}
function preNextId(){const D=window.FM.DB;D.preSeq=(D.preSeq||0)+1;return 'PL2609'+String(D.preSeq).padStart(5,'0');}
function preNow(){const d=new Date();return '2026-09-10 '+String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0');}

/* 待打印清单（购物车式，支持批量录入 SKU）*/
function preCart(){const D=window.FM.DB;return D.preCart||(D.preCart=[]);}
function cartIdx(sku){return preCart().findIndex(x=>x.sku===sku);}
function preDefQty(){return window.FM.DB.preLastQty||10;}
function preDone(sku){return preList().filter(x=>x.sku===sku&&x.type==='weigh').length;}
function cartAdd(sku,qty){
  const r=preOf(sku);if(!r)return {ok:false};
  const i=cartIdx(sku);
  if(i>=0){if(!r.weigh)preCart()[i].qty=Math.min(MAX_PRE,preCart()[i].qty+(qty||preDefQty()));return {ok:true,dup:true,name:r.name,weigh:r.weigh};}
  preCart().push({sku:r.sku,name:r.name,spec:r.spec,weigh:r.weigh,specQty:r.specQty,unit:r.unit,qty:r.weigh?0:(qty||preDefQty())});
  return {ok:true,name:r.name,weigh:r.weigh};
}
// 输入串 → SKU：商品编码 / 商品名称（含模糊），不区分大小写
function resolveSku(tok){
  const t=String(tok||'').trim();if(!t)return null;const all=preSkus();
  return all.find(x=>x.sku.toLowerCase()===t.toLowerCase())||all.find(x=>x.name===t)||all.find(x=>x.name.includes(t))||null;
}

function renderPre(box){
  const skus=preSkus();
  const cart=preCart();
  const cur=state.preSku?preOf(state.preSku):null;
  const curInCart=cur&&cartIdx(cur.sku)>=0;
  const batch=cur&&cur.weigh?preList().filter(x=>x.sku===cur.sku&&x.type==='weigh'):[];
  const list=preList();
  const normals=cart.filter(x=>!x.weigh&&x.qty>=1);
  const total=normals.reduce((a,x)=>a+x.qty,0);

  box.innerHTML=`
    <div class="lb-note">📦 预贴标签<b>不绑送货单 / 备货单</b>，提前分装时先打先贴；不计入备货单打印进度，到仓由 WMS 扫码后按数量逻辑匹配到当日送货单。</div>
    <div class="lb-filter">
      <div class="lb-frow"><span class="lb-fl">扫码 / 编码</span>
        <input class="lb-search" id="pre-scan" placeholder="扫码枪扫一个加一个，或输编码后回车"></div>
      <div class="lb-frow"><span class="lb-fl">从列表挑</span>
        <div class="lb-field" id="pre-pick"><b>选择商品加入清单</b><span class="caret">▾</span></div></div>
      <div class="lb-frow"><span class="lb-fl">批量录入</span>
        <div class="lb-field" id="pre-paste-open"><b>粘贴一列编码</b><span class="caret">›</span></div></div>
    </div>

    <div class="lb-sec">待打印清单<span class="hint">${cart.length} 项${total?` · 普通品 ${total} 张`:''}</span></div>
    <div class="lb-tbl">${cart.map(x=>`<div class="lb-row" data-cart="${x.sku}" ${cur&&cur.sku===x.sku?'style="background:#F1F8F1"':''}>
      <div class="top"><span class="nm">${x.name}${x.weigh?'<span class="wtag wait">多退少补</span>':''}</span>
        <span class="q">${x.weigh?`<b id="pre-cart-${x.sku}">${preDone(x.sku)}</b><span>袋已打</span>`:`${x.qty}<span>张</span>`}</span></div>
      <div class="meta">${x.spec} · <span class="code">${x.sku}</span></div>
      <div class="kv">
        ${x.weigh
          ? `<span class="i" data-weigh="${x.sku}" style="color:var(--emerald-2);font-weight:700">${cur&&cur.sku===x.sku?'称重中…':'开始称重 ›'}</span>
             <span class="i" data-done="${x.sku}" style="display:${preDone(x.sku)?'':'none'}">标记完成</span>`
          : `<span class="i">打印张数</span><input class="lb-search" style="width:88px;padding:6px 10px" type="number" inputmode="numeric" value="${x.qty}" data-qty="${x.sku}">`}
        <span class="i" data-del="${x.sku}" style="color:var(--red)">移除</span>
      </div>
    </div>`).join('')||`<div class="empty"><div class="ei">${svg('ticket')}</div><h4>清单还是空的</h4><p>扫码连扫、粘贴一列编码，或从列表挑几个加进来</p></div>`}</div>
    ${cart.length?`<div style="padding:12px 16px 0"><button class="btn ${normals.length?'primary':''}" id="pre-batch-go" ${normals.length?'':'disabled'}>🖨 批量打印${total?`（${normals.length} 个商品 ${total} 张）`:''}</button></div>
      ${cart.some(x=>x.weigh)?`<div class="lb-note" style="margin-top:10px">⚖️ 多退少补商品每袋重量不同，<b>不进批量</b>，需逐袋称重打印。</div>`:''}`:''}

    ${cur&&cur.weigh&&curInCart?`
      <div class="lb-sec">称重打印 · ${cur.name}<span class="hint" id="pre-cnt">${batch.length} 张</span></div>
      <div class="lb-note">⚖️ 一袋一称一打：每张带<b>唯一标签号</b>与本袋净重，二维码不含备货单号。一件应发 ${cur.specQty}${cur.unit}。</div>
      <div class="lb-filter">
        <div class="lb-frow"><span class="lb-fl">本袋净重（${cur.unit}）</span>
          <input class="lb-search" id="pre-w" type="number" inputmode="decimal" step="0.01" placeholder="过秤后输入"></div>
      </div>
      <div style="padding:0 16px;display:flex;gap:10px"><button class="btn primary" id="pre-go">🖨 打印并继续</button>
        <button class="btn ghost" id="pre-done-btn" style="display:${batch.length?'':'none'};flex:0 0 40%">称完了</button></div>
      <div class="lb-tbl" id="pre-batch" style="margin-top:10px">${batch.map(b=>preBatchRow(b,cur)).join('')}</div>`:''}

    <div class="lb-sec">预贴标签台账<span class="hint" id="pre-ledger-cnt">${list.length} 条 · ${list.reduce((a,x)=>a+x.qty,0)} 张</span></div>
    <div class="lb-tbl" id="pre-ledger">${list.map(preLedgerRow).join('')||`<div class="empty"><div class="ei">${svg('ticket')}</div><h4>还没有预贴标签</h4><p>选商品打印后，这里会留下台账</p></div>`}</div>
    <div style="height:12px"></div>`;

  // —— 绑定 ——
  const sc=box.querySelector('#pre-scan');
  if(sc){sc.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();preScanAdd(box);}};}
  const pick=box.querySelector('#pre-pick');
  if(pick)pick.onclick=()=>window.FM.sheet(skus.map(x=>({
    label:`${x.name}（${x.spec}）${x.weigh?' · 多退少补':''}`,
    onClick:()=>{const r=cartAdd(x.sku);if(x.weigh)state.preSku=x.sku;renderPre(box);
      window.FM.toast(r.dup?`「${x.name}」已在清单中`:`已加入清单：${x.name}`);}})));
  const po=box.querySelector('#pre-paste-open');
  if(po)po.onclick=()=>prePastePage(box);

  box.querySelectorAll('[data-qty]').forEach(el=>el.onchange=()=>{
    const i=cartIdx(el.dataset.qty);if(i<0)return;
    const n=parseInt(el.value,10);
    preCart()[i].qty=(n>=1&&n<=MAX_PRE)?n:0;
    if(n>=1&&n<=MAX_PRE)window.FM.DB.preLastQty=n;
    renderPre(box);});
  box.querySelectorAll('[data-weigh]').forEach(el=>el.onclick=e=>{e.stopPropagation();
    state.preSku=el.dataset.weigh;renderPre(box);
    const w=box.querySelector('#pre-w');if(w)w.focus();});
  box.querySelectorAll('[data-done]').forEach(el=>el.onclick=e=>{e.stopPropagation();preWeighDone(el.dataset.done,box);});
  box.querySelectorAll('[data-del]').forEach(el=>el.onclick=e=>{e.stopPropagation();
    const i=cartIdx(el.dataset.del);if(i<0)return;const nm=preCart()[i].name;preCart().splice(i,1);
    if(state.preSku===el.dataset.del)state.preSku='';renderPre(box);window.FM.toast(`已移出清单：${nm}`);});

  const bg=box.querySelector('#pre-batch-go');
  if(bg)bg.onclick=()=>prePrintBatch(box);
  const go=box.querySelector('#pre-go');
  if(go)go.onclick=()=>prePrintWeigh(box,cur);
  const wi=box.querySelector('#pre-w');
  if(wi)wi.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();prePrintWeigh(box,cur);}};
  const db=box.querySelector('#pre-done-btn');
  if(db)db.onclick=()=>preWeighDone(cur.sku,box);
  box.querySelectorAll('[data-pre]').forEach(el=>el.onclick=()=>preReprint(el.dataset.pre,box));
}

function preScanAdd(box){
  const el=box.querySelector('#pre-scan');const v=(el||{}).value||'';
  if(!v.trim()){if(el)el.focus();return;}
  const hit=resolveSku(v);
  if(!hit){window.FM.toast(`没找到「${v.trim()}」对应的在售商品`);if(el)el.select();return;}
  const r=cartAdd(hit.sku);
  if(hit.weigh)state.preSku=hit.sku;
  renderPre(box);
  const n=box.querySelector('#pre-scan');if(n){n.value='';n.focus();}   // 支持扫码枪连扫
  window.FM.toast(r.dup?`「${hit.name}」已在清单中`:`已加入清单：${hit.name}`);
}

/* 批量粘贴：一行一个，支持「编码」或「编码 + 张数」（逗号/空格/Tab 均可）*/
function prePastePage(box){
  window.FM.pushPage({title:'批量录入商品',
    body:`<div class="lb-note">📋 一行一个，支持「商品编码」或「商品编码 + 打印张数」两列；分隔符支持<b>逗号 / 空格 / Tab</b>。只写编码时按默认 <b>${preDefQty()}</b> 张；<b>多退少补商品张数忽略</b>，加进清单后逐袋称重。</div>
      <div style="padding:0 16px"><textarea id="pre-paste" rows="10" style="width:100%;box-sizing:border-box;border:1px solid var(--line,#DDE5DF);border-radius:12px;padding:12px;font-family:inherit;font-size:14px" placeholder="SKU8816,20&#10;SKU8815&#10;小棠菜 15"></textarea></div>`,
    footer:`<button class="btn primary" id="pre-paste-go">解析并加入清单</button>`,
    mount:p=>{
      const t=p.querySelector('#pre-paste');if(t)t.focus();
      p.querySelector('#pre-paste-go').onclick=()=>{
        const raw=(p.querySelector('#pre-paste')||{}).value||'';
        const rows=raw.split(/[\n\r;]+/).map(x=>x.trim()).filter(Boolean);
        if(!rows.length){window.FM.toast('请先粘贴商品编码');return;}
        let added=0,dup=0;const bad=[];
        rows.forEach(line=>{
          const parts=line.split(/[,，\t ]+/).filter(Boolean);
          const hit=resolveSku(parts[0]);
          if(!hit){bad.push(line);return;}
          const q=parts.length>1?parseInt(parts[1],10):0;
          const r=cartAdd(hit.sku,(q>=1&&q<=MAX_PRE)?q:0);
          if(r.dup)dup++;else added++;
        });
        window.FM.popPage();renderPre(box);
        window.FM.toast(bad.length
          ?`已加入 ${added} 项；${bad.length} 行没认出：${bad.slice(0,2).join('、')}${bad.length>2?' 等':''}`
          :`已加入 ${added} 项${dup?`，${dup} 项已在清单`:''}`);
      };
    }});
}

function preLedgerRow(x){return `<div class="lb-row" data-pre="${x.id}">
    <div class="top"><span class="nm">${x.name}${x.type==='weigh'?'<span class="wtag wait">多退少补</span>':''}</span><span class="q">${x.qty}<span>张</span></span></div>
    <div class="meta"><span class="code">${x.id}</span> · ${x.spec}${x.type==='weigh'?` · 净重 <b>${x.w.toFixed(2)}${x.wUnit}</b>`:''}</div>
    <div class="kv"><span class="i">打印 <b>${x.time}</b></span><span class="i">${x.status}</span>${x.re?`<span class="i">已补打 <b>${x.re}</b></span>`:''}</div>
    <span class="chev">›</span>
  </div>`;}
function preBatchRow(b,cur){
  const d=+(b.w-cur.specQty).toFixed(2);
  return `<div class="lb-row"><div class="top"><span class="nm"><span class="code">${b.id}</span></span>
    <span class="q">${b.w.toFixed(2)}<span>${b.wUnit}</span></span></div>
    <div class="meta">一件应发 ${cur.specQty}${cur.unit} · 差异 <b class="${d<0?'r':''}">${d>=0?'+':''}${d.toFixed(2)}</b> · ${b.time}</div></div>`;
}

/* 普通品批量打印：清单里所有普通品一次打完，一个 SKU 一条台账 */
function prePrintBatch(box){
  const normals=preCart().filter(x=>!x.weigh&&x.qty>=1);
  if(!normals.length){window.FM.toast('清单里没有可批量打印的普通商品');return;}
  const total=normals.reduce((a,x)=>a+x.qty,0);
  if(total>MAX_PRE){window.FM.toast(`单次上限 ${MAX_PRE} 张，当前 ${total} 张，请分批`);return;}
  window.FM.confirmDialog({title:`批量预贴打印 ${total} 张`,
    body:`${normals.map(x=>`${x.name} × ${x.qty}`).join('<br>')}<br><br>预贴标签不绑送货单，张张相同、无序号。`,
    okText:'确认打印',onOk:()=>{
      let n=0;
      normals.forEach(x=>{preList().unshift({id:preNextId(),sku:x.sku,name:x.name,spec:x.spec,type:'normal',qty:x.qty,time:preNow(),status:'待使用'});n+=x.qty;});
      window.FM.DB.preCart=preCart().filter(x=>x.weigh);   // 打完移出，留下多退少补待称
      renderPre(box);window.FM.toast(`已预贴打印 ${normals.length} 个商品共 ${n} 张`);
    }});
}

function prePrintWeigh(box,cur){
  const el=box.querySelector('#pre-w');const w=parseFloat((el||{}).value);
  if(!(w>0)){window.FM.toast('请输入本袋净重');if(el)el.focus();return;}
  const rec={id:preNextId(),sku:cur.sku,name:cur.name,spec:cur.spec,type:'weigh',w:+w.toFixed(2),wUnit:cur.unit,qty:1,time:preNow(),status:'待使用'};
  preList().unshift(rec);
  // 只增量插行 + 清空重聚焦：站在秤边连打，不整页重渲
  const tb=box.querySelector('#pre-batch');
  if(tb)tb.insertAdjacentHTML('afterbegin',preBatchRow(rec,cur));
  const c=box.querySelector('#pre-cnt');if(c)c.textContent=preDone(cur.sku)+' 张';
  const db=box.querySelector('#pre-done-btn');if(db)db.style.display='';
  const cd=box.querySelector('[data-done="'+cur.sku+'"]');if(cd)cd.style.display='';
  const cc=box.querySelector('#pre-cart-'+cur.sku);if(cc)cc.textContent=preDone(cur.sku);
  const lg=box.querySelector('#pre-ledger');
  if(lg){const e=lg.querySelector('.empty');if(e)lg.innerHTML='';
    lg.insertAdjacentHTML('afterbegin',preLedgerRow(rec));
    const nr=lg.firstElementChild;if(nr)nr.onclick=()=>preReprint(nr.dataset.pre,box);}
  const lc=box.querySelector('#pre-ledger-cnt');
  if(lc)lc.textContent=`${preList().length} 条 · ${preList().reduce((a,x)=>a+x.qty,0)} 张`;
  if(el){el.value='';el.focus();}
  window.FM.toast(`已打印 ${rec.id} · ${rec.w.toFixed(2)}${rec.wUnit}`);
}

function preWeighDone(sku,box){
  const n=preDone(sku);
  if(!n){window.FM.toast('该商品还没打过标签');return;}
  const i=cartIdx(sku);const nm=i>=0?preCart()[i].name:'';
  if(i>=0)preCart().splice(i,1);
  state.preSku='';renderPre(box);window.FM.toast(`「${nm}」已完成 ${n} 袋预贴，已移出清单`);
}

function preReprint(id,box){
  const r=preList().find(x=>x.id===id);if(!r)return;
  if(r.type==='weigh'){
    window.FM.confirmDialog({title:'补打这张预贴标签',
      body:`${r.name} · ${r.id}<br>本袋净重 <b>${r.w.toFixed(2)}${r.wUnit}</b><br>原样重出这一张，不改重量、不发新号。<b>请销毁旧标签</b>。`,
      okText:'确认补打',onOk:()=>{r.re=(r.re||0)+1;renderPre(box);window.FM.toast(`已原样补打 ${r.id}`);}});
  }else{
    window.FM.sheet([1,2,5,10,20].map(n=>({label:`补打 ${n} 张`,
      onClick:()=>{r.re=(r.re||0)+n;renderPre(box);window.FM.toast(`已补打「${r.name}」${n} 张`);}})));
  }
}

/* ================= 标签打印 · SKU 详情页（点击进入打印） ================= */
function rowOf(key){const [wh,sku]=key.split('|');const m=metaOf(sku);let qty=0,name='',unit='件';
  pend().forEach(o=>{if(o.warehouse!==wh)return;(o.lines||[]).forEach(l=>{if(l.sku!==sku)return;qty+=(+l.qty||0);name=l.name;unit=l.unit;});});
  const ps=(typeof PS_QTY==='function')?PS_QTY(name,wh):0;
  return {key,wh,sku,name,unit,ordQty:qty,psQty:ps,qty:qty+ps,cat:m.cat,spec:m.spec,refund:m.refund};}
const printer=()=>{window.FM.DB.printer=window.FM.DB.printer||{connected:false,name:''};return window.FM.DB.printer;};
function connectPrinter(then){window.FM.sheet([
  {label:'FoodMax 标签机 · TSC-A1（蓝牙）',onClick:()=>{const p=printer();p.connected=true;p.name='TSC-A1';window.FM.toast('已连接 TSC-A1 标签机','ok');then&&then();}},
  {label:'Brother QL-820NWB（蓝牙）',onClick:()=>{const p=printer();p.connected=true;p.name='QL-820';window.FM.toast('已连接 QL-820 标签机','ok');then&&then();}},
]);}
let CURLP=null;
function reallyPrint(key){window.FM.DB.labelPrinted=window.FM.DB.labelPrinted||{};const r=rowOf(key);const old=Math.min(r.qty,printedOf(key));
  if(old>=r.qty){window.FM.toast('该商品标签已全部打印','info');return;}
  window.FM.DB.labelPrinted[key]=r.qty;
  window.FM.toast(`已打印「${r.name}」序号 ${old+1}–${r.qty}，共 ${r.qty-old} 张（印实发净重）`,'ok');
  drawLabelDetail(CURLP.querySelector('#lpd'),key);
  if(LBTAB==='print'&&LBROOT){const b=LBROOT.querySelector('#lb-body');if(b)renderPrint(b);}}   // 同步刷新底层列表，返回即最新
function onPrintClick(key){const r=rowOf(key);
  if(r.refund&&!weighed(key)){window.FM.toast('该商品为多退少补，请先在「称重商品」完成称重','err');return;}
  if(Math.min(r.qty,printedOf(key))>=r.qty){window.FM.toast('该商品标签已全部打印','info');return;}
  if(!printer().connected){connectPrinter(()=>reallyPrint(key));return;}
  reallyPrint(key);}
function goWeighFor(){window.FM.popPage();LBTAB='weigh';if(LBROOT)mount(LBROOT);}
window.lp_goWeigh=goWeighFor;
// 按序号打印 / 补打：点弱按钮弹窗填 [起始,结束] 区间，漏打时补打指定几张
window.lp_seqModal=function(key){const r=rowOf(key);
  if(r.refund&&!weighed(key)){window.FM.toast('该商品为多退少补，请先完成称重','err');return;}
  const N=r.qty,pr=Math.min(r.qty,printedOf(key));
  const m=document.createElement('div');m.className='modal-mask';
  m.innerHTML=`<div class="modal"><div class="mt">按序号打印 / 补打</div>
    <div class="mb" style="text-align:left">
      <div style="font-size:12.5px;color:var(--sub);line-height:1.6;margin-bottom:13px">${r.name} · 共 <b>${N}</b> 张，序号 1–${N}${pr?` · 已打印至 ${pr}`:''}。漏打哪几张就填哪段序号。</div>
      <div style="display:flex;align-items:center;gap:10px;justify-content:center"><input id="lpm-from" class="lpm-in" type="number" inputmode="numeric" min="1" max="${N}" value="${Math.min(pr+1,N)}"><span style="color:var(--sub)">—</span><input id="lpm-to" class="lpm-in" type="number" inputmode="numeric" min="1" max="${N}" value="${N}"></div>
    </div>
    <div class="mf"><div class="mbn cancel">取消</div><div class="mbn ok">打印</div></div></div>`;
  document.querySelector('.phone').appendChild(m);
  const close=()=>m.remove();
  m.querySelector('.cancel').onclick=close;m.onclick=e=>{if(e.target===m)close();};
  m.querySelector('.ok').onclick=()=>{
    const from=parseInt(m.querySelector('#lpm-from').value,10),to=parseInt(m.querySelector('#lpm-to').value,10);
    if(isNaN(from)||isNaN(to)||from<1||to>N||from>to){window.FM.toast(`请填有效序号区间（1–${N}，起始 ≤ 结束）`,'err');return;}
    close();
    const doIt=()=>{window.FM.DB.labelPrinted=window.FM.DB.labelPrinted||{};
      window.FM.DB.labelPrinted[key]=Math.max(printedOf(key),to);
      window.FM.toast(`已按序号打印「${r.name}」序号 ${from}–${to}，共 ${to-from+1} 张`,'ok');
      drawLabelDetail(CURLP.querySelector('#lpd'),key);
      if(LBTAB==='print'&&LBROOT){const b=LBROOT.querySelector('#lb-body');if(b)renderPrint(b);}};
    if(!printer().connected){connectPrinter(doIt);return;}
    doIt();};};
function drawLabelDetail(box,key){
  const r=rowOf(key);const pr=Math.min(r.qty,printedOf(key)),un=r.qty-pr;
  const gated=r.refund&&!weighed(key);const p=printer();
  box.innerHTML=`
    <div class="wg-dh">
      <div class="r"><span class="k">仓库</span><span class="v">${r.wh}</span></div>
      <div class="r"><span class="k">规格 / 编码</span><span class="v">${r.spec||'—'} · ${r.sku}</span></div>
      <div class="r"><span class="k">分类</span><span class="v">${r.cat}</span></div>
      ${r.refund?`<div class="r"><span class="k">称重状态</span><span class="v ${gated?'refund':''}">${gated?'待称重':'已称重 ✓'}</span></div>`:''}
    </div>
    <div class="lb-sum"><div class="k"><div class="v">${r.qty}</div><div class="l">应送货(张)</div></div><div class="k"><div class="v g">${pr}</div><div class="l">已打印</div></div><div class="k"><div class="v r">${un}</div><div class="l">未打印</div></div></div>
    ${gated?`<div class="lp-gatetip">⚠️ 该商品为<b>多退少补</b>（按重量定价），需先录实发净重才能打印标签、印实发重量。<span class="go" onclick="lp_goWeigh()">去称重 →</span></div>`
      :`<div class="lp-printer">🖨 ${p.connected?`已连接 <b>${p.name}</b> 标签机`:'未连接标签机 · 点打印时自动搜索蓝牙连接'}</div>
        <div class="lp-seqlink" onclick="lp_seqModal('${key}')">🔢 按序号打印 / 补打</div>`}
    <div style="height:14px"></div>`;
  refreshPrintFooter(key);
}
function refreshPrintFooter(key){if(!CURLP)return;const btn=CURLP.querySelector('#lp-print');if(!btn)return;
  const r=rowOf(key);const pr=Math.min(r.qty,printedOf(key)),un=r.qty-pr;const gated=r.refund&&!weighed(key);
  btn.disabled=false;btn.style.opacity='';
  if(gated){btn.textContent='🔒 请先完成称重';btn.className='btn';btn.style.opacity='.55';}
  else if(un<=0){btn.textContent='✓ 已全部打印';btn.className='btn';btn.disabled=true;}
  else{btn.textContent=`🖨 打印 ${un} 张标签`;btn.className='btn primary';}}
function openLabelDetail(key){const r=rowOf(key);
  CURLP=pushPage({title:'打印标签 · '+r.name,body:'<div id="lpd"></div>',
    footer:`<button class="btn primary" id="lp-print">🖨 打印标签</button>`,
    mount:(p)=>{CURLP=p;drawLabelDetail(p.querySelector('#lpd'),key);const b=p.querySelector('#lp-print');if(b)b.onclick=()=>onPrintClick(key);}});
}

/* ================= Tab 容器 ================= */
let LBTAB='print',LBROOT=null;
function renderActive(bodyEl){
  if(LBTAB==='print'){bodyEl.innerHTML=skel(3);setTimeout(()=>renderPrint(bodyEl),380);}
  else if(LBTAB==='pre'){renderPre(bodyEl);}
  else{if(window.FM_WEIGH&&window.FM_WEIGH.render)window.FM_WEIGH.render(bodyEl);else bodyEl.innerHTML='<div class="empty"><h4>称重模块未加载</h4></div>';}
}
function mount(root){
  LBROOT=root;
  root.innerHTML=`<div class="lb-tabs">
    <div class="lb-tab ${LBTAB==='print'?'on':''}" data-t="print">🏷️ 标签打印</div>
    <div class="lb-tab ${LBTAB==='pre'?'on':''}" data-t="pre">📦 按商品打印</div>
    <div class="lb-tab ${LBTAB==='weigh'?'on':''}" data-t="weigh">⚖️ 称重商品</div>
  </div><div id="lb-body"></div>`;
  const body=root.querySelector('#lb-body');
  root.querySelectorAll('.lb-tab').forEach(t=>t.onclick=()=>{LBTAB=t.dataset.t;mount(root);});
  renderActive(body);
}

window.FM_MOD=window.FM_MOD||{};
window.FM_MOD.label=()=>pushPage({title:'打印标签',body:'<div id="lbp"></div>',mount:(p)=>mount(p.querySelector('#lbp'))});
})();
