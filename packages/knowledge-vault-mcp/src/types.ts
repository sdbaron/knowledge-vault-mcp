export interface SearchFilters {
  domain?: string;
  owner?: string;
  tags?: string[];
}

export interface SearchParams {
  query: string;
  k?: number;
  filters?: SearchFilters;
}

export interface SearchResultItem {
  notePath: string;
  sectionTitle: string;
  snippet: string;
  score: number;
  updatedAt: string;
  tags: string[];
  startLine: number;
}

export interface GetNoteParams {
  path_or_id: string;
  section?: string;
}

export interface NoteChunk {
  id: string;
  sectionTitle: string;
  headingLevel: number;
  chunkIndex: number;
  content: string;
  links: string[];
}

export interface NoteResponse {
  notePath: string;
  title: string;
  domain: string;
  owner: string;
  updatedAt: string;
  tags: string[];
  aliases: string[];
  chunks: NoteChunk[];
}

export interface BacklinksParams {
  note: string;
  include_context?: boolean;
}

export interface BacklinkItem {
  sourceNotePath: string;
  sectionTitle: string;
  context?: string;
}

export interface ReindexParams {
  mode?: "changed_only" | "full";
  vault_dir?: string;
  db_path?: string;
}

export interface McpTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export interface JsonRpcRequest {
  jsonrpc: "2.0";
  id?: string | number | null;
  method: string;
  params?: unknown;
}

export interface JsonRpcResponse {
  jsonrpc: "2.0";
  id: string | number | null;
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

export interface McpServerOptions {
  dbPath: string;
  vaultDir: string;
}
