# 部署指南

本文说明如何把本预约系统部署到 **Vercel + Neon PostgreSQL**，并完成首次数据初始化。

当前公开预定地址形态：

- 首页：`/`（自动跳转到种子活动）
- 公开预定：`/events/dr-xiao-jie-2026-08-04`
- 管理后台：`/admin/login`

---

## 1. 准备清单

| 项目 | 是否必须 | 用途 |
| --- | --- | --- |
| GitHub 仓库 | 必须 | 代码托管，供 Vercel 拉取 |
| Vercel 账号 | 必须 | 托管 Next.js |
| Neon 项目 | 必须 | PostgreSQL 数据库 |
| 管理密码与密钥 | 必须 | 后台登录与会话签名 |
| Vercel Blob | 推荐 | 管理员上传头像 |
| Upstash Redis | 可选 | 预定接口限流 |

---

## 2. 创建 Neon 数据库

1. 打开 [Neon Console](https://console.neon.tech) 并创建项目。
2. 进入 **Connect** / **Connection Details**。
3. 准备两段连接串：

### `DATABASE_URL`（运行时，开连接池）

1. 打开 **Connection pooling**
2. 显示密码并复制整串  
3. 主机名通常带 `-pooler`

示例：

```env
DATABASE_URL="postgresql://neondb_owner:密码@ep-xxxx-pooler....neon.tech/neondb?sslmode=require"
```

### `DIRECT_URL`（迁移 / seed，关连接池）

1. **关闭** Connection pooling
2. 再复制一次  
3. 主机名通常**没有** `-pooler`

示例：

```env
DIRECT_URL="postgresql://neondb_owner:密码@ep-xxxx....neon.tech/neondb?sslmode=require"
```

> 用户名、密码、库名两边相同，主要差别是有没有 `-pooler`。

---

## 3. 生成密钥

在终端执行（生成两次，分别给 `SESSION_SECRET` 和 `BOOKING_SECRET`）：

```bash
openssl rand -base64 32
```

再自行设定：

```env
ADMIN_PASSWORD="你的强密码"
```

---

## 4. 配置 Vercel 项目

1. 打开 [Vercel](https://vercel.com) → **Add New Project**
2. Import 本仓库（例如 `westlake_un_booking`）
3. Framework 选 Next.js（通常自动识别）
4. 进入 **Settings → Environment Variables**，添加：

### 必填

| 变量名 | 值 |
| --- | --- |
| `DATABASE_URL` | Neon 池化连接串 |
| `DIRECT_URL` | Neon 直连串 |
| `ADMIN_PASSWORD` | 管理后台密码 |
| `SESSION_SECRET` | 随机长字符串 |
| `BOOKING_SECRET` | 随机长字符串 |

建议对 Production / Preview / Development 都勾选。

### 推荐：Vercel Blob（头像）

1. 项目页 → **Storage** → **Create** → **Blob**
2. 创建后复制 `BLOB_READ_WRITE_TOKEN`
3. 写回项目环境变量 `BLOB_READ_WRITE_TOKEN`

不加也能上传头像（会以 data URL 存进数据库），但正式环境更建议用 Blob。

### 可选：Upstash Redis（限流）

1. Vercel Marketplace 或 [Upstash](https://console.upstash.com) 创建 Redis
2. 设置：
   - `UPSTASH_REDIS_REST_URL`
   - `UPSTASH_REDIS_REST_TOKEN`

不加也不影响容量正确性，只是没有接口限流。

---

## 5. 部署

1. 在 Vercel 点击 **Deploy**（或 push 到 `main` 自动部署）
2. 构建命令由 `vercel.json` 控制：

```text
prisma generate && prisma migrate deploy && next build
```

因此每次部署会自动：

1. 生成 Prisma Client  
2. 执行数据库迁移  
3. 构建 Next.js

部署成功后，你会得到类似：

```text
https://your-app.vercel.app
```

---

## 6. 首次写入种子数据（只需一次）

迁移只会建表，**不会**自动写入肖劼活动数据。首次上线需要 seed 一次。

### 方式 A：Neon SQL Editor（推荐，网络受限时最稳）

1. 打开 Neon → **SQL Editor**
2. 粘贴并执行仓库中的 [`prisma/seed.sql`](./prisma/seed.sql)
3. 成功后访问：

```text
https://your-app.vercel.app/events/dr-xiao-jie-2026-08-04
```

### 方式 B：本地命令（需能连上 Neon 5432 端口）

```bash
cp .env.example .env
# 填入与 Vercel 相同的 DATABASE_URL / DIRECT_URL
npm install
npm run db:migrate
npm run db:seed
```

> 若本机直连 Neon 超时，优先用方式 A。

---

## 7. 上线验收

按顺序检查：

1. `https://your-app.vercel.app/`  
   - 应跳转到公开预定页
2. `https://your-app.vercel.app/events/dr-xiao-jie-2026-08-04`  
   - 能看到时段列表；若 404，多半是还没 seed
3. `https://your-app.vercel.app/admin/login`  
   - 用 `ADMIN_PASSWORD` 登录
4. 管理后台：
   - 编辑活动信息 / 发布状态
   - 上传头像
   - 锁定时段、释放预定、导出 CSV
5. 公开页实测预定：
   - 选时段 → 填姓名与 4 位编辑码 → Confirm Booking

---

## 8. 日常运维

| 场景 | 操作 |
| --- | --- |
| 更新代码 | push 到 GitHub，Vercel 自动部署；迁移会自动执行 |
| 改环境变量 | Vercel → Settings → Environment Variables → 保存后 **Redeploy** |
| 重置种子数据 | 再执行一次 `prisma/seed.sql` 或 `npm run db:seed`（注意会按 SQL 逻辑重置相关 slot） |
| 忘记管理员密码 | 在 Vercel 改 `ADMIN_PASSWORD` 后重新部署 |
| 头像不显示 | 确认已上传；或检查 `BLOB_READ_WRITE_TOKEN` 是否生效 |

---

## 9. 常见问题

### 首页或活动页 404

- `/` 404：旧部署没有首页跳转，重新部署最新代码
- `/events/dr-xiao-jie-2026-08-04` 404：数据库里还没有该活动，执行第 6 节 seed

### 构建失败：`migrate deploy` 报错

- 检查 `DATABASE_URL` / `DIRECT_URL` 是否配对
- 确认 Neon 项目未暂停
- Preview 环境是否也配置了同样的数据库变量

### 本地 `npm run db:seed` 连不上数据库

- 常见于本机无法直连 Neon `5432`
- 改用 Neon SQL Editor 执行 `prisma/seed.sql`

### Git push 超时

- 直连 GitHub 可能被网络限制
- 开启系统代理后再 push，例如：

```bash
export https_proxy=http://127.0.0.1:7897
export http_proxy=http://127.0.0.1:7897
git push
```

---

## 10. 环境变量速查

```env
DATABASE_URL=
DIRECT_URL=
ADMIN_PASSWORD=
SESSION_SECRET=
BOOKING_SECRET=
BLOB_READ_WRITE_TOKEN=
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
```

完整注释见 [`.env.example`](./.env.example)。

---

## 11. 本地开发（可选）

```bash
cp .env.example .env
npm install
npm run db:migrate
npm run db:seed
npm run dev
```

- 公开页：http://localhost:3000/events/dr-xiao-jie-2026-08-04  
- 管理后台：http://localhost:3000/admin/login  
