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
	const player = usePlayer()

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

	// Material 3 Emphasized Scroll Logic
	let animationFrameId: number | undefined

	const scrollToActiveLine = (smooth = true) => {
		if (!scrollerElement || activeLineIndex < 0 || isUserScrolling) return

		const activeEl = scrollerElement.querySelector<HTMLElement>(
			`[data-line-index="${activeLineIndex}"]`,
		)
		if (!activeEl) return

		// Center the active line perfectly
		const targetScroll =
			activeEl.offsetTop -
			scrollerElement.clientHeight / 2 +
			activeEl.clientHeight / 2

		if (Math.abs(scrollerElement.scrollTop - targetScroll) < 1) return

		if (smooth) {
			const startScroll = scrollerElement.scrollTop
			const distance = targetScroll - startScroll
			const duration = 850 // Extended slightly for dramatic M3 settling
			let startTime: number | null = null

			const animate = (currentTime: number) => {
				if (!startTime) startTime = currentTime
				const timeElapsed = currentTime - startTime
				const progress = Math.min(timeElapsed / duration, 1)

				// M3 Emphasized Decelerate Math (Cubic-Bezier 0.05, 0.7, 0.1, 1 approximation)
				const ease = 1 - Math.pow(1 - progress, 5)

				if (scrollerElement && !isUserScrolling) {
					scrollerElement.scrollTop = startScroll + distance * ease
				}

				if (progress < 1 && !isUserScrolling) {
					animationFrameId = requestAnimationFrame(animate)
				}
			}

			if (animationFrameId) cancelAnimationFrame(animationFrameId)
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

	// Respect user intent: pause auto-scrolling if they touch/scroll
	const handleScroll = () => {
		isUserScrolling = true
		clearTimeout(userScrollTimeout)
		userScrollTimeout = window.setTimeout(() => {
			isUserScrolling = false
			scrollToActiveLine() // Snap back when they let go
		}, 3500) 
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

<section 
	class="lyrics-shell card" 
	aria-live="polite" 
	style="--primary-color: {track?.primaryColor ? `rgb(${((track.primaryColor >> 16) & 0xFF)}, ${((track.primaryColor >> 8) & 0xFF)}, ${(track.primaryColor & 0xFF)})` : 'var(--color-primary, #D0BCFF)'}"
>
	<div class="m3-tonal-background"></div>
	
	{#if !track}
		{@render emptyState('musicNote', 'No Track', 'Play a track to see lyrics.')}
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
					style="width: {60 + Math.random() * 30}%; transform: translateX({i % 2 === 0 ? '0' : '5%'})"
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
					onclick={() => {
						isUserScrolling = false;
						player.seek(line.startTime / 1000);
					}}
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
							class:active-word={isCurrentWord}
							style="--word-progress: {wordProgress}%"
						>{word.string}</span>{' '}
					{/each}
				</button>
			{/each}
			<div class="lyrics-spacer"></div>
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
	.lyrics-shell {
		display: flex;
		flex-direction: column;
		height: 100%;
		max-height: 850px;
		position: relative;
		overflow: hidden;
		background: var(--color-surface, #121212);
		border-radius: 1.75rem; /* M3 Extra Large shape */
		box-shadow: 0 8px 32px rgba(0,0,0,0.2);
	}

	.m3-tonal-background {
		position: absolute;
		inset: 0;
		background: radial-gradient(
			120% 120% at 50% -10%,
			color-mix(in srgb, var(--primary-color) 20%, transparent) 0%,
			transparent 80%
		),
		radial-gradient(
			80% 80% at 50% 110%,
			color-mix(in srgb, var(--primary-color) 15%, transparent) 0%,
			transparent 100%
		);
		z-index: 0;
		pointer-events: none;
		transition: background 1s ease;
	}

	.lyrics-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 1.5rem 2rem;
		z-index: 10;
		background: linear-gradient(
			to bottom,
			var(--color-surface, #121212) 40%,
			transparent 100%
		);
	}

	.source-badge {
		background: color-mix(in srgb, var(--primary-color) 20%, var(--color-surfaceContainerHighest, #333));
		color: var(--primary-color);
		padding: 0.375rem 0.875rem;
		border-radius: 0.5rem; 
		font-size: 0.75rem;
		font-weight: 700;
		letter-spacing: 0.05em;
		text-transform: uppercase;
	}

	.lyrics-scroller {
		flex: 1;
		overflow-y: auto;
		padding: 0 2.5rem;
		scroll-behavior: auto; /* Handled gracefully by JS */
		
		scrollbar-width: none; 
		-ms-overflow-style: none;
		
		mask-image: linear-gradient(
			to bottom, 
			transparent 0%, 
			black 20%, 
			black 80%, 
			transparent 100%
		);
		-webkit-mask-image: linear-gradient(
			to bottom, 
			transparent 0%, 
			black 20%, 
			black 80%, 
			transparent 100%
		);
	}

	.lyrics-scroller::-webkit-scrollbar {
		display: none;
	}

	.lyrics-spacer {
		height: 45vh;
	}

	/* --- MATERIAL 3 EXPRESSIVE TYPOGRAPHY & MOTION --- */

	.lyric-line {
		display: block;
		width: 100%;
		text-align: left;
		background: transparent;
		border: none;
		padding: 1.25rem 0;
		margin: 0.5rem 0;
		
		/* M3 Display Typography */
		font-family: var(--font-family-sans, system-ui, sans-serif);
		font-size: 2.25rem;
		@media (min-width: 640px) { font-size: 2.75rem; }
		@media (min-width: 1024px) { font-size: 3.25rem; }
		
		font-weight: 700;
		line-height: 1.15;
		letter-spacing: -0.03em;
		white-space: pre-wrap;
		
		color: var(--color-onSurfaceVariant, #a0a0a0);
		opacity: 0.3;
		filter: blur(3px); /* Expressive depth */
		transform: scale(0.95) translateY(10px);
		transform-origin: center left;
		cursor: pointer;

		will-change: transform, opacity, filter;

		/* Standard M3 Emphasized Decelerate */
		transition:
			opacity 0.7s cubic-bezier(0.2, 0, 0, 1),
			transform 0.7s cubic-bezier(0.2, 0, 0, 1),
			filter 0.7s cubic-bezier(0.2, 0, 0, 1),
			color 0.7s cubic-bezier(0.2, 0, 0, 1);
	}

	.lyric-line:hover {
		opacity: 0.6;
		filter: blur(1px);
	}

	.lyric-line.active {
		color: var(--color-onSurface, #ffffff);
		opacity: 1;
		filter: blur(0px);
		transform: scale(1.05) translateY(0);
		font-weight: 800;
	}

	.lyric-line.past {
		opacity: 0.15;
		filter: blur(4px);
		transform: scale(0.92) translateY(-10px);
	}

	/* Word Level Animations */
	.lyric-word {
		display: inline-block;
		color: transparent;
		background: var(--color-onSurfaceVariant, #555);
		background-clip: text;
		-webkit-background-clip: text;
		
		/* Smooth snapping for individual words */
		transition: transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
	}

	.lyric-line.active .lyric-word {
		background: linear-gradient(
			to right,
			var(--primary-color) 0%,
			var(--primary-color) var(--word-progress, 0%),
			var(--color-onSurfaceVariant, #555) var(--word-progress, 0%)
		);
		background-size: 100% 100%;
		background-clip: text;
		-webkit-background-clip: text;
		-webkit-text-fill-color: transparent;
	}

	.lyric-line.active .lyric-word.active-word {
		/* Karaoke "Bounce" */
		transform: translateY(-4px) scale(1.05);
	}

	/* Skeleton Loaders */
	.skeleton {
		animation: m3-shimmer 2.5s infinite linear;
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
