/* Food Max 商家端 v2 · 「我的」+ 基本信息模块
   mineInline 填充「我的」Tab 容器；子页用 FM.pushPage。
   评审修复内建：表单提交 loading→toast / 删除 confirmDialog / 可点 ≥44px / 币种 S$ / SG 语境。前缀 mn- */
(function(){
const {pushPage,popPage,toast,confirmDialog,sheet,svg}=window.FM;

const css=document.createElement('style');
css.textContent=`
.mn-hd{padding:14px 20px 6px;}
.mn-hd .t{font-size:26px;font-weight:700;}
/* 账号区 */
.mn-acct{margin:8px 16px 0;border-radius:22px;padding:18px 16px;color:#fff;display:flex;align-items:center;gap:14px;
  background:linear-gradient(150deg,#0AA06A 0%,#047857 52%,#065F46 100%);box-shadow:0 14px 32px rgba(6,95,70,.30);}
.mn-acct .av{width:52px;height:52px;border-radius:50%;background:rgba(255,255,255,.18);display:flex;align-items:center;justify-content:center;flex:0 0 52px;}
.mn-acct .av svg{width:28px;height:28px;stroke:#fff;fill:none;stroke-width:1.8;}
.mn-acct .info{flex:1;min-width:0;}
.mn-acct .info .lb{font-size:12px;opacity:.85;}
.mn-acct .info .ac{font-size:17px;font-weight:700;margin-top:2px;}
.mn-acct .basic{font-size:13.5px;font-weight:600;background:rgba(255,255,255,.18);padding:9px 13px;border-radius:20px;min-height:44px;display:flex;align-items:center;cursor:pointer;white-space:nowrap;}
/* 菜单卡 */
.mn-grp{background:#fff;border-radius:18px;margin:14px 16px 0;box-shadow:var(--sh-sm);overflow:hidden;}
.mn-row{display:flex;align-items:center;gap:13px;padding:0 16px;min-height:54px;cursor:pointer;border-top:1px solid var(--line);}
.mn-grp .mn-row:first-child{border-top:none;}
.mn-row .ic{width:24px;height:24px;flex:0 0 24px;display:flex;align-items:center;justify-content:center;}
.mn-row .ic svg{width:21px;height:21px;stroke:#46604F;fill:none;stroke-width:1.8;}
.mn-row .nm{flex:1;font-size:15.5px;color:#27433A;font-weight:500;}
.mn-row .rt{font-size:13.5px;color:var(--sub);margin-right:4px;}
.mn-row .rt.ok{color:var(--emerald);font-weight:700;}
.mn-row .arr{width:16px;height:16px;}.mn-row .arr svg{width:16px;height:16px;stroke:#B6C8BF;fill:none;stroke-width:2.4;}
.mn-foot{text-align:center;font-size:12px;color:var(--sub);padding:22px 24px 18px;line-height:1.6;}
/* 详情/资料行(无图标) */
.mn-list{background:#fff;border-radius:18px;margin:12px 16px;box-shadow:var(--sh-sm);overflow:hidden;}
.mn-item{display:flex;align-items:center;gap:10px;padding:0 16px;min-height:54px;border-top:1px solid var(--line);}
.mn-list .mn-item:first-child{border-top:none;}
.mn-item.tap{cursor:pointer;}
.mn-item .k{flex:0 0 auto;font-size:14.5px;color:#27433A;font-weight:600;display:flex;align-items:center;gap:5px;}
.mn-item .k .req{color:var(--red);}
.mn-item .k .q{width:15px;height:15px;border-radius:50%;border:1px solid #B6C8BF;color:#90A79C;font-size:10px;display:inline-flex;align-items:center;justify-content:center;}
.mn-item .v{flex:1;text-align:right;font-size:14.5px;color:var(--ink);}
.mn-item .v.ph{color:var(--sub);}
.mn-item .arr{width:16px;height:16px;}.mn-item .arr svg{width:16px;height:16px;stroke:#B6C8BF;fill:none;stroke-width:2.4;}
.mn-item .eye{width:18px;height:18px;flex:0 0 18px;}.mn-item .eye svg{width:18px;height:18px;stroke:#B6C8BF;fill:none;stroke-width:1.8;}
/* section 标题 */
.mn-sec{font-size:16px;font-weight:700;margin:18px 20px 0;display:flex;align-items:center;justify-content:space-between;}
.mn-sec.bar{padding-left:11px;position:relative;}
.mn-sec.bar::before{content:"";position:absolute;left:0;top:3px;bottom:3px;width:4px;border-radius:3px;background:var(--emerald);}
.mn-sec .act{font-size:13.5px;color:var(--emerald);font-weight:700;min-height:44px;display:flex;align-items:center;cursor:pointer;}
/* 上传框 */
.mn-up{width:88px;height:88px;border-radius:12px;border:1.5px dashed #BFD8CD;background:var(--muted);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;color:var(--sub);font-size:11.5px;cursor:pointer;}
.mn-up svg{width:24px;height:24px;stroke:#90A79C;fill:none;stroke-width:1.6;}
.mn-fld{background:#fff;border-radius:18px;margin:12px 16px;padding:16px;box-shadow:var(--sh-sm);}
.mn-fld .fk{font-size:15px;font-weight:700;display:flex;align-items:center;gap:5px;margin-bottom:4px;}
.mn-fld .fk .req{color:var(--red);}
.mn-fld .fk .q{width:15px;height:15px;border-radius:50%;border:1px solid #B6C8BF;color:#90A79C;font-size:10px;display:inline-flex;align-items:center;justify-content:center;font-weight:400;}
.mn-fld .fv{font-size:15px;color:var(--ink);}
.mn-fld .fh{font-size:12.5px;color:var(--sub);margin:3px 0 12px;}
/* 经营资质卡 */
.mn-qz{background:#fff;border-radius:18px;margin:12px 16px;padding:16px;box-shadow:var(--sh-sm);}
.mn-qz .qt{font-size:15px;font-weight:700;margin-bottom:13px;}.mn-qz .qt .req{color:var(--red);}
.mn-qz .qimg{width:118px;height:74px;border-radius:10px;background:var(--muted);border:1px solid var(--line);display:flex;align-items:center;justify-content:center;color:var(--sub);font-size:11px;margin-bottom:13px;}
.mn-qz .qr{display:flex;justify-content:space-between;padding:9px 0;font-size:14px;border-top:1px solid var(--line);}
.mn-qz .qr:first-of-type{border-top:none;}
.mn-qz .qr .qk{color:#46604F;}.mn-qz .qr .qv{font-weight:600;}
.mn-status{display:flex;align-items:center;justify-content:space-between;margin:12px 16px;}
.mn-status .s{font-size:18px;font-weight:700;color:var(--emerald);}
.mn-status .upd{font-size:13px;font-weight:700;color:var(--emerald);border:1.5px solid var(--emerald);border-radius:20px;padding:8px 14px;min-height:40px;display:flex;align-items:center;cursor:pointer;}
/* 品类删除行 */
.mn-cat{display:flex;align-items:center;justify-content:space-between;padding:0 16px;min-height:56px;border-top:1px solid var(--line);background:#fff;}
.mn-cat:first-child{border-top:none;}
.mn-cat .cn{font-size:15px;color:#27433A;}
.mn-cat .del{font-size:14px;color:var(--red);font-weight:600;min-height:44px;display:flex;align-items:center;padding-left:16px;cursor:pointer;}
/* 权限行 */
.mn-perm{display:flex;align-items:center;gap:12px;padding:14px 16px;border-top:1px solid var(--line);}
.mn-perm:first-child{border-top:none;}
.mn-perm .pb{flex:1;}.mn-perm .pn{font-size:15px;font-weight:600;}.mn-perm .pd{font-size:12.5px;color:var(--sub);margin-top:3px;line-height:1.4;}
.mn-perm .go{display:flex;align-items:center;gap:2px;color:var(--emerald);font-size:14px;font-weight:700;min-height:44px;cursor:pointer;flex:0 0 auto;}
.mn-perm .go svg{width:15px;height:15px;stroke:var(--emerald);fill:none;stroke-width:2.4;}
.mn-tip{background:var(--red-soft);color:var(--red);font-size:12.5px;line-height:1.6;padding:12px 16px;margin:0;}
.mn-note{font-size:12.5px;color:var(--sub);line-height:1.6;padding:14px 20px 4px;}
.mn-copy{font-size:13.5px;color:var(--emerald);font-weight:700;margin-top:10px;display:inline-flex;align-items:center;min-height:44px;cursor:pointer;}
.mn-redhint{color:var(--red);font-size:12.5px;line-height:1.6;margin:4px 0 10px;}
/* 营业信息 Tab */
.mn-tabs{display:flex;gap:8px;flex-wrap:wrap;padding:10px 16px 4px;}
.mn-tabs .tb{min-height:40px;display:flex;align-items:center;padding:0 16px;border-radius:20px;font-size:13.5px;font-weight:600;background:#fff;color:#27433A;box-shadow:var(--sh-sm);cursor:pointer;}
.mn-tabs .tb.on{background:var(--emerald);color:#fff;box-shadow:0 6px 16px rgba(5,150,105,.28);}
.mn-wh{background:#fff;border-radius:18px;margin:12px 16px;padding:15px 16px;box-shadow:var(--sh-sm);}
.mn-wh .wn{font-size:16px;font-weight:700;display:flex;align-items:center;gap:8px;}
.mn-wh .wn .rg{font-size:10.5px;font-weight:700;color:var(--emerald-2);background:var(--mint-soft);padding:1px 7px;border-radius:6px;}
.mn-wh .winfo{margin-top:13px;padding-top:12px;border-top:1px solid var(--line);display:flex;align-items:center;justify-content:space-between;}
.mn-wh .winfo .wl{font-size:14px;color:#46604F;}
.mn-wh .winfo .we{font-size:14px;color:var(--emerald);font-weight:700;min-height:44px;display:flex;align-items:center;cursor:pointer;}
.mn-wh .wst{display:flex;align-items:center;justify-content:space-between;margin-top:6px;min-height:44px;cursor:pointer;}
.mn-wh .wst .wl{font-size:14px;color:#46604F;}
.mn-wh .wst .wv{font-size:14px;font-weight:600;display:flex;align-items:center;gap:4px;}
.mn-wh .wst .wv.open{color:var(--emerald);}.mn-wh .wst .wv.close{color:var(--amber);}
.mn-wh .wst .wv svg{width:15px;height:15px;stroke:currentColor;fill:none;stroke-width:2.4;}
/* 营业时间与截单 */
.bh-tip{background:var(--muted);color:var(--sub);font-size:12.5px;line-height:1.6;padding:12px 16px;margin:0;}
.bh-card{background:#fff;border-radius:16px;margin:12px 16px;padding:14px 16px;box-shadow:var(--sh-sm);}
.bh-hd{display:flex;align-items:center;gap:10px;}
.bh-hd .bh-day{font-size:16px;font-weight:700;}
.bh-hd .bh-st{font-size:13px;color:var(--sub);}
.bh-sw{margin-left:auto;width:46px;height:27px;border-radius:16px;background:#D7E3DC;position:relative;transition:.18s;flex:0 0 46px;cursor:pointer;}
.bh-sw .dot{position:absolute;top:3px;left:3px;width:21px;height:21px;border-radius:50%;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.2);transition:.18s;}
.bh-sw.on{background:var(--emerald);}.bh-sw.on .dot{left:22px;}
.bh-row{display:flex;align-items:center;justify-content:space-between;margin-top:13px;gap:10px;}
.bh-row .bh-lb{font-size:14px;color:#46604F;flex:0 0 auto;}
.bh-time{display:flex;align-items:center;gap:6px;font-size:14px;color:var(--ink);}
.bh-time input{font-family:inherit;font-size:14px;padding:7px 9px;border:1px solid var(--line);border-radius:10px;background:#fff;color:var(--ink);min-height:38px;}
.bh-seg{display:flex;gap:6px;}
.bh-seg span{font-size:12.5px;font-weight:600;padding:8px 12px;border-radius:16px;background:var(--muted);color:var(--sub);cursor:pointer;min-height:38px;display:flex;align-items:center;}
.bh-seg span.on{background:var(--emerald);color:#fff;}
.bh-hint{font-size:12px;color:var(--sub);margin-top:10px;}
.bh-rest{font-size:13px;color:var(--sub);margin-top:12px;}
`;
document.head.appendChild(css);

const ARR=`<span class="arr">${svg('back','style="transform:rotate(180deg)"')}</span>`;
const eyeSvg='<svg viewBox="0 0 24 24"><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>';

/* ============ 我的 (填充 container) ============ */
function mineInline(container){
  const g1=[['营业时间设置','sign','hours'],['合同管理','invoice'],['服务能力','shieldcheck']];
  const g2=[['平台规则','box'],['联系客服','bell'],['廉正举报','alert'],['查看 Food Max 商城','tag'],['账号管理','user']];
  const rows=(arr)=>arr.map(m=>`<div class="mn-row" data-go="${m[2]||''}"><span class="ic">${svg(m[1])}</span><span class="nm">${m[0]}</span>${ARR}</div>`).join('');
  container.innerHTML=`
    <div class="mn-hd"><div class="t disp">我的</div></div>
    <div class="mn-acct">
      <div class="av">${svg('user')}</div>
      <div class="info"><div class="lb">账号</div><div class="ac">merchant-sg-0125</div></div>
      <div class="basic" id="mn-basic">基本信息 ›</div>
    </div>
    <div class="mn-grp">${rows(g1)}</div>
    <div class="mn-grp">${rows(g2)}</div>
    <div class="mn-foot">ICP / 营业执照编号：Reg. No. 201812345A · Food Max (SG) Pte Ltd ›</div>`;
  container.querySelector('#mn-basic').onclick=openBasic;
  container.querySelectorAll('.mn-row').forEach(r=>r.onclick=()=>{
    const go=r.dataset.go;
    if(go==='hours')openBizHours();else if(go==='biz')openBusinessStatus();else toast('待补录');
  });
}

/* ============ 基本信息 ============ */
function openBasic(){
  const g1=[['合作商信息',''],['经营信息','biz'],['店铺信息','store'],['主要经营品类信息','cat'],['经营城市信息','']];
  const g2=[['经营资质','qual','正常'],['法人信息','legal'],['授权人信息','auth']];
  const g3=[['系统权限管理','perm'],['第三方信息数据共享','']];
  const rows=(arr)=>arr.map(m=>`<div class="mn-row" data-go="${m[1]}"><span class="nm" style="margin-left:2px">${m[0]}</span>${m[2]?`<span class="rt ok">${m[2]}</span>`:''}${ARR}</div>`).join('');
  pushPage({title:'基本信息',body:`
    <div class="mn-grp" style="margin-top:14px">${rows(g1)}</div>
    <div class="mn-grp">${rows(g2)}</div>
    <div class="mn-grp">${rows(g3)}</div>
    <div style="height:16px"></div>`,
    mount:(p)=>p.querySelectorAll('.mn-row').forEach(r=>r.onclick=()=>{
      const go=r.dataset.go;const map={store:openStore,hours:openBizHours,biz:openBiz,cat:openCats,qual:openQual,perm:openPerm,legal:openLegal,auth:openAuth};
      map[go]?map[go]():toast('待补录');
    })});
}

/* ============ 店铺信息 ============ */
function openStore(){
  pushPage({title:'店铺信息',body:`
    <div class="mn-list" style="margin-top:14px"><div class="mn-item"><span class="k">店铺名称 <span class="q">?</span></span><span class="v">鲜丰食材 Fresh Harvest Pte Ltd</span></div></div>
    <div class="mn-fld"><div class="fk">店铺logo <span class="q">?</span></div><div style="height:8px"></div><div class="mn-up">${svg('box')}上传图片</div></div>
    <div class="mn-fld"><div class="fk">店铺背景</div><div class="fh">至多上传五张图片，将按照图片顺序依次展示</div><div class="mn-up">${svg('box')}上传图片</div></div>
    <div style="height:10px"></div>`,
    footer:`<button class="btn primary" disabled>提交审核</button>`,
    mount:(p)=>p.querySelectorAll('.mn-up').forEach(u=>u.onclick=()=>toast('选择图片'))});
}

/* ============ 营业时间与截单（对齐 PC「店铺管理·营业管理」：每日营业时段 start–end 可配，
   截止时间即当日截单时间；截单后下单限制方式逐日可配 t2 顺延 / stop 停止接单） ============ */
const PLATFORM_CUTOFF='18:00';  // 平台公共截单时间(平台级上限)；商家截止不得晚于此，入驻默认初始化 00:00~此
const BIZ_WEEK=[
  {d:'周一',on:true,start:'00:00',end:'15:00',mode:'t2'},
  {d:'周二',on:true,start:'00:00',end:'15:00',mode:'t2'},
  {d:'周三',on:true,start:'00:00',end:'15:00',mode:'t2'},
  {d:'周四',on:true,start:'00:00',end:'15:00',mode:'t2'},
  {d:'周五',on:true,start:'00:00',end:'15:00',mode:'stop'},
  {d:'周六',on:true,start:'06:00',end:'12:00',mode:'stop'},
  {d:'周日',on:false,start:'00:00',end:'00:00',mode:'t2'},
];
function bhCard(w,i){
  return `<div class="bh-card">
    <div class="bh-hd"><span class="bh-day">${w.d}</span><span class="bh-st">${w.on?'营业':'休息'}</span><span class="bh-sw ${w.on?'on':''}" data-on="${i}"><span class="dot"></span></span></div>
    ${w.on?`
    <div class="bh-row"><span class="bh-lb">营业时段</span><span class="bh-time"><input type="time" data-start="${i}" value="${w.start}"> – <input type="time" data-end="${i}" max="${PLATFORM_CUTOFF}" value="${w.end}" style="${w.end>PLATFORM_CUTOFF?'border-color:var(--red);color:var(--red)':''}"></span></div>
    <div class="bh-row"><span class="bh-lb">截单后限制</span><span class="bh-seg"><span class="${w.mode=='t2'?'on':''}" data-mode="${i}:t2">T+2 顺延</span><span class="${w.mode=='stop'?'on':''}" data-mode="${i}:stop">截单后停止</span></span></div>
    <div class="bh-hint">${w.end>PLATFORM_CUTOFF?`<span style="color:var(--red)">截止不得晚于平台截单 ${PLATFORM_CUTOFF}</span> · `:''}截止 <b>${w.end}</b> 即当日截单时间 · ${w.mode=='t2'?'截单后仍可下单，最早配送顺延至 T+2 起':'截单后至 23:59:59 停止接单，客户次日再下单'}</div>
    `:`<div class="bh-rest">今日休息，前台展示「今日休息」，客户当天不可下单</div>`}
  </div>`;
}
function openBizHours(){
  pushPage({title:'营业时间设置',body:`
    <div class="bh-tip">平台公共截单时间 <b>${PLATFORM_CUTOFF}</b>：各日<b>截止时间不得晚于 ${PLATFORM_CUTOFF}</b>（只能往前收紧）。截止时间即当日截单时间；截单后限制方式（T+2 顺延 / 截单后停止）逐日可配。入驻默认初始化为 00:00 ~ ${PLATFORM_CUTOFF}、全周营业。</div>
    <div id="bh-list"></div><div style="height:10px"></div>`,
    footer:`<button class="btn primary" id="bh-save">更新保存</button>`,
    mount:(p)=>{
      const list=p.querySelector('#bh-list');
      const draw=()=>{
        list.innerHTML=BIZ_WEEK.map((w,i)=>bhCard(w,i)).join('');
        list.querySelectorAll('[data-on]').forEach(el=>el.onclick=()=>{const i=+el.dataset.on;BIZ_WEEK[i].on=!BIZ_WEEK[i].on;draw();});
        list.querySelectorAll('[data-mode]').forEach(el=>el.onclick=()=>{const a=el.dataset.mode.split(':');BIZ_WEEK[+a[0]].mode=a[1];draw();});
        list.querySelectorAll('[data-start]').forEach(el=>el.onchange=()=>{BIZ_WEEK[+el.dataset.start].start=el.value;draw();});
        list.querySelectorAll('[data-end]').forEach(el=>el.onchange=()=>{BIZ_WEEK[+el.dataset.end].end=el.value;draw();});
      };
      draw();
      const b=p.querySelector('#bh-save');
      b.onclick=()=>{
        // 校验：营业日截止不得晚于平台公共截单时间；开始须早于截止
        for(const w of BIZ_WEEK){if(!w.on)continue;
          if(w.end>PLATFORM_CUTOFF)return toast(`${w.d}：截止时间不得晚于平台截单 ${PLATFORM_CUTOFF}`);
          if(w.start>=w.end)return toast(`${w.d}：开始时间须早于截止时间`);}
        b.classList.add('loading');setTimeout(()=>{b.classList.remove('loading');toast('营业时间已保存');setTimeout(popPage,600);},700);};
    }});
}

/* ============ 经营信息 ============ */
function openBiz(){
  const fields=[
    ['入驻当下是否只做线上','请选择'],['全渠道近一个月销售额','请选择'],['下游出货渠道','请选择'],
    ['近一年月均销售规模(斤)','请选择'],['日均整体出货量(吨)','请选择'],['近一年白牌销售额','请选择'],
    ['线下经营 SKU 数','请选择'],['全渠道经营商品数','请选择'],['线上日均销售规模占比','请选择'],
  ];
  pushPage({title:'经营信息',body:`
    <div class="mn-list" style="margin-top:14px">
      ${fields.map(f=>`<div class="mn-item tap"><span class="k"><span class="req">*</span>${f[0]}</span><span class="v ph">${f[1]}</span>${ARR}</div>`).join('')}
    </div><div style="height:10px"></div>`,
    footer:`<button class="btn primary" id="mn-save">更新保存</button>`,
    mount:(p)=>{
      p.querySelectorAll('.mn-item.tap').forEach(it=>it.onclick=()=>toast('请选择'));
      const b=p.querySelector('#mn-save');
      b.onclick=()=>{b.classList.add('loading');setTimeout(()=>{b.classList.remove('loading');toast('已更新保存');setTimeout(popPage,600);},700);};
    }});
}

/* ============ 主要经营品类信息 ============ */
const CATS=['调理包/酒店菜料包','休闲食品/包装肉制品','休闲食品/方便食品','蔬菜水果/新鲜蔬菜','蔬菜水果/新鲜水果',
  '蔬菜水果/加工蔬菜','蔬菜水果/加工水果','肉禽水产(鲜)/冰鲜水产','肉禽水产(冷冻)/鸡肉冻','肉禽水产(冷冻)/牛肉冻','速食熟食/豆制品'];
function openCats(){
  pushPage({title:'主要经营品类信息',body:`<div class="mn-list" id="mn-cl" style="margin-top:14px"></div><div style="height:10px"></div>`,
    footer:`<button class="btn primary" id="mn-cs">提交审核</button>`,
    mount:(p)=>{
      const list=p.querySelector('#mn-cl');const data=CATS.slice();
      const draw=()=>{
        if(!data.length){list.innerHTML=`<div class="empty" style="padding:50px 40px"><div class="ei">${svg('box')}</div><h4>暂无经营品类</h4><p>添加主要经营品类后提交审核</p></div>`;return;}
        list.innerHTML=data.map((c,i)=>`<div class="mn-cat"><span class="cn">${c}</span><span class="del" data-i="${i}">删除</span></div>`).join('');
        list.querySelectorAll('.del').forEach(d=>d.onclick=()=>{
          const i=+d.dataset.i;
          confirmDialog({title:'确认删除该品类？',body:`「${data[i]}」删除后需重新提交审核方可恢复。`,danger:1,okText:'删除',onOk:()=>{data.splice(i,1);draw();toast('已删除');}});
        });
      };
      draw();
      const b=p.querySelector('#mn-cs');
      b.onclick=()=>{b.classList.add('loading');setTimeout(()=>{b.classList.remove('loading');toast('已提交审核');setTimeout(popPage,600);},700);};
    }});
}

/* ============ 经营资质 ============ */
function openQual(){
  pushPage({title:'经营资质',body:`
    <div class="mn-status" style="margin-top:14px"><span class="s">正常</span><span class="upd" id="mn-upd">立即更新</span></div>
    <div class="mn-qz">
      <div class="qt"><span class="req">*</span>营业执照</div>
      <div class="qimg">营业执照照片</div>
      <div class="qr"><span class="qk">合作商名称</span><span class="qv">鲜丰食材 Fresh Harvest Pte Ltd</span></div>
      <div class="qr"><span class="qk">UEN</span><span class="qv">201812345A</span></div>
      <div class="qr"><span class="qk">有效期类型</span><span class="qv">有截止日期</span></div>
      <div class="qr"><span class="qk">到期日</span><span class="qv">2030-03-23</span></div>
    </div>
    <div class="mn-qz">
      <div class="qt"><span class="req">*</span>食品经营许可证</div>
      <div class="qimg">食品经营许可证照片</div>
      <div class="qr"><span class="qk">有效期类型</span><span class="qv">有截止日期</span></div>
      <div class="qr"><span class="qk">到期日</span><span class="qv">2030-03-05</span></div>
    </div><div style="height:10px"></div>`,
    mount:(p)=>p.querySelector('#mn-upd').onclick=()=>toast('待补录')});
}

/* ============ 系统权限管理 ============ */
function openPerm(){
  const perms=[
    ['位置信息权限','用于仓配、选品服务以及辅助快速设置发货地址'],
    ['相机权限','用于您扫码、拍照和上传图片'],
    ['存储(相册)权限','用于您保存或上传商品图片和视频'],
    ['蓝牙权限','用于蓝牙打印或扫码逐件装筐功能'],
    ['麦克风权限','用于您便捷录入语音信息'],
    ['通知权限','用于您及时获取消息提醒'],
  ];
  pushPage({title:'系统权限管理',body:`
    <div class="mn-note">为了向您提供更好的用户体验，特定场景下可能需要向您申请以下手机系统权限</div>
    <div class="mn-list">
      ${perms.map(p=>`<div class="mn-perm"><div class="pb"><div class="pn">${p[0]}</div><div class="pd">${p[1]}</div></div><div class="go">去开启 ${svg('back','style="transform:rotate(180deg)"')}</div></div>`).join('')}
    </div><div style="height:10px"></div>`,
    mount:(p)=>p.querySelectorAll('.go').forEach(g=>g.onclick=()=>toast('前往系统设置开启'))});
}

/* ============ 法人信息 ============ */
function openLegal(){
  pushPage({title:'法人信息',body:`
    <div class="mn-note">法人信息（依照行业规定，平台需校验法人证件信息）</div>
    <div class="mn-list">
      <div class="mn-item"><span class="k">证件类型</span><span class="v">NRIC（新加坡身份证）</span></div>
    </div>
    <div class="mn-fld"><div class="fk">法人证件照片</div><div style="height:8px"></div><div class="mn-up">${svg('box')}证件照片</div></div>
    <div class="mn-list">
      <div class="mn-item"><span class="k">姓名</span><span class="v">陈志明 Tan Chee Meng</span></div>
      <div class="mn-item"><span class="k">证件号</span><span class="v">S81*****7C</span><span class="eye">${eyeSvg}</span></div>
      <div class="mn-item"><span class="k">手机号</span><span class="v">+65 8***4567</span><span class="eye">${eyeSvg}</span></div>
      <div class="mn-item"><span class="k">证件有效期</span><span class="v">长期有效</span></div>
    </div><div style="height:10px"></div>`,
    footer:`<button class="btn primary" id="mn-ed">编辑</button>`,
    mount:(p)=>p.querySelector('#mn-ed').onclick=()=>toast('待补录')});
}

/* ============ 授权人信息 ============ */
function openAuth(){
  pushPage({title:'授权人信息',body:`
    <div class="mn-sec bar" style="margin-bottom:4px">授权人信息</div>
    <div class="mn-list">
      <div class="mn-item"><span class="k"><span class="req">*</span>姓名</span><span class="v">林伟强 Lim Wei Qiang</span></div>
      <div class="mn-item"><span class="k"><span class="req">*</span>身份证号</span><span class="v">S90*****5D</span><span class="eye">${eyeSvg}</span></div>
      <div class="mn-item"><span class="k"><span class="req">*</span>预留手机号</span><span class="v">+65 9***1234</span><span class="eye">${eyeSvg}</span></div>
    </div>
    <div class="mn-fld">
      <div class="fk"><span class="req">*</span>上传盖章授权照片</div>
      <div class="mn-redhint">请您下载打印授权函，填写企业和授权人信息，盖企业公章后，拍照上传。授权函审核通过，且合同完成签章后合同生效。</div>
      <div class="mn-up">${svg('box')}盖章授权照片</div>
      <div class="mn-copy" id="mn-cp">复制授权函模板 · 复制链接后请打开浏览器下载</div>
    </div><div style="height:10px"></div>`,
    footer:`<button class="btn primary" id="mn-ed">编辑</button>`,
    mount:(p)=>{p.querySelector('#mn-cp').onclick=()=>toast('已复制授权函模板链接');p.querySelector('#mn-ed').onclick=()=>toast('待补录');p.querySelector('.mn-up').onclick=()=>toast('选择图片');}});
}

/* ============ 营业信息 ============ */
const WAREHOUSES=[
  {n:'大巴窑 DC',rg:'中区',st:'open'},
  {n:'盛港 DC',rg:'东区',st:'open'},
  {n:'淡滨尼 DC',rg:'东区',st:'open'},
  {n:'裕廊 DC',rg:'西区',st:'open'},
  {n:'兀兰 DC',rg:'北区',st:'close'},
  {n:'义顺 DC',rg:'北区',st:'open'},
];
function openBusinessStatus(){
  const TABS=['全部','中区','东区','西区','北区'];
  pushPage({title:'营业信息',body:`
    <div class="mn-tip">注：若您将合作商营业状态设置为「临时歇业」，则您合作城市下所有仓的营业状态均为「临时歇业」。</div>
    <div class="mn-sec">合作商营业信息</div>
    <div class="mn-list"><div class="mn-item tap" id="mn-bz"><span class="k">营业状态</span><span class="v" id="mn-bzv">正常营业</span>${ARR}</div></div>
    <div class="mn-sec">城市营业信息<span class="act" id="mn-batch">批量设置</span></div>
    <div class="mn-tabs" id="mn-tabs">${TABS.map((t,i)=>`<div class="tb${i===0?' on':''}" data-t="${t}">${t}</div>`).join('')}</div>
    <div id="mn-whs"></div><div style="height:10px"></div>`,
    mount:(p)=>{
      const whs=p.querySelector('#mn-whs');
      const draw=(tab)=>{
        const data=tab==='全部'?WAREHOUSES:WAREHOUSES.filter(w=>w.rg===tab);
        whs.innerHTML=data.map(w=>{
          const open=w.st==='open';
          return `<div class="mn-wh" data-n="${w.n}">
            <div class="wn">${w.n}<span class="rg">${w.rg}</span></div>
            <div class="winfo"><span class="wl">营业信息</span><span class="we" data-edit>编辑 ›</span></div>
            <div class="wst" data-wst><span class="wl">营业状态</span><span class="wv ${open?'open':'close'}">${open?'正常营业':'临时歇业'} ${svg('back','style="transform:rotate(180deg)"')}</span></div>
          </div>`;}).join('');
        whs.querySelectorAll('[data-edit]').forEach(e=>e.onclick=(ev)=>{ev.stopPropagation();toast('编辑仓营业信息');});
        whs.querySelectorAll('[data-wst]').forEach(el=>el.onclick=()=>{
          const card=el.closest('.mn-wh');const w=WAREHOUSES.find(x=>x.n===card.dataset.n);
          sheet([
            {label:'正常营业',onClick:()=>{w.st='open';draw(tab);toast('已设为正常营业');}},
            {label:'临时歇业',danger:1,onClick:()=>confirmDialog({title:'设为临时歇业？',body:`「${w.n}」临时歇业后客户将无法在该仓下单，可随时恢复。`,danger:1,okText:'临时歇业',onOk:()=>{w.st='close';draw(tab);toast('已临时歇业');}})},
          ]);
        });
      };
      let cur='全部';draw(cur);
      p.querySelectorAll('#mn-tabs .tb').forEach(t=>t.onclick=()=>{
        p.querySelectorAll('#mn-tabs .tb').forEach(x=>x.classList.remove('on'));t.classList.add('on');cur=t.dataset.t;draw(cur);
      });
      p.querySelector('#mn-batch').onclick=()=>toast('批量设置营业状态');
      p.querySelector('#mn-bz').onclick=()=>{
        const vEl=p.querySelector('#mn-bzv');
        sheet([
          {label:'正常营业',onClick:()=>{vEl.textContent='正常营业';toast('已设为正常营业');}},
          {label:'临时歇业（影响所有仓）',danger:1,onClick:()=>confirmDialog({title:'合作商临时歇业？',body:'设为「临时歇业」后，您合作城市下所有仓的营业状态将同步为「临时歇业」，客户无法下单。',danger:1,okText:'临时歇业',onOk:()=>{vEl.textContent='临时歇业';WAREHOUSES.forEach(w=>w.st='close');toast('已临时歇业');}})},
        ]);
      };
    }});
}

window.FM_MOD=window.FM_MOD||{};
window.FM_MOD.mineInline=mineInline;
})();
