/* PC · 送货核货（2026-10-14 新增）
   背景：商家送货到仓错漏多。改为：截单后商家先按送货单逐 SKU 核货，核完仓库才能扫码签到收货。
   口径（2026-10-14 沈亮「按建议」拍板）：
   - 粒度：按送货单（一仓一张）逐 SKU 核「件数」，称重品也只核件数（重量走称重录入）。
   - 动作：PC 手动核货——「实际核货数量」列预填该 SKU 实际打印的标签张数（2026-10-15 改，原预填应送），商家只改装少的行 → 确认核货。
           上限 = min(实际打印数, 应送数量)（不能多填），下限 0；打印数 < 应送的行一打开就显示少送。
           App 另支持扫码核货（2026-10-14 追加）：从 0 起扫一张标签 +1 件，同序号去重、别仓/别单/本单无此 SKU 不计数并报警；结果写同一 d.check（method=scan）。
   - 少装：允许带差异提交 = 商家申报缺货。缺口照现有少货链路走（平台补采优先 → 补不足按实收出库标缺货），
           缺货罚款仍按仓库实收清点计，主动申报不减免。核货数量只作对账参考，结算一律以仓库实收为准。
   - 卡点：未核货 / 核货已失效 → 仓库扫码签到被拦截。营业截止（= 当日截单时间）之后才能开始核货（与打印送货单同一时点），不设截止时间。
   - 撤回：签到前可撤回重核；签到后锁定。
   - 失效：核货后送货单应送数量变化（客户取消 / 改单）→ 核货自动失效，需重核。
   - 开通：运营平台按店铺开通「送货前核货」，默认未开通。开通的店铺走核货；未开通的店铺保持现有流程（打印送货单 → 仓库扫码签到），
           商家端不出现任何核货列 / 按钮 / 角标。开通 / 关闭立即生效，只影响尚未签到的送货单。
   复用：DB / dvDetailLines / dvCutoff / drawer / closeDrawer / modal / closeModal / toast / render / money。 */
(function(){
  /* ---------- 店铺开关（运营平台配置）---------- */
  window.ckCfgOf=function(mcode){
    if(!mcode||mcode==DB.merchant.code){if(DB.merchant.checkMode===undefined)DB.merchant.checkMode=true;return {on:DB.merchant.checkMode===true};}   // 演示店铺：已开通
    DB.shopCheck=DB.shopCheck||{};
    return DB.shopCheck[mcode]||(DB.shopCheck[mcode]={on:false});   // 其他店铺默认未开通
  };
  window.ckOn=function(){return ckCfgOf(DB.merchant.code).on;};

  function nowStr(){const d=new Date(),p=n=>String(n).padStart(2,'0');return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;}
  function who(){return (DB.merchant&&(DB.merchant.contact||DB.merchant.name))||'商家账号';}
  function dvGet(id){return (DB.deliveries||[]).find(x=>x.id==id);}
  function isDone(d){return d.status=='交接完成';}
  function isLocked(d){return d.signed||isDone(d);}

  /* 核货行：取送货单商品明细（与送货单详情同源），只要 SKU / 名称 / 规格 / 应送 */
  window.ckLines=function(d){
    const ls=(typeof dvDetailLines=='function')?dvDetailLines(d):[];
    return ls.map(l=>{const should=+l.bookQty||0,printed=ckPrinted(d,l.sku,should);
      return {sku:l.sku,name:l.name,spec:l.spec,unit:l.skuUnit||'件',should,printed,cap:Math.min(printed,should)};});
  };
  /* 实际打印数：该送货单（仓库）该 SKU 已打印的标签张数，取打印标签记录 DB.labelPrinted[仓库|SKU]（首打 / 续打 / 按序号打；补打不计）。
     演示数据无打印记录时按应送；SEED_PRINTED 预置一条少打的，便于看「打印数 < 应送」。 */
  const SEED_PRINTED={'SH20260701001':{'SKU8802':8}};
  function ckPrinted(d,sku,should){
    const s=SEED_PRINTED[d.id]&&SEED_PRINTED[d.id][sku];if(s!=null)return s;
    const lp=DB.labelPrinted&&DB.labelPrinted[d.warehouse+'|'+sku];
    return lp!=null?lp:should;
  }

  /* 演示播种：上线前已签到 / 已入库的送货单补一条核货记录，便于看「应送 / 核货 / 实收」三列对比 */
  const SEED_SHORT={'SH20260701008':{'SKU8807':20}};   // 芥蓝应送 25，商家核货时申报缺货 5（实收 20，与核货一致）
  function seed(d){
    if(d._ckSeeded)return;d._ckSeeded=true;
    if(!isLocked(d)||d.check)return;
    const lines={},snap={};
    ckLines(d).forEach(l=>{const s=SEED_SHORT[d.id]&&SEED_SHORT[d.id][l.sku];lines[l.sku]=(s!=null?s:l.cap);snap[l.sku]=l.should;});
    d.check={by:who(),at:`${d.deliver} ${d.signTime?ckBefore(d.signTime):'23:40'}`,lines,snap,method:d.id=='SH20260701008'?'scan':'manual',manualAdj:0};
  }

  function ckBefore(t){const [h,m]=t.split(':').map(Number);const x=(h*60+m-8+1440)%1440;return String(Math.floor(x/60)).padStart(2,'0')+':'+String(x%60).padStart(2,'0');}   // 演示：签到前 8 分钟核货
  /* 核货状态：off 无需核货 / todo 待核货 / stale 需重核 / done 已核货 */
  window.ckState=function(d){
    if(!ckOn())return 'off';   // 未开通：走现有流程，不涉及核货
    seed(d);
    if(!ckLines(d).some(l=>l.should>0))return 'off';   // 应送全为 0：无需核货
    if(d.check){
      if(isLocked(d))return 'done';
      const cur=ckLines(d);const snap=d.check.snap||{};
      const changed=cur.length!=Object.keys(snap).length||cur.some(l=>snap[l.sku]!==l.should);
      return changed?'stale':'done';
    }
    if(isLocked(d))return 'none';   // 已签到但没有核货记录（开通前已签到 / 校验降级放行）
    return 'todo';
  };
  window.ckBlocked=function(d){const s=ckState(d);return s=='todo'||s=='stale';};
  window.ckPendingCount=function(){
    if(!ckOn())return 0;
    if(typeof ensureDeliveriesDemo=='function')ensureDeliveriesDemo();
    return (DB.deliveries||[]).filter(d=>!isLocked(d)&&(typeof dvCutoff!='function'||dvCutoff(d).passed)&&ckBlocked(d)).length;   // 已截单、未签到
  };
  window.ckTag=function(d){
    const s=ckState(d);
    const m={off:['无需核货','t-gr'],none:['未核货','t-gr'],todo:['待核货','t-y'],stale:['需重核','t-r'],done:['已核货','t-g']}[s];
    return `<span class="tag ${m[1]}"><span class="dot"></span>${m[0]}</span>`;
  };
  // 某 SKU 的商家核货数量（未核为 null）
  window.ckQty=function(d,sku){ckState(d);return (d.check&&d.check.lines[sku]!=null)?d.check.lines[sku]:null;};
  // 少送合计 = Σ(应送 − 核货)
  window.ckShortQty=function(d){if(!d.check)return 0;return ckLines(d).reduce((a,l)=>a+Math.max(0,l.should-(d.check.lines[l.sku]!=null?d.check.lines[l.sku]:l.should)),0);};
  // 实收少于核货（核了但没收到 → 按少送处理，送货单上提示）
  window.ckRecvGap=function(d){
    if(!d.check||!isDone(d))return 0;
    return ((typeof dvDetailLines=='function')?dvDetailLines(d):[]).reduce((a,l)=>{const c=d.check.lines[l.sku];return a+((c!=null&&l.recvQty!=null&&l.recvQty<c)?(c-l.recvQty):0);},0);
  };
  // 列表三列（一字段一列）：核货状态 / 核货时间 / 少送件数
  window.ckCols=function(d){
    const s=ckState(d),c=d.check&&s!='none'?d.check:null,sh=c?ckShortQty(d):0;
    return `<td style="white-space:nowrap">${ckTag(d)}</td><td style="white-space:nowrap;color:var(--ts)">${c?c.at:'—'}</td><td style="text-align:right">${c?(sh?`<b style="color:var(--r)">${sh}</b>`:'0'):'—'}</td>`;
  };

  /* ---------- 核货抽屉 ---------- */
  let CK=null;   // 编辑中的草稿 {id, qty:{sku:n}}
  window.ck_open=function(id){
    const d=dvGet(id);if(!d)return;
    const st=ckState(d),ro=isLocked(d)||(st=='done'&&!(CK&&CK.edit==id));
    const cf=(typeof dvCutoff=='function')?dvCutoff(d):{passed:true};
    if(st=='none'||st=='off')return;
    if(!ro&&!cf.passed){toast(`未到营业截单时间 ${cf.at}，截单后才能核货`,'err');return;}
    const ls=ckLines(d).filter(l=>l.should>0);
    if(!ro){CK={id,qty:{}};ls.forEach(l=>{const c=(st=='done'||st=='stale')&&d.check?d.check.lines[l.sku]:null;CK.qty[l.sku]=c!=null?Math.min(c,l.cap):l.cap;});CK.init=JSON.stringify(CK.qty);}
    const q=sku=>ro?(d.check?d.check.lines[sku]:null):CK.qty[sku];
    const rows=ls.map((l,i)=>{const v=q(l.sku),diff=v==null?null:v-l.should;
      return `<tr id="ckr-${i}" style="${diff<0?'background:#FDF3F2':''}">
        <td><b style="font-weight:600">${l.name}</b><div class="mono" style="font-size:11px;color:var(--ts)">${l.sku}</div></td>
        <td style="color:var(--ts)">${l.spec||'—'}</td>
        <td style="text-align:right">${l.should} <span style="color:var(--ts)">${l.unit}</span></td>
        <td style="text-align:right">${ro?`<b>${v==null?'—':v}</b>`:`<input type="number" min="0" max="${l.cap}" step="1" value="${v}" style="width:84px;text-align:right" oninput="ck_input('${l.sku}',${i},${l.should},${l.cap},this)" onfocus="this.select()">`}</td>
        <td id="ckd-${i}" style="text-align:right">${diff==null?'—':(diff<0?`<b style="color:var(--r)">${diff}</b>`:'<span style="color:var(--tt)">0</span>')}</td>
      </tr>`;}).join('');
    const stale=st=='stale'&&!ro;
    drawer(`<div class="drawer-hd"><div><h3>${ro?'核货记录':'送货核货'} · ${d.warehouse}</h3>
        <div style="margin-top:4px">${ckTag(d)} <span class="sub" style="font-size:12px"><span class="mono">${d.id}</span> · 送达 ${d.deliver} ${d.window||''} · ${ls.length} 个 SKU</span></div></div>
        <span class="x" onclick="closeDrawer()">×</span></div>
      <div class="drawer-bd">
        ${stale?`<div class="ib ib-r" style="margin-bottom:12px"><span class="i">⚠️</span><div>上次核货后<b>应送数量变了</b>（客户取消或改单），请按新的应送再核一遍。</div></div>`:''}
        ${ro?(d.check?`<div class="ib ib-gr" style="margin-bottom:12px"><span class="i">✅</span><div>${d.check.by} 于 ${d.check.at} ${d.check.method=='scan'?`在 App <b>扫码核货</b>${d.check.manualAdj?`（手动补录 ${d.check.manualAdj} 件）`:''}`:'确认核货'}${ckShortQty(d)?`，少送 <b style="color:var(--r)">${ckShortQty(d)}</b> 件`:'，与应送一致'}。${isLocked(d)?'仓库已签到，不能再改。':'仓库签到前可以修改或撤回。'}</div></div>`:'')
          :`<div class="ib ib-b" style="margin-bottom:12px"><span class="i">📦</span><div>已按实际打印的标签数带出，对照车上实际装的货，数量对的不用动，只改装少的。在车边核可以用商家 App 扫码。</div></div>`}
        <table><thead><tr><th>商品</th><th>规格</th><th style="text-align:right">应送数量</th><th style="text-align:right">${ro?'核货数量':'实际核货数量'}</th><th style="text-align:right">差异</th></tr></thead>
          <tbody>${rows}</tbody></table>
        <div id="ck-sum" style="margin-top:12px;font-size:12.5px;color:var(--ts)">${ckSumHtml(d,ls,ro)}</div>
        ${ro?'':`<div style="margin-top:14px;font-size:12px;color:var(--ts);line-height:1.7">少送的照现在的少货规则处理，罚款按仓库实际收到的数算。</div>`}
      </div>
      <div class="drawer-ft">${ro
        ?`<button class="btn btn-o" onclick="closeDrawer()">关闭</button>${(!isLocked(d)&&d.check)?`<button class="btn btn-o" style="color:var(--r)" onclick="ck_revoke('${d.id}')">撤回核货</button><button class="btn btn-p" onclick="ck_reopen('${d.id}')">修改核货</button>`:''}`
        :`<button class="btn btn-o" onclick="ck_cancel()">取消</button><button class="btn btn-p" onclick="ck_submit('${d.id}')">确认核货</button>`}</div>`);
  };
  function ckSumHtml(d,ls,ro){
    const get=sku=>ro?(d.check?d.check.lines[sku]:0):CK.qty[sku];
    const sh=ls.reduce((a,l)=>a+l.should,0),ck=ls.reduce((a,l)=>a+(+get(l.sku)||0),0),gap=sh-ck;
    const n=ls.filter(l=>(+get(l.sku)||0)<l.should).length;
    return `应送 <b style="color:var(--tp)">${sh}</b> 件 · ${ro?'核货':'实际核货'} <b style="color:var(--tp)">${ck}</b> 件 · ${gap>0?`<b style="color:var(--r)">少送 ${gap} 件（${n} 个 SKU）</b>`:'<b style="color:var(--g)">与应送一致</b>'}`;
  }
  window.ck_input=function(sku,i,max,cap,el){
    if(!CK)return;
    let v=el.value===''?'':Math.floor(+el.value);
    if(v!==''&&(isNaN(v)||v<0)){v=0;el.value=0;}
    if(v!==''&&v>cap){v=cap;el.value=cap;toast(cap<max?`不能超过实际打印数 ${cap}，要多送请先去打印标签`:`不能超过应送 ${max}，多带的仓库照收，不用填`,'info');}
    CK.qty[sku]=v===''?0:v;
    const diff=(v===''?0:v)-max,cell=document.getElementById('ckd-'+i),row=document.getElementById('ckr-'+i);
    if(cell)cell.innerHTML=diff<0?`<b style="color:var(--r)">${diff}</b>`:'<span style="color:var(--tt)">0</span>';
    if(row)row.style.background=diff<0?'#FDF3F2':'';
    const d=dvGet(CK.id);const s=document.getElementById('ck-sum');if(d&&s)s.innerHTML=ckSumHtml(d,ckLines(d),false);
  };
  window.ck_submit=function(id){
    const d=dvGet(id);if(!d||!CK||CK.id!=id)return;
    if(isLocked(d)){toast('仓库已签到，不能再修改核货','err');return;}
    const ls=ckLines(d);
    const shorts=ls.filter(l=>(+CK.qty[l.sku]||0)<l.should);
    const commit=()=>{
      const lines={},snap={};ls.forEach(l=>{lines[l.sku]=+CK.qty[l.sku]||0;snap[l.sku]=l.should;});
      d.check={by:who(),at:nowStr(),lines,snap};CK=null;
      closeModal();closeDrawer();render();
      const sh=ckShortQty(d);
      toast(sh?`${d.id} 已核货，少送 ${sh} 件，仓库可签到收货`:`${d.id} 已核货，仓库可签到收货`,'ok');
    };
    if(!shorts.length){commit();return;}
    const gap=shorts.reduce((a,l)=>a+l.should-(+CK.qty[l.sku]||0),0);
    window._ckCommit=commit;
    modal(`<div class="mc-hd"><h3>确认少送 ${gap} 件？</h3><p>${d.id} · ${d.warehouse}</p><button class="mc-x" onclick="closeModal()">×</button></div>
      <div class="mc-bd">
        <table class="subtbl"><thead><tr><th>商品</th><th style="text-align:right">应送</th><th style="text-align:right">实际核货</th><th style="text-align:right">少送</th></tr></thead><tbody>
          ${shorts.map(l=>`<tr><td>${l.name}</td><td style="text-align:right">${l.should}</td><td style="text-align:right">${+CK.qty[l.sku]||0}</td><td style="text-align:right;color:var(--r)"><b>${l.should-(+CK.qty[l.sku]||0)}</b></td></tr>`).join('')}
        </tbody></table>
        <div class="ib ib-y" style="margin-top:12px"><span class="i">⚠️</span><div>少送的照现在的少货规则处理：平台有货就替你补上（按自营原价从结算里扣），没货就不补；罚款按仓库实际收到的数算，提前报了也照罚。</div></div>
      </div>
      <div class="mc-ft"><button class="btn btn-o" onclick="closeModal()">返回修改</button><button class="btn btn-p" onclick="_ckCommit()">确认核货</button></div>`);
  };
  window.ck_cancel=function(){
    if(CK&&CK.init&&JSON.stringify(CK.qty)!==CK.init){window._ckDiscard=()=>{CK=null;closeModal();closeDrawer();};
      modal(`<div class="mc-hd"><h3>放弃修改？</h3><button class="mc-x" onclick="closeModal()">×</button></div><div class="mc-bd"><div class="ib ib-y"><span class="i">⚠️</span><div>改过的数量不会保存。</div></div></div><div class="mc-ft"><button class="btn btn-o" onclick="closeModal()">继续核货</button><button class="btn btn-d" onclick="_ckDiscard()">放弃</button></div>`);return;}
    CK=null;closeDrawer();};
  window.ck_revoke=function(id){
    const d=dvGet(id);if(!d)return;
    if(isLocked(d)){toast('仓库已签到，核货记录已锁定，不能撤回','err');return;}
    window._ckRevoke=()=>{delete d.check;closeModal();closeDrawer();render();toast(`已撤回 ${id} 的核货，重新核货前仓库无法签到收货`,'info');};
    modal(`<div class="mc-hd"><h3>撤回核货？</h3><button class="mc-x" onclick="closeModal()">×</button></div>
      <div class="mc-bd"><div class="ib ib-y"><span class="i">⚠️</span><div>撤回后要重新核货，仓库才能签到收货。</div></div></div>
      <div class="mc-ft"><button class="btn btn-o" onclick="closeModal()">取消</button><button class="btn btn-d" onclick="_ckRevoke()">确认撤回</button></div>`);
  };
  // 已核货的单子，「重新核货」= 撤回 + 重开编辑（签到前）
  window.ck_reopen=function(id){const d=dvGet(id);if(!d||isLocked(d))return;CK={edit:id};closeDrawer();ck_open(id);};

  /* ---------- 签到拦截：仓库扫码签到前校验核货（演示仓库端扫码）---------- */
  const _doSign=window.deliv_doSign;
  window.deliv_doSign=function(id){
    const d=dvGet(id);if(!d)return;
    if(ckBlocked(d)){
      const st=ckState(d);
      modal(`<div class="mc-hd"><h3>仓库扫码结果 · 签到被拦截</h3><p>${d.id} · ${d.warehouse}</p><button class="mc-x" onclick="closeModal()">×</button></div>
        <div class="mc-bd"><div class="ib ib-r"><span class="i">⛔</span><div><b>${st=='stale'?'应送数量变了，要重新核货':'商家还没核货'}</b>，仓库暂不能签到收货。<br>请打开 App「送货签到」或后台「送货管理」核货，核完仓库再扫码。</div></div></div>
        <div class="mc-ft"><button class="btn btn-o" onclick="closeModal()">关闭</button><button class="btn btn-p" onclick="closeModal();ck_open('${d.id}')">去核货</button></div>`);
      return;
    }
    _doSign(id);
  };
})();
