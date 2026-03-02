import "server-only";

import crypto from "crypto";

const ENCRYPTED_PREFIX = "enc:v1";

function getEncryptionKey(): Buffer {
  const secret = process.env.API_KEY_ENCRYPTION_SECRET?.trim();
  if (!secret) {
    throw new Error("Missing required environment variable: API_KEY_ENCRYPTION_SECRET");
  }

  return crypto.createHash("sha256").update(secret).digest();
}

export function encryptApiKey(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return [
    ENCRYPTED_PREFIX,
    iv.toString("base64"),
    authTag.toString("base64"),
    ciphertext.toString("base64"),
  ].join(":");
}

export function decryptApiKey(storedValue: string): string {
  const trimmed = storedValue.trim();

  if (!trimmed.startsWith(`${ENCRYPTED_PREFIX}:`)) {
    // Backward compatibility for older plaintext rows.
    return trimmed;
  }

  const parts = trimmed.split(":");
  if (parts.length !== 5) {
    throw new Error("Stored API key payload format is invalid.");
  }

  const [, version, ivB64, tagB64, cipherB64] = parts;
  if (version !== "v1") {
    throw new Error("Unsupported encrypted API key version.");
  }

  const key = getEncryptionKey();
  const iv = Buffer.from(ivB64, "base64");
  const authTag = Buffer.from(tagB64, "base64");
  const ciphertext = Buffer.from(cipherB64, "base64");

  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);
  const plaintext = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);

  return plaintext.toString("utf8");
}
