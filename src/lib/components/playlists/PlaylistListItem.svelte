<script lang="ts" module>
	import { ListItem as M3ListItem, Icon as M3Icon } from 'm3-svelte'
	import { createPlaylistQuery } from '$lib/library/get/value-queries.ts'
	import { FAVORITE_PLAYLIST_ID } from '$lib/library/playlists-actions'
	import type { Playlist } from '$lib/library/types.ts'
	import type { IconType } from '../icon/Icon.svelte'
	import CustomIcon from '../icon/Icon.svelte'
	import MenuButton from '../MenuButton.svelte'
	import type { MenuItem } from '../menu/types.ts'

	import iconFavorite from '@ktibow/iconset-material-symbols/favorite'
	import iconPlaylist from '@ktibow/iconset-material-symbols/playlist-play'

	export type MenuItemsSelector = (playlist: Playlist) => MenuItem[]
	export type MenuItemsConfig =
		| {
				disabled?: (playlist: Playlist) => boolean
				items: MenuItemsSelector
		  }
		| MenuItemsSelector
</script>

<script lang="ts">
	interface Props {
		playlistId: number
		style?: string
		ariaRowIndex: number
		active?: boolean
		class?: ClassValue
		icon?: Snippet<[Playlist]> | IconType
		menuItems?: MenuItemsConfig
		onclick?: (playlist: Playlist) => void
	}

	const {
		playlistId,
		style,
		active,
		class: className,
		onclick,
		icon,
		menuItems,
	}: Props = $props()

	const data = createPlaylistQuery(() => playlistId)
	const playlist = $derived(data.value)

	const menuItemsWithItem = $derived.by(() => {
		if (!(playlist && menuItems)) {
			return undefined
		}

		if (typeof menuItems === 'object') {
			return menuItems.disabled?.(playlist) ? undefined : () => menuItems.items(playlist)
		}

		return () => menuItems(playlist)
	})

	const fallbackIcon = () => (playlistId === FAVORITE_PLAYLIST_ID ? iconFavorite : iconPlaylist)
</script>

<div {style} class={className}>
	{#if data.loading}
		<M3ListItem headline="Loading..." class="h-14" />
	{:else if data.error}
		<M3ListItem headline="Error loading playlist" class="h-14" />
	{:else if playlist}
		<M3ListItem
			headline={playlist.name}
			lines={1}
			onclick={() => onclick?.(playlist)}
			class={[
				'transition-colors',
				active && 'bg-primaryContainer text-onPrimaryContainer rounded-xl'
			]}
		>
			{#snippet leading()}
				{#if typeof icon === 'function'}
					{@render icon(playlist)}
				{:else if typeof icon === 'string'}
					<div class="rounded-full bg-surfaceContainerHigh p-2 text-onSurfaceVariant">
						<CustomIcon type={icon} />
					</div>
				{:else}
					<div class="rounded-full bg-secondaryContainer p-2 text-onSecondaryContainer">
						<M3Icon icon={fallbackIcon()} />
					</div>
				{/if}
			{/snippet}

			{#snippet trailing()}
				<MenuButton tabindex={-1} menuItems={menuItemsWithItem} />
			{/snippet}
		</M3ListItem>
	{/if}
</div>
