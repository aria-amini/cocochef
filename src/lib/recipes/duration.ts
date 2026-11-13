// A cook time as short as it can be said: minutes under an hour, then hours
// (with minutes while they still matter), then days.
export function shortDuration(minutes: number) {
	const total = Math.max(1, Math.round(minutes))

	if (total < 60) return `${total}m`

	if (total < 24 * 60) {
		const hours = Math.floor(total / 60)
		const rest = total % 60

		// Past a few hours the odd minutes stop mattering.
		if (hours >= 4 || rest === 0) return `${Math.round(total / 60)}h`

		return `${hours}h ${rest}m`
	}

	const days = Math.floor(total / (24 * 60))
	const hours = Math.round((total % (24 * 60)) / 60)

	return hours ? `${days}d ${hours}h` : `${days}d`
}
