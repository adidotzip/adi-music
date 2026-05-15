const getStorageKey = (artist: string, album: string) =>
	`snaeplayer-animated-artwork.${artist}:${album}`

export const getAnimatedArtwork = async (
	artist: string,
	album: string,
): Promise<string | undefined> => {
	const key = getStorageKey(artist, album)
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
	}

	return undefined
}
