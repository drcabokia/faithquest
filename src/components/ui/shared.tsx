import Link from "next/link";
import { ArrowRight, Check, LockKeyhole, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
export function PageHeading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p className="page-description">{description}</p>
      </div>
      {action}
    </div>
  );
}
export function Progress({
  value,
  label,
  className,
}: {
  value: number;
  label: string;
  className?: string;
}) {
  return (
    <div
      className={cn("progress", className)}
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(value)}
    >
      <span style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  );
}
export function SectionLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link className="text-link" href={href}>
      {children}
      <ArrowRight size={15} />
    </Link>
  );
}
export function StatusIcon({
  done,
  locked = false,
}: {
  done: boolean;
  locked?: boolean;
}) {
  return (
    <span className={cn("status-icon", done && "done")}>
      {done ? (
        <Check size={17} />
      ) : locked ? (
        <LockKeyhole size={15} />
      ) : (
        <Sparkles size={17} />
      )}
    </span>
  );
}
export function EmptyState({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="empty-state">
      <Sparkles size={25} />
      <h3>{title}</h3>
      <p>{children}</p>
    </div>
  );
}
