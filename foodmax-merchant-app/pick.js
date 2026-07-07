/* Food Max 商家端 v2 · 备货模块（按 SKU 汇总备货 → 分拣贴码 → 生成送货单）
   单据链：系统按 送达日 自动成备货单(一天一张)；备货按SKU跨订单汇总；贴码按订单×SKU；
   全订单贴完→备货单「已贴码」→按订单入库仓库分组每仓一张送货单(N:1)。数据源=window.FM.DB。
   评审修复内建：骨架屏/空态/提交确认/44px/S$/买家脱敏；前缀 pk-。 */
(function(){
const {pushPage,toast,confirmDialog,svg,skel,ordMask,ensurePickOrders,ordersOf,pickAggr,pickAllPacked,labelOrder,triggerDeliveries}=window.FM;

const css=document.createElement('style');
css.textContent=`
.pk-list{padding:12px 16px 18px;}
.pk-card{background:#fff;border-radius:18px;padding:15px 16px;margin-bottom:13px;box-shadow:var(--sh-sm);cursor:pointer;}
.pk-ch{display:flex;align-items:center;justify-content:space-between;}
.pk-ch .no{font-size:15px;font-weight:700;font-family:monospace;letter-spacing:.01em;}
.pk-st{font-size:12.5px;font-weight:700;padding:2px 10px;border-radius:20px;}
.pk-st.wait{color:var(--amber);background:var(--amber-soft);}
.pk-st.ing{color:var(--emerald-2);background:var(--mint-soft);}
.pk-st.done{color:var(--sub);background:var(--muted);}
.pk-tags{display:flex;gap:8px;margin-top:11px;}
.pk-tag{font-size:11.5px;font-weight:700;padding:3px 9px;border-radius:8px;background:var(--muted);color:#46604F;}
.pk-kbox{display:flex;background:var(--muted);border-radius:14px;margin-top:13px;padding:13px 0;}
.pk-kbox .k{flex:1;text-align:center;}.pk-kbox .k+.k{border-left:1px solid var(--line);}
.pk-kbox .k .v{font-size:20px;font-weight:600;font-family:'Lora',serif;}
.pk-kbox .k .l{font-size:11.5px;color:var(--sub);margin-top:2px;}
.pk-sec{font-size:15px;font-weight:700;margin:16px 16px 8px;display:flex;align-items:center;gap:8px;}
.pk-sec .hint{font-size:11.5px;font-weight:500;color:var(--sub);}
.pk-tbl{background:#fff;border-radius:16px;margin:0 16px;box-shadow:var(--sh-sm);overflow:hidden;}
.pk-srow{padding:13px 15px;}
.pk-srow+.pk-srow{border-top:1px solid var(--line);}
.pk-srow .top{display:flex;align-items:baseline;justify-content:space-between;}
.pk-srow .nm{font-size:14.5px;font-weight:700;}
.pk-srow .qty{font-size:16px;font-weight:700;color:var(--emerald-2);font-family:'Lora',serif;}
.pk-srow .alloc{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px;}
.pk-srow .chip{font-size:11.5px;background:var(--muted);border-radius:7px;padding:3px 8px;color:#46604F;}
.pk-srow .chip b{color:var(--ink);}
.pk-ocard{background:#fff;border-radius:14px;margin:10px 16px 0;padding:13px 15px;box-shadow:var(--sh-sm);}
.pk-ocard .r1{display:flex;align-items:center;justify-content:space-between;}
.pk-ocard .r1 .cli{font-size:14.5px;font-weight:700;}
.pk-ocard .r1 .wh{font-size:11.5px;color:var(--sub);}
.pk-ocard .goods{font-size:12.5px;color:#46604F;margin-top:7px;line-height:1.6;}
.pk-ocard .rb{display:flex;align-items:center;justify-content:space-between;margin-top:11px;}
.pk-ocard .cnt{font-size:12px;color:var(--sub);}
.pk-ocard .b{min-height:40px;display:flex;align-items:center;padding:0 16px;border-radius:11px;font-size:13.5px;font-weight:700;cursor:pointer;background:var(--emerald);color:#fff;}
.pk-ocard .done-tag{font-size:12.5px;font-weight:700;color:var(--emerald-2);display:flex;align-items:center;gap:5px;}
.pk-gen{margin:16px;background:var(--emerald);color:#fff;border-radius:14px;min-height:52px;display:flex;align-items:center;justify-content:center;gap:8px;font-size:15px;font-weight:700;cursor:pointer;box-shadow:0 8px 20px rgba(5,150,105,.28);}
.pk-genwait{margin:16px;background:var(--muted);color:var(--sub);border-radius:14px;min-height:52px;display:flex;align-items:center;justify-content:center;font-size:13.5px;}
`;
document.head.appendChild(css);

function stClass(s){return s==='待备货'?'wait':s==='已送货'||s==='已作废'?'done':'ing';}

function listCard(pk){
  const cnt=pickAggr(pk).length;
  return `<div class="pk-card" data-id="${pk.id}">
    <div class="pk-ch"><span class="no">${pk.id}</span><span class="pk-st ${stClass(pk.status)}">${pk.status}</span></div>
    <div class="pk-tags"><span class="pk-tag">送达 ${pk.deliver}</span></div>
    <div class="pk-kbox"><div class="k"><div class="v">${pk.orderIds.length}</div><div class="l">订单数</div></div><div class="k"><div class="v">${cnt}</div><div class="l">SKU 数</div></div><div class="k"><div class="v">${ordersOf(pk).filter(o=>o.status==='packed').length}/${pk.orderIds.length}</div><div class="l">已贴码</div></div></div>
  </div>`;
}

function renderList(container){
  ensurePickOrders();
  const DB=window.FM.DB;
  container.innerHTML=`<div class="pk-list" id="pkl"></div>`;
  const list=container.querySelector('#pkl');
  list.innerHTML=skel(2);
  setTimeout(()=>{
    if(!DB.pickOrders.length){list.innerHTML=`<div class="empty"><div class="ei">${svg('layers')}</div><h4>暂无待备货备货单</h4><p>有「待发货」订单时，系统按 送达日 自动汇总生成备货单</p></div>`;return;}
    list.innerHTML=DB.pickOrders.map(listCard).join('');
    list.querySelectorAll('.pk-card').forEach(c=>c.onclick=()=>{const p=DB.pickOrders.find(x=>x.id===c.dataset.id);if(p&&p.status==='已作废'){window.FM.toast('该备货单全部订单已取消，已作废','info');return;}openDetail(p);});
  },420);
}

function openDetail(pk){
  if(pk.status==='待备货')pk.status='备货中';
  pushPage({title:'备货单 '+pk.id,body:'<div id="pkd"></div>',mount:(p)=>{const box=p.querySelector('#pkd');draw(box,pk);}});
}

function draw(box,pk){
  const aggr=pickAggr(pk),orders=ordersOf(pk);
  const allPacked=pickAllPacked(pk);
  if(allPacked&&pk.status!=='已送货')pk.status='已贴码';
  box.innerHTML=`
    <div class="pk-sec">① 汇总备货 · 按 SKU<span class="hint">跨订单合并备总量；下方 = 该SKU拆到各订单</span></div>
    <div class="pk-tbl">${aggr.map(r=>`<div class="pk-srow">
      <div class="top"><span class="nm">${r.name} <span style="font-size:11px;color:var(--sub);font-family:monospace">${r.sku}</span></span><span class="qty">${r.qty}${r.unit}</span></div>
      <div class="alloc">${r.allocs.map(a=>`<span class="chip">${ordMask(a.client)} <b>${a.qty}${r.unit}</b></span>`).join('')}</div>
    </div>`).join('')}</div>
    <div class="pk-sec">② 分拣贴码 · 按订单<span class="hint">每单每SKU一张码，全贴完生成送货单</span></div>
    <div id="pk-orders">${orders.map(o=>ocard(o)).join('')}</div>
    ${pk.status==='已送货'
      ?`<div class="pk-genwait">✅ 已按仓生成送货单，可到「送货签到」查看</div>`
      :allPacked
        ?`<div class="pk-gen" id="pk-gen">${svg('sign','style="width:18px;height:18px;stroke:#fff;fill:none"')} 生成送货单（按仓拆）</div>`
        :`<div class="pk-genwait">全部订单贴码完成后，可生成送货单</div>`}
    <div style="height:8px"></div>`;
  // 绑定：打印条码
  box.querySelectorAll('[data-label]').forEach(b=>b.onclick=()=>{
    const o=orders.find(x=>x.id===b.dataset.label);
    confirmDialog({title:'打印并贴码？',body:`「${ordMask(o.client)}」${o.lines.length} 个 SKU，一次打出 ${o.lines.length} 张条码贴上，之后转「已贴码待交接」。`,okText:'打印全部条码',onOk:()=>{labelOrder(o);toast('已打印 '+o.lines.length+' 张条码');draw(box,pk);}});
  });
  // 绑定：生成送货单
  const gen=box.querySelector('#pk-gen');
  if(gen)gen.onclick=()=>{
    const made=triggerDeliveries(pk);
    confirmDialog({title:'已生成送货单',body:`按入库仓库拆成 <b>${made.length}</b> 张送货单（一仓一张）：${made.join('、')}。可到「送货签到」查看，由仓库扫码交接入仓。`,okText:'我知道了',onOk:()=>draw(box,pk)});
  };
}

function ocard(o){
  const done=o.status==='packed';
  return `<div class="pk-ocard">
    <div class="r1"><span class="cli">${ordMask(o.client)}</span><span class="wh">${o.warehouse}</span></div>
    <div class="goods">${o.lines.map(l=>l.name+' '+l.qty+l.unit).join('、')}</div>
    <div class="rb"><span class="cnt">${o.lines.length} 张条码（每SKU一张）</span>
      ${done?`<span class="done-tag">✓ 已贴码</span>`:`<span class="b" data-label="${o.id}">🏷️ 打印条码</span>`}</div>
  </div>`;
}

window.FM_MOD=window.FM_MOD||{};
window.FM_MOD.pick=()=>pushPage({title:'备货单',body:'<div id="pkp"></div>',mount:(p)=>renderList(p.querySelector('#pkp'))});
})();
