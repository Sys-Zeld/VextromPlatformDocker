# PROJETO: MÓDULO DE GESTÃO DE DESPESAS E REEMBOLSOS

## 1. OBJETIVO

Desenvolver um módulo completo de Gestão de Despesas e Reembolsos, integrado à aplicação existente.

O módulo deverá permitir que usuários autenticados cadastrem despesas profissionais, anexem comprovantes fiscais, organizem lançamentos em relatórios e encaminhem suas solicitações para aprovação administrativa.

Administradores poderão consultar todos os relatórios, analisar os documentos, aprovar, rejeitar, solicitar correções e registrar os reembolsos realizados.

A solução deverá possuir interface moderna, responsiva, intuitiva e compatível com os padrões visuais e arquiteturais existentes.

## 2. DIRETRIZES DE IMPLEMENTAÇÃO

Antes de iniciar o desenvolvimento:

1. Analise a estrutura atual do projeto.
2. Identifique a arquitetura, as dependências, as rotas, os componentes, os modelos de dados e os serviços existentes.
3. Identifique o sistema de autenticação e autorização.
4. Identifique o mecanismo de armazenamento e gerenciamento de arquivos.
5. Identifique os padrões de interface utilizados na aplicação.
6. Reutilize componentes e serviços existentes sempre que possível.
7. Não implemente um sistema de autenticação paralelo.
8. Não substitua tecnologias ou bibliotecas existentes sem necessidade.
9. Preserve a compatibilidade com os módulos atuais.
10. Utilize as convenções de nomenclatura, validação, tratamento de erros e persistência existentes.

Antes de modificar o código, apresente um diagnóstico resumido da arquitetura encontrada e um plano de implementação, identificando arquivos que serão criados ou modificados.

Não presuma a existência de funcionalidades que não foram identificadas no projeto.

Após o diagnóstico, prossiga com a implementação, respeitando os padrões encontrados.

## 3. PERFIS DE ACESSO

O módulo deverá possuir dois perfis funcionais.

### 3.1. USUÁRIO

Permissões:

- Consultar e atualizar seus dados complementares.
- Cadastrar dados bancários.
- Criar relatórios de despesas.
- Adicionar, editar e excluir despesas em relatórios editáveis.
- Anexar comprovantes fiscais.
- Visualizar seus comprovantes.
- Consultar seus próprios relatórios.
- Enviar relatórios para aprovação.
- Acompanhar o status das solicitações.
- Corrigir relatórios devolvidos.
- Consultar o histórico de movimentações dos próprios relatórios.
- Exportar seus relatórios em PDF.

O usuário não poderá visualizar informações privadas nem relatórios pertencentes a outros usuários.

### 3.2. ADMINISTRADOR

Permissões:

- Visualizar todos os relatórios.
- Consultar despesas por usuário.
- Filtrar relatórios por período, status, categoria e projeto.
- Visualizar os comprovantes enviados.
- Aprovar relatórios.
- Rejeitar relatórios mediante justificativa.
- Devolver relatórios para correção.
- Consultar dados necessários ao reembolso.
- Registrar pagamentos.
- Visualizar indicadores financeiros.
- Exportar relatórios individuais e consolidados.
- Consultar o histórico de auditoria.

As permissões deverão ser validadas no backend, independentemente dos controles de visibilidade da interface.

Um administrador não deverá aprovar seu próprio relatório, salvo se uma política explícita da aplicação autorizar essa operação.

## 4. CADASTRO COMPLEMENTAR DO USUÁRIO

Criar um formulário associado à conta autenticada.

Campos:

- Nome completo.
- CPF.
- E-mail.
- Telefone.
- Instituição bancária.
- Agência.
- Conta.
- Dígito.
- Tipo de conta.
- Chave Pix.
- Tipo de chave Pix.

Requisitos:

- Utilizar o identificador do usuário autenticado.
- Evitar duplicidade de cadastros.
- Validar o CPF.
- Validar os formatos dos dados bancários conforme aplicável.
- Permitir atualização pelo próprio titular.
- Proteger os dados pessoais e bancários.
- Restringir sua visualização conforme as permissões.
- Exibir dados bancários parcialmente mascarados quando apropriado.

O usuário poderá criar rascunhos sem ter cadastrado os dados bancários.

Entretanto, o sistema deverá verificar a existência de um meio de reembolso válido antes de permitir o envio para aprovação.

## 5. RELATÓRIO DE DESPESAS

### 5.1. Criação

O usuário poderá criar um relatório contendo:

- Identificador interno único.
- Número sequencial legível.
- Título.
- Descrição geral.
- Usuário solicitante.
- Data inicial.
- Data final.
- Cliente ou projeto, quando aplicável.
- Centro de custo, quando disponível.
- Data de criação.
- Data da última atualização.
- Data de envio.
- Valor total.
- Status.

O número deverá ser gerado automaticamente pelo sistema.

Exemplo:

RD-2026-000001

O relatório poderá agrupar múltiplas despesas.

O valor total deverá ser calculado automaticamente a partir dos lançamentos.

O usuário não poderá alterar diretamente esse valor.

### 5.2. Estados do relatório

Implementar os seguintes estados:

RASCUNHO

ENVIADO

EM_ANALISE

DEVOLVIDO

APROVADO

REJEITADO

PAGO

### 5.3. Transições permitidas

RASCUNHO → ENVIADO

ENVIADO → EM_ANALISE

EM_ANALISE → APROVADO

EM_ANALISE → REJEITADO

EM_ANALISE → DEVOLVIDO

DEVOLVIDO → ENVIADO

APROVADO → PAGO

As transições deverão ser controladas pelo backend.

Regras:

- Relatórios em rascunho poderão ser editados pelo solicitante.
- Relatórios enviados ficarão bloqueados para edição.
- Relatórios em análise ficarão bloqueados para edição.
- Relatórios devolvidos poderão ser corrigidos pelo solicitante.
- Relatórios aprovados não poderão ser alterados.
- Relatórios rejeitados permanecerão disponíveis para consulta.
- Relatórios pagos serão considerados encerrados.

O administrador deverá informar uma justificativa ao rejeitar ou devolver um relatório.

Toda alteração de status deverá gerar um registro de auditoria.

## 6. LANÇAMENTO DE DESPESAS

Cada relatório poderá conter múltiplos lançamentos.

Cada lançamento deverá possuir:

- Identificador único.
- Relatório vinculado.
- Data da despesa.
- Categoria.
- Descrição.
- Justificativa.
- Valor.
- Moeda, inicialmente BRL.
- Estabelecimento ou fornecedor, quando informado.
- Observações adicionais.
- Data de criação.
- Data de atualização.

Categorias iniciais:

1. Alimentação.
2. Hospedagem.
3. Transporte.
4. Combustível.
5. Estacionamento.
6. Pedágio.
7. Materiais.
8. Serviços.
9. Outras despesas.

As categorias deverão ser gerenciadas por uma estrutura extensível, evitando valores rigidamente distribuídos pelo código.

### Regras de validação

- A data da despesa será obrigatória.
- A categoria será obrigatória.
- A descrição será obrigatória.
- A justificativa será obrigatória.
- O valor deverá ser maior que zero.
- Cada lançamento deverá possuir pelo menos um comprovante válido antes do envio.
- O total do relatório deverá ser recalculado após inclusões, edições e exclusões.
- Valores monetários deverão utilizar representação decimal exata, evitando erros de arredondamento.

Uma despesa poderá conter mais de um comprovante.

## 7. GESTÃO DE COMPROVANTES

Implementar um sistema de upload vinculado aos lançamentos.

### Formatos suportados

- PDF.
- PNG.
- JPG.
- JPEG.
- WEBP.

Outros formatos poderão ser adicionados mediante configuração.

### Funcionalidades

- Selecionar arquivos.
- Arrastar e soltar arquivos.
- Visualizar o arquivo selecionado.
- Fazer upload.
- Consultar o arquivo armazenado.
- Remover comprovantes em relatórios editáveis.
- Substituir comprovantes em relatórios editáveis.
- Visualizar PDFs.
- Visualizar imagens.
- Fazer download autorizado.

### Segurança

- Validar extensões e tipos reais dos arquivos.
- Definir limites configuráveis de tamanho.
- Impedir execução de arquivos enviados.
- Armazenar os comprovantes em ambiente não público.
- Gerar identificadores internos para os arquivos.
- Não confiar no nome original do arquivo.
- Validar a permissão de acesso em cada operação.
- Proteger o sistema contra upload de arquivos maliciosos.
- Evitar referências inseguras a arquivos e diretórios.

Armazenar metadados como:

- Identificador do arquivo.
- Identificador da despesa.
- Nome original.
- Tipo do arquivo.
- Tamanho.
- Localização no armazenamento.
- Hash criptográfico.
- Data de inclusão.
- Usuário responsável.

Implementar uma verificação de possível duplicidade baseada no hash do arquivo.

A identificação de duplicidade deverá gerar um alerta, não uma rejeição automática.

## 8. ENVIO PARA APROVAÇÃO

O usuário poderá enviar um relatório quando:

- Existir pelo menos uma despesa cadastrada.
- Todas as despesas possuírem valores válidos.
- Todas as despesas possuírem justificativas.
- Todas as despesas possuírem comprovantes válidos.
- Os dados necessários para reembolso estiverem cadastrados.

Após o envio:

- Registrar a data e hora.
- Alterar o status para ENVIADO.
- Bloquear a edição.
- Registrar a operação no histórico.
- Disponibilizar o relatório para análise administrativa.

Evitar envios duplicados causados por múltiplos cliques ou requisições repetidas.

## 9. MÓDULO ADMINISTRATIVO

Criar uma área exclusiva para administradores.

### 9.1. Listagem de relatórios

Apresentar uma tabela com:

- Número.
- Solicitante.
- Título.
- Período.
- Quantidade de despesas.
- Valor total.
- Data de envio.
- Status.
- Ações disponíveis.

Implementar:

- Busca por número.
- Busca por solicitante.
- Filtro por status.
- Filtro por período.
- Filtro por projeto.
- Ordenação.
- Paginação.

### 9.2. Análise detalhada

Ao selecionar um relatório, apresentar:

**Dados gerais**

- Número.
- Solicitante.
- Período.
- Projeto.
- Descrição.
- Valor total.

**Despesas**

Tabela com todos os lançamentos.

**Comprovantes**

Permitir visualizar cada comprovante diretamente na tela.

**Histórico**

Exibir todas as movimentações do relatório.

**Ações administrativas**

- Iniciar análise.
- Aprovar.
- Rejeitar.
- Devolver para correção.

Implementar confirmação antes das ações de aprovação, rejeição e devolução.

As operações deverão ser transacionais e resistentes a ações simultâneas de diferentes administradores.

## 10. CONTROLE DE PAGAMENTO

Após a aprovação, o relatório deverá ficar disponível para reembolso.

O administrador poderá registrar:

- Data do pagamento.
- Valor pago.
- Forma de pagamento.
- Referência da transação.
- Observações.
- Comprovante do pagamento.

Na primeira versão, implementar pagamento integral por relatório.

O valor pago deverá corresponder ao valor aprovado.

Após registrar o pagamento:

- Alterar o status para PAGO.
- Registrar a data.
- Registrar o administrador responsável.
- Armazenar a referência do pagamento.
- Atualizar os indicadores.
- Notificar o solicitante.

Preparar o modelo para suportar pagamentos parciais em uma evolução futura, sem habilitar essa funcionalidade na primeira versão.

## 11. DASHBOARD DO USUÁRIO

Criar um painel com indicadores:

- Total de relatórios.
- Relatórios em rascunho.
- Relatórios enviados.
- Relatórios em análise.
- Relatórios devolvidos.
- Relatórios aprovados.
- Relatórios pagos.
- Valor total solicitado.
- Valor aprovado e pendente de pagamento.
- Valor efetivamente reembolsado.

Exibir também uma tabela com os relatórios mais recentes.

Disponibilizar uma ação destacada:

"Novo Relatório de Despesas"

## 12. DASHBOARD ADMINISTRATIVO

Criar indicadores consolidados:

- Total de relatórios.
- Relatórios aguardando análise.
- Relatórios em análise.
- Relatórios aprovados.
- Relatórios devolvidos.
- Relatórios rejeitados.
- Relatórios pagos.
- Valor total solicitado.
- Valor aprovado e não pago.
- Valor total reembolsado.

Adicionar visualizações:

- Despesas por mês.
- Despesas por categoria.
- Despesas por usuário.
- Despesas por projeto, quando aplicável.
- Distribuição dos relatórios por status.

Utilizar componentes de visualização compatíveis com a aplicação existente.

Evitar introduzir bibliotecas desnecessárias.

## 13. EXPORTAÇÃO EM PDF

Implementar exportação de relatórios individuais.

O documento deverá conter:

### Cabeçalho

- Identificação da empresa, quando disponível.
- Título: Relatório de Despesas.
- Número do relatório.
- Data de emissão.

### Identificação

- Nome do solicitante.
- CPF parcialmente mascarado.
- Período.
- Projeto.
- Número do relatório.

### Demonstrativo de despesas

Tabela contendo:

- Data.
- Categoria.
- Descrição.
- Valor.

### Resumo

- Quantidade de despesas.
- Valor total solicitado.
- Situação da aprovação.
- Situação do pagamento.

### Aprovação

- Administrador responsável.
- Data da aprovação.
- Observações administrativas.

### Comprovantes

Incluir referências aos comprovantes e, quando tecnicamente viável, oferecer uma exportação consolidada com os documentos anexados.

Não incluir dados bancários completos no PDF por padrão.

A exportação deverá respeitar as permissões do usuário autenticado.

## 14. NOTIFICAÇÕES

Integrar o módulo ao mecanismo de notificações existente.

Eventos:

- Relatório enviado.
- Relatório iniciado para análise.
- Relatório aprovado.
- Relatório rejeitado.
- Relatório devolvido.
- Relatório pago.

As notificações deverão informar:

- Número do relatório.
- Status.
- Data da alteração.
- Responsável pela ação, quando apropriado.
- Justificativa, quando existente.

Se não houver infraestrutura de notificações, implementar inicialmente notificações internas, respeitando a arquitetura existente.

## 15. AUDITORIA

Todas as operações relevantes deverão ser auditadas.

Registrar:

- Identificador do evento.
- Identificador do relatório.
- Usuário responsável.
- Operação executada.
- Status anterior.
- Novo status.
- Data e hora.
- Justificativa.
- Metadados relevantes.

Eventos de auditoria deverão ser persistentes e não editáveis pelas operações normais do módulo.

Manter o histórico mesmo após a conclusão do relatório.

## 16. MODELO DE DADOS

Avaliar o modelo atual e implementar as estruturas necessárias.

Entidades conceituais:

### ExpenseProfile
Cadastro complementar e informações de reembolso do usuário.

### ExpenseReport
Relatório principal.

### ExpenseItem
Lançamento individual.

### ExpenseCategory
Categoria de despesa.

### ExpenseAttachment
Comprovante vinculado ao lançamento.

### ExpenseApprovalHistory
Histórico de aprovação e movimentações.

### ExpensePayment
Registro de pagamento.

### ExpenseAuditLog
Registro de auditoria.

### ExpenseNotification
Notificações relacionadas ao processo, caso não exista estrutura reutilizável.

Criar os relacionamentos e índices necessários.

Manter integridade referencial e evitar exclusões em cascata que eliminem históricos financeiros.

Utilizar migrações compatíveis com o mecanismo existente.

## 17. INTERFACE E EXPERIÊNCIA DO USUÁRIO

A interface deverá ser moderna, objetiva e responsiva.

Reutilizar:

- Layout principal.
- Barra lateral.
- Cabeçalho.
- Componentes de formulário.
- Botões.
- Tabelas.
- Modais.
- Mensagens.
- Ícones.
- Sistema de cores.
- Temas existentes.

### Páginas necessárias

**Usuário**

1. Dashboard de despesas.
2. Meus relatórios.
3. Novo relatório.
4. Detalhes do relatório.
5. Cadastro e edição de despesa.
6. Meus dados bancários.
7. Histórico e acompanhamento.

**Administrador**

8. Dashboard administrativo.
9. Todos os relatórios.
10. Análise e aprovação.
11. Relatórios aprovados.
12. Reembolsos pendentes.
13. Histórico de pagamentos.

Priorizar a reutilização de componentes e telas quando fizer sentido.

### Experiência desejada

- Campos claramente identificados.
- Validações próximas aos campos.
- Máscaras para CPF e valores monetários.
- Feedback visual durante uploads.
- Visualização de comprovantes sem sair da página.
- Confirmação para ações irreversíveis.
- Indicadores de status.
- Mensagens de sucesso e erro.
- Layout adaptado para dispositivos móveis.
- Navegação consistente com a aplicação existente.

## 18. SEGURANÇA E PROTEÇÃO DE DADOS

Implementar:

- Autorização em todas as operações.
- Validação de propriedade dos relatórios.
- Isolamento dos dados entre usuários.
- Proteção contra acesso direto a arquivos de terceiros.
- Validação de entradas.
- Proteção contra manipulação de valores totais.
- Validação das transições de status.
- Proteção dos dados bancários.
- Tratamento seguro de erros.
- Registro de eventos relevantes.
- Controles de acesso aos dados pessoais conforme os princípios da LGPD.

Não expor informações sensíveis em logs, respostas de API ou arquivos públicos.

O perfil administrador não poderá alterar silenciosamente uma solicitação enviada por outro usuário.

## 19. REGRAS DE CONSISTÊNCIA

Garantir que:

1. Cada relatório pertença a um único solicitante.
2. Cada despesa pertença a um relatório.
3. Cada comprovante esteja associado a uma despesa.
4. O total seja calculado exclusivamente a partir das despesas.
5. Relatórios aprovados não possam ser modificados.
6. Relatórios pagos não possam ser pagos novamente.
7. Operações de aprovação sejam idempotentes ou protegidas contra duplicidade.
8. Alterações de status sejam auditadas.
9. Relatórios devolvidos mantenham o histórico anterior.
10. Usuários não tenham acesso aos relatórios de terceiros.
11. Administradores não possam ignorar regras de integridade.
12. Dados bancários necessários ao pagamento sejam preservados adequadamente no histórico da operação, com acesso restrito.
13. Exclusões sejam limitadas aos estados permitidos e não eliminem registros obrigatórios de auditoria.

## 20. TESTES

Implementar testes compatíveis com a estrutura existente.

Cobrir:

- Criação de relatório.
- Edição de rascunho.
- Inclusão de despesa.
- Upload de comprovantes.
- Exclusão de lançamentos.
- Cálculo automático de total.
- Envio para aprovação.
- Aprovação.
- Rejeição.
- Devolução para correção.
- Reenvio de relatório corrigido.
- Registro de pagamento.
- Bloqueio de edição após envio.
- Restrição de acesso entre usuários.
- Restrição de rotas administrativas.
- Tentativas de alteração indevida de status.
- Tentativas de pagamento duplicado.
- Arquivos inválidos.
- Operações simultâneas de aprovação.
- Exportação em PDF.

## 21. ESTRATÉGIA DE IMPLEMENTAÇÃO

Organizar o desenvolvimento em etapas.

### ETAPA 1 — Análise da aplicação

Inspecionar a arquitetura atual e identificar os pontos de integração.

### ETAPA 2 — Modelo de dados

Criar entidades, relacionamentos, validações e migrações.

### ETAPA 3 — Serviços e regras de negócio

Implementar cadastro complementar, relatórios, lançamentos, anexos, permissões e cálculo de valores.

### ETAPA 4 — Workflow administrativo

Implementar envio, análise, aprovação, rejeição e devolução.

### ETAPA 5 — Pagamentos

Implementar registro e controle de reembolsos.

### ETAPA 6 — Interface

Construir as telas do usuário e do administrador.

### ETAPA 7 — Dashboard e exportação

Implementar indicadores, filtros, consultas e geração de PDF.

### ETAPA 8 — Auditoria e testes

Validar permissões, integridade, transições e segurança.

## 22. CRITÉRIOS DE ACEITAÇÃO

A implementação será considerada concluída quando:

- Um usuário autenticado conseguir cadastrar seus dados.
- O usuário conseguir criar relatórios.
- O usuário conseguir adicionar múltiplas despesas.
- Cada despesa aceitar comprovantes.
- O sistema calcular corretamente os valores.
- O usuário conseguir enviar relatórios para aprovação.
- Os relatórios enviados ficarem bloqueados para edição.
- O administrador conseguir visualizar todos os relatórios.
- O administrador conseguir aprovar, rejeitar e devolver relatórios.
- O usuário conseguir corrigir e reenviar relatórios devolvidos.
- O administrador conseguir registrar pagamentos.
- O sistema impedir pagamentos duplicados.
- O usuário conseguir acompanhar o andamento.
- Os dashboards apresentarem dados coerentes.
- A exportação em PDF funcionar.
- As permissões de acesso forem respeitadas.
- As operações relevantes possuírem rastreabilidade.
- O módulo estiver integrado ao sistema existente sem comprometer outras funcionalidades.

## 23. ORIENTAÇÕES FINAIS

Não desenvolver uma aplicação independente.

O objetivo é implementar um módulo funcional dentro da aplicação atual.

Não redefinir a stack tecnológica.

Não recriar mecanismos existentes de autenticação, autorização, armazenamento ou interface.

Não modificar funcionalidades externas ao escopo sem necessidade.

Evitar implementações demonstrativas, dados fictícios permanentes e comportamentos simulados.

Quando encontrar uma dependência não disponível ou uma decisão de negócio não especificada, utilizar a alternativa mais simples e segura compatível com a aplicação, documentando a decisão.

Ao concluir, apresentar:

- Resumo das funcionalidades implementadas.
- Arquivos criados e modificados.
- Migrações necessárias.
- Rotas e permissões adicionadas.
- Testes executados e resultados.
- Limitações identificadas.
- Recomendações para futuras evoluções.