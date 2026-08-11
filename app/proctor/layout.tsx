import '../globals.css'
import SupervisorCallListener from '@/components/proctor/SupervisorCallListener'

export default function ProctorLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SupervisorCallListener />
      {children}
    </>
  )
}
