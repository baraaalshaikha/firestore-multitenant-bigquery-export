import { initializeLatestView } from "../../../bigquery/initializeLatestView";
import { initializeLatestMaterializedView } from "../../../bigquery/initializeLatestMaterializedView";
import { FirestoreBigQueryEventHistoryTrackerConfig } from "../../../bigquery";
import { RawChangelogViewSchema } from "../../../bigquery/schema";

jest.mock("../../../bigquery/initializeLatestMaterializedView");

describe("initializeLatestView", () => {
  const mockView = {
    id: "test_view",
    getMetadata: jest.fn(),
    setMetadata: jest.fn(),
    create: jest.fn(),
  };

  const mockConfig: FirestoreBigQueryEventHistoryTrackerConfig = {
    wildcardIds: true,
    datasetId: "test_dataset",
    useNewSnapshotQuerySyntax: true,
    clustering: [],
    tableId: "test_raw_table",
    useMaterializedView: false,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("initializeLatestView", () => {
    it("calls initializeLatestMaterializedView when useMaterializedView is true", async () => {
      const mockOptions = {
        bq: {} as any, // Mocked BigQuery instance
        dataset: { id: "test_dataset" } as any, // Mocked Dataset instance
        view: mockView as any, // Mocked Table instance
        viewExists: false,
        rawChangeLogTableName: "test_raw_table",
        rawLatestViewName: "test_raw_view",
        changeTrackerConfig: { ...mockConfig, useMaterializedView: true },
        useMaterializedView: true,
        useIncrementalMaterializedView: false,
      };

      await initializeLatestView(mockOptions);

      expect(initializeLatestMaterializedView).toHaveBeenCalled();
    });

    it("does not call initializeLatestMaterializedView when useMaterializedView is false", async () => {
      const mockOptions = {
        bq: {} as any, // Mocked BigQuery instance
        dataset: { id: "test_dataset" } as any, // Mocked Dataset instance
        view: mockView as any, // Mocked Table instance
        viewExists: false,
        rawChangeLogTableName: "test_raw_table",
        rawLatestViewName: "test_raw_view",
        changeTrackerConfig: { ...mockConfig, useMaterializedView: false },
        useMaterializedView: false,
        useIncrementalMaterializedView: false,
      };

      await initializeLatestView(mockOptions);

      expect(initializeLatestMaterializedView).not.toHaveBeenCalled();
    });

    // Regression: with wildcardIds enabled, the standard-view branch used to take
    // a reference to the shared RawChangelogViewSchema singleton and push
    // `path_params` onto it on every invocation. On a warm/multi-tenant function
    // instance this accumulated duplicate `path_params` columns, and the next
    // fresh view creation produced "Name path_params in GROUP BY clause is
    // ambiguous", leaving that tenant with only a changelog table.
    it("does not mutate the shared RawChangelogViewSchema across invocations", async () => {
      const initialFieldCount = RawChangelogViewSchema.fields.length;

      const options = {
        bq: { projectId: "test-project" } as any,
        dataset: { id: "test_dataset" } as any,
        view: {
          id: "test_view",
          getMetadata: jest
            .fn()
            .mockResolvedValue([{ schema: { fields: [] }, view: { query: "" } }]),
          setMetadata: jest.fn().mockResolvedValue(undefined),
          create: jest.fn().mockResolvedValue(undefined),
        } as any,
        viewExists: true,
        rawChangeLogTableName: "test_raw_table",
        rawLatestViewName: "test_raw_view",
        changeTrackerConfig: { ...mockConfig, wildcardIds: true },
      };

      await initializeLatestView(options);
      await initializeLatestView(options);
      await initializeLatestView(options);

      expect(RawChangelogViewSchema.fields.length).toBe(initialFieldCount);
      expect(
        RawChangelogViewSchema.fields.filter((f) => f.name === "path_params")
          .length
      ).toBe(0);
    });
  });
});
