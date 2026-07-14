# 组件配方（HTML 结构 + 类名）

配合 `design-system.css`。这些是原型里复用的组件骨架，实现时按框架（React/Vue/原生）转写，**类名与结构保持一致**。

## 页面骨架
```html
<div class="app">
  <aside class="sidebar"><!-- 品牌 → 店铺卡 → 分组导航 → 底部切换 --></aside>
  <div class="main">
    <header class="topbar">
      <div><div class="tb-crumb">商家端 / 商品管理</div><div class="tb-title">商品管理</div></div>
      <div style="flex:1"></div>
      <div class="pill-warn">…4 单待发货</div>
      <div class="avatar">陈</div>
    </header>
    <div class="content"><!-- 页面正文 --></div>
  </div>
</div>
<!-- 详情：右侧抽屉 -->
<div class="backdrop"></div>
<aside class="drawer"><div class="dw-hd">…</div><div class="dw-bd">…</div><div class="dw-ft">…</div></aside>
```

## 侧栏导航项
```html
<div class="nav-sec">经营</div>
<div class="nav-i active">
  <span class="nav-ic"><svg …>…</svg></span>商品管理
  <span class="nav-p1">一期</span>
</div>
<div class="nav-i">
  <span class="nav-ic"><svg …>…</svg></span>订单管理
  <span class="nav-badge">4</span>            <!-- .y 金 / .g 绿 -->
</div>
```
> 图标 SVG 见 `icons.md`。激活项自带左强调条（CSS `.nav-i.active::before`）。

## 筛选卡
```html
<div class="card"><div class="card-bd">
  <div style="display:grid;grid-template-columns:repeat(4,1fr) auto;gap:16px;align-items:end">
    <div><label class="fl">品类</label><select>…</select></div>
    <div><label class="fl">商品名称 / 编码</label><input placeholder="输入名称或 SPU 编码"></div>
    …
    <div style="display:flex;gap:9px">
      <button class="btn btn-p">查询</button>
      <button class="btn btn-o">重置</button>
    </div>
  </div>
</div></div>
```

## 数据表卡（Tab + 工具条 + 表格）
```html
<div class="card">
  <div class="card-hd" style="border-bottom:1px solid var(--bd2)">
    <div class="tabs" style="border:none">
      <div class="tab active">销售中<span class="c">8</span></div>
      <div class="tab">未上架<span class="c">2</span></div>
    </div>
    <div style="display:flex;gap:9px">
      <button class="btn btn-o btn-sm">导入改价/库存</button>
      <button class="btn btn-o btn-sm">批量导入</button>
      <button class="btn btn-p btn-sm">＋ 新建商品</button>
    </div>
  </div>
  <div class="card-bd flush"><div style="overflow-x:auto"><table>
    <thead><tr><th>商品编码</th><th>商品名称</th><th>品类</th><th>未税价(SGD)</th><th>税率</th><th>含税价(SGD)</th><th>可售库存</th><th>SKU 状态</th><th>创建时间</th><th>更新时间</th><th>操作</th></tr></thead>
    <tbody>
      <tr>
        <td><span class="mono">SKU8815</span></td>
        <td><span class="pname">小棠菜 1kg/袋</span></td>
        <td><span class="tag t-gr">新鲜蔬菜</span></td>
        <td><span class="price"><span class="cur">S$</span>9.30</span></td>
        <td style="color:var(--ts)">9%</td>
        <td><span class="price"><span class="cur">S$</span>10.14</span></td>
        <td style="white-space:nowrap"><span class="stock">220</span><span class="mode daily">每日恢复</span></td>
        <td><span class="tag t-g"><span class="dot"></span>可售</span></td>
        <td><span class="tstamp">2026-06-20 09:12</span></td>
        <td><span class="tstamp">2026-07-01 14:30</span></td>
        <td style="white-space:nowrap"><button class="btn-o btn-sm">下架</button> <button class="btn-link">编辑</button> <button class="btn-link">详情</button></td>
      </tr>
    </tbody>
  </table></div></div>
</div>
```
状态胶囊：可售 `t-g` / 售罄 `t-r`（库存0） / 平台审核中·随商品 `t-gr`。库存 0 时数字加 `.zero`。

## 详情抽屉（分区 + 定义列表 + 只读）
```html
<aside class="drawer show">
  <div class="dw-hd">
    <div style="display:flex;justify-content:space-between">
      <div><span style="font-size:21px;font-weight:700">芥蓝</span> <span class="mono">SPU8813</span></div>
      <div class="dw-x">✕</div>
    </div>
    <div style="margin-top:12px"><span class="tag t-g"><span class="dot"></span>在售</span> <span class="tag t-gr">新鲜蔬菜</span></div>
  </div>
  <div class="dw-bd">
    <div class="sec-t">商品信息</div>
    <div class="dl">
      <div class="row"><span class="k">商品名称</span><span class="v">芥蓝</span></div>
      <div class="row"><span class="k">商品编码 (SPU)</span><span class="v">SPU8813</span></div>
      …
    </div>
    <div class="sec-t" style="margin-top:22px">售卖规格 (SKU) · 共 2 个</div>
    <!-- 每个 SKU 一张 sku 卡：未税价/含税价/可售库存+模式/状态 -->
  </div>
  <div class="dw-ft"><button class="btn btn-o">关闭</button><button class="btn btn-p">编辑商品</button></div>
</aside>
```
> 只读页（平台代开发票、客诉工单等）：抽屉底部只留「关闭」，不给编辑/处理按钮。

## 金额 / 数字格式
```js
const money = v => 'S$' + Number(v).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2}); // S$9,820.00
```
- 价格 = `S$` 前缀(次级色 `.cur`) + 两位小数千分位；含税价用次级色；数字元素加等宽 `tnum`。
- 脱敏：`海底捞（新加坡）`→`海****`；电话 `+65 97776221`→`+65 9****21`；编号保留首尾。

## 状态 / 库存模式 枚举速查（照原型，勿改）
| 域 | 枚举 → 类 |
|---|---|
| SKU 状态 | 可售 `t-g` · 售罄 `t-r` · 平台审核中/随商品 `t-gr` |
| 库存模式 | 每日恢复 `mode daily` · 售完即止 `mode once` |
| 售后处理状态 | 待处理 `t-y` · 处理中 `t-b` · 已完成 `t-g` |
| 发票状态 | 待平台开票 `t-y` · 已开票 `t-g` |
| 订单状态 | 待发货 `t-b` · 备货中 `t-y` · 已收货 `t-g` · 已完成 `t-gr` · 已取消 `t-r` |

> 具体页面的完整字段/列/交互，以原型对应页为准（见 SKILL.md「真值来源」）。
