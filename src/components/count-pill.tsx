// How many a section holds, in a small quiet pill beside its name.
export function CountPill({ count }: { count: number }) {
	return (
		<span className="bg-muted rounded-full px-2 text-xs leading-5 font-bold tabular-nums">
			{count}
		</span>
	)
}
