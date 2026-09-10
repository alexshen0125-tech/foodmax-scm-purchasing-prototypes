/* PC · 店铺运营平台 > 供货 > 标签补打 —— PAGES['p-label-reprint']
   场景：商家自打的标签送到仓库后二维码扫不出，让商家重打不现实 → 仓库自己补。

   ── 方案（沈亮 2026-09-10 定）────────────────────────────────
   既然标签体系本来就支持「绑送货单」和「不绑单（预贴）」两种，**仓库补打直接用不绑单那种**：
   选商家 → 输 SKU → 填张数（多退少补逐袋称重）→ 打。到仓 WMS 照它已有的
   「扫数量后逻辑匹配」收，不需要把原单号、原序号翻出来对。

   这不是「原码重出」而是「重贴一批新的不绑单标签」，因此：
   ① 不再需要按 送货单/备货单/序号 定位，四种补打粒度收敛成一种——按张数（普通）
      / 逐袋称重（多退少补），页面复杂度大幅下降；
   ② 多退少补拿不到原重量（标签都读不出了），只能**现场复称**——这走既有
      BR-14「DC 交接抽检复称，与报重偏差 >3% 以平台为准并计质量分」，会影响
      商家发货差额，须回推商家（见 scm_多退少补称重_prd.md BR-14/BR-16）；
   ③ 失去「补打上限 = 已打张数」这道天然管控，改用 单次上限 + 全量留痕 + 商家
      今日已打张数参考 来兜。

   标签号用 RL 前缀（商家自己预贴是 PL），一眼能倒查哪些是仓库重贴的。

   依赖 inline 脚本全局：DB / toast / modal / modalWide / closeModal / render / nav / COMM_SHOPS。 */
(function(){

  /* ============================================================
     演示数据（模块内常量；可变状态挂 DB.lr*）
  ============================================================ */
  const TODAY='2026-09-10';
  const SHOPS=(typeof COMM_SHOPS!=='undefined'&&COMM_SHOPS.length)?COMM_SHOPS
    :[{code:'M2026-0815',name:'绿鲜源蔬果旗舰店'},{code:'M2026-0820',name:'阳光烘焙原料店'},{code:'M2026-0805',name:'椰丰食品旗舰店'}];
  const REASONS=['二维码扫不出','标签破损污损','商家漏打','标签内容错误','其他'];
  const PAPERS=['40×30 mm','50×30 mm','60×40 mm','60×50 mm','70×50 mm','80×55 mm'];
  const MAX_ONCE=200;   // BR：单次重贴张数上限

  // 各商家在售商品（演示；真实取平台商品库 by shopCode）
  const CATALOG={
    'M2026-0815':[
      {sku:'xmITEM260803160001',name:'本地小白菜',spec:'500g/包',unit:'包',weigh:false,todayPrinted:140},
      {sku:'xmITEM260803160002',name:'去皮马蹄',  spec:'1kg/袋', unit:'袋',weigh:true, specW:1.00,wUnit:'kg',todayPrinted:40},
      {sku:'xmITEM260803160003',name:'金龙鱼调和油 5L',spec:'5L/桶',unit:'桶',weigh:false,todayPrinted:25},
      {sku:'xmITEM260803160007',name:'冷冻鸡中翅',spec:'2kg/包', unit:'包',weigh:true, specW:2.00,wUnit:'kg',todayPrinted:18},
    ],
    'M2026-0820':[
      {sku:'xmITEM260805110011',name:'高筋面粉 25kg',spec:'25kg/袋',unit:'袋',weigh:false,todayPrinted:30},
      {sku:'xmITEM260805110012',name:'黄油块 5kg',  spec:'5kg/箱', unit:'箱',weigh:false,todayPrinted:16},
    ],
    'M2026-0805':[
      {sku:'xmITEM260731090021',name:'鲜切椰肉',spec:'800g/盒',unit:'盒',weigh:false,todayPrinted:32},
      {sku:'xmITEM260731090022',name:'去壳生蚝',spec:'1kg/袋',unit:'袋',weigh:true, specW:1.00,wUnit:'kg',todayPrinted:25},
    ],
  };
  function shopName(code){return (SHOPS.find(s=>s.code==code)||{}).name||code;}
  function catalog(){return CATALOG[DB.lrShop]||[];}
  function skuOf(sku){return catalog().find(x=>x.sku==sku);}

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
  function ensureReady(){
    if(!DB.lrShop){toast('请先选择这批货属于哪个商家——标签上要印供货商','err');return false;}
    if(!DB.lrPaper){toast('请先在「打印机设置」选择仓库标签机的纸张大小','err');lr_paperModal();return false;}
    return true;
  }

  /* ============================================================
     待打印清单
  ============================================================ */
  function cart(){return DB.lrCart||(DB.lrCart=[]);}
  function cartIdx(sku){return cart().findIndex(x=>x.sku==sku);}
  function labels(){return DB.lrLabels||(DB.lrLabels=[]);}
  function nextId(){DB.lrSeq=(DB.lrSeq||0)+1;return 'RL2609'+String(DB.lrSeq).padStart(5,'0');}
  function nowTxt(){const d=new Date();return TODAY+' '+String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0');}
  function defQty(){return DB.lrLastQty||10;}
  function doneOf(sku){return labels().filter(x=>x.shop==DB.lrShop&&x.sku==sku&&x.type=='weigh').length;}

  function cartAdd(sku,qty){
    const r=skuOf(sku);if(!r)return {ok:false};
    const i=cartIdx(sku);
    if(i>=0){if(!r.weigh)cart()[i].qty=Math.min(MAX_ONCE,cart()[i].qty+(qty||defQty()));return {ok:true,dup:true,name:r.name,weigh:r.weigh};}
    cart().push({sku:r.sku,name:r.name,spec:r.spec,weigh:r.weigh,specW:r.specW,wUnit:r.wUnit,unit:r.unit,
      qty:r.weigh?0:(qty||defQty())});
    return {ok:true,name:r.name,weigh:r.weigh};
  }
  // 输入串 → SKU：商品编码 / 名称（含模糊），不区分大小写
  function resolveSku(tok){
    const t=String(tok||'').trim();if(!t)return null;const all=catalog();
    return all.find(x=>x.sku.toLowerCase()==t.toLowerCase())||all.find(x=>x.name==t)||all.find(x=>x.name.includes(t))||null;
  }

  window.lr_pickShop=function(v){
    if(cart().length&&v!=DB.lrShop){
      toast('切换商家会清空当前清单，请先打完或清空','err');render();return;
    }
    DB.lrShop=v;DB.lrSku='';render();
    setTimeout(()=>{const el=document.getElementById('lr-scan');if(el)el.focus();},50);
  };
  window.lr_scanAdd=function(){
    if(!DB.lrShop){toast('请先选择商家','err');return;}
    const el=document.getElementById('lr-scan');const v=(el||{}).value||'';
    if(!v.trim()){if(el)el.focus();return;}
    const hit=resolveSku(v);
    if(!hit){toast(`「${shopName(DB.lrShop)}」名下没找到「${v.trim()}」，请核对商品编码`,'err');if(el)el.select();return;}
    const r=cartAdd(hit.sku);
    if(hit.weigh)DB.lrSku=hit.sku;
    render();
    const n=document.getElementById('lr-scan');if(n){n.value='';n.focus();}   // 支持扫码枪连扫
    toast(r.dup?`「${hit.name}」已在清单中${hit.weigh?'':'，张数已累加'}`:`已加入清单：${hit.name}`,r.dup?'info':'ok');
  };
  window.lr_pickAdd=function(v){
    if(!v)return;const hit=skuOf(v);if(!hit)return;
    const r=cartAdd(v);if(hit.weigh)DB.lrSku=v;
    render();toast(r.dup?`「${hit.name}」已在清单中${hit.weigh?'':'，张数已累加'}`:`已加入清单：${hit.name}`,r.dup?'info':'ok');
  };
  window.lr_pasteModal=function(){
    if(!DB.lrShop){toast('请先选择商家','err');return;}
    modal(`<div class="mc-hd"><h3>批量录入商品</h3><p>${shopName(DB.lrShop)} · 一行一个，支持「商品编码」或「商品编码 + 张数」两列</p><button class="mc-x" onclick="closeModal()">×</button></div>
    <div class="mc-bd">
      <div class="ib ib-b"><span class="i">📋</span>可直接从 Excel 复制两列粘进来；分隔符支持<b>逗号 / 空格 / Tab</b>。只写编码时按默认 <b>${defQty()}</b> 张；<b>多退少补商品张数忽略</b>，加进清单后逐袋称重。</div>
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
      const hit=resolveSku(parts[0]);
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
  window.lr_cartDel=function(sku){const i=cartIdx(sku);if(i<0)return;const nm=cart()[i].name;cart().splice(i,1);
    if(DB.lrSku==sku)DB.lrSku='';render();toast(`已移出清单：${nm}`,'info');};
  window.lr_cartClear=function(){
    if(!cart().length)return;
    modal(`<div class="mc-hd"><h3>清空待打印清单</h3><button class="mc-x" onclick="closeModal()">×</button></div>
    <div class="mc-bd"><div class="ib ib-y"><span class="i">⚠️</span>将移除清单里全部 <b>${cart().length}</b> 项，已打印的标签与记录不受影响。</div></div>
    <div class="mc-ft"><button class="btn btn-o" onclick="closeModal()">取消</button>
      <button class="btn btn-d" onclick="DB.lrCart=[];DB.lrSku='';closeModal();render();toast('已清空清单','info')">确认清空</button></div>`);
  };
  window.lr_weighStart=function(sku){DB.lrSku=sku;render();
    setTimeout(()=>{const el=document.getElementById('lr-w');if(el)el.focus();},60);};

  /* ============================================================
     打印
  ============================================================ */
  window.lr_printBatch=function(){
    if(!ensureReady())return;
    const normals=cart().filter(x=>!x.weigh&&x.qty>=1);
    const weighs=cart().filter(x=>x.weigh);
    if(!normals.length){toast(weighs.length?'清单里只有多退少补商品，需逐袋称重打印':'清单里没有可批量打印的普通商品','err');return;}
    const total=normals.reduce((a,x)=>a+x.qty,0);
    if(total>MAX_ONCE){toast(`单次上限 ${MAX_ONCE} 张，当前 ${total} 张，请分批`,'err');return;}
    modalWide(`<div class="mc-hd"><h3>批量补打确认</h3><p>${shopName(DB.lrShop)} · ${normals.length} 个商品 · ${total} 张</p><button class="mc-x" onclick="closeModal()">×</button></div>
    <div class="mc-bd">
      <div class="ib ib-y"><span class="i">🏷️</span>打的是<b>不绑送货单</b>的新标签（张张相同、无序号），到仓 WMS 扫码后按数量逻辑匹配。<b>请务必销毁扫不出的旧标签</b>，否则同一件货会被计两次。</div>
      <div style="overflow-x:auto;margin-top:10px"><table>
        <thead><tr><th>商品编码</th><th>商品名称</th><th>规格</th><th style="text-align:right">商家今日已打</th><th style="text-align:right">本次补打</th></tr></thead>
        <tbody>${normals.map(x=>{const c=skuOf(x.sku)||{};
          return `<tr><td class="mono">${x.sku}</td><td><b>${x.name}</b></td><td>${x.spec}</td>
          <td style="text-align:right;color:var(--ts)">${c.todayPrinted||0} 张</td>
          <td style="text-align:right"><b>${x.qty}</b></td></tr>`;}).join('')}</tbody>
      </table></div>
      ${weighs.length?`<div class="ib ib-r" style="margin-top:10px"><span class="i">⚖️</span>清单里另有 <b>${weighs.length}</b> 个多退少补商品<b>不进批量</b>：每袋重量不同，需逐袋现场复称打印。</div>`:''}
      <div class="fr" style="margin-top:12px"><label class="fl"><b>*</b>补打原因</label>
        <select id="lr-reason">${REASONS.map(x=>`<option>${x}</option>`).join('')}</select></div>
    </div>
    <div class="mc-ft"><button class="btn btn-o" onclick="closeModal()">取消</button>
      <button class="btn btn-o" onclick="toast('已下载「补打标签_${total}张.pdf」，打印助手未启动时可用系统打印机应急','ok')">下载 PDF</button>
      <button class="btn btn-p" onclick="lr_doBatch()">确认补打（${total} 张）</button></div>`);
  };
  window.lr_doBatch=function(){
    const reason=(document.getElementById('lr-reason')||{}).value||REASONS[0];
    const normals=cart().filter(x=>!x.weigh&&x.qty>=1);
    let n=0;
    normals.forEach(x=>{labels().unshift({id:nextId(),shop:DB.lrShop,shopName:shopName(DB.lrShop),
      sku:x.sku,name:x.name,spec:x.spec,type:'normal',qty:x.qty,time:nowTxt(),op:'运营管理员',reason,paper:DB.lrPaper});n+=x.qty;});
    DB.lrCart=cart().filter(x=>x.weigh);   // 打完移出，留下多退少补待称
    closeModal();render();
    toast(`已补打 ${normals.length} 个商品共 ${n} 张（不绑送货单）；请销毁旧标签`,'ok');
  };

  // 多退少补：一袋一称一打，回车即打；不整页重渲以保住输入焦点
  window.lr_printWeigh=function(){
    if(!ensureReady())return;
    const r=skuOf(DB.lrSku);if(!r)return;
    const el=document.getElementById('lr-w');const w=parseFloat((el||{}).value);
    if(!(w>0)){toast('请输入本袋净重','err');if(el)el.focus();return;}
    const reason=(document.getElementById('lr-wreason')||{}).value||REASONS[0];
    const rec={id:nextId(),shop:DB.lrShop,shopName:shopName(DB.lrShop),sku:r.sku,name:r.name,spec:r.spec,
      type:'weigh',w:+w.toFixed(2),wUnit:r.wUnit,qty:1,time:nowTxt(),op:'运营管理员',reason,paper:DB.lrPaper};
    labels().unshift(rec);
    const tb=document.getElementById('lr-batch');
    if(tb){
      const d=+(w-r.specW).toFixed(2);
      const tr=document.createElement('tr');
      tr.innerHTML=`<td class="mono">${rec.id}</td><td style="text-align:right"><b>${rec.w.toFixed(2)}</b> <span style="color:var(--ts)">${rec.wUnit}</span></td>`+
        `<td style="text-align:right;color:${d>=0?'var(--gd)':'var(--y)'}">${d>=0?'+':''}${d.toFixed(2)}</td><td style="color:var(--ts)">${rec.time}</td>`;
      tb.insertBefore(tr,tb.firstChild);
    }
    const c=document.getElementById('lr-cnt');if(c)c.textContent=doneOf(r.sku);
    const cc=document.getElementById('lr-cart-'+r.sku);if(cc)cc.textContent=doneOf(r.sku)+' 袋';
    const db=document.getElementById('lr-done-btn');if(db)db.style.display='';
    const cd=document.getElementById('lr-cart-done-'+r.sku);if(cd)cd.style.display='';
    ledgerSync(rec);
    if(el){el.value='';el.focus();}
    toast(`已补打 ${rec.id} · ${rec.w.toFixed(2)}${rec.wUnit}`,'ok');
  };
  window.lr_weighDone=function(sku){
    const n=doneOf(sku);
    if(!n){toast('该商品还没打过标签','err');return;}
    const i=cartIdx(sku);const nm=i>=0?cart()[i].name:'';
    if(i>=0)cart().splice(i,1);
    DB.lrSku='';render();toast(`「${nm}」已补打 ${n} 袋，已移出清单`,'ok');
  };

  function ledgerRow(x){return `<tr>
      <td class="mono">${x.id}</td>
      <td>${x.shopName}</td>
      <td class="mono">${x.sku}</td>
      <td><b>${x.name}</b></td>
      <td>${x.spec}</td>
      <td>${x.type=='weigh'?'<span class="tag t-y"><span class="dot"></span>多退少补</span>':'<span class="tag t-gr"><span class="dot"></span>普通</span>'}</td>
      <td style="text-align:right">${x.type=='weigh'?`<b>${x.w.toFixed(2)}</b> <span style="color:var(--ts)">${x.wUnit}</span>`:'<span style="color:var(--tt)">—</span>'}</td>
      <td style="text-align:right"><b>${x.qty}</b></td>
      <td>${x.reason=='二维码扫不出'?`<span class="tag t-r"><span class="dot"></span>${x.reason}</span>`:x.reason}</td>
      <td>${x.op}</td>
      <td style="color:var(--ts)">${x.time}</td>
    </tr>`;}
  function ledgerSync(rec){
    const tb=document.getElementById('lr-ledger');
    if(tb){const e=tb.querySelector('.empty');if(e)tb.innerHTML='';tb.insertAdjacentHTML('afterbegin',ledgerRow(rec));}
    const h=document.getElementById('lr-ledger-cnt');
    if(h)h.textContent=`共 ${labels().length} 条 · ${labels().reduce((a,x)=>a+x.qty,0)} 张`;
  }

  /* ============================================================
     视图
  ============================================================ */
  function listView(){
    DB.lrCart=DB.lrCart||[];
    const c=cart();
    const cur=DB.lrSku?skuOf(DB.lrSku):null;
    const curInCart=cur&&cartIdx(cur.sku)>=0;
    const batch=cur&&cur.weigh?labels().filter(x=>x.shop==DB.lrShop&&x.sku==cur.sku&&x.type=='weigh'):[];
    const normals=c.filter(x=>!x.weigh&&x.qty>=1);
    const total=normals.reduce((a,x)=>a+x.qty,0);
    const list=labels();

    const cartBody=c.map(x=>{const cat=skuOf(x.sku)||{};
      return `<tr ${cur&&cur.sku==x.sku?'style="background:var(--gl)"':''}>
      <td class="mono">${x.sku}</td>
      <td><b>${x.name}</b></td>
      <td>${x.spec}</td>
      <td>${x.weigh?'<span class="tag t-y"><span class="dot"></span>多退少补</span>':'<span class="tag t-gr"><span class="dot"></span>普通</span>'}</td>
      <td style="text-align:right;color:var(--ts)">${cat.todayPrinted||0} 张</td>
      <td style="text-align:right">${x.weigh
        ?'<span style="color:var(--ts)">逐袋复称</span>'
        :`<input type="number" min="1" max="${MAX_ONCE}" value="${x.qty}" class="ministock" style="width:84px;text-align:right" onchange="lr_cartQty('${x.sku}',this.value)">`}</td>
      <td style="text-align:right">${x.weigh?`<b id="lr-cart-${x.sku}" style="color:var(--gd)">${doneOf(x.sku)} 袋</b>`:'<span style="color:var(--tt)">—</span>'}</td>
      <td style="white-space:nowrap">${x.weigh
        ?`<button class="btn ${cur&&cur.sku==x.sku?'btn-o':'btn-p'} btn-sm" onclick="lr_weighStart('${x.sku}')">${cur&&cur.sku==x.sku?'称重中':'开始复称'}</button>
           <button class="btn btn-link btn-sm" id="lr-cart-done-${x.sku}" style="display:${doneOf(x.sku)?'':'none'}" onclick="lr_weighDone('${x.sku}')">完成</button>`
        :''}
        <button class="btn btn-link btn-sm" onclick="lr_cartDel('${x.sku}')">移除</button></td>
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
        <div><div style="font-size:12px;color:var(--ts);margin-bottom:5px"><b style="color:var(--r)">*</b> 这批货属于哪个商家</div>
          <select onchange="lr_pickShop(this.value)" style="min-width:220px">
            <option value="">请选择商家</option>
            ${SHOPS.map(s=>`<option value="${s.code}" ${DB.lrShop==s.code?'selected':''}>${s.name}</option>`).join('')}
          </select></div>
        <div><div style="font-size:12px;color:var(--ts);margin-bottom:5px">扫码 / 输编码加入清单</div>
          <input id="lr-scan" ${DB.lrShop?'':'disabled'} placeholder="${DB.lrShop?'扫码枪扫一个加一个，或手输编码后回车':'请先选择商家'}" style="min-width:280px"
            onkeydown="if(event.key=='Enter'){event.preventDefault();lr_scanAdd()}"></div>
        <button class="btn btn-p btn-sm" ${DB.lrShop?'':'disabled'} onclick="lr_scanAdd()">加入清单</button>
        <button class="btn btn-o btn-sm" ${DB.lrShop?'':'disabled'} onclick="lr_pasteModal()">批量粘贴</button>
        <div><div style="font-size:12px;color:var(--ts);margin-bottom:5px">或从该商家商品里挑</div>
          <select ${DB.lrShop?'':'disabled'} onchange="lr_pickAdd(this.value);this.value=''" style="min-width:280px">
            <option value="">选择商品加入清单…</option>
            ${catalog().map(x=>`<option value="${x.sku}">${x.name}（${x.sku}）· ${x.spec}${x.weigh?' · 多退少补':''}</option>`).join('')}
          </select></div>
      </div>
    </div></div>

    <div class="card" style="margin-bottom:14px"><div class="card-hd" style="flex-wrap:wrap;gap:10px">
      <div class="row" style="gap:8px;flex-wrap:wrap;align-items:center">
        <h3 style="margin-right:6px">待打印清单</h3>
        <button class="btn btn-p btn-sm" ${normals.length?'':'disabled'} onclick="lr_printBatch()">批量补打${total?`（${normals.length} 个商品 ${total} 张）`:''}</button>
        <button class="btn btn-o btn-sm" ${c.length?'':'disabled'} onclick="lr_cartClear()">清空清单</button>
      </div>
      <span class="sub">补打的是<b>不绑送货单</b>的新标签，到仓 WMS 扫码后按数量逻辑匹配；多退少补需逐袋现场复称</span>
    </div>
    <div class="card-bd flush"><div style="overflow-x:auto"><table>
      <thead><tr><th>商品编码</th><th>商品名称</th><th>规格</th><th>计价方式</th><th style="text-align:right">商家今日已打</th><th style="text-align:right">补打张数</th><th style="text-align:right">已打</th><th>操作</th></tr></thead>
      <tbody>${cartBody||`<tr><td colspan="8"><div class="empty"><div class="e-ic">🧾</div><div class="e-t">清单还是空的</div><div class="e-s">${DB.lrShop?'扫码连扫、粘贴一列编码，或从该商家商品里挑几个加进来。':'先选这批货属于哪个商家——标签上要印供货商。'}</div></div></td></tr>`}</tbody>
    </table></div></div></div>

    ${cur&&cur.weigh&&curInCart?`
    <div class="card" style="margin-bottom:14px"><div class="card-hd">
      <h3>现场复称 · ${cur.name}</h3>
      <span class="sub">一袋一称一打，回车即打；每张带唯一标签号与本袋净重，不含备货单号</span></div>
      <div class="card-bd">
        <div class="ib ib-y"><span class="i">⚖️</span>旧标签读不出，原重量取不到，只能<b>现场复称</b>。按 BR-14，复称值与商家报重偏差 <b>&gt;3%</b> 时<b>以平台为准</b>并计商家质量分，会改动该商家的发货差额与对账单——补打完请知会商家。</div>
        <div class="row" style="gap:10px;align-items:flex-end;margin-top:12px">
          <div class="fr" style="flex:0 0 200px;margin:0"><label class="fl"><b>*</b>本袋净重（${cur.wUnit}）</label>
            <input id="lr-w" type="number" step="0.01" min="0" placeholder="过秤后输入，回车即打"
              onkeydown="if(event.key=='Enter'){event.preventDefault();lr_printWeigh()}"></div>
          <div class="fr" style="flex:0 0 180px;margin:0"><label class="fl">补打原因</label>
            <select id="lr-wreason">${REASONS.map(x=>`<option>${x}</option>`).join('')}</select></div>
          <button class="btn btn-p" onclick="lr_printWeigh()">打印并继续</button>
          <div style="padding-bottom:9px;font-size:12px;color:var(--ts)">一件应发 ${cur.specW.toFixed(2)}${cur.wUnit} · 已补打 <b id="lr-cnt">${batch.length}</b> 袋</div>
          <div style="padding-bottom:6px;margin-left:auto"><button class="btn btn-o btn-sm" id="lr-done-btn" style="display:${batch.length?'':'none'}" onclick="lr_weighDone('${cur.sku}')">这个商品称完了</button></div>
        </div>
        <div style="overflow-x:auto;max-height:240px;overflow-y:auto;border:1px solid var(--bd2);border-radius:8px;margin-top:12px"><table>
          <thead><tr><th>标签号</th><th style="text-align:right">本袋净重</th><th style="text-align:right">差异</th><th>打印时间</th></tr></thead>
          <tbody id="lr-batch">${batch.map(b=>{const d=+(b.w-cur.specW).toFixed(2);
            return `<tr><td class="mono">${b.id}</td><td style="text-align:right"><b>${b.w.toFixed(2)}</b> <span style="color:var(--ts)">${b.wUnit}</span></td><td style="text-align:right;color:${d>=0?'var(--gd)':'var(--y)'}">${d>=0?'+':''}${d.toFixed(2)}</td><td style="color:var(--ts)">${b.time}</td></tr>`;}).join('')}</tbody>
        </table></div>
      </div></div>`:''}

    <div class="card"><div class="card-hd"><h3>补打记录</h3>
      <span class="sub" id="lr-ledger-cnt">共 ${list.length} 条 · ${list.reduce((a,x)=>a+x.qty,0)} 张</span></div>
    <div class="card-bd flush"><div style="overflow-x:auto"><table>
      <thead><tr><th>标签号</th><th>商家</th><th>商品编码</th><th>商品名称</th><th>规格</th><th>计价方式</th><th style="text-align:right">本袋净重</th><th style="text-align:right">张数</th><th>补打原因</th><th>操作人</th><th>补打时间</th></tr></thead>
      <tbody id="lr-ledger">${list.map(ledgerRow).join('')||`<tr><td colspan="11"><div class="empty"><div class="e-ic">📄</div><div class="e-t">暂无补打记录</div><div class="e-s">仓库补打的标签都会留在这里，可按原因统计倒查商家打印质量。</div></div></td></tr>`}</tbody>
    </table></div></div></div>`;
  }

  function logView(){
    const list=labels();
    const byReason={};list.forEach(x=>{byReason[x.reason]=(byReason[x.reason]||0)+x.qty;});
    const byShop={};list.forEach(x=>{byShop[x.shopName]=(byShop[x.shopName]||0)+x.qty;});
    return `
    <div class="card" style="margin-bottom:14px"><div class="card-bd" style="padding:0">
      <div style="display:flex;justify-content:space-between;align-items:center;padding:0 16px;flex-wrap:wrap">
        <div class="tabs" style="margin:0;border:none">
          <div class="tab" onclick="DB.lrTab='list';render()">标签补打</div>
          <div class="tab active">补打记录${list.length?`（${list.length}）`:''}</div>
        </div>
      </div>
    </div></div>
    <div class="card" style="margin-bottom:14px"><div class="card-hd"><h3>按原因 / 商家统计</h3>
      <span class="sub">补打量集中在哪个商家、哪个原因，就该去修那条打印链路，而不是让仓库天天补</span></div>
      <div class="card-bd flush"><div style="overflow-x:auto"><table>
        <thead><tr><th>维度</th><th>项</th><th style="text-align:right">补打张数</th></tr></thead>
        <tbody>${Object.entries(byReason).map(([k,v])=>`<tr><td style="color:var(--ts)">补打原因</td><td>${k}</td><td style="text-align:right"><b>${v}</b></td></tr>`).join('')
          +Object.entries(byShop).map(([k,v])=>`<tr><td style="color:var(--ts)">商家</td><td>${k}</td><td style="text-align:right"><b>${v}</b></td></tr>`).join('')
          ||`<tr><td colspan="3"><div class="empty"><div class="e-ic">📊</div><div class="e-t">暂无数据</div><div class="e-s">补打后这里按原因和商家聚合。</div></div></td></tr>`}</tbody>
      </table></div></div></div>
    <div class="card"><div class="card-hd"><h3>补打明细</h3><span class="sub">共 ${list.length} 条 · ${list.reduce((a,x)=>a+x.qty,0)} 张</span></div>
    <div class="card-bd flush"><div style="overflow-x:auto"><table>
      <thead><tr><th>标签号</th><th>商家</th><th>商品编码</th><th>商品名称</th><th>规格</th><th>计价方式</th><th style="text-align:right">本袋净重</th><th style="text-align:right">张数</th><th>补打原因</th><th>操作人</th><th>补打时间</th></tr></thead>
      <tbody>${list.map(ledgerRow).join('')||`<tr><td colspan="11"><div class="empty"><div class="e-ic">📄</div><div class="e-t">暂无补打记录</div><div class="e-s">仓库补打的标签都会留在这里。</div></div></td></tr>`}</tbody>
    </table></div></div></div>`;
  }

  PAGES['p-label-reprint']=()=>DB.lrTab=='log'?logView():listView();
})();
