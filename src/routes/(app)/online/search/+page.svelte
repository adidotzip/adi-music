<script lang="ts">
	import { page } from '$app/state'
	import { jioSaavnService } from '$lib/services/jiosaavn'
	import { mapJioSaavnSongToTrack } from '$lib/services/jiosaavn-helpers'
	import type { TrackData } from '$lib/library/get/value'
	import TrackListItem from '$lib/components/tracks/TrackListItem.svelte'
	import Artwork from '$lib/components/Artwork.svelte'
	import { goto } from '$app/navigation'
	import { usePlayer } from '$lib/stores/player/use-store'

	const player = usePlayer()
	let query = $derived(page.url.searchParams.get('q') || '')

	let results = $state<{
		songs: TrackData[],
		albums: any[],
		artists: any[],
		playlists: any[]
	}>({
		songs: [],
		albums: [],
		artists: [],
		playlists: []
	})

	let loading = $state(false)

	$effect(() => {
		if (query) {
			loading = true
			jioSaavnService.searchAll(query).then(data => {
				results = {
					songs: data.songs.results.map(mapJioSaavnSongToTrack),
					albums: data.albums.results,
					artists: data.artists.results,
					playlists: data.playlists.results
				}
				loading = false
			})
		}
	})
</script>

<div class="mx-auto flex w-full max-w-(--app-max-content-width) flex-col px-4 pt-4">
	<h1 class="mb-6 text-headline-md">Search results for "{query}"</h1>

	{#if loading}
		<div class="flex h-64 items-center justify-center">
			<div class="size-10 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
		</div>
	{:else}
		{#if results.songs.length > 0}
			<section class="mb-8">
				<h2 class="mb-4 text-title-lg font-bold">Songs</h2>
				<div class="flex flex-col">
					{#each results.songs as track, i}
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
								player.playTrack(i, results.songs.map(s => s.id), {}, results.songs)
							}}
						/>
					{/each}
				</div>
			</section>
		{/if}

		{#if results.albums.length > 0}
			<section class="mb-8">
				<h2 class="mb-4 text-title-lg font-bold">Albums</h2>
				<div class="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
					{#each results.albums as album}
						<button
							class="flex flex-col text-left transition-transform hover:scale-105"
							onclick={() => goto(`/online/album/${album.id}`)}
						>
							<Artwork src={album.image[album.image.length-1].link} class="mb-2 aspect-square w-full rounded-xl shadow-md" />
							<div class="truncate font-medium">{album.name}</div>
							<div class="truncate text-body-sm text-onSurfaceVariant">{album.primaryArtists}</div>
						</button>
					{/each}
				</div>
			</section>
		{/if}

		{#if results.artists.length > 0}
			<section class="mb-8">
				<h2 class="mb-4 text-title-lg font-bold">Artists</h2>
				<div class="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
					{#each results.artists as artist}
						<button
							class="flex flex-col items-center text-center transition-transform hover:scale-105"
							onclick={() => goto(`/online/artist/${artist.id}`)}
						>
							<Artwork src={artist.image[artist.image.length-1].link} class="mb-2 aspect-square w-full rounded-full shadow-md" />
							<div class="truncate font-medium">{artist.name}</div>
						</button>
					{/each}
				</div>
			</section>
		{/if}
	{/if}
</div>
