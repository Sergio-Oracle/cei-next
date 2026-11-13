/** Message lisible d'une erreur attrapée (`catch (e: unknown)`), sans présumer de son type.
 *  Remplace `e.message` quand `e` était déclaré `any` : un `throw` d'autre chose qu'une Error ne casse plus l'affichage. */
export function errMsg(e: unknown, fallback = ''): string {
  if (e instanceof Error) return e.message || fallback
  if (typeof e === 'string') return e || fallback
  if (e && typeof e === 'object' && 'message' in e) {
    const m = (e as { message?: unknown }).message
    if (typeof m === 'string') return m || fallback
  }
  return fallback
}
