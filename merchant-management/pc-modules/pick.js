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
        return `<tr>${lead}<td>${wh}</td><td style="text-align:right">${whStock(s.sku,wh)}</td><td style="text-align:right;color:var(--ts)">${hist(s.sku,wh)}</td><td style="text-align:right"><b>${q}</b> ${s.unit}</td></tr>`;
      }).join('');
    }).join('');

    return `
    <div class="ib ib-b" style="margin-bottom:14px"><span class="i">📊</span><div><b>备货参考</b>：系统按<b>送达日</b>把待发货订单聚合到「SKU × 仓库」，各仓一行给出需备量、库存与历史销量，辅助你决定备多少。此表<b>只做参考不生成单据</b>，实际打印标签在「打印标签」菜单，打印首个标签后系统自动生成送货单。</div></div>
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
      <thead><tr><th style="width:44px">序号</th><th>商品名称</th><th>规格</th><th>分类</th><th style="text-align:right">合计销量</th><th>仓库</th><th style="text-align:right">库存总数</th><th style="text-align:right">昨日销量</th><th style="text-align:right">销量</th></tr></thead>
      <tbody>${body||`<tr><td colspan="9"><div class="empty"><div class="e-ic">📭</div><div class="e-t">该配送日/筛选下暂无待备货订单</div><div class="e-s">切换配送日期，或到「订单履约」点「＋ 模拟来一单」。</div></div></td></tr>`}</tbody>
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
    return Object.values(agg);
  }
  function printedOf(key){return (DB.labelPrinted||{})[key]||0;}
  // 多退少补标签行的逐订单明细（每单一份货一张标签；标签印 客户+订单尾号+实发净重，贴前核对重量防贴错）
  function labelOrdersOf(r){
    const f=DB.labelF||{};const parts=String(r.key).split('|'),wh=parts[0],sku=parts[1];const out=[];
    refOrders().forEach(o=>{
      if(f.date&&o.deliver!=f.date)return;if(o.warehouse!=wh)return;if(f.wave&&waveOf(o)!=f.wave)return;
      (o.lines||[]).forEach(l=>{if(l.sku!=sku)return;
        const st=(typeof weighLineState=='function')?weighLineState(o,l):'na';
        const real=(typeof weighRealOf=='function')?weighRealOf(o,l):null;
        out.push({o,l,st,real});});
    });
    return out;
  }
  function wgBlocked(r){return (r.wgWait||0)>0;}
  function wgDeny(r){toast(`「${r.name}」还有 ${r.wgWait} 个订单未录实发净重。多退少补商品需先在「备货管理 › 称重录入」完成称重才能打印标签`,'err');}
  function allUnprinted(){DB.labelPrinted=DB.labelPrinted||{};const f=DB.labelF||{};const agg={};refOrders().forEach(o=>{if(f.date&&o.deliver!=f.date)return;(o.lines||[]).forEach(l=>{const key=o.warehouse+'|'+l.sku;agg[key]=(agg[key]||0)+l.qty;});});return Object.entries(agg).reduce((s,[k,q])=>s+Math.max(0,q-(DB.labelPrinted[k]||0)),0);}
  // 打印标签触发送货单自动生成：某(配送日期+入库仓库)首次打印标签时，按仓自动生成送货单（已存在不重复）
  function labelTriggerDelivery(keys){if(typeof window.genDeliveryOnPrint!='function')return[];const date=(DB.labelF&&DB.labelF.date)||'';const whs=[...new Set(keys.map(k=>String(k).split('|')[0]))];const made=[];
    whs.forEach(wh=>{
      // 整仓门禁：该仓还有多退少补商品未录实发净重时不生成送货单——避免"送货单已开、货还没称完"
      if(typeof window.weighWhPending=='function'&&window.weighWhPending(date,wh)>0)return;
      const id=window.genDeliveryOnPrint(date,wh);if(id)made.push(id);});
    return made;}
  // 打印：一个 SKU 按应送货数量打 N 个连续序号的码；首打/续打从 已打印+1 到 N
  window.label_printOne=function(key){DB.labelPrinted=DB.labelPrinted||{};DB.labelLast=DB.labelLast||{};const r=labelRows().find(x=>x.key==key);if(!r)return;if(wgBlocked(r)){wgDeny(r);return;}const old=printedOf(key);if(old>=r.qty){toast('该商品标签已全部打印，如漏打请用「补打」','info');return;}DB.labelLast[key]=r.qty-old;DB.labelPrinted[key]=r.qty;const made=labelTriggerDelivery([key]);render();const desc=r.wgNeed?`${labelOrdersOf(r).length} 张逐订单标签（各印客户+订单尾号+实发净重）`:`序号 ${old+1}–${r.qty}，共 ${r.qty-old} 张标签`;toast(`已打印「${r.name}」${desc}${made.length?`；已自动生成送货单 ${made.join('、')}`:''}`,'ok');};
  window.label_printAll=function(){DB.labelPrinted=DB.labelPrinted||{};DB.labelLast=DB.labelLast||{};let n=0,blk=0;const done=[];labelRows().forEach(r=>{if(wgBlocked(r)){blk++;return;}const old=printedOf(r.key);if(old<r.qty){DB.labelLast[r.key]=r.qty-old;DB.labelPrinted[r.key]=r.qty;n+=r.qty-old;done.push(r.key);}});const made=labelTriggerDelivery(done);render();toast(n?`批量打印完成，共 ${n} 张标签${made.length?`；已自动生成送货单 ${made.join('、')}`:''}${blk?`；${blk} 个商品因未完成称重被拦截`:''}`:(blk?`${blk} 个商品未完成称重，无法打印`:'无待打印标签'),blk&&!n?'err':'ok');};
  // 按序号打印：先勾选一个 SKU，再点顶部「按序号打印」→ 弹窗填序号区间 [从X 到Y]（漏打时也用它补打）
  window.label_bySeqPrint=function(){const keys=labelRows().map(r=>r.key);const sel=(DB.labelSel||[]).filter(k=>keys.includes(k));
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
  window.label_printSel=function(){DB.labelPrinted=DB.labelPrinted||{};DB.labelLast=DB.labelLast||{};const keys=labelRows().map(r=>r.key);const sel=(DB.labelSel||[]).filter(k=>keys.includes(k));if(!sel.length){toast('请先勾选要打印的商品','err');return;}if(sel.length>50){toast('每次最多支持 50 个商品批量打印','err');return;}let n=0,blk=0;const done=[];labelRows().forEach(r=>{if(!sel.includes(r.key))return;if(wgBlocked(r)){blk++;return;}const old=printedOf(r.key);if(old<r.qty){DB.labelLast[r.key]=r.qty-old;DB.labelPrinted[r.key]=r.qty;n+=r.qty-old;done.push(r.key);}});const made=labelTriggerDelivery(done);DB.labelSel=[];render();toast(n?`批量打印完成，共 ${sel.length-blk} 个商品 ${n} 张标签${made.length?`；已自动生成送货单 ${made.join('、')}`:''}${blk?`；${blk} 个因未完成称重被拦截`:''}`:(blk?`所选 ${blk} 个商品未完成称重，无法打印`:'所选商品标签均已打印'),blk&&!n?'err':'ok');};

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
    <div class="ib ib-b" style="margin-bottom:12px"><span class="i">ℹ️</span>由于订单延迟支付/取消，请以仓库展示销量停止为准。<b>多退少补商品</b>（按重量定价）每个订单单独一张标签、印<b>实发净重</b>，展开可见逐订单明细；贴标时按重量核对防贴错。</div>
    ${blocked?`<div class="ib ib-r" style="margin-bottom:12px"><span class="i">⛔</span><b>${blocked} 个商品因未完成称重被拦截，无法打印标签。</b>多退少补（按重量定价）商品必须先录实发净重——打印首张标签即自动生成送货单，届时重量已无法再改。<button class="btn btn-link btn-sm" onclick="nav('m-pick-weigh')">去称重录入 →</button></div>`:''}
    <div class="card" style="margin-bottom:14px"><div class="card-bd" style="padding:0">
      <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid var(--bd2);padding:0 16px;flex-wrap:wrap">
        <div class="tabs" style="margin:0;border:none">
          <div class="tab active">按销量打印</div>
        </div>
        <div style="display:flex;gap:16px;font-size:12.5px;padding:6px 0">
          <span class="btn btn-link" onclick="nav('m-delivery')">查看预约送货时间</span>
          <span class="btn btn-link" onclick="toast('打印帮助：请连接标签打印机后点打印','info')">查看打印帮助</span>
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
      <span>应送货：<b>${should}</b></span><span>已打印：<b style="color:var(--gd)">${printed}</b></span><span>未打印：<b style="color:var(--r)">${unpr}</b></span><span>未称重拦截：<b style="color:${blocked?'var(--r)':'var(--ts)'}">${blocked}</b></span><span>超量：<b>0</b></span><span class="tag t-y" style="font-size:11px">未截单</span>
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
        <td style="text-align:right"><b>${r.qty}</b><div style="font-size:11px;color:var(--ts)">${r.wgNeed&&!wgBlocked(r)?`实发 ${r.wgReal.toFixed(1)}kg`:`序号 1–${r.qty}`}</div></td>
        <td style="text-align:right;color:var(--gd)">${pr}</td>
        <td style="text-align:right;${un>0?'color:var(--r);font-weight:600':''}">${un}</td>
        <td style="text-align:right">${last||(un>0?un:'—')}</td>
        <td style="white-space:nowrap">${un<=0?'<span style="color:var(--ts)">打印完成</span>':(wgBlocked(r)
          ?`<button class="btn btn-p btn-sm" disabled title="该商品有 ${r.wgWait} 个订单未录实发净重，完成称重后才能打印">打印</button> <button class="btn btn-link btn-sm" onclick="nav('m-pick-weigh')">去称重</button>`
          :`<button class="btn btn-p btn-sm" onclick="label_printOne('${r.key}')">打印</button>`)}</td>
      </tr>${r.wgNeed?(()=>{const ords=labelOrdersOf(r);return `<tr><td></td><td colspan="10" style="padding:2px 12px 10px;background:#F7FBF7">
        <div style="font-size:11.5px;color:var(--ts);margin:2px 0 6px">🏷️ 逐订单标签（一单一份货一张，标签印 <b>客户 + 订单尾号 + 实发净重</b>；贴前核对手中袋重 = 标签重量，防贴错）：</div>
        <div style="display:flex;flex-wrap:wrap;gap:8px">${ords.map(x=>`<span style="border:1px solid var(--bd2);border-radius:8px;padding:5px 10px;font-size:12px;white-space:nowrap;${x.st=='wait'?'border-color:var(--r);color:var(--r)':''}">${ord_mask(x.o.client)} · 单尾 <b class="mono">${x.o.id.slice(-4)}</b> · 实发 <b>${x.real!=null?x.real+'kg':(x.st=='wait'?'待称重':'—')}</b></span>`).join('')}</div>
      </td></tr>`;})():''}`;}).join('')||`<tr><td colspan="11"><div class="empty"><div class="e-ic">🏷️</div><div class="e-t">该筛选下暂无应送货标签</div><div class="e-s">切换配送日期/仓库，或到「订单履约」模拟来一单。</div></div></td></tr>`}
      </tbody></table></div></div></div>`;
  }

  // 菜单①：备货参考（快驴式决策表，纯查看）
  PAGES['m-pick-ref']=()=>{ ensurePickOrders(); return refView(); };
  // 菜单③：打印标签（快驴式 productLabelPrint 复刻）
  PAGES['m-pick-label']=()=>{ ensurePickOrders(); return labelView(); };
  // 菜单②：备货单（单据链：备货→贴码→送货）
  PAGES['m-pick']=()=>{
    ensurePickOrders();
    const p=DB.pickView&&DB.pickOrders.find(x=>x.id==DB.pickView);
    return p?detailView(p):listView();
  };
})();
