'use client'

import { useEffect, useRef } from 'react'

export function AnimatedDotBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const mousePos = useRef({ x: 0, y: 0 })

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Set canvas size
    canvas.width = window.innerWidth
    canvas.height = window.innerHeight

    const dots: Array<{
      x: number
      y: number
      radius: number
      distanceFromMouse: number
    }> = []

    // Create dots grid
    const dotSpacing = 60
    for (let x = 0; x < canvas.width; x += dotSpacing) {
      for (let y = 0; y < canvas.height; y += dotSpacing) {
        dots.push({
          x,
          y,
          radius: 1.5,
          distanceFromMouse: 0,
        })
      }
    }

    // Mouse move handler
    const handleMouseMove = (e: MouseEvent) => {
      mousePos.current = { x: e.clientX, y: e.clientY }
    }

    // Animation loop
    const animate = () => {
      // Clear canvas
      ctx.fillStyle = 'rgba(0, 0, 0, 1)'
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      // Update and draw dots
      dots.forEach(dot => {
        const dx = dot.x - mousePos.current.x
        const dy = dot.y - mousePos.current.y
        dot.distanceFromMouse = Math.sqrt(dx * dx + dy * dy)

        // Change color based on distance from mouse
        if (dot.distanceFromMouse < 150) {
          // White when near mouse
          ctx.fillStyle = `rgba(255, 255, 255, ${1 - dot.distanceFromMouse / 150})`
          dot.radius = 1.5 + (1 - dot.distanceFromMouse / 150) * 2
        } else {
          // Purple dots normally
          ctx.fillStyle = 'rgba(168, 85, 247, 0.6)'
          dot.radius = 1.5
        }

        ctx.beginPath()
        ctx.arc(dot.x, dot.y, dot.radius, 0, Math.PI * 2)
        ctx.fill()
      })

      requestAnimationFrame(animate)
    }

    // Handle window resize
    const handleResize = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('resize', handleResize)

    animate()

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('resize', handleResize)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-0"
      style={{ background: '#000000' }}
    />
  )
}
