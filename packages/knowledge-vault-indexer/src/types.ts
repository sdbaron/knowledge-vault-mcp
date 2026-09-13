export type { VaultFrontmatter as WikiFrontmatter } from "@knowledge-vault/contract";
import type { VaultFrontmatter } from "@knowledge-vault/contract";

export interface WikiSection {
  heading: string;
  level: number;
  content: string;
  startLine: number;
  endLine: number;
  links: string[];
}

export interface ParsedWikiNote {
  absolutePath: string;
  relativePath: string;
  contentHash: string;
  frontmatter: VaultFrontmatter;
  sections: WikiSection[];
  allLinks: string[];
  errors: string[];
}

export interface ChunkRecord {
  id: string;
  notePath: string;
  sectionTitle: string;
  headingLevel: number;
  chunkIndex: number;
  content: string;
  tags: string[];
  links: string[];
  updatedAt: string;
  startLine: number;
  endLine: number;
}

export interface IndexError {
  path: string;
  message: string;
}

export interface IndexRunSummary {
  startedAt: string;
  finishedAt: string;
  dbPath: string;
  scannedNotes: number;
  indexedNotes: number;
  skippedNotes: number;
  removedNotes: number;
  chunkCount: number;
  errorCount: number;
  errors: IndexError[];
}

export interface ReindexOptions {
  vaultDir: string;
  dbPath: string;
  pruneMissing?: boolean;
  /** Wenn true, wird der Hash-Check übersprungen und alle Notizen werden neu indexiert. */
  forceReindex?: boolean;
}
