import { z } from 'zod';

export interface LocationData {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  description: string;
  faq?: Array<{ question: string; answer: string }>;
  products?: Array<{ name: string; price: string; description: string }>;
}

/**
 * Generates JSON-LD for Local Business
 */
export function generateLocalBusinessSchema(location: LocationData) {
  return {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    "name": location.name,
    "address": {
      "@type": "PostalAddress",
      "streetAddress": location.address,
      "addressLocality": location.city,
      "addressRegion": location.state,
    },
    "description": location.description,
    "url": `https://gbp.cortxai.us/location/${location.id}`,
  };
}

/**
 * Generates CSV/XML sitemaps (Simplified)
 */
export function generateSitemap(locations: LocationData[]): string {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  ${locations.map(loc => `
    <url>
      <loc>https://gbp.cortxai.us/location/${loc.id}</loc>
      <lastmod>${new Date().toISOString()}</lastmod>
      <changefreq>daily</changefreq>
      <priority>0.8</priority>
    </url>
  `).join('')}
</urlset>`;
  return xml;
}

/**
 * Quality Checks Validator
 */
export const ContentSchema = z.object({
  title: z.string().min(10).max(60),
  metaDescription: z.string().min(50).max(160),
  content: z.string().min(300),
  placeholders: z.array(z.string()).refine(arr => arr.length === 0, {
    message: "Empty placeholders detected"
  }),
});

export function validateSEOQuality(data: any) {
  return ContentSchema.safeParse(data);
}
