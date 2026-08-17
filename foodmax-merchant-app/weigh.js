/* Food Max 商家端 v2 · 称重商品（多退少补逐件称重，自 PC「称重录入」搬迁）
   移动端两级结构（mobile-ux 标准：一屏一主任务 + 渐进式呈现）：
     ① 列表 = 每个 仓库×SKU 一张摘要卡（进度/状态/差额），不在列表里塞输入框；
     ② 点卡 → 专注子页：一列式逐件输入 + 底部拇指区「提交称重」。
   ③ 列表分「待称重 / 已称重」两段（seg）——按【件】分：未提交件在待称重，已提交件即刻移到已称重（只读复核）；
   ④ 每件带【标签序号】=「标签打印」里该商品(同仓库同SKU)的序号 1–N，按袋上标签序号对行录入。
   口径对齐 PC：一件应发=规格量(1kg)，diff=实发−应发；容差±2%不结差额，超+15%/−20%拦截；
   发货差额=Σ超容差件差额×(S$/kg)。提交锁定并解锁该 SKU 的标签打印。前缀 wg-。 */
(function(){
const {pushPage,svg,skel,toast,confirmDialog}=window.FM;
const CFG={tol:.02,up:.15,down:.20};
const S=v=>'S$'+(+v||0).toFixed(2);

const css=document.createElement('style');
css.textContent=`
/* 二级分段：待称重 / 已称重 */
.wg-seg{display:flex;gap:6px;background:#fff;border-radius:14px;margin:13px 16px 0;padding:5px;box-shadow:var(--sh-sm);}
.wg-seg .s{flex:1;text-align:center;padding:9px 0;border-radius:10px;font-size:13.5px;font-weight:700;color:var(--sub);cursor:pointer;transition:.16s;}
.wg-seg .s.on{color:#fff;background:var(--emerald);}
.wg-seg .s .n{font-size:12px;font-weight:700;opacity:.85;margin-left:3px;}
/* 列表摘要卡 */
.wg-card{background:#fff;border-radius:18px;margin:13px 16px 0;padding:15px 16px;box-shadow:var(--sh-sm);cursor:pointer;}
.wg-ch{display:flex;align-items:center;justify-content:space-between;gap:10px;}
.wg-nm{font-size:15.5px;font-weight:700;}
.wg-st{font-size:11px;font-weight:700;border-radius:8px;padding:3px 9px;white-space:nowrap;}
.wg-st.wait{color:var(--amber);background:var(--amber-soft);}
.wg-st.part{color:var(--emerald-2);background:var(--mint-soft);}
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
.wg-prow .idx{width:58px;flex:0 0 58px;}
.wg-prow .idx i{display:inline-flex;align-items:center;justify-content:center;min-width:44px;height:26px;padding:0 8px;border:1px solid var(--line);border-radius:9px;font-style:normal;font-size:13px;font-weight:700;color:var(--ink);letter-spacing:.3px;}
.wg-prow .idx i.bad{border-color:var(--red);color:var(--red);}
.wg-prow .idx i.done{border-color:var(--emerald);color:var(--emerald-2);background:var(--mint-soft);}
.wg-prow.subd{background:var(--muted);}
.wg-prow.subd input{background:transparent;color:var(--sub);}
.wg-prow .d.subd{color:var(--emerald-2);}
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
const state={date:null,wh:'',tab:'todo'};
const seqNo=(i,n)=>'#'+String(i+1).padStart(String(n).length,'0');   // 标签序号，与「标签打印」序号一致
function seqRange(idxs,n){const a=idxs.slice().sort((x,y)=>x-y),out=[];let s=null,p=null;   // [0,1,2,5] → #01–#03、#06
  a.forEach(i=>{if(s===null){s=p=i;return;}if(i===p+1){p=i;return;}out.push(s===p?seqNo(s,n):`${seqNo(s,n)}–${seqNo(p,n)}`);s=p=i;});
  if(s!==null)out.push(s===p?seqNo(s,n):`${seqNo(s,n)}–${seqNo(p,n)}`);return out.join('、');}
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
  const rec=store()[g.key]||{},ws=rec.ws||{},sub=rec.sub||{};const ps=[];
  let filled=0,amtSum=0,blocked=0,subN=0,subReal=0,subAmt=0,ready=0;
  for(let i=0;i<g.portionN;i++){const p=calcP(ws[i]==null?'':+ws[i],g.specQty,g.up);p.subd=!!sub[i];ps[i]=p;
    if(p.filled){filled++;amtSum+=p.amt;if(p.st==='block')blocked++;
      if(p.subd){subN++;subReal+=+ws[i];subAmt+=p.amt;}else if(p.st!=='block')ready++;}}   // ready=已录未提交且合规，本次可提交
  amtSum=+amtSum.toFixed(2);subReal=+subReal.toFixed(2);subAmt=+subAmt.toFixed(2);
  const allSub=subN>0&&subN===g.portionN;
  let st;if(allSub)st='done';else if(blocked)st='block';else if(subN)st='part';else if(filled<g.portionN)st='wait';else st='ready';
  return Object.assign(g,{ws,sub,ps,filled,amtSum,blocked,subN,subReal,subAmt,ready,allSub,st,submitted:allSub});
}
function groups(){return Object.values(rawGroups()).map(decorate);}
function groupOf(key){const g=rawGroups()[key];return g?decorate(g):null;}

function setWs(key,i,v){const s=store();s[key]=s[key]||{ws:{}};s[key].ws=Object.assign({},s[key].ws);
  if(v===''||isNaN(v))delete s[key].ws[i];else s[key].ws[i]=+(+v).toFixed(2);s[key].at='2026-07-28 08:20';}

/* ===== 子页：单个 SKU 专注称重 ===== */
let CURPAGE=null,CURTAB='todo';
function amtLine(g){return g.amtSum>0?`补款 ${S(g.amtSum)}`:g.amtSum<0?`退款 ${S(-g.amtSum)}`:'无差额';}
/* 本页签该出的件：待称重=未提交件，已称重=已提交件 */
function visOf(g,todo){const a=[];for(let i=0;i<g.portionN;i++)if(!!g.ps[i].subd===!todo)a.push(i);return a;}
function drawDetail(box,key){
  const g=groupOf(key);if(!g)return;const todo=CURTAB!=='done';
  const vis=visOf(g,todo);
  const visAmt=+vis.reduce((a,i)=>a+g.ps[i].amt,0).toFixed(2);
  const visReal=+vis.reduce((a,i)=>a+(+g.ws[i]||0),0).toFixed(2);
  const visFill=vis.filter(i=>g.ps[i].filled).length;
  const amtTxt=visAmt>0?`补款 ${S(visAmt)}`:visAmt<0?`退款 ${S(-visAmt)}`:'无差额';
  box.innerHTML=`
    <div class="wg-dh">
      <div class="r"><span class="k">${g.wh} · 应发净重</span><span class="v">${g.specQty}${g.unit}/件 · ${S(g.up)}/${g.unit}</span></div>
      <div class="r"><span class="k">${todo?'待提交':'已提交'}标签序号</span><span class="v">${vis.length?seqRange(vis,g.portionN):'—'}</span></div>
      <div class="r"><span class="k">${todo?'已录实发':'已提交件数'}</span><span class="v" id="wg-filled">${todo?`${visFill} / ${vis.length} 件`:`${vis.length} / ${g.portionN} 件`}</span></div>
      <div class="r"><span class="k">实发合计</span><span class="v" id="wg-real">${visReal}${g.unit}</span></div>
      <div class="r"><span class="k">发货差额</span><span class="v ${visAmt>0?'add':visAmt<0?'refund':''}" id="wg-amt">${amtTxt}</span></div>
    </div>
    ${!todo?`<div class="wg-hint">✓ 这些件已提交、不可修改。${g.allSub?'本商品全部件已提交，可到「标签打印」打印标签（印实发净重）。':`本商品还有 ${g.portionN-g.subN} 件在「待称重」，全部提交后才解锁标签打印。`}</div>`
        :`<div class="wg-fill" onclick="wg_fill('${key}')">${svg('leaf','style="width:16px;height:16px;stroke:var(--emerald-2)"')} 这 ${vis.length} 件按应发填入（${g.specQty}${g.unit}/件）</div>
          <div class="wg-hint">按袋上<b>标签序号</b>对行录实发净重（序号与「标签打印」一致）。<b>可分批提交</b>：称完哪几件就提交哪几件，提交后该件移入「已称重」并锁定；全部件提交后才解锁标签打印。</div>`}
    <div class="wg-list">${vis.map(i=>{const p=g.ps[i],v=g.ws[i]==null?'':g.ws[i];
      const dtxt=p.subd?'✓ 已提交':!p.filled?'待录':p.st==='block'?p.msg:p.diff===0?'✓ 合格':`${p.diff>0?'+':''}${p.diff}${g.unit}`;
      return `<div class="wg-prow ${p.subd?'subd':''}" data-i="${i}"><span class="idx"><i class="${p.subd?'done':p.st==='block'?'bad':''}">${p.subd?'✓':''}${seqNo(i,g.portionN)}</i></span>
        <div class="inp"><input type="number" inputmode="decimal" step="0.01" min="0" value="${v}" placeholder="${g.specQty}" class="${p.st==='block'?'bad':''}" ${p.subd?'disabled':''} onchange="wg_input('${key}',${i},this.value)"><span class="u">${g.unit}</span></div>
        <span class="d ${p.subd?'subd':p.st}">${dtxt}</span></div>`;}).join('')||`<div class="wg-hint" style="text-align:center;padding:18px 0">本页签下该商品没有件</div>`}</div>
    <div style="height:14px"></div>`;
  refreshFooter(key);
}
function refreshFooter(key){if(!CURPAGE)return;const sub=CURPAGE.querySelector('#wg-sub');if(!sub)return;const g=groupOf(key);
  if(CURTAB==='done'){sub.textContent='已提交 · 只读';sub.disabled=true;return;}
  sub.textContent=g.ready?`提交已称的 ${g.ready} 件`:(g.blocked?`有 ${g.blocked} 件超阈值`:'先录实发净重再提交');
  sub.disabled=!g.ready;}
function openSku(key){const g=groupOf(key);if(!g)return;CURTAB=state.tab;
  CURPAGE=pushPage({title:(CURTAB==='done'?'已称重 · ':'称重 · ')+g.name,body:'<div id="wgd"></div>',
    footer:`<button class="btn primary" id="wg-sub">提交称重</button>`,
    mount:(p)=>{CURPAGE=p;drawDetail(p.querySelector('#wgd'),key);const sub=p.querySelector('#wg-sub');if(sub)sub.onclick=()=>submit(key);}});
}

window.wg_input=function(key,i,v){setWs(key,i,v===''?'':parseFloat(v));
  const g=groupOf(key),p=g.ps[i],box=CURPAGE&&CURPAGE.querySelector('#wgd');if(!box)return;
  const row=box.querySelector(`.wg-prow[data-i="${i}"]`);   // 只更新该件的差异标 + 头部 + 底部，避免整页重刷导致滚动跳顶
  if(row){const inp=row.querySelector('input');if(inp)inp.classList.toggle('bad',p.st==='block');
    const sq=row.querySelector('.idx i');if(sq)sq.classList.toggle('bad',p.st==='block');
    const d=row.querySelector('.d');if(d){d.className='d '+p.st;d.textContent=!p.filled?'待录':p.st==='block'?p.msg:p.diff===0?'✓ 合格':`${p.diff>0?'+':''}${p.diff}${g.unit}`;}}
  const vis=visOf(g,CURTAB!=='done');
  const visAmt=+vis.reduce((a,j)=>a+g.ps[j].amt,0).toFixed(2);
  const visReal=+vis.reduce((a,j)=>a+(+g.ws[j]||0),0).toFixed(2);
  const fe=box.querySelector('#wg-filled'),ae=box.querySelector('#wg-amt'),re=box.querySelector('#wg-real');
  if(fe)fe.textContent=`${vis.filter(j=>g.ps[j].filled).length} / ${vis.length} 件`;
  if(re)re.textContent=`${visReal}${g.unit}`;
  if(ae){ae.textContent=visAmt>0?`补款 ${S(visAmt)}`:visAmt<0?`退款 ${S(-visAmt)}`:'无差额';ae.className='v '+(visAmt>0?'add':visAmt<0?'refund':'');}
  refreshFooter(key);};
window.wg_fill=function(key){const g=groupOf(key);if(!g||g.allSub)return;const s=store();s[key]=s[key]||{ws:{}};s[key].ws=Object.assign({},s[key].ws);
  let n=0;for(let i=0;i<g.portionN;i++){if(g.sub[i])continue;s[key].ws[i]=g.specQty;n++;}
  s[key].at='2026-07-28 08:20';drawDetail(CURPAGE.querySelector('#wgd'),key);toast(`未提交的 ${n} 件已按应发 ${g.specQty}${g.unit}/件 填入`,'ok');};

/* 分批提交：本次提交 = 已录实发净重、未拦截、且未提交的件（按标签序号） */
function submit(key){const g=groupOf(key);if(!g||g.allSub)return;
  const idxs=g.ps.map((p,i)=>p.filled&&!p.subd&&p.st!=='block'?i:-1).filter(i=>i>=0);
  if(!idxs.length){toast(g.blocked?`有 ${g.blocked} 件超阈值/异常，请复称`:'还没有可提交的件，请先录实发净重','err');return;}
  const amt=+idxs.reduce((a,i)=>a+g.ps[i].amt,0).toFixed(2);
  const rest=g.portionN-g.subN-idxs.length;
  const amtTxt=amt>0?`补款 ${S(amt)}`:amt<0?`退款 ${S(-amt)}`:'无差额';
  confirmDialog({title:`提交称重 · ${g.name}`,body:`${g.wh} · 本次提交 ${idxs.length} 件（标签序号 ${seqRange(idxs,g.portionN)}），${amtTxt}。提交后这些件锁定不可改；${rest?`还有 ${rest} 件未提交，全部提交后才解锁标签打印。`:'该商品全部件已提交，标签打印解锁。'}`,okText:'确认提交',onOk:()=>{
    const s=store();s[key]=s[key]||{ws:{}};s[key].sub=Object.assign({},s[key].sub);
    idxs.forEach(i=>{s[key].sub[i]='2026-07-28 08:20';});
    const ng=groupOf(key);
    s[key].submitted=ng.allSub;s[key].amt=ng.subAmt;s[key].real=ng.subReal;s[key].due=+(ng.subN*g.specQty).toFixed(2);s[key].at='2026-07-28 08:20';
    toast(ng.allSub?`${idxs.length} 件已提交并移入「已称重」，本商品全部件完成，标签打印已解锁`:`${idxs.length} 件已提交并移入「已称重」，其余件可继续录`,'ok');
    const left=visOf(ng,true).length;                       // 本页签（待称重）还剩几件
    if(left){drawDetail(CURPAGE.querySelector('#wgd'),key);}else{window.FM.popPage();}
    if(LISTBOX)renderBody(LISTBOX);}});}

/* ===== 列表 Tab ===== */
let LISTBOX=null;
function card(g,todo){
  const vis=visOf(g,todo);
  const visFill=vis.filter(i=>g.ps[i].filled).length;
  const visAmt=+vis.reduce((a,i)=>a+g.ps[i].amt,0).toFixed(2);
  const blocked=vis.filter(i=>g.ps[i].st==='block').length;
  const stTxt=todo?(blocked?'有件异常':visFill===vis.length?'待提交':`待称重 ${visFill}/${vis.length}`):`已提交 ${vis.length} 件`;
  const stCls=todo?(blocked?'block':visFill===vis.length?'ready':'wait'):'done';
  const pct=vis.length?Math.round((todo?visFill:vis.length)/vis.length*100):0;
  const amtCls=visAmt>0?'add':visAmt<0?'refund':'zero';
  const amtTxt=todo&&!visFill?'':(visAmt>0?`补款 ${S(visAmt)}`:visAmt<0?`退款 ${S(-visAmt)}`:'无差额');
  return `<div class="wg-card" data-key="${g.key}">
    <div class="wg-ch"><span class="wg-nm">${g.name}</span><span class="wg-st ${stCls}">${stTxt}</span></div>
    <div class="wg-meta">${g.wh} · ${todo?'待提交':'已提交'} ${vis.length} 件（共 ${g.portionN}）· 标签序号 ${seqRange(vis,g.portionN)} · ${S(g.up)}/${g.unit}</div>
    <div class="wg-prog"><i style="width:${pct}%"></i></div>
    <div class="wg-cf"><span class="pg">${todo?`已录 <b>${visFill}/${vis.length}</b> 件`:`实发合计 <b>${+vis.reduce((a,i)=>a+(+g.ws[i]||0),0).toFixed(2)}${g.unit}</b>`}${amtTxt?` · <span class="amt ${amtCls}">${amtTxt}</span>`:''}</span>
      <span class="go">${todo?'去称重':'查看'} ${svg('arrow','style="width:15px;height:15px;stroke:var(--emerald-2)"')}</span></div>
  </div>`;
}
function renderBody(root){
  LISTBOX=root;
  const ds=[...new Set(pend().map(o=>o.deliver))];if(state.date===null)state.date=ds[0]||'';
  const ws=[...new Set(pend().map(o=>o.warehouse))];
  const gs=groups();
  const isTodo=state.tab!=='done';
  // 页签按【件】分：未提交件在「待称重」，已提交件即刻移到「已称重」
  const waitN=gs.filter(g=>g.portionN-g.subN>0).length;
  const doneN=gs.filter(g=>g.subN>0).length;
  const shown=gs.filter(g=>visOf(g,isTodo).length);
  const leftN=gs.reduce((a,g)=>a+(g.portionN-g.subN),0);                                 // 待提交件数
  const doneP=gs.reduce((a,g)=>a+g.subN,0);                                              // 已提交件数
  const amtSum=+gs.reduce((a,g)=>a+g.subAmt,0).toFixed(2);                               // 已提交件差额
  const todoAmt=+gs.reduce((a,g)=>a+(g.amtSum-g.subAmt),0).toFixed(2);                   // 待提交件差额
  const pill=(val,cur,attr)=>`<span class="lb-pill ${cur===val?'on':''}" data-${attr}="${val}">`;
  const df=window.FM_dateField(state.date,ds,d=>{state.date=d;renderBody(root);});
  root.innerHTML=`
    <div class="lb-note">⚖️ 多退少补（按重量定价）商品需逐件录实发净重后才能打标签。每件带<b>标签序号</b>（与「标签打印」一致），按袋上序号对行录入；<b>可按序号分批提交</b>，提交后该件即刻移入「已称重」并锁定不可改，整个商品全部件提交后解锁标签打印。</div>
    <div class="wg-seg">
      <span class="s ${isTodo?'on':''}" data-tab="todo">待称重<span class="n">${waitN}</span></span>
      <span class="s ${isTodo?'':'on'}" data-tab="done">已称重<span class="n">${doneN}</span></span>
    </div>
    <div class="lb-filter">
      <div class="lb-frow"><span class="lb-fl">配送日期</span>${df.html}</div>
      <div class="lb-frow"><span class="lb-fl">仓库</span><div class="lb-pills">${pill('',state.wh,'wh')}全部</span>${ws.map(w=>`${pill(w,state.wh,'wh')}${w}</span>`).join('')}</div></div>
    </div>
    ${isTodo
      ?`<div class="lb-sum"><div class="k"><div class="v r">${waitN}</div><div class="l">待称重商品</div></div><div class="k"><div class="v">${leftN}</div><div class="l">待提交件数</div></div><div class="k"><div class="v ${todoAmt>0?'':todoAmt<0?'r':''}">${todoAmt>0?'+':''}${S(todoAmt).slice(2)}</div><div class="l">待提交差额(S$)</div></div></div>`
      :`<div class="lb-sum"><div class="k"><div class="v g">${doneN}</div><div class="l">已称重商品</div></div><div class="k"><div class="v g">${doneP}</div><div class="l">已提交件数</div></div><div class="k"><div class="v ${amtSum>0?'':amtSum<0?'r':''}">${amtSum>0?'+':''}${S(amtSum).slice(2)}</div><div class="l">已结差额(S$)</div></div></div>`}
    ${shown.length?shown.map(g=>card(g,isTodo)).join(''):`<div class="empty"><div class="ei">${svg('layers')}</div><h4>${isTodo?'该筛选下没有待称重的件':'该筛选下还没有已提交的件'}</h4><p>${isTodo?'只有按重量定价（多退少补）的商品才需称重；件提交后会移到「已称重」':'在「待称重」逐件录入并提交后，该件即刻移到这里'}</p></div>`}
    <div style="height:14px"></div>`;
  root.querySelectorAll('.wg-seg .s').forEach(el=>el.onclick=()=>{state.tab=el.dataset.tab;renderBody(root);});
  root.querySelectorAll('.wg-card').forEach(c=>c.onclick=()=>openSku(c.dataset.key));
  df.bind(root);
  root.querySelectorAll('[data-wh]').forEach(el=>el.onclick=()=>{state.wh=el.dataset.wh;renderBody(root);});
}

window.FM_WEIGH={render(box){box.innerHTML=skel(2);setTimeout(()=>renderBody(box),380);}};
})();
