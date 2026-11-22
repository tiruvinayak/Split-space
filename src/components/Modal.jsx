import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

export default function Modal({ title, children, onClose }) {
  const dialog = useRef(null);
  useEffect(() => {
    const previous = document.activeElement;
    dialog.current?.querySelector('input, select, button, textarea')?.focus();
    const handleKeys = (event) => {
      if (event.key === 'Escape') onClose();
      if (event.key === 'Tab') {
        const focusable = [...(dialog.current?.querySelectorAll('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href]') || [])];
        if (!focusable.length) return;
        const first = focusable[0]; const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', handleKeys);
    return () => { document.removeEventListener('keydown', handleKeys); previous?.focus?.(); };
  }, [onClose]);
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section ref={dialog} className="modal" role="dialog" aria-modal="true" aria-labelledby="dialog-title"><header><div><p className="eyebrow">SPLITSPACE</p><h2 id="dialog-title">{title}</h2></div><button type="button" className="icon-button" aria-label="Close dialog" onClick={onClose}><X size={20} /></button></header>{children}</section></div>;
}
