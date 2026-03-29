/**
 * browserCrypto.js
 * Client-side cryptographic utilities for the SecureExam system.
 * Uses the Web Crypto API for ECDH key exchange (share transfer).
 */

// ─── Read binary file as Uint8Array ──────────────────────────────────────────

export function readFileAsBytes(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(new Uint8Array(e.target.result));
        reader.onerror = reject;
        reader.readAsArrayBuffer(file);
    });
}

// ─── Read text file ──────────────────────────────────────────────────────────

export function readFileAsText(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.onerror = reject;
        reader.readAsText(file);
    });
}

// ─── Hex Encoding Helpers ────────────────────────────────────────────────────

function buf2hex(buffer) {
    return Array.from(new Uint8Array(buffer))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
}

function hex2buf(hex) {
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < hex.length; i += 2) {
        bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
    }
    return bytes.buffer;
}

// ─── ECDH Key Exchange (Web Crypto API) ──────────────────────────────────────
//
//   The server uses Node's crypto.createECDH('prime256v1') which produces raw
//   uncompressed public keys (04 || x || y, 65 bytes = 130 hex chars).
//   We need to import/export in the same raw format for compatibility.
//

/**
 * Generate an ECDH key pair using Web Crypto API (P-256 / prime256v1).
 * Returns { publicKeyHex: string, privateKey: CryptoKey }
 *   - publicKeyHex is the raw uncompressed public key as hex (to send to server)
 *   - privateKey is a CryptoKey object (stays in browser, never leaves)
 */
export async function generateECDHKeyPair() {
    const keyPair = await crypto.subtle.generateKey(
        { name: 'ECDH', namedCurve: 'P-256' },
        true,
        ['deriveBits']
    );

    // Export public key as raw bytes → hex (matches Node's ECDH format)
    const pubRaw = await crypto.subtle.exportKey('raw', keyPair.publicKey);
    const publicKeyHex = buf2hex(pubRaw);

    // Export private key as PKCS8 for storage in memory
    const privPkcs8 = await crypto.subtle.exportKey('pkcs8', keyPair.privateKey);

    return {
        publicKeyHex,
        privateKey: keyPair.privateKey,           // CryptoKey (for deriveBits)
        privateKeyPkcs8: privPkcs8               // ArrayBuffer (for re-import if needed)
    };
}

/**
 * Derive a shared secret from our ECDH private key and their public key hex.
 * Returns an AES-GCM CryptoKey derived from SHA-256(raw_shared_secret).
 */
export async function deriveSharedSecret(myPrivateKey, theirPublicKeyHex) {
    // Import their raw public key
    const theirPubRaw = hex2buf(theirPublicKeyHex);
    const theirPubKey = await crypto.subtle.importKey(
        'raw', theirPubRaw,
        { name: 'ECDH', namedCurve: 'P-256' },
        false, []
    );

    // Derive raw shared secret bits (256 bits for P-256)
    const rawSecret = await crypto.subtle.deriveBits(
        { name: 'ECDH', public: theirPubKey },
        myPrivateKey,
        256
    );

    // Hash with SHA-256 to get a proper 256-bit AES key (matches server's approach)
    const hashBuffer = await crypto.subtle.digest('SHA-256', rawSecret);

    // Import as AES-GCM key
    return await crypto.subtle.importKey(
        'raw', hashBuffer,
        { name: 'AES-GCM', length: 256 },
        false,
        ['decrypt']
    );
}

/**
 * Decrypt data encrypted by the server's encryptWithSharedSecret function.
 * Input: hex string formatted as: iv(24 hex) + authTag(32 hex) + ciphertext(hex)
 * Returns: plaintext string (the Shamir share)
 */
export async function decryptWithSharedSecret(hexPayload, aesKey) {
    // Parse the hex payload: 24 hex = 12 byte IV, 32 hex = 16 byte auth tag, rest = ciphertext
    const ivHex = hexPayload.slice(0, 24);
    const authTagHex = hexPayload.slice(24, 56);
    const ciphertextHex = hexPayload.slice(56);

    const iv = hex2buf(ivHex);
    const authTag = new Uint8Array(hex2buf(authTagHex));
    const ciphertext = new Uint8Array(hex2buf(ciphertextHex));

    // AES-GCM expects ciphertext + authTag concatenated
    const combined = new Uint8Array(ciphertext.length + authTag.length);
    combined.set(ciphertext, 0);
    combined.set(authTag, ciphertext.length);

    const decrypted = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: new Uint8Array(iv) },
        aesKey,
        combined.buffer
    );

    return new TextDecoder().decode(decrypted);
}

// ─── Session Storage for DH Keys ─────────────────────────────────────────────
//   Store the private key in sessionStorage so it survives page navigation
//   but not browser close. Key is stored as base64-encoded PKCS8.

const DH_KEY_PREFIX = 'dh_key_';

export function storeDHPrivateKey(fileId, pkcs8ArrayBuffer) {
    const base64 = btoa(String.fromCharCode(...new Uint8Array(pkcs8ArrayBuffer)));
    sessionStorage.setItem(DH_KEY_PREFIX + fileId, base64);
}

export async function loadDHPrivateKey(fileId) {
    const base64 = sessionStorage.getItem(DH_KEY_PREFIX + fileId);
    if (!base64) return null;
    const binaryStr = atob(base64);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);
    return await crypto.subtle.importKey(
        'pkcs8', bytes.buffer,
        { name: 'ECDH', namedCurve: 'P-256' },
        false,
        ['deriveBits']
    );
}

export function clearDHPrivateKey(fileId) {
    sessionStorage.removeItem(DH_KEY_PREFIX + fileId);
}
