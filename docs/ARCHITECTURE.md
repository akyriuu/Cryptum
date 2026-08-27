# Arquitetura

Este documento registra as decisões técnicas do projeto no momento em que foram
tomadas, junto com os trade-offs aceitos e as limitações conhecidas. Cada decisão
descreve o contexto, a escolha, suas consequências e a alternativa descartada.

## Fundação: runtime, compilação e testes


### 0. AUTENTICAÇÃO NÃO FOI IMPLEMENTADA. (Ponto de extensão expllícito)

### 37. Autenticação não implementada, com ponto de extensão explícito
**Contexto.** A seção 2 do enunciado afirma que autenticação não pontua na tabela
de avaliação e permite explicitamente não implementá-la, desde que a decisão
esteja documentada, o desenho descrito e o ponto de extensão visível no código.


**Decisão.** Não implementada. O tempo foi direcionado para correção financeira,
concorrência, idempotência e mensageria, que somam 70 dos 100 pontos.


**Desenho que seria adotado.** Keycloak subindo no mesmo `docker-compose.yml`,
com um *client* por provedor no fluxo *client credentials*. Cada provedor
obteria um token de acesso e o enviaria em `Authorization: Bearer`. O serviço
validaria a assinatura contra o JWKS do realm, com cache das chaves, e extrairia
o identificador do provedor de uma claim dedicada — não do corpo da requisição.
O escopo `wagering:write` autorizaria a submissão de transações; as consultas
exigiriam `wagering:read`. Nada disso encostaria em caso de uso ou domínio.
Keycloak em vez de autenticação artesanal porque o enunciado é explícito ao
recusar tabela própria de usuários com hash de senha, e porque rotação de chaves,
expiração e revogação são exatamente o tipo de coisa que se implementa mal
quando se implementa à mão.


**Ponto de extensão.** `ProviderIdentityResolver`, em
`src/api/auth/provider-identity.ts`, é a porta. A implementação atual,
`TrustedPayloadIdentityResolver`, aceita o `providerId` declarado no corpo sem
verificar nada. Trocar essa classe por um resolvedor que valide JWT é a única
alteração necessária: nenhum controller, caso de uso ou regra de domínio muda.


**O guard não é decorativo.** `ProviderAuthGuard` já exige que o `providerId` do
corpo coincida com a identidade resolvida, respondendo 403 quando divergem. Com o
resolvedor permissivo isso é tautologia — mas o caminho de código existe, testado
pelo fluxo normal, e passa a ser a barreira que impede um provedor de submeter
transações em nome de outro no instante em que um Identity Provider real for
plugado.


**Escopo do que a autenticação não cobre.** Health checks e `/metrics` ficam
abertos, como a seção 2 determina. Mensagens vindas da fila são tratadas como
canal interno confiável — mas a identidade do provedor contida na mensagem
continua sujeita às mesmas validações de domínio: a resolução de referência
compara `providerId`, e uma reversão que aponte para transação de outro provedor
é rejeitada com `REFERENCE_MISMATCH`, autenticada ou não.

### 1. O Bun é o runtime; o TypeScript é apenas verificador de tipos

**Contexto.** O scaffold do NestJS compila com `tsc` para `dist/` e executa o
resultado com `node dist/main`. Nessa configuração o Bun atuava apenas como
executor de scripts do `package.json` — o processo da aplicação era Node. A stack
obrigatória do desafio define Bun 1.x como runtime.

**Decisão.** A aplicação é executada diretamente pelo Bun (`bun run src/main.ts`),
sem etapa de build. O `tsc` permanece no projeto exclusivamente como verificador
(`tsc --noEmit`), exposto no script `typecheck` e agregado ao script `check`.

**Consequência.** O Bun transpila TypeScript sem verificar tipos, então a
verificação deixa de ser automática e passa a ser um portão explícito. Divergências
de tipo que o runtime tolera só são detectadas se `bun run typecheck` for executado
— por isso ele é o primeiro comando do `check` e precisa fazer parte do CI. Em
contrapartida, desaparecem `dist/`, o cache incremental e toda a classe de falhas
associada a artefatos de build dessincronizados.

**Alternativa descartada.** Manter `nest build` com `node dist/main`, que é o
caminho convencional do Nest e traz verificação de tipos embutida no ciclo de
desenvolvimento, mas descumpre a stack obrigatória.

### 2. Decorators legados protegidos por teste de regressão

**Contexto.** O NestJS depende de decorators legados (`experimentalDecorators`) e
de metadados de reflexão (`emitDecoratorMetadata`) para injeção de dependência. A
partir do Bun 1.3.10 o transpilador passou a emitir decorators no formato TC39, e
há relatos de `experimentalDecorators` sendo ignorado
([oven-sh/bun#27575](https://github.com/oven-sh/bun/issues/27575)) e de falhas na
descoberta de entidades do MikroORM
([mikro-orm/mikro-orm#7381](https://github.com/mikro-orm/mikro-orm/issues/7381)).
A versão em uso é a 1.3.14, dentro dessa janela.

**Decisão.** Ambas as flags permanecem ligadas, e a garantia de que elas funcionam
sob o Bun é verificada por um teste dedicado (`test/toolchain.spec.ts`), que afirma
que `design:paramtypes` de um controller resolve para o serviço injetado.

**Consequência.** Uma premissa de toolchain vira asserção executável. Se uma
atualização do Bun quebrar a emissão de metadados, o teste falha no CI antes que a
injeção de dependência falhe em produção, com uma mensagem que aponta a causa real
em vez de um "Cannot resolve dependency" genérico.

**Limitação conhecida.** A garantia vale para execução direta de TypeScript
(`bun run`), que é o modo adotado. O `bun build` não é usado no projeto justamente
porque é nele que os relatos de quebra se concentram.

### 3. Resolução de módulos alinhada ao comportamento do runtime

**Contexto.** O `tsconfig.json` do scaffold usava `moduleResolution: node`, o
algoritmo legado que antecede o campo `exports` do `package.json` e o ignora. O Bun
honra `exports` ao resolver módulos em runtime. Tipos e execução divergiam, e a
configuração original chegou a produzir erro de compilação ao tentar habilitar
`resolvePackageJsonExports` sobre esse algoritmo.

**Decisão.** `module: Preserve` com `moduleResolution: bundler` e `noEmit: true`.

**Consequência.** O TypeScript passa a resolver tipos pelo mesmo critério que o Bun
usa para resolver código, o que evita divergências em pacotes modernos publicados
apenas com mapa de `exports`. As opções ligadas à emissão (`outDir`, `rootDir`,
`declaration`, `sourceMap`, `incremental`) foram removidas por terem deixado de ter
efeito, assim como o `tsconfig.build.json`.

### 4. `verbatimModuleSyntax` deliberadamente desabilitado

**Contexto.** A configuração recomendada pelo Bun inclui `verbatimModuleSyntax`.

**Decisão.** A opção não é usada.

**Justificativa.** Com ela ativa, o TypeScript exige `import type` para importações
usadas apenas em posição de tipo — e o tipo de um parâmetro de construtor tem essa
aparência. Como `import type` é apagado na transpilação, o valor deixa de existir
em runtime e `emitDecoratorMetadata` passa a registrar `Object` no lugar da classe,
quebrando a injeção de dependência do Nest com um erro que aparece só no boot.
O ganho de explicitude não compensa esse risco num projeto baseado em decorators.

### 5. Modo estrito com verificação de acesso indexado

**Contexto.** O scaffold desliga `noImplicitAny` e `strictBindCallApply`, e liga
apenas `strictNullChecks`. O desafio exige TypeScript em modo estrito.

**Decisão.** `strict: true`, acrescido de `noUncheckedIndexedAccess` e
`noImplicitOverride`.

**Consequência.** `noUncheckedIndexedAccess` obriga a tratar acesso indexado como
possivelmente indefinido. Em código que reconstrói saldo a partir de coleções de
lançamentos, isso força a lidar explicitamente com coleções vazias, que é
exatamente onde erros de reconciliação costumam se esconder.

### 6. `bun test` como test runner, sem camada de transpilação intermediária

**Contexto.** O scaffold trazia Jest, `ts-jest`, `@types/jest` e `supertest`. A
stack obrigatória define o Bun como test runner.

**Decisão.** Jest e `ts-jest` foram removidos e os testes rodam em `bun test`. Os
arquivos de teste importam `describe`, `it` e `expect` explicitamente de `bun:test`
em vez de depender de globais.

**Consequências e armadilhas registradas.**

- `@types/jest` foi desinstalado porque seus globais colidem com os do `@types/bun`.
  Como o TypeScript 6 deixou de descobrir pacotes `@types/*` automaticamente, o
  `tsconfig.json` declara `types: ["bun", "node"]` de forma explícita.
- O Bun descobre testes pelos padrões `*.test.ts`, `*_test.ts`, `*.spec.ts` e
  `*_spec.ts`. O nome `app.e2e-spec.ts`, herdado do Jest, não casa com nenhum deles
  e era silenciosamente ignorado. Os arquivos foram renomeados para `*.spec.ts`.
  Uma suíte que não roda é indistinguível de uma suíte que passa, então a contagem
  de arquivos no resultado do `bun test` é verificada a cada execução.
- O `supertest` foi substituído por um servidor real (`app.listen(0)`) consumido
  via `fetch`. Além de remover uma dependência, isso aproxima o teste de ponta a
  ponta do cenário que os testes de concorrência vão exigir mais adiante, com
  múltiplas instâncias atendendo em portas distintas.

### 7. Separação entre suítes que dependem de infraestrutura e as que não dependem

**Decisão.** O script `test` executa apenas testes unitários e de ponta a ponta
em processo, sem dependências externas. Testes que exigem contêineres ficam em
`test/integration` e são executados por `test:integration`, com timeout ampliado.

**Justificativa.** Mantém o ciclo de feedback local rápido e sem pré-requisitos,
enquanto preserva a exigência do desafio de que PostgreSQL e SQS reais sejam
usados nos testes de integração — sem que uma coisa bloqueie a outra.


--------------------------------------------------------------------------------------


## Persistência: ORM, mapeamento e representação de dinheiro

As decisões desta seção foram validadas por um spike executável antes de
qualquer modelagem de domínio (`test/integration/orm.spike.spec.ts`), com
Bun 1.3.14, MikroORM 7.1.12, driver `pg` e PostgreSQL 17.

### 8. Agregados de domínio mapeados por modelo de persistência e mapper explícito

**Contexto.** O desafio indica o MikroORM como opção preferencial pelo Unit of
Work, Identity Map, `em.transactional()` e `LockMode` explícitos. Ao mesmo tempo,
o modelo de domínio exige construtor privado com factories `create` e `rehydrate`,
sendo que a reidratação a partir do banco deve passar por `rehydrate`. A
documentação do MikroORM afirma que construtores nunca são executados para
entidades gerenciadas — a hidratação ocorre via `Object.create` seguida de
atribuição direta de propriedades. Mapear o agregado diretamente tornaria a
factory `rehydrate` letra morta. O padrão `defineEntity + class` da v7 agrava o
problema, pois exige que o agregado herde de uma classe base gerada pelo ORM.

**Decisão.** As entidades registradas no ORM são modelos de persistência anônimos,
definidos por `defineEntity` sem classe de domínio associada. Os repositórios
traduzem explicitamente entre o registro e o agregado, chamando `Wallet.rehydrate`
na leitura e projetando o estado do agregado na escrita. O domínio não importa
nada de `@mikro-orm/*`.

**Consequência.** A reidratação passa de fato pela factory, e o domínio permanece
testável sem banco, sem contêiner e sem metadados de ORM. Perde-se o rastreamento
automático de alterações sobre o agregado — o que aqui é desejável: as escritas
financeiras precisam ser SQL explícito e determinístico (atualização condicionada
à versão, ou leitura sob `for update`), e não o resultado de uma inferência do
Unit of Work sobre campos privados. Continuam em uso `em.transactional()` para
demarcação de transação e `LockMode` para bloqueio.

**Custo aceito.** Um mapper manual por agregado, com o risco de divergência entre
o registro e o domínio quando um campo novo é adicionado. Mitigado por testes de
ida e volta que comparam o agregado reidratado com o original.

**Alternativa descartada.** Anotar o agregado diretamente como entidade. Economiza
o mapper, mas silencia as factories, expõe os campos privados à manipulação do
ORM e acopla o núcleo do sistema ao framework de persistência.

### 9. Dinheiro em `numeric(20,2)`, transportado como string em todas as fronteiras

**Contexto.** O desafio proíbe `number`, `float` e `double` para dinheiro, e exige
escala fixa de duas casas com representação exata na persistência.

**Decisão.** A coluna é `numeric(20,2)`. O `DecimalType` do MikroORM faz o
mapeamento, e seu comportamento padrão — devolver `string` em vez de `number`,
justamente para não perder precisão — é fixado no nível de tipos com
`p.type(t.decimal).$type<string>()`. O valor em runtime é encapsulado por `Money`,
implementado sobre `decimal.js`. Valor e moeda ocupam colunas separadas e são
recompostos como `Money` na reidratação.

**Consequência.** Nenhum valor monetário existe como ponto flutuante em ponto
algum do caminho: string no banco, string no driver, `Decimal` dentro de `Money`,
string na serialização. O anotação `$type<string>()` não muda comportamento — o
valor já vinha como string — mas transforma uma futura troca para o mapeamento
numérico em erro de compilação em `Money.from`, em vez de arredondamento
silencioso.

**Evidência.** O spike consulta `information_schema.columns` e afirma que a coluna
é `numeric` com escala 2, verifica que o valor persistido retorna como a string
exata `'1000.00'`, e confirma que `0.10 + 0.20` sobrevive ao ciclo completo de
ida e volta como `'0.30'`.

**Limitação conhecida.** A escala 2 é assumida globalmente. Moedas com escala
diferente — ienes, que não têm casas decimais, ou dinares, que têm três —
exigiriam escala por moeda no schema e no `Money`. Está fora do escopo assumido
(moeda única BRL), mas o modelo permanece multimoeda e os conflitos de moeda são
verificados.

### 10. Bloqueio pessimista por carteira, validado no nível do SQL emitido

**Contexto.** A unidade de concorrência é a carteira, e as garantias precisam
estar no banco, não em recursos de ordenação do broker.

**Decisão.** A estratégia candidata é bloqueio pessimista por linha, com
`em.transactional()` demarcando a transação e `LockMode.PESSIMISTIC_WRITE` na
leitura da carteira, que o driver PostgreSQL traduz para `select ... for update`.
A escolha definitiva entre bloqueio pessimista e atualização condicionada à versão
é fechada junto com o caso de uso de aposta, sob teste de concorrência real.

**Evidência.** O spike captura o SQL emitido pelo logger do ORM dentro de uma
transação e afirma a presença de `for update`. O que está validado aqui é o
mecanismo — que o `LockMode` atravessa o ORM, o driver e o Bun até virar SQL —
não ainda a correção sob concorrência, que depende do teste do cenário obrigatório.

### 11. Spike descartável antes da modelagem

**Contexto.** A combinação Bun 1.3.14, MikroORM v7 e driver `pg` é recente, e há
relatos abertos de instabilidade na emissão de decorators pelo Bun a partir da
versão 1.3.10.

**Decisão.** Antes de escrever qualquer domínio definitivo, um único arquivo de
teste prova quatro premissas: que o ORM inicializa sob o Bun, que o driver conecta
ao PostgreSQL, que decimais atravessam o mapeamento sem perda, e que o bloqueio
pessimista chega ao banco.

**Consequência.** O arquivo é explicitamente descartável. O domínio embutido nele
é substituído pelo domínio real, e o DDL declarado em linha é substituído por
migrations versionadas com as constraints definitivas. O que permanece é o
registro de quais premissas foram verificadas e como.

**Justificativa.** Uma hora gasta aqui elimina o risco de descobrir na véspera da
entrega que a stack obrigatória não comporta o ORM escolhido — momento em que
trocar de ORM ou de runtime custaria a reescrita da camada de persistência
inteira.

### 12. Ambiente local: porta publicada e ausência de volume

**Contexto.** A máquina de desenvolvimento já possui uma instância de PostgreSQL
ocupando a porta 5432, o que provocava falhas de autenticação difíceis de
interpretar: a aplicação alcançava o servidor errado.

**Decisão.** O contêiner publica a porta 2004 do host apontando para a 5432 do
contêiner, mantendo o PostgreSQL na porta padrão internamente — o que preserva a
comunicação entre contêineres quando o LocalStack e a aplicação entrarem na mesma
rede. O serviço não declara volume nomeado, de modo que recriar o contêiner
reinicializa o cluster.

**Consequência.** O banco local é efêmero por construção, o que favorece testes
determinísticos e elimina estado acumulado entre execuções. A URL de conexão passou a vir de `DATABASE_URL`,
lida em `src/config/env.ts`. O LocalStack entrou na mesma composição, publicando
a porta 4566, e o provisionamento das filas acontece por script de inicialização
em vez de comando manual.



--------------------------------------------------------------------------------------


## Infraestrutura: ambiente local, migrations e sinais de saúde

### 13. Liveness e readiness respondem a perguntas diferentes

**Contexto.** O desafio exige dois health checks. A tentação é implementar os dois
verificando as mesmas dependências e mudar apenas o nome da rota.

**Decisão.** `/health/live` não toca em dependência alguma: responde 200 enquanto
o processo estiver de pé e o event loop respondendo. `/health/ready` consulta
PostgreSQL e SQS e responde 503 se qualquer um deles estiver inacessível.

**Justificativa.** As duas rotas são consumidas por atores distintos com poderes
distintos. O liveness é lido por quem pode **matar e reiniciar** o processo; o
readiness, por quem pode **tirá-lo do balanceador**. Se o liveness verificasse o
banco, uma indisponibilidade do PostgreSQL faria o orquestrador reiniciar em
cascata todas as instâncias saudáveis, transformando uma degradação parcial numa
interrupção total — e ainda por cima destruindo, a cada reinício, o trabalho em
andamento do consumidor e do publisher. Readiness protege o usuário de receber
erro; liveness protege o sistema de um processo travado. Confundir os dois
significa não medir nenhum dos dois.

**Evidência.** O caso `live responde ok mesmo com dependência fora`, em
`src/health/health.controller.spec.ts`, instancia o controller com uma sonda que
falha e ainda assim exige 200. Se alguém acrescentar uma verificação de banco ao
liveness, esse teste fica vermelho imediatamente.

### 14. Sondas independentes, com timeout próprio e diagnóstico por dependência

**Contexto.** O modo mais comum de falha de infraestrutura não é a conexão
recusada — que retorna rápido — e sim a conexão que fica pendurada até o timeout
do sistema operacional, na casa de dezenas de segundos.

**Decisão.** Cada dependência é uma implementação da interface `HealthProbe`,
registrada por um token de injeção (`HEALTH_PROBES`). O controller executa todas
em paralelo, cada uma sob um `Promise.race` com limite de 2 segundos, e compõe
uma resposta que informa o estado e a latência de cada uma individualmente.

**Consequência.** Um readiness que trava é indistinguível de uma aplicação
travada: o orquestrador não recebe resposta e toma a decisão errada. Com o limite
explícito, uma dependência pendurada vira 503 em 2 segundos, com `error: timeout`
identificando qual. O custo é que o limite precisa ser maior que a latência
normal das sondas — se ficar apertado demais, o readiness passa a oscilar sob
carga e a instância entra e sai do balanceador sem motivo.

**Detalhe deliberado.** A sonda de SQS consulta os atributos da fila configurada
em `SQS_QUEUE_URL`, e não a lista de filas. Isso prova duas coisas de uma vez:
que o serviço está alcançável e que a fila que o consumidor vai usar realmente
existe. Um `ListQueues` responderia 200 num ambiente sem fila provisionada.

**Alternativa descartada.** `@nestjs/terminus`, que é a solução idiomática do
Nest e traz indicadores prontos. Foi descartada porque a lógica que importa aqui
— separação entre live e ready, timeout por sonda, formato do diagnóstico — cabe
em cerca de cinquenta linhas explícitas, enquanto adotar a biblioteca traria uma
dependência a mais e faria justamente essa lógica virar configuração implícita,
difícil de testar unitariamente e de justificar numa avaliação.

### 15. Migrations escritas à mão, sem snapshot nem diffing automático

**Contexto.** O MikroORM sabe gerar migrations comparando os metadados das
entidades com o schema do banco. O desafio, porém, avalia explicitamente o
desenho do schema: unicidade parcial, imutabilidade do ledger, não-negatividade
de saldo e revogação de privilégios.

**Decisão.** As migrations são escritas manualmente, com `up` e `down`
simétricos. A configuração usa `snapshot: false` e `disableForeignKeys: false`.

**Justificativa.** Um gerador por diferença produz o que o modelo de objetos
consegue expressar — colunas, tipos, índices simples. Ele não produz
`CHECK (balance >= 0)`, nem índice único parcial com predicado, nem
`REVOKE UPDATE, DELETE ON ledger`. Como essas cláusulas são exatamente o que está
sendo avaliado, escrevê-las à mão não é trabalho extra: é o trabalho. O
`snapshot: false` evita que o migrator mantenha um arquivo de estado que
divergiria de migrations que ele não gerou. O `disableForeignKeys: false` evita
que o MikroORM tente desabilitar a checagem de chaves estrangeiras na sessão,
operação que no PostgreSQL exige privilégio de superusuário.

**Consequência.** Toda alteração de schema exige escrever o `down` correspondente
e exercitá-lo. Em troca, o conteúdo de cada migration é revisável como SQL, e o
que está no banco é exatamente o que foi escrito.

**Decisão de ferramenta.** O migrator é acionado por um script próprio
(`src/infrastructure/database/migrate.ts`) que chama `orm.migrator` diretamente,
em vez da CLI do MikroORM. Isso evita depender do mecanismo de descoberta de
configuração da CLI sob o Bun e entrega o mesmo comando que será usado como etapa
de migração no Docker.

### 16. Filas provisionadas na subida do LocalStack, com deduplicação por conteúdo desligada

**Contexto.** O consumidor precisa de uma fila FIFO e de uma DLQ. Criá-las por
comando manual torna o `docker compose up` insuficiente para reproduzir o
ambiente.

**Decisão.** Um script em `docker/localstack/init/ready.d/` cria a DLQ, lê o ARN
dela, e cria a fila principal já com `RedrivePolicy` apontando para a DLQ e
`maxReceiveCount` igual a 5. `ContentBasedDeduplication` fica **desligado**.

**Justificativa da deduplicação desligada.** O SQS FIFO deduplica dentro de uma
janela de 5 minutos. A idempotência exigida pelo desafio é permanente, e precisa
valer também para reentregas que ocorram depois dessa janela, para mensagens
reprocessadas a partir da DLQ e para o caso de a fila ser recriada. Delegar essa
garantia ao broker produziria um sistema que parece idempotente em teste e falha
em produção. A deduplicação real é responsabilidade da tabela de inbox, com
unicidade no banco; o recurso do broker seria, na melhor das hipóteses, uma
otimização redundante. A consequência prática é que todo envio precisa informar
`MessageDeduplicationId` explicitamente, já que a fila é FIFO.

**Armadilha registrada.** O script é montado por bind mount e executado dentro do
contêiner. Em máquinas Windows, o Git entrega o arquivo com quebras de linha CRLF
por causa de `core.autocrlf`, e o interpretador falha com um erro que não menciona
line endings. Por isso o repositório fixa `*.sh text eol=lf` no `.gitattributes`.

### 17. Configuração validada na importação, com falha no boot

**Contexto.** Variável de ambiente ausente costuma se manifestar tarde: a
aplicação sobe, o liveness responde 200, e o erro aparece na primeira requisição
que precisa daquele valor.

**Decisão.** `src/config/env.ts` lê e valida todas as variáveis no momento da
importação do módulo, lançando com o nome da variável faltante. Valor vazio é
tratado como ausente. O `.env` é carregado nativamente pelo Bun, sem `dotenv`.

**Consequência.** Configuração incompleta derruba o processo antes de abrir a
porta, com código de saída 1 — que é o sinal que o Docker e o orquestrador
precisam para não considerar o contêiner saudável. O efeito colateral aceito é
que o script de migrations, que não usa SQS, também exige as variáveis de fila.
Para desenvolvimento isso é desejável: há um único lugar onde a configuração é
descrita. Se um job de CI passar a rodar apenas migrations, a validação será
separada em `env.database` e `env.sqs` com avaliação preguiçosa.

**Alternativa descartada.** `@nestjs/config` com schema de validação. Traz
dependência e um módulo a registrar, em troca de recursos — namespaces,
configuração por ambiente, injeção do `ConfigService` — que este serviço não usa.
Vinte linhas explícitas e tipadas cobrem o caso e falham mais cedo, no import,
em vez de no ciclo de vida do módulo.

--------------------------------------------------------------------------------------
## Domínio: representação de dinheiro

### 18. `Money` tem sinal, mas o contrato de entrada rejeita negativos

**Contexto.** Saldo negativo é falha eliminatória, o que sugere um tipo monetário
incapaz de representar negativo. Duas exigências do enunciado impedem isso: o
esqueleto da seção 6.1 prevê `negate()` e `isNegative()`, e a resposta de
reconciliação da seção 9 carrega um campo `difference` que é negativo sempre que
o saldo reconstruído supera o armazenado — precisamente o caso que a
reconciliação existe para revelar.

**Decisão.** `Money.from` rejeita string com sinal negativo, porque é o contrato
de entrada citado pelo enunciado. A aritmética interna pode produzir negativo, e
`negate()` inverte o sinal explicitamente.

**Consequência.** A garantia de saldo não-negativo deixa de estar no tipo e passa
a ter dois guardiões: a comparação em `Wallet.debit`, que produz
`InsufficientFundsError` com contexto, e o `CHECK (balance >= 0)` da migration,
que é a garantia final exigida pela restrição 9 da seção 5. Como o tipo não
protege mais essa invariante sozinho, o teste que verifica que um débito
recusado não altera saldo nem versão passa a ser o principal teste de regressão
do agregado.

**Alternativa descartada.** `Money` sem sinal, com `subtract` lançando ao cruzar
o zero. Torna saldo negativo inexprimível, mas inviabiliza representar a
diferença de reconciliação e obrigaria um segundo tipo só para isso.


### 19. A única exceção de lint do projeto, e por que ela existe

**Contexto.** A guarda de `src/domain` proíbe `Number(`, `parseFloat`,
`parseInt`, `+` unário e `toFixed`, por casamento sintático. O casamento de
`toFixed` é feito pelo nome do método, e o ESLint não tem como saber sobre qual
tipo ele está sendo chamado.


**Decisão.** `Money.toString()` usa `Decimal.prototype.toFixed(2)`, com um
`eslint-disable-next-line no-restricted-syntax` local e comentado. É o único
`eslint-disable` do repositório.


**Justificativa.** O `toFixed` proibido pelo enunciado é o do `Number`, que
formata um binário de ponto flutuante e arredonda de forma dependente de
representação. O do `Decimal` é aritmética decimal exata, e é a única forma de
preservar o zero à direita — `new Decimal('100.50').toString()` devolve
`'100.5'`, que violaria a escala fixa de duas casas exigida pela coluna
`numeric(20,2)` e pela serialização na fronteira HTTP.


**Alternativa descartada.** Formatar à mão, dividindo a string no ponto e
completando com `padEnd`. Elimina o `disable` e é igualmente exata, já que
`Money.from` garante no máximo duas casas — mas reimplementa mal o que a
biblioteca já faz, e troca uma exceção explícita e justificada por código que
parece desconhecer a ferramenta.


**Verificação.** A exceção foi confirmada removendo o comentário de `disable` e
observando a guarda acusar a linha, e recolocando-o em seguida. Um `disable` que
silencia uma regra que nunca dispararia é ruído; este silencia uma detecção real.


### 20. Abertura de carteira devolve carteira e lançamento juntos

**Contexto.** A seção 9 do enunciado mostra `POST /wallets` respondendo
`version: 1` para uma carteira aberta com saldo inicial, e ao mesmo tempo exige
que esse saldo gere uma transação `OPENING` com lançamento `CREDIT` na mesma
transação SQL. A invariante da seção 6.2 diz que toda alteração de saldo tem
lançamento correspondente.

**Decisão.** `Wallet.open` devolve `{ wallet, openingEntry }`. A carteira nasce
já com o saldo — abertura não é alteração de saldo, e por isso a versão
permanece em 1 — e o lançamento de abertura, quando o saldo inicial é maior que
zero, sai da mesma chamada, com `balanceBefore` igual a zero.

**Consequência.** Não existe caminho em que o saldo nasça sem ledger: o caso de
uso não tem como obter a carteira sem receber o lançamento junto. O custo é uma
factory que devolve um par em vez de uma instância, e a necessidade de informar
os identificadores do lançamento e da transação de abertura já na criação.

**Alternativa descartada.** Abrir a carteira zerada e aplicar o saldo inicial
por `credit`. Reaproveitaria o caminho normal, mas levaria a versão a 2,
contrariando o exemplo do enunciado, e trataria como movimentação algo que é
estado inicial.

**Relógio.** `openedAt` e `occurredAt` entram por parâmetro em vez de `new Date()`
dentro do domínio, seguindo o mesmo padrão que o enunciado adota em
`markProcessed(referenceTransactionId, at)`. O domínio permanece determinístico e
os testes não precisam de relógio falso.

### 21. Taxonomia de códigos de falha organizada pela decisão do provedor

**Contexto.** A seção 7.2 exige um `failureCode` estável e legível por máquina,
suficiente para o provedor decidir se reenvia, corrige o payload ou desiste, e
deixa a taxonomia a cargo do candidato.

**Decisão.** Os códigos são agrupados exatamente por essa decisão, e não por
camada técnica: rejeições de regra de negócio (reenviar não resolve), payload
inválido (corrigir e reenviar resolve) e falha permanente de infraestrutura
(auditável, sem reprocessamento automático).

**Consequência.** O provedor não precisa interpretar mensagem de erro nem
consultar documentação para saber o que fazer — o grupo do código já responde.
`INSUFFICIENT_FUNDS` e `REVERSAL_WOULD_OVERDRAW` são códigos distintos, como
exige a regra 9 da seção 7, porque descrevem situações operacionalmente opostas:
o primeiro é comportamento normal do jogador; o segundo significa que o dinheiro
da referência já saiu da carteira por outro caminho, e pede investigação.

### 22. Referência inválida devolve código; direção de `LOSS` lança

**Contexto.** O agregado precisa distinguir duas classes de problema que em
TypeScript costumam virar a mesma coisa: violação de regra de negócio e erro de
programação.

**Decisão.** `validateReference` devolve `FailureCode | undefined`. `ledgerDirectionFor`
sobre um `LOSS`, ou sobre um `ROLLBACK` sem referência, lança.

**Justificativa.** Referência inválida é caminho de negócio previsto: vira uma
transação `REJECTED` persistida, com código, e um evento `WagerTransactionRejected`.
Se lançasse, o caso de uso teria que capturar exceção e traduzi-la para código —
o acoplamento por mensagem de erro que a seção 9 critica ao exigir que a API
distinga as situações por status. Já perguntar a direção de lançamento de um
`LOSS` é impossível por construção: `affectsBalance()` é falso e nenhum
lançamento existe. Só chega ali quem escreveu o caso de uso errado, e o lugar de
descobrir isso é o teste, com stack trace.

### 23. `OPENING` é inacessível pela factory pública

**Contexto.** A seção 6.3 determina que `OPENING` é interno e não pode ser
submetido por API nem por fila.

**Decisão.** `WagerTransaction.create` recusa `kind: 'OPENING'`. A criação passa
por `recordOpening`, factory separada, que nasce já `PROCESSED`.

**Consequência.** A regra deixa de depender de validação no controller ou no
consumidor — mesmo que ambos esqueçam, o domínio recusa. E como as duas factories
delegam à mesma construção privada, as validações comuns não divergem.

### 24. Dupla reversão é responsabilidade do banco, não do agregado

**Contexto.** A regra 4 da seção 7 proíbe reverter a mesma referência duas vezes
pelo mesmo tipo de operação.

**Decisão.** Essa regra **não** é verificada no agregado. Ela vive no índice
único parcial `(reference_transaction_id, kind)`, e o caso de uso traduz a
violação de constraint em `REFERENCE_ALREADY_REVERSED`.

**Justificativa.** Um agregado isolado não conhece as outras transações, então
qualquer verificação em memória seria um `select` seguido de `insert` — ou seja,
uma janela de corrida entre instâncias, exatamente o que a restrição 8 da seção
5 proíbe. A única verificação atômica poss

### 25. A imutabilidade do ledger exige um papel sem superpoderes

**Contexto.** A restrição 5 da seção 5 proíbe sobrescrever ou excluir lançamentos,
e a restrição 9 exige que a garantia esteja no schema. A migration revoga
`UPDATE` e `DELETE` sobre `wallet_ledger_entries`, e o catálogo confirma a
revogação.

**Descoberta.** O teste de integração mostrou que a revogação não tinha efeito: o
usuário criado por `POSTGRES_USER` é o superusuário de bootstrap do cluster, e
superusuário ignora verificação de ACL. A garantia existia no catálogo e não no
comportamento — precisamente a diferença que um teste de constraint em SQL cru
serve para revelar.

**Decisão.** Um papel dedicado `wager_app`, sem superusuário, é criado no
`initdb` e passa a ser o usuário da aplicação e das migrations. Como ele é dono
das tabelas mas não superusuário, a revogação é efetivamente aplicada — o dono
mantém apenas a capacidade de reconceder explicitamente a si mesmo.

**Limitação conhecida.** `TRUNCATE` é um privilégio distinto de `DELETE` e
permanece com o dono, deliberadamente, porque as fixtures dos testes de
integração precisam zerar as tabelas. Num ambiente produtivo o correto é a
aplicação conectar com um papel que não seja dono e possua apenas `SELECT` e
`INSERT` sobre o ledger, com as migrations rodando sob um papel separado.

**Evidência.** Os testes `é imutável: UPDATE é negado no nível de privilégio` e
o equivalente para `DELETE` falharam antes desta mudança, com o `UPDATE` sendo
autorizado e barrado apenas pelo `CHECK` de aritmética — o que também confirma
que aquele `CHECK` é uma segunda linha de defesa útil, e não redundância.

### 26. Uma porta de unidade de trabalho, não repositórios independentes

**Contexto.** A seção 11 exige que transação, saldo, ledger, inbox e outbox
participem da mesma transação SQL. Repositórios injetados isoladamente, cada um
com seu `EntityManager`, tornariam essa atomicidade uma convenção — bastaria
alguém esquecer de abrir a transação para o evento ser publicado sem o débito.

**Decisão.** Existe uma única porta `UnitOfWork`, cujo `run` recebe um callback e
entrega um `TransactionalContext` com os quatro repositórios já vinculados ao
`EntityManager` da transação. Fora desse callback não há repositório acessível.

**Consequência.** A atomicidade deixa de depender de disciplina: não existe forma
de obter um repositório sem estar dentro de uma transação. O caso de uso não
importa nada de `@mikro-orm/*` e pode ser exercitado com um contexto em memória.

### 27. Escrita explícita a cada operação, em vez de um flush único no commit

**Contexto.** As chaves estrangeiras entre transação, lançamento e carteira estão
no schema, mas não nos metadados do MikroORM — os modelos de persistência usam
colunas escalares de identificador, sem relações declaradas, como consequência da
decisão 8. Sem relações, o Unit of Work não conhece a ordem de dependência e a
ordem dos `INSERT` no flush final é arbitrária.

**Decisão.** Cada método de repositório executa `flush` imediatamente. A ordem das
escritas passa a ser a ordem em que o caso de uso as invoca.

**Consequência.** A ordem correta é garantida por construção, e não por inferência
do ORM. O custo é uma ida ao banco por operação em vez de uma só no commit —
aceitável porque a transação continua atômica, já que `flush` grava mas quem
confirma é o `transactional`.

**Alternativa descartada.** Declarar as relações com `manyToOne().mapToPk()` para
que o ORM calcule a ordem de commit. Recupera o flush único, mas reintroduz
metadados de relação num modelo que existe justamente para ser plano, e torna a
ordem das escritas financeiras um detalhe interno do ORM.

### 28. O saldo do replay vem do lançamento, não da carteira

**Contexto.** A regra 7 da seção 7 determina que repetir uma operação já
processada devolva o resultado original, "incluindo o saldo observado naquele
momento".

**Decisão.** No caminho de replay, o saldo devolvido é o `balanceAfter` do
lançamento daquela transação, e não o saldo atual da carteira.

**Justificativa.** É a leitura literal da regra, e é o que torna a resposta
idempotente de verdade: se cinco apostas ocorreram depois, o replay da primeira
continua respondendo o saldo que ela produziu. Devolver o saldo corrente faria a
mesma requisição, repetida duas vezes, produzir respostas diferentes — que é
exatamente o que idempotência deveria impedir. É também a razão de `balanceBefore`
e `balanceAfter` existirem no lançamento, e não apenas o valor movimentado.

### 29. A reconciliação lê sob lock e nunca corrige


**Contexto.** A seção 9 exige que divergências entre saldo materializado e ledger
sejam logadas, contabilizadas e sinalizadas — nunca corrigidas silenciosamente.


**Decisão.** `ReconcileWallet` carrega a carteira com `FOR UPDATE` antes de somar
os lançamentos, e devolve `storedBalance`, `calculatedBalance`, `difference`,
`consistent` e `checkedEntries` sem alterar nada.


**Justificativa do lock.** Sem ele, uma escrita concorrente entre a leitura do
saldo e a soma do ledger produziria divergência falsa. Uma reconciliação que
grita lobo perde a serventia: se ela acusa erro em condições normais de
concorrência, ninguém mais confia no alerta quando o erro for real.



**Justificativa de não corrigir.** Divergência significa que algo escreveu no
banco por fora do caso de uso. Ajustar o saldo destruiria a única evidência
disso e transformaria um incidente investigável num número que ninguém explica.


**Consequência.** A diferença pode ser negativa — o ledger supera o saldo — e é
por isso que a decisão 18 precisou ser revista para `Money` com sinal. Um teste
cobre exatamente esse caso.
### 30. O publisher reclama mensagens pulando as travadas


**Contexto.** A seção 11 exige que múltiplos publishers concorrentes funcionem
sem perder nem duplicar indefinidamente.


**Decisão.** `MikroOrmOutboxStore.drain` seleciona o lote com
`LockMode.PESSIMISTIC_PARTIAL_WRITE`, que o PostgreSQL traduz para
`FOR UPDATE SKIP LOCKED`, e marca `published_at` na mesma transação.


**Consequência.** N publishers dividem o trabalho: cada um trava o que conseguir
e ignora o que outro já reservou, sem espera. Com `FOR UPDATE` comum, o segundo
publisher bloquearia até o primeiro terminar — funcionaria, mas seria
serialização disfarçada de paralelismo. Um teste com dois publishers e 40
mensagens verifica que nenhuma foi entregue duas vezes e nenhuma se perdeu.


**Limitação aceita.** A transação permanece aberta durante as chamadas ao SQS.
Se o processo morrer entre a publicação e o commit, a mensagem é republicada —
entrega at-least-once, absorvida pelo inbox do consumidor. Fechar a transação
antes de publicar inverteria o risco para perda de evento, que é pior.


**Falha isolada por mensagem.** Um evento problemático incrementa `attempts` e
recebe `next_attempt_at` com backoff exponencial limitado a cinco minutos,
enquanto os demais do lote seguem. Sem isso, uma única mensagem defeituosa
travaria a fila inteira.


### 31. Eventos de integração têm fila própria


**Contexto.** A seção 10 nomeia `wager-transactions.fifo` e sua DLQ como filas de
**entrada** de transações. A seção 11 exige publicar eventos de integração, mas
não nomeia destino.


**Decisão.** Uma fila separada, `wager-events.fifo`, com DLQ própria, provisionada
pelo mesmo script de init do LocalStack.


**Justificativa.** Publicar os eventos na fila de entrada faria o consumidor ler
os próprios eventos como se fossem pedidos de transação — um laço de realimentação
que só apareceria em produção.


### 32. Agrupamento FIFO por carteira, com deduplicação explícita no envio


**Decisão.** O `MessageGroupId` de cada evento é o `aggregateId`, que é o
identificador da carteira. O `MessageDeduplicationId` é o `eventId`.


**Consequência.** A ordem é preservada **por carteira**, que é a unidade de
concorrência definida na seção 8, sem serializar carteiras distintas — um único
grupo global transformaria a fila num gargalo. E como as filas foram criadas com
`ContentBasedDeduplication` desligado (decisão 16), informar o id de
deduplicação deixa de ser opcional: é o que impede o mesmo evento de entrar duas
vezes quando o publisher republica após uma falha entre publicação e commit.


### 33. Inbox e efeito financeiro são a mesma transação, com um só carimbo


**Contexto.** A seção 11 exige que inbox, alteração de saldo, ledger e outbox
participem da mesma transação SQL.


**Decisão.** O registro do inbox acontece dentro do `UnitOfWork` do caso de uso,
por `insert ... on conflict do nothing`, e grava `received_at` e `processed_at`
com o mesmo instante.


**Justificativa do carimbo único.** Os dois só divergiriam se registrar e
processar estivessem em transações diferentes. Sendo atômicos, a existência da
linha já significa processamento concluído: se a transação abortar, a linha some
junto. Manter dois carimbos idênticos por fidelidade ao esqueleto do enunciado
sugeriria uma distinção que o desenho não tem.


**Justificativa do `on conflict`.** No PostgreSQL, uma violação de constraint
aborta a transação inteira, e capturar a exceção em JavaScript não a desfaz —
qualquer comando seguinte falharia com "current transaction is aborted".
`on conflict do nothing ... returning` resolve a corrida sem abortar nada.


**Camadas distintas.** Reentrega não interrompe o fluxo: ela segue para o replay
por chave de idempotência, que devolve o resultado original. O inbox impede
reprocessar; a chave de idempotência garante a resposta certa. É a leitura
prática da restrição 3 da seção 5, que proíbe confiar apenas no broker.


### 34. Três desfechos distintos para falha no consumidor


**Contexto.** A seção 10 exige distinguir erro de negócio, transitório e
permanente.


**Decisão.** Rejeição de negócio — saldo insuficiente, referência inválida — não
é exceção: o caso de uso devolve `REJECTED`, a mensagem é confirmada e o evento
de rejeição sai pelo outbox. Payload malformado e conflito de idempotência são
permanentes: vão para a DLQ explicitamente e só então recebem ack. Qualquer
outra falha é tratada como transitória: a mensagem **não** é confirmada, o SQS a
reentrega ao expirar a visibilidade, e a política de redrive a leva à DLQ ao
esgotar `maxReceiveCount`.


**Ordem que importa.** O envio à DLQ precede o ack. Invertida, um processo que
morresse no meio faria a mensagem desaparecer sem ter chegado a lugar nenhum.


**Validação antecipada.** O parser valida a quantia com `Money.from` antes de
qualquer acesso ao banco. Valor com três casas decimais é defeito de payload, não
indisponibilidade — descobrir isso no parser manda a mensagem à DLQ de imediato,
em vez de gastar cinco entregas até o `maxReceiveCount`.


**Ack somente após commit.** O `execute` só retorna depois do commit, e o ack vem
depois dele. Morrer entre commit e ack causa reentrega, absorvida pelo inbox;
morrer antes do commit não deixa efeito algum.


### 35. "Múltiplas instâncias" nos testes são instâncias de ORM


**Contexto.** A seção 13 exige testes com três ou mais processos ou instâncias
simultâneos.


**Decisão.** Os testes de concorrência criam três instâncias independentes de
`MikroORM`, cada uma com pool de conexões e identity map próprios, e executam o
caso de uso em paralelo sobre elas.


**Justificativa.** As invariantes vivem no PostgreSQL, e o único estado
compartilhado entre instâncias da aplicação é o banco. Do ponto de vista de
locking, três pools distintos são indistinguíveis de três processos.


**Limitação conhecida e assumida.** Processos de sistema operacional separados
provariam isolamento de memória, que este desenho não usa para nada — não há
cache em memória participando de nenhuma garantia, o que a restrição 2 da seção 5
aliás proíbe. O que essa abordagem **não** cobre é falha de processo no meio de
uma operação; esse cenário é exercitado de outra forma, reproduzindo em banco o
estado que um processo morto entre o commit e o ack deixaria.


**Efeito colateral operacional.** O consumidor da aplicação compete com o
consumidor dos testes pela mesma fila. Por isso `CONSUMER_ENABLED` existe: a
suíte de integração pressupõe a aplicação parada ou o consumidor desligado.

### 36. Observabilidade sem dependência nova, e instrumentação opcional por construção

**Contexto.** A seção 12 exige logs estruturados em JSON com identificadores de
correlação, sem payload financeiro completo, e métricas cobrindo transações por
status, duplicatas, retries, DLQ, conflitos de lock e outbox lag.

**Decisão.** Os logs usam o `ConsoleLogger` do Nest 11 com `json: true`, sem
biblioteca adicional. As métricas são um registro em memória exposto em
`/metrics` no formato de exposição do Prometheus, atrás de uma porta `Metrics`.

**Instrumentação é opcional por construção.** Os casos de uso e os workers
recebem `Metrics` por `@Optional()`, com um padrão que não faz nada. Isso impede
que instrumentação vire dependência dura da regra de negócio, e mantém os cinco
arquivos de teste que constroem os casos de uso manualmente funcionando sem
conhecer métricas.

**Conflito de lock medido como espera, não como erro.** Com bloqueio pessimista
não existe conflito que falhe — existe fila. Um contador de "conflitos" seria
sempre zero e sugeriria ausência de contenção. O que revela carteira quente é a
duração da aquisição do lock, medida em `wager_wallet_lock_wait_seconds`, com um
contador auxiliar para aquisições acima de 50 ms.

**Outbox lag medido na raspagem.** Atraso é uma grandeza instantânea: um
contador acumulado responderia "quantas mensagens atrasaram", não "há quanto
tempo a mais antiga espera". O gauge é calculado por consulta no momento do
`GET /metrics`.

**Limitação conhecida.** O registro é por processo e some no reinício. Com
múltiplas instâncias, o coletor precisa raspar cada uma e agregar — que é o
modelo normal do Prometheus, mas significa que `/metrics` de uma instância não
descreve o sistema. Um backend compartilhado, como OpenTelemetry com coletor,
seria o passo seguinte e está fora do escopo assumido.


### 37. Agendamento de reversões órfãs derivado de um único contador

**Contexto.** A seção 7.1 exige que transações em `PENDING_REFERENCE` sejam
reprocessadas por worker agendado com backoff exponencial, com limite de
tentativas ou TTL definido e justificado, e que o esgotamento produza `REJECTED`
com um `failureCode` que identifique a referência inexistente.


**Decisão.** Uma coluna, `reference_attempts`. O instante da próxima tentativa é
derivado dela e de `created_at`, direto no predicado da consulta:
`now() >= created_at + (least(1 << reference_attempts, 300) * interval '1 second')`.


**Por que não guardar `next_attempt_at`.** Seriam dois campos que precisam
concordar, e que um dia não concordam — um `UPDATE` que mexe num e esquece o
outro deixa a pendência presa ou em rajada. Derivar elimina a possibilidade.
O deslocamento de bits mantém a aritmética inteira: `power()` devolveria ponto
flutuante, que não tem lugar neste sistema nem em consulta.


**Limite escolhido: doze tentativas, cerca de trinta minutos.** O backoff começa
em 2 segundos, dobra até o teto de 300, e a soma da série dá aproximadamente 28
minutos. É folgado para chegada fora de ordem — em que a referência costuma vir
em segundos — e curto o bastante para que um estorno órfão não fique pendente
indefinidamente consumindo ciclos. Esgotado, vira `REJECTED` com
`REFERENCE_NOT_FOUND` e evento correspondente.


**Dupla leitura sob lock.** A consulta de elegíveis não trava nada, então dois
workers podem selecionar a mesma pendência. Depois de adquirir o lock da
carteira, o caso de uso **relê** a transação e desiste se o status já não for
`PENDING_REFERENCE`. Sem isso, o segundo aplicaria o estorno de novo — a
constraint única de `(wallet_id, transaction_id)` no ledger seria a rede final,
mas como exceção de constraint, e não como comportamento correto. Um teste com
dois workers concorrentes cobre exatamente esse caminho.


**`reference_attempts` fora do domínio.** É metadado de agendamento, gerido pelo
repositório com SQL direto, pelo mesmo argumento que mantém `attempts` fora do
agregado no outbox. Por isso `update` persiste uma lista explícita de colunas em
vez de reescrever o registro: reescrever zeraria o contador a cada transição, e
o backoff nunca avançaria.

### 38. Consultas não passam pelos agregados

**Contexto.** A seção 9 exige quatro consultas, incluindo o ledger paginado por
cursor estável e opaco.

**Decisão.** `WageringQueries` lê o banco e devolve DTOs diretamente, sem
reidratar `Wallet`, `WagerTransaction` ou `WalletLedgerEntry`.

**Justificativa.** Leitura não tem invariante a proteger. Reconstruir o agregado
para em seguida serializá-lo seria trabalho puro, e acoplaria o formato de saída
ao modelo de escrita — que existe para outra finalidade. A separação também
mantém o mapper de escrita livre de campos que só a API precisa.

**Paginação por chave composta.** O cursor codifica `(created_at, id)` em
base64url e a consulta usa `(created_at, id) < (?, ?)`, alinhada ao índice
`wallet_ledger_entries_cursor_idx`. Offset degradaria linearmente e, pior,
pularia ou repetiria linhas quando houvesse inserção durante a paginação — num
ledger append-only isso é o caso comum, não a exceção. O cursor é opaco para que
o consumidor não passe a depender do formato.

**Uma linha a mais por página.** A consulta pede `limit + 1` e descarta a última:
revela se há próxima página sem um `count` adicional, que num ledger grande
custaria varredura.

**Existência verificada antes de listar.** `GET /wallets/:id/ledger` consulta a
carteira primeiro. Sem isso, um identificador inexistente devolveria página vazia
com 200, e o provedor não teria como distinguir "carteira sem movimento" de
"carteira que não existe".

### 39. Falha transitória de infraestrutura responde 503, permanente responde 500

**Contexto.** A seção 9 exige que a API distinga com clareza cinco situações, e a
última delas — falha transitória de infraestrutura — é a única que não tem
código próprio se todas as exceções caírem no tratador padrão do Nest.

**Decisão.** Um filtro dedicado captura `DriverException` do MikroORM.
`ConnectionException`, `DeadlockException` e `LockWaitTimeoutException` viram
**503** com `Retry-After`; as demais viram **500**.

**Justificativa da separação.** Conexão perdida, deadlock e espera de lock
esgotada passam com o tempo, e o provedor deve reenviar. Erro de sintaxe, tabela
inexistente ou coluna errada são defeito de schema: reenviar repete a falha, e
responder 503 convidaria o provedor a insistir contra algo que nunca vai
funcionar. Colapsar os dois num código só é exatamente o que a seção 9 proíbe.

### 40. `FAILED` existe e é inalcançável neste desenho

**Contexto.** A seção 6.3 prevê o estado `FAILED` para erro permanente de
infraestrutura, terminal e auditável. A transição `fail()` está implementada e
coberta por teste de domínio, mas nenhum caminho da aplicação a invoca.

**Justificativa.** As duas falhas permanentes que o consumidor reconhece —
payload malformado e conflito de idempotência — acontecem **antes** de existir
transação persistida: a primeira no parser, a segunda ao comparar o hash com uma
transação que já é de outra requisição. Não há registro para marcar como
`FAILED`. E falha de infraestrutura durante o processamento aborta a transação
SQL inteira, o que apaga qualquer registro que tivesse sido criado — persistir o
`FAILED` exigiria uma segunda transação, que poderia falhar pelo mesmo motivo.

**Decisão.** A transição permanece implementada e testada, sem uso. Ela passa a
ser necessária no dia em que existir um caminho que persista a transação numa
etapa e a aplique em outra — por exemplo um processamento em duas fases. Removê-la
economizaria dez linhas e custaria a modelagem completa da máquina de estados que
o enunciado descreve.

### 41. Inbox e Outbox são tabelas, não agregados

**Contexto.** A seção 6.5 apresenta `InboxMessage` e `OutboxMessage` como classes
com construtor privado e factories, no mesmo formato dos agregados. O enunciado
declara que esses blocos são esqueletos de referência.

**Decisão.** As duas existem apenas como tabelas, manipuladas por repositório e
store com SQL explícito. Não há classe de domínio para nenhuma delas.

**Justificativa.** Nenhuma das duas carrega invariante de negócio. O inbox
resolve deduplicação, e a garantia é a chave primária composta com
`on conflict do nothing` — uma classe em memória não acrescentaria nada e
introduziria a chance de divergir do que o banco realmente aceita. O outbox
carrega agendamento: tentativas e backoff, que a decisão 30 já justifica manter
fora do domínio pelo mesmo motivo que `reference_attempts` fica fora da
transação. Transformá-las em agregados adicionaria mapeamento sem adicionar
garantia, e o enunciado pede encapsulamento de estado e transições explícitas —
que aqui vivem no schema, onde são verificáveis por teste de constraint.