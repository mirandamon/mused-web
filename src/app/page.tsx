import FragmentPost from '@/components/fragments/fragment-post';
import type { Fragment } from '@/lib/types';
import { placeholderFragments } from '@/lib/placeholder-data';

export default function Home() {
  // TODO: Replace with actual data fetching
  const fragments: Fragment[] = placeholderFragments;

  return (
    <div className="space-y-8 max-w-2xl mx-auto">
      {fragments.length > 0 ? (
        fragments.map((fragment) => (
          <FragmentPost key={fragment.id} fragment={fragment} />
        ))
      ) : (
        <p className="text-center text-muted-foreground">No fragments yet. Be the first to create one!</p>
      )}
    </div>
  );
}
