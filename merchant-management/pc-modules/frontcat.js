/* 店铺运营平台 · 前台类目（p-frontcat）
   按线上 h5-foodmax-platform 还原（views/front-category/index.vue + components/front-category-{tree,detail,rules,products,preview}.vue，
   Element UI 默认尺寸，主题色 $--color-primary:#009919，见 src/scss/element-variables.scss）。样式全部挂在 .fco 下，不影响原型其他页。
   本期新增（2026-11-23）：末级类目（L2）加「是否同品展示」是/否，默认否；运营平台只存开关，商城侧读取后自行处理展示。L1 不展示该字段。
   本期新增（2026-11-24）：指定商品下加「置顶排序」池，最多 10 个、只能选本类目预计最终展示的商品，拖动/上移/下移调位次，其余按商城默认排序。 */
(function(){
  const CSS=`<style>
.fco{--p:#009919;--pl:#e6f5e8;--pb:#99d6a3;font-size:14px;color:#303133;font-family:"Helvetica Neue",Helvetica,"PingFang SC","Hiragino Sans GB","Microsoft YaHei",Arial,sans-serif}
.fco *{box-sizing:border-box}
.fco .fpg{display:flex;gap:16px;height:calc(100vh - 140px);min-height:640px}
.fco .left{width:320px;flex-shrink:0;background:#fff;border-radius:4px;border:1px solid #ebeef5;overflow:hidden;display:flex;flex-direction:column}
.fco .right{flex:1;min-width:0;background:#fff;border-radius:4px;border:1px solid #ebeef5;overflow-y:auto;padding:20px}
.fco .t-hd{display:flex;align-items:center;justify-content:space-between;padding:12px 16px;border-bottom:1px solid #ebeef5}
.fco .t-hd h3{font-size:14px;font-weight:600;margin:0}
.fco .t-search{padding:8px 12px;border-bottom:1px solid #ebeef5;position:relative}
.fco .t-search input.in{padding-left:30px!important}
.fco .t-search i{position:absolute;left:22px;top:13px;z-index:1;color:#c0c4cc;font-style:normal;font-size:13px}
.fco .t-bd{flex:1;overflow-y:auto;padding:8px 0}
.fco .node{display:flex;align-items:center;height:26px;cursor:pointer;font-size:13px;padding-right:8px}
.fco .node:hover{background:#f5f7fa}.fco .node.cur{background:#f0f9f1}
.fco .node .exp{width:24px;text-align:center;color:#c0c4cc;font-size:10px;flex-shrink:0}
.fco .node .exp.leaf{visibility:hidden}
.fco .node .lb{display:flex;align-items:center;gap:6px;flex:1;min-width:0}
.fco .node .lb .nm{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.fco .node .lb .off{color:#c0c4cc}
.fco .node .cnt{color:#909399;font-size:12px}
.fco .node .act{opacity:0;transition:opacity .2s}.fco .node:hover .act{opacity:1}
.fco .tag{font-weight:400;letter-spacing:0;display:inline-block;height:20px;line-height:18px;padding:0 5px;font-size:12px;border-radius:4px;border:1px solid;white-space:nowrap}
.fco .tag.sm{height:24px;line-height:22px;padding:0 8px}
.fco .tag.blue{color:#409eff;background:#fff;border-color:#b3d8ff}
.fco .tag.blue.fill{background:#ecf5ff;border-color:#d9ecff}
.fco .tag.info{color:#909399;background:#fff;border-color:#d3d4d6}
.fco .tag.info.fill{background:#f4f4f5;border-color:#e9e9eb}
.fco .tag.ok{color:#67c23a;background:#f0f9eb;border-color:#e1f3d8}
.fco .btn{display:inline-flex;align-items:center;justify-content:center;height:32px;padding:0 15px;font-size:12px;border-radius:3px;border:1px solid #dcdfe6;background:#fff;color:#606266;cursor:pointer;white-space:nowrap;font-family:inherit}
.fco .btn.mini{height:28px;padding:0 15px}
.fco .btn:hover{color:var(--p);border-color:var(--pb);background:var(--pl)}
.fco .btn.pr{background:var(--p);border-color:var(--p);color:#fff}.fco .btn.pr:hover{background:#33ad47;border-color:#33ad47}
.fco .btn.plain{background:var(--pl);border-color:var(--pb);color:var(--p)}.fco .btn.plain:hover{background:var(--p);color:#fff}
.fco .btn.txt{border:none;background:none;padding:0;height:auto;color:var(--p)}
.fco input.in{width:100%;height:32px;line-height:32px;border:1px solid #dcdfe6;border-radius:4px;padding:0 15px;font-size:13px;color:#606266;outline:none;font-family:inherit;margin:0}
.fco input.in:focus{border-color:var(--p)}.fco input.in::placeholder{color:#c0c4cc}
.fco input.in:disabled{background:#f5f7fa;border-color:#e4e7ed;color:#c0c4cc;cursor:not-allowed}
.fco .detail{max-width:800px}
.fco .d-hd{display:flex;align-items:center;gap:12px;margin-bottom:20px}
.fco .d-hd h3{font-size:16px;font-weight:600;margin:0}
.fco .d-hd .acts{margin-left:auto;display:flex;gap:8px}
.fco .fi{display:flex;margin-bottom:18px}
.fco .fi .fl{width:120px;flex-shrink:0;text-align:right;padding-right:12px;line-height:32px;font-size:13px;color:#606266}
.fco .fi .fl .rq{color:#f56c6c;margin-right:4px}
.fco .fi .fc{flex:1;min-width:0;line-height:32px;position:relative}
.fco .wl{position:absolute;right:10px;top:0;font-size:12px;color:#909399}
.fco .num{display:inline-flex;width:130px;height:32px;border:1px solid #dcdfe6;border-radius:4px;overflow:hidden}
.fco .num span{width:32px;background:#f5f7fa;color:#606266;display:flex;align-items:center;justify-content:center;cursor:pointer;user-select:none}
.fco .num span:first-child{border-right:1px solid #dcdfe6}.fco .num span:last-child{border-left:1px solid #dcdfe6}
.fco .num span.dis{color:#c0c4cc;cursor:not-allowed}
.fco .num input{flex:1;width:0;border:none;text-align:center;font-size:13px;color:#606266;outline:none;font-family:inherit}
.fco .img{width:148px;height:148px;border:1px solid #c0ccda;border-radius:6px;overflow:hidden;display:flex;align-items:center;justify-content:center;background:#fff}
.fco .img.empty{border-style:dashed;background:#fbfdff;color:#8c939d;font-size:28px;cursor:pointer}
.fco .img.empty:hover{border-color:var(--p)}
.fco .img .pic{width:100%;height:100%;display:flex;flex-wrap:wrap;align-items:center;justify-content:center;font-size:30px;line-height:1;background:linear-gradient(135deg,#f7f3e8,#eef6e4)}
.fco .hint{color:#909399;font-size:12px;margin-top:4px;line-height:1.5}
.fco .rd{display:inline-flex;align-items:center;margin-right:30px;cursor:pointer;font-size:14px;color:#606266;user-select:none}
.fco .rd i{width:14px;height:14px;border-radius:50%;border:1px solid #dcdfe6;margin-right:8px;position:relative;background:#fff}
.fco .rd.on{color:var(--p)}.fco .rd.on i{border-color:var(--p);background:var(--p)}
.fco .rd.on i:after{content:"";position:absolute;left:4px;top:4px;width:4px;height:4px;border-radius:50%;background:#fff}
.fco .dv{position:relative;border-top:1px solid #dcdfe6;margin:24px 0}
.fco .dv span{position:absolute;left:20px;top:-10px;background:#fff;padding:0 20px;font-size:14px;font-weight:500;color:#303133;line-height:20px}
.fco .sh{display:flex;align-items:center;gap:12px;margin-bottom:12px}
.fco .sh h4{font-size:14px;font-weight:600;margin:0}
.fco .sh .tip{color:#909399;font-size:12px;flex:1}
.fco .prio{color:#e6a23c;font-size:12px;margin-bottom:12px;padding:6px 12px;background:#fdf6ec;border-radius:4px}
.fco .empty{color:#909399;font-size:13px;padding:16px;text-align:center;margin-bottom:12px}
.fco .grp{margin-bottom:16px}
.fco .grp-hd{display:flex;align-items:center;justify-content:space-between;margin-bottom:8px}
.fco .grp-hd span{font-size:13px;font-weight:500}
.fco .chips{display:flex;flex-wrap:wrap;gap:6px;min-height:28px;align-items:center;color:#c0c4cc;font-size:12px}
.fco .sum{display:flex;gap:24px;padding:10px 16px;margin-bottom:16px;background:#f5f7fa;border-radius:4px;font-size:13px}
.fco .sum b{font-weight:600}.fco .sum .r{color:#f56c6c}.fco .sum .g{color:#67c23a}
.fco table{width:100%;border-collapse:collapse;font-size:12px;border:1px solid #ebeef5}
.fco th{background:#fff;color:#909399;font-weight:500;text-align:left;padding:8px 10px;border:1px solid #ebeef5}
.fco td{padding:8px 10px;border:1px solid #ebeef5;color:#606266}
.fco tbody tr:nth-child(even) td{background:#fafafa}
.fco .foot{padding:8px 0;text-align:right;font-size:12px;color:#909399}
.fco .tag.chip{height:24px;line-height:22px;padding:0 8px;background:#ecf5ff;border-color:#d9ecff;color:#409eff}
.fco .tag.chip b{font-weight:400;margin-left:6px;cursor:pointer;font-size:12px}
.fco .grp-hd .lbl{display:flex;align-items:center;gap:8px}
.fco .grp-hd .lbl em{font-style:normal;font-weight:400;font-size:12px;color:#909399}
.fco .cnt-b{font-weight:400;font-size:12px;color:#909399}.fco .cnt-b b{color:var(--p);font-weight:600}
.fco .top-tb td{padding:6px 10px;font-size:12px}
.fco .top-tb tr.drag td{background:#f0f9f1!important}
.fco .top-tb .hdl{cursor:move;color:#c0c4cc;user-select:none;font-size:14px;letter-spacing:-2px}
.fco .rank{display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;border-radius:50%;background:#f4f4f5;color:#606266;font-size:12px}
.fco .rank.t3{background:var(--p);color:#fff}
.fco .lk{color:var(--p);cursor:pointer;margin-right:12px;background:none;border:none;font:inherit;font-size:12px;padding:0}
.fco .lk:disabled{color:#c0c4cc;cursor:not-allowed}.fco .lk.dg{color:#f56c6c}
.fco .top-empty{color:#909399;font-size:12px;padding:14px;text-align:center;border:1px dashed #dcdfe6;border-radius:4px}
.fco .mask{position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:2000;display:flex;align-items:flex-start;justify-content:center;padding-top:15vh}
.fco .dlg{width:620px;background:#fff;border-radius:2px;box-shadow:0 1px 3px rgba(0,0,0,.3)}
.fco .dlg-hd{padding:20px 20px 10px;font-size:18px;color:#303133;display:flex;justify-content:space-between}
.fco .dlg-hd span{cursor:pointer;color:#909399;font-size:16px}
.fco .dlg-bd{padding:10px 20px 20px}
.fco .dlg-ft{padding:10px 20px 20px;text-align:right;display:flex;justify-content:flex-end;gap:10px}
.fco .dlg-list{height:280px;overflow-y:auto;border:1px solid #ebeef5;border-radius:4px;margin-top:10px}
.fco .dlg-it{display:flex;align-items:center;gap:10px;padding:9px 14px;border-bottom:1px solid #f5f7fa;cursor:pointer;font-size:13px;color:#606266}
.fco .dlg-it:hover{background:#f5f7fa}.fco .dlg-it.dis{cursor:not-allowed;color:#c0c4cc}
.fco .fck{width:14px;height:14px;border:1px solid #dcdfe6;border-radius:2px;flex-shrink:0;position:relative;background:#fff}
.fco .fck.on{background:var(--p);border-color:var(--p)}.fco .fck.on:after{content:"";position:absolute;left:4px;top:1px;width:3px;height:7px;border:solid #fff;border-width:0 1px 1px 0;transform:rotate(45deg)}
.fco .dlg-it.dis .fck{background:#c0c4cc;border-color:#c0c4cc}
.fco .dlg-sum{font-size:12px;color:#606266;margin-top:10px}.fco .dlg-sum b{color:var(--p)}
.fco .blank{display:flex;align-items:center;justify-content:center;height:100%;color:#909399;font-size:14px}
</style>`;

  let SEQ=0;
  const N=(name,cnt,kids,o)=>Object.assign({id:++SEQ,name,cnt,status:1,sort:0,sameShow:0,kids:kids||null,pic:''},o||{});
  if(!DB.fcTree)DB.fcTree=[
    N('【测试-勿动】新加坡水果1',11,[N('热带水果',9),N('热带水果测试',2),N('测试子分类',0)]),
    N('爆品',93,[N('蔬菜',15,null,{pic:'🥬🥕🌽🍅🫑🥒',sameShow:1,inc:['SPU7233','SPU7234','SPU7238','SPU7232','SPU7286','SPU7240','SPU7235','SPU7241','SPU7231','SPU9511','SPU7230','SPU7236','SPU9512','SPU7237','SPU7239','SPU9510'],pre:[['SPU260721080001','金马伦四季豆'],['SPU260721080002','本地菜心'],['SPU260721080003','小白菜'],['SPU260721080004','番茄 XL'],['SPU260721080005','日本黄瓜'],['SPU260721080006','樱桃番茄'],['SPU260721080007','罗门生菜'],['SPU260721080008','芥菜'],['SPU260721080009','西兰花'],['SPU260721080010','胡萝卜'],['SPU260721080011','大白菜'],['SPU260721080012','菠菜'],['SPU260721080013','洋葱'],['SPU260721080014','土豆'],['SPU260721080015','青椒']],top:['SPU260721080002','SPU260721080004','SPU260721080001']}),N('素食',45),N('优质禽肉',28),N('调味干货',0),N('酒水饮料',5),N('肉禽',0),N('蛋类',0)]),
    N('肉禽',457,[N('冷冻猪肉',60),N('冷冻牛内脏',0),N('冷鲜猪肉',29,null,{sameShow:1}),N('加工冷鲜牛肉',1),N('冷冻牛肉',24),N('冷鲜猪内脏',3),N('冷冻鸡肉',79),N('加工冷鲜猪肉',5),N('加工冷冻猪肉',86),N('加工冷冻牛肉',26),N('加工冷冻鸡肉',43),N('冷冻猪内脏',16)])];
  DB.fcKw=DB.fcKw||'';DB.fcOpen=DB.fcOpen||{};
  const find=id=>{for(const a of DB.fcTree){if(a.id===id)return{n:a,p:null};for(const b of a.kids||[])if(b.id===id)return{n:b,p:a};}return{};};
  const formOf=n=>({name:n?n.name:'',sort:n?n.sort:0,status:n?n.status:1,sameShow:n?n.sameShow:0});
  if(!DB.fcMode){const n=DB.fcTree[1].kids[0];DB.fcMode='edit';DB.fcSel=n.id;DB.fcForm=formOf(n);}

  window.fcPick=function(id){DB.fcMode='edit';DB.fcSel=id;DB.fcForm=formOf(find(id).n);render();};
  window.fcAdd=function(pid){DB.fcMode='create';DB.fcParent=pid||null;DB.fcForm=formOf(null);render();};
  window.fcSet=function(k,v,re){DB.fcForm[k]=v;if(re)render();};
  /* 置顶排序池（本期新增）：最多 10 个，只能从本类目「预计最终展示」商品里选；每次增删/调序即保存（与指定商品加入/移除一致，不单独点保存） */
  const TOP_MAX=10,curN=()=>find(DB.fcSel).n,topOf=n=>(n.top=n.top||[]);
  window.fcTopMove=function(i,d){const t=topOf(curN()),j=i+d;if(j<0||j>=t.length)return;[t[i],t[j]]=[t[j],t[i]];render();toast('置顶排序已保存','ok');};
  window.fcTopDel=function(i){const t=topOf(curN());t.splice(i,1);render();toast('已移出置顶，后面的商品自动前移','ok');};
  window.fcTopPin=function(code){const t=topOf(curN());if(t.includes(code))return;if(t.length>=TOP_MAX)return toast('置顶最多 10 个，请先移出再添加','err');t.push(code);render();toast(`已置顶，排第 ${t.length} 位`,'ok');};
  let dragI=null;
  window.fcTopDragStart=function(i,e){dragI=i;e.dataTransfer.effectAllowed='move';e.currentTarget.classList.add('drag');};
  window.fcTopDrop=function(i,e){e.preventDefault();if(dragI===null||dragI===i)return;const t=topOf(curN()),[x]=t.splice(dragI,1);t.splice(i,0,x);dragI=null;render();toast('置顶排序已保存','ok');};
  window.fcDlgOpen=function(){DB.fcDlg={kw:'',sel:[]};render();};
  window.fcDlgClose=function(){DB.fcDlg=null;render();};
  window.fcDlgToggle=function(code){const d=DB.fcDlg,t=topOf(curN());if(t.includes(code))return;const i=d.sel.indexOf(code);
    if(i>=0)d.sel.splice(i,1);else{if(t.length+d.sel.length>=TOP_MAX)return toast(`最多还能选 ${TOP_MAX-t.length} 个`,'err');d.sel.push(code);}render();};
  window.fcDlgOk=function(){const d=DB.fcDlg;if(!d.sel.length)return toast('请至少选择一个商品','err');const t=topOf(curN());t.push(...d.sel);DB.fcDlg=null;render();toast(`已添加 ${d.sel.length} 个置顶商品`,'ok');};
  window.fcSave=function(){
    const nm=(DB.fcForm.name||'').trim();if(!nm)return toast('请输入类目名称','err');
    const f=DB.fcForm;
    if(DB.fcMode==='edit'){const r=find(DB.fcSel);Object.assign(r.n,{name:nm,sort:f.sort,status:f.status},r.p?{sameShow:f.sameShow}:{});}
    else{const leaf=!!DB.fcParent,n=N(nm,0,leaf?null:[],{sort:f.sort,status:f.status,sameShow:leaf?f.sameShow:0});
      if(leaf){find(DB.fcParent).n.kids.push(n);DB.fcOpen[DB.fcParent]=true;}else DB.fcTree.push(n);
      DB.fcMode='edit';DB.fcSel=n.id;}
    toast('前台类目保存成功','ok');fcPick(DB.fcSel);
  };

  function tree(){
    const kw=DB.fcKw.trim();
    const node=(d,lv,open,hasKids)=>`<div class="node ${DB.fcMode==='edit'&&DB.fcSel===d.id?'cur':''}" style="padding-left:${(lv-1)*18}px" onclick="fcPick(${d.id})">
      <span class="exp ${hasKids?'':'leaf'}" onclick="event.stopPropagation();DB.fcOpen[${d.id}]=${!open};render()">${open?'▼':'▶'}</span>
      <span class="lb"><span class="tag ${lv===1?'blue':'info'}">L${lv}</span><span class="nm ${d.status?'':'off'}">${d.name}</span><span class="cnt">(${d.cnt})</span></span>
      ${lv===1?`<span class="act"><button class="btn txt" onclick="event.stopPropagation();fcAdd(${d.id})">新增子类目</button></span>`:''}</div>`;
    return DB.fcTree.map(a=>{
      const kids=(a.kids||[]).filter(k=>!kw||k.name.includes(kw)||a.name.includes(kw));
      if(kw&&!a.name.includes(kw)&&!kids.length)return '';
      const open=kw?true:DB.fcOpen[a.id]!==false;
      return node(a,1,open,(a.kids||[]).length)+(open?kids.map(b=>node(b,2,false,false)).join(''):'');
    }).join('');
  }

  function detail(){
    const ed=DB.fcMode==='edit',r=ed?find(DB.fcSel):{},n=r.n,f=DB.fcForm;
    const parent=ed?r.p:(DB.fcParent?find(DB.fcParent).n:null),leaf=!!parent;
    const radio=(k,opts)=>opts.map(([v,t])=>`<span class="rd ${f[k]===v?'on':''}" onclick="fcSet('${k}',${v},1)"><i></i>${t}</span>`).join('');
    const item=(l,c,rq)=>`<div class="fi"><div class="fl">${rq?'<span class="rq">*</span>':''}${l}</div><div class="fc">${c}</div></div>`;
    let h=`<div class="detail"><div class="d-hd"><span class="tag sm blue fill">${leaf?'L2':'L1'}</span><h3>${ed?'类目配置':'添加一级类目'}</h3>${ed?(n.status?'<span class="tag sm ok">启用</span>':'<span class="tag sm info fill">停用</span>'):''}
      <span class="acts">${ed?`<button class="btn" onclick="toast('演示：确定删除该前台类目？关联的圈品规则和指定商品将一并删除。','info')">删除</button>`:''}<button class="btn pr" onclick="fcSave()">保存</button></span></div>`;
    h+=item('类目名称',`<input class="in" maxlength="60" value="${f.name}" style="padding-right:56px" oninput="fcSet('name',this.value);this.nextElementSibling.textContent=this.value.length+'/60'"><span class="wl">${f.name.length}/60</span>`,1);
    h+=item('上级类目',`<input class="in" disabled value="${parent?parent.name:'（根分类，无上级）'}">`);
    h+=item('排序',`<span class="num"><span class="${f.sort<=0?'dis':''}" onclick="fcSet('sort',Math.max(0,DB.fcForm.sort-1),1)">−</span><input value="${f.sort}" onchange="fcSet('sort',Math.min(9999,Math.max(0,parseInt(this.value)||0)),1)"><span class="${f.sort>=9999?'dis':''}" onclick="fcSet('sort',Math.min(9999,DB.fcForm.sort+1),1)">+</span></span>`);
    h+=item('类目图片',`${ed&&n.pic?`<div class="img"><div class="pic">${n.pic}</div></div>`:`<div class="img empty" onclick="toast('演示：上传类目图片','info')">+</div>`}<div class="hint">建议尺寸 800×800px，支持 JPG/PNG 格式</div>`);
    h+=item('状态',radio('status',[[1,'启用'],[0,'停用']]));
    if(leaf)h+=item('是否同品展示',radio('sameShow',[[1,'是'],[0,'否']]));
    if(ed&&leaf){
      const rows=n.pre||[],inc=n.inc||[],top=topOf(n),nameOf=c=>(rows.find(x=>x[0]===c)||[c,''])[1];
      h+=`<div class="dv"><span>圈品配置</span></div>
        <div class="sh"><h4>圈品规则</h4><span class="tip">按后台采购类目动态圈选商品，后台类目支持多选</span><button class="btn mini plain" onclick="toast('演示：圈品规则沿用线上，本期不改','info')">添加规则</button></div>
        <div class="prio">优先级：指定剔除 &gt; 指定加入 &gt; 圈品规则</div>
        <div class="empty">请选择后台采购类目</div>
        <div style="margin-bottom:16px"><button class="btn pr" onclick="toast('圈品规则保存成功','ok')">保存</button></div>
        <div class="dv"></div>
        <div class="sh"><h4>指定商品</h4><span class="tip">优先级高于圈品规则</span></div>
        <div class="grp"><div class="grp-hd"><span>指定加入</span><button class="btn" onclick="toast('演示：加入指定商品沿用线上，本期不改','info')">+ 加入商品</button></div><div class="chips">${inc.length?inc.map(c=>`<span class="tag chip">${c}<b onclick="toast('演示：移除指定商品沿用线上','info')">×</b></span>`).join(''):'-'}</div></div>
        <div class="grp"><div class="grp-hd"><span>指定剔除</span><button class="btn" onclick="toast('演示：剔除指定商品沿用线上，本期不改','info')">+ 剔除商品</button></div><div class="chips">-</div></div>
        <div class="grp"><div class="grp-hd"><span class="lbl">置顶排序<span class="cnt-b">已置顶 <b>${top.length}</b> / ${TOP_MAX}</span><em>按顺序展示在本类目最前面，其余商品按商城默认排序；拖动或上移/下移调整位次</em></span><button class="btn" ${top.length>=TOP_MAX||!rows.length?'disabled style="opacity:.5;cursor:not-allowed"':''} onclick="fcDlgOpen()">+ 添加置顶商品</button></div>
          ${top.length?`<table class="top-tb"><thead><tr><th style="width:36px"></th><th style="width:60px">位次</th><th style="width:160px">商品SPU编码</th><th>商品名称</th><th style="width:150px">操作</th></tr></thead><tbody>${top.map((c,i)=>`<tr draggable="true" ondragstart="fcTopDragStart(${i},event)" ondragover="event.preventDefault()" ondrop="fcTopDrop(${i},event)"><td class="hdl">⋮⋮</td><td><span class="rank ${i<3?'t3':''}">${i+1}</span></td><td>${c}</td><td>${nameOf(c)}</td><td><button class="lk" ${i===0?'disabled':''} onclick="fcTopMove(${i},-1)">上移</button><button class="lk" ${i===top.length-1?'disabled':''} onclick="fcTopMove(${i},1)">下移</button><button class="lk dg" onclick="fcTopDel(${i})">移出</button></td></tr>`).join('')}</tbody></table>`
          :`<div class="top-empty">${rows.length?'未设置置顶，本类目全部按商城默认排序':'本类目暂无展示商品，无法设置置顶'}</div>`}</div>
        <div class="dv"></div>
        <div class="sum"><span>规则圈选 <b>0</b> 个</span><span>指定加入 <b>${inc.length}</b> 个</span><span>指定剔除 <b class="r">0</b> 个</span><span>预计最终展示 <b class="g">${rows.length}</b> 个商品</span></div>
        <div class="sh"><h4>商品预览</h4><span class="tip">根据当前圈品规则实时计算，商品默认全部选中</span><button class="btn mini" onclick="toast('演示：导出商品','info')">导出商品</button><button class="btn mini" onclick="toast('已刷新','ok')">刷新</button></div>
        <div style="max-height:360px;overflow-y:auto"><table><thead><tr><th style="width:160px">商品SPU编码</th><th>商品名称</th><th style="width:110px">置顶</th></tr></thead><tbody>${rows.length?rows.map(x=>{const k=top.indexOf(x[0]);return `<tr><td>${x[0]}</td><td>${x[1]}</td><td>${k>=0?`<span class="tag info">第 ${k+1} 位</span>`:`<button class="lk" ${top.length>=TOP_MAX?'disabled title="置顶已满 10 个"':''} onclick="fcTopPin('${x[0]}')">置顶</button>`}</td></tr>`}).join(''):'<tr><td colspan="3" style="text-align:center;color:#909399;padding:30px 0">暂无数据</td></tr>'}</tbody></table></div>
        <div class="foot">预计共 ${rows.length} 个商品</div>`;
    }
    if(DB.fcDlg&&ed&&leaf){const d=DB.fcDlg,rows=n.pre||[],top=topOf(n),left=TOP_MAX-top.length,kw=d.kw.trim();
      const list=rows.filter(x=>!kw||x[0].includes(kw)||x[1].includes(kw));
      h+=`<div class="mask" onclick="if(event.target===this)fcDlgClose()"><div class="dlg"><div class="dlg-hd">添加置顶商品<span onclick="fcDlgClose()">✕</span></div><div class="dlg-bd">
        <div class="prio" style="margin-bottom:10px">只能从本类目「预计最终展示」的商品里选；按勾选顺序追加到置顶末尾</div>
        <input class="in" placeholder="搜索商品名称/编码" value="${d.kw}" oninput="DB.fcDlg.kw=this.value;render();const e=document.querySelector('.fco .dlg input');e.focus();e.setSelectionRange(e.value.length,e.value.length)">
        <div class="dlg-list">${list.map(x=>{const pinned=top.includes(x[0]),on=d.sel.includes(x[0]);return `<div class="dlg-it ${pinned?'dis':''}" onclick="fcDlgToggle('${x[0]}')"><span class="fck ${on||pinned?'on':''}"></span><span style="flex:1">${x[0]} ${x[1]}</span>${pinned?`<span class="tag info">已置顶 第 ${top.indexOf(x[0])+1} 位</span>`:on?`<span class="tag chip" style="height:20px;line-height:18px">将排第 ${top.length+d.sel.indexOf(x[0])+1} 位</span>`:''}</div>`}).join('')||'<div class="empty">暂无数据</div>'}</div>
        <div class="dlg-sum">已选 <b>${d.sel.length}</b> 个 · 还可选 <b>${left-d.sel.length}</b> 个（置顶最多 ${TOP_MAX} 个）</div></div>
        <div class="dlg-ft"><button class="btn" onclick="fcDlgClose()">取消</button><button class="btn pr" onclick="fcDlgOk()">确定</button></div></div></div>`;}
    return h+'</div>';
  }

  PAGES['p-frontcat']=()=>CSS+`<div class="fco"><div class="fpg">
    <div class="left"><div class="t-hd"><h3>前台类目树</h3><button class="btn mini pr" onclick="fcAdd()">添加一级类目</button></div>
      <div class="t-search"><i>⌕</i><input class="in" placeholder="类目名称" value="${DB.fcKw}" oninput="DB.fcKw=this.value;render();const e=document.querySelector('.fco .t-search input');if(e){e.focus();e.setSelectionRange(e.value.length,e.value.length)}"></div>
      <div class="t-bd">${tree()}</div></div>
    <div class="right">${detail()}</div></div></div>`;
})();
