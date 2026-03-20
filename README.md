# 猛健樂用藥紀錄

這是一個手機優先的單頁網頁應用，可記錄：

- 用藥紀錄：日期、時間、劑量、施打位置
- 體重紀錄：日期、時間、每日體重
- 檢驗紀錄：總膽固醇、HDL、LDL、三酸甘油脂、空腹血糖

## 目前版本

這個專案現在支援兩種模式：

1. 本機模式：資料存瀏覽器 `localStorage`
2. Supabase 模式：資料存雲端資料庫，可跨裝置同步，並透過 Email + 密碼登入隔離每位使用者資料

如果 `config.js` 沒有填 Supabase 金鑰，網站會自動使用本機模式。

## 本機使用

直接用瀏覽器開啟 `index.html` 即可。

如果要讓手機在同一個 Wi-Fi 下開啟，可在這個資料夾執行：

```bash
python3 -m http.server 8080
```

然後在手機打開：

```text
http://你的電腦區網IP:8080
```

## Cloudflare Pages + Supabase

這是目前最適合多人共用的部署方式：

- Cloudflare Pages：放前端網站
- Supabase：儲存共用資料

## 第 1 步：建立 Supabase 專案

1. 到 [Supabase](https://supabase.com/) 註冊並登入
2. 建立一個新 project
3. 選擇地區
4. 設定 database password
5. 等專案建立完成

## 第 2 步：建立資料表

1. 進入 Supabase project
2. 打開 `SQL Editor`
3. 新增一個 query
4. 把 [supabase-schema.sql](/Users/CYHsieh/Desktop/猛間樂減重紀錄/supabase-schema.sql) 的內容整份貼上
5. 按 `Run`

這份 SQL 會建立：

- `medications`
- `weights`
- `labs`

目前策略是「登入後只看自己的資料」：

- 每一筆資料都會綁定登入者
- 使用者登入後只會看到自己的用藥、體重與檢驗紀錄
- 適合多人一起使用同一個網站

## 第 3 步：啟用 Email 登入與取得 Supabase 金鑰

到 Supabase project 的：

- `Authentication`
- `Sign In / Providers`

請確認：

- `Email`
- `Enable Email provider`
- `Confirm email` 建議保持開啟

然後再到：

- `Authentication`
- `URL Configuration`

請把 `Site URL` 設成你之後部署好的網站網址，例如：

```text
https://mounjaro-tracker.pages.dev
```

如果你會同時用本機測試，也可以把下面網址加進 `Redirect URLs`：

```text
http://localhost:8080
http://localhost:8081
```

然後再到：

- `Settings`
- `API Keys`

記下兩個值：

1. `Project URL`
2. `Publishable key`

## 第 4 步：填入前端設定

打開 [config.js](/Users/CYHsieh/Desktop/猛間樂減重紀錄/config.js)，把內容改成：

```js
window.APP_CONFIG = {
  supabase: {
    url: "https://YOUR_PROJECT_ID.supabase.co",
    anonKey: "YOUR_SUPABASE_PUBLISHABLE_KEY",
  },
};
```

如果你想保留一份範例，可以參考 [config.example.js](/Users/CYHsieh/Desktop/猛間樂減重紀錄/config.example.js)。

## 第 5 步：建立 Git repository

在這個資料夾執行：

```bash
git add .
git commit -m "Initial commit"
```

如果 git 還沒設定名稱與 email，先執行：

```bash
git config --global user.name "你的名字"
git config --global user.email "你的Email"
```

然後再重新執行 commit。

## 第 6 步：建立 GitHub repository

1. 到 [GitHub](https://github.com/)
2. 建立新的 repository
3. 假設 repo 名稱叫：

```text
mounjaro-tracker
```

## 第 7 步：推到 GitHub

把下面的 `YOUR_GITHUB_NAME` 換成你的 GitHub 帳號：

```bash
git branch -M main
git remote add origin https://github.com/YOUR_GITHUB_NAME/mounjaro-tracker.git
git push -u origin main
```

## 第 8 步：部署到 Cloudflare Pages

1. 到 [Cloudflare Pages](https://pages.cloudflare.com/)
2. 登入 Cloudflare
3. 按 `Create a project`
4. 選 `Connect to Git`
5. 連接 GitHub
6. 選你剛建立的 `mounjaro-tracker`
7. Build 設定：

```text
Framework preset: None
Build command: 留空
Build output directory: /
```

8. 按 `Save and Deploy`

部署完成後，你會得到一個 Cloudflare Pages 網址，手機直接打開即可。

## 資料存在哪裡

### 如果沒有設定 Supabase

資料存在每台裝置自己的瀏覽器：

- 手機資料只在手機
- 電腦資料只在電腦
- 不會自動同步

### 如果有設定 Supabase

資料存在 Supabase 雲端資料庫：

- 手機和電腦可共用
- 每位同事登入後只會看到自己的資料
- 不再依賴單一裝置的瀏覽器

## 目前最重要的注意事項

這個版本的 Supabase 設定是「Email + 密碼登入」。

意思是：

- 使用者可用 Email 與密碼註冊
- 之後直接用 Email 與密碼登入
- 登入後只會讀寫自己的資料
- 不需要每次都寄登入連結
- 仍然不需要設定 Google Cloud Console

如果你接下來要正式給同事使用，我建議下一步做：

1. 加登入
2. 每位使用者只看自己的資料
3. 管理者可看全部

## 下一步

如果你要，我下一步可以直接幫你做其中一個：

1. 把 `config.js` 改成更安全的部署方式
2. 加上 Supabase 登入
3. 改成每位同事只看自己的資料
