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

const css=document.createElement('style');
css.textContent=`
.lb-tabs{display:flex;gap:8px;padding:12px 16px 0;}
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
.lb-sum{display:flex;background:#fff;border-radius:16px;margin:13px 16px 0;padding:15px 0;box-shadow:var(--sh-sm);}
.lb-sum .k{flex:1;text-align:center;}.lb-sum .k+.k{border-left:1px solid var(--line);}
.lb-sum .k .v{font-size:22px;font-weight:600;font-family:'Lora',serif;}
.lb-sum .k .v.g{color:var(--emerald-2);}.lb-sum .k .v.r{color:var(--red);}
.lb-sum .k .l{font-size:11.5px;color:var(--sub);margin-top:2px;}
.lb-sec{font-size:14.5px;font-weight:700;margin:17px 16px 8px;display:flex;align-items:center;gap:8px;}
.lb-sec .hint{margin-left:auto;font-size:12px;font-weight:600;color:var(--sub);}
.lb-tbl{background:#fff;border-radius:16px;margin:0 16px;box-shadow:var(--sh-sm);overflow:hidden;}
.lb-row{padding:13px 15px;}
.lb-row+.lb-row{border-top:1px solid var(--line);}
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
  return Object.values(agg);
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
  box.innerHTML=`
    <div class="lb-note">🏷️ 按「配送日期 + 仓库」汇总各 SKU 应送货张数（每件一张，序号连续）。多退少补商品需先在「称重商品」录实发净重，再打标签、印实发净重。</div>
    <div class="lb-filter">
      <div class="lb-frow"><span class="lb-fl">配送日期</span><div class="lb-pills">${ds.map(d=>`${pill(d,state.date,'date')}${d}</span>`).join('')||'<span class="lb-pill on">无</span>'}</div></div>
      <div class="lb-frow"><span class="lb-fl">仓库</span><div class="lb-pills">${pill('',state.wh,'wh')}全部</span>${ws.map(w=>`${pill(w,state.wh,'wh')}${w}</span>`).join('')}</div></div>
      <div class="lb-frow"><span class="lb-fl">商品名称</span><input class="lb-search" id="lb-name" placeholder="输入商品名 / SKU 编码" value="${state.name||''}"></div>
    </div>
    <div class="lb-sum"><div class="k"><div class="v">${should}</div><div class="l">应送货(张)</div></div><div class="k"><div class="v g">${printed}</div><div class="l">已打印</div></div><div class="k"><div class="v r">${unpr}</div><div class="l">未打印</div></div></div>
    ${rs.length?whSet.map(w=>`
      <div class="lb-sec">${w}<span class="hint">应送货 ${byWh[w].reduce((a,r)=>a+r.qty,0)} 张</span></div>
      <div class="lb-tbl">${byWh[w].map(r=>{const pr=Math.min(r.qty,printedOf(r.key)),un=r.qty-pr;
        const wtag=r.refund?(weighed(r.key)?'<span class="wtag done">已称重</span>':'<span class="wtag wait">待称重</span>'):'';
        return `<div class="lb-row">
        <div class="top"><span class="nm">${r.name}${wtag}${un<=0?'<span class="wtag done">打印完成</span>':''}</span><span class="q">${r.qty}<span>${r.unit||'件'}</span></span></div>
        <div class="meta">规格 ${r.spec||'—'} · <span class="code">${r.sku}</span> · ${r.cat}</div>
        <div class="kv"><span class="i">昨日销量 <b>${yday(r.sku)}</b></span><span class="i">已打印 <b>${pr}</b></span><span class="i">未打印 <b class="${un>0?'r':''}">${un}</b></span></div>
      </div>`;}).join('')}</div>`).join('')
    :`<div class="empty"><div class="ei">${svg('ticket')}</div><h4>该筛选下暂无应送货标签</h4><p>切换配送日期 / 仓库看看</p></div>`}
    <div style="height:12px"></div>`;
  box.querySelectorAll('[data-date]').forEach(el=>el.onclick=()=>{state.date=el.dataset.date;renderPrint(box);});
  box.querySelectorAll('[data-wh]').forEach(el=>el.onclick=()=>{state.wh=el.dataset.wh;renderPrint(box);});
  const s=box.querySelector('#lb-name');if(s)s.oninput=()=>{state.name=s.value.trim();const p=s.selectionStart;renderPrint(box);const n=box.querySelector('#lb-name');if(n){n.focus();n.setSelectionRange(p,p);}};
}

/* ================= Tab 容器 ================= */
let LBTAB='print';
function renderActive(bodyEl){
  if(LBTAB==='print'){bodyEl.innerHTML=skel(3);setTimeout(()=>renderPrint(bodyEl),380);}
  else{if(window.FM_WEIGH&&window.FM_WEIGH.render)window.FM_WEIGH.render(bodyEl);else bodyEl.innerHTML='<div class="empty"><h4>称重模块未加载</h4></div>';}
}
function mount(root){
  root.innerHTML=`<div class="lb-tabs">
    <div class="lb-tab ${LBTAB==='print'?'on':''}" data-t="print">🏷️ 标签打印</div>
    <div class="lb-tab ${LBTAB==='weigh'?'on':''}" data-t="weigh">⚖️ 称重商品</div>
  </div><div id="lb-body"></div>`;
  const body=root.querySelector('#lb-body');
  root.querySelectorAll('.lb-tab').forEach(t=>t.onclick=()=>{LBTAB=t.dataset.t;mount(root);});
  renderActive(body);
}

window.FM_MOD=window.FM_MOD||{};
window.FM_MOD.label=()=>pushPage({title:'打印标签',body:'<div id="lbp"></div>',mount:(p)=>mount(p.querySelector('#lbp'))});
})();
