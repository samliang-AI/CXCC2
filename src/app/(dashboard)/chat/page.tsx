'use client'

import * as React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { 
  Bot, 
  User, 
  Send, 
  Loader2, 
  TrendingUp, 
  Users, 
  Filter, 
  BarChart3,
  Sparkles
} from 'lucide-react'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  isLoading?: boolean
}

// 快捷问题
const QUICK_QUESTIONS = [
  { icon: TrendingUp, text: '本月整体外呼数据如何？', category: '数据看板' },
  { icon: Users, text: '查看团队本月业绩排名', category: '团队看板' },
  { icon: Filter, text: '广州近7天外呼类型分布', category: '类型筛选' },
  { icon: BarChart3, text: '本周外呼成功率分析', category: '外呼结果' }
]

// 示例问题
const EXAMPLE_QUESTIONS = [
  '今天的外呼量是多少？',
  '本月哪个团队业绩最好？',
  '广州地市近7天的外呼情况',
  '林宇君这个月的成功量是多少？',
  '近30天的外呼结果分布',
  '佛山团队的接通率怎么样？',
  '昨天各类型外呼的占比',
  '上个月的整体业绩对比'
]

export default function ChatPage() {
  const [messages, setMessages] = React.useState<Message[]>([])
  const [input, setInput] = React.useState('')
  const [isStreaming, setIsStreaming] = React.useState(false)
  const scrollRef = React.useRef<HTMLDivElement>(null)
  const inputRef = React.useRef<HTMLInputElement>(null)

  // 自动滚动到底部
  React.useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  // 发送消息
  const sendMessage = async (text: string) => {
    if (!text.trim() || isStreaming) return

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: text.trim(),
      timestamp: new Date()
    }

    const assistantMessage: Message = {
      id: (Date.now() + 1).toString(),
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      isLoading: true
    }

    setMessages(prev => [...prev, userMessage, assistantMessage])
    setInput('')
    setIsStreaming(true)

    try {
      const response = await fetch('/api/ai-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text.trim(),
          history: messages.map(m => ({ role: m.role, content: m.content }))
        })
      })

      if (!response.ok) {
        throw new Error('请求失败')
      }

      const data = await response.json()
      
      setMessages(prev => 
        prev.map(m => 
          m.id === assistantMessage.id 
            ? { ...m, content: data.text || '', isLoading: false }
            : m
        )
      )
    } catch (error) {
      console.error('发送消息失败:', error)
      setMessages(prev => 
        prev.map(m => 
          m.id === assistantMessage.id 
            ? { ...m, content: '抱歉，服务暂时不可用，请稍后重试。', isLoading: false }
            : m
        )
      )
    } finally {
      setIsStreaming(false)
    }
  }

  // 处理提交
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    sendMessage(input)
  }

  // 快捷提问
  const handleQuickQuestion = (text: string) => {
    sendMessage(text)
  }

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      {/* 页面标题 */}
      <div className="mb-6 text-center">
        <div className="flex items-center justify-center gap-2 mb-2">
          <Sparkles className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">智能数据机器人</h1>
        </div>
        <p className="text-muted-foreground">
          用自然语言提问，快速获取数据看板、团队业绩、类型筛选、外呼结果等信息
        </p>
      </div>

      <div className="flex-1 flex flex-col max-w-4xl mx-auto w-full">
        {/* 快捷入口 */}
        {messages.length === 0 && (
          <div className="mb-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 mb-6">
              {QUICK_QUESTIONS.map((item, index) => (
                <Card 
                  key={index}
                  className="cursor-pointer hover:bg-accent/50 transition-colors"
                  onClick={() => handleQuickQuestion(item.text)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                        <item.icon className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <div className="text-sm font-medium">{item.text.slice(0, 10)}...</div>
                        <div className="text-xs text-muted-foreground">{item.category}</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* 示例问题 */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">您可以这样问</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {EXAMPLE_QUESTIONS.map((question, index) => (
                    <Badge 
                      key={index}
                      variant="secondary"
                      className="cursor-pointer hover:bg-secondary/80"
                      onClick={() => handleQuickQuestion(question)}
                    >
                      {question}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* 消息列表 */}
        {messages.length > 0 && (
          <ScrollArea className="flex-1 pr-4" ref={scrollRef}>
            <div className="space-y-4 pb-4">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex gap-3 ${
                    message.role === 'user' ? 'justify-end' : 'justify-start'
                  }`}
                >
                  {message.role === 'assistant' && (
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="bg-primary text-primary-foreground">
                        <Bot className="h-4 w-4" />
                      </AvatarFallback>
                    </Avatar>
                  )}

                  <div
                    className={`max-w-[80%] rounded-lg px-4 py-2 ${
                      message.role === 'user'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted'
                    }`}
                  >
                    {message.isLoading ? (
                      <div className="flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span className="text-sm">正在查询数据...</span>
                      </div>
                    ) : (
                      <div className="text-sm whitespace-pre-wrap">
                        {message.content}
                      </div>
                    )}
                  </div>

                  {message.role === 'user' && (
                    <Avatar className="h-8 w-8">
                      <AvatarFallback>
                        <User className="h-4 w-4" />
                      </AvatarFallback>
                    </Avatar>
                  )}
                </div>
              ))}
            </div>
          </ScrollArea>
        )}

        {/* 输入区域 */}
        <div className="mt-4 border-t pt-4">
          <form onSubmit={handleSubmit} className="flex gap-2">
            <Input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="输入您的问题，例如：今天的外呼数据如何？"
              disabled={isStreaming}
              className="flex-1"
            />
            <Button type="submit" disabled={isStreaming || !input.trim()}>
              {isStreaming ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </form>
          <p className="text-xs text-muted-foreground mt-2 text-center">
            按 Enter 发送消息 · 支持自然语言查询
          </p>
        </div>
      </div>
    </div>
  )
}
