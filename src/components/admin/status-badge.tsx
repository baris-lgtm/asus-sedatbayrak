import { EMAIL_STATUS_LABELS, STATUS_LABELS, type ApplicationStatus, type EmailStatus } from "@/lib/types";

const STYLES: Record<ApplicationStatus, string> = {
  pending: "border-ink bg-paper text-ink",
  reviewing: "border-blue bg-paper text-blue",
  approved: "border-ok bg-ok text-paper",
  waitlisted: "border-warn bg-amber-50 text-warn",
  rejected: "border-graphite bg-mist text-graphite",
  cancelled: "border-graphite bg-mist text-graphite line-through",
  checked_in: "border-ink bg-ink text-paper",
};

export function StatusBadge({ status }: { status: ApplicationStatus }) {
  return (
    <span className={`inline-flex whitespace-nowrap border px-2 py-0.5 text-xs font-semibold ${STYLES[status]}`}>
      {STATUS_LABELS[status]}
    </span>
  );
}

const EMAIL_STYLES: Record<EmailStatus, string> = {
  pending: "text-graphite",
  sending: "text-blue",
  sent: "text-ok",
  failed: "text-err font-semibold",
  skipped: "text-graphite",
};

export function EmailStatusText({ status }: { status: EmailStatus }) {
  return <span className={`text-xs ${EMAIL_STYLES[status]}`}>{EMAIL_STATUS_LABELS[status]}</span>;
}
