// Glue WebAuthn côté navigateur — aucune dépendance externe (py_webauthn
// côté serveur produit/attend du base64url ; le navigateur travaille en
// ArrayBuffer, d'où ces conversions).

function base64urlToBuffer(b64url: string): ArrayBuffer {
  const b64 = b64url.replace(/-/g, '+').replace(/_/g, '/').padEnd(b64url.length + (4 - b64url.length % 4) % 4, '=')
  const raw = atob(b64)
  const buf = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) buf[i] = raw.charCodeAt(i)
  return buf.buffer
}

function bufferToBase64url(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf)
  let str = ''
  for (const b of bytes) str += String.fromCharCode(b)
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export async function isPlatformAuthenticatorAvailable(): Promise<boolean> {
  if (typeof window === 'undefined') return false
  const pkc = (window as any).PublicKeyCredential
  if (!pkc || !pkc.isUserVerifyingPlatformAuthenticatorAvailable) return false
  try { return await pkc.isUserVerifyingPlatformAuthenticatorAvailable() } catch { return false }
}

// options : réponse JSON de generate_registration_options (py_webauthn, format base64url)
export async function registerCredential(options: any): Promise<any> {
  const publicKey: CredentialCreationOptions['publicKey'] = {
    ...options,
    challenge: base64urlToBuffer(options.challenge),
    user: { ...options.user, id: base64urlToBuffer(options.user.id) },
    excludeCredentials: (options.excludeCredentials || []).map((c: any) => ({ ...c, id: base64urlToBuffer(c.id) })),
  }
  const cred = await navigator.credentials.create({ publicKey }) as PublicKeyCredential
  const response = cred.response as AuthenticatorAttestationResponse
  return {
    id: cred.id,
    rawId: bufferToBase64url(cred.rawId),
    type: cred.type,
    response: {
      clientDataJSON: bufferToBase64url(response.clientDataJSON),
      attestationObject: bufferToBase64url(response.attestationObject),
      transports: response.getTransports ? response.getTransports() : [],
    },
    clientExtensionResults: cred.getClientExtensionResults ? cred.getClientExtensionResults() : {},
  }
}

// options : réponse JSON de generate_authentication_options (py_webauthn)
export async function getAssertion(options: any): Promise<any> {
  const publicKey: CredentialRequestOptions['publicKey'] = {
    ...options,
    challenge: base64urlToBuffer(options.challenge),
    allowCredentials: (options.allowCredentials || []).map((c: any) => ({ ...c, id: base64urlToBuffer(c.id) })),
  }
  const cred = await navigator.credentials.get({ publicKey }) as PublicKeyCredential
  const response = cred.response as AuthenticatorAssertionResponse
  return {
    id: cred.id,
    rawId: bufferToBase64url(cred.rawId),
    type: cred.type,
    response: {
      clientDataJSON: bufferToBase64url(response.clientDataJSON),
      authenticatorData: bufferToBase64url(response.authenticatorData),
      signature: bufferToBase64url(response.signature),
      userHandle: response.userHandle ? bufferToBase64url(response.userHandle) : null,
    },
    clientExtensionResults: cred.getClientExtensionResults ? cred.getClientExtensionResults() : {},
  }
}
