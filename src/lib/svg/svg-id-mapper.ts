/**
 * SVG ID Mapper — Story 7.1
 *
 * Maps Mermaid-generated SVG element IDs back to JsonGraph node/edge IDs.
 *
 * Mermaid flowchart node pattern: `flowchart-{nodeId}-{index}`
 * Mermaid edge path pattern:      `L-{fromId}-{toId}-{index}`
 *
 * Both patterns are documented in Mermaid's internal SVG generation.
 */

/**
 * Extracts the JsonGraph node ID from a Mermaid SVG element ID.
 *
 * Handles:
 * - `flowchart-Payment-0`       → `"Payment"`
 * - `flowchart-UserRegistration-3` → `"UserRegistration"`
 * - Unrecognised patterns       → `null`
 *
 * @param svgId - The `id` attribute of a Mermaid SVG node `<g>` element.
 * @returns The JsonGraph node ID string, or `null` if unrecognised.
 */
export function mapSvgNodeId(svgId: string): string | null {
  if (!svgId || typeof svgId !== 'string') return null;

  // Pattern: flowchart-{nodeId}-{numericIndex}
  // nodeId can contain letters, digits, underscores, hyphens — captured greedily before last `-\d+`
  const flowchartMatch = svgId.match(/^flowchart-(.+)-\d+$/);
  if (flowchartMatch) {
    return flowchartMatch[1];
  }

  return null;
}

/**
 * Extracts the from/to node IDs from a Mermaid SVG edge element ID.
 *
 * Handles:
 * - `L-A-B-0`    → `{ from: "A", to: "B" }`
 * - `L-Start-End-2` → `{ from: "Start", to: "End" }`
 * - Unrecognised → `null`
 *
 * @param svgId - The `id` attribute of a Mermaid SVG edge `<path>` or `<g>` element.
 * @returns Edge endpoints or `null` if the ID does not match the edge pattern.
 */
export function mapSvgEdgeId(svgId: string): { from: string; to: string } | null {
  if (!svgId || typeof svgId !== 'string') return null;

  // Pattern: L-{fromId}-{toId}-{numericIndex}
  // Both fromId and toId are non-empty strings; index is a non-negative integer.
  const edgeMatch = svgId.match(/^L-(.+)-(.+)-\d+$/);
  if (edgeMatch) {
    return { from: edgeMatch[1], to: edgeMatch[2] };
  }

  return null;
}

/**
 * Determines whether an SVG element is a Mermaid flowchart node group.
 * Checks the element's class list for the `"node"` class.
 */
export function isSvgNodeElement(el: Element): boolean {
  return el.classList.contains('node');
}

/**
 * Determines whether an SVG element is a Mermaid flowchart edge path.
 * Checks the element's class list for the `"edgePath"` class.
 */
export function isSvgEdgeElement(el: Element): boolean {
  return el.classList.contains('edgePath');
}
