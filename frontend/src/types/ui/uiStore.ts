import type { Sheet } from './sheet'
import type { Timer, WorkTimer } from './timer'

export interface UIStore {
  sheets: Sheet[]
  toastMsg: string
  timer: Timer | null
  work: WorkTimer | null

  openSheet(render: (close: () => void) => React.ReactNode, options?: { kind?: 'sheet' | 'center'; locked?: boolean }): { id: string; close: () => void; lock: (v: boolean) => void }
  closeSheet(id: string): void
  closeAll(): void
  toast(msg: string): void
  startRest(sec: number): void
  addRest(sec: number): void
  stopRest(): void
  startWork(sec: number, label: string, onDone: (elapsed: number) => void): void
  finishWorkEarly(): void
  stopWork(): void
}