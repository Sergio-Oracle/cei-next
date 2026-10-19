import api from '@/lib/api'

/** Active un examen ; si le sujet n'est pas lisible par les étudiants (aucune question reconnue,
 *  QCM sans propositions…), le serveur refuse (409) et on demande une confirmation explicite. */
export async function activateExam(id: number | string) {
  try {
    return await api.post(`/api/online_exams/${id}/activate`, {})
  } catch (e: any) {
    if (e?.status === 409 && e?.data?.needs_confirmation) {
      const lines = (e.data.subject_check?.issues ?? []).map((i: any) => `• ${i.message}`).join('\n')
      if (!confirm(`⚠ Les étudiants risquent de ne pas voir correctement les questions :\n\n${lines}\n\nActiver quand même ?`)) {
        throw Object.assign(new Error('Activation annulée : corrigez d’abord le sujet.'), { cancelled: true })
      }
      return await api.post(`/api/online_exams/${id}/activate`, { force: true })
    }
    throw e
  }
}
