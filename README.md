# 猛健樂健康紀錄

這是一個手機優先的單頁網頁應用，可記錄：

- 用藥紀錄：日期、時間、劑量、備註
- 體重紀錄：每日體重、備註
- 檢驗紀錄：總膽固醇、HDL、LDL、三酸甘油脂、空腹血糖

## 使用方式

直接用瀏覽器開啟 `index.html` 即可使用。

如果你想從手機操作，最簡單的方式有兩種：

1. 將整個資料夾部署到靜態網站服務，例如 GitHub Pages、Netlify 或 Vercel。
2. 在家中電腦啟動本機伺服器，並讓手機連同一個 Wi-Fi 後用瀏覽器打開。

例如在這個資料夾執行：

```bash
python3 -m http.server 8080
```

之後用手機打開：

```text
http://你的電腦區網IP:8080
```

## 資料儲存

目前資料儲存在瀏覽器 `localStorage`，不會自動上傳到雲端。

建議定期使用畫面上的「匯出資料」功能，把資料存成 JSON 檔保留。

### 目前這種做法的特性

- 同一台裝置、同一個瀏覽器會保留資料
- 換手機、換瀏覽器、清除瀏覽器資料後，原本資料不會自動帶過去
- GitHub Pages 只負責「放網站」，不會幫你儲存每次輸入的資料

### 如果要手機與電腦同步

你可以考慮三種方案：

1. 最簡單：繼續用 `localStorage`，搭配手動匯出/匯入 JSON
2. 中等複雜度：接上 Firebase 或 Supabase，資料可跨裝置同步
3. 進階：做登入系統與資料庫後端

如果只是你自己日常紀錄，建議先用第 1 種；如果你希望手機和電腦都能看到同一份資料，下一步建議升級到 Firebase 或 Supabase。

## 部署到 GitHub Pages

### 1. 建立 GitHub repository

先在 GitHub 建一個新 repo，例如：

```text
mounjaro-tracker
```

### 2. 在這個資料夾執行

把下面的 `YOUR_GITHUB_NAME` 換成你的 GitHub 帳號，把 `mounjaro-tracker` 換成你實際 repo 名稱：

```bash
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_GITHUB_NAME/mounjaro-tracker.git
git push -u origin main
```

### 3. 在 GitHub 開啟 Pages

進入 repo 後：

1. 打開 `Settings`
2. 打開 `Pages`
3. 在 `Build and deployment` 中選 `Deploy from a branch`
4. Branch 選 `main`
5. Folder 選 `/ (root)`

幾分鐘後就會得到一個像下面的網址：

```text
https://YOUR_GITHUB_NAME.github.io/mounjaro-tracker/
```

手機直接打開這個網址就可以用。

## 建議的下一步

如果你要的不只是「把網站放上 GitHub」，而是希望資料真的能跨裝置同步，我建議下一步改做：

- GitHub Pages 負責前端頁面
- Firebase 或 Supabase 負責資料儲存

如果你要，我下一步可以直接幫你把這個專案升級成：

- `GitHub Pages + Firebase`
- 或 `GitHub Pages + Supabase`
