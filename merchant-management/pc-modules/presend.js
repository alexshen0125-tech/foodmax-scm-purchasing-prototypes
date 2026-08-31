/* PC · 预送确认 + 在仓预送库存（提前送货与预测预送）
   ① 预送确认 PAGES['m-presend']：算法下发的「预送量」与商家可售库存比对——
      预测量 ≤ 可售库存 → 无需确认直接执行；预测量 > 可售库存 → 待商家确认，
      确认=按预测量送、拒绝/超时=按可售库存送。确认为二态，本期不支持改数量（BR-07b）。
   ② 在仓预送库存 PAGES['m-stock-presend']：当日没卖完留仓的预送货，顺延抵扣次日应送量（BR-15）。
   口径见《scm_提前送货与预测预送_功能框架》v0.3。复用主文件全局：DB/toast/nav/render/drawer/closeDrawer/modal/icon。*/
(function(){
  const WHS=['裕廊DC','兀兰DC','盛港DC','大巴窑DC'];
  function hnum(str,mod){let h=11;for(let i=0;i<str.length;i++)h=(h*31+str.charCodeAt(i))>>>0;return h%mod;}
  function pad(n){return n<10?'0'+n:''+n;}

  /* ---------- 数据 ---------- */
  window.ensurePresend=function(){
    if(DB.presend)return;
    DB.presendCfg={tp:'15:00',t0:'16:00',t:'18:00',cutoff:'22:00',window:60};
    DB.presendDeadline=Date.now()+42*60*1000+15*1000;   // 演示：确认窗口剩余 42:15
    DB.presendTab='wait';DB.presendF={};
    DB.presendStockTab='all';DB.presendStockF={};

    // 与「备货参考」同源：按待发货订单聚合到 SKU × 入库仓库，再叠加算法预送量
    const agg={};
    DB.orders.filter(o=>o.status=='pending'||o.status=='packed').forEach(o=>{
      (o.lines||[]).forEach(l=>{
        const key=l.sku+'|'+o.warehouse;
        if(!agg[key])agg[key]={sku:l.sku,name:l.name,unit:l.unit||'件',wh:o.warehouse,orderQty:0};
        agg[key].orderQty+=l.qty;
      });
    });
    const rows=Object.values(agg).map(a=>{
      const p=DB.products.find(x=>x.name==a.name);
      const sk=p&&p.skus&&p.skus[0];
      const spec=sk?`${sk.qty}${p.unit}/件`:a.unit;
      // 算法预测量 = T0 前订单量的 40%–120%（同量级，剩余时段还能卖多少）
      const fcst=Math.max(3,Math.round(a.orderQty*(0.4+hnum(a.name+a.wh+'f',80)/100)));
      const avail=Math.max(3,Math.round(fcst*(0.45+hnum(a.name+a.wh+'a',60)/100))); // 可售库存 = 预测量的 45%–105%
      const hist=[0,1,2,3].map(k=>Math.max(0,fcst-6+hnum(a.name+a.wh+'h'+k,13)));
      return {sku:a.sku,name:a.name,unit:a.unit,spec,cat:(p&&p.cat)||'—',wh:a.wh,
        fcst,avail,orderQty:a.orderQty,hist,
        status:fcst<=avail?'auto':'wait',decidedAt:''};
    });
    // 演示：已确认 / 按库存执行 各留一条样本
    const waits=rows.filter(r=>r.status=='wait');
    if(waits[0]){waits[0].status='confirmed';waits[0].decidedAt='15:12';}
    if(waits[1]){waits[1].status='capped';waits[1].decidedAt='15:00 超时';}
    DB.presend=rows;

    // 在仓预送库存（昨日预送未售完，留仓顺延抵扣次日）
    DB.presendStock=rows.filter((r,i)=>i%2==0).slice(0,7).map(r=>{
      const sent=r.fcst,sold=Math.max(0,sent-2-hnum(r.sku+r.wh+'s',12));
      const left=sent-sold,hold=1+hnum(r.sku+'d',3),shelf=hold+1+hnum(r.sku+'e',5);
      return {sku:r.sku,name:r.name,unit:r.unit,spec:r.spec,wh:r.wh,inDate:'2026-08-30',
        sent,sold,left,hold,shelfLeft:shelf,nextNeed:5+hnum(r.sku+r.wh+'n',30),returning:false};
    });
  };

  // 供「备货参考」取最终预送量（按 商品名 + 仓库 匹配）
  window.presendQty=function(name,wh){
    if(!DB.presend)ensurePresend();
    const r=DB.presend.find(x=>x.name==name&&x.wh==wh);
    return r?finalQty(r):0;
  };

  function cfg(){return DB.presendCfg;}
  function finalQty(r){return r.status=='confirmed'||r.status=='auto'?r.fcst:Math.min(r.fcst,r.avail);}
  function psTag(s){
    const m={auto:['t-gr','无需确认'],wait:['t-y','待确认'],confirmed:['t-g','已确认'],capped:['t-b','按库存执行']}[s]||['t-gr',s];
    return `<span class="tag ${m[0]}"><span class="dot"></span>${m[1]}</span>`;
  }
  window.presendPending=function(){DB.presend||ensurePresend();return DB.presend.filter(r=>r.status=='wait').length;};

  /* ---------- 倒计时（整页 re-render，用常驻 interval 找节点更新） ---------- */
  function leftStr(){
    const ms=DB.presendDeadline-Date.now();
    if(ms<=0)return '已截止';
    const m=Math.floor(ms/60000),s=Math.floor(ms%60000/1000);
    return `${pad(m)}:${pad(s)}`;
  }
  setInterval(()=>{const el=document.getElementById('psCd');if(el&&DB.presendDeadline)el.textContent=leftStr();},1000);

  /* ---------- 预送确认 ---------- */
  function rowsOf(tab){
    const f=DB.presendF||{};
    return DB.presend.filter(r=>{
      if(tab!='all'&&r.status!=tab)return false;
      if(f.wh&&r.wh!=f.wh)return false;
      if(f.kw&&!(r.name.includes(f.kw)||r.sku.includes(f.kw)))return false;
      return true;
    });
  }
  window.psTabTo=function(k){DB.presendTab=k;DB.presendSel=[];render();};
  window.psFilter=function(k,v){DB.presendF=DB.presendF||{};DB.presendF[k]=v;render();};
  window.psReset=function(){DB.presendF={};render();};
  window.psCheck=function(key,on){DB.presendSel=DB.presendSel||[];
    if(on){if(!DB.presendSel.includes(key))DB.presendSel.push(key);}
    else DB.presendSel=DB.presendSel.filter(k=>k!=key);
    render();};
  window.psCheckAll=function(on){
    DB.presendSel=on?rowsOf(DB.presendTab).filter(r=>r.status=='wait').map(r=>r.sku+'|'+r.wh):[];render();};

  function decide(keys,ok){
    let n=0;
    keys.forEach(k=>{const[sku,wh]=k.split('|');const r=DB.presend.find(x=>x.sku==sku&&x.wh==wh);
      if(r&&r.status=='wait'){r.status=ok?'confirmed':'capped';r.decidedAt=ok?'刚刚':'刚刚 已拒绝';n++;}});
    DB.presendSel=[];closeDrawer();render();
    toast(ok?`已确认 ${n} 条，按预测量备货送货`:`已拒绝 ${n} 条，按可售库存备货送货`,ok?'ok':'info');
  }
  window.psConfirm=function(key){decide([key],true);};
  window.psReject=function(key){
    const[sku,wh]=key.split('|');const r=DB.presend.find(x=>x.sku==sku&&x.wh==wh);
    modal(`<h3>确认拒绝预送？</h3>
      <div class="ib ib-y" style="margin:12px 0"><span class="i">${icon('⚠️')}</span><div>拒绝后 <b>${r.name}</b>（${r.wh}）今日预送量将按<b>可售库存 ${r.avail} ${r.unit}</b>执行，少送的 ${r.fcst-r.avail} ${r.unit} 当日卖完即售罄，不再补送。</div></div>
      <div class="row" style="justify-content:flex-end;gap:10px"><button class="btn btn-o" onclick="closeModal()">取消</button>
      <button class="btn btn-d" onclick="closeModal();psDoReject('${key}')">确认拒绝</button></div>`);
  };
  window.psDoReject=function(key){decide([key],false);};
  window.psBatch=function(ok){
    const keys=(DB.presendSel||[]).slice();if(!keys.length)return;
    if(ok)return decide(keys,true);
    modal(`<h3>确认批量拒绝 ${keys.length} 条？</h3>
      <div class="ib ib-y" style="margin:12px 0"><span class="i">${icon('⚠️')}</span><div>这些 SKU 今日预送量将按<b>可售库存</b>执行，缺口部分当日卖完即售罄，不再补送。</div></div>
      <div class="row" style="justify-content:flex-end;gap:10px"><button class="btn btn-o" onclick="closeModal()">取消</button>
      <button class="btn btn-d" onclick="closeModal();psDoBatchReject()">确认拒绝</button></div>`);
  };
  window.psDoBatchReject=function(){decide((DB.presendSel||[]).slice(),false);};

  window.psDrawer=function(key){
    const[sku,wh]=key.split('|');const r=DB.presend.find(x=>x.sku==sku&&x.wh==wh);if(!r)return;
    const avg=Math.round(r.hist.reduce((a,b)=>a+b,0)/r.hist.length);
    const wk=['上周','两周前','三周前','四周前'];
    const gap=r.fcst-r.avail;
    const ft=r.status=='wait'
      ? `<button class="btn btn-o" onclick="psReject('${key}')">拒绝 · 按可售库存 ${r.avail} 送</button><button class="btn btn-p" onclick="psConfirm('${key}')">确认 · 按预测量 ${r.fcst} 送</button>`
      : `<button class="btn btn-o" onclick="closeDrawer()">关闭</button>`;
    drawer(`<div class="drawer-hd"><div><h3>${r.name} <span class="mono" style="font-size:12.5px;color:var(--ts)">${r.sku}</span></h3>
      <div style="margin-top:4px">${psTag(r.status)} <span class="sub" style="font-size:12px">${r.wh} · ${r.spec}</span></div></div>
      <span class="x" onclick="closeDrawer()">×</span></div>
    <div class="drawer-bd">
      <h4 style="font-size:13px;color:var(--ts);margin:0 0 10px">今日预送</h4>
      <table class="subtbl" style="margin-bottom:22px"><tbody>
        <tr><td style="width:42%;color:var(--ts)">算法预测量（${cfg().t0}–${cfg().cutoff} 还能卖）</td><td><b>${r.fcst}</b> ${r.unit}</td></tr>
        <tr><td style="color:var(--ts)">你的可售库存</td><td>${r.avail} ${r.unit}</td></tr>
        <tr><td style="color:var(--ts)">缺口</td><td>${gap>0?`<span style="color:var(--r)">${gap} ${r.unit}</span>`:'<span style="color:var(--ts)">无</span>'}</td></tr>
        <tr><td style="color:var(--ts)">今日订单量（已确认，另计）</td><td>${r.orderQty} ${r.unit}</td></tr>
        <tr><td style="color:var(--ts)"><b>最终预送量</b></td><td><b style="color:var(--g)">${finalQty(r)}</b> ${r.unit}</td></tr>
        <tr><td style="color:var(--ts)"><b>今日应送合计</b>（订单量 + 预送量）</td><td><b>${r.orderQty+finalQty(r)}</b> ${r.unit}</td></tr>
      </tbody></table>

      <h4 style="font-size:13px;color:var(--ts);margin:0 0 10px">预测依据 · 近 4 周同星期几 ${cfg().t0}–${cfg().cutoff} 成交量</h4>
      <table style="margin-bottom:22px"><thead><tr><th>周次</th><th style="text-align:right">该时段成交</th></tr></thead><tbody>
        ${r.hist.map((h,i)=>`<tr><td>${wk[i]}</td><td style="text-align:right">${h} ${r.unit}</td></tr>`).join('')}
        <tr><td style="color:var(--ts)">4 周均值</td><td style="text-align:right;color:var(--ts)">${avg} ${r.unit}</td></tr>
      </tbody></table>

      <h4 style="font-size:13px;color:var(--ts);margin:0 0 10px">时间安排</h4>
      <table class="subtbl"><tbody>
        <tr><td style="width:42%;color:var(--ts)">确认截止</td><td>${cfg().t0}（超时按可售库存执行）</td></tr>
        <tr><td style="color:var(--ts)">到仓送货</td><td>${cfg().t} 前送达 ${r.wh}</td></tr>
        <tr><td style="color:var(--ts)">当日截单</td><td>${cfg().cutoff}，预送量卖完即当日售罄</td></tr>
        <tr><td style="color:var(--ts)">未售完</td><td>留仓顺延，抵扣次日应送量</td></tr>
      </tbody></table>
    </div>
    <div class="drawer-ft">${ft}</div>`);
  };

  PAGES['m-presend']=()=>{
    ensurePresend();
    const tab=DB.presendTab,rows=rowsOf(tab),sel=DB.presendSel||[];
    const cnt=k=>DB.presend.filter(r=>k=='all'||r.status==k).length;
    const waitRows=rows.filter(r=>r.status=='wait');
    const allOn=waitRows.length&&waitRows.every(r=>sel.includes(r.sku+'|'+r.wh));
    const f=DB.presendF||{};
    const dis=sel.length?'':'disabled';

    const body=rows.length?rows.map(r=>{
      const key=r.sku+'|'+r.wh,gap=r.fcst-r.avail,isW=r.status=='wait';
      return `<tr>
        <td><input type="checkbox" ${isW?'':'disabled'} ${sel.includes(key)?'checked':''} onclick="event.stopPropagation();psCheck('${key}',this.checked)"></td>
        <td onclick="psDrawer('${key}')" style="cursor:pointer"><b style="font-weight:600">${r.name}</b>
          <div style="font-size:11px;color:var(--ts)" class="mono">${r.sku}</div></td>
        <td style="color:var(--ts)">${r.spec}</td>
        <td>${r.wh}</td>
        <td style="text-align:right">${r.fcst} <span style="color:var(--ts)">${r.unit}</span></td>
        <td style="text-align:right;color:var(--ts)">${r.avail}</td>
        <td style="text-align:right">${gap>0?`<span style="color:var(--r)">+${gap}</span>`:'<span style="color:var(--tt)">—</span>'}</td>
        <td style="text-align:right"><b>${finalQty(r)}</b> <span style="color:var(--ts)">${r.unit}</span>${isW?'<div style="font-size:11px;color:var(--tt)">未确认按此送</div>':''}</td>
        <td>${psTag(r.status)}${r.decidedAt?`<div style="font-size:11px;color:var(--tt);margin-top:3px">${r.decidedAt}</div>`:''}</td>
        <td>${isW
          ? `<button class="btn btn-sm btn-p" onclick="psConfirm('${key}')">确认</button>
             <button class="btn btn-sm btn-o" onclick="psReject('${key}')">拒绝</button>`
          : `<button class="btn btn-sm btn-link" onclick="psDrawer('${key}')">详情</button>`}</td>
      </tr>`;}).join('')
      : `<tr><td colspan="10"><div class="empty"><div class="e-ic">${icon('📈')}</div><div class="e-t">当前筛选下无预送记录</div><div class="e-s">换个仓库或状态再看看</div></div></td></tr>`;

    return `
    <div class="ib ib-b" style="margin-bottom:14px"><span class="i">${icon('📈')}</span><div>
      <b>预送确认</b>：你的截单时间晚于到仓送货时点，${cfg().t0}–${cfg().cutoff} 还会产生订单。系统按算法预测这段时间的销量作为<b>预送量</b>，随 ${cfg().t} 那趟车一起送来。
      预测量<b>不超过</b>你的可售库存时直接执行；<b>超过</b>时需你确认，<b>${cfg().t0} 前未确认则按可售库存送</b>。预送量同时是当日剩余可售上限，卖完即售罄；没卖完的留仓，抵扣次日应送量。</div></div>

    <div class="card" style="margin-bottom:14px"><div class="card-bd">
      <div class="row" style="justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px">
        <div class="row" style="gap:26px;align-items:center">
          <div><div class="sc-l" style="font-size:11px;color:var(--ts)">确认截止</div>
            <div style="font-size:17px;font-weight:600">${cfg().t0}</div></div>
          <div><div class="sc-l" style="font-size:11px;color:var(--ts)">剩余时间</div>
            <div id="psCd" style="font-size:17px;font-weight:600;color:var(--gold);font-feature-settings:'tnum' 1">${leftStr()}</div></div>
          <div><div class="sc-l" style="font-size:11px;color:var(--ts)">到仓送货</div>
            <div style="font-size:17px;font-weight:600">${cfg().t}</div></div>
          <div><div class="sc-l" style="font-size:11px;color:var(--ts)">当日截单</div>
            <div style="font-size:17px;font-weight:600">${cfg().cutoff}</div></div>
        </div>
        <div style="font-size:12px;color:var(--ts);max-width:340px">超时未确认的 SKU 将自动按<b>可售库存</b>定稿，不影响备货单生成。</div>
      </div>
    </div></div>

    <div class="tabs" style="margin-bottom:12px">
      ${[['wait','待确认'],['confirmed','已确认'],['capped','按库存执行'],['auto','无需确认'],['all','全部']]
        .map(([k,t])=>`<div class="tab ${tab==k?'active':''}" onclick="psTabTo('${k}')">${t} (${cnt(k)})</div>`).join('')}
    </div>

    <div class="card"><div class="card-hd">
      <div class="row" style="gap:10px;align-items:center">
        <select style="width:130px" onchange="psFilter('wh',this.value)">
          <option value="">全部仓库</option>${WHS.map(w=>`<option ${f.wh==w?'selected':''}>${w}</option>`).join('')}
        </select>
        <input style="width:180px" placeholder="商品名称 / SKU" value="${f.kw||''}" oninput="DB.presendF.kw=this.value" onchange="render()">
        <button class="btn btn-o btn-sm" onclick="psReset()">重置</button>
      </div>
      <div class="row" style="gap:8px">
        <button class="btn btn-sm btn-p" ${dis} onclick="psBatch(true)">批量确认${sel.length?` (${sel.length})`:''}</button>
        <button class="btn btn-sm btn-o" ${dis} onclick="psBatch(false)">批量拒绝${sel.length?` (${sel.length})`:''}</button>
      </div>
    </div>
    <div class="card-bd flush"><div style="overflow-x:auto"><table>
      <thead><tr>
        <th style="width:36px"><input type="checkbox" ${allOn?'checked':''} ${waitRows.length?'':'disabled'} onclick="psCheckAll(this.checked)"></th>
        <th>商品</th><th>规格</th><th>入库仓库</th>
        <th style="text-align:right">算法预测量</th><th style="text-align:right">可售库存</th><th style="text-align:right">缺口</th>
        <th style="text-align:right">最终预送量</th><th>状态</th><th style="width:150px">操作</th>
      </tr></thead><tbody>${body}</tbody>
    </table></div></div></div>`;
  };

  /* ---------- 在仓预送库存 ---------- */
  function stockRows(){
    const f=DB.presendStockF||{};
    return DB.presendStock.filter(r=>{
      if(DB.presendStockTab=='expiring'&&r.shelfLeft>2)return false;
      if(f.wh&&r.wh!=f.wh)return false;
      if(f.kw&&!(r.name.includes(f.kw)||r.sku.includes(f.kw)))return false;
      return true;
    });
  }
  window.psStockTab=function(k){DB.presendStockTab=k;DB.presendStockSel=[];render();};
  window.psStockFilter=function(k,v){DB.presendStockF=DB.presendStockF||{};DB.presendStockF[k]=v;render();};
  window.psStockCheck=function(key,on){DB.presendStockSel=DB.presendStockSel||[];
    if(on){if(!DB.presendStockSel.includes(key))DB.presendStockSel.push(key);}
    else DB.presendStockSel=DB.presendStockSel.filter(k=>k!=key);
    render();};
  window.psStockCheckAll=function(on){
    DB.presendStockSel=on?stockRows().filter(r=>!r.returning).map(r=>r.sku+'|'+r.wh):[];render();};
  window.psStockReturn=function(){
    const keys=(DB.presendStockSel||[]).slice();if(!keys.length)return;
    modal(`<h3>申请退回 ${keys.length} 条留仓货？</h3>
      <div class="ib ib-b" style="margin:12px 0"><span class="i">${icon('📦')}</span><div>提交后由仓库安排退回，退回期间该批货<b>不再参与次日抵扣</b>，次日应送量按完整需求下发。</div></div>
      <div class="row" style="justify-content:flex-end;gap:10px"><button class="btn btn-o" onclick="closeModal()">取消</button>
      <button class="btn btn-p" onclick="closeModal();psDoStockReturn()">提交申请</button></div>`);
  };
  window.psDoStockReturn=function(){
    const keys=(DB.presendStockSel||[]).slice();
    keys.forEach(k=>{const[sku,wh]=k.split('|');const r=DB.presendStock.find(x=>x.sku==sku&&x.wh==wh);if(r)r.returning=true;});
    DB.presendStockSel=[];render();toast(`已提交 ${keys.length} 条退回申请，等待仓库安排`,'ok');
  };
  window.psStockDrawer=function(key){
    const[sku,wh]=key.split('|');const r=DB.presendStock.find(x=>x.sku==sku&&x.wh==wh);if(!r)return;
    const need=Math.max(0,r.nextNeed-r.left);
    drawer(`<div class="drawer-hd"><div><h3>${r.name} <span class="mono" style="font-size:12.5px;color:var(--ts)">${r.sku}</span></h3>
      <div style="margin-top:4px"><span class="sub" style="font-size:12px">${r.wh} · ${r.spec}</span></div></div>
      <span class="x" onclick="closeDrawer()">×</span></div>
    <div class="drawer-bd">
      <h4 style="font-size:13px;color:var(--ts);margin:0 0 10px">留仓明细</h4>
      <table class="subtbl" style="margin-bottom:22px"><tbody>
        <tr><td style="width:42%;color:var(--ts)">入仓日期</td><td>${r.inDate}</td></tr>
        <tr><td style="color:var(--ts)">当日预送量</td><td>${r.sent} ${r.unit}</td></tr>
        <tr><td style="color:var(--ts)">当日已售</td><td>${r.sold} ${r.unit}</td></tr>
        <tr><td style="color:var(--ts)"><b>在仓剩余</b></td><td><b>${r.left}</b> ${r.unit}</td></tr>
        <tr><td style="color:var(--ts)">已留仓</td><td>${r.hold} 天</td></tr>
        <tr><td style="color:var(--ts)">剩余保质期</td><td>${r.shelfLeft<=2?`<span style="color:var(--r)">${r.shelfLeft} 天</span>`:`${r.shelfLeft} 天`}</td></tr>
      </tbody></table>
      <h4 style="font-size:13px;color:var(--ts);margin:0 0 10px">次日抵扣</h4>
      <table class="subtbl"><tbody>
        <tr><td style="width:42%;color:var(--ts)">次日订单需求</td><td>${r.nextNeed} ${r.unit}</td></tr>
        <tr><td style="color:var(--ts)">减去在仓剩余</td><td>− ${r.left} ${r.unit}</td></tr>
        <tr><td style="color:var(--ts)"><b>次日应送量</b></td><td><b style="color:var(--g)">${need}</b> ${r.unit}${need==0?' <span style="color:var(--ts);font-size:12px">（在仓货已够，次日免送）</span>':''}</td></tr>
      </tbody></table>
    </div>
    <div class="drawer-ft"><button class="btn btn-o" onclick="closeDrawer()">关闭</button></div>`);
  };

  PAGES['m-stock-presend']=()=>{
    ensurePresend();
    const rows=stockRows(),sel=DB.presendStockSel||[],f=DB.presendStockF||{};
    const able=rows.filter(r=>!r.returning);
    const allOn=able.length&&able.every(r=>sel.includes(r.sku+'|'+r.wh));
    const expCnt=DB.presendStock.filter(r=>r.shelfLeft<=2).length;
    const body=rows.length?rows.map(r=>{
      const key=r.sku+'|'+r.wh,need=Math.max(0,r.nextNeed-r.left);
      return `<tr>
        <td><input type="checkbox" ${r.returning?'disabled':''} ${sel.includes(key)?'checked':''} onclick="event.stopPropagation();psStockCheck('${key}',this.checked)"></td>
        <td onclick="psStockDrawer('${key}')" style="cursor:pointer"><b style="font-weight:600">${r.name}</b>
          <div style="font-size:11px;color:var(--ts)" class="mono">${r.sku}</div></td>
        <td style="color:var(--ts)">${r.spec}</td>
        <td>${r.wh}</td>
        <td style="color:var(--ts)">${r.inDate}</td>
        <td style="text-align:right;color:var(--ts)">${r.sent}</td>
        <td style="text-align:right;color:var(--ts)">${r.sold}</td>
        <td style="text-align:right"><b>${r.left}</b> <span style="color:var(--ts)">${r.unit}</span></td>
        <td style="text-align:right">${r.hold} 天</td>
        <td style="text-align:right">${r.shelfLeft<=2?`<span style="color:var(--r)">${r.shelfLeft} 天</span>`:`<span style="color:var(--ts)">${r.shelfLeft} 天</span>`}</td>
        <td style="text-align:right"><b>${need}</b> <span style="color:var(--ts)">${r.unit}</span>${need==0?'<div style="font-size:11px;color:var(--g)">次日免送</div>':''}</td>
        <td>${r.returning?'<span class="tag t-b"><span class="dot"></span>退回中</span>'
          :`<button class="btn btn-sm btn-link" onclick="psStockDrawer('${key}')">详情</button>`}</td>
      </tr>`;}).join('')
      : `<tr><td colspan="12"><div class="empty"><div class="e-ic">${icon('🏬')}</div><div class="e-t">暂无留仓预送货</div><div class="e-s">当日预送量全部售出，或还未产生留仓</div></div></td></tr>`;

    return `
    <div class="ib ib-b" style="margin-bottom:14px"><span class="i">${icon('🏬')}</span><div>
      <b>在仓预送库存</b>：当日预送到仓、截单后没卖完的货留在仓里，<b>次日订单优先消耗</b>——次日应送量 = 次日需求 − 在仓剩余，够了就不用再送。
      货权归你，滞销与临期由你处理，可申请退回。</div></div>

    <div class="tabs" style="margin-bottom:12px">
      <div class="tab ${DB.presendStockTab=='all'?'active':''}" onclick="psStockTab('all')">全部 (${DB.presendStock.length})</div>
      <div class="tab ${DB.presendStockTab=='expiring'?'active':''}" onclick="psStockTab('expiring')">临期 ≤2天 (${expCnt})</div>
    </div>

    <div class="card"><div class="card-hd">
      <div class="row" style="gap:10px;align-items:center">
        <select style="width:130px" onchange="psStockFilter('wh',this.value)">
          <option value="">全部仓库</option>${WHS.map(w=>`<option ${f.wh==w?'selected':''}>${w}</option>`).join('')}
        </select>
        <input style="width:180px" placeholder="商品名称 / SKU" value="${f.kw||''}" oninput="DB.presendStockF.kw=this.value" onchange="render()">
      </div>
      <div class="row" style="gap:8px">
        <button class="btn btn-sm btn-o" ${sel.length?'':'disabled'} onclick="psStockReturn()">申请退回${sel.length?` (${sel.length})`:''}</button>
      </div>
    </div>
    <div class="card-bd flush"><div style="overflow-x:auto"><table>
      <thead><tr>
        <th style="width:36px"><input type="checkbox" ${allOn?'checked':''} ${able.length?'':'disabled'} onclick="psStockCheckAll(this.checked)"></th>
        <th>商品</th><th>规格</th><th>入库仓库</th><th>入仓日期</th>
        <th style="text-align:right">预送量</th><th style="text-align:right">已售</th><th style="text-align:right">在仓剩余</th>
        <th style="text-align:right">已留仓</th><th style="text-align:right">剩余保质期</th><th style="text-align:right">次日应送量</th><th style="width:90px">操作</th>
      </tr></thead><tbody>${body}</tbody>
    </table></div></div></div>`;
  };

  /* ---------- 送货复盘（日结：今天送多/送少 → 明天送多少） ---------- */
  window.ensurePresendRecon=function(){
    ensurePresend();
    if(DB.presendRecon)return;
    DB.presendReconTab='all';DB.presendReconF={};
    DB.presendReconDate='2026-08-30';
    DB.presendRecon=DB.presend.map(r=>{
      const ps=finalQty(r);
      const planned=r.orderQty+ps;                                  // 应送 = 订单量 + 预送量
      // 商家实际送达：约 1/5 少送（BR-16 按实收计）
      const shortHit=hnum(r.sku+r.wh+'ss',10)<2;
      const received=shortHit?Math.max(r.orderQty,planned-(2+hnum(r.sku+'sd',5))):planned;
      // T0 后真实需求（围绕预送量波动 50%–160%）——大于预送量即卖爆、小于即留仓
      const realAfter=Math.round(ps*(0.55+hnum(r.sku+r.wh+'ra',80)/100));
      const demand=r.orderQty+realAfter;                            // 当日真实总需求
      const sold=Math.min(received,demand);
      const leftover=received-sold;
      const missed=Math.max(0,demand-received);                     // 没接住的需求（送少了的代价）
      // 售罄时点：按已售占 T0 后可售的进度折算到 16:00–22:00
      let soldOutAt='';
      if(missed>0){
        const avail=Math.max(1,received-r.orderQty);
        const h=16+Math.min(5.9,avail/Math.max(1,realAfter)*6);
        soldOutAt=`${String(Math.floor(h)).padStart(2,'0')}:${String(Math.round(h%1*60/10)*10%60).padStart(2,'0')}`;
      }
      const nextOrderNeed=Math.max(2,Math.round(r.orderQty*(0.7+hnum(r.sku+r.wh+'no',70)/100)));
      const nextFcst=Math.max(2,Math.round(ps*(0.7+hnum(r.sku+r.wh+'nf',70)/100)));
      const nextShould=Math.max(0,nextOrderNeed+nextFcst-leftover);
      const result=missed>0?'short':(leftover>0?'over':'fit');
      return {sku:r.sku,name:r.name,unit:r.unit,spec:r.spec,wh:r.wh,
        orderQty:r.orderQty,psQty:ps,planned,received,shortSend:planned-received,
        demand,sold,leftover,missed,soldOutAt,
        nextOrderNeed,nextFcst,nextShould,result};
    });
  };
  function rcRows(){
    const f=DB.presendReconF||{},tab=DB.presendReconTab;
    return DB.presendRecon.filter(r=>{
      if(tab!='all'&&r.result!=tab)return false;
      if(f.wh&&r.wh!=f.wh)return false;
      if(f.kw&&!(r.name.includes(f.kw)||r.sku.includes(f.kw)))return false;
      return true;
    });
  }
  function rcTag(r){
    const m={over:['t-y','送多了'],short:['t-r','送少了'],fit:['t-g','刚好']}[r.result];
    return `<span class="tag ${m[0]}"><span class="dot"></span>${m[1]}</span>`;
  }
  window.rcTabTo=function(k){DB.presendReconTab=k;render();};
  window.rcFilter=function(k,v){DB.presendReconF=DB.presendReconF||{};DB.presendReconF[k]=v;render();};
  window.rcReset=function(){DB.presendReconF={};render();};
  window.rcDrawer=function(key){
    const[sku,wh]=key.split('|');const r=DB.presendRecon.find(x=>x.sku==sku&&x.wh==wh);if(!r)return;
    const line=(k,v,hl)=>`<tr><td style="width:46%;color:var(--ts)">${k}</td><td${hl?' style="font-weight:600"':''}>${v}</td></tr>`;
    drawer(`<div class="drawer-hd"><div><h3>${r.name} <span class="mono" style="font-size:12.5px;color:var(--ts)">${r.sku}</span></h3>
      <div style="margin-top:4px">${rcTag(r)} <span class="sub" style="font-size:12px">${r.wh} · ${DB.presendReconDate}</span></div></div>
      <span class="x" onclick="closeDrawer()">×</span></div>
    <div class="drawer-bd">
      <h4 style="font-size:13px;color:var(--ts);margin:0 0 10px">当天这批货去哪了</h4>
      <table class="subtbl" style="margin-bottom:22px"><tbody>
        ${line('应送（订单 '+r.orderQty+' + 预送 '+r.psQty+'）',r.planned+' '+r.unit,1)}
        ${line('实际送达',r.received+' '+r.unit+(r.shortSend>0?` <span style="color:var(--r)">少送 ${r.shortSend}</span>`:''))}
        ${line('当日真实需求',r.demand+' '+r.unit)}
        ${line('实际卖出',r.sold+' '+r.unit,1)}
        ${line('卖剩留仓',r.leftover>0?`<span style="color:var(--y)">${r.leftover} ${r.unit}</span>`:'0')}
        ${line('没接住的需求',r.missed>0?`<span style="color:var(--r)">${r.missed} ${r.unit}</span>（${r.soldOutAt} 售罄）`:'0')}
      </tbody></table>

      <h4 style="font-size:13px;color:var(--ts);margin:0 0 10px">${r.result=='over'?'为什么送多了':r.result=='short'?'为什么送少了':'昨天送得刚好'}</h4>
      <div class="ib ${r.result=='over'?'ib-y':r.result=='short'?'ib-r':'ib-g'}" style="margin-bottom:22px"><span class="i">${icon(r.result=='short'?'⚠️':'📈')}</span><div>
        ${r.result=='over'
          ? `预送 ${r.psQty} ${r.unit}，${DB.presendCfg.t0} 后实际只卖出 ${r.demand-r.orderQty} ${r.unit}，多送的 <b>${r.leftover} ${r.unit}</b> 留在仓里，<b>已自动抵扣今日应送量</b>，不用重复送。`
          : r.result=='short'
          ? `${DB.presendCfg.t0} 后实际需求 ${r.demand-r.orderQty} ${r.unit}，超过当时可卖的量，<b>${r.soldOutAt} 就售罄</b>，少接了 <b>${r.missed} ${r.unit}</b> 的单。${r.shortSend>0?`其中 ${r.shortSend} ${r.unit} 是你当天没送足。`:'预送量本身给少了，算法会据此修正。'}`
          : `送达 ${r.received} ${r.unit}、卖出 ${r.sold} ${r.unit}，既没压货也没断货。`}
      </div></div>

      <h4 style="font-size:13px;color:var(--ts);margin:0 0 10px">那今天该送多少</h4>
      <table class="subtbl"><tbody>
        ${line('今日订单需求',r.nextOrderNeed+' '+r.unit)}
        ${line('今日预送量（算法）','+ '+r.nextFcst+' '+r.unit)}
        ${line('减去在仓剩余','− '+r.leftover+' '+r.unit)}
        <tr><td style="color:var(--ts)"><b>今日应送</b></td><td><b style="color:var(--g);font-size:16px">${r.nextShould}</b> ${r.unit}${r.nextShould==0?' <span style="color:var(--ts);font-size:12px">（在仓货已够，今日免送）</span>':''}</td></tr>
      </tbody></table>
    </div>
    <div class="drawer-ft"><button class="btn btn-o" onclick="closeDrawer()">关闭</button><button class="btn btn-p" onclick="closeDrawer();nav('m-pick-label')">去打印标签</button></div>`);
  };

  PAGES['m-presend-recon']=()=>{
    ensurePresendRecon();
    const rows=rcRows(),f=DB.presendReconF||{},tab=DB.presendReconTab;
    const cnt=k=>DB.presendRecon.filter(r=>k=='all'||r.result==k).length;
    const body=rows.length?rows.map(r=>{
      const key=r.sku+'|'+r.wh;
      return `<tr onclick="rcDrawer('${key}')" style="cursor:pointer">
        <td><b style="font-weight:600">${r.name}</b><div style="font-size:11px;color:var(--ts)" class="mono">${r.sku}</div></td>
        <td>${r.wh}</td>
        <td style="text-align:right">${r.planned} <span style="color:var(--ts)">${r.unit}</span>
          <div style="font-size:11px;color:var(--ts)">订单 ${r.orderQty} · <span style="color:var(--gold)">预送 ${r.psQty}</span></div></td>
        <td style="text-align:right">${r.received}${r.shortSend>0?`<div style="font-size:11px;color:var(--r)">少送 ${r.shortSend}</div>`:''}</td>
        <td style="text-align:right;color:var(--ts)">${r.sold}</td>
        <td style="text-align:right">${r.leftover>0?`<span style="color:var(--y)">${r.leftover}</span>`:'<span style="color:var(--tt)">—</span>'}</td>
        <td style="text-align:right">${r.missed>0?`<span style="color:var(--r)">${r.missed}</span><div style="font-size:11px;color:var(--tt)">${r.soldOutAt} 售罄</div>`:'<span style="color:var(--tt)">—</span>'}</td>
        <td>${rcTag(r)}</td>
        <td style="text-align:right"><b style="color:var(--g)">${r.nextShould}</b> <span style="color:var(--ts)">${r.unit}</span>${r.nextShould==0?'<div style="font-size:11px;color:var(--g)">今日免送</div>':''}</td>
      </tr>`;}).join('')
      : `<tr><td colspan="9"><div class="empty"><div class="e-ic">${icon('📊')}</div><div class="e-t">当前筛选下无复盘记录</div><div class="e-s">换个仓库或结果类型再看看</div></div></td></tr>`;

    return `
    <div class="ib ib-b" style="margin-bottom:14px"><span class="i">${icon('📊')}</span><div>
      <b>送货复盘</b>：看昨天送的货<b>送多了还是送少了</b>，以及<b>今天该送多少</b>。
      送多了 → 卖剩的留仓，<b>自动抵扣今日应送量</b>；送少了 → 提前售罄、少接的单在这里能看到，算法会据此修正后续预送量。
      <b>今日应送 = 今日订单需求 + 今日预送量 − 在仓剩余</b>。</div></div>

    <div class="tabs" style="margin-bottom:12px">
      ${[['all','全部'],['over','送多了'],['short','送少了'],['fit','刚好']]
        .map(([k,t])=>`<div class="tab ${tab==k?'active':''}" onclick="rcTabTo('${k}')">${t} (${cnt(k)})</div>`).join('')}
    </div>

    <div class="card"><div class="card-hd">
      <div class="row" style="gap:10px;align-items:center">
        <span style="font-size:12.5px;color:var(--ts)">送货日</span>
        <select style="width:150px"><option>${DB.presendReconDate}</option></select>
        <select style="width:130px" onchange="rcFilter('wh',this.value)">
          <option value="">全部仓库</option>${WHS.map(w=>`<option ${f.wh==w?'selected':''}>${w}</option>`).join('')}
        </select>
        <input style="width:180px" placeholder="商品名称 / SKU" value="${f.kw||''}" oninput="DB.presendReconF.kw=this.value" onchange="render()">
        <button class="btn btn-o btn-sm" onclick="rcReset()">重置</button>
      </div>
      <div class="row" style="gap:8px">
        <button class="btn btn-o btn-sm" onclick="toast('已导出送货复盘.xlsx','ok')">导出</button>
        <button class="btn btn-p btn-sm" onclick="nav('m-pick-label')">去打印今日标签</button>
      </div>
    </div>
    <div class="card-bd flush"><div style="overflow-x:auto"><table>
      <thead><tr>
        <th>商品</th><th>入库仓库</th>
        <th style="text-align:right">应送</th><th style="text-align:right">实际送达</th><th style="text-align:right">卖出</th>
        <th style="text-align:right">卖剩留仓</th><th style="text-align:right">没接住</th><th>结果</th>
        <th style="text-align:right">今日应送</th>
      </tr></thead><tbody>${body}</tbody>
    </table></div></div></div>`;
  };

})();
