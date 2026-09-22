import type { Metadata, Viewport } from "next";
import ErrorBoundary from '@/components/ErrorBoundary';
import "./globals.css";

const SITE_URL = "https://m3tm-world.vercel.app";
const SITE_NAME = "M3TM.WORLD";
const SITE_TITLE = "M3TM.WORLD — خريطة عالمية تفاعلية للبيانات الحية";
const SITE_DESCRIPTION = "منصة مرئية لعرض بيانات عامة وحية على خريطة تفاعلية: حركة الطيران، الأقمار الصناعية، الكاميرات العامة، الطقس، الزلازل، الحرائق، الملاحة البحرية والأخبار من مصادرها المنشورة.";

export const viewport: Viewport = {
  themeColor: "#D4AF37",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  colorScheme: "dark",
};

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: SITE_TITLE,
    template: "%s | M3TM.WORLD",
  },
  description: SITE_DESCRIPTION,
  keywords: [
    "flight tracker", "aircraft tracking", "ADS-B tracker", "live flight radar",
    "satellite tracking", "ISS tracker", "space station tracker",
    "CCTV cameras live", "security cameras worldwide", "live cameras",
    "earthquake monitor", "seismic activity", "USGS earthquake",
    "wildfire tracker", "NASA FIRMS", "active fires",
    "weather radar", "space weather", "CVE tracker", "خرائط تفاعلية",
    "بيانات حية", "بيانات مفتوحة", "بحث مفتوح", "تحقق من المصادر",
    "m3tm.world", "M3TM.WORLD"
  ],
  authors: [{ name: "M3TM.WORLD", url: SITE_URL }],
  creator: "M3TM.WORLD",
  publisher: "M3TM.WORLD",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  icons: {
    icon: [
      { url: "/favicon-32x32.png", type: "image/png", sizes: "32x32" },
      { url: "/favicon-16x16.png", type: "image/png", sizes: "16x16" },
      { url: "/android-chrome-192x192.png", type: "image/png", sizes: "192x192" },
      { url: "/android-chrome-512x512.png", type: "image/png", sizes: "512x512" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180" },
    ],
    shortcut: "/favicon.ico",
    other: [
      {
        rel: "apple-touch-icon-precomposed",
        url: "/apple-touch-icon.png",
      },
    ],
  },
  manifest: "/site.webmanifest",
  alternates: {
    canonical: SITE_URL,
  },
  openGraph: {
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    type: "website",
    siteName: SITE_NAME,
    locale: "ar_SA",
    url: SITE_URL,
    images: [
      {
        url: `${SITE_URL}/m3tm-world-preview.png`,
        width: 1440,
        height: 900,
        alt: "M3TM.WORLD — خريطة عالمية تفاعلية للبيانات الحية",
        type: "image/png",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: [`${SITE_URL}/m3tm-world-preview.png`],
  },
  category: "technology",
  classification: "خرائط وبيانات حية",
  other: {
    "apple-mobile-web-app-capable": "yes",
    "apple-mobile-web-app-status-bar-style": "black-translucent",
    "apple-mobile-web-app-title": "M3TM.WORLD",
    "mobile-web-app-capable": "yes",
    "msapplication-TileColor": "#06060C",
    "msapplication-config": "none",
  },
};

// JSON-LD Structured Data
const jsonLd = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "M3TM.WORLD",
  alternateName: ["M3TM.WORLD"],
  url: SITE_URL,
  description: SITE_DESCRIPTION,
  applicationCategory: "DataVisualizationApplication",
  operatingSystem: "Web",
  browserRequirements: "متصفح ويب حديث",
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD",
    availability: "https://schema.org/InStock",
  },
  featureList: [
    "خريطة عالمية تفاعلية ثنائية وثلاثية الأبعاد",
    "تتبع حركة الطيران من مصادر ADS-B المنشورة",
    "تتبع الأقمار الصناعية والأجسام المدارية",
    "عرض كاميرات عامة وبثوث منشورة",
    "متابعة الزلازل والحرائق والطقس",
    "عرض بيانات الملاحة البحرية عند توفرها",
    "أدوات DNS وWHOIS وشهادات TLS",
    "تجميع الأخبار وربطها بالموقع الجغرافي",
    "عرض مصادر البيانات وإسنادها بوضوح"
  ],
  screenshot: `${SITE_URL}/m3tm-world-preview.png`,
  author: {
    "@type": "Organization",
    name: "M3TM.WORLD",
    url: SITE_URL,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <link rel="canonical" href={SITE_URL} />

        {/* JSON-LD Structured Data */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />

      </head>
      <body className="antialiased">
        <ErrorBoundary name="M3TM.WORLD Core">
          {children}
        </ErrorBoundary>
      </body>
    </html>
  );
}
