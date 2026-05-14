<script lang="ts" module>
	import type { IconType } from './icon-paths.server.ts'


	// Map our custom icon types to Material Symbols names where possible
	// For those not in Material Symbols, we'll keep using our paths
	const M3_MAP: Record<string, any> = {
		home: import('@ktibow/iconset-material-symbols/home'),
		search: import('@ktibow/iconset-material-symbols/search'),
		album: import('@ktibow/iconset-material-symbols/album'),
		person: import('@ktibow/iconset-material-symbols/person'),
		favorite: import('@ktibow/iconset-material-symbols/favorite'),
		favoriteOutline: import('@ktibow/iconset-material-symbols/favorite-outline'),
		settings: import('@ktibow/iconset-material-symbols/settings'),
		delete: import('@ktibow/iconset-material-symbols/delete'),
		plus: import('@ktibow/iconset-material-symbols/add'),
		check: import('@ktibow/iconset-material-symbols/check'),
		close: import('@ktibow/iconset-material-symbols/close'),
		chevronRight: import('@ktibow/iconset-material-symbols/chevron-right'),
		chevronUp: import('@ktibow/iconset-material-symbols/expand-less'),
		moreVertical: import('@ktibow/iconset-material-symbols/more-vert'),
		musicNote: import('@ktibow/iconset-material-symbols/music-note'),
		shuffle: import('@ktibow/iconset-material-symbols/shuffle'),
		cached: import('@ktibow/iconset-material-symbols/cached'),
		folder: import('@ktibow/iconset-material-symbols/folder'),
		lock: import('@ktibow/iconset-material-symbols/lock'),
		equalizer: import('@ktibow/iconset-material-symbols/equalizer'),
		palette: import('@ktibow/iconset-material-symbols/palette'),
	}

	export type { IconType } from './icon-paths.server.ts'

	export interface IconProps {
		type: IconType
		class?: ClassValue
		size?: number
	}
</script>

<script lang="ts">
	import { Icon as M3Icon } from 'm3-svelte'
	let { type, class: className, size = 24 }: IconProps = $props()

	let m3Icon = $state<any>()

	$effect(() => {
		let active = true
		if (M3_MAP[type]) {
			M3_MAP[type].then((module: any) => {
				if (active) m3Icon = module.default
			})
		} else {
			m3Icon = null
		}
		return () => {
			active = false
		}
	})
</script>

{#if m3Icon}
	<M3Icon icon={m3Icon} {size} class={className} />
{:else}
	<svg
		role="presentation"
		width={size}
		height={size}
		viewBox="0 0 24 24"
		class={['pointer-events-none shrink-0 fill-current', className]}
	>
		<use href={`#system-icon-${type}`} />
	</svg>
{/if}
