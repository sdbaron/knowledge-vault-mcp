import { sha256 } from "./hash.js";
import type { ChunkRecord, ParsedWikiNote } from "./types.js";

const DEFAULT_MAX_CHUNK_CHARS = 1200;

export function buildChunks(
  parsedNote: ParsedWikiNote,
  maxChunkChars = DEFAULT_MAX_CHUNK_CHARS,
): ChunkRecord[] {
  const chunks: ChunkRecord[] = [];
  let chunkIndex = 0;

  for (const section of parsedNote.sections) {
    const sectionChunks = splitSectionContent(section.content, maxChunkChars);

    for (const sectionChunk of sectionChunks) {
      chunkIndex += 1;
      const idSeed = `${parsedNote.relativePath}|${section.heading}|${chunkIndex}|${sectionChunk}`;

      chunks.push({
        id: `chunk_${sha256(idSeed).slice(0, 24)}`,
        notePath: parsedNote.relativePath,
        sectionTitle: section.heading,
        headingLevel: section.level,
        chunkIndex,
        content: sectionChunk,
        tags: [...parsedNote.frontmatter.tags],
        links: [...section.links],
        updatedAt: parsedNote.frontmatter.updated_at,
        startLine: section.startLine,
        endLine: section.endLine,
      });
    }
  }

  return chunks;
}

function splitSectionContent(content: string, maxChunkChars: number): string[] {
  const normalized = content.trim();
  if (!normalized) {
    return [];
  }

  const paragraphs = normalized
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph.length > 0);

  const chunks: string[] = [];
  let currentChunk = "";

  const flushCurrent = () => {
    if (currentChunk.trim().length > 0) {
      chunks.push(currentChunk.trim());
      currentChunk = "";
    }
  };

  for (const paragraph of paragraphs) {
    if (paragraph.length > maxChunkChars) {
      flushCurrent();
      chunks.push(...splitHard(paragraph, maxChunkChars));
      continue;
    }

    const candidate = currentChunk
      ? `${currentChunk}\n\n${paragraph}`
      : paragraph;
    if (candidate.length > maxChunkChars) {
      flushCurrent();
      currentChunk = paragraph;
      continue;
    }

    currentChunk = candidate;
  }

  flushCurrent();

  return chunks;
}

function splitHard(value: string, maxChunkChars: number): string[] {
  const chunks: string[] = [];
  let remaining = value.trim();

  while (remaining.length > maxChunkChars) {
    const splitIndex = findSplitIndex(remaining, maxChunkChars);
    chunks.push(remaining.slice(0, splitIndex).trim());
    remaining = remaining.slice(splitIndex).trim();
  }

  if (remaining.length > 0) {
    chunks.push(remaining);
  }

  return chunks;
}

function findSplitIndex(value: string, maxChunkChars: number): number {
  const boundary = value.lastIndexOf(" ", maxChunkChars);
  if (boundary <= 0) {
    return maxChunkChars;
  }

  return boundary;
}
