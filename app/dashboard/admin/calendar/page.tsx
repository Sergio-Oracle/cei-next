'use client'

import ExamCalendar from '@/components/shared/ExamCalendar'

export default function AdminCalendarPage() {
  return <ExamCalendar apiPath="/api/online_exams" role="admin" />
}
