import FragmentEditor from '@/components/fragments/fragment-editor';

export default function CreateFragmentPage() {
  return (
    <div className="flex flex-col items-center">
      <h1 className="text-3xl font-bold mb-8">Create New Fragment</h1>
      <FragmentEditor />
    </div>
  );
}
