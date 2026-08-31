/* PC · 送货退货 —— 搬迁自 App「送货签到 / 交货进度 / 装筐送货 / 退货单」四合一。
   PC 形态：顶部 Tab(DB.delivTab) 分 4 子页，整页 re-render。
   依赖 inline 脚本：DB / money / toast / modal / modalWide / closeModal / nav / render / tag。
   仓库/区域全 SG，事业部=新加坡事业部。文案照 App 录屏真实中文，不自创业务规则。 */
(function(){
  /* ============================================================
     演示数据（模块内常量；可变状态挂 DB.deliv*）
  ============================================================ */
  // 送货签到 · 预约送货单
  const SIGN=[
    {no:'Y26070110736788',status:'signed', wh:'裕廊DC',  dc:'直送仓',time:'2026-07-01 23:00–02:00',addr:'裕廊西 Jurong Wholesale Centre Blk 14 #02-12, Singapore 一楼三号库',should:304,inbound:147,record:'第一车 00:08 裕廊DC 已通过'},
    {no:'Y26070150475186',status:'booked', wh:'兀兰DC',  dc:'直送仓',time:'2026-07-01 23:00–02:00',addr:'兀兰 Woodlands Ind Park E1 #01-08, Singapore 8号库1楼9–11号门',should:403,inbound:0,  record:''},
    {no:'Y26070100788924',status:'signed', wh:'盛港DC',  dc:'直送仓',time:'2026-07-01 02:00–05:00',addr:'盛港 Sengkang Logistics Hub #01-22, Singapore',should:114,inbound:30, record:'第一车 03:12 盛港DC 已通过'},
    {no:'Y26070140037238',status:'booked', wh:'大巴窑DC',dc:'上门揽收',time:'2026-07-01 23:00–02:00',addr:'大巴窑 Toa Payoh Ind Park Lor 8 #01-05, Singapore',should:5,  inbound:0,  record:''},
  ];
  // 交货进度 · 按仓统计（新加坡事业部）
  const PROG=[
    {wh:'CKA新加坡履约中心',time:'06-30 23:00–02:00',should:33, printed:0,  delivered:0,  early:10,hasStation:false},
    {wh:'裕廊DC',          time:'06-30 23:00–02:00',should:304,printed:290,delivered:147,early:3, hasStation:true,
      stations:[['裕廊西区',180,170,90],['裕廊东区',84,80,42],['文礼区',40,40,15]]},
    {wh:'兀兰DC',          time:'06-30 23:00–02:00',should:403,printed:403,delivered:0,  early:0, hasStation:true,
      stations:[['兀兰中区',220,220,0],['三巴旺区',103,103,0],['义顺区',80,80,0]]},
    {wh:'盛港DC',          time:'06-30 23:00–02:00',should:3,  printed:3,  delivered:0,  early:0, hasStation:true,
      stations:[['盛港东区',2,2,0],['榜鹅区',1,1,0]]},
    {wh:'大巴窑DC',        time:'07-01 11:00–14:00',should:55, printed:55, delivered:12, early:5, hasStation:true,
      stations:[['大巴窑区',30,30,8],['碧山区',25,25,4]]},
  ];
  // 退货单
  const RET=[
    {id:'TKD2026070108266685',wh:'裕廊DC',  status:'待出库',qty:1,code:'460439',order:'2026-07-01 02:51',deadline:'2026-07-04 02:51'},
    {id:'TKD2026063008267496',wh:'兀兰DC',  status:'待运输',qty:2,code:'897236',order:'2026-06-30 09:12',deadline:'2026-07-03 09:12'},
    {id:'TKD2026062908314280',wh:'盛港DC',  status:'运输中',qty:1,code:'715187',order:'2026-06-29 09:04',deadline:'2026-07-02 09:04'},
    {id:'TKD2026062808299011',wh:'大巴窑DC',status:'已送达',qty:3,code:'330412',order:'2026-06-28 14:20',deadline:'2026-07-01 14:20'},
  ];
  const SG_WH=['裕廊DC','兀兰DC','盛港DC','大巴窑DC','淡滨尼DC','义顺DC'];
  const SLOTS=['23:00–02:00','02:00–05:00','06:00–10:00','11:00–14:00','16:00–20:00'];   // 预约送货可选时段
  // 各 DC 交货地点信息（详细地址 / 白夜班收货人 / 入门·卸货位置）——SG 本地，演示用
  const DC_META={
    '裕廊DC':{addr:'Jurong Wholesale Centre Blk 14 #02-12, Singapore 619502',day:['王志明 8123****7813','陈伟 8456****6567'],night:['林国强 9012****0250'],gate:'裕廊西门可进，卸货位置 2 号库 3 号闸口，只收不卸'},
    '兀兰DC':{addr:'Woodlands Ind Park E1 #01-08, Singapore 757710',day:['黄俊 8765****1122'],night:['李文 9033****3344'],gate:'兀兰北门进，8 号库 1 楼 9–11 号门'},
    '盛港DC':{addr:'Sengkang Logistics Hub #01-22, Singapore 545078',day:['吴成 8201****5566'],night:['/ 9111****1111'],gate:'东门可进，卸货 1 号平台，只收不卸'},
    '大巴窑DC':{addr:'Toa Payoh Ind Park Lor 8 #01-05, Singapore 319261',day:['许尚 8678****7788'],night:['史金超 9158****0250'],gate:'中门进，只收不卸'},
    '淡滨尼DC':{addr:'Tampines Logispark #01-30, Singapore 528790',day:['周强 8299****9900'],night:['郑凯 9088****2233'],gate:'A 门进，3 号卸货区'},
    '义顺DC':{addr:'Yishun Ind Park A #01-14, Singapore 768160',day:['马良 8322****4455'],night:['孙浩 9077****6677'],gate:'西门进，卸货 2 号库'},
  };
  // 每件体积（稳定伪随机，演示用，0.004–0.034 立方米/件）
  function volPer(name){let h=7;for(const c of String(name))h=(h*31+c.charCodeAt(0))>>>0;return 0.004+(h%300)/10000;}

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
  // 少货：仓库收货清点后回写实收数量（WMS 推送），实收 < 应送即为少货。判责结论不对商家展示，只展示实收与原因。
  function dvShort(d){return (d.demoLines||[]).some(l=>l.recvQty!=null&&l.recvQty<l.bookQty);}
  function dvShortQty(d){return (d.demoLines||[]).reduce((a,l)=>a+((l.recvQty!=null&&l.recvQty<l.bookQty)?(l.bookQty-l.recvQty):0),0);}
  // 平台补采：少货缺口由平台自营现货补货的数量（来自补采单）。未补货默认 0
  function dvRepl(d){return (typeof replByDelivery=='function')?replByDelivery(d.id):[];}
  function dvReplQty(d){return dvRepl(d).reduce((a,r)=>a+(+r.qty||0),0);}
  function dvReplSku(d,sku){return dvRepl(d).filter(r=>r.sku==sku).reduce((a,r)=>a+(+r.qty||0),0);}
  // 缺货罚款：来自独立的罚款单数据源，只要清点出缺口就有，与是否补采无关
  function dvFine(d){return ((DB.fineOrders||[]).find(f=>f.deliveryNo==d.id))||null;}
  function dvFineAmt(d){const f=dvFine(d);return f?+(f.items.reduce((a,x)=>a+x.qty,0)*f.rate).toFixed(2):0;}
  function dvFineSku(d,sku){const f=dvFine(d);if(!f)return 0;const it=f.items.find(x=>x.sku==sku);return it?+(it.qty*f.rate).toFixed(2):0;}
  function tabSign(){
    const DL=DB.deliveries||[];
    if(!DL.length) return `<div class="empty"><div class="e-ic">🚚</div><div class="e-t">暂无送货单</div><div class="e-s">在「打印标签」页打印<b>第一个标签</b>时，系统按<b>入库仓库</b>自动生成送货单。<br>可到「备货管理 → 打印标签」打印任一标签试试。</div></div>`;
    return `<div class="ib ib-b" style="margin-bottom:12px"><span class="i">📣</span><b>预约送货</b>与<b>仓库签到</b>相互独立：可先预约到仓时段，也可<b>不预约直接到仓签到</b>；签到后由仓库逐张核验交接入仓（标签到齐 → 订单转「待收货」）。</div>
    <div class="card"><div class="card-hd"><h3>送货单</h3><div class="row" style="gap:12px;align-items:center"><span class="sub">共 ${DL.length} 单 · 已预约 ${DL.filter(d=>d.booked).length} · 已签到 ${DL.filter(d=>d.signed||d.status=='交接完成').length} · 已入库 ${DL.filter(d=>d.status=='交接完成').length} · 已打印 ${DL.filter(d=>d.printed).length}</span><button class="btn btn-o btn-sm" onclick="deliv_toggleDemoCutoff()">🔬 ${DB.delivDemoPreCutoff?'演示中：未截单':'演示：切为未截单'}</button></div></div>
    <div class="card-bd flush"><div style="overflow-x:auto"><table>
      <thead><tr><th>送货单</th><th>预约状态</th><th>签到状态</th><th>入库仓库</th><th>送达时段</th><th>应送货 / 已入库</th><th>收货清点</th><th>操作</th></tr></thead><tbody>
      ${DL.map(d=>{if(d.booked===undefined)d.booked=false;if(d.signed===undefined)d.signed=(d.status=='已签到'||d.status=='交接完成');const done=d.status=='交接完成';
      const cf=dvCutoff(d);
      return `<tr>
        <td class="mono" style="white-space:nowrap">${d.id}<div style="font-size:11px;color:var(--ts);margin-top:2px">备货单 ${d.pickId}</div>${d.printed?`<div style="font-size:11px;color:var(--gd);margin-top:2px">🖨️ 已打印 ${d.printedAt||''}</div>`:''}</td>
        <td>${d.booked?`<span class="tag t-y"><span class="dot"></span>已预约</span><div style="font-size:11px;color:var(--ts);margin-top:2px">${d.bookWindow||d.window}</div>`:'<span class="tag t-gr"><span class="dot"></span>未预约</span>'}</td>
        <td>${done?'<span class="tag t-g"><span class="dot"></span>已入库</span>':(d.signed?'<span class="tag t-b"><span class="dot"></span>已签到</span>':'<span class="tag t-gr"><span class="dot"></span>未签到</span>')}</td>
        <td><b>${d.warehouse}</b><div style="font-size:11px;color:var(--ts);margin-top:2px">${d.orderIds.length} 单</div></td>
        <td>${d.deliver}<div style="font-size:11px;color:var(--ts)">${d.window}</div></td>
        <td><b style="font-size:15px">${dvShould(d)}</b> <span style="color:var(--ts)">/ ${dvIn(d)}</span></td>
        <td>${done?(dvShort(d)
          ?`<span class="tag t-r"><span class="dot"></span>少货 ${dvShortQty(d)}</span><div style="font-size:11px;color:var(--ts);margin-top:2px">平台补采 <b style="color:var(--gold)">${dvReplQty(d)}</b> 件</div>${dvFineAmt(d)>0?`<div style="font-size:11px;color:var(--r);margin-top:2px">罚款 ${money(dvFineAmt(d))}</div>`:''}`
          :'<span class="tag t-g"><span class="dot"></span>足额收货</span><div style="font-size:11px;color:var(--ts);margin-top:2px">平台补采 0 件</div>')
          :'<span style="color:var(--ts);font-size:12px">待清点</span>'}${(typeof whrOfDelivery=='function'&&whrOfDelivery(d.id).length)?`<div style="margin-top:4px">${whrOfDelivery(d.id).some(r=>r.type=='送错')?'<span class="tag t-r" style="font-size:10.5px"><span class="dot"></span>有错货</span>':''}${whrOfDelivery(d.id).some(r=>r.type=='送多')?'<span class="tag t-y" style="font-size:10.5px"><span class="dot"></span>有多货</span>':''}</div>`:''}</td>
        <td style="white-space:nowrap">${done
          ?`<button class="btn btn-o btn-sm" onclick="deliv_signDetail('${d.id}')">查看详情</button>`
          :`${cf.passed
              ?`<button class="btn btn-p btn-sm" onclick="deliv_print('${d.id}')">${d.printed?'重新打印':'打印'}</button>`
              :`<button class="btn btn-o btn-sm" disabled style="opacity:.42;cursor:not-allowed" title="未到营业截单时间 ${cf.at}${cf.wd?'（'+cf.wd+'）':''}，截单后送货单内容才固定，届时可打印">打印</button>`
            } ${d.signed?'<span style="font-size:11.5px;color:var(--ts);margin:0 4px">已签到 · 待仓库交接</span>':`${d.booked?`<button class="btn btn-o btn-sm" onclick="deliv_book('${d.id}')">改约</button> <button class="btn btn-link btn-sm" style="color:var(--r)" onclick="deliv_cancelBook('${d.id}')">取消预约</button>`:`<button class="btn btn-o btn-sm" onclick="deliv_book('${d.id}')">预约送货</button>`} <button class="btn btn-o btn-sm" onclick="deliv_signQR('${d.id}')">签到码</button>`} <button class="btn btn-o btn-sm" onclick="deliv_signDetail('${d.id}')">详情</button>`}</td>
      </tr>`;}).join('')}
      </tbody></table></div></div></div>`;
  }
  window.deliv_togglePrivacy=function(){DB.delivShareItems=!DB.delivShareItems;render();toast(DB.delivShareItems?'已允许对方查看商品清单':'已关闭商品清单查看','info');};
  function dvGet(id){return (DB.deliveries||[]).find(x=>x.id==id);}

  /* ============================================================
     送货单打印（截单后可打印，打印纸含签到二维码）
     口径：送货单内容在【营业截单】后才固定——截单前客户仍可下单/改单，
     打印出来的明细会作废，故截单前打印按钮置灰。
     截单时刻 = 送达日【前一日】的营业截止时间（bizCfg 当日 end 即当日截单时间，
     取不到星期时回退平台公共截单时间 platformCutoff），生成送货单时快照。
  ============================================================ */
  const WD=['周日','周一','周二','周三','周四','周五','周六'];
  // 'MM-DD' → 前一日的 {date:'MM-DD', wd:'周X'}（原型 mock 无年份，按 2026 年推算）
  function prevBizDay(mmdd){
    if(!mmdd)return null;
    const m=String(mmdd).match(/(\d{1,2})-(\d{1,2})/); if(!m)return null;
    const dt=new Date(2026,+m[1]-1,+m[2]); dt.setDate(dt.getDate()-1);
    const pad=n=>String(n).padStart(2,'0');
    return {date:pad(dt.getMonth()+1)+'-'+pad(dt.getDate()), wd:WD[dt.getDay()], js:dt};
  }
  window.dvCutoff=function(d){
    const b=DB.bizCfg||{}, prev=prevBizDay(d.deliver);
    let end=b.platformCutoff||'18:00', wd='';
    if(prev&&b.week){const row=b.week.find(x=>x.d==prev.wd); wd=prev.wd; if(row&&row.on&&row.end)end=row.end;}
    const at=prev?`${prev.date} ${end}`:'—';
    // 演示开关：强制视为「未截单」，便于查看禁用态
    if(DB.delivDemoPreCutoff)return {at,wd,end,passed:false};
    let passed=true;
    if(prev){const [hh,mm]=end.split(':').map(Number);const c=new Date(prev.js);c.setHours(hh||0,mm||0,0,0);passed=Date.now()>=c.getTime();}
    return {at,wd,end,passed};
  };
  window.deliv_toggleDemoCutoff=function(){DB.delivDemoPreCutoff=!DB.delivDemoPreCutoff;render();
    toast(DB.delivDemoPreCutoff?'演示：已切为「未截单」——打印按钮置灰':'演示：已切回「已截单」——可打印送货单','info');};

  // 打印纸上的商品明细：按 SKU 聚合标签
  function dvItems(d){
    const map={};
    (d.labels||[]).forEach(p=>{const k=p.code+'|'+p.name+'|'+p.unit;
      if(!map[k])map[k]={code:p.code,name:p.name,unit:p.unit,qty:0,tags:0};
      map[k].qty+=(p.qty||0); map[k].tags++;});
    return Object.values(map);
  }

  window.deliv_print=function(id){
    const d=dvGet(id); if(!d)return;
    const cf=dvCutoff(d);
    if(!cf.passed){toast(`未到营业截单时间（${cf.at}），送货单内容可能还会变动，暂不可打印`,'err');return;}
    const items=dvItems(d), totalQty=items.reduce((a,x)=>a+x.qty,0);
    const now=new Date(),pad=n=>String(n).padStart(2,'0');
    const printedAt=`${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
    const row=(k,v)=>`<tr><td style="padding:5px 10px 5px 0;color:#555;white-space:nowrap;width:96px">${k}</td><td style="padding:5px 0;font-weight:600">${v}</td></tr>`;
    modalWide(`<div class="mc-hd"><h3>打印送货单 · ${d.id}</h3><p>纸张 A4 · 含<b>送货签到二维码</b>，到仓出示本单由仓库扫码签到</p><button class="mc-x" onclick="closeModal()">×</button></div>
    <div class="mc-bd" style="background:var(--bd2);padding:18px">
      <!-- 打印纸预览（A4 比例） -->
      <div id="dv-paper" style="background:#fff;padding:26px 30px;border:1px solid var(--bd);border-radius:4px;max-width:720px;margin:0 auto;color:#111">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #111;padding-bottom:12px;margin-bottom:16px">
          <div>
            <div style="font-size:21px;font-weight:800;letter-spacing:.5px">Food Max 送货单</div>
            <div style="font-size:11.5px;color:#666;margin-top:2px;letter-spacing:1px">DELIVERY NOTE</div>
            <div style="font-size:19px;font-weight:700;margin-top:10px;font-family:ui-monospace,monospace">${d.id}</div>
          </div>
          <div style="text-align:center">
            ${qrBlock(d.id,116)}
            <div style="font-size:11px;font-weight:700;margin-top:6px">送货签到码</div>
            <div style="font-size:10px;color:#666;margin-top:1px">到仓由仓库扫码签到</div>
          </div>
        </div>
        <table style="width:100%;font-size:12.5px;margin-bottom:16px"><tbody>
          ${row('商家',(DB.merchant&&DB.merchant.name)||'绿鲜源蔬果')+row('备货单号',d.pickId||'—')}
          ${row('入库仓库',d.warehouse)+row('送达时段',`${d.deliver} ${d.window||''}`)}
          ${row('预约时段',d.booked?(d.bookWindow||d.window):'未预约（可直接到仓签到）')}
          ${row('营业截单',`${cf.at}${cf.wd?`（${cf.wd}）`:''} · 已截单`)}
          ${row('应送 / 订单',`${dvShould(d)} 张标签 · ${d.orderIds.length} 个订单`)}
        </tbody></table>
        <div style="font-size:12.5px;font-weight:700;margin-bottom:6px">商品明细</div>
        <table style="width:100%;font-size:12px;border-collapse:collapse">
          <thead><tr style="background:#F3F4F6">
            <th style="text-align:left;padding:6px 8px;border:1px solid #ddd;width:34px">#</th>
            <th style="text-align:left;padding:6px 8px;border:1px solid #ddd">SKU 编码</th>
            <th style="text-align:left;padding:6px 8px;border:1px solid #ddd">商品名称</th>
            <th style="text-align:right;padding:6px 8px;border:1px solid #ddd;width:76px">数量</th>
            <th style="text-align:right;padding:6px 8px;border:1px solid #ddd;width:70px">标签数</th>
          </tr></thead>
          <tbody>${items.length?items.map((x,i)=>`<tr>
            <td style="padding:6px 8px;border:1px solid #ddd">${i+1}</td>
            <td style="padding:6px 8px;border:1px solid #ddd;font-family:ui-monospace,monospace">${x.code}</td>
            <td style="padding:6px 8px;border:1px solid #ddd">${x.name}</td>
            <td style="padding:6px 8px;border:1px solid #ddd;text-align:right">${x.qty} ${x.unit}</td>
            <td style="padding:6px 8px;border:1px solid #ddd;text-align:right">${x.tags}</td>
          </tr>`).join(''):`<tr><td colspan="5" style="padding:14px;border:1px solid #ddd;text-align:center;color:#888">暂无标签明细</td></tr>`}
          <tr style="background:#FAFAFA;font-weight:700">
            <td colspan="3" style="padding:6px 8px;border:1px solid #ddd">合计</td>
            <td style="padding:6px 8px;border:1px solid #ddd;text-align:right">${totalQty}</td>
            <td style="padding:6px 8px;border:1px solid #ddd;text-align:right">${dvShould(d)}</td>
          </tr></tbody>
        </table>
        <div style="display:flex;gap:24px;margin-top:22px;font-size:12px;color:#333">
          <div style="flex:1;border-top:1px solid #999;padding-top:6px">送货人签字</div>
          <div style="flex:1;border-top:1px solid #999;padding-top:6px">仓库收货签字</div>
          <div style="flex:1;border-top:1px solid #999;padding-top:6px">日期</div>
        </div>
        <div style="margin-top:14px;font-size:10.5px;color:#888;border-top:1px dashed #ccc;padding-top:8px">
          打印时间 ${printedAt}　|　本单据由 Food Max 商家后台生成，仅供到仓交接使用
        </div>
      </div>
    </div>
    <div class="mc-ft"><button class="btn btn-o" onclick="closeModal()">取消</button><button class="btn btn-p" onclick="deliv_doPrint('${d.id}')">🖨️ 打印</button></div>`);
  };
  window.deliv_doPrint=function(id){const d=dvGet(id);if(!d)return;
    d.printed=true; d.printedAt=d.printedAt||new Date().toLocaleString('zh-CN',{hour12:false}).slice(5,16);
    closeModal(); render(); toast(`${id} 送货单已打印（含签到二维码），到仓出示本单由仓库扫码签到`,'ok');};

  window.deliv_signQR=function(id){const d=dvGet(id);if(!d)return;
    modal(`<div class="mc-hd"><h3>送货签到码 · ${d.warehouse}</h3><p>送货单 ${d.id} · 备货单 ${d.pickId}</p><button class="mc-x" onclick="closeModal()">×</button></div><div class="mc-bd">
      <div class="kv" style="margin-bottom:14px"><div><div class="k">入库仓库</div><div class="v">${d.warehouse}</div></div><div><div class="k">送达时段</div><div class="v" style="font-size:13px">${d.deliver} ${d.window}</div></div><div><div class="k">应送货</div><div class="v">${dvShould(d)} 张</div></div><div><div class="k">订单数</div><div class="v">${d.orderIds.length}</div></div></div>
      <div class="ib ib-b" style="margin-bottom:10px"><span class="i">ℹ️</span>到仓<b>出示此码</b>，由<b>仓库人员扫码确认签到</b>——商家端不做签到操作。</div>
      <div style="background:var(--gl);border-radius:12px;padding:18px 0 14px;text-align:center;margin-bottom:6px">
        <div style="font-weight:700;margin-bottom:12px">送货签到码</div>${qrBlock(d.id)}
        <div style="font-size:12px;color:var(--ts);margin-top:12px">仓库扫码签到后，逐张核验交接入仓</div></div>
    </div><div class="mc-ft"><button class="btn btn-o" onclick="closeModal()">关闭</button><button class="btn btn-o" onclick="deliv_doSign('${d.id}')">🔬 演示：模拟仓库扫码签到</button></div>`);
  };
  // 签到由【仓库人员扫码】确认——商家端只出示签到码、不做签到操作。此处为【演示】模拟仓库扫码；与预约相互独立(未预约也可被扫码签到)
  window.deliv_doSign=function(id){const d=dvGet(id);if(!d)return;d.signed=true;d.signTime=d.signTime||'00:12';closeModal();render();toast(`${id} 仓库已扫码确认签到${d.booked?'':'（未预约·直接到仓签到）'}，可逐张核验交接入仓`,'ok');};
  // 预约送货：选到仓时段（与签到解耦）
  window.deliv_book=function(id){const d=dvGet(id);if(!d)return;
    modal(`<div class="mc-hd"><h3>${d.booked?'改约送货':'预约送货'} · ${d.warehouse}</h3><p>送货单 ${d.id}</p><button class="mc-x" onclick="closeModal()">×</button></div>
    <div class="mc-bd"><div class="ib ib-b"><span class="i">📅</span>预约到仓送货时段。<b>预约与签到相互独立</b>——未预约也可到仓直接签到。</div>
      <div class="fr"><label class="fl">送达日期</label><input value="${d.deliver}" readonly style="background:#F3F4F6;color:var(--ts)"></div>
      <div class="fr"><label class="fl">预约时段</label><select id="bk-slot">${SLOTS.map(s=>`<option ${(d.bookWindow||d.window)==s?'selected':''}>${s}</option>`).join('')}</select></div>
    </div><div class="mc-ft"><button class="btn btn-o" onclick="closeModal()">取消</button><button class="btn btn-p" onclick="deliv_doBook('${d.id}')">${d.booked?'确认改约':'确认预约'}</button></div>`);};
  window.deliv_doBook=function(id){const d=dvGet(id);if(!d)return;d.booked=true;d.bookWindow=(document.getElementById('bk-slot')||{}).value||d.window;closeModal();render();toast(`${id} 已预约送货 ${d.bookWindow}`,'ok');};
  window.deliv_cancelBook=function(id){const d=dvGet(id);if(!d)return;askConfirm(`确认取消 ${id} 的送货预约？取消后仍可到仓直接签到。`,()=>{d.booked=false;d.bookWindow='';render();toast('已取消预约','info');});};
  // 交接入仓：真实由【仓库端 WMS 扫码】逐张核验标签到齐 → 送货单「交接完成」→ 关联订单转「待收货」。
  // 商家后台不做此动作；此处为【演示】模拟仓库扫齐全部标签后交接（调用主文件 deliveryHandover）。
  window.deliv_handover=function(id){const d=dvGet(id);if(!d)return;(d.labels||[]).forEach(l=>l.arrived=true);deliveryHandover(id);render();toast(`【演示】仓库已扫码交接 ${id}，${d.orderIds.length} 个订单转「待收货」`,'ok');};
  /* ---------- 送货单详情（整页 · 快驴样式三段式）---------- */
  window.deliv_open=function(id){DB.delivView=id;render();window.scrollTo(0,0);};
  window.deliv_closeDetail=function(){DB.delivView=null;render();};
  window.deliv_signDetail=window.deliv_open;   // 兼容旧调用
  function kvItem(k,v){return `<div style="min-width:0"><div style="font-size:12px;color:var(--ts);margin-bottom:4px">${k}</div><div style="font-size:13.5px;color:var(--tp);font-weight:500;word-break:break-word">${v||'—'}</div></div>`;}
  function secBar(t,tag){return `<div style="display:flex;align-items:center;gap:10px;margin:2px 0 16px"><span style="width:4px;height:16px;background:var(--g);border-radius:2px"></span><h3 style="font-size:15px;font-weight:700">${t}</h3>${tag||''}</div>`;}
  // 商品明细行：demo 单直接用 demoLines（已入库量按状态联动）；真实单由 orderIds→lines 聚合并从商品主数据补全
  function dvDetailLines(d){
    const inbound=d.status=='交接完成';
    // recvQty = 仓库收货清点回写的实收数量（未清点为 null）；足额时 = 预约数量
    if(d.demoLines) return d.demoLines.map(l=>({...l,inQty:inbound?(l.recvQty!=null?l.recvQty:l.bookQty):0,recvQty:inbound?(l.recvQty!=null?l.recvQty:l.bookQty):null}));
    const map={};
    (d.orderIds||[]).forEach(oid=>{const o=DB.orders.find(x=>x.id==oid);if(!o)return;(o.lines||[]).forEach(l=>{const k=l.sku;if(!map[k])map[k]={sku:l.sku,name:l.name,unit:l.unit,qty:0};map[k].qty+=l.qty;});});
    return Object.values(map).map(r=>{const p=DB.products.find(x=>x.name==r.name);const spec=p&&p.skus&&p.skus[0]?`${p.skus[0].qty}${p.unit}/${r.unit||'件'}`:'—';return {sku:r.sku,name:r.name,brand:(p&&p.brand)||'无',spec,skuUnit:r.unit||'件',box:1,orderQty:r.qty,bookQty:r.qty,inQty:inbound?r.qty:0,recvQty:inbound?r.qty:null,packQty:r.qty,vol:+(volPer(r.name)*r.qty).toFixed(6)};});
  }
  function detailPage(d){
    const meta=DC_META[d.warehouse]||{};const lines=dvDetailLines(d);const inbound=d.status=='交接完成';
    const dash=v=>(v===undefined||v===null||v==='')?'—':v;
    const bkChip=d.booked?'<span class="tag t-y"><span class="dot"></span>已预约</span>':'<span class="tag t-gr"><span class="dot"></span>未预约</span>';
    const sgChip=inbound?'<span class="tag t-g"><span class="dot"></span>已入库</span>':(d.signed?'<span class="tag t-b"><span class="dot"></span>已签到</span>':'<span class="tag t-gr"><span class="dot"></span>未签到</span>');
    return `
    <div class="row" style="align-items:center;gap:10px;margin-bottom:14px;flex-wrap:wrap">
      <button class="btn btn-o btn-sm" onclick="deliv_closeDetail()">← 返回送货单列表</button>
      <span class="mono" style="font-weight:700">${d.id}</span>${bkChip}${sgChip}
    </div>
    <div class="card" style="margin-bottom:14px"><div class="card-bd" style="padding:18px 22px">
      ${secBar('单据信息')}
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px 40px">
        ${kvItem('送货单号',`<span class="mono">${d.id}</span>`)}
        ${kvItem('来源单号（备货单）',`<span class="mono">${dash(d.pickId)}</span>`)}
        ${kvItem('入库仓库',dash(d.warehouse))}
        ${kvItem('送达时段',`${d.deliver} ${dash(d.window)}`)}
        ${kvItem('应送货',`${dvShould(d)} 件`)}
        ${kvItem('已入库',`${dvIn(d)} 件`)}
        ${kvItem('预约时间',d.booked?`${d.deliver} ${d.bookWindow||d.window}`:'未预约')}
        ${kvItem('签到时间',(d.signed||inbound)?`${d.deliver} ${d.signTime||'00:12'} 仓库扫码确认`:'未签到')}
        ${kvItem('交接时间',inbound?`${d.deliver} 已交接入仓`:'未交接')}
        ${kvItem('收货清点时间',inbound?(d.receiptTime||`${d.deliver} 已清点`):'未清点')}
        ${kvItem('收货结果',inbound?(dvShort(d)?`<span class="tag t-r"><span class="dot"></span>少货 ${dvShortQty(d)} 件</span>`:'<span class="tag t-g"><span class="dot"></span>足额收货</span>'):'待清点')}
        ${kvItem('平台补采',inbound?`<b style="color:${dvReplQty(d)>0?'var(--gold)':'var(--ts)'}">${dvReplQty(d)}</b> 件${dvReplQty(d)>0?`（缺口由平台自营现货补齐）`:'（无需补采）'}`:'0 件')}
        ${kvItem('缺货罚款',inbound?(dvFineAmt(d)>0?`<b style="color:var(--r)">${money(dvFineAmt(d))}</b><div style="font-size:11px;color:var(--ts);margin-top:2px">${dvFine(d).items.reduce((a,x)=>a+x.qty,0)} 件 × ${money(dvFine(d).rate)}/件 · 单号 <span class="mono">${dvFine(d).no}</span></div>`:'<span style="color:var(--ts)">无</span>'):'—')}
      </div>
    </div></div>
    ${(inbound&&dvShort(d))?(()=>{const rs=(typeof replByDelivery=='function')?replByDelivery(d.id):[];
      return `<div class="ib ${rs.length?'ib-y':'ib-r'}" style="margin-bottom:14px"><span class="i">${rs.length?'🔁':'⚠️'}</span><div>
        本单收货清点<b>少货 ${dvShortQty(d)} 件</b>。${rs.length
          ?`缺口已由平台<b>自营现货全额补齐</b>，客户订单未受影响（商品/金额/发票不变），已生成平台补采单 ${rs.map(r=>`<span class="mono">${r.no}</span>`).join('、')}——按<b>自营商品原定价</b>计价（<b>不加价</b>），在结算单中抵扣。`
          :`自营现货不足以全额覆盖缺口，本单按<b>实收数量</b>出库并标缺货，<b>不生成平台补采单</b>。`}
        ${dvFineAmt(d)>0?`<br>另按缺货计<b>罚款 ${money(dvFineAmt(d))}</b>（${dvFine(d).items.reduce((a,x)=>a+x.qty,0)} 件 × ${money(dvFine(d).rate)}/件，单号 <span class="mono">${dvFine(d).no}</span>）——<b>罚款与是否补采无关，只要清点出缺口就计</b>。`:''}
        <br>${rs.length?`<button class="btn btn-link" style="padding-left:0" onclick="nav('m-replenish')">查看平台补采单 →</button>`:''}${dvFineAmt(d)>0?`<button class="btn btn-link" ${rs.length?'':'style="padding-left:0"'} onclick="nav('m-fine')">查看罚款单 →</button>`:''}
        <br><span style="color:var(--ts)">对实收数量有异议请<b>线下联系平台运营</b>核对（可调取仓库收货监控），本期不设线上申诉入口。</span>
      </div></div>`;})():''}
    ${(meta.addr||(meta.day&&meta.day[0]))?`<div class="card" style="margin-bottom:14px"><div class="card-bd" style="padding:18px 22px">
      ${secBar('交货地点信息')}
      <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:16px 40px">
        ${kvItem('入库仓库',dash(d.warehouse))}
        ${kvItem('详细地址',dash(meta.addr))}
        ${kvItem('送货联系人',dash(meta.day&&meta.day[0]?meta.day[0].split(' ')[0]:''))}
        ${kvItem('联系电话',dash(meta.day&&meta.day[0]?(meta.day[0].split(' ')[1]||''):''))}
      </div>
    </div></div>`:''}
    ${(typeof whrOfDelivery=='function'&&whrOfDelivery(d.id).length)?`<div class="card" style="margin-bottom:14px"><div class="card-hd"><h3>多货 / 错货 · 待退回</h3><span class="sub">${[...new Set(whrOfDelivery(d.id).map(x=>x.type))].map(t=>`${t} ${whrOfDelivery(d.id).filter(x=>x.type==t).reduce((a,x)=>a+x.qty,0)}${whrOfDelivery(d.id).find(x=>x.type==t).unit}`).join(' · ')} · 仓库已登记台账并留存照片，请线下取回；不计入结算</span></div><div class="card-bd flush"><div style="overflow-x:auto"><table>
      <thead><tr><th>商品</th><th>类型</th><th style="text-align:right">数量</th><th>存放库位</th><th>登记时间</th><th>凭证</th><th>状态</th></tr></thead><tbody>
      ${whrOfDelivery(d.id).map(r=>`<tr>
        <td style="white-space:nowrap"><b>${r.name}</b><div style="font-size:11px;color:var(--ts);margin-top:2px">${r.skuCode} · ${r.spec}</div></td>
        <td><span class="tag ${r.type=='送错'?'t-r':'t-y'}" style="font-size:10.5px"><span class="dot"></span>${r.type}</span>${r.note?`<div style="font-size:11px;color:var(--ts);margin-top:2px;white-space:normal;max-width:180px">${r.note}</div>`:''}</td>
        <td style="text-align:right"><b>${r.qty}</b> ${r.unit}</td>
        <td class="mono" style="font-size:12px">${r.slot}</td>
        <td style="font-size:12px;color:var(--ts);white-space:nowrap">${r.registeredAt}</td>
        <td><button class="btn btn-link btn-sm" onclick="whr_photos('${r.deliveryNo}','${r.skuCode}')">📷 ${r.photos} 张</button></td>
        <td style="white-space:nowrap">${r.status=='已取回'?'<span class="tag t-g"><span class="dot"></span>已取回</span>':'<span class="tag t-b"><span class="dot"></span>待取回</span>'}</td>
      </tr>`).join('')}
      </tbody></table></div>
      <div class="card-bd" style="border-top:1px solid var(--bd2);font-size:12.5px;color:var(--ts)">多货/错货<b>不新增单据、不产生结算</b>，沿用本送货单标记；也可在「售后管理 › 退货单 › 仓库退回」统一查看。<button class="btn btn-link" style="padding-left:4px" onclick="DB.retSrcTab='wh';nav('m-after-return')">前往 →</button></div>
    </div></div>`:''}
    <div class="card"><div class="card-hd"><h3>商品明细</h3><span class="sub">共 ${lines.length} 个 SKU · 按 SKU 聚合</span></div><div class="card-bd flush"><div style="overflow-x:auto"><table>
      <thead><tr><th>序号</th><th>SKU编码</th><th>商品名称</th><th>规格</th><th style="text-align:right">下单数量</th><th style="text-align:right">本次预约数量</th><th style="text-align:right">实收数量（收货清点）</th><th style="text-align:right">差异</th><th style="text-align:right">平台补采</th><th style="text-align:right">缺货罚款</th></tr></thead><tbody>
      ${lines.map((r,i)=>{const diff=(r.recvQty==null)?null:(r.recvQty-r.bookQty);
        return `<tr><td>${i+1}</td><td class="mono">${r.sku}</td><td><b>${r.name}</b></td><td>${r.spec}</td><td style="text-align:right">${r.orderQty}</td><td style="text-align:right">${r.bookQty}</td>
        <td style="text-align:right;${r.recvQty==null?'color:var(--ts)':(diff<0?'color:var(--r);font-weight:600':'color:var(--gd);font-weight:600')}">${r.recvQty==null?'待清点':r.recvQty}</td>
        <td style="text-align:right;${diff<0?'color:var(--r);font-weight:600':'color:var(--ts)'}">${diff==null?'—':(diff<0?diff:'0')}</td>
        <td style="text-align:right;${dvReplSku(d,r.sku)>0?'color:var(--gold);font-weight:600':'color:var(--ts)'}">${dvReplSku(d,r.sku)}</td>
        <td style="text-align:right;${dvFineSku(d,r.sku)>0?'color:var(--r);font-weight:600':'color:var(--ts)'}">${dvFineSku(d,r.sku)>0?'-'+money(dvFineSku(d,r.sku)):'—'}</td></tr>`;}).join('')||`<tr><td colspan="10" style="text-align:center;color:var(--ts);padding:18px">本单无商品明细</td></tr>`}
      </tbody></table></div>
      <div class="card-bd" style="border-top:1px solid var(--bd2);font-size:12.5px;color:var(--ts)">实收数量由仓库<b>收货清点</b>后由 WMS 实时回写，商家端只读。少货部分<b>不冲减客户订单</b>，也不下调你的 GMV 与佣金。<b>平台补采</b>＝该 SKU 缺口由平台自营现货补齐的数量（未补为 0），按<b>自营商品原定价</b>在结算单中抵扣；<b>缺货罚款</b>＝该 SKU 缺口件数 × 罚款标准，<b>与是否补采无关</b>，两者各自独立进结算单。</div></div>
      ${(d.signed&&!inbound)?`<div class="card-bd" style="padding:12px 16px;border-top:1px solid var(--bd2)"><button class="btn btn-link" onclick="deliv_handover('${d.id}')">🔬 演示：模拟仓库扫码交接（标签到齐 → 已入库）</button></div>`:''}
    </div>`;
  }
  // 送货单不再预置，改为「打印第一个标签时自动生成」（见 window.genDeliveryOnPrint，由打印标签页触发）
  function ensureDeliveriesDemo(){DB.deliveries=DB.deliveries||[];
    if(DB._delivSeeded)return;DB._delivSeeded=true;   // 预置演示送货单，覆盖 预约/签到 解耦的各种态
    // 行：[SKU, 名称, 规格, 预约数量, 实收数量(可选·仓库收货清点回写)]
    const dl=rows=>rows.map(r=>({sku:r[0],name:r[1],brand:'绿鲜源',spec:r[2],skuUnit:'件',box:1,orderQty:r[3],bookQty:r[3],packQty:r[3],recvQty:(r[4]==null?null:r[4]),vol:+(0.012*r[3]).toFixed(4)}));
    const lbl=n=>Array.from({length:n}).map((_,i)=>({code:'LBL-'+i,arrived:false}));
    const lblA=(n,a)=>Array.from({length:n}).map((_,i)=>({code:'LBL-'+i,arrived:i<a}));   // 已入库 a 张（= 实收）
    DB.deliveries.push(
      {id:'SH20260701001',pickId:'JH20260701001',warehouse:'裕廊DC',deliver:'07-01',window:'06:00–10:00',orderIds:['#SG20260701001'],labels:lbl(30),status:'待送货',bizType:'预售品',booked:true,bookWindow:'23:00–02:00',signed:false,demoLines:dl([['SKU8801','小棠菜','1kg/件',20],['SKU8802','白菜','1kg/件',10]])},
      {id:'SH20260701002',pickId:'JH20260701002',warehouse:'兀兰DC',deliver:'07-01',window:'06:00–10:00',orderIds:['#SG20260701002'],labels:lbl(30),status:'待送货',bizType:'预售品',booked:false,signed:true,demoLines:dl([['SKU8804','空心菜','1kg/件',30]])},
      {id:'SH20260628003',pickId:'JH20260628003',warehouse:'盛港DC',deliver:'06-28',window:'12:00–16:00',orderIds:['#SG20260628003'],labels:lbl(12),status:'待送货',bizType:'预售品',booked:false,signed:false,demoLines:dl([['SKU8803','菠菜','1kg/件',12]])},
      // ↓ 已入库并完成收货清点：少货部分由平台自营现货补货，对应「财务 › 平台补采」的补采单
      {id:'SH20260628004',pickId:'JH20260628004',warehouse:'盛港DC',deliver:'06-28',window:'02:00–05:00',orderIds:['#SG20260628011'],labels:lblA(35,30),status:'交接完成',bizType:'预售品',booked:true,bookWindow:'02:00–05:00',signed:true,signTime:'00:52',receiptTime:'2026-06-28 01:06',demoLines:dl([['SKU8801','小棠菜','1kg/件',20,18],['SKU8805','菜心','1kg/件',15,12]])},
      {id:'SH20260629005',pickId:'JH20260629005',warehouse:'兀兰DC',deliver:'06-29',window:'02:00–05:00',orderIds:['#SG20260629004'],labels:lblA(30,22),status:'交接完成',bizType:'预售品',booked:true,bookWindow:'02:00–05:00',signed:true,signTime:'02:41',receiptTime:'2026-06-29 03:24',demoLines:dl([['SKU8804','空心菜','1kg/件',30,22]])},
      {id:'SH20260701008',pickId:'JH20260701008',warehouse:'淡滨尼DC',deliver:'07-01',window:'02:00–05:00',orderIds:['#SG20260701015'],labels:lblA(25,20),status:'交接完成',bizType:'预售品',booked:true,bookWindow:'02:00–05:00',signed:true,signTime:'02:10',receiptTime:'2026-07-01 02:40',demoLines:dl([['SKU8807','芥蓝','1kg/件',25,20]])},
      {id:'SH20260522001',pickId:'JH20260522001',warehouse:'盛港DC',deliver:'05-22',window:'12:00–16:00',orderIds:['#SG20260522006'],labels:lblA(12,10),status:'交接完成',bizType:'预售品',booked:true,bookWindow:'12:00–16:00',signed:true,signTime:'12:20',receiptTime:'2026-05-22 13:42',demoLines:dl([['SKU8803','菠菜','1kg/件',12,10]])},
      {id:'SH20260518001',pickId:'JH20260518001',warehouse:'裕廊DC',deliver:'05-18',window:'23:00–02:00',orderIds:['#SG20260518009'],labels:lblA(60,48),status:'交接完成',bizType:'预售品',booked:true,bookWindow:'23:00–02:00',signed:true,signTime:'01:35',receiptTime:'2026-05-18 02:18',demoLines:dl([['SKU8811','鲜鸡蛋','30枚/盘',60,48]])}
    );}
  window.ensureDeliveriesDemo=ensureDeliveriesDemo;
  // 打印标签触发：某(配送日期+入库仓库)首次打印标签时，按该仓待发货订单自动生成一张送货单（一仓一张，已存在则不重复）
  window.genDeliveryOnPrint=function(date,wh){
    DB.deliveries=DB.deliveries||[];
    if(!wh) return null;
    if(DB.deliveries.some(d=>d.deliver==date&&d.warehouse==wh)) return null;
    const os=DB.orders.filter(o=>(o.status=='pending'||o.status=='packed')&&o.deliver==date&&o.warehouse==wh);
    if(!os.length) return null;
    const id='SH2026'+String(date).replace(/-/g,'')+String(++DB.deliverySeq).padStart(3,'0');
    const labels=[];os.forEach(o=>(o.lines||[]).forEach(l=>labels.push({code:`LBL-${o.id.slice(-5)}-${l.sku.slice(-4)}`,name:l.name,qty:l.qty,unit:l.unit,arrived:false,orderId:o.id})));
    DB.deliveries.push({id,pickId:'JH2026'+String(date).replace(/-/g,'')+'001',warehouse:wh,deliver:date,window:(os[0].deliverWindow||''),orderIds:os.map(o=>o.id),labels,status:'待送货',bizType:'预售品'});
    return id;
  };
  window.deliv_forward=function(id){const d=dvGet(id);if(!d)return;
    modal(`<div class="mc-hd"><h3>转发送货单 · ${d.warehouse}</h3><p>送货单 ${d.id}</p><button class="mc-x" onclick="closeModal()">×</button></div><div class="mc-bd">
      <div class="ib ib-b"><span class="i">🚚</span>把送货单转发给送货司机，司机可签到并实时查看交货进度。</div>
      <div style="background:var(--gl);border-radius:12px;padding:16px 0;text-align:center;margin:6px 0 12px">${qrBlock(d.id+'F',140)}<div style="font-size:12px;color:var(--ts);margin-top:10px">司机微信扫码接收</div></div>
      <div class="fr" style="display:flex;align-items:center;justify-content:space-between"><label class="fl" style="margin:0">转发隐私 · 允许查看商品清单</label><input type="checkbox" style="width:auto" ${DB.delivShareItems?'checked':''} onchange="DB.delivShareItems=this.checked"></div>
    </div><div class="mc-ft"><button class="btn btn-o" onclick="closeModal()">取消</button><button class="btn btn-p" onclick="closeModal();toast('转发链接已复制，可发送给司机','ok')">复制转发链接</button></div>`);
  };

  /* ============================================================
     仓库退回（多货 / 错货）—— 2026-08-12 会议：不新增单据、不新增单号，
     沿用原送货单在单据上标记「送多 / 送错」的商品，推商家端做取货通知，
     商家线下与仓库约时间取回。仓库侧：手工台账 + 多角度照片 + 专属虚拟库位。
     该数据同时喂给「售后管理 › 退货单 › 仓库退回」Tab。
  ============================================================ */
  // 行标识 = 送货单号 × SKU（无独立单号）
  DB.whReturns = DB.whReturns || [
    {deliveryNo:'SH20260628004',warehouse:'盛港DC',skuCode:'SKU8899',name:'上海青',spec:'1kg/件',unit:'件',
     type:'送错',qty:6,photos:3,slot:'SG-VIRT-01',registeredAt:'2026-06-28 01:22',status:'待取回',pickedAt:'',
     note:'与本单小棠菜串货，实物为上海青'},
    {deliveryNo:'SH20260628004',warehouse:'盛港DC',skuCode:'SKU8802',name:'白菜',spec:'1kg/件',unit:'件',
     type:'送多',qty:3,photos:2,slot:'SG-VIRT-01',registeredAt:'2026-06-28 01:25',status:'待取回',pickedAt:'',
     note:'实收 23，超出应送 20 共 3 件'},
    {deliveryNo:'SH20260629005',warehouse:'兀兰DC',skuCode:'SKU8804',name:'空心菜',spec:'1kg/件',unit:'件',
     type:'送多',qty:4,photos:2,slot:'WD-VIRT-03',registeredAt:'2026-06-29 03:40',status:'待取回',pickedAt:'',
     note:'实收 26，超出应送 22 共 4 件'},
    {deliveryNo:'SH20260518001',warehouse:'裕廊DC',skuCode:'SKU8811',name:'鲜鸡蛋',spec:'30枚/盘',unit:'盘',
     type:'送多',qty:2,photos:3,slot:'JR-VIRT-07',registeredAt:'2026-05-18 02:30',status:'已取回',pickedAt:'2026-05-20 10:15',
     note:''},
  ];
  window.whrOfDelivery=function(id){return (DB.whReturns||[]).filter(r=>r.deliveryNo==id);};
  function whrTypeTag(t){return `<span class="tag ${t=='送错'?'t-r':'t-y'}" style="font-size:10.5px"><span class="dot"></span>${t}</span>`;}
  function whrStTag(s){return s=='已取回'?'<span class="tag t-g"><span class="dot"></span>已取回</span>':'<span class="tag t-b"><span class="dot"></span>待取回</span>';}
  // 仓库留存照片（原型占位；真实由仓库登记时上传）
  window.whr_photos=function(id,sku){
    const r=(DB.whReturns||[]).find(x=>x.deliveryNo==id&&x.skuCode==sku); if(!r)return;
    modal(`<div class="mc-hd"><h3>仓库留存照片 · ${r.name}</h3><p>${r.deliveryNo} · ${r.warehouse} · ${r.type} ${r.qty}${r.unit}</p><button class="mc-x" onclick="closeModal()">×</button></div><div class="mc-bd">
      <div class="ib ib-b" style="margin-bottom:12px"><span class="i">📷</span>照片由仓库在登记台账时<b>多角度拍摄留存</b>，作为多货/错货的实物凭证；商家端只读。</div>
      <div style="display:grid;grid-template-columns:repeat(${Math.min(r.photos,3)},1fr);gap:10px">
        ${Array.from({length:r.photos}).map((_,i)=>`<div style="aspect-ratio:4/3;background:var(--bd2);border-radius:10px;display:flex;align-items:center;justify-content:center;color:var(--ts);font-size:12.5px">实物照片 ${i+1}</div>`).join('')}
      </div>
      <div style="font-size:12.5px;color:var(--ts);margin-top:12px">存放位置：<b>${r.warehouse} · ${r.slot}</b>（专属虚拟库位，不计入正常库存）</div>
    </div><div class="mc-ft"><button class="btn btn-p" onclick="closeModal()">关闭</button></div>`);
  };
  // 「售后管理 › 退货单 › 仓库退回」Tab —— 列表按【送货单】合并成一行，明细在详情抽屉里逐 SKU 展开
  function whrGroups(){
    const map={};
    (DB.whReturns||[]).forEach(r=>{(map[r.deliveryNo]=map[r.deliveryNo]||[]).push(r);});
    return Object.keys(map)
      .map(no=>{const list=map[no].slice().sort((a,b)=>(a.type=='送错'?0:1)-(b.type=='送错'?0:1));
        const wait=list.filter(x=>x.status=='待取回').length;
        return {no,list,warehouse:list[0].warehouse,slot:[...new Set(list.map(x=>x.slot))].join(' / '),
          at:list.map(x=>x.registeredAt).sort()[0],
          photos:list.reduce((a,x)=>a+x.photos,0),
          qty:list.reduce((a,x)=>a+x.qty,0),
          wait,status:wait==0?'已取回':(wait==list.length?'待取回':'部分取回')};})
      .sort((a,b)=>b.at.localeCompare(a.at));
  }
  function whrSumText(list){
    return [...new Set(list.map(x=>x.type))]
      .map(t=>`${t} ${list.filter(x=>x.type==t).reduce((a,x)=>a+x.qty,0)}${list.find(x=>x.type==t).unit}`).join(' · ');
  }
  function whrGrpStTag(g){
    if(g.status=='已取回')return '<span class="tag t-g"><span class="dot"></span>已取回</span>';
    if(g.status=='部分取回')return `<span class="tag t-y"><span class="dot"></span>部分取回</span><div style="font-size:11px;color:var(--ts);margin-top:2px">待取回 ${g.wait}/${g.list.length} 项</div>`;
    return `<span class="tag t-b"><span class="dot"></span>待取回</span><div style="font-size:11px;color:var(--ts);margin-top:2px">${g.list.length} 项</div>`;
  }
  window.deliv_whReturnContent=function(){
    const gs=whrGroups();
    if(!gs.length) return `<div class="empty"><div class="e-ic">📦</div><div class="e-t">暂无待退回商品</div><div class="e-s">送货到仓被清点出<b>送多</b>或<b>送错</b>的商品时，仓库登记台账后在此生成取货通知。</div></div>`;
    const waitDoc=gs.filter(g=>g.status!='已取回').length;
    return `<div class="ib ib-y" style="margin-bottom:12px"><span class="i">📦</span><div>
      <b>仓库退回</b>＝你送到仓的商品中被清点出<b>送多</b>或<b>送错</b>的部分。这批货<b>不计入结算、不产生扣款也不付款</b>，仓库已放入专属虚拟库位暂存，请<b>线下联系仓库约时间取回</b>。
      <br><span style="color:var(--ts)">沿用原送货单标记，不另生成退货单号；一张送货单合并为一条，点<b>详情</b>看逐个商品的类型、数量与实物照片。</span>
    </div></div>
    <div class="card"><div class="card-hd"><h3>仓库退回</h3><span class="sub">待取回 ${waitDoc} 单 · 共 ${gs.length} 单 / ${(DB.whReturns||[]).length} 项 · 按送货单合并</span></div>
    <div class="card-bd flush"><div style="overflow-x:auto"><table>
      <thead><tr><th>来源送货单</th><th>退回商品</th><th>类型合计</th><th style="text-align:right">总数量</th><th>存放仓库 / 库位</th><th>登记时间</th><th>状态</th><th>操作</th></tr></thead><tbody>
      ${gs.map(g=>`<tr>
        <td class="mono" style="white-space:nowrap">${g.no}</td>
        <td style="white-space:nowrap">${g.list.map(x=>`<b>${x.name}</b>`).join('、')}<div style="font-size:11px;color:var(--ts);margin-top:2px">共 ${g.list.length} 个 SKU</div></td>
        <td style="white-space:nowrap">${g.list.some(x=>x.type=='送错')?`<span class="tag t-r" style="font-size:10.5px"><span class="dot"></span>送错</span> `:''}${g.list.some(x=>x.type=='送多')?`<span class="tag t-y" style="font-size:10.5px"><span class="dot"></span>送多</span>`:''}<div style="font-size:11px;color:var(--ts);margin-top:2px">${whrSumText(g.list)}</div></td>
        <td style="text-align:right"><b>${g.qty}</b></td>
        <td style="white-space:nowrap">${g.warehouse}<div style="font-size:11px;color:var(--ts);margin-top:2px" class="mono">${g.slot}</div></td>
        <td style="font-size:12px;color:var(--ts);white-space:nowrap">${g.at}</td>
        <td style="white-space:nowrap">${whrGrpStTag(g)}</td>
        <td style="white-space:nowrap"><button class="btn btn-o btn-sm" onclick="whr_detail('${g.no}')">详情</button> <button class="btn btn-o btn-sm" onclick="DB.delivTab='sign';DB.delivView='${g.no}';nav('m-delivery')">送货单</button></td>
      </tr>`).join('')}
      </tbody></table></div>
      <div class="card-bd" style="border-top:1px solid var(--bd2);font-size:12.5px;color:var(--ts)">状态由<b>仓库</b>在交接时按项回写（待取回 → 已取回），同单部分取回时显示「部分取回」；商家端只读。取货时间<b>线下与仓库确认</b>，本期不做线上预约。</div>
    </div>`;
  };
  // 仓库退回详情（右侧抽屉）：逐 SKU 区分展示
  window.whr_detail=function(no){
    const g=whrGroups().find(x=>x.no==no); if(!g)return;
    const kv=(k,v)=>`<div style="min-width:0"><div style="font-size:12px;color:var(--ts);margin-bottom:4px">${k}</div><div style="font-size:13.5px;color:var(--tp);font-weight:500;word-break:break-word">${v||'—'}</div></div>`;
    const sec=t=>`<div style="display:flex;align-items:center;gap:10px;margin:2px 0 14px"><span style="width:4px;height:16px;background:var(--g);border-radius:2px"></span><h3 style="font-size:14.5px;font-weight:700">${t}</h3></div>`;
    drawer(`<div class="drawer-hd"><div><h3>${g.no} · 仓库退回</h3><div style="font-size:12.5px;color:var(--ts);margin-top:2px">${g.warehouse} · 共 ${g.list.length} 项 · ${whrSumText(g.list)}</div></div><span class="x" onclick="closeDrawer()">×</span></div>
    <div class="drawer-bd">
      <div class="row" style="gap:8px;margin-bottom:14px">${whrGrpStTag(g)}</div>
      <div class="ib ib-y" style="margin-bottom:16px"><span class="i">📦</span>本单被清点出 <b>${whrSumText(g.list)}</b>，仓库已登记台账、留存实物照片并放入专属虚拟库位暂存。这批货<b>不计入结算、不产生扣款也不付款</b>，请线下与仓库约时间取回。</div>

      ${sec('单据信息')}
      <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:14px 24px;margin-bottom:20px">
        ${kv('来源送货单',`<span class="mono">${g.no}</span> <button class="btn btn-link btn-sm" style="padding:0 0 0 4px" onclick="closeDrawer();DB.delivTab='sign';DB.delivView='${g.no}';nav('m-delivery')">查看</button>`)}
        ${kv('存放仓库',g.warehouse)}
        ${kv('虚拟库位',`<span class="mono">${g.slot}</span>`)}
        ${kv('首次登记时间',g.at)}
        ${kv('退回商品',`${g.list.length} 个 SKU · 合计 ${g.qty}`)}
        ${kv('退回单号','无（沿用原送货单标记，不另生成单号）')}
      </div>

      ${sec('退回商品明细')}
      <div style="overflow-x:auto;margin-bottom:14px"><table>
        <thead><tr><th>商品</th><th>类型</th><th style="text-align:right">数量</th><th>库位</th><th>登记时间</th><th>凭证</th><th>状态</th></tr></thead><tbody>
        ${g.list.map(r=>`<tr>
          <td style="white-space:nowrap"><b>${r.name}</b><div style="font-size:11px;color:var(--ts);margin-top:2px">${r.skuCode} · ${r.spec}</div>${r.note?`<div style="font-size:11px;color:var(--ts);margin-top:3px;white-space:normal;max-width:220px">${r.note}</div>`:''}</td>
          <td><span class="tag ${r.type=='送错'?'t-r':'t-y'}" style="font-size:10.5px"><span class="dot"></span>${r.type}</span></td>
          <td style="text-align:right"><b>${r.qty}</b> ${r.unit}</td>
          <td class="mono" style="font-size:12px">${r.slot}</td>
          <td style="font-size:12px;color:var(--ts);white-space:nowrap">${r.registeredAt}</td>
          <td><button class="btn btn-link btn-sm" onclick="whr_photos('${r.deliveryNo}','${r.skuCode}')">📷 ${r.photos} 张</button></td>
          <td style="white-space:nowrap">${r.status=='已取回'?`<span class="tag t-g"><span class="dot"></span>已取回</span>${r.pickedAt?`<div style="font-size:11px;color:var(--ts);margin-top:2px">${r.pickedAt}</div>`:''}`:'<span class="tag t-b"><span class="dot"></span>待取回</span>'}</td>
        </tr>`).join('')}
        </tbody></table></div>
      <div class="ib ib-b"><span class="i">ℹ️</span>状态由<b>仓库</b>在交接时<b>按项</b>回写，同单可分批取回；商家端只读，无编辑与线上预约入口。</div>
    </div>
    <div class="drawer-ft"><button class="btn btn-o" onclick="closeDrawer()">关闭</button><button class="btn btn-p" onclick="closeDrawer();DB.delivTab='sign';DB.delivView='${g.no}';nav('m-delivery')">查看送货单</button></div>`);
  };

  /* ============================================================
     子页 2 · 交货进度
  ============================================================ */
  function tabProg(){
    const rows=PROG;
    const total=rows.reduce((s,p)=>s+p.should,0);
    const filt=`<div class="card"><div class="card-bd" style="padding:12px 20px"><div class="row" style="gap:10px;align-items:center">
      <select style="max-width:150px"><option>${DB.delivDate||'2026-07-01'}</option></select>
      <select style="max-width:160px"><option>新加坡事业部</option></select>
      <select style="max-width:150px"><option>全部仓库</option>${SG_WH.map(x=>`<option>${x}</option>`).join('')}</select>
    </div></div></div>`;
    if(!rows.length) return filt+`<div class="empty"><div class="e-ic">📦</div><div class="e-t">暂无交货数据</div><div class="e-s">切换日期查看其它批次。</div></div>`;
    return filt+`
    <div class="card"><div class="card-hd"><h3>新加坡事业部 · 全部</h3><span class="sub">总销量 ${total}</span></div>
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
    modalWide(`<div class="mc-hd"><h3>站区明细 · ${p.wh}</h3><p>新加坡事业部 · 交货 ${p.time}</p><button class="mc-x" onclick="closeModal()">×</button></div><div class="mc-bd">
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
        <span style="font-size:12.5px;color:var(--ts)">装筐方式：按品输入</span>
      </div>
      <button class="btn btn-p btn-sm" onclick="deliv_scan()">📷 扫描容器，开始装筐</button>
    </div></div>`;
    return tabs+filt+`<div class="empty"><div class="e-ic">🧺</div><div class="e-t">当前仓库未开启本功能</div><div class="e-s">装筐送货需仓库后台开启。开启后此处展示${t=='wait'?'待装筐任务':t=='done'?'已装筐记录':'抽点核验结果'}。<br>如需开启请联系所属仓库运营。</div></div>`;
  }
  window.deliv_scan=function(){toast('当前仓库未开启装筐功能，无法扫描容器','err');};

  /* ============================================================
     子页 4 · 退货单
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
        <select style="max-width:150px"><option>全部单据</option><option>客退退货单</option><option>滞销退货单</option></select>
      </div>
      <button class="btn btn-p btn-sm" onclick="deliv_newReturn()">＋ 新建退货单</button>
    </div></div>`;
    if(!rows.length) return head+tabs+filt+`<div class="empty"><div class="e-ic">📦</div><div class="e-t">该状态下暂无退货单</div><div class="e-s">切换状态或点「＋ 新建退货单」发起退货。</div></div>`;
    return head+tabs+filt+`
    <div class="card"><div class="card-hd"><h3>退货单</h3><span class="sub">共 ${rows.length} 单</span></div>
    <div class="card-bd flush"><div style="overflow-x:auto"><table>
      <thead><tr><th>退货单号</th><th>状态</th><th>仓库</th><th>件数</th><th>提货码</th><th>提货截止时间</th><th>操作</th></tr></thead><tbody>
      ${rows.map((r,idx)=>`<tr>
        <td class="mono">${r.id}<div style="margin-top:3px"><span class="tag t-gr" style="font-size:10.5px">客退退货单</span></div><div style="font-size:11px;color:var(--ts);margin-top:2px">${r.order} 下单</div></td>
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
    modal(`<div class="mc-hd"><h3>退货单 ${r.id}</h3><p>${retTag(r.status)} · ${r.wh}</p><button class="mc-x" onclick="closeModal()">×</button></div><div class="mc-bd">
      <div class="kv"><div><div class="k">提货码</div><div class="v mono">${r.code}</div></div><div><div class="k">件数</div><div class="v">共 ${r.qty} 件</div></div><div><div class="k">下单时间</div><div class="v" style="font-size:13px">${r.order}</div></div><div><div class="k">提货截止</div><div class="v" style="font-size:13px;color:var(--r)">${r.deadline}</div></div></div>
    </div><div class="mc-ft"><button class="btn btn-p" onclick="closeModal()">关闭</button></div>`);
  };

  // 新建退货单
  window.deliv_newReturn=function(){
    DB.retNew=DB.retNew||{type:'成品',lines:[]};
    deliv_renderNew();
  };
  function deliv_renderNew(){
    const n=DB.retNew,tot=n.lines.reduce((s,l)=>s+l.qty,0);
    modalWide(`<div class="mc-hd"><h3>新建退货单</h3><p>退货信息 + 退货商品，提交后生成提货码</p><button class="mc-x" onclick="closeModal()">×</button></div><div class="mc-bd">
      <div class="card" style="box-shadow:none;margin-bottom:12px"><div class="card-hd"><h3>退货信息</h3></div><div class="card-bd">
        <div class="fg2">
          <div class="fr"><label class="fl"><b>*</b>取货仓库</label><select id="ret-wh">${SG_WH.map(x=>`<option ${n.wh==x?'selected':''}>${x}</option>`).join('')}</select></div>
          <div class="fr"><label class="fl"><b>*</b>商品类型</label>
            <div style="display:flex;gap:18px;align-items:center;padding-top:6px">
              <label style="display:flex;align-items:center;gap:6px;cursor:pointer"><input type="radio" name="ret-type" style="width:auto" ${n.type=='成品'?'checked':''} onclick="DB.retNew.type='成品'">成品</label>
              <label style="display:flex;align-items:center;gap:6px;cursor:pointer"><input type="radio" name="ret-type" style="width:auto" ${n.type=='包装物'?'checked':''} onclick="DB.retNew.type='包装物'">包装物</label>
            </div></div>
        </div>
      </div></div>
      <div class="card" style="box-shadow:none"><div class="card-hd"><h3>退货商品</h3><button class="btn btn-link" onclick="deliv_addRetLine()">＋ 添加退货商品</button></div>
      <div class="card-bd ${n.lines.length?'flush':''}">
        ${n.lines.length?`<table><thead><tr><th>商品</th><th>规格</th><th>退货数量</th><th>预估货值</th><th></th></tr></thead><tbody>
          ${n.lines.map((l,i)=>`<tr><td><b>${l.name}</b></td><td>${l.spec}</td><td>${l.qty} ${l.unit}</td><td>${money(l.qty*l.price)}</td><td><button class="btn btn-link" onclick="deliv_delRetLine(${i})">移除</button></td></tr>`).join('')}
        </tbody></table>`:`<div class="empty" style="padding:26px 0"><div class="e-ic">➕</div><div class="e-t">尚未添加退货商品</div><div class="e-s">点右上「＋ 添加退货商品」从库存选择。</div></div>`}
      </div></div>
    </div><div class="mc-ft"><div style="flex:1;font-size:13px">退货商品合计 <b style="font-size:16px">${tot}</b> 件</div><button class="btn btn-o" onclick="closeModal()">取消</button><button class="btn btn-p" ${n.lines.length?'':'disabled'} onclick="deliv_submitReturn()">提交退货单</button></div>`);
  }
  window.deliv_addRetLine=function(){
    const pool=[['本地白菜','5kg/箱','箱',12.5],['有机西兰花','3kg/箱','箱',21.0],['鲜鸡蛋','30枚/盘','盘',8.4],['精品油豆泡','1.5kg/组','组',6.2]];
    const p=pool[DB.retNew.lines.length%pool.length];
    DB.retNew.lines.push({name:p[0],spec:p[1],unit:p[2],price:p[3],qty:1});
    deliv_renderNew();
  };
  window.deliv_delRetLine=function(i){DB.retNew.lines.splice(i,1);deliv_renderNew();};
  window.deliv_submitReturn=function(){
    if(!DB.retNew.lines.length){toast('请先添加退货商品','err');return;}
    const tot=DB.retNew.lines.reduce((s,l)=>s+l.qty,0);
    closeModal();DB.retNew={type:'成品',lines:[]};
    toast(`退货单已提交（共 ${tot} 件），已生成提货码，请按截止时间预约提货`,'ok');
  };

  // 预约提货
  window.deliv_pickup=function(id){DB.retPickup={id,need:true,date:'',reason:''};deliv_renderPickup();};
  function deliv_renderPickup(){
    const p=DB.retPickup,r=RET.find(x=>x.id==p.id);
    const reasons=['商品已无销售价值','不再需要该商品','质量问题','其它'];
    modal(`<div class="mc-hd"><h3>预约提货</h3><p>退货单 ${r.id} · ${r.wh} · 共 ${r.qty} 件</p><button class="mc-x" onclick="closeModal()">×</button></div><div class="mc-bd">
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
        <div class="ib ib-r"><span class="i">⚠️</span>退货单 <b>${r.id}</b> 共 ${r.qty} 件，放弃后<b>所有权归仓库处置，不再退还，且不可撤销</b>。</div>
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
    ensureDeliveriesDemo();
    if(DB.delivView){const d=dvGet(DB.delivView);if(d)return detailPage(d);DB.delivView=null;}
    const t=DB.delivTab||'sign';
    // 送货管理=正向送货：送货签到/交货进度。「退货单(退货)」已挪到售后管理(m-aftersale)；「装筐送货」暂不要（tabBasket/tabReturn 保留备用）
    const top=`<div class="tabs" style="margin-bottom:14px">
      <div class="tab ${t=='sign'?'active':''}" onclick="DB.delivTab='sign';render()">🚚 送货签到</div>
      <div class="tab ${t=='prog'?'active':''}" onclick="DB.delivTab='prog';render()">📊 交货进度</div>
    </div>`;
    const body=t=='prog'?tabProg():tabSign();
    return top+body;
  };
  // 退货单(退货)已归售后管理：暴露 tabReturn 供主文件 m-aftersale 的「退货单」Tab 调用
  window.deliv_tabReturn=tabReturn;
})();
