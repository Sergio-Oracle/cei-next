import api from '@/lib/api'

/* Tous les utilisateurs d'un rôle, toutes pages confondues.
   /api/admin/users est paginé (50 par défaut, 200 au plus, tri A-Z, tous
   rôles mêlés) : l'appeler sans paramètres ne renvoie que les 50 premiers
   comptes de l'alphabet. Les pages qui ont besoin de TOUS les professeurs,
   surveillants ou superviseurs (Affectations EC, Groupes Surveillants)
   filtrent donc par rôle côté serveur et parcourent toutes les pages. */
export async function fetchUsersByRole(role: 'professor' | 'surveillant' | 'superviseur' | 'admin'): Promise<any[]> {
  const all: any[] = []
  for (let page = 1; page <= 100; page++) {
    const res = await api.get<any>(`/api/admin/users?role=${role}&limit=200&page=${page}`)
    const users: any[] = Array.isArray(res) ? res : res.users ?? []
    all.push(...users)
    if (Array.isArray(res) || page >= (res.total_pages ?? 1) || users.length === 0) break
  }
  return all
}
