# Windows 线下版与 EXE 打包方案

## 已确认的本地方案

- **数据库：本机 MariaDB/MySQL 8**。现有项目使用 Drizzle MySQL schema，保留该方案可以直接复用订单、支付流水、销售统计和迁移，不把生产数据改成不兼容的临时文件数据库。
- **文件存储：本地目录**。设置 `LOCAL_STORAGE_DIR`，例如 `C:\ProgramData\ScanToOrder\data\storage`；菜品图片写入该目录，数据库只保存 `/manus-storage/...` 相对 URL。
- **密钥：数据库加密保存**。商家在后台填写微信支付信息后，商户号、API v3 密钥、证书 PEM 和私钥 PEM 使用 `JWT_SECRET` 派生的 AES-256-GCM 密钥加密；后台只显示已配置状态，不回显明文。
- **EXE：Node 服务 + 前端静态资源**。EXE 不包含数据库文件，避免把数据库生命周期、备份和恢复绑定到可执行文件；本机 MariaDB 作为独立 Windows 服务运行。

## 打包

在 Node.js 22、pnpm 10 环境执行：

```bash
pnpm install --frozen-lockfile
pnpm package:win
```

产物目录：

```text
packaging/windows/ScanToOrder/
  ScanToOrder.exe
  public/
  drizzle/schema.sql
  CONFIG.env.template
  data/storage/
  README-FIRST-RUN.txt
```

当前构建目标为 `node22-win-x64`。在 Linux/macOS 上可以生成 Windows x64 目标包，但最终应在 Windows 门店电脑上进行启动、数据库连接、图片上传和打印/浏览器流程验收。

## 首次部署

1. 安装并启动 MariaDB/MySQL 8，创建业务数据库和专用账号。
2. 配置 `DATABASE_URL`、`JWT_SECRET`、`OWNER_OPEN_ID`、`MERCHANT_LOGIN_CODE`。
3. 将 `LOCAL_STORAGE_DIR` 指向受限的本地数据目录，并确保运行账号有读写权限。
4. 首次初始化执行发布包中的 `drizzle/schema.sql`；已有数据库只执行经过审核的增量迁移，不要覆盖业务数据。
5. 启动 `ScanToOrder.exe`，在本机浏览器访问 `http://127.0.0.1:3000`。
6. 商家进入后台设置，填写微信支付商户号、API v3 密钥、证书序列号、商户证书 PEM 和商户私钥 PEM。
7. 先备份数据库和 `LOCAL_STORAGE_DIR`，再进行真实商户联调。

## 重要限制

- 该 EXE 是本地服务程序，不是把 MySQL/MariaDB 静态嵌进单一文件；数据库需要作为本机服务安装。这是为了保留现有真实业务数据模型和可靠备份能力。
- 微信支付配置界面负责安全保存配置；正式统一下单、平台证书下载、RSA 签名和 AES-GCM 通知解密仍需根据商户号和微信官方证书完成联调。
- 不包含演示订单、演示菜品、演示桌台或模拟支付运行时。
