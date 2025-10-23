import { useState, useEffect } from 'react';

function ChatList({ socket, selectedChat, setSelectedChat }) {
  const [chats, setChats] = useState([]);

  useEffect(() => {
    if (socket) {
      socket.emit('getChats');
      socket.on('chats', setChats);
      
      return () => socket.off('chats');
    }
  }, [socket]);

  return (
    <div className="space-y-1 p-2">
      {chats.map((chat) => (
        <div
          key={chat.id}
          className={`flex items-center p-3 cursor-pointer rounded-lg hover:bg-gray-100 ${
            selectedChat?.id === chat.id ? 'bg-whatsapp-lightgreen' : ''
          }`}
          onClick={() => setSelectedChat(chat)}
        >
          <div className="w-12 h-12 bg-whatsapp-dgreen rounded-full flex items-center justify-center mr-3">
            <span className="text-white font-semibold">{chat.name?.[0]}</span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-semibold truncate">{chat.name}</div>
            <div className="text-sm text-gray-500 truncate">{chat.lastMessage}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default ChatList;