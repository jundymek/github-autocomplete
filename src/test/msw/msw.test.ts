describe('MSW node server', () => {
  it('intercepts a real fetch call at the network boundary', async () => {
    const response = await fetch('https://api.example.test/ping')
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toEqual({ message: 'pong' })
  })
})
