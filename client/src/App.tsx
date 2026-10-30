import { Route, Routes } from 'react-router'
import { AppLayout } from '@/components/layout/AppLayout'
import { BookingConfirmationPage } from '@/pages/BookingConfirmationPage'
import { BookingPage } from '@/pages/BookingPage'
import { BookProvidersPage } from '@/pages/BookProvidersPage'
import { CartPage } from '@/pages/CartPage'
import { CheckoutPage } from '@/pages/CheckoutPage'
import { ExplorerPage } from '@/pages/ExplorerPage'
import { NotFoundPage } from '@/pages/NotFoundPage'
import { ReschedulePage } from '@/pages/ReschedulePage'

function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<ExplorerPage />} />
        <Route path="cart" element={<CartPage />} />
        <Route path="checkout" element={<CheckoutPage />} />
        <Route path="book" element={<BookProvidersPage />} />
        <Route path="book/:providerId" element={<BookingPage />} />
        <Route path="bookings/:bookingId" element={<BookingConfirmationPage />} />
        <Route path="bookings/:bookingId/reschedule" element={<ReschedulePage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  )
}

export default App
