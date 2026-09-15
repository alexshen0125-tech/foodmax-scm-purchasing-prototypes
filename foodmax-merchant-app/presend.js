/* Food Max 商家端 v2 · 在仓预送库存 + 送货盘点（提前送货与预测预送）
   ① 在仓预送库存 FM_MOD.presendstock：当日没卖完留仓的货 + 多收入账，顺延抵扣次日应送量（BR-15/BR-16c）。
   ② 送货盘点 FM_MOD.presendrecon：按送货单 / 按 SKU 两个维度盘每天送了多少、仓库收了多少。

   ⚠️ 2026-09-15 沈亮拍板：**「预送确认」页已删除**。预送量由系统直接定稿，
      最终预送量 = min(算法预测量, 可售库存)（BR-06），商家零动作——想多备直接多送，
      仓库照收不设上限（BR-16c），多送的当日不可卖、次日抵扣（BR-16d）。

   口径见《scm_提前送货与预测预送_功能框架》v0.7，与 PC 端 pc-modules/presend.js 数字同源。
   评审修复内建：骨架屏/空态/破坏性动作确认/44px；前缀 ps-。 */
(function(){
const {pushPage,popPage,toast,confirmDialog,svg,skel}=window.FM;
const CFG={t0:'16:00',t:'18:00',cutoff:'22:00'};

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
    return Object.assign({},a,{fcst,avail,hist});
  });
  STOCK=ROWS.filter((r,i)=>i%2===0).slice(0,7).map(r=>{
    const sent=r.fcst,sold=Math.max(0,sent-2-hnum(r.sku+r.wh+'s',12));
    const over=hnum(r.sku+r.wh+'ov',10)<4?(2+hnum(r.sku+'ovq',6)):0;   // 多收入账（BR-16c：当日不可卖，直接留仓）
    return {sku:r.sku,name:r.name,unit:r.unit,wh:r.wh,inDate:'2026-08-30',sent,sold,over,
      left:sent-sold+over,hold:1+hnum(r.sku+'d',3),shelfLeft:1+hnum(r.sku+'d',3)+1+hnum(r.sku+'e',5),
      nextNeed:5+hnum(r.sku+r.wh+'n',30),returning:false};
  });
}
// BR-06（2026-09-15 简化）：最终预送量 = min(算法预测量, 可售库存)，系统直接定稿，无商家确认环节
function finalQty(r){return Math.min(r.fcst,r.avail);}

/* ---------- 在仓预送库存 ---------- */
let STAB='all';
function stockCard(s){
  const need=Math.max(0,s.nextNeed-s.left);
  return `<div class="ps-card" data-key="${s.sku}|${s.wh}">
    <div class="ps-ch"><div><div class="nm">${s.name}</div><div class="sku">${s.sku}</div></div>
      ${s.returning?'<span class="ps-st capped">退回中</span>':s.shelfLeft<=2?'<span class="ps-st wait">临期</span>':''}</div>
    <div class="ps-tags"><span class="ps-tag">${s.wh}</span><span class="ps-tag">入仓 ${s.inDate}</span><span class="ps-tag">预送 ${s.sent} · 已售 ${s.sold}</span>${s.over?`<span class="ps-tag" style="background:var(--amber-soft);color:#8A5A12">多收 +${s.over}</span>`:''}</div>
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
    <div class="ps-note" style="margin-top:12px">当日预送到仓、截单后没卖完的货留在仓里，<b>次日订单优先消耗</b>——次日应送量 = 次日需求 − 在仓剩余，够了就不用再送。你<b>多送</b>的部分仓库照收，也直接进这里（当天不参与售卖）。货权归你，<b>滞销与临期由你处理</b>、可申请退回；保管期间的<b>损坏与丢失由平台承担</b>。</div>
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
      ${s.over?`<div class="ps-row"><span class="k">当日多收（送多照收）</span><span class="v">+${s.over} ${s.unit}</span></div>`:''}
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
window.FM_MOD.presendstock=()=>{ensure();pushPage({title:'在仓预送库存',body:'<div id="psw"></div>',mount:p=>drawStock(p.querySelector('#psw'))});};
// 供「打印标签」取最终预送量（按 商品名 + 仓库 匹配）
window.PS_QTY=(name,wh)=>{ensure();const r=ROWS.find(x=>x.name===name&&x.wh===wh);return r?finalQty(r):0;};

/* ---------- 送货盘点（两个维度：按送货单 / 按 SKU）----------
   2026-09-15 沈亮拍板：原「送货复盘」改为「送货盘点」，不再按送多/送少分桶，
   改成两个维度看同一批数据——① 按送货单：每天每仓一张单，盘这一单送了什么、收了多少；
   ② 按 SKU：一个品逐日的送货明细。与 PC pc-modules/presend.js 同算法同数字。 */
const AUD_DAYS=['2026-08-30','2026-08-29','2026-08-28','2026-08-27','2026-08-26','2026-08-25','2026-08-24'];
let AUD=null,ATAB='doc',ADAY=AUD_DAYS[0];
function ensureAudit(){
  ensure();
  if(AUD)return;
  const whs=[...new Set(ROWS.map(r=>r.wh))],docs=[];let seq=0;
  AUD_DAYS.slice().reverse().forEach(d=>{
    whs.forEach(wh=>{
      const rs=ROWS.filter(r=>r.wh===wh);
      if(!rs.length)return;
      const lines=rs.map(r=>{
        const sd=r.sku+wh+d;
        const orderQty=Math.max(1,Math.round(r.orderQty*(0.7+hnum(sd+'o',70)/100)));
        const psQty=Math.max(0,Math.round(finalQty(r)*(0.7+hnum(sd+'p',70)/100)));
        const planned=orderQty+psQty;
        const h=hnum(sd+'rc',10);                       // 约 2/10 短收、2/10 多收、其余足额
        const received=h<2?Math.max(orderQty,planned-(1+hnum(sd+'sd',5)))
                      :h<4?planned+(2+hnum(sd+'od',6))
                      :planned;
        return {sku:r.sku,name:r.name,unit:r.unit,orderQty,psQty,planned,received,
                short:Math.max(0,planned-received),over:Math.max(0,received-planned)};
      });
      docs.push({no:'SH'+d.replace(/-/g,'')+String(++seq).padStart(3,'0'),date:d,wh,lines});
    });
  });
  AUD={docs};
}
const asum=(a,f)=>a.reduce((x,y)=>x+f(y),0);
const dTot=d=>({planned:asum(d.lines,l=>l.planned),received:asum(d.lines,l=>l.received),
  short:asum(d.lines,l=>l.short),over:asum(d.lines,l=>l.over)});
function aDocs(){return AUD.docs.filter(d=>!ADAY||d.date===ADAY).sort((a,b)=>b.date.localeCompare(a.date)||a.wh.localeCompare(b.wh));}
function aSkus(){
  const map={};
  AUD.docs.forEach(d=>d.lines.forEach(l=>{
    const k=l.sku+'|'+d.wh;
    if(!map[k])map[k]={sku:l.sku,name:l.name,unit:l.unit,wh:d.wh,days:[]};
    map[k].days.push(Object.assign({date:d.date,no:d.no},l));
  }));
  return Object.values(map).map(r=>Object.assign({},r,{
    planned:asum(r.days,x=>x.planned),received:asum(r.days,x=>x.received),
    short:asum(r.days,x=>x.short),over:asum(r.days,x=>x.over),
    days:r.days.slice().sort((a,b)=>b.date.localeCompare(a.date))
  })).sort((a,b)=>b.planned-a.planned);
}
function diffChip(short,over){
  if(short)return `<span class="ps-tag" style="background:var(--red-soft);color:var(--red)">短收 −${short}</span>`;
  if(over)return `<span class="ps-tag" style="background:var(--amber-soft);color:#8A5A12">多收 +${over}</span>`;
  return '<span class="ps-tag" style="background:var(--mint-soft);color:var(--emerald-2)">足额收货</span>';
}
function docCard(d){
  const t=dTot(d);
  return `<div class="ps-card" data-no="${d.no}">
    <div class="ps-ch"><div><div class="nm">${d.wh}</div><div class="sku">${d.no}</div></div>
      <span class="ps-st ${t.short?'wait':t.over?'capped':'confirmed'}">${t.short?'有短收':t.over?'有多收':'足额'}</span></div>
    <div class="ps-tags"><span class="ps-tag">${d.date}</span><span class="ps-tag">${d.lines.length} 个 SKU</span>${diffChip(t.short,t.over)}</div>
    <div class="ps-kbox">
      <div class="k"><div class="v">${t.planned}</div><div class="l">应送</div></div>
      <div class="k"><div class="v hl">${t.received}</div><div class="l">仓库实收</div></div>
      <div class="k"><div class="v ${t.short?'gap':''}" style="${t.over?'color:var(--amber)':''}">${t.short?'−'+t.short:(t.over?'+'+t.over:0)}</div><div class="l">差异</div></div>
    </div>
    <div class="ps-acts"><div class="b link" data-act="detail">看逐 SKU 明细 ›</div></div>
  </div>`;
}
function skuCard(r){
  return `<div class="ps-card" data-key="${r.sku}|${r.wh}">
    <div class="ps-ch"><div><div class="nm">${r.name}</div><div class="sku">${r.sku}</div></div></div>
    <div class="ps-tags"><span class="ps-tag">${r.wh}</span><span class="ps-tag">近 ${r.days.length} 天</span>${diffChip(r.short,r.over)}</div>
    <div class="ps-kbox">
      <div class="k"><div class="v">${r.planned}</div><div class="l">累计应送</div></div>
      <div class="k"><div class="v hl">${r.received}</div><div class="l">累计实收</div></div>
      <div class="k"><div class="v ${r.short?'gap':''}" style="${r.over&&!r.short?'color:var(--amber)':''}">${r.short?'−'+r.short:(r.over?'+'+r.over:0)}</div><div class="l">差异</div></div>
    </div>
    <div class="ps-acts"><div class="b link" data-act="detail">看每日送货明细 ›</div></div>
  </div>`;
}
function drawAudit(box){
  const docs=aDocs(),skus=aSkus();
  const scope=ATAB==='doc'?docs.flatMap(d=>d.lines):skus;
  const sp=asum(scope,x=>x.planned),sr=asum(scope,x=>x.received),ss=asum(scope,x=>x.short),so=asum(scope,x=>x.over);
  box.innerHTML=`
    <div class="ps-note" style="margin-top:12px">盘每天<b>送了多少、仓库收了多少、差多少</b>。<b>按送货单</b>看某天某仓这一单的收货结果，<b>按 SKU</b> 看某个品逐日的送货明细。<br>应送 = 订单量 + 预送量；<b>短收</b>按实收计、当日配额同步下调；<b>多收</b>仓库照收不设上限，已入在仓寄存，当天不参与售卖、次日优先抵扣。</div>
    <div class="ps-sec" style="margin-bottom:8px">送收对账 · ${ATAB==='doc'?(ADAY||'全部日期'):'近 '+AUD_DAYS.length+' 天累计'}</div>
    <div class="ps-kbox" style="margin:0 16px">
      <div class="k"><div class="v">${sp}</div><div class="l">应送合计</div></div>
      <div class="k"><div class="v">${sr}</div><div class="l">仓库实收</div></div>
      <div class="k"><div class="v ${ss?'gap':''}">${ss?'−'+ss:0}</div><div class="l">短收</div></div>
      <div class="k"><div class="v" style="${so?'color:var(--amber)':''}">${so?'+'+so:0}</div><div class="l">多收</div></div>
    </div>
    <div class="ps-tabs">
      <div class="ps-tab ${ATAB==='doc'?'on':''}" data-t="doc">按送货单 ${docs.length}</div>
      <div class="ps-tab ${ATAB==='sku'?'on':''}" data-t="sku">按 SKU ${skus.length}</div>
    </div>
    ${ATAB==='doc'?`<div class="ps-tabs" style="padding-top:2px">${AUD_DAYS.map(d=>`<div class="ps-tab ${ADAY===d?'on':''}" data-d="${d}">${d.slice(5)}</div>`).join('')}</div>`:''}
    <div class="ps-list" id="psl"></div>`;
  box.querySelectorAll('.ps-tab[data-t]').forEach(t=>t.onclick=()=>{ATAB=t.dataset.t;drawAudit(box);});
  box.querySelectorAll('.ps-tab[data-d]').forEach(t=>t.onclick=()=>{ADAY=t.dataset.d;drawAudit(box);});
  const list=box.querySelector('#psl');
  list.innerHTML=skel(3);
  setTimeout(()=>{
    if(ATAB==='doc'){
      if(!docs.length){list.innerHTML=`<div class="empty"><div class="ei">${svg('box')}</div><h4>该日无送货单</h4><p>换个送货日看看</p></div>`;return;}
      list.innerHTML=docs.map(docCard).join('');
      list.querySelectorAll('.ps-card').forEach(c=>{c.onclick=()=>openDocDetail(AUD.docs.find(d=>d.no===c.dataset.no));});
    }else{
      if(!skus.length){list.innerHTML=`<div class="empty"><div class="ei">${svg('chart')}</div><h4>暂无送货记录</h4><p>送货到仓后在这里逐日盘点</p></div>`;return;}
      list.innerHTML=skus.map(skuCard).join('');
      list.querySelectorAll('.ps-card').forEach(c=>{c.onclick=()=>openSkuDetail(skus.find(r=>r.sku+'|'+r.wh===c.dataset.key));});
    }
  },420);
}
function openDocDetail(d){
  if(!d)return;const t=dTot(d);
  pushPage({title:d.no,body:`
    <div class="ps-note" style="margin-top:12px">${d.date} · ${d.wh} · ${d.lines.length} 个 SKU</div>
    <div class="ps-sec">本单合计</div>
    <div class="ps-tbl">
      <div class="ps-row"><span class="k">应送（订单 + 预送）</span><span class="v">${t.planned}</span></div>
      <div class="ps-row"><span class="k">仓库实收</span><span class="v hl">${t.received}</span></div>
      <div class="ps-row"><span class="k">短收</span><span class="v ${t.short?'warn':''}">${t.short?'−'+t.short:'0'}</span></div>
      <div class="ps-row"><span class="k">多收</span><span class="v">${t.over?'+'+t.over+' · 已入寄存':'0'}</span></div>
    </div>
    <div class="ps-sec">逐 SKU 明细</div>
    <div class="ps-tbl">
      ${d.lines.map(l=>`<div class="ps-row"><span class="k" style="flex:1;text-align:left">
        <b style="color:var(--ink)">${l.name}</b><br><span style="font-size:11.5px">订单 ${l.orderQty} · 预送 ${l.psQty}</span></span>
        <span class="v">${l.received} / ${l.planned}<br><span style="font-size:11.5px;font-weight:600;color:${l.short?'var(--red)':(l.over?'var(--amber)':'var(--sub)')}">${l.short?'短收 −'+l.short:(l.over?'多收 +'+l.over:'足额')}</span></span></div>`).join('')}
    </div>
    <div style="height:16px"></div>`});
}
function openSkuDetail(r){
  if(!r)return;
  const st=(STOCK||[]).find(x=>x.sku===r.sku&&x.wh===r.wh);
  const ps=ROWS.find(x=>x.sku===r.sku&&x.wh===r.wh);
  const left=st?st.left:0,todayOrder=r.days[0]?r.days[0].orderQty:0,todayPs=ps?finalQty(ps):0;
  const todayShould=Math.max(0,todayOrder+todayPs-left);
  pushPage({title:r.name,body:`
    <div class="ps-note" style="margin-top:12px">${r.sku} · ${r.wh} · 近 ${r.days.length} 天</div>
    <div class="ps-sec">每日送货明细</div>
    <div class="ps-tbl">
      ${r.days.map(x=>`<div class="ps-row"><span class="k" style="flex:1;text-align:left">
        <b style="color:var(--ink)">${x.date}</b><br><span style="font-size:11.5px">${x.no} · 订单 ${x.orderQty} · 预送 ${x.psQty}</span></span>
        <span class="v">${x.received} / ${x.planned}<br><span style="font-size:11.5px;font-weight:600;color:${x.short?'var(--red)':(x.over?'var(--amber)':'var(--sub)')}">${x.short?'短收 −'+x.short:(x.over?'多收 +'+x.over:'足额')}</span></span></div>`).join('')}
      <div class="ps-row" style="background:var(--muted)"><span class="k">合计</span>
        <span class="v">${r.received} / ${r.planned}${r.short?` · <span style="color:var(--red)">短收 −${r.short}</span>`:''}${r.over?` · <span style="color:var(--amber)">多收 +${r.over}</span>`:''}</span></div>
    </div>
    <div class="ps-sec">今天该送多少</div>
    <div class="ps-tbl">
      <div class="ps-row"><span class="k">今日订单需求</span><span class="v">${todayOrder} ${r.unit}</span></div>
      <div class="ps-row"><span class="k">今日预送量（算法定稿）</span><span class="v">+ ${todayPs} ${r.unit}</span></div>
      <div class="ps-row"><span class="k">减去在仓剩余${st&&st.over?`（含多收 ${st.over}）`:''}</span><span class="v">− ${left} ${r.unit}</span></div>
      <div class="ps-row"><span class="k">今日应送</span><span class="v hl">${todayShould} ${r.unit}${todayShould===0?'（今日免送）':''}</span></div>
    </div>
    <div style="height:16px"></div>`});
}
window.FM_MOD.presendrecon=()=>{ensureAudit();pushPage({title:'送货盘点',body:'<div id="psw"></div>',mount:p=>drawAudit(p.querySelector('#psw'))});};

})();
