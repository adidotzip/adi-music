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
	import Button from '$lib/components/Button.svelte'
	import Icon from '$lib/components/icon/Icon.svelte'
	import Spinner from '$lib/components/Spinner.svelte'
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
	}

	let { track, currentTimeMs }: Props = $props()
	const player = usePlayer() // Assuming this is globally available or imported in your real code

	let result: SyncedLyricsResult | undefined = $state()
	let loading = $state(false)
	let scrollerElement: HTMLElement | undefined = $state()
	let reloadCount = $state(0)
	
	let previousActiveIndex = -1
	let isUserScrolling = false
	let userScrollTimeout: number | undefined

	const foundResult = $derived(result?.status === 'found' ? result : undefined)
	const lines = $derived(foundResult?.lines ?? [])
	const activeLineIndex = $derived(getActiveLineIndex(lines, currentTimeMs))
	const sourceLabel = $derived(
		foundResult?.source === 'lyricsplus' ? 'LyricsPlus' : 'LRCLIB',
	)

	const getActiveWordIndex = (line: SyncedLyricsLine, timeMs: number): number => {
		for (let i = line.words.length - 1; i >= 0; i -= 1) {
			if (timeMs >= line.words[i].time) {
				return i
			}
		}
		return -1
	}

	// Fetching logic
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
				if (error instanceof Error && error.name === 'AbortError') {
					return
				}
				result = { status: 'error' }
			})
			.finally(() => {
				if (!controller.signal.aborted && requestedReloadCount === reloadCount) {
					loading = false
				}
			})

		return () => controller.abort()
	})

	// Material 3 Emphasized Scroll Logic
	let animationFrameId: number | undefined

	const scrollToActiveLine = (smooth = true) => {
		if (!scrollerElement || activeLineIndex < 0 || isUserScrolling) return

		const activeEl = scrollerElement.querySelector<HTMLElement>(
			`[data-line-index="${activeLineIndex}"]`,
		)
		if (!activeEl) return

		const targetScroll =
			activeEl.offsetTop -
			scrollerElement.clientHeight / 2 +
			activeEl.clientHeight / 2

		if (Math.abs(scrollerElement.scrollTop - targetScroll) < 1) return

		if (smooth) {
			const startScroll = scrollerElement.scrollTop
			const distance = targetScroll - startScroll
			const duration = 750 // Slightly longer for M3 expressive settling
			let startTime: number | null = null

			const animate = (currentTime: number) => {
				if (!startTime) startTime = currentTime
				const timeElapsed = currentTime - startTime
				const progress = Math.min(timeElapsed / duration, 1)

				// Material 3 Emphasized Decelerate (Quartic Ease-Out Approximation)
				// Fast out of the gate, long smooth settle.
				const ease = 1 - Math.pow(1 - progress, 4)

				if (scrollerElement && !isUserScrolling) {
					scrollerElement.scrollTop = startScroll + distance * ease
				}

				if (progress < 1 && !isUserScrolling) {
					animationFrameId = requestAnimationFrame(animate)
				}
			}

			cancelAnimationFrame(animationFrameId!)
			animationFrameId = requestAnimationFrame(animate)
		} else {
			scrollerElement.scrollTop = targetScroll
		}
	}

	$effect(() => {
		if (activeLineIndex !== previousActiveIndex) {
			previousActiveIndex = activeLineIndex
			scrollToActiveLine()
		}
	})

	$effect(() => {
		return () => {
			if (animationFrameId) cancelAnimationFrame(animationFrameId)
		}
	})

	const handleScroll = () => {
		isUserScrolling = true
		clearTimeout(userScrollTimeout)
		userScrollTimeout = window.setTimeout(() => {
			isUserScrolling = false
		}, 3000) // Give them a bit more time before snapping back
	}

	const retry = () => {
		reloadCount += 1
	}
</script>

{#snippet emptyState(icon: 'musicNote' | 'alertCircle', title: string, description: string)}
	<div class="empty-state m-auto flex max-w-80 flex-col items-center text-center">
		<Icon type={icon} class="color-onSecondaryContainer mb-4 size-24 opacity-54" />
		<div class="text-title-md">{title}</div>
		<div class="mt-2 text-body-md text-onSecondaryContainer/72">{description}</div>
		{#if icon === 'alertCircle'}
			<Button kind="outlined" class="mt-6" onclick={retry}>{m.reload()}</Button>
		{/if}
	</div>
{/snippet}

<section class="lyrics-shell card" aria-live="polite" style="--primary-color: {track?.primaryColor ? `rgb(${((track.primaryColor >> 16) & 0xFF)}, ${((track.primaryColor >> 8) & 0xFF)}, ${(track.primaryColor & 0xFF)})` : 'var(--color-surfaceContainerLow)'}">
	<div class="m3-tonal-background"></div>
	
	{#if !track}
		{@render emptyState('musicNote', m.lyricsNoTrack(), m.lyricsNoTrackExplanation())}
	{:else if loading}
		<div class="lyrics-header">
			<div class="min-w-0">
				<div class="skeleton mb-2 h-7 w-36 rounded-md bg-surfaceContainerHighest"></div>
				<div class="skeleton h-5 w-28 rounded-md bg-surfaceContainerHighest opacity-70"></div>
			</div>
		</div>
		<div class="lyrics-scroller overflow-hidden px-6 pt-12">
			{#each Array(6) as _, i}
				<div 
					class="skeleton mb-10 h-14 rounded-xl bg-surfaceContainerHighest opacity-20"
					style="width: {60 + Math.random() * 30}%;"
				></div>
			{/each}
		</div>
	{:else if result?.status === 'found'}
		<div class="lyrics-header">
			<div class="min-w-0" lang={getItemLanguage(track.language)}>
				<div class="truncate text-title-lg font-bold tracking-tight text-onSurface">{track.name}</div>
				<div class="truncate text-body-md font-medium text-onSurfaceVariant">
					{formatArtists(track.artists)}
				</div>
			</div>
			<div class="source-badge">
				{sourceLabel}
			</div>
		</div>

		<div
			class="lyrics-scroller"
			bind:this={scrollerElement}
			onscroll={handleScroll}
			onwheel={handleScroll}
			ontouchstart={handleScroll}
		>
			<div class="lyrics-spacer"></div>
			{#each lines as line, lineIndex (lineIndex)}
				{@const isActiveLine = lineIndex === activeLineIndex}
				{@const activeWordIdx = getActiveWordIndex(line, currentTimeMs)}

				<button
					type="button"
					class="lyric-line interactable"
					class:active={isActiveLine}
					class:past={lineIndex < activeLineIndex}
					data-line-index={lineIndex}
					onclick={() => player.seek(line.startTime / 1000)}
				>
					{#each line.words as word, wordIndex}
						{@const isPastWord = isActiveLine && wordIndex < activeWordIdx}
						{@const isCurrentWord = isActiveLine && wordIndex === activeWordIdx}
						{@const nextTime = line.words[wordIndex + 1]?.time ?? line.endTime}
						{@const duration = nextTime - word.time || 200}
						{@const wordProgress = isCurrentWord 
							? Math.min(Math.max((currentTimeMs - word.time) / duration, 0), 1) * 100 
							: (isPastWord ? 100 : 0)}
						
						<span 
							class="lyric-word" 
							class:active-word={isActiveLine && wordIndex <= activeWordIdx}
							style="--word-progress: {wordProgress}%"
						>{word.string}</span>{' '}
					{/each}
				</button>
			{/each}
			<div class="lyrics-spacer"></div>
		</div>
	{:else if result?.status === 'instrumental'}
		{@render emptyState('musicNote', m.lyricsInstrumental(), m.lyricsInstrumentalExplanation())}
	{:else if result?.status === 'not-found'}
		{@render emptyState('musicNote', m.lyricsNotFound(), m.lyricsNotFoundExplanation())}
	{:else}
		{@render emptyState('alertCircle', m.lyricsFailed(), m.lyricsFailedExplanation())}
	{/if}
</section>

<style lang="postcss">
	.lyrics-shell {
		display: flex;
		flex-direction: column;
		height: 100%;
		max-height: 850px;
		position: relative;
		overflow: hidden;
		background: var(--color-surface, #121212);
		border-radius: 1.5rem; /* M3 Extra Large shape */
	}

	.m3-tonal-background {
		position: absolute;
		inset: 0;
		background: radial-gradient(
			ellipse at 0% 0%,
			color-mix(in srgb, var(--primary-color) 25%, transparent) 0%,
			transparent 60%
		),
		radial-gradient(
			ellipse at 100% 100%,
			color-mix(in srgb, var(--primary-color) 20%, transparent) 0%,
			transparent 60%
		);
		z-index: 0;
		pointer-events: none;
	}

	.lyrics-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 1.25rem 1.75rem;
		z-index: 10;
		background: linear-gradient(
			to bottom,
			var(--color-surface, #121212) 60%,
			transparent 100%
		);
	}

	.source-badge {
		background: var(--color-surfaceContainerHighest, #333);
		color: var(--color-onSurfaceVariant, #ccc);
		padding: 0.375rem 0.75rem;
		border-radius: 0.5rem; /* M3 Small shape */
		font-size: 0.75rem;
		font-weight: 600;
		letter-spacing: 0.05em;
		text-transform: uppercase;
	}

	.lyrics-scroller {
		flex: 1;
		overflow-y: auto;
		padding: 0 2rem;
		scroll-behavior: smooth;
		
		scrollbar-width: none; 
		-ms-overflow-style: none;
		
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

	.lyrics-scroller::-webkit-scrollbar {
		display: none;
	}

	.lyrics-spacer {
		height: 40vh;
	}

	/* --- MATERIAL 3 EXPRESSIVE TYPOGRAPHY & MOTION --- */

	.lyric-line {
		display: block;
		width: 100%;
		text-align: left;
		background: transparent;
		border: none;
		padding: 1rem 0;
		margin: 0.75rem 0;
		
		/* M3 Display Typography */
		font-family: var(--font-family-sans, system-ui, sans-serif);
		font-size: 2rem;
		@media (min-width: 640px) { font-size: 2.5rem; }
		@media (min-width: 1024px) { font-size: 3rem; }
		
		font-weight: 700;
		line-height: 1.2;
		letter-spacing: -0.02em; /* Tighter for expressive headlines */
		white-space: pre-wrap;
		
		color: var(--color-onSurfaceVariant, #a0a0a0);
		opacity: 0.4;
		transform: scale(0.92) translateX(-1%);
		transform-origin: center left;
		cursor: pointer;

		will-change: transform, opacity, color;

		/* M3 Emphasized Decelerate */
		transition:
			opacity 0.6s cubic-bezier(0.2, 0, 0, 1),
			transform 0.6s cubic-bezier(0.2, 0, 0, 1),
			color 0.6s cubic-bezier(0.2, 0, 0, 1);
	}

	.lyric-line:hover {
		opacity: 0.7;
	}

	.lyric-line.active {
		color: var(--color-onSurface, #ffffff);
		opacity: 1;
		transform: scale(1) translateX(0);
		font-weight: 800; /* Extra punch for active line */
	}

	.lyric-word {
		display: inline-block;
		color: transparent;
		/* Base state is the inactive color */
		background: var(--color-onSurfaceVariant, #a0a0a0);
		background-clip: text;
		-webkit-background-clip: text;
		
		transition: transform 0.4s cubic-bezier(0.2, 0, 0, 1);
	}

	.lyric-line.active .lyric-word {
		/* When active, map the progress gradient */
		background: linear-gradient(
			to right,
			var(--color-primary, #d0bcff) 0%,
			var(--color-primary, #d0bcff) var(--word-progress, 0%),
			var(--color-onSurfaceVariant, #a0a0a0) var(--word-progress, 0%)
		);
		background-size: 100% 100%;
		background-clip: text;
		-webkit-background-clip: text;
		-webkit-text-fill-color: transparent;
	}

	.lyric-line.active .lyric-word.active-word {
		/* Subtle pop for the exact word being sung */
		transform: scale(1.02) translateY(-2px);
	}

	.lyric-line.past {
		opacity: 0.25;
		transform: scale(0.92) translateX(0);
	}

	/* M3 Standard Skeleton Loader */
	.skeleton {
		animation: m3-shimmer 2s infinite linear;
		background: linear-gradient(
			90deg,
			var(--color-surfaceContainerHighest, #333) 0%,
			var(--color-surfaceContainer, #444) 50%,
			var(--color-surfaceContainerHighest, #333) 100%
		);
		background-size: 200% 100%;
	}

	@keyframes m3-shimmer {
		0% { background-position: -200% 0; }
		100% { background-position: 200% 0; }
	}
</style>
