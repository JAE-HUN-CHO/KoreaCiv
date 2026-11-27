import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    // GitHub Pages(프로젝트 페이지)는 /<repo>/ 하위에서 서빙되므로 배포 시 VITE_BASE로 지정
    base: process.env.VITE_BASE || '/',
    plugins: [
      react(),
      // 링크 미리보기(og:image)는 절대 URL이 필요해 배포 주소(VITE_SITE_URL)가 있을 때만 주입
      {
        name: 'inject-og-image',
        transformIndexHtml(html: string): string {
          const siteUrl = process.env.VITE_SITE_URL?.trim();
          if (!siteUrl) return html;
          const base = siteUrl.endsWith('/') ? siteUrl : `${siteUrl}/`;
          const tags = [
            `<meta property="og:url" content="${base}" />`,
            `<meta property="og:image" content="${base}og-image.jpg" />`,
            '<meta property="og:image:width" content="1200" />',
            '<meta property="og:image:height" content="630" />',
            '<meta property="og:image:alt" content="KoreaCiv — 대한민국 문명 지도" />',
            `<meta name="twitter:image" content="${base}og-image.jpg" />`,
          ].join('\n    ');
          return html.replace('</head>', `    ${tags}\n  </head>`);
        },
      },
      tailwindcss(),
      // Copies src/assets into dist/ so root-relative URLs like
      // "/src/assets/images/..." (e.g. generate_image output) still resolve
      // in production builds. Do not remove.
      {
        name: 'copy-unbundled-src-assets',
        apply: 'build',
        closeBundle(error?: Error): void {
          if (error) {
            return;
          }
          const distDir = path.resolve(import.meta.dirname, 'dist');
          const srcAssets = path.resolve(import.meta.dirname, 'src/assets');
          const distAssets = path.resolve(distDir, 'src/assets');
          if (fs.existsSync(distDir) && fs.existsSync(srcAssets)) {
            fs.cpSync(srcAssets, distAssets, {recursive: true, force: true});
          }
        },
      },
    ],
    build: {
      rolldownOptions: {
        output: {
          // 지형 원자료(약 140KB)와 react 계열 라이브러리를 별도 파일로 분리.
          // 코드만 바뀌거나 데이터만 바뀔 때 나머지는 브라우저 캐시를 그대로 씀
          codeSplitting: {
            groups: [
              { name: 'terrain-data', test: /src[\\/]data[\\/]generated[\\/]/ },
              { name: 'vendor', test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/ },
            ],
          },
        },
      },
    },
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
