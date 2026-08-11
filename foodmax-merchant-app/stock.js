/* Food Max 商家端 v2 · 库存管理（库存列表 + 在途库存）
   框架：merchant management/PRD/scm_商家库存管理_功能框架.md
   与 PC 端 pc-modules/stock.js 业务规则/字段/状态/枚举完全一致（双端同步硬规范）

   ★ 通用列表：自售 + 寄售共用，按「供货模式」分流
     supplyMode=1 自售 → 库存商家自维护，**可改**（沿用线上 /product/sku/restock）
     supplyMode=2 寄售 → 库存=WMS 实物，**只读**

   | 维度     | 自售 SELF(1)              | 寄售 CONSIGNMENT(2)        |
   |---------|--------------------------|---------------------------|
   | 库存承载 | virtual_inventory 设置库存 | wms_inventory 在仓实物      |
   | stockMode| 1 每日恢复 / 2 售完即止    | 3 货品库存（只读）           |
   | 可售     | max(设置库存 − 已占用, 0)  | max(在仓实物 − 已占用, 0)    |
   | 粒度     | SKU 级，各规格**独立**     | 货品级，各规格**共享同一池**  |
   | 分仓     | 不分仓                    | 按 siteCode 分仓            |
   | 在途     | 无（不入仓）               | 有（寄售入库单）             |
   | 可改     | ✅                        | ❌                         |

   本期不做：批次/效期临期预警、低库存档（safety_inventory 已停写清零）、差异申诉、供货单开单。
   自定义类一律 sk- 前缀。
*/
(function(){
const {pushPage,popPage,toast,svg,skel}=window.FM;
const SELF_WH='全仓通用';

const css=document.createElement('style');
css.textContent=`
.sk-tabs{display:flex;background:var(--card);padding:0 16px;border-bottom:1px solid var(--line);position:sticky;top:0;z-index:5;}
.sk-tabs .t{flex:1;min-height:46px;display:flex;align-items:center;justify-content:center;gap:4px;font-size:15px;font-weight:600;color:var(--sub);position:relative;cursor:pointer;}
.sk-tabs .t.on{color:var(--ink);font-weight:700;}
.sk-tabs .t.on::after{content:"";position:absolute;bottom:0;left:50%;transform:translateX(-50%);width:30px;height:3px;border-radius:3px;background:var(--emerald);}
.sk-tabs .t span{font-size:12px;font-weight:400;color:var(--sub);}
.sk-bar{padding:12px 16px 4px;}
.sk-search{display:flex;align-items:center;gap:7px;min-height:44px;padding:0 13px;border-radius:12px;background:var(--muted);color:var(--sub);font-size:14px;}
.sk-search svg{width:17px;height:17px;flex:0 0 auto;stroke:var(--sub);fill:none;stroke-width:1.8;}
.sk-chips{display:flex;gap:8px;padding:10px 16px 4px;overflow-x:auto;-webkit-overflow-scrolling:touch;}
.sk-chip{flex:0 0 auto;min-height:34px;display:flex;align-items:center;padding:0 13px;border-radius:20px;border:1px solid var(--line);background:var(--card);font-size:13px;color:var(--sub);cursor:pointer;white-space:nowrap;}
.sk-chip.on{background:var(--emerald);border-color:var(--emerald);color:#fff;font-weight:600;}
.sk-note{margin:10px 16px 2px;padding:11px 13px;border-radius:12px;background:var(--mint-soft);font-size:12.5px;line-height:1.65;color:var(--ink);}
.sk-note.blue{background:#EFF6FF;} .sk-note.amber{background:var(--amber-soft);} .sk-note.red{background:var(--red-soft);}
.sk-note b{font-weight:700;}
.sk-list{padding:12px 16px 28px;}
.sk-card{background:var(--card);border-radius:16px;padding:14px;margin-bottom:13px;box-shadow:var(--sh-sm);cursor:pointer;}
.sk-hd{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;margin-bottom:11px;}
.sk-nm{font-size:15.5px;font-weight:700;color:var(--ink);line-height:1.35;}
.sk-sub{font-size:11.5px;color:var(--sub);margin-top:3px;font-family:ui-monospace,Menlo,monospace;}
.sk-q4{display:grid;gap:8px;border-top:1px solid var(--line);padding-top:11px;}
.sk-q4.n4{grid-template-columns:repeat(4,1fr);} .sk-q4.n3{grid-template-columns:repeat(3,1fr);}
.sk-q4 .c{text-align:center;}
.sk-q4 .l{font-size:11px;color:var(--sub);margin-bottom:3px;}
.sk-q4 .v{font-size:17px;font-weight:700;color:var(--ink);}
.sk-q4 .v.g{color:var(--emerald);} .sk-q4 .v.b{color:#2563EB;} .sk-q4 .v.r{color:var(--red);} .sk-q4 .v.m{color:var(--sub);font-weight:600;}
.sk-q4 .u{font-size:10.5px;font-weight:400;color:var(--sub);margin-left:2px;}
.sk-spec{margin-top:11px;padding-top:10px;border-top:1px dashed var(--line);font-size:12.5px;color:var(--sub);line-height:1.7;}
.sk-spec b{color:var(--ink);font-weight:700;}
.sk-acts{margin-top:11px;padding-top:10px;border-top:1px dashed var(--line);}
.sk-btn{display:inline-flex;align-items:center;justify-content:center;min-height:38px;padding:0 16px;border-radius:11px;font-size:13.5px;font-weight:600;border:1px solid var(--emerald);color:var(--emerald);background:var(--card);cursor:pointer;}
.sk-tag{display:inline-flex;align-items:center;padding:2px 8px;border-radius:20px;font-size:11px;font-weight:600;}
.sk-tag.ok{background:var(--mint-soft);color:var(--emerald);}
.sk-tag.out{background:var(--red-soft);color:var(--red);}
.sk-tag.wait{background:var(--amber-soft);color:var(--amber);}
.sk-tag.doing{background:#EFF6FF;color:#2563EB;}
.sk-tag.gray{background:var(--muted);color:var(--sub);}
.sk-tag.self{background:var(--mint-soft);color:var(--emerald);}
.sk-tag.cons{background:#F3E8FF;color:#7C3AED;}
.sk-sec{font-size:13.5px;font-weight:700;color:var(--emerald);margin:18px 16px 9px;}
.sk-box{background:var(--card);border-radius:16px;margin:0 16px;overflow:hidden;box-shadow:var(--sh-sm);}
.sk-row{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:12px 14px;border-bottom:1px solid var(--line);font-size:13.5px;min-height:44px;}
.sk-row:last-child{border-bottom:none;}
.sk-row .k{color:var(--sub);flex:0 0 auto;}
.sk-row .v{color:var(--ink);font-weight:600;text-align:right;}
.sk-flow{padding:12px 14px;border-bottom:1px solid var(--line);}
.sk-flow:last-child{border-bottom:none;}
.sk-f1{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:5px;}
.sk-f2{font-size:11.5px;color:var(--sub);font-family:ui-monospace,Menlo,monospace;}
.sk-amt{font-size:15px;font-weight:700;}
.sk-amt.plus{color:var(--emerald);} .sk-amt.minus{color:var(--red);} .sk-amt.gray{color:var(--sub);} .sk-amt.blue{color:#2563EB;}
.sk-dis{margin-top:7px;min-height:34px;display:inline-flex;align-items:center;padding:0 12px;border-radius:18px;border:1px solid var(--line);font-size:12px;color:var(--sub);cursor:pointer;}
.sk-ed{padding:14px;border-bottom:1px solid var(--line);}
.sk-ed .t{font-size:14px;font-weight:700;color:var(--ink);}
.sk-ed .s{font-size:11.5px;color:var(--sub);font-family:ui-monospace,Menlo,monospace;margin-top:2px;}
.sk-in{width:100%;min-height:46px;margin-top:9px;padding:0 13px;border:1px solid var(--line);border-radius:12px;font-size:15px;font-weight:600;color:var(--ink);background:var(--card);font-family:inherit;}
.sk-in.bad{border-color:var(--red);background:var(--red-soft);}
.sk-seg{display:flex;gap:8px;margin-top:9px;}
.sk-seg .s{flex:1;min-height:40px;display:flex;align-items:center;justify-content:center;border:1px solid var(--line);border-radius:11px;font-size:13px;color:var(--sub);cursor:pointer;}
.sk-seg .s.on{background:var(--mint-soft);border-color:var(--emerald);color:var(--emerald);font-weight:700;}
.sk-save{position:sticky;bottom:0;padding:14px 16px;background:var(--card);border-top:1px solid var(--line);}
.sk-save .b{width:100%;min-height:50px;display:flex;align-items:center;justify-content:center;border-radius:14px;background:var(--emerald);color:#fff;font-size:15.5px;font-weight:700;cursor:pointer;}
.sk-save .b.off{background:var(--line);color:var(--sub);}
.sk-empty{text-align:center;padding:56px 30px;color:var(--sub);}
.sk-empty .ei{width:52px;height:52px;margin:0 auto 13px;}
.sk-empty .ei svg{width:52px;height:52px;stroke:var(--line);fill:none;stroke-width:1.5;}
.sk-empty h4{font-size:15px;color:var(--ink);margin-bottom:6px;font-weight:700;}
.sk-empty p{font-size:13px;line-height:1.6;}
`;
document.head.appendChild(css);

/* ============ 数据（与 PC 端同源同值） ============ */
const ITEMS=[
  /* 寄售：货品级、分仓、只读 */
  {item:'SPU-JS-8801',mode:'consign',name:'冰鲜三文鱼',cat:'海鲜水产',unit:'kg',
   skus:[{skuId:'SKU-JS-1101',spec:'1kg/袋',ratio:1},{skuId:'SKU-JS-1102',spec:'3kg/箱',ratio:3}],
   stocks:[{wh:'裕廊DC',wms:186,locked:24,transit:60},{wh:'兀兰DC',wms:52,locked:8,transit:0}]},
  {item:'SPU-JS-8802',mode:'consign',name:'鸡胸肉',cat:'肉禽蛋品',unit:'kg',
   skus:[{skuId:'SKU-JS-1201',spec:'2kg/袋',ratio:2}],
   stocks:[{wh:'裕廊DC',wms:74,locked:12,transit:0},{wh:'盛港DC',wms:31,locked:3,transit:40}]},
  {item:'SPU-JS-8803',mode:'consign',name:'冷冻虾仁',cat:'海鲜水产',unit:'kg',
   skus:[{skuId:'SKU-JS-1301',spec:'500g/盒',ratio:0.5},{skuId:'SKU-JS-1302',spec:'5kg/箱',ratio:5}],
   stocks:[{wh:'裕廊DC',wms:0,locked:0,transit:120}]},
  {item:'SPU-JS-8804',mode:'consign',name:'小棠菜',cat:'新鲜蔬菜',unit:'kg',
   skus:[{skuId:'SKU-JS-1401',spec:'1kg/袋',ratio:1},{skuId:'SKU-JS-1402',spec:'5kg/箱',ratio:5}],
   stocks:[{wh:'兀兰DC',wms:240,locked:35,transit:0},{wh:'盛港DC',wms:96,locked:0,transit:0}]},
  {item:'SPU-JS-8805',mode:'consign',name:'泰国龙眼',cat:'新鲜蔬菜',unit:'箱',
   skus:[{skuId:'SKU-JS-1501',spec:'1箱',ratio:1}],
   stocks:[{wh:'裕廊DC',wms:18,locked:18,transit:0}]},
  /* 自售：SKU 级、不分仓、可改 */
  {item:'SPU-ZS-6601',mode:'self',name:'有机菠菜',cat:'新鲜蔬菜',unit:'件',
   skus:[{skuId:'SKU-ZS-2101',spec:'500g/袋',stock:120,locked:18,stockMode:'daily'},
         {skuId:'SKU-ZS-2102',spec:'2kg/箱',stock:36,locked:4,stockMode:'daily'}]},
  {item:'SPU-ZS-6602',mode:'self',name:'鲜鸡蛋',cat:'肉禽蛋品',unit:'件',
   skus:[{skuId:'SKU-ZS-2201',spec:'30枚/盘',stock:0,locked:0,stockMode:'finite'}]},
  {item:'SPU-ZS-6603',mode:'self',name:'生抽酱油',cat:'调味品',unit:'件',
   skus:[{skuId:'SKU-ZS-2301',spec:'500ml/瓶',stock:240,locked:12,stockMode:'finite'},
         {skuId:'SKU-ZS-2302',spec:'12瓶/箱',stock:45,locked:0,stockMode:'finite'}]},
];
const FLOWS=[
  {item:'SPU-JS-8801',wh:'裕廊DC',time:'2026-08-11 09:12',type:'out',   qty:12, after:186,doc:'CK-JS-20260811-0043'},
  {item:'SPU-JS-8801',wh:'裕廊DC',time:'2026-08-10 16:40',type:'loss',  qty:4,  after:198,doc:'PD-20260810-0007'},
  {item:'SPU-JS-8801',wh:'裕廊DC',time:'2026-08-10 11:05',type:'out',   qty:26, after:202,doc:'CK-JS-20260810-0031'},
  {item:'SPU-JS-8801',wh:'裕廊DC',time:'2026-08-09 08:30',type:'in',    qty:150,after:228,doc:'GH-JS-20260808-0009'},
  {item:'SPU-JS-8801',wh:'兀兰DC',time:'2026-08-10 14:22',type:'out',   qty:9,  after:52, doc:'CK-JS-20260810-0028'},
  {item:'SPU-JS-8802',wh:'裕廊DC',time:'2026-08-11 10:02',type:'ret',   qty:6,  after:74, doc:'TH-20260811-0005'},
  {item:'SPU-JS-8802',wh:'裕廊DC',time:'2026-08-10 09:18',type:'out',   qty:18, after:68, doc:'CK-JS-20260810-0022'},
  {item:'SPU-JS-8802',wh:'盛港DC',time:'2026-08-08 15:47',type:'damage',qty:5,  after:31, doc:'BS-20260808-0002'},
  {item:'SPU-JS-8803',wh:'裕廊DC',time:'2026-08-09 17:30',type:'out',   qty:34, after:0,  doc:'CK-JS-20260809-0019'},
  {item:'SPU-JS-8804',wh:'兀兰DC',time:'2026-08-11 07:55',type:'in',    qty:200,after:240,doc:'GH-JS-20260810-0017'},
  {item:'SPU-JS-8804',wh:'兀兰DC',time:'2026-08-09 12:10',type:'gain',  qty:3,  after:40, doc:'PD-20260809-0004'},
  {item:'SPU-JS-8804',wh:'盛港DC',time:'2026-08-10 10:33',type:'out',   qty:22, after:96, doc:'CK-JS-20260810-0026'},
  {item:'SPU-JS-8805',wh:'裕廊DC',time:'2026-08-11 08:41',type:'out',   qty:6,  after:18, doc:'CK-JS-20260811-0040'},
  {item:'SPU-JS-8805',wh:'裕廊DC',time:'2026-08-07 09:00',type:'adj',   qty:-2, after:24, doc:'TZ-20260807-0001'},
  /* 自售：无入仓/盘点，只有销售出库、客户退货、商家改库存 */
  {item:'SPU-ZS-6601',wh:SELF_WH,time:'2026-08-11 11:20',type:'out',  qty:14, after:120,doc:'CK-20260811-0091'},
  {item:'SPU-ZS-6601',wh:SELF_WH,time:'2026-08-11 08:00',type:'edit', qty:60, after:134,doc:'商家手动调整'},
  {item:'SPU-ZS-6601',wh:SELF_WH,time:'2026-08-10 15:02',type:'ret',  qty:2,  after:74, doc:'TH-20260810-0011'},
  {item:'SPU-ZS-6603',wh:SELF_WH,time:'2026-08-11 09:40',type:'out',  qty:6,  after:240,doc:'CK-20260811-0088'},
  {item:'SPU-ZS-6602',wh:SELF_WH,time:'2026-08-10 18:30',type:'out',  qty:20, after:0,  doc:'CK-20260810-0074'},
];
const INBOUND=[
  {no:'R2026081200055',supply:'GH-JS-20260811-0021',wh:'裕廊DC',status:'待入库',create:'2026-08-11 18:20',
   lines:[{item:'SPU-JS-8801',name:'冰鲜三文鱼',unit:'kg',plan:60,recv:null},{item:'SPU-JS-8803',name:'冷冻虾仁',unit:'kg',plan:120,recv:null}]},
  {no:'R2026081100031',supply:'GH-JS-20260810-0018',wh:'盛港DC',status:'入库中',create:'2026-08-11 07:10',
   lines:[{item:'SPU-JS-8802',name:'鸡胸肉',unit:'kg',plan:40,recv:40}]},
  {no:'R2026081100030',supply:'GH-JS-20260810-0017',wh:'兀兰DC',status:'入库完成',create:'2026-08-11 06:40',
   lines:[{item:'SPU-JS-8804',name:'小棠菜',unit:'kg',plan:220,recv:200}]},
  {no:'R2026080900112',supply:'GH-JS-20260808-0009',wh:'裕廊DC',status:'入库完成',create:'2026-08-09 08:05',
   lines:[{item:'SPU-JS-8801',name:'冰鲜三文鱼',unit:'kg',plan:150,recv:150}]},
  {no:'R2026080700088',supply:'GH-JS-20260806-0005',wh:'裕廊DC',status:'已取消',create:'2026-08-07 13:25',
   lines:[{item:'SPU-JS-8805',name:'泰国龙眼',unit:'箱',plan:30,recv:null}]},
];

/* 流水类型 → 商家话术（不暴露 CONSIGNMENT_IN / SALE_OUT 等内部枚举） */
const FLOW={
  in    :{t:'送货入仓',  s:'+',c:'plus'},
  ret   :{t:'客户退货',  s:'+',c:'plus'},
  gain  :{t:'盘点盈',    s:'+',c:'plus'},
  edit  :{t:'商家改库存',s:'±',c:'blue'},
  out   :{t:'销售出库',  s:'-',c:'gray'},
  loss  :{t:'盘点亏',    s:'-',c:'minus'},
  damage:{t:'报损',      s:'-',c:'minus'},
  adj   :{t:'库存调整',  s:'±',c:'minus'},
};
const DISPUTE=['loss','damage','adj'];
const IN_ST={'待入库':'wait','入库中':'doing','入库完成':'ok','已取消':'gray'};
const SMODE={daily:'每日恢复',finite:'售完即止'};

/* ============ 计算 ============ */
const isSelf=it=>it.mode==='self';
const left=(a,b)=>Math.max((+a||0)-(+b||0),0);
const itemOf=c=>ITEMS.find(i=>i.item===c);
const selfTot=it=>it.skus.reduce((a,k)=>({stock:a.stock+(+k.stock||0),locked:a.locked+(+k.locked||0)}),{stock:0,locked:0});
/* 行 = SKU（与商品列表同粒度，平铺）；寄售再 × 仓
   寄售同商品各 SKU 共享货品库存池 → 在库/已占用/在途为货品单位、同商品同仓各行相同，
   可售按 convertRatio 折成件，故必须打「共享」标 */
function invRows(mode){
  const out=[];
  ITEMS.forEach(it=>{
    if(mode&&it.mode!==mode)return;
    if(isSelf(it)){
      it.skus.forEach(k=>out.push({it,k,wh:SELF_WH,self:true,unit:'件',
        stock:k.stock,locked:k.locked,transit:0,sellable:left(k.stock,k.locked),shared:false}));
    }else it.stocks.forEach(s=>{
      const il=left(s.wms,s.locked);
      it.skus.forEach(k=>{
        /* 全部换算成本规格的「件」；已占用由 在库件 − 可售件 反推，
           不能各自 floor（否则三个数在屏幕上对不上，BR-04b） */
        const stockPc=Math.floor(s.wms/k.ratio);
        const sellable=Math.floor(il/k.ratio);
        out.push({it,k,wh:s.wh,self:false,unit:'件',raw:s.wms,rawUnit:it.unit,
          stock:stockPc,locked:stockPc-sellable,transit:Math.floor(s.transit/k.ratio),
          sellable,shared:it.skus.length>1});});
    });
  });
  return out;
}
const flowsOf=(c,type)=>FLOWS.filter(f=>f.item===c&&(!type||f.type===type)).sort((a,b)=>a.time<b.time?1:-1);
const sign=f=>{const m=FLOW[f.type];return m.s==='±'?(f.qty>0?'+':'')+f.qty:m.s+f.qty;};
const flag=it=>isSelf(it)?'<span class="sk-tag self">自售</span>':'<span class="sk-tag cons">寄售</span>';

/* ============ 子页：改库存（仅自售，逐 SKU） ============ */
/* 改库存：列表已按 SKU 平铺，逐个规格改（skuId 省略时改第一个） */
function openEdit(code,after,skuId){
  const it=itemOf(code);
  if(!isSelf(it)){toast('寄售商品库存由仓库实物决定，不可修改');return;}
  const k=it.skus.find(x=>x.skuId===skuId)||it.skus[0];
  const draft={stock:String(k.stock),stockMode:k.stockMode};
  pushPage({title:'改库存',subtitle:`${it.name} ${k.spec}`,
    body:`<div class="sk-note"><b>每日恢复</b>=每天自动回到设置的数量；<b>售完即止</b>=卖完就没有，需手动补。改后<b>即时生效、无需审核</b>，设为 0 即售罄下架。本规格库存<b>与其他规格互相独立</b>。</div>
      <div class="sk-box" style="margin-top:12px">
        <div class="sk-ed">
          <div class="t">${k.spec}</div><div class="s">${k.skuId} · 当前 ${k.stock} 件</div>
          <input class="sk-in" id="ed-v" type="number" min="0" step="1" value="${k.stock}" inputmode="numeric">
          <div class="sk-seg" id="ed-seg">
            <div class="s ${k.stockMode==='daily'?'on':''}" data-m="daily">每日恢复</div>
            <div class="s ${k.stockMode==='finite'?'on':''}" data-m="finite">售完即止</div>
          </div>
        </div>
      </div>
      <div id="ed-err"></div><div style="height:20px"></div>`,
    footer:`<div class="sk-save"><div class="b" id="ed-ok">保存（即时生效）</div></div>`,
    mount:(p)=>{
      const ok=p.querySelector('#ed-ok'),err=p.querySelector('#ed-err'),inp=p.querySelector('#ed-v');
      const validate=()=>{
        const v=inp.value,n=Number(v);
        const bad=v===''||isNaN(n)||n<0||!Number.isInteger(n);
        inp.classList.toggle('bad',bad);
        if(!bad)draft.stock=v;
        err.innerHTML=bad?`<div class="sk-note red">库存必须为 <b>≥0 的整数</b></div>`:'';
        ok.classList.toggle('off',bad);
        return !bad;
      };
      inp.oninput=validate;
      p.querySelectorAll('#ed-seg .s').forEach(s=>s.onclick=()=>{
        p.querySelectorAll('#ed-seg .s').forEach(x=>x.classList.remove('on'));
        s.classList.add('on'); draft.stockMode=s.dataset.m;
      });
      ok.onclick=()=>{
        if(!validate()){toast('库存必须为 ≥0 的整数');return;}
        k.stock=Math.max(0,parseInt(draft.stock)||0); k.stockMode=draft.stockMode;
        popPage(); toast(`「${it.name} ${k.spec}」库存已更新为 ${k.stock} 件`); after&&after();
      };
    }});
}

/* ============ 子页：库存流水 ============ */
function openFlow(code){
  const it=itemOf(code),self=isSelf(it);
  let type='';
  const chips=self?[['','全部'],['out','销售出库'],['ret','客户退货'],['edit','商家改库存']]
                  :[['','全部'],['in','送货入仓'],['out','销售出库'],['ret','客户退货'],['loss','盘点亏'],['damage','报损'],['gain','盘点盈'],['adj','库存调整']];
  pushPage({title:'库存流水',subtitle:`${it.name} · 单位 ${it.unit}`,
    body:`<div class="sk-chips" id="fc">${chips.map(c=>`<div class="sk-chip${c[0]===''?' on':''}" data-t="${c[0]}">${c[1]}</div>`).join('')}</div>
      <div class="sk-note"><b>近 6 个月</b>变动记录。${self?'自售商品不入仓，因此没有入库、盘点、报损类记录。':'「移库」（仓内换库位）不改变总量，不在此列出；每笔都带仓库作业单号，可凭单号找运营核对。'}</div>
      <div class="sk-box" id="fl" style="margin-top:12px"></div><div style="height:28px"></div>`,
    mount:(p)=>{
      const box=p.querySelector('#fl');
      const draw=()=>{
        const list=flowsOf(code,type);
        if(!list.length){box.innerHTML=`<div class="sk-empty"><div class="ei">${svg('layers')}</div><h4>该类型暂无记录</h4><p>切换上方筛选查看其他变动</p></div>`;return;}
        box.innerHTML=list.map(f=>{const m=FLOW[f.type];
          return `<div class="sk-flow">
            <div class="sk-f1"><span class="sk-tag ${m.c==='plus'?'ok':m.c==='minus'?'out':m.c==='blue'?'doing':'gray'}">${m.t}</span>
              <span class="sk-amt ${m.c}">${sign(f)} ${it.unit}</span></div>
            <div class="sk-f1"><span class="sk-f2">${f.time} · ${f.wh}</span><span class="sk-f2">变动后 ${f.after}</span></div>
            <div class="sk-f2" style="margin-top:3px">${f.doc}</div>
            ${DISPUTE.includes(f.type)?`<div class="sk-dis" data-doc="${f.doc}">对这笔有疑问？</div>`:''}
          </div>`;}).join('');
        box.querySelectorAll('.sk-dis').forEach(b=>b.onclick=()=>openDispute(b.dataset.doc));
      };
      p.querySelectorAll('#fc .sk-chip').forEach(c=>c.onclick=()=>{
        p.querySelectorAll('#fc .sk-chip').forEach(x=>x.classList.remove('on'));
        c.classList.add('on');type=c.dataset.t;box.innerHTML=skel(3);setTimeout(draw,320);
      });
      box.innerHTML=skel(3);setTimeout(draw,420);
    }});
}

/* 本期不做申诉，但不能只丢一个负数——给明确出口 */
function openDispute(doc){
  window.FM.confirmDialog({title:'对这笔变动有疑问',
    body:`盘点亏损、报损由仓库作业产生，商家端为<b>只读展示</b>。<br><br>如需核对，请把作业单号 <b>${doc}</b> 提供给你的对接运营，由运营在仓库系统调取作业记录与责任判定。<br><br>线上差异申诉功能规划中，当前版本尚未开放。`,
    okText:'复制单号',onOk:()=>toast('单号已复制：'+doc)});
}

/* ============ 子页：库存明细 ============ */
function openDetail(code){
  const render=()=>{
    const it=itemOf(code),u=it.unit,self=isSelf(it);
    let head,blocks;
    if(self){
      const t=selfTot(it),tl=left(t.stock,t.locked);
      head=`<div class="sk-card" style="cursor:default"><div class="sk-q4 n3" style="border-top:none;padding-top:0">
          <div class="c"><div class="l">设置库存</div><div class="v">${t.stock}<span class="u">${u}</span></div></div>
          <div class="c"><div class="l">已占用</div><div class="v m">${t.locked}<span class="u">${u}</span></div></div>
          <div class="c"><div class="l">可售</div><div class="v g">${tl}<span class="u">${u}</span></div></div>
        </div></div>
        <div class="sk-note"><b>可售 = 设置库存 − 已占用</b>。设置库存是你自己填的可供货数量；「已占用」是买家已下单、还没送出的量。自售商品<b>不入仓</b>，因此没有「在仓实物」与「在途」。</div>`;
      blocks=`<div class="sk-sec">各规格库存（逐规格独立）</div><div class="sk-box">
          ${it.skus.map(k=>`<div class="sk-flow">
            <div class="sk-f1"><span style="font-weight:700;font-size:14px">${k.spec}</span>
              <span style="font-size:14px">可售 <b style="color:var(--emerald)">${left(k.stock,k.locked)}</b> 件</span></div>
            <div class="sk-f1"><span class="sk-f2">${k.skuId} · 设置 ${k.stock} · 已占用 ${k.locked}</span>
              <span class="sk-tag ${k.stockMode==='daily'?'ok':'wait'}">${SMODE[k.stockMode]}</span></div>
          </div>`).join('')}</div>
        <div class="sk-note blue">自售商品<b>每个规格的库存各自独立</b>，改一个不影响另一个——这点和寄售相反。</div>
        <div style="padding:16px 16px 0"><div class="sk-btn" id="ed" style="width:100%;min-height:46px">改库存</div></div>`;
    }else{
      const t=it.stocks.reduce((a,s)=>({wms:a.wms+s.wms,locked:a.locked+s.locked,transit:a.transit+s.transit}),{wms:0,locked:0,transit:0});
      const tl=it.stocks.reduce((a,s)=>a+left(s.wms,s.locked),0);
      head=`<div class="sk-card" style="cursor:default"><div class="sk-q4 n4" style="border-top:none;padding-top:0">
          <div class="c"><div class="l">在库</div><div class="v">${t.wms}<span class="u">${u}</span></div></div>
          <div class="c"><div class="l">已占用</div><div class="v m">${t.locked}<span class="u">${u}</span></div></div>
          <div class="c"><div class="l">可售</div><div class="v g">${tl}<span class="u">${u}</span></div></div>
          <div class="c"><div class="l">在途</div><div class="v b">${t.transit}<span class="u">${u}</span></div></div>
        </div></div>
        <div class="sk-note"><b>可售 = 在库 − 已占用</b>。「已占用」是买家已下单、仓库尚未出库的量；「在途」是你已送到仓、仓库还没入库完成的量，入库完成后才计入在库。</div>`;
      blocks=`<div class="sk-sec">分仓明细</div><div class="sk-box">
          ${it.stocks.map(s=>`<div class="sk-flow">
            <div class="sk-f1"><span style="font-weight:700;font-size:14px">${s.wh}</span>
              <span style="font-size:14px">可售 <b style="color:var(--emerald)">${left(s.wms,s.locked)}</b> ${u}</span></div>
            <div class="sk-f1"><span class="sk-f2">在库 ${s.wms} · 已占用 ${s.locked}</span>
              <span class="sk-f2">${s.transit?'在途 '+s.transit:'无在途'}</span></div>
          </div>`).join('')}</div>
        <div class="sk-note amber">各仓库存<b>独立记账、不跨仓调拨</b>。某仓可售为 0 时，其他仓有货也无法销往该仓覆盖区域。</div>
        <div class="sk-sec">各规格可售件数</div><div class="sk-box">
          ${it.skus.map(k=>`<div class="sk-row"><span class="k">${k.spec}<div class="sk-f2">${k.skuId} · 1 件 = ${k.ratio}${u}</div></span>
            <span class="v">${Math.floor(tl/k.ratio)} 件</span></div>`).join('')}</div>
        <div class="sk-note blue">本商品下<b>所有规格共用同一批货</b>（共 ${tl} ${u} 可售），不是各自独立的库存。卖掉任意一个规格，其他规格的可售件数都会同步下降——这不是数据错误。</div>`;
    }
    const recent=flowsOf(code,'').slice(0,5).map(f=>{const m=FLOW[f.type];
      return `<div class="sk-flow"><div class="sk-f1"><span class="sk-tag ${m.c==='plus'?'ok':m.c==='minus'?'out':m.c==='blue'?'doing':'gray'}">${m.t}</span>
        <span class="sk-amt ${m.c}">${sign(f)} ${u}</span></div>
        <div class="sk-f2">${f.time} · ${f.wh} · ${f.doc}</div></div>`;}).join('');
    return `<div style="height:12px"></div>${head}${blocks}
      <div class="sk-sec">最近库存变动</div><div class="sk-box">${recent||`<div class="sk-empty"><h4>暂无变动记录</h4></div>`}</div>
      <div style="padding:16px"><div class="sk-chip on" id="more" style="width:100%;justify-content:center;min-height:46px;font-size:14px">查看全部流水 ›</div></div>`;
  };
  const it=itemOf(code);
  pushPage({title:it.name,subtitle:`${it.item} · ${isSelf(it)?'自售 · 可自行维护':'寄售 · 仓库实物、只读'} · 单位 ${it.unit}`,
    body:`<div id="dt-body">${render()}</div>`,
    mount:(p)=>{
      const host=p.querySelector('#dt-body');
      const bind=()=>{
        const more=host.querySelector('#more'); if(more)more.onclick=()=>openFlow(code);
        const ed=host.querySelector('#ed');
        if(ed)ed.onclick=()=>openEdit(code,()=>{host.innerHTML=render();bind();});   // 改完就地重绘
      };
      bind();
    }});
}

/* ============ 子页：在途入库单详情 ============ */
function openInbound(no){
  const d=INBOUND.find(x=>x.no===no),done=d.status==='入库完成';
  const lines=d.lines.map(l=>{const short=done&&l.recv!=null&&l.recv<l.plan?l.plan-l.recv:0;
    return `<div class="sk-flow"><div class="sk-f1"><span style="font-weight:700;font-size:14px">${l.name}</span>
        <span style="font-size:14px">${l.recv==null?'<span style="color:var(--sub)">待收</span>':'实收 <b>'+l.recv+'</b> '+l.unit}</span></div>
      <div class="sk-f1"><span class="sk-f2">${l.item} · 应收 ${l.plan} ${l.unit}</span>
        ${short?`<span class="sk-amt minus" style="font-size:13px">短收 ${short} ${l.unit}</span>`:''}</div></div>`;}).join('');
  const hasShort=done&&d.lines.some(l=>l.recv!=null&&l.recv<l.plan);
  pushPage({title:d.supply,subtitle:`${d.wh} · ${d.status}`,
    body:`<div class="sk-sec">单据信息</div><div class="sk-box">
        <div class="sk-row"><span class="k">供货单号</span><span class="v">${d.supply}</span></div>
        <div class="sk-row"><span class="k">入库仓库</span><span class="v">${d.wh}</span></div>
        <div class="sk-row"><span class="k">创建时间</span><span class="v">${d.create}</span></div>
        <div class="sk-row"><span class="k">当前状态</span><span class="v"><span class="sk-tag ${IN_ST[d.status]}">${d.status}</span></span></div>
      </div>
      <div class="sk-sec">商品明细</div><div class="sk-box">${lines}</div>
      ${hasShort?`<div class="sk-note red"><b>存在短收</b>：仓库按实收数量入账，差额<b>不会自动补建</b>。如对实收数量有疑问，请凭供货单号 ${d.supply} 联系运营核对。</div>`
        :done?`<div class="sk-note">已全部入库并计入可售库存。</div>`
        :`<div class="sk-note blue">入库完成且库存同步成功后，这批货才会计入可售库存。</div>`}
      <div style="height:28px"></div>`});
}

/* ============ 主列表 ============ */
function renderMain(container){
  const state={tab:'stock',mode:'',quick:''};
  container.innerHTML=`
    <div class="sk-tabs" id="tb">
      <div class="t on" data-tab="stock">库存列表</div>
      <div class="t" data-tab="transit">在途库存<span>${INBOUND.filter(d=>d.status==='待入库'||d.status==='入库中').length}</span></div>
    </div>
    <div id="pane"></div>`;
  const pane=container.querySelector('#pane');

  const drawStock=()=>{
    let list=invRows(state.mode);
    if(state.quick==='out')list=list.filter(r=>r.sellable<=0);
    if(state.quick==='transit')list=list.filter(r=>r.transit>0);
    const base=invRows(state.mode);
    const cOut=base.filter(r=>r.sellable<=0).length,cTr=base.filter(r=>r.transit>0).length;
    const chip=(g,v,t,n)=>`<div class="sk-chip${state[g]===v?' on':''}" data-g="${g}" data-v="${v}">${t}${n!=null?` (${n})`:''}</div>`;

    const cards=list.map(r=>{const it=r.it,k=r.k,self=r.self;
      return `<div class="sk-card" data-item="${it.item}">
        <div class="sk-hd"><div><div class="sk-nm">${it.name} <span style="font-size:13px;font-weight:600;color:var(--sub)">${k.spec}</span></div>
          <div class="sk-sub">${k.skuId} · ${r.wh}</div></div>
          <div style="text-align:right">${flag(it)}<div style="margin-top:5px"><span class="sk-tag ${r.sellable<=0?'out':'ok'}">${r.sellable<=0?'缺货':'正常'}</span></div></div></div>
        <div class="sk-q4 ${self?'n3':'n4'}">
          <div class="c"><div class="l">可售库存</div><div class="v ${r.sellable<=0?'r':'g'}">${r.sellable}<span class="u">件</span></div></div>
          <div class="c"><div class="l">${self?'设置库存':'在库'}${r.shared?' ·共享':''}</div><div class="v">${r.stock}<span class="u">件</span></div></div>
          <div class="c"><div class="l">已占用</div><div class="v m">${r.locked||'—'}</div></div>
          ${self?'':`<div class="c"><div class="l">在途</div><div class="v ${r.transit?'b':'m'}">${r.transit||'—'}</div></div>`}
        </div>
        <div class="sk-spec">${self?`库存模式 <b>${SMODE[k.stockMode]}</b>　·　与其他规格互相独立`
          :r.shared?`1 件 = <b>${k.ratio}${it.unit}</b>　·　该仓实物 <b>${r.raw}${r.rawUnit}</b>，<b>与本商品其他规格共用</b>`
                   :`1 件 = <b>${k.ratio}${it.unit}</b>　·　该仓实物 <b>${r.raw}${r.rawUnit}</b>`}</div>
        ${self?`<div class="sk-acts"><div class="sk-btn" data-edit="${it.item}" data-sku="${k.skuId}">改库存</div></div>`:''}
      </div>`;}).join('');

    pane.innerHTML=`
      <div class="sk-bar"><div class="sk-search">${svg('search')}输入商品名称或编码</div></div>
      <div class="sk-chips" id="mc">${chip('mode','','全部')}${chip('mode','self','自售')}${chip('mode','consign','寄售')}</div>
      <div class="sk-chips" id="qc">${chip('quick','','全部',base.length)}${chip('quick','out','已缺货',cOut)}${chip('quick','transit','有在途',cTr)}</div>
      <div class="sk-note"><b>自售</b>库存由你自己维护，可直接「改库存」；<b>寄售</b>库存由仓库实物决定、<b>不可手工修改</b>，只能查看与追溯流水。</div>
      <div class="sk-list">${cards||`<div class="sk-empty"><div class="ei">${svg('layers')}</div><h4>${state.mode||state.quick?'当前筛选下没有库存':'暂无库存'}</h4><p>${state.mode||state.quick?'点上方标签取消筛选':'上架商品后，库存会在这里显示'}</p></div>`}</div>`;

    pane.querySelectorAll('.sk-card').forEach(c=>c.onclick=e=>{
      if(e.target.closest('[data-edit]'))return; openDetail(c.dataset.item);});
    pane.querySelectorAll('[data-edit]').forEach(b=>b.onclick=e=>{
      e.stopPropagation(); openEdit(b.dataset.edit,draw,b.dataset.sku);});
    pane.querySelectorAll('#mc .sk-chip,#qc .sk-chip').forEach(c=>c.onclick=()=>{
      state[c.dataset.g]=c.dataset.v; draw();});   // 两组均为互斥选择（含「全部」档），非 toggle
    pane.querySelector('.sk-search').onclick=()=>toast('搜索商品名称或编码');
  };

  const drawTransit=()=>{
    const cards=INBOUND.map(d=>{
      const plan=d.lines.reduce((a,l)=>a+l.plan,0),recv=d.lines.reduce((a,l)=>a+(l.recv||0),0);
      const short=d.status==='入库完成'&&recv<plan;
      return `<div class="sk-card" data-no="${d.no}">
        <div class="sk-hd"><div><div class="sk-nm">${d.lines.map(l=>l.name).join('、')}</div><div class="sk-sub">${d.supply}</div></div>
          <span class="sk-tag ${IN_ST[d.status]}">${d.status}</span></div>
        <div class="sk-q4 n4">
          <div class="c"><div class="l">仓库</div><div class="v" style="font-size:14px">${d.wh}</div></div>
          <div class="c"><div class="l">应收</div><div class="v">${plan}</div></div>
          <div class="c"><div class="l">实收</div><div class="v ${d.status==='待入库'||d.status==='已取消'?'m':''}">${d.status==='待入库'||d.status==='已取消'?'—':recv}</div></div>
          <div class="c"><div class="l">差异</div><div class="v ${short?'r':'m'}">${short?'-'+(plan-recv):'—'}</div></div>
        </div>
        <div class="sk-spec">${d.create}</div>
      </div>`;}).join('');
    pane.innerHTML=`
      <div class="sk-note blue">这里跟踪你<b>已送到仓、还没入库完成</b>的货（<b>仅寄售商品</b>——自售不入仓、无在途）。入库单由仓库按你的寄售供货单生成，商家端只读；<b>入库完成且同步成功后才计入可售库存</b>。</div>
      <div class="sk-list">${cards||`<div class="sk-empty"><div class="ei">${svg('truck')}</div><h4>暂无在途入库</h4><p>送货到仓后，入库进度会在这里显示</p></div>`}</div>`;
    pane.querySelectorAll('.sk-card').forEach(c=>c.onclick=()=>openInbound(c.dataset.no));
  };

  const draw=()=>{pane.innerHTML=`<div style="padding:16px">${skel(3)}</div>`;
    setTimeout(state.tab==='stock'?drawStock:drawTransit,420);};

  container.querySelectorAll('#tb .t').forEach(t=>t.onclick=()=>{
    container.querySelectorAll('#tb .t').forEach(x=>x.classList.remove('on'));
    t.classList.add('on');state.tab=t.dataset.tab;state.quick='';draw();
  });
  draw();
}

function openStock(){pushPage({title:'库存管理',body:'<div id="sk-root"></div>',mount:(p)=>renderMain(p.querySelector('#sk-root'))});}

window.FM_MOD=window.FM_MOD||{};
window.FM_MOD.stock=openStock;
})();
