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

// Helper to safely interact with localStorage
const safeSetStorage = (key: string, value: string) => {
	try {
		localStorage.setItem(key, value)
	} catch (error) {
		console.warn(`[Storage Warning] Could not cache artwork for ${key}`, error)
	}
}

const safeGetStorage = (key: string): string | null => {
	try {
		return localStorage.getItem(key)
	} catch (error) {
		return null
	}
}

export const getArtistArtwork = async (
	artist: string,
): Promise<string | undefined> => {
	if (artist === UNKNOWN_ITEM) {
		return undefined
	}

	const key = getStorageKey(artist)

	// Check cache safely
	const cached = safeGetStorage(key)
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
				// Re-check cache safely while waiting in queue
				const cached = safeGetStorage(key)
				if (cached) {
					return cached === 'none' ? undefined : cached
				}

				let bestImage: string | undefined;

				// Block 1: Network Fetch
				try {
					const response = await fetch(
						`/api/deezer?artist=${encodeURIComponent(artist)}`,
					)

					if (!response.ok) {
						safeSetStorage(key, 'none')
						return undefined
					}

					const data = (await response.json()) as DeezerSearchResponse

					if (data.data && data.data.length > 0) {
						const bestMatch = data.data[0]
						bestImage =
							bestMatch.picture_xl ||
							bestMatch.picture_big ||
							bestMatch.picture_medium ||
							bestMatch.picture
					}
				} catch (networkError) {
					// This now ONLY catches real network/fetch errors.
					// If you still see this, an ad-blocker or tracker prevention is blocking "/api/deezer".
					console.error(`[Network Error] Failed to fetch artwork for ${artist}:`, networkError)
					return undefined 
				}

				// Block 2: Caching and Returning
				if (bestImage) {
					safeSetStorage(key, bestImage)
					return bestImage
				} else {
					safeSetStorage(key, 'none')
					return undefined
				}
			})
		} finally {
			pendingRequests.delete(artist)
		}
	})()

	pendingRequests.set(artist, request)

	return request
}
