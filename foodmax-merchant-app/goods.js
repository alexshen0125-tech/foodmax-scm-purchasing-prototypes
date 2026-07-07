/* Food Max 商家端 v2 · 商品模块
   数据驱动配色(emerald) + 评审修复内建：骨架屏/空态/破坏性确认/批量多选/44px/SG数据
   PC 对齐(2026-07)：价格+库存到每个 SKU / 上下架细到 SKU / 状态只留销售中·未上架 / 去库存预警
   税价对齐(2026-07)：价格维护未税价，默认税率 9%，SKU 行与改价页自动展示含税价（只读） */
(function(){
const {pushPage,popPage,toast,confirmDialog,sheet,svg,skel}=window.FM;

const css=document.createElement('style');
css.textContent=`
.gd-bar{position:sticky;top:0;z-index:6;background:var(--bg);padding:6px 16px 10px;}
.gd-search{display:flex;align-items:center;gap:9px;background:#fff;border-radius:15px;height:44px;padding:0 14px;box-shadow:var(--sh-sm);color:var(--sub);font-size:14px;}
.gd-search svg{width:18px;height:18px;stroke:var(--sub);fill:none;stroke-width:2;}
.gd-filters{display:flex;gap:8px;margin-top:11px;overflow-x:auto;}.gd-filters::-webkit-scrollbar{display:none;}
.gd-pill{flex:0 0 auto;min-height:40px;display:flex;align-items:center;padding:0 16px;border-radius:20px;font-size:13.5px;font-weight:600;background:#fff;color:#27433A;box-shadow:var(--sh-sm);cursor:pointer;}
.gd-pill.on{background:var(--emerald);color:#fff;box-shadow:0 6px 16px rgba(5,150,105,.28);}
.gd-pill .c{opacity:.7;margin-left:3px;}
.gd-sub{display:flex;align-items:center;justify-content:space-between;padding:6px 8px 0;font-size:12.5px;color:var(--sub);}
.gd-sub .mng{color:var(--emerald);font-weight:700;min-height:44px;display:flex;align-items:center;}
.gd-list{padding:12px 16px 16px;}
.pc{background:#fff;border-radius:20px;padding:15px;margin-bottom:13px;box-shadow:var(--sh-sm);display:flex;gap:12px;}
.pc .chk{width:24px;height:24px;border-radius:50%;border:2px solid #CBD5C7;flex:0 0 24px;margin-top:22px;display:none;align-items:center;justify-content:center;cursor:pointer;}
.pc.manage .chk{display:flex;}
.pc .chk.on{background:var(--emerald);border-color:var(--emerald);}
.pc .chk.on::after{content:"✓";color:#fff;font-size:14px;font-weight:700;}
.pc .body{flex:1;min-width:0;}
.pc .top{display:flex;gap:13px;}
.pc .img{width:66px;height:66px;border-radius:14px;flex:0 0 66px;background:var(--mint-soft);display:flex;align-items:center;justify-content:center;font-size:30px;}
.pc .nm{font-size:16.5px;font-weight:700;line-height:1.2;}
.pc .sp{font-size:12.5px;color:var(--sub);margin-top:3px;}
.pc .tag{display:inline-block;margin-top:7px;font-size:10.5px;font-weight:700;padding:2px 8px;border-radius:20px;}
.pc .tag.rec{background:var(--amber-soft);color:#B45309;}
.pc .tag.bad{display:block;margin-top:8px;padding:8px 10px;border-radius:10px;background:var(--red-soft);color:var(--red);cursor:pointer;}
.pc .kpis{display:flex;margin:13px 0 4px;padding:12px 0;border-top:1px solid var(--line);border-bottom:1px solid var(--line);}
.pc .kpis .k{flex:1;}.pc .kpis .k .v{font-size:19px;font-weight:600;font-family:'Lora',serif;}.pc .kpis .k .l{font-size:11.5px;color:var(--sub);margin-top:1px;}
/* SKU 列表：每个售卖规格独立 价格/库存/上下架 */
.pc .skus{margin-top:2px;}
.pc .sku{display:flex;align-items:center;gap:10px;padding:11px 0;border-bottom:1px solid var(--line);}
.pc .sku:last-child{border-bottom:none;}
.pc .sku .sm{flex:1;min-width:0;}
.pc .sku .sm .ss{font-size:14px;font-weight:700;color:#27433A;}
.pc .sku .sm .sd{font-size:12.5px;color:var(--sub);margin-top:3px;}
.pc .sku .sm .sd b{color:var(--emerald-2);font-weight:700;font-family:'Lora',serif;}
.pc .sku .sm .sd .oos{color:var(--red);font-weight:700;}
.pc .sku .rt{text-align:right;flex:0 0 auto;}
.pc .sku .sk-tg{min-height:34px;padding:0 15px;border-radius:9px;font-size:12.5px;font-weight:700;display:flex;align-items:center;justify-content:center;cursor:pointer;}
.pc .sku .sk-tg.on{background:var(--muted);color:#27433A;}
.pc .sku .sk-tg.off{background:var(--mint-soft);color:var(--emerald-2);}
.pc .sku .sk-st{font-size:11px;color:var(--sub);margin-top:4px;}
.pc .acts{display:flex;gap:9px;margin-top:14px;}
.pc .acts .a{flex:1;min-height:44px;display:flex;align-items:center;justify-content:center;border-radius:11px;font-size:13.5px;font-weight:600;cursor:pointer;background:var(--muted);color:#27433A;}
.bulkbar{display:flex;align-items:center;gap:10px;}
.bulkbar .all{display:flex;align-items:center;gap:7px;font-size:14px;font-weight:600;min-height:44px;cursor:pointer;}
.bulkbar .all .b{width:22px;height:22px;border-radius:50%;border:2px solid #CBD5C7;display:flex;align-items:center;justify-content:center;}
.bulkbar .all .b.on{background:var(--emerald);border-color:var(--emerald);}.bulkbar .all .b.on::after{content:"✓";color:#fff;font-size:12px;}
.bulkbar .sp{flex:1;font-size:13px;color:var(--sub);}
.bulkbar button{min-height:44px;padding:0 16px;border-radius:11px;font-size:14px;font-weight:700;border:none;cursor:pointer;font-family:inherit;}
.bulkbar .up{background:var(--emerald);color:#fff;}.bulkbar .px{background:var(--muted);color:var(--ink);}
/* 空态 */
.empty{display:flex;flex-direction:column;align-items:center;justify-content:center;padding:70px 40px;gap:14px;text-align:center;}
.empty .ei{width:96px;height:96px;border-radius:28px;background:var(--mint-soft);display:flex;align-items:center;justify-content:center;}
.empty .ei svg{width:42px;height:42px;stroke:var(--emerald-2);fill:none;stroke-width:1.4;}
.empty h4{font-size:17px;font-weight:700;}.empty p{font-size:13px;color:var(--sub);}
/* 逐 SKU 改价/改库存编辑器 */
.sku-ed{background:#fff;border-radius:16px;margin:12px 16px;padding:2px 16px;box-shadow:var(--sh-sm);}
.sku-ed .r{display:flex;align-items:center;gap:12px;padding:14px 0;border-top:1px solid var(--line);}
.sku-ed .r:first-child{border-top:none;}
.sku-ed .r .nm{flex:1;min-width:0;font-size:14.5px;font-weight:700;}
.sku-ed .r .nm .c{font-size:12px;color:var(--sub);font-weight:400;margin-top:2px;}
.sku-ed .r .in{width:128px;background:var(--muted);border-radius:11px;min-height:44px;display:flex;align-items:center;padding:0 12px;gap:4px;border:1.5px solid transparent;}
.sku-ed .r .in:focus-within{border-color:var(--emerald);background:#fff;}
.sku-ed .r .in input{border:none;background:transparent;outline:none;width:100%;font-size:15px;font-family:inherit;text-align:right;}
.sku-ed .r .in .u{font-size:13px;color:var(--sub);}
.sku-ed-tip{font-size:12.5px;color:var(--sub);margin:6px 20px 0;}
`;
document.head.appendChild(css);

// 当前时间戳(SPU / SKU 更新时各自独立打点)
function ts(){const d=new Date();const p=n=>(''+n).padStart(2,'0');return d.getFullYear()+'-'+p(d.getMonth()+1)+'-'+p(d.getDate())+' '+p(d.getHours())+':'+p(d.getMinutes());}
// SG 数据 —— 每个商品含 skus[]，价格/库存/上下架均到 SKU；创建/更新时间 SPU 与 SKU 独立
const PRODUCTS=[
  {ic:'🥬',n:'鲜丰 · 嫩豆腐 1kg',cat:'新鲜蔬菜',rec:1,sales:4,createdAt:'2026-06-20 09:12',updatedAt:'2026-07-01 14:30',
   skus:[{spec:'1kg/袋',price:9.99,stock:9995,off:false,createdAt:'2026-06-20 09:12',updatedAt:'2026-07-01 14:30'},{spec:'2kg/箱',price:19.50,stock:120,off:false,createdAt:'2026-06-25 10:00',updatedAt:'2026-06-25 10:00'}]},
  {ic:'🧈',n:'鲜丰 · 老豆腐',cat:'新鲜蔬菜',sales:17,createdAt:'2026-06-18 16:40',updatedAt:'2026-06-28 11:05',
   skus:[{spec:'2.5kg/盒',price:11.99,stock:168,off:false,createdAt:'2026-06-18 16:40',updatedAt:'2026-06-28 11:05'}]},
  {ic:'🍢',n:'鲜丰 · 小油豆腐',cat:'新鲜蔬菜',sales:9,createdAt:'2026-06-15 08:20',updatedAt:'2026-06-30 09:50',
   skus:[{spec:'2斤/袋',price:8.80,stock:430,off:false,createdAt:'2026-06-15 08:20',updatedAt:'2026-06-30 09:50'},{spec:'5斤/箱',price:20.80,stock:0,off:false,createdAt:'2026-06-15 08:20',updatedAt:'2026-06-22 13:10'}]},
  {ic:'🥗',n:'冻 · 盐渍海带丝',cat:'海鲜水产',bad:'商品信息有误，已被限流',sales:0,createdAt:'2026-06-10 15:00',updatedAt:'2026-06-12 17:22',
   skus:[{spec:'4kg/箱',price:29.99,stock:0,off:true,createdAt:'2026-06-10 15:00',updatedAt:'2026-06-12 17:22'}]},
  {ic:'🟡',n:'萝卜丸子',cat:'肉禽蛋品',sales:0,createdAt:'2026-06-08 11:30',updatedAt:'2026-06-09 10:00',
   skus:[{spec:'2.5kg/袋',price:12.00,stock:4,off:true,createdAt:'2026-06-08 11:30',updatedAt:'2026-06-09 10:00'}]},
];
const isOnShelf=p=>p.skus.some(s=>!s.off);           // 销售中 = 至少 1 个 SKU 在架
const totalStock=p=>p.skus.reduce((a,s)=>a+(+s.stock||0),0);
// GST：价格维护未税价，默认税率 9%，系统自动算含税价（仅展示、不可编辑）
const GST_DEFAULT=9;
const taxRate=p=>{const t=parseFloat(String(p&&p.tax!=null?p.tax:'').replace('%',''));return isNaN(t)?GST_DEFAULT:t;};
const priceIncl=(net,p)=>(+net||0)*(1+taxRate(p)/100);   // 含税价 = 未税价 ×(1+税率)

function card(g,manage){
  const skuHtml=g.skus.map((s,i)=>{
    const oos=(+s.stock<=0);
    const st=s.off?'已下架':(oos?'售罄':'在售');
    const stockTxt=s.off?'—':(oos?'<span class="oos">0（售罄）</span>':(+s.stock).toLocaleString());
    return `<div class="sku"><div class="sm">
        <div class="ss">${s.spec}</div>
        <div class="sd"><b>S$${(+s.price||0).toFixed(2)}</b> 未税 · 库存 ${stockTxt}</div>
        <div class="sd" style="font-size:11.5px;color:#94A3B8;margin-top:2px">含税 S$${priceIncl(s.price,g).toFixed(2)}（税率 ${taxRate(g)}%）</div>
        ${s.updatedAt?`<div class="sd" style="font-size:11px;color:#94A3B8;margin-top:2px">更新 ${s.updatedAt}</div>`:''}</div>
      <div class="rt"><div class="sk-tg ${s.off?'off':'on'}" data-sku="${i}">${s.off?'上架':'下架'}</div>
        <div class="sk-st">${st}</div></div></div>`;
  }).join('');
  return `<div class="pc${manage?' manage':''}">
    <div class="chk" data-chk></div>
    <div class="body">
      <div class="top"><div class="img">${g.ic}</div>
        <div style="flex:1"><div class="nm">${g.n}</div><div class="sp">${g.cat} · ${g.skus.length} 个规格${g.updatedAt?` · 更新 ${g.updatedAt}`:''}</div>
          ${g.rec?'<span class="tag rec">商机推荐</span>':''}
          ${g.bad?`<div class="tag bad" data-bad>⚠ ${g.bad} ›</div>`:''}</div></div>
      <div class="kpis"><div class="k"><div class="v">${g.sales}</div><div class="l">今日销量</div></div><div class="k"><div class="v">${totalStock(g).toLocaleString()}</div><div class="l">总库存</div></div></div>
      <div class="skus">${skuHtml}</div>
      ${manage?'':`<div class="acts">${['改价格','改库存','更多'].map(a=>`<div class="a" data-a="${a}">${a}</div>`).join('')}</div>`}
    </div></div>`;
}

function bind(el,g,state){
  const chk=el.querySelector('[data-chk]');
  chk.onclick=()=>{chk.classList.toggle('on');g._sel=chk.classList.contains('on');state.refreshBulk();};
  if(g._sel)chk.classList.add('on');
  // 逐 SKU 上下架（即时生效无需审核；上下架均二次确认，SKU 与 SPU 各自打更新时间）
  el.querySelectorAll('[data-sku]').forEach(b=>b.onclick=()=>{
    const s=g.skus[+b.dataset.sku];
    const to=s.off?'上架':'下架';
    const doIt=()=>{s.off=!s.off;s.updatedAt=ts();g.updatedAt=ts();toast(`「${g.n} ${s.spec}」已${s.off?'下架':'上架'}（即时生效，无需审核）`);state.redraw();};
    confirmDialog({title:`确认${to}该规格？`,body:`「${g.n} ${s.spec}」${to}后${s.off?'客户即可下单':'客户将无法下单，可随时重新上架'}。`,danger:!s.off,okText:to,onOk:doIt});
  });
  el.querySelectorAll('.acts .a').forEach(b=>b.onclick=()=>{
    const a=b.dataset.a;
    if(a==='改价格')openPrice(g);
    else if(a==='改库存')openStock(g);
    else openMore(g,state);
  });
  const bad=el.querySelector('[data-bad]');if(bad)bad.onclick=()=>showSupplement();
}

function renderList(container,inTab){
  container.innerHTML=`
    ${inTab?`<div class="hm-top" style="padding:14px 20px 6px"><div class="hm-store"><div class="nm disp" style="font-size:24px">商品</div></div><div class="hm-bell">${svg('search')}</div></div>`:''}
    <div class="gd-bar">
      ${inTab?'':`<div class="gd-search">${svg('search')}搜索商品名称 / 编码 / SKU</div>`}
      <div class="gd-filters" id="f">
        <div class="gd-pill on" data-t="sale">销售中<span class="c" id="c-sale"></span></div>
        <div class="gd-pill" data-t="off">未上架<span class="c" id="c-off"></span></div>
      </div>
    </div>
    <div class="gd-sub"><span id="sort">上架时间 · 由近及远</span><span class="mng" id="mng">管理</span></div>
    <div class="gd-list" id="l"></div>`;
  const list=container.querySelector('#l');
  const sortEl=container.querySelector('#sort');
  const mngEl=container.querySelector('#mng');
  const state={tab:'sale',manage:false,refreshBulk(){},redraw(){}};

  const refreshCounts=()=>{
    const c1=container.querySelector('#c-sale'),c2=container.querySelector('#c-off');
    if(c1)c1.textContent=PRODUCTS.filter(isOnShelf).length;
    if(c2)c2.textContent=PRODUCTS.filter(p=>!isOnShelf(p)).length;
  };
  const drawData=(tab)=>{
    refreshCounts();
    const data=PRODUCTS.filter(p=>tab==='sale'?isOnShelf(p):!isOnShelf(p));
    if(!data.length){
      list.innerHTML=`<div class="empty"><div class="ei">${svg('box')}</div><h4>暂无${tab==='sale'?'销售中':'未上架'}商品</h4><p>${tab==='sale'?'上架任一规格后会出现在这里':'发布你的第一款商品开始经营'}</p></div>`;
      return;
    }
    list.innerHTML='';
    data.forEach(g=>{const w=document.createElement('div');w.innerHTML=card(g,state.manage);const c=w.firstElementChild;list.appendChild(c);bind(c,g,state);});
  };
  state.redraw=()=>drawData(state.tab);
  const draw=(tab)=>{
    state.tab=tab;sortEl.textContent=(tab==='sale'?'上架':'下架')+'时间 · 由近及远';
    list.innerHTML=skel(3);                       // 骨架屏(H1)
    setTimeout(()=>drawData(tab),420);            // 模拟加载
  };
  container.querySelectorAll('#f .gd-pill').forEach(p=>p.onclick=()=>{
    const t=p.dataset.t;
    container.querySelectorAll('#f .gd-pill').forEach(x=>x.classList.remove('on'));
    p.classList.add('on');if(state.manage)exitManage();draw(t);
  });

  // 批量管理(H7)
  function enterManage(){state.manage=true;mngEl.textContent='完成';drawData(state.tab);showBulkBar();}
  function exitManage(){state.manage=false;mngEl.textContent='管理';hideBulkBar();drawData(state.tab);}
  mngEl.onclick=()=>state.manage?exitManage():enterManage();

  let bulkBar;
  function showBulkBar(){
    bulkBar=document.createElement('div');bulkBar.className='page-footer';bulkBar.style.cssText='position:absolute;left:0;right:0;bottom:0;z-index:8';
    bulkBar.innerHTML=`<div class="bulkbar"><div class="all" id="ba"><span class="b"></span>全选</div><span class="sp" id="bc">已选 0</span><button class="px" id="bpx">批量改价</button><button class="up" id="bup">批量上架</button></div>`;
    container.appendChild(bulkBar);
    const data=()=>PRODUCTS.filter(p=>state.tab==='sale'?isOnShelf(p):!isOnShelf(p));
    state.refreshBulk=()=>{const n=data().filter(g=>g._sel).length;bulkBar.querySelector('#bc').textContent='已选 '+n;
      bulkBar.querySelector('#ba .b').classList.toggle('on',n===data().length&&n>0);};
    bulkBar.querySelector('#ba').onclick=()=>{const d=data();const allOn=d.every(g=>g._sel);d.forEach(g=>g._sel=!allOn);drawData(state.tab);state.refreshBulk();};
    bulkBar.querySelector('#bup').onclick=()=>{const sel=data().filter(g=>g._sel);if(!sel.length)return toast('请先选择商品');
      confirmDialog({title:`批量上架 ${sel.length} 款商品？`,body:'将上架所选商品的全部售卖规格。',okText:'上架',onOk:()=>{sel.forEach(g=>{g.skus.forEach(s=>{s.off=false;s.updatedAt=ts();});g.updatedAt=ts();g._sel=false;});toast(`已上架 ${sel.length} 款（全部规格）`);exitManage();}});};
    bulkBar.querySelector('#bpx').onclick=()=>{const n=data().filter(g=>g._sel).length;if(!n)return toast('请先选择商品');toast(`批量改价 ${n} 款`);};
    state.refreshBulk();
  }
  function hideBulkBar(){bulkBar&&bulkBar.remove();bulkBar=null;}

  draw('sale');
}

function openGoodsPush(){pushPage({title:'商品管理',body:'<div id="gp"></div>',footer:`<div style="display:flex;gap:12px"><button class="btn ghost" style="flex:1">商机推荐</button><button class="btn primary" style="flex:1.4" id="pub">发布商品</button></div>`,mount:(p)=>{renderList(p.querySelector('#gp'),false);p.querySelector('#pub').onclick=()=>window.FM_PUBLISH?window.FM_PUBLISH():toast('发布商品');}});}

// 改价格（逐 SKU，即时生效）
function openPrice(g){
  const rate=taxRate(g),factor=1+rate/100;
  pushPage({title:'改价格',body:`<div style="height:4px"></div>
    <div class="sku-ed">${g.skus.map((s,i)=>`
      <div class="r"><div class="nm">${g.n}<div class="c">${s.spec}</div></div>
        <div style="text-align:right">
          <div class="in"><span class="u">S$</span><input data-i="${i}" data-price value="${s.price||''}" inputmode="decimal" placeholder="未税价"></div>
          <div class="incl" data-incl="${i}" style="font-size:11.5px;color:#94A3B8;margin-top:5px">含税 S$${priceIncl(s.price,g).toFixed(2)}</div></div></div>`).join('')}</div>
    <div class="sku-ed-tip">价格维护到每个售卖规格(SKU)，录入<b>未税价</b>，系统按税率 ${rate}% 自动算含税价；提交后即时生效、无需审核。</div>
    <div style="height:10px"></div>`,
    footer:`<button class="btn primary" id="ps" disabled>提交改价</button>`,
    mount:(p)=>{
      const sub=p.querySelector('#ps');
      const check=()=>{let anyValid=false,anyErr=false;
        p.querySelectorAll('[data-price]').forEach(inp=>{const v=inp.value.trim();const box=inp.closest('.in');
          const incl=p.querySelector(`[data-incl="${inp.dataset.i}"]`);
          const n=parseFloat(v);
          if(incl)incl.textContent='含税 S$'+((isNaN(n)?0:n)*factor).toFixed(2);
          if(!v){box.style.borderColor='';return;}
          const bad=isNaN(n)||n<=0||n>9999;box.style.borderColor=bad?'var(--red)':'';
          if(bad)anyErr=true;else anyValid=true;});
        sub.disabled=!(anyValid&&!anyErr);};
      p.querySelectorAll('[data-price]').forEach(i=>i.oninput=check);
      sub.onclick=()=>{sub.classList.add('loading');setTimeout(()=>{
        p.querySelectorAll('[data-price]').forEach(inp=>{const n=parseFloat(inp.value);if(!isNaN(n)&&n>0){const sk=g.skus[+inp.dataset.i];sk.price=n;sk.updatedAt=ts();}});g.updatedAt=ts();
        sub.classList.remove('loading');toast('改价成功，即时生效');setTimeout(popPage,600);},700);};
    }});
}

// 改库存（逐 SKU，即时生效）
function openStock(g){
  pushPage({title:'改库存',body:`<div style="height:4px"></div>
    <div class="sku-ed">${g.skus.map((s,i)=>`
      <div class="r"><div class="nm">${g.n}<div class="c">${s.spec}</div></div>
        <div class="in"><input data-i="${i}" data-stock value="${s.stock||0}" inputmode="numeric"></div></div>`).join('')}</div>
    <div class="sku-ed-tip">库存维护到每个售卖规格(SKU)，为 0 即售罄；提交后即时生效、无需审核。</div>
    <div style="height:10px"></div>`,
    footer:`<button class="btn primary" id="sv">保存</button>`,
    mount:(p)=>{
      const sv=p.querySelector('#sv');
      const check=()=>{let ok=true;p.querySelectorAll('[data-stock]').forEach(i=>{const n=parseInt(i.value,10);const bad=isNaN(n)||n<0;i.closest('.in').style.borderColor=bad?'var(--red)':'';if(bad)ok=false;});sv.disabled=!ok;};
      p.querySelectorAll('[data-stock]').forEach(i=>i.oninput=check);
      sv.onclick=()=>{sv.classList.add('loading');setTimeout(()=>{
        p.querySelectorAll('[data-stock]').forEach(inp=>{const n=parseInt(inp.value,10);if(!isNaN(n)&&n>=0){const sk=g.skus[+inp.dataset.i];sk.stock=n;sk.updatedAt=ts();}});g.updatedAt=ts();
        sv.classList.remove('loading');toast('保存成功，即时生效');setTimeout(popPage,600);},700);};
    }});
}

function openMore(g,state){
  const on=isOnShelf(g);const n=g.skus.length;
  // SPU 整体上下架：二次确认，一次性作用于全部规格
  const spuToggle=()=>{
    const to=on?'下架':'上架';
    confirmDialog({title:`确认整体${to}该商品？`,body:`将${to}「${g.n}」的全部 ${n} 个规格，${on?'客户将无法下单':'客户即可下单'}，可随时调整。`,danger:on,okText:`整体${to}`,
      onOk:()=>{g.skus.forEach(s=>{s.off=on;s.updatedAt=ts();});g.updatedAt=ts();toast(`「${g.n}」全部规格已${to}`);state&&state.redraw();}});
  };
  sheet([
    {label:on?`整体下架（全部 ${n} 规格）`:`整体上架（全部 ${n} 规格）`,onClick:spuToggle},
    {label:'编辑商品',onClick:()=>toast('编辑商品')},
    {label:'复制商品',onClick:()=>toast('复制商品')},
    {label:'分享给客户',onClick:()=>toast('分享给客户')},
    {label:'删除商品',danger:1,onClick:()=>confirmDialog({title:'确认删除该商品？',body:`「${g.n}」删除后不可恢复，历史订单不受影响。`,danger:1,okText:'删除',onOk:()=>toast('已删除')})},
  ]);
}
function showSupplement(){
  confirmDialog({title:'商品信息缺失',body:'当前商品缺少必要属性，不符合治理规则，已被限流。补充信息后可恢复曝光。',okText:'去补充',onOk:()=>toast('前往补充信息')});
}

window.FM_MOD=window.FM_MOD||{};
window.FM_MOD.goods=openGoodsPush;
window.FM_MOD.goodsInline=(c)=>renderList(c,true);
})();
