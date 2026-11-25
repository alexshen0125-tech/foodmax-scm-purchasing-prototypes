/* PC · 送货核货（2026-10-14 新增）
   背景：商家送货到仓错漏多。改为：截单后商家先按送货单逐 SKU 核货，核完仓库才能扫码签到收货。
   口径（2026-10-14 沈亮「按建议」拍板）：
   - 粒度：按送货单（一仓一张）逐 SKU 核「件数」，称重品也只核件数（重量走称重录入）。
   - 动作：PC 手动核货——「实际核货数量」列预填该 SKU 实际打印的标签张数（2026-10-15 改，原预填应送），商家只改装少的行 → 确认核货。
           上限 = min(实际打印数, 应送数量)（不能多填），下限 0；打印数 < 应送的行一打开就显示少送。
           App 另支持扫码核货（2026-10-14 追加）：从 0 起扫一张标签 +1 件，同序号去重、不是本单的标签不计数（不判断别仓 / 别单）；结果写同一 d.check（method=scan）。
   - 少装：允许带差异提交 = 商家申报缺货。缺口照现有少货链路走（平台补采优先 → 补不足按实收出库标缺货），
           缺货罚款仍按仓库实收清点计，主动申报不减免。核货数量只作对账参考，结算一律以仓库实收为准。
   - 卡点：未核货 / 核货已失效 → 仓库扫码签到被拦截。2026-11-25 改：送货单生成（首次打印标签）后即可核货，截单前也能核；
           截单前客户还可能下单 / 改单，应送变了照旧「需重核」。不设截止时间。
   - 核货明细（2026-11-25 v3 改为累计口径）：每扫一张、每填一次数、每次补录 / 撤回一张、完成 / 撤回核货，都记一条明细（d.ckLog），
           扫错的（已扫过 / 已扫够 / 不是本单的标签）也记、标「不计数」。进度 = 按明细累加的已核件数 / 当前应送；手动「填几就是核了几个」。
           多次、多人、多台设备扫的都累加；应送变了不作废已扫的，只按新应送重新算进度（变少的多出部分不计）。
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

  /* ---------- 核货明细（累计口径）---------- */
  // 明细：{at,by,src:'App'|'后台',kind:'scan'|'adj'|'undo'|'manual'|'done'|'revoke',sku,name,seq,res,delta,to,pre}
  //   scan  扫一张：res=ok 计 +1；dup 已扫过 / full 已扫够 / not_in 不是本单的标签 —— 不计数（核货是商家自己核，不判断别仓 / 别单）
  //   adj   补录 +1（标签破损）；undo 撤回最近一张 −1；manual 手动填数「填几就是核了几个」（to=填的数）
  //   done  完成核货（确认 / 提交异常核货）；revoke 撤回核货（已扫明细保留）
  function addMin(ts,m){const [dd,t]=String(ts).split(' ');const [h,mi]=t.split(':').map(Number);const x=h*60+mi+m;return `${dd} ${String(Math.floor(x/60)%24).padStart(2,'0')}:${String(x%60).padStart(2,'0')}`;}
  window.ckTally=function(d){   // 回放明细 → 每 SKU 已核、扫码件数、手动件数
    const per={},sc={};
    (d.ckLog||[]).forEach(x=>{if(!x.sku)return;per[x.sku]=per[x.sku]||0;sc[x.sku]=sc[x.sku]||0;
      if(x.kind=='scan'&&x.res=='ok'){per[x.sku]++;sc[x.sku]++;}
      else if(x.kind=='adj')per[x.sku]++;
      else if(x.kind=='undo'){per[x.sku]=Math.max(0,per[x.sku]-1);if(x.undoScan)sc[x.sku]=Math.max(0,sc[x.sku]-1);}
      else if(x.kind=='manual'){per[x.sku]=x.to;sc[x.sku]=Math.min(sc[x.sku],x.to);}});
    const ls=ckLines(d);let done=0,scan=0,tot=0;
    ls.forEach(l=>{const v=Math.min(per[l.sku]||0,l.cap);done+=v;scan+=Math.min(sc[l.sku]||0,v);tot+=l.should;});
    return {per,done,scan,manual:done-scan,tot,gap:Math.max(0,tot-done),n:(d.ckLog||[]).length};
  };
  function ckPush(d,x){d.ckLog=d.ckLog||[];const t=Object.assign({at:nowStr(),by:who(),src:'后台',pre:(typeof dvCutoff=='function')&&!dvCutoff(d).passed},x);d.ckLog.push(t);t.cum=ckTally(d).done;return t;}

  /* 演示播种：上线前已签到 / 已入库的送货单补核货明细，便于看「应送 / 核货 / 实收」与累计进度 */
  const SEED_SHORT={'SH20260701008':{'SKU8807':20}};   // 芥蓝应送 25，商家核货 20（扫 18 + 破损补录 2），少送 5
  function seed(d){
    if(d._ckSeeded)return;d._ckSeeded=true;
    if(!isLocked(d)||d.check)return;
    const lines={},snap={};d.ckLog=[];
    const t0=`${d.deliver} ${d.signTime?ckBefore(d.signTime):'23:40'}`;
    ckLines(d).forEach(l=>{const s=SEED_SHORT[d.id]&&SEED_SHORT[d.id][l.sku];lines[l.sku]=(s!=null?s:l.cap);snap[l.sku]=l.should;});
    const mk=(x)=>{d.ckLog.push(x);x.cum=ckTally(d).done;};
    if(d.id=='SH20260701008'){   // 演示累计：截单前李伟在 App 先扫 10 件；截单后陈志强接着扫，含 1 次重复扫、1 次扫到不是本单的标签，2 件破损补录
      const cf=(typeof dvCutoff=='function')?dvCutoff(d):{at:'06-30 18:00'};let t=addMin(cf.at,-100);
      for(let i=1;i<=10;i++){mk({at:t,by:'李伟（备货员）',src:'App',kind:'scan',sku:'SKU8807',name:'芥蓝',seq:i,res:'ok',pre:true});if(i%4==0)t=addMin(t,1);}
      t=addMin(t0,-12);
      for(let i=11;i<=18;i++){mk({at:t,by:who(),src:'App',kind:'scan',sku:'SKU8807',name:'芥蓝',seq:i,res:'ok'});if(i==14){mk({at:t,by:who(),src:'App',kind:'scan',sku:'SKU8807',name:'芥蓝',seq:14,res:'dup'});mk({at:addMin(t,1),by:who(),src:'App',kind:'scan',res:'not_in'});t=addMin(t,2);}}
      mk({at:addMin(t,3),by:who(),src:'App',kind:'adj',sku:'SKU8807',name:'芥蓝'});mk({at:addMin(t,3),by:who(),src:'App',kind:'adj',sku:'SKU8807',name:'芥蓝'});
      mk({at:addMin(t,4),by:who(),src:'App',kind:'done',short:5});
      d.check={by:who(),at:addMin(t,4),lines,snap,method:'scan',manualAdj:2};return;
    }
    ckLines(d).forEach(l=>mk({at:t0,by:who(),src:'后台',kind:'manual',sku:l.sku,name:l.name,from:0,to:lines[l.sku]}));
    const sh=ckLines(d).reduce((a,l)=>a+Math.max(0,l.should-lines[l.sku]),0);
    mk({at:t0,by:who(),src:'后台',kind:'done',short:sh});
    d.check={by:who(),at:t0,lines,snap,method:'manual',manualAdj:0};
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
    const m={off:['无需核货','t-gr'],none:['未核货','t-gr'],todo:(ckTally(d).done>0?['核货中','t-b']:['待核货','t-y']),stale:['需补核','t-r'],done:['已核货','t-g']}[s];   // 核货中 = 有已核件数但还没点完成
    return `<span class="tag ${m[1]}"><span class="dot"></span>${m[0]}</span>`;
  };
  // 某 SKU 的商家核货数量（未核为 null）
  window.ckQty=function(d,sku){ckState(d);const t=ckTally(d),l=ckLines(d).find(x=>x.sku==sku);if(t.per[sku]!=null)return l?Math.min(t.per[sku],l.cap):t.per[sku];return (d.check&&d.check.lines[sku]!=null)?d.check.lines[sku]:null;};   /* 累计已核（核货中也显示） */
  // 少送合计 = Σ(应送 − 核货)
  window.ckShortQty=function(d){if(!d.check)return 0;return ckLines(d).reduce((a,l)=>a+Math.max(0,l.should-(d.check.lines[l.sku]!=null?d.check.lines[l.sku]:l.should)),0);};
  // 实收少于核货（核了但没收到 → 按少送处理，送货单上提示）
  window.ckRecvGap=function(d){
    if(!d.check||!isDone(d))return 0;
    return ((typeof dvDetailLines=='function')?dvDetailLines(d):[]).reduce((a,l)=>{const c=d.check.lines[l.sku];return a+((c!=null&&l.recvQty!=null&&l.recvQty<c)?(c-l.recvQty):0);},0);
  };
  // 核货进度（累计口径）：{done,tot,gap,scan,manual,n}
  window.ckProg=function(d){ckState(d);return ckTally(d);};
  /* 核货方式：用到哪种显示哪种，两种都用到就两个标签都显示 */
  const mthOf=p=>[p.scan?'<span class="tag t-b"><span class="dot"></span>扫码核货</span>':'',p.manual?'<span class="tag t-gr"><span class="dot"></span>手动核货</span>':''].filter(Boolean).join(' ')||'—';
  // 列表核货列（一字段一列）：核货状态 / 核货进度 / 核货方式 / 最后核货时间 / 少送(件)
  window.ckCols=function(d){
    const s=ckState(d),c=d.check&&s!='none'?d.check:null,sh=c?ckShortQty(d):0,p=ckProg(d),pct=p.tot?Math.round(p.done/p.tot*100):0;
    const prog=(s=='none'||s=='off')?'—':`<div style="white-space:nowrap"><b>${p.done}</b> <span style="color:var(--ts)">/ ${p.tot}</span></div><div style="width:72px;height:4px;border-radius:2px;background:var(--bd2);margin-top:5px;overflow:hidden"><div style="width:${pct}%;height:100%;background:${(c&&sh)?'var(--y)':'var(--g)'}"></div></div>`;
    const last=((d.ckLog||[]).filter(x=>x.kind!='revoke').pop()||{}).at||null;   /* 最后核货时间 = 最后一条核货明细的时间 */
    return `<td style="white-space:nowrap">${ckTag(d)}</td><td>${prog}</td><td style="white-space:nowrap">${mthOf(p)}</td><td style="white-space:nowrap;color:var(--ts)">${last||'—'}</td><td style="text-align:right">${c?(sh?`<b style="color:var(--r)">${sh}</b>`:'0'):'—'}</td>`;
  };

  /* ---------- 核货抽屉 ---------- */
  let CK=null;   // 编辑中的草稿 {id, qty:{sku:n}}
  window.ck_open=function(id){
    const d=dvGet(id);if(!d)return;
    const st=ckState(d),ro=isLocked(d)||(st=='done'&&!(CK&&CK.edit==id));
    const cf=(typeof dvCutoff=='function')?dvCutoff(d):{passed:true};
    if(st=='none'||st=='off')return;
    const ls=ckLines(d).filter(l=>l.should>0);
    if(!ro){CK={id,qty:{}};const tl=ckTally(d);ls.forEach(l=>{const c=tl.per[l.sku];CK.qty[l.sku]=c!=null?Math.min(c,l.cap):l.cap; /* 已核过的行带出累计已核数，没核过的行按实际打印数预填 */});CK.init=JSON.stringify(CK.qty);}
    const q=sku=>ro?(d.check?d.check.lines[sku]:null):CK.qty[sku];
    /* 异常SKU = 应送数量 ≠ 实际打印数量；默认停在异常 Tab（没有异常则停在正常 Tab） */
    const isAb=l=>l.printed!==l.should,abN=ls.filter(isAb).length,okN=ls.length-abN;
    const tab=abN?'ab':'ok';
    const rows=ls.map((l,i)=>{const v=q(l.sku),diff=v==null?null:v-l.should,k=isAb(l)?'ab':'ok';
      return `<tr id="ckr-${i}" data-ck="${k}" style="${k!=tab?'display:none;':''}${diff<0?'background:#FDF3F2':''}">
        <td><b style="font-weight:600">${l.name}</b><div class="mono" style="font-size:11px;color:var(--ts)">${l.sku}</div></td>
        <td style="color:var(--ts)">${l.spec||'—'}</td>
        <td style="text-align:right">${l.should} <span style="color:var(--ts)">${l.unit}</span></td>
        <td style="text-align:right">${ro?`<b>${v==null?'—':v}</b>`:`<input type="number" min="0" max="${l.cap}" step="1" value="${v}" style="width:84px;text-align:right" oninput="ck_input('${l.sku}',${i},${l.should},${l.cap},this)" onfocus="this.select()">`}</td>
        <td id="ckd-${i}" style="text-align:right">${diff==null?'—':(diff<0?`<b style="color:var(--r)">${diff}</b>`:'<span style="color:var(--tt)">0</span>')}</td>
      </tr>`;}).join('');
    const stale=st=='stale'&&!ro;
    drawer(`<div class="drawer-hd"><div><h3>${ro?'本次核货':'送货核货'} · ${d.warehouse}</h3>
        <div style="margin-top:4px">${ckTag(d)} <span class="sub" style="font-size:12px"><span class="mono">${d.id}</span> · 送达 ${d.deliver} ${d.window||''} · ${ls.length} 个 SKU</span></div></div>
        <span class="x" onclick="closeDrawer()">×</span></div>
      <div class="drawer-bd">
        ${stale?`<div class="ib ib-r" style="margin-bottom:12px"><span class="i">⚠️</span><div>核货后<b>应送数量变了</b>（客户下单、取消或改单）。已核的都保留，按新的应送补齐后再点「确认核货」。</div></div>`:''}
        ${ro?(d.check?`<div class="ib ib-gr" style="margin-bottom:12px"><span class="i">✅</span><div>${d.check.by} 于 ${d.check.at} ${d.check.method=='scan'?`在 App <b>扫码核货</b>${d.check.manualAdj?`（手动补录 ${d.check.manualAdj} 件）`:''}`:'确认核货'}${ckShortQty(d)?`，少送 <b style="color:var(--r)">${ckShortQty(d)}</b> 件`:'，与应送一致'}。${isLocked(d)?'仓库已签到，不能再改。':'仓库签到前可以修改或撤回。'}</div></div>`:'')
          :(cf.passed?`<div class="ib ib-b" style="margin-bottom:12px"><span class="i">📦</span><div>已按实际打印的标签数带出，对照车上实际装的货，数量对的不用动，只改装少的。在车边核可以用商家 App 扫码。</div></div>`
            :`<div class="ib ib-y" style="margin-bottom:12px"><span class="i">🕘</span><div>还没到营业截单（${cf.at}），客户还可能改单，应送变了会提示重新核货。已按实际打印的标签数带出，只改装少的。</div></div>`)}
        <div class="tabs" style="margin-bottom:12px">${[['ab','异常SKU',abN],['ok','正常SKU',okN]].map(x=>`<div class="tab ${x[0]==tab?'active':''}" data-ckt="${x[0]}" onclick="ck_tab('${x[0]}',this)">${x[1]} <span style="font-weight:600;color:var(--ts)">${x[2]}</span></div>`).join('')}</div>
        <div id="ck-ab-hint" style="${tab=='ab'?'':'display:none;'}margin:-2px 0 12px;padding:10px 14px;background:#FDF3F2;border:1px solid #F3C9C4;border-left:4px solid var(--r);border-radius:8px;font-size:14.5px;font-weight:700;color:var(--r)">⚠️ 注：异常SKU表示应送数量和实际打印数量不符</div>
        <table><thead><tr><th>商品</th><th>规格</th><th style="text-align:right">应送数量</th><th style="text-align:right">${ro?'核货数量':'实际核货数量'}</th><th style="text-align:right">差异</th></tr></thead>
          <tbody>${rows}<tr id="ck-empty" style="${(tab=='ab'?abN:okN)?'display:none':''}"><td colspan="5" style="text-align:center;color:var(--ts);padding:28px 0">暂无</td></tr></tbody></table>
        <div id="ck-sum" style="margin-top:12px;font-size:12.5px;color:var(--ts)">${ckSumHtml(d,ls,ro)}</div>
        ${ro?'':`<div style="margin-top:14px;font-size:12px;color:var(--ts);line-height:1.7">少送的照现在的少货规则处理，罚款按仓库实际收到的数算。</div>`}
      </div>
      <div class="drawer-ft">${ro
        ?`<button class="btn btn-o" onclick="closeDrawer()">关闭</button>${(!isLocked(d)&&d.check)?`<button class="btn btn-o" style="color:var(--r)" onclick="ck_revoke('${d.id}')">撤回核货</button><button class="btn btn-p" onclick="ck_reopen('${d.id}')">修改核货</button>`:''}`
        :`<button class="btn btn-o" onclick="ck_cancel()">取消</button><button class="btn btn-p" onclick="ck_submit('${d.id}')">确认核货</button>`}</div>`);
  };
  window.ck_tab=function(k,el){
    const box=el.closest('.drawer-bd');if(!box)return;
    box.querySelectorAll('[data-ckt]').forEach(t=>t.classList.toggle('active',t.dataset.ckt==k));
    let n=0;box.querySelectorAll('tr[data-ck]').forEach(r=>{const on=r.dataset.ck==k;r.style.display=on?'':'none';if(on)n++;});
    const e=box.querySelector('#ck-empty');if(e)e.style.display=n?'none':'';
    const h=box.querySelector('#ck-ab-hint');if(h)h.style.display=k=='ab'?'':'none';
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
      const pre=(typeof dvCutoff=='function')&&!dvCutoff(d).passed;
      const tl=ckTally(d);ls.forEach(l=>{const cur=Math.min(tl.per[l.sku]||0,l.cap);if(tl.per[l.sku]==null||cur!==lines[l.sku])ckPush(d,{kind:'manual',sku:l.sku,name:l.name,from:cur,to:lines[l.sku]});});   /* 填几就是核了几个：每个改过的 SKU 记一条手动明细 */
      const sh0=ls.reduce((a,l)=>a+Math.max(0,l.should-lines[l.sku]),0);ckPush(d,{kind:'done',short:sh0});
      const p=ckTally(d);d.check={by:who(),at:nowStr(),lines,snap,method:p.scan?'scan':'manual',manualAdj:0};CK=null;
      closeModal();closeDrawer();render();
      const sh=ckShortQty(d);
      toast(sh?`${d.id} 已提交异常核货，少送 ${sh} 件，仓库可签到收货`:`${d.id} 已核货，仓库可签到收货`,'ok');
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
      <div class="mc-ft"><button class="btn btn-o" onclick="closeModal()">返回修改</button><button class="btn btn-p" onclick="_ckCommit()">提交异常核货</button></div>`);
  };
  window.ck_cancel=function(){
    if(CK&&CK.init&&JSON.stringify(CK.qty)!==CK.init){window._ckDiscard=()=>{CK=null;closeModal();closeDrawer();};
      modal(`<div class="mc-hd"><h3>放弃修改？</h3><button class="mc-x" onclick="closeModal()">×</button></div><div class="mc-bd"><div class="ib ib-y"><span class="i">⚠️</span><div>改过的数量不会保存。</div></div></div><div class="mc-ft"><button class="btn btn-o" onclick="closeModal()">继续核货</button><button class="btn btn-d" onclick="_ckDiscard()">放弃</button></div>`);return;}
    CK=null;closeDrawer();};
  window.ck_revoke=function(id){
    const d=dvGet(id);if(!d)return;
    if(isLocked(d)){toast('仓库已签到，核货记录已锁定，不能撤回','err');return;}
    window._ckRevoke=()=>{ckPush(d,{kind:'revoke'});delete d.check;closeModal();closeDrawer();render();toast(`已撤回 ${id} 的核货，重新核货前仓库无法签到收货`,'info');};
    modal(`<div class="mc-hd"><h3>撤回核货？</h3><button class="mc-x" onclick="closeModal()">×</button></div>
      <div class="mc-bd"><div class="ib ib-y"><span class="i">⚠️</span><div>撤回后变回「核货中」，已扫 / 已填的明细都保留；要再点完成核货，仓库才能签到收货。</div></div></div>
      <div class="mc-ft"><button class="btn btn-o" onclick="closeModal()">取消</button><button class="btn btn-d" onclick="_ckRevoke()">确认撤回</button></div>`);
  };
  // 已核货的单子，「重新核货」= 撤回 + 重开编辑（签到前）
  window.ck_reopen=function(id){const d=dvGet(id);if(!d||isLocked(d))return;CK={edit:id};closeDrawer();ck_open(id);};

  /* ---------- 送货单详情 · 核货记录（每扫一次 / 每填一次一条明细）---------- */
  const RES={ok:['计数','var(--g)'],dup:['已扫过 · 不计数','var(--ts)'],full:['已扫够 · 不计数','var(--ts)'],not_in:['不是本单 · 不计数','var(--r)']};
  function rowKind(x){
    if(x.kind=='scan')return ['<span class="tag t-b"><span class="dot"></span>扫码</span>',x.res=='ok'?'+1':'0',RES[x.res]];
    if(x.kind=='adj')return ['补录（标签破损）','+1',['计数','var(--g)']];
    if(x.kind=='undo')return ['撤回一张','−1',['计数','var(--g)']];
    if(x.kind=='manual')return ['手动填数',`${x.from} → ${x.to}`,['计数','var(--g)']];
    if(x.kind=='done')return [x.short?'<b style="color:var(--r)">提交异常核货</b>':'<b style="color:var(--g)">完成核货</b>','—',[x.short?`少送 ${x.short} 件`:'与应送一致',x.short?'var(--r)':'var(--g)']];
    return ['<b>撤回核货</b>','—',['明细保留，回到核货中','var(--ts)']];
  }
  window.ckHistoryCard=function(d){
    if(!ckOn())return '';const st=ckState(d),p=ckTally(d),pct=p.tot?Math.round(p.done/p.tot*100):0;
    const L=(d.ckLog||[]).map((x,i)=>({x,i})).reverse(),need=!isLocked(d)&&(st=='todo'||st=='stale');
    const nm=x=>x.name||'—';
    const prog=`<div style="padding:14px 20px;border-bottom:1px solid var(--bd2);display:flex;align-items:center;gap:18px;flex-wrap:wrap">
      <div style="font-size:13px;color:var(--ts);white-space:nowrap">核货进度</div>
      <div style="flex:1;min-width:200px;max-width:420px;height:8px;border-radius:4px;background:var(--bd2);overflow:hidden"><div style="width:${pct}%;height:100%;background:${(d.check&&ckShortQty(d))?'var(--y)':'var(--g)'}"></div></div>
      <div style="font-size:15px;white-space:nowrap"><b>${p.done}</b> <span style="color:var(--ts)">/ ${p.tot} 件</span></div>
      <div style="font-size:12.5px;color:var(--ts)">扫码 <b style="color:var(--tp)">${p.scan}</b> 件 · 手动 <b style="color:var(--tp)">${p.manual}</b> 件${st=='stale'?' · <b style="color:var(--r)">应送变了，已扫的保留，请补核后再点完成</b>':(d.check?'':(p.done?' · <b style="color:var(--b)">核货中，还没点完成</b>':''))}</div>
      ${need?`<button class="btn btn-p btn-sm" style="margin-left:auto" onclick="ck_open('${d.id}')">${st=='stale'?'补核':(p.done?'继续核货':'核货')}</button>`:''}</div>`;
    return `<div class="card" style="margin-bottom:14px"><div class="card-hd"><div style="display:flex;align-items:baseline;gap:10px"><h3>核货记录</h3><span class="sub">共 ${L.length} 条明细 · 每扫一张、每填一次数都记一条，多人多次扫的累加</span></div></div>
      ${prog}
      <div class="card-bd flush"><div style="overflow-x:auto;max-height:420px;overflow-y:auto"><table>
      <thead><tr><th>序号</th><th>时间</th><th>核货时点</th><th>操作人</th><th>来源</th><th>动作</th><th>商品</th><th style="text-align:right">标签序号</th><th style="text-align:right">数量</th><th>结果</th><th style="text-align:right">累计已核</th></tr></thead><tbody>
      ${L.map(({x,i})=>{const k=rowKind(x);return `<tr>
        <td>${i+1}</td><td style="white-space:nowrap">${x.at}</td>
        <td>${x.pre?'<span class="tag t-y"><span class="dot"></span>截单前</span>':'<span style="color:var(--ts)">截单后</span>'}</td>
        <td>${x.by}</td><td>${x.src}</td><td style="white-space:nowrap">${k[0]}</td><td>${nm(x)}</td>
        <td style="text-align:right">${x.seq!=null?x.seq:'—'}</td><td style="text-align:right">${k[1]}</td>
        <td style="white-space:nowrap;color:${k[2][1]}">${k[2][0]}</td>
        <td style="text-align:right">${x.cum!=null?x.cum:'—'} <span style="color:var(--ts)">/ ${p.tot}</span></td></tr>`;}).join('')||`<tr><td colspan="11" style="text-align:center;color:var(--ts);padding:18px">还没有核货明细</td></tr>`}
      </tbody></table></div></div></div>`;
  };

  /* 商品明细「明细」：该 SKU 的每一条核货明细（右侧抽屉），带该商品累计 */
  window.ck_skuLog=function(id,sku){
    const d=dvGet(id);if(!d)return;const l=ckLines(d).find(x=>x.sku==sku)||{name:sku,should:0};
    let cum=0,sc=0;const rows=[];
    (d.ckLog||[]).forEach(x=>{if(x.sku!=sku)return;
      if(x.kind=='scan'&&x.res=='ok'){cum++;sc++;}else if(x.kind=='adj')cum++;else if(x.kind=='undo'){cum=Math.max(0,cum-1);if(x.undoScan)sc=Math.max(0,sc-1);}else if(x.kind=='manual'){cum=x.to;sc=Math.min(sc,x.to);}
      rows.push({x,cum});});
    const done=Math.min(cum,l.cap!=null?l.cap:cum),scan=Math.min(sc,done);
    drawer(`<div class="drawer-hd"><div><h3>核货明细 · ${l.name}</h3><div class="sub" style="margin-top:4px;font-size:12px"><span class="mono">${sku}</span> · <span class="mono">${d.id}</span></div></div><span class="x" onclick="closeDrawer()">×</span></div>
      <div class="drawer-bd">
        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:14px 24px;margin-bottom:16px">
          ${[['应送数量',l.should],['已核数量',`<b style="color:${done<l.should?'var(--r)':'var(--tp)'}">${done}</b>`],['扫码',scan],['手动',done-scan]].map(k=>`<div><div style="font-size:12px;color:var(--ts);margin-bottom:3px">${k[0]}</div><div style="font-size:15px">${k[1]}</div></div>`).join('')}
        </div>
        <table><thead><tr><th>时间</th><th>核货时点</th><th>操作人</th><th>来源</th><th>动作</th><th style="text-align:right">标签序号</th><th style="text-align:right">数量</th><th>结果</th><th style="text-align:right">累计已核</th></tr></thead><tbody>
        ${rows.reverse().map(({x,cum})=>{const k=rowKind(x);return `<tr><td style="white-space:nowrap">${x.at}</td><td>${x.pre?'<span class="tag t-y"><span class="dot"></span>截单前</span>':'<span style="color:var(--ts)">截单后</span>'}</td><td>${x.by}</td><td>${x.src}</td><td style="white-space:nowrap">${k[0]}</td><td style="text-align:right">${x.seq!=null?x.seq:'—'}</td><td style="text-align:right">${k[1]}</td><td style="white-space:nowrap;color:${k[2][1]}">${k[2][0]}</td><td style="text-align:right">${cum} <span style="color:var(--ts)">/ ${l.should}</span></td></tr>`;}).join('')||'<tr><td colspan="9" style="text-align:center;color:var(--ts);padding:24px">该商品还没有核货明细</td></tr>'}
        </tbody></table>
      </div>
      <div class="drawer-ft"><button class="btn btn-o" onclick="closeDrawer()">关闭</button></div>`);
  };

  // 页头「待核货 N」= 列表里所有显示待核货 / 需重核的未签到单（含截单前）；菜单 / 金刚区角标只算已截单（ckPendingCount）
  window.ckTodoAll=function(){if(!ckOn())return 0;return (DB.deliveries||[]).filter(d=>!isLocked(d)&&ckBlocked(d)).length;};

  /* ---------- 签到拦截：仓库扫码签到前校验核货（演示仓库端扫码）---------- */
  const _doSign=window.deliv_doSign;
  window.deliv_doSign=function(id){
    const d=dvGet(id);if(!d)return;
    if(ckBlocked(d)){
      const st=ckState(d);
      modal(`<div class="mc-hd"><h3>仓库扫码结果 · 签到被拦截</h3><p>${d.id} · ${d.warehouse}</p><button class="mc-x" onclick="closeModal()">×</button></div>
        <div class="mc-bd"><div class="ib ib-r"><span class="i">⛔</span><div><b>${st=='stale'?'应送数量变了，商家要补核':(ckTally(d).done?'商家还没核完（核货中）':'商家还没核货')}</b>，仓库暂不能签到收货。<br>请打开 App「送货签到」或后台「送货管理」核货，核完仓库再扫码。</div></div></div>
        <div class="mc-ft"><button class="btn btn-o" onclick="closeModal()">关闭</button><button class="btn btn-p" onclick="closeModal();ck_open('${d.id}')">去核货</button></div>`);
      return;
    }
    _doSign(id);
  };
})();
