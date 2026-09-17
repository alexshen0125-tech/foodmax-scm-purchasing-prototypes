/* PC · 经营分析 —— 搬迁自 App「经营分析」(快驴卖家 总览/营收/商品/客户 Tab)。
   PC 仪表盘形态：顶部时间段筛选(今日/昨日/近7日/近30日) + 四个分析 Tab。
   数据：KPI 与趋势用各时间段占位集 STAT[period]；销量榜单与 Top 客户由 DB.orders 聚合派生 → 与系统其余模块口径一致。
   交互(与 App 对齐)：榜单行/客户行/诊断行/概览卡可点 → modal 详情；查看全部 → 完整榜单(可切维度)；营收查看详情 → 构成明细；诊断标签真过滤。
   依赖 inline 脚本全局：DB / money / toast / nav / render / modal / modalWide / closeModal（PC 整页 re-render）。
   ⚠️ onclick 调用的函数必须挂 window。 */
(function(){
  /* ---------- 状态 ---------- */
  DB.anaTab     = DB.anaTab     || 'overview';   // overview|revenue|product|customer
  DB.anaPeriod  = DB.anaPeriod  || 'today';      // today|yesterday|7d|30d
  DB.anaRankDim = DB.anaRankDim || 'sales';      // sales|qty|orders|repurchase
  DB.anaDiag    = DB.anaDiag    || 'all';        // all|new|badprice|stockout

  window.anaTab    = function(t){ DB.anaTab=t; render(); };
  window.anaPeriod = function(p){ DB.anaPeriod=p; render(); };
  window.anaRankDim= function(d){ DB.anaRankDim=d; render(); };
  window.anaDiag   = function(k){ DB.anaDiag=k; render(); };

  /* ---------- 时间段元数据 ---------- */
  const PERIODS=[['today','今日'],['yesterday','昨日'],['7d','近7日'],['30d','近30日']];
  const PLABEL={today:'今日',yesterday:'昨日','7d':'近7日','30d':'近30日'};
  // 各时间段 KPI / 概览占位集（cmp = 较上一周期 %，正=涨绿 负=跌红）
  const STAT={
    today:    {sales:11544.95, orders:741,  avg:15.58, move:0.62, onsale:48, moved:30, newSup:6, expo:9820,  addcart:1842, payconv:0.186,
               cust:512, newCust:47, repurchase:0.413, trend:[1280,1460,1390,1610,1720,1540,1544.95], tlabel:['周一','周二','周三','周四','周五','周六','周日'],
               cmp:{sales:14.83, orders:11.06, avg:0.00, cust:6.4, repurchase:2.1}},
    yesterday:{sales:10052.40, orders:663,  avg:15.16, move:0.58, onsale:48, moved:28, newSup:6, expo:9130,  addcart:1690, payconv:0.172,
               cust:486, newCust:39, repurchase:0.398, trend:[1180,1320,1240,1410,1560,1342,0],     tlabel:['周一','周二','周三','周四','周五','周六','周日'],
               cmp:{sales:-3.20, orders:-5.41, avg:1.94, cust:-2.0, repurchase:-1.4}},
    '7d':     {sales:76219.30, orders:4628, avg:16.47, move:0.71, onsale:48, moved:34, newSup:6, expo:64210, addcart:12380,payconv:0.193,
               cust:1284, newCust:226, repurchase:0.452,trend:[9820,10560,9990,11240,12180,11084,11344.3],tlabel:['6-24','6-25','6-26','6-27','6-28','6-29','6-30'],
               cmp:{sales:8.10, orders:6.32, avg:1.67, cust:4.8, repurchase:3.0}},
    '30d':    {sales:312840.55,orders:18972,avg:16.49, move:0.79, onsale:48, moved:38, newSup:6, expo:268940,addcart:51230,payconv:0.205,
               cust:2106, newCust:512, repurchase:0.476,trend:[68200,71400,76800,96440],            tlabel:['第1周','第2周','第3周','第4周'],
               cmp:{sales:12.40, orders:9.85, avg:2.31, cust:7.1, repurchase:4.4}},
  };
  const RANK_FACTOR={today:1, yesterday:0.93, '7d':6.6, '30d':27.5};

  /* ---------- 销量榜单：由 DB.orders 聚合派生 ---------- */
  // 规格 / 复购率 占位映射（按商品名补全榜单展示字段）
  const SPEC={'小棠菜':'散装·1kg/扎','白菜':'散装·1kg/袋','空心菜':'散装·1kg/扎','菠菜':'精品·500g/扎','娃娃菜':'精品·3棵/袋','芥蓝':'散装·1kg/扎'};
  const REP ={'小棠菜':0.34,'白菜':0.28,'空心菜':0.31,'菠菜':0.22,'娃娃菜':0.19,'芥蓝':0.17};
  function buildRank(){
    const map={};
    (DB.orders||[]).forEach(o=>(o.lines||[]).forEach(l=>{
      const k=l.name; if(!map[k]) map[k]={name:k, unit:l.unit||'件', qty:0, sales:0, ord:new Set()};
      map[k].qty += l.qty||0; map[k].sales += (l.qty||0)*(l.price||0); map[k].ord.add(o.id);
    }));
    let rows=Object.values(map).map(r=>({name:r.name, unit:r.unit, qty:r.qty, sales:r.sales, orders:r.ord.size,
      spec:SPEC[r.name]||('散装·1'+r.unit), rep:REP[r.name]||0.15}));
    if(!rows.length) return rows;   // 无成交订单 → 交由调用方渲染空态
    // 榜单补足占位行（演示态：有成交时让榜单更饱满）
    ['娃娃菜','芥蓝'].forEach((nm,i)=>{ if(!rows.some(r=>r.name==nm)) rows.push({name:nm,unit:'件',qty:48-i*12,sales:268.40-i*66.8,orders:24-i*5,spec:SPEC[nm],rep:REP[nm]}); });
    // 缩放到接近线上量级（小棠菜 raw≈186 → ≈756）
    const f=RANK_FACTOR[DB.anaPeriod]*4.07;
    rows.forEach(r=>{ r.sales=+(r.sales*f).toFixed(2); r.qty=Math.round(r.qty*RANK_FACTOR[DB.anaPeriod]*4); r.orders=Math.round(r.orders*RANK_FACTOR[DB.anaPeriod]*10); });
    const dim=DB.anaRankDim;
    rows.sort((a,b)=> dim=='qty'?b.qty-a.qty : dim=='orders'?b.orders-a.orders : dim=='repurchase'?b.rep-a.rep : b.sales-a.sales);
    return rows;
  }
  // 按某维度排序的榜单（不改全局 DB.anaRankDim，供「查看全部」modal 切换维度用）
  function buildRankBy(dim){
    const saved=DB.anaRankDim; DB.anaRankDim=dim;
    const rows=buildRank(); DB.anaRankDim=saved;
    return rows;
  }
  function rankVal(r){
    const d=DB.anaRankDim;
    if(d=='qty')        return r.qty+' '+r.unit;
    if(d=='orders')     return r.orders+' 单';
    if(d=='repurchase') return (r.rep*100).toFixed(1)+'%';
    return money(r.sales);
  }

  /* ---------- 小工具 ---------- */
  const pct=n=>(n*100).toFixed(1)+'%';
  const signMoney=n=>(n<0?'- ':'')+money(Math.abs(n));
  function cmpTag(v){ // 较上一周期
    if(v===0) return `<span style="color:var(--ts)">较${prevLabel()} 0.00%</span>`;
    const up=v>0;
    return `<span style="color:${up?'var(--gd)':'var(--r)'}">较${prevLabel()} ${up?'↑':'↓'} ${Math.abs(v).toFixed(2)}%</span>`;
  }
  function prevLabel(){ return DB.anaPeriod=='today'?'昨日':DB.anaPeriod=='yesterday'?'前日':DB.anaPeriod=='7d'?'上周':'上月'; }

  // 顶部时间段筛选条
  function periodBar(){
    return `<div class="card"><div class="card-bd" style="padding:12px 16px"><div class="row" style="gap:8px;align-items:center;flex-wrap:wrap">
      <span style="font-size:13px;color:var(--ts);margin-right:4px">时间段</span>
      ${PERIODS.map(([k,t])=>`<button class="btn btn-sm ${DB.anaPeriod==k?'btn-p':'btn-o'}" onclick="anaPeriod('${k}')">${t}</button>`).join('')}
      <span style="margin-left:auto;font-size:12.5px;color:var(--ts)">统计口径：${PLABEL[DB.anaPeriod]} · 全部售卖区域 · 全部类目</span>
    </div></div></div>`;
  }
  // 分析 Tab 条
  function tabBar(){
    const T=[['overview','总览'],['revenue','营收'],['product','商品'],['customer','客户']];
    return `<div class="tabs">${T.map(([k,t])=>`<div class="tab ${DB.anaTab==k?'active':''}" onclick="anaTab('${k}')">${t}</div>`).join('')}</div>`;
  }

  // 竖向柱状图（CSS）
  function barChart(data, labels, fmt){
    const max=Math.max(...data,1);
    return `<div style="display:flex;align-items:flex-end;gap:14px;height:180px;padding:8px 4px 0">
      ${data.map((v,i)=>{const h=Math.max(4,Math.round(v/max*150));const last=i==data.length-1;return `
      <div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:6px;height:100%;justify-content:flex-end">
        <div style="font-size:11.5px;color:var(--ts);font-weight:600">${fmt(v)}</div>
        <div title="${labels[i]}：${fmt(v)}" style="width:100%;max-width:46px;height:${h}px;border-radius:6px 6px 0 0;background:${last?'var(--g)':'#A7F3D0'};transition:height .4s"></div>
        <div style="font-size:11.5px;color:var(--ts)">${labels[i]}</div>
      </div>`;}).join('')}
    </div>`;
  }
  const kfmt=v=>v>=1000?'$'+(v/1000).toFixed(1)+'k':'$'+Math.round(v);

  /* ================= 总览 ================= */
  function overview(){
    const s=STAT[DB.anaPeriod];
    const rows=buildRank();
    const kpi=`<div class="sg" style="grid-template-columns:repeat(4,1fr)">
      <div class="sc good"><div class="sc-l">销售额</div><div class="sc-v">${money(s.sales)}</div><div class="sc-s">${cmpTag(s.cmp.sales)}</div></div>
      <div class="sc"><div class="sc-l">订单量</div><div class="sc-v">${s.orders.toLocaleString()}</div><div class="sc-s">${cmpTag(s.cmp.orders)}</div></div>
      <div class="sc"><div class="sc-l">实付单均价</div><div class="sc-v">${money(s.avg)}</div><div class="sc-s">${cmpTag(s.cmp.avg)}</div></div>
      <div class="sc ${s.move<0.6?'warn':''}"><div class="sc-l">动销覆盖</div><div class="sc-v">${pct(s.move)}</div><div class="sc-s">动销 ${s.moved} / 在售 ${s.onsale} SPU</div></div>
    </div>`;
    const dims=[['sales','销售额'],['qty','销量'],['orders','订单量'],['repurchase','复购率']];
    const rankCard=`<div class="card"><div class="card-hd">
      <h3>🏆 ${PLABEL[DB.anaPeriod]}销量榜单</h3><span class="sub">Top ${rows.length} · 点行看详情 · 由订单明细派生</span>
      <div class="row" style="gap:6px;margin-left:auto">${dims.map(([k,t])=>`<button class="btn btn-sm ${DB.anaRankDim==k?'btn-p':'btn-o'}" onclick="anaRankDim('${k}')">${t}</button>`).join('')}</div>
    </div><div class="card-bd flush"><div style="overflow-x:auto"><table>
      <thead><tr><th style="width:64px">排名</th><th>商品</th><th>规格</th><th style="text-align:right">${dims.find(d=>d[0]==DB.anaRankDim)[1]}</th></tr></thead><tbody>
      ${rows.length?rows.map((r,i)=>`<tr style="cursor:pointer" onclick="anaRankDetail('${r.name}')">
        <td><span style="display:inline-block;width:24px;height:24px;line-height:24px;text-align:center;border-radius:6px;font-weight:700;font-size:12px;${i<3?'background:var(--g);color:#fff':'background:var(--bd2);color:var(--ts)'}">${String(i+1).padStart(2,'0')}</span></td>
        <td><b>${r.name}</b></td><td style="color:var(--ts)">${r.spec}</td><td style="text-align:right;font-weight:600">${rankVal(r)} <span style="color:var(--ts);font-weight:400">›</span></td>
      </tr>`).join(''):`<tr><td colspan="4"><div class="empty"><div class="e-ic">📊</div><div class="e-t">暂无销量数据</div><div class="e-s">该时间段内尚无成交订单</div></div></td></tr>`}
    </tbody></table></div>
    ${rows.length?`<div style="padding:12px 16px;text-align:center;border-top:1px solid var(--bd2)"><button class="btn btn-link" onclick="anaRankAll()">查看完整榜单 ›</button></div>`:''}
    </div></div>`;
    return periodBar()+tabBar()+kpi+rankCard;
  }

  /* ---- 总览：商品经营详情 modal（销售额/销量/订单数/复购率/趋势） ---- */
  window.anaRankDetail=function(name){
    const rows=buildRank(); const r=rows.find(x=>x.name===name); if(!r) return;
    const s=STAT[DB.anaPeriod];
    const total=rows.reduce((a,x)=>a+x.sales,0)||1;
    const share=r.sales/total;
    const trend=s.trend.map(v=>+(v*share).toFixed(2));
    modal(`<div class="mc-hd"><h3>商品经营详情 · ${r.name}</h3><p>${r.spec} · ${PLABEL[DB.anaPeriod]} · 由订单明细派生</p><button class="mc-x" onclick="closeModal()">×</button></div>
    <div class="mc-bd">
      <div class="sg" style="grid-template-columns:repeat(4,1fr)">
        <div class="sc good"><div class="sc-l">销售额</div><div class="sc-v">${money(r.sales)}</div><div class="sc-s">占榜单 ${pct(share)}</div></div>
        <div class="sc"><div class="sc-l">销量</div><div class="sc-v">${r.qty}</div><div class="sc-s">${r.unit}</div></div>
        <div class="sc"><div class="sc-l">订单数</div><div class="sc-v">${r.orders}</div><div class="sc-s">单</div></div>
        <div class="sc ${r.rep<0.2?'warn':''}"><div class="sc-l">复购率</div><div class="sc-v">${pct(r.rep)}</div><div class="sc-s">近90天买家</div></div>
      </div>
      <div class="card" style="box-shadow:none;margin:14px 0 0"><div class="card-hd"><h3 style="font-size:14px">📈 ${PLABEL[DB.anaPeriod]}销售趋势</h3><span class="sub">该商品销售额(SGD)</span></div>
        <div class="card-bd"><div style="overflow-x:auto">${barChart(trend,s.tlabel,kfmt)}</div></div></div>
      <div class="ib ib-gr" style="margin-top:12px"><span class="i">ℹ️</span>趋势按该商品销售额占比拆分到「${PLABEL[DB.anaPeriod]}」各时段，末位高亮为当前时段。</div>
    </div>
    <div class="mc-ft"><button class="btn btn-p" onclick="closeModal()">知道了</button></div>`);
  };

  /* ---- 总览：查看全部 → 完整榜单 modal（可切销售额/销量/订单量/复购率维度） ---- */
  window.anaRankAll=function(){ DB.anaAllDim=DB.anaAllDim||DB.anaRankDim; renderRankAll(); };
  window.anaRankAllDim=function(d){ DB.anaAllDim=d; renderRankAll(); };
  function renderRankAll(){
    const dim=DB.anaAllDim;
    const rows=buildRankBy(dim);
    const dims=[['sales','销售额'],['qty','销量'],['orders','订单量'],['repurchase','复购率']];
    modalWide(`<div class="mc-hd"><h3>🏆 完整销量榜单</h3><p>${PLABEL[DB.anaPeriod]} · 共 ${rows.length} 款 · 按${dims.find(d=>d[0]==dim)[1]}排序 · 点行看详情</p><button class="mc-x" onclick="closeModal()">×</button></div>
    <div class="mc-bd">
      <div class="row" style="gap:6px;margin-bottom:12px;flex-wrap:wrap">${dims.map(([k,t])=>`<button class="btn btn-sm ${dim==k?'btn-p':'btn-o'}" onclick="anaRankAllDim('${k}')">${t}</button>`).join('')}</div>
      <div style="overflow-x:auto"><table>
        <thead><tr><th style="width:56px">排名</th><th>商品</th><th>规格</th><th style="text-align:right">销售额</th><th style="text-align:right">销量</th><th style="text-align:right">订单量</th><th style="text-align:right">复购率</th></tr></thead><tbody>
        ${rows.map((r,i)=>`<tr style="cursor:pointer" onclick="closeModal();anaRankDetail('${r.name}')">
          <td><span style="display:inline-block;width:24px;height:24px;line-height:24px;text-align:center;border-radius:6px;font-weight:700;font-size:12px;${i<3?'background:var(--g);color:#fff':'background:var(--bd2);color:var(--ts)'}">${String(i+1).padStart(2,'0')}</span></td>
          <td><b>${r.name}</b></td><td style="color:var(--ts)">${r.spec}</td>
          <td style="text-align:right${dim=='sales'?';font-weight:700;color:var(--gd)':''}">${money(r.sales)}</td>
          <td style="text-align:right${dim=='qty'?';font-weight:700;color:var(--gd)':''}">${r.qty} ${r.unit}</td>
          <td style="text-align:right${dim=='orders'?';font-weight:700;color:var(--gd)':''}">${r.orders} 单</td>
          <td style="text-align:right${dim=='repurchase'?';font-weight:700;color:var(--gd)':''}">${pct(r.rep)}</td>
        </tr>`).join('')}
      </tbody></table></div>
    </div>
    <div class="mc-ft"><button class="btn btn-o" onclick="closeModal()">关闭</button></div>`);
  }

  /* ================= 营收 ================= */
  function revenue(){
    const s=STAT[DB.anaPeriod];
    const kpi=`<div class="sg" style="grid-template-columns:repeat(3,1fr)">
      <div class="sc good"><div class="sc-l">销售额</div><div class="sc-v">${money(s.sales)}</div><div class="sc-s">${cmpTag(s.cmp.sales)}</div></div>
      <div class="sc"><div class="sc-l">订单量</div><div class="sc-v">${s.orders.toLocaleString()}</div><div class="sc-s">${cmpTag(s.cmp.orders)}</div></div>
      <div class="sc"><div class="sc-l">实付单均价</div><div class="sc-v">${money(s.avg)}</div><div class="sc-s">${cmpTag(s.cmp.avg)}</div></div>
    </div>`;
    const trend=`<div class="card"><div class="card-hd"><h3>📈 营收趋势</h3><span class="sub">${PLABEL[DB.anaPeriod]} · 销售额(SGD)</span>
      <button class="btn btn-link" style="margin-left:auto" onclick="anaRevDetail()">查看详情 ›</button></div>
      <div class="card-bd"><div style="overflow-x:auto">${barChart(s.trend,s.tlabel,kfmt)}</div>
      <div class="ib ib-gr" style="margin:14px 0 0"><span class="i">ℹ️</span>柱体高度按各时段销售额相对值绘制；末位高亮为当前时段。<b>查看详情</b>可拆解货款 / 促销 / 佣金 / 实收。</div></div></div>`;
    return periodBar()+tabBar()+kpi+trend;
  }

  /* ---- 营收：查看详情 → 营收构成明细 modal（货款/促销/佣金/退款/实收） ---- */
  window.anaRevDetail=function(){
    const s=STAT[DB.anaPeriod];
    const gross=s.sales;
    const promo=+(gross*0.063).toFixed(2);      // 促销让利
    const commission=+(gross*0.05).toFixed(2);  // 平台佣金
    const refund=+(gross*0.021).toFixed(2);     // 退款/售后
    const net=+(gross-promo-commission-refund).toFixed(2); // 实收净额
    const lines=[
      ['商品货款（GMV）',gross,'买家实付商品金额合计',false],
      ['促销让利',-promo,'满减 / 折扣 / 新客券等商家补贴',false],
      ['平台佣金',-commission,'按成交额 5% 计提',false],
      ['退款 / 售后',-refund,'已退款订单金额',false],
    ];
    modal(`<div class="mc-hd"><h3>营收构成明细</h3><p>${PLABEL[DB.anaPeriod]} · 全部售卖区域 · 全部类目</p><button class="mc-x" onclick="closeModal()">×</button></div>
    <div class="mc-bd">
      <div style="overflow-x:auto"><table>
        <thead><tr><th>构成项</th><th>说明</th><th style="text-align:right">金额(SGD)</th></tr></thead><tbody>
        ${lines.map(([l,v,d])=>`<tr><td><b>${l}</b></td><td style="color:var(--ts)">${d}</td><td style="text-align:right;font-weight:600;color:${v<0?'var(--r)':'var(--tp)'}">${signMoney(v)}</td></tr>`).join('')}
        <tr style="border-top:2px solid var(--bd2)"><td><b>实收净额</b></td><td style="color:var(--ts)">货款 − 促销 − 佣金 − 退款</td><td style="text-align:right;font-weight:700;color:var(--gd);font-size:15px">${money(net)}</td></tr>
        </tbody></table></div>
      <div class="ib ib-b" style="margin-top:12px"><span class="i">ℹ️</span>实收净额为预估到账金额，最终以平台结算账单为准；结算周期 T+7。佣金、促销口径见结算规则。</div>
    </div>
    <div class="mc-ft"><button class="btn btn-p" onclick="closeModal()">知道了</button></div>`);
  };

  /* ================= 商品 ================= */
  // 6 个数据概览卡：[key,标签,值,副,类]
  function prodCards(){
    const s=STAT[DB.anaPeriod];
    return [
      ['onsale','在售商品',s.onsale,'SPU',''],
      ['moved','动销商品',s.moved,'动销率 '+pct(s.move),'good'],
      ['newSup','新品扶持中',s.newSup,'扶持期流量加权',s.newSup?'warn':''],
      ['expo','商品曝光',s.expo.toLocaleString(),'次',''],
      ['addcart','加购次数',s.addcart.toLocaleString(),'次',''],
      ['payconv','支付转化率',pct(s.payconv),'支付/曝光',''],
    ];
  }
  function product(){
    const cards=prodCards();
    const overview6=`<div class="card"><div class="card-hd"><h3>商品数据概览</h3><span class="sub">${PLABEL[DB.anaPeriod]} · 点卡片看清单</span></div><div class="card-bd">
      <div class="sg" style="grid-template-columns:repeat(3,1fr)">
        ${cards.map(([k,l,v,sub,cls])=>`<div class="sc ${cls}" style="cursor:pointer" onclick="anaProdCard('${k}')"><div class="sc-l">${l}</div><div class="sc-v">${v}</div><div class="sc-s">${sub} ›</div></div>`).join('')}
      </div></div></div>`;
    // 分析诊断
    const diags=[['all','全部商品'],['new','全部新品'],['badprice','价劣新品'],['stockout','缺货新品']];
    const list=diagList();
    const diag=`<div class="card"><div class="card-hd"><h3>分析及诊断</h3><span class="sub">定位问题商品 · 点行看诊断建议</span></div><div class="card-bd">
      <div class="row" style="gap:8px;margin-bottom:14px;flex-wrap:wrap">${diags.map(([k,t])=>`<button class="btn btn-sm ${DB.anaDiag==k?'btn-p':'btn-o'}" onclick="anaDiag('${k}')">${t}</button>`).join('')}</div>
      <div class="ib ib-y"><span class="i">⚠️</span>新品在扶持期间，存在<b>价格过高</b>或<b>缺货</b>都会导致暂停扶持，请及时处理。</div>
      <div style="overflow-x:auto"><table>
        <thead><tr><th>商品</th><th>品类</th><th style="text-align:right">价格(SGD)</th><th style="text-align:right">总库存</th><th>诊断</th></tr></thead><tbody>
        ${list.length?list.map((r,i)=>`<tr style="cursor:pointer" onclick="anaDiagDetail(${i})"><td><b>${r.name}</b></td><td>${r.cat}</td><td style="text-align:right">${r.price}</td><td style="text-align:right">${r.stock}</td><td>${r.diag} <span style="color:var(--ts)">›</span></td></tr>`).join('')
          :`<tr><td colspan="5"><div class="empty"><div class="e-ic">✅</div><div class="e-t">无${diags.find(d=>d[0]==DB.anaDiag)[1]}问题商品</div><div class="e-s">当前筛选维度下无需处理的商品</div></div></td></tr>`}
      </tbody></table></div></div></div>`;
    return periodBar()+tabBar()+overview6+diag;
  }
  // 诊断数据池：优先用真实 DB.products，无数据时给占位演示行
  function diagPool(){
    const real=(DB.products||[]).filter(p=>p.status=='onsale').map(p=>{
      const ps=(p.skus||[]).map(s=>s.price).filter(x=>x>0);
      const stock=(p.skus||[]).reduce((a,s)=>a+(+s.stock||0),0);
      return {name:p.name,cat:p.cat||'—',price:ps.length?Math.min(...ps):0,stock,out:stock<=0,high:false,isNew:!!p.newSupport};
    });
    return real.length?real:DEMO_DIAG();
  }
  function diagFiltered(k){
    let pool=diagPool();
    if(k=='new')      pool=pool.filter(r=>r.isNew);
    if(k=='badprice') pool=pool.filter(r=>r.high);
    if(k=='stockout') pool=pool.filter(r=>r.out);
    return pool;
  }
  function diagList(){
    return diagFiltered(DB.anaDiag).map(r=>({
      name:r.name, cat:r.cat, price:typeof r.price=='string'?r.price:money(r.price), stock:r.stock,
      diag:r.out?'<span class="tag t-r"><span class="dot"></span>缺货</span>':r.high?'<span class="tag t-y"><span class="dot"></span>价格偏高</span>':'<span class="tag t-g"><span class="dot"></span>正常</span>'}));
  }
  function DEMO_DIAG(){return [
    {name:'娃娃菜', cat:'新鲜蔬菜', price:7.20, stock:0,   out:true,  high:false, isNew:true},
    {name:'有机芥蓝', cat:'新鲜蔬菜', price:13.80,stock:24,  out:false, high:true,  isNew:true},
    {name:'冰鲜三文鱼', cat:'海鲜水产', price:32.00,stock:18, out:false, high:false, isNew:true},
    {name:'小棠菜', cat:'新鲜蔬菜', price:9.30, stock:120, out:false, high:false, isNew:false},
  ];}

  /* ---- 商品：诊断行 → 商品诊断详情 modal（问题 + 建议） ---- */
  window.anaDiagDetail=function(idx){
    const r=diagFiltered(DB.anaDiag)[idx]; if(!r) return;
    const priceStr=typeof r.price=='string'?r.price:money(r.price);
    let level,problem,advice;
    if(r.out){
      level='<span class="tag t-r"><span class="dot"></span>缺货</span>';
      problem='当前总库存为 0，商品已售罄无法成交，曝光流量被浪费。';
      advice='① 立即补货并在「库存管理」更新库存；② 补货前可临时下架，避免买家下单后缺货；③ 新品缺货将<b>暂停扶持</b>，恢复库存后扶持自动续期。';
    }else if(r.high){
      level='<span class="tag t-y"><span class="dot"></span>价格偏高</span>';
      problem='售价高于同类目指导价，转化率偏低，影响新品扶持考核。';
      advice='① 参考类目指导价适当下调；② 设置满减 / 新客券提升首单转化；③ <b>价劣新品</b>超 7 天未改善将暂停扶持。';
    }else{
      level='<span class="tag t-g"><span class="dot"></span>正常</span>';
      problem='暂无诊断问题，价格与库存状态正常。';
      advice='保持当前价格与库存即可；可考虑加投流量或参加平台活动进一步提升曝光与销量。';
    }
    modal(`<div class="mc-hd"><h3>商品诊断详情 · ${r.name}</h3><p>${r.cat} · ${r.isNew?'新品扶持中':'常规商品'}</p><button class="mc-x" onclick="closeModal()">×</button></div>
    <div class="mc-bd">
      <div class="sg" style="grid-template-columns:repeat(3,1fr)">
        <div class="sc"><div class="sc-l">最低售价</div><div class="sc-v">${priceStr}</div><div class="sc-s">SGD</div></div>
        <div class="sc ${r.out?'alert':''}"><div class="sc-l">总库存</div><div class="sc-v">${r.stock}</div><div class="sc-s">${r.out?'已售罄':'件'}</div></div>
        <div class="sc"><div class="sc-l">诊断结论</div><div class="sc-v" style="font-size:16px;padding-top:6px">${level}</div></div>
      </div>
      <div class="ib ${r.out?'ib-r':r.high?'ib-y':'ib-g'}" style="margin-top:14px"><span class="i">${r.out?'⛔':r.high?'⚠️':'✅'}</span><b>问题：</b>${problem}</div>
      <div class="card" style="box-shadow:none;margin:12px 0 0"><div class="card-hd"><h3 style="font-size:14px">💡 处理建议</h3></div>
        <div class="card-bd"><div style="font-size:13px;line-height:1.9;color:var(--tp)">${advice}</div></div></div>
    </div>
    <div class="mc-ft"><button class="btn btn-o" onclick="closeModal()">关闭</button>${r.out?`<button class="btn btn-p" onclick="closeModal();nav('m-stock')">去补货</button>`:r.high?`<button class="btn btn-p" onclick="closeModal();nav('m-price')">去调价</button>`:`<button class="btn btn-p" onclick="closeModal()">知道了</button>`}</div>`);
  };

  /* ---- 商品：数据概览卡 → 对应商品清单 modal ---- */
  window.anaProdCard=function(key){
    const s=STAT[DB.anaPeriod];
    const rows=[...buildRank()].sort((a,b)=>b.sales-a.sales);
    const totalSales=rows.reduce((a,r)=>a+r.sales,0)||1;
    let title,sub,thead,tbody;
    if(key=='onsale'||key=='moved'){
      const list=key=='moved'?rows.filter(r=>r.qty>0):rows;
      title=key=='moved'?'动销商品清单':'在售商品清单';
      sub=`${PLABEL[DB.anaPeriod]} · ${key=='moved'?'本时段有成交':'全部在售 SPU'}（展示 Top ${list.length} / 共 ${key=='moved'?s.moved:s.onsale} SPU）`;
      thead=`<th>商品</th><th>规格</th><th style="text-align:right">销量</th><th style="text-align:right">销售额</th><th style="text-align:right">订单量</th>`;
      tbody=list.map(r=>`<tr style="cursor:pointer" onclick="closeModal();anaRankDetail('${r.name}')"><td><b>${r.name}</b></td><td style="color:var(--ts)">${r.spec}</td><td style="text-align:right">${r.qty} ${r.unit}</td><td style="text-align:right;font-weight:600">${money(r.sales)}</td><td style="text-align:right">${r.orders} 单 <span style="color:var(--ts)">›</span></td></tr>`).join('');
    }else if(key=='newSup'){
      const list=diagPool().filter(r=>r.isNew);
      const days=[5,3,6,2,4,7];
      title='新品扶持中商品';
      sub=`${PLABEL[DB.anaPeriod]} · 扶持期内流量加权 · 共 ${list.length} 款`;
      thead=`<th>商品</th><th>品类</th><th style="text-align:right">价格(SGD)</th><th style="text-align:right">总库存</th><th style="text-align:right">扶持剩余</th><th>状态</th>`;
      tbody=list.map((r,i)=>{
        const st=r.out?'<span class="tag t-r"><span class="dot"></span>缺货暂停</span>':r.high?'<span class="tag t-y"><span class="dot"></span>价高预警</span>':'<span class="tag t-g"><span class="dot"></span>扶持中</span>';
        return `<tr><td><b>${r.name}</b></td><td>${r.cat}</td><td style="text-align:right">${money(r.price)}</td><td style="text-align:right">${r.stock}</td><td style="text-align:right">${days[i%days.length]} 天</td><td>${st}</td></tr>`;
      }).join('');
    }else{ // expo / addcart / payconv
      const titleMap={expo:'商品曝光明细',addcart:'加购次数明细',payconv:'支付转化明细'};
      title=titleMap[key];
      sub=`${PLABEL[DB.anaPeriod]} · 按销售额占比拆分到各商品（展示 Top ${rows.length}）`;
      if(key=='expo'){
        thead=`<th>商品</th><th>规格</th><th style="text-align:right">曝光次数</th><th style="text-align:right">占比</th>`;
        tbody=rows.map(r=>{const share=r.sales/totalSales;const e=Math.round(s.expo*share);return `<tr><td><b>${r.name}</b></td><td style="color:var(--ts)">${r.spec}</td><td style="text-align:right">${e.toLocaleString()}</td><td style="text-align:right">${pct(share)}</td></tr>`;}).join('');
      }else if(key=='addcart'){
        thead=`<th>商品</th><th>规格</th><th style="text-align:right">加购次数</th><th style="text-align:right">占比</th>`;
        tbody=rows.map(r=>{const share=r.sales/totalSales;const e=Math.round(s.addcart*share);return `<tr><td><b>${r.name}</b></td><td style="color:var(--ts)">${r.spec}</td><td style="text-align:right">${e.toLocaleString()}</td><td style="text-align:right">${pct(share)}</td></tr>`;}).join('');
      }else{
        thead=`<th>商品</th><th style="text-align:right">曝光</th><th style="text-align:right">支付订单</th><th style="text-align:right">转化率</th>`;
        tbody=rows.map(r=>{const share=r.sales/totalSales;const e=Math.max(1,Math.round(s.expo*share));const conv=r.orders/e;return `<tr><td><b>${r.name}</b></td><td style="text-align:right">${e.toLocaleString()}</td><td style="text-align:right">${r.orders}</td><td style="text-align:right;font-weight:600;color:${conv<s.payconv?'var(--r)':'var(--gd)'}">${pct(conv)}</td></tr>`;}).join('');
      }
    }
    modalWide(`<div class="mc-hd"><h3>${title}</h3><p>${sub}</p><button class="mc-x" onclick="closeModal()">×</button></div>
    <div class="mc-bd"><div style="overflow-x:auto"><table><thead><tr>${thead}</tr></thead><tbody>${tbody||`<tr><td colspan="6"><div class="empty"><div class="e-ic">📦</div><div class="e-t">暂无数据</div><div class="e-s">该时间段内无相关商品</div></div></td></tr>`}</tbody></table></div></div>
    <div class="mc-ft"><button class="btn btn-o" onclick="closeModal()">关闭</button></div>`);
  };

  /* ================= 客户 ================= */
  // Top 客户：DB.orders 按 client 聚合
  function buildCust(){
    const map={};
    (DB.orders||[]).forEach(o=>{ if(!map[o.client]) map[o.client]={client:o.client,amt:0,cnt:0}; map[o.client].amt+=o.amt||0; map[o.client].cnt++; });
    const f=RANK_FACTOR[DB.anaPeriod]*4.07;
    let rows=Object.values(map).map(r=>{const amt=+(r.amt*f).toFixed(2),cnt=Math.max(1,Math.round(r.cnt*RANK_FACTOR[DB.anaPeriod]*9));return {client:r.client, amt, cnt, avg:amt/cnt};});
    rows.sort((a,b)=>b.amt-a.amt);
    return rows;
  }
  function customer(){
    const s=STAT[DB.anaPeriod];
    const kpi=`<div class="sg" style="grid-template-columns:repeat(3,1fr)">
      <div class="sc"><div class="sc-l">下单客户数</div><div class="sc-v">${s.cust.toLocaleString()}</div><div class="sc-s">${cmpTag(s.cmp.cust)}</div></div>
      <div class="sc good"><div class="sc-l">新增客户</div><div class="sc-v">${s.newCust}</div><div class="sc-s">${PLABEL[DB.anaPeriod]}新客</div></div>
      <div class="sc"><div class="sc-l">复购率</div><div class="sc-v">${pct(s.repurchase)}</div><div class="sc-s">${cmpTag(s.cmp.repurchase)}</div></div>
    </div>`;
    const rows=buildCust();
    const top=`<div class="card"><div class="card-hd"><h3>👥 Top 客户</h3><span class="sub">${PLABEL[DB.anaPeriod]} · 按消费额 · 点行看消费明细</span></div>
      <div class="card-bd flush"><div style="overflow-x:auto"><table>
        <thead><tr><th style="width:56px">排名</th><th>客户</th><th style="text-align:right">消费额</th><th style="text-align:right">订单数</th><th style="text-align:right">单均</th></tr></thead><tbody>
        ${rows.length?rows.map((r,i)=>`<tr style="cursor:pointer" onclick="anaCustDetail(${i})">
          <td><span style="display:inline-block;width:24px;height:24px;line-height:24px;text-align:center;border-radius:6px;font-weight:700;font-size:12px;${i<3?'background:var(--g);color:#fff':'background:var(--bd2);color:var(--ts)'}">${i+1}</span></td>
          <td><b>${r.client}</b></td><td style="text-align:right;font-weight:600">${money(r.amt)}</td><td style="text-align:right">${r.cnt}</td><td style="text-align:right">${money(r.avg)} <span style="color:var(--ts)">›</span></td>
        </tr>`).join(''):`<tr><td colspan="5"><div class="empty"><div class="e-ic">👤</div><div class="e-t">暂无客户成交</div><div class="e-s">该时间段内无下单客户</div></div></td></tr>`}
      </tbody></table></div></div></div>`;
    return periodBar()+tabBar()+kpi+top;
  }

  /* ---- 客户：Top 客户行 → 该客户消费明细 modal ---- */
  window.anaCustDetail=function(idx){
    const rows=buildCust(); const r=rows[idx]; if(!r) return;
    // 真实订单样例（该客户）
    const orders=(DB.orders||[]).filter(o=>o.client===r.client).slice(0,6);
    const orderRows=orders.length?orders.map(o=>`<tr><td class="mono">${o.id}</td><td style="color:var(--ts)">${o.orderTime||'—'}</td><td>${(o.lines||[]).length} 个商品</td><td style="text-align:right;font-weight:600">${money(o.amt||0)}</td><td>${o.status||'—'}</td></tr>`).join('')
      :`<tr><td colspan="5" style="text-align:center;color:var(--ts);padding:18px">暂无订单样例</td></tr>`;
    // 消费品类构成（按该客户订单行聚合，无则按整体榜单近似）
    const catMap={};
    orders.forEach(o=>(o.lines||[]).forEach(l=>{const c=l.cat||'其他';catMap[c]=(catMap[c]||0)+(l.qty||0)*(l.price||0);}));
    let cats=Object.entries(catMap).map(([c,v])=>({c,v})).sort((a,b)=>b.v-a.v);
    if(!cats.length) cats=[{c:'新鲜蔬菜',v:r.amt*0.52},{c:'肉禽蛋品',v:r.amt*0.28},{c:'海鲜水产',v:r.amt*0.20}];
    const catTotal=cats.reduce((a,x)=>a+x.v,0)||1;
    const catRows=cats.map(x=>`<tr><td>${x.c}</td><td style="text-align:right">${money(x.v)}</td><td style="text-align:right">${pct(x.v/catTotal)}</td></tr>`).join('');
    modalWide(`<div class="mc-hd"><h3>客户消费明细 · ${r.client}</h3><p>${PLABEL[DB.anaPeriod]} · 由订单派生</p><button class="mc-x" onclick="closeModal()">×</button></div>
    <div class="mc-bd">
      <div class="sg" style="grid-template-columns:repeat(3,1fr)">
        <div class="sc good"><div class="sc-l">消费额</div><div class="sc-v">${money(r.amt)}</div><div class="sc-s">${PLABEL[DB.anaPeriod]}</div></div>
        <div class="sc"><div class="sc-l">订单数</div><div class="sc-v">${r.cnt}</div><div class="sc-s">单</div></div>
        <div class="sc"><div class="sc-l">单均消费</div><div class="sc-v">${money(r.avg)}</div><div class="sc-s">每单</div></div>
      </div>
      <div class="card" style="box-shadow:none;margin:14px 0 0"><div class="card-hd"><h3 style="font-size:14px">🧾 消费品类构成</h3></div>
        <div class="card-bd flush"><div style="overflow-x:auto"><table class="subtbl"><thead><tr><th>品类</th><th style="text-align:right">消费额</th><th style="text-align:right">占比</th></tr></thead><tbody>${catRows}</tbody></table></div></div></div>
      <div class="card" style="box-shadow:none;margin:12px 0 0"><div class="card-hd"><h3 style="font-size:14px">📦 近期订单样例</h3><span class="sub">展示最近 ${orders.length} 单</span></div>
        <div class="card-bd flush"><div style="overflow-x:auto"><table class="subtbl"><thead><tr><th>订单号</th><th>下单时间</th><th>商品数</th><th style="text-align:right">金额</th><th>状态</th></tr></thead><tbody>${orderRows}</tbody></table></div></div></div>
      <div class="ib ib-gr" style="margin-top:12px"><span class="i">ℹ️</span>消费额按当前时间段口径缩放展示；订单样例为真实订单数据，金额以原始下单金额为准。</div>
    </div>
    <div class="mc-ft"><button class="btn btn-p" onclick="closeModal()">知道了</button></div>`);
  };

  /* ---------- 入口 ---------- */
  PAGES['m-analysis']=()=>{
    const t=DB.anaTab;
    return t=='revenue'?revenue() : t=='product'?product() : t=='customer'?customer() : overview();
  };
})();
