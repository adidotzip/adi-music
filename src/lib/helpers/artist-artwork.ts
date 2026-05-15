import { UNKNOWN_ITEM } from '$lib/library/types.ts'

const getStorageKey = (artist: string) => `snaeplayer-artist-artwork.${artist}`

export const getArtistArtwork = async (artist: string): Promise<string | undefined> => {
	if (artist === UNKNOWN_ITEM) {
		return undefined
	}

	const key = getStorageKey(artist)
	const cached = localStorage.getItem(key)
	if (cached) {
		return cached === 'none' ? undefined : cached
	}

	try {
		// Searching for album is more reliable to get artwork for an artist in iTunes API
		// as artists often don't have a direct 'artworkUrl' in the musicArtist entity.
		const searchParams = new URLSearchParams({
			term: artist,
			entity: 'album',
			limit: '1',
		})
		const response = await fetch(`https://itunes.apple.com/search?${searchParams.toString()}`)

		if (!response.ok) {
			return undefined
		}

		const data = (await response.json()) as { results: { artworkUrl100?: string }[] }
		if (data.results && data.results.length > 0 && data.results[0].artworkUrl100) {
			// Upgrade image size from 100x100 to 600x600
			const url = data.results[0].artworkUrl100.replace('100x100bb.jpg', '600x600bb.jpg')
			localStorage.setItem(key, url)
			return url
		}

		localStorage.setItem(key, 'none')
	} catch (error) {
		console.error('Failed to fetch artist artwork', error)
	}

	return undefined
}
