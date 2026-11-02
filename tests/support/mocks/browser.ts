import { vi } from 'vite-plus/test'

export type MockSession = {
	user: {
		id: string
		name: string
		email: string
		isAnonymous?: boolean
		image?: string | null
	}
	session: { id: string; token: string }
}

const authState = vi.hoisted<{
	session: MockSession | null
	sessionError: Error | null
	sessionPending: boolean
}>(() => ({
	session: null,
	sessionError: null,
	sessionPending: false,
}))

const authMocks = vi.hoisted(() => ({
	signInEmail: vi.fn(async () => ({ error: null })),
	signUpEmail: vi.fn(async () => ({ error: null })),
	// Resolves with an error so the Google flow never navigates the test page.
	signInSocial: vi.fn(async () => ({
		data: null,
		error: { message: 'stubbed' },
	})),
	refetchSession: vi.fn(),
}))

export function getAuthMocks() {
	return authMocks
}

export function setMockSession(session: MockSession | null) {
	authState.session = session
	authState.sessionError = null
	authState.sessionPending = false
}

export function setMockSessionPending() {
	authState.sessionPending = true
}

export function setMockSessionError(error: Error) {
	authState.sessionError = error
}

// Tests never reach storage: an avatar key resolves to itself.
vi.mock('@/lib/use-avatar-url', () => ({
	useAvatarUrl: (image: string | null | undefined) => image ?? undefined,
}))

vi.mock('@/lib/auth/client', () => ({
	authClient: {
		useSession: () => ({
			data: authState.session,
			isPending: authState.sessionPending,
			error: authState.sessionError,
			refetch: authMocks.refetchSession,
		}),
		signIn: {
			email: authMocks.signInEmail,
			social: authMocks.signInSocial,
		},
		signUp: {
			email: authMocks.signUpEmail,
		},
		requestPasswordReset: vi.fn(),
		resetPassword: vi.fn(),
		signOut: vi.fn(async () => ({ error: null })),
		updateUser: vi.fn(async () => ({ error: null })),
	},
}))

vi.mock('@/lib/auth/functions', () => ({
	getCurrentSession: () => authState.session,
	redirectAuthenticatedUsers: () => undefined,
	redirectUnauthenticatedUsers: () => ({ session: authState.session }),
}))

vi.mock('@/lib/auth/session', () => ({
	getCurrentSession: () => Promise.resolve(authState.session),
	requireUserId: () => Promise.resolve(authState.session?.user.id ?? 'guest'),
}))

vi.mock('@/routes/__root', async () => {
	const React = await import('react')

	const { Outlet, createRootRouteWithContext } =
		await import('@tanstack/react-router')

	return {
		Route: createRootRouteWithContext()({
			component: () => React.createElement(Outlet),
		}),
	}
})
