'use client'; // Required for using hooks like useState, useEffect, useQuery

import { useState, useEffect } from 'react';
import { useQuery, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import FragmentPost from '@/components/fragments/fragment-post';
import { Skeleton } from "@/components/ui/skeleton"; // Import Skeleton
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"; // Import Alert
import { Frown } from "lucide-react"; // Import an icon for error/empty state
import type { Fragment } from '@/lib/types'; // Import Fragment type

const queryClient = new QueryClient();

// Define the structure of the API response for fragments
interface FragmentsApiResponse {
  fragments: Fragment[];
  nextPageCursor: string | null;
}

// Function to fetch fragments from the API
const fetchFragments = async (): Promise<FragmentsApiResponse> => {
  const apiUrl = process.env.NEXT_PUBLIC_MUSED_API_URL;
  if (!apiUrl) {
    console.error("Error: NEXT_PUBLIC_MUSED_API_URL is not set.");
    throw new Error("API URL is not configured.");
  }

  const endpoint = `${apiUrl}/fragments?limit=10`; // Fetch initial 10 fragments
  console.log(`Fetching fragments from: ${endpoint}`);

  try {
    const response = await fetch(endpoint);
    if (!response.ok) {
      let errorData;
      try {
        errorData = await response.json();
      } catch (jsonError) {
        errorData = { error: response.statusText || 'Failed to fetch fragments', details: `Status code: ${response.status}` };
      }
      console.error("API Error Response:", errorData);
      throw new Error(errorData.error || `Failed to fetch fragments (Status: ${response.status})`);
    }

    const data: FragmentsApiResponse = await response.json();
    console.log("Successfully fetched fragments:", data.fragments.length);

    // --- Client-side Data Transformation ---
    // Ensure timestamps are Date objects for components like formatDistanceToNow
    const transformedFragments = data.fragments.map(fragment => ({
        ...fragment,
        timestamp: fragment.timestamp ? new Date(fragment.timestamp) : new Date(), // Convert ISO string/server timestamp to Date object
        // comments are fetched separately or might be empty initially
        comments: (fragment.comments || []).map(comment => ({
           ...comment,
           timestamp: comment.timestamp ? new Date(comment.timestamp) : new Date()
        })),
    }));


    return { fragments: transformedFragments, nextPageCursor: data.nextPageCursor };

  } catch (networkError: any) {
    console.error("Network or Fetch Error:", networkError);
    throw new Error(`Failed to connect to the API: ${networkError.message}`);
  }
};

function HomePageContent() {
  const { data, isLoading, isError, error, isFetching } = useQuery<FragmentsApiResponse, Error>({
    queryKey: ['fragments', 'feed'], // Unique key for this query
    queryFn: fetchFragments,
    staleTime: 1000 * 60 * 2, // Refetch fragments after 2 minutes if stale
    refetchOnWindowFocus: false, // Don't refetch just on window focus
  });

  // Loading State
  if (isLoading || isFetching) {
    return (
      <div className="space-y-8 max-w-2xl mx-auto">
        {Array.from({ length: 3 }).map((_, index) => (
          <FragmentPostSkeleton key={index} />
        ))}
      </div>
    );
  }

  // Error State
  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center pt-16">
         <Alert variant="destructive" className="max-w-md">
           <Frown className="h-4 w-4" />
           <AlertTitle>Error Loading Feed</AlertTitle>
           <AlertDescription>
             {error?.message || 'Could not load fragments. Please try again later.'}
           </AlertDescription>
         </Alert>
      </div>
    );
  }

  // Empty State
  if (!data?.fragments || data.fragments.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center pt-16 text-center">
          <Frown className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground">No fragments found yet.</p>
          <p className="text-sm text-muted-foreground">Be the first to create one!</p>
          {/* TODO: Add Link to create page */}
      </div>
    );
  }

  // Success State - Render Fragments
  return (
    <div className="space-y-8 max-w-2xl mx-auto">
      {data.fragments.map((fragment) => (
        <FragmentPost key={fragment.id} fragment={fragment} />
      ))}
      {/* TODO: Add pagination/infinite scroll later using data.nextPageCursor */}
    </div>
  );
}

// Skeleton Component for Fragment Post
function FragmentPostSkeleton() {
  return (
    <div className="border rounded-lg overflow-hidden shadow-md">
      <div className="flex items-center space-x-3 p-4 bg-card">
        <Skeleton className="h-10 w-10 rounded-full" />
        <div className="flex-1 space-y-1">
          <Skeleton className="h-4 w-3/5" />
          <Skeleton className="h-3 w-2/5" />
          <Skeleton className="h-3 w-1/2" />
        </div>
        <Skeleton className="h-8 w-8" />
        <Skeleton className="h-8 w-8" />
      </div>
      <Skeleton className="aspect-square w-full bg-secondary/30" />
      <div className="flex justify-between items-center p-4">
        <div className="flex space-x-2">
          <Skeleton className="h-8 w-16" />
          <Skeleton className="h-8 w-16" />
        </div>
        <Skeleton className="h-8 w-24" />
      </div>
    </div>
  );
}


export default function Home() {
  // Wrap the main content with QueryClientProvider
  return (
    <QueryClientProvider client={queryClient}>
      <HomePageContent />
    </QueryClientProvider>
  );
}