import './globals.css';
import Providers from '@/components/Providers';
import { Toaster } from 'sonner';

export const metadata = {
  title: 'ArthaFlow',
  description: 'Catatan keuangan pribadi yang tenang dan presisi.',
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#0d0f0e',
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
