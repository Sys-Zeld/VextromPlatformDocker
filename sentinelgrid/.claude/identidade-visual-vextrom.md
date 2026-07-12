# identidade-visual-vextrom

## Prompt — Identidade Visual Vextrom

Crie uma identidade visual profissional para a marca **Vextrom**, aplicada a sistemas web técnicos, dashboards, relatórios, módulos de manutenção e plataformas como **SentinelGrid / Vextrom Platform**.

A identidade deve funcionar em dois padrões visuais:

1. **Normal mode / Light mode**
2. **Dark mode / Mission critical mode**

A marca Vextrom atua no contexto de:

- UPS industriais
- Retificadores
- Chaves estáticas
- Bancos de baterias
- Energia crítica
- Data centers
- Ambientes offshore
- Manutenção industrial
- Comissionamento
- Relatórios técnicos
- Sistemas de missão crítica

A interface deve transmitir:

- Engenharia de missão crítica
- Confiabilidade operacional
- Precisão técnica
- Robustez industrial
- Alta disponibilidade
- Segurança
- Organização
- Profissionalismo corporativo
- Aparência premium, sem exageros visuais

---

# 1. Conceito visual da marca

A Vextrom deve ter uma identidade visual técnica, limpa e robusta.

A estética deve lembrar:

- Engenharia elétrica
- Data center
- Sala de controle
- Missão crítica
- Automação industrial
- Manutenção especializada
- Operação técnica profissional

A marca não deve parecer:

- Genérica
- Gamer
- Neon
- Amadora
- Excessivamente colorida
- Startup visualmente infantil
- Template padrão sem personalidade

O verde da Vextrom deve ser usado como **assinatura visual**, não como cor dominante em excesso.

---

# 2. Paleta principal da marca

## Verde institucional

| Nome | HEX | Uso |
|---|---|---|
| Verde Vextrom Pro | `#4F7F2A` | Cor principal da marca, botões primários, itens ativos e destaques |
| Verde Hover / Ativo | `#5E9434` | Hover, foco, estados selecionados |
| Verde Profundo | `#2E4F1A` | Destaques institucionais, textos fortes, estados ativos discretos |
| Verde Luminoso Controlado | `#8CCB5A` | Pequenos realces no dark mode, indicadores positivos |
| Verde Soft | `#EDF5E8` | Fundos leves no normal mode |
| Verde Soft Dark | `rgba(79, 127, 42, 0.18)` | Fundos sutis no dark mode |

Diretriz importante:

O verde não deve parecer fluorescente, agrícola ou excessivamente vibrante. Ele deve parecer técnico, maduro, corporativo e confiável.

---

# 3. Normal mode / Light mode

## Objetivo visual

O normal mode deve ser limpo, técnico e corporativo.

Use o normal mode principalmente para:

- Relatórios técnicos
- Áreas administrativas
- Cadastros
- Formulários
- Impressões
- Telas de consulta
- Documentos
- Operação em ambiente claro

## Paleta normal mode

### Base

| Função | Cor |
|---|---|
| Background principal | `#F4F6F7` |
| Surface / cards | `#FFFFFF` |
| Surface secundária | `#F8FAFA` |
| Bordas e divisores | `#DDE2E5` |
| Bordas fortes | `#C8CDD0` |

### Textos

| Função | Cor |
|---|---|
| Texto principal | `#1F2529` |
| Texto forte / títulos | `#0E1114` |
| Texto secundário | `#5F686D` |
| Texto discreto / muted | `#8D9092` |

### Marca

| Função | Cor |
|---|---|
| Verde principal | `#4F7F2A` |
| Verde hover | `#3F6721` |
| Verde profundo | `#2E4F1A` |
| Verde soft | `#EDF5E8` |
| Verde borda suave | `#BFD8AA` |

### Status

| Status | Cor |
|---|---|
| Operacional / sucesso | `#3F7D2A` |
| Informação técnica / programado | `#0E6BA8` |
| Atenção | `#DFAE18` |
| Crítico / falha | `#C93F3F` |
| Emergencial | `#E6512E` |
| Desabilitado | `#9AA1A6` |

---

## Diretrizes para normal mode

Use:

- Fundo claro levemente acinzentado
- Cards brancos
- Bordas discretas
- Verde como ação principal
- Grafite para títulos e textos importantes
- Cinza para textos auxiliares
- Tabelas limpas e legíveis
- Sombras suaves e profissionais

Evite:

- Fundo branco puro em toda a tela sem hierarquia
- Verde em excesso
- Botões muito saturados
- Muitos elementos coloridos
- Gradientes chamativos
- Visual infantil ou genérico

---

## Tokens CSS — Normal mode

```css
:root {
  /* Base light */
  --vextrom-bg: #F4F6F7;
  --vextrom-surface: #FFFFFF;
  --vextrom-surface-secondary: #F8FAFA;
  --vextrom-border: #DDE2E5;
  --vextrom-border-strong: #C8CDD0;

  /* Textos */
  --vextrom-text-primary: #1F2529;
  --vextrom-text-strong: #0E1114;
  --vextrom-text-secondary: #5F686D;
  --vextrom-text-muted: #8D9092;

  /* Marca */
  --vextrom-green: #4F7F2A;
  --vextrom-green-hover: #3F6721;
  --vextrom-green-deep: #2E4F1A;
  --vextrom-green-soft: #EDF5E8;
  --vextrom-green-border: #BFD8AA;

  /* Status */
  --status-success: #3F7D2A;
  --status-info: #0E6BA8;
  --status-warning: #DFAE18;
  --status-critical: #C93F3F;
  --status-emergency: #E6512E;
  --status-disabled: #9AA1A6;
}
```

---

# 4. Dark mode / Mission critical mode

## Objetivo visual

O dark mode deve ser o padrão principal para a plataforma operacional.

Use o dark mode principalmente para:

- SentinelGrid
- Dashboard de manutenção
- Monitoramento técnico
- Sala de controle
- Gestão de alarmes
- Equipamentos críticos
- Operação contínua
- Painéis de status
- Visualização de criticidade

A interface deve parecer um sistema real de engenharia, usado por técnicos, engenheiros e gestores de manutenção.

## Paleta dark mode

### Base

| Função | Cor |
|---|---|
| Background principal | `#0E1114` |
| Surface / cards | `#151A1E` |
| Surface elevada | `#1F2529` |
| Bordas e divisores | `#2B3338` |
| Sidebar profunda | `#0A0D0F` |

### Textos

| Função | Cor |
|---|---|
| Texto principal | `#E6E8EA` |
| Texto forte / títulos | `#F4F6F7` |
| Texto secundário | `#8D9092` |
| Texto discreto / muted | `#5F686D` |

### Marca

| Função | Cor |
|---|---|
| Verde principal | `#4F7F2A` |
| Verde hover / ativo | `#5E9434` |
| Verde luminoso controlado | `#8CCB5A` |
| Verde profundo | `#2E4F1A` |
| Verde soft dark | `rgba(79, 127, 42, 0.18)` |

### Status

| Status | Cor |
|---|---|
| Operacional / sucesso | `#6FAF3C` |
| Informação técnica / programado | `#2F8CC7` |
| Atenção | `#DFAE18` |
| Crítico / falha | `#D94A4A` |
| Emergencial | `#FF5A3D` |
| Desabilitado | `#4A5257` |

---

## Diretrizes para dark mode

Use:

- Fundo principal em `#0E1114`
- Sidebar em `#0A0D0F`
- Cards em `#151A1E`
- Cards elevados em `#1F2529`
- Bordas em `#2B3338`
- Verde como assinatura visual e estado ativo
- Textos principais em `#E6E8EA`
- Títulos em `#F4F6F7`
- Status com cores funcionais controladas
- Badges compactos com fundo translúcido
- Sombras discretas ou bordas para profundidade

Evite:

- Preto puro absoluto em todos os elementos
- Verde neon exagerado
- Visual gamer
- Efeitos brilhantes
- Glassmorphism intenso
- Gradientes muito coloridos
- Excesso de vermelho e amarelo
- Layout poluído

---

## Tokens CSS — Dark mode

```css
[data-theme="dark"] {
  /* Base dark */
  --vextrom-bg: #0E1114;
  --vextrom-surface: #151A1E;
  --vextrom-surface-elevated: #1F2529;
  --vextrom-border: #2B3338;
  --vextrom-sidebar: #0A0D0F;

  /* Textos */
  --vextrom-text-primary: #E6E8EA;
  --vextrom-text-strong: #F4F6F7;
  --vextrom-text-secondary: #8D9092;
  --vextrom-text-muted: #5F686D;

  /* Marca */
  --vextrom-green: #4F7F2A;
  --vextrom-green-hover: #5E9434;
  --vextrom-green-bright: #8CCB5A;
  --vextrom-green-deep: #2E4F1A;
  --vextrom-green-soft-dark: rgba(79, 127, 42, 0.18);

  /* Status */
  --status-success: #6FAF3C;
  --status-info: #2F8CC7;
  --status-warning: #DFAE18;
  --status-critical: #D94A4A;
  --status-emergency: #FF5A3D;
  --status-disabled: #4A5257;
}
```

---

# 5. Componentes

## Sidebar

A sidebar deve existir especialmente no dark mode.

Características:

- Fundo escuro profundo
- Logo Vextrom no topo
- Nome da plataforma
- Navegação vertical
- Item ativo com fundo verde translúcido
- Barra lateral verde ou borda ativa
- Ícones técnicos discretos

Itens sugeridos:

- Dashboard
- Equipamentos
- Manutenções
- Calendário
- Relatórios
- Alarmes
- Baterias
- Configurações

---

## Topbar

A topbar deve conter:

- Título da página
- Subtítulo técnico
- Ações rápidas
- Botão primário
- Botão secundário
- Filtro por cliente, site ou equipamento, quando necessário

Exemplo:

**SentinelGrid — Visão Operacional**

Monitoramento técnico de UPS, retificadores e chaves estáticas por criticidade.

---

## Botões

### Botão primário

Normal mode:

```css
.btn-primary {
  background: #4F7F2A;
  color: #FFFFFF;
  border: 1px solid #4F7F2A;
}

.btn-primary:hover {
  background: #3F6721;
  border-color: #3F6721;
}
```

Dark mode:

```css
[data-theme="dark"] .btn-primary {
  background: #4F7F2A;
  color: #F4F6F7;
  border: 1px solid #4F7F2A;
}

[data-theme="dark"] .btn-primary:hover {
  background: #5E9434;
  border-color: #5E9434;
}
```

### Botão secundário

Normal mode:

```css
.btn-secondary {
  background: #FFFFFF;
  color: #1F2529;
  border: 1px solid #C8CDD0;
}

.btn-secondary:hover {
  border-color: #4F7F2A;
  color: #2E4F1A;
}
```

Dark mode:

```css
[data-theme="dark"] .btn-secondary {
  background: #151A1E;
  color: #E6E8EA;
  border: 1px solid #2B3338;
}

[data-theme="dark"] .btn-secondary:hover {
  border-color: #4F7F2A;
  color: #F4F6F7;
}
```

### Botão soft

Normal mode:

```css
.btn-soft {
  background: #EDF5E8;
  color: #2E4F1A;
  border: 1px solid #BFD8AA;
}
```

Dark mode:

```css
[data-theme="dark"] .btn-soft {
  background: rgba(79, 127, 42, 0.18);
  color: #8CCB5A;
  border: 1px solid rgba(79, 127, 42, 0.45);
}
```

### Botão crítico

```css
.btn-critical {
  background: #D94A4A;
  color: #FFFFFF;
  border: 1px solid #D94A4A;
}
```

### Botão ghost

Normal mode:

```css
.btn-ghost {
  background: transparent;
  color: #5F686D;
  border: 1px solid transparent;
}

.btn-ghost:hover {
  background: #F4F6F7;
  color: #1F2529;
}
```

Dark mode:

```css
[data-theme="dark"] .btn-ghost {
  background: transparent;
  color: #8D9092;
  border: 1px solid transparent;
}

[data-theme="dark"] .btn-ghost:hover {
  background: #1F2529;
  color: #F4F6F7;
}
```

---

# 6. Cards técnicos

Os cards devem apresentar:

- Título pequeno
- Valor principal grande
- Status ou tendência
- Ícone discreto
- Borda sutil
- Boa separação visual

Exemplos de cards:

- Equipamentos ativos
- Manutenções do mês
- Atenções abertas
- Falhas críticas
- Preventivas vencidas
- Ordens programadas
- Equipamentos em operação
- Alarmes pendentes

---

# 7. Tabelas técnicas

As tabelas devem ser limpas e muito legíveis.

Colunas sugeridas:

- Equipamento
- Cliente / Site
- Tipo
- Próxima ação
- Última manutenção
- Próxima manutenção
- Status
- Criticidade

Exemplos de equipamentos:

- UPS 705-UPS-8267A
- Retificador 1CHR
- Chave Estática STS-02
- UPS S-T4501B
- Banco de Baterias String 01

---

# 8. Badges de status

Criar badges pequenos, legíveis e técnicos.

## Status padrão

| Status | Normal mode | Dark mode |
|---|---|---|
| Operacional | `#3F7D2A` | `#6FAF3C` |
| Programado | `#0E6BA8` | `#2F8CC7` |
| Atenção | `#DFAE18` | `#DFAE18` |
| Crítico | `#C93F3F` | `#D94A4A` |
| Emergencial | `#E6512E` | `#FF5A3D` |
| Desabilitado | `#9AA1A6` | `#4A5257` |

No dark mode, os badges devem usar fundos translúcidos.

Exemplo:

```css
.badge-success {
  color: var(--status-success);
  background: rgba(111, 175, 60, 0.14);
  border: 1px solid rgba(111, 175, 60, 0.28);
}
```

---

# 9. Mapa visual de manutenção

Criar uma área visual para calendário, timeline ou mapa de manutenção.

Eventos sugeridos:

- Preventiva UPS Apodys
- Inspeção banco de baterias
- Corretiva UPS S-T4501B
- Teste de transferência STS
- Medição de ripple
- Análise de autonomia
- Preventiva com parada
- Preventiva sem parada

Cada evento deve conter:

- Data
- Cliente
- Site
- Equipamento
- Tipo de manutenção
- Status
- Criticidade
- Próxima ação

---

# 10. Cards de equipamentos

Criar cards individuais para equipamentos críticos com:

- Nome do equipamento
- Tipo de equipamento
- Cliente
- Site
- Última manutenção
- Próxima manutenção
- Status
- Criticidade
- Botão para abrir detalhes

---

# 11. Layout recomendado

## Normal mode

Usar para telas mais administrativas:

- Cadastros
- Formulários
- Relatórios
- Configurações
- Impressões
- Consultas técnicas

Estrutura sugerida:

- Header claro
- Área principal clara
- Cards brancos
- Tabelas limpas
- Botões verdes como ação principal

## Dark mode

Usar para telas operacionais:

- Dashboard
- Monitoramento
- Alarmes
- Mapa de manutenção
- Gestão de criticidade
- Sala de controle

Estrutura sugerida:

- Sidebar fixa à esquerda
- Área principal escura
- Topbar técnica
- Grid de indicadores no topo
- Tabela técnica central
- Timeline ou mapa de manutenção lateral
- Cards adicionais na parte inferior

---

# 12. Tipografia

Usar fonte moderna, limpa e legível.

Sugestões:

- Inter
- Roboto
- system-ui
- Arial

Diretrizes:

- Títulos com peso 700 ou 800
- Textos principais com peso 400 ou 500
- Labels em uppercase com espaçamento leve
- Números de dashboard com peso forte
- Evitar fontes decorativas

---

# 13. Microcopy recomendada

Usar linguagem técnica, clara e objetiva.

Exemplos:

- Visão Operacional
- Equipamentos críticos
- Manutenções programadas
- Atenções abertas
- Falhas críticas
- Próxima ação
- Preventiva com parada
- Preventiva sem parada
- Corretiva
- Diagnóstico urgente
- Inspeção de ripple
- Teste de autonomia
- Abrir relatório
- Nova ordem
- Exportar
- Ver programa
- Atualizado agora
- Em manutenção
- Operacional
- Crítico
- Emergencial
- Programado

---

# 14. Aplicação por produto

## SentinelGrid

Priorizar dark mode.

Uso:

- Dashboard operacional
- Mapa de manutenção
- Equipamentos críticos
- Alarmes
- Status
- Ordens de manutenção

## Service Report

Priorizar normal mode.

Uso:

- Relatórios técnicos
- Edição de capítulos
- Assinaturas
- Timesheet
- Impressão
- Exportação PDF

## Vextrom Platform

Usar os dois modos.

Uso:

- Portal principal
- Administração
- Acesso aos módulos
- Gestão de usuários
- Indicadores gerais

## BatterySize / Autonomy

Usar normal mode ou híbrido.

Uso:

- Cálculos
- Memorial técnico
- Tabelas
- Curvas
- Exportação PDF

---

# 15. Instrução final para geração de interface

Crie uma interface com alto padrão visual, mantendo consistência com a identidade Vextrom e foco em uso profissional real.

A interface deve funcionar em **normal mode** e **dark mode**, usando os mesmos princípios visuais, mas adaptando contraste, profundidade, superfícies e estados.

O resultado deve parecer uma plataforma profissional usada por engenheiros, técnicos e gestores de manutenção em ambientes críticos.

A estética final deve ser:

- Técnica
- Premium
- Industrial
- Limpa
- Confiável
- Robusta
- Corporativa
- Adequada para missão crítica
