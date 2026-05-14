import { writeFileSync } from 'node:fs'
import {
	argbFromHex,
	// biome-ignore lint/style/noRestrictedImports: Used for static theme generation
} from '@material/material-color-utilities'
import { getThemePaletteRgbEntries } from '../src/lib/theme.ts'

const defaultColorSeed = '#780606'
const outputFile = `${import.meta.dirname}/../src/theme-colors.css`

const argb = argbFromHex(defaultColorSeed)

const camelToKebab = (str: string) => str.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)

const tokensLightEntries = getThemePaletteRgbEntries(argb, false)
const tokensDark = Object.fromEntries(getThemePaletteRgbEntries(argb, true))

const variables = tokensLightEntries
	.map(([name, lightValue]) => {
		const kebabName = camelToKebab(name)
		const darkValue = tokensDark[name]
		return `--color-${name}: light-dark(${lightValue}, ${darkValue});\n	--m3c-${kebabName}: light-dark(${lightValue}, ${darkValue});`
	})
	.join('\n	')

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
