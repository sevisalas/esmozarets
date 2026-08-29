import type { Metadata } from 'next';
import '../src/styles.css';

export const metadata: Metadata = {
  title: 'Esmorzarets',
  description: 'Organiza almuerzos, lugares y asistencias con tu grupo.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="es"><body>{children}</body></html>;
}
