import { describe, expect, test } from 'vite-plus/test'

import { proxyCredentials, proxyUrls } from './proxy-config'

describe('OAuth proxy URLs', () => {
	const common = {
		appOrigin: 'https://production.example',
		brokerUrl: 'https://broker.example',
		workspaceUrl: 'https://workspace.example',
	}

	test('returns to the workspace after local sign-in', () => {
		expect(proxyUrls({ ...common, appEnv: 'development' })).toEqual({
			productionURL: common.brokerUrl,
			currentURL: common.workspaceUrl,
		})
	})
	test('uses the broker for previews and lets the request identify the preview', () => {
		expect(proxyUrls({ ...common, appEnv: 'preview' })).toEqual({
			productionURL: common.brokerUrl,
			currentURL: undefined,
		})
	})
	test('never uses the development broker in production and preserves the fallback', () => {
		expect(proxyUrls({ ...common, appEnv: 'production' }).productionURL).toBe(
			common.appOrigin,
		)
		expect(
			proxyUrls({ appEnv: 'development', appOrigin: common.appOrigin })
				.productionURL,
		).toBe(common.appOrigin)
	})
})

describe('OAuth proxy credentials', () => {
	const standard = {
		clientId: 'production-id',
		clientSecret: 'production-client-secret',
		proxySecret: 'production-proxy-secret',
	}

	const broker = {
		clientId: 'broker-id',
		clientSecret: 'broker-client-secret',
		proxySecret: 'broker-proxy-secret',
	}

	test('uses broker credentials for opted-in development and preview only', () => {
		for (const appEnv of ['development', 'preview'] as const)
			expect(
				proxyCredentials({
					appEnv,
					brokerUrl: 'https://broker.example',
					standard,
					broker,
				}),
			).toEqual(broker)
		expect(
			proxyCredentials({
				appEnv: 'production',
				brokerUrl: 'https://broker.example',
				standard,
				broker,
			}),
		).toEqual(standard)
	})
	test('fails closed if the shared broker is only partly configured', () => {
		expect(() =>
			proxyCredentials({
				appEnv: 'preview',
				brokerUrl: 'https://broker.example',
				standard,
				broker: { clientId: 'broker-id' },
			}),
		).toThrow('shared OAuth broker credentials are not configured')
	})
})
