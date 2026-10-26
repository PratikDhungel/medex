import { Route, Routes } from 'react-router'
import { AppLayout } from '@/components/layout/AppLayout'
import { CartPage } from '@/pages/CartPage'
import { ExplorerPage } from '@/pages/ExplorerPage'
import { NotFoundPage } from '@/pages/NotFoundPage'

function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<ExplorerPage />} />
        <Route path="cart" element={<CartPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  )
}

export default App
