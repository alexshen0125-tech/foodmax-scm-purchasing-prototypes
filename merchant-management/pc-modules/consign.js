/* PC · 店铺运营平台：供货单管理（新增作废）+ 退货单管理（新增模块）
   业务链：运营为商家建寄售供货单 → 提交 → 预约发货 → 推 WMS 入库单(JSR) → 仓库收货回写实际入库数量 → 已完成
           已完成的供货单 → 建退货单(TH) → 推 WMS 出库单(JSC) → 仓库出库回写实际出库数量 → 已出库
   口径（2026-08-18 沈亮拍板）：
   - 作废范围：待下单/待发货/待入库 可作废，**已完成不可作废**；已作废是终态，不可恢复。
   - 作废**不填原因**，二次确认即执行；已推 WMS 的单，作废时**同步调 WMS 取消入库单**，
     WMS 取消失败 → 整单作废失败，状态不变（前端提示失败原因），不允许两边状态不一致。
   - 退货必须**关联供货单**，且只能关联「已完成」的供货单，无裸建单入口。
   - 退货按**明细行**退：可退数量 = 实际入库数量 − 已退数量；支持部分退、多次退，
     同一供货单可建多张退货单；退完额度后该供货单不再出现在可选列表。
   - 已退数量口径：待出库 + 已出库都占额度，**退货单作废则释放额度**。
   - 退货单状态机：10 待出库 → 20 已出库（WMS 回写实际出库数量 + 出库完成时间）；10 → 30 已作废。
   字段名 / 枚举值 / 单号规则取自线上 h5-foodmax-platform 真实接口（/platform/consign/*），
   净新增部分（作废、退货单）标「待研发确认」。
   依赖主文件全局：DB / toast / drawer / closeDrawer / askConfirm / nav / render / ts。 */
(function(){

/* ================= 枚举（与线上一致，50/退货单为本期新增） ================= */
const CG_ST = { 10:'待下单', 20:'待发货', 30:'待入库', 40:'已完成', 50:'已作废' };
const CG_TC = { 10:'t-gr',   20:'t-y',   30:'t-g',   40:'t-g',   50:'t-r' };
const CR_ST = { 10:'待出库', 20:'已出库', 30:'已作废' };
const CR_TC = { 10:'t-y',    20:'t-g',    30:'t-r' };
const WMS_PUSH = { 0:'待推送', 1:'成功', 2:'失败' };

const WAREHOUSES = [
  {code:'Singapore001', name:'新加坡-B端仓'},
  {code:'Singapore002', name:'新加坡-KA仓'},
];

/* 寄售货品（运营侧按货品编码 ITEM 维护，商家侧不展示货品概念） */
const CG_ITEMS = {
  'ITEM26080100001':{itemName:'娃娃菜',        itemSpec:'1件(5kg)',   measureUnitDesc:'件'},
  'ITEM26080100002':{itemName:'小棠菜',        itemSpec:'1件(10kg)',  measureUnitDesc:'件'},
  'ITEM26080100003':{itemName:'鲜鸡蛋',        itemSpec:'1托(30枚)',  measureUnitDesc:'托'},
  'ITEM26080100004':{itemName:'椰子水 330ml',  itemSpec:'1箱(24瓶)',  measureUnitDesc:'箱'},
};
function meta(code){ return CG_ITEMS[code] || {itemName:code, itemSpec:'', measureUnitDesc:''}; }
function li(code, quantity, actualQuantity){
  return Object.assign({itemCode:code, quantity, actualQuantity}, meta(code));
}

/* ================= 演示数据（挂 DB，跨 render 持久） ================= */
DB.consigns = DB.consigns || [
  {consignOrderNo:'GH202608180007', merchantCode:'M2026-0834', shopName:'星洲蛋业',
   warehouseCode:'Singapore001', warehouseName:'新加坡-B端仓',
   expectArrivalTime:'2026-08-20 00:00:00', bookingArrivalTime:'', inboundFinishTime:'', remark:'',
   status:10, wmsPushStatus:0, wmsOrderNo:'', createName:'WONGWAI TENG', createTime:'2026-08-18 15:02:10',
   cancelName:'', cancelTime:'', items:[ li('ITEM26080100003', 60, null) ]},

  {consignOrderNo:'GH202608180006', merchantCode:'M2026-0815', shopName:'绿鲜源蔬果旗舰店',
   warehouseCode:'Singapore001', warehouseName:'新加坡-B端仓',
   expectArrivalTime:'2026-08-20 00:00:00', bookingArrivalTime:'', inboundFinishTime:'', remark:'周三上午送',
   status:20, wmsPushStatus:0, wmsOrderNo:'', createName:'WONGWAI TENG', createTime:'2026-08-18 14:41:33',
   cancelName:'', cancelTime:'', items:[ li('ITEM26080100001', 120, null) ]},

  {consignOrderNo:'GH202608180005', merchantCode:'M2026-0815', shopName:'绿鲜源蔬果旗舰店',
   warehouseCode:'Singapore001', warehouseName:'新加坡-B端仓',
   expectArrivalTime:'2026-08-19 00:00:00', bookingArrivalTime:'2026-08-19 00:00:00', inboundFinishTime:'', remark:'',
   status:30, wmsPushStatus:1, wmsOrderNo:'JSR2026081800005', createName:'WONGWAI TENG', createTime:'2026-08-18 12:30:04',
   cancelName:'', cancelTime:'', items:[ li('ITEM26080100002', 35, null) ]},

  // WMS 单号以 4 结尾：演示「WMS 已开始收货 → 取消失败 → 作废失败」
  {consignOrderNo:'GH202608180004', merchantCode:'M2026-0821', shopName:'南洋鲜果行',
   warehouseCode:'Singapore002', warehouseName:'新加坡-KA仓',
   expectArrivalTime:'2026-08-19 00:00:00', bookingArrivalTime:'2026-08-19 00:00:00', inboundFinishTime:'', remark:'',
   status:30, wmsPushStatus:1, wmsOrderNo:'JSR2026081800004', createName:'WONGWAI TENG', createTime:'2026-08-18 11:58:41',
   cancelName:'', cancelTime:'', items:[ li('ITEM26080100001', 80, null) ]},

  {consignOrderNo:'GH202608180003', merchantCode:'M2026-0815', shopName:'绿鲜源蔬果旗舰店',
   warehouseCode:'Singapore001', warehouseName:'新加坡-B端仓',
   expectArrivalTime:'2026-08-18 00:00:00', bookingArrivalTime:'2026-08-18 00:00:00', inboundFinishTime:'2026-08-18 14:19:12', remark:'',
   status:40, wmsPushStatus:1, wmsOrderNo:'JSR2026081800003', createName:'WONGWAI TENG', createTime:'2026-08-18 11:30:46',
   cancelName:'', cancelTime:'', items:[ li('ITEM26080100004', 20, 20), li('ITEM26080100002', 30, 28) ]},

  {consignOrderNo:'GH202608180001', merchantCode:'M2026-0834', shopName:'星洲蛋业',
   warehouseCode:'Singapore001', warehouseName:'新加坡-B端仓',
   expectArrivalTime:'2026-08-18 00:00:00', bookingArrivalTime:'2026-08-18 00:00:00', inboundFinishTime:'2026-08-18 10:02:35', remark:'',
   status:40, wmsPushStatus:1, wmsOrderNo:'JSR2026081800001', createName:'WONGWAI TENG', createTime:'2026-08-18 08:12:20',
   cancelName:'', cancelTime:'', items:[ li('ITEM26080100003', 50, 50) ]},

  {consignOrderNo:'GH202608170001', merchantCode:'M2026-0821', shopName:'南洋鲜果行',
   warehouseCode:'Singapore002', warehouseName:'新加坡-KA仓',
   expectArrivalTime:'2026-08-18 00:00:00', bookingArrivalTime:'2026-08-18 00:00:00', inboundFinishTime:'2026-08-18 09:41:07', remark:'',
   status:40, wmsPushStatus:1, wmsOrderNo:'JSR2026081700001', createName:'WONGWAI TENG', createTime:'2026-08-17 17:22:56',
   cancelName:'', cancelTime:'', items:[ li('ITEM26080100001', 100, 100) ]},

  {consignOrderNo:'GH202608140002', merchantCode:'M2026-0821', shopName:'南洋鲜果行',
   warehouseCode:'Singapore001', warehouseName:'新加坡-B端仓',
   expectArrivalTime:'2026-08-15 00:00:00', bookingArrivalTime:'', inboundFinishTime:'', remark:'商家临时取消供货',
   status:50, wmsPushStatus:0, wmsOrderNo:'', createName:'WONGWAI TENG', createTime:'2026-08-14 16:03:12',
   cancelName:'沈亮', cancelTime:'2026-08-14 18:20:41', items:[ li('ITEM26080100002', 25, null) ]},
];

DB.consignReturns = DB.consignReturns || [
  {returnOrderNo:'TH202608180001', consignOrderNo:'GH202608180003', shopName:'绿鲜源蔬果旗舰店',
   warehouseCode:'Singapore001', warehouseName:'新加坡-B端仓', status:20, remark:'客户反馈瓶身渗漏',
   wmsPushStatus:1, wmsOrderNo:'JSC2026081800001', createName:'沈亮', createTime:'2026-08-18 15:10:22',
   outboundFinishTime:'2026-08-18 17:41:03', cancelName:'', cancelTime:'',
   items:[{itemCode:'ITEM26080100004', returnQuantity:5, actualReturnQuantity:5}]},

  {returnOrderNo:'TH202608180002', consignOrderNo:'GH202608180001', shopName:'星洲蛋业',
   warehouseCode:'Singapore001', warehouseName:'新加坡-B端仓', status:10, remark:'破损退回',
   wmsPushStatus:1, wmsOrderNo:'JSC2026081800002', createName:'沈亮', createTime:'2026-08-18 16:02:55',
   outboundFinishTime:'', cancelName:'', cancelTime:'',
   items:[{itemCode:'ITEM26080100003', returnQuantity:6, actualReturnQuantity:null}]},
];

DB.cgTab = DB.cgTab || 'all';
DB.crTab = DB.crTab || 'all';
DB.cgSeq = DB.cgSeq || 2;

/* ================= 取数与口径 ================= */
const cgOf = no => DB.consigns.find(c => c.consignOrderNo === no);
const crOf = no => DB.consignReturns.find(r => r.returnOrderNo === no);
const dash = v => (v===''||v==null) ? '<span style="color:var(--tt)">—</span>' : v;
const cgTag = s => `<span class="tag ${CG_TC[s]}"><span class="dot"></span>${CG_ST[s]}</span>`;
const crTag = s => `<span class="tag ${CR_TC[s]}"><span class="dot"></span>${CR_ST[s]}</span>`;

// 已退数量：待出库 + 已出库占额度，已作废释放
function returnedQty(consignOrderNo, itemCode){
  return DB.consignReturns.filter(r => r.consignOrderNo===consignOrderNo && r.status!==30)
    .flatMap(r => r.items).filter(i => i.itemCode===itemCode)
    .reduce((s,i)=> s + (i.actualReturnQuantity!=null ? i.actualReturnQuantity : i.returnQuantity), 0);
}
const returnableQty = (c,i) => (i.actualQuantity||0) - returnedQty(c.consignOrderNo, i.itemCode);
// 供货单是否还能发起退货：已完成 且 至少一行还有可退额度
const canReturn = c => c.status===40 && c.items.some(i => returnableQty(c,i) > 0);
const canCancel = c => c.status!==40 && c.status!==50;

/* =========================================================================
   页面：供货单管理
   ========================================================================= */
const CG_TABS = [['all','全部'],['10','待下单'],['20','待发货'],['30','待入库'],['40','已完成'],['50','已作废']];

PAGES['p-consign']=()=>{
  const tab=DB.cgTab;
  const all=DB.consigns.slice().sort((a,b)=>b.createTime.localeCompare(a.createTime));
  const list=tab=='all'?all:all.filter(c=>String(c.status)==tab);
  const cnt=k=>k=='all'?all.length:all.filter(c=>String(c.status)==k).length;
  return `
  <div class="card"><div class="card-bd">
    <div class="fg3">
      <div class="fr"><label class="fl">供货单号</label><input placeholder="请输入"></div>
      <div class="fr"><label class="fl">商家店铺</label><input placeholder="请搜索商家店铺"></div>
      <div class="fr"><label class="fl">仓库</label><select><option>全部</option>${WAREHOUSES.map(w=>`<option>${w.name}</option>`).join('')}</select></div>
    </div>
    <div class="fg3">
      <div class="fr"><label class="fl">期望到货时间</label><input type="date"></div>
      <div class="fr"><label class="fl">创建人</label><input placeholder="请输入"></div>
      <div class="fr" style="align-self:end"><button class="btn btn-p">查询</button> <button class="btn btn-o">重置</button></div>
    </div>
  </div></div>

  <div class="tabs">${CG_TABS.map(t=>`<div class="tab ${tab==t[0]?'active':''}" onclick="DB.cgTab='${t[0]}';render()">${t[1]}${cnt(t[0])?`<span class="tb" style="background:var(--ts)">${cnt(t[0])}</span>`:''}</div>`).join('')}</div>

  <div class="card"><div class="card-hd"><h3>供货单列表</h3><span class="sub">共 ${list.length} 单</span>
    <div class="row" style="margin-left:auto;gap:8px">
      <button class="btn btn-p">新建供货单</button><button class="btn btn-o">预约发货</button><button class="btn btn-o">导出</button>
    </div></div>
  <div class="card-bd flush"><div style="overflow-x:auto"><table>
    <thead><tr><th>供货单号</th><th>商家编码</th><th>商家店铺</th><th>仓库</th><th>期望到货时间</th><th>WMS 入库单</th><th>状态</th><th>创建人</th><th>创建时间</th><th>操作</th></tr></thead>
    <tbody>${list.map(c=>`<tr>
      <td class="mono">${c.consignOrderNo}</td>
      <td class="mono">${c.merchantCode}</td>
      <td>${c.shopName}</td>
      <td>${c.warehouseName}</td>
      <td>${c.expectArrivalTime.slice(0,16)}</td>
      <td class="mono" style="font-size:12px">${dash(c.wmsOrderNo)}</td>
      <td>${cgTag(c.status)}</td>
      <td>${c.createName}</td>
      <td style="font-size:12px">${c.createTime}</td>
      <td style="white-space:nowrap">
        <button class="btn btn-o btn-sm" onclick="cgDetail('${c.consignOrderNo}')">详情</button>
        ${canReturn(c)?` <button class="btn btn-link btn-sm" onclick="crCreate('${c.consignOrderNo}')">退货</button>`:''}
        ${canCancel(c)?` <button class="btn btn-link btn-sm" style="color:var(--r)" onclick="cgCancelAsk('${c.consignOrderNo}')">作废</button>`:''}
      </td></tr>`).join('')||`<tr><td colspan="10" style="text-align:center;color:var(--ts);padding:22px">该状态暂无供货单</td></tr>`}
    </tbody></table></div></div></div>`;
};

/* ---------- 供货单详情（抽屉） ---------- */
window.cgDetail=function(no){
  const c=cgOf(no);if(!c)return;
  const rs=DB.consignReturns.filter(r=>r.consignOrderNo===no);
  drawer(`<div class="drawer-hd"><div><h3>${c.consignOrderNo} · 供货单</h3>
    <div style="font-size:12.5px;color:var(--ts);margin-top:2px">${c.shopName} · ${c.warehouseName}</div></div>
    <span class="x" onclick="closeDrawer()">×</span></div>
  <div class="drawer-bd">
    ${c.status==50?`<div class="ib ib-gr"><span class="i">🚫</span>本单已于 ${c.cancelTime} 由 ${c.cancelName} 作废，不可恢复，也不能发起退货。</div>`:''}
    <dl class="dl">
      <dt>状态</dt><dd>${cgTag(c.status)}</dd>
      <dt>商家编码</dt><dd class="mono">${c.merchantCode}</dd>
      <dt>商家店铺</dt><dd>${c.shopName}</dd>
      <dt>仓库编码</dt><dd class="mono">${c.warehouseCode}</dd>
      <dt>仓库</dt><dd>${c.warehouseName}</dd>
      <dt>期望到货时间</dt><dd>${c.expectArrivalTime}</dd>
      <dt>预约到货时间</dt><dd>${dash(c.bookingArrivalTime)}</dd>
      <dt>WMS 入库单号</dt><dd class="mono">${dash(c.wmsOrderNo)}</dd>
      <dt>WMS 推送状态</dt><dd>${WMS_PUSH[c.wmsPushStatus]}</dd>
      <dt>入库完成时间</dt><dd>${dash(c.inboundFinishTime)}</dd>
      <dt>创建人</dt><dd>${c.createName}</dd>
      <dt>创建时间</dt><dd>${c.createTime}</dd>
      ${c.status==50?`<dt>作废人</dt><dd>${c.cancelName}</dd><dt>作废时间</dt><dd>${c.cancelTime}</dd>`:''}
      <dt>备注</dt><dd>${dash(c.remark)}</dd>
    </dl>

    <div style="font-weight:600;font-size:13px;margin:18px 2px 6px">商品明细</div>
    <table><thead><tr><th>货品编码</th><th>商品名称</th><th>规格</th><th>单位</th>
      <th style="text-align:right">供货数量</th><th style="text-align:right">实际入库数量</th><th style="text-align:right">已退数量</th></tr></thead><tbody>
      ${c.items.map(i=>{const rq=returnedQty(no,i.itemCode);return `<tr>
        <td class="mono">${i.itemCode}</td>
        <td><b>${i.itemName}</b></td>
        <td style="color:var(--ts)">${i.itemSpec}</td>
        <td>${i.measureUnitDesc}</td>
        <td style="text-align:right">${i.quantity}</td>
        <td style="text-align:right;font-weight:600">${i.actualQuantity==null?'<span style="color:var(--tt)">—</span>':i.actualQuantity}</td>
        <td style="text-align:right">${rq>0?rq:'<span style="color:var(--tt)">—</span>'}</td>
      </tr>`;}).join('')}
    </tbody></table>

    ${rs.length?`<div style="font-weight:600;font-size:13px;margin:18px 2px 6px">关联退货单</div>
    <table><thead><tr><th>退货单号</th><th>状态</th><th>创建时间</th><th>操作</th></tr></thead><tbody>
      ${rs.map(r=>`<tr><td class="mono">${r.returnOrderNo}</td><td>${crTag(r.status)}</td><td style="font-size:12px">${r.createTime}</td>
        <td><button class="btn btn-link btn-sm" onclick="crDetail('${r.returnOrderNo}')">查看</button></td></tr>`).join('')}
    </tbody></table>`:''}
  </div>
  <div class="drawer-ft">
    <button class="btn btn-o" onclick="closeDrawer()">关闭</button>
    ${canReturn(c)?`<button class="btn btn-p" onclick="crCreate('${c.consignOrderNo}')">发起退货</button>`:''}
    ${canCancel(c)?`<button class="btn btn-d" onclick="cgCancelAsk('${c.consignOrderNo}')">作废</button>`:''}
  </div>`);
};

/* ---------- 作废：不填原因，二次确认；已推 WMS 的同步取消入库单 ---------- */
window.cgCancelAsk=function(no){
  const c=cgOf(no);if(!c)return;
  const pushed=c.wmsPushStatus===1&&c.wmsOrderNo;
  askConfirm(`确定作废供货单 <b>${c.consignOrderNo}</b>？作废后<b>不可恢复</b>，也不能再发起退货。`
    +(pushed?`<br>该单已推送 WMS（入库单 <b>${c.wmsOrderNo}</b>），作废时将<b>同步取消 WMS 入库单</b>。`:''),
    ()=>cgCancelDo(no));
};
window.cgCancelDo=function(no){
  const c=cgOf(no);if(!c)return;
  // WMS 取消失败 → 整单作废失败，状态不变（演示：WMS 单号以 4 结尾 = 仓库已开始收货）
  if(c.wmsPushStatus===1&&c.wmsOrderNo&&c.wmsOrderNo.endsWith('4')){
    closeDrawer();toast(`WMS 入库单 ${c.wmsOrderNo} 取消失败：已开始收货，供货单未作废`,'err');return;
  }
  c.status=50;c.cancelName='沈亮';c.cancelTime=ts();
  closeDrawer();render();toast(`供货单 ${c.consignOrderNo} 已作废${c.wmsOrderNo?'，WMS 入库单已同步取消':''}`,'ok');
};

/* =========================================================================
   页面：退货单管理
   ========================================================================= */
const CR_TABS = [['all','全部'],['10','待出库'],['20','已出库'],['30','已作废']];

PAGES['p-consign-return']=()=>{
  const tab=DB.crTab;
  const all=DB.consignReturns.slice().sort((a,b)=>b.createTime.localeCompare(a.createTime));
  const list=tab=='all'?all:all.filter(r=>String(r.status)==tab);
  const cnt=k=>k=='all'?all.length:all.filter(r=>String(r.status)==k).length;
  return `
  <div class="card"><div class="card-bd">
    <div class="fg3">
      <div class="fr"><label class="fl">退货单号</label><input placeholder="请输入"></div>
      <div class="fr"><label class="fl">供货单号</label><input placeholder="请输入"></div>
      <div class="fr"><label class="fl">商家店铺</label><input placeholder="请搜索商家店铺"></div>
    </div>
    <div class="fg3">
      <div class="fr"><label class="fl">仓库</label><select><option>全部</option>${WAREHOUSES.map(w=>`<option>${w.name}</option>`).join('')}</select></div>
      <div class="fr"><label class="fl">创建时间</label><input type="date"></div>
      <div class="fr" style="align-self:end"><button class="btn btn-p">查询</button> <button class="btn btn-o">重置</button></div>
    </div>
  </div></div>

  <div class="tabs">${CR_TABS.map(t=>`<div class="tab ${tab==t[0]?'active':''}" onclick="DB.crTab='${t[0]}';render()">${t[1]}${cnt(t[0])?`<span class="tb" style="background:var(--ts)">${cnt(t[0])}</span>`:''}</div>`).join('')}</div>

  <div class="card"><div class="card-hd"><h3>退货单列表</h3><span class="sub">共 ${list.length} 单 · 每张退货单必须关联一张已完成的供货单</span>
    <div class="row" style="margin-left:auto;gap:8px"><button class="btn btn-p" onclick="crPick()">＋ 新建退货单</button><button class="btn btn-o">导出</button></div></div>
  <div class="card-bd flush"><div style="overflow-x:auto"><table>
    <thead><tr><th>退货单号</th><th>关联供货单</th><th>商家店铺</th><th>仓库</th><th>退货商品</th><th>退货数量</th><th>WMS 出库单</th><th>状态</th><th>创建人</th><th>创建时间</th><th>操作</th></tr></thead>
    <tbody>${list.map(r=>`<tr>
      <td class="mono">${r.returnOrderNo}</td>
      <td><button class="btn btn-link btn-sm" style="padding:0" onclick="cgDetail('${r.consignOrderNo}')">${r.consignOrderNo}</button></td>
      <td>${r.shopName}</td>
      <td>${r.warehouseName}</td>
      <td style="min-width:130px;white-space:normal">${r.items.map(i=>`<div>${meta(i.itemCode).itemName}</div>`).join('')}</td>
      <td style="white-space:nowrap">${r.items.map(i=>`<div>${i.returnQuantity} ${meta(i.itemCode).measureUnitDesc}</div>`).join('')}</td>
      <td class="mono" style="font-size:12px">${dash(r.wmsOrderNo)}</td>
      <td>${crTag(r.status)}</td>
      <td>${r.createName}</td>
      <td style="font-size:12px">${r.createTime}</td>
      <td style="white-space:nowrap">
        <button class="btn btn-o btn-sm" onclick="crDetail('${r.returnOrderNo}')">详情</button>
        ${r.status==10?` <button class="btn btn-link btn-sm" style="color:var(--r)" onclick="crCancelAsk('${r.returnOrderNo}')">作废</button>`:''}
      </td></tr>`).join('')||`<tr><td colspan="11" style="text-align:center;color:var(--ts);padding:22px">该状态暂无退货单</td></tr>`}
    </tbody></table></div></div></div>`;
};

/* ---------- 新建退货单 · 第一步：选关联供货单（只列已完成且仍有可退额度的） ---------- */
// 候选池：已完成且仍有可退额度；筛选条件（商家店铺下拉 + 供货单号模糊）只在池内过滤，不放宽口径
const crPickPool = () => DB.consigns.filter(canReturn)
  .sort((a,b)=>b.inboundFinishTime.localeCompare(a.inboundFinishTime));
function crPickList(){
  const q=DB.crPickQ||{}, no=(q.no||'').trim().toUpperCase(), shop=q.shop||'';
  return crPickPool().filter(c=>
    (!no || c.consignOrderNo.toUpperCase().includes(no)) &&
    (!shop || c.merchantCode===shop));
}
window.crPick=function(){
  DB.crPickQ={no:'',shop:''};
  const pool=crPickPool();
  // 商家下拉取自候选池本身：列出的商家一定有可退的单，选完不会空
  const shops=[...new Map(pool.map(c=>[c.merchantCode,c.shopName])).entries()];
  drawer(`<div class="drawer-hd"><div><h3>选择关联供货单</h3>
    <div style="font-size:12.5px;color:var(--ts);margin-top:2px">退货单必须关联供货单，只能选「已完成」且仍有可退数量的单</div></div>
    <span class="x" onclick="closeDrawer()">×</span></div>
  <div class="drawer-bd">
    ${pool.length?`
    <div class="fg2" style="margin-bottom:4px">
      <div class="fr"><label class="fl">商家店铺</label>
        <select id="cr-pick-shop" onchange="crPickSet('shop',this.value)">
          <option value="">全部商家</option>
          ${shops.map(([code,name])=>`<option value="${code}">${name}（${code}）</option>`).join('')}
        </select></div>
      <div class="fr"><label class="fl">供货单号</label>
        <input id="cr-pick-no" placeholder="输入单号片段即时筛选" oninput="crPickSet('no',this.value)"></div>
    </div>
    <div style="display:flex;align-items:center;margin:2px 2px 8px">
      <span style="font-size:12.5px;color:var(--ts)">可退供货单 <b id="cr-pick-cnt">${pool.length}</b> 单</span>
      <button class="btn btn-link btn-sm" style="margin-left:auto;padding:0" onclick="crPickReset()">重置筛选</button>
    </div>
    <table><thead><tr><th>供货单号</th><th>商家编码</th><th>商家店铺</th><th>仓库</th><th>入库完成时间</th><th style="text-align:right">可退合计</th><th></th></tr></thead>
    <tbody id="cr-pick-tb">${crPickRows()}</tbody></table>`
    :`<div class="empty"><div class="e-ic">📦</div><div class="e-t">暂无可退货的供货单</div><div class="e-s">只有「已完成」且实际入库数量未退完的供货单可以发起退货</div></div>`}
  </div>
  <div class="drawer-ft"><button class="btn btn-o" onclick="closeDrawer()">取消</button></div>`);
};
function crPickRows(){
  const list=crPickList();
  if(!list.length)return `<tr><td colspan="7" style="text-align:center;color:var(--ts);padding:22px">没有符合筛选条件的可退供货单</td></tr>`;
  return list.map(c=>{const tot=c.items.reduce((a,i)=>a+returnableQty(c,i),0);return `<tr>
    <td class="mono">${c.consignOrderNo}</td>
    <td class="mono">${c.merchantCode}</td>
    <td>${c.shopName}</td>
    <td>${c.warehouseName}</td>
    <td style="font-size:12px">${c.inboundFinishTime}</td>
    <td style="text-align:right;font-weight:600">${tot}</td>
    <td><button class="btn btn-p btn-sm" onclick="crCreate('${c.consignOrderNo}')">选择</button></td></tr>`;}).join('');
}
// 只重绘 tbody 与计数，不重画抽屉——否则输入框会失焦
function crPickRefresh(){
  const tb=document.getElementById('cr-pick-tb');if(tb)tb.innerHTML=crPickRows();
  const cn=document.getElementById('cr-pick-cnt');if(cn)cn.textContent=crPickList().length;
}
window.crPickSet=function(k,v){(DB.crPickQ=DB.crPickQ||{})[k]=v;crPickRefresh();};
window.crPickReset=function(){
  DB.crPickQ={no:'',shop:''};
  const s=document.getElementById('cr-pick-shop');if(s)s.value='';
  const n=document.getElementById('cr-pick-no');if(n)n.value='';
  crPickRefresh();
};

/* ---------- 新建退货单 · 第二步：勾明细 + 填退货数量 ---------- */
window.crCreate=function(consignOrderNo){
  const c=cgOf(consignOrderNo);if(!c)return;
  DB.crDraft={consignOrderNo, remark:'',
    lines:c.items.map(i=>{const able=returnableQty(c,i);
      return {itemCode:i.itemCode, itemName:i.itemName, itemSpec:i.itemSpec, measureUnitDesc:i.measureUnitDesc,
              actualQuantity:i.actualQuantity, returned:returnedQty(consignOrderNo,i.itemCode),
              able, checked:false, qty:able>0?able:0};})};
  crPaint();
};
function crPaint(){
  const d=DB.crDraft, c=cgOf(d.consignOrderNo);
  const picked=d.lines.filter(l=>l.checked);
  drawer(`<div class="drawer-hd"><div><h3>新建退货单</h3>
    <div style="font-size:12.5px;color:var(--ts);margin-top:2px">关联供货单 <span class="mono">${c.consignOrderNo}</span> · ${c.shopName} · ${c.warehouseName}</div></div>
    <span class="x" onclick="closeDrawer()">×</span></div>
  <div class="drawer-bd">
    <dl class="dl">
      <dt>关联供货单</dt><dd class="mono">${c.consignOrderNo}</dd>
      <dt>商家编码</dt><dd class="mono">${c.merchantCode}</dd>
      <dt>商家店铺</dt><dd>${c.shopName}</dd>
      <dt>退货出库仓</dt><dd>${c.warehouseName}（与供货单入库仓一致，不可改）</dd>
      <dt>入库完成时间</dt><dd>${c.inboundFinishTime}</dd>
    </dl>

    <div style="font-weight:600;font-size:13px;margin:18px 2px 6px">退货商品明细 · 勾选后填写本次退货数量</div>
    <table><thead><tr>
      <th style="width:36px"><input type="checkbox" ${d.lines.every(l=>l.able<=0||l.checked)&&picked.length?'checked':''} onclick="crCheckAll(this.checked)"></th>
      <th>货品编码</th><th>商品名称</th><th>规格</th><th style="text-align:right">实际入库</th><th style="text-align:right">已退</th><th style="text-align:right">可退</th><th style="text-align:right">本次退货数量</th>
    </tr></thead><tbody>
      ${d.lines.map((l,ix)=>`<tr style="${l.able<=0?'opacity:.5':''}">
        <td><input type="checkbox" ${l.checked?'checked':''} ${l.able<=0?'disabled':''} onclick="crCheck(${ix},this.checked)"></td>
        <td class="mono" style="font-size:12px">${l.itemCode}</td>
        <td><b>${l.itemName}</b></td>
        <td style="color:var(--ts)">${l.itemSpec}</td>
        <td style="text-align:right">${l.actualQuantity}</td>
        <td style="text-align:right">${l.returned||'—'}</td>
        <td style="text-align:right;font-weight:600">${l.able}</td>
        <td style="text-align:right">${l.able<=0?'<span style="color:var(--ts);font-size:12px">已退完</span>':`
          <div class="stepper">
            <button onclick="crStep(${ix},-1)" ${!l.checked||l.qty<=1?'disabled':''}>−</button>
            <input type="number" min="1" max="${l.able}" value="${l.qty}" ${l.checked?'':'disabled'} oninput="crSetQty(${ix},this.value)">
            <button onclick="crStep(${ix},1)" ${!l.checked||l.qty>=l.able?'disabled':''}>＋</button>
          </div>`}</td>
      </tr>`).join('')}
    </tbody></table>

    <div class="fr" style="margin-top:16px"><label class="fl">备注（选填）</label>
      <input id="cr-remark" maxlength="500" placeholder="如：客户反馈瓶身渗漏" value="${d.remark}" oninput="DB.crDraft.remark=this.value"></div>

    <dl class="dl" style="margin-top:14px">
      <dt>提交后</dt><dd>生成退货单（<b>待出库</b>）并推送 WMS 出库单，仓库出库完成后回写实际出库数量</dd>
      <dt>可退口径</dt><dd>可退数量 = 实际入库数量 − 已退数量；待出库与已出库都占用额度，退货单作废后释放</dd>
    </dl>
  </div>
  <div class="drawer-ft">
    <div style="margin-right:auto;font-size:12.5px;color:var(--ts)">已选 <b>${picked.length}</b> 项 · 合计退货 <b>${picked.reduce((a,l)=>a+l.qty,0)}</b></div>
    <button class="btn btn-o" onclick="closeDrawer()">取消</button>
    <button class="btn btn-p" onclick="crSubmit()" ${picked.length?'':'disabled'}>保存并提交</button>
  </div>`);
}
window.crCheck=function(ix,v){
  const l=DB.crDraft.lines[ix];l.checked=v;
  if(v&&l.qty<=0)l.qty=l.able;
  crPaint();
};
window.crCheckAll=function(v){
  DB.crDraft.lines.forEach(l=>{if(l.able>0){l.checked=v;if(v&&l.qty<=0)l.qty=l.able;}});
  crPaint();
};
window.crStep=function(ix,d){
  const l=DB.crDraft.lines[ix];if(!l.checked)return;
  l.qty=Math.min(l.able,Math.max(1,l.qty+d));crPaint();
};
window.crSetQty=function(ix,v){
  const l=DB.crDraft.lines[ix];let q=parseInt(v,10);
  if(isNaN(q)||q<1)q=1;
  if(q>l.able){toast(`「${l.itemName}」退货数量不能超过可退数量 ${l.able}${l.measureUnitDesc}`,'err');q=l.able;}
  l.qty=q;crPaint();
};
window.crSubmit=function(){
  const d=DB.crDraft,c=cgOf(d.consignOrderNo);
  const picked=d.lines.filter(l=>l.checked);
  if(!picked.length){toast('请至少勾选一条退货商品明细','err');return;}
  // 提交前二次校验（防并发：期间可能已有别的退货单占用额度）
  for(const l of picked){
    const able=returnableQty(c,{itemCode:l.itemCode,actualQuantity:l.actualQuantity});
    if(!(l.qty>0)){toast(`「${l.itemName}」退货数量必须大于 0`,'err');return;}
    if(l.qty>able){toast(`「${l.itemName}」可退数量已变为 ${able}，请调整后重试`,'err');return;}
  }
  const seq=String(++DB.cgSeq+1).padStart(4,'0');
  const day=ts().slice(0,10).replace(/-/g,'');
  const r={returnOrderNo:'TH'+day+seq, consignOrderNo:c.consignOrderNo, shopName:c.shopName,
    warehouseCode:c.warehouseCode, warehouseName:c.warehouseName, status:10, remark:d.remark,
    wmsPushStatus:1, wmsOrderNo:'JSC'+day+seq, createName:'沈亮', createTime:ts(),
    outboundFinishTime:'', cancelName:'', cancelTime:'',
    items:picked.map(l=>({itemCode:l.itemCode, returnQuantity:l.qty, actualReturnQuantity:null}))};
  DB.consignReturns.unshift(r);DB.crDraft=null;
  closeDrawer();DB.crTab='all';nav('p-consign-return');
  toast(`退货单 ${r.returnOrderNo} 已提交，WMS 出库单 ${r.wmsOrderNo} 已下发`,'ok');
};

/* ---------- 退货单详情（抽屉） ---------- */
window.crDetail=function(no){
  const r=crOf(no);if(!r)return;const c=cgOf(r.consignOrderNo);
  drawer(`<div class="drawer-hd"><div><h3>${r.returnOrderNo} · 退货单</h3>
    <div style="font-size:12.5px;color:var(--ts);margin-top:2px">${r.shopName} · ${r.warehouseName}</div></div>
    <span class="x" onclick="closeDrawer()">×</span></div>
  <div class="drawer-bd">
    ${r.status==30?`<div class="ib ib-gr"><span class="i">🚫</span>本单已于 ${r.cancelTime} 由 ${r.cancelName} 作废，退货数量已退回供货单可退额度。</div>`:''}
    <dl class="dl">
      <dt>状态</dt><dd>${crTag(r.status)}</dd>
      <dt>关联供货单</dt><dd><button class="btn btn-link btn-sm" style="padding:0" onclick="cgDetail('${r.consignOrderNo}')">${r.consignOrderNo}</button></dd>
      <dt>商家店铺</dt><dd>${r.shopName}</dd>
      <dt>出库仓编码</dt><dd class="mono">${r.warehouseCode}</dd>
      <dt>退货出库仓</dt><dd>${r.warehouseName}</dd>
      <dt>WMS 出库单号</dt><dd class="mono">${dash(r.wmsOrderNo)}</dd>
      <dt>WMS 推送状态</dt><dd>${WMS_PUSH[r.wmsPushStatus]}</dd>
      <dt>出库完成时间</dt><dd>${dash(r.outboundFinishTime)}</dd>
      <dt>创建人</dt><dd>${r.createName}</dd>
      <dt>创建时间</dt><dd>${r.createTime}</dd>
      ${r.status==30?`<dt>作废人</dt><dd>${r.cancelName}</dd><dt>作废时间</dt><dd>${r.cancelTime}</dd>`:''}
      <dt>备注</dt><dd>${dash(r.remark)}</dd>
    </dl>

    <div style="font-weight:600;font-size:13px;margin:18px 2px 6px">退货商品明细</div>
    <table><thead><tr><th>货品编码</th><th>商品名称</th><th>规格</th><th>单位</th>
      <th style="text-align:right">实际入库数量</th><th style="text-align:right">本次退货数量</th><th style="text-align:right">实际出库数量</th></tr></thead><tbody>
      ${r.items.map(i=>{const m=meta(i.itemCode);const src=c?c.items.find(x=>x.itemCode==i.itemCode):null;return `<tr>
        <td class="mono">${i.itemCode}</td>
        <td><b>${m.itemName}</b></td>
        <td style="color:var(--ts)">${m.itemSpec}</td>
        <td>${m.measureUnitDesc}</td>
        <td style="text-align:right">${src&&src.actualQuantity!=null?src.actualQuantity:'<span style="color:var(--tt)">—</span>'}</td>
        <td style="text-align:right;font-weight:600">${i.returnQuantity}</td>
        <td style="text-align:right">${i.actualReturnQuantity==null?'<span style="color:var(--tt)">—</span>':i.actualReturnQuantity}</td>
      </tr>`;}).join('')}
    </tbody></table>
  </div>
  <div class="drawer-ft">
    <button class="btn btn-o" onclick="closeDrawer()">关闭</button>
    ${r.status==10?`<button class="btn btn-o" onclick="crShipDone('${r.returnOrderNo}')">模拟 WMS 出库完成</button>
      <button class="btn btn-d" onclick="crCancelAsk('${r.returnOrderNo}')">作废</button>`:''}
  </div>`);
};

/* WMS 回写：出库完成 → 已出库（演示用，线上由 WMS 消息驱动） */
window.crShipDone=function(no){
  const r=crOf(no);if(!r||r.status!=10)return;
  r.items.forEach(i=>i.actualReturnQuantity=i.returnQuantity);
  r.status=20;r.outboundFinishTime=ts();
  closeDrawer();render();toast(`退货单 ${r.returnOrderNo} 已出库`,'ok');
};

window.crCancelAsk=function(no){
  const r=crOf(no);if(!r)return;
  askConfirm(`确定作废退货单 <b>${r.returnOrderNo}</b>？作废后<b>不可恢复</b>，退货数量将退回供货单 ${r.consignOrderNo} 的可退额度。`
    +(r.wmsOrderNo?`<br>该单已推送 WMS（出库单 <b>${r.wmsOrderNo}</b>），作废时将<b>同步取消 WMS 出库单</b>。`:''),
    ()=>{r.status=30;r.cancelName='沈亮';r.cancelTime=ts();closeDrawer();render();toast(`退货单 ${r.returnOrderNo} 已作废`,'ok');});
};

})();
