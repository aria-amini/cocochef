import type { IconProps } from '@phosphor-icons/react'
import { createElement } from 'react'

import { recipeIcon } from '@/lib/recipes/recipe-icon'

// A picture-in-waiting for a recipe with no photo: an icon guessed from its name.
export function RecipeGlyph({
	title,
	...props
}: { title: string } & Omit<IconProps, 'ref'>) {
	return createElement(recipeIcon(title), {
		weight: 'duotone',
		'aria-hidden': true,
		...props,
	})
}
