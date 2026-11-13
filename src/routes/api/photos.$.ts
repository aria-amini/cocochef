import { createFileRoute } from '@tanstack/react-router'

import { missingPhoto, photoResponse } from '@/lib/photos/response'
import { recipePhotoPath } from '@/lib/recipes/model'
import { readStoredPhoto } from '@/lib/s3'

// Uploaded recipe photos at a lasting address, /api/photos/recipes/<id>.
// Anyone with the address can see the photo, as with a shared recipe; the id
// is an unguessable UUID.
export const Route = createFileRoute('/api/photos/$')({
	server: {
		handlers: {
			GET: async ({ params }) => {
				const key = params._splat ?? ''

				if (!recipePhotoPath.safeParse(key).success) return missingPhoto()

				const photo = await readStoredPhoto(key)

				return photo ? photoResponse(photo) : missingPhoto()
			},
		},
	},
})
