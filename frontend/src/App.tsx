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
const SentinelAuditorEquipmentPage = lazy(() => import("./pages/sentinelgrid/AuditorEquipmentPage"));
const SentinelAuditorClientPage = lazy(() => import("./pages/sentinelgrid/AuditorClientPage"));
const SentinelReportEquipmentSchedulePage = lazy(() => import("./pages/sentinelgrid/ReportEquipmentSchedulePage"));
const SentinelReportTechnicianOrdersPage = lazy(() => import("./pages/sentinelgrid/ReportTechnicianOrdersPage"));
const SentinelReportClientSchedulePage = lazy(() => import("./pages/sentinelgrid/ReportClientSchedulePage"));

const ExpensesDashboardPage = lazy(() => import("./pages/expenses/DashboardPage"));
const ExpensesMyReportsPage = lazy(() => import("./pages/expenses/MyReportsPage"));
const ExpensesNewReportPage = lazy(() => import("./pages/expenses/NewReportPage"));
const ExpensesReportDetailPage = lazy(() => import("./pages/expenses/ReportDetailPage"));
const ExpensesProfilePage = lazy(() => import("./pages/expenses/ProfilePage"));
const ExpensesHistoryPage = lazy(() => import("./pages/expenses/HistoryPage"));
const ExpensesNotificationsPage = lazy(() => import("./pages/expenses/NotificationsPage"));
const ExpensesAdminDashboardPage = lazy(() => import("./pages/expenses/admin/AdminDashboardPage"));
const ExpensesAdminReportsPage = lazy(() => import("./pages/expenses/admin/AdminReportsPage"));
const ExpensesPaymentsPage = lazy(() => import("./pages/expenses/admin/PaymentsPage"));
const ExpensesCategoriesPage = lazy(() => import("./pages/expenses/admin/CategoriesPage"));
const ExpensesAuditPage = lazy(() => import("./pages/expenses/admin/AuditPage"));
const ExpensesUsersPage = lazy(() => import("./pages/expenses/admin/UsersPage"));
const ExpensesSettingsPage = lazy(() => import("./pages/expenses/admin/SettingsPage"));
const ExpensesGuard = lazy(() => import("./pages/expenses/auth/ExpensesGuard"));
const ExpensesLoginPage = lazy(() => import("./pages/expenses/auth/LoginPage"));
const ExpensesForgotPasswordPage = lazy(() => import("./pages/expenses/auth/ForgotPasswordPage"));
const ExpensesTokenPasswordPage = lazy(() => import("./pages/expenses/auth/TokenPasswordPage"));
const ExpensesChangePasswordPage = lazy(() => import("./pages/expenses/auth/ChangePasswordPage"));
const ExpensesMobileShell = lazy(() => import("./pages/expenses/mobile/MobileShell"));
const ExpensesMobileReportsPage = lazy(() => import("./pages/expenses/mobile/MobileReportsPage"));
const ExpensesMobileReportFormPage = lazy(() => import("./pages/expenses/mobile/MobileReportFormPage"));
const ExpensesMobileReportPage = lazy(() => import("./pages/expenses/mobile/MobileReportPage"));
const ExpensesMobileItemPage = lazy(() => import("./pages/expenses/mobile/MobileItemPage"));
const ExpensesMobileDashboardPage = lazy(() => import("./pages/expenses/mobile/MobileDashboardPage"));
const ExpensesMobileNotificationsPage = lazy(() => import("./pages/expenses/mobile/MobileNotificationsPage"));
const ExpensesMobileHistoryPage = lazy(() => import("./pages/expenses/mobile/MobileHistoryPage"));
const ExpensesMobileChangePasswordPage = lazy(() => import("./pages/expenses/mobile/MobileChangePasswordPage"));
const ExpensesMobileMorePage = lazy(() => import("./pages/expenses/mobile/MobileMorePage"));

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
        {/* Telas públicas do módulo de Despesas (sem sessão, fora do Layout). */}
        <Route path="/expenses/login" element={<ExpensesLoginPage />} />
        <Route path="/expenses/forgot-password" element={<ExpensesForgotPasswordPage />} />
        <Route path="/expenses/set-password" element={<ExpensesTokenPasswordPage />} />
        <Route path="/expenses/reset-password" element={<ExpensesTokenPasswordPage />} />
        {/* Despesas no celular: fora do Layout, só funções do Colaborador. */}
        <Route element={<ExpensesGuard />}>
          <Route element={<ExpensesMobileShell />}>
            <Route path="/expenses/m" element={<ExpensesMobileReportsPage />} />
            <Route path="/expenses/m/reports/new" element={<ExpensesMobileReportFormPage />} />
            <Route path="/expenses/m/reports/:id" element={<ExpensesMobileReportPage />} />
            <Route path="/expenses/m/reports/:id/edit" element={<ExpensesMobileReportFormPage />} />
            <Route path="/expenses/m/reports/:id/items/new" element={<ExpensesMobileItemPage />} />
            <Route path="/expenses/m/reports/:id/items/:itemId" element={<ExpensesMobileItemPage />} />
            <Route path="/expenses/m/painel" element={<ExpensesMobileDashboardPage />} />
            <Route path="/expenses/m/notifications" element={<ExpensesMobileNotificationsPage />} />
            <Route path="/expenses/m/history" element={<ExpensesMobileHistoryPage />} />
            <Route path="/expenses/m/change-password" element={<ExpensesMobileChangePasswordPage />} />
            <Route path="/expenses/m/more" element={<ExpensesMobileMorePage />} />
          </Route>
        </Route>
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
          <Route path="/sentinelgrid/auditor/equipment" element={<SentinelAuditorEquipmentPage />} />
          <Route path="/sentinelgrid/auditor/client" element={<SentinelAuditorClientPage />} />
          <Route path="/sentinelgrid/reports/equipment-schedule" element={<SentinelReportEquipmentSchedulePage />} />
          <Route path="/sentinelgrid/reports/technician-orders" element={<SentinelReportTechnicianOrdersPage />} />
          <Route path="/sentinelgrid/reports/client-schedule" element={<SentinelReportClientSchedulePage />} />
          {/* Relatório de Despesas: login próprio — só entra com sessão do módulo. */}
          <Route element={<ExpensesGuard />}>
            <Route path="/expenses" element={<ExpensesDashboardPage />} />
            <Route path="/expenses/reports" element={<ExpensesMyReportsPage />} />
            <Route path="/expenses/reports/new" element={<ExpensesNewReportPage />} />
            <Route path="/expenses/reports/:id" element={<ExpensesReportDetailPage />} />
            <Route path="/expenses/profile" element={<ExpensesProfilePage />} />
            <Route path="/expenses/history" element={<ExpensesHistoryPage />} />
            <Route path="/expenses/notifications" element={<ExpensesNotificationsPage />} />
            <Route path="/expenses/change-password" element={<ExpensesChangePasswordPage />} />
            <Route path="/expenses/admin" element={<ExpensesAdminDashboardPage />} />
            <Route path="/expenses/admin/reports" element={<ExpensesAdminReportsPage />} />
            <Route path="/expenses/admin/reports/:id" element={<ExpensesReportDetailPage admin />} />
            <Route path="/expenses/admin/payments" element={<ExpensesPaymentsPage />} />
            <Route path="/expenses/admin/history" element={<ExpensesHistoryPage admin />} />
            <Route path="/expenses/admin/categories" element={<ExpensesCategoriesPage />} />
            <Route path="/expenses/admin/audit" element={<ExpensesAuditPage />} />
            <Route path="/expenses/users" element={<ExpensesUsersPage />} />
            <Route path="/expenses/settings" element={<ExpensesSettingsPage />} />
          </Route>
          <Route path="/config" element={<ConfigPage />} />
          <Route path="/analytics" element={<AnalyticsPage />} />
          <Route path="*" element={<p className="text-muted">Pagina nao encontrada (SPA).</p>} />
        </Route>
      </Routes>
      </Suspense>
    </>
  );
}
