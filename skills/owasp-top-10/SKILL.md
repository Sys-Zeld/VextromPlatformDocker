---
name: owasp-top-10
description: Auditar, fortalecer e documentar aplicações web e APIs segundo OWASP Top 10:2025 e OWASP ASVS 5.0.0. Usar quando Codex receber pedidos de revisão OWASP, preparação para certificação, análise de vulnerabilidades, hardening, threat modeling, revisão de autenticação/autorização, uploads, injeção, dependências, logs, tratamento de erros ou segurança de código Node/Express, React e PostgreSQL.
---

# OWASP Top 10

Executar revisão baseada em evidências. Não declarar uma aplicação “certificada” apenas por revisão de código: diferenciar auditoria de prontidão, teste técnico e certificação independente.

## Fluxo obrigatório

1. Definir escopo, ativos, fronteiras de confiança, dados sensíveis e superfícies expostas.
2. Identificar stack, entrypoints, middlewares, rotas, jobs, integrações, uploads, renderização e persistência.
3. Ler [references/owasp-2025.md](references/owasp-2025.md). Em VextromPlatform, ler também [references/vextrom-platform.md](references/vextrom-platform.md).
4. Inspecionar cada categoria A01–A10 com busca estática e leitura do caminho completo: entrada → validação → autorização → operação → resposta/log.
5. Tratar resultado de ferramenta como pista, não como achado confirmado. Reproduzir ou demonstrar o fluxo no código.
6. Classificar achados em crítico, alto, médio, baixo ou informativo; registrar CWE/OWASP, ativo afetado, evidência, cenário, impacto e correção.
7. Corrigir achados confirmados quando autorizado. Preservar contratos e alterações existentes; preferir controles centralizados e testes de regressão.
8. Validar sintaxe, testes focados, build, auditoria de dependências e `git diff --check`. Declarar verificações que não puderam ser executadas.
9. Produzir matriz A01–A10 com `Atende`, `Parcial`, `Não atende` ou `Não testado`. Nunca transformar ausência de evidência em aprovação.

## Regras de análise

- Verificar autorização por objeto e função em todas as rotas mutáveis e leituras sensíveis.
- Exigir queries parametrizadas; revisar separadamente identificadores/ordenação interpolados.
- Tratar HTML, Markdown, templates, `srcDoc`, URLs e nomes de arquivo como contextos de saída distintos.
- Validar uploads por tamanho, assinatura, MIME, extensão, nome, armazenamento e autorização de leitura.
- Revisar sessão, cookies, CSRF, rate limit, recuperação de conta, segredos e comparação criptográfica.
- Revisar SSRF em toda URL controlável e command injection em `child_process`, shell, conversores e ferramentas externas.
- Revisar dependências diretas, lockfiles, imagens Docker e scripts de instalação; não aplicar atualização ampla sem avaliar regressão.
- Garantir que logs não incluam segredo, cookie, token, senha, documento ou conteúdo técnico sensível.
- Garantir erros consistentes, sem stack/SQL/caminho interno no cliente, e rollback/cleanup em falhas parciais.
- Para IA, revisar prompt injection, extração não confiável, limites de arquivo, saída estruturada e escrita autônoma.

## Saída mínima

Entregar primeiro os achados acionáveis, ordenados por risco. Para cada um, incluir localização clicável, evidência concisa, impacto e estado da correção. Depois apresentar cobertura A01–A10, testes executados, limitações e riscos aceitos.

Usar o termo “prontidão OWASP” ou “avaliação de conformidade”. Reservar “certificado” para processo formal com escopo, versão do padrão, evidências, testes e entidade avaliadora definidos.
