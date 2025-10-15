'use client';

import type React from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Header } from '@/components/header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { AVAILABLE_TOOLS } from '@/lib/types';
import { Separator } from '@/components/ui/separator';
import { extractVarsAndBody, buildPromptWithVars, VarsDict } from '@/lib/vars';
import ParamBuilder, { ParamEntry } from '@/components/param-builder';

type AgentDTO = {
  id: string;
  title: string;
  description: string;
  prompt: string;
  tools: string[];
};

export default function CreatePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const fromId = useMemo(() => searchParams.get('from'), [searchParams]);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [promptBody, setPromptBody] = useState('');
  const [paramsEntries, setParamsEntries] = useState<ParamEntry[]>([]);
  const [selectedTools, setSelectedTools] = useState<string[]>([]);
  const [prefillLoading, setPrefillLoading] = useState(false);
  const [prefillError, setPrefillError] = useState<string | null>(null);
  const promptRef = useRef<HTMLTextAreaElement>(null);

  // Prefill when ?from=<id> is present
  useEffect(() => {
    const prefill = async () => {
      if (!fromId) return;
      setPrefillLoading(true);
      setPrefillError(null);
      try {
        const res = await fetch(`/api/agents/${fromId}`, { cache: 'no-store' });
        if (!res.ok) throw new Error(`Failed to load source agent (id: ${fromId})`);
        const data: AgentDTO = await res.json();

        const { vars, body } = extractVarsAndBody(data.prompt ?? '');

        setTitle(`Copy of ${data.title ?? ''}`.trim());
        setDescription(data.description ?? '');
        setPromptBody(body ?? '');
        setSelectedTools(Array.isArray(data.tools) ? data.tools : []);

        if (vars && Object.keys(vars).length) {
          const entries: ParamEntry[] = Object.entries(vars).map(([name, spec]) => ({ name, spec }));
          setParamsEntries(entries);
        } else {
          setParamsEntries([]);
        }
      } catch (e: any) {
        console.error(e);
        setPrefillError(e?.message ?? 'Could not prefill from source agent.');
      } finally {
        setPrefillLoading(false);
      }
    };
    prefill();
  }, [fromId]);

  const handleToolToggle = (tool: string) => {
    setSelectedTools((prev) => (prev.includes(tool) ? prev.filter((t) => t !== tool) : [...prev, tool]));
  };

  const insertTokenAtCursor = (name: string) => {
    const ta = promptRef.current;
    if (!ta) return;
    const token = `{${name}}`;
    const start = ta.selectionStart ?? ta.value.length;
    const end = ta.selectionEnd ?? ta.value.length;
    const before = ta.value.slice(0, start);
    const after = ta.value.slice(end);
    const next = before + token + after;
    setPromptBody(next);
    // restore caret
    queueMicrotask(() => {
      ta.focus();
      const pos = start + token.length;
      ta.setSelectionRange(pos, pos);
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Build VarsDict from entries
    const vars: VarsDict =
      paramsEntries.length > 0
        ? Object.fromEntries(paramsEntries.map((e) => [e.name, e.spec]))
        : ({} as VarsDict);

    const agent = {
      title,
      description,
      prompt: buildPromptWithVars(Object.keys(vars).length ? vars : null, promptBody),
      tools: selectedTools,
    };

    try {
      const response = await fetch('/api/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(agent),
      });
      if (!response.ok) throw new Error('Failed to create agent');
      router.push('/');
    } catch (error) {
      console.error('Error creating agent:', error);
      alert('Failed to create agent. Please try again.');
    }
  };

  return (
    <div className="bg-background min-h-screen">
      <Header />
      <main className="container mx-auto max-w-3xl px-4 py-8">
        <div className="mb-8">
          <h1 className="text-foreground mb-2 text-4xl font-bold">
            {fromId ? 'Fork & Edit Agent' : 'Create New Agent'}
          </h1>
          <p className="text-muted-foreground">
            {fromId
              ? 'We pre-filled this form from the original agent. Make your edits and save your own copy.'
              : 'Configure your Subconscious agent with instructions and search tools'}
          </p>
          {fromId && (
            <p className="text-xs text-muted-foreground mt-2">
              Loaded from agent <code>#{fromId}</code>
              {prefillLoading ? ' — loading…' : prefillError ? ` — ${prefillError}` : ''}
            </p>
          )}
        </div>

        <Card>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="prompt">Agent Instructions (Prompt Body)</Label>
                <Textarea
                  id="prompt"
                  ref={promptRef}
                  value={promptBody}
                  onChange={(e) => setPromptBody(e.target.value)}
                  placeholder="You are a search assistant that can use tools to find information. I want you to..."
                  rows={10}
                  className="font-mono text-sm"
                  required
                  disabled={prefillLoading}
                />
              </div>

              {/* New visual parameter builder */}
              <ParamBuilder
                value={paramsEntries}
                onChange={setParamsEntries}
                onInsertToken={insertTokenAtCursor}
              />

              <div className="space-y-3">
                <Label>Available Tools</Label>
                <div className="space-y-3">
                  {AVAILABLE_TOOLS.map((tool) => (
                    <div key={tool.value} className="flex items-center space-x-2">
                      <Checkbox
                        id={tool.value}
                        checked={selectedTools.includes(tool.value)}
                        onCheckedChange={() => handleToolToggle(tool.value)}
                        disabled={prefillLoading}
                      />
                      <label
                        htmlFor={tool.value}
                        className="cursor-pointer text-sm leading-none font-medium peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                      >
                        {tool.label}
                      </label>
                    </div>
                  ))}
                </div>
              </div>

              <Separator />
              <div className="text-muted-foreground text-sm">
                This information is purely to make your agent discoverable.
              </div>

              <div className="space-y-2">
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., Research Assistant"
                  required
                  disabled={prefillLoading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Brief description of what this agent does so a human can understand why they would use it."
                  rows={3}
                  required
                  disabled={prefillLoading}
                />
              </div>

              <div className="flex gap-4 pt-4">
                <Button type="submit" className="bg-primary hover:bg-primary/90 text-primary-foreground flex-1 cursor-pointer" disabled={prefillLoading}>
                  {fromId ? 'Create Fork' : 'Create Agent'}
                </Button>
                <Button type="button" variant="outline" onClick={() => router.push('/')} className="flex-1 cursor-pointer">
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
