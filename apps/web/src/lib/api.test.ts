import { afterEach, describe, expect, it, vi } from 'vitest';

import { libreMlApi } from './api';

describe('local API response handling', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('reads HTML reports as text instead of JSON', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response('<!doctype html><title>Research report</title>', {
        status: 200,
        headers: { 'Content-Type': 'text/html' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const report = await libreMlApi.getReport('project-1', 'report-node-7', 'html');
    expect(report).toContain('<title>Research report</title>');
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/projects/project-1/reports/report-node-7?format=html',
      expect.any(Object),
    );
  });
});
