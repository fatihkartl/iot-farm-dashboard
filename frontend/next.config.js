/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      // Tarayıcı -> Next.js (/api/...) -> Docker içinden backend:8080
      { source: "/api/:path*", destination: "http://backend:8080/:path*" },
    ];
  },
};

module.exports = nextConfig;
// --- Bu dosya Next.js yapılandırması için kullanılır
// --- Rewrites ile tarayıcıdan gelen istekleri backend'e yönlendiriyoruz
// --- Böylece frontend ve backend aynı porttan çalışıyor gibi görünüyor
// --- Docker Compose ile backend servisi "backend" olarak adlandırıldı
// --- Bu yapılandırma sayesinde frontend, backend ile aynı ağda çalışıyor
// --- Bu, CORS sorunlarını önler ve istekleri backend'e yönlendirir
// --- Ayrıca, Next.js uygulaması için gerekli yapılandırmaları içerir
// --- Örneğin, API isteklerini backend'e yönlendirmek için kullanılır
// --- Bu yapılandırma, Next.js uygulamasının düzgün çalışması için gereklidir
// --- İstekler, Docker Compose ile oluşturulan backend servisine yönlendirilir
// --- Bu, frontend ve backend arasındaki iletişimi kolaylaştırır
// --- Ayrıca, Next.js uygulamasının performansını artırır
// --- Bu yapılandırma, Next.js uygulamasının Docker içinde çalışmasını sağlar
