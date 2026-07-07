/* PC · 送货退货 —— 搬迁自 App「送货签到 / 交货进度 / 装筐送货 / 退库单」四合一。
   PC 形态：顶部 Tab(DB.delivTab) 分 4 子页，整页 re-render。
   依赖 inline 脚本：DB / money / toast / modal / modalWide / closeModal / nav / render / tag。
   仓库/区域全 SG，事业部=新加坡事业部。文案照 App 录屏真实中文，不自创业务规则。 */
(function(){
  /* ============================================================
     演示数据（模块内常量；可变状态挂 DB.deliv*）
  ============================================================ */
  // 送货签到 · 预约送货单
  const SIGN=[
    {no:'Y26070110736788',status:'signed', wh:'裕廊DC',  dc:'直送仓',wave:'上午达',time:'2026-07-01 23:00–02:00',addr:'裕廊西 Jurong Wholesale Centre Blk 14 #02-12, Singapore 一楼三号库',should:304,inbound:147,record:'第一车 00:08 裕廊DC 已通过'},
    {no:'Y26070150475186',status:'booked', wh:'兀兰DC',  dc:'直送仓',wave:'上午达',time:'2026-07-01 23:00–02:00',addr:'兀兰 Woodlands Ind Park E1 #01-08, Singapore 8号库1楼9–11号门',should:403,inbound:0,  record:''},
    {no:'Y26070100788924',status:'signed', wh:'盛港DC',  dc:'直送仓',wave:'凌晨达',time:'2026-07-01 02:00–05:00',addr:'盛港 Sengkang Logistics Hub #01-22, Singapore',should:114,inbound:30, record:'第一车 03:12 盛港DC 已通过'},
    {no:'Y26070140037238',status:'booked', wh:'大巴窑DC',dc:'上门揽收',wave:'上午达',time:'2026-07-01 23:00–02:00',addr:'大巴窑 Toa Payoh Ind Park Lor 8 #01-05, Singapore',should:5,  inbound:0,  record:''},
  ];
  // 交货进度 · 按仓统计（新加坡事业部）
  const PROG=[
    {wh:'CKA新加坡履约中心',wave:'上午达',time:'06-30 23:00–02:00',should:33, printed:0,  delivered:0,  early:10,hasStation:false},
    {wh:'裕廊DC',          wave:'上午达',time:'06-30 23:00–02:00',should:304,printed:290,delivered:147,early:3, hasStation:true,
      stations:[['裕廊西区',180,170,90],['裕廊东区',84,80,42],['文礼区',40,40,15]]},
    {wh:'兀兰DC',          wave:'凌晨达',time:'06-30 23:00–02:00',should:403,printed:403,delivered:0,  early:0, hasStation:true,
      stations:[['兀兰中区',220,220,0],['三巴旺区',103,103,0],['义顺区',80,80,0]]},
    {wh:'盛港DC',          wave:'上午达',time:'06-30 23:00–02:00',should:3,  printed:3,  delivered:0,  early:0, hasStation:true,
      stations:[['盛港东区',2,2,0],['榜鹅区',1,1,0]]},
    {wh:'大巴窑DC',        wave:'下午达',time:'07-01 11:00–14:00',should:55, printed:55, delivered:12, early:5, hasStation:true,
      stations:[['大巴窑区',30,30,8],['碧山区',25,25,4]]},
  ];
  const WAVES=['全部','凌晨达','上午达','下午达'];
  // 退库单
  const RET=[
    {id:'TKD2026070108266685',wh:'裕廊DC',  status:'待出库',qty:1,code:'460439',order:'2026-07-01 02:51',deadline:'2026-07-04 02:51'},
    {id:'TKD2026063008267496',wh:'兀兰DC',  status:'待运输',qty:2,code:'897236',order:'2026-06-30 09:12',deadline:'2026-07-03 09:12'},
    {id:'TKD2026062908314280',wh:'盛港DC',  status:'运输中',qty:1,code:'715187',order:'2026-06-29 09:04',deadline:'2026-07-02 09:04'},
    {id:'TKD2026062808299011',wh:'大巴窑DC',status:'已送达',qty:3,code:'330412',order:'2026-06-28 14:20',deadline:'2026-07-01 14:20'},
  ];
  const SG_WH=['裕廊DC','兀兰DC','盛港DC','大巴窑DC','淡滨尼DC','义顺DC'];

  /* ---------- 通用小工具 ---------- */
  function signTag(s){return s=='signed'?'<span class="tag t-g"><span class="dot"></span>已签到</span>':'<span class="tag t-y"><span class="dot"></span>已预约</span>';}
  function retTag(s){const m={'待出库':'t-y','待运输':'t-b','运输中':'t-b','已送达':'t-g'}[s]||'t-gr';return `<span class="tag ${m}"><span class="dot"></span>${s}</span>`;}
  // 伪二维码块（演示用，确定性图案）
  function qrBlock(seed,size){
    size=size||168;let s=0;for(const c of String(seed))s+=c.charCodeAt(0);
    let cells='';
    for(let r=0;r<21;r++)for(let c=0;c<21;c++){
      const finder=(r<7&&c<7)||(r<7&&c>13)||(r>13&&c<7);
      let on;
      if(finder){const rr=r%7||r,cc=c%7||c;const lr=r>13?r-14:r,lc=c>13?c-14:c;on=(lr==0||lr==6||lc==0||lc==6||(lr>=2&&lr<=4&&lc>=2&&lc<=4));}
      else on=((r*7+c*13+s+((r*c)%17))%3==0);
      cells+=`<i style="display:block;background:${on?'#111':'#fff'}"></i>`;
    }
    return `<div style="display:grid;grid-template-columns:repeat(21,1fr);grid-template-rows:repeat(21,1fr);width:${size}px;height:${size}px;margin:0 auto;border:6px solid #fff;box-shadow:0 0 0 1px var(--bd2)">${cells}</div>`;
  }

  /* ============================================================
     子页 1 · 送货签到
  ============================================================ */
  // 送货单状态样式：待送货/已预约→已预约(黄)、已签到→蓝、交接完成→已入库(绿)
  function dvTag(s){const m={'待送货':['已预约','t-y'],'已预约':['已预约','t-y'],'已签到':['已签到','t-b'],'交接完成':['已入库','t-g']}[s]||[s,'t-gr'];
    return `<span class="tag ${m[1]}"><span class="dot"></span>${m[0]}</span>`;}
  function dvShould(d){return (d.labels||[]).length;}                 // 应送货 = 条码张数（客户×SKU）
  function dvIn(d){return (d.labels||[]).filter(p=>p.arrived).length;} // 已入库 = 已核验到仓张数
  function tabSign(){
    const DL=DB.deliveries||[];
    if(!DL.length) return `<div class="empty"><div class="e-ic">🚚</div><div class="e-t">暂无预约送货单</div><div class="e-s">拣货单「分拣贴码」完成后，系统按<b>入库仓库</b>自动生成送货单。<br>可到「拣货(按SKU)」完成一张拣货单的贴码并「生成送货单」。</div></div>`;
    return `<div class="ib ib-r" style="margin-bottom:12px"><span class="i">📣</span>送货单来自拣货单贴码后按仓拆分。可转发给司机，签到后由仓库逐张核验交接入仓（标签到齐 → 订单转「待收货」）。</div>
    <div class="card"><div class="card-bd" style="padding:12px 20px;display:flex;justify-content:space-between;align-items:center">
      <div style="font-size:13.5px"><b>转发隐私</b><span style="color:var(--ts);margin-left:8px">${DB.delivShareItems?'允许对方查看商品清单':'不允许对方查看商品清单'}</span></div>
      <button class="btn btn-link" onclick="deliv_togglePrivacy()">修改 ›</button>
    </div></div>
    <div class="card"><div class="card-hd"><h3>预约送货单</h3><span class="sub">共 ${DL.length} 单 · 交接完成 ${DL.filter(d=>d.status=='交接完成').length} · 送货单:拣货单 = N:1（一仓一张）</span></div>
    <div class="card-bd flush"><div style="overflow-x:auto"><table>
      <thead><tr><th>预约送货单</th><th>状态</th><th>入库仓库</th><th>送达时段</th><th>应送货 / 已入库</th><th>操作</th></tr></thead><tbody>
      ${DL.map(d=>`<tr>
        <td class="mono">${d.id}<div style="font-size:11px;color:var(--ts);margin-top:2px">拣货单 ${d.pickId}</div></td>
        <td>${dvTag(d.status)}</td>
        <td><b>${d.warehouse}</b><div style="font-size:11px;color:var(--ts);margin-top:2px">${d.orderIds.length} 单</div></td>
        <td>${d.deliver} · ${d.wave}<div style="font-size:11px;color:var(--ts)">${d.window}</div></td>
        <td><b style="font-size:15px">${dvShould(d)}</b> <span style="color:var(--ts)">/ ${dvIn(d)}</span></td>
        <td>${d.status=='交接完成'
          ?`<button class="btn btn-o btn-sm" onclick="deliv_signDetail('${d.id}')">查看详情</button>`
          :d.status=='已签到'
          ?`<span style="font-size:11.5px;color:var(--ts);margin-right:6px">待仓库扫码交接</span><button class="btn btn-o btn-sm" onclick="deliv_signDetail('${d.id}')">详情</button> <button class="btn btn-o btn-sm" onclick="deliv_forward('${d.id}')">转发</button>`
          :`<button class="btn btn-p btn-sm" onclick="deliv_signQR('${d.id}')">签到</button> <button class="btn btn-o btn-sm" onclick="deliv_signDetail('${d.id}')">详情</button> <button class="btn btn-o btn-sm" onclick="deliv_forward('${d.id}')">转发</button>`}</td>
      </tr>`).join('')}
      </tbody></table></div></div></div>`;
  }
  window.deliv_togglePrivacy=function(){DB.delivShareItems=!DB.delivShareItems;render();toast(DB.delivShareItems?'已允许对方查看商品清单':'已关闭商品清单查看','info');};
  function dvGet(id){return (DB.deliveries||[]).find(x=>x.id==id);}
  window.deliv_signQR=function(id){const d=dvGet(id);if(!d)return;
    modal(`<div class="mc-hd"><h3>送货签到 · ${d.warehouse}</h3><p>送货单 ${d.id} · 拣货单 ${d.pickId}</p><button class="mc-x" onclick="closeModal()">×</button></div><div class="mc-bd">
      <div class="kv" style="margin-bottom:14px"><div><div class="k">入库仓库</div><div class="v">${d.warehouse}</div></div><div><div class="k">送达时段</div><div class="v" style="font-size:13px">${d.deliver} ${d.window}</div></div><div><div class="k">应送货</div><div class="v">${dvShould(d)} 张</div></div><div><div class="k">订单数</div><div class="v">${d.orderIds.length}</div></div></div>
      <div style="background:var(--gl);border-radius:12px;padding:18px 0 14px;text-align:center;margin-bottom:6px">
        <div style="font-weight:700;margin-bottom:12px">送货签到码</div>${qrBlock(d.id)}
        <div style="font-size:12px;color:var(--ts);margin-top:12px">到仓后扫码签到，随后仓库逐张核验交接入仓</div></div>
    </div><div class="mc-ft"><button class="btn btn-o" onclick="closeModal()">关闭</button><button class="btn btn-p" onclick="deliv_doSign('${d.id}')">确认已签到</button></div>`);
  };
  window.deliv_doSign=function(id){const d=dvGet(id);if(!d)return;if(d.status=='待送货'||d.status=='已预约')d.status='已签到';closeModal();render();toast(`${id} 已签到，仓库可逐张核验交接入仓`,'ok');};
  // 交接入仓：真实由【仓库端 WMS 扫码】逐张核验标签到齐 → 送货单「交接完成」→ 关联订单转「待收货」。
  // 商家后台不做此动作；此处为【演示】模拟仓库扫齐全部标签后交接（调用主文件 deliveryHandover）。
  window.deliv_handover=function(id){const d=dvGet(id);if(!d)return;(d.labels||[]).forEach(l=>l.arrived=true);deliveryHandover(id);render();toast(`【演示】仓库已扫码交接 ${id}，${d.orderIds.length} 个订单转「待收货」`,'ok');};
  window.deliv_signDetail=function(id){const d=dvGet(id);if(!d)return;
    modalWide(`<div class="mc-hd"><h3>送货单详情 · ${d.warehouse}</h3><p>${d.id} · 拣货单 ${d.pickId} · ${d.deliver} ${d.wave} ${d.window}</p><button class="mc-x" onclick="closeModal()">×</button></div><div class="mc-bd">
      <div class="kv" style="margin:0 0 14px"><div><div class="k">入库仓库</div><div class="v">${d.warehouse}</div></div><div><div class="k">订单数</div><div class="v">${d.orderIds.length}</div></div><div><div class="k">应送货</div><div class="v">${dvShould(d)} 张</div></div><div><div class="k">已入库</div><div class="v" style="${dvIn(d)<dvShould(d)?'color:var(--r)':'color:var(--gd)'}">${dvIn(d)} 张</div></div></div>
      <table style="border:1px solid var(--bd2);border-radius:8px;overflow:hidden"><thead><tr><th>条码</th><th>商品</th><th>所属订单</th><th>到仓</th></tr></thead><tbody>
        ${d.labels.map(p=>`<tr><td class="mono" style="font-size:12px">${p.code}</td><td><b>${p.name}</b> ${p.qty}${p.unit}</td><td class="mono" style="font-size:12px;color:var(--ts)">${p.orderId}</td><td style="${p.arrived?'color:var(--gd)':'color:var(--r)'}">${p.arrived?'✓ 已到':'待到仓'}</td></tr>`).join('')}
      </tbody></table>
    </div><div class="mc-ft"><button class="btn btn-o" onclick="closeModal()">关闭</button>${d.status=='已签到'?`<button class="btn btn-link" onclick="closeModal();deliv_handover('${d.id}')">🔬 演示：模拟仓库扫码交接（标签到齐）</button>`:''}</div>`);
  };
  window.deliv_forward=function(id){const d=dvGet(id);if(!d)return;
    modal(`<div class="mc-hd"><h3>转发送货单 · ${d.warehouse}</h3><p>送货单 ${d.id}</p><button class="mc-x" onclick="closeModal()">×</button></div><div class="mc-bd">
      <div class="ib ib-b"><span class="i">🚚</span>把送货单转发给送货司机，司机可签到并实时查看交货进度。</div>
      <div style="background:var(--gl);border-radius:12px;padding:16px 0;text-align:center;margin:6px 0 12px">${qrBlock(d.id+'F',140)}<div style="font-size:12px;color:var(--ts);margin-top:10px">司机微信扫码接收</div></div>
      <div class="fr" style="display:flex;align-items:center;justify-content:space-between"><label class="fl" style="margin:0">转发隐私 · 允许查看商品清单</label><input type="checkbox" style="width:auto" ${DB.delivShareItems?'checked':''} onchange="DB.delivShareItems=this.checked"></div>
    </div><div class="mc-ft"><button class="btn btn-o" onclick="closeModal()">取消</button><button class="btn btn-p" onclick="closeModal();toast('转发链接已复制，可发送给司机','ok')">复制转发链接</button></div>`);
  };

  /* ============================================================
     子页 2 · 交货进度
  ============================================================ */
  function tabProg(){
    const w=DB.delivWave||'全部';
    const rows=PROG.filter(p=>w=='全部'||p.wave==w);
    const total=rows.reduce((s,p)=>s+p.should,0);
    const waveBar=`<div class="tabs" style="margin-bottom:14px">${WAVES.map(x=>`<div class="tab ${w==x?'active':''}" onclick="DB.delivWave='${x}';render()">${x}</div>`).join('')}</div>`;
    const filt=`<div class="card"><div class="card-bd" style="padding:12px 20px"><div class="row" style="gap:10px;align-items:center">
      <select style="max-width:150px"><option>${DB.delivDate||'2026-07-01'}</option></select>
      <select style="max-width:160px"><option>新加坡事业部</option></select>
      <select style="max-width:150px"><option>全部仓库</option>${SG_WH.map(x=>`<option>${x}</option>`).join('')}</select>
    </div></div></div>`;
    if(!rows.length) return waveBar+filt+`<div class="empty"><div class="e-ic">📦</div><div class="e-t">该波次暂无交货数据</div><div class="e-s">切换波次或日期查看其它批次。</div></div>`;
    return waveBar+filt+`
    <div class="card"><div class="card-hd"><h3>新加坡事业部 · ${w}</h3><span class="sub">总销量 ${total}</span></div>
    <div class="card-bd flush"><div style="overflow-x:auto"><table>
      <thead><tr><th>仓库 / 交货时间</th><th>应送货</th><th>已打印</th><th>已交货</th><th>待交货</th><th>未送货</th><th>操作</th></tr></thead><tbody>
      ${rows.map((p,idx)=>{const wait=p.should-p.delivered,notsent=p.should-p.printed;return `<tr>
        <td><b>${p.wh}</b><div style="font-size:11px;color:var(--ts);margin-top:2px">交货 ${p.time}${p.early?` · 早批次 ${p.early}`:''}</div></td>
        <td><b>${p.should}</b></td>
        <td>${p.hasStation?p.printed:'—'}</td>
        <td>${p.delivered}</td>
        <td style="color:var(--b);font-weight:600">${wait}</td>
        <td style="color:var(--r);font-weight:600">${notsent}<span style="font-size:11px">件</span></td>
        <td>${p.hasStation?`<button class="btn btn-o btn-sm" onclick="deliv_station(${PROG.indexOf(p)})">站区明细</button>`:'<span style="color:var(--ts);font-size:12px">—</span>'}</td>
      </tr>`;}).join('')}
      </tbody></table></div></div></div>`;
  }
  window.deliv_station=function(i){const p=PROG[i];
    modalWide(`<div class="mc-hd"><h3>站区明细 · ${p.wh}</h3><p>新加坡事业部 · ${p.wave} · 交货 ${p.time}</p><button class="mc-x" onclick="closeModal()">×</button></div><div class="mc-bd">
      <table style="border:1px solid var(--bd2);border-radius:8px;overflow:hidden"><thead><tr><th>站区</th><th>应送货</th><th>已打印</th><th>已交货</th></tr></thead><tbody>
        ${(p.stations||[]).map(st=>`<tr><td><b>${st[0]}</b></td><td>${st[1]}</td><td>${st[2]}</td><td style="${st[3]<st[1]?'color:var(--r)':''}">${st[3]}</td></tr>`).join('')}
        <tr style="font-weight:700;background:var(--gl)"><td>合计</td><td>${p.stations.reduce((s,x)=>s+x[1],0)}</td><td>${p.stations.reduce((s,x)=>s+x[2],0)}</td><td>${p.stations.reduce((s,x)=>s+x[3],0)}</td></tr>
      </tbody></table>
    </div><div class="mc-ft"><button class="btn btn-p" onclick="closeModal()">关闭</button></div>`);
  };

  /* ============================================================
     子页 3 · 装筐送货
  ============================================================ */
  function tabBasket(){
    const t=DB.basketTab||'wait';
    const tabs=`<div class="tabs">
      <div class="tab ${t=='wait'?'active':''}" onclick="DB.basketTab='wait';render()">待装筐</div>
      <div class="tab ${t=='done'?'active':''}" onclick="DB.basketTab='done';render()">已装筐</div>
      <div class="tab ${t=='check'?'active':''}" onclick="DB.basketTab='check';render()">抽点结果</div>
    </div>`;
    const filt=`<div class="card"><div class="card-bd" style="padding:12px 20px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px">
      <div class="row" style="gap:10px;align-items:center">
        <select style="max-width:140px"><option>${DB.delivDate||'2026-07-01'}</option></select>
        <select style="max-width:170px"><option>CKA新加坡履约中心</option>${SG_WH.map(x=>`<option>${x}</option>`).join('')}</select>
        <select style="max-width:130px"><option>上午达</option><option>凌晨达</option><option>下午达</option></select>
        <span style="font-size:12.5px;color:var(--ts)">装筐方式：按品输入</span>
      </div>
      <button class="btn btn-p btn-sm" onclick="deliv_scan()">📷 扫描容器，开始装筐</button>
    </div></div>`;
    return tabs+filt+`<div class="empty"><div class="e-ic">🧺</div><div class="e-t">当前仓库未开启本功能</div><div class="e-s">装筐送货需仓库后台开启。开启后此处展示${t=='wait'?'待装筐任务':t=='done'?'已装筐记录':'抽点核验结果'}。<br>如需开启请联系所属仓库运营。</div></div>`;
  }
  window.deliv_scan=function(){toast('当前仓库未开启装筐功能，无法扫描容器','err');};

  /* ============================================================
     子页 4 · 退库单
  ============================================================ */
  function tabReturn(){
    const t=DB.returnTab||'all';
    const rows=RET.filter(r=>t=='all'||r.status==t);
    const tabs=`<div class="tabs">
      ${[['all','全部'],['待出库','待出库'],['待运输','待运输'],['运输中','运输中'],['已送达','已送达']].map(x=>`<div class="tab ${t==x[0]?'active':''}" onclick="DB.returnTab='${x[0]}';render()">${x[1]}</div>`).join('')}
    </div>`;
    const head=`<div class="ib ib-r" style="margin-bottom:12px"><span class="i">⚠️</span><div>请在 RF 端与仓库工作人员确认实际提货数量后，提供提货码。因售后链路较长，商品数量会有 <b>20%</b> 的浮动差异，且商品质量也无法完全保证。如收到货物后发现存在严重问题，可拨打客服热线 <b>4000-616-700</b> 咨询。</div></div>`;
    const filt=`<div class="card"><div class="card-bd" style="padding:12px 20px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px">
      <div class="row" style="gap:10px;align-items:center">
        <select style="max-width:150px"><option>全部仓库</option>${SG_WH.map(x=>`<option>${x}</option>`).join('')}</select>
        <select style="max-width:150px"><option>全部单据</option><option>客退退库单</option><option>滞销退库单</option></select>
      </div>
      <button class="btn btn-p btn-sm" onclick="deliv_newReturn()">＋ 新建退库单</button>
    </div></div>`;
    if(!rows.length) return head+tabs+filt+`<div class="empty"><div class="e-ic">📦</div><div class="e-t">该状态下暂无退库单</div><div class="e-s">切换状态或点「＋ 新建退库单」发起退库。</div></div>`;
    return head+tabs+filt+`
    <div class="card"><div class="card-hd"><h3>退库单</h3><span class="sub">共 ${rows.length} 单</span></div>
    <div class="card-bd flush"><div style="overflow-x:auto"><table>
      <thead><tr><th>退库单号</th><th>状态</th><th>仓库</th><th>件数</th><th>提货码</th><th>提货截止时间</th><th>操作</th></tr></thead><tbody>
      ${rows.map((r,idx)=>`<tr>
        <td class="mono">${r.id}<div style="margin-top:3px"><span class="tag t-gr" style="font-size:10.5px">客退退库单</span></div><div style="font-size:11px;color:var(--ts);margin-top:2px">${r.order} 下单</div></td>
        <td>${retTag(r.status)}</td>
        <td><span style="color:var(--r)">●</span> ${r.wh}</td>
        <td>共 <b>${r.qty}</b> 件</td>
        <td class="mono" style="color:var(--b);font-weight:700">${r.code}</td>
        <td style="color:var(--r)">${r.deadline}</td>
        <td>${r.status=='待出库'
          ?`<button class="btn btn-p btn-sm" onclick="deliv_pickup('${r.id}')">预约提货</button>`
          :`<button class="btn btn-o btn-sm" onclick="deliv_retDetail('${r.id}')">查看详情</button>`}</td>
      </tr>`).join('')}
      </tbody></table></div></div></div>`;
  }
  window.deliv_retDetail=function(id){const r=RET.find(x=>x.id==id);
    modal(`<div class="mc-hd"><h3>退库单 ${r.id}</h3><p>${retTag(r.status)} · ${r.wh}</p><button class="mc-x" onclick="closeModal()">×</button></div><div class="mc-bd">
      <div class="kv"><div><div class="k">提货码</div><div class="v mono">${r.code}</div></div><div><div class="k">件数</div><div class="v">共 ${r.qty} 件</div></div><div><div class="k">下单时间</div><div class="v" style="font-size:13px">${r.order}</div></div><div><div class="k">提货截止</div><div class="v" style="font-size:13px;color:var(--r)">${r.deadline}</div></div></div>
    </div><div class="mc-ft"><button class="btn btn-p" onclick="closeModal()">关闭</button></div>`);
  };

  // 新建退库单
  window.deliv_newReturn=function(){
    DB.retNew=DB.retNew||{type:'成品',lines:[]};
    deliv_renderNew();
  };
  function deliv_renderNew(){
    const n=DB.retNew,tot=n.lines.reduce((s,l)=>s+l.qty,0);
    modalWide(`<div class="mc-hd"><h3>新建退库单</h3><p>退库信息 + 退库商品，提交后生成提货码</p><button class="mc-x" onclick="closeModal()">×</button></div><div class="mc-bd">
      <div class="card" style="box-shadow:none;margin-bottom:12px"><div class="card-hd"><h3>退库信息</h3></div><div class="card-bd">
        <div class="fg2">
          <div class="fr"><label class="fl"><b>*</b>取货仓库</label><select id="ret-wh">${SG_WH.map(x=>`<option ${n.wh==x?'selected':''}>${x}</option>`).join('')}</select></div>
          <div class="fr"><label class="fl"><b>*</b>商品类型</label>
            <div style="display:flex;gap:18px;align-items:center;padding-top:6px">
              <label style="display:flex;align-items:center;gap:6px;cursor:pointer"><input type="radio" name="ret-type" style="width:auto" ${n.type=='成品'?'checked':''} onclick="DB.retNew.type='成品'">成品</label>
              <label style="display:flex;align-items:center;gap:6px;cursor:pointer"><input type="radio" name="ret-type" style="width:auto" ${n.type=='包装物'?'checked':''} onclick="DB.retNew.type='包装物'">包装物</label>
            </div></div>
        </div>
      </div></div>
      <div class="card" style="box-shadow:none"><div class="card-hd"><h3>退库商品</h3><button class="btn btn-link" onclick="deliv_addRetLine()">＋ 添加退库商品</button></div>
      <div class="card-bd ${n.lines.length?'flush':''}">
        ${n.lines.length?`<table><thead><tr><th>商品</th><th>规格</th><th>退库数量</th><th>预估货值</th><th></th></tr></thead><tbody>
          ${n.lines.map((l,i)=>`<tr><td><b>${l.name}</b></td><td>${l.spec}</td><td>${l.qty} ${l.unit}</td><td>${money(l.qty*l.price)}</td><td><button class="btn btn-link" onclick="deliv_delRetLine(${i})">移除</button></td></tr>`).join('')}
        </tbody></table>`:`<div class="empty" style="padding:26px 0"><div class="e-ic">➕</div><div class="e-t">尚未添加退库商品</div><div class="e-s">点右上「＋ 添加退库商品」从库存选择。</div></div>`}
      </div></div>
    </div><div class="mc-ft"><div style="flex:1;font-size:13px">退货商品合计 <b style="font-size:16px">${tot}</b> 件</div><button class="btn btn-o" onclick="closeModal()">取消</button><button class="btn btn-p" ${n.lines.length?'':'disabled'} onclick="deliv_submitReturn()">提交退库单</button></div>`);
  }
  window.deliv_addRetLine=function(){
    const pool=[['本地白菜','5kg/箱','箱',12.5],['有机西兰花','3kg/箱','箱',21.0],['鲜鸡蛋','30枚/盘','盘',8.4],['精品油豆泡','1.5kg/组','组',6.2]];
    const p=pool[DB.retNew.lines.length%pool.length];
    DB.retNew.lines.push({name:p[0],spec:p[1],unit:p[2],price:p[3],qty:1});
    deliv_renderNew();
  };
  window.deliv_delRetLine=function(i){DB.retNew.lines.splice(i,1);deliv_renderNew();};
  window.deliv_submitReturn=function(){
    if(!DB.retNew.lines.length){toast('请先添加退库商品','err');return;}
    const tot=DB.retNew.lines.reduce((s,l)=>s+l.qty,0);
    closeModal();DB.retNew={type:'成品',lines:[]};
    toast(`退库单已提交（共 ${tot} 件），已生成提货码，请按截止时间预约提货`,'ok');
  };

  // 预约提货
  window.deliv_pickup=function(id){DB.retPickup={id,need:true,date:'',reason:''};deliv_renderPickup();};
  function deliv_renderPickup(){
    const p=DB.retPickup,r=RET.find(x=>x.id==p.id);
    const reasons=['商品已无销售价值','不再需要该商品','质量问题','其它'];
    modal(`<div class="mc-hd"><h3>预约提货</h3><p>退库单 ${r.id} · ${r.wh} · 共 ${r.qty} 件</p><button class="mc-x" onclick="closeModal()">×</button></div><div class="mc-bd">
      <div class="ib ib-y"><span class="i">⏰</span>超期未确认提货，商品自动进入销残程序。提货截止 <b>${r.deadline}</b>。</div>
      <div class="fr"><label class="fl">是否需要提货</label>
        <div style="display:flex;gap:20px;align-items:center;padding-top:6px">
          <label style="display:flex;align-items:center;gap:6px;cursor:pointer"><input type="radio" name="pk-need" style="width:auto" ${p.need?'checked':''} onclick="deliv_pickupMode(true)">需要提货</label>
          <label style="display:flex;align-items:center;gap:6px;cursor:pointer"><input type="radio" name="pk-need" style="width:auto" ${!p.need?'checked':''} onclick="deliv_pickupMode(false)">不需要提货</label>
        </div></div>
      ${p.need
        ?`<div class="fr"><label class="fl">预约提货时间</label><input type="date" id="pk-date" value="${p.date||''}" onchange="DB.retPickup.date=this.value"></div>`
        :`<div class="ib ib-r"><span class="i">⛔</span>选择「不需要提货」即<b>放弃该批商品所有权</b>，商品所有权归仓库处置，不再退还，请谨慎操作。</div>
          <div class="fr"><label class="fl">放弃原因</label>
            <div style="display:flex;flex-direction:column;gap:8px;padding-top:6px">
              ${reasons.map(rs=>`<label style="display:flex;align-items:center;gap:8px;cursor:pointer"><input type="radio" name="pk-reason" style="width:auto" ${p.reason==rs?'checked':''} onclick="DB.retPickup.reason='${rs}'">${rs}</label>`).join('')}
            </div></div>`}
    </div><div class="mc-ft"><button class="btn btn-o" onclick="closeModal()">取消</button><button class="btn ${p.need?'btn-p':'btn-d'}" onclick="deliv_pickupConfirm()">确定</button></div>`);
  }
  window.deliv_pickupMode=function(need){DB.retPickup.need=need;deliv_renderPickup();};
  window.deliv_pickupConfirm=function(){
    const p=DB.retPickup,r=RET.find(x=>x.id==p.id);
    if(p.need){
      const d=document.getElementById('pk-date');p.date=d?d.value:p.date;
      if(!p.date){toast('请选择预约提货时间','err');return;}
      closeModal();toast(`已预约 ${p.date} 提货，请凭提货码 ${r.code} 到 ${r.wh} 提货`,'ok');
    }else{
      if(!p.reason){toast('请选择放弃原因','err');return;}
      // 二次确认（破坏性动作）
      modal(`<div class="mc-hd"><h3>确认放弃所有权？</h3><button class="mc-x" onclick="closeModal()">×</button></div><div class="mc-bd">
        <div class="ib ib-r"><span class="i">⚠️</span>退库单 <b>${r.id}</b> 共 ${r.qty} 件，放弃后<b>所有权归仓库处置，不再退还，且不可撤销</b>。</div>
        <dl class="dl"><dt>仓库</dt><dd>${r.wh}</dd><dt>放弃原因</dt><dd>${p.reason}</dd></dl>
      </div><div class="mc-ft"><button class="btn btn-o" onclick="deliv_renderPickupBack()">再想想</button><button class="btn btn-d" onclick="deliv_pickupGiveup()">确认放弃所有权</button></div>`);
    }
  };
  window.deliv_renderPickupBack=function(){deliv_renderPickup();};
  window.deliv_pickupGiveup=function(){const r=RET.find(x=>x.id==DB.retPickup.id);closeModal();toast(`${r.id} 已放弃所有权，商品进入仓库销残程序`,'info');};

  /* ============================================================
     入口 · 顶部 Tab 分 4 子页
  ============================================================ */
  PAGES['m-delivery']=()=>{
    const t=DB.delivTab||'sign';
    // 「装筐送货」Tab 暂不要（2026-07 沈亮），tabBasket 函数保留备用
    const top=`<div class="tabs" style="margin-bottom:14px">
      <div class="tab ${t=='sign'?'active':''}" onclick="DB.delivTab='sign';render()">🚚 送货签到</div>
      <div class="tab ${t=='prog'?'active':''}" onclick="DB.delivTab='prog';render()">📊 交货进度</div>
      <div class="tab ${t=='return'?'active':''}" onclick="DB.delivTab='return';render()">↩️ 退库单</div>
    </div>`;
    const body=t=='prog'?tabProg():t=='return'?tabReturn():tabSign();
    return top+body;
  };
})();
