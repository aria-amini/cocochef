import { drizzleAdapter } from '@better-auth/drizzle-adapter'
import { betterAuth } from 'better-auth'
import { anonymous, oAuthProxy } from 'better-auth/plugins'
import { tanstackStartCookies } from 'better-auth/tanstack-start'

import { getDb } from '@/db/connection'
import { account, session, user, verification } from '@/db/schema'
import { serverEnv as env } from '@/env.server'

import { moveGuestDataToNewUser } from './link-account'
import { proxyCredentials, proxyUrls } from './proxy-config'

const appUrl = new URL(env.BETTER_AUTH_URL)

const appOrigin = appUrl.origin

const appHostname = appUrl.hostname

export const allowedHosts = [
	'127.0.0.1:*',
	'localhost:*',
	'*.localhost',
	'*.localhost:*',
	'*.lvh.ariaamini.com',
	'*.dev.ariaamini.com',
	'dutch-oven-*.up.railway.app',
	'app-dutch-oven-*.up.railway.app',
]

function createAuth() {
	const {
		clientId: googleClientId,
		clientSecret: googleClientSecret,
		proxySecret,
	} = proxyCredentials({
		appEnv: env.APP_ENV,
		brokerUrl: env.OAUTH_BROKER_URL,
		standard: {
			clientId: env.GOOGLE_CLIENT_ID,
			clientSecret: env.GOOGLE_CLIENT_SECRET,
			proxySecret: env.OAUTH_PROXY_SECRET,
		},
		broker: {
			clientId: env.OAUTH_BROKER_GOOGLE_CLIENT_ID,
			clientSecret: env.OAUTH_BROKER_GOOGLE_CLIENT_SECRET,
			proxySecret: env.OAUTH_BROKER_SECRET,
		},
	})

	// Every environment using a proxy must share that proxy’s secret.
	if (
		googleClientId &&
		googleClientSecret &&
		!proxySecret &&
		(env.APP_ENV !== 'development' || env.OAUTH_BROKER_URL)
	) {
		throw new Error(
			'OAUTH_PROXY_SECRET is not set. Google sign-in needs the same value as its OAuth proxy.',
		)
	}

	return betterAuth({
		appName: 'dutch-oven',
		baseURL: {
			allowedHosts,
			protocol: 'auto',
			fallback: appOrigin,
		},
		secret: env.BETTER_AUTH_SECRET,
		database: drizzleAdapter(getDb(), {
			provider: 'pg',
			schema: { account, session, user, verification },
		}),
		emailAndPassword: { enabled: true, autoSignIn: true },
		socialProviders:
			googleClientId && googleClientSecret
				? {
						google: {
							clientId: googleClientId,
							clientSecret: googleClientSecret,
						},
					}
				: {},
		plugins: [
			// Keep production on its own proxy; trusted development and preview
			// environments can opt into the shared broker independently.
			oAuthProxy({
				...proxyUrls({
					appEnv: env.APP_ENV,
					appOrigin,
					brokerUrl: env.OAUTH_BROKER_URL,
					workspaceUrl: env.BASE_URL,
				}),
				secret: proxySecret,
			}),
			anonymous({
				emailDomainName: appHostname,
				generateName: () => 'guest cook',
				onLinkAccount: moveGuestDataToNewUser,
			}),
			tanstackStartCookies(),
		],
	})
}

let auth: ReturnType<typeof createAuth> | undefined

export function getAuth() {
	auth ??= createAuth()

	return auth
}
