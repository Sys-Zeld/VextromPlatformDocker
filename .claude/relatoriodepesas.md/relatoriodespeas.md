# PLANO DE IMPLEMENTAÇÃO
## Módulo de Gestão de Despesas e Reembolsos

### 1. CONTEXTO DO PROJETO

Implementar um módulo de Gestão de Despesas e Reembolsos dentro da aplicação existente.

O sistema deverá permitir que colaboradores autenticados criem relatórios, registrem despesas, anexem comprovantes e encaminhem solicitações para aprovação administrativa.

Os administradores deverão conseguir consultar todos os relatórios, analisar despesas, aprovar, rejeitar, devolver para correção e registrar pagamentos.

O módulo deverá utilizar a arquitetura, os padrões, os componentes e a infraestrutura já existentes.

Não criar uma aplicação independente.

Não propor uma nova stack tecnológica.

Não substituir componentes ou bibliotecas existentes sem justificativa técnica.

---

# FASE 1 — ANÁLISE DA APLICAÇÃO EXISTENTE

## Objetivo

Compreender a estrutura da aplicação antes de realizar alterações.

## Atividades

1. Inspecionar a estrutura de diretórios.
2. Identificar o mecanismo de autenticação.
3. Identificar os perfis e permissões existentes.
4. Analisar a estrutura do banco de dados.
5. Identificar o mecanismo de migrações.
6. Identificar a organização das rotas.
7. Identificar os serviços e controladores.
8. Identificar o mecanismo de upload.
9. Identificar como são gerados documentos PDF.
10. Identificar o sistema de notificações.
11. Identificar os padrões de interface.
12. Identificar os testes existentes.

## Entregáveis

Produzir um documento:

`docs/expense-management/implementation-plan.md`

O documento deverá conter:

- Diagnóstico da arquitetura.
- Pontos de integração.
- Componentes reutilizáveis.
- Entidades necessárias.
- Arquivos previstos.
- Riscos técnicos.
- Dependências internas.
- Estratégia de implementação.

## Critério de conclusão

O Codex deverá compreender como integrar o módulo sem modificar desnecessariamente funcionalidades existentes.

**Não iniciar alterações estruturais antes de concluir esse diagnóstico.**

---

# FASE 2 — MODELAGEM DO BANCO DE DADOS

## Objetivo

Criar uma estrutura de dados consistente e preparada para evolução.

## Entidades

### ExpenseProfile

Cadastro complementar do usuário.

Campos:

- id
- userId
- fullName
- cpf
- email
- phone
- bankCode
- bankName
- agency
- accountNumber
- accountDigit
- accountType
- pixKey
- pixKeyType
- createdAt
- updatedAt

O campo userId deverá referenciar a identidade existente na aplicação.

CPF, dados bancários e chave Pix deverão possuir controles apropriados de proteção de dados.

### ExpenseReport

Representa o relatório principal.

Campos:

- id
- reportNumber
- userId
- title
- description
- projectId, quando aplicável
- costCenterId, quando aplicável
- startDate
- endDate
- totalAmount
- approvedAmount
- status
- submittedAt
- approvedAt
- createdAt
- updatedAt

O campo totalAmount deverá ser derivado dos lançamentos.

O valor aprovado será inicialmente igual ao valor solicitado após aprovação integral.

### ExpenseItem

Representa cada despesa.

Campos:

- id
- reportId
- categoryId
- expenseDate
- description
- justification
- amount
- currency
- merchant
- notes
- createdAt
- updatedAt

### ExpenseCategory

Categorias configuráveis.

Campos:

- id
- name
- description
- active
- createdAt
- updatedAt

### ExpenseAttachment

Comprovantes fiscais.

Campos:

- id
- expenseItemId
- originalName
- storedName
- mimeType
- fileSize
- storagePath
- fileHash
- uploadedBy
- createdAt

### ExpenseApprovalHistory

Histórico das transições de aprovação.

Campos:

- id
- reportId
- previousStatus
- newStatus
- action
- performedBy
- reason
- createdAt

### ExpensePayment

Registro do reembolso.

Campos:

- id
- reportId
- amount
- paymentDate
- paymentMethod
- transactionReference
- paymentProofPath
- bankDetailsSnapshot
- notes
- recordedBy
- createdAt

O snapshot bancário deverá ser protegido e acessível somente a perfis autorizados.

### ExpenseAuditLog

Histórico de operações relevantes.

Campos:

- id
- reportId
- actorId
- action
- entityType
- entityId
- metadata
- createdAt

## Regras de modelagem

- Utilizar os padrões de identificação já existentes.
- Implementar integridade referencial.
- Criar índices para consultas frequentes.
- Impedir duplicidade de números de relatórios.
- Evitar exclusões físicas de registros financeiros concluídos.
- Utilizar representação monetária decimal exata.
- Garantir que alterações financeiras relevantes sejam transacionais.
- Preparar o modelo para aprovação parcial e pagamentos parciais futuros.

## Critérios de conclusão

- Migrações executadas.
- Relacionamentos validados.
- Integridade referencial confirmada.
- Testes de persistência aprovados.
- Nenhuma alteração indevida nos dados existentes.

---

# FASE 3 — CADASTRO COMPLEMENTAR DO USUÁRIO

## Objetivo

Permitir o gerenciamento dos dados necessários ao reembolso.

## Atividades

1. Criar a interface de cadastro.
2. Vincular os dados ao usuário autenticado.
3. Implementar consulta e atualização.
4. Validar CPF.
5. Implementar campos bancários.
6. Implementar chave Pix.
7. Implementar proteção de dados sensíveis.
8. Configurar permissões.
9. Validar campos obrigatórios antes do envio de relatórios.

## Regras

- Um usuário terá apenas um cadastro complementar ativo.
- O usuário poderá atualizar seus dados.
- Não será possível modificar dados de outros usuários.
- O administrador terá acesso somente aos dados necessários às suas atribuições.
- Dados bancários não deverão aparecer completos em listagens gerais.

## Interface

Criar a tela:

**Meu Perfil de Reembolso**

Seções:

- Dados pessoais.
- Dados bancários.
- Chave Pix.

## Critério de conclusão

Um usuário autenticado deverá conseguir cadastrar, consultar e atualizar seus próprios dados.

---

# FASE 4 — GESTÃO DE RELATÓRIOS

## Objetivo

Implementar o ciclo inicial de criação e gerenciamento dos relatórios.

## Atividades

1. Criar serviço de relatórios.
2. Implementar criação.
3. Implementar consulta.
4. Implementar atualização.
5. Implementar exclusão de rascunhos, conforme política de retenção.
6. Implementar identificação sequencial.
7. Implementar filtros.
8. Implementar paginação.
9. Implementar validação de propriedade.
10. Implementar os estados iniciais do relatório.

## Interface

### Tela: Meus Relatórios

Colunas:

- Número.
- Título.
- Período.
- Valor total.
- Status.
- Data de criação.
- Ações.

### Tela: Novo Relatório

Campos:

- Título.
- Período.
- Projeto, quando disponível.
- Centro de custo, quando disponível.
- Descrição geral.

### Tela: Detalhes do Relatório

Exibir:

- Identificação.
- Informações gerais.
- Despesas.
- Valor total.
- Comprovantes.
- Histórico.
- Ações permitidas.

## Regras

- Um relatório pertence a um usuário.
- O usuário somente poderá alterar seus relatórios editáveis.
- O número do relatório deverá ser único.
- O total será inicialmente zero.
- O status inicial será RASCUNHO.

## Critério de conclusão

O usuário deverá conseguir criar um relatório, visualizá-lo, atualizá-lo e consultar sua listagem.

---

# FASE 5 — LANÇAMENTOS E COMPROVANTES

## Objetivo

Implementar o registro financeiro das despesas e os documentos associados.

## Atividades

1. Criar serviço de despesas.
2. Implementar cadastro de lançamento.
3. Implementar edição.
4. Implementar exclusão autorizada.
5. Implementar categorias.
6. Implementar cálculo automático.
7. Implementar upload de arquivos.
8. Implementar visualização de anexos.
9. Implementar download protegido.
10. Implementar exclusão autorizada de anexos.
11. Implementar detecção de possíveis duplicidades.
12. Implementar tratamento de falhas no armazenamento.

## Regras

Cada lançamento deverá possuir:

- Data.
- Categoria.
- Descrição.
- Justificativa.
- Valor maior que zero.
- Pelo menos um comprovante para envio à aprovação.

Permitir múltiplos arquivos por lançamento.

Os formatos aceitos deverão incluir:

- PDF.
- PNG.
- JPG.
- JPEG.
- WEBP.

O sistema deverá validar o tipo real e o tamanho dos arquivos.

## Cálculo financeiro

O total do relatório será:

TOTAL = SOMA(DESPESAS)

O cálculo deverá ocorrer no backend.

O frontend deverá apenas apresentar o valor retornado pelo serviço.

Não permitir que o cliente determine ou substitua o total.

## Interface

Criar um formulário de despesa com:

- Data.
- Categoria.
- Valor.
- Descrição.
- Justificativa.
- Área de upload.
- Visualização de comprovantes.

Na página do relatório, exibir uma tabela com os lançamentos e uma seção de totalização.

## Critério de conclusão

Um relatório deverá aceitar múltiplas despesas e comprovantes, mantendo o total correto após qualquer alteração válida.

---

# FASE 6 — WORKFLOW DE APROVAÇÃO

## Objetivo

Implementar o fluxo administrativo completo de análise.

## Estados

RASCUNHO

ENVIADO

EM_ANALISE

DEVOLVIDO

APROVADO

REJEITADO

PAGO

## Transições

RASCUNHO → ENVIADO

ENVIADO → EM_ANALISE

EM_ANALISE → APROVADO

EM_ANALISE → REJEITADO

EM_ANALISE → DEVOLVIDO

DEVOLVIDO → ENVIADO

APROVADO → PAGO

## Atividades

1. Implementar validação de envio.
2. Implementar bloqueio de edição.
3. Implementar fila administrativa.
4. Implementar abertura para análise.
5. Implementar aprovação.
6. Implementar rejeição.
7. Implementar devolução.
8. Implementar correção e reenvio.
9. Implementar histórico.
10. Implementar proteção contra operações simultâneas.

## Regras de envio

Antes do envio, verificar:

- Existência de despesas.
- Validade dos valores.
- Existência de justificativas.
- Existência dos comprovantes.
- Existência de dados válidos para reembolso.

## Regras administrativas

O administrador poderá:

- Consultar relatórios.
- Visualizar comprovantes.
- Iniciar análise.
- Aprovar.
- Rejeitar.
- Devolver para correção.

Rejeição e devolução exigirão justificativa.

A aprovação deverá registrar o administrador responsável e a data da decisão.

Não permitir aprovação do próprio relatório sem autorização explícita da política de negócio.

## Interface

Criar:

**Relatórios Pendentes**

**Análise de Relatório**

**Histórico de Aprovações**

## Critério de conclusão

O fluxo completo de envio, análise, aprovação, rejeição, devolução e reenvio deverá funcionar com permissões e auditoria.

---

# FASE 7 — GESTÃO DE REEMBOLSOS

## Objetivo

Implementar o registro dos pagamentos de relatórios aprovados.

## Atividades

1. Criar consulta de relatórios aprovados.
2. Criar serviço de pagamento.
3. Implementar registro de pagamento integral.
4. Implementar upload de comprovante bancário.
5. Registrar administrador responsável.
6. Registrar data e referência da transação.
7. Alterar status para PAGO.
8. Atualizar os indicadores.
9. Implementar prevenção contra pagamentos duplicados.

## Interface

### Reembolsos Pendentes

Exibir:

- Número.
- Solicitante.
- Valor aprovado.
- Data de aprovação.
- Situação.

### Registrar Pagamento

Campos:

- Data.
- Valor.
- Forma de pagamento.
- Referência.
- Comprovante.
- Observações.

## Regras

- Apenas relatórios aprovados poderão ser pagos.
- O pagamento integral deverá corresponder ao valor aprovado.
- Não permitir pagamento duplicado.
- Não permitir pagamentos de relatórios rejeitados.
- O registro de pagamento deverá ser transacional.
- A confirmação do pagamento deverá registrar evento de auditoria.

## Critério de conclusão

O administrador deverá conseguir registrar o reembolso e o solicitante deverá visualizar a confirmação do pagamento.

---

# FASE 8 — DASHBOARDS

## Objetivo

Criar indicadores para usuários e administradores.

## Dashboard do usuário

Indicadores:

- Total de relatórios.
- Rascunhos.
- Enviados.
- Em análise.
- Devolvidos.
- Aprovados.
- Pagos.
- Valor solicitado.
- Valor aprovado e não pago.
- Valor reembolsado.

Adicionar listagem dos relatórios recentes.

## Dashboard administrativo

Indicadores:

- Total de solicitações.
- Pendentes de análise.
- Em análise.
- Aprovadas.
- Rejeitadas.
- Devolvidas.
- Pagas.
- Valor total solicitado.
- Valor aprovado pendente.
- Valor reembolsado.

Gráficos:

- Despesas mensais.
- Despesas por categoria.
- Despesas por usuário.
- Despesas por projeto.
- Distribuição por status.

## Regras

- Os indicadores deverão ser calculados com dados reais.
- As consultas deverão respeitar permissões.
- Não utilizar valores fictícios.
- Implementar filtros por período.
- Evitar consultas excessivas ou processamento desnecessário.

## Critério de conclusão

Os indicadores deverão refletir os registros persistidos e respeitar o escopo de cada usuário.

---

# FASE 9 — EXPORTAÇÃO E NOTIFICAÇÕES

## Objetivo

Implementar a documentação formal dos relatórios e a comunicação entre usuários e administradores.

## Exportação PDF

Criar um documento contendo:

- Identificação da empresa.
- Número do relatório.
- Identificação do solicitante.
- Período.
- Projeto.
- Descrição.
- Relação de despesas.
- Valores.
- Total.
- Status.
- Histórico de aprovação.
- Dados da aprovação.
- Informações do pagamento, quando aplicável.

Oferecer acesso autorizado aos comprovantes.

Quando viável, permitir exportação consolidada contendo relatório e anexos.

## Notificações

Implementar eventos para:

- Envio.
- Início da análise.
- Aprovação.
- Rejeição.
- Devolução.
- Reenvio.
- Pagamento.

Reutilizar o sistema de notificações existente.

Na ausência de um mecanismo compatível, implementar notificações internas simples.

## Critério de conclusão

Os documentos deverão ser gerados corretamente e os usuários deverão receber notificações dos principais eventos.

---

# FASE 10 — SEGURANÇA, TESTES E HOMOLOGAÇÃO

## Objetivo

Garantir que o módulo esteja funcional, consistente, seguro e integrado à aplicação.

## Testes funcionais

Validar:

1. Cadastro complementar.
2. Criação de relatório.
3. Edição de rascunho.
4. Inclusão de despesas.
5. Upload de comprovantes.
6. Cálculo de valores.
7. Envio para aprovação.
8. Aprovação.
9. Rejeição.
10. Devolução.
11. Correção.
12. Reenvio.
13. Registro de pagamento.
14. Exportação PDF.
15. Dashboards.
16. Notificações.

## Testes de segurança

Verificar:

- Acesso não autorizado.
- Acesso a relatórios de terceiros.
- Acesso indevido a comprovantes.
- Escalada de privilégios.
- Manipulação de valores.
- Transições de status inválidas.
- Upload de arquivos inválidos.
- Exposição de dados bancários.
- Pagamentos duplicados.
- Operações concorrentes.

## Testes de integração

Verificar:

- Compatibilidade com autenticação existente.
- Compatibilidade com autorização existente.
- Compatibilidade com banco de dados.
- Compatibilidade com upload e armazenamento.
- Compatibilidade com layout.
- Compatibilidade com serviços existentes.
- Ausência de regressões nos módulos atuais.

## Homologação

Executar um cenário completo:

1. Um usuário cria seu cadastro.
2. Cria um relatório.
3. Adiciona três despesas.
4. Anexa os comprovantes.
5. Envia para aprovação.
6. Um administrador inicia a análise.
7. O administrador devolve o relatório.
8. O usuário corrige a informação.
9. O usuário reenvia.
10. O administrador aprova.
11. O administrador registra o pagamento.
12. O usuário visualiza o status PAGO.
13. Ambos consultam o histórico.
14. O relatório é exportado em PDF.

## Critério de conclusão

O módulo deverá executar o fluxo integral sem falhas críticas, inconsistências financeiras ou violações de permissões.

---

# CONTROLE DE EXECUÇÃO DO CODEX

## 1. Desenvolvimento incremental

Executar as fases na sequência definida.

Não iniciar uma fase dependente de outra incompleta.

Antes de executar uma fase, verificar os entregáveis anteriores.

## 2. Registro de progresso

Manter atualizado o arquivo:

`docs/expense-management/progress.md`

Registrar:

- Fases concluídas.
- Atividades em andamento.
- Pendências.
- Arquivos modificados.
- Migrações.
- Testes.
- Decisões técnicas.
- Problemas encontrados.

## 3. Critérios de qualidade

O código deverá:

- Seguir os padrões existentes.
- Possuir responsabilidades bem definidas.
- Evitar duplicação de lógica.
- Centralizar validações críticas.
- Centralizar regras de autorização.
- Ser organizado e extensível.
- Possuir tratamento consistente de erros.
- Manter rastreabilidade das operações financeiras.
- Possuir testes relevantes.

## 4. Preservação da aplicação

Não remover módulos existentes.

Não alterar a autenticação global sem necessidade.

Não modificar configurações de infraestrutura sem justificativa.

Não executar migrações destrutivas.

Não remover dados existentes.

Não introduzir novas dependências quando houver soluções compatíveis disponíveis.

## 5. Finalização de cada fase

Ao concluir cada etapa, apresentar:

**Fase concluída:** identificação.

**Implementações:** funcionalidades entregues.

**Arquivos:** arquivos criados ou modificados.

**Banco de dados:** alterações realizadas.

**Testes:** verificações executadas e resultados.

**Pendências:** questões ainda não resolvidas.

**Próxima fase:** etapa seguinte.

Atualizar os arquivos de progresso e planejamento.

Interromper o avanço somente quando existir um impedimento técnico real ou uma decisão que envolva risco relevante de segurança, perda de dados ou incompatibilidade arquitetural.

---

# RESULTADO FINAL ESPERADO

Entregar um módulo completo de Gestão de Despesas e Reembolsos, integrado à aplicação existente, contendo:

- Cadastro complementar de usuários.
- Dados bancários protegidos.
- Relatórios de despesas.
- Lançamentos individuais.
- Comprovantes fiscais.
- Fluxo de aprovação.
- Controle de reembolsos.
- Dashboards.
- Exportação PDF.
- Notificações.
- Histórico de auditoria.
- Controle de permissões.
- Testes funcionais e de segurança.

A implementação deverá permitir evolução futura para:

- OCR de notas fiscais.
- Aprovação individual de despesas.
- Aprovação parcial.
- Pagamentos parciais.
- Política de limites por categoria.
- Gestão de adiantamentos.
- Integração com ordens de serviço.
- Integração financeira.
- Relatórios gerenciais por cliente, projeto e centro de custo.

**Prioridade: entregar uma solução funcional, segura, consistente e integrada, sem reconstruir funcionalidades que já existem na aplicação.**