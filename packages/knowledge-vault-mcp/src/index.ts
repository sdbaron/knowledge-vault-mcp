export { KnowledgeVaultMcpServer } from "./server.js";
export { executeTool, VAULT_TOOLS } from "./tools.js";
export { VaultRepository } from "./repository.js";
export {
  createDatabaseConnection,
  isNodeSqliteAvailable,
} from "./sqliteRuntime.js";
export { runEval, parseSuite } from "./eval/runEval.js";
export { loadCases, filterCasesBySuite } from "./eval/loadCases.js";
export {
  uniqueNotePaths,
  hitAtRank,
  reciprocalRank,
  summarizeCaseResults,
  normalizeEvalK,
} from "./eval/metrics.js";
export { formatReportJson, formatReportMarkdown } from "./eval/formatReport.js";
export type {
  BacklinkItem,
  BacklinksParams,
  GetNoteParams,
  JsonRpcRequest,
  JsonRpcResponse,
  McpServerOptions,
  McpTool,
  NoteResponse,
  ReindexParams,
  SearchParams,
  SearchResultItem,
} from "./types.js";
export type {
  EvalCase,
  EvalCaseResult,
  EvalReport,
  EvalRunOptions,
  EvalSuite,
  MetricSummary,
} from "./eval/types.js";
