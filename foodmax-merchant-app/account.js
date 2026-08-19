/* Food Max 商家端 v2 · 收款账户（Airwallex 空中云汇 · Embedded Onboarding 组件）
   入口：底部「账户」Tab（一级，主入口）+「我的 → 账号管理」（二级，兜底）。三态与 PC 端账户管理页口径完全一致
   (scm_商家管理系统_全流程_交互原型.html · PAGES['m-account'] / awxStatusCard)：
     未开通 none / CREATED            → 说明 + 备料清单 + 「开通收款账户」
     认证中 SUBMITTED / ACTION_REQUIRED → 审核进度 / 补件待办
     已开通 ACTIVE                     → 账户信息
     异常   FAILURE / SUSPENDED        → 原因 + 重新提交 / 联系客服
   BR-02 一主体最多 1 个 connected account，重复进入走幂等；BR-05 token 1 小时过期由前端静默重授权重挂载；
   BR-07 状态以 Airwallex webhook 为准，组件 success 只用于跳转；BR-08 未开通不限制接单发货；
   BR-09 country 跟随 site 且须在可开户清单内；BR-10 locale 跟随 App 语言，注册国不支持时降级 en。
   App 特有：Airwallex 组件是 Web iframe，App 内用 WebView 承载；证件拍照需相机权限。前缀 aw- */
(function(){
const {pushPage,popPage,toast,confirmDialog,svg}=window.FM;

const css=document.createElement('style');
css.textContent=`
.aw-hd{padding:14px 20px 6px;}
.aw-hd .t{font-size:26px;font-weight:700;color:var(--ink);}
.aw-hero{margin:14px 16px 0;border-radius:20px;padding:20px 18px;background:#fff;box-shadow:var(--sh-sm);}
.aw-hero .st{display:inline-flex;align-items:center;gap:6px;font-size:12.5px;font-weight:700;padding:5px 11px;border-radius:20px;}
.aw-hero .st .dot{width:6px;height:6px;border-radius:50%;background:currentColor;}
.aw-hero .st.ok{background:var(--mint-soft);color:var(--emerald);}
.aw-hero .st.wait{background:var(--amber-soft);color:var(--amber);}
.aw-hero .st.err{background:var(--red-soft);color:var(--red);}
.aw-hero .st.off{background:var(--muted);color:var(--sub);}
.aw-hero .tt{font-size:20px;font-weight:700;margin:12px 0 6px;color:var(--ink);}
.aw-hero .ds{font-size:13.5px;color:var(--sub);line-height:1.75;}
.aw-hero .ds b{color:var(--ink);font-weight:700;}
.aw-list{background:#fff;border-radius:18px;margin:13px 16px 0;box-shadow:var(--sh-sm);overflow:hidden;}
.aw-it{display:flex;align-items:center;gap:10px;padding:0 16px;min-height:52px;border-top:1px solid var(--line);}
.aw-list .aw-it:first-child{border-top:none;}
.aw-it .k{font-size:14.5px;color:#27433A;font-weight:600;flex:0 0 auto;}
.aw-it .v{flex:1;text-align:right;font-size:14.5px;color:var(--ink);}
.aw-it .v.mono{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:13.5px;}
.aw-sec{font-size:16px;font-weight:700;margin:20px 20px 0;padding-left:11px;position:relative;color:var(--ink);}
.aw-sec::before{content:"";position:absolute;left:0;top:3px;bottom:3px;width:4px;border-radius:3px;background:var(--emerald);}
.aw-sub{font-size:12.5px;color:var(--sub);margin:6px 20px 0;line-height:1.6;}
/* 主体类型切换 */
.aw-tabs{display:flex;gap:8px;overflow-x:auto;padding:12px 16px 0;-webkit-overflow-scrolling:touch;}
.aw-tab{flex:0 0 auto;font-size:13px;font-weight:600;padding:9px 14px;border-radius:20px;background:#fff;color:var(--sub);border:1px solid var(--line);min-height:44px;display:flex;align-items:center;cursor:pointer;white-space:nowrap;}
.aw-tab.on{background:var(--emerald);color:#fff;border-color:var(--emerald);}
/* 备料清单 */
.aw-doc{display:flex;gap:11px;padding:13px 16px;border-top:1px solid var(--line);}
.aw-doc:first-child{border-top:none;}
.aw-doc .bul{width:20px;height:20px;flex:0 0 20px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;margin-top:1px;}
.aw-doc .bul.req{background:var(--mint-soft);color:var(--emerald);}
.aw-doc .bul.no{background:var(--muted);color:#B6C8BF;}
.aw-doc .tx{flex:1;font-size:14px;color:var(--ink);line-height:1.6;}
.aw-doc .tx .nt{display:block;font-size:12.5px;color:var(--sub);margin-top:2px;}
.aw-doc.off .tx{color:#B6C8BF;}
/* 补件项 */
.aw-rfi{background:#fff;border-radius:16px;margin:12px 16px 0;padding:15px 16px;box-shadow:var(--sh-sm);}
.aw-rfi .q{font-size:14.5px;font-weight:600;color:var(--ink);line-height:1.6;}
.aw-rfi .up{margin-top:12px;display:flex;gap:10px;align-items:center;}
.aw-rfi .upb{min-height:44px;padding:0 15px;border-radius:12px;border:1.5px dashed #BFD8CD;background:var(--muted);color:var(--sub);font-size:13.5px;display:flex;align-items:center;gap:7px;cursor:pointer;}
.aw-rfi .upb svg{width:17px;height:17px;stroke:#90A79C;fill:none;stroke-width:1.8;}
.aw-rfi .fin{width:100%;box-sizing:border-box;height:44px;border:1px solid var(--line);border-radius:12px;padding:0 12px;font-size:14.5px;color:var(--ink);background:#fff;font-family:inherit;margin-top:10px;}
/* Airwallex 组件容器（WebView 承载，外部品牌色与站内翡翠绿明显区隔） */
.aw-wv{margin:13px 16px 0;border-radius:18px;overflow:hidden;background:#fff;box-shadow:var(--sh-sm);border:1px solid var(--line);}
.aw-wv .bar{background:rgba(97,47,255,.06);border-bottom:1px solid var(--line);padding:10px 15px;font-size:12px;color:var(--sub);line-height:1.6;}
.aw-wv .bar .sq{display:inline-block;width:8px;height:8px;border-radius:2px;background:#612FFF;margin-right:8px;vertical-align:-1px;}
.aw-wv .bd{padding:16px 15px 18px;}
.aw-stp{display:flex;gap:6px;margin-bottom:18px;}
.aw-stp i{flex:1;height:4px;border-radius:3px;background:var(--line);font-style:normal;}
.aw-stp i.on{background:#612FFF;}
.aw-stp-t{font-size:15.5px;font-weight:700;color:var(--ink);margin-bottom:4px;}
.aw-stp-s{font-size:12.5px;color:var(--sub);margin-bottom:16px;}
.aw-f{margin-bottom:14px;}
.aw-f .fk{font-size:13px;color:var(--sub);margin-bottom:6px;}
.aw-f .fin{width:100%;box-sizing:border-box;height:46px;border:1px solid var(--line);border-radius:12px;padding:0 12px;font-size:15px;color:var(--ink);background:#fff;font-family:inherit;}
.aw-f .fin:focus{outline:none;border-color:#612FFF;}
.aw-p{border:1px solid var(--line);border-radius:14px;padding:13px 14px;margin-bottom:11px;}
.aw-p .nm{font-size:15px;font-weight:700;color:var(--ink);}
.aw-p .rl{font-size:12.5px;color:var(--sub);margin-top:3px;line-height:1.6;}
.aw-p .ck{margin-top:10px;display:flex;gap:9px;flex-wrap:wrap;}
.aw-chip{font-size:12.5px;padding:7px 12px;border-radius:11px;background:var(--muted);color:var(--sub);min-height:44px;display:flex;align-items:center;gap:6px;cursor:pointer;}
.aw-chip.done{background:var(--mint-soft);color:var(--emerald);font-weight:600;}
.aw-lang{display:flex;gap:8px;padding:13px 16px 0;}
.aw-lang .lg{font-size:13px;font-weight:600;padding:0 16px;min-height:44px;display:flex;align-items:center;border-radius:20px;background:#fff;color:var(--sub);border:1px solid var(--line);cursor:pointer;}
.aw-lang .lg.on{background:var(--emerald);color:#fff;border-color:var(--emerald);}
.aw-warn{font-size:12.5px;color:var(--amber);line-height:1.6;padding:10px 20px 0;}
.aw-sim{font-size:12px;color:var(--sub);line-height:2;padding:16px 20px 0;border-top:1px dashed var(--line);margin:16px 16px 0;}
.aw-sim a{color:var(--emerald);font-weight:700;margin-right:14px;cursor:pointer;}
.aw-tip{font-size:12.5px;color:var(--sub);line-height:1.7;padding:14px 20px 0;}
/* Tab 内联模式的吸底主按钮：sticky 常驻在滚动容器底部，不用滚到底才看得到
   （pushPage 进入时走 FM 的固定 page-footer，形态一致） */
.aw-fab{position:sticky;bottom:0;padding:14px 16px 16px;z-index:12;
  background:linear-gradient(180deg,rgba(244,251,247,0) 0%,var(--bg) 42%);}`;
document.head.appendChild(css);

/* ===== 状态与配置（与 PC 端 DB.awx / AWX_* 常量同口径）===== */
const AWX={
  accountId:'',        // Airwallex connected account id
  status:'none',       // none|CREATED|SUBMITTED|ACTION_REQUIRED|ACTIVE|SUSPENDED|FAILURE
  country:'SG',        // registration_address.country_code，跟随 site
  locale:'zh',         // zh|en
  submitAt:'', activeAt:'', failReason:'',
  rfi:null,
  kycStep:1,
  camGranted:false,    // App 相机权限（拍摄证件用）
};
const ST={none:['未开通','off'],CREATED:['待提交','off'],SUBMITTED:['审核中','wait'],ACTION_REQUIRED:['待补充材料','wait'],ACTIVE:['已开通','ok'],SUSPENDED:['已冻结','err'],FAILURE:['开通失败','err']};
const COUNTRIES={SG:'新加坡 Singapore',MY:'马来西亚 Malaysia',HK:'中国香港 Hong Kong',CN:'中国大陆 China',TH:'泰国 Thailand',VN:'越南 Vietnam',ID:'印尼 Indonesia',PH:'菲律宾 Philippines',JP:'日本 Japan',AU:'澳大利亚 Australia',GB:'英国 United Kingdom',US:'美国 United States'};
const ZH_OK={CN:1,HK:1,TW:1,SG:1,MY:1};   // 注册国是否支持 zh —— 待沙箱实测确认
/* 备料清单：PC 端用 4 列表格，App 按主体类型分档展示，内容口径一致 */
const BIZ_TYPES=[['COMPANY','公司'],['PARTNERSHIP','合伙企业'],['SOLE_REG','个体户(已注册)'],['SOLE_UNREG','个体户(未注册)']];
const DOCS=[
  {t:'公司注册编号 UEN',n:'业务标识类型 BRN',c:{COMPANY:1,PARTNERSHIP:1,SOLE_REG:1,SOLE_UNREG:0}},
  {t:'注册地址',n:'门牌、区、州、邮编',c:{COMPANY:1,PARTNERSHIP:1,SOLE_REG:1,SOLE_UNREG:'以居住地址代替'}},
  {t:'经营主体名称',n:'',c:{COMPANY:1,PARTNERSHIP:1,SOLE_REG:1,SOLE_UNREG:'可用个人姓名'}},
  {t:'经营范围描述 + 行业类目',n:'',c:{COMPANY:1,PARTNERSHIP:1,SOLE_REG:1,SOLE_UNREG:1}},
  {t:'预计月流水',n:'币种 + 金额',c:{COMPANY:1,PARTNERSHIP:1,SOLE_REG:1,SOLE_UNREG:1}},
  {t:'合伙协议 Partnership agreement',n:'',c:{COMPANY:0,PARTNERSHIP:1,SOLE_REG:0,SOLE_UNREG:0}},
  {t:'实控人(UBO) 与董事资料',n:'姓名 / 出生日期 / 国籍 / 居住地址',c:{COMPANY:'全部人员',PARTNERSHIP:'全部人员',SOLE_REG:'本人',SOLE_UNREG:'本人'}},
  {t:'身份证件影像',n:'护照传正面；身份证 / 驾照传正反面',c:{COMPANY:'全部人员',PARTNERSHIP:'全部人员',SOLE_REG:'本人',SOLE_UNREG:'本人'}},
];
let DOC_TYPE='COMPANY';
const loc=()=>(AWX.locale=='zh'&&!ZH_OK[AWX.country])?'en':AWX.locale;
const T=(zh,en)=>loc()=='zh'?zh:en;

/* ===== 主页：底部「账户」Tab（一级入口）/ 「我的 → 账号管理」（二级入口）=====
   两个入口渲染同一内容：Tab 内联渲染（主按钮内嵌，底部让给 tabbar）；
   二级入口走 pushPage（主按钮走固定 page-footer）。CTX 记录当前宿主，供子页返回后重渲染。 */
let CTX={host:null,inline:false};
function accountInline(container){
  container.innerHTML=`<div class="aw-hd"><div class="t disp">账户</div></div><div id="aw-root"></div>`;
  CTX={host:container,inline:true};
  renderAccount();
}
function openAwxAccount(){
  const p=pushPage({title:'账户',body:'<div id="aw-root"></div>',footer:'<button class="btn primary" id="aw-foot"></button>'});
  CTX={host:p,inline:false};
  renderAccount();
}
function renderAccount(){
  const p=CTX.host; if(!p||!p.querySelector('#aw-root'))return;
  const root=p.querySelector('#aw-root');
  const a=AWX, ok=!!COUNTRIES[a.country], s=ST[a.status];
  let hero='',extra='',foot='';
  if(!ok){
    hero=`<div class="aw-hero"><span class="st off"><span class="dot"></span>暂不支持</span>
      <div class="tt">当前站点暂不支持开通</div>
      <div class="ds">你所在的站点 <b>${a.country}</b> 不在 Airwallex 可开户地区清单内，请联系平台运营协助处理。</div></div>`;
  }else if(a.status=='none'||a.status=='CREATED'){
    hero=`<div class="aw-hero"><span class="st off"><span class="dot"></span>${s[0]}</span>
      <div class="tt">开通收款账户</div>
      <div class="ds">开通后 Food Max 结算的货款将直接入账该账户，可随时提现到你的本地银行卡。开户资料由你在 Airwallex 认证页面填写并直接提交 Airwallex，<b>Food Max 不留存证件影像</b>。</div></div>`;
    extra=docSection();
    foot={t:'开通收款账户',a:'go'};
  }else if(a.status=='SUBMITTED'){
    hero=`<div class="aw-hero"><span class="st wait"><span class="dot"></span>${s[0]}</span>
      <div class="tt">资料已提交审核</div>
      <div class="ds">Airwallex 通常 <b>1–3 个工作日</b>出结果。审核期间不影响你正常接单、发货、开票。</div></div>
      <div class="aw-list">
        <div class="aw-it"><span class="k">账户编号</span><span class="v mono">${a.accountId}</span></div>
        <div class="aw-it"><span class="k">提交时间</span><span class="v">${a.submitAt}</span></div>
        <div class="aw-it"><span class="k">注册国家 / 地区</span><span class="v">${COUNTRIES[a.country]}</span></div>
      </div>`;
    extra=simRow();
  }else if(a.status=='ACTION_REQUIRED'){
    const r=a.rfi||{items:[],raiseAt:''};
    hero=`<div class="aw-hero"><span class="st wait"><span class="dot"></span>${s[0]}</span>
      <div class="tt">需要补充材料</div>
      <div class="ds">Airwallex 于 ${r.raiseAt} 提出以下要求，补齐后即可继续审核。</div></div>`;
    extra=`<div class="aw-list">${r.items.map((x,i)=>`<div class="aw-it" style="align-items:flex-start;padding-top:13px;padding-bottom:13px"><span class="k" style="color:var(--amber)">${i+1}</span><span class="v" style="text-align:left;line-height:1.65">${x}</span></div>`).join('')}</div>`;
    foot={t:'立即补充材料',a:'rfi'};
  }else if(a.status=='FAILURE'){
    hero=`<div class="aw-hero"><span class="st err"><span class="dot"></span>${s[0]}</span>
      <div class="tt">开通未通过</div>
      <div class="ds">${a.failReason}</div></div>`;
    extra=`<div class="aw-tip">如对结果有疑问，可联系平台客服协助核实后重新提交。</div>`;
    foot={t:'重新提交',a:'go'};
  }else if(a.status=='SUSPENDED'){
    hero=`<div class="aw-hero"><span class="st err"><span class="dot"></span>${s[0]}</span>
      <div class="tt">账户已冻结</div>
      <div class="ds">提现暂不可用，结算货款仍会正常入账。请联系平台运营协助核实。</div></div>`;
  }else{
    hero=`<div class="aw-hero"><span class="st ok"><span class="dot"></span>${s[0]}</span>
      <div class="tt">收款账户已开通</div>
      <div class="ds">Food Max 结算的货款将入账该账户。</div></div>
      <div class="aw-list">
        <div class="aw-it"><span class="k">收款账户</span><span class="v mono">SGD · 5210 8842 0091</span></div>
        <div class="aw-it"><span class="k">账户编号</span><span class="v mono">${a.accountId}</span></div>
        <div class="aw-it"><span class="k">结算主体</span><span class="v">鲜丰食材 Fresh Harvest Pte Ltd</span></div>
        <div class="aw-it"><span class="k">注册国家 / 地区</span><span class="v">${COUNTRIES[a.country]}</span></div>
        <div class="aw-it"><span class="k">结算币种</span><span class="v">SGD</span></div>
        <div class="aw-it"><span class="k">开通时间</span><span class="v">${a.activeAt}</span></div>
      </div>`;
  }
  const act=()=>foot.a=='go'?startKyc():openRfi();
  root.innerHTML=hero+extra+'<div style="height:20px"></div>'
    +(CTX.inline&&foot?`<div class="aw-fab"><button class="btn primary" id="aw-foot2">${foot.t}</button></div>`:'');
  if(CTX.inline){
    const b=root.querySelector('#aw-foot2'); if(b)b.onclick=act;
  }else{
    const ftw=p.querySelector('.page-footer'), fb=p.querySelector('#aw-foot');
    if(foot){ftw.style.display='';fb.textContent=foot.t;fb.className='btn primary';fb.onclick=act;}
    else ftw.style.display='none';
  }
  p.querySelectorAll('.aw-tab').forEach(t=>t.onclick=()=>{DOC_TYPE=t.dataset.k;renderAccount();});
  p.querySelectorAll('.aw-sim a').forEach(a=>a.onclick=()=>hook(a.dataset.st));
}
function docSection(){
  return `<div class="aw-sec">开通前请准备</div>
  <div class="aw-sub">${COUNTRIES[AWX.country]} · 选择你的经营主体类型查看所需材料；实际填写项以 Airwallex 认证页面为准</div>
  <div class="aw-tabs">${BIZ_TYPES.map(([k,n])=>`<div class="aw-tab ${DOC_TYPE==k?'on':''}" data-k="${k}">${n}</div>`).join('')}</div>
  <div class="aw-list">${DOCS.map(d=>{
    const v=d.c[DOC_TYPE];
    if(v===0)return `<div class="aw-doc off"><span class="bul no">—</span><span class="tx">${d.t}<span class="nt">该主体类型无需提供</span></span></div>`;
    const note=(v===1?d.n:(d.n?d.n+' · '+v:v));
    return `<div class="aw-doc"><span class="bul req">✓</span><span class="tx">${d.t}${note?`<span class="nt">${note}</span>`:''}</span></div>`;
  }).join('')}</div>`;
}
function simRow(){
  return `<div class="aw-sim">沙箱 · 模拟 Airwallex webhook 回调<br>
    <a data-st="ACTIVE">审核通过</a><a data-st="ACTION_REQUIRED">需要补件</a><a data-st="FAILURE">审核拒绝</a></div>`;
}
function hook(st){
  AWX.status=st;
  if(st=='ACTIVE'){AWX.activeAt='2026-08-19 15:20';toast('账户已开通');}
  if(st=='ACTION_REQUIRED'){AWX.rfi={id:'rfi_2f81c9',raiseAt:'2026-08-19 15:20',items:['董事 CHEN WEI 的护照影像不清晰，请重新上传','补充经营场所照片或租赁合同']};toast('收到补件通知');}
  if(st=='FAILURE'){AWX.failReason='实控人身份信息与商业登记记录不一致，Airwallex 未通过审核。';toast('开通未通过');}
  renderAccount();
}

/* ===== 开通：建号(BR-01/02) → PKCE 授权(BR-03/04) → WebView 承载组件 =====
   建号 payload（平台侧传，商家不可见也不填）：primary_contact.email /
   business_details.business_name / registration_address.country_code /
   business_details.account_usage.product_reference（枚举数组，平台按业务场景固定，待 AM 确认取值）/
   legal_entity_type=Business / customer_agreements 两个 true。
   随后 Update 预填 business_person_details（roles 至少一个），取自「法人信息」「经营资质」。
   注：以下 4 步表单为示意——组件内真实字段与分步由 Airwallex 按注册国动态渲染，平台不控制。 */
function startKyc(){
  if(!AWX.accountId)AWX.accountId='acct_sg7k2m9x4p';        // BR-02：已有则复用
  if(AWX.status=='none'||AWX.status=='FAILURE'){AWX.status='CREATED';AWX.failReason='';}
  AWX.kycStep=1;
  openKyc();
}
const STEPS=[['企业信息','Business details'],['人员与实控人','People & UBOs'],['证件上传','Identity documents'],['确认提交','Review & submit']];
function openKyc(){
  const p=pushPage({title:'开通收款账户',body:'<div id="aw-kyc"></div>',footer:'<button class="btn primary" id="aw-nx"></button>'});
  renderKyc(p);
}
function renderKyc(p){
  const a=AWX, st=a.kycStep, L=loc();
  let form='';
  if(st==1){
    form=`
      <div class="aw-f"><div class="fk">${T('经营主体类型','Business structure')}</div><input class="fin" value="${T('公司 Company','Company')}"></div>
      <div class="aw-f"><div class="fk">${T('经营主体名称','Business name')}</div><input class="fin" value="Fresh Harvest Pte Ltd"></div>
      <div class="aw-f"><div class="fk">${T('公司注册编号 UEN','Business registration number (UEN)')}</div><input class="fin" placeholder="202412345K"></div>
      <div class="aw-f"><div class="fk">${T('行业类目','Industry category')}</div><input class="fin" value="${T('食品与饮料批发','Food & beverage wholesale')}"></div>
      <div class="aw-f"><div class="fk">${T('注册地址','Registered address')}</div><input class="fin" placeholder="${T('门牌号 + 街道','Address line 1')}"></div>
      <div class="aw-f"><div class="fk">${T('区 / 城市','Suburb / City')}</div><input class="fin" placeholder="Jurong"></div>
      <div class="aw-f"><div class="fk">${T('州 / 地区','State')}</div><input class="fin" placeholder="Singapore"></div>
      <div class="aw-f"><div class="fk">${T('邮政编码','Postcode')}</div><input class="fin" placeholder="619748"></div>
      <div class="aw-f"><div class="fk">${T('经营范围描述','Description of goods or services')}</div><input class="fin" placeholder="${T('向餐饮客户批发新鲜蔬菜、肉禽蛋品','Wholesale of fresh produce to restaurants')}"></div>
      <div class="aw-f"><div class="fk">${T('预计月流水','Estimated monthly revenue')}</div><input class="fin" placeholder="SGD 120,000"></div>`;
  }else if(st==2){
    form=`<div class="aw-stp-s">${T('须登记全部实控人（UBO）与董事。第一条已由 Food Max 预填（来自你已提交的法人信息）。','All UBOs and directors are required. The first entry is pre-filled by Food Max.')}</div>
      <div class="aw-p"><div class="nm">CHEN WEI</div><div class="rl">Authorised person · Director · UBO<br>Singapore · 1982-04-11 · Blk 128 Jurong East St 13</div></div>
      <div class="aw-p"><div class="nm">LIM SIEW HONG</div><div class="rl">UBO<br>Singapore · 1985-09-02 · Blk 55 Tampines Ave 4</div></div>
      <div class="aw-chip" id="aw-addp" style="justify-content:center">+ ${T('添加人员','Add person')}</div>`;
  }else if(st==3){
    form=`<div class="aw-stp-s">${T('护照仅需上传正面，身份证 / 驾照需正反面。可直接拍照上传。','Passport requires the front only; ID card and driver licence require both sides.')}</div>
      <div class="aw-p"><div class="nm">CHEN WEI</div><div class="rl">Passport</div>
        <div class="ck"><span class="aw-chip done">✓ ${T('正面已上传','Front uploaded')}</span></div></div>
      <div class="aw-p"><div class="nm">LIM SIEW HONG</div><div class="rl">NRIC</div>
        <div class="ck"><span class="aw-chip aw-cam">${T('拍摄正面','Capture front')}</span><span class="aw-chip aw-cam">${T('拍摄反面','Capture back')}</span></div></div>`;
  }else{
    form=`<div class="aw-stp-s">${T('请确认资料真实准确。提交后 Airwallex 开始审核，通常 1–3 个工作日出结果。','Please confirm the information is accurate before submitting.')}</div>
      <div class="aw-list" style="margin:0">
        <div class="aw-it"><span class="k">${T('经营主体','Business')}</span><span class="v">Fresh Harvest Pte Ltd</span></div>
        <div class="aw-it"><span class="k">UEN</span><span class="v mono">202412345K</span></div>
        <div class="aw-it"><span class="k">${T('登记人员','People')}</span><span class="v">2</span></div>
        <div class="aw-it"><span class="k">${T('证件','Documents')}</span><span class="v">3</span></div>
      </div>
      <div style="font-size:13px;color:var(--sub);line-height:1.7;margin-top:14px">${T('提交即表示同意 Airwallex 服务条款与数据使用政策。','By submitting you agree to the Airwallex terms and data usage policy.')}</div>`;
  }
  p.querySelector('#aw-kyc').innerHTML=`
    <div class="aw-lang">
      <div class="lg ${AWX.locale=='zh'?'on':''}" data-l="zh">中文</div>
      <div class="lg ${AWX.locale=='en'?'on':''}" data-l="en">English</div>
    </div>
    ${(AWX.locale=='zh'&&!ZH_OK[AWX.country])?`<div class="aw-warn">Airwallex 认证页面在 ${COUNTRIES[AWX.country]} 暂不支持中文，已自动切换为英文</div>`:''}
    <div class="aw-wv">
      <div class="bar"><span class="sq"></span>Airwallex 安全认证页面 · WebView 嵌入 · ${AWX.accountId}</div>
      <div class="bd">
        <div class="aw-stp">${STEPS.map((s,i)=>`<i class="${i<st?'on':''}"></i>`).join('')}</div>
        <div class="aw-stp-t">${L=='zh'?STEPS[st-1][0]:STEPS[st-1][1]}</div>
        <div class="aw-stp-s">${T('第','Step ')}${st}${T(' / 4 步','of 4')}</div>
        ${form}
      </div>
    </div>
    <div class="aw-tip">已填内容由 Airwallex 保存，中途退出可回来继续。</div>
    <div style="height:20px"></div>`;
  const btn=p.querySelector('#aw-nx');
  btn.textContent=st<4?T('下一步','Next'):T('提交认证','Submit');
  btn.onclick=()=>{
    if(st<4){AWX.kycStep=st+1;renderKyc(p);p.querySelector('.screen').scrollTop=0;}
    else{
      btn.classList.add('loading');
      setTimeout(()=>{
        AWX.status='SUBMITTED';AWX.submitAt='2026-08-19 14:32';AWX.kycStep=1;
        popPage();renderAccount();toast('资料已提交 Airwallex 审核');
      },600);
    }
  };
  p.querySelectorAll('.lg').forEach(l=>l.onclick=()=>{AWX.locale=l.dataset.l;renderKyc(p);});
  const addp=p.querySelector('#aw-addp'); if(addp)addp.onclick=()=>toast(T('打开新增人员表单','Add person form'));
  /* App 特有：拍摄证件需相机权限，首次点击先申请 */
  p.querySelectorAll('.aw-cam').forEach(c=>c.onclick=()=>{
    if(AWX.camGranted){c.classList.add('done');c.textContent='✓ '+T('已上传','Uploaded');return;}
    confirmDialog({title:'允许 Food Max 访问相机？',body:'用于拍摄证件照片，照片将直接上传至 Airwallex 完成身份认证，Food Max 不留存。',okText:'允许',onOk:()=>{
      AWX.camGranted=true;c.classList.add('done');c.textContent='✓ '+T('已上传','Uploaded');
    }});
  });
}

/* ===== 补件：Embedded KYC RFI 组件（scope r:awx_action:rfi_view + w:awx_action:rfi_edit）===== */
function openRfi(){
  const r=AWX.rfi;
  if(!r){toast('当前没有待补充的材料');return;}
  const p=pushPage({title:'补充材料',body:`
    <div class="aw-lang">
      <div class="lg ${AWX.locale=='zh'?'on':''}" data-l="zh">中文</div>
      <div class="lg ${AWX.locale=='en'?'on':''}" data-l="en">English</div>
    </div>
    <div class="aw-wv"><div class="bar"><span class="sq"></span>Airwallex 安全认证页面 · WebView 嵌入 · ${r.id}</div>
      <div class="bd"><div class="aw-stp-s">${T('Airwallex 审核中发现以下问题，请补充后重新提交。','Airwallex requires the following information to continue the review.')}</div></div></div>
    ${r.items.map((x,i)=>`<div class="aw-rfi"><div class="q">${i+1}. ${x}</div>
      <div class="up"><span class="upb aw-cam">${T('拍照 / 上传','Capture / Upload')}</span></div>
      <input class="fin" placeholder="${T('补充说明（选填）','Additional notes (optional)')}"></div>`).join('')}
    <div style="height:20px"></div>`,
    footer:`<button class="btn primary" id="aw-rs">${T('提交补充材料','Submit')}</button>`});
  p.querySelectorAll('.lg').forEach(l=>l.onclick=()=>{AWX.locale=l.dataset.l;popPage();openRfi();});
  p.querySelectorAll('.aw-cam').forEach(c=>c.onclick=()=>{
    if(AWX.camGranted){c.classList.add('done');c.innerHTML='✓ '+T('已上传','Uploaded');return;}
    confirmDialog({title:'允许 Food Max 访问相机？',body:'用于拍摄证件照片，照片将直接上传至 Airwallex 完成身份认证，Food Max 不留存。',okText:'允许',onOk:()=>{
      AWX.camGranted=true;c.classList.add('done');c.innerHTML='✓ '+T('已上传','Uploaded');
    }});
  });
  p.querySelector('#aw-rs').onclick=()=>{
    const b=p.querySelector('#aw-rs');b.classList.add('loading');
    setTimeout(()=>{
      AWX.rfi=null;AWX.status='SUBMITTED';AWX.submitAt='2026-08-19 16:40';
      popPage();renderAccount();toast('补充材料已提交，等待复审');
    },600);
  };
}

window.FM_MOD=window.FM_MOD||{};
window.FM_MOD.accountInline=accountInline;   // 底部「账户」Tab（一级入口）
window.FM_MOD.awxAccount=openAwxAccount;     // 「我的 → 账号管理」（二级入口）
})();
