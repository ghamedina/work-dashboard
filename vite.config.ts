import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [sveltekit()],
	server: {
		proxy: {
			'/hcp-api': {
				target: 'http://localhost:3000',
				changeOrigin: true,
				rewrite: (path: string) => path.replace(/^\/hcp-api/, ''),
				configure: (proxy: { on: (event: string, cb: (proxyReq: { setHeader: (k: string, v: string) => void }) => void) => void }) => {
					proxy.on('proxyReq', (proxyReq) => {
						proxyReq.setHeader('Origin', 'http://localhost:3060');
						proxyReq.setHeader('Referer', 'http://localhost:3060/');
					});
				}
			}
		}
	}
});
