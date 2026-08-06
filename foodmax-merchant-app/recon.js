/* Food Max 商家端 v2 · 对账单模块（商家视角·只读）
   PC 对齐：与 PC 商家管理系统「财务 › 对账单」同口径——
   每天一张对账单、一个入库仓库 → 对应当日一张送货单；
   当日结算金额 = Σ(实发件数 × 未税单价)，差异 = 实发件数 − 应发件数（+多发 / −少发）；
   全为标品、按整件对账（应发=送货单下单/预约件数，实发=仓库签收入库件数），不涉及重量差额；
   金额未税/含税并列（默认 GST 9%）。明细两个维度：SKU 维度 / 订单维度（按仓库实际分配件数拆分）。金额 S$。 */
(function(){
const {pushPage,popPage,toast,svg,skel}=window.FM;

const css=document.createElement('style');
css.textContent=`
.rc-sum{margin:0 16px 13px;background:#fff;border-radius:18px;padding:15px 16px;box-shadow:var(--sh-sm);}
.rc-sum .big{font-size:28px;font-weight:700;color:var(--emerald-2);margin:2px 0 3px;}
.rc-sum .big .c{font-size:17px;opacity:.8;margin-right:2px;}
.rc-sum .lbl{font-size:12px;color:var(--sub);}
.rc-sum .cols{display:flex;margin-top:12px;padding-top:12px;border-top:1px solid var(--line);}
.rc-sum .cols .c2{flex:1;}
.rc-sum .cols .k{font-size:11.5px;color:var(--sub);}
.rc-sum .cols .v{font-size:14px;font-weight:700;color:#27433A;margin-top:3px;}
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
.rc-up{color:#B45309;}.rc-dn{color:var(--red);}.rc-eq{color:var(--sub);}
/* 详情 */
.rc-tabs{display:flex;gap:8px;padding:12px 16px 4px;}
.rc-tab{flex:1;text-align:center;min-height:44px;line-height:44px;font-size:13px;font-weight:700;color:var(--sub);background:var(--muted);border-radius:12px;}
.rc-tab.on{background:var(--mint-soft);color:var(--emerald-2);}
.rc-row{background:#fff;margin:0 16px 10px;border-radius:16px;padding:14px 15px;box-shadow:var(--sh-sm);}
.rc-row .t{font-size:13.5px;font-weight:700;color:#27433A;}
.rc-row .s{font-size:11.5px;color:var(--sub);margin-top:3px;}
.rc-row .kvs{display:flex;margin-top:10px;padding-top:10px;border-top:1px solid var(--line);}
.rc-row .kvs .c2{flex:1;}
.rc-row .kvs .k{font-size:11px;color:var(--sub);}
.rc-row .kvs .v{font-size:13px;font-weight:700;color:#27433A;margin-top:2px;}
.rc-row .kvs .c2.last{text-align:right;}
.rc-row .kvs .c2.last .v{color:var(--emerald-2);}
.rc-note{margin:6px 16px 24px;font-size:11.5px;color:var(--sub);line-height:1.6;}
`;
document.head.appendChild(css);

/* 与 PC 原型 RECON 同源同值（改一端记得同步另一端） */
const RECON=[
  {date:'2026-07-01',no:'DZ20260701',sh:'SH20260701001',wh:'裕廊DC',lines:[
    {sku:'SKU8801',name:'小棠菜',spec:'1kg/件',unit:'件',price:3.80,due:20,real:18,byOrder:[['#SG20260701001','海****',12,11],['#SG20260701004','金****',8,7]]},
    {sku:'SKU8802',name:'白菜',spec:'1kg/件',unit:'件',price:2.60,due:10,real:10,byOrder:[['#SG20260701001','海****',6,6],['#SG20260701004','金****',4,4]]},
    {sku:'SKU8804',name:'空心菜',spec:'1kg/件',unit:'件',price:3.20,due:30,real:28,byOrder:[['#SG20260701002','新****',18,17],['#SG20260701004','金****',12,11]]},
    {sku:'SKU8806',name:'土豆',spec:'2kg/件',unit:'件',price:4.50,due:16,real:16,byOrder:[['#SG20260701002','新****',10,10],['#SG20260701001','海****',6,6]]},
  ]},
  {date:'2026-06-30',no:'DZ20260630',sh:'SH20260630001',wh:'裕廊DC',lines:[
    {sku:'SKU8803',name:'菠菜',spec:'1kg/件',unit:'件',price:4.10,due:12,real:11,byOrder:[['#SG20260630001','福****',12,11]]},
    {sku:'SKU8805',name:'胡萝卜',spec:'1kg/件',unit:'件',price:2.20,due:25,real:25,byOrder:[['#SG20260630001','福****',15,15],['#SG20260630004','恒****',10,10]]},
    {sku:'SKU8807',name:'鸡蛋',spec:'30枚/盘',unit:'盘',price:6.80,due:20,real:19,byOrder:[['#SG20260630004','恒****',20,19]]},
  ]},
  {date:'2026-06-29',no:'DZ20260629',sh:'SH20260629001',wh:'裕廊DC',lines:[
    {sku:'SKU8801',name:'小棠菜',spec:'1kg/件',unit:'件',price:3.80,due:18,real:18,byOrder:[['#SG20260629002','悦****',10,10],['#SG20260629005','丰****',8,8]]},
    {sku:'SKU8808',name:'豆腐',spec:'400g/盒',unit:'盒',price:1.40,due:40,real:38,byOrder:[['#SG20260629002','悦****',25,24],['#SG20260629005','丰****',15,14]]},
  ]},
];
const GST=9;                                                          // 默认税率 GST 9%
const S=n=>'S$'+n.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
const rcTax=l=>(l.tax==null?GST:l.tax);
const rcMul=l=>1+rcTax(l)/100;
const rcDue =d=>d.lines.reduce((a,l)=>a+l.due*l.price,0);             // 未税
const rcReal=d=>d.lines.reduce((a,l)=>a+l.real*l.price,0);
const rcDueG =d=>d.lines.reduce((a,l)=>a+l.due*l.price*rcMul(l),0);   // 含税
const rcRealG=d=>d.lines.reduce((a,l)=>a+l.real*l.price*rcMul(l),0);
const rcOrders=d=>[...new Set(d.lines.flatMap(l=>l.byOrder.map(o=>o[0])))];
const diffCls=v=>v>0?'rc-up':v<0?'rc-dn':'rc-eq';
const diffTxt=v=>(v>0?'+':v<0?'−':'')+S(Math.abs(v));

/* ── 列表：每天一张对账单 ─────────────────────────────── */
function openRecon(){
  const rows=[...RECON].sort((a,b)=>b.date.localeCompare(a.date));
  const sumDue=rows.reduce((a,d)=>a+rcDue(d),0), sumReal=rows.reduce((a,d)=>a+rcReal(d),0);
  const sumDueG=rows.reduce((a,d)=>a+rcDueG(d),0), sumRealG=rows.reduce((a,d)=>a+rcRealG(d),0);
  pushPage({title:'对账单',body:`
    <div class="rc-sum">
      <div class="lbl">近 7 天 · 结算金额合计（未税）</div>
      <div class="big disp"><span class="c">S$</span>${sumReal.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}</div>
      <div class="lbl">含税 ${S(sumRealG)} · GST ${S(+(sumRealG-sumReal).toFixed(2))}</div>
      <div class="cols">
        <div class="c2"><div class="k">应发金额</div><div class="v">${S(sumDue)}</div><div class="k" style="margin-top:2px">含税 ${S(sumDueG)}</div></div>
        <div class="c2"><div class="k">实发金额</div><div class="v">${S(sumReal)}</div><div class="k" style="margin-top:2px">含税 ${S(sumRealG)}</div></div>
        <div class="c2"><div class="k">差异</div><div class="v ${diffCls(+(sumReal-sumDue).toFixed(2))}">${diffTxt(+(sumReal-sumDue).toFixed(2))}</div><div class="k" style="margin-top:2px">含税 ${diffTxt(+(sumRealG-sumDueG).toFixed(2))}</div></div>
      </div>
    </div>
    <div id="rcl">${skel(3)}</div>`,
    mount:(p)=>{
      setTimeout(()=>{
        const box=p.querySelector('#rcl');if(!box)return;
        box.innerHTML=`<div class="rc-list">${rows.map(d=>{
          const du=rcDue(d),re=rcReal(d),reG=rcRealG(d),v=+(re-du).toFixed(2),os=rcOrders(d);
          return `<div class="rc-card" data-no="${d.no}">
            <div class="r1"><span class="no">${d.no}</span><span class="wh">${d.wh}</span></div>
            <div class="meta">${d.date} · 送货单 ${d.sh} · ${os.length} 个订单 · ${d.lines.length} 个 SKU</div>
            <div class="r2">
              <div class="g"><div class="k">应发 / 实发（未税）</div><div class="v">${S(du)} / ${S(re)}</div></div>
              <div class="g"><div class="k">差异</div><div class="v ${diffCls(v)}">${diffTxt(v)}</div></div>
              <div class="g settle"><div class="k">当日结算（未税）</div><div class="v">${S(re)}</div><div class="k" style="margin-top:2px">含税 ${S(reG)}</div></div>
            </div></div>`;}).join('')}</div>`;
        box.querySelectorAll('.rc-card').forEach(c=>c.onclick=()=>openReconDetail(c.dataset.no));
      },420);
    }});
}

/* ── 详情：SKU 维度 / 订单维度 ───────────────────────────── */
function openReconDetail(no,tab){
  const d=RECON.find(x=>x.no==no);if(!d)return;
  tab=tab||'sku';
  const du=rcDue(d),re=rcReal(d),duG=rcDueG(d),reG=rcRealG(d),v=+(re-du).toFixed(2),vG=+(reG-duG).toFixed(2);
  const orders=rcOrders(d).map(id=>{
    const nm=(d.lines.flatMap(l=>l.byOrder).find(o=>o[0]==id)||[])[1]||'';
    let oDue=0,oReal=0,oDueG=0,oRealG=0,n=0;
    d.lines.forEach(l=>l.byOrder.filter(o=>o[0]==id).forEach(o=>{oDue+=o[2]*l.price;oReal+=o[3]*l.price;oDueG+=o[2]*l.price*rcMul(l);oRealG+=o[3]*l.price*rcMul(l);n++;}));
    return {id,nm,n,oDue:+oDue.toFixed(2),oReal:+oReal.toFixed(2),oDueG:+oDueG.toFixed(2),oRealG:+oRealG.toFixed(2)};
  });
  const skuRows=d.lines.map(l=>{
    const qv=l.real-l.due;
    return `<div class="rc-row">
      <div class="t">${l.name} <span style="font-weight:400;color:var(--sub);font-size:12px">${l.spec}</span></div>
      <div class="s">${l.sku} · 未税 ${S(l.price)}/${l.unit} · 含税 ${S(l.price*rcMul(l))}/${l.unit} · 税率 ${rcTax(l)}%</div>
      <div class="kvs">
        <div class="c2"><div class="k">应发</div><div class="v">${l.due}${l.unit}</div></div>
        <div class="c2"><div class="k">实发</div><div class="v">${l.real}${l.unit}</div></div>
        <div class="c2"><div class="k">差异</div><div class="v ${diffCls(qv)}">${qv>0?'+':qv<0?'−':''}${Math.abs(qv)}${l.unit}</div></div>
        <div class="c2 last"><div class="k">结算金额（未税）</div><div class="v">${S(l.real*l.price)}</div><div class="k" style="margin-top:2px">含税 ${S(l.real*l.price*rcMul(l))}</div></div>
      </div></div>`;}).join('');
  const ordRows=orders.map(o=>{
    const ov=+(o.oReal-o.oDue).toFixed(2), ovG=+(o.oRealG-o.oDueG).toFixed(2);
    return `<div class="rc-row">
      <div class="t">${o.id}</div>
      <div class="s">${o.nm} · ${o.n} 个 SKU</div>
      <div class="kvs">
        <div class="c2"><div class="k">应发金额</div><div class="v">${S(o.oDue)}</div><div class="k" style="margin-top:2px">含税 ${S(o.oDueG)}</div></div>
        <div class="c2"><div class="k">实发金额</div><div class="v">${S(o.oReal)}</div><div class="k" style="margin-top:2px">含税 ${S(o.oRealG)}</div></div>
        <div class="c2"><div class="k">差异</div><div class="v ${diffCls(ov)}">${diffTxt(ov)}</div><div class="k" style="margin-top:2px">含税 ${diffTxt(ovG)}</div></div>
        <div class="c2 last"><div class="k">结算金额（未税）</div><div class="v">${S(o.oReal)}</div><div class="k" style="margin-top:2px">含税 ${S(o.oRealG)}</div></div>
      </div></div>`;}).join('');
  pushPage({title:'对账单详情',body:`
    <div class="rc-sum">
      <div class="lbl">${d.no} · ${d.date} · ${d.wh} · 送货单 ${d.sh}</div>
      <div class="lbl" style="margin-top:6px">当日结算金额（未税）</div>
      <div class="big disp"><span class="c">S$</span>${re.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}</div>
      <div class="lbl">含税 ${S(reG)} · GST ${S(+(reG-re).toFixed(2))}</div>
      <div class="cols">
        <div class="c2"><div class="k">应发金额</div><div class="v">${S(du)}</div><div class="k" style="margin-top:2px">含税 ${S(duG)}</div></div>
        <div class="c2"><div class="k">实发金额</div><div class="v">${S(re)}</div><div class="k" style="margin-top:2px">含税 ${S(reG)}</div></div>
        <div class="c2"><div class="k">差异</div><div class="v ${diffCls(v)}">${diffTxt(v)}</div><div class="k" style="margin-top:2px">含税 ${diffTxt(vG)}</div></div>
      </div>
    </div>
    <div class="rc-tabs"><div class="rc-tab ${tab=='sku'?'on':''}" data-t="sku">SKU 维度</div><div class="rc-tab ${tab=='order'?'on':''}" data-t="order">订单维度</div></div>
    ${tab=='sku'?skuRows:ordRows}
    <div class="rc-note">当日结算金额（未税）= Σ(实发件数 × 未税单价)；含税金额 = 逐行 ×(1+税率)，默认 GST ${GST}%，税额 = 含税 − 未税；差异 = 实发件数 − 应发件数（+ 多发 / − 少发）。全为标品、按整件对账，不产生重量差额。应发件数取送货单的下单/预约数量，实发件数取仓库签收入库件数（送货单「已入库数量」）；订单维度按仓库实际分配件数拆分。每日一张对账单，对应当日送货单（一个入库仓库）；各日对账单按结算周期汇总并入结算单。</div>`,
    mount:(p)=>{
      p.querySelectorAll('.rc-tab').forEach(t=>t.onclick=()=>{if(t.dataset.t==tab)return;popPage();openReconDetail(no,t.dataset.t);});
    }});
}

window.FM_MOD=window.FM_MOD||{};
window.FM_MOD.recon=openRecon;
})();
