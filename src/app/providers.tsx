'use client'

import { ViewAsProvider } from '@/lib/view-as-context'
import { ToastProvider } from '@/components/Toast'

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <ViewAsProvider>{children}</ViewAsProvider>
    </ToastProvider>
  )
}
