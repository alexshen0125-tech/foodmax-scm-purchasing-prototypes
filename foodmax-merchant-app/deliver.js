/* Food Max 商家端 v2 · 送货退货组（送货签到 / 装筐送货 / 交货进度 / 退货取回）
   还原快驴卖家App 9 张参考截图；SG 仓(裕廊/兀兰/盛港/大巴窑/淡滨尼/义顺 DC) + S$
   评审修复内建：列表先 skel→数据 / 装筐空态用 .empty / 破坏性(不需要提货·放弃所有权)用 confirmDialog / 可点元素≥44px */
(function(){
const {pushPage,popPage,toast,confirmDialog,sheet,svg,skel,cdSpan,arriveDueMs}=window.FM;

const css=document.createElement('style');
css.textContent=`
.dl-bar{display:flex;align-items:center;justify-content:space-between;padding:12px 16px 8px;}
.dl-bar .dt{font-size:20px;font-weight:700;}
.dl-bar .rec{font-size:13.5px;color:var(--emerald);font-weight:700;min-height:44px;display:flex;align-items:center;gap:2px;}
.dl-banner{margin:0 16px 4px;background:var(--red-soft);color:var(--red);font-size:12.5px;line-height:1.55;padding:11px 14px;border-radius:12px;display:flex;gap:10px;align-items:flex-start;}
.dl-banner .x{flex:0 0 auto;color:var(--sub);font-size:16px;min-width:24px;min-height:24px;text-align:right;cursor:pointer;}
.dl-banner .hp{flex:0 0 auto;color:var(--sub);}
.dl-priv{display:flex;align-items:center;justify-content:space-between;margin:8px 16px 4px;background:#fff;border-radius:12px;padding:0 14px;min-height:48px;box-shadow:var(--sh-sm);font-size:13.5px;color:#27433A;}
.dl-priv .ed{color:var(--emerald);font-weight:700;min-height:44px;display:flex;align-items:center;}
.dl-list{padding:10px 16px 16px;}
.dl-card{background:#fff;border-radius:18px;padding:15px;margin-bottom:13px;box-shadow:var(--sh-sm);}
.dl-ch{display:flex;align-items:center;gap:8px;font-size:13px;color:var(--sub);}
.dl-ch .no{font-weight:700;color:#27433A;letter-spacing:.01em;}
.dl-ch .st{margin-left:auto;font-size:13.5px;font-weight:700;display:flex;align-items:center;gap:3px;}
.dl-ch .st.ok{color:var(--emerald);}.dl-ch .st.wait{color:var(--red);}
.dl-tagline{display:flex;align-items:center;gap:9px;margin-top:11px;}
.dl-tag{flex:0 0 auto;font-size:11px;font-weight:700;padding:3px 8px;border-radius:7px;background:var(--mint-soft);color:var(--emerald-2);}
.dl-tagline .v{font-size:15px;font-weight:700;}
.dl-sign{display:flex;align-items:center;gap:6px;margin-top:11px;font-size:12.5px;color:#46604F;flex-wrap:wrap;}
.dl-sign .lb{color:var(--sub);}.dl-sign b{color:var(--emerald);font-weight:700;}
.dl-sign .more{margin-left:auto;color:var(--sub);min-height:30px;display:flex;align-items:center;}
.dl-meta{display:flex;margin-top:10px;font-size:12.5px;line-height:1.5;}
.dl-meta .k{flex:0 0 64px;color:var(--sub);}.dl-meta .vv{flex:1;color:#27433A;}
.dl-kbox{display:flex;background:var(--muted);border-radius:14px;margin-top:13px;padding:14px 0;}
.dl-kbox .k{flex:1;text-align:center;}
.dl-kbox .k+.k{border-left:1px solid var(--line);}
.dl-kbox .k .v{font-size:21px;font-weight:600;font-family:'Lora',serif;}
.dl-kbox .k .l{font-size:11.5px;color:var(--sub);margin-top:2px;}
.dl-acts{display:flex;gap:8px;margin-top:13px;}
.dl-acts .a{flex:1;min-height:44px;display:flex;align-items:center;justify-content:center;border-radius:11px;font-size:13px;font-weight:600;cursor:pointer;background:var(--muted);color:#27433A;padding:0 4px;}
.dl-acts .a.key{background:var(--emerald);color:#fff;box-shadow:0 6px 16px rgba(5,150,105,.28);}
/* 记录行 */
.dl-rec{background:#fff;border-radius:16px;padding:14px 15px;margin-bottom:12px;box-shadow:var(--sh-sm);}
.dl-rec .r1{display:flex;align-items:center;gap:7px;font-size:12.5px;color:var(--sub);}
.dl-rec .r1 .no{font-weight:700;color:#27433A;}
.dl-rec .r1 .st{font-weight:700;}.dl-rec .r1 .st.ok{color:var(--emerald);}.dl-rec .r1 .st.wait{color:var(--red);}
.dl-rec .r2{display:flex;align-items:center;justify-content:space-between;margin-top:9px;}
.dl-rec .r2 .ware{font-size:16px;font-weight:700;}.dl-rec .r2 .w{font-size:13px;color:#46604F;}
.dl-rec .r3{display:flex;align-items:center;justify-content:space-between;margin-top:10px;font-size:12.5px;color:#46604F;}
.dl-rec .r3 .d{color:var(--emerald);font-weight:700;min-height:30px;display:flex;align-items:center;}
.dl-rec .r3 .seg{color:var(--sub);}
/* 筛选下拉条 */
.dl-filters{display:flex;gap:18px;padding:12px 16px;overflow-x:auto;}.dl-filters::-webkit-scrollbar{display:none;}
.dl-drop{flex:0 0 auto;font-size:14px;color:#27433A;font-weight:600;min-height:44px;display:flex;align-items:center;gap:4px;cursor:pointer;}
.dl-drop .ca{font-size:10px;color:var(--sub);}
/* Tab 条 */
.dl-tabs{display:flex;gap:26px;padding:6px 16px 0;border-bottom:1px solid var(--line);}
.dl-tabs .t{font-size:15px;color:var(--sub);font-weight:600;padding:10px 0 12px;position:relative;cursor:pointer;min-height:44px;}
.dl-tabs .t.on{color:var(--emerald);font-weight:700;}
.dl-tabs .t.on::after{content:"";position:absolute;left:50%;bottom:-1px;transform:translateX(-50%);width:26px;height:3px;border-radius:3px;background:var(--emerald);}
/* 详情 / 二维码 */
.dl-head{background:var(--mint-soft);margin:0 0 2px;padding:14px 16px 16px;}
.dl-head .no{font-size:12.5px;color:var(--emerald-2);}
.dl-head .ware{font-size:20px;font-weight:800;margin:8px 0 10px;}
.dl-head .ln{display:flex;align-items:center;gap:9px;margin-top:8px;font-size:13px;color:#27433A;}
.dl-head .ln .k{flex:0 0 60px;color:var(--emerald-2);}
.dl-qrcard{background:#fff;border-radius:16px;margin:14px 16px;padding:18px;box-shadow:var(--sh-sm);text-align:center;}
.dl-qrcard .qt{font-size:16px;font-weight:700;margin-bottom:12px;}
.dl-qr{width:188px;height:188px;margin:0 auto;display:grid;grid-template-columns:repeat(25,1fr);grid-template-rows:repeat(25,1fr);}
.dl-qr i{display:block;}.dl-qr i.b{background:var(--ink);}
.dl-tbl{margin:12px 16px;}
.dl-tbl .th,.dl-tbl .tr{display:flex;align-items:flex-start;padding:11px 4px;font-size:13px;}
.dl-tbl .th{color:var(--sub);font-size:12px;border-bottom:1px solid var(--line);}
.dl-tbl .tr{border-bottom:1px solid var(--line);}
.dl-tbl .c1{flex:1;color:#27433A;}.dl-tbl .c1 .sp{font-size:11px;color:var(--sub);margin-top:2px;}
.dl-tbl .c2,.dl-tbl .c3{flex:0 0 56px;text-align:right;font-weight:600;}
/* 交货进度卡 */
.dl-glabel{font-size:15px;font-weight:700;padding:10px 16px 4px;}
.dl-pcard{background:#fff;border-radius:18px;margin:8px 16px 13px;padding:16px;box-shadow:var(--sh-sm);}
.dl-pcard .dept{display:flex;align-items:baseline;justify-content:space-between;margin-bottom:6px;}
.dl-pcard .dept .nm{font-size:18px;font-weight:800;}.dl-pcard .dept .tot{font-size:14px;color:#27433A;font-weight:700;}
.dl-pw{padding:13px 0;border-top:1px solid var(--line);}
.dl-pw .wn{font-size:16px;font-weight:700;display:flex;align-items:baseline;justify-content:space-between;gap:8px;}
.dl-pw .wn .tm{font-size:12px;color:var(--sub);font-weight:500;flex:0 0 auto;}
.dl-pw .mx{display:flex;margin-top:11px;}
.dl-pw .mx .m{flex:1;}
.dl-pw .mx .m .v{font-size:19px;font-weight:600;font-family:'Lora',serif;}
.dl-pw .mx .m .v.wait{color:var(--emerald);}
.dl-pw .mx .m .l{font-size:11.5px;color:var(--sub);margin-top:1px;}
.dl-pw .sub2{display:flex;align-items:center;gap:12px;margin-top:9px;font-size:11.5px;}
.dl-pw .sub2 .bt{color:#B45309;}.dl-pw .sub2 .ud{color:var(--red);font-weight:700;}
.dl-pw .pacts{display:flex;gap:9px;margin-top:12px;}
.dl-pw .pacts .b{flex:1;min-height:42px;display:flex;align-items:center;justify-content:center;border-radius:11px;font-size:13px;font-weight:600;background:var(--muted);color:#27433A;cursor:pointer;}
/* 退货单 */
.dl-rcard{background:#fff;border-radius:16px;padding:15px;margin-bottom:12px;box-shadow:var(--sh-sm);}
.dl-rcard .r1{display:flex;align-items:center;gap:8px;font-size:12.5px;color:var(--sub);flex-wrap:wrap;}
.dl-rcard .r1 .no{font-weight:700;color:#27433A;}
.dl-rcard .r1 .lbl{font-size:10.5px;border:1px solid var(--line);color:#46604F;padding:1px 6px;border-radius:5px;}
.dl-rcard .r1 .st{margin-left:auto;color:var(--emerald);font-weight:700;min-height:30px;display:flex;align-items:center;}
.dl-rcard .r2{display:flex;align-items:center;justify-content:space-between;margin-top:10px;}
.dl-rcard .r2 .ware{font-size:16px;font-weight:700;display:flex;align-items:center;gap:7px;}
.dl-rcard .r2 .ware .dot{width:7px;height:7px;border-radius:50%;background:var(--red);}
.dl-rcard .r2 .cnt{font-size:14px;font-weight:700;}
.dl-rcard .info{margin-top:9px;font-size:12.5px;color:var(--sub);line-height:1.7;}
.dl-rcard .info .code{color:var(--emerald);font-weight:700;}
.dl-rcard .info .dl-deadline{color:var(--red);}
.dl-rcard .rb{display:flex;justify-content:flex-end;margin-top:11px;}
.dl-rcard .rb .b{min-height:40px;display:flex;align-items:center;padding:0 18px;border-radius:11px;font-size:13.5px;font-weight:700;border:1px solid var(--emerald);color:var(--emerald);cursor:pointer;}
/* 弹层(底部抽屉式表单) */
.dl-sheet-mask{position:absolute;inset:0;z-index:120;background:rgba(15,23,42,.42);display:flex;align-items:flex-end;animation:fade .2s;}
.dl-sheet{width:100%;background:#fff;border-radius:22px 22px 0 0;animation:rise .25s;display:flex;flex-direction:column;max-height:88%;}
.dl-sheet .sh{display:flex;align-items:center;justify-content:center;position:relative;padding:18px 16px 12px;font-size:17px;font-weight:700;}
.dl-sheet .sh .x{position:absolute;right:16px;top:14px;font-size:20px;color:var(--sub);min-width:44px;min-height:44px;display:flex;align-items:center;justify-content:flex-end;cursor:pointer;}
.dl-sheet .sbody{padding:0 18px 8px;overflow-y:auto;}
.dl-sheet .tip{background:var(--muted);color:#46604F;font-size:12.5px;padding:9px 12px;border-radius:10px;display:flex;gap:7px;align-items:flex-start;}
.dl-sheet .qh{font-size:15px;font-weight:700;margin:18px 0 12px;}
.dl-radios{display:flex;gap:30px;}
.dl-radio{display:flex;align-items:center;gap:8px;font-size:15px;cursor:pointer;min-height:44px;}
.dl-radio .rc{width:22px;height:22px;border-radius:50%;border:2px solid #CBD5C7;flex:0 0 22px;display:flex;align-items:center;justify-content:center;}
.dl-radio.on .rc{border-color:var(--emerald);background:var(--emerald);}
.dl-radio.on .rc::after{content:"✓";color:#fff;font-size:12px;font-weight:700;}
.dl-radio.danger.on .rc{border-color:var(--red);background:var(--red);}
.dl-field{background:var(--muted);border-radius:12px;min-height:50px;display:flex;align-items:center;justify-content:space-between;padding:0 14px;font-size:14px;color:var(--sub);margin-top:10px;cursor:pointer;}
.dl-field.has{color:var(--ink);font-weight:600;}
.dl-warn{color:var(--red);font-size:12.5px;margin:12px 0 8px;line-height:1.5;}
.dl-reason{display:flex;flex-direction:column;}
.dl-reason .dl-radio{border-bottom:1px solid var(--line);justify-content:space-between;flex-direction:row-reverse;}
.dl-sheet .sfoot{padding:12px 16px 18px;border-top:1px solid var(--line);}
/* 新建退货单 */
.dl-sec{font-size:15px;font-weight:700;margin:16px 16px 8px;}
.dl-form{background:#fff;border-radius:16px;margin:0 16px;box-shadow:var(--sh-sm);overflow:hidden;}
.dl-frow{display:flex;align-items:center;justify-content:space-between;padding:0 15px;min-height:52px;font-size:14.5px;}
.dl-frow+.dl-frow{border-top:1px solid var(--line);}
.dl-frow .lb{font-weight:600;}.dl-frow .lb .req{color:var(--red);margin-right:2px;}
.dl-frow .sel{color:var(--sub);display:flex;align-items:center;gap:4px;min-height:44px;cursor:pointer;}
.dl-frow .sel.has{color:var(--ink);font-weight:600;}
.dl-add{background:#fff;border-radius:16px;margin:0 16px;box-shadow:var(--sh-sm);min-height:62px;display:flex;align-items:center;justify-content:center;gap:7px;color:var(--emerald);font-size:15px;font-weight:700;cursor:pointer;}
.dl-item{background:#fff;border-radius:14px;margin:10px 16px 0;padding:13px 15px;box-shadow:var(--sh-sm);display:flex;align-items:center;gap:12px;}
.dl-item .ig{font-size:26px;width:48px;height:48px;border-radius:12px;background:var(--mint-soft);display:flex;align-items:center;justify-content:center;}
.dl-item .it{flex:1;}.dl-item .it .nm{font-size:14.5px;font-weight:700;}.dl-item .it .sp{font-size:12px;color:var(--sub);margin-top:2px;}
.dl-item .del{color:var(--red);font-size:13px;min-height:44px;display:flex;align-items:center;cursor:pointer;}
.dl-foot2{display:flex;align-items:center;gap:12px;}
.dl-foot2 .sum{font-size:13.5px;color:#27433A;}.dl-foot2 .sum b{font-family:'Lora',serif;font-size:17px;color:var(--emerald-2);}
.dl-foot2 .btn{flex:0 0 auto;width:auto;padding:0 28px;}
/* 二维码弹窗 */
.dl-qrmask{position:absolute;inset:0;z-index:130;background:rgba(15,23,42,.5);display:flex;align-items:center;justify-content:center;padding:34px;animation:fade .2s;}
.dl-qrpop{background:#fff;border-radius:18px;width:100%;max-width:300px;overflow:hidden;animation:rise .25s;}
.dl-qrpop .ph{display:flex;align-items:center;justify-content:space-between;padding:16px 18px 10px;}
.dl-qrpop .ph .t{font-size:15px;font-weight:700;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.dl-qrpop .ph .x{font-size:20px;color:var(--sub);min-width:44px;min-height:44px;display:flex;align-items:center;justify-content:flex-end;cursor:pointer;}
.dl-qrpop .qrwrap{padding:0 22px 8px;}
.dl-qrpop .cap{text-align:center;color:var(--emerald);font-weight:700;font-size:15px;padding:14px;min-height:44px;}
`;
document.head.appendChild(css);

const ADDR={'裕廊DC':'1 Jurong West Ave 1, #01-23 裕廊配送中心三号库','兀兰DC':'30 Woodlands Loop, #01-08 兀兰配送中心','盛港DC':'33 Sengkang West Ave, #01-15 盛港提揽点','大巴窑DC':'5 Toa Payoh Ind Park, #01-02 大巴窑配送中心','淡滨尼DC':'10 Tampines St 92, #01-19 淡滨尼配送中心','义顺DC':'8 Yishun Ind St 1, #01-11 义顺配送中心'};
// 各 DC 收货人 / 入门位置（送货单详情·交货地点信息）
const RECV={'裕廊DC':{d:'王志明 8123****7813',n:'林国强 9012****0250',g:'裕廊西门进，2号库3号闸口，只收不卸'},'兀兰DC':{d:'黄俊 8765****1122',n:'李文 9033****3344',g:'兀兰北门进，8号库1楼9–11号门'},'盛港DC':{d:'吴成 8201****5566',n:'/ 9111****1111',g:'东门进，1号平台，只收不卸'},'大巴窑DC':{d:'许尚 8678****7788',n:'史金超 9158****0250',g:'中门进，只收不卸'},'淡滨尼DC':{d:'周强 8299****9900',n:'郑凯 9088****2233',g:'A门进，3号卸货区'},'义顺DC':{d:'马良 8322****4455',n:'孙浩 9077****6677',g:'西门进，2号库'}};
function dvWave(d){const h=parseInt((d.window||'0'),10);return h<12?'上午达':'下午达';}                 // 履约波次(由送达时段派生)
// 商品明细按SKU聚合(件)；demoLines 带 recvQty=仓库收货清点(出库前)回写的实收数量。差异只有「数量少送」一种，无原因分类
function dvSku(d){
  if(d.demoLines)return d.demoLines.map(l=>({name:l.name,unit:l.unit,code:l.code,qty:l.qty,
    inQty:(l.recvQty!=null?l.recvQty:(d.status==='交接完成'?l.qty:0))}));
  const m={};(d.labels||[]).forEach(l=>{const k=l.name;if(!m[k])m[k]={name:k,unit:l.unit,code:l.code,qty:0,inQty:0};m[k].qty+=l.qty;if(l.arrived)m[k].inQty+=l.qty;});return Object.values(m);}
// 少货：实收(清点) < 应送。判责结论不对商家展示，只展示应送/实收与差异
function dvShort(d){return d.status==='交接完成'&&dvSku(d).some(r=>r.inQty<r.qty);}
function dvShortQty(d){return dvSku(d).reduce((a,r)=>a+Math.max(0,r.qty-r.inQty),0);}
// 平台补采：少货缺口由平台自营现货补货的数量（来自补货单）。未补货默认 0
function dvRepl(d){return window.FM_REPL_BY_DELIVERY?window.FM_REPL_BY_DELIVERY(d.id):[];}
function dvReplQty(d){return dvRepl(d).reduce((a,r)=>a+(+r.qty||0),0);}
function dvFine(d){return window.FM_FINE_BY_DELIVERY?window.FM_FINE_BY_DELIVERY(d.id):null;}
function dvFineAmt(d){const f=dvFine(d);return f?+(f.items.reduce((a,x)=>a+x.qty,0)*f.rate).toFixed(2):0;}
function dvReplName(d,name){return dvRepl(d).filter(r=>r.name===name).reduce((a,r)=>a+(+r.qty||0),0);}

// 伪二维码(25x25 确定性图案)
function qrGrid(seed){let s=(seed||7)+1;const rnd=()=>{s=(s*9301+49297)%233280;return s/233280;};
  const N=25,fin=(r,c)=>{const dr=Math.min(r,N-1-r),dc=Math.min(c,N-1-c);if(r>=N-7&&c<=6)return -1;return -1;};
  let h='';for(let r=0;r<N;r++)for(let c=0;c<N;c++){
    let on;const inFinder=(R,C)=>r>=R&&r<R+7&&c>=C&&c<C+7;
    if(inFinder(0,0)||inFinder(0,N-7)||inFinder(N-7,0)){
      const lr=(inFinder(0,0)?r:inFinder(0,N-7)?r:r-(N-7)),lc=(inFinder(0,0)?c:inFinder(0,N-7)?c-(N-7):c);
      on=(lr===0||lr===6||lc===0||lc===6||(lr>=2&&lr<=4&&lc>=2&&lc<=4));
    }else{on=rnd()>0.52;}
    h+=`<i class="${on?'b':''}"></i>`;}
  return h;}
function qrPopup(title){
  const m=document.createElement('div');m.className='dl-qrmask';
  m.innerHTML=`<div class="dl-qrpop"><div class="ph"><span class="t">${title}</span><span class="x">✕</span></div>
    <div class="qrwrap"><div class="dl-qr">${qrGrid(title.length)}</div></div>
    <div class="cap">向仓库管理人员出示二维码</div></div>`;
  document.querySelector('.phone').appendChild(m);
  m.querySelector('.x').onclick=()=>m.remove();m.onclick=e=>{if(e.target===m)m.remove();};
}

/* ============ 送货签到（数据源=FM.DB.deliveries；交接归仓库WMS，商家不可点）============ */
function dvStName(d){return {'待送货':'待送货','已预约':'已预约','已签到':'已签到','交接完成':'已入库'}[d.status]||d.status;}
function dvArrived(d){return (d.labels||[]).filter(l=>l.arrived).length;}
const DL_SLOTS=['23:00–02:00','02:00–05:00','06:00–10:00','11:00–14:00','16:00–20:00'];   // 预约送货可选时段
function stChip(t,bg,c){return `<span style="font-size:11px;font-weight:700;padding:2px 9px;border-radius:20px;background:${bg};color:${c}">${t}</span>`;}
// 送货单：预约(booked) 与 签到(signed) 相互独立
function signinCard(d){
  if(d.booked===undefined)d.booked=false;if(d.signed===undefined)d.signed=(d.status==='已签到'||d.status==='交接完成');
  const done=d.status==='交接完成';
  const bkChip=d.booked?stChip('已预约','var(--amber-soft)','var(--amber)'):stChip('未预约','var(--muted)','var(--sub)');
  const sgChip=done?stChip('已入库','var(--mint-soft)','var(--emerald-2)'):(d.signed?stChip('已签到','#E1EBFF','#2563EB'):stChip('未签到','var(--muted)','var(--sub)'));
  return `<div class="dl-card">
    <div class="dl-ch"><span>送货单</span><span class="no">${d.id}</span></div>
    <div style="display:flex;align-items:center;gap:8px;margin:9px 0 3px">${bkChip}${sgChip}${d.booked?`<span style="font-size:11.5px;color:var(--sub)">${d.bookWindow||d.window}</span>`:''}</div>
    <div class="dl-meta"><span class="k">备货单</span><span class="vv" style="font-family:monospace">${d.pickId}</span></div>
    <div class="dl-meta"><span class="k">入库仓库</span><span class="vv">${d.warehouse} · ${d.orderIds.length}单</span></div>
    ${d.signed&&!done?`<div class="dl-meta"><span class="k"></span><span class="vv" style="color:var(--sub)">待仓库扫码交接</span></div>`:''}
    <div class="dl-kbox"><div class="k"><div class="l">应送货(件)</div><div class="v">${dvSku(d).reduce((s,r)=>s+r.qty,0)}</div></div><div class="k"><div class="l">${done?'实收(件)':'已入库(件)'}</div><div class="v" ${dvShort(d)?'style="color:var(--red)"':''}>${dvSku(d).reduce((s,r)=>s+r.inQty,0)}</div></div><div class="k"><div class="l">平台补采(件)</div><div class="v" ${dvReplQty(d)>0?'style="color:var(--amber)"':''}>${dvReplQty(d)}</div></div></div>
    ${whrOf(d.id).length?`<div style="display:flex;align-items:center;gap:8px;margin-top:11px;flex-wrap:wrap">${whrOf(d.id).some(r=>r.type==='送错')?stChip('有错货','var(--red-soft)','var(--red)'):''}${whrOf(d.id).some(r=>r.type==='送多')?stChip('有多货','var(--amber-soft)','#B45309'):''}</div>`:''}
    ${done?`<div style="display:flex;align-items:center;gap:8px;margin-top:11px">${dvShort(d)
      ?stChip('收货清点 · 少货 '+dvShortQty(d)+' 件','var(--red-soft)','var(--red)')+(dvReplQty(d)>0?stChip('平台补采 '+dvReplQty(d)+' 件','var(--amber-soft)','#B45309'):'')
      :stChip('收货清点 · 足额收货','var(--mint-soft)','var(--emerald-2)')}</div>`:''}
    ${d.printed?`<div style="display:flex;align-items:center;gap:6px;margin-top:10px;font-size:11.5px;color:var(--emerald-2);font-weight:600">🖨️ 已打印 ${d.printedAt||''}</div>`:''}
    <div class="dl-acts">${done
      ?`<div class="a" data-a="detail">查看详情</div>`
      :`${dvCutoff(d).passed
          ?`<div class="a key" data-a="print">${d.printed?'重新打印':'打印'}</div>`
          :`<div class="a" data-a="print-off" style="opacity:.42">打印</div>`
        }${d.signed?'':`<div class="a" data-a="${d.booked?'bookmenu':'book'}">${d.booked?'改约/取消':'预约送货'}</div><div class="a" data-a="sign">签到码</div>`}<div class="a" data-a="detail">详情</div>`}</div>
  </div>`;
}
/* ============================================================
   送货单打印（截单后可打印，打印纸含签到二维码）—— 与 PC pc-modules/delivery.js 同源同口径
   截单口径：送货单内容在【营业截单】后才固定，截单前客户仍可下单/改单，故截单前禁用打印。
   截单时刻 = 送达日【前一日】的营业截止时间（即当日截单时间）。
   营业时间由商家在【PC 端 › 店铺管理 › 营业管理】维护（PC DB.bizCfg）；App 端只读，此处内置同值副本。
============================================================ */
const BIZ_WEEK={'周一':'15:00','周二':'15:00','周三':'15:00','周四':'15:00','周五':'15:00','周六':'12:00','周日':''};
const PLATFORM_CUTOFF='18:00';
const WD=['周日','周一','周二','周三','周四','周五','周六'];
function prevBizDay(mmdd){
  if(!mmdd)return null;
  const m=String(mmdd).match(/(\d{1,2})-(\d{1,2})/); if(!m)return null;
  const dt=new Date(2026,+m[1]-1,+m[2]); dt.setDate(dt.getDate()-1);
  const pad=n=>String(n).padStart(2,'0');
  return {date:pad(dt.getMonth()+1)+'-'+pad(dt.getDate()), wd:WD[dt.getDay()], js:dt};
}
function dvCutoff(d){
  const prev=prevBizDay(d.deliver);
  let end=PLATFORM_CUTOFF, wd='';
  if(prev){wd=prev.wd; const e=BIZ_WEEK[wd]; if(e)end=e;}
  const at=prev?`${prev.date} ${end}`:'—';
  if(window.FM.DB.delivDemoPreCutoff)return {at,wd,end,passed:false};
  let passed=true;
  if(prev){const [hh,mm]=end.split(':').map(Number);const c=new Date(prev.js);c.setHours(hh||0,mm||0,0,0);passed=Date.now()>=c.getTime();}
  return {at,wd,end,passed};
}
// 打印纸商品明细：复用既有 dvSku(d)（已覆盖 demoLines 与 labels 两种来源）。
// ⚠️ 不要单独从 d.labels 聚合：部分单的 labels 只是标签张数占位，无商品名/数量。
function dvPrint(d){
  const cf=dvCutoff(d);
  if(!cf.passed){toast(`未到营业截单时间（${cf.at}），送货单内容可能还会变动，暂不可打印`);return;}
  const items=dvSku(d), totalQty=items.reduce((a,x)=>a+(+x.qty||0),0), tags=(d.labels||[]).length;
  // dvSku 的 code 是【标签码】(LBL-<订单后5位>-<SKU后4位>)，打印纸要的是 SKU 编码，与 PC 保持一致
  const skuOf=x=>{const m=String(x.code||'').match(/(\d{4})$/);return m?('SKU'+m[1]):(x.code||'—');};
  const now=new Date(),pad=n=>String(n).padStart(2,'0');
  const printedAt=`${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
  const row=(k,v)=>`<div style="display:flex;padding:6px 0;border-bottom:1px solid #EEE;font-size:12.5px"><span style="width:82px;color:#666;flex:0 0 82px">${k}</span><span style="font-weight:600;color:#111">${v}</span></div>`;
  pushPage({title:'打印送货单',body:`
    <div style="padding:14px 16px 20px">
      <div style="background:#fff;border-radius:10px;padding:20px 18px;box-shadow:var(--sh-sm);color:#111">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #111;padding-bottom:12px;margin-bottom:14px">
          <div style="min-width:0">
            <div style="font-size:17px;font-weight:800">Food Max 送货单</div>
            <div style="font-size:10px;color:#666;letter-spacing:1px;margin-top:2px">DELIVERY NOTE</div>
            <div style="font-size:14px;font-weight:700;margin-top:8px;font-family:monospace;word-break:break-all">${d.id}</div>
          </div>
          <div style="text-align:center;flex:0 0 auto;margin-left:10px">
            <div class="dl-qr" style="width:96px;height:96px">${qrGrid((d.id||'').length+3)}</div>
            <div style="font-size:10px;font-weight:700;margin-top:5px">送货签到码</div>
          </div>
        </div>
        ${row('商家','鲜丰食材 Fresh Harvest')}
        ${row('入库仓库',d.warehouse)}
        ${row('营业截单',`${cf.at}${cf.wd?`（${cf.wd}）`:''} · 已截单`)}
        ${row('应送 / 订单',`${tags} 张标签 · ${d.orderIds.length} 个订单`)}
        <div style="font-size:12.5px;font-weight:700;margin:16px 0 6px">商品明细</div>
        <table style="width:100%;font-size:11.5px;border-collapse:collapse">
          <thead><tr style="background:#F3F4F6">
            <th style="text-align:left;padding:5px 6px;border:1px solid #ddd">SKU 编码</th>
            <th style="text-align:left;padding:5px 6px;border:1px solid #ddd">商品名称</th>
            <th style="text-align:right;padding:5px 6px;border:1px solid #ddd;width:76px">送货数量</th>
          </tr></thead>
          <tbody>${items.length?items.map(x=>`<tr>
            <td style="padding:5px 6px;border:1px solid #ddd;font-family:monospace">${skuOf(x)}</td>
            <td style="padding:5px 6px;border:1px solid #ddd">${x.name||'—'}</td>
            <td style="padding:5px 6px;border:1px solid #ddd;text-align:right"><b>${x.qty}</b> ${x.unit||'件'}</td>
          </tr>`).join(''):`<tr><td colspan="3" style="padding:12px;border:1px solid #ddd;text-align:center;color:#888">暂无商品明细</td></tr>`}
          <tr style="background:#FAFAFA;font-weight:700"><td colspan="2" style="padding:5px 6px;border:1px solid #ddd">合计</td><td style="padding:5px 6px;border:1px solid #ddd;text-align:right">${totalQty}</td></tr>
          </tbody>
        </table>
        <div style="display:flex;gap:14px;margin-top:20px;font-size:11px;color:#333">
          <div style="flex:1;border-top:1px solid #999;padding-top:5px">送货人签字</div>
          <div style="flex:1;border-top:1px solid #999;padding-top:5px">仓库收货签字</div>
        </div>
        <div style="margin-top:12px;font-size:10px;color:#888;border-top:1px dashed #ccc;padding-top:7px">打印时间 ${printedAt}　|　到仓出示本单由仓库扫码签到</div>
      </div>
    </div>`,
    footer:`<button class="btn primary" style="width:100%" id="dl-doprint">🖨️ 打印</button>`,
    mount:(pg)=>{pg.querySelector('#dl-doprint').onclick=()=>{
      d.printed=true; d.printedAt=printedAt.slice(5);
      toast('送货单已打印（含签到二维码）'); popPage(); rerenderSignin();};}
  });
}
function dvBookSheet(d){sheet(DL_SLOTS.map(s=>({label:`预约 ${s}${(d.bookWindow||d.window)===s?'　✓':''}`,onClick:()=>{d.booked=true;d.bookWindow=s;toast('已预约送货 '+s);rerenderSignin();}})));}
// 签到码：商家出示，由【仓库人员扫码确认】，商家端不做签到确认操作（演示用"模拟仓库扫码"）
function dvSignQR(d){const m=document.createElement('div');m.className='modal-mask';
  m.innerHTML=`<div class="modal" style="max-width:320px"><div class="mt">送货签到码 · ${d.warehouse}</div>
    <div class="mb"><div style="background:var(--mint-soft);border-radius:14px;padding:16px 12px;text-align:center"><div style="font-weight:700;margin-bottom:10px">${d.id}</div><div class="dl-qr">${qrGrid((d.id||'').length+3)}</div><div style="font-size:11.5px;color:var(--sub);margin-top:10px;line-height:1.6">到仓<b>出示此码</b>，由<b>仓库人员扫码确认签到</b>——商家端不做签到操作。</div></div></div>
    <div class="mf"><div class="mbn cancel">关闭</div><div class="mbn ok">🔬 模拟仓库扫码签到</div></div></div>`;
  document.querySelector('.phone').appendChild(m);
  m.querySelector('.cancel').onclick=()=>m.remove();m.onclick=e=>{if(e.target===m)m.remove();};
  m.querySelector('.ok').onclick=()=>{d.signed=true;d.signTime=d.signTime||'00:12';m.remove();toast('仓库已扫码确认签到，待逐张核验交接入仓');rerenderSignin();};}
function bindSignin(el,d){
  el.querySelectorAll('.dl-acts .a').forEach(b=>b.onclick=()=>{const a=b.dataset.a;
    // 签到与预约相互独立；签到由仓库扫码确认，商家端只出示签到码
    if(a==='print')dvPrint(d);
    else if(a==='print-off'){const cf=dvCutoff(d);toast(`未到营业截单时间（${cf.at}${cf.wd?' '+cf.wd:''}），截单后送货单内容才固定，届时可打印`);}
    else if(a==='sign')dvSignQR(d);
    else if(a==='book')dvBookSheet(d);
    else if(a==='bookmenu')sheet([{label:'改约时段',onClick:()=>dvBookSheet(d)},{label:'取消预约',danger:1,onClick:()=>{d.booked=false;d.bookWindow='';toast('已取消预约，仍可到仓直接签到');rerenderSignin();}}]);
    else if(a==='detail')openSignDetail(d);
  });
}
let _signList=null;
function rerenderSignin(){if(_signList)renderSigninInto(_signList);}
function renderSigninInto(list){
  const DL=window.FM.DB.deliveries||[];
  list.innerHTML=skel(2);
  setTimeout(()=>{
    if(!DL.length){list.innerHTML=`<div class="empty"><div class="ei">${svg('sign')}</div><h4>暂无送货单</h4><p>电脑端打印首个标签后，系统按入库仓库自动生成送货单</p></div>`;return;}
    list.innerHTML='';
    DL.forEach(d=>{const w=document.createElement('div');w.innerHTML=signinCard(d);const c=w.firstElementChild;list.appendChild(c);bindSignin(c,d);});
  },420);
}
function openSignin(){
  if(window.FM.ensureDeliveriesFromPrint)window.FM.ensureDeliveriesFromPrint(); // 电脑端打印首标签→自动生成送货单(演示)
  if(!window.FM.DB._delivDemo){window.FM.DB._delivDemo=true;const DL=window.FM.DB.deliveries||[];   // 演示预约/签到解耦的各种态
    if(DL[0]){DL[0].booked=true;DL[0].bookWindow='23:00–02:00';}          // 已预约·未签到
    if(DL[1]){DL[1].signed=true;DL[1].signTime='00:12';}                  // 未预约·已签到(仓库已扫码)
    // 已入库并完成收货清点·少货：缺口由平台自营现货补货，对应「平台补采」的补货单（与 PC 同数据）
    DL.push(
      {id:'SH20260628004',pickId:'JH20260628004',warehouse:'盛港DC',deliver:'06-28',window:'02:00–05:00',orderIds:['#SG20260628011'],labels:[],should:20,
       status:'交接完成',booked:true,bookWindow:'02:00–05:00',signed:true,signTime:'00:52',receiptTime:'2026-06-28 01:06',
       demoLines:[{code:'LBL-x-8801',name:'小棠菜',unit:'件',qty:20,recvQty:18}]},
      {id:'SH20260629005',pickId:'JH20260629005',warehouse:'兀兰DC',deliver:'06-29',window:'02:00–05:00',orderIds:['#SG20260629004'],labels:[],should:30,
       status:'交接完成',booked:true,bookWindow:'02:00–05:00',signed:true,signTime:'02:41',receiptTime:'2026-06-29 03:24',
       demoLines:[{code:'LBL-x-8804',name:'空心菜',unit:'件',qty:30,recvQty:22}]}
    );}
  pushPage({title:'送货签到',body:`
    <div class="dl-banner"><span>送货单由<b>电脑端打印首个标签</b>时按入库仓库自动生成（移动端不打印标签）。<b>预约与签到相互独立</b>；签到由<b>仓库扫码</b>核验交接入仓。</span></div>
    <div class="dl-list" id="dl-sgl"></div>`,
    mount:(p)=>{
      _signList=p.querySelector('#dl-sgl');renderSigninInto(_signList);
    }});
}

/* ============ 送货单详情（条码逐张 + 交接由仓库WMS，演示占位）============ */
function openSignDetail(d){
  const meta=RECV[d.warehouse]||{};
  const kv=(k,v)=>`<div style="display:flex;justify-content:space-between;gap:12px;padding:8px 0;font-size:13px;border-bottom:1px solid rgba(0,0,0,.05)"><span style="color:var(--sub);flex-shrink:0">${k}</span><span style="text-align:right;font-weight:500;word-break:break-all">${v||'—'}</span></div>`;
  const sec=t=>`<div style="margin:16px 16px 6px;font-weight:700;font-size:14px">${t}</div>`;
  const box=inner=>`<div style="margin:0 16px;background:#fff;border:1px solid rgba(0,0,0,.05);border-radius:12px;padding:2px 14px">${inner}</div>`;
  const skuFrom=c=>'SKU'+String(c||'').split('-').pop();
  const rows=dvSku(d);const totQty=rows.reduce((s,r)=>s+r.qty,0),totIn=rows.reduce((s,r)=>s+r.inQty,0);
  const signed=d.signed||d.status==='交接完成';
  pushPage({title:'送货单详情',navbar:true,body:`
    ${sec('单据信息')}
    ${box(
      kv('送货单号',`<span style="font-family:monospace">${d.id}</span>`)+
      kv('来源单号(备货单)',`<span style="font-family:monospace">${d.pickId||'-'}</span>`)+
      kv('入库仓库',d.warehouse)+
      kv('送达时段',`${d.deliver} ${d.window||''}`)+
      kv('应送货',`${totQty} 件`)+
      kv('实收数量（收货清点）',d.status==='交接完成'?`<b style="color:${totIn<totQty?'var(--red)':'var(--emerald)'}">${totIn}</b> 件${totIn<totQty?`（少货 ${totQty-totIn} 件）`:''}`:'待清点')+
      kv('预约时间',d.booked?`${d.deliver} ${d.bookWindow||d.window}`:'未预约')+
      kv('签到时间',signed?`${d.signTime||'00:12'} 仓库扫码确认`:'未签到')+
      kv('交接时间',d.status==='交接完成'?`${d.deliver} 已交接入仓`:'未交接')+
      kv('收货清点时间',d.status==='交接完成'?`${d.receiptTime||d.deliver+' 已清点'}（出库前·仓内清点）`:'未清点')+
      kv('收货结果',d.status==='交接完成'?(dvShort(d)?`<b style="color:var(--red)">少货 ${dvShortQty(d)} 件</b>`:'<b style="color:var(--emerald)">足额收货</b>'):'待清点')+
      kv('缺货罚款',d.status==='交接完成'?(dvFineAmt(d)>0?`<b style="color:var(--red)">S$${dvFineAmt(d).toFixed(2)}</b>（${dvFine(d).items.reduce((a,x)=>a+x.qty,0)} 件 × S$${dvFine(d).rate.toFixed(2)}/件 · ${dvFine(d).no}）`:'无'):'—')+
      kv('平台补采',d.status==='交接完成'?`<b style="color:${dvReplQty(d)>0?'var(--amber)':'var(--sub)'}">${dvReplQty(d)}</b> 件${dvReplQty(d)>0?'（缺口由平台自营现货补货）':'（无需补货）'}`:'0 件')
    )}
    ${dvShort(d)?(()=>{const rs=(window.FM_REPL_BY_DELIVERY?window.FM_REPL_BY_DELIVERY(d.id):[]);
      return `<div style="margin:12px 16px 0;background:${rs.length?'var(--amber-soft)':'var(--red-soft)'};color:${rs.length?'#B45309':'var(--red)'};font-size:12.5px;line-height:1.6;padding:11px 14px;border-radius:12px">
        本单收货清点<b>少货 ${totQty-totIn} 件</b>。${rs.length
          ?`缺口已由平台<b>自营现货全额补齐</b>，客户订单未受影响（商品/金额/发票不变），已生成平台补采单 ${rs.map(r=>r.no).join('、')}——按<b>你的含税售价 ×(1+加价率)</b> 计价并在结算单中抵扣。<div id="dl-repl-lk" style="font-weight:700;margin-top:6px;min-height:32px;display:flex;align-items:center;cursor:pointer">查看平台补采单 ›</div>`
          :`自营现货不足以全额覆盖缺口，本单按<b>实收数量</b>出库并标缺货，不生成平台补采单。`}
        ${dvFineAmt(d)>0?`<div style="margin-top:6px">另按缺货计<b>罚款 S$${dvFineAmt(d).toFixed(2)}</b>（${dvFine(d).items.reduce((a,x)=>a+x.qty,0)} 件 × S$${dvFine(d).rate.toFixed(2)}/件，单号 ${dvFine(d).no}）——<b>罚款与是否补采无关，只要清点出缺口就计</b>。</div>`:''}
        <div style="color:var(--sub);margin-top:4px">对实收数量有异议请<b>线下联系平台运营</b>核对，本期不设线上申诉入口。</div>
      </div>`;})():''}
    ${(ADDR[d.warehouse]||meta.d)?sec('交货地点信息')+box(
      kv('入库仓库',d.warehouse)+
      kv('详细地址',ADDR[d.warehouse])+
      kv('送货联系人',meta.d?String(meta.d).split(' ')[0]:'')+
      kv('联系电话',meta.d?(String(meta.d).split(' ')[1]||''):'')
    ):''}
    <div class="dl-kbox" style="margin:0 16px"><div class="k"><div class="l">应送货(件)</div><div class="v">${totQty}</div></div><div class="k"><div class="l">${d.status==='交接完成'?'实收(件)':'已入库(件)'}</div><div class="v" ${totIn<totQty?'style="color:var(--red)"':''}>${totIn}</div></div><div class="k"><div class="l">平台补采(件)</div><div class="v" ${dvReplQty(d)>0?'style="color:var(--amber)"':''}>${dvReplQty(d)}</div></div></div>
    ${whrOf(d.id).length?sec('多货 / 错货 · 待退回')+box(
      `<div style="padding:9px 0;font-size:12.5px;color:#B45309">本单被清点出 <b>${(function(l){return [...new Set(l.map(x=>x.type))].map(t=>`${t} ${l.filter(x=>x.type===t).reduce((a,x)=>a+x.qty,0)}${l.find(x=>x.type===t).unit}`).join(' · ');})(whrOf(d.id))}</b>，仓库已登记台账并留存照片，请线下取回；<b>不计入结算</b>。</div>`+
      whrOf(d.id).map(r=>`<div style="padding:9px 0;border-top:1px solid rgba(0,0,0,.05)">
        <div style="display:flex;align-items:center;gap:8px"><b>${r.name}</b>${stChip(r.type,r.type==='送错'?'var(--red-soft)':'var(--amber-soft)',r.type==='送错'?'var(--red)':'#B45309')}${r.status==='已取回'?stChip('已取回','var(--mint-soft)','var(--emerald-2)'):stChip('待取回','#E1EBFF','#2563EB')}</div>
        <div style="font-size:11.5px;color:var(--sub);margin-top:3px">${r.skuCode} · ${r.spec} · ${r.qty}${r.unit} · 库位 ${r.slot}</div>
      </div>`).join('')+
      `<div id="dl-whr-go" style="padding:11px 0;color:var(--emerald);font-weight:700;font-size:13px;min-height:44px;display:flex;align-items:center;cursor:pointer;border-top:1px solid rgba(0,0,0,.05)">前往「退货单 › 仓库退回」查看明细与照片 ›</div>`
    ):''}
    ${sec('商品明细 · 按 SKU 件数')}
    ${box(
      rows.map(r=>`<div style="padding:9px 0;border-bottom:1px solid rgba(0,0,0,.05)"><div style="display:flex;justify-content:space-between;align-items:baseline"><span style="font-weight:600">${r.name} <span style="font-family:monospace;font-size:11px;color:var(--sub)">${skuFrom(r.code)}</span></span><span style="font-family:'Lora',serif">${r.qty}${r.unit}</span></div><div style="font-size:11.5px;color:var(--sub);margin-top:2px">下单/预约 ${r.qty}${r.unit} · ${d.status==='交接完成'?'实收':'已入库'} <b style="color:${r.inQty>=r.qty?'var(--emerald)':'var(--red)'}">${r.inQty}${r.unit}</b>${r.inQty<r.qty?` · 差异 <b style="color:var(--red)">-${r.qty-r.inQty}</b>`:''} · 平台补采 <b style="color:${dvReplName(d,r.name)>0?'var(--amber)':'var(--sub)'}">${dvReplName(d,r.name)}</b>${r.unit}</div></div>`).join('')||'<div style="padding:12px 0;color:var(--sub);text-align:center">无商品明细</div>'
    )}
    <div style="margin:8px 16px 0;font-size:11.5px;color:var(--sub);line-height:1.6">实收数量由仓库<b>收货清点</b>后由 WMS 实时回写，商家端只读。少货部分<b>不冲减客户订单</b>，也不下调你的 GMV 与佣金。<b>平台补采</b>＝缺口由平台自营现货补货的数量（未补货为 0），按含税售价 ×(1+加价率) 在结算单中抵扣。</div>
    <div style="height:8px"></div>`,
    footer:`${(d.signed&&d.status!=='交接完成')?`<button class="btn" style="width:100%;background:var(--muted);color:#46604F" id="dl-wms">🔬 演示：模拟仓库扫码交接</button>`:`<button class="btn primary" style="width:100%" disabled>${d.status==='交接完成'?'已交接入仓':'待仓库交接'}</button>`}`,
    mount:(p)=>{
      const wgo=p.querySelector('#dl-whr-go');
      if(wgo)wgo.onclick=()=>{popPage();window.FM_MOD&&window.FM_MOD.return?window.FM_MOD.return():toast('退货单模块加载中');};
      const rlk=p.querySelector('#dl-repl-lk');
      if(rlk)rlk.onclick=()=>{window.FM_MOD&&window.FM_MOD.replen?window.FM_MOD.replen():toast('平台补采模块加载中');};
      const wms=p.querySelector('#dl-wms');
      if(wms)wms.onclick=()=>confirmDialog({title:'模拟仓库扫码交接',body:`【演示】模拟仓库 WMS 扫齐 ${d.should} 张标签，${d.orderIds.length} 个订单将转「备货中」。真实由仓库端扫码，商家不操作。`,okText:'模拟交接',onOk:()=>{(d.labels||[]).forEach(l=>l.arrived=true);window.FM.deliveryHandover(d.id);toast('【演示】已交接入仓，订单转备货中');popPage();rerenderSignin();}});
    }});
}

/* ============ 交货进度 ============ */
const PROG=[
 {dept:'新加坡事业部',total:1104,whs:[
   {n:'裕廊DC',time:'06-30 23:00-02:00',type:'recv',should:33,recv:0,wait:33,batch:'早批次10',undeliv:'未送货33件'},
   {n:'兀兰DC（配送商）',time:'06-30 23:00-02:00',type:'print',should:5,print:5,deliv:0,wait:5,batch:'早批次3',undeliv:'未送货5件'},
   {n:'盛港DC（代理人）',time:'06-30 23:00-02:00',type:'print',should:3,print:3,deliv:0,wait:3,batch:'早批次0',undeliv:'未送货3件'},
 ]},
];
const STATIONS=[['中区站',12,12,0],['东区站',11,11,0],['西区站',7,7,0],['北区站',3,3,0]];
function progWh(w){
  const mx=w.type==='recv'
    ? `<div class="m"><div class="v">${w.should}</div><div class="l">应送货</div></div><div class="m"><div class="v">${w.recv}</div><div class="l">已收货</div></div><div class="m"><div class="v wait">${w.wait}</div><div class="l">待交货</div></div>`
    : `<div class="m"><div class="v">${w.should}</div><div class="l">应送货</div></div><div class="m"><div class="v">${w.print}</div><div class="l">已打印</div></div><div class="m"><div class="v">${w.deliv}</div><div class="l">已交货</div></div><div class="m"><div class="v wait">${w.wait}</div><div class="l">待交货</div></div>`;
  return `<div class="dl-pw"><div class="wn"><span>${w.n} ⑦</span><span class="tm">交货时间 ${w.time}</span></div>
    <div class="mx">${mx}</div>
    <div class="sub2"><span class="bt">${w.batch} ⑦</span><span class="ud">${w.undeliv}</span></div>
    <div class="pacts"><div class="b" data-st="${w.n}">站区明细</div><div class="b" data-ar="${w.n}">片区明细</div></div></div>`;
}
function openProgress(){
  pushPage({title:'交货进度',body:`
    <div class="dl-filters"><span class="dl-drop" data-f="date">07月01日 <span class="ca">▾</span></span><span class="dl-drop" data-f="city">全部管理城市 <span class="ca">▾</span></span><span class="dl-drop" data-f="ware">全部仓库 <span class="ca">▾</span></span></div>
    <div id="dl-pgbody"></div>`,
    mount:(p)=>{
      const body=p.querySelector('#dl-pgbody');
      const draw=()=>{
        body.innerHTML=skel(2);
        setTimeout(()=>{
          body.innerHTML=`<div class="dl-glabel">交货进度</div>`+PROG.map(g=>`<div class="dl-pcard">
            <div class="dept"><span class="nm">${g.dept}</span><span class="tot">总销量 ${g.total}</span></div>
            ${g.whs.map(progWh).join('')}</div>`).join('');
          body.querySelectorAll('[data-st]').forEach(e=>e.onclick=()=>stationPopup(e.dataset.st,'站区'));
          body.querySelectorAll('[data-ar]').forEach(e=>e.onclick=()=>stationPopup(e.dataset.ar,'片区'));
        },420);
      };
      draw();
      p.querySelectorAll('.dl-drop').forEach(d=>d.onclick=()=>sheet([{label:'全部',onClick:()=>toast('已筛选')},{label:'裕廊DC',onClick:()=>toast('已筛选')}]));
    }});
}
function stationPopup(ware,kind){
  const m=document.createElement('div');m.className='dl-sheet-mask';
  m.innerHTML=`<div class="dl-sheet"><div class="sh">${ware} · ${kind}明细<span class="x">✕</span></div>
    <div class="sbody"><div class="dl-tbl"><div class="th"><span class="c1">${kind}名称</span><span class="c2">应送货</span><span class="c2">已打印</span><span class="c2">已交货</span></div>
    ${STATIONS.map(s=>`<div class="tr"><span class="c1">${s[0]}</span><span class="c2">${s[1]}</span><span class="c2">${s[2]}</span><span class="c2">${s[3]}</span></div>`).join('')}</div></div></div>`;
  document.querySelector('.phone').appendChild(m);
  m.querySelector('.x').onclick=()=>m.remove();m.onclick=e=>{if(e.target===m)m.remove();};
}

/* ============ 退货取回 → 退货单（2026-07-21 会议定稿：商家只读；确认由仓库操作；到货后72h未提平台处置） ============ */
// 退货单：三方退货到平台仓不入库仅暂存。状态 待仓库入库→待提货(仓库确认到货,72h倒计时)→已提货/逾期未提。
// 商家端只读展示状态+提货码+剩余时限，无状态确认/预约/新建权限（三方退款须基于已判责售后工单，禁止商家自建）
const RETURN=[
 {no:'TKD2026063008266685',ware:'裕廊DC',cnt:1,st:'待提货',order:'2026-07-20 08:51',code:'460439',arrive:'2026-07-20 21:00',deadline:'2026-07-23 21:00'},
 {no:'TKD2026062908267496',ware:'兀兰DC',cnt:1,st:'待仓库入库',order:'2026-07-21 07:12',code:'897256',arrive:'',deadline:''},
 {no:'TKD2026062908314280',ware:'盛港DC',cnt:1,st:'待提货',order:'2026-07-20 06:04',code:'715187',arrive:'2026-07-20 14:00',deadline:'2026-07-23 14:00'},
 {no:'TKD2026062708201337',ware:'大巴窑DC',cnt:2,st:'已提货',order:'2026-07-18 14:20',code:'330218',arrive:'2026-07-18 18:00',deadline:'2026-07-21 18:00'},
];
function returnCard(g){
  return `<div class="dl-rcard">
    <div class="r1"><span class="no">${g.no}</span><span class="lbl">客退退货单</span><span class="st" data-no="${g.no}">${g.st}</span></div>
    <div class="r2"><span class="ware">${g.ware}<span class="dot"></span></span><span class="cnt">共${g.cnt}件</span></div>
    <div class="info">${g.arrive?`到仓时间：${g.arrive}`:`${g.order} 下单`}<br><span class="code">提货码：${g.code}</span><br><span class="dl-deadline">${g.st==='待提货'?`剩 ${cdSpan(arriveDueMs(g.arrive,72))} 提货（逾期平台处置）`:g.st==='待仓库入库'?'待仓库确认到货':g.st==='已提货'?'已提货':g.st==='逾期未提'?'已逾期·平台处置':'—'}</span></div>
  </div>`;
}
/* ============ 仓库退回（多货 / 错货）—— 2026-08-12 纪要：不新增单据与单号，
   沿用原送货单标记，仓库台账+多角度照片+专属虚拟库位，商家线下取回。
   与 PC pc-modules/delivery.js 的 DB.whReturns 同源同口径。 ============ */
window.FM.DB.whReturns = window.FM.DB.whReturns || [
  {deliveryNo:'SH20260628004',warehouse:'盛港DC',skuCode:'SKU8899',name:'上海青',spec:'1kg/件',unit:'件',
   type:'送错',qty:6,photos:3,slot:'SG-VIRT-01',registeredAt:'2026-06-28 01:22',status:'待取回',pickedAt:'',
   note:'与本单小棠菜串货，实物为上海青'},
  {deliveryNo:'SH20260628004',warehouse:'盛港DC',skuCode:'SKU8802',name:'白菜',spec:'1kg/件',unit:'件',
   type:'送多',qty:3,photos:2,slot:'SG-VIRT-01',registeredAt:'2026-06-28 01:25',status:'待取回',pickedAt:'',
   note:'实收 23，超出应送 20 共 3 件'},
  {deliveryNo:'SH20260629005',warehouse:'兀兰DC',skuCode:'SKU8804',name:'空心菜',spec:'1kg/件',unit:'件',
   type:'送多',qty:4,photos:2,slot:'WD-VIRT-03',registeredAt:'2026-06-29 03:40',status:'待取回',pickedAt:'',
   note:'实收 26，超出应送 22 共 4 件'},
  {deliveryNo:'SH20260518001',warehouse:'裕廊DC',skuCode:'SKU8811',name:'鲜鸡蛋',spec:'30枚/盘',unit:'盘',
   type:'送多',qty:2,photos:3,slot:'JR-VIRT-07',registeredAt:'2026-05-18 02:30',status:'已取回',pickedAt:'2026-05-20 10:15',
   note:''},
];
const WHR=()=>window.FM.DB.whReturns||[];
function whrOf(id){return WHR().filter(r=>r.deliveryNo===id);}
window.whrOfDelivery=whrOf;
function whrGroups(){
  const map={};WHR().forEach(r=>{(map[r.deliveryNo]=map[r.deliveryNo]||[]).push(r);});
  return Object.keys(map).map(no=>{
    const list=map[no].slice().sort((a,b)=>(a.type==='送错'?0:1)-(b.type==='送错'?0:1));
    const wait=list.filter(x=>x.status==='待取回').length;
    return {no,list,warehouse:list[0].warehouse,slot:[...new Set(list.map(x=>x.slot))].join(' / '),
      at:list.map(x=>x.registeredAt).sort()[0],qty:list.reduce((a,x)=>a+x.qty,0),wait,
      status:wait===0?'已取回':(wait===list.length?'待取回':'部分取回')};
  }).sort((a,b)=>b.at.localeCompare(a.at));
}
function whrSum(list){
  return [...new Set(list.map(x=>x.type))]
    .map(t=>`${t} ${list.filter(x=>x.type===t).reduce((a,x)=>a+x.qty,0)}${list.find(x=>x.type===t).unit}`).join(' · ');
}
function whrTypeChip(t){return stChip(t,t==='送错'?'var(--red-soft)':'var(--amber-soft)',t==='送错'?'var(--red)':'#B45309');}
function whrStChip(g){
  if(g.status==='已取回')return stChip('已取回','var(--mint-soft)','var(--emerald-2)');
  if(g.status==='部分取回')return stChip(`部分取回 ${g.list.length-g.wait}/${g.list.length}`,'var(--amber-soft)','#B45309');
  return stChip(`待取回 ${g.list.length} 项`,'#E1EBFF','#2563EB');
}
// 列表：一行=一张送货单（同单多项合并）
function whrCard(g){
  return `<div class="dl-card" data-whr="${g.no}">
    <div class="dl-ch"><span>来源送货单</span><span class="no">${g.no}</span></div>
    <div style="display:flex;align-items:center;gap:8px;margin:9px 0 3px;flex-wrap:wrap">
      ${[...new Set(g.list.map(x=>x.type))].map(whrTypeChip).join('')}${whrStChip(g)}
    </div>
    <div class="dl-meta"><span class="k">退回商品</span><span class="vv">${g.list.map(x=>x.name).join('、')} · 共 ${g.list.length} 个 SKU</span></div>
    <div class="dl-meta"><span class="k">类型合计</span><span class="vv">${whrSum(g.list)}</span></div>
    <div class="dl-meta"><span class="k">存放</span><span class="vv">${g.warehouse} · ${g.slot}</span></div>
    <div class="dl-meta"><span class="k">登记</span><span class="vv">${g.at}</span></div>
    <div class="dl-kbox"><div class="k"><div class="l">总数量</div><div class="v">${g.qty}</div></div><div class="k"><div class="l">SKU 数</div><div class="v">${g.list.length}</div></div><div class="k"><div class="l">待取回</div><div class="v" ${g.wait?'style="color:var(--red)"':''}>${g.wait}</div></div></div>
    <div class="dl-acts"><div class="a key" data-a="whrdetail">详情</div><div class="a" data-a="whrdeliv">送货单</div></div>
  </div>`;
}
// 详情：逐 SKU 区分
function openWhrDetail(no){
  const g=whrGroups().find(x=>x.no===no); if(!g)return;
  const kv=(k,v)=>`<div style="display:flex;justify-content:space-between;gap:12px;padding:8px 0;font-size:13px;border-bottom:1px solid rgba(0,0,0,.05)"><span style="color:var(--sub);flex-shrink:0">${k}</span><span style="text-align:right;font-weight:500;word-break:break-all">${v||'—'}</span></div>`;
  const sec=t=>`<div style="margin:16px 16px 6px;font-weight:700;font-size:14px">${t}</div>`;
  const box=i=>`<div style="margin:0 16px;background:#fff;border:1px solid rgba(0,0,0,.05);border-radius:12px;padding:2px 14px">${i}</div>`;
  pushPage({title:'仓库退回详情',navbar:true,body:`
    <div style="margin:12px 16px 0;background:var(--amber-soft);color:#B45309;font-size:12.5px;line-height:1.6;padding:11px 14px;border-radius:12px">
      本单被清点出 <b>${whrSum(g.list)}</b>，仓库已登记台账、留存实物照片并放入专属虚拟库位暂存。这批货<b>不计入结算、不产生扣款也不付款</b>，请线下与仓库约时间取回。
    </div>
    ${sec('单据信息')}
    ${box(
      kv('来源送货单',`<span style="font-family:monospace">${g.no}</span>`)+
      kv('存放仓库',g.warehouse)+
      kv('虚拟库位',`<span style="font-family:monospace">${g.slot}</span>`)+
      kv('首次登记时间',g.at)+
      kv('退回商品',`${g.list.length} 个 SKU · 合计 ${g.qty}`)+
      kv('退回单号','无（沿用原送货单标记，不另生成单号）')
    )}
    ${sec('退回商品明细 · 逐 SKU')}
    ${box(g.list.map(r=>`<div style="padding:11px 0;border-bottom:1px solid rgba(0,0,0,.05)">
      <div style="display:flex;align-items:center;gap:8px"><b style="font-size:14px">${r.name}</b>${whrTypeChip(r.type)}${r.status==='已取回'?stChip('已取回','var(--mint-soft)','var(--emerald-2)'):stChip('待取回','#E1EBFF','#2563EB')}</div>
      <div style="font-size:11.5px;color:var(--sub);margin-top:3px">${r.skuCode} · ${r.spec}</div>
      ${r.note?`<div style="font-size:11.5px;color:var(--sub);margin-top:3px">${r.note}</div>`:''}
      <div style="display:flex;gap:16px;margin-top:8px;font-size:12.5px;color:#46604F;flex-wrap:wrap">
        <span>数量 <b>${r.qty}</b> ${r.unit}</span><span>库位 <span style="font-family:monospace">${r.slot}</span></span><span>登记 ${r.registeredAt}</span>${r.pickedAt?`<span>取回 ${r.pickedAt}</span>`:''}
      </div>
      <div class="whr-ph" data-sku="${r.skuCode}" style="margin-top:8px;color:var(--emerald);font-weight:700;font-size:12.5px;min-height:32px;display:flex;align-items:center;cursor:pointer">📷 ${r.photos} 张实物照片</div>
    </div>`).join(''))}
    <div style="margin:12px 16px 0;font-size:11.5px;color:var(--sub);line-height:1.6">状态由<b>仓库</b>在交接时<b>按项</b>回写，同单可分批取回；商家端只读，无编辑与线上预约入口。</div>
    <div style="height:8px"></div>`,
    footer:`<button class="btn primary" style="width:100%" id="whr-go">查看送货单</button>`,
    mount:(p)=>{
      p.querySelectorAll('.whr-ph').forEach(e=>e.onclick=()=>openWhrPhotos(g.no,e.dataset.sku));
      const b=p.querySelector('#whr-go');if(b)b.onclick=()=>{popPage();window.FM.DB.delivView=g.no;openSignin();};
    }});
}
function openWhrPhotos(no,sku){
  const r=WHR().find(x=>x.deliveryNo===no&&x.skuCode===sku); if(!r)return;
  pushPage({title:'仓库留存照片',navbar:true,body:`
    <div style="margin:12px 16px;background:#E1EBFF;color:#2563EB;font-size:12.5px;line-height:1.6;padding:11px 14px;border-radius:12px">
      照片由仓库在登记台账时<b>多角度拍摄留存</b>，作为多货/错货的实物凭证；商家端只读。
    </div>
    <div style="margin:0 16px;display:grid;grid-template-columns:repeat(2,1fr);gap:10px">
      ${Array.from({length:r.photos}).map((_,i)=>`<div style="aspect-ratio:4/3;background:var(--muted);border-radius:12px;display:flex;align-items:center;justify-content:center;color:var(--sub);font-size:12.5px">实物照片 ${i+1}</div>`).join('')}
    </div>
    <div style="margin:12px 16px;font-size:12.5px;color:var(--sub)">${r.name} · ${r.type} ${r.qty}${r.unit} · 存放 ${r.warehouse} · <span style="font-family:monospace">${r.slot}</span>（专属虚拟库位，不计入正常库存）</div>`});
}

function openReturn(){
  pushPage({title:'退货单',body:`
    <div class="iv-seg" id="rt-seg" style="display:flex;gap:6px;background:var(--muted);border-radius:14px;margin:10px 16px 4px;padding:4px">
      <span class="s on" data-s="cust" style="flex:1;min-height:44px;display:flex;align-items:center;justify-content:center;font-size:14.5px;font-weight:700;color:var(--emerald-2);border-radius:11px;background:#fff;box-shadow:var(--sh-sm);cursor:pointer">客户退货</span>
      <span class="s" data-s="whr" style="flex:1;min-height:44px;display:flex;align-items:center;justify-content:center;font-size:14.5px;font-weight:700;color:var(--sub);border-radius:11px;cursor:pointer">仓库退回</span>
    </div>
    <div id="rt-cust">
    <div class="dl-banner" id="dl-rbn"><span>三方退货货物到仓后不入库、仅暂存。<b>提货确认由仓库操作</b>，商家凭提货码到仓自提；到货后请在 <b>72 小时</b>内提货，逾期平台可自行处置。数量以仓库 RF 端实际确认为准，如有严重问题请拨客服 4000-616-700。</span><span class="x">✕</span></div>
    <div class="dl-filters"><span class="dl-drop" data-f="ware">全部仓库 <span class="ca">▾</span></span><span class="dl-drop" data-f="bill">全部单据 <span class="ca">▾</span></span></div>
    <div class="dl-tabs" id="dl-rtab"><span class="t on" data-t="all">全部</span><span class="t" data-t="待仓库入库">待仓库入库</span><span class="t" data-t="待提货">待提货</span><span class="t" data-t="已提货">已提货</span></div>
    <div class="dl-list" id="dl-rtl"></div></div>
    <div id="rt-whr" style="display:none"></div>`,
    mount:(p)=>{
      const list=p.querySelector('#dl-rtl');
      // 来源分段：客户退货（客户售后退回）/ 仓库退回（送货单里送错·送多）
      const segs=p.querySelectorAll('#rt-seg .s'), cust=p.querySelector('#rt-cust'), whr=p.querySelector('#rt-whr');
      function drawWhr(){
        const gs=whrGroups();
        whr.innerHTML=gs.length?`
          <div style="margin:8px 16px 10px;background:var(--amber-soft);color:#B45309;font-size:12.5px;line-height:1.6;padding:11px 14px;border-radius:12px">
            <b>仓库退回</b>＝你送到仓的商品中被清点出<b>送多</b>或<b>送错</b>的部分。这批货<b>不计入结算、不产生扣款也不付款</b>，仓库已放入专属虚拟库位暂存，请<b>线下联系仓库约时间取回</b>。沿用原送货单标记，不另生成退货单号。
          </div>
          <div class="dl-list">${gs.map(whrCard).join('')}</div>`
          :`<div class="empty"><div class="ei">${svg('box')}</div><h4>暂无待退回商品</h4><p>送货到仓被清点出送多或送错的商品时，仓库登记台账后在此生成取货通知</p></div>`;
        whr.querySelectorAll('[data-whr]').forEach(c=>{
          const no=c.dataset.whr;
          c.querySelectorAll('[data-a]').forEach(b=>b.onclick=e=>{e.stopPropagation();
            if(b.dataset.a==='whrdetail')openWhrDetail(no); else {window.FM.DB.delivView=no;openSignin();}});
        });
      }
      segs.forEach(sg=>sg.onclick=()=>{
        segs.forEach(x=>{const on=x===sg;x.style.background=on?'#fff':'transparent';x.style.color=on?'var(--emerald-2)':'var(--sub)';x.style.boxShadow=on?'var(--sh-sm)':'none';});
        const isWhr=sg.dataset.s==='whr';
        cust.style.display=isWhr?'none':'block'; whr.style.display=isWhr?'block':'none';
        if(isWhr)drawWhr();
      });
      const draw=(t)=>{
        list.innerHTML=skel(2);
        setTimeout(()=>{
          const data=t==='all'?RETURN:RETURN.filter(g=>g.st===t);
          if(!data.length){list.innerHTML=`<div class="empty"><div class="ei">${svg('refund')}</div><h4>暂无${t==='all'?'':t}退货单</h4><p>退货退款售后单判责后会在此展示到仓提货进度</p></div>`;return;}
          list.innerHTML=data.map(returnCard).join('');
          list.querySelectorAll('[data-no]').forEach(e=>e.onclick=()=>toast('退货单 '+e.dataset.no));
        },420);
      };
      draw('all');
      p.querySelectorAll('#dl-rtab .t').forEach(t=>t.onclick=()=>{p.querySelectorAll('#dl-rtab .t').forEach(x=>x.classList.remove('on'));t.classList.add('on');draw(t.dataset.t);});
      const bn=p.querySelector('#dl-rbn');bn.querySelector('.x').onclick=()=>bn.remove();
      p.querySelectorAll('.dl-drop').forEach(d=>d.onclick=()=>sheet([{label:d.dataset.f==='ware'?'裕廊DC':'客退退货单',onClick:()=>toast('已筛选')},{label:d.dataset.f==='ware'?'兀兰DC':'报损退货单',onClick:()=>toast('已筛选')}]));
    }});
}
// 预约提货 / 新建退货单 已按 2026-07-21 会议移除：提货确认统一由仓库操作、商家端只读；三方退款须基于已判责售后工单，商家不可自建退货单。

window.FM_MOD=window.FM_MOD||{};
window.FM_MOD.signin=openSignin;
window.FM_MOD.progress=openProgress;
window.FM_MOD.return=openReturn;
})();
