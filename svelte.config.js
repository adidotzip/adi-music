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
					env.PUBLIC_GOAT_COUNTER_URL
						? `${env.PUBLIC_GOAT_COUNTER_URL}/count`
						: '',

					// JioSaavn
					'https://*.jiosaavncdn.com',
					'https://*.saavncdn.com',

					// Apple
					'https://*.mzstatic.com',

					// Deezer
					'https://e-cdns-images.dzcdn.net',
					'https://cdn-images.dzcdn.net',
				],

				'media-src': [
					'self',
					'blob:',

					'https://*.jiosaavncdn.com',
					'https://*.saavncdn.com',

					'https://mvod.itunes.apple.com',
					'https://*.itunes.apple.com',
					'https://*.mzstatic.com',
				],

				'font-src': ['self'],

				'connect-src': [
					'self',

					env.PUBLIC_GOAT_COUNTER_URL ?? '',

					// Lyrics
					'https://lrclib.net',
					'https://lyricsplus.prjktla.workers.dev',
					'https://unison.boidu.dev',

					// JioSaavn
					'https://jiosaavn-apix.arcadopredator.workers.dev',

					// Artwork
					'https://artwork.m8tec.top',

					// Apple
					'https://itunes.apple.com',
					'https://*.itunes.apple.com',
					'https://mvod.itunes.apple.com',

					// Deezer API
					'https://api.deezer.com',
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
