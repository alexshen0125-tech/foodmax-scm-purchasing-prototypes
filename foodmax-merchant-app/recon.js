/* Food Max 商家端 v2 · 对账单模块（商家视角·只读）
   PC 对齐：与 PC 商家管理系统「财务 › 对账单」同口径、同数据——
   每天一张对账单 = 当日送货单；数据源 = 财务结算单明细汇总，商家端不自行取数计算。
     平台服务费 =（实发金额含税 − 商家补贴）× 平台服务费率
     商家收入   = 实发金额含税 − 商家补贴 − 平台服务费
     当日结算   = 商家收入 − 售后扣款
   自营补货、耗材订单按其在结算单明细的计入日落到当天对账单，各自独立结算、不并入当日结算，付款层轧差。
   五个页签：SKU 维度 / 订单维度 / 售后明细 / 自营补货 / 耗材订单。金额 S$。 */
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
.rc-card .extra{margin-top:9px;font-size:11.5px;color:#B45309;background:var(--amber-soft);border-radius:10px;padding:7px 10px;line-height:1.5;}
.rc-neg{color:var(--red);}
.rc-tabs{display:flex;gap:6px;padding:12px 16px 4px;overflow-x:auto;}
.rc-tab{flex:0 0 auto;padding:0 14px;min-height:40px;line-height:40px;font-size:12.5px;font-weight:700;color:var(--sub);background:var(--muted);border-radius:12px;white-space:nowrap;}
.rc-tab.on{background:var(--mint-soft);color:var(--emerald-2);}
.rc-row{background:#fff;margin:0 16px 10px;border-radius:16px;padding:14px 15px;box-shadow:var(--sh-sm);}
.rc-row .t{font-size:13.5px;font-weight:700;color:#27433A;}
.rc-row .s{font-size:11.5px;color:var(--sub);margin-top:3px;}
.rc-row .kvs{display:grid;grid-template-columns:1fr 1fr;gap:9px 12px;margin-top:10px;padding-top:10px;border-top:1px solid var(--line);}
.rc-row .kvs .k{font-size:11px;color:var(--sub);}
.rc-row .kvs .v{font-size:13px;font-weight:700;color:#27433A;margin-top:2px;}
.rc-row .kvs .em .v{color:var(--emerald-2);}
.rc-row .jd{display:inline-block;font-size:11px;font-weight:700;padding:2px 9px;border-radius:8px;background:var(--red-soft);color:var(--red);margin-top:6px;}
.rc-row .stt{display:inline-block;font-size:11px;font-weight:700;padding:2px 9px;border-radius:8px;background:#EAF1FF;color:#2563EB;margin-top:6px;}
.rc-empty{margin:24px 16px;text-align:center;color:var(--sub);font-size:12.5px;line-height:1.7;}
.rc-note{margin:6px 16px 24px;font-size:11.5px;color:var(--sub);line-height:1.6;}
`;
document.head.appendChild(css);

/* 与 PC 原型 RECON 同源同值（改一端记得同步另一端） */
const RECON=[
  {date:'2026-07-01',no:'SH20260701001',wh:'裕廊DC',
   lines:[
    {sku:'SKU8801',name:'小棠菜',spec:'1kg/件',unit:'件',price:3.80,due:20,real:18,sub:2.00,rate:6,byOrder:[['#SG20260701001',12,11],['#SG20260701004',8,7]]},
    {sku:'SKU8802',name:'白菜',spec:'1kg/件',unit:'件',price:2.60,due:10,real:10,sub:0,rate:6,byOrder:[['#SG20260701001',6,6],['#SG20260701004',4,4]]},
    {sku:'SKU8804',name:'空心菜',spec:'1kg/件',unit:'件',price:3.20,due:30,real:28,sub:1.50,rate:5,byOrder:[['#SG20260701002',18,17],['#SG20260701004',12,11]]},
    {sku:'SKU8806',name:'土豆',spec:'2kg/件',unit:'件',price:4.50,due:16,real:16,sub:0,rate:5,byOrder:[['#SG20260701002',10,10],['#SG20260701001',6,6]]},
   ],
   ordMeta:{'#SG20260701001':{cust:'海****',bcrs:1.20,adj:0,ct:'2026-06-30 21:14',ft:'2026-07-01 10:32'},
            '#SG20260701002':{cust:'新****',bcrs:0,adj:0,ct:'2026-06-30 22:03',ft:'2026-07-01 10:58'},
            '#SG20260701004':{cust:'金****',bcrs:0.60,adj:0,ct:'2026-06-30 23:41',ft:'2026-07-01 11:20'}},
   after:[{id:'AS20260701003',order:'#SG20260701001',sku:'SKU8801',qty:1,type:'仅退款',judge:'商家责任 · 叶片腐烂',at:'2026-07-01 15:20'},
          {id:'AS20260701007',order:'#SG20260701004',sku:'SKU8804',qty:2,type:'仅退款',judge:'商家责任 · 少发',at:'2026-07-01 16:05'}],
   repl:[{id:'RPL-20260701-001',sub:'SUB-20260701-01',sku:'SKU8801',should:20,recv:18,gap:2,qty:2,taxPrice:4.14,rate:30,at:'2026-07-01 07:12',status:'已结算'}],
   supply:[{hs:'HS20260701001',po:'SPO20260701001',code:'XC-LBL-001',name:'热敏标签纸 40×30',cat:'标签耗材',unit:'卷',qty:5,price:8.00,at:'2026-07-01 09:40',status:'已交付'}]},

  {date:'2026-06-30',no:'SH20260630001',wh:'裕廊DC',
   lines:[
    {sku:'SKU8803',name:'菠菜',spec:'1kg/件',unit:'件',price:4.10,due:12,real:11,sub:0,rate:6,byOrder:[['#SG20260630001',12,11]]},
    {sku:'SKU8805',name:'胡萝卜',spec:'1kg/件',unit:'件',price:2.20,due:25,real:25,sub:1.00,rate:6,byOrder:[['#SG20260630001',15,15],['#SG20260630004',10,10]]},
    {sku:'SKU8807',name:'鸡蛋',spec:'30枚/盘',unit:'盘',price:6.80,due:20,real:19,sub:0,rate:5,byOrder:[['#SG20260630004',20,19]]},
   ],
   ordMeta:{'#SG20260630001':{cust:'福****',bcrs:0,adj:0,ct:'2026-06-29 20:50',ft:'2026-06-30 10:12'},
            '#SG20260630004':{cust:'恒****',bcrs:2.40,adj:0,ct:'2026-06-29 22:31',ft:'2026-06-30 11:05'}},
   after:[{id:'AS20260630004',order:'#SG20260630004',sku:'SKU8807',qty:1,type:'退货退款',judge:'商家责任 · 破损',at:'2026-06-30 18:22'}],
   repl:[{id:'RPL-20260630-002',sub:'SUB-20260630-03',sku:'SKU8807',should:20,recv:19,gap:1,qty:1,taxPrice:7.41,rate:30,at:'2026-06-30 07:35',status:'已开票'}],
   supply:[]},

  {date:'2026-06-29',no:'SH20260629001',wh:'裕廊DC',
   lines:[
    {sku:'SKU8801',name:'小棠菜',spec:'1kg/件',unit:'件',price:3.80,due:18,real:18,sub:0,rate:6,byOrder:[['#SG20260629002',10,10],['#SG20260629005',8,8]]},
    {sku:'SKU8808',name:'豆腐',spec:'400g/盒',unit:'盒',price:1.40,due:40,real:38,sub:0,rate:5,byOrder:[['#SG20260629002',25,24],['#SG20260629005',15,14]]},
   ],
   ordMeta:{'#SG20260629002':{cust:'悦****',bcrs:0,adj:0,ct:'2026-06-28 21:02',ft:'2026-06-29 09:48'},
            '#SG20260629005':{cust:'丰****',bcrs:0.30,adj:0,ct:'2026-06-28 23:15',ft:'2026-06-29 10:26'}},
   after:[],repl:[],
   supply:[{hs:'HS20260629001',po:'SPO20260629001',code:'XC-PRN-002',name:'标签打印机 TP-30',cat:'打印设备',unit:'台',qty:1,price:120.00,at:'2026-06-29 14:10',status:'已结算'}]},
];
const GST=9;
const S=n=>'S$'+n.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
const NEG=n=>n?`<span class="rc-neg">-${S(n)}</span>`:S(0);
const tax=l=>(l.tax==null?GST:l.tax), mul=l=>1+tax(l)/100;
const ln=(d,s)=>d.lines.find(l=>l.sku==s)||{price:0,name:s,unit:'件',spec:''};
const realN=l=>l.real*l.price, realG=l=>l.real*l.price*mul(l);
const fee=l=>(realG(l)-(l.sub||0))*(l.rate||0)/100, inc=l=>realG(l)-(l.sub||0)-fee(l);
const sum=(a,f)=>a.reduce((s,x)=>s+f(x),0);
const dRealN=d=>sum(d.lines,realN), dRealG=d=>sum(d.lines,realG);
const dSub=d=>sum(d.lines,l=>l.sub||0), dFee=d=>sum(d.lines,fee), dInc=d=>sum(d.lines,inc);
const dAftN=d=>sum(d.after||[],x=>x.qty*ln(d,x.sku).price);
const dAftG=d=>sum(d.after||[],x=>{const l=ln(d,x.sku);return x.qty*l.price*mul(l);});
const dSettle=d=>dInc(d)-dAftG(d);
const rplAmt=r=>Math.round(r.taxPrice*r.qty*(1+r.rate/100)*100)/100;
const rplNet=r=>Math.round(rplAmt(r)/(1+GST/100)*100)/100;
const dRpl=d=>sum(d.repl||[],rplAmt);
const supN=s=>s.qty*s.price, supG=s=>s.qty*s.price*(1+GST/100);
const dSup=d=>sum(d.supply||[],supG);
const ordersOf=d=>[...new Set(d.lines.flatMap(l=>l.byOrder.map(o=>o[0])))];

function openRecon(){
  const rows=[...RECON].sort((a,b)=>b.date.localeCompare(a.date));
  const T=f=>rows.reduce((a,d)=>a+f(d),0);
  pushPage({title:'对账单',body:`
    <div class="rc-sum">
      <div class="lbl">近 7 天 · 当日结算合计（货款）</div>
      <div class="big disp"><span class="c">S$</span>${T(dSettle).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}</div>
      <div class="lbl">数据源：财务结算单明细汇总</div>
      <div class="grid">
        <div><div class="k">实发金额（含税）</div><div class="v">${S(T(dRealG))}</div></div>
        <div><div class="k">商家补贴</div><div class="v">${NEG(T(dSub))}</div></div>
        <div><div class="k">平台服务费</div><div class="v">${NEG(T(dFee))}</div></div>
        <div><div class="k">售后扣款（含税）</div><div class="v">${NEG(T(dAftG))}</div></div>
        <div><div class="k">自营补货（另行结算）</div><div class="v">${NEG(T(dRpl))}</div></div>
        <div><div class="k">耗材订单（另行结算）</div><div class="v">${NEG(T(dSup))}</div></div>
      </div>
    </div>
    <div id="rcl">${skel(3)}</div>`,
    mount:(p)=>{
      setTimeout(()=>{
        const box=p.querySelector('#rcl');if(!box)return;
        box.innerHTML=`<div class="rc-list">${rows.map(d=>{
          const os=ordersOf(d),ex=[];
          if(dRpl(d))ex.push(`自营补货 ${S(dRpl(d))}`);
          if(dSup(d))ex.push(`耗材订单 ${S(dSup(d))}`);
          return `<div class="rc-card" data-no="${d.no}">
            <div class="r1"><span class="no">${d.no}</span><span class="wh">${d.wh}</span></div>
            <div class="meta">${d.date} · ${os.length} 个订单 · ${d.lines.length} 个 SKU${(d.after||[]).length?` · 售后 ${(d.after||[]).length} 笔`:''}</div>
            <div class="r2">
              <div class="g"><div class="k">实发金额（含税）</div><div class="v">${S(dRealG(d))}</div></div>
              <div class="g settle"><div class="k">当日结算（货款）</div><div class="v">${S(dSettle(d))}</div></div>
            </div>
            ${ex.length?`<div class="extra">另行结算：${ex.join(' · ')}，不并入当日结算，付款时轧差</div>`:''}
          </div>`;}).join('')}</div>`;
        box.querySelectorAll('.rc-card').forEach(c=>c.onclick=()=>openReconDetail(c.dataset.no));
      },420);
    }});
}

function openReconDetail(no,tab){
  const d=RECON.find(x=>x.no==no);if(!d)return;
  tab=tab||'sku';
  const aft=d.after||[],rpl=d.repl||[],sup=d.supply||[];
  const skuRows=d.lines.map(l=>`<div class="rc-row">
      <div class="t">${l.name} <span style="font-weight:400;color:var(--sub);font-size:12px">${l.spec}</span></div>
      <div class="s">${l.sku} · 未税 ${S(l.price)}/${l.unit} · 含税 ${S(l.price*mul(l))}/${l.unit} · 税率 ${tax(l)}% · 服务费率 ${(l.rate||0).toFixed(1)}%</div>
      <div class="kvs">
        <div><div class="k">应发 / 实发</div><div class="v">${l.due} / ${l.real}${l.unit}</div></div>
        <div><div class="k">实发金额（未税）</div><div class="v">${S(realN(l))}</div></div>
        <div><div class="k">实发金额（含税）</div><div class="v">${S(realG(l))}</div></div>
        <div><div class="k">商家补贴</div><div class="v">${NEG(l.sub||0)}</div></div>
        <div><div class="k">平台服务费</div><div class="v">${NEG(fee(l))}</div></div>
        <div class="em"><div class="k">商家收入</div><div class="v">${S(inc(l))}</div></div>
      </div></div>`).join('');
  const ordRows=ordersOf(d).map(id=>{
    const m=(d.ordMeta||{})[id]||{};let n=0,due=0,real=0,rn=0,rg=0,sb=0,fe=0,ic=0;
    d.lines.forEach(l=>l.byOrder.filter(o=>o[0]==id).forEach(o=>{
      const share=l.due?o[1]/l.due:0,g=o[2]*l.price*mul(l);
      n++;due+=o[1];real+=o[2];rn+=o[2]*l.price;rg+=g;
      const s=(l.sub||0)*share;sb+=s;const f=(g-s)*(l.rate||0)/100;fe+=f;ic+=g-s-f;}));
    return `<div class="rc-row">
      <div class="t">${id}</div>
      <div class="s">${m.cust||''} · ${n} 个 SKU · 应发 ${due} / 实发 ${real}</div>
      <div class="s">下单 ${m.ct||'—'} · 完成 ${m.ft||'—'}</div>
      <div class="kvs">
        <div><div class="k">订单金额（未税）</div><div class="v">${S(rn)}</div></div>
        <div><div class="k">订单金额（含税）</div><div class="v">${S(rg)}</div></div>
        <div><div class="k">BCRS 押金</div><div class="v">${m.bcrs?S(m.bcrs):'—'}</div></div>
        <div><div class="k">多退少补</div><div class="v">${m.adj?S(m.adj):'—'}</div></div>
        <div><div class="k">商家补贴</div><div class="v">${NEG(sb)}</div></div>
        <div><div class="k">平台服务费</div><div class="v">${NEG(fe)}</div></div>
        <div class="em"><div class="k">商家收入</div><div class="v">${S(ic)}</div></div>
      </div></div>`;}).join('');
  const aftRows=aft.length?aft.map(x=>{const l=ln(d,x.sku);return `<div class="rc-row">
      <div class="t">${l.name} <span style="font-weight:400;color:var(--sub);font-size:12px">${x.qty}${l.unit} · ${x.type}</span></div>
      <div class="s">${x.id} · ${x.order} · ${x.sku}</div>
      <div class="s">判责完成 ${x.at||'—'}</div>
      <div class="jd">${x.judge}</div>
      <div class="kvs">
        <div><div class="k">售后金额（未税）</div><div class="v">${NEG(x.qty*l.price)}</div></div>
        <div><div class="k">售后金额（含税）</div><div class="v">${NEG(x.qty*l.price*mul(l))}</div></div>
      </div></div>`;}).join('')
    :`<div class="rc-empty">当日无判给商家的售后<br>判责为平台/客户承担的部分不进本对账单</div>`;
  const rplRows=rpl.length?rpl.map(r=>{const l=ln(d,r.sku);return `<div class="rc-row">
      <div class="t">${l.name} <span style="font-weight:400;color:var(--sub);font-size:12px">补货 ${r.qty}${l.unit}</span></div>
      <div class="s">${r.id} · 子单 ${r.sub} · ${r.sku}</div>
      <div class="s">收货清点 ${r.at||'—'}</div>
      <div class="stt">${r.status}</div>
      <div class="kvs">
        <div><div class="k">应送 / 实收</div><div class="v">${r.should} / ${r.recv}</div></div>
        <div><div class="k">缺口数量</div><div class="v rc-neg">${r.gap}</div></div>
        <div><div class="k">含税售价 × 加价率</div><div class="v">${S(r.taxPrice)} × ${r.rate}%</div></div>
        <div><div class="k">补货金额（未税）</div><div class="v">${NEG(rplNet(r))}</div></div>
        <div><div class="k">补货金额（含税）</div><div class="v">${NEG(rplAmt(r))}</div></div>
      </div></div>`;}).join('')+`<div class="rc-note">补货金额（含税）= ROUND(含税售价 × 补货数量 ×(1+加价率), 2)，总额法一次算出。缺口由平台自营现货全额补足，客户订单无感。本项独立结算，不并入当日结算。</div>`
    :`<div class="rc-empty">当日无自营补货<br>收货清点无少货，或缺口未由自营补足</div>`;
  const supRows=sup.length?sup.map(s=>`<div class="rc-row">
      <div class="t">${s.name} <span style="font-weight:400;color:var(--sub);font-size:12px">${s.qty}${s.unit} · ${s.cat}</span></div>
      <div class="s">${s.hs} · 采购单 ${s.po} · ${s.code}</div>
      <div class="s">交付回写 ${s.at||'—'}</div>
      <div class="stt">${s.status}</div>
      <div class="kvs">
        <div><div class="k">未税单价</div><div class="v">${S(s.price)}</div></div>
        <div><div class="k">含税单价</div><div class="v">${S(s.price*(1+GST/100))}</div></div>
        <div><div class="k">金额（未税）</div><div class="v">${NEG(supN(s))}</div></div>
        <div><div class="k">金额（含税）</div><div class="v">${NEG(supG(s))}</div></div>
      </div></div>`).join('')+`<div class="rc-note">耗材按送货单「已交付」回写时间落期计费，支付方式固定为结算抵扣、商家无支付动作；不参与佣金、不计 GMV。本项独立结算，不并入当日结算。</div>`
    :`<div class="rc-empty">当日无耗材订单<br>耗材订单按交付回写日计入对账单</div>`;
  pushPage({title:'对账单详情',body:`
    <div class="rc-sum">
      <div class="lbl">${d.no} · ${d.date} · ${d.wh}</div>
      <div class="lbl" style="margin-top:6px">当日结算（货款）</div>
      <div class="big disp"><span class="c">S$</span>${dSettle(d).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}</div>
      <div class="grid">
        <div><div class="k">实发金额（未税）</div><div class="v">${S(dRealN(d))}</div></div>
        <div><div class="k">实发金额（含税）</div><div class="v">${S(dRealG(d))}</div></div>
        <div><div class="k">商家补贴</div><div class="v">${NEG(dSub(d))}</div></div>
        <div><div class="k">平台服务费</div><div class="v">${NEG(dFee(d))}</div></div>
        <div><div class="k">商家收入</div><div class="v">${S(dInc(d))}</div></div>
        <div><div class="k">售后扣款（含税）</div><div class="v">${NEG(dAftG(d))}</div></div>
      </div>
    </div>
    ${(dRpl(d)||dSup(d))?`<div class="rc-note" style="background:var(--amber-soft);color:#B45309;padding:11px 13px;border-radius:12px;margin:0 16px 6px">当日另有自营补货 ${S(dRpl(d))}、耗材订单 ${S(dSup(d))}（含税），各自独立结算、不并入当日结算，付款时轧差：实付 = 货款应结 − 自营补货 − 耗材。</div>`:''}
    <div class="rc-tabs">
      <div class="rc-tab ${tab=='sku'?'on':''}" data-t="sku">SKU 维度</div>
      <div class="rc-tab ${tab=='order'?'on':''}" data-t="order">订单维度</div>
      <div class="rc-tab ${tab=='after'?'on':''}" data-t="after">售后${aft.length?` ${aft.length}`:''}</div>
      <div class="rc-tab ${tab=='repl'?'on':''}" data-t="repl">自营补货${rpl.length?` ${rpl.length}`:''}</div>
      <div class="rc-tab ${tab=='supply'?'on':''}" data-t="supply">耗材${sup.length?` ${sup.length}`:''}</div>
    </div>
    ${tab=='sku'?skuRows:tab=='order'?ordRows:tab=='after'?aftRows:tab=='repl'?rplRows:supRows}
    <div class="rc-note">数据源：财务结算单明细汇总，商家端不自行取数计算。平台服务费 =（实发金额含税 − 商家补贴）× 平台服务费率；商家收入 = 实发金额含税 − 商家补贴 − 平台服务费；当日结算（货款）= 商家收入 − 售后扣款。全为标品按整件对账，实发件数取仓库签收入库件数。</div>`,
    mount:(p)=>{p.querySelectorAll('.rc-tab').forEach(t=>t.onclick=()=>{if(t.dataset.t==tab)return;popPage();openReconDetail(no,t.dataset.t);});}});
}

window.FM_MOD=window.FM_MOD||{};
window.FM_MOD.recon=openRecon;
})();
