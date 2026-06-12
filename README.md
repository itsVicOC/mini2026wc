# 苏式生活馆 - 2026 世界杯赛事伴侣

微信小程序版 2026 年世界杯赛事伴侣。小程序展示赛事进度、今日和未来一周赛程、小组积分、淘汰赛安排、射手榜；后端定时调用 football-data.org API，把数据同步到 MySQL。

## 项目结构

```text
.
├── backend/       独立后端服务，Node.js + TypeScript + Express + MySQL
├── miniprogram/   微信原生小程序
└── docs/          PRD、技术方案、部署说明
```

## 文档

- [PRD](docs/PRD.md)
- [技术方案](docs/TECHNICAL_DESIGN.md)
- [小白部署配置手册](docs/DEPLOYMENT.md)

第一次配置请优先看 [小白部署配置手册](docs/DEPLOYMENT.md)。推荐顺序：

1. 准备 football-data.org API Token。
2. 在 1Panel 创建 MySQL 数据库。
3. 执行 `backend/database/schema.sql` 初始化表。
4. 配置后端环境变量。
5. 启动后端并访问 `/health`。
6. 访问 `/health/db` 确认数据库连接正常。
7. 手动触发一次 `/api/admin/sync`。
8. 修改小程序 `baseUrl`。
9. 在微信公众平台配置 request 合法域名。

## 后端开发

本地开发需要先安装 Node.js 和 npm。生产部署推荐 Node.js 20 LTS。

```bash
cd backend
cp .env.example .env
npm install
npm run dev
```

初始化数据库：

```sql
source backend/database/schema.sql;
```

健康检查：

```text
GET http://localhost:3000/health
GET http://localhost:3000/health/db
```

手动同步：

```bash
curl -X POST http://localhost:3000/api/admin/sync \
  -H "X-Admin-Token: change-me"
```

## 小程序开发

1. 用微信开发者工具导入 `miniprogram/`。
2. AppID 使用 `YOUR_MINIPROGRAM_APPID`。
3. 修改 [miniprogram/config/index.js](miniprogram/config/index.js) 中的 `baseUrl`。
4. 生产环境需要在微信公众平台配置 request 合法域名。

## 当前状态

- 已完成 PRD。
- 已完成技术方案和部署说明。
- 已搭建后端 API、MySQL schema、定时同步任务和 1Panel 部署配置。
- 已搭建微信小程序五个页面：首页、赛程、积分、淘汰赛、射手榜。
- 已完成 football-data.org 数据同步、积分榜分组兜底、射手榜和赛程展示等首版功能。
