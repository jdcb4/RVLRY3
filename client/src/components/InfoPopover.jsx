import { useEffect, useId, useState } from 'react';
import { InfoIcon, XIcon } from './Icons';

export function InfoPopover({
  label = 'More details',
  title = null,
  align = 'right',
  children
}) {
  const [isOpen, setIsOpen] = useState(false);
  const panelId = useId();

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  return (
    <details
      className={`info-popover info-popover--${align}`}
      open={isOpen}
      onToggle={(event) => setIsOpen(event.currentTarget.open)}
    >
      <summary
        aria-controls={panelId}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        aria-label={label}
        className="icon-button icon-button--subtle"
      >
        <InfoIcon />
      </summary>
      {isOpen ? (
        <button
          aria-label={`Dismiss ${label}`}
          className="info-popover__backdrop"
          onClick={() => setIsOpen(false)}
          type="button"
        />
      ) : null}
      <div
        className="info-popover__panel"
        id={panelId}
        role="dialog"
      >
        <div className="info-popover__header">
          {title ? <strong>{title}</strong> : <span />}
          <button
            type="button"
            aria-label={`Close ${label}`}
            className="icon-button icon-button--subtle"
            onClick={() => setIsOpen(false)}
          >
            <XIcon />
          </button>
        </div>
        <div className="info-popover__body">{children}</div>
      </div>
    </details>
  );
}
