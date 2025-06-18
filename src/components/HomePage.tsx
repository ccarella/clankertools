import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function HomePage() {
  return (
    <main className="min-h-screen py-12">
      <div data-testid="homepage-container" className="container mx-auto px-4">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4">Clanker Tools</h1>
          <p className="text-lg text-muted-foreground">
            Your gateway to Clanker v4 deployment and management
          </p>
          <div className="mt-6">
            <Button asChild variant="ghost" size="sm">
              <Link href="/profile">View Profile</Link>
            </Button>
          </div>
        </div>

        <div data-testid="cards-grid" className="grid md:grid-cols-3 gap-6">
          <div data-testid="feature-card">
            <Card data-testid="configurator-card" className="flex flex-col h-full">
              <CardHeader>
                <CardTitle>Clanker v4 Configurator</CardTitle>
                <CardDescription>
                  Easily configure and deploy your Clanker v4 instance with our intuitive interface
                </CardDescription>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col justify-end">
                <Button asChild className="w-full">
                  <Link href="/configurator">Launch Configurator</Link>
                </Button>
              </CardContent>
            </Card>
          </div>

          <div data-testid="feature-card">
            <Card data-testid="docs-card" className="flex flex-col h-full">
              <CardHeader>
                <CardTitle>Documentation</CardTitle>
                <CardDescription>
                  Learn how to use Clanker v4 with comprehensive guides and API references
                </CardDescription>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col justify-end">
                <Button asChild variant="secondary" className="w-full">
                  <Link href="/docs">View Docs</Link>
                </Button>
              </CardContent>
            </Card>
          </div>

          <div data-testid="feature-card">
            <Card data-testid="sdk-card" className="flex flex-col h-full">
              <CardHeader>
                <CardTitle>SDK Examples</CardTitle>
                <CardDescription>
                  Explore code examples and integrations for the Clanker SDK
                </CardDescription>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col justify-end">
                <Button asChild variant="outline" className="w-full">
                  <Link href="/sdk-examples">Browse Examples</Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </main>
  );
}