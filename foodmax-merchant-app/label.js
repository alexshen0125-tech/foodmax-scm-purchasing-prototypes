/* Food Max 商家端 v2 · 打印标签（自 PC「备货管理 › 打印标签」搬迁）
   按「配送日期 + 仓库」把待发货订单聚合到 SKU × 仓库，给出各 SKU 应送货张数（每件一张标签）。
   —— 打印按钮先去掉：本页只做应送货标签清单查看，不含打印/批量打印/按序号打印动作。
   数据源=window.FM.DB.orders（status=pending）。前缀 lb-。 */
(function(){
const {pushPage,svg,skel}=window.FM;

const css=document.createElement('style');
css.textContent=`
.lb-note{margin:12px 16px 0;background:var(--mint-soft);border-radius:14px;padding:12px 14px;font-size:12px;line-height:1.6;color:#27433A;}
.lb-filter{margin:13px 16px 0;background:#fff;border-radius:16px;padding:13px 15px;box-shadow:var(--sh-sm);}
.lb-frow{display:flex;align-items:flex-start;gap:10px;}
.lb-frow+.lb-frow{margin-top:11px;}
.lb-fl{font-size:12.5px;color:var(--sub);font-weight:600;flex:0 0 52px;padding-top:6px;}
.lb-pills{display:flex;flex-wrap:wrap;gap:8px;flex:1;}
.lb-pill{font-size:12.5px;font-weight:600;padding:6px 13px;border-radius:20px;background:var(--muted);color:#46604F;cursor:pointer;min-height:32px;display:flex;align-items:center;}
.lb-pill.on{background:var(--emerald);color:#fff;}
.lb-sum{display:flex;background:#fff;border-radius:16px;margin:13px 16px 0;padding:15px 0;box-shadow:var(--sh-sm);}
.lb-sum .k{flex:1;text-align:center;}.lb-sum .k+.k{border-left:1px solid var(--line);}
.lb-sum .k .v{font-size:23px;font-weight:600;font-family:'Lora',serif;color:var(--emerald-2);}
.lb-sum .k .l{font-size:11.5px;color:var(--sub);margin-top:2px;}
.lb-sec{font-size:14.5px;font-weight:700;margin:17px 16px 8px;display:flex;align-items:center;gap:8px;}
.lb-sec .hint{margin-left:auto;font-size:12px;font-weight:600;color:var(--sub);}
.lb-tbl{background:#fff;border-radius:16px;margin:0 16px;box-shadow:var(--sh-sm);overflow:hidden;}
.lb-row{padding:13px 15px;display:flex;align-items:center;gap:12px;}
.lb-row+.lb-row{border-top:1px solid var(--line);}
.lb-row .l{flex:1;min-width:0;}
.lb-row .nm{font-size:14.5px;font-weight:700;}
.lb-row .sub{font-size:11.5px;color:var(--sub);margin-top:3px;font-family:monospace;}
.lb-row .q{font-size:20px;font-weight:600;font-family:'Lora',serif;color:var(--emerald-2);white-space:nowrap;}
.lb-row .q span{font-size:12px;color:var(--sub);font-family:'Raleway',sans-serif;margin-left:2px;}
`;
document.head.appendChild(css);

const state={date:null,wh:''};   // 筛选：配送日期 / 仓库
const pend=()=>(window.FM.DB.orders||[]).filter(o=>o.status==='pending');
const dates=()=>[...new Set(pend().map(o=>o.deliver))];
const whs=()=>[...new Set(pend().map(o=>o.warehouse))];
function yday(sku){let h=7;for(const c of String(sku))h=(h*31+c.charCodeAt(0))>>>0;return 5+h%95;}  // 昨日销量（稳定伪随机 5–99）

function rows(){
  const f=state,agg={};
  pend().forEach(o=>{
    if(f.date&&o.deliver!==f.date)return;
    if(f.wh&&o.warehouse!==f.wh)return;
    (o.lines||[]).forEach(l=>{const key=o.warehouse+'|'+l.sku;
      if(!agg[key])agg[key]={key,wh:o.warehouse,sku:l.sku,name:l.name,unit:l.unit,qty:0};
      agg[key].qty+=l.qty;});
  });
  return Object.values(agg);
}

function renderBody(box){
  const ds=dates();if(state.date===null)state.date=ds[0]||'';
  const ws=whs();
  const rs=rows();
  const should=rs.reduce((a,r)=>a+r.qty,0);
  const byWh={};rs.forEach(r=>{(byWh[r.wh]=byWh[r.wh]||[]).push(r);});
  const whSet=Object.keys(byWh);
  box.innerHTML=`
    <div class="lb-note">🏷️ 按「配送日期 + 仓库」汇总各 SKU 应送货张数（每件一张标签，序号连续）。多退少补商品按 SKU 打标、印实发净重，不含订单/客户信息，货到仓库由 WMS 统一分拣。</div>
    <div class="lb-filter">
      <div class="lb-frow"><span class="lb-fl">配送日期</span><div class="lb-pills">${ds.map(d=>`<span class="lb-pill ${state.date===d?'on':''}" data-date="${d}">${d}</span>`).join('')||'<span class="lb-pill on">无</span>'}</div></div>
      <div class="lb-frow"><span class="lb-fl">仓库</span><div class="lb-pills"><span class="lb-pill ${state.wh===''?'on':''}" data-wh="">全部</span>${ws.map(w=>`<span class="lb-pill ${state.wh===w?'on':''}" data-wh="${w}">${w}</span>`).join('')}</div></div>
    </div>
    <div class="lb-sum"><div class="k"><div class="v">${should}</div><div class="l">应送货(张)</div></div><div class="k"><div class="v">${rs.length}</div><div class="l">SKU 数</div></div><div class="k"><div class="v">${whSet.length}</div><div class="l">仓库数</div></div></div>
    ${rs.length?whSet.map(w=>`
      <div class="lb-sec">${w}<span class="hint">应送货 ${byWh[w].reduce((a,r)=>a+r.qty,0)} 张</span></div>
      <div class="lb-tbl">${byWh[w].map(r=>`<div class="lb-row">
        <div class="l"><div class="nm">${r.name}</div><div class="sub">${r.sku} · 昨日销量 ${yday(r.sku)}</div></div>
        <div class="q">${r.qty}<span>${r.unit||'件'}</span></div>
      </div>`).join('')}</div>`).join('')
    :`<div class="empty"><div class="ei">${svg('ticket')}</div><h4>该筛选下暂无应送货标签</h4><p>切换配送日期 / 仓库看看，或先在订单里来一单</p></div>`}
    <div style="height:12px"></div>`;
  box.querySelectorAll('[data-date]').forEach(el=>el.onclick=()=>{state.date=el.dataset.date;renderBody(box);});
  box.querySelectorAll('[data-wh]').forEach(el=>el.onclick=()=>{state.wh=el.dataset.wh;renderBody(box);});
}

function render(box){box.innerHTML=skel(3);setTimeout(()=>renderBody(box),420);}

window.FM_MOD=window.FM_MOD||{};
window.FM_MOD.label=()=>pushPage({title:'打印标签',body:'<div id="lbp"></div>',mount:(p)=>render(p.querySelector('#lbp'))});
})();
