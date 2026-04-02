'use client'

import { ViewAsProvider } from '@/lib/view-as-context'

export default function Providers({ children }: { children: React.ReactNode }) {
  return <ViewAsProvider>{children}</ViewAsProvider>
}
