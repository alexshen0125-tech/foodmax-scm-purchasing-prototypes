/* Food Max 商家端 v2 · 称重商品（多退少补逐件称重，自 PC「称重录入」搬迁）
   口径对齐 PC：多退少补(refund=1)商品按 S$/kg 计价，分装成【件】，一件应发净重=规格量(1kg)；
   逐件录实发净重 → 差异=实发−应发、差异率=差异/应发；容差2%内不结差额，超+15%/−20%拦截；
   发货差额=Σ各件差额(超容差件)×(S$/kg)。提交后锁定，并解锁该 SKU 在「标签打印」的打印门禁。
   归拢=仓库×SKU；数据源 FM.DB.orders(pending)，规格/多退少补取自 window.FM_SKU_META。前缀 wg-。 */
(function(){
const {svg,skel,toast,confirmDialog}=window.FM;
const CFG={tol:.02,up:.15,down:.20};   // 容差 / 超收拦截 / 超退拦截
const S=v=>'S$'+(+v||0).toFixed(2);

const css=document.createElement('style');
css.textContent=`
.wg-card{background:#fff;border-radius:16px;margin:13px 16px 0;padding:14px 15px;box-shadow:var(--sh-sm);}
.wg-h{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;}
.wg-nm{font-size:15px;font-weight:700;}
.wg-st{font-size:10.5px;font-weight:700;border-radius:7px;padding:2px 8px;margin-left:6px;white-space:nowrap;}
.wg-st.wait{color:var(--amber);background:var(--amber-soft);}
.wg-st.ok{color:var(--emerald-2);background:var(--mint-soft);}
.wg-st.add{color:#B45309;background:var(--amber-soft);}
.wg-st.refund{color:var(--red);background:var(--red-soft);}
.wg-st.block{color:var(--red);background:var(--red-soft);}
.wg-st.done{color:var(--sub);background:var(--muted);}
.wg-amt{font-size:13px;font-weight:700;text-align:right;white-space:nowrap;}
.wg-amt.add{color:#B45309;}.wg-amt.refund{color:var(--red);}.wg-amt.zero{color:var(--sub);}
.wg-meta{font-size:11.5px;color:var(--sub);margin-top:5px;}
.wg-acts{display:flex;gap:9px;margin-top:11px;}
.wg-btn{flex:1;min-height:40px;border-radius:11px;font-size:13.5px;font-weight:700;display:flex;align-items:center;justify-content:center;cursor:pointer;}
.wg-btn.ghost{background:var(--muted);color:#46604F;}
.wg-btn.primary{background:var(--emerald);color:#fff;}
.wg-btn.disabled{background:#BFD8CD;color:#fff;pointer-events:none;}
.wg-grid{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px;}
.wg-p{width:calc(25% - 6px);}
.wg-p .pl{font-size:10.5px;color:var(--sub);margin-bottom:3px;}
.wg-p input{width:100%;height:34px;border:1px solid var(--line);border-radius:9px;text-align:center;font-size:13px;font-family:inherit;color:var(--ink);}
.wg-p input.bad{border-color:var(--red);color:var(--red);}
.wg-p .pd{font-size:10px;text-align:center;margin-top:2px;min-height:13px;}
.wg-p .pd.add{color:#B45309;}.wg-p .pd.refund{color:var(--red);}.wg-p .pd.ok{color:var(--emerald-2);}.wg-p .pd.block{color:var(--red);}
.wg-done{margin-top:12px;background:var(--muted);border-radius:11px;padding:11px 13px;font-size:12px;color:#46604F;line-height:1.6;}
`;
document.head.appendChild(css);

const pend=()=>(window.FM.DB.orders||[]).filter(o=>o.status==='pending');
const state={date:null,wh:''};
const store=()=>{window.FM.DB.weigh=window.FM.DB.weigh||{};return window.FM.DB.weigh;};

function calcP(w,spec,up){
  if(w===''||w==null||isNaN(w))return{filled:false,diff:0,amt:0,st:'wait'};
  const diff=+(w-spec).toFixed(2),rate=spec?diff/spec:0;
  if(w<=0)return{filled:true,diff,amt:0,st:'block',msg:'必须>0'};
  if(w>spec*3)return{filled:true,diff,amt:0,st:'block',msg:'异常'};
  if(rate>CFG.up)return{filled:true,diff,amt:0,st:'block',msg:`超+${CFG.up*100|0}%`};
  if(rate<-CFG.down)return{filled:true,diff,amt:0,st:'block',msg:`超−${CFG.down*100|0}%`};
  if(Math.abs(rate)<=CFG.tol)return{filled:true,diff,amt:0,st:'ok'};
  return{filled:true,diff,amt:+(diff*up).toFixed(2),st:diff<0?'refund':'add'};
}

function groups(){
  const META=window.FM_SKU_META||{},f=state,agg={};
  pend().forEach(o=>{
    if(f.date&&o.deliver!==f.date)return;
    if(f.wh&&o.warehouse!==f.wh)return;
    (o.lines||[]).forEach(l=>{const m=META[l.sku];if(!m||!m.refund)return;
      const key=o.warehouse+'|'+l.sku;
      if(!agg[key])agg[key]={key,wh:o.warehouse,sku:l.sku,name:l.name,specQty:m.specQty||1,unit:m.unit||'kg',up:+l.price||0,portionN:0};
      agg[key].portionN+=(+l.qty||0);});
  });
  return Object.values(agg).map(g=>{
    const rec=store()[g.key]||{},ws=rec.ws||{};const ps=[];let filled=0,amtSum=0,blocked=0,realSum=0;
    for(let i=0;i<g.portionN;i++){const p=calcP(ws[i]==null?'':+ws[i],g.specQty,g.up);ps[i]=p;
      if(p.filled){filled++;amtSum+=p.amt;realSum+=+ws[i];if(p.st==='block')blocked++;}}
    amtSum=+amtSum.toFixed(2);
    let st;if(rec.submitted)st='done';else if(blocked)st='block';else if(filled<g.portionN)st='wait';else st=amtSum>0?'add':amtSum<0?'refund':'ok';
    return Object.assign(g,{ws,ps,filled,amtSum,blocked,realSum,st,submitted:!!rec.submitted});
  });
}

function setWs(key,i,v){const s=store();s[key]=s[key]||{ws:{}};s[key].ws=Object.assign({},s[key].ws);
  if(v===''||isNaN(v))delete s[key].ws[i];else s[key].ws[i]=+(+v).toFixed(2);
  s[key].at='2026-07-28 08:20';}

function fillGroup(key){const g=groups().find(x=>x.key===key);if(!g||g.submitted)return;const s=store();s[key]={ws:{},at:'2026-07-28 08:20'};for(let i=0;i<g.portionN;i++)s[key].ws[i]=g.specQty;rerender();toast(`「${g.name}·${g.wh}」${g.portionN} 件已按应发 ${g.specQty}${g.unit}/件 填入，可改称出来不同的件`,'ok');}

function submit(key){const g=groups().find(x=>x.key===key);if(!g)return;
  if(g.filled<g.portionN){toast(`还有 ${g.portionN-g.filled} 件未称重，请称完每一件再提交`,'err');return;}
  if(g.blocked){toast(`有 ${g.blocked} 件超阈值/异常，请复称或重分装后再提交`,'err');return;}
  const tip=g.amtSum>0?`本单需向平台补款 ${S(g.amtSum)}`:g.amtSum<0?`本单平台退款 ${S(-g.amtSum)}`:'各件均在容差内，无差额';
  confirmDialog({title:`提交称重 · ${g.name}`,body:`${g.wh} · ${g.portionN} 件已称重。${tip}。提交后锁定，可到「标签打印」打印该商品标签。`,okText:'确认提交',onOk:()=>{
    const s=store();s[key]=s[key]||{ws:{}};s[key].submitted=true;s[key].amt=g.amtSum;rerender();
    toast('称重已提交，标签打印已解锁','ok');}});}

window.wg_input=function(key,i,v){setWs(key,i,v===''?'':parseFloat(v));rerender();};
window.wg_fill=function(key){fillGroup(key);};
window.wg_submit=function(key){submit(key);};

let ROOT=null;
function rerender(){if(ROOT)renderBody(ROOT);}

function card(g){
  const stTxt={wait:'待称重',ok:'合格·无差额',add:'有差异·补款',refund:'有差异·退款',block:'有件异常',done:'已提交'}[g.st];
  const amtCls=g.amtSum>0?'add':g.amtSum<0?'refund':'zero';
  const amtTxt=g.st==='wait'?'待称重':(g.amtSum>0?`补款 ${S(g.amtSum)}`:g.amtSum<0?`退款 ${S(-g.amtSum)}`:'无差额');
  const grid=g.submitted?'':`<div class="wg-grid">${g.ps.map((p,i)=>{const v=g.ws[i]==null?'':g.ws[i];const cls=p.st==='block'?'bad':'';const dtxt=!p.filled?'':p.st==='block'?p.msg:(p.diff===0?'✓':`${p.diff>0?'+':''}${p.diff}kg`);const dcls=p.st;
    return `<div class="wg-p"><div class="pl">件 ${i+1}</div><input type="number" step="0.01" min="0" value="${v}" placeholder="${g.specQty}" class="${cls}" onchange="wg_input('${g.key}',${i},this.value)"><div class="pd ${dcls}">${dtxt}</div></div>`;}).join('')}</div>`;
  const acts=g.submitted
    ? `<div class="wg-done">✓ 已提交称重 · ${g.amtSum>0?`补款 ${S(g.amtSum)}`:g.amtSum<0?`退款 ${S(-g.amtSum)}`:'无差额'}。可到「标签打印」打印本商品标签（印实发净重）。</div>`
    : `<div class="wg-acts"><div class="wg-btn ghost" onclick="wg_fill('${g.key}')">按应发填入</div><div class="wg-btn ${g.filled===g.portionN&&!g.blocked?'primary':'disabled'}" onclick="wg_submit('${g.key}')">提交称重${g.filled?`（${g.filled}/${g.portionN}）`:''}</div></div>`;
  return `<div class="wg-card">
    <div class="wg-h"><div><span class="wg-nm">${g.name}</span><span class="wg-st ${g.st}">${stTxt}</span></div><div class="wg-amt ${amtCls}">${amtTxt}</div></div>
    <div class="wg-meta">${g.wh} · ${g.portionN} 件 · 应发 ${g.specQty}${g.unit}/件 · ${S(g.up)}/${g.unit}</div>
    ${acts}${grid}
  </div>`;
}

function renderBody(root){
  ROOT=root;
  const ds=[...new Set(pend().map(o=>o.deliver))];if(state.date===null)state.date=ds[0]||'';
  const ws=[...new Set(pend().map(o=>o.warehouse))];
  const gs=groups();
  const waitN=gs.filter(g=>!g.submitted&&g.st==='wait').length;
  const diffN=gs.filter(g=>g.st==='add'||g.st==='refund').length;
  const amtSum=+gs.filter(g=>g.submitted).reduce((a,g)=>a+g.amtSum,0).toFixed(2);
  const pill=(val,cur,attr)=>`<span class="lb-pill ${cur===val?'on':''}" data-${attr}="${val}">`;
  root.innerHTML=`
    <div class="lb-note">⚖️ 多退少补（按重量定价）商品需逐件录实发净重：一件应发净重=规格量。超容差 ±2% 才结差额，超 +15%/−20% 拦截需复称。提交后锁定并解锁标签打印。</div>
    <div class="lb-filter">
      <div class="lb-frow"><span class="lb-fl">配送日期</span><div class="lb-pills">${ds.map(d=>`${pill(d,state.date,'date')}${d}</span>`).join('')||'<span class="lb-pill on">无</span>'}</div></div>
      <div class="lb-frow"><span class="lb-fl">仓库</span><div class="lb-pills">${pill('',state.wh,'wh')}全部</span>${ws.map(w=>`${pill(w,state.wh,'wh')}${w}</span>`).join('')}</div></div>
    </div>
    <div class="lb-sum"><div class="k"><div class="v r">${waitN}</div><div class="l">待称重</div></div><div class="k"><div class="v">${diffN}</div><div class="l">有差异</div></div><div class="k"><div class="v ${amtSum>0?'':amtSum<0?'r':''}">${amtSum>0?'+':''}${S(amtSum).slice(2)}</div><div class="l">发货差额(S$)</div></div></div>
    ${gs.length?gs.map(card).join(''):`<div class="empty"><div class="ei">${svg('layers')}</div><h4>该筛选下无多退少补商品</h4><p>只有按重量定价（多退少补）的商品才需称重</p></div>`}
    <div style="height:12px"></div>`;
  root.querySelectorAll('[data-date]').forEach(el=>el.onclick=()=>{state.date=el.dataset.date;renderBody(root);});
  root.querySelectorAll('[data-wh]').forEach(el=>el.onclick=()=>{state.wh=el.dataset.wh;renderBody(root);});
}

window.FM_WEIGH={render(box){box.innerHTML=skel(2);setTimeout(()=>renderBody(box),380);}};
})();
