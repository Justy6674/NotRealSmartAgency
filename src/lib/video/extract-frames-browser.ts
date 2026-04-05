'use client'

/**
 * Extract evenly-spaced frames from a video file using browser APIs.
 * Returns frame blobs as JPEG images.
 *
 * This runs entirely client-side — no ffmpeg required.
 * Frames are scaled down to max 720px for efficient upload and analysis.
 */
export async function extractFramesFromVideo(
  file: File,
  count = 4
): Promise<Blob[]> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video')
    video.preload = 'metadata'
    video.muted = true
    video.playsInline = true

    const url = URL.createObjectURL(file)
    video.src = url

    video.onloadedmetadata = async () => {
      const duration = video.duration
      if (!duration || duration < 1) {
        URL.revokeObjectURL(url)
        resolve([])
        return
      }

      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        URL.revokeObjectURL(url)
        resolve([])
        return
      }

      // Scale down for analysis — no need for full resolution
      const maxDim = 720
      const scale = Math.min(maxDim / video.videoWidth, maxDim / video.videoHeight, 1)
      canvas.width = Math.round(video.videoWidth * scale)
      canvas.height = Math.round(video.videoHeight * scale)

      const frames: Blob[] = []
      // Sample at evenly-spaced midpoints through the video
      const times = Array.from({ length: count }, (_, i) =>
        (duration * (i + 0.5)) / count
      )

      for (const time of times) {
        try {
          const blob = await seekAndCapture(video, time, canvas, ctx)
          if (blob) frames.push(blob)
        } catch {
          // Skip frames that fail to capture
        }
      }

      URL.revokeObjectURL(url)
      resolve(frames)
    }

    video.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Failed to load video for frame extraction'))
    }
  })
}

function seekAndCapture(
  video: HTMLVideoElement,
  time: number,
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D
): Promise<Blob | null> {
  return new Promise((resolve) => {
    video.currentTime = time
    video.onseeked = () => {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
      canvas.toBlob(
        (blob) => resolve(blob),
        'image/jpeg',
        0.8
      )
    }
    // Timeout after 5s per frame
    setTimeout(() => resolve(null), 5000)
  })
}
