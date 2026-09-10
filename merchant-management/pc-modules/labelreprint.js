/* PC · 店铺运营平台 > 供货 > 标签补打 —— PAGES['p-label-reprint']
   场景：商家自打的标签送到仓库后二维码扫不出，让商家重打不现实 → 仓库自己补。

   ── 方案（沈亮 2026-09-10 定）────────────────────────────────
   标签体系本来就支持「绑送货单」和「不绑单（预贴）」两种，**仓库补打直接用不绑单那种**：
   输 item 编码 → 填张数 → 打。到仓 WMS 照它已有的「扫数量后逻辑匹配」收，
   不必把原单号、原序号翻出来对。

   刻意不做的三件事：
   - **不做扫码**：来这个页面的前提就是二维码读不出，给个扫码框是自相矛盾的，只能手输/粘贴编码。
   - **不选商家**：item 编码本身唯一且带供货商，系统查出来只读展示即可，不让人多选一步。
   - **不查原单**：不按送货单/备货单/序号定位，补打粒度只剩「填张数」一种
     （多退少补例外，见下）。

   多退少补怎么办：**不复称**。重量本来就在系统里（商家提交过称重），补打时按
   「该供应商今日送货的这个品」把逐件重量列出来，仓库对着实物挑要补哪几件——
   标签纸面上的实发净重是人眼可读的（`LabelTag.tsx:99`），照着找得到。
   这样补出来的重量与商家报重一致，**不触发 BR-14 复称改账、不动发货差额与对账单**。
   实物不在清单里（漏称/多送）才走「手动输重量」兜底，那一张会标记为现场复称。

   代价：失去「补打上限 = 已打张数」这道天然管控，改用 单次上限 + 全量留痕 +
   商家今日已打张数参考 来兜。

   标签号用 RL 前缀（商家自己预贴是 PL），一眼能倒查哪些是仓库补的。

   依赖 inline 脚本全局：DB / toast / modal / modalWide / closeModal / render / nav。 */
(function(){

  /* ============================================================
     演示数据（模块内常量；可变状态挂 DB.lr*）
  ============================================================ */
  const TODAY='2026-09-10';
  const REASONS=['二维码扫不出','标签破损污损','商家漏打','标签内容错误','其他'];
  const PAPERS=['40×30 mm','50×30 mm','60×40 mm','60×50 mm','70×50 mm','80×55 mm'];
  const MAX_ONCE=200;   // BR：单次补打张数上限

  // 平台商品库（演示；真实按 item 编码查）。供货商随编码带出，不用人选。
  const ITEMS=[
    {sku:'xmITEM260803160001',name:'本地小白菜',    spec:'500g/包', unit:'包',shop:'绿鲜源蔬果旗舰店',weigh:false,todayPrinted:140},
    {sku:'xmITEM260803160002',name:'去皮马蹄',      spec:'1kg/袋',  unit:'袋',shop:'绿鲜源蔬果旗舰店',weigh:true, specW:1.00,wUnit:'kg',todayPrinted:40},
    {sku:'xmITEM260803160003',name:'金龙鱼调和油 5L',spec:'5L/桶',  unit:'桶',shop:'绿鲜源蔬果旗舰店',weigh:false,todayPrinted:25},
    {sku:'xmITEM260803160007',name:'冷冻鸡中翅',    spec:'2kg/包',  unit:'包',shop:'绿鲜源蔬果旗舰店',weigh:true, specW:2.00,wUnit:'kg',todayPrinted:18},
    {sku:'xmITEM260805110011',name:'高筋面粉 25kg', spec:'25kg/袋', unit:'袋',shop:'阳光烘焙原料店',  weigh:false,todayPrinted:30},
    {sku:'xmITEM260805110012',name:'黄油块 5kg',    spec:'5kg/箱',  unit:'箱',shop:'阳光烘焙原料店',  weigh:false,todayPrinted:16},
    {sku:'xmITEM260731090021',name:'鲜切椰肉',      spec:'800g/盒', unit:'盒',shop:'椰丰食品旗舰店',  weigh:false,todayPrinted:32},
    {sku:'xmITEM260731090022',name:'去壳生蚝',      spec:'1kg/袋',  unit:'袋',shop:'椰丰食品旗舰店',  weigh:true, specW:1.00,wUnit:'kg',todayPrinted:25},
  ];
  // 多退少补品：该供应商今日送货的逐件实发净重（演示；真实取 /stockprep/weigh/list 的 portions）
  function hnum(str,mod){let h=2166136261;for(let i=0;i<str.length;i++){h^=str.charCodeAt(i);h=Math.imul(h,16777619)>>>0;}
    h^=h>>>13;h=Math.imul(h,0x5bd1e995)>>>0;h^=h>>>15;return (h>>>0)%mod;}
  ITEMS.forEach(r=>{
    if(!r.weigh)return;
    r.portions=[];
    for(let i=1;i<=r.todayPrinted;i++)
      r.portions.push({seq:i,w:+(r.specW+(hnum(r.sku+'p'+i,26)-13)/100).toFixed(2)});
  });
  function itemOf(sku){return ITEMS.find(x=>x.sku==sku);}
  function portionOf(sku,seq){return (itemOf(sku).portions||[]).find(p=>p.seq==seq);}
  // 输入串 → item：编码优先，其次商品名（含模糊）。编码印在标签纸面上，读不出码时还能照着敲。
  function resolveItem(tok){
    const t=String(tok||'').trim();if(!t)return null;
    return ITEMS.find(x=>x.sku.toLowerCase()==t.toLowerCase())
      ||ITEMS.find(x=>x.name==t)||ITEMS.find(x=>x.name.includes(t))||null;
  }

  /* ============================================================
     打印机设置（仓库这台机器的纸张，与商家端各自独立）
  ============================================================ */
  window.lr_paperModal=function(){
    modal(`<div class="mc-hd"><h3>打印机设置</h3><button class="mc-x" onclick="closeModal()">×</button></div>
    <div class="mc-bd">
      <div class="ib ib-b"><span class="i">🖨️</span>选择<b>仓库这台标签打印机</b>实际装的纸张大小，与商家端设置互不影响；<b>选择后方可打印</b>。</div>
      <div class="fr"><label class="fl"><b>*</b>标签纸张大小</label><select id="lrp-paper"><option value="" ${!DB.lrPaper?'selected':''}>请选择纸张大小</option>${PAPERS.map(x=>`<option ${DB.lrPaper==x?'selected':''}>${x}</option>`).join('')}</select></div>
    </div>
    <div class="mc-ft"><button class="btn btn-o" onclick="closeModal()">取消</button><button class="btn btn-p" onclick="lr_savePaper()">保存设置</button></div>`);
  };
  window.lr_savePaper=function(){const v=(document.getElementById('lrp-paper')||{}).value;if(!v){toast('请选择标签纸张大小','err');return;}DB.lrPaper=v;closeModal();render();toast('已设置标签纸张：'+v,'ok');};
  function ensurePaper(){if(!DB.lrPaper){toast('请先在「打印机设置」选择仓库标签机的纸张大小','err');lr_paperModal();return false;}return true;}

  /* ============================================================
     待打印清单
  ============================================================ */
  function cart(){return DB.lrCart||(DB.lrCart=[]);}
  function cartIdx(sku){return cart().findIndex(x=>x.sku==sku);}
  function labels(){return DB.lrLabels||(DB.lrLabels=[]);}
  // 本次补打 = 进这个页面之后打的那些，只做即时反馈；完整历史在「补打记录」Tab
  function session(){return DB.lrSession||(DB.lrSession=[]);}
  function logIt(rec){labels().unshift(rec);session().unshift(rec);}
  function nextId(){DB.lrSeq=(DB.lrSeq||0)+1;return 'RL2609'+String(DB.lrSeq).padStart(5,'0');}
  function nowTxt(){const d=new Date();return TODAY+' '+String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0');}
  function defQty(){return DB.lrLastQty||10;}
  // 清单里这一项本次要打几张
  function itemCount(x){const r=itemOf(x.sku);return r.weigh?(x.sel.length+x.manual.length):(x.qty||0);}
  function cartTotal(){return cart().reduce((a,x)=>a+itemCount(x),0);}

  function cartAdd(sku,qty){
    const r=itemOf(sku);if(!r)return {ok:false};
    const i=cartIdx(sku);
    if(i>=0){if(!r.weigh)cart()[i].qty=Math.min(MAX_ONCE,cart()[i].qty+(qty||defQty()));return {ok:true,dup:true,name:r.name,weigh:r.weigh};}
    cart().push({sku:r.sku,qty:r.weigh?0:(qty||defQty()),sel:[],manual:[]});
    return {ok:true,name:r.name,weigh:r.weigh};
  }

  window.lr_add=function(){
    const el=document.getElementById('lr-code');const v=(el||{}).value||'';
    if(!v.trim()){if(el)el.focus();return;}
    const hit=resolveItem(v);
    if(!hit){toast(`没找到商品编码「${v.trim()}」，请核对标签上印的编码`,'err');if(el)el.select();return;}
    const r=cartAdd(hit.sku);
    if(hit.weigh)DB.lrSku=hit.sku;
    render();
    const n=document.getElementById('lr-code');if(n){n.value='';n.focus();}
    toast(r.dup?`「${hit.name}」已在清单中${hit.weigh?'':'，张数已累加'}`:`已加入清单：${hit.name}`,r.dup?'info':'ok');
  };
  window.lr_pasteModal=function(){
    modal(`<div class="mc-hd"><h3>批量录入商品编码</h3><p>一行一个，支持「商品编码」或「商品编码 + 张数」两列</p><button class="mc-x" onclick="closeModal()">×</button></div>
    <div class="mc-bd">
      <div class="ib ib-b"><span class="i">📋</span>可直接从 Excel 复制两列粘进来；分隔符支持<b>逗号 / 空格 / Tab</b>。只写编码时按默认 <b>${defQty()}</b> 张；<b>多退少补商品张数忽略</b>，加进清单后逐袋复称。</div>
      <div class="fr" style="margin-top:10px"><label class="fl">商品编码清单</label>
        <textarea id="lr-paste" rows="8" placeholder="xmITEM260803160001,20&#10;xmITEM260803160003&#10;去皮马蹄"></textarea></div>
    </div>
    <div class="mc-ft"><button class="btn btn-o" onclick="closeModal()">取消</button>
      <button class="btn btn-p" onclick="lr_pasteDo()">解析并加入清单</button></div>`);
    setTimeout(()=>{const t=document.getElementById('lr-paste');if(t)t.focus();},60);
  };
  window.lr_pasteDo=function(){
    const raw=(document.getElementById('lr-paste')||{}).value||'';
    const rows=raw.split(/[\n\r;]+/).map(x=>x.trim()).filter(Boolean);
    if(!rows.length){toast('请先粘贴商品编码','err');return;}
    let added=0,dup=0;const bad=[];
    rows.forEach(line=>{
      const parts=line.split(/[,，\t ]+/).filter(Boolean);
      const hit=resolveItem(parts[0]);
      if(!hit){bad.push(line);return;}
      const q=parts.length>1?parseInt(parts[1],10):0;
      const r=cartAdd(hit.sku,(q>=1&&q<=MAX_ONCE)?q:0);
      if(r.dup)dup++;else added++;
    });
    closeModal();render();
    toast(bad.length?`已加入 ${added} 项；${bad.length} 行没认出：${bad.slice(0,3).join('、')}${bad.length>3?' 等':''}`
      :`已加入 ${added} 项${dup?`，${dup} 项已在清单（普通品张数已累加）`:''}`,bad.length?'err':'ok');
  };
  window.lr_cartQty=function(sku,v){
    const i=cartIdx(sku);if(i<0)return;
    const n=parseInt(v,10);cart()[i].qty=(n>=1&&n<=MAX_ONCE)?n:0;
    if(n>=1&&n<=MAX_ONCE)DB.lrLastQty=n;render();
  };
  window.lr_cartDel=function(sku){const i=cartIdx(sku);if(i<0)return;const nm=itemOf(sku).name;cart().splice(i,1);
    if(DB.lrSku==sku)DB.lrSku='';render();toast(`已移出清单：${nm}`,'info');};
  window.lr_cartClear=function(){
    if(!cart().length)return;
    modal(`<div class="mc-hd"><h3>清空待打印清单</h3><button class="mc-x" onclick="closeModal()">×</button></div>
    <div class="mc-bd"><div class="ib ib-y"><span class="i">⚠️</span>将移除清单里全部 <b>${cart().length}</b> 项，已打印的标签与记录不受影响。</div></div>
    <div class="mc-ft"><button class="btn btn-o" onclick="closeModal()">取消</button>
      <button class="btn btn-d" onclick="DB.lrCart=[];DB.lrSku='';closeModal();render();toast('已清空清单','info')">确认清空</button></div>`);
  };
  /* ── 多退少补：挑要补哪几件（重量取商家已提交的称重结果，不复称）── */
  window.lr_pickWeigh=function(sku){DB.lrSku=sku;lr_weighDrawer();};
  window.lr_wToggle=function(seq){
    const x=cart()[cartIdx(DB.lrSku)];if(!x)return;
    const i=x.sel.indexOf(seq);if(i<0)x.sel.push(seq);else x.sel.splice(i,1);lr_weighDrawer();
  };
  window.lr_wAll=function(){
    const r=itemOf(DB.lrSku);const x=cart()[cartIdx(DB.lrSku)];if(!x)return;
    x.sel=x.sel.length==r.portions.length?[]:r.portions.map(p=>p.seq);lr_weighDrawer();
  };
  window.lr_wFilter=function(v){DB.lrWq=v;lr_weighDrawer();};
  window.lr_wManualDel=function(i){const x=cart()[cartIdx(DB.lrSku)];if(!x)return;x.manual.splice(i,1);lr_weighDrawer();};
  window.lr_wManualAdd=function(){
    const x=cart()[cartIdx(DB.lrSku)];const el=document.getElementById('lr-mw');
    const w=parseFloat((el||{}).value);
    if(!(w>0)){toast('请输入净重','err');if(el)el.focus();return;}
    x.manual.push(+w.toFixed(2));lr_weighDrawer();
    const n=document.getElementById('lr-mw');if(n){n.value='';n.focus();}
    toast(`已加入现场复称 ${w.toFixed(2)}，该张会标记为复称`,'info');
  };
  window.lr_wDone=function(){closeDrawer();render();};

  function lr_weighDrawer(){
    const r=itemOf(DB.lrSku);const x=cart()[cartIdx(DB.lrSku)];if(!r||!x)return;
    const q=(DB.lrWq||'').trim();
    const list=r.portions.filter(p=>!q||String(p.w).includes(q)||String(p.seq)==q);
    const all=x.sel.length==r.portions.length&&r.portions.length>0;
    drawer(`
      <div class="mc-hd">
        <h3>选择要补打的件 · ${r.name}</h3>
        <p>${r.shop} · 今日送货 <b>${r.portions.length}</b> 件 · 已选 <b>${x.sel.length+x.manual.length}</b> 件</p>
        <button class="mc-x" onclick="closeDrawer()">×</button>
      </div>
      <div class="mc-bd" style="padding:18px 20px">
        <div class="ib ib-b"><span class="i">⚖️</span>下面是<b>该供应商今日送货</b>这个品的逐件实发净重，取自商家已提交的称重结果。
          坏标签纸面上的<b>实发净重</b>是人眼可读的，照着找到对应那件勾上即可——补出来的重量与商家报重一致，<b>不改发货差额、不动对账单</b>。</div>
        <div class="row" style="gap:10px;align-items:flex-end;margin:12px 0 10px">
          <div class="fr" style="flex:0 0 220px;margin:0"><label class="fl">按重量 / 序号筛</label>
            <input value="${DB.lrWq||''}" placeholder="如 1.02 或 7" oninput="lr_wFilter(this.value)"></div>
          <div style="padding-bottom:9px;font-size:12px;color:var(--ts)">一件应发 ${r.specW.toFixed(2)}${r.wUnit}</div>
        </div>
        <div style="overflow-x:auto;max-height:380px;overflow-y:auto;border:1px solid var(--bd2);border-radius:8px"><table>
          <thead><tr>
            <th style="width:34px"><input type="checkbox" ${all?'checked':''} onclick="lr_wAll()"></th>
            <th style="width:70px">序号</th><th style="text-align:right">实发净重</th><th style="text-align:right">差异</th>
          </tr></thead><tbody>${list.map(pp=>{const d=+(pp.w-r.specW).toFixed(2);
            return `<tr${x.sel.includes(pp.seq)?' style="background:var(--gl)"':''}>
              <td><input type="checkbox" ${x.sel.includes(pp.seq)?'checked':''} onclick="lr_wToggle(${pp.seq})"></td>
              <td>${pp.seq}</td>
              <td style="text-align:right"><b>${pp.w.toFixed(2)}</b> <span style="color:var(--ts)">${r.wUnit}</span></td>
              <td style="text-align:right;color:${d>=0?'var(--gd)':'var(--y)'}">${d>=0?'+':''}${d.toFixed(2)}</td>
            </tr>`;}).join('')||`<tr><td colspan="4"><div class="empty" style="padding:22px 0"><div class="e-t">没有匹配的件</div><div class="e-s">清空筛选，或用下方「手动输重量」兜底。</div></div></td></tr>`}</tbody>
        </table></div>

        <div style="display:flex;align-items:baseline;gap:8px;margin:18px 0 8px">
          <div style="font-size:14px;font-weight:600">实物不在清单里？手动输重量</div>
          <div style="font-size:12px;color:var(--ts)">商家漏称 / 多送时才用</div>
        </div>
        <div class="ib ib-y"><span class="i">⚠️</span>手输的重量属<b>现场复称</b>：按 BR-14，与商家报重偏差 &gt;3% 以平台为准并计质量分，<b>会改动发货差额与对账单</b>，补完请知会商家。</div>
        <div class="row" style="gap:10px;align-items:flex-end;margin-top:10px">
          <div class="fr" style="flex:0 0 200px;margin:0"><label class="fl">本袋净重（${r.wUnit}）</label>
            <input id="lr-mw" type="number" step="0.01" min="0" placeholder="过秤后输入，回车加入"
              onkeydown="if(event.key=='Enter'){event.preventDefault();lr_wManualAdd()}"></div>
          <button class="btn btn-o btn-sm" onclick="lr_wManualAdd()">加入</button>
        </div>
        ${x.manual.length?`<div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap">${x.manual.map((w,i)=>
          `<span class="tag t-y" style="font-size:12px">复称 ${w.toFixed(2)}${r.wUnit} <b style="cursor:pointer;margin-left:4px" onclick="lr_wManualDel(${i})">×</b></span>`).join('')}</div>`:''}
      </div>
      <div class="mc-ft">
        <button class="btn btn-o" onclick="closeDrawer()">取消</button>
        <button class="btn btn-p" onclick="lr_wDone()">确定（已选 ${x.sel.length+x.manual.length} 件）</button>
      </div>`);
  }

  /* ============================================================
     打印
  ============================================================ */
  window.lr_printBatch=function(){
    if(!ensurePaper())return;
    const ready=cart().filter(x=>itemCount(x)>0);
    const pending=cart().filter(x=>itemOf(x.sku).weigh&&itemCount(x)==0);
    if(!ready.length){toast(pending.length?'多退少补商品还没挑要补哪几件，请先点「选择要补的件」':'清单里没有可打印的商品','err');return;}
    const total=cartTotal();
    if(total>MAX_ONCE){toast(`单次上限 ${MAX_ONCE} 张，当前 ${total} 张，请分批`,'err');return;}
    const anyManual=ready.some(x=>x.manual.length);
    modalWide(`<div class="mc-hd"><h3>批量补打确认</h3><p>${ready.length} 个商品 · ${total} 张</p><button class="mc-x" onclick="closeModal()">×</button></div>
    <div class="mc-bd">
      <div class="ib ib-y"><span class="i">🏷️</span>打的是<b>不绑送货单</b>的新标签，到仓 WMS 扫码后按数量逻辑匹配。<b>请务必销毁扫不出的旧标签</b>，否则同一件货会被计两次。</div>
      <div style="overflow-x:auto;margin-top:10px"><table>
        <thead><tr><th>商品编码</th><th>商品名称</th><th>规格</th><th>供货商</th><th>计价方式</th><th style="text-align:right">商家今日已打</th><th>补打内容</th><th style="text-align:right">张数</th></tr></thead>
        <tbody>${ready.map(x=>{const r=itemOf(x.sku);
          const detail=r.weigh
            ?`<span class="mono" style="font-size:12px">${x.sel.slice(0,5).map(q=>portionOf(x.sku,q).w.toFixed(2)).join('、')}${x.sel.length>5?` 等 ${x.sel.length} 件`:''}${x.manual.length?`<span style="color:var(--y)"> + 复称 ${x.manual.length} 件</span>`:''}</span>`
            :'<span style="color:var(--ts)">张张相同、无序号</span>';
          return `<tr><td class="mono">${x.sku}</td><td><b>${r.name}</b></td><td>${r.spec}</td><td>${r.shop}</td>
          <td>${r.weigh?'<span class="tag t-y"><span class="dot"></span>多退少补</span>':'<span class="tag t-gr"><span class="dot"></span>普通</span>'}</td>
          <td style="text-align:right;color:var(--ts)">${r.todayPrinted} 张</td>
          <td>${detail}</td>
          <td style="text-align:right"><b>${itemCount(x)}</b></td></tr>`;}).join('')}</tbody>
      </table></div>
      ${pending.length?`<div class="ib ib-r" style="margin-top:10px"><span class="i">⚖️</span>另有 <b>${pending.length}</b> 个多退少补商品还没挑件，本次不打；挑完再打一轮即可。</div>`:''}
      ${anyManual?`<div class="ib ib-y" style="margin-top:10px"><span class="i">⚠️</span>本次含<b>手动输入重量</b>的件，属现场复称（BR-14），会改动发货差额与对账单，补完请知会商家。</div>`:''}
      <div class="fr" style="margin-top:12px"><label class="fl"><b>*</b>补打原因</label>
        <select id="lr-reason">${REASONS.map(x=>`<option>${x}</option>`).join('')}</select></div>
    </div>
    <div class="mc-ft"><button class="btn btn-o" onclick="closeModal()">取消</button>
      <button class="btn btn-o" onclick="toast('已下载「补打标签_${total}张.pdf」，打印助手未启动时可用系统打印机应急','ok')">下载 PDF</button>
      <button class="btn btn-p" onclick="lr_doBatch()">确认补打（${total} 张）</button></div>`);
  };
  window.lr_doBatch=function(){
    const reason=(document.getElementById('lr-reason')||{}).value||REASONS[0];
    const ready=cart().filter(x=>itemCount(x)>0);
    let n=0;
    ready.forEach(x=>{
      const r=itemOf(x.sku);
      const base={shop:r.shop,sku:r.sku,name:r.name,spec:r.spec,time:nowTxt(),op:'运营管理员',reason,paper:DB.lrPaper};
      if(!r.weigh){logIt(Object.assign({id:nextId(),type:'normal',qty:x.qty},base));n+=x.qty;return;}
      // 多退少补：一件一张，各带各的重量；手输的标记 recheck（现场复称）
      x.sel.slice().sort((a,b)=>a-b).forEach(q=>{
        logIt(Object.assign({id:nextId(),type:'weigh',qty:1,w:portionOf(x.sku,q).w,wUnit:r.wUnit,srcSeq:q},base));n++;});
      x.manual.forEach(w=>{
        logIt(Object.assign({id:nextId(),type:'weigh',qty:1,w,wUnit:r.wUnit,recheck:true},base));n++;});
    });
    DB.lrCart=cart().filter(x=>itemCount(x)==0);   // 打完的移出，没挑件的留着
    DB.lrSku='';closeModal();render();
    toast(`已补打 ${ready.length} 个商品共 ${n} 张（不绑送货单）；请销毁旧标签`,'ok');
  };

  function ledgerRow(x){return `<tr>
      <td class="mono">${x.id}</td>
      <td class="mono">${x.sku}</td>
      <td><b>${x.name}</b></td>
      <td>${x.spec}</td>
      <td>${x.shop}</td>
      <td>${x.type=='weigh'?'<span class="tag t-y"><span class="dot"></span>多退少补</span>':'<span class="tag t-gr"><span class="dot"></span>普通</span>'}</td>
      <td style="text-align:right">${x.type=='weigh'?`<b>${x.w.toFixed(2)}</b> <span style="color:var(--ts)">${x.wUnit}</span>${x.recheck?' <span class="tag t-y" style="font-size:10px">现场复称</span>':''}`:'<span style="color:var(--tt)">—</span>'}</td>
      <td style="text-align:right"><b>${x.qty}</b></td>
      <td>${x.reason=='二维码扫不出'?`<span class="tag t-r"><span class="dot"></span>${x.reason}</span>`:x.reason}</td>
      <td>${x.op}</td>
      <td style="color:var(--ts)">${x.time}</td>
    </tr>`;}
  function ledgerSync(rec){
    const tb=document.getElementById('lr-ledger');
    if(tb)tb.insertAdjacentHTML('afterbegin',ledgerRow(rec));
    const h=document.getElementById('lr-ledger-cnt');
    if(h)h.textContent=`${session().length} 条 · ${session().reduce((a,x)=>a+x.qty,0)} 张`;
    // 卡片本身在本次第一张打出来之前不存在 → 整页重渲把它带出来
    if(!tb)render();
  }

  /* ============================================================
     视图
  ============================================================ */
  function listView(){
    DB.lrCart=DB.lrCart||[];
    const c=cart();
    const total=cartTotal();
    const pending=c.filter(x=>itemOf(x.sku).weigh&&itemCount(x)==0).length;
    const list=labels(), sess=session();

    const cartBody=c.map(x=>{const r=itemOf(x.sku);const need=r.weigh&&itemCount(x)==0;
      return `<tr${need?' style="background:#FDF6F5"':''}>
      <td class="mono">${r.sku}</td>
      <td><b>${r.name}</b></td>
      <td>${r.spec}</td>
      <td>${r.shop}</td>
      <td>${r.weigh?'<span class="tag t-y"><span class="dot"></span>多退少补</span>':'<span class="tag t-gr"><span class="dot"></span>普通</span>'}</td>
      <td style="text-align:right;color:var(--ts)">${r.todayPrinted} 张</td>
      <td style="text-align:right">${r.weigh
        ?(itemCount(x)
          ?`<span class="mono" style="font-size:12px">${x.sel.slice().sort((a,b)=>a-b).slice(0,4).map(q=>portionOf(x.sku,q).w.toFixed(2)).join('、')}${x.sel.length>4?' 等':''}${x.manual.length?`<span style="color:var(--y)"> +复称 ${x.manual.length}</span>`:''}</span>`
          :'<span style="color:var(--r)">待挑件</span>')
        :`<input type="number" min="1" max="${MAX_ONCE}" value="${x.qty}" class="ministock" style="width:84px;text-align:right" onchange="lr_cartQty('${r.sku}',this.value)">`}</td>
      <td style="text-align:right"><b>${itemCount(x)}</b></td>
      <td style="white-space:nowrap">${r.weigh
        ?`<button class="btn ${itemCount(x)?'btn-o':'btn-p'} btn-sm" onclick="lr_pickWeigh('${r.sku}')">${itemCount(x)?`已选 ${itemCount(x)} 件，改选`:'选择要补的件'}</button>`
        :''}
        <button class="btn btn-link btn-sm" onclick="lr_cartDel('${r.sku}')">移除</button></td>
    </tr>`;}).join('');

    return `
    <div class="card" style="margin-bottom:14px"><div class="card-bd" style="padding:0">
      <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid var(--bd2);padding:0 16px;flex-wrap:wrap">
        <div class="tabs" style="margin:0;border:none">
          <div class="tab active">标签补打</div>
          <div class="tab" onclick="DB.lrTab='log';render()">补打记录${list.length?`（${list.length}）`:''}</div>
        </div>
        <div style="display:flex;gap:16px;font-size:12.5px;padding:6px 0">
          <span class="btn btn-link" onclick="lr_paperModal()">🖨️ 打印机设置 · ${DB.lrPaper?`<b style="color:var(--gd)">${DB.lrPaper}</b>`:'<b style="color:var(--r)">未设置纸张</b>'}</span>
        </div>
      </div>
      <div style="display:flex;gap:16px;align-items:flex-end;flex-wrap:wrap;padding:14px 16px">
        <div style="flex:1;min-width:320px"><div style="font-size:12px;color:var(--ts);margin-bottom:5px">商品编码</div>
          <input id="lr-code" placeholder="照标签上印的商品编码输入，回车加入清单（也可输商品名）" style="width:100%"
            onkeydown="if(event.key=='Enter'){event.preventDefault();lr_add()}"></div>
        <button class="btn btn-p btn-sm" onclick="lr_add()">加入清单</button>
        <button class="btn btn-o btn-sm" onclick="lr_pasteModal()">批量粘贴</button>
      </div>
    </div></div>

    <div class="card" style="margin-bottom:14px"><div class="card-hd" style="flex-wrap:wrap;gap:10px">
      <div class="row" style="gap:8px;flex-wrap:wrap;align-items:center">
        <h3 style="margin-right:6px">待打印清单</h3>
        <button class="btn btn-p btn-sm" ${total?'':'disabled'} onclick="lr_printBatch()">批量补打${total?`（${total} 张）`:''}</button>
        <button class="btn btn-o btn-sm" ${c.length?'':'disabled'} onclick="lr_cartClear()">清空清单</button>
        ${pending?`<span style="font-size:12px;color:var(--r)">${pending} 个多退少补商品还没挑件</span>`:''}
      </div>
      <span class="sub">补打的是<b>不绑送货单</b>的新标签，到仓 WMS 扫码后按数量逻辑匹配；多退少补按该供应商今日送货的逐件重量挑</span>
    </div>
    <div class="card-bd flush"><div style="overflow-x:auto"><table>
      <thead><tr><th>商品编码</th><th>商品名称</th><th>规格</th><th>供货商</th><th>计价方式</th><th style="text-align:right">商家今日已打</th><th style="text-align:right">补打张数 / 重量</th><th style="text-align:right">张数</th><th>操作</th></tr></thead>
      <tbody>${cartBody||`<tr><td colspan="9"><div class="empty"><div class="e-ic">🧾</div><div class="e-t">清单还是空的</div><div class="e-s">照坏标签上印的商品编码敲进去，或用「批量粘贴」一次贴一列。<br>供货商随编码自动带出，不用选。</div></div></td></tr>`}</tbody>
    </table></div></div></div>

    ${sess.length?`
    <div class="card"><div class="card-hd"><h3>本次补打</h3>
      <span class="sub"><b id="lr-ledger-cnt">${sess.length} 条 · ${sess.reduce((a,x)=>a+x.qty,0)} 张</b> —— 刚打出来的这批，完整历史见上方「补打记录」</span></div>
    <div class="card-bd flush"><div style="overflow-x:auto"><table>
      <thead><tr><th>标签号</th><th>商品编码</th><th>商品名称</th><th>规格</th><th>供货商</th><th>计价方式</th><th style="text-align:right">本袋净重</th><th style="text-align:right">张数</th><th>补打原因</th><th>操作人</th><th>补打时间</th></tr></thead>
      <tbody id="lr-ledger">${sess.map(ledgerRow).join('')}</tbody>
    </table></div></div></div>`:''}`;
  }

  function logView(){
    const list=labels();
    const byReason={};list.forEach(x=>{byReason[x.reason]=(byReason[x.reason]||0)+x.qty;});
    const byShop={};list.forEach(x=>{byShop[x.shop]=(byShop[x.shop]||0)+x.qty;});
    return `
    <div class="card" style="margin-bottom:14px"><div class="card-bd" style="padding:0">
      <div style="display:flex;justify-content:space-between;align-items:center;padding:0 16px;flex-wrap:wrap">
        <div class="tabs" style="margin:0;border:none">
          <div class="tab" onclick="DB.lrTab='list';render()">标签补打</div>
          <div class="tab active">补打记录${list.length?`（${list.length}）`:''}</div>
        </div>
      </div>
    </div></div>
    <div class="card" style="margin-bottom:14px"><div class="card-hd"><h3>按原因 / 供货商统计</h3>
      <span class="sub">补打量集中在哪个商家、哪个原因，就该去修那条打印链路，而不是让仓库天天补</span></div>
      <div class="card-bd flush"><div style="overflow-x:auto"><table>
        <thead><tr><th>维度</th><th>项</th><th style="text-align:right">补打张数</th></tr></thead>
        <tbody>${Object.entries(byReason).map(([k,v])=>`<tr><td style="color:var(--ts)">补打原因</td><td>${k}</td><td style="text-align:right"><b>${v}</b></td></tr>`).join('')
          +Object.entries(byShop).map(([k,v])=>`<tr><td style="color:var(--ts)">供货商</td><td>${k}</td><td style="text-align:right"><b>${v}</b></td></tr>`).join('')
          ||`<tr><td colspan="3"><div class="empty"><div class="e-ic">📊</div><div class="e-t">暂无数据</div><div class="e-s">补打后这里按原因和供货商聚合。</div></div></td></tr>`}</tbody>
      </table></div></div></div>
    <div class="card"><div class="card-hd"><h3>补打明细</h3><span class="sub">共 ${list.length} 条 · ${list.reduce((a,x)=>a+x.qty,0)} 张</span></div>
    <div class="card-bd flush"><div style="overflow-x:auto"><table>
      <thead><tr><th>标签号</th><th>商品编码</th><th>商品名称</th><th>规格</th><th>供货商</th><th>计价方式</th><th style="text-align:right">本袋净重</th><th style="text-align:right">张数</th><th>补打原因</th><th>操作人</th><th>补打时间</th></tr></thead>
      <tbody>${list.map(ledgerRow).join('')||`<tr><td colspan="11"><div class="empty"><div class="e-ic">📄</div><div class="e-t">暂无补打记录</div><div class="e-s">仓库补打的标签都会留在这里。</div></div></td></tr>`}</tbody>
    </table></div></div></div>`;
  }

  PAGES['p-label-reprint']=()=>{
    const html=DB.lrTab=='log'?logView():listView();
    if(DB.lrTab!='log')setTimeout(()=>{const el=document.getElementById('lr-code');if(el)el.focus();},50);  // 进页面光标就在编码框
    return html;
  };
})();
