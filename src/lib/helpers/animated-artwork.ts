import { SerialQueue } from './serial-queue.ts'

const getStorageKey = (artist: string, album: string, title?: string) =>
	`snaeplayer-animated-artwork-v2.${artist}:${album}${title ? `:${title}` : ''}`

const queue = new SerialQueue()

export interface AnimatedArtwork {
	url: string
	urlTall?: string
}

const pendingRequests = new Map<string, Promise<AnimatedArtwork | undefined>>()

export const getAnimatedArtwork = async (
	artist: string,
	album: string,
	title?: string,
): Promise<AnimatedArtwork | undefined> => {
	const key = getStorageKey(artist, album, title)
	const cached = localStorage.getItem(key)
	if (cached) {
		if (cached === 'none') return undefined
		try {
			return JSON.parse(cached)
		} catch {
			return { url: cached }
		}
	}

	const pending = pendingRequests.get(key)
	if (pending) {
		return pending
	}

	const request = (async () => {
		try {
			return await queue.enqueue(async () => {
				// Re-check cache in case it was populated while waiting in queue
				const cached = localStorage.getItem(key)
				if (cached) {
					return cached === 'none' ? undefined : cached
				}

				try {
					const params: Record<string, string> = { artist, album }
					if (title) {
						params.title = title
					}
					const searchParams = new URLSearchParams(params)
					const response = await fetch(
						`https://artwork.m8tec.top/api/v1/artwork/search?${searchParams.toString()}`,
					)

					if (!response.ok) {
						if (response.status === 404) {
							localStorage.setItem(key, 'none')
						}
						return undefined
					}

					const data = (await response.json()) as { url?: string; url_tall?: string }
					if (data.url) {
						const result: AnimatedArtwork = {
							url: data.url,
							urlTall: data.url_tall,
						}
						localStorage.setItem(key, JSON.stringify(result))
						return result
					}

					localStorage.setItem(key, 'none')
				} catch (error) {
					console.error('Failed to fetch animated artwork', error)
					localStorage.setItem(key, 'none')
				}

				return undefined
			})
		} finally {
			pendingRequests.delete(key)
		}
	})()

	pendingRequests.set(key, request)
	return request
}
