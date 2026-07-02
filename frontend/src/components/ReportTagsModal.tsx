import { Modal, Table } from "react-bootstrap";

const TAGS: { tag: string; desc: string; ex: string }[] = [
  { tag: "@img=ID", desc: "Renderiza uma imagem inline do banco de imagens pelo ID", ex: "@img=3" },
  { tag: "@equip=ID", desc: "Exibe a TAG ou tipo do equipamento pelo ID", ex: "@equip=1" },
  { tag: "@tagsequip", desc: "Todas as TAGs dos equipamentos vinculados à OS, separadas por vírgula", ex: "@tagsequip" },
  { tag: "@site", desc: "Nome do site vinculado à OS", ex: "@site" },
  { tag: "@descricaodia=ID", desc: "Conteúdo de um log diário específico pelo ID de sequência", ex: "@descricaodia=2" },
  { tag: "@descricaodia", desc: "Todos os logs diários em sequência (exceto conclusão geral)", ex: "@descricaodia" },
  { tag: "@conclusaogeral", desc: "Conclusão geral gerada por IA (log marcado como conclusaogeral)", ex: "@conclusaogeral" },
  { tag: "@tblcmpr", desc: "Tabela de componentes substituídos (categoria: replaced)", ex: "@tblcmpr" },
  { tag: "@tblcmpq", desc: "Tabela de componentes necessários (categoria: required)", ex: "@tblcmpq" },
  { tag: "@tblcmps", desc: "Tabela de componentes sobressalentes (categoria: spare)", ex: "@tblcmps" },
  { tag: "@tblequip", desc: "Tabela completa dos equipamentos vinculados à OS", ex: "@tblequip" },
  { tag: "@ensaios=ID", desc: "Tabela de ensaios/medições cadastrada na OS", ex: "@ensaios=1" },
  { tag: "@mesuaresUPS=ID", desc: "Cabeçalho e medições importadas do arquivo Measures.xls", ex: "@mesuaresUPS=1" },
  { tag: "@eventlogUPS=ID", desc: "Cabeçalho e log de eventos importado do arquivo Event Log.xls", ex: "@eventlogUPS=1" },
  { tag: "@timesheet", desc: "Tabela de timesheet com datas e horários de entrada/saída", ex: "@timesheet" },
  { tag: "@equipetecnica", desc: "Tabela da equipe técnica com nome, função e empresa", ex: "@equipetecnica" }
];

export default function ReportTagsModal(props: { show: boolean; onHide: () => void }) {
  return (
    <Modal show={props.show} onHide={props.onHide} size="lg" scrollable>
      <Modal.Header closeButton><Modal.Title className="h6 mb-0">Tags disponíveis</Modal.Title></Modal.Header>
      <Modal.Body>
        <Table bordered size="sm" className="mb-0" style={{ fontSize: "0.8rem" }}>
          <thead className="table-light">
            <tr><th style={{ whiteSpace: "nowrap" }}>Tag</th><th>Descrição</th><th>Exemplo</th></tr>
          </thead>
          <tbody>
            {TAGS.map((t) => (
              <tr key={t.tag}><td><code>{t.tag}</code></td><td>{t.desc}</td><td><code>{t.ex}</code></td></tr>
            ))}
          </tbody>
        </Table>
      </Modal.Body>
    </Modal>
  );
}
