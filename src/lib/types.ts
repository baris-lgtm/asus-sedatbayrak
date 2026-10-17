export const APPLICATION_STATUSES = [
  "pending",
  "reviewing",
  "approved",
  "waitlisted",
  "rejected",
  "cancelled",
  "checked_in",
] as const;
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

export const STATUS_LABELS: Record<ApplicationStatus, string> = {
  pending: "İnceleme bekliyor",
  reviewing: "İnceleniyor",
  approved: "Onaylandı",
  waitlisted: "Yedek liste",
  rejected: "Reddedildi",
  cancelled: "İptal edildi",
  checked_in: "Giriş yaptı",
};

export const PARTICIPANT_TYPES = ["student", "professional", "academic", "other"] as const;
export type ParticipantType = (typeof PARTICIPANT_TYPES)[number];

export const PARTICIPANT_LABELS: Record<ParticipantType, string> = {
  student: "Öğrenci",
  professional: "Profesyonel",
  academic: "Akademisyen",
  other: "Diğer",
};

export type EmailType =
  | "application_received"
  | "invitation"
  | "invitation_resend"
  | "waitlisted"
  | "rejected"
  | "cancelled";

export const EMAIL_TYPE_LABELS: Record<EmailType, string> = {
  application_received: "Başvuru alındı",
  invitation: "Davetiye",
  invitation_resend: "Davetiye (tekrar)",
  waitlisted: "Yedek liste",
  rejected: "Ret",
  cancelled: "İptal",
};

export type EmailStatus = "pending" | "sending" | "sent" | "failed" | "skipped";

export const EMAIL_STATUS_LABELS: Record<EmailStatus, string> = {
  pending: "Bekliyor",
  sending: "Gönderiliyor",
  sent: "Gönderildi",
  failed: "Başarısız",
  skipped: "Atlandı",
};

export type StaffRole = "admin" | "checkin";

export interface Application {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  participant_type: ParticipantType;
  institution: string | null;
  department: string | null;
  additional_answers: Record<string, string>;
  status: ApplicationStatus;
  kvkk_notice_version: string;
  kvkk_acknowledged_at: string;
  marketing_consent: boolean;
  marketing_consent_at: string | null;
  marketing_consent_version: string | null;
  admin_note: string | null;
  created_at: string;
  updated_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
}

export interface Invitation {
  id: string;
  application_id: string;
  issued_at: string;
  revoked_at: string | null;
  revoke_reason: string | null;
  checked_in_at: string | null;
  checked_in_by: string | null;
}

export interface EmailLog {
  id: string;
  application_id: string;
  invitation_id: string | null;
  email_type: EmailType;
  dedupe_key: string | null;
  status: EmailStatus;
  provider_message_id: string | null;
  attempt_count: number;
  last_error: string | null;
  created_at: string;
  updated_at: string;
  sent_at: string | null;
}

export interface EventSettings {
  event_name: string;
  starts_at: string | null;
  ends_at: string | null;
  date_confirmed: boolean;
  venue_name: string | null;
  venue_address: string | null;
  venue_map_url: string | null;
  transport_info: string | null;
  venue_confirmed: boolean;
  capacity: number;
  applications_open: boolean;
  kvkk_notice_version: string;
  marketing_consent_version: string;
  retention_days: number;
  updated_at: string;
}

export interface AdminStats {
  total: number;
  pending: number;
  reviewing: number;
  approved: number;
  waitlisted: number;
  rejected: number;
  cancelled: number;
  checked_in: number;
  capacity: number;
  failed_emails: number;
}

export type CheckInResult =
  | { result: "ok"; first_name: string; last_name: string; participant_type: ParticipantType; checked_in_at: string }
  | { result: "already"; first_name: string; last_name: string; checked_in_at: string }
  | { result: "revoked" }
  | { result: "not_approved" }
  | { result: "invalid" };
