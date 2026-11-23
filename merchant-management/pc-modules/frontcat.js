/* 店铺运营平台 · 前台类目（p-frontcat）
   字段照线上 h5-foodmax-platform views/front-category/components/front-category-detail.vue：类目名称 / 上级类目 / 排序 / 类目图片 / 状态 + 圈品配置（L2）。
   本期新增（2026-11-23）：末级类目（L2）加「是否同品展示」是/否，默认否；运营平台只存开关，商城侧读取后自行处理展示。L1 不展示该字段。 */
(function(){
  let SEQ=0;
  const N=(name,cnt,kids,o)=>Object.assign({id:++SEQ,name,cnt,status:1,sort:0,sameShow:0,kids:kids||null},o||{});
  if(!DB.fcTree)DB.fcTree=[
    N('【测试-勿动】新加坡水果1',11,[N('热带水果',9),N('热带水果测试',2),N('测试子分类',0)]),
    N('爆品',93,[N('蔬菜',15,null,{sameShow:1}),N('素食',45),N('优质禽肉',28),N('调味干货',0),N('酒水饮料',5),N('肉禽',0),N('蛋类',0)]),
    N('肉禽',457,[N('冷冻猪肉',60),N('冷冻牛内脏',0),N('冷鲜猪肉',29,null,{sameShow:1}),N('加工冷鲜牛肉',1),N('冷冻牛肉',24),N('冷鲜猪内脏',3),N('冷冻鸡肉',79),N('加工冷鲜猪肉',5),N('加工冷冻猪肉',86),N('加工冷冻牛肉',26),N('加工冷冻鸡肉',43),N('冷冻猪内脏',16)])];
  DB.fcKw=DB.fcKw||'';DB.fcOpen=DB.fcOpen||{};
  const find=id=>{for(const a of DB.fcTree){if(a.id===id)return{n:a,p:null};for(const b of a.kids||[])if(b.id===id)return{n:b,p:a};}return{};};
  const formOf=n=>({name:n?n.name:'',sort:n?n.sort:0,status:n?n.status:1,sameShow:n?n.sameShow:0});
  if(!DB.fcMode){DB.fcMode='edit';DB.fcSel=DB.fcTree[1].kids[0].id;DB.fcForm=formOf(DB.fcTree[1].kids[0]);}

  window.fcPick=function(id){DB.fcMode='edit';DB.fcSel=id;DB.fcForm=formOf(find(id).n);render();};
  window.fcAdd=function(pid){DB.fcMode='create';DB.fcParent=pid||null;DB.fcForm=formOf(null);render();};
  window.fcSet=function(k,v){DB.fcForm[k]=v;};
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
    return DB.fcTree.map(a=>{
      const kids=(a.kids||[]).filter(k=>!kw||k.name.includes(kw)||a.name.includes(kw));
      if(kw&&!a.name.includes(kw)&&!kids.length)return '';
      const open=kw?true:DB.fcOpen[a.id]!==false,on=DB.fcMode==='edit'&&DB.fcSel===a.id;
      return `<div class="ct-row ${on?'on':''}" onclick="fcPick(${a.id})"><span class="ct-caret" onclick="event.stopPropagation();DB.fcOpen[${a.id}]=${!open};render()">${(a.kids||[]).length?(open?'▾':'▸'):''}</span><span class="ct-lv">L1</span><span style="${a.status?'':'color:var(--ts)'}">${a.name}</span><span class="ct-cnt">(${a.cnt})</span><button class="btn btn-link btn-sm" style="margin-left:auto" onclick="event.stopPropagation();fcAdd(${a.id})">+ 子类目</button></div>`
        +(open?kids.map(b=>`<div class="ct-row sub ${DB.fcMode==='edit'&&DB.fcSel===b.id?'on':''}" onclick="fcPick(${b.id})"><span class="ct-caret"></span><span class="ct-lv" style="background:var(--ts)">L2</span><span style="${b.status?'':'color:var(--ts)'}">${b.name}</span><span class="ct-cnt">(${b.cnt})</span></div>`).join(''):'');
    }).join('');
  }

  function detail(){
    const ed=DB.fcMode==='edit',r=ed?find(DB.fcSel):{},n=r.n,f=DB.fcForm;
    const parent=ed?r.p:(DB.fcParent?find(DB.fcParent).n:null),leaf=!!parent;
    const radio=(k,opts)=>`<div class="row" style="gap:14px">${opts.map(([v,t])=>`<label class="chip-ck ${f[k]===v?'on':''}"><input type="radio" name="fc-${k}" ${f[k]===v?'checked':''} onchange="fcSet('${k}',${v});render()">${t}</label>`).join('')}</div>`;
    const ro='readonly style="background:#F3F4F6;color:var(--ts)"';
    return `<div class="card" style="margin:0 0 18px"><div class="card-hd"><div class="row" style="gap:10px;align-items:center"><span class="ct-lv" style="font-size:11px;padding:2px 6px;${leaf?'background:var(--ts)':''}">${leaf?'L2':'L1'}</span><h3>${ed?'类目配置':(leaf?'新增子类目':'添加一级类目')}</h3>${ed?(n.status?'<span class="tag t-g"><span class="dot"></span>启用</span>':'<span class="tag t-gr"><span class="dot"></span>停用</span>'):''}</div>
      <div class="row" style="gap:8px">${ed?`<button class="btn btn-o btn-sm" onclick="toast('演示：删除前台类目，关联的圈品规则和指定商品将一并删除','info')">删除</button>`:''}<button class="btn btn-p btn-sm" onclick="fcSave()">保存</button></div></div>
      <div class="card-bd">
        <div class="fg2"><div class="fr"><label class="fl"><b>*</b>类目名称</label><input maxlength="60" value="${f.name}" placeholder="最多 60 字" oninput="fcSet('name',this.value)"></div><div class="fr"><label class="fl">上级类目</label><input value="${parent?parent.name:'（根分类，无上级）'}" ${ro}></div></div>
        <div class="fg2"><div class="fr"><label class="fl">排序</label><input type="number" min="0" max="9999" value="${f.sort}" oninput="fcSet('sort',Math.min(9999,Math.max(0,parseInt(this.value)||0)))"></div><div></div></div>
        <div class="fr"><label class="fl">类目图片</label><div class="up" style="width:120px"><div class="uic">🖼️</div><div class="ut">上传</div><div class="us">建议尺寸 800×800px，支持 JPG/PNG 格式</div></div></div>
        <div class="fg2"><div class="fr"><label class="fl">状态</label>${radio('status',[[1,'启用'],[0,'停用']])}</div>
        ${leaf?`<div class="fr"><label class="fl">是否同品展示</label>${radio('sameShow',[[1,'是'],[0,'否']])}</div>`:'<div></div>'}</div>
      </div></div>
    ${ed&&leaf?`<div class="card" style="margin:0 0 18px"><div class="card-hd"><h3>圈品规则</h3><span class="sub">按后台采购类目动态圈选商品，后台类目支持多选</span><button class="btn btn-o btn-sm" onclick="toast('演示：圈品规则沿用线上，本期不改','info')">添加规则</button></div>
      <div class="card-bd"><div class="ib ib-y"><span class="i">⚠️</span>优先级：指定剔除 > 指定加入 > 圈品规则</div><div class="empty"><div class="e-t">请选择后台采购类目</div></div></div></div>
    <div class="card" style="margin:0"><div class="card-hd"><h3>指定商品</h3><span class="sub">优先级高于圈品规则</span></div><div class="card-bd"><div class="empty"><div class="e-t">暂无数据</div></div></div></div>`:''}`;
  }

  PAGES['p-frontcat']=()=>CAT_CSS+`<div class="ct-wrap">
    <div class="card" style="margin:0"><div class="card-hd"><h3>前台类目树</h3><button class="btn btn-p btn-sm" onclick="fcAdd()">添加一级类目</button></div>
      <div class="card-bd" style="padding:12px 14px"><input placeholder="类目名称" value="${DB.fcKw}" oninput="DB.fcKw=this.value;render();const e=document.querySelector('.ct-wrap input');if(e){e.focus();e.setSelectionRange(e.value.length,e.value.length)}" style="margin-bottom:10px">
      ${tree()||'<div class="empty"><div class="e-t">无匹配类目</div></div>'}</div></div>
    <div>${detail()}</div></div>`;
})();
