<script lang="ts">
	import { page } from '$app/state'
	import { JioSaavnService, mapJioSaavnSongToTrackData, type JioSaavnSong } from '$lib/services/jiosaavn'
	import Artwork from '$lib/components/Artwork.svelte'
	import Header from '$lib/components/Header.svelte'
	import Icon from '$lib/components/icon/Icon.svelte'
	import ListItem from '$lib/components/ListItem.svelte'
	import IconButton from '$lib/components/IconButton.svelte'
	import Button from '$lib/components/Button.svelte'

	const type = $derived(page.params.type)
	const id = $derived(page.params.id)

	let data = $state<any>(null)
	let loading = $state(true)
    let error = $state<string | null>(null)

	const player = usePlayer()

	const fetchData = async () => {
		if (!id || !type) return
		loading = true
        error = null
		try {
			let res: any
			if (type === 'album') res = await JioSaavnService.getAlbumDetails(id)
			else if (type === 'artist') res = await JioSaavnService.getArtistDetails(id)
			else if (type === 'playlist') res = await JioSaavnService.getPlaylistDetails(id)

			data = res
            // Pre-cache songs
            if (data?.songs) {
                for (const song of data.songs) {
                    mapJioSaavnSongToTrackData(song)
                }
            }
		} catch (e) {
			console.error('Failed to fetch details', e)
            error = 'Failed to load details. Please check your connection.'
		} finally {
			loading = false
		}
	}

	$effect(() => {
		fetchData()
	})

	const playAll = () => {
		if (!data?.songs) return
		const tracks = data.songs.map(mapJioSaavnSongToTrackData)
		player.playTrack(0, tracks.map((t: any) => t.id))
	}

    const playSong = (song: JioSaavnSong) => {
        const track = mapJioSaavnSongToTrackData(song)
        player.playTrack(0, [track.id])
    }
</script>

<Header title={type ? type.charAt(0).toUpperCase() + type.slice(1) : ''} />

{#if loading}
	<div class="flex grow flex-col px-4 pb-20">
		<section class="flex flex-col items-center gap-6 py-6 md:flex-row md:items-end">
			<div class="size-48 rounded-2xl bg-surfaceContainer animate-pulse md:size-64"></div>
			<div class="flex grow flex-col items-center gap-4 md:items-start">
				<div class="h-10 w-64 rounded-lg bg-surfaceContainerHigh animate-pulse"></div>
				<div class="h-6 w-48 rounded-lg bg-surfaceContainerHigh animate-pulse"></div>
				<div class="mt-4 h-12 w-32 rounded-full bg-surfaceContainerHigh animate-pulse"></div>
			</div>
		</section>
        <div class="mt-8 flex flex-col gap-2">
            {#each Array(5) as _}
                <div class="h-16 w-full rounded-xl bg-surfaceContainer animate-pulse"></div>
            {/each}
        </div>
	</div>
{:else if error}
    <div class="m-auto flex flex-col items-center gap-4 py-20 text-center">
        <Icon type="alertCircle" class="size-16 text-error opacity-54" />
        <div class="text-body-lg text-error">{error}</div>
        <Button kind="outlined" onclick={fetchData}>Retry</Button>
    </div>
{:else if data}
	<div class="flex grow flex-col px-4 pb-20">
		<section class="flex flex-col items-center gap-6 py-6 md:flex-row md:items-end">
			<Artwork
				src={data.image?.[data.image.length - 1]?.url}
				class="size-48 rounded-2xl shadow-xl md:size-64"
				fallbackIcon={type === 'artist' ? 'person' : 'album'}
			/>
			<div class="flex flex-col items-center gap-2 md:items-start">
				<h1 class="text-center text-headline-md md:text-left">{data.name}</h1>
				<div class="text-body-lg opacity-54">
					{#if type === 'album'}
						{data.artists?.primary?.map((a: any) => a.name).join(', ')} • {data.year}
					{:else if type === 'artist'}
						Artist
					{:else}
						Playlist
					{/if}
				</div>
				<div class="mt-4 flex gap-2">
					<Button kind="filled" onclick={playAll} disabled={!data.songs?.length}>
						<Icon type="musicNote" />
						Play
					</Button>
				</div>
			</div>
		</section>

		{#if data.songs?.length}
			<div class="mt-8 flex flex-col gap-1">
				{#each data.songs as song}
					<ListItem
                        ariaLabel={m.trackPlay({ name: song.name })}
                        ariaRowIndex={0}
                        tabindex={0}
						onclick={() => playSong(song)}
						class="h-16 rounded-xl hover:bg-onSurface/5"
					>
						<Artwork
							src={song.image?.[0]?.url}
							class="mr-4 size-12 rounded-lg"
						/>
						<div class="flex flex-col truncate">
							<div class="truncate text-body-lg">{song.name}</div>
							<div class="truncate text-body-sm opacity-54">{song.artists?.primary?.map((a: any) => a.name).join(', ')}</div>
						</div>
						<IconButton icon="musicNote" tooltip={m.play()} class="ml-auto" />
					</ListItem>
				{/each}
			</div>
		{/if}
	</div>
{/if}
