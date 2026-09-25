# iThome 鐵人賽觀測站：從 Vite + React 遷移到 Astro + React

本文件記錄這次把專案從 **Vite + React (CSR)** 重建為 **Astro + React + Tailwind CSS v4** 的過程與原因，供之後回顧或其他協作者參考。

## 為什麼要遷移

原本的 Vite + React 專案是純前端渲染（CSR）：

- 瀏覽器打開網站後，才由 `useEffect` 發送 `fetch` 請求，向 `public/json/` 底下的靜態 JSON 檔案要資料
- 搜尋引擎爬蟲（Googlebot）在某些情況下無法完整等待這個非同步過程，導致實際收錄到的內容是**載入中或錯誤畫面**，而不是真正的資料表格
- 在 Google 搜尋 `site:` 網址時，摘要顯示的就是應用程式的錯誤訊息，而不是正常的網站內容

改用 Astro 的目的，是讓資料在 **build 階段**就直接寫進靜態 HTML，使用者與搜尋引擎打開頁面時，內容一開始就是完整的，不需要等待 JS 執行、也不會有 fetch 失敗被收錄的風險。

## 技術棧異動

| 項目     | 原本 (Vite)                              | 現在 (Astro)                                                            |
| -------- | ---------------------------------------- | ----------------------------------------------------------------------- |
| 建置工具 | Vite                                     | Astro                                                                   |
| 渲染方式 | CSR（瀏覽器端渲染）                      | SSG（build 時預先渲染成靜態 HTML）                                      |
| 資料來源 | 瀏覽器 `fetch` 讀取 `public/json/*.json` | build 時用 Node `fs.readFileSync` 讀取 `src/data/*.json`，直接寫入 HTML |
| UI 框架  | React                                    | React（作為 Astro 的 Island 元件）                                      |
| 樣式     | Tailwind CSS                             | Tailwind CSS v4（改用 `@tailwindcss/vite` 整合）                        |

## 專案結構

```
src/
  components/
    ContestantExplorer.jsx   互動元件（搜尋、篩選、分頁），以 Astro island 的形式掛載
    Icons.jsx                內嵌 SVG icon
  layouts/
    Layout.astro             共用版面配置，處理 title / description / OG meta 等 SEO 標籤
  pages/
    index.astro               首頁，build 時載入所有年度資料
  utils/
    loadYearData.js           build 時讀取指定年度 JSON 的共用函式
  data/
    ironman_2022_list_all_pages.json
    ironman_2023_list_all_pages.json
    ironman_2024_list_all_pages.json
    ironman_2025_list_all_pages.json
    ironman_2026_list_all_pages.json
public/
  robots.txt
  sitemap.xml
astro.config.mjs
```

## 遷移步驟摘要

### 1. 建立 Astro 專案

```bash
npm create astro@latest
```

互動選單選擇 **`A basic, helpful starter project (recommended)`**（basic starter 提供最小可運作骨架，不像 blog / docs 範本帶有用不到的結構）。

### 2. 加入 React 整合

```bash
npx astro add react
```

### 3. 導入 Tailwind CSS v4

Tailwind v4 改用官方 Vite 插件的方式整合，不是透過 Astro 官方的 `@astrojs/tailwind`（那是給 v3 用的）。

安裝：

```bash
npm install tailwindcss @tailwindcss/vite
```

`astro.config.mjs`：

```javascript
import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
    site: "https://ithome-watcher-station.vercel.app",
    integrations: [react()],
    vite: {
        plugins: [tailwindcss()],
    },
});
```

全域 CSS（例如 `src/styles/global.css`）使用 v4 語法：

```css
@import "tailwindcss";
```

並在 `Layout.astro` 引入一次：

```astro
---
import '../styles/global.css';
---
```

### 4. 資料改為 build 時讀取，不再由瀏覽器 fetch

把 JSON 檔案從 `public/json/` 搬到 `src/data/`，並建立 `loadYearData.js` 在 build 階段讀取：

```javascript
// src/utils/loadYearData.js
import fs from "node:fs";
import path from "node:path";

export const YEAR_OPTIONS = [2026, 2025, 2024, 2023, 2022];

export function loadYearData(year) {
    const filePath = path.resolve(
        `./src/data/ironman_${year}_list_all_pages.json`,
    );
    const raw = fs.readFileSync(filePath, "utf-8");
    const fullData = JSON.parse(raw);
    const mainKey = Object.keys(fullData).find((k) => k.includes("鐵人賽"));
    const appData = fullData[mainKey];

    return {
        contestants: appData["參賽者名單_完整列表"] || [],
        themeOptions: (appData["主題組別_下拉選單"] || [])
            .map((i) => i.主題名稱)
            .filter(Boolean),
        totalCount: appData["總參賽人數_所有組別"] || "N/A",
    };
}
```

`src/data/` 底下的檔案只會在 build 階段被讀取、打包進靜態 HTML，不會像 `public/` 一樣被當成可直接下載的公開資源曝露網址。

### 5. 首頁一次載入所有年度資料

`index.astro` 在 build 時把 5 個年度的資料都讀出來，組成 `dataByYear` 物件，一次傳給 React 元件：

```astro
---
import { loadYearData, YEAR_OPTIONS } from '../utils/loadYearData.js';

const dataByYear = {};
for (const year of YEAR_OPTIONS) {
    dataByYear[year] = loadYearData(year);
}
---
<ContestantExplorer client:load dataByYear={dataByYear} years={YEAR_OPTIONS} />
```

年度切換維持單一頁面（不換網址），改用 React state 從 `dataByYear` 裡取對應年度的資料，不需要瀏覽器再另外發 fetch 請求。

### 6. SEO 相關調整

- `Layout.astro` 統一管理 `<title>`、`<meta name="description">`、Open Graph、Twitter Card 等標籤，每頁可傳入不同內容
- `<html lang="zh-Hant">`
- 頁面加入一段可見的簡介文字，說明網站彙整 2022–2026 年歷屆鐵人賽參賽者文章，讓搜尋引擎與使用者都能快速理解網站定位
- 錯誤畫面不再直接顯示技術除錯訊息（例如原始的 `err.message`），改為對使用者友善的提示文字
- 補上 `robots.txt` 與 `sitemap.xml`

## 驗證方式

1. `npm run dev` 本機測試功能是否正常
2. `npm run build && npm run preview` 確認 build 產出正常
3. 用瀏覽器「檢視網頁原始碼」（Ctrl+U）確認資料表格內容**確實寫在原始 HTML 裡**，不需要等待 JS 執行才出現
4. 部署後於 Google Search Console 使用「網址檢查工具」要求重新建立索引

## 目前沒有做到、之後可以改進的項目

- **未以年度為單位做成獨立路由**：原本規劃是 `/2026`、`/2025`、`/2024`... 每個年度一個獨立網址，這樣搜尋引擎可以個別索引各年度內容，對「搜尋特定年度技術趨勢」這類需求會更有幫助。目前為了先確保遷移後網站能穩定運作，改回單一首頁、用 React state 切換年度的做法。之後如果要重新導入年度路由，需要處理「首頁內容與其中一個年度頁面重複」時的 canonical 設定，避免重複內容問題。

- **icon 套件改用內嵌 SVG，而非套件**：原本使用 `lucide-react`，但在 Astro SSR 環境下匯入時一直出現匯出解析失敗的問題，一時排查不出根本原因。為了先讓網站恢復正常運作，暫時改成 `src/components/Icons.jsx` 裡手刻的內嵌 SVG 取代，圖示樣式跟 `lucide-react` 大致相同，但數量有限、之後如果需要更多圖示得手動新增。有空的話可以再研究 `lucide-react` 在 Astro 下的正確設定方式，或改用其他對 SSR 更友善的 icon 套件。

## 部署

專案為純靜態輸出（Astro 預設 `output: 'static'`），部署到 Vercel 不需要額外的 adapter，直接使用預設的 build 設定即可。

---

_本文由 Claude 產生，如有錯誤歡迎指正。_
