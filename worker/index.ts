interface AssetFetcher {
  fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>
}

interface Env {
  ASSETS: AssetFetcher
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)

    if (url.pathname.startsWith('/api/')) {
      return Response.json(
        { error: 'The backend is not connected in this preview.' },
        { status: 503 },
      )
    }

    return env.ASSETS.fetch(request)
  },
}
