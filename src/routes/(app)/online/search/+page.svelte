<script lang="ts">
	import { page } from '$app/state'
	import { jioSaavnService } from '$lib/services/jiosaavn'
	import { mapJioSaavnSongToTrack } from '$lib/services/jiosaavn-helpers'
	import type { TrackData } from '$lib/library/get/value'
	import TrackListItem from '$lib/components/tracks/TrackListItem.svelte'
	import { usePlayer } from '$lib/stores/player/use-store'

	const player = usePlayer()
	let query = $derived(page.url.searchParams.get('q') || '')

	let results = $state<{
		songs: TrackData[]
	}>({
		songs: []
	})

	let loading = $state(false)

	$effect(() => {
		if (query) {
			loading = true
			jioSaavnService.searchSongs(query).then(data => {
				results = {
					songs: data.map(mapJioSaavnSongToTrack)
				}
				loading = false
			}).catch(err => {
				console.error("Search error:", err)
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
		{:else if query}
			<div class="flex h-64 flex-col items-center justify-center text-onSurfaceVariant">
				<p>No results found for "{query}"</p>
			</div>
		{/if}
	{/if}
</div>
