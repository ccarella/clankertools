export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-8 bg-background">
      <main className="mx-auto max-w-4xl text-center">
        <h1 className="mb-8 text-4xl font-bold text-foreground sm:text-5xl">
          Welcome to Clanker Tools
        </h1>
        <p className="mb-12 text-lg text-muted-foreground">
          Your comprehensive platform for Clanker token management and creation.
          Explore powerful tools designed to streamline your token operations.
        </p>
        <div className="rounded-lg bg-card p-8">
          <h2 className="mb-4 text-2xl font-semibold text-card-foreground">
            Getting Started
          </h2>
          <p className="text-muted-foreground">
            Use the menu to navigate through different tools and features.
            More features and tools will be added soon!
          </p>
        </div>
      </main>
    </div>
  );
}
