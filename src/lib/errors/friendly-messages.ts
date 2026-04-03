interface FriendlyError {
  message: string
  action?: string
  actionType?: 'retry' | 'login' | 'director' | 'dismiss'
}

export function getFriendlyError(error: Error | { message?: string }): FriendlyError {
  const msg = error?.message ?? ''

  // Network / fetch errors
  if (msg.includes('fetch') || msg.includes('network') || msg.includes('Failed to fetch') || msg.includes('NetworkError')) {
    return {
      message: 'Lost connection. Check your internet and try again.',
      action: 'Retry',
      actionType: 'retry',
    }
  }

  // Auth errors
  if (msg.includes('401') || msg.includes('Unauthorised') || msg.includes('Unauthorized')) {
    return {
      message: "You've been signed out. Please log in again.",
      action: 'Log in',
      actionType: 'login',
    }
  }

  // Brand not found
  if (msg.includes('Brand not found')) {
    return {
      message: "I can't find this brand. Try selecting it again from the sidebar.",
      actionType: 'dismiss',
    }
  }

  // Agent not found
  if (msg.includes('Agent not found')) {
    return {
      message: "This department isn't available right now. Try the Director instead.",
      action: 'Ask the Director',
      actionType: 'director',
    }
  }

  // Budget exceeded — already friendly, pass through
  if (msg.includes('Budget exceeded') || msg.includes('budget')) {
    return { message: msg, actionType: 'dismiss' }
  }

  // Validation errors
  if (msg.includes('400') || msg.includes('Invalid request') || msg.includes('invalid')) {
    return {
      message: "Something didn't look right. Try rewording your message.",
      action: 'Retry',
      actionType: 'retry',
    }
  }

  // Generic fallback
  return {
    message: 'Something unexpected happened. Try again, or ask the Director for help.',
    action: 'Retry',
    actionType: 'retry',
  }
}
