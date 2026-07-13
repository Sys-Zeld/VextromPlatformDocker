# 05 — Decisões Arquiteturais (ADRs)

Registro de decisões de arquitetura do SentinelGrid no formato ADR
(*Architecture Decision Record*): **contexto → decisão → consequências → status**.
Cada decisão é imutável depois de "Aceita" — mudanças entram como um novo ADR que
supersede o anterior.

Status possíveis: **Aceita** · **Proposta** (recomendada, aguardando confirmação) ·
**Pendente** (bloqueada por uma definição do usuário).

---

## ADR-001 — Isolamento total por dado e comunicação por contrato

**Status:** Aceita (2026-07-02)

**Contexto.** A plataforma é um monolito modular onde cada módulo já tem banco
próprio. O SentinelGrid é um *bounded context* novo. Havia a opção de reaproveitar
tabelas/serviços de outros módulos (ex.: cadastro de equipamentos do Report
Service).

**Decisão.** Isolamento **total**: o SentinelGrid não lê banco nem importa lógica
de domínio de outro módulo. Toda integração inter-módulos acontece por **contrato
explícito** (API), nunca por SQL/FK cruzando fronteira nem por `import` de código
de domínio alheio.

**Consequências.**
- ✅ Sem acoplamento de schema; cada módulo é dono soberano do seu dado.
- ✅ Postura de segurança melhor: menor privilégio, *blast radius* contido.
- ⚠️ **Sem JOIN e sem transação cross-módulo** — ver ADR-004 (snapshot + `external_ref`).
- ⚠️ Consistência **eventual**: escritas disparadas por eventos externos precisam ser idempotentes, com retry.
- ⚠️ Exige **contrato versionado + testes de contrato** entre consumidor e provedor.

---

## ADR-002 — Domínio isolado, infraestrutura compartilhada

**Status:** Aceita (2026-07-02)

**Contexto.** "Isolamento total" poderia ser lido como "reescrever tudo do zero,
inclusive auth, storage, sanitização". Reescrever *cross-cutting* por módulo
multiplica a superfície de ataque e faz um fix de segurança divergir entre cópias.

**Decisão.** Isolamento aplica-se a **dados e regras de negócio**, **não** a
infraestrutura. Cross-cutting (verificação de auth, driver de storage local/s3,
envelope de erro, sanitização, paginação) é consumido como **biblioteca de
plataforma compartilhada** (`platform/common` ou o *deps bag* já existente).

**Regra prática:** reusar uma lib comum ≠ acoplar módulos. Isolar domínio, sim;
reescrever criptografia/upload por módulo, não.

**Consequências.**
- ✅ Um único ponto para corrigir vulnerabilidades de infra.
- ✅ Menos código duplicado e menos drift de segurança.
- ⚠️ A lib compartilhada vira dependência crítica — precisa de versionamento e retrocompatibilidade.

---

## ADR-003 — Transporte entre módulos: in-process "remote-ready" vs HTTP

**Status:** Pendente — bloqueada pela topologia de deploy (aguarda decisão do usuário)

**Contexto.** Hoje todos os módulos rodam no **mesmo processo Node**
(`specflow/app.js` monta todos). "Comunicar via API" pode ser (a) HTTP real em
localhost ou (b) uma interface de módulo publicada in-process. HTTP interno num
processo único adiciona latência e novos modos de falha sem benefício, **a menos
que** haja intenção de separar deploy.

**Decisão (proposta, a confirmar).** Desenhar a fronteira **como se fosse remota**
(contrato versionado, DTO próprio — sem `import` do tipo do outro módulo, sem
transação compartilhada), mas **implementar in-process** enquanto for um processo
único; **promover para HTTP** quando/se houver deploy separado. Se a decisão for
deploy separado desde já, adotar **HTTP real + API key escopada** já na primeira
integração.

**Pergunta que decide:** os módulos serão deployados separadamente (containers/hosts
distintos) em horizonte previsível?
- **Sim** → HTTP real desde já.
- **Não** → contrato in-process remote-ready (promoção posterior sem reescrita).

**Consequências.** Fronteira limpa em ambos os casos; o custo de rede só é pago
quando realmente necessário.

---

## ADR-004 — SentinelGrid é dono do seu registry (equipamento/cliente/site/área)

**Status:** Aceita (2026-07-02)

**Contexto.** O Report Service já tem `service_report_customers` /
`service_report_customer_sites` / `service_report_equipments` (denormalizado,
sem "Área", fabricante/modelo como TEXT). O SentinelGrid precisa de Área,
criticidade e FK normalizada de fabricante/modelo/tipo. Dois registries
independentes causariam *drift* do mesmo ativo.

**Decisão.** O SentinelGrid mantém **registry próprio normalizado** (tabelas
`sg_*`). A correlação com o Service Report usa uma **FK externa lógica
bidirecional**: `service_report_id` em `sg_clients`, `sg_sites` e `sg_equipment`,
e `sentinelgrid_id` nas entidades equivalentes do Service Report. Não existe
constraint SQL nem JOIN entre bancos; o contrato de integração grava as duas
pontas e considera o cadastro vinculado somente quando ambas se apontam
mutuamente e a entidade local está ativa. `sg_rs_links` permanece apenas como
compatibilidade de transição para vínculos antigos.

O snapshot continua populado/atualizado via API — **nunca fetch vivo a cada
leitura de domínio**. A verificação remota ocorre somente nas superfícies de
sincronização. Unificação num "Asset Registry" canônico é um épico futuro.

**Consequências.**
- ✅ Não bloqueia o MVP; não refatora o Report Service agora.
- ✅ Soft delete ou remoção em um módulo invalida o estado visual de vínculo; a próxima importação repara as duas pontas sem duplicar o registro ativo.
- ⚠️ Consistência entre as duas pontas é eventual; falha entre as escritas deixa o item como não vinculado até o retry idempotente.

---

## ADR-005 — Integração com Report Service por API, sem escrita compartilhada

**Status:** Aceita (2026-07-02)

**Contexto.** O SentinelGrid apenas **associa** relatórios técnicos (Regras §14),
não os cria. O relatório vive no Report Service (ou externo).

**Decisão.** Integração de **acoplamento fraco**: associar por código/ID/PDF/link
+ *lookup* **read-only** ("buscar OS/relatório do RS por ID") autenticado por **API
key escopada**. Sem escrita no banco do RS; sem escrita compartilhada. Endpoints
internos são tratados como *untrusted* — exigem authN mesmo em localhost.

**Consequências.**
- ✅ Auditável e revogável (escopo de chave).
- ⚠️ Requer o RS expor um contrato de leitura estável e versionado.

---

## ADR-006 — Migrations versionadas (não herdar o mega-migrate idempotente)

**Status:** Aceita (2026-07-02)

**Contexto.** `report_service/migrate.js` é um script idempotente único (~827
linhas) com DDL + `ALTER ADD COLUMN IF NOT EXISTS` + backfills misturados, sem
tabela de versão. Para 25 entidades que vão evoluir, isso vira ingerível e
não-auditável.

**Decisão.** O SentinelGrid usa **migrations numeradas** (`001_*.sql`, `002_*.sql`)
com tabela **`schema_migrations`** e runner que aplica só o pendente, em ordem.
DDL separado de backfill de dado.

**Consequências.**
- ✅ Histórico de schema auditável e reproduzível.
- ⚠️ Precisa de um runner mínimo (próprio ou lib leve) — item da Fase 0.

---

## ADR-007 — Terminologia: "Ordem de Manutenção (OM)" ≠ "Ordem de Serviço (OS)"

**Status:** Aceita (2026-07-02)

**Contexto.** O Report Service já usa "Ordem de Serviço (OS)". O SentinelGrid tem
"Ordem de Manutenção". Termos parecidos conflam conceitos e dados.

**Decisão.** Fixar **OM** (SentinelGrid) vs **OS** (Report Service) em UI, código e
schema. Nada de reusar o termo/ível "ordem" ambíguo entre módulos.

**Consequências.** ✅ Menos confusão de usuário e de modelagem.

---

## ADR-008 — Regras duras do domínio como mecanismo, não `if` espalhado

**Status:** Aceita (2026-07-02)

**Contexto.** Onde mora a correção do sistema: status da OM (10 estados, gate de
aprovação, campos obrigatórios da corretiva, bloqueio de encerramento por
relatório), políticas configuráveis (`requires_report`/`requires_approval`/
periodicidade) e histórico do equipamento.

**Decisão.**
1. **Máquina de estados da OM**: tabela de transições + guards num único service.
2. **Resolver de política**: resolve por contrato+tipo+criticidade num só lugar (Regras §14/§28).
3. **Histórico como *event log* append-only**, escrito pela camada de service em eventos de domínio (dá a rastreabilidade §28.11 e alimenta calendário/indicadores).

**Consequências.** ✅ Menos bug silencioso; rastreabilidade e KPIs "de graça".
⚠️ Exige disciplina de emitir eventos de domínio na camada de service.

---

## ADR-009 — Contrato tipado com validação em runtime (zod)

**Status:** Aceita (2026-07-02) — adotado na Fatia 1.1 (`zod` já disponível no projeto, declarado em `package.json`).

**Contexto.** O V2 do Report Service delega a controllers legados e mantém tipos à
mão (risco de drift entre façade e SPA). O SentinelGrid é greenfield.

**Decisão (proposta).** Camadas limpas `controllers → services → repositories`, sem
delegação a legado. Contrato da façade definido com **zod** no servidor
(validação em runtime + inferência de tipos TS), fonte única de verdade dos DTOs
consumidos pelo SPA.

**Consequências.** ✅ Elimina drift de tipos; validação e tipo do mesmo schema.
⚠️ Nova dependência (zod) no backend.

---

## ADR-010 — Escopo por cliente (client-scoping) desde o dia 1

**Status:** Aceita (2026-07-02)

**Contexto.** Clientes de energia crítica frequentemente pedem portal read-only
depois. Retrofitar fronteira de tenant é caro.

**Decisão.** Toda query escopada por `client_id`; `client_id` presente nas tabelas
certas desde o início, mesmo com só usuários internos hoje.

**Consequências.** ✅ Caminho barato para portal/tenant futuro. ⚠️ Disciplina de
sempre filtrar por cliente na camada de repositório.

---

## ADR-011 — Escopo do MVP: Fases 0–3 + sink de histórico

**Status:** Proposta (2026-07-02) — aguarda confirmação do usuário

**Contexto.** Construir calendário/indicadores/mobile antes de existir OM real é
prematuro (não há dado para medir).

**Decisão (proposta).** MVP = **Fases 0–3** (cadastro → plano → OM com máquina de
estado e aprovação) **+ sink fino da Fase 7** (cada OM concluída grava histórico).
Calendário (6), indicadores (8) e mobile (9) vêm depois de haver dado real.

**Consequências.** ✅ Entrega o núcleo de valor (rastreabilidade + controle de
ativos + preventiva) cedo. ⚠️ Reduz o "wow" inicial (sem dashboard no MVP).

---

## ADR-012 — Importação de checklist por IA gera rascunho revisável

**Status:** Aceita (2026-07-13)

**Contexto.** Manuais e formulários de manutenção em PDF possuem estruturas
variáveis. Permitir que o modelo grave diretamente no banco pode omitir etapas,
inventar limites técnicos ou deixar um checklist parcialmente criado.

**Decisão.** A IA recebe somente PDF validado (assinatura `%PDF-`, até 10 MB) e
produz um **rascunho** no contrato canônico de checklist. Cada campo/linha do
documento vira um item; colunas sem correspondência são preservadas nas
observações. O usuário revisa cabeçalho e itens antes de salvar. A persistência
do checklist e de todos os itens ocorre numa única transação.

**Consequências.** ✅ Evita escrita autônoma da IA e registros parciais; aceita
documentos heterogêneos sem ampliar o schema a cada formato. ⚠️ A qualidade da
extração depende do PDF e exige revisão humana antes do uso operacional.

---

## ADR-013 — Pré-agendamento determinístico com reserva local

**Status:** Aceita (2026-07-13)

**Contexto.** A distribuição manual de muitas OMs tende a concentrar equipamentos
em poucos técnicos e pode criar deslocamentos incompatíveis no mesmo período. Ao
mesmo tempo, a distribuição preliminar ainda não representa autorização para
criar uma OS no Service Report.

**Decisão.** O SentinelGrid calcula uma simulação determinística sobre OMs abertas,
datadas e sem técnico. Cada OM vale uma unidade de carga (um equipamento); entre os
técnicos habilitados e sem conflito de cliente/site, recebe a ordem aquele com
menor carga total no período. A confirmação persiste o vínculo N:N existente como
reserva local, sob travas transacionais, mas não altera o status da OM nem chama a
integração. Estados abertos com técnico reservado participam do motor de conflito.
O Service Report continua protegido pelo gate explícito `status = agendada`.

**Consequências.** ✅ Distribuição equilibrada, previsível e revisável; evita dois
locais incompatíveis para o mesmo técnico; nenhuma OS é criada por antecipação.
⚠️ Vínculos já confirmados são preservados nas próximas execuções e precisam de
alteração explícita, não de redistribuição silenciosa.

---

## Índice de status

| ADR | Decisão | Status |
|-----|---------|--------|
| 001 | Isolamento total por dado + contrato | Aceita |
| 002 | Domínio isolado, infra compartilhada | Aceita |
| 003 | Transporte in-process remote-ready vs HTTP | **Pendente** (topologia de deploy) |
| 004 | Registry próprio + FK externa lógica bidirecional | Aceita |
| 005 | Integração RS por API read-only, sem escrita compartilhada | Aceita |
| 006 | Migrations versionadas | Aceita |
| 007 | Terminologia OM ≠ OS | Aceita |
| 008 | Regras de domínio como mecanismo | Aceita |
| 009 | Contrato tipado com zod | Aceita |
| 010 | Client-scoping desde o dia 1 | Aceita |
| 011 | MVP Fases 0–3 + histórico | Proposta |
| 012 | Importação de checklist por IA como rascunho revisável | Aceita |
| 013 | Pré-agendamento determinístico com reserva local | Aceita |
