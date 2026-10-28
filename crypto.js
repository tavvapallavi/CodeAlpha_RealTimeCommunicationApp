// End-to-end encryption helpers. The key lives only in the invite link's # part,
// which browsers never send to the server.

const enc = new TextEncoder();
const dec = new TextDecoder();

function toB64(bytes) {
  let s = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    s += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
  }
  return btoa(s);
}

function fromB64(b64) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

// A random 256-bit key as URL-safe text, used when a new meeting is created.
export function newKeyString() {
  const raw = crypto.getRandomValues(new Uint8Array(32));
  return toB64(raw).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export async function importKey(str) {
  const b64 = str.replace(/-/g, "+").replace(/_/g, "/");
  const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
  const raw = fromB64(padded);
  if (raw.length !== 32) throw new Error("Bad key");
  return crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt", "decrypt"]);
}

// Output layout: 12-byte random IV followed by the ciphertext.
export async function encryptBytes(key, bytes) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, bytes));
  const out = new Uint8Array(12 + ct.length);
  out.set(iv, 0);
  out.set(ct, 12);
  return out.buffer;
}

export async function decryptBytes(key, data) {
  const bytes = new Uint8Array(data);
  const iv = bytes.slice(0, 12);
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, bytes.slice(12));
  return new Uint8Array(pt);
}

export async function encryptJson(key, obj) {
  const buf = await encryptBytes(key, enc.encode(JSON.stringify(obj)));
  return toB64(new Uint8Array(buf));
}

export async function decryptJson(key, str) {
  const bytes = await decryptBytes(key, fromB64(str));
  return JSON.parse(dec.decode(bytes));
}
