📦
1760 /agent/membrowser.js.map
1771 /agent/membrowser.js
✄
{"version":3,"file":"membrowser.js","sourceRoot":"D:/Reverse Tools/iOS/FridaMemoryBrowser/","sources":["agent/membrowser.ts"],"names":[],"mappings":"AAAA,MAAM,OAAO,eAAe;IAGxB;QACI,wBAAwB;QACxB,IAAI,CAAC,WAAW,GAAG,OAAO,CAAC,eAAe,CAAC,OAAO,CAAC,gBAAgB,EAAE,CAAC,CAAC,CAAC,CAAC,IAAI,CAAC,CAAC,IAAI,CAAC;QACpF,OAAO,CAAC,GAAG,CAAC,mCAAmC,GAAG,IAAI,CAAC,WAAW,CAAC,CAAC;IACxE,CAAC;IAED,8BAA8B;IAC9B,mBAAmB;IACnB,2FAA2F;IAC3F,2EAA2E;IAC3E,IAAI;IAEG,cAAc;QACjB,OAAO,IAAI,CAAC,WAAW,CAAC,QAAQ,EAAE,CAAC;IACvC,CAAC;IAEM,UAAU,CAAC,OAAe,EAAE,IAAY;QAC3C,OAAO,CAAC,GAAG,CAAC,WAAW,IAAI,uBAAuB,OAAO,EAAE,CAAC,CAAC;QAC7D,MAAM,IAAI,GAAG,GAAG,CAAC,OAAO,CAAC,CAAC,aAAa,CAAC,IAAI,CAAC,CAAC;QAC9C,IAAI,CAAC,IAAI,EAAE;YACP,MAAM,IAAI,KAAK,CAAC,oCAAoC,OAAO,EAAE,CAAC,CAAC;SAClE;QACD,OAAO,IAAI,CAAC;IAChB,CAAC;IAEM,WAAW,CAAC,OAAe,EAAE,IAAiB;QACjD,OAAO,CAAC,GAAG,CAAC,WAAW,IAAI,CAAC,UAAU,qBAAqB,OAAO,EAAE,CAAC,CAAC;QACtE,GAAG,CAAC,OAAO,CAAC,CAAC,cAAc,CAAC,IAAI,CAAC,CAAC;IACtC,CAAC;IAEM,YAAY,CAAC,OAAe,EAAE,UAAkB,EAAE,QAAgB;QACrE,OAAO,CAAC,GAAG,CAAC,yBAAyB,OAAO,SAAS,UAAU,OAAO,QAAQ,EAAE,CAAC,CAAC;QAClF,MAAM,OAAO,GAAG,MAAM,CAAC,QAAQ,CAAC,GAAG,CAAC,UAAU,CAAC,EAAE,QAAQ,GAAG,UAAU,EAAE,OAAO,CAAC,CAAC;QACjF,OAAO,OAAO,CAAC,GAAG,CAAC,KAAK,CAAC,EAAE,CAAC,CAAC,EAAE,OAAO,EAAE,KAAK,CAAC,OAAO,CAAC,QAAQ,EAAE,EAAE,IAAI,EAAE,KAAK,CAAC,IAAI,EAAE,CAAC,CAAC,CAAC;IAC3F,CAAC;CACJ;AAED,MAAM,KAAK,GAAG,IAAI,eAAe,EAAE,CAAC;AAEpC,GAAG,CAAC,OAAO,GAAG;IACV,cAAc,EAAE,GAAG,EAAE,CAAC,KAAK,CAAC,cAAc,EAAE;IAC5C,UAAU,EAAE,CAAC,OAAe,EAAE,IAAY,EAAE,EAAE,CAAC,KAAK,CAAC,UAAU,CAAC,OAAO,EAAE,IAAI,CAAC;IAC9E,WAAW,EAAE,CAAC,OAAe,EAAE,IAAiB,EAAE,EAAE,CAAC,KAAK,CAAC,WAAW,CAAC,OAAO,EAAE,IAAI,CAAC;IACrF,YAAY,EAAE,CAAC,OAAe,EAAE,UAAkB,EAAE,QAAgB,EAAE,EAAE,CAAC,KAAK,CAAC,YAAY,CAAC,OAAO,EAAE,UAAU,EAAE,QAAQ,CAAC;CAC7H,CAAC"}
✄
export class MemBrowserAgent {
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
    getBaseAddress() {
        return this.baseAddress.toString();
    }
    readMemory(address, size) {
        console.log(`Reading ${size} bytes from address ${address}`);
        const data = ptr(address).readByteArray(size);
        if (!data) {
            throw new Error(`Failed to read memory at address ${address}`);
        }
        return data;
    }
    writeMemory(address, data) {
        console.log(`Writing ${data.byteLength} bytes to address ${address}`);
        ptr(address).writeByteArray(data);
    }
    searchMemory(pattern, rangeStart, rangeEnd) {
        console.log(`Searching for pattern ${pattern} from ${rangeStart} to ${rangeEnd}`);
        const results = Memory.scanSync(ptr(rangeStart), rangeEnd - rangeStart, pattern);
        return results.map(match => ({ address: match.address.toString(), size: match.size }));
    }
}
const agent = new MemBrowserAgent();
rpc.exports = {
    getBaseAddress: () => agent.getBaseAddress(),
    readMemory: (address, size) => agent.readMemory(address, size),
    writeMemory: (address, data) => agent.writeMemory(address, data),
    searchMemory: (pattern, rangeStart, rangeEnd) => agent.searchMemory(pattern, rangeStart, rangeEnd),
};