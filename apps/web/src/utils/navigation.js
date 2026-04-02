export function smartBack(navigate, fallbackPath = '/', options = {}) {
  const { replaceOnFallback = true } = options

  // React Router stores a history index in browser state. If there is no prior
  // in-app entry, jump to a safe fallback route instead of leaving the user
  // in an auth/back-loop.
  const historyIndex = window.history?.state?.idx
  if (typeof historyIndex === 'number' && historyIndex > 0) {
    navigate(-1)
    return
  }

  navigate(fallbackPath, { replace: replaceOnFallback })
}
