export const JIOSAAVN_API_URL = 'https://jiosaavn-api.vercel.app'

export interface JioSaavnSong {
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
		vlink: string
		singers: string
		language: string
		album_id: string
	}
	perma_url: string
}

export interface JioSaavnAlbum {
	id: string
	title: string
	image: string
	images: {
		'50x50': string
		'150x150': string
		'500x500': string
	}
	music: string
	description: string
}

export interface JioSaavnArtist {
	id: string
	name: string
	image: { quality: string; link: string }[]
	fanCount?: string
	dominantLanguage?: string
	topSongs?: JioSaavnSong[]
	topAlbums?: JioSaavnAlbum[]
}

export interface JioSaavnPlaylist {
	id: string
	title: string
	image: string
	images: {
		'50x50': string
		'150x150': string
		'500x500': string
	}
	description: string
}

export interface JioSaavnSearchResults {
	results: JioSaavnSong[]
}

export const jioSaavnService = {
	async searchSongs(query: string): Promise<JioSaavnSong[]> {
		const res = await fetch(`${JIOSAAVN_API_URL}/search?query=${encodeURIComponent(query)}`)
		const data = await res.json()
		return data.results
	},

	async getAlbumDetails(
		id: string,
	): Promise<{ results: JioSaavnSong[]; title: string; image: string }> {
		const res = await fetch(`${JIOSAAVN_API_URL}/album?id=${id}`)
		const data = await res.json()
		return data
	},

	async getPlaylistDetails(
		id: string,
	): Promise<{ results: JioSaavnSong[]; title: string; image: string }> {
		const res = await fetch(`${JIOSAAVN_API_URL}/playlist?id=${id}`)
		const data = await res.json()
		return data
	},

	async getSongDetails(id: string): Promise<JioSaavnSong> {
		const res = await fetch(`${JIOSAAVN_API_URL}/song?id=${id}`)
		const data = await res.json()
		return data
	},

	async getArtistDetails(id: string): Promise<JioSaavnArtist> {
		const res = await fetch(`${JIOSAAVN_API_URL}/artist?id=${id}`)
		const data = await res.json()
		return data
	},
}
