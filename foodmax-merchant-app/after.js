/* Food Max 商家端 v2 · 售后管理模块（最复杂）
   还原快驴卖家App售后：列表(6 Tab) + 判责详情 + 商品质量等级(含定级介绍弹窗) + 判责记录时间线
   评审修复内建：各 Tab 先骨架→数据 / 申诉中空态 / 认责等不可逆动作 confirmDialog / 44px / 币种 S$ / SG 仓库 */
(function(){
const {pushPage,popPage,toast,confirmDialog,sheet,svg,skel}=window.FM;

const css=document.createElement('style');
css.textContent=`
/* 顶部提示条 */
.as-notice{margin:2px 16px 0;padding:11px 14px;border-radius:12px;background:var(--red-soft);color:var(--red);font-size:12.5px;line-height:1.5;}
.as-yellow{margin:11px 16px 0;padding:11px 14px;border-radius:12px;background:var(--amber-soft);color:#92651A;font-size:12.5px;line-height:1.5;}
/* 两数据卡 */
.as-dcards{display:flex;gap:12px;padding:13px 16px 2px;}
.as-dcard{flex:1;background:#fff;border-radius:18px;padding:15px 14px;box-shadow:var(--sh-sm);cursor:pointer;}
.as-dcard .h{display:flex;align-items:center;justify-content:space-between;margin-bottom:13px;}
.as-dcard .h .t{font-size:16px;font-weight:700;}
.as-dcard .h svg{width:16px;height:16px;stroke:var(--sub);fill:none;stroke-width:2.4;}
.as-dcard .nums{display:flex;}
.as-dcard .nums .n{flex:1;}
.as-dcard .nums .n .v{font-size:23px;font-weight:600;font-family:'Lora',serif;}
.as-dcard .nums .n.red .v{color:var(--red);}
.as-dcard .nums .n .l{font-size:11.5px;color:var(--sub);margin-top:1px;}
/* 筛选行 */
.as-filters{display:flex;align-items:center;gap:14px;padding:13px 16px 2px;}
.as-filters .fl{display:flex;align-items:center;gap:4px;font-size:13.5px;color:#27433A;font-weight:600;min-height:40px;cursor:pointer;}
.as-filters .fl svg{width:12px;height:12px;stroke:var(--sub);fill:none;stroke-width:2.6;}
.as-filters .ft{margin-left:auto;font-size:11.5px;color:var(--sub);background:var(--muted);padding:7px 11px;border-radius:9px;}
/* Tab 横向可滑 */
.as-tabs{display:flex;gap:4px;padding:6px 8px 0;overflow-x:auto;border-bottom:1px solid var(--line);}
.as-tabs::-webkit-scrollbar{display:none;}
.as-tabs .tb{flex:0 0 auto;min-height:44px;display:flex;align-items:center;padding:0 12px;font-size:14.5px;color:var(--sub);font-weight:600;cursor:pointer;position:relative;}
.as-tabs .tb.on{color:var(--emerald);font-weight:700;}
.as-tabs .tb.on::after{content:"";position:absolute;left:12px;right:12px;bottom:0;height:3px;border-radius:3px;background:var(--emerald);}
.as-list{padding:13px 16px 18px;}
/* 售后卡 */
.ac{background:#fff;border-radius:18px;padding:15px;margin-bottom:13px;box-shadow:var(--sh-sm);}
.ac .ah{display:flex;align-items:center;gap:9px;margin-bottom:12px;}
.ac .ah .ty{font-size:15.5px;font-weight:700;}
.ac .ah .resp{font-size:10.5px;font-weight:700;padding:2px 8px;border-radius:6px;background:var(--amber-soft);color:#B45309;}
.ac .ah .resp.kl{background:var(--mint-soft);color:var(--emerald-2);}
.ac .ah .rt{margin-left:auto;font-size:12.5px;color:var(--sub);font-weight:600;}
.ac .gr{display:flex;gap:12px;}
.ac .gr .img{width:60px;height:60px;border-radius:12px;flex:0 0 60px;background:var(--mint-soft);display:flex;align-items:center;justify-content:center;font-size:28px;}
.ac .gr .gi{flex:1;min-width:0;}
.ac .gr .gi .nm{font-size:15px;font-weight:600;display:flex;justify-content:space-between;}
.ac .gr .gi .sp{font-size:12.5px;color:var(--sub);margin-top:4px;display:flex;justify-content:space-between;}
.ac .paid{text-align:right;font-size:12.5px;color:#46604F;margin-top:11px;}
.ac .paid b{color:var(--red);font-weight:700;}
/* 判责结果块 */
.ac .judge{margin-top:12px;padding:12px 13px;border-radius:12px;background:var(--muted);}
.ac .judge .jh{font-size:14px;font-weight:700;margin-bottom:9px;}
.ac .judge .jh .amt{color:var(--red);margin-left:6px;}
.ac .judge .jh.appeal{color:var(--red);}
.ac .judge .jh.appeal .cd{font-weight:700;}
.ac .judge .jr{display:flex;justify-content:space-between;font-size:12.5px;color:var(--sub);padding:3px 0;}
.ac .judge .jr b{color:#27433A;font-weight:600;}
/* 全部售后变体 */
.ac .allh{display:flex;align-items:center;justify-content:space-between;margin-bottom:11px;}
.ac .allh .ty{font-size:15.5px;font-weight:700;}
.ac .allh .ty.red{color:var(--red);}
.ac .allh .st{font-size:12.5px;color:var(--sub);}
.ac .meta{font-size:12.5px;color:var(--sub);}
.ac .meta .r{display:flex;padding:4px 0;}
.ac .meta .r .k{width:80px;flex:0 0 80px;}
.ac .meta .r .v{color:#27433A;}
.ac .meta .r .v.red{color:var(--red);font-weight:600;}
.ac hr{border:none;border-top:1px solid var(--line);margin:11px 0;}
.ac .det{margin-top:12px;display:flex;justify-content:flex-end;}
.ac .det .btn-d{min-height:38px;display:flex;align-items:center;padding:0 18px;border:1px solid var(--emerald);color:var(--emerald);font-size:13.5px;font-weight:700;border-radius:10px;cursor:pointer;}
/* 空态 */
.empty{display:flex;flex-direction:column;align-items:center;justify-content:center;padding:70px 40px;gap:14px;text-align:center;}
.empty .ei{width:96px;height:96px;border-radius:28px;background:var(--mint-soft);display:flex;align-items:center;justify-content:center;}
.empty .ei svg{width:42px;height:42px;stroke:var(--emerald-2);fill:none;stroke-width:1.4;}
.empty h4{font-size:17px;font-weight:700;}.empty p{font-size:13px;color:var(--sub);}
/* 判责详情头部 */
.as-dhead{background:linear-gradient(135deg,#059669,#10B981);color:#fff;padding:18px 18px 22px;}
.as-dhead .row{display:flex;align-items:center;gap:10px;}
.as-dhead .big{font-size:26px;font-weight:700;}
.as-dhead .resp{font-size:11px;font-weight:700;padding:3px 9px;border-radius:7px;background:rgba(255,255,255,.22);}
.as-dhead .sub{margin-top:10px;font-size:13px;opacity:.92;}
.as-dhead .sub b{font-size:17px;font-family:'Lora',serif;font-weight:600;margin-left:4px;}
.as-dblock{background:#fff;border-radius:16px;margin:13px 16px;padding:15px;box-shadow:var(--sh-sm);}
.as-dblock .bt{font-size:16px;font-weight:700;margin-bottom:12px;display:flex;justify-content:space-between;align-items:center;}
.as-dblock .bt .lk{font-size:13.5px;color:var(--emerald);font-weight:700;cursor:pointer;min-height:44px;display:flex;align-items:center;}
.as-dred{margin:13px 16px 0;padding:11px 14px;border-radius:12px;background:var(--red-soft);color:var(--red);font-size:12.5px;line-height:1.5;}
.as-row{display:flex;font-size:13.5px;padding:6px 0;}
.as-row .k{width:84px;flex:0 0 84px;color:var(--sub);}
.as-row .v{flex:1;color:#27433A;}
.as-row .v.red{color:var(--red);font-weight:600;}
.as-row .cp{font-size:10.5px;border:1px solid var(--line);color:var(--emerald);padding:1px 6px;border-radius:5px;margin-left:8px;cursor:pointer;}
.as-imgs{display:flex;gap:8px;margin:4px 0 2px;}
.as-imgs .im{width:62px;height:62px;border-radius:9px;background:var(--muted);display:flex;align-items:center;justify-content:center;}
.as-imgs .im svg{width:22px;height:22px;stroke:#B6C8BF;fill:none;stroke-width:1.6;}
.as-gline{display:flex;gap:12px;align-items:center;padding-bottom:12px;border-bottom:1px solid var(--line);margin-bottom:11px;}
.as-gline .img{width:54px;height:54px;border-radius:11px;background:var(--mint-soft);display:flex;align-items:center;justify-content:center;font-size:26px;}
.as-gline .gi{flex:1;}
.as-gline .gi .nm{font-size:14.5px;font-weight:600;display:flex;justify-content:space-between;}
.as-gline .gi .sp{font-size:12px;color:var(--sub);margin-top:3px;display:flex;justify-content:space-between;}
/* 详情底部双按钮 */
.as-foot{display:flex;gap:12px;}
.as-foot .btn{margin:0;}
.as-foot .btn.ghost{flex:1;}
.as-foot .btn.primary{flex:1.5;}
/* 商品质量等级 数据概览 */
.q-over{background:#fff;border-radius:18px;margin:13px 16px;padding:16px;box-shadow:var(--sh-sm);}
.q-over .qt{font-size:16px;font-weight:700;margin-bottom:13px;}
.q-over .qg{display:flex;}
.q-over .qg .qn{flex:1;}
.q-over .qg .qn .l{font-size:12px;color:var(--sub);margin-bottom:3px;}
.q-over .qg .qn .v{font-size:21px;font-weight:600;font-family:'Lora',serif;}
.q-over .qg .qn .v.red{color:var(--red);}
.q-over .qg .qn .x{font-size:11px;color:var(--sub);margin-top:2px;}
.q-over hr{border:none;border-top:1px solid var(--line);margin:14px 0;}
.q-over .beat{font-size:13.5px;color:#27433A;}.q-over .beat b{color:var(--emerald);font-weight:700;}
.q-deTab{display:flex;align-items:center;gap:10px;padding:0 16px;margin-top:6px;}
.q-deTab .t{font-size:15px;font-weight:700;color:var(--emerald);position:relative;min-height:44px;display:flex;align-items:center;}
.q-deTab .t::after{content:"";position:absolute;left:0;right:0;bottom:8px;height:3px;border-radius:3px;background:var(--emerald);}
.q-acts{display:flex;gap:10px;padding:4px 16px 0;}
.q-acts .b{min-height:40px;display:flex;align-items:center;padding:0 16px;border-radius:10px;font-size:13px;font-weight:600;background:var(--muted);color:#27433A;cursor:pointer;}
.q-card{background:#fff;border-radius:16px;margin:12px 16px;padding:15px;box-shadow:var(--sh-sm);}
.q-card .top{display:flex;gap:12px;}
.q-card .top .img{width:56px;height:56px;border-radius:12px;background:var(--mint-soft);display:flex;align-items:center;justify-content:center;font-size:26px;flex:0 0 56px;}
.q-card .top .ci{flex:1;}
.q-card .top .ci .nm{font-size:15.5px;font-weight:700;display:flex;align-items:center;gap:7px;}
.q-card .top .det{font-size:13px;color:var(--emerald);font-weight:700;align-self:flex-start;cursor:pointer;}
.q-card .grade{display:inline-flex;align-items:center;justify-content:center;width:20px;height:20px;border-radius:5px;background:var(--amber);color:#fff;font-size:12px;font-weight:700;margin-right:6px;}
.q-card .rate{font-size:13px;color:#27433A;margin-top:7px;}
.q-card .rule{font-size:12px;color:var(--sub);margin-top:4px;}
.q-card .tag-de{font-size:10.5px;font-weight:700;padding:2px 7px;border-radius:6px;background:var(--amber-soft);color:#B45309;}
.q-card .warn{margin-top:11px;}
.q-card .warn .wt{font-size:10.5px;font-weight:700;padding:2px 7px;border-radius:6px;background:var(--amber-soft);color:#B45309;}
.q-card .warn .wx{font-size:12px;color:var(--sub);margin-top:5px;}
/* 定级介绍弹窗 */
.q-mask{position:absolute;inset:0;background:rgba(15,23,42,.5);z-index:60;display:flex;align-items:flex-end;}
.q-modal{background:#fff;width:100%;max-height:82%;border-radius:22px 22px 0 0;display:flex;flex-direction:column;}
.q-modal .mh{padding:18px 18px 6px;text-align:center;font-size:17px;font-weight:700;}
.q-modal .mc{overflow-y:auto;padding:6px 18px 8px;}
.q-modal h5{font-size:14px;font-weight:700;text-align:center;margin:16px 0 7px;}
.q-modal p{font-size:12.5px;color:#46604F;line-height:1.6;}
.q-modal .em{color:var(--red);}
.q-tbl{width:100%;border-collapse:collapse;margin-top:8px;font-size:12.5px;}
.q-tbl th{background:var(--muted);color:var(--sub);font-weight:600;padding:9px 8px;text-align:left;}
.q-tbl td{padding:9px 8px;border-bottom:1px solid var(--line);color:#27433A;}
.q-tbl td:first-child{font-weight:700;}
.q-modal .mf{padding:12px 18px 18px;}
/* 判责记录 时间线 */
.tl{padding:16px 16px 22px;}
.tl .it{position:relative;padding-left:22px;padding-bottom:20px;}
.tl .it::before{content:"";position:absolute;left:4px;top:6px;width:9px;height:9px;border-radius:50%;background:var(--emerald);}
.tl .it::after{content:"";position:absolute;left:8px;top:15px;bottom:0;width:1.5px;background:var(--line);}
.tl .it:last-child::after{display:none;}
.tl .time{font-size:13px;font-weight:700;color:#27433A;margin-bottom:9px;}
.tl .box{background:#fff;border-radius:14px;padding:13px;box-shadow:var(--sh-sm);}
.tl .box .bh{display:flex;align-items:center;justify-content:space-between;margin-bottom:9px;}
.tl .box .bh .who{font-size:14px;font-weight:700;}
.tl .box .bh .act{font-size:13px;font-weight:700;color:var(--emerald);}
.tl .box .bh .act.appeal{color:var(--red);}
.tl .box .ln{display:flex;font-size:12.5px;padding:3px 0;}
.tl .box .ln .k{width:78px;flex:0 0 78px;color:var(--sub);}
.tl .box .ln .v{flex:1;color:#27433A;line-height:1.55;}
.tl .box .ln .v.tip{color:var(--emerald);}
.tl .box .ln .v.tip .em{color:var(--red);}
.tl .box .evs{display:flex;gap:7px;margin-top:4px;}
.tl .box .evs .ev{width:54px;height:54px;border-radius:8px;background:var(--muted);display:flex;align-items:center;justify-content:center;}
.tl .box .evs .ev svg{width:20px;height:20px;stroke:#B6C8BF;fill:none;stroke-width:1.6;}
`;
document.head.appendChild(css);

/* ========== 数据（Food Max SG 本地化） ========== */
const RESP_KL='Food Max承担全部'; // 截图为「快驴承担全部」，本地化为平台
// 判责卡（商责/可申诉/申诉完成/待处理）
const TABS=[
  ['pending','待处理'],['all','全部售后'],['merchant','商责'],
  ['appeal','可申诉'],['appealing','申诉中'],['done','申诉完成'],
];
const DATA={
  pending:[
    {ty:'仅退款',resp:'合作商承担100%',img:'🧈',nm:'盐卤老豆腐 5斤',sp:'5斤/袋',price:'S$11.99',qty:1,
     paid:'S$11.99',countdown:'剩余1天2时33分',judgeTime:'2026-06-29 21:45:45',appealAmt:'S$11.99',
     reason:'商品质量问题-商品异味问题',orderNo:'KL2606290006946',oid:'KL2606270056244410',
     orderDate:'2026-06-27',wh:'裕廊DC',afAmt:'S$11.99',afQty:1,city:'中区'},
    {ty:'缺货退款',resp:'合作商承担100%',img:'🍢',nm:'鲜丰 · 小油豆腐',sp:'2斤/袋',price:'S$8.80',qty:1,
     paid:'S$8.80',countdown:'剩余0天23时39分',judgeTime:'2026-06-29 08:35:50',appealAmt:'S$8.80',
     reason:'缺货-司机未送达',orderNo:'TK2606300012088',oid:'KL2606280091233',
     orderDate:'2026-06-28',wh:'兀兰DC',afAmt:'S$8.80',afQty:1,city:'西区'},
  ],
  merchant:[
    {ty:'退货退款',resp:'合作商承担100%',img:'🧈',nm:'盐卤老豆腐 5斤',sp:'5斤/袋',price:'S$11.99',qty:1,
     paid:'S$11.99',needPay:'S$11.99',judgeTime:'2026-06-28 09:20:48',appealAmt:'S$0',
     reason:'商品质量问题-商品异味问题',orderNo:'TK2606280028401',oid:'KL2606270056200',
     orderDate:'2026-06-27',wh:'裕廊DC',afAmt:'S$11.99',afQty:1,city:'中区'},
    {ty:'仅退款',resp:'合作商承担100%',img:'🧈',nm:'盐卤老豆腐 5斤',sp:'5斤/袋',price:'S$11.99',qty:1,
     paid:'S$11.99',needPay:'S$11.99',judgeTime:'2026-06-28 08:11:02',appealAmt:'S$0',
     reason:'商品质量问题-商品变质',orderNo:'TK2606280028409',oid:'KL2606270056244',
     orderDate:'2026-06-27',wh:'盛港DC',afAmt:'S$11.99',afQty:1,city:'东区'},
  ],
  appeal:[
    {ty:'仅退款',resp:'合作商承担100%',img:'🧈',nm:'盐卤老豆腐 5斤',sp:'5斤/袋',price:'S$11.99',qty:1,
     paid:'S$11.99',countdown:'剩余1天2时33分',judgeTime:'2026-06-29 21:45:45',appealAmt:'S$11.99',
     reason:'商品质量问题-商品异味问题',orderNo:'TK2606290006946',oid:'KL2606270056244410',
     orderDate:'2026-06-27',wh:'裕廊DC',afAmt:'S$11.99',afQty:1,city:'中区'},
    {ty:'仅退款',resp:'合作商承担100%',img:'🥬',nm:'嫩豆腐 5斤',sp:'2.5kg/盒',price:'S$7.99',qty:2,
     paid:'S$15.98',countdown:'剩余0天23时39分',judgeTime:'2026-06-29 08:35:50',appealAmt:'S$15.98',
     reason:'商品质量问题-商品异味问题',orderNo:'TK2606290006946',oid:'KL2606270056244410',
     orderDate:'2026-06-27',wh:'裕廊DC',afAmt:'S$15.98',afQty:2,city:'西区'},
  ],
  appealing:[], // 申诉中 → 空态
  done:[
    {ty:'仅退款',resp:'合作商无需承担',img:'🍢',nm:'鲜丰 · 小油豆腐',sp:'1kg/组(2袋)',price:'S$11.88',qty:1,
     paid:'S$11.88',needPay:'S$0',judgeTime:'2026-06-17 14:15:47',appealAmt:'S$0',done:1,
     reason:'其它原因-货品送错',orderNo:'TK2606170018866',oid:'KL2606160077120',
     orderDate:'2026-06-16',wh:'大巴窑DC',afAmt:'S$11.88',afQty:1,city:'北区'},
    {ty:'仅退款',resp:'合作商承担100%',img:'🧈',nm:'盐卤老豆腐 5斤 - 严选',sp:'5斤/袋',price:'S$11.99',qty:2,
     paid:'S$23.98',needPay:'S$23.98',judgeTime:'2026-06-16 10:02:31',appealAmt:'S$0',done:1,
     reason:'商品质量问题-商品变质',orderNo:'TK2606160009921',oid:'KL2606150033410',
     orderDate:'2026-06-15',wh:'淡滨尼DC',afAmt:'S$23.98',afQty:2,city:'东区'},
  ],
};
// 全部售后（不同布局：右侧状态文案 + 售后时间/单号/金额）
const ALL=[
  {ty:'优惠券赔付',red:1,st:'发券成功',afTime:'2026-06-30 14:43:58',no:'TQ2606300001435',amt:'-S$10.00',img:'🧈'},
  {ty:'仅退款',st:'待确认责任方',afTime:'2026-06-30 14:25:04',no:'TK2606300028409',amt:'-S$23.97',img:'🧈'},
  {ty:'仅退款',st:'已退款',afTime:'2026-06-30 11:08:17',no:'TK2606300018002',amt:'-S$11.99',img:'🥬'},
];

/* ========== A 售后列表 ========== */
function respClass(r){return r===RESP_KL?'kl':'';}

function judgeCard(d){
  const judge = d.countdown
    ? `<div class="judge"><div class="jh appeal">判责结果申诉 <span class="cd">${d.countdown}</span></div>
         <div class="jr"><span>判责时间</span><b>${d.judgeTime}</b></div>
         <div class="jr"><span>可申诉金额</span><b>${d.appealAmt}</b></div></div>`
    : `<div class="judge"><div class="jh">您需承担金额<span class="amt">${d.needPay}</span></div>
         <div class="jr"><span>判责时间</span><b>${d.judgeTime}</b></div>
         <div class="jr"><span>可申诉金额</span><b>${d.appealAmt}</b></div></div>`;
  return `<div class="ac">
    <div class="ah"><span class="ty">${d.ty}</span><span class="resp ${respClass(d.resp)}">${d.resp}</span></div>
    <div class="gr"><div class="img">${d.img}</div>
      <div class="gi"><div class="nm"><span>${d.nm}</span><span>${d.price}</span></div>
        <div class="sp"><span>${d.sp}</span><span>x${d.qty}</span></div></div></div>
    <div class="paid">共${d.qty}件商品　客户实付 <b>${d.paid}</b></div>
    ${judge}
    <div class="det"><span class="btn-d" data-det>查看详情</span></div></div>`;
}
function allCard(d){
  return `<div class="ac">
    <div class="allh"><span class="ty ${d.red?'red':''}">${d.ty}</span><span class="st">${d.st}</span></div>
    ${d.red?`<div class="meta" style="color:var(--red);font-weight:600;margin-bottom:8px">${RESP_KL}</div>`:''}
    <div class="meta">
      <div class="r"><span class="k">售后时间</span><span class="v">${d.afTime}</span></div>
      <div class="r"><span class="k">售后单号</span><span class="v">${d.no}</span></div>
      <div class="r"><span class="k">售后金额</span><span class="v red">${d.amt}</span></div></div>
    <hr>
    <div class="gr"><div class="img">${d.img}</div><div class="gi"><div class="nm"><span>　</span></div></div></div>
    <div class="det"><span class="btn-d" data-det>查看详情</span></div></div>`;
}

function renderList(container){
  container.innerHTML=`
    <div class="as-notice">出现质量问题的商品，会减少用户的购买，请注意及时改善商品质量。</div>
    <div class="as-dcards">
      <div class="as-dcard" id="q-card"><div class="h"><span class="t">商品质量等级</span>${svg('arrow')}</div>
        <div class="nums"><div class="n"><div class="v">0</div><div class="l">品级降低</div></div>
          <div class="n red"><div class="v">2</div><div class="l">DE级</div></div></div></div>
      <div class="as-dcard" id="hi-card"><div class="h"><span class="t">高投诉商品统计</span>${svg('arrow')}</div>
        <div class="nums"><div class="n"><div class="v">0</div><div class="l">高投预警</div></div>
          <div class="n"><div class="v">0</div><div class="l">高投商品</div></div></div></div>
    </div>
    <div class="as-filters"><span class="fl" id="f-city">全部城市 ${svg('arrow','style="transform:rotate(90deg)"')}</span>
      <span class="fl" id="f-date">履约日期 ${svg('arrow','style="transform:rotate(90deg)"')}</span>
      <span class="ft">支持按照履约日期筛选</span></div>
    <div class="as-yellow">本期支持商责/可申诉/申诉中/申诉完成按照城市和日期筛选，全部售后的筛选功能开发中~</div>
    <div class="as-tabs" id="tabs">${TABS.map((t,i)=>`<span class="tb ${i===0?'on':''}" data-k="${t[0]}">${t[1]}</span>`).join('')}</div>
    <div class="as-list" id="l"></div>`;

  const list=container.querySelector('#l');
  container.querySelector('#q-card').onclick=openQuality;
  container.querySelector('#hi-card').onclick=()=>toast('高投诉商品统计开发中');
  container.querySelector('#f-city').onclick=()=>sheet([{label:'全部城市',onClick:()=>toast('全部城市')},{label:'中区',onClick:()=>toast('中区')},{label:'东区',onClick:()=>toast('东区')},{label:'西区',onClick:()=>toast('西区')},{label:'北区',onClick:()=>toast('北区')}]);
  container.querySelector('#f-date').onclick=()=>toast('选择履约日期');

  const drawData=(k)=>{
    if(k==='all'){
      list.innerHTML=ALL.map(allCard).join('');
      list.querySelectorAll('[data-det]').forEach((b,i)=>b.onclick=()=>openDetail(DATA.merchant[0]));
      return;
    }
    const arr=DATA[k]||[];
    if(!arr.length){
      list.innerHTML=`<div class="empty"><div class="ei">${svg('shieldcheck')}</div><h4>暂无申诉中的售后</h4><p>发起申诉后，平台处理期间的售后单会出现在这里</p></div>`;
      return;
    }
    list.innerHTML=arr.map(judgeCard).join('');
    list.querySelectorAll('.ac').forEach((el,i)=>{
      el.querySelector('[data-det]').onclick=()=>openDetail(arr[i]);
    });
  };
  const draw=(k)=>{list.innerHTML=skel(3);setTimeout(()=>drawData(k),420);};

  container.querySelectorAll('#tabs .tb').forEach(t=>t.onclick=()=>{
    container.querySelectorAll('#tabs .tb').forEach(x=>x.classList.remove('on'));
    t.classList.add('on');draw(t.dataset.k);
  });
  draw('pending');
}

/* ========== B 判责详情 ========== */
function openDetail(d){
  const appealable=!!d.countdown;
  const head=appealable
    ? `<div class="row"><span class="big">可申诉</span><span class="resp">${d.resp}</span></div>
       <div class="sub">剩余申诉时间 <b>${d.countdown.replace('剩余','')}</b></div>`
    : `<div class="row"><span class="big">${d.done?'申诉完成':'已判责'}</span><span class="resp">${d.resp}</span></div>
       <div class="sub">您需承担金额 <b>${d.needPay||'S$0'}</b></div>`;
  const body=`
    <div class="as-dhead">${head}</div>
    <div class="as-dred">${appealable?'判责结果为合作商承担，若有异议请在剩余时间内发起申诉，逾期视为认责。':'本次售后已判责，如对结果有异议可发起申诉，逾期视为认可判责结果。'}</div>
    <div class="as-dblock">
      <div class="bt"><span>判责信息</span></div>
      <div class="as-row"><span class="k">判责时间</span><span class="v">${d.judgeTime}</span></div>
      <div class="as-row"><span class="k">可申诉金额</span><span class="v red">${d.appealAmt}</span></div>
      <div class="as-row" style="align-items:center"><span class="k">判责记录</span><span class="v" style="text-align:right"><span class="cp" data-rec style="border-color:var(--emerald)">查看 ›</span></span></div>
    </div>
    <div class="as-dblock">
      <div class="bt"><span>商品信息</span></div>
      <div class="as-gline"><div class="img">${d.img}</div>
        <div class="gi"><div class="nm"><span>${d.nm}</span><span class="red" style="color:var(--red)">${d.price}</span></div>
          <div class="sp"><span>${d.sp}</span><span>x${d.qty}</span></div></div></div>
      <div class="as-row"><span class="k">售后金额</span><span class="v red">${d.afAmt}</span><span class="k" style="width:64px;flex:0 0 64px">售后数量</span><span class="v" style="flex:0 0 auto">${d.afQty}</span></div>
      <div class="as-row"><span class="k">售后类型</span><span class="v">${d.ty}</span></div>
      <div class="as-row"><span class="k">售后原因</span><span class="v">${d.reason}</span></div>
      <div class="as-row"><span class="k">问题说明</span><span class="v" style="color:var(--sub)">—</span></div>
      <div class="as-row" style="align-items:flex-start"><span class="k">相关图片</span><span class="v"><div class="as-imgs">${[0,1,2,3].map(()=>`<div class="im">${svg('box')}</div>`).join('')}</div></span></div>
      <div class="as-row"><span class="k">售后时间</span><span class="v">${d.judgeTime}</span></div>
      <div class="as-row"><span class="k">售后单号</span><span class="v">${d.orderNo}<span class="cp" data-cp="${d.orderNo}">复制</span></span></div>
      <div class="as-row"><span class="k">订单编号</span><span class="v">${d.oid}<span class="cp" data-cp="${d.oid}">复制</span></span></div>
      <div class="as-row"><span class="k">下单日期</span><span class="v">${d.orderDate}</span></div>
      <div class="as-row"><span class="k">发货仓库</span><span class="v">${d.wh}</span></div>
    </div>
    <div style="height:6px"></div>`;
  const footer=appealable
    ? `<div class="as-foot"><button class="btn ghost" id="acc">认责</button><button class="btn primary" id="apl">去申诉</button></div>`
    : `<div class="as-foot"><button class="btn ghost" id="rec2" style="flex:1">查看判责记录</button></div>`;
  pushPage({title:'判责详情',navbar:false,body:`<div class="navbar" style="background:linear-gradient(135deg,#059669,#10B981)"><span class="back" style="background:rgba(255,255,255,.2)">${svg('back')}</span><span class="nt" style="color:#fff">判责详情</span></div>`+body,
    footer,
    mount:(p)=>{
      p.querySelector('.back').onclick=popPage;
      p.querySelector('[data-rec]').onclick=openRecord;
      const rec2=p.querySelector('#rec2');if(rec2)rec2.onclick=openRecord;
      p.querySelectorAll('[data-cp]').forEach(c=>c.onclick=()=>toast('已复制 '+c.dataset.cp));
      const acc=p.querySelector('#acc');
      if(acc)acc.onclick=()=>confirmDialog({title:'确认认责？',body:`认责后将由合作商承担本次售后金额 ${d.appealAmt}，该操作不可撤销，且无法再发起申诉。`,danger:1,okText:'确认认责',onOk:()=>{toast('已认责');setTimeout(popPage,600);}});
      const apl=p.querySelector('#apl');
      if(apl)apl.onclick=()=>openAppeal(d);
    }});
}

/* 去申诉表单 */
function openAppeal(d){
  pushPage({title:'发起申诉',body:`
    <div class="as-dblock" style="margin-top:13px"><div class="bt"><span>申诉商品</span></div>
      <div class="as-gline" style="border:none;padding:0;margin:0"><div class="img">${d.img}</div>
        <div class="gi"><div class="nm"><span>${d.nm}</span></div><div class="sp"><span>${d.sp}</span><span>可申诉金额 ${d.appealAmt}</span></div></div></div></div>
    <div class="as-dblock"><div class="bt"><span>申诉原因</span></div>
      <div id="rsn" style="display:flex;flex-wrap:wrap;gap:9px">
        ${['商品无质量问题','司机配送错货','疑似恶意客诉','其它原因'].map((r,i)=>`<span class="q-acts" style="padding:0"><span class="b rsn-o" data-r="${r}" style="${i===0?'background:var(--mint-soft);color:var(--emerald-2)':''}">${r}</span></span>`).join('')}
      </div></div>
    <div class="as-dblock"><div class="bt"><span>申诉描述</span></div>
      <textarea id="desc" placeholder="请填写申诉理由，说明商品规格、配送等情况" style="width:100%;min-height:90px;border:1.5px solid var(--line);border-radius:12px;padding:11px;font-size:14px;font-family:inherit;outline:none;resize:none"></textarea></div>
    <div class="as-dblock"><div class="bt"><span>申诉凭证</span></div>
      <div class="as-imgs"><div class="im" style="width:72px;height:72px;cursor:pointer">${svg('box')}</div></div>
      <div style="font-size:12px;color:var(--sub);margin-top:6px">上传商品货标、配送记录等凭证图片（最多 6 张）</div></div>
    <div style="height:6px"></div>`,
    footer:`<button class="btn primary" id="sub">提交申诉</button>`,
    mount:(p)=>{
      let reason='商品无质量问题';
      p.querySelectorAll('.rsn-o').forEach(o=>o.onclick=()=>{p.querySelectorAll('.rsn-o').forEach(x=>x.style.cssText='');o.style.cssText='background:var(--mint-soft);color:var(--emerald-2)';reason=o.dataset.r;});
      p.querySelector('#sub').onclick=()=>{
        const desc=p.querySelector('#desc').value.trim();
        if(!desc)return toast('请填写申诉描述');
        const b=p.querySelector('#sub');b.classList.add('loading');
        setTimeout(()=>{b.classList.remove('loading');toast('申诉已提交，平台将在 48 小时内处理');setTimeout(()=>{popPage();popPage();},700);},700);
      };
    }});
}

/* ========== C1 商品质量等级 ========== */
const QGOODS=[
  {img:'🥬',nm:'嫩豆腐 5斤',de:1,rate:'1.13%',rule:'超过 0.53% 定为 DE，低于 0.08% 定为 AB',warn:'限流预警',warnx:'暂不管控，今日给予警告，不影响流量'},
  {img:'🧈',nm:'盐卤老豆腐 5斤',de:1,rate:'0.82%',rule:'超过 0.51% 定为 DE，低于 0.08% 定为 AB',warn:'限流预警',warnx:'暂不管控，今日给予警告，不影响流量'},
];
function qCard(g){
  return `<div class="q-card"><div class="top"><div class="img">${g.img}</div>
    <div class="ci"><div class="nm">${g.nm} ${g.de?'<span class="tag-de">持续DE ⓘ</span>':''}</div>
      <div class="rate"><span class="grade">D</span>近7日客诉率 ${g.rate}</div>
      <div class="rule">${g.rule}</div></div>
    <span class="det" data-qdet>详情 ›</span></div>
    ${g.warn?`<div class="warn"><span class="wt">${g.warn}</span><div class="wx">${g.warnx}</div></div>`:''}</div>`;
}
function openQuality(){
  pushPage({title:'商品质量等级',body:`
    <div class="as-notice" style="margin-top:0;border-radius:0;padding:12px 16px">定级规则更新：定级时"非卖家责任"、"疑似恶意客户"的客诉将统一剔除，同时定级将以"同品类同品级近期平均客诉率"为参照物 <b style="color:var(--red)">展开</b></div>
    <div class="q-over">
      <div class="qt">数据概览</div>
      <div class="qg"><div class="qn"><div class="l">近7日售后金额</div><div class="v">S$157.84</div><div class="x">占销售额 ——%</div></div>
        <div class="qn"><div class="l">今日预计流失金额</div><div class="v">S$1,418.12</div></div></div>
      <hr>
      <div class="qg"><div class="qn"><div class="l">今日持续DE</div><div class="v">1</div></div>
        <div class="qn"><div class="l">今日极端高客诉</div><div class="v red">0</div></div></div>
      <hr>
      <div class="beat">你的 AB 级的商品质量，击败了 <b>91%</b> 的卖家</div>
    </div>
    <div class="q-deTab"><span class="t">今日DE级 (2)</span></div>
    <div class="q-acts"><span class="b" id="q-rev">可撤销限流</span><span class="b" id="q-add">加大限流</span></div>
    <div class="as-yellow">DE级商品，商城展示"近7天客诉较高"标签</div>
    <div id="ql" style="padding-bottom:18px"></div>`,
    mount:(p)=>{
      const ql=p.querySelector('#ql');
      ql.innerHTML=skel(2);
      setTimeout(()=>{
        ql.innerHTML=QGOODS.map(qCard).join('');
        ql.querySelectorAll('[data-qdet]').forEach((b,i)=>b.onclick=()=>toast('查看 '+QGOODS[i].nm+' 客诉详情'));
      },420);
      p.querySelector('#q-rev').onclick=()=>confirmDialog({title:'撤销限流？',body:'撤销后该商品恢复正常曝光，若客诉率持续偏高将再次被限流。',okText:'确认撤销',onOk:()=>toast('已提交撤销限流')});
      p.querySelector('#q-add').onclick=()=>toast('已切换至加大限流视图');
      setTimeout(showQualityIntro,260); // 进页弹定级介绍
    }});
}
function showQualityIntro(){
  const m=document.createElement('div');m.className='q-mask';
  m.innerHTML=`<div class="q-modal">
    <div class="mh">商品质量定级相关介绍</div>
    <div class="mc">
      <h5>命中DE限制上架新品规则（仅蔬菜水果类目）</h5>
      <p>T 日，城市 x 四级类目 x 品种 x 品级下，商家实际触发<span class="em">限流/限量管控商品数 ≥ 1</span>，该城市 x 四级类目 x 品种 x 品级下不允许上架新品，by 天刷新判断当日是否命中该规则。</p>
      <h5>长周期管控规则简介（仅蔬菜水果类目）</h5>
      <p>长周期管控是<span class="em">基于近30天质量定级记录</span>对商品质量的长周期判定，以更精准地区分商品好坏。</p>
      <table class="q-tbl"><thead><tr><th>今日质量等级</th><th>近30天等级</th><th>长周期管控规则</th></tr></thead>
        <tbody><tr><td>D或E<br>且近30天均有定级</td><td>DE次数 ≤ 1</td><td>自行领取撤销限流权益</td></tr>
        <tr><td></td><td>DE次数 ≥ 15</td><td>限流比例将进一步加大</td></tr></tbody></table>
      <h5>商品质量定级规则简介</h5>
      <p>质量定级是基于<span class="em">商品近期质量客诉率</span>对商品质量的评定，以<span class="em">同类商品近期平均客诉率</span>作为参照物，区分商品好坏。</p>
      <table class="q-tbl"><thead><tr><th>质量等级</th><th>商品近期客诉表现</th><th>商品数量占比</th></tr></thead>
        <tbody>
          <tr><td>A</td><td>明显优于平均客诉率</td><td>约 5%</td></tr>
          <tr><td>B</td><td>优于平均客诉率</td><td>约 15%</td></tr>
          <tr><td>C</td><td>持平平均客诉率</td><td>约 72%</td></tr>
          <tr><td>D</td><td>差于平均客诉率</td><td>约 6%</td></tr>
          <tr><td>E</td><td>明显差于平均客诉率</td><td>约 2%</td></tr>
        </tbody></table>
    </div>
    <div class="mf"><button class="btn primary" id="iok">我已知晓</button></div></div>`;
  document.querySelector('.phone').appendChild(m);
  m.querySelector('#iok').onclick=()=>m.remove();
  m.onclick=e=>{if(e.target===m)m.remove();};
}

/* ========== C2 判责记录 时间线 ========== */
const RECORDS=[
  {time:'2026-06-20 16:07:14',who:'系统',act:'判责',side:'平台',note:'判责依据：核实客诉工单信息，商品送错问题属实，驳回'},
  {time:'2026-06-19 13:38:38',who:'系统',act:'判责',side:'平台',note:'申诉通过'},
  {time:'2026-06-19 09:36:01',who:'鲜丰食材 Fresh Harvest',act:'申诉',appeal:1,
   desc:'是平台司机配送错货，商户下单的商品叫"小油豆腐 1kg/组（2袋）"，商品ID是 101375967。根据商户提供的照片信息，商户收到的货标上写着"精品油豆腐 袋（0.5kg/袋）"，商品ID是 101449486，这是两个不同的商品规格，是司机送货时拿错货给商户，和我们无关！',
   areason:'其它原因',evidence:1},
  {time:'2026-06-17 14:15:57',who:'系统',act:'判责',side:'合作商',note:'经平台判定，责任方为合作商'},
];
function openRecord(){
  pushPage({title:'判责记录',body:`<div class="tl" id="tl">${skel(2)}</div>`,
    mount:(p)=>{
      const tl=p.querySelector('#tl');
      setTimeout(()=>{
        tl.innerHTML=RECORDS.map(r=>`<div class="it">
          <div class="time">${r.time}</div>
          <div class="box"><div class="bh"><span class="who">${r.who}</span><span class="act ${r.appeal?'appeal':''}">${r.act}</span></div>
            ${r.appeal
              ? `<div class="ln"><span class="k">申诉描述</span><span class="v">${r.desc}</span></div>
                 <div class="ln"><span class="k">申诉原因</span><span class="v">${r.areason}</span></div>
                 ${r.evidence?`<div class="ln"><span class="k">申诉凭证</span><span class="v"><div class="evs">${[0,1,2].map(()=>`<div class="ev">${svg('box')}</div>`).join('')}</div></span></div>`:''}`
              : `<div class="ln"><span class="k">判责责任方</span><span class="v">${r.side}</span></div>
                 <div class="ln"><span class="k">判责说明</span><span class="v">${r.note}</span></div>`}
          </div></div>`).join('');
      },420);
    }});
}

/* ========== 黑名单（右上入口，占位页） ========== */
function openBlacklist(){
  pushPage({title:'黑名单',body:`<div class="empty"><div class="ei">${svg('user')}</div><h4>暂无黑名单客户</h4><p>对存在恶意客诉的客户，可在售后处理中加入黑名单</p></div>`});
}

/* ========== 入口 ========== */
function openAfter(){
  pushPage({title:'售后管理',right:'黑名单',body:'<div id="as-root"></div>',
    mount:(p)=>{renderList(p.querySelector('#as-root'));const nr=p.querySelector('#nr');if(nr)nr.onclick=openBlacklist;}});
}

window.FM_MOD=window.FM_MOD||{};
window.FM_MOD.after=openAfter;
})();
