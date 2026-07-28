/* Food Max 商家端 v2 · 称重商品（多退少补逐件称重，自 PC「称重录入」搬迁）
   移动端两级结构（mobile-ux 标准：一屏一主任务 + 渐进式呈现）：
     ① 列表 = 每个 仓库×SKU 一张摘要卡（进度/状态/差额），不在列表里塞输入框；
     ② 点卡 → 专注子页：一列式逐件输入 + 底部拇指区「提交称重」。
   口径对齐 PC：一件应发=规格量(1kg)，diff=实发−应发；容差±2%不结差额，超+15%/−20%拦截；
   发货差额=Σ超容差件差额×(S$/kg)。提交锁定并解锁该 SKU 的标签打印。前缀 wg-。 */
(function(){
const {pushPage,svg,skel,toast,confirmDialog}=window.FM;
const CFG={tol:.02,up:.15,down:.20};
const S=v=>'S$'+(+v||0).toFixed(2);

const css=document.createElement('style');
css.textContent=`
/* 列表摘要卡 */
.wg-card{background:#fff;border-radius:18px;margin:13px 16px 0;padding:15px 16px;box-shadow:var(--sh-sm);cursor:pointer;}
.wg-ch{display:flex;align-items:center;justify-content:space-between;gap:10px;}
.wg-nm{font-size:15.5px;font-weight:700;}
.wg-st{font-size:11px;font-weight:700;border-radius:8px;padding:3px 9px;white-space:nowrap;}
.wg-st.wait{color:var(--amber);background:var(--amber-soft);}
.wg-st.ready{color:var(--emerald-2);background:var(--mint-soft);}
.wg-st.block{color:var(--red);background:var(--red-soft);}
.wg-st.done{color:var(--sub);background:var(--muted);}
.wg-meta{font-size:12px;color:var(--sub);margin-top:6px;}
.wg-prog{height:7px;border-radius:5px;background:var(--muted);overflow:hidden;margin-top:12px;}
.wg-prog i{display:block;height:100%;background:var(--emerald);border-radius:5px;transition:width .3s;}
.wg-cf{display:flex;align-items:center;justify-content:space-between;margin-top:10px;}
.wg-cf .pg{font-size:12px;color:var(--sub);}
.wg-cf .pg b{color:var(--ink);}
.wg-cf .go{font-size:13px;font-weight:700;color:var(--emerald-2);display:flex;align-items:center;gap:3px;}
.wg-cf .amt{font-size:13px;font-weight:700;}
.wg-cf .amt.add{color:#B45309;}.wg-cf .amt.refund{color:var(--red);}.wg-cf .amt.zero{color:var(--sub);}
/* 子页 · 专注称重 */
.wg-dh{background:#fff;margin:13px 16px 0;border-radius:16px;padding:15px 16px;box-shadow:var(--sh-sm);}
.wg-dh .r{display:flex;justify-content:space-between;font-size:13px;margin-bottom:6px;}
.wg-dh .r:last-of-type{margin-bottom:0;}
.wg-dh .r .k{color:var(--sub);}.wg-dh .r .v{font-weight:700;}
.wg-dh .r .v.add{color:#B45309;}.wg-dh .r .v.refund{color:var(--red);}
.wg-fill{margin:12px 16px 0;background:var(--mint-soft);color:var(--emerald-2);border-radius:13px;min-height:48px;display:flex;align-items:center;justify-content:center;gap:7px;font-size:14px;font-weight:700;cursor:pointer;}
.wg-hint{margin:12px 16px 6px;font-size:12px;color:var(--sub);}
.wg-list{background:#fff;border-radius:16px;margin:0 16px;box-shadow:var(--sh-sm);overflow:hidden;}
.wg-prow{display:flex;align-items:center;gap:12px;padding:10px 15px;min-height:56px;}
.wg-prow+.wg-prow{border-top:1px solid var(--line);}
.wg-prow .idx{font-size:13.5px;color:var(--sub);font-weight:600;width:52px;flex:0 0 52px;}
.wg-prow .inp{flex:1;position:relative;}
.wg-prow .inp input{width:100%;height:46px;border:1.5px solid var(--line);border-radius:12px;text-align:right;padding:0 40px 0 14px;font-size:17px;font-family:inherit;color:var(--ink);}
.wg-prow .inp input:focus{border-color:var(--emerald);outline:none;}
.wg-prow .inp input.bad{border-color:var(--red);color:var(--red);}
.wg-prow .inp .u{position:absolute;right:14px;top:50%;transform:translateY(-50%);font-size:13px;color:var(--sub);}
.wg-prow .d{flex:0 0 84px;text-align:right;font-size:12px;font-weight:700;}
.wg-prow .d.add{color:#B45309;}.wg-prow .d.refund{color:var(--red);}.wg-prow .d.ok{color:var(--emerald-2);}.wg-prow .d.block{color:var(--red);}.wg-prow .d.wait{color:var(--sub);font-weight:500;}
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

function rawGroups(){
  const META=window.FM_SKU_META||{},f=state,agg={};
  pend().forEach(o=>{
    if(f.date&&o.deliver!==f.date)return;
    if(f.wh&&o.warehouse!==f.wh)return;
    (o.lines||[]).forEach(l=>{const m=META[l.sku];if(!m||!m.refund)return;
      const key=o.warehouse+'|'+l.sku;
      if(!agg[key])agg[key]={key,wh:o.warehouse,sku:l.sku,name:l.name,specQty:m.specQty||1,unit:m.unit||'kg',up:+l.price||0,portionN:0};
      agg[key].portionN+=(+l.qty||0);});
  });
  return agg;
}
function decorate(g){
  const rec=store()[g.key]||{},ws=rec.ws||{};const ps=[];let filled=0,amtSum=0,blocked=0;
  for(let i=0;i<g.portionN;i++){const p=calcP(ws[i]==null?'':+ws[i],g.specQty,g.up);ps[i]=p;
    if(p.filled){filled++;amtSum+=p.amt;if(p.st==='block')blocked++;}}
  amtSum=+amtSum.toFixed(2);
  let st;if(rec.submitted)st='done';else if(blocked)st='block';else if(filled<g.portionN)st='wait';else st='ready';
  return Object.assign(g,{ws,ps,filled,amtSum,blocked,st,submitted:!!rec.submitted});
}
function groups(){return Object.values(rawGroups()).map(decorate);}
function groupOf(key){const g=rawGroups()[key];return g?decorate(g):null;}

function setWs(key,i,v){const s=store();s[key]=s[key]||{ws:{}};s[key].ws=Object.assign({},s[key].ws);
  if(v===''||isNaN(v))delete s[key].ws[i];else s[key].ws[i]=+(+v).toFixed(2);s[key].at='2026-07-28 08:20';}

/* ===== 子页：单个 SKU 专注称重 ===== */
let CURPAGE=null;
function amtLine(g){return g.amtSum>0?`补款 ${S(g.amtSum)}`:g.amtSum<0?`退款 ${S(-g.amtSum)}`:'无差额';}
function drawDetail(box,key){
  const g=groupOf(key);if(!g)return;const ro=g.submitted;
  box.innerHTML=`
    <div class="wg-dh">
      <div class="r"><span class="k">${g.wh} · 应发净重</span><span class="v">${g.specQty}${g.unit}/件 · ${S(g.up)}/${g.unit}</span></div>
      <div class="r"><span class="k">已称重</span><span class="v">${g.filled} / ${g.portionN} 件</span></div>
      <div class="r"><span class="k">发货差额</span><span class="v ${g.amtSum>0?'add':g.amtSum<0?'refund':''}">${amtLine(g)}</span></div>
    </div>
    ${ro?'<div class="wg-hint">✓ 已提交，不可修改。可到「标签打印」打印本商品标签（印实发净重）。</div>'
        :`<div class="wg-fill" onclick="wg_fill('${key}')">${svg('leaf','style="width:16px;height:16px;stroke:var(--emerald-2)"')} 全部按应发填入（${g.specQty}${g.unit} × ${g.portionN}）</div>
          <div class="wg-hint">逐件录实发净重，大多数=应发，直接填入后只改称出来不同的件。超 ±2% 才结差额。</div>`}
    <div class="wg-list">${g.ps.map((p,i)=>{const v=g.ws[i]==null?'':g.ws[i];
      const dtxt=!p.filled?'待录':p.st==='block'?p.msg:p.diff===0?'✓ 合格':`${p.diff>0?'+':''}${p.diff}${g.unit}`;
      return `<div class="wg-prow"><span class="idx">第 ${i+1} 件</span>
        <div class="inp"><input type="number" inputmode="decimal" step="0.01" min="0" value="${v}" placeholder="${g.specQty}" class="${p.st==='block'?'bad':''}" ${ro?'disabled':''} onchange="wg_input('${key}',${i},this.value)"><span class="u">${g.unit}</span></div>
        <span class="d ${p.st}">${dtxt}</span></div>`;}).join('')}</div>
    <div style="height:14px"></div>`;
  refreshFooter(key);
}
function refreshFooter(key){if(!CURPAGE)return;const sub=CURPAGE.querySelector('#wg-sub');if(!sub)return;const g=groupOf(key);
  if(g.submitted){sub.textContent='已提交称重';sub.disabled=true;return;}
  const ready=g.filled===g.portionN&&!g.blocked;
  sub.textContent=g.blocked?`有 ${g.blocked} 件超阈值`:`提交称重（${g.filled}/${g.portionN}）`;
  sub.disabled=!ready;}
function openSku(key){const g=groupOf(key);if(!g)return;
  CURPAGE=pushPage({title:'称重 · '+g.name,body:'<div id="wgd"></div>',
    footer:`<button class="btn primary" id="wg-sub">提交称重</button>`,
    mount:(p)=>{CURPAGE=p;drawDetail(p.querySelector('#wgd'),key);const sub=p.querySelector('#wg-sub');if(sub)sub.onclick=()=>submit(key);}});
}

window.wg_input=function(key,i,v){setWs(key,i,v===''?'':parseFloat(v));
  const g=groupOf(key),p=g.ps[i],box=CURPAGE&&CURPAGE.querySelector('#wgd');if(!box)return;
  const row=box.querySelectorAll('.wg-prow')[i];   // 只更新该件的差异标 + 头部 + 底部，避免整页重刷导致滚动跳顶
  if(row){const inp=row.querySelector('input');if(inp)inp.classList.toggle('bad',p.st==='block');
    const d=row.querySelector('.d');if(d){d.className='d '+p.st;d.textContent=!p.filled?'待录':p.st==='block'?p.msg:p.diff===0?'✓ 合格':`${p.diff>0?'+':''}${p.diff}${g.unit}`;}}
  const vs=box.querySelectorAll('.wg-dh .r .v');
  if(vs[1])vs[1].textContent=`${g.filled} / ${g.portionN} 件`;
  if(vs[2]){vs[2].textContent=amtLine(g);vs[2].className='v '+(g.amtSum>0?'add':g.amtSum<0?'refund':'');}
  refreshFooter(key);};
window.wg_fill=function(key){const g=groupOf(key);if(!g||g.submitted)return;const s=store();s[key]={ws:{},at:'2026-07-28 08:20'};for(let i=0;i<g.portionN;i++)s[key].ws[i]=g.specQty;drawDetail(CURPAGE.querySelector('#wgd'),key);toast(`已按应发 ${g.specQty}${g.unit}/件 填入 ${g.portionN} 件`,'ok');};

function submit(key){const g=groupOf(key);if(!g||g.submitted)return;
  if(g.filled<g.portionN){toast(`还有 ${g.portionN-g.filled} 件未称重`,'err');return;}
  if(g.blocked){toast(`有 ${g.blocked} 件超阈值/异常，请复称`,'err');return;}
  confirmDialog({title:`提交称重 · ${g.name}`,body:`${g.wh} · ${g.portionN} 件已称重，${amtLine(g)}。提交后锁定，可到「标签打印」打印本商品标签。`,okText:'确认提交',onOk:()=>{
    const s=store();s[key]=s[key]||{ws:{}};s[key].submitted=true;s[key].amt=g.amtSum;
    toast('称重已提交，标签打印已解锁','ok');window.FM.popPage();if(LISTBOX)renderBody(LISTBOX);}});}

/* ===== 列表 Tab ===== */
let LISTBOX=null;
function card(g){
  const stTxt={wait:'待称重',ready:'待提交',block:'有件异常',done:'已提交'}[g.st];
  const pct=g.portionN?Math.round(g.filled/g.portionN*100):0;
  const amtCls=g.amtSum>0?'add':g.amtSum<0?'refund':'zero';
  const amtTxt=g.st==='wait'?'':(g.amtSum>0?`补款 ${S(g.amtSum)}`:g.amtSum<0?`退款 ${S(-g.amtSum)}`:'无差额');
  return `<div class="wg-card" data-key="${g.key}">
    <div class="wg-ch"><span class="wg-nm">${g.name}</span><span class="wg-st ${g.st==='ready'?'ready':g.st}">${stTxt}</span></div>
    <div class="wg-meta">${g.wh} · ${g.portionN} 件 · 应发 ${g.specQty}${g.unit}/件 · ${S(g.up)}/${g.unit}</div>
    <div class="wg-prog"><i style="width:${pct}%"></i></div>
    <div class="wg-cf"><span class="pg">已称 <b>${g.filled}/${g.portionN}</b> 件${amtTxt?` · <span class="amt ${amtCls}">${amtTxt}</span>`:''}</span>
      <span class="go">${g.submitted?'查看':'去称重'} ${svg('arrow','style="width:15px;height:15px;stroke:var(--emerald-2)"')}</span></div>
  </div>`;
}
function renderBody(root){
  LISTBOX=root;
  const ds=[...new Set(pend().map(o=>o.deliver))];if(state.date===null)state.date=ds[0]||'';
  const ws=[...new Set(pend().map(o=>o.warehouse))];
  const gs=groups();
  const waitN=gs.filter(g=>!g.submitted).length;
  const doneN=gs.filter(g=>g.submitted).length;
  const amtSum=+gs.filter(g=>g.submitted).reduce((a,g)=>a+g.amtSum,0).toFixed(2);
  const pill=(val,cur,attr)=>`<span class="lb-pill ${cur===val?'on':''}" data-${attr}="${val}">`;
  const df=window.FM_dateField(state.date,ds,d=>{state.date=d;renderBody(root);});
  root.innerHTML=`
    <div class="lb-note">⚖️ 多退少补（按重量定价）商品需逐件录实发净重后才能打标签。点商品进入称重，大多数件按应发一键填入、只改不同的件。</div>
    <div class="lb-filter">
      <div class="lb-frow"><span class="lb-fl">配送日期</span>${df.html}</div>
      <div class="lb-frow"><span class="lb-fl">仓库</span><div class="lb-pills">${pill('',state.wh,'wh')}全部</span>${ws.map(w=>`${pill(w,state.wh,'wh')}${w}</span>`).join('')}</div></div>
    </div>
    <div class="lb-sum"><div class="k"><div class="v r">${waitN}</div><div class="l">待称重</div></div><div class="k"><div class="v g">${doneN}</div><div class="l">已提交</div></div><div class="k"><div class="v ${amtSum>0?'':amtSum<0?'r':''}">${amtSum>0?'+':''}${S(amtSum).slice(2)}</div><div class="l">发货差额(S$)</div></div></div>
    ${gs.length?gs.map(card).join(''):`<div class="empty"><div class="ei">${svg('layers')}</div><h4>该筛选下无多退少补商品</h4><p>只有按重量定价（多退少补）的商品才需称重</p></div>`}
    <div style="height:14px"></div>`;
  root.querySelectorAll('.wg-card').forEach(c=>c.onclick=()=>openSku(c.dataset.key));
  df.bind(root);
  root.querySelectorAll('[data-wh]').forEach(el=>el.onclick=()=>{state.wh=el.dataset.wh;renderBody(root);});
}

window.FM_WEIGH={render(box){box.innerHTML=skel(2);setTimeout(()=>renderBody(box),380);}};
})();
