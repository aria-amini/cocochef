import { CookingPotIcon } from '@phosphor-icons/react'
import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { useEffect, useState } from 'react'

import { listActiveCooking } from '@/lib/cooking/server'

function Elapsed({ startedAt }: { startedAt: Date }) {
	const [now, setNow] = useState(() => Date.now())
	useEffect(() => {
		const timer = setInterval(() => setNow(Date.now()), 1000)

		return () => clearInterval(timer)
	}, [])

	const seconds = Math.max(
		0,
		Math.floor((now - new Date(startedAt).getTime()) / 1000),
	)

	return (
		<span
			aria-label="elapsed cooking time"
			className="text-xl font-bold tabular-nums"
		>
			{Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, '0')}
		</span>
	)
}

export function useActiveCooking() {
	return useQuery({
		queryKey: ['active-cooking'],
		queryFn: () => listActiveCooking(),
		refetchInterval: 30000,
	})
}

export function CookingTracker() {
	const sessions = useActiveCooking()

	if (!sessions.data?.length) return null

	return (
		<aside
			aria-label="Cooking tracker"
			className="border-foreground/25 bg-kitchen-yolk/40 fixed inset-x-3 bottom-3 z-30 max-h-44 overflow-y-auto rounded-xl border p-3 md:static md:max-h-72"
		>
			<h2 className="mb-1 flex items-center gap-2 text-sm font-bold">
				<CookingPotIcon size={22} weight="duotone" aria-hidden />
				cooking
			</h2>
			{sessions.data.map((session) => (
				<Link
					key={session.recipeId}
					to="/recipes/$recipeId"
					params={{ recipeId: session.recipeId }}
					className="focus-visible:outline-kitchen-eggplant block rounded-md py-2 text-sm hover:underline focus-visible:outline-2"
				>
					<span className="block font-bold">{session.title}</span>
					<span className="mt-2 flex flex-wrap items-baseline justify-between gap-x-2 gap-y-1 text-xs">
						<Elapsed startedAt={session.startedAt} />
						<span>
							{session.checked.filter((item) => item.startsWith('s')).length}/
							{session.steps} steps
						</span>
					</span>
				</Link>
			))}
		</aside>
	)
}
