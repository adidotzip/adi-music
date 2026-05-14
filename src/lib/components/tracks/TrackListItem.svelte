<script lang="ts">
	import { ListItem as M3ListItem, Icon as M3Icon, Checkbox } from 'm3-svelte'
	import { createManagedArtwork } from '$lib/helpers/create-managed-artwork.svelte'
	import { formatDuration } from '$lib/helpers/utils/format-duration.ts'
	import { formatArtists, formatNameOrUnknown } from '$lib/helpers/utils/text.ts'
	import { createTrackQuery, type TrackData } from '$lib/library/get/value-queries.ts'
	import Artwork from '../Artwork.svelte'
	import FavoriteButton from '../FavoriteButton.svelte'
	import IconButton from '../IconButton.svelte'
	import MenuButton from '../MenuButton.svelte'
	import type { MenuItem } from '../menu/types.ts'

	import iconDrag from '@ktibow/iconset-material-symbols/drag-handle'

	interface Props {
		trackId: number
		style?: string
		ariaRowIndex: number
		active: boolean
		activePlaying: boolean
		class?: ClassValue
		selectionEnabled: boolean
		selectionHover?: boolean
		selected: boolean
		showReorderButton?: boolean
		showFavoriteButton?: boolean
		reorderDragging?: boolean
		reorderInsertBefore?: boolean
		reorderInsertAfter?: boolean
		menuItems?: (track: TrackData) => MenuItem[]
		onclick?: (track: TrackData, e: KeyboardEvent | MouseEvent) => void
		onpointerenter?: (e: PointerEvent) => void
		onReorderPointerDown?: (e: PointerEvent) => void
		toggleSelection?: () => void
	}

	const {
		trackId,
		style,
		active,
		activePlaying,
		class: className,
		selectionEnabled,
		selected,
		showReorderButton = false,
		showFavoriteButton = true,
		reorderDragging = false,
		reorderInsertBefore = false,
		reorderInsertAfter = false,
		menuItems,
		onclick,
		onReorderPointerDown,
		toggleSelection,
	}: Props = $props()

	const query = createTrackQuery(() => trackId)
	const { value: track, loading } = $derived(query)

	const artworkSrc = createManagedArtwork(() => track?.image?.small)

	const menu = useMenu()
	const menuItemsWithItem = $derived(track && menuItems?.bind(null, track))
</script>

<div {style} class={['relative', className]}>
	{#if reorderInsertBefore || reorderInsertAfter}
		<div
			class={[
				'pointer-events-none absolute right-2 left-2 z-20 h-0.5 bg-primary',
				reorderInsertBefore ? 'top-0' : 'bottom-0',
			]}
		></div>
	{/if}

	{#if loading}
		<M3ListItem headline="Loading..." supporting="Please wait">
			{#snippet leading()}
				<div class="h-10 w-10 animate-pulse rounded-md bg-surfaceContainerHighest"></div>
			{/snippet}
		</M3ListItem>
	{:else if query.error}
		<M3ListItem headline="Error" supporting={`Error loading track ${trackId}`} />
	{:else if track}
		<M3ListItem
			headline={track.name}
			supporting={formatArtists(track.artists)}
			overline={formatNameOrUnknown(track.album)}
			lines={2}
			onclick={(e: MouseEvent) => onclick?.(track, e)}
			class={[
				'track-item-container transition-colors',
				active && 'bg-primaryContainer text-onPrimaryContainer rounded-xl',
				selected && 'bg-secondaryContainer text-onSecondaryContainer rounded-xl',
				reorderDragging && 'opacity-30',
			]}
			oncontextmenu={(e: MouseEvent) => {
				if (!menuItemsWithItem) return
				e.preventDefault()
				if (e.pointerType === 'touch' && !selectionEnabled) {
					toggleSelection?.()
					return
				}
				menu.showFromEvent(e, menuItemsWithItem(), {
					anchor: false,
					position: { top: e.y, left: e.x },
				})
			}}
		>
			{#snippet leading()}
				<div class="relative">
					<Artwork
						src={artworkSrc()}
						alt={track.name}
						class={['h-10 w-10 rounded-lg shadow-1', activePlaying && 'opacity-60']}
					/>
					{#if activePlaying}
						<div class="absolute inset-0 flex items-center justify-center gap-0.5">
							<span class="playing-bar h-3 w-0.5 rounded-full bg-primary"></span>
							<span class="playing-bar h-3 w-0.5 rounded-full bg-primary [--ani-delay:0.2s]"></span>
							<span class="playing-bar h-3 w-0.5 rounded-full bg-primary [--ani-delay:0.4s]"></span>
						</div>
					{/if}
				</div>
			{/snippet}

			{#snippet trailing()}
				<div class="flex items-center gap-1">
					{#if selectionEnabled}
						<label class="p-2" onclick={(e) => { e.stopPropagation(); toggleSelection?.(); }}>
							<Checkbox><input type="checkbox" checked={selected} /></Checkbox>
						</label>
					{:else}
						<div class="flex items-center gap-1">
							<div class="mr-2 text-body-sm opacity-50 tabular-nums">
								{formatDuration(track.duration)}
							</div>

							{#if showReorderButton}
								<IconButton
									tooltip="Reorder"
									onpointerdown={onReorderPointerDown}
									onclick={(e) => e.stopPropagation()}
								>
									<M3Icon icon={iconDrag} />
								</IconButton>
							{/if}

							{#if showFavoriteButton}
								<FavoriteButton
									trackId={track.id}
									favorite={track.favorite}
									tabindex={-1}
								/>
							{/if}

							<MenuButton
								tabindex={-1}
								menuItems={menuItemsWithItem}
							/>
						</div>
					{/if}
				</div>
			{/snippet}
		</M3ListItem>
	{/if}
</div>

<style lang="postcss">
	@reference '../../../app.css';

	@keyframes playing-bar {
		0%, 100% { transform: scaleY(0.4); }
		50% { transform: scaleY(1); }
	}

	.playing-bar {
		animation: playing-bar 0.8s ease-in-out infinite var(--ani-delay, 0s) backwards;
	}

	:global(.m3-list-item) {
		--m3-shape-medium: 12px;
	}
</style>
