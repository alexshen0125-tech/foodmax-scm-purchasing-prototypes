/* PC · 店铺运营平台 > 供货 > 标签补打 —— PAGES['p-label-reprint']
   场景：商家自行打印的标签送到仓库后二维码扫不出（打印质量 / 原码失效），
   让商家重打不现实 → 仓库在运营平台按 SKU 查到，原码重出。

   ── 统一模型（沈亮 2026-09-10 定）────────────────────────────────
   标签分两类，唯一性来源不同，补打粒度随之不同：

   | 绑定关系 | 计价方式 | 二维码 | 唯一性 | 补打粒度 |
   |---|---|---|---|---|
   | 绑送货单 | 普通     | 备货单号｜条码｜｜｜序号｜        | 备货单+序号 | 按序号区间 |
   | 绑送货单 | 多退少补 | 备货单号｜条码｜重量｜单位｜序号｜ | 备货单+序号 | 按件（序号）|
   | 预贴不绑单 | 普通   | ｜条码｜（无单号无序号）           | 无，张张相同 | **按张数** |
   | 预贴不绑单 | 多退少补 | 标签号｜条码｜重量｜单位｜        | 标签流水号 | 按标签号（张）|

   要点：
   - 预贴标签是商家提前分装时打的，不绑送货单/备货单，到仓 WMS 扫码后按数量逻辑匹配。
   - 多退少补预贴每袋重量不同、重量即金额，若无唯一标签号会被重复扫成两次计费，
     所以必须发标签号并印在纸面；普通品预贴才是真正张张相同。
   - 补打一律原码重出，不改重量、不发新号、不增已打张数。

   对齐后端已有接口（绑单）：
     普通 /stockprep/label/reprint、多退少补 /stockprep/weigh-label/reprint
     代码依据：merchant-app packages/api-client/src/contracts/stock-label.ts:134、stock-weigh.ts:114
   预贴标签补打为净新增能力，待研发确认端点。

   依赖 inline 脚本全局：DB / toast / drawer / closeDrawer / modal / closeModal / render / nav / COMM_SHOPS。 */
(function(){

  /* ============================================================
     演示数据（模块内常量；可变状态挂 DB.lr*）
  ============================================================ */
  const TODAY='2026-09-10', YDAY='2026-09-09', OLD='2026-08-28';
  const SHOPS=(typeof COMM_SHOPS!=='undefined'&&COMM_SHOPS.length)?COMM_SHOPS
    :[{code:'M2026-0815',name:'绿鲜源蔬果旗舰店'},{code:'M2026-0820',name:'阳光烘焙原料店'},{code:'M2026-0805',name:'椰丰食品旗舰店'}];
  const REASONS=['二维码扫不出','标签破损污损','商家漏打','标签内容错误','其他'];
  const PAPERS=['40×30 mm','50×30 mm','60×40 mm','60×50 mm','70×50 mm','80×55 mm'];
  const MAX_PER_TIME=200;      // BR：单次补打张数上限
  const WINDOW_DAYS=7;         // BR：可补打窗口（送货日期 / 打印日期近 7 天）

  // 逐件重量：稳定伪随机，同 sku+序号恒定（演示用；真实取 /stockprep/weigh/list 的 portions.realWeight）
  function hnum(str,mod){let h=2166136261;for(let i=0;i<str.length;i++){h^=str.charCodeAt(i);h=Math.imul(h,16777619)>>>0;}
    h^=h>>>13;h=Math.imul(h,0x5bd1e995)>>>0;h^=h>>>15;return (h>>>0)%mod;}   // 末尾雪崩（否则相邻序号排成等差数列）；>>>0 保证非负
  function wOf(seed,spec){return +(spec+(hnum(seed,26)-13)/100).toFixed(2);}
  function portionsOf(sku,n,spec){const out=[];for(let i=1;i<=n;i++)out.push({seq:i,w:wOf(sku+'p'+i,spec)});return out;}
  function preItemsOf(sku,n,spec,base){const out=[];for(let i=1;i<=n;i++)out.push({id:'PL2609'+String(base+i).padStart(5,'0'),w:wOf(sku+'q'+i,spec)});return out;}

  const ROWS=[
    /* ── 绑送货单标签 ────────────────────────────────────────── */
    // 绿鲜源 · 裕廊DC · 今天送货（昨晚打的整批标签二维码扫不出——主场景）
    {bind:'order',shop:'M2026-0815',sd:'SD26091000381',dl:'DL260910020001',date:TODAY,wh:'裕廊DC',temp:'冷藏',
     sku:'xmITEM260803160001',name:'本地小白菜',spec:'500g/包',unit:'包',qty:60,printed:60,type:'normal'},
    {bind:'order',shop:'M2026-0815',sd:'SD26091000381',dl:'DL260910020001',date:TODAY,wh:'裕廊DC',temp:'冷藏',
     sku:'xmITEM260803160002',name:'去皮马蹄',spec:'1kg/袋',unit:'袋',qty:24,printed:24,type:'weigh',specW:1.00,wUnit:'kg'},
    {bind:'order',shop:'M2026-0815',sd:'SD26091000381',dl:'DL260910020001',date:TODAY,wh:'裕廊DC',temp:'冷冻',
     sku:'xmITEM260803160007',name:'冷冻鸡中翅',spec:'2kg/包',unit:'包',qty:18,printed:18,type:'weigh',specW:2.00,wUnit:'kg'},
    // 部分打印：未打完的那段不该在这补，应回商家端首次出签
    {bind:'order',shop:'M2026-0815',sd:'SD26091000382',dl:'DL260910020002',date:TODAY,wh:'兀兰DC',temp:'常温',
     sku:'xmITEM260803160003',name:'金龙鱼调和油 5L',spec:'5L/桶',unit:'桶',qty:40,printed:25,type:'normal'},
    // 商家尚未打印，属"代打"不属补打
    {bind:'order',shop:'M2026-0820',sd:'SD26091000390',dl:'DL260910030004',date:TODAY,wh:'裕廊DC',temp:'常温',
     sku:'xmITEM260805110011',name:'高筋面粉 25kg',spec:'25kg/袋',unit:'袋',qty:12,printed:0,type:'normal'},
    {bind:'order',shop:'M2026-0805',sd:'SD26091000404',dl:'DL260910040007',date:TODAY,wh:'盛港DC',temp:'冷藏',
     sku:'xmITEM260731090021',name:'鲜切椰肉',spec:'800g/盒',unit:'盒',qty:32,printed:32,type:'normal'},
    {bind:'order',shop:'M2026-0805',sd:'SD26091000404',dl:'DL260910040007',date:TODAY,wh:'盛港DC',temp:'冷藏',
     sku:'xmITEM260731090022',name:'去壳生蚝',spec:'1kg/袋',unit:'袋',qty:15,printed:15,type:'weigh',specW:1.00,wUnit:'kg'},
    // 昨天（仍在窗口内）
    {bind:'order',shop:'M2026-0815',sd:'SD26090900377',dl:'DL260909020001',date:YDAY,wh:'裕廊DC',temp:'冷藏',
     sku:'xmITEM260803160001',name:'本地小白菜',spec:'500g/包',unit:'包',qty:55,printed:55,type:'normal'},
    // 超期（>7 天，不可补打）
    {bind:'order',shop:'M2026-0805',sd:'SD26082800112',dl:'DL260828040002',date:OLD,wh:'盛港DC',temp:'冷藏',
     sku:'xmITEM260731090021',name:'鲜切椰肉',spec:'800g/盒',unit:'盒',qty:20,printed:20,type:'normal'},

    /* ── 预贴标签（不绑送货单）──────────────────────────────── */
    // 普通品预贴：张张相同、无序号 → 补打按张数
    {bind:'pre',shop:'M2026-0815',date:TODAY,wh:'—',temp:'冷藏',
     sku:'xmITEM260803160001',name:'本地小白菜',spec:'500g/包',unit:'包',qty:80,printed:80,type:'normal',batchNo:'PB26091000012'},
    {bind:'pre',shop:'M2026-0820',date:YDAY,wh:'—',temp:'常温',
     sku:'xmITEM260805110011',name:'高筋面粉 25kg',spec:'25kg/袋',unit:'袋',qty:30,printed:30,type:'normal',batchNo:'PB26090900008'},
    // 多退少补预贴：每张唯一标签号 + 本袋净重 → 补打按标签号
    {bind:'pre',shop:'M2026-0815',date:TODAY,wh:'—',temp:'冷藏',
     sku:'xmITEM260803160002',name:'去皮马蹄',spec:'1kg/袋',unit:'袋',qty:16,printed:16,type:'weigh',specW:1.00,wUnit:'kg',preBase:100,batchNo:'PB26091000015'},
    {bind:'pre',shop:'M2026-0805',date:TODAY,wh:'—',temp:'冷藏',
     sku:'xmITEM260731090022',name:'去壳生蚝',spec:'1kg/袋',unit:'袋',qty:10,printed:10,type:'weigh',specW:1.00,wUnit:'kg',preBase:200,batchNo:'PB26091000021'},
  ];
  ROWS.forEach(r=>{
    r.key=(r.bind=='pre'?(r.batchNo||('PRE-'+r.shop)):r.sd)+'|'+r.sku;
    r.shopName=(SHOPS.find(s=>s.code==r.shop)||{}).name||r.shop;
    if(r.type=='weigh'){
      if(r.bind=='pre')r.items=preItemsOf(r.sku,r.qty,r.specW,r.preBase);
      else r.portions=portionsOf(r.sku,r.qty,r.specW);
    }
  });

  /* ============================================================
     取数 / 判定
  ============================================================ */
  function dayDiff(d){return Math.round((new Date(TODAY)-new Date(d))/864e5);}
  function expired(r){return dayDiff(r.date)>WINDOW_DAYS;}
  function notPrinted(r){return r.printed<=0;}                  // 商家没打过 → 代打，非补打
  function partPrinted(r){return r.printed>0&&r.printed<r.qty;} // 商家没打完（仅绑单会出现）
  function reDone(key){return (DB.lrDone||{})[key]||0;}
  // 可补打上限 = 已打张数：补打只重出商家已打过的，未打的部分属首次出签，应由商家在商家端打
  function maxSeq(r){return Math.min(r.printed,r.qty);}
  // 补打粒度：seq=按序号区间 / portion=按件(序号) / qty=按张数 / labelId=按标签号
  function grain(r){
    if(r.bind=='pre')return r.type=='weigh'?'labelId':'qty';
    return r.type=='weigh'?'portion':'seq';
  }
  function canReprint(r){return !expired(r)&&!notPrinted(r);}
  function inBatch(r){return canReprint(r)&&(grain(r)=='seq'||grain(r)=='qty');}  // 逐件/逐张的不进批量

  function filtered(){
    DB.lrF=DB.lrF||{date:TODAY};const f=DB.lrF;
    return ROWS.filter(r=>{
      if(f.date&&r.date!=f.date)return false;
      if(f.bind&&r.bind!=f.bind)return false;
      if(f.shop&&r.shop!=f.shop)return false;
      if(f.wh&&r.wh!=f.wh)return false;
      if(f.no){const q=f.no.trim().toUpperCase();
        const hay=[r.sd,r.dl,r.batchNo].filter(Boolean).map(x=>x.toUpperCase());
        const hitItem=(r.items||[]).some(x=>x.id.toUpperCase().includes(q));
        if(!(hay.some(x=>x.includes(q))||hitItem))return false;}
      if(f.kw){const q=f.kw.trim().toLowerCase();if(!(r.sku.toLowerCase().includes(q)||r.name.toLowerCase().includes(q)))return false;}
      return true;
    });
  }

  function tempTag(t){const m={'冷藏':'t-b','冷冻':'t-pp','常温':'t-gr'}[t]||'t-gr';return `<span class="tag ${m}"><span class="dot"></span>${t}</span>`;}
  function typeTag(t){return t=='weigh'?`<span class="tag t-y"><span class="dot"></span>多退少补</span>`:`<span class="tag t-gr"><span class="dot"></span>普通</span>`;}
  function bindTag(b){return b=='pre'?`<span class="tag t-pp"><span class="dot"></span>预贴·不绑单</span>`:`<span class="tag t-g"><span class="dot"></span>绑送货单</span>`;}
  const GRAIN_TEXT={seq:'按序号区间',portion:'按件（序号）',qty:'按张数',labelId:'按标签号'};

  /* ============================================================
     打印机设置（仓库这台机器的纸张，与商家端各自独立）
  ============================================================ */
  window.lr_paperModal=function(){
    modal(`<div class="mc-hd"><h3>打印机设置</h3><button class="mc-x" onclick="closeModal()">×</button></div>
    <div class="mc-bd">
      <div class="ib ib-b"><span class="i">🖨️</span>选择<b>仓库这台标签打印机</b>实际装的纸张大小，与商家端设置互不影响；<b>选择后方可补打</b>。</div>
      <div class="fr"><label class="fl"><b>*</b>标签纸张大小</label><select id="lrp-paper"><option value="" ${!DB.lrPaper?'selected':''}>请选择纸张大小</option>${PAPERS.map(x=>`<option ${DB.lrPaper==x?'selected':''}>${x}</option>`).join('')}</select></div>
      <div class="ib ib-gr" style="margin-top:8px"><span class="i">ℹ️</span>补打的标签内容与商家原标签完全一致，纸张不一致会导致错位。</div>
    </div>
    <div class="mc-ft"><button class="btn btn-o" onclick="closeModal()">取消</button><button class="btn btn-p" onclick="lr_savePaper()">保存设置</button></div>`);
  };
  window.lr_savePaper=function(){const v=(document.getElementById('lrp-paper')||{}).value;if(!v){toast('请选择标签纸张大小','err');return;}DB.lrPaper=v;closeModal();render();toast('已设置标签纸张：'+v,'ok');};
  function ensurePaper(){if(!DB.lrPaper){toast('请先在「打印机设置」选择仓库标签机的纸张大小','err');lr_paperModal();return false;}return true;}

  /* ============================================================
     补打抽屉（详情/明细 → 右侧抽屉），按 grain 四态分流
  ============================================================ */
  function draft(){return DB.lrDraft||{};}
  function draftCount(){
    const d=draft();const r=ROWS.find(x=>x.key==d.key);if(!r)return 0;
    const g=grain(r);
    const base=g=='portion'||g=='labelId'?(d.sel||[]).length
      :g=='qty'?(d.qty||0)
      :(d.mode=='range'?Math.max(0,(d.to-d.from+1)||0):maxSeq(r));
    return base*(d.copies||1);
  }

  window.lr_open=function(key){
    const r=ROWS.find(x=>x.key==key);if(!r)return;
    if(expired(r)){toast(`${r.bind=='pre'?'打印日期':'送货日期'} ${r.date} 已超过 ${WINDOW_DAYS} 天，超出可补打窗口`,'err');return;}
    if(notPrinted(r)){toast('该商家尚未打印过本 SKU 标签，不属于补打；请让商家在商家端首次出签','err');return;}
    const mx=maxSeq(r), g=grain(r);
    DB.lrDraft={key,mode:'all',from:1,to:mx,qty:g=='qty'?mx:0,
      sel:g=='portion'?r.portions.filter(p=>p.seq<=mx).map(p=>p.seq):(g=='labelId'?r.items.map(x=>x.id):[]),
      reason:REASONS[0],copies:1};
    lr_render();
  };
  window.lr_setMode=function(m){DB.lrDraft.mode=m;lr_render();};
  window.lr_setField=function(k,v){DB.lrDraft[k]=(k=='from'||k=='to'||k=='copies'||k=='qty')?(parseInt(v,10)||0):v;lr_render();};
  window.lr_togglePortion=function(seq){const d=DB.lrDraft;const i=d.sel.indexOf(seq);if(i<0)d.sel.push(seq);else d.sel.splice(i,1);lr_render();};
  window.lr_allPortion=function(){const d=DB.lrDraft;const r=ROWS.find(x=>x.key==d.key);const ps=r.portions.filter(p=>p.seq<=maxSeq(r));
    d.sel=d.sel.length==ps.length?[]:ps.map(p=>p.seq);lr_render();};
  window.lr_toggleItem=function(id){const d=DB.lrDraft;const i=d.sel.indexOf(id);if(i<0)d.sel.push(id);else d.sel.splice(i,1);lr_render();};
  window.lr_allItem=function(){const d=DB.lrDraft;const r=ROWS.find(x=>x.key==d.key);
    d.sel=d.sel.length==r.items.length?[]:r.items.map(x=>x.id);lr_render();};

  function kv(k,v){return `<div><div style="font-size:12px;color:var(--ts);margin-bottom:3px">${k}</div><div style="font-size:13.5px">${v}</div></div>`;}
  function sec(t,sub){return `<div style="display:flex;align-items:baseline;gap:8px;margin:18px 0 10px"><div style="font-size:14px;font-weight:600">${t}</div>${sub?`<div style="font-size:12px;color:var(--ts)">${sub}</div>`:''}</div>`;}
  const WEIGH_READONLY=`<div class="ib ib-gr"><span class="i">⚖️</span>重量取商家已提交的称重结果，<b>此处只读</b>。实物与标签重量不符属复称改账（偏差 &gt;3% 以平台为准并计质量分），会改发货差额与商家对账单，不在补打里做。<button class="btn btn-link btn-sm" onclick="toast('跳转「多退少补 › 复称」（本期未做，见待拍板 Q1）','info')">去复称 →</button></div>`;

  function lr_render(){
    const d=draft();const r=ROWS.find(x=>x.key==d.key);if(!r)return;
    const mx=maxSeq(r), g=grain(r);
    const n=draftCount();const over=n>MAX_PER_TIME;

    const seqText=
      g=='portion'?(d.sel.length?d.sel.slice().sort((a,b)=>a-b).join('、'):'未选择')
      :g=='labelId'?(d.sel.length?(d.sel.length==r.items.length?`全部 ${r.items.length} 张`:d.sel.slice(0,6).join('、')+(d.sel.length>6?` 等 ${d.sel.length} 张`:'')):'未选择')
      :g=='qty'?`不适用（张张相同、无序号）`
      :(d.mode=='range'?`${d.from}–${d.to}`:`1–${mx}`);
    const invalid=
      (g=='portion'||g=='labelId')?d.sel.length==0
      :g=='qty'?!(d.qty>=1)
      :(d.mode=='range'&&(!(d.from>=1)||!(d.to<=mx)||d.from>d.to));

    let rangeBox='';
    if(g=='portion'){
      rangeBox=`${sec('选择补打的件','多退少补一件一袋一标签，逐件重量不同，只能按件补打')}
        ${WEIGH_READONLY}
        <div style="overflow-x:auto;max-height:300px;overflow-y:auto;border:1px solid var(--bd2);border-radius:8px;margin-top:10px"><table>
          <thead><tr>
            <th style="width:34px"><input type="checkbox" ${d.sel.length==mx?'checked':''} onclick="lr_allPortion()"></th>
            <th style="width:60px">序号</th><th style="text-align:right">实发净重</th><th style="text-align:right">一件应发</th><th style="text-align:right">差异</th>
          </tr></thead><tbody>${r.portions.filter(p=>p.seq<=mx).map(p=>`<tr>
            <td><input type="checkbox" ${d.sel.includes(p.seq)?'checked':''} onclick="lr_togglePortion(${p.seq})"></td>
            <td>${p.seq}</td>
            <td style="text-align:right"><b>${p.w.toFixed(2)}</b> <span style="color:var(--ts)">${r.wUnit}</span></td>
            <td style="text-align:right;color:var(--ts)">${r.specW.toFixed(2)} ${r.wUnit}</td>
            <td style="text-align:right;color:${p.w>=r.specW?'var(--gd)':'var(--y)'}">${p.w>=r.specW?'+':''}${(p.w-r.specW).toFixed(2)}</td>
          </tr>`).join('')}</tbody></table></div>`;
    }else if(g=='labelId'){
      rangeBox=`${sec('选择补打的标签','预贴的多退少补标签每张一个标签号、一个净重，按标签号原样重出')}
        ${WEIGH_READONLY}
        <div style="overflow-x:auto;max-height:300px;overflow-y:auto;border:1px solid var(--bd2);border-radius:8px;margin-top:10px"><table>
          <thead><tr>
            <th style="width:34px"><input type="checkbox" ${d.sel.length==r.items.length?'checked':''} onclick="lr_allItem()"></th>
            <th>标签号</th><th style="text-align:right">本袋净重</th><th style="text-align:right">一件应发</th><th style="text-align:right">差异</th>
          </tr></thead><tbody>${r.items.map(x=>`<tr>
            <td><input type="checkbox" ${d.sel.includes(x.id)?'checked':''} onclick="lr_toggleItem('${x.id}')"></td>
            <td class="mono">${x.id}</td>
            <td style="text-align:right"><b>${x.w.toFixed(2)}</b> <span style="color:var(--ts)">${r.wUnit}</span></td>
            <td style="text-align:right;color:var(--ts)">${r.specW.toFixed(2)} ${r.wUnit}</td>
            <td style="text-align:right;color:${x.w>=r.specW?'var(--gd)':'var(--y)'}">${x.w>=r.specW?'+':''}${(x.w-r.specW).toFixed(2)}</td>
          </tr>`).join('')}</tbody></table></div>`;
    }else if(g=='qty'){
      rangeBox=`${sec('补打张数','预贴的普通标签张张相同、无序号，坏几张补几张')}
        <div class="ib ib-b"><span class="i">🏷️</span>该批预贴标签二维码<b>不含备货单号与序号</b>，同商品每张内容完全一致——补打不需要指定是哪几张，填张数即可。</div>
        <div class="row" style="gap:10px;align-items:flex-end;margin-top:10px">
          <div class="fr" style="flex:0 0 180px;margin:0"><label class="fl"><b>*</b>补打张数</label>
            <input type="number" min="1" max="${MAX_PER_TIME}" value="${d.qty}" onchange="lr_setField('qty',this.value)"></div>
          <div style="padding-bottom:9px;font-size:12px;color:var(--ts)">该批共预贴 ${r.qty} 张，单次补打上限 ${MAX_PER_TIME} 张</div>
        </div>`;
    }else{
      rangeBox=`${sec('补打范围')}
        <div style="display:flex;gap:22px;align-items:center;flex-wrap:wrap">
          <label style="display:flex;gap:6px;align-items:center;cursor:pointer">
            <input type="radio" name="lrmode" ${d.mode=='all'?'checked':''} onclick="lr_setMode('all')">
            <span>全部已打序号 <span class="mono">1–${mx}</span>（共 ${mx} 张）</span></label>
          <label style="display:flex;gap:6px;align-items:center;cursor:pointer">
            <input type="radio" name="lrmode" ${d.mode=='range'?'checked':''} onclick="lr_setMode('range')">
            <span>指定序号区间</span></label>
        </div>
        ${d.mode=='range'?`<div class="row" style="gap:10px;align-items:flex-end;margin-top:10px">
          <div class="fr" style="flex:0 0 150px;margin:0"><label class="fl">起始序号</label><input type="number" min="1" max="${mx}" value="${d.from}" onchange="lr_setField('from',this.value)"></div>
          <div style="padding-bottom:9px;color:var(--ts)">—</div>
          <div class="fr" style="flex:0 0 150px;margin:0"><label class="fl">结束序号</label><input type="number" min="1" max="${mx}" value="${d.to}" onchange="lr_setField('to',this.value)"></div>
          <div style="padding-bottom:9px;font-size:12px;color:var(--ts)">可填 1–${mx}，照坏标签上的<b>序号</b>填</div>
        </div>`:''}`;
    }

    drawer(`
      <div class="mc-hd">
        <h3>标签补打 · ${r.name}</h3>
        <p>${r.shopName} · ${r.bind=='pre'?`预贴批次 <span class="mono">${r.batchNo||'—'}</span>`:`送货单 <span class="mono">${r.sd}</span> · 备货单 <span class="mono">${r.dl}</span>`}</p>
        <button class="mc-x" onclick="closeDrawer()">×</button>
      </div>
      <div class="mc-bd" style="padding:18px 20px">
        ${sec('基础信息')}
        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:14px 18px">
          ${kv('商家',r.shopName)}${kv('商家编码',`<span class="mono">${r.shop}</span>`)}
          ${kv(r.bind=='pre'?'打印日期':'送货日期',r.date)}${kv('入库仓库',r.wh=='—'?'<span style="color:var(--tt)">预贴时未定</span>':r.wh)}
          ${kv('商品编码',`<span class="mono">${r.sku}</span>`)}${kv('规格',r.spec)}
          ${kv('标签类型',bindTag(r.bind))}${kv('计价方式',typeTag(r.type))}
          ${kv(r.bind=='pre'?'已预贴张数':'应送件数',`<b>${r.qty}</b> ${r.bind=='pre'?'张':r.unit}`)}${kv('已打张数',`<b style="color:var(--gd)">${r.printed}</b>`)}
          ${kv('补打粒度',GRAIN_TEXT[g])}${kv('历史补打',reDone(r.key)?`<b style="color:var(--gold)">${reDone(r.key)}</b> 张`:'<span style="color:var(--tt)">—</span>')}
        </div>
        ${partPrinted(r)?`<div class="ib ib-y" style="margin-top:12px"><span class="i">⚠️</span>该商品商家只打到序号 <b>${mx}</b>，序号 <b>${mx+1}–${r.qty}</b> 从未出签，<b>不在补打范围</b>——那部分属首次出签，需商家在商家端「备货管理 › 打印标签」自行打印。</div>`:''}

        ${rangeBox}

        ${sec('补打设置')}
        <div class="row" style="gap:14px;align-items:flex-end;flex-wrap:wrap">
          <div class="fr" style="flex:0 0 220px;margin:0"><label class="fl"><b>*</b>补打原因</label>
            <select onchange="lr_setField('reason',this.value)">${REASONS.map(x=>`<option ${d.reason==x?'selected':''}>${x}</option>`).join('')}</select></div>
          <div class="fr" style="flex:0 0 120px;margin:0"><label class="fl">每张份数</label>
            <input type="number" min="1" max="3" value="${d.copies}" onchange="lr_setField('copies',this.value)"></div>
          <div class="fr" style="flex:1;margin:0"><label class="fl">标签纸张</label>
            <input value="${DB.lrPaper||'未设置'}" readonly style="background:var(--bd2)"></div>
        </div>

        <div class="ib ib-y" style="margin-top:16px"><span class="i">🏷️</span>本次补打 <b>${n}</b> 张${g=='qty'?'':`，${g=='labelId'?'标签号':'序号'} <span class="mono">${seqText}</span>`}，二维码内容与原标签<b>完全一致</b>；${g=='qty'?'不发新标签号':'不新增序号'}、不增加已打张数。<b>请务必销毁旧标签</b>${g=='qty'?'':'，避免同一'+(g=='labelId'?'标签号':'序号')+'两张实物被重复扫码'}。</div>
        ${over?`<div class="ib ib-r" style="margin-top:8px"><span class="i">⛔</span>单次补打上限 ${MAX_PER_TIME} 张，当前 ${n} 张，请分批。</div>`:''}
      </div>
      <div class="mc-ft">
        <button class="btn btn-o" onclick="closeDrawer()">取消</button>
        <button class="btn btn-o" onclick="lr_pdf()">下载 PDF</button>
        <button class="btn btn-p" ${invalid||over?'disabled':''} onclick="lr_confirm()">确认补打（${n} 张）</button>
      </div>`);
  }

  window.lr_pdf=function(){const d=draft();const r=ROWS.find(x=>x.key==d.key);if(!r)return;
    toast(`已下载「${r.name}_补打标签_${draftCount()}张.pdf」，打印助手未启动时可用系统打印机应急`,'ok');};

  function seqOf(r,d){
    const g=grain(r);
    return g=='portion'?d.sel.slice().sort((a,b)=>a-b).join('、')
      :g=='labelId'?(d.sel.length==r.items.length?`全部 ${r.items.length} 张`:d.sel.join('、'))
      :g=='qty'?'—'
      :(d.mode=='range'?`${d.from}–${d.to}`:`1–${maxSeq(r)}`);
  }
  function pushLog(r,seq,n,reason){
    DB.lrLog=DB.lrLog||[];
    DB.lrLog.unshift({time:TODAY+' '+new Date().toTimeString().slice(0,5),op:'运营管理员',shop:r.shopName,shopCode:r.shop,
      bind:r.bind,doc:r.bind=='pre'?(r.batchNo||'—'):r.sd,sku:r.sku,name:r.name,type:r.type,
      grain:GRAIN_TEXT[grain(r)],seq,n,reason,paper:DB.lrPaper});
  }

  window.lr_confirm=function(){
    if(!ensurePaper())return;
    const d=draft();const r=ROWS.find(x=>x.key==d.key);if(!r)return;
    const n=draftCount();if(n<=0){toast('请先选择要补打的标签','err');return;}
    const seq=seqOf(r,d);
    DB.lrDone=DB.lrDone||{};DB.lrDone[r.key]=reDone(r.key)+n;
    pushLog(r,seq,n,d.reason);
    DB.lrDraft=null;closeDrawer();render();
    toast(`已补打「${r.name}」共 ${n} 张${grain(r)=='qty'?'':`（${seq}）`}；原码重出，请销毁旧标签`,'ok');
  };

  /* ============================================================
     批量补打：只收「按序号区间 / 按张数」两种粒度；逐件、逐张的必须单独选
  ============================================================ */
  window.lr_toggleSel=function(key){DB.lrSel=DB.lrSel||[];const i=DB.lrSel.indexOf(key);if(i<0)DB.lrSel.push(key);else DB.lrSel.splice(i,1);render();};
  window.lr_selAll=function(){DB.lrSel=DB.lrSel||[];const keys=filtered().filter(canReprint).map(r=>r.key);
    const all=keys.length&&keys.every(k=>DB.lrSel.includes(k));DB.lrSel=all?[]:keys.slice();render();};
  window.lr_batch=function(){
    if(!ensurePaper())return;
    const keys=filtered().map(r=>r.key);const sel=(DB.lrSel||[]).filter(k=>keys.includes(k));
    if(!sel.length){toast('请先勾选要补打的商品','err');return;}
    const rows=sel.map(k=>ROWS.find(r=>r.key==k)).filter(Boolean);
    const ok=rows.filter(inBatch), skip=rows.filter(r=>!inBatch(r));
    const total=ok.reduce((a,r)=>a+maxSeq(r),0);
    if(total>MAX_PER_TIME){toast(`单次补打上限 ${MAX_PER_TIME} 张，所选共 ${total} 张，请分批`,'err');return;}
    modal(`<div class="mc-hd"><h3>批量补打确认</h3><p>共 ${ok.length} 项 · ${total} 张</p><button class="mc-x" onclick="closeModal()">×</button></div>
    <div class="mc-bd">
      ${ok.length?`<div class="ib ib-y"><span class="i">🏷️</span>绑单标签按<b>全部已打序号</b>原码重出、预贴标签按<b>已预贴张数</b>重出；不新增序号、不增加已打张数。<b>请销毁旧标签</b>。</div>
      <div style="overflow-x:auto;margin-top:10px"><table><thead><tr><th>商家</th><th>商品</th><th>标签类型</th><th>单据/批次</th><th style="text-align:right">补打范围</th><th style="text-align:right">张数</th></tr></thead>
      <tbody>${ok.map(r=>`<tr><td>${r.shopName}</td><td>${r.name}</td><td>${bindTag(r.bind)}</td>
        <td class="mono">${r.bind=='pre'?(r.batchNo||'—'):r.sd}</td>
        <td class="mono" style="text-align:right">${grain(r)=='qty'?'—':`1–${maxSeq(r)}`}</td>
        <td style="text-align:right">${maxSeq(r)}</td></tr>`).join('')}</tbody></table></div>`:''}
      ${skip.length?`<div class="ib ib-r" style="margin-top:10px"><span class="i">⚖️</span>所选 <b>${skip.length}</b> 项多退少补标签<b>不进批量</b>：每张重量不同，必须逐件挑——绑单的按<b>序号</b>选、预贴的按<b>标签号</b>选。请逐个点「补打」处理。</div>`:''}
      <div class="fr" style="margin-top:12px"><label class="fl"><b>*</b>补打原因</label>
        <select id="lrb-reason">${REASONS.map(x=>`<option>${x}</option>`).join('')}</select></div>
    </div>
    <div class="mc-ft"><button class="btn btn-o" onclick="closeModal()">取消</button>
      <button class="btn btn-p" ${ok.length?'':'disabled'} onclick="lr_doBatch()">确认补打（${total} 张）</button></div>`);
  };
  window.lr_doBatch=function(){
    const reason=(document.getElementById('lrb-reason')||{}).value||REASONS[0];
    const keys=filtered().map(r=>r.key);const sel=(DB.lrSel||[]).filter(k=>keys.includes(k));
    const rows=sel.map(k=>ROWS.find(r=>r.key==k)).filter(r=>r&&inBatch(r));
    DB.lrDone=DB.lrDone||{};let n=0;
    rows.forEach(r=>{const mx=maxSeq(r);DB.lrDone[r.key]=reDone(r.key)+mx;n+=mx;
      pushLog(r,grain(r)=='qty'?'—':`1–${mx}`,mx,reason);});
    DB.lrSel=[];closeModal();render();
    toast(`批量补打完成，共 ${rows.length} 项 ${n} 张标签；请销毁旧标签`,'ok');
  };

  /* ============================================================
     视图
  ============================================================ */
  function listView(){
    DB.lrF=DB.lrF||{date:TODAY};const f=DB.lrF;DB.lrSel=DB.lrSel||[];
    const rows=filtered();
    const selKeys=rows.filter(canReprint).map(r=>r.key);
    const sel=DB.lrSel.filter(k=>selKeys.includes(k));
    const allSel=selKeys.length&&selKeys.every(k=>sel.includes(k));
    const dates=[...new Set(ROWS.map(r=>r.date))].sort().reverse();
    const whs=[...new Set(ROWS.map(r=>r.wh))].filter(x=>x!='—');
    const optSel=(cur,list,ph)=>`<option value="">${ph}</option>`+list.map(v=>`<option ${cur==v?'selected':''}>${v}</option>`).join('');

    const body=rows.map((r,i)=>{
      const done=reDone(r.key);
      const dis=!canReprint(r);
      const why=expired(r)?`${r.bind=='pre'?'打印':'送货'}日期已超 ${WINDOW_DAYS} 天，超出可补打窗口`
        :(notPrinted(r)?'商家尚未首次出签，不属于补打':'');
      return `<tr>
        <td>${dis?'':`<input type="checkbox" ${sel.includes(r.key)?'checked':''} onclick="lr_toggleSel('${r.key}')">`}</td>
        <td>${i+1}</td>
        <td>${r.shopName}</td>
        <td>${bindTag(r.bind)}</td>
        <td class="mono">${r.bind=='pre'?'<span style="color:var(--tt)">—</span>':r.sd}</td>
        <td class="mono">${r.bind=='pre'?(r.batchNo||'—'):r.dl}</td>
        <td class="mono">${r.sku}</td>
        <td><b>${r.name}</b></td>
        <td>${r.spec}</td>
        <td>${r.wh=='—'?'<span style="color:var(--tt)">—</span>':r.wh}</td>
        <td>${tempTag(r.temp)}</td>
        <td>${typeTag(r.type)}</td>
        <td style="text-align:right"><b>${r.qty}</b> <span style="color:var(--ts)">${r.bind=='pre'?'张':r.unit}</span></td>
        <td style="text-align:right;color:${notPrinted(r)?'var(--r)':'var(--gd)'}">${r.printed}${partPrinted(r)?`<div style="font-size:11px;color:var(--y)">未打完</div>`:''}</td>
        <td style="font-size:12px;color:var(--ts)">${GRAIN_TEXT[grain(r)]}</td>
        <td style="text-align:right">${done?`<b style="color:var(--gold)">${done}</b>`:'<span style="color:var(--tt)">—</span>'}</td>
        <td style="white-space:nowrap">${dis
          ?`<button class="btn btn-p btn-sm" disabled title="${why}">补打</button>`
          :`<button class="btn btn-p btn-sm" onclick="lr_open('${r.key}')">补打</button>`}</td>
      </tr>`;}).join('');

    return `
    <div class="card" style="margin-bottom:14px"><div class="card-bd" style="padding:0">
      <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid var(--bd2);padding:0 16px;flex-wrap:wrap">
        <div class="tabs" style="margin:0;border:none">
          <div class="tab ${DB.lrTab!='log'?'active':''}" onclick="DB.lrTab='list';render()">标签补打</div>
          <div class="tab ${DB.lrTab=='log'?'active':''}" onclick="DB.lrTab='log';render()">补打记录${(DB.lrLog||[]).length?`（${DB.lrLog.length}）`:''}</div>
        </div>
        <div style="display:flex;gap:16px;font-size:12.5px;padding:6px 0">
          <span class="btn btn-link" onclick="lr_paperModal()">🖨️ 打印机设置 · ${DB.lrPaper?`<b style="color:var(--gd)">${DB.lrPaper}</b>`:'<b style="color:var(--r)">未设置纸张</b>'}</span>
        </div>
      </div>
      <div style="display:flex;gap:16px;align-items:flex-end;flex-wrap:wrap;padding:14px 16px">
        <div><div style="font-size:12px;color:var(--ts);margin-bottom:5px">商品编码 / 名称</div>
          <input id="lr-kw" value="${f.kw||''}" placeholder="扫码或输入 SKU" onkeydown="if(event.key=='Enter'){DB.lrF.kw=this.value.trim();render()}" style="min-width:200px"></div>
        <div><div style="font-size:12px;color:var(--ts);margin-bottom:5px">标签类型</div>
          <select onchange="DB.lrF.bind=this.value;DB.lrSel=[];render()" style="min-width:150px">
            <option value="">全部</option>
            <option value="order" ${f.bind=='order'?'selected':''}>绑送货单</option>
            <option value="pre" ${f.bind=='pre'?'selected':''}>预贴·不绑单</option>
          </select></div>
        <div><div style="font-size:12px;color:var(--ts);margin-bottom:5px">送货 / 打印日期</div>
          <select onchange="DB.lrF.date=this.value;render()" style="min-width:140px">${optSel(f.date||'',dates,'全部')}</select></div>
        <div><div style="font-size:12px;color:var(--ts);margin-bottom:5px">商家</div>
          <select onchange="DB.lrF.shop=this.value;render()" style="min-width:180px"><option value="">全部商家</option>${SHOPS.map(s=>`<option value="${s.code}" ${f.shop==s.code?'selected':''}>${s.name}</option>`).join('')}</select></div>
        <div><div style="font-size:12px;color:var(--ts);margin-bottom:5px">入库仓库</div>
          <select onchange="DB.lrF.wh=this.value;render()" style="min-width:140px">${optSel(f.wh||'',whs,'全部仓库')}</select></div>
        <div><div style="font-size:12px;color:var(--ts);margin-bottom:5px">单号 / 批次 / 标签号</div>
          <input id="lr-no" value="${f.no||''}" placeholder="照标签上的号直达" onkeydown="if(event.key=='Enter'){DB.lrF.no=this.value.trim();render()}" style="min-width:190px"></div>
        <button class="btn btn-p btn-sm" onclick="DB.lrF.kw=(document.getElementById('lr-kw')||{}).value.trim();DB.lrF.no=(document.getElementById('lr-no')||{}).value.trim();render()">查询</button>
        <button class="btn btn-o btn-sm" onclick="DB.lrF={date:'${TODAY}'};DB.lrSel=[];render()">重置</button>
      </div>
    </div></div>

    <div class="card"><div class="card-hd" style="flex-wrap:wrap;gap:10px">
      <div class="row" style="gap:8px;flex-wrap:wrap;align-items:center">
        <button class="btn btn-p btn-sm" ${sel.length?'':'disabled'} onclick="lr_batch()">批量补打${sel.length?`（已选 ${sel.length}）`:''}</button>
        <button class="btn btn-o btn-sm" onclick="toast('已导出补打清单.xlsx','ok')">导出</button>
        <span style="font-size:12px;color:var(--ts)">补打原码重出；多退少补逐件/逐张选，不进批量；单次上限 ${MAX_PER_TIME} 张，窗口 ${WINDOW_DAYS} 天</span>
      </div>
    </div>
    <div class="card-bd flush"><div style="overflow-x:auto"><table>
      <thead><tr>
        <th style="width:34px"><input type="checkbox" ${allSel?'checked':''} onclick="lr_selAll()"></th>
        <th style="width:44px">序号</th><th>商家</th><th>标签类型</th><th>送货单号</th><th>备货单号 / 预贴批次</th><th>商品编码</th><th>商品名称</th><th>规格</th><th>入库仓库</th><th>温层</th><th>计价方式</th>
        <th style="text-align:right">数量</th><th style="text-align:right">已打张数</th><th>补打粒度</th><th style="text-align:right">已补打</th><th>操作</th>
      </tr></thead><tbody>
      ${body||`<tr><td colspan="17"><div class="empty"><div class="e-ic">🏷️</div><div class="e-t">没查到可补打的标签</div><div class="e-s">换个日期或商品编码；也可直接输标签上的送货单号 / 预贴批次 / 标签号。</div></div></td></tr>`}
      </tbody></table></div></div></div>`;
  }

  function logView(){
    const log=DB.lrLog||[];
    return `
    <div class="card" style="margin-bottom:14px"><div class="card-bd" style="padding:0">
      <div style="display:flex;justify-content:space-between;align-items:center;padding:0 16px;flex-wrap:wrap">
        <div class="tabs" style="margin:0;border:none">
          <div class="tab" onclick="DB.lrTab='list';render()">标签补打</div>
          <div class="tab active" onclick="DB.lrTab='log';render()">补打记录${log.length?`（${log.length}）`:''}</div>
        </div>
      </div>
    </div></div>
    <div class="card"><div class="card-hd">
      <h3>补打记录</h3><span class="sub">每次补打留痕：谁补的、哪类标签、补了哪些、为什么补</span>
    </div>
    <div class="card-bd flush"><div style="overflow-x:auto"><table>
      <thead><tr><th>补打时间</th><th>操作人</th><th>商家</th><th>标签类型</th><th>单据 / 批次</th><th>商品编码</th><th>商品名称</th><th>计价方式</th><th>补打粒度</th><th>补打范围</th><th style="text-align:right">张数</th><th>补打原因</th><th>纸张</th></tr></thead>
      <tbody>${log.map(l=>`<tr>
        <td>${l.time}</td><td>${l.op}</td><td>${l.shop}</td><td>${bindTag(l.bind)}</td><td class="mono">${l.doc}</td>
        <td class="mono">${l.sku}</td><td><b>${l.name}</b></td><td>${typeTag(l.type)}</td>
        <td style="font-size:12px;color:var(--ts)">${l.grain}</td>
        <td class="mono">${l.seq}</td><td style="text-align:right"><b>${l.n}</b></td>
        <td>${l.reason=='二维码扫不出'?`<span class="tag t-r"><span class="dot"></span>${l.reason}</span>`:l.reason}</td>
        <td style="color:var(--ts)">${l.paper||'—'}</td>
      </tr>`).join('')||`<tr><td colspan="13"><div class="empty"><div class="e-ic">📄</div><div class="e-t">暂无补打记录</div><div class="e-s">在「标签补打」补打后，这里会留下完整留痕，可按原因统计倒查商家打印质量。</div></div></td></tr>`}
      </tbody></table></div></div></div>`;
  }

  PAGES['p-label-reprint']=()=>DB.lrTab=='log'?logView():listView();
})();
