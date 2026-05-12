"use client";

import { useCallback, useState } from "react";

type IconCopyButtonProps = {
  textToCopy: string;
  /** e.g. "Copy stream id" */
  label: string;
  disabled?: boolean;
  className?: string;
};

export function IconCopyButton({ textToCopy, label, disabled, className }: IconCopyButtonProps) {
  const [copied, setCopied] = useState(false);

  const onCopy = useCallback(async () => {
    if (!textToCopy || disabled) return;
    try {
      await navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard denied */
    }
  }, [disabled, textToCopy]);

  const base =
    "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-zinc-200 text-zinc-600 transition hover:bg-zinc-50 hover:text-zinc-900 disabled:opacity-40 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100";

  return (
    <button
      type="button"
      className={`${base} ${className ?? ""}`}
      aria-label={label}
      title={label}
      disabled={disabled || !textToCopy}
      onClick={() => void onCopy()}
    >
      {copied ? (
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ) : (
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
          <rect x="9" y="9" width="11" height="11" rx="2" />
          <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" strokeLinecap="round" />
        </svg>
      )}
    </button>
  );
}
