/* Food Max 商家端 v2 · 经营分析模块
   数据驱动配色(emerald) + 评审修复内建：榜单/数据区先骨架→数据、时间段/榜单维度可切换换数据、占位空态、可点≥44px、S$ */
(function(){
const {pushPage,toast,sheet,svg,skel}=window.FM;

const css=document.createElement('style');
css.textContent=`
/* 顶部一级 Tab(横向可滑) */
.an-tabs{position:sticky;top:0;z-index:6;display:flex;gap:4px;background:#fff;padding:0 8px;overflow-x:auto;box-shadow:0 1px 0 var(--line);}
.an-tabs::-webkit-scrollbar{display:none;}
.an-tab{flex:0 0 auto;min-height:46px;display:flex;align-items:center;padding:0 14px;font-size:15px;font-weight:600;color:#46604F;position:relative;cursor:pointer;}
.an-tab.on{color:var(--emerald);font-weight:700;}
.an-tab.on::after{content:"";position:absolute;left:14px;right:14px;bottom:6px;height:3px;border-radius:3px;background:var(--emerald);}
/* 二级筛选 */
.an-filt{display:flex;gap:10px;background:#fff;padding:10px 16px 12px;border-bottom:1px solid var(--line);}
.an-fp{flex:1;min-height:40px;display:flex;align-items:center;justify-content:space-between;gap:6px;background:var(--muted);border-radius:11px;padding:0 13px;font-size:13.5px;font-weight:600;color:#27433A;cursor:pointer;}
.an-fp .cv{color:var(--sub);font-size:11px;}
/* 时间段药丸 */
.an-period{display:flex;gap:8px;background:var(--bg);padding:12px 16px;overflow-x:auto;}
.an-period::-webkit-scrollbar{display:none;}
.an-pill{flex:0 0 auto;min-height:40px;display:flex;align-items:center;gap:4px;padding:0 16px;border-radius:20px;font-size:13.5px;font-weight:600;background:#fff;color:#27433A;box-shadow:var(--sh-sm);cursor:pointer;}
.an-pill.on{background:var(--emerald);color:#fff;box-shadow:0 6px 16px rgba(5,150,105,.28);}
/* 卡片通用 */
.an-card{background:#fff;border-radius:18px;margin:13px 16px;padding:16px;box-shadow:var(--sh-sm);}
.an-ch{display:flex;align-items:center;justify-content:space-between;margin-bottom:13px;}
.an-ch .ct{font-size:16.5px;font-weight:700;display:flex;align-items:center;gap:5px;}
.an-ch .ct .q{width:15px;height:15px;border-radius:50%;border:1.4px solid var(--sub);color:var(--sub);font-size:10px;display:inline-flex;align-items:center;justify-content:center;font-weight:700;}
.an-ch .more{font-size:13px;color:var(--emerald);font-weight:700;min-height:44px;display:flex;align-items:center;cursor:pointer;}
/* 榜单维度子 Tab */
.an-seg{display:flex;background:var(--muted);border-radius:12px;padding:4px;margin-bottom:12px;}
.an-seg .s{flex:1;text-align:center;min-height:40px;display:flex;align-items:center;justify-content:center;font-size:13.5px;font-weight:600;color:var(--sub);border-radius:9px;cursor:pointer;}
.an-seg .s.on{background:#fff;color:var(--emerald-2);font-weight:700;box-shadow:var(--sh-sm);}
.an-sort{display:flex;gap:18px;margin-bottom:6px;}
.an-sort .o{font-size:13px;color:var(--sub);min-height:34px;display:flex;align-items:center;cursor:pointer;}
.an-sort .o.on{color:var(--emerald);font-weight:700;}
/* 榜单行 */
.an-rk{display:flex;align-items:center;gap:12px;padding:11px 0;border-top:1px solid var(--line);cursor:pointer;min-height:44px;}
.an-rk:first-of-type{border-top:none;}
.an-rk .no{position:relative;width:48px;height:48px;border-radius:12px;background:var(--mint-soft);flex:0 0 48px;display:flex;align-items:center;justify-content:center;font-size:24px;}
.an-rk .no .b{position:absolute;top:-6px;left:-6px;background:var(--amber);color:#fff;font-size:10px;font-weight:700;padding:1px 5px;border-radius:7px;font-family:'Lora',serif;}
.an-rk .info{flex:1;min-width:0;}
.an-rk .nm{font-size:14.5px;font-weight:600;line-height:1.25;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;}
.an-rk .mv{font-size:12.5px;color:var(--sub);margin-top:4px;}.an-rk .mv b{color:var(--ink);font-weight:700;}
.an-rk .ar{width:18px;height:18px;stroke:var(--sub);fill:none;stroke-width:2;flex:0 0 18px;}
.an-allbtn{text-align:center;background:var(--muted);border-radius:12px;min-height:44px;display:flex;align-items:center;justify-content:center;font-size:13.5px;color:#46604F;font-weight:600;margin-top:8px;cursor:pointer;}
/* 历史数据段控件 */
.an-hist{display:flex;background:#fff;border-radius:14px;margin:13px 16px;padding:5px;box-shadow:var(--sh-sm);}
.an-hist .h{flex:1;text-align:center;min-height:44px;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:600;color:var(--sub);border-radius:11px;cursor:pointer;}
.an-hist .h.on{background:var(--emerald);color:#fff;}
/* 营收三联指标 */
.an-rev{display:flex;}
.an-rev .m{flex:1;}
.an-rev .m .v{font-size:24px;font-weight:600;font-family:'Lora',serif;line-height:1.1;}
.an-rev .m .l{font-size:12px;color:var(--sub);margin-top:5px;}
.an-rev .m .d{font-size:11.5px;margin-top:4px;font-weight:600;}
.an-rev .m .d.up{color:var(--emerald);}.an-rev .m .d.dn{color:var(--red);}
/* 商品 Tab 数据概览骨架 */
.an-ov{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;}
.an-ov .cell{height:88px;border-radius:12px;}
.an-ov .cell .v{font-size:21px;font-weight:600;font-family:'Lora',serif;}
.an-ov .cell .l{font-size:11.5px;color:var(--sub);margin-top:4px;}
.an-ov .cell.data{background:var(--muted);display:flex;flex-direction:column;align-items:center;justify-content:center;}
/* 诊断标签 + 提示条 */
.an-diag{display:flex;gap:8px;overflow-x:auto;margin-bottom:12px;}
.an-diag::-webkit-scrollbar{display:none;}
.an-dt{flex:0 0 auto;min-height:40px;display:flex;align-items:center;padding:0 14px;border-radius:11px;font-size:13px;font-weight:600;background:var(--muted);color:#46604F;cursor:pointer;}
.an-dt.on{background:var(--mint-soft);color:var(--emerald-2);}
.an-tip{display:flex;align-items:center;gap:6px;background:var(--amber-soft);color:#B45309;border-radius:11px;padding:11px 13px;font-size:12.5px;font-weight:600;min-height:44px;cursor:pointer;}
.an-tip svg{width:16px;height:16px;stroke:#B45309;fill:none;stroke-width:2;flex:0 0 16px;}
/* 占位空态(复用 goods 风格) */
.an-empty{display:flex;flex-direction:column;align-items:center;justify-content:center;padding:64px 40px;gap:14px;text-align:center;}
.an-empty .ei{width:90px;height:90px;border-radius:26px;background:var(--mint-soft);display:flex;align-items:center;justify-content:center;}
.an-empty .ei svg{width:40px;height:40px;stroke:var(--emerald-2);fill:none;stroke-width:1.4;}
.an-empty h4{font-size:16.5px;font-weight:700;}.an-empty p{font-size:13px;color:var(--sub);max-width:240px;}
`;
document.head.appendChild(css);

// ---- 数据(SG 本地化, S$) ----
const TABS=['总览','营收','商品','流量','客户','服务'];
const PERIODS=['今日','昨日','近7日','近30日'];
// 周期系数(今日为基准)
const FACTOR={'今日':1,'昨日':0.94,'近7日':6.7,'近30日':28.4};

// 榜单按维度给不同数据(单位/数值随维度变)
const RANK={
  '销售额':{unit:'销售额',pre:'S$',items:[
    {ic:'🧈',n:'鲜丰 · 盐卤老豆腐5斤（5斤/袋）',v:756.81},
    {ic:'🍢',n:'精品油豆泡（2.5kg/箱(5袋)）',v:493.81},
    {ic:'🟫',n:'散装卤豆干（5斤/袋）',v:431.94},
    {ic:'🥬',n:'鲜丰 · 嫩豆腐 1kg（2斤/袋）',v:318.50},
    {ic:'🍲',n:'鲜丰 · 小油豆腐（2斤/袋）',v:264.12}]},
  '销量':{unit:'销量',pre:'',suf:' 件',items:[
    {ic:'🟫',n:'散装卤豆干（5斤/袋）',v:212},
    {ic:'🧈',n:'鲜丰 · 盐卤老豆腐5斤（5斤/袋）',v:188},
    {ic:'🍢',n:'精品油豆泡（2.5kg/箱(5袋)）',v:131},
    {ic:'🥬',n:'鲜丰 · 嫩豆腐 1kg（2斤/袋）',v:96},
    {ic:'🍲',n:'鲜丰 · 小油豆腐（2斤/袋）',v:74}]},
  '订单量':{unit:'订单量',pre:'',suf:' 单',items:[
    {ic:'🧈',n:'鲜丰 · 盐卤老豆腐5斤（5斤/袋）',v:96},
    {ic:'🟫',n:'散装卤豆干（5斤/袋）',v:88},
    {ic:'🍢',n:'精品油豆泡（2.5kg/箱(5袋)）',v:61},
    {ic:'🥬',n:'鲜丰 · 嫩豆腐 1kg（2斤/袋）',v:43},
    {ic:'🍲',n:'鲜丰 · 小油豆腐（2斤/袋）',v:35}]},
  '复购率':{unit:'复购率',pre:'',suf:'%',items:[
    {ic:'🍢',n:'精品油豆泡（2.5kg/箱(5袋)）',v:62.5},
    {ic:'🧈',n:'鲜丰 · 盐卤老豆腐5斤（5斤/袋）',v:58.3},
    {ic:'🟫',n:'散装卤豆干（5斤/袋）',v:51.0},
    {ic:'🥬',n:'鲜丰 · 嫩豆腐 1kg（2斤/袋）',v:44.7},
    {ic:'🍲',n:'鲜丰 · 小油豆腐（2斤/袋）',v:39.2}]},
};
// 营收三指标(今日基准值)
const REV_BASE=[
  {k:'sales',l:'销售额',base:11544.95,money:1,d:14.8,up:1},
  {k:'orders',l:'订单量',base:741,money:0,d:11.0,up:1},
  {k:'avg',l:'实付单均价',base:15.58,money:1,d:0.6,up:0},
];
const DIAG=['全部商品','全部新品','价劣新品','缺货新品'];

const fmtMoney=n=>'S$'+n.toLocaleString('en-SG',{minimumFractionDigits:2,maximumFractionDigits:2});
const fmtInt=n=>Math.round(n).toLocaleString('en-SG');

// ---- 入口 ----
function open(){
  pushPage({title:'经营分析',body:`
    <div class="an-tabs" id="an-tabs">${TABS.map((t,i)=>`<div class="an-tab${i===0?' on':''}" data-t="${t}">${t}</div>`).join('')}</div>
    <div class="an-filt">
      <div class="an-fp" data-f="area">全部售卖区域 <span class="cv">∨</span></div>
      <div class="an-fp" data-f="cat">全部类目 <span class="cv">∨</span></div>
    </div>
    <div class="an-period" id="an-period">${PERIODS.map((p,i)=>`<span class="an-pill${i===0?' on':''}" data-p="${p}">${p}</span>`).join('')}<span class="an-pill" data-p="custom">自定义 ▾</span></div>
    <div id="an-c"></div>`,
    mount:(p)=>{
      const state={tab:'总览',period:'今日',rankDim:'销售额',asc:false,hist:'昨日',diag:'全部新品'};
      const c=p.querySelector('#an-c');
      // 一级 Tab
      p.querySelectorAll('#an-tabs .an-tab').forEach(t=>t.onclick=()=>{
        p.querySelectorAll('#an-tabs .an-tab').forEach(x=>x.classList.remove('on'));
        t.classList.add('on');state.tab=t.dataset.t;render(c,state);
      });
      // 二级筛选
      p.querySelectorAll('.an-fp').forEach(f=>f.onclick=()=>{
        const isA=f.dataset.f==='area';
        sheet((isA?['全部售卖区域','中区','东区','西区','北区']:['全部类目','豆制品','卤味','蔬菜','冻品']).map(o=>({label:o,onClick:()=>{f.firstChild.textContent=o+' ';toast('已切换 '+o);render(c,state);}})));
      });
      // 时间段
      p.querySelectorAll('#an-period .an-pill').forEach(pl=>pl.onclick=()=>{
        if(pl.dataset.p==='custom'){toast('选择自定义时间段');return;}
        p.querySelectorAll('#an-period .an-pill').forEach(x=>x.classList.remove('on'));
        pl.classList.add('on');state.period=pl.dataset.p;render(c,state);
      });
      render(c,state);
    }});
}

// ---- 各 Tab 渲染(先骨架→数据) ----
function render(c,state){
  c.innerHTML=`<div style="padding:13px 16px">${skel(2)}</div>`;   // 加载态
  setTimeout(()=>{
    if(state.tab==='总览')renderOverview(c,state);
    else if(state.tab==='商品')renderGoods(c,state);
    else renderPlaceholder(c,state.tab);
  },420);
}

function renderOverview(c,state){
  c.innerHTML=`
    <div class="an-card" id="an-rank"></div>
    <div class="an-hist" id="an-hist">${['昨日','近7日','近30日'].map(h=>`<span class="h${h===state.hist?' on':''}" data-h="${h}">${h}</span>`).join('')}</div>
    <div class="an-card">
      <div class="an-ch"><span class="ct">营收 <span class="q">?</span></span><span class="more" id="an-revmore">查看详情 ›</span></div>
      <div class="an-rev" id="an-rev"></div>
    </div>
    <div style="height:14px"></div>`;
  drawRank(c.querySelector('#an-rank'),state);
  drawRev(c.querySelector('#an-rev'),state);
  // 历史数据切换 → 联动营收数据
  c.querySelectorAll('#an-hist .h').forEach(h=>h.onclick=()=>{
    c.querySelectorAll('#an-hist .h').forEach(x=>x.classList.remove('on'));
    h.classList.add('on');state.hist=h.dataset.h;
    drawRev(c.querySelector('#an-rev'),state,h.dataset.h);
  });
  c.querySelector('#an-revmore').onclick=()=>toast('查看营收详情');
}

function drawRank(box,state){
  box.innerHTML=`
    <div class="an-ch"><span class="ct">${state.period}销量榜单 <span class="q">?</span></span></div>
    <div class="an-seg">${['销售额','销量','订单量','复购率'].map(d=>`<span class="s${d===state.rankDim?' on':''}" data-d="${d}">${d}</span>`).join('')}</div>
    <div class="an-sort">${['从高到低','从低到高'].map((o,i)=>`<span class="o${(i===0)!==state.asc?' on':''}" data-asc="${i===1?1:0}">${o}</span>`).join('')}</div>
    <div id="an-rklist">${skel(2)}</div>`;
  const listEl=box.querySelector('#an-rklist');
  const drawItems=()=>{
    const d=RANK[state.rankDim];const f=FACTOR[state.period];
    let items=d.items.map(it=>({...it,scaled:it.v*(state.rankDim==='复购率'?1:f)}));
    items.sort((a,b)=>state.asc?a.scaled-b.scaled:b.scaled-a.scaled);
    listEl.innerHTML=items.map((it,i)=>{
      const val=state.rankDim==='复购率'?it.scaled.toFixed(1)+'%':(d.money===0?'':'')+(state.rankDim==='销售额'?fmtMoney(it.scaled):fmtInt(it.scaled)+(d.suf||''));
      return `<div class="an-rk"><div class="no">${it.ic}<span class="b">${String(i+1).padStart(2,'0')}</span></div>
        <div class="info"><div class="nm">${it.n}</div><div class="mv">${d.unit} <b>${val}</b></div></div>
        <svg class="ar" viewBox="0 0 24 24">${window.FM.I.arrow}</svg></div>`;
    }).join('')+`<div class="an-allbtn" id="an-all">查看全部</div>`;
    listEl.querySelector('#an-all').onclick=()=>toast('查看完整榜单');
  };
  setTimeout(drawItems,300); // 榜单先骨架→数据
  // 维度切换换数据
  box.querySelectorAll('.an-seg .s').forEach(s=>s.onclick=()=>{
    if(state.rankDim===s.dataset.d)return;
    state.rankDim=s.dataset.d;
    box.querySelectorAll('.an-seg .s').forEach(x=>x.classList.remove('on'));s.classList.add('on');
    listEl.innerHTML=skel(2);setTimeout(drawItems,300);
  });
  box.querySelectorAll('.an-sort .o').forEach(o=>o.onclick=()=>{
    const asc=o.dataset.asc==='1';if(state.asc===asc)return;state.asc=asc;
    box.querySelectorAll('.an-sort .o').forEach(x=>x.classList.remove('on'));o.classList.add('on');
    drawItems();
  });
}

function drawRev(box,state,histOverride){
  // 营收数据：默认随顶部时间段；历史数据段控件可覆盖
  const f=FACTOR[histOverride||state.period]||1;
  box.innerHTML=REV_BASE.map(m=>{
    const v=m.k==='avg'?m.base:m.base*f;
    const val=m.money?fmtMoney(v):fmtInt(v);
    return `<div class="m"><div class="v">${val}</div><div class="l">${m.l}</div><div class="d ${m.up?'up':'dn'}">较昨日 ${m.up?'+':'-'}${m.d}%</div></div>`;
  }).join('');
}

function renderGoods(c,state){
  c.innerHTML=`
    <div class="an-card">
      <div class="an-ch"><span class="ct">数据概览 <span class="q">?</span></span></div>
      <div class="an-ov" id="an-ov"></div>
    </div>
    <div class="an-card">
      <div class="an-ch"><span class="ct">分析及诊断 <span class="q">?</span></span></div>
      <div class="an-diag" id="an-diag">${DIAG.map(d=>`<span class="an-dt${d===state.diag?' on':''}" data-d="${d}">${d}</span>`).join('')}</div>
      <div class="an-tip" id="an-tip">${svg('alert')}新品在扶持期间，价格过高、缺货会暂停扶持 ›</div>
    </div>
    <div style="height:14px"></div>`;
  // 数据概览：先加载态(骨架格)→数据
  const ov=c.querySelector('#an-ov');
  ov.innerHTML=Array.from({length:6}).map(()=>`<div class="cell sk"></div>`).join('');
  setTimeout(()=>{
    const f=FACTOR[state.period];
    const cells=[['在售商品','312',''],['动销商品',fmtInt(96*Math.min(f,3)),''],['新品在扶持',fmtInt(8),''],
      ['曝光人数',fmtInt(1820*f),''],['加购人数',fmtInt(430*f),''],['支付转化率','23.6%','']];
    ov.innerHTML=cells.map(x=>`<div class="cell data"><div class="v">${x[1]}</div><div class="l">${x[0]}</div></div>`).join('');
  },360);
  c.querySelectorAll('#an-diag .an-dt').forEach(d=>d.onclick=()=>{
    c.querySelectorAll('#an-diag .an-dt').forEach(x=>x.classList.remove('on'));
    d.classList.add('on');state.diag=d.dataset.d;toast('筛选 '+d.dataset.d);
  });
  c.querySelector('#an-tip').onclick=()=>toast('查看新品扶持规则');
}

function renderPlaceholder(c,tab){
  c.innerHTML=`<div class="an-empty"><div class="ei">${svg('chart')}</div>
    <h4>${tab}数据待补录</h4><p>该 Tab 的统计口径与数据源正在接入，上线后在此查看${tab}分析。</p></div>`;
}

window.FM_MOD=window.FM_MOD||{};
window.FM_MOD.analysis=open;
})();
