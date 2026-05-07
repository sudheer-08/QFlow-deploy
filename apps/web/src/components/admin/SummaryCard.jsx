import { memo } from 'react'
import { ExternalLink, Loader } from 'lucide-react'

const SummaryCard = memo(function SummaryCard({
  label,
  value,
  Icon,
  bg,
  link,
  isLoading,
  onClick
}) {
  const content = (
    <div className="flex items-center gap-4 h-full">
      <div
        className="w-16 h-16 rounded-xl flex items-center justify-center"
        style={{ background: bg }}
      >
        <Icon size={32} className="text-white" />
      </div>
      <div className="flex-1">
        <p className="text-sm text-gray-500 font-medium">{label}</p>
        <p className="text-3xl font-bold text-gray-900 mt-1">
          {isLoading ? (
            <Loader size={20} className="animate-spin" />
          ) : (
            typeof value === 'number' ? (
              label.includes('Wait') || label.includes('Avg')
                ? `${value}m`
                : value.toLocaleString()
            ) : value
          )}
        </p>
      </div>
    </div>
  )

  const containerClass = "bg-white rounded-2xl p-6 shadow-sm hover:shadow-md transition-all duration-300"

  if (link) {
    return (
      <a href={link} className={`${containerClass} cursor-pointer group`}>
        <div className="flex items-center justify-between h-full">
          <div className="flex-1">{content}</div>
          <ExternalLink size={18} className="text-gray-300 group-hover:text-gray-600 transition-colors" />
        </div>
      </a>
    )
  }

  return (
    <div
      className={`${containerClass} ${onClick ? 'cursor-pointer' : ''}`}
      onClick={onClick}
    >
      {content}
    </div>
  )
})

export default SummaryCard
