// TODO(2027-02-04): remove this file, its test, and the call in src/server.ts.
// The app was called dutch-oven, and its production service still answers on
// the Railway domain that name generated. This sends that host to the current
// domain so old links keep working. Three months after the rename (2026-11-04)
// they will have had time to update.
const legacyHost = 'dutch-oven-production.up.railway.app'

const currentOrigin = 'https://cocochef.ariaamini.com'

// A 307 never gets cached as permanent and keeps the method, so a POST from a
// stale tab still reaches the new host.
export function legacyHostRedirect(request: Request): Response | undefined {
	const url = new URL(request.url)
	const host = request.headers.get('host') ?? url.host

	if (host.toLowerCase() !== legacyHost) return undefined

	// Railway's health check must always get an answer from this service.
	if (url.pathname === '/api/health') return undefined

	// Google still sends sign-in callbacks, including those from previews that
	// use production as their OAuth proxy, to BETTER_AUTH_URL, which is this
	// host. A redirected callback would exchange its code with a different
	// redirect_uri and fail. Remove this with BETTER_AUTH_URL's move.
	if (url.pathname === '/api/auth/callback/google') return undefined

	return Response.redirect(`${currentOrigin}${url.pathname}${url.search}`, 307)
}
