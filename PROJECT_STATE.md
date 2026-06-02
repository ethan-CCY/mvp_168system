# 專案交接記憶點

更新時間：2026-05-30

## 專案位置

```text
C:\Users\user\Desktop\Codex_test\mvp-system
```

## 目前目標

依照 `系統規格書_ERD_API清單.md` 建立本地端可運行 MVP，先供 5 人以下測試，測試 OK 後再考慮部署到雲端伺服器或其他平台。

## 技術棧

- Frontend：React + Vite
- Backend：Node.js + Express
- ORM：Prisma
- Database：PostgreSQL
- Auth：簡單 admin login + session token
- Icons：lucide-react

## 啟動方式

```powershell
cd C:\Users\user\Desktop\Codex_test\mvp-system
npm run dev
```

系統網址：

```text
http://127.0.0.1:5173
```

API：

```text
http://127.0.0.1:8000
```

預設帳密：

```text
admin / 使用 `.env` 的 `ADMIN_PASSWORD`
```

## 已完成

- PostgreSQL 資料庫 `incense_mvp`
- Prisma schema / migration / seed
- admin 登入、登出、me API
- 會員 CRUD 基礎功能
- 會員查詢、停用、顯示停用
- 會員匯款帳號後五碼
- 香品庫存調整
- 方案 CRUD 基礎功能
- 方案查詢、停用、顯示停用
- 報名新增、查詢、修改、取消
- 報名修改時可改方案與付款方式
- 報名付款方式切換時會處理香品扣抵回補/重新扣抵
- 匯款新增、查詢、修改、刪除
- 匯款自動比對會員後五碼
- 匯款分配到報名
- 每日報表
- 規格文件另存 UTF-8：`系統規格書_ERD_API清單_UTF8.md`

## 香品名稱

畫面顯示應使用：

- 財香
- 碧玉香
- 元寶香

內部欄位仍沿用英文：

- `fortuneIncense`
- `jadeIncense`
- `goldIngotIncense`

## 最近一次修正

使用者回報：「報名資料」按修改後沒有可修改「方案」或「方式」的選項。

已修正：

- 前端 `src/main.jsx`
  - 報名編輯時開放方案選擇
  - 報名編輯時開放付款方式選擇
  - 更新時送出 `plan_id`、`payment_method`

- 後端 `server/routes.js`
  - `PUT /api/registrations/:id` 支援更新方案與付款方式
  - 更新方案後同步更新 `expectedAmount`
  - 原本是香品扣抵時先回補
  - 新付款方式是香品扣抵時重新扣抵

驗證：

```text
npm run build 成功
```

## 建議下一步

- 將匯款分配從 `prompt` 改成正式 UI
- 會員銀行帳號新增/修改/刪除做成正式管理區
- 取消報名時，若原報名為香品扣抵，補上自動回補庫存
- 匯款刪除前檢查是否已有分配，避免誤刪
- 補操作紀錄 audit log
- 補 Excel 匯入/匯出
- 補 PostgreSQL 備份腳本

## 下次承接提示

下次開啟 Codex 時可直接輸入：

```text
請先讀取 C:\Users\user\Desktop\Codex_test\mvp-system\PROJECT_STATE.md，並承接上次進度。
```
