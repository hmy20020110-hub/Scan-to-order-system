import { cp, mkdir, rm, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const output = path.join(root, "packaging", "windows", "ScanToOrder");
await rm(output, { recursive: true, force: true });
await mkdir(path.join(output, "public"), { recursive: true });
await cp(path.join(root, "dist", "public"), path.join(output, "public"), { recursive: true });
await mkdir(path.join(output, "drizzle"), { recursive: true });
await cp(path.join(root, "drizzle", "schema.sql"), path.join(output, "drizzle", "schema.sql"));
await writeFile(
  path.join(output, "CONFIG.env.template"),
  `DATABASE_URL=mysql://scan_ordering:change-me@127.0.0.1:3306/scan_ordering\nJWT_SECRET=replace-with-a-random-secret-at-least-32-characters\nOWNER_OPEN_ID=replace-with-the-owner-open-id\nMERCHANT_LOGIN_CODE=20020110\nLOCAL_STORAGE_DIR=data/storage\n`,
);
await writeFile(
  path.join(output, "README-FIRST-RUN.txt"),
  `桌边 / ORDER Windows 线下版\n\n1. 先安装并启动本机 MariaDB/MySQL 8。\n2. 创建业务数据库后执行 drizzle/schema.sql（首次初始化用，文件不含业务数据）。\n3. 复制 CONFIG.env.template 为运行环境配置，并填写真实 DATABASE_URL、JWT_SECRET、OWNER_OPEN_ID。\n4. 将 LOCAL_STORAGE_DIR 设置为本目录 data/storage，并确保运行账号有读写权限。\n5. 双击 ScanToOrder.exe，浏览器访问 http://127.0.0.1:3000。\n\n支付密钥只在商家后台设置页填写，系统会使用 JWT_SECRET 加密保存。\n本包不包含演示数据，也不包含任何商家密钥。\n`,
);
await mkdir(path.join(output, "data", "storage"), { recursive: true });

const pkgBin = process.platform === "win32" ? "pkg.cmd" : "pkg";
execFileSync(
  pkgBin,
  ["dist/index.js", "--targets", "node22-win-x64", "--fallback-to-source", "--output", path.join(output, "ScanToOrder.exe")],
  { cwd: root, stdio: "inherit" },
);
console.log(`Windows package created: ${output}`);
