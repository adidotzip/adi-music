class Artwork {
	static idCounter = 0

	static createRefId() {
		const index = Artwork.idCounter
		Artwork.idCounter += 1

		return index
	}

	key: Blob | string

	url: string

	refs = new Set<number>()

	constructor(image: Blob | string) {
		this.key = image
		if (typeof image === 'string') {
			this.url = image
		} else {
			this.url = URL.createObjectURL(image)
		}
	}
}

const cache = new Map<Blob | string, Artwork>()
const cleanupQueue = new Set<Blob | string>()
let isCleanupScheduled = false
const scheduleCleanup = (artwork: Artwork) => {
	cleanupQueue.add(artwork.key)

	if (isCleanupScheduled) {
		return
	}

	isCleanupScheduled = true
	const thirtySeconds = 30 * 1000
	setTimeout(() => {
		for (const key of cleanupQueue) {
			const cached = cache.get(key)
			if (!cached) {
				continue
			}
			if (cached.refs.size === 0) {
				cache.delete(key)
				if (typeof key !== 'string') {
					URL.revokeObjectURL(cached.url)
				}
			}
		}
		cleanupQueue.clear()
		isCleanupScheduled = false
	}, thirtySeconds)
}

export const createManagedArtwork = (getImage: () => Blob | string | undefined | null) => {
	const refId = Artwork.createRefId()

	const artwork = $derived.by(() => {
		const image = getImage()

		if (!image) {
			return null
		}

		let artworkInstance = cache.get(image)
		if (!artworkInstance) {
			artworkInstance = new Artwork(image)

			cache.set(image, artworkInstance)
		}

		artworkInstance.refs.add(refId)

		return artworkInstance
	})

	$effect(() => {
		// Need to use variable here so cleanup uses
		// previous value instead of the current one
		const savedArtwork = artwork
		if (!savedArtwork) {
			return
		}

		return () => {
			if (savedArtwork.refs.size === 1) {
				scheduleCleanup(savedArtwork)
			}

			if (import.meta.env.DEV && !savedArtwork.refs.has(refId)) {
				console.warn('Trying to release artwork that is not in use', savedArtwork)
			}

			savedArtwork.refs.delete(refId)
		}
	})

	return () => artwork?.url
}
