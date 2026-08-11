/* ============================================================
   商家端 · 库存管理（PC）— 寄售在仓库存动态
   框架：PRD/scm_商家库存管理_功能框架.md v0.2

   口径（全部对齐 item_inventory 真实列）：
     在库   = wms_inventory        已占用 = locked_inventory
     可售   = left_inventory = max(在库 − 已占用 − 安全库存, 0)
              安全库存已于 2026-07-17 全量停写清零 → 实际 = max(在库 − 已占用, 0)
     在途   = 不在 item_inventory，取 WMS 待出库/在途统计
   数量单位 = 货品的「库存单位」；SKU 可售件数 = floor(可售 ÷ 规格数量)
   同一货品下各 SKU 共享同一库存池（convertRatio），任一规格出货会拉低其他规格可售件数。

   本期只读：寄售库存唯一变更来源是 WMS 单据，商家端无任何写入口
   （线上 merchant-app 已如此：SkuEditor.tsx:41-44 只读、ProductTable.tsx:215-217 无改库存入口）。
   本期不做：批次/效期/临期预警、低库存档（无安全库存值）、差异申诉、供货单开单。

   依赖主文件全局：DB / money / toast / drawer / closeDrawer / nav / render
============================================================ */
(function(){
  const WH=['裕廊DC','兀兰DC','盛港DC'];

  /* 流水类型 → 对商家的话术（不暴露内部枚举 CONSIGNMENT_IN / SALE_OUT …） */
  const FLOW={
    in    :{t:'送货入仓',     s:'+',c:'t-g' },
    ret   :{t:'客户退货入仓', s:'+',c:'t-g' },
    gain  :{t:'盘点盈',       s:'+',c:'t-g' },
    out   :{t:'销售出库',     s:'-',c:'t-gr'},
    loss  :{t:'盘点亏',       s:'-',c:'t-r' },
    damage:{t:'报损',         s:'-',c:'t-r' },
    adj   :{t:'库存调整',     s:'±',c:'t-y' },
  };
  /* 需要给「找运营对质」出口的类型：商家看到负数但不是自己卖掉的 */
  const DISPUTE=['loss','damage','adj'];

  const IN_ST={'待入库':'t-y','入库中':'t-b','入库完成':'t-g','已取消':'t-gr'};

  /* ---------- 演示数据 ---------- */
  function invSeed(){
    if(DB.invItems)return;
    DB.invItems=[
      {item:'ITM-JS-8801',name:'冰鲜三文鱼',cat:'海鲜水产',unit:'kg',
       skus:[{skuId:'SKU-JS-1101',spec:'1kg/袋',ratio:1},{skuId:'SKU-JS-1102',spec:'3kg/箱',ratio:3}],
       stocks:[{wh:'裕廊DC',wms:186,locked:24,transit:60},{wh:'兀兰DC',wms:52,locked:8,transit:0}]},
      {item:'ITM-JS-8802',name:'鸡胸肉',cat:'肉禽蛋品',unit:'kg',
       skus:[{skuId:'SKU-JS-1201',spec:'2kg/袋',ratio:2}],
       stocks:[{wh:'裕廊DC',wms:74,locked:12,transit:0},{wh:'盛港DC',wms:31,locked:3,transit:40}]},
      {item:'ITM-JS-8803',name:'冷冻虾仁',cat:'海鲜水产',unit:'kg',
       skus:[{skuId:'SKU-JS-1301',spec:'500g/盒',ratio:0.5},{skuId:'SKU-JS-1302',spec:'5kg/箱',ratio:5}],
       stocks:[{wh:'裕廊DC',wms:0,locked:0,transit:120}]},
      {item:'ITM-JS-8804',name:'小棠菜',cat:'新鲜蔬菜',unit:'kg',
       skus:[{skuId:'SKU-JS-1401',spec:'1kg/袋',ratio:1},{skuId:'SKU-JS-1402',spec:'5kg/箱',ratio:5}],
       stocks:[{wh:'兀兰DC',wms:240,locked:35,transit:0},{wh:'盛港DC',wms:96,locked:0,transit:0}]},
      {item:'ITM-JS-8805',name:'泰国龙眼',cat:'新鲜蔬菜',unit:'箱',
       skus:[{skuId:'SKU-JS-1501',spec:'1箱',ratio:1}],
       stocks:[{wh:'裕廊DC',wms:18,locked:18,transit:0}]},
    ];
    /* 库存流水（台账）：时间倒序；after = 该货品该仓变动后结存 */
    DB.invFlow=[
      {id:1,item:'ITM-JS-8801',wh:'裕廊DC',time:'2026-08-11 09:12',type:'out',   qty:12,after:186,doc:'CK-JS-20260811-0043'},
      {id:2,item:'ITM-JS-8801',wh:'裕廊DC',time:'2026-08-10 16:40',type:'loss',  qty:4, after:198,doc:'PD-20260810-0007'},
      {id:3,item:'ITM-JS-8801',wh:'裕廊DC',time:'2026-08-10 11:05',type:'out',   qty:26,after:202,doc:'CK-JS-20260810-0031'},
      {id:4,item:'ITM-JS-8801',wh:'裕廊DC',time:'2026-08-09 08:30',type:'in',    qty:150,after:228,doc:'R2026080900112'},
      {id:5,item:'ITM-JS-8801',wh:'兀兰DC',time:'2026-08-10 14:22',type:'out',   qty:9, after:52, doc:'CK-JS-20260810-0028'},
      {id:6,item:'ITM-JS-8802',wh:'裕廊DC',time:'2026-08-11 10:02',type:'ret',   qty:6, after:74, doc:'TH-20260811-0005'},
      {id:7,item:'ITM-JS-8802',wh:'裕廊DC',time:'2026-08-10 09:18',type:'out',   qty:18,after:68, doc:'CK-JS-20260810-0022'},
      {id:8,item:'ITM-JS-8802',wh:'盛港DC',time:'2026-08-08 15:47',type:'damage',qty:5, after:31, doc:'BS-20260808-0002'},
      {id:9,item:'ITM-JS-8803',wh:'裕廊DC',time:'2026-08-09 17:30',type:'out',   qty:34,after:0,  doc:'CK-JS-20260809-0019'},
      {id:10,item:'ITM-JS-8804',wh:'兀兰DC',time:'2026-08-11 07:55',type:'in',   qty:200,after:240,doc:'R2026081100031'},
      {id:11,item:'ITM-JS-8804',wh:'兀兰DC',time:'2026-08-09 12:10',type:'gain', qty:3, after:40, doc:'PD-20260809-0004'},
      {id:12,item:'ITM-JS-8804',wh:'盛港DC',time:'2026-08-10 10:33',type:'out',  qty:22,after:96, doc:'CK-JS-20260810-0026'},
      {id:13,item:'ITM-JS-8805',wh:'裕廊DC',time:'2026-08-11 08:41',type:'out',  qty:6, after:18, doc:'CK-JS-20260811-0040'},
      {id:14,item:'ITM-JS-8805',wh:'裕廊DC',time:'2026-08-07 09:00',type:'adj',  qty:-2,after:24, doc:'TZ-20260807-0001'},
    ];
    /* 在途入库：只读承接 WMS 寄售入库单（商家端本期无开单入口） */
    DB.invInbound=[
      {no:'R2026081200055',supply:'GH-JS-20260811-0021',wh:'裕廊DC',status:'待入库',create:'2026-08-11 18:20',
       lines:[{item:'ITM-JS-8801',name:'冰鲜三文鱼',unit:'kg',plan:60,recv:null},
              {item:'ITM-JS-8803',name:'冷冻虾仁',unit:'kg',plan:120,recv:null}]},
      {no:'R2026081100031',supply:'GH-JS-20260810-0018',wh:'盛港DC',status:'入库中',create:'2026-08-11 07:10',
       lines:[{item:'ITM-JS-8802',name:'鸡胸肉',unit:'kg',plan:40,recv:40}]},
      {no:'R2026081100030',supply:'GH-JS-20260810-0017',wh:'兀兰DC',status:'入库完成',create:'2026-08-11 06:40',
       lines:[{item:'ITM-JS-8804',name:'小棠菜',unit:'kg',plan:220,recv:200}]},
      {no:'R2026080900112',supply:'GH-JS-20260808-0009',wh:'裕廊DC',status:'入库完成',create:'2026-08-09 08:05',
       lines:[{item:'ITM-JS-8801',name:'冰鲜三文鱼',unit:'kg',plan:150,recv:150}]},
      {no:'R2026080700088',supply:'GH-JS-20260806-0005',wh:'裕廊DC',status:'已取消',create:'2026-08-07 13:25',
       lines:[{item:'ITM-JS-8805',name:'泰国龙眼',unit:'箱',plan:30,recv:null}]},
    ];
  }

  /* ---------- 计算 ---------- */
  const left=r=>Math.max((+r.wms||0)-(+r.locked||0),0);            // BR-03
  function itemOf(code){return DB.invItems.find(i=>i.item==code)||{};}
  /* 展开成「货品 × 仓」行，仓筛选后聚合 */
  function rows(){
    const wh=DB.invWh||'';
    const kw=(DB.invKw||'').trim().toLowerCase();
    const out=[];
    DB.invItems.forEach(it=>{
      it.stocks.filter(s=>!wh||s.wh==wh).forEach(s=>{
        if(kw&&!(it.name.toLowerCase().includes(kw)||it.item.toLowerCase().includes(kw)))return;
        out.push({it,s,left:left(s)});
      });
    });
    return out;
  }
  const flowsOf=(code,wh,type)=>DB.invFlow
    .filter(f=>f.item==code&&(!wh||f.wh==wh)&&(!type||f.type==type))
    .sort((a,b)=>a.time<b.time?1:-1);

  /* ---------- 抽屉 A：库存明细 ---------- */
  window.inv_detail=function(code){
    const it=itemOf(code);
    const tot=it.stocks.reduce((a,s)=>({wms:a.wms+s.wms,locked:a.locked+s.locked,transit:a.transit+s.transit}),{wms:0,locked:0,transit:0});
    const totLeft=it.stocks.reduce((a,s)=>a+left(s),0);
    const u=it.unit;

    const num=(l,v,c)=>`<div style="border:1px solid var(--bd);border-radius:10px;padding:12px 14px;background:#fff">
      <div style="font-size:12px;color:var(--ts);margin-bottom:4px">${l}</div>
      <div style="font-size:20px;font-weight:700;color:${c||'var(--tp)'}">${v}<span style="font-size:12px;font-weight:400;color:var(--ts);margin-left:3px">${u}</span></div></div>`;

    const whRows=it.stocks.map(s=>`<tr><td>${s.wh}</td><td style="text-align:right">${s.wms}</td>
      <td style="text-align:right;color:var(--ts)">${s.locked}</td>
      <td style="text-align:right"><b>${left(s)}</b></td>
      <td style="text-align:right;${s.transit?'color:var(--b)':'color:var(--tt)'}">${s.transit||'—'}</td></tr>`).join('');

    const skuRows=it.skus.map(k=>`<tr><td>${k.spec}</td><td class="mono">${k.skuId}</td>
      <td style="text-align:right;color:var(--ts)">${k.ratio} ${u}</td>
      <td style="text-align:right"><b>${Math.floor(totLeft/k.ratio)}</b> 件</td></tr>`).join('');

    const recent=flowsOf(code,'','').slice(0,5).map(f=>{const m=FLOW[f.type];
      return `<tr><td style="white-space:nowrap;color:var(--ts)">${f.time}</td><td>${f.wh}</td>
        <td><span class="tag ${m.c}"><span class="dot"></span>${m.t}</span></td>
        <td style="text-align:right;${m.s=='-'?'color:var(--r)':m.s=='+'?'color:var(--g)':''}">${m.s=='±'?(f.qty>0?'+':'')+f.qty:m.s+f.qty}</td>
        <td style="text-align:right;color:var(--ts)">${f.after}</td></tr>`;}).join('');

    drawer(`<div class="drawer-hd"><div><h3>${it.name} <span class="mono" style="font-size:12.5px;color:var(--ts)">${it.item}</span></h3>
      <div style="margin-top:4px;font-size:12.5px;color:var(--ts)">${it.cat} · 库存单位 ${u} · <span class="tag t-pp" style="font-size:10.5px">寄售</span></div></div>
      <span class="x" onclick="closeDrawer()">×</span></div>
    <div class="drawer-bd">
      <h4 style="font-size:14px;margin:2px 0 10px;color:var(--g)">① 数量构成（全部仓合计）</h4>
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px">
        ${num('在库',tot.wms)}${num('已占用',tot.locked)}${num('可售',totLeft,'var(--g)')}${num('在途',tot.transit,'var(--b)')}
      </div>
      <div class="ib ib-gr" style="margin-top:10px"><span class="i">📐</span><b>可售 = 在库 − 已占用</b>。「已占用」是买家已下单、仓库尚未出库的量，出库后从在库扣掉；「在途」是你已送到仓、仓库还没入库完成的量，入库完成后才计入在库。</div>

      <h4 style="font-size:14px;margin:16px 0 8px;color:var(--g)">② 分仓明细</h4>
      <div style="overflow-x:auto"><table class="subtbl"><thead><tr><th>仓库</th><th style="text-align:right">在库</th><th style="text-align:right">已占用</th><th style="text-align:right">可售</th><th style="text-align:right">在途</th></tr></thead><tbody>${whRows}</tbody></table></div>
      <div class="ib ib-y" style="margin-top:8px"><span class="i">⚠️</span>各仓库存<b>独立记账、不跨仓调拨</b>，买家下单按收货仓匹配——某仓可售为 0 时，其他仓有货也无法销往该仓覆盖区域。</div>

      <h4 style="font-size:14px;margin:16px 0 8px;color:var(--g)">③ 各规格可售件数（换算）</h4>
      <div style="overflow-x:auto"><table class="subtbl"><thead><tr><th>规格</th><th>SKU 编码</th><th style="text-align:right">1 件 =</th><th style="text-align:right">当前可售</th></tr></thead><tbody>${skuRows}</tbody></table></div>
      <div class="ib ib-b" style="margin-top:8px"><span class="i">💡</span>本商品下<b>所有规格共用同一批货</b>（共 ${totLeft} ${u} 可售），不是各自独立的库存。卖掉任意一个规格，其他规格的可售件数都会同步下降——这不是数据错误。</div>

      <h4 style="font-size:14px;margin:16px 0 8px;color:var(--g)">④ 最近库存变动</h4>
      <div style="overflow-x:auto"><table class="subtbl"><thead><tr><th>时间</th><th>仓库</th><th>类型</th><th style="text-align:right">变动</th><th style="text-align:right">变动后</th></tr></thead><tbody>${recent||'<tr><td colspan="5" style="color:var(--tt)">暂无变动记录</td></tr>'}</tbody></table></div>
    </div>
    <div class="drawer-ft"><button class="btn btn-o" onclick="closeDrawer()">关闭</button><button class="btn btn-p" onclick="closeDrawer();inv_flow('${code}')">查看全部流水 →</button></div>`);
  };

  /* ---------- 抽屉 B：库存流水 ---------- */
  window.inv_flow=function(code){DB.invFlowItem=code;DB.invFlowType=DB.invFlowType||'';inv_flowRender();};
  window.inv_flowType=function(v){DB.invFlowType=DB.invFlowType==v?'':v;inv_flowRender();};
  window.inv_flowRender=function(){
    const code=DB.invFlowItem,it=itemOf(code),type=DB.invFlowType||'';
    const list=flowsOf(code,'',type);
    const chip=(v,t)=>`<button class="btn ${type==v?'btn-p':'btn-o'} btn-sm" onclick="inv_flowType('${v}')">${t}</button>`;
    const body=list.map(f=>{const m=FLOW[f.type],dis=DISPUTE.includes(f.type);
      return `<tr><td style="white-space:nowrap;color:var(--ts)">${f.time}</td><td>${f.wh}</td>
        <td><span class="tag ${m.c}"><span class="dot"></span>${m.t}</span></td>
        <td style="text-align:right;font-weight:600;${m.s=='-'?'color:var(--r)':m.s=='+'?'color:var(--g)':''}">${m.s=='±'?(f.qty>0?'+':'')+f.qty:m.s+f.qty}</td>
        <td style="text-align:right;color:var(--ts)">${f.after}</td>
        <td class="mono" style="font-size:12px">${f.doc}${dis?` <button class="btn btn-link" style="font-size:12px" onclick="inv_dispute('${f.doc}')">有疑问</button>`:''}</td></tr>`;}).join('');

    drawer(`<div class="drawer-hd"><div><h3>库存流水 · ${it.name}</h3>
      <div style="margin-top:4px;font-size:12.5px;color:var(--ts)"><span class="mono">${it.item}</span> · 单位 ${it.unit} · 近 6 个月</div></div>
      <span class="x" onclick="closeDrawer()">×</span></div>
    <div class="drawer-bd">
      <div class="row" style="gap:6px;flex-wrap:wrap;margin-bottom:12px">
        ${chip('in','送货入仓')}${chip('out','销售出库')}${chip('ret','客户退货入仓')}${chip('loss','盘点亏')}${chip('damage','报损')}${chip('gain','盘点盈')}${chip('adj','库存调整')}
      </div>
      <div style="overflow-x:auto"><table class="subtbl"><thead><tr><th>时间</th><th>仓库</th><th>类型</th><th style="text-align:right">变动</th><th style="text-align:right">变动后结存</th><th>关联单号</th></tr></thead><tbody>${body||`<tr><td colspan="6"><div class="empty"><div class="e-ic">📄</div><div class="e-t">当前筛选下暂无流水</div><div class="e-s">清除类型筛选查看全部变动</div></div></td></tr>`}</tbody></table></div>
      <div class="ib ib-gr" style="margin-top:10px"><span class="i">ℹ️</span>「移库」（货在仓内换库位）不改变总量，不在此列出。每笔变动都带仓库作业单号，可凭单号向运营核对。</div>
    </div>
    <div class="drawer-ft"><button class="btn btn-o" onclick="closeDrawer()">关闭</button><button class="btn btn-o" onclick="toast('已导出该商品流水','ok')">⬇️ 导出流水</button><button class="btn btn-p" onclick="closeDrawer();inv_detail('${code}')">← 回库存明细</button></div>`);
  };
  /* 本期不做申诉，但不能只丢一个负数——给明确出口 */
  window.inv_dispute=function(doc){
    modal(`<div class="mc-hd"><h3>对这笔变动有疑问</h3><p class="mono">${doc}</p><button class="mc-x" onclick="closeModal()">×</button></div>
    <div class="mc-bd">
      <div class="ib ib-y"><span class="i">⚠️</span>盘点亏损、报损由仓库作业产生，商家端为只读展示。</div>
      <p style="font-size:13px;color:var(--ts);line-height:1.7;margin-top:10px">如需核对，请把<b>作业单号 ${doc}</b>提供给你的对接运营，由运营在 WMS 侧调取作业记录与责任判定。</p>
      <p style="font-size:13px;color:var(--ts);line-height:1.7">线上差异申诉功能规划中，当前版本尚未开放。</p>
    </div>
    <div class="mc-ft"><button class="btn btn-o" onclick="closeModal()">知道了</button><button class="btn btn-p" onclick="closeModal();toast('单号已复制：${doc}','ok')">复制单号</button></div>`);
  };

  /* ---------- 抽屉 C：在途入库单详情 ---------- */
  window.inv_inDetail=function(no){
    const d=DB.invInbound.find(x=>x.no==no);
    const done=d.status=='入库完成';
    const body=d.lines.map(l=>{const short=done&&l.recv!=null&&l.recv<l.plan?l.plan-l.recv:0;
      return `<tr><td><b>${l.name}</b><div class="mono" style="font-size:11.5px;color:var(--ts)">${l.item}</div></td>
        <td style="text-align:right">${l.plan} ${l.unit}</td>
        <td style="text-align:right">${l.recv==null?'<span style="color:var(--tt)">待收</span>':l.recv+' '+l.unit}</td>
        <td style="text-align:right">${short?`<span style="color:var(--r);font-weight:600">短收 ${short} ${l.unit}</span>`:'<span style="color:var(--tt)">—</span>'}</td></tr>`;}).join('');
    const hasShort=done&&d.lines.some(l=>l.recv!=null&&l.recv<l.plan);

    drawer(`<div class="drawer-hd"><div><h3>${d.no}</h3>
      <div style="margin-top:4px"><span class="tag ${IN_ST[d.status]}"><span class="dot"></span>${d.status}</span>
      <span class="sub" style="font-size:12px;margin-left:6px">${d.wh} · 供货单 ${d.supply}</span></div></div>
      <span class="x" onclick="closeDrawer()">×</span></div>
    <div class="drawer-bd">
      <h4 style="font-size:14px;margin:2px 0 10px;color:var(--g)">① 单据信息</h4>
      <dl class="dl">
        <dt>入库单号</dt><dd class="mono">${d.no}</dd>
        <dt>寄售供货单号</dt><dd class="mono">${d.supply}</dd>
        <dt>入库仓库</dt><dd>${d.wh}</dd>
        <dt>创建时间</dt><dd>${d.create}</dd>
        <dt>当前状态</dt><dd><span class="tag ${IN_ST[d.status]}"><span class="dot"></span>${d.status}</span></dd>
      </dl>
      <h4 style="font-size:14px;margin:16px 0 8px;color:var(--g)">② 商品明细</h4>
      <div style="overflow-x:auto"><table class="subtbl"><thead><tr><th>商品</th><th style="text-align:right">应收</th><th style="text-align:right">实收</th><th style="text-align:right">差异</th></tr></thead><tbody>${body}</tbody></table></div>
      ${hasShort?`<div class="ib ib-r" style="margin-top:8px"><span class="i">⛔</span><b>存在短收</b>：仓库按实收数量入账，差额<b>不会自动补建</b>。如对实收数量有疑问，请凭入库单号 ${d.no} 联系运营核对。</div>`
        :done?`<div class="ib ib-g" style="margin-top:8px"><span class="i">✅</span>已全部入库并计入可售库存。</div>`
        :`<div class="ib ib-b" style="margin-top:8px"><span class="i">ℹ️</span>入库完成且库存同步成功后，这批货才会计入可售库存。</div>`}
    </div>
    <div class="drawer-ft"><button class="btn btn-p" onclick="closeDrawer()">关闭</button></div>`);
  };

  /* ---------- Tab / 筛选 ---------- */
  window.inv_tab=function(v){DB.invTab=v;render();};
  window.inv_wh=function(v){DB.invWh=v;render();};
  window.inv_kw=function(v){DB.invKw=v;};
  window.inv_search=function(){DB.invKw=(document.getElementById('inv-kw')||{}).value||'';render();};
  window.inv_reset=function(){DB.invKw='';DB.invWh='';DB.invQuick='';render();};
  window.inv_quick=function(v){DB.invQuick=DB.invQuick==v?'':v;render();};

  /* ---------- 页面 ---------- */
  PAGES['m-stock']=()=>{
    invSeed();
    DB.invTab=DB.invTab||'stock';DB.invWh=DB.invWh||'';DB.invKw=DB.invKw||'';DB.invQuick=DB.invQuick||'';
    const tab=DB.invTab;

    const tabs=`<div class="tabs" style="margin:0;border:none">
      ${[['stock','库存'],['transit','在途入库']].map(x=>`<div class="tab ${tab==x[0]?'active':''}" onclick="inv_tab('${x[0]}')">${x[1]}${x[0]=='transit'?`<span style="color:var(--ts);font-weight:400;margin-left:4px">${DB.invInbound.filter(d=>d.status=='待入库'||d.status=='入库中').length}</span>`:''}</div>`).join('')}
    </div>`;

    /* ===== Tab 1：库存 ===== */
    if(tab=='stock'){
      let list=rows();
      const q=DB.invQuick;
      if(q=='out')list=list.filter(r=>r.left<=0);
      if(q=='transit')list=list.filter(r=>r.s.transit>0);
      const cOut=rows().filter(r=>r.left<=0).length,cTr=rows().filter(r=>r.s.transit>0).length;
      const qb=(v,t,n)=>`<button class="btn ${q==v?'btn-p':'btn-o'} btn-sm" onclick="inv_quick('${v}')">${t}${n?` (${n})`:''}</button>`;

      const body=list.map(r=>{const it=r.it,s=r.s,u=it.unit;
        const sold=it.skus.map(k=>`${k.spec} <b>${Math.floor(r.left/k.ratio)}</b> 件`).join(' ／ ');
        return `<tr>
          <td><b>${it.name}</b><div class="mono" style="font-size:11.5px;color:var(--ts)">${it.item}</div></td>
          <td style="color:var(--ts)">${it.cat}</td>
          <td>${s.wh}</td>
          <td style="text-align:right">${s.wms} <span style="font-size:11.5px;color:var(--tt)">${u}</span></td>
          <td style="text-align:right;color:var(--ts)">${s.locked||'—'}</td>
          <td style="text-align:right"><b style="${r.left<=0?'color:var(--r)':''}">${r.left}</b> <span style="font-size:11.5px;color:var(--tt)">${u}</span></td>
          <td style="text-align:right">${s.transit?`<span style="color:var(--b)">${s.transit} ${u}</span>`:'<span style="color:var(--tt)">—</span>'}</td>
          <td style="font-size:12px;color:var(--ts)">${sold}</td>
          <td>${r.left<=0?'<span class="tag t-r"><span class="dot"></span>缺货</span>':'<span class="tag t-g"><span class="dot"></span>正常</span>'}</td>
          <td><button class="btn btn-link" onclick="inv_detail('${it.item}')">库存明细</button> <button class="btn btn-link" onclick="inv_flow('${it.item}')">流水</button></td>
        </tr>`;}).join('');

      return `
      <div class="card"><div class="card-bd">
        <div class="fg3">
          <div class="fr"><label class="fl">商品名称 / 货品编码</label><input id="inv-kw" value="${DB.invKw}" placeholder="输入商品名或货品编码" onkeydown="if(event.key=='Enter')inv_search()"></div>
          <div class="fr"><label class="fl">仓库</label><select onchange="inv_wh(this.value)"><option value="">全部仓库</option>${WH.map(w=>`<option ${DB.invWh==w?'selected':''}>${w}</option>`).join('')}</select></div>
          <div class="fr"><label class="fl">&nbsp;</label><div class="row" style="gap:8px"><button class="btn btn-p" onclick="inv_search()">查询</button><button class="btn btn-o" onclick="inv_reset()">重置</button></div></div>
        </div>
      </div></div>

      <div class="card"><div class="card-hd">${tabs}
        <div class="row" style="gap:8px"><button class="btn btn-o btn-sm" onclick="toast('已导出当前筛选结果','ok')">⬇️ 导出库存</button></div>
      </div>
      <div class="card-bd">
        <div class="row" style="gap:8px;margin-bottom:12px">${qb('out','缺货',cOut)}${qb('transit','有在途',cTr)}</div>
        <div class="ib ib-gr" style="margin-bottom:12px"><span class="i">📦</span>这里是你<b>寄存在平台仓的货</b>（寄售商品）。库存由仓库实物决定、<b>不可手工修改</b>；自售商品的可售库存请在「商品管理」维护。</div>
        <div style="overflow-x:auto"><table>
          <thead><tr><th>商品</th><th>品类</th><th>仓库</th><th style="text-align:right">在库</th><th style="text-align:right">已占用</th><th style="text-align:right">可售</th><th style="text-align:right">在途</th><th>各规格可售</th><th>状态</th><th>操作</th></tr></thead>
          <tbody>${body||`<tr><td colspan="10"><div class="empty"><div class="e-ic">📦</div><div class="e-t">${DB.invKw||DB.invWh||q?'当前筛选下没有库存':'暂无在仓库存'}</div><div class="e-s">${DB.invKw||DB.invWh||q?'调整筛选条件或点「重置」查看全部':'寄售商品送货入仓后，库存会在这里显示'}</div></div></td></tr>`}</tbody>
        </table></div>
      </div></div>`;
    }

    /* ===== Tab 2：在途入库 ===== */
    const body=DB.invInbound.map(d=>{
      const plan=d.lines.reduce((a,l)=>a+l.plan,0);
      const recv=d.lines.reduce((a,l)=>a+(l.recv||0),0);
      const short=d.status=='入库完成'&&recv<plan;
      return `<tr>
        <td class="mono">${d.no}</td>
        <td class="mono" style="font-size:12px;color:var(--ts)">${d.supply}</td>
        <td>${d.wh}</td>
        <td>${d.lines.map(l=>l.name).join('、')}<div style="font-size:11.5px;color:var(--ts)">共 ${d.lines.length} 个商品</div></td>
        <td style="text-align:right">${plan}</td>
        <td style="text-align:right">${d.status=='待入库'||d.status=='已取消'?'<span style="color:var(--tt)">—</span>':recv}</td>
        <td>${short?`<span style="color:var(--r);font-weight:600">短收 ${plan-recv}</span>`:'<span style="color:var(--tt)">—</span>'}</td>
        <td><span class="tag ${IN_ST[d.status]}"><span class="dot"></span>${d.status}</span></td>
        <td style="color:var(--ts);font-size:12px">${d.create}</td>
        <td><button class="btn btn-link" onclick="inv_inDetail('${d.no}')">详情</button></td>
      </tr>`;}).join('');

    return `
    <div class="card"><div class="card-hd">${tabs}</div>
    <div class="card-bd">
      <div class="ib ib-b" style="margin-bottom:12px"><span class="i">ℹ️</span>这里跟踪你<b>已送到仓、还没入库完成</b>的货。入库单由仓库按你的寄售供货单生成，商家端只读；<b>入库完成且同步成功后才计入可售库存</b>。</div>
      <div style="overflow-x:auto"><table>
        <thead><tr><th>入库单号</th><th>供货单号</th><th>仓库</th><th>商品</th><th style="text-align:right">应收</th><th style="text-align:right">实收</th><th>差异</th><th>状态</th><th>创建时间</th><th>操作</th></tr></thead>
        <tbody>${body||`<tr><td colspan="10"><div class="empty"><div class="e-ic">🚚</div><div class="e-t">暂无在途入库</div><div class="e-s">送货到仓后，入库进度会在这里显示</div></div></td></tr>`}</tbody>
      </table></div>
    </div></div>`;
  };
})();
