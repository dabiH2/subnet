'use client';

import type React from 'react';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { Header } from '@/components/header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import type { Agent } from '@/lib/types';
import { AVAILABLE_TOOLS } from '@/lib/types';
import ReactMarkdown from 'react-markdown';
import { parse } from 'partial-json';
import { cn } from '@/lib/utils';
import { LoaderCircle, Eye } from 'lucide-react';
import { buildAgentSharePath } from '@/lib/slugify';
import AgentParamForm, { AgentParamFormHandle } from '@/components/agent-param-form';
import { extractVarsAndBody, applyVars } from '@/lib/vars';
import ShareChooser from '@/components/share-chooser';


export default function RunAgentPage() {
  const params = useParams();
  const router = useRouter();
  const search = useSearchParams();

  const [agent, setAgent] = useState<Agent | null>(null);
  const [result, setResult] = useState<any | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [showPrompt, setShowPrompt] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [paramValues, setParamValues] = useState<Record<string, string>>({});
  const [shareOpen, setShareOpen] = useState(false);
  const [shareBaseUrl, setShareBaseUrl] = useState('');
  const [shareParamsUrl, setShareParamsUrl] = useState('');
  const [changedKeys, setChangedKeys] = useState<string[]>([]);
  const reasoningRef = useRef<HTMLPreElement>(null);

  const handleShare = () => {
    if (!agent) return;

    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const baseUrl = `${origin}${buildAgentSharePath(agent.id, agent.title)}`;

    const hasParams = paramRef.current?.hasParams?.() ?? false;
    const values = paramRef.current?.getValues?.() ?? {};
    const defaults = paramRef.current?.getDefaults?.() ?? {};

    if (!hasParams) {
      navigator.clipboard.writeText(baseUrl).then(
        () => alert('Share link copied to clipboard!'),
        () => alert('Could not copy link.')
      );
      return;
    }

    const changed = Object.keys(values).filter((k) => (values[k] ?? '') !== (defaults[k] ?? ''));
    if (changed.length === 0) {
      navigator.clipboard.writeText(baseUrl).then(
        () => alert('Share link copied to clipboard!'),
        () => alert('Could not copy link.')
      );
      return;
    }

    const qs = new URLSearchParams(Object.fromEntries(changed.map((k) => [k, values[k]]))).toString();
    const paramsUrl = `${origin}/run/${agent.id}?${qs}`;

    setShareBaseUrl(baseUrl);
    setShareParamsUrl(paramsUrl);
    setChangedKeys(changed);
    setShareOpen(true); // ✅ open in-UI dialog
  };

  const handleFork = () => {
    if (!agent) return;
    router.push(`/create?from=${agent.id}`);
  };

  const getToolLabel = (toolValue: string) =>
    AVAILABLE_TOOLS.find((t) => t.value === toolValue)?.label || toolValue;

  const paramRef = useRef<AgentParamFormHandle>(null);

  useEffect(() => {
    async function fetchAgent() {
      const id = params.id as string;
      try {
        const response = await fetch(`/api/agents/${id}`);
        if (!response.ok) {
          router.push('/');
          return;
        }
        const data = await response.json();
        setAgent(data);
      } catch (error) {
        console.error('Error fetching agent:', error);
        router.push('/');
      }
    }
    fetchAgent();
  }, [params.id, router]);

  // Strip VARS block for display and for preview base
  const instructionBody = useMemo(
    () => extractVarsAndBody(agent?.prompt ?? '').body,
    [agent?.prompt]
  );

  // Build URL prefill object once
  const urlPrefill = useMemo(() => {
    const obj: Record<string, string> = {};
    if (!search) return obj;
    search.forEach((v, k) => { obj[k] = v; });
    return obj;
  }, [search]);

  // Scroll to bottom when result updates
  useEffect(() => {
    if (reasoningRef.current) {
      reasoningRef.current.scrollTop = reasoningRef.current.scrollHeight;
    }
  }, [result]);

  const handleRun = async () => {
    if (isRunning || !agent) return;
    setIsRunning(true);
    setResult('');

    try {
      const overridePrompt = paramRef.current?.getOverridePrompt(); // null if no/invalid params
      const body = { ...(overridePrompt ? { overridePrompt } : {}) };

      const response = await fetch(`/api/agents/${agent.id}/run`, {
        method: 'POST',
        body: JSON.stringify(body),
      });

      if (!response.ok) throw new Error('Failed to start agent');

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response body');

      const decoder = new TextDecoder();
      let accumulatedText = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        accumulatedText += chunk;
        setResult(parse(accumulatedText));
      }
      setIsRunning(false);
    } catch (error) {
      console.error('Error running agent:', error);
      setResult('Error: Failed to run agent. Please try again.');
      setIsRunning(false);
    }
  };

  const handleReset = () => setResult('');

  // Live "effective prompt" preview
  const effectivePrompt = useMemo(() => {
    // If there are no params, this simply equals the instructionBody
    if (!instructionBody) return '';
    return applyVars(instructionBody, paramValues || {});
  }, [instructionBody, paramValues]);

  if (!agent) return null;

  return (
    <div className="bg-background min-h-screen">
      <Header />
      <main className="container mx-auto max-w-4xl px-4 py-6">
        <ShareChooser
          open={shareOpen}
          onOpenChange={setShareOpen}
          baseUrl={shareBaseUrl}
          paramsUrl={shareParamsUrl}
          changedKeys={changedKeys}
        />
        <Card>
          <CardHeader className="pb-3">
            <div className="mb-2 flex items-start justify-between">
              <div className="flex-1">
                <CardTitle className="mb-1 text-xl">{agent.title}</CardTitle>
                <p className="text-muted-foreground text-sm">{agent.description}</p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => router.push('/')}>
                Back
              </Button>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {agent.tools.map((tool) => (
                <Badge key={tool} variant="secondary" className="text-xs">
                  {getToolLabel(tool)}
                </Badge>
              ))}
            </div>

            <div className="mt-2 flex items-center gap-2">
              <Button variant="secondary" onClick={handleFork}>Fork</Button>
              <Button variant="outline" onClick={handleShare}>Share</Button>
            </div>
          </CardHeader>

          <CardContent className="space-y-4">
            {/* Params with URL prefill + live values */}
            {agent?.prompt && (
              <AgentParamForm
                ref={paramRef}
                prompt={agent.prompt}
                urlPrefill={urlPrefill}
                onValuesChange={setParamValues}
              />
            )}

            <div className="flex items-center gap-2">
              <Collapsible open={showPrompt} onOpenChange={setShowPrompt}>
                <CollapsibleTrigger asChild>
                  <Button variant="outline" size="sm" className="text-xs text-muted-foreground hover:text-foreground">
                    {showPrompt ? 'Hide' : 'Show'} Instruction Set
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-2">
                  <div className="prose prose-sm text-foreground bg-muted/50 max-h-96 max-w-none overflow-y-auto rounded-md border p-3 text-xs">
                    <ReactMarkdown>{instructionBody}</ReactMarkdown>
                  </div>
                </CollapsibleContent>
              </Collapsible>

              <Button
                variant={showPreview ? 'default' : 'outline'}
                size="sm"
                className="text-xs"
                onClick={() => setShowPreview((s) => !s)}
              >
                <Eye className="mr-2 h-3 w-3" />
                {showPreview ? 'Hide' : 'Preview'} Effective Prompt
              </Button>
            </div>

            {showPreview && (
              <div className="prose prose-sm text-foreground bg-muted/50 max-h-96 max-w-none overflow-y-auto rounded-md border p-3 text-xs">
                <pre className="whitespace-pre-wrap">{effectivePrompt}</pre>
              </div>
            )}

            <div className="border-t pt-4">
              <div className="mb-4 flex gap-2">
                <Button
                  onClick={handleRun}
                  disabled={isRunning}
                  className="bg-primary hover:bg-primary/90 text-primary-foreground cursor-pointer"
                >
                  {isRunning ? 'Running...' : 'Run Agent'}
                </Button>
                {result && (
                  <Button variant="outline" onClick={handleReset} disabled={isRunning}>
                    Reset
                  </Button>
                )}
              </div>

              {result && (
                <div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className={cn('mb-2 text-sm font-semibold', isRunning && 'animate-pulse text-gray-400')}>
                        Reasoning & Tool Usage
                      </h3>
                      {isRunning && <LoaderCircle className="mb-2 h-4 w-4 animate-spin text-gray-400" />}
                    </div>
                    <div className="prose prose-sm text-foreground bg-muted/50 max-w-none rounded-md border p-3">
                      <pre ref={reasoningRef} className="bg-background max-h-[200px] overflow-y-auto rounded p-2 text-xs">
                        <code>{JSON.stringify(result?.reasoning, null, 2)}</code>
                      </pre>
                    </div>
                  </div>

                  {result?.answer && (
                    <div className="mt-4">
                      <h3 className="mb-2 text-sm font-semibold">Final Result</h3>
                      <div className="prose prose-sm text-foreground bg-muted/50 max-w-none rounded-md border p-3">
                        <ReactMarkdown>{result?.answer}</ReactMarkdown>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
