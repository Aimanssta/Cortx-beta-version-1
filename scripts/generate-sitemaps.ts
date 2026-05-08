import fs from 'fs';
import path from 'path';
import { generateSitemap, LocationData } from '../src/lib/seo-utils';

/**
 * Programmatic Sitemap Generator for Large-Scale SEO
 * This script segments URLs into batches of 10k as per guidelines.
 */
async function runSitemapGenerator() {
  console.log("Starting Sitemap Generation...");
  
  // 1. Fetch all locations from database (Simulated)
  const allLocations: LocationData[] = Array.from({ length: 25000 }, (_, i) => ({
    id: `loc-${i}`,
    name: `Business ${i}`,
    city: 'Example City',
    state: 'ST',
    address: `${i} Main St`,
    description: `Best business in the area ${i}`
  }));

  const BATCH_SIZE = 10000;
  const sitemapDir = path.join(process.cwd(), 'public', 'sitemaps');

  if (!fs.existsSync(sitemapDir)) {
    fs.mkdirSync(sitemapDir, { recursive: true });
  }

  // 2. Fragment into segmented sitemaps
  for (let i = 0; i < allLocations.length; i += BATCH_SIZE) {
    const batch = allLocations.slice(i, i + BATCH_SIZE);
    const index = Math.floor(i / BATCH_SIZE);
    const xml = generateSitemap(batch);
    
    fs.writeFileSync(path.join(sitemapDir, `sitemap-${index}.xml`), xml);
    console.log(`Generated sitemap-${index}.xml with ${batch.length} URLs`);
  }

  // 3. Generate Index Sitemap
  const indexXml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  ${Array.from({ length: Math.ceil(allLocations.length / BATCH_SIZE) }, (_, i) => `
    <sitemap>
      <loc>https://gbp.cortxai.us/sitemaps/sitemap-${i}.xml</loc>
      <lastmod>${new Date().toISOString()}</lastmod>
    </sitemap>
  `).join('')}
</sitemapindex>`;

  fs.writeFileSync(path.join(process.cwd(), 'public', 'sitemap.xml'), indexXml);
  console.log("Sitemap Index generated successfully.");
}

runSitemapGenerator().catch(console.error);
