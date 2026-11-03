import { createOpenRouter } from '@openrouter/ai-sdk-provider'

import { serverEnv as env } from '@/env.server'

// The model every AI action runs on, or nothing where no key is set. Recipes
// carry the cook's own notes, so requests only go to providers that don't keep
// them, and only to ones that honor the output schema. Tidying is reformatting,
// not problem solving: thinking tokens only eat the output budget on longer
// recipes, which then come back empty.
export function getAiModel() {
	if (!env.OPENROUTER_API_KEY) return undefined

	return createOpenRouter({ apiKey: env.OPENROUTER_API_KEY }).chat(
		env.AI_MODEL,
		{
			provider: { require_parameters: true, data_collection: 'deny' },
			reasoning: { effort: 'none' },
		},
	)
}
