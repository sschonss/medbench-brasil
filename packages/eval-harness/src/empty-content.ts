export class EmptyContentWithReasoningError extends Error {
  constructor() {
    super(
      'content vazio com reasoning não-vazio: tentativa inválida (a resposta não é extraída do raciocínio)',
    );
    this.name = 'EmptyContentWithReasoningError';
  }
}

export function isBlankText(value: string | null | undefined): boolean {
  return (value ?? '').trim() === '';
}

function textFromUnknown(value: unknown): string | undefined {
  if (typeof value === 'string') {
    return isBlankText(value) ? undefined : value;
  }
  if (value && typeof value === 'object') {
    const rec = value as Record<string, unknown>;
    for (const key of ['text', 'content', 'reasoning']) {
      if (typeof rec[key] === 'string' && !isBlankText(rec[key])) return rec[key];
    }
  }
  return undefined;
}

export function readSeparatedReasoning(body: unknown): string | undefined {
  if (!body || typeof body !== 'object') return undefined;
  const root = body as Record<string, unknown>;
  const choices = root.choices;
  const choice = Array.isArray(choices) ? choices[0] : undefined;
  const ch = choice && typeof choice === 'object' ? (choice as Record<string, unknown>) : undefined;
  const message = ch?.message;
  const msg =
    message && typeof message === 'object' ? (message as Record<string, unknown>) : undefined;
  return (
    textFromUnknown(msg?.reasoning) ??
    textFromUnknown(msg?.reasoning_content) ??
    textFromUnknown(ch?.reasoning) ??
    textFromUnknown(ch?.reasoning_content) ??
    textFromUnknown(root.reasoning)
  );
}

export function contentTrappedInReasoning(
  rawResponse: string,
  reasoning: string | undefined,
): boolean {
  return isBlankText(rawResponse) && !isBlankText(reasoning);
}

export function assertContentNotTrappedInReasoning(
  rawResponse: string,
  reasoning: string | undefined,
): void {
  if (contentTrappedInReasoning(rawResponse, reasoning)) {
    throw new EmptyContentWithReasoningError();
  }
}
