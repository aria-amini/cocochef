import { recipeSites } from '@/lib/discover/sites'
import { importSiteLogo } from '@/lib/import/sites'

export function RecipeSources() {
	return (
		<div className="text-muted-foreground flex flex-wrap items-center gap-2 text-xs">
			<span>across recipe sites</span>
			<ul
				aria-label="Recipe search sources"
				className="flex flex-wrap items-center gap-2"
			>
				{recipeSites.map((site) => (
					<li key={site.id} title={site.name}>
						<img
							src={importSiteLogo(site.id)}
							alt={site.name}
							className="size-4 rounded-sm object-contain"
						/>
					</li>
				))}
			</ul>
		</div>
	)
}
