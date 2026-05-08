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
	let isUserScrolling = $state(false)
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

	// Scroll Animation Logic
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
			const duration = 800 
			let startTime: number | null = null

			const animate = (currentTime: number) => {
				if (!startTime) startTime = currentTime
				const timeElapsed = currentTime - startTime
				const progress = Math.min(timeElapsed / duration, 1)

				// Expo ease-out
				const ease = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress)

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
			if (userScrollTimeout) clearTimeout(userScrollTimeout)
		}
	})

	const resumeSync = () => {
		isUserScrolling = false;
		if (userScrollTimeout) clearTimeout(userScrollTimeout);
		scrollToActiveLine();
	}

	const handleScroll = () => {
		isUserScrolling = true
		if (userScrollTimeout) clearTimeout(userScrollTimeout)
		
		// Longer timeout (8s) before auto-resuming, giving the user time to read
		userScrollTimeout = window.setTimeout(() => {
			resumeSync()
		}, 8000) 
	}

	const retry = () => {
		reloadCount += 1
	}
</script>

{#snippet emptyState(icon: 'musicNote' | 'alertCircle', title: string, description: string)}
	<div class="empty-state m-auto flex max-w-80 flex-col items-center text-center z-10">
		<Icon type={icon} class="color-onSecondaryContainer mb-4 size-24 opacity-54" />
		<div class="text-title-md font-bold">{title}</div>
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
						if (userScrollTimeout) clearTimeout(userScrollTimeout);
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

		<!-- Resume Sync FAB -->
		<button 
			class="resume-sync-fab" 
			class:visible={isUserScrolling}
			onclick={resumeSync}
			aria-label="Resume auto-scrolling"
		>
			<Icon type="arrowDown" class="size-5" />
			<span>Sync</span>
		</button>
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
		border-radius: 1.75rem; 
		box-shadow: 0 8px 32px rgba(0,0,0,0.3);
	}

	.m3-tonal-background {
		position: absolute;
		inset: 0;
		background: radial-gradient(
			120% 120% at 50% -10%,
			color-mix(in srgb, var(--primary-color) 25%, transparent) 0%,
			transparent 80%
		),
		radial-gradient(
			100% 100% at 50% 110%,
			color-mix(in srgb, var(--primary-color) 18%, transparent) 0%,
			transparent 100%
		);
		z-index: 0;
		pointer-events: none;
		transition: background 1.5s ease;
		animation: pulse-glow 8s infinite alternate ease-in-out;
	}

	@keyframes pulse-glow {
		0% { opacity: 0.8; transform: scale(1); }
		100% { opacity: 1; transform: scale(1.05); }
	}

	.lyrics-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 1.5rem 2rem;
		z-index: 10;
		background: linear-gradient(
			to bottom,
			var(--color-surface, #121212) 20%,
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
		backdrop-filter: blur(8px);
	}

	.lyrics-scroller {
		flex: 1;
		overflow-y: auto;
		padding: 0 2.5rem;
		scroll-behavior: auto; 
		z-index: 5;
		
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
		padding: 1.25rem 0;
		margin: 0.25rem 0;
		
		font-family: var(--font-family-sans, system-ui, sans-serif);
		font-size: 2.25rem;
		@media (min-width: 640px) { font-size: 2.5rem; }
		@media (min-width: 1024px) { font-size: 3rem; }
		
		font-weight: 700;
		line-height: 1.2;
		letter-spacing: -0.02em;
		white-space: pre-wrap;
		
		color: var(--color-onSurfaceVariant, #a0a0a0);
		opacity: 0.4;
		filter: blur(1px); /* Kept minimal for performance */
		transform: scale(0.95) translateY(5px);
		transform-origin: center left;
		cursor: pointer;

		will-change: transform, opacity, color;

		transition:
			opacity 0.6s cubic-bezier(0.2, 0, 0, 1),
			transform 0.6s cubic-bezier(0.2, 0, 0, 1),
			filter 0.6s cubic-bezier(0.2, 0, 0, 1);
	}

	.lyric-line:hover {
		opacity: 0.7;
		filter: blur(0px);
	}

	.lyric-line.active {
		color: var(--color-onSurface, #ffffff);
		opacity: 1;
		filter: blur(0px);
		transform: scale(1.05) translateY(0);
		font-weight: 800;
		text-shadow: 0 4px 24px color-mix(in srgb, var(--primary-color) 40%, transparent);
	}

	.lyric-line.past {
		opacity: 0.2;
		filter: blur(2px);
		transform: scale(0.92) translateY(-5px);
	}

	/* Word Level Animations */
	.lyric-word {
		display: inline-block;
		color: transparent;
		background: var(--color-onSurfaceVariant, #666);
		background-clip: text;
		-webkit-background-clip: text;
		transform-origin: bottom center;
		transition: transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
	}

	.lyric-line.active .lyric-word {
		/* Added a 5% feathering between the colors for a smoother gradient paint */
		background: linear-gradient(
			to right,
			var(--color-onSurface, #fff) 0%,
			var(--color-onSurface, #fff) calc(var(--word-progress, 0%) - 5%),
			var(--color-onSurfaceVariant, #666) calc(var(--word-progress, 0%) + 5%),
			var(--color-onSurfaceVariant, #666) 100%
		);
		background-size: 100% 100%;
		background-clip: text;
		-webkit-background-clip: text;
		-webkit-text-fill-color: transparent;
	}

	.lyric-line.active .lyric-word.active-word {
		/* Subtler karaoke bounce */
		transform: translateY(-2px) scale(1.02);
	}

	/* Resume Sync FAB */
	.resume-sync-fab {
		position: absolute;
		bottom: 2rem;
		right: 2rem;
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.75rem 1.25rem;
		background: var(--color-surfaceContainerHigh, #2A2A2A);
		color: var(--color-onSurface, #FFF);
		border-radius: 999px;
		font-weight: 600;
		font-size: 0.875rem;
		box-shadow: 0 8px 16px rgba(0,0,0,0.4);
		border: 1px solid color-mix(in srgb, var(--color-onSurface) 10%, transparent);
		z-index: 20;
		cursor: pointer;
		opacity: 0;
		transform: translateY(20px) scale(0.9);
		pointer-events: none;
		transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
	}

	.resume-sync-fab.visible {
		opacity: 1;
		transform: translateY(0) scale(1);
		pointer-events: auto;
	}

	.resume-sync-fab:hover {
		background: var(--color-surfaceContainerHighest, #333);
		transform: translateY(-2px) scale(1.02);
	}

	/* Skeleton Loaders */
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
