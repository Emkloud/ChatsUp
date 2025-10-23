import { useState, useEffect, useRef } from 'react';
import { Search, Menu, ArrowLeft, Paperclip, Smile, Mic } from 'lucide-react';
import ChatList from './ChatList';

function ChatApp({ user, socket, logout }) {
  const [selectedChat, setSelectedChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    if (socket) {
      socket.on('message', (message) => {
        setMessages((prev) => [...prev, message]);
      });

      return () => {
        socket.off('message');
      };
    }
  }, [socket]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = (message) => {
    if (socket && message.trim()) {
      socket.emit('message', {
        chatId: selectedChat?.id,
        text: message,
        sender: user.id,
        timestamp: new Date()
      });
      setMessages((prev) => [...prev, { text: message, sender: user.id, timestamp: new Date() }]);
    }
  };

  return (
    <div className="flex h-screen bg-whatsapp-gray font-whatsapp">
      {/* Sidebar */}
      <div className="w-80 bg-white border-r border-gray-200">
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-whatsapp-green rounded-full flex items-center justify-center">
              <span className="text-white font-semibold">{user.name?.[0]}</span>
            </div>
            <span className="font-semibold">{user.name}</span>
          </div>
          <Menu className="w-6 h-6 cursor-pointer" />
        </div>
        
        <div className="p-4 border-b">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search or start new chat"
              className="w-full pl-10 pr-4 py-2 rounded-full bg-gray-100 focus:outline-none"
            />
          </div>
        </div>

        <ChatList 
          socket={socket} 
          selectedChat={selectedChat}
          setSelectedChat={setSelectedChat}
        />
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col">
        {selectedChat ? (
          <>
            {/* Chat Header */}
            <div className="flex items-center p-4 bg-white border-b">
              <ArrowLeft className="w-5 h-5 mr-3 cursor-pointer" />
              <div className="w-10 h-10 bg-whatsapp-green rounded-full flex items-center justify-center mr-3">
                <span className="text-white font-semibold">{selectedChat.name?.[0]}</span>
              </div>
              <div>
                <div className="font-semibold">{selectedChat.name}</div>
                <div className="text-sm text-gray-500">Online</div>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.map((msg, index) => (
                <div
                  key={index}
                  className={`flex ${msg.sender === user.id ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`message-bubble max-w-[70%] p-3 rounded-lg ${
                      msg.sender === user.id
                        ? 'bg-whatsapp-lgreen rounded-br-sm'
                        : 'bg-white rounded-bl-sm'
                    }`}
                  >
                    <div className="text-sm">{msg.text}</div>
                    <div className="edited text-xs text-gray-500 mt-1">
                      {msg.timestamp.toLocaleTimeString()}
                    </div>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="p-4 bg-white border-t">
              <div className="flex items-center space-x-2">
                <Paperclip className="w-5 h-5 text-gray-500 cursor-pointer" />
                <input
                  type="text"
                  placeholder="Type a message"
                  className="flex-1 py-2 px-4 rounded-full focus:outline-none"
                  onKeyPress={(e) => e.key === 'Enter' && sendMessage(e.target.value)}
                />
                <Smile className="w-5 h-5 text-gray-500 cursor-pointer" />
                <Mic className="w-5 h-5 text-gray-500 cursor-pointer" />
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-500">
            Select a chat to start messaging
          </div>
        )}
      </div>
    </div>
  );
}

export default ChatApp;