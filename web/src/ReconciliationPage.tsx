import { useState } from 'react';
import { formatMoney, reconcileWallet, type Reconciliation } from './api';
import './ReconciliationPage.css';

interface ReconciliationPageProps {
  onBack: () => void;
}

export default function ReconciliationPage({
  onBack,
}: ReconciliationPageProps) {
  const [walletId, setWalletId] = useState('');
  const [result, setResult] = useState<Reconciliation | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setResult(null);
    setLoading(true);

    try {
      setResult(await reconcileWallet(walletId.trim()));
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Não foi possível reconciliar esta carteira.',
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="reconciliation-page">
      <button className="recon-back" type="button" onClick={onBack}>
        ← Visão geral
      </button>

      <div className="eyebrow">INTEGRIDADE FINANCEIRA</div>
      <h1>Reconciliação</h1>
      <p className="page-description">
        Compare o saldo da carteira com a soma reconstruída dos lançamentos.
      </p>

      <form className="recon-form" onSubmit={handleSubmit}>
        <div className="recon-input-wrap">
          <label htmlFor="recon-wallet-id">ID da carteira</label>
          <input
            id="recon-wallet-id"
            value={walletId}
            onChange={(event) => setWalletId(event.target.value)}
            placeholder="Cole o UUID da carteira"
            autoComplete="off"
            required
          />
        </div>
        <button className="recon-submit" type="submit" disabled={loading}>
          {loading ? 'Conferindo…' : 'Conferir saldo'}
        </button>
      </form>

      <p className="recon-explainer">
        A verificação é somente leitura: ela identifica e reporta diferenças sem
        alterar o saldo nem os lançamentos.
      </p>

      {error && (
        <div className="recon-error" role="alert">
          <span className="recon-message-icon">!</span>
          <span>{error}</span>
        </div>
      )}

      {result && (
        <section
          className={`recon-result${result.consistent ? ' consistent' : ' mismatch'}`}
          aria-live="polite"
        >
          <header className="recon-result-head">
            <div
              className={`recon-result-symbol${result.consistent ? ' good' : ' bad'}`}
            >
              {result.consistent ? '✓' : '!'}
            </div>
            <div>
              <div className="eyebrow">RESULTADO DA VERIFICAÇÃO</div>
              <h2>
                {result.consistent
                  ? 'Ledger consistente'
                  : 'Diferença encontrada'}
              </h2>
              <p>
                {result.consistent
                  ? 'O saldo armazenado corresponde ao saldo reconstruído.'
                  : 'Os saldos não correspondem. Revise os lançamentos desta carteira.'}
              </p>
            </div>
          </header>

          <div className="recon-values">
            <article className="recon-value-card">
              <span>Saldo armazenado</span>
              <strong>{formatMoney(result.storedBalance)}</strong>
            </article>
            <article className="recon-value-card">
              <span>Saldo reconstruído</span>
              <strong>{formatMoney(result.calculatedBalance)}</strong>
            </article>
            <article className="recon-value-card difference">
              <span>Diferença</span>
              <strong>{formatMoney(result.difference)}</strong>
            </article>
          </div>

          <footer className="recon-result-foot">
            <span>Carteira</span>
            <code title={result.walletId}>{result.walletId}</code>
            <span className="recon-entry-count">
              {result.checkedEntries} lançamento(s) conferido(s)
            </span>
          </footer>
        </section>
      )}
    </section>
  );
}
