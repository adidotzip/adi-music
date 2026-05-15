import { UNKNOWN_ITEM } from '$lib/library/types.ts'
import { SerialQueue } from './serial-queue.ts'

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
): Promise<string | undefined> => {
	if (artist === UNKNOWN_ITEM) {
		return undefined
	}

	const key = getStorageKey(artist)

	// Check cache first
	const cached = localStorage.getItem(key)
	if (cached) {
		return cached === 'none' ? undefined : cached
	}

	// Prevent duplicate requests
	const pending = pendingRequests.get(artist)
	if (pending) {
		return pending
	}

	const request = (async () => {
		try {
			return await queue.enqueue(async () => {
				// Re-check cache while waiting in queue
				const cached = localStorage.getItem(key)
				if (cached) {
					return cached === 'none' ? undefined : cached
				}

				try {
					const searchParams = new URLSearchParams({
						q: artist,
					})

					// Using Deezer search API
					const response = await fetch(
						`https://api.deezer.com/search/artist?${searchParams.toString()}`,
					)

					if (!response.ok) {
						localStorage.setItem(key, 'none')
						return undefined
					}

					const data =
						(await response.json()) as DeezerSearchResponse

					if (data.data && data.data.length > 0) {
						const bestMatch = data.data[0]

						// Prefer highest quality image
						const image =
							bestMatch.picture_xl ||
							bestMatch.picture_big ||
							bestMatch.picture_medium ||
							bestMatch.picture

						if (image) {
							localStorage.setItem(key, image)
							return image
						}
					}

					localStorage.setItem(key, 'none')
				} catch (error) {
					console.error('Failed to fetch artist artwork', error)
					localStorage.setItem(key, 'none')
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
