type WorkerEventListener = (data: any) => void;

class WorkerEventInterface {
    eventListeners: Map<string, WorkerEventListener[]> = new Map();

    constructor(target: any) {
        target.onmessage = (ev: any) => {
            const eventListenersForEvent = this.eventListeners.get(ev.data.event) || [];
            for (let listener of eventListenersForEvent) {
                listener(ev.data.data);
            }
        };
    }

    addEventListener(event: string, listener: WorkerEventListener) {
        if (this.eventListeners.has(event)) {
            this.eventListeners.get(event)!.push(listener);
        } else {
            this.eventListeners.set(event, [listener]);
        }
    }

    removeEventListener(event: string, listenerToRemove: WorkerEventListener) {
        if (this.eventListeners.has(event)) {
            let eventListenersForEvent = this.eventListeners.get(event);
            if (eventListenersForEvent) {
                this.eventListeners.set(event, eventListenersForEvent.filter((listener) => {
                    return listener !== listenerToRemove;
                }));
            }
        }
    }

    removeEventListenersForEvent(event: string) {
        this.eventListeners.delete(event);
    }

    send(event: string, data: any, target: any = self) {
        target.postMessage({
            event: event,
            data: data
        });
    }
}

export class WorkerInterface extends WorkerEventInterface {
    private worker: Worker;

    constructor(url: string) {
        const worker = new Worker(url);//, {type: 'module'}); can't use this yet https://crbug.com/680046
        super(worker);

        this.worker = worker;
    }

    send(event: string, data: any) {
        super.send(event, data, this.worker);
    }

    terminate() {
        this.worker.terminate();
    }
}

export class MainThreadInterface extends WorkerEventInterface {
    private static _instance: MainThreadInterface;

    private constructor() {
        super(self);
    }

    static get instance() {
        if (!MainThreadInterface._instance) {
            MainThreadInterface._instance = new MainThreadInterface();
        }
        return MainThreadInterface._instance;
    }
}
