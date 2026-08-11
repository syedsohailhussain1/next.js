import type { ReactNode } from 'react'

export default function NamedOnlyLayout({
  left,
  right,
}: {
  left: ReactNode
  right: ReactNode
}) {
  return (
    <main>
      {left}
      {right}
    </main>
  )
}
