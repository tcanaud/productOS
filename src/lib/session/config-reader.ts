/**
 * BMAD Config Reader — reads _bmad/core/config.yaml from a session directory.
 *
 * Lightweight YAML parser (key: value lines only — no nested objects).
 * Returns a typed BmadConfig with the fields claudegraph nodes need.
 */
import fs from 'fs';
import path from 'path';

export interface BmadConfig {
  communication_language: string;
  document_output_language: string;
  user_name: string;
  output_folder: string;
}

const DEFAULTS: BmadConfig = {
  communication_language: 'English',
  document_output_language: 'English',
  user_name: 'user',
  output_folder: '',
};

/**
 * Parse a flat YAML file (key: value per line, no nesting).
 * Strips comments and surrounding quotes.
 */
function parseFlatYaml(content: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const colonIdx = trimmed.indexOf(':');
    if (colonIdx === -1) continue;
    const key = trimmed.slice(0, colonIdx).trim();
    let value = trimmed.slice(colonIdx + 1).trim();
    // Strip surrounding quotes
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    result[key] = value;
  }
  return result;
}

/**
 * Read _bmad/core/config.yaml from a session directory and return typed config.
 * Returns defaults for any missing fields. Never throws.
 */
export function readSessionBmadConfig(sessionDir: string): BmadConfig {
  const configPath = path.join(sessionDir, '_bmad', 'core', 'config.yaml');
  try {
    const content = fs.readFileSync(configPath, 'utf-8');
    const parsed = parseFlatYaml(content);
    return {
      communication_language: parsed.communication_language || DEFAULTS.communication_language,
      document_output_language: parsed.document_output_language || DEFAULTS.document_output_language,
      user_name: parsed.user_name || DEFAULTS.user_name,
      output_folder: parsed.output_folder || DEFAULTS.output_folder,
    };
  } catch {
    return { ...DEFAULTS };
  }
}
