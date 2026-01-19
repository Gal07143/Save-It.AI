import { useToast } from '../contexts/ToastContext'

type ActionHandler = () => void | Promise<void>

interface ActionToastOptions {
  pendingMessage?: string
  successMessage: string
  errorMessage?: string
}

export function useActionToast() {
  const { success, error, info, warning } = useToast()

  const withToast = async (
    action: ActionHandler,
    options: ActionToastOptions
  ) => {
    try {
      await action()
      success(options.successMessage)
    } catch (err) {
      error(options.errorMessage || 'An error occurred')
    }
  }

  const comingSoon = (feature: string) => {
    info(`${feature} coming soon!`)
  }

  const featureDisabled = (reason: string) => {
    warning(reason)
  }

  const saved = (item?: string) => {
    success(item ? `${item} saved successfully` : 'Changes saved successfully')
  }

  const deleted = (item?: string) => {
    success(item ? `${item} deleted successfully` : 'Item deleted successfully')
  }

  const copied = (item?: string) => {
    success(item ? `${item} copied to clipboard` : 'Copied to clipboard')
  }

  const exported = (format?: string) => {
    success(format ? `Exported as ${format}` : 'Export complete')
  }

  return {
    withToast,
    comingSoon,
    featureDisabled,
    saved,
    deleted,
    copied,
    exported,
    success,
    error,
    info,
    warning,
  }
}
