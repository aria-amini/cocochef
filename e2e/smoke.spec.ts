import { expect, test } from '@playwright/test'

test('landing page renders', async ({ page }) => {
	await page.goto('/')
	await expect(
		page.getByRole('heading', { name: /never made up by AI/ }),
	).toBeVisible()
	await page.goto('/auth/login')
	await expect(page.getByRole('heading', { name: 'sign in' })).toBeVisible()
})
