export class MemBrowserAgent {
    private baseAddress: NativePointer;

    constructor() {
        this.baseAddress = Process.getModuleByName(Process.enumerateModules()[0].name).base;
        console.log('Agent initialized. Base address: ' + this.baseAddress);
    }

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

    // 新增的模块操作方法
    public enumerateModules(): any[] {
        return Process.enumerateModules().map(module => ({
            name: module.name,
            base: module.base.toString(),
            size: module.size,
            path: module.path
        }));
    }

    public getModuleInfo(moduleName: string): any {
        const module = Process.getModuleByName(moduleName);
        return {
            name: module.name,
            base: module.base.toString(),
            size: module.size,
            path: module.path
        };
    }

    public getModuleRanges(): any[] {
        return Process.enumerateRanges('r-x').map(range => ({
            base: range.base.toString(),
            size: range.size
        }));
    }

    // 新增的进程操作方法
    public getProcessId(): number {
        return Process.id;
    }

    public getProcessName(): string {
        return Process.enumerateModules()[0].name;
    }

    // 其他有用的操作
    public enumerateThreads(): ThreadDetails[] {
        return Process.enumerateThreads();
    }

    public setExceptionHandler(callback: (details: any) => void): void {
        Process.setExceptionHandler(callback);
    }

    public createHook(address: NativePointer, callback: (args: any[]) => void): InvocationListener {
        return Interceptor.attach(address, callback);
    }

    public getModuleImports(moduleName: string): any[] {
        const module = Process.getModuleByName(moduleName);
        return module.enumerateImports().map(imp => ({
            name: imp.name,
            address: imp.address ? imp.address.toString() : 'Unknown'
        }));
    }

    public getModuleExports(moduleName: string): any[] {
        const module = Process.getModuleByName(moduleName);
        return module.enumerateExports().map(exp => ({
            name: exp.name,
            address: exp.address ? exp.address.toString() : 'Unknown'
        }));
    }

    public dumpModule(moduleName: string): ArrayBuffer {
        const module = Process.getModuleByName(moduleName);
        return module.base.readByteArray(module.size) as ArrayBuffer;
    }
}

const agent = new MemBrowserAgent();

rpc.exports = {
    getBaseAddress: () => agent.getBaseAddress(),
    readMemory: (address: number, size: number) => agent.readMemory(address, size),
    writeMemory: (address: number, data: ArrayBuffer) => agent.writeMemory(address, data),
    searchMemory: (pattern: string, rangeStart: number, rangeEnd: number) => agent.searchMemory(pattern, rangeStart, rangeEnd),
    // 新增的 RPC 导出
    enumerateModules: () => agent.enumerateModules(),
    getModuleInfo: (moduleName: string) => agent.getModuleInfo(moduleName),
    getModuleRanges: () => agent.getModuleRanges(),
    getProcessId: () => agent.getProcessId(),
    getProcessName: () => agent.getProcessName(),
    enumerateThreads: () => agent.enumerateThreads(),
    setExceptionHandler: (callback: (details: any) => void) => agent.setExceptionHandler(callback),
    createHook: (address: string, callback: (args: any[]) => void) => agent.createHook(ptr(address), callback),
    getModuleImports: (moduleName: string) => agent.getModuleImports(moduleName),
    getModuleExports: (moduleName: string) => agent.getModuleExports(moduleName),
    dumpModule: (moduleName: string) => agent.dumpModule(moduleName),
};
