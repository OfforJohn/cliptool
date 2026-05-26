import { useEffect, useState } from 'react'
import { AlertTriangle, Trash2, X } from 'lucide-react'

interface ConfirmModalProps {
  isOpen: boolean
  title: string
  message: string
  confirmText?: string
  cancelText?: string
  variant?: 'danger' | 'warning' | 'default'
  onConfirm: () => void
  onCancel: () => void
}

export default function ConfirmModal({
  isOpen,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'danger',
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  const [isVisible, setIsVisible] = useState(false)
  const [isAnimating, setIsAnimating] = useState(false)

  useEffect(() => {
    if (isOpen) {
      setIsAnimating(true)
      requestAnimationFrame(() => setIsVisible(true))
    } else {
      setIsVisible(false)
      const timer = setTimeout(() => setIsAnimating(false), 200)
      return () => clearTimeout(timer)
    }
  }, [isOpen])

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onCancel()
      }
    }
    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [isOpen, onCancel])

  if (!isAnimating && !isOpen) return null

  const variantStyles = {
    danger: {
      icon: Trash2,
      iconBg: 'bg-red-500/20',
      iconColor: 'text-red-400',
      button: 'bg-red-600 hover:bg-red-700 focus:ring-red-500',
    },
    warning: {
      icon: AlertTriangle,
      iconBg: 'bg-yellow-500/20',
      iconColor: 'text-yellow-400',
      button: 'bg-yellow-600 hover:bg-yellow-700 focus:ring-yellow-500',
    },
    default: {
      icon: AlertTriangle,
      iconBg: 'bg-blue-500/20',
      iconColor: 'text-blue-400',
      button: 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500',
    },
  }

  const styles = variantStyles[variant]
  const Icon = styles.icon

  return (
    <div
      className={`
        fixed inset-0 z-50 flex items-center justify-center p-4
        transition-all duration-200
        ${isVisible ? 'bg-black/60 backdrop-blur-sm' : 'bg-black/0'}
      `}
      onClick={onCancel}
    >
      <div
        className={`
          bg-slate-800 rounded-xl border border-slate-700 shadow-2xl
          w-full max-w-md overflow-hidden
          transition-all duration-200
          ${isVisible ? 'scale-100 opacity-100' : 'scale-95 opacity-0'}
        `}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start gap-4 p-6 pb-4">
          <div className={`p-3 rounded-full ${styles.iconBg}`}>
            <Icon className={`w-6 h-6 ${styles.iconColor}`} />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-white">{title}</h3>
            <p className="mt-2 text-sm text-slate-400 leading-relaxed">{message}</p>
          </div>
          <button
            onClick={onCancel}
            className="p-1 rounded-lg hover:bg-slate-700 transition-colors"
          >
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        {/* Actions */}
        <div className="flex gap-3 px-6 py-4 bg-slate-900/50 border-t border-slate-700">
          <button
            onClick={onCancel}
            className="
              flex-1 px-4 py-2.5 rounded-lg font-medium
              bg-slate-700 hover:bg-slate-600 text-white
              transition-colors focus:outline-none focus:ring-2 focus:ring-slate-500
            "
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            className={`
              flex-1 px-4 py-2.5 rounded-lg font-medium text-white
              transition-colors focus:outline-none focus:ring-2
              ${styles.button}
            `}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  )
}
