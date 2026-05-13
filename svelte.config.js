/** @import { Config } from '@sveltejs/kit' */
import adapter from '@sveltejs/adapter-static'
import { loadEnv } from 'vite'

const env = loadEnv('production', process.cwd(), 'PUBLIC_')

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
			// When changing this, also update env variable
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
				'img-src': [
					'self',
					'blob:',
					'https://*.jiosaavncdn.com',
					'https://*.saavncdn.com',
					env.PUBLIC_GOAT_COUNTER_URL ? `${env.PUBLIC_GOAT_COUNTER_URL}/count` : '',
				],
				'media-src': [
					'self',
					'blob:',
					'https://*.jiosaavncdn.com',
					'https://*.saavncdn.com',
					'https://*.jio.com',
				],
				'font-src': ['self'],
				'connect-src': [
					'self',
					'https://jiosaavn-api.vercel.app',
					env.PUBLIC_GOAT_COUNTER_URL ?? '',
					'https://lrclib.net',
					'https://lyricsplus.prjktla.workers.dev',
				],
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
