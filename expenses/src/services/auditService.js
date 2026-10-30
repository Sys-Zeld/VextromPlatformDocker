const auditRepo = require("../repositories/auditRepository");

// Registro de auditoria. Chamado DENTRO da transação da operação auditada:
// se a operação falha, o evento também não fica gravado (e vice-versa).
// Nunca colocar valores sensíveis (CPF, conta, Pix) em `metadata`.
function record(db, actor, event) {
  return auditRepo.insertAudit(db, {
    actorId: actor.userId,
    actorName: actor.username,
    ...event
  });
}

module.exports = { record };
