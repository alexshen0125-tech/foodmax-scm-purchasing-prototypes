/* Food Max 商家端 v2 · 开票管理模块
   还原快驴「开票管理」：顶部分段 对客开票 / 对Food Max开票(原对快驴)，各含子Tab 待开票/开票中/已完成。
   评审修复内建：列表骨架屏→数据(H1) / 空Tab空态(H2) / 批量申请开票明细前 confirmDialog 确认(H3) / 可点≥44px(H5) / S$ 币种 */
(function(){
const {pushPage,popPage,toast,confirmDialog,svg,skel}=window.FM;

const css=document.createElement('style');
css.textContent=`
.iv-seg{display:flex;gap:6px;background:var(--muted);border-radius:14px;margin:10px 16px 4px;padding:4px;}
.iv-seg .s{flex:1;min-height:44px;display:flex;align-items:center;justify-content:center;font-size:14.5px;font-weight:700;color:var(--sub);border-radius:11px;cursor:pointer;}
.iv-seg .s.on{background:#fff;color:var(--emerald-2);box-shadow:var(--sh-sm);}
.iv-tabs{display:flex;padding:0 16px;background:var(--bg);position:sticky;top:0;z-index:5;border-bottom:1px solid var(--line);}
.iv-tabs .t{flex:1;min-height:46px;display:flex;align-items:center;justify-content:center;font-size:15px;font-weight:600;color:var(--sub);position:relative;cursor:pointer;}
.iv-tabs .t.on{color:var(--ink);font-weight:700;}
.iv-tabs .t.on::after{content:"";position:absolute;bottom:0;left:50%;transform:translateX(-50%);width:26px;height:3px;border-radius:3px;background:var(--emerald);}
.iv-search{display:flex;align-items:center;gap:9px;background:#fff;border-radius:14px;height:44px;margin:12px 16px 0;padding:0 14px;box-shadow:var(--sh-sm);color:var(--sub);font-size:14px;}
.iv-search svg{width:18px;height:18px;stroke:var(--sub);fill:none;stroke-width:2;}
.iv-filt{display:flex;align-items:center;gap:14px;padding:11px 16px 2px;font-size:13.5px;color:#27433A;}
.iv-filt .d{display:flex;align-items:center;gap:3px;min-height:36px;cursor:pointer;}
.iv-filt .d .ar{font-size:10px;color:var(--sub);}
.iv-filt .seg3{margin-left:auto;display:flex;gap:0;font-size:13px;}
.iv-filt .seg3 .o{min-height:36px;display:flex;align-items:center;padding:0 9px;color:var(--sub);cursor:pointer;}
.iv-filt .seg3 .o.on{color:var(--emerald);font-weight:700;}
.iv-filt .seg3 .o+.o{border-left:1px solid var(--line);}
.iv-tip{margin:11px 16px 0;border-radius:14px;padding:12px 14px;font-size:12.5px;line-height:1.5;}
.iv-tip.cust{background:var(--mint-soft);color:#1F5641;}
.iv-tip.fm{background:var(--amber-soft);color:#92500B;}
.iv-tip.done{background:#FEF7E6;color:#92500B;}
.iv-tip b{font-weight:700;}
.iv-steps{display:flex;align-items:center;margin:10px 16px 0;background:#fff;border-radius:14px;padding:12px 8px;box-shadow:var(--sh-sm);}
.iv-steps .sp{flex:1;display:flex;flex-direction:column;align-items:center;gap:5px;text-align:center;}
.iv-steps .sp .n{width:24px;height:24px;border-radius:50%;background:var(--mint-soft);color:var(--emerald-2);font-size:12px;font-weight:700;display:flex;align-items:center;justify-content:center;}
.iv-steps .sp .x{font-size:11.5px;color:#46604F;font-weight:600;line-height:1.3;}
.iv-steps .ar{color:#CBD5C7;font-size:13px;flex:0 0 auto;}
.iv-stat{display:flex;align-items:center;justify-content:space-between;padding:12px 18px 4px;font-size:13px;color:var(--sub);}
.iv-stat b{color:var(--ink);font-weight:700;}
.iv-stat .sum{color:var(--emerald-2);font-weight:700;font-family:'Lora',serif;}
.iv-stat .share{color:var(--emerald);font-weight:700;min-height:44px;display:flex;align-items:center;gap:4px;cursor:pointer;}
.iv-list{padding:8px 16px 16px;}
/* 对客开票 卡片 */
.ic{background:#fff;border-radius:18px;padding:15px;margin-bottom:12px;box-shadow:var(--sh-sm);display:flex;gap:13px;}
.ic .chk{width:24px;height:24px;border-radius:50%;border:2px solid #CBD5C7;flex:0 0 24px;display:flex;align-items:center;justify-content:center;cursor:pointer;margin-top:2px;position:relative;}
.ic .chk::before{content:"";position:absolute;inset:-12px;}
.ic .chk.on{background:var(--emerald);border-color:var(--emerald);}
.ic .chk.on::after{content:"✓";color:#fff;font-size:14px;font-weight:700;}
.ic .body{flex:1;min-width:0;}
.ic .hd{display:flex;align-items:center;gap:7px;margin-bottom:11px;}
.ic .hd .cd{font-size:11px;color:var(--sub);border:1px solid var(--line);border-radius:5px;padding:1px 6px;}
.ic .hd .nm{font-size:15.5px;font-weight:700;}
.ic .grid{display:flex;}
.ic .grid .col{flex:1;min-width:0;}
.ic .grid .l{font-size:11.5px;color:var(--sub);}
.ic .grid .v{font-size:14px;font-weight:600;margin-top:2px;}
.ic .grid .v.amt{font-size:19px;font-family:'Lora',serif;color:var(--ink);}
.ic .ft{margin-top:11px;padding-top:10px;border-top:1px solid var(--line);font-size:11.5px;color:var(--sub);}
.ic .ft .no{color:#46604F;}
/* 对Food Max 卡片 */
.fc{background:#fff;border-radius:18px;padding:15px;margin-bottom:12px;box-shadow:var(--sh-sm);}
.fc .top{display:flex;align-items:center;gap:9px;margin-bottom:12px;}
.fc .tag{font-size:11px;font-weight:700;padding:2px 9px;border-radius:6px;}
.fc .tag.dx{background:var(--amber-soft);color:#B45309;}
.fc .tag.zq{background:var(--mint-soft);color:var(--emerald-2);}
.fc .amt{font-size:21px;font-weight:700;font-family:'Lora',serif;}
.fc .row{display:flex;font-size:13px;padding:4px 0;}
.fc .row .k{width:74px;flex:0 0 74px;color:var(--sub);}
.fc .row .v{flex:1;color:#27433A;word-break:break-all;}
.fc .row .v .ex{font-size:11px;color:#B45309;background:var(--amber-soft);border-radius:5px;padding:1px 7px;margin-left:8px;white-space:nowrap;}
.iv-foot{position:absolute;left:0;right:0;bottom:0;z-index:8;}
.iv-foot .bar{display:flex;align-items:center;gap:12px;}
.iv-foot .all{display:flex;align-items:center;gap:7px;font-size:14px;font-weight:600;min-height:44px;cursor:pointer;}
.iv-foot .all .b{width:22px;height:22px;border-radius:50%;border:2px solid #CBD5C7;display:flex;align-items:center;justify-content:center;}
.iv-foot .all .b.on{background:var(--emerald);border-color:var(--emerald);}.iv-foot .all .b.on::after{content:"✓";color:#fff;font-size:12px;}
.iv-foot .sel{flex:1;font-size:13px;color:var(--sub);}.iv-foot .sel b{color:var(--emerald-2);}
.iv-foot button{min-height:44px;padding:0 22px;border-radius:12px;font-size:15px;font-weight:700;border:none;cursor:pointer;font-family:inherit;background:var(--emerald);color:#fff;box-shadow:0 8px 20px rgba(5,150,105,.3);}
.iv-foot button:disabled{background:#BFD8CD;box-shadow:none;}
`;
document.head.appendChild(css);

// ---- 数据(SG 本地化；金额前缀 S$) ----
// 对客开票 · 待开票（客户=B端餐厅客户，名称脱敏占位）
const CUST=[
  {code:'22230663',name:'新源记小厨',amt:'55.93',type:'电子普票',time:'2026.06.30',no:'P26063010784327728371'},
  {code:'22230663',name:'新源记小厨',amt:'8.78',type:'电子普票',time:'2026.06.30',no:'P26063010778383736570'},
  {code:'31180547',name:'海南鸡饭之家',amt:'26.41',type:'电子普票',time:'2026.06.30',no:'P26063010776099662315'},
  {code:'31180547',name:'海南鸡饭之家',amt:'87.05',type:'电子普票',time:'2026.06.30',no:'P26063010774398322824'},
  {code:'45092218',name:'阿明海鲜餐室',amt:'142.60',type:'电子普票',time:'2026.06.29',no:'P26062910774371026640'},
  {code:'45092218',name:'阿明海鲜餐室',amt:'63.20',type:'电子普票',time:'2026.06.29',no:'P26062910771265508812'},
  {code:'58031176',name:'锦记茶餐厅',amt:'319.84',type:'电子普票',time:'2026.06.28',no:'P26062810762240117309'},
];
// 对Food Max 开票 · 待开票（商家给平台开票，发票抬头=平台主体）
const FM_TODO=[
  {tag:'代销',amt:'629.46',time:'2026-06-30',ex:'7天后逾期',type:'–',title:'Food Max Pte Ltd',no:'FPSQ110150232606301100001810'},
  {tag:'专区',amt:'2037.86',time:'2026-06-29',ex:'6天后逾期',type:'–',title:'Food Max Pte Ltd',no:'FPSQ0110150232606281100018100000150'},
  {tag:'代销',amt:'183.87',time:'2026-06-28',ex:'5天后逾期',type:'–',title:'Food Max Pte Ltd',no:'FPSQ110150232606271100001810'},
  {tag:'代销',amt:'535.80',time:'2026-06-27',ex:'4天后逾期',type:'–',title:'Food Max Pte Ltd',no:'FPSQ110150232606261100001810'},
  {tag:'代销',amt:'398.08',time:'2026-06-26',ex:'3天后逾期',type:'–',title:'Food Max Pte Ltd',no:'FPSQ110150232606251100001810'},
  {tag:'专区',amt:'141.31',time:'2026-06-25',ex:'2天后逾期',type:'–',title:'Food Max Pte Ltd',no:'FPSQ110150232606241100001810'},
];
// 对Food Max 开票 · 已完成
const FM_DONE=[
  {tag:'代销',amt:'589.49',time:'2026-06-25',type:'电子发票（数电普票）',title:'Food Max Pte Ltd',no:'FPSQ110150232606241100001810'},
  {tag:'代销',amt:'17.37',time:'2026-06-25',type:'电子发票（数电普票）',title:'Food Max Pte Ltd',no:'FPSQ110150232606243101010'},
  {tag:'代销',amt:'528.12',time:'2026-06-24',type:'电子发票（数电普票）',title:'Food Max Pte Ltd',no:'FPSQ110150232606231100001810'},
  {tag:'代销',amt:'291.52',time:'2026-06-23',type:'电子发票（数电普票）',title:'Food Max Pte Ltd',no:'FPSQ110150232606221100001810'},
];

function empty(t,p){return `<div class="empty"><div class="ei">${svg('invoice')}</div><h4>${t}</h4><p>${p}</p></div>`;}

function custCard(c){
  return `<div class="ic">
    <div class="chk" data-chk></div>
    <div class="body">
      <div class="hd"><span class="cd">${c.code}</span><span class="nm">${c.name}</span></div>
      <div class="grid">
        <div class="col"><div class="l">申请金额</div><div class="v amt">S$${c.amt}</div></div>
        <div class="col"><div class="l">申请类型</div><div class="v">${c.type}</div></div>
      </div>
      <div class="ft"><div>申请时间 ${c.time}</div><div class="no">申请号 ${c.no}</div></div>
    </div></div>`;
}
function fmCard(f){
  return `<div class="fc">
    <div class="top"><span class="tag ${f.tag==='专区'?'zq':'dx'}">${f.tag}</span><span class="amt">S$${f.amt}</span></div>
    <div class="row"><span class="k">生成时间</span><span class="v">${f.time}${f.ex?`<span class="ex">${f.ex}</span>`:''}</span></div>
    <div class="row"><span class="k">开票类型</span><span class="v">${f.type}</span></div>
    <div class="row"><span class="k">发票抬头</span><span class="v">${f.title}</span></div>
    <div class="row"><span class="k">清单编号</span><span class="v">${f.no}</span></div>
  </div>`;
}

function render(page){
  const seg=page.querySelector('#ivseg');
  const tabs=page.querySelector('#ivtabs');
  const dyn=page.querySelector('#ivdyn');
  const st=page._st;

  // 分段 & 子Tab 高亮
  seg.querySelectorAll('.s').forEach(s=>s.classList.toggle('on',s.dataset.s===st.seg));
  tabs.querySelectorAll('.t').forEach(t=>t.classList.toggle('on',t.dataset.t===st.tab));

  // 顶部静态区(搜索/筛选/提示/步骤/统计) + 列表占位
  let head='';
  if(st.seg==='cust'&&st.tab==='todo'){
    head=`<div class="iv-search">${svg('search')}请输入客户名称或客户编号</div>
      <div class="iv-filt">
        <span class="d">申请日期<span class="ar">▾</span></span>
        <span class="d">全部<span class="ar">▾</span></span>
        <span class="seg3"><span class="o on">全部</span><span class="o">超时</span><span class="o">被客诉</span></span>
      </div>
      <div class="iv-tip cust">线下开票流程：①提交申请开票明细，②线下为客户开具发票，③回填发票信息后完成开票。</div>
      <div class="iv-steps">
        <div class="sp"><span class="n">1</span><span class="x">申请开票明细</span></div><span class="ar">›</span>
        <div class="sp"><span class="n">2</span><span class="x">线下开票</span></div><span class="ar">›</span>
        <div class="sp"><span class="n">3</span><span class="x">回填发票信息</span></div>
      </div>
      <div class="iv-stat"><span>有 <b>162</b> 条申请，合计 <span class="sum">S$6374.31</span></span></div>`;
  }else if(st.seg==='fm'&&st.tab==='todo'){
    head=`<div class="iv-tip fm">逾期未开票将产生暂扣款。请在到期前完成对 Food Max 的开票，或登录电脑端网页–财务中心–开票管理–给 Food Max 开票。</div>
      <div class="iv-stat"><span>共 <b>6.00</b> 个，合计 <span class="sum">S$3925.98</span></span><span class="share">${svg('arrow')}分享</span></div>`;
  }else if(st.seg==='fm'&&st.tab==='done'){
    head=`<div class="iv-tip done">您有未开发票，已产生 <b>S$102836.96</b> 暂扣款，请登录合作商电脑端网页–财务中心–开票管理–给 Food Max 开票。</div>`;
  }
  dyn.innerHTML=head+`<div class="iv-list" id="ivlist">${skel(3)}</div>`;

  // 列表骨架→数据(H1)
  const listEl=dyn.querySelector('#ivlist');
  setTimeout(()=>{
    if(st.seg==='cust'&&st.tab==='todo'){
      CUST.forEach(c=>c._sel=false);
      listEl.innerHTML=CUST.map(custCard).join('');
      bindCust(page,listEl);
      showFoot(page);
    }else if(st.seg==='fm'&&st.tab==='todo'){
      listEl.innerHTML=FM_TODO.map(fmCard).join('');
      hideFoot(page);
    }else if(st.seg==='fm'&&st.tab==='done'){
      listEl.innerHTML=FM_DONE.map(fmCard).join('');
      hideFoot(page);
    }else{
      // 对客开票 开票中/已完成、对Food Max 开票中 → 空态(H2)
      const map={doing:['暂无开票中的单据','已申请明细、待回填发票信息的单据会显示在这里'],done:['暂无已完成开票','开票完成的单据会归档到这里']};
      listEl.innerHTML=empty(...(map[st.tab]||['暂无数据','当前筛选下没有可显示的单据']));
      hideFoot(page);
    }
  },420);
}

// 对客开票 勾选联动 + 底部批量条
function bindCust(page,listEl){
  const st=page._st;
  listEl.querySelectorAll('.ic').forEach((el,i)=>{
    const chk=el.querySelector('[data-chk]');
    chk.classList.toggle('on',!!CUST[i]._sel);
    chk.onclick=()=>{CUST[i]._sel=!CUST[i]._sel;chk.classList.toggle('on',CUST[i]._sel);refreshFoot(page);};
  });
  refreshFoot(page);
}
function showFoot(page){
  hideFoot(page);
  const f=document.createElement('div');f.className='page-footer iv-foot';f.id='ivfoot';
  f.innerHTML=`<div class="bar">
    <div class="all" id="ivall"><span class="b"></span>全选</div>
    <span class="sel" id="ivsel">已选 <b>0</b></span>
    <button id="ivsub" disabled>申请开票明细</button>
  </div>`;
  page.appendChild(f);
  f.querySelector('#ivall').onclick=()=>{const allOn=CUST.every(c=>c._sel);CUST.forEach(c=>c._sel=!allOn);
    page.querySelectorAll('#ivlist .ic .chk').forEach((chk,i)=>chk.classList.toggle('on',CUST[i]._sel));refreshFoot(page);};
  f.querySelector('#ivsub').onclick=()=>{
    const sel=CUST.filter(c=>c._sel);if(!sel.length)return;
    const sum=sel.reduce((a,c)=>a+parseFloat(c.amt),0).toFixed(2);
    confirmDialog({title:`申请开票明细`,body:`将为已选 <b>${sel.length}</b> 条申请生成开票明细，合计 <b>S$${sum}</b>。请在线下完成开票后回填发票信息。`,okText:'确认申请',
      onOk:()=>{toast(`已提交 ${sel.length} 条开票明细申请`);CUST.forEach(c=>c._sel=false);
        page.querySelectorAll('#ivlist .ic .chk').forEach(chk=>chk.classList.remove('on'));refreshFoot(page);}});
  };
  refreshFoot(page);
}
function refreshFoot(page){
  const f=page.querySelector('#ivfoot');if(!f)return;
  const n=CUST.filter(c=>c._sel).length;
  f.querySelector('#ivsel').innerHTML=`已选 <b>${n}</b>`;
  f.querySelector('#ivall .b').classList.toggle('on',n===CUST.length&&n>0);
  f.querySelector('#ivsub').disabled=n===0;
}
function hideFoot(page){const f=page.querySelector('#ivfoot');if(f)f.remove();}

function open(){
  pushPage({title:'开票管理',body:`
    <div class="iv-seg" id="ivseg"><span class="s on" data-s="cust">对客开票</span><span class="s" data-s="fm">对 Food Max 开票</span></div>
    <div class="iv-tabs" id="ivtabs"><span class="t on" data-t="todo">待开票</span><span class="t" data-t="doing">开票中</span><span class="t" data-t="done">已完成</span></div>
    <div id="ivdyn"></div>`,
    mount:(page)=>{
      page._st={seg:'cust',tab:'todo'};
      page.querySelectorAll('#ivseg .s').forEach(s=>s.onclick=()=>{page._st.seg=s.dataset.s;render(page);});
      page.querySelectorAll('#ivtabs .t').forEach(t=>t.onclick=()=>{page._st.tab=t.dataset.t;render(page);});
      render(page);
    }});
}

window.FM_MOD=window.FM_MOD||{};
window.FM_MOD.invoice=open;
})();
