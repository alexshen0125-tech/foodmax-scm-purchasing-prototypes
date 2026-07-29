# 侧栏 / 操作 线性 SVG 图标集

**禁止用 emoji 当图标。** 侧栏、操作按钮统一用下面的线性 SVG（`viewBox="0 0 24 24"`，`fill:none`，`stroke:currentColor`，`stroke-width:1.7`，圆角端点）。`stroke:currentColor` 让图标跟随文字/激活色。

## 用法
```html
<span class="nav-ic"><svg viewBox="0 0 24 24" fill="none">{{path}}</svg></span>
```
```css
.nav-ic svg{width:18px;height:18px;stroke:currentColor;fill:none;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round}
```

## 图标表（模块 → path 内容）
| 模块 | key | path（填入 `<svg>` 内） |
|---|---|---|
| 工作台 | home | `<path d="M4 11l8-6 8 6v8a1 1 0 0 1-1 1h-4v-6h-6v6H5a1 1 0 0 1-1-1v-8Z"/>` |
| 店铺信息 | store | `<path d="M5 9h14l-1-4H6L5 9Zm0 0v9a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9M9 13h6"/>` |
| 商品管理 | box | `<path d="M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3Z"/><path d="M4 7.5l8 4.5 8-4.5M12 21v-9"/>` |
| 订单管理 | clipboard | `<path d="M7 4h10l1 3v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V7l1-3Z"/><path d="M9.5 12h5M9.5 15.5h5"/>` |
| 备货管理 / 退货单 | package | `<path d="M4 8l8-4 8 4v8l-8 4-8-4V8Z"/><path d="M4 8l8 4 8-4M12 20v-8"/>` |
| 送货管理 | truck | `<path d="M3 7h11v9H3zM14 10h4l3 3v3h-7z"/><circle cx="7" cy="17.5" r="1.6"/><circle cx="17" cy="17.5" r="1.6"/>` |
| 商机推荐 | bulb | `<path d="M12 4a6 6 0 0 1 3 11v2H9v-2a6 6 0 0 1 3-11ZM9.5 20h5"/>` |
| 价格分析 / 打印标签 | tag | `<path d="M4 13l7-7 8 8-7 7-8-8Z"/><circle cx="8.5" cy="9.5" r="1.2"/>` |
| 经营分析 | chart-line | `<path d="M4 20V6M4 20h16M8 16l4-5 3 3 4-6"/>` |
| 对账结算 | wallet | `<path d="M4 8h16v10a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V8Zm0 0l3-3h10l3 3M15 13h2"/>` |
| 发票管理 | receipt | `<path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3Z"/><path d="M9 8h6M9 12h6"/>` |
| 售后管理 / 售后订单 | refund | `<path d="M9 5H5v14M15 19h4V5M9 5l6 14"/><path d="M8 9l-2 2 2 2"/>` |
| 质检管理 | flask | `<path d="M9 3h4v7a4 4 0 1 1-4 0V3ZM7 21h12"/>` |
| 违规整改 | alert | `<path d="M12 4l9 16H3L12 4Z"/><path d="M12 10v4M12 17h.01"/>` |
| 闭店申请 | door | `<path d="M6 3h9v18H6zM12 12h.01M15 8l4 4-4 4"/>` |
| 售后工单 | ticket | `<path d="M5 17h14a7 7 0 0 0-14 0ZM12 6V4M4 20h16"/>` |
| 备货参考 | bar-chart | `<path d="M4 20V4M4 20h16M8 20v-6M12 20v-10M16 20v-4"/>` |
| 搜索 | search | `<circle cx="11" cy="11" r="6"/><path d="M15.5 15.5L20 20"/>` |
| 通知 | bell | `<path d="M6 9a6 6 0 0 1 12 0c0 6 2 7 2 7H4s2-1 2-7Z"/><path d="M10 20a2 2 0 0 0 4 0"/>` |
| 导入/下载 | download | `<path d="M12 4v10M8 10l4 4 4-4M5 18h14"/>` |
| 新建/添加 | plus | `<path d="M12 5v14M5 12h14"/>` |
| 面包屑分隔 | chevron | `<path d="M9 6l6 6-6 6"/>` |
| 店铺运营平台(角色) | shield | `<path d="M12 3l7 3v6c0 5-3 7-7 9-4-2-7-4-7-9V6l7-3Z"/>` |
| 采购SCM(角色) | factory | `<path d="M4 20V10l5 3V10l5 3V6l6 3v11H4Z"/>` |

## JS 映射（emoji→SVG，可直接用于原型式渲染）
```js
const ICON = {
  '🏠':'<path d="M4 11l8-6 8 6v8a1 1 0 0 1-1 1h-4v-6h-6v6H5a1 1 0 0 1-1-1v-8Z"/>',
  '🏪':'<path d="M5 9h14l-1-4H6L5 9Zm0 0v9a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9M9 13h6"/>',
  '🥦':'<path d="M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3Z"/><path d="M4 7.5l8 4.5 8-4.5M12 21v-9"/>',
  '📋':'<path d="M7 4h10l1 3v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V7l1-3Z"/><path d="M9.5 12h5M9.5 15.5h5"/>',
  '📦':'<path d="M4 8l8-4 8 4v8l-8 4-8-4V8Z"/><path d="M4 8l8 4 8-4M12 20v-8"/>',
  '🚚':'<path d="M3 7h11v9H3zM14 10h4l3 3v3h-7z"/><circle cx="7" cy="17.5" r="1.6"/><circle cx="17" cy="17.5" r="1.6"/>',
  '💡':'<path d="M12 4a6 6 0 0 1 3 11v2H9v-2a6 6 0 0 1 3-11ZM9.5 20h5"/>',
  '🏷️':'<path d="M4 13l7-7 8 8-7 7-8-8Z"/><circle cx="8.5" cy="9.5" r="1.2"/>',
  '📈':'<path d="M4 20V6M4 20h16M8 16l4-5 3 3 4-6"/>',
  '💰':'<path d="M4 8h16v10a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V8Zm0 0l3-3h10l3 3M15 13h2"/>',
  '🧾':'<path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3Z"/><path d="M9 8h6M9 12h6"/>',
  '↩️':'<path d="M9 5H5v14M15 19h4V5M9 5l6 14"/><path d="M8 9l-2 2 2 2"/>',
  '🔬':'<path d="M9 3h4v7a4 4 0 1 1-4 0V3ZM7 21h12"/>',
  '⚠️':'<path d="M12 4l9 16H3L12 4Z"/><path d="M12 10v4M12 17h.01"/>',
  '🚪':'<path d="M6 3h9v18H6zM12 12h.01M15 8l4 4-4 4"/>',
  '🛎️':'<path d="M5 17h14a7 7 0 0 0-14 0ZM12 6V4M4 20h16"/>',
  '📊':'<path d="M4 20V4M4 20h16M8 20v-6M12 20v-10M16 20v-4"/>',
  '🛡️':'<path d="M12 3l7 3v6c0 5-3 7-7 9-4-2-7-4-7-9V6l7-3Z"/>',
  '🏭':'<path d="M4 20V10l5 3V10l5 3V6l6 3v11H4Z"/>',
};
const icon = e => ICON[e] ? `<svg viewBox="0 0 24 24" fill="none">${ICON[e]}</svg>` : (e||'');
```

> 需要新图标时，保持同一风格：24 viewBox、stroke-only、1.7 粗、圆角端点、几何简洁。
