import { useCallback, useEffect, useState } from 'react';
import {
  getMetrics,
  latestGauge,
  sumMetric,
  type MetricSample,
} from './metrics';

interface MetricsPageProps {
  onBack: () => void;
}

const styles = `
.metrics-page { animation: metrics-enter 220ms cubic-bezier(.2,.7,.2,1) both; }
@keyframes metrics-enter { from { opacity:0; transform:translateY(5px); } to { opacity:1; transform:translateY(0); } }
.metrics-back { display:inline-flex; gap:7px; margin:0 0 24px; border:0; background:transparent; padding:0; color:#0071e3; font-size:11px; font-weight:600; cursor:pointer; }
.metrics-heading { display:flex; align-items:flex-end; justify-content:space-between; gap:14px; }
.metrics-refresh { min-height:34px; border:1px solid rgb(0 0 0 / 9%); border-radius:999px; background:rgb(255 255 255 / 88%); padding:0 13px; color:#0071e3; font-size:10px; font-weight:600; cursor:pointer; transition:transform 100ms ease,background 140ms ease; }
.metrics-refresh:hover { background:#fff; }
.metrics-refresh:active { transform:scale(.98); }
.metrics-refresh:disabled { opacity:.55; cursor:wait; }
.metrics-refresh-state { margin-top:7px; color:#86868b; font-size:9px; text-align:right; }
.metrics-cards { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:12px; margin-top:23px; }
.metrics-card { min-height:112px; border:1px solid rgb(0 0 0 / 5%); border-radius:13px; background:rgb(255 255 255 / 84%); padding:15px; box-shadow:0 4px 14px rgb(0 0 0 / 3%); }
.metrics-card span { color:#6e6e73; font-size:10px; }
.metrics-card strong { display:block; margin-top:10px; color:#1d1d1f; font-size:25px; font-weight:650; letter-spacing:-.04em; }
.metrics-card small { display:block; margin-top:5px; color:#86868b; font-size:9px; }
.metrics-panel { margin-top:14px; overflow:hidden; border:1px solid rgb(0 0 0 / 5%); border-radius:13px; background:rgb(255 255 255 / 86%); box-shadow:0 4px 14px rgb(0 0 0 / 3%); }
.metrics-panel-head { display:flex; align-items:center; justify-content:space-between; gap:10px; padding:16px 18px; }
.metrics-panel-head h2 { color:#1d1d1f; font-size:12px; font-weight:620; }
.metrics-panel-head p { margin-top:4px; color:#86868b; font-size:9px; }
.metrics-table-wrap { overflow-x:auto; }
.metrics-table { width:100%; border-collapse:collapse; text-align:left; }
.metrics-table th { background:rgb(245 245 247 / 72%); color:#6e6e73; font-size:9px; font-weight:650; letter-spacing:.04em; text-transform:uppercase; }
.metrics-table th,.metrics-table td { border-top:1px solid rgb(0 0 0 / 5%); padding:10px 14px; }
.metrics-table td { color:#515257; font-size:9px; }
.metrics-table code { color:#333438; font-family:ui-monospace,SFMono-Regular,Menlo,monospace; }
.metrics-value { color:#1d1d1f !important; font-variant-numeric:tabular-nums; font-weight:620; text-align:right; }
.metrics-empty,.metrics-error { padding:20px; color:#6e6e73; font-size:10px; }
.metrics-error { color:#a22d2d; }
.metrics-note { margin-top:14px; border-left:2px solid #d99a20; border-radius:0 8px 8px 0; background:#fffaf0; padding:11px 13px; color:#70551c; font-size:9px; line-height:1.55; }
@media (max-width:700px) { .metrics-heading { align-items:flex-start; flex-direction:column; } .metrics-heading-actions { align-self:flex-end; } .metrics-cards { grid-template-columns:repeat(2,minmax(0,1fr)); } }
@media (max-width:420px) { .metrics-cards { grid-template-columns:1fr; } }
@media (prefers-reduced-motion:reduce) { .metrics-page { animation:none; } }
@media (prefers-reduced-transparency:reduce) { .metrics-card,.metrics-panel { background:#fff; } }
@media (prefers-contrast:more) { .metrics-card,.metrics-panel { border-color:#77787d; } .metrics-note { color:#513c12; } }
`;

function formatSeconds(value: number | null): string {
  if (value === null) return '—';
  if (value < 1) return `${Math.round(value * 1000)} ms`;
  return `${value.toFixed(2)} s`;
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    maximumFractionDigits: 2,
  }).format(value);
}

export default function MetricsPage({ onBack }: MetricsPageProps) {
  const [samples, setSamples] = useState<MetricSample[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      setSamples(await getMetrics());
      setUpdatedAt(new Date());
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Não foi possível carregar as métricas.',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const interval = window.setInterval(() => void refresh(), 15000);
    return () => window.clearInterval(interval);
  }, [refresh]);

  const totalTransactions = sumMetric(samples, 'wager_transactions_total');
  const processedTransactions = sumMetric(samples, 'wager_transactions_total', {
    status: 'PROCESSED',
  });
  const rejectedTransactions = sumMetric(samples, 'wager_transactions_total', {
    status: 'REJECTED',
  });
  const divergences = sumMetric(
    samples,
    'wager_reconciliation_divergences_total',
  );
  const pendingReference = sumMetric(samples, 'wager_pending_reference_total');
  const outboxLag = latestGauge(samples, 'wager_outbox_lag_seconds');

  return (
    <section className="metrics-page">
      <style>{styles}</style>

      <button className="metrics-back" type="button" onClick={onBack}>
        ← Visão geral
      </button>

      <div className="metrics-heading">
        <div>
          <div className="eyebrow">OBSERVABILIDADE</div>
          <h1>Métricas do serviço</h1>
          <p className="page-description">
            Indicadores expostos pelo processo atual da API.
          </p>
        </div>

        <div className="metrics-heading-actions">
          <button
            className="metrics-refresh"
            type="button"
            onClick={() => void refresh()}
            disabled={loading}
          >
            {loading ? 'Atualizando…' : 'Atualizar agora'}
          </button>
          <div className="metrics-refresh-state">
            {updatedAt
              ? `Atualizado às ${updatedAt.toLocaleTimeString('pt-BR')}`
              : 'Aguardando métricas'}
          </div>
        </div>
      </div>

      {error && (
        <div className="metrics-error" role="alert">
          {error}
        </div>
      )}

      <section className="metrics-cards" aria-label="Resumo de métricas">
        <article className="metrics-card">
          <span>Transações registradas</span>
          <strong>{formatNumber(totalTransactions)}</strong>
          <small>Contador desde o início do processo</small>
        </article>
        <article className="metrics-card">
          <span>Processadas</span>
          <strong>{formatNumber(processedTransactions)}</strong>
          <small>Transações com status PROCESSED</small>
        </article>
        <article className="metrics-card">
          <span>Rejeitadas</span>
          <strong>{formatNumber(rejectedTransactions)}</strong>
          <small>Contador cumulativo do processo</small>
        </article>
        <article className="metrics-card">
          <span>Pendências de referência</span>
          <strong>{formatNumber(pendingReference)}</strong>
          <small>Eventos de resolução e expiração</small>
        </article>
        <article className="metrics-card">
          <span>Divergências detectadas</span>
          <strong>{formatNumber(divergences)}</strong>
          <small>Reconciliações inconsistentes</small>
        </article>
        <article className="metrics-card">
          <span>Atraso do outbox</span>
          <strong>{formatSeconds(outboxLag)}</strong>
          <small>Idade da mensagem pendente mais antiga</small>
        </article>
      </section>

      <section className="metrics-panel">
        <header className="metrics-panel-head">
          <div>
            <h2>Séries Prometheus</h2>
            <p>{samples.length} amostra(s) retornadas pelo endpoint /metrics</p>
          </div>
        </header>

        {samples.length === 0 && !loading && !error ? (
          <div className="metrics-empty">
            Nenhuma série foi emitida ainda. Gere atividade na API e atualize.
          </div>
        ) : (
          <div className="metrics-table-wrap">
            <table className="metrics-table">
              <thead>
                <tr>
                  <th>Métrica</th>
                  <th>Rótulos</th>
                  <th style={{ textAlign: 'right' }}>Valor</th>
                </tr>
              </thead>
              <tbody>
                {samples.map((sample, index) => (
                  <tr
                    key={`${sample.name}-${JSON.stringify(sample.labels)}-${index}`}
                  >
                    <td>
                      <code>{sample.name}</code>
                    </td>
                    <td>
                      {Object.keys(sample.labels).length
                        ? Object.entries(sample.labels)
                            .map(([key, value]) => `${key}="${value}"`)
                            .join(', ')
                        : '—'}
                    </td>
                    <td className="metrics-value">
                      {formatNumber(sample.value)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <p className="metrics-note">
        As métricas são mantidas em memória pelo processo da API. Elas reiniciam
        quando o backend reinicia; os valores não representam um histórico
        persistente.
      </p>
    </section>
  );
}
