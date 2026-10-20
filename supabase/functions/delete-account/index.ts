// Supprime le compte de la personne connectée (sa progression est supprimée en cascade).
// Appelée depuis la page « Réviser » avec supabase.functions.invoke("delete-account").
import { createClient } from "jsr:@supabase/supabase-js@2";

const ALLOWED = ["https://coqcivique.com", "https://www.coqcivique.com", "https://jombebrat.github.io", "http://localhost:8000"];

function cors(req: Request) {
  const origin = req.headers.get("Origin") ?? "";
  return {
    "Access-Control-Allow-Origin": ALLOWED.includes(origin) ? origin : ALLOWED[0],
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

function json(req: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors(req), "Content-Type": "application/json" } });
}

// Clé secrète : nouvelle clé « default » si disponible, sinon l'ancienne clé service_role.
function secretKey(): string {
  try {
    const keys = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") ?? "{}");
    if (keys && keys["default"]) return keys["default"];
  } catch (_) { /* ancienne configuration */ }
  return Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(req) });
  if (req.method !== "POST") return json(req, { error: "method_not_allowed" }, 405);

  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token) return json(req, { error: "not_signed_in" }, 401);

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, secretKey(), { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data?.user) return json(req, { error: "not_signed_in" }, 401);

  const { error: delError } = await admin.auth.admin.deleteUser(data.user.id);
  if (delError) return json(req, { error: "delete_failed" }, 500);

  return json(req, { ok: true });
});
