import { chat } from '@tanstack/ai'
import { createOpenRouterText } from '@tanstack/ai-openrouter'
import type { z } from 'zod'

import { serverEnv as env } from '@/env.server'

import { suggestionModel } from './models'

// Answers are checked against the editor's contracts whatever the model.

// Suggestions show up while the cook types: a late answer is no answer.
const answerTimeoutMs = 15_000

// Asks the model for one structured answer to `request`, sent as JSON. Undefined when no key is set or
// the call fails, so the caller can fall back to the mock source.
export async function askModel<TSchema extends z.ZodType>(
	task: string,
	instructions: string,
	request: string,
	schema: TSchema,
): Promise<z.infer<TSchema> | undefined> {
	const apiKey = env.OPENROUTER_API_KEY

	if (!apiKey) return undefined

	const abortController = new AbortController()
	const timer = setTimeout(() => abortController.abort(), answerTimeoutMs)

	try {
		const answer: unknown = await chat({
			adapter: createOpenRouterText(suggestionModel.id, apiKey),
			threadId: `assistant-${task}`,
			systemPrompts: [instructions, recipeConventions],
			messages: [{ role: 'user', content: request }],
			outputSchema: schema,
			stream: false,
			// Only route to providers that honour the JSON schema.
			modelOptions: {
				provider: { requireParameters: true },
				maxCompletionTokens: 2000,
			},
			abortController,
		})

		return schema.parse(answer)
	} catch (error) {
		console.error(`assistant: ${task} failed`, error)

		return undefined
	} finally {
		clearTimeout(timer)
	}
}

// ===== Instructions =====

const recipeConventions = `How cocochef writes recipes:
- Each ingredient line names one food, amount first: "2 tbsp soy sauce", "3 cloves garlic, grated", "1 onion, diced".
- Amounts are for 4 servings unless the recipe says otherwise, in US units.
- A line starting with "## " names a section of the ingredients ("## marinade"); the lines under it belong to it.
- Section names are short and lowercase: "marinade", "spice blend", "for the sauce".
- The input is JSON. Answer only with the JSON the schema asks for.`

export const sectionsInstructions = `You suggest ingredient sections a home cook's recipe is likely still missing.
Input: the recipe's title and the ingredient lines written so far.
Suggest at most 3 sections that recipes of this dish commonly have (a marinade, a sauce, a spice blend, a topping), each with the lines it usually holds.
Leave out sections the cook already wrote and foods already listed.
If the title does not name a recognizable dish, answer with no sections.`

export const sectionLinesInstructions = `You suggest the ingredient lines for one section of a home cook's recipe.
Input: the recipe's title, the section the cook just named, and the ingredient lines written so far.
Answer with the lines that section usually holds in recipes of this dish, at most 12, leaving out foods already listed.
If the section name means nothing for this dish, answer with no lines.`

export const sectionNameInstructions = `You name a section of a home cook's ingredient list.
Input: the recipe's title and the lines of a section that has no name yet.
Answer with the short name a cook would give these lines together ("marinade", "spice blend", "for the dressing").
If the lines have nothing in common, answer with null.`

export const amountsInstructions = `You suggest amounts for ingredient lines a home cook wrote without one.
Input: the recipe's title and the lines, numbered from 0 in order.
For each line that names a food, answer with its line number and the amount a recipe of this dish usually calls for, written the way it goes in front of the food ("2 tbsp", "3 cloves", "1").
Answer null for a line where no amount fits, such as a garnish or anything to taste.`

export const regroupInstructions = `You group a recipe's ingredients by the step they go into, so a cook can gather each group before that step.
Input: the ingredient lines and the steps, both numbered from 0 in order. Lines starting with "## " are the old section names; ignore them and group the other lines afresh.
Answer with groups that each have:
- heading: a short name for what the group makes ("marinade", "for the sauce"), or null for the group of basics used from the start.
- step: the number of the first step that uses the group.
- lines: the numbers of its ingredient lines.
Put every ingredient line in exactly one group. Give each group a different heading. If the recipe has no clear stages, answer with no groups.`
