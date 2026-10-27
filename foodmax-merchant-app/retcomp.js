/* Food Max 商家端 v2 · 财务 › 退货赔付（与 PC pc-modules/retcomp.js 同口径，2026-10-27 沈亮定）
   - 数据：退货申诉核定成立 / 部分成立且赔付 > 0 的记录（deliver.js FM_MOD.retCompSrc），一笔申诉一张卡
   - 钱：业务调整单「退货申诉赔付」进结算单（settle.js FM_MOD.settleBills 的 adjust[] 含该调整单号即归该单），随货款打款
   - 票：商家开票给 Foodmax，每张结算单就本期赔付合计开 1 张汇总票在此上传；未上传不影响打款
   - 校验：发票号码 / 开票日期 / 文件必填；发票金额（含税）必须 = 本期赔付合计；号码不能与其他结算单重复
   样式复用 replen.js 注入的 .rp-* 类 */
(function(){
const {pushPage,popPage,toast,svg,skel}=window.FM;
const money=n=>'S$'+(+n||0).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
const DB=window.FM.DB;
DB.retCompInv=DB.retCompInv||{
  'ST202605-M0815':{invNo:'GXY-INV-2606-018',invDate:'2026-06-02',amt:9.00,uploadAt:'2026-06-02 15:40',file:'GXY-INV-2606-018.pdf'}
};
const bills=()=>window.FM_MOD.settleBills?window.FM_MOD.settleBills():[];
const kindL=ra=>window.FM_MOD.raKindLabel?window.FM_MOD.raKindLabel(ra):ra.kind;
function compRows(){
  const bs=bills();
  return (window.FM_MOD.retCompSrc?window.FM_MOD.retCompSrc():[])
    .map(r=>({...r,bill:bs.find(b=>b.adjust.some(a=>a.no===r.adjNo))||null}))
    .sort((x,y)=>(y.ra.reviewAt||'').localeCompare(x.ra.reviewAt||''));
}
const settleSt=r=>!r.bill?'待进结算单':(r.bill.cur?'已进结算单':'已打款');
const invSt=billNo=>billNo&&DB.retCompInv[billNo]?'已上传':'待开票';
const SET_C={'待进结算单':'rp-c-gray','已进结算单':'rp-c-blue','已打款':'rp-c-green'};
const INV_C={'待开票':'rp-c-amber','已上传':'rp-c-green'};
const chip=(t,m)=>`<span class="rp-chip ${m[t]||'rp-c-gray'}">${t}</span>`;
function compBills(){
  const rs=compRows(),map={};
  rs.forEach(r=>{if(r.bill)(map[r.bill.no]=map[r.bill.no]||[]).push(r);});
  return bills().filter(b=>map[b.no]).map(b=>({bill:b,list:map[b.no],sum:+map[b.no].reduce((s,r)=>s+r.ra.comp,0).toFixed(2)}));
}
window.FM_MOD.retCompTodo=()=>compBills().filter(g=>invSt(g.bill.no)==='待开票').length;
window.FM_MOD.retCompBillSum=no=>{const g=compBills().find(x=>x.bill.no===no);return g?{n:g.list.length,sum:g.sum,st:invSt(no)}:null;};

let _tab='list';
function open(tab){
  _tab=tab||'list';
  pushPage({title:'退货赔付',body:`<div class="rp-tabs" id="rc-tabs" style="margin-top:12px"></div><div class="rp-list" id="rc-list"></div>`,
    mount:(p)=>{
      const tabs=p.querySelector('#rc-tabs'),list=p.querySelector('#rc-list');
      function drawTabs(){const n=window.FM_MOD.retCompTodo();
        tabs.innerHTML=[['list','赔付明细',0],['inv','赔付发票',n]].map(([k,t,c])=>`<div class="rp-tab ${_tab===k?'on':''}" data-t="${k}">${t}${c?` ${c}`:''}</div>`).join('');
        tabs.querySelectorAll('.rp-tab').forEach(x=>x.onclick=()=>{if(_tab===x.dataset.t)return;_tab=x.dataset.t;drawTabs();drawList();});}
      function drawList(){
        list.innerHTML=skel(2);
        setTimeout(()=>{
          if(_tab==='list'){
            const rs=compRows();
            list.innerHTML=rs.length?rs.map((r,i)=>{const ok=r.ra.items.filter(x=>x.ok>0);return `<div class="rp-card" data-i="${i}">
              <div class="r1"><span class="no">${r.adjNo}</span><span style="margin-left:auto">${chip(settleSt(r),SET_C)}</span></div>
              <div class="sub">${r.src} · <span style="font-family:monospace">${r.retNo}</span></div>
              <div class="goods"><span class="nm">${ok.map(x=>x.name).join('、')}</span><span class="sk">${kindL(r.ra)} · ${r.ra.status}</span></div>
              <div class="qty"><div class="q"><div class="v">${+ok.reduce((s,x)=>s+x.ok,0).toFixed(2)}</div><div class="l">核定数量</div></div><div class="q"><div class="v">${r.bill?invSt(r.bill.no):'—'}</div><div class="l">开票状态</div></div></div>
              <div class="r2"><span>核定 ${r.ra.reviewAt||'—'}</span><span class="amt" style="color:var(--emerald-2)">+${money(r.ra.comp)}</span></div></div>`;}).join('')
              :`<div class="empty"><div class="ei">${svg('wallet')}</div><h4>暂无退货赔付</h4><p>退货单申诉经平台核定成立后，赔付会显示在这里</p></div>`;
            list.querySelectorAll('[data-i]').forEach(c=>c.onclick=()=>openDetail(rs[+c.dataset.i]));
          }else{
            const gs=compBills();
            list.innerHTML=gs.length?gs.map(g=>{const inv=DB.retCompInv[g.bill.no],st=invSt(g.bill.no);return `<div class="rp-card" data-b="${g.bill.no}">
              <div class="r1"><span class="no">${g.bill.no}</span><span style="margin-left:auto">${chip(st,INV_C)}</span></div>
              <div class="sub">${g.bill.range}</div>
              <div class="qty"><div class="q"><div class="v">${g.list.length}</div><div class="l">赔付笔数</div></div><div class="q"><div class="v">${money(g.sum)}</div><div class="l">应开票金额（含税）</div></div></div>
              <div class="r2">${inv?`<span>发票号码 <span style="font-family:monospace">${inv.invNo}</span></span><span style="margin-left:auto">${inv.invDate}</span>`:`<span>未上传，不影响打款</span><span class="rp-chip rp-c-amber" style="margin-left:auto">上传发票 ›</span>`}</div></div>`;}).join('')
              :`<div class="empty"><div class="ei">${svg('invoice')}</div><h4>暂无需开票的结算单</h4><p>退货赔付进入结算单后，在这里按结算单上传发票</p></div>`;
            list.querySelectorAll('[data-b]').forEach(c=>c.onclick=()=>openUpload(c.dataset.b,()=>{drawTabs();drawList();}));
          }
        },250);
      }
      drawTabs();drawList();
    }});
}

function openDetail(r){
  const ra=r.ra,inv=r.bill?DB.retCompInv[r.bill.no]:null;
  const row=(k,v,cls)=>`<div class="rp-row"><span class="k">${k}</span><span class="v ${cls||''}">${v||'—'}</span></div>`;
  pushPage({title:'退货赔付详情',navbar:true,body:`
    <div class="rp-card2"><div class="rp-ct">基础信息</div>
      ${row('业务调整单号',`<span style="font-family:monospace">${r.adjNo}</span>`)}${row('来源',r.src)}${row('关联单号',`<span style="font-family:monospace">${r.retNo}</span>`)}
      ${row('申诉类型',kindL(ra))}${row('申诉时间',ra.at)}${row('核定时间',ra.reviewAt)}${row('核定结论',ra.status)}${row('核定说明',ra.note)}</div>
    <div class="rp-card2"><div class="rp-ct">赔付明细</div>
      ${ra.items.map(x=>`<div class="rp-row" style="display:block"><b style="font-size:14px">${x.name}</b>
        <div style="display:flex;gap:14px;margin-top:6px;font-size:12.5px;color:#46604F;flex-wrap:wrap"><span>申诉 ${x.qty}</span><span>核定 ${x.ok==null?'—':x.ok}</span><span>${r.priceLabel} ${x.price==null?'—':money(x.price)}</span><span style="margin-left:auto;font-weight:700">${x.ok&&x.price!=null?money(Math.round(x.ok*x.price*100)/100):money(0)}</span></div></div>`).join('')}
      <div class="rp-row total"><span class="k">赔付合计</span><span class="v" style="color:var(--emerald-2)">${money(ra.comp)}</span></div></div>
    <div class="rp-card2"><div class="rp-ct">结算与开票</div>
      ${row('结算单号',r.bill?`<span style="font-family:monospace">${r.bill.no}</span>`:'')}${row('结算区间',r.bill?r.bill.range:'')}${row('结算状态',settleSt(r))}
      ${row('开票状态',r.bill?invSt(r.bill.no):'进结算单后开票',r.bill&&invSt(r.bill.no)==='待开票'?'amber':'')}${row('发票号码',inv?`<span style="font-family:monospace">${inv.invNo}</span>`:'')}${row('开票日期',inv?inv.invDate:'')}</div>
    <div style="height:8px"></div>`,
    footer:`<div style="display:flex;gap:10px;width:100%"><button class="btn" style="flex:1" id="rc-src">查看${r.src==='仓库退回'?'退回记录':'退货单'}</button>${r.bill&&invSt(r.bill.no)==='待开票'?`<button class="btn primary" style="flex:1" id="rc-up">上传发票</button>`:''}</div>`,
    mount:(p)=>{p.querySelector('#rc-src').onclick=r.open;const u=p.querySelector('#rc-up');if(u)u.onclick=()=>openUpload(r.bill.no,()=>{popPage();openDetail(r);});}});
}

function openUpload(billNo,onDone){
  const g=compBills().find(x=>x.bill.no===billNo);if(!g)return;
  const old=DB.retCompInv[billNo],today=new Date().toISOString().slice(0,10);let file=old?old.file:'';
  const inp='width:100%;height:46px;border:1.5px solid var(--line);border-radius:12px;padding:0 12px;font-size:16px;font-family:inherit;background:#fff';
  const lab=t=>`<div style="font-size:13px;font-weight:600;color:#27433A;margin:12px 0 6px"><span style="color:var(--red)">*</span>${t}</div>`;
  pushPage({title:old?'重新上传赔付发票':'上传赔付发票',body:`
    <div style="margin:13px 16px 0;background:var(--mint-soft);color:var(--emerald-2);font-size:12.5px;line-height:1.6;padding:11px 14px;border-radius:12px">请就本期退货赔付合计开 <b>1 张发票给 Foodmax</b>，发票金额（含税）须等于 <b>${money(g.sum)}</b>。已注册 GST 的请在票面列明 GST；买方抬头与 UEN 以平台财务通知为准。</div>
    <div class="rp-card2"><div class="rp-ct">${billNo}<span class="desc">${g.bill.range}</span></div>
      ${g.list.map(r=>`<div class="rp-row"><span class="k" style="font-family:monospace">${r.adjNo}</span><span class="v">${money(r.ra.comp)}</span></div>`).join('')}
      <div class="rp-row total"><span class="k">应开票金额（含税）</span><span class="v">${money(g.sum)}</span></div></div>
    <div style="margin:0 16px">
      ${lab('发票号码')}<input id="ru-no" maxlength="40" value="${old?old.invNo:''}" placeholder="票面上的发票号码" style="${inp}">
      ${lab('开票日期')}<input id="ru-d" type="date" max="${today}" value="${old?old.invDate:today}" style="${inp}">
      ${lab('发票金额（含税）')}<input id="ru-amt" type="number" inputmode="decimal" min="0" step="0.01" value="${old?old.amt:g.sum}" style="${inp}">
      ${lab('发票文件')}<div id="ru-file" style="min-height:72px;border:1.5px dashed var(--line);border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:13px;color:${file?'var(--emerald-2)':'var(--sub)'};cursor:pointer;background:#fff">${file?'已上传 '+file:'点击上传 PDF / JPG / PNG，≤10MB'}</div>
    </div><div style="height:12px"></div>`,
    footer:`<button class="btn primary" id="ru-sub">提交</button>`,
    mount:(p)=>{
      const q=s=>p.querySelector(s);
      q('#ru-file').onclick=()=>{file='INV-'+billNo+'.pdf';q('#ru-file').textContent='已上传 '+file;q('#ru-file').style.color='var(--emerald-2)';};
      q('#ru-sub').onclick=()=>{
        const no=q('#ru-no').value.trim(),d=q('#ru-d').value,amt=Math.round((+q('#ru-amt').value||0)*100)/100;
        if(!no)return toast('请填写发票号码');
        if(!d)return toast('请选择开票日期');
        if(d>today)return toast('开票日期不能晚于今天');
        if(amt!==g.sum)return toast('发票金额需等于本期赔付合计 '+money(g.sum));
        if(!file)return toast('请上传发票文件');
        const dup=Object.keys(DB.retCompInv).find(k=>k!==billNo&&DB.retCompInv[k].invNo===no);
        if(dup)return toast('发票号码已用于结算单 '+dup);
        const n=new Date(),p2=x=>(''+x).padStart(2,'0');
        DB.retCompInv[billNo]={invNo:no,invDate:d,amt,uploadAt:`${today} ${p2(n.getHours())}:${p2(n.getMinutes())}`,file};
        toast('赔付发票已上传');popPage();if(onDone)setTimeout(onDone,320);
      };
    }});
}
window.FM_MOD.retcomp=open;
})();
