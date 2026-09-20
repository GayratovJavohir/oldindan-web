import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, process.cwd(), '')
    const proxyTarget = env.VITE_PROXY_TARGET || 'https://fuzzy-weekend-sized-begin.trycloudflare.com/'

    const proxy = ['/api', '/media', '/static'].reduce((acc, path) => {
        acc[path] = { target: proxyTarget, changeOrigin: true }
        return acc
    }, {})

    return {
        plugins: [react()],
        server: {
            host: '0.0.0.0',
            port: 5173,
            proxy,
        },
        build: {
            // FIX: the whole app shipped as one 1.12 MB chunk and every build
            // ended with Vite's "chunks are larger than 500 kB" warning.
            // Splitting the heavy, rarely-changing vendors lets the browser
            // cache them across deploys.
            rollupOptions: {
                output: {
                    manualChunks: {
                        react: ['react', 'react-dom', 'react-router-dom'],
                        i18n: ['i18next', 'react-i18next', 'i18next-browser-languagedetector'],
                        canvas: ['konva', 'react-konva'],
                        maps: ['leaflet'],
                    },
                },
            },
        },
    }
})
