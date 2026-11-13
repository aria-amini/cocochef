import { expect, test } from '@playwright/test'

test('a signed-out visitor is asked for an account before keeping a pantry', async ({
	page,
}) => {
	test.setTimeout(30_000)
	await page.goto('/kitchen')
	await expect(
		page.getByRole('heading', { name: 'keep track of your kitchen' }),
	).toBeVisible({ timeout: 15_000 })
	// Taps before hydration are lost.
	await page.waitForLoadState('networkidle')
	await page.getByRole('button', { name: 'create an account' }).click()
	await expect(
		page.getByRole('dialog', { name: 'create an account' }),
	).toBeVisible()

	// There is no pantry to add to yet: adding leads back to the ask.
	await page.goto('/kitchen/bulk?cat=fruit')
	await expect(page).toHaveURL(/\/kitchen$/)
})
