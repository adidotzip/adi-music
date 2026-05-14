<script lang="ts">
	import iconTrayRemove from '@ktibow/iconset-material-symbols/delete-sweep'
	import iconEqualizer from '@ktibow/iconset-material-symbols/equalizer'

	import iconMusic from '@ktibow/iconset-material-symbols/music-note'
	import iconTrayFull from '@ktibow/iconset-material-symbols/view-list'
	import { Button, Card, Icon, Tabs } from 'm3-svelte'
	import { goto } from '$app/navigation'
	import { page } from '$app/state'
	import BackButton from '$lib/components/BackButton.svelte'
	import Header from '$lib/components/Header.svelte'
	import CustomIconButton from '$lib/components/IconButton.svelte'
	import CustomIcon from '$lib/components/icon/Icon.svelte'
	import ListDetailsLayout from '$lib/components/ListDetailsLayout.svelte'
	import ActiveIndicator from '$lib/components/player/buttons/ActiveIndicator.svelte'
	import PlayerFavoriteButton from '$lib/components/player/buttons/PlayerFavoriteButton.svelte'
	import PlayNextButton from '$lib/components/player/buttons/PlayNextButton.svelte'
	import PlayPrevButton from '$lib/components/player/buttons/PlayPrevButton.svelte'
	import PlayTogglePillButton from '$lib/components/player/buttons/PlayTogglePillButton.svelte'
	import RepeatButton from '$lib/components/player/buttons/RepeatButton.svelte'
	import ShuffleButton from '$lib/components/player/buttons/ShuffleButton.svelte'
	import PlayerArtwork from '$lib/components/player/PlayerArtwork.svelte'
	import SyncedLyrics from '$lib/components/player/SyncedLyrics.svelte'
	import Timeline from '$lib/components/player/Timeline.svelte'
	import ScrollContainer from '$lib/components/ScrollContainer.svelte'
	import Slider from '$lib/components/Slider.svelte'
	import TracksListContainer from '$lib/components/tracks/TracksListContainer.svelte'
	import { initPageQueries } from '$lib/db/query/page-query.svelte.js'
	import { formatArtists, getItemLanguage } from '$lib/helpers/utils/text.ts'
	import { clearPlayHistory, dbRemoveFromPlayHistory } from '$lib/library/play-history-actions.js'
	import { getLayoutProps } from './layout-props.ts'

	const { data } = $props()

	initPageQueries(() => data)

	const mainStore = useMainStore()
	const player = usePlayer()
	const dialogs = useDialogsStore()
	const activeTrack = $derived(player.activeTrack)

	const selectedDetailsTabId = $derived.by(() => {
		if (page.route.id === '/(app)/player/history') { return 'history' }
		if (page.route.id === '/(app)/player/lyrics') { return 'lyrics' }
		return 'queue'
	})

	const { isCompactHorizontal, isCompactVertical, layoutMode } = $derived(
		getLayoutProps(page.route.id),
	)
</script>

{#snippet playerSnippet()}
	<div
		class={[
			layoutMode === 'both' && 'w-100 2xl:w-[28dvw]',
			layoutMode === 'list' && 'mx-auto w-full',
			'player-content z-0 grow items-center gap-x-6 overflow-clip bg-secondaryContainer px-4 pb-4',
			isCompactVertical && !isCompactHorizontal && 'player-content-horizontal',
		]}
	>
		<div
			class={[
				isCompactVertical && !isCompactHorizontal ? 'absolute top-0 left-0 h-14' : 'h-16',
				'flex w-full items-center justify-between gap-2 [grid-area:header]',
			]}
		>
			<BackButton />
			<div class="text-headline-sm font-bold">{m.player()}</div>
			<div class="w-10"></div>
		</div>

		<div class="m-auto my-auto flex size-full items-center justify-center [grid-area:artwork]">
			<PlayerArtwork
				class="size-full max-h-80 max-w-80 rounded-3xl shadow-4 active-view-player:view-name-[pl-artwork]"
			/>
		</div>

		<div class="mt-4 flex w-full flex-col gap-4 [grid-area:controls]">
			<Card variant="filled" class="w-full bg-surfaceContainerHighest px-4 py-4 rounded-3xl">
				<Timeline class="w-full" />
			</Card>

			<Card variant="filled" class="flex w-full flex-col gap-6 bg-secondaryContainer px-4 py-8 rounded-3xl">
				<div class="my-auto flex items-center justify-between gap-2">
					<ShuffleButton />
					<PlayPrevButton />
					<PlayTogglePillButton />
					<PlayNextButton />
					<RepeatButton />
				</div>

				{#if mainStore.volumeSliderEnabled}
					<div class="flex items-center gap-4">
						<Slider bind:value={player.volume} />
					</div>
				{/if}
			</Card>

			<Card variant="filled" class="flex h-20 w-full shrink-0 items-center bg-secondaryContainer px-4 rounded-3xl">
				{#if activeTrack}
					<div class="mr-4 min-w-6 text-center text-title-md opacity-50 tabular-nums">
						{player.activeTrackIndex + 1}
					</div>

					<div class="grid overflow-hidden" lang={getItemLanguage(activeTrack.language)}>
						<div class="truncate text-title-md font-bold">{activeTrack.name}</div>
						<div class="truncate text-body-md opacity-70">{formatArtists(activeTrack.artists)}</div>
					</div>
				{/if}

				<div class="ml-auto flex gap-1">
					<PlayerFavoriteButton />

					<CustomIconButton
						tooltip={m.equalizerOpenEqualizer()}
						onclick={() => {
							dialogs.openDialog('equalizer')
						}}
					>
						<Icon icon={iconEqualizer} />
						<ActiveIndicator active={player.equalizer.enabled} />
					</CustomIconButton>

					{#if layoutMode === 'list'}
						<CustomIconButton tooltip={m.playerOpenLyrics()} href="/player/lyrics">
							<Icon icon={iconMusic} />
						</CustomIconButton>
						<CustomIconButton tooltip={m.playerOpenQueue()} href="/player/queue">
							<Icon icon={iconTrayFull} />
						</CustomIconButton>
					{/if}
				</div>
			</Card>
		</div>
	</div>
{/snippet}

{#snippet emptyList(title: string)}
	<div class="m-auto flex flex-col items-center text-center">
		<CustomIcon type="playlistMusic" class="color-onSecondaryContainer my-auto size-35 opacity-54" />
		<div class="mb-4 text-headline-sm font-bold">{title}</div>
		<Button variant="outlined" href="/library/tracks">
			{m.playerQueuePlaySomething()}
		</Button>
	</div>
{/snippet}

{#snippet queueSnippet()}
	<ScrollContainer
		class="flex h-dvh scroll-pt-(--app-header-height) flex-col overflow-auto contain-strict scrollbar-gutter-stable"
	>
		<Header
			mode="sticky"
			noBackButton={layoutMode !== 'details'}
			class={(isElevated) => [
				'border-b transition-colors',
				isElevated ? 'bg-surface/80 backdrop-blur-md border-outline-variant' : 'border-transparent',
			]}
		>
			<div class="absolute inset-0 m-auto flex size-max items-center justify-center">
				<Tabs
					tab={selectedDetailsTabId}
					items={[
						{ value: 'queue', name: m.queue() },
						{ value: 'history', name: m.playerHistory() },
						{ value: 'lyrics', name: m.lyrics() },
					]}
					onchange={(id) => {
						void goto(`/player/${id}`, { replaceState: true })
					}}
				/>
			</div>

			{#if page.route.id === '/(app)/player/lyrics'}
				<div class="w-11"></div>
			{:else if selectedDetailsTabId === 'queue'}
				<CustomIconButton
					tooltip={m.playerClearQueue()}
					disabled={player.isQueueEmpty}
					onclick={player.clearQueue}
				>
					<Icon icon={iconTrayRemove} />
				</CustomIconButton>
			{:else}
				<CustomIconButton
					tooltip={m.playerClearHistory()}
					disabled={data.historyTrackIds.value.length === 0}
					onclick={() => void clearPlayHistory()}
				>
					<Icon icon={iconTrayRemove} />
				</CustomIconButton>
			{/if}
		</Header>

		<div class="mx-auto flex w-full max-w-(--app-max-content-width) grow flex-col">
			<div class={["flex grow", page.route.id !== '/(app)/player/lyrics' && "p-4"]}>
				{#if page.route.id === '/(app)/player/lyrics'}
					<SyncedLyrics track={activeTrack} currentTimeMs={player.currentTime * 1000} />
				{:else if selectedDetailsTabId === 'queue'}
					{#if player.isQueueEmpty}
						{@render emptyList(m.playerQueueEmpty())}
					{:else}
						<TracksListContainer
							items={player.itemsIds}
							showReorderButton
							showFavoriteButton={false}
							onReorder={(fromIndex, toIndex) => {
								player.moveQueueItem(fromIndex, toIndex)
							}}
							predefinedMenuItems={{
								disableAddToQueue: true,
							}}
							menuItems={(_track, index) => [
								{
									label: m.playerRemoveFromQueue(),
									action: () => {
										player.removeFromQueue(index)
									},
								},
							]}
							onItemClick={({ index }) => {
								player.playTrack(index)
							}}
						/>
					{/if}
				{:else if data.historyTrackIds.value.length === 0}
					{@render emptyList(m.playerHistoryEmpty())}
				{:else}
					<TracksListContainer
						items={data.historyTrackIds.value}
						menuItems={(item) => [
							{
								label: m.playerRemoveFromHistory(),
								action: () => {
									void dbRemoveFromPlayHistory(item.id)
								},
							},
						]}
						onItemClick={({ track }) => {
							const trackIndexInQueue = player.itemsIds.indexOf(track.id)
							if (trackIndexInQueue !== -1) {
								player.playTrack(trackIndexInQueue)
								return
							}

							player.playTrack(0, [track.id])
						}}
					/>
				{/if}
			</div>
		</div>
	</ScrollContainer>
{/snippet}

<ListDetailsLayout
	id="full-player"
	mode={layoutMode}
	class={[
		'grow active-view-player:view-name-[pl-card]',
		layoutMode === 'both' && 'bg-surface',
	]}
	list={playerSnippet}
	details={queueSnippet}
	noListStableGutter
	noPlayerOverlayPadding
/>

<style lang="postcss">
	@reference '../../../app.css';

	.player-content {
		display: grid;
		grid-template-columns: 1fr;
		grid-template-rows: max-content minmax(--spacing(35), 1fr) auto;
		grid-template-areas: 'header' 'artwork' 'controls';
	}

	.player-content-horizontal {
		grid-template-columns:
			1fr minmax(0, --spacing(75)) minmax(0, --spacing(125))
			1fr;
		grid-template-rows: max-content 1fr;
		grid-template-areas:
			'header header header header'
			'. artwork controls .';
	}

	@keyframes -global-view-player-container-rounded {
		from {
			border-radius: var(--vt-pl-card-from-radius);
		}
		to {
			border-radius: var(--vt-pl-card-to-radius);
		}
	}

	@keyframes -global-view-player-card-morph-enter {
		from {
			width: var(--mp-width);
			height: var(--mp-height);
			translate: var(--mp-left) calc(var(--mp-bottom) - var(--mp-height));
		}
		to {
			width: 100dvw;
			height: 100dvh;
			translate: 0 0;
		}
	}

	@keyframes -global-view-player-card-morph-exit {
		from {
			width: 100dvw;
			height: 100dvh;
			translate: 0 0;
		}
		to {
			width: var(--mp-width);
			height: var(--mp-height);
			translate: var(--mp-left) calc(var(--mp-bottom) - var(--mp-height));
		}
	}

	:global(html:active-view-transition-type(player)) {
		--vt-pl-card-radius: var(--radius-2xl);
		@media (width >= --theme(--breakpoint-sm)) {
			--vt-pl-card-radius: var(--radius-3xl);
		}

		&::view-transition-group(pl-card) {
			overflow: clip;
			background: var(--m3c-secondary-container);
			top: 0;
			left: 0;
			transform: none;
			height: 100%;
			animation:
				view-player-container-rounded 400ms var(--ease-standard) forwards,
				var(--vt-pl-card-morph-ani) 400ms var(--ease-standard) forwards;
		}

		&::view-transition-old(pl-card),
		&::view-transition-new(pl-card) {
			overflow: clip;
		}

		&::view-transition-old(pl-card) {
			animation: fade-out 75ms linear forwards;
		}

		&::view-transition-new(pl-card) {
			animation: fade-in 325ms 75ms linear both;
		}

		&:active-view-transition-type(forwards) {
			--vt-pl-card-from-radius: var(--vt-pl-card-radius);
			--vt-pl-card-to-radius: 0;
			--vt-pl-card-morph-ani: view-player-card-morph-enter;

			&::view-transition-old(pl-card) {
				object-fit: contain;
			}

			&::view-transition-new(pl-card) {
				object-fit: cover;
			}
		}

		&:active-view-transition-type(backwards) {
			--vt-pl-card-from-radius: 0;
			--vt-pl-card-to-radius: var(--vt-pl-card-radius);
			--vt-pl-card-morph-ani: view-player-card-morph-exit;

			&::view-transition-old(pl-card) {
				object-fit: cover;
			}

			&::view-transition-new(pl-card) {
				object-fit: contain;
			}
		}

		&::view-transition-group(pl-artwork) {
			animation-duration: 400ms;
			animation-timing-function: var(--ease-standard);
		}
	}
</style>
