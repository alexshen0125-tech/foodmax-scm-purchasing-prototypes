/* Food Max 商家端 v2 · 财务 › 退货赔付（与 PC pc-modules/retcomp.js 同口径，2026-10-27 沈亮定）
   - 数据：退货申诉核定成立 / 部分成立且赔付 > 0 的记录（deliver.js FM_MOD.retCompSrc），一笔申诉 = 一张赔付单
   - 钱：业务调整单「退货申诉赔付」进结算单（settle.js FM_MOD.settleBills 的 adjust[] 含该调整单号即归该单），随货款打款
   - 票：商家开票给 Foodmax；支持【合并赔付单上传发票】——勾选多张待开票赔付单开 1 张票（可跨结算单），只选 1 张即单张开票；
     一张赔付单只能挂 1 张票；未上传不影响打款
   - 校验：发票号码 / 开票日期 / 文件必填；发票金额（含税）必须 = 所选赔付单合计；号码不能与已上传发票重复
   样式复用 replen.js 注入的 .rp-* 类 */
(function(){
const {pushPage,popPage,toast,svg,skel}=window.FM;
const money=n=>'S$'+(+n||0).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
const DB=window.FM.DB;
DB.retCompInvs=DB.retCompInvs||[
  {id:'RI-1',invNo:'GXY-INV-2606-018',invDate:'2026-06-02',amt:9.00,uploadAt:'2026-06-02 15:40',file:'GXY-INV-2606-018.pdf',adjNos:['TZ-20260521-208']}
];
const bills=()=>window.FM_MOD.settleBills?window.FM_MOD.settleBills():[];
const kindL=ra=>window.FM_MOD.raKindLabel?window.FM_MOD.raKindLabel(ra):ra.kind;
const sum2=a=>+a.reduce((s,v)=>s+v,0).toFixed(2);
function compRows(){
  const bs=bills();
  return (window.FM_MOD.retCompSrc?window.FM_MOD.retCompSrc():[])
    .map(r=>({...r,bill:bs.find(b=>b.adjust.some(a=>a.no===r.adjNo))||null}))
    .sort((x,y)=>(y.ra.reviewAt||'').localeCompare(x.ra.reviewAt||''));
}
const rowOf=n=>compRows().find(r=>r.adjNo===n);
const invOf=n=>DB.retCompInvs.find(v=>v.adjNos.includes(n))||null;
const invSt=n=>invOf(n)?'已上传':'待开票';
const settleSt=r=>!r.bill?'待进结算单':(r.bill.cur?'已进结算单':'已打款');
const SET_C={'待进结算单':'rp-c-gray','已进结算单':'rp-c-blue','已打款':'rp-c-green'};
const INV_C={'待开票':'rp-c-amber','已上传':'rp-c-green'};
const chip=(t,m)=>`<span class="rp-chip ${m[t]||'rp-c-gray'}">${t}</span>`;
window.FM_MOD.retCompTodo=()=>compRows().filter(r=>invSt(r.adjNo)==='待开票').length;
window.FM_MOD.retCompBillSum=no=>{const rs=compRows().filter(r=>r.bill&&r.bill.no===no);if(!rs.length)return null;
  const todo=rs.filter(r=>invSt(r.adjNo)==='待开票').length;return {n:rs.length,sum:sum2(rs.map(r=>r.ra.comp)),todo,st:todo?'待开票':'已上传'};};

let _tab='list',_sel=[];
function open(tab){
  _tab=tab==='inv'?'inv':'list';_sel=[];
  pushPage({title:'退货赔付',body:`<div class="rp-tabs" id="rc-tabs" style="margin-top:12px"></div><div class="rp-list" id="rc-list"></div>`,
    footer:`<div style="display:flex;align-items:center;gap:10px;width:100%" id="rc-ft"></div>`,
    mount:(p)=>{
      const tabs=p.querySelector('#rc-tabs'),list=p.querySelector('#rc-list'),ft=p.querySelector('#rc-ft');
      function drawTabs(){const n=window.FM_MOD.retCompTodo();
        tabs.innerHTML=[['list','赔付单',n],['inv','已上传发票',0]].map(([k,t,c])=>`<div class="rp-tab ${_tab===k?'on':''}" data-t="${k}">${t}${c?` ${c}`:''}</div>`).join('');
        tabs.querySelectorAll('.rp-tab').forEach(x=>x.onclick=()=>{if(_tab===x.dataset.t)return;_tab=x.dataset.t;drawTabs();drawList();});}
      // 底栏常驻：未勾选置灰（批量按钮不随勾选出现/消失）
      function drawFt(){
        if(_tab!=='list'){ft.parentElement.style.display='none';return;}
        ft.parentElement.style.display='';
        const s=sum2(_sel.map(n=>rowOf(n)).filter(Boolean).map(r=>r.ra.comp));
        ft.innerHTML=`<div style="flex:1;min-width:0;font-size:12.5px;color:var(--sub);line-height:1.45;white-space:nowrap">${_sel.length?`已选 <b style="color:#27433A">${_sel.length}</b> 张<br>合计 <b style="color:var(--emerald-2)">${money(s)}</b>`:'勾选待开票赔付单<br>合并开 1 张票'}</div>
          <button class="btn primary" id="rc-merge" style="flex:0 0 auto;width:auto;padding:0 18px;${_sel.length?'':'opacity:.45;pointer-events:none'}">合并上传发票${_sel.length?`（${_sel.length}）`:''}</button>`;
        const b=ft.querySelector('#rc-merge');b.onclick=()=>openUpload(_sel.slice(),null,()=>{_sel=[];drawTabs();drawList();});
      }
      function drawList(){
        list.innerHTML=skel(2);drawFt();
        setTimeout(()=>{
          if(_tab==='list'){
            const rs=compRows();_sel=_sel.filter(n=>invSt(n)==='待开票');
            list.innerHTML=rs.length?rs.map((r,i)=>{const ok=r.ra.items.filter(x=>x.ok>0),st=invSt(r.adjNo),inv=invOf(r.adjNo),on=_sel.includes(r.adjNo);return `<div class="rp-card" data-i="${i}">
              <div class="r1">${st==='待开票'?`<span data-ck="${r.adjNo}" style="display:flex;align-items:center;justify-content:center;min-width:44px;min-height:44px;margin:-12px -6px -12px -12px;flex-shrink:0"><span style="width:22px;height:22px;border-radius:7px;border:1.5px solid ${on?'var(--emerald)':'#C9D6CE'};background:${on?'var(--emerald)':'#fff'};color:#fff;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700">${on?'✓':''}</span></span>`:''}<span class="no">${r.adjNo}</span><span style="margin-left:auto">${chip(settleSt(r),SET_C)}</span></div>
              <div class="sub">${r.src} · <span style="font-family:monospace">${r.retNo}</span>${r.bill?` · <span style="font-family:monospace">${r.bill.no}</span>`:''}</div>
              <div class="goods"><span class="nm">${ok.map(x=>x.name).join('、')}</span><span class="sk">${kindL(r.ra)} · ${r.ra.status}</span></div>
              <div class="qty"><div class="q"><div class="v">${sum2(ok.map(x=>x.ok))}</div><div class="l">核定数量</div></div><div class="q"><div class="v">${chip(st,INV_C)}</div><div class="l">${inv?inv.invNo:'开票状态'}</div></div></div>
              <div class="r2"><span>核定 ${r.ra.reviewAt||'—'}</span><span class="amt" style="color:var(--emerald-2)">+${money(r.ra.comp)}</span></div></div>`;}).join('')
              :`<div class="empty"><div class="ei">${svg('wallet')}</div><h4>暂无退货赔付</h4><p>退货单申诉经平台核定成立后，赔付单会显示在这里</p></div>`;
            list.querySelectorAll('[data-i]').forEach(c=>c.onclick=e=>{
              const ck=e.target.closest('[data-ck]');
              if(ck){e.stopPropagation();const n=ck.dataset.ck,k=_sel.indexOf(n);if(k<0)_sel.push(n);else _sel.splice(k,1);drawList();return;}
              openDetail(rs[+c.dataset.i],()=>{drawTabs();drawList();});});
          }else{
            const vs=DB.retCompInvs.slice().sort((a,b)=>b.uploadAt.localeCompare(a.uploadAt));
            list.innerHTML=vs.length?vs.map(v=>`<div class="rp-card" data-v="${v.id}">
              <div class="r1"><span class="no">${v.invNo}</span><span style="margin-left:auto">${chip('已上传',INV_C)}</span></div>
              <div class="sub">开票日期 ${v.invDate} · 上传 ${v.uploadAt}</div>
              <div class="qty"><div class="q"><div class="v">${v.adjNos.length}</div><div class="l">赔付单数</div></div><div class="q"><div class="v">${money(v.amt)}</div><div class="l">发票金额（含税）</div></div></div></div>`).join('')
              :`<div class="empty"><div class="ei">${svg('invoice')}</div><h4>暂无已上传发票</h4><p>在「赔付单」里勾选待开票的赔付单，合并上传发票</p></div>`;
            list.querySelectorAll('[data-v]').forEach(c=>c.onclick=()=>openInv(c.dataset.v,()=>{drawTabs();drawList();}));
          }
        },250);
      }
      drawTabs();drawList();
    }});
}

const rowKV=(k,v,cls)=>`<div class="rp-row"><span class="k">${k}</span><span class="v ${cls||''}">${v||'—'}</span></div>`;
function openDetail(r,onDone){
  const ra=r.ra,inv=invOf(r.adjNo);
  pushPage({title:'赔付单详情',navbar:true,body:`
    <div class="rp-card2"><div class="rp-ct">基础信息</div>
      ${rowKV('业务调整单号',`<span style="font-family:monospace">${r.adjNo}</span>`)}${rowKV('来源',r.src)}${rowKV('关联单号',`<span style="font-family:monospace">${r.retNo}</span>`)}
      ${rowKV('申诉类型',kindL(ra))}${rowKV('申诉时间',ra.at)}${rowKV('核定时间',ra.reviewAt)}${rowKV('核定结论',ra.status)}${rowKV('核定说明',ra.note)}</div>
    <div class="rp-card2"><div class="rp-ct">赔付明细</div>
      ${ra.items.map(x=>`<div class="rp-row" style="display:block"><b style="font-size:14px">${x.name}</b>
        <div style="display:flex;gap:14px;margin-top:6px;font-size:12.5px;color:#46604F;flex-wrap:wrap"><span>申诉 ${x.qty}</span><span>核定 ${x.ok==null?'—':x.ok}</span><span>${r.priceLabel} ${x.price==null?'—':money(x.price)}</span><span style="margin-left:auto;font-weight:700">${x.ok&&x.price!=null?money(Math.round(x.ok*x.price*100)/100):money(0)}</span></div></div>`).join('')}
      <div class="rp-row total"><span class="k">赔付合计</span><span class="v" style="color:var(--emerald-2)">${money(ra.comp)}</span></div></div>
    <div class="rp-card2"><div class="rp-ct">结算与开票</div>
      ${rowKV('结算单号',r.bill?`<span style="font-family:monospace">${r.bill.no}</span>`:'')}${rowKV('结算区间',r.bill?r.bill.range:'')}${rowKV('结算状态',settleSt(r))}
      ${rowKV('开票状态',invSt(r.adjNo),inv?'':'amber')}${rowKV('发票号码',inv?`<span style="font-family:monospace">${inv.invNo}</span>`:'')}${rowKV('开票日期',inv?inv.invDate:'')}${rowKV('同票赔付单',inv?inv.adjNos.length+' 张':'')}</div>
    <div style="height:8px"></div>`,
    footer:`<div style="display:flex;gap:10px;width:100%"><button class="btn" style="flex:1" id="rc-src">查看${r.src==='仓库退回'?'退回记录':'退货单'}</button>${inv?'':`<button class="btn primary" style="flex:1" id="rc-up">上传发票</button>`}</div>`,
    mount:(p)=>{p.querySelector('#rc-src').onclick=r.open;const u=p.querySelector('#rc-up');if(u)u.onclick=()=>openUpload([r.adjNo],null,()=>{popPage();if(onDone)onDone();});}});
}
function openInv(id,onDone){
  const v=DB.retCompInvs.find(x=>x.id===id);if(!v)return;
  pushPage({title:'赔付发票',navbar:true,body:`
    <div class="rp-card2"><div class="rp-ct">发票信息</div>
      ${rowKV('发票号码',`<span style="font-family:monospace">${v.invNo}</span>`)}${rowKV('开票日期',v.invDate)}${rowKV('发票金额（含税）',money(v.amt))}${rowKV('上传时间',v.uploadAt)}${rowKV('发票文件',v.file)}</div>
    <div class="rp-card2"><div class="rp-ct">覆盖的赔付单<span class="desc">${v.adjNos.length} 张</span></div>
      ${v.adjNos.map(n=>{const r=rowOf(n);return `<div class="rp-row"><span class="k"><span style="font-family:monospace">${n}</span><br><span style="font-size:11.5px">${r?r.src+' · '+(r.bill?r.bill.no:'待进结算单'):''}</span></span><span class="v">${r?money(r.ra.comp):'—'}</span></div>`;}).join('')}
      <div class="rp-row total"><span class="k">合计</span><span class="v">${money(v.amt)}</span></div></div>
    <div style="height:8px"></div>`,
    footer:`<button class="btn primary" style="width:100%" id="ri-chg">更换发票</button>`,
    mount:(p)=>{p.querySelector('#ri-chg').onclick=()=>openUpload(v.adjNos.slice(),v.id,()=>{popPage();if(onDone)onDone();});}});
}

/* 上传：新开（adjNos 为所选待开票赔付单）或更换（invId，覆盖范围不变） */
function openUpload(adjNos,invId,onDone){
  const old=invId?DB.retCompInvs.find(x=>x.id===invId):null;
  if(!old)adjNos=adjNos.filter(n=>invSt(n)==='待开票');
  if(!adjNos.length)return toast('请先勾选待开票的赔付单');
  const rs=adjNos.map(rowOf).filter(Boolean),sum=sum2(rs.map(r=>r.ra.comp)),today=new Date().toISOString().slice(0,10);let file=old?old.file:'';
  const inp='width:100%;height:46px;border:1.5px solid var(--line);border-radius:12px;padding:0 12px;font-size:16px;font-family:inherit;background:#fff';
  const lab=t=>`<div style="font-size:13px;font-weight:600;color:#27433A;margin:12px 0 6px"><span style="color:var(--red)">*</span>${t}</div>`;
  pushPage({title:old?'更换赔付发票':(rs.length>1?'合并上传赔付发票':'上传赔付发票'),body:`
    <div style="margin:13px 16px 0;background:var(--mint-soft);color:var(--emerald-2);font-size:12.5px;line-height:1.6;padding:11px 14px;border-radius:12px">就下列 ${rs.length} 张赔付单开 <b>1 张发票给 Foodmax</b>，发票金额（含税）须等于 <b>${money(sum)}</b>。已注册 GST 的请在票面列明 GST；买方抬头与 UEN 以平台财务通知为准。</div>
    <div class="rp-card2"><div class="rp-ct">赔付单<span class="desc">${rs.length} 张</span></div>
      ${rs.map(r=>`<div class="rp-row"><span class="k"><span style="font-family:monospace">${r.adjNo}</span><br><span style="font-size:11.5px">${r.src} · ${r.bill?r.bill.no:'待进结算单'}</span></span><span class="v">${money(r.ra.comp)}</span></div>`).join('')}
      <div class="rp-row total"><span class="k">发票金额（含税）应为</span><span class="v">${money(sum)}</span></div></div>
    <div style="margin:0 16px">
      ${lab('发票号码')}<input id="ru-no" maxlength="40" value="${old?old.invNo:''}" placeholder="票面上的发票号码" style="${inp}">
      ${lab('开票日期')}<input id="ru-d" type="date" max="${today}" value="${old?old.invDate:today}" style="${inp}">
      ${lab('发票金额（含税）')}<input id="ru-amt" type="number" inputmode="decimal" min="0" step="0.01" value="${old?old.amt:sum}" style="${inp}">
      ${lab('发票文件')}<div id="ru-file" style="min-height:72px;border:1.5px dashed var(--line);border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:13px;color:${file?'var(--emerald-2)':'var(--sub)'};cursor:pointer;background:#fff">${file?'已上传 '+file:'点击上传 PDF / JPG / PNG，≤10MB'}</div>
    </div><div style="height:12px"></div>`,
    footer:`<button class="btn primary" id="ru-sub">提交</button>`,
    mount:(p)=>{
      const q=s=>p.querySelector(s);
      q('#ru-file').onclick=()=>{file='INV-'+adjNos[0].replace(/^TZ-/,'')+'.pdf';q('#ru-file').textContent='已上传 '+file;q('#ru-file').style.color='var(--emerald-2)';};
      q('#ru-sub').onclick=()=>{
        const no=q('#ru-no').value.trim(),d=q('#ru-d').value,amt=Math.round((+q('#ru-amt').value||0)*100)/100;
        if(!no)return toast('请填写发票号码');
        if(!d)return toast('请选择开票日期');
        if(d>today)return toast('开票日期不能晚于今天');
        if(amt!==sum)return toast('发票金额需等于所选赔付单合计 '+money(sum));
        if(!file)return toast('请上传发票文件');
        if(DB.retCompInvs.some(v=>v.id!==invId&&v.invNo===no))return toast('该发票号码已上传过');
        const n=new Date(),p2=x=>(''+x).padStart(2,'0'),at=`${today} ${p2(n.getHours())}:${p2(n.getMinutes())}`;
        if(old)Object.assign(old,{invNo:no,invDate:d,amt,file,uploadAt:at});
        else DB.retCompInvs.push({id:'RI-'+Date.now(),invNo:no,invDate:d,amt,file,uploadAt:at,adjNos});
        toast(old?'发票已更换':`已上传，覆盖 ${adjNos.length} 张赔付单`);popPage();if(onDone)setTimeout(onDone,320);
      };
    }});
}
window.FM_MOD.retcomp=open;
})();
