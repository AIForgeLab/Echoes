import { useState } from 'react'
import type { Echo } from '../types'
import { data } from '../services/data'
import { useApp } from '../state/AppState'
import { useToast } from '../components/Toast'
import ConfirmDialog from '../components/ConfirmDialog'

/** Pin/unpin and Forget, shared by every list of echoes. Render `dialog` once in the page. */
export function useEchoActions(after?: () => void) {
  const { refreshEchoes } = useApp()
  const toast = useToast()
  const [target, setTarget] = useState<Echo | null>(null)

  async function toggleFavourite(e: Echo) {
    try {
      await data.updateMeta(e.id, { favourite: !e.favourite })
      await refreshEchoes()
    } catch (err) {
      toast('error', `Couldn't update “${e.title}”: ${(err as Error).message}`)
    }
  }

  const dialog = (
    <ConfirmDialog open={!!target} title={`Forget “${target?.title ?? ''}”?`} confirmLabel="Forget forever" danger onClose={() => setTarget(null)}
      onConfirm={async () => {
        if (!target) return
        try {
          await data.forget(target.id)
          toast('success', 'Forgotten. Its key was destroyed, so the stored text can no longer be read.')
          setTarget(null)
          await refreshEchoes()
          after?.()
        } catch (err) {
          toast('error', `Forgetting failed, nothing was changed: ${(err as Error).message}`)
        }
      }}>
      <p>Echoes will delete every summary, tag and claim made from this memory, then destroy its encryption key. The encrypted text that remains can never be read again, and a tombstone records that something was here.</p>
      <p>Limits: {data.mode === 'demo' ? 'in demo mode this happens in your browser storage.' : 'database backups made before today may still hold the encrypted text, but without the key it is unreadable. Text you sent to the AI service may be kept by that provider under its own retention policy.'}</p>
    </ConfirmDialog>
  )

  return { toggleFavourite, forget: (e: Echo) => setTarget(e), dialog }
}
