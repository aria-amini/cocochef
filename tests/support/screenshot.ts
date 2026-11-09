import {
	expectScreenshot,
	type ScreenshotOptions,
} from '@aamini/config/vitest/browser'
import type { Locator } from 'vitest/browser'

// Hides everything on the page but the target: each sibling of the target and
// of every element above it. `visibility` keeps their boxes, so the target lays
// out as it does in the app, and ancestors still paint their backgrounds. Fixed
// layers drawn over the target, such as the tab bar or a dialog's backdrop,
// drop out of the capture. Returns a function that shows them again.
function hideAllBut(target: Element) {
	const hidden: { element: HTMLElement; visibility: string }[] = []

	for (
		let element: Element | null = target;
		element && element !== document.documentElement;
		element = element.parentElement
	) {
		for (const sibling of element.parentElement?.children ?? []) {
			if (sibling === element || !(sibling instanceof HTMLElement)) continue

			hidden.push({ element: sibling, visibility: sibling.style.visibility })
			sibling.style.visibility = 'hidden'
		}
	}

	return () => {
		for (const { element, visibility } of hidden)
			element.style.visibility = visibility
	}
}

function targetElement(target: Locator | HTMLElement) {
	const element = target instanceof HTMLElement ? target : target.element()

	if (!(element instanceof HTMLElement))
		throw new Error('expected an HTML element to capture')

	return element
}

// Compares one part of the screen with its baseline, alone. A page capture
// leaves out the app shell, and a dialog capture its backdrop and the page
// behind, so a change to one owns exactly one set of baselines.
export async function expectIsolatedScreenshot(
	target: Locator | HTMLElement,
	name: string,
	options?: ScreenshotOptions,
) {
	const element = targetElement(target)
	const show = hideAllBut(element)

	try {
		await expectScreenshot(element, name, options)
	} finally {
		show()
	}
}

// The page under the app shell: the route's <main>, without the sidebar,
// header, tab bar or round add button around it.
export async function expectPageScreenshot(
	target: Locator | HTMLElement,
	name: string,
	options?: ScreenshotOptions,
) {
	const main = targetElement(target).querySelector('main')

	if (!(main instanceof HTMLElement)) throw new Error('no <main> on the page')

	await expectIsolatedScreenshot(main, name, options)
}
