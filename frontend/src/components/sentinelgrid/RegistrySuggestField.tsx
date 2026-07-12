import { useMemo, useRef, useState } from "react";
import { Badge, Form, ListGroup } from "react-bootstrap";

export type RegistryModule = "rs" | "sg";

export interface RegistrySuggestItem {
  id: number;
  name: string;
  module: RegistryModule;
}

const MODULE_LABEL: Record<RegistryModule, string> = {
  rs: "Service-Report",
  sg: "SentinelGrid"
};

interface Props {
  value: string;
  onChange: (value: string) => void;
  items: RegistrySuggestItem[];
  // Módulo da tela atual: itens deste módulo apenas preenchem o nome; itens do
  // outro módulo disparam a importação (onImportPick).
  currentModule: RegistryModule;
  onImportPick: (item: RegistrySuggestItem) => void;
  placeholder?: string;
  required?: boolean;
  id?: string;
}

// Caixa de sugestão (autocomplete) que lista cadastros dos dois módulos, cada um
// rotulado com a origem ("Service-Report: X" / "SentinelGrid: Y"). Escolher um item
// do próprio módulo preenche o nome; escolher um do outro módulo dispara a importação.
export default function RegistrySuggestField({
  value,
  onChange,
  items,
  currentModule,
  onImportPick,
  placeholder,
  required,
  id
}: Props) {
  const [open, setOpen] = useState(false);
  const blurTimer = useRef<number | null>(null);

  const filtered = useMemo(() => {
    const q = value.trim().toLowerCase();
    const base = q ? items.filter((it) => it.name.toLowerCase().includes(q)) : items;
    // Outro módulo primeiro (é o que interessa importar), depois por nome.
    return [...base]
      .sort((a, b) => {
        if (a.module !== b.module) return a.module === currentModule ? 1 : -1;
        return a.name.localeCompare(b.name);
      })
      .slice(0, 50);
  }, [items, value, currentModule]);

  const pick = (it: RegistrySuggestItem) => {
    setOpen(false);
    if (it.module === currentModule) {
      onChange(it.name);
    } else {
      onImportPick(it);
    }
  };

  return (
    <div className="position-relative">
      <Form.Control
        id={id}
        required={required}
        autoComplete="off"
        placeholder={placeholder}
        value={value}
        onChange={(e) => { onChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onBlur={() => { blurTimer.current = window.setTimeout(() => setOpen(false), 150); }}
      />
      {open && filtered.length > 0 && (
        <ListGroup
          className="position-absolute shadow-sm"
          style={{ zIndex: 1056, maxHeight: 320, overflowY: "auto", minWidth: 360, maxWidth: 520, width: "max-content" }}
          onMouseDown={() => { if (blurTimer.current) window.clearTimeout(blurTimer.current); }}
        >
          {filtered.map((it) => (
            <ListGroup.Item
              key={`${it.module}-${it.id}`}
              action
              onClick={() => pick(it)}
              className="d-flex justify-content-between align-items-start gap-2 py-1"
            >
              <span className="text-break">
                <span className="text-muted small me-1">{MODULE_LABEL[it.module]}:</span>
                {it.name}
              </span>
              {it.module !== currentModule && <Badge bg="primary" className="flex-shrink-0">importar</Badge>}
            </ListGroup.Item>
          ))}
        </ListGroup>
      )}
    </div>
  );
}
