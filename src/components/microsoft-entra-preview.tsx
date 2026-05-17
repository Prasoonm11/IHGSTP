'use client'

import Image from 'next/image'
import Link from 'next/link'

const prerequisites = [
  'Tenant ID',
  'Client ID',
  'Application (or Enterprise App) Object ID',
  'Group Object IDs',
  'Attribute mapping for manager and department fields',
]

export default function MicrosoftEntraPreview({ showBackLink = false }: { showBackLink?: boolean }) {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 lg:px-8">
      <div className="grid min-h-[calc(100vh-4rem)] grid-cols-1 gap-8 lg:grid-cols-2 lg:items-start">
        <section className="space-y-6 lg:pr-4">
          <div className="space-y-4">
            <h1 className="text-4xl font-bold text-white sm:text-5xl">Microsoft id integration</h1>
            <p className="max-w-2xl text-base leading-7 text-violet-300/75">
              Setup of Azure using Supabase. When the required tenant, app, and group IDs are present, Microsoft
              Entra can send users through the callback below and complete SSO, hierarchy sync, and role mapping.
            </p>
            <a
              href="https://zzqijesitvnpfqowssiw.supabase.co/auth/v1/callback"
              className="inline-flex break-all rounded-2xl border border-sky-400/30 bg-sky-500/10 px-4 py-3 text-sm font-semibold text-sky-100 transition-colors hover:bg-sky-500/15"
            >
              https://zzqijesitvnpfqowssiw.supabase.co/auth/v1/callback
            </a>
          </div>

          <div className="rounded-2xl border border-white/10 bg-[#0d1a36] p-6">
            <h2 className="text-lg font-semibold text-white">What still needs to be connected</h2>
            <div className="mt-4 space-y-3">
              {prerequisites.map(item => (
                <div key={item} className="flex items-center justify-between rounded-xl border border-white/5 bg-[#081225] px-4 py-3">
                  <span className="text-sm text-slate-300">{item}</span>
                  <span className="text-xs font-medium text-sky-300">Required</span>
                </div>
              ))}
            </div>
          </div>

          {showBackLink ? (
            <Link
              href="/auth"
              className="inline-flex rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-white/10"
            >
              Back to login
            </Link>
          ) : null}
        </section>

        <section className="space-y-4 lg:pl-4">
          <div className="overflow-hidden rounded-3xl border border-white/10 bg-black/30 p-4">
            <Image
              src="/Azure.png"
              alt="Microsoft Azure"
              width={1200}
              height={900}
              className="h-[520px] w-full rounded-2xl object-contain"
              priority
            />
          </div>

          <div className="rounded-2xl border border-white/10 bg-[#0d1a36] p-6">
            <h2 className="text-lg font-semibold text-white">Setup of Azure using Supabase</h2>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              Once the IDs are configured, Supabase should redirect Microsoft sign-ins to the callback above so the
              app can finish the exchange and load the user profile.
            </p>
          </div>
        </section>
      </div>
    </div>
  )
}
