'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';

type GlobalErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function GlobalError({ error, reset }: GlobalErrorProps) {
  useEffect(() => {
    console.error('[Global Error]', error);
  }, [error]);

  return (
    <html lang="en">
      <body className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background p-8 text-center font-sans text-foreground">
        <h1 className="text-2xl font-bold">Something went wrong</h1>
        <p className="text-sm text-muted-foreground">
          A critical error occurred. Please try again or refresh the page.
        </p>
        <Button onClick={reset} variant="outline">
          Try again
        </Button>
      </body>
    </html>
  );
}
