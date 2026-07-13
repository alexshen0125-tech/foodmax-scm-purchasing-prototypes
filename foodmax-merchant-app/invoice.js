/* Food Max 商家端 v2 · 开票管理模块
   与 PC 端(scm_商家管理系统_全流程_交互原型.html)同一业务模型：
   ① 客户开票(按订单)：客户销售发票由【平台代商家开具】(GST 9%)，商家【无需开具/上传】，仅展示【已开具】发票，供预览/下载；客户信息脱敏；不做多客户合并。
   ② 服务费发票(平台开具)：平台在与商家结算完成后【自动开具】佣金税票(GST 9%)并推送，商家仅【查看/下载】，无需申请。
   交互形态可与 PC 不同(App 分段+卡片+推页预览)，但业务规则/字段/状态/模式与 PC 一致。 */
(function(){
const {pushPage,toast,svg,skel}=window.FM;

const css=document.createElement('style');
css.textContent=`
.iv-seg{display:flex;gap:6px;background:var(--muted);border-radius:14px;margin:10px 16px 4px;padding:4px;}
.iv-seg .s{flex:1;min-height:44px;display:flex;align-items:center;justify-content:center;font-size:14.5px;font-weight:700;color:var(--sub);border-radius:11px;cursor:pointer;}
.iv-seg .s.on{background:#fff;color:var(--emerald-2);box-shadow:var(--sh-sm);}
.iv-tip{margin:11px 16px 0;border-radius:14px;padding:12px 14px;font-size:12.5px;line-height:1.5;}
.iv-tip.cust{background:var(--mint-soft);color:#1F5641;}
.iv-tip.fm{background:var(--amber-soft);color:#92500B;}
.iv-tip b{font-weight:700;}
.iv-stat{display:flex;align-items:center;justify-content:space-between;padding:12px 18px 4px;font-size:13px;color:var(--sub);}
.iv-stat b{color:var(--ink);font-weight:700;}
.iv-list{padding:8px 16px 16px;}
/* 发票卡片(客户开票 / 服务费发票 共用) */
.iv-card{background:#fff;border-radius:18px;padding:15px;margin-bottom:12px;box-shadow:var(--sh-sm);}
.iv-card .hd{display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;}
.iv-card .hd .ord{font-size:14px;font-weight:700;color:var(--ink);word-break:break-all;}
.iv-card .hd .bd{flex:0 0 auto;margin-left:8px;font-size:11px;font-weight:700;color:var(--emerald-2);background:var(--mint-soft);border-radius:6px;padding:2px 9px;}
.iv-card .cli{font-size:12.5px;color:#46604F;margin-bottom:11px;}
.iv-card .cli b{font-weight:700;color:#27433A;}
.iv-card .g{display:flex;gap:10px;}
.iv-card .g .col{flex:1;min-width:0;}
.iv-card .g .l{font-size:11.5px;color:var(--sub);}
.iv-card .g .v{font-size:14px;font-weight:600;margin-top:2px;color:#27433A;word-break:break-all;}
.iv-card .g .v.amt{font-size:19px;font-family:'Lora',serif;color:var(--ink);}
.iv-card .ft{margin-top:11px;padding-top:10px;border-top:1px solid var(--line);display:flex;align-items:center;justify-content:space-between;font-size:11.5px;color:var(--sub);}
.iv-card .acts{display:flex;gap:8px;}
.iv-card .acts button{min-height:40px;padding:0 16px;border-radius:11px;font-size:14px;font-weight:700;font-family:inherit;cursor:pointer;}
.iv-card .acts .prev{background:#fff;border:1px solid var(--emerald);color:var(--emerald-2);}
.iv-card .acts .dl{background:var(--emerald);border:none;color:#fff;}
/* 发票预览(推页) */
.ivp{padding:16px;}
.ivp .doc{background:#fff;border:1px solid var(--line);border-radius:16px;padding:16px;box-shadow:var(--sh-sm);}
.ivp .th{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;margin-bottom:12px;}
.ivp .th .co{font-size:14px;font-weight:700;color:var(--ink);}
.ivp .th .co small{display:block;font-size:11px;color:var(--sub);font-weight:400;margin-top:2px;}
.ivp .th .ti{text-align:right;flex:0 0 auto;font-size:16px;font-weight:700;letter-spacing:.5px;color:var(--ink);}
.ivp .th .ti small{display:block;font-size:11px;color:var(--sub);font-weight:400;}
.ivp .kv{display:flex;font-size:13px;padding:6px 0;border-bottom:1px dashed var(--line);}
.ivp .kv .k{width:96px;flex:0 0 96px;color:var(--sub);}
.ivp .kv .v{flex:1;color:#27433A;word-break:break-all;}
.ivp .tot{margin-top:12px;background:var(--mint-soft);border-radius:12px;padding:10px 12px;}
.ivp .tot .r{display:flex;justify-content:space-between;font-size:13px;padding:3px 0;color:#27433A;}
.ivp .tot .r.big{font-weight:700;font-size:15px;color:var(--emerald-2);border-top:1px solid rgba(0,0,0,.07);margin-top:5px;padding-top:8px;}
.ivp .note{font-size:11.5px;color:var(--sub);margin-top:12px;line-height:1.5;}
.iv-dl{width:100%;min-height:48px;border:none;border-radius:14px;background:var(--emerald);color:#fff;font-size:16px;font-weight:700;font-family:inherit;cursor:pointer;box-shadow:0 8px 20px rgba(5,150,105,.3);}
`;
document.head.appendChild(css);

// ---- 数据(SG 本地化；金额 S$) ----
// ① 客户开票·已开具(按订单，一单对一个客户；与 PC 端 DB.invoices 对齐)
const CUST=[
  {order:'#SG20260628007',client:'海底捞（新加坡）',amt:'9820.00',no:'INV-2026-6600',date:'2026-07-01'},
  {order:'#SG20260629012',client:'食为天餐厅',amt:'7360.00',no:'INV-2026-6601',date:'2026-07-01'},
  {order:'#SG20260630021',client:'丰盛轩',amt:'6120.00',no:'INV-2026-6602',date:'2026-07-01'},
];
// ② 服务费发票·平台开具(与 PC 端 DB.svcInvoices 对齐)
const SVC=[
  {no:'SVC-INV-2026-702',billNo:'ST202605-M0815',range:'2026-05-01 ~ 05-31',fee:'1104.50',gst:'99.41',total:'1203.91',date:'2026-06-06'},
  {no:'SVC-INV-2026-701',billNo:'ST202604-M0815',range:'2026-04-01 ~ 04-30',fee:'991.25',gst:'89.21',total:'1080.46',date:'2026-05-08'},
];

// 客户信息脱敏：商家端不展示完整下单客户名(平台代开，隐私保护)，保留首字符 + **（与 PC maskClient 一致）
function maskClient(s){s=String(s||'');return s.length<=1?s:s[0]+'**';}
function fmt(v){return Number(v).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});}
function money(v){return 'S$'+fmt(v);}
function empty(t,p){return `<div class="empty"><div class="ei">${svg('invoice')}</div><h4>${t}</h4><p>${p}</p></div>`;}

function custCard(c,i){
  return `<div class="iv-card" data-i="${i}">
    <div class="hd"><span class="ord">${c.order}</span><span class="bd">已开票</span></div>
    <div class="cli">开票客户 <b>${maskClient(c.client)}</b></div>
    <div class="g">
      <div class="col"><div class="l">价税合计</div><div class="v amt">${money(c.amt)}</div></div>
      <div class="col"><div class="l">发票号</div><div class="v">${c.no}</div></div>
    </div>
    <div class="ft"><span>开票日期 ${c.date}</span><span class="acts"><button class="prev" data-prev>预览</button><button class="dl" data-dl>下载</button></span></div>
  </div>`;
}
function svcCard(s,i){
  return `<div class="iv-card" data-i="${i}">
    <div class="hd"><span class="ord">${s.no}</span><span class="bd">已开票</span></div>
    <div class="cli">结算单 <b>${s.billNo}</b> · 区间 ${s.range}</div>
    <div class="g">
      <div class="col"><div class="l">服务费(不含税)</div><div class="v">${money(s.fee)}</div></div>
      <div class="col"><div class="l">GST 9%</div><div class="v">${money(s.gst)}</div></div>
      <div class="col"><div class="l">价税合计</div><div class="v amt" style="font-size:16px">${money(s.total)}</div></div>
    </div>
    <div class="ft"><span>开票日期 ${s.date}</span><span class="acts"><button class="prev" data-prev>预览</button><button class="dl" data-dl>下载</button></span></div>
  </div>`;
}

// 发票预览(推页)：客户销售发票客户信息脱敏；服务费发票为平台就佣金开给商家
function previewPage(title,docHtml,no){
  pushPage({title,footer:`<button class="iv-dl" id="ivdl">下载发票 PDF</button>`,
    body:`<div class="ivp">${docHtml}</div>`,
    mount:(pg)=>{pg.querySelector('#ivdl').onclick=()=>toast('发票 '+no+' 已下载 (PDF)');}});
}
function previewCust(c){
  const amt=parseFloat(c.amt),sub=amt/1.09,gst=amt-sub;
  previewPage('客户销售发票',`<div class="doc">
    <div class="th"><div class="co">绿鲜源蔬果 Green Fresh Produce Pte Ltd<small>GST Reg No 202398765M</small></div><div class="ti">TAX INVOICE<small>销售发票</small></div></div>
    <div class="kv"><span class="k">发票号</span><span class="v">${c.no}</span></div>
    <div class="kv"><span class="k">开票日期</span><span class="v">${c.date}</span></div>
    <div class="kv"><span class="k">对应订单号</span><span class="v">${c.order}</span></div>
    <div class="kv"><span class="k">开票客户</span><span class="v">${maskClient(c.client)}</span></div>
    <div class="kv"><span class="k">开票方</span><span class="v">平台代商家开具 · Food Max Platform</span></div>
    <div class="tot">
      <div class="r"><span>订单商品货款（明细见对应订单）</span><span>${money(sub)}</span></div>
      <div class="r"><span>GST 9%</span><span>${money(gst)}</span></div>
      <div class="r big"><span>价税合计 Total Payable</span><span>${money(amt)}</span></div>
    </div>
    <div class="note">本发票由平台代商家就订单商品向下单客户开具；金额与订单一致，作为结算凭证。商家端客户信息已脱敏。</div>
  </div>`,c.no);
}
function previewSvc(s){
  previewPage('服务费发票',`<div class="doc">
    <div class="th"><div class="co">Food Max Platform Pte Ltd<small>平台服务佣金税票</small></div><div class="ti">TAX INVOICE<small>服务费发票</small></div></div>
    <div class="kv"><span class="k">发票号</span><span class="v">${s.no}</span></div>
    <div class="kv"><span class="k">开票日期</span><span class="v">${s.date}</span></div>
    <div class="kv"><span class="k">覆盖结算单</span><span class="v">${s.billNo}</span></div>
    <div class="kv"><span class="k">结算区间</span><span class="v">${s.range}</span></div>
    <div class="kv"><span class="k">开票方</span><span class="v">平台开具（就平台服务佣金）</span></div>
    <div class="tot">
      <div class="r"><span>服务费（不含税 / Subtotal）</span><span>${money(s.fee)}</span></div>
      <div class="r"><span>GST 9%</span><span>${money(s.gst)}</span></div>
      <div class="r big"><span>价税合计 Total</span><span>${money(s.total)}</span></div>
    </div>
    <div class="note">服务费发票由平台在与商家结算完成后自动开具并推送，就平台服务佣金开给商家；商家仅查看/下载，无需申请。</div>
  </div>`,s.no);
}

function bindCards(listEl,kind){
  listEl.querySelectorAll('.iv-card').forEach(el=>{
    const i=+el.dataset.i, item=kind==='cust'?CUST[i]:SVC[i];
    const pv=el.querySelector('[data-prev]'), dl=el.querySelector('[data-dl]');
    if(pv)pv.onclick=()=>kind==='cust'?previewCust(item):previewSvc(item);
    if(dl)dl.onclick=()=>toast('发票 '+item.no+' 已下载 (PDF)');
  });
}

function render(page){
  const seg=page.querySelector('#ivseg'), dyn=page.querySelector('#ivdyn'), st=page._st;
  seg.querySelectorAll('.s').forEach(s=>s.classList.toggle('on',s.dataset.s===st.seg));
  let head='';
  if(st.seg==='cust'){
    head=`<div class="iv-tip cust">客户销售发票由<b>平台代你开具</b>（按订单，GST 9%），你<b>无需开具或上传</b>；此处仅展示<b>已开具</b>的发票，供预览与下载。</div>
      <div class="iv-stat"><span>已开具 <b>${CUST.length}</b> 张 · 每张对应一个订单/客户</span></div>`;
  }else{
    head=`<div class="iv-tip fm">服务费发票由平台在与你<b>结算完成后自动开具</b>并推送（就平台服务佣金，GST 9%），<b>无需你申请</b>；此处仅供查看与下载。</div>
      <div class="iv-stat"><span>平台开具 · 共 <b>${SVC.length}</b> 张</span></div>`;
  }
  dyn.innerHTML=head+`<div class="iv-list" id="ivlist">${skel(3)}</div>`;
  const listEl=dyn.querySelector('#ivlist');
  // 骨架屏→数据(H1)
  setTimeout(()=>{
    if(st.seg==='cust'){
      listEl.innerHTML=CUST.length?CUST.map(custCard).join(''):empty('暂无已开具发票','平台按订单代你开具客户销售发票后，将显示在此供预览与下载');
      bindCards(listEl,'cust');
    }else{
      listEl.innerHTML=SVC.length?SVC.map(svcCard).join(''):empty('暂无服务费发票','平台与你结算完成后会开具服务费发票并显示在此');
      bindCards(listEl,'svc');
    }
  },420);
}

function open(){
  pushPage({title:'开票管理',body:`
    <div class="iv-seg" id="ivseg"><span class="s on" data-s="cust">客户开票</span><span class="s" data-s="svc">服务费发票</span></div>
    <div id="ivdyn"></div>`,
    mount:(page)=>{
      page._st={seg:'cust'};
      page.querySelectorAll('#ivseg .s').forEach(s=>s.onclick=()=>{page._st.seg=s.dataset.s;render(page);});
      render(page);
    }});
}

window.FM_MOD=window.FM_MOD||{};
window.FM_MOD.invoice=open;
})();
