export type VarSpec = {
  label: string;
  placeholder?: string;
  type?: 'text' | 'textarea' | 'select' | 'number';
  options?: string[];        // only for type: 'select'
  default?: string;          // stringified default; fine for number too
  required?: boolean;
};

export type VarsDict = Record<string, VarSpec>;

const BLOCK_START = '<!-- VARS';
const BLOCK_END = 'VARS -->';

/**
 * Extract a JSON variables block from an agent prompt.
 * Format:
 * <!-- VARS
 * { "topic": {"label":"Topic"} }
 * VARS -->
 * <real prompt body that can reference {topic}>
 */
export function extractVarsAndBody(prompt: string): { vars: VarsDict | null; body: string } {
  if (!prompt) return { vars: null, body: '' };
  const start = prompt.indexOf(BLOCK_START);
  const end = prompt.indexOf(BLOCK_END);
  if (start === -1 || end === -1 || end <= start) {
    return { vars: null, body: prompt };
  }

  const jsonRaw = prompt.slice(start + BLOCK_START.length, end).trim();
  const after = prompt.slice(end + BLOCK_END.length).replace(/^\s*\n?/, '');

  try {
    const parsed = JSON.parse(jsonRaw);
    // Sanitize to VarSpec
    const vars: VarsDict = {};
    if (parsed && typeof parsed === 'object') {
      for (const [k, v] of Object.entries(parsed)) {
        if (typeof k !== 'string' || !v || typeof v !== 'object') continue;
        const vs = v as Partial<VarSpec>;
        vars[k] = {
          label: String(vs.label ?? k),
          placeholder: vs.placeholder ? String(vs.placeholder) : undefined,
          type: (vs.type as VarSpec['type']) ?? 'text',
          options: Array.isArray(vs.options) ? vs.options.map(String) : undefined,
          default: vs.default !== undefined ? String(vs.default) : undefined,
          required: Boolean(vs.required),
        };
      }
    }
    return { vars, body: after };
  } catch {
    // Invalid JSON → ignore block and treat full prompt as body
    return { vars: null, body: prompt };
  }
}

/** Replace {var} tokens in body with user-provided values. */
export function applyVars(body: string, values: Record<string, string>): string {
  if (!body) return '';
  let out = body;
  for (const [k, v] of Object.entries(values ?? {})) {
    // replace all occurrences of {key}
    const re = new RegExp(`\\{${escapeRegExp(k)}\\}`, 'g');
    out = out.replace(re, v ?? '');
  }
  return out;
}

/** Recombine (pretty) variables block + body into a single prompt string. */
export function buildPromptWithVars(vars: VarsDict | null, body: string): string {
  if (!vars || Object.keys(vars).length === 0) return body;
  const pretty = JSON.stringify(vars, null, 2);
  return `${BLOCK_START}
${pretty}
${BLOCK_END}
${body.startsWith('\n') ? '' : '\n'}${body}`;
}

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
