# VextromPlatform — skill e auditoria OWASP Top 10

Em 2026-07-13 foi criada e aplicada a skill `owasp-top-10`, baseada em OWASP Top 10:2025 e ASVS 5.0.0. A fonte versionável está em `skills/owasp-top-10/` e a instalação global em `C:\Users\User\.codex\skills\owasp-top-10`.

O relatório de prontidão está em `security/owasp-top10-audit-2026-07-13.md`. A revisão cobriu Node/Express, SpecFlow, Service Report, SentinelGrid, Module Spec, React, PostgreSQL, uploads, HTML/PDF, IA, Docker e dependências.

Correções aplicadas: produção falha sem senha administrativa forte e segredos independentes de sessão/API; `.env.example` usa placeholders; Compose de produção exige credenciais do MinIO; HTML variável de e-mails padrão é escapado.

Riscos abertos prioritários: rotacionar qualquer credencial que tenha sido usada a partir do antigo `.env.example`, pois o histórico Git a preserva; auditoria npm do backend com 6 altas, 19 moderadas e 2 baixas; frontend com 2 baixas; CSP ainda usa `unsafe-inline`; contêiner de app adiciona `SYS_ADMIN`; imagens auxiliares usam `latest`; falta telemetria centralizada de eventos de segurança e testes dinâmicos de autorização por objeto.

Validações concluídas: `node --check` nos três JS alterados, 9 testes de Module Spec, build do frontend, validação do Compose de produção, teste de rejeição/aceitação de segredos em produção e `git diff --check`.

Não declarar o produto certificado com base nesta revisão. Usar “avaliação de prontidão OWASP” até concluir correções abertas, DAST/pentest e verificação ASVS requisito a requisito.
