/* Food Max 商家端 v2 · 对账单模块（商家视角·只读）
   PC 对齐：与 PC 商家管理系统「财务 › 对账单」同口径——
   按送货单出账，结算金额 = Σ(实发数量 × 未税单价)，差异 = 实发 − 应发（+多发 / −少发）；
   同一天多张送货单汇总为当日结算金额，按结算周期并入结算单。
   明细两个维度：SKU 维度 / 订单维度（订单维度按仓库实际分配量拆分）。金额 S$。 */
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
.rc-day{margin:16px 18px 8px;font-size:12.5px;color:var(--sub);display:flex;align-items:center;}
.rc-day b{color:#27433A;font-size:13.5px;margin-right:8px;}
.rc-day .amt{margin-left:auto;color:var(--emerald-2);font-weight:700;}
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
  {date:'2026-07-01',wh:'裕廊DC',no:'SH20260701001',lines:[
    {sku:'SKU8801',name:'小棠菜',spec:'1kg/件',unit:'kg',price:3.80,due:20,real:19.40,byOrder:[['#SG20260701001','海****',12,11.60],['#SG20260701004','金****',8,7.80]]},
    {sku:'SKU8802',name:'白菜',spec:'1kg/件',unit:'kg',price:2.60,due:10,real:10.35,byOrder:[['#SG20260701001','海****',6,6.20],['#SG20260701004','金****',4,4.15]]},
  ]},
  {date:'2026-07-01',wh:'兀兰DC',no:'SH20260701002',lines:[
    {sku:'SKU8804',name:'空心菜',spec:'1kg/件',unit:'kg',price:3.20,due:30,real:29.10,byOrder:[['#SG20260701002','新****',18,17.40],['#SG20260701005','大****',12,11.70]]},
    {sku:'SKU8806',name:'土豆',spec:'2kg/件',unit:'件',price:4.50,due:16,real:16,byOrder:[['#SG20260701002','新****',10,10],['#SG20260701005','大****',6,6]]},
  ]},
  {date:'2026-06-30',wh:'裕廊DC',no:'SH20260630001',lines:[
    {sku:'SKU8803',name:'菠菜',spec:'1kg/件',unit:'kg',price:4.10,due:12,real:11.55,byOrder:[['#SG20260630001','福****',12,11.55]]},
    {sku:'SKU8805',name:'胡萝卜',spec:'1kg/件',unit:'kg',price:2.20,due:25,real:25.60,byOrder:[['#SG20260630001','福****',15,15.30],['#SG20260630004','恒****',10,10.30]]},
  ]},
  {date:'2026-06-30',wh:'盛港DC',no:'SH20260630002',lines:[
    {sku:'SKU8807',name:'鸡蛋',spec:'30枚/盘',unit:'盘',price:6.80,due:20,real:20,byOrder:[['#SG20260630002','悦****',20,20]]},
  ]},
];
const S=n=>'S$'+n.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
const rcDue =d=>d.lines.reduce((a,l)=>a+l.due*l.price,0);
const rcReal=d=>d.lines.reduce((a,l)=>a+l.real*l.price,0);
const rcOrders=d=>[...new Set(d.lines.flatMap(l=>l.byOrder.map(o=>o[0])))];
const diffCls=v=>v>0?'rc-up':v<0?'rc-dn':'rc-eq';
const diffTxt=v=>(v>0?'+':v<0?'−':'')+S(Math.abs(v));

/* ── 列表：按日分组，日汇总 = 当日结算金额 ────────────────── */
function openRecon(){
  const dates=[...new Set(RECON.map(d=>d.date))].sort().reverse();
  const sumDue=RECON.reduce((a,d)=>a+rcDue(d),0), sumReal=RECON.reduce((a,d)=>a+rcReal(d),0);
  pushPage({title:'对账单',body:`
    <div class="rc-sum">
      <div class="lbl">近 7 天 · 结算金额合计（未税）</div>
      <div class="big disp"><span class="c">S$</span>${sumReal.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}</div>
      <div class="cols">
        <div class="c2"><div class="k">应发金额</div><div class="v">${S(sumDue)}</div></div>
        <div class="c2"><div class="k">实发金额</div><div class="v">${S(sumReal)}</div></div>
        <div class="c2"><div class="k">差异</div><div class="v ${diffCls(+(sumReal-sumDue).toFixed(2))}">${diffTxt(+(sumReal-sumDue).toFixed(2))}</div></div>
      </div>
    </div>
    <div id="rcl">${skel(3)}</div>`,
    mount:(p)=>{
      setTimeout(()=>{
        const box=p.querySelector('#rcl');if(!box)return;
        box.innerHTML=dates.map(dt=>{
          const ds=RECON.filter(d=>d.date==dt);
          const dReal=ds.reduce((a,d)=>a+rcReal(d),0);
          return `<div class="rc-day"><b>${dt}</b>${ds.length} 张送货单<span class="amt">${S(dReal)}</span></div>
          <div class="rc-list">${ds.map(d=>{
            const du=rcDue(d),re=rcReal(d),v=+(re-du).toFixed(2),os=rcOrders(d);
            return `<div class="rc-card" data-no="${d.no}">
              <div class="r1"><span class="no">${d.no}</span><span class="wh">${d.wh}</span></div>
              <div class="meta">${os.length} 个订单 · ${d.lines.length} 个 SKU</div>
              <div class="r2">
                <div class="g"><div class="k">应发 / 实发</div><div class="v">${S(du)} / ${S(re)}</div></div>
                <div class="g"><div class="k">差异</div><div class="v ${diffCls(v)}">${diffTxt(v)}</div></div>
                <div class="g settle"><div class="k">结算金额</div><div class="v">${S(re)}</div></div>
              </div></div>`;}).join('')}</div>`;
        }).join('');
        box.querySelectorAll('.rc-card').forEach(c=>c.onclick=()=>openReconDetail(c.dataset.no));
      },420);
    }});
}

/* ── 详情：SKU 维度 / 订单维度 ───────────────────────────── */
function openReconDetail(no,tab){
  const d=RECON.find(x=>x.no==no);if(!d)return;
  tab=tab||'sku';
  const du=rcDue(d),re=rcReal(d),v=+(re-du).toFixed(2);
  const orders=rcOrders(d).map(id=>{
    const nm=(d.lines.flatMap(l=>l.byOrder).find(o=>o[0]==id)||[])[1]||'';
    let oDue=0,oReal=0,n=0;
    d.lines.forEach(l=>l.byOrder.filter(o=>o[0]==id).forEach(o=>{oDue+=o[2]*l.price;oReal+=o[3]*l.price;n++;}));
    return {id,nm,n,oDue:+oDue.toFixed(2),oReal:+oReal.toFixed(2)};
  });
  const skuRows=d.lines.map(l=>{
    const qv=+(l.real-l.due).toFixed(2), pct=l.due?(qv/l.due*100).toFixed(1):'0.0';
    return `<div class="rc-row">
      <div class="t">${l.name} <span style="font-weight:400;color:var(--sub);font-size:12px">${l.spec}</span></div>
      <div class="s">${l.sku} · ${S(l.price)}/${l.unit}</div>
      <div class="kvs">
        <div class="c2"><div class="k">应发</div><div class="v">${l.due}${l.unit}</div></div>
        <div class="c2"><div class="k">实发</div><div class="v">${l.real}${l.unit}</div></div>
        <div class="c2"><div class="k">差异</div><div class="v ${diffCls(qv)}">${qv>0?'+':qv<0?'−':''}${Math.abs(qv)}${l.unit}<span style="font-weight:400;font-size:11px"> (${qv>0?'+':qv<0?'−':''}${Math.abs(pct)}%)</span></div></div>
        <div class="c2 last"><div class="k">结算金额</div><div class="v">${S(l.real*l.price)}</div></div>
      </div></div>`;}).join('');
  const ordRows=orders.map(o=>{
    const ov=+(o.oReal-o.oDue).toFixed(2);
    return `<div class="rc-row">
      <div class="t">${o.id}</div>
      <div class="s">${o.nm} · ${o.n} 个 SKU</div>
      <div class="kvs">
        <div class="c2"><div class="k">应发金额</div><div class="v">${S(o.oDue)}</div></div>
        <div class="c2"><div class="k">实发金额</div><div class="v">${S(o.oReal)}</div></div>
        <div class="c2"><div class="k">差异</div><div class="v ${diffCls(ov)}">${diffTxt(ov)}</div></div>
        <div class="c2 last"><div class="k">结算金额</div><div class="v">${S(o.oReal)}</div></div>
      </div></div>`;}).join('');
  pushPage({title:'对账单详情',body:`
    <div class="rc-sum">
      <div class="lbl">${d.no} · ${d.date} · ${d.wh}</div>
      <div class="lbl" style="margin-top:6px">结算金额（未税）</div>
      <div class="big disp"><span class="c">S$</span>${re.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}</div>
      <div class="cols">
        <div class="c2"><div class="k">应发金额</div><div class="v">${S(du)}</div></div>
        <div class="c2"><div class="k">实发金额</div><div class="v">${S(re)}</div></div>
        <div class="c2"><div class="k">差异</div><div class="v ${diffCls(v)}">${diffTxt(v)}</div></div>
      </div>
    </div>
    <div class="rc-tabs"><div class="rc-tab ${tab=='sku'?'on':''}" data-t="sku">SKU 维度</div><div class="rc-tab ${tab=='order'?'on':''}" data-t="order">订单维度</div></div>
    ${tab=='sku'?skuRows:ordRows}
    <div class="rc-note">结算金额 = Σ(实发数量 × 未税单价)；差异 = 实发 − 应发（+ 多发 / − 少发）。按重量定价商品的实发数量取「备货 › 称重录入」提交的实发净重，订单维度按仓库实际分配量拆分。当日各送货单结算金额汇总为当日结算金额，按结算周期并入结算单。</div>`,
    mount:(p)=>{
      p.querySelectorAll('.rc-tab').forEach(t=>t.onclick=()=>{if(t.dataset.t==tab)return;popPage();openReconDetail(no,t.dataset.t);});
    }});
}

window.FM_MOD=window.FM_MOD||{};
window.FM_MOD.recon=openRecon;
})();
