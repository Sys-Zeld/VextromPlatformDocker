import { Button, OverlayTrigger, Tooltip } from "react-bootstrap";

// Botão somente-ícone com legenda (tooltip) no hover. Aceita props de Button
// (inclusive as={Link} to=... ou href=...) via rest.
type IconActionProps = { icon: string; label: string } & Record<string, unknown>;

export default function IconAction({ icon, label, ...rest }: IconActionProps) {
  return (
    <OverlayTrigger placement="top" overlay={<Tooltip>{label}</Tooltip>}>
      <Button size="sm" className="vx-icon-btn" aria-label={label} {...rest}>
        <span className="material-symbols-outlined">{icon}</span>
      </Button>
    </OverlayTrigger>
  );
}
