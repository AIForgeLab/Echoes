import { lazy, Suspense } from 'react'
import { Route, Routes } from 'react-router-dom'
import AppLayout from './components/AppLayout'
import ProtectedRoute from './components/ProtectedRoute'
import Landing from './pages/Landing'
import { Login, Signup, ForgotPassword, ResetPassword } from './pages/Auth'
import Dashboard from './pages/Dashboard'
import MyEchoes from './pages/MyEchoes'
import NotFound from './pages/NotFound'

// Heavier pages load on demand
const CreateEcho = lazy(() => import('./pages/CreateEcho'))
const EchoDetails = lazy(() => import('./pages/EchoDetails'))
const EchoRoom = lazy(() => import('./pages/EchoRoom'))
const MemoryMap = lazy(() => import('./pages/MemoryMap'))
const Insights = lazy(() => import('./pages/Insights'))
const Settings = lazy(() => import('./pages/Settings'))

const Loading = () => <p className="text-muted p-6">Loading…</p>

export default function App() {
  return (
    <Suspense fallback={<Loading />}>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/echoes" element={<MyEchoes />} />
          <Route path="/echoes/new" element={<CreateEcho />} />
          <Route path="/echoes/:id" element={<EchoDetails />} />
          <Route path="/echoes/:id/chat" element={<EchoRoom />} />
          <Route path="/memory-map" element={<MemoryMap />} />
          <Route path="/insights" element={<Insights />} />
          <Route path="/settings" element={<Settings />} />
        </Route>
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  )
}
