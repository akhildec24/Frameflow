import { useCallback, useEffect, useState } from 'react';
import { deleteProject, listProjectSummaries, saveProject } from '../../storage/projectRepository';
import { ensureSeedProject } from './seedProject';
import type { ProjectSummary } from '../../lib/types';

export function useProjects() {
  const [summaries, setSummaries] = useState<ProjectSummary[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const list = await listProjectSummaries();
    setSummaries(list);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await ensureSeedProject();
      if (cancelled) return;
      await refresh();
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  const remove = useCallback(
    async (id: string) => {
      await deleteProject(id);
      await refresh();
    },
    [refresh],
  );

  return { summaries, loading, refresh, remove, saveProject };
}
