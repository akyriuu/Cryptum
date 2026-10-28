import { useEffect, useState } from 'react';
import './App.css';
import ReconciliationPage from './ReconciliationPage';
import TransactionsPage from './TransactionsPage';
import WalletsPage from './WalletsPage';
import { checkApiHealth } from './api';

type ApiStatus = 'checking' | 'online' | 'offline';
type Page = 'overview' | 'wallets' | 'transactions' | 'reconciliation';

const navigation = [
  { icon: '▦', label: 'Visão geral', page: 'overview' as const },
  { icon: '◉', label: 'Carteiras', page: 'wallets' as const },
  { icon: '↔', label: 'Transações', page: 'transactions' as const },
  { icon: '◎', label: 'Reconciliação', page: 'reconciliation' as const },
];

function App() {
  const [apiStatus, setApiStatus] = useState<ApiStatus>('checking');
  const [page, setPage] = useState<Page>('overview');

  useEffect(() => {
    const checkApi = async () => {
      setApiStatus((await checkApiHealth()) ? 'online' : 'offline');
    };

    void checkApi();

    const interval = window.setInterval(() => {
      void checkApi();
    }, 15000);

    return () => window.clearInterval(interval);
  }, []);

  const statusLabel = {
    checking: 'Verificando conexão',
    online: 'API conectada',
    offline: 'API indisponível',
  }[apiStatus];

  const pageLabel = {
    overview: 'Visão geral',
    wallets: 'Carteiras',
    transactions: 'Transações',
    reconciliation: 'Reconciliação',
  }[page];

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <button
          className="brand"
          type="button"
          onClick={() => setPage('overview')}
          aria-label="Ir para a visão geral do CRYPTUM"
        >
          <img className="brand-logo" src="/cryptum-logo.svg" alt="CRYPTUM" />
        </button>

        <div className="workspace-label">ESPAÇO DE TRABALHO</div>

        <button className="workspace-switcher" type="button">
          <span className="workspace-avatar">C</span>

          <span className="workspace-copy">
            <strong>CRYPTUM</strong>
            <small>Ambiente local</small>
          </span>

          <span className="switcher-chevron">⌄</span>
        </button>

        <div className="nav-label">OPERAÇÃO</div>

        <nav className="navigation" aria-label="Navegação principal">
          {navigation.map((item) => {
            const active = item.page === page;

            return (
              <button
                className={`nav-item${active ? ' active' : ''}`}
                key={item.label}
                type="button"
                onClick={() => setPage(item.page)}
                aria-current={active ? 'page' : undefined}
              >
                <span className="nav-icon" aria-hidden="true">
                  {item.icon}
                </span>
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="sidebar-bottom">
          <a className="help-link" href="mailto:suporte@exemplo.com">
            <span className="help-icon" aria-hidden="true">
              ?
            </span>
            Ajuda e suporte
          </a>

          <div className="user-card">
            <span className="user-avatar">MC</span>

            <span className="user-copy">
              <strong>Minha conta</strong>
              <small>Administrador</small>
            </span>

            <span className="user-more" aria-hidden="true">
              ···
            </span>
          </div>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div className="breadcrumb">
            <span>CRYPTUM</span>
            <span className="breadcrumb-divider" aria-hidden="true">
              /
            </span>
            <strong>{pageLabel}</strong>
          </div>

          <div className={`connection-status ${apiStatus}`}>
            <span className="status-dot" aria-hidden="true" />
            {statusLabel}
          </div>
        </header>

        <div className="page-content">
          {page === 'wallets' ? (
            <WalletsPage onBack={() => setPage('overview')} />
          ) : page === 'transactions' ? (
            <TransactionsPage onBack={() => setPage('overview')} />
          ) : page === 'reconciliation' ? (
            <ReconciliationPage onBack={() => setPage('overview')} />
          ) : (
            <>
              <section className="page-heading">
                <div>
                  <div className="eyebrow">OPERAÇÃO DA CARTEIRA</div>
                  <h1>Visão geral</h1>
                  <p className="page-description">
                    Uma visão clara do estado da sua operação.
                  </p>
                </div>

                <button
                  className="primary-button"
                  type="button"
                  onClick={() => setPage('wallets')}
                >
                  <span aria-hidden="true">＋</span>
                  Explorar carteiras
                </button>
              </section>

              <section className="metrics-grid" aria-label="Indicadores">
                <article className="metric-card">
                  <div className="metric-label">Saldo em carteiras</div>
                  <div className="metric-value">—</div>
                  <div className="metric-note">
                    Resumo agregado indisponível
                  </div>
                </article>

                <article className="metric-card">
                  <div className="metric-label">Transações hoje</div>
                  <div className="metric-value">—</div>
                  <div className="metric-note">
                    Aguardando endpoint de listagem
                  </div>
                </article>

                <article className="metric-card">
                  <div className="metric-label">Pendências</div>
                  <div className="metric-value">—</div>
                  <div className="metric-note">
                    Aguardando endpoint de listagem
                  </div>
                </article>

                <article className="metric-card">
                  <div className="metric-label">Estado da API</div>
                  <div className="metric-value metric-status">
                    <span
                      className={`status-dot ${apiStatus}`}
                      aria-hidden="true"
                    />
                    {apiStatus === 'online'
                      ? 'Conectada'
                      : apiStatus === 'offline'
                        ? 'Indisponível'
                        : 'Verificando'}
                  </div>
                  <div className="metric-note">Checagem automática</div>
                </article>
              </section>

              <section className="content-grid">
                <article className="panel activity-panel">
                  <div className="panel-heading">
                    <div>
                      <h2>Atividade recente</h2>
                      <p>Movimentações registradas nas carteiras</p>
                    </div>
                  </div>

                  <div className="empty-state">
                    <span className="empty-icon" aria-hidden="true">
                      ↔
                    </span>

                    <strong>Consulte uma transação ou carteira</strong>

                    <p>
                      Consulte uma operação pela referência externa ou abra o
                      ledger de uma carteira.
                    </p>

                    <button
                      className="quiet-button"
                      type="button"
                      onClick={() => setPage('transactions')}
                    >
                      Consultar transações <span aria-hidden="true">→</span>
                    </button>
                  </div>
                </article>

                <article className="panel health-panel">
                  <div className="panel-heading">
                    <div>
                      <h2>Serviços</h2>
                      <p>Estado reportado pela API</p>
                    </div>
                  </div>

                  <div className="health-row">
                    <span className="health-name">
                      <span className="service-icon" aria-hidden="true">
                        A
                      </span>
                      API
                    </span>

                    <span className={`health-label ${apiStatus}`}>
                      {statusLabel}
                    </span>
                  </div>

                  <div className="health-row">
                    <span className="health-name">
                      <span
                        className="service-icon database"
                        aria-hidden="true"
                      >
                        ▤
                      </span>
                      Banco e fila
                    </span>

                    <span className="health-label">Health check</span>
                  </div>

                  <p className="health-note">
                    Atualizado automaticamente a cada 15 segundos.
                  </p>
                </article>
              </section>

              <button
                className="wallet-callout"
                type="button"
                onClick={() => setPage('wallets')}
              >
                <span className="callout-icon" aria-hidden="true">
                  ◉
                </span>

                <span className="callout-copy">
                  <strong>Precisa investigar uma carteira?</strong>
                  <small>
                    Consulte saldo e lançamentos registrados no ledger.
                  </small>
                </span>

                <span className="callout-arrow" aria-hidden="true">
                  →
                </span>
              </button>
            </>
          )}

          <footer className="page-footer">
            <span>
              CRYPTUM <span className="footer-version">Painel local</span>
            </span>
            <span>Dados servidos pela API local</span>
          </footer>
        </div>
      </main>
    </div>
  );
}

export default App;
