# Prompt — Regras de Negócio para Sistema de Gestão de Manutenção de Equipamentos Críticos

Crie as regras de negócio para um sistema de gestão de manutenção de equipamentos críticos de energia.

O foco do sistema é controlar o ciclo de vida de manutenção de equipamentos como **UPS**, **retificadores**, **carregadores de baterias**, **inversores**, **chaves estáticas**, **bancos de baterias**, **BMS**, **transformadores associados**, **painéis de bypass** e demais ativos de energia crítica.

---

## 1. Conceito Central do Sistema

O sistema deve ser orientado pelo **equipamento**.

A entidade central será o **Equipamento**, pois todo o planejamento, histórico, manutenção, calendário, cliente, site, área, gestor, criticidade, recomendações e relatórios associados devem estar vinculados ao ativo físico.

A lógica principal deve seguir a hierarquia:

```text
Cliente → Site → Área → Equipamento
```

Todo equipamento deve pertencer obrigatoriamente a:

* um cliente;
* um site;
* uma área;
* um tipo de equipamento;
* um fabricante;
* um modelo;
* um gestor responsável do cliente;
* um plano de manutenção próprio.

Nenhuma manutenção deve existir sem estar vinculada a um equipamento.

---

## 2. Objetivo do Sistema

O sistema deve permitir:

* cadastrar clientes, sites, áreas e equipamentos;
* controlar o plano de manutenção individual de cada equipamento;
* planejar manutenções conforme recomendação do fabricante;
* gerar calendário anual de manutenções;
* criar ordens de manutenção preventivas e corretivas;
* registrar todas as manutenções realizadas;
* associar relatórios técnicos já existentes às manutenções;
* registrar recomendações técnicas;
* acompanhar pendências;
* manter histórico técnico completo do equipamento;
* gerar indicadores de manutenção, confiabilidade e risco.

O objetivo principal é garantir **rastreabilidade técnica**, **controle de ativos críticos**, **redução de falhas recorrentes**, **planejamento preventivo**, **controle contratual** e **maior confiabilidade operacional**.

---

## 3. Entidades Principais

Considere as seguintes entidades de negócio:

1. Cliente
2. Site
3. Área
4. Gestor do Cliente
5. Equipamento
6. Tipo de Equipamento
7. Fabricante
8. Modelo de Equipamento
9. Programa de Manutenção
10. Plano de Manutenção do Equipamento
11. Ordem de Manutenção
12. Relatório Técnico Associado
13. Checklist de Manutenção
14. Medição Técnica
15. Peça ou Componente Substituído
16. Recomendação Técnica
17. Calendário Anual de Manutenção
18. Histórico do Equipamento
19. Anexo Técnico
20. Usuário Técnico
21. Contrato ou Escopo de Atendimento
22. Criticidade do Equipamento
23. Status Operacional
24. Evento ou Alarme
25. Aprovação do Cliente

---

## 4. Cliente

A entidade **Cliente** representa a empresa atendida.

Deve possuir, no mínimo:

* nome do cliente;
* CNPJ ou identificação fiscal;
* segmento de atuação;
* contatos principais;
* sites vinculados;
* contratos ativos;
* equipamentos vinculados;
* status do cliente;
* observações gerais.

Um cliente pode possuir vários sites.

---

## 5. Site

A entidade **Site** representa uma unidade física do cliente.

Exemplos:

* plataforma offshore;
* data center;
* fábrica;
* terminal;
* subestação;
* prédio corporativo;
* planta industrial;
* unidade operacional.

O site deve possuir:

* cliente vinculado;
* nome do site;
* localização;
* tipo de site;
* contato local;
* áreas internas;
* observações.

Um site pertence a um cliente e pode possuir várias áreas.

---

## 6. Área

A entidade **Área** representa a localização física ou funcional onde o equipamento está instalado.

Exemplos:

* sala de UPS;
* sala de baterias;
* sala elétrica;
* sala de automação;
* sala de telecom;
* data hall;
* subestação;
* painel crítico;
* área classificada.

A área deve possuir:

* site vinculado;
* nome da área;
* tipo da área;
* classificação da área;
* restrições de acesso;
* condições ambientais relevantes;
* observações.

Uma área pertence a um site e pode conter vários equipamentos.

---

## 7. Equipamento

A entidade **Equipamento** é a entidade central do sistema.

Cada equipamento deve possuir cadastro técnico próprio.

Campos mínimos recomendados:

* cliente;
* site;
* área;
* TAG operacional;
* tipo de equipamento;
* fabricante;
* modelo;
* número de série;
* potência nominal;
* tensão de entrada;
* tensão de saída;
* tensão DC;
* frequência;
* configuração de redundância;
* quantidade de módulos;
* tipo de bateria associada, quando aplicável;
* data de instalação;
* data de comissionamento;
* criticidade;
* status operacional;
* gestor responsável do cliente;
* técnico responsável interno;
* plano de manutenção aplicado;
* observações técnicas.

O sistema deve permitir cadastrar, no mínimo, os seguintes tipos de equipamentos:

* UPS;
* retificador;
* carregador de baterias;
* inversor;
* chave estática;
* banco de baterias;
* BMS;
* transformador;
* painel de bypass;
* quadro de distribuição crítica;
* equipamento auxiliar de energia.

---

## 8. Gestor do Cliente

Cada equipamento deve possuir um **gestor responsável do cliente**.

Esse gestor pode ser:

* fiscal técnico;
* responsável pela manutenção;
* responsável pela operação;
* responsável de facilities;
* responsável de elétrica;
* ponto focal do contrato;
* representante autorizado do cliente.

O gestor pode estar vinculado a:

* cliente;
* site;
* área;
* equipamento específico.

O sistema deve permitir identificar quem deve aprovar ou acompanhar cada manutenção.

---

## 9. Fabricante e Modelo

A entidade **Fabricante** deve representar o fabricante do equipamento.

Exemplos:

* Vertiv;
* Chloride;
* CE+T;
* Schneider;
* Eaton;
* Socomec;
* ABB;
* Siemens;
* Huawei;
* Delta;
* Benning;
* outros.

A entidade **Modelo de Equipamento** deve estar vinculada a um fabricante e a um tipo de equipamento.

Um fabricante pode possuir vários modelos.

Cada modelo pode possuir características técnicas padrão e rotinas de manutenção sugeridas.

---

## 10. Programa de Manutenção

A entidade **Programa de Manutenção** representa um modelo padrão de manutenção.

O programa pode ser definido por:

* tipo de equipamento;
* fabricante;
* modelo;
* recomendação do fabricante;
* criticidade;
* contrato;
* ambiente de instalação;
* histórico de falhas;
* política interna do cliente;
* exigência normativa.

O programa deve permitir periodicidades como:

* mensal;
* trimestral;
* semestral;
* anual;
* bienal;
* personalizada.

Exemplo:

| Tipo de Equipamento | Manutenção                        | Periodicidade |
| ------------------- | --------------------------------- | ------------: |
| UPS                 | Preventiva sem parada             |     Semestral |
| UPS                 | Preventiva com parada             |         Anual |
| Banco de baterias   | Inspeção visual e medições        |    Trimestral |
| BMS                 | Verificação de comunicação e logs |     Semestral |
| Chave estática      | Inspeção operacional              |     Semestral |
| Retificador         | Inspeção e medições               |     Semestral |

---

## 11. Plano de Manutenção do Equipamento

O **Programa de Manutenção** é o modelo padrão.

O **Plano de Manutenção do Equipamento** é a aplicação desse programa a um equipamento específico.

Cada equipamento deve possuir seu próprio plano individual.

O plano pode ser ajustado conforme:

* criticidade do ativo;
* ambiente de instalação;
* regime de operação;
* contrato;
* histórico de corretivas;
* recomendação técnica;
* exigência do cliente;
* recomendação do fabricante.

Exemplo:

Um UPS pode ter programa padrão anual, mas, se estiver instalado em uma plataforma offshore ou ambiente agressivo, pode exigir plano semestral ou inspeções adicionais.

---

## 12. Tipos de Manutenção

O sistema deve trabalhar com três tipos principais de manutenção.

---

### 12.1. Manutenção Preventiva Sem Parada

Manutenção realizada com o equipamento em operação.

Não deve envolver desligamento total, transferência obrigatória de carga ou parada programada.

Deve permitir registrar:

* inspeção visual;
* verificação de alarmes;
* leitura de parâmetros;
* medições elétricas;
* verificação de ventilação;
* verificação de temperatura;
* verificação de logs;
* inspeção externa;
* inspeção de baterias;
* verificação de BMS;
* limpeza externa;
* recomendações técnicas.

---

### 12.2. Manutenção Preventiva Com Parada

Manutenção planejada com intervenção mais profunda.

Pode envolver:

* transferência para bypass;
* desligamento controlado;
* inspeção interna;
* limpeza interna;
* reaperto;
* testes funcionais;
* testes de transferência;
* verificação de placas;
* inspeção de ventiladores;
* inspeção de capacitores;
* inspeção de contatores;
* inspeção de disjuntores;
* inspeção de barramentos;
* medições detalhadas;
* substituição preventiva de componentes.

Esse tipo de manutenção deve exigir controle maior, incluindo:

* janela de parada;
* aprovação do cliente;
* responsável do cliente;
* plano de manobra;
* análise de risco;
* plano de retorno;
* condição inicial;
* condição final;
* registro de pendências.

---

### 12.3. Manutenção Corretiva

Manutenção causada por falha, alarme, anomalia ou emergência.

Deve permitir registrar:

* data da ocorrência;
* sintoma observado;
* alarme apresentado;
* impacto operacional;
* condição inicial do equipamento;
* causa provável;
* causa raiz, quando conhecida;
* ação executada;
* peça substituída;
* condição final;
* recomendação definitiva;
* necessidade de nova intervenção;
* urgência;
* responsável técnico.

A manutenção corretiva pode ser classificada como:

* emergencial;
* urgente;
* programada;
* paliativa;
* definitiva.

---

## 13. Ordem de Manutenção

Toda manutenção deve gerar uma **Ordem de Manutenção**.

A Ordem de Manutenção deve representar uma atividade planejada, agendada, executada ou emergencial.

Campos mínimos recomendados:

* número da ordem;
* equipamento vinculado;
* cliente;
* site;
* área;
* tipo de manutenção;
* data prevista;
* data agendada;
* data executada;
* técnico responsável;
* gestor do cliente;
* status;
* escopo previsto;
* atividades executadas;
* medições;
* peças substituídas;
* recomendações;
* relatório técnico associado;
* anexos;
* observações;
* condição final do equipamento.

Status mínimos recomendados:

| Status                   | Significado                          |
| ------------------------ | ------------------------------------ |
| Planejada                | Criada a partir do plano             |
| Agendada                 | Possui data definida                 |
| Aguardando aprovação     | Depende de liberação do cliente      |
| Aprovada                 | Liberada para execução               |
| Em execução              | Atividade em andamento               |
| Concluída                | Finalizada sem pendências críticas   |
| Concluída com pendências | Finalizada com recomendações abertas |
| Reprogramada             | Data alterada                        |
| Cancelada                | Atividade cancelada                  |
| Emergencial              | Criada por falha ou evento crítico   |

---

## 14. Relatório Técnico Associado

O sistema não deve possuir um módulo próprio de criação de relatório técnico completo.

O relatório técnico será produzido em outro módulo, ferramenta ou sistema já existente.

O sistema de gestão de manutenção deve apenas permitir:

* associar relatório técnico existente;
* anexar arquivo;
* vincular PDF;
* informar código do relatório;
* informar link externo;
* informar ID de integração;
* vincular documento gerado por outro sistema.

Cada Ordem de Manutenção poderá possuir:

* nenhum relatório associado;
* um relatório associado;
* vários relatórios associados.

A ausência de relatório pode ser tratada como:

* permitido;
* pendência;
* alerta;
* bloqueio de encerramento.

Essa regra deve ser configurável conforme tipo de manutenção, contrato ou política interna.

Campos mínimos do Relatório Técnico Associado:

* código do relatório;
* título;
* data de emissão;
* responsável técnico;
* tipo de relatório;
* arquivo anexado;
* link externo;
* ID externo ou de integração;
* observações;
* Ordem de Manutenção vinculada;
* equipamento vinculado.

O histórico do equipamento deve exibir claramente quais manutenções possuem relatório técnico associado.

---

## 15. Checklist de Manutenção

O sistema deve permitir checklists específicos por:

* tipo de equipamento;
* fabricante;
* modelo;
* tipo de manutenção;
* criticidade.

Um checklist de UPS não deve ser igual ao checklist de banco de baterias, retificador ou chave estática.

Exemplos de itens para UPS:

* verificar alarmes ativos;
* verificar histórico de eventos;
* medir tensão de entrada;
* medir tensão de saída;
* medir tensão DC;
* verificar corrente por fase;
* verificar carga percentual;
* verificar ventiladores;
* verificar temperatura interna;
* verificar status de bypass;
* verificar comunicação;
* verificar estado das baterias.

Exemplos de itens para banco de baterias:

* inspeção visual dos blocos;
* verificação de estufamento;
* verificação de vazamento;
* medição de tensão por bloco;
* medição de temperatura;
* medição de resistência interna;
* verificação de torque;
* verificação de interligações;
* verificação de autonomia estimada;
* análise de necessidade de teste de descarga.

---

## 16. Medições Técnicas

O sistema deve permitir registrar medições técnicas associadas à manutenção.

As medições devem estar vinculadas a:

* equipamento;
* Ordem de Manutenção;
* data da medição;
* técnico responsável.

Medições possíveis:

* tensão de entrada;
* tensão de saída;
* corrente por fase;
* frequência;
* potência ativa;
* potência aparente;
* fator de potência;
* percentual de carga;
* tensão DC;
* corrente DC;
* temperatura ambiente;
* temperatura interna;
* tensão por bloco de bateria;
* resistência interna;
* autonomia estimada;
* THD de tensão;
* THD de corrente;
* alarmes ativos;
* eventos registrados;
* logs relevantes.

---

## 17. Peças ou Componentes Substituídos

O sistema deve permitir registrar componentes substituídos durante uma manutenção.

Exemplos:

* placa de controle;
* placa de interface;
* placa de disparo;
* ventilador;
* capacitor;
* bateria;
* contator;
* disjuntor;
* fusível;
* sensor;
* módulo de potência;
* IGBT;
* display;
* fonte auxiliar;
* comunicação;
* TC;
* relé;
* barramento;
* conector.

Campos mínimos:

* equipamento;
* Ordem de Manutenção;
* descrição da peça;
* código da peça;
* fabricante;
* quantidade;
* motivo da substituição;
* condição da peça removida;
* peça nova instalada;
* observações;
* evidências.

---

## 18. Recomendações Técnicas

Toda recomendação técnica deve ser rastreável.

A recomendação não deve ficar perdida apenas dentro de um relatório ou observação textual.

Cada recomendação deve possuir:

* equipamento vinculado;
* Ordem de Manutenção de origem;
* relatório técnico associado, quando aplicável;
* descrição da recomendação;
* justificativa técnica;
* criticidade;
* prazo sugerido;
* responsável;
* status;
* observações;
* evidências.

Status recomendados:

| Status     | Significado            |
| ---------- | ---------------------- |
| Aberta     | Registrada             |
| Em análise | Aguardando avaliação   |
| Aprovada   | Liberada para execução |
| Rejeitada  | Não aceita             |
| Executada  | Resolvida              |
| Vencida    | Prazo expirado         |
| Cancelada  | Não aplicável          |

Exemplos de recomendações:

* substituir banco de baterias;
* substituir ventiladores;
* substituir capacitores;
* corrigir falha de comunicação do BMS;
* instalar TC individual por string;
* corrigir temperatura da sala;
* revisar aterramento;
* avaliar THD;
* programar teste de descarga;
* substituir placa de controle;
* revisar bypass externo;
* corrigir alarme recorrente.

---

## 19. Calendário Anual de Manutenção

O sistema deve gerar um calendário anual com base no plano de manutenção de cada equipamento.

O calendário deve permitir visualizar manutenções por:

* ano;
* mês;
* cliente;
* site;
* área;
* equipamento;
* tipo de manutenção;
* criticidade;
* técnico responsável;
* gestor do cliente;
* status.

O calendário deve ajudar a evitar:

* manutenção vencida;
* conflito de agenda;
* sobreposição de paradas;
* excesso de atividades no mesmo período;
* ausência de manutenção em equipamentos críticos;
* perda de janela de parada;
* falha de planejamento contratual.

---

## 20. Histórico do Equipamento

O histórico do equipamento deve consolidar todos os eventos relevantes do ativo.

Deve incluir:

* cadastro inicial;
* alterações cadastrais relevantes;
* manutenções preventivas;
* manutenções corretivas;
* relatórios técnicos associados;
* medições;
* peças substituídas;
* recomendações;
* alarmes;
* eventos;
* mudanças de status operacional;
* pendências;
* anexos;
* observações técnicas.

O histórico deve funcionar como um **prontuário técnico do equipamento**.

Ao consultar um equipamento, o usuário deve conseguir entender:

* quando foi instalado;
* quando foi comissionado;
* quais manutenções recebeu;
* quais falhas ocorreram;
* quais componentes foram substituídos;
* quais recomendações estão abertas;
* qual é sua condição atual;
* qual é a próxima manutenção prevista;
* qual é o risco operacional atual.

---

## 21. Status Operacional do Equipamento

O equipamento deve possuir status operacional.

Status recomendados:

| Status                    | Significado                    |
| ------------------------- | ------------------------------ |
| Operacional normal        | Sem restrição conhecida        |
| Operacional com restrição | Funciona, mas possui pendência |
| Em observação             | Requer acompanhamento          |
| Em manutenção             | Em intervenção                 |
| Indisponível              | Fora de operação               |
| Desativado                | Retirado de uso                |
| Substituído               | Trocado por outro ativo        |

O status operacional deve ser atualizado após manutenções, corretivas, recomendações críticas ou eventos relevantes.

---

## 22. Criticidade do Equipamento

Cada equipamento deve possuir classificação de criticidade.

Sugestão:

| Criticidade    | Significado                      |
| -------------- | -------------------------------- |
| Baixa          | Baixo impacto operacional        |
| Média          | Impacto controlado               |
| Alta           | Impacto relevante                |
| Missão crítica | Falha pode causar parada crítica |

A criticidade deve influenciar:

* prioridade de manutenção;
* alertas;
* indicadores;
* escalonamento;
* frequência de inspeção;
* análise de risco;
* exigência de relatório;
* exigência de aprovação do cliente.

---

## 23. Eventos e Alarmes

O sistema deve permitir registrar eventos e alarmes relevantes associados ao equipamento.

Exemplos:

* falha de rede;
* falha de retificador;
* falha de inversor;
* bypass ativo;
* sobretemperatura;
* falha de ventilador;
* baixa tensão DC;
* alta tensão DC;
* falha de bateria;
* falha de comunicação;
* overload;
* VCE Sat;
* falha de carregador;
* alarme de BMS;
* falha de chave estática.

Um evento ou alarme pode gerar:

* manutenção corretiva;
* recomendação técnica;
* mudança de status operacional;
* alerta de risco;
* acompanhamento no histórico.

---

## 24. Aprovação do Cliente

Manutenções com maior impacto devem exigir aprovação do cliente.

Principalmente:

* manutenção preventiva com parada;
* transferência para bypass;
* desligamento total;
* intervenção interna;
* substituição de componente crítico;
* teste funcional com risco operacional;
* teste de bateria;
* corretiva emergencial com impacto na carga crítica.

A aprovação deve registrar:

* responsável aprovador;
* data da aprovação;
* janela autorizada;
* observações;
* restrições;
* condição de liberação;
* aceite final, quando aplicável.

---

## 25. Anexos Técnicos

O sistema deve permitir anexar documentos e evidências.

Exemplos:

* fotos;
* PDFs;
* logs;
* prints de tela;
* curvas de descarga;
* relatórios de BMS;
* manuais;
* documentos do fabricante;
* medições externas;
* certificados;
* evidências de antes e depois.

Os anexos podem estar vinculados a:

* equipamento;
* Ordem de Manutenção;
* recomendação;
* relatório técnico associado;
* evento ou alarme.

---

## 26. Contrato ou Escopo de Atendimento

O sistema deve permitir vincular equipamentos a contratos ou escopos de atendimento.

O contrato pode definir:

* equipamentos cobertos;
* quantidade de manutenções por ano;
* tipos de manutenção inclusos;
* SLA corretivo;
* escopo contratado;
* periodicidade;
* exigência de relatório;
* exigência de aprovação;
* período de vigência;
* cliente;
* site;
* responsável.

O planejamento anual deve considerar o escopo contratado.

---

## 27. Indicadores de Gestão

O sistema deve gerar indicadores de manutenção, confiabilidade e risco.

Indicadores recomendados:

| Indicador                                | Objetivo                         |
| ---------------------------------------- | -------------------------------- |
| Manutenções planejadas versus realizadas | Controle do plano                |
| Manutenções vencidas                     | Risco operacional                |
| Corretivas por equipamento               | Identificar ativos problemáticos |
| Corretivas por cliente                   | Análise contratual               |
| Corretivas por fabricante/modelo         | Análise de confiabilidade        |
| Recomendações abertas                    | Controle de pendências           |
| Recomendações críticas abertas           | Risco operacional                |
| Equipamentos sem plano de manutenção     | Falha de gestão                  |
| Equipamentos sem manutenção prevista     | Falha no calendário              |
| Equipamentos em condição restrita        | Risco atual                      |
| Tempo médio entre falhas                 | MTBF                             |
| Tempo médio de reparo                    | MTTR                             |
| Cumprimento do plano anual               | Gestão contratual                |
| Ativos com falha recorrente              | Necessidade de causa raiz        |

---

## 28. Regras Gerais Obrigatórias

### 28.1. Nenhuma manutenção sem equipamento

Toda Ordem de Manutenção deve estar vinculada a um equipamento.

---

### 28.2. Nenhum equipamento sem cliente, site e área

Todo equipamento deve estar dentro da estrutura:

```text
Cliente → Site → Área → Equipamento
```

---

### 28.3. Cada equipamento possui plano próprio

Mesmo que exista um programa padrão por fabricante ou modelo, cada equipamento deve possuir seu próprio plano de manutenção.

---

### 28.4. Toda manutenção deve gerar histórico

Ao concluir uma manutenção, o sistema deve atualizar automaticamente o histórico do equipamento.

---

### 28.5. Relatório técnico é apenas associado

O sistema não deve criar relatório técnico completo internamente.

O sistema deve apenas permitir associar, anexar ou referenciar relatório técnico já existente.

---

### 28.6. Recomendação técnica deve ser rastreável

Toda recomendação deve possuir status, criticidade, prazo, responsável e vínculo com equipamento.

---

### 28.7. Manutenção com parada exige aprovação

Manutenção preventiva com parada deve exigir aprovação formal ou registro de liberação do cliente.

---

### 28.8. Corretiva deve registrar causa e impacto

Toda corretiva deve registrar sintoma, alarme, impacto, causa provável, ação executada, condição final e recomendação, quando aplicável.

---

### 28.9. Calendário anual deve ser gerado a partir dos planos

O calendário anual deve ser criado com base no plano de manutenção de cada equipamento.

---

### 28.10. Criticidade deve alterar prioridade

Equipamentos de alta criticidade ou missão crítica devem ter prioridade em alertas, vencimentos, recomendações e planejamento.

---

### 28.11. Histórico concluído deve possuir rastreabilidade

Após conclusão de manutenção e associação de informações técnicas, alterações posteriores devem registrar justificativa, usuário e data.

---

## 29. Fluxos de Negócio que Devem Ser Detalhados

Detalhe os seguintes fluxos:

1. Cadastro de cliente, site, área e equipamento.
2. Criação de programa de manutenção por tipo, fabricante e modelo.
3. Aplicação do programa de manutenção a um equipamento específico.
4. Geração automática do calendário anual de manutenção.
5. Execução de manutenção preventiva sem parada.
6. Execução de manutenção preventiva com parada.
7. Execução de manutenção corretiva.
8. Inclusão ou associação de relatório técnico já existente à manutenção.
9. Criação e acompanhamento de recomendações técnicas.
10. Atualização do histórico técnico do equipamento.
11. Geração de indicadores de manutenção, confiabilidade e risco.

---

## 30. Resultado Esperado

A resposta deve apresentar uma especificação clara das regras de negócio do sistema.

A saída deve conter:

* descrição das entidades principais;
* relacionamento entre entidades;
* regras obrigatórias;
* fluxos de negócio;
* status recomendados;
* regras para calendário anual;
* regras para manutenção preventiva sem parada;
* regras para manutenção preventiva com parada;
* regras para manutenção corretiva;
* regras para associação de relatório técnico;
* regras para recomendações técnicas;
* regras para histórico do equipamento;
* indicadores de gestão;
* regras de criticidade e risco.

Não incluir detalhes de programação, stack, framework, banco de dados, APIs, autenticação ou infraestrutura.
