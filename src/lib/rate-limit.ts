type Bucket = { windowStart: number; count: number }

// All limiter state is process-local: it does not enforce a global limit across
// horizontally scaled instances. This assumes a single-instance deployment
// (railway.toml runs numReplicas = 1).
const MAX_BUCKETS = 5_000

// A fixed-window limit per key. Each limiter owns its buckets, so features
// never spend each other's allowance.
export function createRateLimiter({
	limit,
	windowMs = 60_000,
	message,
}: {
	limit: number
	windowMs?: number
	message: string
}) {
	const buckets = new Map<string, Bucket>()

	return function check(key: string) {
		const now = Date.now()

		for (const [name, bucket] of buckets)
			if (now - bucket.windowStart >= windowMs) buckets.delete(name)
		const bucket = buckets.get(key)

		if (!bucket) {
			if (buckets.size >= MAX_BUCKETS) {
				let oldest: string | undefined
				let oldestStart = Number.POSITIVE_INFINITY

				for (const [name, entry] of buckets)
					if (entry.windowStart < oldestStart) {
						oldest = name
						oldestStart = entry.windowStart
					}

				if (oldest !== undefined) buckets.delete(oldest)
			}

			buckets.set(key, { windowStart: now, count: 1 })

			return
		}

		bucket.count += 1

		if (bucket.count > limit) throw new Error(message)
	}
}

// Caps concurrent work overall and per key, for tasks that are slow or cost
// money while they run.
export function createSlots({
	max,
	maxPerKey,
	message,
}: {
	max: number
	maxPerKey: number
	message: string
}) {
	let inFlight = 0
	const inFlightByKey = new Map<string, number>()

	return async function withSlot<T>(
		key: string,
		task: () => Promise<T>,
	): Promise<T> {
		const keyInFlight = inFlightByKey.get(key) ?? 0

		if (inFlight >= max || keyInFlight >= maxPerKey) throw new Error(message)
		inFlight += 1
		inFlightByKey.set(key, keyInFlight + 1)

		try {
			return await task()
		} finally {
			inFlight -= 1
			const remaining = (inFlightByKey.get(key) ?? 1) - 1

			if (remaining <= 0) inFlightByKey.delete(key)
			else inFlightByKey.set(key, remaining)
		}
	}
}
