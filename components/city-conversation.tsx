import { useEffect, useId, useRef } from "react";
import type { ReactNode, RefObject } from "react";
import { ArrowRight, MessageCircle, X } from "lucide-react";

export function ConversationFrame({ dialog, title, name, role, portrait, step, onClose, children, moduleProgress, variant = "conversation" }: {
  dialog: RefObject<HTMLDialogElement | null>;
  title: string;
  name: string;
  role: string;
  portrait?: string;
  step?: string | number;
  onClose: () => void;
  children: ReactNode;
  moduleProgress?: ReactNode;
  variant?: "conversation" | "workbench";
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  const headingId = useId();
  const priorStep = useRef(step);
  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (!element.open) element.showModal();
    heading.current?.focus({ preventScroll: true });
  }, [dialog]);

  useEffect(() => {
    if (step === undefined || step === priorStep.current) return;
    priorStep.current = step;
    const element = dialog.current;
    if (!element?.open) return;
    element.scrollTop = 0;
    (element.querySelector<HTMLElement>(".conversation-line") ?? element.querySelector<HTMLElement>(".mission-lab"))?.focus({ preventScroll: true });
  }, [dialog, step]);

  return (
    <dialog className={`conversation-dialog ${variant === "workbench" ? "conversation-dialog--workbench" : ""}`} ref={dialog} aria-labelledby={headingId} onClose={onClose}>
      <header className="conversation-top">
        <div><MessageCircle size={16} aria-hidden="true" /><h2 id={headingId} tabIndex={-1} ref={heading}>{title}</h2></div>
        {moduleProgress}
        <button className="icon-button" type="button" aria-label="Close conversation" onClick={() => dialog.current?.close()}><X size={19} aria-hidden="true" /></button>
      </header>
      {variant === "conversation" && <div className="conversation-character">
        {portrait ? <img className="conversation-portrait" src={`/models/portraits/${portrait}.webp`} alt="" width={360} height={416} /> :
          <div className="conversation-symbol" aria-hidden="true"><MessageCircle size={26} /></div>}
      </div>}
      <section className={`conversation-card ${variant === "workbench" ? "conversation-card--workbench" : ""}`} aria-label={variant === "workbench" ? `${title} work area` : `Conversation with ${name}`}>
        {variant === "conversation" && <header className="conversation-speaker"><strong>{name}</strong><span>{role}</span></header>}
        <div className="conversation-content">{children}</div>
      </section>
    </dialog>
  );
}

export function ConversationAction({ children, onClick, primary = false, disabled = false, pressed }: { children: ReactNode; onClick: () => void; primary?: boolean; disabled?: boolean; pressed?: boolean }) {
  return <button className={`button ${primary ? "button-primary" : "button-outline"}`} type="button" disabled={disabled}
    aria-pressed={pressed} data-selected={pressed || undefined} onClick={onClick}>
    {children}{primary && <ArrowRight size={16} aria-hidden="true" />}
  </button>;
}
