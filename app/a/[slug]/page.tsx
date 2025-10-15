import Link from 'next/link';
import { notFound } from 'next/navigation';
import { db } from '@/db';
import { agentsTable } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AVAILABLE_TOOLS } from '@/lib/types';
import { buildAgentSharePath } from '@/lib/slugify';
import { ShareButton, ForkButton } from '@/components/agent-share-controls';
import { extractVarsAndBody } from '@/lib/vars';

async function getAgentById(id: number) {
  const rows = await db.select().from(agentsTable).where(eq(agentsTable.id, id)).limit(1);
  const a = rows[0];
  if (!a) return null;
  return {
    id: a.id.toString(),
    title: a.name,
    description: a.description,
    prompt: a.prompt,
    tools: (Array.isArray(a.tools) ? (a.tools as unknown as string[]) : []) || [],
  };
}

export default async function ShareAgentPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params; // Next 15
  const firstDash = slug.indexOf('-');
  const idPart = firstDash === -1 ? slug : slug.slice(0, firstDash);
  const idNum = Number(idPart);
  if (!idPart || Number.isNaN(idNum)) notFound();

  const agent = await getAgentById(idNum);
  if (!agent) notFound();

  const prettyPath = buildAgentSharePath(agent.id, agent.title);
  const { vars, body } = extractVarsAndBody(agent.prompt || '');

  return (
    <div className="bg-background min-h-screen">
      <main className="container mx-auto px-4 py-8 max-w-3xl">
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-3xl">{agent.title}</CardTitle>
            <p className="text-muted-foreground mt-2">{agent.description}</p>
          </CardHeader>

          <CardContent>
            <div className="mb-4">
              <h3 className="mb-2 font-semibold">Configured tools</h3>
              <div className="flex flex-wrap gap-2">
                {agent.tools.length === 0 ? (
                  <span className="text-muted-foreground text-sm">No tools selected</span>
                ) : (
                  agent.tools.map((t) => {
                    const meta = AVAILABLE_TOOLS.find((x) => x.value === t);
                    return <Badge key={t}>{meta?.label ?? t}</Badge>;
                  })
                )}
              </div>
            </div>

            {vars && Object.keys(vars).length > 0 && (
              <div className="mb-4">
                <h3 className="mb-2 font-semibold">Parameters</h3>
                <ul className="list-disc pl-5 text-sm">
                  {Object.entries(vars).map(([name, spec]) => (
                    <li key={name}>
                      <span className="font-medium">{spec.label ?? name}</span>
                      <span className="text-muted-foreground"> ({name}{spec.required ? ', required' : ''})</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-3">
              <Link href={`/run/${agent.id}`}>
                <button className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground h-10 px-4 py-2 cursor-pointer">
                  Run this agent
                </button>
              </Link>
              <ForkButton id={agent.id} />
              <ShareButton id={agent.id} title={agent.title} />
            </div>

            <div className="mt-6">
              <h3 className="mb-2 font-semibold">Prompt (preview)</h3>
              <pre className="bg-muted text-sm p-3 rounded-md whitespace-pre-wrap">{body}</pre>
            </div>

            <div className="mt-6 text-xs text-muted-foreground">
              Share URL: <code>{prettyPath}</code>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
