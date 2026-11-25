// Registry of learn-by-doing missions. A mission listed here replaces its casework station in the city;
// its casework stays in lib/claude/cases so saved casework outcomes keep reading and counting.
import { permitAgentLab } from "./claude/permit-agent";
import { vendorBatchLab } from "./claude/vendor-batch-api";
import { communityHandoffLab } from "./claude/community-handoff";
import { repairShopToolsLab } from "./claude/repair-shop-tools";
import { printworksCiLab } from "./claude/printworks-ci";
import { enrollmentRepliesLab } from "./claude/enrollment-replies";
import { supplierInvoicesLab } from "./claude/supplier-invoices";
import { libraryWorkersLab } from "./claude/library-workers";
import { repairDeskSafetyLab } from "./claude/repair-desk-safety";
import { developerReleaseLab } from "./claude/developer-release";
import { librarySearchLab } from "./claude/library-search";
import { printworksRulesLab } from "./claude/printworks-rules";
import { archiveCoordinationLab } from "./claude/archive-coordination";
import { releaseReviewLab } from "./claude/release-review";
import { marketBulletinLab } from "./claude/market-bulletin";
import { communityPolicyLab } from "./claude/community-policy";
import { schoolNoticePilotLab } from "./claude/school-notice-pilot";
import { kitchenBillingAuditLab } from "./claude/kitchen-billing-audit";
import { professionalEvalGateLab } from "./claude/professional-eval-gate";
import { tenantToolsLab } from "./claude/tenant-tools";
import { marketScaleLab } from "./claude/market-scale";
import { communityControlsLab } from "./claude/community-controls";
import { regionalOperationsLab } from "./claude/regional-operations";
import { publicPermitDiscoveryLab } from "./claude/public-permit-discovery";
import { stadiumFallbacksLab } from "./claude/stadium-fallbacks";
import type { AnyLabMission } from "./types";

export const labMissions: Readonly<Record<string, AnyLabMission>> = {
  [permitAgentLab.id]: permitAgentLab,
  [vendorBatchLab.id]: vendorBatchLab,
  [communityHandoffLab.id]: communityHandoffLab,
  [repairShopToolsLab.id]: repairShopToolsLab,
  [printworksCiLab.id]: printworksCiLab,
  [enrollmentRepliesLab.id]: enrollmentRepliesLab,
  [supplierInvoicesLab.id]: supplierInvoicesLab,
  [libraryWorkersLab.id]: libraryWorkersLab,
  [repairDeskSafetyLab.id]: repairDeskSafetyLab,
  [developerReleaseLab.id]: developerReleaseLab,
  [librarySearchLab.id]: librarySearchLab,
  [printworksRulesLab.id]: printworksRulesLab,
  [archiveCoordinationLab.id]: archiveCoordinationLab,
  [releaseReviewLab.id]: releaseReviewLab,
  [marketBulletinLab.id]: marketBulletinLab,
  [communityPolicyLab.id]: communityPolicyLab,
  [schoolNoticePilotLab.id]: schoolNoticePilotLab,
  [kitchenBillingAuditLab.id]: kitchenBillingAuditLab,
  [professionalEvalGateLab.id]: professionalEvalGateLab,
  [tenantToolsLab.id]: tenantToolsLab,
  [marketScaleLab.id]: marketScaleLab,
  [communityControlsLab.id]: communityControlsLab,
  [regionalOperationsLab.id]: regionalOperationsLab,
  [publicPermitDiscoveryLab.id]: publicPermitDiscoveryLab,
  [stadiumFallbacksLab.id]: stadiumFallbacksLab,
};

export function labFor(missionId: string): AnyLabMission | undefined {
  return Object.hasOwn(labMissions, missionId) ? labMissions[missionId] : undefined;
}

export type { AnyLabMission } from "./types";
