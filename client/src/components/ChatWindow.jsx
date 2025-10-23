import { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Paperclip, Smile, Mic, Edit2, CheckCircle, Send } from 'lucide-react';
import axios from 'axios';
import EmojiPicker from 'emoji-picker-react';
import MessageBubble from './MessageBubble';

export default function ChatWindow({ user, chat, socket }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [showEmojis, setShowEmojis] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [typingUser, setTypingUser] = useState(null);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    axios.get(`/api/chats/${chat.id}`).then(res => setMessages(res.data));
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chat.id]);

  useEffect(() => {
    if (!socket) return;

    const handleMessage = (msg) => {
      setMessages(prev => [...prev, msg]);
    };

    const handleTyping = ({ userId, isTyping }) => {
      if (userId === chat.id) {
        setTypingUser(isTyping ? chat.username : null);
        setIsTyping(isTyping);
      }
    };

    socket.on('message', handleMessage);
    socket.on('typing', handleTyping);

    return () => {
      socket.off('message', handleMessage);
      socket.off('typing', handleTyping);
    };
  }, [socket, chat.id, chat.username]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = () => {
    if (!input.trim()) return;
    
    socket.emit('sendMessage', { 
      receiverId: chat.id, 
      content: input.trim(),
      type: 'text'
    });
    setInput('');
    setShowEmojis(false);
  };

  const handleTyping = (e) => {
    setInput(e.target.value);
    socket.emit('typing', { receiverId: chat.id, isTyping: e.target.value.length > 0 });
  };

  const onEmojiClick = (emojiData) => {
    setInput(prev => prev + emojiData.emoji);
    setShowEmojis(false);
  };

  return (
    <div className="flex flex-col h-full bg-whatsapp-lgreen">
      {/* Chat Header */}
      <div className="bg-whatsapp-dgray text-white p-4 flex items-center space-x-3">
        <ArrowLeft size={24} className="cursor-pointer" />
        <img src={`/uploads/${chat.avatar}`} alt={chat.username} className="w-10 h-10 rounded-full" />
        <div>
          <h3 className="font-semibold">{chat.username}</h3>
          <p className="text-sm opacity-75">{chat.online ? 'online' : 'offline'}</p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-whatsapp-gray">
        {messages.map((message) => (
          <MessageBubble
            key={message.id}
            message={message}
            isOwn={message.senderId === user.id}
            socket={socket}
          />
        ))}
        
        {typingUser && (
          <div className="typing-indicator">
            <div className="flex">
              <div className="typing-dot"></div>
              <div className="typing-dot"></div>
              <div className="typing-dot"></div>
            </div>
            <span className="text-sm text-gray-500 ml-2">{typingUser} is typing</span>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="bg-white p-4 border-t border-gray-200">
        <div className="flex items-center space-x-2">
          <button className="p-2 text-gray-500 hover:text-whatsapp-green">
            <Paperclip size={20} />
          </button>
          
          <div className="relative flex-1">
            <input
              type="text"
              placeholder="Type a message"
              className="w-full p-3 pr-12 border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-whatsapp-green"
              value={input}
              onChange={handleTyping}
              onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
            />
            
            <button
              className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-whatsapp-green"
              onClick={() => setShowEmojis(!showEmojis)}
            >
              <Smile size={20} />
            </button>
          </div>

          {showEmojis && (
            <div className="absolute bottom-16 right-4 z-50">
              <EmojiPicker onEmojiClick={onEmojiClick} />
            </div>
          )}

          <button
            onClick={sendMessage}
            className="bg-whatsapp-green text-white p-3 rounded-full"
            disabled={!input.trim()}
          >
            <Send size={20} />
          </button>
          
          <button className="p-2 text-gray-500 hover:text-whatsapp-green">
            <Mic size={20} />
          </button>
        </div>
      </div>
    </div>
  );
}