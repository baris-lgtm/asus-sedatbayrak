/**
 * Supabase istemcileri için fetch:
 *  - Zaman aşımı: Supabase yanıt vermezse istek süresiz asılı kalmaz (etkinlik günü
 *    Wi-Fi/servis kesintisinde sayfa "Tekrar dene" gösterebilsin).
 *  - fresh=true: Next.js veri önbelleğini (Data Cache) KESİNLİKLE kullanma. Admin
 *    işlemleri ve e-posta içerikleri her zaman güncel veriyle çalışmalı.
 */
export function supabaseFetch({ timeoutMs = 10_000, fresh = true }: { timeoutMs?: number; fresh?: boolean } = {}): typeof fetch {
  return (input, init = {}) => {
    const timeout = AbortSignal.timeout(timeoutMs);
    const signal = init.signal ? AbortSignal.any([init.signal, timeout]) : timeout;
    return fetch(input, { ...init, signal, ...(fresh ? { cache: "no-store" as const } : {}) });
  };
}
