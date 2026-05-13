<script lang="ts">
	import { page } from '$app/state'
	import { jioSaavnService } from '$lib/services/jiosaavn'
	import { mapJioSaavnSongToTrack } from '$lib/services/jiosaavn-helpers'
	import type { TrackData } from '$lib/library/get/value'
	import TrackListItem from '$lib/components/tracks/TrackListItem.svelte'
	import Artwork from '$lib/components/Artwork.svelte'
	import { usePlayer } from '$lib/stores/player/use-store'
	import { goto } from '$app/navigation'

	const player = usePlayer()
	let id = $derived(page.params.id)

	let artist = $state<any>(null)
	let topSongs = $state<TrackData[]>([])
	let albums = $state<any[]>([])
	let loading = $state(true)

	$effect(() => {
		if (id) {
			loading = true
			jioSaavnService.getArtistDetails(id).then(data => {
				artist = data
				topSongs = data.topSongs?.map(mapJioSaavnSongToTrack) || []
				albums = data.topAlbums || []
				loading = false
			})
		}
	})
</script>

<div class="mx-auto flex w-full max-w-(--app-max-content-width) flex-col px-4 pt-4">
	{#if loading}
		<div class="flex h-64 items-center justify-center">
			<div class="size-10 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
		</div>
	{:else if artist}
		<div class="mb-8 flex flex-col gap-6 md:flex-row md:items-end">
			<Artwork src={artist.image[artist.image.length-1].link} class="size-48 rounded-full shadow-xl md:size-64" />
			<div class="flex flex-col">
				<div class="mb-1 text-body-md font-medium text-primary">Artist</div>
				<h1 class="mb-2 text-headline-lg font-bold">{artist.name}</h1>
				<div class="text-title-md text-onSurfaceVariant">
					{artist.fanCount} Fans • {artist.dominantLanguage}
				</div>
			</div>
		</div>

		{#if topSongs.length > 0}
			<section class="mb-8">
				<h2 class="mb-4 text-title-lg font-bold">Top Songs</h2>
				<div class="flex flex-col">
					{#each topSongs as track, i}
						<TrackListItem
							trackId={track.id}
							{track}
							active={player.activeTrack?.uuid === track.uuid}
							activePlaying={player.playing && player.activeTrack?.uuid === track.uuid}
							ariaRowIndex={i}
							selectionEnabled={false}
							selectionHover={false}
							selected={false}
							onclick={() => {
								player.playTrack(i, topSongs.map(s => s.id), {}, topSongs)
							}}
						/>
					{/each}
				</div>
			</section>
		{/if}

		{#if albums.length > 0}
			<section class="mb-8">
				<h2 class="mb-4 text-title-lg font-bold">Albums</h2>
				<div class="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
					{#each albums as album}
						<button
							class="flex flex-col text-left transition-transform hover:scale-105"
							onclick={() => goto(`/online/album/${album.id}`)}
						>
							<Artwork src={album.image[album.image.length-1].link} class="mb-2 aspect-square w-full rounded-xl shadow-md" />
							<div class="truncate font-medium">{album.name}</div>
							<div class="truncate text-body-sm text-onSurfaceVariant">{album.year}</div>
						</button>
					{/each}
				</div>
			</section>
		{/if}
	{/if}
</div>
