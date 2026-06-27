import { lazy, Suspense } from "react";
import { Routes, Route } from "react-router-dom";
import { Spinner } from "react-bootstrap";
import Layout from "./components/Layout";

const OrdersPage = lazy(() => import("./pages/OrdersPage"));
const OrderEditorPage = lazy(() => import("./pages/OrderEditorPage"));
const CustomersPage = lazy(() => import("./pages/CustomersPage"));
const EquipmentsPage = lazy(() => import("./pages/EquipmentsPage"));
const AnalyticsPage = lazy(() => import("./pages/AnalyticsPage"));
const SparePartsPage = lazy(() => import("./pages/SparePartsPage"));
const ConfigPage = lazy(() => import("./pages/ConfigPage"));
const AssetsPage = lazy(() => import("./pages/AssetsPage"));
const TableStylesPage = lazy(() => import("./pages/TableStylesPage"));
const TechnicianToolsPage = lazy(() => import("./pages/TechnicianToolsPage"));
const PdfHistoryPage = lazy(() => import("./pages/PdfHistoryPage"));

function RouteFallback() {
  return (
    <div className="d-flex align-items-center gap-2 text-muted">
      <Spinner animation="border" size="sm" />
      Carregando...
    </div>
  );
}

// Migracao do modulo Report Service para React, coexistindo com o legado (/admin/...).
export default function App() {
  return (
    <Suspense fallback={<RouteFallback />}>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<OrdersPage />} />
          <Route path="/orders/:id/editor" element={<OrderEditorPage />} />
          <Route path="/customers" element={<CustomersPage />} />
          <Route path="/equipments" element={<EquipmentsPage />} />
          <Route path="/spare-parts" element={<SparePartsPage />} />
          <Route path="/assets" element={<AssetsPage />} />
          <Route path="/assets/technicians/:techId/tools" element={<TechnicianToolsPage />} />
          <Route path="/orders/:id/pdf-history" element={<PdfHistoryPage />} />
          <Route path="/table-styles" element={<TableStylesPage />} />
          <Route path="/config" element={<ConfigPage />} />
          <Route path="/analytics" element={<AnalyticsPage />} />
          <Route path="*" element={<p className="text-muted">Pagina nao encontrada (SPA).</p>} />
        </Route>
      </Routes>
    </Suspense>
  );
}
