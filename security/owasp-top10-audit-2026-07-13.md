# Avaliação de prontidão OWASP Top 10 — VextromPlatform

Data: 2026-07-13  
Referências: OWASP Top 10:2025 e OWASP ASVS 5.0.0  
Escopo: backend Node/Express, módulos SpecFlow, Service Report, SentinelGrid e Module Spec, SPA React, persistência PostgreSQL, uploads, integrações, Docker e dependências npm.

## Resultado executivo

Esta é uma revisão estática de prontidão, não uma certificação nem um teste de invasão. Não foi confirmado risco crítico. Foram corrigidos dois grupos de falhas: inicialização de produção com segredos fracos/padrão e injeção de HTML nos corpos de e-mail padrão. A auditoria de dependências ainda bloqueia uma declaração de conformidade: o backend registra 6 vulnerabilidades de severidade alta, 19 moderadas e 2 baixas; o frontend registra 2 baixas.

## Correções aplicadas

### SG-OWASP-001 — segredos de produção inseguros

- Categoria: A02:2025 Security Misconfiguration / A07:2025 Authentication Failures
- Severidade antes da correção: alta
- Evidência: `specflow/config/env.js` aceitava senha administrativa, segredo de sessão e pepper de API com valores-padrão previsíveis. O arquivo versionado `.env.example` continha credenciais com aparência operacional.
- Correção: produção agora falha ao iniciar sem `ADMIN_PASS` com ao menos 12 caracteres e sem `ADMIN_SESSION_SECRET` e `API_KEY_PEPPER` independentes com ao menos 32 caracteres. O exemplo de ambiente foi convertido para placeholders. O Compose de produção exige credenciais explícitas do MinIO.
- Validação: configuração fraca foi rejeitada; configuração sintética forte carregou com sucesso.

### SG-OWASP-002 — interpolação HTML em e-mails

- Categoria: A05:2025 Injection
- Severidade antes da correção: média
- Evidência: mensagem personalizada, número do relatório, cliente, site, título e OS eram interpolados em HTML de fallback em caminhos administrativos e públicos.
- Correção: os valores variáveis passam por `escapeHtml`; o renderizador de placeholders já escapava valores de templates.
- Validação: os dois controllers alterados passaram em `node --check`.

## Achados abertos

### SG-OWASP-003 — vulnerabilidades conhecidas nas dependências

- Categoria: A03:2025 Software Supply Chain Failures
- Severidade: alta
- Estado: aberto
- Evidência: `npm audit --omit=dev` reportou 27 ocorrências (6 altas, 19 moderadas, 2 baixas), incluindo cadeias que alcançam `nodemailer`, `xlsx`, `express`, `puppeteer/ws`, `sanitize-html/postcss` e utilitários de arquivo. O frontend reportou 2 baixas na cadeia `react-quill-new`/`quill`.
- Impacto: dependendo do caminho acionável, há risco de negação de serviço, injeção, leitura indevida ou comprometimento ao processar conteúdo não confiável.
- Recomendação: criar uma atualização controlada por grupo, com testes de e-mail, rotas Express, PDF/Puppeteer e importação XLS/XLSX. Onde o registry não oferece correção, substituir a biblioteca ou isolar o parser em processo/contêiner com limite de CPU, memória e tempo.

### SG-OWASP-004 — política CSP e privilégio do contêiner

- Categoria: A02:2025 Security Misconfiguration / A08:2025 Software or Data Integrity Failures
- Severidade: média
- Estado: aberto
- Evidência: a CSP permite `unsafe-inline` para scripts e o serviço de produção adiciona `SYS_ADMIN` para suportar o navegador. Algumas imagens auxiliares usam a tag `latest`.
- Impacto: uma injeção que alcance o DOM encontra menos barreiras; uma falha no navegador tem maior impacto no contêiner; imagens mutáveis reduzem reprodutibilidade.
- Recomendação: migrar scripts inline para arquivos/nonce, remover o CDN da política quando possível, executar o renderizador em serviço isolado com perfil de sandbox próprio e fixar imagens por versão ou digest.

### SG-OWASP-005 — telemetria de segurança incompleta

- Categoria: A09:2025 Security Logging and Alerting Failures
- Severidade: média
- Estado: aberto
- Evidência: há auditoria específica para criação de tokens e logs operacionais, mas não foi encontrada trilha centralizada e estruturada para falhas de autenticação, negações de autorização, mudanças de privilégios, rotação/revogação de credenciais e anomalias, nem integração comprovada com alertas.
- Impacto: abuso pode ser detectado tarde e a investigação perde correlação entre usuário, ação, origem e resultado.
- Recomendação: criar eventos de segurança sem dados sensíveis, com ID de correlação, ator, ação, alvo, resultado e origem; definir retenção, alerta e testes de detecção.

### SG-OWASP-006 — validação dinâmica e autorização por objeto pendentes

- Categoria: A01:2025 Broken Access Control / A06:2025 Insecure Design
- Severidade: média
- Estado: não testado dinamicamente
- Evidência: autenticação administrativa, CSRF, escopos de API e gates de módulo estão centralizados. A revisão estática não substitui testes negativos por função e por objeto para cada rota, especialmente links públicos, anexos, relatórios e integrações entre módulos.
- Recomendação: criar matriz ator × rota × objeto e testes que tentem leitura/escrita cruzada, IDOR, alteração de escopo, replay e acesso após revogação.

## Matriz OWASP Top 10:2025

| Categoria | Estado | Evidência resumida |
|---|---|---|
| A01 Broken Access Control | Parcial | Sessão, CSRF, escopos e gates existem; testes negativos abrangentes por objeto não foram executados. |
| A02 Security Misconfiguration | Parcial | Helmet, cookies e fail-fast de segredos existem; CSP inline e privilégio do contêiner permanecem. |
| A03 Software Supply Chain Failures | Não atende | Auditorias npm registram vulnerabilidades altas conhecidas. |
| A04 Cryptographic Failures | Parcial | HMAC, `timingSafeEqual`, `scrypt` e aleatoriedade criptográfica são usados; TLS e proteção em repouso dependem da implantação. |
| A05 Injection | Parcial | SQL parametrizado e identificadores controlados no código; HTML de e-mail corrigido; testes dinâmicos seguem pendentes. |
| A06 Insecure Design | Parcial | Limites e validações existem em fluxos críticos; falta threat model formal e teste de abuso completo. |
| A07 Authentication Failures | Parcial | Rate limit, sessão assinada e hash `scrypt`; segredos fracos de produção agora são bloqueados; MFA não foi identificado. |
| A08 Software or Data Integrity Failures | Parcial | Lockfiles e imagens principais versionadas; imagens `latest`, ausência de SBOM/assinatura e privilégio do navegador permanecem. |
| A09 Security Logging and Alerting Failures | Não atende | Não há evidência de logging/alerta centralizado cobrindo os principais eventos de segurança. |
| A10 Mishandling of Exceptional Conditions | Parcial | Handler global e limites de payload existem; degradações silenciosas e testes de falha/rollback não foram cobertos integralmente. |

## Controles positivos observados

- Helmet, `frame-ancestors 'none'`, HSTS condicionado a HTTPS, `nosniff` e política de referenciador.
- Cookies de sessão `httpOnly`, `sameSite=strict` e `secure` quando HTTPS está configurado.
- Login com rate limit, sessão assinada por HMAC e comparação em tempo constante; usuários adicionais usam `scrypt` com salt.
- APIs administrativas protegidas por sessão/CSRF e APIs de integração por escopos.
- Queries inspecionadas parametrizam valores; tabelas e ordenações interpoladas são selecionadas por constantes/listas do código.
- Uploads críticos aplicam limites; PDFs e imagens do SentinelGrid verificam MIME, extensão e/ou assinatura e usam nomes aleatórios.
- HTML rico passa por sanitização; previews React usam `iframe sandbox`.
- Subprocessos administrativos executam binário e argumentos predefinidos, sem `shell: true`, atrás de autenticação administrativa e CSRF.
- Imagem de produção termina com usuário não-root e `no-new-privileges`.

## Validações executadas

- `node --check specflow/config/env.js`
- `node --check report_service/src/controllers/createReportWebController.js`
- `node --check report_service/src/controllers/createReportPublicController.js`
- teste de rejeição/aceitação da configuração de segredos em `NODE_ENV=production`
- `npm audit --omit=dev --json`
- `npm --prefix frontend audit --omit=dev --json`
- buscas estáticas de autenticação, CSRF, SQL dinâmico, subprocessos, uploads, renderização, criptografia, URLs externas e logs sensíveis

## Limitações e próximos gates

Não foram executados DAST, teste autenticado multiusuário, fuzzing, análise de imagem de contêiner, varredura de infraestrutura, revisão de nuvem, SBOM, pentest ou avaliação formal ASVS requisito a requisito. A prontidão deve ser reavaliada após corrigir SG-OWASP-003 a SG-OWASP-006 e executar testes em ambiente representativo de produção.
