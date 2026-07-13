# Referência de auditoria

## Bases normativas

- OWASP Top 10:2025: https://owasp.org/Top10/2025/
- OWASP ASVS 5.0.0: https://owasp.org/www-project-application-security-verification-standard/
- OWASP Cheat Sheet Series: https://cheatsheetseries.owasp.org/

## Categorias vigentes

1. A01:2025 Broken Access Control
2. A02:2025 Security Misconfiguration
3. A03:2025 Software Supply Chain Failures
4. A04:2025 Cryptographic Failures
5. A05:2025 Injection
6. A06:2025 Insecure Design
7. A07:2025 Authentication Failures
8. A08:2025 Software or Data Integrity Failures
9. A09:2025 Security Logging and Alerting Failures
10. A10:2025 Mishandling of Exceptional Conditions

O Top 10 é documento de conscientização e priorização. Usar ASVS 5.0.0 para requisitos verificáveis e sempre registrar a versão ao citar um requisito.

## Evidência por resultado

- `Atende`: controle inspecionado e teste relevante passou.
- `Parcial`: há controle, mas escopo, consistência ou teste são insuficientes.
- `Não atende`: caminho vulnerável confirmado ou controle obrigatório ausente.
- `Não testado`: não há evidência suficiente ou o ambiente necessário está indisponível.
