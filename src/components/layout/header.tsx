import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Music, PlusSquare } from 'lucide-react';

export default function Header() {
  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 items-center">
        <Link href="/" className="mr-6 flex items-center space-x-2">
          <Music className="h-6 w-6 text-accent" />
          <span className="font-bold">Mused</span> {/* Updated app name */}
        </Link>
        <nav className="flex flex-1 items-center space-x-4">
          <Link href="/" passHref>
            <Button variant="ghost">Home</Button>
          </Link>
          <Link href="/create" passHref>
             <Button variant="ghost">
                <PlusSquare className="mr-2 h-4 w-4" />
                Create Fragment
            </Button>
          </Link>
        </nav>
        {/* Placeholder for User Profile/Auth */}
        {/* <div className="flex items-center space-x-4">
          <Button>Login</Button>
        </div> */}
      </div>
    </header>
  );
}
