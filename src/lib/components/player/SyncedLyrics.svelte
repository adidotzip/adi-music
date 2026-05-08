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
	let lineRefs: (HTMLElement | null)[] = $state([]) // ⚡ Fix #6: DOM query caching
	let reloadCount = $state(0)
	
	let previousActiveIndex = -1

	const foundResult = $derived(result?.status === 'found' ? result : undefined)
	const lines = $derived(foundResult?.lines ?? [])

	// ⚡ Fix #5: $derived inherently caches this unless `lines` changes. 
	// currentTimeMs won't trigger recalculation here.
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
				return {
					...word,
					isSecondary: isWordSecondary,
				}
			})

			const lineText = words.map((w) => w.string).join('').trim()
			const isSecondaryLine = lineText.startsWith('(') && lineText.endsWith(')')

			return {
				...line,
				words,
				isSecondaryLine,
			}
		}),
	)

	const activeLineIndex = $derived(getActiveLineIndex(processedLines, currentTimeMs))

	const getActiveWordIndex = (line: SyncedLyricsLine, timeMs: number): number => {
		for (let i = line.words.length - 1; i >= 0; i -= 1) {
			if (timeMs >= line.words[i].time) {
				return i
			}
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

	// 🌌 Fix #2 & #6: Magnetic predictive scrolling with cached refs
	const scrollToActiveLine = (smooth = true) => {
		if (!scrollerElement || activeLineIndex < 0) return

		const activeEl = lineRefs[activeLineIndex]
		if (!activeEl) return

		// Magnetic centering: sits slightly above exact center
		const targetScroll = activeEl.offsetTop - scrollerElement.clientHeight * 0.38

		scrollerElement.scrollTo({
			top: targetScroll,
			behavior: smooth ? 'smooth' : 'auto'
		})
	}

	$effect(() => {
		if (activeLineIndex !== previousActiveIndex) {
			previousActiveIndex = activeLineIndex
			scrollToActiveLine()
		}
	})

	const retry = () => {
		reloadCount += 1
	}
</script>

{#snippet emptyState(icon: 'musicNote' | 'alertCircle', title: string, description: string)}
	<div class="empty-state z-10 m-auto flex max-w-80 flex-col items-center text-center">
		<Icon type={icon} class="color-onSecondaryContainer mb-4 size-24 opacity-54" />
		<div class="text-title-md font-bold">{title}</div>
		<div class="mt-2 text-body-md text-onSecondaryContainer/72">{description}</div>
		{#if icon === 'alertCircle'}
			<Button kind="outlined" class="mt-6" onclick={retry}>Reload</Button>
		{/if}
	</div>
{/snippet}

<section 
	class="lyrics-shell card" 
	aria-live="polite" 
	style="--primary-color: {track?.primaryColor ? `rgb(${((track.primaryColor >> 16) & 0xFF)}, ${((track.primaryColor >> 8) & 0xFF)}, ${(track.primaryColor & 0xFF)})` : 'var(--color-primary, #D0BCFF)'}"
>
	<div class="ambient-glow-background"></div>
	
	{#if !track}
		{@render emptyState('musicNote', 'No Track', 'Play a track to see lyrics.')}
	{:else if loading}
		<!-- Skeleton States -->
		<div class="lyrics-header">
			<div class="min-w-0">
				<div class="skeleton bg-surfaceContainerHighest mb-2 h-7 w-36 rounded-md"></div>
				<div class="skeleton bg-surfaceContainerHighest h-5 w-28 rounded-md opacity-70"></div>
			</div>
		</div>
		<div class="lyrics-scroller overflow-hidden px-6 pt-12">
			{#each Array(6) as _, i}
				<div 
					class="skeleton bg-surfaceContainerHighest mb-10 h-14 rounded-xl opacity-20"
					style="width: {60 + Math.random() * 30}%; transform: translateX({i % 2 === 0 ? '0' : '5%'})"
				></div>
			{/each}
		</div>
	{:else if result?.status === 'found'}
		<div class="lyrics-header">
			<div class="min-w-0" lang={getItemLanguage(track.language)}>
				<div class="text-onSurface truncate text-title-lg font-bold tracking-tight">{track.name}</div>
				<div class="text-onSurfaceVariant truncate text-body-md font-medium">
					{formatArtists(track.artists)}
				</div>
			</div>
		</div>

		<div class="lyrics-scroller" bind:this={scrollerElement}>
			<div class="lyrics-spacer"></div>
			{#each processedLines as line, lineIndex (lineIndex)}
				{@const isActiveLine = lineIndex === activeLineIndex}
				{@const isPastLine = lineIndex < activeLineIndex}
				{@const isUpcomingLine = lineIndex === activeLineIndex + 1}
				{@const activeWordIdx = getActiveWordIndex(line, currentTimeMs)}

				<button
					bind:this={lineRefs[lineIndex]}
					type="button"
					class="lyric-line interactable"
					class:active={isActiveLine}
					class:past={isPastLine}
					class:upcoming={isUpcomingLine}
					class:secondary-line={line.isSecondaryLine}
					onclick={() => player.seek(line.startTime / 1000)}
				>
					{#each line.words as word, wordIndex}
						{@const isPastWord = isActiveLine && wordIndex < activeWordIdx}
						{@const isCurrentWord = isActiveLine && wordIndex === activeWordIdx}
						{@const nextTime = line.words[wordIndex + 1]?.time ?? line.endTime}
						{@const duration = Math.max(nextTime - word.time, 1)}
						<!-- Pre-calculate pure scale format for hardware acceleration -->
						{@const wordProgressScale = isCurrentWord 
							? Math.min(Math.max((currentTimeMs - word.time) / duration, 0), 1) 
							: (isPastWord ? 1 : 0)}
						
						<span 
							class="lyric-word" 
							class:active-word={isCurrentWord}
							class:secondary-word={word.isSecondary && !line.isSecondaryLine}
							data-word={word.string}
							style="--word-progress-scale: {wordProgressScale};"
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
		background: var(--color-surface, #000000); 
		border-radius: 1.75rem; 
		box-shadow: 0 12px 48px rgba(0,0,0,0.4);
	}

	.ambient-glow-background {
		position: absolute;
		inset: 0;
		background: radial-gradient(
			100% 100% at 50% -10%,
			color-mix(in srgb, var(--primary-color) 25%, transparent) 0%,
			transparent 80%
		),
		radial-gradient(
			80% 120% at 50% 120%,
			color-mix(in srgb, var(--primary-color) 15%, transparent) 0%,
			transparent 100%
		);
		/* 🔥 Fix #11: Reduced blur to prevent Safari heat death */
		filter: blur(24px); 
		z-index: 0;
		pointer-events: none;
		transition: background 1.5s ease;
		/* Using opacity/transform animation only */
		animation: subtle-drift 12s infinite alternate ease-in-out;
		will-change: opacity, transform;
	}

	@keyframes subtle-drift {
		0% { opacity: 0.6; transform: scale(1); }
		100% { opacity: 0.9; transform: scale(1.05); }
	}

	.lyrics-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 1.5rem 2.5rem;
		z-index: 10;
		background: linear-gradient(
			to bottom,
			color-mix(in srgb, var(--color-surface, #000) 90%, transparent) 20%,
			transparent 100%
		);
	}

	.lyrics-scroller {
		flex: 1;
		overflow-y: auto;
		padding: 0 2.5rem;
		z-index: 5;
		
		/* 🧃 Fix #7: iOS Safari ultra-native feel */
		-webkit-overflow-scrolling: touch;
		overscroll-behavior-y: contain;
		
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

	/* --- PREMIUM TYPOGRAPHY & LAYERING --- */

	.lyric-line {
		display: block;
		width: 100%;
		text-align: left;
		background: transparent;
		border: none;
		padding: 1rem 0;
		margin: 0.5rem 0;
		
		font-family: var(--font-family-sans, system-ui, -apple-system, sans-serif);
		/* 🪶 Fix #10: Fluid elegant sizing */
		font-size: clamp(2rem, 4vw, 3.5rem);
		font-weight: 700;
		line-height: 1.2;
		letter-spacing: -0.02em;
		white-space: pre-wrap;
		user-select: none; 
		
		/* 🎨 Fix #4: Better inactive readability */
		color: var(--color-onSurfaceVariant, #a0a0a0);
		opacity: 0.5;
		
		/* ✨ Fix #3: Depth layering perspective */
		transform-origin: left center;
		transform: perspective(1000px) translateZ(0) scale(0.95); 
		cursor: pointer;

		will-change: transform, opacity, filter;
		transition:
			opacity 0.6s cubic-bezier(0.25, 1, 0.5, 1),
			transform 0.6s cubic-bezier(0.25, 1, 0.5, 1),
			filter 0.6s ease;
	}

	/* 🎼 Fix #9: Anticipation fade */
	.lyric-line.upcoming {
		opacity: 0.72;
	}

	.lyric-line:hover {
		opacity: 0.8;
	}

	.lyric-line.active {
		color: var(--color-onSurface, #ffffff);
		opacity: 1;
		transform: perspective(1000px) translateZ(0) scale(1);
		font-weight: 800;
		
		/* 🌈 Fix #8: OLED-glow feeling tied to album primary color */
		text-shadow: 0 0 24px color-mix(in srgb, var(--primary-color) 35%, transparent);
	}

	/* ✨ Fix #3: Depth layer blur for past lines */
	.lyric-line.past {
		opacity: 0.28;
		transform: perspective(1000px) translateZ(-50px) scale(0.92);
		filter: blur(1px);
	}

	/* 🌌 THE "FLOATING HARMONY" SECONDARY LYRICS UPGRADE */
	.lyric-line.secondary-line {
		font-weight: 500;
		font-style: italic;
		opacity: 0.68;
		/* Ethereal blend instead of tiny text */
		color: color-mix(in srgb, var(--primary-color) 35%, white 65%);
		/* Tiny blur for dreamy backing vocal vibe */
		filter: blur(0.15px);
		/* Reset transform impacts so they don't crush into nothingness when past */
		transform: perspective(1000px) translateZ(0) scale(1);
	}

	.lyric-line.secondary-line.past {
		opacity: 0.2;
		filter: blur(1.5px);
	}

	/* 🎤 Fix #1: GPU-Driven Karaoke Motion */
	.lyric-word {
		position: relative;
		display: inline-block;
		color: var(--color-onSurfaceVariant, #555);
	}

	/* Replaces background-size jank with buttery scaleX */
	.lyric-word::after {
		content: attr(data-word);
		position: absolute;
		left: 0;
		top: 0;
		color: var(--color-onSurface, #fff);
		overflow: hidden;
		transform-origin: left center;
		transform: scaleX(var(--word-progress-scale, 0));
		/* Hard mask ensures sharp character cutting */
		clip-path: inset(0 0 0 0);
		will-change: transform;
	}

	/* Fallback for secondary-word without structural jank */
	.lyric-word.secondary-word {
		opacity: 0.78;
	}
	
	.lyric-word.secondary-word::after {
		color: color-mix(in srgb, var(--primary-color) 35%, white 65%);
	}

	.skeleton {
		animation: ambient-shimmer 2.5s infinite ease-in-out;
		background: linear-gradient(
			90deg,
			var(--color-surfaceContainerHighest, #222) 0%,
			var(--color-surfaceContainer, #333) 50%,
			var(--color-surfaceContainerHighest, #222) 100%
		);
		background-size: 200% 100%;
	}

	@keyframes ambient-shimmer {
		0% { background-position: -200% 0; }
		100% { background-position: 200% 0; }
	}
</style>
