/* Food Max 商家端 v2 · 预送确认 + 在仓预送库存（提前送货与预测预送）
   ① 预送确认 FM_MOD.presend：算法下发「预送量」与可售库存比对——不超则直接执行；
      超出需商家确认，确认=按预测量送、拒绝/超时=按可售库存送。二态，不支持改数量（BR-07b）。
   ② 在仓预送库存 FM_MOD.presendstock：当日没卖完留仓的货，顺延抵扣次日应送量（BR-15）。
   口径见《scm_提前送货与预测预送_功能框架》v0.3，与 PC 端 pc-modules/presend.js 数字同源。
   评审修复内建：骨架屏/空态/破坏性动作确认/44px；前缀 ps-。 */
(function(){
const {pushPage,popPage,toast,confirmDialog,svg,skel}=window.FM;
const CFG={tp:'15:00',t0:'16:00',t:'18:00',cutoff:'22:00'};
const DEADLINE=Date.now()+42*60*1000+15*1000;   // 演示：确认窗口剩余 42:15

const css=document.createElement('style');
css.textContent=`
.ps-bar{margin:12px 16px 0;background:#fff;border-radius:16px;padding:14px 16px;box-shadow:var(--sh-sm);display:flex;align-items:center;justify-content:space-between;}
.ps-bar .l{font-size:12px;color:var(--sub);}
.ps-bar .v{font-size:17px;font-weight:700;margin-top:2px;}
.ps-bar .cd{color:var(--amber);font-family:'Lora',serif;}
.ps-note{margin:10px 16px 0;font-size:12px;line-height:1.65;color:var(--sub);background:var(--muted);border-radius:12px;padding:11px 13px;}
.ps-note b{color:var(--ink);}
.ps-tabs{display:flex;gap:8px;padding:12px 16px 2px;overflow-x:auto;-webkit-overflow-scrolling:touch;}
.ps-tabs::-webkit-scrollbar{display:none;}
.ps-tab{flex:0 0 auto;font-size:13px;font-weight:700;padding:7px 14px;border-radius:20px;background:#fff;color:var(--sub);box-shadow:var(--sh-sm);cursor:pointer;min-height:34px;display:flex;align-items:center;}
.ps-tab.on{background:var(--emerald);color:#fff;}
.ps-list{padding:12px 16px 18px;}
.ps-card{background:#fff;border-radius:18px;padding:15px 16px;margin-bottom:13px;box-shadow:var(--sh-sm);}
.ps-ch{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;}
.ps-ch .nm{font-size:15px;font-weight:700;line-height:1.35;}
.ps-ch .sku{font-size:11.5px;color:var(--sub);font-family:monospace;margin-top:3px;}
.ps-st{flex:0 0 auto;font-size:12px;font-weight:700;padding:3px 10px;border-radius:20px;}
.ps-st.wait{color:var(--amber);background:var(--amber-soft);}
.ps-st.confirmed{color:var(--emerald-2);background:var(--mint-soft);}
.ps-st.capped{color:#1D4ED8;background:#DBEAFE;}
.ps-st.auto{color:var(--sub);background:var(--muted);}
.ps-tags{display:flex;gap:8px;margin-top:10px;flex-wrap:wrap;}
.ps-tag{font-size:11.5px;font-weight:700;padding:3px 9px;border-radius:8px;background:var(--muted);color:#46604F;}
.ps-kbox{display:flex;background:var(--muted);border-radius:14px;margin-top:12px;padding:12px 0;}
.ps-kbox .k{flex:1;text-align:center;}.ps-kbox .k+.k{border-left:1px solid var(--line);}
.ps-kbox .k .v{font-size:19px;font-weight:600;font-family:'Lora',serif;}
.ps-kbox .k .v.hl{color:var(--emerald-2);}
.ps-kbox .k .v.gap{color:var(--red);}
.ps-kbox .k .l{font-size:11.5px;color:var(--sub);margin-top:2px;}
.ps-gapline{margin-top:11px;font-size:12.5px;color:#8A5A12;background:var(--amber-soft);border-radius:10px;padding:9px 12px;line-height:1.55;}
.ps-acts{display:flex;gap:10px;margin-top:13px;}
.ps-acts .b{flex:1;min-height:44px;display:flex;align-items:center;justify-content:center;border-radius:12px;font-size:14px;font-weight:700;cursor:pointer;}
.ps-acts .b.p{background:var(--emerald);color:#fff;}
.ps-acts .b.o{background:var(--muted);color:#46604F;}
.ps-acts .b.link{background:transparent;color:var(--sub);font-weight:600;}
.ps-foot{position:sticky;bottom:0;z-index:5;padding:10px 16px calc(10px + env(safe-area-inset-bottom));background:#fff;border-top:1px solid var(--line);}
.ps-foot .b{min-height:50px;display:flex;align-items:center;justify-content:center;border-radius:14px;background:var(--emerald);color:#fff;font-size:15.5px;font-weight:700;cursor:pointer;box-shadow:0 8px 20px rgba(5,150,105,.28);}
.ps-sec{font-size:15px;font-weight:700;margin:16px 16px 8px;}
.ps-tbl{background:#fff;border-radius:16px;margin:0 16px;box-shadow:var(--sh-sm);overflow:hidden;}
.ps-row{display:flex;align-items:center;justify-content:space-between;padding:13px 15px;font-size:13.5px;gap:12px;}
.ps-row+.ps-row{border-top:1px solid var(--line);}
.ps-row .k{color:var(--sub);flex:0 0 auto;}
.ps-row .v{font-weight:700;text-align:right;}
.ps-row .v.hl{color:var(--emerald-2);}
.ps-row .v.warn{color:var(--red);}
`;
document.head.appendChild(css);

/* ---------- 数据（与 PC 端同源同算法：按待发货订单聚合 × 稳定伪随机） ---------- */
function hnum(str,mod){let h=11;for(let i=0;i<str.length;i++)h=(h*31+str.charCodeAt(i))>>>0;return h%mod;}
let ROWS=null,STOCK=null;
function ensure(){
  if(ROWS)return;
  const DB=window.FM.DB,agg={};
  DB.orders.filter(o=>o.status==='pending'||o.status==='packed').forEach(o=>{
    (o.lines||[]).forEach(l=>{
      const key=l.sku+'|'+o.warehouse;
      if(!agg[key])agg[key]={sku:l.sku,name:l.name,unit:l.unit||'件',wh:o.warehouse,orderQty:0};
      agg[key].orderQty+=l.qty;
    });
  });
  ROWS=Object.values(agg).map(a=>{
    const fcst=Math.max(3,Math.round(a.orderQty*(0.4+hnum(a.name+a.wh+'f',80)/100)));
    const avail=Math.max(3,Math.round(fcst*(0.45+hnum(a.name+a.wh+'a',60)/100))); // 可售库存 = 预测量的 45%–105%
    const hist=[0,1,2,3].map(k=>Math.max(0,fcst-6+hnum(a.name+a.wh+'h'+k,13)));
    return Object.assign({},a,{fcst,avail,hist,status:fcst<=avail?'auto':'wait',decidedAt:''});
  });
  const waits=ROWS.filter(r=>r.status==='wait');
  if(waits[0]){waits[0].status='confirmed';waits[0].decidedAt='15:12';}
  if(waits[1]){waits[1].status='capped';waits[1].decidedAt='15:00 超时';}
  STOCK=ROWS.filter((r,i)=>i%2===0).slice(0,7).map(r=>{
    const sent=r.fcst,sold=Math.max(0,sent-2-hnum(r.sku+r.wh+'s',12));
    return {sku:r.sku,name:r.name,unit:r.unit,wh:r.wh,inDate:'2026-08-30',sent,sold,
      left:sent-sold,hold:1+hnum(r.sku+'d',3),shelfLeft:1+hnum(r.sku+'d',3)+1+hnum(r.sku+'e',5),
      nextNeed:5+hnum(r.sku+r.wh+'n',30),returning:false};
  });
}
function finalQty(r){return r.status==='confirmed'||r.status==='auto'?r.fcst:Math.min(r.fcst,r.avail);}
const ST={wait:'待确认',confirmed:'已确认',capped:'按库存执行',auto:'无需确认'};

/* ---------- 预送确认 ---------- */
let TAB='wait';
function card(r){
  const gap=r.fcst-r.avail,isW=r.status==='wait';
  return `<div class="ps-card" data-key="${r.sku}|${r.wh}">
    <div class="ps-ch"><div><div class="nm">${r.name}</div><div class="sku">${r.sku}</div></div>
      <span class="ps-st ${r.status}">${ST[r.status]}</span></div>
    <div class="ps-tags"><span class="ps-tag">${r.wh}</span><span class="ps-tag">今日订单 ${r.orderQty} ${r.unit}</span>${r.decidedAt?`<span class="ps-tag">${r.decidedAt}</span>`:''}</div>
    <div class="ps-kbox">
      <div class="k"><div class="v">${r.fcst}</div><div class="l">算法预测量</div></div>
      <div class="k"><div class="v">${r.avail}</div><div class="l">可售库存</div></div>
      <div class="k"><div class="v hl">${finalQty(r)}</div><div class="l">最终预送量</div></div>
    </div>
    ${gap>0?`<div class="ps-gapline">预测比你的可售库存多 <b>${gap} ${r.unit}</b>。${isW?`${CFG.t0} 前未确认，将按可售库存 ${r.avail} ${r.unit} 送货。`:r.status==='confirmed'?'你已确认按预测量送货。':`已按可售库存 ${r.avail} ${r.unit} 执行。`}</div>`:''}
    <div class="ps-acts">${isW
      ? `<div class="b o" data-act="reject">拒绝</div><div class="b p" data-act="confirm">确认按 ${r.fcst} 送</div>`
      : `<div class="b link" data-act="detail">查看预测依据 ›</div>`}</div>
  </div>`;
}
function rowsOf(){return TAB==='all'?ROWS:ROWS.filter(r=>r.status===TAB);}
function renderList(box){
  const list=box.querySelector('#psl');
  list.innerHTML=skel(3);
  setTimeout(()=>{
    const rs=rowsOf();
    if(!rs.length){list.innerHTML=`<div class="empty"><div class="ei">${svg('trend')}</div><h4>该状态下暂无预送记录</h4><p>切换上方状态页签查看其他 SKU</p></div>`;return;}
    list.innerHTML=rs.map(card).join('');
    list.querySelectorAll('.ps-card').forEach(c=>{
      const r=ROWS.find(x=>x.sku+'|'+x.wh===c.dataset.key);
      c.querySelectorAll('[data-act]').forEach(b=>b.onclick=e=>{
        e.stopPropagation();
        const a=b.dataset.act;
        if(a==='confirm')decide([r],true,box);
        else if(a==='reject')askReject(r,box);
        else openDetail(r);
      });
      c.onclick=()=>openDetail(r);
    });
  },420);
}
function decide(rs,ok,box){
  rs.forEach(r=>{if(r.status==='wait'){r.status=ok?'confirmed':'capped';r.decidedAt=ok?'刚刚':'刚刚 已拒绝';}});
  toast(ok?`已确认 ${rs.length} 条，按预测量送货`:`已拒绝 ${rs.length} 条，按可售库存送货`);
  redraw(box);
}
function askReject(r,box){
  confirmDialog({title:'确认拒绝预送？',danger:1,okText:'确认拒绝',
    body:`拒绝后「${r.name}」（${r.wh}）今日预送量按可售库存 ${r.avail} ${r.unit} 执行，少送的 ${r.fcst-r.avail} ${r.unit} 当日卖完即售罄，不再补送。`,
    onOk:()=>decide([r],false,box)});
}
function redraw(box){draw(box);}
function draw(box){
  const waitN=ROWS.filter(r=>r.status==='wait').length;
  const cnt=k=>k==='all'?ROWS.length:ROWS.filter(r=>r.status===k).length;
  box.innerHTML=`
    <div class="ps-bar">
      <div><div class="l">确认截止</div><div class="v">${CFG.t0}</div></div>
      <div><div class="l">剩余时间</div><div class="v cd" data-cd="${DEADLINE}">—</div></div>
      <div><div class="l">到仓送货</div><div class="v">${CFG.t}</div></div>
      <div><div class="l">当日截单</div><div class="v">${CFG.cutoff}</div></div>
    </div>
    <div class="ps-note">你的截单晚于到仓送货时点，<b>${CFG.t0}–${CFG.cutoff}</b> 还会来单。系统预测这段时间还能卖多少作为<b>预送量</b>，随 ${CFG.t} 那趟车一起送。
      预测量不超过可售库存直接执行；超过时需你确认，<b>${CFG.t0} 前未确认按可售库存送</b>。预送量也是当日可售上限，卖完即售罄；没卖完的留仓抵次日。</div>
    <div class="ps-tabs">${[['wait','待确认'],['confirmed','已确认'],['capped','按库存执行'],['auto','无需确认'],['all','全部']]
      .map(([k,t])=>`<div class="ps-tab ${TAB===k?'on':''}" data-t="${k}">${t} ${cnt(k)}</div>`).join('')}</div>
    <div class="ps-list" id="psl"></div>
    ${waitN?`<div class="ps-foot"><div class="b" id="psAll">全部确认（${waitN} 条）</div></div>`:''}`;
  box.querySelectorAll('.ps-tab').forEach(t=>t.onclick=()=>{TAB=t.dataset.t;draw(box);});
  const all=box.querySelector('#psAll');
  if(all)all.onclick=()=>{
    const rs=ROWS.filter(r=>r.status==='wait');
    confirmDialog({title:`全部确认 ${rs.length} 条？`,okText:'确认',
      body:'这些 SKU 今日按算法预测量备货送货，你需要保证货能补足；未送足的部分不计缺货罚款，但当日会提前售罄。',
      onOk:()=>decide(rs,true,box)});
  };
  renderList(box);
}
function openDetail(r){
  const avg=Math.round(r.hist.reduce((a,b)=>a+b,0)/r.hist.length),wk=['上周','两周前','三周前','四周前'];
  const gap=r.fcst-r.avail;
  pushPage({title:r.name,body:`
    <div class="ps-sec">今日预送</div>
    <div class="ps-tbl">
      <div class="ps-row"><span class="k">算法预测量（${CFG.t0}–${CFG.cutoff} 还能卖）</span><span class="v">${r.fcst} ${r.unit}</span></div>
      <div class="ps-row"><span class="k">你的可售库存</span><span class="v">${r.avail} ${r.unit}</span></div>
      <div class="ps-row"><span class="k">缺口</span><span class="v ${gap>0?'warn':''}">${gap>0?gap+' '+r.unit:'无'}</span></div>
      <div class="ps-row"><span class="k">今日订单量（已确认，另计）</span><span class="v">${r.orderQty} ${r.unit}</span></div>
      <div class="ps-row"><span class="k">最终预送量</span><span class="v hl">${finalQty(r)} ${r.unit}</span></div>
      <div class="ps-row"><span class="k">今日应送合计</span><span class="v">${r.orderQty+finalQty(r)} ${r.unit}</span></div>
    </div>
    <div class="ps-sec">预测依据 · 近 4 周同星期几 ${CFG.t0}–${CFG.cutoff} 成交</div>
    <div class="ps-tbl">
      ${r.hist.map((h,i)=>`<div class="ps-row"><span class="k">${wk[i]}</span><span class="v">${h} ${r.unit}</span></div>`).join('')}
      <div class="ps-row"><span class="k">4 周均值</span><span class="v">${avg} ${r.unit}</span></div>
    </div>
    <div class="ps-sec">时间安排</div>
    <div class="ps-tbl">
      <div class="ps-row"><span class="k">确认截止</span><span class="v">${CFG.t0} 超时按可售库存</span></div>
      <div class="ps-row"><span class="k">到仓送货</span><span class="v">${CFG.t} 前送达 ${r.wh}</span></div>
      <div class="ps-row"><span class="k">当日截单</span><span class="v">${CFG.cutoff} 卖完即售罄</span></div>
      <div class="ps-row"><span class="k">未售完</span><span class="v">留仓抵扣次日应送</span></div>
    </div>
    <div style="height:16px"></div>`});
}

/* ---------- 在仓预送库存 ---------- */
let STAB='all';
function stockCard(s){
  const need=Math.max(0,s.nextNeed-s.left);
  return `<div class="ps-card" data-key="${s.sku}|${s.wh}">
    <div class="ps-ch"><div><div class="nm">${s.name}</div><div class="sku">${s.sku}</div></div>
      ${s.returning?'<span class="ps-st capped">退回中</span>':s.shelfLeft<=2?'<span class="ps-st wait">临期</span>':''}</div>
    <div class="ps-tags"><span class="ps-tag">${s.wh}</span><span class="ps-tag">入仓 ${s.inDate}</span><span class="ps-tag">预送 ${s.sent} · 已售 ${s.sold}</span></div>
    <div class="ps-kbox">
      <div class="k"><div class="v">${s.left}</div><div class="l">在仓剩余</div></div>
      <div class="k"><div class="v ${s.shelfLeft<=2?'gap':''}">${s.shelfLeft}</div><div class="l">剩余保质期(天)</div></div>
      <div class="k"><div class="v hl">${need}</div><div class="l">次日应送量</div></div>
    </div>
    ${need===0?`<div class="ps-gapline">在仓 ${s.left} ${s.unit} 已够次日需求 ${s.nextNeed} ${s.unit}，<b>次日免送</b>。</div>`:''}
    <div class="ps-acts">${s.returning?'<div class="b link">退回申请处理中 ›</div>'
      :'<div class="b o" data-act="return">申请退回</div><div class="b link" data-act="detail">明细 ›</div>'}</div>
  </div>`;
}
function drawStock(box){
  const expN=STOCK.filter(s=>s.shelfLeft<=2).length;
  box.innerHTML=`
    <div class="ps-note" style="margin-top:12px">当日预送到仓、截单后没卖完的货留在仓里，<b>次日订单优先消耗</b>——次日应送量 = 次日需求 − 在仓剩余，够了就不用再送。货权归你，可申请退回。</div>
    <div class="ps-tabs">
      <div class="ps-tab ${STAB==='all'?'on':''}" data-t="all">全部 ${STOCK.length}</div>
      <div class="ps-tab ${STAB==='exp'?'on':''}" data-t="exp">临期 ≤2天 ${expN}</div>
    </div>
    <div class="ps-list" id="psl"></div>`;
  box.querySelectorAll('.ps-tab').forEach(t=>t.onclick=()=>{STAB=t.dataset.t;drawStock(box);});
  const list=box.querySelector('#psl');
  list.innerHTML=skel(3);
  setTimeout(()=>{
    const rs=STAB==='exp'?STOCK.filter(s=>s.shelfLeft<=2):STOCK;
    if(!rs.length){list.innerHTML=`<div class="empty"><div class="ei">${svg('box')}</div><h4>暂无留仓预送货</h4><p>当日预送量全部售出，或还未产生留仓</p></div>`;return;}
    list.innerHTML=rs.map(stockCard).join('');
    list.querySelectorAll('.ps-card').forEach(c=>{
      const s=STOCK.find(x=>x.sku+'|'+x.wh===c.dataset.key);
      c.querySelectorAll('[data-act]').forEach(b=>b.onclick=e=>{
        e.stopPropagation();
        if(b.dataset.act==='return')confirmDialog({title:'申请退回这批留仓货？',okText:'提交申请',
          body:`${s.name}（${s.wh}）在仓 ${s.left} ${s.unit}。提交后由仓库安排退回，退回期间不再参与次日抵扣，次日应送量按完整需求下发。`,
          onOk:()=>{s.returning=true;toast('已提交退回申请，等待仓库安排');drawStock(box);}});
        else openStockDetail(s);
      });
      c.onclick=()=>openStockDetail(s);
    });
  },420);
}
function openStockDetail(s){
  const need=Math.max(0,s.nextNeed-s.left);
  pushPage({title:s.name,body:`
    <div class="ps-sec">留仓明细</div>
    <div class="ps-tbl">
      <div class="ps-row"><span class="k">入库仓库</span><span class="v">${s.wh}</span></div>
      <div class="ps-row"><span class="k">入仓日期</span><span class="v">${s.inDate}</span></div>
      <div class="ps-row"><span class="k">当日预送量</span><span class="v">${s.sent} ${s.unit}</span></div>
      <div class="ps-row"><span class="k">当日已售</span><span class="v">${s.sold} ${s.unit}</span></div>
      <div class="ps-row"><span class="k">在仓剩余</span><span class="v hl">${s.left} ${s.unit}</span></div>
      <div class="ps-row"><span class="k">已留仓</span><span class="v">${s.hold} 天</span></div>
      <div class="ps-row"><span class="k">剩余保质期</span><span class="v ${s.shelfLeft<=2?'warn':''}">${s.shelfLeft} 天</span></div>
    </div>
    <div class="ps-sec">次日抵扣</div>
    <div class="ps-tbl">
      <div class="ps-row"><span class="k">次日订单需求</span><span class="v">${s.nextNeed} ${s.unit}</span></div>
      <div class="ps-row"><span class="k">减去在仓剩余</span><span class="v">− ${s.left} ${s.unit}</span></div>
      <div class="ps-row"><span class="k">次日应送量</span><span class="v hl">${need} ${s.unit}${need===0?'（次日免送）':''}</span></div>
    </div>
    <div style="height:16px"></div>`});
}

/* ---------- 注册 ---------- */
window.FM_MOD=window.FM_MOD||{};
window.FM_MOD.presend=()=>{ensure();pushPage({title:'预送确认',body:'<div id="psw"></div>',mount:p=>draw(p.querySelector('#psw'))});};
window.FM_MOD.presendstock=()=>{ensure();pushPage({title:'在仓预送库存',body:'<div id="psw"></div>',mount:p=>drawStock(p.querySelector('#psw'))});};
window.PS_PENDING=()=>{ensure();return ROWS.filter(r=>r.status==='wait').length;};
// 供「打印标签」取最终预送量（按 商品名 + 仓库 匹配）
window.PS_QTY=(name,wh)=>{ensure();const r=ROWS.find(x=>x.name===name&&x.wh===wh);return r?finalQty(r):0;};

/* ---------- 送货复盘（日结：昨天送多/送少 → 今天送多少） ---------- */
let RECON=null,RTAB='all';
const RDATE='2026-08-30';
function ensureRecon(){
  ensure();
  if(RECON)return;
  RECON=ROWS.map(r=>{
    const ps=finalQty(r),planned=r.orderQty+ps;
    const shortHit=hnum(r.sku+r.wh+'ss',10)<2;
    const received=shortHit?Math.max(r.orderQty,planned-(2+hnum(r.sku+'sd',5))):planned;
    const realAfter=Math.round(ps*(0.55+hnum(r.sku+r.wh+'ra',80)/100));
    const demand=r.orderQty+realAfter;
    const sold=Math.min(received,demand),leftover=received-sold,missed=Math.max(0,demand-received);
    let soldOutAt='';
    if(missed>0){const avail=Math.max(1,received-r.orderQty),h=16+Math.min(5.9,avail/Math.max(1,realAfter)*6);
      soldOutAt=String(Math.floor(h)).padStart(2,'0')+':'+String(Math.round(h%1*60/10)*10%60).padStart(2,'0');}
    const nextOrderNeed=Math.max(2,Math.round(r.orderQty*(0.7+hnum(r.sku+r.wh+'no',70)/100)));
    const nextFcst=Math.max(2,Math.round(ps*(0.7+hnum(r.sku+r.wh+'nf',70)/100)));
    return {sku:r.sku,name:r.name,unit:r.unit,wh:r.wh,orderQty:r.orderQty,psQty:ps,planned,received,
      shortSend:planned-received,demand,sold,leftover,missed,soldOutAt,nextOrderNeed,nextFcst,
      nextShould:Math.max(0,nextOrderNeed+nextFcst-leftover),
      result:missed>0?'short':(leftover>0?'over':'fit')};
  });
}
const RST={over:['送多了','wait'],short:['送少了','capped'],fit:['刚好','confirmed']};
function reconCard(r){
  const[label,cls]=RST[r.result];
  return `<div class="ps-card" data-key="${r.sku}|${r.wh}">
    <div class="ps-ch"><div><div class="nm">${r.name}</div><div class="sku">${r.sku}</div></div>
      <span class="ps-st ${r.result==='short'?'wait':r.result==='over'?'capped':'confirmed'}">${label}</span></div>
    <div class="ps-tags"><span class="ps-tag">${r.wh}</span><span class="ps-tag">应送 ${r.planned}（订单 ${r.orderQty} · 预送 ${r.psQty}）</span>${r.shortSend>0?`<span class="ps-tag">少送 ${r.shortSend}</span>`:''}</div>
    <div class="ps-kbox">
      <div class="k"><div class="v">${r.received}</div><div class="l">实际送达</div></div>
      <div class="k"><div class="v">${r.sold}</div><div class="l">卖出</div></div>
      <div class="k"><div class="v ${r.result==='short'?'gap':''}">${r.result==='short'?r.missed:r.leftover}</div><div class="l">${r.result==='short'?'没接住':'卖剩留仓'}</div></div>
    </div>
    <div class="ps-gapline" style="${r.result==='short'?'':'background:var(--muted);color:#46604F'}">
      ${r.result==='short'
        ? `<b>${r.soldOutAt} 售罄</b>，少接了 ${r.missed} ${r.unit} 的单。`
        : r.result==='over'
        ? `多送的 <b>${r.leftover} ${r.unit}</b> 留在仓里，已自动抵扣今日应送量。`
        : '既没压货也没断货。'}
      今日应送 <b>${r.nextShould} ${r.unit}</b>${r.nextShould===0?'（今日免送）':''}
    </div>
    <div class="ps-acts"><div class="b link" data-act="detail">看是怎么算的 ›</div></div>
  </div>`;
}
function drawRecon(box){
  const cnt=k=>k==='all'?RECON.length:RECON.filter(r=>r.result===k).length;
  box.innerHTML=`
    <div class="ps-note" style="margin-top:12px">看 <b>${RDATE}</b> 送的货是<b>送多了还是送少了</b>，以及<b>今天该送多少</b>。送多了→卖剩的留仓、自动抵扣今日应送量；送少了→提前售罄少接的单在这看得到。<br><b>今日应送 = 今日订单需求 + 今日预送量 − 在仓剩余</b>。</div>
    <div class="ps-tabs">${[['all','全部'],['over','送多了'],['short','送少了'],['fit','刚好']]
      .map(([k,t])=>`<div class="ps-tab ${RTAB===k?'on':''}" data-t="${k}">${t} ${cnt(k)}</div>`).join('')}</div>
    <div class="ps-list" id="psl"></div>`;
  box.querySelectorAll('.ps-tab').forEach(t=>t.onclick=()=>{RTAB=t.dataset.t;drawRecon(box);});
  const list=box.querySelector('#psl');
  list.innerHTML=skel(3);
  setTimeout(()=>{
    const rs=RTAB==='all'?RECON:RECON.filter(r=>r.result===RTAB);
    if(!rs.length){list.innerHTML=`<div class="empty"><div class="ei">${svg('chart')}</div><h4>该结果下暂无复盘记录</h4><p>切换上方页签查看</p></div>`;return;}
    list.innerHTML=rs.map(reconCard).join('');
    list.querySelectorAll('.ps-card').forEach(c=>{
      const r=RECON.find(x=>x.sku+'|'+x.wh===c.dataset.key);
      c.onclick=()=>openReconDetail(r);
    });
  },420);
}
function openReconDetail(r){
  pushPage({title:r.name,body:`
    <div class="ps-sec">${RDATE} 这批货去哪了</div>
    <div class="ps-tbl">
      <div class="ps-row"><span class="k">应送（订单 ${r.orderQty} + 预送 ${r.psQty}）</span><span class="v">${r.planned} ${r.unit}</span></div>
      <div class="ps-row"><span class="k">实际送达</span><span class="v ${r.shortSend>0?'warn':''}">${r.received} ${r.unit}${r.shortSend>0?`（少送 ${r.shortSend}）`:''}</span></div>
      <div class="ps-row"><span class="k">当日真实需求</span><span class="v">${r.demand} ${r.unit}</span></div>
      <div class="ps-row"><span class="k">实际卖出</span><span class="v hl">${r.sold} ${r.unit}</span></div>
      <div class="ps-row"><span class="k">卖剩留仓</span><span class="v">${r.leftover} ${r.unit}</span></div>
      <div class="ps-row"><span class="k">没接住的需求</span><span class="v ${r.missed>0?'warn':''}">${r.missed} ${r.unit}${r.missed>0?`（${r.soldOutAt} 售罄）`:''}</span></div>
    </div>
    <div class="ps-sec">今天该送多少</div>
    <div class="ps-tbl">
      <div class="ps-row"><span class="k">今日订单需求</span><span class="v">${r.nextOrderNeed} ${r.unit}</span></div>
      <div class="ps-row"><span class="k">今日预送量（算法）</span><span class="v">+ ${r.nextFcst} ${r.unit}</span></div>
      <div class="ps-row"><span class="k">减去在仓剩余</span><span class="v">− ${r.leftover} ${r.unit}</span></div>
      <div class="ps-row"><span class="k">今日应送</span><span class="v hl">${r.nextShould} ${r.unit}${r.nextShould===0?'（今日免送）':''}</span></div>
    </div>
    <div style="height:16px"></div>`});
}
window.FM_MOD.presendrecon=()=>{ensureRecon();pushPage({title:'送货复盘',body:'<div id="psw"></div>',mount:p=>drawRecon(p.querySelector('#psw'))});};

})();
