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
      const fcst=hnum(a.sku+'np',10)<3?0:Math.max(3,Math.round(a.orderQty*(0.4+hnum(a.name+a.wh+'f',140)/100))); // 约 3/10 SKU 算法不出预测（非预送品），不进预送池
      const avail=Math.max(3,Math.round(fcst*(0.6+hnum(a.name+a.wh+'a',70)/100))); // 可售库存 = 预测量的 45%–105%
      const hist=[0,1,2,3].map(k=>Math.max(0,fcst-6+hnum(a.name+a.wh+'h'+k,13)));
      return {sku:a.sku,name:a.name,unit:a.unit,spec,cat:(p&&p.cat)||'—',wh:a.wh,
        fcst,avail,orderQty:a.orderQty,hist};
    });
    DB.presend=rows;
    buildAudit();        // 逐日链式演算 → DB.psAudit（送货盘点数据源）
    buildStock();        // 由链式结果的期末在仓派生「在仓预送库存」，与盘点同源
  };

  /* 逐日链式演算（送货盘点 / 在仓预送库存 / 备货参考 / 打印标签 的唯一数据源）
     每天每仓一张送货单，一个 SKU 在一天里走完整条账：
       期初在仓 → 应送(BR-15b 已扣期初) → 实收(可短收/多收) → 卖出(受配额封顶) → 期末在仓
     账必须平：期末在仓 = 期初在仓 + 实收 − 仓库实出（在仓是实物，以仓库实际出库为准；实出 < 卖出 = 仓库少发） */
  const AUD_DAYS=['2026-08-30','2026-08-29','2026-08-28','2026-08-27','2026-08-26','2026-08-25','2026-08-24'];
  function buildAudit(){
    const psOn=(typeof presendOn=='function')&&presendOn();
    const whs=[...new Set(DB.presend.map(r=>r.wh))];
    const lim=(DB.merchant&&DB.merchant.presendSkuLimit)||20;
    const carry={},docs=[];let seq=0,pool=new Set(),poolLog=null;const poolDays=[];
    AUD_DAYS.slice().reverse().forEach(d=>{           // 由早到晚滚动，前一日期末即次日期初
      /* BR-22 预送池（跨日滚动，非每日重排）：
         ① 池内仍有期末在仓的 SKU 继续占位（不论今日算法给不给预送量）；
         ② 期末在仓为 0 的出池，腾出名额；
         ③ 算法今日给出预送量的 SKU：已在池内的照常预送；不在池内的按空余名额补入（按算法预送量从高到低），补不进的直接舍弃。 */
      const gross={},grossBy={},openBy={};
      whs.forEach(wh=>DB.presend.filter(r=>r.wh==wh).forEach(r=>{
        const g=psOn?Math.max(0,Math.round(rawQty(r)*(0.7+hnum(r.sku+wh+d+'p',70)/100))):0;
        grossBy[r.sku+'|'+wh]=g;
        gross[r.sku]=(gross[r.sku]||0)+g;
        openBy[r.sku]=(openBy[r.sku]||0)+(carry[r.sku+'|'+wh]||0);
      }));
      const keep=[...pool].filter(k=>(openBy[k]||0)>0);                        // ① 有期末在仓 → 继续占位
      const free=Math.max(0,lim-keep.length);                                  // ② 库存为 0 的出池，腾出名额
      const add=Object.keys(gross).filter(k=>gross[k]>0&&keep.indexOf(k)<0)    // ③ 新 SKU 按名额补入，超出舍弃
        .sort((a,b)=>gross[b]-gross[a]||a.localeCompare(b)).slice(0,free);
      const out=[...pool].filter(k=>keep.indexOf(k)<0);
      pool=new Set(keep.concat(add));
      poolLog={date:d,limit:lim,keep,add,out,dropped:Object.keys(gross).filter(k=>gross[k]>0&&!pool.has(k)),openBy:Object.assign({},openBy)};
      poolDays.push(poolLog);
      whs.forEach(wh=>{
        const rs=DB.presend.filter(r=>r.wh==wh);
        if(!rs.length)return;
        const lines=rs.map(r=>{
          const sd=r.sku+wh+d,key=r.sku+'|'+wh;
          const open=carry[key]||0;                                            // 期初在仓（昨日未售完 + 昨日多收）
          const orderQty=Math.max(1,Math.round(r.orderQty*(0.7+hnum(sd+'o',70)/100)));
          const psQty=pool.has(r.sku)?grossBy[key]:0;                          // 不在预送池 → 当日不预送（BR-22）
          const ded=Math.min(open,psQty),psNet=psQty-ded;                     // BR-15b：在仓先抵扣预送（预送量含订单量）
          const planned=Math.max(orderQty,psNet);                              // 应送 = max(订单量, 预送量−在仓)：预送量是全天总量已含订单，不相加；订单量兜底照送
          const h=hnum(sd+'rc',10);                                            // 约 2/10 短收、2/10 多收、其余足额
          const received=h<2?Math.max(0,planned-(1+hnum(sd+'sd',5)))
                        :h<4?planned+(2+hnum(sd+'od',6))
                        :planned;
          const quota=Math.max(orderQty,psQty);                                // 当日可卖上限 = 全天预测总量（已含订单），多收不进配额（BR-16d）
          const stock=open+received;                                           // 当天仓里能动的货
          const demand=orderQty+Math.round(Math.max(0,psQty-orderQty)*(0.35+hnum(sd+'ra',70)/100)); // 当日真实需求（预测含订单，只随机超出部分）
          const sold=Math.min(stock,demand,quota);
          const outQty=hnum(sd+'ot',10)<1?Math.max(0,sold-(1+hnum(sd+'os',2))):sold; // 仓库实际出库（约 1/10 少发）
          const close=stock-outQty;                                            // 期末在仓（按实出扣）
          carry[key]=close;
          return {sku:r.sku,name:r.name,unit:r.unit,spec:r.spec,orderQty,psQty,
                  open,ded,psNet,planned,received,sold,out:outQty,close,
                  short:Math.max(0,planned-received),over:Math.max(0,received-planned)};
        });
        docs.push({no:'SH'+d.replace(/-/g,'')+String(++seq).padStart(3,'0'),date:d,wh,lines});
      });
    });
    DB.psAuditTab='doc';DB.psAuditF={day:AUD_DAYS[0]};
    DB.psAudit={days:AUD_DAYS,docs};
    DB.psLeft=carry;                 // 最新期末在仓（= 今天的在仓剩余），供四处统一取用
    DB.psPool=pool;                  // 今日预送池（跨日滚动的结果），供 finalQty / 运营平台清单取用
    DB.psPoolLog=poolLog;            // 今日入池/出池/舍弃明细
    DB.psPoolDays=poolDays;          // 逐日池变动（自检用）
  }
  function buildStock(){
    const last=DB.psAudit.docs.filter(d=>d.date==AUD_DAYS[0]);
    const rows=[];
    last.forEach(d=>d.lines.forEach(l=>{
      if(l.close<=0)return;          // 已清零的不进在仓列表
      const hold=1+hnum(l.sku+'d',3);
      rows.push({sku:l.sku,name:l.name,unit:l.unit,spec:l.spec,wh:d.wh,inDate:AUD_DAYS[0],
        open:l.open,sent:l.planned,recv:l.received,sold:l.sold,out:l.out,over:l.over,left:l.close,
        hold,shelfLeft:hold+1+hnum(l.sku+'e',5),
        nextNeed:Math.max(2,Math.round(l.orderQty*(0.7+hnum(l.sku+d.wh+'no',70)/100))),returning:false});
    }));
    DB.presendStock=rows;
  }

  // 供「备货参考」取最终预送量（按 商品名 + 仓库 匹配）
  window.presendQty=function(name,wh){
    if(typeof presendOn=='function'&&!presendOn())return 0;   // 未开通预送模式的商家：无预送量（BR-03）
    if(!DB.presend)ensurePresend();
    const r=DB.presend.find(x=>x.name==name&&x.wh==wh);
    return r?finalQty(r):0;
  };
  // 供「备货参考」「打印标签」扣减在仓剩余（BR-15/BR-15b）：
  // 今日应送 = max(今日订单需求, 今日预送量 − 在仓剩余)（BR-15b），四处必须同一算式
  window.presendLeft=function(name,wh){
    if(typeof presendOn=='function'&&!presendOn())return 0;   // 未开通预送模式的商家：无在仓寄存
    if(!DB.presendStock)ensurePresend();
    const r=(DB.presendStock||[]).find(x=>x.name==name&&x.wh==wh&&!x.returning);
    return r?r.left:0;               // 来源 = 逐日链式演算的最新期末在仓，与送货盘点同一个数
  };

  // BR-15b（2026-09-22 沈亮拍板）：在仓只抵扣预送，不抵扣订单——
  //   预送量（净）= max(0, 预送定稿量 − 在仓剩余)；应送 = 订单量 + 预送量（净）
  //   在仓 > 预送定稿量时，超出部分不冲抵订单，继续留仓
  window.presendNet=function(name,wh){
    const gross=presendQty(name,wh),left=presendLeft(name,wh),ded=Math.min(gross,left);
    return {gross,left,ded,net:gross-ded};
  };
  function psSplit(gross,left){const ded=Math.min(gross,left);return {ded,net:gross-ded};}
  function cfg(){return DB.presendCfg;}
  // BR-06（2026-09-15 简化）：最终预送量 = min(算法预测量, 可售库存)，系统直接定稿，无商家确认环节
  function rawQty(r){return Math.min(r.fcst,r.avail);}                        // 算法预送量（未过池）
  function finalQty(r){return (DB.psPool&&!DB.psPool.has(r.sku))?0:rawQty(r);} // 不在预送池（BR-22）→ 不预送

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
  // 次日应送量（BR-15b）：max(次日订单需求, 次日预送量 − 在仓剩余)——预送量是全天总量、已含订单，不相加
  function nextShouldOf(r){
    const ps=DB.presend.find(x=>x.sku==r.sku&&x.wh==r.wh);
    return Math.max(r.nextNeed,psSplit(ps?finalQty(ps):0,r.left).net);
  }
  window.psStockDrawer=function(key){
    const[sku,wh]=key.split('|');const r=DB.presendStock.find(x=>x.sku==sku&&x.wh==wh);if(!r)return;
    const ps=DB.presend.find(x=>x.sku==r.sku&&x.wh==r.wh),nextPs=ps?finalQty(ps):0;
    const need=nextShouldOf(r),nsp=psSplit(nextPs,r.left);
    drawer(`<div class="drawer-hd"><div><h3>${r.name} <span class="mono" style="font-size:12.5px;color:var(--ts)">${r.sku}</span></h3>
      <div style="margin-top:4px"><span class="sub" style="font-size:12px">${r.wh} · ${r.spec}</span></div></div>
      <span class="x" onclick="closeDrawer()">×</span></div>
    <div class="drawer-bd">
      <h4 style="font-size:13px;color:var(--ts);margin:0 0 10px">留仓明细</h4>
      <table class="subtbl" style="margin-bottom:22px"><tbody>
        <tr><td style="width:42%;color:var(--ts)">入仓日期</td><td>${r.inDate}</td></tr>
        <tr><td style="color:var(--ts)">期初在仓（前一日结转）</td><td>${r.open} ${r.unit}</td></tr>
        <tr><td style="color:var(--ts)">当日应送 / 实收</td><td>${r.sent} / ${r.recv} ${r.unit}</td></tr>
        <tr><td style="color:var(--ts)">当日已售 / 仓库实出</td><td>${r.sold} / ${r.out} ${r.unit}</td></tr>
        <tr><td style="color:var(--ts)">当日多收（送多照收）</td><td>${r.over?`<span style="color:var(--gold)">+${r.over}</span> ${r.unit}`:'<span style="color:var(--tt)">—</span>'}</td></tr>
        <tr><td style="color:var(--ts)"><b>在仓剩余</b></td><td><b>${r.left}</b> ${r.unit} <span style="font-size:12px;color:var(--ts)">= 期初 ${r.open} + 实收 ${r.recv} − 仓库实出 ${r.out}${r.over?'（实收含多收 '+r.over+'）':''}，与「送货盘点」期末在仓同一个数</span></td></tr>
        <tr><td style="color:var(--ts)">已留仓</td><td>${r.hold} 天</td></tr>
        <tr><td style="color:var(--ts)">剩余保质期</td><td>${r.shelfLeft<=2?`<span style="color:var(--r)">${r.shelfLeft} 天</span>`:`${r.shelfLeft} 天`}</td></tr>
      </tbody></table>
      <h4 style="font-size:13px;color:var(--ts);margin:0 0 10px">次日抵扣</h4>
      <table class="subtbl"><tbody>
        <tr><td style="width:42%;color:var(--ts)">次日订单需求</td><td>${r.nextNeed} ${r.unit}</td></tr>
        <tr><td style="color:var(--ts)">次日预送量</td><td>+ ${nsp.net} ${r.unit} <span style="font-size:12px;color:var(--ts)">= 算法定稿 ${nextPs} − 在仓剩余 ${nsp.ded}${r.left>nsp.ded?`（在仓 ${r.left}，只抵预送，超出 ${r.left-nsp.ded} 继续留仓）`:''}</span></td></tr>
        <tr><td style="color:var(--ts)"><b>次日应送量</b></td><td><b style="color:var(--g)">${need}</b> ${r.unit} <span style="font-size:12px;color:var(--ts)">= max(订单 ${r.nextNeed}, 预送 ${nsp.net})，预送量含订单量不相加</span>${nsp.net==0&&nextPs>0?' <span style="color:var(--ts);font-size:12px">（在仓货已够，次日免送预送货）</span>':''}</td></tr>
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
        <td style="text-align:right;color:var(--ts)">${r.recv}</td>
        <td style="text-align:right;color:var(--ts)">${r.sold}</td>
        <td style="text-align:right"><b>${r.left}</b> <span style="color:var(--ts)">${r.unit}</span>${r.over?`<div style="font-size:11px;color:var(--gold)">含多收 ${r.over}</div>`:''}</td>
        <td style="text-align:right">${r.hold} 天</td>
        <td style="text-align:right">${r.shelfLeft<=2?`<span style="color:var(--r)">${r.shelfLeft} 天</span>`:`<span style="color:var(--ts)">${r.shelfLeft} 天</span>`}</td>
        <td style="text-align:right"><b>${need}</b> <span style="color:var(--ts)">${r.unit}</span>${need==0?'<div style="font-size:11px;color:var(--g)">次日免送</div>':''}</td>
        <td>${r.returning?'<span class="tag t-b"><span class="dot"></span>退回中</span>'
          :`<button class="btn btn-sm btn-link" onclick="psStockDrawer('${key}')">详情</button>`}</td>
      </tr>`;}).join('')
      : `<tr><td colspan="13"><div class="empty"><div class="e-ic">${icon('🏬')}</div><div class="e-t">暂无留仓预送货</div><div class="e-s">当日预送量全部售出，或还未产生留仓</div></div></td></tr>`;

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
        <th style="text-align:right">应送</th><th style="text-align:right">实收</th><th style="text-align:right">已售</th><th style="text-align:right">在仓剩余</th>
        <th style="text-align:right">已留仓</th><th style="text-align:right">剩余保质期</th><th style="text-align:right">次日应送量</th><th style="width:90px">操作</th>
      </tr></thead><tbody>${body}</tbody>
    </table></div></div></div>`;
  };

  /* ---------- 送货盘点（两个维度：按送货单 / 按 SKU）----------
     2026-09-15 沈亮拍板：原「送货复盘」改为「送货盘点」，不再按送多/送少分桶，
     改成两个维度看同一批数据——① 按送货单：每天每仓一张单，盘这一单送了什么、收了多少；
     ② 按 SKU：一个品逐日的送货明细，看它每天送多少、收多少、差多少。
     口径：应送 = max(订单量, 预送量 − 期初在仓)，预送量为全天预测总量已含订单（BR-10b/BR-15b/BR-21）；短收按实收计（BR-16）；
          多收照收入寄存、当日不可卖（BR-16c/BR-16d）。 */
  window.ensurePsAudit=function(){ensurePresend();};   // 数据在 ensurePresend 里由 buildAudit 一次建好
  const sum=(arr,f)=>arr.reduce((a,x)=>a+f(x),0);
  function docTotals(d){return {open:sum(d.lines,l=>l.open),planned:sum(d.lines,l=>l.planned),
    received:sum(d.lines,l=>l.received),sold:sum(d.lines,l=>l.sold),out:sum(d.lines,l=>l.out),close:sum(d.lines,l=>l.close),
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
    let rows=Object.values(map).map(r=>{
      const days=r.days.slice().sort((a,b)=>b.date.localeCompare(a.date));
      return {...r,days,
        planned:sum(days,x=>x.planned),received:sum(days,x=>x.received),
        sold:sum(days,x=>x.sold),out:sum(days,x=>x.out),short:sum(days,x=>x.short),over:sum(days,x=>x.over),
        left:days[0]?days[0].close:0};     // 当前在仓 = 最近一天的期末在仓
    });
    if(f.kw)rows=rows.filter(r=>r.name.includes(f.kw)||r.sku.includes(f.kw));
    return rows.sort((a,b)=>b.planned-a.planned);
  }
  function docRows(){
    const f=DB.psAuditF||{};
    return DB.psAudit.docs.filter(d=>(!f.day||d.date==f.day)&&(!f.wh||d.wh==f.wh))
      .sort((a,b)=>b.date.localeCompare(a.date)||a.wh.localeCompare(b.wh));
  }
  // 今日应送（BR-15b）：max(今日订单需求, 今日预送量 − 在仓剩余)——预送量含订单量，不相加
  function todayShouldOf(r){
    const psOn=(typeof presendOn=='function')&&presendOn();
    const ps=DB.presend.find(x=>x.sku==r.sku&&x.wh==r.wh);
    const todayOrder=r.days[0]?r.days[0].orderQty:0;
    const todayPs=(psOn&&ps)?finalQty(ps):0;
    return Math.max(todayOrder,psSplit(todayPs,psOn?r.left:0).net);
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
        <tr><td style="width:42%;color:var(--ts)">期初在仓（昨日留仓 + 昨日多收）</td><td>${t.open} </td></tr>
        <tr><td style="color:var(--ts)">应送（取大：订单量 / 预送量 − 期初在仓）</td><td><b>${t.planned}</b></td></tr>
        <tr><td style="color:var(--ts)">仓库实收</td><td><b>${t.received}</b></td></tr>
        <tr><td style="color:var(--ts)">短收</td><td>${t.short?`<span style="color:var(--r)">−${t.short}</span>`:'<span style="color:var(--tt)">—</span>'}</td></tr>
        <tr><td style="color:var(--ts)">多收</td><td>${t.over?`<span style="color:var(--gold)">+${t.over}</span> <span style="font-size:12px;color:var(--ts)">已入在仓寄存，当日不参与售卖</span>`:'<span style="color:var(--tt)">—</span>'}</td></tr>
        <tr><td style="color:var(--ts)">当日卖出</td><td>${t.sold}</td></tr>
        <tr><td style="color:var(--ts)">仓库实出</td><td>${t.out}${t.out!==t.sold?` <span style="font-size:12px;color:var(--r)">比卖出少发 ${t.sold-t.out}，未出库的货仍在仓</span>`:''}</td></tr>
        <tr><td style="color:var(--ts)"><b>期末在仓</b></td><td><b style="color:${t.close?'var(--gold)':'var(--ts)'}">${t.close}</b> <span style="font-size:12px;color:var(--ts)">= 期初 ${t.open} + 实收 ${t.received} − 仓库实出 ${t.out}，明日优先消耗</span></td></tr>
      </tbody></table>
      <h4 style="font-size:13px;color:var(--ts);margin:0 0 10px">逐 SKU 明细</h4>
      <table><thead><tr><th>商品</th><th>送货类型</th><th style="text-align:right">期初在仓</th><th style="text-align:right">应送</th><th style="text-align:right">实收</th><th style="text-align:right">差异</th><th style="text-align:right">卖出</th><th style="text-align:right">仓库实出</th><th style="text-align:right">期末在仓</th></tr></thead><tbody>
        ${d.lines.map(l=>`<tr><td><b>${l.name}</b><div style="font-size:11px;color:var(--ts)">订单 ${l.orderQty}${l.psQty?` · <span style="color:var(--gold)">预送 ${l.psNet}</span>${l.ded?`<span style="color:var(--g)">（预测 ${l.psQty} − 在仓 ${l.ded}）</span>`:''}`:''}</div></td>
          <td>${l.psNet?'<span class="tag t-y">预测送货</span>':'<span class="tag t-g">实际送货</span>'}</td>
          <td style="text-align:right;color:var(--ts)">${l.open||'—'}</td>
          <td style="text-align:right">${l.planned}</td><td style="text-align:right">${l.received}</td>
          <td style="text-align:right">${l.short?`<span style="color:var(--r)">−${l.short}</span>`:(l.over?`<span style="color:var(--gold)">+${l.over}</span>`:'<span style="color:var(--tt)">0</span>')}</td>
          <td style="text-align:right;color:var(--ts)">${l.sold}</td>
          <td style="text-align:right">${l.out!==l.sold?`<b style="color:var(--r)">${l.out}</b><div style="font-size:11px;color:var(--r)">少发 ${l.sold-l.out}</div>`:`<span style="color:var(--ts)">${l.out}</span>`}</td>
          <td style="text-align:right"><b style="color:${l.close?'var(--gold)':'var(--ts)'}">${l.close}</b></td></tr>`).join('')}
      </tbody></table>
    </div>
    <div class="drawer-ft"><button class="btn btn-o" onclick="closeDrawer()">关闭</button>
      <button class="btn btn-p" onclick="closeDrawer();nav('m-delivery')">查看送货单</button></div>`);
  };

  // 抽屉②：一个 SKU 的每日送货明细
  window.paSkuDrawer=function(key){
    const r=skuRows().find(x=>x.sku+'|'+x.wh==key);if(!r)return;
    const ps=DB.presend.find(x=>x.sku==r.sku&&x.wh==r.wh);
    const psOn=(typeof presendOn=='function')&&presendOn();
    const left=psOn?r.left:0,todayOrder=r.days[0]?r.days[0].orderQty:0,todayPs=(psOn&&ps)?finalQty(ps):0;
    const todayShould=todayShouldOf(r),tsp=psSplit(todayPs,left);
    drawer(`<div class="drawer-hd"><div><h3>${r.name} <span class="mono" style="font-size:12.5px;color:var(--ts)">${r.sku}</span></h3>
      <div style="margin-top:4px"><span class="sub" style="font-size:12px">${r.wh} · ${r.spec} · 近 ${r.days.length} 天</span></div></div>
      <span class="x" onclick="closeDrawer()">×</span></div>
    <div class="drawer-bd">
      <h4 style="font-size:13px;color:var(--ts);margin:0 0 10px">每日送货明细</h4>
      <table style="margin-bottom:22px"><thead><tr><th>送货日</th><th>送货单</th><th style="text-align:right">期初在仓</th><th style="text-align:right">应送</th><th style="text-align:right">实收</th><th style="text-align:right">差异</th><th style="text-align:right">卖出</th><th style="text-align:right">仓库实出</th><th style="text-align:right">期末在仓</th></tr></thead><tbody>
        ${r.days.map(x=>`<tr><td>${x.date}</td><td class="mono" style="font-size:12px">${x.no}</td>
          <td style="text-align:right;color:var(--ts)">${x.open||'—'}</td>
          <td style="text-align:right">${x.planned}<div style="font-size:11px;color:var(--ts)">订单 ${x.orderQty}${x.psQty?` · 预送 ${x.psNet}${x.ded?`<span style="color:var(--g)">（${x.psQty} − 在仓 ${x.ded}）</span>`:''}`:''}</div></td>
          <td style="text-align:right">${x.received}</td>
          <td style="text-align:right">${x.short?`<span style="color:var(--r)">−${x.short}</span>`:(x.over?`<span style="color:var(--gold)">+${x.over}</span>`:'<span style="color:var(--tt)">0</span>')}</td>
          <td style="text-align:right;color:var(--ts)">${x.sold}</td>
          <td style="text-align:right">${x.out!==x.sold?`<b style="color:var(--r)">${x.out}</b><div style="font-size:11px;color:var(--r)">少发 ${x.sold-x.out}</div>`:`<span style="color:var(--ts)">${x.out}</span>`}</td>
          <td style="text-align:right"><b style="color:${x.close?'var(--gold)':'var(--ts)'}">${x.close}</b></td></tr>`).join('')}
        <tr style="background:#F7FBF8"><td colspan="3" style="font-weight:600">合计</td>
          <td style="text-align:right;font-weight:600">${r.planned}</td><td style="text-align:right;font-weight:600">${r.received}</td>
          <td style="text-align:right;font-weight:600">${r.short?`<span style="color:var(--r)">−${r.short}</span>`:''}${r.over?`<span style="color:var(--gold)"> +${r.over}</span>`:''}${(!r.short&&!r.over)?'0':''}</td>
          <td style="text-align:right;font-weight:600">${r.sold}</td>
          <td style="text-align:right;font-weight:600;${r.out!==r.sold?'color:var(--r)':''}">${r.out}</td>
          <td style="text-align:right;font-weight:600;color:${r.left?'var(--gold)':''}">${r.left}</td></tr>
      </tbody></table>
      <h4 style="font-size:13px;color:var(--ts);margin:0 0 10px">今天该送多少</h4>
      <table class="subtbl"><tbody>
        <tr><td style="width:42%;color:var(--ts)">今日订单需求</td><td>${todayOrder} ${r.unit}</td></tr>
        <tr><td style="color:var(--ts)">今日预送量</td><td>+ ${tsp.net} ${r.unit} <span style="font-size:12px;color:var(--ts)">= 算法定稿 ${todayPs} − 在仓剩余 ${tsp.ded}${left>tsp.ded?`（上表期末在仓 ${left}，只抵预送，超出 ${left-tsp.ded} 继续留仓）`:'（上表期末在仓）'}</span></td></tr>
        <tr><td style="color:var(--ts)"><b>今日应送</b></td><td><b style="color:var(--g);font-size:16px">${todayShould}</b> ${r.unit} <span style="font-size:12px;color:var(--ts)">= max(订单 ${todayOrder}, 预送 ${tsp.net})，预送量是全天总量已含订单，不相加</span></td></tr>
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
    // 在仓剩余：按送货单维度取当日期末合计，按 SKU 维度取各 SKU 当前在仓合计
    const sl=tab=='doc'?sum(dRows.flatMap(d=>d.lines),x=>x.close):sum(sRows,x=>x.left);

    const docBody=dRows.length?dRows.map(d=>{const t=docTotals(d);return `<tr onclick="paDocDrawer('${d.no}')" style="cursor:pointer">
      <td>${d.date}</td><td class="mono">${d.no}</td><td>${d.wh}</td><td>${d.lines.length}</td>
      <td style="text-align:right;color:var(--ts)">${t.open||'—'}</td>
      <td style="text-align:right">${t.planned}</td>
      <td style="text-align:right"><b>${t.received}</b></td>
      <td style="text-align:right">${t.short?`<span style="color:var(--r)">−${t.short}</span>`:'<span style="color:var(--tt)">—</span>'}</td>
      <td style="text-align:right">${t.over?`<span style="color:var(--gold)">+${t.over}</span>`:'<span style="color:var(--tt)">—</span>'}</td>
      <td style="text-align:right;color:var(--ts)">${t.sold}</td>
      <td style="text-align:right">${t.out!==t.sold?`<b style="color:var(--r)">${t.out}</b><div style="font-size:11px;color:var(--r)">少发 ${t.sold-t.out}</div>`:`<span style="color:var(--ts)">${t.out}</span>`}</td>
      <td style="text-align:right"><b style="color:${t.close?'var(--gold)':'var(--ts)'}">${t.close}</b></td>
      <td>${docTag(t)}</td>
      <td><button class="btn btn-sm btn-link" onclick="event.stopPropagation();paDocDrawer('${d.no}')">明细</button></td></tr>`;}).join('')
      : `<tr><td colspan="14"><div class="empty"><div class="e-ic">${icon('🚚')}</div><div class="e-t">该日无送货单</div><div class="e-s">换个送货日或仓库再看看</div></div></td></tr>`;

    const skuBody=sRows.length?sRows.map(r=>{const key=r.sku+'|'+r.wh,ts=todayShouldOf(r);
      return `<tr onclick="paSkuDrawer('${key}')" style="cursor:pointer">
      <td><b style="font-weight:600">${r.name}</b><div style="font-size:11px;color:var(--ts)" class="mono">${r.sku}</div></td>
      <td style="color:var(--ts)">${r.spec}</td><td>${r.wh}</td><td>${r.days.length} 天</td>
      <td style="text-align:right">${r.planned}</td>
      <td style="text-align:right"><b>${r.received}</b></td>
      <td style="text-align:right">${r.short?`<span style="color:var(--r)">−${r.short}</span>`:'<span style="color:var(--tt)">—</span>'}</td>
      <td style="text-align:right">${r.over?`<span style="color:var(--gold)">+${r.over}</span>`:'<span style="color:var(--tt)">—</span>'}</td>
      <td style="text-align:right"><b style="color:${r.left?'var(--gold)':'var(--ts)'}">${r.left}</b> <span style="color:var(--ts)">${r.unit}</span></td>
      <td style="text-align:right"><b style="color:var(--g)">${ts}</b>${ts==0?'<div style="font-size:11px;color:var(--g)">今日免送</div>':''}</td>
      <td><button class="btn btn-sm btn-link" onclick="event.stopPropagation();paSkuDrawer('${key}')">每日明细</button></td></tr>`;}).join('')
      : `<tr><td colspan="11"><div class="empty"><div class="e-ic">${icon('📊')}</div><div class="e-t">当前筛选下无送货记录</div><div class="e-s">换个仓库或关键词再看看</div></div></td></tr>`;

    return `
    <div class="ib ib-b" style="margin-bottom:14px"><span class="i">${icon('📊')}</span><div>
      <b>送货盘点</b>：盘每天<b>送了多少、仓库收了多少、差多少</b>。两个维度看同一批数据——
      <b>按送货单</b>看某天某仓这一单的收货结果，<b>按 SKU</b> 看某个品逐日的送货明细。
      ${(typeof presendOn=='function'&&presendOn())
        ?'一天的账这样走：<b>期初在仓 → 应送（<b>max(订单量, 预送量 − 期初在仓)</b>：预送量是全天预测总量、<b>已含订单量</b>，取大不相加；订单量兜底照送）→ 仓库实收 → 卖出 → 仓库实出 → 期末在仓</b>，账必平：<b>期末在仓 = 期初在仓 + 实收 − 仓库实出</b>（实出少于卖出 = 仓库少发，货仍在仓）。期末在仓就是明天的期初，<b>明天的预送量先把它扣掉</b>，不用重复送。<br><b>短收</b>按实收计、当日配额同步下调；<b>多收</b>仓库照收不设上限，当天不参与售卖，直接进在仓剩余。'
        :'一天的账这样走：<b>期初在仓 → 应送 → 仓库实收 → 卖出 → 仓库实出 → 期末在仓</b>，账必平：期末在仓 = 期初在仓 + 实收 − 仓库实出。<b>短收</b>按实收计；<b>多收</b>仓库照收不设上限，直接进在仓剩余，次日优先抵扣。'}</div></div>

    <div class="card" style="margin-bottom:14px">
      <div class="card-hd"><h3>送收对账</h3><span class="sub">${tab=='doc'?(f.day||'全部日期'):'近 '+AUD_DAYS.length+' 天累计'}${f.wh?' · '+f.wh:''}</span></div>
      <div class="card-bd"><div class="row" style="gap:26px;flex-wrap:wrap;align-items:flex-start">
        ${kpi('应送合计',sp,'','订单量 + 预送量（已扣在仓）')}
        ${kpi('仓库实收',sr,'','收货清点回写')}
        ${kpi('短收',ss?'−'+ss:'0',ss?'var(--r)':'','没送足，当日配额同步下调')}
        ${kpi('多收',so?'+'+so:'0',so?'var(--gold)':'','已入在仓寄存，次日优先抵扣')}
        ${kpi(tab=='doc'?'期末在仓':'当前在仓',sl,sl?'var(--gold)':'','留仓 + 多收，明日预送量先扣它')}
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
        <th style="text-align:right">期初在仓</th><th style="text-align:right">应送</th><th style="text-align:right">仓库实收</th>
        <th style="text-align:right">短收</th><th style="text-align:right">多收</th>
        <th style="text-align:right">卖出</th><th style="text-align:right">仓库实出</th><th style="text-align:right">期末在仓</th><th>结果</th><th style="width:90px">操作</th>
      </tr></thead><tbody>${docBody}</tbody></table>`
    :`<table>
      <thead><tr><th>商品</th><th>规格</th><th>入库仓库</th><th>送货天数</th>
        <th style="text-align:right">累计应送</th><th style="text-align:right">累计实收</th>
        <th style="text-align:right">累计短收</th><th style="text-align:right">累计多收</th>
        <th style="text-align:right">当前在仓</th><th style="text-align:right">今日应送</th><th style="width:110px">操作</th>
      </tr></thead><tbody>${skuBody}</tbody></table>`}
    </div></div></div>`;
  };

})();
