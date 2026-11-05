import { lazy, Suspense } from 'react'
import { OrnamentLoader } from './components/public/OrnamentLoader'
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { AuthProvider } from './auth/AuthContext'
import { LocaleProvider } from './i18n/LocaleContext'
import { PublicLayout } from './layouts/PublicLayout'
import { StaffGuard, StaffLayout } from './layouts/StaffLayout'
const BuyPage = lazy(() => import('./pages/public/BuyPage').then(module => ({ default: module.BuyPage })))
const BuyThanksPage = lazy(() => import('./pages/public/BuyThanksPage').then(module => ({ default: module.BuyThanksPage })))
const FormPage = lazy(() => import('./pages/public/FormPage').then(module => ({ default: module.FormPage })))
import { HomePage } from './pages/public/HomePage'
const TrackPage = lazy(() => import('./pages/public/TrackPage').then(module => ({ default: module.TrackPage })))
const InventoryPage = lazy(() => import('./pages/staff/InventoryPage').then(module => ({ default: module.InventoryPage })))
const PaintingDaysPage = lazy(() => import('./pages/staff/PaintingDaysPage').then(module => ({ default: module.PaintingDaysPage })))
const AgendaPage = lazy(() => import('./pages/staff/AgendaPage').then(module => ({ default: module.AgendaPage })))
const DeliveriesPage = lazy(() => import('./pages/staff/DeliveriesPage').then(module => ({ default: module.DeliveriesPage })))
const LoginPage = lazy(() => import('./pages/staff/LoginPage').then(module => ({ default: module.LoginPage })))
const MarketEditorPage = lazy(() => import('./pages/staff/MarketEditorPage').then(module => ({ default: module.MarketEditorPage })))
const MarketsPage = lazy(() => import('./pages/staff/MarketsPage').then(module => ({ default: module.MarketsPage })))
const NewSalePage = lazy(() => import('./pages/staff/NewSalePage').then(module => ({ default: module.NewSalePage })))
const OrderDetailPage = lazy(() => import('./pages/staff/OrderDetailPage').then(module => ({ default: module.OrderDetailPage })))
const PaintPage = lazy(() => import('./pages/staff/PaintPage').then(module => ({ default: module.PaintPage })))

const ChangePasswordPage = lazy(() => import('./pages/staff/ChangePasswordPage').then(module => ({ default: module.ChangePasswordPage })))
const LegalPage = lazy(() => import('./pages/public/LegalPage').then(module => ({ default: module.LegalPage })))

function RouteFallback() {
  const { pathname } = useLocation()
  return pathname.startsWith('/staff') ? <p role="status" style={{ minHeight: '100vh', margin: 0, padding: 24, background: 'var(--staff-bg)', color: 'var(--staff-ink)' }}>Loading…</p> : <OrnamentLoader />
}

export default function App() {
  return (
    <LocaleProvider>
      <AuthProvider>
        <BrowserRouter>
          <Suspense fallback={<RouteFallback />}>
          <Routes>
            <Route element={<PublicLayout />}>
              <Route path="/" element={<HomePage />} />
              <Route path="/impressum" element={<LegalPage title="impressum" />} />
              <Route path="/agb" element={<LegalPage title="terms" />} />
              <Route path="/datenschutz" element={<LegalPage title="privacy" />} />
              <Route path="/buy" element={<BuyPage />} />
              <Route path="/buy/thanks" element={<BuyThanksPage />} />
              <Route path="/track" element={<TrackPage />} />
              <Route path="/track/:code" element={<TrackPage />} />
              <Route path="/form/:token" element={<FormPage />} />
            </Route>
            <Route path="/staff/login" element={<LoginPage />} />
            <Route element={<StaffGuard />}>
              <Route element={<StaffLayout />}>
                <Route path="/staff/password" element={<ChangePasswordPage />} />
                <Route path="/staff/inventory" element={<InventoryPage />} />
                <Route path="/staff/painting-days" element={<PaintingDaysPage />} />
                <Route path="/staff/agenda" element={<AgendaPage />} />
                <Route path="/staff/deliveries" element={<DeliveriesPage />} />
                <Route path="/staff/markets" element={<MarketsPage />} />
                <Route path="/staff/markets/new" element={<MarketEditorPage />} />
                <Route path="/staff/markets/:id" element={<MarketEditorPage />} />
                <Route path="/staff/sales/new" element={<NewSalePage />} />
                <Route path="/staff/orders/:id" element={<OrderDetailPage />} />
                <Route path="/staff/orders/:id/paint/:itemId" element={<PaintPage />} />
              </Route>
            </Route>
            <Route path="/staff" element={<Navigate to="/staff/agenda" replace />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          </Suspense>
        </BrowserRouter>
      </AuthProvider>
    </LocaleProvider>
  )
}
