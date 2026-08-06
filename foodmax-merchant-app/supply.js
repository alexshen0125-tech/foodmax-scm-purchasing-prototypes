/* Food Max 商家端 v2 · 耗材商城 + 我的耗材订单（自 PC 同步）
   PC 对齐：与 PC 商家管理系统「耗材商城 / 我的耗材订单」同口径——
   业务链：耗材订单(HC) → 耗材送货单(HS，推仓库作业) → 仓库回写已交付 → 计入当期结算单扣减项 → 平台开耗材销售发票；
   计费时点 = 送货单回写「已交付」，未交付不计费；支付方式固定 = 结算抵扣，商家无支付动作；
   价格未税/含税并列（GST 9%），下单快照单价；库存 + 限购（单次 / 每店累计）双重校验；
   耗材与经营商品完全隔离：不进商品审核流、不进对账单、不参与佣金。
   移动端形态：一屏一主任务——商城页步进器 + 底部常驻结算条（未选置灰），确认页复核后提交。金额 S$。前缀 sp-。
   商品/订单数据与 PC pc-modules/supply.js 同源同值，改一端记得同步另一端。 */
(function(){
const {pushPage,popPage,toast,confirmDialog,svg,skel}=window.FM;

const css=document.createElement('style');
css.textContent=`
.sp-seg{display:flex;gap:8px;padding:12px 16px 4px;overflow-x:auto;}
.sp-seg::-webkit-scrollbar{display:none;}
.sp-tab{flex:0 0 auto;min-height:44px;line-height:44px;padding:0 16px;font-size:13px;font-weight:700;color:var(--sub);background:var(--muted);border-radius:12px;white-space:nowrap;}
.sp-tab.on{background:var(--mint-soft);color:var(--emerald-2);}
.sp-list{padding:8px 16px 24px;}
.sp-card{background:#fff;border-radius:18px;padding:15px 16px;margin-bottom:12px;box-shadow:var(--sh-sm);}
.sp-card.out{opacity:.6;}
.sp-hd{display:flex;gap:12px;align-items:flex-start;}
.sp-ic{width:48px;height:48px;flex:0 0 48px;border-radius:14px;background:var(--mint-soft);display:flex;align-items:center;justify-content:center;font-size:24px;}
.sp-nm{font-size:14.5px;font-weight:700;color:#27433A;line-height:1.4;}
.sp-code{font-size:11px;color:var(--sub);margin-top:3px;font-family:'Lora',serif;}
.sp-spec{font-size:12px;color:var(--sub);margin-top:5px;line-height:1.5;}
.sp-price{display:flex;align-items:baseline;gap:6px;margin-top:11px;padding-top:11px;border-top:1px solid var(--line);}
.sp-p1{font-size:20px;font-weight:700;color:var(--emerald-2);font-family:'Lora',serif;}
.sp-p2{font-size:11.5px;color:var(--sub);}
.sp-meta{font-size:11.5px;color:var(--sub);margin-top:6px;line-height:1.6;}
.sp-meta .warn{color:var(--red);font-weight:700;}
.sp-ft{display:flex;align-items:center;gap:10px;margin-top:11px;}
.sp-step{display:flex;align-items:center;border:1px solid var(--line);border-radius:11px;overflow:hidden;}
.sp-step .b{width:44px;height:44px;display:flex;align-items:center;justify-content:center;font-size:19px;color:var(--sub);background:#fff;}
.sp-step .b.off{color:#C6D3CC;}
.sp-step .q{width:52px;height:44px;line-height:44px;text-align:center;font-size:15px;font-weight:700;border-left:1px solid var(--line);border-right:1px solid var(--line);}
.sp-sub{margin-left:auto;text-align:right;font-size:11.5px;color:var(--sub);}
.sp-sub b{display:block;font-size:14.5px;color:var(--emerald-2);margin-top:2px;}
.sp-pill{display:inline-block;font-size:11px;font-weight:700;padding:3px 10px;border-radius:9px;background:var(--muted);color:var(--sub);}
.sp-pill.g{background:var(--mint-soft);color:var(--emerald-2);}
.sp-pill.y{background:var(--amber-soft);color:#B45309;}
.sp-pill.r{background:var(--red-soft);color:var(--red);}
.sp-bar{display:flex;align-items:center;gap:12px;}
.sp-bar .l .k{font-size:11.5px;color:var(--sub);}
.sp-bar .l .v{font-size:21px;font-weight:700;color:var(--emerald-2);font-family:'Lora',serif;line-height:1.15;}
.sp-bar .l .s{font-size:11px;color:var(--sub);margin-top:1px;}
.sp-btn{margin-left:auto;min-height:46px;padding:0 24px;line-height:46px;border-radius:14px;background:var(--emerald);color:#fff;font-size:15px;font-weight:700;}
.sp-btn.off{background:#CBDDD4;}
.sp-row{background:#fff;margin:0 16px 12px;border-radius:18px;padding:15px 16px;box-shadow:var(--sh-sm);}
.sp-row .r1{display:flex;align-items:center;gap:8px;}
.sp-row .no{font-size:14px;font-weight:700;color:#27433A;font-family:'Lora',serif;}
.sp-row .meta{font-size:12px;color:var(--sub);margin-top:4px;line-height:1.6;}
.sp-row .r2{display:flex;align-items:flex-end;margin-top:11px;padding-top:11px;border-top:1px solid var(--line);}
.sp-row .r2 .k{font-size:11.5px;color:var(--sub);}
.sp-row .r2 .v{font-size:13.5px;font-weight:700;color:#27433A;margin-top:2px;}
.sp-row .r2 .g{flex:1;}
.sp-row .r2 .em{text-align:right;}
.sp-row .r2 .em .v{font-size:19px;color:var(--emerald-2);font-family:'Lora',serif;}
.sp-kvs{display:grid;grid-template-columns:1fr 1fr;gap:10px 12px;margin-top:11px;padding-top:11px;border-top:1px solid var(--line);}
.sp-kvs .k{font-size:11px;color:var(--sub);}
.sp-kvs .v{font-size:13px;font-weight:700;color:#27433A;margin-top:2px;}
.sp-kvs .em .v{color:var(--emerald-2);}
.sp-sec{font-size:12.5px;font-weight:700;color:var(--sub);margin:18px 16px 8px;}
.sp-dl{background:#fff;margin:0 16px 12px;border-radius:18px;padding:6px 16px;box-shadow:var(--sh-sm);}
.sp-dl .d{display:flex;gap:12px;padding:11px 0;border-bottom:1px solid var(--line);font-size:13px;}
.sp-dl .d:last-child{border-bottom:none;}
.sp-dl .d .k{color:var(--sub);flex:0 0 96px;}
.sp-dl .d .v{flex:1;text-align:right;font-weight:600;color:#27433A;word-break:break-all;}
.sp-note{margin:8px 16px 26px;font-size:11.5px;color:var(--sub);line-height:1.65;}
.sp-empty{margin:40px 16px;text-align:center;color:var(--sub);font-size:13px;line-height:1.8;}
.sp-steps{display:flex;margin:0 16px 14px;background:#fff;border-radius:18px;padding:16px 12px;box-shadow:var(--sh-sm);}
.sp-steps .st{flex:1;text-align:center;position:relative;}
.sp-steps .st .d{width:22px;height:22px;margin:0 auto;border-radius:50%;background:var(--muted);color:var(--sub);font-size:11px;font-weight:700;line-height:22px;}
.sp-steps .st.on .d,.sp-steps .st.dn .d{background:var(--emerald);color:#fff;}
.sp-steps .st .l{font-size:11px;color:var(--sub);margin-top:6px;}
.sp-steps .st.on .l{color:var(--emerald-2);font-weight:700;}
.sp-steps .st::before{content:"";position:absolute;top:11px;left:-50%;width:100%;height:2px;background:var(--line);}
.sp-steps .st:first-child::before{display:none;}
.sp-steps .st.dn::before,.sp-steps .st.on::before{background:var(--emerald);}
`;
document.head.appendChild(css);

/* ── 数据（与 PC pc-modules/supply.js 同源同值）───────────────── */
const GST=9;
const S=n=>'S$'+(+n).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
const GOODS=[
  {code:'HC-LBL-6040',name:'热敏标签纸 60×40mm',spec:'500张/卷 · 20卷/箱',unit:'箱',cat:'标签耗材',price:16.80,tax:9,stock:480,limitQty:20,limitCycle:'单次',status:'onsale',ic:'🏷️'},
  {code:'HC-LBL-8060',name:'热敏标签纸 80×60mm',spec:'350张/卷 · 20卷/箱',unit:'箱',cat:'标签耗材',price:21.50,tax:9,stock:260,limitQty:20,limitCycle:'单次',status:'onsale',ic:'🏷️'},
  {code:'HC-CLN-PEN',name:'打印头清洁笔',spec:'2支/盒',unit:'盒',cat:'标签耗材',price:6.00,tax:9,stock:0,limitQty:5,limitCycle:'单次',status:'onsale',ic:'🖊️'},
  {code:'HC-PRT-ZD230',name:'标签打印机 Zebra ZD230',spec:'热敏 · USB + 以太网',unit:'台',cat:'打印设备',price:328.00,tax:9,stock:26,limitQty:2,limitCycle:'每店累计',status:'onsale',ic:'🖨️'},
  {code:'HC-PRT-BT10',name:'便携蓝牙标签打印机',spec:'蓝牙 5.0 · 内置电池',unit:'台',cat:'打印设备',price:168.00,tax:9,stock:12,limitQty:2,limitCycle:'每店累计',status:'onsale',ic:'🖨️'},
];
const ORDERS=[
  {no:'HC20260518001',date:'2026-05-18 10:24',
   lines:[{code:'HC-PRT-ZD230',name:'标签打印机 Zebra ZD230',spec:'热敏 · USB + 以太网',unit:'台',qty:1,price:328.00,tax:9}],
   status:'settled',deliveryNo:'HS20260518001',deliveryStatus:'已交付',pushAt:'2026-05-18 10:25',deliveredAt:'2026-05-19 08:40',billNo:'ST202605-M0815',invNo:'SUP-INV-2026-501'},
  {no:'HC20260612001',date:'2026-06-12 09:06',
   lines:[{code:'HC-LBL-6040',name:'热敏标签纸 60×40mm',spec:'500张/卷 · 20卷/箱',unit:'箱',qty:6,price:16.80,tax:9},
          {code:'HC-LBL-8060',name:'热敏标签纸 80×60mm',spec:'350张/卷 · 20卷/箱',unit:'箱',qty:2,price:21.50,tax:9}],
   status:'delivered',deliveryNo:'HS20260612001',deliveryStatus:'已交付',pushAt:'2026-06-12 09:07',deliveredAt:'2026-06-13 07:20',billNo:'',invNo:'SUP-INV-2026-502'},
  {no:'HC20260628001',date:'2026-06-28 16:41',
   lines:[{code:'HC-LBL-6040',name:'热敏标签纸 60×40mm',spec:'500张/卷 · 20卷/箱',unit:'箱',qty:10,price:16.80,tax:9}],
   status:'pending',deliveryNo:'HS20260628001',deliveryStatus:'待处理',pushAt:'2026-06-28 16:42',deliveredAt:'',billNo:'',invNo:''},
];
const BILL_NO='ST202606-M0815';                       // 当期结算单（与 PC DB.bill 同源）
const CART={};                                        // code -> qty
let SEQ=2, GTAB='all', OTAB='all';

/* ── 口径计算（与 PC 逐条一致）──────────────────────────── */
const tOf   = x => (x.tax==null?GST:x.tax);
const incl  = x => +(x.price*(1+tOf(x)/100)).toFixed(2);
const lnNet = l => +(l.qty*l.price).toFixed(2);
const lnInc = l => +(l.qty*incl(l)).toFixed(2);
const odNet = o => +(o.lines.reduce((a,l)=>a+lnNet(l),0)).toFixed(2);
const odInc = o => +(o.lines.reduce((a,l)=>a+lnInc(l),0)).toFixed(2);
const odQty = o => o.lines.reduce((a,l)=>a+l.qty,0);
const gOf   = c => GOODS.find(g=>g.code==c)||{};
const ST={pending:['待送货','y'],shipping:['送货中','g'],delivered:['已交付','g'],settled:['已结算',''],canceled:['已取消','']};
const OTABS=[['all','全部'],['pending','待送货'],['shipping','送货中'],['delivered','已交付'],['settled','已结算'],['canceled','已取消']];
function stPill(s){const[t,c]=ST[s]||['—',''];return `<span class="sp-pill ${c}">${t}</span>`;}
function dPill(s){const c={'待处理':'y','已推送':'g','已交付':'g','已作废':''}[s]||'';return `<span class="sp-pill ${c}">${s}</span>`;}
function bought(code){return ORDERS.filter(o=>o.status!='canceled').reduce((a,o)=>a+o.lines.filter(l=>l.code==code).reduce((b,l)=>b+l.qty,0),0);}
function maxQty(g){
  const byLimit=g.limitCycle=='每店累计'?Math.max(0,g.limitQty-bought(g.code)):g.limitQty;
  return Math.min(Math.max(0,g.stock),byLimit);
}
function limitText(g){
  if(g.limitCycle=='每店累计'){const b=bought(g.code);return `每店累计限购 ${g.limitQty}${g.unit} · 已购 ${b}${g.unit} · 剩余 ${Math.max(0,g.limitQty-b)}${g.unit}`;}
  return `单次限购 ${g.limitQty}${g.unit}`;
}
const cartLines=()=>Object.keys(CART).filter(c=>CART[c]>0).map(c=>{const g=gOf(c);
  return {code:c,name:g.name,spec:g.spec,unit:g.unit,qty:CART[c],price:g.price,tax:tOf(g)};});
const cartNet=()=>+(cartLines().reduce((a,l)=>a+lnNet(l),0)).toFixed(2);
const cartInc=()=>+(cartLines().reduce((a,l)=>a+lnInc(l),0)).toFixed(2);
function nowTs(){const d=new Date(),p=n=>(''+n).padStart(2,'0');
  return d.getFullYear()+'-'+p(d.getMonth()+1)+'-'+p(d.getDate())+' '+p(d.getHours())+':'+p(d.getMinutes());}

/* ── 商城 ─────────────────────────────────────────────── */
function cardHTML(g){
  const mx=maxQty(g),q=CART[g.code]||0,out=g.stock<=0,lim=mx<=0&&!out;
  return `<div class="sp-card ${out||lim?'out':''}" data-code="${g.code}">
    <div class="sp-hd"><div class="sp-ic">${g.ic}</div>
      <div style="min-width:0;flex:1">
        <div class="sp-nm">${g.name}</div>
        <div class="sp-code">${g.code} · ${g.cat}</div>
        <div class="sp-spec">${g.spec}</div>
      </div></div>
    <div class="sp-price"><span class="sp-p1">${S(g.price)}</span><span class="sp-p2">/${g.unit}（未税）</span></div>
    <div class="sp-p2" style="margin-top:3px">含税 ${S(incl(g))}/${g.unit} · GST ${tOf(g)}%</div>
    <div class="sp-meta">${out?`库存 0${g.unit}`:`可下单 ${mx}${g.unit}（库存 ${g.stock}${g.unit}）`}<br>${limitText(g)}</div>
    <div class="sp-ft">
      ${out?'<span class="sp-pill">暂时缺货</span>'
        :lim?'<span class="sp-pill y">已达限购上限</span>'
        :`<div class="sp-step">
            <div class="b minus ${q<=0?'off':''}">−</div>
            <div class="q">${q}</div>
            <div class="b plus ${q>=mx?'off':''}">＋</div>
          </div>
          <div class="sp-sub">小计（含税）<b>${S(+(q*incl(g)).toFixed(2))}</b></div>`}
    </div></div>`;
}
function barHTML(){
  const ls=cartLines(),n=ls.length,q=ls.reduce((a,l)=>a+l.qty,0);
  return `<div class="sp-bar">
    <div class="l"><div class="k">本次采购 ${n} 种 · ${q} 件</div>
      <div class="v">${S(cartInc())}</div>
      <div class="s">未税 ${S(cartNet())} · 本期结算单按含税金额扣减</div></div>
    <div class="sp-btn ${n?'':'off'}" id="sp-go">提交采购单</div></div>`;
}
function openShop(){
  const cats=['all',...new Set(GOODS.filter(g=>g.status=='onsale').map(g=>g.cat))];
  pushPage({title:'耗材商城',subtitle:'平台统一供应',
    body:`<div class="sp-seg">${cats.map(c=>`<div class="sp-tab ${GTAB==c?'on':''}" data-c="${c}">${c=='all'?'全部':c}</div>`).join('')}</div><div id="sp-l">${skel(3)}</div>`,
    footer:barHTML(),
    mount:(p)=>{
      const paint=()=>{
        const list=GOODS.filter(g=>g.status=='onsale').filter(g=>GTAB=='all'||g.cat==GTAB);
        const box=p.querySelector('#sp-l');
        box.innerHTML=list.length?`<div class="sp-list">${list.map(cardHTML).join('')}</div>`
          :`<div class="sp-empty">该类别暂无可购耗材<br>耗材由平台运营统一维护上架</div>`;
        box.querySelectorAll('.sp-card').forEach(c=>{
          const code=c.dataset.code,g=gOf(code),mx=maxQty(g);
          const step=(d)=>{let q=(CART[code]||0)+d;
            if(q<0)q=0;
            if(q>mx){toast(`「${g.name}」最多可下单 ${mx}${g.unit}`);q=mx;}
            CART[code]=q;paint();};
          const m=c.querySelector('.minus'),pl=c.querySelector('.plus');
          if(m)m.onclick=()=>step(-1);
          if(pl)pl.onclick=()=>step(1);
        });
        const ft=p.querySelector('.page-footer');
        if(ft){ft.innerHTML=barHTML();
          const go=ft.querySelector('#sp-go');
          go.onclick=()=>{if(!cartLines().length){toast('请先选择要采购的耗材');return;}openConfirm();};}
      };
      setTimeout(paint,420);
      p.querySelectorAll('.sp-tab').forEach(t=>t.onclick=()=>{
        GTAB=t.dataset.c;p.querySelectorAll('.sp-tab').forEach(x=>x.classList.toggle('on',x===t));paint();});
    }});
}

/* ── 提交确认 ─────────────────────────────────────────── */
function openConfirm(){
  const ls=cartLines();
  pushPage({title:'确认采购单',
    body:`${ls.map(l=>`<div class="sp-row">
        <div class="r1"><span class="no">${l.name}</span></div>
        <div class="meta">${l.spec} · ${l.code}</div>
        <div class="sp-kvs">
          <div><div class="k">数量</div><div class="v">${l.qty}${l.unit}</div></div>
          <div><div class="k">未税单价</div><div class="v">${S(l.price)}</div></div>
          <div><div class="k">含税单价</div><div class="v">${S(incl(l))}</div></div>
          <div class="em"><div class="k">小计（含税）</div><div class="v">${S(lnInc(l))}</div></div>
        </div></div>`).join('')}
      <div class="sp-sec">结算方式</div>
      <div class="sp-dl">
        <div class="d"><span class="k">支付方式</span><span class="v">结算抵扣 · 无需付款</span></div>
        <div class="d"><span class="k">扣款时点</span><span class="v">送货单回写已交付后</span></div>
        <div class="d"><span class="k">当期结算单</span><span class="v">${BILL_NO}</span></div>
        <div class="d"><span class="k">合计（未税）</span><span class="v">${S(cartNet())}</span></div>
        <div class="d"><span class="k">合计（含税）</span><span class="v" style="color:var(--emerald-2);font-size:16px">${S(cartInc())}</span></div>
      </div>
      <div class="sp-note">提交后自动生成耗材送货单并推送仓库作业；仓库回写「已交付」后按含税金额计入当期结算单扣减项，与货款轧差。未交付前可取消。</div>`,
    footer:`<div class="sp-bar"><div class="l"><div class="k">应扣（含税）</div><div class="v">${S(cartInc())}</div></div>
      <div class="sp-btn" id="sp-submit">确认提交</div></div>`,
    mount:(p)=>{
      p.querySelector('#sp-submit').onclick=()=>{
        const btn=p.querySelector('#sp-submit');btn.classList.add('off');btn.textContent='提交中…';
        setTimeout(()=>{
          const seq=String(++SEQ).padStart(3,'0'),d='20260630';
          const o={no:'HC'+d+seq,date:nowTs(),lines:ls.map(l=>({...l})),status:'pending',
            deliveryNo:'HS'+d+seq,deliveryStatus:'待处理',pushAt:nowTs(),deliveredAt:'',billNo:'',invNo:''};
          ORDERS.unshift(o);
          ls.forEach(l=>{const g=gOf(l.code);g.stock=Math.max(0,g.stock-l.qty);});
          Object.keys(CART).forEach(k=>delete CART[k]);
          popPage();popPage();OTAB='all';openOrders();
          toast(`采购单 ${o.no} 已提交，送货单已推送仓库`);
        },600);
      };
    }});
}

/* ── 我的耗材订单 ─────────────────────────────────────── */
function openOrders(){
  const cnt=k=>k=='all'?ORDERS.length:ORDERS.filter(o=>o.status==k).length;
  const unbilled=ORDERS.filter(o=>o.status=='delivered');
  const unAmt=+(unbilled.reduce((a,o)=>a+odInc(o),0)).toFixed(2);
  pushPage({title:'我的耗材订单',right:`<span style="font-size:13px;color:var(--emerald-2);font-weight:700" id="sp-buy">去采购</span>`,
    body:`<div class="sp-row" style="margin-top:12px">
        <div class="r1"><span class="no">待计入当期结算</span>${unbilled.length?`<span class="sp-pill y">${unbilled.length} 单已交付</span>`:''}</div>
        <div class="meta">结算单 ${BILL_NO} · 按含税金额扣减</div>
        <div class="r2"><div class="g"><div class="k">在途订单</div><div class="v">${ORDERS.filter(o=>o.status=='pending'||o.status=='shipping').length} 单</div></div>
          <div class="g em"><div class="k">待扣金额（含税）</div><div class="v">${S(unAmt)}</div></div></div></div>
      <div class="sp-seg">${OTABS.map(t=>`<div class="sp-tab ${OTAB==t[0]?'on':''}" data-t="${t[0]}">${t[1]}${cnt(t[0])?' '+cnt(t[0]):''}</div>`).join('')}</div>
      <div id="sp-ol">${skel(3)}</div>`,
    mount:(p)=>{
      const paint=()=>{
        const sorted=[...ORDERS].sort((a,b)=>b.date.localeCompare(a.date));
        const list=OTAB=='all'?sorted:sorted.filter(o=>o.status==OTAB);
        const box=p.querySelector('#sp-ol');
        box.innerHTML=list.length?`<div style="padding-top:8px">${list.map(o=>`<div class="sp-row" data-no="${o.no}">
            <div class="r1"><span class="no">${o.no}</span>${stPill(o.status)}</div>
            <div class="meta">${o.date} · ${odQty(o)} 件<br>${o.lines.map(l=>`${l.name} ${l.qty}${l.unit}`).join('、')}</div>
            <div class="r2"><div class="g"><div class="k">送货单 ${o.deliveryNo}</div><div class="v" style="font-size:12.5px">${o.deliveryStatus}${o.deliveredAt?' · '+o.deliveredAt:''}</div></div>
              <div class="g em"><div class="k">金额（含税）</div><div class="v">${S(odInc(o))}</div></div></div></div>`).join('')}</div>`
          :`<div class="sp-empty">该状态暂无耗材采购单<br>去耗材商城选购标签纸与打印机</div>`;
        box.querySelectorAll('.sp-row').forEach(r=>r.onclick=()=>openOrderDetail(r.dataset.no));
      };
      setTimeout(paint,420);
      p.querySelectorAll('.sp-tab').forEach(t=>t.onclick=()=>{
        OTAB=t.dataset.t;p.querySelectorAll('.sp-tab').forEach(x=>x.classList.toggle('on',x===t));paint();});
      const buy=p.querySelector('#sp-buy');if(buy)buy.onclick=openShop;
    }});
}

/* ── 订单详情：订单单据 / 送货单据 / 结算与开票 ──────────── */
function openOrderDetail(no){
  const o=ORDERS.find(x=>x.no==no);if(!o)return;
  const steps=['提交','推仓库','已交付','计入结算'];
  const idx=o.status=='canceled'?0:(o.status=='pending'?1:o.status=='shipping'?2:o.status=='delivered'?3:4);
  pushPage({title:'耗材采购单',
    body:`${o.status=='canceled'?'<div class="sp-note" style="margin-top:16px">本单已取消，不产生扣款。</div>'
      :`<div class="sp-steps" style="margin-top:14px">${steps.map((s,i)=>`<div class="st ${i<idx?'dn':i==idx?'on':''}"><div class="d">${i<idx?'✓':i+1}</div><div class="l">${s}</div></div>`).join('')}</div>`}
      <div class="sp-row">
        <div class="r1"><span class="no">${o.no}</span>${stPill(o.status)}</div>
        <div class="meta">${o.date}</div>
        <div class="sp-kvs">
          <div><div class="k">金额（未税）</div><div class="v">${S(odNet(o))}</div></div>
          <div><div class="k">GST ${tOf(o.lines[0])}%</div><div class="v">${S(+(odInc(o)-odNet(o)).toFixed(2))}</div></div>
          <div class="em"><div class="k">金额（含税）</div><div class="v">${S(odInc(o))}</div></div>
          <div><div class="k">件数</div><div class="v">${odQty(o)} 件</div></div>
        </div></div>

      <div class="sp-sec">① 订单单据 · 耗材明细</div>
      ${o.lines.map(l=>`<div class="sp-row">
        <div class="r1"><span class="no">${l.name}</span></div>
        <div class="meta">${l.spec} · ${l.code}</div>
        <div class="sp-kvs">
          <div><div class="k">数量</div><div class="v">${l.qty}${l.unit}</div></div>
          <div><div class="k">未税单价</div><div class="v">${S(l.price)}</div></div>
          <div><div class="k">含税单价</div><div class="v">${S(incl(l))}</div></div>
          <div class="em"><div class="k">小计（含税）</div><div class="v">${S(lnInc(l))}</div></div>
        </div></div>`).join('')}

      <div class="sp-sec">② 送货单据 · 推仓库作业</div>
      <div class="sp-dl">
        <div class="d"><span class="k">送货单号</span><span class="v">${o.deliveryNo}</span></div>
        <div class="d"><span class="k">单据类型</span><span class="v">耗材出库（平台仓 → 商家）</span></div>
        <div class="d"><span class="k">推送时间</span><span class="v">${o.pushAt||'—'}</span></div>
        <div class="d"><span class="k">送货单状态</span><span class="v">${dPill(o.deliveryStatus)}</span></div>
        <div class="d"><span class="k">交付确认</span><span class="v">${o.deliveredAt||'—'}</span></div>
      </div>

      <div class="sp-sec">③ 结算与开票</div>
      <div class="sp-dl">
        <div class="d"><span class="k">支付方式</span><span class="v">结算抵扣 · 无需付款</span></div>
        <div class="d"><span class="k">计费时点</span><span class="v">${o.deliveredAt?'交付确认 '+o.deliveredAt:'待交付确认后计费'}</span></div>
        <div class="d"><span class="k">计入结算单</span><span class="v">${o.billNo?o.billNo+' · 已结清':(o.status=='delivered'?BILL_NO+' · 当期扣 '+S(odInc(o)):'—')}</span></div>
        <div class="d"><span class="k">耗材发票</span><span class="v">${o.invNo?o.invNo+' · 已开票':'交付确认后由平台开具'}</span></div>
      </div>
      <div class="sp-note">耗材款不进对账单、不参与佣金计算；按含税金额作为结算单扣减项，与当期货款轧差。当期应清算不足以覆盖时，差额结转下期继续扣。</div>`,
    footer:o.status=='pending'?`<div class="sp-bar"><div class="l"><div class="k">未交付可取消</div><div class="v" style="font-size:16px">${S(odInc(o))}</div></div>
      <div class="sp-btn" id="sp-cancel" style="background:var(--red)">取消采购单</div></div>`:'',
    mount:(p)=>{
      const c=p.querySelector('#sp-cancel');
      if(c)c.onclick=()=>confirmDialog({danger:1,title:'取消采购单',
        body:`取消后送货单 ${o.deliveryNo} 同步作废、库存退回，本单不产生扣款。`,okText:'确认取消',
        onOk:()=>{o.status='canceled';o.deliveryStatus='已作废';
          o.lines.forEach(l=>{const g=gOf(l.code);if(g.code)g.stock+=l.qty;});
          popPage();popPage();openOrders();toast(`${o.no} 已取消`);}});
    }});
}

window.FM_MOD=window.FM_MOD||{};
window.FM_MOD.supply=openShop;
window.FM_MOD.supplyorder=openOrders;
})();
