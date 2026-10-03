import { toPng, toJpeg } from 'html-to-image'
import { MOBILE } from './mobile'

export async function downloadWorkoutImage(element: HTMLElement, filename: string): Promise<void> {
  try {
    const dataUrl = await toPng(element, {
      quality: 1,
      pixelRatio: 2,
      backgroundColor: '#ffffff',
    })
    
    // Create a temporary link and trigger download
    const link = document.createElement('a')
    link.download = filename
    link.href = dataUrl
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  } catch (error) {
    console.error('Error downloading image:', error)
    throw error
  }
}

export async function shareWorkoutImage(element: HTMLElement, title: string): Promise<void> {
  try {
    if (MOBILE) {
      // Use native share on mobile
      const { Share } = await import('@capacitor/share')
      const { Filesystem, Directory } = await import('@capacitor/filesystem')
      
      const dataUrl = await toJpeg(element, {
        quality: 0.95,
        pixelRatio: 2,
      })
      
      // Remove data URL prefix
      const base64Data = dataUrl.split(',')[1]
      
      // Save to cache directory
      const fileName = `workout-${Date.now()}.jpg`
      const result = await Filesystem.writeFile({
        path: fileName,
        data: base64Data,
        directory: Directory.Cache,
      })
      
      // Share the file
      await Share.share({
        title: title,
        text: `Check out my ${title}!`,
        url: result.uri,
        dialogTitle: 'Share Workout',
      })
    } else {
      // Use Web Share API if available
      const blob = await convertToBlob(element)
      
      if (navigator.share && navigator.canShare) {
        const file = new File([blob], `workout-${Date.now()}.png`, { type: 'image/png' })
        
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({
            title: title,
            text: `Check out my ${title}!`,
            files: [file],
          })
          return
        }
      }
      
      // Fallback: download the image
      await downloadWorkoutImage(element, `workout-${Date.now()}.png`)
    }
  } catch (error) {
    console.error('Error sharing image:', error)
    throw error
  }
}

async function convertToBlob(element: HTMLElement): Promise<Blob> {
  const dataUrl = await toPng(element, {
    quality: 1,
    pixelRatio: 2,
  })
  
  const response = await fetch(dataUrl)
  return response.blob()
}

export async function shareToSocialMedia(
  element: HTMLElement,
  platform: 'facebook' | 'twitter' | 'instagram' | 'whatsapp',
  workoutName: string
): Promise<void> {
  const text = `Just completed my ${workoutName}! 💪`
  
  if (platform === 'twitter') {
    // Twitter doesn't support direct image sharing via URL, download first
    await downloadWorkoutImage(element, `workout-${Date.now()}.png`)
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`, '_blank')
  } else if (platform === 'facebook') {
    // Facebook sharing - download first
    await downloadWorkoutImage(element, `workout-${Date.now()}.png`)
    window.open('https://www.facebook.com/sharer/sharer.php', '_blank')
  } else if (platform === 'whatsapp') {
    // WhatsApp - use native share
    await shareWorkoutImage(element, workoutName)
  } else if (platform === 'instagram') {
    // Instagram requires mobile app, download image first
    await downloadWorkoutImage(element, `workout-${Date.now()}.png`)
  }
}
