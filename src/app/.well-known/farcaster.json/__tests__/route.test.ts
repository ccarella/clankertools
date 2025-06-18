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
    expect(data).toHaveProperty('short_name')
    expect(data).toHaveProperty('launch_url')
    expect(data).toHaveProperty('icons')
    expect(data).toHaveProperty('start_url')
    expect(data).toHaveProperty('display')
    expect(data).toHaveProperty('theme_color')
    expect(data).toHaveProperty('background_color')
  })

  it('should have correct manifest structure', async () => {
    const mockRequest = {
      url: 'http://localhost:3000/.well-known/farcaster.json',
    } as MockRequest
    const response = await GET(mockRequest)
    const data = await response.json()
    
    expect(data.version).toBe('1')
    expect(data.name).toBe('Clanker Tools')
    expect(data.short_name).toBe('Clanker')
    expect(data.launch_url).toBe('/')
    expect(data.start_url).toBe('/')
    expect(data.display).toBe('standalone')
    expect(data.theme_color).toBe('#40E0D0')
    expect(data.background_color).toBe('#282A36')
  })

  it('should have valid icon configuration', async () => {
    const mockRequest = {
      url: 'http://localhost:3000/.well-known/farcaster.json',
    } as MockRequest
    const response = await GET(mockRequest)
    const data = await response.json()
    
    expect(Array.isArray(data.icons)).toBe(true)
    expect(data.icons.length).toBeGreaterThan(0)
    
    data.icons.forEach((icon: { src: string; sizes: string; type: string }) => {
      expect(icon).toHaveProperty('src')
      expect(icon).toHaveProperty('sizes')
      expect(icon).toHaveProperty('type')
    })
  })

  it('should have caching headers', async () => {
    const mockRequest = {
      url: 'http://localhost:3000/.well-known/farcaster.json',
    } as MockRequest
    const response = await GET(mockRequest)
    
    expect(response.headers.get('cache-control')).toBeTruthy()
  })
})