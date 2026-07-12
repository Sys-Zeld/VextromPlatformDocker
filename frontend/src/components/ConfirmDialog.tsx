import { useCallback, useEffect, useRef, useState } from "react";
import { Button, Modal } from "react-bootstrap";

// Diálogo de confirmação tematizado (identidade Vextrom), substituindo o
// window.confirm() nativo. Uso imperativo via singleton — chamável de qualquer
// módulo sem hook: `if (await confirmDialog("Excluir X?")) { ... }`.
// O <ConfirmHost/> é montado uma única vez no root (App.tsx) e resolve a Promise.

export interface ConfirmOptions {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "primary";
  icon?: string; // nome do glifo material-symbols
}

type Normalized = Required<ConfirmOptions>;

interface Pending extends Normalized {
  resolve: (ok: boolean) => void;
}

// Verbos que caracterizam uma ação destrutiva → botão vermelho + rótulo "Excluir".
const DESTRUCTIVE = ["excluir", "remover", "apagar", "descartar"];

function normalize(opts: string | ConfirmOptions): Normalized {
  const o: ConfirmOptions = typeof opts === "string" ? { message: opts } : opts;
  const firstWord = (o.message.match(/^\s*([A-Za-zÀ-ÿ]+)/)?.[1] || "").toLowerCase();
  const destructive = DESTRUCTIVE.includes(firstWord);
  return {
    title: o.title ?? (destructive ? "Confirmar exclusão" : "Confirmar ação"),
    message: o.message,
    confirmLabel: o.confirmLabel ?? (destructive ? "Excluir" : "Confirmar"),
    cancelLabel: o.cancelLabel ?? "Cancelar",
    variant: o.variant ?? (destructive ? "danger" : "primary"),
    icon: o.icon ?? (destructive ? "delete" : "help")
  };
}

// Handler registrado pelo host montado. Enquanto não houver host, cai no
// confirm() nativo (fallback seguro — nunca deixa a ação sem confirmação).
let openHandler: ((opts: ConfirmOptions) => Promise<boolean>) | null = null;

export function confirmDialog(opts: string | ConfirmOptions): Promise<boolean> {
  const options: ConfirmOptions = typeof opts === "string" ? { message: opts } : opts;
  if (!openHandler) {
    return Promise.resolve(window.confirm(options.message));
  }
  return openHandler(options);
}

export default function ConfirmHost() {
  const [pending, setPending] = useState<Pending | null>(null);
  const confirmRef = useRef<HTMLButtonElement | null>(null);
  const cancelRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    openHandler = (opts) =>
      new Promise<boolean>((resolve) => setPending({ ...normalize(opts), resolve }));
    return () => {
      openHandler = null;
    };
  }, []);

  // Resolve a Promise exatamente uma vez e fecha (o updater garante atomicidade
  // mesmo se onHide e o clique dispararem em sequência).
  const settle = useCallback((ok: boolean) => {
    setPending((p) => {
      p?.resolve(ok);
      return null;
    });
  }, []);

  // Ao abrir: em ações destrutivas o foco vai para "Cancelar" (evita exclusão
  // acidental por Enter); nas demais, para o botão de confirmação.
  const focusInitial = () => {
    const target = pending?.variant === "danger" ? cancelRef : confirmRef;
    target.current?.focus();
  };

  return (
    <Modal show={!!pending} onHide={() => settle(false)} centered onEntered={focusInitial}>
      {pending && (
        <>
          <Modal.Header closeButton>
            <Modal.Title as="h6" className="d-flex align-items-center gap-2 mb-0">
              <span className={`vx-confirm__icon vx-confirm__icon--${pending.variant}`}>
                <span className="material-symbols-outlined">{pending.icon}</span>
              </span>
              {pending.title}
            </Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <p className="mb-0" style={{ whiteSpace: "pre-line" }}>{pending.message}</p>
          </Modal.Body>
          <Modal.Footer>
            <Button ref={cancelRef} variant="outline-secondary" onClick={() => settle(false)}>
              {pending.cancelLabel}
            </Button>
            <Button ref={confirmRef} variant={pending.variant} onClick={() => settle(true)}>
              {pending.confirmLabel}
            </Button>
          </Modal.Footer>
        </>
      )}
    </Modal>
  );
}
