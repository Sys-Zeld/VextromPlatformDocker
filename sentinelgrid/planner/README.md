# SentinelGrid — Planner de Implementação

> Módulo de **gestão de manutenção de equipamentos críticos de energia** (UPS,
> retificadores, carregadores, inversores, chaves estáticas, bancos de baterias,
> BMS, transformadores associados, painéis de bypass) da VextromPlatform.
>
> **Status:** `in_development` — em fase de planejamento e bootstrap.
> **Stack:** mesma da plataforma (Node.js/Express + PostgreSQL isolado por módulo)
> com o **frontend em React + Vite** (SPA sob `/app`), seguindo o padrão da
> migração já em curso do Report Service.

Este diretório reúne os planners de **análise e aprovação** antes da
implementação. Nada de código de produto é escrito até a aprovação do roadmap —
a única alteração concreta desta etapa é o **card do SentinelGrid no Service
Hub com selo "Em desenvolvimento"** (ver [03](03-integracao-plataforma.md)).

## Índice

| # | Documento | Conteúdo |
|---|-----------|----------|
| 00 | [Contexto e Arquitetura](00-contexto-e-arquitetura.md) | Domínio, princípios, como o módulo encaixa na arquitetura VextromPlatform (isolamento de DB, registro de router, SPA React). |
| 01 | [Modelo de Dados](01-modelo-de-dados.md) | Mapeamento das 25 entidades de negócio → tabelas, relacionamentos e enums. |
| 02 | [Roadmap de Implementação](02-roadmap-de-implementacao.md) | Fases 0→9, objetivo, entregáveis, backend, frontend e critérios de aceite de cada fatia. |
| 03 | [Integração com a Plataforma](03-integracao-plataforma.md) | Service Hub, toggle de ambiente, `package.json`, migrations, scripts e roteamento SPA. |
| 04 | [Phase de Implementação (log vivo)](04-phase-implementacao.md) | **Contexto de memória de implementação:** registro cronológico de toda modificação/decisão feita. Atualizar a cada fatia. |
| 05 | [Decisões Arquiteturais (ADRs)](05-decisoes-arquiteturais.md) | Registro imutável das decisões de arquitetura (isolamento total, infra compartilhada, migrations versionadas, terminologia OM≠OS, MVP…). |

## Documento-fonte de regras de negócio

As regras de negócio completas estão em
[`../.claude/Regras de Negócio.md`](../.claude/Regras%20de%20Neg%C3%B3cio.md).
Este planner **traduz** aquelas regras para a arquitetura técnica da plataforma;
em caso de divergência, as regras de negócio prevalecem e o planner é ajustado.

## Princípio de execução

Uma **fatia por vez**, com validação no navegador entre elas (mesmo fluxo já
acordado no Report Service). Cada fase abaixo é independentemente entregável e
deixa o módulo em estado funcional e demonstrável.

> **Registro obrigatório:** toda nova modificação/implementação — de qualquer
> fase — deve ser anotada em [04 — Phase de Implementação](04-phase-implementacao.md),
> que é o contexto de memória vivo do módulo. O roadmap (02) diz o que fazer; o
> log (04) diz o que foi feito.
