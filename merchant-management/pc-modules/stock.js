/* ============================================================
   商家端 · 库存管理（PC）— 库存列表 + 在途库存
   框架：PRD/scm_商家库存管理_功能框架.md

   ★ 通用列表：自售 + 寄售共用一张表，按「供货模式」分流
     supplyMode=1 自售  → 库存商家自维护，**可改**（沿用线上 /product/sku/restock）
     supplyMode=2 寄售  → 库存=WMS 实物，**只读**（线上 merchant-app 本就只读）

   | 维度       | 自售 SELF(1)                    | 寄售 CONSIGNMENT(2)              |
   |-----------|--------------------------------|---------------------------------|
   | 库存承载   | virtual_inventory 设置库存       | wms_inventory 在仓实物            |
   | inventory_way | 1 BY_CONFIG                 | 0 BY_WMS                        |
   | stockMode | 1 每日恢复 / 2 售完即止           | 3 货品库存（只读）                 |
   | 可售       | max(设置库存 − 已占用, 0)         | max(在仓实物 − 已占用, 0)          |
   | 库存粒度   | **SKU 级，各规格独立**            | **货品级，各规格共享同一池**        |
   | 分仓       | 不分仓（restock 无 warehouseCode）| 按 siteCode 分仓独立记账           |
   | 在途       | 无（不入仓）                     | 有（寄售入库单）                   |
   | 可改       | ✅ 改库存 + 改库存模式            | ❌ 全字段只读                     |

   本期不做：批次/效期临期预警、低库存档（safety_inventory 已停写清零）、差异申诉、供货单开单。
   依赖主文件全局：DB / money / toast / modal / closeModal / drawer / closeDrawer / render
============================================================ */
(function(){
  const WH=['裕廊DC','兀兰DC','盛港DC'];
  const SELF_WH='全仓通用';                       // 自售不分仓（待确认 #12）

  /* 流水类型 → 对商家的话术（不暴露内部枚举 CONSIGNMENT_IN / SALE_OUT …） */
  const FLOW={
    in    :{t:'送货入仓',     s:'+',c:'t-g' },
    ret   :{t:'客户退货',     s:'+',c:'t-g' },
    gain  :{t:'盘点盈',       s:'+',c:'t-g' },
    edit  :{t:'商家改库存',   s:'±',c:'t-b' },
    out   :{t:'销售出库',     s:'-',c:'t-gr'},
    loss  :{t:'盘点亏',       s:'-',c:'t-r' },
    damage:{t:'报损',         s:'-',c:'t-r' },
    adj   :{t:'库存调整',     s:'±',c:'t-y' },
  };
  /* 需要给「找运营对质」出口的类型：商家看到负数但不是自己卖掉、也不是自己改的 */
  const DISPUTE=['loss','damage','adj'];
  const IN_ST={'待入库':'t-y','入库中':'t-b','入库完成':'t-g','已取消':'t-gr'};
  const SMODE={daily:'每日恢复',finite:'售完即止'};

  /* ---------- 演示数据 ---------- */
  function invSeed(){
    if(DB.invItems)return;
    DB.invItems=[
      /* ===== 寄售：货品级、分仓、只读 ===== */
      {item:'ITM-JS-8801',mode:'consign',name:'冰鲜三文鱼',cat:'海鲜水产',unit:'kg',
       skus:[{skuId:'SKU-JS-1101',spec:'1kg/袋',ratio:1},{skuId:'SKU-JS-1102',spec:'3kg/箱',ratio:3}],
       stocks:[{wh:'裕廊DC',wms:186,locked:24,transit:60},{wh:'兀兰DC',wms:52,locked:8,transit:0}]},
      {item:'ITM-JS-8802',mode:'consign',name:'鸡胸肉',cat:'肉禽蛋品',unit:'kg',
       skus:[{skuId:'SKU-JS-1201',spec:'2kg/袋',ratio:2}],
       stocks:[{wh:'裕廊DC',wms:74,locked:12,transit:0},{wh:'盛港DC',wms:31,locked:3,transit:40}]},
      {item:'ITM-JS-8803',mode:'consign',name:'冷冻虾仁',cat:'海鲜水产',unit:'kg',
       skus:[{skuId:'SKU-JS-1301',spec:'500g/盒',ratio:0.5},{skuId:'SKU-JS-1302',spec:'5kg/箱',ratio:5}],
       stocks:[{wh:'裕廊DC',wms:0,locked:0,transit:120}]},
      {item:'ITM-JS-8804',mode:'consign',name:'小棠菜',cat:'新鲜蔬菜',unit:'kg',
       skus:[{skuId:'SKU-JS-1401',spec:'1kg/袋',ratio:1},{skuId:'SKU-JS-1402',spec:'5kg/箱',ratio:5}],
       stocks:[{wh:'兀兰DC',wms:240,locked:35,transit:0},{wh:'盛港DC',wms:96,locked:0,transit:0}]},
      {item:'ITM-JS-8805',mode:'consign',name:'泰国龙眼',cat:'新鲜蔬菜',unit:'箱',
       skus:[{skuId:'SKU-JS-1501',spec:'1箱',ratio:1}],
       stocks:[{wh:'裕廊DC',wms:18,locked:18,transit:0}]},
      /* ===== 自售：SKU 级、不分仓、可改 ===== */
      {item:'SPU-ZS-6601',mode:'self',name:'有机菠菜',cat:'新鲜蔬菜',unit:'件',
       skus:[{skuId:'SKU-ZS-2101',spec:'500g/袋',stock:120,locked:18,stockMode:'daily'},
             {skuId:'SKU-ZS-2102',spec:'2kg/箱',stock:36,locked:4,stockMode:'daily'}]},
      {item:'SPU-ZS-6602',mode:'self',name:'鲜鸡蛋',cat:'肉禽蛋品',unit:'件',
       skus:[{skuId:'SKU-ZS-2201',spec:'30枚/盘',stock:0,locked:0,stockMode:'finite'}]},
      {item:'SPU-ZS-6603',mode:'self',name:'生抽酱油',cat:'调味品',unit:'件',
       skus:[{skuId:'SKU-ZS-2301',spec:'500ml/瓶',stock:240,locked:12,stockMode:'finite'},
             {skuId:'SKU-ZS-2302',spec:'12瓶/箱',stock:45,locked:0,stockMode:'finite'}]},
    ];
    DB.invFlow=[
      {item:'ITM-JS-8801',wh:'裕廊DC',time:'2026-08-11 09:12',type:'out',   qty:12, after:186,doc:'CK-JS-20260811-0043'},
      {item:'ITM-JS-8801',wh:'裕廊DC',time:'2026-08-10 16:40',type:'loss',  qty:4,  after:198,doc:'PD-20260810-0007'},
      {item:'ITM-JS-8801',wh:'裕廊DC',time:'2026-08-10 11:05',type:'out',   qty:26, after:202,doc:'CK-JS-20260810-0031'},
      {item:'ITM-JS-8801',wh:'裕廊DC',time:'2026-08-09 08:30',type:'in',    qty:150,after:228,doc:'R2026080900112'},
      {item:'ITM-JS-8801',wh:'兀兰DC',time:'2026-08-10 14:22',type:'out',   qty:9,  after:52, doc:'CK-JS-20260810-0028'},
      {item:'ITM-JS-8802',wh:'裕廊DC',time:'2026-08-11 10:02',type:'ret',   qty:6,  after:74, doc:'TH-20260811-0005'},
      {item:'ITM-JS-8802',wh:'裕廊DC',time:'2026-08-10 09:18',type:'out',   qty:18, after:68, doc:'CK-JS-20260810-0022'},
      {item:'ITM-JS-8802',wh:'盛港DC',time:'2026-08-08 15:47',type:'damage',qty:5,  after:31, doc:'BS-20260808-0002'},
      {item:'ITM-JS-8803',wh:'裕廊DC',time:'2026-08-09 17:30',type:'out',   qty:34, after:0,  doc:'CK-JS-20260809-0019'},
      {item:'ITM-JS-8804',wh:'兀兰DC',time:'2026-08-11 07:55',type:'in',    qty:200,after:240,doc:'R2026081100031'},
      {item:'ITM-JS-8804',wh:'兀兰DC',time:'2026-08-09 12:10',type:'gain',  qty:3,  after:40, doc:'PD-20260809-0004'},
      {item:'ITM-JS-8804',wh:'盛港DC',time:'2026-08-10 10:33',type:'out',   qty:22, after:96, doc:'CK-JS-20260810-0026'},
      {item:'ITM-JS-8805',wh:'裕廊DC',time:'2026-08-11 08:41',type:'out',   qty:6,  after:18, doc:'CK-JS-20260811-0040'},
      {item:'ITM-JS-8805',wh:'裕廊DC',time:'2026-08-07 09:00',type:'adj',   qty:-2, after:24, doc:'TZ-20260807-0001'},
      /* 自售：无入仓/盘点，只有销售出库、客户退货、商家改库存 */
      {item:'SPU-ZS-6601',wh:SELF_WH,time:'2026-08-11 11:20',type:'out',  qty:14, after:120,doc:'CK-20260811-0091'},
      {item:'SPU-ZS-6601',wh:SELF_WH,time:'2026-08-11 08:00',type:'edit', qty:60, after:134,doc:'商家手动调整'},
      {item:'SPU-ZS-6601',wh:SELF_WH,time:'2026-08-10 15:02',type:'ret',  qty:2,  after:74, doc:'TH-20260810-0011'},
      {item:'SPU-ZS-6603',wh:SELF_WH,time:'2026-08-11 09:40',type:'out',  qty:6,  after:240,doc:'CK-20260811-0088'},
      {item:'SPU-ZS-6602',wh:SELF_WH,time:'2026-08-10 18:30',type:'out',  qty:20, after:0,  doc:'CK-20260810-0074'},
    ];
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
  const isSelf=it=>it.mode=='self';
  const left=(a,b)=>Math.max((+a||0)-(+b||0),0);
  const itemOf=code=>DB.invItems.find(i=>i.item==code)||{};
  const selfTot=it=>it.skus.reduce((a,k)=>({stock:a.stock+(+k.stock||0),locked:a.locked+(+k.locked||0)}),{stock:0,locked:0});

  /* 行 = 商品 × 仓；自售为不分仓的单行 */
  function rows(){
    const wh=DB.invWh||'',kw=(DB.invKw||'').trim().toLowerCase(),md=DB.invMode||'';
    const out=[];
    DB.invItems.forEach(it=>{
      if(md&&it.mode!=md)return;
      if(kw&&!(it.name.toLowerCase().includes(kw)||it.item.toLowerCase().includes(kw)))return;
      if(isSelf(it)){
        if(wh)return;                                   // 自售不分仓：选了具体仓就不出现
        const t=selfTot(it);
        out.push({it,wh:SELF_WH,total:t.stock,locked:t.locked,transit:0,left:left(t.stock,t.locked)});
      }else{
        it.stocks.filter(s=>!wh||s.wh==wh).forEach(s=>
          out.push({it,wh:s.wh,total:s.wms,locked:s.locked,transit:s.transit,left:left(s.wms,s.locked),s}));
      }
    });
    return out;
  }
  /* NAV 徽标：缺货行数（自售无 stocks 数组，必须分流，否则侧栏渲染直接抛错） */
  window.invOutCount=function(){
    if(!DB.invItems)return 0;
    return DB.invItems.reduce((a,it)=>{
      if(isSelf(it)){const t=selfTot(it);return a+(left(t.stock,t.locked)<=0?1:0);}
      return a+(it.stocks||[]).filter(s=>left(s.wms,s.locked)<=0).length;
    },0);
  };
  window.invTransitCount=function(){
    return DB.invInbound?DB.invInbound.filter(d=>d.status=='待入库'||d.status=='入库中').length:0;
  };

  const flowsOf=(code,type)=>DB.invFlow.filter(f=>f.item==code&&(!type||f.type==type)).sort((a,b)=>a.time<b.time?1:-1);
  const signTxt=f=>{const m=FLOW[f.type];return m.s=='±'?(f.qty>0?'+':'')+f.qty:m.s+f.qty;};

  /* ---------- 改库存（仅自售，逐 SKU） ---------- */
  window.inv_edit=function(code){
    const it=itemOf(code);
    if(!isSelf(it)){toast('寄售商品库存由仓库实物决定，不可手工修改','err');return;}
    const rowsHtml=it.skus.map((k,i)=>`<tr>
      <td><b>${k.spec}</b><div class="mono" style="font-size:11.5px;color:var(--ts)">${k.skuId}</div></td>
      <td style="text-align:right;color:var(--ts)">${k.stock}</td>
      <td><input class="ministock" id="ive-${i}" type="number" min="0" step="1" value="${k.stock}" oninput="inv_chk(${it.skus.length})"></td>
      <td><select id="ivm-${i}"><option value="daily" ${k.stockMode=='daily'?'selected':''}>每日恢复</option><option value="finite" ${k.stockMode=='finite'?'selected':''}>售完即止</option></select></td>
    </tr>`).join('');
    modalWide(`<div class="mc-hd"><h3>改库存 · ${it.name}</h3><p><span class="tag t-g" style="font-size:10.5px">自售</span> 逐规格独立维护，单位=件</p><button class="mc-x" onclick="closeModal()">×</button></div>
    <div class="mc-bd">
      <div style="overflow-x:auto"><table class="subtbl"><thead><tr><th>规格</th><th style="text-align:right">当前库存</th><th style="width:130px">新库存</th><th style="width:140px">库存模式</th></tr></thead><tbody>${rowsHtml}</tbody></table></div>
      <div id="ive-err"></div>
      <div class="ib ib-b" style="margin-top:10px"><span class="i">ℹ️</span><b>每日恢复</b>=每天自动回到你设置的数量；<b>售完即止</b>=卖完就没有，需手动补。改库存<b>即时生效、无需审核</b>，设为 0 即售罄下架。</div>
    </div>
    <div class="mc-ft"><button class="btn btn-o" onclick="closeModal()">取消</button><button class="btn btn-p" id="ive-ok" onclick="inv_save('${code}')">保存（即时生效）</button></div>`);
  };
  window.inv_chk=function(n){
    let bad=false;
    for(let i=0;i<n;i++){const v=(document.getElementById('ive-'+i)||{}).value;
      const x=Number(v);if(v===''||isNaN(x)||x<0||!Number.isInteger(x))bad=true;}
    const box=document.getElementById('ive-err'),ok=document.getElementById('ive-ok');
    if(box)box.innerHTML=bad?`<div class="ib ib-r" style="margin-top:8px"><span class="i">⛔</span>库存必须为 ≥0 的整数</div>`:'';
    if(ok)ok.disabled=bad;
    return !bad;
  };
  window.inv_save=function(code){
    const it=itemOf(code);
    if(!inv_chk(it.skus.length)){toast('库存必须为 ≥0 的整数','err');return;}
    it.skus.forEach((k,i)=>{
      k.stock=Math.max(0,parseInt(document.getElementById('ive-'+i).value)||0);
      k.stockMode=document.getElementById('ivm-'+i).value;
    });
    closeModal();render();toast(`「${it.name}」库存已更新，即时生效`,'ok');
  };

  /* ---------- 抽屉 A：库存明细 ---------- */
  window.inv_detail=function(code){
    const it=itemOf(code),u=it.unit,self=isSelf(it);
    const num=(l,v,c)=>`<div style="border:1px solid var(--bd);border-radius:10px;padding:12px 14px;background:#fff">
      <div style="font-size:12px;color:var(--ts);margin-bottom:4px">${l}</div>
      <div style="font-size:20px;font-weight:700;color:${c||'var(--tp)'}">${v}<span style="font-size:12px;font-weight:400;color:var(--ts);margin-left:3px">${u}</span></div></div>`;

    let blocks,tot,totLeft;
    if(self){
      tot=selfTot(it);totLeft=left(tot.stock,tot.locked);
      blocks=`<h4 style="font-size:14px;margin:2px 0 10px;color:var(--g)">① 数量构成</h4>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px">
        ${num('设置库存',tot.stock)}${num('已占用',tot.locked)}${num('可售',totLeft,'var(--g)')}
      </div>
      <div class="ib ib-gr" style="margin-top:10px"><span class="i">📐</span><b>可售 = 设置库存 − 已占用</b>。设置库存是你自己填的可供货数量；「已占用」是买家已下单、还没送出的量。自售商品<b>不入仓</b>，因此没有「在仓实物」与「在途」。</div>

      <h4 style="font-size:14px;margin:16px 0 8px;color:var(--g)">② 各规格库存（逐规格独立）</h4>
      <div style="overflow-x:auto"><table class="subtbl"><thead><tr><th>规格</th><th>SKU 编码</th><th>库存模式</th><th style="text-align:right">设置库存</th><th style="text-align:right">已占用</th><th style="text-align:right">可售</th></tr></thead><tbody>
        ${it.skus.map(k=>`<tr><td>${k.spec}</td><td class="mono">${k.skuId}</td><td><span class="tag ${k.stockMode=='daily'?'t-g':'t-y'}" style="font-size:10.5px">${SMODE[k.stockMode]}</span></td>
          <td style="text-align:right">${k.stock}</td><td style="text-align:right;color:var(--ts)">${k.locked||'—'}</td>
          <td style="text-align:right"><b>${left(k.stock,k.locked)}</b> 件</td></tr>`).join('')}
      </tbody></table></div>
      <div class="ib ib-b" style="margin-top:8px"><span class="i">💡</span>自售商品<b>每个规格的库存各自独立</b>，改一个不影响另一个——这点和寄售相反。</div>`;
    }else{
      tot=it.stocks.reduce((a,s)=>({wms:a.wms+s.wms,locked:a.locked+s.locked,transit:a.transit+s.transit}),{wms:0,locked:0,transit:0});
      totLeft=it.stocks.reduce((a,s)=>a+left(s.wms,s.locked),0);
      const whRows=it.stocks.map(s=>`<tr><td>${s.wh}</td><td style="text-align:right">${s.wms}</td>
        <td style="text-align:right;color:var(--ts)">${s.locked}</td>
        <td style="text-align:right"><b>${left(s.wms,s.locked)}</b></td>
        <td style="text-align:right;${s.transit?'color:var(--b)':'color:var(--tt)'}">${s.transit||'—'}</td></tr>`).join('');
      const skuRows=it.skus.map(k=>`<tr><td>${k.spec}</td><td class="mono">${k.skuId}</td>
        <td style="text-align:right;color:var(--ts)">${k.ratio} ${u}</td>
        <td style="text-align:right"><b>${Math.floor(totLeft/k.ratio)}</b> 件</td></tr>`).join('');
      blocks=`<h4 style="font-size:14px;margin:2px 0 10px;color:var(--g)">① 数量构成（全部仓合计）</h4>
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px">
        ${num('在库',tot.wms)}${num('已占用',tot.locked)}${num('可售',totLeft,'var(--g)')}${num('在途',tot.transit,'var(--b)')}
      </div>
      <div class="ib ib-gr" style="margin-top:10px"><span class="i">📐</span><b>可售 = 在库 − 已占用</b>。「已占用」是买家已下单、仓库尚未出库的量，出库后从在库扣掉；「在途」是你已送到仓、仓库还没入库完成的量，入库完成后才计入在库。</div>

      <h4 style="font-size:14px;margin:16px 0 8px;color:var(--g)">② 分仓明细</h4>
      <div style="overflow-x:auto"><table class="subtbl"><thead><tr><th>仓库</th><th style="text-align:right">在库</th><th style="text-align:right">已占用</th><th style="text-align:right">可售</th><th style="text-align:right">在途</th></tr></thead><tbody>${whRows}</tbody></table></div>
      <div class="ib ib-y" style="margin-top:8px"><span class="i">⚠️</span>各仓库存<b>独立记账、不跨仓调拨</b>，买家下单按收货仓匹配——某仓可售为 0 时，其他仓有货也无法销往该仓覆盖区域。</div>

      <h4 style="font-size:14px;margin:16px 0 8px;color:var(--g)">③ 各规格可售件数（换算）</h4>
      <div style="overflow-x:auto"><table class="subtbl"><thead><tr><th>规格</th><th>SKU 编码</th><th style="text-align:right">1 件 =</th><th style="text-align:right">当前可售</th></tr></thead><tbody>${skuRows}</tbody></table></div>
      <div class="ib ib-b" style="margin-top:8px"><span class="i">💡</span>本商品下<b>所有规格共用同一批货</b>（共 ${totLeft} ${u} 可售），不是各自独立的库存。卖掉任意一个规格，其他规格的可售件数都会同步下降——这不是数据错误。</div>`;
    }

    const recent=flowsOf(code,'').slice(0,5).map(f=>{const m=FLOW[f.type];
      return `<tr><td style="white-space:nowrap;color:var(--ts)">${f.time}</td><td>${f.wh}</td>
        <td><span class="tag ${m.c}"><span class="dot"></span>${m.t}</span></td>
        <td style="text-align:right;${m.s=='-'?'color:var(--r)':m.s=='+'?'color:var(--g)':''}">${signTxt(f)}</td>
        <td style="text-align:right;color:var(--ts)">${f.after}</td></tr>`;}).join('');

    drawer(`<div class="drawer-hd"><div><h3>${it.name} <span class="mono" style="font-size:12.5px;color:var(--ts)">${it.item}</span></h3>
      <div style="margin-top:4px;font-size:12.5px;color:var(--ts)">${it.cat} · 单位 ${u} · ${self?'<span class="tag t-g" style="font-size:10.5px">自售</span> 库存可自行维护':'<span class="tag t-pp" style="font-size:10.5px">寄售</span> 库存由仓库实物决定、只读'}</div></div>
      <span class="x" onclick="closeDrawer()">×</span></div>
    <div class="drawer-bd">
      ${blocks}
      <h4 style="font-size:14px;margin:16px 0 8px;color:var(--g)">${self?'③':'④'} 最近库存变动</h4>
      <div style="overflow-x:auto"><table class="subtbl"><thead><tr><th>时间</th><th>${self?'范围':'仓库'}</th><th>类型</th><th style="text-align:right">变动</th><th style="text-align:right">变动后</th></tr></thead><tbody>${recent||'<tr><td colspan="5" style="color:var(--tt)">暂无变动记录</td></tr>'}</tbody></table></div>
    </div>
    <div class="drawer-ft"><button class="btn btn-o" onclick="closeDrawer()">关闭</button>
      ${self?`<button class="btn btn-o" onclick="closeDrawer();inv_edit('${code}')">改库存</button>`:''}
      <button class="btn btn-p" onclick="closeDrawer();inv_flow('${code}')">查看全部流水 →</button></div>`);
  };

  /* ---------- 抽屉 B：库存流水 ---------- */
  window.inv_flow=function(code){DB.invFlowItem=code;DB.invFlowType='';inv_flowRender();};
  window.inv_flowType=function(v){DB.invFlowType=DB.invFlowType==v?'':v;inv_flowRender();};
  window.inv_flowRender=function(){
    const code=DB.invFlowItem,it=itemOf(code),self=isSelf(it),type=DB.invFlowType||'';
    const list=flowsOf(code,type);
    const chip=(v,t)=>`<button class="btn ${type==v?'btn-p':'btn-o'} btn-sm" onclick="inv_flowType('${v}')">${t}</button>`;
    const chips=self?[['out','销售出库'],['ret','客户退货'],['edit','商家改库存']]
                    :[['in','送货入仓'],['out','销售出库'],['ret','客户退货'],['loss','盘点亏'],['damage','报损'],['gain','盘点盈'],['adj','库存调整']];
    const body=list.map(f=>{const m=FLOW[f.type],dis=DISPUTE.includes(f.type);
      return `<tr><td style="white-space:nowrap;color:var(--ts)">${f.time}</td><td>${f.wh}</td>
        <td><span class="tag ${m.c}"><span class="dot"></span>${m.t}</span></td>
        <td style="text-align:right;font-weight:600;${m.s=='-'?'color:var(--r)':m.s=='+'?'color:var(--g)':''}">${signTxt(f)}</td>
        <td style="text-align:right;color:var(--ts)">${f.after}</td>
        <td class="mono" style="font-size:12px">${f.doc}${dis?` <button class="btn btn-link" style="font-size:12px" onclick="inv_dispute('${f.doc}')">有疑问</button>`:''}</td></tr>`;}).join('');

    drawer(`<div class="drawer-hd"><div><h3>库存流水 · ${it.name}</h3>
      <div style="margin-top:4px;font-size:12.5px;color:var(--ts)"><span class="mono">${it.item}</span> · 单位 ${it.unit} · 近 6 个月</div></div>
      <span class="x" onclick="closeDrawer()">×</span></div>
    <div class="drawer-bd">
      <div class="row" style="gap:6px;flex-wrap:wrap;margin-bottom:12px">${chips.map(c=>chip(c[0],c[1])).join('')}</div>
      <div style="overflow-x:auto"><table class="subtbl"><thead><tr><th>时间</th><th>${self?'范围':'仓库'}</th><th>类型</th><th style="text-align:right">变动</th><th style="text-align:right">变动后结存</th><th>关联单号</th></tr></thead><tbody>${body||`<tr><td colspan="6"><div class="empty"><div class="e-ic">📄</div><div class="e-t">当前筛选下暂无流水</div><div class="e-s">清除类型筛选查看全部变动</div></div></td></tr>`}</tbody></table></div>
      <div class="ib ib-gr" style="margin-top:10px"><span class="i">ℹ️</span>${self?'自售商品不入仓，因此没有入库、盘点、报损类记录。':'「移库」（货在仓内换库位）不改变总量，不在此列出。每笔变动都带仓库作业单号，可凭单号向运营核对。'}</div>
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
    const d=DB.invInbound.find(x=>x.no==no),done=d.status=='入库完成';
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

  /* ---------- 筛选 ---------- */
  window.inv_wh=function(v){DB.invWh=v;render();};
  window.inv_mode=function(v){DB.invMode=v;render();};
  window.inv_search=function(){DB.invKw=(document.getElementById('inv-kw')||{}).value||'';render();};
  window.inv_reset=function(){DB.invKw='';DB.invWh='';DB.invMode='';DB.invQuick='';render();};
  window.inv_quick=function(v){DB.invQuick=DB.invQuick==v?'':v;render();};

  /* ---------- 页面 1：库存列表（自售 + 寄售通用） ---------- */
  PAGES['m-stock']=()=>{
    invSeed();
    DB.invWh=DB.invWh||'';DB.invKw=DB.invKw||'';DB.invMode=DB.invMode||'';DB.invQuick=DB.invQuick||'';
    let list=rows();
    const q=DB.invQuick;
    if(q=='out')list=list.filter(r=>r.left<=0);
    if(q=='transit')list=list.filter(r=>r.transit>0);
    const base=rows(),cOut=base.filter(r=>r.left<=0).length,cTr=base.filter(r=>r.transit>0).length;
    const qb=(v,t,n)=>`<button class="btn ${q==v?'btn-p':'btn-o'} btn-sm" onclick="inv_quick('${v}')">${t}${n?` (${n})`:''}</button>`;

    const body=list.map(r=>{const it=r.it,u=it.unit,self=isSelf(it);
      const spec=self?it.skus.map(k=>`${k.spec} <b>${left(k.stock,k.locked)}</b> 件`).join(' ／ ')
                     :it.skus.map(k=>`${k.spec} <b>${Math.floor(r.left/k.ratio)}</b> 件`).join(' ／ ');
      return `<tr>
        <td><b>${it.name}</b><div class="mono" style="font-size:11.5px;color:var(--ts)">${it.item}</div></td>
        <td>${self?'<span class="tag t-g" style="font-size:10.5px">自售</span>':'<span class="tag t-pp" style="font-size:10.5px">寄售</span>'}</td>
        <td style="color:var(--ts)">${it.cat}</td>
        <td>${self?`<span style="color:var(--tt)">${SELF_WH}</span>`:r.wh}</td>
        <td style="text-align:right">${r.total} <span style="font-size:11.5px;color:var(--tt)">${u}</span></td>
        <td style="text-align:right;color:var(--ts)">${r.locked||'—'}</td>
        <td style="text-align:right"><b style="${r.left<=0?'color:var(--r)':''}">${r.left}</b> <span style="font-size:11.5px;color:var(--tt)">${u}</span></td>
        <td style="text-align:right">${r.transit?`<span style="color:var(--b)">${r.transit} ${u}</span>`:'<span style="color:var(--tt)">—</span>'}</td>
        <td style="font-size:12px;color:var(--ts)">${spec}</td>
        <td>${r.left<=0?'<span class="tag t-r"><span class="dot"></span>缺货</span>':'<span class="tag t-g"><span class="dot"></span>正常</span>'}</td>
        <td>${self?`<button class="btn btn-o btn-sm" onclick="inv_edit('${it.item}')">改库存</button> `:''}<button class="btn btn-link" onclick="inv_detail('${it.item}')">明细</button> <button class="btn btn-link" onclick="inv_flow('${it.item}')">流水</button></td>
      </tr>`;}).join('');

    return `
    <div class="card"><div class="card-bd">
      <div class="fg3">
        <div class="fr"><label class="fl">商品名称 / 编码</label><input id="inv-kw" value="${DB.invKw}" placeholder="输入商品名或编码" onkeydown="if(event.key=='Enter')inv_search()"></div>
        <div class="fr"><label class="fl">供货模式</label><select onchange="inv_mode(this.value)"><option value="">全部</option><option value="self" ${DB.invMode=='self'?'selected':''}>自售</option><option value="consign" ${DB.invMode=='consign'?'selected':''}>寄售</option></select></div>
        <div class="fr"><label class="fl">仓库（仅寄售分仓）</label><select onchange="inv_wh(this.value)"><option value="">全部仓库</option>${WH.map(w=>`<option ${DB.invWh==w?'selected':''}>${w}</option>`).join('')}</select></div>
      </div>
      <div class="row" style="gap:8px;margin-top:4px"><button class="btn btn-p" onclick="inv_search()">查询</button><button class="btn btn-o" onclick="inv_reset()">重置</button></div>
    </div></div>

    <div class="card"><div class="card-hd"><h3>库存列表</h3><span class="sub">共 ${list.length} 条</span>
      <div class="row" style="gap:8px"><button class="btn btn-o btn-sm" onclick="toast('已导出当前筛选结果','ok')">⬇️ 导出库存</button></div>
    </div>
    <div class="card-bd">
      <div class="row" style="gap:8px;margin-bottom:12px">${qb('out','缺货',cOut)}${qb('transit','有在途',cTr)}</div>
      <div class="ib ib-gr" style="margin-bottom:12px"><span class="i">📦</span><b>自售</b>库存由你自己维护，可直接「改库存」；<b>寄售</b>库存由仓库实物决定、<b>不可手工修改</b>，只能查看与追溯流水。</div>
      <div style="overflow-x:auto"><table>
        <thead><tr><th>商品</th><th>供货模式</th><th>品类</th><th>仓库</th><th style="text-align:right">库存</th><th style="text-align:right">已占用</th><th style="text-align:right">可售</th><th style="text-align:right">在途</th><th>各规格可售</th><th>状态</th><th>操作</th></tr></thead>
        <tbody>${body||`<tr><td colspan="11"><div class="empty"><div class="e-ic">📦</div><div class="e-t">${DB.invKw||DB.invWh||DB.invMode||q?'当前筛选下没有库存':'暂无库存'}</div><div class="e-s">${DB.invKw||DB.invWh||DB.invMode||q?'调整筛选条件或点「重置」查看全部':'上架商品后，库存会在这里显示'}</div></div></td></tr>`}</tbody>
      </table></div>
    </div></div>`;
  };

  /* ---------- 页面 2：在途库存（仅寄售有） ---------- */
  PAGES['m-stock-transit']=()=>{
    invSeed();
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
    <div class="card"><div class="card-hd"><h3>在途库存</h3><span class="sub">共 ${DB.invInbound.length} 张入库单</span></div>
    <div class="card-bd">
      <div class="ib ib-b" style="margin-bottom:12px"><span class="i">ℹ️</span>这里跟踪你<b>已送到仓、还没入库完成</b>的货（<b>仅寄售商品</b>——自售不入仓、无在途）。入库单由仓库按你的寄售供货单生成，商家端只读；<b>入库完成且同步成功后才计入可售库存</b>。</div>
      <div style="overflow-x:auto"><table>
        <thead><tr><th>入库单号</th><th>供货单号</th><th>仓库</th><th>商品</th><th style="text-align:right">应收</th><th style="text-align:right">实收</th><th>差异</th><th>状态</th><th>创建时间</th><th>操作</th></tr></thead>
        <tbody>${body||`<tr><td colspan="10"><div class="empty"><div class="e-ic">🚚</div><div class="e-t">暂无在途入库</div><div class="e-s">送货到仓后，入库进度会在这里显示</div></div></td></tr>`}</tbody>
      </table></div>
    </div></div>`;
  };
})();
