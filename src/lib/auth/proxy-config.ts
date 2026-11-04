type ProxyEnvironment = {
	appEnv: 'development' | 'preview' | 'production' | 'test' | undefined
	appOrigin: string
	brokerUrl?: string | undefined
	workspaceUrl?: string | undefined
}

export function proxyUrls({
	appEnv,
	appOrigin,
	brokerUrl,
	workspaceUrl,
}: ProxyEnvironment) {
	const useBroker =
		(appEnv === 'development' || appEnv === 'preview') && brokerUrl

	return {
		productionURL: useBroker || appOrigin,
		currentURL:
			appEnv === 'development' && useBroker ? workspaceUrl : undefined,
	}
}

type Credentials = {
	clientId?: string | undefined
	clientSecret?: string | undefined
	proxySecret?: string | undefined
}

export function proxyCredentials({
	appEnv,
	brokerUrl,
	standard,
	broker,
}: Pick<ProxyEnvironment, 'appEnv' | 'brokerUrl'> & {
	standard: Credentials
	broker: Credentials
}) {
	const useBroker =
		(appEnv === 'development' || appEnv === 'preview') && Boolean(brokerUrl)

	if (
		useBroker &&
		(!broker.clientId || !broker.clientSecret || !broker.proxySecret)
	)
		throw new Error('shared OAuth broker credentials are not configured')

	return useBroker ? broker : standard
}
