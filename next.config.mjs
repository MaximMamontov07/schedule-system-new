/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverComponentsExternalPackages: ['pg', 'bcryptjs']
  },
  // Отключаем статическую генерацию для динамических страниц
  output: 'standalone',
  // Указываем, что все страницы должны рендериться динамически
  staticPageGenerationTimeout: 120,
  // Отключаем статическую генерацию для API маршрутов
  serverRuntimeConfig: {
    // Будет доступно только на сервере
    projectRoot: __dirname,
  },
  // Настройки для сборки
  distDir: '.next',
  generateBuildId: async () => {
    return `build-${Date.now()}`
  },
}

export default nextConfig