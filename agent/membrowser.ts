import 'frida-il2cpp-bridge';

export class MemBrowserAgent {
    private baseAddress: NativePointer;
    private il2cppInitialized: boolean = false;
    private il2cppModuleDetected: boolean = false;

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

    private withIl2Cpp<T>(fn: () => T, timeoutMs: number = 20000): Promise<T> {
        return new Promise<T>((resolve, reject) => {
            let settled = false;

            const timer = setTimeout(() => {
                if (settled) return;
                settled = true;
                console.log(`[il2cpp] withIl2Cpp: timeout after ${timeoutMs}ms`);
                reject(new Error(`Il2Cpp.perform timeout after ${timeoutMs}ms`));
            }, timeoutMs);

            try {
                console.log('[il2cpp] withIl2Cpp: entering Il2Cpp.perform');
                Il2Cpp.perform(() => {
                    if (settled) return;
                    try {
                        console.log('[il2cpp] withIl2Cpp: executing function');
                        const result = fn();
                        settled = true;
                        clearTimeout(timer);
                        console.log('[il2cpp] withIl2Cpp: function returned');
                        resolve(result);
                    } catch (e) {
                        settled = true;
                        clearTimeout(timer);
                        console.log('[il2cpp] withIl2Cpp: function threw ' + e);
                        reject(e);
                    }
                });
            } catch (e) {
                if (!settled) {
                    settled = true;
                    clearTimeout(timer);
                    console.log('[il2cpp] withIl2Cpp: perform threw ' + e);
                    reject(e);
                }
            }
        });
    }

    private scanUnityModules(): {
        hasUnity: boolean;
        hasIl2cpp: boolean;
        matches: string[];
    } {
        const modules = Process.enumerateModules();
        const rows = modules.map(m => ({
            name: (m.name || '').toLowerCase(),
            path: (m.path || '').toLowerCase(),
            raw: `${m.name} ${m.path}`,
        }));

        // Unity hints (broad)
        const unityHints = [
            'libunity.so',
            'unityframework',
            'unityplayer.dll',
        ];

        // IL2CPP hints (strict)
        const il2cppHints = [
            'libil2cpp.so',
            'libil2cpp.dylib',
            'gameassembly.dll',
        ];

        const matches: string[] = [];

        const hasUnity = rows.some(r => {
            const s = `${r.name} ${r.path}`;
            const ok = unityHints.some(h => s.includes(h));
            if (ok) matches.push(r.raw);
            return ok;
        });

        const hasIl2cpp = rows.some(r => {
            const s = `${r.name} ${r.path}`;
            const ok = il2cppHints.some(h => s.includes(h));
            if (ok) matches.push(r.raw);
            return ok;
        });

        return { hasUnity, hasIl2cpp, matches: Array.from(new Set(matches)) };
    }

    private async ensureIl2CppReady(): Promise<void> {
        if (this.il2cppInitialized) return;

        if (!this.il2cppModuleDetected) {
            throw new Error('IL2CPP runtime not detected by module scan (call detectIL2CPP first)');
        }

        console.log('[il2cpp] ensureIl2CppReady: entering perform')
        await this.withIl2Cpp(() => {
            void Il2Cpp.domain;
        });
        this.il2cppInitialized = true;
        console.log('[il2cpp] ensureIl2CppReady: ok')
    }

    public async detectIL2CPP(): Promise<boolean> {
        // Per request: use module detection
        const scan = this.scanUnityModules();
        this.il2cppModuleDetected = scan.hasIl2cpp;

        // Use string concat so it shows up in Python logs (otherwise you may see [object Object]).
        console.log('[il2cpp] detectIL2CPP: moduleScan ' + JSON.stringify({
            hasUnity: scan.hasUnity,
            hasIl2cpp: scan.hasIl2cpp,
            matches: scan.matches,
        }));

        if (!scan.hasIl2cpp) {
            this.il2cppInitialized = false;
            console.log('IL2CPP not detected (no il2cpp runtime modules found)');
            return false;
        }

        // Important: do NOT call Il2Cpp.perform here.
        // Some non-IL2CPP Unity targets can still match unity modules, and Il2Cpp.perform may never run,
        // which would hang exports_sync calls on the backend.
        console.log('IL2CPP detected by module scan (runtime present)');
        return true;
    }

    public async getIL2CPPHierarchy(): Promise<any[]> {
        console.log('[il2cpp] getIL2CPPHierarchy: building hierarchy')
        return this.withIl2Cpp(() => {
            console.log('[il2cpp] getIL2CPPHierarchy: entering perform')
            const hierarchy: any[] = [];
            const unityImage = Il2Cpp.domain.assembly('UnityEngine.CoreModule').image;
            const ObjectClass = unityImage.class('UnityEngine.Object');
            const GameObjectClass = unityImage.class('UnityEngine.GameObject');

            // UnityEngine.Object.FindObjectsOfType(Type type)
            const allObjects = ObjectClass
                .method<Il2Cpp.Array<Il2Cpp.Object>>('FindObjectsOfType', 1)
                .invoke(GameObjectClass.type.object);
            console.log('[il2cpp] getIL2CPPHierarchy: found ' + allObjects.length + ' GameObjects');
            for (let i = 0; i < allObjects.length; i++) {
                const obj = allObjects.get(i);
                try {
                    const nameField = obj.method<Il2Cpp.String>('get_name').invoke();
                    const transform = obj.method<Il2Cpp.Object>('get_transform').invoke();
                    const parentTransform = transform.method<Il2Cpp.Object>('get_parent').invoke();
                    let parentGameObject: Il2Cpp.Object | null = null;
                    if (!parentTransform.isNull()) {
                        try {
                            parentGameObject = parentTransform.method<Il2Cpp.Object>('get_gameObject').invoke();
                        } catch (e) {
                            parentGameObject = null;
                        }
                    }

                    hierarchy.push({
                        address: obj.handle.toString(),
                        name: nameField?.content || 'Unknown',
                        hasParent: parentGameObject !== null && !parentGameObject.isNull(),
                        parentAddress:
                            parentGameObject === null || parentGameObject.isNull()
                                ? null
                                : parentGameObject.handle.toString(),
                    });
                } catch (e) {
                    console.log('Error processing GameObject: ' + e);
                }
            }

            return hierarchy;
        });
    }

    public async getIL2CPPObjectDetails(address: string): Promise<any> {

        console.log('[il2cpp] getIL2CPPObjectDetails: address', address)
        return this.withIl2Cpp(() => {
            const objHandle = ptr(address);
            const obj = new Il2Cpp.Object(objHandle);

            const unityImage = Il2Cpp.domain.assembly('UnityEngine.CoreModule').image;
            const ComponentClass = unityImage.class('UnityEngine.Component');

            const nameField = obj.method<Il2Cpp.String>('get_name').invoke();
            const transform = obj.method<Il2Cpp.Object>('get_transform').invoke();

            const components = obj
                .method<Il2Cpp.Array<Il2Cpp.Object>>('GetComponents', 1)
                .invoke(ComponentClass.type.object);

            const componentList: any[] = [];
            for (let i = 0; i < components.length; i++) {
                const comp = components.get(i);
                componentList.push({
                    type: comp.class.type.name,
                    address: comp.handle.toString(),
                });
            }

            // These may vary depending on Unity version / bindings; keep best-effort.
            let transformInfo: any = null;
            try {
                const position = transform.method<Il2Cpp.ValueType>('get_position').invoke();
                const rotation = transform.method<Il2Cpp.ValueType>('get_rotation').invoke();
                const scale = transform.method<Il2Cpp.ValueType>('get_localScale').invoke();
                transformInfo = {
                    position: { x: (position as any).fields.x.value, y: (position as any).fields.y.value, z: (position as any).fields.z.value },
                    rotation: { x: (rotation as any).fields.x.value, y: (rotation as any).fields.y.value, z: (rotation as any).fields.z.value, w: (rotation as any).fields.w.value },
                    scale: { x: (scale as any).fields.x.value, y: (scale as any).fields.y.value, z: (scale as any).fields.z.value },
                };
            } catch (e) {
                console.log('Warning: failed to read transform struct fields: ' + e);
            }

            return {
                address,
                name: nameField?.content || 'Unknown',
                type: obj.class.type.name,
                components: componentList,
                transform: transformInfo,
            };
        });
    }
}

const agent = new MemBrowserAgent();

rpc.exports = {
    getBaseAddress: () => agent.getBaseAddress(),
    readMemory: (address: number, size: number) => agent.readMemory(address, size),
    writeMemory: (address: number, data: ArrayBuffer) => agent.writeMemory(address, data),
    searchMemory: (pattern: string, rangeStart: number, rangeEnd: number) => agent.searchMemory(pattern, rangeStart, rangeEnd),
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
    detectIL2CPP: () => agent.detectIL2CPP(),
    getIL2CPPHierarchy: () => agent.getIL2CPPHierarchy(),
    getIL2CPPObjectDetails: (address: string) => agent.getIL2CPPObjectDetails(address),

    // Aliases for Frida Python snake_case mapping (e.g. detect_il2cpp -> detectIl2cpp)
    detectIl2cpp: () => agent.detectIL2CPP(),
    getIl2cppHierarchy: () => agent.getIL2CPPHierarchy(),
    getIl2cppObjectDetails: (address: string) => agent.getIL2CPPObjectDetails(address),
};
