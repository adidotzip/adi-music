import { UNKNOWN_ITEM } from '$lib/library/types.ts'
import { SerialQueue } from './serial-queue.ts'

// Check if we are running in the browser
const isBrowser = typeof window !== 'undefined'

const getStorageKey = (artist: string) => `snaeplayer-artist-artwork.${artist}`

const queue = new SerialQueue()
const pendingRequests = new Map<string, Promise<string | undefined>>()

type DeezerArtist = {
	name: string
	picture?: string
	picture_medium?: string
	picture_big?: string
	picture_xl?: string
}

type DeezerSearchResponse = {
	data: DeezerArtist[]
}

export const getArtistArtwork = async (
	artist: string,
    // Allows passing SvelteKit's special fetch during SSR if needed
    customFetch: typeof fetch = fetch 
): Promise<string | undefined> => {
	if (artist === UNKNOWN_ITEM) {
		return undefined
	}

	const key = getStorageKey(artist)

	// 1. Guard cache checks behind environment check
	if (isBrowser) {
		const cached = localStorage.getItem(key)
		if (cached) {
			return cached === 'none' ? undefined : cached
		}
	}

	const pending = pendingRequests.get(artist)
	if (pending) {
		return pending
	}

	const request = (async () => {
		try {
			return await queue.enqueue(async () => {
				// Re-check cache while waiting in queue
				if (isBrowser) {
					const cached = localStorage.getItem(key)
					if (cached) {
						return cached === 'none' ? undefined : cached
					}
				}

				try {
					// 2. Use customFetch to prevent relative URL crashes in SSR
					const response = await customFetch(
						`/api/deezer?artist=${encodeURIComponent(artist)}`,
					)

					if (!response.ok) {
						if (isBrowser) localStorage.setItem(key, 'none')
						return undefined
					}

					const data = (await response.json()) as DeezerSearchResponse

					if (data.data && data.data.length > 0) {
						const bestMatch = data.data[0]

						// 3. Double-check proxy response! 
                        // If proxy hits standard /search, you need: bestMatch.artist.picture_xl
						const image =
							bestMatch.picture_xl ||
							bestMatch.picture_big ||
							bestMatch.picture_medium ||
							bestMatch.picture

						if (image) {
							if (isBrowser) localStorage.setItem(key, image)
							return image
						}
					}

					if (isBrowser) localStorage.setItem(key, 'none')
				} catch (error) {
					console.error('Failed to fetch artist artwork', error)
					// Don't cache 'none' on network/parsing error to allow retry
				}

				return undefined
			})
		} finally {
			pendingRequests.delete(artist)
		}
	})()

	pendingRequests.set(artist, request)

	return request
}
