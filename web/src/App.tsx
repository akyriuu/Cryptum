import { useEffect, useState } from 'react';
import './App.css';
import WalletsPage from './WalletsPage';
import { checkApiHealth } from './api';

type ApiStatus = 'checking' | 'online' | 'offline';
type Page = 'overview' | 'wallets';

const navigation = [
  { icon: '▦', label: 'Visão geral', page: 'overview' as const },
  { icon: '◉', label: 'Carteiras', page: 'wallets' as const },
  { icon: '↔', label: 'Transações', page: null },
  { icon: '◎', label: 'Reconciliação', page: null },
];

function App() {
  const [apiStatus, setApiStatus] = useState<ApiStatus>('checking');
  const [page, setPage] = useState<Page>('overview');

  useEffect(() => {
    const checkApi = async () => {
      setApiStatus((await checkApiHealth()) ? 'online' : 'offline');
    };

    void checkApi();
    const interval = window.setInterval(checkApi, 15000);

    return () => window.clearInterval(interval);
  }, []);

  const statusLabel = {
    checking: 'Verificando conexão',
    online: 'API conectada',
    offline: 'API indisponível',
  }[apiStatus];

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <button
          className="brand"
          type="button"
          onClick={() => setPage('overview')}
          aria-label="Ir para a visão geral"
        >
          <span className="brand-mark">C</span>
          <span>Cryptum</span>
        </button>

        <div className="workspace-label">ESPAÇO DE TRABALHO</div>
        <button className="workspace-switcher" type="button">
          <span className="workspace-avatar">D</span>
          <span className="workspace-copy">
            <strong>Demo workspace</strong>
            <small>Ambiente local</small>
          </span>
          <span className="switcher-chevron">⌄</span>
        </button>

        <div className="nav-label">OPERAÇÃO</div>
        <nav className="navigation" aria-label="Navegação principal">
          {navigation.map((item) => {
            const active = item.page === page;

            return item.page ? (
              <button
                className={`nav-item${active ? ' active' : ''}`}
                key={item.label}
                type="button"
                onClick={() => setPage(item.page!)}
                aria-current={active ? 'page' : undefined}
              >
                <span className="nav-icon">{item.icon}</span>
                <span>{item.label}</span>
              </button>
            ) : (
              <div
                className="nav-item disabled"
                key={item.label}
                aria-disabled="true"
              >
                <span className="nav-icon">{item.icon}</span>
                <span>{item.label}</span>
                <span className="nav-soon">em breve</span>
              </div>
            );
          })}
        </nav>

        <div className="sidebar-bottom">
          <a className="help-link" href="mailto:suporte@exemplo.com">
            <span className="help-icon">?</span>
            Ajuda e suporte
          </a>
          <div className="user-card">
            <span className="user-avatar">MC</span>
            <span className="user-copy">
              <strong>Minha conta</strong>
              <small>Administrador</small>
            </span>
            <span className="user-more">···</span>
          </div>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div className="breadcrumb">
            <span>Demo workspace</span>
            <span className="breadcrumb-divider">/</span>
            <strong>{page === 'overview' ? 'Visão geral' : 'Carteiras'}</strong>
          </div>

          <div className={`connection-status ${apiStatus}`}>
            <span className="status-dot" />
            {statusLabel}
          </div>
        </header>

        <div className="page-content">
          {page === 'wallets' ? (
            <WalletsPage onBack={() => setPage('overview')} />
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
                  <span>＋</span>
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
                    <span className={`status-dot ${apiStatus}`} />
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
                    <span className="empty-icon">↔</span>
                    <strong>Consulte uma carteira para ver o ledger</strong>
                    <p>
                      O histórico detalhado está disponível ao abrir uma
                      carteira.
                    </p>
                    <button
                      className="quiet-button"
                      type="button"
                      onClick={() => setPage('wallets')}
                    >
                      Ir para carteiras <span>→</span>
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
                      <span className="service-icon">A</span>
                      API
                    </span>
                    <span className={`health-label ${apiStatus}`}>
                      {statusLabel}
                    </span>
                  </div>
                  <div className="health-row">
                    <span className="health-name">
                      <span className="service-icon database">▤</span>
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
                <span className="callout-icon">◉</span>
                <span className="callout-copy">
                  <strong>Precisa investigar uma carteira?</strong>
                  <small>
                    Consulte o saldo e percorra os lançamentos do ledger.
                  </small>
                </span>
                <span className="callout-arrow">→</span>
              </button>
            </>
          )}

          <footer className="page-footer">
            <span>
              Cryptum <span className="footer-version">Painel local</span>
            </span>
            <span>Dados servidos pela API local</span>
          </footer>
        </div>
      </main>
    </div>
  );
}

export default App;
