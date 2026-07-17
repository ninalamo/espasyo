import '../app/globals.css';
import { Ubuntu } from 'next/font/google';
import ClientLayout from './client-layout';

const ubuntu = Ubuntu({
  weight: ['300', '400', '500', '700'],
  subsets: ['latin'],
  variable: '--font-ubuntu',
  display: 'swap',
});

export const metadata = {
  title: 'ESPASYO - Crime Analysis Platform',
  description: 'Crime analysis and forecasting platform',
  icons: {
    icon: '/favicon.ico',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={ubuntu.variable}>
      <body className="font-ubuntu bg-ubuntu-50 text-gray-900">
        <ClientLayout>{children}</ClientLayout>
      </body>
    </html>
  );
}
