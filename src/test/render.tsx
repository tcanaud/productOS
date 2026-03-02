import React from 'react';
import { render, type RenderOptions } from '@testing-library/react';
import { Toaster } from 'sonner';

// Mock SessionProvider for tests — avoids real NextAuth network calls
const MockSessionProvider = ({ children }: { children: React.ReactNode }) => {
  return <>{children}</>;
};

function AllProviders({ children }: { children: React.ReactNode }) {
  return (
    <MockSessionProvider>
      {children}
      <Toaster />
    </MockSessionProvider>
  );
}

function customRender(ui: React.ReactElement, options?: Omit<RenderOptions, 'wrapper'>) {
  return render(ui, { wrapper: AllProviders, ...options });
}

export * from '@testing-library/react';
export { customRender as render };
