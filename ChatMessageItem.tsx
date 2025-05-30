
import React from 'react';
import { Message } from '../types';
import { UserIcon, BotIcon } from './Icons';

interface ChatMessageItemProps {
  message: Message;
}

const ChatMessageItem: React.FC<ChatMessageItemProps> = ({ message }) => {
  const isUser = message.sender === 'user';

  return (
    <div className={`flex mb-4 ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`flex items-end max-w-xl ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
        <div className={`p-1 rounded-full ${isUser ? 'bg-primary ml-2' : 'bg-secondary mr-2'} text-white flex-shrink-0 shadow`}>
          {isUser ? <UserIcon className="w-5 h-5" /> : <BotIcon className="w-5 h-5" />}
        </div>
        <div
          className={`px-4 py-3 rounded-xl shadow-md ${
            isUser ? 'bg-primary text-white rounded-br-none' : 'bg-white text-gray-800 rounded-bl-none'
          }`}
        >
          <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">{message.text}</p>
        </div>
      </div>
    </div>
  );
};

export default ChatMessageItem;