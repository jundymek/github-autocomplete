import { http, HttpResponse } from 'msw'

// Placeholder handler proving the harness works. Real GitHub API handlers
// land with the adapter stories (epic 2).
export const handlers = [
  http.get('https://api.example.test/ping', () => HttpResponse.json({ message: 'pong' })),
]
