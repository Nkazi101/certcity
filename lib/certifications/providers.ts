// Certification providers CertCity organizes practice under. Tracks live with their provider's content
// (Claude tracks in lib/claude). Add a provider here, then its tracks, when its practice is ready.
export type ProviderId = "anthropic" | "microsoft" | "aws" | "google";

export type Provider = {
  id: ProviderId;
  /** How the catalog names the certification family. */
  name: string;
  /** Who runs the exams, for attribution. */
  issuer: string;
  status: "available" | "planned";
  catalog?: string;
};

export const providers: readonly Provider[] = [
  { id: "anthropic", name: "Claude certifications", issuer: "Anthropic", status: "available", catalog: "https://anthropic-partners.skilljar.com/page/partner-certifications" },
  { id: "microsoft", name: "Microsoft Azure AI certifications", issuer: "Microsoft", status: "planned" },
  { id: "aws", name: "AWS AI certifications", issuer: "Amazon Web Services", status: "planned" },
  { id: "google", name: "Google Cloud AI certifications", issuer: "Google Cloud", status: "planned" },
];

export const availableProviders = providers.filter(({ status }) => status === "available");
export const plannedProviders = providers.filter(({ status }) => status === "planned");

export function providerFor(id: ProviderId) {
  return providers.find((provider) => provider.id === id)!;
}
