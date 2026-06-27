import { Routes, Route, Link } from "react-router-dom";
import HealthPage from "./pages/HealthPage";
import CustomersPage from "./pages/CustomersPage";

// Fase 0: casca + verificação de sessão. Fase 2: piloto "customers".
export default function App() {
  return (
    <div className="container py-4">
      <header className="d-flex align-items-center justify-content-between mb-4">
        <h1 className="h4 mb-0">Vextrom Platform — SPA</h1>
        <nav className="d-flex gap-3">
          <Link to="/">Início</Link>
          <Link to="/customers">Clientes</Link>
          <a href="/admin/report-service">← Sistema legado</a>
        </nav>
      </header>
      <Routes>
        <Route path="/" element={<HealthPage />} />
        <Route path="/customers" element={<CustomersPage />} />
        <Route path="*" element={<p className="text-muted">Página não encontrada (SPA).</p>} />
      </Routes>
    </div>
  );
}
