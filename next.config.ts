/** @type {import('next').NextConfig} */
const nextConfig = {
  distDir: "build",
  eslint: {
    ignoreDuringBuilds: true,
  },
  experimental: {
    webpackMemoryOptimizations: true,
  },
  reactStrictMode: true, // 다른 Next.js 설정이 여기에 있을 수 있습니다.
  transpilePackages: ["import-in-the-middle", "@opentelemetry/instrumentation"],
  images: {
    remotePatterns: [
      {
        protocol: "https", // 'http' 또는 'https'
        hostname: "lh3.googleusercontent.com",
        port: "", // 특정 포트를 사용하지 않는 경우 비워둡니다.
        pathname: "/**", // 해당 호스트네임의 모든 경로를 허용합니다. 필요에 따라 더 구체적인 경로를 지정할 수 있습니다 (예: '/profile/picture/**').
      },
      // 필요하다면 다른 도메인 패턴을 여기에 추가할 수 있습니다.
      // 예:
      // {
      //   protocol: 'https',
      //   hostname: 'example.com',
      //   pathname: '/images/**',
      // },
    ],
    // 만약 remotePatterns 대신 domains 배열을 사용하고 싶다면 (구버전 방식):
    // domains: ['lh3.googleusercontent.com', 'example.com'],
  },
};

module.exports = nextConfig;
