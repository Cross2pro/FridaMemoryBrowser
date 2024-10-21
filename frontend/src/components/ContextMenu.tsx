import React, { useEffect, useRef } from 'react';

interface ContextMenuProps {
  x: number;
  y: number;
  onClose: () => void;
  onJump: (address: string) => void;
}

const ContextMenu: React.FC<ContextMenuProps> = ({ x, y, onClose, onJump }) => {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (inputRef.current && !inputRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [onClose]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const address = inputRef.current?.value;
    if (address) {
      onJump(address);
    }
    onClose();
  };

  return (
    <div
      className="absolute bg-white border border-gray-300 shadow-md rounded-md p-2"
      style={{ left: x, top: y }}
    >
      <form onSubmit={handleSubmit}>
        <input
          ref={inputRef}
          type="text"
          placeholder="输入地址 (十六进制)"
          className="border rounded px-2 py-1 mb-2 w-full"
        />
        <button
          type="submit"
          className="bg-blue-500 text-white px-2 py-1 rounded hover:bg-blue-600 w-full"
        >
          跳转
        </button>
      </form>
    </div>
  );
};

export default ContextMenu;

