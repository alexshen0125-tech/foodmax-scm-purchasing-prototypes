/* Food Max 商家端 v2 · 送货退货组（送货签到 / 装筐送货 / 交货进度 / 退库取回）
   还原快驴卖家App 9 张参考截图；SG 仓(裕廊/兀兰/盛港/大巴窑/淡滨尼/义顺 DC) + S$
   评审修复内建：列表先 skel→数据 / 装筐空态用 .empty / 破坏性(不需要提货·放弃所有权)用 confirmDialog / 可点元素≥44px */
(function(){
const {pushPage,popPage,toast,confirmDialog,sheet,svg,skel}=window.FM;

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
/* 退库单 */
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
/* 新建退库单 */
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
function signinCard(d){
  const signed=d.status==='已签到'||d.status==='交接完成';
  return `<div class="dl-card">
    <div class="dl-ch"><span>预约送货单</span><span class="no">${d.id}</span><span class="st ${signed?'ok':'wait'}">${dvStName(d)}</span></div>
    <div class="dl-tagline"><span class="v">${d.deliver} ${d.window}</span></div>
    <div class="dl-meta"><span class="k">备货单</span><span class="vv" style="font-family:monospace">${d.pickId}</span></div>
    <div class="dl-meta"><span class="k">入库仓库</span><span class="vv">${d.warehouse} · ${d.orderIds.length}单</span></div>
    ${d.status==='已签到'?`<div class="dl-meta"><span class="k"></span><span class="vv" style="color:var(--sub)">待仓库扫码交接</span></div>`:''}
    <div class="dl-kbox"><div class="k"><div class="l">应送货</div><div class="v">${d.should}</div></div><div class="k"><div class="l">已入库</div><div class="v">${dvArrived(d)}</div></div></div>
    <div class="dl-acts">${d.status==='交接完成'
      ?`<div class="a" data-a="detail">查看详情</div>`
      :d.status==='已签到'
      ?`<div class="a" data-a="detail">查看详情</div><div class="a" data-a="fwd">转发</div>`
      :`<div class="a key" data-a="sign">签到</div><div class="a" data-a="detail">详情</div><div class="a" data-a="fwd">转发</div>`}</div>
  </div>`;
}
function bindSignin(el,d){
  el.querySelectorAll('.dl-acts .a').forEach(b=>b.onclick=()=>{const a=b.dataset.a;
    if(a==='sign')confirmDialog({title:'确认到仓签到？',body:`「${d.warehouse}」签到后由<b>仓库扫码</b>逐张核验交接入仓（商家不操作交接）。`,okText:'签到',onOk:()=>{if(d.status==='待送货'||d.status==='已预约')d.status='已签到';toast('签到成功，待仓库扫码交接');rerenderSignin();}});
    else if(a==='detail')openSignDetail(d);
    else if(a==='fwd')sheet([{label:'转发给送货司机',onClick:()=>toast('已生成转发链接')},{label:'复制送货单号',onClick:()=>toast('已复制 '+d.id)}]);
  });
}
let _signList=null;
function rerenderSignin(){if(_signList)renderSigninInto(_signList);}
function renderSigninInto(list){
  const DL=window.FM.DB.deliveries||[];
  list.innerHTML=skel(2);
  setTimeout(()=>{
    if(!DL.length){list.innerHTML=`<div class="empty"><div class="ei">${svg('sign')}</div><h4>暂无预约送货单</h4><p>备货单「分拣贴码」完成后，系统按入库仓库自动生成送货单</p></div>`;return;}
    list.innerHTML='';
    DL.forEach(d=>{const w=document.createElement('div');w.innerHTML=signinCard(d);const c=w.firstElementChild;list.appendChild(c);bindSignin(c,d);});
  },420);
}
function openSignin(){
  pushPage({title:'送货签到',body:`
    <div class="dl-banner"><span>送货单来自备货单贴码后按仓拆分。可转发给司机；签到后由<b>仓库扫码</b>逐张核验交接入仓（标签到齐 → 订单转「待收货」）。</span></div>
    <div class="dl-priv"><span>转发隐私：不允许对方查看商品清单</span><span class="ed" id="dl-priv">修改 ›</span></div>
    <div class="dl-list" id="dl-sgl"></div>`,
    mount:(p)=>{
      _signList=p.querySelector('#dl-sgl');renderSigninInto(_signList);
      p.querySelector('#dl-priv').onclick=()=>sheet([{label:'允许对方查看商品清单',onClick:()=>toast('已设置：允许查看')},{label:'仅展示送货单号与数量',onClick:()=>toast('已设置：隐藏清单')}]);
    }});
}

/* ============ 送货单详情（条码逐张 + 交接由仓库WMS，演示占位）============ */
function openSignDetail(d){
  pushPage({title:'送货单详情',navbar:true,body:`
    <div class="dl-head"><div class="no">送货单 ${d.id} · 备货单 ${d.pickId}</div>
      <div class="ware">${d.warehouse}</div>
      <div class="ln"><span>${d.deliver} ${d.window}</span></div>
      <div class="ln"><span class="k">订单数</span><span>${d.orderIds.length} 单</span></div></div>
    <div class="dl-qrcard"><div class="qt">送货签到码</div><div class="dl-qr">${qrGrid((d.id||'').length+3)}</div><div style="font-size:12px;color:var(--sub);margin-top:10px">到仓出示，随后由仓库逐张扫码交接入仓</div></div>
    <div class="dl-kbox" style="margin:0 16px"><div class="k"><div class="l">应送货</div><div class="v">${d.should}</div></div><div class="k"><div class="l">已入库</div><div class="v">${dvArrived(d)}</div></div></div>
    <div class="dl-tbl"><div class="th"><span class="c1">条码 · 商品</span><span class="c2">所属订单</span><span class="c3">到仓</span></div>
      ${(d.labels||[]).map(l=>`<div class="tr"><span class="c1">${l.name} ${l.qty}${l.unit}<div class="sp" style="font-family:monospace">${l.code}</div></span><span class="c2" style="font-family:monospace;font-size:11px">${l.orderId}</span><span class="c3" style="${l.arrived?'color:var(--emerald)':'color:var(--red)'}">${l.arrived?'✓':'待到'}</span></div>`).join('')}</div>
    <div style="height:8px"></div>`,
    footer:`<div style="display:flex;gap:12px"><button class="btn ghost" style="flex:1" id="dl-dfwd">转发给司机</button>${d.status==='已签到'?`<button class="btn" style="flex:1;background:var(--muted);color:#46604F" id="dl-wms">🔬 演示：模拟仓库扫码交接</button>`:`<button class="btn primary" style="flex:1" disabled>${d.status==='交接完成'?'已交接入仓':'待仓库交接'}</button>`}</div>`,
    mount:(p)=>{
      p.querySelector('#dl-dfwd').onclick=()=>sheet([{label:'转发给送货司机',onClick:()=>toast('已生成转发链接')}]);
      const wms=p.querySelector('#dl-wms');
      if(wms)wms.onclick=()=>confirmDialog({title:'模拟仓库扫码交接',body:`【演示】模拟仓库 WMS 扫齐 ${d.should} 张标签，${d.orderIds.length} 个订单将转「待收货」。真实由仓库端扫码，商家不操作。`,okText:'模拟交接',onOk:()=>{(d.labels||[]).forEach(l=>l.arrived=true);window.FM.deliveryHandover(d.id);toast('【演示】已交接入仓，订单转待收货');popPage();rerenderSignin();}});
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

/* ============ 退库取回 → 退库单 ============ */
const RETURN=[
 {no:'TKD2026063008266685',ware:'裕廊DC',cnt:1,st:'待出库',order:'2026-06-30 02:51',code:'460439',deadline:'2026-07-03 02:51'},
 {no:'TKD2026062908267496',ware:'兀兰DC',cnt:1,st:'待出库',order:'2026-06-29 09:12',code:'897256',deadline:'2026-07-02 09:12'},
 {no:'TKD2026062908314280',ware:'盛港DC',cnt:1,st:'待出库',order:'2026-06-29 09:04',code:'715187',deadline:'2026-07-02 09:04'},
 {no:'TKD2026062708201337',ware:'大巴窑DC',cnt:2,st:'运输中',order:'2026-06-27 14:20',code:'330218',deadline:'2026-06-30 14:20'},
];
function returnCard(g){
  return `<div class="dl-rcard">
    <div class="r1"><span class="no">${g.no}</span><span class="lbl">客退退库单</span><span class="st" data-no="${g.no}">${g.st} ›</span></div>
    <div class="r2"><span class="ware">${g.ware}<span class="dot"></span></span><span class="cnt">共${g.cnt}件</span></div>
    <div class="info">${g.order} 下单<br><span class="code">提货码：${g.code}</span><br><span class="dl-deadline">提货截止时间：${g.deadline}</span></div>
    ${g.st==='待出库'?`<div class="rb"><span class="b" data-book="${g.no}">预约提货</span></div>`:''}
  </div>`;
}
function openReturn(){
  pushPage({title:'退库单',body:`
    <div class="dl-banner" id="dl-rbn"><span>请在RF端与仓库工作人员确认实际提货数量后，提供提货码。因售后链路较长，商品数量会有20%的浮动差异，且商品质量也无法完全保证。如果您收到货物后，发现存在严重问题，可拨打客服热线 4000-616-700 进行咨询。</span><span class="x">✕</span></div>
    <div class="dl-filters"><span class="dl-drop" data-f="ware">全部仓库 <span class="ca">▾</span></span><span class="dl-drop" data-f="bill">全部单据 <span class="ca">▾</span></span></div>
    <div class="dl-tabs" id="dl-rtab"><span class="t on" data-t="all">全部</span><span class="t" data-t="待出库">待出库</span><span class="t" data-t="待运输">待运输</span><span class="t" data-t="运输中">运输中</span><span class="t" data-t="已送达">已送达</span></div>
    <div class="dl-list" id="dl-rtl"></div>`,
    footer:`<button class="btn primary" id="dl-newret">＋ 新建退库单</button>`,
    mount:(p)=>{
      const list=p.querySelector('#dl-rtl');
      const draw=(t)=>{
        list.innerHTML=skel(2);
        setTimeout(()=>{
          const data=t==='all'?RETURN:RETURN.filter(g=>g.st===t);
          if(!data.length){list.innerHTML=`<div class="empty"><div class="ei">${svg('refund')}</div><h4>暂无${t==='all'?'':t}退库单</h4><p>客退商品产生的退库单会出现在这里</p></div>`;return;}
          list.innerHTML=data.map(returnCard).join('');
          list.querySelectorAll('[data-book]').forEach(e=>e.onclick=()=>bookPickup(e.dataset.book));
          list.querySelectorAll('[data-no]').forEach(e=>e.onclick=()=>toast('退库单 '+e.dataset.no));
        },420);
      };
      draw('all');
      p.querySelectorAll('#dl-rtab .t').forEach(t=>t.onclick=()=>{p.querySelectorAll('#dl-rtab .t').forEach(x=>x.classList.remove('on'));t.classList.add('on');draw(t.dataset.t);});
      const bn=p.querySelector('#dl-rbn');bn.querySelector('.x').onclick=()=>bn.remove();
      p.querySelectorAll('.dl-drop').forEach(d=>d.onclick=()=>sheet([{label:d.dataset.f==='ware'?'裕廊DC':'客退退库单',onClick:()=>toast('已筛选')},{label:d.dataset.f==='ware'?'兀兰DC':'报损退库单',onClick:()=>toast('已筛选')}]));
      p.querySelector('#dl-newret').onclick=openNewReturn;
    }});
}
// 预约提货弹层
const GIVEUP_REASONS=['商品已无销售价值','二次取回成本高于货值','客户已自行处理','其他原因'];
function bookPickup(no){
  const m=document.createElement('div');m.className='dl-sheet-mask';
  m.innerHTML=`<div class="dl-sheet"><div class="sh">预约提货<span class="x">✕</span></div>
    <div class="sbody">
      <div class="tip">ⓘ 超期未确认提货，商品自动进入销残程序</div>
      <div class="qh">是否需要提货</div>
      <div class="dl-radios"><div class="dl-radio on" data-v="yes"><span class="rc"></span>需要提货</div><div class="dl-radio danger" data-v="no"><span class="rc"></span>不需要提货</div></div>
      <div id="dl-pkbody"></div>
    </div>
    <div class="sfoot"><button class="btn primary" id="dl-pkok">确定</button></div></div>`;
  document.querySelector('.phone').appendChild(m);
  const body=m.querySelector('#dl-pkbody');
  const state={need:'yes',date:'',reason:-1};
  const ok=m.querySelector('#dl-pkok');
  const refresh=()=>{
    if(state.need==='yes'){
      body.innerHTML=`<div class="qh">预约提货时间</div><div class="dl-field${state.date?' has':''}" id="dl-pkdate">${state.date||'请选择日期'}<span style="color:var(--sub)">▾</span></div>`;
      body.querySelector('#dl-pkdate').onclick=()=>sheet([
        {label:'2026-07-02',onClick:()=>{state.date='2026-07-02';refresh();}},
        {label:'2026-07-03',onClick:()=>{state.date='2026-07-03';refresh();}},
        {label:'2026-07-04',onClick:()=>{state.date='2026-07-04';refresh();}}]);
      ok.disabled=!state.date;
    }else{
      body.innerHTML=`<div class="dl-warn">⚠ 选择「不需要提货」将视为放弃该批退库商品的所有权，商品进入平台销残处理，操作不可撤销。</div>
        <div class="qh">放弃原因</div><div class="dl-reason">${GIVEUP_REASONS.map((r,i)=>`<div class="dl-radio${state.reason===i?' on':''}" data-r="${i}"><span class="rc"></span><span>${r}</span></div>`).join('')}</div>`;
      body.querySelectorAll('[data-r]').forEach(e=>e.onclick=()=>{state.reason=+e.dataset.r;refresh();});
      ok.disabled=state.reason<0;
    }
  };
  m.querySelectorAll('.dl-radios .dl-radio').forEach(r=>r.onclick=()=>{
    m.querySelectorAll('.dl-radios .dl-radio').forEach(x=>x.classList.remove('on'));r.classList.add('on');
    state.need=r.dataset.v;state.date='';state.reason=-1;refresh();});
  refresh();
  m.querySelector('.x').onclick=()=>m.remove();m.onclick=e=>{if(e.target===m)m.remove();};
  ok.onclick=()=>{
    if(ok.disabled)return;
    if(state.need==='yes'){m.remove();toast('已预约 '+state.date+' 提货');}
    else confirmDialog({title:'确认放弃该批退库商品？',body:`放弃后「${no}」对应商品将进入平台销残处理，您将失去货物所有权，操作不可撤销。`,danger:1,okText:'确认放弃',onOk:()=>{m.remove();toast('已提交：放弃所有权');}});
  };
}
// 新建退库单
const RET_GOODS=[
 {ic:'🍢',nm:'[达滋味]精品油豆泡',sp:'1.5kg/组(3袋)'},
 {ic:'🥬',nm:'[鲜丰]嫩豆腐',sp:'2斤/袋'},
 {ic:'🧈',nm:'[鲜丰]老豆腐',sp:'2.5kg/盒'},
];
function openNewReturn(){
  pushPage({title:'新建退库单',body:`
    <div class="dl-sec">退库信息</div>
    <div class="dl-form">
      <div class="dl-frow"><span class="lb"><span class="req">*</span>取货仓库</span><span class="sel" id="dl-nrw">请选择 ›</span></div>
      <div class="dl-frow"><span class="lb"><span class="req">*</span>商品类型</span>
        <div class="dl-radios"><div class="dl-radio on" data-tp="成品"><span class="rc"></span>成品</div><div class="dl-radio" data-tp="包装物"><span class="rc"></span>包装物</div></div></div>
    </div>
    <div class="dl-sec">退库商品</div>
    <div class="dl-add" id="dl-nradd">＋ 添加退库商品</div>
    <div id="dl-nritems"></div>
    <div style="height:12px"></div>`,
    footer:`<div class="dl-foot2"><span class="sum">退货商品合计 <b id="dl-nrsum">0</b></span><button class="btn primary" id="dl-nrsub" disabled>提交退库单</button></div>`,
    mount:(p)=>{
      const state={ware:'',type:'成品',items:[]};
      const itemsBox=p.querySelector('#dl-nritems');
      const sum=p.querySelector('#dl-nrsum'),sub=p.querySelector('#dl-nrsub'),wsel=p.querySelector('#dl-nrw');
      const refresh=()=>{
        itemsBox.innerHTML=state.items.map((it,i)=>`<div class="dl-item"><div class="ig">${it.ic}</div><div class="it"><div class="nm">${it.nm}</div><div class="sp">售卖规格 · ${it.sp}</div></div><span class="del" data-d="${i}">移除</span></div>`).join('');
        itemsBox.querySelectorAll('[data-d]').forEach(e=>e.onclick=()=>{state.items.splice(+e.dataset.d,1);refresh();});
        sum.textContent=state.items.length;
        sub.disabled=!(state.ware&&state.items.length);
      };
      wsel.onclick=()=>sheet(['裕廊DC','兀兰DC','盛港DC','大巴窑DC','淡滨尼DC','义顺DC'].map(w=>({label:w,onClick:()=>{state.ware=w;wsel.textContent=w+' ›';wsel.classList.add('has');refresh();}})));
      p.querySelectorAll('[data-tp]').forEach(r=>r.onclick=()=>{p.querySelectorAll('[data-tp]').forEach(x=>x.classList.remove('on'));r.classList.add('on');state.type=r.dataset.tp;});
      p.querySelector('#dl-nradd').onclick=()=>{
        if(!state.ware)return toast('请先选择取货仓库');
        sheet(RET_GOODS.map(g=>({label:g.nm+'  '+g.sp,onClick:()=>{state.items.push(g);refresh();}})));
      };
      sub.onclick=()=>{const b=sub;b.classList.add('loading');setTimeout(()=>{b.classList.remove('loading');toast('退库单已提交');setTimeout(popPage,600);},700);};
    }});
}

window.FM_MOD=window.FM_MOD||{};
window.FM_MOD.signin=openSignin;
window.FM_MOD.progress=openProgress;
window.FM_MOD.return=openReturn;
})();
