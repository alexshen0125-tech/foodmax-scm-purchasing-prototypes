/* Food Max 商家端 v2 · 财务 › 退货赔付（与 PC pc-modules/retcomp.js 同口径，2026-10-27 沈亮定 + 当日会议）
   - 数据：退货申诉经客服核定成立 / 部分成立且赔付 > 0（deliver.js FM_MOD.retCompSrc），一笔申诉 = 一张赔付单（PF-…）
   - 结算（货权转移阶段）：赔付单直接推送进结算单（settle.js FM_MOD.settleBills 的 comp[] 含该赔付单号即归该单），
     计入应结金额与应开票金额，随结算单一并开票，不单独开票 / 上传
   - 平台化后是否平台代开发票待 Simon 确认，届时再加代开发票下载
   样式复用 replen.js 注入的 .rp-* 类 */
(function(){
const {pushPage,popPage,svg,skel}=window.FM;
const money=n=>'S$'+(+n||0).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
const bills=()=>window.FM_MOD.settleBills?window.FM_MOD.settleBills():[];
const kindL=ra=>window.FM_MOD.raKindLabel?window.FM_MOD.raKindLabel(ra):ra.kind;
const sum2=a=>+a.reduce((s,v)=>s+v,0).toFixed(2);
function compRows(){
  const bs=bills();
  return (window.FM_MOD.retCompSrc?window.FM_MOD.retCompSrc():[])
    .map(r=>({...r,bill:bs.find(b=>b.comp.some(c=>c.no===r.compNo))||null}))
    .sort((x,y)=>(y.ra.reviewAt||'').localeCompare(x.ra.reviewAt||''));
}
const settleSt=r=>!r.bill?'待进结算单':(r.bill.cur?'已进结算单':'已打款');
const SET_C={'待进结算单':'rp-c-gray','已进结算单':'rp-c-blue','已打款':'rp-c-green'};
const chip=(t,m)=>`<span class="rp-chip ${m[t]||'rp-c-gray'}">${t}</span>`;

function open(){
  pushPage({title:'退货赔付',body:`<div class="rp-list" id="rc-list" style="padding-top:12px"></div>`,
    mount:(p)=>{
      const list=p.querySelector('#rc-list');list.innerHTML=skel(2);
      setTimeout(()=>{
        const rs=compRows();
        list.innerHTML=rs.length?rs.map((r,i)=>{const ok=r.ra.items.filter(x=>x.ok>0);return `<div class="rp-card" data-i="${i}">
          <div class="r1"><span class="no">${r.compNo}</span><span style="margin-left:auto">${chip(settleSt(r),SET_C)}</span></div>
          <div class="sub">${r.src} · <span style="font-family:monospace">${r.retNo}</span></div>
          <div class="goods"><span class="nm">${ok.map(x=>x.name).join('、')}</span><span class="sk">${kindL(r.ra)} · ${r.ra.status}</span></div>
          <div class="qty"><div class="q"><div class="v">${sum2(ok.map(x=>x.ok))}</div><div class="l">核定数量</div></div><div class="q"><div class="v" style="font-size:13px;font-family:monospace">${r.bill?r.bill.no:'—'}</div><div class="l">结算单号</div></div></div>
          <div class="r2"><span>核定 ${r.ra.reviewAt||'—'}</span><span class="amt" style="color:var(--emerald-2)">+${money(r.ra.comp)}</span></div></div>`;}).join('')
          :`<div class="empty"><div class="ei">${svg('wallet')}</div><h4>暂无退货赔付</h4><p>退货单申诉经客服核实成立后，赔付单会显示在这里</p></div>`;
        list.querySelectorAll('[data-i]').forEach(c=>c.onclick=()=>openDetail(rs[+c.dataset.i]));
      },250);
    }});
}

const rowKV=(k,v)=>`<div class="rp-row"><span class="k">${k}</span><span class="v">${v||'—'}</span></div>`;
function openDetail(r){
  const ra=r.ra;
  pushPage({title:'赔付单详情',navbar:true,body:`
    <div class="rp-card2"><div class="rp-ct">基础信息</div>
      ${rowKV('赔付单号',`<span style="font-family:monospace">${r.compNo}</span>`)}${rowKV('来源',r.src)}${rowKV('关联单号',`<span style="font-family:monospace">${r.retNo}</span>`)}
      ${rowKV('申诉类型',kindL(ra))}${rowKV('申诉时间',ra.at)}${rowKV('核定时间',ra.reviewAt)}${rowKV('核定结论',ra.status)}${rowKV('核定说明',ra.note)}</div>
    <div class="rp-card2"><div class="rp-ct">赔付明细</div>
      ${ra.items.map(x=>`<div class="rp-row" style="display:block"><b style="font-size:14px">${x.name}</b>
        <div style="display:flex;gap:14px;margin-top:6px;font-size:12.5px;color:#46604F;flex-wrap:wrap"><span>申诉 ${x.qty}</span><span>核定 ${x.ok==null?'—':x.ok}</span><span>${r.priceLabel} ${x.price==null?'—':money(x.price)}</span><span style="margin-left:auto;font-weight:700">${x.ok&&x.price!=null?money(Math.round(x.ok*x.price*100)/100):money(0)}</span></div></div>`).join('')}
      <div class="rp-row total"><span class="k">赔付合计</span><span class="v" style="color:var(--emerald-2)">${money(ra.comp)}</span></div></div>
    <div class="rp-card2"><div class="rp-ct">结算</div>
      ${rowKV('结算单号',r.bill?`<span style="font-family:monospace">${r.bill.no}</span>`:'')}${rowKV('结算区间',r.bill?r.bill.range:'')}${rowKV('结算状态',settleSt(r))}
      ${rowKV('开票',r.bill?'随结算单一并开票':'进结算单后随结算单开票')}</div>
    <div style="height:8px"></div>`,
    footer:`<div style="display:flex;gap:10px;width:100%"><button class="btn" style="flex:1" id="rc-src">查看${r.src==='仓库退回'?'退回记录':'退货单'}</button>${r.bill?`<button class="btn primary" style="flex:1" id="rc-bill">查看结算单</button>`:''}</div>`,
    mount:(p)=>{p.querySelector('#rc-src').onclick=r.open;const b=p.querySelector('#rc-bill');if(b)b.onclick=()=>{if(window.FM_MOD.settle)window.FM_MOD.settle();};}});
}
window.FM_MOD.retcomp=open;
})();
