import { Routes, Route } from "react-router-dom";
import Layout from "./components/Layout";
import OrdersPage from "./pages/OrdersPage";
import CustomersPage from "./pages/CustomersPage";
import EquipmentsPage from "./pages/EquipmentsPage";
import AnalyticsPage from "./pages/AnalyticsPage";
import SparePartsPage from "./pages/SparePartsPage";
import ConfigPage from "./pages/ConfigPage";
import AssetsPage from "./pages/AssetsPage";

// Migração do módulo Report Service para React, coexistindo com o legado (/admin/...).
export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<OrdersPage />} />
        <Route path="/customers" element={<CustomersPage />} />
        <Route path="/equipments" element={<EquipmentsPage />} />
        <Route path="/spare-parts" element={<SparePartsPage />} />
        <Route path="/assets" element={<AssetsPage />} />
        <Route path="/config" element={<ConfigPage />} />
        <Route path="/analytics" element={<AnalyticsPage />} />
        <Route path="*" element={<p className="text-muted">Página não encontrada (SPA).</p>} />
      </Route>
    </Routes>
  );
}
