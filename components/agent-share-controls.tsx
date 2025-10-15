'use client';

import { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { buildAgentSharePath } from '@/lib/slugify';
import { Button } from '@/components/ui/button';

export function ShareButton({ id, title }: { id: string; title: string }) {
  const onCopy = useCallback(async () => {
    try {
      const url =
        typeof window !== 'undefined'
          ? `${window.location.origin}${buildAgentSharePath(id, title)}`
          : buildAgentSharePath(id, title);
      await navigator.clipboard.writeText(url);
      alert('Share link copied to clipboard!');
    } catch {
      alert('Could not copy link. Please copy from your browser URL bar.');
    }
  }, [id, title]);

  return (
    <Button variant="outline" onClick={onCopy}>
      Share link
    </Button>
  );
}

export function ForkButton({ id }: { id: string }) {
  const router = useRouter();
  return (
    <Button variant="secondary" onClick={() => router.push(`/create?from=${id}`)}>
      Fork
    </Button>
  );
}
