/* Food Max 商家端 v2 · 发布商品(创建商品)模块
   关键约束(沈亮定)：交互流程形态照快驴 App 录屏走，但字段与校验规则一律用 PC 那套，不照搬 App 的字段。
   App 流程形态：选择建品方式 → (商品库)搜索→找品结果→修改复用 / (手动)→ 创建商品表单。
   PC 规则落点：必填(autoCheck)=商品名称/后台类目/税率/最小售卖单位/售卖规格(≥1)；
   后台类目取 PC 的 CATS(默认税率+指导价，税率手填可改)；售卖规格按 PC=数量(正整数≥1、不可重复)，售卖规格单位只读=最小售卖单位；
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
// bcrs:true 的类目，建品时才出现「是否支持 BCRS」(与 PC CATS['饮料'].bcrs 同源)
const CATS=[
  {n:'新鲜蔬菜',tax:0, guide:6},
  {n:'肉禽蛋品',tax:9, guide:14},
  {n:'海鲜水产',tax:9, guide:25},
  {n:'调味品',  tax:9, guide:18},
  {n:'饮料',    tax:9, guide:5, bcrs:true},
];
// 经营许可证覆盖的类目(资质校验，BR-08)：调味品未覆盖(与 PC CAT_SCOPE 一致)
const LICENSE=new Set(['新鲜蔬菜','肉禽蛋品','海鲜水产','饮料']);
// BCRS 单容器法规押金 S$0.10（平台级参数，不逐SKU存、不计 GST；与 PC 同源）。商家只填「每最小售卖单位容器数」，押金=容器数×0.10×数量
const BCRS_UNIT_PRICE=0.10;
const BCRS_CONTAINERS_MAX=999;   // 容器数正整数上限（防呆，非法规限额）
// 最小售卖单位(PC 基础计量单位；SKU 售卖规格单位只读 = 最小售卖单位)
const MEASURE_UNITS=['斤','公斤(kg)','克(g)','毫升(ml)','升(L)','个','只','件','包','袋','盒','箱','瓶','桶','罐'];
/* ===== 建品单位规范（真值来源：飞书 wiki OVWmwf16MiA6tPkszPdcdlQUnBZ）与 PC 完全一致 =====
   每项 = [code, 中文, English]。标品与非标品的「售卖规格单位」取值不同，这正是两者的分界：
     标品   售卖规格单位 = 计件单位 → 数量×单位算不出净含量，须另填单件净含量
     非标品 售卖规格单位 = 计量单位 → 数量+单位本身即净含量
   「净含量单位」「售卖单位」两组两类通用。 */
const STD_TYPES=['标品','非标品'];
/* ===== 最小包装单位（2026-08-27，与 PC 同枚举同口径）=====
   声明上方「单件净含量」是哪一层的量：
     单品 = 1 个单品的量（可乐 1 瓶 330 ml）
     单包 = 1 整包/袋的量（海带丝 1 袋 200 g，袋内可再分小份）
   标品必填；只声明口径，不参与金额/库存计算。
   一个规格里装几个最小包装，由规格级「内含最小包装数」表达（选填，留空＝售卖规格数量）。 */
const NET_PACK_TYPES=['单品','单包'];
const UNIT_SPEC={
  '标品':{
    spec:[[40,'个','piece'],[25,'打','dozen'],[1,'瓶','bottle'],[4,'罐','can'],[7,'盒','box'],[6,'袋','packet'],[20,'箱','carton'],[41,'卷','roll'],[38,'托','tray']],
    net :[[1,'g','g'],[2,'kg','kg'],[3,'ml','ml'],[4,'L','L']],
    sell:[[19,'包','bag'],[33,'份','portion'],[42,'组','set'],[20,'箱','carton']],
  },
  '非标品':{
    spec:[[1,'g','g'],[2,'kg','kg']],
    net :[[1,'g','g'],[2,'kg','kg'],[3,'ml','ml'],[4,'L','L']],
    sell:[[19,'包','bag'],[33,'份','portion'],[42,'组','set'],[20,'箱','carton']],
  },
};
const unitList =(t,g)=>(UNIT_SPEC[t]||UNIT_SPEC['非标品'])[g];
const unitNames=(t,g)=>unitList(t,g).map(x=>x[1]);
const MEASURE_UNITS_SET=['g','kg','ml','L'];   // 计量单位判定集
const NET_UNITS=['g','kg','ml','L'];           // 兼容旧引用
const PACK_UNITS=['包','份','组','箱'];         // 兼容旧引用
/* g/ml 满 1000 进位到 kg/L，避免出现「7920ml」——与 PC netCarry 同口径 */
function netCarry(v,u){
  if(u==='g'&&v>=1000)return{v:v/1000,u:'kg'};
  if(u==='ml'&&v>=1000)return{v:v/1000,u:'L'};
  return{v,u};
}
const fmtQ=n=>{const x=parseFloat(n);return isNaN(x)?'':String(Math.round(x*10000)/10000);};
/* 建档表单里那一列「净含量」的取值（与 PC 建档抽屉同口径）：
   标品   —— **回显上方填写的单件净含量原值**，不乘售卖规格数量。
              标品的净含量是包装上申报的固定值，商家填什么这里就显示什么。
              （本规格合计 = 单件净含量 × 售卖规格数量，那是列表/详情/对账的口径，
                不在建档表单这一列展示，见 PRD BR-03 与 §6）
   非标品 —— 售卖规格数量 + 售卖规格单位 */
function specNetTxt(f,s){
  if(f.stdType==='标品'){
    const base=parseFloat(f.netQty);
    if(!(base>0)||!f.netUnit)return '';
    return fmtQ(base)+f.netUnit+(f.netPackType?'/'+f.netPackType:'');   // 「330ml/单品」
  }
  const q=parseFloat(s.qty);if(!(q>0))return '';
  const su=f.supplyMode==='寄售'?f.stockUnit:s.specUnit;
  if(!su)return '';
  const n=netCarry(q,su);
  return fmtQ(n.v)+n.u;
}
// 效期单位
const SHELF_UNITS=['天','月','年'];
// 储存条件
const STORAGES=['常温','阴凉干燥','冷藏(0~4℃)','冷冻(-18℃)'];
// 履约方式
const FULFILLS=['次日达','当日达','商家自配','到店自提'];
// 已存在(非草稿)商品名库，用于 BR-09 同名校验(取自 goods.js 销售中/未上架)
const EXISTING=['鲜丰 · 嫩豆腐 1kg','鲜丰 · 老豆腐','鲜丰 · 小油豆腐','冻 · 盐渍海带丝','萝卜丸子','鲜丰 · NFC 椰子水 330ml'];

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
#pb-netpack-row .lab{flex:0 0 116px;white-space:nowrap;}   /* 「最小包装单位」6字，92px 标签列会折行 */
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
/* 标签在上、值在下：术语更名后「售卖规格数量」等 6 字标签横排会把 flex:1 的输入框挤成 0 宽（.lb 不收缩），
   改堆叠后既放得下完整术语，也不受后续文案/多语言长度影响 */
.pb-spec .qty,.pb-spec .unit{flex:1;min-width:0;background:var(--muted);border-radius:11px;min-height:52px;display:flex;flex-direction:column;align-items:stretch;justify-content:center;padding:6px 12px;gap:1px;border:1.5px solid transparent;}
.pb-spec .uwrap{display:flex;align-items:center;justify-content:space-between;gap:6px;width:100%;min-width:0;}
.pb-spec .qty:focus-within{border-color:var(--emerald);background:#fff;}
.pb-spec .lb{font-size:11.5px;color:var(--sub);flex:0 0 auto;line-height:1.3;}
.pb-spec .qty input{flex:1;border:none;background:transparent;outline:none;font-size:15px;font-family:inherit;width:100%;}
.pb-spec .ms-row{display:flex;align-items:center;gap:10px;margin-top:10px;}
.pb-spec .ms-row .lb{font-size:13px;color:var(--sub);flex:0 0 auto;}
.pb-spec .modeseg{display:flex;flex:1;background:var(--muted);border-radius:11px;padding:3px;gap:3px;}
.pb-spec .modeseg .mo{flex:1;min-height:38px;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:600;color:var(--sub);border-radius:9px;cursor:pointer;text-align:center;line-height:1.15;padding:0 4px;}
.pb-spec .modeseg .mo.on{background:#fff;color:var(--emerald-2);box-shadow:var(--sh-sm);}
.pb-spec .ms-hint{font-size:11.5px;color:var(--sub);margin-top:6px;line-height:1.5;}
.pb-spec .unit{cursor:pointer;}
.pb-spec .unit .uv{font-size:15px;font-weight:600;}.pb-spec .unit .uv.ph{color:#94A3B8;font-weight:400;}
.pb-spec .unit .ch{color:#94A3B8;}
.pb-spec .serr{color:var(--red);font-size:11.5px;margin-top:7px;min-height:0;}
/* BCRS 说明条(仅支持 BCRS 的类目出现) */
.pb-bcrs-tip{font-size:11.5px;color:var(--sub);line-height:1.6;padding:2px 16px 14px;background:#fff;}
.pb-bcrs-tip b{color:#27433A;}
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
    stdType:'非标品',                       // 商品类型：决定净含量算法与售卖规格单位枚举（生鲜平台默认非标品）
    stockUnit:'',                          // 寄售专用·商品级库存单位：取值同售卖规格单位枚举；寄售时各规格售卖规格单位恒等于它
    measure: prefill?prefill.measure:'',   // 【兼容】旧「最小售卖单位」，已被 stdType + 规格级 specUnit 取代
    netQty:'', netUnit:'', netPackType:'', measureNote:'',  // netQty/netUnit = 标品的「单件净含量」，非标品不填；netPackType=最小包装单位(单品/单包)
    bcrs:'否', bcrsUnitContainers:'',       // BCRS：仅 cat.bcrs 类目可选；每最小售卖单位容器数(整数)，押金单价平台固定 0.10
    sellType:'售卖品',                      // 销售类型固定，不可改
    supplyMode:'自售',                      // 售卖模式(dev supplyMode 1=自售/2=寄售)：默认自售，保存后不可修改；寄售→SKU库存只读
    validEnable:'是',                       // 效期管理默认「是」
    shelfLife: pfLife, shelfUnit: pfUnit,   // 保质期 + 单位
    appShowShelf:'展示',                    // APP 是否展示效期(展示/不展示)，放保质期后
    storage:'', fulfill:'', origin:'', brand: prefill?prefill.brand:'', desc:'',
    specs: prefill?[{qty:'1',price:'',stock:'',mode:'finite',packUnit:'',specUnit:'',containedPackCount:''}]:[{qty:'',price:'',stock:'',mode:'finite',packUnit:'',specUnit:'',containedPackCount:''}], // specUnit=售卖规格单位(规格级,枚举随 stdType)；mode=库存模式(finite售完即止/daily每日恢复初始库存)；packUnit=售卖单位(选填)
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
        ${picker('pb-std-row','pb-std-v',f.stdType,1,'商品类型')}
        <div class="pb-hint" id="pb-std-hint" style="padding:2px 14px 8px;font-size:11.5px;color:var(--sub);line-height:1.6"></div>
        <div class="pb-cell" id="pb-net-row"><div class="lab"><span class="rq">*</span>单件净含量</div><div class="val"><input id="pb-netqty" inputmode="decimal" placeholder="如 330" value="${f.netQty}"><span class="vtxt" id="pb-netunit" style="flex:0 0 auto;max-width:70px">${f.netUnit||'<span class=ph>单位</span>'}</span><span class="ch" style="flex:0 0 auto">${svg('arrow')}</span></div></div>
        ${picker('pb-netpack-row','pb-netpack-v',f.netPackType,1,'最小包装单位')}
        <div class="pb-hint" id="pb-net-hint" style="padding:2px 14px 8px;font-size:11.5px;color:var(--sub);line-height:1.6"></div>
        ${picker('pb-stockunit-row','pb-stockunit-v',f.stockUnit,1,'库存单位')}
        <div class="pb-cell" id="pb-mnote-row"><div class="lab">备注</div><div class="val"><input id="pb-mnote" placeholder="单位补充说明，选填" maxlength="40" value="${f.measureNote}"></div></div>
        <div class="pb-cell" id="pb-bcrs-row" style="display:none"><div class="lab">支持 BCRS</div><div class="val"><span class="vtxt" id="pb-bcrs-v">${f.bcrs}</span></div><span class="ch">${svg('arrow')}</span></div>
        <div class="pb-cell" id="pb-bcrsdep-row" style="display:none"><div class="lab"><span class="rq">*</span>每最小售卖单位容器数</div><div class="val"><input id="pb-bcrscnt" inputmode="numeric" placeholder="如 1（一瓶=1容器）" value="${f.bcrsUnitContainers}"><span class="pre" id="pb-bcrs-unitprice">个 · 押金单价 S$${BCRS_UNIT_PRICE.toFixed(2)}/容器</span></div></div>
        <div class="pb-bcrs-tip" id="pb-bcrs-tip" style="display:none">押金单价由平台固定为 <b>S$${BCRS_UNIT_PRICE.toFixed(2)}/容器</b>（法规押金·不计 GST，商家不可改）。此处填<b>一个最小售卖单位含几个容器</b>（一瓶/一罐=1）。<b>每个 SKU 押金 = 售卖规格数量 × 每最小售卖单位容器数 × S$${BCRS_UNIT_PRICE.toFixed(2)}</b>，随货透传客户下单/订单/发票。适用容量 150ml–3L。</div>
        <div class="pb-cell" id="pb-selltype-row"><div class="lab">销售类型</div><div class="val"><span class="vtxt" style="color:var(--sub)">售卖品</span></div></div>
        <div class="pb-cell" id="pb-supply-row" style="cursor:pointer"><div class="lab">售卖模式</div><div class="val"><span class="vtxt" id="pb-supply-v">${f.supplyMode}</span></div><span class="ch">${svg('arrow')}</span></div>
        <div class="pb-bcrs-tip" style="display:block;padding-top:2px">自售=经销买断，库存自行维护；<b>寄售</b>=库存由货品库存决定、逐规格不可维护。售卖模式<b>保存后不可修改</b>。</div>
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
        <div class="ct"><span><span class="rq" style="color:var(--red)">*</span>售卖规格</span><span style="font-weight:400;color:var(--sub);font-size:11.5px">售卖规格数量为正整数 ≥1 且互不重复 · 净含量由系统算出</span></div>
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
  const dirty=f.name||f.alias||f.cat||f.tax||f.stdType!=="非标品"||f.netQty||f.netPackType||f.specs.some(s=>s.specUnit)||f.origin||f.brand||f.desc||f.specs.some(s=>s.qty||s.price||s.stock);
  const done=()=>{popPage();pbPages.pop();};
  if(!dirty)return done();
  confirmDialog({title:'是否退出建品？',body:'已填写的信息将不会保存。',danger:1,okText:'退出',onOk:done});
}

/* ---- 售卖规格渲染(售卖规格单位只读 = 最小售卖单位) ---- */
function specRow(s,i,total,f,consign){
  /* 售卖规格单位的可编辑性：
     · 寄售        → 恒等于商品级「库存单位」，只读
     · 其余        → 可选，枚举随 stdType
     注：标品各规格单位不再要求一致——该约束原本只为「单件净含量 × 数量」的乘法服务，
        净含量既已改为直接取申报值、不乘数量，约束即无存在理由，已拆除。 */
  const lockByConsign=consign;
  const eff=lockByConsign?(f.stockUnit||''):(s.specUnit||'');
  const locked=lockByConsign;
  const lockTip='寄售 · 同库存单位';
  const uTxt=eff||(locked?'—':'请选择');
  const wgUnit=['kg','g'].includes(eff);   // 多退少补仅售卖规格单位为 kg/g 时可选
  const netTxt=specNetTxt(f,{...s,specUnit:eff});
  return `<div class="pb-spec" data-i="${i}">
    <div class="sh"><span class="sn">规格${i+1}</span>${total>1?'<span class="del" data-del>删除</span>':''}</div>
    <div class="sbody">
      <div class="qty"><span class="lb">售卖规格数量</span><input data-qty inputmode="numeric" value="${s.qty}" placeholder="如 2"></div>
      ${locked
        ? `<div class="unit" style="cursor:default;background:var(--muted);opacity:.9" title="${lockTip}"><span class="lb">售卖规格单位</span><span class="uwrap"><span class="uv ${eff?'':'ph'}">${uTxt}</span></span></div>`
        : `<div class="unit" data-unitpick style="cursor:pointer"><span class="lb">售卖规格单位</span><span class="uwrap"><span class="uv ${s.specUnit?'':'ph'}" data-unitv>${uTxt}</span><span style="flex:0 0 auto;color:var(--sub)">▾</span></span></div>`}
    </div>
    <div class="sbody" style="margin-top:10px">
      <div class="unit" style="cursor:default;background:var(--muted);opacity:.9"><span class="lb">净含量</span><span class="uwrap"><span class="uv ${netTxt?'':'ph'}" data-netv>${netTxt||'—'}</span></span></div>
      ${f.stdType==='标品'?`<div class="qty"><span class="lb">内含最小包装数</span><input data-packcount inputmode="numeric" value="${s.containedPackCount||''}" placeholder="${s.qty?'默认 '+s.qty:'默认同数量'}"></div>`:''}
    </div>
    ${f.stdType==='标品'?'<div class="ms-hint">内含最小包装数选填：留空即按「1 份 = 1 个最小包装」取售卖规格数量（24瓶/箱 → 24）；只有 2打/箱 这类 1 份含多件的才需填实际数。</div>':''}
    ${locked?`<div class="ms-hint">🔒 ${lockTip}，本规格售卖规格单位不可单独修改。</div>`:''}
    ${wgUnit?`<div class="ms-row"><span class="lb">多退少补</span>
      <div class="modeseg" data-refundseg>
        <div class="mo ${s.refund?'on':''}" data-r="1">是 · 按重量结差额</div>
        <div class="mo ${s.refund?'':'on'}" data-r="0">否 · 定重按件</div>
      </div></div>
    <div class="ms-hint">是=按重量定价（S$/${eff}），分装后按实发净重结算差额，需先称重再打标；否=定重预包装按件计价。</div>`:''}
    <div class="sbody" style="margin-top:10px">
      <div class="unit packcell" data-packpick style="cursor:pointer"><span class="lb">售卖单位</span><span class="uwrap"><span class="uv ${s.packUnit?'':'ph'}" data-packv>${s.packUnit||'选填 · 如 包/份/组/箱'}</span><span style="flex:0 0 auto;color:var(--sub)">▾</span></span></div>
    </div>
    <div class="sbody" style="margin-top:10px">
      <div class="qty"><span class="lb">价格</span><span class="lb" style="flex:0 0 auto;padding-left:2px">S$</span><input data-price inputmode="decimal" value="${s.price}" placeholder="选填"></div>
      <div class="qty"${consign?' style="opacity:.55"':''}><span class="lb">库存</span><input data-stock inputmode="numeric" value="${consign?'':s.stock}" placeholder="${consign?'由货品库存决定':'选填'}"${consign?' disabled':''}></div>
    </div>
    ${consign?`<div class="ms-hint" style="color:#B45309">🔒 寄售品库存与库存模式由<b>货品库存</b>决定，不逐规格维护（1 规格 = ${s.qty||'N'} 个货品单位）。</div>`
      :`<div class="ms-row"><span class="lb">库存模式</span>
      <div class="modeseg" data-modeseg>
        <div class="mo ${(s.mode||'finite')==='daily'?'on':''}" data-m="daily">每日恢复初始库存</div>
        <div class="mo ${(s.mode||'finite')==='finite'?'on':''}" data-m="finite">售完即止</div>
      </div></div>
    <div class="ms-hint" data-mshint>${(s.mode||'finite')==='daily'?'每天 0 点自动把可售库存补回设定的库存总数，适合每日稳定供应':'售完不再恢复、售罄即下线，适合尾货/限量'}</div>`}
    <div class="serr" data-serr></div>
    <div class="serr" data-pnote style="color:#46604F"></div>
    <div class="serr" data-bnote style="color:var(--emerald-2)"></div></div>`;
}
function renderSpecs(p,f){
  const box=p.querySelector('#pb-specs');
  const consign=f.supplyMode==='寄售';
  box.innerHTML=f.specs.map((s,i)=>specRow(s,i,f.specs.length,f,consign)).join('');
  box.querySelectorAll('.pb-spec').forEach((row,i)=>{
    row.querySelector('[data-qty]').oninput=e=>{f.specs[i].qty=e.target.value;refreshNet(p,f);paint(p,f);};
    const pc=row.querySelector('[data-packcount]');
    if(pc)pc.oninput=e=>{f.specs[i].containedPackCount=e.target.value;paint(p,f);};
    /* 售卖规格单位：枚举随 stdType，逐规格独立可选 */
    const up=row.querySelector('[data-unitpick]');
    if(up)up.onclick=()=>pbGridPicker('选择售卖规格单位',unitNames(f.stdType,'spec'),f.specs[i].specUnit,v=>{
      f.specs[i].specUnit=v;renderSpecs(p,f);paint(p,f);
    });
    row.querySelector('[data-price]').oninput=e=>{f.specs[i].price=e.target.value;paint(p,f);};
    const stk=row.querySelector('[data-stock]');if(stk&&!consign)stk.oninput=e=>{f.specs[i].stock=e.target.value;paint(p,f);};
    const rseg=row.querySelector('[data-refundseg]');
    if(rseg)rseg.querySelectorAll('.mo').forEach(o=>o.onclick=()=>{rseg.querySelectorAll('.mo').forEach(x=>x.classList.remove('on'));o.classList.add('on');f.specs[i].refund=o.dataset.r==='1'?1:0;});
    const pk=row.querySelector('[data-packpick]');
    if(pk)pk.onclick=()=>pbGridPicker('选择售卖单位',['无',...PACK_UNITS],f.specs[i].packUnit||'无',v=>{
      const val=v==='无'?'':v;f.specs[i].packUnit=val;
      const el=row.querySelector('[data-packv]');if(el){el.textContent=val||'选填 · 如 袋/箱/盒';el.classList.toggle('ph',!val);}
    });
    const seg=row.querySelector('[data-modeseg]');
    if(seg)seg.querySelectorAll('.mo').forEach(o=>o.onclick=()=>{
      seg.querySelectorAll('.mo').forEach(x=>x.classList.remove('on'));o.classList.add('on');
      f.specs[i].mode=o.dataset.m;
      const hint=row.querySelector('[data-mshint]');if(hint)hint.textContent=o.dataset.m==='daily'?'每天 0 点自动把可售库存补回设定的库存总数，适合每日稳定供应':'售完不再恢复、售罄即下线，适合尾货/限量';
    });
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
/* 商品类型联动：标品才有「单件净含量」；寄售才有「库存单位」；说明文案随类型改写 */
function stdToggle(p,f){
  const std=f.stdType==='标品';
  const consign=f.supplyMode==='寄售';
  const netRow=p.querySelector('#pb-net-row'),netHint=p.querySelector('#pb-net-hint');
  const npRow=p.querySelector('#pb-netpack-row');
  const suRow=p.querySelector('#pb-stockunit-row');
  if(netRow)netRow.style.display=std?'':'none';
  if(npRow)npRow.style.display=std?'':'none';   // 最小包装单位跟随单件净含量：只有标品才有
  if(netHint){netHint.style.display=std?'':'none';
    netHint.innerHTML=f.netPackType
      ?`包装上申报的固定净含量，<b>不乘售卖规格数量</b>。已选 <b>${f.netPackType}</b>：这是 1 个${f.netPackType==='单品'?'单品':'整包'}的量${f.netPackType==='单品'?'（如可乐 1 瓶 330 ml）':'（如海带丝 1 袋 200 g，袋内可再分小份）'}。一个规格装几个最小包装见各规格的「内含最小包装数」。`
      :'包装上申报的固定净含量，<b>不乘售卖规格数量</b>（1 瓶与 24 瓶/箱都是 330 ml）。再用<b>最小包装单位</b>声明它是哪一层的量：<b>单品</b>＝1 个单品的量；<b>单包</b>＝1 整包/袋的量。';}
  if(suRow)suRow.style.display=consign?'':'none';
  const sh=p.querySelector('#pb-std-hint');
  if(sh)sh.innerHTML=std
    ? '<b>标品</b>：售卖规格单位取计件单位（个/打/瓶/罐/盒/袋/箱/卷/托），数量×单位算不出净含量，故须申报单件净含量。'
    : '<b>非标品</b>：售卖规格单位取计量单位（g/kg），<b>净含量 = 售卖规格数量 + 售卖规格单位</b>，无需另填。';
}
/* 净含量只读格局部刷新：不重渲整个规格区，否则打断正在输入的焦点 */
function refreshNet(p,f){
  p.querySelectorAll('.pb-spec').forEach((row,i)=>{
    const el=row.querySelector('[data-netv]');if(!el)return;
    const s=f.specs[i]||{};
    const eff=f.supplyMode==='寄售'?f.stockUnit:(f.stdType==='标品'&&i>0?((f.specs[0]||{}).specUnit||''):s.specUnit);
    const t=specNetTxt(f,{...s,specUnit:eff});
    el.textContent=t||'—';el.className='uv'+(t?'':' ph');
  });
}
function paint(p,f,submitted){
  submitted=!!submitted;   // 必须转真布尔：classList.toggle(cls,undefined) 等同于取反，会误标红
  // 商品名称(同名 BR-09 即时红；空值仅提交时红)
  const nameDup=!!(f.name.trim()&&EXISTING.includes(f.name.trim()));
  p.querySelector('#pb-name-row').classList.toggle('err',nameDup||(submitted&&!f.name.trim()));
  // 后台类目(空值提交时红；资质未覆盖 BR-08 即时红)
  p.querySelector('#pb-cat-row').classList.toggle('err',(submitted&&!f.cat)||(!!f.cat&&!LICENSE.has(f.cat.n)));
  p.querySelector('#pb-tax-row').classList.toggle('err',submitted&&!String(f.tax).trim());
  p.querySelector('#pb-std-row').classList.toggle('err',submitted&&!f.stdType);
  const nr=p.querySelector('#pb-net-row');
  if(nr)nr.classList.toggle('err',submitted&&f.stdType==='标品'&&!(parseFloat(f.netQty)>0));
  const npr=p.querySelector('#pb-netpack-row');
  if(npr)npr.classList.toggle('err',submitted&&f.stdType==='标品'&&!f.netPackType);
  const sur=p.querySelector('#pb-stockunit-row');
  if(sur)sur.classList.toggle('err',submitted&&f.supplyMode==='寄售'&&!f.stockUnit);
  // BCRS 押金单价：选「是」时必填 >0 且 ≤ 上限（即时标红）
  const bOn=f.bcrs==='是'&&!!(f.cat&&f.cat.bcrs);
  const bCnt=parseInt(f.bcrsUnitContainers,10);
  const bCntOk=Number.isInteger(bCnt)&&bCnt>=1&&bCnt<=BCRS_CONTAINERS_MAX;
  const bBad=bOn&&((String(f.bcrsUnitContainers).trim()&&!bCntOk)||(submitted&&!String(f.bcrsUnitContainers).trim()));
  p.querySelector('#pb-bcrsdep-row').classList.toggle('err',!!bBad);
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
    // BCRS 押金预览：本规格押金 = 数量 × 押金单价（系统算，商家不心算）
    const bn=row.querySelector('[data-bnote]');
    if(bn){const q=parseInt(qtys[i],10);
      bn.textContent=(bOn&&bCntOk&&q>0)?`BCRS 押金 S$${(q*bCnt*BCRS_UNIT_PRICE).toFixed(2)}／${q}${(f.supplyMode==='寄售'?f.stockUnit:(f.specs[0]||{}).specUnit)||''}（${q}×${bCnt}容器×S$${BCRS_UNIT_PRICE.toFixed(2)}）`:'';}
  });
}

/* ---- 提交校验(9 条，逐条对应 PC 规则) ---- */
function runChecks(f){
  const fails=[];
  if(!f.name.trim())            fails.push(['必填','缺少「商品名称」']);
  if(!f.cat)                    fails.push(['必填','缺少「后台类目」']);
  if(!String(f.tax).trim())     fails.push(['必填','缺少「税率」']);
  if(!STD_TYPES.includes(f.stdType)) fails.push(['必填','缺少「商品类型」']);
  /* 标品：净含量是包装申报的固定值，必填；非标品无此字段 */
  if(f.stdType==='标品'){
    if(!(parseFloat(f.netQty)>0)) fails.push(['净含量','「单件净含量」必填——标品的净含量是包装上申报的固定值，不由售卖规格数量倒推']);
    else if(!f.netUnit)           fails.push(['净含量','填了单件净含量，「净含量单位」必填']);
    if(!f.netPackType)            fails.push(['净含量','「最小包装单位」必填——声明净含量是 1 个单品的量还是 1 整包的量']);
    else if(!NET_PACK_TYPES.includes(f.netPackType)) fails.push(['净含量',`最小包装单位「${f.netPackType}」不在取值内（${NET_PACK_TYPES.join('/')}）`]);
    f.specs.forEach((s,i)=>{const v=String(s.containedPackCount||'').trim();
      if(v&&!/^[1-9]\d*$/.test(v))fails.push(['规格',`规格${i+1} 内含最小包装数须为正整数，留空即按售卖规格数量`]);});
  }
  if(f.supplyMode==='寄售'&&!f.stockUnit) fails.push(['必填','寄售品需选择「库存单位」']);
  if(f.supplyMode==='寄售'&&f.stockUnit&&!unitNames(f.stdType,'spec').includes(f.stockUnit))
    fails.push(['单位规范',`库存单位「${f.stockUnit}」不在${f.stdType}的售卖规格单位取值内（${unitNames(f.stdType,'spec').join('/')}）`]);
  if(!f.specs.length)          fails.push(['规格','至少添加 1 个售卖规格']);
  f.specs.forEach((s,i)=>{const q=String(s.qty).trim();if(!/^[1-9]\d*$/.test(q))fails.push(['规格',`规格${i+1} 售卖规格数量必须为正整数 ≥1`]);});
  /* 售卖规格单位：寄售取库存单位、标品非首行取首行，其余逐行必填且须在规范内 */
  if(f.supplyMode!=='寄售')f.specs.forEach((s,i)=>{
    if(!s.specUnit){fails.push(['规格',`规格${i+1} 需选择「售卖规格单位」`]);return;}
    if(!unitNames(f.stdType,'spec').includes(s.specUnit))
      fails.push(['单位规范',`规格${i+1} 售卖规格单位「${s.specUnit}」不在${f.stdType}取值内（${unitNames(f.stdType,'spec').join('/')}）`]);
  });
  f.specs.forEach((s,i)=>{if(s.packUnit&&!unitNames(f.stdType,'sell').includes(s.packUnit))
    fails.push(['单位规范',`规格${i+1} 售卖单位「${s.packUnit}」不在规范取值内（${unitNames(f.stdType,'sell').join('/')}）`]);});
  const qtys=f.specs.map(s=>String(s.qty).trim()).filter(q=>/^[1-9]\d*$/.test(q));
  if(new Set(qtys).size!==qtys.length) fails.push(['规格','各规格「数量」不可重复']);
  if(f.cat&&!LICENSE.has(f.cat.n)) fails.push(['资质',`经营许可证未覆盖「${f.cat.n}」类目`]);
  if(f.bcrs==='是'&&f.cat&&f.cat.bcrs){
    const d=parseInt(f.bcrsUnitContainers,10);
    if(!Number.isInteger(d)||d<1)          fails.push(['BCRS','支持 BCRS 需填「每最小售卖单位容器数」（正整数 ≥1）']);
    else if(d>BCRS_CONTAINERS_MAX)         fails.push(['BCRS',`容器数不合理（>${BCRS_CONTAINERS_MAX}），请核对最小售卖单位`]);
  }
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

/* ---- BCRS 类目门控：仅 cat.bcrs=true 的类目显示；切到不支持的类目则隐藏并重置为「否」 ---- */
function bcrsToggle(p,f){
  const rowB=p.querySelector('#pb-bcrs-row'),rowD=p.querySelector('#pb-bcrsdep-row'),tip=p.querySelector('#pb-bcrs-tip');
  if(!rowB)return;
  const catOn=!!(f.cat&&f.cat.bcrs);
  if(!catOn){f.bcrs='否';f.bcrsUnitContainers='';const v=p.querySelector('#pb-bcrs-v');if(v)v.textContent='否';const dp=p.querySelector('#pb-bcrscnt');if(dp)dp.value='';}
  rowB.style.display=catOn?'':'none';
  const depOn=catOn&&f.bcrs==='是';
  rowD.style.display=depOn?'':'none';
  tip.style.display=depOn?'':'none';
}

/* ---- 表单绑定 ---- */
function bindForm(p,f){
  const setPH=(el,txt,filled)=>{el.innerHTML=filled?txt:`<span class="ph">${txt}</span>`;};
  stdToggle(p,f);renderSpecs(p,f);renderImgs(p,f);paint(p,f);

  // 文本输入
  p.querySelector('#pb-name').oninput=e=>{f.name=e.target.value;paint(p,f);};
  p.querySelector('#pb-alias').oninput=e=>{f.alias=e.target.value;};
  p.querySelector('#pb-tax').oninput=e=>{f.tax=e.target.value;paint(p,f);};
  p.querySelector('#pb-netqty').oninput=e=>{f.netQty=e.target.value;refreshNet(p,f);paint(p,f);};
  p.querySelector('#pb-mnote').oninput=e=>{f.measureNote=e.target.value;};
  p.querySelector('#pb-shelflife').oninput=e=>{f.shelfLife=e.target.value;};
  p.querySelector('#pb-origin').oninput=e=>{f.origin=e.target.value;};
  p.querySelector('#pb-brand').oninput=e=>{f.brand=e.target.value;};
  p.querySelector('#pb-desc').oninput=e=>{f.desc=e.target.value;};
  // 后台类目(选中后自动带出默认税率，手填可改；联动 BCRS 类目门控)
  p.querySelector('#pb-cat-row').onclick=()=>pbCatPicker(f.cat,c=>{f.cat=c;setPH(p.querySelector('#pb-cat-v'),c.n,1);if(!String(f.tax).trim()){f.tax=String(c.tax);p.querySelector('#pb-tax').value=c.tax;}bcrsToggle(p,f);paint(p,f);});
  // BCRS：是否支持(仅 bcrs 类目可见) + 押金单价
  p.querySelector('#pb-bcrs-row').onclick=()=>pbGridPicker('是否支持 BCRS',['否','是'],f.bcrs,v=>{
    f.bcrs=v;setPH(p.querySelector('#pb-bcrs-v'),v,1);
    if(v==='是'&&!String(f.bcrsUnitContainers).trim()){f.bcrsUnitContainers='1';p.querySelector('#pb-bcrscnt').value='1';}  // 高频默认值：一瓶/一罐=1 容器
    bcrsToggle(p,f);paint(p,f);});
  p.querySelector('#pb-bcrscnt').oninput=e=>{f.bcrsUnitContainers=e.target.value;paint(p,f);};
  bcrsToggle(p,f);
  // 最小售卖单位(变更后 SKU 售卖规格单位联动只读)
  p.querySelector('#pb-supply-row').onclick=()=>pbGridPicker('售卖模式',['自售','寄售'],f.supplyMode,v=>{
    f.supplyMode=v;setPH(p.querySelector('#pb-supply-v'),v,1);stdToggle(p,f);renderSpecs(p,f);paint(p,f);});

  /* 商品类型：切换后两类的售卖规格单位取值集互斥，原值必然失效 → 清空重选（与 PC 同口径，PRD BR-11） */
  p.querySelector('#pb-std-row').onclick=()=>pbGridPicker('商品类型',STD_TYPES,f.stdType,v=>{
    if(v===f.stdType)return;
    const ok=unitNames(v,'spec');
    let cleared=0;
    f.specs.forEach(s=>{if(s.specUnit&&!ok.includes(s.specUnit)){s.specUnit='';cleared++;}});
    if(f.stockUnit&&!ok.includes(f.stockUnit))f.stockUnit='';
    if(v==='非标品'){f.netQty='';f.netUnit='';}      // 非标品无净含量字段
    f.stdType=v;setPH(p.querySelector('#pb-std-v'),v,1);
    setPH(p.querySelector('#pb-stockunit-v'),f.stockUnit||'请选择',!!f.stockUnit);
    p.querySelector('#pb-netqty').value=f.netQty;
    setPH(p.querySelector('#pb-netunit'),f.netUnit||'单位',!!f.netUnit);
    stdToggle(p,f);renderSpecs(p,f);paint(p,f);
    if(cleared)toast(`已清空 ${cleared} 个规格的售卖规格单位，请重新选择`);   // 多规格静默清空会让商家以为没改动
  });
  // 单件净含量（标品必填）：数值即时重算各规格净含量
  p.querySelector('#pb-net-row').onclick=e=>{if(e.target.closest('input'))return;pbGridPicker('净含量单位',unitNames(f.stdType,'net'),f.netUnit,v=>{f.netUnit=v;setPH(p.querySelector('#pb-netunit'),v,1);refreshNet(p,f);paint(p,f);});};
  // 库存单位（寄售专用）：取值同售卖规格单位枚举；变更后各规格只读单位与净含量联动
  p.querySelector('#pb-netpack-row').onclick=()=>pbGridPicker('最小包装单位',NET_PACK_TYPES,f.netPackType,v=>{
    f.netPackType=v;setPH(p.querySelector('#pb-netpack-v'),v,1);stdToggle(p,f);refreshNet(p,f);paint(p,f);
  });
  p.querySelector('#pb-stockunit-row').onclick=()=>pbGridPicker('库存单位',unitNames(f.stdType,'spec'),f.stockUnit,v=>{
    f.stockUnit=v;setPH(p.querySelector('#pb-stockunit-v'),v,1);renderSpecs(p,f);paint(p,f);});
  // 效期管理 / 保质期单位 / APP是否展示效期 / 储存条件 / 履约方式
  p.querySelector('#pb-valid-row').onclick=()=>pbGridPicker('效期管理',['是','否'],f.validEnable,v=>{f.validEnable=v;setPH(p.querySelector('#pb-valid-v'),v,1);});
  p.querySelector('#pb-shelf-row').onclick=e=>{if(e.target.closest('input'))return;pbGridPicker('保质期单位',SHELF_UNITS,f.shelfUnit,v=>{f.shelfUnit=v;setPH(p.querySelector('#pb-shelfunit'),v,1);});};
  p.querySelector('#pb-appshow-row').onclick=()=>pbGridPicker('APP是否展示效期',['展示','不展示'],f.appShowShelf,v=>{f.appShowShelf=v;setPH(p.querySelector('#pb-appshow-v'),v,1);});
  p.querySelector('#pb-storage-row').onclick=()=>pbGridPicker('储存条件',STORAGES,f.storage,v=>{f.storage=v;setPH(p.querySelector('#pb-storage-v'),v,1);});
  p.querySelector('#pb-fulfill-row').onclick=()=>pbGridPicker('履约方式',FULFILLS,f.fulfill,v=>{f.fulfill=v;setPH(p.querySelector('#pb-fulfill-v'),v,1);});
  // 输入框单元格点击空白不抢焦点
  ['pb-name-row','pb-alias-row','pb-tax-row','pb-mnote-row','pb-bcrsdep-row','pb-origin-row','pb-brand-row','pb-desc-row','pb-selltype-row'].forEach(id=>{const el=p.querySelector('#'+id);if(el)el.onclick=null;});

  p.querySelector('#pb-addspec').onclick=()=>{f.specs.push({qty:'',price:'',stock:'',mode:'finite',packUnit:'',specUnit:'',containedPackCount:''});renderSpecs(p,f);paint(p,f);};

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
