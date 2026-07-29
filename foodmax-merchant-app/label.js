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
.lp-seq{margin:10px 16px 0;background:transparent;}
.lp-seqhd{display:flex;align-items:center;justify-content:space-between;padding:11px 4px;cursor:pointer;font-size:12.5px;font-weight:600;color:var(--sub);}
.lp-seqhd .chev{font-size:11px;color:var(--sub);}
.lp-seqbody{background:#fff;border-radius:12px;padding:13px 14px;box-shadow:var(--sh-sm);margin-top:2px;}
.lp-seq .s{font-size:11.5px;color:var(--sub);margin:0 0 11px;line-height:1.55;}
.lp-seq .seqrow{display:flex;align-items:center;gap:9px;}
.lp-seq input{width:60px;height:40px;border:1.5px solid var(--line);border-radius:11px;text-align:center;font-size:15px;font-family:inherit;color:var(--ink);}
.lp-seq input:focus{border-color:var(--emerald);outline:none;}
.lp-seq .dash{color:var(--sub);}
.lp-seqbtn{flex:1;height:40px;border-radius:11px;background:var(--muted);color:var(--emerald-2);font-size:13px;font-weight:700;display:flex;align-items:center;justify-content:center;cursor:pointer;border:none;font-family:inherit;}
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

/* ================= 标签打印 · SKU 详情页（点击进入打印） ================= */
function rowOf(key){const [wh,sku]=key.split('|');const m=metaOf(sku);let qty=0,name='',unit='件';
  pend().forEach(o=>{if(o.warehouse!==wh)return;(o.lines||[]).forEach(l=>{if(l.sku!==sku)return;qty+=(+l.qty||0);name=l.name;unit=l.unit;});});
  return {key,wh,sku,name,unit,qty,cat:m.cat,spec:m.spec,refund:m.refund};}
const printer=()=>{window.FM.DB.printer=window.FM.DB.printer||{connected:false,name:''};return window.FM.DB.printer;};
function connectPrinter(then){window.FM.sheet([
  {label:'FoodMax 标签机 · TSC-A1（蓝牙）',onClick:()=>{const p=printer();p.connected=true;p.name='TSC-A1';window.FM.toast('已连接 TSC-A1 标签机','ok');then&&then();}},
  {label:'Brother QL-820NWB（蓝牙）',onClick:()=>{const p=printer();p.connected=true;p.name='QL-820';window.FM.toast('已连接 QL-820 标签机','ok');then&&then();}},
]);}
let CURLP=null,LP_SEQOPEN=false;
window.lp_seqToggle=function(key){LP_SEQOPEN=!LP_SEQOPEN;drawLabelDetail(CURLP.querySelector('#lpd'),key);};
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
// 按序号打印 / 补打：填 [起始,结束] 区间，漏打时补打指定几张
window.lp_seqPrint=function(key){const r=rowOf(key);
  if(r.refund&&!weighed(key)){window.FM.toast('该商品为多退少补，请先完成称重','err');return;}
  const N=r.qty,from=parseInt((CURLP.querySelector('#lp-from')||{}).value,10),to=parseInt((CURLP.querySelector('#lp-to')||{}).value,10);
  if(isNaN(from)||isNaN(to)||from<1||to>N||from>to){window.FM.toast(`请填有效序号区间（1–${N}，起始 ≤ 结束）`,'err');return;}
  const doIt=()=>{window.FM.DB.labelPrinted=window.FM.DB.labelPrinted||{};
    window.FM.DB.labelPrinted[key]=Math.max(printedOf(key),to);
    window.FM.toast(`已按序号打印「${r.name}」序号 ${from}–${to}，共 ${to-from+1} 张`,'ok');
    drawLabelDetail(CURLP.querySelector('#lpd'),key);
    if(LBTAB==='print'&&LBROOT){const b=LBROOT.querySelector('#lb-body');if(b)renderPrint(b);}};
  if(!printer().connected){connectPrinter(doIt);return;}
  doIt();};
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
        <div class="lp-seq">
          <div class="lp-seqhd" onclick="lp_seqToggle('${key}')"><span>🔢 按序号打印 / 补打</span><span class="chev">${LP_SEQOPEN?'收起 ▴':'展开 ▾'}</span></div>
          ${LP_SEQOPEN?`<div class="lp-seqbody">
            <div class="s">本商品共 ${r.qty} 张，序号 1–${r.qty}${pr?` · 已打印至 ${pr}`:''}。上方「打印 N 张」打全部未打印；漏打哪几张在此填序号区间补打。</div>
            <div class="seqrow"><input id="lp-from" type="number" inputmode="numeric" min="1" max="${r.qty}" value="${Math.min(pr+1,r.qty)}"><span class="dash">—</span><input id="lp-to" type="number" inputmode="numeric" min="1" max="${r.qty}" value="${r.qty}"><button class="lp-seqbtn" onclick="lp_seqPrint('${key}')">打印此区间</button></div>
          </div>`:''}
        </div>`}
    <div style="height:14px"></div>`;
  refreshPrintFooter(key);
}
function refreshPrintFooter(key){if(!CURLP)return;const btn=CURLP.querySelector('#lp-print');if(!btn)return;
  const r=rowOf(key);const pr=Math.min(r.qty,printedOf(key)),un=r.qty-pr;const gated=r.refund&&!weighed(key);
  btn.disabled=false;btn.style.opacity='';
  if(gated){btn.textContent='🔒 请先完成称重';btn.className='btn';btn.style.opacity='.55';}
  else if(un<=0){btn.textContent='✓ 已全部打印';btn.className='btn';btn.disabled=true;}
  else{btn.textContent=`🖨 打印 ${un} 张标签`;btn.className='btn primary';}}
function openLabelDetail(key){const r=rowOf(key);LP_SEQOPEN=false;   // 每次进详情默认折叠补打，避免误操作
  CURLP=pushPage({title:'打印标签 · '+r.name,body:'<div id="lpd"></div>',
    footer:`<button class="btn primary" id="lp-print">🖨 打印标签</button>`,
    mount:(p)=>{CURLP=p;drawLabelDetail(p.querySelector('#lpd'),key);const b=p.querySelector('#lp-print');if(b)b.onclick=()=>onPrintClick(key);}});
}

/* ================= Tab 容器 ================= */
let LBTAB='print',LBROOT=null;
function renderActive(bodyEl){
  if(LBTAB==='print'){bodyEl.innerHTML=skel(3);setTimeout(()=>renderPrint(bodyEl),380);}
  else{if(window.FM_WEIGH&&window.FM_WEIGH.render)window.FM_WEIGH.render(bodyEl);else bodyEl.innerHTML='<div class="empty"><h4>称重模块未加载</h4></div>';}
}
function mount(root){
  LBROOT=root;
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
