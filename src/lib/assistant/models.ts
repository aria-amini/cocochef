// The models the assistant runs on, through OpenRouter, with the names the
// app shows for them. Safe for the browser: no keys, no clients.

// DeepSeek to start. 'anthropic/claude-haiku-5.5' is the next to try.
export const suggestionModel = {
	id: 'deepseek/deepseek-v4.1-flash',
	name: 'deepseek v4.1 flash',
} as const
