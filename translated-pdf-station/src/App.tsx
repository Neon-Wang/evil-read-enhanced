/**
 * @file App.tsx
 * @description Translated PDF batch download station.
 */

import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Database,
  Download,
  FileArchive,
  FileText,
  RefreshCw,
} from 'lucide-react';

import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/shared/ui/table';

type RunSummary = {
  run_id: string;
  date: string;
  status: string;
  file_count: number;
  zip_size_bytes: number;
  zip_sha256: string;
  zip_path: string;
  download_url: string;
};

type RunItem = {
  run_id: string;
  date: string;
  zotero_key: string;
  title: string;
  source_pdf: string;
  zh_pdf: string;
  zh_sha256: string;
  size_bytes: string;
  mtime_utc: string;
  zip_path: string;
  zip_sha256: string;
  status: string;
};

type RunDetails = {
  run: RunSummary;
  items: RunItem[];
};

function formatBytes(value: number | string | undefined): string {
  const bytes = Number(value || 0);
  if (!Number.isFinite(bytes) || bytes <= 0) return '-';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`;
}

function shortHash(value: string): string {
  return value ? `${value.slice(0, 12)}...` : '-';
}

function statusVariant(status: string): 'success' | 'warning' | 'outline' {
  if (status === 'packaged') return 'success';
  if (status === 'no_new_files') return 'warning';
  return 'outline';
}

export default function App() {
  const [runs, setRuns] = useState<RunSummary[]>([]);
  const [selectedRunId, setSelectedRunId] = useState('');
  const [details, setDetails] = useState<RunDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  async function loadRuns(nextSelectedRunId?: string) {
    setIsLoading(true);
    setError('');
    try {
      const response = await fetch('/api/runs');
      if (!response.ok) throw new Error(`GET /api/runs ${response.status}`);
      const payload = (await response.json()) as { runs: RunSummary[] };
      const nextRuns = payload.runs || [];
      setRuns(nextRuns);
      const nextId = nextSelectedRunId || selectedRunId || nextRuns[0]?.run_id || '';
      setSelectedRunId(nextId);
      if (nextId) {
        await loadRunDetails(nextId);
      } else {
        setDetails(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setDetails(null);
    } finally {
      setIsLoading(false);
    }
  }

  async function loadRunDetails(runId: string) {
    const response = await fetch(`/api/runs/${encodeURIComponent(runId)}`);
    if (!response.ok) throw new Error(`GET /api/runs/${runId} ${response.status}`);
    const payload = (await response.json()) as RunDetails;
    setDetails(payload);
  }

  useEffect(() => {
    void loadRuns();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const totals = useMemo(() => {
    return runs.reduce(
      (acc, run) => {
        acc.files += run.file_count || 0;
        acc.bytes += run.zip_size_bytes || 0;
        if (run.status === 'packaged') acc.packaged += 1;
        if (run.status === 'no_new_files') acc.empty += 1;
        return acc;
      },
      { files: 0, bytes: 0, packaged: 0, empty: 0 }
    );
  }, [runs]);

  const selectedRun = details?.run || runs.find((run) => run.run_id === selectedRunId);

  return (
    <div className="min-h-screen bg-[var(--color-background)] text-[var(--color-foreground)]">
      <div className="grid min-h-screen grid-cols-1 lg:grid-cols-[320px_1fr]">
        <aside className="app-nav-shell border-b border-[var(--color-border)] px-4 py-4 lg:border-b-0 lg:border-r">
          <div className="mb-5 flex items-center gap-3">
            <div className="grid size-9 place-items-center rounded-md border border-[var(--color-border)] bg-[var(--color-card)]">
              <FileArchive size={18} aria-hidden />
            </div>
            <div>
              <h1 className="text-base font-semibold">中文 PDF 增量包</h1>
              <p className="text-xs text-[var(--color-muted-foreground)]">code-file.jiashengfan.space</p>
            </div>
          </div>

          <Button
            className="mb-4 w-full justify-center"
            variant="outline"
            size="sm"
            onClick={() => void loadRuns()}
            disabled={isLoading}
          >
            <RefreshCw size={15} aria-hidden />
            刷新批次
          </Button>

          <div className="space-y-2">
            {runs.map((run) => (
              <button
                key={run.run_id}
                className={[
                  'w-full rounded-md border px-3 py-2 text-left transition-colors',
                  run.run_id === selectedRunId
                    ? 'border-[var(--color-primary)] bg-[var(--color-accent)]'
                    : 'border-[var(--color-border)] bg-[var(--color-card)] hover:bg-[var(--color-muted)]',
                ].join(' ')}
                onClick={() => {
                  setSelectedRunId(run.run_id);
                  void loadRunDetails(run.run_id).catch((err: unknown) => {
                    setError(err instanceof Error ? err.message : String(err));
                  });
                }}
              >
                <div className="mb-1 flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-medium">{run.run_id}</span>
                  <Badge variant={statusVariant(run.status)}>{run.status}</Badge>
                </div>
                <div className="flex items-center justify-between text-xs text-[var(--color-muted-foreground)]">
                  <span>{run.date}</span>
                  <span>{run.file_count} files</span>
                </div>
              </button>
            ))}
          </div>
        </aside>

        <main className="px-5 py-5 lg:px-8">
          <section className="mb-5 flex flex-col gap-3 border-b border-[var(--color-border)] pb-5 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-[var(--color-muted-foreground)]">
                <Database size={14} aria-hidden />
                Manifest-backed download station
              </div>
              <h2 className="text-2xl font-semibold tracking-normal">Translated Zotero PDF Runs</h2>
            </div>
            {selectedRun?.download_url && selectedRun.status === 'packaged' ? (
              <Button asChild>
                <a href={selectedRun.download_url}>
                  <Download size={16} aria-hidden />
                  下载当前批次
                </a>
              </Button>
            ) : (
              <Button disabled variant="secondary">
                <Download size={16} aria-hidden />
                无可下载 zip
              </Button>
            )}
          </section>

          {error ? (
            <div className="mb-5 flex items-start gap-3 rounded-md border border-[var(--color-destructive)] bg-[var(--color-card)] p-4">
              <AlertTriangle size={18} aria-hidden className="mt-0.5 text-[var(--color-destructive)]" />
              <div>
                <div className="font-medium">读取 manifest 失败</div>
                <div className="text-sm text-[var(--color-muted-foreground)]">{error}</div>
              </div>
            </div>
          ) : null}

          <section className="mb-5 grid gap-3 md:grid-cols-4">
            <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-card)] p-4">
              <div className="text-xs text-[var(--color-muted-foreground)]">批次数</div>
              <div className="mt-1 text-2xl font-semibold">{runs.length}</div>
            </div>
            <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-card)] p-4">
              <div className="text-xs text-[var(--color-muted-foreground)]">已打包批次</div>
              <div className="mt-1 text-2xl font-semibold">{totals.packaged}</div>
            </div>
            <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-card)] p-4">
              <div className="text-xs text-[var(--color-muted-foreground)]">累计译文 PDF</div>
              <div className="mt-1 text-2xl font-semibold">{totals.files}</div>
            </div>
            <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-card)] p-4">
              <div className="text-xs text-[var(--color-muted-foreground)]">Zip 总量</div>
              <div className="mt-1 text-2xl font-semibold">{formatBytes(totals.bytes)}</div>
            </div>
          </section>

          <section className="rounded-md border border-[var(--color-border)] bg-[var(--color-card)]">
            <div className="flex items-center justify-between gap-3 border-b border-[var(--color-border)] px-4 py-3">
              <div>
                <h3 className="text-sm font-semibold">批次明细</h3>
                <p className="text-xs text-[var(--color-muted-foreground)]">
                  {selectedRun ? `${selectedRun.run_id} · ${selectedRun.status}` : '暂无批次'}
                </p>
              </div>
              {selectedRun ? <Badge variant={statusVariant(selectedRun.status)}>{selectedRun.status}</Badge> : null}
            </div>

            {isLoading ? (
              <div className="p-8 text-sm text-[var(--color-muted-foreground)]">正在读取 manifest...</div>
            ) : !selectedRun ? (
              <div className="p-8 text-sm text-[var(--color-muted-foreground)]">manifest 暂无批次记录。</div>
            ) : selectedRun.status === 'no_new_files' ? (
              <div className="flex items-start gap-3 p-8 text-sm text-[var(--color-muted-foreground)]">
                <CheckCircle2 size={18} aria-hidden className="mt-0.5 text-[var(--color-warning)]" />
                <span>本批次没有新增或内容变化的中文 PDF，系统未生成空 zip。</span>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Key</TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead>Size</TableHead>
                    <TableHead>Modified</TableHead>
                    <TableHead>SHA256</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(details?.items || []).map((item) => (
                    <TableRow key={`${item.run_id}-${item.zotero_key}-${item.zh_sha256}`}>
                      <TableCell className="font-mono text-xs">{item.zotero_key || '-'}</TableCell>
                      <TableCell>
                        <div className="flex max-w-[38rem] items-center gap-2">
                          <FileText size={15} aria-hidden className="shrink-0 text-[var(--color-muted-foreground)]" />
                          <span className="truncate">{item.title || item.zotero_key || '-'}</span>
                        </div>
                      </TableCell>
                      <TableCell>{formatBytes(item.size_bytes)}</TableCell>
                      <TableCell className="whitespace-nowrap text-xs">{item.mtime_utc || '-'}</TableCell>
                      <TableCell className="font-mono text-xs">{shortHash(item.zh_sha256)}</TableCell>
                      <TableCell>
                        <Badge variant={statusVariant(item.status)}>{item.status}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </section>
        </main>
      </div>
    </div>
  );
}
