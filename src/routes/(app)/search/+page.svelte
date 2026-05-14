<script lang="ts">
	import { JioSaavnService, mapJioSaavnSongToTrackData, type JioSaavnSong, type JioSaavnAlbum, type JioSaavnArtist, type JioSaavnPlaylist } from '$lib/services/jiosaavn'
	import Artwork from '$lib/components/Artwork.svelte'
	import Icon from '$lib/components/icon/Icon.svelte'
	import IconButton from '$lib/components/IconButton.svelte'
	import ListItem from '$lib/components/ListItem.svelte'
	import Button from '$lib/components/Button.svelte'
    import Tabs from '$lib/components/Tabs.svelte'
	import { debounce } from '$lib/helpers/utils/debounce.ts'
    import { goto } from '$app/navigation'
    import { onMount } from 'svelte'

	let query = $state('')
	let loading = $state(false)
    let error = $state<string | null>(null)
    let activeTabIndex = $state(0)

	let results = $state<{
		songs: JioSaavnSong[]
		albums: JioSaavnAlbum[]
		artists: JioSaavnArtist[]
		playlists: JioSaavnPlaylist[]
	}>({ songs: [], albums: [], artists: [], playlists: [] })

    let recentSearches = $state<string[]>([])

	const player = usePlayer()

    onMount(() => {
        const saved = localStorage.getItem('recentSearches')
        if (saved) {
            try {
                recentSearches = JSON.parse(saved)
            } catch (e) {
                console.error('Failed to parse recent searches', e)
            }
        }
    })

    const saveSearch = (q: string) => {
        if (!q.trim()) return
        const updated = [q, ...recentSearches.filter(s => s !== q)].slice(0, 10)
        recentSearches = updated
        localStorage.setItem('recentSearches', JSON.stringify(updated))
    }

    const removeSearch = (q: string) => {
        recentSearches = recentSearches.filter(s => s !== q)
        localStorage.setItem('recentSearches', JSON.stringify(recentSearches))
    }

    const tabs = [
        { id: 'all', text: 'All' },
        { id: 'songs', text: 'Songs' },
        { id: 'albums', text: 'Albums' },
        { id: 'artists', text: 'Artists' },
        { id: 'playlists', text: 'Playlists' },
    ]

	const performSearch = debounce(async (q: string, index: number) => {
		if (!q.trim()) {
			results = { songs: [], albums: [], artists: [], playlists: [] }
            error = null
			return
		}

		loading = true
        error = null
        const tab = tabs[index]?.id || 'all'
		try {
            if (tab === 'all') {
                const res = await JioSaavnService.searchAll(q)
                if (res.success) {
                    results = {
                        songs: res.data.songs.results,
                        albums: res.data.albums.results,
                        artists: res.data.artists.results,
                        playlists: res.data.playlists.results
                    }
                }
            } else if (tab === 'songs') {
                const res = await JioSaavnService.searchSongs(q)
                results.songs = res.data.results
            } else if (tab === 'albums') {
                const res = await JioSaavnService.searchAlbums(q)
                results.albums = res.data.results
            } else if (tab === 'artists') {
                const res = await JioSaavnService.searchArtists(q)
                results.artists = res.data.results
            } else if (tab === 'playlists') {
                const res = await JioSaavnService.searchPlaylists(q)
                results.playlists = res.data.results
            }
		} catch (e) {
			console.error('Search failed', e)
            error = 'Network error. Please check your connection.'
		} finally {
			loading = false
		}
	}, 500)

	$effect(() => {
		performSearch(query, activeTabIndex)
	})

    const handleKeydown = (e: KeyboardEvent) => {
        if (e.key === 'Enter' && query.trim()) {
            saveSearch(query)
            ;(e.target as HTMLInputElement).blur()
        }
    }

	const playSong = (song: JioSaavnSong) => {
        saveSearch(query)
		const trackData = mapJioSaavnSongToTrackData(song)
		player.playTrack(0, [trackData.id])
	}

    const navigateToDetail = (type: string, id: string) => {
        saveSearch(query)
        goto(`/online/${type}/${id}`)
    }

    const currentTabId = $derived(tabs[activeTabIndex]?.id || 'all')
</script>

{#snippet tabText(tab: { text: string })}
    {tab.text}
{/snippet}

<div class="flex grow flex-col px-4">
	<div class="sticky top-2 z-10 my-4 flex flex-col gap-4 rounded-3xl bg-surfaceContainerHigh p-4 shadow-sm ring-1 ring-outlineVariant focus-within:ring-2 focus-within:ring-primary">
        <div class="flex items-center gap-2">
            <Icon type="magnify" class="size-5 opacity-54" />
            <input
                bind:value={query}
                type="text"
                onkeydown={handleKeydown}
                placeholder="Search for songs, albums, artists..."
                class="h-10 grow bg-transparent text-body-md outline-none placeholder:text-onSurfaceVariant"
            />
            {#if query}
                <IconButton icon="close" tooltip="Clear" class="size-8" onclick={() => { query = ''; results = { songs: [], albums: [], artists: [], playlists: [] }; }} />
            {/if}
        </div>

        {#if query}
            <Tabs
                items={tabs}
                selectedIndex={activeTabIndex}
                onchange={(_, i) => activeTabIndex = i}
                text={tabText}
            />
        {/if}
	</div>

	{#if loading}
		<div class="flex flex-col gap-8 pb-20 mt-4">
            <section>
                <div class="mb-4 ml-2 h-6 w-24 rounded-lg bg-surfaceContainer animate-pulse"></div>
                <div class="flex flex-col gap-2">
                    {#each Array(3) as _}
                        <div class="h-16 w-full rounded-xl bg-surfaceContainer animate-pulse"></div>
                    {/each}
                </div>
            </section>
        </div>
    {:else if error}
        <div class="m-auto flex flex-col items-center gap-4 py-20 text-center">
            <Icon type="alertCircle" class="size-16 text-error opacity-54" />
            <div class="text-body-lg text-error">{error}</div>
            <Button kind="outlined" onclick={() => performSearch(query, activeTabIndex)}>Retry</Button>
        </div>
	{:else if query && (results.songs.length || results.albums.length || results.artists.length || results.playlists.length)}
		<div class="flex flex-col gap-8 pb-20 mt-4">
			{#if (currentTabId === 'all' || currentTabId === 'songs') && results.songs.length > 0}
				<section>
					<h2 class="mb-4 px-2 text-title-md font-bold text-primary">Songs</h2>
					<div class="flex flex-col gap-1">
						{#each results.songs as song, i}
							<ListItem
                                ariaLabel={song.name}
                                ariaRowIndex={i}
                                tabindex={0}
								onclick={() => playSong(song)}
								class="h-16 rounded-xl hover:bg-onSurface/5"
							>
								<Artwork
									src={song.image[0]?.url}
									class="mr-4 size-12 rounded-lg"
								/>
								<div class="flex flex-col truncate">
									<div class="truncate text-body-md font-medium">{song.name}</div>
									<div class="truncate text-body-sm opacity-54">{song.artists.primary.map(a => a.name).join(', ')}</div>
								</div>
								<IconButton icon="musicNote" tooltip="Play" class="ml-auto" />
							</ListItem>
						{/each}
					</div>
				</section>
			{/if}

			{#if (currentTabId === 'all' || currentTabId === 'albums') && results.albums.length > 0}
				<section>
					<h2 class="mb-4 px-2 text-title-md font-bold text-primary">Albums</h2>
					<div class="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
						{#each results.albums as album}
							<button
                                class="interactable group flex flex-col gap-2 rounded-2xl p-2 text-left hover:bg-onSurface/5"
                                onclick={() => navigateToDetail('album', album.id)}
                            >
								<Artwork
									src={album.image?.[album.image.length - 1]?.url}
									class="aspect-square w-full rounded-2xl shadow-sm transition-transform group-active:scale-95"
                                    fallbackIcon="album"
								/>
								<div class="px-1">
									<div class="truncate text-body-md font-medium">{album.name}</div>
								</div>
							</button>
						{/each}
					</div>
				</section>
			{/if}

            {#if (currentTabId === 'all' || currentTabId === 'playlists') && results.playlists.length > 0}
				<section>
					<h2 class="mb-4 px-2 text-title-md font-bold text-primary">Playlists</h2>
					<div class="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
						{#each results.playlists as playlist}
							<button
                                class="interactable group flex flex-col gap-2 rounded-2xl p-2 text-left hover:bg-onSurface/5"
                                onclick={() => navigateToDetail('playlist', playlist.id)}
                            >
								<Artwork
									src={playlist.image?.[playlist.image.length - 1]?.url}
									class="aspect-square w-full rounded-2xl shadow-sm transition-transform group-active:scale-95"
                                    fallbackIcon="playlist"
								/>
								<div class="px-1">
									<div class="truncate text-body-md font-medium">{playlist.name}</div>
								</div>
							</button>
						{/each}
					</div>
				</section>
			{/if}

            {#if (currentTabId === 'all' || currentTabId === 'artists') && results.artists.length > 0}
				<section>
					<h2 class="mb-4 px-2 text-title-md font-bold text-primary">Artists</h2>
					<div class="flex flex-col gap-1">
						{#each results.artists as artist, i}
							<ListItem
                                ariaLabel={artist.name}
                                ariaRowIndex={i}
                                tabindex={0}
								onclick={() => navigateToDetail('artist', artist.id)}
								class="h-16 rounded-xl hover:bg-onSurface/5"
							>
								<Artwork
									src={artist.image?.[artist.image.length - 1]?.url}
									class="mr-4 size-12 rounded-full shadow-sm"
                                    fallbackIcon="person"
								/>
								<div class="truncate text-body-md font-medium">{artist.name}</div>
								<Icon type="chevronRight" class="ml-auto opacity-54" />
							</ListItem>
						{/each}
					</div>
				</section>
			{/if}
		</div>
    {:else if query}
        <div class="m-auto flex flex-col items-center gap-4 py-20 text-center opacity-54">
            <Icon type="magnify" class="size-20" />
            <div class="max-w-60 text-body-lg">No results found for "{query}"</div>
        </div>
	{:else if !query}
        {#if recentSearches.length > 0}
            <div class="flex flex-col gap-4 pb-20 mt-4">
                <div class="flex items-center justify-between px-2">
                    <h2 class="text-title-md font-bold text-primary">Recent searches</h2>
                    <Button kind="blank" class="text-primary text-body-sm" onclick={() => { recentSearches = []; localStorage.removeItem('recentSearches'); }}>
                        Clear all
                    </Button>
                </div>
                <div class="flex flex-col gap-1">
                    {#each recentSearches as q, i}
                        <ListItem
                            ariaLabel={q}
                            ariaRowIndex={i}
                            tabindex={0}
                            onclick={() => (query = q)}
                            class="h-12 rounded-xl hover:bg-onSurface/5"
                        >
                            <Icon type="cached" class="mr-4 size-5 opacity-54" />
                            <div class="truncate text-body-md grow">{q}</div>
                            <IconButton icon="close" tooltip="Remove" class="ml-auto size-8" onclick={(e) => { e.stopPropagation(); removeSearch(q); }} />
                        </ListItem>
                    {/each}
                </div>
            </div>
        {:else}
            <div class="m-auto flex flex-col items-center gap-4 py-20 text-center opacity-54">
                <Icon type="magnify" class="size-20" />
                <div class="max-w-60 text-body-lg">Search for your favorite music from JioSaavn</div>
            </div>
        {/if}
	{/if}
</div>
