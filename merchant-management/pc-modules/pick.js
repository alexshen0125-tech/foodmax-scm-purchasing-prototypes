/* PC · 拣货（SKU 维度） —— 搬迁自 App「送货退货/拣货」，按沈亮要求：商家拣货按 SKU 汇总，不按订单逐单拣。
   逻辑：把所有「待发货(pending)」订单的明细行按 SKU 聚合成一张拣货单（应拣总量=各订单同 SKU 求和）；
   先按 SKU 批量拣货 → 再二次分拣（展开看每个 SKU 分到哪些订单）→ 全部拣完订单方可进入打包。
   依赖 inline 脚本：DB / money / toast / modal / closeModal / nav / render（同页 const/window）。 */
(function(){
  // 拣货状态：key=sku，value=已拣 true/false（演示态，挂在 DB 上）
  function pickState(){ return DB.pickState || (DB.pickState={}); }

  // 把待发货订单按 SKU 聚合
  function aggregate(){
    const map={};
    DB.orders.filter(o=>o.status=='pending').forEach(o=>{
      (o.lines||[]).forEach(l=>{
        const k=l.sku||l.name;
        if(!map[k]) map[k]={sku:k,name:l.name,unit:l.unit||'',qty:0,orders:[]};
        map[k].qty += l.qty||0;
        map[k].orders.push({id:o.id,client:o.client,qty:l.qty||0,unit:l.unit||'',deliver:o.deliver||''});
      });
    });
    return Object.values(map).sort((a,b)=>b.qty-a.qty);
  }

  window.pick_toggle=function(sku){ const ps=pickState(); ps[sku]=!ps[sku]; render(); };
  window.pick_allDone=function(){ const ps=pickState(); aggregate().forEach(r=>ps[r.sku]=true); render(); toast('已全部标记拣货完成','ok'); };
  window.pick_reset=function(){ DB.pickState={}; render(); toast('已重置拣货进度','info'); };
  window.pick_expand=function(sku){ DB.pickExp = DB.pickExp==sku ? null : sku; render(); };
  window.pick_print=function(){ toast('拣货单已生成，可发往 RF 手持/打印','ok'); };
  window.pick_toOrders=function(){
    const ps=pickState(); const rows=aggregate();
    if(!rows.length){ toast('暂无待拣货订单','info'); return; }
    if(!rows.every(r=>ps[r.sku])){ toast('还有 SKU 未拣完，全部拣完后才能进入打包','err'); return; }
    modal(`<div class="mc-hd"><h3>✅ 拣货完成 · 二次分拣到订单</h3><p>按 SKU 拣出的实物，现按订单分拣装包。下列订单将进入「打包贴码」。</p><button class="mc-x" onclick="closeModal()">×</button></div>
      <div class="mc-bd"><div class="ib ib-g"><span class="i">📦</span>共 ${DB.orders.filter(o=>o.status=='pending').length} 笔订单可进入打包。一单一/多包，一包一码。</div>
      <table class="subtbl"><thead><tr><th>订单号</th><th>客户</th><th>SKU 项</th><th>预计送达</th></tr></thead><tbody>
      ${DB.orders.filter(o=>o.status=='pending').map(o=>`<tr><td class="mono">${o.id}</td><td>${o.client}</td><td>${(o.lines||[]).length} 项</td><td>${o.deliver||'—'}</td></tr>`).join('')}
      </tbody></table></div>
      <div class="mc-ft"><button class="btn btn-o" onclick="closeModal()">继续拣货</button><button class="btn btn-p" onclick="closeModal();nav('m-order')">前往订单打包 →</button></div>`);
  };

  PAGES['m-pick']=()=>{
    const rows=aggregate(); const ps=pickState();
    const totalQty=rows.reduce((s,r)=>s+r.qty,0);
    const orderN=DB.orders.filter(o=>o.status=='pending').length;
    const doneN=rows.filter(r=>ps[r.sku]).length;
    if(!rows.length) return `<div class="empty"><div class="e-ic">🧺</div><div class="e-t">暂无待拣货订单</div><div class="e-s">有「待发货」订单时，系统按 <b>SKU 维度</b>汇总生成拣货单。<br>可到「订单履约」点「＋ 模拟来一单」。</div></div>`;
    return `
    <div class="ib ib-b" style="margin-bottom:14px"><span class="i">🧺</span><div><b>按 SKU 维度拣货</b>（非逐单）：把全部待发货订单的同一 SKU 合并成一行，一次拣足总量，拣完再二次分拣到各订单装包。减少在货架间反复往返。</div></div>
    <div class="sg" style="grid-template-columns:repeat(4,1fr)">
      <div class="sc"><div class="sc-l">待拣 SKU</div><div class="sc-v">${rows.length}</div><div class="sc-s">合并后行数</div></div>
      <div class="sc"><div class="sc-l">应拣总件数</div><div class="sc-v">${totalQty}</div><div class="sc-s">跨订单求和</div></div>
      <div class="sc"><div class="sc-l">涉及订单</div><div class="sc-v">${orderN}</div><div class="sc-s">待发货</div></div>
      <div class="sc ${doneN==rows.length?'good':'warn'}"><div class="sc-l">拣货进度</div><div class="sc-v">${doneN}/${rows.length}</div><div class="sc-s">已拣 SKU</div></div>
    </div>
    <div class="card"><div class="card-hd">
      <h3>SKU 拣货单 · ${DB.pickWave||'全部波次'}</h3>
      <div class="row" style="gap:8px">
        <button class="btn btn-o btn-sm" onclick="pick_print()">🖨️ 打印/下发拣货单</button>
        <button class="btn btn-o btn-sm" onclick="pick_reset()">重置进度</button>
        <button class="btn btn-o btn-sm" onclick="pick_allDone()">全部标记已拣</button>
        <button class="btn btn-p btn-sm" onclick="pick_toOrders()">拣完 → 分拣到订单</button>
      </div>
    </div><div class="card-bd flush"><div style="overflow-x:auto"><table>
      <thead><tr><th style="width:30px"></th><th>SKU 编码</th><th>商品</th><th>应拣总量</th><th>涉及订单</th><th>拣货状态</th><th>操作</th></tr></thead><tbody>
      ${rows.map(r=>{const done=ps[r.sku];const open=DB.pickExp==r.sku;return `
        <tr style="cursor:pointer" onclick="pick_expand('${r.sku}')">
          <td><span class="exp-ic">${open?'▾':'▸'}</span></td>
          <td class="mono">${r.sku}</td>
          <td><b>${r.name}</b></td>
          <td><b style="font-size:15px">${r.qty}</b> <span style="color:var(--ts)">${r.unit}</span></td>
          <td>${r.orders.length} 单</td>
          <td>${done?'<span class="tag t-g"><span class="dot"></span>已拣</span>':'<span class="tag t-y"><span class="dot"></span>待拣</span>'}</td>
          <td onclick="event.stopPropagation()"><button class="btn ${done?'btn-o':'btn-p'} btn-sm" onclick="pick_toggle('${r.sku}')">${done?'撤销':'标记已拣'}</button></td>
        </tr>
        ${open?`<tr><td colspan="7" style="padding:0;background:#FbFcFd"><div style="padding:6px 16px 12px">
          <div style="font-size:12px;color:var(--ts);margin:8px 0 6px">二次分拣 · 该 SKU 分到以下订单：</div>
          <table class="subtbl"><thead><tr><th>订单号</th><th>客户</th><th>该 SKU 数量</th><th>预计送达</th></tr></thead><tbody>
          ${r.orders.map(o=>`<tr><td class="mono">${o.id}</td><td>${o.client}</td><td><b>${o.qty}</b> ${o.unit}</td><td>${o.deliver||'—'}</td></tr>`).join('')}
          </tbody></table></div></td></tr>`:''}`;}).join('')}
      </tbody></table></div></div></div>`;
  };
})();
