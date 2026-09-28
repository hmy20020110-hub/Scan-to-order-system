# 桌边 / ORDER：扫码点餐系统

面向餐饮门店的扫码点餐系统。顾客通过桌台二维码打开菜单、选择菜品和规格、提交订单；商家在后台维护门店、菜品、图片、桌台二维码、订单状态、支付状态和销售数据。

> **真实数据原则**：系统不会自动创建演示门店、分类、菜品、桌台或订单。所有菜单、订单和销售图表均来自数据库中的门店业务数据。

## 功能概览

- 顾客端：桌台二维码菜单、分类浏览、购物车、规格选择、订单确认和到店支付流程。
- 商家端：数字登录码、登录失败锁定、门店设置、菜品图片上传、规格组和价格加价、桌台二维码、订单处理。
- 支付：到店支付和商家配置后的微信支付状态模型；运行时不启用任何模拟支付，回调包含订单金额校验、时效校验、重复回调幂等处理和支付流水审计。
- 销售分析：7/30/90 天销售额趋势、订单量、客单价、已支付销售额、支付方式分布和热销菜品；页面每 30 秒刷新。
- 安全：Manus OAuth 用户体系、管理员权限过程、商家登录码哈希、5 次失败锁定 15 分钟、服务端价格重新计算和支付金额校验。

## 技术栈

| 层 | 技术 |
| --- | --- |
| 顾客端 / 商家端 | React 19、Vite、Tailwind CSS 4、shadcn/ui、Recharts |
| API | tRPC 11、Express 5、Zod |
| 数据库 | MySQL / TiDB、Drizzle ORM、迁移 SQL |
| 文件 | Manus Storage / S3-compatible storage；Windows 线下版支持本地目录 |
| 认证 | Manus OAuth + 商家数字登录码会话 |
| 测试 | Vitest、TypeScript check、Vite production build |

## 项目结构

```text
client/
  src/pages/Home.tsx             顾客入口首页
  src/pages/CustomerMenu.tsx     顾客菜单、购物车和结算
  src/pages/AdminDashboard.tsx   商家后台壳层、导航和订单/菜单管理
  src/pages/SalesAnalytics.tsx   销售数据统计和 Recharts 图表
  src/components/ui/             可复用 UI 组件
server/
  routers.ts                     tRPC API 合约和权限入口
  db.ts                          Drizzle 查询、事务和销售聚合
  order-utils.ts                 菜品、规格和订单金额校验
  payment-callbacks.ts           支付回调签名、时效和输入校验
  payment-config.ts              微信支付密钥 AES-256-GCM 加密
  storage.ts                     图片对象存储封装
  *_test.ts                      服务端单元测试
server/_core/
  trpc.ts                        public / protected / admin 权限过程
drizzle/
  schema.ts                      MySQL 表结构
  *.sql                          按顺序执行的迁移文件
docs/
  DEPLOYMENT.md                  部署和上线检查清单
  PAYMENT-CALLBACKS.md           支付回调测试契约和联调说明
  WINDOWS-EXE.md                 Windows EXE、本地数据库和文件目录方案
  SECURITY-AUDIT.md              安全审计、修复和真实流程验收记录
  github-research.md             开源方案调研记录
shared/                           前后端共享常量和校验
```

## 本地开发

### 前置条件

- Node.js 20+，推荐 Node.js 22
- pnpm 10+
- MySQL 8 / TiDB，数据库字符集建议 `utf8mb4`
- 对象存储配置，用于菜品图片上传

### 安装与配置

```bash
pnpm install
# 在部署目录创建 .env，并按下表填写门店自己的配置
```

主要环境变量：

| 变量 | 必填 | 说明 |
| --- | --- | --- |
| `DATABASE_URL` | 是 | MySQL/TiDB 连接串 |
| `JWT_SECRET` | 是 | 会话签名密钥，生产环境使用随机高强度值 |
| `VITE_APP_ID` | 是 | Manus OAuth 应用 ID |
| `OAUTH_SERVER_URL` | 是 | OAuth 服务地址 |
| `OWNER_OPEN_ID` | 是 | 门店管理员对应的 Manus openId |
| `MERCHANT_LOGIN_CODE` | 首次登录 | 初始 8 位数字登录码，首次成功登录后会写入哈希 |
| `WECHAT_PAYMENT_CALLBACK_SECRET` | 微信支付上线时 | 微信适配器回调签名密钥；不要提交到 Git |
| `BUILT_IN_FORGE_API_URL` | 使用平台存储时 | Manus 内置 API 地址 |
| `BUILT_IN_FORGE_API_KEY` | 使用平台存储时 | 服务端存储 API 密钥 |
| `LOCAL_STORAGE_DIR` | Windows 线下版 | 本地图片目录；配置后不再调用平台对象存储 |

### 数据库迁移

```bash
# 生成迁移文件（修改 drizzle/schema.ts 后执行）
pnpm drizzle-kit generate

# 执行已有迁移
pnpm drizzle-kit migrate

# 本项目快捷脚本：生成并执行迁移
pnpm db:push
```

迁移前请备份生产数据库。当前支付回调改造新增 `paymentTransactions` 表，用于保存 provider、交易号、金额、状态和原始回调摘要，并通过 `(provider, transactionId)` 唯一索引保证幂等。

### 启动与验证

```bash
pnpm dev

# 类型检查
pnpm check

# 单元测试
pnpm test

# 生产构建
pnpm build
pnpm start
```

### Windows EXE

Windows 线下版采用本机 MariaDB/MySQL 8 保存业务数据，EXE 打包 Node 服务和前端资源，图片写入 `LOCAL_STORAGE_DIR`。执行 `pnpm package:win` 生成 `packaging/windows/ScanToOrder/`，完整安装和备份要求见 [`docs/WINDOWS-EXE.md`](docs/WINDOWS-EXE.md)。

## 支付回调设计

系统把支付回调拆成三层：

1. **验证层**：Zod 校验订单号、交易号、金额、状态、时间戳和 nonce；使用 HMAC-SHA256 测试契约校验 provider、金额和签名；回调时间窗口默认 5 分钟。
2. **业务层**：按订单号查找订单，严格比较回调金额与订单总额；成功更新为 `paid`，退款更新为 `refunded`，失败保留未支付状态。
3. **幂等层**：`paymentTransactions` 使用 provider + transactionId 唯一索引。相同回调重复到达时返回 `duplicate`，不会重复修改订单；同交易号但订单或金额不一致会拒绝。

支付平台推荐调用的 REST 回调入口：

```text
POST /api/payment-callbacks/wechat
Header: x-payment-signature: <64-character-hex-signature>
Body: <统一 payload JSON>
```

内部也提供等价的 tRPC mutation：

```text
POST /api/trpc/payment.callback
```

输入包含 `provider=wechat`、`signature` 和 `payload`。完整 payload 示例、商家配置方式和 Vitest 测试说明见 [`docs/PAYMENT-CALLBACKS.md`](docs/PAYMENT-CALLBACKS.md)。

> 当前代码提供微信支付适配器的**回调契约和测试逻辑**，不是直接替代微信支付官方 API v3 的 RSA 签名验证与 AES-GCM 解密。正式接入微信支付商户号前，应在适配器层接入官方 SDK/证书、通知解密、平台证书轮换和 HTTPS 回调地址，不应把本地 HMAC 测试密钥直接用于生产。

## 销售数据分析

商家后台的“销售数据”页面调用受管理员保护的 `admin.salesAnalytics` 查询，支持 `days=7/30/90`。统计规则如下：

- 只统计当前管理员门店的数据。
- 排除 `cancelled` 订单。
- 销售额使用订单总额；热销菜品使用订单明细中的价格快照，避免菜单改价后历史数据漂移。
- 已支付销售额只统计 `paymentStatus=paid`。
- 无订单时显示真实空状态，不填充随机或演示数据。

## 部署概要

生产部署需要先准备 MySQL/TiDB、对象存储、OAuth 应用和 HTTPS 域名，然后执行迁移、构建和启动：

```bash
pnpm install --frozen-lockfile
pnpm drizzle-kit migrate
pnpm build
NODE_ENV=production pnpm start
```

完整环境变量、反向代理、回调安全和上线检查见 [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md)。

## 测试范围

当前测试覆盖：

- 管理员登出会话清理。
- 商家登录码格式、哈希和错误锁定输入。
- 桌台名称和桌台码校验。
- 菜品可用性、规格必选、规格加价和订单金额快照。
- 到店支付和微信支付 API 参数契约。
- 微信支付回调签名、篡改、过期、错误 provider 和重复回调规则。

提交前建议执行：

```bash
pnpm check && pnpm test && pnpm build && git diff --check
```

## 安全与运营注意事项

- `.env`、数据库备份、OAuth secret、支付密钥和对象存储密钥不得提交到仓库。
- 微信支付未配置 `WECHAT_PAYMENT_CALLBACK_SECRET` 时，回调接口会拒绝处理，不会降级到模拟支付。
- 支付回调必须使用 HTTPS、固定回调地址、签名验证和金额二次校验。
- 支付和订单接口应保留请求日志、错误告警和审计留痕，但日志中不要记录完整支付密钥或敏感个人信息。
- 上线微信支付前必须补充真实商户号沙箱/生产联调、退款回调、证书轮换和失败重试验证。

## License

本项目保留 MIT 项目许可证声明；正式开源前请确认第三方依赖、设计素材和平台 SDK 的许可证及使用范围。
