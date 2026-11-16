import { describe, expect, it } from 'vitest';

import {
  assertContentNotTrappedInReasoning,
  contentTrappedInReasoning,
  EmptyContentWithReasoningError,
  readSeparatedReasoning,
} from '../src/empty-content.js';
import { parseLetter } from '../src/runner.js';

describe('readSeparatedReasoning', () => {
  it('lê message.reasoning, reasoning_content, choice e raiz, nesta ordem', () => {
    expect(
      readSeparatedReasoning({
        choices: [{ message: { content: '', reasoning: 'do message.reasoning' } }],
      }),
    ).toBe('do message.reasoning');
    expect(
      readSeparatedReasoning({
        choices: [{ message: { content: '', reasoning_content: 'do reasoning_content' } }],
      }),
    ).toBe('do reasoning_content');
    expect(
      readSeparatedReasoning({
        choices: [{ message: { content: '' }, reasoning: 'do choice' }],
      }),
    ).toBe('do choice');
    expect(
      readSeparatedReasoning({ choices: [{ message: { content: '' } }], reasoning: 'da raiz' }),
    ).toBe('da raiz');
  });

  it('ignora reasoning em branco e corpos sem o campo', () => {
    expect(
      readSeparatedReasoning({ choices: [{ message: { content: 'A', reasoning: '  ' } }] }),
    ).toBeUndefined();
    expect(readSeparatedReasoning({ choices: [{ message: { content: '' } }] })).toBeUndefined();
    expect(readSeparatedReasoning(null)).toBeUndefined();
  });
});

describe('contentTrappedInReasoning', () => {
  it('é verdadeiro só com content vazio/branco e reasoning não-vazio', () => {
    expect(contentTrappedInReasoning('', 'Resposta final: B')).toBe(true);
    expect(contentTrappedInReasoning('   ', 'B')).toBe(true);
    expect(contentTrappedInReasoning('', '  ')).toBe(false);
    expect(contentTrappedInReasoning('B', 'raciocínio longo')).toBe(false);
    expect(contentTrappedInReasoning('', undefined)).toBe(false);
  });

  it('não usa o raciocínio como resposta', () => {
    const reasoning = 'Depois de pensar, a resposta é B.';
    expect(contentTrappedInReasoning('', reasoning)).toBe(true);
    expect(parseLetter(reasoning)).toBe('B');
    expect(() => assertContentNotTrappedInReasoning('', reasoning)).toThrow(
      EmptyContentWithReasoningError,
    );
  });
});
