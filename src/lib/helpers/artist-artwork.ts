import { UNKNOWN_ITEM } from '$lib/library/types.ts'
import { SerialQueue } from './serial-queue.ts'

const queue = new SerialQueue()

const NONE_CACHE_DURATION = 1000 * 60 * 30 // 30 mins
const DEFAULT_IMAGE = 'https://www.jiosaavn.com/_i/3.0/artist-default-music.png'
const JIOSAAVN_API = 'https://jiosaavn-apix.arcadopredator.workers.dev/api/search/artists'

const pendingRequests = new Map<string, Promise<string | undefined>>()

const getStorageKey = (artist: string) => `snaeplayer-artist-artwork.${artist}`

// --------------------
// Type Definitions
// --------------------

type JioSaavnImageNode = {
	quality: string
	url: string
}

type JioSaavnArtist = {
	id: string
	name: string
	role: string
	image: JioSaavnImageNode[]
	type: string
	url: string
}

type JioSaavnSearchResponse = {
	success: boolean
	data: {
		total: number
		start: number
		results: JioSaavnArtist[]
	}
}

type CachedArtwork =
	| { type: 'image'; value: string; timestamp: number }
	| { type: 'none'; timestamp: number }

// --------------------
// Storage Helpers
// --------------------

const safeSetStorage = (key: string, value: CachedArtwork) => {
	try {
		localStorage.setItem(key, JSON.stringify(value))
	} catch (error) {
		console.warn(`[Storage Warning] Failed to cache ${key}`, error)
	}
}

const safeGetStorage = (key: string): CachedArtwork | null => {
	try {
		const raw = localStorage.getItem(key)
		if (!raw) return null
		return JSON.parse(raw) as CachedArtwork
	} catch {
		return null
	}
}

// --------------------
// Artwork Resolution Helpers
// --------------------

/** Picks the highest-quality, non-placeholder image URL from a JioSaavn image array. */
const resolveBestImage = (images: JioSaavnImageNode[]): string | undefined => {
	if (!Array.isArray(images) || images.length === 0) return undefined

	for (let i = images.length - 1; i >= 0; i--) {
		const url = images[i]?.url
		if (url && url !== DEFAULT_IMAGE) return url
	}

	return undefined
}

/** Exact name match first (case-insensitive), falls back to first result. */
const resolveBestMatch = (
	results: JioSaavnArtist[],
	artist: string,
): JioSaavnArtist | undefined => {
	if (results.length === 0) return undefined
	const needle = artist.trim().toLowerCase()
	return results.find((r) => r.name?.toLowerCase() === needle) ?? results[0]
}

// --------------------
// Main
// --------------------

export const getArtistArtwork = async (
	artist: string,
): Promise<string | undefined> => {
	if (!artist || artist === UNKNOWN_ITEM) return undefined

	const key = getStorageKey(artist)

	// Cache lookup
	const cached = safeGetStorage(key)

	if (cached) {
		if (cached.type === 'image') return cached.value

		if (cached.type === 'none' && Date.now() - cached.timestamp < NONE_CACHE_DURATION) {
			return undefined
		}
	}

	// Deduplicate in-flight requests
	const pending = pendingRequests.get(artist)
	if (pending) return pending

	const request = (async () => {
		try {
			return await queue.enqueue(async () => {
				// Recheck cache after queue wait
				const cachedAgain = safeGetStorage(key)

				if (cachedAgain) {
					if (cachedAgain.type === 'image') return cachedAgain.value

					if (
						cachedAgain.type === 'none' &&
						Date.now() - cachedAgain.timestamp < NONE_CACHE_DURATION
					) {
						return undefined
					}
				}

				let bestImage: string | undefined

				try {
					const response = await fetch(
						`${JIOSAAVN_API}?query=${encodeURIComponent(artist)}`,
						{ headers: { Accept: 'application/json' } },
					)

					if (!response.ok) {
						console.warn(`[Artwork] JioSaavn returned ${response.status} for "${artist}"`)
						safeSetStorage(key, { type: 'none', timestamp: Date.now() })
						return undefined
					}

					let payload: JioSaavnSearchResponse

					try {
						const text = await response.text()

						if (text.trim().startsWith('<')) {
							console.error(`[Artwork] HTML returned instead of JSON for "${artist}"`)
							safeSetStorage(key, { type: 'none', timestamp: Date.now() })
							return undefined
						}

						payload = JSON.parse(text) as JioSaavnSearchResponse
					} catch (parseError) {
						console.error(`[Artwork] Failed to parse JSON for "${artist}"`, parseError)
						safeSetStorage(key, { type: 'none', timestamp: Date.now() })
						return undefined
					}

					if (payload.success && payload.data?.results) {
						const match = resolveBestMatch(payload.data.results, artist)
						if (match) bestImage = resolveBestImage(match.image)
					}
				} catch (networkError: any) {
					console.error(
						`[Network Error] ${artist}: ${networkError?.name ?? 'Unknown'} - ${networkError?.message ?? 'No message'}`,
						networkError,
					)
					return undefined
				}

				if (bestImage) {
					safeSetStorage(key, { type: 'image', value: bestImage, timestamp: Date.now() })
					return bestImage
				}

				safeSetStorage(key, { type: 'none', timestamp: Date.now() })
				return undefined
			})
		} finally {
			pendingRequests.delete(artist)
		}
	})()

	pendingRequests.set(artist, request)
	return request
}
