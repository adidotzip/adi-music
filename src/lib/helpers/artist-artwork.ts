import { UNKNOWN_ITEM } from '$lib/library/types.ts'
import { SerialQueue } from './serial-queue.ts'

const queue = new SerialQueue()

const NONE_CACHE_DURATION = 1000 * 60 * 30 // 30 mins

const pendingRequests = new Map<string, Promise<string | undefined>>()

const getStorageKey = (artist: string) =>
	`snaeplayer-artist-artwork.${artist}`

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

type CachedArtwork =
	| {
			type: 'image'
			value: string
			timestamp: number
	  }
	| {
			type: 'none'
			timestamp: number
	  }

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

		if (!raw) {
			return null
		}

		return JSON.parse(raw) as CachedArtwork
	} catch {
		return null
	}
}

// --------------------
// Main
// --------------------

export const getArtistArtwork = async (
	artist: string,
): Promise<string | undefined> => {
	if (!artist || artist === UNKNOWN_ITEM) {
		return undefined
	}

	const key = getStorageKey(artist)

	// Cache lookup
	const cached = safeGetStorage(key)

	if (cached) {
		if (cached.type === 'image') {
			return cached.value
		}

		if (
			cached.type === 'none' &&
			Date.now() - cached.timestamp < NONE_CACHE_DURATION
		) {
			return undefined
		}
	}

	// Deduplicate requests
	const pending = pendingRequests.get(artist)

	if (pending) {
		return pending
	}

	const request = (async () => {
		try {
			return await queue.enqueue(async () => {
				// Recheck cache after queue wait
				const cachedAgain = safeGetStorage(key)

				if (cachedAgain) {
					if (cachedAgain.type === 'image') {
						return cachedAgain.value
					}

					if (
						cachedAgain.type === 'none' &&
						Date.now() - cachedAgain.timestamp <
							NONE_CACHE_DURATION
					) {
						return undefined
					}
				}

				let bestImage: string | undefined

				try {
					const baseUrl =
						typeof window !== 'undefined'
							? window.location.origin
							: ''

					const response = await fetch(
						`${baseUrl}/api/artist-art?artist=${encodeURIComponent(
							artist,
						)}`,
						{
							headers: {
								Accept: 'application/json',
							},
						},
					)

					if (!response.ok) {
						console.warn(
							`[Artwork] API returned ${response.status} for "${artist}"`,
						)

						safeSetStorage(key, {
							type: 'none',
							timestamp: Date.now(),
						})

						return undefined
					}

					let data: DeezerSearchResponse

					try {
						const text = await response.text()

						// HTML response protection
						if (text.trim().startsWith('<')) {
							console.error(
								`[Artwork] HTML returned instead of JSON for "${artist}"`,
							)

							safeSetStorage(key, {
								type: 'none',
								timestamp: Date.now(),
							})

							return undefined
						}

						data = JSON.parse(text) as DeezerSearchResponse
					} catch (parseError) {
						console.error(
							`[Artwork] Failed to parse JSON for "${artist}"`,
							parseError,
						)

						safeSetStorage(key, {
							type: 'none',
							timestamp: Date.now(),
						})

						return undefined
					}

					if (data.data && data.data.length > 0) {
						const bestMatch = data.data[0]

						bestImage =
							bestMatch.picture_xl ||
							bestMatch.picture_big ||
							bestMatch.picture_medium ||
							bestMatch.picture
					}
				} catch (networkError: any) {
					const errorName =
						networkError?.name || 'Unknown Error'

					const errorMessage =
						networkError?.message || 'No message provided'

					console.error(
						`[Network Error] ${artist}: ${errorName} - ${errorMessage}`,
						networkError,
					)

					return undefined
				}

				if (bestImage) {
					safeSetStorage(key, {
						type: 'image',
						value: bestImage,
						timestamp: Date.now(),
					})

					return bestImage
				}

				safeSetStorage(key, {
					type: 'none',
					timestamp: Date.now(),
				})

				return undefined
			})
		} finally {
			pendingRequests.delete(artist)
		}
	})()

	pendingRequests.set(artist, request)

	return request
}
