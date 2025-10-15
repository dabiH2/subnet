'use client';

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export default function ShareChooser({
  open,
  onOpenChange,
  baseUrl,
  paramsUrl,
  changedKeys = [],
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  baseUrl: string;
  paramsUrl: string;
  changedKeys?: string[];
}) {
  const copy = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      onOpenChange(false);
      alert('Share link copied to clipboard!');
    } catch {
      onOpenChange(false);
      alert('Could not copy link.');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Share this agent</DialogTitle>
          <DialogDescription>
            Choose what your recipient should see when opening the link.
          </DialogDescription>
        </DialogHeader>

        {changedKeys.length > 0 && (
          <div className="mb-2 text-xs">
            Modified parameters:{' '}
            {changedKeys.map((k) => (
              <Badge key={k} variant="secondary" className="mr-1">{k}</Badge>
            ))}
          </div>
        )}

        <div className="grid gap-3">
          <div className="rounded-md border p-3">
            <div className="mb-2 text-sm font-medium">Base version</div>
            <p className="mb-3 text-xs text-muted-foreground">
              Shares the public page for this agent. Recipients can run or fork it and choose their own values.
            </p>
            <Button className="w-full" onClick={() => copy(baseUrl)}>Copy base link</Button>
          </div>

          <div className="rounded-md border p-3">
            <div className="mb-2 text-sm font-medium">Include current values</div>
            <p className="mb-3 text-xs text-muted-foreground">
              Shares a direct <code>/run</code> link with your current parameters pre-filled.
            </p>
            <Button variant="secondary" className="w-full" onClick={() => copy(paramsUrl)}>
              Copy link with current values
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
