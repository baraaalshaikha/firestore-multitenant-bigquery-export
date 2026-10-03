import * as functionsTestInit from "../node_modules/firebase-functions-test";
import mockedEnv from "../node_modules/mocked-env";

// Mirrors the tracker's existing-view path (firebase/extensions#3144): each
// initialize pushes path_params onto the shared view schema, after an await.
const viewSchema = { fields: [{ name: "timestamp" }, { name: "data" }] };
const fieldCountsSeenByInitialize: number[] = [];

jest.mock("@firebaseextensions/firestore-bigquery-change-tracker", () => ({
  RawChangelogViewSchema: viewSchema,
  FirestoreBigQueryEventHistoryTracker: jest.fn(() => ({
    initialize: jest.fn(async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
      viewSchema.fields.push({ name: "path_params" });
      fieldCountsSeenByInitialize.push(viewSchema.fields.length);
    }),
    record: jest.fn(async () => {}),
    serializeData: jest.fn((d) => d),
  })),
  ChangeType: { DELETE: 2, UPDATE: 1, CREATE: 0 },
  LogLevel: { DEBUG: "debug", INFO: "info", WARN: "warn", ERROR: "error", SILENT: "silent" },
  Logger: jest.fn().mockImplementation(() => ({
    debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn(), log: jest.fn(), setLogLevel: jest.fn(),
  })),
}));
jest.mock("firebase-admin/functions", () => ({
  getFunctions: jest.fn(() => ({ taskQueue: jest.fn(() => ({ enqueue: jest.fn() })) })),
}));
jest.mock("firebase-admin/eventarc", () => ({
  getEventarc: jest.fn(() => ({ channel: jest.fn(() => ({ publish: jest.fn() })) })),
}));

describe("per-tenant tracker initialization", () => {
  let restoreEnv;
  beforeEach(() => {
    restoreEnv = mockedEnv({
      PROJECT_ID: "fake-project",
      DATASET_ID: "my_ds_id",
      TABLE_ID: "my_id",
      COLLECTION_PATH: "tenants/{tenantId}/items",
      WILDCARD_IDS: "true",
    });
    functionsTestInit();
  });
  afterEach(() => restoreEnv());

  test("each tenant sees the original view schema, even when they arrive together", async () => {
    const { fsexportbigquery } = require("../src/index");
    const functionsTest = functionsTestInit();
    const write = (tenant: string) => {
      const after = functionsTest.firestore.makeDocumentSnapshot({ a: 1 }, `tenants/${tenant}/items/doc1`);
      const before = functionsTest.firestore.makeDocumentSnapshot({}, `tenants/${tenant}/items/doc1`);
      return fsexportbigquery.run({
        data: functionsTest.makeChange(before, after),
        document: `tenants/${tenant}/items/doc1`,
        id: `event-${tenant}`,
        time: new Date().toISOString(),
        params: { tenantId: tenant },
      });
    };

    await Promise.all(["t1", "t2", "t3"].map(write));

    expect(fieldCountsSeenByInitialize).toEqual([3, 3, 3]);
  });
});
