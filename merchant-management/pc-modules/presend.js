/* PC · 在仓预送库存 + 送货盘点（提前送货与预测预送）
   ① 在仓预送库存 PAGES['m-stock-presend']：当日没卖完留仓的预送货 + 多收入账，顺延抵扣次日应送量（BR-15/BR-16c）。
   ② 送货盘点 PAGES['m-presend-recon']：两个维度——按送货单 / 按 SKU，盘每天送了多少、仓库收了多少、差多少。

   ⚠️ 2026-09-15 沈亮拍板：**「预送确认」页已删除**。预送量改由系统直接定稿，
      `最终预送量 = min(算法预测量, 可售库存)`（BR-06），商家零动作——想多备直接多送，
      仓库照收不设上限（BR-16c），多送的当日不可卖、次日抵扣（BR-16d）。
      商家在「备货参考」「打印标签」里看到预送量与合计应送即可，不再需要确认/拒绝。

   口径见《scm_提前送货与预测预送_功能框架》v0.7。复用主文件全局：DB/toast/nav/render/drawer/closeDrawer/modal/icon。*/
(function(){
  const WHS=['裕廊DC','兀兰DC','盛港DC','大巴窑DC'];
  function hnum(str,mod){let h=11;for(let i=0;i<str.length;i++)h=(h*31+str.charCodeAt(i))>>>0;return h%mod;}
  function pad(n){return n<10?'0'+n:''+n;}

  /* ---------- 数据 ---------- */
  window.ensurePresend=function(){
    if(DB.presend)return;
    DB.presendCfg={t0:'16:00',t:'18:00',cutoff:'22:00'};
    DB.presendStockTab='all';DB.presendStockF={};

    // 与「备货参考」同源：按待发货订单聚合到 SKU × 入库仓库，再叠加算法预送量
    const agg={};
    DB.orders.filter(o=>o.status=='pending'||o.status=='packed').forEach(o=>{
      (o.lines||[]).forEach(l=>{
        const key=l.sku+'|'+o.warehouse;
        if(!agg[key])agg[key]={sku:l.sku,name:l.name,unit:l.unit||'件',wh:o.warehouse,orderQty:0};
        agg[key].orderQty+=l.qty;
      });
    });
    const rows=Object.values(agg).map(a=>{
      const p=DB.products.find(x=>x.name==a.name);
      const sk=p&&p.skus&&p.skus[0];
      const spec=sk?`${sk.qty}${p.unit}/件`:a.unit;
      // 算法预测量 = T0 前订单量的 40%–120%（同量级，剩余时段还能卖多少）
      const fcst=Math.max(3,Math.round(a.orderQty*(0.4+hnum(a.name+a.wh+'f',80)/100)));
      const avail=Math.max(3,Math.round(fcst*(0.45+hnum(a.name+a.wh+'a',60)/100))); // 可售库存 = 预测量的 45%–105%
      const hist=[0,1,2,3].map(k=>Math.max(0,fcst-6+hnum(a.name+a.wh+'h'+k,13)));
      return {sku:a.sku,name:a.name,unit:a.unit,spec,cat:(p&&p.cat)||'—',wh:a.wh,
        fcst,avail,orderQty:a.orderQty,hist};
    });
    DB.presend=rows;

    // 在仓预送库存（昨日预送未售完，留仓顺延抵扣次日）
    DB.presendStock=rows.filter((r,i)=>i%2==0).slice(0,7).map(r=>{
      const sent=r.fcst,sold=Math.max(0,sent-2-hnum(r.sku+r.wh+'s',12));
      const over=hnum(r.sku+r.wh+'ov',10)<4?(2+hnum(r.sku+'ovq',6)):0;   // 多收入账（BR-16c：当日不可卖，直接留仓）
      const left=sent-sold+over,hold=1+hnum(r.sku+'d',3),shelf=hold+1+hnum(r.sku+'e',5);
      return {sku:r.sku,name:r.name,unit:r.unit,spec:r.spec,wh:r.wh,inDate:'2026-08-30',
        sent,sold,over,left,hold,shelfLeft:shelf,nextNeed:5+hnum(r.sku+r.wh+'n',30),returning:false};
    });
  };

  // 供「备货参考」取最终预送量（按 商品名 + 仓库 匹配）
  window.presendQty=function(name,wh){
    if(!DB.presend)ensurePresend();
    const r=DB.presend.find(x=>x.name==name&&x.wh==wh);
    return r?finalQty(r):0;
  };
  // 供「备货参考」「打印标签」扣减在仓剩余（BR-15/BR-15b）：
  // 今日应送 = 今日订单需求 + 今日预送量 − 在仓剩余（下限 0），四处必须同一算式
  window.presendLeft=function(name,wh){
    if(!DB.presendStock)ensurePresend();
    const r=(DB.presendStock||[]).find(x=>x.name==name&&x.wh==wh&&!x.returning);
    return r?r.left:0;
  };

  function cfg(){return DB.presendCfg;}
  // BR-06（2026-09-15 简化）：最终预送量 = min(算法预测量, 可售库存)，系统直接定稿，无商家确认环节
  function finalQty(r){return Math.min(r.fcst,r.avail);}

  /* ---------- 在仓预送库存 ---------- */
  function stockRows(){
    const f=DB.presendStockF||{};
    return DB.presendStock.filter(r=>{
      if(DB.presendStockTab=='expiring'&&r.shelfLeft>2)return false;
      if(f.wh&&r.wh!=f.wh)return false;
      if(f.kw&&!(r.name.includes(f.kw)||r.sku.includes(f.kw)))return false;
      return true;
    });
  }
  window.psStockTab=function(k){DB.presendStockTab=k;DB.presendStockSel=[];render();};
  window.psStockFilter=function(k,v){DB.presendStockF=DB.presendStockF||{};DB.presendStockF[k]=v;render();};
  window.psStockCheck=function(key,on){DB.presendStockSel=DB.presendStockSel||[];
    if(on){if(!DB.presendStockSel.includes(key))DB.presendStockSel.push(key);}
    else DB.presendStockSel=DB.presendStockSel.filter(k=>k!=key);
    render();};
  window.psStockCheckAll=function(on){
    DB.presendStockSel=on?stockRows().filter(r=>!r.returning).map(r=>r.sku+'|'+r.wh):[];render();};
  window.psStockReturn=function(){
    const keys=(DB.presendStockSel||[]).slice();if(!keys.length)return;
    modal(`<h3>申请退回 ${keys.length} 条留仓货？</h3>
      <div class="ib ib-b" style="margin:12px 0"><span class="i">${icon('📦')}</span><div>提交后由仓库安排退回，退回期间该批货<b>不再参与次日抵扣</b>，次日应送量按完整需求下发。</div></div>
      <div class="row" style="justify-content:flex-end;gap:10px"><button class="btn btn-o" onclick="closeModal()">取消</button>
      <button class="btn btn-p" onclick="closeModal();psDoStockReturn()">提交申请</button></div>`);
  };
  window.psDoStockReturn=function(){
    const keys=(DB.presendStockSel||[]).slice();
    keys.forEach(k=>{const[sku,wh]=k.split('|');const r=DB.presendStock.find(x=>x.sku==sku&&x.wh==wh);if(r)r.returning=true;});
    DB.presendStockSel=[];render();toast(`已提交 ${keys.length} 条退回申请，等待仓库安排`,'ok');
  };
  // 次日应送量（BR-15b 统一算式）：次日订单需求 + 次日预送量 − 在仓剩余，下限 0
  function nextShouldOf(r){
    const ps=DB.presend.find(x=>x.sku==r.sku&&x.wh==r.wh);
    return Math.max(0,r.nextNeed+(ps?finalQty(ps):0)-r.left);
  }
  window.psStockDrawer=function(key){
    const[sku,wh]=key.split('|');const r=DB.presendStock.find(x=>x.sku==sku&&x.wh==wh);if(!r)return;
    const ps=DB.presend.find(x=>x.sku==r.sku&&x.wh==r.wh),nextPs=ps?finalQty(ps):0;
    const need=nextShouldOf(r);
    drawer(`<div class="drawer-hd"><div><h3>${r.name} <span class="mono" style="font-size:12.5px;color:var(--ts)">${r.sku}</span></h3>
      <div style="margin-top:4px"><span class="sub" style="font-size:12px">${r.wh} · ${r.spec}</span></div></div>
      <span class="x" onclick="closeDrawer()">×</span></div>
    <div class="drawer-bd">
      <h4 style="font-size:13px;color:var(--ts);margin:0 0 10px">留仓明细</h4>
      <table class="subtbl" style="margin-bottom:22px"><tbody>
        <tr><td style="width:42%;color:var(--ts)">入仓日期</td><td>${r.inDate}</td></tr>
        <tr><td style="color:var(--ts)">当日预送量</td><td>${r.sent} ${r.unit}</td></tr>
        <tr><td style="color:var(--ts)">当日已售</td><td>${r.sold} ${r.unit}</td></tr>
        <tr><td style="color:var(--ts)">当日多收（送多照收）</td><td>${r.over?`<span style="color:var(--gold)">+${r.over}</span> ${r.unit}`:'<span style="color:var(--tt)">—</span>'}</td></tr>
        <tr><td style="color:var(--ts)"><b>在仓剩余</b></td><td><b>${r.left}</b> ${r.unit} <span style="font-size:12px;color:var(--ts)">= 预送 ${r.sent} − 已售 ${r.sold}${r.over?' + 多收 '+r.over:''}</span></td></tr>
        <tr><td style="color:var(--ts)">已留仓</td><td>${r.hold} 天</td></tr>
        <tr><td style="color:var(--ts)">剩余保质期</td><td>${r.shelfLeft<=2?`<span style="color:var(--r)">${r.shelfLeft} 天</span>`:`${r.shelfLeft} 天`}</td></tr>
      </tbody></table>
      <h4 style="font-size:13px;color:var(--ts);margin:0 0 10px">次日抵扣</h4>
      <table class="subtbl"><tbody>
        <tr><td style="width:42%;color:var(--ts)">次日订单需求</td><td>${r.nextNeed} ${r.unit}</td></tr>
        <tr><td style="color:var(--ts)">次日预送量（算法定稿）</td><td>+ ${nextPs} ${r.unit}</td></tr>
        <tr><td style="color:var(--ts)">减去在仓剩余${r.over?`（含多收 ${r.over}）`:''}</td><td>− ${r.left} ${r.unit}</td></tr>
        <tr><td style="color:var(--ts)"><b>次日应送量</b></td><td><b style="color:var(--g)">${need}</b> ${r.unit}${need==0?' <span style="color:var(--ts);font-size:12px">（在仓货已够，次日免送）</span>':''}</td></tr>
      </tbody></table>
    </div>
    <div class="drawer-ft"><button class="btn btn-o" onclick="closeDrawer()">关闭</button></div>`);
  };

  PAGES['m-stock-presend']=()=>{
    ensurePresend();
    const rows=stockRows(),sel=DB.presendStockSel||[],f=DB.presendStockF||{};
    const able=rows.filter(r=>!r.returning);
    const allOn=able.length&&able.every(r=>sel.includes(r.sku+'|'+r.wh));
    const expCnt=DB.presendStock.filter(r=>r.shelfLeft<=2).length;
    const body=rows.length?rows.map(r=>{
      const key=r.sku+'|'+r.wh,need=nextShouldOf(r);
      return `<tr>
        <td><input type="checkbox" ${r.returning?'disabled':''} ${sel.includes(key)?'checked':''} onclick="event.stopPropagation();psStockCheck('${key}',this.checked)"></td>
        <td onclick="psStockDrawer('${key}')" style="cursor:pointer"><b style="font-weight:600">${r.name}</b>
          <div style="font-size:11px;color:var(--ts)" class="mono">${r.sku}</div></td>
        <td style="color:var(--ts)">${r.spec}</td>
        <td>${r.wh}</td>
        <td style="color:var(--ts)">${r.inDate}</td>
        <td style="text-align:right;color:var(--ts)">${r.sent}</td>
        <td style="text-align:right;color:var(--ts)">${r.sold}</td>
        <td style="text-align:right"><b>${r.left}</b> <span style="color:var(--ts)">${r.unit}</span>${r.over?`<div style="font-size:11px;color:var(--gold)">含多收 ${r.over}</div>`:''}</td>
        <td style="text-align:right">${r.hold} 天</td>
        <td style="text-align:right">${r.shelfLeft<=2?`<span style="color:var(--r)">${r.shelfLeft} 天</span>`:`<span style="color:var(--ts)">${r.shelfLeft} 天</span>`}</td>
        <td style="text-align:right"><b>${need}</b> <span style="color:var(--ts)">${r.unit}</span>${need==0?'<div style="font-size:11px;color:var(--g)">次日免送</div>':''}</td>
        <td>${r.returning?'<span class="tag t-b"><span class="dot"></span>退回中</span>'
          :`<button class="btn btn-sm btn-link" onclick="psStockDrawer('${key}')">详情</button>`}</td>
      </tr>`;}).join('')
      : `<tr><td colspan="12"><div class="empty"><div class="e-ic">${icon('🏬')}</div><div class="e-t">暂无留仓预送货</div><div class="e-s">当日预送量全部售出，或还未产生留仓</div></div></td></tr>`;

    return `
    <div class="ib ib-b" style="margin-bottom:14px"><span class="i">${icon('🏬')}</span><div>
      <b>在仓预送库存</b>：当日预送到仓、截单后没卖完的货留在仓里，<b>次日订单优先消耗</b>——次日应送量 = 次日需求 − 在仓剩余，够了就不用再送。
      你<b>多送</b>的部分仓库照收，也直接进这里（当天不参与售卖，见送货单「差异」列）。
      货权归你，<b>滞销与临期由你处理</b>、可申请退回；保管期间的<b>损坏与丢失由平台承担</b>。</div></div>

    <div class="tabs" style="margin-bottom:12px">
      <div class="tab ${DB.presendStockTab=='all'?'active':''}" onclick="psStockTab('all')">全部 (${DB.presendStock.length})</div>
      <div class="tab ${DB.presendStockTab=='expiring'?'active':''}" onclick="psStockTab('expiring')">临期 ≤2天 (${expCnt})</div>
    </div>

    <div class="card"><div class="card-hd">
      <div class="row" style="gap:10px;align-items:center">
        <select style="width:130px" onchange="psStockFilter('wh',this.value)">
          <option value="">全部仓库</option>${WHS.map(w=>`<option ${f.wh==w?'selected':''}>${w}</option>`).join('')}
        </select>
        <input style="width:180px" placeholder="商品名称 / SKU" value="${f.kw||''}" oninput="DB.presendStockF.kw=this.value" onchange="render()">
      </div>
      <div class="row" style="gap:8px">
        <button class="btn btn-sm btn-o" ${sel.length?'':'disabled'} onclick="psStockReturn()">申请退回${sel.length?` (${sel.length})`:''}</button>
      </div>
    </div>
    <div class="card-bd flush"><div style="overflow-x:auto"><table>
      <thead><tr>
        <th style="width:36px"><input type="checkbox" ${allOn?'checked':''} ${able.length?'':'disabled'} onclick="psStockCheckAll(this.checked)"></th>
        <th>商品</th><th>规格</th><th>入库仓库</th><th>入仓日期</th>
        <th style="text-align:right">预送量</th><th style="text-align:right">已售</th><th style="text-align:right">在仓剩余</th>
        <th style="text-align:right">已留仓</th><th style="text-align:right">剩余保质期</th><th style="text-align:right">次日应送量</th><th style="width:90px">操作</th>
      </tr></thead><tbody>${body}</tbody>
    </table></div></div></div>`;
  };

  /* ---------- 送货盘点（两个维度：按送货单 / 按 SKU）----------
     2026-09-15 沈亮拍板：原「送货复盘」改为「送货盘点」，不再按送多/送少分桶，
     改成两个维度看同一批数据——① 按送货单：每天每仓一张单，盘这一单送了什么、收了多少；
     ② 按 SKU：一个品逐日的送货明细，看它每天送多少、收多少、差多少。
     口径：应送 = 订单量 + 预送量（BR-10b/BR-21）；短收按实收计（BR-16）；
          多收照收入寄存、当日不可卖（BR-16c/BR-16d）。 */
  const AUD_DAYS=['2026-08-30','2026-08-29','2026-08-28','2026-08-27','2026-08-26','2026-08-25','2026-08-24'];
  window.ensurePsAudit=function(){
    ensurePresend();
    if(DB.psAudit)return;
    DB.psAuditTab='doc';DB.psAuditF={day:AUD_DAYS[0]};
    const whs=[...new Set(DB.presend.map(r=>r.wh))];
    const docs=[];let seq=0;
    AUD_DAYS.slice().reverse().forEach(d=>{
      whs.forEach(wh=>{
        const rows=DB.presend.filter(r=>r.wh==wh);
        if(!rows.length)return;
        const lines=rows.map(r=>{
          const sd=r.sku+wh+d;
          const orderQty=Math.max(1,Math.round(r.orderQty*(0.7+hnum(sd+'o',70)/100)));
          const psQty=Math.max(0,Math.round(finalQty(r)*(0.7+hnum(sd+'p',70)/100)));
          const planned=orderQty+psQty;
          const h=hnum(sd+'rc',10);                       // 约 2/10 短收、2/10 多收、其余足额
          const received=h<2?Math.max(orderQty,planned-(1+hnum(sd+'sd',5)))
                        :h<4?planned+(2+hnum(sd+'od',6))
                        :planned;
          return {sku:r.sku,name:r.name,unit:r.unit,spec:r.spec,orderQty,psQty,planned,received,
                  short:Math.max(0,planned-received),over:Math.max(0,received-planned)};
        });
        docs.push({no:'SH'+d.replace(/-/g,'')+String(++seq).padStart(3,'0'),date:d,wh,lines});
      });
    });
    DB.psAudit={days:AUD_DAYS,docs};
  };
  const sum=(arr,f)=>arr.reduce((a,x)=>a+f(x),0);
  function docTotals(d){return {planned:sum(d.lines,l=>l.planned),received:sum(d.lines,l=>l.received),
    short:sum(d.lines,l=>l.short),over:sum(d.lines,l=>l.over)};}
  function docTag(t){
    if(t.short)return '<span class="tag t-r"><span class="dot"></span>有短收</span>';
    if(t.over)return '<span class="tag t-y"><span class="dot"></span>有多收</span>';
    return '<span class="tag t-g"><span class="dot"></span>足额收货</span>';
  }
  // 按 SKU 聚合（跨日）
  function skuRows(){
    const f=DB.psAuditF||{},map={};
    DB.psAudit.docs.forEach(d=>{
      if(f.wh&&d.wh!=f.wh)return;
      d.lines.forEach(l=>{
        const k=l.sku+'|'+d.wh;
        if(!map[k])map[k]={sku:l.sku,name:l.name,unit:l.unit,spec:l.spec,wh:d.wh,days:[]};
        map[k].days.push({date:d.date,no:d.no,...l});
      });
    });
    let rows=Object.values(map).map(r=>({...r,
      planned:sum(r.days,x=>x.planned),received:sum(r.days,x=>x.received),
      short:sum(r.days,x=>x.short),over:sum(r.days,x=>x.over),
      days:r.days.slice().sort((a,b)=>b.date.localeCompare(a.date))}));
    if(f.kw)rows=rows.filter(r=>r.name.includes(f.kw)||r.sku.includes(f.kw));
    return rows.sort((a,b)=>b.planned-a.planned);
  }
  function docRows(){
    const f=DB.psAuditF||{};
    return DB.psAudit.docs.filter(d=>(!f.day||d.date==f.day)&&(!f.wh||d.wh==f.wh))
      .sort((a,b)=>b.date.localeCompare(a.date)||a.wh.localeCompare(b.wh));
  }
  window.paTabTo=function(k){DB.psAuditTab=k;render();};
  window.paFilter=function(k,v){DB.psAuditF=DB.psAuditF||{};DB.psAuditF[k]=v;render();};
  window.paReset=function(){DB.psAuditF={day:AUD_DAYS[0]};render();};

  // 抽屉①：一张送货单的逐 SKU 明细
  window.paDocDrawer=function(no){
    const d=DB.psAudit.docs.find(x=>x.no==no);if(!d)return;const t=docTotals(d);
    drawer(`<div class="drawer-hd"><div><h3>${d.no}</h3>
      <div style="margin-top:4px">${docTag(t)} <span class="sub" style="font-size:12px">${d.date} · ${d.wh} · ${d.lines.length} 个 SKU</span></div></div>
      <span class="x" onclick="closeDrawer()">×</span></div>
    <div class="drawer-bd">
      <h4 style="font-size:13px;color:var(--ts);margin:0 0 10px">本单合计</h4>
      <table class="subtbl" style="margin-bottom:22px"><tbody>
        <tr><td style="width:42%;color:var(--ts)">应送（订单 + 预送）</td><td><b>${t.planned}</b></td></tr>
        <tr><td style="color:var(--ts)">仓库实收</td><td><b>${t.received}</b></td></tr>
        <tr><td style="color:var(--ts)">短收</td><td>${t.short?`<span style="color:var(--r)">−${t.short}</span>`:'<span style="color:var(--tt)">—</span>'}</td></tr>
        <tr><td style="color:var(--ts)">多收</td><td>${t.over?`<span style="color:var(--gold)">+${t.over}</span> <span style="font-size:12px;color:var(--ts)">已入在仓寄存，当日不参与售卖</span>`:'<span style="color:var(--tt)">—</span>'}</td></tr>
      </tbody></table>
      <h4 style="font-size:13px;color:var(--ts);margin:0 0 10px">逐 SKU 明细</h4>
      <table><thead><tr><th>商品</th><th style="text-align:right">应送</th><th style="text-align:right">实收</th><th style="text-align:right">差异</th></tr></thead><tbody>
        ${d.lines.map(l=>`<tr><td><b>${l.name}</b><div style="font-size:11px;color:var(--ts)">订单 ${l.orderQty} · <span style="color:var(--gold)">预送 ${l.psQty}</span></div></td>
          <td style="text-align:right">${l.planned}</td><td style="text-align:right">${l.received}</td>
          <td style="text-align:right">${l.short?`<span style="color:var(--r)">−${l.short}</span>`:(l.over?`<span style="color:var(--gold)">+${l.over}</span>`:'<span style="color:var(--tt)">0</span>')}</td></tr>`).join('')}
      </tbody></table>
    </div>
    <div class="drawer-ft"><button class="btn btn-o" onclick="closeDrawer()">关闭</button>
      <button class="btn btn-p" onclick="closeDrawer();nav('m-delivery')">查看送货单</button></div>`);
  };

  // 抽屉②：一个 SKU 的每日送货明细
  window.paSkuDrawer=function(key){
    const r=skuRows().find(x=>x.sku+'|'+x.wh==key);if(!r)return;
    const st=(DB.presendStock||[]).find(x=>x.sku==r.sku&&x.wh==r.wh);
    const ps=DB.presend.find(x=>x.sku==r.sku&&x.wh==r.wh);
    const left=st?st.left:0,todayOrder=r.days[0]?r.days[0].orderQty:0,todayPs=ps?finalQty(ps):0;
    const todayShould=Math.max(0,todayOrder+todayPs-left);
    drawer(`<div class="drawer-hd"><div><h3>${r.name} <span class="mono" style="font-size:12.5px;color:var(--ts)">${r.sku}</span></h3>
      <div style="margin-top:4px"><span class="sub" style="font-size:12px">${r.wh} · ${r.spec} · 近 ${r.days.length} 天</span></div></div>
      <span class="x" onclick="closeDrawer()">×</span></div>
    <div class="drawer-bd">
      <h4 style="font-size:13px;color:var(--ts);margin:0 0 10px">每日送货明细</h4>
      <table style="margin-bottom:22px"><thead><tr><th>送货日</th><th>送货单</th><th style="text-align:right">应送</th><th style="text-align:right">实收</th><th style="text-align:right">差异</th></tr></thead><tbody>
        ${r.days.map(x=>`<tr><td>${x.date}</td><td class="mono" style="font-size:12px">${x.no}</td>
          <td style="text-align:right">${x.planned}<div style="font-size:11px;color:var(--ts)">订单 ${x.orderQty} · 预送 ${x.psQty}</div></td>
          <td style="text-align:right">${x.received}</td>
          <td style="text-align:right">${x.short?`<span style="color:var(--r)">−${x.short}</span>`:(x.over?`<span style="color:var(--gold)">+${x.over}</span>`:'<span style="color:var(--tt)">0</span>')}</td></tr>`).join('')}
        <tr style="background:#F7FBF8"><td colspan="2" style="font-weight:600">合计</td>
          <td style="text-align:right;font-weight:600">${r.planned}</td><td style="text-align:right;font-weight:600">${r.received}</td>
          <td style="text-align:right;font-weight:600">${r.short?`<span style="color:var(--r)">−${r.short}</span>`:''}${r.over?`<span style="color:var(--gold)"> +${r.over}</span>`:''}${(!r.short&&!r.over)?'0':''}</td></tr>
      </tbody></table>
      <h4 style="font-size:13px;color:var(--ts);margin:0 0 10px">今天该送多少</h4>
      <table class="subtbl"><tbody>
        <tr><td style="width:42%;color:var(--ts)">今日订单需求</td><td>${todayOrder} ${r.unit}</td></tr>
        <tr><td style="color:var(--ts)">今日预送量（算法定稿）</td><td>+ ${todayPs} ${r.unit}</td></tr>
        <tr><td style="color:var(--ts)">减去在仓剩余${st&&st.over?`（含多收 ${st.over}）`:''}</td><td>− ${left} ${r.unit}</td></tr>
        <tr><td style="color:var(--ts)"><b>今日应送</b></td><td><b style="color:var(--g);font-size:16px">${todayShould}</b> ${r.unit}${todayShould==0?' <span style="color:var(--ts);font-size:12px">（在仓货已够，今日免送）</span>':''}</td></tr>
      </tbody></table>
    </div>
    <div class="drawer-ft"><button class="btn btn-o" onclick="closeDrawer()">关闭</button>
      <button class="btn btn-p" onclick="closeDrawer();nav('m-pick-label')">去打印标签</button></div>`);
  };

  PAGES['m-presend-recon']=()=>{
    ensurePsAudit();
    const tab=DB.psAuditTab,f=DB.psAuditF||{};
    const dRows=docRows(),sRows=skuRows();
    const scope=tab=='doc'?dRows.flatMap(d=>d.lines):sRows;
    const kpi=(l,v,c,sub)=>`<div style="flex:1;min-width:120px">
      <div style="font-size:11.5px;color:var(--ts)">${l}</div>
      <div style="font-size:19px;font-weight:600;margin-top:2px;${c?'color:'+c:''}">${v}</div>
      ${sub?`<div style="font-size:11px;color:var(--tt);margin-top:2px">${sub}</div>`:''}</div>`;
    const sp=sum(scope,x=>x.planned),sr=sum(scope,x=>x.received),ss=sum(scope,x=>x.short),so=sum(scope,x=>x.over);

    const docBody=dRows.length?dRows.map(d=>{const t=docTotals(d);return `<tr onclick="paDocDrawer('${d.no}')" style="cursor:pointer">
      <td>${d.date}</td><td class="mono">${d.no}</td><td>${d.wh}</td><td>${d.lines.length}</td>
      <td style="text-align:right">${t.planned}</td>
      <td style="text-align:right"><b>${t.received}</b></td>
      <td style="text-align:right">${t.short?`<span style="color:var(--r)">−${t.short}</span>`:'<span style="color:var(--tt)">—</span>'}</td>
      <td style="text-align:right">${t.over?`<span style="color:var(--gold)">+${t.over}</span>`:'<span style="color:var(--tt)">—</span>'}</td>
      <td>${docTag(t)}</td>
      <td><button class="btn btn-sm btn-link" onclick="event.stopPropagation();paDocDrawer('${d.no}')">明细</button></td></tr>`;}).join('')
      : `<tr><td colspan="10"><div class="empty"><div class="e-ic">${icon('🚚')}</div><div class="e-t">该日无送货单</div><div class="e-s">换个送货日或仓库再看看</div></div></td></tr>`;

    const skuBody=sRows.length?sRows.map(r=>{const key=r.sku+'|'+r.wh;
      return `<tr onclick="paSkuDrawer('${key}')" style="cursor:pointer">
      <td><b style="font-weight:600">${r.name}</b><div style="font-size:11px;color:var(--ts)" class="mono">${r.sku}</div></td>
      <td style="color:var(--ts)">${r.spec}</td><td>${r.wh}</td><td>${r.days.length} 天</td>
      <td style="text-align:right">${r.planned}</td>
      <td style="text-align:right"><b>${r.received}</b></td>
      <td style="text-align:right">${r.short?`<span style="color:var(--r)">−${r.short}</span>`:'<span style="color:var(--tt)">—</span>'}</td>
      <td style="text-align:right">${r.over?`<span style="color:var(--gold)">+${r.over}</span>`:'<span style="color:var(--tt)">—</span>'}</td>
      <td><button class="btn btn-sm btn-link" onclick="event.stopPropagation();paSkuDrawer('${key}')">每日明细</button></td></tr>`;}).join('')
      : `<tr><td colspan="9"><div class="empty"><div class="e-ic">${icon('📊')}</div><div class="e-t">当前筛选下无送货记录</div><div class="e-s">换个仓库或关键词再看看</div></div></td></tr>`;

    return `
    <div class="ib ib-b" style="margin-bottom:14px"><span class="i">${icon('📊')}</span><div>
      <b>送货盘点</b>：盘每天<b>送了多少、仓库收了多少、差多少</b>。两个维度看同一批数据——
      <b>按送货单</b>看某天某仓这一单的收货结果，<b>按 SKU</b> 看某个品逐日的送货明细。
      应送 = 订单量 + 预送量；<b>短收</b>按实收计、当日配额同步下调；<b>多收</b>仓库照收不设上限，已入在仓寄存，当天不参与售卖、次日优先抵扣。</div></div>

    <div class="card" style="margin-bottom:14px">
      <div class="card-hd"><h3>送收对账</h3><span class="sub">${tab=='doc'?(f.day||'全部日期'):'近 '+AUD_DAYS.length+' 天累计'}${f.wh?' · '+f.wh:''}</span></div>
      <div class="card-bd"><div class="row" style="gap:26px;flex-wrap:wrap;align-items:flex-start">
        ${kpi('应送合计',sp,'','订单量 + 预送量')}
        ${kpi('仓库实收',sr,'','收货清点回写')}
        ${kpi('短收',ss?'−'+ss:'0',ss?'var(--r)':'','没送足，当日配额同步下调')}
        ${kpi('多收',so?'+'+so:'0',so?'var(--gold)':'','已入在仓寄存，次日优先抵扣')}
      </div></div>
    </div>

    <div class="tabs" style="margin-bottom:12px">
      <div class="tab ${tab=='doc'?'active':''}" onclick="paTabTo('doc')">按送货单 (${dRows.length})</div>
      <div class="tab ${tab=='sku'?'active':''}" onclick="paTabTo('sku')">按 SKU (${sRows.length})</div>
    </div>

    <div class="card"><div class="card-hd">
      <div class="row" style="gap:10px;align-items:center">
        ${tab=='doc'?`<span style="font-size:12.5px;color:var(--ts)">送货日</span>
        <select style="width:150px" onchange="paFilter('day',this.value)">
          <option value="">全部日期</option>${AUD_DAYS.map(d=>`<option ${f.day==d?'selected':''}>${d}</option>`).join('')}
        </select>`:''}
        <select style="width:130px" onchange="paFilter('wh',this.value)">
          <option value="">全部仓库</option>${WHS.map(w=>`<option ${f.wh==w?'selected':''}>${w}</option>`).join('')}
        </select>
        ${tab=='sku'?`<input style="width:180px" placeholder="商品名称 / SKU" value="${f.kw||''}" oninput="DB.psAuditF.kw=this.value" onchange="render()">`:''}
        <button class="btn btn-o btn-sm" onclick="paReset()">重置</button>
      </div>
      <div class="row" style="gap:8px">
        <button class="btn btn-o btn-sm" onclick="toast('已导出送货盘点.xlsx','ok')">导出</button>
        <button class="btn btn-p btn-sm" onclick="nav('m-pick-label')">去打印今日标签</button>
      </div>
    </div>
    <div class="card-bd flush"><div style="overflow-x:auto">
    ${tab=='doc'?`<table>
      <thead><tr><th>送货日</th><th>送货单号</th><th>入库仓库</th><th>SKU 数</th>
        <th style="text-align:right">应送</th><th style="text-align:right">仓库实收</th>
        <th style="text-align:right">短收</th><th style="text-align:right">多收</th><th>结果</th><th style="width:90px">操作</th>
      </tr></thead><tbody>${docBody}</tbody></table>`
    :`<table>
      <thead><tr><th>商品</th><th>规格</th><th>入库仓库</th><th>送货天数</th>
        <th style="text-align:right">累计应送</th><th style="text-align:right">累计实收</th>
        <th style="text-align:right">累计短收</th><th style="text-align:right">累计多收</th><th style="width:110px">操作</th>
      </tr></thead><tbody>${skuBody}</tbody></table>`}
    </div></div></div>`;
  };

})();
