export const JIOSAAVN_API_URL = 'https://jiosaavn-api.vercel.app'

export interface SaavnSong {
	id: string
	song: string
	album: string
	year: string | number
	primary_artists: string
	singers: string
	image: string
	images: {
		'50x50': string
		'150x150': string
		'500x500': string
	}
	duration: string
	label: string
	albumid: string
	language: string
	copyright_text: string
	has_lyrics: string | boolean
	lyrics: string | null
	media_url: string
	media_urls: {
		'96_KBPS': string
		'160_KBPS': string
		'320_KBPS': string
	}
	perma_url: string
	album_url: string
	release_date: string
}

export interface SaavnSearchSong {
	id: string
	title: string
	image: string
	images: {
		'50x50': string
		'150x150': string
		'500x500': string
	}
	album: string
	description: string
	more_info: {
		singers: string
		language: string
		album_id: string
	}
}

export interface SaavnSearchResponse {
	status: boolean
	searchQuery: string
	results: SaavnSearchSong[]
}

export async function searchSongs(query: string): Promise<SaavnSearchSong[]> {
	const url = `${JIOSAAVN_API_URL}/search?query=${encodeURIComponent(query)}`
	const response = await fetch(url)
	if (!response.ok) {
		throw new Error('Failed to fetch from JioSaavn API')
	}
	const data: SaavnSearchResponse = await response.json()
	return data.results || []
}

export async function getSongDetails(id: string): Promise<SaavnSong> {
	const url = `${JIOSAAVN_API_URL}/song?id=${encodeURIComponent(id)}`
	const response = await fetch(url)
	if (!response.ok) {
		throw new Error('Failed to fetch from JioSaavn API')
	}
	return await response.json()
}
