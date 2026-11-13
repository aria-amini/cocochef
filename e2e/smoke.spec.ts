import { expect, test } from '@playwright/test'

test('home and sign in render', async ({ page }) => {
	await page.goto('/')
	await expect(
		page.getByRole('heading', { name: /what are you making/ }),
	).toBeVisible()
	await page.goto('/auth/login')
	await expect(page.getByRole('heading', { name: 'sign in' })).toBeVisible()
})
