import fs from 'node:fs';
import path from 'node:path';

// 年度選項，第一個視為「最新年度」，會對應到首頁 "/"
export const YEAR_OPTIONS = [2026, 2025, 2024, 2023, 2022];
export const LATEST_YEAR = YEAR_OPTIONS[0];

/**
 * 在 build 時（伺服器端 / Node 環境）讀取指定年度的 JSON 資料檔案。
 * 資料檔案請放在 src/data/ironman_{year}_list_all_pages.json，
 * 原因：src/ 底下的檔案只會在 build 階段被讀取、打包進靜態 HTML，
 * 不會像 public/ 一樣被當成可直接下載的靜態資源曝露出去，
 * 也不需要再靠瀏覽器端 fetch 才能拿到資料。
 *
 * @param {number} year
 * @returns {{ contestants: Array, themeOptions: string[], totalCount: string|number }}
 */
export function loadYearData(year) {
    const filePath = path.resolve(`./src/data/ironman_${year}_list_all_pages.json`);

    let fullData;
    try {
        const raw = fs.readFileSync(filePath, 'utf-8');
        fullData = JSON.parse(raw);
    } catch (err) {
        // build 時就直接失敗，比部署後才在瀏覽器發現資料錯誤更早發現問題
        throw new Error(
            `讀取 ${year} 年資料失敗，請確認 src/data/ironman_${year}_list_all_pages.json 是否存在且格式正確。原始錯誤: ${err.message}`
        );
    }

    const mainKey = Object.keys(fullData).find((k) => k.includes('鐵人賽'));
    const appData = mainKey ? fullData[mainKey] : null;

    if (!appData || !appData['參賽者名單_完整列表']) {
        throw new Error(`${year} 年 JSON 結構異常：找不到頂層數據鍵或參賽者列表。`);
    }

    const contestants = appData['參賽者名單_完整列表'] || [];
    const themeOptions = (appData['主題組別_下拉選單'] || [])
        .map((item) => item.主題名稱)
        .filter(Boolean);
    const totalCount = appData['總參賽人數_所有組別'] || 'N/A';

    return { contestants, themeOptions, totalCount };
}
