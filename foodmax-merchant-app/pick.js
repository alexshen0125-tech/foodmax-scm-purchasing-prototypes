/* Food Max 商家端 v2 · 备货参考（只查看，按 SKU 件数汇总跨订单备货量）
   移动端不支持打印标签：标签打印与送货单生成在【电脑端】进行，打印首个标签后系统按入库仓库自动生成送货单；
   App 仅提供「备货参考」查看备多少 + 「送货签到」查看/签到。数据源=window.FM.DB。
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
    <div class="pk-kbox"><div class="k"><div class="v">${pk.orderIds.length}</div><div class="l">订单数</div></div><div class="k"><div class="v">${cnt}</div><div class="l">SKU 数</div></div></div>
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
  pushPage({title:'备货参考 '+pk.id,body:'<div id="pkd"></div>',mount:(p)=>{const box=p.querySelector('#pkd');draw(box,pk);}});
}

function draw(box,pk){
  const aggr=pickAggr(pk);
  box.innerHTML=`
    <div class="pk-sec">汇总备货 · 按 SKU<span class="hint">跨订单合并备总量(件)；下方 = 该SKU拆到各订单</span></div>
    <div class="pk-tbl">${aggr.map(r=>`<div class="pk-srow">
      <div class="top"><span class="nm">${r.name} <span style="font-size:11px;color:var(--sub);font-family:monospace">${r.sku}</span></span><span class="qty">${r.qty}${r.unit}</span></div>
      <div class="alloc">${r.allocs.map(a=>`<span class="chip">${ordMask(a.client)} <b>${a.qty}${r.unit}</b></span>`).join('')}</div>
    </div>`).join('')}</div>
    <div class="pk-genwait">📄 备货参考仅供查看备多少。<b>标签打印与送货单生成在电脑端进行</b>：打印首个标签后系统按入库仓库自动生成送货单，可到「送货签到」查看并交接。</div>
    <div style="height:8px"></div>`;
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
window.FM_MOD.pick=()=>pushPage({title:'备货参考',body:'<div id="pkp"></div>',mount:(p)=>renderList(p.querySelector('#pkp'))});
})();
