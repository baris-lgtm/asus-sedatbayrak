import { requireStaffPage } from "@/lib/auth";
import { CheckInScanner } from "./scanner";

export default async function CheckInPage() {
  await requireStaffPage();
  return (
    <div className="mx-auto max-w-xl">
      <h1 className="display text-4xl">Check-in</h1>
      <p className="mt-2 text-sm text-graphite">
        Katılımcının QR kodunu okut. Kamera çalışmazsa davetiyedeki 10 karakterlik giriş kodunu elle gir.
      </p>
      <CheckInScanner />
    </div>
  );
}
