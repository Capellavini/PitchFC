import { useEffect, useId, useRef } from 'react';
import { PitchButton } from './PitchButton.jsx';

export function PitchDialog({ open, onClose, title, children, actions }) {
  const ref = useRef(null); const headingId = useId();
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    const trigger = document.activeElement;
    if (open && !dialog.open) dialog.showModal();
    else if (!open && dialog.open) dialog.close();
    return () => { if (dialog.open) dialog.close(); if (trigger?.isConnected) trigger.focus(); };
  }, [open]);
  return <dialog ref={ref} className="pl-dialog" aria-labelledby={headingId}
    onCancel={event => { event.preventDefault(); onClose(); }}>
    <header><h2 id={headingId}>{title}</h2><PitchButton variant="ghost" onClick={onClose} aria-label="Fechar diálogo">×</PitchButton></header>
    <div className="pl-dialog-body">{children}</div>{actions && <footer>{actions}</footer>}
  </dialog>;
}

/** Plain content only; rich-text persistence/rendering is deliberately not coupled to this kit. */
