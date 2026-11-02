import { createFileRoute, Link, redirect } from '@tanstack/react-router'
import { MotionConfig, motion } from 'framer-motion'
import { z } from 'zod'

import { AuthDialog } from '@/components/auth-dialog'
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

const ease = [0.16, 1, 0.3, 1] as const

const heroSprites = ['apple', 'carrot', 'tomato', 'flour', 'milk', 'cinnamon']

const features = [
	{
		sprite: 'tomato',
		color: 'bg-kitchen-tomato/25',
		title: 'save from sites you trust',
		body: 'search or paste a link, then save it to your shelf. it always links back to the original.',
	},
	{
		sprite: 'carrot',
		color: 'bg-kitchen-basil/25',
		title: 'know your kitchen',
		body: 'stock what you have by category in a few taps.',
	},
	{
		sprite: 'flour',
		color: 'bg-kitchen-yolk/35',
		title: 'cook what you actually cook',
		body: 'start a meal from your regulars, what you have not made in a while, or something new.',
	},
]

function Landing() {
	return (
		<MotionConfig reducedMotion="user">
			<div className="bg-background text-foreground min-h-dvh">
				<div className="mx-auto flex max-w-5xl flex-col gap-16 px-6 py-6 md:gap-24 md:px-10 md:py-8">
					<header className="flex items-center justify-between">
						<span className="text-sm font-bold">dutch-oven</span>
						<Link
							to="/auth/login"
							className="focus-visible:outline-kitchen-eggplant text-xs font-semibold underline focus-visible:outline-2 focus-visible:outline-offset-2"
						>
							sign in
						</Link>
					</header>

					<motion.main
						initial={{ opacity: 0, y: 24 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ duration: 0.6, ease }}
						className="flex flex-col gap-16 md:gap-24"
					>
						<section className="flex flex-col gap-6">
							<div aria-hidden className="flex gap-3">
								{heroSprites.map((sprite) => (
									<img
										key={sprite}
										src={`/sprites/pantry/${sprite}.png`}
										alt=""
										className="size-10 [image-rendering:pixelated] md:size-12"
									/>
								))}
							</div>
							<h1 className="max-w-3xl text-5xl leading-none font-bold tracking-tight text-balance md:text-7xl">
								recipes from real cooks, never made up by AI
							</h1>
							<p className="text-muted-foreground max-w-xl text-lg font-semibold text-balance">
								keep what you cook and what is in your kitchen.
							</p>
							<div className="flex flex-wrap items-center gap-4">
								<Link to="/recipes" className={buttonVariants({ size: 'lg' })}>
									start your shelf
								</Link>
								<span className="text-muted-foreground text-xs font-semibold">
									no account needed
								</span>
							</div>
						</section>

						<section
							aria-label="Supported recipe sites"
							className="border-border bg-card flex flex-col gap-3 rounded-xl border p-5"
						>
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
							<p className="text-sm font-semibold">
								recipes come from real sites and real cooks. nothing here is
								generated.
							</p>
						</section>

						<section
							aria-label="What you can do"
							className="grid gap-4 md:grid-cols-3"
						>
							{features.map((feature) => (
								<article
									key={feature.title}
									className="border-border bg-card flex flex-col gap-3 rounded-xl border p-5"
								>
									<span
										className={cn(
											'border-border grid size-12 place-items-center border rounded-md',
											feature.color,
										)}
									>
										<img
											src={`/sprites/pantry/${feature.sprite}.png`}
											alt=""
											className="size-8 [image-rendering:pixelated]"
										/>
									</span>
									<h2 className="text-lg leading-tight font-bold">
										{feature.title}
									</h2>
									<p className="text-muted-foreground text-sm font-semibold">
										{feature.body}
									</p>
								</article>
							))}
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
					</motion.main>
				</div>
			</div>
		</MotionConfig>
	)
}
