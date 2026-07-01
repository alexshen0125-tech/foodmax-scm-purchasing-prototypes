/* Food Max 商家端 v2 · 消息中心模块
   还原快驴消息中心：通知开启黄条 + 搜索/只看未读 + 横滑分类 Tab + 消息列表
   评审修复内建：列表先骨架屏→数据/空 Tab .empty/去开启·只看未读可交互/触控≥44px/SG数据 */
(function(){
const {pushPage,toast,svg,skel}=window.FM;

const css=document.createElement('style');
css.textContent=`
/* 通知开启黄条 */
.mg-notify{display:flex;align-items:center;gap:10px;background:var(--amber-soft);color:#92400E;padding:13px 16px;font-size:14px;font-weight:600;}
.mg-notify .nt-txt{flex:1;line-height:1.3;}
.mg-notify .nt-go{background:#2563EB;color:#fff;font-size:13.5px;font-weight:700;border-radius:9px;padding:0 14px;min-height:34px;display:flex;align-items:center;cursor:pointer;flex:0 0 auto;}
.mg-notify .nt-x{width:34px;height:34px;display:flex;align-items:center;justify-content:center;font-size:18px;color:#92400E;cursor:pointer;flex:0 0 auto;}
/* 搜索 + 只看未读 */
.mg-bar{position:sticky;top:0;z-index:6;background:var(--bg);padding:10px 16px 4px;display:flex;align-items:center;gap:12px;}
.mg-search{flex:1;display:flex;align-items:center;gap:9px;background:#fff;border-radius:15px;min-height:44px;padding:0 14px;box-shadow:var(--sh-sm);color:var(--sub);font-size:14px;}
.mg-search svg{width:18px;height:18px;stroke:var(--sub);fill:none;stroke-width:2;}
.mg-unread{display:flex;align-items:center;gap:6px;min-height:44px;font-size:14px;font-weight:600;color:#27433A;cursor:pointer;flex:0 0 auto;}
.mg-unread .rc{width:18px;height:18px;border-radius:50%;border:2px solid #CBD5C7;display:flex;align-items:center;justify-content:center;flex:0 0 18px;}
.mg-unread.on .rc{background:var(--emerald);border-color:var(--emerald);}
.mg-unread.on .rc::after{content:"✓";color:#fff;font-size:11px;font-weight:700;}
.mg-unread.on{color:var(--emerald-2);}
/* 分类 Tab(横滑) */
.mg-tabs{display:flex;gap:18px;padding:8px 16px 0;overflow-x:auto;background:var(--bg);border-bottom:1px solid var(--line);}
.mg-tabs::-webkit-scrollbar{display:none;}
.mg-tab{flex:0 0 auto;font-size:15px;color:#46604F;padding:8px 0 12px;position:relative;cursor:pointer;min-height:44px;display:flex;align-items:center;}
.mg-tab.on{color:var(--emerald-2);font-weight:700;}
.mg-tab.on::after{content:"";position:absolute;left:50%;bottom:6px;transform:translateX(-50%);width:22px;height:3px;border-radius:3px;background:var(--emerald);}
/* 消息列表 */
.mg-list{padding:6px 16px 18px;}
.mg-item{background:#fff;border-radius:16px;padding:15px;margin-top:12px;box-shadow:var(--sh-sm);cursor:pointer;min-height:44px;}
.mg-item .hd{display:flex;align-items:center;gap:8px;}
.mg-item .dot{width:8px;height:8px;border-radius:50%;background:var(--red);flex:0 0 8px;}
.mg-item .ti{font-size:15.5px;font-weight:700;color:var(--ink);flex:1;min-width:0;}
.mg-item .tm{font-size:12.5px;color:var(--sub);flex:0 0 auto;}
.mg-item .bd{font-size:13.5px;color:#46604F;line-height:1.55;margin-top:9px;}
.mg-item .bd .lk{color:var(--emerald-2);font-weight:700;}
.mg-nomore{text-align:center;color:var(--sub);font-size:12.5px;padding:18px 0 4px;}
`;
document.head.appendChild(css);

// 分类 Tab
const TABS=['全部','违规通知','业务通知','系统功能','学习培训','奖励通知','新商必读','建改品咨询','其他'];
const SIGN='签到成功！请保持手机畅通，平台将与您核实到仓情况，请及时接听电话。若2次致电均未接通将收到"签到失败"通知，到仓后请重新签到。';
// 仅「全部」Tab 有数据，其余 Tab 为空态(暂无消息)
const MSGS=[
  {t:'签到成功通知',tm:'07-01 00:44',unread:1,bd:SIGN},
  {t:'签到成功通知',tm:'07-01 00:08',unread:0,bd:SIGN},
  {t:'截单送货提醒',tm:'06-30 23:15',unread:1,bd:'商城已截单，请及时送货'},
  {t:'售后判责通知',tm:'06-30 23:00',unread:0,bd:'您有2笔新增的可申诉售后单，如您对判责结果有疑义，可在3日内到售后管理处进行申诉，',lk:'点击查看详情。'},
];

function itemHTML(m){
  return `<div class="mg-item" data-id="${m.t}-${m.tm}">
    <div class="hd">${m.unread?'<span class="dot"></span>':''}<span class="ti">${m.t}</span><span class="tm">${m.tm}</span></div>
    <div class="bd">${m.bd}${m.lk?`<span class="lk">${m.lk}</span>`:''}</div>
  </div>`;
}

function renderMsgCenter(container){
  container.innerHTML=`
    <div class="mg-notify" id="mg-nt">
      <span class="nt-txt">开启通知，及时获取消息提醒！</span>
      <span class="nt-go" id="mg-go">去开启</span>
      <span class="nt-x" id="mg-x">✕</span>
    </div>
    <div class="mg-bar">
      <div class="mg-search">${svg('search')}输入关键词搜索</div>
      <div class="mg-unread" id="mg-ur"><span class="rc"></span>只看未读</div>
    </div>
    <div class="mg-tabs" id="mg-tabs">${TABS.map((t,i)=>`<div class="mg-tab${i===0?' on':''}" data-t="${i}">${t}</div>`).join('')}</div>
    <div class="mg-list" id="mg-list"></div>`;

  const list=container.querySelector('#mg-list');
  const state={tab:0,unreadOnly:false};

  function drawData(){
    let data=state.tab===0?MSGS.slice():[];            // 仅全部 Tab 有数据
    if(state.unreadOnly)data=data.filter(m=>m.unread);
    if(!data.length){
      list.innerHTML=`<div class="empty"><div class="ei">${svg('bell')}</div><h4>暂无消息</h4><p>${state.unreadOnly?'当前分类没有未读消息':'该分类下暂时没有新消息'}</p></div>`;
      return;
    }
    list.innerHTML=data.map(itemHTML).join('')+'<div class="mg-nomore">无更多数据</div>';
    list.querySelectorAll('.mg-item').forEach(el=>el.onclick=()=>{
      const m=data.find(x=>x.t+'-'+x.tm===el.dataset.id);
      m.unread=0;el.querySelector('.dot')&&el.querySelector('.dot').remove();
      toast('查看消息详情');
    });
  }
  function draw(){
    list.innerHTML=skel(3);                            // 骨架屏
    setTimeout(drawData,420);                           // 模拟加载
  }

  // 去开启 / 关闭黄条
  container.querySelector('#mg-go').onclick=()=>toast('前往系统设置开启通知');
  container.querySelector('#mg-x').onclick=()=>container.querySelector('#mg-nt').remove();
  // 只看未读
  const ur=container.querySelector('#mg-ur');
  ur.onclick=()=>{state.unreadOnly=!state.unreadOnly;ur.classList.toggle('on',state.unreadOnly);draw();};
  // 分类切换
  container.querySelectorAll('#mg-tabs .mg-tab').forEach(t=>t.onclick=()=>{
    container.querySelectorAll('#mg-tabs .mg-tab').forEach(x=>x.classList.remove('on'));
    t.classList.add('on');state.tab=+t.dataset.t;draw();
  });

  draw();
}

function openMessage(){
  pushPage({title:'消息',body:'<div id="mg-root"></div>',mount:(p)=>renderMsgCenter(p.querySelector('#mg-root'))});
}

// 入口：供首页铃铛触发
window.FM_MESSAGE=openMessage;
// 自绑定首页铃铛(不改其他文件，本模块加载后挂上点击)
const bell=document.querySelector('.hm-bell');
if(bell)bell.style.cursor='pointer',bell.onclick=openMessage;
})();
