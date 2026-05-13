<script lang="ts" module>
	import type { SyncedLyricsLine } from '$lib/lyrics/synced-lyrics.ts'

	const getActiveLineIndex = (
		lines: readonly SyncedLyricsLine[],
		currentTimeMs: number,
	): number => {
		let index = -1
		for (let i = 0; i < lines.length; i += 1) {
			if (currentTimeMs >= lines[i].startTime) {
				index = i
			} else {
				break
			}
		}
		return index
	}
</script>

<script lang="ts">
	import { spring } from 'svelte/motion'
	import Button from '$lib/components/Button.svelte'
	import Icon from '$lib/components/icon/Icon.svelte'
	import { formatArtists, getItemLanguage } from '$lib/helpers/utils/text.ts'
	import type { TrackData } from '$lib/library/get/value.ts'
	import {
		fetchSyncedLyrics,
		type SyncedLyricsLine,
		type SyncedLyricsResult,
	} from '$lib/lyrics/synced-lyrics.ts'

	interface Props {
		track: TrackData | undefined
		currentTimeMs: number
		class?: string
	}

	let { track, currentTimeMs, class: className }: Props = $props()
	const player = usePlayer()

	let result: SyncedLyricsResult | undefined = $state()
	let loading = $state(false)
	let containerElement: HTMLElement | undefined = $state()
	let contentElement: HTMLElement | undefined = $state()
	let reloadCount = $state(0)
	let isUserScrolling = $state(false)
	let userScrollTimeout: ReturnType<typeof setTimeout>

	// ─── Motion & Physics ───────────────────────────────────────────────────
	const scrollOffset = spring(0, {
		stiffness: 0.08,
		damping: 0.4,
	})

	// ─── RAF-driven smooth time ───────────────────────────────────────────────
	let smoothTimeMs = $state(0)
	let lastPropTime = $state(0)
	let lastRafTimestamp: number | undefined

	$effect(() => {
		lastPropTime = currentTimeMs
		if (lastRafTimestamp === undefined) {
			smoothTimeMs = currentTimeMs
		}
		lastRafTimestamp = undefined
	})

	$effect(() => {
		let running = true
		const tick = (now: number) => {
			if (!running) return
			if (lastRafTimestamp === undefined) {
				lastRafTimestamp = now
				smoothTimeMs = lastPropTime
			} else {
				const elapsed = now - lastRafTimestamp
				lastRafTimestamp = now
				// If playing, advance time. If paused, stay at prop time.
				if (player.playing) {
					smoothTimeMs += elapsed
				} else {
					smoothTimeMs = lastPropTime
				}
			}
			requestAnimationFrame(tick)
		}
		const rafId = requestAnimationFrame(tick)
		return () => {
			running = false
			cancelAnimationFrame(rafId)
		}
	})

	const foundResult = $derived(result?.status === 'found' ? result : undefined)
	const lines = $derived(foundResult?.lines ?? [])

	const processedLines = $derived(
		lines.map((line) => {
			let inSecondary = false
			const words = line.words.map((word) => {
				let isWordSecondary = inSecondary
				if (word.string.includes('(')) {
					inSecondary = true
					isWordSecondary = true
				}
				if (word.string.includes(')')) {
					inSecondary = false
					isWordSecondary = true
				}
				return { ...word, isSecondary: isWordSecondary }
			})
			const lineText = words.map((w) => w.string).join('').trim()
			const isSecondaryLine = lineText.startsWith('(') && lineText.endsWith(')')
			return { ...line, words, isSecondaryLine }
		}),
	)

	const activeLineIndex = $derived(getActiveLineIndex(processedLines, smoothTimeMs))

	const getActiveWordIndex = (line: SyncedLyricsLine, timeMs: number): number => {
		for (let i = line.words.length - 1; i >= 0; i -= 1) {
			if (timeMs >= line.words[i].time) return i
		}
		return -1
	}

	$effect(() => {
		if (!track) {
			result = undefined
			loading = false
			return
		}
		const requestedReloadCount = reloadCount
		const controller = new AbortController()
		loading = true

		fetchSyncedLyrics(track, controller.signal)
			.then((nextResult) => {
				if (!controller.signal.aborted && requestedReloadCount === reloadCount) {
					result = nextResult
				}
			})
			.catch((error: unknown) => {
				if (error instanceof Error && error.name === 'AbortError') return
				result = { status: 'error' }
			})
			.finally(() => {
				if (!controller.signal.aborted && requestedReloadCount === reloadCount) {
					loading = false
				}
			})

		return () => controller.abort()
	})

	const updateScrollPosition = (immediate = false) => {
		if (!(containerElement && contentElement ) || activeLineIndex < 0) return
		const activeEl = contentElement.querySelector<HTMLElement>(
			`[data-line-index="${activeLineIndex}"]`,
		)
		if (!activeEl) return

		const containerHeight = containerElement.offsetHeight
		const lineTop = activeEl.offsetTop
		const lineHeight = activeEl.offsetHeight

		// Target position to keep line centered
		const target = containerHeight / 2 - lineTop - lineHeight / 2

		scrollOffset.set(target, { hard: immediate })
	}

	$effect(() => {
		if (!isUserScrolling) {
			updateScrollPosition()
		}
	})

	// Re-center on window resize
	$effect(() => {
		const handleResize = () => updateScrollPosition(true)
		window.addEventListener('resize', handleResize)
		return () => window.removeEventListener('resize', handleResize)
	})

	const handleUserInteraction = () => {
		isUserScrolling = true
		clearTimeout(userScrollTimeout)
		userScrollTimeout = setTimeout(() => {
			isUserScrolling = false
		}, 4000)
	}

	let lastTouchY = 0
	const handleTouchStart = (e: TouchEvent) => {
		lastTouchY = e.touches[0].clientY
		handleUserInteraction()
	}

	const handleTouchMove = (e: TouchEvent) => {
		const touchY = e.touches[0].clientY
		const deltaY = lastTouchY - touchY
		lastTouchY = touchY
		scrollOffset.update(v => v - deltaY, { hard: true })
	}

	const retry = () => { reloadCount += 1 }
</script>

{#snippet emptyState(icon: 'musicNote' | 'alertCircle', title: string, description: string)}
	<div class="empty-state z-10 m-auto flex max-w-80 flex-col items-center text-center">
		<div class="mb-6 flex size-24 items-center justify-center rounded-full bg-secondaryContainer/30">
			<Icon type={icon} class="color-onSecondaryContainer size-12 opacity-50" />
		</div>
		<div class="text-headline-sm font-bold tracking-tight">{title}</div>
		<div class="mt-3 text-body-lg text-onSecondaryContainer/60">{description}</div>
		{#if icon === 'alertCircle'}
			<Button kind="outlined" class="mt-8 rounded-full px-8" onclick={retry}>Retry</Button>
		{/if}
	</div>
{/snippet}

<section
	class={["lyrics-shell w-full", className]}
	aria-live="polite"
>
	<!-- Background Atmosphere Layer -->
	{#if player.artworkSrc}
		<div class="lyrics-background">
			<img src={player.artworkSrc} alt="" class="bg-image" />
			<div class="bg-overlay"></div>
		</div>
	{/if}

	{#if !track}
		{@render emptyState('musicNote', 'No Track', 'Play a track to see lyrics.')}
	{:else if loading}
		<div class="lyrics-scroller-mock px-6 pt-12" aria-hidden="true">
			{#each Array(6) as _, i}
				<div
					class="skeleton mb-10 h-14 rounded-xl opacity-20"
					style="width: {60 + Math.random() * 30}%"
				></div>
			{/each}
		</div>
	{:else if result?.status === 'found'}
		<div
			class="lyrics-container"
			role="region"
			aria-label="Lyrics"
			bind:this={containerElement}
			onwheel={(e) => {
				handleUserInteraction()
				scrollOffset.update(v => v - e.deltaY, { hard: true })
			}}
			ontouchstart={handleTouchStart}
			ontouchmove={handleTouchMove}
		>
			<div
				class="lyrics-content mx-auto w-full max-w-200"
				bind:this={contentElement}
				style="transform: translateY({$scrollOffset}px)"
			>
				{#each processedLines as line, lineIndex (lineIndex)}
					{@const isActiveLine = lineIndex === activeLineIndex}
					{@const activeWordIdx = isActiveLine ? getActiveWordIndex(line, smoothTimeMs) : -1}
					{@const distance = Math.abs(lineIndex - activeLineIndex)}

					<button
						type="button"
						class="lyric-line interactable"
						class:active={isActiveLine}
						class:past={lineIndex < activeLineIndex}
						class:secondary-line={line.isSecondaryLine}
						data-line-index={lineIndex}
						style="--distance: {distance}"
						onclick={() => {
							player.seek(line.startTime / 1000)
							isUserScrolling = false
							updateScrollPosition()
						}}
					>
						{#each line.words as word, wordIndex}
							{@const isPastWord = isActiveLine && wordIndex < activeWordIdx}
							{@const isCurrentWord = isActiveLine && wordIndex === activeWordIdx}
							{@const nextTime = line.words[wordIndex + 1]?.time ?? line.endTime}
							{@const duration = Math.max(nextTime - word.time, 1)}
							{@const wordProgress = isCurrentWord
								? Math.min(Math.max((smoothTimeMs - word.time) / duration, 0), 1) * 100
								: isPastWord ? 100 : 0}

							<span
								class="lyric-word"
								class:past-word={isPastWord}
								class:secondary-word={word.isSecondary && !line.isSecondaryLine}
								style="--word-progress: {wordProgress}%"
							>{word.string}</span>
						{/each}
					</button>
				{/each}
			</div>
		</div>
	{:else if result?.status === 'instrumental'}
		{@render emptyState('musicNote', 'Instrumental', 'This track is instrumental.')}
	{:else if result?.status === 'not-found'}
		{@render emptyState('musicNote', 'Not Found', 'Could not find lyrics for this track.')}
	{:else}
		{@render emptyState('alertCircle', 'Failed', 'Failed to load lyrics.')}
	{/if}
</section>

<style lang="postcss">
	@reference "../../../app.css";

	.lyrics-shell {
		display: flex;
		flex-direction: column;
		height: 100%;
		min-height: 0;
		position: relative;
		overflow: hidden;
		background: transparent;
	}

	.lyrics-background {
		position: absolute;
		inset: 0;
		z-index: 0;
		pointer-events: none;
		overflow: hidden;
	}

	.bg-image {
		width: 110%;
		height: 110%;
		top: -5%;
		left: -5%;
		position: absolute;
		object-fit: cover;
		filter: blur(80px) saturate(1.8) brightness(0.4);
		opacity: 0.6;
		transition: opacity 1s ease;
		animation: bg-drift 30s infinite alternate ease-in-out;
	}

	@keyframes bg-drift {
		0% { transform: scale(1.1) translate(0, 0) rotate(0deg); }
		50% { transform: scale(1.2) translate(2%, 2%) rotate(2deg); }
		100% { transform: scale(1.1) translate(-2%, 1%) rotate(-1deg); }
	}

	.bg-overlay {
		position: absolute;
		inset: 0;
		background:
			linear-gradient(
				to bottom,
				rgba(0,0,0,0.4) 0%,
				transparent 20%,
				transparent 80%,
				rgba(0,0,0,0.4) 100%
			),
			radial-gradient(
				circle at center,
				transparent 0%,
				rgba(0,0,0,0.2) 100%
			);
		backdrop-filter: contrast(1.1) brightness(1.1);
	}

	.bg-overlay::after {
		content: '';
		position: absolute;
		inset: 0;
		background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E");
		opacity: 0.03;
		pointer-events: none;
	}

	.lyrics-container {
		position: relative;
		flex: 1;
		width: 100%;
		overflow: hidden;
		z-index: 5;
		touch-action: pan-y;
		mask-image: linear-gradient(
			to bottom,
			transparent 0%,
			black 15%,
			black 85%,
			transparent 100%
		);
		-webkit-mask-image: linear-gradient(
			to bottom,
			transparent 0%,
			black 15%,
			black 85%,
			transparent 100%
		);
	}

	.lyrics-content {
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		display: flex;
		flex-direction: column;
		padding: 0 1rem;
		padding-bottom: calc(env(safe-area-inset-bottom) + 2rem);
		@media (min-width: 640px) { padding: 0 2rem; }
		will-change: transform;
		transition: transform 0.1s linear; /* Minor smoothing for manual interaction */
	}

	.lyric-line {
		display: block;
		width: 100%;
		text-align: left; /* Changed to left for more Apple Music feel */
		background: transparent;
		border: none;
		padding: 1.5rem 0;
		margin: 0.25rem 0;
		contain: content;
		font-family: var(--font-sans);
		font-size: 2.25rem;
		@media (min-width: 640px) { font-size: 2.75rem; }
		@media (min-width: 1024px) { font-size: 3.5rem; }
		font-weight: 800;
		line-height: 1.1;
		letter-spacing: -0.04em;
		white-space: pre-wrap;
		user-select: none;
		color: #fff; /* White base for dark atmospheric bg */
		opacity: calc(0.3 / (1 + var(--distance) * 0.4));
		transform: scale(calc(1 - var(--distance) * 0.04)) translateX(calc(var(--distance) * 4px));
		filter: blur(calc(var(--distance) * 1px));
		transform-origin: left center;
		cursor: pointer;
		will-change: transform, opacity, filter;
		transition:
			opacity 0.8s cubic-bezier(0.2, 0, 0, 1),
			transform 0.8s cubic-bezier(0.2, 0, 0, 1),
			filter 0.8s cubic-bezier(0.2, 0, 0, 1);
	}

	.lyric-line.secondary-line {
		font-size: 1.5rem;
		@media (min-width: 640px) { font-size: 1.75rem; }
		@media (min-width: 1024px) { font-size: 2.25rem; }
		font-weight: 700;
		opacity: calc(0.2 / (1 + var(--distance) * 0.4));
	}

	.lyric-line.active {
		opacity: 1;
		transform: scale(1.05) translateX(0);
		filter: drop-shadow(0 0 20px rgba(255,255,255,0.2)) blur(0);
	}

	.lyric-line.past {
		opacity: calc(0.15 / (1 + var(--distance) * 0.2));
	}

	.lyric-word {
		display: inline-block;
		position: relative;
	}

	/* Word Highlight System */
	.lyric-line.active .lyric-word {
		--highlight-color: #fff;
		--inactive-color: rgba(255, 255, 255, 0.25);
		background: linear-gradient(
			to right,
			var(--highlight-color) calc(var(--word-progress) - 5%),
			var(--inactive-color) calc(var(--word-progress) + 5%)
		);
		-webkit-background-clip: text;
		background-clip: text;
		color: transparent;
		transition: none;
		/* Bloom/glow for highlighted words */
		text-shadow: 0 0 15px rgba(255, 255, 255, calc(var(--word-progress) / 200));
	}

	.skeleton {
		animation: ambient-shimmer 3s infinite ease-in-out;
		background: rgba(255, 255, 255, 0.1);
		background-size: 200% 100%;
	}

	@keyframes ambient-shimmer {
		0% { opacity: 0.1; }
		50% { opacity: 0.2; }
		100% { opacity: 0.1; }
	}
</style>
