import { lazy, Suspense } from "react";
import { Routes, Route } from "react-router-dom";
import { Spinner } from "react-bootstrap";
import Layout from "./components/Layout";
import ConfirmHost from "./components/ConfirmDialog";

const OrdersPage = lazy(() => import("./pages/OrdersPage"));
const OrderEditorPage = lazy(() => import("./pages/OrderEditorPage"));
const ReportEditorPage = lazy(() => import("./pages/ReportEditorPage"));
const SignReportPage = lazy(() => import("./pages/SignReportPage"));
const CustomersPage = lazy(() => import("./pages/CustomersPage"));
const EquipmentsPage = lazy(() => import("./pages/EquipmentsPage"));
const AnalyticsPage = lazy(() => import("./pages/AnalyticsPage"));
const SparePartsPage = lazy(() => import("./pages/SparePartsPage"));
const ConfigPage = lazy(() => import("./pages/ConfigPage"));
const AssetsPage = lazy(() => import("./pages/AssetsPage"));
const TableStylesPage = lazy(() => import("./pages/TableStylesPage"));
const TechnicianToolsPage = lazy(() => import("./pages/TechnicianToolsPage"));
const PdfHistoryPage = lazy(() => import("./pages/PdfHistoryPage"));
const SentinelHomePage = lazy(() => import("./pages/sentinelgrid/SentinelHomePage"));
const SentinelClientsPage = lazy(() => import("./pages/sentinelgrid/ClientsPage"));
const SentinelSitesPage = lazy(() => import("./pages/sentinelgrid/SitesPage"));
const SentinelCatalogPage = lazy(() => import("./pages/sentinelgrid/CatalogPage"));
const SentinelEquipmentsPage = lazy(() => import("./pages/sentinelgrid/EquipmentsPage"));
const SentinelManagementPage = lazy(() => import("./pages/sentinelgrid/ManagementPage"));
const SentinelProgramsPage = lazy(() => import("./pages/sentinelgrid/ProgramsPage"));
const SentinelProgramAssetsPage = lazy(() => import("./pages/sentinelgrid/ProgramAssetsPage"));
const SentinelPlansPage = lazy(() => import("./pages/sentinelgrid/PlansPage"));
const SentinelChecklistsPage = lazy(() => import("./pages/sentinelgrid/ChecklistsPage"));
const SentinelMaintenanceOrdersPage = lazy(() => import("./pages/sentinelgrid/MaintenanceOrdersPage"));
const SentinelCalendarPage = lazy(() => import("./pages/sentinelgrid/CalendarPage"));
const SentinelSchedulePage = lazy(() => import("./pages/sentinelgrid/SchedulePage"));
const SentinelTechnicianAgendaPage = lazy(() => import("./pages/sentinelgrid/TechnicianAgendaPage"));
const SentinelDemandScheduledPage = lazy(() => import("./pages/sentinelgrid/DemandScheduledPage"));
const SentinelAlertsPage = lazy(() => import("./pages/sentinelgrid/AlertsPage"));
const SentinelHistoryPage = lazy(() => import("./pages/sentinelgrid/HistoryPage"));
const SentinelDashboardPage = lazy(() => import("./pages/sentinelgrid/DashboardPage"));
const SentinelRecommendationsPage = lazy(() => import("./pages/sentinelgrid/RecommendationsPage"));

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
    <>
      <ConfirmHost />
      <Suspense fallback={<RouteFallback />}>
      <Routes>
        <Route path="/sentinelgrid/schedule/fullscreen" element={<SentinelSchedulePage />} />
        <Route element={<Layout />}>
          <Route path="/" element={<OrdersPage />} />
          <Route path="/orders/:id/editor" element={<OrderEditorPage />} />
          <Route path="/orders/:id/report" element={<ReportEditorPage />} />
          <Route path="/orders/:id/sign" element={<SignReportPage />} />
          <Route path="/customers" element={<CustomersPage />} />
          <Route path="/equipments" element={<EquipmentsPage />} />
          <Route path="/spare-parts" element={<SparePartsPage />} />
          <Route path="/assets" element={<AssetsPage />} />
          <Route path="/assets/technicians/:techId/tools" element={<TechnicianToolsPage />} />
          <Route path="/orders/:id/pdf-history" element={<PdfHistoryPage />} />
          <Route path="/table-styles" element={<TableStylesPage />} />
          <Route path="/sentinelgrid" element={<SentinelHomePage />} />
          <Route path="/sentinelgrid/clients" element={<SentinelClientsPage />} />
          <Route path="/sentinelgrid/sites" element={<SentinelSitesPage />} />
          <Route path="/sentinelgrid/catalog" element={<SentinelCatalogPage />} />
          <Route path="/sentinelgrid/equipment" element={<SentinelEquipmentsPage />} />
          <Route path="/sentinelgrid/management" element={<SentinelManagementPage />} />
          <Route path="/sentinelgrid/programs" element={<SentinelProgramsPage />} />
          <Route path="/sentinelgrid/assets" element={<SentinelProgramAssetsPage />} />
          <Route path="/sentinelgrid/plans" element={<SentinelPlansPage />} />
          <Route path="/sentinelgrid/checklists" element={<SentinelChecklistsPage />} />
          <Route path="/sentinelgrid/maintenance-orders" element={<SentinelMaintenanceOrdersPage />} />
          <Route path="/sentinelgrid/calendar" element={<SentinelCalendarPage />} />
          <Route path="/sentinelgrid/schedule" element={<SentinelSchedulePage />} />
          <Route path="/sentinelgrid/technician-agenda" element={<SentinelTechnicianAgendaPage />} />
          <Route path="/sentinelgrid/demands/scheduled" element={<SentinelDemandScheduledPage />} />
          <Route path="/sentinelgrid/alerts" element={<SentinelAlertsPage />} />
          <Route path="/sentinelgrid/history" element={<SentinelHistoryPage />} />
          <Route path="/sentinelgrid/dashboard" element={<SentinelDashboardPage />} />
          <Route path="/sentinelgrid/recommendations" element={<SentinelRecommendationsPage />} />
          <Route path="/config" element={<ConfigPage />} />
          <Route path="/analytics" element={<AnalyticsPage />} />
          <Route path="*" element={<p className="text-muted">Pagina nao encontrada (SPA).</p>} />
        </Route>
      </Routes>
      </Suspense>
    </>
  );
}
