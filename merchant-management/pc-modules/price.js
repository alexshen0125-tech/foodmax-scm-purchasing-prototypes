/* PC · 价格分析 —— App 未单独录此页，按 PC 形态把交互做扎实（不自创业务规则）。
   口径全部沿用主文件既有逻辑：
     · priceAbnormal(price,cat)：CATS[cat] 指导价 guide 的 [×0.5, ×2.0] 为合理区间，区间外即异常。
     · 过低 = price < guide×0.5；过高 = price > guide×2.0（=指导价 200%）。
     · 类目基准取自 CATS[cat]：guide(指导价) / tax(税率) / baseRisk(风险)。
     · 在售商品改价即时生效、无需重审（同主文件 act_repriceSku / act_batchPrice 文案）。
   数据源：DB.products（在售 SPU 的 SKU 价格），与商品管理同一份数据，改价即时联动；
           调价留痕落 DB.priceLog（含操作人 = DB.merchant.contact）。
   交互升级：① 统计卡可点→过滤异常表到对应档（全部/异常/过低/过高）
            ② 异常表行可点→「价格详情」modal（指导价/合理区间/历史调价/同类目均价对比/建议价一键填入）
            ③ 异常表勾选多行→批量调价（按指导价对齐 / 统一涨跌%），复用主文件 selbar 思路
            ④ 类目基准表行可点→该类目下本店 SKU 价格分布 modal
            ⑤ 调价 modal 内「设为指导价 / 区间下限 / 区间上限」快捷按钮
   依赖 inline 脚本全局：DB / CATS / money / toast / modal / modalWide / closeModal / nav / render / riskTag / priceAbnormal。 */
(function(){
  // ===== 数据辅助 =====
  // 价格调整记录（演示态，挂 DB；初始空 → 空态）。每条 {time,name,skuId,cat,oldP,newP,abn,op}
  function priceLog(){ return DB.priceLog || (DB.priceLog=[]); }
  function priceOperator(){ return (DB.merchant&&DB.merchant.contact) || '店铺管理员'; }

  // 在售 SPU 下、已定价（price>0）的 SKU 集合：{p,s}
  function pricedSkus(){
    const out=[];
    DB.products.filter(p=>p.status=='onsale').forEach(p=>{
      (p.skus||[]).forEach(s=>{ if(s.price>0 && CATS[p.cat]) out.push({p,s}); });
    });
    return out;
  }
  // 在售 SKU 总数（含未定价，对应「在售 SKU 数」卡）
  function onsaleSkuCount(){ return DB.products.filter(p=>p.status=='onsale').reduce((a,p)=>a+(p.skus||[]).length,0); }
  // 本店某类目均价（基于已定价在售 SKU）
  function catAvg(cat){ const m=pricedSkus().filter(r=>r.p.cat==cat); return m.length? m.reduce((a,r)=>a+r.s.price,0)/m.length : 0; }
  // 当前批量选中的 SKU（仅取在售已定价集合内）
  function selSkusPrice(){ const sel=DB.priceSel||[]; return pricedSkus().filter(r=>sel.includes(r.s.skuId)); }

  // 偏离度：(现价-指导价)/指导价 ×100，带符号
  function devPct(price,guide){ return (price-guide)/guide*100; }
  function devStr(price,guide){ const d=devPct(price,guide); return (d>=0?'+':'')+d.toFixed(1)+'%'; }
  // 价格状态：过低 t-y / 过高 t-r / 正常 t-g
  function priceStatus(price,cat){
    const c=CATS[cat]; if(!c) return ['—','t-gr'];
    if(price < c.guide*0.5) return ['过低','t-y'];
    if(price > c.guide*2)   return ['过高','t-r'];
    return ['正常','t-g'];
  }
  // 偏离度文字着色
  function devColor(price,c){ return priceAbnormal(price,c.guide?c.guide:0)? (price>c.guide*2?'var(--r)':'var(--y)') : 'var(--ts)'; }

  // ===== Tab / 过滤切换 =====
  window.price_tab=function(k){ DB.priceTab=k; render(); };
  // 统计卡点击：过滤异常表到对应档（同时切回「价格异常」Tab）
  window.price_filter=function(f){ DB.priceFilter=f; DB.priceTab='abnormal'; render(); };
  window.price_clearFilter=function(){ DB.priceFilter='all'; render(); };

  // ===== 批量选择（独立于商品模块的 DB.sel，用 DB.priceSel）=====
  window.price_toggleSel=function(ev,skuId){
    if(ev) ev.stopPropagation();
    DB.priceSel=DB.priceSel||[];
    const i=DB.priceSel.indexOf(skuId);
    if(i>=0) DB.priceSel.splice(i,1); else DB.priceSel.push(skuId);
    render();
  };
  // 表头全选：传入当前可见行 skuId（逗号串）
  window.price_selAllShown=function(ev,csv){
    if(ev) ev.stopPropagation();
    DB.priceSel=DB.priceSel||[];
    const ids=csv.split(',').filter(Boolean);
    const allSel=ids.length && ids.every(id=>DB.priceSel.includes(id));
    if(allSel) DB.priceSel=DB.priceSel.filter(id=>!ids.includes(id));
    else ids.forEach(id=>{ if(!DB.priceSel.includes(id)) DB.priceSel.push(id); });
    render();
  };
  window.price_clearSel=function(){ DB.priceSel=[]; render(); };

  // 批量调价弹窗：按指导价对齐 或 统一涨跌%
  window.price_batch=function(){
    const sel=selSkusPrice(); if(!sel.length){ toast('请先勾选要调价的 SKU','info'); return; }
    const cats=new Set(sel.map(r=>r.p.cat)).size;
    modal(`<div class="mc-hd"><h3>批量调价 · ${sel.length} 个 SKU</h3>
      <p>在售商品改价<b>即时生效、无需重审</b>；超合理区间(指导价 0.5~2 倍)仅标记异常供平台监管。</p><button class="mc-x" onclick="closeModal()">×</button></div>
    <div class="mc-bd">
      <div class="ib ib-b"><span class="i">📐</span><div>已选 <b>${sel.length}</b> 个 SKU，涉及 <b>${cats}</b> 个类目。「按类目指导价对齐」会把每个 SKU 各自设为其<b>所属类目指导价</b>。</div></div>
      <div class="fr"><label class="fl">调价方式</label><select id="pb-mode" onchange="price_batchModeToggle()">
        <option value="guide">按类目指导价对齐</option>
        <option value="pct">统一涨跌(%)</option></select></div>
      <div class="fr"><label class="fl">涨跌幅(%)</label><input id="pb-val" type="number" step="1" value="0" disabled placeholder="如 -10 表示降 10%，5 表示涨 5%" oninput="price_batchPrev()"></div>
      <div id="pb-prev"></div>
    </div>
    <div class="mc-ft"><button class="btn btn-o" onclick="closeModal()">取消</button><button class="btn btn-p" onclick="price_batchApply()">应用到 ${sel.length} 个 SKU</button></div>`);
    price_batchPrev();
  };
  window.price_batchModeToggle=function(){
    const mode=document.getElementById('pb-mode').value;
    document.getElementById('pb-val').disabled = (mode=='guide');
    price_batchPrev();
  };
  // 计算批量结果预览（异常数 / 变更数）
  function batchCompute(){
    const mode=document.getElementById('pb-mode').value;
    const val=parseFloat(document.getElementById('pb-val').value)||0;
    let changed=0, abn=0;
    selSkusPrice().forEach(({p,s})=>{
      const guide=CATS[p.cat].guide;
      let np=mode=='guide'? guide : +(s.price*(1+val/100)).toFixed(2);
      if(np>0 && np!=s.price){ changed++; if(priceAbnormal(np,p.cat)) abn++; }
    });
    return {mode,val,changed,abn};
  }
  window.price_batchPrev=function(){
    const box=document.getElementById('pb-prev'); if(!box) return;
    const {mode,changed,abn}=batchCompute();
    const desc=mode=='guide'?'各 SKU 将对齐其类目指导价':'按统一涨跌幅重算';
    box.innerHTML=`<div class="ib ${abn?'ib-y':'ib-g'}" style="margin-top:4px"><span class="i">${abn?'⚠️':'✅'}</span>预览：${desc}，将变更 <b>${changed}</b> 个 SKU 价格${abn?`，其中 <b>${abn}</b> 个落在合理区间外、将标记异常`:'，全部落在合理区间内'}。</div>`;
  };
  window.price_batchApply=function(){
    const mode=document.getElementById('pb-mode').value;
    const val=parseFloat(document.getElementById('pb-val').value)||0;
    let changed=0, abn=0; const op=priceOperator();
    selSkusPrice().forEach(({p,s})=>{
      const guide=CATS[p.cat].guide;
      let np=mode=='guide'? guide : +(s.price*(1+val/100)).toFixed(2);
      if(np>0 && np!=s.price){
        const oldP=s.price; s.price=np; const ab=priceAbnormal(np,p.cat);
        priceLog().unshift({time:nowStr(),name:p.name,skuId:s.skuId,cat:p.cat,oldP,newP:np,abn:ab,op});
        changed++; if(ab) abn++;
      }
    });
    closeModal(); DB.priceSel=[]; render();
    if(!changed){ toast('没有价格发生变化','info'); return; }
    toast(`批量调价完成，${changed} 个 SKU 即时生效${abn?`；${abn} 个价格异常已标记供平台监管`:''}`, abn?'info':'ok');
  };

  function nowStr(){ return new Date().toLocaleString('en-GB',{hour12:false}).replace(/\//g,'-'); }

  // ===== 调价弹窗 =====
  // 调价弹窗：输入新价 + 即时校验合理区间 +「设为指导价/区间下限/上限」快捷
  window.price_open=function(spuId,skuId,preset){
    const p=DB.products.find(x=>x.id==spuId); if(!p) return;
    const s=(p.skus||[]).find(x=>x.skuId==skuId); if(!s) return;
    const c=CATS[p.cat]||{guide:0}; const lo=(c.guide*0.5), hi=(c.guide*2);
    const initV = (preset>0?preset:(s.price||0));
    modal(`<div class="mc-hd"><h3>调价 · ${p.name} <span class="mono" style="font-size:12px;color:var(--ts)">${s.skuId}</span></h3>
      <p>已审核在售商品改价<b>即时生效、无需重审</b>；超合理区间仅标记异常供平台监管。</p><button class="mc-x" onclick="closeModal()">×</button></div>
    <div class="mc-bd">
      <div class="ib ib-b"><span class="i">📐</span><div>类目「${p.cat}」指导价 <b>${money(c.guide)}</b>；<b>合理区间</b>＝指导价 0.5~2 倍＝<b>${money(lo)} ~ ${money(hi)}</b>。</div></div>
      <div class="fr"><label class="fl">规格</label><div style="padding-top:7px">${p.name} ${s.qty}${p.unit}　·　当前价 <b>${money(s.price||0)}</b>（偏离 ${devStr(s.price||0,c.guide)}）</div></div>
      <div class="fr"><label class="fl"><b>*</b>新价格(SGD)</label><input id="pr-new" data-guide="${c.guide}" type="number" step="0.01" min="0" value="${initV.toFixed(2)}" oninput="price_check(this.value,${c.guide})" placeholder="如 ${c.guide.toFixed(2)}"></div>
      <div class="fr"><label class="fl">快捷</label><div class="row" style="gap:6px;flex-wrap:wrap;padding-top:3px">
        <button class="btn btn-o btn-sm" onclick="price_set(${c.guide})">设为指导价 ${money(c.guide)}</button>
        <button class="btn btn-o btn-sm" onclick="price_set(${lo})">区间下限 ${money(lo)}</button>
        <button class="btn btn-o btn-sm" onclick="price_set(${hi})">区间上限 ${money(hi)}</button>
      </div></div>
      <div id="pr-chk"></div>
    </div>
    <div class="mc-ft"><button class="btn btn-o" onclick="closeModal()">取消</button><button class="btn btn-p" onclick="price_apply('${spuId}','${skuId}')">确认调价</button></div>`);
    price_check(initV.toFixed(2), c.guide);
  };
  // 快捷按钮：写入输入框并重新校验
  window.price_set=function(v){
    const inp=document.getElementById('pr-new'); if(!inp) return;
    inp.value=(+v).toFixed(2); price_check(inp.value, parseFloat(inp.dataset.guide));
  };
  // 输入即时校验：落在合理区间→绿；区间外→黄/红
  window.price_check=function(v,guide){
    const box=document.getElementById('pr-chk'); if(!box) return;
    const np=parseFloat(v);
    if(!(np>0)){ box.innerHTML=`<div class="ib ib-y" style="margin-top:4px"><span class="i">⚠️</span>请输入大于 0 的价格。</div>`; return; }
    const lo=guide*0.5, hi=guide*2; const d=devStr(np,guide);
    if(np<lo) box.innerHTML=`<div class="ib ib-y" style="margin-top:4px"><span class="i">⚠️</span>偏离 <b>${d}</b>，<b>低于</b>合理区间下限 ${money(lo)}，将标记为<b>价格过低</b>异常。</div>`;
    else if(np>hi) box.innerHTML=`<div class="ib ib-r" style="margin-top:4px"><span class="i">⛔</span>偏离 <b>${d}</b>，<b>高于</b>合理区间上限 ${money(hi)}，将标记为<b>价格过高</b>异常。</div>`;
    else box.innerHTML=`<div class="ib ib-g" style="margin-top:4px"><span class="i">✅</span>偏离 <b>${d}</b>，在合理区间内，价格正常。</div>`;
  };
  // 落库：set sku.price + 即时校验 + 写记录(含操作人) + toast
  window.price_apply=function(spuId,skuId){
    const p=DB.products.find(x=>x.id==spuId); const s=p&&(p.skus||[]).find(x=>x.skuId==skuId); if(!s) return;
    const np=parseFloat(document.getElementById('pr-new').value);
    if(!(np>0)){ toast('请输入大于 0 的价格','err'); return; }
    const oldP=s.price||0; if(np==oldP){ closeModal(); toast('价格未变化','info'); return; }
    s.price=np; const abn=priceAbnormal(np,p.cat);
    priceLog().unshift({time:nowStr(),name:p.name,skuId:s.skuId,cat:p.cat,oldP,newP:np,abn,op:priceOperator()});
    closeModal(); render();
    if(abn) toast('价格已更新（在售商品无需重审）；超指导价合理区间(0.5~2 倍)，已标记异常供平台监管','info');
    else toast(`「${p.name} · ${s.qty}${p.unit}」已调价为 ${money(np)}，即时生效`,'ok');
  };

  // ===== 价格详情 modal（行点击）=====
  window.price_detail=function(spuId,skuId){
    const p=DB.products.find(x=>x.id==spuId); if(!p) return;
    const s=(p.skus||[]).find(x=>x.skuId==skuId); if(!s) return;
    const c=CATS[p.cat]||{guide:0}; const lo=c.guide*0.5, hi=c.guide*2;
    const [st,cls]=priceStatus(s.price,p.cat); const avg=catAvg(p.cat);
    // 该 SKU 历史调价
    const hist=priceLog().filter(r=>r.skuId==s.skuId);
    const histHtml = hist.length
      ? `<table class="subtbl"><thead><tr><th>时间</th><th>原价</th><th>新价</th><th>结果</th><th>操作人</th></tr></thead><tbody>
          ${hist.map(r=>`<tr><td>${r.time}</td><td style="text-align:right">${money(r.oldP)}</td><td style="text-align:right"><b>${money(r.newP)}</b></td>
          <td>${r.abn?'<span class="tag t-r"><span class="dot"></span>异常</span>':'<span class="tag t-g"><span class="dot"></span>正常</span>'}</td><td>${r.op||'—'}</td></tr>`).join('')}
          </tbody></table>`
      : `<div class="ib ib-gr" style="margin:0"><span class="i">🕑</span>该 SKU 暂无调价记录。</div>`;
    // 同类目均价对比
    const cmpRows=[['本 SKU 当前价',s.price,devStr(s.price,c.guide)],['本店同类目均价',avg,avg?devStr(avg,c.guide):'—'],['类目指导价',c.guide,'基准']];
    const cmp=`<table class="subtbl"><thead><tr><th>口径</th><th>价格</th><th>偏离指导价</th></tr></thead><tbody>
      ${cmpRows.map(r=>`<tr><td>${r[0]}</td><td style="text-align:right">${r[1]?money(r[1]):'—'}</td><td style="text-align:right">${r[2]}</td></tr>`).join('')}</tbody></table>`;
    modalWide(`<div class="mc-hd"><h3>价格详情 · ${p.name} <span class="mono" style="font-size:12px;color:var(--ts)">${s.skuId}</span></h3>
      <p>${p.cat} · ${s.qty}${p.unit} · 当前状态 <span class="tag ${cls}"><span class="dot"></span>${st}</span></p><button class="mc-x" onclick="closeModal()">×</button></div>
    <div class="mc-bd">
      <div class="sg" style="grid-template-columns:repeat(4,1fr);margin-bottom:14px">
        <div class="sc"><div class="sc-l">当前价</div><div class="sc-v">${money(s.price)}</div><div class="sc-s">偏离 ${devStr(s.price,c.guide)}</div></div>
        <div class="sc"><div class="sc-l">类目指导价</div><div class="sc-v">${money(c.guide)}</div><div class="sc-s">平台基准</div></div>
        <div class="sc"><div class="sc-l">合理区间</div><div class="sc-v" style="font-size:18px">${money(lo)}~${money(hi)}</div><div class="sc-s">指导价 0.5~2 倍</div></div>
        <div class="sc ${avg?'':''}"><div class="sc-l">同类目均价</div><div class="sc-v">${avg?money(avg):'—'}</div><div class="sc-s">本店在售对比</div></div>
      </div>
      <div class="card" style="box-shadow:none;margin:0 0 14px"><div class="card-hd"><h3>同类目均价对比</h3></div><div class="card-bd flush">${cmp}</div></div>
      <div class="card" style="box-shadow:none;margin:0"><div class="card-hd"><h3>历史调价</h3><span class="sub">${hist.length} 条</span></div><div class="card-bd flush">${histHtml}</div></div>
      <div class="ib ib-b" style="margin-top:14px"><span class="i">💡</span><div><b>建议价（平台类目指导价）＝ ${money(c.guide)}</b>。点「一键调到建议价」将以指导价预填调价框。</div></div>
    </div>
    <div class="mc-ft"><button class="btn btn-o" onclick="closeModal()">关闭</button>
      <button class="btn btn-o" onclick="closeModal();price_open('${p.id}','${s.skuId}')">去调价</button>
      <button class="btn btn-p" onclick="closeModal();price_open('${p.id}','${s.skuId}',${c.guide})">一键调到建议价</button></div>`);
  };

  // ===== 类目下本店 SKU 价格分布 modal（类目基准表行点击）=====
  window.price_catDist=function(cat){
    const c=CATS[cat]; if(!c) return; const lo=c.guide*0.5, hi=c.guide*2;
    const mine=pricedSkus().filter(r=>r.p.cat==cat)
      .sort((a,b)=>Math.abs(devPct(b.s.price,c.guide))-Math.abs(devPct(a.s.price,c.guide)));
    const avg=catAvg(cat); const abnN=mine.filter(r=>priceAbnormal(r.s.price,cat)).length;
    const body = !mine.length
      ? `<div class="empty"><div class="e-ic">🏷️</div><div class="e-t">该类目暂无在售已定价 SKU</div><div class="e-s">在该类目下定价后，可在此查看本店价格分布与偏离。</div></div>`
      : `<table class="subtbl"><thead><tr><th>商品</th><th>SKU 编码</th><th>价格</th><th>偏离指导价</th><th>状态</th><th></th></tr></thead><tbody>
        ${mine.map(({p,s})=>{const[st,cls]=priceStatus(s.price,cat);return `<tr>
          <td><b>${p.name}</b> <span style="color:var(--ts)">${s.qty}${p.unit}</span></td>
          <td class="mono">${s.skuId}</td>
          <td style="text-align:right"><b>${money(s.price)}</b></td>
          <td style="text-align:right;color:${devColor(s.price,c)}">${devStr(s.price,c.guide)}</td>
          <td><span class="tag ${cls}"><span class="dot"></span>${st}</span></td>
          <td><button class="btn btn-o btn-sm" onclick="closeModal();price_open('${p.id}','${s.skuId}')">调价</button></td>
        </tr>`;}).join('')}</tbody></table>`;
    modalWide(`<div class="mc-hd"><h3>价格分布 · ${cat}</h3>
      <p>指导价 ${money(c.guide)} · 合理区间 ${money(lo)}~${money(hi)} · 本店均价 ${avg?money(avg):'—'}</p><button class="mc-x" onclick="closeModal()">×</button></div>
    <div class="mc-bd">
      <div class="sg" style="grid-template-columns:repeat(3,1fr);margin-bottom:14px">
        <div class="sc"><div class="sc-l">本店 SKU 数</div><div class="sc-v">${mine.length}</div><div class="sc-s">在售已定价</div></div>
        <div class="sc"><div class="sc-l">本店均价</div><div class="sc-v">${avg?money(avg):'—'}</div><div class="sc-s">偏离 ${avg?devStr(avg,c.guide):'—'}</div></div>
        <div class="sc ${abnN?'alert':'good'}"><div class="sc-l">异常 SKU</div><div class="sc-v">${abnN}</div><div class="sc-s">区间外</div></div>
      </div>
      <div class="card" style="box-shadow:none;margin:0"><div class="card-bd flush">${body}</div></div>
    </div>
    <div class="mc-ft"><button class="btn btn-p" onclick="closeModal()">关闭</button></div>`);
  };

  // ===== 页面 =====
  PAGES['m-price']=()=>{
    DB.priceTab = DB.priceTab || 'abnormal';
    DB.priceFilter = DB.priceFilter || 'all';
    DB.priceSel = DB.priceSel || [];
    const rows=pricedSkus();
    const onsaleN=onsaleSkuCount();
    const abn = rows.filter(r=>priceAbnormal(r.s.price,r.p.cat));
    const lowN = rows.filter(r=>r.s.price < CATS[r.p.cat].guide*0.5).length;
    const highN= rows.filter(r=>r.s.price > CATS[r.p.cat].guide*2).length;
    const tab=DB.priceTab; const pf=DB.priceFilter;

    // —— 价格异常预警表（按偏离绝对值降序，异常优先浮顶；受统计卡过滤）——
    const sorted=[...rows].sort((a,b)=>Math.abs(devPct(b.s.price,CATS[b.p.cat].guide))-Math.abs(devPct(a.s.price,CATS[a.p.cat].guide)));
    const filtered = pf=='abn' ? sorted.filter(r=>priceAbnormal(r.s.price,r.p.cat))
                  : pf=='low' ? sorted.filter(r=>r.s.price < CATS[r.p.cat].guide*0.5)
                  : pf=='high'? sorted.filter(r=>r.s.price > CATS[r.p.cat].guide*2)
                  : sorted;
    const FILTER_LABEL={all:'全部',abn:'价格异常',low:'价格过低',high:'价格过高'};
    const shownIds=filtered.map(r=>r.s.skuId);
    const allShownSel = shownIds.length && shownIds.every(id=>DB.priceSel.includes(id));
    const selN=(DB.priceSel||[]).filter(id=>shownIds.includes(id)).length;

    const filterChip = pf!='all'
      ? `<div class="ib ib-gr" style="margin:0 0 12px"><span class="i">🔎</span><div>已筛选：<b>${FILTER_LABEL[pf]}</b>（${filtered.length} 个 SKU） <button class="btn btn-link" onclick="price_clearFilter()">清除筛选</button></div></div>`
      : '';
    const selbar = selN
      ? `<div class="selbar"><span>已选 <b>${selN}</b> 个 SKU</span><button class="btn btn-p btn-sm" onclick="price_batch()">批量调价</button><button class="btn btn-link" style="margin-left:auto" onclick="price_clearSel()">取消选择</button></div>`
      : '';

    const abnTable = !rows.length
      ? `<div class="empty"><div class="e-ic">🏷️</div><div class="e-t">暂无在售已定价 SKU</div><div class="e-s">在售商品填写价格后，系统按类目指导价自动比对，<br>异常（指导价 0.5~2 倍区间外）将在此预警。可去<b>商品管理</b>建档/定价。</div><div style="margin-top:14px"><button class="btn btn-p" onclick="nav('m-product')">前往商品管理 →</button></div></div>`
      : (filterChip + selbar + (!filtered.length
        ? `<div class="empty" style="padding:30px"><div class="e-ic">✅</div><div class="e-t">当前筛选下无 SKU</div><div class="e-s">「${FILTER_LABEL[pf]}」档位暂无数据。<button class="btn btn-link" onclick="price_clearFilter()">查看全部</button></div></div>`
        : `<div style="overflow-x:auto"><table>
        <thead><tr><th style="width:34px"><input type="checkbox" ${allShownSel?'checked':''} onclick="price_selAllShown(event,'${shownIds.join(',')}')"></th><th>商品</th><th>SKU 编码</th><th>类目</th><th>当前价</th><th>类目指导价</th><th>偏离度</th><th>状态</th><th>操作</th></tr></thead><tbody>
        ${filtered.map(({p,s})=>{const c=CATS[p.cat];const[st,cls]=priceStatus(s.price,p.cat);const ab=priceAbnormal(s.price,p.cat);const sel=DB.priceSel.includes(s.skuId);return `<tr style="cursor:pointer" onclick="price_detail('${p.id}','${s.skuId}')">
          <td onclick="event.stopPropagation()"><input type="checkbox" ${sel?'checked':''} onclick="price_toggleSel(event,'${s.skuId}')"></td>
          <td><b>${p.name}</b> <span style="color:var(--ts)">${s.qty}${p.unit}</span></td>
          <td class="mono">${s.skuId}</td>
          <td>${p.cat}</td>
          <td style="text-align:right"><b>${money(s.price)}</b></td>
          <td style="text-align:right">${money(c.guide)}</td>
          <td style="text-align:right;color:${ab?(s.price>c.guide*2?'var(--r)':'var(--y)'):'var(--ts)'}">${devStr(s.price,c.guide)}</td>
          <td><span class="tag ${cls}"><span class="dot"></span>${st}</span></td>
          <td onclick="event.stopPropagation()"><button class="btn ${ab?'btn-p':'btn-o'} btn-sm" onclick="price_open('${p.id}','${s.skuId}')">调价</button></td>
        </tr>`;}).join('')}
        </tbody></table></div>`));

    // —— 类目价格基准表（行可点 → 价格分布 modal）——
    const baseTable = `<div style="overflow-x:auto"><table>
      <thead><tr><th>类目</th><th>指导价</th><th>合理区间(0.5~2 倍)</th><th>税率</th><th>风险</th><th>本店 SKU 数</th><th>本店均价</th><th>偏离指导价</th></tr></thead><tbody>
      ${Object.keys(CATS).map(cat=>{const c=CATS[cat];const mine=rows.filter(r=>r.p.cat==cat);const n=mine.length;const avg=n?mine.reduce((a,r)=>a+r.s.price,0)/n:0;const dev=n?devStr(avg,c.guide):'—';return `<tr style="cursor:pointer" onclick="price_catDist('${cat}')">
        <td><b>${cat}</b></td>
        <td style="text-align:right">${money(c.guide)}</td>
        <td style="text-align:right;color:var(--ts)">${money(c.guide*0.5)} ~ ${money(c.guide*2)}</td>
        <td style="text-align:right">${(c.tax*100).toFixed(0)}%</td>
        <td>${riskTag(c.baseRisk)}</td>
        <td style="text-align:right">${n}</td>
        <td style="text-align:right">${n?money(avg):'—'}</td>
        <td style="text-align:right;color:${n&&Math.abs(devPct(avg,c.guide))>50?'var(--r)':'var(--ts)'}">${dev}</td>
      </tr>`;}).join('')}
      </tbody></table></div>
      <div class="ib ib-gr" style="margin:12px 0 0"><span class="i">👆</span>点击任一类目行，查看<b>该类目下本店 SKU 价格分布</b>。</div>`;

    // —— 调价记录（真实留痕，空态）——
    const log=priceLog();
    const logTable = !log.length
      ? `<div class="empty"><div class="e-ic">🕑</div><div class="e-t">暂无调价记录</div><div class="e-s">在「价格异常」页对 SKU 调价后，<br>每次改价会在此留痕（时间 / SKU / 原价→新价 / 操作人 / 是否异常）。</div></div>`
      : `<div style="overflow-x:auto"><table>
        <thead><tr><th>调价时间</th><th>商品</th><th>SKU 编码</th><th>类目</th><th>原价 → 新价</th><th>操作人</th><th>结果</th></tr></thead><tbody>
        ${log.map(r=>`<tr>
          <td>${r.time}</td><td><b>${r.name}</b></td><td class="mono">${r.skuId}</td><td>${r.cat}</td>
          <td style="text-align:right">${money(r.oldP)} → <b>${money(r.newP)}</b></td>
          <td>${r.op||'—'}</td>
          <td>${r.abn?'<span class="tag t-r"><span class="dot"></span>已标记异常</span>':'<span class="tag t-g"><span class="dot"></span>正常生效</span>'}</td>
        </tr>`).join('')}
        </tbody></table></div>`;

    const TABS=[['abnormal','价格异常'],['base','类目基准'],['log','调价记录']];
    const body = tab=='base'?baseTable : tab=='log'?logTable : abnTable;
    const sub  = tab=='base'?'类目指导价 / 税率 / 风险 与本店实际价对照（点行看分布）'
              : tab=='log'?`累计 ${log.length} 条调价留痕`
              : (pf!='all'?`筛选「${FILTER_LABEL[pf]}」${filtered.length} 个 · 点行看详情、勾选批量调价`:`在售已定价 SKU 共 ${rows.length} 个，异常 ${abn.length} 个 · 点行看详情`);

    // 统计卡（可点过滤）。active=当前在异常 Tab 且筛选命中
    const cardActive=(f)=> (tab=='abnormal'&&pf==f)?'box-shadow:0 0 0 2px var(--g) inset;':'';
    return `
    <div class="ib ib-b" style="margin-bottom:14px"><span class="i">📐</span><div><b>价格合理区间</b>＝类目指导价的 <b>0.5 ~ 2 倍</b>。低于 0.5 倍判「过低」、高于 2 倍判「过高」，均标记异常供平台监管；在售商品调价即时生效、无需重审。<b>点统计卡可筛选异常表</b>。</div></div>
    <div class="sg" style="grid-template-columns:repeat(4,1fr)">
      <div class="sc" style="cursor:pointer;${cardActive('all')}" onclick="price_filter('all')"><div class="sc-l">在售 SKU 数</div><div class="sc-v">${onsaleN}</div><div class="sc-s">在售 SPU 下全部规格 · 看全部</div></div>
      <div class="sc ${abn.length?'alert':'good'}" style="cursor:pointer;${cardActive('abn')}" onclick="price_filter('abn')"><div class="sc-l">价格异常 SKU</div><div class="sc-v">${abn.length}</div><div class="sc-s">超指导价 0.5~2 倍区间 · 点筛选</div></div>
      <div class="sc ${lowN?'warn':''}" style="cursor:pointer;${cardActive('low')}" onclick="price_filter('low')"><div class="sc-l">低于指导价 50%</div><div class="sc-v">${lowN}</div><div class="sc-s">价格过低 · 点筛选</div></div>
      <div class="sc ${highN?'alert':''}" style="cursor:pointer;${cardActive('high')}" onclick="price_filter('high')"><div class="sc-l">高于指导价 200%</div><div class="sc-v">${highN}</div><div class="sc-s">价格过高 · 点筛选</div></div>
    </div>
    <div class="card"><div class="card-hd">
      <div class="tabs" style="margin:0;border:none">${TABS.map(t=>`<div class="tab ${tab==t[0]?'active':''}" onclick="price_tab('${t[0]}')">${t[1]}${t[0]=='abnormal'&&abn.length?` <span class="tag t-r" style="font-size:11px">${abn.length}</span>`:''}</div>`).join('')}</div>
      <span class="sub">${sub}</span>
    </div><div class="card-bd flush">${body}</div></div>`;
  };
})();
