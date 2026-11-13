import api from '@/lib/api'
import { errMsg } from '@/lib/errors'

export interface GradeCheckSummary {
  copies: number; checked: number; changed: number; lower: number; higher: number; unchanged: number
  skipped_empty: number; skipped_manual: number; skipped_edited: number; skipped_unverifiable: number
  avg_before: number | null; avg_after: number | null; perfect_before: number; perfect_after: number
  backup: string | null
}

interface Notify { success: (m: string) => void; error: (m: string) => void }

/** Vérifie les notes d'un examen (rien n'est écrit), montre ce qui changerait, puis recalcule si l'utilisateur confirme.
 *  À faire une fois la correction terminée, avant de publier les résultats. Renvoie true si les notes sont à jour. */
export async function recomputeGrades(examId: number | string, notify: Notify): Promise<boolean> {
  try {
    const sim = await api.post<{ summary: GradeCheckSummary; published: boolean }>(`/api/online_exams/${examId}/recompute_grades`, { apply: false })
    const s = sim.summary
    if (s.changed === 0) {
      notify.success(`Vérification terminée : les ${s.checked} notes contrôlées correspondent au calcul actuel`)
      return true
    }
    const lignes = [
      `${s.changed} note(s) ne correspondent pas au calcul actuel : ${s.lower} à la baisse, ${s.higher} à la hausse.`,
      s.avg_before != null && s.avg_after != null ? `Moyenne : ${s.avg_before} → ${s.avg_after} sur 20.` : '',
      s.perfect_before !== s.perfect_after ? `Notes de 20/20 : ${s.perfect_before} → ${s.perfect_after}.` : '',
      'Les notes saisies à la main et les copies vides ne sont pas touchées ; les anciennes valeurs sont sauvegardées.',
      sim.published ? '\nATTENTION : les résultats sont déjà publiés, les étudiants ont vu leur note actuelle.' : '',
      '\nRecalculer maintenant ?',
    ].filter(Boolean).join('\n')
    if (!confirm(lignes)) return false
    if (sim.published && !confirm('Les étudiants ont déjà vu leurs notes. Confirmer la modification de ces notes publiées ?')) return false
    const res = await api.post<{ summary: GradeCheckSummary }>(`/api/online_exams/${examId}/recompute_grades`, { apply: true, confirm_published: !!sim.published })
    notify.success(`${res.summary.changed} note(s) recalculée(s)`)
    return true
  } catch (e: unknown) {
    notify.error(errMsg(e) || 'Vérification des notes impossible')
    return false
  }
}

/** Publie les résultats ; si le serveur constate des notes à recalculer, propose de les recalculer puis republie. */
export async function publishWithGradeCheck(examId: number | string, notify: Notify): Promise<boolean | null> {
  try {
    const res = await api.put<{ results_published: boolean }>(`/api/online_exams/${examId}/publish-results`, { published: true })
    return res.results_published
  } catch (e: any) {
    if (e?.data?.needs_recompute) {
      if (await recomputeGrades(examId, notify)) {
        const res = await api.put<{ results_published: boolean }>(`/api/online_exams/${examId}/publish-results`, { published: true })
        return res.results_published
      }
      return null
    }
    throw e
  }
}
