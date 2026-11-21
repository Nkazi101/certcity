import Link from "next/link";
import { siteUrl } from "../../lib/seo";
import { StructuredData } from "../structured-data";

export function SeoBreadcrumbs({ entries }: { entries: { name: string; path: string }[] }) {
  return <>
    <StructuredData data={{
      "@type": "BreadcrumbList",
      itemListElement: entries.map(({ name, path }, index) => ({
        "@type": "ListItem", position: index + 1, name, item: siteUrl(path),
      })),
    }} />
    <nav className="academy-breadcrumbs" aria-label="Breadcrumb">
      <ol>
        {entries.map(({ name, path }, index) => <li key={path}>
          {index === entries.length - 1 ? <span aria-current="page">{name}</span> : <Link href={path} prefetch={false}>{name}</Link>}
        </li>)}
      </ol>
    </nav>
  </>;
}
