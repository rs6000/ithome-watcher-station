// 這個檔案取代 lucide-react。
// 原因：lucide-react 在 Astro SSR (Node) 環境下的具名匯出解析不穩定，
// 多次調整 vite.ssr.noExternal / optimizeDeps.include 都無法穩定解決，
// 乾脆改用最單純的內嵌 SVG，不依賴任何第三方 icon 套件，徹底排除這個問題。
//
// 每個 icon 都接受 className / 其他 svg props，用法跟 lucide-react 一致：
// <Search className="w-5 h-5 text-gray-400" />

import React from 'react';

const base = {
    width: 24,
    height: 24,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
};

export const Search = (props) => (
    <svg {...base} {...props}>
        <circle cx="11" cy="11" r="8" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
);

export const ChevronDown = (props) => (
    <svg {...base} {...props}>
        <polyline points="6 9 12 15 18 9" />
    </svg>
);

export const ChevronLeft = (props) => (
    <svg {...base} {...props}>
        <polyline points="15 18 9 12 15 6" />
    </svg>
);

export const ChevronRight = (props) => (
    <svg {...base} {...props}>
        <polyline points="9 18 15 12 9 6" />
    </svg>
);

export const Award = (props) => (
    <svg {...base} {...props}>
        <circle cx="12" cy="8" r="6" />
        <path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11" />
    </svg>
);

export const Users = (props) => (
    <svg {...base} {...props}>
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
);

export const BookOpen = (props) => (
    <svg {...base} {...props}>
        <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
        <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
    </svg>
);

export const Calendar = (props) => (
    <svg {...base} {...props}>
        <rect x="3" y="4" width="18" height="18" rx="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
);

export const Github = (props) => (
    <svg {...base} fill="currentColor" stroke="none" {...props}>
        <path d="M12 .5C5.73.5.5 5.73.5 12c0 5.09 3.29 9.4 7.86 10.93.57.1.78-.25.78-.55v-2.16c-3.2.7-3.88-1.4-3.88-1.4-.53-1.33-1.29-1.68-1.29-1.68-1.06-.72.08-.71.08-.71 1.17.08 1.78 1.2 1.78 1.2 1.04 1.78 2.72 1.27 3.39.97.1-.75.4-1.27.73-1.56-2.55-.29-5.24-1.28-5.24-5.68 0-1.26.45-2.28 1.19-3.09-.12-.29-.52-1.46.11-3.04 0 0 .97-.31 3.18 1.18a11.03 11.03 0 0 1 5.79 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.58.23 2.75.11 3.04.74.81 1.19 1.83 1.19 3.09 0 4.41-2.7 5.38-5.27 5.67.41.36.78 1.07.78 2.17v3.21c0 .3.21.66.79.55A10.52 10.52 0 0 0 23.5 12c0-6.27-5.23-11.5-11.5-11.5z" />
    </svg>
);
