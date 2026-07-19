import ManagementReport from "../../components/sentinelgrid/ManagementReport";

// OMs por técnico: carga e execução de cada técnico no período.
// Uma OM com vários técnicos aparece na linha de cada um; o total consolida OMs distintas.
export default function ReportTechnicianOrdersPage() {
  return <ManagementReport kind="technician-orders" showTechnician />;
}
