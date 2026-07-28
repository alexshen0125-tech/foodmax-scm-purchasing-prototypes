/* Food Max 商家端 v2 · 商机推荐模块(biz)
   还原快驴卖家App「商机推荐」：进页选上品城市 → 客户热搜/热门推荐/收藏 三 Tab
   评审修复内建：进页选城市弹窗/骨架屏/空态/立即上品确认/不再推荐破坏性确认/44px/S$ 本地化 */
(function(){
const {pushPage,popPage,toast,confirmDialog,sheet,svg,skel}=window.FM;

const STAR='<svg viewBox="0 0 24 24" class="bz-ic"><path d="M12 3l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9 6.8 19.2l1-5.8L3.5 9.2l5.9-.9z"/></svg>';
const THUMB='<svg viewBox="0 0 24 24" class="bz-ic"><path d="M7 11v9H4a1 1 0 01-1-1v-7a1 1 0 011-1h3z"/><path d="M7 11l4-7a2 2 0 013 2l-1 5h5a2 2 0 012 2.3l-1.2 6A2 2 0 0118.8 21H7"/></svg>';

const css=document.createElement('style');
css.textContent=`
.bz-hd{position:sticky;top:0;z-index:8;display:flex;align-items:center;gap:10px;background:var(--bg);padding:8px 14px 10px;}
.bz-back{width:40px;height:40px;flex:0 0 40px;border-radius:50%;background:#fff;box-shadow:var(--sh-sm);display:flex;align-items:center;justify-content:center;cursor:pointer;}
.bz-back svg{width:18px;height:18px;stroke:var(--ink);fill:none;stroke-width:2.4;}
.bz-search{flex:1;display:flex;align-items:center;gap:8px;background:#fff;border-radius:15px;height:44px;padding:0 14px;box-shadow:var(--sh-sm);color:var(--sub);font-size:14px;cursor:pointer;}
.bz-search svg{width:18px;height:18px;stroke:var(--sub);fill:none;stroke-width:2;}
.bz-share{flex:0 0 auto;min-height:44px;padding:0 16px;display:flex;align-items:center;border-radius:20px;background:#fff;box-shadow:var(--sh-sm);font-size:14px;font-weight:600;color:#27433A;cursor:pointer;}
.bz-tabs{display:flex;gap:26px;padding:4px 18px 0;}
.bz-tab{position:relative;padding:8px 0 10px;font-size:15.5px;font-weight:600;color:var(--sub);cursor:pointer;min-height:44px;display:flex;align-items:center;}
.bz-tab.on{color:var(--ink);font-weight:700;}
.bz-tab.on::after{content:"";position:absolute;left:0;right:0;bottom:4px;height:3px;border-radius:3px;background:var(--emerald);}
.bz-new{position:absolute;top:4px;right:-15px;background:var(--red);color:#fff;font-size:9px;font-weight:700;line-height:1;padding:2px 4px;border-radius:7px 7px 7px 0;}
.bz-filters{display:flex;gap:22px;padding:6px 18px 10px;border-bottom:1px solid var(--line);}
.bz-fil{font-size:14px;color:#27433A;font-weight:600;cursor:pointer;min-height:40px;display:flex;align-items:center;gap:3px;}
.bz-fil .v{opacity:.5;font-size:11px;}
.bz-body{padding:12px 16px 18px;}
/* 客户热搜 · 关键词排名 */
.bz-sec{display:flex;align-items:center;justify-content:space-between;margin:2px 2px 10px;}
.bz-sec .h{font-size:17px;font-weight:700;}
.bz-sec .more{font-size:12.5px;color:var(--sub);min-height:44px;display:flex;align-items:center;cursor:pointer;}
.bz-rank{background:#fff;border-radius:18px;padding:14px 16px;box-shadow:var(--sh-sm);margin-bottom:18px;}
.bz-rrow{display:grid;grid-template-columns:34px 1fr 56px 60px 56px;align-items:center;gap:6px;font-size:13.5px;padding:9px 0;}
.bz-rrow.head{font-size:11.5px;color:var(--sub);padding-bottom:6px;line-height:1.2;}
.bz-rrow:not(.head)+.bz-rrow:not(.head){border-top:1px solid var(--line);}
.bz-rk{font-size:16px;font-weight:700;color:#27433A;}
.bz-kw{font-weight:700;font-size:15px;}
.bz-cnt{text-align:right;font-weight:600;}
.bz-tr{text-align:center;font-size:15px;font-weight:700;}
.bz-tr.up{color:var(--red);}.bz-tr.down{color:var(--emerald);}
/* 热销商品卡 */
.bz-hg{background:#fff;border-radius:20px;padding:15px;box-shadow:var(--sh-sm);margin-bottom:13px;}
.bz-img{width:72px;height:72px;border-radius:14px;flex:0 0 72px;background:var(--mint-soft);display:flex;align-items:center;justify-content:center;font-size:34px;}
.bz-img.sm{width:62px;height:62px;flex:0 0 62px;font-size:30px;}
.bz-top2{display:flex;gap:13px;}
.bz-main{flex:1;min-width:0;}
.bz-nm{font-size:16.5px;font-weight:700;line-height:1.25;}
.bz-heatline{display:flex;align-items:center;gap:6px;font-size:12.5px;color:var(--sub);margin-top:5px;}
.bz-heat{display:inline-flex;gap:1px;}
.bz-fire{font-size:13px;line-height:1;}
.bz-fire.off{filter:grayscale(1);opacity:.3;}
.bz-meta{font-size:12.5px;color:var(--sub);margin-top:6px;}
.bz-meta b{color:#27433A;font-weight:700;}
.bz-tags{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px;}
.bz-tag{display:inline-flex;align-items:center;gap:3px;font-size:10.5px;font-weight:700;padding:2px 8px;border-radius:6px;}
.bz-tag.local{background:var(--red-soft);color:var(--red);}
.bz-tag.flow{background:var(--red-soft);color:var(--red);}
.bz-tag.strong{background:var(--red-soft);color:var(--red);}
.bz-tag.new{background:var(--amber-soft);color:#B45309;}
.bz-price{font-size:13px;color:#46604F;margin-top:8px;}
.bz-price .bz-spec{color:var(--sub);}
.bz-price b{color:var(--red);font-weight:700;font-size:16px;font-family:'Lora',serif;margin-left:4px;}
.bz-acts2{display:flex;align-items:center;gap:12px;margin-top:14px;}
.bz-fav{flex:0 0 auto;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1px;font-size:11px;color:var(--sub);min-width:48px;min-height:44px;cursor:pointer;}
.bz-fav .bz-ic{width:20px;height:20px;stroke:var(--sub);fill:none;stroke-width:1.8;}
.bz-fav.on .bz-ic{fill:var(--amber);stroke:var(--amber);}.bz-fav.on{color:var(--amber);}
.bz-up{flex:1;min-height:46px;display:flex;align-items:center;justify-content:center;border-radius:13px;background:var(--emerald);color:#fff;font-size:15.5px;font-weight:700;box-shadow:0 6px 16px rgba(5,150,105,.28);cursor:pointer;}
/* 热门推荐 · 顶部说明 */
.bz-notice{background:var(--amber-soft);border-radius:14px;padding:12px 14px;font-size:12.5px;color:#92600F;line-height:1.55;margin-bottom:14px;}
.bz-notice a{color:var(--emerald-2);font-weight:700;white-space:nowrap;cursor:pointer;}
/* 四宫格 */
.bz-cells{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px;}
.bz-cell{background:#fff;border-radius:16px;padding:13px;box-shadow:var(--sh-sm);cursor:pointer;}
.bz-cell .ct{font-size:15px;font-weight:700;}
.bz-cell .cs{font-size:11px;color:var(--amber);font-weight:600;margin-top:2px;}
.bz-cell .cg{display:flex;gap:6px;margin-top:9px;}
.bz-cell .cg span{width:42px;height:42px;border-radius:10px;background:var(--muted);display:flex;align-items:center;justify-content:center;font-size:22px;}
/* 推荐商品卡 */
.bz-rc{background:#fff;border-radius:20px;padding:15px;box-shadow:var(--sh-sm);margin-bottom:13px;}
.bz-reason{font-size:12.5px;color:var(--amber);font-weight:600;margin-top:8px;}
.bz-acts3{display:flex;gap:9px;margin-top:14px;}
.bz-a{flex:1;min-height:44px;display:flex;align-items:center;justify-content:center;gap:5px;border-radius:12px;font-size:13.5px;font-weight:600;cursor:pointer;background:var(--muted);color:#27433A;}
.bz-a .bz-ic{width:16px;height:16px;stroke:currentColor;fill:none;stroke-width:1.8;}
.bz-a.key{flex:1.5;background:var(--emerald);color:#fff;box-shadow:0 6px 16px rgba(5,150,105,.26);}
/* 空态 */
.bz-empty{display:flex;flex-direction:column;align-items:center;justify-content:center;padding:74px 40px;gap:14px;text-align:center;}
.bz-empty .ei{width:96px;height:96px;border-radius:28px;background:var(--mint-soft);display:flex;align-items:center;justify-content:center;}
.bz-empty .ei svg{width:42px;height:42px;stroke:var(--emerald-2);fill:none;stroke-width:1.4;}
.bz-empty h4{font-size:17px;font-weight:700;}.bz-empty p{font-size:13px;color:var(--sub);}
/* 选城市弹窗 */
.bz-mask{position:absolute;inset:0;z-index:130;background:rgba(15,23,42,.5);display:flex;align-items:center;justify-content:center;padding:30px;animation:fade .2s;}
.bz-citybox{background:linear-gradient(180deg,#EAF7F0,#fff 32%);border-radius:22px;width:100%;max-width:320px;padding:22px 18px 18px;animation:rise .25s;max-height:78%;overflow-y:auto;}
.bz-citybox::-webkit-scrollbar{display:none;}
.bz-cttl{text-align:center;font-size:19px;font-weight:700;}
.bz-csub{text-align:center;font-size:12.5px;color:var(--sub);margin:6px 0 16px;}
.bz-clist{display:flex;flex-direction:column;gap:11px;}
.bz-city{min-height:48px;display:flex;align-items:center;justify-content:center;border-radius:13px;background:var(--muted);font-size:15px;font-weight:600;color:#27433A;cursor:pointer;}
.bz-city.on{background:var(--mint-soft);color:var(--emerald-2);box-shadow:inset 0 0 0 1.5px var(--emerald);}
`;
document.head.appendChild(css);

const CITIES=['上海事业部','苏州事业部','常州事业部','重庆事业部','杭州事业部','成都事业部','嘉兴事业部'];

const HOT_KW=[
  ['1','鸡蛋','10万+','up','10万+'],
  ['2','金针菇','10万+','down','10万+'],
  ['3','豆腐','10万+','down','10万+'],
  ['4','香干','10万+','down','10万+'],
  ['5','鹌鹑蛋','10万+','down','10万+'],
];
const HOT_GOODS=[
  {ic:'🥚',n:'(京闽鲜)红壳鸡蛋大码30枚',heat:4,sales:'S$265.9万+',sellers:19,tag:'本地热销',spec:'3.6斤/托(30枚)',price:'S$17.26'},
  {ic:'🥚',n:'红壳鲜鸡蛋 中码 筐装',heat:4,sales:'S$717.9万+',sellers:14,tag:'本地热销',spec:'4.5斤/筐',price:'S$15.80'},
];
const CELLS=[
  {t:'本城热卖',s:'汇聚本城高销商品',ics:['🍅','🥦','🧴']},
  {t:'首发新品',s:'本城首发 独享新鲜',ics:['🥔','🎃','🍆']},
  {t:'低竞争品',s:'低竞争 高回报商品',ics:['🥩','🍱','🥚']},
  {t:'优选推荐',s:'精挑细选 汇聚精品',ics:['🥬','🧅','🥗']},
];
const REC=[
  {ic:'🥟',n:'[希波]萝卜牛肉饼',heat:4,tags:[['高流量','flow'],['平台新品','new']],reason:'平台新品 · 流量扶持'},
  {ic:'🌭',n:'[海旸]精致火山石肉肠',heat:4,tags:[['高流量','flow'],['平台新品','new']],reason:'平台新品 · 流量扶持'},
  {ic:'🥬',n:'海带片海带条(免切)优质',heat:3,tags:[['强烈推荐','strong']],sales:'S$1000+',sellers:8,spec:'2斤/袋',price:'S$6.50',reason:'客户高购买需求'},
  {ic:'🥬',n:'鲜 海带丝(免切)',heat:4,tags:[['本地热销','local']],sales:'S$15.2万+',sellers:8,spec:'10斤/袋',price:'S$12.66',reason:'客户高销品'},
  {ic:'🌶️',n:'青尖椒 优质',heat:4,tags:[['高流量','flow'],['本地热销','local']],sales:'S$2万',buyers:200,sellers:12,spec:'5斤',price:'S$14.50',reason:'客户高销品'},
  {ic:'🥔',n:'黄心大土豆',heat:3,tags:[['高流量','flow'],['本地热销','local']],sales:'S$2万',buyers:200,sellers:12,spec:'5斤',price:'S$14.50',reason:'客户高销品'},
];

function heat(n){let s='';for(let i=0;i<5;i++)s+=`<span class="bz-fire${i<n?'':' off'}">🔥</span>`;return `<span class="bz-heat">${s}</span>`;}

/* 选上品城市弹窗(自绘) */
function cityDialog(cur,onPick){
  const m=document.createElement('div');m.className='bz-mask';
  m.innerHTML=`<div class="bz-citybox"><div class="bz-cttl disp">请选择要上品的城市</div>
    <div class="bz-csub">系统会根据你选择的城市推荐商品</div>
    <div class="bz-clist">${CITIES.map(c=>`<div class="bz-city${c===cur?' on':''}" data-c="${c}">${c}</div>`).join('')}</div></div>`;
  document.querySelector('.phone').appendChild(m);
  m.querySelectorAll('.bz-city').forEach(el=>el.onclick=()=>{m.remove();onPick(el.dataset.c);});
  m.onclick=e=>{if(e.target===m)m.remove();}; // 点遮罩保留当前城市
}

/* 客户热搜 */
function viewHot(box){
  const rows=HOT_KW.map(r=>`<div class="bz-rrow"><span class="bz-rk">${r[0]}</span><span class="bz-kw">${r[1]}</span>
    <span class="bz-cnt">${r[2]}</span><span class="bz-tr ${r[3]}">${r[3]==='up'?'↑':'↓'}</span><span class="bz-cnt">${r[4]}</span></div>`).join('');
  const goods=HOT_GOODS.map(g=>`<div class="bz-hg" data-n="${g.n}">
    <div class="bz-top2"><div class="bz-img">${g.ic}</div><div class="bz-main">
      <div class="bz-nm">${g.n} ›</div>
      <div class="bz-heatline">客户热度 ${heat(g.heat)}</div>
      <div class="bz-meta">月销 <b>${g.sales}</b> · 在售卖家 ${g.sellers}</div>
      <div class="bz-tags"><span class="bz-tag local">${g.tag}</span></div>
      <div class="bz-price"><span class="bz-spec">${g.spec}</span> 参考价 <b>${g.price}</b></div>
    </div></div>
    <div class="bz-acts2"><div class="bz-fav" data-act="fav">${STAR}<span>收藏</span></div>
      <div class="bz-up" data-act="up">立即上品</div></div></div>`).join('');
  box.innerHTML=`<div class="bz-sec"><span class="h">热搜关键词排名</span><span class="more" data-act="all">查看全部 ›</span></div>
    <div class="bz-rank"><div class="bz-rrow head"><span>排名</span><span>关键词</span><span style="text-align:right">搜索次数</span><span style="text-align:center;line-height:1.2">搜索次数<br>较上月</span><span style="text-align:right">月购买量</span></div>${rows}</div>
    <div class="bz-sec"><span class="h">热销商品</span></div>${goods}`;
  bindActs(box);
}

/* 热门推荐 */
function viewRec(box){
  const cells=CELLS.map(c=>`<div class="bz-cell" data-cell="${c.t}"><div class="ct">${c.t}</div><div class="cs">${c.s}</div>
    <div class="cg">${c.ics.map(i=>`<span>${i}</span>`).join('')}</div></div>`).join('');
  const cards=REC.map(g=>`<div class="bz-rc" data-n="${g.n}">
    <div class="bz-top2"><div class="bz-img sm">${g.ic}</div><div class="bz-main">
      <div class="bz-nm">${g.n} ›</div>
      <div class="bz-heatline">客户热度 ${heat(g.heat)}</div>
      <div class="bz-tags">${g.tags.map(t=>`<span class="bz-tag ${t[1]}">${t[0]}</span>`).join('')}</div>
      ${g.sales?`<div class="bz-meta">月销 <b>${g.sales}</b>${g.buyers?` · 月买客户 ${g.buyers}`:''} · 在售卖家 ${g.sellers}</div>`:''}
      ${g.price?`<div class="bz-price"><span class="bz-spec">${g.spec}</span> 参考价 <b>${g.price}</b></div>`:''}
      <div class="bz-reason">推荐理由：${g.reason}</div>
    </div></div>
    <div class="bz-acts3"><div class="bz-a" data-act="no">${THUMB}不再推荐</div>
      <div class="bz-a" data-act="fav">${STAR}收藏</div>
      <div class="bz-a key" data-act="up">立即上品</div></div></div>`).join('');
  box.innerHTML=`<div class="bz-notice">以下是客户有购买需求的商品，点击"立即上品"后上架该商品可获得流量权益。<a data-act="learn">了解详情 ›</a></div>
    <div class="bz-cells">${cells}</div>
    <div id="bz-reclist">${cards}</div>`;
  bindActs(box);
}

function viewFav(box){
  box.innerHTML=`<div class="bz-empty"><div class="ei">${svg('tag')}</div><h4>暂无商品推荐</h4><p>收藏感兴趣的商机商品，会出现在这里</p></div>`;
}

function bindActs(box){
  box.querySelectorAll('[data-act]').forEach(el=>el.onclick=()=>{
    const act=el.dataset.act;
    const card=el.closest('[data-n]');const nm=card?card.dataset.n:'';
    if(act==='up'){
      confirmDialog({title:'立即上品该商品？',body:`「${nm}」上架后可获得平台流量权益，进入店铺即可销售。`,okText:'立即上品',
        onOk:()=>toast('已提交上品')});
    }else if(act==='fav'){
      el.classList.toggle('on');toast(el.classList.contains('on')?'已收藏':'已取消收藏');
    }else if(act==='no'){
      confirmDialog({danger:1,title:'不再推荐该商品？',body:`「${nm}」将不再出现在推荐列表，可在设置中恢复。`,okText:'不再推荐',
        onOk:()=>{card.remove();toast('已不再推荐');
          const list=box.querySelector('#bz-reclist');
          if(list&&!list.children.length)list.innerHTML=`<div class="bz-empty"><div class="ei">${svg('tag')}</div><h4>暂无商品推荐</h4><p>已处理完当前城市的推荐商品</p></div>`;}});
    }else if(act==='all'){toast('查看全部热搜关键词');}
    else if(act==='learn'){toast('了解流量扶持详情');}
    else if(el.dataset.cell){toast('查看 '+el.dataset.cell);}
  });
  box.querySelectorAll('.bz-cell').forEach(c=>c.onclick=()=>toast('查看 '+c.dataset.cell));
}

function openBiz(){
  const state={tab:'hot',city:CITIES[0]};
  pushPage({navbar:false,body:`
    <div class="bz-hd"><span class="bz-back">${svg('back')}</span>
      <div class="bz-search" id="bzs">${svg('search')}<span>搜索商品或品牌</span></div>
      <span class="bz-share" id="bzsh">分享</span></div>
    <div class="bz-tabs" id="bzt">
      <div class="bz-tab on" data-t="hot">客户热搜<span class="bz-new">新</span></div>
      <div class="bz-tab" data-t="rec">热门推荐</div>
      <div class="bz-tab" data-t="fav">收藏</div></div>
    <div class="bz-filters">
      <span class="bz-fil" data-f="city" id="bzcity">${state.city} <span class="v">∨</span></span>
      <span class="bz-fil" data-f="cat">类目 <span class="v">∨</span></span>
      <span class="bz-fil" data-f="type">商品类型 <span class="v">∨</span></span></div>
    <div class="bz-body" id="bzbody"></div>`,
    mount:(p)=>{
      const body=p.querySelector('#bzbody');
      const cityEl=p.querySelector('#bzcity');
      const draw=(tab)=>{
        state.tab=tab;
        body.innerHTML=skel(3);                                  // 骨架屏
        setTimeout(()=>{                                         // 模拟按城市拉取
          if(tab==='hot')viewHot(body);else if(tab==='rec')viewRec(body);else viewFav(body);
        },420);
      };
      p.querySelector('.bz-back').onclick=popPage;
      p.querySelector('#bzs').onclick=()=>toast('搜索商品或品牌');
      p.querySelector('#bzsh').onclick=()=>toast('分享商机推荐');
      p.querySelectorAll('#bzt .bz-tab').forEach(t=>t.onclick=()=>{
        p.querySelectorAll('#bzt .bz-tab').forEach(x=>x.classList.remove('on'));t.classList.add('on');draw(t.dataset.t);
      });
      p.querySelectorAll('.bz-fil').forEach(f=>f.onclick=()=>{
        if(f.dataset.f==='city')cityDialog(state.city,c=>{state.city=c;cityEl.innerHTML=`${c} <span class="v">∨</span>`;draw(state.tab);});
        else toast(f.dataset.f==='cat'?'选择类目':'选择商品类型');
      });
      draw('hot');
      cityDialog(state.city,c=>{state.city=c;cityEl.innerHTML=`${c} <span class="v">∨</span>`;draw(state.tab);}); // 进页先选城市
    }});
}

window.FM_MOD=window.FM_MOD||{};
window.FM_MOD.biz=openBiz;
})();
