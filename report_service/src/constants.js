const ORDER_STATUSES = [
  "draft",
  "valid",
  "in_progress",
  "waiting_review",
  "approved",
  "issued",
  "closed",
  "cancelled"
];

const REPORT_STATUSES = [
  "draft",
  "in_progress",
  "waiting_review",
  "approved",
  "issued",
  "closed",
  "cancelled"
];

const SECTION_DEFINITIONS = [
  { key: "scope", title: "ESCOPO", sortOrder: 1 },
  { key: "technical_description", title: "DESCRIÇÃO TÉCNICA", sortOrder: 2 },
  { key: "replaced_components", title: "COMPONENTES SUBSTITUIDOS NA CORRETIVA", sortOrder: 3 },
  { key: "required_components", title: "COMPONENTES NECESSÁRIOS PARA CORRETIVA", sortOrder: 4 },
  { key: "recommended_spare", title: "COMPONENTES RECOMENDADOS PARA SPARE", sortOrder: 5 },
  { key: "recommendations", title: "RECOMENDAÇÕES", sortOrder: 6 },
  { key: "conclusion", title: "CONCLUSÃO", sortOrder: 7 }
];

const QUILL_SECTION_TOOLBAR = [
  [{ font: ["arial", "serif", "monospace"] }, { size: ["small", false, "large", "huge"] }],
  [{ header: [1, 2, 3, false] }],
  ["bold", "italic", "underline", { color: [] }],
  [{ list: "ordered" }, { list: "bullet" }],
  ["blockquote"],
  [{ align: [] }],
  ["insertTable"],
  ["link", "image"],
  ["clean"]
];

const QUILL_SECTION_TITLE_TOOLBAR = [
  [{ font: ["arial", "serif", "monospace"] }, { size: ["small", false, "large", "huge"] }],
  ["bold", "italic", "underline", { color: [] }],
  [{ align: [] }],
  ["link", "image"],
  ["clean"]
];

const QUILL_SECTION_FORMATS = [
  "font",
  "size",
  "color",
  "header",
  "bold",
  "italic",
  "underline",
  "list",
  "blockquote",
  "align",
  "table",
  "table-cell-line",
  "table-col",
  "table-row",
  "link",
  "image"
];

const QUILL_SECTION_TITLE_FORMATS = [
  "font",
  "size",
  "color",
  "bold",
  "italic",
  "underline",
  "align",
  "link",
  "image"
];

const COMPONENT_CATEGORIES = ["substituidos", "Para_troca", "recomendados"];
const SIGNER_TYPES = ["Tecnicos_Vextrom", "Responsavel_Cliente", "Gerente_Projeto", "Diretor_Tecnico"];
const SECTION_SEED_HTML = {
  scope: "<p><strong>Escopo:</strong> Execução de manutenção corretiva e verificação funcional do sistema UPS, incluindo validação de tempos de resposta e inspeção dos conjuntos de potência.</p><p>O atendimento contempla equipe técnica Vextrom, instrumentos calibrados, registro de timesheet e rastreabilidade de componentes.</p>",
  technical_description: "<p><strong>Dia 1:</strong> Inspeção inicial, verificação de alarmes históricos, medições de tensão e frequência, e testes de transferência.</p><p><strong>Dia 2:</strong> Ajustes em blocos de potência, substituição de itens avariados e testes de estabilidade em carga controlada.</p>",
  replaced_components: "<p>Componentes substituídos durante a corretiva conforme tabela técnica do relatório.</p>",
  required_components: "<p>Itens identificados como necessários para corretiva complementar, sujeitos à aprovação do cliente.</p>",
  recommended_spare: "<p>Lista recomendada de sobressalentes para reduzir indisponibilidade em ocorrências futuras.</p>",
  recommendations: "<p>Recomenda-se executar inspeções preventivas trimestrais, validação termográfica semestral e atualização do plano de contingência operacional.</p>",
  conclusion: "<p>Conclui-se que o sistema retornou à condição operacional esperada após intervenção técnica, com desempenho estável e sem alarmes críticos ativos.</p>"
};

module.exports = {
  ORDER_STATUSES,
  REPORT_STATUSES,
  SECTION_DEFINITIONS,
  QUILL_SECTION_TOOLBAR,
  QUILL_SECTION_TITLE_TOOLBAR,
  QUILL_SECTION_FORMATS,
  QUILL_SECTION_TITLE_FORMATS,
  COMPONENT_CATEGORIES,
  SIGNER_TYPES,
  SECTION_SEED_HTML
};
