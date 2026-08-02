// Níveis de acesso da plataforma.
//
// Modelo antigo: role "admin" (tudo) ou "user" (liberado por módulo). Ele
// continua sendo aceito na leitura — "admin" vira administrator e "user" vira
// coordinator — para que nenhum usuário já cadastrado perca acesso.
//
// A autorização é feita por CAPACIDADE, não por perfil: as rotas perguntam
// "esse usuário pode X?" em vez de "esse usuário é admin?". Assim, criar um
// novo perfil no futuro é só montar outra linha da matriz.

const ROLES = {
  ADMINISTRATOR: "administrator",
  COORDINATOR: "coordinator",
  TECHNICIAN: "technician",
  MANAGER: "manager"
};

const ROLE_LABELS = {
  [ROLES.ADMINISTRATOR]: "Administrador",
  [ROLES.COORDINATOR]: "Coordenador",
  [ROLES.TECHNICIAN]: "Técnico",
  [ROLES.MANAGER]: "Gestor"
};

const ROLE_DESCRIPTIONS = {
  [ROLES.ADMINISTRATOR]: "Acesso total, incluindo backup, configuração do sistema e gestão de usuários.",
  [ROLES.COORDINATOR]: "Cria OS, faz cadastros e exclusões gerais. Não administra o sistema.",
  [ROLES.TECHNICIAN]: "Edita OS e relatórios. Sem acesso ao SentinelGrid nem à manutenção do sistema.",
  [ROLES.MANAGER]: "Somente visualização de OS e do SentinelGrid."
};

// Capacidades — o vocabulário que as rotas usam para se proteger.
const CAPABILITIES = {
  // Administração da plataforma: backup, restore, config do sistema, usuários,
  // chaves de API, aparência. Exclusivo do administrador.
  SYSTEM_MANAGE: "system:manage",

  // Cadastros gerais: clientes, sites, equipamentos, peças, técnicos, instrumentos.
  RECORDS_READ: "records:read",
  RECORDS_WRITE: "records:write",
  RECORDS_DELETE: "records:delete",

  // Ordens de serviço e relatórios.
  ORDERS_READ: "orders:read",
  ORDERS_EDIT: "orders:edit",
  ORDERS_CREATE: "orders:create",
  ORDERS_DELETE: "orders:delete",

  // SentinelGrid (programa de manutenção).
  SENTINELGRID_READ: "sentinelgrid:read",
  SENTINELGRID_WRITE: "sentinelgrid:write"
};

const ALL_CAPABILITIES = Object.values(CAPABILITIES);

// Matriz perfil → capacidades. O administrador recebe tudo por definição.
const ROLE_CAPABILITIES = {
  [ROLES.ADMINISTRATOR]: new Set(ALL_CAPABILITIES),

  [ROLES.COORDINATOR]: new Set([
    CAPABILITIES.RECORDS_READ,
    CAPABILITIES.RECORDS_WRITE,
    CAPABILITIES.RECORDS_DELETE,
    CAPABILITIES.ORDERS_READ,
    CAPABILITIES.ORDERS_EDIT,
    CAPABILITIES.ORDERS_CREATE,
    CAPABILITIES.ORDERS_DELETE,
    CAPABILITIES.SENTINELGRID_READ,
    CAPABILITIES.SENTINELGRID_WRITE
  ]),

  // Técnico edita a OS e o relatório dela. Precisa ler cadastros para preencher
  // a OS (escolher cliente/equipamento), mas não cria nem apaga cadastro.
  [ROLES.TECHNICIAN]: new Set([
    CAPABILITIES.RECORDS_READ,
    CAPABILITIES.ORDERS_READ,
    CAPABILITIES.ORDERS_EDIT
  ]),

  [ROLES.MANAGER]: new Set([
    CAPABILITIES.RECORDS_READ,
    CAPABILITIES.ORDERS_READ,
    CAPABILITIES.SENTINELGRID_READ
  ])
};

// Perfis do modelo antigo continuam entrando.
const LEGACY_ROLE_ALIASES = {
  admin: ROLES.ADMINISTRATOR,
  administrador: ROLES.ADMINISTRATOR,
  user: ROLES.COORDINATOR,
  coordenador: ROLES.COORDINATOR,
  tecnico: ROLES.TECHNICIAN,
  "técnico": ROLES.TECHNICIAN,
  gestor: ROLES.MANAGER
};

const ROLE_SET = new Set(Object.values(ROLES));

/** Converte qualquer valor de role (novo, antigo ou em português) no perfil canônico. */
function normalizeRole(role) {
  const value = String(role || "").trim().toLowerCase();
  if (ROLE_SET.has(value)) return value;
  return LEGACY_ROLE_ALIASES[value] || ROLES.TECHNICIAN;
}

/** O perfil pode executar a capacidade? */
function hasCapability(role, capability) {
  const normalized = normalizeRole(role);
  const granted = ROLE_CAPABILITIES[normalized];
  if (!granted) return false;
  return granted.has(String(capability || "").trim().toLowerCase());
}

/** Todas as capacidades do perfil — útil para enviar ao SPA e esconder ações. */
function capabilitiesForRole(role) {
  const normalized = normalizeRole(role);
  return [...(ROLE_CAPABILITIES[normalized] || [])].sort();
}

function isAdministrator(role) {
  return normalizeRole(role) === ROLES.ADMINISTRATOR;
}

function roleLabel(role) {
  return ROLE_LABELS[normalizeRole(role)] || "";
}

/** Lista para popular selects na gestão de usuários. */
function listRoles() {
  return Object.values(ROLES).map((value) => ({
    value,
    label: ROLE_LABELS[value],
    description: ROLE_DESCRIPTIONS[value]
  }));
}

module.exports = {
  ROLES,
  CAPABILITIES,
  ROLE_LABELS,
  ROLE_DESCRIPTIONS,
  normalizeRole,
  hasCapability,
  capabilitiesForRole,
  isAdministrator,
  roleLabel,
  listRoles
};
