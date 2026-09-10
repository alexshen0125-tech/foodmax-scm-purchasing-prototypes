/* PC · 备货管理（一级菜单）—— 三个二级菜单：
   ① 备货参考（PAGES['m-pick-ref']，快驴式决策表）：按「送达日」将待发货订单聚合到 SKU × 仓库，铺开每仓一行，
      带历史销量参考(昨日/上周同期/7天均)、库存、合计销量；按品/按仓 打印+导出。纯查看，不改单据。
   ② 备货单（PAGES['m-pick']，JH）—— 销售订单 → 备货单（按送达日自动成单，一天一张）。列表 + 详情（仅 ① 按SKU汇总备货）。
      备完后送货单按入库仓库【自动生成】，不再手动贴码/生成（送货单见 m-delivery）。
   ③ 打印标签（PAGES['m-pick-label']，快驴式 productLabelPrint 复刻）：按 配送日期/波次/仓库 聚合应送货 SKU，逐个/批量打印标签。
   后加载覆盖主文件 PAGES['m-pick'] 占位。复用主文件全局：ensurePickOrders / pickAggr / pickOrdersOf /
   triggerDeliveries / ord_mask / lineCat / catPathName / catPathIds / CAT_TREE / toast / nav / render。 */
(function(){
  function pkTag(s){const m={'待备货':'t-y','备货中':'t-b','已备货':'t-b','贴码中':'t-pp','已贴码':'t-pp','已送货':'t-g','已作废':'t-gr'}[s]||'t-gr';
    return `<span class="tag ${m}"><span class="dot"></span>${s}</span>`;}

  /* ---------- 备货参考（快驴式）---------- */
  // 稳定伪随机（同 sku+仓库 恒定，不随重渲染跳动）——仅演示用，正式取仓库实时库存与历史销量看板
  function hnum(str,mod){let h=7;for(let i=0;i<str.length;i++)h=(h*31+str.charCodeAt(i))>>>0;return h%mod;}
  function whStock(sku,wh){return 40+hnum(sku+wh+'s',80);}                 // 各仓库存总数（演示 40–119）
  function hist(sku,wh){return hnum(sku+wh+'y',20);} // 昨日销量（稳定伪随机 0–19）
  function refOrders(){return DB.orders.filter(o=>o.status=='pending'||o.status=='packed');} // 备货范围=待发货(含已贴标)
  function specLabel(s){const p=DB.products.find(x=>x.name==s.name);if(p&&p.skus&&p.skus[0])return `${p.skus[0].qty}${p.unit}/件`;return s.unit;}
  function refWarehouses(){return [...new Set(refOrders().map(o=>o.warehouse).filter(Boolean))];}
  function refDates(){return [...new Set(refOrders().map(o=>o.deliver).filter(Boolean))].sort();}

  function refView(){
    DB.pickRefF=DB.pickRefF||{};const f=DB.pickRefF;
    const dates=refDates();if(f.date===undefined)f.date=dates[0]||'';
    const whs=refWarehouses();
    // 聚合：sku -> {name,unit,cat, whs:{仓:qty}}
    const agg={};
    refOrders().forEach(o=>{
      if(f.date&&o.deliver!=f.date)return;
      if(f.wh&&o.warehouse!=f.wh)return;
      (o.lines||[]).forEach(l=>{
        if(f.name&&!((l.name||'')).includes(f.name)&&!((l.sku||'')).includes(f.name))return;
        const catId=lineCat(l);
        if(f.cat&&String(catPathIds(catId)[0])!=String(f.cat))return; // 一级分类过滤
        const key=l.sku+'|'+l.name;
        if(!agg[key])agg[key]={sku:l.sku,name:l.name,unit:l.unit,cat:catPathName(catId),whs:{}};
        agg[key].whs[o.warehouse]=(agg[key].whs[o.warehouse]||0)+l.qty;
      });
    });
    const skus=Object.values(agg);
    const totalQty=skus.reduce((a,s)=>a+Object.values(s.whs).reduce((x,y)=>x+y,0),0);
    const roots=CAT_TREE.map(n=>[n.id,n.name]);
    const optSel=(cur,list,ph)=>`<option value="">${ph}</option>`+list.map(([v,t])=>`<option value="${v}" ${String(cur)==String(v)?'selected':''}>${t}</option>`).join('');

    // 表体（同 SKU 按仓库拆多行；序号/商品/规格/分类/合计销量 rowspan 合并）
    let idx=0;
    const body=skus.map(s=>{idx++;const ents=Object.entries(s.whs);const total=ents.reduce((a,[,q])=>a+q,0);const rs=ents.length;
      return ents.map(([wh,q],wi)=>{
        const lead=wi==0?`<td rowspan="${rs}" style="vertical-align:top">${idx}</td>
          <td rowspan="${rs}" style="vertical-align:top"><b>${s.name}</b><div style="font-size:11px;color:var(--ts)" class="mono">${s.sku}</div></td>
          <td rowspan="${rs}" style="vertical-align:top">${specLabel(s)}</td>
          <td rowspan="${rs}" style="vertical-align:top;font-size:12px;color:var(--ts)">${s.cat}</td>
          <td rowspan="${rs}" style="vertical-align:top;text-align:right"><b>${total}</b> ${s.unit}</td>`:'';
        const pq=typeof presendQty=='function'?presendQty(s.name,wh):0;
        return `<tr>${lead}<td>${wh}</td><td style="text-align:right">${whStock(s.sku,wh)}</td><td style="text-align:right;color:var(--ts)">${hist(s.sku,wh)}</td><td style="text-align:right">${q} <span style="color:var(--ts)">${s.unit}</span></td><td style="text-align:right">${pq?`<span style="color:var(--gold)">+${pq}</span>`:'<span style="color:var(--tt)">—</span>'}</td><td style="text-align:right"><b>${q+pq}</b> ${s.unit}</td></tr>`;
      }).join('');
    }).join('');

    return `
    <div class="ib ib-b" style="margin-bottom:14px"><span class="i">📊</span><div><b>备货参考</b>：系统按<b>送达日</b>把待发货订单聚合到「SKU × 仓库」，各仓一行给出需备量、库存与历史销量，辅助你决定备多少。此表<b>只做参考不生成单据</b>，实际打印标签在「打印标签」菜单，打印首个标签后系统自动生成送货单。<br><b>预送量</b>是算法预测你在 16:00–22:00 还能卖出的量，随当天 18:00 那趟车一起送；<b>合计应送 = 订单量 + 预送量</b>，明细与确认在「预送确认」菜单。</div></div>
    <div class="card" style="margin-bottom:14px"><div class="card-bd" style="display:flex;gap:16px;align-items:flex-end;flex-wrap:wrap;padding:14px 16px">
      <div><div style="font-size:12px;color:var(--ts);margin-bottom:5px">仓库</div><select onchange="DB.pickRefF.wh=this.value;render()" style="min-width:150px">${optSel(f.wh||'',whs.map(w=>[w,w]),'全部仓库')}</select></div>
      <div><div style="font-size:12px;color:var(--ts);margin-bottom:5px">配送日期(送达日)</div><select onchange="DB.pickRefF.date=this.value;render()" style="min-width:130px">${dates.map(d=>`<option value="${d}" ${f.date==d?'selected':''}>${d}</option>`).join('')||'<option value="">无</option>'}</select></div>
      <div><div style="font-size:12px;color:var(--ts);margin-bottom:5px">一级分类</div><select onchange="DB.pickRefF.cat=this.value;render()" style="min-width:130px">${optSel(f.cat||'',roots,'全部分类')}</select></div>
      <div><div style="font-size:12px;color:var(--ts);margin-bottom:5px">商品名称 / SKU</div><input value="${f.name||''}" placeholder="输入商品名或 SKU 编码" onkeydown="if(event.key=='Enter'){DB.pickRefF.name=this.value.trim();render()}" style="min-width:190px"></div>
      <button class="btn btn-p btn-sm" onclick="const i=this.previousElementSibling;DB.pickRefF.name=i.value.trim();render()">查询</button>
      <button class="btn btn-o btn-sm" onclick="DB.pickRefF={};render()">重置</button>
    </div></div>
    <div class="card"><div class="card-hd">
      <div class="row" style="gap:8px;flex-wrap:wrap">
        <button class="btn btn-o btn-sm" onclick="toast('已导出按品备货参考表.xlsx','ok')">📤 按品导出</button>
        <button class="btn btn-o btn-sm" onclick="toast('已导出按仓备货参考表.xlsx','ok')">📤 按仓导出</button>
      </div>
      <span class="sub">汇总：商品数 <b>${skus.length}</b> · 销量 <b>${totalQty}</b></span>
    </div>
    <div class="card-bd" style="padding:8px 16px 0"><div class="ib ib-r" style="margin:0"><span class="i">⚠️</span>由于订单延退支付/取消，请以仓库展示销量停止为准。</div></div>
    <div class="card-bd flush"><div style="overflow-x:auto"><table>
      <thead><tr><th style="width:44px">序号</th><th>商品名称</th><th>规格</th><th>分类</th><th style="text-align:right">合计销量</th><th>仓库</th><th style="text-align:right">库存总数</th><th style="text-align:right">昨日销量</th><th style="text-align:right">订单量</th><th style="text-align:right">预送量</th><th style="text-align:right">合计应送</th></tr></thead>
      <tbody>${body||`<tr><td colspan="11"><div class="empty"><div class="e-ic">📭</div><div class="e-t">该配送日/筛选下暂无待备货订单</div><div class="e-s">切换配送日期，或到「订单履约」点「＋ 模拟来一单」。</div></div></td></tr>`}</tbody>
    </table></div></div></div>`;
  }

  // 进入某备货单（待备货→备货中）
  window.pick_enter=function(id){const p=DB.pickOrders.find(x=>x.id==id);if(!p)return;if(p.status=='待备货')p.status='备货中';DB.pickView=id;render();};
  window.pick_back=function(){DB.pickView=null;render();};
  window.pick_done=function(id){const p=DB.pickOrders.find(x=>x.id==id);if(!p)return;if(p.status=='备货中')p.status='已备货';render();toast(`${id} 已按 SKU 备齐，送货单将按入库仓库自动生成`,'ok');};

  /* ---------- 备货单 · 列表视图 ---------- */
  function listView(){
    const ps=DB.pickOrders;
    if(!ps.length) return `<div class="empty"><div class="e-ic">🧺</div><div class="e-t">暂无备货单</div><div class="e-s">有「待发货」订单时，系统按 <b>送达日</b>自动汇总生成备货单。<br>可到「订单履约」点「＋ 模拟来一单」。</div></div>`;
    return `<div class="ib ib-b" style="margin-bottom:14px"><span class="i">🧺</span><div><b>备货单</b>：系统按「送达日」把当天订单汇总成一张，跨仓按 SKU 备一次；备完后系统按<b>入库仓库自动生成送货单</b>（无需手动生成）。标签打印在「打印标签」菜单。</div></div>
    <div class="card"><div class="card-hd"><h3>备货单</h3><span class="sub">共 ${ps.length} 张 · 备货单:订单 = 1:N</span></div><div class="card-bd flush"><div style="overflow-x:auto"><table>
      <thead><tr><th>备货单号</th><th>预计送达日</th><th>订单数</th><th>SKU数</th><th>状态</th><th>操作</th></tr></thead><tbody>
      ${ps.map(p=>{const{rows}=pickAggr(p);return `<tr>
        <td class="mono">${p.id}</td><td>${p.deliver||'—'}</td>
        <td>${p.orderIds.length} 单</td><td>${rows.length} 项</td><td>${pkTag(p.status)}</td>
        <td>${p.status=='已作废'?'<span style="color:var(--ts);font-size:12px">全部订单已取消·作废</span>':`<button class="btn btn-p btn-sm" onclick="pick_enter('${p.id}')">${p.status=='已送货'?'查看':'进入备货'}</button>`}</td>
      </tr>`;}).join('')}
      </tbody></table></div></div></div>`;
  }

  /* ---------- 备货单 · 详情视图（单张备货单） ---------- */
  function detailView(p){
    const {os,rows}=pickAggr(p);
    return `
    <div class="row" style="justify-content:space-between;align-items:center;margin-bottom:14px;flex-wrap:wrap;gap:10px">
      <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
        <button class="btn btn-o btn-sm" onclick="pick_back()">← 备货单列表</button>
        <span class="mono" style="font-weight:700">${p.id}</span>${pkTag(p.status)}
        <span style="font-size:12.5px;color:var(--ts)">${p.deliver} · ${os.length} 单 · ${rows.length} SKU</span>
      </div>
      <div style="display:flex;gap:8px">
        ${p.status=='备货中'?`<button class="btn btn-p btn-sm" onclick="pick_done('${p.id}')">✓ 确认备完（SKU备齐）</button>`:''}
        <button class="btn btn-o btn-sm" onclick="nav('m-pick-label')">🏷️ 去打印标签</button>
        <button class="btn btn-o btn-sm" onclick="nav('m-delivery')">🚚 查看送货单</button>
      </div>
    </div>
    <div class="ib ib-b" style="margin-bottom:14px"><span class="i">🚚</span><div>备货完成后，系统按<b>入库仓库自动生成送货单</b>（无需手动生成），可到「送货管理」查看；标签打印移至「打印标签」菜单。</div></div>
    <div class="card"><div class="card-hd"><h3>① 汇总备货单 · 按 SKU</h3><span class="sub">跨订单同 SKU 合并备总量（备货参考）；右列 = 该 SKU 拆到各订单的数量</span></div><div class="card-bd flush"><div style="overflow-x:auto"><table>
      <thead><tr><th>SKU</th><th>商品</th><th style="text-align:right">备货总量</th><th>按订单分配（一个 SKU → 多订单）</th></tr></thead><tbody>
      ${rows.map(r=>`<tr><td class="mono">${r.sku}</td><td><b>${r.name}</b></td><td style="text-align:right"><b>${r.qty}${r.unit}</b><div style="font-size:11px;color:var(--ts)">${r.allocs.length} 单</div></td><td>${r.allocs.map(a=>`<span style="display:inline-block;margin:2px 6px 2px 0;padding:3px 9px;background:var(--bd2);border-radius:7px;font-size:12px">${ord_mask(a.client)} <b>${a.qty}${r.unit}</b><span style="color:var(--tt)"> · ${a.id.slice(-4)}</span></span>`).join('')}</td></tr>`).join('')||'<tr><td colspan="4" style="text-align:center;color:var(--ts);padding:16px">本单无待备 SKU</td></tr>'}
      </tbody></table></div></div></div>`;
  }

  /* ---------- 打印标签（快驴式 productLabelPrint 复刻）---------- */
  function waveOf(o){const h=parseInt(o.deliverWindow||'0');return h<12?'上午达':'下午达';}   // 由送达时段派生履约波次
  function yday(sku){let h=7;for(const c of String(sku))h=(h*31+c.charCodeAt(0))>>>0;return 5+h%95;} // 昨日销量（稳定伪随机 5–99）
  function labelRows(){
    DB.labelF=DB.labelF||{};const f=DB.labelF;const dates=refDates();if(f.date===undefined)f.date=dates[0]||'';
    const whs=refWarehouses();if(f.wh===undefined)f.wh=whs[0]||'';
    const agg={};
    refOrders().forEach(o=>{
      if(f.date&&o.deliver!=f.date)return;
      if(f.wh&&o.warehouse!=f.wh)return;
      if(f.wave&&waveOf(o)!=f.wave)return;
      (o.lines||[]).forEach(l=>{
        if(f.name&&!((l.name||'').includes(f.name))&&!((l.sku||'').includes(f.name)))return;
        const key=o.warehouse+'|'+l.sku;
        if(!agg[key])agg[key]={key,sku:l.sku,name:l.name,unit:l.unit,cat:catPathName(lineCat(l)),qty:0,wgNeed:0,wgWait:0,wgReal:0};
        agg[key].qty+=l.qty;
        // 多退少补门禁：该标签行覆盖的订单中，只要还有一单没提交实发净重，就不许打印（打印即生成送货单，重量再补录已晚）
        const st=(typeof weighLineState=='function')?weighLineState(o,l):'na';
        if(st!='na'){agg[key].wgNeed++;if(st=='wait')agg[key].wgWait++;else agg[key].wgReal+=(typeof weighRealOf=='function'&&weighRealOf(o,l))||0;}
      });
    });
    // 应送货 = 订单量 + 预送量（预送量无订单载体，标签形态与订单货一致：按 SKU 一件一张、不含订单/客户信息）
    const rows=Object.values(agg);
    rows.forEach(r=>{
      r.ordQty=r.qty;
      r.psQty=(typeof presendQty=='function')?presendQty(r.name,String(r.key).split('|')[0]):0;
      r.qty=r.ordQty+r.psQty;
    });
    return rows;
  }
  function printedOf(key){return (DB.labelPrinted||{})[key]||0;}
  function wgBlocked(r){return (r.wgWait||0)>0;}
  function wgDeny(r){toast(`「${r.name}」还有 ${r.wgWait} 个订单未录实发净重。多退少补商品需先在「备货管理 › 称重录入」完成称重才能打印标签`,'err');}
  function allUnprinted(){DB.labelPrinted=DB.labelPrinted||{};const f=DB.labelF||{};const agg={},nm={};refOrders().forEach(o=>{if(f.date&&o.deliver!=f.date)return;(o.lines||[]).forEach(l=>{const key=o.warehouse+'|'+l.sku;agg[key]=(agg[key]||0)+l.qty;nm[key]=l.name;});});
    return Object.entries(agg).reduce((s,[k,q])=>{const ps=(typeof presendQty=='function')?presendQty(nm[k],String(k).split('|')[0]):0;return s+Math.max(0,q+ps-(DB.labelPrinted[k]||0));},0);}
  // 打印标签触发送货单自动生成：某(配送日期+入库仓库)首次打印标签时，按仓自动生成送货单（已存在不重复）
  function labelTriggerDelivery(keys){if(typeof window.genDeliveryOnPrint!='function')return[];const date=(DB.labelF&&DB.labelF.date)||'';const whs=[...new Set(keys.map(k=>String(k).split('|')[0]))];const made=[];
    whs.forEach(wh=>{
      // 整仓门禁：该仓还有多退少补商品未录实发净重时不生成送货单——避免"送货单已开、货还没称完"
      if(typeof window.weighWhPending=='function'&&window.weighWhPending(date,wh)>0)return;
      const id=window.genDeliveryOnPrint(date,wh);if(id)made.push(id);});
    return made;}
  // 打印机设置：商家先选标签纸张大小，选完才能打印（门禁）
  const PAPERS=['40×30 mm','50×30 mm','60×40 mm','70×50 mm','80×60 mm'];   // 热敏标签纸常见规格
  window.label_paperModal=function(){modal(`<div class="mc-hd"><h3>打印机设置</h3><button class="mc-x" onclick="closeModal()">×</button></div>
    <div class="mc-bd"><div class="ib ib-b"><span class="i">🖨️</span>请选择标签打印机使用的<b>标签纸张大小</b>，与实际装纸一致；<b>选择后方可打印标签</b>。</div>
    <div class="fr"><label class="fl"><b>*</b>标签纸张大小</label><select id="lp-paper"><option value="" ${!DB.labelPaper?'selected':''}>请选择纸张大小</option>${PAPERS.map(x=>`<option ${DB.labelPaper==x?'selected':''}>${x}</option>`).join('')}</select></div>
    <div class="ib ib-gr" style="margin-top:8px"><span class="i">ℹ️</span>更换标签纸后请回此重新选择，否则可能打印错位。</div></div>
    <div class="mc-ft"><button class="btn btn-o" onclick="closeModal()">取消</button><button class="btn btn-p" onclick="label_savePaper()">保存设置</button></div>`);};
  window.label_savePaper=function(){const v=(document.getElementById('lp-paper')||{}).value;if(!v){toast('请选择标签纸张大小','err');return;}DB.labelPaper=v;closeModal();render();toast('已设置标签纸张：'+v,'ok');};
  function ensurePaper(){if(!DB.labelPaper){toast('请先在「打印机设置」选择标签纸张大小，选完才能打印','err');label_paperModal();return false;}return true;}
  // 打印：一个 SKU 按应送货数量打 N 个连续序号的码；首打/续打从 已打印+1 到 N
  window.label_printOne=function(key){if(!ensurePaper())return;DB.labelPrinted=DB.labelPrinted||{};DB.labelLast=DB.labelLast||{};const r=labelRows().find(x=>x.key==key);if(!r)return;if(wgBlocked(r)){wgDeny(r);return;}const old=printedOf(key);if(old>=r.qty){toast('该商品标签已全部打印，如漏打请用「补打」','info');return;}DB.labelLast[key]=r.qty-old;DB.labelPrinted[key]=r.qty;const made=labelTriggerDelivery([key]);render();toast(`已打印「${r.name}」序号 ${old+1}–${r.qty}，共 ${r.qty-old} 张标签${r.wgNeed?'（印实发净重，不含订单信息）':''}${made.length?`；已自动生成送货单 ${made.join('、')}`:''}`,'ok');};
  window.label_printAll=function(){if(!ensurePaper())return;DB.labelPrinted=DB.labelPrinted||{};DB.labelLast=DB.labelLast||{};let n=0,blk=0;const done=[];labelRows().forEach(r=>{if(wgBlocked(r)){blk++;return;}const old=printedOf(r.key);if(old<r.qty){DB.labelLast[r.key]=r.qty-old;DB.labelPrinted[r.key]=r.qty;n+=r.qty-old;done.push(r.key);}});const made=labelTriggerDelivery(done);render();toast(n?`批量打印完成，共 ${n} 张标签${made.length?`；已自动生成送货单 ${made.join('、')}`:''}${blk?`；${blk} 个商品因未完成称重被拦截`:''}`:(blk?`${blk} 个商品未完成称重，无法打印`:'无待打印标签'),blk&&!n?'err':'ok');};
  // 按序号打印：先勾选一个 SKU，再点顶部「按序号打印」→ 弹窗填序号区间 [从X 到Y]（漏打时也用它补打）
  window.label_bySeqPrint=function(){if(!ensurePaper())return;const keys=labelRows().map(r=>r.key);const sel=(DB.labelSel||[]).filter(k=>keys.includes(k));
    if(sel.length==0){toast('请先勾选一个商品，再点「按序号打印」','err');return;}
    if(sel.length>1){toast('「按序号打印」每次只支持一个商品，请只勾选一个','err');return;}
    const rr=labelRows().find(x=>x.key==sel[0]);if(rr&&wgBlocked(rr)){wgDeny(rr);return;}
    label_seqModal(sel[0]);};
  window.label_seqModal=function(key){const r=labelRows().find(x=>x.key==key);if(!r)return;const N=r.qty;const pr=Math.min(N,printedOf(key));
    modal(`<div class="mc-hd"><h3>按序号打印 · ${r.name}</h3><p>${specLabel(r)}（${r.sku}） · 本 SKU 共 <b>${N}</b> 张标签，序号 1–${N}${pr?` · 已打印至 ${pr}`:''}</p><button class="mc-x" onclick="closeModal()">×</button></div>
    <div class="mc-bd">
      <div class="ib ib-y"><span class="i">🏷️</span>一个 SKU 按应送货数量打 ${N} 个码、序号连续；填写需打印/补打的<b>序号区间</b>，漏打哪几张就填哪段。</div>
      <div class="row" style="gap:10px;align-items:flex-end">
        <div class="fr" style="flex:1;margin:0"><label class="fl">起始序号</label><input id="rp-from" type="number" min="1" max="${N}" value="${Math.min(pr+1,N)}"></div>
        <div style="padding-bottom:9px;color:var(--ts)">—</div>
        <div class="fr" style="flex:1;margin:0"><label class="fl">结束序号</label><input id="rp-to" type="number" min="1" max="${N}" value="${N}"></div>
      </div>
    </div>
    <div class="mc-ft"><button class="btn btn-o" onclick="closeModal()">取消</button><button class="btn btn-p" onclick="label_doSeqPrint('${key}')">打印</button></div>`);};
  window.label_doSeqPrint=function(key){const r=labelRows().find(x=>x.key==key);if(!r)return;if(wgBlocked(r)){closeModal();wgDeny(r);return;}const N=r.qty;
    const from=parseInt((document.getElementById('rp-from')||{}).value,10),to=parseInt((document.getElementById('rp-to')||{}).value,10);
    if(isNaN(from)||isNaN(to)||from<1||to>N||from>to){toast(`请填写有效序号区间（1–${N}，起始 ≤ 结束）`,'err');return;}
    DB.labelPrinted=DB.labelPrinted||{};DB.labelLast=DB.labelLast||{};
    DB.labelPrinted[key]=Math.max(printedOf(key),to);DB.labelLast[key]=to-from+1;DB.labelSel=[];
    const made=labelTriggerDelivery([key]);closeModal();render();toast(`已按序号打印「${r.name}」序号 ${from}–${to}，共 ${to-from+1} 张标签${made.length?`；已自动生成送货单 ${made.join('、')}`:''}`,'ok');};
  // 勾选 → 批量打印（只打勾选项，最多 50 个）
  window.label_toggleSel=function(key){DB.labelSel=DB.labelSel||[];const i=DB.labelSel.indexOf(key);if(i<0)DB.labelSel.push(key);else DB.labelSel.splice(i,1);render();};
  window.label_selAll=function(){DB.labelSel=DB.labelSel||[];const keys=labelRows().map(r=>r.key);const all=keys.length&&keys.every(k=>DB.labelSel.includes(k));DB.labelSel=all?[]:keys.slice();render();};
  window.label_printSel=function(){if(!ensurePaper())return;DB.labelPrinted=DB.labelPrinted||{};DB.labelLast=DB.labelLast||{};const keys=labelRows().map(r=>r.key);const sel=(DB.labelSel||[]).filter(k=>keys.includes(k));if(!sel.length){toast('请先勾选要打印的商品','err');return;}if(sel.length>50){toast('每次最多支持 50 个商品批量打印','err');return;}let n=0,blk=0;const done=[];labelRows().forEach(r=>{if(!sel.includes(r.key))return;if(wgBlocked(r)){blk++;return;}const old=printedOf(r.key);if(old<r.qty){DB.labelLast[r.key]=r.qty-old;DB.labelPrinted[r.key]=r.qty;n+=r.qty-old;done.push(r.key);}});const made=labelTriggerDelivery(done);DB.labelSel=[];render();toast(n?`批量打印完成，共 ${sel.length-blk} 个商品 ${n} 张标签${made.length?`；已自动生成送货单 ${made.join('、')}`:''}${blk?`；${blk} 个因未完成称重被拦截`:''}`:(blk?`所选 ${blk} 个商品未完成称重，无法打印`:'所选商品标签均已打印'),blk&&!n?'err':'ok');};

  function labelView(){
    DB.labelF=DB.labelF||{};DB.labelPrinted=DB.labelPrinted||{};DB.labelLast=DB.labelLast||{};
    const f=DB.labelF;
    const dates=refDates();if(f.date===undefined)f.date=dates[0]||'';
    const whs=refWarehouses();if(f.wh===undefined)f.wh=whs[0]||'';
    const rows=labelRows();
    const blocked=rows.filter(wgBlocked).length;
    const should=rows.reduce((a,r)=>a+r.qty,0);
    const printed=rows.reduce((a,r)=>a+Math.min(r.qty,printedOf(r.key)),0);
    const unpr=should-printed;
    DB.labelSel=DB.labelSel||[];const selKeys=rows.map(r=>r.key);const sel=DB.labelSel.filter(k=>selKeys.includes(k));const selN=sel.length;const allSel=selKeys.length&&selKeys.every(k=>sel.includes(k));
    const optSel=(cur,list,ph)=>`<option value="">${ph}</option>`+list.map(v=>`<option ${cur==v?'selected':''}>${v}</option>`).join('');
    return `
    ${!DB.labelPaper?`<div class="ib ib-y" style="margin-bottom:12px"><span class="i">🖨️</span><b>尚未设置打印机纸张</b>，需先选择标签纸张大小后才能打印标签。<button class="btn btn-link btn-sm" onclick="label_paperModal()">去设置 →</button></div>`:''}
    <div class="ib ib-b" style="margin-bottom:12px"><span class="i">ℹ️</span>由于订单延迟支付/取消，请以仓库展示销量停止为准。<b>多退少补商品</b>（按重量定价）按 SKU 打标、印<b>实发净重</b>，不含订单/客户信息——货到仓库由 WMS 统一重新分拣分配到各订单。<br><b>应送货 = 订单量 + 预送量</b>：预送量于 16:00 定稿（见「预送确认」），标签形态与订单货完全一致（按 SKU 一件一张、不含订单/客户信息），到仓后由 WMS <b>先满足订单、余量入你的在仓预送库存</b>。<b>建议 16:00 预送量定稿后再打印</b>，提前打印需在定稿后补打预送部分。</div>
    ${blocked?`<div class="ib ib-r" style="margin-bottom:12px"><span class="i">⛔</span><b>${blocked} 个商品因未完成称重被拦截，无法打印标签。</b>多退少补（按重量定价）商品必须先录实发净重——打印首张标签即自动生成送货单，届时重量已无法再改。<button class="btn btn-link btn-sm" onclick="nav('m-pick-weigh')">去称重录入 →</button></div>`:''}
    <div class="card" style="margin-bottom:14px"><div class="card-bd" style="padding:0">
      <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid var(--bd2);padding:0 16px;flex-wrap:wrap">
        <div class="tabs" style="margin:0;border:none">
          <div class="tab ${DB.labelTab!='product'?'active':''}" onclick="DB.labelTab='sales';render()">按销量打印</div>
          <div class="tab ${DB.labelTab=='product'?'active':''}" onclick="DB.labelTab='product';render()">按商品打印</div>
        </div>
        <div style="display:flex;gap:16px;font-size:12.5px;padding:6px 0">
          <span class="btn btn-link" onclick="nav('m-delivery')">查看预约送货时间</span>
          <span class="btn btn-link" onclick="label_paperModal()">🖨️ 打印机设置 · ${DB.labelPaper?`<b style="color:var(--gd)">${DB.labelPaper}</b>`:'<b style="color:var(--r)">未设置纸张</b>'}</span>
        </div>
      </div>
      <div style="display:flex;gap:16px;align-items:flex-end;flex-wrap:wrap;padding:14px 16px">
        <div><div style="font-size:12px;color:var(--ts);margin-bottom:5px">配送日期</div><select onchange="DB.labelF.date=this.value;render()" style="min-width:140px">${dates.map(d=>`<option ${f.date==d?'selected':''}>${d}</option>`).join('')||'<option>无</option>'}</select></div>
        <div><div style="font-size:12px;color:var(--ts);margin-bottom:5px">履约波次</div><select onchange="DB.labelF.wave=this.value;render()" style="min-width:120px">${optSel(f.wave||'',['上午达','下午达'],'全部')}</select></div>
        <div><div style="font-size:12px;color:var(--ts);margin-bottom:5px">仓库</div><select onchange="DB.labelF.wh=this.value;render()" style="min-width:150px">${optSel(f.wh||'',whs,'全部仓库')}</select></div>
        <div><div style="font-size:12px;color:var(--ts);margin-bottom:5px">商品名称</div><input id="lbl-name" value="${f.name||''}" placeholder="请输入" onkeydown="if(event.key=='Enter'){DB.labelF.name=this.value.trim();render()}" style="min-width:160px"></div>
        <button class="btn btn-p btn-sm" onclick="DB.labelF.name=(document.getElementById('lbl-name')||{}).value.trim();render()">查询</button>
        <button class="btn btn-o btn-sm" onclick="DB.labelF={};DB.labelSel=[];render()">重置</button>
      </div>
    </div></div>
    <div class="card"><div class="card-hd" style="flex-wrap:wrap;gap:10px">
      <div class="row" style="gap:8px;flex-wrap:wrap;align-items:center">
        <button class="btn btn-p btn-sm" ${selN?'':'disabled'} onclick="label_printSel()">批量打印${selN?`（已选 ${selN}）`:''}</button>
        <button class="btn btn-p btn-sm" onclick="label_bySeqPrint()">按序号打印</button>
        <button class="btn btn-o btn-sm" onclick="toast('已导出应送货标签清单.xlsx','ok')">应送货导出</button>
        <span style="font-size:12px;color:var(--r)">每次最多支持 50 个商品进行批量打印标签</span>
      </div>
      <div class="row" style="gap:14px;font-size:12.5px;align-items:center">
        <span>全部仓未打印：<b style="color:var(--r)">${allUnprinted()}</b></span>
        <button class="btn btn-o btn-sm" onclick="toast('全部仓打印进度：已打印 ${printed} / 应送货 ${should}','info')">全部仓打印进度</button>
      </div>
    </div>
    <div class="card-bd" style="padding:10px 16px;display:flex;gap:22px;font-size:13px;border-bottom:1px solid var(--bd2);flex-wrap:wrap;align-items:center">
      <span>应送货：<b>${should}</b></span><span>其中预送：<b style="color:var(--gold)">${rows.reduce((a,r)=>a+(r.psQty||0),0)}</b></span><span>已打印：<b style="color:var(--gd)">${printed}</b></span><span>未打印：<b style="color:var(--r)">${unpr}</b></span><span>未称重拦截：<b style="color:${blocked?'var(--r)':'var(--ts)'}">${blocked}</b></span><span>超量：<b>0</b></span><span class="tag t-y" style="font-size:11px">未截单</span>
    </div>
    <div class="card-bd flush"><div style="overflow-x:auto"><table>
      <thead><tr><th style="width:34px"><input type="checkbox" title="全选本页商品" ${allSel?'checked':''} onclick="label_selAll()"></th><th style="width:44px">序号</th><th>商品名称</th><th>规格(编码)</th><th>分类</th><th style="text-align:right">昨日销量</th><th style="text-align:right">应送货</th><th style="text-align:right">已打印数</th><th style="text-align:right">未打印数</th><th style="text-align:right">本次打印数</th><th>操作</th></tr></thead><tbody>
      ${rows.map((r,i)=>{const pr=Math.min(r.qty,printedOf(r.key));const un=r.qty-pr;const last=DB.labelLast[r.key]||0;const done=un<=0;return `<tr>
        <td><input type="checkbox" ${sel.includes(r.key)?'checked':''} onclick="label_toggleSel('${r.key}')"></td>
        <td>${i+1}</td>
        <td><b>${r.name}</b>${done?' <span class="tag t-g" style="font-size:10px">打印完成</span>':''}${wgBlocked(r)?` <span class="tag t-r" style="font-size:10px">待称重 ${r.wgWait}</span>`:(r.wgNeed?' <span class="tag t-g" style="font-size:10px">已称重</span>':'')}</td>
        <td>${specLabel(r)} <span style="color:var(--ts)">(${r.sku})</span></td>
        <td style="font-size:12px;color:var(--ts)">${r.cat}</td>
        <td style="text-align:right">${yday(r.sku)}</td>
        <td style="text-align:right"><b>${r.qty}</b><div style="font-size:11px;color:var(--ts)">订单 ${r.ordQty}${r.psQty?` · <span style="color:var(--gold)">预送 ${r.psQty}</span>`:''}</div><div style="font-size:11px;color:var(--tt)">${r.wgNeed&&!wgBlocked(r)?`实发 ${r.wgReal.toFixed(1)}kg`:`序号 1–${r.qty}`}</div></td>
        <td style="text-align:right;color:var(--gd)">${pr}</td>
        <td style="text-align:right;${un>0?'color:var(--r);font-weight:600':''}">${un}</td>
        <td style="text-align:right">${last||(un>0?un:'—')}</td>
        <td style="white-space:nowrap">${un<=0?'<span style="color:var(--ts)">打印完成</span>':(wgBlocked(r)
          ?`<button class="btn btn-p btn-sm" disabled title="该商品有 ${r.wgWait} 个订单未录实发净重，完成称重后才能打印">打印</button> <button class="btn btn-link btn-sm" onclick="nav('m-pick-weigh')">去称重</button>`
          :`<button class="btn btn-p btn-sm" onclick="label_printOne('${r.key}')">打印</button>`)}</td>
      </tr>`;}).join('')||`<tr><td colspan="11"><div class="empty"><div class="e-ic">🏷️</div><div class="e-t">该筛选下暂无应送货标签</div><div class="e-s">切换配送日期/仓库，或到「订单履约」模拟来一单。</div></div></td></tr>`}
      </tbody></table></div></div></div>`;
  }

  /* ============================================================
     按商品打印（预贴标签）—— 不绑送货单/备货单
     - 二维码不含备货单号；普通品张张相同，多退少补每张带唯一标签号 + 本袋净重
     - 不计入备货单的已打张数/序号，不触发送货单生成
     - 到仓由 WMS 扫码后按数量逻辑匹配到当日送货单（沈亮 2026-09-10 定）
  ============================================================ */
  function preSkus(){
    const out=[];
    (DB.products||[]).forEach(p=>{
      if(p.status!='onsale')return;
      (p.skus||[]).forEach(s=>{
        if(s.off)return;
        out.push({sku:s.skuId,name:p.name,cat:p.cat,
          spec:`${s.qty}${p.unit}/${s.packUnit||'件'}`,
          weigh:s.refund==1,specQty:s.qty,unit:p.unit,sellUnit:s.sellUnit||p.unit});
      });
    });
    return out;
  }
  function preOf(sku){return preSkus().find(x=>x.sku==sku);}
  function preNextId(){DB.preSeq=(DB.preSeq||0)+1;return 'PL2609'+String(DB.preSeq).padStart(5,'0');}
  function preList(){return DB.preLabels||(DB.preLabels=[]);}
  function preNow(){const d=new Date();return '2026-09-10 '+String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0');}

  /* ── 待打印清单（购物车式，支持批量录入 SKU）───────────────────── */
  function preCart(){return DB.preCart||(DB.preCart=[]);}
  function cartIdx(sku){return preCart().findIndex(x=>x.sku==sku);}
  function preDefQty(){return DB.preLastQty||10;}
  // 加一个 SKU 进清单；已在清单里则普通品累加张数、多退少补提示已存在
  function cartAdd(sku,qty){
    const r=preOf(sku);if(!r)return {ok:false,why:'not-found'};
    const i=cartIdx(sku);
    if(i>=0){
      if(!r.weigh)preCart()[i].qty=Math.min(MAX_PRE,preCart()[i].qty+(qty||preDefQty()));
      return {ok:true,dup:true,name:r.name};
    }
    preCart().push({sku:r.sku,name:r.name,spec:r.spec,weigh:r.weigh,specQty:r.specQty,unit:r.sellUnit,
      qty:r.weigh?0:(qty||preDefQty())});
    return {ok:true,name:r.name};
  }
  // 输入串 → SKU：支持商品编码、商品名称（含模糊），不区分大小写
  function resolveSku(tok){
    const t=String(tok||'').trim();if(!t)return null;
    const all=preSkus();
    return (all.find(x=>x.sku.toLowerCase()==t.toLowerCase())
      ||all.find(x=>x.name==t)
      ||all.find(x=>x.name.includes(t))
      ||null);
  }

  window.pre_scanAdd=function(){
    const el=document.getElementById('pre-scan');const v=(el||{}).value||'';
    if(!v.trim()){if(el)el.focus();return;}
    const hit=resolveSku(v);
    if(!hit){toast(`没找到「${v.trim()}」对应的在售商品，请核对编码或名称`,'err');if(el){el.select();}return;}
    const r=cartAdd(hit.sku);
    DB.preSku=hit.weigh?hit.sku:DB.preSku;      // 多退少补自动切到它，直接开始称
    render();
    // 重渲后把光标弹回扫码框，支持扫码枪连扫
    const n=document.getElementById('pre-scan');if(n){n.value='';n.focus();}
    toast(r.dup?`「${hit.name}」已在清单中${hit.weigh?'':'，张数已累加'}`:`已加入清单：${hit.name}`,r.dup?'info':'ok');
  };
  window.pre_pickAdd=function(v){
    if(!v)return;const hit=preOf(v);if(!hit)return;
    const r=cartAdd(v);
    if(hit.weigh)DB.preSku=v;
    render();toast(r.dup?`「${hit.name}」已在清单中${hit.weigh?'':'，张数已累加'}`:`已加入清单：${hit.name}`,r.dup?'info':'ok');
  };
  // 批量粘贴：一行一个，支持「编码」或「编码,张数」（逗号/空格/Tab 均可），可从 Excel 直接贴两列
  window.pre_pasteModal=function(){
    modal(`<div class="mc-hd"><h3>批量录入商品</h3><p>一行一个，支持「商品编码」或「商品编码 + 打印张数」两列</p><button class="mc-x" onclick="closeModal()">×</button></div>
    <div class="mc-bd">
      <div class="ib ib-b"><span class="i">📋</span>可直接从 Excel 复制两列粘进来；分隔符支持<b>逗号 / 空格 / Tab</b>。只写编码时按默认 <b>${preDefQty()}</b> 张；<b>多退少补商品张数忽略</b>，加进清单后逐袋称重打印。</div>
      <div class="fr" style="margin-top:10px"><label class="fl">商品编码清单</label>
        <textarea id="pre-paste" rows="8" placeholder="SKU8816,20&#10;SKU8815&#10;小棠菜 15"></textarea></div>
    </div>
    <div class="mc-ft"><button class="btn btn-o" onclick="closeModal()">取消</button>
      <button class="btn btn-p" onclick="pre_pasteDo()">解析并加入清单</button></div>`);
    setTimeout(()=>{const t=document.getElementById('pre-paste');if(t)t.focus();},60);
  };
  window.pre_pasteDo=function(){
    const raw=(document.getElementById('pre-paste')||{}).value||'';
    const rows=raw.split(/[\n\r;]+/).map(x=>x.trim()).filter(Boolean);
    if(!rows.length){toast('请先粘贴商品编码','err');return;}
    let added=0,dup=0;const bad=[];
    rows.forEach(line=>{
      const parts=line.split(/[,，\t ]+/).filter(Boolean);
      const hit=resolveSku(parts[0]);
      if(!hit){bad.push(line);return;}
      const q=parts.length>1?parseInt(parts[1],10):0;
      const r=cartAdd(hit.sku,(q>=1&&q<=MAX_PRE)?q:0);
      if(r.dup)dup++;else added++;
    });
    closeModal();render();
    if(bad.length)toast(`已加入 ${added} 项${dup?`，${dup} 项已在清单`:''}；${bad.length} 行没认出：${bad.slice(0,3).join('、')}${bad.length>3?' 等':''}`,'err');
    else toast(`已加入 ${added} 项${dup?`，${dup} 项已在清单（普通品张数已累加）`:''}`,'ok');
  };
  window.pre_cartQty=function(sku,v){
    const i=cartIdx(sku);if(i<0)return;
    const n=parseInt(v,10);
    preCart()[i].qty=(n>=1&&n<=MAX_PRE)?n:0;
    if(n>=1&&n<=MAX_PRE)DB.preLastQty=n;
    render();
  };
  window.pre_cartDel=function(sku){const i=cartIdx(sku);if(i<0)return;
    const nm=preCart()[i].name;preCart().splice(i,1);if(DB.preSku==sku)DB.preSku='';render();toast(`已移出清单：${nm}`,'info');};
  window.pre_cartClear=function(){
    if(!preCart().length)return;
    modal(`<div class="mc-hd"><h3>清空待打印清单</h3><button class="mc-x" onclick="closeModal()">×</button></div>
    <div class="mc-bd"><div class="ib ib-y"><span class="i">⚠️</span>将移除清单里全部 <b>${preCart().length}</b> 项，已打印的标签与台账不受影响。</div></div>
    <div class="mc-ft"><button class="btn btn-o" onclick="closeModal()">取消</button>
      <button class="btn btn-d" onclick="DB.preCart=[];DB.preSku='';closeModal();render();toast('已清空清单','info')">确认清空</button></div>`);
  };
  window.pre_weighStart=function(sku){DB.preSku=sku;render();
    setTimeout(()=>{const el=document.getElementById('pre-w');if(el)el.focus();},60);};

  /* ── 打印 ────────────────────────────────────────────────────── */
  // 普通品批量打印：清单里所有普通品一次打完，一个 SKU 一条台账
  window.pre_printBatch=function(){
    if(!ensurePaper())return;
    const normals=preCart().filter(x=>!x.weigh&&x.qty>=1);
    const weighs=preCart().filter(x=>x.weigh);
    if(!normals.length){toast(weighs.length?'清单里只有多退少补商品，需逐袋称重打印':'清单里没有可批量打印的普通商品','err');return;}
    const total=normals.reduce((a,x)=>a+x.qty,0);
    if(total>MAX_PRE){toast(`单次上限 ${MAX_PRE} 张，当前 ${total} 张，请减少张数或分批`,'err');return;}
    modal(`<div class="mc-hd"><h3>批量预贴打印</h3><p>共 ${normals.length} 个商品 · ${total} 张</p><button class="mc-x" onclick="closeModal()">×</button></div>
    <div class="mc-bd">
      <div class="ib ib-b"><span class="i">🏷️</span>预贴标签<b>不绑送货单/备货单</b>，同商品张张相同、无序号；不计入备货单打印进度。</div>
      <div style="overflow-x:auto;margin-top:10px"><table><thead><tr><th>商品编码</th><th>商品名称</th><th>规格</th><th style="text-align:right">张数</th></tr></thead>
      <tbody>${normals.map(x=>`<tr><td class="mono">${x.sku}</td><td><b>${x.name}</b></td><td>${x.spec}</td><td style="text-align:right"><b>${x.qty}</b></td></tr>`).join('')}</tbody></table></div>
      ${weighs.length?`<div class="ib ib-y" style="margin-top:10px"><span class="i">⚖️</span>清单里另有 <b>${weighs.length}</b> 个多退少补商品<b>不进批量</b>：每袋重量不同，需逐袋称重打印。</div>`:''}
    </div>
    <div class="mc-ft"><button class="btn btn-o" onclick="closeModal()">取消</button>
      <button class="btn btn-p" onclick="pre_doPrintBatch()">确认打印（${total} 张）</button></div>`);
  };
  window.pre_doPrintBatch=function(){
    const normals=preCart().filter(x=>!x.weigh&&x.qty>=1);
    let n=0;
    normals.forEach(x=>{preList().unshift({id:preNextId(),sku:x.sku,name:x.name,spec:x.spec,type:'normal',qty:x.qty,time:preNow(),status:'待使用'});n+=x.qty;});
    // 打完把普通品移出清单，留下多退少补待称
    DB.preCart=preCart().filter(x=>x.weigh);
    closeModal();render();
    toast(`已预贴打印 ${normals.length} 个商品共 ${n} 张（不绑送货单）`,'ok');
  };
  // 多退少补：一袋一称一打，回车即打；不整页重渲以保住输入焦点
  window.pre_printWeigh=function(){
    if(!ensurePaper())return;
    const r=preOf(DB.preSku);if(!r)return;
    const el=document.getElementById('pre-w');const w=parseFloat((el||{}).value);
    if(!(w>0)){toast('请输入本袋净重','err');if(el)el.focus();return;}
    const rec={id:preNextId(),sku:r.sku,name:r.name,spec:r.spec,type:'weigh',w:+w.toFixed(2),wUnit:r.sellUnit,qty:1,time:preNow(),status:'待使用'};
    preList().unshift(rec);
    const tb=document.getElementById('pre-batch');
    if(tb){
      const diff=+(w-r.specQty).toFixed(2);
      const tr=document.createElement('tr');
      tr.innerHTML=`<td class="mono">${rec.id}</td><td style="text-align:right"><b>${rec.w.toFixed(2)}</b> <span style="color:var(--ts)">${rec.wUnit}</span></td>`+
        `<td style="text-align:right;color:${diff>=0?'var(--gd)':'var(--y)'}">${diff>=0?'+':''}${diff.toFixed(2)}</td><td style="color:var(--ts)">${rec.time}</td>`;
      tb.insertBefore(tr,tb.firstChild);
      const c=document.getElementById('pre-cnt');if(c)c.textContent=preDone(r.sku);
      const cc=document.getElementById('pre-cart-'+r.sku);if(cc)cc.textContent=preDone(r.sku)+' 袋';
      const db=document.getElementById('pre-done-btn');if(db)db.style.display='';
      const cd=document.getElementById('pre-cart-done-'+r.sku);if(cd)cd.style.display='';
    }
    preLedgerSync(rec);
    if(el){el.value='';el.focus();}
    toast(`已打印 ${rec.id} · ${rec.w.toFixed(2)}${rec.wUnit}`,'ok');
  };
  function preDone(sku){return preList().filter(x=>x.sku==sku&&x.type=='weigh').length;}
  window.pre_weighDone=function(sku){
    const n=preDone(sku);
    if(!n){toast('该商品还没打过标签','err');return;}
    const i=cartIdx(sku);const nm=i>=0?preCart()[i].name:'';
    if(i>=0)preCart().splice(i,1);
    DB.preSku='';render();toast(`「${nm}」已完成 ${n} 袋预贴，已移出清单`,'ok');
  };

  function preLedgerRow(x){return `<tr>
        <td class="mono">${x.id}</td>
        <td class="mono">${x.sku}</td>
        <td><b>${x.name}</b></td>
        <td>${x.spec}</td>
        <td>${x.type=='weigh'?'<span class="tag t-y"><span class="dot"></span>多退少补</span>':'<span class="tag t-gr"><span class="dot"></span>普通</span>'}</td>
        <td style="text-align:right">${x.type=='weigh'?`<b>${x.w.toFixed(2)}</b> <span style="color:var(--ts)">${x.wUnit}</span>`:'<span style="color:var(--tt)">—</span>'}</td>
        <td style="text-align:right"><b>${x.qty}</b></td>
        <td style="text-align:right">${x.re?`<b style="color:var(--gold)">${x.re}</b>`:'<span style="color:var(--tt)">—</span>'}</td>
        <td style="color:var(--ts)">${x.time}</td>
        <td><span class="tag t-b"><span class="dot"></span>${x.status}</span></td>
        <td><button class="btn btn-o btn-sm" onclick="pre_reprint('${x.id}')">补打</button></td>
      </tr>`;}
  function preLedgerSync(rec){
    const tb=document.getElementById('pre-ledger');
    if(tb){const e=tb.querySelector('.empty');if(e)tb.innerHTML='';tb.insertAdjacentHTML('afterbegin',preLedgerRow(rec));}
    const h=document.getElementById('pre-ledger-cnt');
    if(h)h.textContent=`共 ${preList().length} 条 · ${preList().reduce((a,x)=>a+x.qty,0)} 张；到仓扫码后由 WMS 逻辑匹配到当日送货单`;
  }

  window.pre_reprint=function(id){
    if(!ensurePaper())return;
    const r=preList().find(x=>x.id==id);if(!r)return;
    modal(`<div class="mc-hd"><h3>补打预贴标签</h3><p>${r.name} · <span class="mono">${r.id}</span></p><button class="mc-x" onclick="closeModal()">×</button></div>
    <div class="mc-bd">
      ${r.type=='weigh'
        ?`<div class="ib ib-y"><span class="i">⚖️</span>该标签为多退少补预贴标签，带唯一标签号与本袋净重 <b>${r.w.toFixed(2)}${r.wUnit}</b>，补打<b>原样重出这一张</b>，不改重量、不发新号。</div>
          <div class="ib ib-gr" style="margin-top:8px"><span class="i">ℹ️</span>请销毁旧标签，避免同一标签号两张实物被重复扫码。</div>`
        :`<div class="ib ib-b"><span class="i">🏷️</span>该标签为普通预贴标签，同商品张张相同、无序号，按<b>张数</b>补打即可。</div>
          <div class="fr" style="margin-top:10px"><label class="fl"><b>*</b>补打张数</label><input id="pre-rq" type="number" min="1" max="${MAX_PRE}" value="${r.qty}"></div>`}
    </div>
    <div class="mc-ft"><button class="btn btn-o" onclick="closeModal()">取消</button>
      <button class="btn btn-p" onclick="pre_doReprint('${id}')">确认补打</button></div>`);
  };
  window.pre_doReprint=function(id){
    const r=preList().find(x=>x.id==id);if(!r)return;
    let n=1;
    if(r.type=='normal'){n=parseInt((document.getElementById('pre-rq')||{}).value,10);
      if(!(n>=1)||n>MAX_PRE){toast(`补打张数需为 1–${MAX_PRE} 的整数`,'err');return;}}
    r.re=(r.re||0)+n;closeModal();render();
    toast(r.type=='weigh'?`已原样补打 ${r.id}（${r.w.toFixed(2)}${r.wUnit}），请销毁旧标签`:`已补打「${r.name}」${n} 张`,'ok');
  };
  const MAX_PRE=200;   // BR：单次预贴打印/补打张数上限

  function preView(){
    DB.preLabels=DB.preLabels||[];DB.preCart=DB.preCart||[];
    const skus=preSkus();
    const cart=preCart();
    const cur=DB.preSku?preOf(DB.preSku):null;
    const curInCart=cur&&cartIdx(cur.sku)>=0;
    const batch=cur&&cur.weigh?preList().filter(x=>x.sku==cur.sku&&x.type=='weigh'):[];
    const list=preList();
    const normals=cart.filter(x=>!x.weigh&&x.qty>=1);
    const total=normals.reduce((a,x)=>a+x.qty,0);

    const cartBody=cart.map(x=>`<tr ${cur&&cur.sku==x.sku?'style="background:var(--gl)"':''}>
      <td class="mono">${x.sku}</td>
      <td><b>${x.name}</b></td>
      <td>${x.spec}</td>
      <td>${x.weigh?'<span class="tag t-y"><span class="dot"></span>多退少补</span>':'<span class="tag t-gr"><span class="dot"></span>普通</span>'}</td>
      <td style="text-align:right">${x.weigh
        ?'<span style="color:var(--ts)">逐袋称重</span>'
        :`<input type="number" min="1" max="${MAX_PRE}" value="${x.qty}" class="ministock" style="width:84px;text-align:right" onchange="pre_cartQty('${x.sku}',this.value)">`}</td>
      <td style="text-align:right">${x.weigh?`<b id="pre-cart-${x.sku}" style="color:var(--gd)">${preDone(x.sku)} 袋</b>`:'<span style="color:var(--tt)">—</span>'}</td>
      <td style="white-space:nowrap">${x.weigh
        ?`<button class="btn ${cur&&cur.sku==x.sku?'btn-o':'btn-p'} btn-sm" onclick="pre_weighStart('${x.sku}')">${cur&&cur.sku==x.sku?'称重中':'开始称重'}</button>
           <button class="btn btn-link btn-sm" id="pre-cart-done-${x.sku}" style="display:${preDone(x.sku)?'':'none'}" onclick="pre_weighDone('${x.sku}')">完成</button>`
        :''}
        <button class="btn btn-link btn-sm" onclick="pre_cartDel('${x.sku}')">移除</button></td>
    </tr>`).join('');

    return `
    <div class="card" style="margin-bottom:14px"><div class="card-bd" style="padding:0">
      <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid var(--bd2);padding:0 16px;flex-wrap:wrap">
        <div class="tabs" style="margin:0;border:none">
          <div class="tab" onclick="DB.labelTab='sales';render()">按销量打印</div>
          <div class="tab active">按商品打印</div>
        </div>
        <div style="display:flex;gap:16px;font-size:12.5px;padding:6px 0">
          <span class="btn btn-link" onclick="label_paperModal()">🖨️ 打印机设置 · ${DB.labelPaper?`<b style="color:var(--gd)">${DB.labelPaper}</b>`:'<b style="color:var(--r)">未设置纸张</b>'}</span>
        </div>
      </div>
      <div style="display:flex;gap:16px;align-items:flex-end;flex-wrap:wrap;padding:14px 16px">
        <div><div style="font-size:12px;color:var(--ts);margin-bottom:5px">扫码 / 输编码加入清单</div>
          <input id="pre-scan" placeholder="扫码枪扫一个加一个，或手输编码后回车" style="min-width:300px"
            onkeydown="if(event.key=='Enter'){event.preventDefault();pre_scanAdd()}"></div>
        <button class="btn btn-p btn-sm" onclick="pre_scanAdd()">加入清单</button>
        <button class="btn btn-o btn-sm" onclick="pre_pasteModal()">批量粘贴</button>
        <div><div style="font-size:12px;color:var(--ts);margin-bottom:5px">或从商品列表挑</div>
          <select onchange="pre_pickAdd(this.value);this.value=''" style="min-width:300px">
            <option value="">选择商品加入清单…</option>
            ${skus.map(x=>`<option value="${x.sku}">${x.name}（${x.sku}）· ${x.spec}${x.weigh?' · 多退少补':''}</option>`).join('')}
          </select></div>
      </div>
    </div></div>

    <div class="card" style="margin-bottom:14px"><div class="card-hd" style="flex-wrap:wrap;gap:10px">
      <div class="row" style="gap:8px;flex-wrap:wrap;align-items:center">
        <h3 style="margin-right:6px">待打印清单</h3>
        <button class="btn btn-p btn-sm" ${normals.length?'':'disabled'} onclick="pre_printBatch()">批量打印${total?`（${normals.length} 个商品 ${total} 张）`:''}</button>
        <button class="btn btn-o btn-sm" ${cart.length?'':'disabled'} onclick="pre_cartClear()">清空清单</button>
      </div>
      <span class="sub">不绑送货单/备货单，不计入备货单打印进度；多退少补需逐袋称重，不进批量</span>
    </div>
    <div class="card-bd flush"><div style="overflow-x:auto"><table>
      <thead><tr><th>商品编码</th><th>商品名称</th><th>规格</th><th>计价方式</th><th style="text-align:right">打印张数</th><th style="text-align:right">已打</th><th>操作</th></tr></thead>
      <tbody>${cartBody||`<tr><td colspan="7"><div class="empty"><div class="e-ic">🧾</div><div class="e-t">清单还是空的</div><div class="e-s">用扫码枪连扫、粘贴一列编码，或从商品列表挑几个加进来。</div></div></td></tr>`}</tbody>
    </table></div></div></div>

    ${cur&&cur.weigh&&curInCart?`
    <div class="card" style="margin-bottom:14px"><div class="card-hd">
      <h3>称重打印 · ${cur.name}</h3>
      <span class="sub">一袋一称一打，回车即打；每张带唯一标签号与本袋净重，二维码不含备货单号</span></div>
      <div class="card-bd">
        <div class="row" style="gap:10px;align-items:flex-end">
          <div class="fr" style="flex:0 0 220px;margin:0"><label class="fl"><b>*</b>本袋净重（${cur.sellUnit}）</label>
            <input id="pre-w" type="number" step="0.01" min="0" placeholder="过秤后输入，回车即打"
              onkeydown="if(event.key=='Enter'){event.preventDefault();pre_printWeigh()}"></div>
          <button class="btn btn-p" onclick="pre_printWeigh()">打印并继续</button>
          <div style="padding-bottom:9px;font-size:12px;color:var(--ts)">一件应发 ${cur.specQty}${cur.sellUnit} · 本商品已预贴 <b id="pre-cnt">${batch.length}</b> 张</div>
          <div style="padding-bottom:6px;margin-left:auto"><button class="btn btn-o btn-sm" id="pre-done-btn" style="display:${batch.length?'':'none'}" onclick="pre_weighDone('${cur.sku}')">这个商品称完了</button></div>
        </div>
        <div style="overflow-x:auto;max-height:240px;overflow-y:auto;border:1px solid var(--bd2);border-radius:8px;margin-top:12px"><table>
          <thead><tr><th>标签号</th><th style="text-align:right">本袋净重</th><th style="text-align:right">差异</th><th>打印时间</th></tr></thead>
          <tbody id="pre-batch">${batch.map(b=>{const d=+(b.w-cur.specQty).toFixed(2);
            return `<tr><td class="mono">${b.id}</td><td style="text-align:right"><b>${b.w.toFixed(2)}</b> <span style="color:var(--ts)">${b.wUnit}</span></td><td style="text-align:right;color:${d>=0?'var(--gd)':'var(--y)'}">${d>=0?'+':''}${d.toFixed(2)}</td><td style="color:var(--ts)">${b.time}</td></tr>`;}).join('')}</tbody>
        </table></div>
      </div></div>`:''}

    <div class="card"><div class="card-hd"><h3>预贴标签台账</h3>
      <span class="sub" id="pre-ledger-cnt">共 ${list.length} 条 · ${list.reduce((a,x)=>a+x.qty,0)} 张；到仓扫码后由 WMS 逻辑匹配到当日送货单</span></div>
    <div class="card-bd flush"><div style="overflow-x:auto"><table>
      <thead><tr><th>标签号</th><th>商品编码</th><th>商品名称</th><th>规格</th><th>计价方式</th><th style="text-align:right">本袋净重</th><th style="text-align:right">张数</th><th style="text-align:right">已补打</th><th>打印时间</th><th>状态</th><th>操作</th></tr></thead>
      <tbody id="pre-ledger">${list.map(preLedgerRow).join('')||`<tr><td colspan="11"><div class="empty"><div class="e-ic">🏷️</div><div class="e-t">还没有预贴标签</div><div class="e-s">上方选商品后打印，这里会留下台账，仓库补打也照这份台账查。</div></div></td></tr>`}
      </tbody></table></div></div></div>`;
  }

  // 菜单①：备货参考（快驴式决策表，纯查看）
  PAGES['m-pick-ref']=()=>{ ensurePickOrders(); return refView(); };
  // 菜单③：打印标签（快驴式 productLabelPrint 复刻）
  PAGES['m-pick-label']=()=>{ ensurePickOrders(); return DB.labelTab=='product'?preView():labelView(); };
  // 菜单②：备货单（单据链：备货→贴码→送货）
  PAGES['m-pick']=()=>{
    ensurePickOrders();
    const p=DB.pickView&&DB.pickOrders.find(x=>x.id==DB.pickView);
    return p?detailView(p):listView();
  };
})();
