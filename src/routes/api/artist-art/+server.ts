import { json } from '@sveltejs/kit'

export async function GET({ url, fetch }) {
	try {
		const artist = url.searchParams.get('artist')
		if (!artist) {
			return json(
				{
					success: false,
					error: 'Artist parameter is required',
					data: null,
				},
				{ status: 400 },
			)
		}

		const response = await fetch(
			`https://jiosaavn-apix.arcadopredator.workers.dev/api/search/artists?query=${encodeURIComponent(artist)}`,
		)

		if (!response.ok) {
			const text = await response.text()
			console.error('JioSaavn API Error:', { status: response.status, body: text })
			return json(
				{
					success: false,
					error: 'Failed to fetch data from JioSaavn',
					status: response.status,
					data: null,
				},
				{ status: response.status },
			)
		}

		let payload
		try {
			payload = await response.json()
		} catch (err) {
			console.error('Invalid JSON from JioSaavn:', err)
			return json(
				{ success: false, error: 'Invalid response from JioSaavn API', data: null },
				{ status: 502 },
			)
		}

		const results = payload?.data?.results || []
		if (results.length === 0) {
			return json(
				{ success: false, error: 'No artist found matching that name', data: null },
				{ status: 404 },
			)
		}

		// Prefer an exact name match (case-insensitive), fall back to first result
		const needle = artist.trim().toLowerCase()
		const artistInfo =
			results.find((r) => r.name?.toLowerCase() === needle) ?? results[0]

		// Skip results that only have the default placeholder image
		const DEFAULT_IMAGE = 'https://www.jiosaavn.com/_i/3.0/artist-default-music.png'

		let logoUrl = null
		if (Array.isArray(artistInfo.image) && artistInfo.image.length > 0) {
			// Pick the highest-quality image that isn't the generic placeholder
			const best = [...artistInfo.image]
				.reverse()
				.find((img) => {
					const u = img.url || img.link || ''
					return u && u !== DEFAULT_IMAGE
				})
			logoUrl = best ? (best.url || best.link || null) : null
		} else if (
			typeof artistInfo.image === 'string' &&
			artistInfo.image !== DEFAULT_IMAGE
		) {
			logoUrl = artistInfo.image
		}

		return json({
			success: true,
			data: {
				name: artistInfo.name,
				id: artistInfo.id,
				logo: logoUrl,
				raw: artistInfo,
			},
		})
	} catch (err) {
		console.error('Server Error:', err)
		return json(
			{ success: false, error: 'Internal server error', data: null },
			{ status: 500 },
		)
	}
}
