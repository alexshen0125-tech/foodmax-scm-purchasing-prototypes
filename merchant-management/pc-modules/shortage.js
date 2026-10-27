/* PC · 商家报缺（打印标签页「报缺货」+ 运营平台「商家报缺」待办）
   场景：商家提前知道某 SKU 缺货（供应商断货/品质不合格…），在「打印标签」按 仓库×SKU 报缺，
        系统把缺货件数分到具体订单，通知客服联系客户处理。

   ── 口径（沈亮 2026-10-27 拍板）────────────────────────────────
   - 粒度：配送日 × 入库仓库 × SKU，与打印标签行一致；只报件数。
   - 分摊：同一 配送日×仓×SKU 的待发货订单按【下单时间从晚到早】依次扣，扣满一单再扣下一单（BR-02）。
   - 时点：截单前、截单后都能报，送货签到前截止。
       · 截单前报 → 该 SKU【立即停售】（可售库存清零、不再接新单），分摊结果立即定稿并推送；
         商家可手动「恢复售卖」，恢复后新进的订单不参与本次分摊。
       · 截单后报 → 订单已固定，直接分摊推送。
   - 报缺【不影响打印标签数据】：应送货/已打印/未打印照旧，只在行上标「已报缺 N」（2026-10-27 用户改）。
   - 商家端【不展示订单】：分摊到哪些订单只给客服看（运营平台待办 + 飞书群），商家弹窗/记录不出现订单。
   - 客服：系统不自动改单。通知 = 小蜜蜂推飞书群 + 运营平台「商家报缺」待办；
           客服联系客户后在客诉链路处理（部分退款 / 补自营商品 / 客户接受少送），回到待办登记结果。
   - 罚款：主动报缺【照罚不减免】（商家报缺页不展示罚款提示，2026-10-27）。
   - 缺货原因：枚举 供应商断货/到货不足/品质不合格/其他，必选，默认「供应商断货」。
   - 撤销：受影响订单全部「待处理」时商家可撤销，同步推撤销通知；客服处理过任一单即不可撤销。
   依赖主文件全局：DB / toast / modal / closeModal / drawer / closeDrawer / render / nav / askConfirm / ord_mask / money / replFineRate。 */
(function(){

  /* ================= 演示数据 ================= */
  // 补两笔裕廊DC 小棠菜订单，便于演示「下单晚的先扣」（与 #SG20260630001 海底捞 20 件同 仓×SKU）
  if(!DB.orders.find(o=>o.id=='#SG20260630011')){
    DB.orders.push(
      {id:'#SG20260630011',client:'丰盛轩',contact:'黄先生',phone:'+65 9001 7788',addr:'Bedok North Ave 1 #01-15',orderTime:'06-30 14:36',deliver:'07-01',deliverWindow:'06:00~10:00',warehouse:'裕廊DC',amt:55.80,discount:0,lines:[{sku:'SKU8801',name:'小棠菜',qty:6,unit:'件',spec:'1kg/件',price:9.30}],status:'pending',labels:[],pickId:'',deliveryId:'',note:''},
      {id:'#SG20260630012',client:'新味坊',contact:'吴敏',phone:'+65 8123 9920',addr:'Toa Payoh Lor 4 #01-03',orderTime:'06-30 16:52',deliver:'07-01',deliverWindow:'06:00~10:00',warehouse:'裕廊DC',amt:37.20,discount:0,lines:[{sku:'SKU8801',name:'小棠菜',qty:4,unit:'件',spec:'1kg/件',price:9.30}],status:'pending',labels:[],pickId:'',deliveryId:'',note:''}
    );
  }
  DB.shortReports=DB.shortReports||[];
  DB.shortSeq=DB.shortSeq||0;
  if(DB.labelCutoff===undefined)DB.labelCutoff=false;     // 演示：当前是否已截单（打印标签页「未截单/已截单」标签可点切换）
  const FS_GROUP='三方商家缺货处理群';                       // 飞书客服群名（待确认）
  const WAYS=['部分退款','补自营商品','客户接受少送'];
  const REASONS=['供应商断货','到货不足','品质不合格','其他'];   // 缺货原因枚举，默认第一项
  const nowStr=()=>{const d=new Date();const p=n=>String(n).padStart(2,'0');return `${p(d.getMonth()+1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;};

  /* ================= 核心计算 ================= */
  const active=r=>r.status!='revoked';
  // 某订单某 SKU 已被报缺扣掉的件数（打印标签应送货据此扣减）
  window.shortLineOf=function(orderId,sku){let n=0;DB.shortReports.filter(active).forEach(r=>r.allocs.forEach(a=>{if(a.orderId==orderId&&r.sku==sku)n+=a.short;}));return n;};
  window.shortOfKey=function(date,wh,sku){return DB.shortReports.filter(r=>active(r)&&r.date==date&&r.wh==wh&&r.sku==sku).reduce((s,r)=>s+r.qty,0);};
  window.shortStopped=function(date,wh,sku){return DB.shortReports.some(r=>active(r)&&r.date==date&&r.wh==wh&&r.sku==sku&&r.stopSale);};
  // 候选订单：待发货（含已贴标），同 配送日×仓×SKU；可扣量 = 订购 − 已报缺
  function candOrders(date,wh,sku){
    const out=[];
    DB.orders.filter(o=>(o.status=='pending'||o.status=='packed')&&o.deliver==date&&o.warehouse==wh).forEach(o=>{
      (o.lines||[]).forEach(l=>{if(l.sku!=sku)return;const left=l.qty-shortLineOf(o.id,sku);if(left>0)out.push({orderId:o.id,client:o.client,orderTime:o.orderTime||'',ordered:l.qty,left,unit:l.unit});});
    });
    // BR-02：下单时间从晚到早；同一分钟按订单号倒序
    return out.sort((a,b)=>b.orderTime.localeCompare(a.orderTime)||b.orderId.localeCompare(a.orderId));
  }
  function allocate(date,wh,sku,qty){let rest=qty;const res=[];
    candOrders(date,wh,sku).forEach(c=>{if(rest<=0)return;const s=Math.min(rest,c.left);rest-=s;res.push({...c,short:s});});
    return res;}
  function lineInfo(date,wh,sku){let ordered=0,name='',unit='件',spec='';
    DB.orders.filter(o=>(o.status=='pending'||o.status=='packed')&&o.deliver==date&&o.warehouse==wh).forEach(o=>(o.lines||[]).forEach(l=>{if(l.sku==sku){ordered+=l.qty;name=l.name;unit=l.unit;spec=l.spec||'';}}));
    return {ordered,name,unit,spec,reported:shortOfKey(date,wh,sku)};}
  function repStatus(r){if(r.status=='revoked')return 'revoked';const d=r.allocs.filter(a=>a.cs=='done').length;return d==0?'pending':(d==r.allocs.length?'done':'doing');}
  const ST={pending:['t-y','待处理'],doing:['t-b','处理中'],done:['t-g','已处理'],revoked:['t-gr','已撤销']};
  const stTag=k=>`<span class="tag ${ST[k][0]}"><span class="dot"></span>${ST[k][1]}</span>`;

  /* ================= 商家端 · 报缺弹窗（打印标签行「报缺货」） ================= */
  window.short_open=function(key){
    const f=DB.labelF||{};const date=f.date;const [wh,sku]=String(key).split('|');
    const li=lineInfo(date,wh,sku);const cap=li.ordered-li.reported;
    if(cap<=0){toast('该商品订单量已全部报缺','info');return;}
    const printed=((DB.labelPrinted||{})[key])||0;
    DB.shortDraft={key,date,wh,sku,qty:Math.min(1,cap),cap,printed,li,rmk:REASONS[0]};
    modal(`<div class="mc-hd"><h3>报缺货 · ${li.name}</h3><p>${li.spec||li.unit}（${sku}） · ${wh} · 配送日 ${date}</p><button class="mc-x" onclick="closeModal()">×</button></div>
      <div class="mc-bd" id="sh-bd">${draftBody()}</div>
      <div class="mc-ft"><button class="btn btn-o" onclick="closeModal()">取消</button><button class="btn btn-d" onclick="short_submit()">确认报缺</button></div>`);
  };
  function draftBody(){
    const d=DB.shortDraft,li=d.li;
    const fine=d.qty*replFineRate();
    return `<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:14px">
        <div class="sc"><div class="sc-l">订单量</div><div class="sc-v">${li.ordered}</div></div>
        <div class="sc"><div class="sc-l">已报缺</div><div class="sc-v">${li.reported}</div></div>
        <div class="sc"><div class="sc-l">还可报缺</div><div class="sc-v">${d.cap}</div></div>
      </div>
      <div class="fr"><label class="fl"><b>*</b>缺货数量（${li.unit}）</label>
        <div class="row" style="gap:8px;align-items:center">
          <button class="btn btn-o btn-sm" onclick="short_step(-1)" ${d.qty<=1?'disabled':''}>−</button>
          <input id="sh-qty" type="number" min="1" max="${d.cap}" value="${d.qty}" style="width:90px;text-align:center" oninput="short_setQty(this.value)">
          <button class="btn btn-o btn-sm" onclick="short_step(1)" ${d.qty>=d.cap?'disabled':''}>+</button>
          <button class="btn btn-link btn-sm" onclick="short_setQty(${d.cap},1)">全部缺货（${d.cap}）</button>
        </div></div>
      <div class="ib ib-b" style="margin-top:12px"><span class="i">📣</span><div>提交后平台客服会联系受影响的客户处理。打印标签数量不变，按实际能送的货贴标送货即可。</div></div>
      ${DB.labelCutoff?'':`<div class="ib ib-y" style="margin-top:12px"><span class="i">⏸️</span><div>当前<b>未截单</b>：提交后该商品<b>立即停售</b>，不再接新单。货到了可在「报缺记录」里恢复售卖。</div></div>`}
      <div class="fr" style="margin-top:12px"><label class="fl"><b>*</b>缺货原因</label><div class="row" style="gap:8px;flex-wrap:wrap">${REASONS.map(x=>`<button class="btn btn-sm ${d.rmk==x?'btn-p':'btn-o'}" onclick="DB.shortDraft.rmk='${x}';short_redraw()">${x}</button>`).join('')}</div></div>`;
  }
  window.short_redraw=function(){redraw();};
  function redraw(){const el=document.getElementById('sh-bd');if(el)el.innerHTML=draftBody();}
  window.short_step=function(n){const d=DB.shortDraft;d.qty=Math.max(1,Math.min(d.cap,d.qty+n));redraw();};
  window.short_setQty=function(v,force){const d=DB.shortDraft;let n=parseInt(v,10);if(isNaN(n))return;
    if(n>d.cap){n=d.cap;toast(`最多可报 ${d.cap}（订单量 − 已报缺）`,'info');}if(n<1)n=1;
    if(n!=d.qty||force){d.qty=n;redraw();const el=document.getElementById('sh-qty');if(el){el.focus();el.setSelectionRange&&el.select();}}};
  window.short_submit=function(){
    const d=DB.shortDraft;const al=allocate(d.date,d.wh,d.sku,d.qty);if(!al.length){toast('没有可分摊的订单','err');return;}
    const id='BQ'+d.date.replace('-','')+String(++DB.shortSeq).padStart(3,'0');
    const r={id,date:d.date,wh:d.wh,sku:d.sku,name:d.li.name,unit:d.li.unit,spec:d.li.spec,qty:d.qty,rmk:d.rmk,
      time:nowStr(),phase:DB.labelCutoff?'after':'before',stopSale:!DB.labelCutoff,restoredAt:'',fine:d.qty*replFineRate(),
      allocs:al.map(a=>({orderId:a.orderId,client:a.client,orderTime:a.orderTime,ordered:a.ordered,short:a.short,cs:'pending',way:'',note:'',csAt:''})),
      status:'active',push:[{type:'报缺',at:nowStr()}]};
    DB.shortReports.unshift(r);DB.shortDraft=null;closeModal();render();
    toast(`已报缺 ${d.qty}${d.li.unit}，已通知客服处理${r.stopSale?'；该商品已停售':''}`,'ok');
  };

  /* ================= 商家端 · 报缺记录抽屉 ================= */
  window.short_records=function(){
    const date=(DB.labelF||{}).date;const list=DB.shortReports.filter(r=>r.date==date);
    drawer(`<div class="drawer-hd"><div><h3>报缺记录</h3><div style="font-size:12.5px;color:var(--ts);margin-top:2px">配送日 ${date||'—'} · 共 ${list.length} 条</div></div><span class="x" onclick="closeDrawer()">×</span></div>
    <div class="drawer-bd">${list.length?`<div style="overflow-x:auto"><table>
      <thead><tr><th>报缺单号</th><th>仓库</th><th>商品名称</th><th>SKU编码</th><th style="text-align:right">缺货数量</th><th>报缺时间</th><th>售卖状态</th><th>客服处理</th><th>操作</th></tr></thead><tbody>
      ${list.map(r=>{const st=repStatus(r);return `<tr>
        <td class="mono">${r.id}</td><td>${r.wh}</td><td><b>${r.name}</b></td><td class="mono">${r.sku}</td>
        <td style="text-align:right">${r.qty}</td><td>${r.time}</td>
        <td>${r.status=='revoked'?'—':(r.stopSale?'<span class="tag t-r"><span class="dot"></span>已停售</span>':(r.phase=='before'?'<span class="tag t-g"><span class="dot"></span>已恢复</span>':'<span style="color:var(--ts)">截单后报缺</span>'))}</td>
        <td>${stTag(st)}</td>
        <td style="white-space:nowrap"><button class="btn btn-link btn-sm" onclick="short_detail('${r.id}',0)">详情</button>${r.stopSale&&r.status!='revoked'?`<button class="btn btn-link btn-sm" onclick="short_restore('${r.id}')">恢复售卖</button>`:''}${st=='pending'?`<button class="btn btn-link btn-sm" style="color:var(--r)" onclick="short_revoke('${r.id}')">撤销</button>`:''}</td>
      </tr>`;}).join('')}</tbody></table></div>`:`<div class="empty"><div class="e-ic">📭</div><div class="e-t">该配送日暂无报缺</div><div class="e-s">在打印标签列表点「报缺货」即可上报。</div></div>`}</div>
    <div class="drawer-ft"><button class="btn btn-o" onclick="closeDrawer()">关闭</button></div>`);
  };
  window.short_restore=function(id){const r=DB.shortReports.find(x=>x.id==id);if(!r)return;
    askConfirm(`恢复「${r.name}」售卖？恢复后新进的订单<b>不参与本次报缺分摊</b>，按正常订单备货送货。`,()=>{r.stopSale=false;r.restoredAt=nowStr();render();short_records();toast(`「${r.name}」已恢复售卖`,'ok');});};
  window.short_revoke=function(id){const r=DB.shortReports.find(x=>x.id==id);if(!r)return;
    if(repStatus(r)!='pending'){toast('客服已开始处理，不能撤销','err');return;}
    askConfirm(`撤销报缺 ${r.id}？${r.qty}${r.unit}「${r.name}」恢复为应送，${r.stopSale?'商品同时恢复售卖，':''}将向客服推送撤销通知，不再计缺货罚款。`,()=>{r.status='revoked';r.stopSale=false;r.push.push({type:'撤销',at:nowStr()});render();short_records();toast(`已撤销 ${r.id}，已通知客服`,'ok');});};

  /* ================= 共用 · 报缺详情抽屉（商家只读 / 运营可处理） ================= */
  function fsCard(r,type){const st=r.allocs;return `<div style="border:1px solid var(--bd);border-radius:10px;overflow:hidden;max-width:460px">
      <div style="background:${type=='撤销'?'#6B7280':'#C0453B'};color:#fff;padding:9px 14px;font-weight:600;font-size:13.5px">${type=='撤销'?'↩️ 商家撤销报缺':'⚠️ 商家报缺 · 请联系客户处理'}</div>
      <div style="padding:10px 14px;font-size:12.5px;line-height:1.8">
        <div><b>商家：</b>${DB.merchant.name}（${DB.merchant.code}）</div>
        <div><b>商品：</b>${r.name} ${r.spec||''}（${r.sku}）</div>
        <div><b>配送日 / 仓库：</b>${r.date} · ${r.wh}</div>
        <div><b>缺货：</b><span style="color:var(--r);font-weight:600">${r.qty}${r.unit}</span> · ${r.phase=='before'?'截单前报缺（已停售）':'截单后报缺'}${r.rmk?` · ${r.rmk}`:''}</div>
        <div style="margin-top:4px"><b>受影响订单（下单晚的先扣）：</b></div>
        ${st.map(a=>`<div class="mono" style="font-size:12px">${a.orderId} · ${a.client} · 下单 ${a.orderTime} · 订 ${a.ordered} 缺 ${a.short}</div>`).join('')}
      </div>
      <div style="border-top:1px solid var(--bd2);padding:8px 14px;font-size:12.5px;color:var(--b)">去运营平台处理 →</div></div>`;}
  window.short_detail=function(id,ops){const r=DB.shortReports.find(x=>x.id==id);if(!r)return;const st=repStatus(r);
    const kv=(k,v)=>`<div><div style="font-size:12px;color:var(--ts);margin-bottom:4px">${k}</div><div style="font-size:13.5px">${v||'—'}</div></div>`;
    drawer(`<div class="drawer-hd"><div><h3>${r.id} · 报缺详情</h3><div style="font-size:12.5px;color:var(--ts);margin-top:2px">${r.name} · ${r.wh} · 配送日 ${r.date}</div></div><span class="x" onclick="closeDrawer()">×</span></div>
    <div class="drawer-bd">
      <h4 style="font-size:14px;margin-bottom:12px">基础信息</h4>
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:14px 18px;margin-bottom:22px">
        ${kv('商家名称',DB.merchant.name)}${kv('商家编码',`<span class="mono">${DB.merchant.code}</span>`)}${kv('商品名称',r.name)}${kv('SKU编码',`<span class="mono">${r.sku}</span>`)}
        ${kv('配送日期',r.date)}${kv('入库仓库',r.wh)}${kv('缺货数量',`${r.qty}${r.unit}`)}${kv('报缺时间',r.time)}
        ${kv('报缺时点',r.phase=='before'?'截单前':'截单后')}${kv('售卖状态',r.status=='revoked'?'—':(r.stopSale?'已停售':(r.phase=='before'?`已恢复（${r.restoredAt}）`:'—')))}${kv('缺货原因',r.rmk)}${ops?kv('缺货罚款',money(r.fine)):''}
        ${kv('处理状态',stTag(st))}
      </div>
      ${ops?`<h4 style="font-size:14px;margin-bottom:12px">受影响订单</h4>
      <div style="overflow-x:auto;margin-bottom:22px"><table>
        <thead><tr><th>订单号</th><th>客户</th><th>下单时间</th><th style="text-align:right">订购数量</th><th style="text-align:right">缺货数量</th><th>处理状态</th><th>处理方式</th><th>处理备注</th><th>处理时间</th>${ops&&r.status!='revoked'?'<th>操作</th>':''}</tr></thead><tbody>
        ${r.allocs.map((a,i)=>`<tr><td class="mono">${a.orderId}</td><td>${a.client}</td><td>${a.orderTime}</td><td style="text-align:right">${a.ordered}</td><td style="text-align:right;color:var(--r);font-weight:600">${a.short}</td>
          <td>${r.status=='revoked'?stTag('revoked'):stTag(a.cs=='done'?'done':'pending')}</td><td>${a.way||'—'}</td><td>${a.note||'—'}</td><td>${a.csAt||'—'}</td>
          ${ops&&r.status!='revoked'?`<td>${a.cs=='done'?'<span style="color:var(--ts)">—</span>':`<button class="btn btn-link btn-sm" onclick="short_handle('${r.id}',${i})">登记处理</button>`}</td>`:''}</tr>`).join('')}
      </tbody></table></div>`:''}
      ${ops?`<h4 style="font-size:14px;margin-bottom:12px">飞书群通知 · ${FS_GROUP}</h4>
      <div style="display:flex;flex-direction:column;gap:12px">${r.push.map(p=>`<div><div style="font-size:12px;color:var(--ts);margin-bottom:6px">小蜜蜂 · ${p.at}</div>${fsCard(r,p.type)}</div>`).join('')}</div>`:''}
    </div>
    <div class="drawer-ft"><button class="btn btn-o" onclick="closeDrawer()">关闭</button></div>`);
  };

  /* ================= 运营平台 · 客服登记处理 ================= */
  window.short_handle=function(id,i){const r=DB.shortReports.find(x=>x.id==id);const a=r&&r.allocs[i];if(!a)return;
    modal(`<div class="mc-hd"><h3>登记处理结果</h3><p>${a.orderId} · ${a.client} · ${r.name} 缺 ${a.short}${r.unit}</p><button class="mc-x" onclick="closeModal()">×</button></div>
    <div class="mc-bd">
      <div class="fr"><label class="fl"><b>*</b>处理方式</label><div class="row" style="gap:16px;flex-wrap:wrap">${WAYS.map((w,k)=>`<label style="display:flex;gap:6px;align-items:center;cursor:pointer"><input type="radio" name="sh-way" value="${w}" ${k==0?'checked':''}>${w}</label>`).join('')}</div></div>
      <div class="fr"><label class="fl">处理备注</label><input id="sh-note" maxlength="200" placeholder="选填，如：已退款 S$55.80 / 客诉单号"></div>
      <div class="ib ib-b"><span class="i">ℹ️</span>退款、补自营请在客诉工单中完成，这里只登记结果。</div>
    </div>
    <div class="mc-ft"><button class="btn btn-o" onclick="closeModal()">取消</button><button class="btn btn-p" onclick="short_doHandle('${id}',${i})">确认</button></div>`);};
  window.short_doHandle=function(id,i){const r=DB.shortReports.find(x=>x.id==id);const a=r.allocs[i];
    const w=(document.querySelector('input[name="sh-way"]:checked')||{}).value;if(!w){toast('请选择处理方式','err');return;}
    a.cs='done';a.way=w;a.note=((document.getElementById('sh-note')||{}).value||'').trim();a.csAt=nowStr();
    closeModal();render();{const dc=document.getElementById('drawerc');if(dc&&dc.classList.contains('open'))short_detail(id,1);};toast(`已登记：${a.orderId} ${w}`,'ok');};

  /* ================= 运营平台 · 商家报缺（待办列表，一行 = 一个受影响订单） ================= */
  window.shortPendingCount=function(){let n=0;DB.shortReports.filter(active).forEach(r=>r.allocs.forEach(a=>{if(a.cs!='done')n++;}));return n;};
  PAGES['p-shortage']=()=>{
    DB.shOpsTab=DB.shOpsTab||'pending';DB.shOpsF=DB.shOpsF||{};const f=DB.shOpsF;const t=DB.shOpsTab;
    const rows=[];DB.shortReports.forEach(r=>r.allocs.forEach((a,i)=>{const s=r.status=='revoked'?'revoked':(a.cs=='done'?'done':'pending');rows.push({r,a,i,s});}));
    const cnt=k=>rows.filter(x=>k=='all'||x.s==k).length;
    const list=rows.filter(x=>(t=='all'||x.s==t)&&(!f.date||x.r.date==f.date)&&(!f.kw||(x.r.name+x.r.sku+x.a.orderId+x.r.id).includes(f.kw)));
    const dates=[...new Set(DB.shortReports.map(r=>r.date))];
    return `<div class="card" style="margin-bottom:14px"><div class="card-bd">
      <div style="display:flex;gap:16px;align-items:flex-end;flex-wrap:wrap">
        <div><div style="font-size:12px;color:var(--ts);margin-bottom:5px">配送日期</div><select onchange="DB.shOpsF.date=this.value;render()" style="min-width:130px"><option value="">全部</option>${dates.map(d=>`<option ${f.date==d?'selected':''}>${d}</option>`).join('')}</select></div>
        <div><div style="font-size:12px;color:var(--ts);margin-bottom:5px">商品 / 订单号 / 报缺单号</div><input id="sh-kw" value="${f.kw||''}" placeholder="请输入" style="min-width:200px" onkeydown="if(event.key=='Enter'){DB.shOpsF.kw=this.value.trim();render()}"></div>
        <button class="btn btn-p btn-sm" onclick="DB.shOpsF.kw=(document.getElementById('sh-kw')||{}).value.trim();render()">查询</button>
        <button class="btn btn-o btn-sm" onclick="DB.shOpsF={};render()">重置</button>
      </div></div></div>
    <div class="card"><div class="card-hd" style="padding-bottom:0"><div class="tabs" style="margin:0;border:none">
      ${[['pending','待处理'],['done','已处理'],['revoked','已撤销'],['all','全部']].map(([k,n])=>`<div class="tab ${t==k?'active':''}" onclick="DB.shOpsTab='${k}';render()">${n}（${cnt(k)}）</div>`).join('')}
    </div></div>
    <div class="card-bd flush"><div style="overflow-x:auto"><table>
      <thead><tr><th>报缺单号</th><th>商家名称</th><th>配送日期</th><th>仓库</th><th>商品名称</th><th>SKU编码</th><th>订单号</th><th>客户</th><th>下单时间</th><th style="text-align:right">订购数量</th><th style="text-align:right">缺货数量</th><th>报缺时间</th><th>处理状态</th><th>处理方式</th><th>操作</th></tr></thead><tbody>
      ${list.map(x=>`<tr><td class="mono">${x.r.id}</td><td>${DB.merchant.name}</td><td>${x.r.date}</td><td>${x.r.wh}</td><td><b>${x.r.name}</b></td><td class="mono">${x.r.sku}</td>
        <td class="mono">${x.a.orderId}</td><td>${x.a.client}</td><td>${x.a.orderTime}</td><td style="text-align:right">${x.a.ordered}</td><td style="text-align:right;color:var(--r);font-weight:600">${x.a.short}</td><td>${x.r.time}</td>
        <td>${stTag(x.s)}</td><td>${x.a.way||'—'}</td>
        <td style="white-space:nowrap">${x.s=='pending'?`<button class="btn btn-link btn-sm" onclick="short_handle('${x.r.id}',${x.i})">登记处理</button>`:''}<button class="btn btn-link btn-sm" onclick="short_detail('${x.r.id}',1)">详情</button></td></tr>`).join('')
      ||`<tr><td colspan="15"><div class="empty"><div class="e-ic">📭</div><div class="e-t">${rows.length?'该条件下暂无记录':'暂无商家报缺'}</div><div class="e-s">${rows.length?'切换状态或重置筛选试试。':'商家在「打印标签」报缺后，受影响订单会出现在这里，同时推送飞书群。'}</div></div></td></tr>`}
    </tbody></table></div></div></div>`;
  };
})();
