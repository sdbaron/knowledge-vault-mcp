export interface VaultFrontmatter {
  title: string;
  tags: string[];
  domain: string;
  owner: string;
  updated_at: string;
  aliases: string[];
  [key: string]: unknown;
}

export interface FrontmatterValidationResult {
  valid: boolean;
  errors: string[];
}

export function validateVaultFrontmatter(
  frontmatter: Partial<VaultFrontmatter>,
): FrontmatterValidationResult {
  const errors: string[] = [];

  if (
    typeof frontmatter.title !== "string" ||
    frontmatter.title.trim() === ""
  ) {
    errors.push("title must be a non-empty string");
  }
  if (!Array.isArray(frontmatter.tags)) {
    errors.push("tags must be an array");
  }
  if (
    typeof frontmatter.domain !== "string" ||
    frontmatter.domain.trim() === ""
  ) {
    errors.push("domain must be a non-empty string");
  }
  if (
    typeof frontmatter.owner !== "string" ||
    frontmatter.owner.trim() === ""
  ) {
    errors.push("owner must be a non-empty string");
  }
  if (
    typeof frontmatter.updated_at !== "string" ||
    frontmatter.updated_at.trim() === ""
  ) {
    errors.push("updated_at must be a non-empty string");
  }
  if (!Array.isArray(frontmatter.aliases)) {
    errors.push("aliases must be an array");
  }

  return { valid: errors.length === 0, errors };
}
