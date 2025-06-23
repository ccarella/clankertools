'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { X, Upload } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';

interface WhitelistManagerProps {
  onWhitelistChange: (whitelist: string[]) => void;
  className?: string;
}

export function WhitelistManager({ onWhitelistChange, className }: WhitelistManagerProps) {
  const [whitelist, setWhitelist] = useState<string[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [bulkInput, setBulkInput] = useState('');
  const [showBulkImport, setShowBulkImport] = useState(false);

  const addToWhitelist = (value: string) => {
    const trimmedValue = value.trim();
    if (trimmedValue && !whitelist.includes(trimmedValue)) {
      const newWhitelist = [...whitelist, trimmedValue];
      setWhitelist(newWhitelist);
      onWhitelistChange(newWhitelist);
      setInputValue('');
    }
  };

  const removeFromWhitelist = (value: string) => {
    const newWhitelist = whitelist.filter((item) => item !== value);
    setWhitelist(newWhitelist);
    onWhitelistChange(newWhitelist);
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addToWhitelist(inputValue);
    }
  };

  const handleBulkImport = () => {
    const users = bulkInput
      .split(/[\n,]+/)
      .map((user) => user.trim())
      .filter((user) => user && !whitelist.includes(user));
    
    if (users.length > 0) {
      const newWhitelist = [...whitelist, ...users];
      setWhitelist(newWhitelist);
      onWhitelistChange(newWhitelist);
      setBulkInput('');
      setShowBulkImport(false);
    }
  };

  return (
    <div className={cn('space-y-4', className)}>
      <div className="flex items-center gap-2">
        <Input
          placeholder="Add Farcaster username or FID"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyPress={handleKeyPress}
          className="flex-1"
        />
        <Button onClick={() => addToWhitelist(inputValue)} size="sm">
          Add
        </Button>
        <Dialog open={showBulkImport} onOpenChange={setShowBulkImport}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm">
              <Upload className="h-4 w-4 mr-1" />
              Bulk Import
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Bulk Import Whitelist</DialogTitle>
              <DialogDescription>
                Paste usernames or FIDs separated by commas or new lines
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <Textarea
                placeholder="Paste usernames or FIDs..."
                value={bulkInput}
                onChange={(e) => setBulkInput(e.target.value)}
                rows={6}
              />
              <Button onClick={handleBulkImport} className="w-full">
                Import
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="rounded-lg border p-4">
        <p className="text-sm text-muted-foreground mb-3">
          {whitelist.length} {whitelist.length === 1 ? 'user' : 'users'} whitelisted
        </p>
        
        {whitelist.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">
            No users whitelisted yet
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {whitelist.map((user) => (
              <div
                key={user}
                className="flex items-center gap-1 px-3 py-1 rounded-full bg-secondary text-sm"
              >
                <span>{user}</span>
                <button
                  onClick={() => removeFromWhitelist(user)}
                  className="ml-1 hover:text-destructive transition-colors"
                  aria-label={`Remove ${user}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}