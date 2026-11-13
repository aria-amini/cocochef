import { BucketAlreadyOwnedByYou, S3Client } from '@aws-sdk/client-s3'
import {
	afterEach,
	beforeEach,
	describe,
	expect,
	test,
	vi,
} from 'vite-plus/test'

const mocks = vi.hoisted(() => {
	const values = new Map<string | symbol, string>([
		['APP_ENV', 'production'],
		['AWS_REGION', 'local'],
		['AWS_ENDPOINT_URL', 'https://storage.example'],
		['AWS_ACCESS_KEY_ID', 'test'],
		['AWS_SECRET_ACCESS_KEY', 'test'],
		['AWS_S3_BUCKET_NAME', 'avatars'],
	])

	return {
		values,
		// Like varlock's `ENV`: an empty proxy that only answers property reads,
		// so `in`, `Object.keys` and spreading all see nothing.
		env: new Proxy(
			{},
			{
				get: (_target, key) => values.get(key),
			},
		),
		session: vi.fn(),
		sign: vi.fn().mockResolvedValue('https://storage.example/upload'),
	}
})

vi.mock('@/lib/auth/session', () => ({ getCurrentSession: mocks.session }))

vi.mock('@aws-sdk/s3-request-presigner', () => ({ getSignedUrl: mocks.sign }))

vi.mock('@/env.server', () => ({ serverEnv: mocks.env }))

import { createAvatarUploadUrl, createRecipePhotoUpload } from './s3'

describe('avatar upload authorization', () => {
	beforeEach(() => vi.clearAllMocks())

	test('rejects signed-out users before URL signing', async () => {
		mocks.session.mockResolvedValue(null)
		await expect(
			createAvatarUploadUrl('avatars/visitor-photo'),
		).rejects.toThrow('Sign in to upload an avatar')
		expect(mocks.sign).not.toHaveBeenCalled()
	})

	test('rejects another user’s avatar key', async () => {
		mocks.session.mockResolvedValue({
			user: { id: 'owner' },
		})
		await expect(createAvatarUploadUrl('avatars/other-photo')).rejects.toThrow(
			'Invalid avatar key',
		)
		expect(mocks.sign).not.toHaveBeenCalled()
	})

	test('signs an owned avatar key', async () => {
		mocks.session.mockResolvedValue({
			user: { id: 'owner' },
		})
		await expect(createAvatarUploadUrl('avatars/owner-photo')).resolves.toEqual(
			{ url: 'https://storage.example/upload' },
		)
		expect(mocks.sign).toHaveBeenCalledOnce()
	})
})

describe('recipe photo upload', () => {
	beforeEach(() => vi.clearAllMocks())

	test('rejects signed-out users before URL signing', async () => {
		mocks.session.mockResolvedValue(null)
		await expect(createRecipePhotoUpload()).rejects.toThrow(
			'Sign in to upload a recipe photo',
		)
		expect(mocks.sign).not.toHaveBeenCalled()
	})

	test('signs a fresh key under the owner prefix', async () => {
		mocks.session.mockResolvedValue({
			user: { id: 'owner' },
		})

		const first = await createRecipePhotoUpload()
		const second = await createRecipePhotoUpload()

		expect(first.key).toMatch(/^recipes\/owner-[\w-]+$/)
		expect(first.key).not.toBe(second.key)
		expect(first.url).toBe('https://storage.example/upload')
	})
})

describe('development bucket', () => {
	const owner = { user: { id: 'owner' } }

	beforeEach(() => {
		vi.clearAllMocks()
		vi.resetModules()
		mocks.session.mockResolvedValue(owner)
	})

	afterEach(() => {
		mocks.values.set('APP_ENV', 'production')
		vi.restoreAllMocks()
	})

	test('creates the bucket once before signing in development', async () => {
		mocks.values.set('APP_ENV', 'development')

		const send = vi
			.spyOn(S3Client.prototype, 'send')
			.mockResolvedValue(undefined)

		const { createRecipePhotoUpload } = await import('./s3')

		await createRecipePhotoUpload()
		await createRecipePhotoUpload()

		expect(send).toHaveBeenCalledOnce()
		expect(send.mock.calls[0]?.[0].input).toEqual({ Bucket: 'avatars' })
		expect(mocks.sign).toHaveBeenCalledTimes(2)
	})

	test('accepts a bucket that already exists', async () => {
		mocks.values.set('APP_ENV', 'development')
		vi.spyOn(S3Client.prototype, 'send').mockRejectedValue(
			new BucketAlreadyOwnedByYou({ message: 'exists', $metadata: {} }),
		)

		const { createRecipePhotoUpload } = await import('./s3')

		await expect(createRecipePhotoUpload()).resolves.toMatchObject({
			url: 'https://storage.example/upload',
		})
	})

	test('retries after the bucket could not be created', async () => {
		mocks.values.set('APP_ENV', 'development')

		const send = vi
			.spyOn(S3Client.prototype, 'send')
			.mockRejectedValueOnce(new Error('connect ECONNREFUSED'))
			.mockResolvedValue(undefined)

		const { createRecipePhotoUpload } = await import('./s3')

		await expect(createRecipePhotoUpload()).rejects.toThrow('ECONNREFUSED')
		await expect(createRecipePhotoUpload()).resolves.toBeDefined()
		expect(send).toHaveBeenCalledTimes(2)
	})

	test('never creates a bucket outside development', async () => {
		const send = vi.spyOn(S3Client.prototype, 'send')
		const { createRecipePhotoUpload } = await import('./s3')

		await createRecipePhotoUpload()

		expect(send).not.toHaveBeenCalled()
	})
})
