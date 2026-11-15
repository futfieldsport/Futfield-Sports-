import './set-serverless-env.ts';
import serverless from 'serverless-http';
import { app } from '../../server.ts';

const expressHandler = serverless(app, {
  binary: ['image/*', 'video/*', 'audio/*', 'application/octet-stream'],
});

function normalizeNetlifyPath(rawPath: string | undefined): string {
  let cleanPath = String(rawPath || '/');
  cleanPath = cleanPath.replace(/^\/\.netlify\/functions\/api(?=\/|$)/, '') || '/';
  if (!cleanPath.startsWith('/')) {
    cleanPath = `/${cleanPath}`;
  }
  if (
    cleanPath !== '/sitemap.xml' &&
    cleanPath !== '/robots.txt' &&
    !cleanPath.startsWith('/api/') &&
    !cleanPath.startsWith('/uploads/')
  ) {
    cleanPath = `/api${cleanPath === '/' ? '' : cleanPath}`;
  }
  return cleanPath;
}

export const handler = async (event: any, context: any) => {
  const normalizedPath = normalizeNetlifyPath(event?.path);
  const patchedEvent = {
    ...event,
    path: normalizedPath,
  };
  return expressHandler(patchedEvent, context);
};
