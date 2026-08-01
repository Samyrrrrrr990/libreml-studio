import {
  Check,
  Copy,
  FileHtml,
  FileJs,
  FileText,
  Quotes,
} from '@phosphor-icons/react';
import { useState } from 'react';

import { libreMlApi } from '../../lib/api';
import { useWorkspaceStore } from '../../store/workspace';

const VERSION = '0.1.0';
export const LIBREML_CITATION = `LibreML Studio contributors (2026). LibreML Studio (Version ${VERSION}) [Computer software]. https://github.com/Samyrrrrrr990/libreml-studio`;

const escapeHtml = (value: string): string =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

const saveFile = (name: string, type: string, content: string): void => {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  anchor.hidden = true;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
};

export function ReportPanel() {
  const project = useWorkspaceStore((state) => state.project);
  const dataset = useWorkspaceStore((state) => state.dataset);
  const results = useWorkspaceStore((state) => state.results);
  const warnings = useWorkspaceStore((state) => state.warnings);
  const audit = useWorkspaceStore((state) => state.audit);
  const reportNodeId = useWorkspaceStore((state) =>
    state.nodes.find((node) => node.data.nodeType === 'generate_report')?.id,
  );
  const backendOnline = useWorkspaceStore((state) => state.backendOnline);
  const notify = useWorkspaceStore((state) => state.notify);
  const [copied, setCopied] = useState(false);
  const [exporting, setExporting] = useState<string | null>(null);

  const reportObject = {
    schema_version: '1.0',
    title: project.title,
    research_question: project.researchQuestion,
    analysis_intent: project.analysisIntent,
    dataset: dataset
      ? { name: dataset.name, rows: dataset.rowCount, columns: dataset.columnCount, fingerprint: dataset.fingerprint, source: dataset.source }
      : null,
    methodology: {
      mode: project.mode,
      random_seed: project.randomSeed,
      split: results?.splitSummary ?? 'Not run',
      model: results?.modelName ?? 'Not run',
    },
    evaluation: results?.metrics.map((metric) => ({ metric: metric.label, value: metric.value })) ?? [],
    warnings_and_unresolved_issues: warnings
      .filter((warning) => warning.decision !== 'approved')
      .map((warning) => ({ code: warning.ruleId, title: warning.title, decision: warning.decision })),
    limitations: [
      'Predictive associations do not establish causation.',
      ...(results?.source === 'demo' ? ['Evaluation values are bundled demonstration artifacts, not results fitted in this session.'] : []),
    ],
    reproducibility: {
      software: 'LibreML Studio',
      version: VERSION,
      citation: LIBREML_CITATION,
      audit_event_count: audit.length,
    },
  };

  const markdown = `# ${project.title}\n\n## Research question\n\n${project.researchQuestion}\n\n## Dataset\n\n${dataset ? `${dataset.name}: ${dataset.rowCount} rows and ${dataset.columnCount} columns. Fingerprint ${dataset.fingerprint}.` : 'No dataset recorded.'}\n\n## Methodology\n\nAnalysis intent: ${project.analysisIntent}. Random seed: ${project.randomSeed}. ${results ? `Model: ${results.modelName}. ${results.splitSummary}.` : 'The workflow has not completed.'}\n\n## Evaluation\n\n${results ? results.metrics.map((metric) => `- ${metric.label}: ${metric.displayValue}`).join('\n') : 'No evaluation artifact.'}\n\n## Warnings and unresolved issues\n\n${reportObject.warnings_and_unresolved_issues.length ? reportObject.warnings_and_unresolved_issues.map((warning) => `- ${warning.title} (${warning.decision})`).join('\n') : 'None recorded.'}\n\n## Limitations\n\n- Predictive associations do not establish causation.\n${results?.source === 'demo' ? '- Evaluation values are bundled demonstration artifacts, not results fitted in this session.\n' : ''}\n## Software and citation\n\n${LIBREML_CITATION}\n`;

  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${escapeHtml(project.title)}</title><style>body{font:16px/1.6 Georgia,serif;max-width:820px;margin:48px auto;padding:0 24px;color:#17283d}h1,h2{font-family:Arial,sans-serif}code{font:13px monospace;background:#f1eee6;padding:2px 5px}aside{border-left:4px solid #b87723;padding:8px 16px;background:#f8f5ee}</style></head><body><h1>${escapeHtml(project.title)}</h1><h2>Research question</h2><p>${escapeHtml(project.researchQuestion)}</p><h2>Dataset</h2><p>${dataset ? `${escapeHtml(dataset.name)}: ${dataset.rowCount} rows and ${dataset.columnCount} columns. Fingerprint <code>${escapeHtml(dataset.fingerprint)}</code>.` : 'No dataset recorded.'}</p><h2>Methodology</h2><p>Analysis intent: ${project.analysisIntent}. Random seed: ${project.randomSeed}. ${results ? `Model: ${escapeHtml(results.modelName)}. ${escapeHtml(results.splitSummary)}.` : 'The workflow has not completed.'}</p><h2>Evaluation</h2>${results ? `<ul>${results.metrics.map((metric) => `<li>${escapeHtml(metric.label)}: ${escapeHtml(metric.displayValue)}</li>`).join('')}</ul>` : '<p>No evaluation artifact.</p>'}<h2>Limitations</h2><aside>Predictive associations do not establish causation.${results?.source === 'demo' ? ' Evaluation values are bundled demonstration artifacts, not results fitted in this session.' : ''}</aside><h2>Software and citation</h2><p>${escapeHtml(LIBREML_CITATION)}</p></body></html>`;

  const exportReport = async (format: 'html' | 'markdown' | 'json'): Promise<void> => {
    setExporting(format);
    try {
      if (backendOnline && results?.source === 'backend') {
        if (!reportNodeId) throw new Error('Add a Research report node before exporting a backend artifact.');
        const payload = await libreMlApi.getReport(project.id, reportNodeId, format);
        const content = typeof payload === 'string' ? payload : JSON.stringify(payload, null, 2);
        saveFile(`libreml-report.${format === 'markdown' ? 'md' : format}`, format === 'html' ? 'text/html' : format === 'markdown' ? 'text/markdown' : 'application/json', content);
      } else {
        const content = format === 'html' ? html : format === 'markdown' ? markdown : JSON.stringify(reportObject, null, 2);
        saveFile(`libreml-report.${format === 'markdown' ? 'md' : format}`, format === 'html' ? 'text/html' : format === 'markdown' ? 'text/markdown' : 'application/json', content);
      }
      notify({ tone: 'success', title: 'Report exported', message: `${format.toUpperCase()} report saved locally with software version and citation.` });
    } catch (error) {
      notify({ tone: 'danger', title: 'Report export failed', message: error instanceof Error ? error.message : 'The local report endpoint did not return an artifact.' });
    } finally {
      setExporting(null);
    }
  };

  const copyCitation = async () => {
    try {
      await navigator.clipboard.writeText(LIBREML_CITATION);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      notify({ tone: 'warning', title: 'Clipboard unavailable', message: 'Select the citation text and copy it manually.' });
    }
  };

  return (
    <div className="report-panel">
      <section className="report-preview">
        <header>
          <span>Deterministic local report</span>
          <h3>{project.title}</h3>
          <p>{project.researchQuestion}</p>
        </header>
        <div className="report-outline">
          <div><strong>Dataset</strong><span>{dataset ? `${dataset.name}, ${dataset.rowCount.toLocaleString()} rows` : 'Not provided'}</span></div>
          <div><strong>Method</strong><span>{results ? `${results.modelName}; ${results.splitSummary}` : 'Awaiting workflow run'}</span></div>
          <div><strong>Integrity</strong><span>{warnings.filter((warning) => warning.decision !== 'approved').length} unresolved issues</span></div>
          <div><strong>Reproducibility</strong><span>Seed {project.randomSeed}; {audit.length} ledger events</span></div>
        </div>
        {results?.source === 'demo' ? <p className="report-demo-line">This preview will label bundled demonstration values as illustrative.</p> : null}
        <div className="report-actions">
          <button className="button button-primary" type="button" onClick={() => void exportReport('html')} disabled={exporting !== null}><FileHtml size={16} weight="bold" />{exporting === 'html' ? 'Exporting…' : 'Export HTML'}</button>
          <button className="button button-quiet" type="button" onClick={() => void exportReport('markdown')} disabled={exporting !== null}><FileText size={16} weight="bold" />Markdown</button>
          <button className="button button-quiet" type="button" onClick={() => void exportReport('json')} disabled={exporting !== null}><FileJs size={16} weight="bold" />JSON</button>
        </div>
      </section>

      <aside className="citation-card">
        <Quotes size={24} weight="duotone" />
        <div>
          <span>Cite LibreML</span>
          <h3>Help the research tool grow</h3>
          <p>If LibreML materially supported your research, please cite it. This is a community norm, not a condition of use. Exported reports include the software version and citation automatically.</p>
          <blockquote>{LIBREML_CITATION}</blockquote>
          <button className="button button-quiet button-compact" type="button" onClick={() => void copyCitation()}>
            {copied ? <Check size={15} weight="bold" /> : <Copy size={15} weight="bold" />}
            {copied ? 'Copied' : 'Copy citation'}
          </button>
        </div>
      </aside>
    </div>
  );
}
