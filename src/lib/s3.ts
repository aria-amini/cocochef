import {
	BucketAlreadyOwnedByYou,
	CreateBucketCommand,
	GetObjectCommand,
	NoSuchKey,
	PutObjectCommand,
	S3Client,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { createServerFn, createServerOnlyFn } from '@tanstack/react-start'
import { z } from 'zod'

import { serverEnv as env } from '@/env.server'
import { readSession } from '@/lib/auth/session'
import { recipePhotoKey, recipePhotoPath } from '@/lib/recipes/model'

// Storage settings are optional in development and required in production.
const storageConfig = z.object({
	AWS_REGION: z.string().min(1),
	AWS_ENDPOINT_URL: z.url(),
	AWS_ACCESS_KEY_ID: z.string().min(1),
	AWS_SECRET_ACCESS_KEY: z.string().min(1),
	AWS_S3_BUCKET_NAME: z.string().min(1),
})

function getStorage() {
	// varlock's `ENV` answers property reads only, so Zod would see every key as
	// missing if handed the object itself.
	const config = storageConfig.parse({
		AWS_REGION: env.AWS_REGION,
		AWS_ENDPOINT_URL: env.AWS_ENDPOINT_URL,
		AWS_ACCESS_KEY_ID: env.AWS_ACCESS_KEY_ID,
		AWS_SECRET_ACCESS_KEY: env.AWS_SECRET_ACCESS_KEY,
		AWS_S3_BUCKET_NAME: env.AWS_S3_BUCKET_NAME,
	})

	return {
		bucket: config.AWS_S3_BUCKET_NAME,
		client: new S3Client({
			region: config.AWS_REGION,
			endpoint: config.AWS_ENDPOINT_URL,
			credentials: {
				accessKeyId: config.AWS_ACCESS_KEY_ID,
				secretAccessKey: config.AWS_SECRET_ACCESS_KEY,
			},
			forcePathStyle: true,
		}),
	}
}

export const resolveStoredImage = createServerOnlyFn(
	async (image: string): Promise<string> => {
		const isPublicUrl = /^https?:\/\//.test(image)

		if (isPublicUrl) return image

		// A recipe photo has an address of its own (src/routes/api/photos.$.ts)
		// that browsers and Cloudflare can keep, where a signed URL would be a
		// new address, and a new download, on every page.
		if (recipePhotoPath.safeParse(image).success) return `/api/photos/${image}`

		const { bucket, client } = getStorage()

		const command = new GetObjectCommand({ Bucket: bucket, Key: image })

		return getSignedUrl(client, command, { expiresIn: 60 * 60 })
	},
)

// An uploaded photo's bytes, or null when there is no such photo.
export const readStoredPhoto = createServerOnlyFn(async (key: string) => {
	const { bucket, client } = getStorage()

	try {
		const object = await client.send(
			new GetObjectCommand({ Bucket: bucket, Key: key }),
		)

		return object.Body
			? {
					body: object.Body.transformToWebStream(),
					type: object.ContentType,
					length: object.ContentLength,
					etag: object.ETag,
				}
			: null
	} catch (error) {
		if (error instanceof NoSuchKey) return null
		throw error
	}
})

export const getAvatarUrl = createServerFn({ method: 'GET' })
	.validator(z.object({ image: z.string().nullish() }))
	.handler(async ({ data }): Promise<string | undefined> =>
		data.image ? resolveStoredImage(data.image) : undefined,
	)

// Development MinIO starts empty, so the bucket is created on the first upload.
// Production buckets are provisioned ahead of time and never created here.
let devBucketReady: Promise<void> | undefined

async function createDevBucket(client: S3Client, bucket: string) {
	try {
		await client.send(new CreateBucketCommand({ Bucket: bucket }))
	} catch (error) {
		if (error instanceof BucketAlreadyOwnedByYou) return

		devBucketReady = undefined
		throw error
	}
}

function ensureDevBucket(client: S3Client, bucket: string) {
	devBucketReady ??= createDevBucket(client, bucket)

	return devBucketReady
}

async function signImageUpload(key: string) {
	const { bucket, client } = getStorage()

	if (env.APP_ENV === 'development') await ensureDevBucket(client, bucket)

	const command = new PutObjectCommand({
		Bucket: bucket,
		Key: key,
		ContentType: 'image/*',
	})

	return {
		url: await getSignedUrl(client, command, {
			expiresIn: 900,
		}),
	}
}

export const getAvatarUploadUrl = createServerFn({ method: 'POST' })
	.validator(z.object({ key: z.string().min(1).max(200) }))
	.handler(({ data }) => createAvatarUploadUrl(data.key))

export const createAvatarUploadUrl = createServerOnlyFn(async (key: string) => {
	const session = await readSession()

	if (!session) {
		throw new Error('Sign in to upload an avatar')
	}

	if (!key.startsWith(`avatars/${session.user.id}-`)) {
		throw new Error('Invalid avatar key')
	}

	return signImageUpload(key)
})

// The server picks the key so a client can only upload under its own prefix.
export const getRecipePhotoUploadUrl = createServerFn({
	method: 'POST',
}).handler(() => createRecipePhotoUpload())

export const createRecipePhotoUpload = createServerOnlyFn(async () => {
	const session = await readSession()

	if (!session) {
		throw new Error('Sign in to upload a recipe photo')
	}

	const key = recipePhotoKey(session.user.id)

	return { key, ...(await signImageUpload(key)) }
})
