/* PC · 店铺运营平台 —— 自提运费（平台去批发市场取商家的货，按店铺收运费）
   ▍需求来源：2026-10-12「自提收费」会议 + 沈亮拍板口径（PRD 待写，规则以后续 PRD 为准，本文件只做交互演示）
   ▍拍板口径：
   - 收费规则由平台按店铺指定（商家不能自选）；未设置的店铺不收运费。
   - 两种计费方式，一家店铺同一时间只用一种：
       按次：每取一次货收一次固定金额（每家店铺单独计次，不做拼车分摊）；
       按下单金额比例：有取货的那天，当天下单金额 × 比例；可设「每日封顶」，超过按封顶收。
   - 改规则下一次生效：保存时刻之后的取货按新规则算，之前已取的货不重算。
   - 每月汇总出账单，账单直接「推送财务结算」，在结算时从商家货款里扣（不走业务调整单）；发票单独开「物流费发票」，不和服务费/佣金合开。
   - 商家端（2026-10-27）：财务 › 自提运费（m-pickfee），只读看本店规则/月度账单/取货明细，可下载物流费发票；App 同口径（v2/pickfee.js）。
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


/* ================= 页面二：自提运费账单（月度账单 / 取货明细） ================= */
DB.pfTab = DB.pfTab || 'BILL';
DB.pfFilter = DB.pfFilter || {shop:'', month:'2026-09'};
DB.pfSel = DB.pfSel || [];
DB.pfBills = DB.pfBills || {   // 账单推送/开票状态：key = 店铺|月份
  'SH2026062000001|2026-09':{pushedAt:'2026-10-02 10:15', pushedBy:'林凯', invNo:'LOG-INV-2026-000012'},
  'SH2026070200005|2026-09':{pushedAt:'2026-10-02 10:16', pushedBy:'林凯', invNo:''},
};
const CUR_MONTH='2026-10';
const billNo = (s,ym) => `PF-${ym.replace('-','')}-${s.slice(-5)}`;
function billsOf(ym){
  const calc=pfCalc().filter(p=>p.at.startsWith(ym));
  return Object.keys(SHOPS).map(s=>{
    const list=calc.filter(p=>p.shop==s); if(!list.length) return null;
    const st=DB.pfBills[s+'|'+ym]||{};
    return {shop:s, ym, no:billNo(s,ym), list, times:list.length, fee:+list.reduce((a,p)=>a+p.fee,0).toFixed(2),
      pushedAt:st.pushedAt||'', pushedBy:st.pushedBy||'', invNo:st.invNo||'', open:ym>=CUR_MONTH};
  }).filter(Boolean);
}
const canPush = b => !b.open && b.fee>0 && !b.pushedAt;
const billTag = b => b.open ? '<span class="tag t-gr"><span class="dot"></span>本月进行中</span>'
  : !b.fee ? '<span class="tag t-gr"><span class="dot"></span>无需收费</span>'
  : !b.pushedAt ? '<span class="tag t-y"><span class="dot"></span>待推送</span>'
  : '<span class="tag t-g"><span class="dot"></span>已推送</span>';
const invTag = b => !b.pushedAt ? '<span style="color:var(--ts)">—</span>'
  : b.invNo ? `<span class="mono">${b.invNo}</span>` : '<span class="tag t-y"><span class="dot"></span>待开票</span>';
const dash = '<span style="color:var(--ts)">—</span>';

PAGES['p-pickfee-bill']=()=>{
  const f=DB.pfFilter, opt=(v,l)=>`<option value="${v}" ${f.shop==v?'selected':''}>${l}</option>`;
  const hit=s=>!f.shop||f.shop==s;
  const bills=billsOf(f.month).filter(b=>hit(b.shop));
  const picks=pfCalc().filter(p=>p.at.startsWith(f.month)&&hit(p.shop)).reverse();
  DB.pfSel=DB.pfSel.filter(no=>bills.some(b=>b.no==no&&canPush(b)));
  const tabs=[['BILL','月度账单',bills.length],['PICK','取货明细',picks.length]];
  return `${flowTip('')}
  <div class="card" style="margin-bottom:14px"><div class="card-bd" style="padding:16px 20px 12px">
    <div class="fg3">
      <div class="fr"><label class="fl">店铺</label><select id="pf-f-shop">${opt('','全部')}${Object.keys(SHOPS).map(s=>opt(s,shopName(s))).join('')}</select></div>
      <div class="fr"><label class="fl">月份</label><input id="pf-f-month" type="month" value="${f.month}"></div>
      <div class="fr"></div>
    </div>
    <div class="row" style="justify-content:flex-end;gap:8px;margin-top:2px">
      <button class="btn btn-o" onclick="DB.pfFilter={shop:'',month:'2026-09'};DB.pfSel=[];render()">重置</button>
      <button class="btn btn-p" onclick="DB.pfFilter={shop:document.getElementById('pf-f-shop').value,month:document.getElementById('pf-f-month').value||'2026-09'};DB.pfSel=[];render()">查询</button>
    </div>
  </div></div>
  <div class="tabs" style="margin-bottom:14px">${tabs.map(([k,l,n])=>`<div class="tab ${DB.pfTab==k?'active':''}" onclick="DB.pfTab='${k}';render()">${l}${n?`<span class="tb">${n}</span>`:''}</div>`).join('')}</div>
  ${DB.pfTab=='BILL'?billTable(bills):pickTable(picks)}`;
};
function billTable(bills){
  const sel=bills.filter(canPush), all=sel.length&&sel.every(b=>DB.pfSel.includes(b.no));
  return `<div class="card">
    <div class="selbar" style="display:flex;align-items:center;gap:10px;padding:10px 16px;background:#F0FBF4;border-bottom:1px solid var(--bd);font-size:13px">
      <span style="color:var(--ts)">已选 <b style="color:var(--tp)">${DB.pfSel.length}</b> 张</span><span style="flex:1"></span>
      <button class="btn btn-p btn-sm" ${DB.pfSel.length?'':'disabled'} onclick="pf_push(DB.pfSel.slice())">推送财务结算</button>
    </div>
    <div class="card-bd flush"><div style="overflow-x:auto"><table>
    <thead><tr><th style="width:34px"><input type="checkbox" class="skuchk" title="全选待推送" ${all?'checked':''} ${sel.length?'':'disabled'} onclick="pf_selAll()"></th><th>账单号</th><th>店铺名称</th><th>店铺编码</th><th>月份</th><th style="text-align:right">取货次数</th><th style="text-align:right">运费合计</th><th>状态</th><th>推送人</th><th>推送时间</th><th>物流费发票</th><th>操作</th></tr></thead><tbody>
    ${bills.length?bills.map(b=>`<tr>
      <td>${canPush(b)?`<input type="checkbox" class="skuchk" ${DB.pfSel.includes(b.no)?'checked':''} onclick="pf_toggle('${b.no}')">`:''}</td>
      <td class="mono" style="white-space:nowrap">${b.no}</td><td style="white-space:nowrap">${esc(shopName(b.shop))}</td><td class="mono">${b.shop}</td><td>${b.ym}</td>
      <td style="text-align:right">${b.times}</td><td style="text-align:right"><b>${money(b.fee)}</b></td>
      <td>${billTag(b)}</td><td>${b.pushedBy?esc(b.pushedBy):dash}</td><td style="white-space:nowrap">${b.pushedAt||dash}</td>
      <td>${invTag(b)}</td>
      <td style="white-space:nowrap"><button class="btn btn-link" onclick="pf_bill('${b.shop}','${b.ym}')">明细</button>${canPush(b)?` <button class="btn btn-link" onclick="pf_push(['${b.no}'])">推送</button>`:''}${b.pushedAt&&!b.invNo?` <button class="btn btn-link" onclick="pf_inv('${b.shop}','${b.ym}')">开物流费发票</button>`:''}</td>
    </tr>`).join(''):`<tr><td colspan="12"><div class="empty" style="padding:26px"><div class="e-ic">🚚</div><div class="e-t">该月没有取货记录</div></div></td></tr>`}
    </tbody></table></div></div></div>`;
}
window.pf_toggle=function(no){ const i=DB.pfSel.indexOf(no); i<0?DB.pfSel.push(no):DB.pfSel.splice(i,1); render(); };
window.pf_selAll=function(){
  const f=DB.pfFilter, ok=billsOf(f.month).filter(b=>(!f.shop||f.shop==b.shop)&&canPush(b)).map(b=>b.no);
  DB.pfSel = ok.every(no=>DB.pfSel.includes(no)) ? [] : ok; render();
};
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
const billByNo = no => { const f=DB.pfFilter; return billsOf(f.month).find(b=>b.no==no); };
window.pf_bill=function(s,ym){
  const b=billOf(s,ym);
  drawer(`<div class="drawer-hd"><div><h3>自提运费账单 <span class="mono" style="font-size:12.5px;color:var(--ts)">${b.no}</span></h3><div style="margin-top:4px">${billTag(b)}</div></div><span class="x" onclick="closeDrawer()">×</span></div>
  <div class="drawer-bd">
    <div class="kv" style="margin-bottom:16px">
      <div><div class="k">店铺</div><div class="v">${esc(shopName(s))}（${s}）</div></div><div><div class="k">月份</div><div class="v">${ym}</div></div>
      <div><div class="k">取货次数</div><div class="v">${b.times}</div></div><div><div class="k">运费合计</div><div class="v">${money(b.fee)}</div></div>
      <div><div class="k">推送人 / 推送时间</div><div class="v">${b.pushedAt?esc(b.pushedBy)+' · '+b.pushedAt:'—'}</div></div><div><div class="k">物流费发票</div><div class="v">${b.invNo||'—'}</div></div>
    </div>
    ${pickRows(b.list.slice().reverse(),false)}
  </div>
  <div class="drawer-ft"><button class="btn btn-o" onclick="closeDrawer()">关闭</button>${canPush(b)?`<button class="btn btn-p" onclick="closeDrawer();pf_push(['${b.no}'])">推送财务结算</button>`:''}${b.pushedAt&&!b.invNo?`<button class="btn btn-p" onclick="closeDrawer();pf_inv('${s}','${ym}')">开物流费发票</button>`:''}</div>`);
};
window.pf_push=function(nos){
  const list=nos.map(billByNo).filter(b=>b&&canPush(b));
  if(!list.length){toast('请选择待推送的账单','err');return;}
  const total=+list.reduce((a,b)=>a+b.fee,0).toFixed(2);
  modal(`<div class="mc-hd"><h3>推送财务结算</h3><button class="mc-x" onclick="closeModal()">×</button></div><div class="mc-bd">
    <table class="subtbl"><thead><tr><th>账单号</th><th>店铺</th><th style="text-align:right">运费合计</th></tr></thead><tbody>
      ${list.map(b=>`<tr><td class="mono">${b.no}</td><td>${esc(shopName(b.shop))}</td><td style="text-align:right">${money(b.fee)}</td></tr>`).join('')}
    </tbody></table>
    <div class="ib ib-y" style="margin-top:12px"><span class="i">⚠️</span>共 <b>${list.length}</b> 张、<b>${money(total)}</b>。推送后在结算时从商家货款中扣除，账单不能再修改。</div>
  </div><div class="mc-ft"><button class="btn btn-o" onclick="closeModal()">取消</button><button class="btn btn-p" onclick='pf_pushDo(${JSON.stringify(list.map(b=>b.no))})'>确认推送</button></div>`);
};
window.pf_pushDo=function(nos){
  nos.map(billByNo).filter(Boolean).forEach(b=>{ Object.assign(DB.pfBills[b.shop+'|'+b.ym]=DB.pfBills[b.shop+'|'+b.ym]||{}, {pushedAt:ts(), pushedBy:'当前账号'}); });
  DB.pfSel=[]; closeModal(); render(); toast(`已推送 ${nos.length} 张账单到财务结算`,'ok');
};
window.pf_inv=function(s,ym){
  const b=billOf(s,ym);
  modal(`<div class="mc-hd"><h3>开具物流费发票</h3><button class="mc-x" onclick="closeModal()">×</button></div><div class="mc-bd">
    <table class="subtbl"><tbody>
      <tr><td style="color:var(--ts);width:90px">购方</td><td>${esc(shopName(s))}（${s}）</td></tr>
      <tr><td style="color:var(--ts)">开票内容</td><td>物流费 · ${ym} 自提运费</td></tr>
      <tr><td style="color:var(--ts)">开票金额</td><td><b>${money(b.fee)}</b></td></tr>
      <tr><td style="color:var(--ts)">关联账单</td><td class="mono">${b.no}</td></tr>
    </tbody></table>
    <div class="ib ib-gr" style="margin-top:12px"><span class="i">ℹ️</span>物流费发票单独开具，不和服务费、佣金合开。</div>
  </div><div class="mc-ft"><button class="btn btn-o" onclick="closeModal()">取消</button><button class="btn btn-p" onclick="pf_invDo('${s}','${ym}')">确认开票</button></div>`);
};
window.pf_invDo=function(s,ym){
  const n=Object.values(DB.pfBills).filter(x=>x.invNo).length+12;
  DB.pfBills[s+'|'+ym].invNo=`LOG-INV-2026-${String(n+1).padStart(6,'0')}`;
  closeModal(); render(); toast('物流费发票已开具','ok');
};

/* ================= 商家端：财务 › 自提运费（m-pickfee，只读） =================
   - 只看本商家的店铺；店铺从没设置过收费规则 → 不显示菜单
   - 账单、取货明细、运费与运营端同一份计算（pfCalc），不另算
   - 状态换成商家能懂的说法：待推送 → 待出账；已推送 → 已出账（结算时从货款扣）
   - 不显示内部信息：推送人、规则修改人、取货数据来源 */
const myShop = () => Object.keys(SHOPS).find(s=>SHOPS[s].merchant==DB.merchant.code) || '';
window.pfMerchantOn = () => { const s=myShop(); return !!(s && (DB.pfRules[s]||[]).length); };
const mBillTag = b => b.open ? '<span class="tag t-gr"><span class="dot"></span>本月进行中</span>'
  : !b.fee ? '<span class="tag t-gr"><span class="dot"></span>无需收费</span>'
  : !b.pushedAt ? '<span class="tag t-y"><span class="dot"></span>待出账</span>'
  : '<span class="tag t-g"><span class="dot"></span>已出账</span>';
const mInvTag = b => !b.pushedAt ? dash
  : b.invNo ? `<span class="mono">${b.invNo}</span>` : '<span class="tag t-y"><span class="dot"></span>待开票</span>';
const myMonths = s => [...new Set(DB.pfPickups.filter(p=>p.shop==s).map(p=>p.at.slice(0,7)))].sort().reverse();
DB.pfMTab = DB.pfMTab || 'BILL';
DB.pfMMonth = DB.pfMMonth || '';

PAGES['m-pickfee']=()=>{
  const s=myShop(), v=curRule(s);
  if(!pfMerchantOn()) return `<div class="card"><div class="card-bd"><div class="empty"><div class="e-ic">🚚</div><div class="e-t">未开通自提运费</div><div class="e-s">平台没有为您的店铺设置自提运费，取货不收费</div></div></div></div>`;
  const ym=DB.pfMMonth, months=myMonths(s);
  const bills=(ym?[ym]:months).map(m=>billsOf(m).find(b=>b.shop==s)).filter(Boolean);
  const picks=pfCalc().filter(p=>p.shop==s&&(!ym||p.at.startsWith(ym))).reverse();
  const kv=(k,val)=>`<div><div class="k">${k}</div><div class="v">${val}</div></div>`;
  const tabs=[['BILL','月度账单',bills.length],['PICK','取货明细',picks.length]];
  return `<div class="card" style="margin-bottom:14px"><div class="card-hd"><h3>当前收费规则</h3><span class="sub">平台去批发市场帮您取货收的运费；每月出账单，结算时从货款中扣除</span><button class="btn btn-o btn-sm" onclick="pf_mHist()">变更记录</button></div>
    <div class="card-bd"><div class="kv">
      ${kv('店铺',`${esc(shopName(s))}（<span class="mono">${s}</span>）`)}
      ${kv('计费方式',MODE[v.mode])}
      ${kv('收费标准',v.mode=='OFF'?'—':v.mode=='TRIP'?`${money(v.price)} / 次`:`取货当天下单金额 × ${pct(v.rate)}`)}
      ${v.mode=='GMV'?kv('每日封顶',v.cap?money(v.cap):'不封顶'):''}
      ${kv('生效时间',v.from)}
    </div></div></div>
  <div class="card" style="margin-bottom:14px"><div class="card-bd" style="display:flex;gap:16px;align-items:flex-end;flex-wrap:wrap;padding:14px 16px">
    <div><div style="font-size:12px;color:var(--ts);margin-bottom:5px">月份</div><select id="pf-m-month" style="min-width:140px"><option value="">全部</option>${months.map(m=>`<option ${ym==m?'selected':''}>${m}</option>`).join('')}</select></div>
    <button class="btn btn-p btn-sm" onclick="DB.pfMMonth=document.getElementById('pf-m-month').value;render()">查询</button><button class="btn btn-o btn-sm" onclick="DB.pfMMonth='';render()">重置</button>
  </div></div>
  <div class="tabs" style="margin-bottom:14px">${tabs.map(([k,l,n])=>`<div class="tab ${DB.pfMTab==k?'active':''}" onclick="DB.pfMTab='${k}';render()">${l}${n?`<span class="tb">${n}</span>`:''}</div>`).join('')}</div>
  ${DB.pfMTab=='BILL'?mBillTable(bills):`<div class="card"><div class="card-bd flush"><div style="overflow-x:auto">${mPickRows(picks)}</div></div></div>`}`;
};
function mBillTable(bills){
  return `<div class="card"><div class="card-bd flush"><div style="overflow-x:auto"><table>
    <thead><tr><th>账单号</th><th>月份</th><th style="text-align:right">取货次数</th><th style="text-align:right">运费合计</th><th>账单状态</th><th>出账时间</th><th>物流费发票</th><th>操作</th></tr></thead><tbody>
    ${bills.length?bills.map(b=>`<tr>
      <td class="mono" style="white-space:nowrap">${b.no}</td><td>${b.ym}</td>
      <td style="text-align:right">${b.times}</td><td style="text-align:right"><b>${money(b.fee)}</b></td>
      <td>${mBillTag(b)}</td><td style="white-space:nowrap">${b.pushedAt||dash}</td><td>${mInvTag(b)}</td>
      <td style="white-space:nowrap"><button class="btn btn-link" onclick="pf_mBill('${b.ym}')">明细</button>${b.invNo?` <button class="btn btn-link" onclick="toast('演示：已下载 ${b.invNo}.pdf','info')">下载发票</button>`:''}</td>
    </tr>`).join(''):`<tr><td colspan="8"><div class="empty" style="padding:26px"><div class="e-ic">🚚</div><div class="e-t">该月没有取货记录</div></div></td></tr>`}
    </tbody></table></div></div></div>`;
}
function mPickRows(picks){
  return `<table><thead><tr><th>取货记录号</th><th>取货时间</th><th>取货地点</th><th>司机</th><th>计费方式</th><th>计费说明</th><th style="text-align:right">运费</th></tr></thead><tbody>
    ${picks.length?picks.map(p=>`<tr>
      <td class="mono" style="white-space:nowrap">${p.no}</td><td class="mono" style="white-space:nowrap">${p.at}</td>
      <td style="white-space:nowrap">${p.market}</td><td>${esc(p.driver)}</td>
      <td style="white-space:nowrap">${MODE[(p.rule||{}).mode||'OFF']}</td><td style="font-size:12.5px;color:var(--ts)">${p.basis}</td>
      <td style="text-align:right">${p.fee?`<b>${money(p.fee)}</b>`:money(0)}</td></tr>`).join('')
    :`<tr><td colspan="7"><div class="empty" style="padding:26px"><div class="e-ic">🚚</div><div class="e-t">没有取货记录</div></div></td></tr>`}
  </tbody></table>`;
}
window.pf_mBill=function(ym){
  const s=myShop(), b=billOf(s,ym); if(!b) return;
  const kv=(k,val)=>`<div><div class="k">${k}</div><div class="v">${val}</div></div>`;
  drawer(`<div class="drawer-hd"><div><h3>自提运费账单 <span class="mono" style="font-size:12.5px;color:var(--ts)">${b.no}</span></h3><div style="margin-top:4px">${mBillTag(b)}</div></div><span class="x" onclick="closeDrawer()">×</span></div>
  <div class="drawer-bd">
    <div class="kv" style="margin-bottom:16px">
      ${kv('月份',ym)}${kv('取货次数',b.times)}${kv('运费合计',money(b.fee))}
      ${kv('出账时间',b.pushedAt||'—')}${kv('扣款方式',b.pushedAt?'结算时从货款中扣除':'—')}${kv('物流费发票',b.invNo?`<span class="mono">${b.invNo}</span>`:b.pushedAt?'待开票':'—')}
    </div>
    ${mPickRows(b.list.slice().reverse())}
  </div>
  <div class="drawer-ft">${b.invNo?`<button class="btn btn-o" onclick="toast('演示：已下载 ${b.invNo}.pdf','info')">下载发票</button>`:''}<button class="btn btn-p" onclick="closeDrawer()">关闭</button></div>`);
};
window.pf_mHist=function(){
  const s=myShop(), vers=(DB.pfRules[s]||[]).slice().reverse();
  drawer(`<div class="drawer-hd"><h3>收费规则变更记录</h3><span class="x" onclick="closeDrawer()">×</span></div>
  <div class="drawer-bd"><table><thead><tr><th>生效时间</th><th>计费方式</th><th>收费标准</th></tr></thead><tbody>
    ${vers.map((v,i)=>`<tr><td class="mono" style="white-space:nowrap">${v.from}${i==0?' <span class="tag t-g" style="font-size:10.5px">当前</span>':''}</td><td>${MODE[v.mode]}</td><td>${ruleText(v)}</td></tr>`).join('')}
  </tbody></table></div>
  <div class="drawer-ft"><button class="btn btn-o" onclick="closeDrawer()">关闭</button></div>`);
};
window.pf_import=function(){
  modal(`<div class="mc-hd"><h3>导入仓库取货台账</h3><button class="mc-x" onclick="closeModal()">×</button></div><div class="mc-bd">
    <div class="up" onclick="toast('演示：已选择 取货台账_2026-10.xlsx','info')"><div class="uic">📄</div><div class="ut">选择 Excel 文件</div><div class="us">列：店铺编码 / 取货时间 / 取货地点 / 司机；同一店铺同一取货时间重复的行自动跳过</div></div>
    <div class="row" style="margin-top:10px"><button class="btn btn-link" onclick="toast('演示：模板已下载','info')">下载导入模板</button></div>
  </div><div class="mc-ft"><button class="btn btn-o" onclick="closeModal()">取消</button><button class="btn btn-p" onclick="closeModal();toast('演示：导入 0 条，跳过重复 0 条','info')">开始导入</button></div>`);
};

})();
