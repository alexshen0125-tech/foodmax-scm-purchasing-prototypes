/* Food Max 商家端 v2 · 对账单模块（商家视角·只读）
   PC 对齐：与 PC 商家管理系统「财务 › 对账单」同口径——
   对账单即送货单（不另编号，单号=送货单号）：每天一张、一个入库仓库；
   当日结算金额 = 实发金额 − 判给商家的售后金额（未税/含税各算一套，含税单价 = 未税单价 ×(1+税率)，默认 GST 9%）；
   全为标品、按整件对账（应发=送货单下单/预约件数，实发=仓库签收入库件数），不涉及重量差额；
   明细三个页签：SKU 维度 / 订单维度 / 售后明细。金额 S$。 */
(function(){
const {pushPage,popPage,toast,svg,skel}=window.FM;

const css=document.createElement('style');
css.textContent=`
.rc-sum{margin:0 16px 13px;background:#fff;border-radius:18px;padding:15px 16px;box-shadow:var(--sh-sm);}
.rc-sum .big{font-size:28px;font-weight:700;color:var(--emerald-2);margin:2px 0 3px;}
.rc-sum .big .c{font-size:17px;opacity:.8;margin-right:2px;}
.rc-sum .lbl{font-size:12px;color:var(--sub);}
.rc-sum .grid{display:grid;grid-template-columns:1fr 1fr;gap:11px 12px;margin-top:12px;padding-top:12px;border-top:1px solid var(--line);}
.rc-sum .grid .k{font-size:11.5px;color:var(--sub);}
.rc-sum .grid .v{font-size:14px;font-weight:700;color:#27433A;margin-top:3px;}
.rc-list{padding:0 16px 24px;}
.rc-card{background:#fff;border-radius:18px;padding:15px 16px;margin-bottom:12px;box-shadow:var(--sh-sm);cursor:pointer;min-height:44px;}
.rc-card .r1{display:flex;align-items:center;gap:8px;}
.rc-card .no{font-size:14px;font-weight:700;color:#27433A;font-family:'Lora',serif;}
.rc-card .wh{font-size:11px;font-weight:700;padding:2px 9px;border-radius:8px;background:var(--muted);color:var(--sub);}
.rc-card .meta{font-size:12px;color:var(--sub);margin-top:4px;}
.rc-card .r2{display:flex;align-items:flex-end;margin-top:11px;padding-top:11px;border-top:1px solid var(--line);}
.rc-card .r2 .k{font-size:11.5px;color:var(--sub);}
.rc-card .r2 .v{font-size:13.5px;font-weight:700;color:#27433A;margin-top:2px;}
.rc-card .r2 .g{flex:1;}
.rc-card .r2 .settle{text-align:right;}
.rc-card .r2 .settle .v{font-size:19px;color:var(--emerald-2);}
.rc-neg{color:var(--red);}
/* 详情 */
.rc-tabs{display:flex;gap:8px;padding:12px 16px 4px;}
.rc-tab{flex:1;text-align:center;min-height:44px;line-height:44px;font-size:13px;font-weight:700;color:var(--sub);background:var(--muted);border-radius:12px;}
.rc-tab.on{background:var(--mint-soft);color:var(--emerald-2);}
.rc-row{background:#fff;margin:0 16px 10px;border-radius:16px;padding:14px 15px;box-shadow:var(--sh-sm);}
.rc-row .t{font-size:13.5px;font-weight:700;color:#27433A;}
.rc-row .s{font-size:11.5px;color:var(--sub);margin-top:3px;}
.rc-row .kvs{display:grid;grid-template-columns:1fr 1fr;gap:9px 12px;margin-top:10px;padding-top:10px;border-top:1px solid var(--line);}
.rc-row .kvs .k{font-size:11px;color:var(--sub);}
.rc-row .kvs .v{font-size:13px;font-weight:700;color:#27433A;margin-top:2px;}
.rc-row .kvs .em .v{color:var(--emerald-2);}
.rc-row .jd{display:inline-block;font-size:11px;font-weight:700;padding:2px 9px;border-radius:8px;background:var(--red-soft);color:var(--red);margin-top:6px;}
.rc-empty{margin:24px 16px;text-align:center;color:var(--sub);font-size:12.5px;line-height:1.7;}
.rc-note{margin:6px 16px 24px;font-size:11.5px;color:var(--sub);line-height:1.6;}
`;
document.head.appendChild(css);

/* 与 PC 原型 RECON 同源同值（改一端记得同步另一端） */
const RECON=[
  {date:'2026-07-01',no:'SH20260701001',wh:'裕廊DC',lines:[
    {sku:'SKU8801',name:'小棠菜',spec:'1kg/件',unit:'件',price:3.80,due:20,real:18,byOrder:[['#SG20260701001','海****',12,11],['#SG20260701004','金****',8,7]]},
    {sku:'SKU8802',name:'白菜',spec:'1kg/件',unit:'件',price:2.60,due:10,real:10,byOrder:[['#SG20260701001','海****',6,6],['#SG20260701004','金****',4,4]]},
    {sku:'SKU8804',name:'空心菜',spec:'1kg/件',unit:'件',price:3.20,due:30,real:28,byOrder:[['#SG20260701002','新****',18,17],['#SG20260701004','金****',12,11]]},
    {sku:'SKU8806',name:'土豆',spec:'2kg/件',unit:'件',price:4.50,due:16,real:16,byOrder:[['#SG20260701002','新****',10,10],['#SG20260701001','海****',6,6]]},
  ],after:[
    {id:'AS20260701003',order:'#SG20260701001',sku:'SKU8801',qty:1,judge:'商家责任 · 叶片腐烂',type:'仅退款'},
    {id:'AS20260701007',order:'#SG20260701004',sku:'SKU8804',qty:2,judge:'商家责任 · 少发',type:'仅退款'},
  ]},
  {date:'2026-06-30',no:'SH20260630001',wh:'裕廊DC',lines:[
    {sku:'SKU8803',name:'菠菜',spec:'1kg/件',unit:'件',price:4.10,due:12,real:11,byOrder:[['#SG20260630001','福****',12,11]]},
    {sku:'SKU8805',name:'胡萝卜',spec:'1kg/件',unit:'件',price:2.20,due:25,real:25,byOrder:[['#SG20260630001','福****',15,15],['#SG20260630004','恒****',10,10]]},
    {sku:'SKU8807',name:'鸡蛋',spec:'30枚/盘',unit:'盘',price:6.80,due:20,real:19,byOrder:[['#SG20260630004','恒****',20,19]]},
  ],after:[
    {id:'AS20260630004',order:'#SG20260630004',sku:'SKU8807',qty:1,judge:'商家责任 · 破损',type:'退货退款'},
  ]},
  {date:'2026-06-29',no:'SH20260629001',wh:'裕廊DC',lines:[
    {sku:'SKU8801',name:'小棠菜',spec:'1kg/件',unit:'件',price:3.80,due:18,real:18,byOrder:[['#SG20260629002','悦****',10,10],['#SG20260629005','丰****',8,8]]},
    {sku:'SKU8808',name:'豆腐',spec:'400g/盒',unit:'盒',price:1.40,due:40,real:38,byOrder:[['#SG20260629002','悦****',25,24],['#SG20260629005','丰****',15,14]]},
  ],after:[]},
];
const GST=9;                                                          // 默认税率 GST 9%
const S=n=>'S$'+n.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
const NEG=n=>n?`<span class="rc-neg">-${S(n)}</span>`:S(0);
const rcTax=l=>(l.tax==null?GST:l.tax);
const rcMul=l=>1+rcTax(l)/100;
const rcLine=(d,sku)=>d.lines.find(l=>l.sku==sku)||{price:0,name:sku,unit:'件',spec:''};
const rcReal =d=>d.lines.reduce((a,l)=>a+l.real*l.price,0);
const rcRealG=d=>d.lines.reduce((a,l)=>a+l.real*l.price*rcMul(l),0);
const rcAft  =d=>(d.after||[]).reduce((a,x)=>a+x.qty*rcLine(d,x.sku).price,0);
const rcAftG =d=>(d.after||[]).reduce((a,x)=>{const l=rcLine(d,x.sku);return a+x.qty*l.price*rcMul(l);},0);
const rcNet  =d=>rcReal(d)-rcAft(d);
const rcNetG =d=>rcRealG(d)-rcAftG(d);
const rcOrders=d=>[...new Set(d.lines.flatMap(l=>l.byOrder.map(o=>o[0])))];
const rcAftByOrd =(d,id)=>(d.after||[]).filter(x=>x.order==id).reduce((a,x)=>a+x.qty*rcLine(d,x.sku).price,0);
const rcAftByOrdG=(d,id)=>(d.after||[]).filter(x=>x.order==id).reduce((a,x)=>{const l=rcLine(d,x.sku);return a+x.qty*l.price*rcMul(l);},0);

/* ── 列表：每天一张对账单 ─────────────────────────────── */
function openRecon(){
  const rows=[...RECON].sort((a,b)=>b.date.localeCompare(a.date));
  const sReal=rows.reduce((a,d)=>a+rcReal(d),0), sRealG=rows.reduce((a,d)=>a+rcRealG(d),0);
  const sAft =rows.reduce((a,d)=>a+rcAft(d),0),  sAftG =rows.reduce((a,d)=>a+rcAftG(d),0);
  const sNet =rows.reduce((a,d)=>a+rcNet(d),0),  sNetG =rows.reduce((a,d)=>a+rcNetG(d),0);
  pushPage({title:'对账单',body:`
    <div class="rc-sum">
      <div class="lbl">近 7 天 · 结算金额合计（未税）</div>
      <div class="big disp"><span class="c">S$</span>${sNet.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}</div>
      <div class="lbl">含税 ${S(sNetG)}</div>
      <div class="grid">
        <div><div class="k">实发金额（未税）</div><div class="v">${S(sReal)}</div></div>
        <div><div class="k">实发金额（含税）</div><div class="v">${S(sRealG)}</div></div>
        <div><div class="k">判给商家的售后金额（未税）</div><div class="v">${NEG(sAft)}</div></div>
        <div><div class="k">判给商家的售后金额（含税）</div><div class="v">${NEG(sAftG)}</div></div>
      </div>
    </div>
    <div id="rcl">${skel(3)}</div>`,
    mount:(p)=>{
      setTimeout(()=>{
        const box=p.querySelector('#rcl');if(!box)return;
        box.innerHTML=`<div class="rc-list">${rows.map(d=>{
          const os=rcOrders(d),nAf=(d.after||[]).length;
          return `<div class="rc-card" data-no="${d.no}">
            <div class="r1"><span class="no">${d.no}</span><span class="wh">${d.wh}</span></div>
            <div class="meta">${d.date} · ${os.length} 个订单 · ${d.lines.length} 个 SKU${nAf?` · 售后 ${nAf} 笔`:''}</div>
            <div class="r2">
              <div class="g"><div class="k">实发金额（未税 / 含税）</div><div class="v">${S(rcReal(d))} / ${S(rcRealG(d))}</div></div>
              <div class="g settle"><div class="k">当日结算（未税）</div><div class="v">${S(rcNet(d))}</div><div class="k" style="margin-top:2px">含税 ${S(rcNetG(d))}</div></div>
            </div></div>`;}).join('')}</div>`;
        box.querySelectorAll('.rc-card').forEach(c=>c.onclick=()=>openReconDetail(c.dataset.no));
      },420);
    }});
}

/* ── 详情：SKU 维度 / 订单维度 / 售后明细 ───────────────── */
function openReconDetail(no,tab){
  const d=RECON.find(x=>x.no==no);if(!d)return;
  tab=tab||'sku';
  const re=rcReal(d),reG=rcRealG(d),af=rcAft(d),afG=rcAftG(d),ne=rcNet(d),neG=rcNetG(d);
  const aft=(d.after||[]);
  const skuRows=d.lines.map(l=>`<div class="rc-row">
      <div class="t">${l.name} <span style="font-weight:400;color:var(--sub);font-size:12px">${l.spec}</span></div>
      <div class="s">${l.sku} · 税率 ${rcTax(l)}%</div>
      <div class="kvs">
        <div><div class="k">未税单价</div><div class="v">${S(l.price)}/${l.unit}</div></div>
        <div><div class="k">含税单价</div><div class="v">${S(l.price*rcMul(l))}/${l.unit}</div></div>
        <div><div class="k">应发件数</div><div class="v">${l.due}${l.unit}</div></div>
        <div><div class="k">实发件数</div><div class="v">${l.real}${l.unit}</div></div>
        <div class="em"><div class="k">实发金额（未税）</div><div class="v">${S(l.real*l.price)}</div></div>
        <div class="em"><div class="k">实发金额（含税）</div><div class="v">${S(l.real*l.price*rcMul(l))}</div></div>
      </div></div>`).join('');
  const ordRows=rcOrders(d).map(id=>{
    const nm=(d.lines.flatMap(l=>l.byOrder).find(o=>o[0]==id)||[])[1]||'';
    let oReal=0,oRealG=0,n=0;
    d.lines.forEach(l=>l.byOrder.filter(o=>o[0]==id).forEach(o=>{oReal+=o[3]*l.price;oRealG+=o[3]*l.price*rcMul(l);n++;}));
    const oAf=rcAftByOrd(d,id),oAfG=rcAftByOrdG(d,id);
    return `<div class="rc-row">
      <div class="t">${id}</div>
      <div class="s">${nm} · ${n} 个 SKU</div>
      <div class="kvs">
        <div><div class="k">实发金额（未税）</div><div class="v">${S(oReal)}</div></div>
        <div><div class="k">实发金额（含税）</div><div class="v">${S(oRealG)}</div></div>
        <div><div class="k">售后金额（未税）</div><div class="v">${NEG(oAf)}</div></div>
        <div><div class="k">售后金额（含税）</div><div class="v">${NEG(oAfG)}</div></div>
        <div class="em"><div class="k">结算金额（未税）</div><div class="v">${S(oReal-oAf)}</div></div>
        <div class="em"><div class="k">结算金额（含税）</div><div class="v">${S(oRealG-oAfG)}</div></div>
      </div></div>`;}).join('');
  const aftRows=aft.length?aft.map(x=>{const l=rcLine(d,x.sku);return `<div class="rc-row">
      <div class="t">${l.name} <span style="font-weight:400;color:var(--sub);font-size:12px">${x.qty}${l.unit} · ${x.type}</span></div>
      <div class="s">${x.id} · ${x.order} · ${x.sku}</div>
      <div class="jd">${x.judge}</div>
      <div class="kvs">
        <div><div class="k">售后金额（未税）</div><div class="v">${NEG(x.qty*l.price)}</div></div>
        <div><div class="k">售后金额（含税）</div><div class="v">${NEG(x.qty*l.price*rcMul(l))}</div></div>
      </div></div>`;}).join('')
    :`<div class="rc-empty">当日无判给商家的售后<br>客诉判责结果为平台/客户承担的部分不进本对账单</div>`;
  pushPage({title:'对账单详情',body:`
    <div class="rc-sum">
      <div class="lbl">${d.no} · ${d.date} · ${d.wh}</div>
      <div class="lbl" style="margin-top:6px">当日结算金额（未税）</div>
      <div class="big disp"><span class="c">S$</span>${ne.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}</div>
      <div class="lbl">含税 ${S(neG)}</div>
      <div class="grid">
        <div><div class="k">实发金额（未税）</div><div class="v">${S(re)}</div></div>
        <div><div class="k">实发金额（含税）</div><div class="v">${S(reG)}</div></div>
        <div><div class="k">判给商家的售后金额（未税）</div><div class="v">${NEG(af)}</div></div>
        <div><div class="k">判给商家的售后金额（含税）</div><div class="v">${NEG(afG)}</div></div>
      </div>
    </div>
    <div class="rc-tabs">
      <div class="rc-tab ${tab=='sku'?'on':''}" data-t="sku">SKU 维度</div>
      <div class="rc-tab ${tab=='order'?'on':''}" data-t="order">订单维度</div>
      <div class="rc-tab ${tab=='after'?'on':''}" data-t="after">售后${aft.length?` ${aft.length}`:''}</div>
    </div>
    ${tab=='sku'?skuRows:tab=='order'?ordRows:aftRows}
    <div class="rc-note">当日结算金额 = 实发金额 − 判给商家的售后金额；实发金额 = Σ(实发件数 × 单价)，未税用未税单价、含税用含税单价（含税单价 = 未税单价 ×(1+税率)，默认 GST ${GST}%）。全为标品、按整件对账：应发件数取送货单下单/预约数量，实发件数取仓库签收入库件数（送货单「已入库数量」），不产生重量差额。售后金额只计客诉判责为商家承担的部分，按售后件数 × 该 SKU 单价计。对账单即送货单，每天一张、一个入库仓库；各日对账单按结算周期汇总并入结算单。</div>`,
    mount:(p)=>{
      p.querySelectorAll('.rc-tab').forEach(t=>t.onclick=()=>{if(t.dataset.t==tab)return;popPage();openReconDetail(no,t.dataset.t);});
    }});
}

window.FM_MOD=window.FM_MOD||{};
window.FM_MOD.recon=openRecon;
})();
