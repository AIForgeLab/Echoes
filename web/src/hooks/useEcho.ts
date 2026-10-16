import { useCallback, useEffect, useState } from 'react'
import type { EchoDetail } from '../types'
import { data } from '../services/data'
import { verifyChain, type SealCheck } from '../lib/seal'

export function useEcho(id: string | undefined) {
  const [echo, setEcho] = useState<EchoDetail | null>(null)
  const [seal, setSeal] = useState<SealCheck[]>([])
  const [status, setStatus] = useState<'loading' | 'ready' | 'missing' | 'error'>('loading')
  const [error, setError] = useState('')

  const reload = useCallback(async () => {
    if (!id) return
    try {
      const e = await data.getEcho(id)
      if (!e) { setStatus('missing'); return }
      setEcho(e)
      setSeal(await verifyChain(e.tellings))
      setStatus('ready')
    } catch (err) {
      setError((err as Error).message)
      setStatus('error')
    }
  }, [id])

  useEffect(() => { setStatus('loading'); reload() }, [reload])
  return { echo, seal, status, error, reload }
}
