import { CertCity } from "../components/certcity";
import { StructuredData } from "../components/structured-data";
import { homePage, pageMetadata, siteName, siteUrl } from "../lib/seo";

export const metadata = pageMetadata(homePage);

export default function Home() {
  const url = siteUrl(homePage.path);
  const organization = `${url}#organization`;

  return (
    <>
      <StructuredData data={{
        "@graph": [
          { "@type": "WebSite", "@id": `${url}#website`, url, name: siteName, description: homePage.description,
            inLanguage: "en", publisher: { "@id": organization } },
          { "@type": "Organization", "@id": organization, url, name: siteName,
            logo: siteUrl("/brand/certcity-icon-512.png"), email: "info@certcity.org" },
        ],
      }} />
      <CertCity />
    </>
  );
}
