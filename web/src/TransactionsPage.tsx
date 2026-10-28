import { useState } from 'react';
import {
  findTransaction,
  formatDate,
  formatMoney,
  submitTransaction,
  type SubmittedTransaction,
  type Transaction,
} from './api';

interface TransactionsPageProps {
  onBack: () => void;
}

type Mode = 'lookup' | 'submit';

const styles = `
.transactions-page { animation: tx-enter 220ms cubic-bezier(.2,.7,.2,1) both; }
@keyframes tx-enter { from { opacity:0; transform:translateY(5px); } to { opacity:1; transform:translateY(0); } }
.tx-back { border:0; background:transparent; color:#0071e3; padding:0; margin-bottom:24px; font-size:11px; font-weight:600; cursor:pointer; }
.tx-heading { display:flex; align-items:flex-end; justify-content:space-between; gap:16px; }
.tx-tabs { display:inline-flex; gap:3px; margin:21px 0 13px; border:1px solid rgb(0 0 0 / 6%); border-radius:10px; background:rgb(0 0 0 / 4%); padding:3px; }
.tx-tabs button { min-height:29px; border:0; border-radius:7px; background:transparent; padding:0 12px; color:#6e6e73; font-size:10px; font-weight:550; cursor:pointer; transition:background 140ms ease,color 140ms ease,box-shadow 140ms ease; }
.tx-tabs button[aria-selected="true"] { background:#fff; color:#1d1d1f; box-shadow:0 1px 4px rgb(0 0 0 / 12%); }
.tx-card { border:1px solid rgb(0 0 0 / 5%); border-radius:13px; background:rgb(255 255 255 / 86%); padding:20px; box-shadow:0 4px 14px rgb(0 0 0 / 3%); }
.tx-form { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:15px; }
.tx-field { display:grid; align-content:start; gap:6px; }
.tx-field.full { grid-column:1/-1; }
.tx-field label { color:#424245; font-size:10px; font-weight:600; }
.tx-field small { color:#86868b; font-size:9px; line-height:1.45; }
.tx-field input,.tx-field select { width:100%; min-width:0; height:37px; border:1px solid #d2d2d7; border-radius:9px; background:rgb(255 255 255 / 90%); padding:0 10px; color:#1d1d1f; font-size:10px; outline:none; transition:border-color 140ms ease,box-shadow 140ms ease; }
.tx-field input:focus,.tx-field select:focus { border-color:#0071e3; box-shadow:0 0 0 3px rgb(0 113 227 / 13%); }
.tx-money-row { display:grid; grid-template-columns:1fr 100px; gap:8px; }
.tx-actions { display:flex; grid-column:1/-1; align-items:center; justify-content:space-between; gap:12px; margin-top:3px; }
.tx-actions small { color:#86868b; font-size:9px; }
.tx-submit { min-height:35px; border:0; border-radius:999px; background:#0071e3; padding:0 15px; color:#fff; font-size:10px; font-weight:600; cursor:pointer; transition:transform 100ms ease,background 140ms ease; }
.tx-submit:hover { background:#0077ed; }
.tx-submit:active { transform:scale(.98); }
.tx-submit:disabled { opacity:.58; cursor:wait; }
.tx-error { margin-top:13px; border:1px solid #f1c7c7; border-radius:9px; background:#fff5f5; padding:10px 12px; color:#a22d2d; font-size:10px; }
.tx-result { margin-top:14px; border:1px solid #d9d9de; border-radius:12px; background:#fff; padding:16px; }
.tx-result.success { border-color:#c8e8d4; background:#f6fcf8; }
.tx-result.warning { border-color:#f0dfb8; background:#fffaf0; }
.tx-result h2 { color:#1d1d1f; font-size:12px; font-weight:620; }
.tx-result p { margin-top:5px; color:#6e6e73; font-size:10px; line-height:1.55; }
.tx-result-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:12px; margin-top:13px; }
.tx-result-item { min-width:0; }
.tx-result-item span { display:block; color:#86868b; font-size:9px; }
.tx-result-item strong { display:block; overflow-wrap:anywhere; margin-top:4px; color:#343438; font-size:10px; font-weight:600; }
.tx-detail { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:12px; margin-top:14px; }
.tx-detail-item { min-width:0; border:1px solid rgb(0 0 0 / 5%); border-radius:10px; background:#fff; padding:13px; }
.tx-detail-item span { display:block; color:#86868b; font-size:9px; }
.tx-detail-item strong { display:block; overflow-wrap:anywhere; margin-top:5px; color:#343438; font-size:10px; font-weight:600; }
.tx-note { margin-top:14px; border-left:2px solid #d99a20; background:#fffaf0; padding:10px 12px; color:#70551c; font-size:9px; line-height:1.55; }
@media (max-width:700px) { .tx-heading { align-items:flex-start; flex-direction:column; } .tx-form { grid-template-columns:1fr; } .tx-field.full,.tx-actions { grid-column:auto; } .tx-actions { align-items:flex-start; flex-direction:column; } .tx-actions .tx-submit { width:100%; min-height:38px; } .tx-detail { grid-template-columns:1fr; } }
@media (prefers-reduced-motion:reduce) { .transactions-page { animation:none; } }
@media (prefers-reduced-transparency:reduce) { .tx-card,.tx-result,.tx-detail-item { background:#fff; } }
@media (prefers-contrast:more) { .tx-card,.tx-result,.tx-detail-item { border-color:#77787d; } .tx-field small { color:#515257; } }
`;

function TransactionDetails({ transaction }: { transaction: Transaction }) {
  return (
    <div className="tx-result">
      <h2>
        {transaction.kind} · {transaction.status}
      </h2>
      <p>
        Criada em {formatDate(transaction.createdAt)}
        {transaction.processedAt
          ? ` · Processada em ${formatDate(transaction.processedAt)}`
          : ''}
      </p>
      <div className="tx-detail">
        <div className="tx-detail-item">
          <span>Valor</span>
          <strong>{formatMoney(transaction.money)}</strong>
        </div>
        <div className="tx-detail-item">
          <span>Provedor</span>
          <strong>{transaction.providerId}</strong>
        </div>
        <div className="tx-detail-item">
          <span>Transação externa</span>
          <strong>{transaction.externalTransactionId}</strong>
        </div>
        <div className="tx-detail-item">
          <span>Carteira</span>
          <strong>{transaction.walletId}</strong>
        </div>
        <div className="tx-detail-item">
          <span>Jogo · rodada</span>
          <strong>
            {transaction.gameId} · {transaction.roundId}
          </strong>
        </div>
        <div className="tx-detail-item">
          <span>Falha</span>
          <strong>{transaction.failureCode ?? 'Nenhuma'}</strong>
        </div>
      </div>
      {transaction.referenceExternalTransactionId && (
        <p className="tx-note">
          Referência externa: {transaction.referenceExternalTransactionId}
        </p>
      )}
    </div>
  );
}

function SubmitResult({
  response,
}: {
  response: { result: SubmittedTransaction; httpStatus: number };
}) {
  const { result, httpStatus } = response;
  const tone =
    result.status === 'PROCESSED'
      ? 'success'
      : result.status === 'PENDING_REFERENCE'
        ? 'warning'
        : '';

  return (
    <div className={`tx-result ${tone}`} role="status">
      <h2>
        {result.status} · HTTP {httpStatus}
      </h2>
      <p>
        {result.status === 'PROCESSED'
          ? 'Transação processada.'
          : result.status === 'PENDING_REFERENCE'
            ? 'Aceita e aguardando a transação de referência.'
            : result.status === 'REJECTED'
              ? 'A transação foi rejeitada pela regra de negócio.'
              : 'Resposta recebida da API.'}
      </p>
      <div className="tx-result-grid">
        <div className="tx-result-item">
          <span>ID da transação</span>
          <strong>{result.transactionId}</strong>
        </div>
        <div className="tx-result-item">
          <span>Saldo retornado</span>
          <strong>{formatMoney(result.balance)}</strong>
        </div>
        <div className="tx-result-item">
          <span>Código de falha</span>
          <strong>{result.failureCode ?? 'Nenhum'}</strong>
        </div>
        <div className="tx-result-item">
          <span>Reenvio idempotente</span>
          <strong>{result.idempotentReplay ? 'Sim' : 'Não'}</strong>
        </div>
      </div>
    </div>
  );
}

export default function TransactionsPage({ onBack }: TransactionsPageProps) {
  const [mode, setMode] = useState<Mode>('lookup');
  const [providerId, setProviderId] = useState('');
  const [externalId, setExternalId] = useState('');
  const [transaction, setTransaction] = useState<Transaction | null>(null);
  const [lookupError, setLookupError] = useState('');
  const [lookingUp, setLookingUp] = useState(false);

  const [playerId, setPlayerId] = useState('');
  const [walletId, setWalletId] = useState('');
  const [roundId, setRoundId] = useState('');
  const [gameId, setGameId] = useState('');
  const [kind, setKind] = useState('BET');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('BRL');
  const [referenceId, setReferenceId] = useState('');
  const [idempotencyKey, setIdempotencyKey] = useState(() =>
    crypto.randomUUID(),
  );
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [submitResult, setSubmitResult] = useState<{
    result: SubmittedTransaction;
    httpStatus: number;
  } | null>(null);

  async function lookup(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setTransaction(null);
    setLookupError('');
    setLookingUp(true);

    try {
      setTransaction(
        await findTransaction(providerId.trim(), externalId.trim()),
      );
    } catch (error) {
      setLookupError(
        error instanceof Error ? error.message : 'Consulta não concluída.',
      );
    } finally {
      setLookingUp(false);
    }
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitError('');
    setSubmitResult(null);
    setSubmitting(true);

    try {
      const response = await submitTransaction({
        providerId: providerId.trim(),
        externalTransactionId: externalId.trim(),
        playerId: playerId.trim(),
        walletId: walletId.trim(),
        roundId: roundId.trim(),
        gameId: gameId.trim(),
        kind,
        money: { amount: amount.trim(), currency },
        referenceExternalTransactionId: referenceId.trim() || undefined,
        idempotencyKey,
      });

      if (response.error) {
        setSubmitError(`HTTP ${response.httpStatus}: ${response.error}`);
      } else if (response.result) {
        setSubmitResult({
          result: response.result,
          httpStatus: response.httpStatus,
        });
        setIdempotencyKey(crypto.randomUUID());
      }
    } catch (error) {
      setSubmitError(
        error instanceof Error ? error.message : 'Envio não concluído.',
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="transactions-page">
      <style>{styles}</style>

      <button className="tx-back" type="button" onClick={onBack}>
        ← Visão geral
      </button>

      <div className="tx-heading">
        <div>
          <div className="eyebrow">OPERAÇÃO</div>
          <h1>Transações</h1>
          <p className="page-description">
            Envie uma operação de teste ou consulte uma transação existente.
          </p>
        </div>
      </div>

      <div className="tx-tabs" role="tablist" aria-label="Ação de transação">
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'lookup'}
          onClick={() => setMode('lookup')}
        >
          Consultar
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'submit'}
          onClick={() => setMode('submit')}
        >
          Enviar transação
        </button>
      </div>

      {mode === 'lookup' ? (
        <section className="tx-card">
          <form className="tx-form" onSubmit={lookup}>
            <div className="tx-field">
              <label htmlFor="lookup-provider">Provedor</label>
              <input
                id="lookup-provider"
                value={providerId}
                onChange={(event) => setProviderId(event.target.value)}
                placeholder="ex.: provedor-demo"
                required
              />
            </div>
            <div className="tx-field">
              <label htmlFor="lookup-external">ID da transação externa</label>
              <input
                id="lookup-external"
                value={externalId}
                onChange={(event) => setExternalId(event.target.value)}
                placeholder="ID usado pelo provedor"
                required
              />
            </div>
            <div className="tx-actions">
              <small>Consulta pela referência do provedor.</small>
              <button className="tx-submit" type="submit" disabled={lookingUp}>
                {lookingUp ? 'Consultando…' : 'Consultar transação'}
              </button>
            </div>
          </form>

          {lookupError && (
            <div className="tx-error" role="alert">
              {lookupError}
            </div>
          )}
          {transaction && <TransactionDetails transaction={transaction} />}
        </section>
      ) : (
        <section className="tx-card">
          <form className="tx-form" onSubmit={submit}>
            <div className="tx-field">
              <label htmlFor="submit-provider">Provedor</label>
              <input
                id="submit-provider"
                value={providerId}
                onChange={(event) => setProviderId(event.target.value)}
                placeholder="ex.: provedor-demo"
                required
              />
            </div>
            <div className="tx-field">
              <label htmlFor="submit-external">ID externo</label>
              <input
                id="submit-external"
                value={externalId}
                onChange={(event) => setExternalId(event.target.value)}
                placeholder="Identificador único da operação"
                required
              />
            </div>
            <div className="tx-field">
              <label htmlFor="submit-player">ID do jogador</label>
              <input
                id="submit-player"
                value={playerId}
                onChange={(event) => setPlayerId(event.target.value)}
                placeholder="UUID do jogador"
                required
              />
            </div>
            <div className="tx-field">
              <label htmlFor="submit-wallet">ID da carteira</label>
              <input
                id="submit-wallet"
                value={walletId}
                onChange={(event) => setWalletId(event.target.value)}
                placeholder="UUID da carteira"
                required
              />
            </div>
            <div className="tx-field">
              <label htmlFor="submit-game">Jogo</label>
              <input
                id="submit-game"
                value={gameId}
                onChange={(event) => setGameId(event.target.value)}
                placeholder="ex.: fortune-chimp"
                required
              />
            </div>
            <div className="tx-field">
              <label htmlFor="submit-round">Rodada</label>
              <input
                id="submit-round"
                value={roundId}
                onChange={(event) => setRoundId(event.target.value)}
                placeholder="ID da rodada"
                required
              />
            </div>
            <div className="tx-field">
              <label htmlFor="submit-kind">Tipo</label>
              <select
                id="submit-kind"
                value={kind}
                onChange={(event) => setKind(event.target.value)}
              >
                <option value="BET">Aposta · BET</option>
                <option value="WIN">Prêmio · WIN</option>
                <option value="LOSS">Perda · LOSS</option>
                <option value="REFUND">Reembolso · REFUND</option>
                <option value="ROLLBACK">Estorno · ROLLBACK</option>
              </select>
            </div>
            <div className="tx-field">
              <label htmlFor="submit-amount">Valor</label>
              <div className="tx-money-row">
                <input
                  id="submit-amount"
                  inputMode="decimal"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  placeholder="25.00"
                  pattern="\\d+(\\.\\d{1,2})?"
                  required
                />
                <select
                  aria-label="Moeda"
                  value={currency}
                  onChange={(event) => setCurrency(event.target.value)}
                >
                  <option value="BRL">BRL</option>
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                </select>
              </div>
            </div>
            {(kind === 'REFUND' || kind === 'ROLLBACK') && (
              <div className="tx-field full">
                <label htmlFor="submit-reference">
                  ID externo da transação de referência
                </label>
                <input
                  id="submit-reference"
                  value={referenceId}
                  onChange={(event) => setReferenceId(event.target.value)}
                  placeholder="Transação que será revertida"
                  required
                />
              </div>
            )}
            <div className="tx-actions">
              <small>
                Chave de idempotência: {idempotencyKey.slice(0, 8)}…
              </small>
              <button className="tx-submit" type="submit" disabled={submitting}>
                {submitting ? 'Enviando…' : 'Enviar transação'}
              </button>
            </div>
          </form>

          <div className="tx-note">
            Use uma carteira e um jogador existentes. Esta chamada processa uma
            operação de verdade no backend local; uma aposta pode alterar o
            saldo.
          </div>

          {submitError && (
            <div className="tx-error" role="alert">
              {submitError}
            </div>
          )}
          {submitResult && <SubmitResult response={submitResult} />}
        </section>
      )}
    </section>
  );
}
