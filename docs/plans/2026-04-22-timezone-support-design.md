# 时区支持设计方案

## 问题背景

当前插件的日期处理存在时区不一致问题：

| 环节 | 方式 | 时区 |
|------|------|------|
| 解析任务日期 | `new Date("2024-01-15")` | UTC 午夜 |
| 显示日期 | `.getFullYear()` / `.getMonth()` / `.getDate()` | 本地时间 |
| 判断"今天" | `new Date()` + `setHours(0,0,0,0)` | 本地午夜 |
| 日历生成 | `new Date(year, month-1, day)` | 本地午夜 |

`new Date("YYYY-MM-DD")` 创建 UTC 午夜的 Date 对象，但后续操作都用本地时间方法读取。对于 UTC- 时区用户，`.getDate()` 可能返回前一天的日期，导致任务显示在错误的日期上。

## 设计目标

1. 修复 `new Date("YYYY-MM-DD")` 造成的 UTC/本地时间不一致
2. 在通用设置中添加时区设置（UTC 偏移量下拉）
3. 支持用户选择与系统不同的时区
4. 纯原生实现，不引入外部依赖

## 技术方案

### 时区表示

使用 UTC 偏移量（分钟）表示时区，范围 UTC-12 到 UTC+14：

- UTC+8 (北京) → `480`
- UTC-5 (纽约) → `-300`
- UTC+0 (伦敦) → `0`
- 特殊值 `null` → 跟随系统时区

### 新增文件

#### `src/dateUtils/timezone.ts`

时区工具模块，包含：

- `TIMEZONE_OPTIONS` 常量：UTC 偏移量下拉选项列表
- `getTimezoneOffset()` — 获取用户配置的时区偏移量（未配置则返回系统偏移量）
- `createDate(dateStr)` — 从 "YYYY-MM-DD" 创建本地午夜 Date（修复核心 bug）
- `getToday()` — 按配置时区返回"今天的日期"
- `isToday(date)` — 按配置时区判断
- `toISOStringLocal(date)` — 替代 `date.toISOString()`，输出本地日期字符串

核心逻辑：

```typescript
// 修复：new Date("2024-01-15") → new Date(2024, 0, 15)
function createDate(dateStr: string): Date {
    const [y, m, d] = dateStr.split('-').map(Number);
    return new Date(y, m - 1, d); // 本地午夜，不受 UTC 解析影响
}

// 按配置时区获取"今天"
function getToday(): Date {
    const offset = getTimezoneOffset(); // 用户配置的偏移量（分钟）
    const now = new Date();
    const utcMs = now.getTime() + now.getTimezoneOffset() * 60000;
    const targetMs = utcMs + offset * 60000;
    const target = new Date(targetMs);
    target.setHours(0, 0, 0, 0);
    return target;
}

// 替代 date.toISOString() 用于 DOM dataset
function toISOStringLocal(date: Date): string {
    return formatDate(date, 'yyyy-MM-dd');
}
```

### 修改文件清单

| 文件 | 改动 |
|------|------|
| `src/settings/types.ts` | 添加 `timezoneOffset: number \| null` 字段 |
| `src/settings/constants.ts` | 默认值 `null`（跟随系统） |
| `src/settings/SettingsUIBuilder.ts` | 添加时区下拉设置项 |
| `src/dateUtils/today.ts` | `getTodayDate()` 改为按配置时区计算 |
| `src/dateUtils/dateCompare.ts` | `isToday()` 改为按配置时区判断 |
| `src/tasks/taskParser/step4.ts` | `new Date(match[1])` → `createDate(match[1])` |
| `src/tasks/taskParser/utils.ts` | `parseDate()` / `isValidDateString()` 使用 `createDate()` |
| `src/views/MonthView.ts` | `toISOString()` → `toISOStringLocal()` |
| `src/views/WeekView.ts` | `toISOString()` → `toISOStringLocal()` + `new Date(dateStr)` 修复 |
| `src/GCMainView.ts` | `new Date()` 初始日期改用 `getToday()` |

### 不需要修改的文件

- `calendarGenerator.ts` — 已使用 `new Date(y, m, d)`，无需改动
- `formatDate()` — 已使用本地时间方法，无需改动
- 外部数据源适配器（CalDAV/飞书/Microsoft）— 已有独立时区处理

### 设置 UI 设计

在通用设置组中添加时区下拉：

```
通用设置
├── 时区: [跟随系统 ▼]
│   ├── 跟随系统
│   ├── (UTC-12:00) 贝克岛
│   ├── (UTC-11:00) 萨摩亚、中途岛
│   ├── ...
│   ├── (UTC+8:00) 北京, 新加坡, 香港, 台北
│   ├── (UTC+9:00) 东京, 首尔
│   ├── ...
│   └── (UTC+14:00) 莱恩群岛
```

选项显示格式：`(UTC±H:MM) 代表城市名`

## 验证方案

### 测试矩阵

| 测试场景 | 操作 | 预期结果 |
|----------|------|----------|
| UTC+8 本地 | 默认设置 | 所有功能正常（基线） |
| UTC+8 显式 | 设置选 UTC+8 | 与默认行为一致 |
| UTC-5 (纽约) | 设置选 UTC-5 | "今天"回退约13小时 |
| UTC+0 (伦敦) | 设置选 UTC+0 | "今天"回退8小时 |
| UTC+12 (奥克兰) | 设置选 UTC+12 | "今天"前进4小时 |

### 具体验证步骤

#### 1. "今天"高亮验证

时间点：北京时间 XX 日晚上 21:00 之后测试
- 设置 UTC+8 → 日历高亮 XX 日
- 设置 UTC-5 → 日历高亮 XX 日（纽约是同日上午）
- 设置 UTC+0 → 日历高亮 XX-1 日（伦敦已是前一日）

#### 2. 任务日期解析验证

创建测试任务：`- [ ] 测试任务 📅 2026-04-23`
- 切换不同时区，任务始终出现在 4月23日（验证 createDate 修复）

#### 3. 跨日边界验证

在北京时间 22:00+ 切换时区：
- 切换到 UTC-5 → "今天"可能变为前一天
- 切换到 UTC+12 → "今天"可能变为后一天

#### 4. 甘特图验证

创建跨日任务，切换时区验证甘特条长度和位置不变（因为日期粒度不变）。

#### 5. 周/月视图验证

在月末/月初测试：切换时区后，周视图和月视图的任务归属应正确调整。
