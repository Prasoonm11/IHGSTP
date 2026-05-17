'use client'

import MicrosoftEntraPreview from '@/components/microsoft-entra-preview'

export default function MicrosoftPreviewPage() {
  return (
    <main className="min-h-screen bg-[#080615] px-4 py-8 text-white">
      <MicrosoftEntraPreview showBackLink />
    </main>
  )
}
