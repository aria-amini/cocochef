import { useEffect, useState } from 'react'

// Typing settles before the editor asks again.
const settleMs = 400

// `value` once `key` has stopped changing for a moment; until then, the value
// it last settled on.
export function useSettled<T>(value: T, key: string) {
	const [settled, setSettled] = useState({ value, key })

	useEffect(() => {
		if (key === settled.key) return
		const timer = window.setTimeout(() => setSettled({ value, key }), settleMs)

		return () => window.clearTimeout(timer)
	}, [value, key, settled.key])

	return settled.value
}
