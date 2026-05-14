import { writeFileSync } from 'node:fs'
import {
	argbFromHex,
	// biome-ignore lint/style/noRestrictedImports: Used for static theme generation
} from '@material/material-color-utilities'
import { getThemePaletteRgbEntries } from '../src/lib/theme.ts'

const defaultColorSeed = '#780606'
const outputFile = `${import.meta.dirname}/../src/theme-colors.css`

const argb = argbFromHex(defaultColorSeed)

const tokensLightEntries = getThemePaletteRgbEntries(argb, false)
const tokensLight = Object.fromEntries(tokensLightEntries)
const tokensDark = Object.fromEntries(getThemePaletteRgbEntries(argb, true))

const M3_COLOR_MAPPING: Record<string, string> = {
	primary: 'primary',
	'on-primary': 'onPrimary',
	'primary-container': 'primaryContainer',
	'on-primary-container': 'onPrimaryContainer',
	secondary: 'secondary',
	'on-secondary': 'onSecondary',
	'secondary-container': 'secondaryContainer',
	'on-secondary-container': 'onSecondaryContainer',
	tertiary: 'tertiary',
	'on-tertiary': 'onTertiary',
	'tertiary-container': 'tertiaryContainer',
	'on-tertiary-container': 'onTertiaryContainer',
	error: 'error',
	'on-error': 'onError',
	'error-container': 'errorContainer',
	'on-error-container': 'onErrorContainer',
	surface: 'surface',
	'on-surface': 'onSurface',
	'surface-variant': 'surfaceVariant',
	'on-surface-variant': 'onSurfaceVariant',
	'surface-container-highest': 'surfaceContainerHighest',
	'surface-container-high': 'surfaceContainerHigh',
	'surface-container': 'surfaceContainer',
	'surface-container-low': 'surfaceContainerLow',
	'surface-container-lowest': 'surfaceContainerLowest',
	'surface-bright': 'surfaceBright',
	'surface-dim': 'surfaceDim',
	outline: 'outline',
	'outline-variant': 'outlineVariant',
	shadow: 'shadow',
	scrim: 'scrim',
	'inverse-surface': 'inverseSurface',
	'inverse-on-surface': 'inverseOnSurface',
	'inverse-primary': 'inversePrimary',
}

const variables = [
	...tokensLightEntries.map(
		([name, lightValue]) => `--color-${name}: light-dark(${lightValue}, ${tokensDark[name]});`,
	),
	...Object.entries(M3_COLOR_MAPPING).map(
		([m3Name, internalName]) =>
			`--m3c-${m3Name}: light-dark(${tokensLight[internalName]}, ${tokensDark[internalName]});`,
	),
].join('\n	')

const content = `/* This file is auto generated, do not edit manually. */
@theme {
	--color-*: initial;
	--color-transparent: transparent;
	--color-current: currentColor;
	${variables}
}
`

writeFileSync(outputFile, content, {
	encoding: 'utf-8',
})
