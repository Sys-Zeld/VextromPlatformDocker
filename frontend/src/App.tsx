import { Routes, Route, Link } from "react-router-dom";
import HealthPage from "./pages/HealthPage";

// Fase 0: apenas a casca + uma página de verificação (sessão/CSRF/i18n/tema).
// As telas de negócio (customers, orders, etc.) entram nas fases seguintes.
export default function App() {
  return (
    <div className="container py-4">
      <header className="d-flex align-items-center justify-content-between mb-4">
        <h1 className="h4 mb-0">Vextrom Platform — SPA (Fase 0)</h1>
        <nav className="d-flex gap-3">
          <Link to="/">Início</Link>
          <a href="/admin/report-service">← Voltar ao sistema legado</a>
        </nav>
      </header>
      <Routes>
        <Route path="/" element={<HealthPage />} />
        <Route path="*" element={<p className="text-muted">Página não encontrada (SPA).</p>} />
      </Routes>
    </div>
  );
}
