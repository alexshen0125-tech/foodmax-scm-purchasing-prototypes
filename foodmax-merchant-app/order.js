/* Food Max 商家端 v2 · 订单模块
   订单列表还原(快驴卖家App 11_订单列表)：筛选行/订单卡/商品行/预计收入
   评审修复内建：骨架屏(先 skel→数据)/订单状态可切换+空态/筛选 toast/44px/SG 仓库·S$ 币种 */
(function(){
const {pushPage,toast,sheet,svg,skel}=window.FM;

const css=document.createElement('style');
css.textContent=`
.od-bar{position:sticky;top:0;z-index:6;background:var(--bg);display:flex;padding:8px 8px 12px;}
.od-fl{flex:1;min-height:44px;display:flex;align-items:center;justify-content:center;gap:5px;font-size:14px;font-weight:600;color:#27433A;cursor:pointer;}
.od-fl.on{color:var(--emerald);font-weight:700;}
.od-fl svg{width:14px;height:14px;stroke:currentColor;fill:none;stroke-width:2.4;transition:transform .2s;}
.od-fl.on svg{transform:rotate(180deg);}
.od-list{padding:4px 16px 18px;}
.oc{background:#fff;border-radius:18px;padding:15px 16px;margin-bottom:13px;box-shadow:var(--sh-sm);cursor:pointer;}
.oc .oh{display:flex;align-items:center;justify-content:space-between;padding-bottom:12px;border-bottom:1px solid var(--line);}
.oc .buyer{font-size:16px;font-weight:700;letter-spacing:.5px;}
.oc .st{font-size:14px;font-weight:700;}
.oc .st.emerald{color:var(--emerald);}
.oc .st.amber{color:var(--amber);}
.oc .st.sub{color:var(--sub);}
.oc .st.red{color:var(--red);}
.oc .meta{padding:11px 0 4px;}
.oc .ml{display:flex;font-size:13px;line-height:1.9;color:#27433A;}
.oc .ml .lk{flex:0 0 64px;color:var(--sub);}
.oc .ml .sg{font-size:9.5px;border:1px solid var(--emerald);color:var(--emerald);padding:0 4px;border-radius:4px;margin-left:6px;vertical-align:1px;}
.oc .it{display:flex;gap:12px;padding-top:11px;}
.oc .it .img{width:62px;height:62px;border-radius:13px;flex:0 0 62px;background:var(--mint-soft);display:flex;align-items:center;justify-content:center;font-size:30px;}
.oc .it .ib{flex:1;min-width:0;}
.oc .it .nm{font-size:15px;font-weight:700;line-height:1.25;}
.oc .it .rw{font-size:13px;color:#46604F;margin-top:5px;}
.oc .it .rw b{font-weight:600;color:var(--ink);}
.oc .it .booked{font-size:10.5px;font-weight:700;color:var(--emerald);background:var(--mint-soft);padding:1px 7px;border-radius:20px;margin-left:5px;}
.oc .foot{display:flex;align-items:baseline;justify-content:flex-end;gap:14px;margin-top:13px;padding-top:12px;border-top:1px solid var(--line);font-size:13px;color:var(--sub);}
.oc .foot .inc{font-size:13px;color:#27433A;}
.oc .foot .inc b{font-size:18px;font-weight:600;color:var(--emerald-2);margin-left:3px;}
`;
document.head.appendChild(css);

// SG 订单数据（买家昵称脱敏 / 金额 S$ / 仓库 SG DC）
const ORDERS=[
  {buyer:'陈***',st:'待发货',ot:'2026-06-30 19:11:03',dt:'2026-07-01 06:00~10:00',wh:'裕廊DC',
   ic:'🍢',nm:'【鲜丰】精品油豆泡',price:'S$5.99/袋',qty:'1袋',cnt:1,inc:'S$20.79'},
  {buyer:'林***',st:'待发货',ot:'2026-06-30 19:08:46',dt:'2026-07-01 06:00~10:00',wh:'兀兰DC',
   ic:'🧈',nm:'【鲜丰】盐卤老豆腐 5斤',price:'S$11.99/袋',qty:'1袋',cnt:1,inc:'S$9.59'},
  {buyer:'黄****',st:'待发货',ot:'2026-06-30 19:08:13',dt:'2026-07-01 04:00~06:00',wh:'盛港DC',
   ic:'🥬',nm:'【鲜丰】嫩豆腐 1kg',price:'S$9.99/袋',qty:'2袋',cnt:2,inc:'S$18.98'},
  {buyer:'王*****',st:'待发货',ot:'2026-06-30 19:08:12',dt:'2026-07-01 06:00~10:00',wh:'大巴窑DC',
   ic:'🟡',nm:'【鲜丰】萝卜丸子 2.5kg',price:'S$8.80/袋',qty:'1袋',cnt:1,inc:'S$8.36'},
];
const RECEIVE=[
  {buyer:'李***',st:'待收货',ot:'2026-06-30 06:12:30',dt:'2026-06-30 06:00~10:00',wh:'淡滨尼DC',
   ic:'🥗',nm:'【鲜丰】盐渍海带丝 4kg',price:'S$29.99/箱',qty:'1箱',cnt:1,inc:'S$28.49'},
  {buyer:'吴****',st:'待收货',ot:'2026-06-29 18:55:02',dt:'2026-06-30 04:00~06:00',wh:'义顺DC',
   ic:'🧈',nm:'【鲜丰】老豆腐 2.5kg',price:'S$11.99/盒',qty:'2盒',cnt:2,inc:'S$22.78'},
];
const DONE=[
  {buyer:'赵***',st:'已完成',ot:'2026-06-28 19:02:11',dt:'2026-06-29 06:00~10:00',wh:'裕廊DC',
   ic:'🍢',nm:'【鲜丰】小油豆腐 2斤',price:'S$8.80/袋',qty:'3袋',cnt:3,inc:'S$25.08'},
];
const CANCEL=[]; // 演示空态

const TABS=[
  {k:'send',label:'待发货',data:ORDERS},
  {k:'recv',label:'待收货',data:RECEIVE},
  {k:'done',label:'已完成',data:DONE},
  {k:'cancel',label:'已取消',data:CANCEL},
];
const STCLASS={'待发货':'emerald','待收货':'amber','已完成':'sub','已取消':'red'};

function card(o){
  return `<div class="oc" data-buyer="${o.buyer}">
    <div class="oh"><span class="buyer">${o.buyer}</span><span class="st ${STCLASS[o.st]||'emerald'}">${o.st}</span></div>
    <div class="meta">
      <div class="ml"><span class="lk">下单时间</span><span>${o.ot}</span></div>
      <div class="ml"><span class="lk">配送时间</span><span>${o.dt}</span></div>
      <div class="ml"><span class="lk">配送仓库</span><span>${o.wh}<i class="sg">SG仓</i></span></div>
    </div>
    <div class="it"><div class="img">${o.ic}</div>
      <div class="ib"><div class="nm">${o.nm}</div>
        <div class="rw">单价 <b>${o.price}</b></div>
        <div class="rw">数量 ${o.qty}<span class="booked">已预订</span></div>
      </div></div>
    <div class="foot"><span>共${o.cnt}件商品</span><span class="inc">预计收入<b class="disp">${o.inc}</b></span></div>
  </div>`;
}

function renderList(container,inTab){
  container.innerHTML=`
    ${inTab?`<div class="hm-top" style="padding:14px 20px 4px"><div class="hm-store"><div class="nm disp" style="font-size:24px">订单</div></div><div class="hm-bell">${svg('search')}</div></div>`:''}
    <div class="od-bar">
      <div class="od-fl on" data-f="status">订单状态${svg('back','style="transform:rotate(-90deg)"')}</div>
      <div class="od-fl" data-f="time">订单时间${svg('back','style="transform:rotate(-90deg)"')}</div>
      <div class="od-fl" data-f="wh">全部仓库${svg('back','style="transform:rotate(-90deg)"')}</div>
    </div>
    <div class="od-list" id="ol"></div>`;
  const list=container.querySelector('#ol');
  const statusFl=container.querySelector('[data-f="status"]');
  const state={tab:'send'};

  const drawData=(k)=>{
    const tab=TABS.find(t=>t.k===k);
    if(!tab.data.length){
      list.innerHTML=`<div class="empty"><div class="ei">${svg('receipt')}</div><h4>暂无${tab.label}订单</h4><p>该状态下还没有订单，换个筛选条件看看</p></div>`;
      return;
    }
    list.innerHTML=tab.data.map(card).join('');
    list.querySelectorAll('.oc').forEach(c=>c.onclick=()=>toast('订单详情'));
  };
  const draw=(k)=>{
    state.tab=k;
    list.innerHTML=skel(3);                  // 骨架屏：先占位
    setTimeout(()=>drawData(k),420);         // 再渲染真实数据
  };

  // 订单状态：可切换的状态筛选（含空态演示）
  statusFl.onclick=()=>{
    sheet(TABS.map(t=>({label:`${t.label}（${t.data.length}）`,onClick:()=>{
      statusFl.firstChild.textContent=t.label;draw(t.k);
    }})));
  };
  // 订单时间 / 全部仓库：toast 占位
  container.querySelector('[data-f="time"]').onclick=()=>toast('选择订单时间');
  container.querySelector('[data-f="wh"]').onclick=()=>toast('选择配送仓库');

  draw('send');
}

function openOrderPush(){
  pushPage({title:'订单列表',body:'<div id="op"></div>',mount:(p)=>renderList(p.querySelector('#op'),false)});
}

window.FM_MOD=window.FM_MOD||{};
window.FM_MOD.order=openOrderPush;                         // 金刚区入口
window.FM_MOD.orderInline=(c)=>renderList(c,true);         // 底部「订单」Tab
})();
