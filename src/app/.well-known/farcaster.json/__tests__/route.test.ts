/**
 * @jest-environment node
 */
import { GET } from '../route'

interface MockRequest {
  url: string
}

describe('GET /.well-known/farcaster.json', () => {
  it('should return valid manifest JSON', async () => {
    const mockRequest = {
      url: 'http://localhost:3000/.well-known/farcaster.json',
    } as MockRequest
    const response = await GET(mockRequest)
    
    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe('application/json')
    
    const data = await response.json()
    
    expect(data).toHaveProperty('version')
    expect(data).toHaveProperty('name')
    expect(data).toHaveProperty('description')
    expect(data).toHaveProperty('icon')
    expect(data).toHaveProperty('splashScreenUrl')
    expect(data).toHaveProperty('aboutUrl')
    expect(data).toHaveProperty('miniAppUrl')
    expect(data).toHaveProperty('notifications')
    expect(data).toHaveProperty('homeUrl')
    expect(data).toHaveProperty('metadata')
  })

  it('should have correct manifest structure', async () => {
    const mockRequest = {
      url: 'http://localhost:3000/.well-known/farcaster.json',
    } as MockRequest
    const response = await GET(mockRequest)
    const data = await response.json()
    
    expect(data.version).toBe('1.0.0')
    expect(data.name).toBe('ClankerTools')
    expect(data.description).toBe('Launch tokens on Clanker with ease')
    expect(data.miniAppUrl).toMatch(/^https?:\/\//)
    expect(data.homeUrl).toMatch(/^https?:\/\//)
    expect(data.metadata.theme_color).toBe('#40E0D0')
    expect(data.metadata.background_color).toBe('#282A36')
  })

  it('should have valid icon configuration', async () => {
    const mockRequest = {
      url: 'http://localhost:3000/.well-known/farcaster.json',
    } as MockRequest
    const response = await GET(mockRequest)
    const data = await response.json()
    
    expect(data.icon).toBeTruthy()
    expect(data.icon).toMatch(/\.(svg|png|jpg|jpeg)$/i)
    expect(data.splashScreenUrl).toBeTruthy()
    expect(data.splashScreenUrl).toMatch(/\.(png|jpg|jpeg)$/i)
  })

  it('should have caching headers', async () => {
    const mockRequest = {
      url: 'http://localhost:3000/.well-known/farcaster.json',
    } as MockRequest
    const response = await GET(mockRequest)
    
    expect(response.headers.get('cache-control')).toBeTruthy()
    expect(response.headers.get('access-control-allow-origin')).toBe('*')
  })
})