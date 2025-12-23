'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import WorkflowBuilder from '@/components/features/workflow-builder';
import { workflowApi } from '@/lib/advanced-api';
import type { Workflow } from '@/types/advanced-features';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function WorkflowBuilderPage() {
  const params = useParams();
  const router = useRouter();
  const [workflow, setWorkflow] = useState<Workflow | undefined>();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (params.id && params.id !== 'new') {
      loadWorkflow(params.id as string);
    } else {
      setLoading(false);
    }
  }, [params.id]);

  const loadWorkflow = async (id: string) => {
    try {
      const data = await workflowApi.getWorkflow(id);
      setWorkflow(data);
    } catch (error) {
      console.error('Failed to load workflow:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto py-8">
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Loading workflow...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8">
      <div className="mb-6">
        <Link href="/advanced-features?tab=workflows">
          <Button variant="ghost" size="sm" className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back to Workflows
          </Button>
        </Link>
      </div>
      <WorkflowBuilder workflow={workflow} />
    </div>
  );
}
