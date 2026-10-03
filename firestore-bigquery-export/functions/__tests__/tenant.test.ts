import { buildTenantDatasetId, extractTenantIdFromPath } from "../src/util";

describe("util.extractTenantIdFromPath", () => {
  test("reads the tenant segment of a tenants/{tenantId}/... path", () => {
    expect(
      extractTenantIdFromPath(
        "tenants/reachmore_25/channels/whatsapp/conversations/c1/messages/m1"
      )
    ).toBe("reachmore_25");
  });

  test("throws when the path has no tenant segment", () => {
    expect(() => extractTenantIdFromPath("tenants")).toThrow();
  });
});

describe("util.buildTenantDatasetId", () => {
  test("prefixes the tenant id", () => {
    expect(buildTenantDatasetId("437")).toBe("tenant_437");
  });

  test("replaces characters BigQuery dataset ids do not allow", () => {
    expect(buildTenantDatasetId("acme-co.sa")).toBe("tenant_acme_co_sa");
  });
});
