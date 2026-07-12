import SgIcon, { SgIconName } from "./SgIcon";
import { PRIORITY_META, SgAlertPriority } from "../../api/sentinelgrid/calendarMap";

// Badge de prioridade/severidade (A.8): ícone da severidade + chip colorido com o
// rótulo. O ícone fica na cor natural (traço no tema + acento verde) sobre o fundo
// neutro; o chip mantém a cor forte por prioridade.
const PRIORITY_ICON: Record<SgAlertPriority, SgIconName | null> = {
  informativo: null,
  atencao: "attention",
  importante: "important",
  critico: "critical",
  emergencial: "emergency"
};

interface Props {
  priority: SgAlertPriority;
  size?: number;
}

export default function PriorityBadge({ priority, size = 17 }: Props) {
  const meta = PRIORITY_META[priority];
  const icon = PRIORITY_ICON[priority];
  return (
    <span className="d-inline-flex align-items-center gap-1">
      {icon && <SgIcon name={icon} size={size} title={meta.label} />}
      <span className="badge" style={{ background: meta.hex, color: meta.text }}>{meta.label}</span>
    </span>
  );
}
