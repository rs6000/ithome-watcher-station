import React, { useState, useEffect, useMemo } from 'react';
import { Search, ChevronDown, Award, Users, BookOpen, Calendar, Github, ChevronLeft, ChevronRight } from './Icons.jsx';

/**
 * 修正 / 遷移摘要
 * ------------------------------------------------------------
 * - 資料不再於瀏覽器端 fetch，改由 Astro 頁面在 build 時一次讀取
 *   所有年度的 JSON，組成 dataByYear = { 2026: {...}, 2025: {...} }
 *   傳入本元件。因此原本的 isLoading / error / useEffect fetch 邏輯
 *   已移除 —— 資料一開始就存在，靜態 HTML 內容即已完整，
 *   解決了先前 Google 收錄到「Failed to fetch」錯誤畫面的問題。
 * - 年度切換：維持單一頁面（不換網址），改回用 React state
 *   (selectedYear) 切換要顯示哪個年度的資料，資料本身已經在
 *   dataByYear 裡準備好，不需要再另外 fetch。
 * - 新增分頁功能：每頁固定顯示 50 筆，篩選/搜尋/切換年度時自動重設回第 1 頁。
 * - 列表 key 改用 getContestantKey()，不再使用陣列 index。
 * - 外部連結（參賽者URL / 題目URL）為空時改渲染純文字，不再產生指向 "#" 的連結。
 * ------------------------------------------------------------
 */

const PROGRESS_FILTER = {
    ALL: '所有',
    COMPLETED: '完賽',
    INTERRUPTED: '中斷',
    MISSING: '失蹤',
};

const ITEMS_PER_PAGE = 50;

const getSortableProgress = (progress) => {
    if (!progress || progress === '尚未開賽') {
        return -1;
    }
    const match = progress.match(/DAY\s*(\d+)|完賽/i);
    if (match) {
        if (match[1]) {
            return parseInt(match[1], 10);
        } else if (progress.includes('完賽')) {
            return 30;
        }
    }
    return 0;
};

const getContestantStatus = (progressValue) => {
    if (progressValue >= 30) return PROGRESS_FILTER.COMPLETED;
    if (progressValue > 0 && progressValue < 30) return PROGRESS_FILTER.INTERRUPTED;
    return PROGRESS_FILTER.MISSING;
};

const getContestantKey = (c) => {
    return (
        c.參賽者URL ||
        c.題目URL ||
        `${c.主題 || ''}-${c.參賽者名稱 || ''}-${c.題目 || ''}`
    );
};

/**
 * 產生分頁按鈕要顯示的頁碼陣列，超過範圍的部分用 '...' 表示省略。
 * 例如 (currentPage=5, totalPages=10) => [1, '...', 4, 5, 6, '...', 10]
 */
const getPageNumbers = (currentPage, totalPages) => {
    const delta = 1;
    const pages = [];
    for (let i = 1; i <= totalPages; i++) {
        if (i === 1 || i === totalPages || (i >= currentPage - delta && i <= currentPage + delta)) {
            pages.push(i);
        }
    }
    const withEllipsis = [];
    let prev = null;
    for (const p of pages) {
        if (prev !== null && p - prev > 1) {
            withEllipsis.push('...');
        }
        withEllipsis.push(p);
        prev = p;
    }
    return withEllipsis;
};

const ContestantExplorer = ({ dataByYear, years }) => {
    // years[0] 視為預設顯示的最新年度
    const [selectedYear, setSelectedYear] = useState(years[0]);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedTheme, setSelectedTheme] = useState('所有組別');
    const [selectedProgressFilter, setSelectedProgressFilter] = useState(PROGRESS_FILTER.ALL);
    const [currentPage, setCurrentPage] = useState(1);

    // 目前選中年度對應的資料，已經在 build 時準備好，這裡直接取用即可
    const { contestants, themeOptions: rawThemeOptions, totalCount } = dataByYear[selectedYear] || {
        contestants: [],
        themeOptions: [],
        totalCount: 'N/A',
    };

    const themeOptions = useMemo(() => ['所有組別', ...(rawThemeOptions || [])], [rawThemeOptions]);

    const progressCounts = useMemo(() => {
        const counts = {
            [PROGRESS_FILTER.COMPLETED]: 0,
            [PROGRESS_FILTER.INTERRUPTED]: 0,
            [PROGRESS_FILTER.MISSING]: 0,
        };
        const themeFilteredList = contestants.filter(
            (c) => selectedTheme === '所有組別' || c.主題 === selectedTheme
        );
        themeFilteredList.forEach((c) => {
            const status = getContestantStatus(getSortableProgress(c.進度));
            counts[status]++;
        });
        return counts;
    }, [contestants, selectedTheme]);

    const filteredContestants = useMemo(() => {
        let list = contestants.filter((c) => {
            const themeMatch = selectedTheme === '所有組別' || c.主題 === selectedTheme;
            const searchLower = searchTerm.toLowerCase();
            const searchMatch =
                c.參賽者名稱?.toLowerCase().includes(searchLower) ||
                c.題目?.toLowerCase().includes(searchLower) ||
                c.題目簡介?.toLowerCase().includes(searchLower) ||
                c.主題?.toLowerCase().includes(searchLower);
            const status = getContestantStatus(getSortableProgress(c.進度));
            const progressMatch = selectedProgressFilter === PROGRESS_FILTER.ALL || status === selectedProgressFilter;
            return themeMatch && searchMatch && progressMatch;
        });

        list.sort((a, b) => getSortableProgress(b.進度) - getSortableProgress(a.進度));
        return list;
    }, [contestants, searchTerm, selectedTheme, selectedProgressFilter]);

    // 篩選/搜尋條件或年度改變時，自動重設回第 1 頁，避免停留在超出範圍的頁碼
    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, selectedTheme, selectedProgressFilter, selectedYear]);

    const totalPages = Math.max(1, Math.ceil(filteredContestants.length / ITEMS_PER_PAGE));
    const safeCurrentPage = Math.min(currentPage, totalPages);

    const paginatedContestants = useMemo(() => {
        const start = (safeCurrentPage - 1) * ITEMS_PER_PAGE;
        return filteredContestants.slice(start, start + ITEMS_PER_PAGE);
    }, [filteredContestants, safeCurrentPage]);

    const handleProgressFilterClick = (filter) => {
        setSelectedProgressFilter((current) => (current === filter ? PROGRESS_FILTER.ALL : filter));
    };

    // 年度切換：維持單頁，改用 state 切換，並重設其他篩選條件
    const handleYearChange = (e) => {
        setSelectedYear(Number(e.target.value));
        setSelectedTheme('所有組別');
        setSelectedProgressFilter(PROGRESS_FILTER.ALL);
        setSearchTerm('');
    };

    const goToPage = (page) => {
        if (page < 1 || page > totalPages) return;
        setCurrentPage(page);
        // 換頁時捲動回列表頂端，體驗較好
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const pageNumbers = getPageNumbers(safeCurrentPage, totalPages);

    return (
        <div className="min-h-screen flex flex-col bg-gray-50 font-inter">
            <header className="sticky top-0 z-10 w-full bg-white shadow-md">
                <div className="max-w-[1280px] mx-auto w-full p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center rounded-b-xl">
                    <h1 className="text-3xl font-extrabold text-indigo-700 tracking-tight">
                        iThome 鐵人賽 {selectedYear} 參賽名單
                    </h1>
                    <div className="mt-2 sm:mt-0 flex items-center text-gray-600">
                        <Users className="w-5 h-5 mr-1 text-indigo-500" />
                        <span className="font-semibold text-lg">
                            總報名人數: <span className="text-indigo-600">{totalCount}</span>
                        </span>
                    </div>
                </div>
            </header>

            <main className="flex-grow max-w-[1280px] mx-auto p-4 sm:p-6 pt-2 w-full">
                <div className="bg-white p-4 rounded-xl shadow-lg mb-6 flex flex-col md:flex-row gap-4">
                    <div className="relative flex-grow">
                        <label htmlFor="search-input" className="sr-only">搜尋參賽者、題目或組別</label>
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <input
                            id="search-input"
                            type="text"
                            placeholder="搜尋參賽者、題目或組別..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 transition duration-150"
                        />
                    </div>

                    <div className="relative md:w-56">
                        <label htmlFor="theme-select" className="sr-only">選擇主題組別</label>
                        <select
                            id="theme-select"
                            value={selectedTheme}
                            onChange={(e) => {
                                setSelectedTheme(e.target.value);
                                setSelectedProgressFilter(PROGRESS_FILTER.ALL);
                            }}
                            className="w-full appearance-none bg-white border border-gray-300 rounded-lg py-2 pl-3 pr-10 focus:ring-indigo-500 focus:border-indigo-500 transition duration-150 cursor-pointer text-gray-900"
                        >
                            {themeOptions.map((theme) => (
                                <option key={theme} value={theme}>{theme}</option>
                            ))}
                        </select>
                        <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
                    </div>
                </div>

                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 gap-3">
                    <div className="flex items-center gap-2">
                        <Calendar className="w-5 h-5 text-indigo-500" />
                        <label htmlFor="year-select" className="sr-only">選擇年度</label>
                        <div className="relative">
                            <select
                                id="year-select"
                                value={selectedYear}
                                onChange={handleYearChange}
                                className="w-full appearance-none bg-white border border-gray-300 rounded-lg py-1.5 pl-3 pr-8 focus:ring-indigo-500 focus:border-indigo-500 transition duration-150 cursor-pointer text-sm font-semibold text-gray-900"
                            >
                                {years.map((y) => (
                                    <option key={y} value={y}>{y} 年</option>
                                ))}
                            </select>
                            <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
                        </div>
                    </div>

                    <p className="text-gray-600 text-sm font-medium flex-shrink-0">
                        共 <span className="font-bold text-indigo-600">{filteredContestants.length}</span> 筆記錄，
                        目前第 <span className="font-bold text-indigo-600">{safeCurrentPage}</span> / {totalPages} 頁
                        <span className="text-xs text-gray-400 ml-2">(已按進度降序排列)</span>
                    </p>

                    <div className="flex flex-wrap gap-2 text-sm">
                        <button
                            onClick={() => handleProgressFilterClick(PROGRESS_FILTER.COMPLETED)}
                            className={`px-3 py-1 rounded-full font-semibold transition duration-150 ${selectedProgressFilter === PROGRESS_FILTER.COMPLETED ? 'bg-green-600 text-white shadow-md' : 'bg-green-100 text-green-800 hover:bg-green-200'}`}
                        >
                            完賽人數: {progressCounts[PROGRESS_FILTER.COMPLETED]}
                        </button>
                        <button
                            onClick={() => handleProgressFilterClick(PROGRESS_FILTER.INTERRUPTED)}
                            className={`px-3 py-1 rounded-full font-semibold transition duration-150 ${selectedProgressFilter === PROGRESS_FILTER.INTERRUPTED ? 'bg-orange-600 text-white shadow-md' : 'bg-orange-100 text-orange-800 hover:bg-orange-200'}`}
                        >
                            中斷: {progressCounts[PROGRESS_FILTER.INTERRUPTED]}
                        </button>
                        <button
                            onClick={() => handleProgressFilterClick(PROGRESS_FILTER.MISSING)}
                            className={`px-3 py-1 rounded-full font-semibold transition duration-150 ${selectedProgressFilter === PROGRESS_FILTER.MISSING ? 'bg-red-600 text-white shadow-md' : 'bg-red-100 text-red-800 hover:bg-red-200'}`}
                        >
                            失蹤: {progressCounts[PROGRESS_FILTER.MISSING]}
                        </button>
                    </div>
                </div>

                <div className="hidden sm:block overflow-x-auto shadow-xl rounded-xl">
                    <table className="min-w-full divide-y divide-gray-200 bg-white">
                        <thead className="bg-indigo-600 text-white">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider rounded-tl-xl">主題組別</th>
                                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider">參賽者</th>
                                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider">題目名稱</th>
                                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider">進度</th>
                                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider rounded-tr-xl">報名日期</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-100">
                            {paginatedContestants.map((c) => (
                                <tr key={getContestantKey(c)} className="hover:bg-indigo-50 transition duration-100">
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-indigo-100 text-indigo-800">
                                            {c.主題}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="flex items-center">
                                            <div className="flex-shrink-0 h-8 w-8">
                                                <img
                                                    className="h-8 w-8 rounded-full object-cover"
                                                    src={c.圖像URL}
                                                    alt={c.參賽者名稱}
                                                    onError={(e) => { e.target.onerror = null; e.target.src = 'https://placehold.co/100x100/CCCCCC/666666?text=N/A'; }}
                                                />
                                            </div>
                                            <div className="ml-3">
                                                {c.參賽者URL ? (
                                                    <a href={c.參賽者URL} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-gray-900 hover:text-indigo-600 transition">
                                                        {c.參賽者名稱}
                                                    </a>
                                                ) : (
                                                    <span className="text-sm font-medium text-gray-900">{c.參賽者名稱}</span>
                                                )}
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        {c.題目URL ? (
                                            <a href={c.題目URL} target="_blank" rel="noopener noreferrer" className="text-sm text-indigo-600 hover:text-indigo-800 hover:underline transition duration-150 truncate max-w-xs block" title={c.題目}>
                                                {c.題目}
                                            </a>
                                        ) : (
                                            <span className="text-sm text-gray-700 truncate max-w-xs block" title={c.題目}>{c.題目}</span>
                                        )}
                                        <p className="text-xs text-gray-500 mt-1 line-clamp-1">{c.題目簡介}</p>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className={`text-sm font-semibold ${getContestantStatus(getSortableProgress(c.進度)) === PROGRESS_FILTER.COMPLETED ? 'text-green-600' : getContestantStatus(getSortableProgress(c.進度)) === PROGRESS_FILTER.INTERRUPTED ? 'text-orange-500' : 'text-red-500'}`}>
                                            {c.進度}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {c.報名日期?.split(' ')[0]}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <div className="sm:hidden grid grid-cols-1 gap-4">
                    {paginatedContestants.map((c) => {
                        const status = getContestantStatus(getSortableProgress(c.進度));
                        let borderColor = 'border-indigo-500';
                        if (status === PROGRESS_FILTER.COMPLETED) borderColor = 'border-green-500';
                        else if (status === PROGRESS_FILTER.INTERRUPTED) borderColor = 'border-orange-500';
                        else if (status === PROGRESS_FILTER.MISSING) borderColor = 'border-red-500';

                        return (
                            <div key={getContestantKey(c)} className={`bg-white p-4 rounded-xl shadow-lg border-l-4 ${borderColor}`}>
                                <div className="flex justify-between items-start mb-2">
                                    <span className="px-3 py-1 inline-flex text-sm font-semibold rounded-full bg-indigo-100 text-indigo-800">
                                        {c.主題}
                                    </span>
                                    <span className={`text-sm font-bold ${status === PROGRESS_FILTER.COMPLETED ? 'text-green-600' : status === PROGRESS_FILTER.INTERRUPTED ? 'text-orange-500' : 'text-red-500'}`}>
                                        {c.進度}
                                    </span>
                                </div>
                                <h2 className="text-lg font-bold text-gray-900 mb-1 flex items-center">
                                    <Users className="w-4 h-4 mr-2 text-indigo-500" />
                                    {c.參賽者URL ? (
                                        <a href={c.參賽者URL} target="_blank" rel="noopener noreferrer" className="hover:text-indigo-600 transition">
                                            {c.參賽者名稱}
                                        </a>
                                    ) : (
                                        <span>{c.參賽者名稱}</span>
                                    )}
                                </h2>
                                <p className="text-base text-gray-700 mb-2 font-medium flex items-start">
                                    <BookOpen className="w-4 h-4 mr-2 text-indigo-500 mt-1 flex-shrink-0" />
                                    {c.題目URL ? (
                                        <a href={c.題目URL} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline line-clamp-2">
                                            {c.題目}
                                        </a>
                                    ) : (
                                        <span className="line-clamp-2">{c.題目}</span>
                                    )}
                                </p>
                                <p className="text-xs text-gray-500 border-t pt-2 mt-2">
                                    報名日期: {c.報名日期?.split(' ')[0]}
                                </p>
                            </div>
                        );
                    })}
                </div>

                {filteredContestants.length === 0 && (
                    <div className="text-center py-10 text-gray-500">
                        <Award className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                        <p className="text-xl font-semibold">未找到任何記錄。</p>
                        <p>請嘗試調整您的搜尋關鍵字或篩選條件。</p>
                    </div>
                )}

                {/* --- 分頁控制項：每頁固定 50 筆 --- */}
                {totalPages > 1 && (
                    <nav className="flex justify-center items-center gap-1 mt-8 mb-4" aria-label="分頁">
                        <button
                            onClick={() => goToPage(safeCurrentPage - 1)}
                            disabled={safeCurrentPage === 1}
                            className="p-2 rounded-lg border border-gray-300 bg-white text-gray-600 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition"
                            aria-label="上一頁"
                        >
                            <ChevronLeft className="w-4 h-4" />
                        </button>

                        {pageNumbers.map((p, idx) =>
                            p === '...' ? (
                                <span key={`ellipsis-${idx}`} className="px-2 text-gray-400">...</span>
                            ) : (
                                <button
                                    key={p}
                                    onClick={() => goToPage(p)}
                                    aria-current={p === safeCurrentPage ? 'page' : undefined}
                                    className={`min-w-[36px] px-3 py-2 rounded-lg text-sm font-semibold transition ${
                                        p === safeCurrentPage
                                            ? 'bg-indigo-600 text-white shadow-md'
                                            : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-100'
                                    }`}
                                >
                                    {p}
                                </button>
                            )
                        )}

                        <button
                            onClick={() => goToPage(safeCurrentPage + 1)}
                            disabled={safeCurrentPage === totalPages}
                            className="p-2 rounded-lg border border-gray-300 bg-white text-gray-600 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition"
                            aria-label="下一頁"
                        >
                            <ChevronRight className="w-4 h-4" />
                        </button>
                    </nav>
                )}
            </main>

            <footer className="w-full bg-gray-100 border-t border-gray-200 mt-8 flex-shrink-0">
                <div className="max-w-[1280px] mx-auto p-6 text-center text-sm text-gray-600">
                    <p className="mb-3 font-semibold text-gray-700">
                        iThome 鐵人賽觀測站 (Iron Man Watcher Station)
                    </p>
                    <p className="mb-2 max-w-xl mx-auto text-xs sm:text-sm">
                        此應用程式旨在提供更友善、多年度的鐵人賽數據篩選與進度追蹤介面。
                    </p>
                    <div className="flex justify-center items-center gap-4 text-xs sm:text-sm">
                        <a
                            href="https://ithelp.ithome.com.tw/2026ironman/signup/list"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-indigo-600 hover:text-indigo-800 hover:underline font-medium"
                        >
                            iThome 鐵人賽官網
                        </a>
                        <span className="text-gray-400">|</span>
                        <a href="https://github.com/rs6000/" target="_blank" rel="noopener noreferrer" className="text-gray-600 hover:text-indigo-600 transition flex items-center">
                            <Github className="w-4 h-4 mr-1" /> 我的 GitHub
                        </a>
                        <span className="text-gray-400">|</span>
                        <span className="text-gray-500">
                            📦 Made with ❤️ MIT License © 2026
                        </span>
                    </div>
                    <p className="mt-4 text-xs text-gray-400">
                        免責聲明：所有數據均為公開資訊，資料抓取可能存在延遲或錯誤。
                    </p>
                </div>
            </footer>
        </div>
    );
};

export default ContestantExplorer;
