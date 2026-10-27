import { Route, Routes } from 'react-router'
import { AppLayout } from '@/components/layout/AppLayout'
import { BookingPage } from '@/pages/BookingPage'
import { BookProvidersPage } from '@/pages/BookProvidersPage'
import { CartPage } from '@/pages/CartPage'
import { CheckoutPage } from '@/pages/CheckoutPage'
import { ExplorerPage } from '@/pages/ExplorerPage'
import { NotFoundPage } from '@/pages/NotFoundPage'

function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<ExplorerPage />} />
        <Route path="cart" element={<CartPage />} />
        <Route path="checkout" element={<CheckoutPage />} />
        <Route path="book" element={<BookProvidersPage />} />
        <Route path="book/:providerId" element={<BookingPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  )
}

export default App
