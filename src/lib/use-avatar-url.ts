import { useQuery } from '@tanstack/react-query'

import { getAvatarUrl } from '@/lib/s3'

// Uploaded photos live in storage under a key; this resolves it to a fetchable
// URL. Falls back to nothing (the initial) while loading or on failure. Kept
// by key, so the sidebar and the phone header ask once between them, and for
// most of the hour its signed address stays the same.
export function useAvatarUrl(image: string | null | undefined) {
	return useQuery({
		queryKey: ['avatar-url', image],
		queryFn: () => getAvatarUrl({ data: { image } }),
		enabled: !!image,
		staleTime: 50 * 60_000,
		retry: false,
	}).data
}
