import { UNKNOWN_ITEM } from '$lib/library/types.ts'
import { SerialQueue } from './serial-queue.ts'

const queue = new SerialQueue()

const NONE_CACHE_DURATION = 1000 * 60 * 30 // 30 mins
const DEFAULT_IMAGE = 'https://www.jiosaavn.com/_i/3.0/artist-default-music.png'

const JIOSAAVN_API =
	'https://jiosaavn-apix.arcadopredator.workers.dev/api/search/artists'

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
// Text Helpers
// --------------------

const normalize = (value: string) =>
	value
		.normalize('NFD')
		.replace(/\p{Diacritic}/gu, '')
		.toLowerCase()
		.trim()

// --------------------
// Artwork Resolution Helpers
// --------------------

/** Picks highest quality valid image */
const resolveBestImage = (images: JioSaavnImageNode[]): string | undefined => {
	if (!Array.isArray(images) || images.length === 0) return undefined

	const sorted = [...images].sort((a, b) => {
		const getSize = (quality: string) => Number.parseInt(quality.split('x')[0] ?? '0')

		return getSize(b.quality) - getSize(a.quality)
	})

	for (const image of sorted) {
		const url = image?.url

		if (
			url &&
			url !== DEFAULT_IMAGE &&
			url.startsWith('http')
		) {
			return url
		}
	}

	return undefined
}

/** Exact normalized match first, fallback to first result */
const resolveBestMatch = (
	results: JioSaavnArtist[],
	artist: string,
): JioSaavnArtist | undefined => {
	if (results.length === 0) return undefined

	const needle = normalize(artist)

	return (
		results.find((result) => normalize(result.name ?? '') === needle) ??
		results[0]
	)
}

// --------------------
// Network Helpers
// --------------------

const delay = (ms: number) =>
	new Promise((resolve) => setTimeout(resolve, ms))

const fetchWithRetry = async (
	url: string,
	retries = 2,
): Promise<Response> => {
	let lastError: unknown

	for (let attempt = 0; attempt <= retries; attempt++) {
		try {
			const response = await fetch(url, {
				headers: {
					Accept: 'application/json',
					'Cache-Control': 'no-cache',
				},
			})

			if (response.ok) {
				return response
			}

			console.warn(
				`[Artwork] Attempt ${attempt + 1} failed with ${response.status}`,
			)
		} catch (error) {
			lastError = error

			console.warn(
				`[Artwork] Network retry ${attempt + 1} failed`,
				error,
			)
		}

		if (attempt < retries) {
			await delay(500 * (attempt + 1))
		}
	}

	throw lastError ?? new Error('Unknown fetch failure')
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

	// --------------------
	// Cache Lookup
	// --------------------

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

	// --------------------
	// Prevent Duplicate Requests
	// --------------------

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
						Date.now() - cachedAgain.timestamp < NONE_CACHE_DURATION
					) {
						return undefined
					}
				}

				let bestImage: string | undefined

				try {
					const response = await fetchWithRetry(
						`${JIOSAAVN_API}?query=${encodeURIComponent(artist)}`,
					)

					const contentType = response.headers.get('content-type')

					if (!contentType?.includes('application/json')) {
						console.error(
							`[Artwork] Invalid content type for "${artist}":`,
							contentType,
						)

						safeSetStorage(key, {
							type: 'none',
							timestamp: Date.now(),
						})

						return undefined
					}

					const text = await response.text()

					// HTML instead of JSON
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

					// Detect truncated payload
					if (!text.trim().endsWith('}')) {
						console.error(
							`[Artwork] Truncated JSON received for "${artist}"`,
						)

						return undefined
					}

					let payload: JioSaavnSearchResponse

					try {
						payload = JSON.parse(text) as JioSaavnSearchResponse
					} catch (parseError) {
						console.error(
							`[Artwork] Failed to parse JSON for "${artist}"`,
							parseError,
						)

						return undefined
					}

					if (payload.success && payload.data?.results?.length) {
						const match = resolveBestMatch(
							payload.data.results,
							artist,
						)

						if (match) {
							bestImage = resolveBestImage(match.image)
						}
					}
				} catch (networkError: any) {
					console.error(
						`[Artwork] Network Error "${artist}": ${
							networkError?.message ?? 'Unknown error'
						}`,
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
