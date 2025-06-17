import React from 'react';
import { render, screen } from '@testing-library/react';
import HomePage from '../HomePage';

describe('HomePage', () => {
  it('renders the main heading', () => {
    render(<HomePage />);
    const heading = screen.getByRole('heading', { level: 1 });
    expect(heading).toHaveTextContent('Clanker Tools');
  });

  it('renders the subtitle', () => {
    render(<HomePage />);
    const subtitle = screen.getByText(/Your gateway to Clanker v4 deployment and management/i);
    expect(subtitle).toBeInTheDocument();
  });

  it('renders three feature cards', () => {
    render(<HomePage />);
    const cards = screen.getAllByTestId('feature-card');
    expect(cards).toHaveLength(3);
  });

  it('renders the configurator card with correct content', () => {
    render(<HomePage />);
    const configuratorCard = screen.getByTestId('configurator-card');
    expect(configuratorCard).toBeInTheDocument();
    
    const heading = configuratorCard.querySelector('[data-slot="card-title"]');
    expect(heading).toHaveTextContent('Clanker v4 Configurator');
    
    const description = configuratorCard.querySelector('[data-slot="card-description"]');
    expect(description).toHaveTextContent(/Easily configure and deploy your Clanker v4 instance/i);
    
    const button = configuratorCard.querySelector('a');
    expect(button).toHaveAttribute('href', '/configurator');
    expect(button).toHaveTextContent('Launch Configurator');
  });

  it('renders the documentation card with correct content', () => {
    render(<HomePage />);
    const docsCard = screen.getByTestId('docs-card');
    expect(docsCard).toBeInTheDocument();
    
    const heading = docsCard.querySelector('[data-slot="card-title"]');
    expect(heading).toHaveTextContent('Documentation');
    
    const description = docsCard.querySelector('[data-slot="card-description"]');
    expect(description).toHaveTextContent(/Learn how to use Clanker v4/i);
    
    const button = docsCard.querySelector('a');
    expect(button).toHaveAttribute('href', '/docs');
    expect(button).toHaveTextContent('View Docs');
  });

  it('renders the SDK examples card with correct content', () => {
    render(<HomePage />);
    const sdkCard = screen.getByTestId('sdk-card');
    expect(sdkCard).toBeInTheDocument();
    
    const heading = sdkCard.querySelector('[data-slot="card-title"]');
    expect(heading).toHaveTextContent('SDK Examples');
    
    const description = sdkCard.querySelector('[data-slot="card-description"]');
    expect(description).toHaveTextContent(/Explore code examples/i);
    
    const button = sdkCard.querySelector('a');
    expect(button).toHaveAttribute('href', '/sdk-examples');
    expect(button).toHaveTextContent('Browse Examples');
  });

  it('has proper responsive classes', () => {
    render(<HomePage />);
    const container = screen.getByTestId('homepage-container');
    expect(container).toHaveClass('container', 'mx-auto', 'px-4');
    
    const grid = screen.getByTestId('cards-grid');
    expect(grid).toHaveClass('grid', 'md:grid-cols-3', 'gap-6');
  });

  it('renders with proper accessibility structure', () => {
    render(<HomePage />);
    
    // Should have a main landmark
    const main = screen.getByRole('main');
    expect(main).toBeInTheDocument();
    
    // Should have one h1
    const h1 = screen.getByRole('heading', { level: 1 });
    expect(h1).toBeInTheDocument();
    
    // Should have three cards with titles
    const configuratorCard = screen.getByTestId('configurator-card');
    const docsCard = screen.getByTestId('docs-card');
    const sdkCard = screen.getByTestId('sdk-card');
    
    [configuratorCard, docsCard, sdkCard].forEach(card => {
      const title = card.querySelector('[data-slot="card-title"]');
      expect(title).toBeInTheDocument();
    });
  });
});