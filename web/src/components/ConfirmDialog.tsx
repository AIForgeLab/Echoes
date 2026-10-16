import { useEffect, useRef, useState, type ReactNode } from 'react'

interface Props {
  open: boolean
  title: string
  children: ReactNode
  confirmLabel: string
  danger?: boolean
  /** If set, the user must type this word to enable the confirm button. */
  typeToConfirm?: string
  onConfirm: () => Promise<void> | void
  onClose: () => void
}

export default function ConfirmDialog({ open, title, children, confirmLabel, danger, typeToConfirm, onConfirm, onClose }: Props) {
  const ref = useRef<HTMLDialogElement>(null)
  const [busy, setBusy] = useState(false)
  const [typed, setTyped] = useState('')

  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) { d.showModal(); setTyped('') }
    if (!open && d.open) d.close()
  }, [open])

  async function confirm() {
    setBusy(true)
    try { await onConfirm() } finally { setBusy(false) }
  }

  const blocked = !!typeToConfirm && typed.trim().toLowerCase() !== typeToConfirm.toLowerCase()

  return (
    <dialog ref={ref} onClose={onClose} onCancel={onClose} className="card m-auto w-[min(460px,calc(100vw-2rem))] p-0 text-ivory backdrop:bg-black/70">
      <div className="p-6 space-y-4">
        <h2 className="font-serif text-2xl">{title}</h2>
        <div className="text-sm text-muted space-y-2">{children}</div>
        {typeToConfirm && (
          <label className="block text-sm">Type <strong className="text-ivory">{typeToConfirm}</strong> to confirm
            <input className="input mt-1" value={typed} onChange={(e) => setTyped(e.target.value)} autoFocus />
          </label>
        )}
        <div className="flex justify-end gap-3 pt-2">
          <button className="btn-ghost" onClick={onClose} disabled={busy}>Cancel</button>
          <button className={danger ? 'btn-danger' : 'btn-primary'} onClick={confirm} disabled={busy || blocked}>{busy ? 'Working…' : confirmLabel}</button>
        </div>
      </div>
    </dialog>
  )
}
