import { RouterProvider } from 'react-router-dom';
import { router } from './routes';
import { AppProvider } from './context/AppContext';
import { Toaster } from './components/ui/sonner';

export default function App() {
  return (
    <AppProvider>
      {/* This manages the flow between Login and the Manual ID Entry screen */}
      <RouterProvider router={router} />
      <Toaster />
    </AppProvider>
  );
}