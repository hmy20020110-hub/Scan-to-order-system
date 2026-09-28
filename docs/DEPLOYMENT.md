# 部署与上线检查

## 1. 运行环境

建议使用 Node.js 22、pnpm 10、MySQL 8/TiDB 和 HTTPS 域名。应用是一个单进程 Express 服务：开发环境由 Vite 提供前端资源，生产环境由 `dist` 提供静态文件。

生产环境至少需要配置：

```text
NODE_ENV=production
PORT=3000
DATABASE_URL=mysql://...
JWT_SECRET=<随机高强度值>
VITE_APP_ID=<OAuth 应用 ID>
OAUTH_SERVER_URL=https://api.manus.im
OWNER_OPEN_ID=<管理员 openId>
MERCHANT_LOGIN_CODE=<首次登录用的 8 位数字>
BUILT_IN_FORGE_API_URL=<平台 API 地址>
BUILT_IN_FORGE_API_KEY=<服务端 API 密钥>
WECHAT_PAYMENT_CALLBACK_SECRET=<微信适配器使用的回调密钥>
MOCK_PAYMENT_CALLBACK_SECRET=<非默认模拟支付密钥>
```

真实密钥只放在部署平台的 secret manager 或环境变量中，不要写入仓库、README、截图或日志。

## 2. 发布步骤

```bash
git clone https://github.com/hmy20020110-hub/Scan-to-order-system.git
cd Scan-to-order-system
pnpm install --frozen-lockfile
pnpm drizzle-kit migrate
pnpm check
pnpm test
pnpm build
NODE_ENV=production pnpm start
```

服务启动后，把反向代理的 HTTPS 请求转发到 `127.0.0.1:3000`。反向代理需要支持 WebSocket 升级以便后续升级实时订单推送，但当前销售分析和新订单提醒使用前端轮询，不依赖 WebSocket。

## 3. 数据库迁移策略

1. 在备份数据库后执行 `pnpm drizzle-kit migrate`。
2. 每次修改 `drizzle/schema.ts` 都执行 `pnpm drizzle-kit generate`，检查 SQL 是否包含意外的删除或重建。
3. 支付回调改造新增 `paymentTransactions` 表；它不写入演示订单，只记录真实回调。
4. 部署完成后检查 `paymentTransactions` 表和唯一索引 `payment_provider_transaction_unique`。
5. 不要在生产环境使用 `pnpm drizzle-kit push` 绕过迁移审查。

## 4. OAuth 与商家登录

- `OWNER_OPEN_ID` 必须对应管理员用户。
- 首次使用 `MERCHANT_LOGIN_CODE` 登录成功后，系统会保存哈希；之后修改登录码使用后台设置页完成。
- 连续 5 次失败会锁定 15 分钟；不要通过直接改数据库绕过锁定，除非是受控的运维恢复流程。
- 确保 OAuth 回调域名与部署域名完全一致，并使用 HTTPS cookie。

## 5. 对象存储

商家上传菜品图片时，前端只发送文件内容，服务端校验 MIME、Base64 数据和 5MB 大小，再写入对象存储。数据库只保存图片 URL，不保存图片二进制。

上线前确认：

- 对象存储 bucket 权限为最小可读范围。
- 图片 URL 不暴露服务端 API 密钥。
- 图片上传失败时不会创建不完整菜品记录。
- 生产环境开启 CDN 或图片缩略图策略，避免原图拖慢菜单。

## 6. 微信支付上线前

本仓库包含微信支付回调的统一 payload、签名测试契约和幂等落库流程，但正式微信支付还需要门店提供并配置：

- 微信支付商户号、AppID 和 API v3 密钥。
- 商户 API 证书、平台证书或官方平台证书自动更新机制。
- HTTPS 通知地址和防火墙放行策略。
- 统一下单、支付状态查询、退款和退款回调实现。
- 官方通知的 RSA 签名校验及 AES-GCM 解密适配器。

在真实商户联调前，不能把本项目的 HMAC 测试密钥当作微信官方签名验证。先运行 `pnpm test -- payment-callbacks.test.ts` 验证业务层，再使用官方沙箱/测试商户完成端到端联调。

## 7. 监控与备份

建议监控以下指标：

- `/api/trpc` 的 4xx/5xx 和响应耗时。
- 支付回调签名失败、金额不一致、订单不存在和重复回调数量。
- 数据库连接失败和迁移失败。
- 对象存储上传失败率。
- 商家后台轮询错误和顾客下单失败率。

数据库至少每日备份，并定期演练恢复。备份中包含订单和支付记录，应加密保存并限制访问。

## 8. 回滚

应用代码可回滚到上一个 Git commit；数据库迁移不可简单依赖代码回滚。任何删除列、修改枚举或改变金额字段前，应先做向后兼容迁移和备份验证。
