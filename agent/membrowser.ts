export class MemBrowserAgent {
    private baseAddress: NativePointer;

    constructor() {
        // 在构造函数中初始化 baseAddress
        this.baseAddress = Process.getModuleByName(Process.enumerateModules()[0].name).base;
        console.log('Agent initialized. Base address: ' + this.baseAddress);
        
    }

    // 移除 init 方法，因为我们已经在构造函数中初始化了
    // private init() {
    //     this.baseAddress = Process.getModuleByName(Process.enumerateModules()[0].name).base;
    //     console.log('Agent initialized. Base address: ' + this.baseAddress);
    // }

    public getBaseAddress(): string {
        return this.baseAddress.toString();
    }

    public readMemory(address: number, size: number): ArrayBuffer {
        console.log(`Reading ${size} bytes from address ${address}`);
        const data = ptr(address).readByteArray(size);
        if (!data) {
            throw new Error(`Failed to read memory at address ${address}`);
        }
        return data;
    }
    
    public writeMemory(address: number, data: ArrayBuffer) {
        console.log(`Writing ${data.byteLength} bytes to address ${address}`);
        ptr(address).writeByteArray(data);
    }
    
    public searchMemory(pattern: string, rangeStart: number, rangeEnd: number) {
        console.log(`Searching for pattern ${pattern} from ${rangeStart} to ${rangeEnd}`);
        const results = Memory.scanSync(ptr(rangeStart), rangeEnd - rangeStart, pattern);
        return results.map(match => ({ address: match.address.toString(), size: match.size }));
    }
}

const agent = new MemBrowserAgent();

rpc.exports = {
    getBaseAddress: () => agent.getBaseAddress(),
    readMemory: (address: number, size: number) => agent.readMemory(address, size),
    writeMemory: (address: number, data: ArrayBuffer) => agent.writeMemory(address, data),
    searchMemory: (pattern: string, rangeStart: number, rangeEnd: number) => agent.searchMemory(pattern, rangeStart, rangeEnd),
};