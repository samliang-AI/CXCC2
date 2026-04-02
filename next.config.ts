import type { NextConfig } from 'next';
import path from 'path';

const nextConfig: NextConfig = {
  // outputFileTracingRoot: path.resolve(__dirname, '../../'),
  /* config options here */
  allowedDevOrigins: ['*.dev.coze.site'],
  
  async rewrites() {
    // 仅代理 Python 后端 API，保留 Next.js 自有路由 (auth/cxcc/ai-chat 等)
    return [
      { source: '/api/upload', destination: 'http://127.0.0.1:8000/api/upload' },
      { source: '/api/analyze', destination: 'http://127.0.0.1:8000/api/analyze' },
      { source: '/api/analyze/:path*', destination: 'http://127.0.0.1:8000/api/analyze/:path*' },
      { source: '/api/data-sources', destination: 'http://127.0.0.1:8000/api/data-sources' },
      { source: '/api/data-sources/:path*', destination: 'http://127.0.0.1:8000/api/data-sources/:path*' },
      { source: '/api/customers/:path*', destination: 'http://127.0.0.1:8000/api/customers/:path*' },
      { source: '/api/health', destination: 'http://127.0.0.1:8000/api/health' },
      { source: '/api/predict', destination: 'http://127.0.0.1:8000/api/predict' },
      { source: '/api/custom-report', destination: 'http://127.0.0.1:8000/api/custom-report' },
    ]
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'lf-coze-web-cdn.coze.cn',
        pathname: '/**',
      },
    ],
  },
};

export default nextConfig;
