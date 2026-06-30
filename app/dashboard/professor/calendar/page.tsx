'use client'

import ExamCalendar from '@/components/shared/ExamCalendar'

export default function ProfessorCalendarPage() {
  return <ExamCalendar apiPath="/api/online_exams" role="professor" />
}
