'use client'

import { useState } from 'react'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Calendar } from '@/components/ui/calendar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

type Props = {
  open: boolean
  onClose: () => void
  onConfirm: (isoDateTime: string) => void
  current?: string | null
}

export function ScheduleSheet({ open, onClose, onConfirm, current }: Props) {
  const [date, setDate] = useState<Date | undefined>(
    current ? new Date(current) : undefined,
  )
  const [time, setTime] = useState(
    current
      ? new Date(current).toTimeString().slice(0, 5)
      : '10:00',
  )

  function handleConfirm() {
    if (!date) return
    const [hours, minutes] = time.split(':').map(Number)
    const dt = new Date(date)
    dt.setHours(hours, minutes, 0, 0)
    onConfirm(dt.toISOString())
    onClose()
  }

  return (
    <Sheet open={open} onOpenChange={v => { if (!v) onClose() }}>
      <SheetContent side="bottom" className="rounded-t-2xl pb-8">
        <SheetHeader className="mb-4">
          <SheetTitle className="text-sm text-left">Wanneer publiceren?</SheetTitle>
        </SheetHeader>
        <div className="space-y-4">
          <Calendar
            mode="single"
            selected={date}
            onSelect={setDate}
            disabled={{ before: new Date() }}
            className="mx-auto"
          />
          <div className="space-y-1 px-1">
            <Label htmlFor="time" className="text-xs">Tijdstip</Label>
            <Input
              id="time"
              type="time"
              value={time}
              onChange={e => setTime(e.target.value)}
              className="border-orange-200 focus-visible:ring-orange-300"
            />
          </div>
          <Button
            onClick={handleConfirm}
            disabled={!date}
            className="w-full bg-orange-500 hover:bg-orange-600 text-white"
          >
            Inplannen →
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
