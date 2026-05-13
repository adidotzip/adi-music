<script lang="ts">
	import { goto } from '$app/navigation'
	import Button from '$lib/components/Button.svelte'
	import Icon from '$lib/components/icon/Icon.svelte'
	import { debounce } from '$lib/helpers/utils/debounce'

	let searchTerm = $state('')

	const handleSearch = debounce((term: string) => {
		if (term.trim()) {
			void goto(`/online/search?q=${encodeURIComponent(term)}`)
		}
	}, 500)

	$effect(() => {
		handleSearch(searchTerm)
	})
</script>

<div class="mx-auto flex w-full max-w-(--app-max-content-width) flex-col px-4 pt-8">
	<div class="mb-12 text-center">
		<h1 class="mb-4 text-display-md font-bold">Discover Music</h1>
		<p class="text-body-lg text-onSurfaceVariant">Search and stream millions of tracks from JioSaavn</p>
	</div>

	<div
		class="relative mx-auto mb-12 flex w-full max-w-160 items-center rounded-2xl border border-primary/10 bg-surfaceContainerHighest px-4 shadow-sm focus-within:border-primary/30"
	>
		<Icon type="magnify" class="mr-3 opacity-54" />
		<input
			bind:value={searchTerm}
			type="text"
			placeholder="Search for songs, albums, or artists..."
			class="h-16 w-full bg-transparent text-title-md focus:outline-none"
		/>
	</div>

	<div class="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
		<!-- Featured or trending categories could go here -->
		<div class="rounded-3xl bg-secondaryContainer p-8 text-onSecondaryContainer">
			<Icon type="flash" class="mb-4 size-10" />
			<h2 class="mb-2 text-title-lg font-bold">Trending</h2>
			<p>Check out what's popular right now.</p>
		</div>

		<div class="rounded-3xl bg-tertiaryContainer p-8 text-onTertiaryContainer">
			<Icon type="palette" class="mb-4 size-10" />
			<h2 class="mb-2 text-title-lg font-bold">New Releases</h2>
			<p>Stay updated with the latest music.</p>
		</div>

		<div class="rounded-3xl bg-surfaceContainerHigh p-8">
			<Icon type="playlist" class="mb-4 size-10 text-primary" />
			<h2 class="mb-2 text-title-lg font-bold">Curated Playlists</h2>
			<p>Perfect soundtracks for every mood.</p>
		</div>
	</div>
</div>
