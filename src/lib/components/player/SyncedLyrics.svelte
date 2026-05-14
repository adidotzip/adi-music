<script lang="ts" module>
	import type { SyncedLyricsLine } from '$lib/lyrics/synced-lyrics.ts'

	type LyricItem = 
		| (SyncedLyricsLine & { type: 'line'; isSecondaryLine: boolean; words: any[] })
		| { type: 'break'; startTime: number; endTime: number; id: string };

	const getActiveLineIndex = (
		items: readonly LyricItem[],
		currentTimeMs: number,
	): number => {
		let index = -1
		for (let i = 0; i < items.length; i += 1) {
			if (currentTimeMs >= items[i].startTime) {
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
	// Lower stiffness and higher damping for a silkier, heavier scroll feel
	const scrollOffset = spring(0, {
		stiffness: 0.04,
		damping: 0.75, 
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

	// ─── Process Lyrics & Inject Breaks ─────────────────────────────────────
	const processedItems = $derived.by(() => {
		const items: LyricItem[] = []
		
		for (let i = 0; i < lines.length; i += 1) {
			const line = lines[i]

			if (i > 0) {
				const prevLine = lines[i - 1]
				const gap = line.startTime - prevLine.endTime
				if (gap > 3500) {
					items.push({
						type: 'break',
						startTime: prevLine.endTime,
						endTime: line.startTime,
						id: `break-${i}`
					})
				}
			}

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

			const cleanedWords = words.map((word) => {
				return {
					...word,
					string: word.string.replace(/[()]/g, '')
				}
			})
			
			items.push({ 
				type: 'line', 
				...line, 
				words: cleanedWords, 
				isSecondaryLine 
			})
		}
		return items
	})

	const activeLineIndex = $derived(getActiveLineIndex(processedItems, smoothTimeMs))

	const getActiveWordIndex = (line: any, timeMs: number): number => {
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
		if (!containerElement || !contentElement || activeLineIndex < 0) return
		const activeEl = contentElement.querySelector<HTMLElement>(
			`[data-line-index="${activeLineIndex}"]`,
		)
		if (!activeEl) return

		const containerHeight = containerElement.offsetHeight
		const lineTop = activeEl.offsetTop
		const lineHeight = activeEl.offsetHeight

		// Center the active line perfectly
		const target = (containerHeight / 2) - lineTop - (lineHeight / 2)

		scrollOffset.set(target, { hard: immediate })
	}

	$effect(() => {
		if (!isUserScrolling) {
			updateScrollPosition()
		}
	})

	$effect(() => {
		const handleResize = () => updateScrollPosition(true)
		window.addEventListener('resize', handleResize)
		return () => window.removeEventListener('resize', handleResize)
	})

	const handleUserInteraction = () => {
		isUserScrolling = true
		clearTimeout(userScrollTimeout)
		// Wait a bit longer before snapping back so it doesn't fight the user
		userScrollTimeout = setTimeout(() => {
			isUserScrolling = false
		}, 3000)
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
	<div class="empty-state z-10 m-auto flex h-full max-w-80 flex-col items-center justify-center text-center opacity-50 transition-opacity duration-500">
		<Icon name={icon} class="mb-4 h-12 w-12 text-white/40" />
		<h3 class="text-xl font-bold text-white">{title}</h3>
		<p class="mt-2 text-sm text-white/60">{description}</p>
	</div>
{/snippet}

<section class={["lyrics-shell w-full h-full relative overflow-hidden bg-black", className]} aria-live="polite">
	{#if !track}
		{@render emptyState('musicNote', 'No Track Playing', 'Play a track to follow along with the lyrics.')}
	{:else if loading}
		<div class="flex h-full w-full items-center justify-center">
			<div class="h-8 w-8 animate-spin rounded-full border-b-2 border-t-2 border-white/50"></div>
		</div>
	{:else if result?.status === 'found'}
		<div
			class="lyrics-container absolute inset-0 h-full w-full"
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
				class="lyrics-content mx-auto w-full max-w-2xl"
				bind:this={contentElement}
				style="transform: translateY({$scrollOffset}px)"
			>
				{#each processedItems as item, itemIndex (item.type === 'break' ? item.id : itemIndex)}
					{@const isActiveLine = itemIndex === activeLineIndex}
					{@const distance = Math.abs(itemIndex - activeLineIndex)}

					{#if item.type === 'break'}
						{@const breakDuration = item.endTime - item.startTime}
						{@const breakProgress = isActiveLine ? Math.min(Math.max((smoothTimeMs - item.startTime) / breakDuration, 0), 1) : 0}
						<div
							class="lyric-item lyric-break"
							class:active={isActiveLine}
							class:past={itemIndex < activeLineIndex}
							data-line-index={itemIndex}
							style="--distance: {distance}"
						>
							<div class="dots-container">
								<span class="dot" class:filled={breakProgress >= 0.25}></span>
								<span class="dot" class:filled={breakProgress >= 0.50}></span>
								<span class="dot" class:filled={breakProgress >= 0.75}></span>
							</div>
						</div>
					{:else}
						{@const activeWordIdx = isActiveLine ? getActiveWordIndex(item, smoothTimeMs) : -1}
						
						<button
							type="button"
							class="lyric-item lyric-line interactable"
							class:active={isActiveLine}
							class:past={itemIndex < activeLineIndex}
							class:secondary-line={item.isSecondaryLine}
							data-line-index={itemIndex}
							style="--distance: {distance}"
							onclick={() => {
								player.seek(item.startTime / 1000)
								isUserScrolling = false
								updateScrollPosition()
							}}
						>
							{#each item.words as word, wordIndex}
								{#if word.string.trim().length > 0}
									{@const isPastWord = isActiveLine && wordIndex < activeWordIdx}
									{@const isCurrentWord = isActiveLine && wordIndex === activeWordIdx}
									{@const nextTime = item.words[wordIndex + 1]?.time ?? item.endTime}
									{@const duration = Math.max(nextTime - word.time, 1)}
									{@const wordProgress = isCurrentWord
										? Math.min(Math.max((smoothTimeMs - word.time) / duration, 0), 1) * 100
										: isPastWord ? 100 : 0}

									<span
										class="lyric-word"
										class:past-word={isPastWord}
										class:secondary-word={word.isSecondary}
										style="--word-progress: {wordProgress}%"
									>{word.string}</span>
								{/if}
							{/each}
						</button>
					{/if}
				{/each}
			</div>
		</div>
	{:else}
		{@render emptyState('alertCircle', 'Lyrics Unavailable', "We couldn't find synced lyrics for this track.")}
	{/if}
</section>

<style lang="postcss">
	@reference "../../../app.css";

	.lyrics-container {
		/* Creates a premium fade-out effect at the top and bottom of the scrolling list */
		mask-image: linear-gradient(
			to bottom,
			transparent 0%,
			black 10%,
			black 85%,
			transparent 100%
		);
		-webkit-mask-image: linear-gradient(
			to bottom,
			transparent 0%,
			black 10%,
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
		padding: 0 1.5rem;
		@media (min-width: 640px) { padding: 0 2rem; }
		padding-bottom: calc(env(safe-area-inset-bottom) + 60vh);
		padding-top: 50vh; /* Gives space to scroll to the very top line smoothly */
		will-change: transform;
	}

	.lyric-item {
		display: block;
		width: 100%;
		text-align: left;
		background: transparent;
		border: none;
		margin: 0;
		padding: 1.25rem 0; 
		transform-origin: left center;
		will-change: transform, opacity, filter;
		
		/* Softer depth of field curve */
		opacity: clamp(0.1, calc(0.4 / (1 + var(--distance) * 0.4)), 1);
		transform: scale(calc(1 - var(--distance) * 0.03));
		filter: blur(calc(var(--distance) * 1.5px));
		
		/* Butter-smooth out-expo easing */
		transition:
			opacity 0.8s cubic-bezier(0.2, 0.8, 0.2, 1),
			transform 0.8s cubic-bezier(0.2, 0.8, 0.2, 1),
			filter 0.8s cubic-bezier(0.2, 0.8, 0.2, 1);
	}

	.lyric-line {
		font-family: var(--font-sans);
		font-size: 2.15rem;
		@media (min-width: 640px) { font-size: 2.75rem; }
		@media (min-width: 1024px) { font-size: 3.5rem; }
		font-weight: 800;
		line-height: 1.2;
		letter-spacing: -0.02em;
		white-space: pre-wrap;
		color: #fff;
		cursor: pointer;
		-webkit-tap-highlight-color: transparent;
	}

	.lyric-item:hover {
		opacity: clamp(0.5, calc(0.6 / (1 + var(--distance) * 0.3)), 1);
	}

	.lyric-item.active {
		opacity: 1;
		transform: scale(1.02); /* Slight pop for the active line */
		filter: blur(0);
	}

	.lyric-item.past {
		/* Dim past lines slightly more than future lines to guide the eye downward */
		opacity: clamp(0.05, calc(0.2 / (1 + var(--distance) * 0.6)), 1);
	}

	.lyric-line.secondary-line {
		font-size: 1.5rem;
		@media (min-width: 640px) { font-size: 1.85rem; }
		@media (min-width: 1024px) { font-size: 2.5rem; }
		font-weight: 600;
		font-style: italic;
		color: rgba(255, 255, 255, 0.6);
	}

	.lyric-word.secondary-word {
		font-size: 0.9em; 
		color: rgba(255, 255, 255, 0.6);
		font-style: italic;
	}

	.lyric-word {
		display: inline-block;
		position: relative;
		margin-right: 0.15em;
		/* Ensures gradient fills work correctly if a long word wraps to the next line */
		-webkit-box-decoration-break: clone;
		box-decoration-break: clone;
	}

	.lyric-line.active .lyric-word {
		/* Softer leading edge on the karaoke fill so it doesn't look pixelated */
		background: linear-gradient(
			to right,
			#ffffff var(--word-progress),
			rgba(255, 255, 255, 0.25) calc(var(--word-progress) + 15%)
		);
		-webkit-background-clip: text;
		background-clip: text;
		color: transparent;
		transition: none;
	}

	.lyric-line.active .lyric-word.secondary-word {
		background: linear-gradient(
			to right,
			rgba(255, 255, 255, 0.85) var(--word-progress),
			rgba(255, 255, 255, 0.15) calc(var(--word-progress) + 15%)
		);
		-webkit-background-clip: text;
		background-clip: text;
	}

	.lyric-break {
		display: flex;
		align-items: center;
		padding: 3rem 0;
	}

	.dots-container {
		display: flex;
		gap: 0.75rem;
	}

	.dot {
		width: 10px;
		height: 10px;
		border-radius: 50%;
		background-color: rgba(255, 255, 255, 0.2);
		transition: background-color 0.4s ease, transform 0.4s ease;
	}

	.dot.filled {
		background-color: rgba(255, 255, 255, 0.9);
		transform: scale(1.3);
	}
</style>
