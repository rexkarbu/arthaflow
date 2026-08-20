import React from 'react';

/**
 * ArthaFlow Brand Logo & Monogram System
 * Architectural geometric monogram combining 'A' + 'F' + controlled allocation flow.
 *
 * Variants:
 * - "mark": Standalone geometric symbol
 * - "full": Symbol + Wordmark ("ArthaFlow.")
 * - "wordmark": Wordmark only ("ArthaFlow.")
 * - "icon": Symbol with subtle app-container surface
 */
export default function ArthaFlowLogo({
  variant = 'full',
  size = 18,
  className = '',
  color,
  accentColor,
  showDot = true,
  'aria-label': ariaLabel,
  'aria-hidden': ariaHidden,
  ...props
}) {
  const isAccessible = !!ariaLabel;
  const hideAria = ariaHidden ?? !isAccessible;

  // Standalone Brand Mark SVG (24x24 viewBox)
  const MarkSvg = (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`arthaflow-brand-mark ${className}`}
      aria-hidden={hideAria}
      aria-label={ariaLabel || (variant === 'mark' ? 'ArthaFlow' : undefined)}
      role={isAccessible || variant === 'mark' ? 'img' : undefined}
      {...props}
    >
      {/* Primary Architectural Monogram Spine ('A' + 'F' Interlock) */}
      <path
        d="M4 4.5C4 3.67 4.67 3 5.5 3H18.5C19.33 3 20 3.67 20 4.5V7.5C20 8.33 19.33 9 18.5 9H9V11.5H15.5C16.33 11.5 17 12.17 17 13V15C17 15.83 16.33 16.5 15.5 16.5H9V19.5C9 20.33 8.33 21 7.5 21H5.5C4.67 21 4 20.33 4 19.5V4.5Z"
        fill={color || 'currentColor'}
      />
      {/* Discrete Graphite Sage Accent Node (Allocation Signature) */}
      <rect
        x="13"
        y="17"
        width="4"
        height="4"
        rx="1"
        fill={accentColor || 'var(--brand)'}
      />
    </svg>
  );

  if (variant === 'mark') {
    return MarkSvg;
  }

  if (variant === 'icon') {
    return (
      <div
        className={`arthaflow-brand-icon-box ${className}`}
        style={{
          width: size * 1.5,
          height: size * 1.5,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--surface-raised)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-sm)',
        }}
        aria-hidden={hideAria}
        aria-label={ariaLabel || 'ArthaFlow'}
      >
        {MarkSvg}
      </div>
    );
  }

  if (variant === 'wordmark') {
    return (
      <span className={`arthaflow-brand-wordmark ${className}`} aria-hidden={hideAria}>
        ArthaFlow{showDot && <span className="logo-dot">.</span>}
      </span>
    );
  }

  // Default: "full" (Mark + Wordmark lockup)
  return (
    <span
      className={`arthaflow-brand-lockup ${className}`}
      style={{ display: 'inline-flex', alignItems: 'center', gap: '7px' }}
      aria-label={ariaLabel || 'ArthaFlow'}
      role="img"
    >
      {MarkSvg}
      <span className="site-title">
        ArthaFlow{showDot && <span className="logo-dot">.</span>}
      </span>
    </span>
  );
}
