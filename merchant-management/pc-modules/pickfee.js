/* PC · 自提运费（平台去批发市场取商家的货，按店铺收运费）
   ▍口径来源：2026-10-27「司机上门取货以及仓库退货差异结算沟通」会议（推翻 10-12 的按次/按比例、按月出账）
   ▍规则：
   - 平台按店铺指定所属区域（商家不能自选）；未设置的店铺不收运费；改区域从下一次取货起生效，已取的不重算
       近区（祝融、白斯班江一带）：S$20 / 次 / 商家，不拼车
       普通区：S$80 / 车，最多 4 家拼车，按同车实际商家数平摊（80 ÷ 同车商家数，四舍五入到分）；一车只有自己 = S$80
   - 同一商家同一天只收一次：按当天第一趟取货所在的车计费，后面的趟次（含一车装不下分到第二辆车）不再收
   - 新商家入驻 14 天内免运费：费用照常算（同车分摊人数照常算进去），这一笔记「新商家免运费」不扣
   - 超过 14 天还要免：招商走飞书审批（凡哥批，抄送运营），运营在取货明细里把那一笔「作废」，填原因和审批编号
   - 按周出账（周一至周日，对齐每周结算单）；运营手动推送到对应那周的结算单，从货款里扣
   - 推送即自动开「物流服务费」发票给商家，9% GST
   ▍假设（待确认）：S$20 / S$80 是含 GST 价，发票金额 = 应扣金额，未税 = 含税 ÷ 1.09
   ▍商家端：财务 › 自提运费（m-pickfee），只读；只显示同车商家数，不显示是哪几家；App 同口径（v2/pickfee.js）
   依赖主文件全局：DB / money / toast / modal / closeModal / drawer / closeDrawer / render / ts */
(function(){

const SHOPS = {
  'SH2026062000001':{name:'绿鲜源蔬果旗舰店', merchant:'M2026-0815', join:'2026-06-20'},
  'SH2026070200004':{name:'海丰水产旗舰店',   merchant:'M2026-0902', join:'2026-07-02'},
  'SH2026070200005':{name:'万丰肉禽旗舰店',   merchant:'M2026-1103', join:'2026-07-02'},
  'SH2026071500006':{name:'南洋鲜果行',       merchant:'',           join:'2026-10-08'},
  'SH2026072000007':{name:'阳光烘焙原料店',   merchant:'M2026-0820', join:'2026-07-20'},
  'SH2026080300008':{name:'金狮干货行',       merchant:'',           join:'2026-08-03'},
};
const shopName = c => (SHOPS[c]||{}).name || c;
const esc = s => String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const dash = '<span style="color:var(--ts)">—</span>';
const r2 = n => Math.round(n*100)/100;
const TODAY = '2026-10-27';
const PRICE = {NEAR:20, NORMAL:80}, MAX_POOL = 4, FREE_DAYS = 14, GST = 0.09;
const ZONE = {NEAR:'近区', NORMAL:'普通区', OFF:'不收费'};
const zoneStd = z => z=='NEAR' ? `${money(PRICE.NEAR)} / 次，不拼车` : z=='NORMAL' ? `${money(PRICE.NORMAL)} / 车，最多 ${MAX_POOL} 家拼车平摊` : '—';
const ruleText = v => !v || v.zone=='OFF' ? '不收费' : `${ZONE[v.zone]} · ${zoneStd(v.zone)}`;
const zoneTag = z => z=='NEAR' ? '<span class="tag t-b"><span class="dot"></span>近区</span>' : z=='NORMAL' ? '<span class="tag t-g"><span class="dot"></span>普通区</span>' : '<span class="tag t-gr"><span class="dot"></span>不收费</span>';

/* 日期工具（按 UTC 算，避免时区漂移） */
const D = s => new Date(s+'T00:00:00Z');
const fmt = d => d.toISOString().slice(0,10);
const addDays = (s,n) => { const d=D(s); d.setUTCDate(d.getUTCDate()+n); return fmt(d); };
const monday = s => { const d=D(s), w=(d.getUTCDay()+6)%7; return addDays(s,-w); };
const weekLabel = m => `${m} ~ ${addDays(m,6)}`;
const freeEnd = s => addDays(SHOPS[s].join, FREE_DAYS-1);           // 免运费最后一天（含）
const inFree = (s,date) => date <= freeEnd(s);

/* ================= 规则版本：每次保存追加一版，from = 保存时刻（下一次取货起生效） ================= */
DB.pfRules = DB.pfRules || {
  'SH2026062000001':[{from:'2026-10-01 00:00', zone:'NORMAL', by:'林凯'}],
  'SH2026070200004':[{from:'2026-10-01 00:00', zone:'NORMAL', by:'林凯'}],
  'SH2026070200005':[{from:'2026-10-01 00:00', zone:'NORMAL', by:'林凯'},
                     {from:'2026-10-14 10:20', zone:'NEAR',   by:'陈敏'}],
  'SH2026071500006':[{from:'2026-10-08 00:00', zone:'NORMAL', by:'陈敏'}],
  'SH2026072000007':[{from:'2026-10-01 00:00', zone:'NORMAL', by:'林凯'}],
};
const curRule = s => { const v=DB.pfRules[s]; return v&&v.length ? v[v.length-1] : null; };
const ruleAt = (s,t) => (DB.pfRules[s]||[]).filter(v=>v.from<=t).pop() || null;

/* ================= 取货记录（物流每天排车的数据：每车哪几家商家） ================= */
const MARKETS = ['巴西班让批发中心','裕廊渔港','双溪加株批发市场'];
const DRIVERS = [['陈志明','GBA 2381K'],['Ahmad','GBC 7712M'],['林国强','GBD 1029P'],['Rajesh','GBE 5560T']];
if(!DB.pfPickups){
  const A='SH2026062000001',B='SH2026070200004',C='SH2026070200005',Dn='SH2026071500006',E='SH2026072000007';
  const p2=n=>String(n).padStart(2,'0');
  DB.pfPickups=[]; let seq=1;
  for(let s='2026-10-05'; s<=TODAY; s=addDays(s,1)){
    if(D(s).getUTCDay()==0) continue;                              // 周日不取货
    const d=+s.slice(8), pools=[[[A,B,Dn,E]],[[A,B,E],[Dn]],[[A,Dn],[B,E]],[[A,B,Dn,E],[A]]][d%4]
      .map(car=>car.filter(x=>x!=Dn||s>='2026-10-08')).filter(car=>car.length);
    if(d%2) pools.push([C]);                                       // 万丰单独一车，隔天取
    pools.forEach((car,k)=>{
      const trip=`TC${s.replace(/-/g,'')}${p2(k+1)}`, [driver,plate]=DRIVERS[(d+k)%4], at=`${s} ${p2(6+k)}:${p2((d*7+k*13)%50+5)}`;
      car.forEach(shop=>DB.pfPickups.push({no:`PK${s.replace(/-/g,'')}${p2(seq++)}`, shop, at, trip, mates:car.length,
        market:MARKETS[(d+k)%3], driver, plate}));
    });
  }
}
/* 作废（超 14 天免运费，走飞书审批后运营作废）：key = 取货记录号 */
DB.pfVoids = DB.pfVoids || {
  'PK2026102164':{reason:'招商申请：新品类试运营期再免一周运费，凡哥已批', apv:'AP-20261021-0032', at:'2026-10-21 15:02', by:'陈敏'},
};

/* 计费：每店每天只在第一趟算一次 */
function pfCalc(){
  const first={};
  return DB.pfPickups.slice().sort((a,b)=>a.at.localeCompare(b.at)||a.no.localeCompare(b.no)).map(p=>{
    const v=ruleAt(p.shop,p.at), date=p.at.slice(0,10);
    if(!v || v.zone=='OFF') return {...p, rule:v, fee:0, charge:0, st:'NONE', basis:'未设置收费规则，不收费'};
    const k=p.shop+date;
    if(first[k]) return {...p, rule:v, fee:0, charge:0, st:'DUP', basis:`当天已在 ${first[k]} 计费，不重复收`};
    first[k]=p.trip;
    const fee = v.zone=='NEAR' ? PRICE.NEAR : r2(PRICE.NORMAL/p.mates);
    const basis = v.zone=='NEAR' ? `近区 · ${money(PRICE.NEAR)} / 次`
      : p.mates==1 ? `普通区 · 单独一车 ${money(PRICE.NORMAL)}` : `普通区 · ${money(PRICE.NORMAL)} ÷ 同车 ${p.mates} 家 = ${money(fee)}`;
    const vd=DB.pfVoids[p.no];
    if(vd) return {...p, rule:v, fee, charge:0, st:'VOID', basis, void:vd};
    if(inFree(p.shop,date)) return {...p, rule:v, fee, charge:0, st:'FREE', basis};
    return {...p, rule:v, fee, charge:fee, st:'CHARGE', basis};
  });
}
const PST = {CHARGE:['计费','t-g'], FREE:['新商家免运费','t-b'], VOID:['已作废','t-gr']};
const pstTag = p => PST[p.st] ? `<span class="tag ${PST[p.st][1]}"><span class="dot"></span>${PST[p.st][0]}</span>` : dash;

/* ================= 周账单：店铺 × 结算周 ================= */
DB.pfBills = DB.pfBills || {   // key = 店铺|周一日期
  'SH2026062000001|2026-10-05':{pushedAt:'2026-10-12 10:15', pushedBy:'林凯', invNo:'LOG-INV-2026-000012'},
  'SH2026070200004|2026-10-05':{pushedAt:'2026-10-12 10:15', pushedBy:'林凯', invNo:'LOG-INV-2026-000013'},
  'SH2026070200005|2026-10-05':{pushedAt:'2026-10-12 10:16', pushedBy:'林凯', invNo:'LOG-INV-2026-000014'},
  'SH2026072000007|2026-10-05':{pushedAt:'2026-10-12 10:16', pushedBy:'林凯', invNo:'LOG-INV-2026-000015'},
  'SH2026062000001|2026-10-12':{pushedAt:'2026-10-19 09:40', pushedBy:'林凯', invNo:'LOG-INV-2026-000016'},
};
const billNo = (s,m) => `PF-${m.replace(/-/g,'')}-${s.slice(-5)}`;
const allWeeks = () => [...new Set(DB.pfPickups.map(p=>monday(p.at.slice(0,10))))].sort().reverse();
function billsOf(m){
  const calc=pfCalc().filter(p=>monday(p.at.slice(0,10))==m);
  return Object.keys(SHOPS).map(s=>{
    const list=calc.filter(p=>p.shop==s); if(!list.length) return null;
    const st=DB.pfBills[s+'|'+m]||{}, sum=k=>r2(list.reduce((a,p)=>a+p[k],0));
    const fee=sum('fee'), due=sum('charge');
    return {shop:s, wk:m, no:billNo(s,m), list, times:list.length, fee, waive:r2(fee-due), due,
      pushedAt:st.pushedAt||'', pushedBy:st.pushedBy||'', invNo:st.invNo||'', open:addDays(m,6)>=TODAY};
  }).filter(Boolean);
}
const billOf = (s,m) => billsOf(m).find(b=>b.shop==s);
const canPush = b => !b.open && b.due>0 && !b.pushedAt;
const billTag = b => b.open ? '<span class="tag t-gr"><span class="dot"></span>本周进行中</span>'
  : !b.due ? '<span class="tag t-gr"><span class="dot"></span>无需收费</span>'
  : !b.pushedAt ? '<span class="tag t-y"><span class="dot"></span>待推送</span>'
  : '<span class="tag t-g"><span class="dot"></span>已推送</span>';
const invSplit = amt => { const net=r2(amt/(1+GST)); return {net, gst:r2(amt-net)}; };

/* ================= 页面一：自提运费规则 ================= */
PAGES['p-pickfee-rule']=()=>{
  const set=Object.keys(SHOPS).filter(s=>curRule(s));
  const rows=set.map(s=>{
    const v=curRule(s), fe=freeEnd(s);
    return `<tr>
      <td style="white-space:nowrap"><b>${esc(shopName(s))}</b></td>
      <td class="mono">${s}</td>
      <td>${zoneTag(v.zone)}</td>
      <td style="white-space:nowrap">${zoneStd(v.zone)=='—'?dash:zoneStd(v.zone)}</td>
      <td style="white-space:nowrap">${SHOPS[s].join}</td>
      <td style="white-space:nowrap">${fe>=TODAY?`${fe} <span class="tag t-b" style="font-size:10.5px">免运费中</span>`:fe}</td>
      <td style="white-space:nowrap">${v.from}</td>
      <td>${esc(v.by)}</td>
      <td style="white-space:nowrap"><button class="btn btn-link" onclick="pf_edit('${s}')">修改</button> <button class="btn btn-link" onclick="pf_hist('${s}')">变更记录</button></td>
    </tr>`;}).join('');
  return `<div class="card"><div class="card-hd"><h3>自提运费规则</h3><span class="sub">近区 = 祝融、白斯班江一带 · 已设置 ${set.length} 家店铺，未设置的不收运费 · 新商家入驻 ${FREE_DAYS} 天内免运费</span><button class="btn btn-p btn-sm" onclick="pf_edit('')">＋ 新增收费规则</button></div>
    <div class="card-bd flush"><div style="overflow-x:auto"><table>
      <thead><tr><th>店铺名称</th><th>店铺编码</th><th>所属区域</th><th>收费标准</th><th>入驻日期</th><th>免运费截止</th><th>生效时间</th><th>修改人</th><th>操作</th></tr></thead>
      <tbody>${rows||'<tr><td colspan="9"><div class="empty" style="padding:26px"><div class="e-ic">🚚</div><div class="e-t">还没有店铺设置自提运费</div><div class="e-s">点右上角「新增收费规则」，选店铺并设置所属区域</div></div></td></tr>'}</tbody></table></div></div></div>`;
};
window.pf_edit=function(s){
  const isNew=!s, free=Object.keys(SHOPS).filter(k=>!curRule(k));
  if(isNew&&!free.length){toast('所有店铺都已设置收费规则','info');return;}
  const z=(curRule(s)||{zone:'NORMAL'}).zone;
  const opt=k=>`<label style="display:flex;align-items:flex-start;gap:8px;margin:0 0 8px;cursor:pointer"><input type="radio" name="pf-zone" value="${k}" ${z==k?'checked':''} style="margin-top:3px"><span><b style="font-weight:600">${ZONE[k]}</b><span style="color:var(--ts);font-size:12.5px;margin-left:8px">${k=='NEAR'?'祝融、白斯班江一带 · ':k=='NORMAL'?'近区以外 · ':''}${k=='OFF'?'停止收取自提运费':zoneStd(k)}</span></span></label>`;
  modal(`<div class="mc-hd"><h3>${isNew?'新增收费规则':'修改自提运费 · '+esc(shopName(s))}</h3>${isNew?'':`<p>${s}</p>`}<button class="mc-x" onclick="closeModal()">×</button></div><div class="mc-bd">
    ${isNew?`<div class="fr"><label class="fl"><b>*</b>店铺</label><select id="pf-shop" onchange="pf_joinShow()"><option value="">请选择店铺</option>${free.map(k=>`<option value="${k}">${esc(shopName(k))}（${k}）</option>`).join('')}</select></div>`:''}
    <div class="fr"><label class="fl"><b>*</b>所属区域</label><div>${(isNew?['NEAR','NORMAL']:['NEAR','NORMAL','OFF']).map(opt).join('')}</div></div>
    <div class="fr"><label class="fl">入驻日期 / 免运费截止</label><div id="pf-join" style="font-size:13px;padding-top:2px">${s?`${SHOPS[s].join} 入驻，${freeEnd(s)} 前免运费`:'选择店铺后显示'}</div></div>
  </div><div class="mc-ft"><button class="btn btn-o" onclick="closeModal()">取消</button><button class="btn btn-p" onclick="pf_save('${s}')">保存</button></div>`);
};
window.pf_joinShow=function(){
  const s=document.getElementById('pf-shop').value, el=document.getElementById('pf-join');
  el.textContent = s ? `${SHOPS[s].join} 入驻，${freeEnd(s)} 前免运费` : '选择店铺后显示';
};
window.pf_save=function(s){
  if(!s){ s=(document.getElementById('pf-shop')||{}).value; if(!s){toast('请选择店铺','err');return;} }
  const zone=(document.querySelector('input[name=pf-zone]:checked')||{}).value;
  if(!zone){toast('请选择所属区域','err');return;}
  const old=curRule(s), nv={zone};
  if(old && old.zone==zone){toast('规则没有变化','info');return;}
  modal(`<div class="mc-hd"><h3>${old?'确认修改自提运费':'确认新增收费规则'}</h3><button class="mc-x" onclick="closeModal()">×</button></div><div class="mc-bd">
    <table class="subtbl"><tbody>
      <tr><td style="color:var(--ts);width:90px">店铺</td><td>${esc(shopName(s))}</td></tr>
      <tr><td style="color:var(--ts)">原规则</td><td>${old?ruleText(old):'未设置（不收费）'}</td></tr>
      <tr><td style="color:var(--ts)">新规则</td><td><b>${ruleText(nv)}</b></td></tr>
    </tbody></table>
    <div class="ib ib-y" style="margin-top:12px"><span class="i">⚠️</span>保存后从<b>下一次取货</b>起按新规则计费，已经取过的货不重算。</div>
  </div><div class="mc-ft"><button class="btn btn-o" onclick="pf_edit('${old?s:''}')">返回修改</button><button class="btn btn-p" onclick='pf_commit("${s}",${JSON.stringify(nv)})'>确认保存</button></div>`);
};
window.pf_commit=function(s,nv){
  (DB.pfRules[s]=DB.pfRules[s]||[]).push({...nv, from:ts(), by:'当前账号'});
  const isNew=DB.pfRules[s].length==1;
  closeModal(); render(); toast(isNew?'已新增，下一次取货起开始收运费':'已保存，下一次取货起按新规则计费','ok');
};
window.pf_hist=function(s){
  const vers=(DB.pfRules[s]||[]).slice().reverse();
  drawer(`<div class="drawer-hd"><h3>变更记录 · ${esc(shopName(s))}</h3><span class="x" onclick="closeDrawer()">×</span></div>
  <div class="drawer-bd"><table><thead><tr><th>生效时间</th><th>所属区域</th><th>收费标准</th><th>修改人</th></tr></thead><tbody>
    ${vers.map((v,i)=>`<tr><td class="mono" style="white-space:nowrap">${v.from}${i==0?' <span class="tag t-g" style="font-size:10.5px">当前</span>':''}</td><td>${ZONE[v.zone]}</td><td>${zoneStd(v.zone)}</td><td>${esc(v.by)}</td></tr>`).join('')}
  </tbody></table></div>
  <div class="drawer-ft"><button class="btn btn-o" onclick="closeDrawer()">关闭</button></div>`);
};

/* ================= 页面二：自提运费账单（周账单 / 取货明细） ================= */
const lastClosedWeek = () => allWeeks().find(m=>addDays(m,6)<TODAY) || allWeeks()[0];
DB.pfTab = DB.pfTab || 'BILL';
DB.pfFilter = DB.pfFilter || {shop:'', wk:lastClosedWeek()};
DB.pfSel = DB.pfSel || [];

PAGES['p-pickfee-bill']=()=>{
  const f=DB.pfFilter, hit=s=>!f.shop||f.shop==s;
  const bills=billsOf(f.wk).filter(b=>hit(b.shop));
  const picks=pfCalc().filter(p=>monday(p.at.slice(0,10))==f.wk&&hit(p.shop)).reverse();
  DB.pfSel=DB.pfSel.filter(no=>bills.some(b=>b.no==no&&canPush(b)));
  const tabs=[['BILL','周账单',bills.length],['PICK','取货明细',picks.length]];
  return `<div class="card" style="margin-bottom:14px"><div class="card-bd" style="display:flex;gap:16px;align-items:flex-end;flex-wrap:wrap;padding:14px 16px">
    <div><div style="font-size:12px;color:var(--ts);margin-bottom:5px">店铺</div><select id="pf-f-shop" style="min-width:180px"><option value="">全部</option>${Object.keys(SHOPS).map(s=>`<option value="${s}" ${f.shop==s?'selected':''}>${esc(shopName(s))}</option>`).join('')}</select></div>
    <div><div style="font-size:12px;color:var(--ts);margin-bottom:5px">结算周</div><select id="pf-f-wk" style="min-width:220px">${allWeeks().map(m=>`<option value="${m}" ${f.wk==m?'selected':''}>${weekLabel(m)}</option>`).join('')}</select></div>
    <button class="btn btn-p btn-sm" onclick="DB.pfFilter={shop:document.getElementById('pf-f-shop').value,wk:document.getElementById('pf-f-wk').value};DB.pfSel=[];render()">查询</button>
    <button class="btn btn-o btn-sm" onclick="DB.pfFilter={shop:'',wk:lastClosedWeek()};DB.pfSel=[];render()">重置</button>
  </div></div>
  <div class="tabs" style="margin-bottom:14px">${tabs.map(([k,l,n])=>`<div class="tab ${DB.pfTab==k?'active':''}" onclick="DB.pfTab='${k}';render()">${l}${n?`<span class="tb">${n}</span>`:''}</div>`).join('')}</div>
  ${DB.pfTab=='BILL'?billTable(bills):pickTable(picks)}`;
};
window.lastClosedWeek=lastClosedWeek;
function billTable(bills){
  const sel=bills.filter(canPush), all=sel.length&&sel.every(b=>DB.pfSel.includes(b.no));
  return `<div class="card">
    <div class="selbar" style="display:flex;align-items:center;gap:10px;padding:10px 16px;background:#F0FBF4;border-bottom:1px solid var(--bd);font-size:13px">
      <span style="color:var(--ts)">已选 <b style="color:var(--tp)">${DB.pfSel.length}</b> 张</span><span style="flex:1"></span>
      <button class="btn btn-p btn-sm" ${DB.pfSel.length?'':'disabled'} onclick="pf_push(DB.pfSel.slice())">推送到结算单</button>
    </div>
    <div class="card-bd flush"><div style="overflow-x:auto"><table>
    <thead><tr><th style="width:34px"><input type="checkbox" title="全选待推送" ${all?'checked':''} ${sel.length?'':'disabled'} onclick="pf_selAll()"></th><th>账单号</th><th>店铺名称</th><th>店铺编码</th><th>结算周期</th><th style="text-align:right">取货次数</th><th style="text-align:right">计费金额</th><th style="text-align:right">减免金额</th><th style="text-align:right">应扣金额</th><th>状态</th><th>推送人</th><th>推送时间</th><th>物流费发票</th><th>操作</th></tr></thead><tbody>
    ${bills.length?bills.map(b=>`<tr>
      <td>${canPush(b)?`<input type="checkbox" ${DB.pfSel.includes(b.no)?'checked':''} onclick="pf_toggle('${b.no}')">`:''}</td>
      <td class="mono" style="white-space:nowrap">${b.no}</td><td style="white-space:nowrap">${esc(shopName(b.shop))}</td><td class="mono">${b.shop}</td>
      <td style="white-space:nowrap">${weekLabel(b.wk)}</td>
      <td style="text-align:right">${b.times}</td><td style="text-align:right">${money(b.fee)}</td>
      <td style="text-align:right">${b.waive?money(b.waive):dash}</td><td style="text-align:right"><b>${money(b.due)}</b></td>
      <td>${billTag(b)}</td><td>${b.pushedBy?esc(b.pushedBy):dash}</td><td style="white-space:nowrap">${b.pushedAt||dash}</td>
      <td class="mono" style="white-space:nowrap">${b.invNo||dash}</td>
      <td style="white-space:nowrap"><button class="btn btn-link" onclick="pf_bill('${b.shop}','${b.wk}')">明细</button>${canPush(b)?` <button class="btn btn-link" onclick="pf_push(['${b.no}'])">推送</button>`:''}</td>
    </tr>`).join(''):`<tr><td colspan="14"><div class="empty" style="padding:26px"><div class="e-ic">🚚</div><div class="e-t">该周没有取货记录</div></div></td></tr>`}
    </tbody></table></div></div></div>`;
}
window.pf_toggle=function(no){ const i=DB.pfSel.indexOf(no); i<0?DB.pfSel.push(no):DB.pfSel.splice(i,1); render(); };
window.pf_selAll=function(){
  const f=DB.pfFilter, ok=billsOf(f.wk).filter(b=>(!f.shop||f.shop==b.shop)&&canPush(b)).map(b=>b.no);
  DB.pfSel = ok.every(no=>DB.pfSel.includes(no)) ? [] : ok; render();
};
function pickTable(picks){
  return `<div class="card">
    <div class="selbar" style="display:flex;align-items:center;gap:10px;padding:10px 16px;background:#F0FBF4;border-bottom:1px solid var(--bd);font-size:13px">
      <span style="flex:1"></span><button class="btn btn-o btn-sm" onclick="pf_import()">导入取货数据</button>
    </div>
    <div class="card-bd flush"><div style="overflow-x:auto">${pickRows(picks,true,true)}</div></div></div>`;
}
const pushedOf = p => !!(DB.pfBills[p.shop+'|'+monday(p.at.slice(0,10))]||{}).pushedAt;
function pickRows(picks,withShop,canOp){
  const cols=withShop?12:11;
  return `<table><thead><tr><th>取货记录号</th>${withShop?'<th>店铺名称</th>':''}<th>取货时间</th><th>车次</th><th style="text-align:right">同车商家数</th><th>取货地点</th><th>司机</th><th>所属区域</th><th>计费说明</th><th style="text-align:right">计费金额</th><th>状态</th>${canOp?'<th>操作</th>':''}</tr></thead><tbody>
    ${picks.length?picks.map(p=>`<tr>
      <td class="mono" style="white-space:nowrap">${p.no}</td>${withShop?`<td style="white-space:nowrap">${esc(shopName(p.shop))}</td>`:''}
      <td class="mono" style="white-space:nowrap">${p.at}</td><td class="mono" style="white-space:nowrap">${p.trip}</td>
      <td style="text-align:right">${p.mates}</td><td style="white-space:nowrap">${p.market}</td><td style="white-space:nowrap">${esc(p.driver)}</td>
      <td style="white-space:nowrap">${p.rule?ZONE[p.rule.zone]:'不收费'}</td>
      <td style="font-size:12.5px;color:var(--ts)">${p.basis}${p.void?`<br>作废原因：${esc(p.void.reason)}${p.void.apv?`（审批 ${esc(p.void.apv)}）`:''}`:''}</td>
      <td style="text-align:right">${p.fee?money(p.fee):money(0)}</td><td style="white-space:nowrap">${pstTag(p)}</td>
      ${canOp?`<td style="white-space:nowrap">${p.st=='CHARGE'&&!pushedOf(p)?`<button class="btn btn-link" onclick="pf_void('${p.no}')">作废</button>`:dash}</td>`:''}</tr>`).join('')
    :`<tr><td colspan="${cols-(canOp?0:1)}"><div class="empty" style="padding:26px"><div class="e-ic">🚚</div><div class="e-t">没有取货记录</div></div></td></tr>`}
  </tbody></table>`;
}
const billByNo = no => billsOf(DB.pfFilter.wk).find(b=>b.no==no);
window.pf_bill=function(s,m){
  const b=billOf(s,m); if(!b) return;
  const kv=(k,v)=>`<div><div class="k">${k}</div><div class="v">${v}</div></div>`, iv=b.invNo?invSplit(b.due):null;
  drawer(`<div class="drawer-hd"><div><h3>自提运费账单 <span class="mono" style="font-size:12.5px;color:var(--ts)">${b.no}</span></h3><div style="margin-top:4px">${billTag(b)}</div></div><span class="x" onclick="closeDrawer()">×</span></div>
  <div class="drawer-bd">
    <div class="kv" style="margin-bottom:16px">
      ${kv('店铺',`${esc(shopName(s))}（${s}）`)}${kv('结算周期',weekLabel(m))}
      ${kv('取货次数',b.times)}${kv('计费金额',money(b.fee))}${kv('减免金额',b.waive?money(b.waive):'—')}${kv('应扣金额',money(b.due))}
      ${kv('推送人',b.pushedBy?esc(b.pushedBy):'—')}${kv('推送时间',b.pushedAt||'—')}
      ${kv('物流费发票',b.invNo||'—')}${kv('未税金额',iv?money(iv.net):'—')}${kv('GST（9%）',iv?money(iv.gst):'—')}${kv('发票金额（含税）',iv?money(b.due):'—')}
    </div>
    ${pickRows(b.list.slice().reverse(),false,false)}
  </div>
  <div class="drawer-ft"><button class="btn btn-o" onclick="closeDrawer()">关闭</button>${canPush(b)?`<button class="btn btn-p" onclick="closeDrawer();pf_push(['${b.no}'])">推送到结算单</button>`:''}</div>`);
};
window.pf_push=function(nos){
  const list=nos.map(billByNo).filter(b=>b&&canPush(b));
  if(!list.length){toast('请选择待推送的账单','err');return;}
  const total=r2(list.reduce((a,b)=>a+b.due,0));
  modal(`<div class="mc-hd"><h3>推送到结算单</h3><button class="mc-x" onclick="closeModal()">×</button></div><div class="mc-bd">
    <table class="subtbl"><thead><tr><th>账单号</th><th>店铺</th><th>结算周期</th><th style="text-align:right">应扣金额</th></tr></thead><tbody>
      ${list.map(b=>`<tr><td class="mono">${b.no}</td><td>${esc(shopName(b.shop))}</td><td style="white-space:nowrap">${weekLabel(b.wk)}</td><td style="text-align:right">${money(b.due)}</td></tr>`).join('')}
    </tbody></table>
    <div class="ib ib-y" style="margin-top:12px"><span class="i">⚠️</span>共 <b>${list.length}</b> 张、<b>${money(total)}</b>。推送后进入对应那周的结算单，从商家货款中扣除，同时自动开具物流服务费发票（含 9% GST）给商家；账单不能再修改。</div>
  </div><div class="mc-ft"><button class="btn btn-o" onclick="closeModal()">取消</button><button class="btn btn-p" onclick='pf_pushDo(${JSON.stringify(list.map(b=>b.no))})'>确认推送</button></div>`);
};
window.pf_pushDo=function(nos){
  let n=Object.values(DB.pfBills).filter(x=>x.invNo).length+12;
  nos.map(billByNo).filter(Boolean).forEach(b=>{
    Object.assign(DB.pfBills[b.shop+'|'+b.wk]=DB.pfBills[b.shop+'|'+b.wk]||{}, {pushedAt:ts(), pushedBy:'当前账号', invNo:`LOG-INV-2026-${String(n++).padStart(6,'0')}`});
  });
  DB.pfSel=[]; closeModal(); render(); toast(`已推送 ${nos.length} 张账单到结算单，物流服务费发票已自动开具`,'ok');
};
window.pf_void=function(no){
  const p=pfCalc().find(x=>x.no==no); if(!p) return;
  modal(`<div class="mc-hd"><h3>作废运费</h3><button class="mc-x" onclick="closeModal()">×</button></div><div class="mc-bd">
    <table class="subtbl"><tbody>
      <tr><td style="color:var(--ts);width:90px">店铺</td><td>${esc(shopName(p.shop))}</td></tr>
      <tr><td style="color:var(--ts)">取货记录</td><td class="mono">${p.no} · ${p.at}</td></tr>
      <tr><td style="color:var(--ts)">计费金额</td><td><b>${money(p.fee)}</b></td></tr>
    </tbody></table>
    <div class="fr" style="margin-top:12px"><label class="fl"><b>*</b>作废原因</label><textarea id="pf-v-reason" rows="2" maxlength="200" placeholder="例如：招商申请延长免运费，已获批">招商申请延长免运费</textarea></div>
    <div class="fr"><label class="fl">飞书审批编号</label><input id="pf-v-apv" maxlength="40" placeholder="超 14 天免运费需凡哥审批，填审批编号便于查证"></div>
  </div><div class="mc-ft"><button class="btn btn-o" onclick="closeModal()">取消</button><button class="btn btn-p" onclick="pf_voidDo('${no}')">确认作废</button></div>`);
};
window.pf_voidDo=function(no){
  const reason=document.getElementById('pf-v-reason').value.trim(), apv=document.getElementById('pf-v-apv').value.trim();
  if(!reason){toast('请填写作废原因','err');return;}
  DB.pfVoids[no]={reason, apv, at:ts(), by:'当前账号'};
  closeModal(); render(); toast('已作废，这一笔不再扣商家','ok');
};
window.pf_import=function(){
  modal(`<div class="mc-hd"><h3>导入取货数据</h3><button class="mc-x" onclick="closeModal()">×</button></div><div class="mc-bd">
    <div class="up" onclick="toast('演示：已选择 取货数据_2026-10-26.xlsx','info')"><div class="uic">📄</div><div class="ut">选择 Excel 文件</div><div class="us">列：车次 / 取货时间 / 店铺编码 / 取货地点 / 司机 / 车牌；同一车次同一店铺重复的行自动跳过</div></div>
    <div class="row" style="margin-top:10px"><button class="btn btn-link" onclick="toast('演示：模板已下载','info')">下载导入模板</button></div>
  </div><div class="mc-ft"><button class="btn btn-o" onclick="closeModal()">取消</button><button class="btn btn-p" onclick="closeModal();toast('演示：导入 0 条，跳过重复 0 条','info')">开始导入</button></div>`);
};

/* ================= 商家端：财务 › 自提运费（m-pickfee，只读） =================
   - 只看本商家的店铺；店铺从没设置过收费规则 → 不显示菜单
   - 账单、运费与运营端同一份计算（pfCalc）
   - 状态换成商家能懂的说法：待推送 → 待出账；已推送 → 已出账（结算时从货款扣）；作废 → 已减免
   - 只显示同车商家数，不显示是哪几家；不显示推送人、规则修改人、作废原因等内部信息 */
const myShop = () => Object.keys(SHOPS).find(s=>SHOPS[s].merchant==DB.merchant.code) || '';
window.pfMerchantOn = () => { const s=myShop(); return !!(s && (DB.pfRules[s]||[]).length); };
const mBillTag = b => b.open ? '<span class="tag t-gr"><span class="dot"></span>本周进行中</span>'
  : !b.due ? '<span class="tag t-gr"><span class="dot"></span>无需收费</span>'
  : !b.pushedAt ? '<span class="tag t-y"><span class="dot"></span>待出账</span>'
  : '<span class="tag t-g"><span class="dot"></span>已出账</span>';
const MPST = {CHARGE:['计费','t-g'], FREE:['新商家免运费','t-b'], VOID:['已减免','t-b']};
const mPstTag = p => MPST[p.st] ? `<span class="tag ${MPST[p.st][1]}"><span class="dot"></span>${MPST[p.st][0]}</span>` : dash;
const myWeeks = s => [...new Set(DB.pfPickups.filter(p=>p.shop==s).map(p=>monday(p.at.slice(0,10))))].sort().reverse();
DB.pfMTab = DB.pfMTab || 'BILL';
DB.pfMWk = DB.pfMWk || '';

PAGES['m-pickfee']=()=>{
  const s=myShop(), v=curRule(s);
  if(!pfMerchantOn()) return `<div class="card"><div class="card-bd"><div class="empty"><div class="e-ic">🚚</div><div class="e-t">未开通自提运费</div><div class="e-s">平台没有为您的店铺设置自提运费，取货不收费</div></div></div></div>`;
  const wk=DB.pfMWk, weeks=myWeeks(s), fe=freeEnd(s);
  const bills=(wk?[wk]:weeks).map(m=>billOf(s,m)).filter(Boolean);
  const picks=pfCalc().filter(p=>p.shop==s&&(!wk||monday(p.at.slice(0,10))==wk)).reverse();
  const kv=(k,val)=>`<div><div class="k">${k}</div><div class="v">${val}</div></div>`;
  const tabs=[['BILL','周账单',bills.length],['PICK','取货明细',picks.length]];
  return `<div class="card" style="margin-bottom:14px"><div class="card-hd"><h3>当前收费规则</h3><span class="sub">平台去批发市场帮您取货收的运费；按周出账单，结算时从货款中扣除，并开物流服务费发票给您</span><button class="btn btn-o btn-sm" onclick="pf_mHist()">变更记录</button></div>
    <div class="card-bd"><div class="kv">
      ${kv('店铺',`${esc(shopName(s))}（<span class="mono">${s}</span>）`)}
      ${kv('所属区域',ZONE[v.zone])}
      ${kv('收费标准',v.zone=='NORMAL'?`${money(PRICE.NORMAL)} / 车，最多 ${MAX_POOL} 家拼车，按同车商家数平摊；同一天只收一次`:v.zone=='NEAR'?`${money(PRICE.NEAR)} / 次；同一天只收一次`:'—')}
      ${kv('新商家免运费',`入驻 ${FREE_DAYS} 天内免运费（${SHOPS[s].join} ~ ${fe}）${fe>=TODAY?' <span class="tag t-b" style="font-size:10.5px">免运费中</span>':''}`)}
      ${kv('生效时间',v.from)}
    </div></div></div>
  <div class="card" style="margin-bottom:14px"><div class="card-bd" style="display:flex;gap:16px;align-items:flex-end;flex-wrap:wrap;padding:14px 16px">
    <div><div style="font-size:12px;color:var(--ts);margin-bottom:5px">结算周</div><select id="pf-m-wk" style="min-width:220px"><option value="">全部</option>${weeks.map(m=>`<option value="${m}" ${wk==m?'selected':''}>${weekLabel(m)}</option>`).join('')}</select></div>
    <button class="btn btn-p btn-sm" onclick="DB.pfMWk=document.getElementById('pf-m-wk').value;render()">查询</button><button class="btn btn-o btn-sm" onclick="DB.pfMWk='';render()">重置</button>
  </div></div>
  <div class="tabs" style="margin-bottom:14px">${tabs.map(([k,l,n])=>`<div class="tab ${DB.pfMTab==k?'active':''}" onclick="DB.pfMTab='${k}';render()">${l}${n?`<span class="tb">${n}</span>`:''}</div>`).join('')}</div>
  ${DB.pfMTab=='BILL'?mBillTable(bills):`<div class="card"><div class="card-bd flush"><div style="overflow-x:auto">${mPickRows(picks)}</div></div></div>`}`;
};
function mBillTable(bills){
  return `<div class="card"><div class="card-bd flush"><div style="overflow-x:auto"><table>
    <thead><tr><th>账单号</th><th>结算周期</th><th style="text-align:right">取货次数</th><th style="text-align:right">计费金额</th><th style="text-align:right">减免金额</th><th style="text-align:right">应扣金额</th><th>账单状态</th><th>出账时间</th><th>物流费发票</th><th>操作</th></tr></thead><tbody>
    ${bills.length?bills.map(b=>`<tr>
      <td class="mono" style="white-space:nowrap">${b.no}</td><td style="white-space:nowrap">${weekLabel(b.wk)}</td>
      <td style="text-align:right">${b.times}</td><td style="text-align:right">${money(b.fee)}</td>
      <td style="text-align:right">${b.waive?money(b.waive):dash}</td><td style="text-align:right"><b>${money(b.due)}</b></td>
      <td>${mBillTag(b)}</td><td style="white-space:nowrap">${b.pushedAt||dash}</td><td class="mono" style="white-space:nowrap">${b.invNo||dash}</td>
      <td style="white-space:nowrap"><button class="btn btn-link" onclick="pf_mBill('${b.wk}')">明细</button>${b.invNo?` <button class="btn btn-link" onclick="toast('演示：已下载 ${b.invNo}.pdf','info')">下载发票</button>`:''}</td>
    </tr>`).join(''):`<tr><td colspan="10"><div class="empty" style="padding:26px"><div class="e-ic">🚚</div><div class="e-t">该周没有取货记录</div></div></td></tr>`}
    </tbody></table></div></div></div>`;
}
function mPickRows(picks){
  return `<table><thead><tr><th>取货记录号</th><th>取货时间</th><th style="text-align:right">同车商家数</th><th>取货地点</th><th>计费说明</th><th style="text-align:right">计费金额</th><th>状态</th></tr></thead><tbody>
    ${picks.length?picks.map(p=>`<tr>
      <td class="mono" style="white-space:nowrap">${p.no}</td><td class="mono" style="white-space:nowrap">${p.at}</td>
      <td style="text-align:right">${p.mates}</td><td style="white-space:nowrap">${p.market}</td>
      <td style="font-size:12.5px;color:var(--ts)">${p.basis}</td>
      <td style="text-align:right">${money(p.fee)}</td><td style="white-space:nowrap">${mPstTag(p)}</td></tr>`).join('')
    :`<tr><td colspan="7"><div class="empty" style="padding:26px"><div class="e-ic">🚚</div><div class="e-t">没有取货记录</div></div></td></tr>`}
  </tbody></table>`;
}
window.pf_mBill=function(m){
  const s=myShop(), b=billOf(s,m); if(!b) return;
  const kv=(k,val)=>`<div><div class="k">${k}</div><div class="v">${val}</div></div>`, iv=b.invNo?invSplit(b.due):null;
  drawer(`<div class="drawer-hd"><div><h3>自提运费账单 <span class="mono" style="font-size:12.5px;color:var(--ts)">${b.no}</span></h3><div style="margin-top:4px">${mBillTag(b)}</div></div><span class="x" onclick="closeDrawer()">×</span></div>
  <div class="drawer-bd">
    <div class="kv" style="margin-bottom:16px">
      ${kv('结算周期',weekLabel(m))}${kv('取货次数',b.times)}
      ${kv('计费金额',money(b.fee))}${kv('减免金额',b.waive?money(b.waive):'—')}${kv('应扣金额',money(b.due))}
      ${kv('出账时间',b.pushedAt||'—')}${kv('扣款方式',b.pushedAt?'结算时从货款中扣除':'—')}
      ${kv('物流费发票',b.invNo||(b.pushedAt?'待开票':'—'))}${kv('未税金额',iv?money(iv.net):'—')}${kv('GST（9%）',iv?money(iv.gst):'—')}
    </div>
    ${mPickRows(b.list.slice().reverse())}
  </div>
  <div class="drawer-ft">${b.invNo?`<button class="btn btn-o" onclick="toast('演示：已下载 ${b.invNo}.pdf','info')">下载发票</button>`:''}<button class="btn btn-p" onclick="closeDrawer()">关闭</button></div>`);
};
window.pf_mHist=function(){
  const s=myShop(), vers=(DB.pfRules[s]||[]).slice().reverse();
  drawer(`<div class="drawer-hd"><h3>收费规则变更记录</h3><span class="x" onclick="closeDrawer()">×</span></div>
  <div class="drawer-bd"><table><thead><tr><th>生效时间</th><th>所属区域</th><th>收费标准</th></tr></thead><tbody>
    ${vers.map((v,i)=>`<tr><td class="mono" style="white-space:nowrap">${v.from}${i==0?' <span class="tag t-g" style="font-size:10.5px">当前</span>':''}</td><td>${ZONE[v.zone]}</td><td>${zoneStd(v.zone)}</td></tr>`).join('')}
  </tbody></table></div>
  <div class="drawer-ft"><button class="btn btn-o" onclick="closeDrawer()">关闭</button></div>`);
};

})();
