

export async function GET({ url, fetch }) {
	const artist = url.searchParams.get('artist')

	const response = await fetch(
		`https://api.deezer.com/search/artist?q=${encodeURIComponent(artist ?? '')}`,
	)

	const data = await response.json()

	return Response.json(data)
}
