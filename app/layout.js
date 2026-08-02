import './globals.css';
import Providers from '@/components/Providers';
import { Toaster } from 'sonner';

export const metadata = {
  title: 'ArthaFlow',
  description: 'Track your expenses with Persona 3 Reload style',
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#000508',
};

export default function RootLayout({ children }) {
  return (
    <html lang="id" suppressHydrationWarning>
      <body>
        <Providers>
          {children}
          <Toaster theme="system" position="top-center" richColors closeButton />
        </Providers>
      </body>
    </html>
  );
}
