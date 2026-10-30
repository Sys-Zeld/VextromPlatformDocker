import { Modal } from "react-bootstrap";

export interface ViewableFile {
  name: string;
  mime: string;
  url: string;
  downloadUrl: string;
}

// Visualização do comprovante sem sair da página. A URL é da mesma origem
// (cookie de sessão), servida com permissão checada a cada acesso.
export default function AttachmentViewer({ file, onClose }: { file: ViewableFile | null; onClose: () => void }) {
  return (
    <Modal show={!!file} onHide={onClose} size="xl" centered>
      {file && (
        <>
          <Modal.Header closeButton>
            <Modal.Title as="h6" className="text-truncate">{file.name}</Modal.Title>
          </Modal.Header>
          <Modal.Body className="p-0 bg-body-tertiary text-center">
            {file.mime === "application/pdf" ? (
              <iframe title={file.name} src={file.url} style={{ width: "100%", height: "75vh", border: 0 }} />
            ) : (
              <img src={file.url} alt={file.name} style={{ maxWidth: "100%", maxHeight: "75vh", objectFit: "contain" }} />
            )}
          </Modal.Body>
          <Modal.Footer>
            <a className="btn btn-sm btn-outline-secondary" href={file.url} target="_blank" rel="noopener noreferrer">Abrir em nova aba</a>
            <a className="btn btn-sm btn-primary" href={file.downloadUrl}>Baixar</a>
          </Modal.Footer>
        </>
      )}
    </Modal>
  );
}
