/* Food Max 商家端 v2 · 商品模块
   数据驱动配色(emerald) + 评审修复内建：骨架屏/空态/破坏性确认/批量多选/44px/SG数据
   PC 对齐(2026-07)：价格+库存到每个 SKU / 上下架细到 SKU / 状态只留销售中·未上架 / 去库存预警
   扁平化(2026-07)：SKU 完全展开——每个售卖规格(SKU)一张独立卡，不再按 SPU 分组、无需点 SPU 看 SKU；销售中/未上架、批量、计数均按 SKU 维度（对齐 PC「每 SKU 一行」）
   税价对齐(2026-07)：价格维护未税价，默认税率 9%，SKU 行与改价页自动展示含税价（只读） */
(function(){
const {pushPage,popPage,toast,confirmDialog,sheet,svg,skel}=window.FM;

const css=document.createElement('style');
css.textContent=`
.gd-bar{position:sticky;top:0;z-index:6;background:var(--bg);padding:6px 16px 10px;}
.gd-search{display:flex;align-items:center;gap:9px;background:#fff;border-radius:15px;height:44px;padding:0 14px;box-shadow:var(--sh-sm);color:var(--sub);font-size:14px;}
.gd-search svg{width:18px;height:18px;stroke:var(--sub);fill:none;stroke-width:2;}
.gd-filters{display:flex;gap:8px;margin-top:11px;overflow-x:auto;}.gd-filters::-webkit-scrollbar{display:none;}
.gd-pill{flex:0 0 auto;min-height:40px;display:flex;align-items:center;padding:0 16px;border-radius:20px;font-size:13.5px;font-weight:600;background:#fff;color:#27433A;box-shadow:var(--sh-sm);cursor:pointer;}
.gd-pill.on{background:var(--emerald);color:#fff;box-shadow:0 6px 16px rgba(5,150,105,.28);}
.gd-pill .c{opacity:.7;margin-left:3px;}
.gd-sub{display:flex;align-items:center;justify-content:space-between;padding:6px 8px 0;font-size:12.5px;color:var(--sub);}
.gd-sub .mng{color:var(--emerald);font-weight:700;min-height:44px;display:flex;align-items:center;}
.gd-list{padding:12px 16px 16px;}
.pc{background:#fff;border-radius:20px;padding:15px;margin-bottom:13px;box-shadow:var(--sh-sm);display:flex;gap:12px;}
.pc .chk{width:24px;height:24px;border-radius:50%;border:2px solid #CBD5C7;flex:0 0 24px;margin-top:22px;display:none;align-items:center;justify-content:center;cursor:pointer;}
.pc.manage .chk{display:flex;}
.pc .chk.on{background:var(--emerald);border-color:var(--emerald);}
.pc .chk.on::after{content:"✓";color:#fff;font-size:14px;font-weight:700;}
.pc .body{flex:1;min-width:0;}
.pc .top{display:flex;gap:13px;}
.pc .img{width:66px;height:66px;border-radius:14px;flex:0 0 66px;background:var(--mint-soft);display:flex;align-items:center;justify-content:center;font-size:30px;}
.pc .nm{font-size:16.5px;font-weight:700;line-height:1.2;}
.pc .sp{font-size:12.5px;color:var(--sub);margin-top:3px;}
.pc .tag{display:inline-block;margin-top:7px;font-size:10.5px;font-weight:700;padding:2px 8px;border-radius:20px;}
.pc .tag.rec{background:var(--amber-soft);color:#B45309;}
.pc .tag.bad{display:block;margin-top:8px;padding:8px 10px;border-radius:10px;background:var(--red-soft);color:var(--red);cursor:pointer;}
.pc .kpis{display:flex;margin:13px 0 4px;padding:12px 0;border-top:1px solid var(--line);border-bottom:1px solid var(--line);}
.pc .kpis .k{flex:1;}.pc .kpis .k .v{font-size:19px;font-weight:600;font-family:'Lora',serif;}.pc .kpis .k .l{font-size:11.5px;color:var(--sub);margin-top:1px;}
/* SKU 列表：每个售卖规格独立 价格/库存/上下架 */
.pc .skus{margin-top:2px;}
.pc .sku{display:flex;align-items:center;gap:10px;padding:11px 0;border-bottom:1px solid var(--line);}
.pc .sku:last-child{border-bottom:none;}
.pc .sku .sm{flex:1;min-width:0;}
.pc .sku .sm .ss{font-size:14px;font-weight:700;color:#27433A;}
.pc .sku .sm .sd{font-size:12.5px;color:var(--sub);margin-top:3px;}
.pc .sku .sm .sd b{color:var(--emerald-2);font-weight:700;font-family:'Lora',serif;}
.pc .sku .sm .sd .oos{color:var(--red);font-weight:700;}
.pc .sku .rt{text-align:right;flex:0 0 auto;}
.pc .sku .sk-tg{min-height:34px;padding:0 15px;border-radius:9px;font-size:12.5px;font-weight:700;display:flex;align-items:center;justify-content:center;cursor:pointer;}
.pc .sku .sk-tg.on{background:var(--muted);color:#27433A;}
.pc .sku .sk-tg.off{background:var(--mint-soft);color:var(--emerald-2);}
.pc .sku .sk-st{font-size:11px;color:var(--sub);margin-top:4px;}
.pc .sku .sk-st.only{font-size:12.5px;font-weight:700;color:#27433A;margin-top:0;}
/* 扁平 SKU 卡片：每个售卖规格一张卡，与 PC 端「每 SKU 一行」对齐 */
.pc .skl{font-size:13.5px;color:var(--sub);margin-top:13px;padding-top:12px;border-top:1px solid var(--line);line-height:1.7;}
.pc .skl b{color:var(--emerald-2);font-weight:700;font-family:'Lora',serif;}
.pc .skl .oos{color:var(--red);font-weight:700;}
.pc .skl .up{display:block;font-size:11px;color:#94A3B8;margin-top:3px;}
.pc .nm .spec{color:var(--sub);font-weight:600;font-size:13px;}
/* BCRS 饮料容器押金标 */
.bcrs-b{display:inline-block;font-size:10px;font-weight:700;padding:1px 7px;border-radius:20px;background:#E1EBFF;color:#2563EB;vertical-align:middle;margin-left:5px;}
.consign-b{display:inline-block;font-size:10px;font-weight:700;padding:1px 7px;border-radius:20px;background:#F3EEFE;color:#7E3AF2;vertical-align:middle;margin-left:5px;}
.refund-b{display:inline-block;font-size:10px;font-weight:700;padding:1px 7px;border-radius:20px;background:#D1FAE5;color:#059669;vertical-align:middle;margin-left:5px;}
.pc .acts{display:flex;gap:9px;margin-top:14px;}
.pc .acts .a{flex:1;min-height:44px;display:flex;align-items:center;justify-content:center;border-radius:11px;font-size:13.5px;font-weight:600;cursor:pointer;background:var(--muted);color:#27433A;}
.pc .acts .a.tg-on{background:var(--mint-soft);color:var(--emerald-2);}
.pc .skl .mode{display:inline-block;font-size:10.5px;font-weight:700;padding:1px 8px;border-radius:20px;vertical-align:middle;margin-left:1px;}
.pc .skl .mode.daily{background:var(--mint-soft);color:var(--emerald-2);}
.pc .skl .mode.once{background:var(--amber-soft);color:#B45309;}
.bulkbar{display:flex;align-items:center;gap:10px;}
.bulkbar .all{display:flex;align-items:center;gap:7px;font-size:14px;font-weight:600;min-height:44px;cursor:pointer;}
.bulkbar .all .b{width:22px;height:22px;border-radius:50%;border:2px solid #CBD5C7;display:flex;align-items:center;justify-content:center;}
.bulkbar .all .b.on{background:var(--emerald);border-color:var(--emerald);}.bulkbar .all .b.on::after{content:"✓";color:#fff;font-size:12px;}
.bulkbar .sp{flex:1;font-size:13px;color:var(--sub);}
.bulkbar button{min-height:44px;padding:0 12px;border-radius:11px;font-size:13.5px;font-weight:700;border:none;cursor:pointer;font-family:inherit;white-space:nowrap;}
.bulkbar .up{background:var(--emerald);color:#fff;}.bulkbar .px{background:var(--muted);color:var(--ink);}
/* 空态 */
.empty{display:flex;flex-direction:column;align-items:center;justify-content:center;padding:70px 40px;gap:14px;text-align:center;}
.empty .ei{width:96px;height:96px;border-radius:28px;background:var(--mint-soft);display:flex;align-items:center;justify-content:center;}
.empty .ei svg{width:42px;height:42px;stroke:var(--emerald-2);fill:none;stroke-width:1.4;}
.empty h4{font-size:17px;font-weight:700;}.empty p{font-size:13px;color:var(--sub);}
/* 逐 SKU 改价/改库存编辑器 */
.sku-ed{background:#fff;border-radius:16px;margin:12px 16px;padding:2px 16px;box-shadow:var(--sh-sm);}
.sku-ed .r{display:flex;align-items:center;gap:12px;padding:14px 0;border-top:1px solid var(--line);}
.sku-ed .r:first-child{border-top:none;}
.sku-ed .r .nm{flex:1;min-width:0;font-size:14.5px;font-weight:700;}
.sku-ed .r .nm .c{font-size:12px;color:var(--sub);font-weight:400;margin-top:2px;}
.sku-ed .r .in{width:128px;background:var(--muted);border-radius:11px;min-height:44px;display:flex;align-items:center;padding:0 12px;gap:4px;border:1.5px solid transparent;}
.sku-ed .r .in:focus-within{border-color:var(--emerald);background:#fff;}
.sku-ed .r .in input{border:none;background:transparent;outline:none;width:100%;font-size:15px;font-family:inherit;text-align:right;}
.sku-ed .r .in .u{font-size:13px;color:var(--sub);}
.sku-ed-tip{font-size:12.5px;color:var(--sub);margin:6px 20px 0;}
/* 改库存·库存模式（每日恢复初始库存 / 售完即止） */
.stk-blk{background:#fff;border-radius:16px;margin:12px 16px;padding:16px;box-shadow:var(--sh-sm);}
.stk-blk .bnm{font-size:15px;font-weight:700;}
.stk-blk .bnm .c{font-size:12.5px;color:var(--sub);font-weight:600;margin-left:5px;}
.stk-row{display:flex;align-items:flex-start;gap:12px;padding:12px 0;border-top:1px solid var(--line);}
.stk-row:first-of-type{border-top:none;}
.stk-row .lbl{font-size:14px;color:#27433A;font-weight:600;flex:0 0 60px;padding-top:9px;}
.seg{display:flex;flex:1;background:var(--muted);border-radius:12px;padding:3px;gap:3px;}
.seg .o{flex:1;min-height:40px;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:600;color:var(--sub);border-radius:9px;cursor:pointer;text-align:center;line-height:1.15;}
.seg .o.on{background:#fff;color:var(--emerald-2);box-shadow:var(--sh-sm);}
.stk-fld{flex:1;display:flex;flex-direction:column;align-items:flex-end;}
.stk-in{width:130px;background:var(--muted);border-radius:11px;min-height:44px;display:flex;align-items:center;padding:0 12px;border:1.5px solid transparent;}
.stk-in:focus-within{border-color:var(--emerald);background:#fff;}
.stk-in input{border:none;background:transparent;outline:none;width:100%;font-size:16px;font-family:inherit;text-align:right;}
.stk-hint{font-size:11.5px;color:#94A3B8;margin-top:6px;text-align:right;}
.stk-ref{font-size:12.5px;color:var(--emerald);font-weight:700;margin-top:5px;text-align:right;cursor:pointer;}
.stk-sold{font-size:12.5px;color:var(--sub);margin-top:12px;padding-top:12px;border-top:1px solid var(--line);}
.stk-sold b{color:#27433A;font-family:'Lora',serif;}
/* 商品详情(只读·点击卡片进入) */
.pc .body{cursor:pointer;}
.gdt{padding:14px 16px 20px;}
.gdt .card{background:#fff;border-radius:18px;padding:16px;box-shadow:var(--sh-sm);margin-bottom:12px;}
.gdt .hd{display:flex;gap:13px;align-items:center;}
.gdt .hd .img{width:56px;height:56px;border-radius:14px;background:var(--mint-soft);display:flex;align-items:center;justify-content:center;font-size:30px;flex:0 0 56px;}
.gdt .hd .nm{font-size:16.5px;font-weight:700;}
.gdt .hd .sp{font-size:12.5px;color:var(--sub);margin-top:2px;}
.gdt .tags{margin:10px 0 2px;display:flex;align-items:center;gap:7px;}
.gdt .st{font-size:11px;font-weight:700;padding:2px 9px;border-radius:6px;background:var(--mint-soft);color:var(--emerald-2);}
.gdt .st.off{background:var(--muted);color:var(--sub);}
.gdt .bad{background:var(--amber-soft);color:#B45309;font-size:12.5px;border-radius:11px;padding:9px 12px;margin-top:10px;}
.gdt h5{font-size:13px;color:var(--sub);font-weight:700;margin:2px 0 6px;}
.gdt .kv{display:flex;font-size:13.5px;padding:7px 0;border-top:1px solid var(--line);}
.gdt .kv:first-of-type{border-top:none;}
.gdt .kv .k{width:92px;flex:0 0 92px;color:var(--sub);}
.gdt .kv .v{flex:1;color:#27433A;word-break:break-all;}
.gdt .sku{border:1px solid var(--line);border-radius:14px;padding:12px;margin-top:10px;}
.gdt .sku.cur{border-color:var(--emerald);background:var(--mint-soft);}
.gdt .sku .sn{font-size:14.5px;font-weight:700;display:flex;justify-content:space-between;gap:8px;align-items:center;}
.gdt .sku .cur-b{font-size:10.5px;font-weight:700;color:var(--emerald-2);background:#fff;border:1px solid var(--emerald);border-radius:5px;padding:1px 7px;margin-left:6px;}
.gdt .sku .ln{font-size:12.5px;color:#46604F;margin-top:7px;line-height:1.6;}
.gdt .sku .ln b{color:var(--emerald-2);font-family:'Lora',serif;font-weight:700;}
.gdt .sku .mode{display:inline-block;font-size:10.5px;font-weight:700;padding:1px 8px;border-radius:20px;margin-left:2px;}
.gdt .sku .mode.daily{background:#fff;color:var(--emerald-2);}
.gdt .sku .mode.once{background:var(--amber-soft);color:#B45309;}
`;
document.head.appendChild(css);

// 当前时间戳(SPU / SKU 更新时各自独立打点)
function ts(){const d=new Date();const p=n=>(''+n).padStart(2,'0');return d.getFullYear()+'-'+p(d.getMonth()+1)+'-'+p(d.getDate())+' '+p(d.getHours())+':'+p(d.getMinutes());}
// SG 数据 —— 每个商品含 skus[]，价格/库存/上下架均到 SKU；创建/更新时间 SPU 与 SKU 独立
const PRODUCTS=[
  {ic:'🥬',n:'鲜丰 · 嫩豆腐 1kg',cat:'新鲜蔬菜',rec:1,sales:4,createdAt:'2026-06-20 09:12',updatedAt:'2026-07-01 14:30',
   skus:[{spec:'1kg/袋',price:9.99,stock:200,off:false,stockMode:'daily',soldToday:36,refund:1,createdAt:'2026-06-20 09:12',updatedAt:'2026-07-01 14:30'},{spec:'2kg/箱',price:19.50,stock:120,off:false,stockMode:'finite',createdAt:'2026-06-25 10:00',updatedAt:'2026-06-25 10:00'}]},
  // 寄售样例(对齐 dev supplyMode=2 寄售)：库存由货品库存决定、逐规格不可维护
  {ic:'🧈',n:'鲜丰 · 老豆腐',cat:'新鲜蔬菜',consign:true,sales:17,createdAt:'2026-06-18 16:40',updatedAt:'2026-06-28 11:05',
   skus:[{spec:'2.5kg/盒',price:11.99,stock:168,off:false,createdAt:'2026-06-18 16:40',updatedAt:'2026-06-28 11:05'}]},
  {ic:'🍢',n:'鲜丰 · 小油豆腐',cat:'新鲜蔬菜',sales:9,createdAt:'2026-06-15 08:20',updatedAt:'2026-06-30 09:50',
   skus:[{spec:'2斤/袋',price:8.80,stock:150,off:false,stockMode:'daily',soldToday:22,createdAt:'2026-06-15 08:20',updatedAt:'2026-06-30 09:50'},{spec:'5斤/箱',price:20.80,stock:0,off:false,stockMode:'finite',createdAt:'2026-06-15 08:20',updatedAt:'2026-06-22 13:10'}]},
  {ic:'🥗',n:'冻 · 盐渍海带丝',cat:'海鲜水产',bad:'商品信息有误，已被限流',sales:0,createdAt:'2026-06-10 15:00',updatedAt:'2026-06-12 17:22',
   skus:[{spec:'4kg/箱',price:29.99,stock:0,off:true,createdAt:'2026-06-10 15:00',updatedAt:'2026-06-12 17:22'}]},
  {ic:'🟡',n:'萝卜丸子',cat:'肉禽蛋品',sales:0,createdAt:'2026-06-08 11:30',updatedAt:'2026-06-09 10:00',
   skus:[{spec:'2.5kg/袋',price:12.00,stock:4,off:true,recycled:true,createdAt:'2026-06-08 11:30',updatedAt:'2026-06-09 10:00'}]},
  // BCRS 样例(对齐 PC SPU8820 椰子水)：饮料类目 + 押金单价 S$0.10/瓶；每 SKU 押金 = 规格数量 × 押金单价
  {ic:'🥥',n:'鲜丰 · NFC 椰子水 330ml',cat:'饮料',bcrs:true,bcrsDeposit:0.10,sales:11,createdAt:'2026-07-10 10:20',updatedAt:'2026-07-21 18:00',
   skus:[{spec:'1瓶',qty:1,price:2.50,stock:200,off:false,stockMode:'finite',soldToday:18,createdAt:'2026-07-10 10:20',updatedAt:'2026-07-21 18:00'},{spec:'24瓶/箱',qty:24,price:55.00,stock:40,off:false,stockMode:'finite',createdAt:'2026-07-10 10:20',updatedAt:'2026-07-18 09:40'}]},
];
const isOnShelf=p=>p.skus.some(s=>!s.off);           // 销售中 = 至少 1 个 SKU 在架
const totalStock=p=>p.skus.reduce((a,s)=>a+(+s.stock||0),0);
// GST：价格维护未税价，默认税率 9%，系统自动算含税价（仅展示、不可编辑）
const GST_DEFAULT=9;
const taxRate=p=>{const t=parseFloat(String(p&&p.tax!=null?p.tax:'').replace('%',''));return isNaN(t)?GST_DEFAULT:t;};
const priceIncl=(net,p)=>(+net||0)*(1+taxRate(p)/100);   // 含税价 = 未税价 ×(1+税率)
// BCRS 饮料容器押金(与 PC 同口径)：每个 SKU 押金 = 该规格数量 × 押金单价；不计 GST、随商品透传订单/发票
const BCRS_UNIT_PRICE=0.10;                              // 单容器法规押金 S$0.10（平台级参数）
const skuBcrs=(g,s)=>(g&&g.bcrs&&+g.bcrsDeposit>0)?+((+s.qty||1)*g.bcrsDeposit).toFixed(2):0;

// 扁平 SKU 卡片：每个售卖规格(SKU)一张独立卡，SKU 完全展开、无需点 SPU 展开（对齐 PC 端「每 SKU 一行」）
const skuRecyclable=s=>s.off&&!s.recycled;   // 仅已下架规格可移入回收站
function skuCard(g,s,gi,si,manage,tab){
  const isRec=tab==='recycle';
  const oos=(+s.stock<=0);
  const st=isRec?'回收站':(s.off?'已下架':(oos?'售罄':'在售'));
  const stockTxt=s.off?'—':(oos?'<span class="oos">0（售罄）</span>':(+s.stock).toLocaleString());
  const bc=skuBcrs(g,s);
  const acts=isRec
    ? `<div class="acts"><div class="a" data-a="还原">移出 / 还原</div></div>`
    : `<div class="acts"><div class="a" data-a="改价格">改价格</div><div class="a" data-a="改库存">改库存</div><div class="a tg ${s.off?'tg-on':''}" data-sku-toggle>${s.off?'上架':'下架'}</div><div class="a" data-a="更多">更多</div></div>`;
  return `<div class="pc${manage?' manage':''}">
    <div class="chk" data-chk></div>
    <div class="body">
      <div class="top"><div class="img">${g.ic}</div>
        <div style="flex:1"><div class="nm">${g.n} <span class="spec">· ${s.spec}</span>${g.consign?'<span class="consign-b">寄售</span>':''}${s.refund?'<span class="refund-b">多退少补</span>':''}${bc?'<span class="bcrs-b">BCRS</span>':''}</div>
          <div class="sp">${g.cat}</div>
          ${g.bad?`<div class="tag bad" data-bad>⚠ ${g.bad} ›</div>`:''}</div>
        <div class="rt"><div class="sk-st only">${st}</div></div></div>
      <div class="skl"><b>S$${(+s.price||0).toFixed(2)}</b> 未税 · 含税 S$${priceIncl(s.price,g).toFixed(2)}（税率 ${taxRate(g)}%）${bc?` · BCRS 押金 <b>S$${bc.toFixed(2)}</b>` :''} · 库存 ${stockTxt}${s.off?'':` ${s.stockMode==='daily'?`<span class="mode daily">每日恢复</span>`:`<span class="mode once">售完即止</span>`}`}${s.updatedAt?`<span class="up">更新 ${s.updatedAt}</span>`:''}</div>
      ${manage?'':acts}
    </div></div>`;
}

function bindSku(el,g,s,gi,si,state){
  const chk=el.querySelector('[data-chk]');
  chk.onclick=()=>{chk.classList.toggle('on');s._sel=chk.classList.contains('on');state.refreshBulk();};
  if(s._sel)chk.classList.add('on');
  // 逐 SKU 上下架（即时生效无需审核；二次确认，SKU 与 SPU 各自打更新时间）
  const tg=el.querySelector('[data-sku-toggle]');
  if(tg)tg.onclick=()=>{
    const to=s.off?'上架':'下架';
    const doIt=()=>{s.off=!s.off;s.updatedAt=ts();g.updatedAt=ts();toast(`「${g.n} ${s.spec}」已${s.off?'下架':'上架'}（即时生效，无需审核）`);state.redraw();};
    confirmDialog({title:`确认${to}该规格？`,body:`「${g.n} ${s.spec}」${to}后${s.off?'客户即可下单':'客户将无法下单，可随时重新上架'}。`,danger:!s.off,okText:to,onOk:doIt});
  };
  el.querySelectorAll('.acts .a[data-a]').forEach(b=>b.onclick=()=>{
    const a=b.dataset.a;
    if(a==='改价格')openPrice(g,si);
    else if(a==='改库存')openStock(g,si);
    else if(a==='还原')doRestore(g,s,state);
    else openMore(g,s,state);
  });
  const bad=el.querySelector('[data-bad]');if(bad)bad.onclick=()=>showSupplement();
  // 点击卡片信息区进入只读详情(管理态/操作按钮/警示/复选除外)
  const body=el.querySelector('.body');
  if(body)body.onclick=(e)=>{
    if(state.manage)return;
    if(e.target.closest('.acts')||e.target.closest('[data-bad]'))return;
    openGoodsDetail(g,s);
  };
}

// 商品详情(只读)：点击卡片信息区进入，展示 SPU 信息 + 全部 SKU 规格(对齐 PC act_spuDetail)
function openGoodsDetail(g,s){
  const on=isOnShelf(g);
  // 名称/别名均为 SPU 级字段，中英双语（PC 端支持「批量修改」按 SKU 编码导表更新，App 只读展示）
  const info=[['商品名称',g.n],['商品名称(EN)',g.nEn||'—'],['商品别名',g.alias||'—'],['商品别名(EN)',g.aliasEn||'—'],
    ['品类',g.cat],['税率',taxRate(g)+'%'],
    ['售卖模式',g.consign?'<span class="consign-b" style="margin:0 5px 0 0">寄售</span>库存由货品库存决定、逐规格不可维护':'自售（经销买断）'],
    ['BCRS 押金',g.bcrs?`<span class="bcrs-b" style="margin:0 5px 0 0">BCRS</span>押金单价 S$${(+g.bcrsDeposit).toFixed(2)}/最小售卖单位（单容器 S$${BCRS_UNIT_PRICE.toFixed(2)}，不计 GST）`:'不支持'],
    ['累计销量',(g.sales||0)+' 件'],['创建时间',g.createdAt||'—'],['更新时间',g.updatedAt||'—']];
  pushPage({title:'商品详情',body:`<div class="gdt">
    <div class="card">
      <div class="hd"><div class="img">${g.ic}</div><div style="flex:1"><div class="nm">${g.n}</div><div class="sp">${g.cat}</div></div></div>
      <div class="tags"><span class="st ${on?'':'off'}">${on?'销售中':'未上架'}</span></div>
      ${g.bad?`<div class="bad">⚠ ${g.bad}</div>`:''}
      <div style="margin-top:10px">${info.map(r=>`<div class="kv"><span class="k">${r[0]}</span><span class="v">${r[1]}</span></div>`).join('')}</div>
    </div>
    <div class="card">
      <h5>售卖规格（SKU）· 共 ${g.skus.length} 个</h5>
      ${g.skus.map(x=>{const oos=(+x.stock<=0);const stt=x.off?'已下架':(oos?'售罄':'在售');const cur=x===s;const xb=skuBcrs(g,x);
        return `<div class="sku${cur?' cur':''}">
          <div class="sn"><span>${g.n} · ${x.spec}${cur?'<span class="cur-b">当前</span>':''}</span><span style="font-size:12.5px;font-weight:700;color:${x.off?'var(--sub)':'var(--emerald-2)'}">${stt}</span></div>
          ${x.refund?`<div class="ln"><span class="refund-b" style="margin:0 5px 0 0">多退少补</span>按重量结差额，分装后按实发净重结算，需先称重</div>`:''}
          ${xb?`<div class="ln">BCRS 押金 <b>S$${xb.toFixed(2)}</b>（${x.qty} × S$${(+g.bcrsDeposit).toFixed(2)}，不计 GST）</div>`:''}
          <div class="ln"><b>S$${(+x.price||0).toFixed(2)}</b> 未税 · 含税 S$${priceIncl(x.price,g).toFixed(2)}（税率 ${taxRate(g)}%）· 库存 ${x.off?'—':(oos?'0（售罄）':(+x.stock).toLocaleString())}${x.off?'':` ${x.stockMode==='daily'?'<span class="mode daily">每日恢复</span>':'<span class="mode once">售完即止</span>'}`}</div>
          ${x.updatedAt?`<div class="ln" style="color:#94A3B8">更新 ${x.updatedAt}</div>`:''}
        </div>`;}).join('')}
    </div>
  </div>`});
}
function renderList(container,inTab){
  container.innerHTML=`
    ${inTab?`<div class="hm-top" style="padding:14px 20px 6px"><div class="hm-store"><div class="nm disp" style="font-size:24px">商品</div></div><div class="hm-bell">${svg('search')}</div></div>`:''}
    <div class="gd-bar">
      ${inTab?'':`<div class="gd-search">${svg('search')}搜索商品名称 / 编码 / SKU</div>`}
      <div class="gd-filters" id="f">
        <div class="gd-pill on" data-t="sale">销售中<span class="c" id="c-sale"></span></div>
        <div class="gd-pill" data-t="off">未上架<span class="c" id="c-off"></span></div>
        <div class="gd-pill" data-t="recycle">回收站<span class="c" id="c-recycle"></span></div>
      </div>
    </div>
    <div class="gd-sub"><span id="sort">上架时间 · 由近及远</span><span class="mng" id="mng">管理</span></div>
    <div class="gd-list" id="l"></div>`;
  const list=container.querySelector('#l');
  const sortEl=container.querySelector('#sort');
  const mngEl=container.querySelector('#mng');
  const state={tab:'sale',manage:false,refreshBulk(){},redraw(){}};

  // 扁平化：以 SKU 为单位。销售中/未上架均按 SKU 的上下架状态分桶
  const flatSkus=(tab)=>{const arr=[];PRODUCTS.forEach((g,gi)=>(g.skus||[]).forEach((s,si)=>{const rec=!!s.recycled;if(tab==='recycle'){if(rec)arr.push({g,s,gi,si});return;}if(rec)return;const on=!s.off;if(tab==='sale'?on:!on)arr.push({g,s,gi,si});}));return arr;};
  const allSkus=()=>{const arr=[];PRODUCTS.forEach(g=>(g.skus||[]).forEach(s=>arr.push(s)));return arr;};
  const refreshCounts=()=>{
    const c1=container.querySelector('#c-sale'),c2=container.querySelector('#c-off'),c3=container.querySelector('#c-recycle');const sk=allSkus();
    if(c1)c1.textContent=sk.filter(s=>!s.off&&!s.recycled).length;
    if(c2)c2.textContent=sk.filter(s=>s.off&&!s.recycled).length;
    if(c3)c3.textContent=sk.filter(s=>s.recycled).length;
  };
  const drawData=(tab)=>{
    refreshCounts();
    const data=flatSkus(tab);
    if(!data.length){
      const t3=tab==='recycle'?'回收站':(tab==='sale'?'销售中':'未上架');
      list.innerHTML=`<div class="empty"><div class="ei">${svg('box')}</div><h4>暂无${t3}规格</h4><p>${tab==='recycle'?'把不用的已下架规格移入回收站，可随时移出再用':(tab==='sale'?'上架任一规格后会出现在这里':'发布你的第一款商品开始经营')}</p></div>`;
      return;
    }
    list.innerHTML='';
    data.forEach(({g,s,gi,si})=>{const w=document.createElement('div');w.innerHTML=skuCard(g,s,gi,si,state.manage,tab);const c=w.firstElementChild;list.appendChild(c);bindSku(c,g,s,gi,si,state);});
  };
  state.redraw=()=>drawData(state.tab);
  const draw=(tab)=>{
    state.tab=tab;sortEl.textContent=(tab==='recycle'?'移入回收站':(tab==='sale'?'上架':'下架'))+'时间 · 由近及远';
    list.innerHTML=skel(3);                       // 骨架屏(H1)
    setTimeout(()=>drawData(tab),420);            // 模拟加载
  };
  container.querySelectorAll('#f .gd-pill').forEach(p=>p.onclick=()=>{
    const t=p.dataset.t;
    container.querySelectorAll('#f .gd-pill').forEach(x=>x.classList.remove('on'));
    p.classList.add('on');if(state.manage)exitManage();draw(t);
  });

  // 批量管理(H7)
  function enterManage(){state.manage=true;mngEl.textContent='完成';drawData(state.tab);showBulkBar();}
  function exitManage(){state.manage=false;mngEl.textContent='管理';hideBulkBar();drawData(state.tab);}
  mngEl.onclick=()=>state.manage?exitManage():enterManage();

  let bulkBar;
  function showBulkBar(){
    bulkBar=document.createElement('div');bulkBar.className='page-footer';bulkBar.style.cssText='position:absolute;left:0;right:0;bottom:0;z-index:8';
    const isRec=state.tab==='recycle';
    const toggleLabel=state.tab==='sale'?'下架':'上架';
    bulkBar.innerHTML=isRec
      ? `<div class="bulkbar"><div class="all" id="ba"><span class="b"></span>全选</div><span class="sp" id="bc">已选 0</span><button class="up" id="brs">移出 / 还原</button></div>`
      : `<div class="bulkbar"><div class="all" id="ba"><span class="b"></span>全选</div><span class="sp" id="bc">已选 0</span><button class="px" id="bpx">改价</button><button class="px" id="bst">改库存</button><button class="px" id="brc">移入回收</button><button class="up" id="bup">${toggleLabel}</button></div>`;
    container.appendChild(bulkBar);
    const data=()=>flatSkus(state.tab);
    state.refreshBulk=()=>{const d=data();const n=d.filter(x=>x.s._sel).length;bulkBar.querySelector('#bc').textContent='已选 '+n;
      bulkBar.querySelector('#ba .b').classList.toggle('on',n===d.length&&n>0);};
    bulkBar.querySelector('#ba').onclick=()=>{const d=data();const allOn=d.every(x=>x.s._sel);d.forEach(x=>x.s._sel=!allOn);drawData(state.tab);state.refreshBulk();};
    if(isRec){
      bulkBar.querySelector('#brs').onclick=()=>{const sel=data().filter(x=>x.s._sel);if(!sel.length)return toast('请先选择规格');
        confirmDialog({title:`批量移出 ${sel.length} 个规格？`,body:`将所选 ${sel.length} 个规格移出回收站，还原后为已下架、可再上架。`,okText:'移出/还原',onOk:()=>{sel.forEach(x=>{x.s.recycled=false;x.s.off=true;x.s.updatedAt=ts();x.g.updatedAt=ts();x.s._sel=false;});toast(`已移出 ${sel.length} 个规格`);exitManage();}});};
    }else{
      bulkBar.querySelector('#bup').onclick=()=>{const sel=data().filter(x=>x.s._sel);if(!sel.length)return toast('请先选择规格');
        const toOff=state.tab==='sale';const to=toOff?'下架':'上架';
        confirmDialog({title:`批量${to} ${sel.length} 个规格？`,body:`将${to}所选 ${sel.length} 个售卖规格(SKU)，即时生效、无需审核。`,danger:toOff,okText:to,onOk:()=>{sel.forEach(x=>{x.s.off=toOff;x.s.updatedAt=ts();x.g.updatedAt=ts();x.s._sel=false;});toast(`已${to} ${sel.length} 个规格`);exitManage();}});};
      bulkBar.querySelector('#bpx').onclick=()=>{const n=data().filter(x=>x.s._sel).length;if(!n)return toast('请先选择规格');toast(`批量改价 ${n} 个规格`);};
      bulkBar.querySelector('#bst').onclick=()=>{const n=data().filter(x=>x.s._sel).length;if(!n)return toast('请先选择规格');toast(`批量改库存 ${n} 个规格`);};
      bulkBar.querySelector('#brc').onclick=()=>{const sel=data().filter(x=>x.s._sel&&skuRecyclable(x.s));if(!sel.length)return toast('仅已下架规格可移入回收站');
        confirmDialog({title:`移入回收站 ${sel.length} 个规格？`,body:`将所选 ${sel.length} 个已下架规格移入回收站，可随时移出再用。`,okText:'移入回收站',onOk:()=>{sel.forEach(x=>{x.s.recycled=true;x.s.updatedAt=ts();x.g.updatedAt=ts();x.s._sel=false;});toast(`已移入回收站 ${sel.length} 个规格`);exitManage();}});};
    }
    state.refreshBulk();
  }
  function hideBulkBar(){bulkBar&&bulkBar.remove();bulkBar=null;}

  draw('sale');
}

function openGoodsPush(){pushPage({title:'商品管理',body:'<div id="gp"></div>',footer:`<button class="btn primary" style="width:100%" id="pub">发布商品</button>`,mount:(p)=>{renderList(p.querySelector('#gp'),false);p.querySelector('#pub').onclick=()=>window.FM_PUBLISH?window.FM_PUBLISH():toast('发布商品');}});}

// 改价格（逐 SKU，即时生效）；only 非空时仅编辑指定 SKU
function openPrice(g,only){
  const rate=taxRate(g),factor=1+rate/100;
  const idxs=(only!=null?[only]:g.skus.map((_,i)=>i));
  const SVC=0.05,PICKUP=0.00; // 服务费率 / 每件上门揽收费(固定字段,默认0)
  const incTxt=(incl)=>`佣金 S$${(incl*SVC).toFixed(2)} · 揽收费 S$${PICKUP.toFixed(2)} · 预计收入 <b style="color:var(--emerald-2)">S$${(incl*(1-SVC)-PICKUP).toFixed(2)}</b>`;
  pushPage({title:'改价格',body:`<div style="height:4px"></div>
    <div class="sku-ed">${idxs.map(i=>{const s=g.skus[i];return `
      <div class="r"><div class="nm">${g.n}<div class="c">${s.spec}</div></div>
        <div style="text-align:right">
          <div class="in"><span class="u">S$</span><input data-i="${i}" data-price value="${s.price||''}" inputmode="decimal" placeholder="未税价"></div>
          <div class="incl" data-incl="${i}" style="font-size:11.5px;color:#94A3B8;margin-top:5px">含税 S$${priceIncl(s.price,g).toFixed(2)}</div>
          <div class="inc-line" data-inc="${i}" style="font-size:11px;color:#94A3B8;margin-top:3px">${incTxt(priceIncl(s.price,g))}</div></div></div>`;}).join('')}</div>
    <div class="sku-ed-tip">${g.bcrs?`<b>BCRS 商品</b>：押金单价 S$${(+g.bcrsDeposit).toFixed(2)}/最小售卖单位在商品信息里维护，此处不改；押金为<b>过手项</b>，不计 GST、不计入佣金基数与预计收入。<br>`:''}价格维护到每个售卖规格(SKU)，录入<b>未税价</b>，系统按税率 ${rate}% 自动算含税价；提交即时生效。<b>商品佣金 = 含税价×服务费率(${(SVC*100).toFixed(0)}%)</b>，<b>上门揽收费</b>为单独固定字段(与价格/比例无关)，<b>预计收入 = 含税价−佣金−揽收费</b>；仅供参考，以订单结算为准。</div>
    <div style="height:10px"></div>`,
    footer:`<button class="btn primary" id="ps" disabled>提交改价</button>`,
    mount:(p)=>{
      const sub=p.querySelector('#ps');
      const check=()=>{let anyValid=false,anyErr=false;
        p.querySelectorAll('[data-price]').forEach(inp=>{const v=inp.value.trim();const box=inp.closest('.in');
          const incl=p.querySelector(`[data-incl="${inp.dataset.i}"]`);
          const incEl=p.querySelector(`[data-inc="${inp.dataset.i}"]`);
          const n=parseFloat(v);const inclV=(isNaN(n)?0:n)*factor;
          if(incl)incl.textContent='含税 S$'+inclV.toFixed(2);
          if(incEl)incEl.innerHTML=incTxt(inclV);
          if(!v){box.style.borderColor='';return;}
          const bad=isNaN(n)||n<=0||n>9999;box.style.borderColor=bad?'var(--red)':'';
          if(bad)anyErr=true;else anyValid=true;});
        sub.disabled=!(anyValid&&!anyErr);};
      p.querySelectorAll('[data-price]').forEach(i=>i.oninput=check);
      sub.onclick=()=>{sub.classList.add('loading');setTimeout(()=>{
        p.querySelectorAll('[data-price]').forEach(inp=>{const n=parseFloat(inp.value);if(!isNaN(n)&&n>0){const sk=g.skus[+inp.dataset.i];sk.price=n;sk.updatedAt=ts();}});g.updatedAt=ts();
        sub.classList.remove('loading');toast('改价成功，即时生效');setTimeout(popPage,600);},700);};
    }});
}

// 改库存（逐 SKU，即时生效）；only 非空时仅编辑指定 SKU
// 两种库存模式：daily=每日恢复初始库存（每天 0 点自动补回库存总数）/ finite=售完即止（卖完不恢复、售罄下线）
const stkHint=m=>m==='daily'?'每日 0 点自动恢复至库存总数':'售完即止，不自动恢复；0 即售罄';
function openStock(g,only){
  const idxs=(only!=null?[only]:g.skus.map((_,i)=>i));
  pushPage({title:'改库存',body:`<div style="height:4px"></div>
    ${idxs.map(i=>{const s=g.skus[i];const m=s.stockMode||'finite';return `
    <div class="stk-blk" data-blk="${i}">
      <div class="bnm">${g.n}<span class="c">${s.spec}</span></div>
      <div class="stk-row"><div class="lbl">库存模式</div>
        <div class="seg" data-seg="${i}">
          <div class="o ${m==='daily'?'on':''}" data-mode="daily">每日恢复初始库存</div>
          <div class="o ${m==='finite'?'on':''}" data-mode="finite">售完即止</div>
        </div></div>
      <div class="stk-row"><div class="lbl">库存总数</div>
        <div class="stk-fld">
          <div class="stk-in"><input data-i="${i}" data-stock value="${s.stock||0}" inputmode="numeric"></div>
          <div class="stk-hint" data-hint="${i}">${stkHint(m)}</div>
          <div class="stk-ref" data-ref="${i}">销量参考 ›</div>
        </div></div>
      <div class="stk-sold">今日已售 <b>${s.soldToday||0}</b></div>
    </div>`;}).join('')}
    <div class="sku-ed-tip">库存维护到每个售卖规格(SKU)。<b>每日恢复初始库存</b>：每天 0 点自动把可售库存补回设定的库存总数，适合每日稳定供应；<b>售完即止</b>：卖完不再恢复、售罄即下线，适合尾货/限量。提交后即时生效、无需审核。</div>
    <div style="height:10px"></div>`,
    footer:`<button class="btn primary" id="sv">保存</button>`,
    mount:(p)=>{
      const sv=p.querySelector('#sv');
      // 模式切换（即时改提示文案；保存时落库）
      p.querySelectorAll('.seg').forEach(seg=>{const i=seg.dataset.seg;
        seg.querySelectorAll('.o').forEach(o=>o.onclick=()=>{
          seg.querySelectorAll('.o').forEach(x=>x.classList.remove('on'));o.classList.add('on');
          const h=p.querySelector(`[data-hint="${i}"]`);if(h)h.textContent=stkHint(o.dataset.mode);});});
      // 销量参考：给出昨日/近7日均值/峰值三档建议，一键填入（选择优于输入，计算交给系统）
      p.querySelectorAll('.stk-ref').forEach(r=>{const i=r.dataset.ref;r.onclick=()=>salesRef(p,i,g,g.skus[+i]);});
      const check=()=>{let ok=true;p.querySelectorAll('[data-stock]').forEach(inp=>{const n=parseInt(inp.value,10);const bad=isNaN(n)||n<0;inp.closest('.stk-in').style.borderColor=bad?'var(--red)':'';if(bad)ok=false;});sv.disabled=!ok;};
      p.querySelectorAll('[data-stock]').forEach(inp=>inp.oninput=check);
      sv.onclick=()=>{sv.classList.add('loading');setTimeout(()=>{
        p.querySelectorAll('[data-blk]').forEach(blk=>{const sk=g.skus[+blk.dataset.blk];
          const inp=blk.querySelector('[data-stock]');const n=parseInt(inp.value,10);if(!isNaN(n)&&n>=0)sk.stock=n;
          const on=blk.querySelector('.seg .o.on');sk.stockMode=on?on.dataset.mode:'finite';sk.updatedAt=ts();});
        g.updatedAt=ts();sv.classList.remove('loading');toast('保存成功，即时生效');setTimeout(popPage,600);},700);};
    }});
}
// 近 7 日销量参考 → 三档建议值一键填入库存总数
function salesRef(p,i,g,s){
  const base=Math.max(1,g.sales||Math.round((+s.soldToday||0))||6);
  const yest=Math.max(1,+s.soldToday||g.sales||base);
  const avg=Math.max(1,Math.round(base*0.9));
  const peak=Math.max(1,Math.round(base*1.4));
  const fill=v=>{const inp=p.querySelector(`.stk-blk[data-blk="${i}"] [data-stock]`);if(inp){inp.value=v;inp.dispatchEvent(new Event('input'));toast(`已填入库存总数 ${v}`);}};
  sheet([
    {label:`按昨日销量填入 ${yest}`,onClick:()=>fill(yest)},
    {label:`按近 7 日均值填入 ${avg}`,onClick:()=>fill(avg)},
    {label:`按近 7 日峰值填入 ${peak}`,onClick:()=>fill(peak)},
  ]);
}

function openMore(g,s,state){
  // 已去除：整体上下架/分享给客户/删除商品；仅保留 编辑商品、复制商品；已下架规格可移入回收站
  const items=[
    {label:'编辑商品',onClick:()=>toast('编辑商品')},
    {label:'复制商品',onClick:()=>toast('复制商品')},
  ];
  if(s&&skuRecyclable(s))items.push({label:'移入回收站',onClick:()=>doRecycle(g,s,state)});
  sheet(items);
}
// 移入回收站 / 移出还原（永久保留，无删除；还原后=已下架）
function doRecycle(g,s,state){confirmDialog({title:'移入回收站？',body:`「${g.n} ${s.spec}」移入回收站后停止售卖，可随时移出再用。`,okText:'移入回收站',onOk:()=>{s.recycled=true;s.updatedAt=ts();g.updatedAt=ts();toast('已移入回收站');state.redraw();}});}
function doRestore(g,s,state){confirmDialog({title:'移出回收站？',body:`「${g.n} ${s.spec}」还原后为已下架，可再上架售卖。`,okText:'移出/还原',onOk:()=>{s.recycled=false;s.off=true;s.updatedAt=ts();g.updatedAt=ts();toast('已移出回收站（已下架）');state.redraw();}});}
function showSupplement(){
  confirmDialog({title:'商品信息缺失',body:'当前商品缺少必要属性，不符合治理规则，已被限流。补充信息后可恢复曝光。',okText:'去补充',onOk:()=>toast('前往补充信息')});
}

window.FM_MOD=window.FM_MOD||{};
window.FM_MOD.goods=openGoodsPush;
window.FM_MOD.goodsInline=(c)=>renderList(c,true);
})();
