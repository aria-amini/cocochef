import { expect, test } from '@playwright/test'

test('a first ingredient save creates a guest shelf and shows its count at signup', async ({
	page,
}) => {
	test.setTimeout(30_000)
	// The bulk picker hides the phone header, so the account is checked on the
	// ingredients page, which shows it on every screen size.
	await page.goto('/ingredients')
	await expect(page.getByRole('button', { name: 'Guest account' })).toBeVisible(
		{ timeout: 15_000 },
	)
	await page.goto('/ingredients/bulk?cat=fruit')
	// Taps before hydration are lost.
	await page.waitForLoadState('networkidle')
	await page.getByRole('button', { name: 'pineapple', exact: true }).click()
	await page.getByRole('button', { name: 'add 1' }).click()
	await expect(
		page.getByRole('link', { name: /fruit 1\/\d+ stashed/ }),
	).toBeVisible()
	await page.goto('/ingredients')
	await page.getByRole('button', { name: 'Guest account' }).click()
	await page.getByRole('menuitem', { name: 'create an account' }).click()
	await expect(
		page.getByText(
			'keep your 1 ingredient on any device once you have an account.',
		),
	).toBeVisible()
})
