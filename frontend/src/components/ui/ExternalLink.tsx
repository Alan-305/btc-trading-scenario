import type { ReactNode } from "react";

interface ExternalLinkProps {
  href: string;
  children: ReactNode;
  className?: string;
}

export function ExternalLink({ href, children, className = "" }: ExternalLinkProps) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex min-h-[44px] items-center gap-1 text-xs text-accent-blue transition hover:text-blue-400 hover:underline ${className}`}
    >
      {children}
      <span aria-hidden className="font-english">
        ↗
      </span>
    </a>
  );
}
