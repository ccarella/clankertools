"use client"

import * as React from "react"
import Image from "next/image"
import * as AvatarPrimitive from "@radix-ui/react-avatar"
import { cn } from "@/lib/utils"

const Avatar = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Root>
>(({ className, ...props }, ref) => (
  <AvatarPrimitive.Root
    ref={ref}
    className={cn(
      "relative flex h-10 w-10 shrink-0 overflow-hidden rounded-full",
      className
    )}
    {...props}
  />
))
Avatar.displayName = AvatarPrimitive.Root.displayName

interface AvatarImageProps extends Omit<React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Image>, 'src'> {
  src?: string
  loading?: "lazy" | "eager"
  sizes?: string
}

const AvatarImage = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Image>,
  AvatarImageProps
>(({ className, src, alt, loading = "lazy", sizes = "40px", ...props }, ref) => {
  const [error, setError] = React.useState(false)

  if (!src || error) {
    return null
  }

  return (
    <AvatarPrimitive.Image asChild ref={ref} {...props}>
      <Image
        src={src}
        alt={alt || "Avatar"}
        fill
        className={cn("aspect-square object-cover", className)}
        onError={() => setError(true)}
        loading={loading}
        sizes={sizes}
      />
    </AvatarPrimitive.Image>
  )
})
AvatarImage.displayName = AvatarPrimitive.Image.displayName

const AvatarFallback = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Fallback>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Fallback>
>(({ className, ...props }, ref) => (
  <AvatarPrimitive.Fallback
    ref={ref}
    className={cn(
      "flex h-full w-full items-center justify-center rounded-full bg-muted",
      className
    )}
    {...props}
  />
))
AvatarFallback.displayName = AvatarPrimitive.Fallback.displayName

export { Avatar, AvatarImage, AvatarFallback }