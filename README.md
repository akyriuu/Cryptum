# Technical Challenge — Distributed Wagering Processor
 

Serviço financeiro distribuído que processa transações de apostas vindas de
múltiplos provedores, por HTTP e por fila, com garantias de correção monetária,
idempotência persistente e consistência entre saldo materializado e ledger.

As decisões técnicas, com alternativas descartadas e limitações conhecidas, estão
em [`ARCHITECTURE.md`](./docs/ARCHITECTURE.md).

## Stack

Bun 1.3 como runtime, gerenciador de pacotes e test runner. NestJS 11,
TypeScript em modo estrito, PostgreSQL 17 com MikroORM 7, AWS SQS emulado por
LocalStack, tudo orquestrado por Docker Compose.

## Subir do zero

```bash
cp .env.example .env
docker compose up -d --wait
bun install
bun run migration:up
bun run start:dev
```

A aplicação sobe em `http://localhost:3000`. O Postgres publica a porta **2004**
do host para evitar conflito com instalações locais na 5432.

Verificação rápida:

```bash
curl http://localhost:3000/health/ready
```

## Comandos

| Comando | O que faz |
|---|---|
| `bun run start:dev` | Sobe a aplicação com recarga automática |
| `bun run check` | Tipos, lint, guarda de migrations e testes unitários |
| `bun run test` | Apenas os testes unitários, sem infraestrutura |
| `bun run test:integration` | Integração e concorrência, exige Docker no ar |
| `bun run migration:up` / `:down` / `:list` | Migrations versionadas e reversíveis |
| `bun run check:migrations` | Falha se algum tipo de ponto flutuante aparecer numa migration |
| `bun run format` | Prettier |

Antes de rodar `test:integration`, **pare a aplicação** ou use
`CONSUMER_ENABLED=false`: o consumidor do processo disputa mensagens com o dos
testes.

## API

### Criar carteira

```http
POST /wallets
Content-Type: application/json

{
  "playerId": "0192f28f-5dc0-7d58-bdb2-814ad6a0f4a1",
  "initialBalance": { "amount": "1000.00", "currency": "BRL" }
}
```

O saldo inicial gera uma transação interna `OPENING` com lançamento `CREDIT` na
mesma transação SQL.

### Submeter transação

```http
POST /wagering/transactions
Idempotency-Key: provider-a:transaction-123
Content-Type: application/json

{
  "providerId": "provider-a",
  "externalTransactionId": "transaction-123",
  "playerId": "0192f28f-5dc0-7d58-bdb2-814ad6a0f4a1",
  "walletId": "0192f291-27dd-7d3f-8071-5f8685deef37",
  "roundId": "round-987",
  "gameId": "fortune-chimp",
  "kind": "BET",
  "money": { "amount": "25.00", "currency": "BRL" }
}
```

O header `Idempotency-Key` é obrigatório e é a fonte da verdade. O `payloadHash`
é o SHA-256 de um JSON canônico dos campos de negócio, com o valor monetário
normalizado para escala 2 — `"25.0"` e `"25.00"` descrevem a mesma operação.

### Reconciliação

```http
POST /wallets/{walletId}/reconciliation
```

Compara saldo materializado com a reconstrução do ledger. Divergências são
logadas e contabilizadas, nunca corrigidas.

### Observabilidade

```http
GET /health/live     # processo vivo, não consulta dependências
GET /health/ready    # PostgreSQL e SQS alcançáveis
GET /metrics         # formato de exposição do Prometheus
```

## Status HTTP

| Situação | Código |
|---|---|
| Sucesso, incluindo replay idempotente | 200 |
| Carteira criada | 201 |
| Aceita, aguardando a transação referenciada | 202 |
| Payload inválido | 400 |
| Recurso inexistente | 404 |
| Conflito de idempotência ou carteira duplicada | 409 |
| Rejeição por regra de negócio, com `failureCode` | 422 |

## Filas

| Fila | Papel |
|---|---|
| `wager-transactions.fifo` | Entrada de transações, com DLQ após 5 entregas |
| `wager-events.fifo` | Eventos de integração publicados pelo outbox |

Mensagens são agrupadas por carteira, preservando ordem por carteira sem
serializar carteiras distintas. A deduplicação por conteúdo está desligada de
propósito: a garantia é o inbox persistente, não o broker.

## Autenticação

Não implementada, conforme permitido pela seção 2 do enunciado. O desenho
adotado e o ponto de extensão estão documentados no `ARCHITECTURE.md`.

### Consultas

```http
GET /wallets/{walletId}
GET /wallets/{walletId}/ledger?cursor=...&limit=50
GET /wagering/transactions/{transactionId}
GET /providers/{providerId}/wagering/transactions/{externalTransactionId}
```

O ledger é paginado por cursor opaco, com `limit` entre 1 e 100 e padrão 50. A
resposta traz `entries` e `nextCursor`, que é `null` na última página.
