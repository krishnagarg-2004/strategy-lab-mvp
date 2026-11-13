import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, process.cwd(), '');
    const backendTarget =
        env.BACKEND_URL || process.env.BACKEND_URL || 'http://127.0.0.1:8000';

    return {
        plugins: [react()],
        server: {
            host: '0.0.0.0',
            allowedHosts: true,
            proxy: {
                '/api': {
                    target: backendTarget,
                    changeOrigin: true,
                },
            },
        },
    };
});
