import { ReactNode } from "react";
import { Card } from "react-bootstrap";

// Moldura das telas públicas do módulo (login, recuperação e definição de
// senha) — fora do Layout, sem menu, pois ainda não há sessão.
export default function AuthShell({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <div className="min-vh-100 d-flex align-items-center justify-content-center p-3" style={{ background: "var(--surface-2, #f4f6f5)" }}>
      <div style={{ width: "100%", maxWidth: 420 }}>
        <div className="text-center mb-4">
          <img src="/public/img/logo-vextrom.svg" alt="Vextrom" style={{ height: 42 }} />
          <div className="mt-2 fw-semibold">Relatório de Despesas</div>
        </div>
        <Card className="shadow-sm">
          <Card.Body className="p-4 d-flex flex-column gap-3">
            <div>
              <h1 className="h5 mb-1">{title}</h1>
              {subtitle && <p className="text-muted small mb-0">{subtitle}</p>}
            </div>
            {children}
          </Card.Body>
        </Card>
        <p className="text-center small text-muted mt-3 mb-0">Acesso exclusivo ao módulo de despesas.</p>
      </div>
    </div>
  );
}
