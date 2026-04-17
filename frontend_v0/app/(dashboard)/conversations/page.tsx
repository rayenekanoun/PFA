'use client'

import { useState, useRef, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import { MessageCircle, Plus, Send, Search, Clock } from 'lucide-react'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

interface Conversation {
  id: string
  vehicle: string
  title: string
  lastMessage: string
  timestamp: Date
  status: 'active' | 'resolved' | 'pending'
}

const mockConversations: Conversation[] = [
  {
    id: '1',
    vehicle: 'Tesla Model 3',
    title: 'Battery charging issue',
    lastMessage: 'Recommended maintenance for battery cooling system',
    timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),
    status: 'active',
  },
  {
    id: '2',
    vehicle: 'Ford F-150',
    title: 'Engine code P0128 diagnosis',
    lastMessage: 'Scheduled for mechanical inspection',
    timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000),
    status: 'pending',
  },
  {
    id: '3',
    vehicle: 'Toyota Prius',
    title: 'Oil change reminder',
    lastMessage: 'Service completed on 04/10/2025',
    timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
    status: 'resolved',
  },
]

const mockMessages: Record<string, Message[]> = {
  '1': [
    {
      id: 'm1',
      role: 'user',
      content: 'The Tesla is not charging fully anymore. Battery only reaches 85% when connected to the supercharger.',
      timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),
    },
    {
      id: 'm2',
      role: 'assistant',
      content: 'I detected a potential issue with the thermal management system. The battery temperature monitoring shows degradation. This could limit charge acceptance to protect the battery.',
      timestamp: new Date(Date.now() - 119 * 60 * 1000),
    },
    {
      id: 'm3',
      role: 'user',
      content: 'What should I do about this? Is it safe to continue driving?',
      timestamp: new Date(Date.now() - 118 * 60 * 1000),
    },
    {
      id: 'm4',
      role: 'assistant',
      content: 'The vehicle is safe to operate. I recommend: 1) Schedule a diagnostic at an authorized Tesla service center, 2) Avoid fast charging for the next week, 3) Keep the vehicle in climate control when parked. This data will help technicians perform targeted maintenance.',
      timestamp: new Date(Date.now() - 117 * 60 * 1000),
    },
    {
      id: 'm5',
      role: 'user',
      content: 'Thanks for the guidance. I&apos;ll schedule the appointment.',
      timestamp: new Date(Date.now() - 115 * 60 * 1000),
    },
  ],
}

export default function ConversationsPage() {
  const [selectedConversation, setSelectedConversation] = useState<string>('1')
  const [messages, setMessages] = useState<Message[]>(mockMessages['1'])
  const [inputValue, setInputValue] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages])

  const currentConversation = mockConversations.find((c) => c.id === selectedConversation)

  const filteredConversations = mockConversations.filter(
    (conv) =>
      conv.vehicle.toLowerCase().includes(searchTerm.toLowerCase()) ||
      conv.title.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const handleSendMessage = () => {
    if (!inputValue.trim()) return

    const newUserMessage: Message = {
      id: `m${Date.now()}`,
      role: 'user',
      content: inputValue,
      timestamp: new Date(),
    }

    setMessages((prev) => [...prev, newUserMessage])
    setInputValue('')

    // Simulate assistant response
    setTimeout(() => {
      const assistantMessage: Message = {
        id: `m${Date.now()}-assistant`,
        role: 'assistant',
        content: 'Thank you for that update. I&apos;m analyzing the diagnostic data and will provide recommendations shortly.',
        timestamp: new Date(),
      }
      setMessages((prev) => [...prev, assistantMessage])
    }, 500)
  }

  return (
    <div className="flex flex-1 flex-col gap-6 overflow-hidden p-6 h-full">
      {/* Header */}
      <div className="flex items-center justify-between flex-shrink-0">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-semibold text-foreground">Conversations</h1>
          <p className="text-sm text-muted-foreground">Diagnostic insights and vehicle health discussions</p>
        </div>
        <Button className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90">
          <Plus className="h-4 w-4" />
          New Conversation
        </Button>
      </div>

      {/* Main Content */}
      <div className="flex flex-1 gap-6 overflow-hidden">
        {/* Conversation List */}
        <div className="flex w-80 flex-col gap-4 flex-shrink-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search conversations..."
              className="pl-10 bg-card border-border"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <ScrollArea className="flex-1 rounded-md border border-border bg-card">
            <div className="p-4 space-y-2">
              {filteredConversations.map((conversation) => (
                <button
                  key={conversation.id}
                  onClick={() => setSelectedConversation(conversation.id)}
                  className={`w-full text-left p-3 rounded-md transition-colors ${
                    selectedConversation === conversation.id
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted hover:bg-muted/80 text-foreground'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <p className="font-medium text-sm truncate">{conversation.vehicle}</p>
                    <Badge
                      variant="outline"
                      className={`text-xs flex-shrink-0 ${
                        conversation.status === 'resolved'
                          ? 'bg-emerald-500/10 text-emerald-700'
                          : conversation.status === 'pending'
                            ? 'bg-amber-500/10 text-amber-700'
                            : 'bg-blue-500/10 text-blue-700'
                      }`}
                    >
                      {conversation.status}
                    </Badge>
                  </div>
                  <p className="text-xs text-foreground/70 truncate mb-2">{conversation.title}</p>
                  <p className="text-xs text-foreground/60 line-clamp-2 mb-2">{conversation.lastMessage}</p>
                  <div className="flex items-center gap-1 text-xs text-foreground/50">
                    <Clock className="h-3 w-3" />
                    {conversation.timestamp.toLocaleDateString()}
                  </div>
                </button>
              ))}
            </div>
          </ScrollArea>
        </div>

        {/* Chat Interface */}
        {currentConversation && (
          <div className="flex-1 flex flex-col gap-4 rounded-lg border border-border bg-card overflow-hidden">
            {/* Chat Header */}
            <div className="border-b border-border p-4 flex-shrink-0">
              <h2 className="font-semibold text-foreground">{currentConversation.vehicle}</h2>
              <p className="text-sm text-muted-foreground">{currentConversation.title}</p>
            </div>

            {/* Messages */}
            <ScrollArea className="flex-1 p-4">
              <div className="space-y-4 max-w-2xl">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex gap-3 ${message.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
                  >
                    <div className={`h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                      message.role === 'user'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground'
                    }`}>
                      {message.role === 'user' ? 'Y' : 'DH'}
                    </div>
                    <div className={`flex flex-col gap-1 max-w-sm ${message.role === 'user' ? 'items-end' : 'items-start'}`}>
                      <div className={`p-3 rounded-lg ${
                        message.role === 'user'
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted text-foreground'
                      }`}>
                        <p className="text-sm">{message.content}</p>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>
                ))}
                <div ref={scrollRef} />
              </div>
            </ScrollArea>

            {/* Input */}
            <div className="border-t border-border p-4 flex-shrink-0">
              <div className="flex gap-2">
                <Input
                  placeholder="Type your message..."
                  className="flex-1 bg-card border-border"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      handleSendMessage()
                    }
                  }}
                />
                <Button
                  onClick={handleSendMessage}
                  className="bg-primary text-primary-foreground hover:bg-primary/90"
                  size="icon"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
