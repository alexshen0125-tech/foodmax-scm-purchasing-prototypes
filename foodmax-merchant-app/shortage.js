/* Food Max 商家端 v2 · 商家报缺（打印标签 › SKU 详情「报缺货」）
   与 PC pc-modules/shortage.js 同口径（沈亮 2026-10-27）：
   - 粒度 配送日 × 仓 × SKU；按【下单时间从晚到早】扣到订单（BR-02）
   - 报缺时看 SKU 当前售卖状态：售卖中 → 提交即自动下架（可在报缺记录重新上架，上架后新单不参与分摊）；售罄/已下架 → 不处理
   - 报缺【不影响打印标签数据】，商家端【不展示订单】（2026-10-27 用户改）：分摊结果只给客服看
   - 通知客服：小蜜蜂推飞书群 + 运营平台「商家报缺」待办；系统不自动改单
   - 报缺不产生罚款（2026-10-27 定）
   - 撤销：客服未处理任何一单前可撤销
   前缀 bq-。数据挂 window.FM.DB.shortReports。 */
(function(){
const FM=window.FM,D=FM.DB;
const REASONS=['库存维护不准','缺货','到货不足','品质不合格'];   // 缺货原因枚举，默认第一项（与 PC 同）

/* 演示数据：订单补下单时间 + 两笔裕廊DC 小棠菜，便于演示「下单晚的先扣」 */
(D.orders||[]).forEach(o=>{if(!o.orderTime)o.orderTime=({'#SG20260701001':'06-30 09:12','#SG20260701002':'06-30 10:40','#SG20260701005':'06-30 11:20'})[o.id]||'06-30 08:00';});
if(!D.orders.find(o=>o.id=='#SG20260701021')){
  D.orders.push(
    {id:'#SG20260701021',client:'丰盛轩',orderDate:'2026-06-30',orderTime:'06-30 14:36',deliver:'07-01',window:'06:00~10:00',warehouse:'裕廊DC',amt:55.80,discount:0,lines:[{sku:'SKU8801',name:'小棠菜',qty:6,unit:'件',spec:'1kg/件',price:9.30}],status:'pending',labels:[],pickId:'',deliveryId:''},
    {id:'#SG20260701022',client:'新味坊',orderDate:'2026-06-30',orderTime:'06-30 16:52',deliver:'07-01',window:'06:00~10:00',warehouse:'裕廊DC',amt:37.20,discount:0,lines:[{sku:'SKU8801',name:'小棠菜',qty:4,unit:'件',spec:'1kg/件',price:9.30}],status:'pending',labels:[],pickId:'',deliveryId:''});
}
D.shortReports=D.shortReports||[];D.shortSeq=D.shortSeq||0;
if(D.labelCutoff===undefined)D.labelCutoff=false;
D.skuSale=D.skuSale||{SKU8826:'售罄',SKU8825:'已下架'};   // SKU 当前售卖状态（演示，与 PC 同）
const saleOf=sku=>D.skuSale[sku]||'售卖中';
const SALE_CLS={'售卖中':'g','售罄':'y','已下架':'gr'};

const css=document.createElement('style');
css.textContent=`
.bq-card{margin:12px 16px 0;background:#fff;border-radius:16px;padding:14px 15px;box-shadow:var(--sh-sm);}
.bq-h{font-size:13px;font-weight:700;color:var(--ink);margin-bottom:10px;}
.bq-sum{display:flex;gap:8px;}
.bq-sum .k{flex:1;background:var(--muted);border-radius:12px;padding:10px 0;text-align:center;}
.bq-sum .v{font-size:20px;font-weight:800;color:var(--ink);}
.bq-sum .v.r{color:#C0453B;}
.bq-sum .l{font-size:11.5px;color:var(--sub);margin-top:2px;}
.bq-step{display:flex;align-items:center;justify-content:center;gap:14px;margin:4px 0 10px;}
.bq-step .b{width:48px;height:48px;border-radius:14px;background:var(--muted);font-size:24px;font-weight:700;display:flex;align-items:center;justify-content:center;color:var(--ink);cursor:pointer;user-select:none;}
.bq-step .b.off{opacity:.35;pointer-events:none;}
.bq-step input{width:96px;height:48px;border:1.5px solid var(--emerald);border-radius:14px;text-align:center;font-size:22px;font-weight:800;font-family:inherit;color:var(--ink);}
.bq-all{text-align:center;font-size:13px;font-weight:700;color:var(--emerald-2);padding:6px 0;cursor:pointer;}
.bq-ord{display:flex;align-items:center;padding:10px 0;border-top:1px solid var(--line);font-size:13px;}
.bq-ord:first-of-type{border-top:none;}
.bq-ord .l{flex:1;min-width:0;}
.bq-ord .no{font-family:ui-monospace,Menlo,monospace;font-size:12px;color:var(--ink);}
.bq-ord .s{font-size:11.5px;color:var(--sub);margin-top:2px;}
.bq-ord .q{font-size:15px;font-weight:800;color:#C0453B;}
.bq-tip{margin:12px 16px 0;border-radius:14px;padding:11px 13px;font-size:12.5px;line-height:1.6;}
.bq-tip.y{background:#FBF3E2;color:#7A5418;}
.bq-tip.r{background:#FBEAE8;color:#8E2F27;}
.bq-tip.g{background:var(--muted);color:#46604F;}
.bq-in{width:100%;height:42px;border:1px solid var(--line);border-radius:10px;padding:0 12px;font-size:14px;font-family:inherit;box-sizing:border-box;}
.bq-tag{display:inline-block;font-size:10.5px;font-weight:700;padding:1px 7px;border-radius:8px;margin-left:6px;vertical-align:2px;}
.bq-tag.r{background:#FBEAE8;color:#C0453B;}
.bq-tag.gr{background:var(--muted);color:var(--sub);}
.bq-tag.y{background:#FBF3E2;color:#A9711F;}
.bq-tag.g{background:var(--mint-soft);color:var(--emerald-2);}
.bq-entry{margin:12px 16px 0;display:flex;align-items:center;justify-content:space-between;background:#fff;border-radius:14px;padding:12px 15px;box-shadow:var(--sh-sm);font-size:13.5px;font-weight:600;cursor:pointer;min-height:44px;box-sizing:border-box;}
.bq-entry .c{color:var(--sub);font-weight:500;font-size:12.5px;}
.bq-rec .r1{display:flex;justify-content:space-between;align-items:center;}
.bq-rec .nm{font-size:14.5px;font-weight:700;}
.bq-rec .m{font-size:12px;color:var(--sub);margin-top:4px;}
.bq-rec .ops{display:flex;gap:10px;margin-top:12px;}
.bq-rec .ops .btn{flex:1;min-height:40px;}
.bq-lk{font-size:12.5px;font-weight:700;color:#C0453B;padding:12px 0 2px;text-align:center;cursor:pointer;}
`;
document.head.appendChild(css);

const nowStr=()=>{const d=new Date(),p=n=>String(n).padStart(2,'0');return `${p(d.getMonth()+1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;};
const active=r=>r.status!=='revoked';
const mask=n=>n?n[0]+'****':'—';
function lineOf(orderId,sku){let n=0;D.shortReports.filter(active).forEach(r=>r.allocs.forEach(a=>{if(a.orderId===orderId&&r.sku===sku)n+=a.short;}));return n;}
function keyShort(date,wh,sku){return D.shortReports.filter(r=>active(r)&&r.date===date&&r.wh===wh&&r.sku===sku).reduce((s,r)=>s+r.qty,0);}
function stopped(date,wh,sku){return saleOf(sku)==='已下架'&&D.shortReports.some(r=>active(r)&&r.date===date&&r.wh===wh&&r.sku===sku&&r.stopSale);}
function cands(date,wh,sku){const out=[];
  D.orders.filter(o=>(o.status==='pending'||o.status==='packed')&&o.deliver===date&&o.warehouse===wh).forEach(o=>(o.lines||[]).forEach(l=>{if(l.sku!==sku)return;const left=l.qty-lineOf(o.id,sku);if(left>0)out.push({orderId:o.id,client:o.client,orderTime:o.orderTime||'',ordered:l.qty,left});}));
  return out.sort((a,b)=>b.orderTime.localeCompare(a.orderTime)||b.orderId.localeCompare(a.orderId));}   // BR-02 下单晚的先扣
function allocate(date,wh,sku,qty){let rest=qty;const res=[];cands(date,wh,sku).forEach(c=>{if(rest<=0)return;const s=Math.min(rest,c.left);rest-=s;res.push({...c,short:s});});return res;}
function info(date,wh,sku){let ordered=0,name='',unit='件',spec='';
  D.orders.filter(o=>(o.status==='pending'||o.status==='packed')&&o.deliver===date&&o.warehouse===wh).forEach(o=>(o.lines||[]).forEach(l=>{if(l.sku===sku){ordered+=l.qty;name=l.name;unit=l.unit||'件';spec=l.spec||'';}}));
  return {ordered,name,unit,spec,reported:keyShort(date,wh,sku)};}
function repStatus(r){if(r.status==='revoked')return 'revoked';const d=r.allocs.filter(a=>a.cs==='done').length;return d===0?'pending':(d===r.allocs.length?'done':'doing');}
const ST={pending:['y','待处理'],doing:['y','处理中'],done:['g','已处理'],revoked:['gr','已撤销']};

/* ---------- 报缺页（pushPage，底部主按钮 = 确认报缺） ---------- */
function open(date,key,printed,onDone){
  const [wh,sku]=key.split('|');const li=info(date,wh,sku);const cap=li.ordered-li.reported;
  if(cap<=0){FM.toast('该商品订单量已全部报缺');return;}
  const st={qty:1,rmk:REASONS[0]};
  const draw=box=>{
    box.innerHTML=`
      <div class="bq-card"><div class="bq-h">${li.name} · ${li.spec||li.unit} · ${wh} · 配送日 ${date}</div>
        <div class="bq-sum"><div class="k"><div class="v">${li.ordered}</div><div class="l">订单量</div></div><div class="k"><div class="v">${li.reported}</div><div class="l">已报缺</div></div><div class="k"><div class="v r">${cap}</div><div class="l">还可报缺</div></div></div></div>
      <div class="bq-card"><div class="bq-h">缺货数量（${li.unit}）</div>
        <div class="bq-step"><div class="b ${st.qty<=1?'off':''}" data-d="-1">−</div><input id="bq-q" type="number" inputmode="numeric" value="${st.qty}"><div class="b ${st.qty>=cap?'off':''}" data-d="1">+</div></div>
        <div class="bq-all" data-all="1">全部缺货（${cap}）</div></div>
      <div class="bq-tip g">📣 提交后平台客服会联系受影响的客户处理。打印标签数量不变，按实际能送的货贴标送货即可。</div>
      <div class="bq-card" style="display:flex;justify-content:space-between;align-items:center"><span class="bq-h" style="margin:0">当前售卖状态</span><span class="bq-tag ${SALE_CLS[saleOf(sku)]}" style="font-size:12px;padding:3px 10px">${saleOf(sku)}</span></div>
      ${saleOf(sku)==='售卖中'?`<div class="bq-tip y">⏸ 该商品<b>售卖中</b>：提交后会<b>自动下架</b>，不再接新单。货到了可在「报缺记录」重新上架。</div>`:''}
      <div class="bq-card"><div class="bq-h">缺货原因</div><div class="lb-pills">${REASONS.map(x=>`<span class="lb-pill ${st.rmk===x?'on':''}" data-rs="${x}">${x}</span>`).join('')}</div></div>
      <div style="height:16px"></div>`;
    box.querySelectorAll('.bq-step .b').forEach(b=>b.onclick=()=>{st.qty=Math.max(1,Math.min(cap,st.qty+(+b.dataset.d)));draw(box);});
    box.querySelector('[data-all]').onclick=()=>{st.qty=cap;draw(box);};
    const q=box.querySelector('#bq-q');q.onchange=()=>{let n=parseInt(q.value,10);if(isNaN(n)||n<1)n=1;if(n>cap){n=cap;FM.toast(`最多可报 ${cap}（订单量 − 已报缺）`);}st.qty=n;draw(box);};
    box.querySelectorAll('[data-rs]').forEach(el=>el.onclick=()=>{st.rmk=el.dataset.rs;draw(box);});
  };
  FM.pushPage({title:'报缺货',body:'<div id="bq-b"></div>',footer:'<button class="btn danger" id="bq-ok" style="background:#C0453B;color:#fff">确认报缺</button>',
    mount:p=>{const box=p.querySelector('#bq-b');draw(box);
      p.querySelector('#bq-ok').onclick=()=>{const q=box.querySelector('#bq-q');if(q)q.onchange&&q.onchange();
        const al=allocate(date,wh,sku,st.qty);if(!al.length){FM.toast('没有可分摊的订单','err');return;}
        D.shortReports.unshift({id:'BQ'+date.replace('-','')+String(++D.shortSeq).padStart(3,'0'),date,wh,sku,name:li.name,unit:li.unit,spec:li.spec,qty:st.qty,rmk:st.rmk,
          time:nowStr(),phase:D.labelCutoff?'after':'before',saleAt:saleOf(sku),stopSale:saleOf(sku)==='售卖中',restoredAt:'',
          allocs:al.map(a=>({orderId:a.orderId,client:a.client,orderTime:a.orderTime,ordered:a.ordered,short:a.short,cs:'pending',way:'',note:'',csAt:''})),status:'active'});
        const auto=saleOf(sku)==='售卖中';if(auto)D.skuSale[sku]='已下架';   // 售卖中 → 自动下架；售罄/已下架不处理
        FM.popPage();onDone&&onDone();
        FM.toast(`已报缺 ${st.qty}${li.unit}，已通知客服处理${auto?'；该商品已自动下架':''}`,'ok');};}});
}

/* ---------- 报缺记录页 ---------- */
function records(date,onChange){
  const draw=box=>{const list=D.shortReports.filter(r=>r.date===date);
    box.innerHTML=list.length?list.map(r=>{const s=repStatus(r);return `<div class="bq-card bq-rec">
      <div class="r1"><span class="nm">${r.name}<span class="bq-tag r">缺 ${r.qty}</span><span class="bq-tag ${SALE_CLS[saleOf(r.sku)]}">${saleOf(r.sku)}</span></span><span class="bq-tag ${ST[s][0]}">${ST[s][1]}</span></div>
      <div class="m">${r.id} · ${r.wh} · ${r.sku}</div>
      <div class="m">报缺 ${r.time} · ${r.phase==='before'?'截单前':'截单后'}${r.rmk?` · ${r.rmk}`:''}</div>
      ${(r.stopSale&&r.status!=='revoked'&&saleOf(r.sku)==='已下架')||s==='pending'?`<div class="ops">${r.stopSale&&r.status!=='revoked'&&saleOf(r.sku)==='已下架'?`<button class="btn" data-rs="${r.id}">重新上架</button>`:''}${s==='pending'?`<button class="btn" style="color:#C0453B" data-rv="${r.id}">撤销报缺</button>`:''}</div>`:''}
    </div>`;}).join('')+'<div style="height:16px"></div>'
    :`<div class="empty"><h4>该配送日暂无报缺</h4><p>在标签详情页点「报缺货」上报</p></div>`;
    box.querySelectorAll('[data-rs]').forEach(b=>b.onclick=()=>{const r=D.shortReports.find(x=>x.id===b.dataset.rs);
      FM.confirmDialog({title:`重新上架「${r.name}」？`,body:'上架后新进的订单不参与本次报缺分摊，按正常订单备货送货。',okText:'重新上架',onOk:()=>{D.skuSale[r.sku]='售卖中';r.restoredAt=nowStr();draw(box);onChange&&onChange();FM.toast('已重新上架','ok');}});});
    box.querySelectorAll('[data-rv]').forEach(b=>b.onclick=()=>{const r=D.shortReports.find(x=>x.id===b.dataset.rv);
      FM.confirmDialog({title:`撤销报缺 ${r.id}？`,body:`${r.qty}${r.unit}「${r.name}」恢复为应送，${r.stopSale&&saleOf(r.sku)==='已下架'?'商品同时重新上架，':''}向客服推送撤销通知。`,danger:true,okText:'撤销',onOk:()=>{if(r.stopSale&&saleOf(r.sku)==='已下架')D.skuSale[r.sku]='售卖中';r.status='revoked';draw(box);onChange&&onChange();FM.toast('已撤销，已通知客服','ok');}});});
  };
  FM.pushPage({title:'报缺记录 · '+date,body:'<div id="bq-rl"></div>',mount:p=>draw(p.querySelector('#bq-rl'))});
}

window.FM_SHORT={lineOf,keyShort,stopped,open,records,count:date=>D.shortReports.filter(r=>r.date===date&&active(r)).length,
  tags:(date,wh,sku)=>{const n=keyShort(date,wh,sku);return (n?`<span class="bq-tag r">已报缺 ${n}</span>`:'')+(stopped(date,wh,sku)?'<span class="bq-tag gr">已下架</span>':'');}};
})();
