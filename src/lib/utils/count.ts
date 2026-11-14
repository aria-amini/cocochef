// A number with its noun, singular or plural: "1 recipe", "3 recipes".
export const count = (total: number, one: string, many: string) =>
	`${total} ${total === 1 ? one : many}`
