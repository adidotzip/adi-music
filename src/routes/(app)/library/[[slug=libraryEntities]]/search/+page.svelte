<script lang="ts">
	import Button from '$lib/components/Button.svelte'
	import IconButton from '$lib/components/IconButton.svelte'
	import Icon from '$lib/components/icon/Icon.svelte'
	import ScrollContainer from '$lib/components/ScrollContainer.svelte'
	import Spinner from '$lib/components/Spinner.svelte'
	import TextField from '$lib/components/TextField.svelte'
	import { type SaavnSearchSong, searchSongs } from '$lib/jiosaavn/api.ts'
	import { downloadAndAddTrack } from '$lib/jiosaavn/download.ts'
	import { m } from '$paraglide/messages';

	let searchQuery = $state('')
	let isSearching = $state(false)
	let searchResults = $state<SaavnSearchSong[]>([])
	let searchError = $state<string | null>(null)

	async function performSearch(e?: Event) {
		e?.preventDefault()
		if (!searchQuery.trim()) return

		isSearching = true
		searchError = null
		try {
			searchResults = await searchSongs(searchQuery)
		} catch (err) {
			searchError = err instanceof Error ? err.message : 'Unknown error'
		} finally {
			isSearching = false
		}
	}

	let downloadingSongs = $state<Set<string>>(new Set())
	async function handleDownload(songId: string) {
		downloadingSongs = new Set([...downloadingSongs, songId])
		await downloadAndAddTrack(songId)
		downloadingSongs.delete(songId)
		downloadingSongs = new Set([...downloadingSongs])
	}
</script>

<div class="flex h-full flex-col">
	<div class="p-4 pt-8">
		<form class="flex items-center gap-2" onsubmit={performSearch}>
			<TextField
				type="text"
				name="search"
				bind:value={searchQuery}
				placeholder="Search JioSaavn..."
				class="w-full"
			/>
			<Button onclick={performSearch} disabled={isSearching || !searchQuery.trim()}>
				{m.search()}
			</Button>
		</form>
	</div>

	<ScrollContainer class="grow px-4 pb-4">
		{#if isSearching}
			<div class="flex flex-col items-center justify-center p-8">
				<Spinner class="size-10" />
			</div>
		{:else if searchError}
			<div class="flex flex-col items-center justify-center p-8 text-error">
				<Icon type="alertCircle" class="mb-2 size-8" />
				<div>{searchError}</div>
			</div>
		{:else if searchResults.length > 0}
			<div class="flex flex-col gap-2">
				{#each searchResults as song}
					<div class="flex items-center gap-4 rounded-xl bg-surfaceContainer p-2">
						{#if song.image}
							<img src={song.image} alt={song.title} class="size-14 rounded-lg object-cover" />
						{:else}
							<div class="flex size-14 items-center justify-center rounded-lg bg-surfaceContainerHigh">
								<Icon type="musicNote" />
							</div>
						{/if}
						<div class="flex grow flex-col overflow-hidden">
							<div class="truncate text-body-lg font-medium">{song.title}</div>
							<div class="truncate text-body-sm opacity-70">{song.more_info.singers || song.description}</div>
						</div>
						<div class="flex items-center">
							{#if downloadingSongs.has(song.id)}
								<Spinner class="size-6 mr-2 opacity-70" />
							{:else}
								<IconButton icon="cached" onclick={() => handleDownload(song.id)} tooltip={m.libraryImportTracks()} />
							{/if}
						</div>
					</div>
				{/each}
			</div>
		{:else if searchQuery && !isSearching}
			<div class="flex flex-col items-center justify-center p-8 opacity-70">
				<div>{m.libraryNoResults()}</div>
			</div>
		{/if}
	</ScrollContainer>
</div>
