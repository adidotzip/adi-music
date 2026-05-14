<script lang="ts" module>
	import type { SyncedLyricsLine } from '$lib/lyrics/synced-lyrics.ts'

	// Define our unified item type for the scrolling list
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
	import iconAlert from '@ktibow/iconset-material-symbols/error'

	import iconMusic from '@ktibow/iconset-material-symbols/music-note'
	import { Button, Icon } from 'm3-svelte'
	import { spring } from 'svelte/motion'
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
	const scrollOffset = spring(0, {
		stiffness: 0.1,
		damping: 0.7,
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
			if (!running) { return }
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

			// Inject 3-dots break if gap is > 3.5 seconds
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

			// Parse secondary words inside ()
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
			
			// Detect if the whole line is secondary before stripping brackets
			const lineText = words.map((w) => w.string).join('').trim()
			const isSecondaryLine = lineText.startsWith('(') && lineText.endsWith(')')

			// Strip out the parentheses for the final display
			const cleanedWords = words.map((word) => {
				return {
					...word,
					string: word.string.replace(/[()]/g, '') // Removes '(' and ')'
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
			if (timeMs >= line.words[i].time) { return i }
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
				if (error instanceof Error && error.name === 'AbortError') { return }
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
		if (!(containerElement && contentElement ) || activeLineIndex < 0) { return }
		const activeEl = contentElement.querySelector<HTMLElement>(
			`[data-line-index="${activeLineIndex}"]`,
		)
		if (!activeEl) { return }

		const containerHeight = containerElement.offsetHeight
		const lineTop = activeEl.offsetTop
		const lineHeight = activeEl.offsetHeight

		const target = (containerHeight / 3) - lineTop - (lineHeight / 2)

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

{#snippet emptyState(icon: any, title: string, description: string)}
	<div class="empty-state z-10 m-auto flex max-w-80 flex-col items-center text-center">
		<Icon {icon} size={64} class="mb-4 opacity-50" />
		<div class="text-headline-sm font-bold mb-2">{title}</div>
		<div class="text-body-md opacity-70 mb-6">{description}</div>
		<Button variant="tonal" onclick={retry}>Retry</Button>
	</div>
{/snippet}

<section class={["lyrics-shell w-full h-full relative overflow-hidden", className]} aria-live="polite">
	{#if !track}
		{@render emptyState(iconMusic, 'No Track', 'Play a track to see lyrics.')}
	{:else if loading}
		<div class="m-auto flex flex-col items-center animate-pulse">
			<div class="h-8 w-64 bg-white/10 rounded-full mb-4"></div>
			<div class="h-8 w-48 bg-white/10 rounded-full mb-4"></div>
			<div class="h-8 w-56 bg-white/10 rounded-full"></div>
		</div>
	{:else if result?.status === 'found'}
		<div
			class="lyrics-container absolute inset-0 w-full h-full"
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
				class="lyrics-content mx-auto w-full max-w-3xl"
				bind:this={contentElement}
				style="transform: translateY({$scrollOffset}px)"
			>
				{#each processedItems as item, itemIndex (item.type === 'break' ? item.id : itemIndex)}
					{@const isActiveLine = itemIndex === activeLineIndex}
					{@const distance = Math.abs(itemIndex - activeLineIndex)}

					{#if item.type === 'break'}
						<div
							class="lyric-item lyric-break"
							class:active={isActiveLine}
							data-line-index={itemIndex}
						>
							<div class="dots-container">
								<span class="dot"></span>
								<span class="dot"></span>
								<span class="dot"></span>
							</div>
						</div>
					{:else}
						{@const activeWordIdx = isActiveLine ? getActiveWordIndex(item, smoothTimeMs) : -1}
						
						<button
							type="button"
							class="lyric-item lyric-line"
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
		{@render emptyState(iconAlert, 'Lyrics Not Found', 'We couldn\'t find lyrics for this track.')}
	{/if}
</section>

<style lang="postcss">
	@reference "../../../app.css";

	.lyrics-shell {
		mask-image: linear-gradient(
			to bottom,
			transparent,
			black 15%,
			black 85%,
			transparent
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
		@media (min-width: 640px) { padding: 0 3rem; }
		padding-top: 20vh;
		padding-bottom: calc(env(safe-area-inset-bottom) + 60vh);
		will-change: transform;
	}

	.lyric-item {
		display: block;
		width: 100%;
		text-align: left;
		background: transparent;
		border: none;
		margin: 0;
		padding: 1.5rem 0;
		transform-origin: left center;
		will-change: transform, opacity, filter;
		
		opacity: calc(1 / (1 + var(--distance) * 1.5));
		transform: scale(calc(1 - var(--distance) * 0.03));
		filter: blur(calc(var(--distance) * 1.5px));
		
		transition:
			opacity 0.8s cubic-bezier(0.2, 0, 0, 1),
			transform 0.8s cubic-bezier(0.2, 0, 0, 1),
			filter 0.8s cubic-bezier(0.2, 0, 0, 1);
	}

	.lyric-line {
		font-family: var(--m3-font);
		font-size: 2.5rem;
		@media (min-width: 640px) { font-size: 3.25rem; }
		@media (min-width: 1024px) { font-size: 4rem; }
		font-weight: 900;
		line-height: 1.1;
		letter-spacing: -0.04em;
		white-space: pre-wrap;
		color: #fff;
		cursor: pointer;
		filter: drop-shadow(0 4px 12px rgba(0,0,0,0.3));
	}

	.lyric-item.active {
		opacity: 1;
		transform: scale(1.05);
		filter: blur(0);
	}

	.lyric-line.secondary-line {
		font-size: 1.75rem;
		@media (min-width: 640px) { font-size: 2.25rem; }
		@media (min-width: 1024px) { font-size: 3rem; }
		font-weight: 700;
		opacity: 0.6;
	}

	.lyric-word {
		display: inline-block;
		position: relative;
		margin-right: 0.15em;
		transition: transform 0.3s cubic-bezier(0.2, 0, 0, 1);
	}

	.lyric-line.active .lyric-word {
		background: linear-gradient(
			to right,
			#ffffff calc(var(--word-progress) - 5%),
			rgba(255, 255, 255, 0.4) calc(var(--word-progress) + 5%)
		);
		-webkit-background-clip: text;
		background-clip: text;
		color: transparent;
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
		width: 16px;
		height: 16px;
		border-radius: 50%;
		background-color: rgba(255, 255, 255, 0.3);
		transition: background-color 0.4s ease;
	}

	.lyric-break.active .dot {
		background-color: rgba(255, 255, 255, 1);
		animation: pulse-dot 1.2s infinite cubic-bezier(0.4, 0, 0.2, 1);
		box-shadow: 0 0 15px rgba(255, 255, 255, 0.5);
	}

	.lyric-break.active .dot:nth-child(1) { animation-delay: 0s; }
	.lyric-break.active .dot:nth-child(2) { animation-delay: 0.15s; }
	.lyric-break.active .dot:nth-child(3) { animation-delay: 0.3s; }

	@keyframes pulse-dot {
		0%, 100% { transform: scale(1); opacity: 0.4; }
		50% { transform: scale(1.4); opacity: 1; }
	}
</style>
