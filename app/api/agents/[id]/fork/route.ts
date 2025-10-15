import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { agentsTable } from '@/db/schema';
import { eq } from 'drizzle-orm';

/**
 * POST /api/agents/:id/fork
 * Creates a new agent by duplicating the source agent's fields.
 * No migrations required (no slug / lineage columns).
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const agentId = parseInt(id, 10);

    if (Number.isNaN(agentId)) {
      return NextResponse.json({ error: 'Invalid agent ID' }, { status: 400 });
    }

    const [source] = await db
      .select()
      .from(agentsTable)
      .where(eq(agentsTable.id, agentId))
      .limit(1);

    if (!source) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
    }

    const [inserted] = await db
      .insert(agentsTable)
      .values({
        name: `Copy of ${source.name}`,
        description: source.description,
        prompt: source.prompt,
        // jsonb in DB → ensure plain array here
        tools: Array.isArray(source.tools) ? (source.tools as unknown as string[]) : [],
      })
      .returning();

    const mapped = {
      id: inserted.id.toString(),
      title: inserted.name,
      description: inserted.description,
      prompt: inserted.prompt,
      tools: (inserted.tools as unknown as string[]) || [],
    };

    return NextResponse.json(mapped, { status: 201 });
  } catch (err) {
    console.error('Error forking agent:', err);
    return NextResponse.json({ error: 'Failed to fork agent' }, { status: 500 });
  }
}
