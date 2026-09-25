import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
    site: 'https://ithome-watcher-station.vercel.app',
    integrations: [react()],
    vite: {
        plugins: [tailwindcss()],
    },
    // 之前為了 lucide-react 加的 ssr.noExternal / optimizeDeps.include
    // 已經不需要了，因為改用純 SVG（見 src/components/Icons.jsx），
    // 不再依賴 lucide-react 這個第三方套件。
});
