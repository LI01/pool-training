import type { ComponentChildren } from 'preact';

export interface BigButtonProps {
  variant?: 'good' | 'bad' | 'neutral';
  onClick?: () => void;
  disabled?: boolean;
  children: ComponentChildren;
}

export function BigButton({ variant = 'neutral', onClick, disabled, children }: BigButtonProps) {
  return (
    <button type="button" class={`big-button big-button--${variant}`} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  );
}
