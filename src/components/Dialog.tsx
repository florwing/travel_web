import { useEffect, useId, type ReactNode } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faXmark } from '@fortawesome/free-solid-svg-icons';

interface DialogProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  panelClassName?: string;
}

export function Dialog({
  open,
  title,
  onClose,
  children,
  footer,
  panelClassName = 'sm:max-w-lg',
}: DialogProps) {
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [onClose, open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6" role="presentation">
      <button
        type="button"
        className="absolute inset-0 bg-forest-900/45 backdrop-blur-[3px]"
        aria-label="關閉視窗"
        onClick={onClose}
      />
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`relative max-h-[88vh] w-full overflow-y-auto rounded-t-4xl border-[3px] border-white/90 bg-paper p-5 shadow-float sm:rounded-4xl sm:p-6 ${panelClassName}`}
      >
        <div className="mb-5 flex items-center justify-between gap-4 border-b-2 border-dashed border-line pb-4">
          <h2 id={titleId} className="text-xl font-black text-forest-800">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="tap-feedback flex h-11 w-11 items-center justify-center rounded-full border-2 border-white bg-canvas text-muted shadow-soft-sm hover:text-forest-800"
            aria-label="關閉"
          >
            <FontAwesomeIcon icon={faXmark} aria-hidden="true" />
          </button>
        </div>
        {children}
        {footer && <div className="mt-6 flex gap-3 border-t border-line pt-4">{footer}</div>}
      </section>
    </div>
  );
}
