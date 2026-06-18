# 小白部署配置手册

这份文档按“照着做”的方式写，目标是让没有太多后端经验的人，也能把项目部署到一台装了 1Panel 的云服务器上。

项目最终会有三部分：

- 微信小程序：用户看到的页面。
- 后端服务：给小程序提供数据接口，也负责调用 football-data.org。
- MySQL 数据库：保存赛程、比分、积分榜、射手榜和同步日志。

## 0. 你需要准备什么

开始前请确认你手里有这些东西：

1. 一台云服务器，并且已经安装好 1Panel。
2. 一个已经备案并能访问服务器的 HTTPS 域名，例如 `https://api.example.com`。
3. football-data.org 的免费 API Token。
4. 微信小程序 AppID：`YOUR_MINIPROGRAM_APPID`。
5. 服务器上能安装 Node.js 20 LTS 和 MySQL 8.x。

如果暂时没有 HTTPS 域名，也可以先在本地开发，但微信小程序真机和线上环境必须使用 HTTPS 合法域名。

## 1. 最短部署路径

熟悉 1Panel 的话，可以按这个顺序走：

1. 在 1Panel 安装 MySQL 8.x。
2. 创建数据库 `mini2026wc`。
3. 执行 [schema.sql](backend/database/schema.sql) 初始化表。
4. 上传或拉取项目代码到服务器。
5. 进入 `backend` 目录，执行 `npm install` 和 `npm run build`。
6. 在 1Panel 创建 Node.js 应用，启动命令填 `npm start`。
7. 配置后端环境变量。
8. 配置反向代理和 HTTPS 域名。
9. 访问 `https://你的域名/health`，看到 `status: ok`。
10. 调用 `/api/admin/sync` 手动同步一次数据。
11. 如果需要开赛提醒，在微信公众平台申请订阅消息模板。
12. 修改小程序 `baseUrl` 为后端 HTTPS 域名，并填写订阅消息模板 ID。
13. 用微信开发者工具导入 `miniprogram/` 预览。

下面是详细步骤。

## 1.1 需要修改的文件速查

大多数情况下，你只需要改这些地方：

| 位置 | 什么时候改 | 主要内容 |
| --- | --- | --- |
| `backend/.env` | 本地开发后端时 | 数据库账号、football-data.org Token、同步开关。 |
| 1Panel 环境变量面板 | 服务器部署后端时 | 和 `.env` 一样，但生产环境建议在 1Panel 页面里填。 |
| `miniprogram/config/local.js` | 小程序连接后端时 | 从 `miniprogram/config/local.example.js` 复制得到，填写你的后端域名；如启用开赛提醒，填写 `subscriptionTemplateId`。 |
| 微信公众平台 request 合法域名 | 小程序上线前 | 添加后端 HTTPS 域名。 |
| 微信公众平台订阅消息 | 启用开赛提醒时 | 申请一次性订阅消息模板，复制模板 ID 和字段 key。 |

不需要把 football-data.org Token 写进小程序，不需要改小程序页面代码才能同步数据。

## 2. 获取 football-data.org API Token

1. 打开 [football-data.org](https://www.football-data.org/)。
2. 注册或登录账号。
3. 进入 API Token / Client Area 页面。
4. 找到你的 Token，复制下来。

这个 Token 只能放在后端服务器，不要写进小程序代码里。

后面会填到环境变量：

```text
FOOTBALL_DATA_API_TOKEN=你的 football-data.org token
```

## 3. 在 1Panel 安装 MySQL

1. 登录 1Panel。
2. 进入“应用商店”。
3. 搜索 `MySQL`。
4. 选择 MySQL 8.x 安装。
5. 记下 MySQL 的 root 密码，或者后续新建一个专用数据库用户。

建议创建一个独立数据库：

- 数据库名：`mini2026wc`
- 字符集：`utf8mb4`
- 排序规则：`utf8mb4_unicode_ci`

如果 1Panel 提供“数据库”管理页面，可以在里面直接创建数据库和用户。

## 4. 初始化数据库表

数据库创建好以后，需要执行建表 SQL。

建表文件在：

[backend/database/schema.sql](backend/database/schema.sql)

当前 `schema.sql` 开头已经包含：

```sql
CREATE DATABASE IF NOT EXISTS mini2026wc
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_unicode_ci;

USE mini2026wc;
```

所以即使你在 1Panel、phpMyAdmin 或 MySQL 的全局 SQL 窗口执行，也会自动创建并切换到 `mini2026wc` 数据库。

### 方法 A：在 1Panel 页面执行

1. 进入 1Panel 的数据库管理。
2. 打开 SQL 执行窗口。
3. 复制 [schema.sql](backend/database/schema.sql) 全部内容。
4. 粘贴并执行。

执行成功后，会看到这些表：

- `competitions`
- `teams`
- `matches`
- `standings`
- `scorers`
- `sync_logs`
- `match_subscriptions`
- `match_details`

### 方法 B：命令行执行

如果你习惯 SSH，也可以执行：

```bash
mysql -u 用户名 -p mini2026wc < backend/database/schema.sql
```

执行后输入数据库密码。

### 4.1 如果看到 No database selected

报错：

```text
#1046 - No database selected
```

意思是 MySQL 还没有选中数据库，不知道表要建在哪里。

解决方式任选一种：

1. 使用最新版 [schema.sql](backend/database/schema.sql)，它已经在开头加入 `CREATE DATABASE` 和 `USE mini2026wc`。
2. 如果你手动复制了旧 SQL，请在最前面加上：

```sql
CREATE DATABASE IF NOT EXISTS mini2026wc
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_unicode_ci;

USE mini2026wc;
```

然后再执行后面的 `CREATE TABLE`。

## 5. 准备后端代码

后端代码在：

[backend](backend/package.json)

如果你是把整个项目上传到服务器，请保持目录结构：

```text
mini2026wc/
  backend/
  miniprogram/
  docs/
```

进入后端目录：

```bash
cd backend
```

安装依赖：

```bash
npm install
```

构建代码：

```bash
npm run build
```

构建成功后会生成：

```text
backend/dist/
```

## 6. 配置后端环境变量

后端需要环境变量才能知道数据库地址、API Token、同步任务开关等信息。

模板文件有两个：

- 本地开发模板：[backend/.env.example](backend/.env.example)
- 1Panel 生产模板：[backend/deploy/1panel.env.example](backend/deploy/1panel.env.example)

### 6.1 每个变量怎么填

| 变量名 | 示例 | 说明 |
| --- | --- | --- |
| `NODE_ENV` | `production` | 生产环境填 `production`，本地开发填 `development`。 |
| `PORT` | `3000` | 后端服务监听端口。 |
| `FOOTBALL_DATA_API_BASE_URL` | `https://api.football-data.org/v4` | football-data.org API 地址，一般不用改。 |
| `FOOTBALL_DATA_API_TOKEN` | `abc123` | 你的 football-data.org Token。 |
| `FOOTBALL_DATA_COMPETITION` | `WC` | 世界杯赛事代码。 |
| `FOOTBALL_DATA_SEASON` | `2026` | 赛事年份。 |
| `MYSQL_HOST` | `mysql`、`1Panel-mysql-xxxx` 或服务器内网 IP | MySQL 地址。1Panel 容器部署时通常不能填 `127.0.0.1`，要填 MySQL 容器服务名或数据库连接地址。 |
| `MYSQL_PORT` | `3306` | MySQL 端口。 |
| `MYSQL_DATABASE` | `mini2026wc` | 数据库名。 |
| `MYSQL_USER` | `mini2026wc` | 数据库用户名。 |
| `MYSQL_PASSWORD` | `你的数据库密码` | 数据库密码。 |
| `APP_TIMEZONE` | `Asia/Shanghai` | 默认北京时间。 |
| `ADMIN_SYNC_TOKEN` | `一串随机密码` | 手动同步接口密码，自己生成，越长越好。 |
| `WECHAT_APP_ID` | `你的小程序 AppID` | 开赛提醒需要，用于后端换取用户 openid。 |
| `WECHAT_APP_SECRET` | `你的小程序 AppSecret` | 开赛提醒需要，只能放后端环境变量，不要写进小程序代码。 |
| `WECHAT_SUBSCRIBE_TEMPLATE_ID` | `xxxxxxxx` | 微信公众平台订阅消息模板 ID。 |
| `WECHAT_SUBSCRIBE_PAGE` | `pages/home/home` | 用户点击通知后打开的小程序页面。 |
| `WECHAT_SUBSCRIBE_MATCH_KEY` | `thing1` | 模板里“比赛名称”字段的 key，按你实际模板字段填写。 |
| `WECHAT_SUBSCRIBE_TIME_KEY` | `time2` | 模板里“开赛时间”字段的 key，按你实际模板字段填写。 |
| `WECHAT_SUBSCRIBE_TIP_KEY` | `thing3` | 模板里“温馨提示/备注”字段的 key，按你实际模板字段填写。 |
| `ENABLE_SUBSCRIPTION_CRON` | `true` | 是否开启开赛提醒发送任务。生产需要提醒时填 `true`。 |
| `SUBSCRIPTION_NOTIFY_CRON` | `"* * * * *"` | 开赛提醒扫描频率，默认每分钟一次。 |
| `ENABLE_SYNC_CRON` | `true` | 是否开启定时同步。生产建议填 `true`。 |
| `ENABLE_FULL_SYNC_CRON` | `false` | 是否额外开启全量同步。通常保持 `false`，避免和分资源同步重复。 |
| `MATCHES_SYNC_CRON` | `"* * * * *"` | 比赛数据同步频率，默认每分钟一次。 |
| `MATCH_DETAILS_SYNC_CRON` | `"* * * * *"` | 单场比赛详情同步频率，默认每分钟一次。 |
| `MATCH_DETAILS_SYNC_LIMIT` | `6` | 每轮最多同步多少场单场详情，避免超过 football-data.org 免费等级频率限制。 |
| `MATCH_DETAIL_FINISHED_LOOKBACK_HOURS` | `5` | 已结束比赛从开赛时间往后保留多久作为详情同步候选。 |
| `MATCH_DETAIL_FINISHED_SYNC_MINUTES` | `5` | 已结束比赛详情的最小重复同步间隔。 |
| `STANDINGS_SYNC_CRON` | `"*/5 * * * *"` | 积分榜同步频率，默认每 5 分钟一次。 |
| `SCORERS_SYNC_CRON` | `"*/5 * * * *"` | 射手榜同步频率，默认每 5 分钟一次。 |
| `TEAMS_SYNC_CRON` | `"0 3 * * *"` | 球队数据同步频率，默认每天凌晨 3 点一次。 |
| `FULL_SYNC_CRON` | `"0 4 * * *"` | 全量同步频率，仅 `ENABLE_FULL_SYNC_CRON=true` 时生效。 |
| `CACHE_TTL_SECONDS` | `30` | 接口缓存时间，单位秒。为了比分新鲜度，默认 30 秒。 |

### 6.2 推荐生产配置

可以从 [backend/deploy/1panel.env.example](backend/deploy/1panel.env.example) 复制：

```text
NODE_ENV=production
PORT=3000

FOOTBALL_DATA_API_BASE_URL=https://api.football-data.org/v4
FOOTBALL_DATA_API_TOKEN=填你的 football-data.org token
FOOTBALL_DATA_COMPETITION=WC
FOOTBALL_DATA_SEASON=2026

MYSQL_HOST=mysql
MYSQL_PORT=3306
MYSQL_DATABASE=mini2026wc
MYSQL_USER=mini2026wc
MYSQL_PASSWORD=填你的数据库密码

APP_TIMEZONE=Asia/Shanghai
ADMIN_SYNC_TOKEN=自己生成一串长密码
WECHAT_APP_ID=填你的小程序 AppID
WECHAT_APP_SECRET=填你的小程序 AppSecret
WECHAT_SUBSCRIBE_TEMPLATE_ID=填订阅消息模板 ID
WECHAT_SUBSCRIBE_PAGE=pages/home/home
WECHAT_SUBSCRIBE_MATCH_KEY=thing1
WECHAT_SUBSCRIBE_TIME_KEY=time2
WECHAT_SUBSCRIBE_TIP_KEY=thing3
ENABLE_SUBSCRIPTION_CRON=true
SUBSCRIPTION_NOTIFY_CRON="* * * * *"
ENABLE_SYNC_CRON=true
ENABLE_FULL_SYNC_CRON=false
MATCHES_SYNC_CRON="* * * * *"
MATCH_DETAILS_SYNC_CRON="* * * * *"
MATCH_DETAILS_SYNC_LIMIT=6
MATCH_DETAIL_FINISHED_LOOKBACK_HOURS=5
MATCH_DETAIL_FINISHED_SYNC_MINUTES=5
STANDINGS_SYNC_CRON="*/5 * * * *"
SCORERS_SYNC_CRON="*/5 * * * *"
TEAMS_SYNC_CRON="0 3 * * *"
FULL_SYNC_CRON="0 4 * * *"
CACHE_TTL_SECONDS=30
```

注意：

- 如果后端和 MySQL 都由 1Panel 以容器方式运行，`MYSQL_HOST` 通常不能填 `127.0.0.1`。
- 1Panel 容器里，`127.0.0.1` 指的是后端容器自己，不是 MySQL 容器。
- `MYSQL_HOST` 要填 MySQL 的容器服务名、1Panel 显示的数据库连接地址，或服务器内网 IP。
- 如果后端直接运行在服务器宿主机上，且 MySQL 也监听宿主机本地端口，`MYSQL_HOST` 才通常填 `127.0.0.1`。
- `ADMIN_SYNC_TOKEN` 不要用 `change-me`，请改成自己的随机字符串。
- `WECHAT_APP_SECRET` 是敏感信息，只能填在后端环境变量或 1Panel 密钥配置里，不要提交到 GitHub。
- 如果暂时不启用开赛提醒，可以把 `ENABLE_SUBSCRIPTION_CRON=false`，并留空 `WECHAT_*` 变量；小程序端也不要填写 `subscriptionTemplateId`。
- football-data.org 免费额度为每分钟 10 次时，默认配置约为：matches 每分钟 1 次，standings 每 5 分钟 1 次，scorers 每 5 分钟 1 次，teams 每天 1 次，额度比较充裕。

### 6.3 配置开赛提醒订阅消息

如果你要让用户点击“订阅开赛通知”，并在比赛开始前 5 分钟收到微信通知，需要额外做这一节。

#### 第一步：拿到 AppSecret

1. 打开微信公众平台。
2. 进入你的小程序后台。
3. 打开“开发管理”或“开发设置”。
4. 找到 AppID 和 AppSecret。
5. 把 AppID 填到后端环境变量 `WECHAT_APP_ID`。
6. 把 AppSecret 填到后端环境变量 `WECHAT_APP_SECRET`。

注意：AppSecret 只能放在后端服务器，不能写进小程序代码，也不要发到 GitHub。

#### 第二步：申请订阅消息模板

1. 在微信公众平台进入“功能”。
2. 找到“订阅消息”。
3. 选择“一次性订阅消息”模板。
4. 搜索和“比赛提醒”“活动开始提醒”“赛事开赛提醒”接近的模板。
5. 模板字段建议包含：
   - 比赛名称，例如 `thing1`
   - 开赛时间，例如 `time2`
   - 温馨提示或备注，例如 `thing3`
6. 保存模板后，复制模板 ID。

把模板 ID 填到两个地方：

```text
后端环境变量：
WECHAT_SUBSCRIBE_TEMPLATE_ID=你的模板 ID

小程序配置：
miniprogram/config/local.js 里的 subscriptionTemplateId
```

#### 第三步：确认模板字段 key

微信模板详情里每个字段后面会有 key，例如：

```text
比赛名称 thing1
开赛时间 time2
温馨提示 thing3
```

如果你的模板字段刚好是这样，保持默认即可：

```text
WECHAT_SUBSCRIBE_MATCH_KEY=thing1
WECHAT_SUBSCRIBE_TIME_KEY=time2
WECHAT_SUBSCRIBE_TIP_KEY=thing3
```

如果你的模板不是这几个 key，就把环境变量改成微信后台显示的实际 key。

#### 第四步：开启定时发送

生产环境建议：

```text
ENABLE_SUBSCRIPTION_CRON=true
SUBSCRIPTION_NOTIFY_CRON="* * * * *"
```

这表示后端每分钟检查一次 `match_subscriptions` 表，找到距离开赛前 5 分钟应该发送的记录，然后调用微信订阅消息接口。

#### 第五步：老数据库升级

如果你之前已经执行过老版 `schema.sql`，不用删库重建，只需要执行：

[backend/database/fixes/add_match_subscriptions.sql](backend/database/fixes/add_match_subscriptions.sql)

[backend/database/fixes/add_match_details.sql](backend/database/fixes/add_match_details.sql)

执行方式和初始化表一样，在 1Panel SQL 窗口复制执行即可。

如果你是全新部署，直接执行最新版 [schema.sql](backend/database/schema.sql) 就已经包含这些表。

## 7. 在 1Panel 创建后端应用

### 7.1 Node.js 应用方式

如果 1Panel 支持 Node.js 应用：

1. 进入“网站”或“运行环境”。
2. 创建 Node.js 项目。
3. 项目目录选择 `backend`。
4. Node 版本选择 `20 LTS` 或更高。
5. 构建命令填：

```bash
npm install && npm run build
```

6. 启动命令填：

```bash
npm start
```

7. 端口填：

```text
3000
```

8. 在环境变量区域填入第 6 节的变量。
9. 保存并启动。

### 7.2 命令行方式

如果你用 SSH 手动启动：

```bash
cd backend
npm install
npm run build
npm start
```

如果看到类似下面的日志，说明启动成功：

```text
server started port=3000
```

长期运行建议交给 1Panel 或进程管理工具，不建议一直开着 SSH 窗口跑。

## 8. 配置域名和 HTTPS

微信小程序线上请求必须使用 HTTPS 域名。

推荐做法：

1. 准备一个子域名，例如 `api.example.com`。
2. 在域名 DNS 里添加 A 记录，指向服务器公网 IP。
3. 在 1Panel 创建网站或反向代理。
4. 反向代理目标填：

```text
http://127.0.0.1:3000
```

5. 给域名申请 HTTPS 证书。
6. 开启强制 HTTPS。

配置好后，浏览器访问：

```text
https://api.example.com/health
```

看到类似结果就说明后端能访问：

```json
{
  "success": true,
  "data": {
    "status": "ok"
  }
}
```

这个接口只检查后端服务是否启动，不检查数据库。

数据库连接检查访问：

```text
https://api.example.com/health/db
```

如果 `/health` 正常但 `/health/db` 报错，说明后端启动了，但 MySQL 地址、端口、账号或密码还没配对。

## 9. 手动同步一次数据

第一次部署后，数据库是空的，需要先同步一次。

把下面命令里的两个地方换成你的值：

- `https://api.example.com` 换成你的后端域名。
- `你的 ADMIN_SYNC_TOKEN` 换成环境变量里的 `ADMIN_SYNC_TOKEN`。

```bash
curl -X POST https://api.example.com/api/admin/sync \
  -H "X-Admin-Token: 你的 ADMIN_SYNC_TOKEN"
```

成功时会返回每类数据的同步结果，例如：

```json
{
  "success": true,
  "data": [
    {
      "resource": "teams",
      "status": "success",
      "upsertCount": 48
    },
    {
      "resource": "matches",
      "status": "success",
      "upsertCount": 104
    },
    {
      "resource": "match_details",
      "status": "success",
      "candidateCount": 1,
      "requestCount": 1,
      "upsertCount": 1
    }
  ]
}
```

如果某个资源返回 `failed`，先不要慌。免费等级可能不支持某些接口，尤其是 `scorers` 或 `teams`。失败原因会记录在 `sync_logs.error_message`。

如果只想手动同步正在进行或近期已结束比赛的详情，可以调用：

```bash
curl -X POST https://api.example.com/api/admin/sync/match-details \
  -H "X-Admin-Token: 你的 ADMIN_SYNC_TOKEN"
```

## 10. 检查数据是否同步成功

可以访问这些接口：

```text
https://api.example.com/api/home
https://api.example.com/api/matches
https://api.example.com/api/standings
https://api.example.com/api/knockouts
https://api.example.com/api/scorers
```

如果接口返回：

```json
{
  "success": true,
  "data": []
}
```

说明接口通了，但数据库里可能还没有对应数据，或者免费 API 没返回这类数据。

也可以在 MySQL 里看同步日志：

```sql
SELECT resource, `status`, request_count, upsert_count, error_message, finished_at
FROM sync_logs
ORDER BY id DESC
LIMIT 20;
```

### 10.1 不会用 curl 怎么办

`GET` 接口可以直接用浏览器打开，例如：

```text
https://api.example.com/health
https://api.example.com/api/home
```

但手动同步接口是 `POST`，浏览器地址栏不能直接触发。可以用下面三种方式之一：

1. 在 1Panel 终端里执行第 9 节的 `curl` 命令。
2. 用 Apifox、Postman 等接口工具发 `POST` 请求。
3. 临时让懂技术的人帮你执行一次，后续交给定时任务自动同步。

接口工具里这样填：

- Method：`POST`
- URL：`https://api.example.com/api/admin/sync`
- Header 名称：`X-Admin-Token`
- Header 值：你的 `ADMIN_SYNC_TOKEN`
- Body：不用填

### 10.2 在 1Panel 哪里看日志

如果后端启动失败或同步失败，可以在 1Panel 里找应用日志。

常见入口名称可能是：

- “网站” -> 对应站点 -> “日志”
- “应用” -> Node.js 应用 -> “日志”
- “容器” -> 对应容器 -> “日志”

重点搜索这些关键词：

- `server started`：后端启动成功。
- `failed to start server`：后端启动失败。
- `sync resource failed`：同步某类数据失败。
- `Access denied`：数据库账号或密码错误。
- `FOOTBALL_DATA_API_TOKEN is not configured`：没有配置 football-data.org Token。

## 11. 配置微信小程序

小程序代码在：

[miniprogram](miniprogram/app.json)

### 11.1 修改后端地址

复制本地配置文件：

```bash
cp miniprogram/config/local.example.js miniprogram/config/local.js
```

打开：

`miniprogram/config/local.js`

把：

```js
baseUrl: 'http://localhost:3000'
```

改成你的 HTTPS 后端域名：

```js
baseUrl: 'https://api.example.com'
```

注意不要在最后加 `/`，推荐写成：

```js
baseUrl: 'https://api.example.com'
```

不要写成：

```js
baseUrl: 'https://api.example.com/'
```

如果启用了开赛提醒，还需要把订阅消息模板 ID 填到同一个本地配置文件：

```js
subscriptionTemplateId: '你的订阅消息模板 ID'
```

这个模板 ID 必须和后端环境变量 `WECHAT_SUBSCRIBE_TEMPLATE_ID` 保持一致。

如果暂时不启用开赛提醒，保持空字符串即可：

```js
subscriptionTemplateId: ''
```

### 11.2 导入微信开发者工具

1. 打开微信开发者工具。
2. 选择“导入项目”。
3. 项目目录选择 `miniprogram/`。
4. AppID 填：

```text
YOUR_MINIPROGRAM_APPID
```

5. 项目名称可以填：

```text
苏式生活馆
```

6. 点击导入。

### 11.3 配置 request 合法域名

在微信公众平台：

1. 登录小程序后台。
2. 进入“开发管理”。
3. 进入“开发设置”。
4. 找到“服务器域名”。
5. 在 `request 合法域名` 中添加你的后端域名，例如：

```text
https://api.example.com
```

注意：

- 必须是 HTTPS。
- 不能带路径，例如不要填 `https://api.example.com/api/home`。
- 域名证书必须有效。

开发阶段如果暂时没有配置合法域名，可以在微信开发者工具里勾选“不校验合法域名”，但上线前必须配置。

## 12. 本地开发方式

如果你想先在电脑本地跑：

### 12.1 启动 MySQL

本地需要有 MySQL，并创建 `mini2026wc` 数据库。

执行 [schema.sql](backend/database/schema.sql) 初始化表。

### 12.2 配置 `.env`

复制模板：

```bash
cd backend
cp .env.example .env
```

修改 `.env`：

```text
MYSQL_HOST=127.0.0.1
MYSQL_PORT=3306
MYSQL_DATABASE=mini2026wc
MYSQL_USER=root
MYSQL_PASSWORD=你的本地数据库密码
FOOTBALL_DATA_API_TOKEN=你的 token
ADMIN_SYNC_TOKEN=change-me
ENABLE_SYNC_CRON=false
```

### 12.3 启动后端

```bash
cd backend
npm install
npm run dev
```

访问：

```text
http://localhost:3000/health
```

### 12.4 小程序连接本地后端

本地开发时 `miniprogram/config/local.js` 可以保持：

```js
baseUrl: 'http://localhost:3000'
```

微信开发者工具里需要勾选“不校验合法域名”。

## 13. 上线前检查清单

上线前逐项确认：

- MySQL 表已经初始化。
- `FOOTBALL_DATA_API_TOKEN` 已填写。
- `ADMIN_SYNC_TOKEN` 已改成随机字符串。
- `ENABLE_SYNC_CRON=true`。
- `MATCHES_SYNC_CRON="* * * * *"`，保障比分分钟级更新。
- `STANDINGS_SYNC_CRON="*/5 * * * *"`。
- `SCORERS_SYNC_CRON="*/5 * * * *"`。
- `ENABLE_FULL_SYNC_CRON=false`，避免额外全量同步浪费额度。
- `https://你的域名/health` 能访问。
- `https://你的域名/health/db` 能访问。
- `https://你的域名/api/home` 能访问。
- 小程序 `baseUrl` 已改成 HTTPS 后端域名。
- 微信公众平台已配置 request 合法域名。
- 小程序页面没有使用 FIFA 官方 Logo、奖杯图、吉祥物等未授权素材。

## 13.1 完整验收顺序

建议按这个顺序验收，不要跳步：

1. 打开 `https://你的域名/health`，确认后端活着。
2. 打开 `https://你的域名/health/db`，确认数据库能连上。
3. 打开 `https://你的域名/api/home`，确认接口能返回 JSON。
4. 执行一次手动同步。
5. 在 MySQL 查询 `sync_logs`，确认至少有同步日志。
6. 再打开 `https://你的域名/api/home`，确认有比赛或空状态数据。
7. 修改小程序 `baseUrl`。
8. 微信开发者工具重新编译。
9. 检查首页、赛程、积分、淘汰赛、射手榜五个 Tab 是否能打开。
10. 真机预览，确认 request 合法域名没有报错。

如果第 1 步失败，先不要查小程序；如果第 3 步失败，先不要查页面样式。按顺序排查会省很多时间。

## 14. 常见问题

### 14.1 访问 `/health` 失败

可能原因：

- 后端服务没有启动。
- 端口不是 `3000`。
- 1Panel 反向代理没有配好。
- 防火墙没有放行端口。
- HTTPS 证书没有配置好。

排查方法：

1. 先在服务器上访问 `http://127.0.0.1:3000/health`。
2. 如果本机能访问，再检查 1Panel 反向代理。
3. 如果本机不能访问，先看后端服务日志。

### 14.2 数据库连接失败

常见报错可能包含：

```text
Access denied
ECONNREFUSED
Unknown database
```

对应处理：

- `Access denied`：用户名或密码错了。
- `ECONNREFUSED`：MySQL 地址或端口错了，或者 MySQL 没启动。
- `Unknown database`：数据库还没创建，或 `MYSQL_DATABASE` 填错。

如果日志里是：

```text
ECONNREFUSED 127.0.0.1:3306
```

在 1Panel 容器部署里，最常见原因是 `MYSQL_HOST` 填成了 `127.0.0.1`。

处理方式：

1. 进入 1Panel 的 MySQL 应用详情或数据库详情。
2. 找到 MySQL 的连接地址、容器名称或服务名。
3. 把后端环境变量 `MYSQL_HOST` 改成这个地址，例如 `mysql` 或 1Panel 显示的 MySQL 服务名。
4. 确认 `MYSQL_PORT=3306`。
5. 保存环境变量并重启后端应用。
6. 访问 `https://你的域名/health/db` 验证。

### 14.3 手动同步返回 Unauthorized

说明 `X-Admin-Token` 不对。

检查：

- curl 里的 token 是否和环境变量 `ADMIN_SYNC_TOKEN` 完全一致。
- 后端服务是否已经重启，让新环境变量生效。

### 14.4 同步接口返回 failed

先看 `sync_logs`：

```sql
SELECT resource, `status`, error_message, finished_at
FROM sync_logs
ORDER BY id DESC
LIMIT 20;
```

常见原因：

- football-data.org Token 没填或填错。
- 免费等级不支持某个接口。
- 请求太频繁，触发频控。
- 2026 世界杯数据暂时还没有开放。

如果只有 `matches` 失败，并看到类似：

```text
You have an error in your SQL syntax ... near 'utc_date, beijing_date, status'
```

说明后端版本里 SQL 没有给 MySQL 内置函数/关键字段加反引号。请更新代码到最新版，重新执行：

```bash
npm run build
```

然后重启后端应用，再手动同步一次。

如果看到：

```text
Unknown column 'utc_date' in 'field list'
```

说明数据库里的 `matches` 表结构是旧的或创建不完整。由于比赛表数据可以从 football-data.org 重新同步，部署初期可以直接重建 `matches` 表。

在 1Panel 数据库 SQL 窗口执行：

[backend/database/fixes/recreate_matches.sql](backend/database/fixes/recreate_matches.sql)

执行后重启后端应用，再手动同步一次。

如果积分榜页面没有数据，或者积分数据明显不像总积分榜，可以执行：

[backend/database/fixes/clear_standings.sql](backend/database/fixes/clear_standings.sql)

然后使用最新版后端重新同步。新版同步逻辑只写入 football-data.org 返回的 `TOTAL` 总积分榜，避免 `HOME`、`AWAY` 数据覆盖总积分。

如果小程序调试器里看到：

```text
[standings loaded] { count: 48, groups: ["GROUP_STAGE"] }
```

说明 football-data.org 当前的 2026 世界杯 standings 响应可能只返回 `TOTAL`、`HOME`、`AWAY` 三张 48 队总表，`group` 为空。最新版后端会先读取 standings 的积分数据，再用 matches 里的 `group` 字段按球队 ID 补齐小组归属；如果未来 standings 恢复返回 `GROUP_A` 到 `GROUP_L`，则优先使用 standings 自带的 `group`。

已存在的旧数据优先执行：

[backend/database/fixes/update_standings_group_from_matches.sql](backend/database/fixes/update_standings_group_from_matches.sql)

更推荐的处理方式是先重新构建最新版后端，然后手动同步一次。同步会先拉 matches，确保 `matches.group_name` 有数据，再拉 standings 并按球队 ID 补齐小组。只有历史数据已经写成 `GROUP_STAGE`、`GROUP_UNKNOWN`，且暂时不方便重拉接口时，再执行上面的修复 SQL。

[backend/database/fixes/regroup_standings.sql](backend/database/fixes/regroup_standings.sql) 已废弃，只保留提示信息，不再修改数据。

如果升级到支持 `form` 近期战绩字段的后端，已有数据库需要先执行：

[backend/database/fixes/add_standings_form.sql](backend/database/fixes/add_standings_form.sql)

这个脚本可以重复执行；如果字段已经存在，只会输出提示，不会修改表结构。

可以用下面 SQL 检查加拿大是否已经按赛程修正：

```sql
USE mini2026wc;

SELECT team_name, group_name
FROM standings
WHERE team_name LIKE '%Canada%';

SELECT home_team_name, away_team_name, group_name
FROM matches
WHERE home_team_name LIKE '%Canada%'
   OR away_team_name LIKE '%Canada%';
```

### 14.5 小程序提示 request 合法域名错误

处理：

1. 确认 `baseUrl` 是 HTTPS。
2. 确认微信公众平台 request 合法域名已经添加。
3. 确认域名没有路径。
4. 确认开发者工具没有缓存旧配置，可以重新编译或重启开发者工具。

### 14.6 小程序页面是空的

可能原因：

- 后端接口能访问，但数据库还没有同步到数据。
- football-data.org 免费套餐没有返回某类数据。
- 小程序 `baseUrl` 填错。

建议先访问：

```text
https://api.example.com/api/home
```

如果这里没数据，小程序也不会有数据。

### 14.7 射手榜没有数据

这是预期风险之一。当前使用 football-data.org 免费等级，射手榜接口可能不可用，或者数据字段不完整。

如果 `/api/scorers` 返回空数组，小程序会显示空状态，不影响其他页面。

## 15. 建议的后续配置优化

等基础部署稳定后，可以再考虑：

- 给后端接口加更细的限流。
- 使用 Redis 替代进程内缓存。
- 增加数据同步告警。
- 如果确认 API 额度和服务器压力都稳定，可以把 `MATCHES_SYNC_CRON` 调到更高频；但标准 cron 最小粒度是 1 分钟，秒级同步需要另做循环任务。
- 升级 football-data.org 套餐，提升数据完整度和同步频率。
