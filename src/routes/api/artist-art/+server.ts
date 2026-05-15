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
			`https://api.deezer.com/search/artist?q=${encodeURIComponent(artist)}`,
		)

		// Handle non-OK responses safely
		if (!response.ok) {
			const text = await response.text()

			console.error('Deezer API Error:', {
				status: response.status,
				body: text,
			})

			return json(
				{
					success: false,
					error: 'Failed to fetch data from Deezer',
					status: response.status,
					data: null,
				},
				{ status: response.status },
			)
		}

		// Safely parse JSON
		let data

		try {
			data = await response.json()
		} catch (err) {
			console.error('Invalid JSON from Deezer:', err)

			return json(
				{
					success: false,
					error: 'Invalid response from Deezer API',
					data: null,
				},
				{ status: 502 },
			)
		}

		// Always return JSON
		return json({
			success: true,
			data,
		})
	} catch (err) {
		console.error('Server Error:', err)

		// Final safety net 🛟
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
