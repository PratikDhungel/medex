import { existsSync } from 'node:fs'

/**
 * The server package's folder, found by its package.json. The server runs
 * from src/ in development (tsx) and from dist/server/src/ once built,
 * because the build also compiles ../shared and keeps the repo layout. A
 * fixed relative path would only be right for one of them.
 */
function findServerRoot(): URL {
  let dir = new URL('./', import.meta.url)
  while (!existsSync(new URL('package.json', dir))) {
    const parent = new URL('../', dir)
    if (parent.href === dir.href) throw new Error('Could not find the server package.json')
    dir = parent
  }
  return dir
}

const SERVER_ROOT = findServerRoot()

/** A file in server/data */
export const dataFile = (name: string) => new URL(`data/${name}`, SERVER_ROOT)
