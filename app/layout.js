import './globals.css';

export const metadata = {
  title: 'Расписание колледжа',
  description: 'Система управления расписанием',
};

export default function RootLayout({ children }) {
  return (
    <html lang="ru">
      <head>
        <link 
          rel="stylesheet" 
          href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/css/all.min.css" 
        />
        <script 
          src="https://cdn.sheetjs.com/xlsx-0.20.2/package/dist/xlsx.full.min.js"
          strategy="beforeInteractive"
        ></script>
      </head>
      <body>{children}</body>
    </html>
  );
}