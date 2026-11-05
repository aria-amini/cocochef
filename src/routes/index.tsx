import {
	createFileRoute,
	Link,
	redirect,
	useNavigate,
} from '@tanstack/react-router'
import { useState } from 'react'
import { z } from 'zod'

import { AuthDialog } from '@/components/auth-dialog'
import { CocoWave } from '@/components/coco-wave'
import { buttonVariants } from '@/components/ui/button'
import { getCurrentSession } from '@/lib/auth/session'
import { importSiteLogo, importSites } from '@/lib/import/sites'
import { cn } from '@/lib/utils/ui'

export const Route = createFileRoute('/')({
	// `/?preview` keeps the pitch visible to a signed-in dev; it is dev-only.
	validateSearch: z.object({ preview: z.unknown().optional() }),
	// Anyone with a shelf, guest or account, skips the pitch.
	beforeLoad: async ({ search }) => {
		if (import.meta.env.DEV && search.preview !== undefined) return

		if (await getCurrentSession()) throw redirect({ to: '/recipes' })
	},
	component: Landing,
})

const features = [
	{
		sprite: 'tomato',
		title: 'save from sites you trust',
		body: 'search or paste a link, then save it to your shelf. it always links back to the original.',
	},
	{
		sprite: 'carrot',
		title: 'write down your own',
		body: 'add family recipes by hand, or paste the text and tidy it up.',
	},
	{
		sprite: 'flour',
		title: 'keep your place while you cook',
		body: 'ingredients and steps stay on one page, with a checklist for what is done.',
	},
]

function Landing() {
	const [authOpen, setAuthOpen] = useState(false)
	const navigate = useNavigate()

	return (
		<>
			<div className="bg-background text-foreground min-h-dvh">
				<div className="mx-auto flex max-w-5xl flex-col gap-16 px-6 py-6 md:gap-24 md:px-10 md:py-8">
					<header className="flex items-center justify-between">
						<span className="flex items-center gap-2 text-sm font-bold">
							<img
								src="/icon-192.png"
								alt=""
								className="size-7 shrink-0 rounded-md"
							/>
							cocochef
						</span>
						<button
							type="button"
							onClick={() => setAuthOpen(true)}
							className="-mr-2 inline-flex min-h-11 items-center rounded-md px-2 text-xs font-semibold underline"
						>
							sign in
						</button>
					</header>

					<main className="flex flex-col gap-16 md:gap-24">
						<section className="grid items-center gap-8 md:grid-cols-[minmax(0,1fr)_20rem] md:gap-12">
							<figure className="relative order-first flex w-44 flex-col items-start md:order-last md:w-80">
								<figcaption className="bg-card border-border absolute top-2 left-full ml-2 rounded-xl border px-3 py-1.5 text-sm font-semibold whitespace-nowrap md:top-10 md:right-4/5 md:left-auto md:mr-0">
									hi, i&apos;m coco
								</figcaption>
								<CocoWave className="w-full" />
							</figure>
							<div className="flex flex-col gap-6">
								<h1 className="leading-display max-w-3xl text-5xl font-bold tracking-tight text-balance md:text-7xl">
									every recipe you love, on one shelf
								</h1>
								<p className="text-muted-foreground max-w-xl text-lg font-semibold text-balance">
									find a recipe, save it, and cook from one clean page.
								</p>
								<Link
									to="/recipes"
									className={cn(buttonVariants({ size: 'lg' }), 'self-start')}
								>
									start your shelf
								</Link>
							</div>
						</section>

						<section
							aria-label="Supported recipe sites"
							className="flex flex-col gap-4"
						>
							<p className="text-sm font-semibold">
								works with the sites you already cook from.
							</p>
							<ul className="flex flex-wrap items-center gap-4">
								{importSites.map((site) => (
									<li key={site.id}>
										<img
											src={importSiteLogo(site.id)}
											alt={site.name}
											title={site.name}
											className="size-8"
										/>
									</li>
								))}
								<li className="text-muted-foreground text-sm font-semibold">
									&amp; most recipe sites
								</li>
							</ul>
						</section>

						<section aria-label="What you can do">
							<ul className="divide-border border-border divide-y border-y">
								{features.map((feature) => (
									<li
										key={feature.title}
										className="grid grid-cols-[2.5rem_minmax(0,1fr)] items-center gap-x-4 gap-y-1 py-5 md:grid-cols-[2.5rem_minmax(0,1fr)_minmax(0,1.25fr)] md:gap-x-6"
									>
										<img
											src={`/sprites/pantry/${feature.sprite}.png`}
											alt=""
											className="row-span-2 size-10 [image-rendering:pixelated] md:row-span-1"
										/>
										<h2 className="text-lg leading-tight font-bold">
											{feature.title}
										</h2>
										<p className="text-muted-foreground text-sm font-semibold text-pretty">
											{feature.body}
										</p>
									</li>
								))}
							</ul>
						</section>

						<section className="flex flex-col items-start gap-4 pb-8">
							<h2 className="text-3xl font-bold tracking-tight md:text-4xl">
								save your first recipe
							</h2>
							<Link
								to="/recipes"
								className={buttonVariants({ variant: 'outline', size: 'lg' })}
							>
								start your shelf
							</Link>
						</section>
					</main>
				</div>
			</div>
			<AuthDialog
				open={authOpen}
				onOpenChange={setAuthOpen}
				redirect="/recipes"
				initialMode="signin"
				onSuccess={() => void navigate({ to: '/recipes' })}
			/>
		</>
	)
}
