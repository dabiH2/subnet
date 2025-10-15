'use client';

import Link from 'next/link';
import type { Agent } from '@/lib/types';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Trash2 } from 'lucide-react';
import { useState } from 'react';
import { AVAILABLE_TOOLS } from '@/lib/types';
import { useRouter } from 'next/navigation';
import { buildAgentSharePath } from '@/lib/slugify';



interface AgentCardProps {
  agent: Agent;
  onDelete?: (agentId: string) => void;
}

export function AgentCard({ agent, onDelete }: AgentCardProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const router = useRouter();

  const handleShare = async () => {
    try {
      const url =
        typeof window !== 'undefined'
          ? `${window.location.origin}${buildAgentSharePath(agent.id, agent.title)}`
          : buildAgentSharePath(agent.id, agent.title);
      await navigator.clipboard.writeText(url);
      alert('Share link copied to clipboard!');
    } catch {
      alert('Could not copy link. Please copy it from the share page.');
    }
  };

  const handleFork = () => {
    router.push(`/create?from=${agent.id}`);
  };


  const handleDelete = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!confirm(`Are you sure you want to delete "${agent.title}"?`)) {
      return;
    }

    setIsDeleting(true);
    try {
      const response = await fetch(`/api/agents/${agent.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete agent');
      }

      onDelete?.(agent.id);
    } catch (error) {
      console.error('Error deleting agent:', error);
      alert('Failed to delete agent. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Card className="relative">
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <CardTitle className="text-xl">{agent.title}</CardTitle>
            <CardDescription className="line-clamp-2">{agent.description}</CardDescription>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 h-8 w-8 shrink-0"
            onClick={handleDelete}
            disabled={isDeleting}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex gap-2">
          <p className="text-muted-foreground text-sm font-medium">Tools:</p>
          <div className="flex flex-wrap gap-2">
            {agent.tools.slice(0, 2).map((tool) => (
              <Badge key={tool} variant="secondary" className="text-xs">
                {AVAILABLE_TOOLS.find((t) => t.value === tool)?.label}
              </Badge>
            ))}
            {agent.tools.length > 2 && (
              <Badge variant="secondary" className="text-xs">
                +{agent.tools.length - 2}
              </Badge>
            )}
          </div>
        </div>
      </CardContent>
      <CardFooter className="flex gap-2">
        <Link href={`/run/${agent.id}`} className="flex-1">
          <Button className="bg-primary hover:bg-primary/90 text-primary-foreground w-full">
            View Agent
          </Button>
        </Link>
        <Button variant="secondary" onClick={handleFork}>
          Fork
        </Button>
        <Button variant="outline" onClick={handleShare}>
          Share
        </Button>
      </CardFooter>
    </Card>
  );
}
