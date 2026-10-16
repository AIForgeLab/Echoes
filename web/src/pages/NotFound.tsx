import { Link } from 'react-router-dom'
import { Compass } from 'lucide-react'

export default function NotFound() {
  return (
    <div className="starfield min-h-screen grid place-items-center px-4">
      <div className="card max-w-md w-full p-10 text-center space-y-4">
        <Compass size={36} className="mx-auto text-gold" />
        <p className="font-serif text-6xl">404</p>
        <h1 className="font-serif text-2xl">This echo has no source</h1>
        <p className="text-muted">The page you followed doesn't exist, or it was moved.</p>
        <div className="flex justify-center gap-3"><Link to="/dashboard" className="btn-primary">Go to dashboard</Link><Link to="/" className="btn-ghost">Home</Link></div>
      </div>
    </div>
  )
}
