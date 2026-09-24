/* 商家 PC 后台 · 新订单语音播报（2026-09-24 沈亮拍板口径）
   只做 PC；挂在「消息设置」页（整页）+ 顶栏播报状态。
   口径：
   - 计单：已支付子单，按支付成功时间计入本截单批次；取消的不计入今日累计
   - 定时播报：营业时段内按频率在整点/半点触发（30min / 1h 默认 / 2h），区间内无新单不播
   - 截单播报：到当日截单时间必播（0 单也播）；与定时点重合只播截单这一条
   - 截单时仍有待支付单 → 截单播报里提示「再等等」；待支付全部有结果（支付/超时关闭）后补播一次
   - 休息日整天不播；语言跟随后台当前语言；默认开启
   PAGES: m-message-pref（整页只有本卡）；topRight 包一层加播报状态 */
(function(){

const FREQ=[
  {k:30, n:'每 30 分钟', s:'整点、半点各播一次'},
  {k:60, n:'每 1 小时',  s:'每个整点播一次'},
  {k:120,n:'每 2 小时',  s:'偶数整点播一次'},
];
function ensureVoice(){
  if(!DB.voice)DB.voice={on:1,freq:60,unlocked:0,lang:'zh'};
}
const pad=n=>(''+n).padStart(2,'0');

/* 播报音频：固定录音，每种场景一段（中 / 英各一个文件），不含数量；数量只在右下角播报卡上以文字显示
   id 即音频文件名前缀：<id>_zh.mp3 / <id>_en.mp3 */
const TPL={
  tick:   {id:'ORDER_NEW',          sc:'定时播报',          when:'营业时段内按频率触发', cond:'距上次播报有新订单（无新单不播）',
           zh:'您有新订单，请及时查看。',
           en:'You have new orders. Please check them.'},
  cut:    {id:'ORDER_CUTOFF',       sc:'截单播报',          when:'到达当日截单时间', cond:'今日有订单，且无待支付',
           zh:'今日已截单，请开始备货。',
           en:'Orders are now closed for today. Please start preparing.'},
  cutWait:{id:'ORDER_CUTOFF_WAIT',  sc:'截单播报 · 有待支付', when:'到达当日截单时间', cond:'截单时仍有订单待客户支付',
           zh:'今日已截单，还有订单等待客户支付，请稍等。',
           en:'Orders are now closed for today. Some orders are still waiting for payment. Please hold on.'},
  cutZero:{id:'ORDER_CUTOFF_NONE',  sc:'截单播报 · 无订单', when:'到达当日截单时间', cond:'今日无订单，也无待支付',
           zh:'今日已截单，今日暂无订单。',
           en:'Orders are now closed for today. There are no orders today.'},
  final:  {id:'ORDER_PAYMENT_DONE', sc:'待支付补播',        when:'截单时的待支付单全部支付或超时关闭', cond:'截单时有过待支付订单',
           zh:'待支付订单已处理完毕，请开始备货。',
           en:'All pending payments are done. Please start preparing.'},
  cancel: {id:'ORDER_CANCELLED_CHECK', sc:'追加 · 有取消单',   when:'紧接截单播报 / 待支付补播之后', cond:'本批次有已支付后取消的订单',
           zh:'今日有订单已取消，请核对备货数量，避免多备。',
           en:'Some orders were cancelled today. Please check your quantities to avoid over-preparing.'},
  label:  {id:'LABEL_UNPRINTED',    sc:'追加 · 未打标签',   when:'紧接截单播报 / 待支付补播之后', cond:'本批次有订单标签未打印',
           zh:'还有订单标签没有打印，请尽快打印。',
           en:'Some order labels have not been printed yet. Please print them soon.'},
};
/* 截单时刻的播放队列：主播报（cut / cutWait / cutZero 三选一）→ 有取消单则追加 cancel → 有未打标签则追加 label；
   待支付补播同理：final → cancel? → label?（cancel 只追加截单后新增的取消）。每段之间停顿 0.6s */
/* 播报卡上的数量（文字，不进语音）：演示数 */
const CARD_NUM={tick:'本次新增 3 笔 · 今日累计 12 笔',cut:'今日共 14 笔',cutWait:'已支付 12 笔 · 待支付 2 笔',cutZero:'今日 0 笔',final:'截单后新增支付 2 笔 · 今日最终 14 笔',cancel:'已取消 2 笔（已支付后取消）',label:'未打标签 5 笔'};
const CARD_GO={label:['去打印标签','m-pick-label'],cancel:['去看备货参考','m-pick-ref']};

function todayCfg(){const b=DB.bizCfg;const i=bizTodayIdx();return {w:b.week[i],d:b.week[i].d};}
/* 今日播报时间点：营业开始后、截单前的频率点 + 截单点 */
function todaySlots(){
  ensureVoice();const {w}=todayCfg();if(!w.on)return [];
  const toM=hm=>{const [h,m]=hm.split(':').map(Number);return h*60+m;};
  const s=toM(w.start),e=toM(w.end),f=DB.voice.freq,out=[];
  for(let t=Math.ceil((s+1)/f)*f;t<e;t+=f)out.push(pad(Math.floor(t/60))+':'+pad(t%60));
  return out;
}

/* 选音色：浏览器按 lang 兜底会挑到系统老式合成音（生硬），这里按自然度优先级显式指定 */
const VOICE_PREF={en:['Google UK English Female','Google US English','Samantha','Daniel','Karen','Moira'],zh:['Google 普通话（中国大陆）','Tingting','婷婷']};
function pickVoice(lang){try{const vs=speechSynthesis.getVoices();
  for(const n of VOICE_PREF[lang]){const v=vs.find(x=>x.name===n);if(v)return v;}
  return vs.find(x=>x.lang.indexOf(lang=='en'?'en':'zh')===0&&!x.localService)||null;}catch(e){return null;}}
try{speechSynthesis.getVoices();speechSynthesis.onvoiceschanged=()=>speechSynthesis.getVoices();}catch(e){}

/* ── 播放：浏览器 TTS + 右下角播报卡 ─────────────────────────────── */
/* keys：单段 'tick'，或截单组合 'cutWait,cancel,label'（逗号分隔，按序播放） */
window.voicePlay=function(keys,lang){
  ensureVoice();lang=lang||DB.voice.lang;const ks=keys.split(',');
  try{if(window.speechSynthesis){speechSynthesis.cancel();const vc=pickVoice(lang);
    ks.forEach((k,i)=>{const t=TPL[k];
      if(i){const gap=new SpeechSynthesisUtterance(' ');gap.volume=0;gap.rate=.6;speechSynthesis.speak(gap);}   // 段间停顿
      const u=new SpeechSynthesisUtterance(lang=='en'?t.en:t.zh);u.lang=lang=='en'?'en-GB':'zh-CN';if(vc)u.voice=vc;u.rate=1;speechSynthesis.speak(u);});}}catch(e){}
  voiceCard(ks,lang);
};
function voiceCard(ks,lang){
  let c=document.getElementById('voicecard');
  if(!c){c=document.createElement('div');c.id='voicecard';document.body.appendChild(c);}
  const now=new Date(),hm=pad(now.getHours())+':'+pad(now.getMinutes());
  const isCut=ks[0]!='tick';
  const lines=ks.map((k,i)=>{const t=TPL[k];const warn=k=='cancel'||k=='label';
    return `<div style="padding:${i?'10px':'14px'} 16px 0;${i?'border-top:1px dashed var(--bd2);margin-top:10px;':''}">
      <div style="font-size:14px;line-height:1.6;color:${warn?'var(--r)':'var(--tp)'}">${warn?'⚠️ ':''}${lang=='en'?t.en:t.zh}</div>
      <div style="display:flex;align-items:center;margin-top:3px;font-size:12.5px;color:var(--ts)">${CARD_NUM[k]}
        ${CARD_GO[k]?`<a href="javascript:voiceCardClose();nav('${CARD_GO[k][1]}')" style="margin-left:auto">${CARD_GO[k][0]} →</a>`:''}</div></div>`;}).join('');
  c.setAttribute('style','position:fixed;right:24px;bottom:24px;z-index:900;width:360px;background:#fff;border:1px solid var(--bd);border-radius:14px;box-shadow:0 12px 32px rgba(18,39,29,.16);animation:pop .18s ease-out;overflow:hidden');
  c.innerHTML=`<div style="display:flex;align-items:center;gap:8px;padding:12px 16px;background:${isCut?'var(--goldl)':'var(--gl)'};color:${isCut?'var(--gold)':'var(--gd)'};font-weight:700;font-size:13.5px">
      <span style="font-size:16px">🔊</span>${TPL[ks[0]].sc}<span style="margin-left:auto;font-weight:500;font-size:12.5px">${hm}</span>
      <span style="cursor:pointer;font-size:18px;line-height:1;margin-left:6px;color:var(--ts)" onclick="voiceCardClose()">×</span></div>
    ${lines}
    <div style="display:flex;justify-content:flex-end;gap:8px;padding:14px 16px">
      <button class="btn btn-o btn-sm" onclick="voicePlay('${ks.join(',')}','${lang}')">再听一遍</button>
      <button class="btn btn-p btn-sm" onclick="voiceCardClose();nav('m-order')">查看订单</button></div>`;
  clearTimeout(window._vcT);
  if(!isCut)window._vcT=setTimeout(voiceCardClose,15000);   // 定时播报 15s 自动收起；截单类需手动关
}
window.voiceCardClose=function(){const c=document.getElementById('voicecard');if(c)c.remove();try{speechSynthesis.cancel();}catch(e){}};

/* ── 设置交互 ─────────────────────────────────────────────────── */
window.voiceOn=function(el){ensureVoice();DB.voice.on=el.checked?1:0;render();toast(el.checked?'已开启新订单语音播报':'已关闭新订单语音播报','ok');};
window.voiceFreq=function(k){ensureVoice();DB.voice.freq=k;render();toast('播报频率已改为「'+FREQ.find(f=>f.k==k).n+'」，下一个时间点生效','ok');};
window.voiceUnlock=function(){ensureVoice();if(DB.voice.unlocked)return;DB.voice.unlocked=1;
  try{if(window.speechSynthesis){const u=new SpeechSynthesisUtterance('');speechSynthesis.speak(u);}}catch(e){}render();};
/* 浏览器要求用户与页面有过交互后才允许出声：任意一次点击即视为启用 */
if(!window._voiceGesture){window._voiceGesture=1;document.addEventListener('pointerdown',()=>{if(window.DB&&DB.voice&&!DB.voice.unlocked&&DB.role=='merchant'){DB.voice.unlocked=1;setTimeout(render,0);}},{capture:true});}

/* ── 顶栏：播报状态 ───────────────────────────────────────────── */
const _topRight=topRight;
topRight=function(){
  const h=_topRight();
  if(DB.role!='merchant')return h;
  ensureVoice();const {w}=todayCfg();
  let v;
  if(!DB.voice.on)v=`<span class="tb-bell" title="新订单语音播报已关闭" onclick="nav('m-message-pref')" style="cursor:pointer;width:34px;height:34px;border-radius:9px;display:inline-flex;align-items:center;justify-content:center;font-size:17px;opacity:.45">🔇</span>`;
  else if(!DB.voice.unlocked)v=`<span class="pill warn" style="cursor:pointer" onclick="voiceUnlock()" title="浏览器需点击一次页面才允许播放声音">🔇 点击启用语音播报</span>`;
  else v=`<span class="tb-bell" title="${w.on?'新订单语音播报已开启 · 今日截单 '+w.end:'今日休息，不播报'}" onclick="nav('m-message-pref')" style="cursor:pointer;width:34px;height:34px;border-radius:9px;display:inline-flex;align-items:center;justify-content:center;font-size:17px">🔊</span>`;
  const i=h.indexOf('<span class="tb-bell"');
  return i<0?h+v:h.slice(0,i)+v+h.slice(i);
};

/* ── 消息设置页：只含「新订单语音播报」卡 ───────────────────────── */
PAGES['m-message-pref']=()=>{
  ensureVoice();const V=DB.voice,{w,d}=todayCfg(),slots=todaySlots();
  const dis=V.on?'':'opacity:.5;pointer-events:none';
  const freq=FREQ.map(f=>`<label style="display:flex;align-items:center;gap:8px;padding:9px 14px;border:1px solid ${V.freq==f.k?'var(--g)':'var(--bd)'};background:${V.freq==f.k?'var(--gl)':'#fff'};border-radius:10px;cursor:pointer">
      <input type="radio" name="vfreq" ${V.freq==f.k?'checked':''} onchange="voiceFreq(${f.k})"><span><b style="font-weight:600">${f.n}</b>${f.k==60?' <span class="sub" style="font-size:12px">（默认）</span>':''}<div class="sub" style="font-size:12px">${f.s}</div></span></label>`).join('');
  const today=w.on
    ?`<div>今日（${d}）营业 <b class="mono">${w.start} – ${w.end}</b>，截单播报 <b class="mono">${w.end}</b></div>
      <div class="sub" style="margin-top:6px;font-size:12.5px">定时播报点：${slots.length?slots.map(s=>`<span class="mono">${s}</span>`).join('、'):'无（营业时段短于播报间隔）'}</div>`
    :`<div>今日（${d}）<b>休息</b>，整天不播报</div>`;
  const rows=Object.keys(TPL).map(k=>{const t=TPL[k];return `<tr>
      <td class="nw" style="font-weight:600">${t.sc}</td>
      <td style="font-size:12.5px">${t.when}</td>
      <td style="font-size:12.5px">${t.cond}</td>
      <td style="font-size:13px">「${t.zh}」<div class="sub" style="font-size:12px;margin-top:3px">${t.en}</div></td>
      <td class="nw"><button class="btn btn-o btn-sm" onclick="voicePlay('${k}','zh')">▶ 中文</button> <button class="btn btn-o btn-sm" onclick="voicePlay('${k}','en')">▶ EN</button></td></tr>`;}).join('');

  const card=`<div class="card">
    <div class="card-hd"><h3>新订单语音播报</h3><span class="sub">仅 PC 后台 · 需保持后台页面打开</span>
      <label style="margin-left:auto;display:flex;align-items:center;gap:8px;cursor:pointer;font-weight:600">
        <input type="checkbox" ${V.on?'checked':''} onchange="voiceOn(this)">${V.on?'已开启':'已关闭'}</label></div>
    <div class="card-bd" style="${dis}">
      ${V.on&&!V.unlocked?`<div class="ib ib-y" style="margin-bottom:14px"><span class="i">🔇</span><div>浏览器需要你点击一次页面后才允许播放声音。<button class="btn btn-p btn-sm" style="margin-left:10px" onclick="voiceUnlock()">启用声音</button></div></div>`:''}
      <div class="fr"><div class="fl">播报频率</div><div style="display:flex;gap:10px;flex-wrap:wrap">${freq}</div>
        <div class="sub" style="margin-top:8px;font-size:12.5px">两个播报点之间的新订单合并成一条播报；这段时间没有新订单则不播。</div></div>
      <div class="fg2">
        <div class="fr"><div class="fl">今日播报</div><div class="ro-field" style="display:block">${today}
          <a href="javascript:nav('m-biz-hours')" style="font-size:12px;display:inline-block;margin-top:6px">截单时间在营业管理设置 →</a></div></div>
        <div class="fr"><div class="fl">播报语言</div><div class="ro-field">跟随后台语言 · 当前 <b style="margin-left:4px">中文</b></div></div>
      </div>
    </div>
    <div class="card-hd" style="border-top:1px solid var(--bd2)"><h3 style="font-size:14px">播报内容</h3><span class="sub">固定语音，每种情况一段；截单播报每天必播，有取消单 / 未打标签时在其后追加播报</span>
      <button class="btn btn-o btn-sm" style="margin-left:auto" onclick="voicePlay('cutWait,cancel,label','zh')">▶ 试听截单组合播报</button></div>
    <div class="card-bd flush" style="${dis}"><div style="overflow-x:auto"><table style="min-width:980px">
      <thead><tr><th style="width:170px">场景</th><th style="width:220px">触发时机</th><th style="width:200px">条件</th><th>播报语音（按后台语言播报其一）</th><th style="width:150px">试听</th></tr></thead>
      <tbody>${rows}</tbody></table></div></div>
  </div>`;
  return card;
};

})();
