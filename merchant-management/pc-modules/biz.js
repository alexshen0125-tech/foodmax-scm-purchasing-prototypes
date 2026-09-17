/* PC · 商机推荐 —— 搬迁自快驴卖家 App「商机推荐」，交互对齐 App v2(biz.js)。
   帮商家发现客户有需求但本城供给不足的商品，引导「立即上品」补齐货盘换取流量扶持。
   三个 Tab：客户热搜（热搜词 + 热销商品）/ 热门推荐（四类入口过滤 + 推荐商品）/ 我的收藏（已收藏 + 已上品）。
   交互全部真改状态：立即上品→选城区→真加入「已上品」改状态；收藏→真进收藏 Tab；不再推荐→二次确认后真移除；
   热搜词 / 商品行可点 → 弹详情 modal；查看全部 → 完整热搜榜 modal。状态挂 DB，改完调 render() 整页重渲。
   依赖 inline 脚本：DB / money / toast / modal / modalWide / closeModal / render（同页全局符号）。 */
(function(){

  /* ---------- 状态初始化（挂 DB，跨 render 持久；不再推荐为破坏性移除，存已移除 id） ---------- */
  function S(){
    DB.biz = DB.biz || {
      tab:'search',          // search | rec | fav
      city:'中区',           // 上品城市（进页/顶部可切）
      entry:null,            // 热门推荐四类入口过滤：null=全部 | 本城热卖 | 首发新品 | 低竞争品 | 优选推荐
      fav:[],                // 已收藏 商品 id
      shelf:{},              // 已上品 {id:{areas:[...], ts}}
      dismissed:[],          // 不再推荐（已移除）商品 id
    };
    return DB.biz;
  }

  /* ---------- 演示数据（参考价为 SGD，用 money() 渲染） ---------- */
  // 上品城市（新加坡本地化区域）
  const CITIES=['中区','东区','西区','北区'];
  // 铺货城区（立即上品时多选）
  const AREAS=['中区','东区','西区','北区'];

  // 热搜关键词：搜索次数 / 较上月趋势 up=红↑ down=绿↓ / 月购买量 / 近7日搜索趋势 / 关联热销商品 id / 建议上品文案
  const KW = [
    {id:'k1', rank:1, kw:'鸡蛋',   cnt:'10万+', tr:'up',   buy:'10万+', spark:[62,68,71,75,80,86,95], rel:['h1','h2'], suggest:'本城 19 家在售仍供不应求，建议补齐大码 / 中码两个规格抢占需求。'},
    {id:'k2', rank:2, kw:'金针菇', cnt:'10万+', tr:'down', buy:'10万+', spark:[88,85,80,76,72,70,66], rel:['h3'],       suggest:'热度回落但基数仍大，净菜小包装客户复购高，建议保留 1 个规格。'},
    {id:'k3', rank:3, kw:'豆腐',   cnt:'10万+', tr:'down', buy:'10万+', spark:[78,76,73,70,68,66,64], rel:['h4'],       suggest:'内酯豆腐为火锅 / 麻辣烫客户刚需，建议盒装上品。'},
    {id:'k4', rank:4, kw:'香干',   cnt:'10万+', tr:'down', buy:'10万+', spark:[70,68,67,65,63,62,60], rel:['h5'],       suggest:'卤味 / 凉拌场景稳定需求，可搭配豆腐组合上品。'},
    {id:'k5', rank:5, kw:'鹌鹑蛋', cnt:'10万+', tr:'down', buy:'10万+', spark:[58,56,55,53,52,51,50], rel:['h1'],       suggest:'卤味客户搜索集中，本城在售卖家少，竞争低。'},
  ];
  // 完整热搜榜（查看全部，补足至 10 名）
  const KW_ALL = KW.concat([
    {rank:6,  kw:'大白菜',  cnt:'8.6万', tr:'up',   buy:'7.2万'},
    {rank:7,  kw:'土豆',    cnt:'8.1万', tr:'down', buy:'6.9万'},
    {rank:8,  kw:'青尖椒',  cnt:'7.4万', tr:'up',   buy:'6.0万'},
    {rank:9,  kw:'海带丝',  cnt:'6.8万', tr:'up',   buy:'5.5万'},
    {rank:10, kw:'牛肉饼',  cnt:'6.2万', tr:'up',   buy:'4.8万'},
  ]);

  // 客户热搜 · 热销商品
  const HOT = [
    {id:'h1', img:'🥚', name:'（京闽鲜）红壳鸡蛋大码30枚', spec:'3.6斤/托(30枚)', heat:5, sale:'$265.9万+', sellers:19, ref:17.26, tag:'本地热销', reason:'本城客户高搜高购，供给缺口大'},
    {id:'h2', img:'🥚', name:'红壳鲜鸡蛋 中码 筐装',       spec:'25斤/筐',        heat:4, sale:'$717.9万+', sellers:14, ref:13.80, tag:'本地热销', reason:'餐饮大客高频补货品'},
    {id:'h3', img:'🍄', name:'金针菇 鲜品 净菜',           spec:'150g/包',        heat:5, sale:'$182.4万+', sellers:21, ref:1.20,  tag:'本地热销', reason:'火锅 / 麻辣烫客户刚需'},
    {id:'h4', img:'⬜', name:'盒装内酯豆腐',               spec:'380g/盒',        heat:4, sale:'$96.5万+',  sellers:16, ref:0.95,  tag:'本地热销', reason:'高复购、低损耗'},
    {id:'h5', img:'🟫', name:'卤香干 白干',                spec:'500g/袋',        heat:3, sale:'$54.2万+',  sellers:11, ref:2.40,  tag:'本地热销', reason:'卤味 / 凉拌场景稳定需求'},
  ];

  // 热门推荐 · 四类入口（cat 与商品的 cat 对应，用于过滤）
  const ENTRY = [
    {ic:'🔥', cat:'本城热卖', s:'汇聚本城高销商品'},
    {ic:'🆕', cat:'首发新品', s:'本城首发 独享新鲜'},
    {ic:'📈', cat:'低竞争品', s:'低竞争 高回报商品'},
    {ic:'⭐', cat:'优选推荐', s:'精挑细选 汇聚精品'},
  ];

  // 热门推荐 · 推荐商品（cat 归属四类入口；标签：高流量 / 平台新品 / 强烈推荐）
  const REC = [
    {id:'r1', img:'🥟', name:'[希波]萝卜牛肉饼',       cat:'首发新品', heat:4, tags:['高流量','平台新品'], reason:'平台新品 · 本城首发',   ref:8.90,  spec:'500g/盒', sale:'$1.2万+',  sellers:5},
    {id:'r2', img:'🌭', name:'[海暘]精致火山石肉肠',   cat:'首发新品', heat:4, tags:['高流量','平台新品'], reason:'平台新品 · 独享新鲜',   ref:11.50, spec:'400g/根', sale:'$0.8万+',  sellers:4},
    {id:'r3', img:'🟢', name:'海带片海带条(免切)优质', cat:'低竞争品', heat:3, tags:['强烈推荐'],          reason:'客户高购品 · 低竞争',   ref:6.50,  spec:'2斤/袋',  sale:'$1000+',   sellers:8},
    {id:'r4', img:'🌿', name:'鲜 海带丝（免切）',      cat:'本城热卖', heat:4, tags:['高流量','强烈推荐'], reason:'客户高购品',           ref:12.66, spec:'10斤/袋', sale:'$15.2万+', sellers:8},
    {id:'r5', img:'🌶️', name:'青尖椒 优质',            cat:'本城热卖', heat:4, tags:['高流量'],            reason:'客户高销品 · 本城热卖', ref:14.50, spec:'5斤/箱',  sale:'$2万+',    sellers:12},
    {id:'r6', img:'🥔', name:'黄心大土豆',             cat:'优选推荐', heat:3, tags:['强烈推荐'],          reason:'优选品 · 损耗低易存',   ref:9.80,  spec:'10斤/袋', sale:'$1.8万+',  sellers:9},
  ];

  // 商品总索引（热销 + 推荐，供 fav/shelf/详情按 id 反查）
  const INDEX = {};
  HOT.concat(REC).forEach(p=>INDEX[p.id]=p);
  function find(id){ return INDEX[id]; }

  /* ---------- 小工具 ---------- */
  function fire(n){ return `<span title="客户热度 ${n}/5" style="letter-spacing:1px">${'🔥'.repeat(n)}<span style="opacity:.25">${'🔥'.repeat(5-n)}</span></span>`; }
  function trend(t){ return t=='up'
    ? '<span style="color:var(--r);font-weight:700" title="较上月上升">↑</span>'
    : '<span style="color:var(--g);font-weight:700" title="较上月下降">↓</span>'; }
  function recTag(t){
    const m={'高流量':'t-r','平台新品':'t-y','强烈推荐':'t-g','本地热销':'t-r'};
    return `<span class="tag ${m[t]||'t-gr'}" style="font-size:11px"><span class="dot"></span>${t}</span>`;
  }
  // 迷你柱状趋势图（搜索趋势）
  function spark(arr){
    const mx=Math.max(...arr);
    return `<div style="display:flex;align-items:flex-end;gap:6px;height:70px">${arr.map((v,i)=>{
      const h=Math.round(v/mx*64)+6;const last=i==arr.length-1;
      return `<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:4px">
        <div style="width:100%;height:${h}px;border-radius:5px 5px 0 0;background:${last?'var(--g)':'var(--gl)'}"></div>
        <span style="font-size:10px;color:var(--ts)">D${i+1}</span></div>`;}).join('')}</div>`;
  }
  function isFav(id){ return S().fav.includes(id); }
  function isShelf(id){ return !!S().shelf[id]; }

  /* ---------- 商品详情 modal（参考价 / 月销 / 在售卖家 / 推荐理由 / 客户热度） ---------- */
  window.biz_prodDetail=function(id){
    const p=find(id); if(!p) return;
    const shelved=isShelf(id), faved=isFav(id);
    const tags=(p.tags||(p.tag?[p.tag]:[])).map(recTag).join(' ');
    modalWide(`<div class="mc-hd"><h3>${p.img} 商品详情</h3><p>${p.name}</p><button class="mc-x" onclick="closeModal()">×</button></div>
      <div class="mc-bd">
        <div class="sg" style="grid-template-columns:repeat(4,1fr);margin-bottom:14px">
          <div class="sc"><div class="sc-l">参考价(SGD)</div><div class="sc-v">${money(p.ref)}</div><div class="sc-s">${p.spec}</div></div>
          <div class="sc good"><div class="sc-l">月销</div><div class="sc-v">${p.sale||'—'}</div><div class="sc-s">本城近 30 天</div></div>
          <div class="sc"><div class="sc-l">在售卖家</div><div class="sc-v">${p.sellers!=null?p.sellers:'—'}</div><div class="sc-s">家</div></div>
          <div class="sc warn"><div class="sc-l">客户热度</div><div class="sc-v" style="font-size:18px">${fire(p.heat)}</div><div class="sc-s">${p.heat}/5</div></div>
        </div>
        <div class="fr"><label class="fl">标签</label><div class="row" style="gap:6px;flex-wrap:wrap">${tags||'<span style="color:var(--ts)">—</span>'}</div></div>
        <div class="ib ib-g"><span class="i">📈</span><div><b>推荐理由：</b>${p.reason||'本城有需求、供给不足'}。立即上品后进入<b>流量扶持池</b>，优先曝光给本城有购买记录的客户。</div></div>
        ${shelved?`<div class="ib ib-b"><span class="i">✅</span>该商品已上品至 <b>${S().shelf[id].areas.join('/')||'全城'}</b>，可在「我的收藏」查看。</div>`:''}
      </div>
      <div class="mc-ft">
        <button class="btn btn-o" onclick="closeModal()">关闭</button>
        <button class="btn btn-link" onclick="biz_fav('${id}')">${faved?'★ 取消收藏':'☆ 收藏'}</button>
        ${shelved?'<button class="btn btn-o" disabled style="opacity:.6">已上品</button>':`<button class="btn btn-p" onclick="biz_addToShelf('${id}')">立即上品</button>`}
      </div>`);
  };

  /* ---------- 关键词商机详情 modal（搜索趋势 / 相关热销商品 / 建议上品） ---------- */
  window.biz_kwDetail=function(kid){
    const r=KW.find(x=>x.id==kid); if(!r) return;
    const rel=(r.rel||[]).map(find).filter(Boolean);
    modalWide(`<div class="mc-hd"><h3>🔍 「${r.kw}」商机详情</h3><p>本城客户近 30 天搜索热词 · 排名第 ${r.rank}</p><button class="mc-x" onclick="closeModal()">×</button></div>
      <div class="mc-bd">
        <div class="sg" style="grid-template-columns:repeat(3,1fr);margin-bottom:14px">
          <div class="sc"><div class="sc-l">搜索次数</div><div class="sc-v">${r.cnt}</div><div class="sc-s">近 30 天</div></div>
          <div class="sc ${r.tr=='up'?'alert':'good'}"><div class="sc-l">较上月</div><div class="sc-v" style="font-size:18px">${trend(r.tr)} ${r.tr=='up'?'上升':'下降'}</div><div class="sc-s">环比趋势</div></div>
          <div class="sc good"><div class="sc-l">月购买量</div><div class="sc-v">${r.buy}</div><div class="sc-s">本城成交</div></div>
        </div>
        <div class="card"><div class="card-hd"><h3>搜索趋势</h3><span class="sub">近 7 日搜索热度</span></div><div class="card-bd">${spark(r.spark)}</div></div>
        <div class="card"><div class="card-hd"><h3>相关热销商品</h3><span class="sub">补齐这些货盘抓住「${r.kw}」需求</span></div>
          <div class="card-bd flush"><div style="overflow-x:auto"><table>
            <thead><tr><th style="width:44px"></th><th>商品</th><th>客户热度</th><th>月销</th><th>在售卖家</th><th>参考价(SGD)</th><th style="width:200px">操作</th></tr></thead><tbody>
            ${rel.length?rel.map(p=>`<tr style="cursor:pointer" onclick="biz_prodDetail('${p.id}')">
              <td style="font-size:22px">${p.img}</td>
              <td><b>${p.name}</b><div style="font-size:11.5px;color:var(--ts)">${p.spec}</div></td>
              <td>${fire(p.heat)}</td><td>${p.sale}</td><td>${p.sellers} 家</td><td><b>${money(p.ref)}</b></td>
              <td>${isShelf(p.id)?'<span class="tag t-g"><span class="dot"></span>已上品</span>':`<button class="btn btn-p btn-sm" onclick="event.stopPropagation();biz_addToShelf('${p.id}')">立即上品</button>`}
                  <button class="btn btn-link" onclick="event.stopPropagation();biz_fav('${p.id}')">${isFav(p.id)?'★':'☆'} 收藏</button></td>
            </tr>`).join(''):'<tr><td colspan="7" style="text-align:center;color:var(--ts);padding:18px">暂无关联商品</td></tr>'}
            </tbody></table></div></div></div>
        <div class="ib ib-g"><span class="i">💡</span><div><b>建议上品：</b>${r.suggest}</div></div>
      </div>
      <div class="mc-ft"><button class="btn btn-p" onclick="closeModal()">知道了</button></div>`);
  };

  /* ---------- 完整热搜榜 modal（查看全部） ---------- */
  window.biz_kwAll=function(){
    modalWide(`<div class="mc-hd"><h3>🔥 完整热搜榜 · Top 10</h3><p>本城客户近 30 天搜索热度排名</p><button class="mc-x" onclick="closeModal()">×</button></div>
      <div class="mc-bd"><div style="overflow-x:auto"><table>
        <thead><tr><th style="width:60px">排名</th><th>关键词</th><th>搜索次数</th><th>较上月</th><th>月购买量</th><th style="width:120px"></th></tr></thead><tbody>
        ${KW_ALL.map(r=>`<tr ${r.id?`style="cursor:pointer" onclick="closeModal();biz_kwDetail('${r.id}')"`:''}>
          <td><b style="font-size:15px;${r.rank<=3?'color:var(--r)':''}">${r.rank}</b></td>
          <td><b>${r.kw}</b></td><td>${r.cnt}</td><td>${trend(r.tr)}</td><td>${r.buy}</td>
          <td>${r.id?'<span class="btn btn-link btn-sm">查看商机 ›</span>':'<span style="color:var(--ts);font-size:12px">—</span>'}</td>
        </tr>`).join('')}
        </tbody></table></div></div>
      <div class="mc-ft"><button class="btn btn-o" onclick="closeModal()">关闭</button></div>`);
  };

  /* ---------- 操作：立即上品（多步：选城区 → 确认 → 真加入「已上品」改状态+render） ---------- */
  window.biz_addToShelf=function(id){
    const p=find(id); if(!p) return;
    modal(`<div class="mc-hd"><h3>立即上品 · 补齐货盘</h3><p>客户有需求、本城供给不足，上架即可获得流量扶持</p><button class="mc-x" onclick="closeModal()">×</button></div>
      <div class="mc-bd">
        <div class="ib ib-g"><span class="i">📈</span>将以平台参考价 <b>${money(p.ref)}</b> 为基准创建商品「<b>${p.name}</b>」，上架后进入<b>流量扶持池</b>，优先曝光给本城有购买记录的客户。</div>
        <div class="fr"><label class="fl">铺货城区<span style="font-weight:400;color:var(--ts)">（可多选，默认全城）</span></label>
          <div class="row" style="gap:14px;flex-wrap:wrap">${AREAS.map((c,k)=>`<label class="chip-ck ${k==0?'on':''}"><input type="checkbox" value="${c}" ${k==0?'checked':''} onchange="this.closest('.chip-ck').classList.toggle('on',this.checked)">${c}</label>`).join('')}</div>
        </div>
      </div>
      <div class="mc-ft"><button class="btn btn-o" onclick="closeModal()">取消</button><button class="btn btn-p" onclick="biz_doShelf('${id}')">确认上品</button></div>`);
  };
  window.biz_doShelf=function(id){
    const p=find(id); if(!p){ closeModal(); return; }
    const picked=[...document.querySelectorAll('.mc-bd input[type=checkbox]:checked')].map(e=>e.value);
    const st=S();
    st.shelf[id]={areas:picked, ts:Date.now()};
    if(!st.fav.includes(id)) st.fav.push(id);   // 已上品默认进收藏，便于在「我的收藏」追踪
    st.dismissed=st.dismissed.filter(x=>x!=id);
    closeModal();
    render();
    toast(`「${p.name}」已上品至 ${picked.length?picked.join('/'):'全城'}，已进入流量扶持池`,'ok');
  };

  /* ---------- 操作：收藏 / 取消收藏（真改 DB + render） ---------- */
  window.biz_fav=function(id){
    const p=find(id); if(!p) return;
    const st=S();
    if(st.fav.includes(id)){
      if(st.shelf[id]){ toast(`「${p.name}」已上品，无法取消收藏`,'info'); return; }
      st.fav=st.fav.filter(x=>x!=id);
      render(); toast(`已取消收藏「${p.name}」`,'info');
    }else{
      st.fav.push(id);
      render(); toast(`已收藏「${p.name}」，可在「我的收藏」查看`,'ok');
    }
  };
  // 收藏 Tab 内取消收藏（已上品项给出说明）
  window.biz_unfav=function(id){
    const p=find(id); if(!p) return;
    const st=S();
    if(st.shelf[id]){ toast(`「${p.name}」已上品，无法取消收藏`,'info'); return; }
    st.fav=st.fav.filter(x=>x!=id);
    render(); toast(`已取消收藏「${p.name}」`,'info');
  };

  /* ---------- 操作：不再推荐（二次确认 → 真从列表移除 改 DB + render） ---------- */
  window.biz_dismiss=function(id){
    const p=find(id); if(!p) return;
    modal(`<div class="mc-hd"><h3>不再推荐</h3><button class="mc-x" onclick="closeModal()">×</button></div>
      <div class="mc-bd"><div class="ib ib-y"><span class="i">⚠️</span>确认不再推荐「<b>${p.name}</b>」？后续将不在「热门推荐」中向你展示该商品。</div></div>
      <div class="mc-ft"><button class="btn btn-o" onclick="closeModal()">取消</button><button class="btn btn-d" onclick="biz_doDismiss('${id}')">确认不再推荐</button></div>`);
  };
  window.biz_doDismiss=function(id){
    const p=find(id); const st=S();
    if(!st.dismissed.includes(id)) st.dismissed.push(id);
    closeModal(); render();
    toast(`已不再推荐「${p?p.name:''}」`,'info');
  };

  /* ---------- 操作：切换上品城市 / 入口过滤 ---------- */
  window.biz_setCity=function(c){ S().city=c; render(); };
  window.biz_setEntry=function(cat){ const st=S(); st.entry = st.entry==cat?null:cat; render(); };

  /* ---------- 顶部：上品城市选择 ---------- */
  function cityBar(){
    const cur=S().city;
    return `<div class="row" style="align-items:center;gap:10px;margin-bottom:12px">
      <span style="font-size:13px;color:var(--ts)">上品城市</span>
      <div class="row" style="gap:8px;flex-wrap:wrap">${CITIES.map(c=>`<label class="chip-ck ${c==cur?'on':''}" onclick="biz_setCity('${c}')"><input type="radio" name="bizcity" ${c==cur?'checked':''} style="pointer-events:none">${c}</label>`).join('')}</div>
      <span style="font-size:12px;color:var(--ts)">系统按所选城市推荐有需求、供给不足的商品</span>
    </div>`;
  }

  /* ---------- Tab：客户热搜 ---------- */
  function viewSearch(){
    return `${cityBar()}
    <div class="card"><div class="card-hd"><h3>热搜关键词排名</h3><div class="row" style="gap:10px;align-items:center"><span class="sub">本城客户近 30 天搜索热度 · 点行看商机</span><button class="btn btn-link btn-sm" onclick="biz_kwAll()">查看全部 ›</button></div></div>
      <div class="card-bd flush"><div style="overflow-x:auto"><table>
        <thead><tr><th style="width:60px">排名</th><th>关键词</th><th>搜索次数</th><th>较上月</th><th>月购买量</th><th style="width:120px"></th></tr></thead><tbody>
        ${KW.map(r=>`<tr style="cursor:pointer" onclick="biz_kwDetail('${r.id}')"><td><b style="font-size:15px;${r.rank<=3?'color:var(--r)':''}">${r.rank}</b></td><td><b>${r.kw}</b></td><td>${r.cnt}</td><td>${trend(r.tr)}</td><td>${r.buy}</td><td><span class="btn btn-link btn-sm">查看商机 ›</span></td></tr>`).join('')}
        </tbody></table></div></div></div>

    <div class="card"><div class="card-hd"><h3>热销商品</h3><span class="sub">本城高销量商品，点行看详情，补齐货盘抓住需求</span></div>
      <div class="card-bd flush"><div style="overflow-x:auto"><table>
        <thead><tr><th style="width:48px"></th><th>商品</th><th>客户热度</th><th>月销</th><th>在售卖家</th><th>参考价(SGD)</th><th>标签</th><th style="width:190px">操作</th></tr></thead><tbody>
        ${HOT.map(p=>`<tr style="cursor:pointer" onclick="biz_prodDetail('${p.id}')">
          <td style="font-size:24px">${p.img}</td>
          <td><b>${p.name}</b><div style="font-size:11.5px;color:var(--ts)">${p.spec}</div></td>
          <td>${fire(p.heat)}</td>
          <td>${p.sale}</td>
          <td>${p.sellers} 家</td>
          <td><b>${money(p.ref)}</b></td>
          <td>${recTag(p.tag)}</td>
          <td>${isShelf(p.id)
            ?'<span class="tag t-g"><span class="dot"></span>已上品</span>'
            :`<button class="btn btn-p btn-sm" onclick="event.stopPropagation();biz_addToShelf('${p.id}')">立即上品</button>`}
            <button class="btn btn-link" onclick="event.stopPropagation();biz_fav('${p.id}')">${isFav(p.id)?'★ 已收藏':'☆ 收藏'}</button></td>
        </tr>`).join('')}
        </tbody></table></div></div></div>`;
  }

  /* ---------- Tab：热门推荐 ---------- */
  function viewRec(){
    const st=S();
    const list=REC.filter(p=>!st.dismissed.includes(p.id)).filter(p=>!st.entry||p.cat==st.entry);
    const rows = list.length ? list.map(p=>`<tr style="cursor:pointer" onclick="biz_prodDetail('${p.id}')">
          <td style="font-size:24px">${p.img}</td>
          <td><b>${p.name}</b><div style="font-size:11.5px;color:var(--ts)">${p.spec} · 月销 ${p.sale} · 在售 ${p.sellers} 家</div></td>
          <td>${fire(p.heat)}</td>
          <td>${p.tags.map(recTag).join(' ')}</td>
          <td style="color:var(--ts);font-size:12.5px">${p.reason}</td>
          <td><b>${money(p.ref)}</b></td>
          <td>
            ${isShelf(p.id)
              ?'<span class="tag t-g"><span class="dot"></span>已上品</span>'
              :`<button class="btn btn-p btn-sm" onclick="event.stopPropagation();biz_addToShelf('${p.id}')">立即上品</button>`}
            <button class="btn btn-link" onclick="event.stopPropagation();biz_fav('${p.id}')">${isFav(p.id)?'★ 已收藏':'☆ 收藏'}</button>
            <button class="btn btn-link" style="color:var(--ts)" onclick="event.stopPropagation();biz_dismiss('${p.id}')">不再推荐</button>
          </td>
        </tr>`).join('')
      : `<tr><td colspan="7"><div class="empty"><div class="e-ic">📭</div><div class="e-t">${st.entry?`「${st.entry}」暂无可推荐商品`:'已处理完当前城市的推荐商品'}</div><div class="e-s">${st.entry?'点上方入口卡切换分类，或':'切换上品城市，或'}<b onclick="biz_setEntry(null)" style="cursor:pointer;color:var(--g)">查看全部推荐</b>。</div></div></td></tr>`;

    return `${cityBar()}
    <div class="ib ib-b"><span class="i">ℹ️</span>以下是客户有购买需求的商品，点「<b>立即上品</b>」完成新建商品即可获得<b>流量扶持</b>；建品中请勿改类目或品牌，否则可能无法正常扶持。</div>
    <div class="sg" style="grid-template-columns:repeat(4,1fr)">
      ${ENTRY.map(e=>`<div class="sc ${st.entry==e.cat?'good':''}" style="cursor:pointer;${st.entry==e.cat?'box-shadow:inset 0 0 0 2px var(--g)':''}" onclick="biz_setEntry('${e.cat}')"><div class="sc-l">${e.ic} ${e.cat}</div><div class="sc-v" style="font-size:15px;font-family:inherit">${st.entry==e.cat?'✓ 已筛选':'查看榜单'}</div><div class="sc-s">${e.s}</div></div>`).join('')}
    </div>

    <div class="card"><div class="card-hd"><h3>${st.entry?st.entry:'为你推荐'}</h3><div class="row" style="gap:10px;align-items:center"><span class="sub">本城有需求、值得补齐的商品（${list.length}）</span>${st.entry?`<button class="btn btn-link btn-sm" onclick="biz_setEntry(null)">清除筛选 ×</button>`:''}</div></div>
      <div class="card-bd flush"><div style="overflow-x:auto"><table>
        <thead><tr><th style="width:48px"></th><th>商品</th><th>客户热度</th><th>标签</th><th>推荐理由</th><th>参考价(SGD)</th><th style="width:300px">操作</th></tr></thead><tbody>
        ${rows}
        </tbody></table></div></div></div>`;
  }

  /* ---------- Tab：我的收藏（已收藏 + 已上品，真数据，可取消收藏；无则空态） ---------- */
  function viewFav(){
    const st=S();
    // 收藏与已上品的并集，已上品优先
    const ids=[...new Set([...Object.keys(st.shelf), ...st.fav])];
    if(!ids.length){
      return `<div class="card"><div class="card-bd"><div class="empty">
        <div class="e-ic">⭐</div>
        <div class="e-t">还没有收藏或上品的商机</div>
        <div class="e-s">在「客户热搜」或「热门推荐」中点 <b>☆ 收藏</b> 或 <b>立即上品</b>，<br>相关商机会出现在这里，方便随时跟进。</div>
      </div></div></div>`;
    }
    const shelfN=Object.keys(st.shelf).length, favOnlyN=st.fav.filter(id=>!st.shelf[id]).length;
    const rows=ids.map(id=>{
      const p=find(id); if(!p) return '';
      const sh=st.shelf[id];
      return `<tr style="cursor:pointer" onclick="biz_prodDetail('${id}')">
        <td style="font-size:24px">${p.img}</td>
        <td><b>${p.name}</b><div style="font-size:11.5px;color:var(--ts)">${p.spec} · 月销 ${p.sale} · 在售 ${p.sellers} 家</div></td>
        <td>${fire(p.heat)}</td>
        <td><b>${money(p.ref)}</b></td>
        <td>${sh
          ?`<span class="tag t-g"><span class="dot"></span>已上品</span><div style="font-size:11px;color:var(--ts);margin-top:3px">${sh.areas.length?sh.areas.join('/'):'全城'}</div>`
          :'<span class="tag t-y"><span class="dot"></span>已收藏</span>'}</td>
        <td>
          ${sh
            ?'<button class="btn btn-o btn-sm" disabled style="opacity:.6">已上品</button>'
            :`<button class="btn btn-p btn-sm" onclick="event.stopPropagation();biz_addToShelf('${id}')">立即上品</button>
              <button class="btn btn-link" style="color:var(--ts)" onclick="event.stopPropagation();biz_unfav('${id}')">取消收藏</button>`}
        </td>
      </tr>`;
    }).join('');
    return `<div class="sg" style="grid-template-columns:repeat(3,1fr)">
        <div class="sc good"><div class="sc-l">已上品</div><div class="sc-v">${shelfN}</div><div class="sc-s">进入流量扶持池</div></div>
        <div class="sc"><div class="sc-l">已收藏</div><div class="sc-v">${favOnlyN}</div><div class="sc-s">待上品</div></div>
        <div class="sc"><div class="sc-l">合计</div><div class="sc-v">${ids.length}</div><div class="sc-s">商机</div></div>
      </div>
      <div class="card"><div class="card-hd"><h3>我的收藏与已上品</h3><span class="sub">点行看详情；收藏项可继续上品或取消收藏</span></div>
        <div class="card-bd flush"><div style="overflow-x:auto"><table>
          <thead><tr><th style="width:48px"></th><th>商品</th><th>客户热度</th><th>参考价(SGD)</th><th>状态</th><th style="width:220px">操作</th></tr></thead><tbody>
          ${rows}
          </tbody></table></div></div></div>`;
  }

  /* ---------- 页面入口 ---------- */
  PAGES['m-biz']=()=>{
    const st=S();
    const tab=st.tab||'search';
    const favN=[...new Set([...Object.keys(st.shelf), ...st.fav])].length;
    const tabs=[['search','客户热搜'],['rec','热门推荐'],['fav', favN?`我的收藏 (${favN})`:'我的收藏']];
    const body = tab=='rec'?viewRec() : tab=='fav'?viewFav() : viewSearch();
    return `
    <div class="ib ib-g" style="margin-bottom:14px"><span class="i">💡</span><div><b>商机推荐</b>：基于本城客户的搜索与购买行为，发现「有需求、本城供给不足」的商品。补齐货盘、立即上品即可获得平台<b>流量扶持</b>。</div></div>
    <div class="tabs">${tabs.map((t)=>`<div class="tab ${tab==t[0]?'active':''}" onclick="DB.biz.tab='${t[0]}';render()">${t[1]}</div>`).join('')}</div>
    ${body}`;
  };

})();
