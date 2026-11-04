import { describe, expect, test } from 'vite-plus/test'

import { hostOf, isYouTube, parseSourceInput } from './source'

describe('parseSourceInput', () => {
	test('clears the link when the field is empty', () => {
		expect(parseSourceInput('')).toBeNull()
		expect(parseSourceInput('   ')).toBeNull()
	})

	test('keeps a full address and assumes https for a bare one', () => {
		expect(parseSourceInput('https://example.com/dal')).toBe(
			'https://example.com/dal',
		)
		expect(parseSourceInput(' youtube.com/watch?v=abc ')).toBe(
			'https://youtube.com/watch?v=abc',
		)
	})

	test('leaves anything that is not a web address for the cook to fix', () => {
		expect(parseSourceInput('grandma')).toBeUndefined()
		expect(parseSourceInput('ftp://example.com/dal')).toBeUndefined()
		expect(parseSourceInput('https://')).toBeUndefined()
		expect(parseSourceInput('two words.com')).toBeUndefined()
	})
})

describe('isYouTube', () => {
	test('knows the video hosts', () => {
		expect(isYouTube('https://www.youtube.com/watch?v=abc')).toBe(true)
		expect(isYouTube('https://m.youtube.com/watch?v=abc')).toBe(true)
		expect(isYouTube('https://youtu.be/abc')).toBe(true)
		expect(isYouTube('https://notyoutube.com/abc')).toBe(false)
		expect(isYouTube('https://example.com/youtube.com')).toBe(false)
	})

	test('names the site without www', () => {
		expect(hostOf('https://www.example.com/dal')).toBe('example.com')
	})
})
