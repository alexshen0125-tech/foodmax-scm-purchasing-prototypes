/* PC · 店铺运营平台 —— 自提运费（平台去批发市场取商家的货，按店铺收运费）
   ▍需求来源：2026-10-12「自提收费」会议 + 沈亮拍板口径（PRD 待写，规则以后续 PRD 为准，本文件只做交互演示）
   ▍拍板口径：
   - 收费规则由平台按店铺指定（商家不能自选）；未设置的店铺不收运费。
   - 两种计费方式，一家店铺同一时间只用一种：
       按次：每取一次货收一次固定金额（每家店铺单独计次，不做拼车分摊）；
       按下单金额比例：有取货的那天，当天下单金额 × 比例；可设「每日封顶」，超过按封顶收。
   - 改规则下一次生效：保存时刻之后的取货按新规则算，之前已取的货不重算。
   - 每月汇总出账单 → 生成「自提运费」业务调整单（负向·账扣，从货款里扣）；发票单独开「物流费发票」，不和服务费/佣金合开。
   依赖主文件全局：DB / money / toast / modal / modalWide / closeModal / drawer / closeDrawer / render / nav / ts / flowTip */
(function(){

const SHOPS = {
  'SH2026062000001':{name:'绿鲜源蔬果旗舰店', merchant:'M2026-0815'},
  'SH2026070200004':{name:'海丰水产旗舰店',   merchant:'M2026-0902'},
  'SH2026070200005':{name:'万丰肉禽旗舰店',   merchant:'M2026-1103'},
  'SH2026071500006':{name:'南洋鲜果行',       merchant:''},
  'SH2026072000007':{name:'阳光烘焙原料店',   merchant:'M2026-0820'},
  'SH2026080300008':{name:'金狮干货行',       merchant:''},
};
const shopName = c => (SHOPS[c]||{}).name || c;
const esc = s => String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const MODE = {TRIP:'按次', GMV:'按下单金额比例', OFF:'不收费'};
const pct = r => +(r*100).toFixed(2)+'%';

/* 调整类型：自提运费（负向·账扣），挂到业务调整单类型里 */
if(DB.adjTypes && !DB.adjTypes.some(t=>t.cn=='自提运费'))
  DB.adjTypes.push({code:'ADJT-0011', cn:'自提运费', en:'Pickup Freight', dir:'DEDUCTION', on:1, ded:'ACCOUNT', opBy:'林凯', opAt:'2026-10-12 15:00'});

/* ================= 规则版本：每次保存追加一版，from = 保存时刻（下一次取货起生效） ================= */
DB.pfRules = DB.pfRules || {
  'SH2026062000001':[{from:'2026-09-01 00:00', mode:'TRIP', price:80, by:'林凯'}],
  'SH2026070200004':[{from:'2026-09-01 00:00', mode:'GMV', rate:0.02, cap:120, by:'林凯'}],
  'SH2026070200005':[{from:'2026-09-01 00:00', mode:'TRIP', price:80, by:'林凯'},
                     {from:'2026-10-08 16:20', mode:'TRIP', price:60, by:'陈敏'}],
};
const curRule = s => { const v=DB.pfRules[s]; return v&&v.length ? v[v.length-1] : null; };
const ruleAt = (s,t) => (DB.pfRules[s]||[]).filter(v=>v.from<=t).pop() || null;
const ruleText = v => !v || v.mode=='OFF' ? '不收费'
  : v.mode=='TRIP' ? `${money(v.price)} / 次`
  : `当天下单金额 × ${pct(v.rate)}${v.cap?`，每日封顶 ${money(v.cap)}`:'，不封顶'}`;

/* ================= 取货记录 + 店铺每日下单金额（演示数据） ================= */
const MARKETS = ['巴西班让批发中心','裕廊渔港','双溪加株批发市场'];
const DRIVERS = ['陈志明','Ahmad','林国强','Rajesh'];
if(!DB.pfPickups){
  const plan = {   // 店铺 → 每月取货日（9 月完整 + 10 月至今）；海丰部分日子一天取两趟
    'SH2026062000001':{days:[2,4,6,9,11,13,16,18,20,23,25,27], oct:[2,4,7,9,11], mk:0},
    'SH2026070200004':{days:[3,3,8,12,12,17,22,26], oct:[1,6,6,10], mk:1},
    'SH2026070200005':{days:[5,10,15,19,24,29], oct:[3,8,10], mk:2},
  };
  DB.pfPickups=[]; DB.pfGmv={}; let seq=1;
  const p2=n=>String(n).padStart(2,'0');
  Object.entries(plan).forEach(([shop,cfg],si)=>{
    DB.pfGmv[shop]={};
    [['2026-09',cfg.days],['2026-10',cfg.oct]].forEach(([ym,days])=>{
      const seen={};
      days.forEach((d,i)=>{
        const date=`${ym}-${p2(d)}`, nth=(seen[date]=(seen[date]||0)+1);
        DB.pfGmv[shop][date] = DB.pfGmv[shop][date] || +(2400 + ((d*37+si*113)%23)*310 + si*900).toFixed(2);
        DB.pfPickups.push({no:`PK${ym.replace('-','')}${p2(d)}${p2(seq++)}`, shop, at:`${date} ${nth==1?'06:':'13:'}${p2((d*7+si*11)%50+5)}`,
          market:MARKETS[cfg.mk], driver:DRIVERS[(i+si)%4], src: ym=='2026-10'&&d>=8 ? 'TMS 取货任务' : '仓库台账导入'});
      });
    });
  });
}
/* 计费：按次=每次一笔；按比例=每店每天只算一次（当天第一趟取货时的规则），后面几趟记 0 */
function pfCalc(){
  const firstOfDay={};
  return DB.pfPickups.slice().sort((a,b)=>a.at.localeCompare(b.at)).map(p=>{
    const v=ruleAt(p.shop,p.at), date=p.at.slice(0,10);
    if(!v || v.mode=='OFF') return {...p, rule:v, fee:0, basis:'未设置收费规则，不收费'};
    if(v.mode=='TRIP') return {...p, rule:v, fee:v.price, basis:`1 次 × ${money(v.price)}`};
    const k=p.shop+date;
    if(firstOfDay[k]) return {...p, rule:v, fee:0, basis:`同一天已按下单金额收过（${firstOfDay[k]}）`};
    firstOfDay[k]=p.no;
    const gmv=(DB.pfGmv[p.shop]||{})[date]||0, raw=+(gmv*v.rate).toFixed(2), capped=v.cap&&raw>v.cap;
    return {...p, rule:v, gmv, fee:capped?v.cap:raw,
      basis:`当天下单金额 ${money(gmv)} × ${pct(v.rate)} = ${money(raw)}${capped?`，超封顶按 ${money(v.cap)}`:''}`};
  });
}

/* ================= 页面一：自提运费规则 ================= */
PAGES['p-pickfee-rule']=()=>{
  const rows=Object.keys(SHOPS).filter(s=>curRule(s)).map(s=>{
    const v=curRule(s), vers=(DB.pfRules[s]||[]).length;
    return `<tr>
      <td style="white-space:nowrap"><b>${esc(shopName(s))}</b></td>
      <td class="mono">${s}</td>
      <td>${!v||v.mode=='OFF'?'<span class="tag t-gr"><span class="dot"></span>不收费</span>':v.mode=='TRIP'?'<span class="tag t-g"><span class="dot"></span>按次</span>':'<span class="tag t-b"><span class="dot"></span>按下单金额比例</span>'}</td>
      <td>${!v||v.mode=='OFF'?'<span style="color:var(--ts)">—</span>':v.mode=='TRIP'?`<b>${money(v.price)}</b> / 次`:`<b>${pct(v.rate)}</b>`}</td>
      <td>${v&&v.mode=='GMV'?(v.cap?money(v.cap):'不封顶'):'<span style="color:var(--ts)">—</span>'}</td>
      <td style="white-space:nowrap">${v?v.from:'<span style="color:var(--ts)">—</span>'}</td>
      <td>${v?esc(v.by):'<span style="color:var(--ts)">—</span>'}</td>
      <td style="white-space:nowrap"><button class="btn btn-link" onclick="pf_edit('${s}')">修改</button>${vers?` <button class="btn btn-link" onclick="pf_hist('${s}')">变更记录</button>`:''}</td>
    </tr>`;}).join('');
  return `${flowTip('')}
  <div class="card"><div class="card-hd"><h3>自提运费规则</h3><span class="sub">已设置 ${Object.keys(SHOPS).filter(s=>curRule(s)).length} 家店铺 · 未设置的店铺不收运费</span><button class="btn btn-p btn-sm" onclick="pf_edit('')">＋ 新增收费规则</button></div>
    <div class="card-bd flush"><div style="overflow-x:auto"><table>
      <thead><tr><th>店铺名称</th><th>店铺编码</th><th>计费方式</th><th>收费标准</th><th>每日封顶</th><th>生效时间</th><th>修改人</th><th>操作</th></tr></thead>
      <tbody>${rows||'<tr><td colspan="8"><div class="empty" style="padding:26px"><div class="e-ic">🚚</div><div class="e-t">还没有店铺设置自提运费</div><div class="e-s">点右上角「新增收费规则」，选店铺并设置计费方式</div></div></td></tr>'}</tbody></table></div></div></div>`;
};
window.pf_edit=function(s){
  const isNew=!s, free=Object.keys(SHOPS).filter(k=>!curRule(k));
  if(isNew&&!free.length){toast('所有店铺都已设置收费规则','info');return;}
  const v=curRule(s)||{mode:'TRIP', price:80, rate:0.02, cap:''};
  const m=v.mode=='OFF'?'TRIP':v.mode;
  modal(`<div class="mc-hd"><h3>${isNew?'新增收费规则':'修改自提运费 · '+esc(shopName(s))}</h3>${isNew?'':`<p>${s}</p>`}<button class="mc-x" onclick="closeModal()">×</button></div><div class="mc-bd">
    ${isNew?`<div class="fr"><label class="fl"><b>*</b>店铺</label><select id="pf-shop"><option value="">请选择店铺</option>${free.map(k=>`<option value="${k}">${esc(shopName(k))}（${k}）</option>`).join('')}</select></div>`:''}
    <div class="fr"><label class="fl"><b>*</b>计费方式</label>
      <div class="row" style="gap:18px">${(isNew?['TRIP','GMV']:['TRIP','GMV','OFF']).map(k=>`<label style="display:flex;align-items:center;gap:6px;margin:0;cursor:pointer"><input type="radio" name="pf-mode" value="${k}" ${(v.mode||m)==k?'checked':''} onchange="pf_modeSw()">${MODE[k]}</label>`).join('')}</div></div>
    <div id="pf-trip" class="fr" style="display:${(v.mode||m)=='TRIP'?'':'none'}"><label class="fl"><b>*</b>每次金额</label>
      <div class="row" style="gap:6px;align-items:center">$ <input id="pf-price" type="number" step="0.01" min="0.01" value="${v.price||''}" style="max-width:140px"> / 次</div></div>
    <div id="pf-gmv" style="display:${(v.mode||m)=='GMV'?'':'none'}">
      <div class="fr"><label class="fl"><b>*</b>收取比例（取货当天的下单金额）</label>
        <div class="row" style="gap:6px;align-items:center"><input id="pf-rate" type="number" step="0.1" min="0.1" max="100" value="${v.rate?+(v.rate*100).toFixed(2):''}" style="max-width:140px"> %</div></div>
      <div class="fr"><label class="fl">每日封顶金额（不填 = 不封顶）</label>
        <div class="row" style="gap:6px;align-items:center">$ <input id="pf-cap" type="number" step="0.01" min="0.01" value="${v.cap||''}" style="max-width:140px"> / 天</div></div>
    </div>
  </div><div class="mc-ft"><button class="btn btn-o" onclick="closeModal()">取消</button><button class="btn btn-p" onclick="pf_save('${s}')">保存</button></div>`);
};
window.pf_modeSw=function(){
  const m=(document.querySelector('input[name=pf-mode]:checked')||{}).value;
  document.getElementById('pf-trip').style.display=m=='TRIP'?'':'none';
  document.getElementById('pf-gmv').style.display=m=='GMV'?'':'none';
};
window.pf_save=function(s){
  if(!s){ s=(document.getElementById('pf-shop')||{}).value; if(!s){toast('请选择店铺','err');return;} }
  const m=(document.querySelector('input[name=pf-mode]:checked')||{}).value, nv={mode:m};
  if(m=='TRIP'){ const p=parseFloat(document.getElementById('pf-price').value); if(!(p>0)){toast('请填写每次金额（大于 0）','err');return;} nv.price=+p.toFixed(2); }
  if(m=='GMV'){
    const r=parseFloat(document.getElementById('pf-rate').value), c=document.getElementById('pf-cap').value.trim();
    if(!(r>0&&r<=100)){toast('收取比例需在 0–100% 之间','err');return;}
    if(c!==''&&!(parseFloat(c)>0)){toast('每日封顶金额需大于 0，或留空不封顶','err');return;}
    nv.rate=+(r/100).toFixed(4); nv.cap=c===''?'':+parseFloat(c).toFixed(2);
  }
  const old=curRule(s);
  if(old && old.mode==nv.mode && ruleText(old)==ruleText(nv)){toast('规则没有变化','info');return;}
  modal(`<div class="mc-hd"><h3>${old?"确认修改自提运费":"确认新增收费规则"}</h3><button class="mc-x" onclick="closeModal()">×</button></div><div class="mc-bd">
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
  <div class="drawer-bd"><table><thead><tr><th>生效时间</th><th>计费方式</th><th>收费标准</th><th>修改人</th></tr></thead><tbody>
    ${vers.map((v,i)=>`<tr><td class="mono" style="white-space:nowrap">${v.from}${i==0?' <span class="tag t-g" style="font-size:10.5px">当前</span>':''}</td><td>${MODE[v.mode]}</td><td>${ruleText(v)}</td><td>${esc(v.by)}</td></tr>`).join('')}
  </tbody></table></div>
  <div class="drawer-ft"><button class="btn btn-o" onclick="closeDrawer()">关闭</button></div>`);
};

/* ================= 页面二：自提运费账单（取货明细 / 月度账单） ================= */
DB.pfTab = DB.pfTab || 'BILL';
DB.pfFilter = DB.pfFilter || {shop:'', month:'2026-09'};
DB.pfBills = DB.pfBills || {   // 账单处理状态：key = 店铺|月份
  'SH2026062000001|2026-09':{adjNo:'ADJ-SG-20261001-001', invNo:'LOG-INV-2026-000012'},
  'SH2026070200005|2026-09':{adjNo:'ADJ-SG-20261001-002', invNo:''},
};
const CUR_MONTH='2026-10';
const billNo = (s,ym) => `PF-${ym.replace('-','')}-${s.slice(-5)}`;
function billsOf(ym){
  const calc=pfCalc().filter(p=>p.at.startsWith(ym));
  return Object.keys(SHOPS).map(s=>{
    const list=calc.filter(p=>p.shop==s); if(!list.length) return null;
    const st=DB.pfBills[s+'|'+ym]||{};
    return {shop:s, ym, no:billNo(s,ym), list, times:list.length, fee:+list.reduce((a,p)=>a+p.fee,0).toFixed(2), adjNo:st.adjNo||'', invNo:st.invNo||'', open:ym>=CUR_MONTH};
  }).filter(Boolean);
}
const billTag = b => b.open ? '<span class="tag t-gr"><span class="dot"></span>本月进行中</span>'
  : !b.fee ? '<span class="tag t-gr"><span class="dot"></span>无需收费</span>'
  : !b.adjNo ? '<span class="tag t-y"><span class="dot"></span>待生成调整单</span>'
  : '<span class="tag t-g"><span class="dot"></span>已生成调整单</span>';
const invTag = b => b.open||!b.fee||!b.adjNo ? '<span style="color:var(--ts)">—</span>'
  : b.invNo ? `<span class="mono">${b.invNo}</span>` : '<span class="tag t-y"><span class="dot"></span>待开票</span>';

PAGES['p-pickfee-bill']=()=>{
  const f=DB.pfFilter, opt=(v,l)=>`<option value="${v}" ${f.shop==v?'selected':''}>${l}</option>`;
  const hit=s=>!f.shop||f.shop==s;
  const bills=billsOf(f.month).filter(b=>hit(b.shop));
  const picks=pfCalc().filter(p=>p.at.startsWith(f.month)&&hit(p.shop)).reverse();
  const tabs=[['BILL','月度账单',bills.length],['PICK','取货明细',picks.length]];
  return `${flowTip('')}
  <div class="card" style="margin-bottom:14px"><div class="card-bd" style="padding:16px 20px 12px">
    <div class="fg3">
      <div class="fr"><label class="fl">店铺</label><select id="pf-f-shop">${opt('','全部')}${Object.keys(SHOPS).map(s=>opt(s,shopName(s))).join('')}</select></div>
      <div class="fr"><label class="fl">月份</label><input id="pf-f-month" type="month" value="${f.month}"></div>
      <div class="fr"></div>
    </div>
    <div class="row" style="justify-content:flex-end;gap:8px;margin-top:2px">
      <button class="btn btn-o" onclick="DB.pfFilter={shop:'',month:'2026-09'};render()">重置</button>
      <button class="btn btn-p" onclick="DB.pfFilter={shop:document.getElementById('pf-f-shop').value,month:document.getElementById('pf-f-month').value||'2026-09'};render()">查询</button>
    </div>
  </div></div>
  <div class="tabs" style="margin-bottom:14px">${tabs.map(([k,l,n])=>`<div class="tab ${DB.pfTab==k?'active':''}" onclick="DB.pfTab='${k}';render()">${l}${n?`<span class="tb">${n}</span>`:''}</div>`).join('')}</div>
  ${DB.pfTab=='BILL'?billTable(bills):pickTable(picks)}`;
};
function billTable(bills){
  return `<div class="card"><div class="card-bd flush"><div style="overflow-x:auto"><table>
    <thead><tr><th>账单号</th><th>店铺名称</th><th>店铺编码</th><th>月份</th><th style="text-align:right">取货次数</th><th style="text-align:right">运费合计</th><th>状态</th><th>业务调整单</th><th>物流费发票</th><th>操作</th></tr></thead><tbody>
    ${bills.length?bills.map(b=>`<tr>
      <td class="mono" style="white-space:nowrap">${b.no}</td><td style="white-space:nowrap">${esc(shopName(b.shop))}</td><td class="mono">${b.shop}</td><td>${b.ym}</td>
      <td style="text-align:right">${b.times}</td><td style="text-align:right"><b>${money(b.fee)}</b></td>
      <td>${billTag(b)}</td>
      <td>${b.adjNo?`<a class="mono" style="cursor:pointer;color:var(--g)" onclick="nav('p-adjust')">${b.adjNo}</a>`:'<span style="color:var(--ts)">—</span>'}</td>
      <td>${invTag(b)}</td>
      <td style="white-space:nowrap"><button class="btn btn-link" onclick="pf_bill('${b.shop}','${b.ym}')">明细</button>${!b.open&&b.fee&&!b.adjNo?` <button class="btn btn-link" onclick="pf_genAdj('${b.shop}','${b.ym}')">生成调整单</button>`:''}${!b.open&&b.adjNo&&!b.invNo?` <button class="btn btn-link" onclick="pf_inv('${b.shop}','${b.ym}')">开物流费发票</button>`:''}</td>
    </tr>`).join(''):`<tr><td colspan="10"><div class="empty" style="padding:26px"><div class="e-ic">🚚</div><div class="e-t">该月没有取货记录</div></div></td></tr>`}
    </tbody></table></div></div></div>`;
}
function pickTable(picks){
  return `<div class="card">
    <div class="selbar" style="display:flex;align-items:center;gap:10px;padding:10px 16px;background:#F0FBF4;border-bottom:1px solid var(--bd);font-size:13px">
      <span style="flex:1"></span><button class="btn btn-o btn-sm" onclick="pf_import()">导入仓库取货台账</button>
    </div>
    <div class="card-bd flush"><div style="overflow-x:auto">${pickRows(picks,true)}</div></div></div>`;
}
function pickRows(picks,withShop){
  return `<table><thead><tr><th>取货记录号</th>${withShop?'<th>店铺名称</th>':''}<th>取货时间</th><th>取货地点</th><th>司机</th><th>数据来源</th><th>计费方式</th><th>计费说明</th><th style="text-align:right">运费</th></tr></thead><tbody>
    ${picks.length?picks.map(p=>`<tr>
      <td class="mono" style="white-space:nowrap">${p.no}</td>${withShop?`<td style="white-space:nowrap">${esc(shopName(p.shop))}</td>`:''}
      <td class="mono" style="white-space:nowrap">${p.at}</td><td style="white-space:nowrap">${p.market}</td><td>${esc(p.driver)}</td><td style="white-space:nowrap">${p.src}</td>
      <td style="white-space:nowrap">${MODE[(p.rule||{}).mode||'OFF']}</td><td style="font-size:12.5px;color:var(--ts)">${p.basis}</td>
      <td style="text-align:right">${p.fee?`<b>${money(p.fee)}</b>`:money(0)}</td></tr>`).join('')
    :`<tr><td colspan="${withShop?9:8}"><div class="empty" style="padding:26px"><div class="e-ic">🚚</div><div class="e-t">没有取货记录</div></div></td></tr>`}
  </tbody></table>`;
}
const billOf = (s,ym) => billsOf(ym).find(b=>b.shop==s);
window.pf_bill=function(s,ym){
  const b=billOf(s,ym);
  drawer(`<div class="drawer-hd"><div><h3>自提运费账单 <span class="mono" style="font-size:12.5px;color:var(--ts)">${b.no}</span></h3><div style="margin-top:4px">${billTag(b)}</div></div><span class="x" onclick="closeDrawer()">×</span></div>
  <div class="drawer-bd">
    <div class="kv" style="margin-bottom:16px">
      <div><div class="k">店铺</div><div class="v">${esc(shopName(s))}（${s}）</div></div><div><div class="k">月份</div><div class="v">${ym}</div></div>
      <div><div class="k">取货次数</div><div class="v">${b.times}</div></div><div><div class="k">运费合计</div><div class="v">${money(b.fee)}</div></div>
      <div><div class="k">业务调整单</div><div class="v">${b.adjNo||'—'}</div></div><div><div class="k">物流费发票</div><div class="v">${b.invNo||'—'}</div></div>
    </div>
    ${pickRows(b.list.slice().reverse(),false)}
  </div>
  <div class="drawer-ft"><button class="btn btn-o" onclick="closeDrawer()">关闭</button>${!b.open&&b.fee&&!b.adjNo?`<button class="btn btn-p" onclick="closeDrawer();pf_genAdj('${s}','${ym}')">生成调整单</button>`:''}${!b.open&&b.adjNo&&!b.invNo?`<button class="btn btn-p" onclick="closeDrawer();pf_inv('${s}','${ym}')">开物流费发票</button>`:''}</div>`);
};
window.pf_genAdj=function(s,ym){
  const b=billOf(s,ym);
  modal(`<div class="mc-hd"><h3>生成自提运费调整单</h3><button class="mc-x" onclick="closeModal()">×</button></div><div class="mc-bd">
    <table class="subtbl"><tbody>
      <tr><td style="color:var(--ts);width:90px">店铺</td><td>${esc(shopName(s))}</td></tr>
      <tr><td style="color:var(--ts)">账单</td><td class="mono">${b.no}（${ym}，取货 ${b.times} 次）</td></tr>
      <tr><td style="color:var(--ts)">调整类型</td><td>自提运费 · 负向 · 账扣</td></tr>
      <tr><td style="color:var(--ts)">金额</td><td><b style="color:var(--r)">-${money(b.fee)}</b></td></tr>
    </tbody></table>
    <div class="ib ib-b" style="margin-top:12px"><span class="i">ℹ️</span>生成后在「业务调整单」里为待推送状态，推送后从商家货款中扣除。</div>
  </div><div class="mc-ft"><button class="btn btn-o" onclick="closeModal()">取消</button><button class="btn btn-p" onclick="pf_genAdjDo('${s}','${ym}')">确认生成</button></div>`);
};
window.pf_genAdjDo=function(s,ym){
  const b=billOf(s,ym), d=ts().slice(0,10).replace(/-/g,'');
  const n=(DB.adjOrders||[]).filter(r=>r.adjustNo.includes(d)).length+1;
  const no=`ADJ-SG-${d}-${String(n).padStart(3,'0')}`;
  (DB.adjOrders=DB.adjOrders||[]).unshift({adjustNo:no, shopCode:s, merchantCode:SHOPS[s].merchant,
    adjustTypeCode:'ADJT-0011', adjustTypeName:'自提运费', amount:b.fee, currency:'SGD',
    deductionType:'ACCOUNT', invoiceCategory:'', originalInvoiceNo:'', taxRate:null, amountExclTax:b.fee, gstAmount:0,
    bizNo:b.no, remark:`${ym} 自提运费，取货 ${b.times} 次`, effectiveTime:ts(), createdBy:'当前账号',
    sourceType:'MANUAL', status:'effective', voidReason:'', pushStatus:'PENDING', syncStatus:'', syncErrorText:'', pushedAt:'', pushedBy:''});
  if(DB.adjLogs) DB.adjLogs[no]=[{t:ts(),u:'当前账号',c:`由自提运费账单 ${b.no} 生成`}];
  (DB.pfBills[s+'|'+ym]=DB.pfBills[s+'|'+ym]||{}).adjNo=no;
  closeModal(); render(); toast(`已生成调整单 ${no}`,'ok');
};
window.pf_inv=function(s,ym){
  const b=billOf(s,ym);
  modal(`<div class="mc-hd"><h3>开具物流费发票</h3><button class="mc-x" onclick="closeModal()">×</button></div><div class="mc-bd">
    <table class="subtbl"><tbody>
      <tr><td style="color:var(--ts);width:90px">购方</td><td>${esc(shopName(s))}（${s}）</td></tr>
      <tr><td style="color:var(--ts)">开票内容</td><td>物流费 · ${ym} 自提运费</td></tr>
      <tr><td style="color:var(--ts)">开票金额</td><td><b>${money(b.fee)}</b></td></tr>
      <tr><td style="color:var(--ts)">关联</td><td class="mono">${b.no} / ${b.adjNo}</td></tr>
    </tbody></table>
    <div class="ib ib-gr" style="margin-top:12px"><span class="i">ℹ️</span>物流费发票单独开具，不和服务费、佣金合开。</div>
  </div><div class="mc-ft"><button class="btn btn-o" onclick="closeModal()">取消</button><button class="btn btn-p" onclick="pf_invDo('${s}','${ym}')">确认开票</button></div>`);
};
window.pf_invDo=function(s,ym){
  const n=Object.values(DB.pfBills).filter(x=>x.invNo).length+12;
  DB.pfBills[s+'|'+ym].invNo=`LOG-INV-2026-${String(n+1).padStart(6,'0')}`;
  closeModal(); render(); toast('物流费发票已开具','ok');
};
window.pf_import=function(){
  modal(`<div class="mc-hd"><h3>导入仓库取货台账</h3><button class="mc-x" onclick="closeModal()">×</button></div><div class="mc-bd">
    <div class="up" onclick="toast('演示：已选择 取货台账_2026-10.xlsx','info')"><div class="uic">📄</div><div class="ut">选择 Excel 文件</div><div class="us">列：店铺编码 / 取货时间 / 取货地点 / 司机；同一店铺同一取货时间重复的行自动跳过</div></div>
    <div class="row" style="margin-top:10px"><button class="btn btn-link" onclick="toast('演示：模板已下载','info')">下载导入模板</button></div>
  </div><div class="mc-ft"><button class="btn btn-o" onclick="closeModal()">取消</button><button class="btn btn-p" onclick="closeModal();toast('演示：导入 0 条，跳过重复 0 条','info')">开始导入</button></div>`);
};

})();
