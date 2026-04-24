import type { Metadata } from 'next'
import { Instrument_Sans, Geist_Mono } from 'next/font/google'
import { Toaster } from '@/components/ui/sonner'
import './globals.css'

const instrumentSans = Instrument_Sans({
  variable: '--font-instrument-sans',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
})
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'WoodyKids Poster',
  description: 'Instagram feed planner voor WoodyKids',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="nl" className={`${instrumentSans.variable} ${geistMono.variable}`}>
      <body className="antialiased">
        {children}
        <Toaster position="bottom-center" />
      </body>
    </html>
  )
}
