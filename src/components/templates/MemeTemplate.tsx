'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useFarcasterAuth } from '@/components/providers/FarcasterAuthProvider'
import { useHaptic } from '@/providers/HapticProvider'
import { Rocket, Flame, TrendingUp, Sparkles, Trophy, Zap } from 'lucide-react'

interface ViralMetric {
  label: string
  value: string
  emoji: string
  trend?: 'up' | 'down' | 'neutral'
}

interface PresetConfig {
  name: string
  emoji: string
  description: string
  config: {
    burnRate?: number
    maxSupply?: string
    launchMode?: string
  }
}

export function MemeTemplate() {
  const router = useRouter()
  const { isAuthenticated } = useFarcasterAuth()
  const haptic = useHaptic()
  const [burnEnabled, setBurnEnabled] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null)

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/')
    }
  }, [isAuthenticated, router])

  const viralMetrics: ViralMetric[] = [
    { label: '🔥 Holder Count', value: '---', emoji: '🔥' },
    { label: '📈 Volume', value: '---', emoji: '📈' },
    { label: '💎 Diamond Hands', value: '---', emoji: '💎' },
    { label: '🐋 Whale Watch', value: '---', emoji: '🐋' }
  ]

  const presetConfigs: PresetConfig[] = [
    { 
      name: '🐸 Pepe Mode', 
      emoji: '🐸',
      description: 'Classic meme token setup',
      config: { burnRate: 1, maxSupply: '420690000000' }
    },
    { 
      name: '🚀 Moon Shot', 
      emoji: '🚀',
      description: 'High risk, high reward',
      config: { burnRate: 5, launchMode: 'stealth' }
    },
    { 
      name: '💎 Diamond Hands', 
      emoji: '💎',
      description: 'Rewards long-term holders',
      config: { burnRate: 0.5, launchMode: 'fair' }
    }
  ]

  const handleQuickLaunch = () => {
    haptic.buttonPress()
    router.push('/templates/meme/launch')
  }

  const handleGenerateMeme = async () => {
    haptic.menuItemSelect()
    setIsGenerating(true)
    await new Promise(resolve => setTimeout(resolve, 2000))
    setIsGenerating(false)
    haptic.buttonPress('default')
  }

  const handlePresetSelect = (preset: string) => {
    haptic.menuItemSelect()
    setSelectedPreset(preset)
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-900/20 to-black p-4">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-yellow-400 to-pink-600 bg-clip-text text-transparent">
            🚀 Memecoin Degen Template
          </h1>
          <p className="text-gray-400">🚀 Launch in 60 seconds or less!</p>
        </div>

        <Card className="border-purple-500/50 bg-black/50 backdrop-blur">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Rocket className="w-5 h-5" />
              Quick Launch
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Button 
              onClick={handleQuickLaunch}
              className="w-full h-16 text-xl bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
            >
              <Rocket className="mr-2" />
              Quick Launch 🚀
            </Button>
            <p className="text-center text-sm text-gray-500 mt-2">
              Name, Symbol, Image - That&apos;s it!
            </p>
          </CardContent>
        </Card>

        <Tabs defaultValue="metrics" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="metrics">Viral Metrics</TabsTrigger>
            <TabsTrigger value="memes">Memes</TabsTrigger>
            <TabsTrigger value="config">Config</TabsTrigger>
          </TabsList>

          <TabsContent value="metrics" className="space-y-4">
            <Card className="border-purple-500/50 bg-black/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5" />
                  Viral Metrics
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  {viralMetrics.map((metric) => (
                    <div key={metric.label} className="bg-purple-900/20 rounded-lg p-4">
                      <div className="text-2xl mb-1">{metric.emoji}</div>
                      <div className="text-sm text-gray-400">{metric.label}</div>
                      <div className="text-xl font-bold">{metric.value}</div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="border-purple-500/50 bg-black/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Trophy className="w-5 h-5" />
                  Community Leaderboard
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between items-center p-2 bg-purple-900/20 rounded">
                    <span>Top Holders</span>
                    <Badge variant="secondary">Coming Soon</Badge>
                  </div>
                  <div className="flex justify-between items-center p-2 bg-purple-900/20 rounded">
                    <span>Most Active</span>
                    <Badge variant="secondary">Coming Soon</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="memes" className="space-y-4">
            <Card className="border-purple-500/50 bg-black/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5" />
                  Auto-Generated Memes
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Button 
                  onClick={handleGenerateMeme}
                  disabled={isGenerating}
                  className="w-full"
                  variant="outline"
                >
                  {isGenerating ? 'Generating...' : 'Generate Meme'}
                </Button>
                <p className="text-sm text-gray-500 mt-2 text-center">
                  AI-powered meme generation for maximum virality
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="config" className="space-y-4">
            <Card className="border-purple-500/50 bg-black/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Flame className="w-5 h-5" />
                  🔥 Burn Events
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <Label htmlFor="burn-toggle" className="flex items-center gap-2">
                    Enable burn mechanism
                    <span className="text-xs text-gray-500">(Deflationary)</span>
                  </Label>
                  <Switch 
                    id="burn-toggle"
                    checked={burnEnabled}
                    onCheckedChange={setBurnEnabled}
                  />
                </div>
              </CardContent>
            </Card>

            <Card className="border-purple-500/50 bg-black/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="w-5 h-5" />
                  Preset Configs
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {presetConfigs.map((preset) => (
                    <Button
                      key={preset.name}
                      variant={selectedPreset === preset.name ? 'default' : 'outline'}
                      className="w-full justify-start"
                      onClick={() => handlePresetSelect(preset.name)}
                    >
                      <span className="mr-2">{preset.emoji}</span>
                      <span>{preset.name}</span>
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}