'use client'

import React, { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useFarcasterAuth } from '@/components/providers/FarcasterAuthProvider'
import { useHaptic } from '@/providers/HapticProvider'
import { Rocket, Upload, Clock, Sparkles } from 'lucide-react'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'

const memeFormSchema = z.object({
  name: z.string().min(1, 'Name is required').max(50),
  symbol: z.string().min(1, 'Symbol is required').max(10).toUpperCase(),
  image: z.any()
})

type MemeFormData = z.infer<typeof memeFormSchema>

interface PresetSuggestion {
  name: string
  symbol: string
  emoji: string
}

export default function MemeQuickLaunch() {
  const router = useRouter()
  const { isAuthenticated, user } = useFarcasterAuth()
  const haptic = useHaptic()
  const [isLaunching, setIsLaunching] = useState(false)
  const [countdown, setCountdown] = useState(60)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<MemeFormData>({
    resolver: zodResolver(memeFormSchema)
  })

  const presetSuggestions: PresetSuggestion[] = [
    { name: 'Doge', symbol: 'DOGE', emoji: '🐕' },
    { name: 'Pepe', symbol: 'PEPE', emoji: '🐸' },
    { name: 'Shiba', symbol: 'SHIB', emoji: '🐶' },
    { name: 'Wojak', symbol: 'WOJAK', emoji: '😭' }
  ]

  const [currentMessage, setCurrentMessage] = useState('🚀 Ready to moon?')

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/')
    }
  }, [isAuthenticated, router])

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown(prev => Math.max(0, prev - 1))
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    const messages = [
      '🚀 Ready to moon?',
      '💎 Diamond hands only!',
      '🔥 LFG!!!',
      '🌙 To the moon!',
      '🚀 Wen lambo?'
    ]
    const messageTimer = setInterval(() => {
      setCurrentMessage(messages[Math.floor(Math.random() * messages.length)])
    }, 3000)
    return () => clearInterval(messageTimer)
  }, [])

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        alert('Image must be less than 5MB')
        return
      }

      setImageFile(file)
      const reader = new FileReader()
      reader.onloadend = () => {
        setImagePreview(reader.result as string)
      }
      reader.readAsDataURL(file)
      haptic.menuItemSelect()
    }
  }

  const handlePresetClick = (preset: PresetSuggestion) => {
    setValue('name', preset.name)
    setValue('symbol', preset.symbol)
    haptic.menuItemSelect()
  }

  const onSubmit = async (data: MemeFormData) => {
    if (!imageFile) {
      alert('Please upload a meme image!')
      return
    }

    setIsLaunching(true)
    haptic.buttonPress()

    try {
      const formData = new FormData()
      formData.append('name', data.name)
      formData.append('symbol', data.symbol)
      formData.append('image', imageFile)
      formData.append('fid', String(user?.fid || ''))
      formData.append('template', 'meme')

      const response = await fetch('/api/deploy/meme', {
        method: 'POST',
        body: formData
      })

      const result = await response.json()

      if (response.ok && result.success) {
        haptic.buttonPress('default')
        // Redirect to transaction status page
        router.push(`/transaction/${result.transactionId}`)
      } else {
        throw new Error(result.error || 'Failed to deploy token')
      }
    } catch (error) {
      console.error('Launch error:', error)
      alert(error instanceof Error ? error.message : 'Failed to launch token')
      haptic.buttonPress('destructive')
    } finally {
      setIsLaunching(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-900/20 to-black p-4">
      <div className="max-w-lg mx-auto space-y-6">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2">🚀 Quick Meme Launch</h1>
          <div className="flex items-center justify-center gap-2 text-gray-400">
            <Clock className="w-4 h-4" />
            <span>Time to Launch: {countdown}s</span>
          </div>
          <p className="text-sm text-purple-400 mt-2">{currentMessage}</p>
        </div>

        <Card className="border-purple-500/50 bg-black/50 backdrop-blur">
          <CardHeader>
            <CardTitle>Quick Suggestions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-4 gap-2">
              {presetSuggestions.map((preset) => (
                <Button
                  key={preset.symbol}
                  variant="outline"
                  size="sm"
                  onClick={() => handlePresetClick(preset)}
                  className="flex flex-col items-center p-2"
                >
                  <span className="text-2xl mb-1">{preset.emoji}</span>
                  <span className="text-xs">{preset.symbol}</span>
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Card className="border-purple-500/50 bg-black/50 backdrop-blur">
            <CardContent className="pt-6 space-y-4">
              <div>
                <Label htmlFor="name">Token Name</Label>
                <Input
                  id="name"
                  {...register('name')}
                  placeholder="e.g. Doge Coin"
                  className="mt-1"
                />
                {errors.name && (
                  <p className="text-red-500 text-sm mt-1">{errors.name.message}</p>
                )}
              </div>

              <div>
                <Label htmlFor="symbol">Token Symbol</Label>
                <Input
                  id="symbol"
                  {...register('symbol')}
                  placeholder="e.g. DOGE"
                  className="mt-1 uppercase"
                  onChange={(e) => setValue('symbol', e.target.value.toUpperCase())}
                />
                {errors.symbol && (
                  <p className="text-red-500 text-sm mt-1">{errors.symbol.message}</p>
                )}
              </div>

              <div>
                <Label>Upload Meme</Label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full mt-1"
                >
                  <Upload className="w-4 h-4 mr-2" />
                  {imageFile ? imageFile.name : 'Upload Meme'}
                </Button>
                {imagePreview && (
                  <div className="mt-2 relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={imagePreview}
                      alt="Meme preview"
                      className="w-full h-48 object-cover rounded-lg"
                    />
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Button
            type="submit"
            disabled={isLaunching}
            className="w-full h-16 text-xl bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
          >
            {isLaunching ? (
              <>
                <Sparkles className="mr-2 animate-spin" />
                Launching...
              </>
            ) : (
              <>
                <Rocket className="mr-2" />
                Launch Now! 🚀
              </>
            )}
          </Button>
        </form>

        <div className="text-center text-xs text-gray-500">
          <p>Gas fees will be handled by Clanker</p>
          <p>Your meme token will be live in seconds!</p>
        </div>
      </div>
    </div>
  )
}