---
name: foodmax-frontend
description: Use when implementing or coding front-end pages for the Food Max 商家后台 / merchant-management system that must faithfully reproduce ("还原") the interactive prototype. Provides the exact design system — MiSans typography, refined-green design tokens, SVG line-icon sidebar nav, and table/card/tag/tab/button/input/drawer component recipes plus fidelity rules — so generated front-end code matches the prototype 1:1. Trigger on "按原型还原 / 还原原型 / 照原型开发", "Food Max 商家端(后台)前端", or when building any page that already exists in the merchant prototype (工作台/商品管理/订单/备货/送货/售后/对账结算/发票/质检…).
---

# Food Max 商家后台 · 前端还原规范

开发商家后台前端页面时，**必须按此规范还原原型**，不得自创样式。本 skill 固化了原型的设计系统（配色 token、MiSans 字体、SVG 图标、组件配方、布局结构），照此生成的前端代码与原型 1:1 一致。

## 真值来源（source of truth）
- 交互原型（唯一真值，字段/枚举/交互以它为准）：
  - 本地：`prd-management/采购/merchant management/prototype design/scm_商家管理系统_全流程_交互原型.html`
  - 线上预览：https://alexshen0125-tech.github.io/foodmax-scm-purchasing-prototypes/merchant-management/scm_商家管理系统_全流程_交互原型.html
- **实现某页前，先在原型对应页确认：字段、列、状态枚举、库存模式、操作按钮、抽屉结构、交互流程。样式照本 skill，内容照原型。**

## 怎么用（工作流）
1. **接入设计系统**：把 `references/design-system.css` 落到项目（或转成项目的 token / Tailwind theme / styled 变量）。所有页面共用这一套 token 与组件类。
2. **字体**：加载 MiSans（见下）。这是"高级感"的关键，勿用系统默认或 Inter。
3. **对照原型建页**：在原型找到对应页 → 抄字段/列/状态/操作 → 用本 skill 的组件类拼装（见 `references/components.md`）。
4. **图标**：侧栏/操作用线性 SVG（见 `references/icons.md`），**禁止用 emoji 当图标**。
5. **自检**：对照原型截图逐项核对（列顺序、状态色、库存模式胶囊、金额格式、抽屉分区）。

## 硬性规则（must）
1. **字体 = MiSans**（免费商用）。CJK+拉丁+数字统一 MiSans；数字用等宽 `font-feature-settings:"tnum" 1,"lnum" 1`。
2. **配色只用 token**（`references/design-system.css` 的 `:root`），不写死颜色。主色精致 emerald `--g:#0E7A52`，纸感底 `--bg:#F3F6F0`，金色点缀 `--gold`。
3. **标题层级**：只有标题「加粗加大」，正文/次要数据保持常规——`非必要不加粗加大`。页面标题 `700–800` 大字号；表格里商品名 `600`、价格/库存数字常规字重次级色。
4. **图标 = 线性 SVG**（stroke，1.7px，`stroke:currentColor` 跟随激活色），不用 emoji。
5. **侧栏激活态**：绿药丸 `--gl` + 绿图标 + 左侧 3px 强调条 `--g`。
6. **表格**：表头浅底(`--bd2`)+字距，行 14px padding，hover 绿染 `#F1F8F1`；数字等宽右不右对齐按原型。
7. **金额**：`S$` 前缀 + 两位小数千分位（如 `S$9,820.00`），未税/含税并列，含税价用次级色。
8. **库存模式**：`每日恢复`=绿胶囊、`售完即止`=金/琥珀胶囊，与库存数字**同行不换行**。
9. **详情用右侧抽屉**（drawer），不用居中弹窗；抽屉分区用小节标题（基础信息/客诉信息/处理信息…）。
10. **数据保真**：字段名、状态枚举、库存模式、金额口径、脱敏规则一律照原型，不自造。

## 字体加载（MiSans · 免费商用）
原型用 jsDelivr 切片版（`unicode-range` 懒加载，任一字重加载即全站 MiSans，无混字）。**落生产请自托管** MiSans 字体文件（不要长期依赖 CDN）。
```html
<link rel="stylesheet" crossorigin="anonymous" href="https://cdn.jsdelivr.net/npm/misans@4.1.0/lib/Normal/MiSans-Regular.min.css">
<link rel="stylesheet" crossorigin="anonymous" href="https://cdn.jsdelivr.net/npm/misans@4.1.0/lib/Normal/MiSans-Medium.min.css">
<link rel="stylesheet" crossorigin="anonymous" href="https://cdn.jsdelivr.net/npm/misans@4.1.0/lib/Normal/MiSans-Semibold.min.css">
<link rel="stylesheet" crossorigin="anonymous" href="https://cdn.jsdelivr.net/npm/misans@4.1.0/lib/Normal/MiSans-Bold.min.css">
```
> MiSans 授权：免费商用，需注明使用了 MiSans，不得修改/单独再分发字体文件；用你的产品做出来的作品不受限。备选：HarmonyOS Sans SC（华为，同样免费商用）。

## 布局结构（骨架）
```
.app  (grid: [sidebar 236px] [main 1fr])
 ├─ aside.sidebar   固定 236px：品牌 → 店铺卡 → 分组导航(经营/增长/财务/合规) → 底部切换
 └─ div.main
     ├─ header.topbar  面包屑 + 页面标题 · 右侧：待发货金色胶囊 + 通知 + 头像
     └─ div.content    页面正文（筛选卡 / Tab+工具条 / 数据表 / 卡片…）
 + 右侧 drawer（详情，覆盖层 + backdrop）
```

## 设计 token 速览（完整见 references/design-system.css）
| 用途 | token | 值 |
|---|---|---|
| 主色 emerald | `--g` | `#0E7A52` |
| 主色渐变(按钮) | `--gg` | `linear-gradient(150deg,#12885B,#0A5A3C)` |
| 绿浅底/激活 | `--gl` | `#E7F2E9` |
| 纸感页底 | `--bg` | `#F3F6F0` |
| 金色点缀 | `--gold`/`--goldl` | `#A9812F` / `#F6EEDC` |
| 文字主/次/弱 | `--tp`/`--ts`/`--tt` | `#12271D`/`#5F7168`/`#9AA99F` |
| 描边/浅描边 | `--bd`/`--bd2` | `#E3EADF`/`#EDF1E9` |
| 危险/警示/信息 | `--r`/`--y`/`--b` | `#C0453B`/`#A9711F`/`#2563EB` |

## 组件与图标
- 组件配方（HTML 结构 + 类名 + 用法）：见 `references/components.md`
- SVG 图标集（emoji→SVG 映射，侧栏/操作用）：见 `references/icons.md`

## 交互规范（沿用原型）
- 核心操作 ≤ 3 步；能预填不让填、能联动不手动、系统能算的不让用户算。
- 详情 = 右侧抽屉；筛选 = 顶部筛选卡（标签在上、输入在下、查询绿实心/重置幽灵）。
- 只读页面（如平台代开的发票、客诉工单）不给编辑/处理入口，只给预览/下载/查看。
- 客户信息脱敏：门店名/编号/电话保留首尾（如 `海****`、`+65 9****21`）。
