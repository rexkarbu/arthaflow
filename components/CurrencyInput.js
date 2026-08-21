'use client';

import { useState } from 'react';
import { formatCurrencyInput, parseCurrency } from '@/lib/currency';

/**
 * Reusable Currency Input Component for Indonesian Rupiah
 * - Live auto-formats with thousands dot separator ("1.000.000")
 * - Sanitizes copy-paste input (e.g. "Rp 2.500.000" -> "2.500.000")
 * - Supports both controlled (`value`) and uncontrolled (`defaultValue`) modes
 * 
 * CANONICAL CALLBACK CONTRACT:
 * @param {function(cleanNum: number, formatted: string, event: React.SyntheticEvent): void} onChange
 *   - `cleanNum`: raw numeric whole-Rupiah amount (e.g. 500000)
 *   - `formatted`: localized string formatted with dot separators (e.g. "500.000")
 *   - `event`: native DOM / SyntheticEvent
 * NOTE: The first callback argument is NOT a DOM event. Do NOT read `e.target.value` from the first argument.
 */
export default function CurrencyInput({
  id,
  name,
  value,
  defaultValue = '',
  placeholder = '0',
  className = 'input amount-input',
  required = false,
  autoFocus = false,
  onChange,
  onBlur,
  ...props
}) {
  const isControlled = value !== undefined;
  const [internalVal, setInternalVal] = useState(() => {
    const initial = isControlled ? value : defaultValue;
    if (initial !== '' && initial !== null && initial !== undefined) {
      return formatCurrencyInput(initial);
    }
    return '';
  });

  const displayVal = isControlled
    ? (value !== '' && value !== null && value !== undefined ? formatCurrencyInput(value) : '')
    : internalVal;

  function handleChange(e) {
    const inputValue = e.target.value;
    const cleanNum = parseCurrency(inputValue);
    const formatted = formatCurrencyInput(inputValue);

    if (!isControlled) {
      setInternalVal(formatted);
    }

    if (onChange) {
      onChange(cleanNum, formatted, e);
    }
  }

  return (
    <input
      type="text"
      inputMode="numeric"
      id={id}
      name={name}
      className={className}
      placeholder={placeholder}
      value={displayVal}
      onChange={handleChange}
      onBlur={onBlur}
      required={required}
      autoFocus={autoFocus}
      autoComplete="off"
      {...props}
    />
  );
}
