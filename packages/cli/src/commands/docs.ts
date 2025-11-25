import { Command } from 'commander';
import open from 'open';

const DOCS_URLS = {
    main: 'https://github.com/Better-Tables/better-tables#readme',
    core: 'https://github.com/Better-Tables/better-tables/tree/main/packages/core#readme',
    ui: 'https://github.com/Better-Tables/better-tables/tree/main/packages/ui#readme',
    drizzle: 'https://github.com/Better-Tables/better-tables/tree/main/packages/adapters/drizzle#readme',
} as const;

type DocType = keyof typeof DOCS_URLS;

export function docsCommand(): Command {
    const command = new Command('docs');

    command
        .description('Open Better Tables documentation in your browser')
        .argument('[type]', 'Documentation type: main, core, ui, or drizzle', 'main')
        .action(async (type: string) => {
            const docType = type.toLowerCase() as DocType;
            const url = DOCS_URLS[docType];

            if (!url) {
                console.error(`Unknown documentation type: ${type}`);
                console.error(`Available types: ${Object.keys(DOCS_URLS).join(', ')}`);
                process.exit(1);
            }

            try {
                console.log(`Opening ${docType} documentation...`);
                await open(url);
                console.log(`Documentation opened in your browser: ${url}`);
            } catch (error) {
                console.error(`Failed to open documentation: ${error instanceof Error ? error.message : String(error)}`);
                process.exit(1);
            }
        });

    return command;
}

