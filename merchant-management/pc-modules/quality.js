/* PC · 质检管理（商品质量等级 / DE 定级） —— 搬迁自 App「商品质量等级 openQuality」。
   还原 App 并对齐 App 交互深度：定级介绍弹窗(可展开各规则) + 数据概览(卡片可点开商品清单) +
   三 Tab（今日DE级 / 全部商品质量 / 定级规则）。
   - 今日DE级：每行「查看详情」开「商品质量详情」modal（近7日客诉率 / 客诉明细列表 / DE阈值 / 限流影响 / 改善建议）；
     「可撤销限流」→ 二次确认 → 真撤销（写 DB.qUnlimited + render，该行限流状态变为「已撤销」）。
   - 概览卡「持续DE」「极端高客诉」可点 → 对应商品清单 modal（行可继续查看详情）。
   - 全部商品质量：可按等级 A/B/C/D/E 筛选，整行可点开质量详情 modal。
   - 定级规则 Tab：A~E 等级表 + 各规则可展开（<details>）+ 弹窗查看完整介绍。
   - 「击败91%卖家」可点 → 同行对比 modal（本店等级分布 vs 同行基准）。
   质量等级基于 DB.products 派生（多数 C，少数 D/E）；DB.products 为空时用本地演示集（与本店叶菜目录一致），不改写 DB。
   依赖 inline 脚本：DB / CATS / money / toast / modal / modalWide / closeModal / render（同页 const/window）。 */
(function(){

  /* ====== 派生工具：稳定 hash，保证同一 SKU 每次渲染等级一致 ====== */
  function qHash(s){s=String(s);let h=5381;for(let i=0;i<s.length;i++)h=((h*33)^s.charCodeAt(i))>>>0;return h;}

  // 质量等级元数据：标签色 / 客诉表现 / 商品占比（约 5/15/72/6/2%）
  const GMETA={
    A:['t-g','明显优于平均客诉率','约 5%'],
    B:['t-g','优于平均客诉率','约 15%'],
    C:['t-gr','持平平均客诉率','约 72%'],
    D:['t-r','差于平均客诉率','约 6%'],
    E:['t-r','明显差于平均客诉率','约 2%'],
  };
  // 同行基准占比（用于同行对比）
  const GBENCH={A:5,B:15,C:72,D:6,E:2};
  function gradeTag(g){return `<span class="tag ${GMETA[g][0]}"><span class="dot"></span>${g} 级</span>`;}

  // 派生等级：占比 A5/B15/C72/D6/E2
  function deriveGrade(skuId){const r=qHash(skuId)%100;if(r<5)return 'A';if(r<20)return 'B';if(r<92)return 'C';if(r<98)return 'D';return 'E';}
  // 近7日客诉率%（按等级取区间，hash 抖动）
  function deriveRate(skuId,g){const rng={A:[0.02,0.07],B:[0.08,0.20],C:[0.20,0.45],D:[0.55,0.92],E:[1.00,1.80]}[g];const j=(qHash(skuId+'r')%100)/100;return +(rng[0]+(rng[1]-rng[0])*j).toFixed(2);}
  // 阈值（同品类同品级近期平均客诉率为基准）：超 de% 定为 DE，低于 ab% 定为 AB
  function deriveTh(skuId){return {ab:+(0.06+(qHash(skuId+'t')%4)/100).toFixed(2),de:+(0.50+(qHash(skuId+'t')%8)/100).toFixed(2)};}
  // 趋势：DE 多为客诉上升
  function deriveTrend(skuId,g){const r=qHash(skuId+'d')%3;if(g=='D'||g=='E')return r==0?'flat':'up';return r==0?'up':r==1?'flat':'down';}
  // 持续 DE：近30天均为 DE
  function isCont(skuId,g){return (g=='D'||g=='E')&&qHash(skuId+'c')%10<7;}
  // 近30天 DE 次数（用于长周期管控判定：≤1 可领撤销权益、≥15 加大限流）
  function deDays(skuId,g){if(g!='D'&&g!='E')return qHash(skuId+'n')%2;return isCont(skuId,g)?15+qHash(skuId+'n')%12:1+qHash(skuId+'n')%3;}
  // 单价（按类目指导价派生，用于客诉明细金额）
  function derivePrice(r){const base=(CATS[r.cat]&&CATS[r.cat].guide)||10;const j=(qHash(r.skuId+'p')%50)/100;return +(base*(0.85+j)).toFixed(2);}
  // 限流状态：撤销优先 → E 已限流 → D 限流预警 → 否则暂不管控
  function limitStatus(skuId,g){
    if(DB.qUnlimited&&DB.qUnlimited[skuId])return ['已撤销','t-gr','已手动撤销限流，恢复正常曝光'];
    if(g=='E')return ['已限流','t-r','曝光下调，商城展示「近7天客诉较高」标签'];
    if(g=='D')return ['限流预警','t-y','今日给予警告，暂不影响流量'];
    return ['暂不管控','t-gr','质量达标，正常曝光'];
  }
  function trendHtml(t){
    if(t=='up')return '<span style="color:var(--r);font-weight:600">▲ 客诉上升</span>';
    if(t=='down')return '<span style="color:var(--g);font-weight:600">▼ 客诉下降</span>';
    return '<span style="color:var(--ts)">— 持平</span>';
  }
  function rateColor(g){return (g=='D'||g=='E')?'var(--r)':(g=='A'||g=='B')?'var(--g)':'var(--tp)';}

  /* ====== 演示集（DB.products 为空时用；与本店叶菜目录一致，含 1D+1E 便于演示 DE） ====== */
  const DEMO=[
    {id:'SPU8801',name:'小棠菜',cat:'新鲜蔬菜',unit:'kg',skus:[{skuId:'SKU8801',qty:1,qForce:'C'}]},
    {id:'SPU8802',name:'白菜',cat:'新鲜蔬菜',unit:'kg',skus:[{skuId:'SKU8802',qty:1,qForce:'C'}]},
    {id:'SPU8803',name:'菠菜',cat:'新鲜蔬菜',unit:'kg',skus:[{skuId:'SKU8803',qty:1,qForce:'D'}]},
    {id:'SPU8804',name:'空心菜',cat:'新鲜蔬菜',unit:'kg',skus:[{skuId:'SKU8804',qty:1,qForce:'C'}]},
    {id:'SPU8805',name:'芥蓝',cat:'新鲜蔬菜',unit:'kg',skus:[{skuId:'SKU8805',qty:1,qForce:'B'}]},
    {id:'SPU8806',name:'娃娃菜',cat:'新鲜蔬菜',unit:'kg',skus:[{skuId:'SKU8806',qty:1,qForce:'A'}]},
    {id:'SPU8807',name:'土豆',cat:'新鲜蔬菜',unit:'kg',skus:[{skuId:'SKU8807',qty:1,qForce:'C'}]},
    {id:'SPU8808',name:'冰鲜三文鱼',cat:'海鲜水产',unit:'kg',skus:[{skuId:'SKU8808',qty:1,qForce:'E'}]},
    {id:'SPU8809',name:'鸡胸肉',cat:'肉禽蛋品',unit:'kg',skus:[{skuId:'SKU8809',qty:1,qForce:'C'}]},
    {id:'SPU8810',name:'生蚝',cat:'海鲜水产',unit:'只',skus:[{skuId:'SKU8810',qty:6,qForce:'C'}]},
  ];

  // 派生全量质量行（SKU 维度）
  function qUniverse(){
    const base=(DB.products&&DB.products.length)?DB.products:DEMO;
    const rows=[];
    base.forEach(p=>{(p.skus||[]).forEach(s=>{
      const g=s.qForce||deriveGrade(s.skuId);
      rows.push({
        pid:p.id,name:p.name,cat:p.cat,unit:p.unit||'',
        skuId:s.skuId,spec:`${p.name} ${s.qty||1}${p.unit||''}`,
        grade:g,rate:deriveRate(s.skuId,g),th:deriveTh(s.skuId),
        trend:deriveTrend(s.skuId,g),cont:isCont(s.skuId,g),
        de30:deDays(s.skuId,g),
        daily:200+qHash(s.skuId+'g')%700
      });
    });});
    return rows;
  }
  function qRow(skuId){return qUniverse().find(x=>x.skuId==skuId);}

  /* ====== 客诉明细派生（还原 App 客诉记录：原因/订单号/日期/城市仓/数量/金额） ====== */
  const QREASONS=['商品质量问题-商品变质','商品质量问题-商品异味问题','商品质量问题-商品损坏/破损','商品质量问题-有异物','缺货-司机未送达'];
  const SG_CITY=['中区','东区','西区','北区'];
  const SG_WH=['裕廊DC','兀兰DC','盛港DC','大巴窑DC','淡滨尼DC','义顺DC'];
  function pad(n,len){n=String(n);while(n.length<len)n='0'+n;return n;}
  function qComplaints(r){
    const n=r.grade=='E'?5:r.grade=='D'?3:r.grade=='C'?1:0;
    const price=derivePrice(r);
    const out=[];
    for(let i=0;i<n;i++){
      const h=qHash(r.skuId+'cx'+i);
      const qty=1+h%2;
      out.push({
        reason:QREASONS[h%QREASONS.length],
        orderNo:'KL2606'+pad(280000+h%9999,6),
        date:'2026-06-'+pad(20+h%9,2),
        city:SG_CITY[h%4],wh:SG_WH[h%6],
        qty,amt:+(price*qty).toFixed(2),
      });
    }
    return out;
  }

  /* ====== 定级介绍弹窗（命中DE限制上架 + 长周期管控 + A~E 规则，各规则可展开） ====== */
  window.qIntro=function(){
    modal(`<div class="mc-hd"><h3>商品质量定级相关介绍</h3><button class="mc-x" onclick="closeModal()">×</button></div>
    <div class="mc-bd">
      <details open style="margin-bottom:10px"><summary style="font-size:13.5px;font-weight:600;cursor:pointer;padding:6px 0">命中 DE 限制上架新品规则<span style="font-weight:400;color:var(--ts)">（仅蔬菜水果类目）</span></summary>
        <p style="font-size:13px;color:var(--tp);line-height:1.7;margin:6px 0 4px">T 日，同一「城市 × 四级类目 × 品种 × 品级」下，商家实际触发限流/限量管控的商品数 ≥ 1 时，该「城市 × 四级类目 × 品种 × 品级」下<b>不允许上架新品</b>；按天刷新判断当日是否命中该规则。</p>
      </details>
      <details open style="margin-bottom:10px"><summary style="font-size:13.5px;font-weight:600;cursor:pointer;padding:6px 0">长周期管控规则<span style="font-weight:400;color:var(--ts)">（仅蔬菜水果类目）</span></summary>
        <p style="font-size:13px;color:var(--tp);line-height:1.7;margin:6px 0 8px">长周期管控基于<b>近 30 天质量定级记录</b>对商品质量做长周期判定，更精准区分商品好坏。</p>
        <table class="subtbl"><thead><tr><th>今日质量等级</th><th>近30天等级</th><th>长周期管控规则</th></tr></thead><tbody>
          <tr><td>D 或 E 且近30天均有定级</td><td>DE 次数 ≤ 1</td><td>可自行领取撤销限流权益</td></tr>
          <tr><td>D 或 E 且近30天均有定级</td><td>DE 次数 ≥ 15</td><td>限流比例进一步加大</td></tr>
        </tbody></table>
      </details>
      <details open><summary style="font-size:13.5px;font-weight:600;cursor:pointer;padding:6px 0">商品质量定级规则简介</summary>
        <p style="font-size:13px;color:var(--tp);line-height:1.7;margin:6px 0 8px">质量定级基于商品近期质量客诉率，以<b>同类商品近期平均客诉率</b>为参照物，区分商品好坏。定级时已剔除「非卖家责任」「疑似恶意客户」客诉。</p>
        <table class="subtbl"><thead><tr><th>质量等级</th><th>商品近期客诉表现</th><th>商品数量占比</th></tr></thead><tbody>
          ${Object.keys(GMETA).map(g=>`<tr><td>${gradeTag(g)}</td><td>${GMETA[g][1]}</td><td>${GMETA[g][2]}</td></tr>`).join('')}
        </tbody></table>
      </details>
    </div>
    <div class="mc-ft"><button class="btn btn-p" onclick="closeModal()">知道了</button></div>`);
  };

  /* ====== 查看详情：商品质量详情（近7日客诉率/客诉明细/DE阈值/限流影响/改善建议） ====== */
  window.qDetail=function(skuId){
    const r=qRow(skuId);if(!r)return;
    const ls=limitStatus(r.skuId,r.grade);
    const cps=qComplaints(r);
    const cpAmt=cps.reduce((s,c)=>s+c.amt,0);
    const isDE=(r.grade=='D'||r.grade=='E');
    const revoked=!!(DB.qUnlimited&&DB.qUnlimited[r.skuId]);
    // 限流影响文案
    let impact;
    if(revoked)impact=['ib-g','✅','已手动撤销限流，恢复正常曝光；若客诉率持续高于阈值将再次被限流并加大比例。'];
    else if(r.grade=='E')impact=['ib-r','📉',`已限流：曝光下调，商城详情页展示「近7天客诉较高」标签，预计影响日曝光与转化。近30天 DE ${r.de30} 次${r.de30>=15?'，已达加大限流阈值（≥15）':''}。`];
    else if(r.grade=='D')impact=['ib-y','⚠️',`限流预警：今日给予警告，暂不影响流量；近30天 DE ${r.de30} 次，持续 DE 将触发限流。`];
    else impact=['ib-g','✅','质量达标，正常曝光，无管控。'];

    modalWide(`<div class="mc-hd"><h3>商品质量详情 · ${r.name}</h3><p class="mono">${r.skuId} · ${r.spec}</p><button class="mc-x" onclick="closeModal()">×</button></div>
    <div class="mc-bd">
      <div class="kv" style="margin-bottom:16px">
        <div><div class="k">质量等级</div><div class="v">${gradeTag(r.grade)}${r.cont?' <span class="tag t-r" style="font-size:11px">持续DE</span>':''}</div></div>
        <div><div class="k">近7日客诉率</div><div class="v" style="color:${rateColor(r.grade)}">${r.rate.toFixed(2)}%</div></div>
        <div><div class="k">DE / AB 阈值</div><div class="v">超 ${r.th.de.toFixed(2)}% 为 DE · 低于 ${r.th.ab.toFixed(2)}% 为 AB</div></div>
        <div><div class="k">客诉趋势</div><div class="v">${trendHtml(r.trend)}</div></div>
        <div><div class="k">限流状态</div><div class="v"><span class="tag ${ls[1]}"><span class="dot"></span>${ls[0]}</span></div></div>
        <div><div class="k">所属类目</div><div class="v">${r.cat||'—'}</div></div>
        <div><div class="k">近30天 DE 次数</div><div class="v">${r.de30} 次</div></div>
        <div><div class="k">近7日客诉笔数</div><div class="v">${cps.length} 笔 · ${money(cpAmt)}</div></div>
      </div>

      <h4 style="font-size:13.5px;margin:0 0 8px">近7日客诉明细 (${cps.length})</h4>
      ${cps.length?`<div style="overflow-x:auto"><table class="subtbl">
        <thead><tr><th>客诉日期</th><th>客诉原因</th><th>关联订单</th><th>城市/仓</th><th>数量</th><th style="text-align:right">售后金额</th></tr></thead><tbody>
        ${cps.map(c=>`<tr>
          <td>${c.date}</td><td>${c.reason}</td>
          <td class="mono">${c.orderNo}</td>
          <td>${c.city} · ${c.wh}</td>
          <td>×${c.qty}</td>
          <td style="text-align:right">${money(c.amt)}</td>
        </tr>`).join('')}
      </tbody></table></div>`:`<div class="ib ib-g" style="margin-top:0"><span class="i">✅</span>近7日无质量客诉记录。</div>`}

      <h4 style="font-size:13.5px;margin:16px 0 8px">限流影响</h4>
      <div class="ib ${impact[0]}" style="margin-top:0"><span class="i">${impact[1]}</span>${impact[2]}</div>

      <h4 style="font-size:13.5px;margin:16px 0 8px">改善建议</h4>
      ${isDE?`<div class="ib ib-b" style="margin-top:0"><span class="i">💡</span>核查近期批次品控，加强分拣去黄叶/破损剔除、称重复核与冷链温控，降低近7日客诉率回到 AB 区间（&lt; ${r.th.ab.toFixed(2)}%）即自动解除管控。定级已剔除「非卖家责任」「疑似恶意客户」客诉，如有误判可在售后判责中申诉。</div>`
        :`<div class="ib ib-g" style="margin-top:0"><span class="i">✅</span>质量稳定，继续保持批次品控与分拣标准即可。</div>`}
    </div>
    <div class="mc-ft">
      <button class="btn btn-o" onclick="closeModal();qIntro()">定级规则</button>
      ${(isDE&&!revoked&&r.de30<=1)?`<button class="btn btn-o" onclick="closeModal();qUnlimit('${r.skuId}')">可撤销限流</button>`:''}
      <button class="btn btn-p" onclick="closeModal()">关闭</button>
    </div>`);
  };

  /* ====== 商品清单 modal（概览卡「持续DE」「极端高客诉」点开） ====== */
  window.qList=function(kind){
    const rows=qUniverse();
    let list,title,desc;
    if(kind=='contDE'){list=rows.filter(r=>(r.grade=='D'||r.grade=='E')&&r.cont);title='持续DE 商品清单';desc='近30天均被定为 DE，已触发或即将触发限流，请优先改善。';}
    else if(kind=='extreme'){list=rows.filter(r=>r.grade=='E');title='极端高客诉商品清单';desc='E 级，近7日客诉率明显高于同类均值，曝光已下调。';}
    else{list=rows.filter(r=>r.grade=='D'||r.grade=='E');title='今日 DE 级商品清单';desc='';}
    list=list.sort((a,b)=>b.rate-a.rate);
    modalWide(`<div class="mc-hd"><h3>${title} (${list.length})</h3>${desc?`<p>${desc}</p>`:''}<button class="mc-x" onclick="closeModal()">×</button></div>
    <div class="mc-bd">
      ${list.length?`<div style="overflow-x:auto"><table>
        <thead><tr><th>商品</th><th>规格</th><th>质量等级</th><th>近7日客诉率</th><th>近30天DE</th><th>限流状态</th><th>操作</th></tr></thead><tbody>
        ${list.map(r=>{const ls=limitStatus(r.skuId,r.grade);return `<tr>
          <td><b>${r.name}</b><div style="font-size:11.5px;color:var(--ts)" class="mono">${r.skuId}</div></td>
          <td>${r.spec}</td>
          <td>${gradeTag(r.grade)}${r.cont?' <span class="tag t-r" style="font-size:11px">持续DE</span>':''}</td>
          <td style="color:${rateColor(r.grade)};font-weight:600">${r.rate.toFixed(2)}%</td>
          <td>${r.de30} 次</td>
          <td><span class="tag ${ls[1]}"><span class="dot"></span>${ls[0]}</span></td>
          <td><button class="btn btn-link" onclick="closeModal();qDetail('${r.skuId}')">查看详情</button></td>
        </tr>`;}).join('')}
      </tbody></table></div>`:`<div class="empty"><div class="e-ic">🎉</div><div class="e-t">暂无相关商品</div><div class="e-s">该分类下当前没有命中的商品。</div></div>`}
    </div>
    <div class="mc-ft"><button class="btn btn-p" onclick="closeModal()">关闭</button></div>`);
  };

  /* ====== 同行对比 modal（击败91%卖家点开） ====== */
  window.qPeer=function(){
    const rows=qUniverse();
    const dist={A:0,B:0,C:0,D:0,E:0};
    rows.forEach(r=>dist[r.grade]++);
    const tot=rows.length||1;
    const myAbPct=Math.round((dist.A+dist.B)/tot*100);
    function bar(my,bench){return `<div style="display:flex;align-items:center;gap:8px">
      <div style="flex:1;background:var(--bg2,#f0f0f0);border-radius:6px;height:14px;overflow:hidden"><div style="width:${Math.min(my,100)}%;height:100%;background:var(--g)"></div></div>
      <span style="width:78px;font-size:12px;color:var(--ts)">本店 ${my}% / 同行 ${bench}%</span></div>`;}
    modal(`<div class="mc-hd"><h3>同行质量对比</h3><p>本店各等级商品占比 vs 同行基准分布</p><button class="mc-x" onclick="closeModal()">×</button></div>
    <div class="mc-bd">
      <div class="ib ib-g" style="margin-top:0"><span class="i">🏆</span>本店 AB 级商品占比 <b>${myAbPct}%</b>，击败了 <b>91%</b> 的卖家。AB 占比越高，商品曝光与转化越好。</div>
      <div style="overflow-x:auto"><table class="subtbl">
        <thead><tr><th style="width:90px">质量等级</th><th>本店占比</th><th style="width:90px">同行基准</th></tr></thead><tbody>
        ${Object.keys(GMETA).map(g=>{const my=Math.round(dist[g]/tot*100);return `<tr>
          <td>${gradeTag(g)}</td>
          <td>${bar(my,GBENCH[g])}</td>
          <td>${GBENCH[g]}%</td>
        </tr>`;}).join('')}
      </tbody></table></div>
      <div class="ib ib-b" style="margin-bottom:0"><span class="i">ℹ️</span>同行基准为「同品类同品级」卖家的平均等级分布。DE 占比高于同行时，建议优先改善持续 DE 商品的批次品控。</div>
    </div>
    <div class="mc-ft"><button class="btn btn-o" onclick="closeModal();qIntro()">定级规则</button><button class="btn btn-p" onclick="closeModal()">知道了</button></div>`);
  };

  /* ====== 可撤销限流（二次确认 → 真撤销） ====== */
  window.qUnlimit=function(skuId){
    const r=qRow(skuId);if(!r)return;
    modal(`<div class="mc-hd"><h3>撤销限流 · ${r.name}</h3><button class="mc-x" onclick="closeModal()">×</button></div>
    <div class="mc-bd"><div class="ib ib-y" style="margin-top:0"><span class="i">⚠️</span>将对「${r.spec}」<b>撤销限流</b>，恢复正常曝光。每件商品的撤销权益有限（近30天 DE ≤ 1 次方可领取），若客诉率持续高于阈值（&gt; ${r.th.de.toFixed(2)}%）将再次被限流并加大比例。确认撤销？</div></div>
    <div class="mc-ft"><button class="btn btn-o" onclick="closeModal()">取消</button><button class="btn btn-p" onclick="qDoUnlimit('${skuId}')">确认撤销限流</button></div>`);
  };
  window.qDoUnlimit=function(skuId){DB.qUnlimited=DB.qUnlimited||{};DB.qUnlimited[skuId]=true;closeModal();render();toast('已撤销限流，恢复正常曝光','ok');};

  /* ====== 页面 ====== */
  PAGES['m-quality']=()=>{
    const tab=DB.qTab||'de';
    const rows=qUniverse();
    const de=rows.filter(r=>r.grade=='D'||r.grade=='E');
    const ab=rows.filter(r=>r.grade=='A'||r.grade=='B');
    const afterSale7=DB.afterSales.reduce((s,a)=>s+(a.amt||0),0);
    const estLoss=de.reduce((s,r)=>s+r.daily*r.rate*0.9,0);
    const contDE=de.filter(r=>r.cont).length;
    const extreme=rows.filter(r=>r.grade=='E').length;
    const abPct=rows.length?Math.round(ab.length/rows.length*100):0;

    // —— Tab 内容 ——
    const tabsBar=`<div class="tabs" style="margin:0;border:none">${[['de',`今日DE级 (${de.length})`],['all','全部商品质量'],['rule','定级规则']].map(x=>`<div class="tab ${tab==x[0]?'active':''}" onclick="DB.qTab='${x[0]}';render()">${x[1]}</div>`).join('')}</div>`;

    let body='';
    if(tab=='de'){
      body=`<div class="card"><div class="card-hd">${tabsBar}<button class="btn btn-link" onclick="qIntro()" style="margin-left:auto">定级介绍</button></div>
      <div class="card-bd">
        <div class="ib ib-y" style="margin-top:0"><span class="i">🏷️</span>DE 级商品，商城展示「近7天客诉较高」标签；持续 DE 将触发限流并影响曝光。点击行内「查看详情」可看客诉明细与改善建议。</div>
        <div style="overflow-x:auto"><table>
          <thead><tr><th>商品</th><th>规格</th><th>质量等级</th><th>近7日客诉率</th><th>DE 阈值说明</th><th>限流状态</th><th>操作</th></tr></thead><tbody>
          ${de.length?de.map(r=>{const ls=limitStatus(r.skuId,r.grade);const limited=ls[0]=='已限流'||ls[0]=='限流预警';const canRevoke=limited&&r.de30<=1;return `<tr>
            <td><b>${r.name}</b>${r.cont?' <span class="tag t-r" style="font-size:11px">持续DE</span>':''}<div style="font-size:11.5px;color:var(--ts)" class="mono">${r.skuId}</div></td>
            <td>${r.spec}</td>
            <td>${gradeTag(r.grade)}</td>
            <td style="color:${rateColor(r.grade)};font-weight:600">${r.rate.toFixed(2)}%</td>
            <td style="font-size:12px;color:var(--ts)">超过 <b>${r.th.de.toFixed(2)}%</b> 定为 DE，低于 ${r.th.ab.toFixed(2)}% 定为 AB</td>
            <td><span class="tag ${ls[1]}"><span class="dot"></span>${ls[0]}</span><div style="font-size:11px;color:var(--ts);margin-top:3px;max-width:160px;white-space:normal">${ls[2]}</div></td>
            <td>${canRevoke?`<button class="btn btn-o btn-sm" onclick="qUnlimit('${r.skuId}')">可撤销限流</button> `:''}<button class="btn btn-link" onclick="qDetail('${r.skuId}')">查看详情</button></td>
          </tr>`;}).join('')
          :`<tr><td colspan="7"><div class="empty"><div class="e-ic">🎉</div><div class="e-t">今日暂无 DE 级商品</div><div class="e-s">所有商品客诉率均处于 AB/C 区间，质量达标，继续保持。</div></div></td></tr>`}
        </tbody></table></div>
      </div></div>`;
    }else if(tab=='all'){
      const order={A:0,B:1,C:2,D:3,E:4};
      const gf=DB.qGrade||'all';
      const sorted=rows.slice().sort((a,b)=>order[b.grade]-order[a.grade]||b.rate-a.rate);
      const filtered=gf=='all'?sorted:sorted.filter(r=>r.grade==gf);
      const chips=[['all','全部']].concat(Object.keys(GMETA).map(g=>[g,`${g} 级`])).map(c=>{const n=c[0]=='all'?rows.length:rows.filter(r=>r.grade==c[0]).length;return `<div class="tab ${gf==c[0]?'active':''}" onclick="DB.qGrade='${c[0]}';render()">${c[1]} (${n})</div>`;}).join('');
      body=`<div class="card"><div class="card-hd">${tabsBar}<button class="btn btn-link" onclick="qIntro()" style="margin-left:auto">定级介绍</button></div>
      <div class="card-bd">
        <div class="tabs" style="margin:0 0 4px;border:none">${chips}</div>
        <div style="overflow-x:auto"><table>
        <thead><tr><th>商品</th><th>SKU 编码</th><th>类目</th><th>质量等级</th><th>近7日客诉率</th><th>趋势</th><th>操作</th></tr></thead><tbody>
        ${filtered.length?filtered.map(r=>`<tr style="cursor:pointer" onclick="qDetail('${r.skuId}')">
          <td><b>${r.name}</b><div style="font-size:11.5px;color:var(--ts)">${r.spec}</div></td>
          <td class="mono">${r.skuId}</td>
          <td>${r.cat||'—'}</td>
          <td>${gradeTag(r.grade)}${r.cont?' <span class="tag t-r" style="font-size:11px">持续DE</span>':''}</td>
          <td style="color:${rateColor(r.grade)};font-weight:600">${r.rate.toFixed(2)}%</td>
          <td>${trendHtml(r.trend)}</td>
          <td><button class="btn btn-link" onclick="event.stopPropagation();qDetail('${r.skuId}')">查看详情</button></td>
        </tr>`).join('')
        :`<tr><td colspan="7"><div class="empty"><div class="e-ic">🔬</div><div class="e-t">该等级暂无商品</div><div class="e-s">切换上方等级筛选查看其他等级，或商品上架产生订单后由系统自动定级。</div></div></td></tr>`}
      </tbody></table></div></div></div>`;
    }else{ // rule
      body=`<div class="card"><div class="card-hd">${tabsBar}<button class="btn btn-link" onclick="qIntro()" style="margin-left:auto">弹窗查看完整介绍</button></div>
      <div class="card-bd">
        <div class="ib ib-b" style="margin-top:0"><span class="i">ℹ️</span>质量定级基于商品近期质量客诉率，以<b>同类商品近期平均客诉率</b>为参照，区分商品好坏。定级时已剔除「非卖家责任」「疑似恶意客户」客诉。</div>
        <h4 style="font-size:13.5px;margin:6px 0 8px">质量等级表（A ~ E）</h4>
        <div style="overflow-x:auto"><table>
          <thead><tr><th>质量等级</th><th>商品近期客诉表现</th><th>商品数量占比</th></tr></thead><tbody>
          ${Object.keys(GMETA).map(g=>`<tr><td>${gradeTag(g)}</td><td>${GMETA[g][1]}</td><td>${GMETA[g][2]}</td></tr>`).join('')}
        </tbody></table></div>
        <details open style="margin-top:16px"><summary style="font-size:13.5px;font-weight:600;cursor:pointer;padding:6px 0">命中 DE 限制上架新品规则 <span style="font-weight:400;color:var(--ts)">（仅蔬菜水果类目）</span></summary>
          <p style="font-size:13px;color:var(--tp);line-height:1.7;margin:6px 0 0">T 日，同一「城市 × 四级类目 × 品种 × 品级」下，商家实际触发限流/限量管控的商品数 ≥ 1 时，该「城市 × 四级类目 × 品种 × 品级」下<b>不允许上架新品</b>；按天刷新判断当日是否命中该规则。</p>
        </details>
        <details open style="margin-top:8px"><summary style="font-size:13.5px;font-weight:600;cursor:pointer;padding:6px 0">长周期管控规则 <span style="font-weight:400;color:var(--ts)">（仅蔬菜水果类目）</span></summary>
          <p style="font-size:13px;color:var(--tp);line-height:1.7;margin:6px 0 8px">基于<b>近 30 天质量定级记录</b>对商品质量做长周期判定，更精准区分商品好坏。</p>
          <div style="overflow-x:auto"><table>
            <thead><tr><th>今日质量等级</th><th>近30天等级</th><th>长周期管控规则</th></tr></thead><tbody>
            <tr><td>D 或 E 且近30天均有定级</td><td>DE 次数 ≤ 1</td><td>可自行领取撤销限流权益</td></tr>
            <tr><td>D 或 E 且近30天均有定级</td><td>DE 次数 ≥ 15</td><td>限流比例进一步加大</td></tr>
          </tbody></table></div>
        </details>
      </div></div>`;
    }

    return `
    <div class="ib ib-y" style="margin-bottom:14px"><span class="i">📢</span><div>定级规则更新：定级时「非卖家责任」「疑似恶意客户」的客诉将统一剔除，同时定级将以<b>「同品类同品级近期平均客诉率」</b>为基准评定。 <button class="btn-link" onclick="qIntro()">查看定级介绍 →</button></div></div>
    <div class="card"><div class="card-hd"><h3>数据概览</h3><span class="sub">近 7 日 · 按 SKU 客诉率派生质量等级</span></div><div class="card-bd">
      <div class="sg" style="grid-template-columns:repeat(4,1fr)">
        <div class="sc"><div class="sc-l">近7日售后金额</div><div class="sc-v">${money(afterSale7)}</div><div class="sc-s">售后工单退款合计</div></div>
        <div class="sc warn"><div class="sc-l">今日预计流失金额</div><div class="sc-v">${money(estLoss)}</div><div class="sc-s">DE 商品限流预估</div></div>
        <div class="sc ${contDE?'alert':''}" style="cursor:pointer" onclick="qList('contDE')"><div class="sc-l">今日持续DE数 ›</div><div class="sc-v" style="color:var(--r)">${contDE}</div><div class="sc-s">近30天均为 DE · 点击查看清单</div></div>
        <div class="sc ${extreme?'alert':''}" style="cursor:pointer" onclick="qList('extreme')"><div class="sc-l">今日极端高客诉数 ›</div><div class="sc-v" ${extreme?'style="color:var(--r)"':''}>${extreme}</div><div class="sc-s">E 级·明显差于均值 · 点击查看清单</div></div>
      </div>
      <div class="ib ib-g" style="margin:14px 0 0;cursor:pointer" onclick="qPeer()"><span class="i">🏆</span><div>你的 AB 级商品质量，击败了 <b>91%</b> 的卖家（当前 AB 级占比 ${abPct}%）。 <button class="btn-link" onclick="event.stopPropagation();qPeer()">查看同行对比 →</button></div></div>
    </div></div>
    ${body}`;
  };
})();
