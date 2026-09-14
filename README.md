# 旅伴手帳

一個以 React、TypeScript、Vite、Tailwind CSS、FontAwesome 與 Supabase 製作的 Mobile-first 團體旅遊規劃 Web App。

## 1. 安裝套件

```bash
npm install
```

## 2. 啟動本機開發環境

先複製 `.env.example` 為 `.env.local`，填入 Supabase Project URL 及 publishable key。前端只可使用 publishable key，切勿加入 secret 或 service-role key。

```bash
npm run dev
```

終端機會顯示本機網址，使用瀏覽器開啟即可。

## 3. 建立正式版本

```bash
npm run build
```

完成後的 HTML、CSS、JavaScript 與圖片會輸出至 `dist/`。

## 功能

- 行程：日期橫向選擇、假想天氣、倒數、分類時間軸及地圖詳情。
- 預訂：登機證、住宿、租車資料，以及圖片／PDF 憑證管理。
- 記帳：HKD／JPY／USD 離線匯率估算、付款人及多人分攤。
- 準備：待辦及購物清單，可新增及勾選完成。
- 相片：集中上傳及查看旅程相片。
- 雲端分享：電郵登入、管理員自動同步、家庭成員只讀查看。

## 本機資料、雲端同步與私隱

- 資料以 `group-trip-planner:v1` 儲存在目前瀏覽器的 `localStorage`。
- 登入後仍需由使用者按「確認上傳並開始同步」，App 不會自行上傳原有本機資料。
- 首次上傳成功並讀回確認前，本機資料會一直保留作後備。
- 雲端相片及憑證儲存在 private Storage bucket，不會使用公開網址。
- `trips`、`trip_members` 及 Storage 均啟用 Row Level Security；匿名訪客無權讀取。
- 旅程管理員可以修改資料及加入家庭成員電郵；家庭帳戶只可查看。
- 憑證最多 6 份，單份不超過 900 KB，合計不超過 2 MB。

## 家庭分享流程

1. 管理員在 App 右上角按「登入分享」，建立帳戶並完成確認電郵。
2. 登入後按「確認上傳並開始同步」。
3. 在「家庭只讀成員」加入家人用來登入的電郵。
4. 家人用同一電郵建立及確認 Supabase 帳戶，登入後即可查看旅程。

本機開發時，如確認電郵未能返回 App，請在 Supabase Authentication 的 Redirect URLs 加入 `http://127.0.0.1:5174/**`。

## GitHub Pages 部署

正式網址：<https://florwing.github.io/travel_web/>。

推送 `main` 後，GitHub Actions 會安裝套件、建立 `dist/` 並部署。Repository 的 Actions variables 需要設定 `VITE_SUPABASE_URL` 和 `VITE_SUPABASE_PUBLISHABLE_KEY`；只可使用 Supabase publishable key，切勿設定 secret 或 service-role key。

在 Supabase Dashboard → Authentication → URL Configuration，將 Site URL 設為 `https://florwing.github.io/travel_web/`，並將同一網址加入 Redirect URLs。確認電郵會返回呢個路徑；本機開發網址可另外保留喺 Redirect URLs。
