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

		// Hit the JioSaavn API instead of Deezer
		const response = await fetch(
			`https://jiosaavn-apix.arcadopredator.workers.dev/api/search/artists?query=${encodeURIComponent(artist)}`,
		)

		if (!response.ok) {
			const text = await response.text()

			console.error('JioSaavn API Error:', {
				status: response.status,
				body: text,
			})

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
				{
					success: false,
					error: 'Invalid response from JioSaavn API',
					data: null,
				},
				{ status: 502 },
			)
		}

		// Extract the results array safely
		const results = payload?.data?.results || []

		if (results.length === 0) {
			return json(
				{
					success: false,
					error: 'No artist found matching that name',
					data: null,
				},
				{ status: 404 },
			)
		}

		// Get the first matching artist
		const artistInfo = results[0]
		let logoUrl = null

		// Extract the highest-quality image URL from the array safely
		if (Array.isArray(artistInfo.image) && artistInfo.image.length > 0) {
			// The highest resolution is typically at the end of the array
			const highestQualityImage = artistInfo.image[artistInfo.image.length - 1]
			logoUrl = highestQualityImage.url || highestQualityImage.link || null
		} else if (typeof artistInfo.image === 'string') {
			// Fallback in case a direct string is sent
			logoUrl = artistInfo.image
		}

		return json({
			success: true,
			data: {
				name: artistInfo.name,
				id: artistInfo.id,
				logo: logoUrl, // Cleansed, direct high-res image URL string
				raw: artistInfo // Providing the full artist object for flexibility
			},
		})
	} catch (err) {
		console.error('Server Error:', err)

		return json(
			{
				success: false,
				error: 'Internal server error',
				data: null,
			},
			{ status: 500 },
		)
	}
}
