import { SerialQueue } from './serial-queue.ts'

const getStorageKey = (artist: string, album: string) =>
	`snaeplayer-animated-artwork.${artist}:${album}`

const queue = new SerialQueue()
const pendingRequests = new Map<string, Promise<string | undefined>>()

export const getAnimatedArtwork = async (
	artist: string,
	album: string,
): Promise<string | undefined> => {
	const key = getStorageKey(artist, album)
	const cached = localStorage.getItem(key)
	if (cached) {
		return cached === 'none' ? undefined : cached
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
					const searchParams = new URLSearchParams({ artist, album })
					const response = await fetch(
						`https://artwork.m8tec.top/api/v1/artwork/search?${searchParams.toString()}`,
					)

					if (!response.ok) {
						localStorage.setItem(key, 'none')
						return undefined
					}

					const data = (await response.json()) as { url?: string }
					if (data.url) {
						localStorage.setItem(key, data.url)
						return data.url
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
