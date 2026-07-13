'use client';

import { Check, Copy } from 'lucide-react';
import { useState } from 'react';
import { BunIcon, NpmIcon, PnpmIcon } from './icons';
import { YarnIcon } from './icons/yarn-icon';

type PackageManager = 'npm' | 'pnpm' | 'bun' | 'yarn';

interface InstallBlockProps {
  packages?: string[];
}

const defaultPackages = ['@better-tables/core'];

function getCommands(packages: string[]): Record<PackageManager, string> {
  const packageList = packages.join(' ');
  return {
    npm: `npm install ${packageList}`,
    pnpm: `pnpm add ${packageList}`,
    bun: `bun add ${packageList}`,
    yarn: `yarn add ${packageList}`,
  };
}

const icons: Record<
  PackageManager,
  React.ComponentType<{
    className?: string;
    color?: string;
    size?: number;
  }> | null
> = {
  npm: NpmIcon,
  pnpm: PnpmIcon,
  bun: BunIcon,
  yarn: YarnIcon,
};

const managerColors: Record<PackageManager, { name: string; command: string }> = {
  npm: {
    name: 'text-red-500 dark:text-red-400',
    command: 'text-blue-600 dark:text-blue-400',
  },
  pnpm: {
    name: 'text-orange-500 dark:text-orange-400',
    command: 'text-blue-600 dark:text-blue-400',
  },
  bun: {
    name: 'text-yellow-600 dark:text-yellow-400',
    command: 'text-blue-600 dark:text-blue-400',
  },
  yarn: {
    name: 'text-blue-500 dark:text-blue-400',
    command: 'text-blue-600 dark:text-blue-400',
  },
};

function renderCommand(manager: PackageManager, command: string) {
  const colors = managerColors[manager];
  const parts = command.split(' ');

  return (
    <>
      <span className="text-green-600 dark:text-green-400">$</span>
      <span className="mr-2"> </span>
      <span className={colors.name}>{parts[0]}</span>
      <span className="text-muted-foreground"> {parts[1]}</span>
      {parts.slice(2).map((part) => (
        <span key={part} className="text-purple-600 dark:text-purple-400">
          {' '}
          {part}
        </span>
      ))}
    </>
  );
}

export function InstallBlock({ packages = defaultPackages }: InstallBlockProps = {}) {
  const commands = getCommands(packages);
  const [selectedManager, setSelectedManager] = useState<PackageManager>('npm');
  const [copied, setCopied] = useState(false);

  function copyToClipboard() {
    navigator.clipboard.writeText(commands[selectedManager]);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const availableManagers: PackageManager[] = ['npm', 'pnpm', 'bun', 'yarn'];

  return (
    <div className="overflow-hidden rounded-lg border bg-background shadow-lg">
      {/* Package Manager Selector */}
      <div className="border-b bg-muted/30 px-4 py-2">
        <div className="flex items-center justify-between">
          <div className="flex gap-2">
            {availableManagers.map((manager) => {
              const Icon = icons[manager];
              return (
                <button
                  key={manager}
                  type="button"
                  onClick={() => setSelectedManager(manager)}
                  className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                    selectedManager === manager
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-background text-muted-foreground hover:bg-muted'
                  }`}
                >
                  {Icon && (
                    <Icon
                      className="h-4 w-4"
                      color={selectedManager === manager ? undefined : 'default'}
                      size={16}
                    />
                  )}
                  <span>{manager}</span>
                </button>
              );
            })}
          </div>
          <button
            type="button"
            onClick={copyToClipboard}
            className="flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-muted transition-colors"
            aria-label="Copy command"
          >
            {copied ? (
              <>
                <Check className="h-4 w-4" />
                <span>Copied!</span>
              </>
            ) : (
              <>
                <Copy className="h-4 w-4" />
                <span>Copy</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Terminal Content */}
      <div className="bg-muted p-4 font-mono text-sm">
        <div className="flex items-center gap-2">
          {renderCommand(selectedManager, commands[selectedManager])}
          <span className="animate-pulse text-foreground">▋</span>
        </div>
      </div>
    </div>
  );
}
