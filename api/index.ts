import { app } from '../server.ts'

export const config = {
  api: {
    bodyParser: false,
  },
}

export default function handler(req: any, res: any) {
  const requestUrl = new URL(req.url || '/', 'http://localhost')
  const routePath = requestUrl.searchParams.get('path')

  if (routePath) {
    const segments = routePath.split('/').filter(Boolean)
    if (segments.some(segment => segment === '.' || segment === '..')) {
      return res.status(400).json({ error: 'Invalid API path' })
    }

    requestUrl.searchParams.delete('path')
    req.url = `/api/${segments.join('/')}${requestUrl.search}`
  }

  return app(req, res)
}
