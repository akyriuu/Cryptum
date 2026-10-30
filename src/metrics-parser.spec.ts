import { describe, expect, it } from 'bun:test';
import { getMetrics, latestGauge, sumMetric } from '../web/src/metrics';

describe('web metrics parser', () => {
  it('parseia métricas no formato Prometheus com labels escapados', async () => {
    globalThis.fetch = async () => ({
      ok: true,
      text: async () =>
        '# HELP\n' +
        'wager_transactions_total{status="PROCESSED",provider_id="test\\\\service"} 12\n' +
        'wager_transactions_total{status="REJECTED",provider_id="other"} 7\n' +
        'wager_outbox_lag_seconds 1.5\n',
    }) as Response;

    const samples = await getMetrics();

    expect(samples).toEqual([
      {
        name: 'wager_transactions_total',
        labels: { status: 'PROCESSED', provider_id: 'test\\service' },
        value: 12,
      },
      {
        name: 'wager_transactions_total',
        labels: { status: 'REJECTED', provider_id: 'other' },
        value: 7,
      },
      { name: 'wager_outbox_lag_seconds', labels: {}, value: 1.5 },
    ]);

    expect(sumMetric(samples, 'wager_transactions_total')).toBe(19);
    expect(
      sumMetric(samples, 'wager_transactions_total', { status: 'PROCESSED' }),
    ).toBe(12);
    expect(latestGauge(samples, 'wager_outbox_lag_seconds')).toBe(1.5);
  });

  it('aceita valores especiais do Prometheus', async () => {
    globalThis.fetch = async () => ({
      ok: true,
      text: async () =>
        'metric_pos_inf +Inf\n' +
        'metric_neg_inf -Inf\n' +
        'metric_nan NaN\n',
    }) as Response;

    const samples = await getMetrics();

    expect(samples.map((sample) => sample.value)).toEqual([
      Number.POSITIVE_INFINITY,
      Number.NEGATIVE_INFINITY,
      Number.NaN,
    ]);
  });
});
