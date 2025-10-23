import { useState } from 'react';
import { Edit2, CheckCircle } from 'lucide-react';
import axios from 'axios';

export default function MessageBubble({ message, isOwn, socket }) {
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(message.content);
  const [showStatus, setShowStatus] = useState(false);

  const handleEdit = async () => {
    if (editContent.trim() === message.content) {
      setIsEditing(false);
      return;
    }

    try {
      await axios.post(`/api/messages/${message.id}/edit`, { content: editContent });
      socket.emit('editMessage', { messageId: message.id, content: editContent });
      setIsEditing(false);
    } catch (error) {
      console.error('Edit failed:', error);
    }
  };

  const statusIcon = () => {
    switch (message.messageStatus) {
      case 'sent': return <CheckCircle size={16} className="text-gray-400" />;
      case 'delivered': return <CheckCircle size={16} className="text-blue-500" />;
      case 'read': return <CheckCircle size={16} className="text-whatsapp-green fill-current" />;
      default: return null;
    }
  };

  return (
    <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'} mb-2`}>
      <div className={`message-bubble ${isOwn ? 'bg-whatsapp-green' : 'bg-white'} rounded-2xl p-3 max-w-xs md:max-w-md shadow-sm`}>
        {isEditing ? (
          <div className="space-y-2">
            <textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              className="w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-whatsapp-green resize-none"
              rows={3}
            />
            <div className="flex justify-end space-x-2">
              <button
                onClick={() => {
                  setIsEditing(false);
                  setEditContent(message.content);
                }}
                className="text-gray-500 text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleEdit}
                className="text-whatsapp-green text-sm font-semibold"
              >
                Save
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex justify-between items-start mb-1">
              <p className="text-sm leading-relaxed">{message.content}</p>
              {isOwn && (
                <div className="flex items-center space-x-1 ml-2">
                  {showStatus && statusIcon()}
                  <button
                    onClick={() => setIsEditing(true)}
                    className="text-xs text-white opacity-75"
                  >
                    <Edit2 size={14} />
                  </button>
                </div>
              )}
            </div>
            
            <div className="flex justify-between items-center text-xs">
              <span className="opacity-75">{formatTime(message.createdAt)}</span>
              {message.edited && <span className="edited ml-1">edited</span>}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function formatTime(dateString) {
  return new Intl.DateTimeFormat('en-US', { 
    hour: 'numeric', 
    minute: '2-digit' 
  }).format(new Date(dateString));
}