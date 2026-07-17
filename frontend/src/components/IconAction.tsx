import { Button, OverlayTrigger, Tooltip } from "react-bootstrap";
import SgIcon, { isSgIconName } from "./sentinelgrid/SgIcon";
import type { SgIconName } from "./sentinelgrid/SgIcon";

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

const SG_ICON_BY_ACTION: Record<string, SgIconName> = {
  edit_record: "pencil",
  delete_record: "trash",
  checklist_items: "manage-items",
  execute_checklist: "execute-checklist",
  technical_execution: "technical-execution",
  change_status: "change-status",
  approve_shutdown: "approve-shutdown",
  save_item: "save",
  program_assets: "assets",
  generate_plans: "generate-by-plan",
  edit_plan_action: "edit-plan",
  delete_plan_action: "delete-plan",
  qr_code_2: "qr-code"
};

export default function IconAction({ icon, label, ...rest }: IconActionProps) {
  const materialIcon = MATERIAL_SYMBOL_BY_ACTION[icon] ?? icon;
  const sgIcon = SG_ICON_BY_ACTION[icon] ?? (isSgIconName(icon) ? icon : null);

  return (
    <OverlayTrigger placement="top" overlay={<Tooltip>{label}</Tooltip>}>
      <Button size="sm" className="vx-icon-btn btn-no-icon" aria-label={label} title={label} {...rest}>
        {sgIcon ? (
          <SgIcon name={sgIcon} size={29} />
        ) : (
          <span className="material-symbols-outlined" aria-hidden="true">{materialIcon}</span>
        )}
      </Button>
    </OverlayTrigger>
  );
}
