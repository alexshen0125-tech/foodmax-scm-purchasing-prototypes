/* Food Max 商家端 v2 · 发布商品(创建商品)模块
   关键约束(沈亮定)：交互流程形态照快驴 App 录屏走，但字段与校验规则一律用 PC 那套，不照搬 App 的字段。
   App 流程形态：选择建品方式 → (商品库)搜索→找品结果→修改复用 / (手动)→ 创建商品表单。
   PC 规则落点：必填(autoCheck)=商品名称/后台类目/税率/最小售卖单位/售卖规格(≥1)；
   后台类目取 PC 的 CATS(默认税率+指导价，税率手填可改)；售卖规格按 PC=数量(正整数≥1、不可重复)，售卖单位只读=最小售卖单位；
   提交跑校验；价格异常=偏离类目指导价 0.5~2 倍。前台不出现货品(Item)，后台据 SPU/SKU 自动建货品。
   PC 对齐(2026-07)：价格+库存落到每个售卖规格(SKU)，非整商品一个售价。
   PC 对齐(2026-07-03)：前台类目→后台类目、计量单位→最小售卖单位(+净含量/单位/备注)、税率手填、
   销售类型固定「售卖品」只读、效期管理(默认是)+保质期+单位+APP是否展示效期(展示/不展示)、储存条件、履约方式；去「保存为草稿」。
   评审修复内建：即时校验失败标红 / 提交 loading / 破坏性退出 confirmDialog / ≥44px / 加载态 / SG 数据。 */
(function(){
const {pushPage,popPage,toast,confirmDialog,sheet,svg,skel}=window.FM;

/* ========== 实时翻译 PBTR（与 PC 端商家管理系统 TR 同源逻辑）==========
   覆盖买家可见核心自由文本：商品名/别名(多值)/产地/品牌/描述。中↔英自动判向，露出译文行，可手改，手改后锁定不自动覆盖。
   枚举(单位/类目/储存/履约等)不翻译，由「系统语言版本」呈现。演示 mock 词典；真实接平台翻译 API（服务待研发确认）。
   用法：给输入框加 data-tr（多值加 data-tr-multi），mount 后调用 PBTR.init(page)。 */
const PBTR=(function(){
  const ZH2EN={
    '小棠菜':'Xiao Tang Cai','娃娃菜':'Baby Bok Choy','芥蓝':'Kai Lan','菠菜':'Spinach','土豆':'Potato','马铃薯':'Potato','白菜':'Chinese Cabbage','冰鲜三文鱼':'Chilled Salmon','三文鱼':'Salmon','鸡胸肉':'Chicken Breast','生蚝':'Oyster','嫩豆腐':'Silken Tofu','老豆腐':'Firm Tofu','油豆腐':'Fried Tofu Puff','海带丝':'Kelp Shreds','萝卜丸子':'Radish Ball',
    '有机':'Organic','新鲜':'Fresh','精选':'Premium','当日现摘':'Freshly Picked','叶嫩梗脆':'tender leaves and crisp stems','当日':'Same-day','优质':'Quality',
    '绿鲜源':'GreenFresh','新加坡':'Singapore','马来西亚':'Malaysia','中国山东':'Shandong, China','中国':'China','挪威':'Norway','泰国':'Thailand','法国':'France','金马仑':'Cameron Highlands','林厝港':'Lim Chu Kang','山东':'Shandong',
    '袋':'Bag','箱':'Carton','盒':'Box','包':'Pack','斤':'Jin','公斤':'kg','千克':'kg',
    '新鲜蔬菜':'Fresh Vegetables','蔬菜':'Vegetables','海鲜水产':'Seafood','肉禽蛋品':'Meat & Poultry',
    '蔬果生鲜店':'Fresh Produce Store','蔬果生鲜':'Fresh Produce','店铺':'Store','餐厅':'Restaurant','食材':'Ingredients','供应':'Supply','配送':'Delivery','全岛':'islandwide','每日':'Daily','专业':'Professional',
  };
  const EN2ZH={};Object.keys(ZH2EN).forEach(k=>{const v=ZH2EN[k].toLowerCase();if(!EN2ZH[v])EN2ZH[v]=k;});
  const hasCJK=s=>/[一-鿿㐀-䶿]/.test(s);
  function zh2en(t){if(ZH2EN[t])return ZH2EN[t];let out=t;Object.keys(ZH2EN).sort((a,b)=>b.length-a.length).forEach(k=>{if(out.includes(k))out=out.split(k).join(' '+ZH2EN[k]+' ');});return out.replace(/[，、]/g,', ').replace(/。/g,'. ').replace(/\s+/g,' ').replace(/\s+([,.])/g,'$1').trim();}
  function en2zh(t){const low=t.toLowerCase();if(EN2ZH[low])return EN2ZH[low];let out=t;Object.keys(EN2ZH).sort((a,b)=>b.length-a.length).forEach(k=>{const re=new RegExp(k.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'ig');out=out.replace(re,EN2ZH[k]);});return out.trim();}
  const one=(text,dir)=>dir=='zh2en'?zh2en(text):en2zh(text);
  function translate(text,dir,multi){if(multi){return text.split(/[,，]/).map(x=>x.trim()).filter(Boolean).map(x=>one(x,dir)).join(dir=='zh2en'?', ':'，');}return one(text,dir);}
  function attach(el){
    const multi=el.hasAttribute('data-tr-multi');
    const cell=el.closest('.pb-cell')||el;
    const row=document.createElement('div');row.className='pb-tr-row';
    row.innerHTML=`<span class="pb-tr-badge">🌐 EN</span><input class="pb-tr-in" placeholder="输入后自动生成译文，可手动修改"><span class="pb-tr-edited" style="display:none">✎手动改</span><button type="button" class="pb-tr-re">↻ 重新翻译</button>`;
    cell.insertAdjacentElement('afterend',row);
    const trIn=row.querySelector('.pb-tr-in'),badge=row.querySelector('.pb-tr-badge'),edited=row.querySelector('.pb-tr-edited'),reBtn=row.querySelector('.pb-tr-re');
    const run=()=>{const src=(el.value||'').trim();const dir=hasCJK(src)?'zh2en':'en2zh';badge.textContent=dir=='zh2en'?'🌐 EN':'🌐 中';if(trIn._locked)return;if(!src){trIn.value='';return;}trIn.value=translate(src,dir,multi);};
    let timer=null;el.addEventListener('input',()=>{clearTimeout(timer);timer=setTimeout(run,600);});
    trIn.addEventListener('input',()=>{trIn._locked=true;edited.style.display='';});
    reBtn.addEventListener('click',()=>{trIn._locked=false;edited.style.display='none';run();});
    if((el.value||'').trim())run();
  }
  function init(root){(root||document).querySelectorAll('[data-tr]').forEach(el=>{if(el._trInit)return;el._trInit=1;attach(el);});}
  if(!document.getElementById('pb-tr-style')){
    const st=document.createElement('style');st.id='pb-tr-style';st.textContent=`
    .pb-tr-row{display:flex;align-items:center;gap:7px;margin:-2px 14px 8px;padding:7px 9px;background:#F1F6FF;border:1px dashed #C3D6F5;border-radius:10px;}
    .pb-tr-badge{flex:0 0 auto;font-size:11px;font-weight:700;color:#2563EB;background:#E1EBFF;border-radius:6px;padding:2px 6px;white-space:nowrap;}
    .pb-tr-in{flex:1;min-width:0;border:none;background:transparent;border-radius:6px;padding:4px 4px;font-size:13px;color:#1E3A8A;font-family:inherit;}
    .pb-tr-in:focus{outline:none;background:#fff;box-shadow:inset 0 0 0 1px #93B4F5;}
    .pb-tr-in::placeholder{color:#9DB4E0;}
    .pb-tr-edited{flex:0 0 auto;font-size:10.5px;color:#B45309;background:#FEF3C7;border-radius:6px;padding:2px 5px;white-space:nowrap;}
    .pb-tr-re{flex:0 0 auto;font-size:11px;color:#2563EB;background:none;border:none;cursor:pointer;white-space:nowrap;font-family:inherit;padding:2px 0;}
    .pb-tr-re:active{opacity:.6;}`;
    document.head.appendChild(st);
  }
  return {init};
})();

/* ========== PC 规则数据(承重墙，照 PC 那套) ========== */
// 后台类目(单级简化)：税率(默认值，手填可改) + 指导价(S$)，价格异常以指导价为基准
const CATS=[
  {n:'新鲜蔬菜',tax:0, guide:6},
  {n:'肉禽蛋品',tax:9, guide:14},
  {n:'海鲜水产',tax:9, guide:25},
  {n:'调味品',  tax:9, guide:18},
];
// 经营许可证覆盖的类目(资质校验，BR-08)：调味品未覆盖
const LICENSE=new Set(['新鲜蔬菜','肉禽蛋品','海鲜水产']);
// 最小售卖单位(PC 基础计量单位；SKU 售卖单位只读 = 最小售卖单位)
const MEASURE_UNITS=['斤','公斤(kg)','克(g)','毫升(ml)','升(L)','个','只','件','包','袋','盒','箱','瓶','桶','罐'];
// 净含量单位
const NET_UNITS=['g','kg','ml','L','斤','个'];
// 效期单位
const SHELF_UNITS=['天','月','年'];
// 储存条件
const STORAGES=['常温','阴凉干燥','冷藏(0~4℃)','冷冻(-18℃)'];
// 履约方式
const FULFILLS=['次日达','当日达','商家自配','到店自提'];
// 已存在(非草稿)商品名库，用于 BR-09 同名校验(取自 goods.js 销售中/未上架)
const EXISTING=['鲜丰 · 嫩豆腐 1kg','鲜丰 · 老豆腐','鲜丰 · 小油豆腐','冻 · 盐渍海带丝','萝卜丸子'];

// 商品库 mock(SG 本地化)，找品列表用
const LIB=[
  {brand:'鲜丰',  name:'鲜鸡蛋（无菌蛋）50g',  spec:'500g/盒 · 4500g/箱(9盒)', attr:'本地 / 可生食 · 保质期30天 · 常温', imgs:['🥚','📦','🥚','🧺'], cat:'肉禽蛋品', measure:'盒', shelf:'30天'},
  {brand:'裕廊农场',name:'新鲜娃娃菜 500g',     spec:'500g/袋 · 5kg/箱',        attr:'本地 / 净菜 · 保质期7天 · 冷藏',   imgs:['🥬','📦','🥬'],    cat:'新鲜蔬菜', measure:'袋', shelf:'7天'},
  {brand:'海联',  name:'冰鲜龙利鱼柳 1kg',     spec:'1kg/袋 · 10kg/箱',        attr:'进口 / 冰鲜 · 保质期3天 · 冷藏',   imgs:['🐟','📦'],         cat:'海鲜水产', measure:'袋', shelf:'3天'},
];
const HISTORY=['鲜鸡蛋','娃娃菜','龙利鱼','生姜','五花肉','金针菇'];

/* ========== 样式 ========== */
const css=document.createElement('style');
css.textContent=`
/* 底部抽屉(建品方式 / 单位选择 / 类目选择) */
.pb-mask{position:absolute;inset:0;z-index:130;background:rgba(15,23,42,.45);display:flex;align-items:flex-end;animation:fade .2s;}
.pb-sheet{width:100%;background:#fff;border-radius:22px 22px 0 0;padding:6px 0 18px;max-height:78%;display:flex;flex-direction:column;animation:rise .25s;}
.pb-sh-hd{position:relative;padding:18px 20px 14px;font-size:17px;font-weight:700;text-align:center;}
.pb-sh-hd .x{position:absolute;right:14px;top:12px;width:36px;height:36px;display:flex;align-items:center;justify-content:center;color:var(--sub);font-size:18px;cursor:pointer;}
/* 建品方式卡 */
.pb-method{display:flex;align-items:center;gap:16px;margin:0 16px 12px;padding:18px;border-radius:18px;background:var(--muted);cursor:pointer;min-height:44px;}
.pb-method:active{background:#E7F3EE;}
.pb-method .mi{width:54px;height:54px;border-radius:16px;display:flex;align-items:center;justify-content:center;flex:0 0 54px;}
.pb-method .mi svg{width:26px;height:26px;fill:none;stroke-width:1.9;}
.pb-method .mi.blue{background:#DBEAFE;}.pb-method .mi.blue svg{stroke:#2563EB;}
.pb-method .mi.green{background:var(--mint-soft);}.pb-method .mi.green svg{stroke:var(--emerald-2);}
.pb-method .mt .t{font-size:17px;font-weight:700;}
.pb-method .mt .d{font-size:12.5px;color:var(--sub);margin-top:4px;}
/* 单位网格 */
.pb-search-mini{display:flex;align-items:center;gap:8px;background:var(--muted);border-radius:12px;height:44px;margin:0 16px 12px;padding:0 14px;}
.pb-search-mini svg{width:16px;height:16px;stroke:var(--sub);fill:none;stroke-width:2;}
.pb-search-mini input{flex:1;border:none;background:transparent;outline:none;font-size:14px;font-family:inherit;}
.pb-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:11px;padding:0 16px;overflow-y:auto;}
.pb-uchip{min-height:46px;display:flex;align-items:center;justify-content:center;border-radius:12px;background:var(--muted);font-size:14px;color:#27433A;cursor:pointer;}
.pb-uchip:active,.pb-uchip.on{background:var(--mint-soft);color:var(--emerald-2);font-weight:700;}
/* 类目列表 */
.pb-catlist{padding:0 16px;overflow-y:auto;}
.pb-catrow{display:flex;align-items:center;justify-content:space-between;padding:15px 14px;margin-bottom:10px;border-radius:14px;background:var(--muted);cursor:pointer;min-height:44px;}
.pb-catrow:active{background:#E7F3EE;}
.pb-catrow .cn{font-size:16px;font-weight:700;}
.pb-catrow .cm{font-size:12px;color:var(--sub);margin-top:3px;}
.pb-catrow .ch svg{width:16px;height:16px;stroke:var(--sub);fill:none;stroke-width:2.2;}

/* 搜索商品页 */
.pb-sbar{padding:10px 16px 6px;}
.pb-sbox{display:flex;align-items:center;gap:10px;}
.pb-sbox .inp{flex:1;display:flex;align-items:center;gap:9px;background:#fff;border-radius:14px;height:46px;padding:0 14px;box-shadow:var(--sh-sm);}
.pb-sbox .inp svg{width:18px;height:18px;stroke:var(--sub);fill:none;stroke-width:2;flex:0 0 18px;}
.pb-sbox .inp input{flex:1;border:none;background:transparent;outline:none;font-size:14px;font-family:inherit;}
.pb-sbox .scan{width:46px;height:46px;border-radius:14px;background:#fff;box-shadow:var(--sh-sm);display:flex;align-items:center;justify-content:center;cursor:pointer;}
.pb-sbox .scan svg{width:22px;height:22px;stroke:var(--ink);fill:none;stroke-width:1.8;}
.pb-sbox .go{min-height:46px;padding:0 16px;border-radius:14px;background:var(--emerald);color:#fff;font-size:15px;font-weight:700;border:none;cursor:pointer;font-family:inherit;}
.pb-his{padding:18px 16px 8px;}
.pb-his .ht{font-size:14px;font-weight:700;margin-bottom:12px;}
.pb-his .hc{display:flex;flex-wrap:wrap;gap:9px;}
.pb-his .hc span{background:#fff;box-shadow:var(--sh-sm);border-radius:20px;padding:8px 15px;font-size:13px;color:#27433A;cursor:pointer;min-height:36px;display:flex;align-items:center;}
/* 底部"手动新建"引导 */
.pb-foot-hint{flex:0 0 auto;background:#fff;border-top:1px solid var(--line);padding:16px;text-align:center;font-size:13.5px;color:var(--sub);}
.pb-foot-hint a{color:var(--emerald);font-weight:700;cursor:pointer;}

/* 商品库找品结果卡 */
.pb-libcard{background:#fff;border-radius:18px;margin:0 16px 13px;padding:16px;box-shadow:var(--sh-sm);}
.pb-libcard .lh{display:flex;justify-content:space-between;align-items:flex-start;gap:10px;}
.pb-libcard .ln{font-size:16px;font-weight:700;line-height:1.3;}
.pb-libcard .detail{flex:0 0 auto;font-size:13px;color:var(--emerald);font-weight:600;display:flex;align-items:center;gap:2px;min-height:44px;}
.pb-libcard .lspec{font-size:13px;color:#46604F;margin-top:6px;}
.pb-libcard .lattr{font-size:12px;color:var(--sub);margin-top:8px;background:var(--muted);border-radius:10px;padding:9px 11px;line-height:1.5;}
.pb-libcard .limgs{display:flex;gap:8px;margin-top:11px;align-items:center;}
.pb-libcard .limgs .t{width:54px;height:54px;border-radius:11px;background:var(--mint-soft);display:flex;align-items:center;justify-content:center;font-size:26px;flex:0 0 54px;}
.pb-libcard .limgs .cnt{font-size:11px;color:var(--sub);margin-left:auto;text-align:center;}
.pb-libcard .lact{display:flex;justify-content:flex-end;margin-top:13px;}
.pb-libcard .reuse{min-height:44px;padding:0 20px;border-radius:11px;border:1.5px solid var(--emerald);color:var(--emerald);background:#fff;font-size:14px;font-weight:700;cursor:pointer;font-family:inherit;}

/* 创建商品表单 */
.pb-note{background:var(--amber-soft);color:#B45309;font-size:12.5px;text-align:center;padding:10px 16px;font-weight:600;}
.pb-errs{display:none;background:var(--red-soft);margin:12px 16px 0;border-radius:14px;padding:14px 16px;}
.pb-errs .eh{display:flex;align-items:center;gap:7px;font-size:14px;font-weight:700;color:var(--red);margin-bottom:8px;}
.pb-errs .eh svg{width:17px;height:17px;stroke:var(--red);fill:none;stroke-width:2;}
.pb-errs .li{font-size:13px;color:#B91C1C;padding:4px 0 4px 4px;line-height:1.4;}
.pb-errs .li .cat{display:inline-block;background:#fff;color:var(--red);border-radius:6px;padding:0 6px;font-size:11px;font-weight:700;margin-right:6px;}
.pb-card{background:#fff;border-radius:18px;margin:12px 16px;box-shadow:var(--sh-sm);overflow:hidden;}
.pb-card .ct{font-size:13px;font-weight:700;color:var(--sub);padding:14px 16px 4px;display:flex;justify-content:space-between;align-items:center;}
.pb-card .ct .edit{color:var(--emerald);cursor:pointer;}
.pb-cell{display:flex;align-items:center;gap:12px;padding:14px 16px;min-height:54px;border-top:1px solid var(--line);cursor:pointer;}
.pb-cell:first-of-type{border-top:none;}
.pb-cell .lab{font-size:15px;font-weight:600;color:#27433A;flex:0 0 92px;}
.pb-cell .lab .rq{color:var(--red);margin-right:2px;}
.pb-cell .val{flex:1;display:flex;align-items:center;gap:6px;min-width:0;}
.pb-cell .val input{flex:1;border:none;background:transparent;outline:none;font-size:15px;font-family:inherit;width:100%;text-align:right;}
.pb-cell .val .ph{color:#94A3B8;flex:1;text-align:right;font-size:15px;}
.pb-cell .val .vtxt{flex:1;text-align:right;font-size:15px;color:var(--ink);font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.pb-cell .val .pre{color:var(--sub);font-size:14px;}
.pb-cell .ch svg{width:16px;height:16px;stroke:#94A3B8;fill:none;stroke-width:2.2;}
.pb-cell.err{background:var(--red-soft);}
.pb-cell.err .lab{color:var(--red);}
.pb-cell.warn{background:#FFFBEB;}
/* 售卖规格 */
.pb-spec{margin:10px 14px 0;border:1px solid var(--line);border-radius:14px;padding:12px 13px;}
.pb-spec.err{border-color:var(--red);background:var(--red-soft);}
.pb-spec .sh{display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;}
.pb-spec .sh .sn{font-size:14px;font-weight:700;}
.pb-spec .sh .del{font-size:13px;color:var(--red);min-height:44px;display:flex;align-items:center;padding:0 4px;cursor:pointer;}
.pb-spec .sbody{display:flex;gap:10px;}
.pb-spec .qty,.pb-spec .unit{flex:1;background:var(--muted);border-radius:11px;min-height:46px;display:flex;align-items:center;padding:0 12px;gap:6px;border:1.5px solid transparent;}
.pb-spec .qty:focus-within{border-color:var(--emerald);background:#fff;}
.pb-spec .lb{font-size:13px;color:var(--sub);flex:0 0 auto;}
.pb-spec .qty input{flex:1;border:none;background:transparent;outline:none;font-size:15px;font-family:inherit;width:100%;}
.pb-spec .unit{cursor:pointer;justify-content:space-between;}
.pb-spec .unit .uv{font-size:15px;font-weight:600;}.pb-spec .unit .uv.ph{color:#94A3B8;font-weight:400;}
.pb-spec .unit .ch{color:#94A3B8;}
.pb-spec .serr{color:var(--red);font-size:11.5px;margin-top:7px;min-height:0;}
.pb-addspec{margin:12px 14px 4px;min-height:46px;border:1.5px dashed var(--emerald);border-radius:12px;color:var(--emerald);font-size:14px;font-weight:700;display:flex;align-items:center;justify-content:center;cursor:pointer;}
/* 图片区 */
.pb-imgsec{padding:6px 16px 4px;}
.pb-imgsec .it{font-size:13px;font-weight:700;margin:14px 0 10px;}
.pb-imgsec .it .rq{color:var(--red);margin-right:2px;}
.pb-imgsec .it .tip{font-weight:400;color:var(--sub);font-size:11.5px;margin-left:8px;}
.pb-tiles{display:flex;flex-wrap:wrap;gap:10px;}
.pb-tile{width:78px;height:78px;border-radius:12px;background:var(--muted);border:1px solid var(--line);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;position:relative;cursor:pointer;}
.pb-tile.filled{background:var(--mint-soft);border-color:transparent;}
.pb-tile .pl{font-size:24px;color:#94A3B8;line-height:1;}
.pb-tile.filled .pl{font-size:30px;}
.pb-tile .tl{font-size:10.5px;color:var(--sub);}
.pb-tile .rq{position:absolute;top:4px;left:4px;background:#3B82F6;color:#fff;font-size:9px;padding:1px 5px;border-radius:6px;}
.pb-tile .rm{position:absolute;top:-7px;right:-7px;width:20px;height:20px;border-radius:50%;background:rgba(15,23,42,.7);color:#fff;font-size:11px;display:flex;align-items:center;justify-content:center;}
.pb-foot2{display:flex;gap:12px;}
.pb-foot2 .draft{flex:1;background:var(--muted);color:var(--ink);}
.pb-foot2 .sub{flex:1.5;}
`;
document.head.appendChild(css);

/* ========== 页面栈追踪(发布流程内的页面，成功/退出时整体回退到商品列表) ========== */
let pbPages=[];
function pbPush(o){
  const userMount=o.mount;
  o.mount=(el)=>{
    const back=el.querySelector('.back');
    if(back)back.onclick=()=> (o.onBack?o.onBack():(popPage(),pbPages.pop()));
    userMount&&userMount(el);
  };
  const el=pushPage(o);pbPages.push(el);return el;
}
function pbCloseAll(){while(pbPages.length){popPage();pbPages.pop();}}

/* ========== 通用底部抽屉 ========== */
function pbDrawer(html){
  const m=document.createElement('div');m.className='pb-mask';
  m.innerHTML=`<div class="pb-sheet">${html}</div>`;
  document.querySelector('.phone').appendChild(m);
  m.onclick=e=>{if(e.target===m)m.remove();};
  return m;
}
function pbGridPicker(title,opts,cur,onPick){
  const m=pbDrawer(`<div class="pb-sh-hd">${title}<span class="x">✕</span></div>
    <div class="pb-search-mini">${svg('search')}<input placeholder="搜索" data-s></div>
    <div class="pb-grid" data-g>${opts.map(o=>`<div class="pb-uchip${o===cur?' on':''}" data-v="${o}">${o}</div>`).join('')}</div>`);
  m.querySelector('.x').onclick=()=>m.remove();
  m.querySelectorAll('.pb-uchip').forEach(c=>c.onclick=()=>{m.remove();onPick(c.dataset.v);});
  const s=m.querySelector('[data-s]');
  s.oninput=()=>{const kw=s.value.trim();m.querySelectorAll('.pb-uchip').forEach(c=>c.style.display=c.dataset.v.includes(kw)?'':'none');};
}
function pbCatPicker(cur,onPick){
  const m=pbDrawer(`<div class="pb-sh-hd">选择前台类目<span class="x">✕</span></div>
    <div class="pb-catlist">${CATS.map(c=>`<div class="pb-catrow" data-n="${c.n}"><div><div class="cn">${c.n}</div><div class="cm">税率 ${c.tax}% · 指导价 S$${c.guide.toFixed(2)}${LICENSE.has(c.n)?'':' · 资质未覆盖'}</div></div><span class="ch">${svg('arrow')}</span></div>`).join('')}<div style="height:6px"></div></div>`);
  m.querySelector('.x').onclick=()=>m.remove();
  m.querySelectorAll('.pb-catrow').forEach(r=>r.onclick=()=>{m.remove();onPick(CATS.find(c=>c.n===r.dataset.n));});
}

/* ========== 入口：选择建品方式 ========== */
function entry(){
  pbPages=[]; // 入口处复位(流程开始)
  const m=pbDrawer(`<div class="pb-sh-hd">选择建品方式<span class="x">✕</span></div>
    <div class="pb-method" data-m="lib"><div class="mi blue">${svg('box')}</div><div class="mt"><div class="t">从商品库创建</div><div class="d">直接复用商品库的商品信息，填写较少</div></div></div>
    <div class="pb-method" data-m="manual"><div class="mi green">${svg('sign')}</div><div class="mt"><div class="t">手动创建</div><div class="d">需要填写全部商品信息</div></div></div>`);
  m.querySelector('.x').onclick=()=>m.remove();
  m.querySelector('[data-m="lib"]').onclick=()=>{m.remove();openLibSearch();};
  m.querySelector('[data-m="manual"]').onclick=()=>{m.remove();openForm();};
}

/* ========== 商品库 · 搜索商品页 ========== */
function openLibSearch(){
  pbPush({title:'搜索商品',
    body:`<div class="pb-sbar"><div class="pb-sbox">
        <div class="inp">${svg('search')}<input id="pb-kw" placeholder="支持搜索商品名称、品牌"></div>
        <div class="scan" id="pb-scan">${svg('box')}</div>
        <button class="go" id="pb-go">搜索</button></div></div>
      <div class="pb-his"><div class="ht">历史搜索</div><div class="hc" id="pb-his">${HISTORY.map(h=>`<span data-h="${h}">${h}</span>`).join('')}</div></div>`,
    footer:`<div style="text-align:center;font-size:13.5px;color:var(--sub)">如果没有找到想要商品，可以<a id="pb-man" style="color:var(--emerald);font-weight:700;cursor:pointer">手动新建</a></div>`,
    mount:(p)=>{
      const kw=p.querySelector('#pb-kw');setTimeout(()=>kw.focus(),300);
      const go=()=>openLibResults(kw.value.trim());
      p.querySelector('#pb-go').onclick=go;
      kw.addEventListener('keypress',e=>{if(e.key==='Enter')go();});
      p.querySelector('#pb-scan').onclick=()=>toast('调用扫码');
      p.querySelectorAll('#pb-his span').forEach(s=>s.onclick=()=>{kw.value=s.dataset.h;openLibResults(s.dataset.h);});
      p.querySelector('#pb-man').onclick=()=>openForm();
    }});
}

/* ========== 商品库 · 找品结果页 ========== */
function libCard(it,i){
  return `<div class="pb-libcard" data-i="${i}">
    <div class="lh"><div class="ln">[${it.brand}] ${it.name}</div><div class="detail">查看详情${svg('arrow','style="width:14px;height:14px"')}</div></div>
    <div class="lspec">${it.spec}</div>
    <div class="lattr">${it.attr}</div>
    <div class="limgs">${it.imgs.slice(0,4).map(e=>`<div class="t">${e}</div>`).join('')}<div class="cnt">共<br>${it.imgs.length}个</div></div>
    <div class="lact"><button class="reuse" data-reuse>修改复用</button></div></div>`;
}
function openLibResults(kw){
  pbPush({title:'商品库找品',
    body:`<div class="pb-sbar"><div class="pb-sbox">
        <div class="inp">${svg('search')}<input id="pb-kw2" value="${kw||''}" placeholder="支持搜索商品名称、品牌"></div>
        <div class="scan" id="pb-scan2">${svg('box')}</div>
        <button class="go" id="pb-go2">搜索</button></div></div>
      <div style="height:6px"></div><div id="pb-libl"></div>`,
    footer:`<div style="text-align:center;font-size:13.5px;color:var(--sub)">如果没有找到想要商品，可以<a id="pb-man2" style="color:var(--emerald);font-weight:700;cursor:pointer">手动新建</a></div>`,
    mount:(p)=>{
      const list=p.querySelector('#pb-libl');
      list.innerHTML=skel(2);                                   // 加载态(H1)
      setTimeout(()=>{
        const data=kw?LIB.filter(x=>(x.name+x.brand).includes(kw)):LIB;
        if(!data.length){
          list.innerHTML=`<div class="empty"><div class="ei">${svg('box')}</div><h4>没有找到「${kw}」</h4><p>换个关键词，或在底部手动新建</p></div>`;
          return;
        }
        list.innerHTML=data.map((it,i)=>libCard(it,LIB.indexOf(it))).join('');
        list.querySelectorAll('.pb-libcard').forEach(c=>{
          const it=LIB[+c.dataset.i];
          c.querySelector('[data-reuse]').onclick=()=>openForm(it);
          c.querySelector('.detail').onclick=()=>toast('查看商品库详情');
        });
      },420);
      const kw2=p.querySelector('#pb-kw2');
      const go=()=>openLibResults(kw2.value.trim());
      p.querySelector('#pb-go2').onclick=go;
      kw2.addEventListener('keypress',e=>{if(e.key==='Enter')go();});
      p.querySelector('#pb-scan2').onclick=()=>toast('调用扫码');
      p.querySelector('#pb-man2').onclick=()=>openForm();
    }});
}

/* ========== 创建商品表单(字段+校验=PC 规则) ========== */
function openForm(prefill){
  // 解析商品库预填的保质期(如 "30天" → 30 + 天)
  let pfLife='',pfUnit='天';
  if(prefill&&prefill.shelf){const mm=/^(\d+)\s*(天|月|年)?/.exec(prefill.shelf);if(mm){pfLife=mm[1];pfUnit=mm[2]||'天';}}
  // 表单状态(PC 字段)。前台不出现货品(Item)，后台据 SPU/SKU 自动建货品
  const f={
    name: prefill?`[${prefill.brand}] ${prefill.name}`:'',
    alias:'',
    cat:  prefill?CATS.find(c=>c.n===prefill.cat)||null:null,
    tax:  prefill?String((CATS.find(c=>c.n===prefill.cat)||{}).tax??''):'', // 手填，默认取类目
    measure: prefill?prefill.measure:'',   // 最小售卖单位
    netQty:'', netUnit:'', measureNote:'',
    sellType:'售卖品',                      // 销售类型固定，不可改
    validEnable:'是',                       // 效期管理默认「是」
    shelfLife: pfLife, shelfUnit: pfUnit,   // 保质期 + 单位
    appShowShelf:'展示',                    // APP 是否展示效期(展示/不展示)，放保质期后
    storage:'', fulfill:'', origin:'', brand: prefill?prefill.brand:'', desc:'',
    specs: prefill?[{qty:'1',price:'',stock:''}]:[{qty:'',price:'',stock:''}], // 售卖单位只读=最小售卖单位
    imgs:{head:false,more:[false,false],video:false,label:false,detail:[false,false,false,false]},
  };
  const row=(id,lab,valHtml,req)=>`<div class="pb-cell" id="${id}"><div class="lab">${req?'<span class="rq">*</span>':''}${lab}</div><div class="val">${valHtml}</div><span class="ch">${svg('arrow')}</span></div>`;
  const picker=(id,vid,val,req,lab)=>`<div class="pb-cell" id="${id}"><div class="lab">${req?'<span class="rq">*</span>':''}${lab}</div><div class="val"><span class="vtxt" id="${vid}">${val||'<span class=ph>请选择</span>'}</span></div><span class="ch">${svg('arrow')}</span></div>`;

  pbPush({title:'创建商品',onBack:()=>confirmExit(f),
    body:`<div class="pb-note">请认真核对信息，提交后将由专人审核</div>
      <div class="pb-errs" id="pb-errs"></div>
      <div class="pb-card">
        <div class="ct">基本信息</div>
        <div class="pb-cell" id="pb-name-row"><div class="lab"><span class="rq">*</span>商品名称</div><div class="val"><input id="pb-name" data-tr placeholder="请输入商品名称" maxlength="60" value="${f.name.replace(/"/g,'&quot;')}"></div></div>
        <div class="pb-cell" id="pb-alias-row"><div class="lab">别名</div><div class="val"><input id="pb-alias" data-tr data-tr-multi placeholder="选填" maxlength="60" value="${f.alias.replace(/"/g,'&quot;')}"></div></div>
        ${picker('pb-cat-row','pb-cat-v',f.cat?f.cat.n:'',1,'后台类目')}
        <div class="pb-cell" id="pb-tax-row"><div class="lab"><span class="rq">*</span>税率</div><div class="val"><input id="pb-tax" inputmode="decimal" placeholder="选择类目后自动带出，可改" value="${f.tax}"><span class="pre">%</span></div></div>
        ${picker('pb-measure-row','pb-measure-v',f.measure,1,'最小售卖单位')}
        <div class="pb-cell" id="pb-net-row"><div class="lab">净含量</div><div class="val"><input id="pb-netqty" inputmode="decimal" placeholder="选填" value="${f.netQty}"><span class="vtxt" id="pb-netunit" style="flex:0 0 auto;max-width:70px">${f.netUnit||'<span class=ph>单位</span>'}</span><span class="ch" style="flex:0 0 auto">${svg('arrow')}</span></div></div>
        <div class="pb-cell" id="pb-mnote-row"><div class="lab">备注</div><div class="val"><input id="pb-mnote" placeholder="最小售卖单位备注，选填" maxlength="40" value="${f.measureNote}"></div></div>
        <div class="pb-cell" id="pb-selltype-row"><div class="lab">销售类型</div><div class="val"><span class="vtxt" style="color:var(--sub)">售卖品</span></div></div>
      </div>
      <div class="pb-card">
        <div class="ct">效期与履约</div>
        ${picker('pb-valid-row','pb-valid-v',f.validEnable,0,'效期管理')}
        <div class="pb-cell" id="pb-shelf-row"><div class="lab">保质期</div><div class="val"><input id="pb-shelflife" inputmode="numeric" placeholder="选填" value="${f.shelfLife}"><span class="vtxt" id="pb-shelfunit" style="flex:0 0 auto;max-width:60px">${f.shelfUnit||'<span class=ph>单位</span>'}</span><span class="ch" style="flex:0 0 auto">${svg('arrow')}</span></div></div>
        ${picker('pb-appshow-row','pb-appshow-v',f.appShowShelf,0,'APP是否展示效期')}
        ${picker('pb-storage-row','pb-storage-v',f.storage,0,'储存条件')}
        ${picker('pb-fulfill-row','pb-fulfill-v',f.fulfill,0,'履约方式')}
      </div>
      <div class="pb-card">
        <div class="ct">产地品牌</div>
        <div class="pb-cell" id="pb-origin-row"><div class="lab">产地</div><div class="val"><input id="pb-origin" data-tr placeholder="选填" maxlength="40" value="${f.origin}"></div></div>
        <div class="pb-cell" id="pb-brand-row"><div class="lab">品牌</div><div class="val"><input id="pb-brand" data-tr placeholder="选填" maxlength="40" value="${f.brand.replace(/"/g,'&quot;')}"></div></div>
        <div class="pb-cell" id="pb-desc-row"><div class="lab">描述</div><div class="val"><input id="pb-desc" data-tr placeholder="选填" maxlength="200" value="${f.desc}"></div></div>
      </div>
      <div class="pb-card">
        <div class="ct"><span><span class="rq" style="color:var(--red)">*</span>售卖规格</span><span style="font-weight:400;color:var(--sub);font-size:11.5px">数量为正整数 ≥1 且互不重复 · 单位=最小售卖单位</span></div>
        <div id="pb-specs"></div>
        <div class="pb-addspec" id="pb-addspec">＋ 添加售卖规格</div>
        <div style="height:14px"></div>
      </div>
      <div class="pb-card" style="padding-bottom:14px">
        <div class="ct">商品图片</div>
        <div class="pb-imgsec">
          <div class="it"><span class="rq">*</span>主图<span class="tip">头图必填 · 视频不短于30秒</span></div>
          <div class="pb-tiles" id="pb-main"></div>
          <div class="it"><span class="rq">*</span>标签图</div>
          <div class="pb-tiles" id="pb-label"></div>
          <div class="it">详情图</div>
          <div class="pb-tiles" id="pb-detail"></div>
        </div>
      </div>
      <div style="height:8px"></div>`,
    footer:`<button class="btn primary" id="pb-sub">提交</button>`,
    mount:(p)=>bindForm(p,f),
  });
}

function confirmExit(f){
  const dirty=f.name||f.alias||f.cat||f.tax||f.measure||f.netQty||f.origin||f.brand||f.desc||f.specs.some(s=>s.qty||s.price||s.stock);
  const done=()=>{popPage();pbPages.pop();};
  if(!dirty)return done();
  confirmDialog({title:'是否退出建品？',body:'已填写的信息将不会保存。',danger:1,okText:'退出',onOk:done});
}

/* ---- 售卖规格渲染(售卖单位只读 = 最小售卖单位) ---- */
function specRow(s,i,total,measure){
  const uTxt=measure||'—';
  return `<div class="pb-spec" data-i="${i}">
    <div class="sh"><span class="sn">规格${i+1}</span>${total>1?'<span class="del" data-del>删除</span>':''}</div>
    <div class="sbody">
      <div class="qty"><span class="lb">数量</span><input data-qty inputmode="numeric" value="${s.qty}" placeholder="如 2"></div>
      <div class="unit" style="cursor:default;background:var(--muted);opacity:.9"><span class="lb">售卖单位</span><span class="uv ${measure?'':'ph'}">${uTxt}</span></div>
    </div>
    <div class="sbody" style="margin-top:10px">
      <div class="qty"><span class="lb">价格</span><span class="lb" style="flex:0 0 auto;padding-left:2px">S$</span><input data-price inputmode="decimal" value="${s.price}" placeholder="选填"></div>
      <div class="qty"><span class="lb">库存</span><input data-stock inputmode="numeric" value="${s.stock}" placeholder="选填"></div>
    </div>
    <div class="serr" data-serr></div>
    <div class="serr" data-pnote style="color:#46604F"></div></div>`;
}
function renderSpecs(p,f){
  const box=p.querySelector('#pb-specs');
  box.innerHTML=f.specs.map((s,i)=>specRow(s,i,f.specs.length,f.measure)).join('');
  box.querySelectorAll('.pb-spec').forEach((row,i)=>{
    row.querySelector('[data-qty]').oninput=e=>{f.specs[i].qty=e.target.value;paint(p,f);};
    row.querySelector('[data-price]').oninput=e=>{f.specs[i].price=e.target.value;paint(p,f);};
    row.querySelector('[data-stock]').oninput=e=>{f.specs[i].stock=e.target.value;paint(p,f);};
    const del=row.querySelector('[data-del]');
    if(del)del.onclick=()=>{f.specs.splice(i,1);renderSpecs(p,f);paint(p,f);};
  });
}

/* ---- 图片瓦片 ---- */
function tile(label,req,filled){
  return `<div class="pb-tile${filled?' filled':''}" data-tile>
    ${req?'<span class="rq">必填</span>':''}
    <span class="pl">${filled?'🖼':'＋'}</span><span class="tl">${label}</span>
    ${filled?'<span class="rm" data-rm>✕</span>':''}</div>`;
}
function renderImgs(p,f){
  const main=p.querySelector('#pb-main');
  main.innerHTML=tile('头图',1,f.imgs.head)+f.imgs.more.map((v,i)=>tile('其他主图'+(i+1),0,v)).join('')+tile('视频',0,f.imgs.video);
  p.querySelector('#pb-label').innerHTML=tile('标签图',1,f.imgs.label);
  p.querySelector('#pb-detail').innerHTML=f.imgs.detail.map((v,i)=>tile('详情图'+(i+1),0,v)).join('');
  const toggle=(getter,setter)=>(e)=>{
    if(e.target.dataset.rm!==undefined){setter(false);renderImgs(p,f);return;}
    setter(!getter());renderImgs(p,f);
  };
  main.children[0].onclick=toggle(()=>f.imgs.head,v=>f.imgs.head=v);
  f.imgs.more.forEach((_,i)=>main.children[1+i].onclick=toggle(()=>f.imgs.more[i],v=>f.imgs.more[i]=v));
  main.children[3].onclick=toggle(()=>f.imgs.video,v=>f.imgs.video=v);
  p.querySelector('#pb-label').children[0].onclick=toggle(()=>f.imgs.label,v=>f.imgs.label=v);
  f.imgs.detail.forEach((_,i)=>p.querySelector('#pb-detail').children[i].onclick=toggle(()=>f.imgs.detail[i],v=>f.imgs.detail[i]=v));
}

/* ---- 即时校验标红(H6)；submitted=true 时连必填空值一并标红 ---- */
function paint(p,f,submitted){
  // 商品名称(同名 BR-09 即时红；空值仅提交时红)
  const nameDup=!!(f.name.trim()&&EXISTING.includes(f.name.trim()));
  p.querySelector('#pb-name-row').classList.toggle('err',nameDup||(submitted&&!f.name.trim()));
  // 后台类目(空值提交时红；资质未覆盖 BR-08 即时红)
  p.querySelector('#pb-cat-row').classList.toggle('err',(submitted&&!f.cat)||(!!f.cat&&!LICENSE.has(f.cat.n)));
  p.querySelector('#pb-tax-row').classList.toggle('err',submitted&&!String(f.tax).trim());
  p.querySelector('#pb-measure-row').classList.toggle('err',submitted&&!f.measure);
  // 售卖规格：正整数≥1 + 不可重复
  const qtys=f.specs.map(s=>String(s.qty).trim());
  p.querySelectorAll('.pb-spec').forEach((row,i)=>{
    const q=qtys[i];const serr=row.querySelector('[data-serr]');let msg='';
    if(q&&!/^[1-9]\d*$/.test(q))msg='数量必须为正整数 ≥1';
    else if(submitted&&!q)msg='数量必须为正整数 ≥1';
    else if(q&&/^[1-9]\d*$/.test(q)&&qtys.filter(x=>x===q).length>1)msg='数量与其他规格重复';
    serr.textContent=msg;row.classList.toggle('err',!!msg);
    const pn=row.querySelector('[data-pnote]');
    if(pn){const pv=parseFloat(f.specs[i].price);
      if(!String(f.specs[i].price).trim()||isNaN(pv)||!f.cat){pn.textContent='';}
      else if(pv<f.cat.guide*0.5||pv>f.cat.guide*2){pn.textContent=`价格异常 · 偏离指导价 S$${f.cat.guide.toFixed(2)}（合理区间 S$${(f.cat.guide*0.5).toFixed(2)}~S$${(f.cat.guide*2).toFixed(2)}）`;pn.style.color='var(--red)';}
      else{pn.textContent=`参考指导价 S$${f.cat.guide.toFixed(2)} · 正常`;pn.style.color='#46604F';}}
  });
}

/* ---- 提交校验(9 条，逐条对应 PC 规则) ---- */
function runChecks(f){
  const fails=[];
  if(!f.name.trim())            fails.push(['必填','缺少「商品名称」']);
  if(!f.cat)                    fails.push(['必填','缺少「后台类目」']);
  if(!String(f.tax).trim())     fails.push(['必填','缺少「税率」']);
  if(!f.measure)               fails.push(['必填','缺少「最小售卖单位」']);
  if(!f.specs.length)          fails.push(['规格','至少添加 1 个售卖规格']);
  f.specs.forEach((s,i)=>{const q=String(s.qty).trim();if(!/^[1-9]\d*$/.test(q))fails.push(['规格',`规格${i+1} 数量必须为正整数 ≥1`]);});
  const qtys=f.specs.map(s=>String(s.qty).trim()).filter(q=>/^[1-9]\d*$/.test(q));
  if(new Set(qtys).size!==qtys.length) fails.push(['规格','各规格「数量」不可重复']);
  if(f.cat&&!LICENSE.has(f.cat.n)) fails.push(['资质',`经营许可证未覆盖「${f.cat.n}」类目`]);
  if(f.name.trim()&&EXISTING.includes(f.name.trim())) fails.push(['查重','已存在同名商品']);
  return fails;
}
function renderErrors(p,fails){
  const box=p.querySelector('#pb-errs');
  if(!fails.length){box.style.display='none';box.innerHTML='';return;}
  box.style.display='block';
  box.innerHTML=`<div class="eh">${svg('alert')} 还有 ${fails.length} 项待完善</div>`+
    fails.map(x=>`<div class="li"><span class="cat">${x[0]}</span>${x[1]}</div>`).join('');
  box.scrollIntoView({behavior:'smooth',block:'start'});
}

/* ---- 表单绑定 ---- */
function bindForm(p,f){
  const setPH=(el,txt,filled)=>{el.innerHTML=filled?txt:`<span class="ph">${txt}</span>`;};
  renderSpecs(p,f);renderImgs(p,f);paint(p,f);

  // 文本输入
  p.querySelector('#pb-name').oninput=e=>{f.name=e.target.value;paint(p,f);};
  p.querySelector('#pb-alias').oninput=e=>{f.alias=e.target.value;};
  p.querySelector('#pb-tax').oninput=e=>{f.tax=e.target.value;paint(p,f);};
  p.querySelector('#pb-netqty').oninput=e=>{f.netQty=e.target.value;};
  p.querySelector('#pb-mnote').oninput=e=>{f.measureNote=e.target.value;};
  p.querySelector('#pb-shelflife').oninput=e=>{f.shelfLife=e.target.value;};
  p.querySelector('#pb-origin').oninput=e=>{f.origin=e.target.value;};
  p.querySelector('#pb-brand').oninput=e=>{f.brand=e.target.value;};
  p.querySelector('#pb-desc').oninput=e=>{f.desc=e.target.value;};
  // 后台类目(选中后自动带出默认税率，手填可改)
  p.querySelector('#pb-cat-row').onclick=()=>pbCatPicker(f.cat,c=>{f.cat=c;setPH(p.querySelector('#pb-cat-v'),c.n,1);if(!String(f.tax).trim()){f.tax=String(c.tax);p.querySelector('#pb-tax').value=c.tax;}paint(p,f);});
  // 最小售卖单位(变更后 SKU 售卖单位联动只读)
  p.querySelector('#pb-measure-row').onclick=()=>pbGridPicker('选择最小售卖单位',MEASURE_UNITS,f.measure,v=>{f.measure=v;setPH(p.querySelector('#pb-measure-v'),v,1);renderSpecs(p,f);paint(p,f);});
  // 净含量单位
  p.querySelector('#pb-net-row').onclick=e=>{if(e.target.closest('input'))return;pbGridPicker('净含量单位',NET_UNITS,f.netUnit,v=>{f.netUnit=v;setPH(p.querySelector('#pb-netunit'),v,1);});};
  // 效期管理 / 保质期单位 / APP是否展示效期 / 储存条件 / 履约方式
  p.querySelector('#pb-valid-row').onclick=()=>pbGridPicker('效期管理',['是','否'],f.validEnable,v=>{f.validEnable=v;setPH(p.querySelector('#pb-valid-v'),v,1);});
  p.querySelector('#pb-shelf-row').onclick=e=>{if(e.target.closest('input'))return;pbGridPicker('保质期单位',SHELF_UNITS,f.shelfUnit,v=>{f.shelfUnit=v;setPH(p.querySelector('#pb-shelfunit'),v,1);});};
  p.querySelector('#pb-appshow-row').onclick=()=>pbGridPicker('APP是否展示效期',['展示','不展示'],f.appShowShelf,v=>{f.appShowShelf=v;setPH(p.querySelector('#pb-appshow-v'),v,1);});
  p.querySelector('#pb-storage-row').onclick=()=>pbGridPicker('储存条件',STORAGES,f.storage,v=>{f.storage=v;setPH(p.querySelector('#pb-storage-v'),v,1);});
  p.querySelector('#pb-fulfill-row').onclick=()=>pbGridPicker('履约方式',FULFILLS,f.fulfill,v=>{f.fulfill=v;setPH(p.querySelector('#pb-fulfill-v'),v,1);});
  // 输入框单元格点击空白不抢焦点
  ['pb-name-row','pb-alias-row','pb-tax-row','pb-mnote-row','pb-origin-row','pb-brand-row','pb-desc-row','pb-selltype-row'].forEach(id=>p.querySelector('#'+id).onclick=null);

  p.querySelector('#pb-addspec').onclick=()=>{f.specs.push({qty:'',price:'',stock:''});renderSpecs(p,f);paint(p,f);};

  // 实时翻译：商品名/别名/产地/品牌/描述 露出买家可见英文译文行(中↔英)，可手改、手改后锁定
  PBTR.init(p);

  // 提交(跑 autoCheck)
  p.querySelector('#pb-sub').onclick=()=>{
    const fails=runChecks(f);
    paint(p,f,true);renderErrors(p,fails);
    if(fails.length){toast(`还有 ${fails.length} 项待完善`);return;}
    const b=p.querySelector('#pb-sub');b.classList.add('loading');
    setTimeout(()=>{b.classList.remove('loading');toast('已提交审核');setTimeout(pbCloseAll,600);},800);
  };
}

/* ========== 注册入口(供商品列表「发布商品」按钮调用) ========== */
window.FM_PUBLISH=entry;
})();
