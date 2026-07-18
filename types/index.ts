// ── Utilisateurs ─────────────────────────────────────────────────────────────
export type UserRole = 'admin' | 'professor' | 'student' | 'surveillant'

export interface User {
  id: number
  email: string
  full_name: string
  role: UserRole
  niveau?: string
  niveau_name?: string
  formation_id?: number
  formation_name?: string
  formation_code?: string
  pole_code?: string
  pole_name?: string
  is_active: boolean
  has_email?: boolean
  created_at: string
  last_login?: string
}

// ── Hiérarchie pédagogique ───────────────────────────────────────────────────
export interface Formation {
  id: number
  code: string
  name: string
  level: string
  department?: string
  is_active: boolean
  created_at: string
}

export interface Semester {
  id: number
  formation_id: number
  number: number
  name: string
  total_credits: number
  is_active: boolean
}

export interface UE {
  id: number
  semester_id: number
  code: string
  name: string
  credits: number
  is_active: boolean
}

export interface EC {
  id: number
  ue_id: number
  code: string
  name: string
  coefficient: number
  cm?: number
  td?: number
  tp?: number
  tpe?: number
  is_active: boolean
  assigned_professor?: string
}

// ── Sujets et copies ──────────────────────────────────────────────────────────
export interface Subject {
  id: number
  title: string
  content?: string
  rubric?: string
  filename?: string
  ec_id?: number
  ec_code?: string
  ec_name?: string
  creator_id: number
  creator_name?: string
  is_active: boolean
  created_at: string | null
  papers_count?: number
  exam_count?: number
}

export interface StudentPaper {
  id: number
  subject_id: number
  subject_title?: string
  student_id: number
  student_name?: string
  student_email?: string
  content?: string
  grade?: string
  score?: number | null
  filename?: string
  corrected_by_id?: number
  corrected_at?: string
  reclamation_window_end?: string
  has_reclamation?: boolean
  reclamation_status?: string
  created_at: string
}

// ── Examens en ligne ──────────────────────────────────────────────────────────
export type ExamStatus = 'draft' | 'scheduled' | 'active' | 'closed'
export type AttemptStatus = 'in_progress' | 'submitted' | 'banned' | 'auto_submitted'

export interface OnlineExam {
  id: number
  subject_id?: number
  subject_title?: string
  title: string
  instructions?: string
  duration_minutes: number
  start_time: string
  end_time: string
  max_tab_switches?: number
  enable_copy_paste?: boolean
  enable_right_click?: boolean
  randomize_questions?: boolean
  max_no_face_count?: number
  ban_on_devtools?: boolean
  auto_correct?: boolean
  results_published?: boolean
  proctoring_enabled?: boolean
  camera_required?: boolean
  status: ExamStatus
  creator_name?: string
  created_by_id: number
  created_at: string
  attempts_count?: number
  enrolled_count?: number
  my_student_count?: number
  formation_id?: number
  formation_name?: string
  my_attempt?: {
    id: number
    status: string
    score: number | null
    feedback?: string | null
    corrected_at?: string | null
    submitted_at?: string | null
  } | null
}

export interface ExamAttempt {
  id: number
  exam_id: number
  exam_title?: string
  student_id: number
  student_name?: string
  student_email?: string
  status: AttemptStatus
  started_at: string
  submitted_at?: string
  tab_switches?: number
  warnings_count?: number
  no_face_count?: number
  risk_score?: number
  answers?: Record<string, string>
  score?: number | null
  feedback?: string
  corrected_at?: string
  corrected_by_id?: number
  extra_minutes?: number
  answers_count?: number
  total_questions?: number
  imported_grade?: boolean
}

// ── Réclamations ──────────────────────────────────────────────────────────────
export type ReclamationStatus = 'pending' | 'in_review' | 'resolved' | 'rejected' | 'ai_processed' | 'proposal_pending'

export interface Reclamation {
  id: number
  paper_id?: number
  attempt_id?: number
  type?: string
  student_id: number
  student_name?: string
  subject_title?: string
  exam_title?: string
  attempt_score?: number
  attempt_feedback?: string
  reason: string
  status: ReclamationStatus
  response?: string
  ia_decision?: string
  ia_proposed_status?: string
  ia_proposed_score?: number
  ia_proposed_grade?: string
  ia_proposed_reason?: string
  ia_processed_at?: string
  responded_by_id?: number
  responder_name?: string
  created_at: string
  updated_at?: string
}

// ── Transcripts ───────────────────────────────────────────────────────────────
export interface GradeTranscript {
  id: number
  student_id: number
  student_name?: string
  semester_id: number
  semester_name?: string
  total_credits: number
  obtained_credits?: number
  gpa?: number
  ue_details?: any[]
  generated_at: string
  generated_by_id?: number
  is_published: boolean
}

// ── Banque de questions ───────────────────────────────────────────────────────
export type QuestionType = 'open' | 'qcm' | 'vf'
export type BloomLevel = 'connaissance' | 'compréhension' | 'application' | 'analyse' | 'synthèse' | 'évaluation'

export interface QuestionBank {
  id: number
  title: string
  content: string
  rubric?: string
  question_type: QuestionType
  bloom_level?: BloomLevel
  ec_id?: number
  ec_name?: string
  created_by_id: number
  created_at: string
}

// ── Stats / Dashboard ──────────────────────────────────────────────────────────
export interface AdminStats {
  total_users: number
  total_students: number
  total_professors: number
  total_surveillants: number
  total_subjects: number
  total_papers: number
  pending_reclamations: number
  total_corrected_papers: number
  total_exams?: number
  active_exams?: number
  total_formations?: number
}

export interface ExamStats {
  total_attempts: number
  submitted: number
  in_progress: number
  average_score?: number
  pass_rate?: number
  min_score?: number
  max_score?: number
  score_distribution?: Record<string, number>
}

// ── API responses ─────────────────────────────────────────────────────────────
export interface ApiError {
  error: string
  message?: string
}

export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  per_page: number
}
