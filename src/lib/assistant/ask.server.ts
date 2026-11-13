import { getAccountId } from '@/lib/auth/session'
import { rateLimit } from '@/lib/import/rate-limit'

import { askModel } from './model'

// The model costs money per call, so only a signed-in cook reaches it, a
// limited number of times a minute; visitors and anyone past the limit get
// the mock answers.
export async function mayAskModel() {
	const accountId = await getAccountId()

	if (!accountId) return false

	try {
		rateLimit(`assistant:${accountId}`, 30)

		return true
	} catch {
		return false
	}
}

export const ask: typeof askModel = async (...args) =>
	(await mayAskModel()) ? askModel(...args) : undefined
