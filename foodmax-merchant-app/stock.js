/* Food Max 商家端 v2 · 库存模块
   还原快驴「库存管理」：预售品/寄售品 Tab + 四列库存KPI + 库存明细抽屉 + 改库存
   评审修复内建：骨架屏→数据 / 寄售品空态 / 设为寄售二次确认 / 触控≥44px / SG数据
   自定义类一律用 skm- 前缀，避开 index.html 全局骨架类 .sk */
(function(){
const {pushPage,popPage,toast,confirmDialog,svg,skel}=window.FM;

const css=document.createElement('style');
css.textContent=`
/* Tab */
.skm-tabs{display:flex;background:var(--bg);padding:0 16px;border-bottom:1px solid var(--line);}
.skm-tabs .t{flex:1;min-height:46px;display:flex;align-items:center;justify-content:center;gap:4px;font-size:15px;font-weight:600;color:var(--sub);position:relative;cursor:pointer;}
.skm-tabs .t.on{color:var(--ink);font-weight:700;}
.skm-tabs .t.on::after{content:"";position:absolute;bottom:0;left:50%;transform:translateX(-50%);width:30px;height:3px;border-radius:3px;background:var(--emerald);}
/* 顶部搜索/筛选区 */
.skm-bar{position:sticky;top:0;z-index:6;background:var(--bg);padding:10px 16px 8px;}
.skm-search{display:flex;align-items:center;gap:9px;background:#fff;border-radius:13px;min-height:44px;padding:0 14px;box-shadow:var(--sh-sm);color:var(--sub);font-size:14px;}
.skm-search svg{width:18px;height:18px;stroke:var(--sub);fill:none;stroke-width:2;}
.skm-filters{display:flex;align-items:center;gap:14px;margin-top:11px;overflow-x:auto;}.skm-filters::-webkit-scrollbar{display:none;}
.skm-fd{flex:0 0 auto;min-height:44px;display:flex;align-items:center;gap:3px;font-size:13.5px;font-weight:600;color:#27433A;cursor:pointer;white-space:nowrap;}
.skm-fd .cv{font-size:9px;opacity:.6;}
.skm-fd.lnk{color:var(--emerald);margin-left:auto;}
.skm-quick{display:flex;gap:8px;margin-top:6px;overflow-x:auto;}.skm-quick::-webkit-scrollbar{display:none;}
.skm-q{flex:0 0 auto;position:relative;min-height:40px;display:flex;align-items:center;padding:0 15px;border-radius:11px;font-size:13px;font-weight:600;background:#fff;color:#27433A;box-shadow:var(--sh-sm);cursor:pointer;}
.skm-q.on{background:var(--emerald);color:#fff;box-shadow:0 6px 16px rgba(5,150,105,.28);}
.skm-q .dot{position:absolute;top:7px;right:8px;width:7px;height:7px;border-radius:50%;background:var(--red);}
.skm-q.on .dot{background:#fff;}
/* 列表 */
.skm-list{padding:12px 16px 16px;}
.skm-c{background:#fff;border-radius:20px;padding:15px;margin-bottom:13px;box-shadow:var(--sh-sm);}
.skm-c .top{display:flex;gap:13px;}
.skm-c .img{width:60px;height:60px;border-radius:14px;flex:0 0 60px;background:var(--mint-soft);display:flex;align-items:center;justify-content:center;font-size:30px;}
.skm-c .nm{font-size:16px;font-weight:700;line-height:1.25;}
.skm-c .sp{font-size:12.5px;color:var(--sub);margin-top:4px;}
.skm-c .kpis{display:flex;margin:13px 0;padding:12px 0;border-top:1px solid var(--line);border-bottom:1px solid var(--line);}
.skm-c .kpis .k{flex:1;text-align:center;}
.skm-c .kpis .k .v{font-size:21px;font-weight:600;font-family:'Lora',serif;line-height:1;}
.skm-c .kpis .k .v.warn{color:var(--red);}
.skm-c .kpis .k .l{font-size:11px;color:var(--sub);margin-top:5px;}
.skm-c .acts{display:flex;gap:9px;justify-content:flex-end;}
.skm-c .acts .a{min-width:84px;min-height:44px;display:flex;align-items:center;justify-content:center;padding:0 14px;border-radius:11px;font-size:13.5px;font-weight:600;cursor:pointer;background:var(--muted);color:#27433A;}
.skm-c .acts .a.key{background:#fff;color:var(--emerald);border:1.5px solid var(--emerald);}
/* 库存明细抽屉 */
.skm-mask{position:absolute;inset:0;z-index:120;background:rgba(15,23,42,.42);display:flex;align-items:flex-end;animation:fade .2s;}
.skm-draw{width:100%;max-height:74%;background:#fff;border-radius:22px 22px 0 0;display:flex;flex-direction:column;animation:rise .25s;}
.skm-dh{padding:18px 18px 4px;text-align:center;position:relative;flex:0 0 auto;}
.skm-dh .dt{font-size:18px;font-weight:700;}
.skm-dh .dsub{font-size:12.5px;color:var(--sub);margin-top:4px;}
.skm-dh .dx{position:absolute;right:14px;top:14px;width:44px;height:44px;display:flex;align-items:center;justify-content:center;font-size:22px;color:var(--sub);cursor:pointer;}
.skm-db{flex:1;overflow-y:auto;padding:8px 18px 22px;}.skm-db::-webkit-scrollbar{display:none;}
.skm-g{margin-top:14px;}
.skm-gh{display:flex;justify-content:space-between;align-items:baseline;padding-bottom:8px;border-bottom:1px solid var(--line);}
.skm-gh .gn{font-size:15.5px;font-weight:700;}
.skm-gh .gt{font-size:12px;color:var(--sub);}
.skm-wh{display:flex;justify-content:space-between;align-items:center;padding:12px 0;border-bottom:1px solid var(--muted);}
.skm-wh .wn{font-size:14.5px;font-weight:600;color:#27433A;}
.skm-wh .wv{font-size:12.5px;color:var(--sub);display:flex;gap:14px;}
.skm-wh .wv b{color:var(--ink);font-weight:600;font-family:'Lora',serif;}
/* 改库存 */
.skm-eg{background:#fff;border-radius:18px;margin:12px 16px;padding:16px;box-shadow:var(--sh-sm);}
.skm-eg .egh{font-size:15.5px;font-weight:700;margin-bottom:4px;}
.skm-eg .egs{font-size:12.5px;color:var(--sub);margin-bottom:12px;}
.skm-el{display:flex;align-items:center;justify-content:space-between;padding:11px 0;border-top:1px solid var(--muted);}
.skm-el .eln{font-size:14px;color:#27433A;}
.skm-num{width:120px;background:var(--muted);border-radius:11px;min-height:42px;display:flex;align-items:center;padding:0 13px;border:1.5px solid transparent;}
.skm-num:focus-within{border-color:var(--emerald);background:#fff;}
.skm-num input{border:none;background:transparent;outline:none;width:100%;font-size:15px;font-family:inherit;text-align:right;}
`;
document.head.appendChild(css);

// ---- SG 数据 ----
const WH=['裕廊DC','兀兰DC','盛港DC','大巴窑DC','淡滨尼DC','义顺DC'];
// level: low=库存不足 / mid=库存偏低 / high=库存偏高 / ok
function mk(ic,n,sp,total,sold,refund,level){
  const left=total-sold; return {ic,n,sp,total,sold,refund,left,level};
}
const PRESELL=[
  mk('🍢','[无]小油豆腐 1kg','1kg/袋',200,0,0,'ok'),
  mk('🧈','[无]家常豆腐(油方)','1kg/袋',100,1,0,'ok'),
  mk('🍱','[无]中油豆腐 1kg','1kg/袋',100,0,0,'ok'),
  mk('🥟','鲜丰 · 素鸡饼 2斤','1kg/袋',50,48,0,'low'),
  mk('🥬','鲜丰 · 嫩豆腐','2斤/袋',300,272,5,'mid'),
  mk('🍲','鲜丰 · 老豆腐','2.5kg/盒',800,120,0,'high'),
];
const CONSIGN=[]; // 寄售品演示空态

// 共享仓组合(库存明细 / 改库存共用)
const GROUPS=[
  {name:'共享仓组合1',whs:WH.slice(0,3)},
  {name:'共享仓组合2',whs:WH.slice(3)},
];

function kpiCard(g){
  return `<div class="skm-c">
    <div class="top"><div class="img">${g.ic}</div>
      <div style="flex:1;min-width:0"><div class="nm">${g.n}</div><div class="sp">${g.sp}</div></div></div>
    <div class="kpis">
      <div class="k"><div class="v">${g.total}</div><div class="l">总库存</div></div>
      <div class="k"><div class="v">${g.sold}</div><div class="l">已售库存</div></div>
      <div class="k"><div class="v">${g.left}</div><div class="l">剩余库存</div></div>
      <div class="k"><div class="v">${g.refund}</div><div class="l">待退库</div></div>
    </div>
    <div class="acts">
      <div class="a" data-a="consign">设为寄售</div>
      <div class="a" data-a="detail">库存明细</div>
      <div class="a key" data-a="edit">改库存</div>
    </div></div>`;
}

function bind(el,g){
  el.querySelectorAll('.acts .a').forEach(b=>b.onclick=()=>{
    const a=b.dataset.a;
    if(a==='consign') confirmDialog({title:'设为寄售品？',body:`「${g.n}」转为寄售后，按实际销量结算、不占用预售库存，转换后该商品将移入寄售品列表。`,okText:'设为寄售',onOk:()=>toast('已设为寄售')});
    else if(a==='detail') openDetail(g);
    else if(a==='edit') openEdit(g);
  });
}

// ---- 库存明细抽屉 ----
function openDetail(g){
  const groups=GROUPS.map(gr=>`<div class="skm-g">
    <div class="skm-gh"><span class="gn">${gr.name}</span><span class="gt">每日恢复初始库存</span></div>
    ${gr.whs.map(w=>`<div class="skm-wh"><span class="wn">${w}</span><span class="wv"><span>已售 <b>0</b></span><span>待退库存 <b>0</b></span></span></div>`).join('')}
  </div>`).join('');
  const m=document.createElement('div');m.className='skm-mask';
  m.innerHTML=`<div class="skm-draw">
    <div class="skm-dh"><div class="dt">库存明细</div><div class="dsub">${g.n} · ${g.sp}</div><div class="dx">×</div></div>
    <div class="skm-db">${groups}</div></div>`;
  document.querySelector('.phone').appendChild(m);
  const close=()=>m.remove();
  m.querySelector('.dx').onclick=close;
  m.onclick=e=>{if(e.target===m)close();};
}

// ---- 改库存 ----
function openEdit(g){
  const blocks=GROUPS.map((gr,i)=>`<div class="skm-eg">
    <div class="egh">${gr.name}</div><div class="egs">每日恢复初始库存 · 覆盖 ${gr.whs.join(' / ')}</div>
    <div class="skm-el"><span class="eln">库存总数</span><div class="skm-num"><input data-num value="${i===0?Math.round(g.total*0.6):g.total-Math.round(g.total*0.6)}" inputmode="numeric"></div></div>
    <div class="skm-el" style="border-bottom:none"><span class="eln">今日已售</span><span style="font-size:14px;font-weight:600;font-family:'Lora',serif">${i===0?g.sold:0}</span></div>
  </div>`).join('');
  pushPage({title:'改库存',body:`<div class="skm-eg" style="margin-bottom:0"><div class="egh">${g.n}</div><div class="egs">${g.sp}</div></div>${blocks}<div style="height:8px"></div>`,
    footer:`<button class="btn primary" id="sv">保存</button>`,
    mount:(p)=>{
      const sv=p.querySelector('#sv');
      const ins=[...p.querySelectorAll('[data-num]')];
      const check=()=>{let ok=true;ins.forEach(i=>{const n=parseInt(i.value,10);i.closest('.skm-num').style.borderColor=(isNaN(n)||n<0)?'var(--red)':'';if(isNaN(n)||n<0)ok=false;});sv.disabled=!ok;};
      ins.forEach(i=>i.oninput=check);
      sv.onclick=()=>{sv.classList.add('loading');setTimeout(()=>{sv.classList.remove('loading');toast('保存成功');setTimeout(popPage,600);},700);};
    }});
}

// ---- 列表渲染 ----
function renderList(container){
  container.innerHTML=`
    <div class="skm-tabs">
      <div class="t on" data-tab="presell">预售品<span>(340)</span></div>
      <div class="t" data-tab="consign">寄售品<span>(8)</span></div>
    </div>
    <div class="skm-bar">
      <div class="skm-search">${svg('search')}输入商品名称或商品编码</div>
      <div class="skm-filters" id="fd">
        <div class="skm-fd" data-f="wh">全部仓库<span class="cv">▼</span></div>
        <div class="skm-fd" data-f="state">销售中<span class="cv">▼</span></div>
        <div class="skm-fd" data-f="sku">多规格sku聚合<span class="cv">▼</span></div>
        <div class="skm-fd lnk" data-f="pref">库存偏好设置 ›</div>
      </div>
    </div>
    <div class="skm-list" id="l"></div>`;
  const list=container.querySelector('#l');
  const state={tab:'presell'};

  const drawData=()=>{
    const data=state.tab==='presell'?PRESELL:CONSIGN;
    if(!data.length){
      const empty=state.tab==='consign'
        ?{t:'暂无寄售品',p:'将预售品「设为寄售」后会出现在这里，按实际销量结算'}
        :{t:'暂无商品',p:'发布并上架商品后会出现在这里'};
      list.innerHTML=`<div class="empty"><div class="ei">${svg('layers')}</div><h4>${empty.t}</h4><p>${empty.p}</p></div>`;
      return;
    }
    list.innerHTML='';
    data.forEach(g=>{const w=document.createElement('div');w.innerHTML=kpiCard(g);const c=w.firstElementChild;list.appendChild(c);bind(c,g);});
  };
  const draw=()=>{list.innerHTML=skel(3);setTimeout(drawData,420);}; // 骨架屏→数据

  container.querySelectorAll('.skm-tabs .t').forEach(t=>t.onclick=()=>{
    container.querySelectorAll('.skm-tabs .t').forEach(x=>x.classList.remove('on'));
    t.classList.add('on');state.tab=t.dataset.tab;draw();
  });
  container.querySelectorAll('#fd .skm-fd').forEach(f=>f.onclick=()=>{
    const map={wh:'选择仓库',state:'选择销售状态',sku:'选择聚合方式',pref:'库存偏好设置'};toast(map[f.dataset.f]);
  });

  draw();
}

function openStock(){pushPage({title:'库存管理',body:'<div id="sk-root"></div>',mount:(p)=>renderList(p.querySelector('#sk-root'))});}

window.FM_MOD=window.FM_MOD||{};
window.FM_MOD.stock=openStock;
})();
