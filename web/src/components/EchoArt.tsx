import { useState } from 'react'
import type { Echo } from '../types'
import { portraitUri } from '../lib/portrait'
import { cx } from '../lib/format'

/** The memory's artwork: its own image if it has one, otherwise its seal portrait. */
export default function EchoArt({ echo, className, alt }: { echo: Pick<Echo, 'cover' | 'hash' | 'style' | 'title' | 'forgottenAt'>; className?: string; alt?: string }) {
  const [broken, setBroken] = useState(false)
  const src = !echo.forgottenAt && echo.cover && !broken ? echo.cover : portraitUri(echo.forgottenAt ? null : echo.hash, echo.style)
  return (
    <img src={src} alt={alt ?? (echo.forgottenAt ? 'Forgotten memory' : `Artwork for ${echo.title}`)} loading="lazy" onError={() => setBroken(true)}
      className={cx('object-cover bg-surface-2', className)} />
  )
}
