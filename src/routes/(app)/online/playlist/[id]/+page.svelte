<script lang="ts">
	import { page } from '$app/state'
	import { jioSaavnService } from '$lib/services/jiosaavn'
	import { mapJioSaavnSongToTrack } from '$lib/services/jiosaavn-helpers'
	import type { TrackData } from '$lib/library/get/value'
	import TrackListItem from '$lib/components/tracks/TrackListItem.svelte'
	import Artwork from '$lib/components/Artwork.svelte'
	import { usePlayer } from '$lib/stores/player/use-store'

	const player = usePlayer()
	let id = $derived(page.params.id)

	let playlist = $state<any>(null)
	let tracks = $state<TrackData[]>([])
	let loading = $state(true)

	$effect(() => {
		if (id) {
			loading = true
			jioSaavnService.getPlaylistDetails(id).then(data => {
				playlist = data
				tracks = data.results?.map(mapJioSaavnSongToTrack) || []
				loading = false
			}).catch(err => {
				console.error("Playlist error:", err)
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
	{:else if playlist}
		<div class="mb-8 flex flex-col gap-6 md:flex-row md:items-end">
			<Artwork src={playlist.image} class="size-48 rounded-2xl shadow-xl md:size-64" />
			<div class="flex flex-col">
				<div class="mb-1 text-body-md font-medium text-primary">Playlist</div>
				<h1 class="mb-2 text-headline-lg font-bold">{playlist.title}</h1>
				<div class="text-title-md text-onSurfaceVariant">
					{tracks.length} songs
				</div>
			</div>
		</div>

		<div class="flex flex-col">
			{#each tracks as track, i}
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
						player.playTrack(i, tracks.map(s => s.id), {}, tracks)
					}}
				/>
			{/each}
		</div>
	{/if}
</div>
