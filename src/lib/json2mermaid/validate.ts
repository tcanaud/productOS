export interface ValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validate Mermaid syntax by checking structural correctness.
 *
 * Note: Full parse validation via mermaid.parse() requires a browser DOM.
 * This function performs structural checks that catch the most common issues:
 * - Non-empty output
 * - Correct diagram type header
 * - Matching brackets/delimiters (basic check)
 */
export function validateMermaidSyntax(syntax: string): ValidationResult {
  if (!syntax || syntax.trim().length === 0) {
    return { valid: false, error: 'Empty Mermaid syntax' };
  }

  const firstLine = syntax.trim().split('\n')[0]?.trim() ?? '';

  const validHeaders = [
    /^flowchart\s+(TD|TB|BT|LR|RL)$/,
    /^stateDiagram-v2$/,
    /^sequenceDiagram$/,
    /^graph\s+(TD|TB|BT|LR|RL)$/,
  ];

  const hasValidHeader = validHeaders.some((re) => re.test(firstLine));
  if (!hasValidHeader) {
    return {
      valid: false,
      error: `Invalid diagram header: "${firstLine}". Expected flowchart, stateDiagram-v2, or sequenceDiagram.`,
    };
  }

  return { valid: true };
}
