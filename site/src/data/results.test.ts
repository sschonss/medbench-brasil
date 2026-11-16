import { describe, expect, it } from 'vitest';

import { MODELS_METADATA } from './models';
import {
  displayedAccuracyOutsideCi,
  FORA_DO_LEADERBOARD,
  formatAccuracyPct,
  formatCi95Pct,
  type LeaderboardScope,
  MODELS,
  scopedAccuracy,
} from './results';

describe('composição do leaderboard', () => {
  it('publica custo por edição de Grok quando os raws comprovam a faixa de contexto', () => {
    const grok = MODELS.find((model) => model.modelId === 'x-ai/grok-4.7');
    for (const [edition, input, output, questions] of [
      ['revalida-2025-2', 365526, 437273, 82],
      ['revalida-2026-1', 379914, 466367, 84],
    ] as const) {
      const cost = grok?.costByEdition[edition]?.all;
      expect(cost?.status).toBe('available');
      if (!cost || cost.status !== 'available') throw new Error('Custo da edição indisponível');
      const expected =
        (input * cost.pricing.pricePerMTokInputUSD + output * cost.pricing.pricePerMTokOutputUSD) /
        1_000_000;
      expect(cost.totalUSD).toBeCloseTo(expected, 10);
      expect(cost.perQuestionUSD).toBeCloseTo(expected / questions, 10);
    }
  });
  it('não publica modelo marcado como fora do leaderboard', () => {
    // Regressão: ausência de entrada no registry NÃO basta para esconder um
    // modelo — `getModelMetadata` tem fallback, então todo artefato em
    // `results/` viraria linha. A exclusão tem que ser explícita.
    for (const modelId of Object.keys(FORA_DO_LEADERBOARD)) {
      expect(MODELS.find((m) => m.modelId === modelId)).toBeUndefined();
    }
  });

  it('mantém o Laya fora da tabela, como controle de protocolo', () => {
    expect(FORA_DO_LEADERBOARD).toHaveProperty('convaiinnovations/laya-multilingual');
  });

  it('publica os modelos de decisão que têm entrada no registry', () => {
    for (const modelId of ['jaredpalmer/kev-4b', 'typesafe/jev-1.13-20260917']) {
      expect(MODELS.find((m) => m.modelId === modelId)).toBeDefined();
      expect(MODELS_METADATA[modelId]?.isDecisionModel).toBe(true);
    }
  });

  it('não deixa modelo publicado sem metadado editorial', () => {
    // `provider: 'desconhecido'` é o fallback; se aparecer na tabela, faltou
    // entrada no registry ou faltou excluir o modelo de propósito.
    const semMetadado = MODELS.filter((m) => m.provider === 'desconhecido').map((m) => m.modelId);
    expect(semMetadado).toEqual([]);
  });
});

describe('fallback pela data de lançamento dos pesos', () => {
  // O "limpo" pela data de lançamento só vale para pesos imutáveis, sem corte
  // declarado e com a data de fonte publicada (docs/contamination.md). Um
  // artefato re-escorado com --weights-release para um modelo fora dessas
  // condições publicaria "limpo" sem base.
  it('só aparece em open-weight sem corte declarado e com data de fonte publicada', () => {
    const comFallback = MODELS.filter((m) => m.contaminationBasis === 'release-date');
    expect(comFallback.length).toBeGreaterThan(0);
    for (const m of comFallback) {
      expect(m.tier, m.modelId).toBe('open-weight');
      expect(m.trainingCutoff, m.modelId).toBeUndefined();
      expect(m.releaseDateSource, m.modelId).toMatch(/^https:\/\//);
    }
  });
});

const SCOPES: LeaderboardScope[] = ['all', 'clean', 'contaminated'];

describe('IC 95% e n no escopo de contaminação', () => {
  it('no recorte limpo, GPT-6.1 Terra tem 98,0% com n=252 e o ponto cai dentro do IC exibido', () => {
    const terra = MODELS.find((m) => m.modelId === 'openai/gpt-6.1-terra');
    expect(terra).toBeDefined();
    const all = scopedAccuracy(terra!, 'all');
    const clean = scopedAccuracy(terra!, 'clean');
    expect(all).not.toBeNull();
    expect(clean).not.toBeNull();

    expect(formatAccuracyPct(clean!.accuracy)).toBe('98.0%');
    expect(clean!.n).toBe(252);
    expect(all!.n).toBe(498);
    expect(formatCi95Pct(all!.ci95)).toBe('94.4–97.7');
    expect(displayedAccuracyOutsideCi(clean!.accuracy, all!.ci95)).toBe(true);

    expect(displayedAccuracyOutsideCi(clean!.accuracy, clean!.ci95)).toBe(false);
    expect(formatCi95Pct(clean!.ci95)).not.toBe(formatCi95Pct(all!.ci95));
  });

  it('falha se a precisão exibida de qualquer modelo cair fora do IC exibido no recorte', () => {
    const fora: string[] = [];
    for (const m of MODELS) {
      for (const scope of SCOPES) {
        const stats = scopedAccuracy(m, scope);
        if (!stats) continue;
        if (displayedAccuracyOutsideCi(stats.accuracy, stats.ci95)) {
          fora.push(
            `${m.modelId} ${scope}: ${formatAccuracyPct(stats.accuracy)} fora de ${formatCi95Pct(stats.ci95)} (n=${stats.n})`,
          );
        }
      }
    }
    expect(fora).toEqual([]);
  });

  it('devolve null quando o modelo não tem execuções no recorte', () => {
    const soLimpo = MODELS.find(
      (m) => m.contaminationSplit.clean && !m.contaminationSplit.contaminated,
    );
    expect(soLimpo).toBeDefined();
    expect(scopedAccuracy(soLimpo!, 'contaminated')).toBeNull();
    expect(scopedAccuracy(soLimpo!, 'clean')).not.toBeNull();
  });
});
