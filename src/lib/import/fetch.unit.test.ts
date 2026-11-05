import { describe, expect, test } from 'vite-plus/test'

import { isPrivateIp } from './fetch'
import { isWalled } from './wall'

describe('isPrivateIp', () => {
	test.each([
		// private / non-public IPv4
		['127.0.0.1', true],
		['10.0.0.1', true],
		['192.168.1.1', true],
		['172.16.0.1', true],
		['169.254.0.1', true],
		['100.64.0.1', true],
		['0.1.2.3', true],
		['224.0.0.1', true],
		// hex-encoded loopback (not parseable as IPv4 → refused)
		['0x7f.0.0.1', true],
		['0x7f000001', true],
		// loopback, unspecified, ULA, link-local IPv6
		['::1', true],
		['::', true],
		['fc00::1', true],
		['fd12::1', true],
		['fe80::1', true],
		// multicast (ff00::/8) and documentation (2001:db8::/32)
		['ff0e::1', true],
		['ff02::1', true],
		['2001:db8::1', true],
		// deprecated IPv4-compatible IPv6
		['::127.0.0.1', true],
		['::8.8.8.8', false],
		// IPv4-mapped IPv6
		['::ffff:127.0.0.1', true],
		['::ffff:7f00:1', true],
		['::ffff:8.8.8.8', false],
		// 6to4
		['2002:7f00:1::', true],
		['2002:808:808::', false],
		// NAT64
		['64:ff9b::7f00:1', true],
		['64:ff9b::808:808', false],
		// public addresses
		['8.8.8.8', false],
		['1.1.1.1', false],
		['2606:4700:4700::1111', false],
		['2001:4860:4860::8888', false],
	])('%s → %s', (ip, expected) => {
		expect(isPrivateIp(ip)).toBe(expected)
	})
})

describe('isWalled', () => {
	test('treats 401 and 403 as walled regardless of body', () => {
		expect(isWalled(401, '')).toBe(true)
		expect(isWalled(403, '<html>fine page</html>')).toBe(true)
	})

	test('detects challenge markers case-insensitively', () => {
		expect(
			isWalled(200, '<html><head><title>JUST A MOMENT</title></head></html>'),
		).toBe(true)
		expect(
			isWalled(200, '<p>Please Enable JavaScript And Cookies to continue</p>'),
		).toBe(true)
		expect(isWalled(200, '<div class="CF-CHL-container"></div>')).toBe(true)
	})

	test('passes a normal page', () => {
		expect(
			isWalled(
				200,
				'<html><body><h1>Grandma’s tomato soup</h1><p>A cozy recipe.</p></body></html>',
			),
		).toBe(false)
	})
})
