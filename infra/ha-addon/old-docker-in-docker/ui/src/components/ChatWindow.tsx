import { useState, useEffect, useRef, useCallback } from 'react';
import { SignalType } from '@holochain/client';
import { useHolochain } from '../contexts/HolochainContext';
import type { ChatSignal, StoredMessage, ChatConversation, SendMessageInput } from '../types';
import { agentKeyToHex, shortenAgentKey, MAX_MESSAGE_LENGTH } from '../types';
import './ChatWindow.css';

const STORAGE_KEY = 'ourblock_chat_history';
const MAX_STORED_MESSAGES = 100;

interface Props {
  recipientKey?: Uint8Array;
  onSelectConversation?: (agentKey: string) => void;
}

export function ChatWindow({ recipientKey, onSelectConversation }: Props) {
  const { client, isConnected } = useHolochain();
  const [myAgentKey, setMyAgentKey] = useState<string | null>(null);
  const [conversations, setConversations] = useState<Record<string, ChatConversation>>({});
  const [activeConversation, setActiveConversation] = useState<string | null>(null);
  const [messageInput, setMessageInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [typingIndicator, setTypingIndicator] = useState<string | null>(null);
  const [newRecipient, setNewRecipient] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load chat history from localStorage
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        setConversations(JSON.parse(stored));
      } catch (e) {
        console.error('Failed to load chat history:', e);
      }
    }
  }, []);

  // Save chat history to localStorage
  useEffect(() => {
    if (Object.keys(conversations).length > 0) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(conversations));
    }
  }, [conversations]);

  // Get my agent key
  useEffect(() => {
    if (!client) return;

    client.callZome({
      role_name: 'our_block',
      zome_name: 'chat',
      fn_name: 'get_my_agent_key',
      payload: null,
    }).then((key: Uint8Array) => {
      setMyAgentKey(agentKeyToHex(key));
    }).catch(console.error);
  }, [client]);

  // Set active conversation from prop
  useEffect(() => {
    if (recipientKey) {
      const hex = agentKeyToHex(recipientKey);
      setActiveConversation(hex);
    }
  }, [recipientKey]);

  // Listen for incoming signals
  useEffect(() => {
    if (!client) return;

    const unsubscribe = client.on('signal', (signal) => {
      // Extract AppSignal from wrapper (signal may be wrapped by Holochain client)
      const appSignal = 'value' in signal && signal.type === SignalType.App ? signal.value : signal as unknown as any;
      
      // Check if this is a chat signal
      if (appSignal.zome_name !== 'chat') return;
      
      const chatSignal = appSignal.payload as ChatSignal;

      if (chatSignal.type === 'Message') {
        const senderHex = agentKeyToHex(chatSignal.sender);
        
        const newMessage: StoredMessage = {
          id: chatSignal.message_id,
          sender: senderHex,
          recipient: myAgentKey || '',
          content: chatSignal.content,
          timestamp: chatSignal.timestamp,
          isOutgoing: false,
          read: false,
        };

        setConversations(prev => {
          const existing = prev[senderHex] || {
            peerId: senderHex,
            messages: [],
            lastActivity: Date.now(),
            unreadCount: 0,
          };

          // Deduplicate by message ID
          if (existing.messages.some((m: StoredMessage) => m.id === newMessage.id)) {
            return prev;
          }

          const updatedMessages = [...existing.messages, newMessage]
            .slice(-MAX_STORED_MESSAGES);

          return {
            ...prev,
            [senderHex]: {
              ...existing,
              messages: updatedMessages,
              lastActivity: Date.now(),
              unreadCount: activeConversation === senderHex ? 0 : existing.unreadCount + 1,
            },
          };
        });
      } else if (chatSignal.type === 'Typing') {
        const senderHex = agentKeyToHex(chatSignal.sender);
        setTypingIndicator(senderHex);
        setTimeout(() => setTypingIndicator(null), 3000);
      } else if (chatSignal.type === 'Read') {
        const senderHex = agentKeyToHex(chatSignal.sender);
        setConversations(prev => {
          const existing = prev[senderHex];
          if (!existing) return prev;

          return {
            ...prev,
            [senderHex]: {
              ...existing,
              messages: existing.messages.map((m: StoredMessage) =>
                m.id === chatSignal.message_id ? { ...m, read: true } : m
              ),
            },
          };
        });
      }
    });

    return () => {
      unsubscribe();
    };
  }, [client, myAgentKey, activeConversation]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversations, activeConversation]);

  const sendMessage = useCallback(async () => {
    if (!client || !activeConversation || !messageInput.trim()) return;

    setIsSending(true);
    try {
      // Convert hex back to Uint8Array
      const recipientBytes = new Uint8Array(
        activeConversation.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16))
      );

      const input: SendMessageInput = {
        recipient: recipientBytes,
        message: messageInput.trim(),
      };

      const result = await client.callZome({
        role_name: 'our_block',
        zome_name: 'chat',
        fn_name: 'send_message',
        payload: input,
      });

      // Add to local history
      const newMessage: StoredMessage = {
        id: result.message_id,
        sender: myAgentKey || '',
        recipient: activeConversation,
        content: messageInput.trim(),
        timestamp: result.timestamp,
        isOutgoing: true,
        read: false,
      };

      setConversations(prev => {
        const existing = prev[activeConversation] || {
          peerId: activeConversation,
          messages: [],
          lastActivity: Date.now(),
          unreadCount: 0,
        };

        return {
          ...prev,
          [activeConversation]: {
            ...existing,
            messages: [...existing.messages, newMessage].slice(-MAX_STORED_MESSAGES),
            lastActivity: Date.now(),
          },
        };
      });

      setMessageInput('');
    } catch (err) {
      console.error('Failed to send message:', err);
    } finally {
      setIsSending(false);
    }
  }, [client, activeConversation, messageInput, myAgentKey]);

  const startNewConversation = () => {
    if (newRecipient.trim().length >= 8) {
      setActiveConversation(newRecipient.trim());
      setNewRecipient('');
    }
  };

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  };

  const activeMessages = activeConversation 
    ? conversations[activeConversation]?.messages || []
    : [];

  if (!isConnected) {
    return (
      <div className="chat-window">
        <div className="chat-loading">Connecting...</div>
      </div>
    );
  }

  return (
    <div className="chat-window">
      {/* Sidebar: Conversation List */}
      <aside className="chat-sidebar">
        <header className="sidebar-header">
          <h3>💬 Chats</h3>
        </header>

        <div className="new-chat">
          <input
            type="text"
            placeholder="Enter agent key..."
            value={newRecipient}
            onChange={(e) => setNewRecipient(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && startNewConversation()}
          />
          <button onClick={startNewConversation} disabled={newRecipient.length < 8}>
            +
          </button>
        </div>

        <ul className="conversation-list">
          {Object.values(conversations)
            .sort((a, b) => b.lastActivity - a.lastActivity)
            .map((conv) => (
              <li
                key={conv.peerId}
                className={`conversation-item ${activeConversation === conv.peerId ? 'active' : ''}`}
                onClick={() => {
                  setActiveConversation(conv.peerId);
                  onSelectConversation?.(conv.peerId);
                  // Mark as read
                  setConversations(prev => ({
                    ...prev,
                    [conv.peerId]: { ...prev[conv.peerId], unreadCount: 0 },
                  }));
                }}
              >
                <div className="conv-avatar">👤</div>
                <div className="conv-info">
                  <span className="conv-name">{shortenAgentKey(conv.peerId)}</span>
                  <span className="conv-preview">
                    {conv.messages[conv.messages.length - 1]?.content.slice(0, 30) || 'No messages'}
                  </span>
                </div>
                {conv.unreadCount > 0 && (
                  <span className="unread-badge">{conv.unreadCount}</span>
                )}
              </li>
            ))}
        </ul>

        {Object.keys(conversations).length === 0 && (
          <div className="no-conversations">
            <p>No conversations yet</p>
            <small>Enter an agent key above to start chatting</small>
          </div>
        )}
      </aside>

      {/* Main Chat Area */}
      <main className="chat-main">
        {activeConversation ? (
          <>
            <header className="chat-header">
              <div className="chat-peer">
                <span className="peer-avatar">👤</span>
                <span className="peer-name">{shortenAgentKey(activeConversation)}</span>
              </div>
              <div className="chat-status">
                {typingIndicator === activeConversation && (
                  <span className="typing-indicator">typing...</span>
                )}
              </div>
            </header>

            <div className="messages-container">
              {activeMessages.length === 0 ? (
                <div className="no-messages">
                  <p>No messages yet</p>
                  <small>Send a message to start the conversation</small>
                </div>
              ) : (
                <div className="messages-list">
                  {activeMessages.map((msg: StoredMessage) => (
                    <div
                      key={msg.id}
                      className={`message ${msg.isOutgoing ? 'outgoing' : 'incoming'}`}
                    >
                      <div className="message-bubble">
                        <p className="message-content">{msg.content}</p>
                        <span className="message-time">
                          {formatTime(msg.timestamp)}
                          {msg.isOutgoing && msg.read && ' ✓✓'}
                        </span>
                      </div>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </div>

            <footer className="chat-input">
              <input
                type="text"
                placeholder="Type a message..."
                value={messageInput}
                onChange={(e) => setMessageInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                maxLength={MAX_MESSAGE_LENGTH}
                disabled={isSending}
              />
              <button
                className="send-btn"
                onClick={sendMessage}
                disabled={!messageInput.trim() || isSending}
              >
                {isSending ? '...' : '➤'}
              </button>
            </footer>
          </>
        ) : (
          <div className="no-chat-selected">
            <div className="empty-chat-icon">💬</div>
            <h3>Select a conversation</h3>
            <p>Choose an existing chat or start a new one</p>
          </div>
        )}
      </main>
    </div>
  );
}
