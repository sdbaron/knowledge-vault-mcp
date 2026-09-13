import type { EvalCaseResult, EvalReport, MetricSummary } from "./types.js";

export function formatReportJson(report: EvalReport): string {
  return `${JSON.stringify(report, null, 2)}\n`;
}

export function formatReportMarkdown(report: EvalReport): string {
  const lines: string[] = [];
  const { meta, summary } = report;

  lines.push(`# Wiki Eval Report — ${meta.label} (${meta.suite})`);
  lines.push("");
  lines.push(`- **Date:** ${meta.timestamp.slice(0, 10)}`);
  lines.push(`- **Cases:** ${meta.caseCount}`);
  lines.push(`- **Algorithm:** ${meta.algorithm}`);
  lines.push(`- **k:** ${meta.k}`);
  lines.push(
    `- **Hit@1:** ${formatPercent(summary.hitAt1)} · **Hit@3:** ${formatPercent(summary.hitAt3)} · **MRR:** ${summary.mrr.toFixed(3)} · **Empty:** ${formatPercent(summary.emptyRate)}`,
  );
  lines.push(
    `- **Latency p50 / p95:** ${formatMs(summary.latencyMs.p50)} / ${formatMs(summary.latencyMs.p95)}`,
  );
  lines.push("");

  appendSliceTable(lines, "By query type", report.summaryByQueryType);
  appendSliceTable(lines, "By difficulty", report.summaryByDifficulty);
  appendSliceTable(lines, "By language", report.summaryByLanguage);

  const misses = report.cases.filter((entry) => !entry.hitAt3);
  lines.push("## Misses (Hit@3 = false)");
  lines.push("");

  if (misses.length === 0) {
    lines.push("_None_");
  } else {
    lines.push("| id | query | expected | top-3 actual |");
    lines.push("| --- | --- | --- | --- |");
    for (const entry of misses) {
      const top3 = entry.rankedNotePaths.slice(0, 3).join(", ") || "—";
      lines.push(
        `| ${entry.id} | ${escapeCell(entry.query)} | ${escapeCell(entry.expectedNotePaths.join(" OR "))} | ${escapeCell(top3)} |`,
      );
    }
  }

  lines.push("");

  if (report.warnings.length > 0) {
    lines.push("## Warnings");
    lines.push("");
    for (const warning of report.warnings) {
      lines.push(`- ${warning}`);
    }
    lines.push("");
  }

  return `${lines.join("\n")}\n`;
}

export function formatStdoutSummary(report: EvalReport): string {
  const { meta, summary } = report;
  return [
    `Wiki eval (${meta.label}, ${meta.suite}): ${meta.caseCount} cases`,
    `Hit@1=${formatPercent(summary.hitAt1)} Hit@3=${formatPercent(summary.hitAt3)} MRR=${summary.mrr.toFixed(3)} Empty=${formatPercent(summary.emptyRate)}`,
    `Latency p50=${formatMs(summary.latencyMs.p50)} p95=${formatMs(summary.latencyMs.p95)}`,
  ].join("\n");
}

function appendSliceTable(
  lines: string[],
  title: string,
  slices: Record<string, MetricSummary>,
): void {
  const keys = Object.keys(slices);
  if (keys.length === 0) {
    return;
  }

  lines.push(`## ${title}`);
  lines.push("");
  lines.push("| slice | cases | Hit@1 | Hit@3 | MRR |");
  lines.push("| --- | ---: | ---: | ---: | ---: |");

  for (const key of keys.sort()) {
    const slice = slices[key];
    if (!slice) {
      continue;
    }

    lines.push(
      `| ${escapeCell(key)} | ${slice.caseCount} | ${formatPercent(slice.hitAt1)} | ${formatPercent(slice.hitAt3)} | ${slice.mrr.toFixed(3)} |`,
    );
  }

  lines.push("");
}

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function formatMs(value: number): string {
  return `${value.toFixed(1)} ms`;
}

function escapeCell(value: string): string {
  return value.replace(/\|/g, "\\|").replace(/\n/g, " ");
}

export function findMisses(cases: EvalCaseResult[]): EvalCaseResult[] {
  return cases.filter((entry) => !entry.hitAt3);
}
