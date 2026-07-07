/* PC · 拣货单（JH）—— 单据链核心枢纽：销售订单 → 拣货单 → 送货单。
   拣货单由系统按「送达日+波次」自动成单（ensurePickOrders，定义在主文件全局）。
   本模块 = 拣货单列表 + 拣货单详情（① 按SKU汇总拣货 → ② 按订单×SKU 分拣贴码 → 贴码完触发送货单）。
   后加载覆盖主文件 PAGES['m-pick'] 占位。复用主文件全局：ensurePickOrders / pickAggr / pickOrdersOf /
   pickAllPacked / triggerDeliveries / ord_relabel / ord_doRelabel / ord_printLabels / ord_mask / toast / nav / render。 */
(function(){
  function pkTag(s){const m={'待拣货':'t-y','拣货中':'t-b','已拣货':'t-b','贴码中':'t-pp','已贴码':'t-pp','已送货':'t-g'}[s]||'t-gr';
    return `<span class="tag ${m}"><span class="dot"></span>${s}</span>`;}

  // 进入某拣货单（待拣货→拣货中）
  window.pick_enter=function(id){const p=DB.pickOrders.find(x=>x.id==id);if(!p)return;if(p.status=='待拣货')p.status='拣货中';DB.pickView=id;render();};
  window.pick_back=function(){DB.pickView=null;render();};
  window.pick_done=function(id){const p=DB.pickOrders.find(x=>x.id==id);if(!p)return;if(p.status=='拣货中')p.status='已拣货';render();toast(`${id} 已按 SKU 拣齐，可开始分拣贴码`,'ok');};
  // 贴码完成 → 生成送货单（按仓拆）
  window.pick_genDeliver=function(id){const p=DB.pickOrders.find(x=>x.id==id);if(!p)return;
    if(!pickAllPacked(p)){toast('还有订单未贴码，全部贴完才能生成送货单','err');return;}
    const made=triggerDeliveries(p);render();
    toast(`已按入库仓库生成 ${made.length} 张送货单（${made.join('、')}）`,'ok');};

  /* ---------- 列表视图 ---------- */
  function listView(){
    const ps=DB.pickOrders;
    if(!ps.length) return `<div class="empty"><div class="e-ic">🧺</div><div class="e-t">暂无拣货单</div><div class="e-s">有「待发货」订单时，系统按 <b>送达日+波次</b>自动汇总生成拣货单。<br>可到「订单履约」点「＋ 模拟来一单」。</div></div>`;
    return `<div class="ib ib-b" style="margin-bottom:14px"><span class="i">🧺</span><div><b>拣货单</b>：系统按「送达日+波次」把一波订单汇总成一张，跨仓按 SKU 拣一次；拣完按订单贴码，贴码完成后按<b>入库仓库</b>自动拆成送货单。</div></div>
    <div class="card"><div class="card-hd"><h3>拣货单</h3><span class="sub">共 ${ps.length} 张 · 拣货单:订单 = 1:N</span></div><div class="card-bd flush"><div style="overflow-x:auto"><table>
      <thead><tr><th>拣货单号</th><th>预计送达日</th><th>波次</th><th>订单数</th><th>SKU数</th><th>状态</th><th>操作</th></tr></thead><tbody>
      ${ps.map(p=>{const{rows}=pickAggr(p);return `<tr>
        <td class="mono">${p.id}</td><td>${p.deliver||'—'}</td><td>${p.wave||'—'}</td>
        <td>${p.orderIds.length} 单</td><td>${rows.length} 项</td><td>${pkTag(p.status)}</td>
        <td><button class="btn btn-p btn-sm" onclick="pick_enter('${p.id}')">${p.status=='已送货'?'查看':'进入拣货'}</button></td>
      </tr>`;}).join('')}
      </tbody></table></div></div></div>`;
  }

  /* ---------- 详情视图（单张拣货单） ---------- */
  function detailView(p){
    const {os,rows}=pickAggr(p);
    // 贴码到齐自动推进到「已贴码」
    if(pickAllPacked(p)&&p.status!='已送货')p.status='已贴码';
    const packedN=os.filter(o=>o.status=='packed'||o.deliveryId).length;
    return `
    <div class="row" style="justify-content:space-between;align-items:center;margin-bottom:14px;flex-wrap:wrap;gap:10px">
      <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
        <button class="btn btn-o btn-sm" onclick="pick_back()">← 拣货单列表</button>
        <span class="mono" style="font-weight:700">${p.id}</span>${pkTag(p.status)}
        <span style="font-size:12.5px;color:var(--ts)">${p.deliver} · ${p.wave} · ${os.length} 单 · ${rows.length} SKU</span>
      </div>
      <div style="display:flex;gap:8px">
        ${p.status=='拣货中'?`<button class="btn btn-p btn-sm" onclick="pick_done('${p.id}')">✓ 确认拣完（SKU拣齐）</button>`:''}
        ${p.status=='已贴码'?`<button class="btn btn-p btn-sm" onclick="pick_genDeliver('${p.id}')">🚚 生成送货单（按仓拆）</button>`:''}
        ${p.status=='已送货'?`<button class="btn btn-o btn-sm" onclick="nav('m-delivery')">去送货签到 →</button>`:''}
      </div>
    </div>
    <div class="card"><div class="card-hd"><h3>① 汇总拣货单 · 按 SKU</h3><span class="sub">跨订单同 SKU 合并拣总量（拣货参考）；右列 = 该 SKU 拆到各订单的数量</span></div><div class="card-bd flush"><div style="overflow-x:auto"><table>
      <thead><tr><th>SKU</th><th>商品</th><th style="text-align:right">拣货总量</th><th>按订单分配（一个 SKU → 多订单）</th></tr></thead><tbody>
      ${rows.map(r=>`<tr><td class="mono">${r.sku}</td><td><b>${r.name}</b></td><td style="text-align:right"><b>${r.qty}${r.unit}</b><div style="font-size:11px;color:var(--ts)">${r.allocs.length} 单</div></td><td>${r.allocs.map(a=>`<span style="display:inline-block;margin:2px 6px 2px 0;padding:3px 9px;background:var(--bd2);border-radius:7px;font-size:12px">${ord_mask(a.client)} <b>${a.qty}${r.unit}</b><span style="color:var(--tt)"> · ${a.id.slice(-4)}</span></span>`).join('')}</td></tr>`).join('')||'<tr><td colspan="4" style="text-align:center;color:var(--ts);padding:16px">本单无待拣 SKU</td></tr>'}
      </tbody></table></div></div></div>
    <div class="card"><div class="card-hd"><h3>② 分拣贴码 · 按订单</h3><span class="sub">拣完按订单分货，每单点「打印条码」一次打出该单全部 SKU 条码贴上（每单每SKU一张）→ 转已贴码；全部贴完 → 生成送货单</span></div><div class="card-bd flush"><div style="overflow-x:auto"><table>
      <thead><tr><th>订单号</th><th>客户</th><th>入库仓库</th><th>商品（每种一张条码）</th><th>条码数</th><th>状态</th><th>操作</th></tr></thead><tbody>
      ${os.map(o=>{const i=DB.orders.indexOf(o);const done=o.status=='packed'||o.deliveryId;return `<tr>
        <td class="mono">${o.id}</td><td>${ord_mask(o.client)}</td><td><span class="tag t-b" style="font-size:11px">${o.warehouse}</span></td>
        <td style="max-width:220px;white-space:normal">${o.lines.map(l=>l.name+' '+l.qty+l.unit).join('、')}</td><td>${o.lines.length} 张</td>
        <td>${done?'<span class="tag t-pp"><span class="dot"></span>已贴码</span>':'<span class="tag t-y"><span class="dot"></span>待贴码</span>'}</td>
        <td>${done?`<button class="btn btn-o btn-sm" onclick="ord_printLabels(${i})">重印条码</button>`:`<button class="btn btn-p btn-sm" ${p.status=='待拣货'?'disabled title="请先确认拣完"':''} onclick="ord_relabel(${i})">🏷️ 打印条码</button>`}</td>
      </tr>`;}).join('')||'<tr><td colspan="7" style="text-align:center;color:var(--ts);padding:18px">本单暂无订单</td></tr>'}
      </tbody></table></div></div>
    <div class="card-bd" style="padding:10px 16px;font-size:12.5px;color:var(--ts)">已贴码 ${packedN}/${os.length} 单；全部贴完后点上方「生成送货单」，按订单入库仓库拆成多张送货单。</div></div>`;
  }

  PAGES['m-pick']=()=>{
    ensurePickOrders();
    const p=DB.pickView&&DB.pickOrders.find(x=>x.id==DB.pickView);
    return p?detailView(p):listView();
  };
})();
