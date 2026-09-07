/* PC · 特价活动（商家自主特价 · 商家 100% 出资） —— 框架见 PRD/scm_商家特价活动_功能框架.md
   口径（与运营平台「促销活动配置框架」同一套特价模型 subType=12，仅加出资方维度）：
     · 活动价 = 未税价，必填、>0、且 < 当前未税售价（BR-02）；含税价 = 活动价×(1+税率)；预计到手复用改价弹窗算法
     · 折扣 = 活动价 ÷ 原价快照（BR-03）；限购 每客户每日 N 件，留空不限（BR-05）
     · 同一 SKU 时间重叠只能在 1 个活动内，跨出资方互斥（BR-04）——平台活动占用的 SKU 对商家只显示「平台活动」
     · 状态复用 PromoActivityStatus：0 未开始 / 1 进行中 / 2 已结束 / 4 已终止；商家端无草稿（BR-13）
     · 进行中：不可改开始时间、不可改已有行活动价（改价=移除后重加）；可加/移 SKU、可改结束时间、可终止（BR-14）
     · 差价 100% 商家承担，落 seller_discount_amount，不进平台优惠、不影响商家应付（BR-01/09）
     · 门店范围固定全部门店；不审核，平台可强制终止（BR-16/18）
   依赖 inline 全局：DB / money / toast / modal / closeModal / askConfirm / drawer / closeDrawer / nav / render / ts /
                     taxRate / priceIncl / skuCommInfo / skuSpec / skuFullName */
(function(){
  const pad=n=>(''+n).padStart(2,'0');
  const fmt=d=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  const shift=(days,h,m)=>{const d=new Date();d.setDate(d.getDate()+days);d.setHours(h,m||0,0,0);return fmt(d);};
  const toLocal=s=>s?s.replace(' ','T'):'';
  const fromLocal=s=>s?s.replace('T',' ').slice(0,16):'';
  const nowStr=()=>fmt(new Date());
  const seq=()=>{DB.promoSeq=(DB.promoSeq||130)+1;return DB.promoSeq;};

  /* ===== 种子数据：商家活动 4 场（覆盖 4 态）+ 平台活动 1 场（演示占用） ===== */
  function ensure(){
    if(DB.promos)return;
    const who=DB.merchant.contact||'店铺管理员';
    DB.promos=[
      {id:'AC118',fund:1,name:'叶菜周中特惠',start:shift(-2,0,0),end:shift(3,23,59),status:1,createdBy:who,createdAt:shift(-3,10,12),updatedAt:shift(-3,10,12),
        items:[{skuId:'SKU8815',orig:9.30,price:7.90,limit:20},{skuId:'SKU8817',orig:6.50,price:5.20,limit:null}],
        logs:[{t:shift(-3,10,12),who,act:'创建活动',d:'2 个 SKU · '+shift(-2,0,0)+' ~ '+shift(3,23,59)}]},
      {id:'AC121',fund:1,name:'菠菜清仓',start:shift(2,0,0),end:shift(4,23,59),status:0,createdBy:who,createdAt:shift(-1,16,40),updatedAt:shift(-1,16,40),
        items:[{skuId:'SKU8819',orig:5.80,price:4.50,limit:10}],
        logs:[{t:shift(-1,16,40),who,act:'创建活动',d:'1 个 SKU'}]},
      {id:'AC102',fund:1,name:'8 月椰子水促销',start:'2026-08-20 00:00',end:'2026-08-31 23:59',status:2,createdBy:who,createdAt:'2026-08-18 09:30',updatedAt:'2026-08-31 23:59',
        items:[{skuId:'SKU8825',orig:2.50,price:2.10,limit:null},{skuId:'SKU8826',orig:55.00,price:48.00,limit:5}],
        logs:[{t:'2026-08-18 09:30',who,act:'创建活动',d:'2 个 SKU'},{t:'2026-08-31 23:59',who:'系统',act:'到期结束',d:''}]},
      {id:'AC109',fund:1,name:'空心菜限时',start:'2026-08-28 00:00',end:'2026-09-05 23:59',status:4,endedBy:'platform',endReason:'活动价低于平台价格监管下限，运营强制终止（客服已通知）',createdBy:who,createdAt:'2026-08-27 14:05',updatedAt:'2026-08-29 11:20',
        items:[{skuId:'SKU8830',orig:7.00,price:2.00,limit:null}],
        logs:[{t:'2026-08-27 14:05',who,act:'创建活动',d:'1 个 SKU'},{t:'2026-08-29 11:20',who:'平台运营',act:'强制终止',d:'活动价低于平台价格监管下限'}]},
      // 平台活动（出资方=平台）：商家端不可见明细，仅用于 SKU 占用校验
      {id:'AC115',fund:0,name:'平台·9 月蔬菜季',start:shift(-1,0,0),end:shift(6,23,59),status:1,items:[{skuId:'SKU8816',orig:7.00,price:5.60,limit:null}],logs:[]},
    ];
  }
  window.ensurePromos=ensure;

  /* ===== 状态 ===== */
  const ST={0:['未开始','t-b'],1:['进行中','t-g'],2:['已结束','t-gr'],4:['已终止','t-r']};
  function calcStatus(a){if(a.status==4)return 4;const n=nowStr();if(n<a.start)return 0;if(n>a.end)return 2;return 1;}
  function refresh(){ensure();DB.promos.forEach(a=>{a.status=calcStatus(a);});}
  function stTag(a){const s=ST[calcStatus(a)];return `<span class="tag ${s[1]}"><span class="dot"></span>${s[0]}${calcStatus(a)==4&&a.endedBy=='platform'?'（平台）':''}</span>`;}
  const live=a=>[0,1].includes(calcStatus(a));   // 占用 = 未开始 + 进行中

  /* ===== SKU 查找 ===== */
  function findSku(skuId){for(let i=0;i<DB.products.length;i++){const p=DB.products[i];const k=(p.skus||[]).findIndex(s=>s.skuId==skuId);if(k>=0)return {p,s:p.skus[k],i,k};}return null;}
  function overlap(a,b){return a.start<=b.end&&b.start<=a.end;}
  // SKU 被哪个生效/待开始活动占用（可排除当前编辑活动）
  function occupiedBy(skuId,range,exceptId){ensure();return DB.promos.find(a=>a.id!=exceptId&&live(a)&&(a.items||[]).some(x=>x.skuId==skuId)&&(!range||overlap(a,range)))||null;}
  // 供商品列表：该 SKU 当前所在的商家活动（进行中/未开始）
  window.promoOfSku=function(skuId){ensure();return DB.promos.find(a=>a.fund==1&&live(a)&&(a.items||[]).some(x=>x.skuId==skuId))||null;};
  window.promoSkuTag=function(skuId){const a=window.promoOfSku(skuId);if(!a)return '';const it=a.items.find(x=>x.skuId==skuId);const on=calcStatus(a)==1;return ` <span class="tag ${on?'t-r':'t-b'}" style="font-size:10.5px;cursor:pointer" title="${a.name} · ${a.start} ~ ${a.end}" onclick="act_promoDetail('${a.id}')">${on?'特价中':'特价待开始'} ${money(it.price)}</span>`;};
  // 改价守门（BR-12）：活动内 SKU 新售价 ≤ 活动价 → 拦截
  window.promoRepriceGuard=function(skuId,newPrice){const a=window.promoOfSku(skuId);if(!a)return true;const it=a.items.find(x=>x.skuId==skuId);if(newPrice<=it.price){toast(`该 SKU 在特价活动《${a.name}》中，活动价 ${money(it.price)}；新售价须高于活动价，或先从活动移除 / 终止活动`,'err');return false;}it.orig=newPrice;a.updatedAt=ts();return true;};
  // 下架/回收守门（BR-12）：活动行自动失效——这里只提示，行本身留在活动里、渲染时按 SKU 状态标「不生效」
  function rowEffective(it){const f=findSku(it.skuId);if(!f)return [false,'SKU 不存在'];if(f.s.recycled)return [false,'已移入回收站'];if(f.p.status!='onsale')return [false,f.p.status=='forced_off'?'平台强制下架':f.p.status=='rejected'?'审核驳回':'商品未上架'];if(f.s.off)return [false,'SKU 已下架'];return [true,''];}

  /* ===== 金额 ===== */
  function calc(it){const f=findSku(it.skuId);const p=f?f.p:null;const rate=p?taxRate(p):9;const factor=1+rate/100;const ci=p?skuCommInfo(p):{svc:0,pickup:0};
    const incl=(+it.price||0)*factor,comm=incl*ci.svc,inc=incl-comm-ci.pickup;const disc=it.orig?(+it.price/it.orig*10):0;
    return {rate,factor,incl,comm,inc,disc,svc:ci.svc,pickup:ci.pickup,origIncl:(+it.orig||0)*factor};}
  const discTxt=d=>d>0?d.toFixed(1)+' 折':'—';
  const lim=v=>(v==null||v==='')?'不限':`${v} 件/客/日`;

  /* ===== 列表 ===== */
  const TABS=[['all','全部'],['0','未开始'],['1','进行中'],['2','已结束'],['4','已终止']];
  function filtered(){refresh();const f=DB.promoFilter||{};const tab=DB.promoTab||'all';
    return DB.promos.filter(a=>a.fund==1).filter(a=>tab=='all'||calcStatus(a)==+tab)
      .filter(a=>!f.name||a.name.includes(f.name)||a.id.includes(f.name))
      .filter(a=>!f.sku||a.items.some(x=>{const s=findSku(x.skuId);return x.skuId.includes(f.sku)||(s&&s.p.name.includes(f.sku));}))
      .filter(a=>!f.from||a.end>=f.from).filter(a=>!f.to||a.start<=f.to+' 23:59')
      .sort((a,b)=>b.createdAt<a.createdAt?-1:1);}
  window.promoLiveCount=function(){refresh();return DB.promos.filter(a=>a.fund==1&&calcStatus(a)==1).length;};

  PAGES['m-promo']=()=>{refresh();
    if(DB.promoView=='edit')return editPage();
    const f=DB.promoFilter||(DB.promoFilter={});const tab=DB.promoTab||'all';const rows=filtered();
    const cnt=k=>DB.promos.filter(a=>a.fund==1&&(k=='all'||calcStatus(a)==+k)).length;
    return `
    <div class="card" style="margin-bottom:14px"><div class="card-bd" style="display:flex;gap:16px;align-items:flex-end;flex-wrap:wrap;padding:14px 16px">
      <div><div style="font-size:12px;color:var(--ts);margin-bottom:5px">活动名称 / 活动ID</div><input id="pm-name" value="${f.name||''}" placeholder="输入活动名称或 ID" style="min-width:220px" onkeydown="if(event.key=='Enter')promoQuery()"></div>
      <div><div style="font-size:12px;color:var(--ts);margin-bottom:5px">SKU 编码 / 商品名称</div><input id="pm-sku" value="${f.sku||''}" placeholder="SKU 编码或商品名" style="min-width:200px" onkeydown="if(event.key=='Enter')promoQuery()"></div>
      <div><div style="font-size:12px;color:var(--ts);margin-bottom:5px">活动时间</div><div style="display:flex;align-items:center;gap:6px"><input type="date" id="pm-from" style="width:150px" value="${f.from||''}"><span style="color:var(--tt)">~</span><input type="date" id="pm-to" value="${f.to||''}" style="width:150px"></div></div>
      <button class="btn btn-p btn-sm" onclick="promoQuery()">查询</button>
      <button class="btn btn-o btn-sm" onclick="DB.promoFilter={};render()">重置</button>
    </div></div>
    <div class="card"><div class="card-hd" style="flex-wrap:wrap;gap:10px">
      <div class="tabs" style="margin:0;border:none">${TABS.map(x=>`<div class="tab ${tab==x[0]?'active':''}" onclick="DB.promoTab='${x[0]}';render()">${x[1]}${cnt(x[0])?` <span class="tag ${x[0]=='1'?'t-g':x[0]=='4'?'t-r':'t-gr'}" style="font-size:10px;margin-left:2px">${cnt(x[0])}</span>`:''}</div>`).join('')}</div>
      <div class="row" style="gap:8px">
        <span style="font-size:12.5px;color:var(--ts)">差价由商家 100% 承担 · 佣金按活动价成交额计 · 提交即到点生效，无需平台审核</span>
        <button class="btn btn-o btn-sm" onclick="act_promoImport()">📥 导入活动价</button>
        <button class="btn btn-p btn-sm" onclick="act_promoEdit()">＋ 新建特价活动</button>
      </div>
    </div><div class="card-bd flush"><div style="overflow-x:auto"><table>
      <thead><tr><th>活动ID</th><th>活动名称</th><th>开始时间</th><th>结束时间</th><th>商品数</th><th>最低折扣</th><th>状态</th><th>创建人</th><th>创建时间</th><th>更新时间</th><th>操作</th></tr></thead><tbody>
      ${rows.map(a=>{const st=calcStatus(a);const minD=Math.min(...a.items.map(x=>calc(x).disc));const eff=a.items.filter(x=>rowEffective(x)[0]).length;
        return `<tr>
        <td class="mono">${a.id}</td>
        <td><b>${a.name}</b>${st==4&&a.endedBy=='platform'?`<div style="font-size:11px;color:var(--r)">平台强制终止</div>`:''}</td>
        <td style="white-space:nowrap">${a.start}</td><td style="white-space:nowrap">${a.end}</td>
        <td>${a.items.length}${eff<a.items.length&&st<2?` <span class="tag t-y" style="font-size:10px" title="有 SKU 已下架/驳回，活动行不生效">${a.items.length-eff} 不生效</span>`:''}</td>
        <td>${discTxt(minD)}</td>
        <td>${stTag(a)}</td>
        <td>${a.createdBy||'—'}</td>
        <td style="font-size:11.5px;color:var(--ts);white-space:nowrap">${a.createdAt||'—'}</td><td style="font-size:11.5px;color:var(--ts);white-space:nowrap">${a.updatedAt||'—'}</td>
        <td style="white-space:nowrap">${st<2?`<button class="btn btn-o btn-sm" onclick="act_promoEdit('${a.id}')">编辑</button> <button class="btn btn-link btn-sm" style="color:var(--r)" onclick="act_promoStop('${a.id}')">终止</button>`:''} <button class="btn btn-link" onclick="act_promoDetail('${a.id}')">详情</button></td>
      </tr>`;}).join('')||`<tr><td colspan="11"><div class="empty"><div class="e-ic">🏷️</div><div class="e-t">${tab=='all'?'还没有商品特价活动':'该状态下暂无活动'}</div><div class="e-s">给本店 SKU 设活动价与起止时间，C 端按特价展示；差价由商家承担、佣金按活动价成交额计</div>${tab=='all'?`<div style="margin-top:10px"><button class="btn btn-p btn-sm" onclick="act_promoEdit()">＋ 新建特价活动</button></div>`:''}</div></td></tr>`}
      </tbody></table></div></div></div>`;
  };
  window.promoQuery=function(){const g=id=>(document.getElementById(id)||{}).value||'';DB.promoFilter={name:g('pm-name').trim(),sku:g('pm-sku').trim(),from:g('pm-from'),to:g('pm-to')};render();};

  /* ===== 详情抽屉 ===== */
  window.act_promoDetail=function(id){ensure();const a=DB.promos.find(x=>x.id==id);if(!a)return;const st=calcStatus(a);
    const totalSave=a.items.reduce((n,x)=>n+((x.orig-x.price)*calc(x).factor),0);
    drawer(`<div class="mc-hd"><div><h3>${a.name} <span style="font-size:12px;color:var(--ts);font-weight:400;margin-left:6px" class="mono">${a.id}</span></h3><p>${stTag(a)} <span style="margin-left:8px">${a.start} ~ ${a.end}</span></p></div><button class="mc-x" onclick="closeDrawer()">×</button></div>
    <div class="mc-bd">
      ${st==4?`<div class="ib ${a.endedBy=='platform'?'ib-r':'ib-gr'}" style="margin-bottom:12px"><span class="i">${a.endedBy=='platform'?'⛔':'ℹ️'}</span><div><b>${a.endedBy=='platform'?'平台强制终止':'商家终止'}</b>${a.endReason?'：'+a.endReason:''}<div style="font-size:12px;margin-top:2px">终止后 C 端已立即恢复原价；活动期间已生成订单按活动价快照不受影响。</div></div></div>`:''}
      <div class="fg2" style="margin-bottom:12px">
        <div><div style="font-size:12px;color:var(--ts)">出资方</div><div><b>商家 100%</b> <span style="font-size:12px;color:var(--ts)">差价由商家承担，不进平台优惠</span></div></div>
        <div><div style="font-size:12px;color:var(--ts)">门店范围</div><div>全部门店</div></div>
        <div><div style="font-size:12px;color:var(--ts)">叠加规则</div><div>可与平台优惠券叠加<span style="font-size:12px;color:var(--ts)">（券由平台承担）</span></div></div>
        <div><div style="font-size:12px;color:var(--ts)">创建</div><div>${a.createdBy||'—'} · <span style="color:var(--ts)">${a.createdAt||'—'}</span></div></div>
      </div>
      <h4 style="margin:6px 0 8px;font-size:13.5px">活动商品 <span style="font-weight:400;color:var(--ts);font-size:12px">${a.items.length} 个 SKU · 单件让利合计（含税） ${money(totalSave)}</span></h4>
      <div style="overflow-x:auto"><table class="subtbl"><thead><tr><th>SKU 编码</th><th>商品名称</th><th>原价(未税)</th><th>活动价(未税)</th><th>活动含税价</th><th>折扣</th><th>限购</th><th>预计到手/件</th><th>生效</th></tr></thead><tbody>
        ${a.items.map(x=>{const f=findSku(x.skuId);const c=calc(x);const ef=rowEffective(x);return `<tr><td class="mono">${x.skuId}</td><td>${f?skuFullName(f.p,f.s):'—'}</td><td><s style="color:var(--tt)">${money(x.orig)}</s></td><td><b style="color:var(--r)">${money(x.price)}</b></td><td style="color:var(--ts)">${money(c.incl)}</td><td>${discTxt(c.disc)}</td><td>${lim(x.limit)}</td><td style="color:var(--gd)">${money(c.inc)}</td><td>${st>=2?'<span style="color:var(--tt)">—</span>':ef[0]?'<span class="tag t-g" style="font-size:10px">生效</span>':`<span class="tag t-y" style="font-size:10px" title="${ef[1]}">不生效·${ef[1]}</span>`}</td></tr>`;}).join('')}
      </tbody></table></div>
      <div style="font-size:11.5px;color:var(--ts);margin:8px 0 14px">预计到手/件 = 活动含税价 − 商品佣金额（活动含税价 × 服务费率）− 预估揽收费；佣金按<b>活动价成交额</b>计，让利部分不再抽佣。多退少补商品的活动价为每计量单位活动价，按实重结算。</div>
      <h4 style="margin:6px 0 8px;font-size:13.5px">操作日志</h4>
      ${(a.logs||[]).slice().reverse().map(l=>`<div style="display:flex;gap:10px;padding:7px 0;border-bottom:1px dashed var(--bd2);font-size:12.5px"><span style="color:var(--ts);white-space:nowrap">${l.t}</span><span style="white-space:nowrap"><b>${l.who}</b> · ${l.act}</span><span style="color:var(--ts)">${l.d||''}</span></div>`).join('')||'<div style="color:var(--tt);font-size:12.5px">暂无</div>'}
    </div>
    <div class="mc-ft">${st<2?`<button class="btn btn-o" style="color:var(--r);border-color:var(--r)" onclick="closeDrawer();act_promoStop('${a.id}')">终止活动</button><button class="btn btn-p" onclick="closeDrawer();act_promoEdit('${a.id}')">编辑</button>`:`<button class="btn btn-o" onclick="closeDrawer()">关闭</button>`}</div>`);
  };

  /* ===== 终止 ===== */
  window.act_promoStop=function(id){const a=DB.promos.find(x=>x.id==id);if(!a)return;const st=calcStatus(a);
    askConfirm(`确认终止特价活动「<b>${a.name}</b>」？<br><span style="font-size:12.5px;color:var(--ts)">${st==1?'终止后 C 端<b>立即</b>恢复原价，已生成订单不受影响；':'活动尚未开始，终止后不会生效；'}终止不可撤销，如需再做需新建活动。</span>`,()=>{a.status=4;a.endedBy='merchant';a.updatedAt=ts();(a.logs=a.logs||[]).push({t:ts(),who:DB.merchant.contact||'店铺管理员',act:'终止活动',d:st==1?'进行中终止，C 端已恢复原价':'未开始终止'});render();toast(`「${a.name}」已终止`,'info');});};

  /* ===== 新建 / 编辑 ===== */
  let ED=null;   // {id,name,start,end,items:[{skuId,orig,price,limit,locked}],isNew,status}
  window.act_promoEdit=function(id){ensure();
    if(id){const a=DB.promos.find(x=>x.id==id);if(!a)return;const st=calcStatus(a);if(st>=2){toast('已结束/已终止的活动不可编辑','err');return;}
      ED={id:a.id,name:a.name,start:a.start,end:a.end,status:st,isNew:false,items:a.items.map(x=>({...x,locked:st==1}))};}
    else ED={id:null,name:'',start:shift(1,0,0),end:shift(7,23,59),status:-1,isNew:true,items:[]};
    DB.promoView='edit';render();};
  window.promoBack=function(){ED=null;DB.promoView='';render();};
  function editPage(){if(!ED){DB.promoView='';return PAGES['m-promo']();}const run=ED.status==1;
    return `<div style="margin-bottom:14px" class="row"><button class="btn btn-o btn-sm" onclick="promoBack()">← 返回商品特价</button><span style="margin-left:12px;font-size:16px;font-weight:700">${ED.isNew?'新建商品特价':'编辑商品特价 · '+ED.id}</span>${run?'<span class="tag t-g" style="margin-left:8px">进行中</span>':''}</div>
    ${run?`<div class="ib ib-b" style="margin-bottom:14px"><span class="i">ℹ️</span>活动进行中：<b>开始时间与已有 SKU 的活动价不可修改</b>；可延长/缩短结束时间、新增 SKU（立即生效）、移除 SKU（该 SKU 立即恢复原价）。要改活动价请移除后重新添加。</div>`:''}
    <div class="card" style="margin-bottom:14px"><div class="card-hd"><h3>基本信息</h3><span class="sub">出资方 商家 100% · 门店范围 全部门店 · 可与平台优惠券叠加</span></div><div class="card-bd">
      <div class="fg3">
        <div class="fr"><label class="fl"><b>*</b>活动名称</label><input id="pe-name" maxlength="50" value="${ED.name}" placeholder="仅商家内部可见，≤50 字" oninput="ED_set('name',this.value)"></div>
        <div class="fr"><label class="fl"><b>*</b>开始时间</label><input type="datetime-local" id="pe-start" value="${toLocal(ED.start)}" ${run?'disabled':''} min="${toLocal(nowStr())}" onchange="ED_set('start',this.value)"></div>
        <div class="fr"><label class="fl"><b>*</b>结束时间</label><input type="datetime-local" id="pe-end" value="${toLocal(ED.end)}" min="${toLocal(run?nowStr():ED.start)}" onchange="ED_set('end',this.value)"></div>
      </div>
      <div style="font-size:11.5px;color:var(--ts)">开始时间不早于当前；结束时间须晚于开始且单场 ≤ 30 天；到点自动开始 / 结束，C 端同步切换活动价 / 原价。</div>
    </div></div>
    <div class="card"><div class="card-hd"><h3>活动商品</h3><span class="sub">${ED.items.length} 个 SKU · 活动价为未税价，须低于当前未税售价</span><div class="row" style="margin-left:auto;gap:8px"><button class="btn btn-p btn-sm" onclick="act_promoPick()">＋ 添加商品</button></div></div>
    <div class="card-bd flush"><div style="overflow-x:auto"><table>
      <thead><tr><th>SKU 编码</th><th>商品名称</th><th>税率</th><th>当前未税售价</th><th>当前含税价</th><th style="min-width:130px">活动价(未税) <b style="color:var(--r)">*</b></th><th>活动含税价</th><th>折扣</th><th>预计到手/件</th><th style="min-width:110px">限购(件/客/日)</th><th>操作</th></tr></thead><tbody id="pe-rows">
      ${ED.items.map((x,k)=>{const f=findSku(x.skuId);const c=calc(x);const bad=x.price!==''&&x.price!=null&&(!(+x.price>0)||+x.price>=x.orig);const low=+x.price>0&&+x.price<x.orig*0.3;
        return `<tr>
        <td class="mono">${x.skuId}</td><td style="white-space:nowrap">${f?skuFullName(f.p,f.s):'—'}${f&&f.s.refund?` <span class="tag t-y" style="font-size:10px" title="按重量定价：活动价为每 ${f.s.sellUnit||'kg'} 活动价，按实重结算">多退少补</span>`:''}</td>
        <td>${c.rate}%</td><td>${money(x.orig)}</td><td style="color:var(--ts)">${money(c.origIncl)}</td>
        <td><input class="miniprice" type="number" step="0.01" min="0.01" max="${(x.orig-0.01).toFixed(2)}" value="${x.price===''||x.price==null?'':(+x.price).toFixed(2)}" placeholder="< ${money(x.orig)}" ${x.locked?'disabled title="进行中不可改活动价，移除后重加"':''} style="${bad?'border-color:var(--r)':''}" oninput="ED_price(${k},this.value)">${bad?`<div style="font-size:11px;color:var(--r)">须 &gt;0 且低于 ${money(x.orig)}</div>`:low?`<div style="font-size:11px;color:var(--y)">低于售价 30%，提交时需二次确认</div>`:''}</td>
        <td style="color:var(--ts)" id="pe-incl-${k}">${+x.price>0?money(c.incl):'—'}</td>
        <td id="pe-disc-${k}">${discTxt(c.disc)}</td>
        <td style="color:var(--gd)" id="pe-inc-${k}">${+x.price>0?money(c.inc):'—'}</td>
        <td><input class="ministock" type="number" min="1" step="1" value="${x.limit==null?'':x.limit}" placeholder="不限" oninput="ED_limit(${k},this.value)"></td>
        <td><button class="btn btn-link btn-sm" style="color:var(--r)" onclick="ED_remove(${k})">移除</button></td>
      </tr>`;}).join('')||`<tr><td colspan="11"><div class="empty"><div class="e-ic">🥬</div><div class="e-t">还没有添加商品</div><div class="e-s">点「添加商品」从本店在售 SKU 中选择；已在其他活动（含平台活动）中的 SKU 不可选</div></div></td></tr>`}
      </tbody></table></div></div>
    <div class="card-bd" style="border-top:1px solid var(--bd2);display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px">
      <div style="font-size:11.5px;color:var(--ts)">预计到手/件 = 活动含税价 − 活动含税价 × 服务费率 − 预估揽收费（免佣期内佣金为 0）；仅供参考，以订单结算为准。</div>
      <div class="row" style="gap:8px"><button class="btn btn-o" onclick="promoBack()">取消</button><button class="btn btn-p" onclick="act_promoSubmit()">${ED.isNew?'提交活动':'保存修改'}</button></div>
    </div></div>`;}
  window.ED_set=function(k,v){if(!ED)return;ED[k]=(k=='start'||k=='end')?fromLocal(v):v;};
  window.ED_price=function(k,v){const x=ED.items[k];x.price=v===''?'':+v;const c=calc(x);const set=(id,t)=>{const e=document.getElementById(id);if(e)e.textContent=t;};set('pe-incl-'+k,+x.price>0?money(c.incl):'—');set('pe-disc-'+k,discTxt(c.disc));set('pe-inc-'+k,+x.price>0?money(c.inc):'—');};
  window.ED_limit=function(k,v){ED.items[k].limit=v===''?null:Math.max(1,parseInt(v)||1);};
  window.ED_remove=function(k){const x=ED.items[k];const f=findSku(x.skuId);const nm=f?skuFullName(f.p,f.s):x.skuId;if(x.locked){askConfirm(`活动进行中，移除「<b>${nm}</b>」后该 SKU <b>立即恢复原价</b>，确认移除？`,()=>{ED.items.splice(k,1);render();toast('已移除，保存后生效','info');});return;}ED.items.splice(k,1);render();};

  /* 选品弹窗：本店在售 SKU，已占用（含平台活动）置灰 */
  window.act_promoPick=function(){ensure();const range={start:ED.start,end:ED.end};DB.promoPickSel=[];DB.promoPickQ='';renderPick(range);};
  function renderPick(range){const q=(DB.promoPickQ||'').toLowerCase();const rows=[];
    DB.products.forEach((p,i)=>{if(p.status!='onsale')return;(p.skus||[]).forEach((s,k)=>{if(s.off||s.recycled||s.review)return;if(q&&!(p.name.toLowerCase().includes(q)||s.skuId.toLowerCase().includes(q)))return;rows.push({p,s,i,k});});});
    const sel=DB.promoPickSel;
    modalWide(`<div class="mc-hd"><div><h3>添加活动商品</h3><p>仅本店在售 SKU · 已在其他活动中的 SKU 不可选（活动时间 ${range.start} ~ ${range.end}）</p></div><button class="mc-x" onclick="promoPickClose()">×</button></div>
    <div class="mc-bd">
      <div class="row" style="gap:8px;margin-bottom:10px"><input id="pk-q" value="${DB.promoPickQ||''}" placeholder="搜索商品名称 / SKU 编码" style="min-width:280px" onkeydown="if(event.key=='Enter'){DB.promoPickQ=this.value.trim();promoPickRe()}"><button class="btn btn-o btn-sm" onclick="DB.promoPickQ=(document.getElementById('pk-q')||{}).value.trim();promoPickRe()">搜索</button><span style="margin-left:auto;font-size:12.5px;color:var(--ts)">已选 <b style="color:var(--tp)">${sel.length}</b></span></div>
      <div style="max-height:420px;overflow:auto"><table style="white-space:nowrap"><thead><tr><th style="width:30px"></th><th>SKU 编码</th><th>商品名称</th><th>品类</th><th>未税售价</th><th>可售库存</th><th>可选状态</th></tr></thead><tbody>
      ${rows.map(r=>{const inEd=ED.items.some(x=>x.skuId==r.s.skuId);const occ=inEd?null:occupiedBy(r.s.skuId,range,ED.id);const dis=inEd||!!occ;const on=sel.includes(r.s.skuId);
        return `<tr style="${dis?'opacity:.55':''}"><td>${dis?'':`<input type="checkbox" class="skuchk" ${on?'checked':''} onclick="promoPickToggle('${r.s.skuId}')">`}</td><td class="mono">${r.s.skuId}</td><td>${skuFullName(r.p,r.s)}${r.s.refund?' <span class="tag t-y" style="font-size:10px">多退少补</span>':''}</td><td>${r.p.cat||'—'}</td><td>${money(r.s.price||0)}</td><td>${r.s.stock||0}</td>
        <td style="font-size:12px">${inEd?'<span class="tag t-gr">已在本活动</span>':occ?`<span class="tag ${occ.fund==0?'t-b':'t-y'}" title="${occ.fund==0?'平台活动，明细不可见':occ.name}">已在${occ.fund==0?'平台活动':'活动《'+occ.name+'》'}中 · 至 ${occ.end.slice(5)}</span>`:'<span class="tag t-g">可选</span>'}</td></tr>`;}).join('')||'<tr><td colspan="7"><div class="empty"><div class="e-t">没有匹配的在售 SKU</div></div></td></tr>'}
      </tbody></table></div>
    </div>
    <div class="mc-ft"><button class="btn btn-o" onclick="promoPickClose()">取消</button><button class="btn btn-p" ${sel.length?'':'disabled'} onclick="promoPickOk()">加入活动（${sel.length}）</button></div>`);widen();}
  const widen=()=>{const mc=document.getElementById('mc');if(mc)mc.style.width='960px';};
  window.promoPickRe=function(){renderPick({start:ED.start,end:ED.end});};
  window.promoPickToggle=function(id){const a=DB.promoPickSel;const k=a.indexOf(id);if(k<0)a.push(id);else a.splice(k,1);renderPick({start:ED.start,end:ED.end});};
  const unwiden=()=>{const mc=document.getElementById('mc');if(mc)mc.style.width='';};
  window.promoPickClose=function(){unwiden();closeModal();};
  window.promoPickOk=function(){unwiden();DB.promoPickSel.forEach(id=>{const f=findSku(id);if(!f)return;ED.items.push({skuId:id,orig:f.s.price||0,price:'',limit:null,locked:false});});const n=DB.promoPickSel.length;DB.promoPickSel=[];closeModal();render();toast(`已加入 ${n} 个 SKU，请填写活动价`,'ok');};

  /* 提交：全量复验（对齐平台 BR-13） */
  window.act_promoSubmit=function(){if(!ED)return;
    const name=(document.getElementById('pe-name')||{}).value||ED.name;ED.name=name.trim();
    if(!ED.name){toast('请填写活动名称','err');return;}if(ED.name.length>50){toast('活动名称不超过 50 字','err');return;}
    if(!ED.start||!ED.end){toast('请填写活动起止时间','err');return;}
    if(ED.isNew&&ED.start<nowStr()){toast('开始时间不能早于当前时间','err');return;}
    if(ED.end<=ED.start){toast('结束时间必须晚于开始时间','err');return;}
    if(ED.status==1&&ED.end<nowStr()){toast('进行中活动的结束时间不能早于当前；要立即结束请用「终止」','err');return;}
    if((new Date(toLocal(ED.end))-new Date(toLocal(ED.start)))>30*86400000){toast('单场活动最长 30 天','err');return;}
    if(!ED.items.length){toast('至少添加 1 个活动商品','err');return;}
    const ids=ED.items.map(x=>x.skuId);if(new Set(ids).size!=ids.length){toast('同一 SKU 不可重复','err');return;}
    for(const x of ED.items){const f=findSku(x.skuId);const nm=f?skuFullName(f.p,f.s):x.skuId;
      if(f)x.orig=f.s.price||0;   // 售价在编辑过程中被改 → 以最新售价复验
      if(!(+x.price>0)){toast(`「${nm}」请填写活动价`,'err');return;}
      if(+x.price>=x.orig){toast(`「${nm}」活动价须低于当前未税售价 ${money(x.orig)}`,'err');return;}
      const occ=occupiedBy(x.skuId,{start:ED.start,end:ED.end},ED.id);if(occ){toast(`「${nm}」已在${occ.fund==0?'平台活动':'活动《'+occ.name+'》'}中（至 ${occ.end}），请移除或调整活动时间`,'err');return;}}
    const lows=ED.items.filter(x=>+x.price<x.orig*0.3);
    const go=()=>save();
    if(lows.length)askConfirm(`有 <b>${lows.length}</b> 个 SKU 活动价低于当前售价的 <b>30%</b>（如 ${(()=>{const x=lows[0];const f=findSku(x.skuId);return `${f?f.p.name:x.skuId} ${money(x.orig)} → ${money(+x.price)}`;})()}），差价全部由商家承担。确认按此价格提交？`,go);else go();};
  function save(){const who=DB.merchant.contact||'店铺管理员';const items=ED.items.map(x=>({skuId:x.skuId,orig:x.orig,price:+(+x.price).toFixed(2),limit:x.limit}));
    if(ED.isNew){const a={id:'AC'+seq(),fund:1,name:ED.name,start:ED.start,end:ED.end,status:0,createdBy:who,createdAt:ts(),updatedAt:ts(),items,logs:[{t:ts(),who,act:'创建活动',d:`${items.length} 个 SKU · ${ED.start} ~ ${ED.end}`}]};a.status=calcStatus(a);DB.promos.unshift(a);promoBack();toast(`活动「${a.name}」已提交，${a.status==1?'已生效':'将于 '+a.start+' 自动开始'}`,'ok');return;}
    const a=DB.promos.find(x=>x.id==ED.id);const before=a.items.map(x=>x.skuId);const after=items.map(x=>x.skuId);const added=after.filter(x=>!before.includes(x)),removed=before.filter(x=>!after.includes(x));const chg=[];
    if(a.name!=ED.name)chg.push(`名称「${a.name}」→「${ED.name}」`);if(a.start!=ED.start)chg.push(`开始 ${a.start} → ${ED.start}`);if(a.end!=ED.end)chg.push(`结束 ${a.end} → ${ED.end}`);if(added.length)chg.push(`新增 SKU ${added.join('、')}`);if(removed.length)chg.push(`移除 SKU ${removed.join('、')}`);
    a.items.forEach(o=>{const n=items.find(x=>x.skuId==o.skuId);if(n&&(n.price!=o.price||n.limit!=o.limit))chg.push(`${o.skuId} 活动价 ${money(o.price)}→${money(n.price)} / 限购 ${lim(o.limit)}→${lim(n.limit)}`);});
    a.name=ED.name;a.start=ED.start;a.end=ED.end;a.items=items;a.updatedAt=ts();a.status=calcStatus(a);(a.logs=a.logs||[]).push({t:ts(),who,act:'编辑活动',d:chg.join('；')||'无字段变化'});
    const id=a.id;promoBack();toast(`活动「${a.name}」已保存${removed.length&&a.status==1?'，移除的 SKU 已恢复原价':''}`,'ok');}

  /* 导入活动价（P1）：模板 3 列 SKU 编码 / 活动价(未税) / 限购 */
  window.promoImportOk=function(){const g=id=>(document.getElementById(id)||{}).value||'';const nm=g('pi-name'),st=fromLocal(g('pi-start')),en=fromLocal(g('pi-end'));closeModal();act_promoEdit();ED.name=nm;if(st)ED.start=st;if(en)ED.end=en;
    // 演示：模板 3 行匹配到本店在售 SKU，写入编辑页待确认
    [['SKU8820',2.60,null],['SKU8822',49.00,5],['SKU8830',5.90,null]].forEach(r=>{const f=findSku(r[0]);if(!f||occupiedBy(r[0],{start:ED.start,end:ED.end},null))return;ED.items.push({skuId:r[0],orig:f.s.price||0,price:r[1],limit:r[2],locked:false});});render();toast(`导入校验通过：${ED.items.length} 行 SKU 已带入，请确认后提交`,'ok');};
  window.act_promoImport=function(){modal(`<div class="mc-hd"><h3>导入活动价</h3><button class="mc-x" onclick="closeModal()">×</button></div><div class="mc-bd">
    <div class="ib ib-b" style="margin-bottom:12px"><span class="i">ℹ️</span>先下载模板（3 列：<b>SKU 编码 / 活动价(未税) / 限购</b>，限购留空 = 不限），填好后上传；系统按 SKU 编码匹配本店在售 SKU，逐行按活动价 &lt; 售价、未被其他活动占用校验，任一行不通过整单不导入并返回错误行。</div>
    <div class="fr"><label class="fl">活动名称</label><input id="pi-name" placeholder="≤50 字"></div>
    <div class="fg2"><div class="fr"><label class="fl">开始时间</label><input type="datetime-local" id="pi-start" value="${toLocal(shift(1,0,0))}"></div><div class="fr"><label class="fl">结束时间</label><input type="datetime-local" id="pi-end" value="${toLocal(shift(7,23,59))}"></div></div>
    <div class="row" style="gap:8px;margin:6px 0 10px"><button class="btn btn-o btn-sm" onclick="toast('模板已下载：特价活动商品导入模板.xlsx','ok')">📄 下载模板</button></div>
    <div class="up" onclick="toast('演示：已选择文件 活动价.xlsx（3 行）','info')"><div class="uic">📤</div><div class="ut">点击上传 .xlsx</div><div class="us">按 SKU 编码匹配 · 单次 ≤ 500 行</div></div>
  </div><div class="mc-ft"><button class="btn btn-o" onclick="closeModal()">取消</button><button class="btn btn-p" onclick="promoImportOk()">上传并校验</button></div>`);};
})();
