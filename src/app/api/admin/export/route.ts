import { NextResponse, type NextRequest } from "next/server";
import { AuthorizationError, requireAdmin } from "@/lib/auth";
import { applicationsQuery, parseListParams, type ListedApplication } from "@/lib/admin/queries";
import { toCsv } from "@/lib/csv";
import { formatDateTime } from "@/lib/format";
import { PARTICIPANT_LABELS, STATUS_LABELS } from "@/lib/types";
import { createAdminClient } from "@/lib/supabase/admin";
import { eventContent } from "@/config/event";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Kişisel veri içeren CSV — yalnızca admin. RLS de ayrıca yalnızca admin okumasına izin verir. */
export async function GET(req: NextRequest) {
  let admin;
  try {
    admin = await requireAdmin();
  } catch (e) {
    const status = e instanceof AuthorizationError ? e.status : 500;
    return NextResponse.json({ error: status === 401 ? "Oturum açmalısın." : "Bu işlem için yetkin yok." }, { status });
  }

  const params = parseListParams(Object.fromEntries(req.nextUrl.searchParams));
  const { data, error } = await applicationsQuery(admin.supabase, params).range(0, 9999).returns<ListedApplication[]>();
  if (error) return NextResponse.json({ error: "Veriler okunamadı." }, { status: 500 });

  const q = eventContent.additionalQuestion;
  const csv = toCsv(data ?? [], [
    { header: "Ad", value: (r) => r.first_name },
    { header: "Soyad", value: (r) => r.last_name },
    { header: "E-posta", value: (r) => r.email },
    { header: "Telefon", value: (r) => r.phone },
    { header: "Katılımcı tipi", value: (r) => PARTICIPANT_LABELS[r.participant_type] },
    { header: "Kurum", value: (r) => r.institution },
    { header: "Bölüm", value: (r) => r.department },
    ...(q ? [{ header: "Ek soru yanıtı", value: (r: ListedApplication) => r.additional_answers?.[q.id] ?? "" }] : []),
    { header: "Durum", value: (r) => STATUS_LABELS[r.status] },
    { header: "Başvuru tarihi", value: (r) => formatDateTime(r.created_at) },
    { header: "İnceleme tarihi", value: (r) => formatDateTime(r.reviewed_at) },
    { header: "Pazarlama izni", value: (r) => (r.marketing_consent ? "Evet" : "Hayır") },
    { header: "KVKK metin sürümü", value: (r) => r.kvkk_notice_version },
  ]);

  await createAdminClient().from("admin_audit_logs").insert({
    admin_user_id: admin.userId,
    action: "export_csv",
    metadata: { rows: data?.length ?? 0, status: params.status, has_query: params.q !== "" },
  });

  const stamp = new Date().toISOString().slice(0, 10);
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="workshop-basvurular-${stamp}.csv"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
