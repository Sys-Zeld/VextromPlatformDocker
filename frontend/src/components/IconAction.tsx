import { Button, OverlayTrigger, Tooltip } from "react-bootstrap";

// Botão somente-ícone com legenda (tooltip) no hover. Aceita props de Button
// (inclusive as={Link} to=... ou href=...) via rest.
type IconActionProps = { icon: string; label: string } & Record<string, unknown>;

// Lixeira em SVG inline — o botão "excluir" não usa a fonte Material Symbols,
// garantindo renderização consistente independente do carregamento da fonte.
function TrashIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5m2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5m3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0z" />
      <path d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4zM2.5 3h11V2h-11z" />
    </svg>
  );
}

export default function IconAction({ icon, label, ...rest }: IconActionProps) {
  return (
    <OverlayTrigger placement="top" overlay={<Tooltip>{label}</Tooltip>}>
      <Button size="sm" className="vx-icon-btn" aria-label={label} {...rest}>
        {icon === "delete"
          ? <TrashIcon />
          : <span className="material-symbols-outlined">{icon}</span>}
      </Button>
    </OverlayTrigger>
  );
}
