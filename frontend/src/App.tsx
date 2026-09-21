import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './auth/AuthContext'
import { LocaleProvider } from './i18n/LocaleContext'
import { PublicLayout } from './layouts/PublicLayout'
import { StaffGuard, StaffLayout } from './layouts/StaffLayout'
import { BuyPlaceholderPage } from './pages/public/BuyPlaceholderPage'
import { FormPage } from './pages/public/FormPage'
import { HomePage } from './pages/public/HomePage'
import { TrackPage } from './pages/public/TrackPage'
import { AgendaPage } from './pages/staff/AgendaPage'
import { LoginPage } from './pages/staff/LoginPage'
import { NewSalePage } from './pages/staff/NewSalePage'
import { OrderDetailPage } from './pages/staff/OrderDetailPage'
import { PaintPage } from './pages/staff/PaintPage'

export default function App() {
  return (
    <LocaleProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route element={<PublicLayout />}>
              <Route path="/" element={<HomePage />} />
              <Route path="/buy" element={<BuyPlaceholderPage />} />
              <Route path="/track" element={<TrackPage />} />
              <Route path="/track/:code" element={<TrackPage />} />
              <Route path="/form/:token" element={<FormPage />} />
            </Route>
            <Route path="/staff/login" element={<LoginPage />} />
            <Route element={<StaffGuard />}>
              <Route element={<StaffLayout />}>
                <Route path="/staff/agenda" element={<AgendaPage />} />
                <Route path="/staff/sales/new" element={<NewSalePage />} />
                <Route path="/staff/orders/:id" element={<OrderDetailPage />} />
                <Route path="/staff/orders/:id/paint/:itemId" element={<PaintPage />} />
              </Route>
            </Route>
            <Route path="/staff" element={<Navigate to="/staff/agenda" replace />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </LocaleProvider>
  )
}
