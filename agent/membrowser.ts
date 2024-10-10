// ... 现有代码 ...

import { addListener } from "process";

export class MemBrowserAgent {
    constructor() {
        this.init();
    }

    init() {
        // ... 现有代码 ...

        // 添加与服务端通信的逻辑
        this.setupCommunication();
    }
    readMemory(address: number, size: number){
        console.log(`Reading ${size} bytes from address ${address}`);
        return ptr(address).readByteArray(size);
    }
    
    writeMemory(address: number, data: ArrayBuffer) {
        console.log(`Writing ${data.byteLength} bytes to address ${address}`);
        ptr(address).writeByteArray(data);
    }
    
    searchMemory(pattern: string, rangeStart: number, rangeEnd: number) {
        console.log(`Searching for pattern ${pattern} from ${rangeStart} to ${rangeEnd}`);
        const results = Memory.scanSync(ptr(rangeStart), rangeEnd - rangeStart, pattern);
        return results.map(match => ({ address: match.address.toString(), size: match.size }));
    }

    setupCommunication() {
        send({ type: 'agent_ready' });
    
        const handleMessage = (message: any) => {
            if (message.type === 'read_memory') {
                const { address, size } = message;
                const data = this.readMemory(address, size);
                send({ type: 'memory_data', data:data });
            } else if (message.type === 'write_memory') {
                const { address, data } = message;
                this.writeMemory(address, data);
                send({ type: 'write_success' });
            } else if (message.type === 'search_memory') {
                const { pattern, rangeStart, rangeEnd } = message;
                const results = this.searchMemory(pattern, rangeStart, rangeEnd);
                send({ type: 'search_results', results });
            }
    
            // 使用 setImmediate 来异步地监听下一条消息
            setImmediate(() => recv(handleMessage));
        };
    
        // 开始监听消息
        recv(handleMessage);
    }


    // ... 现有代码 ...
}

const agent = new MemBrowserAgent();