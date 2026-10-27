import { useEffect, useState } from 'react';
import {
  createWallet,
  formatDate,
  formatMoney,
  getWallet,
  getWalletLedger,
  reconcileWallet,
  type LedgerEntry,
  type Wallet,
} from './api';

interface WalletsPageProps {
  onBack: () => void;
}

type Reconciliation = Awaited<ReturnType<typeof reconcileWallet>>;

const styles = `
.wallet-page { animation: wallet-enter 220ms cubic-bezier(.2,.7,.2,1) both; }
@keyframes wallet-enter { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: translateY(0); } }
.wallet-back { display:inline-flex; align-items:center; gap:7px; border:0; background:transparent; color:#0071e3; padding:0; margin-bottom:24px; font-size:11px; font-weight:600; cursor:pointer; }
.wallet-back:active,.wallet-toolbar button:active,.wallet-create-button:active,.wallet-sheet button:active { transform:scale(.98); }
.wallet-title-row { display:flex; align-items:flex-end; justify-content:space-between; gap:16px; }
.wallet-create-button { display:inline-flex; min-height:36px; align-items:center; gap:7px; border:0; border-radius:999px; background:#0071e3; padding:0 15px; color:white; font-size:10px; font-weight:600; cursor:pointer; transition:transform 100ms ease,background 140ms ease; }
.wallet-create-button:hover { background:#0077ed; }
.wallet-search { display:flex; gap:9px; margin:23px 0 16px; padding:14px; border:1px solid rgb(0 0 0 / 5%); border-radius:13px; background:rgb(255 255 255 / 80%); box-shadow:0 4px 14px rgb(0 0 0 / 3%); }
.wallet-search input,.wallet-sheet input,.wallet-sheet select { width:100%; min-width:0; height:38px; border:1px solid #d2d2d7; border-radius:9px; background:rgb(255 255 255 / 88%); padding:0 11px; color:#1d1d1f; font-size:11px; outline:none; transition:border-color 140ms ease,box-shadow 140ms ease; }
.wallet-search input:focus,.wallet-sheet input:focus,.wallet-sheet select:focus { border-color:#0071e3; box-shadow:0 0 0 3px rgb(0 113 227 / 13%); }
.wallet-search button { min-width:106px; border:0; border-radius:9px; background:#1d1d1f; padding:0 14px; color:#fff; font-size:10px; font-weight:600; cursor:pointer; transition:transform 100ms ease,background 140ms ease; }
.wallet-search button:hover { background:#3a3a3c; }
.wallet-search button:disabled,.wallet-create-button:disabled,.wallet-sheet button:disabled { opacity:.58; cursor:wait; }
.wallet-alert { margin:0 0 15px; border:1px solid #f1c7c7; border-radius:10px; background:#fff5f5; padding:11px 13px; color:#a22d2d; font-size:10px; }
.wallet-summary { display:grid; grid-template-columns:1.35fr 1fr 1fr; gap:12px; margin-bottom:14px; }
.wallet-summary-card { min-width:0; border:1px solid rgb(0 0 0 / 5%); border-radius:13px; background:rgb(255 255 255 / 82%); padding:16px; box-shadow:0 4px 14px rgb(0 0 0 / 3%); }
.wallet-summary-label { color:#6e6e73; font-size:10px; }
.wallet-summary-value { overflow-wrap:anywhere; margin-top:8px; color:#1d1d1f; font-size:12px; font-weight:600; }
.wallet-summary-card:first-child .wallet-summary-value { font-size:22px; letter-spacing:-.04em; }
.wallet-ledger { overflow:hidden; border:1px solid rgb(0 0 0 / 5%); border-radius:13px; background:rgb(255 255 255 / 86%); box-shadow:0 4px 14px rgb(0 0 0 / 3%); }
.wallet-ledger-head { display:flex; align-items:center; justify-content:space-between; gap:14px; padding:17px 18px; }
.wallet-ledger-head h2 { color:#1d1d1f; font-size:12px; font-weight:620; }
.wallet-ledger-head p { margin-top:4px; color:#86868b; font-size:9px; }
.wallet-toolbar { display:flex; align-items:center; gap:7px; }
.wallet-toolbar button { min-height:30px; border:1px solid rgb(0 0 0 / 9%); border-radius:999px; background:rgb(255 255 255 / 90%); padding:0 11px; color:#0071e3; font-size:9px; font-weight:600; cursor:pointer; transition:transform 100ms ease,background 140ms ease; }
.wallet-toolbar button:hover { background:#f2f8ff; }
.wallet-toolbar button:disabled { opacity:.55; cursor:wait; }
.wallet-table-wrap { overflow-x:auto; }
.wallet-table { width:100%; border-collapse:collapse; text-align:left; white-space:nowrap; }
.wallet-table th { background:rgb(245 245 247 / 72%); color:#6e6e73; font-size:9px; font-weight:650; letter-spacing:.045em; text-transform:uppercase; }
.wallet-table th,.wallet-table td { border-top:1px solid rgb(0 0 0 / 5%); padding:11px 15px; }
.wallet-table td { color:#515257; font-size:10px; }
.wallet-table td.amount { color:#1d1d1f; font-weight:620; }
.wallet-direction { display:inline-flex; align-items:center; gap:5px; border-radius:999px; background:#eaf6ef; padding:4px 8px; color:#248a57; font-size:9px; font-weight:620; }
.wallet-direction.debit { background:#fff0ed; color:#bf5347; }
.wallet-empty { padding:37px 16px; color:#6e6e73; font-size:10px; text-align:center; }
.wallet-more { display:block; margin:14px auto 17px; border:1px solid rgb(0 0 0 / 9%); border-radius:999px; background:#fff; padding:8px 14px; color:#0071e3; font-size:9px; font-weight:600; cursor:pointer; }
.wallet-scrim { position:fixed; inset:0; z-index:10; display:flex; justify-content:flex-end; background:rgb(0 0 0 / 27%); backdrop-filter:blur(5px); -webkit-backdrop-filter:blur(5px); animation:scrim-in 180ms ease both; }
@keyframes scrim-in { from { opacity:0; } to { opacity:1; } }
.wallet-sheet { width:min(440px,100%); height:100%; overflow:auto; border-left:1px solid rgb(255 255 255 / 45%); background:rgb(250 250 252 / 94%); padding:30px 27px; box-shadow:-18px 0 55px rgb(0 0 0 / 13%); backdrop-filter:blur(28px) saturate(160%); -webkit-backdrop-filter:blur(28px) saturate(160%); animation:sheet-in 260ms cubic-bezier(.2,.8,.2,1) both; }
@keyframes sheet-in { from { opacity:.8; transform:translateX(18px) scale(.99); } to { opacity:1; transform:translateX(0) scale(1); } }
.wallet-sheet-head { display:flex; align-items:flex-start; justify-content:space-between; gap:15px; margin-bottom:24px; }
.wallet-sheet-head h2 { margin-top:4px; color:#1d1d1f; font-size:23px; font-weight:670; letter-spacing:-.04em; }
.wallet-sheet-head p { margin-top:6px; color:#6e6e73; font-size:10px; line-height:1.5; }
.wallet-sheet-close { display:grid; width:29px; height:29px; flex:0 0 auto; place-items:center; border:0; border-radius:50%; background:#e8e8ed; color:#5b5b60; font-size:17px; cursor:pointer; }
.wallet-form { display:grid; gap:17px; }
.wallet-field { display:grid; gap:7px; }
.wallet-field label { color:#424245; font-size:10px; font-weight:600; }
.wallet-field small { color:#86868b; font-size:9px; line-height:1.45; }
.wallet-money-fields { display:grid; grid-template-columns:1fr 110px; gap:9px; }
.wallet-form-error { border:1px solid #f1c7c7; border-radius:9px; background:#fff5f5; padding:10px 11px; color:#a22d2d; font-size:10px; }
.wallet-form-success { border:1px solid #c8e8d4; border-radius:9px; background:#effaf3; padding:10px 11px; color:#207547; font-size:10px; line-height:1.5; overflow-wrap:anywhere; }
.wallet-form-actions { display:flex; justify-content:flex-end; gap:8px; margin-top:5px; }
.wallet-form-actions button { min-height:35px; border-radius:999px; padding:0 14px; font-size:10px; font-weight:600; cursor:pointer; transition:transform 100ms ease,background 140ms ease; }
.wallet-cancel { border:1px solid rgb(0 0 0 / 9%); background:#fff; color:#424245; }
.wallet-submit { border:0; background:#0071e3; color:#fff; }
.wallet-submit:hover { background:#0077ed; }
@media (max-width:700px) { .wallet-title-row { align-items:flex-start; } .wallet-summary { grid-template-columns:1fr; } .wallet-search { flex-direction:column; } .wallet-search button { min-height:36px; } .wallet-ledger-head { align-items:flex-start; flex-direction:column; padding:15px; } .wallet-toolbar { flex-wrap:wrap; } .wallet-sheet { padding:24px 19px; } }
@media (max-width:420px) { .wallet-title-row { flex-direction:column; } .wallet-money-fields { grid-template-columns:1fr 90px; } }
@media (prefers-reduced-motion:reduce) { .wallet-page,.wallet-scrim,.wallet-sheet { animation:none; } }
@media (prefers-reduced-transparency:reduce) { .wallet-scrim { background:rgb(0 0 0 / 42%); backdrop-filter:none; } .wallet-sheet { background:#fafafc; backdrop-filter:none; } }
@media (prefers-contrast:more) { .wallet-summary-card,.wallet-ledger,.wallet-search { border-color:#77787d; } .wallet-field small { color:#515257; } }
`;

export default function WalletsPage({ onBack }: WalletsPageProps) {
  const [walletId, setWalletId] = useState('');
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [reconciling, setReconciling] = useState(false);
  const [error, setError] = useState('');
  const [reconciliation, setReconciliation] = useState<Reconciliation | null>(
    null,
  );
  const [createOpen, setCreateOpen] = useState(false);
  const [playerId, setPlayerId] = useState('');
  const [initialAmount, setInitialAmount] = useState('100.00');
  const [currency, setCurrency] = useState('BRL');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const [createdId, setCreatedId] = useState('');

  useEffect(() => {
    if (!createOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !creating) setCreateOpen(false);
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [createOpen, creating]);

  async function loadWallet(id: string) {
    const normalizedId = id.trim();
    if (!normalizedId) {
      setError('Digite o ID da carteira.');
      return;
    }

    setLoading(true);
    setError('');
    setWallet(null);
    setEntries([]);
    setNextCursor(null);
    setReconciliation(null);

    try {
      const [walletResult, ledgerResult] = await Promise.all([
        getWallet(normalizedId),
        getWalletLedger(normalizedId),
      ]);
      setWallet(walletResult);
      setWalletId(walletResult.id);
      setEntries(ledgerResult.entries);
      setNextCursor(ledgerResult.nextCursor);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Não foi possível consultar a carteira.',
      );
    } finally {
      setLoading(false);
    }
  }

  async function searchWallet(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await loadWallet(walletId);
  }

  async function loadMore() {
    if (!wallet || !nextCursor || loadingMore) return;

    setLoadingMore(true);
    setError('');

    try {
      const page = await getWalletLedger(wallet.id, nextCursor);
      setEntries((current) => [...current, ...page.entries]);
      setNextCursor(page.nextCursor);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Não foi possível carregar mais lançamentos.',
      );
    } finally {
      setLoadingMore(false);
    }
  }

  async function runReconciliation() {
    if (!wallet || reconciling) return;

    setReconciling(true);
    setError('');
    setReconciliation(null);

    try {
      setReconciliation(await reconcileWallet(wallet.id));
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Não foi possível reconciliar a carteira.',
      );
    } finally {
      setReconciling(false);
    }
  }

  async function submitNewWallet(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreateError('');
    setCreatedId('');

    const player = playerId.trim();
    const amount = initialAmount.trim();

    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        player,
      )
    ) {
      setCreateError('Informe um UUID válido para o jogador.');
      return;
    }

    if (!/^\d+(\.\d{1,2})?$/.test(amount)) {
      setCreateError('Informe um valor com até duas casas decimais.');
      return;
    }

    setCreating(true);

    try {
      const created = await createWallet({
        playerId: player,
        initialBalance: { amount, currency },
      });
      setCreatedId(created.id);
      setWalletId(created.id);
      await loadWallet(created.id);
      setCreateOpen(false);
      setPlayerId('');
      setInitialAmount('100.00');
      setCurrency('BRL');
    } catch (requestError) {
      setCreateError(
        requestError instanceof Error
          ? requestError.message
          : 'Não foi possível criar a carteira.',
      );
    } finally {
      setCreating(false);
    }
  }

  return (
    <section className="wallet-page">
      <style>{styles}</style>

      <button className="wallet-back" type="button" onClick={onBack}>
        ← <span>Visão geral</span>
      </button>

      <div className="wallet-title-row">
        <div>
          <div className="eyebrow">CARTEIRAS</div>
          <h1>Encontre uma carteira</h1>
          <p className="page-description">
            Consulte saldo, lançamentos e integridade do ledger.
          </p>
        </div>
        <button
          className="wallet-create-button"
          type="button"
          onClick={() => {
            setCreateError('');
            setCreatedId('');
            setCreateOpen(true);
          }}
        >
          <span>＋</span> Nova carteira
        </button>
      </div>

      <form className="wallet-search" onSubmit={searchWallet}>
        <input
          aria-label="ID da carteira"
          type="text"
          placeholder="Cole o UUID da carteira"
          value={walletId}
          onChange={(event) => setWalletId(event.target.value)}
          autoComplete="off"
        />
        <button type="submit" disabled={loading}>
          {loading ? 'Consultando…' : 'Consultar'}
        </button>
      </form>

      {error && (
        <div className="wallet-alert" role="alert">
          {error}
        </div>
      )}

      {!wallet && !loading && (
        <section className="panel">
          <div className="empty-state">
            <span className="empty-icon">◉</span>
            <strong>Consulte ou crie uma carteira</strong>
            <p>
              Insira um ID existente ou crie uma carteira para começar a
              explorar saldo e lançamentos.
            </p>
          </div>
        </section>
      )}

      {wallet && (
        <>
          <div className="wallet-summary">
            <article className="wallet-summary-card">
              <div className="wallet-summary-label">Saldo disponível</div>
              <div className="wallet-summary-value">
                {formatMoney(wallet.balance)}
              </div>
            </article>
            <article className="wallet-summary-card">
              <div className="wallet-summary-label">Jogador</div>
              <div className="wallet-summary-value">{wallet.playerId}</div>
            </article>
            <article className="wallet-summary-card">
              <div className="wallet-summary-label">
                Criada em · versão {wallet.version}
              </div>
              <div className="wallet-summary-value">
                {formatDate(wallet.createdAt)}
              </div>
            </article>
          </div>

          {reconciliation && (
            <div
              className={
                reconciliation.consistent
                  ? 'wallet-form-success'
                  : 'wallet-alert'
              }
              role="status"
              style={{ marginBottom: 14 }}
            >
              {reconciliation.consistent
                ? `Ledger consistente. ${reconciliation.checkedEntries} lançamento(s) conferidos.`
                : `Divergência encontrada: saldo armazenado ${formatMoney(reconciliation.storedBalance)}; saldo calculado ${formatMoney(reconciliation.calculatedBalance)}.`}
            </div>
          )}

          <section className="wallet-ledger">
            <div className="wallet-ledger-head">
              <div>
                <h2>Histórico da carteira</h2>
                <p>
                  Mais recentes primeiro · {entries.length} lançamento(s) nesta
                  página
                </p>
              </div>
              <div className="wallet-toolbar">
                <button
                  type="button"
                  onClick={() => void loadWallet(wallet.id)}
                >
                  Atualizar
                </button>
                <button
                  type="button"
                  onClick={() => void runReconciliation()}
                  disabled={reconciling}
                >
                  {reconciling ? 'Conferindo…' : 'Reconciliar saldo'}
                </button>
              </div>
            </div>

            {entries.length === 0 ? (
              <div className="wallet-empty">
                Esta carteira ainda não tem lançamentos no ledger.
              </div>
            ) : (
              <div className="wallet-table-wrap">
                <table className="wallet-table">
                  <thead>
                    <tr>
                      <th>Data</th>
                      <th>Movimento</th>
                      <th>Valor</th>
                      <th>Saldo anterior</th>
                      <th>Saldo final</th>
                      <th>Transação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {entries.map((entry) => {
                      const debit = entry.direction.toUpperCase() === 'DEBIT';

                      return (
                        <tr key={entry.id}>
                          <td>{formatDate(entry.createdAt)}</td>
                          <td>
                            <span
                              className={`wallet-direction${debit ? ' debit' : ''}`}
                            >
                              {debit ? '− Débito' : '+ Crédito'}
                            </span>
                          </td>
                          <td className="amount">{formatMoney(entry.money)}</td>
                          <td>{formatMoney(entry.balanceBefore)}</td>
                          <td>{formatMoney(entry.balanceAfter)}</td>
                          <td title={entry.transactionId}>
                            {entry.transactionId.slice(0, 8)}…
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {nextCursor && (
              <button
                className="wallet-more"
                type="button"
                onClick={() => void loadMore()}
                disabled={loadingMore}
              >
                {loadingMore
                  ? 'Carregando…'
                  : 'Carregar lançamentos anteriores'}
              </button>
            )}
          </section>
        </>
      )}

      {createOpen && (
        <div
          className="wallet-scrim"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !creating) {
              setCreateOpen(false);
            }
          }}
        >
          <section
            className="wallet-sheet"
            role="dialog"
            aria-modal="true"
            aria-labelledby="wallet-sheet-title"
          >
            <div className="wallet-sheet-head">
              <div>
                <div className="eyebrow">NOVA CARTEIRA</div>
                <h2 id="wallet-sheet-title">Criar carteira</h2>
                <p>
                  O saldo inicial será registrado como lançamento de abertura.
                </p>
              </div>
              <button
                className="wallet-sheet-close"
                type="button"
                onClick={() => setCreateOpen(false)}
                disabled={creating}
                aria-label="Fechar"
              >
                ×
              </button>
            </div>

            <form className="wallet-form" onSubmit={submitNewWallet}>
              <div className="wallet-field">
                <label htmlFor="wallet-player-id">ID do jogador</label>
                <input
                  id="wallet-player-id"
                  value={playerId}
                  onChange={(event) => setPlayerId(event.target.value)}
                  placeholder="UUID do jogador"
                  autoComplete="off"
                  required
                />
                <small>
                  Use um UUID válido, por exemplo o identificador do seu
                  sistema.
                </small>
              </div>

              <div className="wallet-field">
                <label htmlFor="wallet-initial-balance">Saldo inicial</label>
                <div className="wallet-money-fields">
                  <input
                    id="wallet-initial-balance"
                    inputMode="decimal"
                    value={initialAmount}
                    onChange={(event) => setInitialAmount(event.target.value)}
                    placeholder="100.00"
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
                <small>Valor decimal com até duas casas.</small>
              </div>

              {createError && (
                <div className="wallet-form-error" role="alert">
                  {createError}
                </div>
              )}

              {createdId && (
                <div className="wallet-form-success" role="status">
                  Carteira criada: {createdId}
                </div>
              )}

              <div className="wallet-form-actions">
                <button
                  className="wallet-cancel"
                  type="button"
                  onClick={() => setCreateOpen(false)}
                  disabled={creating}
                >
                  Cancelar
                </button>
                <button
                  className="wallet-submit"
                  type="submit"
                  disabled={creating}
                >
                  {creating ? 'Criando…' : 'Criar carteira'}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </section>
  );
}
