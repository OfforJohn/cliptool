import { useState, useEffect, useRef } from 'react'
import { 
  X, Wand2, Type, Palette, AlignCenter, Sparkles, 
  Languages, Hash, MessageSquare, Zap, ChevronDown,
  Check, RefreshCw, Download, Eye, Play, Pause, Volume2, VolumeX
} from 'lucide-react'
import { CaptionStyle, Transcription } from '../types'

interface CaptionEditorModalProps {
  isOpen: boolean
  videoUrl: string
  transcription: Transcription | null
  onClose: () => void
  onGenerate: (options: CaptionOptions) => void
  isGenerating: boolean
  progress?: string
}

export interface CaptionOptions {
  style: CaptionStyle
  wordsPerCaption: number
  highlightKeywords: boolean
  animation: 'none' | 'pop' | 'fade' | 'bounce'
  aiFeature?: 'translate' | 'summarize' | 'hashtags' | 'enhance'
  targetLanguage?: string
}

const PRESET_COLORS = [
  { name: 'White', value: 'FFFFFF' },
  { name: 'Yellow', value: 'FFFF00' },
  { name: 'Cyan', value: '00FFFF' },
  { name: 'Lime', value: '00FF00' },
  { name: 'Pink', value: 'FF69B4' },
  { name: 'Orange', value: 'FFA500' },
  { name: 'Red', value: 'FF0000' },
  { name: 'Blue', value: '4169E1' },
  { name: 'Purple', value: '9B59B6' },
  { name: 'Gold', value: 'FFD700' },
]

const HIGHLIGHT_COLORS = [
  { name: 'Yellow', value: 'FFFF00' },
  { name: 'Cyan', value: '00FFFF' },
  { name: 'Lime Green', value: '32CD32' },
  { name: 'Hot Pink', value: 'FF1493' },
  { name: 'Orange', value: 'FF8C00' },
  { name: 'Electric Blue', value: '00BFFF' },
  { name: 'Red', value: 'FF4444' },
  { name: 'Purple', value: 'DA70D6' },
]

const FONTS = [
  { name: 'Arial', value: 'Arial' },
  { name: 'Impact', value: 'Impact' },
  { name: 'Comic Sans', value: 'Comic Sans MS' },
  { name: 'Montserrat', value: 'Montserrat' },
  { name: 'Bebas Neue', value: 'Bebas Neue' },
  { name: 'Roboto', value: 'Roboto' },
]

const LANGUAGES = [
  { code: 'es', name: 'Spanish' },
  { code: 'fr', name: 'French' },
  { code: 'de', name: 'German' },
  { code: 'pt', name: 'Portuguese' },
  { code: 'it', name: 'Italian' },
  { code: 'ja', name: 'Japanese' },
  { code: 'ko', name: 'Korean' },
  { code: 'zh', name: 'Chinese' },
  { code: 'ar', name: 'Arabic' },
  { code: 'hi', name: 'Hindi' },
]

export default function CaptionEditorModal({
  isOpen,
  videoUrl,
  transcription,
  onClose,
  onGenerate,
  isGenerating,
  progress
}: CaptionEditorModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isMuted, setIsMuted] = useState(true)
  const [isVisible, setIsVisible] = useState(false)
  const [activeTab, setActiveTab] = useState<'style' | 'ai'>('style')
  
  // Style options
  const [primaryColor, setPrimaryColor] = useState('FFFFFF')
  const [highlightColor, setHighlightColor] = useState('FFFF00')
  const [outlineColor, setOutlineColor] = useState('000000')
  const [fontSize, setFontSize] = useState(28)
  const [font, setFont] = useState('Arial')
  const [position, setPosition] = useState<'bottom' | 'center' | 'top'>('bottom')
  const [wordsPerCaption, setWordsPerCaption] = useState(3)
  const [highlightKeywords, setHighlightKeywords] = useState(true)
  const [animation, setAnimation] = useState<'none' | 'pop' | 'fade' | 'bounce'>('none')
  
  // AI options
  const [selectedAiFeature, setSelectedAiFeature] = useState<string | null>(null)
  const [targetLanguage, setTargetLanguage] = useState('es')
  
  // Color picker state
  const [showPrimaryPicker, setShowPrimaryPicker] = useState(false)
  const [showHighlightPicker, setShowHighlightPicker] = useState(false)
  const [customPrimaryColor, setCustomPrimaryColor] = useState('')
  const [customHighlightColor, setCustomHighlightColor] = useState('')

  useEffect(() => {
    if (isOpen) {
      requestAnimationFrame(() => setIsVisible(true))
      document.body.style.overflow = 'hidden'
    } else {
      setIsVisible(false)
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [isOpen])

  const handleGenerate = () => {
    onGenerate({
      style: {
        font,
        font_size: fontSize,
        primary_color: primaryColor,
        highlight_color: highlightColor,
        outline_color: outlineColor,
        position,
      },
      wordsPerCaption,
      highlightKeywords,
      animation,
      aiFeature: selectedAiFeature as CaptionOptions['aiFeature'],
      targetLanguage: selectedAiFeature === 'translate' ? targetLanguage : undefined,
    })
  }

  // Get preview text
  const getPreviewText = () => {
    if (!transcription?.segments?.[0]?.text) {
      return 'This is a preview of your caption style'
    }
    const firstSegment = transcription.segments[0].text.trim()
    return firstSegment.slice(0, 50) + (firstSegment.length > 50 ? '...' : '')
  }

  if (!isOpen) return null

  return (
    <div
      className={`
        fixed inset-0 z-50 flex items-center justify-center p-4
        transition-all duration-300
        ${isVisible ? 'bg-black/90 backdrop-blur-md' : 'bg-black/0'}
      `}
      onClick={onClose}
    >
      <div
        className={`
          bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950
          w-full max-w-4xl max-h-[90vh] overflow-hidden
          rounded-2xl border border-slate-700/50 shadow-2xl
          transition-all duration-300 ease-out
          ${isVisible ? 'scale-100 opacity-100' : 'scale-95 opacity-0'}
        `}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-purple-500/20 to-pink-500/20">
              <Wand2 className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Caption Editor</h2>
              <p className="text-xs text-slate-400">Customize your captions with AI-powered features</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-slate-700/80 transition-all"
          >
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-800">
          <button
            onClick={() => setActiveTab('style')}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-all
              ${activeTab === 'style' 
                ? 'text-white border-b-2 border-purple-500 bg-slate-800/50' 
                : 'text-slate-400 hover:text-white hover:bg-slate-800/30'}`}
          >
            <Palette className="w-4 h-4" />
            Style & Design
          </button>
          <button
            onClick={() => setActiveTab('ai')}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-all
              ${activeTab === 'ai' 
                ? 'text-white border-b-2 border-purple-500 bg-slate-800/50' 
                : 'text-slate-400 hover:text-white hover:bg-slate-800/30'}`}
          >
            <Sparkles className="w-4 h-4" />
            AI Features
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto max-h-[calc(90vh-200px)] p-6">
          {activeTab === 'style' ? (
            <div className="space-y-6">
              {/* Live Preview with Video */}
              <div className="relative rounded-xl overflow-hidden bg-black border border-slate-700">
                <div className="aspect-video relative">
                  {/* Actual Video */}
                  <video
                    ref={videoRef}
                    src={videoUrl}
                    className="w-full h-full object-contain"
                    loop
                    muted={isMuted}
                    playsInline
                    onPlay={() => setIsPlaying(true)}
                    onPause={() => setIsPlaying(false)}
                  />
                  
                  {/* Caption Overlay */}
                  <div 
                    className={`absolute left-0 right-0 flex justify-center px-4 pointer-events-none ${
                      position === 'top' ? 'top-4' : position === 'center' ? 'top-1/2 -translate-y-1/2' : 'bottom-4'
                    }`}
                  >
                    <div 
                      className="text-center px-4 py-2 transition-all max-w-[90%]"
                      style={{
                        fontFamily: font,
                        fontSize: `${Math.max(12, fontSize * 0.5)}px`,
                        color: `#${primaryColor}`,
                        textShadow: `2px 2px 0 #${outlineColor}, -2px -2px 0 #${outlineColor}, 2px -2px 0 #${outlineColor}, -2px 2px 0 #${outlineColor}`,
                      }}
                    >
                      This is{' '}
                      <span 
                        style={{ 
                          color: highlightKeywords ? `#${highlightColor}` : `#${primaryColor}`,
                          fontWeight: highlightKeywords ? 'bold' : 'normal',
                          fontSize: highlightKeywords ? '120%' : '100%',
                        }}
                      >
                        HIGHLIGHTED
                      </span>
                      {' '}text
                    </div>
                  </div>

                  {/* Video Controls Overlay */}
                  <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/80 to-transparent">
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => {
                          if (videoRef.current) {
                            if (isPlaying) {
                              videoRef.current.pause()
                            } else {
                              videoRef.current.play()
                            }
                          }
                        }}
                        className="p-2 rounded-full bg-white/20 hover:bg-white/30 transition-all"
                      >
                        {isPlaying ? (
                          <Pause className="w-4 h-4 text-white" />
                        ) : (
                          <Play className="w-4 h-4 text-white fill-white" />
                        )}
                      </button>
                      <button
                        onClick={() => {
                          setIsMuted(!isMuted)
                          if (videoRef.current) {
                            videoRef.current.muted = !isMuted
                          }
                        }}
                        className="p-2 rounded-full bg-white/20 hover:bg-white/30 transition-all"
                      >
                        {isMuted ? (
                          <VolumeX className="w-4 h-4 text-white" />
                        ) : (
                          <Volume2 className="w-4 h-4 text-white" />
                        )}
                      </button>
                      <span className="text-xs text-white/70 ml-auto">Preview your caption style</span>
                    </div>
                  </div>
                </div>
                <div className="absolute top-2 right-2 px-2 py-1 rounded-md bg-black/60 text-xs text-slate-300">
                  <Eye className="w-3 h-3 inline mr-1" />
                  Live Preview
                </div>
              </div>

              {/* Color Options */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Primary Color */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-300 flex items-center gap-2">
                    <Type className="w-4 h-4" />
                    Text Color
                  </label>
                  <div className="relative">
                    <button
                      onClick={() => { setShowPrimaryPicker(!showPrimaryPicker); setShowHighlightPicker(false) }}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg bg-slate-800 border border-slate-700 hover:border-slate-600 transition-all"
                    >
                      <div 
                        className="w-6 h-6 rounded-md border border-slate-600"
                        style={{ backgroundColor: `#${primaryColor}` }}
                      />
                      <span className="text-sm text-slate-300">#{primaryColor}</span>
                      <ChevronDown className="w-4 h-4 text-slate-400 ml-auto" />
                    </button>
                    
                    {showPrimaryPicker && (
                      <div className="absolute top-full left-0 mt-2 p-3 rounded-xl bg-slate-800 border border-slate-700 shadow-xl z-10 w-full">
                        <div className="grid grid-cols-5 gap-2 mb-3">
                          {PRESET_COLORS.map(color => (
                            <button
                              key={color.value}
                              onClick={() => { setPrimaryColor(color.value); setShowPrimaryPicker(false) }}
                              className={`w-8 h-8 rounded-lg border-2 transition-all hover:scale-110 ${
                                primaryColor === color.value ? 'border-white scale-110' : 'border-slate-600'
                              }`}
                              style={{ backgroundColor: `#${color.value}` }}
                              title={color.name}
                            />
                          ))}
                        </div>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={customPrimaryColor}
                            onChange={(e) => setCustomPrimaryColor(e.target.value.replace('#', '').toUpperCase())}
                            placeholder="Custom HEX"
                            className="flex-1 px-2 py-1.5 text-sm rounded-lg bg-slate-900 border border-slate-700 text-white"
                          />
                          <button
                            onClick={() => { 
                              if (/^[0-9A-F]{6}$/i.test(customPrimaryColor)) {
                                setPrimaryColor(customPrimaryColor)
                                setShowPrimaryPicker(false)
                              }
                            }}
                            className="px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-sm"
                          >
                            Apply
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Highlight Color */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-300 flex items-center gap-2">
                    <Sparkles className="w-4 h-4" />
                    Highlight Color
                  </label>
                  <div className="relative">
                    <button
                      onClick={() => { setShowHighlightPicker(!showHighlightPicker); setShowPrimaryPicker(false) }}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg bg-slate-800 border border-slate-700 hover:border-slate-600 transition-all"
                      disabled={!highlightKeywords}
                    >
                      <div 
                        className={`w-6 h-6 rounded-md border border-slate-600 ${!highlightKeywords ? 'opacity-50' : ''}`}
                        style={{ backgroundColor: `#${highlightColor}` }}
                      />
                      <span className="text-sm text-slate-300">#{highlightColor}</span>
                      <ChevronDown className="w-4 h-4 text-slate-400 ml-auto" />
                    </button>
                    
                    {showHighlightPicker && highlightKeywords && (
                      <div className="absolute top-full left-0 mt-2 p-3 rounded-xl bg-slate-800 border border-slate-700 shadow-xl z-10 w-full">
                        <div className="grid grid-cols-4 gap-2 mb-3">
                          {HIGHLIGHT_COLORS.map(color => (
                            <button
                              key={color.value}
                              onClick={() => { setHighlightColor(color.value); setShowHighlightPicker(false) }}
                              className={`w-8 h-8 rounded-lg border-2 transition-all hover:scale-110 ${
                                highlightColor === color.value ? 'border-white scale-110' : 'border-slate-600'
                              }`}
                              style={{ backgroundColor: `#${color.value}` }}
                              title={color.name}
                            />
                          ))}
                        </div>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={customHighlightColor}
                            onChange={(e) => setCustomHighlightColor(e.target.value.replace('#', '').toUpperCase())}
                            placeholder="Custom HEX"
                            className="flex-1 px-2 py-1.5 text-sm rounded-lg bg-slate-900 border border-slate-700 text-white"
                          />
                          <button
                            onClick={() => { 
                              if (/^[0-9A-F]{6}$/i.test(customHighlightColor)) {
                                setHighlightColor(customHighlightColor)
                                setShowHighlightPicker(false)
                              }
                            }}
                            className="px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-sm"
                          >
                            Apply
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Font Size & Font */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-300 flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <Type className="w-4 h-4" />
                      Font Size
                    </span>
                    <span className="text-purple-400">{fontSize}px</span>
                  </label>
                  <input
                    type="range"
                    min="16"
                    max="48"
                    value={fontSize}
                    onChange={(e) => setFontSize(parseInt(e.target.value))}
                    className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer
                      [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 
                      [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full 
                      [&::-webkit-slider-thumb]:bg-purple-500 [&::-webkit-slider-thumb]:cursor-pointer
                      [&::-webkit-slider-thumb]:hover:bg-purple-400"
                  />
                  <div className="flex justify-between text-xs text-slate-500">
                    <span>Small</span>
                    <span>Large</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-300 flex items-center gap-2">
                    <Type className="w-4 h-4" />
                    Font Family
                  </label>
                  <select
                    value={font}
                    onChange={(e) => setFont(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-lg bg-slate-800 border border-slate-700 text-white text-sm
                      focus:outline-none focus:border-purple-500"
                  >
                    {FONTS.map(f => (
                      <option key={f.value} value={f.value} style={{ fontFamily: f.value }}>
                        {f.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Position & Words per Caption */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-300 flex items-center gap-2">
                    <AlignCenter className="w-4 h-4" />
                    Position
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {(['top', 'center', 'bottom'] as const).map(pos => (
                      <button
                        key={pos}
                        onClick={() => setPosition(pos)}
                        className={`px-3 py-2 rounded-lg text-sm font-medium capitalize transition-all ${
                          position === pos
                            ? 'bg-purple-600 text-white'
                            : 'bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700'
                        }`}
                      >
                        {pos}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-300 flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <MessageSquare className="w-4 h-4" />
                      Words per Caption
                    </span>
                    <span className="text-purple-400">{wordsPerCaption}</span>
                  </label>
                  <input
                    type="range"
                    min="1"
                    max="8"
                    value={wordsPerCaption}
                    onChange={(e) => setWordsPerCaption(parseInt(e.target.value))}
                    className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer
                      [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 
                      [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full 
                      [&::-webkit-slider-thumb]:bg-purple-500 [&::-webkit-slider-thumb]:cursor-pointer"
                  />
                  <div className="flex justify-between text-xs text-slate-500">
                    <span>1 word</span>
                    <span>8 words</span>
                  </div>
                </div>
              </div>

              {/* Toggle Options */}
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={() => setHighlightKeywords(!highlightKeywords)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    highlightKeywords
                      ? 'bg-purple-600/20 text-purple-400 border border-purple-500/50'
                      : 'bg-slate-800 text-slate-400 border border-slate-700'
                  }`}
                >
                  {highlightKeywords && <Check className="w-4 h-4" />}
                  <Sparkles className="w-4 h-4" />
                  Highlight Keywords
                </button>
              </div>
            </div>
          ) : (
            /* AI Features Tab */
            <div className="space-y-4">
              <p className="text-sm text-slate-400 mb-4">
                Enhance your captions with AI-powered features (coming soon for some features)
              </p>

              {/* AI Feature Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Translate */}
                <button
                  onClick={() => setSelectedAiFeature(selectedAiFeature === 'translate' ? null : 'translate')}
                  className={`p-4 rounded-xl text-left transition-all ${
                    selectedAiFeature === 'translate'
                      ? 'bg-gradient-to-br from-blue-500/20 to-cyan-500/20 border-2 border-blue-500/50'
                      : 'bg-slate-800/50 border border-slate-700 hover:border-slate-600'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-lg ${selectedAiFeature === 'translate' ? 'bg-blue-500/20' : 'bg-slate-700'}`}>
                      <Languages className={`w-5 h-5 ${selectedAiFeature === 'translate' ? 'text-blue-400' : 'text-slate-400'}`} />
                    </div>
                    <div>
                      <h4 className="font-semibold text-white">Translate Captions</h4>
                      <p className="text-xs text-slate-400 mt-1">Translate to another language</p>
                    </div>
                  </div>
                  {selectedAiFeature === 'translate' && (
                    <div className="mt-3 pt-3 border-t border-slate-700">
                      <select
                        value={targetLanguage}
                        onChange={(e) => setTargetLanguage(e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white text-sm"
                      >
                        {LANGUAGES.map(lang => (
                          <option key={lang.code} value={lang.code}>{lang.name}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </button>

                {/* Generate Hashtags */}
                <button
                  onClick={() => setSelectedAiFeature(selectedAiFeature === 'hashtags' ? null : 'hashtags')}
                  className={`p-4 rounded-xl text-left transition-all ${
                    selectedAiFeature === 'hashtags'
                      ? 'bg-gradient-to-br from-pink-500/20 to-purple-500/20 border-2 border-pink-500/50'
                      : 'bg-slate-800/50 border border-slate-700 hover:border-slate-600'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-lg ${selectedAiFeature === 'hashtags' ? 'bg-pink-500/20' : 'bg-slate-700'}`}>
                      <Hash className={`w-5 h-5 ${selectedAiFeature === 'hashtags' ? 'text-pink-400' : 'text-slate-400'}`} />
                    </div>
                    <div>
                      <h4 className="font-semibold text-white">Generate Hashtags</h4>
                      <p className="text-xs text-slate-400 mt-1">AI-suggested hashtags for social media</p>
                      <span className="inline-block mt-2 px-2 py-0.5 rounded text-xs bg-yellow-500/20 text-yellow-400">Coming Soon</span>
                    </div>
                  </div>
                </button>

                {/* Summarize */}
                <button
                  onClick={() => setSelectedAiFeature(selectedAiFeature === 'summarize' ? null : 'summarize')}
                  className={`p-4 rounded-xl text-left transition-all ${
                    selectedAiFeature === 'summarize'
                      ? 'bg-gradient-to-br from-green-500/20 to-emerald-500/20 border-2 border-green-500/50'
                      : 'bg-slate-800/50 border border-slate-700 hover:border-slate-600'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-lg ${selectedAiFeature === 'summarize' ? 'bg-green-500/20' : 'bg-slate-700'}`}>
                      <MessageSquare className={`w-5 h-5 ${selectedAiFeature === 'summarize' ? 'text-green-400' : 'text-slate-400'}`} />
                    </div>
                    <div>
                      <h4 className="font-semibold text-white">Summarize Content</h4>
                      <p className="text-xs text-slate-400 mt-1">Generate a TL;DR of your video</p>
                      <span className="inline-block mt-2 px-2 py-0.5 rounded text-xs bg-yellow-500/20 text-yellow-400">Coming Soon</span>
                    </div>
                  </div>
                </button>

                {/* Enhance */}
                <button
                  onClick={() => setSelectedAiFeature(selectedAiFeature === 'enhance' ? null : 'enhance')}
                  className={`p-4 rounded-xl text-left transition-all ${
                    selectedAiFeature === 'enhance'
                      ? 'bg-gradient-to-br from-orange-500/20 to-yellow-500/20 border-2 border-orange-500/50'
                      : 'bg-slate-800/50 border border-slate-700 hover:border-slate-600'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-lg ${selectedAiFeature === 'enhance' ? 'bg-orange-500/20' : 'bg-slate-700'}`}>
                      <Zap className={`w-5 h-5 ${selectedAiFeature === 'enhance' ? 'text-orange-400' : 'text-slate-400'}`} />
                    </div>
                    <div>
                      <h4 className="font-semibold text-white">Enhance Captions</h4>
                      <p className="text-xs text-slate-400 mt-1">Fix grammar & improve readability</p>
                      <span className="inline-block mt-2 px-2 py-0.5 rounded text-xs bg-yellow-500/20 text-yellow-400">Coming Soon</span>
                    </div>
                  </div>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 px-6 py-4 border-t border-slate-800 bg-slate-900/50">
          <div className="text-sm text-slate-400">
            {isGenerating ? (
              <span className="flex items-center gap-2">
                <RefreshCw className="w-4 h-4 animate-spin text-purple-400" />
                {progress || 'Processing...'}
              </span>
            ) : (
              <span>Preview your settings above before generating</span>
            )}
          </div>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              disabled={isGenerating}
              className="px-4 py-2.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-white text-sm font-medium transition-all disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleGenerate}
              disabled={isGenerating}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl
                bg-gradient-to-r from-purple-600 to-pink-600 
                hover:from-purple-700 hover:to-pink-700
                disabled:opacity-50 disabled:cursor-not-allowed
                text-white font-semibold transition-all shadow-lg shadow-purple-500/25"
            >
              {isGenerating ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Wand2 className="w-4 h-4" />
                  Generate Captions
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
