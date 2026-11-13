import { beforeEach, describe, expect, test, vi } from 'vite-plus/test'
import { z } from 'zod'

type Auth = { accountId: string | null }

const auth = vi.hoisted(() => {
	const state: Auth = { accountId: null }

	return state
})

vi.mock('@/lib/auth/session', () => ({
	getAccountId: async () => auth.accountId,
}))

const model = vi.hoisted(() => ({ askModel: vi.fn(async () => 'answer') }))

vi.mock('./model', () => model)

const { ask, mayAskModel } = await import('./ask.server')

const schema = z.object({ name: z.string() })

describe('who reaches the model', () => {
	beforeEach(() => {
		model.askModel.mockClear()
	})

	test('a visitor gets the mock answers, never the model', async () => {
		auth.accountId = null
		expect(await mayAskModel()).toBe(false)
		expect(await ask('sections', '', '', schema)).toBeUndefined()
		expect(model.askModel).not.toHaveBeenCalled()
	})

	test('a signed-in cook reaches it, thirty times a minute', async () => {
		auth.accountId = crypto.randomUUID()

		const answers = []

		for (let call = 0; call < 31; call++) answers.push(await mayAskModel())

		expect(answers.slice(0, 30).every(Boolean)).toBe(true)
		expect(answers[30]).toBe(false)
	})
})
