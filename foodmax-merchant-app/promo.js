/* Food Max 商家端 v2 · 特价活动（商家自主特价 · 商家 100% 出资）
   与 PC pc-modules/promo.js 同一套口径（框架 PRD/scm_商家特价活动_功能框架.md）：
     · 活动价=未税价，>0 且 < 当前未税售价；含税=活动价×(1+税率 9%)；预计到手=含税−佣金(含税×服务费率)−揽收费
     · 限购 每客户每日 N 件，留空不限；立减金额=原价−活动价（未税）
     · 同一 SKU 时间重叠只能在 1 个活动内，跨出资方互斥（平台活动占用的 SKU 只显示「平台活动」）
     · 状态 0 待开始 / 1 进行中 / 2 已结束 / 4 已终止；无草稿；进行中只读（对齐运营平台 D11），可终止 / 复制新建；活动链接与门店范围界面不展示
     · 差价 100% 商家承担，不进平台优惠、不影响商家应付；佣金按活动价成交额计；不审核、平台可强制终止 */
(function(){
const {pushPage,popPage,toast,confirmDialog,sheet,svg,skel}=window.FM;
const css=document.createElement('style');
css.textContent=`
.pm-bar{position:sticky;top:0;z-index:6;background:var(--bg);padding:6px 16px 10px;}
.pm-pills{display:flex;gap:8px;overflow-x:auto;}.pm-pills::-webkit-scrollbar{display:none;}
.pm-pill{flex:0 0 auto;min-height:40px;display:flex;align-items:center;padding:0 15px;border-radius:20px;font-size:13.5px;font-weight:600;background:#fff;color:#27433A;box-shadow:var(--sh-sm);cursor:pointer;}
.pm-pill.on{background:var(--emerald);color:#fff;box-shadow:0 6px 16px rgba(5,150,105,.28);}
.pm-pill .c{opacity:.7;margin-left:3px;}
.pm-note{margin:0 16px 4px;font-size:12px;color:var(--sub);line-height:1.6;}
.pm-list{padding:10px 16px 90px;}
.pm-card{background:#fff;border-radius:20px;padding:15px;margin-bottom:13px;box-shadow:var(--sh-sm);}
.pm-card .hd{display:flex;align-items:flex-start;gap:10px;}
.pm-card .nm{font-size:16.5px;font-weight:700;line-height:1.25;flex:1;min-width:0;}
.pm-card .id{font-size:11.5px;color:var(--sub);margin-top:3px;font-weight:500;}
.pm-st{flex:0 0 auto;font-size:11.5px;font-weight:700;padding:3px 10px;border-radius:20px;}
.pm-st.s0{background:#E1EBFF;color:#2563EB;}.pm-st.s1{background:var(--mint-soft);color:var(--emerald-2);}.pm-st.s2{background:var(--muted);color:var(--sub);}.pm-st.s4{background:var(--red-soft);color:var(--red);}
.pm-card .tm{font-size:13px;color:#27433A;margin-top:10px;}
.pm-card .kpis{display:flex;margin:12px 0 4px;padding:11px 0;border-top:1px solid var(--line);border-bottom:1px solid var(--line);}
.pm-card .kpis .k{flex:1;}.pm-card .kpis .k .v{font-size:18px;font-weight:600;font-family:'Lora',serif;}.pm-card .kpis .k .l{font-size:11.5px;color:var(--sub);margin-top:1px;}
.pm-card .acts{display:flex;justify-content:flex-end;gap:8px;margin-top:10px;}
.pm-card .a{min-height:38px;padding:0 15px;border-radius:10px;font-size:13px;font-weight:700;display:flex;align-items:center;background:var(--muted);color:#27433A;cursor:pointer;}
.pm-card .a.pri{background:var(--emerald);color:#fff;}.pm-card .a.dgr{color:var(--red);background:var(--red-soft);}
.pm-warn{margin-top:9px;padding:8px 10px;border-radius:10px;background:var(--red-soft);color:var(--red);font-size:12.5px;line-height:1.5;}
.pm-fab{position:absolute;right:16px;bottom:22px;z-index:8;min-height:48px;padding:0 20px;border-radius:24px;background:var(--emerald);color:#fff;font-weight:700;font-size:14.5px;display:flex;align-items:center;gap:6px;box-shadow:0 10px 24px rgba(5,150,105,.35);cursor:pointer;}
.pm-fab svg{width:18px;height:18px;stroke:#fff;fill:none;stroke-width:2.4;}
/* 表单 */
.pm-sec{background:#fff;border-radius:18px;margin:12px 16px 0;padding:6px 15px;box-shadow:var(--sh-sm);}
.pm-sec .st{font-size:12.5px;color:var(--sub);font-weight:700;padding:10px 0 4px;}
.pm-row{display:flex;align-items:center;min-height:50px;border-bottom:1px solid var(--line);gap:10px;}
.pm-row:last-child{border-bottom:none;}
.pm-row .lb{flex:0 0 84px;font-size:14px;color:#27433A;}.pm-row .lb b{color:var(--red);}
.pm-row input,.pm-row .val{flex:1;min-width:0;border:none;outline:none;background:transparent;font-size:14.5px;text-align:right;color:var(--ink);font-family:inherit;}
.pm-row input:disabled{color:var(--sub);}
.pm-row .val{color:var(--sub);}
.pm-hint{font-size:11.5px;color:#94A3B8;padding:8px 0 10px;line-height:1.6;}
.pm-tip{margin:12px 16px 0;padding:10px 12px;border-radius:12px;background:#E1EBFF;color:#1E40AF;font-size:12.5px;line-height:1.55;}
.pm-sku{background:#fff;border-radius:18px;margin:12px 16px 0;padding:14px 15px;box-shadow:var(--sh-sm);}
.pm-sku .top{display:flex;gap:10px;align-items:flex-start;}
.pm-sku .nm{flex:1;min-width:0;font-size:15px;font-weight:700;}
.pm-sku .nm .c{display:block;font-size:12px;color:var(--sub);font-weight:500;margin-top:2px;}
.pm-sku .rm{flex:0 0 auto;color:var(--red);font-size:13px;font-weight:700;min-height:32px;display:flex;align-items:center;}
.pm-sku .grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:10px 12px;margin-top:10px;}
.pm-sku .f{min-width:0;}
.pm-sku .f .l{font-size:11.5px;color:var(--sub);}
.pm-sku .f .in{display:flex;align-items:center;gap:4px;border:1.5px solid var(--line);border-radius:11px;height:42px;padding:0 10px;margin-top:4px;background:#fff;}
.pm-sku .f .in.bad{border-color:var(--red);}
.pm-sku .f .in .u{font-size:13px;color:var(--sub);}
.pm-sku .f .in input{flex:1;min-width:0;border:none;outline:none;font-size:15.5px;font-weight:700;font-family:'Lora',serif;background:transparent;}
.pm-sku .f .in input:disabled{color:var(--sub);}
.pm-sku .f .ro{min-height:42px;display:flex;align-items:center;flex-wrap:wrap;margin-top:4px;font-size:15px;font-weight:600;font-family:'Lora',serif;color:#27433A;}
.pm-sku .f .ro.red{color:var(--red);}
.pm-sku .f .ro.grn{color:var(--emerald-2);}
.pm-sku .err{font-size:11.5px;color:var(--red);margin-top:6px;}
.pm-sku .soft{font-size:11.5px;color:#B45309;margin-top:6px;}
.pm-add{margin:12px 16px 0;min-height:48px;border-radius:14px;border:1.5px dashed var(--emerald);color:var(--emerald);font-weight:700;font-size:14px;display:flex;align-items:center;justify-content:center;gap:6px;cursor:pointer;background:#fff;}
/* 选品 */
.pk-search{display:flex;align-items:center;gap:9px;background:#fff;border-radius:15px;height:44px;padding:0 14px;box-shadow:var(--sh-sm);margin:6px 16px 10px;}
.pk-search input{flex:1;border:none;outline:none;font-size:14px;background:transparent;font-family:inherit;}
.pk-item{display:flex;align-items:center;gap:12px;background:#fff;border-radius:16px;padding:13px 14px;margin:0 16px 10px;box-shadow:var(--sh-sm);min-height:64px;}
.pk-item.dis{opacity:.55;}
.pk-item .chk{width:24px;height:24px;border-radius:50%;border:2px solid #CBD5C7;flex:0 0 24px;display:flex;align-items:center;justify-content:center;}
.pk-item .chk.on{background:var(--emerald);border-color:var(--emerald);}
.pk-item .chk.on::after{content:"✓";color:#fff;font-size:14px;font-weight:700;}
.pk-item .bd{flex:1;min-width:0;}
.pk-item .n{font-size:14.5px;font-weight:700;}
.pk-item .s{font-size:12px;color:var(--sub);margin-top:3px;}
.pk-item .s b{color:var(--emerald-2);font-family:'Lora',serif;}
.pk-item .occ{font-size:11px;font-weight:700;padding:2px 8px;border-radius:20px;background:var(--amber-soft);color:#B45309;margin-top:5px;display:inline-block;}
.pk-item .occ.plat{background:#E1EBFF;color:#2563EB;}
/* 详情 */
.pm-dl{background:#fff;border-radius:18px;margin:12px 16px 0;padding:4px 15px;box-shadow:var(--sh-sm);}
.pm-dl .r{display:flex;justify-content:space-between;gap:12px;min-height:44px;align-items:center;border-bottom:1px solid var(--line);font-size:13.5px;}
.pm-dl .r:last-child{border-bottom:none;}
.pm-dl .r .k{color:var(--sub);flex:0 0 auto;}.pm-dl .r .v{text-align:right;color:#27433A;}
.pm-line{display:flex;gap:10px;padding:11px 0;border-bottom:1px solid var(--line);}
.pm-line:last-child{border-bottom:none;}
.pm-line .n{flex:1;min-width:0;font-size:14px;font-weight:700;}
.pm-line .n .c{display:block;font-size:12px;color:var(--sub);font-weight:500;margin-top:3px;line-height:1.5;}
.pm-line .p{text-align:right;flex:0 0 auto;}
.pm-line .p .a{font-size:16px;font-weight:700;color:var(--red);font-family:'Lora',serif;}
.pm-line .p .o{font-size:11.5px;color:#94A3B8;text-decoration:line-through;}
.pm-line .p .d{font-size:11px;color:var(--sub);margin-top:2px;}
.pm-log{padding:9px 0;border-bottom:1px dashed var(--line);font-size:12.5px;line-height:1.5;}
.pm-log:last-child{border-bottom:none;}
.pm-log .t{color:var(--sub);}
.pm-ineff{font-size:10.5px;font-weight:700;padding:1px 7px;border-radius:20px;background:var(--amber-soft);color:#B45309;margin-left:5px;vertical-align:middle;}
.pm-empty{text-align:center;padding:60px 24px;color:var(--sub);}
.pm-empty .ic{width:64px;height:64px;border-radius:20px;background:var(--mint-soft);margin:0 auto 12px;display:flex;align-items:center;justify-content:center;}
.pm-empty .ic svg{width:28px;height:28px;stroke:var(--emerald);fill:none;stroke-width:2;}
.pm-empty h4{font-size:16px;color:var(--ink);margin:0 0 6px;}
.pm-empty p{font-size:13px;line-height:1.6;margin:0;}
`;
document.head.appendChild(css);

/* ===== 本店 SKU（与 goods.js 同店数据的扁平镜像；价格=未税，税率 9%） ===== */
const RATE=0.09,SVC=0.05,PICKUP=0.00;   // 演示简化：固定税率/服务费率；真实实现按 SKU taxRate 与 /product/commission/rate 取值（同 goods.js 改价页）
const SKUS=[
  {id:'SKU0125-01',n:'鲜丰 · 嫩豆腐 1kg',spec:'1kg/袋',price:9.99,stock:200,refund:1,unit:'kg'},
  {id:'SKU0125-02',n:'鲜丰 · 嫩豆腐 1kg',spec:'2kg/箱',price:19.50,stock:120},
  {id:'SKU0125-03',n:'鲜丰 · 老豆腐',spec:'2.5kg/盒',price:11.99,stock:168},
  {id:'SKU0125-04',n:'鲜丰 · 小油豆腐',spec:'2斤/袋',price:8.80,stock:150},
  {id:'SKU0125-05',n:'鲜丰 · 小油豆腐',spec:'5斤/箱',price:20.80,stock:0},
  {id:'SKU0125-06',n:'鲜丰 · 千张',spec:'500g/袋',price:6.20,stock:90},
  {id:'SKU0125-07',n:'鲜丰 · 豆干',spec:'1kg/袋',price:7.50,stock:75},
  {id:'SKU0125-08',n:'鲜丰 · 腐竹',spec:'250g/袋',price:5.40,stock:210},
  {id:'SKU0125-09',n:'鲜丰 · 豆浆 1L',spec:'1L/瓶',price:2.80,stock:300},
  {id:'SKU0125-10',n:'鲜丰 · 豆浆 1L',spec:'12瓶/箱',price:31.00,stock:40},
];
const sku=id=>SKUS.find(s=>s.id==id);

const pad=n=>(''+n).padStart(2,'0');
const fmt=d=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
const shift=(days,h,m)=>{const d=new Date();d.setDate(d.getDate()+days);d.setHours(h,m||0,0,0);return fmt(d);};
const now=()=>fmt(new Date());
const toLocal=s=>s?s.replace(' ','T'):'';const fromLocal=s=>s?s.replace('T',' ').slice(0,16):'';
const money=n=>'S$'+(+n||0).toFixed(2);
const WHO='陈志强';
let SEQ=130;
const ACTS=[
  {id:'AC118',url:'https://m.foodexmart.com/activity/special?id=AC118',fund:1,name:'豆制品周中特惠',start:shift(-2,0,0),end:shift(3,23,59),status:1,createdBy:WHO,createdAt:shift(-3,10,12),updatedAt:shift(-3,10,12),
    items:[{skuId:'SKU0125-01',orig:9.99,price:8.50,limit:20},{skuId:'SKU0125-04',orig:8.80,price:6.90,limit:null}],
    logs:[{t:shift(-3,10,12),who:WHO,act:'创建活动',d:'2 个 SKU'}]},
  {id:'AC121',url:'https://m.foodexmart.com/activity/special?id=AC121',fund:1,name:'千张清仓',start:shift(2,0,0),end:shift(4,23,59),status:0,createdBy:WHO,createdAt:shift(-1,16,40),updatedAt:shift(-1,16,40),
    items:[{skuId:'SKU0125-06',orig:6.20,price:4.90,limit:10}],logs:[{t:shift(-1,16,40),who:WHO,act:'创建活动',d:'1 个 SKU'}]},
  {id:'AC102',url:'https://m.foodexmart.com/activity/special?id=AC102',fund:1,name:'8 月豆浆促销',start:'2026-08-20 00:00',end:'2026-08-31 23:59',status:2,createdBy:WHO,createdAt:'2026-08-18 09:30',updatedAt:'2026-08-31 23:59',
    items:[{skuId:'SKU0125-09',orig:2.80,price:2.30,limit:null},{skuId:'SKU0125-10',orig:31.00,price:26.00,limit:5}],
    logs:[{t:'2026-08-18 09:30',who:WHO,act:'创建活动',d:'2 个 SKU'},{t:'2026-08-31 23:59',who:'系统',act:'到期结束',d:''}]},
  {id:'AC109',url:'https://m.foodexmart.com/activity/special?id=AC109',fund:1,name:'腐竹限时',start:'2026-08-28 00:00',end:'2026-09-05 23:59',status:4,endedBy:'platform',endReason:'活动价低于平台价格监管下限，运营强制终止（客服已通知）',createdBy:WHO,createdAt:'2026-08-27 14:05',updatedAt:'2026-08-29 11:20',
    items:[{skuId:'SKU0125-08',orig:5.40,price:1.50,limit:null}],
    logs:[{t:'2026-08-27 14:05',who:WHO,act:'创建活动',d:'1 个 SKU'},{t:'2026-08-29 11:20',who:'平台运营',act:'强制终止',d:'活动价低于平台价格监管下限'}]},
  {id:'AC115',fund:0,name:'平台·9 月豆制品季',start:shift(-1,0,0),end:shift(6,23,59),status:1,items:[{skuId:'SKU0125-03',orig:11.99,price:9.60,limit:null}],logs:[]},
];
const ST={0:'待开始',1:'进行中',2:'已结束',4:'已终止'};
const stOf=a=>a.status==4?4:(now()<a.start?0:(now()>a.end?2:1));
const live=a=>[0,1].includes(stOf(a));
const overlap=(a,b)=>a.start<=b.end&&b.start<=a.end;
const occupiedBy=(skuId,range,exceptId)=>ACTS.find(a=>a.id!=exceptId&&live(a)&&a.items.some(x=>x.skuId==skuId)&&(!range||overlap(a,range)))||null;
const calc=it=>{const incl=(+it.price||0)*(1+RATE);return {incl,comm:incl*SVC,inc:incl-incl*SVC-PICKUP,disc:it.orig?(+it.price/it.orig*10):0,origIncl:(+it.orig||0)*(1+RATE)};};
const discTxt=d=>d>0?d.toFixed(1)+' 折':'—';
const cutTxt=it=>(+it.price>0&&it.orig>+it.price)?money(it.orig-(+it.price)):'—';
const lim=v=>(v==null||v==='')?'不限':`${v} 件/客/日`;
const effective=it=>{const s=sku(it.skuId);if(!s)return [false,'SKU 不存在'];if(s.off)return [false,'SKU 已下架'];return [true,''];};
/* BR-19：仅店铺管理员可写；子账号只读。原型演示态恒为管理员，真实实现取登录态 isAdmin */
let ADMIN=true;const noPerm=()=>{toast('仅店铺管理员可操作，子账号只读');return false;};
const stPill=a=>{const s=stOf(a);return `<span class="pm-st s${s}">${ST[s]}${s==4&&a.endedBy=='platform'?'·平台':''}</span>`;};

/* ===== 列表 ===== */
let TAB='all';
function openPromo(){
  pushPage({title:'商品特价',body:`<div id="pm-root"></div><div class="pm-fab" id="pm-fab" style="${ADMIN?'':'display:none'}"><svg viewBox='0 0 24 24'><path d='M12 5v14M5 12h14'/></svg>新建活动</div>`,
    mount:(p)=>{const root=p.querySelector('#pm-root');root.innerHTML=skel(3);setTimeout(()=>renderList(root),420);p.querySelector('#pm-fab').onclick=()=>openEdit(null,()=>renderList(root));}});
}
function renderList(root){
  const mine=ACTS.filter(a=>a.fund==1);const cnt=k=>mine.filter(a=>k=='all'||stOf(a)==+k).length;
  const rows=mine.filter(a=>TAB=='all'||stOf(a)==+TAB).sort((a,b)=>b.createdAt<a.createdAt?-1:1);
  root.innerHTML=`<div class="pm-bar"><div class="pm-pills">${[['all','全部'],['1','进行中'],['0','未开始'],['2','已结束'],['4','已终止']].map(x=>`<div class="pm-pill ${TAB==x[0]?'on':''}" data-t="${x[0]}">${x[1]}${cnt(x[0])?`<span class="c">${cnt(x[0])}</span>`:''}</div>`).join('')}</div></div>
  <div class="pm-note">差价由商家 100% 承担 · 佣金按活动价成交额计 · 提交即到点生效，无需平台审核</div>
  <div class="pm-list">${rows.map(a=>{const s=stOf(a);const ineff=a.items.filter(x=>!effective(x)[0]).length;
    return `<div class="pm-card" data-id="${a.id}">
      <div class="hd"><div class="nm">${a.name}<div class="id">${a.id} · ${a.items.length} 个 SKU</div></div>${stPill(a)}</div>
      <div class="tm">${a.start} ~ ${a.end}</div>
      <div class="kpis"><div class="k"><div class="v">${a.items.length}</div><div class="l">活动 SKU</div></div><div class="k"><div class="v">${lim(Math.min(...a.items.map(x=>x.limit==null?Infinity:x.limit))==Infinity?null:Math.min(...a.items.map(x=>x.limit==null?Infinity:x.limit))).replace(' 件/客/日','')}</div><div class="l">最低限购</div></div></div>
      ${s==4&&a.endedBy=='platform'?`<div class="pm-warn"><b>平台强制终止</b>：${a.endReason||''}</div>`:''}
      ${ineff&&s<2?`<div class="pm-warn" style="background:var(--amber-soft);color:#B45309">${ineff} 个 SKU 已下架，活动行不生效</div>`:''}
      <div class="acts"><div class="a" data-a="detail">详情</div>${ADMIN?`<div class="a" data-a="copy">复制</div>${s<2?`<div class="a dgr" data-a="stop">终止</div>`:''}${s==0?`<div class="a pri" data-a="edit">编辑</div>`:''}`:''}</div>
    </div>`;}).join('')||`<div class="pm-empty"><div class="ic">${svg('tag')}</div><h4>${TAB=='all'?'还没有商品特价活动':'该状态下暂无活动'}</h4><p>给本店 SKU 设活动价与起止时间，C 端按特价展示；差价由商家承担、佣金按活动价成交额计</p></div>`}</div>`;
  root.querySelectorAll('.pm-pill').forEach(el=>el.onclick=()=>{TAB=el.dataset.t;renderList(root);});
  root.querySelectorAll('.pm-card .a').forEach(el=>el.onclick=(e)=>{e.stopPropagation();const a=ACTS.find(x=>x.id==el.closest('.pm-card').dataset.id);
    if(el.dataset.a=='detail')openDetail(a,()=>renderList(root));
    if(el.dataset.a=='edit')openEdit(a,()=>renderList(root));
    if(el.dataset.a=='stop')stopAct(a,()=>renderList(root));
    if(el.dataset.a=='copy')copyAct(a,()=>renderList(root));});
  root.querySelectorAll('.pm-card').forEach(el=>el.onclick=()=>openDetail(ACTS.find(x=>x.id==el.dataset.id),()=>renderList(root)));
}

/* ===== 终止 ===== */
function stopAct(a,after){if(!ADMIN)return noPerm();const s=stOf(a);
  confirmDialog({title:`终止「${a.name}」？`,danger:1,okText:'确认终止',body:`${s==1?'终止后 C 端<b>立即</b>恢复原价，已生成订单不受影响；':'活动尚未开始，终止后不会生效；'}终止不可撤销，如需再做需新建活动。`,
    onOk:()=>{a.status=4;a.endedBy='merchant';a.updatedAt=now();a.logs.push({t:now(),who:WHO,act:'终止活动',d:s==1?'进行中终止，C 端已恢复原价':'未开始终止'});toast('活动已终止');after&&after();}});}

/* ===== 详情 ===== */
function openDetail(a,after){const s=stOf(a);const save=a.items.reduce((n,x)=>n+((x.orig-x.price)*(1+RATE)),0);
  pushPage({title:'活动详情',right:(ADMIN&&s==0)?'编辑':'',body:`
    <div class="pm-dl"><div class="r" style="min-height:56px"><div style="font-size:17px;font-weight:700">${a.name}<div style="font-size:11.5px;color:var(--sub);font-weight:500;margin-top:2px">${a.id}</div></div>${stPill(a)}</div>
      <div class="r"><span class="k">活动时间</span><span class="v">${a.start}<br>~ ${a.end}</span></div>
      <div class="r"><span class="k">出资方</span><span class="v"><b>商家 100%</b><br><span style="font-size:11.5px;color:var(--sub)">差价商家承担，不进平台优惠</span></span></div>
      <div class="r"><span class="k">叠加规则</span><span class="v">可与平台优惠券叠加<br><span style="font-size:11.5px;color:var(--sub)">券由平台承担</span></span></div>
      <div class="r"><span class="k">创建</span><span class="v">${a.createdBy||'—'} · ${a.createdAt||'—'}</span></div>
</div>
    ${s==1?`<div class="pm-tip">活动进行中<b>不可编辑</b>（与平台活动同规则）。要调整活动价 / 商品 / 时间：先终止本场，再用「复制新建」快速重建。</div>`:''}
    ${s==4?`<div class="pm-tip" style="${a.endedBy=='platform'?'background:var(--red-soft);color:var(--red)':''}"><b>${a.endedBy=='platform'?'平台强制终止':'商家终止'}</b>${a.endReason?'：'+a.endReason:''}。终止后 C 端已立即恢复原价；活动期间订单按活动价快照不受影响。</div>`:''}
    <div class="pm-dl" style="padding:10px 15px 4px"><div style="font-size:13px;font-weight:700;margin-bottom:2px">活动商品 <span style="font-weight:500;color:var(--sub);font-size:12px">${a.items.length} 个 · 单件让利合计(含税) ${money(save)}</span></div>
      ${a.items.map(x=>{const k=sku(x.skuId);const c=calc(x);const ef=effective(x);return `<div class="pm-line"><div class="n">${k?k.n:x.skuId}${s<2&&!ef[0]?`<span class="pm-ineff">不生效·${ef[1]}</span>`:''}<span class="c">${k?k.spec:''} · ${x.skuId}<br>限购 ${lim(x.limit)} · 预计到手/件 <b style="color:var(--emerald-2)">${money(c.inc)}</b></span></div><div class="p"><div class="a">${money(x.price)}</div><div class="o">${money(x.orig)}</div><div class="d">立减 ${cutTxt(x)} · 含税 ${money(c.incl)}</div></div></div>`;}).join('')}
      <div class="pm-hint">价格均为未税价；预计到手 = 活动含税价 − 佣金(活动含税价×服务费率 ${(SVC*100).toFixed(0)}%) − 揽收费。佣金按<b>活动价成交额</b>计，让利部分不再抽佣。</div></div>
    <div class="pm-dl" style="padding:10px 15px"><div style="font-size:13px;font-weight:700;margin-bottom:4px">操作日志</div>${a.logs.slice().reverse().map(l=>`<div class="pm-log"><span class="t">${l.t}</span> · <b>${l.who}</b> ${l.act}${l.d?`<div class="t">${l.d}</div>`:''}</div>`).join('')||'<div class="pm-hint">暂无</div>'}</div>
    <div style="height:16px"></div>`,
    footer:ADMIN?`<div style="display:flex;gap:10px">${s<2?`<button class="btn" style="flex:1;background:var(--red-soft);color:var(--red)" id="pd-stop">终止活动</button>`:''}<button class="btn" style="flex:1;background:var(--muted);color:#27433A" id="pd-copy2">复制新建</button>${s==0?`<button class="btn primary" style="flex:1.4" id="pd-edit">编辑</button>`:''}</div>`:`<div style="text-align:center;font-size:12.5px;color:var(--sub);padding:6px 0">子账号只读 · 仅店铺管理员可编辑 / 终止 / 复制</div>`,
    mount:(p)=>{const re=()=>{popPage();setTimeout(()=>{after&&after();openDetail(ACTS.find(x=>x.id==a.id),after);},320);};
      const ed=p.querySelector('#pd-edit');if(ed)ed.onclick=()=>openEdit(a,re);const nr=p.querySelector('#nr');if(nr&&s==0)nr.onclick=()=>openEdit(a,re);
      const cp2=p.querySelector('#pd-copy2');if(cp2)cp2.onclick=()=>copyAct(a,()=>{popPage();setTimeout(()=>after&&after(),320);});
      const stp=p.querySelector('#pd-stop');if(stp)stp.onclick=()=>stopAct(a,()=>{popPage();setTimeout(()=>after&&after(),320);});}});}

/* ===== 新建 / 编辑 ===== */
function copyAct(a,after){if(!ADMIN)return noPerm();const liveSrc=live(a);const st0=liveSrc?(()=>{const d=new Date(toLocal(a.end));d.setMinutes(d.getMinutes()+1);return fmt(d);})():shift(1,0,0);const en0=(()=>{const d=new Date(toLocal(st0));d.setDate(d.getDate()+7);d.setHours(23,59,0,0);return fmt(d);})();
  const range={start:st0,end:en0};let dropped=0,cleared=0,conflict=0;const items=[];
  a.items.forEach(x=>{const s=sku(x.skuId);if(!s||s.off){dropped++;return;}if(occupiedBy(x.skuId,range,a.id))conflict++;let price=x.price;if(!(price>0&&price<s.price)){price='';cleared++;}items.push({skuId:x.skuId,orig:s.price,price,limit:x.limit});});
  toast(`已复制 ${items.length} 个 SKU${dropped?`，${dropped} 个因下架未带入`:''}${cleared?`，${cleared} 个活动价需重填`:''}${conflict?`，${conflict} 个撞期提交时会拦截`:''}`);
  openEdit(null,after,{name:(a.name+'（复制）').slice(0,50),start:range.start,end:range.end,items});}
function openEdit(a,after,preset){if(!ADMIN)return noPerm();const isNew=!a;const st=isNew?-1:stOf(a);
  if(!isNew&&st!=0){toast(st==1?'进行中活动不可编辑：请先终止，再复制新建':'已结束/已终止的活动不可编辑，可复制新建');return;}
  const ED=preset?{id:null,name:preset.name,start:preset.start,end:preset.end,items:preset.items}:{id:isNew?null:a.id,name:isNew?'':a.name,start:isNew?shift(1,0,0):a.start,end:isNew?shift(7,23,59):a.end,items:isNew?[]:a.items.map(x=>({...x}))};
  pushPage({title:isNew?'新建特价活动':'编辑活动',body:`
    <div class="pm-sec"><div class="st">基本信息 · 出资方 商家 100% · 可与平台券叠加</div>
      <div class="pm-row"><div class="lb"><b>*</b>活动名称</div><input id="pe-name" maxlength="50" value="${ED.name}" placeholder="仅商家内部可见，≤50 字"></div>
      <div class="pm-row"><div class="lb"><b>*</b>开始时间</div><input type="datetime-local" id="pe-start" value="${toLocal(ED.start)}" min="${toLocal(now())}"></div>
      <div class="pm-row"><div class="lb"><b>*</b>结束时间</div><input type="datetime-local" id="pe-end" value="${toLocal(ED.end)}" min="${toLocal(ED.start)}"></div>
      <div class="pm-hint">开始不早于当前；结束晚于开始且单场 ≤ 30 天；到点自动开始 / 结束，C 端同步切换活动价 / 原价。</div></div>
    <div id="pe-items"></div>
    <div class="pm-add" id="pe-add"><svg viewBox='0 0 24 24'><path d='M12 5v14M5 12h14'/></svg>添加商品</div>
    <div class="pm-hint" style="padding:10px 16px 16px">活动价为<b>未税价</b>，须低于当前未税售价；预计到手 = 活动含税价 − 佣金 − 揽收费，仅供参考。</div>`,
    footer:`<button class="btn primary" id="pe-sub">${isNew?'提交活动':'保存修改'}</button>`,
    mount:(p)=>{
      const box=p.querySelector('#pe-items');
      const draw=()=>{box.innerHTML=ED.items.map((x,k)=>{const s=sku(x.skuId);const c=calc(x);const v=+x.price;const bad=x.price!==''&&x.price!=null&&(!(v>0)||v>=x.orig);const low=v>0&&v<x.orig*0.3;
        return `<div class="pm-sku" data-k="${k}"><div class="top"><div class="nm">${s?s.n:x.skuId}<span class="c">${s?s.spec:''} · ${x.skuId}${s&&s.refund?' · 多退少补(每 '+(s.unit||'kg')+' 活动价)':''}</span></div><div class="rm" data-rm>移除</div></div>
          <div class="grid">
            <div class="f"><div class="l">当前未税售价</div><div class="ro">${money(x.orig)}<span style="font-size:11px;color:var(--sub);font-family:inherit;font-weight:500;margin-left:6px">含税 ${money(c.origIncl)}</span></div></div>
            <div class="f"><div class="l">活动价(未税) <b style="color:var(--red)">*</b></div><div class="in ${bad?'bad':''}"><span class="u">S$</span><input data-price inputmode="decimal" value="${x.price===''||x.price==null?'':(+x.price).toFixed(2)}" placeholder="< ${(+x.orig).toFixed(2)}"></div></div>
            <div class="f"><div class="l">活动含税价 / 立减</div><div class="ro red" data-incl>${v>0?money(c.incl)+' · 立减 '+cutTxt(x):'—'}</div></div>
            <div class="f"><div class="l">预计到手/件</div><div class="ro grn" data-inc>${v>0?money(c.inc):'—'}</div></div>
            <div class="f" style="grid-column:1/-1"><div class="l">限购（件/客/日）</div><div class="in"><input data-limit inputmode="numeric" value="${x.limit==null?'':x.limit}" placeholder="留空 = 不限购"></div></div>
          </div>${bad?`<div class="err">须 &gt;0 且低于当前售价 ${money(x.orig)}</div>`:low?`<div class="soft">低于售价 30%，提交时需二次确认</div>`:''}</div>`;}).join('')||`<div class="pm-sec" style="text-align:center;padding:22px 15px;color:var(--sub);font-size:13px">还没有添加商品<br><span style="font-size:12px">从本店在售 SKU 中选择；已在其他活动（含平台活动）中的 SKU 不可选</span></div>`;
        box.querySelectorAll('.pm-sku').forEach(card=>{const k=+card.dataset.k;const x=ED.items[k];
          const pi=card.querySelector('[data-price]');pi.oninput=()=>{x.price=pi.value===''?'':+pi.value;const c=calc(x);const v=+x.price;const bad=x.price!==''&&(!(v>0)||v>=x.orig);pi.closest('.in').classList.toggle('bad',bad);card.querySelector('[data-incl]').textContent=v>0?money(c.incl)+' · 立减 '+cutTxt(x):'—';card.querySelector('[data-inc]').textContent=v>0?money(c.inc):'—';};
          pi.onblur=draw;
          const li=card.querySelector('[data-limit]');li.oninput=()=>{x.limit=li.value===''?null:Math.max(1,parseInt(li.value)||1);};
          card.querySelector('[data-rm]').onclick=()=>{ED.items.splice(k,1);draw();};});};
      const flash=(k)=>{const card=box.querySelectorAll('.pm-sku')[k];if(!card)return;card.scrollIntoView({behavior:'smooth',block:'center'});card.style.boxShadow='0 0 0 2px var(--red)';setTimeout(()=>{card.style.boxShadow='';},2000);};
      draw();
      const gv=id=>(p.querySelector('#'+id)||{}).value||'';
      const sync=()=>{ED.name=gv('pe-name').trim();ED.start=fromLocal(gv('pe-start'));ED.end=fromLocal(gv('pe-end'));};
      p.querySelector('#pe-add').onclick=()=>{sync();openPick(ED,()=>draw());};
      p.querySelector('#pe-sub').onclick=()=>{sync();
        if(!ED.name)return toast('请填写活动名称');if(ED.name.length>50)return toast('活动名称不超过 50 字');
        if(!ED.start||!ED.end)return toast('请填写活动起止时间');
        if(isNew&&ED.start<now())return toast('开始时间不能早于当前');
        if(ED.end<=ED.start)return toast('结束时间必须晚于开始时间');
        if((new Date(toLocal(ED.end))-new Date(toLocal(ED.start)))>30*86400000)return toast('单场活动最长 30 天');
        if(!ED.items.length)return toast('至少添加 1 个活动商品');
        for(let k=0;k<ED.items.length;k++){const x=ED.items[k];const s=sku(x.skuId);const nm=s?s.n+' '+s.spec:x.skuId;const ef=effective(x);if(!ef[0]){flash(k);return toast(`「${nm}」${ef[1]}，请移除后再提交`);}if(s)x.orig=s.price;
          if(!(+x.price>0)){flash(k);return toast(`「${nm}」请填写活动价`);}if(+x.price>=x.orig){flash(k);return toast(`「${nm}」活动价须低于当前售价 ${money(x.orig)}`);}
          const occ=occupiedBy(x.skuId,{start:ED.start,end:ED.end},ED.id);if(occ){flash(k);return toast(`「${nm}」已在${occ.fund==0?'平台活动':'活动《'+occ.name+'》'}中，至 ${occ.end}`);}}
        const lows=ED.items.filter(x=>+x.price<x.orig*0.3);
        const go=()=>{const b=p.querySelector('#pe-sub');b.classList.add('loading');setTimeout(()=>{save(ED,isNew,a);b.classList.remove('loading');toast(isNew?'活动已提交':'已保存');setTimeout(()=>{popPage();after&&after();},500);},600);};
        if(lows.length)confirmDialog({title:'活动价偏低，确认提交？',okText:'确认提交',body:`有 <b>${lows.length}</b> 个 SKU 活动价低于当前售价的 <b>30%</b>，差价全部由商家承担。`,onOk:go});else go();};
    }});}
function save(ED,isNew,a){const items=ED.items.map(x=>({skuId:x.skuId,orig:x.orig,price:+(+x.price).toFixed(2),limit:x.limit}));
  if(isNew){const nid='AC'+(++SEQ);const n={id:nid,url:'https://m.foodexmart.com/activity/special?id='+nid,fund:1,name:ED.name,start:ED.start,end:ED.end,status:0,createdBy:WHO,createdAt:now(),updatedAt:now(),items,logs:[{t:now(),who:WHO,act:'创建活动',d:`${items.length} 个 SKU · ${ED.start} ~ ${ED.end}`}]};ACTS.unshift(n);return;}
  const before=a.items.map(x=>x.skuId),after=items.map(x=>x.skuId);const chg=[];
  if(a.name!=ED.name)chg.push(`名称「${a.name}」→「${ED.name}」`);if(a.start!=ED.start)chg.push(`开始 ${a.start} → ${ED.start}`);if(a.end!=ED.end)chg.push(`结束 ${a.end} → ${ED.end}`);
  const add=after.filter(x=>!before.includes(x)),rm=before.filter(x=>!after.includes(x));if(add.length)chg.push('新增 SKU '+add.join('、'));if(rm.length)chg.push('移除 SKU '+rm.join('、'));
  a.items.forEach(o=>{const n=items.find(x=>x.skuId==o.skuId);if(n&&(n.price!=o.price||n.limit!=o.limit))chg.push(`${o.skuId} 活动价 ${money(o.price)}→${money(n.price)} / 限购 ${lim(o.limit)}→${lim(n.limit)}`);});
  a.name=ED.name;a.start=ED.start;a.end=ED.end;a.items=items;a.updatedAt=now();a.logs.push({t:now(),who:WHO,act:'编辑活动',d:chg.join('；')||'无字段变化'});}

/* ===== 选品 ===== */
function openPick(ED,after){const range={start:ED.start,end:ED.end};let q='';const sel=new Set();
  pushPage({title:'添加活动商品',body:`<div class="pk-search">${svg('search')}<input id="pk-q" placeholder="搜索商品名称 / SKU 编码"></div><div class="pm-note" style="margin-bottom:8px">仅本店在售 SKU · 已在其他活动中的 SKU 不可选（活动时间 ${range.start} ~ ${range.end}）</div><div id="pk-list"></div><div style="height:16px"></div>`,
    footer:`<button class="btn primary" id="pk-ok" disabled>加入活动</button>`,
    mount:(p)=>{const list=p.querySelector('#pk-list'),ok=p.querySelector('#pk-ok');
      const draw=()=>{const rows=SKUS.filter(s=>!s.off&&(!q||s.n.toLowerCase().includes(q)||s.id.toLowerCase().includes(q)));
        list.innerHTML=rows.map(s=>{const inEd=ED.items.some(x=>x.skuId==s.id);const occ=inEd?null:occupiedBy(s.id,range,ED.id);const dis=inEd||!!occ;
          return `<div class="pk-item ${dis?'dis':''}" data-id="${s.id}"><div class="chk ${sel.has(s.id)?'on':''}" style="${dis?'visibility:hidden':''}"></div><div class="bd"><div class="n">${s.n}</div><div class="s">${s.spec} · ${s.id} · 未税 <b>${money(s.price)}</b> · 库存 ${s.stock}${s.refund?' · 多退少补':''}</div>${inEd?'<span class="occ" style="background:var(--muted);color:var(--sub)">已在本活动</span>':occ?`<span class="occ ${occ.fund==0?'plat':''}">已在${occ.fund==0?'平台活动':'活动《'+occ.name+'》'}中 · 至 ${occ.end.slice(5)}</span>`:''}</div></div>`;}).join('')||`<div class="pm-empty"><h4>没有匹配的在售 SKU</h4></div>`;
        list.querySelectorAll('.pk-item:not(.dis)').forEach(el=>el.onclick=()=>{const id=el.dataset.id;sel.has(id)?sel.delete(id):sel.add(id);draw();});
        ok.disabled=!sel.size;ok.textContent=sel.size?`加入活动（${sel.size}）`:'加入活动';};
      draw();p.querySelector('#pk-q').oninput=(e)=>{q=e.target.value.trim().toLowerCase();draw();};
      ok.onclick=()=>{sel.forEach(id=>{const s=sku(id);ED.items.push({skuId:id,orig:s.price,price:'',limit:null});});toast(`已加入 ${sel.size} 个 SKU，请填写活动价`);popPage();after&&after();};}});}

/* ===== 营销活动 · 子菜单页（与 PC 侧栏「营销活动 > 商品特价」对齐） ===== */
function openMkt(){
  pushPage({title:'营销活动',body:`<div class="pm-dl" style="margin-top:14px;padding:4px 15px">
    <div class="r" id="mk-promo" style="min-height:64px;cursor:pointer"><div style="display:flex;align-items:center;gap:12px"><div style="width:42px;height:42px;border-radius:13px;background:var(--red-soft);display:flex;align-items:center;justify-content:center"><svg viewBox="0 0 24 24" style="width:20px;height:20px;stroke:var(--red);fill:none;stroke-width:2"><path d="M20 12l-8 8-9-9V3h8l9 9z"/><circle cx="7.5" cy="7.5" r="1.4"/></svg></div><div><div style="font-size:15px;font-weight:700">商品特价</div><div style="font-size:12px;color:var(--sub);margin-top:2px">给本店 SKU 设活动价 · 差价商家 100% 承担</div></div></div><div style="display:flex;align-items:center;gap:8px"><span style="font-size:12px;color:var(--emerald-2);font-weight:700">${ACTS.filter(a=>a.fund==1&&stOf(a)==1).length} 进行中</span><svg viewBox="0 0 24 24" style="width:18px;height:18px;stroke:#94A3B8;fill:none;stroke-width:2"><path d="M9 6l6 6-6 6"/></svg></div></div>
  </div>
  <div class="pm-hint" style="padding:12px 16px">更多玩法（满减 / 满赠 / 优惠券）后续开放。</div>`,
    mount:(p)=>{p.querySelector('#mk-promo').onclick=openPromo;}});
}
/* F8 商品列表联动（供 goods.js 调用）：按 商品名 + 规格 匹配本模块 SKU */
const skuByNS=(n,spec)=>SKUS.find(s=>s.n===n&&s.spec===spec);
const promoOf=(id)=>ACTS.find(a=>a.fund==1&&live(a)&&a.items.some(x=>x.skuId==id))||null;
window.FM_PROMO={
  badge:(n,spec)=>{const s=skuByNS(n,spec);const a=s&&promoOf(s.id);if(!a)return '';const it=a.items.find(x=>x.skuId==s.id);const on=stOf(a)==1;return ` <span style="display:inline-block;font-size:10.5px;font-weight:700;padding:1px 7px;border-radius:20px;background:${on?'var(--red-soft)':'#E1EBFF'};color:${on?'var(--red)':'#2563EB'};vertical-align:middle">${on?'特价中':'特价待开始'} ${money(it.price)}</span>`;},
  guard:(n,spec,newPrice)=>{const s=skuByNS(n,spec);const a=s&&promoOf(s.id);if(!a)return true;const it=a.items.find(x=>x.skuId==s.id);if(newPrice<=it.price){toast(`该 SKU 在特价活动《${a.name}》中，活动价 ${money(it.price)}；新售价须高于活动价，或先终止活动`);return false;}it.orig=newPrice;s.price=newPrice;return true;},
};
window.FM_MOD=window.FM_MOD||{};
window.FM_MOD.mkt=openMkt;
window.FM_MOD.promo=openPromo;
})();
