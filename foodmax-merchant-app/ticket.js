/* Food Max 商家端 v2 · 票证上传模块
   还原快驴「上传票证」：进行中(管控日期+复用昨日+仓卡未完成) / 历史票证(左仓库纵向Tab+快捷筛选+空态)
   评审修复内建：进行中先 skel 骨架→数据；历史空态用 .empty；日期/快捷/仓库 Tab 可切高亮；提交 loading；可点 ≥44px；SG 数据 */
(function(){
const {pushPage,popPage,toast,confirmDialog,svg,skel}=window.FM;

const css=document.createElement('style');
css.textContent=`
/* 顶部 Tab */
.tk-tabs{display:flex;gap:26px;padding:4px 20px 0;background:var(--bg);border-bottom:1px solid var(--line);}
.tk-tab{position:relative;min-height:44px;display:flex;align-items:center;font-size:15px;font-weight:600;color:var(--sub);cursor:pointer;}
.tk-tab.on{color:var(--emerald);font-weight:700;}
.tk-tab.on::after{content:"";position:absolute;left:0;right:0;bottom:-1px;height:3px;border-radius:3px;background:var(--emerald);}
/* 进行中 · 管控日期 */
.tk-filter{display:flex;align-items:center;gap:8px;padding:12px 16px 2px;overflow-x:auto;}.tk-filter::-webkit-scrollbar{display:none;}
.tk-filter .lab{flex:0 0 auto;font-size:13px;color:var(--sub);display:flex;align-items:center;gap:3px;cursor:pointer;}
.tk-filter .lab svg{width:13px;height:13px;stroke:var(--sub);fill:none;stroke-width:2;}
.tk-date{flex:0 0 auto;min-height:38px;display:flex;align-items:center;padding:0 14px;border-radius:10px;background:var(--muted);font-size:13px;color:#46604F;cursor:pointer;border:1.5px solid transparent;}
.tk-date.on{background:#fff;color:var(--emerald);border-color:var(--emerald);font-weight:700;}
.tk-reuse-row{display:flex;justify-content:flex-end;padding:8px 16px 2px;}
.tk-reuse{min-height:44px;padding:0 18px;border-radius:11px;border:none;background:var(--emerald);color:#fff;font-size:14px;font-weight:700;cursor:pointer;font-family:inherit;box-shadow:0 6px 16px rgba(5,150,105,.28);}
/* 仓卡 */
.tk-list{padding:6px 16px 20px;}
.tk-card{background:#fff;border-radius:18px;padding:16px;margin-bottom:13px;box-shadow:var(--sh-sm);}
.tk-card .ch{display:flex;align-items:center;justify-content:space-between;margin-bottom:4px;}
.tk-card .wn{font-size:16.5px;font-weight:700;}
.tk-badge{flex:0 0 auto;font-size:11px;font-weight:700;padding:2px 9px;border-radius:6px;}
.tk-badge.undone{background:var(--amber-soft);color:#B45309;border:1px solid #F0D39A;}
.tk-badge.done{background:var(--mint-soft);color:var(--emerald-2);border:1px solid #A7E3C8;}
.tk-cat{display:flex;align-items:center;justify-content:space-between;padding:11px 0 11px;border-top:1px solid var(--line);cursor:pointer;min-height:48px;}
.tk-cat .cn{flex:1;padding-right:12px;font-size:14px;color:#27433A;line-height:1.35;}
.tk-cat .st{flex:0 0 auto;display:flex;align-items:center;gap:7px;}
.tk-cat .st .stx{text-align:right;line-height:1.25;}
.tk-cat .st .up{display:block;font-size:12.5px;}
.tk-cat .st .fr{display:block;font-size:13px;font-weight:700;}
.tk-cat.undone .up,.tk-cat.undone .fr{color:var(--amber);}
.tk-cat.done .up,.tk-cat.done .fr{color:var(--emerald);}
.tk-cat .st svg{width:16px;height:16px;stroke:var(--sub);fill:none;stroke-width:2.4;}
/* 历史票证 */
.tk-quick{display:flex;gap:10px;padding:12px 16px;overflow-x:auto;}.tk-quick::-webkit-scrollbar{display:none;}
.tk-chip{flex:0 0 auto;min-height:40px;display:flex;align-items:center;gap:4px;padding:0 18px;border-radius:11px;background:var(--muted);font-size:14px;color:#46604F;cursor:pointer;}
.tk-chip.on{background:var(--mint-soft);color:var(--emerald);font-weight:700;}
.tk-chip svg{width:12px;height:12px;stroke:currentColor;fill:none;stroke-width:2.4;}
.tk-his{display:flex;border-top:1px solid var(--line);min-height:480px;}
.tk-wtabs{flex:0 0 118px;background:var(--muted);overflow-y:auto;max-height:560px;}.tk-wtabs::-webkit-scrollbar{display:none;}
.tk-wtab{min-height:54px;display:flex;align-items:center;padding:0 14px;font-size:14px;color:#46604F;cursor:pointer;border-left:3px solid transparent;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.tk-wtab.on{background:#fff;color:var(--emerald);font-weight:700;border-left-color:var(--emerald);}
.tk-his-body{flex:1;display:flex;align-items:center;justify-content:center;min-width:0;}
/* 上传子页 */
.tk-up{padding:16px;}
.tk-up .ti{font-size:16px;font-weight:700;}
.tk-up .tsub{font-size:12.5px;color:var(--sub);margin:4px 0 16px;}
.tk-grid{display:flex;flex-wrap:wrap;gap:12px;}
.tk-add{width:100px;height:100px;border-radius:14px;border:1.6px dashed #B7D6C6;background:var(--muted);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:5px;color:var(--sub);font-size:12px;cursor:pointer;}
.tk-add .pl{font-size:30px;color:var(--emerald-2);line-height:1;}
.tk-photo{width:100px;height:100px;border-radius:14px;background:var(--mint-soft);display:flex;align-items:center;justify-content:center;font-size:38px;position:relative;}
.tk-photo .del{position:absolute;top:-7px;right:-7px;width:22px;height:22px;border-radius:50%;background:var(--red);color:#fff;display:flex;align-items:center;justify-content:center;font-size:15px;cursor:pointer;}
.tk-tip{margin:16px;padding:14px;border-radius:14px;background:var(--amber-soft);font-size:12.5px;color:#92600F;line-height:1.7;}
`;
document.head.appendChild(css);

// SG 数据
const DATES=['2026-06-29','2026-06-30','2026-07-01'];
const WH_ING=[
  {n:'裕廊DC',cats:[{c:'肉禽水产（鲜）/冰鲜水产',req:1,done:0},{c:'蔬菜水果/新鲜蔬菜',req:1,done:0},{c:'蔬菜水果/加工蔬菜',req:1,done:0}]},
  {n:'兀兰DC',cats:[{c:'肉禽水产（鲜）/冰鲜水产',req:1,done:0},{c:'蔬菜水果/新鲜蔬菜',req:1,done:0}]},
  {n:'大巴窑DC',cats:[{c:'肉禽水产（鲜）/冰鲜水产',req:1,done:0}]},
  {n:'淡滨尼DC',cats:[{c:'蔬菜水果/新鲜蔬菜',req:1,done:0}]},
];
const WH_HIS=['裕廊DC','兀兰DC','盛港DC','大巴窑DC','淡滨尼DC','义顺DC','西区KA仓','东区前置仓','中区中转仓','北区冷链仓'];

// 进行中
function catRow(wh,cat,redraw){
  const ok=cat.done>=cat.req;
  const w=document.createElement('div');
  w.className='tk-cat '+(ok?'done':'undone');
  w.innerHTML=`<div class="cn">${cat.c}</div>
    <div class="st"><div class="stx"><span class="up">${ok?'已上传':'未上传'}</span><span class="fr">${cat.done}/${cat.req}</span></div>${svg('arrow','style="width:16px;height:16px;stroke:var(--sub)"')}</div>`;
  w.onclick=()=>openUpload(wh,cat,redraw);
  return w;
}
function whCard(wh,redraw){
  const allDone=wh.cats.every(c=>c.done>=c.req);
  const card=document.createElement('div');card.className='tk-card';
  card.innerHTML=`<div class="ch"><span class="wn">${wh.n}</span><span class="tk-badge ${allDone?'done':'undone'}">${allDone?'已完成':'未完成'}</span></div>`;
  wh.cats.forEach(c=>card.appendChild(catRow(wh,c,redraw)));
  return card;
}
function renderIng(host){
  let curDate=DATES[DATES.length-1];
  host.innerHTML=`
    <div class="tk-filter" id="tkf">
      <span class="lab" id="tkfi">管控日期 ${svg('alert','')}</span>
      ${DATES.map(d=>`<div class="tk-date ${d===curDate?'on':''}" data-d="${d}">${d}</div>`).join('')}
    </div>
    <div class="tk-reuse-row"><button class="tk-reuse" id="tkreuse">复用昨日票证</button></div>
    <div class="tk-list" id="tkl"></div>`;
  const list=host.querySelector('#tkl');
  const drawData=()=>{
    list.innerHTML='';
    list.className='tk-list stagger';
    WH_ING.forEach(wh=>list.appendChild(whCard(wh,draw)));
  };
  const draw=()=>{list.className='tk-list';list.innerHTML=skel(3);setTimeout(drawData,420);}; // 骨架→数据
  host.querySelectorAll('#tkf .tk-date').forEach(d=>d.onclick=()=>{
    host.querySelectorAll('#tkf .tk-date').forEach(x=>x.classList.remove('on'));
    d.classList.add('on');curDate=d.dataset.d;draw();
  });
  host.querySelector('#tkfi').onclick=()=>toast('管控日期：仅展示该业务日需上传票证的仓库与品类');
  host.querySelector('#tkreuse').onclick=()=>confirmDialog({
    title:'复用昨日票证？',body:'将昨日各仓库 / 品类已上传的票证一键复制到当前管控日期，复用后仍可逐项修改。',okText:'复用',
    onOk:()=>{WH_ING.forEach(wh=>wh.cats.forEach(c=>c.done=c.req));toast('已复用昨日票证');draw();}});
  draw();
}

// 上传子页
function openUpload(wh,cat,redraw){
  let n=cat.done;
  pushPage({title:'上传票证',body:`
    <div class="tk-up">
      <div class="ti">${wh.n}</div>
      <div class="tsub">品类 · ${cat.c}</div>
      <div class="tk-grid" id="tkg"></div>
    </div>
    <div class="tk-tip">请上传当日真实采购 / 验收票证照片，确保单据清晰、信息完整；票证用于平台质量追溯，请勿上传无关图片。</div>`,
    footer:`<button class="btn primary" id="tkup" ${n?'':'disabled'}>提交（${n}张）</button>`,
    mount:(p)=>{
      const grid=p.querySelector('#tkg'),btn=p.querySelector('#tkup');
      const sync=()=>{btn.disabled=!n;btn.textContent=`提交（${n}张）`;};
      const drawGrid=()=>{
        grid.innerHTML='';
        for(let i=0;i<n;i++){const ph=document.createElement('div');ph.className='tk-photo';ph.innerHTML=`🧾<span class="del">×</span>`;
          ph.querySelector('.del').onclick=()=>{n--;drawGrid();sync();};grid.appendChild(ph);}
        const add=document.createElement('div');add.className='tk-add';add.innerHTML=`<span class="pl">＋</span>拍照 / 相册`;
        add.onclick=()=>{if(n>=9)return toast('最多上传 9 张');n++;drawGrid();sync();};
        grid.appendChild(add);
      };
      drawGrid();
      btn.onclick=()=>{if(!n)return;btn.classList.add('loading');setTimeout(()=>{btn.classList.remove('loading');cat.done=Math.min(n,cat.req);toast('票证上传成功');redraw&&redraw();setTimeout(popPage,600);},700);};
    }});
}

// 历史票证
function renderHis(host){
  let curWh=0,curQ='全部';
  host.innerHTML=`
    <div class="tk-quick" id="tkq">
      <div class="tk-chip on" data-q="全部">全部</div>
      <div class="tk-chip" data-q="本月">本月</div>
      <div class="tk-chip" data-q="上月">上月</div>
      <div class="tk-chip" data-q="指定日期">指定日期 ${svg('arrow','style="transform:rotate(90deg)"')}</div>
    </div>
    <div class="tk-his">
      <div class="tk-wtabs" id="tkw">${WH_HIS.map((w,i)=>`<div class="tk-wtab ${i===0?'on':''}" data-i="${i}">${w}</div>`).join('')}</div>
      <div class="tk-his-body" id="tkhb"></div>
    </div>`;
  const body=host.querySelector('#tkhb');
  const drawBody=()=>{
    body.innerHTML=skel(1);body.style.alignItems='flex-start';body.style.padding='12px';
    setTimeout(()=>{body.style.alignItems='center';body.style.padding='0';
      body.innerHTML=`<div class="empty"><div class="ei">${svg('ticket')}</div><h4>暂无历史票证记录</h4><p>${WH_HIS[curWh]} · ${curQ}范围内暂无已上传的票证</p></div>`;},420); // 空态用 .empty
  };
  host.querySelectorAll('#tkw .tk-wtab').forEach(t=>t.onclick=()=>{
    host.querySelectorAll('#tkw .tk-wtab').forEach(x=>x.classList.remove('on'));
    t.classList.add('on');curWh=+t.dataset.i;drawBody();
  });
  host.querySelectorAll('#tkq .tk-chip').forEach(c=>c.onclick=()=>{
    if(c.dataset.q==='指定日期'){toast('选择指定日期范围');return;}
    host.querySelectorAll('#tkq .tk-chip').forEach(x=>x.classList.remove('on'));
    c.classList.add('on');curQ=c.dataset.q;drawBody();
  });
  drawBody();
}

// 上传指引
function showGuide(){
  confirmDialog({title:'上传指引',okText:'我知道了',
    body:'1. 每个管控日期需为对应仓库 / 品类各上传至少 1 张票证；<br>2. 票证须为当日真实采购 / 验收单据，信息清晰完整；<br>3. 可点「复用昨日票证」一键沿用前一日票证后再修改；<br>4. 已上传票证可在「历史票证」按仓库与时间查询。'});
}

// 入口
function openTicket(){
  pushPage({title:'上传票证',right:'上传指引 ⓘ',
    body:`<div class="tk-tabs"><div class="tk-tab on" data-tab="ing">进行中</div><div class="tk-tab" data-tab="his">历史票证</div></div><div id="tk-body"></div>`,
    mount:(p)=>{
      const nr=p.querySelector('#nr');if(nr)nr.onclick=showGuide;
      const tabs=p.querySelectorAll('.tk-tab'),host=p.querySelector('#tk-body');
      const go=(tab)=>{tabs.forEach(t=>t.classList.toggle('on',t.dataset.tab===tab));tab==='ing'?renderIng(host):renderHis(host);};
      tabs.forEach(t=>t.onclick=()=>go(t.dataset.tab));
      go('ing');
    }});
}

window.FM_MOD=window.FM_MOD||{};
window.FM_MOD.ticket=openTicket;
})();
