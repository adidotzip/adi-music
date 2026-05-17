<script lang="ts">
	import { getAnimatedArtwork } from '$lib/helpers/animated-artwork.ts'
	import { UNKNOWN_ITEM } from '$lib/library/types.ts'
	import { fade } from 'svelte/transition'

	const player = usePlayer()
	const track = $derived(player.activeTrack)

	let animatedSrc = $state<string | undefined>()
	let prevTrackId = $state<number | undefined>()

	$effect(() => {
		if (!track) {
			animatedSrc = undefined
			prevTrackId = undefined
			return
		}

		if (track.id === prevTrackId) {
			return
		}

		prevTrackId = track.id

		const artist = track.artists[0] && track.artists[0] !== UNKNOWN_ITEM ? track.artists[0] : ''
		const album = track.album !== UNKNOWN_ITEM ? track.album : ''

		if (artist && album) {
			getAnimatedArtwork(artist as string, album as string).then((url) => {
				if (track.id === prevTrackId) {
					animatedSrc = url
				}
			})
		} else {
			animatedSrc = undefined
		}
	})

	let canPlayHLS = $state(false)
	$effect(() => {
		const video = document.createElement('video')
		canPlayHLS = video.canPlayType('application/vnd.apple.mpegurl') !== ''
	})

	let mediaError = $state(false)
	$effect(() => {
		// Reset error state when track changes
		void track
		untrack(() => {
			mediaError = false
		})
	})

	const shouldShowAnimated = $derived.by(() => {
		if (!animatedSrc || mediaError) {
			return false
		}

		if (animatedSrc.endsWith('.m3u8')) {
			return canPlayHLS
		}

		return true
	})

	const fallbackSrc = $derived(player.artworkSrc)

	// Determine current valid media source to handle smooth crossfades
	const currentMediaKey = $derived(shouldShowAnimated ? animatedSrc : fallbackSrc)
</script>

<div class="fixed inset-0 z-[-1] overflow-hidden pointer-events-none bg-black">
	{#key currentMediaKey}
		<div
			class="absolute inset-0 size-full transition-opacity duration-1000 ease-in-out"
			in:fade={{ duration: 1000 }}
			out:fade={{ duration: 1000 }}
		>
			{#if shouldShowAnimated}
				<video
					src={animatedSrc}
					autoplay
					loop
					muted
					playsinline
					class="absolute inset-0 size-full object-cover ken-burns"
					onerror={() => {
						mediaError = true
					}}
				></video>
			{:else if fallbackSrc}
				<img
					src={fallbackSrc}
					alt="Background Fallback"
					class="absolute inset-0 size-full object-cover ken-burns"
					onerror={() => {
						mediaError = true
					}}
				/>
			{/if}
		</div>
	{/key}

	<!-- Layer 2: Variable Blur Layer -->
	<div
		class={[
			"absolute inset-0 size-full transition-all duration-1000",
			shouldShowAnimated ? "backdrop-blur-[15px] opacity-70" : "backdrop-blur-[60px] opacity-100"
		]}
	></div>

	<!-- Layer 3: Dark Gradient Overlay & Edge Vignette -->
	<div
		class="absolute inset-0 size-full bg-gradient-to-b from-black/20 via-black/40 to-black/80"
		style="box-shadow: inset 0 0 150px rgba(0,0,0,0.8);"
	></div>

	<!-- Layer 4: Noise/Grain Texture -->
	<div class="absolute inset-0 size-full opacity-30 mix-blend-overlay pointer-events-none noise-bg"></div>

	<!-- Layer 5: Dynamic Color Blend -->
	{#if track?.primaryColor}
		<div
			class="absolute inset-0 size-full opacity-20 mix-blend-color transition-colors duration-1000"
			style="background-color: #{track.primaryColor.toString(16).padStart(6, '0')}"
		></div>
	{/if}
</div>

<style lang="postcss">
	@reference "../../../app.css";

	@keyframes ken-burns {
		0% {
			transform: scale(1.05) translate(0, 0);
		}
		50% {
			transform: scale(1.15) translate(-1%, -1%);
		}
		100% {
			transform: scale(1.05) translate(0, 0);
		}
	}

	.ken-burns {
		animation: ken-burns 40s ease-in-out infinite alternate;
		transform-origin: center;
		will-change: transform;
	}

	.noise-bg {
		background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E");
		background-repeat: repeat;
		background-size: 150px 150px;
	}
</style>
