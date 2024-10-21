import React, { useMemo, useState, useCallback } from 'react';
import { FixedSizeList as List } from 'react-window';
import AutoSizer from 'react-virtualized-auto-sizer';
import ContextMenu from './ContextMenu';

interface HexViewProps {
  data: ArrayBuffer;
  bytesPerRow: number;
  startAddress: string;
  onJump: (address: string) => void;
}

const HexView: React.FC<HexViewProps> = ({ data, bytesPerRow = 16, startAddress, onJump }) => {
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);

  const view = new DataView(data);
  const rows = Math.ceil(data.byteLength / bytesPerRow);
  const baseAddress = parseInt(startAddress, 16);

  const toHex = (num: number): string => num.toString(16).padStart(2, '0').toUpperCase();
  const toAscii = (num: number): string => (num >= 32 && num <= 126) ? String.fromCharCode(num) : '.';

  const handleContextMenu = useCallback((event: React.MouseEvent) => {
    event.preventDefault();
    setContextMenu({ x: event.clientX, y: event.clientY });
  }, []);

  const closeContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  const Row = useMemo(() => ({ index, style }: { index: number; style: React.CSSProperties }) => {
    const offset = index * bytesPerRow;
    const rowData = Array.from({ length: bytesPerRow }, (_, i) => 
      offset + i < data.byteLength ? view.getUint8(offset + i) : null
    );

    const rowAddress = (baseAddress + offset).toString(16).padStart(16, '0').toUpperCase();

    return (
      <div style={style} className="flex hover:bg-gray-50">
        <div className="w-36 p-2 text-gray-500">
          {rowAddress}
        </div>
        <div className="flex-1 p-2">
          {rowData.map((byte, i) => (
            <span key={i} className={`inline-block w-6 ${byte === null ? 'text-gray-300' : 'text-gray-700'}`}>
              {byte !== null ? toHex(byte) : '  '}
            </span>
          ))}
        </div>
        <div className="w-40 p-2 text-gray-700">
          {rowData.map((byte, i) => (
            <span key={i}>
              {byte !== null ? toAscii(byte) : ' '}
            </span>
          ))}
        </div>
      </div>
    );
  }, [data, bytesPerRow, view, baseAddress]);

  return (
    <div className="font-mono text-sm" onContextMenu={handleContextMenu}>
      <div className="flex bg-gray-100 font-semibold">
        <div className="w-36 p-2">地址</div>
        <div className="flex-1 p-2">十六进制数据</div>
        <div className="w-40 p-2">ASCII</div>
      </div>
      <div className="h-96">
        <AutoSizer>
          {({ height, width }) => (
            <List
              height={height}
              itemCount={rows}
              itemSize={30}
              width={width}
            >
              {Row}
            </List>
          )}
        </AutoSizer>
      </div>
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={closeContextMenu}
          onJump={onJump}
        />
      )}
    </div>
  );
};

export default HexView;
