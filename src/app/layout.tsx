import type { Metadata } from 'next';
import { Inspector } from 'react-dev-inspector';
import { Providers } from '@/lib/react-query';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'BPO经营分析管理系统',
    template: '%s | BPO经营分析管理系统',
  },
  description:
    'BPO经营分析管理系统是一款专门为BPO行业设计的经营分析和管理平台，提供数据同步、分析和可视化功能。',
  keywords: [
    'BPO',
    '经营分析',
    '管理系统',
    '数据同步',
    '录音管理',
    '通话管理',
  ],
  authors: [{ name: 'BPO Team' }],
  generator: 'BPO System',
  openGraph: {
    title: 'BPO经营分析管理系统',
    description:
      'BPO经营分析管理系统，为BPO行业提供专业的经营分析和管理功能。',
    url: 'http://localhost:5001',
    siteName: 'BPO经营分析管理系统',
    locale: 'zh_CN',
    type: 'website',
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const isDev = process.env.NODE_ENV === 'development';

  return (
    <html lang="en">
      <body className={`antialiased`}>
        {isDev && <Inspector />}
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
