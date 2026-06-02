# 後台管理系統 MVP

本專案是依照 `系統規格書_ERD_API清單.md` 建立的第一版本地端 MVP，包含：

- React 前端管理介面
- Express REST API
- Prisma 資料模型
- PostgreSQL 資料庫
- 簡單 admin 登入

## 技術棧

- Node.js
- React + Vite
- Express
- Prisma ORM
- PostgreSQL

## 本地啟動

### 1. 安裝依賴

```bash
npm install
```

### 2. 建立環境變數

複製 `.env.example` 為 `.env`，並依照你的 PostgreSQL 帳密調整：

```env
DATABASE_URL="postgresql://YOUR_DB_USER:YOUR_DB_PASSWORD@localhost:5432/incense_mvp?schema=public"
PORT=8000
WEB_ORIGIN="http://127.0.0.1:5173"
ADMIN_USERNAME=admin
ADMIN_PASSWORD=CHANGE_ME_STRONG_PASSWORD
```

### 3. 建立 PostgreSQL 資料庫

請先在本機 PostgreSQL 建立資料庫：

```sql
CREATE DATABASE incense_mvp;
```

請依照你的 PostgreSQL 使用者與密碼修改 `.env` 的 `DATABASE_URL`。

### 4. 建立資料表

```bash
npm run prisma:migrate
```

### 5. 建立初始 admin 與預設方案

```bash
npm run seed
```

預設登入：

```text
帳號：admin
密碼：使用你在 `.env` 設定的 `ADMIN_PASSWORD`
```

### 6. 啟動系統

```bash
npm run dev
```

啟動後：

- 前端：http://127.0.0.1:5173
- API：http://127.0.0.1:8000

## 第一版功能

- Admin 登入 / 登出 / session 驗證
- 會員管理
- 會員匯款帳號後五碼
- 香品庫存手動調整
- 方案管理
- 報名建立
- 香品扣抵報名時自動扣庫存
- 匯款建立與會員自動比對
- 匯款分配到報名
- 每日參加報表
- 未付款與溢付 API

## API

主要 API prefix：

```text
/api
```

例如：

```text
POST /api/auth/login
GET  /api/members
POST /api/registrations
GET  /api/reports/daily-participations?date=2026-06-05
```

## 後續建議

第一版確認流程後，下一步建議補：

- 更完整的表單驗證
- 匯款分配的專用 UI，不使用 prompt
- Excel 匯入 / 匯出
- 操作紀錄 audit log
- 取消報名時自動回補香品庫存
- PostgreSQL 備份腳本
