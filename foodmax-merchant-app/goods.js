/* Food Max 商家端 v2 · 商品模块
   数据驱动配色(emerald) + 评审修复内建：骨架屏/空态/破坏性确认/批量多选/即时校验+预计收入联动/44px/SG数据 */
(function(){
const {pushPage,popPage,toast,confirmDialog,sheet,svg,skel}=window.FM;
const COMMISSION=0.05; // 平台佣金率，用于预计收入联动

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
.pc .kpis{display:flex;margin:13px 0;padding:12px 0;border-top:1px solid var(--line);border-bottom:1px solid var(--line);}
.pc .kpis .k{flex:1;}.pc .kpis .k .v{font-size:19px;font-weight:600;font-family:'Lora',serif;}.pc .kpis .k .l{font-size:11.5px;color:var(--sub);margin-top:1px;}
.pc .prices .r{display:flex;justify-content:space-between;padding:4px 0;font-size:13px;}
.pc .prices .r .ct{color:#46604F;}.pc .prices .r .ct .sd{font-size:9.5px;border:1px solid var(--line);color:var(--sub);padding:0 4px;border-radius:4px;margin-left:5px;}
.pc .prices .r .pv{font-weight:600;}
.pc .more{font-size:12.5px;color:var(--emerald);font-weight:700;margin-top:5px;cursor:pointer;min-height:24px;}
.pc .acts{display:flex;gap:9px;margin-top:14px;}
.pc .acts .a{flex:1;min-height:44px;display:flex;align-items:center;justify-content:center;border-radius:11px;font-size:13.5px;font-weight:600;cursor:pointer;background:var(--muted);color:#27433A;position:relative;}
.pc .acts .a.key{background:var(--mint-soft);color:var(--emerald-2);}
.pc .acts .a .oos{position:absolute;top:-8px;left:50%;transform:translateX(-50%);background:var(--red);color:#fff;font-size:9px;padding:1px 5px;border-radius:6px;}
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
/* 改价 */
.fcard{background:#fff;border-radius:18px;margin:12px 16px;padding:16px;box-shadow:var(--sh-sm);}
.fcard .fg{display:flex;align-items:center;gap:11px;margin-bottom:14px;}.fcard .fg .fi{width:46px;height:46px;border-radius:12px;background:var(--mint-soft);display:flex;align-items:center;justify-content:center;font-size:22px;}.fcard .fg .fn{font-size:16px;font-weight:700;}
.fcard .rn{font-size:16px;font-weight:700;margin-bottom:6px;}
.fcard .cur{font-size:12.5px;color:var(--sub);margin-bottom:12px;}.fcard .cur b{color:var(--ink);}
.ipts{display:flex;gap:10px;}
.ipt{flex:1;background:var(--muted);border-radius:12px;min-height:46px;display:flex;align-items:center;padding:0 12px;gap:5px;border:1.5px solid transparent;}
.ipt.err{border-color:var(--red);background:var(--red-soft);}
.ipt:focus-within{border-color:var(--emerald);background:#fff;}
.ipt input{flex:1;border:none;background:transparent;outline:none;font-size:15px;font-family:inherit;width:100%;}
.ipt .u{font-size:13px;color:var(--sub);}
.errmsg{color:var(--red);font-size:11.5px;margin-top:6px;min-height:14px;}
.fmeta{margin-top:8px;font-size:13px;color:var(--sub);display:flex;justify-content:space-between;}
.fmeta b{color:var(--emerald-2);font-weight:700;font-family:'Lora',serif;}
/* 改库存 */
.st-seg{display:flex;background:#fff;border-radius:14px;margin:12px 16px;padding:4px;box-shadow:var(--sh-sm);}
.st-seg .s{flex:1;text-align:center;min-height:40px;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:600;color:var(--sub);border-radius:11px;}
.st-seg .s.on{background:var(--emerald);color:#fff;}
.st-grp{background:#fff;border-radius:18px;margin:12px 16px;padding:16px;box-shadow:var(--sh-sm);}
.st-grp .gh{display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;}.st-grp .gh .gn{font-size:16px;font-weight:700;}.st-grp .gh .ge{font-size:13px;color:var(--emerald);font-weight:700;}
.st-line{display:flex;align-items:center;margin:13px 0;}.st-line .lk{width:74px;font-size:13.5px;color:#46604F;}
.st-mode{display:flex;background:var(--muted);border-radius:11px;padding:3px;}.st-mode .o{min-height:38px;display:flex;align-items:center;padding:0 13px;font-size:12.5px;border-radius:9px;color:var(--sub);cursor:pointer;}.st-mode .o.on{background:#fff;color:var(--emerald-2);font-weight:700;box-shadow:var(--sh-sm);}
.st-num{flex:1;background:var(--muted);border-radius:11px;min-height:42px;display:flex;align-items:center;padding:0 13px;}.st-num input{border:none;background:transparent;outline:none;width:100%;font-size:15px;font-family:inherit;}
.st-line .hint{font-size:12.5px;color:var(--sub);margin-left:10px;}.st-line .hint b{color:var(--emerald);}
.st-wh{display:flex;justify-content:space-between;align-items:center;font-size:13.5px;padding:7px 0;color:#27433A;}
.st-wh .t{font-size:9.5px;border:1px solid var(--amber);color:#B45309;padding:0 4px;border-radius:4px;margin-left:6px;}
`;
document.head.appendChild(css);

// SG 数据
const REGIONS=['中区','东区','西区','北区'];
const SALE=[
  {ic:'🥬',n:'鲜丰 · 嫩豆腐 1kg',sp:'2斤/袋',rec:1,sales:4,stock:9995,
   pr:[['中区','S$9.99/袋','S$5.00/斤'],['东区','S$9.99/袋','S$5.00/斤'],['西区','S$10.05/袋','S$5.03/斤',1]],
   more:[['北区','S$10.05/袋','S$5.03/斤',1]]},
  {ic:'🧈',n:'鲜丰 · 老豆腐',sp:'2.5kg/盒',sales:17,stock:168,
   pr:[['中区','S$11.99/盒','S$2.40/斤'],['东区','S$11.99/盒','S$2.40/斤'],['西区','S$11.99/盒','S$2.40/斤',1]]},
  {ic:'🍢',n:'鲜丰 · 小油豆腐',sp:'2斤/袋',sales:9,stock:430,
   pr:[['中区','S$8.80/袋','S$4.40/斤'],['北区','S$8.99/袋','S$4.50/斤',1]]},
];
const OFF=[
  {ic:'🥗',n:'冻 · 盐渍海带丝',sp:'4kg/箱',bad:'商品信息有误，已被限流',sales:0,stock:0,oos:1,
   pr:[['中区','S$–',''],['东区','S$–',''],['西区','S$29.99/箱','S$3.75/斤']]},
  {ic:'🟡',n:'萝卜丸子',sp:'2.5kg/袋',sales:0,stock:4,oos:1,pr:[['中区','S$–',''],['东区','S$–',''],['西区','S$–','']]},
];
const DRAFT=[]; // 演示空态

function priceRows(l){return l.map(p=>`<div class="r"><span class="ct">${p[0]}${p[3]?'<span class="sd">代送</span>':''}</span><span class="pv">${p[1]}${p[2]?'　'+p[2]:''}</span></div>`).join('');}

function card(g,sold,manage){
  const acts=(sold?['下架','改价格','改库存','更多']:['上架','改价格','改库存','更多']);
  return `<div class="pc${manage?' manage':''}">
    <div class="chk" data-chk></div>
    <div class="body">
      <div class="top"><div class="img">${g.ic}</div>
        <div style="flex:1"><div class="nm">${g.n}</div><div class="sp">售卖规格 · ${g.sp}</div>
          ${g.rec?'<span class="tag rec">商机推荐</span>':''}
          ${g.bad?`<div class="tag bad" data-bad>⚠ ${g.bad} ›</div>`:''}</div></div>
      <div class="kpis"><div class="k"><div class="v">${g.sales}</div><div class="l">今日销量</div></div><div class="k"><div class="v">${g.stock.toLocaleString()}</div><div class="l">剩余库存</div></div></div>
      <div class="prices">${priceRows(g.pr)}${g.more?'<div class="more" data-more>展开全部售卖区域 ›</div>':''}</div>
      ${manage?'':`<div class="acts">${acts.map(a=>`<div class="a ${a==='改库存'?'key':''}" data-a="${a}">${a==='改库存'&&g.oos?'<span class="oos">缺货</span>':''}${a}</div>`).join('')}</div>`}
    </div></div>`;
}

function bind(el,g,sold,state){
  const chk=el.querySelector('[data-chk]');
  chk.onclick=()=>{chk.classList.toggle('on');g._sel=chk.classList.contains('on');state.refreshBulk();};
  if(g._sel)chk.classList.add('on');
  el.querySelectorAll('.acts .a').forEach(b=>b.onclick=()=>{
    const a=b.dataset.a;
    if(a==='改价格')openPrice(g);
    else if(a==='改库存')openStock(g);
    else if(a==='上架'){toast('已提交上架');}
    else if(a==='下架'){confirmDialog({title:'确认下架该商品？',body:`「${g.n}」下架后客户将无法看到和下单，可随时重新上架。`,danger:1,okText:'下架',onOk:()=>toast('已下架')});}
    else openMore(g,sold);
  });
  const more=el.querySelector('[data-more]');if(more)more.onclick=()=>{if(g._x)return;g._x=1;el.querySelector('.prices').insertAdjacentHTML('beforeend',priceRows(g.more));more.textContent='收起 ›';};
  const bad=el.querySelector('[data-bad]');if(bad)bad.onclick=()=>showSupplement();
}

function renderList(container,inTab){
  container.innerHTML=`
    ${inTab?`<div class="hm-top" style="padding:14px 20px 6px"><div class="hm-store"><div class="nm disp" style="font-size:24px">商品</div></div><div class="hm-bell">${svg('search')}</div></div>`:''}
    <div class="gd-bar">
      ${inTab?'':`<div class="gd-search">${svg('search')}搜索商品名称 / 编码</div>`}
      <div class="gd-filters" id="f">
        <div class="gd-pill on" data-t="sale">销售中<span class="c">73</span></div>
        <div class="gd-pill" data-t="off">未上架<span class="c">340</span></div>
        <div class="gd-pill" data-t="draft">草稿<span class="c">0</span></div>
        <div class="gd-pill" data-t="region">全部售卖区域</div>
      </div>
    </div>
    <div class="gd-sub"><span id="sort">上架时间 · 由近及远</span><span class="mng" id="mng">管理</span></div>
    <div class="gd-list" id="l"></div>`;
  const list=container.querySelector('#l');
  const sortEl=container.querySelector('#sort');
  const mngEl=container.querySelector('#mng');
  const state={tab:'sale',manage:false,refreshBulk(){}};

  const drawData=(tab)=>{
    const data=tab==='sale'?SALE:tab==='off'?OFF:DRAFT;
    data.forEach(g=>g._sel=false);
    if(!data.length){
      list.innerHTML=`<div class="empty"><div class="ei">${svg('box')}</div><h4>暂无${tab==='draft'?'草稿':'商品'}</h4><p>${tab==='draft'?'保存为草稿的商品会出现在这里':'发布你的第一款商品开始经营'}</p></div>`;
      return;
    }
    list.innerHTML='';
    data.forEach(g=>{g._x=0;const w=document.createElement('div');w.innerHTML=card(g,tab==='sale',state.manage);const c=w.firstElementChild;list.appendChild(c);bind(c,g,tab==='sale',state);});
  };
  const draw=(tab)=>{
    state.tab=tab;sortEl.textContent=(tab==='sale'?'上架':'下架')+'时间 · 由近及远';
    list.innerHTML=skel(3);                       // 骨架屏(H1)
    setTimeout(()=>drawData(tab),420);            // 模拟加载
  };
  container.querySelectorAll('#f .gd-pill').forEach(p=>p.onclick=()=>{
    const t=p.dataset.t;
    if(t==='region'){toast('选择售卖区域');return;}
    container.querySelectorAll('#f .gd-pill').forEach(x=>{if(['sale','off','draft'].includes(x.dataset.t))x.classList.remove('on');});
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
    const data=()=>state.tab==='sale'?SALE:state.tab==='off'?OFF:DRAFT;
    state.refreshBulk=()=>{const n=data().filter(g=>g._sel).length;bulkBar.querySelector('#bc').textContent='已选 '+n;
      bulkBar.querySelector('#ba .b').classList.toggle('on',n===data().length&&n>0);};
    bulkBar.querySelector('#ba').onclick=()=>{const d=data();const allOn=d.every(g=>g._sel);d.forEach(g=>g._sel=!allOn);drawData(state.tab);state.refreshBulk();};
    bulkBar.querySelector('#bup').onclick=()=>{const n=data().filter(g=>g._sel).length;if(!n)return toast('请先选择商品');
      confirmDialog({title:`批量上架 ${n} 款商品？`,okText:'上架',onOk:()=>{toast(`已提交上架 ${n} 款`);exitManage();}});};
    bulkBar.querySelector('#bpx').onclick=()=>{const n=data().filter(g=>g._sel).length;if(!n)return toast('请先选择商品');toast(`批量改价 ${n} 款`);};
    state.refreshBulk();
  }
  function hideBulkBar(){bulkBar&&bulkBar.remove();bulkBar=null;}

  draw('sale');
}

function openGoodsPush(){pushPage({title:'商品管理',body:'<div id="gp"></div>',footer:`<div style="display:flex;gap:12px"><button class="btn ghost" style="flex:1">商机推荐</button><button class="btn primary" style="flex:1.4" id="pub">发布商品</button></div>`,mount:(p)=>{renderList(p.querySelector('#gp'),false);p.querySelector('#pub').onclick=()=>window.FM_PUBLISH?window.FM_PUBLISH():toast('发布商品');}});}

// 改价格(即时校验 + 预计收入联动)
function openPrice(g){
  const u=g.sp.split('/')[1]||'箱';
  const regs=[{n:g.n+' · '+g.sp,goods:1,cur:g.pr[2]&&g.pr[2][1]!=='S$–'?`${g.pr[2][1]}（${g.pr[2][2]||''}）`:'–'},
    {n:'东区',cur:'–'},{n:'西区',cur:'S$29.99/箱（S$3.75/斤）'},{n:'北区',cur:'–'}];
  const blocks=regs.map((r,i)=>`<div class="fcard" data-i="${i}">
    ${r.goods?`<div class="fg"><div class="fi">${g.ic}</div><div class="fn">${r.n}</div></div>`:`<div class="rn">${r.n}</div>`}
    <div class="cur">当前价格 · <b>${r.cur}</b></div>
    <div class="ipts"><div class="ipt"><span class="u">S$</span><input data-price placeholder="新价格" inputmode="decimal"><span class="u">/${u}</span></div>
      <div class="ipt"><span class="u">S$</span><input data-unit placeholder="单价" inputmode="decimal"><span class="u">/斤</span></div></div>
    <div class="errmsg" data-err></div>
    <div class="fmeta"><span>预计收入 <b data-income>S$ –</b></span><span>佣金(${(COMMISSION*100)}%) <b data-fee style="color:var(--sub)">S$ –</b></span></div>
  </div>`).join('');
  pushPage({title:'改价格',body:`<div style="height:4px"></div>${blocks}<div style="height:10px"></div>`,
    footer:`<button class="btn primary" id="ps" disabled>提交改价</button>`,
    mount:(p)=>{
      const sub=p.querySelector('#ps');
      const cards=[...p.querySelectorAll('.fcard')];
      const validateAll=()=>{
        let anyValid=false,anyErr=false;
        cards.forEach(c=>{
          const pi=c.querySelector('[data-price]'),box=pi.closest('.ipt'),err=c.querySelector('[data-err]');
          const inc=c.querySelector('[data-income]'),fee=c.querySelector('[data-fee]');
          const v=pi.value.trim();
          if(!v){box.classList.remove('err');err.textContent='';inc.textContent='S$ –';fee.textContent='S$ –';return;}
          const num=parseFloat(v);
          if(isNaN(num)||num<=0){box.classList.add('err');err.textContent='请输入大于 0 的有效价格';inc.textContent='S$ –';fee.textContent='S$ –';anyErr=true;return;}
          if(num>9999){box.classList.add('err');err.textContent='价格超出上限(S$9999)';anyErr=true;return;}
          box.classList.remove('err');err.textContent='';anyValid=true;
          inc.textContent='S$ '+(num*(1-COMMISSION)).toFixed(2);     // 预计收入联动(H1/H5)
          fee.textContent='S$ '+(num*COMMISSION).toFixed(2);
        });
        sub.disabled=!(anyValid&&!anyErr);
      };
      p.querySelectorAll('[data-price]').forEach(i=>i.oninput=validateAll);
      sub.onclick=()=>{sub.classList.add('loading');setTimeout(()=>{sub.classList.remove('loading');toast('改价成功');setTimeout(popPage,600);},700);}; // loading态(H1)
    }});
}

// 改库存
function grp(i,whs){return `<div class="st-grp"><div class="gh"><span class="gn">共享库存仓组合 ${i}</span><span class="ge">修改组合</span></div>
  <div class="st-line"><span class="lk">库存模式</span><div class="st-mode"><span class="o on">每日恢复</span><span class="o">售完即止</span></div></div>
  <div class="st-line"><span class="lk">库存总数</span><div class="st-num"><input value="0" inputmode="numeric"></div><span class="hint">自动恢复 · <b>销量参考</b></span></div>
  <div style="font-size:13px;color:var(--sub);margin-bottom:6px">今日已售 0</div>
  ${whs.map(w=>`<div class="st-wh"><span>${w[0]}${w[1]?'<span class="t">'+w[1]+'</span>':''}</span><span style="font-weight:600">0</span></div>`).join('')}</div>`;}
function openStock(g){
  const g1=[['裕廊 DC'],['兀兰 DC'],['盛港 DC']];
  const g2=[['大巴窑 DC','上午达'],['淡滨尼 DC','上午达'],['义顺 DC','上午达']];
  pushPage({title:'改库存',right:'',body:`<div class="st-seg"><span class="s on">${g.sp}</span></div>
    <div class="disp" style="font-size:18px;font-weight:700;margin:14px 20px 2px">预售库存</div>${grp(1,g1)}${grp(2,g2)}
    <div style="text-align:center;color:var(--emerald);font-size:14px;font-weight:700;padding:8px;min-height:44px">＋ 添加共享库存仓组合</div>`,
    footer:`<button class="btn primary" id="sv">保存</button>`,
    mount:(p)=>{p.querySelectorAll('.st-mode').forEach(m=>m.querySelectorAll('.o').forEach(o=>o.onclick=()=>{m.querySelectorAll('.o').forEach(x=>x.classList.remove('on'));o.classList.add('on');}));
      p.querySelector('#sv').onclick=()=>{const b=p.querySelector('#sv');b.classList.add('loading');setTimeout(()=>{b.classList.remove('loading');toast('保存成功');setTimeout(popPage,600);},700);};}});
}

function openMore(g,sold){
  sheet([
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
