/* PC · 平台活动（商家报名招商 + 单活动效果分析） —— 母方案：飞书《平台化营销产品方案（营销活动归属域框架 + 商家报名招商）》v0.1
   商家端口径（原型假设，待与平台侧拍板的项标 ⚠）：
     · 报名主体 = 登录店铺（merchantId 取登录态，忽略入参）；选品粒度 = SKU（价格/库存都在 SKU）⚠
     · 招商活动（母）由运营创建：允许玩法 + 参数范围 / 出资规则 / 准入门槛 / 报名窗口 / 活动期；商家在约束内提交报名单（子）
     · 一期玩法：特价（对齐商家特价 subType=12 模型：活动价=未税、按 SKU）· 满减（活动级 满 X 减 Y，选品为参与 SKU）
     · 准入前置：可报名列表按门槛（类目在售 SKU 数 / 近 30 天违规 / 黑名单）先算，不符合置灰并给原因——不让商家填完才被预筛挡回
     · 玩法参数用母活动范围做默认值（推荐折扣预填、越界前端即拦）；承诺库存 = 活动期总量（件）⚠，≥ 母活动最低承诺；不锁普通售卖库存
     · 出资：来自母活动（平台 / 商家 / 共担·平台承担比例统一）⚠；报名页实时算「预计优惠 / 商家承担 / 平台承担 / 优惠后佣金 / 预计到手」
     · 佣金按活动价成交额计（对齐商家特价假设）⚠
     · 状态：草稿 → 已提交(预筛) → 预筛未过 / 待终审 → 已驳回 / 已通过 → 履约（待生效 / 进行中 / 已结束）；旁支：撤回（待终审 & 已通过未开始）、平台下架
     · 终审粒度 = 商品行（部分通过：剔除行带原因）⚠；驳回 / 预筛未过后「修改并重报」= 原单新版本（报名单号不变、版本 +1）
     · 效果分析：仅给商家自己看；数据来自本店订单 + 成本流水，不依赖 C 端埋点；进行中每小时更新、结束 T+1 定版
   依赖 inline 全局：DB / money / toast / modal / modalWide / closeModal / askConfirm / drawer / closeDrawer / nav / render / ts /
                     taxRate / skuCommInfo / skuFullName / pipe */
(function(){
  const pad=n=>(''+n).padStart(2,'0');
  const fmt=d=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  const shift=(days,h,m)=>{const d=new Date();d.setDate(d.getDate()+days);d.setHours(h,m||0,0,0);return fmt(d);};
  const dayStr=days=>shift(days,0,0).slice(0,10);
  const nowStr=()=>fmt(new Date());
  const md=s=>s.slice(5,10);   // 'YYYY-MM-DD hh:mm' → 'MM-DD'
  const seq=()=>{DB.enrollSeq=(DB.enrollSeq||930)+1;return DB.enrollSeq;};
  const who=()=>DB.merchant.contact||'店铺管理员';
  const pct=x=>Math.round(x*100)+'%';
  const num=n=>(+n||0).toLocaleString('en-US');

  /* ===== 种子：招商活动（母，运营发布）===== */
  function ensure(){
    if(DB.campaigns)return;
    DB.campaigns=[
      {id:'CP2609',name:'9 月「叶菜季」会场',theme:'首页「新鲜严选」专区曝光 + 搜索加权，主推叶菜类',
        enrollStart:shift(-6,9,0),enrollEnd:shift(2,18,0),actStart:shift(4,0,0),actEnd:shift(11,23,59),
        gate:{cats:['新鲜蔬菜'],minSku:5,noViolation:true},
        play:{type:'special',minRate:0.6,maxRate:0.9,rec:0.85},minStock:20,
        fund:{mode:'share',platform:0.3}},
      {id:'CP2610',name:'中秋海鲜节',theme:'节前海鲜专场，会场满减 + 专题页曝光',
        enrollStart:shift(-3,9,0),enrollEnd:shift(5,18,0),actStart:shift(9,0,0),actEnd:shift(16,23,59),
        gate:{cats:['海鲜水产'],minSku:3,noViolation:true},
        play:{type:'fullcut',thresholdMax:50,amountMin:1,amountMax:10,rec:[30,3]},minStock:10,
        fund:{mode:'merchant',platform:0}},
      {id:'CP2608',name:'开学季食堂采购周',theme:'B 端食堂客户定向推送，平台补贴主推品',
        enrollStart:shift(-16,9,0),enrollEnd:shift(-9,18,0),actStart:shift(-4,0,0),actEnd:shift(2,23,59),
        gate:{cats:['新鲜蔬菜','肉禽蛋品'],minSku:3,noViolation:true},
        play:{type:'special',minRate:0.7,maxRate:0.92,rec:0.88},minStock:30,
        fund:{mode:'share',platform:0.5}},
      {id:'CP2607',name:'8 月「叶菜季」会场',theme:'首页「新鲜严选」专区曝光 + 搜索加权',
        enrollStart:'2026-07-20 09:00',enrollEnd:'2026-07-28 18:00',actStart:'2026-08-01 00:00',actEnd:'2026-08-10 23:59',
        gate:{cats:['新鲜蔬菜'],minSku:5,noViolation:true},
        play:{type:'special',minRate:0.6,maxRate:0.9,rec:0.85},minStock:20,
        fund:{mode:'share',platform:0.3}},
      {id:'CP2606',name:'7 月肉禽尝鲜周',theme:'肉禽蛋品专题',
        enrollStart:shift(-2,9,0),enrollEnd:shift(-1,18,0),actStart:shift(3,0,0),actEnd:shift(8,23,59),
        gate:{cats:['肉禽蛋品'],minSku:2,noViolation:true},
        play:{type:'special',minRate:0.7,maxRate:0.9,rec:0.85},minStock:20,
        fund:{mode:'platform',platform:1}},
    ];
    /* ===== 种子：报名单（子）——覆盖 待终审 / 预筛未过 / 已通过·进行中 / 已通过·已结束 / 已驳回 / 已撤回 ===== */
    DB.enrolls=[
      {id:'EN0921',cp:'CP2609',ver:1,status:'auditing',submittedAt:shift(-1,15,20),updatedAt:shift(-1,15,21),
        items:[{skuId:'SKU8815',orig:9.30,price:7.90,promise:120},{skuId:'SKU8817',orig:6.50,price:5.50,promise:100},{skuId:'SKU8819',orig:5.80,price:4.90,promise:60}],
        pre:{ok:true,at:shift(-1,15,21),checks:[['营销黑名单',true,'未命中'],['承诺库存',true,'3 个 SKU 均 ≥ 20 件'],['玩法参数范围',true,'活动价均在原价 60%~90% 内'],['类目准入',true,'均属新鲜蔬菜']]},
        logs:[{t:shift(-1,15,20),who:'陈志强',act:'提交报名',d:'3 个 SKU'},{t:shift(-1,15,21),who:'系统',act:'规则预筛通过',d:'转人工终审'}]},
      {id:'EN0919',cp:'CP2609',ver:1,status:'pre_fail',submittedAt:shift(-3,10,5),updatedAt:shift(-3,10,5),
        items:[{skuId:'SKU8830',orig:7.00,price:3.90,promise:15},{skuId:'SKU8820',orig:3.20,price:2.80,promise:200}],
        pre:{ok:false,at:shift(-3,10,5),checks:[['营销黑名单',true,'未命中'],['承诺库存',false,'空心菜 承诺 15 件 < 最低 20 件'],['玩法参数范围',false,'空心菜 活动价 S$3.90 低于下限 S$4.20（原价 60%）'],['类目准入',true,'均属新鲜蔬菜']]},
        logs:[{t:shift(-3,10,5),who:'陈志强',act:'提交报名',d:'2 个 SKU'},{t:shift(-3,10,5),who:'系统',act:'规则预筛未过',d:'承诺库存不足；活动价越界'}]},
      {id:'EN0915',cp:'CP2608',ver:2,status:'approved',submittedAt:shift(-11,11,0),updatedAt:shift(-10,9,30),instId:'ACT-CP2608-M0815',
        items:[{skuId:'SKU8815',orig:9.30,price:8.20,promise:150,pass:true},{skuId:'SKU8817',orig:6.50,price:5.80,promise:120,pass:true},{skuId:'SKU8820',orig:3.20,price:2.90,promise:300,pass:true},{skuId:'SKU8819',orig:5.80,price:5.20,promise:80,pass:false,why:'近 30 天最低价 S$5.00，活动价高于最低价'}],
        pre:{ok:true,at:shift(-11,11,1),checks:[['营销黑名单',true,'未命中'],['承诺库存',true,'均 ≥ 30 件'],['玩法参数范围',true,'活动价均在原价 70%~92% 内'],['类目准入',true,'均属允许类目']]},
        audit:{ok:true,at:shift(-10,9,30),by:'招商运营·Li',note:'菠菜活动价高于近 30 天最低价，剔除该行；其余 3 个 SKU 通过'},
        logs:[{t:shift(-11,11,0),who:'陈志强',act:'提交报名',d:'4 个 SKU'},{t:shift(-11,11,1),who:'系统',act:'规则预筛通过',d:'转人工终审'},{t:shift(-10,9,30),who:'招商运营·Li',act:'终审通过（部分）',d:'3 通过 / 1 剔除'},{t:shift(-10,9,30),who:'系统',act:'生成活动实例',d:'ACT-CP2608-M0815 · 归属=商家报名 · 出资=共担(平台 50%)'}],
        eff:{updatedAt:shift(0,new Date().getHours(),0),
          base:{qty:38,gmv:212.0},   // 活动前 7 天日均：活动商品销量(件) / 成交额(未税)
          days:[[-4,52,286.4,19],[-3,61,331.9,22],[-2,74,398.6,27],[-1,80,436.2,29],[0,33,181.7,12]],   // [相对今天的天, 销量, 成交额(未税), 订单数]
          items:{SKU8815:{sold:96,orders:41},SKU8817:{sold:88,orders:37},SKU8820:{sold:116,orders:31}}}},
      {id:'EN0902',cp:'CP2607',ver:1,status:'approved',submittedAt:'2026-07-22 14:10',updatedAt:'2026-07-24 10:00',instId:'ACT-CP2607-M0815',
        items:[{skuId:'SKU8815',orig:9.00,price:7.60,promise:200,pass:true},{skuId:'SKU8817',orig:6.30,price:5.40,promise:150,pass:true},{skuId:'SKU8830',orig:7.00,price:5.90,promise:100,pass:true}],
        pre:{ok:true,at:'2026-07-22 14:11',checks:[['营销黑名单',true,'未命中'],['承诺库存',true,'均 ≥ 20 件'],['玩法参数范围',true,'活动价均在原价 60%~90% 内'],['类目准入',true,'均属新鲜蔬菜']]},
        audit:{ok:true,at:'2026-07-24 10:00',by:'招商运营·Li',note:''},
        logs:[{t:'2026-07-22 14:10',who:'陈志强',act:'提交报名',d:'3 个 SKU'},{t:'2026-07-22 14:11',who:'系统',act:'规则预筛通过',d:'转人工终审'},{t:'2026-07-24 10:00',who:'招商运营·Li',act:'终审通过',d:'3 个 SKU 全部通过'},{t:'2026-07-24 10:00',who:'系统',act:'生成活动实例',d:'ACT-CP2607-M0815 · 出资=共担(平台 30%)'},{t:'2026-08-11 06:00',who:'系统',act:'活动结束 · 效果数据定版',d:'T+1'}],
        eff:{updatedAt:'2026-08-11 06:00',final:true,base:{qty:35,gmv:196.0},
          days:[['08-01',58,318.5,21],['08-02',66,362.4,24],['08-03',71,389.9,26],['08-04',49,269.1,18],['08-05',77,422.8,28],['08-06',83,455.7,30],['08-07',69,378.9,25],['08-08',88,483.2,32],['08-09',61,335.0,22],['08-10',44,241.6,16]],
          items:{SKU8815:{sold:238,orders:97},SKU8817:{sold:212,orders:88},SKU8830:{sold:116,orders:52}}}},
      {id:'EN0910',cp:'CP2608',ver:1,status:'rejected',submittedAt:shift(-14,16,40),updatedAt:shift(-13,11,10),
        items:[{skuId:'SKU8822',orig:58.00,price:52.00,promise:40}],
        pre:{ok:true,at:shift(-14,16,41),checks:[['营销黑名单',true,'未命中'],['承诺库存',true,'≥ 30 件'],['玩法参数范围',true,'活动价在原价 70%~92% 内'],['类目准入',true,'属允许类目']]},
        audit:{ok:false,at:shift(-13,11,10),by:'招商运营·Li',note:'冰鲜三文鱼不属于本会场主推品类（叶菜/肉禽），且承诺库存偏低；建议改报海鲜类会场'},
        logs:[{t:shift(-14,16,40),who:'陈志强',act:'提交报名',d:'1 个 SKU'},{t:shift(-14,16,41),who:'系统',act:'规则预筛通过',d:'转人工终审'},{t:shift(-13,11,10),who:'招商运营·Li',act:'终审驳回',d:'不属主推品类'}]},
      {id:'EN0905',cp:'CP2606',ver:1,status:'withdrawn',submittedAt:shift(-2,10,0),updatedAt:shift(-2,14,30),
        items:[{skuId:'SKU8823',orig:13.50,price:11.90,promise:60}],
        pre:{ok:true,at:shift(-2,10,1),checks:[['营销黑名单',true,'未命中'],['承诺库存',true,'≥ 20 件'],['玩法参数范围',true,'在范围内'],['类目准入',true,'属肉禽蛋品']]},
        logs:[{t:shift(-2,10,0),who:'陈志强',act:'提交报名',d:'1 个 SKU'},{t:shift(-2,10,1),who:'系统',act:'规则预筛通过',d:'转人工终审'},{t:shift(-2,14,30),who:'陈志强',act:'撤回报名',d:'鸡胸肉商品仍在审核中，先撤回'}]},
    ];
  }
  window.ensureEnrolls=ensure;
  const isAdmin=()=>DB.promoAdmin!==false;   // 与商品特价同口径：仅店铺管理员可写，子账号只读（一期无「商家营销员」角色承载体）
  const noPerm=()=>{toast('仅店铺管理员可操作平台活动报名，子账号只读','err');return false;};

  /* ===== 母活动阶段 / 报名单状态 ===== */
  const cpOf=id=>{ensure();return DB.campaigns.find(c=>c.id==id);};
  function phase(c){const n=nowStr();if(n<c.enrollStart)return 'soon';if(n<=c.enrollEnd)return 'open';if(n<c.actStart)return 'closed';if(n<=c.actEnd)return 'running';return 'ended';}
  const PH={soon:['未开放报名','t-gr'],open:['报名中','t-g'],closed:['报名截止','t-y'],running:['活动进行中','t-b'],ended:['已结束','t-gr']};
  const phTag=c=>{const p=PH[phase(c)];return `<span class="tag ${p[1]}"><span class="dot"></span>${p[0]}</span>`;};
  const ST={draft:['草稿','t-gr'],pre_fail:['预筛未过','t-r'],auditing:['待终审','t-b'],rejected:['已驳回','t-r'],approved:['已通过','t-g'],withdrawn:['已撤回','t-gr'],offline:['平台下架','t-r']};
  function stTag(e){const s=ST[e.status];let suf='';if(e.status=='approved'){const p=phase(cpOf(e.cp));suf=p=='running'?'·进行中':p=='ended'?'·已结束':'·待生效';}return `<span class="tag ${s[1]}"><span class="dot"></span>${s[0]}${suf}</span>`;}
  const playName=c=>c.play.type=='special'?'商品特价':'会场满减';
  const fundTxt=c=>c.fund.mode=='platform'?'平台 100%':c.fund.mode=='merchant'?'商家 100%':`共担 · 平台 ${pct(c.fund.platform)} / 商家 ${pct(1-c.fund.platform)}`;
  const playRange=c=>c.play.type=='special'?`活动价 = 原价 ${pct(c.play.minRate)} ~ ${pct(c.play.maxRate)}（推荐 ${pct(c.play.rec)}）`:`满 ≤ S$${c.play.thresholdMax} 减 S$${c.play.amountMin} ~ ${c.play.amountMax}（推荐 满 ${c.play.rec[0]} 减 ${c.play.rec[1]}）`;
  const canWithdraw=e=>e.status=='auditing'||(e.status=='approved'&&phase(cpOf(e.cp))!='running'&&phase(cpOf(e.cp))!='ended');
  const canRedo=e=>['pre_fail','rejected','draft'].includes(e.status)&&phase(cpOf(e.cp))=='open';
  const hasEff=e=>e.status=='approved'&&!!e.eff&&['running','ended'].includes(phase(cpOf(e.cp)));

  /* ===== SKU / 准入 ===== */
  function findSku(skuId){for(let i=0;i<DB.products.length;i++){const p=DB.products[i];const k=(p.skus||[]).findIndex(s=>s.skuId==skuId);if(k>=0)return {p,s:p.skus[k],i,k};}return null;}
  const onsale=(p,s)=>p.status=='onsale'&&!s.off&&!s.recycled&&!s.review;
  const low30=(s)=>+((s.price||0)*0.93).toFixed(2);   // 演示：近 30 天最低价 = 现价 93%（真实取商品域价格历史）
  function onsaleCount(cat){let n=0;DB.products.forEach(p=>{if(p.cat!=cat)return;(p.skus||[]).forEach(s=>{if(onsale(p,s))n++;});});return n;}
  function eligibility(c){const rs=[];if(DB.merchant.mktBlacklisted)rs.push('店铺在营销黑名单中');
    const n=c.gate.cats.reduce((a,cat)=>a+onsaleCount(cat),0);if(n<c.gate.minSku)rs.push(`${c.gate.cats.join(' / ')}在售 SKU ${n} 个，需 ≥ ${c.gate.minSku} 个`);
    if(c.gate.noViolation&&(DB.merchant.violation30||0)>0)rs.push(`近 30 天违规 ${DB.merchant.violation30} 次，需为 0`);
    return {ok:!rs.length,reasons:rs};}
  const gateTxt=c=>`${c.gate.cats.join(' / ')} 在售 SKU ≥ ${c.gate.minSku}${c.gate.noViolation?' · 近 30 天 0 违规':''}`;
  const myEnrollOf=c=>{ensure();return DB.enrolls.find(e=>e.cp==c.id&&['auditing','approved','draft'].includes(e.status))||null;};

  /* ===== 金额（特价行）===== */
  function calc(c,it){const f=findSku(it.skuId);const p=f?f.p:null;const rate=p?taxRate(p):9;const factor=1+rate/100;const ci=p?skuCommInfo(p):{svc:0,pickup:0};
    const price=+it.price||0,orig=+it.orig||0,promise=+it.promise||0;const cut=orig>price?orig-price:0;
    const incl=price*factor,comm=incl*ci.svc,inc=incl-comm-ci.pickup+cut*(c.fund.platform||0)*factor;   // 预计到手/件 = 活动含税价 − 佣金 − 揽收费 + 平台承担/件（含税）
    const total=cut*promise,plat=total*(c.fund.platform||0),mine=total-plat;
    return {rate,factor,incl,comm,inc,cut,total,plat,mine,svc:ci.svc,min:+(orig*c.play.minRate).toFixed(2),max:+(orig*c.play.maxRate).toFixed(2)};}
  const sumBy=(c,items)=>items.reduce((o,x)=>{const k=calc(c,x);o.total+=k.total;o.plat+=k.plat;o.mine+=k.mine;return o;},{total:0,plat:0,mine:0});

  /* ===== 页面：两个 Tab（可报名活动 / 我的报名）===== */
  window.enrollTodo=function(){ensure();return DB.enrolls.filter(e=>['pre_fail','rejected'].includes(e.status)&&phase(cpOf(e.cp))=='open').length;};
  PAGES['m-enroll']=()=>{ensure();
    if(DB.enrollView=='edit')return editPage();
    const v=DB.enrollTab||'cp';
    return `<div class="card"><div class="card-hd" style="flex-wrap:wrap;gap:10px">
      <div class="tabs" style="margin:0;border:none">
        <div class="tab ${v=='cp'?'active':''}" onclick="DB.enrollTab='cp';render()">可报名活动${(()=>{const n=DB.campaigns.filter(c=>phase(c)=='open'&&eligibility(c).ok&&!myEnrollOf(c)).length;return n?` <span class="tag t-g" style="font-size:10px;margin-left:2px">${n}</span>`:'';})()}</div>
        <div class="tab ${v=='my'?'active':''}" onclick="DB.enrollTab='my';render()">我的报名${(()=>{const n=enrollTodo();return n?` <span class="tag t-y" style="font-size:10px;margin-left:2px">${n}</span>`:'';})()}</div>
      </div>
      <span style="font-size:12.5px;color:var(--ts)">平台运营发布招商会场 → 商家选品报名 → 规则预筛 + 人工终审 → 通过后到点自动生效 · 出资方式以各会场为准</span>
    </div>${v=='cp'?cpList():myList()}</div>`;};

  /* --- Tab 1：可报名活动（母活动）--- */
  function cpList(){const rows=DB.campaigns.slice().sort((a,b)=>{const o={open:0,soon:1,closed:2,running:3,ended:4};return o[phase(a)]-o[phase(b)]||(a.enrollEnd<b.enrollEnd?-1:1);});
    return `<div class="card-bd flush"><div style="overflow-x:auto"><table>
      <thead><tr><th>会场</th><th>玩法 · 参数范围</th><th>出资方式</th><th>准入门槛</th><th>报名截止</th><th>活动时间</th><th>会场状态</th><th>我的资格</th><th>操作</th></tr></thead><tbody>
      ${rows.map(c=>{const ph=phase(c);const el=eligibility(c);const mine=myEnrollOf(c);
        return `<tr>
        <td><b>${c.name}</b><div style="font-size:11.5px;color:var(--ts);max-width:260px;white-space:normal">${c.theme}</div><div class="mono" style="font-size:11px;color:var(--tt)">${c.id}</div></td>
        <td style="white-space:normal;max-width:240px"><span class="tag ${c.play.type=='special'?'t-r':'t-b'}" style="font-size:10.5px">${playName(c)}</span><div style="font-size:11.5px;color:var(--ts);margin-top:3px">${playRange(c)}</div><div style="font-size:11.5px;color:var(--ts)">承诺库存 ≥ ${c.minStock} 件/SKU</div></td>
        <td style="white-space:nowrap">${fundTxt(c)}</td>
        <td style="white-space:normal;max-width:200px;font-size:12px">${gateTxt(c)}</td>
        <td style="white-space:nowrap">${c.enrollEnd}${ph=='open'?`<div style="font-size:11px;color:var(--y)">${(()=>{const h=Math.max(0,Math.round((new Date(c.enrollEnd.replace(' ','T'))-new Date())/3600000));return h>=48?`剩 ${Math.floor(h/24)} 天`:`剩 ${h} 小时`;})()}</div>`:''}</td>
        <td style="white-space:nowrap;font-size:12px">${md(c.actStart)} ~ ${md(c.actEnd)}</td>
        <td>${phTag(c)}</td>
        <td style="white-space:normal;max-width:220px">${!['open','soon'].includes(ph)?'<span style="color:var(--tt)">—</span>':el.ok?'<span class="tag t-g" style="font-size:10.5px">符合</span>':`<span class="tag t-y" style="font-size:10.5px">不符合</span>${el.reasons.map(r=>`<div style="font-size:11.5px;color:var(--y)">${r}</div>`).join('')}`}</td>
        <td style="white-space:nowrap">${mine?`<span style="font-size:12px;color:var(--ts)">已报名 </span><button class="btn btn-link" onclick="act_enDetail('${mine.id}')">${ST[mine.status][0]}</button>`
          :ph=='open'?(el.ok&&isAdmin()?`<button class="btn btn-p btn-sm" onclick="act_enNew('${c.id}')">立即报名</button>`:`<button class="btn btn-o btn-sm" disabled title="${el.ok?'仅店铺管理员可报名':el.reasons.join('；')}">立即报名</button>`)
          :ph=='soon'?`<span style="font-size:12px;color:var(--ts)">${md(c.enrollStart)} 开放</span>`:'<span style="color:var(--tt)">—</span>'}
          <button class="btn btn-link" onclick="act_cpDetail('${c.id}')">会场详情</button></td>
      </tr>`;}).join('')||`<tr><td colspan="9"><div class="empty"><div class="e-ic">📣</div><div class="e-t">暂无招商活动</div><div class="e-s">平台发布招商会场后会出现在这里，符合门槛即可报名</div></div></td></tr>`}
      </tbody></table></div></div>`;}

  window.act_cpDetail=function(id){const c=cpOf(id);if(!c)return;const el=eligibility(c);const mine=myEnrollOf(c);const ph=phase(c);
    drawer(`<div class="mc-hd"><div><h3>${c.name} <span class="mono" style="font-size:12px;color:var(--ts);font-weight:400;margin-left:6px">${c.id}</span></h3><p>${phTag(c)} <span style="margin-left:8px">${c.theme}</span></p></div><button class="mc-x" onclick="closeDrawer()">×</button></div>
    <div class="mc-bd">
      <h4 style="margin:0 0 8px;font-size:13.5px">会场规则</h4>
      <div class="fg2" style="margin-bottom:14px">
        <div><div style="font-size:12px;color:var(--ts)">报名窗口</div><div>${c.enrollStart} ~ ${c.enrollEnd}</div></div>
        <div><div style="font-size:12px;color:var(--ts)">活动时间（履约期）</div><div>${c.actStart} ~ ${c.actEnd}</div></div>
        <div><div style="font-size:12px;color:var(--ts)">允许玩法 · 参数范围</div><div><b>${playName(c)}</b><div style="font-size:12px;color:var(--ts)">${playRange(c)}</div></div></div>
        <div><div style="font-size:12px;color:var(--ts)">出资方式</div><div><b>${fundTxt(c)}</b><div style="font-size:12px;color:var(--ts)">${c.fund.mode=='platform'?'优惠全部由平台补贴，按活动价成交，平台承担部分随结算补给商家':c.fund.mode=='merchant'?'优惠全部由商家承担，已体现在活动价成交额中':'优惠按比例分摊；平台承担部分随结算补给商家'}</div></div></div>
        <div><div style="font-size:12px;color:var(--ts)">准入门槛</div><div>${gateTxt(c)}</div></div>
        <div><div style="font-size:12px;color:var(--ts)">承诺库存</div><div>每个 SKU ≥ ${c.minStock} 件（活动期总量）</div></div>
      </div>
      <h4 style="margin:0 0 8px;font-size:13.5px">我的资格</h4>
      ${el.ok?`<div class="ib ib-g" style="margin-bottom:12px"><span class="i">✅</span>本店符合准入门槛：${c.gate.cats.join(' / ')}在售 SKU ${c.gate.cats.reduce((a,cat)=>a+onsaleCount(cat),0)} 个</div>`:`<div class="ib ib-y" style="margin-bottom:12px"><span class="i">⚠️</span><div>本店暂不符合：${el.reasons.join('；')}<div style="font-size:12px;margin-top:2px">补足在售 SKU 后可在报名截止前重新报名。</div></div></div>`}
      <div style="font-size:11.5px;color:var(--ts)">通过后系统按报名单生成活动实例，到活动开始时间自动生效、结束自动恢复原价；活动期内平台可因违规下架报名。</div>
    </div>
    <div class="mc-ft"><span style="flex:1"></span><button class="btn btn-o" onclick="closeDrawer()">关闭</button>${mine?`<button class="btn btn-p" onclick="closeDrawer();act_enDetail('${mine.id}')">查看我的报名</button>`:ph=='open'&&el.ok&&isAdmin()?`<button class="btn btn-p" onclick="closeDrawer();act_enNew('${c.id}')">立即报名</button>`:''}</div>`);};

  /* --- Tab 2：我的报名 --- */
  const MY_TABS=[['all','全部'],['auditing','待终审'],['pre_fail','预筛未过'],['rejected','已驳回'],['approved','已通过'],['draft','草稿'],['closed','已撤回/下架']];
  function myRows(){const f=DB.enrollFilter||{};const t=DB.enrollMyTab||'all';
    return DB.enrolls.filter(e=>t=='all'||(t=='closed'?['withdrawn','offline'].includes(e.status):e.status==t))
      .filter(e=>!f.q||e.id.includes(f.q)||cpOf(e.cp).name.includes(f.q))
      .sort((a,b)=>b.updatedAt<a.updatedAt?-1:1);}
  function myList(){const f=DB.enrollFilter||(DB.enrollFilter={});const t=DB.enrollMyTab||'all';const rows=myRows();
    const cnt=k=>DB.enrolls.filter(e=>k=='all'||(k=='closed'?['withdrawn','offline'].includes(e.status):e.status==k)).length;
    return `<div class="card-bd" style="display:flex;gap:16px;align-items:flex-end;flex-wrap:wrap;padding:12px 16px;border-bottom:1px solid var(--bd2)">
      <div><div style="font-size:12px;color:var(--ts);margin-bottom:5px">报名单号 / 会场名称</div><input id="en-q" value="${f.q||''}" placeholder="输入报名单号或会场" style="min-width:240px" onkeydown="if(event.key=='Enter')enQuery()"></div>
      <button class="btn btn-p btn-sm" onclick="enQuery()">查询</button><button class="btn btn-o btn-sm" onclick="DB.enrollFilter={};render()">重置</button>
    </div>
    <div class="tabs" style="padding:0 16px">${MY_TABS.map(x=>`<div class="tab ${t==x[0]?'active':''}" onclick="DB.enrollMyTab='${x[0]}';render()">${x[1]}${cnt(x[0])?` <span class="tag ${x[0]=='pre_fail'||x[0]=='rejected'?'t-r':x[0]=='approved'?'t-g':'t-gr'}" style="font-size:10px;margin-left:2px">${cnt(x[0])}</span>`:''}</div>`).join('')}</div>
    <div class="card-bd flush"><div style="overflow-x:auto"><table>
      <thead><tr><th>报名单号</th><th>会场</th><th>玩法</th><th>活动时间</th><th>商品数</th><th>承诺库存</th><th>出资方式</th><th>状态</th><th>提交时间</th><th>更新时间</th><th>操作</th></tr></thead><tbody>
      ${rows.map(e=>{const c=cpOf(e.cp);const passed=e.items.filter(x=>x.pass!==false);const promise=e.items.reduce((n,x)=>n+(+x.promise||0),0);
        return `<tr>
        <td class="mono">${e.id}${e.ver>1?`<div style="font-size:10.5px;color:var(--ts)">v${e.ver}</div>`:''}</td>
        <td><b>${c.name}</b><div class="mono" style="font-size:11px;color:var(--tt)">${c.id}</div></td>
        <td><span class="tag ${c.play.type=='special'?'t-r':'t-b'}" style="font-size:10.5px">${playName(c)}</span>${c.play.type=='fullcut'&&e.fullcut?`<div style="font-size:11.5px;color:var(--ts)">满 ${e.fullcut[0]} 减 ${e.fullcut[1]}</div>`:''}</td>
        <td style="white-space:nowrap;font-size:12px">${md(c.actStart)} ~ ${md(c.actEnd)}</td>
        <td>${e.items.length}${e.status=='approved'&&passed.length<e.items.length?` <span class="tag t-y" style="font-size:10px" title="终审剔除 ${e.items.length-passed.length} 个 SKU">${passed.length} 通过</span>`:''}</td>
        <td>${num(promise)} 件</td>
        <td style="white-space:nowrap;font-size:12px">${fundTxt(c)}</td>
        <td>${stTag(e)}${e.status=='rejected'&&e.audit?`<div style="font-size:11px;color:var(--r);max-width:200px;white-space:normal">${e.audit.note}</div>`:''}${e.status=='pre_fail'?`<div style="font-size:11px;color:var(--r);max-width:200px;white-space:normal">${e.pre.checks.filter(x=>!x[1]).map(x=>x[0]).join('、')}未过</div>`:''}</td>
        <td style="font-size:11.5px;color:var(--ts);white-space:nowrap">${e.submittedAt||'—'}</td><td style="font-size:11.5px;color:var(--ts);white-space:nowrap">${e.updatedAt||'—'}</td>
        <td style="white-space:nowrap">${hasEff(e)?`<button class="btn btn-o btn-sm" onclick="act_enEffect('${e.id}')">效果</button> `:''}${isAdmin()&&canRedo(e)?`<button class="btn btn-o btn-sm" onclick="act_enRedo('${e.id}')">${e.status=='draft'?'继续填写':'修改并重报'}</button> `:''}${isAdmin()&&canWithdraw(e)?`<button class="btn btn-link btn-sm" style="color:var(--r)" onclick="act_enWithdraw('${e.id}')">撤回</button> `:''}<button class="btn btn-link" onclick="act_enDetail('${e.id}')">详情</button></td>
      </tr>`;}).join('')||`<tr><td colspan="11"><div class="empty"><div class="e-ic">📝</div><div class="e-t">${t=='all'?'还没有报名记录':'该状态下暂无报名单'}</div><div class="e-s">到「可报名活动」选择符合门槛的会场，选品并填写活动价与承诺库存即可报名</div>${t=='all'?`<div style="margin-top:10px"><button class="btn btn-p btn-sm" onclick="DB.enrollTab='cp';render()">去看可报名活动</button></div>`:''}</div></td></tr>`}
      </tbody></table></div></div>`;}
  window.enQuery=function(){DB.enrollFilter={q:((document.getElementById('en-q')||{}).value||'').trim()};render();};

  /* ===== 详情抽屉 ===== */
  const STEPS=['提交报名','规则预筛','人工终审','活动生效','活动结束'];
  function stepIdx(e){const ph=e.status=='approved'?phase(cpOf(e.cp)):'';
    if(e.status=='draft')return [0,-1];if(e.status=='pre_fail')return [1,1];if(e.status=='auditing')return [2,-1];if(e.status=='rejected')return [2,2];
    if(e.status=='withdrawn')return [e.audit?3:2,-1];if(e.status=='offline')return [3,3];
    if(ph=='ended')return [5,-1];if(ph=='running')return [3,-1];return [3,-1];}
  window.act_enDetail=function(id){ensure();const e=DB.enrolls.find(x=>x.id==id);if(!e)return;const c=cpOf(e.cp);const [cur,rej]=stepIdx(e);const sum=sumBy(c,e.items.filter(x=>x.pass!==false));
    drawer(`<div class="mc-hd"><div><h3>${c.name} <span class="mono" style="font-size:12px;color:var(--ts);font-weight:400;margin-left:6px">${e.id}${e.ver>1?' · v'+e.ver:''}</span></h3><p>${stTag(e)} <span style="margin-left:8px">活动 ${c.actStart} ~ ${c.actEnd}</span></p></div><button class="mc-x" onclick="closeDrawer()">×</button></div>
    <div class="mc-bd">
      <div style="margin-bottom:14px">${pipe(STEPS,cur,rej)}</div>
      ${e.status=='pre_fail'?`<div class="ib ib-r" style="margin-bottom:12px"><span class="i">⛔</span><div><b>规则预筛未过</b>：${e.pre.checks.filter(x=>!x[1]).map(x=>x[2]).join('；')}<div style="font-size:12px;margin-top:2px">${phase(c)=='open'?'修改后可在报名截止（'+c.enrollEnd+'）前重报，报名单号不变。':'报名窗口已关闭，本次不可重报。'}</div></div></div>`:''}
      ${e.status=='rejected'?`<div class="ib ib-r" style="margin-bottom:12px"><span class="i">⛔</span><div><b>终审驳回</b>（${e.audit.by} · ${e.audit.at}）：${e.audit.note}<div style="font-size:12px;margin-top:2px">${phase(c)=='open'?'按驳回理由修改后可重报。':'报名窗口已关闭，本次不可重报。'}</div></div></div>`:''}
      ${e.status=='auditing'?`<div class="ib ib-b" style="margin-bottom:12px"><span class="i">ℹ️</span>预筛已通过，等待运营人工终审（承诺 4 小时内）。终审前可撤回；通过后到 ${c.actStart} 自动生效。</div>`:''}
      ${e.status=='approved'&&e.audit&&e.audit.note?`<div class="ib ib-y" style="margin-bottom:12px"><span class="i">⚠️</span><div><b>部分通过</b>（${e.audit.by} · ${e.audit.at}）：${e.audit.note}</div></div>`:''}
      ${e.status=='approved'&&phase(c)=='running'?`<div class="ib ib-g" style="margin-bottom:12px"><span class="i">✅</span>活动进行中，C 端按活动价展示；活动内 SKU 改价须高于活动价、下架即该行不生效。已生效的活动不可撤回，如需下架请联系平台运营。</div>`:''}
      ${e.status=='offline'?`<div class="ib ib-r" style="margin-bottom:12px"><span class="i">⛔</span><div><b>平台下架</b>：${e.offlineReason||''}<div style="font-size:12px;margin-top:2px">对应活动实例已作废，C 端已恢复原价。</div></div></div>`:''}
      <div class="fg2" style="margin-bottom:12px">
        <div><div style="font-size:12px;color:var(--ts)">玩法</div><div><b>${playName(c)}</b>${c.play.type=='fullcut'&&e.fullcut?` · 满 S$${e.fullcut[0]} 减 S$${e.fullcut[1]}`:''}</div></div>
        <div><div style="font-size:12px;color:var(--ts)">出资方式</div><div><b>${fundTxt(c)}</b></div></div>
        ${c.play.type=='special'?`<div><div style="font-size:12px;color:var(--ts)">预计优惠总额（按承诺库存）</div><div>${money(sum.total)}</div></div>
        <div><div style="font-size:12px;color:var(--ts)">商家承担 / 平台承担</div><div><b>${money(sum.mine)}</b> <span style="color:var(--ts)">/ ${money(sum.plat)}</span></div></div>`:''}
        ${e.instId?`<div><div style="font-size:12px;color:var(--ts)">活动实例</div><div class="mono" style="font-size:12.5px">${e.instId}</div></div>`:''}
        <div><div style="font-size:12px;color:var(--ts)">提交</div><div>${e.submittedAt||'—'}</div></div>
      </div>
      <h4 style="margin:6px 0 8px;font-size:13.5px">规则预筛 ${e.pre?`<span style="font-weight:400;color:var(--ts);font-size:12px">${e.pre.at}</span>`:''}</h4>
      ${e.pre?`<table class="subtbl" style="margin-bottom:12px"><tbody>${e.pre.checks.map(x=>`<tr><td style="width:120px">${x[0]}</td><td>${x[1]?'<span class="tag t-g" style="font-size:10px">通过</span>':'<span class="tag t-r" style="font-size:10px">未过</span>'}</td><td style="color:${x[1]?'var(--ts)':'var(--r)'}">${x[2]}</td></tr>`).join('')}</tbody></table>`:'<div style="color:var(--tt);font-size:12.5px;margin-bottom:12px">提交后自动执行</div>'}
      <h4 style="margin:6px 0 8px;font-size:13.5px">报名商品 <span style="font-weight:400;color:var(--ts);font-size:12px">${e.items.length} 个 SKU · 承诺库存合计 ${num(e.items.reduce((n,x)=>n+(+x.promise||0),0))} 件</span></h4>
      <div style="overflow-x:auto"><table class="subtbl"><thead><tr><th>SKU 编码</th><th>商品名称</th>${c.play.type=='special'?'<th>原价(未税)</th><th>活动价(未税)</th><th>立减</th>':''}<th>承诺库存</th>${c.play.type=='special'?'<th>商家承担</th>':''}<th>${e.status=='approved'?'终审':'状态'}</th></tr></thead><tbody>
        ${e.items.map(x=>{const f=findSku(x.skuId);const k=calc(c,x);return `<tr style="${x.pass===false?'opacity:.6':''}"><td class="mono">${x.skuId}</td><td>${f?skuFullName(f.p,f.s):'—'}</td>${c.play.type=='special'?`<td><s style="color:var(--tt)">${money(x.orig)}</s></td><td><b style="color:var(--r)">${money(x.price)}</b></td><td style="color:var(--r)">−${money(k.cut)}</td>`:''}<td>${num(x.promise)} 件</td>${c.play.type=='special'?`<td>${money(k.mine)}</td>`:''}<td>${x.pass===false?`<span class="tag t-y" style="font-size:10px" title="${x.why||''}">剔除</span><div style="font-size:11px;color:var(--y);white-space:normal;max-width:180px">${x.why||''}</div>`:e.status=='approved'?'<span class="tag t-g" style="font-size:10px">通过</span>':'<span style="color:var(--tt)">—</span>'}</td></tr>`;}).join('')}
      </tbody></table></div>
      ${c.play.type=='special'?`<div style="font-size:11.5px;color:var(--ts);margin:8px 0 14px">商家承担 = (原价 − 活动价) × 承诺库存 × 商家出资比例，为按承诺库存估算的上限；实际以核销成本流水为准。佣金按活动价成交额计。</div>`:`<div style="font-size:11.5px;color:var(--ts);margin:8px 0 14px">满减优惠在订单核销时按出资比例记成本流水；实际承担金额以核销为准。</div>`}
      <h4 style="margin:6px 0 8px;font-size:13.5px">操作日志</h4>
      ${(e.logs||[]).slice().reverse().map(l=>`<div style="display:flex;gap:10px;padding:7px 0;border-bottom:1px dashed var(--bd2);font-size:12.5px"><span style="color:var(--ts);white-space:nowrap">${l.t}</span><span style="white-space:nowrap"><b>${l.who}</b> · ${l.act}</span><span style="color:var(--ts)">${l.d||''}</span></div>`).join('')||'<div style="color:var(--tt);font-size:12.5px">暂无</div>'}
    </div>
    <div class="mc-ft">${e.status=='auditing'?`<button class="btn btn-link btn-sm" style="color:var(--tt)" onclick="closeDrawer();en_demoAudit('${e.id}')">🔬 演示 · 模拟运营终审</button>`:''}<span style="flex:1"></span>
      ${!isAdmin()?`<span style="font-size:12px;color:var(--ts)">子账号只读</span>`:''}
      <button class="btn btn-o" onclick="closeDrawer()">关闭</button>
      ${isAdmin()&&canWithdraw(e)?`<button class="btn btn-o" style="color:var(--r);border-color:var(--r)" onclick="closeDrawer();act_enWithdraw('${e.id}')">撤回报名</button>`:''}
      ${isAdmin()&&canRedo(e)?`<button class="btn btn-p" onclick="closeDrawer();act_enRedo('${e.id}')">${e.status=='draft'?'继续填写':'修改并重报'}</button>`:''}
      ${hasEff(e)?`<button class="btn btn-p" onclick="closeDrawer();act_enEffect('${e.id}')">查看效果</button>`:''}
    </div>`);};

  /* 演示：模拟运营终审（通过 / 部分通过 / 驳回）——真实由平台运营后台操作，商家端只收结果 */
  window.en_demoAudit=function(id){const e=DB.enrolls.find(x=>x.id==id);if(!e)return;const c=cpOf(e.cp);
    modal(`<div class="mc-hd"><h3>演示 · 模拟运营终审</h3><button class="mc-x" onclick="closeModal()">×</button></div><div class="mc-bd"><div style="font-size:13px;margin-bottom:10px">此操作在<b>平台运营后台</b>完成，这里仅演示商家端收到结果后的状态与通知。</div>
      <div class="row" style="gap:8px;flex-wrap:wrap"><button class="btn btn-p btn-sm" onclick="en_audit('${id}','ok')">全部通过</button><button class="btn btn-o btn-sm" onclick="en_audit('${id}','part')">部分通过（剔除首个 SKU）</button><button class="btn btn-o btn-sm" style="color:var(--r)" onclick="en_audit('${id}','no')">驳回</button></div></div>`);};
  window.en_audit=function(id,how){closeModal();const e=DB.enrolls.find(x=>x.id==id);const c=cpOf(e.cp);const by='招商运营·Li';
    if(how=='no'){e.status='rejected';e.audit={ok:false,at:ts(),by,note:'活动价高于近 30 天最低价，请按参考价调整后重报'};e.logs.push({t:ts(),who:by,act:'终审驳回',d:e.audit.note});toast('报名已被驳回，站内信已通知','err');}
    else{e.status='approved';e.instId=`ACT-${c.id}-M0815`;e.items.forEach((x,k)=>{x.pass=!(how=='part'&&k==0);if(!x.pass)x.why='近 30 天最低价低于活动价';});
      e.audit={ok:true,at:ts(),by,note:how=='part'?`${findSku(e.items[0].skuId).p.name}活动价高于近 30 天最低价，剔除该行；其余通过`:''};
      e.logs.push({t:ts(),who:by,act:how=='part'?'终审通过（部分）':'终审通过',d:how=='part'?`${e.items.length-1} 通过 / 1 剔除`:`${e.items.length} 个 SKU 全部通过`},{t:ts(),who:'系统',act:'生成活动实例',d:`${e.instId} · 归属=商家报名 · 出资=${fundTxt(c)}`});toast(`报名已通过，活动将于 ${c.actStart} 自动生效`,'ok');}
    e.updatedAt=ts();if(typeof enrollNotify=='function')enrollNotify(e,c);render();};

  /* ===== 撤回 ===== */
  window.act_enWithdraw=function(id){if(!isAdmin())return noPerm();const e=DB.enrolls.find(x=>x.id==id);if(!e||!canWithdraw(e))return;const c=cpOf(e.cp);
    askConfirm(`确认撤回对「<b>${c.name}</b>」的报名 ${e.id}？<br><span style="font-size:12.5px;color:var(--ts)">${e.status=='approved'?'已通过但尚未生效，撤回后活动实例作废；':'撤回后终审终止；'}报名窗口内（至 ${c.enrollEnd}）可重新报名。</span>`,()=>{e.status='withdrawn';e.updatedAt=ts();e.logs.push({t:ts(),who:who(),act:'撤回报名',d:''});render();toast(`报名 ${e.id} 已撤回`,'info');});};

  /* ===== 新建 / 重报（表单页）===== */
  let ED=null;   // {enrollId|null, cp, fullcut:[x,y], items:[{skuId,orig,price,promise}]}
  window.act_enNew=function(cpId){if(!isAdmin())return noPerm();ensure();const c=cpOf(cpId);if(!c)return;if(phase(c)!='open'){toast('不在报名开放时段','err');return;}
    const el=eligibility(c);if(!el.ok){toast('本店不符合准入门槛：'+el.reasons.join('；'),'err');return;}
    if(myEnrollOf(c)){toast('本会场已有报名单，请在「我的报名」查看','err');return;}
    ED={enrollId:null,cp:cpId,fullcut:c.play.type=='fullcut'?[...c.play.rec]:null,items:[]};DB.enrollView='edit';render();};
  window.act_enRedo=function(id){if(!isAdmin())return noPerm();const e=DB.enrolls.find(x=>x.id==id);if(!e||!canRedo(e))return;const c=cpOf(e.cp);
    ED={enrollId:e.id,cp:e.cp,fullcut:e.fullcut?[...e.fullcut]:(c.play.type=='fullcut'?[...c.play.rec]:null),items:e.items.map(x=>{const f=findSku(x.skuId);return {skuId:x.skuId,orig:f?f.s.price||x.orig:x.orig,price:x.price,promise:x.promise};})};
    DB.enrollView='edit';render();};
  window.enBack=function(){ED=null;DB.enrollView='';render();};
  function editPage(){if(!ED){DB.enrollView='';return PAGES['m-enroll']();}const c=cpOf(ED.cp);const sp=c.play.type=='special';const sum=sumBy(c,ED.items);
    return `<div style="margin-bottom:14px" class="row"><button class="btn btn-o btn-sm" onclick="enBack()">← 返回平台活动</button><span style="margin-left:12px;font-size:16px;font-weight:700">${ED.enrollId?'修改并重报 · '+ED.enrollId:'报名 · '+c.name}</span></div>
    <div class="card" style="margin-bottom:14px"><div class="card-hd"><h3>会场约束</h3><span class="sub">由平台运营设定，报名参数须在范围内</span><div class="row" style="margin-left:auto"><button class="btn btn-link btn-sm" onclick="act_cpDetail('${c.id}')">会场详情</button></div></div><div class="card-bd">
      <div class="fg3">
        <div><div style="font-size:12px;color:var(--ts)">活动时间</div><div>${c.actStart} ~ ${c.actEnd}</div></div>
        <div><div style="font-size:12px;color:var(--ts)">允许玩法 · 参数范围</div><div><b>${playName(c)}</b> <span style="font-size:12px;color:var(--ts)">${playRange(c)}</span></div></div>
        <div><div style="font-size:12px;color:var(--ts)">出资方式</div><div><b>${fundTxt(c)}</b></div></div>
        <div><div style="font-size:12px;color:var(--ts)">可报类目</div><div>${c.gate.cats.join(' / ')}</div></div>
        <div><div style="font-size:12px;color:var(--ts)">承诺库存</div><div>每 SKU ≥ ${c.minStock} 件 <span style="font-size:12px;color:var(--ts)">活动期总量，不锁定日常售卖库存</span></div></div>
        <div><div style="font-size:12px;color:var(--ts)">报名截止</div><div style="color:var(--y)">${c.enrollEnd}</div></div>
      </div>
      ${!sp?`<div class="fr" style="max-width:560px;margin-top:12px"><label class="fl"><b>*</b>满减参数</label><div class="row" style="gap:8px;align-items:center;flex:1"><span style="color:var(--ts)">满 S$</span><input type="number" step="1" min="1" max="${c.play.thresholdMax}" value="${ED.fullcut[0]}" style="max-width:110px" oninput="ED_fc(0,this.value)"><span style="color:var(--ts)">减 S$</span><input type="number" step="0.5" min="${c.play.amountMin}" max="${c.play.amountMax}" value="${ED.fullcut[1]}" style="max-width:110px" oninput="ED_fc(1,this.value)"><span style="font-size:12px;color:var(--ts)">门槛 ≤ ${c.play.thresholdMax} · 面额 ${c.play.amountMin} ~ ${c.play.amountMax}，已按推荐值预填</span></div></div>`:''}
    </div></div>
    <div class="card"><div class="card-hd"><h3>报名商品</h3><span class="sub">${ED.items.length} 个 SKU${sp?' · 活动价已按推荐折扣预填，可在范围内调整':' · 参与满减的 SKU'}</span><div class="row" style="margin-left:auto;gap:8px"><button class="btn btn-p btn-sm" onclick="act_enPick()">＋ 添加商品</button></div></div>
    <div class="card-bd flush"><div style="overflow-x:auto"><table>
      <thead><tr><th>SKU 编码</th><th>商品名称</th><th>当前未税售价</th><th>近 30 天最低价</th>${sp?`<th style="min-width:150px">活动价(未税) <b style="color:var(--r)">*</b></th><th>立减</th><th>预计到手/件</th>`:''}<th>可售库存</th><th style="min-width:120px">承诺库存(件) <b style="color:var(--r)">*</b></th>${sp?'<th>预计优惠额</th><th>商家承担</th>':''}<th>操作</th></tr></thead><tbody id="en-rows">
      ${ED.items.map((x,k)=>{const f=findSku(x.skuId);const kk=calc(c,x);const lo=f?low30(f.s):0;
        const bad=sp&&x.price!==''&&x.price!=null&&(!(+x.price>0)||+x.price<kk.min||+x.price>kk.max);const hi=sp&&+x.price>0&&+x.price>lo;
        const pbad=x.promise!==''&&x.promise!=null&&(!(+x.promise>0)||+x.promise<c.minStock);const over=f&&+x.promise>(f.s.stock||0);
        return `<tr>
        <td class="mono">${x.skuId}</td><td style="white-space:nowrap">${f?skuFullName(f.p,f.s):'—'}${f&&f.s.refund?' <span class="tag t-y" style="font-size:10px">多退少补</span>':''}</td>
        <td>${money(x.orig)}</td><td style="color:var(--ts)">${money(lo)}</td>
        ${sp?`<td><input class="miniprice" type="number" step="0.01" min="${kk.min}" max="${kk.max}" value="${x.price===''||x.price==null?'':(+x.price).toFixed(2)}" style="${bad?'border-color:var(--r)':''}" oninput="ED_price(${k},this.value)" onblur="ED_blur(${k})"><div style="font-size:11px;color:${bad?'var(--r)':'var(--ts)'}">${bad?`须在 ${money(kk.min)} ~ ${money(kk.max)}`:`范围 ${money(kk.min)} ~ ${money(kk.max)}`}</div>${!bad&&hi?`<div style="font-size:11px;color:var(--y)">高于近 30 天最低价，终审可能驳回</div>`:''}</td>
        <td style="color:var(--r)" id="en-cut-${k}">${+x.price>0?'−'+money(kk.cut):'—'}</td><td style="color:var(--gd)" id="en-inc-${k}">${+x.price>0?money(kk.inc):'—'}</td>`:''}
        <td>${f?num(f.s.stock||0):'—'}${f&&f.s.stockMode=='daily'?' <span class="tag t-g" style="font-size:10px">每日恢复</span>':f&&f.s.stockMode=='finite'?' <span class="tag t-y" style="font-size:10px">售完即止</span>':''}</td>
        <td><input class="ministock" type="number" min="${c.minStock}" step="1" value="${x.promise==null?'':x.promise}" style="${pbad?'border-color:var(--r)':''}" oninput="ED_promise(${k},this.value)" onblur="ED_blur(${k})"><div style="font-size:11px;color:${pbad?'var(--r)':'var(--ts)'}">${pbad?`须 ≥ ${c.minStock} 件`:over?'<span style="color:var(--y)">超过当前可售库存，请确保活动期补货</span>':`≥ ${c.minStock} 件`}</div></td>
        ${sp?`<td id="en-tot-${k}">${+x.price>0&&+x.promise>0?money(kk.total):'—'}</td><td id="en-mine-${k}"><b>${+x.price>0&&+x.promise>0?money(kk.mine):'—'}</b></td>`:''}
        <td><button class="btn btn-link btn-sm" style="color:var(--r)" onclick="ED_remove(${k})">移除</button></td>
      </tr>`;}).join('')||`<tr><td colspan="${sp?13:8}"><div class="empty"><div class="e-ic">🥬</div><div class="e-t">还没有添加商品</div><div class="e-s">点「添加商品」从本店 ${c.gate.cats.join(' / ')} 在售 SKU 中选择；已在其他活动中的 SKU 不可选</div></div></td></tr>`}
      </tbody></table></div></div>
    <div class="card-bd" style="border-top:1px solid var(--bd2);display:flex;justify-content:space-between;align-items:flex-end;flex-wrap:wrap;gap:10px">
      <div>${sp?`<div style="display:flex;gap:28px;flex-wrap:wrap" id="en-sum">
          <div><div style="font-size:12px;color:var(--ts)">预计优惠总额</div><div style="font-size:16px;font-weight:700">${money(sum.total)}</div></div>
          <div><div style="font-size:12px;color:var(--ts)">商家承担（${pct(1-(c.fund.platform||0))}）</div><div style="font-size:16px;font-weight:700;color:var(--r)">${money(sum.mine)}</div></div>
          <div><div style="font-size:12px;color:var(--ts)">平台承担（${pct(c.fund.platform||0)}）</div><div style="font-size:16px;font-weight:700;color:var(--gd)">${money(sum.plat)}</div></div>
        </div>
        <div style="font-size:11.5px;color:var(--ts);margin-top:6px">按承诺库存全部售出估算的上限；实际按核销记成本流水。商家承担部分已体现在活动价成交额中，平台承担部分随结算补给商家；佣金按活动价成交额计。预计到手/件 = 活动含税价 − 佣金 − 预估揽收费 + 平台承担/件。</div>`
        :`<div style="font-size:11.5px;color:var(--ts)">满减优惠在订单核销时按出资比例（${fundTxt(c)}）记成本流水；提交后即进入规则预筛。</div>`}</div>
      <div class="row" style="gap:8px"><button class="btn btn-o" onclick="enBack()">取消</button><button class="btn btn-o" onclick="act_enDraft()">保存草稿</button><button class="btn btn-p" onclick="act_enSubmit()">${ED.enrollId?'重新提交':'提交报名'}</button></div>
    </div></div>`;}
  window.ED_fc=function(i,v){ED.fullcut[i]=v===''?'':+v;};
  function setTxt(id,t){const e=document.getElementById(id);if(e)e.textContent=t;}
  function refreshSum(){const c=cpOf(ED.cp);const s=sumBy(c,ED.items);const el=document.getElementById('en-sum');if(!el)return;const vs=el.querySelectorAll('div>div:nth-child(2)');if(vs.length==3){vs[0].textContent=money(s.total);vs[1].textContent=money(s.mine);vs[2].textContent=money(s.plat);}}
  window.ED_price=function(k,v){const c=cpOf(ED.cp);const x=ED.items[k];x.price=v===''?'':+v;const kk=calc(c,x);setTxt('en-cut-'+k,+x.price>0?'−'+money(kk.cut):'—');setTxt('en-inc-'+k,+x.price>0?money(kk.inc):'—');setTxt('en-tot-'+k,+x.price>0&&+x.promise>0?money(kk.total):'—');setTxt('en-mine-'+k,+x.price>0&&+x.promise>0?money(kk.mine):'—');refreshSum();};
  window.ED_promise=function(k,v){const c=cpOf(ED.cp);const x=ED.items[k];x.promise=v===''?'':parseInt(v)||0;const kk=calc(c,x);setTxt('en-tot-'+k,+x.price>0&&+x.promise>0?money(kk.total):'—');setTxt('en-mine-'+k,+x.price>0&&+x.promise>0?money(kk.mine):'—');refreshSum();};
  window.ED_remove=function(k){ED.items.splice(k,1);render();};
  window.ED_blur=function(k){const c=cpOf(ED.cp);const x=ED.items[k];const kk=calc(c,x);const f=findSku(x.skuId);
    const key=`${+x.price<kk.min||+x.price>kk.max}|${+x.price>(f?low30(f.s):0)}|${+x.promise<c.minStock}|${f&&+x.promise>(f.s.stock||0)}`;if(x._shown!==key){x._shown=key;setTimeout(render,120);}};
  window.enFlashRow=function(k){const tr=document.querySelectorAll('#en-rows tr')[k];if(!tr)return;tr.scrollIntoView({behavior:'smooth',block:'center'});tr.style.boxShadow='inset 0 0 0 2px var(--r)';setTimeout(()=>{tr.style.boxShadow='';},2000);};

  /* 选品弹窗：仅会场允许类目的本店在售 SKU；已在其他活动（含商家特价 / 平台活动）中的置灰 */
  function occupied(skuId,c){if(typeof ensurePromos=='function')ensurePromos();const range={start:c.actStart,end:c.actEnd};
    const a=(DB.promos||[]).find(a=>[0,1].includes(a.status)&&(a.items||[]).some(x=>x.skuId==skuId)&&a.start<=range.end&&range.start<=a.end);if(a)return a.fund==0?'平台活动':`特价活动《${a.name}》`;
    const e=DB.enrolls.find(e=>e.id!=ED.enrollId&&['auditing','approved'].includes(e.status)&&e.items.some(x=>x.skuId==skuId&&x.pass!==false)&&cpOf(e.cp).actStart<=range.end&&range.start<=cpOf(e.cp).actEnd);if(e)return `报名单 ${e.id}`;return '';}
  window.act_enPick=function(){DB.enPickSel=[];DB.enPickQ='';renderPick();};
  function renderPick(){const c=cpOf(ED.cp);const q=(DB.enPickQ||'').toLowerCase();const rows=[];
    DB.products.forEach((p,i)=>{if(!c.gate.cats.includes(p.cat))return;(p.skus||[]).forEach((s,k)=>{if(!onsale(p,s))return;if(q&&!(p.name.toLowerCase().includes(q)||s.skuId.toLowerCase().includes(q)))return;rows.push({p,s,i,k});});});
    const sel=DB.enPickSel;
    modalWide(`<div class="mc-hd"><div><h3>添加报名商品</h3><p>仅本店 <b>${c.gate.cats.join(' / ')}</b> 在售 SKU · 已在其他活动中的 SKU 不可选（活动时间 ${c.actStart} ~ ${c.actEnd}）</p></div><button class="mc-x" onclick="enPickClose()">×</button></div>
    <div class="mc-bd">
      <div class="row" style="gap:8px;margin-bottom:10px"><input id="enpk-q" value="${DB.enPickQ||''}" placeholder="搜索商品名称 / SKU 编码" style="min-width:280px" onkeydown="if(event.key=='Enter'){DB.enPickQ=this.value.trim();enPickRe()}"><button class="btn btn-o btn-sm" onclick="DB.enPickQ=(document.getElementById('enpk-q')||{}).value.trim();enPickRe()">搜索</button><span style="margin-left:auto;font-size:12.5px;color:var(--ts)">已选 <b style="color:var(--tp)">${sel.length}</b></span></div>
      <div style="max-height:420px;overflow:auto"><table style="white-space:nowrap"><thead><tr><th style="width:30px"></th><th>SKU 编码</th><th>商品名称</th><th>品类</th><th>未税售价</th><th>近 30 天最低价</th><th>可售库存</th><th>可选状态</th></tr></thead><tbody>
      ${rows.map(r=>{const inEd=ED.items.some(x=>x.skuId==r.s.skuId);const occ=inEd?'':occupied(r.s.skuId,c);const dis=inEd||!!occ;const on=sel.includes(r.s.skuId);
        return `<tr style="${dis?'opacity:.55':''}"><td>${dis?'':`<input type="checkbox" ${on?'checked':''} onclick="enPickToggle('${r.s.skuId}')">`}</td><td class="mono">${r.s.skuId}</td><td>${skuFullName(r.p,r.s)}${r.s.refund?' <span class="tag t-y" style="font-size:10px">多退少补</span>':''}</td><td>${r.p.cat}</td><td>${money(r.s.price||0)}</td><td style="color:var(--ts)">${money(low30(r.s))}</td><td>${r.s.stock||0}</td>
        <td style="font-size:12px">${inEd?'<span class="tag t-gr">已在本报名单</span>':occ?`<span class="tag t-y">已在${occ}中</span>`:'<span class="tag t-g">可选</span>'}</td></tr>`;}).join('')||'<tr><td colspan="8"><div class="empty"><div class="e-t">没有匹配的在售 SKU</div><div class="e-s">只能选会场允许类目下的在售 SKU</div></div></td></tr>'}
      </tbody></table></div>
    </div>
    <div class="mc-ft"><button class="btn btn-o" onclick="enPickClose()">取消</button><button class="btn btn-p" ${sel.length?'':'disabled'} onclick="enPickOk()">加入报名（${sel.length}）</button></div>`);const mc=document.getElementById('mc');if(mc)mc.style.width='960px';}
  const unwiden=()=>{const mc=document.getElementById('mc');if(mc)mc.style.width='';};
  window.enPickRe=function(){renderPick();};
  window.enPickToggle=function(id){const a=DB.enPickSel;const k=a.indexOf(id);if(k<0)a.push(id);else a.splice(k,1);renderPick();};
  window.enPickClose=function(){unwiden();closeModal();};
  window.enPickOk=function(){unwiden();const c=cpOf(ED.cp);DB.enPickSel.forEach(id=>{const f=findSku(id);if(!f)return;const orig=f.s.price||0;
    // 预填：活动价 = 原价 × 推荐折扣；承诺库存 = max(最低承诺, 可售库存的一半)，均可改
    ED.items.push({skuId:id,orig,price:c.play.type=='special'?+(orig*c.play.rec).toFixed(2):'',promise:Math.max(c.minStock,Math.floor((f.s.stock||0)/2))});});
    const n=DB.enPickSel.length;DB.enPickSel=[];closeModal();render();toast(`已加入 ${n} 个 SKU，活动价与承诺库存已按推荐值预填`,'ok');};

  /* 保存草稿 */
  window.act_enDraft=function(){if(!ED)return;const c=cpOf(ED.cp);const items=ED.items.map(x=>({skuId:x.skuId,orig:x.orig,price:x.price,promise:x.promise}));
    let e=ED.enrollId?DB.enrolls.find(x=>x.id==ED.enrollId):null;
    if(e&&e.status=='draft'){e.items=items;e.fullcut=ED.fullcut;e.updatedAt=ts();}
    else if(e){e.items=items;e.fullcut=ED.fullcut;e.status='draft';e.updatedAt=ts();e.logs.push({t:ts(),who:who(),act:'保存草稿',d:'修改中'});}
    else{e={id:'EN0'+seq(),cp:ED.cp,ver:1,status:'draft',fullcut:ED.fullcut,items,updatedAt:ts(),logs:[{t:ts(),who:who(),act:'保存草稿',d:`${items.length} 个 SKU`}]};DB.enrolls.unshift(e);}
    enBack();DB.enrollTab='my';render();toast(`草稿 ${e.id} 已保存，报名截止 ${c.enrollEnd} 前提交有效`,'ok');};

  /* 提交：前端全量校验 → 规则预筛（演示即时出结果）*/
  window.act_enSubmit=function(){if(!ED)return;const c=cpOf(ED.cp);const sp=c.play.type=='special';
    if(phase(c)!='open'){toast('不在报名开放时段','err');return;}
    if(!sp){const [x,y]=ED.fullcut;if(!(x>0)||x>c.play.thresholdMax){toast(`满减门槛须为 1 ~ ${c.play.thresholdMax}`,'err');return;}if(!(y>=c.play.amountMin)||y>c.play.amountMax){toast(`满减面额须为 ${c.play.amountMin} ~ ${c.play.amountMax}`,'err');return;}if(y>=x){toast('减免金额须小于门槛','err');return;}}
    if(!ED.items.length){toast('至少添加 1 个报名商品','err');return;}
    for(let k=0;k<ED.items.length;k++){const x=ED.items[k];const f=findSku(x.skuId);const nm=f?skuFullName(f.p,f.s):x.skuId;
      if(!f||!onsale(f.p,f.s)){toast(`「${nm}」已非在售，请移除后再提交`,'err');enFlashRow(k);return;}
      if(!c.gate.cats.includes(f.p.cat)){toast(`「${nm}」不属于会场允许类目`,'err');enFlashRow(k);return;}
      x.orig=f.s.price||0;const kk=calc(c,x);
      if(sp){if(!(+x.price>0)){toast(`「${nm}」请填写活动价`,'err');enFlashRow(k);return;}if(+x.price<kk.min||+x.price>kk.max){toast(`「${nm}」活动价须在 ${money(kk.min)} ~ ${money(kk.max)}（原价 ${pct(c.play.minRate)} ~ ${pct(c.play.maxRate)}）`,'err');enFlashRow(k);return;}}
      if(!(+x.promise>0)){toast(`「${nm}」请填写承诺库存`,'err');enFlashRow(k);return;}if(+x.promise<c.minStock){toast(`「${nm}」承诺库存须 ≥ ${c.minStock} 件`,'err');enFlashRow(k);return;}
      const occ=occupied(x.skuId,c);if(occ){toast(`「${nm}」已在${occ}中，活动时间重叠`,'err');enFlashRow(k);return;}}
    const his=sp?ED.items.filter(x=>{const f=findSku(x.skuId);return f&&+x.price>low30(f.s);}):[];
    const sum=sumBy(c,ED.items);
    askConfirm(`确认提交对「<b>${c.name}</b>」的报名？<br><span style="font-size:12.5px;color:var(--ts)">${ED.items.length} 个 SKU · 承诺库存合计 ${num(ED.items.reduce((n,x)=>n+(+x.promise),0))} 件${sp?` · 预计商家承担上限 <b>${money(sum.mine)}</b>`:''}。${his.length?`<br><b style="color:var(--y)">${his.length} 个 SKU 活动价高于近 30 天最低价</b>，终审可能驳回。`:''}<br>提交后进入规则预筛，通过后转运营终审；终审前可撤回。</span>`,()=>save(c));};
  function save(c){const items=ED.items.map(x=>({skuId:x.skuId,orig:x.orig,price:x.price===''?null:+(+x.price).toFixed(2),promise:+x.promise}));
    let e=ED.enrollId?DB.enrolls.find(x=>x.id==ED.enrollId):null;
    if(e){e.ver=(e.status=='draft'&&!e.submittedAt)?1:(e.ver||1)+1;e.items=items;e.fullcut=ED.fullcut;e.audit=null;e.instId=null;e.logs.push({t:ts(),who:who(),act:e.ver>1?'修改并重报':'提交报名',d:`v${e.ver} · ${items.length} 个 SKU`});}
    else{e={id:'EN0'+seq(),cp:ED.cp,ver:1,fullcut:ED.fullcut,items,logs:[{t:ts(),who:who(),act:'提交报名',d:`${items.length} 个 SKU`}]};DB.enrolls.unshift(e);}
    e.submittedAt=ts();e.updatedAt=ts();
    // 规则预筛（一期硬规则：黑名单 / 承诺库存 / 参数范围 / 类目准入；价格合规 P1 仅提示）
    const checks=[['营销黑名单',!DB.merchant.mktBlacklisted,DB.merchant.mktBlacklisted?'店铺命中营销黑名单':'未命中'],
      ['承诺库存',items.every(x=>x.promise>=c.minStock),`${items.length} 个 SKU 均 ≥ ${c.minStock} 件`],
      ['玩法参数范围',true,c.play.type=='special'?`活动价均在原价 ${pct(c.play.minRate)} ~ ${pct(c.play.maxRate)} 内`:`满 ${ED.fullcut[0]} 减 ${ED.fullcut[1]} 在范围内`],
      ['类目准入',true,`均属 ${c.gate.cats.join(' / ')}`]];
    const ok=checks.every(x=>x[1]);e.pre={ok,at:ts(),checks};e.status=ok?'auditing':'pre_fail';
    e.logs.push({t:ts(),who:'系统',act:ok?'规则预筛通过':'规则预筛未过',d:ok?'转人工终审':checks.filter(x=>!x[1]).map(x=>x[2]).join('；')});
    enBack();DB.enrollTab='my';DB.enrollMyTab='all';render();toast(ok?`报名 ${e.id} 已提交，预筛通过，等待运营终审`:`报名 ${e.id} 预筛未过，请按原因修改后重报`,ok?'ok':'err');}

  /* ===== 单活动效果分析（商家自用）===== */
  window.act_enEffect=function(id){ensure();const e=DB.enrolls.find(x=>x.id==id);if(!e||!e.eff)return;const c=cpOf(e.cp);const ph=phase(c);const E=e.eff;
    const days=E.days.map(d=>({d:typeof d[0]=='number'?dayStr(d[0]):d[0],qty:d[1],gmv:d[2],orders:d[3]}));
    const n=days.length;const tot=days.reduce((o,d)=>{o.qty+=d.qty;o.gmv+=d.gmv;o.orders+=d.orders;return o;},{qty:0,gmv:0,orders:0});
    const items=e.items.filter(x=>x.pass!==false).map(x=>{const f=findSku(x.skuId);const s=E.items[x.skuId]||{sold:0,orders:0};const kk=calc(c,x);const disc=kk.cut*s.sold;
      return {x,f,sold:s.sold,orders:s.orders,rate:x.promise?s.sold/x.promise:0,disc,mine:disc*(1-(c.fund.platform||0)),plat:disc*(c.fund.platform||0),gmv:s.sold*(+x.price),svc:kk.svc,factor:kk.factor};});
    const disc=items.reduce((a,b)=>a+b.disc,0),mine=items.reduce((a,b)=>a+b.mine,0),plat=items.reduce((a,b)=>a+b.plat,0);
    const promise=items.reduce((a,b)=>a+(+b.x.promise||0),0),sold=items.reduce((a,b)=>a+b.sold,0);
    const gmvIncl=items.reduce((a,b)=>a+b.gmv*b.factor,0),comm=items.reduce((a,b)=>a+b.gmv*b.factor*b.svc,0);
    const net=gmvIncl-comm+plat;   // 活动期净收入 = 活动价成交额(含税) − 佣金 + 平台承担补贴
    const baseFactor=items.length?items.reduce((a,b)=>a+b.factor,0)/items.length:1.09,baseSvc=items.length?items.reduce((a,b)=>a+b.svc,0)/items.length:0;
    const baseNet=E.base.gmv*n*baseFactor*(1-baseSvc);   // 活动前同天数净收入（按活动前 7 天日均 × 天数）
    const lift=net-baseNet,qtyLift=E.base.qty?tot.qty/(E.base.qty*n)-1:0;
    const maxQ=Math.max(...days.map(d=>d.qty),E.base.qty)*1.15;const W=560,H=150,pad_=26,bw=Math.max(14,Math.min(40,(W-pad_*2)/n-8));
    const bars=days.map((d,i)=>{const x=pad_+i*((W-pad_*2)/n)+((W-pad_*2)/n-bw)/2;const h=d.qty/maxQ*(H-30);const today=d.d==dayStr(0)&&!E.final;
      return `<g><rect x="${x}" y="${H-20-h}" width="${bw}" height="${h}" rx="4" fill="${today?'var(--gold)':'var(--g)'}" opacity="${today?.85:.9}"><title>${d.d} · 销量 ${d.qty} 件 · 成交额 ${money(d.gmv)} · ${d.orders} 单</title></rect><text x="${x+bw/2}" y="${H-24-h}" font-size="10" text-anchor="middle" fill="var(--tp)">${d.qty}</text><text x="${x+bw/2}" y="${H-6}" font-size="10" text-anchor="middle" fill="var(--ts)">${d.d.slice(5)}</text></g>`;}).join('');
    const by=H-20-E.base.qty/maxQ*(H-30);
    drawer(`<div class="mc-hd"><div><h3>活动效果 · ${c.name} <span class="mono" style="font-size:12px;color:var(--ts);font-weight:400;margin-left:6px">${e.id}</span></h3><p>${stTag(e)} <span style="margin-left:8px">${c.actStart} ~ ${c.actEnd}</span> · <span>${fundTxt(c)}</span> · <span>${items.length} 个 SKU</span></p></div><button class="mc-x" onclick="closeDrawer()">×</button></div>
    <div class="mc-bd">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px"><span style="font-size:12px;color:var(--ts)">${E.final?`<span class="tag t-gr" style="font-size:10px">最终数据</span> 活动结束 T+1 定版 · ${E.updatedAt}`:`<span class="tag t-g" style="font-size:10px">进行中</span> 数据更新至 ${E.updatedAt}，每小时刷新`}</span><span style="font-size:12px;color:var(--ts)">已进行 ${n}/${Math.round((new Date(c.actEnd.replace(' ','T'))-new Date(c.actStart.replace(' ','T')))/86400000+0.5)} 天</span></div>
      <h4 style="margin:0 0 8px;font-size:13.5px">卖了多少</h4>
      <div class="sg" style="grid-template-columns:repeat(4,1fr);margin-bottom:12px">
        <div class="sc"><div class="sc-l">活动订单</div><div class="sc-v">${num(tot.orders)}</div><div class="sc-s">含活动商品的订单</div></div>
        <div class="sc"><div class="sc-l">活动商品销量</div><div class="sc-v">${num(tot.qty)} <span style="font-size:12px;font-weight:400">件</span></div><div class="sc-s" style="color:${qtyLift>=0?'var(--g)':'var(--r)'}">较活动前日均 ${qtyLift>=0?'+':''}${Math.round(qtyLift*100)}%</div></div>
        <div class="sc"><div class="sc-l">活动成交额（未税）</div><div class="sc-v">${money(tot.gmv)}</div><div class="sc-s">按活动价 · 仅活动商品行</div></div>
        <div class="sc ${sold/promise<0.5&&E.final?'warn':''}"><div class="sc-l">承诺库存兑现率</div><div class="sc-v">${promise?Math.round(sold/promise*100):0}%</div><div class="sc-s">售出 ${num(sold)} / 承诺 ${num(promise)} 件</div></div>
      </div>
      <div style="border:1px solid var(--bd2);border-radius:10px;padding:10px 12px 4px;margin-bottom:14px">
        <div style="display:flex;justify-content:space-between;font-size:12px;color:var(--ts);margin-bottom:4px"><span>每日活动商品销量（件）</span><span><span style="display:inline-block;width:18px;border-top:2px dashed var(--y);vertical-align:middle;margin-right:4px"></span>活动前 7 天日均 ${E.base.qty} 件${E.final?'':' · <span style="color:var(--gold)">■</span> 今日（未完整）'}</span></div>
        <div style="overflow-x:auto"><svg viewBox="0 0 ${W} ${H}" width="100%" style="max-width:${W}px;display:block">${bars}<line x1="${pad_}" y1="${by}" x2="${W-pad_}" y2="${by}" stroke="var(--y)" stroke-width="1.5" stroke-dasharray="5 4"/></svg></div>
      </div>
      <h4 style="margin:0 0 8px;font-size:13.5px">花了多少</h4>
      <div class="sg" style="grid-template-columns:repeat(4,1fr);margin-bottom:8px">
        <div class="sc"><div class="sc-l">优惠总额</div><div class="sc-v">${money(disc)}</div><div class="sc-s">Σ(原价 − 活动价) × 售出件数</div></div>
        <div class="sc"><div class="sc-l">商家承担（${pct(1-(c.fund.platform||0))}）</div><div class="sc-v" style="color:var(--r)">${money(mine)}</div><div class="sc-s">让利，已含在活动价里</div></div>
        <div class="sc"><div class="sc-l">平台承担（${pct(c.fund.platform||0)}）</div><div class="sc-v" style="color:var(--gd)">${money(plat)}</div><div class="sc-s">随结算补给商家</div></div>
        <div class="sc"><div class="sc-l">平台服务费</div><div class="sc-v">${money(comm)}</div><div class="sc-s">按活动价成交额计</div></div>
      </div>
      <h4 style="margin:10px 0 8px;font-size:13.5px">值不值</h4>
      <div class="sg" style="grid-template-columns:repeat(3,1fr);margin-bottom:8px">
        <div class="sc"><div class="sc-l">活动期预计净收入</div><div class="sc-v">${money(net)}</div><div class="sc-s">成交额(含税) − 服务费 + 平台承担</div></div>
        <div class="sc"><div class="sc-l">活动前同天数净收入</div><div class="sc-v">${money(baseNet)}</div><div class="sc-s">活动前 7 天日均 × ${n} 天</div></div>
        <div class="sc ${lift>=0?'good':'alert'}"><div class="sc-l">净收入增量</div><div class="sc-v" style="color:${lift>=0?'var(--g)':'var(--r)'}">${lift>=0?'+':'−'}${money(Math.abs(lift))}</div><div class="sc-s">${lift>=0?'活动带来的净增收':'活动期净收入低于日常'}</div></div>
      </div>
      <div style="font-size:11.5px;color:var(--ts);margin-bottom:14px">净收入均为<b>预估</b>：以活动商品行为口径，未含 BCRS 押金、多退少补与售后退款；以结算单为准。商家承担部分是相对原价的让利，不会再从结算中扣减。</div>
      <h4 style="margin:6px 0 8px;font-size:13.5px">商品明细 <span style="font-weight:400;color:var(--ts);font-size:12px">按售出件数排序</span></h4>
      <div style="overflow-x:auto"><table class="subtbl"><thead><tr><th>SKU 编码</th><th>商品名称</th><th>原价</th><th>活动价</th><th>承诺库存</th><th>售出</th><th>兑现率</th><th>订单数</th><th>成交额(未税)</th><th>优惠额</th><th>商家承担</th></tr></thead><tbody>
        ${items.sort((a,b)=>b.sold-a.sold).map(r=>`<tr><td class="mono">${r.x.skuId}</td><td>${r.f?skuFullName(r.f.p,r.f.s):'—'}</td><td><s style="color:var(--tt)">${money(r.x.orig)}</s></td><td style="color:var(--r)">${money(r.x.price)}</td><td>${num(r.x.promise)}</td><td><b>${num(r.sold)}</b></td><td><span class="tag ${r.rate>=0.8?'t-g':r.rate>=0.5?'t-y':'t-r'}" style="font-size:10px">${Math.round(r.rate*100)}%</span></td><td>${num(r.orders)}</td><td>${money(r.gmv)}</td><td>${money(r.disc)}</td><td>${money(r.mine)}</td></tr>`).join('')}
      </tbody></table></div>
    </div>
    <div class="mc-ft"><button class="btn btn-link" onclick="toast('已导出：${e.id}_活动效果.xlsx（按日汇总 + 商品明细）','ok')">导出效果数据</button><span style="flex:1"></span><button class="btn btn-o" onclick="closeDrawer();act_enDetail('${e.id}')">报名详情</button><button class="btn btn-p" onclick="closeDrawer()">关闭</button></div>`);};
})();
