// src/app/remix/[id]/page.tsx
'use client';

import { useParams } from 'next/navigation';
import FragmentEditor from '@/components/fragments/fragment-editor';
import { placeholderFragments } from '@/lib/placeholder-data'; // Use placeholder data
import { useEffect, useState } from 'react';
import type { Fragment } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton'; // Import Skeleton

export default function RemixFragmentPage() {
  const params = useParams();
  const fragmentId = params.id as string;
  const [originalFragment, setOriginalFragment] = useState<Fragment | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Simulate fetching data
    const fetchFragment = () => {
      // TODO: Replace with actual data fetching logic using fragmentId
      const foundFragment = placeholderFragments.find(f => f.id === fragmentId);
      setOriginalFragment(foundFragment || null);
      setLoading(false);
    };

    if (fragmentId) {
      // Simulate network delay
      const timer = setTimeout(fetchFragment, 500);
      return () => clearTimeout(timer);
    } else {
       setLoading(false); // No ID, stop loading
    }
  }, [fragmentId]);

  if (loading) {
    return (
      <div className="flex flex-col items-center">
        <h1 className="text-3xl font-bold mb-8">Remixing Fragment...</h1>
        <div className="flex flex-col items-center space-y-4 w-full max-w-md">
           <Skeleton className="h-8 w-3/4 mb-4" />
           <div className="grid grid-cols-4 gap-2 w-full aspect-square">
            {Array.from({ length: 16 }).map((_, i) => (
              <Skeleton key={i} className="w-full h-full rounded-lg bg-muted" /> // Use muted for skeleton
            ))}
          </div>
          <Skeleton className="h-10 w-1/4 mt-4" />
        </div>
      </div>
    );
  }

  if (!originalFragment) {
    return <p className="text-center text-destructive">Fragment not found.</p>;
  }

  return (
    <div className="flex flex-col items-center">
      <h1 className="text-3xl font-bold mb-8">Remixing: {originalFragment.title || `Fragment by ${originalFragment.author}`}</h1>
      {/* Pass the full pads data including color */}
      <FragmentEditor
         initialPads={originalFragment.pads}
         originalAuthor={originalFragment.author}
         originalFragmentId={originalFragment.id}
      />
    </div>
  );
}
