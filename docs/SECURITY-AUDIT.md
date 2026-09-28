# 安全审计与真实流程验收

审计时间：2026-09-28

## 已检查并修复

- 修复 Express 5 下的通配符路由错误：存储代理使用命名通配符，生产静态回退不再使用旧版 `*` 路由语法。
- 限制存储代理 key，拒绝 `..`、反斜杠和绝对路径，避免把任意路径转发到对象存储签名接口。
- 保持生产启动配置自检：`DATABASE_URL`、`JWT_SECRET`（至少 32 字符）和 `OWNER_OPEN_ID` 缺失时拒绝启动。
- 保持支付回调只接受 `wechat` provider；未配置回调密钥时拒绝处理，不降级、不启动模拟支付。
- 文件上传继续执行请求体、MIME、Base64、文件头和 5MB 大小校验。
- 修复测试污染真实商家账户的问题：不再用线上数据库执行错误登录测试；旧测试造成的用户 1 锁定状态已恢复为失败次数 0、未锁定。
- 移除非生产 JSX 定位插件，降低构建依赖和攻击面。
- 升级 Vite、PostCSS、Tailwind、Rollup、Picomatch、Lodash、Markdown 转换依赖等已发现存在安全公告的依赖。

## 验证结果

- `pnpm check`：通过。
- `pnpm test`：7 个测试文件、19 个测试全部通过。
- `pnpm build`：通过，生成 `dist/public` 和 `dist/index.js`。
- `pnpm audit --prod --audit-level high`：无已知漏洞。
- 全量 `pnpm audit --audit-level high`：无 high/critical；剩余报告仅为开发工具链 low/moderate 项，不进入生产依赖。
- 生产模式启动烟测：在提供临时 32 字符以上 JWT 密钥后成功监听端口；未把临时密钥写入项目或仓库。
- 数据库：未插入演示订单、菜品或桌台；仅恢复了真实管理员用户被旧测试错误锁定的登录安全状态。

## 仍需商家完成的真实上线配置

- 生产环境 `DATABASE_URL`、`JWT_SECRET`、`OWNER_OPEN_ID`。
- Manus Storage / 对象存储服务端配置。
- 微信支付商户号、AppID、API v3 密钥、证书、官方平台证书、HTTPS 回调地址，以及正式的微信 RSA/AES-GCM 适配联调。
- 正式部署应使用 HTTPS、secret manager、数据库备份和受限的反向代理；不要把密钥写入仓库、日志或 EXE 包内。

本审计不创建任何演示数据，也不启动模拟支付进程。
