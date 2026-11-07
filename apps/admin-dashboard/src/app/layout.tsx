import './global.css';

export const metadata = {
  title: 'Byteflock admin',
  description: 'Byteflock tenant admin dashboard',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
