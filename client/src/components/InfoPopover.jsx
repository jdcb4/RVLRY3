import { useState } from 'react';
import { InfoIcon } from './Icons';

export function InfoPopover({
  label = 'More details',
  title = null,
  align = 'right',
  children
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <details
      className={`info-popover info-popover--${align}`}
      open={isOpen}
      onToggle={(event) => setIsOpen(event.currentTarget.open)}
    >
      <summary aria-label={label} className="icon-button icon-button--subtle">
        <InfoIcon />
      </summary>
      <div className="info-popover__panel">
        {title ? <strong>{title}</strong> : null}
        <div className="info-popover__body">{children}</div>
      </div>
    </details>
  );
}
