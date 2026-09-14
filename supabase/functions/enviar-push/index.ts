import { createClient } from "npm:@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ─── VAPID helpers (Web Crypto — sem dependências externas) ───────────────────

function base64urlToUint8Array(b64: string): Uint8Array {
  const pad = b64.length % 4 === 0 ? "" : "=".repeat(4 - (b64.length % 4));
  return Uint8Array.from(atob(b64.replace(/-/g, "+").replace(/_/g, "/") + pad), (c) => c.charCodeAt(0));
}

function uint8ArrayToBase64url(arr: Uint8Array): string {
  return btoa(String.fromCharCode(...arr)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

async function buildVapidJwt(audience: string, privateKeyB64: string): Promise<string> {
  const header = { typ: "JWT", alg: "ES256" };
  const now = Math.floor(Date.now() / 1000);
  const payload = { aud: audience, exp: now + 12 * 3600, sub: "mailto:grupoexcellencemga@gmail.com" };

  const enc = new TextEncoder();
  const headerB64 = uint8ArrayToBase64url(enc.encode(JSON.stringify(header)));
  const payloadB64 = uint8ArrayToBase64url(enc.encode(JSON.stringify(payload)));
  const toSign = `${headerB64}.${payloadB64}`;

  const pkcs8 = base64urlToUint8Array(privateKeyB64);
  const privateKey = await crypto.subtle.importKey(
    "pkcs8", pkcs8.buffer,
    { name: "ECDSA", namedCurve: "P-256" },
    false, ["sign"]
  );

  const signature = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    privateKey,
    enc.encode(toSign)
  );

  return `${toSign}.${uint8ArrayToBase64url(new Uint8Array(signature))}`;
}

async function sendPush(subscription: { endpoint: string; p256dh: string; auth: string }, payload: string, vapidPublic: string, vapidPrivate: string) {
  const url = new URL(subscription.endpoint);
  const audience = `${url.protocol}//${url.host}`;
  const jwt = await buildVapidJwt(audience, vapidPrivate);

  // Encripta o payload usando Web Push (ECDH + AES-GCM)
  const authSecret = base64urlToUint8Array(subscription.auth);
  const p256dh = base64urlToUint8Array(subscription.p256dh);

  // Gera par de chaves efêmeras
  const ephemeralKeyPair = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveKey", "deriveBits"]);
  const ephemeralPublicKeyRaw = new Uint8Array(await crypto.subtle.exportKey("raw", ephemeralKeyPair.publicKey));

  // Importa chave pública do subscriber
  const subscriberPublicKey = await crypto.subtle.importKey("raw", p256dh.buffer, { name: "ECDH", namedCurve: "P-256" }, false, []);

  // Deriva secret compartilhado
  const sharedSecret = new Uint8Array(await crypto.subtle.deriveBits({ name: "ECDH", public: subscriberPublicKey }, ephemeralKeyPair.privateKey, 256));

  // HKDF para derivar chave de criptografia e nonce
  const encoder = new TextEncoder();
  const prk = await crypto.subtle.importKey("raw", sharedSecret, { name: "HKDF" }, false, ["deriveKey", "deriveBits"]);

  const prkSalt = new Uint8Array(16);
  crypto.getRandomValues(prkSalt);

  const keyInfo = encoder.encode("Content-Encoding: aes128gcm\0");
  const contentKey = await crypto.subtle.deriveKey(
    { name: "HKDF", hash: "SHA-256", salt: prkSalt, info: keyInfo },
    prk, { name: "AES-GCM", length: 128 }, false, ["encrypt"]
  );

  const nonceInfo = encoder.encode("Content-Encoding: nonce\0");
  const nonceBits = await crypto.subtle.deriveBits(
    { name: "HKDF", hash: "SHA-256", salt: prkSalt, info: nonceInfo },
    prk, 96
  );
  const nonce = new Uint8Array(nonceBits);

  // Encripta
  const plaintext = encoder.encode(payload);
  const paddedPlaintext = new Uint8Array(plaintext.length + 2);
  paddedPlaintext.set(plaintext); // delimiter byte 0x02 at end
  paddedPlaintext[plaintext.length] = 0x02;

  const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, contentKey, paddedPlaintext));

  // Monta header de encriptação (RFC 8188)
  const recordSize = ciphertext.length + 16;
  const header = new Uint8Array(21 + ephemeralPublicKeyRaw.length);
  const view = new DataView(header.buffer);
  header.set(prkSalt, 0);
  view.setUint32(16, recordSize, false);
  header[20] = ephemeralPublicKeyRaw.length;
  header.set(ephemeralPublicKeyRaw, 21);

  const body = new Uint8Array(header.length + ciphertext.length);
  body.set(header);
  body.set(ciphertext, header.length);

  return fetch(subscription.endpoint, {
    method: "POST",
    headers: {
      Authorization: `vapid t=${jwt},k=${vapidPublic}`,
      "Content-Type": "application/octet-stream",
      "Content-Encoding": "aes128gcm",
      TTL: "86400",
    },
    body,
  });
}

// ─── Handler ──────────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { empresa_id, title, body, url, lead_id } = await req.json();
    if (!empresa_id || !title || !body) {
      return new Response(JSON.stringify({ error: "empresa_id, title e body são obrigatórios" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const vapidPublic = Deno.env.get("VAPID_PUBLIC_KEY")!;
    const vapidPrivate = Deno.env.get("VAPID_PRIVATE_KEY")!;

    const { data: subscriptions } = await supabase
      .from("push_subscriptions")
      .select("endpoint, p256dh, auth")
      .eq("empresa_id", empresa_id);

    if (!subscriptions?.length) {
      return new Response(JSON.stringify({ ok: true, sent: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const payload = JSON.stringify({ title, body, url: url ?? "/", leadId: lead_id ?? null });

    const results = await Promise.allSettled(
      subscriptions.map((sub) => sendPush(sub, payload, vapidPublic, vapidPrivate))
    );

    const sent = results.filter((r) => r.status === "fulfilled").length;
    console.log(`[enviar-push] ${sent}/${subscriptions.length} enviados`);

    return new Response(JSON.stringify({ ok: true, sent }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[enviar-push] erro:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
