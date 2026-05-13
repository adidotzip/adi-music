<script lang="ts">
	import { m } from '$paraglide/messages'
	import { page } from '$app/state'
	import Button from './Button.svelte'
	import Icon, { type IconType } from './icon/Icon.svelte'
	import { useMainStore } from '$lib/stores/main/use-store'
	import IconButton from './IconButton.svelte'

	interface NavItem {
		slug: string
		title: string
		icon: IconType
		href: string
	}

	const navItems: NavItem[] = [
		{
			slug: 'tracks',
			title: m.tracks(),
			icon: 'musicNote',
			href: '/library/tracks',
		},
		{
			slug: 'albums',
			title: m.albums(),
			icon: 'album',
			href: '/library/albums',
		},
		{
			slug: 'artists',
			title: m.artists(),
			icon: 'person',
			href: '/library/artists',
		},
		{
			slug: 'playlists',
			title: m.playlists(),
			icon: 'playlist',
			href: '/library/playlists',
		},
		{
			slug: 'online',
			title: 'Online',
			icon: 'search',
			href: '/online',
		},
	]

	interface Props {
		mode: 'sidebar' | 'bottom-bar'
	}

	const { mode }: Props = $props()
	const main = useMainStore()

	const currentSlug = $derived(page.params.slug || (page.url.pathname.startsWith('/online') ? 'online' : ''))
</script>

{#if mode === 'sidebar'}
	<div
		class="desktop-sidebar fixed z-1 mt-20 flex h-max w-max flex-col items-center gap-2 [@media(max-height:500px)]:mt-2"
	>
		{#each navItems as item}
			<Button
				as="a"
				href={item.href}
				kind="blank"
				tooltip={item.title}
				class="flex h-14 w-20 shrink-0 items-center justify-center"
			>
				<div
					class={[
						'flex items-center justify-center rounded-full p-2',
						(currentSlug === item.slug || (item.slug === 'online' && page.url.pathname.startsWith('/online'))) &&
							'bg-secondaryContainer text-onSecondaryContainer',
					]}
				>
					<Icon type={item.icon} />
				</div>
			</Button>
		{/each}

		{#if (currentSlug === 'albums' || currentSlug === 'artists') && main.librarySplitLayoutEnabled}
			<!-- This part is specific to library layout, maybe keep it there or handle here -->
		{/if}
	</div>
{:else}
	<div
		class="pointer-events-auto grid h-16 w-full grid-cols-[repeat(auto-fit,minmax(0,1fr))] bg-surfaceContainer sm:hidden active-view-regular:view-name-[bottom-bar]"
	>
		{#each navItems as item}
			<Button
				as="a"
				href={item.href}
				kind="blank"
				tooltip={item.title}
				class="flex h-full shrink-0 items-center justify-center"
			>
				<div
					class={[
						'flex items-center justify-center rounded-full p-2',
						(currentSlug === item.slug || (item.slug === 'online' && page.url.pathname.startsWith('/online'))) &&
							'bg-secondaryContainer text-onSecondaryContainer',
					]}
				>
					<Icon type={item.icon} />
				</div>
			</Button>
		{/each}
	</div>
{/if}
