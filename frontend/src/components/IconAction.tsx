import { Button, OverlayTrigger, Tooltip } from "react-bootstrap";
import SgIcon, { isSgIconName } from "./sentinelgrid/SgIcon";

type IconActionProps = { icon: string; label: string } & Record<string, unknown>;

const MATERIAL_SYMBOL_BY_ACTION: Record<string, string> = {
  edit: "edit_square",
  edit_note: "edit_document",
  open_in_new: "open_in_new",
  picture_as_pdf: "picture_as_pdf",
  download: "download",
  handyman: "construction",
  link_off: "link_off",
  add_link: "add_link",
  restart_alt: "restart_alt",
  delete: "delete",
  edit_record: "edit_square",
  delete_record: "delete_forever",
  checklist_items: "checklist_rtl",
  execute_checklist: "fact_check",
  technical_execution: "engineering",
  change_status: "published_with_changes",
  approve_shutdown: "approval",
  save_item: "save_as",
  program_assets: "perm_media",
  generate_plans: "event_repeat",
  edit_plan_action: "edit_calendar",
  delete_plan_action: "event_busy",
  manage_members: "group",
  expand_more_action: "keyboard_arrow_down",
  expand_less_action: "keyboard_arrow_up"
};

export default function IconAction({ icon, label, ...rest }: IconActionProps) {
  const materialIcon = MATERIAL_SYMBOL_BY_ACTION[icon] ?? icon;

  return (
    <OverlayTrigger placement="top" overlay={<Tooltip>{label}</Tooltip>}>
      <Button size="sm" className="vx-icon-btn" aria-label={label} title={label} {...rest}>
        {isSgIconName(icon) ? (
          <SgIcon name={icon} size={18} className="sg-icon--mono" />
        ) : (
          <span className="material-symbols-outlined" aria-hidden="true">{materialIcon}</span>
        )}
      </Button>
    </OverlayTrigger>
  );
}
