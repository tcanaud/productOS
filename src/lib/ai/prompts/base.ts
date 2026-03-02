export type PromptVariables = Record<string, string | number | boolean>;

/**
 * Simple template interpolation — replaces {{key}} placeholders with values.
 */
export function buildPrompt(template: string, variables: PromptVariables): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key: string) => {
    const value = variables[key];
    return value !== undefined ? String(value) : match;
  });
}

export interface SystemPromptOptions {
  persona?: string;
  context?: string;
  outputFormat?: string;
}

/**
 * Build a structured system prompt from persona and context.
 */
export function buildSystemPrompt(options: SystemPromptOptions): string {
  const parts: string[] = [];

  if (options.persona) {
    parts.push(`You are ${options.persona}.`);
  }

  if (options.context) {
    parts.push(`Context:\n${options.context}`);
  }

  if (options.outputFormat) {
    parts.push(`Output format:\n${options.outputFormat}`);
  }

  return parts.join('\n\n');
}

export interface WorkspaceContext {
  workspaceName?: string;
  workspaceDescription?: string;
  additionalContext?: string;
}

/**
 * Inject workspace context into an existing prompt.
 */
export function injectContext(prompt: string, context: WorkspaceContext): string {
  const contextLines: string[] = [];

  if (context.workspaceName) {
    contextLines.push(`Workspace: ${context.workspaceName}`);
  }
  if (context.workspaceDescription) {
    contextLines.push(`Description: ${context.workspaceDescription}`);
  }
  if (context.additionalContext) {
    contextLines.push(context.additionalContext);
  }

  if (contextLines.length === 0) return prompt;

  const contextBlock = `[Context]\n${contextLines.join('\n')}\n[/Context]\n\n`;
  return contextBlock + prompt;
}
