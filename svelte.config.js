/** @import { Config } from '@sveltejs/kit' */
import adapter from '@sveltejs/adapter-static'
import { loadEnv } from 'vite'


const env = loadEnv('production', process.cwd(), 'PUBLIC_')

// Helper to keep CSP arrays clean
const cleanCsp = (list) => list.filter(Boolean);

/** @type {Config} */
const config = {
	compilerOptions: {
		runes: true,
		
		experimental: {
			async: true,
		},
	},
	kit: {
		paths: {
			relative: false,
		},
		outDir: './.generated/svelte-kit',
		adapter: adapter({
			fallback: '200.html',
		}),
		alias: {
			$paraglide: './.generated/paraglide',
		},
		csp: {
			directives: {
				'default-src': ['none'],
				'script-src': ['self', 'https://gc.zgo.at/'],
				'style-src': ['self', 'unsafe-inline'],
				'img-src': cleanCsp([
					'self',
					'blob:',
					env.PUBLIC_GOAT_COUNTER_URL ? `${env.PUBLIC_GOAT_COUNTER_URL}/count` : null,
				]),
				'media-src': ['self', 'blob:'],
				'font-src': ['self'],
				'connect-src': cleanCsp([
					'self',
					env.PUBLIC_GOAT_COUNTER_URL,
					'https://lrclib.net',
					'https://lyricsplus.prjktla.workers.dev',
					'https://artwork.m8tec.top/api/v1/artwork/search',
				]),
				'form-action': ['none'],
				'manifest-src': ['self'],
				'base-uri': ['none'],
			},
		},
		typescript: {
			config: (tsConfig) => {
				
				tsConfig.extends = '../../tsconfig.base.json'
				tsConfig.include.push('../paraglide/**/*')
				return tsConfig
			},
		},
		serviceWorker: {
			register: false,
		},
	},
}

export default config
