'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { Id } from '../../../convex/_generated/dataModel';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MessageSquare,
  Send,
  Loader2,
  Bot,
  User,
  X,
  Minus,
  Maximize2,
  Minimize2,
  Paperclip,
  FileText,
  Building2,
  RotateCw,
  Trash2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useUser } from '@clerk/nextjs';
import { useToast } from '@/components/premium/Toast';

interface GlobalAIChatProps {
  contractId?: Id<"contracts">;
  vendorId?: Id<"vendors">;
}

type ChatState = 'minimized' | 'normal' | 'maximized';

export const GlobalAIChat: React.FC<GlobalAIChatProps> = ({ contractId, vendorId }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [chatState, setChatState] = useState<ChatState>('normal');
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedSessionId, setSelectedSessionId] = useState<Id<"chatSessions"> | null>(null);
  
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { user } = useUser();
  const { toast } = useToast();

  // Convex queries and mutations
  const sessions = useQuery(api.ai.chat.getChatSessions, { limit: 5 });
  const currentSession = useQuery(
    api.ai.chat.getChatSession,
    selectedSessionId ? { sessionId: selectedSessionId } : 'skip'
  );
  const sendMessage = useMutation(api.ai.chat.sendChatMessage);
  const deleteSession = useMutation(api.ai.chat.deleteChatSession);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollAreaRef.current && currentSession?.messages) {
      scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
    }
  }, [currentSession?.messages]);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Ctrl/Cmd + Shift + K to toggle chat
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'k') {
        e.preventDefault();
        setIsOpen(prev => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, []);

  const handleSendMessage = async () => {
    if (!message.trim() || isLoading) return;

    setIsLoading(true);
    const messageText = message;
    setMessage('');

    try {
      const result = await sendMessage({
        sessionId: selectedSessionId || undefined,
        message: messageText,
        context: contractId || vendorId ? {
          contractId,
          vendorId
        } : undefined
      });

      if (!selectedSessionId) {
        setSelectedSessionId(result.sessionId);
      }
    } catch (error) {
      console.error('Failed to send message:', error);
      toast({
        type: "error",
        title: "Error",
        description: "Failed to send message. Please try again."
      });
      setMessage(messageText); // Restore message on error
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteSession = async (sessionId: Id<"chatSessions">) => {
    try {
      await deleteSession({ sessionId });
      if (selectedSessionId === sessionId) {
        setSelectedSessionId(null);
      }
      toast({
        type: "success",
        title: "Session deleted",
        description: "Chat session has been deleted."
      });
    } catch (error) {
      console.error('Failed to delete session:', error);
      toast({
        type: "error",
        title: "Error",
        description: "Failed to delete session."
      });
    }
  };

  const getSizeClasses = () => {
    switch (chatState) {
      case 'minimized':
        return 'w-80 h-14';
      case 'normal':
        return 'w-[400px] h-[600px]';
      case 'maximized':
        return 'w-[90vw] max-w-5xl h-[90vh]';
    }
  };

  const messages = currentSession?.messages || [];

  return (
    <>
      {/* Chat Toggle Button */}
      <motion.button
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsOpen(true)}
        className={cn(
          "fixed bottom-6 right-6 z-50 p-4 rounded-full",
          "bg-gradient-to-r from-teal-600 to-cyan-600",
          "text-white shadow-lg hover:shadow-xl transition-all",
          "flex items-center justify-center",
          isOpen && "hidden"
        )}
      >
        <MessageSquare className="w-6 h-6" />
      </motion.button>

      {/* Chat Window */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 20 }}
            transition={{ type: "spring", duration: 0.3 }}
            className={cn(
              "fixed bottom-6 right-6 z-50",
              "bg-gray-900 border border-gray-800 rounded-lg shadow-2xl",
              "flex flex-col overflow-hidden transition-all duration-300",
              getSizeClasses()
            )}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-800 bg-gray-900/50 backdrop-blur">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-r from-teal-600 to-cyan-600 flex items-center justify-center">
                    <Bot className="w-6 h-6 text-white" />
                  </div>
                  <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-gray-900" />
                </div>
                <div>
                  <h3 className="font-semibold text-white">AI Assistant</h3>
                  <p className="text-xs text-gray-400">
                    {chatState === 'minimized' ? 'Click to expand' : 'Always here to help'}
                  </p>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                {chatState !== 'minimized' && (
                  <>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => setChatState(chatState === 'maximized' ? 'normal' : 'maximized')}
                      className="text-gray-400 hover:text-white"
                    >
                      {chatState === 'maximized' ? (
                        <Minimize2 className="w-4 h-4" />
                      ) : (
                        <Maximize2 className="w-4 h-4" />
                      )}
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => setChatState('minimized')}
                      className="text-gray-400 hover:text-white"
                    >
                      <Minus className="w-4 h-4" />
                    </Button>
                  </>
                )}
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => setIsOpen(false)}
                  className="text-gray-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {chatState !== 'minimized' && (
              <>
                {/* Session Selector */}
                {sessions && sessions.length > 0 && (
                  <div className="p-3 border-b border-gray-800 bg-gray-900/30">
                    <div className="flex items-center gap-2 overflow-x-auto">
                      <Button
                        size="sm"
                        variant={!selectedSessionId ? "default" : "ghost"}
                        onClick={() => setSelectedSessionId(null)}
                        className="text-xs whitespace-nowrap"
                      >
                        New Chat
                      </Button>
                      {sessions.map((session) => (
                        <div key={session._id} className="flex items-center gap-1">
                          <Button
                            size="sm"
                            variant={selectedSessionId === session._id ? "default" : "ghost"}
                            onClick={() => setSelectedSessionId(session._id)}
                            className="text-xs whitespace-nowrap"
                          >
                            {session.title.substring(0, 20)}...
                          </Button>
                          {selectedSessionId === session._id && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleDeleteSession(session._id)}
                              className="p-1 h-auto"
                            >
                              <Trash2 className="w-3 h-3 text-red-400" />
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Messages */}
                <ScrollArea className="flex-1 p-4" ref={scrollAreaRef}>
                  <div className="space-y-4">
                    {messages.length === 0 && (
                      <div className="text-center py-8">
                        <Bot className="w-12 h-12 mx-auto text-gray-600 mb-4" />
                        <p className="text-gray-400 text-sm">
                          Hi! I'm your AI assistant. How can I help you today?
                        </p>
                        <p className="text-gray-500 text-xs mt-2">
                          Ask me about contracts, vendors, or any other questions.
                        </p>
                      </div>
                    )}
                    
                    {messages.map((msg, idx) => (
                      <motion.div
                        key={msg.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.05 }}
                        className={cn(
                          "flex gap-3",
                          msg.role === 'user' ? 'justify-end' : 'justify-start'
                        )}
                      >
                        {msg.role === 'assistant' && (
                          <Avatar className="w-8 h-8 shrink-0">
                            <AvatarFallback className="bg-gradient-to-r from-teal-600 to-cyan-600 text-white">
                              <Bot className="w-4 h-4" />
                            </AvatarFallback>
                          </Avatar>
                        )}
                        
                        <div className={cn(
                          "max-w-[80%] rounded-lg p-3",
                          msg.role === 'user' 
                            ? 'bg-teal-600 text-white' 
                            : 'bg-gray-800 text-gray-200'
                        )}>
                          <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                          
                          {msg.attachments && msg.attachments.length > 0 && (
                            <div className="mt-2 space-y-1">
                              {msg.attachments.map((attachment, i) => (
                                <div key={i} className="flex items-center gap-2 text-xs opacity-80">
                                  {attachment.type === 'contract' ? (
                                    <FileText className="w-3 h-3" />
                                  ) : (
                                    <Building2 className="w-3 h-3" />
                                  )}
                                  <span>{attachment.title}</span>
                                </div>
                              ))}
                            </div>
                          )}
                          
                          <p className="text-xs opacity-60 mt-1">
                            {new Date(msg.timestamp).toLocaleTimeString()}
                          </p>
                        </div>
                        
                        {msg.role === 'user' && (
                          <Avatar className="w-8 h-8 shrink-0">
                            <AvatarFallback className="bg-gray-700 text-white">
                              {user?.firstName?.[0] || 'U'}
                            </AvatarFallback>
                          </Avatar>
                        )}
                      </motion.div>
                    ))}
                    
                    {isLoading && (
                      <div className="flex gap-3">
                        <Avatar className="w-8 h-8">
                          <AvatarFallback className="bg-gradient-to-r from-teal-600 to-cyan-600 text-white">
                            <Bot className="w-4 h-4" />
                          </AvatarFallback>
                        </Avatar>
                        <div className="bg-gray-800 rounded-lg p-3">
                          <div className="flex items-center gap-2">
                            <Loader2 className="w-4 h-4 animate-spin text-teal-500" />
                            <span className="text-sm text-gray-400">Thinking...</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </ScrollArea>

                {/* Context Indicator */}
                {(contractId || vendorId) && (
                  <div className="px-4 py-2 bg-gray-800/50 border-t border-gray-800">
                    <div className="flex items-center gap-2 text-xs text-gray-400">
                      <Paperclip className="w-3 h-3" />
                      <span>Context: {contractId ? 'Contract' : 'Vendor'} attached</span>
                    </div>
                  </div>
                )}

                {/* Input */}
                <div className="p-4 border-t border-gray-800">
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      handleSendMessage();
                    }}
                    className="flex gap-2"
                  >
                    <Input
                      ref={inputRef}
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder="Type your message..."
                      disabled={isLoading}
                      className="flex-1 bg-gray-800 border-gray-700 text-white placeholder:text-gray-500"
                    />
                    <Button
                      type="submit"
                      size="icon"
                      disabled={!message.trim() || isLoading}
                      className="bg-teal-600 hover:bg-teal-700"
                    >
                      {isLoading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Send className="w-4 h-4" />
                      )}
                    </Button>
                  </form>
                  
                  <p className="text-xs text-gray-500 mt-2 text-center">
                    Press <kbd className="px-1.5 py-0.5 bg-gray-800 rounded text-gray-400">⌘</kbd> + 
                    <kbd className="px-1.5 py-0.5 bg-gray-800 rounded text-gray-400 mx-1">⇧</kbd> + 
                    <kbd className="px-1.5 py-0.5 bg-gray-800 rounded text-gray-400">K</kbd> to toggle
                  </p>
                </div>
              </>
            )}

            {/* Minimized State Click Handler */}
            {chatState === 'minimized' && (
              <div 
                className="absolute inset-0 cursor-pointer" 
                onClick={() => setChatState('normal')}
              />
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};