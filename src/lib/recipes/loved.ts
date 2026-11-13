// How the finder can order what it finds besides by match: the most loved
// first (stars weighed by how many gave them), or the most rated first,
// whatever they gave.
export const recipeSorts = ['loved', 'votes'] as const

export type RecipeSort = (typeof recipeSorts)[number]
