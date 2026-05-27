# lh-test

版本、分类、明细三级数据维护系统。用户先选择版本，再在树形分类下维护明细清单；支持增删改、同级排序、废弃/启用及级联规则。

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | Vue 3.5、TypeScript、Vite、Pinia、Vue Router、Element Plus、Vxe-Table |
| 后端 | NestJS、Fastify、Prisma、class-validator、Swagger |
| 数据库 | SQLite |

## 项目结构

```
lh-test/
├── backend/                 # NestJS 后端
│   ├── prisma/schema.prisma # 数据模型
│   └── src/
│       ├── common/          # 全局异常过滤器、响应拦截器
│       ├── modules/
│       │   ├── version/     # 版本模块
│       │   ├── types/       # 分类模块
│       │   └── details/     # 明细模块
│       └── prisma/          # Prisma 服务
├── frontend/                # Vue 前端
│   └── src/
│       ├── api/             # 接口封装
│       ├── stores/          # Pinia 状态（版本选中、分类选中）
│       ├── views/
│       │   ├── version/     # 版本下拉与维护弹窗
│       │   ├── types/       # 分类树表
│       │   ├── details/     # 明细表
│       │   └── home-view.vue# 主页面布局
│       └── router/
└── package.json             # 根脚本（同时启动前后端）
```

## 业务模型

### 数据关系

```
Version（版本）
  └── Types（分类，树形，versionId 逻辑外键）
        └── Details（明细，typeId 逻辑外键）
```

- 外键均为**逻辑外键**，由应用层校验，未在数据库层建立 Prisma 关系约束。
- 删除分类时：级联删除其全部下级分类，并级联删除关联明细。
- 删除版本时：仅删除版本记录本身（不自动清理分类/明细，需业务侧注意）。

### 表字段说明

**Version（版本）**

| 字段 | 说明 |
|------|------|
| id | 流水号字符串，从 1 递增 |
| name | 名称，全局唯一 |
| status | 0 未启用，1 启用 |

**Types（分类）**

| 字段 | 说明 |
|------|------|
| id | 流水号字符串，从 10000 递增 |
| versionId | 所属版本 |
| parentId | 父级 id，空为顶级 |
| code / name / note | 编码、名称、备注 |
| index | 同级排序序号 |
| status | 0 废弃，1 启用 |
| restoreIndex | 废弃前同级位置，启用时恢复 |

**Details（明细）**

| 字段 | 说明 |
|------|------|
| id | 流水号字符串，从 20000 递增 |
| typeId | 所属末级分类 |
| code | 编码（同分类内唯一） |
| projectName | 项目名称 |
| workContent / contractor / calcRule / unit | 工作内容、乙方承包商、计算规则、计量单位 |
| index / status / restoreIndex | 同分类排序、状态、废弃前位置 |

### 状态与排序规则

**废弃（status → 0）**

- 分类：级联废弃全部子分类；保存 `restoreIndex`，并将该行移到同级末尾。
- 明细：保存 `restoreIndex`，移到同分类末尾。
- 废弃行在前端以灰色文字展示。

**启用（status → 1）**

- 分类：级联启用全部子分类；按 `restoreIndex` 恢复到废弃前同级位置。
- 明细：按 `restoreIndex` 恢复位置。

**上移 / 下移**

- 仅在前端交换同级相邻行的 `index`，通过 API 批量更新排序。
- 同级首行隐藏「上移」，末行隐藏「下移」。

**编码唯一性**

- 分类编码：同一版本内唯一。
- 明细编码：同一分类内唯一。

## 页面与交互

主页面（`/`）为左右布局：

| 区域 | 模块 | 功能 |
|------|------|------|
| 左上 | 版本 | 下拉选择当前版本；「维护版本」弹窗增删改版本 |
| 左下 | 分类 | 树形表格，按当前版本加载 |
| 右侧 | 明细 | 扁平原表，按左侧选中分类加载 |

### 版本

- 初始化时自动选中**第一个启用版本**；若无启用版本则选列表第一项。
- 维护弹窗关闭后，若当前选中版本已不存在，重新执行默认选中逻辑。

### 分类

- 表格首行固定为「全部」虚拟行（仅前端展示，不参与保存）。
- 双击行进入行编辑模式；编辑结束自动保存。
- 工具栏：**新增分类**、**新增下级分类**（需先选中非「全部」行）。
- 右键菜单：删除、上移、下移、废弃、启用。
- 删除分类会级联删除子分类及关联明细。
- 选中分类后同步到 Pinia（`selectedTypeId`、`selectedTypeIsLeaf`），供明细模块使用。

**必填字段**：编码、名称。

### 明细

- 仅当选中**末级分类**时可「新增明细」。
- 双击行编辑；失焦后自动保存。
- 工具栏搜索框：对编码、项目名称做前端模糊过滤（不请求后端）。
- 右键菜单：删除、上移、下移、废弃、启用。

**必填字段**：编码、项目名称、计量单位（前后端均有校验）。

### 表格 UI

- 可编辑列表头仅显示文字标题（`editConfig.showIcon: false`）。
- 行编辑状态指示仍保留（`showStatus: true`）。

## API 说明

- 基础路径：`/api`
- 统一响应：`{ code: 0, data, msg }`（`code !== 0` 时前端拦截器提示错误）
- 请求体统一包裹在 `data` 字段中，例如：

```json
{
  "data": {
    "name": "V1.0",
    "status": 1
  }
}
```

- Swagger 文档：启动后端后访问 [http://localhost:3000/api-docs](http://localhost:3000/api-docs)

| 方法 | 路径 | 说明 |
|------|------|------|
| GET/POST | `/api/version` | 版本列表 / 新增 |
| PUT/DELETE | `/api/version/:id` | 更新 / 删除版本 |
| GET | `/api/types?versionId=` | 按版本查询分类 |
| POST | `/api/types` | 新增分类 |
| PUT | `/api/types/:id` | 更新分类（含 status 触发废弃/启用） |
| DELETE | `/api/types/:id` | 删除分类（级联） |
| GET | `/api/details?typeId=` | 按分类查询明细 |
| POST | `/api/details` | 新增明细 |
| PUT | `/api/details/:id` | 更新明细（含 status 触发废弃/启用） |
| DELETE | `/api/details/:id` | 删除明细 |

## 快速开始

### 环境要求

- Node.js 18+
- npm

### 安装

```bash
npm run install:all
```

根目录 `postinstall` 会自动执行 `prisma generate`。

### 配置

复制后端环境变量并按需修改：

```bash
cp backend/.env.example backend/.env
```

默认配置：

```env
DATABASE_URL="file:./dev.db"
PORT=3000
```

### 启动开发环境

```bash
npm run dev
```

- 前端：[http://localhost:5173](http://localhost:5173)
- 后端：[http://localhost:3000](http://localhost:3000)
- 前端通过 Vite 代理将 `/api` 转发到后端

### 构建

```bash
npm run build
```

### 单独启动

```bash
# 后端
npm run dev --prefix backend

# 前端
npm run dev --prefix frontend
```

## 开发说明

### 后端

- 使用 `@nestjs/platform-fastify` 作为 HTTP 驱动。
- 全局 `ValidationPipe` 开启白名单与 DTO 校验。
- `HttpExceptionFilter` + `ResponseInterceptor` 统一错误与成功响应格式。
- 服务启动时会检查 SQLite 表结构，缺失表/字段会自动补建（兼容旧库）。

### 前端

- Element Plus、Vxe-Table 通过 `unplugin-auto-import` / `unplugin-vue-components` 自动导入。
- 跨模块状态：`useVersionStore`（当前版本）、`useTypesStore`（当前分类及是否末级）。
- Axios 封装见 `frontend/src/api/request.ts`，超时 15s，失败时 Element Plus 消息提示。

### 注意事项

- Windows 下若 `prisma generate` 报 EPERM，可关闭占用进程后重试，或重启后端服务。
- 废弃/启用等批量更新使用 Prisma `$transaction([...operations])`，避免交互式事务内嵌套查询导致 SQLite 锁等待。

## 许可证

Private
