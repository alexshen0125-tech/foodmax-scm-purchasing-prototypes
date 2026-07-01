/* ============================================================
   商家端：库存管理（PC 宽表 · 还原快驴卖家 App 库存管理）
   - 数据源 DB.products 的 skus：stock 当「剩余库存」；sold/refund 演示派生
   - Tab：全部 / 预售品 / 寄售品（product.ptype）；快捷筛选：库存不足/偏低/偏高
   - 操作：库存明细（按 SG 仓分组）/ 改库存 / 设为寄售
   - 顶部：库存偏好设置（分仓 / 多仓共用）
   依赖主文件全局：DB / money / toast / modal / closeModal / skuState / render
============================================================ */
(function(){
  const SG_WH=['裕廊DC','兀兰DC','盛港DC','大巴窑DC'];

  /* ---------- 演示数据：DB.products 为空时播种一份在售目录（含 ptype/sold/refund） ---------- */
  function stockSeed(){
    if(DB.products&&DB.products.length)return;
    let sku=9100;
    const mk=(cfg)=>({
      id:'SPU'+(++sku),name:cfg.name,cat:cfg.cat,unit:cfg.unit,saleType:'售卖品',
      ptype:cfg.ptype,status:'onsale',risk:(CATS[cfg.cat]&&CATS[cfg.cat].baseRisk)||'低',
      reject:'',note:'',img:true,detail:false,
      skus:cfg.skus.map(s=>({skuId:'SKU'+(++sku),qty:s.qty,price:s.price,stock:s.stock,safe:s.safe,sold:s.sold,refund:s.refund||0}))
    });
    DB.products=[
      mk({name:'小棠菜',cat:'新鲜蔬菜',unit:'kg',ptype:'预售品',skus:[
        {qty:1,price:9.30,stock:200,safe:50,sold:0,refund:0},
        {qty:5,price:44.50,stock:18,safe:20,sold:36,refund:2}]}),       // 偏低
      mk({name:'白菜',cat:'新鲜蔬菜',unit:'kg',ptype:'预售品',skus:[
        {qty:1,price:3.50,stock:0,safe:30,sold:120,refund:0},            // 缺货
        {qty:10,price:33.00,stock:46,safe:15,sold:8,refund:0}]}),
      mk({name:'菠菜',cat:'新鲜蔬菜',unit:'kg',ptype:'预售品',skus:[
        {qty:1,price:5.80,stock:88,safe:25,sold:12,refund:1}]}),
      mk({name:'空心菜',cat:'新鲜蔬菜',unit:'kg',ptype:'预售品',skus:[
        {qty:1,price:7.00,stock:12,safe:30,sold:60,refund:0}]}),         // 偏低
      mk({name:'冰鲜三文鱼',cat:'海鲜水产',unit:'kg',ptype:'寄售品',skus:[
        {qty:1,price:42.00,stock:300,safe:20,sold:5,refund:0},           // 偏高
        {qty:3,price:120.00,stock:0,safe:8,sold:14,refund:1}]}),         // 缺货
      mk({name:'鸡胸肉',cat:'肉禽蛋品',unit:'kg',ptype:'寄售品',skus:[
        {qty:2,price:18.00,stock:55,safe:25,sold:30,refund:0}]}),
    ];
  }

  /* ---------- 行模型：DB.products → SKU 行（派生 总/已售/剩余/待退） ---------- */
  function rows(){
    const out=[];
    DB.products.forEach((p,pi)=>p.skus.forEach((s,ki)=>{
      const remaining=+s.stock||0;
      const sold=s.sold!=null?(+s.sold||0):0;
      const refund=s.refund!=null?(+s.refund||0):0;
      out.push({p,s,pi,ki,remaining,sold,refund,total:remaining+sold});
    }));
    return out;
  }
  function ptypeOf(p){return p.ptype||'预售品';}
  // 库存档位：缺货 / 偏低(0<剩余≤安全) / 偏高(剩余>安全×3) / 正常
  function level(r){const safe=+r.s.safe||0;if(r.remaining<=0)return 'low0';if(safe&&r.remaining<=safe)return 'low';if(safe&&r.remaining>safe*3)return 'high';return 'ok';}

  /* ---------- 仓位拆分（派生：把总量分到 N 个仓） ---------- */
  function splitN(total,n){const base=Math.floor(total/n),rem=total-base*n,a=[];for(let i=0;i<n;i++)a.push(base+(i<rem?1:0));return a;}

  /* ---------- 库存明细 modal（按 SG 仓分组：已售 / 待退库） ---------- */
  window.stk_detail=function(pi,ki){
    const p=DB.products[pi],s=p.skus[ki];
    const sold=s.sold!=null?(+s.sold||0):0,refund=s.refund!=null?(+s.refund||0):0;
    const shared=(DB.stockPref||'split')=='shared';
    const soldArr=splitN(sold,SG_WH.length),refArr=splitN(refund,SG_WH.length);
    const note=ptypeOf(p)=='预售品'?'每日恢复初始库存':'寄售实时库存';
    const whRows=SG_WH.map((w,i)=>`<tr><td>${w}</td><td style="color:var(--ts)">已售 <b style="color:var(--tp)">${soldArr[i]}</b></td><td style="color:var(--ts)">待退库 <b style="color:var(--tp)">${refArr[i]}</b></td></tr>`).join('');
    modal(`<div class="mc-hd"><h3>库存明细</h3><p>${p.name} ${s.qty}${p.unit} · ${s.skuId}</p><button class="mc-x" onclick="closeModal()">×</button></div>
    <div class="mc-bd">
      <div class="card" style="box-shadow:none;margin:0"><div class="card-hd"><h3 style="font-size:14px">${shared?'共享仓组合':'分仓库存'}</h3><span class="sub">${note}</span></div>
      <div class="card-bd flush"><div style="overflow-x:auto"><table class="subtbl"><thead><tr><th>仓库</th><th>已售库存</th><th>待退库</th></tr></thead><tbody>${whRows}</tbody></table></div></div></div>
      <div class="ib ib-gr" style="margin-top:12px"><span class="i">ℹ️</span>${shared?'当前为<b>多仓共用库存</b>：各仓共享同一库存池，已售/待退按仓拆分展示。':'当前为<b>分仓设置库存</b>：每个仓独立维护库存与已售/待退。'}</div>
    </div>
    <div class="mc-ft"><button class="btn btn-p" onclick="closeModal()">知道了</button></div>`);
  };

  /* ---------- 改库存 modal（即时校验非负整数） ---------- */
  window.stk_edit=function(pi,ki){
    const p=DB.products[pi],s=p.skus[ki];
    modal(`<div class="mc-hd"><h3>改库存</h3><p>${p.name} ${s.qty}${p.unit} · ${s.skuId}</p><button class="mc-x" onclick="closeModal()">×</button></div>
    <div class="mc-bd">
      <div class="fr"><label class="fl">当前剩余库存</label><input value="${s.stock||0}" readonly style="background:#F3F4F6;color:var(--ts)"></div>
      <div class="fr"><label class="fl"><b>*</b>新剩余库存</label><input id="stk-val" type="number" min="0" step="1" value="${s.stock||0}" oninput="stk_chk(this.value)"></div>
      <div id="stk-err"></div>
      <div class="ib ib-b"><span class="i">ℹ️</span>安全库存 ${s.safe||0}；改库存即时生效、无需审核，为 0 即售罄。</div>
    </div>
    <div class="mc-ft"><button class="btn btn-o" onclick="closeModal()">取消</button><button class="btn btn-p" id="stk-ok" onclick="stk_save(${pi},${ki})">保存（即时生效）</button></div>`);
  };
  window.stk_chk=function(v){
    const box=document.getElementById('stk-err'),ok=document.getElementById('stk-ok');
    const n=Number(v);const bad=v==''||isNaN(n)||n<0||!Number.isInteger(n);
    box.innerHTML=bad?`<div class="ib ib-r" style="margin-top:8px"><span class="i">⛔</span>库存必须为 ≥0 的整数</div>`:'';
    if(ok)ok.disabled=bad;
    return !bad;
  };
  window.stk_save=function(pi,ki){
    const v=document.getElementById('stk-val').value;
    if(!stk_chk(v)){toast('库存必须为 ≥0 的整数','err');return;}
    const p=DB.products[pi];p.skus[ki].stock=Math.max(0,parseInt(v)||0);
    closeModal();render();
    toast(`「${p.name} ${p.skus[ki].qty}${p.unit}」剩余库存已更新为 ${p.skus[ki].stock}`,'ok');
  };

  /* ---------- 设为寄售（二次确认） ---------- */
  window.stk_consign=function(pi){
    const p=DB.products[pi];
    modal(`<div class="mc-hd"><h3>设为寄售</h3><button class="mc-x" onclick="closeModal()">×</button></div>
    <div class="mc-bd">
      <div class="ib ib-y"><span class="i">⚠️</span>确认将「<b>${p.name}</b>」的全部规格转为<b>寄售品</b>？</div>
      <p style="font-size:13px;color:var(--ts)">寄售品库存按平台实时同步结算，不再每日恢复初始库存。转换后可在「寄售品」Tab 下查看。</p>
    </div>
    <div class="mc-ft"><button class="btn btn-o" onclick="closeModal()">取消</button><button class="btn btn-p" onclick="stk_doConsign(${pi})">确认设为寄售</button></div>`);
  };
  window.stk_doConsign=function(pi){
    const p=DB.products[pi];p.ptype='寄售品';
    closeModal();render();toast(`「${p.name}」已设为寄售品`,'ok');
  };

  /* ---------- 库存偏好设置（分仓 / 多仓共用） ---------- */
  window.stk_pref=function(){
    const cur=DB.stockPref||'split';
    const opt=(v,t,d)=>`<label class="chip-ck ${cur==v?'on':''}" style="display:flex;flex-direction:column;align-items:flex-start;gap:4px;padding:14px 16px;width:100%"><div style="display:flex;align-items:center;gap:8px;font-weight:600"><input type="radio" name="stk-pref" value="${v}" ${cur==v?'checked':''} onchange="this.closest('.mc-bd').querySelectorAll('.chip-ck').forEach(e=>e.classList.remove('on'));this.closest('.chip-ck').classList.add('on')">${t}</div><div style="font-size:12px;color:var(--ts);padding-left:24px">${d}</div></label>`;
    modal(`<div class="mc-hd"><h3>库存偏好设置</h3><p>选择库存维护方式，影响库存明细与扣减口径</p><button class="mc-x" onclick="closeModal()">×</button></div>
    <div class="mc-bd">
      <div style="display:flex;flex-direction:column;gap:12px">
        ${opt('split','分仓设置库存','每个仓库独立维护库存，订单按收货仓就近扣减各仓库存。')}
        ${opt('shared','多仓共用库存','所有仓库共享同一库存池，任一仓出库统一扣减总量，避免重复维护。')}
      </div>
      <div class="ib ib-gr" style="margin-top:12px"><span class="i">📖</span><b>规则说明：</b>切换偏好仅影响后续库存展示与扣减方式，不改变历史已售/待退数据；预售品每日恢复初始库存，寄售品按实时库存结算。</div>
    </div>
    <div class="mc-ft"><button class="btn btn-o" onclick="closeModal()">取消</button><button class="btn btn-p" onclick="stk_savePref()">保存</button></div>`);
  };
  window.stk_savePref=function(){
    const el=document.querySelector('input[name=stk-pref]:checked');
    DB.stockPref=el?el.value:'split';
    closeModal();render();
    toast(`库存偏好已设为「${DB.stockPref=='shared'?'多仓共用库存':'分仓设置库存'}」`,'ok');
  };

  /* ---------- Tab / 快捷筛选切换 ---------- */
  window.stk_tab=function(v){DB.stockTab=v;render();};
  window.stk_filter=function(v){DB.stockFilter=(DB.stockFilter==v?'':v);render();};

  /* ---------- 页面 ---------- */
  PAGES['m-stock']=()=>{
    stockSeed();
    DB.stockTab=DB.stockTab||'all';
    DB.stockFilter=DB.stockFilter||'';
    DB.stockPref=DB.stockPref||'split';
    const tab=DB.stockTab,fil=DB.stockFilter;

    const all=rows();
    // 统计（按在售 SKU）
    const onsale=all.filter(r=>r.p.status=='onsale');
    const cWarn=onsale.filter(r=>r.remaining>0&&(r.s.safe||0)>0&&r.remaining<r.s.safe).length;
    const cOut=onsale.filter(r=>r.remaining<=0).length;
    const cRefund=onsale.reduce((a,r)=>a+r.refund,0);

    // 列表过滤：Tab + 快捷筛选
    const matchTab=r=>tab=='all'?true:ptypeOf(r.p)==tab;
    const matchFil=r=>{if(!fil)return true;const lv=level(r);if(fil=='low0')return lv=='low0';if(fil=='low')return lv=='low';if(fil=='high')return lv=='high';return true;};
    const list=all.filter(r=>matchTab(r)&&matchFil(r));

    const cntTab=v=>all.filter(r=>v=='all'?true:ptypeOf(r.p)==v).length;
    const cntFil=v=>all.filter(r=>matchTab(r)&&(level(r)==v)).length;

    const fb=(v,t,dot)=>`<button class="btn ${fil==v?'btn-p':'btn-o'} btn-sm" onclick="stk_filter('${v}')" style="position:relative">${t}${dot&&cntFil(v)?`<span style="position:absolute;top:-4px;right:-4px;width:8px;height:8px;border-radius:50%;background:var(--r)"></span>`:''}</button>`;

    return `
    <div class="sg" style="grid-template-columns:repeat(4,1fr)">
      <div class="sc good"><div class="sc-l">在售 SKU 数</div><div class="sc-v">${onsale.length}</div><div class="sc-s">正在销售的规格</div></div>
      <div class="sc ${cWarn?'warn':''}"><div class="sc-l">库存预警</div><div class="sc-v">${cWarn}</div><div class="sc-s">低于安全库存</div></div>
      <div class="sc ${cOut?'alert':''}"><div class="sc-l">缺货</div><div class="sc-v">${cOut}</div><div class="sc-s">剩余库存为 0</div></div>
      <div class="sc ${cRefund?'warn':''}"><div class="sc-l">待退库</div><div class="sc-v">${cRefund}</div><div class="sc-s">待退回入库</div></div>
    </div>

    <div class="card"><div class="card-hd">
      <div class="tabs" style="margin:0;border:none">${[['all','全部'],['预售品','预售品'],['寄售品','寄售品']].map(x=>`<div class="tab ${tab==x[0]?'active':''}" onclick="stk_tab('${x[0]}')">${x[1]}<span style="color:var(--ts);font-weight:400;margin-left:4px">${cntTab(x[0])}</span></div>`).join('')}</div>
      <div class="row" style="gap:8px"><button class="btn btn-o btn-sm" onclick="stk_pref()">⚙️ 库存偏好设置</button></div>
    </div>
    <div class="card-bd">
      <div class="row" style="gap:8px;margin-bottom:12px">${fb('low0','库存不足',true)}${fb('low','库存偏低',true)}${fb('high','库存偏高',false)}</div>
      <div style="overflow-x:auto"><table>
        <thead><tr><th>商品</th><th>SKU 编码</th><th>规格</th><th style="text-align:right">总库存</th><th style="text-align:right">已售库存</th><th style="text-align:right">剩余库存</th><th style="text-align:right">待退库</th><th>状态</th><th>操作</th></tr></thead>
        <tbody>${list.map(r=>{const st=skuState(r.p,r.s);const consigned=ptypeOf(r.p)=='寄售品';return `<tr>
          <td><b>${r.p.name}</b><div style="font-size:11.5px;color:var(--ts)">${r.p.cat||'—'} · ${ptypeOf(r.p)}</div></td>
          <td class="mono">${r.s.skuId}</td>
          <td>${r.s.qty}${r.p.unit}</td>
          <td style="text-align:right">${r.total}</td>
          <td style="text-align:right;color:var(--ts)">${r.sold}</td>
          <td style="text-align:right"><b>${r.remaining}</b></td>
          <td style="text-align:right;${r.refund?'color:var(--r)':'color:var(--ts)'}">${r.refund}</td>
          <td><span class="tag ${st[1]}">${st[0]}</span></td>
          <td><button class="btn btn-link" onclick="stk_detail(${r.pi},${r.ki})">库存明细</button> <button class="btn btn-o btn-sm" onclick="stk_edit(${r.pi},${r.ki})">改库存</button>${consigned?'':` <button class="btn btn-link" onclick="stk_consign(${r.pi})">设为寄售</button>`}</td>
        </tr>`;}).join('')||`<tr><td colspan="9"><div class="empty"><div class="e-ic">📦</div><div class="e-t">${fil||tab!='all'?'当前筛选下暂无库存':'暂无在售商品库存'}</div><div class="e-s">${fil||tab!='all'?'切换 Tab 或清除快捷筛选查看全部':'前往「商品管理」新建并上架商品后，库存将在此维护'}</div></div></td></tr>`}</tbody>
      </table></div>
    </div></div>`;
  };
})();
